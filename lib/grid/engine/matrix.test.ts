import { describe, expect, it } from 'vitest'
import { buildGridModels, GridSolver } from '..'
import type { GridEdge, GridNode } from '..'

/**
 * 拓扑矩阵：把工厂电网最常见的五种结构固定成回归用例。
 * 这里断言的是"结构 -> 结论"的关系，不追求数值精度（功率是汇总，不是潮流）。
 */
const asNodes = (list: unknown[]) => list as GridNode[]
const asEdges = (list: unknown[]) => list as GridEdge[]

const source = (id: string, x = 0) => ({ id, type: 'powerSource', position: { x, y: 0 }, data: { label: id, voltage: 380 } })
const bus = (id: string, x = 0) => ({ id, type: 'bus', position: { x, y: 200 }, data: { label: id } })
const tie = (id: string, status: 'on' | 'off') => ({ id, type: 'switch', position: { x: 0, y: 200 }, data: { label: id, subType: 'tie', status } })
const load = (id: string, kw: number, status = 'running') => ({ id, type: 'load', position: { x: 0, y: 400 }, data: { label: id, status, power: kw } })

const solve = (nodes: unknown[], edges: unknown[]) => {
  const { nodeModels, edgeModels } = buildGridModels(asNodes(nodes), asEdges(edges))
  return GridSolver.solve(nodeModels, edgeModels)
}

describe('拓扑矩阵', () => {
  it('分段运行：母联断开，两段各自带电', () => {
    const result = solve(
      [source('ps1'), source('ps2', 800), bus('busA'), bus('busB', 800), tie('tie', 'off'), load('loadA', 100)],
      [
        { id: 'e1', source: 'ps1', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
        { id: 'e2', source: 'ps2', target: 'busB', sourceHandle: 'bottom', targetHandle: 'top' },
        { id: 'e3', source: 'busA', target: 'tie', sourceHandle: 'right', targetHandle: 'left-target' },
        { id: 'e4', source: 'tie', target: 'busB', sourceHandle: 'right-source', targetHandle: 'top' },
        { id: 'e5', source: 'busA', target: 'loadA', sourceHandle: 'bottom', targetHandle: 'top' },
      ]
    )
    expect(result.sections).toHaveLength(2)
    expect(result.sections.every((section) => section.energized && section.sourceIds.length === 1)).toBe(true)
    expect(result.ties.get('tie')?.mode).toBe('sectioned')
    expect(result.totalKw).toBe(100)
  })

  it('并列运行：母联合上，两源共用一段', () => {
    const result = solve(
      [source('ps1'), source('ps2', 800), bus('busA'), bus('busB', 800), tie('tie', 'on'), load('loadA', 100)],
      [
        { id: 'e1', source: 'ps1', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
        { id: 'e2', source: 'ps2', target: 'busB', sourceHandle: 'bottom', targetHandle: 'top' },
        { id: 'e3', source: 'busA', target: 'tie', sourceHandle: 'right', targetHandle: 'left-target' },
        { id: 'e4', source: 'tie', target: 'busB', sourceHandle: 'right-source', targetHandle: 'top' },
        { id: 'e5', source: 'busA', target: 'loadA', sourceHandle: 'bottom', targetHandle: 'top' },
      ]
    )
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].sourceIds).toHaveLength(2)
    expect(result.ties.get('tie')?.mode).toBe('parallel')
    expect(result.voltageConflict.size).toBe(0)
  })

  it('变压器降压：二次侧按变比得到 380V', () => {
    const result = solve(
      [
        { id: 'ps', type: 'powerSource', position: { x: 0, y: 0 }, data: { label: '10kV 进线', voltage: 950 } },
        { id: 'tr', type: 'transformer', position: { x: 0, y: 150 }, data: { label: '变压器', ratio: 0.4 } },
        bus('busA'),
        load('loadA', 100),
      ],
      [
        { id: 'e1', source: 'ps', target: 'tr', sourceHandle: 'bottom', targetHandle: 'top' },
        { id: 'e2', source: 'tr', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
        { id: 'e3', source: 'busA', target: 'loadA', sourceHandle: 'bottom', targetHandle: 'top' },
      ]
    )
    expect(result.voltageConflict.size).toBe(0)
    expect(result.sections[0].voltage).toBe(380)
    expect(result.nodePowered.get('loadA')).toBe(true)
  })

  it('电源停运：该段失电且负荷出力为 0', () => {
    const result = solve(
      [{ id: 'ps', type: 'powerSource', position: { x: 0, y: 0 }, data: { label: '进线', voltage: 380, inService: false } }, bus('busA'), load('loadA', 100)],
      [
        { id: 'e1', source: 'ps', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
        { id: 'e2', source: 'busA', target: 'loadA', sourceHandle: 'bottom', targetHandle: 'top' },
      ]
    )
    expect(result.nodePowered.get('busA')).toBe(false)
    expect(result.totalKw).toBe(0)
    expect(result.sections.every((section) => !section.energized)).toBe(true)
  })

  it('两台变压器变比不一致，同段并接时报电位冲突', () => {
    const result = solve(
      [
        { id: 'ps1', type: 'powerSource', position: { x: 0, y: 0 }, data: { label: 's1', voltage: 950 } },
        { id: 'tr1', type: 'transformer', position: { x: 0, y: 150 }, data: { label: 't1', ratio: 0.4 } },
        { id: 'ps2', type: 'powerSource', position: { x: 600, y: 0 }, data: { label: 's2', voltage: 950 } },
        { id: 'tr2', type: 'transformer', position: { x: 600, y: 150 }, data: { label: 't2', ratio: 0.3 } },
        bus('busA'),
      ],
      [
        { id: 'e1', source: 'ps1', target: 'tr1', sourceHandle: 'bottom', targetHandle: 'top' },
        { id: 'e2', source: 'tr1', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
        { id: 'e3', source: 'ps2', target: 'tr2', sourceHandle: 'bottom', targetHandle: 'top' },
        { id: 'e4', source: 'tr2', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
      ]
    )
    expect(result.voltageConflict.size).toBeGreaterThan(0)
  })
})