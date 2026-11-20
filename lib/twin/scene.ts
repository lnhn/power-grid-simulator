/**
 * 2D 单线图 → 3D 场景的纯函数映射。
 *
 * 这一层刻意不碰 three：只把「画布节点 + 求解结果」翻译成设备列表与电缆列表，
 * 因此可以单测、可以在没有 GPU 的环境里验证"数字孪生有没有画错"。
 *
 * 三条约定：
 * 1. 坐标只做线性映射（2D x → 3D x，2D y → 3D z），不在 3D 里重新布局，保证两边是同一张图；
 * 2. 带电 / 冲突 / 负荷功率一律来自 GridSolveResult，3D 不自己算电；
 * 3. 设备尺寸按几何参数表来，与语义色无关——换皮肤只换材质，不换尺寸。
 */

import { BUSBAR_HEIGHT, DEPTH_STRETCH, METER_PER_PX, TWIN_BOXES } from './geometry'

type FlowNode = {
  id: string
  type?: string
  position?: { x: number; y: number }
  data?: Record<string, unknown>
}

type FlowEdge = {
  id: string
  source: string
  target: string
  data?: Record<string, unknown>
}

type SolveResultLike = {
  nodePowered: Map<string, boolean>
  portVoltages: Map<string, number>
  voltageConflict: Set<string>
  sections: Array<{ id: string; busIds: string[]; voltage: number }>
  loadKw: Map<string, number>
  sourceOutput: Map<string, number>
  ties: Map<string, { mode: string }>
  edgeStates: Map<string, { active: boolean; kw: number; conflict: boolean }>
}

export type TwinDeviceKind = 'source' | 'busbar' | 'breaker' | 'tie' | 'transformer' | 'load'

export type TwinBox = { w: number; h: number; d: number }

export type TwinVec3 = { x: number; y: number; z: number }

export type TwinDeviceState = {
  powered: boolean
  conflict: boolean
  voltage: number
  loadKw?: number
  sourceKw?: number
  tieMode?: string
  /** 开关/母联的设计位置（合上与否），与"带电"是两件事 */
  closed?: boolean
}

export type TwinDevice = {
  id: string
  kind: TwinDeviceKind
  label: string
  box: TwinBox
  /** 设备底部中心点；y 是离地高度 */
  at: TwinVec3
  state: TwinDeviceState
  meta: {
    subType?: string
    ratio?: number
    ratedVoltage?: number
  }
}

export type TwinCable = {
  id: string
  from: string
  to: string
  powered: boolean
  kw: number
  conflict: boolean
}

export type TwinScene = {
  devices: TwinDevice[]
  cables: TwinCable[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; maxHeight: number }
}

const SIDES = ['top', 'bottom', 'left', 'right'] as const

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const kindOf = (node: FlowNode): TwinDeviceKind => {
  if (node.type === 'bus') return 'busbar'
  if (node.type === 'powerSource') return 'source'
  if (node.type === 'transformer') return 'transformer'
  if (node.type === 'load') return 'load'
  if (node.type === 'switch') return node.data?.subType === 'tie' ? 'tie' : 'breaker'
  return 'load'
}

/**
 * 构建 3D 场景。
 * @param nodes 画布节点（位置来自 2D，坐标系与画布一致）
 * @param edges 画布连线
 * @param result 求解结果：只读，绝不在这里重算
 */
export function buildTwinScene(
  nodes: FlowNode[],
  edges: FlowEdge[],
  result: SolveResultLike
): TwinScene {
  const positions = nodes.map((node) => node.position ?? { x: 0, y: 0 })
  const minY = positions.length ? Math.min(...positions.map((p) => p.y)) : 0
  const minX = positions.length ? Math.min(...positions.map((p) => p.x)) : 0

  const devices: TwinDevice[] = nodes.map((node, index) => {
    const kind = kindOf(node)
    const position = positions[index]
    const box = TWIN_BOXES[kind]

    const conflict = SIDES.some((side) => result.voltageConflict.has(`${node.id}:${side}`))
    const portVoltages = SIDES.map((side) => result.portVoltages.get(`${node.id}:${side}`) ?? 0)
    const section =
      node.type === 'bus' ? result.sections.find((item) => item.busIds.includes(node.id)) : undefined
    const voltage = section ? section.voltage : Math.max(0, ...portVoltages)

    const tie = node.type === 'switch' && node.data?.subType === 'tie' ? result.ties.get(node.id) : undefined
    const closedValue =
      typeof node.data?.closed === 'boolean'
        ? node.data.closed
        : node.data?.status === 'on'
          ? true
          : node.data?.status === 'off'
            ? false
            : undefined

    return {
      id: node.id,
      kind,
      label: String(node.data?.label ?? node.id),
      box,
      at: {
        // 2D 的 x 直接换米；母线悬空，柜体落地
        x: (position.x - minX) * METER_PER_PX,
        y: kind === 'busbar' ? BUSBAR_HEIGHT : 0,
        z: (position.y - minY) * METER_PER_PX * DEPTH_STRETCH,
      },
      state: {
        powered: result.nodePowered.get(node.id) ?? false,
        conflict,
        voltage,
        loadKw: node.type === 'load' ? result.loadKw.get(node.id) ?? 0 : undefined,
        sourceKw: node.type === 'powerSource' ? result.sourceOutput.get(node.id) ?? 0 : undefined,
        tieMode: tie?.mode,
        closed: closedValue,
      },
      meta: {
        subType: typeof node.data?.subType === 'string' ? node.data.subType : undefined,
        ratio: num(node.data?.ratio),
        ratedVoltage: num(node.data?.ratedVoltage) ?? num(node.data?.voltage),
      },
    }
  })

  const deviceIds = new Set(devices.map((device) => device.id))
  const cables: TwinCable[] = edges
    .filter((edge) => deviceIds.has(edge.source) && deviceIds.has(edge.target))
    .map((edge) => {
      const state = result.edgeStates.get(edge.id)
      return {
        id: edge.id,
        from: edge.source,
        to: edge.target,
        powered: state?.active ?? false,
        kw: state?.kw ?? 0,
        conflict: state?.conflict ?? false,
      }
    })

  const maxX = devices.reduce((acc, device) => Math.max(acc, device.at.x + device.box.w), 0)
  const maxZ = devices.reduce((acc, device) => Math.max(acc, device.at.z + device.box.d), 0)
  const maxHeight = devices.reduce((acc, device) => Math.max(acc, device.at.y + device.box.h), 0)

  return {
    devices,
    cables,
    bounds: { minX: 0, maxX, minZ: 0, maxZ, maxHeight },
  }
}
