import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const LoadNode = memo(({ data, selected }: NodeProps) => {
  const getLoadIcon = () => {
    const iconClass = 'w-5 h-5 text-white'
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
            <circle cx="9" cy="12" r="1.4" />
            <path d="M12.5 12H19m0 0v-3m0 3v3" />
            <path d="M6.5 6h5" />
          </svg>
        )
      case 'fan':
        return (
          <svg className={iconClass} {...common}>
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
            <circle cx="8" cy="14" r="2" />
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
            <circle cx="8" cy="13" r="2" />
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
    const colors: Record<string, string> = {
      pump: 'from-cyan-500 to-cyan-600 border-cyan-400',
      fan: 'from-sky-500 to-sky-600 border-sky-400',
      compressor: 'from-purple-500 to-purple-600 border-purple-400',
      heater: 'from-red-500 to-red-600 border-red-400',
      oilPump: 'from-orange-500 to-orange-600 border-orange-400',
      oilHeater: 'from-rose-500 to-rose-600 border-rose-400',
      electricHeatTracing: 'from-yellow-500 to-yellow-600 border-yellow-400',
      expander: 'from-teal-500 to-teal-600 border-teal-400',
      cryogenicPump: 'from-blue-500 to-blue-600 border-blue-400',
      other: 'from-amber-500 to-amber-600 border-amber-400',
    }
    return colors[data.subType || 'pump'] || 'from-amber-500 to-amber-600 border-amber-400'
  }

  return (
    <div className={`relative bg-gradient-to-br ${getLoadColor()} rounded-lg shadow-lg px-6 py-3 min-w-[240px] border-2`}>
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
            {getLoadIcon()}
          </div>
          <div>
            <div className="font-bold text-white text-sm">{data.label}</div>
          </div>
        </div>
      </div>
      
      {/* 只有顶部输入 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-yellow-400 !w-4 !h-4 !border-2 !border-white"
        style={{ top: -8 }}
      />
    </div>
  )
})

LoadNode.displayName = 'LoadNode'
