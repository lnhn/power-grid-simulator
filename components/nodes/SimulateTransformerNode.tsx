'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { SymbolIcon } from './SymbolIcon'

const LIVE = '#16a34a'
const DEAD = '#94a3b8'

export const SimulateTransformerNode = memo(({ data }: NodeProps<GridNode>) => {
  const { tokens } = useSkin()
  const isPowered = data.powered
  const portStatus = data.portStatus || {}
  const topPowered = portStatus.top ?? isPowered
  const bottomPowered = portStatus.bottom ?? isPowered
  const nodeState = data.nodeState

  return (
    <div
      className="px-5 py-3 min-w-[240px] border-2"
      style={{
        background: 'var(--pg-panel)',
        borderColor: nodeState ? LIVE : 'var(--pg-panel-border)',
        borderRadius: 'var(--pg-radius)',
        boxShadow: nodeState ? '0 0 0 3px rgba(22,163,74,0.12)' : tokens.canvasShadow,
        fontFamily: 'var(--pg-font)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="p-1.5"
            style={{ background: nodeState ? 'rgba(22,163,74,0.14)' : 'var(--pg-panel-muted)', borderRadius: 'calc(var(--pg-radius) * 0.6)' }}
          >
            <SymbolIcon kind="transformer" color={nodeState ? LIVE : DEAD} />
          </span>
          <div>
            <div className="font-bold text-sm" style={{ color: 'var(--pg-text)' }}>{data.label}</div>
            {data.sectionVoltage != null && (
              <div className="text-xs" style={{ color: 'var(--pg-muted)' }}>分段电压 {data.sectionVoltage}V</div>
            )}
          </div>
        </div>
        <div
          className="px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{
            background: nodeState ? 'rgba(22,163,74,0.14)' : 'var(--pg-panel-muted)',
            color: nodeState ? LIVE : 'var(--pg-muted)',
          }}
        >
          {nodeState ? '带电' : '断电'}
        </div>
      </div>

      <Handle type="target" position={Position.Top} style={{ width: 14, height: 14, background: topPowered ? LIVE : DEAD, border: '2px solid var(--pg-panel)', top: -8 }} />
      <Handle type="source" position={Position.Bottom} style={{ width: 14, height: 14, background: bottomPowered ? LIVE : DEAD, border: '2px solid var(--pg-panel)', bottom: -8 }} />
    </div>
  )
})

SimulateTransformerNode.displayName = 'SimulateTransformerNode'