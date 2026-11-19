import { EdgeModel } from '../models/EdgeModel'
import { NodeModel } from '../models/NodeModel'
import { Side } from '../models/PortModel'
import { GridGraph } from './GridGraph'

export type FlowDirection = 'forward' | 'reverse' | 'none'

export type EdgeState = {
  id: string
  active: boolean
  flow: FlowDirection
  voltage: number
  /** 环网交叉边（不属于 BFS 生成树） */
  loop: boolean
  /** 两端来自不同电源且源电压不一致 */
  conflict: boolean
}

export type GridSolveResult = {
  nodePowered: Map<string, boolean>
  nodeState: Map<string, boolean>
  portStatus: Map<string, Record<Side, boolean>>
  edgeStates: Map<string, EdgeState>
  distance: Map<string, number>
  /** 多源电压冲突的端口 id */
  voltageConflict: Set<string>
  /** 环网交叉边 id */
  loopEdges: Set<string>
}

export const voltageToColor = (voltage: number) => {
  if (voltage >= 1000) return '#ef4444'
  if (voltage >= 500) return '#f97316'
  if (voltage >= 220) return '#eab308'
  if (voltage >= 110) return '#22c55e'
  return '#3b82f6'
}

export class GridSolver {
  static solve(nodes: NodeModel[], edges: EdgeModel[]): GridSolveResult {
    const graph = new GridGraph(nodes, edges)
    const distance = new Map<string, number>()
    const queue: string[] = []
    /** 端口 -> 供电来源电源 id */
    const sourceOf = new Map<string, string>()
    /** 端口 -> 来源电源电压 */
    const sourceVoltageOf = new Map<string, number>()
    /** 端口 -> BFS 生成树边 id（源端口为 undefined） */
    const treeEdge = new Map<string, string | undefined>()
    const voltageConflict = new Set<string>()
    const loopEdges = new Set<string>()

    const nodeOfPort = (portId: string) => graph.nodes.get(portId.split(':')[0])

    nodes
      .filter((node) => node.type === 'powerSource')
      .forEach((node) => {
        const portId = `${node.id}:bottom`
        if (distance.has(portId)) return
        distance.set(portId, 0)
        sourceOf.set(portId, node.id)
        sourceVoltageOf.set(portId, node.data.ratedVoltage ?? 380)
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
          // 已访问：若该邻接不是任一端的生成树边，则为环网交叉边
          if (edgeId !== undefined && treeEdge.get(neighbor) !== edgeId && treeEdge.get(current) !== edgeId) {
            loopEdges.add(edgeId)
          }
          // 多源电压冲突：不同电源且源电压不同（变压器属合法变压，排除）
          const srcA = sourceOf.get(current)
          const srcB = sourceOf.get(neighbor)
          if (srcA && srcB && srcA !== srcB) {
            if (nodeOfPort(current)?.type !== 'transformer' && nodeOfPort(neighbor)?.type !== 'transformer') {
              if (sourceVoltageOf.get(current) !== sourceVoltageOf.get(neighbor)) {
                voltageConflict.add(current)
                voltageConflict.add(neighbor)
              }
            }
          }
          return
        }

        distance.set(neighbor, base + 1)
        sourceOf.set(neighbor, sourceOf.get(current)!)
        sourceVoltageOf.set(neighbor, sourceVoltageOf.get(current)!)
        treeEdge.set(neighbor, edgeId)
        queue.push(neighbor)
      })
    }

    const poweredHandles = new Set(distance.keys())
    const nodePowered = new Map<string, boolean>()
    const nodeState = new Map<string, boolean>()
    const portStatus = new Map<string, Record<Side, boolean>>()

    graph.nodes.forEach((node) => {
      const status: Record<Side, boolean> = {
        top: poweredHandles.has(`${node.id}:top`),
        bottom: poweredHandles.has(`${node.id}:bottom`),
        left: poweredHandles.has(`${node.id}:left`),
        right: poweredHandles.has(`${node.id}:right`),
      }
      portStatus.set(node.id, status)
      nodePowered.set(node.id, node.computePowered(status))
      nodeState.set(node.id, node.computeNodeState(status))
    })

    const edgeStates = new Map<string, EdgeState>()
    graph.edges.forEach((edge) => {
      const sourcePowered = poweredHandles.has(edge.sourcePortId)
      const targetPowered = poweredHandles.has(edge.targetPortId)
      const active = sourcePowered || targetPowered
      const sourceDist = distance.get(edge.sourcePortId)
      const targetDist = distance.get(edge.targetPortId)
      const loop = loopEdges.has(edge.id)
      let flow: FlowDirection = 'none'

      if (active) {
        if (sourcePowered && !targetPowered) {
          flow = 'forward'
        } else if (targetPowered && !sourcePowered) {
          flow = 'reverse'
        } else if (sourceDist !== undefined && targetDist !== undefined) {
          // 环网交叉边等距时流向无法由单一电源判定
          if (sourceDist < targetDist) flow = 'forward'
          else if (targetDist < sourceDist) flow = 'reverse'
        }
      }

      let voltage = edge.voltage
      if (voltage === undefined) {
        const [sourceNodeId, sourceSide] = edge.sourcePortId.split(':')
        const [targetNodeId, targetSide] = edge.targetPortId.split(':')
        const sourceNode = graph.nodes.get(sourceNodeId)
        const targetNode = graph.nodes.get(targetNodeId)
        const sourceVoltage = sourceNode?.data.ratedVoltage
        const targetVoltage = targetNode?.data.ratedVoltage
        const ratioOf = (node: NodeModel | undefined) => (node?.data as { ratio?: number }).ratio ?? 1

        // 变压器为有向元件：bottom（二次侧）需按变比换算，其余情形电压即端点原值
        if (sourceNode?.type === 'transformer' && sourceSide === 'bottom') {
          voltage = (sourceVoltage ?? 380) * ratioOf(sourceNode)
        } else if (targetNode?.type === 'transformer' && targetSide === 'bottom') {
          voltage = (targetVoltage ?? 380) * ratioOf(targetNode)
        } else {
          voltage = sourceVoltage ?? targetVoltage ?? 380
        }
      }

      edgeStates.set(edge.id, {
        id: edge.id,
        active,
        flow,
        voltage: voltage ?? 380,
        loop,
        conflict: voltageConflict.has(edge.sourcePortId) || voltageConflict.has(edge.targetPortId),
      })
    })

    return { nodePowered, nodeState, portStatus, edgeStates, distance, voltageConflict, loopEdges }
  }
}
