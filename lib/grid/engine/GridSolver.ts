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
}

export type GridSolveResult = {
  nodePowered: Map<string, boolean>
  nodeState: Map<string, boolean>
  portStatus: Map<string, Record<Side, boolean>>
  edgeStates: Map<string, EdgeState>
  distance: Map<string, number>
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

    nodes
      .filter((node) => node.type === 'powerSource')
      .forEach((node) => {
        const portId = `${node.id}:bottom`
        if (distance.has(portId)) return
        distance.set(portId, 0)
        queue.push(portId)
      })

    while (queue.length) {
      const current = queue.shift() as string
      const base = distance.get(current) ?? 0
      const neighbors = graph.adjacency.get(current)
      if (!neighbors) continue
      neighbors.forEach((neighbor) => {
        if (distance.has(neighbor)) return
        distance.set(neighbor, base + 1)
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
      let flow: FlowDirection = 'none'

      if (active) {
        if (sourcePowered && !targetPowered) {
          flow = 'forward'
        } else if (targetPowered && !sourcePowered) {
          flow = 'reverse'
        } else if (sourceDist !== undefined && targetDist !== undefined) {
          if (sourceDist < targetDist) flow = 'forward'
          else if (targetDist < sourceDist) flow = 'reverse'
          else flow = edge.sourcePortId < edge.targetPortId ? 'forward' : 'reverse'
        } else if (sourceDist !== undefined) {
          flow = 'forward'
        } else if (targetDist !== undefined) {
          flow = 'reverse'
        } else {
          flow = edge.sourcePortId < edge.targetPortId ? 'forward' : 'reverse'
        }
      }

      let voltage = edge.voltage
      if (voltage === undefined) {
        const [sourceNodeId, sourceSide] = edge.sourcePortId.split(':')
        const [targetNodeId, targetSide] = edge.targetPortId.split(':')
        const sourceNode = graph.nodes.get(sourceNodeId)
        const targetNode = graph.nodes.get(targetNodeId)
        const sourceVoltage = sourceNode?.data.voltage
        const targetVoltage = targetNode?.data.voltage
        if (sourceNode?.type === 'transformer' && sourceSide === 'bottom') {
          const ratio = (sourceNode.data as { ratio?: number }).ratio ?? 1
          voltage = (sourceVoltage ?? 380) * ratio
        } else if (targetNode?.type === 'transformer' && targetSide === 'bottom') {
          const ratio = (targetNode.data as { ratio?: number }).ratio ?? 1
          voltage = (targetVoltage ?? 380) * ratio
        } else if (sourceNode?.type === 'transformer' && sourceSide === 'top') {
          voltage = sourceVoltage ?? 380
        } else if (targetNode?.type === 'transformer' && targetSide === 'top') {
          voltage = targetVoltage ?? 380
        } else if (sourceNode?.type === 'powerSource') {
          voltage = sourceVoltage ?? 380
        } else if (targetNode?.type === 'powerSource') {
          voltage = targetVoltage ?? 380
        }
      }

      edgeStates.set(edge.id, {
        id: edge.id,
        active,
        flow,
        voltage: voltage ?? 380,
      })
    })

    return { nodePowered, nodeState, portStatus, edgeStates, distance }
  }
}
