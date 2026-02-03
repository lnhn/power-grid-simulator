import { NodeModelData, NodeType } from './models/NodeModel'
import { Side } from './models/PortModel'

export type NodeRule = {
  inputSides: Side[]
  outputSides: Side[]
  multiplicitySide: (inferredSide: Side) => Side | null
  computePowered: (status: Record<Side, boolean>) => boolean
  computeNodeState: (status: Record<Side, boolean>, data: NodeModelData) => boolean
}

export const NODE_RULES: Record<NodeType, NodeRule> = {
  powerSource: {
    inputSides: [],
    outputSides: ['bottom'],
    multiplicitySide: () => null,
    computePowered: () => true,
    computeNodeState: () => true,
  },
  load: {
    inputSides: ['top'],
    outputSides: [],
    multiplicitySide: () => 'top',
    computePowered: (status) => status.top,
    computeNodeState: (_status, data) => data.status === 'running',
  },
  transformer: {
    inputSides: ['top'],
    outputSides: ['bottom'],
    multiplicitySide: () => 'top',
    computePowered: (status) => status.top,
    computeNodeState: (status) => status.top,
  },
  bus: {
    inputSides: ['top', 'bottom', 'left', 'right'],
    outputSides: ['top', 'bottom', 'left', 'right'],
    multiplicitySide: (side) => side,
    computePowered: (status) => status.top || status.bottom || status.left || status.right,
    computeNodeState: (status) => status.top || status.bottom || status.left || status.right,
  },
  switch: {
    inputSides: ['top'],
    outputSides: ['bottom'],
    multiplicitySide: () => 'top',
    computePowered: (status) => status.top || status.bottom || status.left || status.right,
    computeNodeState: (_status, data) => data.status === 'on',
  },
}
