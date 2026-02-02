import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export const SimulatePowerSourceNode = memo(({ data }: NodeProps) => {
  const isPowered = data.powered !== false
  
  return (
    <div className={`bg-gradient-to-br rounded-lg shadow-lg px-6 py-3 min-w-[200px] border-2 transition-all ${
      isPowered 
        ? 'from-blue-500 to-blue-600 border-blue-400 shadow-blue-300/50' 
        : 'from-gray-400 to-gray-500 border-gray-300'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg relative">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {isPowered && (
              <div className="absolute -inset-1 bg-yellow-400 rounded-lg opacity-30 animate-ping"></div>
            )}
          </div>
          <div>
            <div className="font-bold text-white text-sm">{data.label}</div>
            <div className="text-xs text-white/90 font-medium">
              {data.voltage || 380}V AC
            </div>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-bold ${
          isPowered ? 'bg-green-400/30 text-white' : 'bg-gray-400/30 text-gray-200'
        }`}>
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isPowered ? 'bg-green-300 animate-pulse' : 'bg-gray-300'}`}></div>
            <span>{isPowered ? '运行' : '停止'}</span>
          </div>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className={`!w-4 !h-4 !border-2 !border-white ${isPowered ? '!bg-yellow-400' : '!bg-gray-400'}`}
        style={{ bottom: -8 }}
      />
    </div>
  )
})

SimulatePowerSourceNode.displayName = 'SimulatePowerSourceNode'
