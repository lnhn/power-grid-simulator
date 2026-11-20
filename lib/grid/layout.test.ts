import { describe, expect, it } from 'vitest'
import { autoLayout } from './layout'
import { buildTemplate } from './templates'

const layoutOf = (nodes: unknown, edges: unknown) =>
  autoLayout(nodes as never, edges as never)

describe('一键整理', () => {
  it('按电气层级排：电源在上、母线居中、负荷在下', () => {
    const { nodes, edges } = buildTemplate('sectional-tie')
    const map = layoutOf(nodes, edges)
    expect(map.get('ps1')!.y).toBeLessThan(map.get('busA')!.y)
    expect(map.get('busA')!.y).toBeLessThan(map.get('loadA')!.y)
    expect(map.get('busB')!.y).toBe(map.get('busA')!.y)
  })

  it('母联与母线同排，且横向落在两段母线之间', () => {
    const { nodes, edges } = buildTemplate('sectional-tie')
    const map = layoutOf(nodes, edges)
    const tie = map.get('tie')!
    const busA = map.get('busA')!
    const busB = map.get('busB')!
    expect(Math.abs(tie.y - busA.y)).toBeLessThanOrEqual(4)
    const left = Math.min(busA.x, busB.x)
    const right = Math.max(busA.x, busB.x)
    expect(tie.x).toBeGreaterThan(left)
    expect(tie.x).toBeLessThan(right)
  })

  it('同一排的卡片不重叠（间距不小于卡片宽度 240）', () => {
    const { nodes, edges } = buildTemplate('sectional-tie')
    const map = layoutOf(nodes, edges)
    const rows = new Map<number, number[]>()
    nodes.forEach((node) => {
      const position = map.get(node.id)!
      const list = rows.get(position.y) ?? []
      list.push(position.x)
      rows.set(position.y, list)
    })
    rows.forEach((xs) => {
      const sorted = xs.slice().sort((a, b) => a - b)
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(240)
      }
    })
  })

  it('单链（电源→变压器→母线）保持一条竖线', () => {
    const { nodes, edges } = buildTemplate('transformer-infeed')
    const map = layoutOf(nodes, edges)
    expect(map.get('ps1')!.x).toBe(map.get('tr1')!.x)
    expect(map.get('tr1')!.x).toBe(map.get('bus1')!.x)
  })
})