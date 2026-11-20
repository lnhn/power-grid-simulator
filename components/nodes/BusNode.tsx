'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { SymbolIcon } from './SymbolIcon'
import { LiveBadge, liveBorderColor, type LiveView } from './LiveBadge'

/** 母线：一块横条，皮肤决定面板质感，符号集决定母排画法 */
export const BusNode = memo(({ data, selected }: NodeProps<GridNode>) => {
  const { tokens, skin } = useSkin()
  // 运行态叠加：只在"运行态"开关打开时存在，不改设计数据
  const live = (data as unknown as { live?: LiveView }).live
  const liveBorder = liveBorderColor(live)

  return (
    <div
      className="relative px-5 py-3 min-w-[240px] border-2 transition-shadow"
      style={{
        background: 'var(--pg-panel)',
        borderColor: liveBorder ?? (selected ? tokens.accent : 'var(--pg-panel-border)'),
        borderRadius: 'var(--pg-radius)',
        boxShadow: selected ? `0 0 0 3px ${tokens.accentSoft}` : tokens.canvasShadow,
        fontFamily: 'var(--pg-font)',
      }}
    >
      {live && <LiveBadge live={live} kind={'bus'} />}
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
          <SymbolIcon kind="bus" color={tokens.accent} />
        </span>
        <div className="min-w-0">
          <div className="font-bold text-sm truncate" style={{ color: 'var(--pg-text)' }}>
            {data.label}
          </div>
          {skin === 'schematic' && (
            <div className="text-[10px] tracking-widest" style={{ color: 'var(--pg-muted)' }}>
              BUSBAR
            </div>
          )}
        </div>
      </div>

      <Handle type="target" position={Position.Top} id="top-target" style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', top: -8 }} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', bottom: -8 }} />
      <Handle type="source" position={Position.Left} id="left-source" style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', left: -8 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', right: -8 }} />
    </div>
  )
})

BusNode.displayName = 'BusNode'