import { NODE_RULES } from '../rules'
import { PortModel, Side } from './PortModel'

export type NodeType = 'powerSource' | 'switch' | 'load' | 'bus' | 'transformer'

export type NodeStatus = 'on' | 'off' | 'running' | 'stopped' | undefined

export type NodeModelData = {
  status?: NodeStatus
  subType?: string
  voltage?: number
  ratio?: number
  capacity?: number
  ratedCurrent?: number
}

export class NodeModel {
  id: string
  type: NodeType
  data: NodeModelData
  position?: { x: number; y: number }
  ports: Map<Side, PortModel>

  constructor(id: string, type: NodeType, data: NodeModelData = {}, position?: { x: number; y: number }) {
    this.id = id
    this.type = type
    this.data = data
    this.position = position
    this.ports = new Map<Side, PortModel>()
    this.ensurePorts()
  }

  ensurePorts() {
    const sides: Side[] = ['top', 'bottom', 'left', 'right']
    sides.forEach((side) => {
      if (!this.ports.has(side)) {
        this.ports.set(side, new PortModel(this.id, side))
      }
    })
  }

  getPort(side: Side) {
    return this.ports.get(side)
  }

  getInputSides(): Side[] {
    if (this.type === 'switch' && this.data.subType === 'tie') return ['left', 'right']
    return NODE_RULES[this.type].inputSides
  }

  getOutputSides(): Side[] {
    if (this.type === 'switch' && this.data.subType === 'tie') return ['left', 'right']
    return NODE_RULES[this.type].outputSides
  }

  computePowered(status: Record<Side, boolean>): boolean {
    return NODE_RULES[this.type].computePowered(status)
  }

  computeNodeState(status: Record<Side, boolean>): boolean {
    if (this.type === 'switch' && this.data.subType === 'tie') {
      return this.data.status === 'on'
    }
    return NODE_RULES[this.type].computeNodeState(status, this.data)
  }

  isInputSideAllowed(side: Side): boolean {
    return this.getInputSides().includes(side)
  }

  isOutputSideAllowed(side: Side): boolean {
    return this.getOutputSides().includes(side)
  }

  getMultiplicitySide(inferredSide: Side): Side | null {
    if (this.type === 'switch' && this.data.subType === 'tie') return inferredSide
    return NODE_RULES[this.type].multiplicitySide(inferredSide)
  }
}
