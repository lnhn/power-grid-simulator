import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'

export const TransformerNode = memo(({ data, selected }: NodeProps<GridNode>) => {
  return (
    <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg px-6 py-3 min-w-[240px] border-2 border-orange-400">
      {selected && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            data?.onDelete?.()
          }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white text-gray-700 border border-gray-200 shadow hover:bg-gray-50"
          aria-label="删除节点"
        >
          ×
        </button>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="6" width="6" height="12" rx="2" strokeWidth={1.8} />
              <rect x="15" y="6" width="6" height="12" rx="2" strokeWidth={1.8} />
              <path strokeWidth={1.8} strokeLinecap="round" d="M9 9h6M9 12h6M9 15h6" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-white text-sm">{data.label}</div>
          </div>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ top: -8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ bottom: -8 }}
      />
    </div>
  )
})

TransformerNode.displayName = 'TransformerNode'
