import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const SimulateSwitchNode = memo(({ data, id }: NodeProps) => {
  const isOn = data.status === 'on'
  const isPowered = data.powered
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = isOn ? '断开' : '闭合'
    const message =
      `当前状态: ${isOn ? '闭合' : '断开'}\n` +
      `操作后: ${newStatus}`

    if (typeof data.onRequestConfirm === 'function') {
      data.onRequestConfirm({
        title: '操作确认',
        message: `确认要${newStatus}断路器 "${data.label}" 吗？\n\n${message}`,
        onConfirm: () => data.onToggle?.(id),
      })
    } else if (data.onToggle) {
      data.onToggle(id)
    }
  }
  
  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-lg shadow-lg px-6 py-3 min-w-[200px] border-2 cursor-pointer transition-all duration-300 ${
        isOn ? 'border-green-500 shadow-green-200' : 'border-red-500 shadow-red-200'
      }`}
      style={{ pointerEvents: 'all' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg transition-all duration-300 ${isOn ? 'bg-green-100' : 'bg-red-100'}`}>
            {isOn ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{data.label}</div>
            <div className={`text-xs font-bold transition-colors ${isOn ? 'text-green-600' : 'text-red-600'}`}>
              {isOn ? '● 闭合' : '○ 断开'}
            </div>
          </div>
        </div>
        
        {isPowered && isOn && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 electricity-flow"></div>
            <span className="text-xs font-medium text-blue-700">通电</span>
          </div>
        )}
      </div>
      
      <Handle
        type="target"
        position={Position.Top}
        className={`!w-4 !h-4 !border-2 !border-white transition-colors ${isPowered ? '!bg-blue-500' : '!bg-gray-400'}`}
        style={{ top: -8, pointerEvents: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={`!w-4 !h-4 !border-2 !border-white transition-colors ${isPowered && isOn ? '!bg-blue-500' : '!bg-gray-400'}`}
        style={{ bottom: -8, pointerEvents: 'none' }}
      />
    </div>
  )
})

SimulateSwitchNode.displayName = 'SimulateSwitchNode'
