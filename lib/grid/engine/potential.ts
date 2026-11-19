import { EdgeModel } from '../models/EdgeModel'
import { NodeModel } from '../models/NodeModel'
import { Side } from '../models/PortModel'
import { UnionFind } from './UnionFind'

const SIDES: Side[] = ['top', 'bottom', 'left', 'right']

export type PotentialState = {
  /** 电气节点（并查集根） -> 电位 */
  voltages: Map<string, number>
  /** 电气节点 -> 供电电源 id 集合 */
  sourceIds: Map<string, Set<string>>
  /** 电气节点内部出现两种不同电位（多电源并列或变压器变比不匹配） */
  conflicts: Set<string>
}

/**
 * 构建"等电位"关系：母线四端口短接、闭合开关两端短接、每条边两端短接。
 * 变压器不参与合并：一次侧与二次侧属于不同电气节点，电位由变比传递。
 * excludeTieId 用于"假设这个母联断开"的分析。
 */
export const buildElectricalUnion = (nodes: NodeModel[], edges: EdgeModel[], excludeTieId?: string) => {
  const uf = new UnionFind()

  nodes.forEach((node) => {
    SIDES.forEach((side) => uf.find(`${node.id}:${side}`))
  })

  edges.forEach((edge) => uf.union(edge.sourcePortId, edge.targetPortId))

  nodes.forEach((node) => {
    if (node.type === 'bus') {
      SIDES.forEach((from) => {
        SIDES.forEach((to) => {
          if (from !== to) uf.union(`${node.id}:${from}`, `${node.id}:${to}`)
        })
      })
      return
    }

    if (node.type === 'switch' && node.data.closed === true) {
      if (node.id === excludeTieId) return
      if (node.isTie()) {
        uf.union(`${node.id}:left`, `${node.id}:right`)
      } else {
        uf.union(`${node.id}:top`, `${node.id}:bottom`)
      }
    }
  })

  return uf
}

/**
 * 电位传播：电源注入 -> 变压器按变比逐级传递。
 * 同一电气节点出现不同电位时记录 conflict，而不是简单取第一个。
 */
export const computePotentials = (uf: UnionFind, nodes: NodeModel[]): PotentialState => {
  const voltages = new Map<string, number>()
  const sourceIds = new Map<string, Set<string>>()
  const conflicts = new Set<string>()

  nodes.forEach((node) => {
    if (node.type !== 'powerSource' || node.data.inService === false) return
    const root = uf.find(`${node.id}:bottom`)
    const voltage = node.data.ratedVoltage ?? 380
    const existing = voltages.get(root)
    if (existing === undefined) {
      voltages.set(root, voltage)
    } else if (Math.abs(existing - voltage) > 0.01) {
      conflicts.add(root)
    }
    const set = sourceIds.get(root) ?? new Set<string>()
    set.add(node.id)
    sourceIds.set(root, set)
  })

  const transformers = nodes.filter((node) => node.type === 'transformer')
  const maxRounds = Math.max(1, transformers.length * 2 + 1)

  for (let round = 0; round < maxRounds; round += 1) {
    let changed = false
    transformers.forEach((tx) => {
      const from = uf.find(`${tx.id}:top`)
      const to = uf.find(`${tx.id}:bottom`)
      if (from === to) return
      const upstream = voltages.get(from)
      if (upstream === undefined) return

      const target = upstream * (tx.data.ratio ?? 1)
      const existing = voltages.get(to)
      if (existing === undefined) {
        voltages.set(to, target)
        changed = true
      } else if (Math.abs(existing - target) > 0.01) {
        conflicts.add(to)
      }

      const upstreamSources = sourceIds.get(from)
      if (upstreamSources) {
        const set = sourceIds.get(to) ?? new Set<string>()
        upstreamSources.forEach((id) => set.add(id))
        sourceIds.set(to, set)
      }
    })
    if (!changed) break
  }

  return { voltages, sourceIds, conflicts }
}