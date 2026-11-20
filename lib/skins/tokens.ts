/**
 * 皮肤只控制"表面层"：背景、网格、面板、连线、字体与圆角。
 * 元件本体的语义色（带电/失电/冲突）不随皮肤改变——换皮肤不改变美学，也不改变含义。
 */

export type SkinId = 'industrial' | 'schematic' | 'paper'
export type SkinMode = 'light' | 'dark'

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
}

export type SkinMeta = { id: SkinId; name: string; description: string }

export const SKIN_LIST: SkinMeta[] = [
  { id: 'industrial', name: '工业', description: '冷灰钢构、深蓝强调，适合控制室大屏' },
  { id: 'schematic', name: '图纸', description: '白纸墨线、细网格，接近电气原理图' },
  { id: 'paper', name: '纸感', description: '暖白纸面、赭色强调，适合打印与交底' },
]

const PALETTES: Record<SkinId, Record<SkinMode, SkinTokens>> = {
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

export const getSkinTokens = (skin: SkinId, mode: SkinMode): SkinTokens => PALETTES[skin][mode]

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
  }
}