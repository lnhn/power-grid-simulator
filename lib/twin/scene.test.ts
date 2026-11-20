import { describe, expect, it } from 'vitest'
import { buildGridModels, GridSolver } from '../grid'
import { buildTemplate } from '../grid/templates'
import { buildTwinScene } from './scene'
import { TWIN_BOXES, BUSBAR_HEIGHT } from './geometry'

type AnyNode = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }
type AnyEdge = { id: string; source: string; target: string }

const solve = (templateId: Parameters<typeof buildTemplate>[0], extraNodes: AnyNode[] = []) => {
  const template = buildTemplate(templateId)
  const nodes = [...template.nodes, ...extraNodes] as AnyNode[]
  const edges = template.edges as AnyEdge[]
  const { nodeModels, edgeModels } = buildGridModels(nodes as never, edges as never)
  const result = GridSolver.solve(nodeModels, edgeModels)
  return { nodes, edges, result }
}

describe('3D 场景映射', () => {
  it('每个画布节点都对应一台设备，类型不丢', () => {
    const { nodes, edges, result } = solve('sectional-tie')
    const scene = buildTwinScene(nodes as never, edges as never, result)

    expect(scene.devices).toHaveLength(nodes.length)
    expect(scene.devices.filter((d) => d.kind === 'source')).toHaveLength(2)
    expect(scene.devices.filter((d) => d.kind === 'busbar')).toHaveLength(2)
    expect(scene.devices.filter((d) => d.kind === 'tie')).toHaveLength(1)
    expect(scene.devices.filter((d) => d.kind === 'load')).toHaveLength(2)
  })

  it('尺寸来自几何参数表，母线悬空、柜体落地', () => {
    const breaker: AnyNode = {
      id: 'qf1',
      type: 'switch',
      position: { x: 400, y: 300 },
      data: { label: '1# 馈线柜', subType: 'breaker', status: 'on' },
    }
    const { nodes, edges, result } = solve('sectional-tie', [breaker])
    const scene = buildTwinScene(nodes as never, edges as never, result)
    const bus = scene.devices.find((d) => d.kind === 'busbar')!
    const qf = scene.devices.find((d) => d.kind === 'breaker')!

    expect(bus.box.w).toBe(TWIN_BOXES.busbar.w)
    expect(bus.at.y).toBe(BUSBAR_HEIGHT)
    expect(qf.at.y).toBe(0)
    expect(qf.box.w).toBe(TWIN_BOXES.breaker.w)
    expect(qf.state.closed).toBe(true)
  })

  it('坐标只做线性映射：2D 越靠下，3D 越靠里', () => {
    const { nodes, edges, result } = solve('sectional-tie')
    const scene = buildTwinScene(nodes as never, edges as never, result)

    const sources = scene.devices.filter((d) => d.kind === 'source')
    const loads = scene.devices.filter((d) => d.kind === 'load')
    const sourceZ = Math.min(...sources.map((d) => d.at.z))
    const loadZ = Math.max(...loads.map((d) => d.at.z))
    expect(sourceZ).toBeLessThan(loadZ)

    scene.devices.forEach((device) => {
      expect(device.at.x).toBeGreaterThanOrEqual(0)
      expect(device.at.z).toBeGreaterThanOrEqual(0)
    })
  })

  it('带电、冲突、功率全部来自求解结果，不在 3D 里重算', () => {
    const { nodes, edges, result } = solve('sectional-tie')
    const scene = buildTwinScene(nodes as never, edges as never, result)

    scene.devices.forEach((device) => {
      expect(device.state.powered).toBe(result.nodePowered.get(device.id) ?? false)
    })

    scene.cables.forEach((cable) => {
      expect(cable.powered).toBe(result.edgeStates.get(cable.id)?.active ?? false)
      expect(cable.kw).toBe(result.edgeStates.get(cable.id)?.kw ?? 0)
      expect(cable.conflict).toBe(result.edgeStates.get(cable.id)?.conflict ?? false)
    })
  })

  it('连线数量与画布边一致，端点悬空的边被剔除', () => {
    const { nodes, edges, result } = solve('sectional-tie')
    const scene = buildTwinScene(nodes as never, edges as never, result)
    expect(scene.cables).toHaveLength(edges.length)

    const dangling = buildTwinScene(
      nodes as never,
      [...edges, { id: 'e-bad', source: 'busA', target: 'ghost' }] as never,
      result
    )
    expect(dangling.cables).toHaveLength(edges.length)
  })

  it('包围盒覆盖所有设备，供相机取景', () => {
    const { nodes, edges, result } = solve('sectional-tie')
    const scene = buildTwinScene(nodes as never, edges as never, result)

    scene.devices.forEach((device) => {
      expect(device.at.x).toBeGreaterThanOrEqual(scene.bounds.minX)
      expect(device.at.x + device.box.w).toBeLessThanOrEqual(scene.bounds.maxX + 1e-6)
      expect(device.at.z).toBeGreaterThanOrEqual(scene.bounds.minZ)
      expect(device.at.z + device.box.d).toBeLessThanOrEqual(scene.bounds.maxZ + 1e-6)
      expect(device.at.y + device.box.h).toBeLessThanOrEqual(scene.bounds.maxHeight + 1e-6)
    })
  })
})
