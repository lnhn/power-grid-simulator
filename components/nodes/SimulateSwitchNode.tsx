import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const SimulateSwitchNode = memo(({ data, id }: NodeProps) => {
  const isOn = data.status === 'on'
  const isPowered = data.powered
  const isTie = data.subType === 'tie'
  const portStatus = data.portStatus || {}
  const topPowered = portStatus.top ?? isPowered
  const bottomPowered = portStatus.bottom ?? isPowered
  const leftPowered = portStatus.left ?? isPowered
  const rightPowered = portStatus.right ?? isPowered
  const nodeState = data.nodeState
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = isOn ? '断开' : '闭合'
    const message =
      `当前状态: ${isOn ? '闭合' : '断开'}\n` +
      `操作后: ${newStatus}` +
      (isTie ? '\n母联为双向联络开关' : '')

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
      className={`relative bg-white rounded-lg shadow-lg px-6 py-3 min-w-[240px] border-2 cursor-pointer transition-all duration-300 ${
        isOn ? 'border-green-500 shadow-green-200' : 'border-red-500 shadow-red-200'
      }`}
      style={{ pointerEvents: 'all' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg transition-all duration-300 ${isOn ? 'bg-green-100' : 'bg-red-100'}`}>
            <svg className={`w-5 h-5 ${isOn ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth={1.8} strokeLinecap="round" d="M4 12h7m2 0h7" />
              <path strokeWidth={1.8} strokeLinecap="round" d={isOn ? 'M11 12l-2-2M11 12l-2 2' : 'M11 12l-3-3M11 12l-3 3'} />
              <circle cx="4" cy="12" r="1.2" strokeWidth={1.6} />
              <circle cx="20" cy="12" r="1.2" strokeWidth={1.6} />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{data.label}</div>
            <div className={`text-xs font-bold transition-colors ${isOn ? 'text-green-600' : 'text-red-600'}`}>
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

      {nodeState && (
        <div className="absolute top-2 right-2 flex items-center space-x-1 px-2 py-1 bg-blue-100 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 electricity-flow"></div>
          <span className="text-xs font-medium text-blue-700">闭合</span>
        </div>
      )}

      
      {!isTie ? (
        <>
          <Handle
            type="target"
            position={Position.Top}
            className={`!w-4 !h-4 !border-2 !border-white transition-colors ${topPowered ? '!bg-blue-500' : '!bg-gray-400'}`}
            style={{ top: -8, pointerEvents: 'none' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            className={`!w-4 !h-4 !border-2 !border-white transition-colors ${bottomPowered ? '!bg-blue-500' : '!bg-gray-400'}`}
            style={{ bottom: -8, pointerEvents: 'none' }}
          />
        </>
      ) : (
        <>
          <Handle
            id="left-target"
            type="target"
            position={Position.Left}
            className={`!w-4 !h-4 !border-2 !border-white transition-colors ${leftPowered ? '!bg-blue-500' : '!bg-gray-400'}`}
            style={{ left: -8, pointerEvents: 'none' }}
          />
          <Handle
            id="left-source"
            type="source"
            position={Position.Left}
            className={`!w-4 !h-4 !border-2 !border-white transition-colors ${leftPowered ? '!bg-blue-500' : '!bg-gray-400'}`}
            style={{ left: -8, pointerEvents: 'none' }}
          />
          <Handle
            id="right-target"
            type="target"
            position={Position.Right}
            className={`!w-4 !h-4 !border-2 !border-white transition-colors ${rightPowered ? '!bg-blue-500' : '!bg-gray-400'}`}
            style={{ right: -8, pointerEvents: 'none' }}
          />
          <Handle
            id="right-source"
            type="source"
            position={Position.Right}
            className={`!w-4 !h-4 !border-2 !border-white transition-colors ${rightPowered ? '!bg-blue-500' : '!bg-gray-400'}`}
            style={{ right: -8, pointerEvents: 'none' }}
          />
        </>
      )}
    </div>
  )
})

SimulateSwitchNode.displayName = 'SimulateSwitchNode'
