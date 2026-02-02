import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const BusNode = memo(({ data }: NodeProps) => {
  return (
    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg px-6 py-3 min-w-[200px] border-2 border-indigo-400">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-white text-sm">{data.label}</div>
            <div className="text-xs text-indigo-100">
              配电母线
            </div>
          </div>
        </div>
      </div>
      
      {/* 顶部输入 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ top: -8 }}
      />
      {/* 底部输出 */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ bottom: -8 }}
      />
      {/* 左侧输出 */}
      <Handle
        type="source"
        position={Position.Left}
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ left: -8 }}
      />
      {/* 右侧输出 */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ right: -8 }}
      />
    </div>
  )
})

BusNode.displayName = 'BusNode'
