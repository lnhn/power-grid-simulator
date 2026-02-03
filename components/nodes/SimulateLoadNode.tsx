import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const SimulateLoadNode = memo(({ data, id }: NodeProps) => {
  const isPowered = data.powered
  const isRunning = data.status === 'running'
  const portStatus = data.portStatus || {}
  const topPowered = portStatus.top ?? isPowered
  const nodeState = data.nodeState
  const displayRunning = Boolean(nodeState && topPowered)
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!isPowered) {
      if (typeof data.onShowMessage === 'function') {
        data.onShowMessage('设备未通电，无法操作！请先闭合相关断路器。', 'error')
      }
      return
    }

    const newStatus = isRunning ? '停止' : '启动'
    const message =
      `设备类型: ${data.label}\n` +
      `额定功率: ${data.power || 50}kW\n` +
      `当前状态: ${isRunning ? '运行中' : '已停止'}\n` +
      `操作后: ${newStatus}`

    if (typeof data.onRequestConfirm === 'function') {
      data.onRequestConfirm({
        title: '操作确认',
        message: `确认要${newStatus}设备 "${data.label}" 吗？\n\n${message}`,
        onConfirm: () => data.onToggleLoad?.(id),
      })
    } else if (data.onToggleLoad) {
      data.onToggleLoad(id)
    }
  }
  
  const getLoadIcon = () => {
    const iconClass = "w-5 h-5 text-white"
    switch (data.subType) {
      case 'pump':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        )
      case 'fan':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'compressor':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        )
      case 'heater':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          </svg>
        )
      case 'oilPump':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'oilHeater':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          </svg>
        )
      case 'electricHeatTracing':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
      case 'expander':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )
      case 'cryogenicPump':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        )
      case 'other':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )
      default:
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )
    }
  }

  const getLoadColor = () => {
    if (!topPowered) return 'from-gray-400 to-gray-500 border-gray-300'
    if (!displayRunning) return 'from-gray-500 to-gray-600 border-gray-400'
    
    const colors: Record<string, string> = {
      pump: 'from-cyan-500 to-cyan-600 border-cyan-400 shadow-cyan-300/50',
      fan: 'from-sky-500 to-sky-600 border-sky-400 shadow-sky-300/50',
      compressor: 'from-purple-500 to-purple-600 border-purple-400 shadow-purple-300/50',
      heater: 'from-red-500 to-red-600 border-red-400 shadow-red-300/50',
      oilPump: 'from-orange-500 to-orange-600 border-orange-400 shadow-orange-300/50',
      oilHeater: 'from-rose-500 to-rose-600 border-rose-400 shadow-rose-300/50',
      electricHeatTracing: 'from-yellow-500 to-yellow-600 border-yellow-400 shadow-yellow-300/50',
      expander: 'from-teal-500 to-teal-600 border-teal-400 shadow-teal-300/50',
      cryogenicPump: 'from-blue-500 to-blue-600 border-blue-400 shadow-blue-300/50',
      other: 'from-amber-500 to-amber-600 border-amber-400 shadow-amber-300/50',
    }
    return colors[data.subType || 'pump'] || 'from-amber-500 to-amber-600 border-amber-400'
  }

  return (
    <div 
      onClick={handleClick}
      className={`bg-gradient-to-br ${getLoadColor()} rounded-lg shadow-lg px-6 py-3 min-w-[240px] border-2 transition-all duration-300 ${
        isPowered ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
      }`}
      style={{ pointerEvents: 'all' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`bg-white/20 p-2 rounded-lg relative transition-all duration-300 ${
            displayRunning ? 'animate-pulse' : ''
          }`}>
            {getLoadIcon()}
            {displayRunning && (
              <>
                <div className="absolute -inset-1 bg-white rounded-lg opacity-20 animate-ping"></div>
                <div className="absolute -inset-2 bg-white rounded-lg opacity-10 animate-pulse"></div>
              </>
            )}
          </div>
          <div>
            <div className="font-bold text-white text-sm">{data.label}</div>
            <div className="text-xs text-white/90 flex items-center space-x-2">
              <span>{data.power || 50}kW</span>
              {isPowered && (
                <>
                  <span>•</span>
                  <span>{data.voltage || 380}V</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className={`px-2 py-1 rounded-full text-xs font-bold transition-all ${
          displayRunning
            ? 'bg-green-400/40 text-white'
            : 'bg-gray-400/40 text-gray-200'
        }`}>
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded-full transition-all ${
              displayRunning ? 'bg-green-300 animate-pulse' : 'bg-gray-300'
            }`}></div>
            <span>{displayRunning ? '运行' : '停止'}</span>
          </div>
        </div>
      </div>
      
      <Handle
        type="target"
        position={Position.Top}
        className={`!w-4 !h-4 !border-2 !border-white transition-colors ${topPowered ? '!bg-yellow-400' : '!bg-gray-400'}`}
        style={{ top: -8, pointerEvents: 'none' }}
      />
    </div>
  )
})

SimulateLoadNode.displayName = 'SimulateLoadNode'
