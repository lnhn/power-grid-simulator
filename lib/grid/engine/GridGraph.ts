import { EdgeModel } from '../models/EdgeModel'
import { NodeModel } from '../models/NodeModel'
import { Side } from '../models/PortModel'

export class GridGraph {
  nodes: Map<string, NodeModel>
  edges: Map<string, EdgeModel>
  adjacency: Map<string, Set<string>>
  /** adjacency 邻接对 -> 产生该连接的边 id（节点内部互联为 undefined） */
  adjacencyEdge: Map<string, Map<string, string | undefined>>

  constructor(nodes: NodeModel[], edges: EdgeModel[]) {
    this.nodes = new Map(nodes.map((node) => [node.id, node]))
    this.edges = new Map(edges.map((edge) => [edge.id, edge]))
    this.adjacency = new Map()
    this.adjacencyEdge = new Map()
    this.build(edges)
  }

  private addAdj(from: string, to: string, edgeId?: string) {
    if (!this.adjacency.has(from)) this.adjacency.set(from, new Set())
    this.adjacency.get(from)?.add(to)
    if (!this.adjacencyEdge.has(from)) this.adjacencyEdge.set(from, new Map())
    this.adjacencyEdge.get(from)?.set(to, edgeId)
  }

  private addBidirectional(a: string, b: string, edgeId?: string) {
    this.addAdj(a, b, edgeId)
    this.addAdj(b, a, edgeId)
  }

  private build(edges: EdgeModel[]) {
    edges.forEach((edge) => this.addBidirectional(edge.sourcePortId, edge.targetPortId, edge.id))

    this.nodes.forEach((node) => {
      if (node.type === 'bus') {
        const ports = ['top', 'bottom', 'left', 'right'] as const
        ports.forEach((from) => {
          ports.forEach((to) => {
            if (from === to) return
            this.addBidirectional(`${node.id}:${from}`, `${node.id}:${to}`)
          })
        })
        return
      }

      if (node.type === 'switch') {
        if (node.data.status !== 'on') return
        if (node.data.subType === 'tie') {
          this.addBidirectional(`${node.id}:left`, `${node.id}:right`)
          return
        }
        this.addBidirectional(`${node.id}:top`, `${node.id}:bottom`)
        return
      }

      if (node.type === 'transformer') {
        this.addAdj(`${node.id}:top`, `${node.id}:bottom`)
      }
    })
  }

  getPortIds(nodeId: string) {
    const sides: Side[] = ['top', 'bottom', 'left', 'right']
    return sides.map((side) => `${nodeId}:${side}`)
  }
}
