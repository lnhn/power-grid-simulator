'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { SymbolIcon } from './SymbolIcon'
import { NodeShell } from './NodeShell'
import type { LiveView } from './LiveBadge'

export const TransformerNode = memo(({ data, selected }: NodeProps<GridNode>) => {
  const { tokens } = useSkin()
  // 运行态叠加：只在"运行态"开关打开时存在，不改设计数据
  const live = (data as unknown as { live?: LiveView }).live
  const ratio = typeof data.ratio === 'number' ? data.ratio : undefined

  return (
    <NodeShell
      selected={selected}
      live={live}
      liveKind="transformer"
      title={data.label}
      subtitle={ratio != null ? `二次侧 = 一次侧 × ${ratio}` : '变压器'}
      icon={<SymbolIcon kind="transformer" color={tokens.accent} />}
      onDelete={() => data?.onDelete?.()}
    >
      <Handle type="target" position={Position.Top} style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', top: -8 }} />
      <Handle type="source" position={Position.Bottom} style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', bottom: -8 }} />
    </NodeShell>
  )
})

TransformerNode.displayName = 'TransformerNode'
