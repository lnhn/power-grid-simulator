'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { SymbolIcon } from './SymbolIcon'
import { LiveBadge, liveBorderColor, type LiveView } from './LiveBadge'

export const PowerSourceNode = memo(({ data, selected }: NodeProps<GridNode>) => {
  const { tokens } = useSkin()
  // 运行态叠加：只在"运行态"开关打开时存在，不改设计数据
  const live = (data as unknown as { live?: LiveView }).live
  const liveBorder = liveBorderColor(live)

  return (
    <div
      className="relative px-5 py-3 min-w-[240px] border-2"
      style={{
        background: 'var(--pg-panel)',
        borderColor: liveBorder ?? (selected ? tokens.accent : 'var(--pg-panel-border)'),
        borderRadius: 'var(--pg-radius)',
        boxShadow: selected ? `0 0 0 3px ${tokens.accentSoft}` : tokens.canvasShadow,
        fontFamily: 'var(--pg-font)',
      }}
    >
      {live && <LiveBadge live={live} kind={'source'} />}
      {selected && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            data?.onDelete?.()
          }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full shadow text-sm leading-none"
          style={{ background: 'var(--pg-panel)', border: '1px solid var(--pg-panel-border)', color: 'var(--pg-muted)' }}
          aria-label="删除节点"
        >
          ×
        </button>
      )}

      <div className="flex items-center gap-3">
        <span
          className="p-1.5"
          style={{ background: tokens.accentSoft, borderRadius: 'calc(var(--pg-radius) * 0.6)', color: tokens.accent }}
        >
          <SymbolIcon kind="source" color={tokens.accent} />
        </span>
        <div>
          <div className="font-bold text-sm" style={{ color: 'var(--pg-text)' }}>{data.label}</div>
          {'voltage' in data && data.voltage != null && (
            <div className="text-xs" style={{ color: 'var(--pg-muted)' }}>{data.voltage} V 电源</div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', bottom: -8 }} />
    </div>
  )
})

PowerSourceNode.displayName = 'PowerSourceNode'