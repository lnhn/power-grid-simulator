/**
 * 皮肤规格（SkinSpec）：把"皮肤"从一组颜色扩成"颜色 + 形态 + 连线 + 3D 材质"。
 *
 * 分层原则：
 * - 颜色仍然来自 tokens.ts 的调色板，语义色（带电/失电/冲突）不在皮肤里，永远不会被皮肤改掉；
 * - 形态只决定"卡片长什么样"（卡片 / 紧凑条 / 端子式），由 NodeShell 统一实现，
 *   元件组件不再各写一套 padding 与圆角；
 * - 3D 的材质与光照也放在这里，将来 3D 视图直接读同一份 spec，换皮肤不换语义。
 */

import { getSkinTokens, type SkinId, type SkinMode, type SymbolSet } from './tokens'

export type NodeShape = 'card' | 'compact' | 'terminal'

export type SkinShape = {
  /** 卡片形态：整卡 / 紧凑条 / 端子式（只有状态点与名称） */
  nodeStyle: NodeShape
  /** 圆角相对 SkinTokens.radius 的倍数 */
  radiusScale: number
  borderWidth: 1 | 2
  shadow: 'none' | 'soft'
  /** 图标底板：方块 / 圆形 / 无底板 */
  iconFrame: 'tile' | 'circle' | 'bare'
  minWidth: number
  paddingX: number
  paddingY: number
  /** 标题字号（px） */
  titleSize: number
  /** 副标题字号（px） */
  subtitleSize: number
  /** 是否显示副标题上方的一行小注（如 schematic 的 BUSBAR） */
  showCaption: boolean
}

export type SkinWire = {
  /** 连线画法：正交折线 / 直线（后续接入 UpdatableEdge） */
  style: 'orthogonal' | 'straight'
  width: number
  animated: boolean
}

export type SkinView3d = {
  /** 设备材质 */
  material: 'pbr-steel' | 'flat-graphite' | 'matte-paper' | 'wireframe'
  /** 连线在 3D 里的画法 */
  edgeLine: 'none' | 'thin' | 'glow'
  ambient: number
  background: 'gradient' | 'flat' | 'grid'
}

export type SkinSpec = {
  id: SkinId
  name: string
  description: string
  shape: SkinShape
  wire: SkinWire
  /** 该皮肤默认搭配的符号集，用户仍可在设置里单独覆盖 */
  defaultSymbolSet: SymbolSet
  view3d: SkinView3d
}

export const SKIN_SPECS: Record<SkinId, SkinSpec> = {
  industrial: {
    id: 'industrial',
    name: '工业',
    description: '冷灰钢构、深蓝强调，适合控制室大屏',
    shape: {
      nodeStyle: 'card',
      radiusScale: 1,
      borderWidth: 2,
      shadow: 'soft',
      iconFrame: 'tile',
      minWidth: 240,
      paddingX: 20,
      paddingY: 12,
      titleSize: 14,
      subtitleSize: 12,
      showCaption: false,
    },
    wire: { style: 'orthogonal', width: 2, animated: false },
    defaultSymbolSet: 'iec',
    view3d: { material: 'pbr-steel', edgeLine: 'thin', ambient: 0.5, background: 'gradient' },
  },
  schematic: {
    id: 'schematic',
    name: '图纸',
    description: '白纸墨线、细网格，接近电气原理图',
    shape: {
      nodeStyle: 'compact',
      radiusScale: 0.2,
      borderWidth: 1,
      shadow: 'none',
      iconFrame: 'tile',
      minWidth: 184,
      paddingX: 10,
      paddingY: 8,
      titleSize: 13,
      subtitleSize: 11,
      showCaption: true,
    },
    wire: { style: 'orthogonal', width: 1, animated: false },
    defaultSymbolSet: 'gb',
    view3d: { material: 'wireframe', edgeLine: 'thin', ambient: 0.9, background: 'grid' },
  },
  terminal: {
    id: 'terminal',
    name: '端子',
    description: '端子式窄条，只留状态灯与名称，现场小屏信息密度最高',
    shape: {
      nodeStyle: 'terminal',
      radiusScale: 0.4,
      borderWidth: 1,
      shadow: 'none',
      iconFrame: 'bare',
      minWidth: 132,
      paddingX: 10,
      paddingY: 6,
      titleSize: 12,
      subtitleSize: 10,
      showCaption: false,
    },
    wire: { style: 'orthogonal', width: 1, animated: false },
    defaultSymbolSet: 'simple',
    view3d: { material: 'flat-graphite', edgeLine: 'glow', ambient: 0.35, background: 'flat' },
  },
  paper: {
    id: 'paper',
    name: '纸感',
    description: '暖白纸面、赭色强调，适合打印与交底',
    shape: {
      nodeStyle: 'card',
      radiusScale: 0.6,
      borderWidth: 1,
      shadow: 'soft',
      iconFrame: 'circle',
      minWidth: 228,
      paddingX: 16,
      paddingY: 10,
      titleSize: 14,
      subtitleSize: 12,
      showCaption: false,
    },
    wire: { style: 'orthogonal', width: 2, animated: false },
    defaultSymbolSet: 'simple',
    view3d: { material: 'matte-paper', edgeLine: 'none', ambient: 0.8, background: 'flat' },
  },
}

export const getSkinSpec = (id: SkinId): SkinSpec => SKIN_SPECS[id]

/** 供设置页做预览用：同一套 spec 在不同明暗下的取样色 */
export const skinSwatch = (id: SkinId, mode: SkinMode) => {
  const tokens = getSkinTokens(id, mode)
  return { bg: tokens.bg, panel: tokens.panel, accent: tokens.accent, border: tokens.panelBorder, text: tokens.text }
}
