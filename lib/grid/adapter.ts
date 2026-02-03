import type { Edge, Node } from 'reactflow'
import { EdgeModel } from './models/EdgeModel'
import { NodeModel, NodeType } from './models/NodeModel'
import { Side } from './models/PortModel'

const inferSide = (nodeId: string, edge: Edge, isSource: boolean, nodeMap: Map<string, Node>): Side => {
  const node = nodeMap.get(nodeId)
  const otherId = isSource ? edge.target : edge.source
  const other = nodeMap.get(otherId)

  const handle = isSource ? edge.sourceHandle : edge.targetHandle
  if (node?.type === 'switch' && node?.data?.subType === 'tie') {
    if (other && other.position.x < node.position.x) return 'left'
    if (other) return 'right'
    return 'left'
  }

  if (handle?.includes('left')) return 'left'
  if (handle?.includes('right')) return 'right'
  if (handle?.includes('top')) return 'top'
  if (handle?.includes('bottom')) return 'bottom'

  if (node?.type === 'switch') {
    if (other && other.position.y < node.position.y) return 'top'
    return 'bottom'
  }

  if (node?.type === 'powerSource') return 'bottom'
  if (node?.type === 'load') return 'top'

  if (node?.type === 'bus') {
    if (other) {
      if (other.position.x < node.position.x) return 'left'
      if (other.position.x > node.position.x) return 'right'
      if (other.position.y < node.position.y) return 'top'
    }
    return 'bottom'
  }

  return isSource ? 'bottom' : 'top'
}

export const buildGridModels = (nodes: Node[], edges: Edge[]) => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const nodeModels = nodes.map((node) => {
    const type = (node.type || 'bus') as NodeType
    return new NodeModel(
      node.id,
      type,
      {
        status: node.data?.status,
        subType: node.data?.subType,
        voltage: node.data?.voltage,
        ratio: node.data?.ratio,
        capacity: node.data?.capacity,
        ratedCurrent: node.data?.ratedCurrent,
      },
      node.position
    )
  })
  const edgeModels = edges.map((edge) => {
    const sourceSide = inferSide(edge.source, edge, true, nodeMap)
    const targetSide = inferSide(edge.target, edge, false, nodeMap)
    const sourcePortId = `${edge.source}:${sourceSide}`
    const targetPortId = `${edge.target}:${targetSide}`
    const edgeVoltage = (edge.data as { voltage?: number } | undefined)?.voltage
    const sourceVoltage = (nodeMap.get(edge.source)?.data as { voltage?: number } | undefined)?.voltage
    const targetVoltage = (nodeMap.get(edge.target)?.data as { voltage?: number } | undefined)?.voltage
    const voltage = edgeVoltage ?? sourceVoltage ?? targetVoltage
    return new EdgeModel(edge.id, sourcePortId, targetPortId, voltage)
  })
  return { nodeModels, edgeModels }
}
