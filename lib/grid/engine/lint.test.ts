import { describe, expect, it } from 'vitest'
import { NodeModel, EdgeModel } from '..'
import { hasBlockingIssue, lintTopology, summarizeLint } from './lint'
import { autoLayout } from '../layout'

const node = (id: string, type: string, data: Record<string, unknown> = {}, x = 0) =>
  new NodeModel(id, type as never, data as never, { x, y: 0 })

describe('拓扑 lint', () => {
  it('母联只接一侧时判为必须修复', () => {
    const nodes = [node('bus1', 'bus'), node('bus2', 'bus'), node('tie', 'switch', { subType: 'tie' })]
    const edges = [
      new EdgeModel('e1', 'bus1:right', 'tie:left'),
    ]
    const issues = lintTopology(nodes, edges)
    const tieIssue = issues.find((issue) => issue.code === 'TIE_SINGLE_SIDE')
    expect(tieIssue?.severity).toBe('danger')
    expect(hasBlockingIssue(issues)).toBe(true)
  })

  it('电源没有出线判为必须修复', () => {
    const issues = lintTopology([node('ps', 'powerSource')], [])
    expect(issues.map((issue) => issue.code)).toContain('SOURCE_NO_OUTLET')
  })

  it('孤立负荷只是提示，不拦保存', () => {
    const nodes = [node('ps', 'powerSource'), node('load', 'load')]
    const issues = lintTopology(nodes, [])
    expect(issues.some((issue) => issue.code === 'ISOLATED_NODE')).toBe(true)
    expect(hasBlockingIssue(issues)).toBe(true) // 电源无出线仍是 danger
  })

  it('同一端子接两条线给出提示（母联豁免）', () => {
    const nodes = [node('ps', 'powerSource'), node('bus', 'bus')]
    const edges = [
      new EdgeModel('e1', 'ps:bottom', 'bus:left'),
      new EdgeModel('e2', 'ps:bottom', 'bus:left'),
    ]
    const issues = lintTopology(nodes, edges)
    expect(issues.some((issue) => issue.code === 'TERMINAL_MULTI_EDGE')).toBe(true)
  })

  it('悬空连线判为必须修复', () => {
    const issues = lintTopology([node('ps', 'powerSource')], [new EdgeModel('e1', 'ps:bottom', 'ghost:top')])
    expect(issues.find((issue) => issue.code === 'EDGE_UNKNOWN_NODE')?.severity).toBe('danger')
  })

  it('汇总文案区分必须修复与提示', () => {
    expect(summarizeLint([])).toBe('拓扑结构完整')
    expect(summarizeLint([{ code: 'X', severity: 'danger', message: '', nodeIds: [], edgeIds: [] }])).toContain('必须修复')
  })
})

describe('一键整理', () => {
  it('按类型分排并保留横向顺序', () => {
    const layout = autoLayout([
      { id: 'ps2', type: 'powerSource', position: { x: 300, y: 0 } },
      { id: 'ps1', type: 'powerSource', position: { x: 100, y: 0 } },
      { id: 'bus', type: 'bus', position: { x: 0, y: 0 } },
      { id: 'load', type: 'load', position: { x: 0, y: 0 } },
    ])
    expect(layout.get('ps1')?.x).toBe(0)
    expect(layout.get('ps2')?.x).toBe(220)
    expect(layout.get('ps1')?.y).toBe(0)
    expect(layout.get('bus')?.y).toBe(280)
    expect(layout.get('load')?.y).toBe(560)
  })

  it('母联与母线同排', () => {
    const layout = autoLayout([
      { id: 'b1', type: 'bus', position: { x: 0, y: 0 } },
      { id: 'b2', type: 'bus', position: { x: 1, y: 0 } },
      { id: 'tie', type: 'switch', data: { subType: 'tie' }, position: { x: 0, y: 0 } },
    ])
    expect(layout.get('tie')?.y).toBe(280)
  })
})