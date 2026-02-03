export type Side = 'top' | 'bottom' | 'left' | 'right'

export class PortModel {
  id: string
  nodeId: string
  side: Side
  powered: boolean
  distance?: number

  constructor(nodeId: string, side: Side) {
    this.nodeId = nodeId
    this.side = side
    this.id = `${nodeId}:${side}`
    this.powered = false
  }
}
