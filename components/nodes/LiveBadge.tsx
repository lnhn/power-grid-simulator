'use client'

import { memo } from 'react'

/**
 * 运行态叠加层：只在"运行态"开关打开时挂在设计节点上。
 * 语义色是固定的——带电绿、失电灰、冲突红，与皮肤无关。
 */
export const LIVE = '#16a34a'
export const DEAD = '#94a3b8'
export const CONFLICT = '#dc2626'

export type BadgeKind = 'bus' | 'source' | 'switch' | 'tie' | 'transformer' | 'load'

export type LiveView = {
  powered: boolean
  voltage: number
  conflict?: boolean
  loadKw?: number
  sourceKw?: number
  tieMode?: 'parallel' | 'unsafeParallel' | 'sectioned' | 'standby'
  sectionVoltage?: number
}

export const liveBorderColor = (live?: LiveView | null): string | null => {
  if (!live) return null
  if (live.conflict) return CONFLICT
  return live.powered ? LIVE : DEAD
}

const TIE_TEXT: Record<string, string> = {
  parallel: '并列',
  unsafeParallel: '危险并列',
  sectioned: '分段',
  standby: '备用',
}

const badgeText = (live: LiveView, kind: BadgeKind): string => {
  if (live.conflict) return '电位冲突'
  switch (kind) {
    case 'load':
      return live.powered ? `${Math.round(live.loadKw ?? 0)} kW` : '停运'
    case 'source':
      return live.powered ? `${Math.round(live.sourceKw ?? 0)} kW` : '停运'
    case 'tie':
      return live.tieMode ? TIE_TEXT[live.tieMode] ?? '母联' : '母联'
    case 'switch':
      return live.powered ? '带电' : '失电'
    case 'transformer':
      return live.powered ? `${Math.round(live.voltage)} V` : '失电'
    default:
      return live.powered ? `${Math.round(live.voltage)} V` : '失电'
  }
}

/** 左上角状态小标签：一眼看出这个元件此刻通不通电、带多少负荷 */
export const LiveBadge = memo(({ live, kind = 'bus' }: { live: LiveView; kind?: BadgeKind }) => {
  const color = live.conflict ? CONFLICT : live.powered ? LIVE : DEAD
  const soft = live.conflict ? 'rgba(220,38,38,0.12)' : live.powered ? 'rgba(22,163,74,0.12)' : 'rgba(148,163,184,0.16)'

  return (
    <span
      className="absolute -top-2 left-2 px-1.5 py-[1px] text-[10px] font-semibold rounded-full leading-tight"
      style={{ background: soft, color, border: `1px solid ${color}` }}
    >
      {badgeText(live, kind)}
    </span>
  )
})

LiveBadge.displayName = 'LiveBadge'