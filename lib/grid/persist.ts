/** 运行态字段前缀：这些键只在内存里出现，入库前必须剥掉 */
const RUNTIME_KEYS = [
  'powered',
  'nodeState',
  'portStatus',
  'conflict',
  'liveVoltage',
  'sectionVoltage',
  'sectionId',
  'tieMode',
  'flow',
  'loop',
]

function stripData(data: Record<string, unknown> | undefined) {
  if (!data) return {}
  const cleaned: Record<string, unknown> = {}
  Object.keys(data).forEach((key) => {
    if (RUNTIME_KEYS.includes(key)) return
    const value = data[key]
    if (typeof value === 'function') return
    cleaned[key] = value
  })
  return cleaned
}

type FlowNode = { id: string; type?: string; position?: unknown; data?: Record<string, unknown> }
type FlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  markerEnd?: unknown
  data?: Record<string, unknown>
}

/** 仅保留设计态字段：拓扑、坐标、设计参数、开关位置与设备运行状态 */
export function toPersistedNodes(nodes: FlowNode[]) {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: stripData(node.data),
  }))
}

/** 边同样剥掉运行态（电压/流向/环网标记）与渲染态（描边、动画） */
export function toPersistedEdges(edges: FlowEdge[]) {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type,
    markerEnd: edge.markerEnd,
    data: stripData(edge.data),
  }))
}