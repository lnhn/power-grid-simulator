import { EdgeModel } from '../models/EdgeModel'
import { NodeModel } from '../models/NodeModel'
import { GridGraph } from './GridGraph'

/** 三相功率换算电流用的默认功率因数（设计数据没有给定时） */
export const DEFAULT_POWER_FACTOR = 0.85

/** 三相：I = P / (√3 · U · cosφ) */
export const powerToCurrent = (kw: number, voltage: number, powerFactor = DEFAULT_POWER_FACTOR) => {
  if (kw <= 0 || voltage <= 0) return 0
  return (kw * 1000) / (Math.sqrt(3) * voltage * powerFactor)
}

export type PowerResult = {
  /** 每个负荷节点当前的用电功率（kW），未运行或未带电为 0 */
  loadKw: Map<string, number>
  /** 每条边流过的功率（kW），只对生成树边有值 */
  edgeKw: Map<string, number>
  /** 不在生成树上的边（环网并联路径），电流无法按树分配 */
  sharedEdges: Set<string>
}

/**
 * 功率汇总（无阻抗、无电压降）：
 * 1. 负荷取额定功率，未运行或失电记 0；
 * 2. 从所有在运电源端口做 BFS 生成树，把每个负荷的功率沿父边累加回电源；
 * 3. 不在生成树上的边属于环网并联路径，功率无法唯一分配，标记为 shared。
 */
export function computePower(
  nodes: NodeModel[],
  edges: EdgeModel[],
  graph: GridGraph,
  portVoltages: Map<string, number>
): PowerResult {
  const loadKw = new Map<string, number>()

  nodes
    .filter((node) => node.type === 'load')
    .forEach((load) => {
      const energized = (portVoltages.get(`${load.id}:top`) ?? 0) > 0
      const kw = load.isRunning() && energized ? load.data.ratedPower ?? 0 : 0
      loadKw.set(load.id, kw)
    })

  const parent = new Map<string, string>()
  const parentEdge = new Map<string, string>()
  const seen = new Set<string>()
  const queue: string[] = []

  nodes
    .filter((node) => node.type === 'powerSource' && node.data.inService !== false)
    .forEach((source) => {
      const port = `${source.id}:bottom`
      if (seen.has(port)) return
      seen.add(port)
      parent.set(port, '')
      queue.push(port)
    })

  while (queue.length) {
    const current = queue.shift() as string
    graph.adjacency.get(current)?.forEach((neighbor) => {
      if (seen.has(neighbor)) return
      seen.add(neighbor)
      parent.set(neighbor, current)
      const edgeId = graph.adjacencyEdge.get(current)?.get(neighbor)
      if (edgeId) parentEdge.set(neighbor, edgeId)
      queue.push(neighbor)
    })
  }

  const edgeKw = new Map<string, number>()
  const sharedEdges = new Set<string>()

  edges.forEach((edge) => {
    const inTree = parentEdge.get(edge.targetPortId) === edge.id || parentEdge.get(edge.sourcePortId) === edge.id
    const reachable = parent.has(edge.sourcePortId) && parent.has(edge.targetPortId)
    if (!inTree && reachable) sharedEdges.add(edge.id)
  })

  loadKw.forEach((kw, loadId) => {
    if (kw <= 0) return
    let cursor = `${loadId}:top`
    let guard = 0
    while (parent.has(cursor) && parent.get(cursor) && guard < 512) {
      const edgeId = parentEdge.get(cursor)
      if (edgeId) edgeKw.set(edgeId, (edgeKw.get(edgeId) ?? 0) + kw)
      cursor = parent.get(cursor) as string
      guard += 1
    }
  })

  return { loadKw, edgeKw, sharedEdges }
}