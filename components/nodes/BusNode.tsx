import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const BusNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div className="relative bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg px-6 py-3 min-w-[240px] border-2 border-indigo-400">
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-white text-sm">{data.label}</div>
          </div>
        </div>
      </div>
      
      {/* 顶部输入 */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ top: -8 }}
      />
      {/* 底部输出 */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ bottom: -8 }}
      />
      {/* 左侧输出 */}
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ left: -8 }}
      />
      {/* 右侧输出 */}
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ right: -8 }}
      />
    </div>
  )
})

BusNode.displayName = 'BusNode'
