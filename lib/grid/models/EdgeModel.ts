export class EdgeModel {
  id: string
  sourcePortId: string
  targetPortId: string
  voltage?: number

  constructor(id: string, sourcePortId: string, targetPortId: string, voltage?: number) {
    this.id = id
    this.sourcePortId = sourcePortId
    this.targetPortId = targetPortId
    this.voltage = voltage
  }
}
