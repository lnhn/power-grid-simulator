import { EdgeModel } from '../models/EdgeModel'
import { NodeModel } from '../models/NodeModel'

/** 设计态静态检查：只看拓扑与参数，不看带电状态 */
export type LintSeverity = 'danger' | 'warning' | 'info'

export type TopologyIssue = {
  code: string
  severity: LintSeverity
  message: string
  nodeIds: string[]
  edgeIds: string[]
}

const parsePort = (portId: string) => {
  const index = portId.lastIndexOf(':')
  return { nodeId: portId.slice(0, index), side: portId.slice(index + 1) }
}

/**
 * 拓扑 lint 的边界：只回答"这张图结构上是否成立"，不回答"是否带电、负荷多大"。
 * 带电与功率由求解器负责，两者不能互相替代。
 */
export function lintTopology(nodes: NodeModel[], edges: EdgeModel[]): TopologyIssue[] {
  const issues: TopologyIssue[] = []
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))

  // 每个端子上挂了几条线
  const portCounts = new Map<string, number>()
  const nodeEdgeCount = new Map<string, number>()
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1)

  edges.forEach((edge) => {
    const from = parsePort(edge.sourcePortId)
    const to = parsePort(edge.targetPortId)

    if (!nodeMap.has(from.nodeId) || !nodeMap.has(to.nodeId)) {
      issues.push({
        code: 'EDGE_UNKNOWN_NODE',
        severity: 'danger',
        message: '连线 ' + edge.id + ' 指向不存在的元件，保存后将成为悬空线',
        nodeIds: [from.nodeId, to.nodeId].filter((id) => !nodeMap.has(id)),
        edgeIds: [edge.id],
      })
      return
    }

    if (edge.sourcePortId === edge.targetPortId) {
      issues.push({
        code: 'SELF_LOOP',
        severity: 'warning',
        message: '连线 ' + edge.id + ' 两端接在同一端子上',
        nodeIds: [from.nodeId],
        edgeIds: [edge.id],
      })
    }

    bump(portCounts, edge.sourcePortId)
    bump(portCounts, edge.targetPortId)
    bump(nodeEdgeCount, from.nodeId)
    bump(nodeEdgeCount, to.nodeId)
  })

  // 母联必须左右各接一段，单侧接线等于没装
  nodes.forEach((node) => {
    if (!node.isTie()) return
    const left = portCounts.get(node.id + ':left') ?? 0
    const right = portCounts.get(node.id + ':right') ?? 0
    if (left === 0 || right === 0) {
      issues.push({
        code: 'TIE_SINGLE_SIDE',
        severity: 'danger',
        message: '母联 ' + (node.data.label ?? node.id) + ' 只接了' + (left === 0 ? '右侧' : '左侧') + '，合上也不会连通另一段',
        nodeIds: [node.id],
        edgeIds: [],
      })
    }
  })

  nodes.forEach((node) => {
    const count = nodeEdgeCount.get(node.id) ?? 0
    if (count > 0) return
    if (node.type === 'powerSource') {
      issues.push({
        code: 'SOURCE_NO_OUTLET',
        severity: 'danger',
        message: '电源 ' + (node.data.label ?? node.id) + ' 没有任何出线，这段电送不出去',
        nodeIds: [node.id],
        edgeIds: [],
      })
    } else if (node.type === 'bus') {
      issues.push({
        code: 'BUS_NO_FEED',
        severity: 'warning',
        message: '母线 ' + (node.data.label ?? node.id) + ' 没有接线',
        nodeIds: [node.id],
        edgeIds: [],
      })
    } else {
      issues.push({
        code: 'ISOLATED_NODE',
        severity: 'warning',
        message: '元件 ' + (node.data.label ?? node.id) + ' 孤立在画布上，没有连线',
        nodeIds: [node.id],
        edgeIds: [],
      })
    }
  })

  // 端子复用：除了母联与母线，一个端子挂多条线通常意味着画错了
  portCounts.forEach((count, portId) => {
    if (count <= 1) return
    const { nodeId, side } = parsePort(portId)
    const node = nodeMap.get(nodeId)
    if (!node || node.isTie() || node.type === 'bus') return
    issues.push({
      code: 'TERMINAL_MULTI_EDGE',
      severity: 'warning',
      message: '元件 ' + (node.data.label ?? nodeId) + ' 的 ' + side + ' 端子接了 ' + count + ' 条线，应确认是否画重了',
      nodeIds: [nodeId],
      edgeIds: [],
    })
  })

  return issues
}

/** 校验结果能否保存：只有 danger 级才拦，warning 只提示 */
export const hasBlockingIssue = (issues: TopologyIssue[]): boolean =>
  issues.some((issue) => issue.severity === 'danger')

export const summarizeLint = (issues: TopologyIssue[]): string => {
  if (issues.length === 0) return '拓扑结构完整'
  const danger = issues.filter((issue) => issue.severity === 'danger').length
  const warning = issues.length - danger
  if (danger > 0) return danger + ' 项必须修复' + (warning > 0 ? '，' + warning + ' 项提示' : '')
  return warning + ' 项提示'
}

