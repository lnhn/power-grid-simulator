import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const TransformerNode = memo(({ data }: NodeProps) => {
  return (
    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg px-6 py-3 min-w-[220px] border-2 border-orange-400">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v6m0 0l3-3m-3 3L9 6m9 6a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-white text-sm">{data.label}</div>
            <div className="text-xs text-orange-100">
              变压器
            </div>
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
