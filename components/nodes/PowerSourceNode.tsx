'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { SymbolIcon } from './SymbolIcon'
import { NodeShell } from './NodeShell'
import type { LiveView } from './LiveBadge'

export const PowerSourceNode = memo(({ data, selected }: NodeProps<GridNode>) => {
  const { tokens } = useSkin()
  // 运行态叠加：只在"运行态"开关打开时存在，不改设计数据
  const live = (data as unknown as { live?: LiveView }).live
  const voltage = typeof data.voltage === 'number' ? data.voltage : undefined

  return (
    <NodeShell
      selected={selected}
      live={live}
      liveKind="source"
      title={data.label}
      subtitle={voltage != null ? `${voltage} V 电源` : '电源'}
      icon={<SymbolIcon kind="source" color={tokens.accent} />}
      onDelete={() => data?.onDelete?.()}
    >
      <Handle type="source" position={Position.Bottom} style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', bottom: -8 }} />
    </NodeShell>
  )
})

PowerSourceNode.displayName = 'PowerSourceNode'
