import { describe, expect, it } from 'vitest'
import { buildGridModels, GridSolver, lintTopology } from '..'
import { buildTemplate, TEMPLATE_LIST } from '../templates'

describe('拓扑模板', () => {
  it('三个模板都能被求解且没有 danger 级结构问题', () => {
    TEMPLATE_LIST.filter((item) => item.id !== 'blank').forEach((item) => {
      const { nodes, edges } = buildTemplate(item.id)
      const { nodeModels, edgeModels } = buildGridModels(nodes as never, edges as never)
      const issues = lintTopology(nodeModels, edgeModels)
      expect(issues.filter((issue) => issue.severity === 'danger')).toHaveLength(0)
      const result = GridSolver.solve(nodeModels, edgeModels)
      expect(result.sections.length).toBeGreaterThan(0)
      expect(result.totalKw).toBeGreaterThan(0)
    })
  })

  it('分段模板默认母联断开，形成两段', () => {
    const { nodes, edges } = buildTemplate('sectional-tie')
    const { nodeModels, edgeModels } = buildGridModels(nodes as never, edges as never)
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.sections).toHaveLength(2)
  })

  it('变压器模板二次侧为 380V', () => {
    const { nodes, edges } = buildTemplate('transformer-infeed')
    const { nodeModels, edgeModels } = buildGridModels(nodes as never, edges as never)
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.sections[0].voltage).toBe(380)
    expect(result.voltageConflict.size).toBe(0)
  })
})