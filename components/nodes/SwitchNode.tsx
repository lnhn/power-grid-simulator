'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { SymbolIcon } from './SymbolIcon'

/** 语义色：闭合=绿、断开=灰，皮肤不改这两组颜色 */
const ON = '#16a34a'
const OFF = '#94a3b8'

export const SwitchNode = memo(({ data, selected }: NodeProps<GridNode>) => {
  const { tokens } = useSkin()
  const isOn = data.status === 'on'
  const isTie = data.subType === 'tie'
  const stateColor = isOn ? ON : OFF

  return (
    <div
      className="relative px-5 py-3 min-w-[240px] border-2"
      style={{
        background: 'var(--pg-panel)',
        borderColor: selected ? tokens.accent : isOn ? ON : 'var(--pg-panel-border)',
        borderRadius: 'var(--pg-radius)',
        boxShadow: selected ? `0 0 0 3px ${tokens.accentSoft}` : tokens.canvasShadow,
        fontFamily: 'var(--pg-font)',
      }}
    >
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

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="p-1.5"
            style={{ background: isOn ? 'rgba(22,163,74,0.12)' : 'var(--pg-panel-muted)', borderRadius: 'calc(var(--pg-radius) * 0.6)' }}
          >
            <SymbolIcon kind="switch" on={isOn} tie={isTie} color={stateColor} />
          </span>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--pg-text)' }}>{data.label}</div>
            <div className="text-xs font-medium" style={{ color: stateColor }}>
              {isOn ? '● 闭合' : '○ 断开'}
            </div>
          </div>
        </div>
        {isTie && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: tokens.accentSoft, color: tokens.accent }}
          >
            母联
          </span>
        )}
      </div>

      {!isTie ? (
        <>
          <Handle type="target" position={Position.Top} style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', top: -8 }} />
          <Handle type="source" position={Position.Bottom} style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', bottom: -8 }} />
        </>
      ) : (
        <>
          <Handle id="left-target" type="target" position={Position.Left} style={{ width: 14, height: 14, background: '#10b981', border: '2px solid var(--pg-panel)', left: -8 }} />
          <Handle id="left-source" type="source" position={Position.Left} style={{ width: 14, height: 14, background: '#10b981', border: '2px solid var(--pg-panel)', left: -8 }} />
          <Handle id="right-target" type="target" position={Position.Right} style={{ width: 14, height: 14, background: '#10b981', border: '2px solid var(--pg-panel)', right: -8 }} />
          <Handle id="right-source" type="source" position={Position.Right} style={{ width: 14, height: 14, background: '#10b981', border: '2px solid var(--pg-panel)', right: -8 }} />
        </>
      )}
    </div>
  )
})

SwitchNode.displayName = 'SwitchNode'