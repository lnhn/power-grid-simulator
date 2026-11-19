import { EdgeModel } from '../models/EdgeModel'
import { NodeModel } from '../models/NodeModel'
import { Side } from '../models/PortModel'
import { GridGraph } from './GridGraph'
import { buildElectricalUnion, computePotentials } from './potential'
import { computePower, powerToCurrent } from './power'

export type FlowDirection = 'forward' | 'reverse' | 'none'

export type EdgeState = {
  id: string
  active: boolean
  flow: FlowDirection
  voltage: number
  /** 该边流过的有功功率（kW），环网并联路径为 0 */
  kw: number
  /** 该边电流（A）；环网并联路径无法唯一分配，为 null */
  amp: number | null
  /** 是否属于环网并联路径（不在生成树上） */
  shared: boolean
  /** 环网交叉边（不属于 BFS 生成树） */
  loop: boolean
  /** 所在电气节点出现电位冲突 */
  conflict: boolean
}

/** 电气节点（等电位集合）：母线分段与运行方式的基本单位 */
export type SectionState = {
  id: string
  busIds: string[]
  sourceIds: string[]
  loadIds: string[]
  voltage: number
  energized: boolean
  /** 本段在用负荷合计（kW） */
  loadKw: number
  /** 本段运行中的负荷台数 */
  loadCount: number
  /** 本段负荷电流合计（A），按三相功率换算 */
  currentA: number
}

export type TieMode = 'sectioned' | 'parallel' | 'standby' | 'unsafeParallel'

/** 母联运行方式：分段 / 并列 / 备用 / 危险并列 */
export type TieState = {
  id: string
  closed: boolean
  mode: TieMode
  leftVoltage: number
  rightVoltage: number
  leftSources: string[]
  rightSources: string[]
}

export type GridSolveResult = {
  nodePowered: Map<string, boolean>
  nodeState: Map<string, boolean>
  portStatus: Map<string, Record<Side, boolean>>
  /** 端口电位，键为 id:side */
  portVoltages: Map<string, number>
  edgeStates: Map<string, EdgeState>
  distance: Map<string, number>
  /** 电位冲突的端口 id */
  voltageConflict: Set<string>
  /** 环网交叉边 id */
  loopEdges: Set<string>
  /** 电气节点列表 */
  sections: SectionState[]
  /** 母联运行方式 */
  ties: Map<string, TieState>
  /** 每个负荷当前用电功率（kW） */
  loadKw: Map<string, number>
  /** 每个电源当前出力（kW，同段内平均分摊） */
  sourceOutput: Map<string, number>
  /** 全网在用负荷合计（kW） */
  totalKw: number
}

export const voltageToColor = (voltage: number) => {
  if (voltage >= 1000) return '#ef4444'
  if (voltage >= 500) return '#f97316'
  if (voltage >= 220) return '#eab308'
  if (voltage >= 110) return '#22c55e'
  return '#3b82f6'
}

const SIDES: Side[] = ['top', 'bottom', 'left', 'right']

export class GridSolver {
  static solve(nodes: NodeModel[], edges: EdgeModel[]): GridSolveResult {
    const uf = buildElectricalUnion(nodes, edges)
    const potentials = computePotentials(uf, nodes)
    const portEnergized = (portId: string) => potentials.voltages.has(uf.find(portId))
    const portVoltage = (portId: string) => potentials.voltages.get(uf.find(portId)) ?? 0

    // BFS：判断"从电源出发的供电层级"（流向）与环网交叉边，不参与带电判定
    const graph = new GridGraph(nodes, edges)
    const distance = new Map<string, number>()
    const treeEdge = new Map<string, string | undefined>()
    const loopEdges = new Set<string>()
    const queue: string[] = []

    nodes
      .filter((node) => node.type === 'powerSource' && node.data.inService !== false)
      .forEach((node) => {
        const portId = `${node.id}:bottom`
        if (distance.has(portId)) return
        distance.set(portId, 0)
        treeEdge.set(portId, undefined)
        queue.push(portId)
      })

    while (queue.length) {
      const current = queue.shift() as string
      const base = distance.get(current) ?? 0
      const neighbors = graph.adjacency.get(current)
      if (!neighbors) continue
      neighbors.forEach((neighbor) => {
        const edgeId = graph.adjacencyEdge.get(current)?.get(neighbor)
        if (distance.has(neighbor)) {
          // 已访问且不是任一端的生成树边 -> 环网交叉边
          if (edgeId !== undefined && treeEdge.get(neighbor) !== edgeId && treeEdge.get(current) !== edgeId) {
            loopEdges.add(edgeId)
          }
          return
        }
        distance.set(neighbor, base + 1)
        treeEdge.set(neighbor, edgeId)
        queue.push(neighbor)
      })
    }

    const nodePowered = new Map<string, boolean>()
    const nodeState = new Map<string, boolean>()
    const portStatus = new Map<string, Record<Side, boolean>>()
    const portVoltages = new Map<string, number>()

    graph.nodes.forEach((node) => {
      const status: Record<Side, boolean> = {
        top: portEnergized(`${node.id}:top`),
        bottom: portEnergized(`${node.id}:bottom`),
        left: portEnergized(`${node.id}:left`),
        right: portEnergized(`${node.id}:right`),
      }
      portStatus.set(node.id, status)
      SIDES.forEach((side) => portVoltages.set(`${node.id}:${side}`, portVoltage(`${node.id}:${side}`)))
      nodePowered.set(node.id, node.computePowered(status))
      nodeState.set(node.id, node.computeNodeState(status))
    })

    // 功率汇总：负荷功率沿生成树回推到电源
    const power = computePower(nodes, edges, graph, portVoltages)

    const edgeStates = new Map<string, EdgeState>()
    graph.edges.forEach((edge) => {
      const sourceEnergized = portEnergized(edge.sourcePortId)
      const targetEnergized = portEnergized(edge.targetPortId)
      const active = sourceEnergized || targetEnergized
      const sourceDist = distance.get(edge.sourcePortId)
      const targetDist = distance.get(edge.targetPortId)
      const loop = loopEdges.has(edge.id)
      let flow: FlowDirection = 'none'

      if (active) {
        if (sourceDist !== undefined && targetDist === undefined) {
          flow = 'forward'
        } else if (targetDist !== undefined && sourceDist === undefined) {
          flow = 'reverse'
        } else if (sourceDist !== undefined && targetDist !== undefined) {
          if (sourceDist < targetDist) flow = 'forward'
          else if (targetDist < sourceDist) flow = 'reverse'
        }
      }

      const voltage = active ? portVoltage(edge.sourcePortId) : 0
      const conflict =
        potentials.conflicts.has(uf.find(edge.sourcePortId)) || potentials.conflicts.has(uf.find(edge.targetPortId))
      const kw = active ? power.edgeKw.get(edge.id) ?? 0 : 0
      const shared = power.sharedEdges.has(edge.id)
      // 电流按下游（更远离电源的一端）电压换算；环网并联路径无法唯一分配
      const childPort =
        (targetDist ?? -1) >= (sourceDist ?? -1) ? edge.targetPortId : edge.sourcePortId
      const childVoltage = portVoltages.get(childPort) ?? 0
      const amp = shared ? null : kw > 0 ? powerToCurrent(kw, childVoltage) : 0

      edgeStates.set(edge.id, {
        id: edge.id,
        active,
        flow,
        voltage,
        kw,
        amp,
        shared,
        loop,
        conflict,
      })
    })

    const voltageConflict = new Set<string>()
    graph.nodes.forEach((node) => {
      SIDES.forEach((side) => {
        const portId = `${node.id}:${side}`
        if (potentials.conflicts.has(uf.find(portId))) voltageConflict.add(portId)
      })
    })

    const sectionMap = new Map<string, SectionState>()
    nodes
      .filter((node) => node.type === 'bus')
      .forEach((bus) => {
        const root = uf.find(`${bus.id}:bottom`)
        let section = sectionMap.get(root)
        if (!section) {
          section = {
            id: root,
            busIds: [],
            sourceIds: [],
            loadIds: [],
            voltage: potentials.voltages.get(root) ?? 0,
            energized: potentials.voltages.has(root),
            loadKw: 0,
            loadCount: 0,
            currentA: 0,
          }
          sectionMap.set(root, section)
        }
        section.busIds.push(bus.id)
      })

    nodes
      .filter((node) => node.type === 'powerSource' && node.data.inService !== false)
      .forEach((source) => {
        const section = sectionMap.get(uf.find(`${source.id}:bottom`))
        if (section && !section.sourceIds.includes(source.id)) section.sourceIds.push(source.id)
      })

    nodes
      .filter((node) => node.type === 'load')
      .forEach((load) => {
        const section = sectionMap.get(uf.find(`${load.id}:top`))
        if (!section) return
        const kw = power.loadKw.get(load.id) ?? 0
        section.loadIds.push(load.id)
        section.loadKw += kw
        if (kw > 0) section.loadCount += 1
      })

    let totalKw = 0
    const sourceOutput = new Map<string, number>()
    sectionMap.forEach((section) => {
      totalKw += section.loadKw
      section.currentA = powerToCurrent(section.loadKw, section.voltage)
      const share = section.sourceIds.length > 0 ? section.loadKw / section.sourceIds.length : 0
      section.sourceIds.forEach((sourceId) => sourceOutput.set(sourceId, share))
    })

    const ties = new Map<string, TieState>()
    nodes
      .filter((node) => node.isTie())
      .forEach((tie) => {
        // 假设该母联断开时的两侧电位与电源，用于判定分段/并列/备用
        const openUf = buildElectricalUnion(nodes, edges, tie.id)
        const openPotentials = computePotentials(openUf, nodes)
        const leftRoot = openUf.find(`${tie.id}:left`)
        const rightRoot = openUf.find(`${tie.id}:right`)
        const leftVoltage = openPotentials.voltages.get(leftRoot) ?? 0
        const rightVoltage = openPotentials.voltages.get(rightRoot) ?? 0
        const leftSources = Array.from(openPotentials.sourceIds.get(leftRoot) ?? [])
        const rightSources = Array.from(openPotentials.sourceIds.get(rightRoot) ?? [])
        const bothSourced = leftSources.length > 0 && rightSources.length > 0
        const closed = tie.isClosed()

        let mode: TieMode
        if (closed) {
          mode = bothSourced
            ? Math.abs(leftVoltage - rightVoltage) > 0.01
              ? 'unsafeParallel'
              : 'parallel'
            : 'standby'
        } else {
          mode = bothSourced ? 'sectioned' : 'standby'
        }

        ties.set(tie.id, {
          id: tie.id,
          closed,
          mode,
          leftVoltage,
          rightVoltage,
          leftSources,
          rightSources,
        })
      })

    return {
      nodePowered,
      nodeState,
      portStatus,
      portVoltages,
      edgeStates,
      distance,
      voltageConflict,
      loopEdges,
      sections: Array.from(sectionMap.values()),
      ties,
      loadKw: power.loadKw,
      sourceOutput,
      totalKw,
    }
  }
}