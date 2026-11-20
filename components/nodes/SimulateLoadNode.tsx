import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'

export const SimulateLoadNode = memo(({ data, id }: NodeProps<GridNode>) => {
  const portStatus = data.portStatus || {}
  // 统一按端口级判断：负载进线端口（top）是否带电；无端口状态时回退到节点级
  const topPowered = portStatus.top ?? Boolean(data.powered)
  const isRunning = data.status === 'running'
  const displayRunning = Boolean(data.nodeState && topPowered)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!topPowered) {
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
    const iconClass = `w-5 h-5 text-white`
    const common = {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      viewBox: '0 0 24 24',
    } as const

    switch (data.subType) {
      case 'pump':
        return (
          <svg className={iconClass} {...common}>
            <circle cx="9" cy="12" r="3.5" />
            <circle cx="9" cy="12" r="1.4" className={displayRunning ? 'animate-pulse' : ''} />
            <path d="M12.5 12H19m0 0v-3m0 3v3" />
            <path d="M6.5 6h5" />
          </svg>
        )
      case 'fan':
        return (
          <svg className={`${iconClass} ${displayRunning ? 'animate-spin' : ''}`} {...common}>
            <circle cx="12" cy="12" r="2" />
            <path d="M12 4a4 4 0 013.5 6l-3.5 2" />
            <path d="M20 12a4 4 0 01-6 3.5l-2-3.5" />
            <path d="M12 20a4 4 0 01-3.5-6l3.5-2" />
          </svg>
        )
      case 'compressor':
        return (
          <svg className={iconClass} {...common}>
            <rect x="4" y="9" width="12" height="6" rx="3" />
            <path d="M16 12h4m-2-3v6" />
            <path d="M6 7v2m6-2v2" />
          </svg>
        )
      case 'heater':
        return (
          <svg className={iconClass} {...common}>
            <path d="M12 4c2 2 3 4 3 6a3 3 0 11-6 0c0-2 1-4 3-6z" />
            <path d="M8 18h8" />
          </svg>
        )
      case 'oilPump':
        return (
          <svg className={iconClass} {...common}>
            <path d="M16 4c1 2-1 4-2 5-1-1-3-3-2-5 1-2 3-2 4 0z" />
            <rect x="4" y="10" width="8" height="8" rx="2" />
            <circle cx="8" cy="14" r="2" className={displayRunning ? 'animate-pulse' : ''} />
            <path d="M12 14h5m0 0v-3m0 3v3" />
          </svg>
        )
      case 'oilHeater':
        return (
          <svg className={iconClass} {...common}>
            <path d="M15.5 5c1.5 2 1.2 4.2-.4 6-1.6 1.8-2.1 3-2.1 5" />
            <path d="M10 6c1.2 1.6 1.1 3.2-.1 4.6-1.2 1.4-1.6 2.3-1.6 4.4" />
            <path d="M6 18h12" />
            <path d="M12 4c.8.8 1.2 1.8 1.2 2.8" />
            <path d="M16 4c1 2-1 4-2 5-1-1-3-3-2-5 1-2 3-2 4 0z" />
          </svg>
        )
      case 'electricHeatTracing':
        return (
          <svg className={iconClass} {...common}>
            <path d="M4 12c2-2 4-2 6 0s4 2 6 0 4-2 4-2" />
            <path d="M5 7v3m14-3v3" />
            <rect x="4" y="5" width="2" height="2" />
            <rect x="18" y="5" width="2" height="2" />
          </svg>
        )
      case 'expander':
        return (
          <svg className={iconClass} {...common}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
            <path d="M6 6l4 4m8-4-4 4m0 4 4 4m-8-4-4 4" />
          </svg>
        )
      case 'cryogenicPump':
        return (
          <svg className={iconClass} {...common}>
            <rect x="4" y="9" width="8" height="8" rx="2" />
            <circle cx="8" cy="13" r="2" className={displayRunning ? 'animate-pulse' : ''} />
            <path d="M12 13h5m0 0v-3m0 3v3" />
            <path d="M17 5l1.5 1.5M17 5l-1.5 1.5M17 9l1.5-1.5M17 9l-1.5-1.5" />
          </svg>
        )
      case 'other':
      default:
        return (
          <svg className={iconClass} {...common}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
            <path d="M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
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
        topPowered ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
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
            {displayRunning && data.loadKw ? (
              <div className="text-[10px] text-white/80 mt-0.5">{data.loadKw} kW</div>
            ) : null}
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
