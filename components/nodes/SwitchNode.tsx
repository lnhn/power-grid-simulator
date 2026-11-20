'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { SymbolIcon } from './SymbolIcon'
import { NodeShell } from './NodeShell'
import type { LiveView } from './LiveBadge'

/** 语义色：闭合=绿、断开=灰，皮肤不改这两组颜色 */
const ON = '#16a34a'
const OFF = '#94a3b8'

export const SwitchNode = memo(({ data, selected }: NodeProps<GridNode>) => {
  const { tokens } = useSkin()
  // 运行态叠加：只在"运行态"开关打开时存在，不改设计数据
  const live = (data as unknown as { live?: LiveView }).live
  const isOn = data.status === 'on'
  const isTie = data.subType === 'tie'
  const stateColor = isOn ? ON : OFF

  return (
    <NodeShell
      selected={selected}
      live={live}
      liveKind={isTie ? 'tie' : 'switch'}
      tone={isOn ? ON : undefined}
      title={data.label}
      subtitle={isOn ? '● 闭合' : '○ 断开'}
      subtitleTone={stateColor}
      icon={<SymbolIcon kind="switch" on={isOn} tie={isTie} color={stateColor} />}
      iconTone={stateColor}
      iconBackground={isOn ? 'rgba(22,163,74,0.12)' : 'var(--pg-panel-muted)'}
      badge={
        isTie ? (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: tokens.accentSoft, color: tokens.accent }}
          >
            母联
          </span>
        ) : undefined
      }
      onDelete={() => data?.onDelete?.()}
    >
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
    </NodeShell>
  )
})

SwitchNode.displayName = 'SwitchNode'
