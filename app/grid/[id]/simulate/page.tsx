'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { SimulatePowerSourceNode } from '@/components/nodes/SimulatePowerSourceNode'
import { SimulateSwitchNode } from '@/components/nodes/SimulateSwitchNode'
import { SimulateLoadNode } from '@/components/nodes/SimulateLoadNode'
import { SimulateBusNode } from '@/components/nodes/SimulateBusNode'
import { SimulateTransformerNode } from '@/components/nodes/SimulateTransformerNode'
import { Toast } from '@/components/Toast'
import { ConfirmModal } from '@/components/ConfirmModal'
import { buildGridModels, GridSolver, voltageToColor, inferTieHandle, normalizeTieHandle } from '@/lib/grid'

const nodeTypes = {
  powerSource: SimulatePowerSourceNode,
  switch: SimulateSwitchNode,
  load: SimulateLoadNode,
  bus: SimulateBusNode,
  transformer: SimulateTransformerNode,
}

interface GridData {
  id: string
  name: string
  description: string | null
  nodes: string
  edges: string
}

interface OperationLog {
  id: string
  timestamp: string
  action: string
  targetId: string
  user: {
    username: string
    role: string
  }
  details?: string
}

export default function SimulateGridPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [grid, setGrid] = useState<GridData | null>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  nodesRef.current = nodes
  edgesRef.current = edges

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // 仅当电网 id 变化时拉取电网数据，避免打开操作日志时 showLogs 变化导致重新 fetchGrid 覆盖当前模拟状态
  // 会话就绪后才请求，未登录时不发起必然 401 的请求
  useEffect(() => {
    if (status === 'loading' || status === 'unauthenticated') return
    fetchGrid()
  }, [params.id, status])

  // 日志：初次打开时拉取一次，打开状态下每 5 秒刷新（不依赖 showLogs 触发 fetchGrid）
  useEffect(() => {
    if (status === 'loading' || status === 'unauthenticated') return
    fetchLogs()
    if (!showLogs) return
    const logInterval = setInterval(fetchLogs, 5000)
    return () => clearInterval(logInterval)
  }, [params.id, showLogs, status])

  const fetchGrid = async () => {
    try {
      const res = await fetch(`/api/grids/${params.id}`)
      const data = await res.json()
      setGrid(data)
      
      let parsedNodes: Node[] = []
      let parsedEdges: Edge[] = []
      
      try {
        const nodesData = typeof data.nodes === 'string' ? JSON.parse(data.nodes) : data.nodes
        parsedNodes = Array.isArray(nodesData) ? nodesData : []
      } catch (e) {
        console.error('Failed to parse nodes:', e)
        parsedNodes = []
      }
      
      try {
        const edgesData = typeof data.edges === 'string' ? JSON.parse(data.edges) : data.edges
        parsedEdges = Array.isArray(edgesData)
          ? edgesData.map((edge: Edge) => {
              const sourceNode = parsedNodes.find((n: Node) => n.id === edge.source)
              const targetNode = parsedNodes.find((n: Node) => n.id === edge.target)
              const sourceIsTie = sourceNode?.type === 'switch' && sourceNode?.data?.subType === 'tie'
              const targetIsTie = targetNode?.type === 'switch' && targetNode?.data?.subType === 'tie'
              const inferredSourceHandle = sourceIsTie
                ? (edge.sourceHandle ? normalizeTieHandle(edge.sourceHandle, 'source') : inferTieHandle(sourceNode, targetNode, 'source'))
                : edge.sourceHandle
              const inferredTargetHandle = targetIsTie
                ? (edge.targetHandle ? normalizeTieHandle(edge.targetHandle, 'target') : inferTieHandle(targetNode, sourceNode, 'target'))
                : edge.targetHandle
              return {
                ...edge,
                sourceHandle: inferredSourceHandle,
                targetHandle: inferredTargetHandle,
              }
            })
          : []
      } catch (e) {
        console.error('Failed to parse edges:', e)
        parsedEdges = []
      }
      
      // 为节点添加模拟功能（含确认弹窗与提示回调，避免在 setState 内写日志导致重复记录）
      const enhancedNodes = parsedNodes.map((node: Node) => ({
        ...node,
        data: {
          ...node.data,
          status: node.type === 'load' ? (node.data.status || 'stopped') : node.data.status,
          onToggle: node.type === 'switch' ? (nodeId: string) => handleSwitchToggle(nodeId) : undefined,
          onToggleLoad: node.type === 'load' ? (nodeId: string) => handleLoadToggle(nodeId) : undefined,
          onRequestConfirm: (opts: { title: string; message: string; onConfirm: () => void }) =>
            setConfirmModal({ open: true, ...opts }),
          onShowMessage: (message: string, type: 'success' | 'error' = 'error') =>
            setToast({ message, type }),
        },
      }))
      
      setNodes(enhancedNodes)
      setEdges(parsedEdges)
      
      // 初始化电路状态（直接求解，避免 setTimeout 与 state 更新的竞态）
      applyCircuitState(enhancedNodes, parsedEdges)
    } catch (error) {
      console.error('Failed to fetch grid:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/logs?gridId=${params.id}&pageSize=50`)
      const data = await res.json()
      // 接口返回 { logs, total, page, pageSize }，兼容旧的数组格式
      setLogs(Array.isArray(data) ? data : (Array.isArray(data.logs) ? data.logs : []))
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  }

  const handleSwitchToggle = (nodeId: string) => {
    const currentNodes = nodesRef.current
    const node = currentNodes.find((n) => n.id === nodeId)
    if (!node) return
    const newStatus = node.data.status === 'on' ? 'off' : 'on'

    // 只记录一次日志（不放在 setState 内，避免 React 双次调用导致重复记录）
    logOperation(
      newStatus === 'on' ? 'SWITCH_ON' : 'SWITCH_OFF',
      nodeId,
      `断路器${newStatus === 'on' ? '闭合' : '断开'}`
    )

    const nextNodes = nodesRef.current.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, status: newStatus } } : n
    )
    // 求解后立即更新视图，再把求解结果写入数据库（不在 setState updater 内产生副作用）
    const { nextNodes: solvedNodes, nextEdges } = applyCircuitState(nextNodes, edgesRef.current)
    saveGridState(solvedNodes, nextEdges)
  }

  const handleLoadToggle = (nodeId: string) => {
    const currentNodes = nodesRef.current
    const node = currentNodes.find((n) => n.id === nodeId)
    if (!node || !node.data.powered) return
    const newStatus = node.data.status === 'running' ? 'stopped' : 'running'

    // 只记录一次日志（不放在 setState 内，避免重复记录）
    logOperation(
      newStatus === 'running' ? 'LOAD_START' : 'LOAD_STOP',
      nodeId,
      `${node.data.label} ${newStatus === 'running' ? '启动' : '停止'}`
    )

    const nextNodes = nodesRef.current.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, status: newStatus } } : n
    )
    // 求解后立即更新视图，再把求解结果写入数据库（不在 setState updater 内产生副作用）
    const { nextNodes: solvedNodes, nextEdges } = applyCircuitState(nextNodes, edgesRef.current)
    saveGridState(solvedNodes, nextEdges)
  }

  /** 将求解后的模拟状态写入数据库（节点/边仅保留可序列化字段） */
  const saveGridState = useCallback(async (currentNodes: Node[], currentEdges: Edge[]) => {
    const cleanNodes = currentNodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        label: node.data.label,
        status: node.data.status,
        voltage: node.data.voltage,
        current: node.data.current,
        subType: node.data.subType,
        power: node.data.power,
        powered: node.data.powered,
        ratio: node.data.ratio,
        capacity: node.data.capacity,
        ratedCurrent: node.data.ratedCurrent,
      },
    }))
    const cleanEdges = currentEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: edge.type,
      markerEnd: edge.markerEnd,
      style: edge.style,
      data: edge.data,
    }))
    try {
      const res = await fetch(`/api/grids/${params.id}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: JSON.stringify(cleanNodes),
          edges: JSON.stringify(cleanEdges),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Save grid state failed:', err)
      }
    } catch (e) {
      console.error('Save grid state error:', e)
    }
  }, [params.id])

  const logOperation = async (action: string, targetId: string, details: string) => {
    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gridId: params.id,
          action,
          targetId,
          details,
        }),
      })

      if (response.ok) {
        fetchLogs()
      } else {
        const error = await response.json()
        console.error('Failed to save log:', error)
      }
    } catch (error) {
      console.error('Failed to log operation:', error)
    }
  }

  /** 求解电路状态并刷新视图；返回求解后的节点与边，供调用方直接持久化 */
  const applyCircuitState = (currentNodes: Node[], currentEdges: Edge[]) => {
    const { nodeModels, edgeModels } = buildGridModels(currentNodes, currentEdges)
    const result = GridSolver.solve(nodeModels, edgeModels)

    const solvedNodes = currentNodes.map((node) => {
      const powered = result.nodePowered.get(node.id) ?? false
      const sides = ['top', 'bottom', 'left', 'right']
      const conflict = sides.some((side) => result.voltageConflict.has(`${node.id}:${side}`))
      return {
        ...node,
        data: {
          ...node.data,
          powered,
          nodeState: result.nodeState.get(node.id),
          voltage: powered ? (node.data?.voltage ?? 380) : 0,
          portStatus: result.portStatus.get(node.id),
          conflict,
        },
      }
    })

    const solvedEdges = currentEdges.map((edge) => {
      const state = result.edgeStates.get(edge.id)
      const active = state?.active ?? false
      const flow = state?.flow ?? 'none'
      const voltage = state?.voltage ?? 380
      const conflict = state?.conflict ?? false
      const loop = state?.loop ?? false
      const flowClass =
        flow === 'reverse' ? 'edge-flow-reverse' : flow === 'forward' ? 'edge-flow-forward' : ''
      const stroke = conflict ? '#ef4444' : active ? voltageToColor(voltage) : '#cbd5e1'

      return {
        ...edge,
        animated: active,
        className: [edge.className, flowClass].filter(Boolean).join(' '),
        style: {
          ...edge.style,
          stroke,
          strokeWidth: conflict ? 3 : active ? 3 : 2,
          strokeDasharray: conflict ? '6 4' : (edge.style as { strokeDasharray?: string })?.strokeDasharray,
        },
        data: {
          ...edge.data,
          flow,
          voltage,
          conflict,
          loop,
        },
      }
    })

    setNodes(solvedNodes)
    setEdges(solvedEdges)

    return { nextNodes: solvedNodes, nextEdges: solvedEdges }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">加载中...</p>
        </div>
      </div>
    )
  }

  const powerSourceCount = nodes.filter(n => n.type === 'powerSource').length
  const switchCount = nodes.filter(n => n.type === 'switch').length
  const closedSwitchCount = nodes.filter(n => n.type === 'switch' && n.data.status === 'on').length
  const loadCount = nodes.filter(n => n.type === 'load').length
  const runningLoadCount = nodes.filter(n => n.type === 'load' && n.data.status === 'running' && n.data.powered).length

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 顶部导航栏 */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">返回</span>
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-bold text-gray-900">{grid?.name}</h1>
              <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold rounded-full shadow-sm">
                ● 模拟运行
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition shadow-sm ${
                  showLogs
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>操作日志</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧状态面板 */}
        <div className="w-72 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0h6m-6 0a2 2 0 01-2-2m0-10h6" />
              </svg>
              系统状态
            </h2>
            
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-blue-700 font-semibold uppercase tracking-wide">电源</span>
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="text-2xl font-bold text-blue-900">{powerSourceCount}</div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-green-700 font-semibold uppercase tracking-wide">断路器</span>
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {closedSwitchCount} / {switchCount}
                </div>
                <div className="text-xs text-green-700 mt-1">闭合 / 总数</div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-purple-700 font-semibold uppercase tracking-wide">用电设备</span>
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {runningLoadCount} / {loadCount}
                </div>
                <div className="text-xs text-purple-700 mt-1">运行 / 总数</div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">💡 操作指南</h3>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-start space-x-2 p-2 bg-blue-50 rounded">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                  <p>点击<strong>断路器</strong>切换开关状态</p>
                </div>
                <div className="flex items-start space-x-2 p-2 bg-green-50 rounded">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                  <p>点击<strong>用电设备</strong>启动/停止</p>
                </div>
                <div className="flex items-start space-x-2 p-2 bg-purple-50 rounded">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-1"></div>
                  <p>蓝色动画线表示<strong>电流流动</strong></p>
                </div>
                <div className="flex items-start space-x-2 p-2 bg-amber-50 rounded">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-1"></div>
                  <p>所有操作都会<strong>自动记录</strong></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 中间画布 */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            fitView
            className="bg-gradient-to-br from-gray-50 to-gray-100"
          >
            <Background color="#d1d5db" gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) => {
                if (node.data.powered && node.type === 'load' && node.data.status === 'running') return '#10b981'
                if (node.data.powered) return '#3b82f6'
                return '#9ca3af'
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          </ReactFlow>
        </div>

        {/* 弹窗与提示 */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        />

        {/* 右侧操作日志面板 */}
        {showLogs && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-xl">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600">
              <h2 className="text-lg font-bold text-white flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                操作日志
              </h2>
              <p className="text-blue-100 text-xs mt-1">实时记录所有操作</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {logs.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm">暂无操作记录</p>
                </div>
              ) : (
                logs.map((log) => {
                  const isStart = log.action.includes('ON') || log.action.includes('START')
                  return (
                    <div key={log.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-2">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          isStart
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {log.details || log.action}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">
                        <strong>节点:</strong> {log.targetId}
                      </p>
                      <p className="text-xs text-gray-500">
                        <strong>操作人:</strong> {log.user.username} 
                        <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {log.user.role === 'ENGINEER' ? '工程师' : '操作员'}
                        </span>
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
