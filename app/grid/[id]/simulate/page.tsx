'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { SimulatePowerSourceNode } from '@/components/nodes/SimulatePowerSourceNode'
import { SimulateSwitchNode } from '@/components/nodes/SimulateSwitchNode'
import { SimulateLoadNode } from '@/components/nodes/SimulateLoadNode'
import { SimulateBusNode } from '@/components/nodes/SimulateBusNode'
import { SimulateTransformerNode } from '@/components/nodes/SimulateTransformerNode'
import { Toast } from '@/components/Toast'
import { ConfirmModal } from '@/components/ConfirmModal'
import { buildGridModels, GridSolver, voltageToColor, inferTieHandle, normalizeTieHandle, buildNodeRuntime } from '@/lib/grid'
import type { SectionState, TieState, GridNode, GridEdge } from '@/lib/grid'
import { CheckDebouncer, evaluateChecks, previewTieToggle } from '@/lib/grid'
import type { GridCheck } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'

const nodeTypes = {
  powerSource: SimulatePowerSourceNode,
  switch: SimulateSwitchNode,
  load: SimulateLoadNode,
  bus: SimulateBusNode,
  transformer: SimulateTransformerNode,
}

// 编辑页“模拟预览”写入的草稿键，草稿模式下操作不落库
const PREVIEW_DRAFT_KEY = 'pg-preview-draft'

/** 读取 URL 上的 draft=1 标记；不依赖 useSearchParams，避免静态渲染的 Suspense 要求 */
const isDraftPreview = () => {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('draft') === '1'
}

interface GridData {
  id: string
  name: string
  description: string | null
  nodes: string
  edges: string
}


/** 运行事件（/api/grids/[id]/events 的返回形状） */
interface GridEventRow {
  id: string
  at: string
  severity: string
  code: string
  message: string
  targetId: string | null
  state: string
}

/** 回放帧：一次求解后的完整运行画面，只存在本次会话内存里 */
type ReplayFrame = {
  at: number
  label: string
  nodes: Node[]
  edges: Edge[]
  totalKw: number
  alarmCount: number
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

export default function SimulateGridPage() {
  // Next 16 中页面 params 为 Promise，客户端组件统一通过 useParams 读取
  const { id: gridId } = useParams<{ id: string }>()
  const { status } = useSession()
  const { tokens } = useSkin()
  const router = useRouter()
  const [nodes, setNodes, onNodesChange] = useNodesState<GridNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<GridEdge>([])
  const [grid, setGrid] = useState<GridData | null>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [draftMode, setDraftMode] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })
  const [summary, setSummary] = useState<{ sections: SectionState[]; ties: TieState[]; totalKw: number; checks: GridCheck[] } | null>(null)


  const [events, setEvents] = useState<GridEventRow[]>([])
  const [frames, setFrames] = useState<ReplayFrame[]>([])
  const [replayIndex, setReplayIndex] = useState<number | null>(null)
  // 故障注入：仅内存生效，不改数据库；恢复即清除
  const [faultedSources, setFaultedSources] = useState<string[]>([])
  // 总负荷采样（前端内存环形缓冲，5 秒一点，最多 60 点）
  const [trend, setTrend] = useState<{ t: number; kw: number }[]>([])
  const faultedSourcesRef = useRef<string[]>([])
  const debouncerRef = useRef<CheckDebouncer | null>(null)
  const latestChecksRef = useRef<GridCheck[]>([])
  const lastSolvedRef = useRef<{ nodes: Node[]; edges: Edge[]; totalKw: number; alarmCount: number } | null>(null)
  const latestKwRef = useRef<number>(0)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])

  // 同步最新画布到 ref，供事件回调读取；回放时暂不写回，避免"回到实时"退回历史帧
  useEffect(() => {
    if (replayIndex === null) nodesRef.current = nodes
  }, [nodes, replayIndex])
  useEffect(() => {
    if (replayIndex === null) edgesRef.current = edges
  }, [edges, replayIndex])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // 草稿预览标记（iframe 地址带 ?draft=1），仅用于展示提示；写操作另用 isDraftPreview() 实时判断
  useEffect(() => {
    setDraftMode(isDraftPreview())
  }, [])

  // 仅当电网 id 变化时拉取电网数据，避免打开操作日志时 showLogs 变化导致重新 fetchGrid 覆盖当前模拟状态
  // 会话就绪后才请求，未登录时不发起必然 401 的请求
  useEffect(() => {
    if (status === 'loading' || status === 'unauthenticated') return
    fetchGrid()
    fetchEvents()
    // 只在电网 id / 会话状态变化时加载，避免 showLogs 变化覆盖模拟中的本地状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridId, status])

  // 日志：初次打开时拉取一次，打开状态下每 5 秒刷新（不依赖 showLogs 触发 fetchGrid）
  useEffect(() => {
    if (status === 'loading' || status === 'unauthenticated') return
    fetchLogs()
    if (!showLogs) return
    const logInterval = setInterval(fetchLogs, 5000)
    return () => clearInterval(logInterval)
    // fetchLogs 为普通函数，刻意只按电网 id / 会话状态 / 面板开关变化刷新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridId, showLogs, status])

  const fetchGrid = async () => {
    try {
      let parsedNodes: Node[] = []
      let parsedEdges: Edge[] = []
      let loadedFromDraft = false

      // 草稿预览：优先读取编辑页写入 sessionStorage 的未保存画布数据
      if (isDraftPreview()) {
        try {
          const rawDraft = sessionStorage.getItem(PREVIEW_DRAFT_KEY)
          if (rawDraft) {
            const draft = JSON.parse(rawDraft) as { nodes?: unknown; edges?: unknown }
            parsedNodes = Array.isArray(draft.nodes) ? (draft.nodes as Node[]) : []
            parsedEdges = Array.isArray(draft.edges) ? (draft.edges as Edge[]) : []
            loadedFromDraft = true
          }
        } catch (e) {
          // 草稿解析失败时回退到数据库版本
          console.error('Failed to parse preview draft, falling back to saved grid:', e)
        }
      }

      if (loadedFromDraft) {
        setGrid({ id: gridId, name: '预览草稿（未保存）', description: null, nodes: '', edges: '' })
      } else {
        const res = await fetch(`/api/grids/${gridId}`)
        const data = await res.json()
        setGrid(data)

        try {
          const nodesData = typeof data.nodes === 'string' ? JSON.parse(data.nodes) : data.nodes
          parsedNodes = Array.isArray(nodesData) ? nodesData : []
        } catch (e) {
          console.error('Failed to parse nodes:', e)
          parsedNodes = []
        }

        try {
          const edgesData = typeof data.edges === 'string' ? JSON.parse(data.edges) : data.edges
          parsedEdges = Array.isArray(edgesData) ? edgesData : []
        } catch (e) {
          console.error('Failed to parse edges:', e)
          parsedEdges = []
        }
      }

      // 母联端子推断：草稿与数据库数据统一处理
      parsedEdges = parsedEdges.map((edge: Edge) => {
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
      
      // 为节点添加模拟功能（含确认弹窗与提示回调，避免在 setState 内写日志导致重复记录）
      const enhancedNodes = parsedNodes.map((node: Node) => ({
        ...node,
        data: {
          ...node.data,
          status: node.type === 'load' ? (node.data.status || 'stopped') : node.data.status,
          onToggle: node.type === 'switch' ? (nodeId: string) => handleSwitchToggle(nodeId) : undefined,
          onPreview: node.type === 'switch' ? (nodeId: string, close: boolean) => buildPreview(nodeId, close) : undefined,
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
      const res = await fetch(`/api/logs?gridId=${gridId}&pageSize=50`)
      const data = await res.json()
      // 接口返回 { logs, total, page, pageSize }，兼容旧的数组格式
      setLogs(Array.isArray(data) ? data : (Array.isArray(data.logs) ? data.logs : []))
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  }

  // 总负荷采样：5 秒一点，无操作时也能看出趋势；纯前端内存，不落库
  useEffect(() => {
    const timer = setInterval(() => {
      const debouncer = debouncerRef.current
      if (debouncer) flushEvents(debouncer.update(latestChecksRef.current, Date.now()))
      setTrend((prev) => [...prev.slice(-59), { t: Date.now(), kw: latestKwRef.current }])
    }, 5000)
    return () => clearInterval(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- flushEvents 只读 ref 与 gridId，重建定时器无意义

  /** 事件统一出口：去抖后的差分、故障注入、操作都会走这里 */
  const flushEvents = (batch: { severity: string; code: string; message: string; targetId: string | null; state: string; snapshot?: string }[]) => {
    if (batch.length === 0 || isDraftPreview()) return
    fetch(`/api/grids/${gridId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    })
      .then(() => fetchEvents())
      .catch((error) => console.error('Post grid events failed:', error))
  }

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/grids/${gridId}/events?limit=50`)
      if (!res.ok) return
      const data = await res.json()
      setEvents(Array.isArray(data.events) ? data.events : [])
    } catch (error) {
      console.error('Fetch events failed:', error)
    }
  }

  const buildPreview = (nodeId: string, close: boolean) => {
    const { nodeModels, edgeModels } = buildGridModels(nodesRef.current, edgesRef.current)
    const preview = previewTieToggle(nodeModels, edgeModels, nodeId, close)
    return preview ? preview.lines : []
  }

  const logOperation = async (action: string, targetId: string, details: string) => {
    // 草稿预览：不写操作日志
    if (isDraftPreview()) return
    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gridId: gridId,
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

  const handleSwitchToggle = (nodeId: string) => {
    if (replayIndex !== null) return
    const node = nodesRef.current.find((n) => n.id === nodeId)
    if (!node) return
    const nextStatus = node.data.status === 'on' ? 'off' : 'on'
    const device = node.data.subType === 'tie' ? '母联' : '断路器'

    // 只记录一次日志（不放在 setState 内，避免 React 双次调用导致重复记录）
    logOperation(
      nextStatus === 'on' ? 'SWITCH_ON' : 'SWITCH_OFF',
      nodeId,
      `${device} ${node.data.label} ${nextStatus === 'on' ? '闭合' : '断开'}`
    )

    const nextNodes = nodesRef.current.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, status: nextStatus, closed: nextStatus === 'on' } } : n
    )
    applyCircuitState(nextNodes, edgesRef.current)
    // 只把"人操作的那个字段"写回设计数据，运行态不落库
    void persistOperation(nodeId, { status: nextStatus, closed: nextStatus === 'on' })
  }

  const handleLoadToggle = (nodeId: string) => {
    if (replayIndex !== null) return
    const node = nodesRef.current.find((n) => n.id === nodeId)
    if (!node) return
    if (!node.data.powered) {
      // 未通电时给出可见反馈，避免点击无反应
      const message = '设备未通电，无法启动/停止'
      if (typeof node.data.onShowMessage === 'function') {
        node.data.onShowMessage(message, 'error')
      } else {
        setToast({ message, type: 'error' })
      }
      return
    }
    const nextStatus = node.data.status === 'running' ? 'stopped' : 'running'

    logOperation(
      nextStatus === 'running' ? 'LOAD_START' : 'LOAD_STOP',
      nodeId,
      `${node.data.label} ${nextStatus === 'running' ? '启动' : '停止'}`
    )

    const nextNodes = nodesRef.current.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, status: nextStatus, running: nextStatus === 'running' } } : n
    )
    applyCircuitState(nextNodes, edgesRef.current)
    pushFrame(`${node.data.label} ${nextStatus === 'running' ? '启动' : '停止'}`)
    void persistOperation(nodeId, { status: nextStatus, running: nextStatus === 'running' })
  }

  /** 单设备操作落库：只提交本字段的设计态取值 */
  const persistOperation = async (nodeId: string, patch: Record<string, unknown>) => {
    // 草稿预览：不改动已保存的电网
    if (isDraftPreview()) return
    try {
      const res = await fetch(`/api/grids/${gridId}/operate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, patch }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Persist operation failed:', err)
      }
    } catch (e) {
      console.error('Persist operation error:', e)
    }
  }

  /** 求解并把运行态叠加到视图上：节点 design 字段保持原值，只写运行态字段 */
  const applyCircuitState = (currentNodes: Node[], currentEdges: Edge[]) => {
    // 故障注入：把被注入的电源在内存里置为停运，求解结果随之变化，但设计数据不动
    const faults = faultedSourcesRef.current
    const liveNodes = faults.length === 0
      ? currentNodes
      : currentNodes.map((node) =>
          faults.includes(node.id)
            ? { ...node, data: { ...node.data, status: 'off' } }
            : node
        )
    const { nodeModels, edgeModels } = buildGridModels(liveNodes as Node[], currentEdges)
    const result = GridSolver.solve(nodeModels, edgeModels)
    const checks = evaluateChecks(nodeModels, edgeModels, result)
    const runtime = buildNodeRuntime(nodeModels, result)

    const solvedNodes = currentNodes.map((node) => {
      const view = runtime.get(node.id)
      return {
        ...node,
        data: {
          ...node.data,
          powered: view?.powered ?? false,
          nodeState: view?.nodeState ?? false,
          portStatus: view?.portStatus,
          conflict: view?.conflict ?? false,
          liveVoltage: view?.voltage ?? 0,
          sectionVoltage: view?.sectionVoltage,
          tieMode: view?.tieMode,
          loadKw: view?.loadKw ?? 0,
          sourceKw: view?.sourceKw ?? 0,
        },
      }
    })

    const solvedEdges = currentEdges.map((edge) => {
      const state = result.edgeStates.get(edge.id)
      const active = state?.active ?? false
      const flow = state?.flow ?? 'none'
      const voltage = state?.voltage ?? 0
      const conflict = state?.conflict ?? false
      const loop = state?.loop ?? false
      const amp = state?.amp ?? null
      const flowClass =
        flow === 'reverse' ? 'edge-flow-reverse' : flow === 'forward' ? 'edge-flow-forward' : ''
      const stroke = conflict ? '#ef4444' : active ? voltageToColor(voltage) : tokens.edgeIdle

      return {
        ...edge,
        animated: active,
        className: [edge.className, flowClass].filter(Boolean).join(' '),
        label: active && voltage > 0 ? voltage + 'V' + (loop ? ' · 环网' : amp === null ? ' · 并联' : amp && amp > 0 ? ' · ' + Math.round(amp) + 'A' : '') : undefined,
        labelStyle: { fontSize: 10, fill: '#334155', fontWeight: 600 },
        labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.92 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        style: {
          ...edge.style,
          stroke,
          strokeWidth: active ? 3 : 2,
          strokeDasharray: conflict ? '6 4' : (edge.style as { strokeDasharray?: string })?.strokeDasharray,
        },
        data: {
          ...edge.data,
          flow,
          voltage,
          conflict,
          loop,
          kw: state?.kw ?? 0,
          amp: state?.amp ?? null,
          shared: state?.shared ?? false,
        },
      }
    })

    setNodes(solvedNodes)
    setEdges(solvedEdges)
    setSummary({ sections: result.sections, ties: Array.from(result.ties.values()), totalKw: result.totalKw, checks })

    // 首次求解只作为基线，不把"开机就存在的既有问题"刷成一堆事件
    latestChecksRef.current = checks
    const debouncer = debouncerRef.current ?? (debouncerRef.current = new CheckDebouncer(3000))
    flushEvents(debouncer.update(checks, Date.now()))

    lastSolvedRef.current = {
      nodes: solvedNodes,
      edges: solvedEdges,
      totalKw: result.totalKw,
      alarmCount: checks.filter((check) => check.severity !== 'info').length,
    }
    setTrend((prev) => [...prev.slice(-59), { t: Date.now(), kw: result.totalKw }])

    return { nextNodes: solvedNodes, nextEdges: solvedEdges }
  }

  /** 记一帧回放画面（上限 40 帧，只留内存） */
  const pushFrame = (label: string) => {
    const snapshot = lastSolvedRef.current
    if (!snapshot) return
    setFrames((prev) => [...prev, { at: Date.now(), label, ...snapshot }].slice(-40))
  }

  /** 拖回放轴：切到历史帧的只读画面 */
  const enterFrame = (index: number | null) => {
    setReplayIndex(index)
    if (index === null) {
      applyCircuitState(nodesRef.current, edgesRef.current)
      return
    }
    const frame = frames[index]
    if (!frame) return
    setNodes(frame.nodes)
    setEdges(frame.edges)
  }

  /** 故障注入：只改内存中的运行状态并重解，不写数据库 */
  const toggleFault = (nodeId: string) => {
    if (replayIndex !== null) return
    const injected = faultedSourcesRef.current.includes(nodeId)
    const next = injected
      ? faultedSourcesRef.current.filter((id) => id !== nodeId)
      : [...faultedSourcesRef.current, nodeId]
    faultedSourcesRef.current = next
    setFaultedSources(next)
    const label = nodesRef.current.find((node) => node.id === nodeId)?.data?.label ?? nodeId
    applyCircuitState(nodesRef.current, edgesRef.current)
    pushFrame(`${label} ${injected ? '恢复供电' : '注入失电'}`)
    setToast({ message: injected ? label + ': 已恢复供电' : label + ': 已注入失电故障', type: 'success' })
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 pg-muted font-medium">加载中...</p>
        </div>
      </div>
    )
  }

  const powerSourceCount = nodes.filter(n => n.type === 'powerSource').length
  const switchCount = nodes.filter(n => n.type === 'switch').length
  const closedSwitchCount = nodes.filter(n => n.type === 'switch' && n.data.status === 'on').length
  const loadCount = nodes.filter(n => n.type === 'load').length
  const runningLoadCount = nodes.filter(n => n.type === 'load' && n.data.status === 'running' && n.data.powered).length

  const trendMax = Math.max(...trend.map((point) => point.kw), 1)
  const trendPoints = trend
    .map((point, index) => {
      const x = Math.round((index / Math.max(trend.length - 1, 1)) * 160)
      const y = Math.round(38 - (point.kw / trendMax) * 34)
      return x + ',' + y
    })
    .join(' ')

  const TIE_MODE_LABEL: Record<string, { text: string; cls: string }> = {
    sectioned: { text: '分段运行', cls: 'bg-emerald-100 text-emerald-700' },
    parallel: { text: '并列运行', cls: 'bg-blue-100 text-blue-700' },
    standby: { text: '备用', cls: 'bg-amber-100 text-amber-700' },
    unsafeParallel: { text: '危险并列', cls: 'bg-red-100 text-red-700' },
  }

  const CHECK_CLASS: Record<string, string> = {
    danger: 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700',
    warning: 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700',
    info: 'rounded-lg border pg-border bg-gray-50 px-3 py-2 text-[11px] pg-muted',
  }
  return (
    <div className="h-screen flex flex-col" style={{ background: tokens.bg }}>
      {/* 顶部导航栏 */}
      <nav className="pg-panel border-b pg-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 pg-muted hover:pg-text transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">返回</span>
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-bold pg-text">{grid?.name}</h1>
              <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold rounded-full shadow-sm">
                ● 模拟运行
              </span>
            </div>
              <button
                onClick={() => router.push('/settings')}
                className="px-4 py-2 rounded-lg font-medium border pg-border pg-text hover:bg-gray-50"
              >
                外观
              </button>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition shadow-sm ${
                  showLogs
                    ? 'bg-blue-500 text-white'
                    : 'pg-panel border pg-border pg-text hover:bg-gray-50'
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
      {/* 回放：本次会话的操作帧，只存内存，不落库 */}
      {frames.length > 0 && (
        <div className="px-6 py-2 pg-panel border-b pg-border flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium pg-text">会话回放</span>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={replayIndex ?? frames.length - 1}
            onChange={(event) => enterFrame(Number(event.target.value))}
            className="flex-1 min-w-[180px] accent-blue-500"
          />
          <span className="pg-muted tabular-nums">
            {replayIndex === null
              ? '实时 · 共 ' + frames.length + ' 帧'
              : `第 ${replayIndex + 1}/${frames.length} 帧 · ${new Date(frames[replayIndex].at).toLocaleTimeString()} · ${frames[replayIndex].label}`}
          </span>
          {replayIndex !== null && (
            <>
              <span className="text-gray-500 tabular-nums">
                {frames[replayIndex].totalKw.toFixed(1)} kW · 告警 {frames[replayIndex].alarmCount}
              </span>
              <button
                onClick={() => enterFrame(null)}
                className="px-3 py-1 rounded-md bg-blue-500 text-white font-medium hover:bg-blue-600"
              >
                回到实时
              </button>
            </>
          )}
        </div>
      )}

      {draftMode && (
        <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          预览模式：操作不会保存
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧状态面板 */}
        <div className="w-72 pg-panel border-r pg-border overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-bold pg-text mb-4 flex items-center">
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
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-amber-700 font-semibold uppercase tracking-wide">总负荷</span>
                </div>
                <div className="text-2xl font-bold text-amber-900">
                  {summary ? summary.totalKw.toFixed(0) : 0} <span className="text-sm">kW</span>
                </div>
                <div className="text-xs text-amber-700 mt-1">各段负荷合计</div>
              </div>
            </div>
            {summary && summary.checks.length > 0 && (
              <div className="mt-6 pt-6 border-t pg-border">
                <h3 className="text-sm font-bold pg-text mb-3">运行校验</h3>
                <div className="space-y-2">
                  {summary.checks.map((check, index) => (
                    <div key={index} className={CHECK_CLASS[check.severity] || CHECK_CLASS.info}>
                      {check.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary && (
              <div className="mt-6 pt-6 border-t pg-border">
                <h3 className="text-sm font-bold pg-text mb-1">总负荷趋势</h3>
                {trend.length < 2 ? (
                  <p className="text-[11px] text-gray-500">采样中，每 5 秒记录一点</p>
                ) : (
                  <svg viewBox="0 0 160 40" className="w-full h-14" preserveAspectRatio="none">
                    <polyline points={trendPoints} fill="none" stroke="#2563eb" strokeWidth="1.5" />
                  </svg>
                )}
                <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                  <span>最近 {trend.length} 点</span>
                  <span>峰值 {trendMax.toFixed(0)} kW</span>
                </div>
              </div>
            )}

            <div className="mt-6 pt-6 border-t pg-border">
              <h3 className="text-sm font-bold pg-text mb-1">故障注入</h3>
              <p className="text-[11px] text-gray-500 mb-2">仅影响当前画面，不写数据库。</p>
              <div className="space-y-2">
                {nodes.filter((node) => node.type === 'powerSource').map((node) => {
                  const injected = faultedSources.includes(node.id)
                  return (
                    <button
                      key={node.id}
                      onClick={() => toggleFault(node.id)}
                      className={"w-full flex items-center justify-between rounded-lg border px-3 py-2 text-[11px] " + (injected ? "border-red-300 bg-red-50 text-red-700" : "pg-border pg-panel pg-text")}
                    >
                      <span className="truncate">{node.data?.label ?? node.id}</span>
                      <span className="font-semibold ml-2">{injected ? '恢复供电' : '注入失电'}</span>
                    </button>
                  )
                })}
                {nodes.filter((node) => node.type === 'powerSource').length === 0 && (
                  <p className="text-xs text-gray-500">画布上没有电源</p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t pg-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold pg-text">运行事件</h3>
                <button onClick={fetchEvents} className="text-[11px] text-blue-600 hover:text-blue-800">刷新</button>
              </div>
              {events.length === 0 ? (
                <p className="text-xs text-gray-500">暂无事件。问题产生与消失都会在这里留痕。</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {events.map((event) => {
                    const cls = event.state === 'cleared'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : event.severity === 'danger'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    return (
                      <div key={event.id} className={'rounded-lg border px-3 py-2 text-[11px] ' + cls}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold">{event.state === 'cleared' ? '恢复' : '告警'}</span>
                          <span className="opacity-70">{new Date(event.at).toLocaleTimeString('zh-CN')}</span>
                        </div>
                        <p className="leading-relaxed">{event.message}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {summary && (
              <div className="mt-6 pt-6 border-t pg-border">
                <h3 className="text-sm font-bold pg-text mb-3">运行方式</h3>

                <div className="space-y-2">
                  {summary.ties.length === 0 ? (
                    <p className="text-xs text-gray-500">无母联，全网单一电气节点</p>
                  ) : (
                    summary.ties.map((tie) => {
                      const mode = TIE_MODE_LABEL[tie.mode] ?? TIE_MODE_LABEL.standby
                      const label = nodes.find((n) => n.id === tie.id)?.data?.label ?? tie.id
                      return (
                        <div key={tie.id} className="rounded-lg border pg-border bg-gray-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold pg-text">{label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${mode.cls}`}>
                              {mode.text}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] pg-muted">
                            <span>
                              左 {tie.leftVoltage ? `${tie.leftVoltage}V` : '失电'} · {tie.leftSources.length} 源
                            </span>
                            <span className="text-gray-300">|</span>
                            <span>
                              右 {tie.rightVoltage ? `${tie.rightVoltage}V` : '失电'} · {tie.rightSources.length} 源
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <h4 className="mt-4 mb-2 text-xs font-semibold pg-muted">电气分段</h4>
                <div className="space-y-2">
                  {summary.sections.map((section, index) => (
                    <div
                      key={section.id}
                      className="flex items-center justify-between rounded-lg border pg-border px-3 py-2"
                    >
                      <span className="text-[11px] pg-muted">
                        第 {index + 1} 段 · {section.busIds.length} 母线 · {section.loadCount} 台 · {section.loadKw.toFixed(0)}kW
                      </span>
                      <span className={`text-[11px] font-bold ${section.energized ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {section.energized ? `${section.voltage}V` : '失电'}
                      </span>
                    </div>
                  ))}
                  {summary.sections.length === 0 && <p className="text-xs text-gray-500">尚未布置母线</p>}
                </div>
              </div>
            )}

            <div className="mt-6 pt-6 border-t pg-border">
              <h3 className="text-sm font-semibold pg-text mb-3">💡 操作指南</h3>
              <div className="space-y-2 text-xs pg-muted">
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
            <Background color={tokens.grid} gap={20} size={1} />
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
          <div className="w-80 pg-panel border-l pg-border flex flex-col shadow-xl">
            <div className="p-4 border-b pg-border bg-gradient-to-r from-blue-500 to-blue-600">
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
                    <div key={log.id} className="bg-gray-50 rounded-lg p-3 border pg-border hover:shadow-md transition">
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
                      <p className="text-xs pg-muted mb-1">
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
