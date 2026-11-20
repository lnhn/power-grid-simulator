/**
 * 皮肤只控制"表面层"：背景、网格、面板、连线、字体与圆角。
 * 元件本体的语义色（带电/失电/冲突）不随皮肤改变——换皮肤不改变美学，也不改变含义。
 *
 * 元件符号集（IEC / 国标 / 简化）是独立维度，见 SYMBOL_LIST：形状影响"怎么画"，
 * 语义色影响"是什么意思"，两者可以自由组合。
 */

export type SkinId = 'industrial' | 'schematic' | 'paper'
export type SkinMode = 'light' | 'dark'
export type SymbolSet = 'iec' | 'gb' | 'simple'

export type SkinTokens = {
  bg: string
  surface: string
  border: string
  text: string
  muted: string
  accent: string
  accentSoft: string
  grid: string
  edgeIdle: string
  edgeActive: string
  edgeConflict: string
  canvasShadow: string
  /** 面板卡片：侧栏、弹窗、检查清单的底色与描边 */
  panel: string
  panelBorder: string
  panelMuted: string
  /** 元件卡片的圆角与字体，统一由皮肤决定 */
  radius: string
  fontFamily: string
}

type Palette = Omit<SkinTokens, 'panel' | 'panelBorder' | 'panelMuted' | 'radius' | 'fontFamily'>

export type SkinMeta = { id: SkinId; name: string; description: string }

export const SKIN_LIST: SkinMeta[] = [
  { id: 'industrial', name: '工业', description: '冷灰钢构、深蓝强调，适合控制室大屏' },
  { id: 'schematic', name: '图纸', description: '白纸墨线、细网格，接近电气原理图' },
  { id: 'paper', name: '纸感', description: '暖白纸面、赭色强调，适合打印与交底' },
]

export type SymbolMeta = { id: SymbolSet; name: string; description: string }

export const SYMBOL_LIST: SymbolMeta[] = [
  { id: 'iec', name: 'IEC 符号', description: '母排为粗线、开关为刀开关、变压器为双圆' },
  { id: 'gb', name: '国标符号', description: '矩形母排、方形断路器、双矩形变压器' },
  { id: 'simple', name: '简化符号', description: '只保留通断状态，适合手机与投屏' },
]

const PALETTES: Record<SkinId, Record<SkinMode, Palette>> = {
  industrial: {
    light: {
      bg: '#f1f5f9', surface: '#ffffff', border: '#cbd5e1', text: '#0f172a', muted: '#64748b',
      accent: '#1d4ed8', accentSoft: '#dbeafe', grid: '#cbd5e1',
      edgeIdle: '#94a3b8', edgeActive: '#2563eb', edgeConflict: '#ef4444',
      canvasShadow: '0 1px 2px rgba(15,23,42,0.08)',
    },
    dark: {
      bg: '#0b1220', surface: '#111a2b', border: '#24334a', text: '#e2e8f0', muted: '#94a3b8',
      accent: '#38bdf8', accentSoft: '#0e3a52', grid: '#24334a',
      edgeIdle: '#475569', edgeActive: '#38bdf8', edgeConflict: '#f87171',
      canvasShadow: 'none',
    },
  },
  schematic: {
    light: {
      bg: '#ffffff', surface: '#fbfdfb', border: '#cfe0cf', text: '#1c2b1c', muted: '#5f6f5f',
      accent: '#15803d', accentSoft: '#dcfce7', grid: '#dfeee0',
      edgeIdle: '#9fb3a1', edgeActive: '#15803d', edgeConflict: '#b91c1c',
      canvasShadow: 'none',
    },
    dark: {
      bg: '#0f1411', surface: '#151d16', border: '#2b3a2d', text: '#dceadc', muted: '#93a894',
      accent: '#4ade80', accentSoft: '#12351f', grid: '#223124',
      edgeIdle: '#4b5f4e', edgeActive: '#4ade80', edgeConflict: '#f87171',
      canvasShadow: 'none',
    },
  },
  paper: {
    light: {
      bg: '#faf6ec', surface: '#fffdf7', border: '#e2d9c3', text: '#3f3a33', muted: '#8b8172',
      accent: '#b45309', accentSoft: '#fde68a', grid: '#e7dbc2',
      edgeIdle: '#b9ac94', edgeActive: '#b45309', edgeConflict: '#b91c1c',
      canvasShadow: '0 1px 2px rgba(63,58,51,0.08)',
    },
    dark: {
      bg: '#1c1917', surface: '#26211d', border: '#3f3831', text: '#ece5da', muted: '#b0a291',
      accent: '#f59e0b', accentSoft: '#43290a', grid: '#332d27',
      edgeIdle: '#6b6157', edgeActive: '#f59e0b', edgeConflict: '#f87171',
      canvasShadow: 'none',
    },
  },
}

/** 每种皮肤自己的"面板质感"：圆角、字体、卡片底色 */
const SKIN_STYLE: Record<
  SkinId,
  {
    radius: string
    fontFamily: string
    panel: Record<SkinMode, { panel: string; panelBorder: string; panelMuted: string }>
  }
> = {
  industrial: {
    radius: '10px',
    fontFamily: "Inter, 'Noto Sans SC', system-ui, -apple-system, sans-serif",
    panel: {
      light: { panel: '#ffffff', panelBorder: '#e2e8f0', panelMuted: '#f8fafc' },
      dark: { panel: '#1b2740', panelBorder: '#3a4d6b', panelMuted: '#121d2e' },
    },
  },
  schematic: {
    radius: '2px',
    fontFamily: "'JetBrains Mono', 'Sarasa Mono SC', ui-monospace, SFMono-Regular, monospace",
    panel: {
      light: { panel: '#fdfefd', panelBorder: '#cfe0cf', panelMuted: '#f2f7f2' },
      dark: { panel: '#1a241c', panelBorder: '#405240', panelMuted: '#121a13' },
    },
  },
  paper: {
    radius: '6px',
    fontFamily: "Georgia, 'Songti SC', 'Noto Serif SC', serif",
    panel: {
      light: { panel: '#fffdf7', panelBorder: '#e2d9c3', panelMuted: '#f6f0e2' },
      dark: { panel: '#312922', panelBorder: '#52483c', panelMuted: '#221e1a' },
    },
  },
}

export const getSkinTokens = (skin: SkinId, mode: SkinMode): SkinTokens => {
  const palette = PALETTES[skin][mode]
  const style = SKIN_STYLE[skin]
  return {
    ...palette,
    ...style.panel[mode],
    radius: style.radius,
    fontFamily: style.fontFamily,
  }
}

export function skinVars(tokens: SkinTokens): Record<string, string> {
  return {
    '--pg-bg': tokens.bg,
    '--pg-surface': tokens.surface,
    '--pg-border': tokens.border,
    '--pg-text': tokens.text,
    '--pg-muted': tokens.muted,
    '--pg-accent': tokens.accent,
    '--pg-accent-soft': tokens.accentSoft,
    '--pg-grid': tokens.grid,
    '--pg-edge-idle': tokens.edgeIdle,
    '--pg-edge-active': tokens.edgeActive,
    '--pg-edge-conflict': tokens.edgeConflict,
    '--pg-canvas-shadow': tokens.canvasShadow,
    '--pg-panel': tokens.panel,
    '--pg-panel-border': tokens.panelBorder,
    '--pg-panel-muted': tokens.panelMuted,
    '--pg-radius': tokens.radius,
    '--pg-font': tokens.fontFamily,
  }
}