import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const SwitchNode = memo(({ data, selected }: NodeProps) => {
  const isOn = data.status === 'on'
  const isTie = data.subType === 'tie'
  
  return (
    <div className={`relative bg-white rounded-lg shadow-lg px-6 py-3 min-w-[240px] border-2 transition-all ${
      isOn ? 'border-green-500 shadow-green-200' : 'border-gray-300'
    }`}>
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
          <div className={`p-2 rounded-lg ${isOn ? 'bg-green-100' : 'bg-gray-100'}`}>
            <svg className={`w-5 h-5 ${isOn ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth={1.8} strokeLinecap="round" d="M4 12h7m2 0h7" />
              <path strokeWidth={1.8} strokeLinecap="round" d={isOn ? 'M11 12l-2-2M11 12l-2 2' : 'M11 12l-3-3M11 12l-3 3'} />
              <circle cx="4" cy="12" r="1.2" strokeWidth={1.6} />
              <circle cx="20" cy="12" r="1.2" strokeWidth={1.6} />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{data.label}</div>
            <div className={`text-xs font-medium ${isOn ? 'text-green-600' : 'text-gray-500'}`}>
              {isOn ? '● 闭合' : '○ 断开'}
            </div>
          </div>
        </div>
        {isTie && (
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            母联
          </span>
        )}
      </div>
      
      {!isTie ? (
        <>
          {/* 顶部输入 */}
          <Handle
            type="target"
            position={Position.Top}
            className="!bg-blue-500 !w-4 !h-4 !border-2 !border-white"
            style={{ top: -8 }}
          />
          {/* 底部输出 */}
          <Handle
            type="source"
            position={Position.Bottom}
            className="!bg-blue-500 !w-4 !h-4 !border-2 !border-white"
            style={{ bottom: -8 }}
          />
        </>
      ) : (
        <>
          {/* 左侧双向 */}
          <Handle
            id="left-target"
            type="target"
            position={Position.Left}
            className="!bg-emerald-500 !w-4 !h-4 !border-2 !border-white"
            style={{ left: -8 }}
          />
          <Handle
            id="left-source"
            type="source"
            position={Position.Left}
            className="!bg-emerald-500 !w-4 !h-4 !border-2 !border-white"
            style={{ left: -8 }}
          />
          {/* 右侧双向 */}
          <Handle
            id="right-target"
            type="target"
            position={Position.Right}
            className="!bg-emerald-500 !w-4 !h-4 !border-2 !border-white"
            style={{ right: -8 }}
          />
          <Handle
            id="right-source"
            type="source"
            position={Position.Right}
            className="!bg-emerald-500 !w-4 !h-4 !border-2 !border-white"
            style={{ right: -8 }}
          />
        </>
      )}
    </div>
  )
})

SwitchNode.displayName = 'SwitchNode'
