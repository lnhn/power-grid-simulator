import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const PowerSourceNode = memo(({ data }: NodeProps) => {
  return (
    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg px-6 py-3 min-w-[200px] border-2 border-blue-400">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-white text-sm">{data.label}</div>
            <div className="text-xs text-blue-100 font-medium">
              {data.voltage || 380}V AC
            </div>
          </div>
        </div>
      </div>
      
      {/* 只有底部输出 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ bottom: -8 }}
      />
    </div>
  )
})

PowerSourceNode.displayName = 'PowerSourceNode'
