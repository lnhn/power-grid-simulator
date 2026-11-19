import { NODE_RULES } from '../rules'
import { PortModel, Side } from './PortModel'

export type NodeType = 'powerSource' | 'switch' | 'load' | 'bus' | 'transformer'

export type SwitchSubType = 'breaker' | 'tie'
export type PowerSourceKind = 'grid' | 'generator' | 'ups'

/**
 * 设计态参数：只描述"这台设备是什么、额定多少、开关在什么位置"。
 * 运行态（带电、电位、电流）一律不进这里，由求解结果单独承载。
 */
export type NodeModelData = {
  label?: string
  /** 开关：breaker | tie；负载：泵/风机等 */
  subType?: string
  ratedVoltage?: number

  /** 电源 */
  kind?: PowerSourceKind
  inService?: boolean

  /** 开关与母联 */
  closed?: boolean
  ratedCurrent?: number

  /** 负载 */
  running?: boolean
  ratedPower?: number
  powerFactor?: number

  /** 变压器 */
  ratio?: number
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

  /** 母联：两段母线之间的联络开关，只有左右两个端子 */
  isTie(): boolean {
    return this.type === 'switch' && this.data.subType === 'tie'
  }

  /** 开关位置（设计参数，不是"带电"） */
  isClosed(): boolean {
    return this.data.closed === true
  }

  /** 设备运行状态（负载启停） */
  isRunning(): boolean {
    return this.data.running === true
  }

  getRatedVoltage(): number {
    return this.data.ratedVoltage ?? 380
  }

  getInputSides(): Side[] {
    if (this.isTie()) return ['left', 'right']
    return NODE_RULES[this.type].inputSides
  }

  getOutputSides(): Side[] {
    if (this.isTie()) return ['left', 'right']
    return NODE_RULES[this.type].outputSides
  }

  computePowered(status: Record<Side, boolean>): boolean {
    return NODE_RULES[this.type].computePowered(status)
  }

  computeNodeState(status: Record<Side, boolean>): boolean {
    return NODE_RULES[this.type].computeNodeState(status, this.data)
  }

  isInputSideAllowed(side: Side): boolean {
    return this.getInputSides().includes(side)
  }

  isOutputSideAllowed(side: Side): boolean {
    return this.getOutputSides().includes(side)
  }

  getMultiplicitySide(inferredSide: Side): Side | null {
    if (this.isTie()) return null
    return NODE_RULES[this.type].multiplicitySide(inferredSide)
  }
}