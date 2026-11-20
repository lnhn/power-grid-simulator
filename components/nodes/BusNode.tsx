'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { SymbolIcon } from './SymbolIcon'
import { NodeShell } from './NodeShell'
import type { LiveView } from './LiveBadge'

/** 母线：一块横条，皮肤决定卡片形态，符号集决定母排画法 */
export const BusNode = memo(({ data, selected }: NodeProps<GridNode>) => {
  const { tokens, spec } = useSkin()
  // 运行态叠加：只在"运行态"开关打开时存在，不改设计数据
  const live = (data as unknown as { live?: LiveView }).live
  const voltage = typeof data.voltage === 'number' && data.voltage > 0 ? data.voltage : undefined

  return (
    <NodeShell
      selected={selected}
      live={live}
      liveKind="bus"
      title={data.label}
      caption={spec.shape.showCaption ? 'BUSBAR' : undefined}
      subtitle={voltage != null ? `${voltage} V 母线段` : undefined}
      icon={<SymbolIcon kind="bus" color={tokens.accent} />}
      onDelete={() => data?.onDelete?.()}
    >
      <Handle type="target" position={Position.Top} id="top-target" style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', top: -8 }} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', bottom: -8 }} />
      <Handle type="source" position={Position.Left} id="left-source" style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', left: -8 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', right: -8 }} />
    </NodeShell>
  )
})

BusNode.displayName = 'BusNode'
