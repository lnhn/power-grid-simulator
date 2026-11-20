import { autoLayout } from './layout'

export type GridTemplateId = 'blank' | 'single-bus' | 'sectional-tie' | 'transformer-infeed'

export type GridTemplate = {
  id: GridTemplateId
  name: string
  description: string
  nodeCount: number
}

export const TEMPLATE_LIST: GridTemplate[] = [
  { id: 'blank', name: '空白画布', description: '从零开始画', nodeCount: 0 },
  { id: 'single-bus', name: '单母单线', description: '一路进线、一条母线、三台负荷', nodeCount: 6 },
  { id: 'sectional-tie', name: '单母分段 + 母联', description: '两路进线、两段母线、母联常开', nodeCount: 8 },
  { id: 'transformer-infeed', name: '变压器进线', description: '950V 经变压器降到 380V 供一段母线', nodeCount: 6 },
]

type FlowNode = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }
type FlowEdge = { id: string; source: string; target: string; sourceHandle: string; targetHandle: string }

const node = (id: string, type: string, data: Record<string, unknown>): FlowNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
})

const edge = (id: string, source: string, target: string, sourceHandle = 'bottom', targetHandle = 'top'): FlowEdge => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
})

const place = (nodes: FlowNode[]): FlowNode[] => {
  const layout = autoLayout(nodes)
  return nodes.map((item) => {
    const position = layout.get(item.id)
    return position ? { ...item, position } : item
  })
}

/** 所有模板都跑一次一键整理，保证新建出来的图不是一坨叠在一起 */
export function buildTemplate(id: GridTemplateId): { nodes: FlowNode[]; edges: FlowEdge[] } {
  if (id === 'single-bus') {
    const nodes = place([
      node('ps1', 'powerSource', { label: '1# 进线', voltage: 380 }),
      node('bus1', 'bus', { label: '车间母线' }),
      node('load1', 'load', { label: '1# 泵', status: 'running', power: 75 }),
      node('load2', 'load', { label: '2# 风机', status: 'running', power: 45 }),
      node('load3', 'load', { label: '3# 压缩机', status: 'stopped', power: 110 }),
    ])
    return {
      nodes,
      edges: [
        edge('e1', 'ps1', 'bus1'),
        edge('e2', 'bus1', 'load1'),
        edge('e3', 'bus1', 'load2'),
        edge('e4', 'bus1', 'load3'),
      ],
    }
  }

  if (id === 'sectional-tie') {
    const nodes = place([
      node('ps1', 'powerSource', { label: '1# 进线', voltage: 380 }),
      node('ps2', 'powerSource', { label: '2# 进线', voltage: 380 }),
      node('busA', 'bus', { label: 'A 段母线' }),
      node('busB', 'bus', { label: 'B 段母线' }),
      node('tie', 'switch', { label: '母联', subType: 'tie', status: 'off' }),
      node('loadA', 'load', { label: 'A 段负荷', status: 'running', power: 80 }),
      node('loadB', 'load', { label: 'B 段负荷', status: 'running', power: 60 }),
    ])
    return {
      nodes,
      edges: [
        edge('e1', 'ps1', 'busA'),
        edge('e2', 'ps2', 'busB'),
        edge('e3', 'busA', 'tie', 'right', 'left-target'),
        edge('e4', 'tie', 'busB', 'right-source', 'top'),
        edge('e5', 'busA', 'loadA'),
        edge('e6', 'busB', 'loadB'),
      ],
    }
  }

  if (id === 'transformer-infeed') {
    const nodes = place([
      node('ps1', 'powerSource', { label: '950V 进线', voltage: 950 }),
      node('tr1', 'transformer', { label: '1# 变压器', ratio: 0.4 }),
      node('bus1', 'bus', { label: '380V 母线' }),
      node('load1', 'load', { label: '1# 泵', status: 'running', power: 75 }),
      node('load2', 'load', { label: '2# 风机', status: 'running', power: 45 }),
    ])
    return {
      nodes,
      edges: [
        edge('e1', 'ps1', 'tr1'),
        edge('e2', 'tr1', 'bus1'),
        edge('e3', 'bus1', 'load1'),
        edge('e4', 'bus1', 'load2'),
      ],
    }
  }

  return { nodes: [], edges: [] }
}