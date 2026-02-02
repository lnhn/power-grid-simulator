import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const SwitchNode = memo(({ data }: NodeProps) => {
  const isOn = data.status === 'on'
  const isTie = data.subType === 'tie'
  
  return (
    <div className={`bg-white rounded-lg shadow-lg px-6 py-3 min-w-[200px] border-2 transition-all ${
      isOn ? 'border-green-500 shadow-green-200' : 'border-gray-300'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isOn ? 'bg-green-100' : 'bg-gray-100'}`}>
            {isOn ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
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
