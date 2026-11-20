'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { SymbolIcon } from './SymbolIcon'

const LIVE = '#16a34a'
const DEAD = '#94a3b8'

export const SimulatePowerSourceNode = memo(({ data }: NodeProps<GridNode>) => {
  const { tokens } = useSkin()
  const isPowered = data.powered !== false
  const portStatus = data.portStatus || {}
  const bottomPowered = portStatus.bottom ?? isPowered

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
            <SymbolIcon kind="source" color={isPowered ? LIVE : DEAD} />
          </span>
          <div className="font-bold text-sm" style={{ color: 'var(--pg-text)' }}>{data.label}</div>
        </div>
        <div
          className="px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{
            background: isPowered ? 'rgba(22,163,74,0.14)' : 'var(--pg-panel-muted)',
            color: isPowered ? LIVE : 'var(--pg-muted)',
          }}
        >
          {isPowered ? '运行' : '停止'}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ width: 14, height: 14, background: bottomPowered ? LIVE : DEAD, border: '2px solid var(--pg-panel)', bottom: -8 }} />
    </div>
  )
})

SimulatePowerSourceNode.displayName = 'SimulatePowerSourceNode'