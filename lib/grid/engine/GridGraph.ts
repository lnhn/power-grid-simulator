import { EdgeModel } from '../models/EdgeModel'
import { NodeModel } from '../models/NodeModel'
import { Side } from '../models/PortModel'

export class GridGraph {
  nodes: Map<string, NodeModel>
  edges: Map<string, EdgeModel>
  adjacency: Map<string, Set<string>>

  constructor(nodes: NodeModel[], edges: EdgeModel[]) {
    this.nodes = new Map(nodes.map((node) => [node.id, node]))
    this.edges = new Map(edges.map((edge) => [edge.id, edge]))
    this.adjacency = new Map()
    this.build(edges)
  }

  private addAdj(from: string, to: string) {
    if (!this.adjacency.has(from)) this.adjacency.set(from, new Set())
    this.adjacency.get(from)?.add(to)
  }

  private addBidirectional(a: string, b: string) {
    this.addAdj(a, b)
    this.addAdj(b, a)
  }

  private build(edges: EdgeModel[]) {
    edges.forEach((edge) => this.addBidirectional(edge.sourcePortId, edge.targetPortId))

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
