import type { Edge, Node } from '@xyflow/react'

/**
 * 画布节点 data 的宽松契约：data 来自持久化 JSON 与运行时叠加，字段是动态且跨页共用的，
 * 因此在类型层只约束「可索引对象」，具体字段由使用方按需判型。
 * （XYFlow 13 要求 data 可赋值给 Record<string, unknown>）
 */
export interface GridNodeData extends Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

/** 画布节点/边类型：供 useNodesState、NodeProps 与构建函数统一使用 */
export type GridNode = Node<GridNodeData>
export type GridEdge = Edge
import { EdgeModel } from './models/EdgeModel'
import { NodeModel, NodeType } from './models/NodeModel'
import { Side } from './models/PortModel'
import { normalizeEdgeVoltage, normalizeNodeData } from './normalize'

export type GridModelIssue = {
  code: 'TIE_DUPLICATE_TERMINAL' | 'TIE_PEER_NOT_BUS'
  nodeId: string
  edgeId?: string
  message: string
}

/** 母联端子：只有左右两个，身份由 handle 名决定，不再依赖画布坐标 */
export const parseTieTerminal = (handle: string | undefined): Side | undefined => {
  if (!handle) return undefined
  if (handle.startsWith('left')) return 'left'
  if (handle.startsWith('right')) return 'right'
  return undefined
}

/** 旧数据迁移：按两端相对位置补出 handle 名 */
export const inferTieHandle = (tieNode: Node | undefined, otherNode: Node | undefined, kind: 'source' | 'target') => {
  if (!tieNode || !otherNode) return undefined
  return otherNode.position.x < tieNode.position.x ? `left-${kind}` : `right-${kind}`
}

/** handle 名与边的 source/target 方向不一致时（连线方向反向）修正为当前方向。 */
export const normalizeTieHandle = (handle: string | undefined, kind: 'source' | 'target') => {
  if (!handle) return handle
  if (kind === 'source' && handle.includes('target')) return handle.replace('target', 'source')
  if (kind === 'target' && handle.includes('source')) return handle.replace('source', 'target')
  return handle
}

/** 根据 handle 名（或几何位置）推断边连接的是节点的哪个端口。 */
export const inferSide = (nodeId: string, edge: Edge, isSource: boolean, nodeMap: Map<string, Node>): Side => {
  const node = nodeMap.get(nodeId)
  const otherId = isSource ? edge.target : edge.source
  const other = nodeMap.get(otherId)
  const handle = isSource ? edge.sourceHandle : edge.targetHandle

  if (node?.type === 'switch' && node?.data?.subType === 'tie') {
    const terminal = parseTieTerminal(handle ?? undefined)
    if (terminal) return terminal
    // 旧数据兜底：由相对位置推断；无法判定时默认 left，并交给拓扑校验报错
    if (other && other.position.x < node.position.x) return 'left'
    if (other && other.position.x > node.position.x) return 'right'
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

/**
 * 把 ReactFlow 画布翻译成端口模型。
 * 母联的两条连线必须落在不同端子、且对端必须是母线；违反规则的连线会被剔除并记录 issue，
 * 而不是静默地把两段母线并在同一个端子上（那会让母联断开也照样导通）。
 */
export const buildGridModels = (nodes: Node[], edges: Edge[]) => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const nodeModels = nodes.map((node) => {
    const type = (node.type || 'bus') as NodeType
    return new NodeModel(node.id, type, normalizeNodeData(type, node.data as Record<string, unknown>), node.position)
  })
  const modelOf = new Map(nodeModels.map((model) => [model.id, model]))

  const issues: GridModelIssue[] = []
  const usedTerminals = new Map<string, Map<Side, string>>()

  const claimTieTerminal = (tie: NodeModel, side: Side, edge: Edge, peer: Node | undefined) => {
    if (peer?.type !== 'bus') {
      issues.push({
        code: 'TIE_PEER_NOT_BUS',
        nodeId: tie.id,
        edgeId: edge.id,
        message: `母联「${tie.data.label ?? tie.id}」只能连接母线，当前接入了${peer?.type ?? '未知元件'}`,
      })
      return false
    }
    const used = usedTerminals.get(tie.id) ?? new Map<Side, string>()
    usedTerminals.set(tie.id, used)
    if (used.has(side)) {
      issues.push({
        code: 'TIE_DUPLICATE_TERMINAL',
        nodeId: tie.id,
        edgeId: edge.id,
        message: `母联「${tie.data.label ?? tie.id}」的${side === 'left' ? '左' : '右'}端子接入了多条线路，该连线已忽略，请从另一端子重连`,
      })
      return false
    }
    used.set(side, edge.id)
    return true
  }

  const edgeModels: EdgeModel[] = []
  edges.forEach((edge) => {
    const sourceModel = modelOf.get(edge.source)
    const targetModel = modelOf.get(edge.target)
    if (!sourceModel || !targetModel) return

    const sourceSide = inferSide(edge.source, edge, true, nodeMap)
    const targetSide = inferSide(edge.target, edge, false, nodeMap)

    if (sourceModel.isTie() && !claimTieTerminal(sourceModel, sourceSide, edge, nodeMap.get(edge.target))) return
    if (targetModel.isTie() && !claimTieTerminal(targetModel, targetSide, edge, nodeMap.get(edge.source))) return

    const sourcePortId = `${edge.source}:${sourceSide}`
    const targetPortId = `${edge.target}:${targetSide}`
    const voltage = normalizeEdgeVoltage(edge.data) ?? sourceModel.data.ratedVoltage ?? targetModel.data.ratedVoltage
    edgeModels.push(new EdgeModel(edge.id, sourcePortId, targetPortId, voltage))
  })

  return { nodeModels, edgeModels, issues }
}