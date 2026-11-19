import { EdgeModel } from '../models/EdgeModel'
import { NodeModel } from '../models/NodeModel'
import { Side } from '../models/PortModel'
import { GridGraph } from './GridGraph'
import { buildElectricalUnion, computePotentials } from './potential'

export type FlowDirection = 'forward' | 'reverse' | 'none'

export type EdgeState = {
  id: string
  active: boolean
  flow: FlowDirection
  voltage: number
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
  voltage: number
  energized: boolean
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

    // BFS：仅用于判断"从电源出发的供电层级"（流向）与环网交叉边，不参与带电判定
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

    graph.nodes.forEach((node) => {
      const status: Record<Side, boolean> = {
        top: portEnergized(`${node.id}:top`),
        bottom: portEnergized(`${node.id}:bottom`),
        left: portEnergized(`${node.id}:left`),
        right: portEnergized(`${node.id}:right`),
      }
      portStatus.set(node.id, status)
      nodePowered.set(node.id, node.computePowered(status))
      nodeState.set(node.id, node.computeNodeState(status))
    })

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

      edgeStates.set(edge.id, {
        id: edge.id,
        active,
        flow,
        voltage,
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
            voltage: potentials.voltages.get(root) ?? 0,
            energized: potentials.voltages.has(root),
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
      edgeStates,
      distance,
      voltageConflict,
      loopEdges,
      sections: Array.from(sectionMap.values()),
      ties,
    }
  }
}