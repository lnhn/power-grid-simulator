import { NodeModelData, NodeType } from './models/NodeModel'

type RawNodeData = Record<string, unknown> | undefined

const toNumber = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

const positive = (value: unknown): number | undefined => {
  const n = toNumber(value)
  return n !== undefined && n > 0 ? n : undefined
}

const nonNegative = (value: unknown): number | undefined => {
  const n = toNumber(value)
  return n !== undefined && n >= 0 ? n : undefined
}

const pickBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

/**
 * 把历史字段（voltage / status / power / capacity）归一为新契约。
 * 只读，不修改入参：v2.2 及更早的电网仍按旧字段存储，读取时统一映射，
 * 待 UI 迁移完成后再由保存流程写回新字段。
 */
export const normalizeNodeData = (type: NodeType, raw: RawNodeData): NodeModelData => {
  const data = raw ?? {}
  const base: NodeModelData = {
    label: typeof data.label === 'string' ? data.label : undefined,
    subType: typeof data.subType === 'string' ? data.subType : undefined,
    ratedVoltage: positive(data.ratedVoltage) ?? positive(data.voltage) ?? 380,
  }

  if (type === 'switch') {
    return {
      ...base,
      subType: data.subType === 'tie' ? 'tie' : 'breaker',
      closed: pickBoolean(data.closed) ?? data.status === 'on',
      ratedCurrent: positive(data.ratedCurrent) ?? 630,
    }
  }

  if (type === 'load') {
    return {
      ...base,
      running: pickBoolean(data.running) ?? data.status === 'running',
      ratedPower: nonNegative(data.ratedPower) ?? nonNegative(data.power) ?? 0,
      powerFactor: positive(data.powerFactor) ?? 0.85,
    }
  }

  if (type === 'transformer') {
    return {
      ...base,
      ratio: positive(data.ratio) ?? 1,
      ratedPower: nonNegative(data.ratedPower) ?? nonNegative(data.capacity),
    }
  }

  if (type === 'powerSource') {
    return {
      ...base,
      kind: data.kind === 'generator' || data.kind === 'ups' ? data.kind : 'grid',
      inService: pickBoolean(data.inService) ?? true,
    }
  }

  return base
}

/** 读取连线电压，兼容旧数据 edge.data.voltage */
export const normalizeEdgeVoltage = (raw: unknown): number | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  return positive((raw as Record<string, unknown>).voltage)
}