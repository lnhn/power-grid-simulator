import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const SimulateTransformerNode = memo(({ data }: NodeProps) => {
  const isPowered = data.powered
  const portStatus = data.portStatus || {}
  const topPowered = portStatus.top ?? isPowered
  const bottomPowered = portStatus.bottom ?? isPowered
  const nodeState = data.nodeState

  return (
    <div className={`bg-gradient-to-br rounded-lg shadow-lg px-6 py-3 min-w-[220px] border-2 transition-all ${
      isPowered
        ? 'from-orange-500 to-orange-600 border-orange-400 shadow-orange-300/50'
        : 'from-gray-400 to-gray-500 border-gray-300'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v6m0 0l3-3m-3 3L9 6m9 6a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-white text-sm">{data.label}</div>
            <div className="text-xs text-white/90">
              {isPowered ? `${data.voltage || 380}V` : '变压器'}
            </div>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-bold ${
          nodeState ? 'bg-green-400/30 text-white' : 'bg-gray-400/30 text-gray-200'
        }`}>
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded-full ${nodeState ? 'bg-green-300 animate-pulse' : 'bg-gray-300'}`}></div>
            <span>{nodeState ? '带电' : '断电'}</span>
          </div>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className={`!w-4 !h-4 !border-2 !border-white ${topPowered ? '!bg-yellow-400' : '!bg-gray-400'}`}
        style={{ top: -8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={`!w-4 !h-4 !border-2 !border-white ${bottomPowered ? '!bg-yellow-400' : '!bg-gray-400'}`}
        style={{ bottom: -8 }}
      />
    </div>
  )
})

SimulateTransformerNode.displayName = 'SimulateTransformerNode'
