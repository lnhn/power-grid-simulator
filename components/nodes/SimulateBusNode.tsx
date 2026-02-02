import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const SimulateBusNode = memo(({ data }: NodeProps) => {
  const isPowered = data.powered
  
  return (
    <div className={`bg-gradient-to-br rounded-lg shadow-lg px-6 py-3 min-w-[200px] border-2 transition-all ${
      isPowered 
        ? 'from-indigo-500 to-indigo-600 border-indigo-400 shadow-indigo-300/50' 
        : 'from-gray-400 to-gray-500 border-gray-300'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-white text-sm">{data.label}</div>
            <div className="text-xs text-white/90">
              {isPowered && <span>{data.voltage || 380}V</span>}
              {!isPowered && <span>配电母线</span>}
            </div>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-bold ${
          isPowered ? 'bg-green-400/30 text-white' : 'bg-gray-400/30 text-gray-200'
        }`}>
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isPowered ? 'bg-green-300 animate-pulse' : 'bg-gray-300'}`}></div>
            <span>{isPowered ? '带电' : '停止'}</span>
          </div>
        </div>
      </div>
      
      <Handle
        type="target"
        position={Position.Top}
        className={`!w-4 !h-4 !border-2 !border-white ${isPowered ? '!bg-yellow-400' : '!bg-gray-400'}`}
        style={{ top: -8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={`!w-4 !h-4 !border-2 !border-white ${isPowered ? '!bg-yellow-400' : '!bg-gray-400'}`}
        style={{ bottom: -8 }}
      />
      <Handle
        type="source"
        position={Position.Left}
        className={`!w-4 !h-4 !border-2 !border-white ${isPowered ? '!bg-yellow-400' : '!bg-gray-400'}`}
        style={{ left: -8 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-4 !h-4 !border-2 !border-white ${isPowered ? '!bg-yellow-400' : '!bg-gray-400'}`}
        style={{ right: -8 }}
      />
    </div>
  )
})

SimulateBusNode.displayName = 'SimulateBusNode'
