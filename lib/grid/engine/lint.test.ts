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

  it('两段母线直连给出提示（建议改用母联）', () => {
    const nodes = [node('b1', 'bus'), node('b2', 'bus')]
    const edges = [new EdgeModel('e1', 'b1:right', 'b2:left')]
    const issues = lintTopology(nodes, edges)
    const issue = issues.find((item) => item.code === 'BUS_BUS_DIRECT')
    expect(issue?.severity).toBe('warning')
    expect(issue?.nodeIds).toEqual(['b1', 'b2'])
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
  it('分层清晰、同排不重叠，且保留原横向顺序', () => {
    const layout = autoLayout([
      { id: 'ps2', type: 'powerSource', position: { x: 300, y: 0 } },
      { id: 'ps1', type: 'powerSource', position: { x: 100, y: 0 } },
      { id: 'bus', type: 'bus', position: { x: 0, y: 0 } },
      { id: 'load', type: 'load', position: { x: 0, y: 0 } },
    ])
    const y = (id: string) => layout.get(id)!.y
    const x = (id: string) => layout.get(id)!.x
    // 电源在最上，母线居中，负荷在下
    expect(y('ps1')).toBeLessThan(y('bus'))
    expect(y('bus')).toBeLessThan(y('load'))
    // 同一排的两台电源左右排开、不重叠，且原 x 小的仍在左边
    expect(y('ps1')).toBe(y('ps2'))
    expect(x('ps2') - x('ps1')).toBeGreaterThanOrEqual(240)
  })

  it('母联与母线同排', () => {
    const layout = autoLayout([
      { id: 'b1', type: 'bus', position: { x: 0, y: 0 } },
      { id: 'b2', type: 'bus', position: { x: 1, y: 0 } },
      { id: 'tie', type: 'switch', data: { subType: 'tie' }, position: { x: 0, y: 0 } },
    ])
    expect(Math.abs(layout.get('tie')!.y - layout.get('b1')!.y)).toBeLessThanOrEqual(4)
  })
});
