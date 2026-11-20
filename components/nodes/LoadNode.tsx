import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { NodeShell } from './NodeShell'
import { loadIcon } from './loadGlyphs'
import type { LiveView } from './LiveBadge'

/** 负荷：外形由 subType 决定（泵 / 风机 / 加热器…），外壳由皮肤统一 */
export const LoadNode = memo(({ data, selected }: NodeProps<GridNode>) => {
  const { tokens } = useSkin()
  // 运行态叠加：只在"运行态"开关打开时存在，不改设计数据
  const live = (data as unknown as { live?: LiveView }).live
  const statusRunning = data.status === 'running'
  const power = typeof data.power === 'number' ? data.power : undefined

  return (
    <NodeShell
      selected={selected}
      live={live}
      liveKind="load"
      title={data.label}
      subtitle={power != null ? `${power} kW` : '用电设备'}
      icon={loadIcon(data.subType)}
      badge={
        statusRunning ? (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(22,163,74,0.14)', color: '#16a34a' }}
          >
            运行
          </span>
        ) : undefined
      }
      onDelete={() => data?.onDelete?.()}
    >
      {/* 只有顶部输入 */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ width: 14, height: 14, background: tokens.accent, border: '2px solid var(--pg-panel)', top: -8 }}
      />
    </NodeShell>
  )
})

LoadNode.displayName = 'LoadNode'
