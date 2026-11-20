'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { SymbolIcon } from './SymbolIcon'

/** 语义色：带电=绿、失电=灰，皮肤不改这两组颜色 */
const LIVE = '#16a34a'
const DEAD = '#94a3b8'

export const SimulateBusNode = memo(({ data }: NodeProps<GridNode>) => {
  const { tokens } = useSkin()
  const isPowered = data.powered
  const portStatus = data.portStatus || {}
  const topPowered = portStatus.top ?? isPowered
  const bottomPowered = portStatus.bottom ?? isPowered
  const leftPowered = portStatus.left ?? isPowered
  const rightPowered = portStatus.right ?? isPowered

  return (
    <div
      className="px-5 py-3 min-w-[240px] border-2"
      style={{
        background: 'var(--pg-panel)',
        borderColor: isPowered ? LIVE : 'var(--pg-panel-border)',
        borderRadius: 'var(--pg-radius)',
        boxShadow: isPowered ? '0 0 0 3px rgba(22,163,74,0.12)' : tokens.canvasShadow,
        fontFamily: 'var(--pg-font)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="p-1.5"
            style={{ background: isPowered ? 'rgba(22,163,74,0.14)' : 'var(--pg-panel-muted)', borderRadius: 'calc(var(--pg-radius) * 0.6)' }}
          >
            <SymbolIcon kind="bus" color={isPowered ? LIVE : DEAD} />
          </span>
          <div className="font-bold text-sm" style={{ color: 'var(--pg-text)' }}>{data.label}</div>
        </div>
        <div
          className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
          style={{
            background: isPowered ? 'rgba(22,163,74,0.14)' : 'var(--pg-panel-muted)',
            color: isPowered ? LIVE : 'var(--pg-muted)',
          }}
        >
          {isPowered ? (data.liveVoltage ? `带电 · ${data.liveVoltage}V` : '带电') : '停止'}
        </div>
      </div>

      <Handle type="target" position={Position.Top} id="top-target" style={{ width: 14, height: 14, background: topPowered ? LIVE : DEAD, border: '2px solid var(--pg-panel)', top: -8 }} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ width: 14, height: 14, background: bottomPowered ? LIVE : DEAD, border: '2px solid var(--pg-panel)', bottom: -8 }} />
      <Handle type="source" position={Position.Left} id="left-source" style={{ width: 14, height: 14, background: leftPowered ? LIVE : DEAD, border: '2px solid var(--pg-panel)', left: -8 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ width: 14, height: 14, background: rightPowered ? LIVE : DEAD, border: '2px solid var(--pg-panel)', right: -8 }} />
    </div>
  )
})

SimulateBusNode.displayName = 'SimulateBusNode'