'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  MarkerType,
  ConnectionMode,
  SelectionMode,
  BaseEdge,
  EdgeProps,
  EdgeLabelRenderer,
  Position,
  useReactFlow,
  ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'

interface EdgeControlData {
  controlOffsetX?: number
  controlOffsetY?: number // legacy
  sourceOffsetY?: number
  targetOffsetY?: number
  isActive?: boolean
  voltage?: number
}

type Point = { x: number; y: number }
const EDGE_STUB_LENGTH = 20
const EDGE_OFFSET_SNAP = 2
const EDGE_EPSILON = 1
const EDGE_ALIGN_TOLERANCE = 4
const EDGE_SHORT_SEGMENT_MIN = 8

const getHandleDirection = (position: Position): Point => {
  if (position === Position.Left) return { x: -1, y: 0 }
  if (position === Position.Right) return { x: 1, y: 0 }
  if (position === Position.Top) return { x: 0, y: -1 }
  return { x: 0, y: 1 }
}

const toPath = (points: Point[]) => {
  const rounded = points.map((point) => ({
    x: Math.round(point.x),
    y: Math.round(point.y),
  }))

  const normalized = rounded.filter((point, index, arr) => {
    if (index === 0) return true
    const prev = arr[index - 1]
    return Math.abs(prev.x - point.x) > EDGE_EPSILON || Math.abs(prev.y - point.y) > EDGE_EPSILON
  })
  return normalized.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

// Custom edge component
function UpdatableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  style = {},
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const { screenToFlowPosition, setEdges } = useReactFlow()
  const controlData = (data as EdgeControlData | undefined) ?? {}
  const controlOffsetX = controlData.controlOffsetX ?? 0
  const legacyOffsetY = controlData.controlOffsetY ?? 0
  const sourceOffsetY = controlData.sourceOffsetY ?? legacyOffsetY
  const targetOffsetY = controlData.targetOffsetY ?? legacyOffsetY
  const isActive = Boolean(controlData.isActive)
  const sourceDir = getHandleDirection(sourcePosition)
  const targetDir = getHandleDirection(targetPosition)
  const sourceIsVertical = sourceDir.x === 0
  const targetIsVertical = targetDir.x === 0
  const isAlignedVertical = Math.abs(sourceX - targetX) <= EDGE_ALIGN_TOLERANCE
  const isAlignedHorizontal = Math.abs(sourceY - targetY) <= EDGE_ALIGN_TOLERANCE
  const hasOffsets = Math.abs(controlOffsetX) > EDGE_EPSILON || Math.abs(sourceOffsetY) > EDGE_EPSILON || Math.abs(targetOffsetY) > EDGE_EPSILON
  const sourceStub: Point = sourceIsVertical
    ? { x: sourceX, y: sourceY + sourceDir.y * EDGE_STUB_LENGTH }
    : { x: sourceX + sourceDir.x * EDGE_STUB_LENGTH, y: sourceY }
  const targetStub: Point = targetIsVertical
    ? { x: targetX, y: targetY + targetDir.y * EDGE_STUB_LENGTH }
    : { x: targetX + targetDir.x * EDGE_STUB_LENGTH, y: targetY }
  const defaultMidX = (sourceStub.x + targetStub.x) / 2
  const defaultSourceLaneY = sourceStub.y
  const defaultTargetLaneY = targetStub.y
  let midX = defaultMidX + controlOffsetX
  let sourceLaneY = defaultSourceLaneY + sourceOffsetY
  let targetLaneY = defaultTargetLaneY + targetOffsetY

  // Avoid tiny jogs: if a segment is too short, snap the elbow onto the adjacent segment.
  if (Math.abs(midX - sourceStub.x) < EDGE_SHORT_SEGMENT_MIN) midX = sourceStub.x
  if (Math.abs(targetStub.x - midX) < EDGE_SHORT_SEGMENT_MIN) midX = targetStub.x
  if (Math.abs(sourceLaneY - sourceStub.y) < EDGE_SHORT_SEGMENT_MIN) sourceLaneY = sourceStub.y
  if (Math.abs(targetLaneY - targetStub.y) < EDGE_SHORT_SEGMENT_MIN) targetLaneY = targetStub.y
  if (Math.abs(targetLaneY - sourceLaneY) < EDGE_SHORT_SEGMENT_MIN) {
    const avgY = Math.round((sourceLaneY + targetLaneY) / 2)
    sourceLaneY = avgY
    targetLaneY = avgY
  }
  const edgePath = (isAlignedVertical || isAlignedHorizontal) && !hasOffsets
    ? toPath([
        { x: sourceX, y: sourceY },
        { x: targetX, y: targetY },
      ])
    : toPath([
        { x: sourceX, y: sourceY },
        sourceStub,
        { x: sourceStub.x, y: sourceLaneY },
        { x: midX, y: sourceLaneY },
        { x: midX, y: targetLaneY },
        { x: targetStub.x, y: targetLaneY },
        { x: targetStub.x, y: targetStub.y },
        { x: targetX, y: targetY },
      ])

  const handleSegmentPointerDown = (axis: 'x' | 'source-y' | 'target-y') => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const startFlowPoint = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const startOffsetX = controlOffsetX
    const startSourceOffsetY = sourceOffsetY
    const startTargetOffsetY = targetOffsetY

    const onPointerMove = (moveEvent: PointerEvent) => {
      const currentFlowPoint = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
      const deltaX = currentFlowPoint.x - startFlowPoint.x
      const deltaY = currentFlowPoint.y - startFlowPoint.y

      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id !== id) return edge
          const edgeData = (edge.data as EdgeControlData | undefined) ?? {}
          const nextOffsetXRaw = axis === 'x' ? startOffsetX + deltaX : startOffsetX
          const nextSourceOffsetYRaw = axis === 'source-y' ? startSourceOffsetY + deltaY : startSourceOffsetY
          const nextTargetOffsetYRaw = axis === 'target-y' ? startTargetOffsetY + deltaY : startTargetOffsetY
          const nextOffsetX =
            Math.abs(nextOffsetXRaw) < EDGE_EPSILON
              ? 0
              : Math.round(nextOffsetXRaw / EDGE_OFFSET_SNAP) * EDGE_OFFSET_SNAP
          const nextSourceOffsetY =
            Math.abs(nextSourceOffsetYRaw) < EDGE_EPSILON
              ? 0
              : Math.round(nextSourceOffsetYRaw / EDGE_OFFSET_SNAP) * EDGE_OFFSET_SNAP
          const nextTargetOffsetY =
            Math.abs(nextTargetOffsetYRaw) < EDGE_EPSILON
              ? 0
              : Math.round(nextTargetOffsetYRaw / EDGE_OFFSET_SNAP) * EDGE_OFFSET_SNAP
          return {
            ...edge,
            data: {
              ...edgeData,
              controlOffsetX: nextOffsetX,
              sourceOffsetY: nextSourceOffsetY,
              targetOffsetY: nextTargetOffsetY,
            },
          }
        })
      )
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          stroke: selected ? '#3b82f6' : '#64748b',
        }}
      />
      {(selected || isActive) && (
        <EdgeLabelRenderer>
          <>
            <div
              className="absolute nodrag nopan"
              style={{
                left: `${midX - 8}px`,
                top: `${Math.min(sourceLaneY, targetLaneY)}px`,
                width: '16px',
                height: `${Math.max(Math.abs(targetLaneY - sourceLaneY), 24)}px`,
                transform: `${Math.abs(targetLaneY - sourceLaneY) < 24 ? `translateY(${(Math.abs(targetLaneY - sourceLaneY) - 24) / 2}px)` : ''}`,
                cursor: 'ew-resize',
                pointerEvents: 'all',
                zIndex: 20,
              }}
              title="拖拽垂直段（左右移动）"
              onPointerDown={handleSegmentPointerDown('x')}
            />
            <div
              className="absolute nodrag nopan"
              style={{
                left: `${Math.min(sourceStub.x, midX)}px`,
                top: `${sourceLaneY - 8}px`,
                width: `${Math.max(Math.abs(midX - sourceStub.x), 24)}px`,
                height: '16px',
                transform: `${Math.abs(midX - sourceStub.x) < 24 ? `translateX(${(Math.abs(midX - sourceStub.x) - 24) / 2}px)` : ''}`,
                cursor: 'ns-resize',
                pointerEvents: 'all',
                zIndex: 20,
              }}
              title="拖拽上游水平段（上下移动）"
              onPointerDown={handleSegmentPointerDown('source-y')}
            />
            <div
              className="absolute nodrag nopan"
              style={{
                left: `${Math.min(midX, targetStub.x)}px`,
                top: `${targetLaneY - 8}px`,
                width: `${Math.max(Math.abs(targetStub.x - midX), 24)}px`,
                height: '16px',
                transform: `${Math.abs(targetStub.x - midX) < 24 ? `translateX(${(Math.abs(targetStub.x - midX) - 24) / 2}px)` : ''}`,
                cursor: 'ns-resize',
                pointerEvents: 'all',
                zIndex: 20,
              }}
              title="拖拽下游水平段（上下移动）"
              onPointerDown={handleSegmentPointerDown('target-y')}
            />
          </>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
import { PowerSourceNode } from '@/components/nodes/PowerSourceNode'
import { SwitchNode } from '@/components/nodes/SwitchNode'
import { LoadNode } from '@/components/nodes/LoadNode'
import { BusNode } from '@/components/nodes/BusNode'
import { TransformerNode } from '@/components/nodes/TransformerNode'
import { buildGridModels, GridSolver, NodeModel } from '@/lib/grid'
import { Toast } from '@/components/Toast'

const nodeTypes = {
  powerSource: PowerSourceNode,
  switch: SwitchNode,
  load: LoadNode,
  bus: BusNode,
  transformer: TransformerNode,
}

const edgeTypes = {
  smoothstep: UpdatableEdge,
}

type Side = 'top' | 'bottom' | 'left' | 'right'

interface GridData {
  id: string
  name: string
  description: string | null
  nodes: string
  edges: string
}

export default function EditGridPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [nodes, setNodes, baseOnNodesChange] = useNodesState([])
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState([])
  const [grid, setGrid] = useState<GridData | null>(null)
  const [gridName, setGridName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [validationCollapsed, setValidationCollapsed] = useState(false)
  const [showUnpowered, setShowUnpowered] = useState(true)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false)
  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([])
  const historyIndexRef = useRef(-1)
  const isRestoringRef = useRef(false)
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null)
  const historyTimerRef = useRef<number | null>(null)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  nodesRef.current = nodes
  edgesRef.current = edges

  const pushHistory = useCallback((nextNodes: Node[], nextEdges: Edge[]) => {
    if (isRestoringRef.current) return
    const snapshot = {
      nodes: JSON.parse(JSON.stringify(nextNodes)) as Node[],
      edges: JSON.parse(JSON.stringify(nextEdges)) as Edge[],
    }
    const stack = historyRef.current.slice(0, historyIndexRef.current + 1)
    stack.push(snapshot)
    const limit = 50
    if (stack.length > limit) {
      stack.shift()
    }
    historyRef.current = stack
    historyIndexRef.current = stack.length - 1
  }, [])

  const restoreHistory = useCallback((index: number) => {
    const stack = historyRef.current
    if (index < 0 || index >= stack.length) return
    const snapshot = stack[index]
    isRestoringRef.current = true
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)
    isRestoringRef.current = false
    historyIndexRef.current = index
  }, [setNodes, setEdges])

  const handleUndo = useCallback(() => {
    restoreHistory(historyIndexRef.current - 1)
  }, [restoreHistory])

  const handleRedo = useCallback(() => {
    restoreHistory(historyIndexRef.current + 1)
  }, [restoreHistory])

  const handleCopy = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected)
    if (selectedNodes.length === 0) return
    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id))
    const selectedEdges = edges.filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    )
    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(selectedNodes)) as Node[],
      edges: JSON.parse(JSON.stringify(selectedEdges)) as Edge[],
    }
  }, [nodes, edges])

  const handlePaste = useCallback(() => {
    if (!clipboardRef.current) return
    const { nodes: copiedNodes, edges: copiedEdges } = clipboardRef.current
    const idMap = new Map<string, string>()
    const offset = 30
    const newNodes = copiedNodes.map((node, index) => {
      const newId = `${node.id}_copy_${Date.now()}_${index}`
      idMap.set(node.id, newId)
      return {
        ...node,
        id: newId,
        position: { x: node.position.x + offset, y: node.position.y + offset },
        selected: true,
      }
    })
    const newEdges = copiedEdges.map((edge, index) => ({
      ...edge,
      id: `${edge.id}_copy_${Date.now()}_${index}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
      selected: false,
    }))
    setNodes((nds) => {
      const next = nds.map((node) => ({ ...node, selected: false })).concat(newNodes)
      pushHistory(next, edges.concat(newEdges))
      return next
    })
    setEdges((eds) => eds.concat(newEdges))
  }, [edges, pushHistory, setNodes, setEdges])

  useEffect(() => {
    if (historyIndexRef.current === -1) {
      pushHistory(nodes, edges)
    }
  }, [nodes, edges, pushHistory])

  const scheduleHistoryPush = useCallback(() => {
    if (historyTimerRef.current) {
      window.clearTimeout(historyTimerRef.current)
    }
    historyTimerRef.current = window.setTimeout(() => {
      if (isRestoringRef.current) return
      pushHistory(nodesRef.current, edgesRef.current)
    }, 250)
  }, [pushHistory])

  const inferTieHandle = useCallback((tieNode: Node | undefined, otherNode: Node | undefined, kind: 'source' | 'target') => {
    if (!tieNode || !otherNode) return undefined
    return otherNode.position.x < tieNode.position.x ? `left-${kind}` : `right-${kind}`
  }, [])

  const normalizeTieHandle = useCallback((handle: string | undefined, kind: 'source' | 'target') => {
    if (!handle) return handle
    if (kind === 'source' && handle.includes('target')) return handle.replace('target', 'source')
    if (kind === 'target' && handle.includes('source')) return handle.replace('source', 'target')
    return handle
  }, [])

  const inferSide = useCallback(
    (nodeId: string, edge: Edge, isSource: boolean, nodeMap: Map<string, Node>): Side => {
      const node = nodeMap.get(nodeId)
      const otherId = isSource ? edge.target : edge.source
      const other = nodeMap.get(otherId)

      if (node?.type === 'switch' && node?.data?.subType === 'tie') {
        if (other && other.position.x < node.position.x) return 'left'
        if (other) return 'right'
        return 'left'
      }

      const handle = isSource ? edge.sourceHandle : edge.targetHandle
      if (handle?.includes('left')) return 'left'
      if (handle?.includes('right')) return 'right'
      if (handle?.includes('top')) return 'top'
      if (handle?.includes('bottom')) return 'bottom'

      if (node?.type === 'switch') {
        if (other && other.position.y < node.position.y) return 'top'
        return 'bottom'
      }

      if (node?.type === 'powerSource') return 'bottom'
      if (node?.type === 'load') return 'top'

      if (node?.type === 'bus') {
        if (other) {
          if (other.position.x < node.position.x) return 'left'
          if (other.position.x > node.position.x) return 'right'
          if (other.position.y < node.position.y) return 'top'
        }
        return 'bottom'
      }

      return isSource ? 'bottom' : 'top'
    },
    []
  )

  const toNodeModel = useCallback((node: Node) => {
    return new NodeModel(
      node.id,
      (node.type || 'bus') as NodeModel['type'],
      {
        status: node.data?.status,
        subType: node.data?.subType,
        voltage: node.data?.voltage,
      },
      node.position
    )
  }, [])

  // 当前选中的单个节点（多选时取第一个），用于右侧属性面板
  const selectedNode = nodes.find((n) => n.selected) ?? null

  const updateSelectedNodeData = useCallback(
    (updates: Record<string, unknown>) => {
      if (!selectedNode) return
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, ...updates } }
            : n
        )
      )
    },
    [selectedNode, setNodes]
  )

  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const selectedEdgeData = ((selectedEdge?.data as EdgeControlData | undefined) ?? {})

  const updateSelectedEdgeData = useCallback(
    (updates: Partial<EdgeControlData>) => {
      if (!selectedEdge) return
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === selectedEdge.id
            ? {
                ...edge,
                data: {
                  ...((edge.data as EdgeControlData | undefined) ?? {}),
                  ...updates,
                },
              }
            : edge
        )
      )
    },
    [selectedEdge, setEdges]
  )

  const resetSelectedEdgeControlPoint = useCallback(() => {
    updateSelectedEdgeData({ controlOffsetX: 0, sourceOffsetY: 0, targetOffsetY: 0, controlOffsetY: 0 })
  }, [updateSelectedEdgeData])

  const moveSelectedEdgeControlPoint = useCallback(
    (deltaX: number, deltaY: number) => {
      if (!selectedEdge) return
      updateSelectedEdgeData({
        controlOffsetX: (selectedEdgeData.controlOffsetX ?? 0) + deltaX,
        sourceOffsetY: (selectedEdgeData.sourceOffsetY ?? selectedEdgeData.controlOffsetY ?? 0) + deltaY,
        targetOffsetY: (selectedEdgeData.targetOffsetY ?? selectedEdgeData.controlOffsetY ?? 0) + deltaY,
      })
    },
    [selectedEdge, selectedEdgeData.controlOffsetX, selectedEdgeData.controlOffsetY, selectedEdgeData.sourceOffsetY, selectedEdgeData.targetOffsetY, updateSelectedEdgeData]
  )

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setEdges((eds) =>
      eds.map((currentEdge) => ({
        ...currentEdge,
        data: {
          ...((currentEdge.data as EdgeControlData | undefined) ?? {}),
          isActive: currentEdge.id === edge.id,
        },
      }))
    )
    setSelectedEdge(edge)
  }, [setEdges])

  const onPaneClick = useCallback(() => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        data: {
          ...((edge.data as EdgeControlData | undefined) ?? {}),
          isActive: false,
        },
      }))
    )
    setSelectedEdge(null)
  }, [setEdges])

  const selectNodeById = useCallback((nodeId: string) => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: node.id === nodeId,
      }))
    )
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        selected: false,
        data: {
          ...((edge.data as EdgeControlData | undefined) ?? {}),
          isActive: false,
        },
      }))
    )
    setSelectedEdge(null)
  }, [setNodes, setEdges])

  const selectEdgeById = useCallback((edgeId: string) => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        selected: edge.id === edgeId,
        data: {
          ...((edge.data as EdgeControlData | undefined) ?? {}),
          isActive: edge.id === edgeId,
        },
      }))
    )
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: false,
      }))
    )
    const nextEdge = edges.find((edge) => edge.id === edgeId) ?? null
    setSelectedEdge(nextEdge)
  }, [setEdges, setNodes, edges])



  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'ENGINEER') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    fetchGrid()
  }, [params.id])

  useEffect(() => {
    if (!selectedEdge) return
    const latestEdge = edges.find((edge) => edge.id === selectedEdge.id) ?? null
    setSelectedEdge(latestEdge)
  }, [edges, selectedEdge])

  const validation = useMemo(() => {
    const issues: { id: string; message: string }[] = []
    if (nodes.length === 0) return issues
    const nodeMap = new Map(nodes.map((node) => [node.id, node]))
    const inputCounts = new Map<string, number>()

    edges.forEach((edge) => {
      const sourceNode = nodeMap.get(edge.source)
      const targetNode = nodeMap.get(edge.target)
      if (!sourceNode || !targetNode) return
      const sourceSide = inferSide(edge.source, edge, true, nodeMap)
      const targetSide = inferSide(edge.target, edge, false, nodeMap)
      const sourceModel = toNodeModel(sourceNode)
      const targetModel = toNodeModel(targetNode)

      if (!sourceModel.isOutputSideAllowed(sourceSide)) {
        issues.push({ id: `edge:${edge.id}:source`, message: `连线 ${edge.id} 从错误的输出端口引出` })
      }
      if (!targetModel.isInputSideAllowed(targetSide)) {
        issues.push({ id: `edge:${edge.id}:target`, message: `连线 ${edge.id} 接入了错误的输入端口` })
      }

      const multiplicitySide = targetModel.getMultiplicitySide(targetSide)
      if (multiplicitySide) {
        const key = `${targetNode.id}:${multiplicitySide}`
        const count = (inputCounts.get(key) ?? 0) + 1
        inputCounts.set(key, count)
      }
    })

    inputCounts.forEach((count, key) => {
      if (count <= 1) return
      const [nodeId] = key.split(':')
      const node = nodeMap.get(nodeId)
      if (!node) return
      const model = toNodeModel(node)
      const isTie = model.type === 'switch' && model.data.subType === 'tie'
      const isBus = model.type === 'bus'
      if (isTie || isBus) return
      issues.push({ id: `node:${nodeId}:multi`, message: `节点 ${node.data?.label || nodeId} 输入端口连接了多条线路` })
    })

    const { nodeModels, edgeModels } = buildGridModels(nodes, edges)
    const result = GridSolver.solve(nodeModels, edgeModels)

    nodes.forEach((node) => {
      if (node.type === 'powerSource') return
      const powered = result.nodePowered.get(node.id) ?? false
      if (!powered && showUnpowered) {
        issues.push({ id: `node:${node.id}:island`, message: `节点 ${node.data?.label || node.id} 未接入电源` })
      }
      if (node.type === 'load' && node.data?.status === 'running' && !powered) {
        issues.push({ id: `node:${node.id}:load`, message: `负载 ${node.data?.label || node.id} 运行但未供电` })
      }
    })

    return issues
  }, [nodes, edges, inferSide, toNodeModel, showUnpowered])

  const fetchGrid = async () => {
    try {
      const res = await fetch(`/api/grids/${params.id}`)
      const data = await res.json()
      setGrid(data)
      setGridName(data.name || '')
      
      console.log('Fetched grid data:', {
        id: data.id,
        name: data.name,
        nodesType: typeof data.nodes,
        edgesType: typeof data.edges,
        nodesLength: data.nodes?.length,
        edgesLength: data.edges?.length,
      })
      
      // 安全解析 JSON，确保返回数组
      let parsedNodes = []
      let parsedEdges = []
      
      try {
        const nodesData = typeof data.nodes === 'string' ? JSON.parse(data.nodes) : data.nodes
        parsedNodes = Array.isArray(nodesData) ? nodesData : []
        console.log('Parsed nodes:', parsedNodes.length)
      } catch (e) {
        console.error('Failed to parse nodes:', e)
        console.error('Nodes data:', data.nodes)
        parsedNodes = []
      }
      
      try {
        const edgesData = typeof data.edges === 'string' ? JSON.parse(data.edges) : data.edges
        parsedEdges = Array.isArray(edgesData)
          ? edgesData.map((edge) => {
              const edgeData = ((edge?.data as EdgeControlData | undefined) ?? {})
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
              const cleanOffsetX = Math.abs(edgeData.controlOffsetX ?? 0) < EDGE_SHORT_SEGMENT_MIN ? 0 : Math.round(edgeData.controlOffsetX ?? 0)
              const legacyOffsetY = edgeData.controlOffsetY ?? 0
              const rawSourceOffsetY = edgeData.sourceOffsetY ?? legacyOffsetY
              const rawTargetOffsetY = edgeData.targetOffsetY ?? legacyOffsetY
              const cleanSourceOffsetY = Math.abs(rawSourceOffsetY) < EDGE_SHORT_SEGMENT_MIN ? 0 : Math.round(rawSourceOffsetY)
              const cleanTargetOffsetY = Math.abs(rawTargetOffsetY) < EDGE_SHORT_SEGMENT_MIN ? 0 : Math.round(rawTargetOffsetY)
              return {
                ...edge,
                sourceHandle: inferredSourceHandle,
                targetHandle: inferredTargetHandle,
                data: {
                  ...edgeData,
                  controlOffsetX: cleanOffsetX,
                  sourceOffsetY: cleanSourceOffsetY,
                  targetOffsetY: cleanTargetOffsetY,
                  controlOffsetY: 0,
                  isActive: false,
                  voltage: edgeData.voltage ?? 380,
                },
              }
            })
          : []
        console.log('Parsed edges:', parsedEdges.length)
      } catch (e) {
        console.error('Failed to parse edges:', e)
        console.error('Edges data:', data.edges)
        parsedEdges = []
      }
      
      setNodes(parsedNodes)
      setEdges(parsedEdges)
    } catch (error) {
      console.error('Failed to fetch grid:', error)
    } finally {
      setLoading(false)
    }
  }

  const onConnect = useCallback(
    (params: Connection) => {
      const source = params.source
      const target = params.target
      if (!source || !target) return
      const sourceNode = nodes.find((n) => n.id === source)
      const targetNode = nodes.find((n) => n.id === target)
      if (!sourceNode || !targetNode) return
      const sourceIsTie = sourceNode?.type === 'switch' && sourceNode?.data?.subType === 'tie'
      const targetIsTie = targetNode?.type === 'switch' && targetNode?.data?.subType === 'tie'
      const nodeMap = new Map(nodes.map((node) => [node.id, node]))
      const sourceModel = toNodeModel(sourceNode)
      const targetModel = toNodeModel(targetNode)
      const tempEdge = {
        id: 'temp',
        source,
        target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
      } as Edge
      const targetSide = inferSide(target, tempEdge, false, nodeMap)
      const sourceSide = inferSide(source, tempEdge, true, nodeMap)
      const inputSide = targetModel.getMultiplicitySide(targetSide)

      if (!sourceModel.isOutputSideAllowed(sourceSide)) {
        setToast({ message: '连线必须从输出端口引出', type: 'error' })
        return
      }

      if (!targetModel.isInputSideAllowed(targetSide)) {
        setToast({ message: '连线必须接入输入端口', type: 'error' })
        return
      }

      if (targetModel.type !== 'switch' || targetModel.data.subType !== 'tie') {
        const existingInput = edges.some((edge) => {
          if (edge.target !== target) return false
          const edgeTargetSide = inferSide(target, edge, false, nodeMap)
          return edgeTargetSide === inputSide
        })
        if (existingInput) {
          setToast({ message: '该节点输入端口已连接一条线路', type: 'error' })
          return
        }
      }
      const edge: Edge = {
        id: `e-${source}-${target}-${Date.now()}`,
        source,
        target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type: 'smoothstep', // 曼哈顿式连线
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2, stroke: '#64748b' },
        animated: false,
        data: {
          controlOffsetX: 0,
          sourceOffsetY: 0,
          targetOffsetY: 0,
          controlOffsetY: 0,
          isActive: false,
          voltage: 380,
        } as EdgeControlData,
      }
      setEdges((eds) => {
        const next = addEdge(edge, eds)
        pushHistory(nodes, next)
        return next
      })
    },
    [setEdges, nodes, inferTieHandle]
  )

  const addNode = (type: string, subType?: string, position?: { x: number; y: number }) => {
    const id = `${type}_${Date.now()}`
    const newNode: Node = {
      id,
      type,
      position: position ?? { 
        x: 350 + Math.random() * 300, 
        y: 100 + nodes.length * 120 
      },
      data: {
        label: getNodeLabel(type, subType),
        status: type === 'switch' ? 'off' : (type === 'load' ? 'stopped' : 'normal'),
        voltage: type === 'powerSource' || type === 'transformer' ? 380 : 0,
        current: 0,
        subType: subType,
        power: type === 'load' ? getLoadPower(subType) : 0,
        ratio: type === 'transformer' ? 1 : undefined,
        capacity: type === 'transformer' ? 1000 : undefined,
        ratedCurrent: type === 'switch' ? 630 : undefined,
      },
    }
    setNodes((nds) => {
      const next = [...nds, newNode]
      pushHistory(next, edges)
      return next
    })
  }

  const getNodeLabel = (type: string, subType?: string) => {
    const labels: Record<string, string> = {
      powerSource: '三相电源',
      switch: subType === 'tie' ? '母联' : '断路器',
      bus: '母线',
      transformer: '变压器',
    }
    
    if (type === 'load') {
      const loadLabels: Record<string, string> = {
        pump: '水泵',
        fan: '风机',
        compressor: '压缩机',
        mixer: '搅拌机',
        conveyor: '传送带',
        heater: '加热器',
      }
      return loadLabels[subType || 'pump'] || '负载'
    }
    
    return labels[type] || type
  }

  const getLoadPower = (subType?: string) => {
    const powers: Record<string, number> = {
      pump: 75,
      fan: 55,
      compressor: 90,
      mixer: 45,
      conveyor: 30,
      heater: 100,
    }
    return powers[subType || 'pump'] || 50
  }

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow')
      if (!type) return
      const subType = event.dataTransfer.getData('application/reactflow-subtype') || undefined
      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds || !rfInstance) return
      const position = rfInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
      addNode(type, subType, position)
    },
    [addNode, rfInstance, reactFlowWrapper]
  )

  const handleDragStart = useCallback(
    (type: string, subType?: string) => (event: React.DragEvent) => {
      event.dataTransfer.setData('application/reactflow', type)
      if (subType) {
        event.dataTransfer.setData('application/reactflow-subtype', subType)
      }
      event.dataTransfer.effectAllowed = 'move'
    },
    []
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      // 清理节点数据，移除函数引用
      const cleanNodes = nodes.map(node => ({
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
          ratio: node.data.ratio,
          capacity: node.data.capacity,
          ratedCurrent: node.data.ratedCurrent,
        },
      }))

      const cleanEdges = edges.map(edge => {
        const sourceNode = nodes.find((n) => n.id === edge.source)
        const targetNode = nodes.find((n) => n.id === edge.target)
        const sourceIsTie = sourceNode?.type === 'switch' && sourceNode?.data?.subType === 'tie'
        const targetIsTie = targetNode?.type === 'switch' && targetNode?.data?.subType === 'tie'
        const sourceHandle = sourceIsTie
          ? (edge.sourceHandle ? normalizeTieHandle(edge.sourceHandle, 'source') : inferTieHandle(sourceNode, targetNode, 'source'))
          : edge.sourceHandle
        const targetHandle = targetIsTie
          ? (edge.targetHandle ? normalizeTieHandle(edge.targetHandle, 'target') : inferTieHandle(targetNode, sourceNode, 'target'))
          : edge.targetHandle
        return ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle,
        targetHandle,
        type: edge.type,
        markerEnd: edge.markerEnd,
        style: edge.style,
        data: edge.data,
        })
      })

      console.log('Saving nodes:', cleanNodes.length)
      console.log('Saving edges:', cleanEdges.length)

      const response = await fetch(`/api/grids/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: JSON.stringify(cleanNodes),
          edges: JSON.stringify(cleanEdges),
          name: gridName.trim() || '未命名电网',
        }),
      })

      if (response.ok) {
        const savedData = await response.json()
        console.log('Saved successfully:', savedData)
        setToast({ message: '保存成功！', type: 'success' })
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Save failed:', errorData)
        setToast({ message: '保存失败：' + (errorData.error || '未知错误'), type: 'error' })
      }
    } catch (error) {
      console.error('Failed to save grid:', error)
      setToast({ message: '保存失败：' + String(error), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const onNodesChange = useCallback(
    (changes: Parameters<typeof baseOnNodesChange>[0]) => {
      baseOnNodesChange(changes)
      if (isRestoringRef.current) return
      if (changes.some((change) => change.type !== 'select')) {
        scheduleHistoryPush()
      }
    },
    [baseOnNodesChange, scheduleHistoryPush]
  )

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof baseOnEdgesChange>[0]) => {
      baseOnEdgesChange(changes)
      if (isRestoringRef.current) return
      if (changes.some((change) => change.type !== 'select')) {
        scheduleHistoryPush()
      }
    },
    [baseOnEdgesChange, scheduleHistoryPush]
  )

  const deleteSelectedElements = useCallback(() => {
    setNodes((nds) => {
      const nextNodes = nds.filter((node) => !node.selected)
      const selectedNodeIds = new Set(nds.filter((node) => node.selected).map((node) => node.id))
      setEdges((eds) => {
        const nextEdges = eds.filter(
          (edge) => !edge.selected && !selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target)
        )
        pushHistory(nextNodes, nextEdges)
        return nextEdges
      })
      return nextNodes
    })
  }, [setNodes, setEdges])

  // 对齐功能
  const alignNodes = useCallback((direction: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') => {
    const selectedNodes = nodes.filter(node => node.selected)
    if (selectedNodes.length < 2) return

    setNodes((nds) =>
      nds.map((node) => {
        if (!node.selected) return node

        let newPosition = { ...node.position }

        switch (direction) {
          case 'left':
            newPosition.x = Math.min(...selectedNodes.map(n => n.position.x))
            break
          case 'right':
            newPosition.x = Math.max(...selectedNodes.map(n => n.position.x))
            break
          case 'top':
            newPosition.y = Math.min(...selectedNodes.map(n => n.position.y))
            break
          case 'bottom':
            newPosition.y = Math.max(...selectedNodes.map(n => n.position.y))
            break
          case 'center-h':
            const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length
            newPosition.x = avgX
            break
          case 'center-v':
            const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length
            newPosition.y = avgY
            break
        }

        return { ...node, position: newPosition }
      })
    )
  }, [nodes, setNodes])

  // 均匀分布
  const distributeNodes = useCallback((direction: 'horizontal' | 'vertical') => {
    const selectedNodes = nodes.filter(node => node.selected).sort((a, b) =>
      direction === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
    )
    if (selectedNodes.length < 3) return

    const first = selectedNodes[0]
    const last = selectedNodes[selectedNodes.length - 1]
    const totalSpace = direction === 'horizontal'
      ? last.position.x - first.position.x
      : last.position.y - first.position.y
    const gap = totalSpace / (selectedNodes.length - 1)

    setNodes((nds) =>
      nds.map((node) => {
        const index = selectedNodes.findIndex(n => n.id === node.id)
        if (index === -1 || index === 0 || index === selectedNodes.length - 1) return node

        let newPosition = { ...node.position }
        if (direction === 'horizontal') {
          newPosition.x = first.position.x + gap * index
        } else {
          newPosition.y = first.position.y + gap * index
        }

        return { ...node, position: newPosition }
      })
    )
  }, [nodes, setNodes])

  const SNAP_GRID = 15
  /** 选中节点对齐到网格 */
  const snapNodesToGrid = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected)
    if (selectedNodes.length === 0) return
    setNodes((nds) =>
      nds.map((node) => {
        if (!node.selected) return node
        const x = Math.round(node.position.x / SNAP_GRID) * SNAP_GRID
        const y = Math.round(node.position.y / SNAP_GRID) * SNAP_GRID
        return { ...node, position: { x, y } }
      })
    )
  }, [nodes, setNodes])


  /** 置于顶层 */
  const bringToFront = useCallback(() => {
    const maxZ = Math.max(0, ...nodes.map(n => (n.style?.zIndex as number) || 0))
    setNodes((nds) =>
      nds.map((node) =>
        node.selected
          ? { ...node, style: { ...node.style, zIndex: maxZ + 1 } }
          : node
      )
    )
  }, [nodes, setNodes])

  /** 置于底层 */
  const sendToBack = useCallback(() => {
    const minZ = Math.min(0, ...nodes.map(n => (n.style?.zIndex as number) ?? 0))
    setNodes((nds) =>
      nds.map((node) =>
        node.selected
          ? { ...node, style: { ...node.style, zIndex: minZ - 1 } }
          : node
      )
    )
  }, [nodes, setNodes])

  /** 水平等间距分布（固定间距，以第一个选中为基准） */
  const distributeHorizontalWithGap = useCallback((gap: number) => {
    const selectedNodes = nodes.filter(n => n.selected).sort((a, b) => a.position.x - b.position.x)
    if (selectedNodes.length < 2) return
    const firstX = selectedNodes[0].position.x
    setNodes((nds) =>
      nds.map((node) => {
        const idx = selectedNodes.findIndex(n => n.id === node.id)
        if (idx === -1) return node
        return { ...node, position: { ...node.position, x: firstX + idx * gap } }
      })
    )
  }, [nodes, setNodes])

  /** 垂直等间距分布（固定间距） */
  const distributeVerticalWithGap = useCallback((gap: number) => {
    const selectedNodes = nodes.filter(n => n.selected).sort((a, b) => a.position.y - b.position.y)
    if (selectedNodes.length < 2) return
    const firstY = selectedNodes[0].position.y
    setNodes((nds) =>
      nds.map((node) => {
        const idx = selectedNodes.findIndex(n => n.id === node.id)
        if (idx === -1) return node
        return { ...node, position: { ...node.position, y: firstY + idx * gap } }
      })
    )
  }, [nodes, setNodes])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA'].includes(tag)) return

      const isMeta = event.metaKey || event.ctrlKey
      if (isMeta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
        return
      }
      if (isMeta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        handleRedo()
        return
      }
      if (isMeta && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        handleCopy()
        return
      }
      if (isMeta && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        handlePaste()
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace')) {
        deleteSelectedElements()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelectedElements, handleUndo, handleRedo, handleCopy, handlePaste])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 顶部工具栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>返回</span>
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <input
              type="text"
              value={gridName}
              onChange={(event) => setGridName(event.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-base font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-72"
              placeholder="请输入电网名称"
            />
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
              编辑模式
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <span>{saving ? '保存中...' : '保存'}</span>
            </button>
            <button
              onClick={() => setPreviewDrawerOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg transition shadow-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553 2.276a1 1 0 010 1.789L15 16M4 6h7a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
              </svg>
              <span>预览</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧组件面板 */}
        <div className="w-72 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              电气元件库
            </h2>
            
            {/* 电源部分 */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">电源</h3>
              <ComponentButton
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                label="三相电源"
                description="380V 工业电源"
                color="blue"
                onClick={() => addNode('powerSource')}
                onDragStart={handleDragStart('powerSource')}
              />
            </div>

            {/* 开关部分 */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">控制元件</h3>
              <ComponentButton
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                }
                label="断路器"
                description="电路保护开关"
                color="green"
                onClick={() => addNode('switch')}
                onDragStart={handleDragStart('switch')}
              />

              <ComponentButton
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M6 17h12M9 7v10m6-10v10" />
                  </svg>
                }
                label="母联"
                description="双向联络开关"
                color="emerald"
                onClick={() => addNode('switch', 'tie')}
                onDragStart={handleDragStart('switch', 'tie')}
              />
              
              <ComponentButton
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                }
                label="母线"
                description="电力分配节点"
                color="indigo"
                onClick={() => addNode('bus')}
                onDragStart={handleDragStart('bus')}
              />

              <ComponentButton
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v6m0 0l3-3m-3 3L9 6m9 6a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                label="变压器"
                description="电压变换"
                color="amber"
                onClick={() => addNode('transformer')}
                onDragStart={handleDragStart('transformer')}
              />
            </div>
            
            {/* 负载部分 */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">用电设备</h3>
              
              <ComponentButton
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                }
                label="水泵"
                description="75kW 离心泵"
                color="cyan"
                onClick={() => addNode('load', 'pump')}
                onDragStart={handleDragStart('load', 'pump')}
              />
              
              <ComponentButton
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                label="风机"
                description="55kW 轴流风机"
                color="sky"
                onClick={() => addNode('load', 'fan')}
                onDragStart={handleDragStart('load', 'fan')}
              />
              
              <ComponentButton
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                }
                label="压缩机"
                description="90kW 空压机"
                color="purple"
                onClick={() => addNode('load', 'compressor')}
                onDragStart={handleDragStart('load', 'compressor')}
              />
              
              <ComponentButton
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
                label="搅拌机"
                description="45kW 混料机"
                color="pink"
                onClick={() => addNode('load', 'mixer')}
                onDragStart={handleDragStart('load', 'mixer')}
              />
              
              <ComponentButton
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                }
                label="传送带"
                description="30kW 输送机"
                color="amber"
                onClick={() => addNode('load', 'conveyor')}
                onDragStart={handleDragStart('load', 'conveyor')}
              />
              
              <ComponentButton
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                }
                label="加热器"
                description="100kW 电加热"
                color="red"
                onClick={() => addNode('load', 'heater')}
                onDragStart={handleDragStart('load', 'heater')}
              />
            </div>

            {/* 操作提示 */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">💡 操作提示</h3>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                  <p>点击元件添加到画布</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5"></div>
                  <p>拖拽节点调整位置</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5"></div>
                  <p>从输出点拖到输入点连线</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5"></div>
                  <p>Delete 键删除选中元素</p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  <strong>选择技巧：</strong><br/>
                  • 点击节点单选，Shift+点击 多选，拖拽 框选<br/>
                  • 通过拖拽放置元件到画布<br/>
                  • 选中后可 Delete 删除<br/>
                  • 使用快捷键复制/粘贴/撤销/重做
                </p>
              </div>

              <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-700">规则校验</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowUnpowered((prev) => !prev)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      {showUnpowered ? '隐藏未供电' : '显示未供电'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setValidationCollapsed((prev) => !prev)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      {validationCollapsed ? '展开' : '折叠'}
                    </button>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      validation.length === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {validation.length === 0 ? '通过' : `${validation.length} 项`}
                    </span>
                  </div>
                </div>
                {validationCollapsed ? (
                  <div className="text-xs text-gray-500">已折叠</div>
                ) : validation.length === 0 ? (
                  <div className="text-xs text-gray-500">未发现问题</div>
                ) : (
                  <ul className="space-y-1 text-xs text-red-600">
                    {validation.slice(0, 6).map((issue) => (
                      <li key={issue.id} className="flex items-start space-x-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500"></span>
                        <button
                          type="button"
                          onClick={() => {
                            if (issue.id.startsWith('edge:')) {
                              const edgeId = issue.id.split(':')[1]
                              selectEdgeById(edgeId)
                              return
                            }
                            if (issue.id.startsWith('node:')) {
                              const nodeId = issue.id.split(':')[1]
                              selectNodeById(nodeId)
                            }
                          }}
                          className="text-left hover:underline"
                        >
                          {issue.message}
                        </button>
                      </li>
                    ))}
                    {validation.length > 6 && (
                      <li className="text-[10px] text-red-500">仅显示前 6 条，请调整后再查看。</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧画布 */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: false,
              style: { strokeWidth: 2, stroke: '#64748b' },
              markerEnd: { type: MarkerType.ArrowClosed },
              data: {
                controlOffsetX: 0,
                sourceOffsetY: 0,
                targetOffsetY: 0,
                controlOffsetY: 0,
                isActive: false,
                voltage: 380,
              } as EdgeControlData,
            }}
            fitView
            snapToGrid={true}
            snapGrid={[15, 15]}
            // 启用选择功能
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            // 启用多选
            selectNodesOnDrag={true}
            panOnDrag={[1, 2]} // 中键和右键拖动画布
            selectionOnDrag={true}
            // 启用框选
            selectionMode={SelectionMode.Partial}
            className="bg-gray-50"
          >
            <Background color="#e5e7eb" gap={16} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.selected) return '#3b82f6'
                const colors: Record<string, string> = {
                  powerSource: '#3b82f6',
                  switch: '#10b981',
                  load: '#8b5cf6',
                  bus: '#6366f1',
                  transformer: '#f59e0b',
                }
                return colors[node.type || ''] || '#94a3b8'
              }}
            />
          </ReactFlow>
        </div>

        {/* 右侧属性面板：选中单个节点时显示 */}
        {selectedNode && (
          <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center justify-between">
                <span className="flex items-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  属性
                </span>
                <span className="text-xs font-normal text-gray-500">{selectedNode.type}</span>
              </h2>

              <div className="space-y-4">
                {/* 标签 - 所有类型 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">标签</label>
                  <input
                    type="text"
                    value={selectedNode.data?.label ?? ''}
                    onChange={(e) => updateSelectedNodeData({ label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="显示名称"
                  />
                </div>

                {/* 断路器：状态 */}
                {selectedNode.type === 'switch' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">状态</label>
                    <select
                      value={selectedNode.data?.status ?? 'off'}
                      onChange={(e) => updateSelectedNodeData({ status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="off">断开</option>
                      <option value="on">闭合</option>
                    </select>
                  </div>
                )}

                {selectedNode.type === 'switch' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">额定电流 (A)</label>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={selectedNode.data?.ratedCurrent ?? 630}
                      onChange={(e) => updateSelectedNodeData({ ratedCurrent: Number(e.target.value) || 630 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                )}

                {/* 负载：状态、功率、设备类型 */}
                {selectedNode.type === 'load' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">状态</label>
                      <select
                        value={selectedNode.data?.status ?? 'stopped'}
                        onChange={(e) => updateSelectedNodeData({ status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="stopped">停止</option>
                        <option value="running">运行</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">功率 (kW)</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={selectedNode.data?.power ?? 50}
                        onChange={(e) => updateSelectedNodeData({ power: Number(e.target.value) || 50 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">设备类型</label>
                      <select
                        value={selectedNode.data?.subType ?? 'pump'}
                        onChange={(e) => {
                          const subType = e.target.value as string
                          const labels: Record<string, string> = {
                            pump: '水泵',
                            fan: '风机',
                            compressor: '压缩机',
                            mixer: '搅拌机',
                            conveyor: '传送带',
                            heater: '加热器',
                          }
                          const powers: Record<string, number> = {
                            pump: 75,
                            fan: 55,
                            compressor: 90,
                            mixer: 45,
                            conveyor: 30,
                            heater: 100,
                          }
                          updateSelectedNodeData({
                            subType,
                            label: labels[subType] || selectedNode.data?.label,
                            power: powers[subType] ?? 50,
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="pump">水泵</option>
                        <option value="fan">风机</option>
                        <option value="compressor">压缩机</option>
                        <option value="mixer">搅拌机</option>
                        <option value="conveyor">传送带</option>
                        <option value="heater">加热器</option>
                      </select>
                    </div>
                  </>
                )}

                {/* 电源：电压 */}
                {selectedNode.type === 'powerSource' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">电压 (V)</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={selectedNode.data?.voltage ?? 380}
                      onChange={(e) => updateSelectedNodeData({ voltage: Number(e.target.value) || 380 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                )}

                {selectedNode.type === 'transformer' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">变压器电压 (V)</label>
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        value={selectedNode.data?.voltage ?? 380}
                        onChange={(e) => updateSelectedNodeData({ voltage: Number(e.target.value) || 380 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">变比</label>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={selectedNode.data?.ratio ?? 1}
                        onChange={(e) => updateSelectedNodeData({ ratio: Number(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">容量 (kVA)</label>
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        value={selectedNode.data?.capacity ?? 1000}
                        onChange={(e) => updateSelectedNodeData({ capacity: Number(e.target.value) || 1000 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              <p className="mt-4 text-xs text-gray-400">点击画布空白处取消选择</p>
            </div>
          </div>
        )}

        {/* 右侧连线面板：选中单条连线时显示 */}
        {!selectedNode && selectedEdge && (
          <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <h2 className="text-sm font-bold text-gray-800 mb-4">连线设置</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">段落调节说明</label>
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50">
                    直接拖线段：垂直段左右移、水平段上下移（连接点前后 20px 固定）
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">X偏移</label>
                    <input
                      type="number"
                      value={Math.round(selectedEdgeData.controlOffsetX ?? 0)}
                      onChange={(event) =>
                        updateSelectedEdgeData({ controlOffsetX: Number(event.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">上横Y偏移</label>
                    <input
                      type="number"
                      value={Math.round(selectedEdgeData.sourceOffsetY ?? selectedEdgeData.controlOffsetY ?? 0)}
                      onChange={(event) =>
                        updateSelectedEdgeData({ sourceOffsetY: Number(event.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">电压等级 (V)</label>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={Math.round(selectedEdgeData.voltage ?? 380)}
                    onChange={(event) =>
                      updateSelectedEdgeData({ voltage: Number(event.target.value) || 380 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">下横Y偏移</label>
                  <input
                    type="number"
                    value={Math.round(selectedEdgeData.targetOffsetY ?? selectedEdgeData.controlOffsetY ?? 0)}
                    onChange={(event) =>
                      updateSelectedEdgeData({ targetOffsetY: Number(event.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">快速移动（10px）</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => moveSelectedEdgeControlPoint(-10, 0)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    >
                      左移
                    </button>
                    <button
                      onClick={() => moveSelectedEdgeControlPoint(10, 0)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    >
                      右移
                    </button>
                    <button
                      onClick={() => moveSelectedEdgeControlPoint(0, -10)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    >
                      上移
                    </button>
                    <button
                      onClick={() => moveSelectedEdgeControlPoint(0, 10)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    >
                      下移
                    </button>
                  </div>
                </div>
                <button
                  onClick={resetSelectedEdgeControlPoint}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  重置编辑点
                </button>
                <p className="text-xs text-gray-500">箭头方向跟随末端固定段，保持稳定不乱跳。</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {previewDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPreviewDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[80vw] min-w-[420px] bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="text-sm font-semibold text-gray-800">模拟预览</div>
              <button
                onClick={() => setPreviewDrawerOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
                aria-label="关闭预览"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <iframe
              title="模拟预览"
              src={`/grid/${params.id}/simulate`}
              className="flex-1 w-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ComponentButton({
  icon,
  label,
  description,
  color = 'gray',
  onClick,
  onDragStart,
}: {
  icon: React.ReactNode
  label: string
  description?: string
  color?: string
  onClick: () => void
  onDragStart?: (event: React.DragEvent) => void
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 hover:bg-blue-100 border-blue-200 hover:border-blue-400 text-blue-600',
    green: 'bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-400 text-green-600',
    emerald: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 hover:border-emerald-400 text-emerald-600',
    indigo: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 hover:border-indigo-400 text-indigo-600',
    cyan: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200 hover:border-cyan-400 text-cyan-600',
    sky: 'bg-sky-50 hover:bg-sky-100 border-sky-200 hover:border-sky-400 text-sky-600',
    purple: 'bg-purple-50 hover:bg-purple-100 border-purple-200 hover:border-purple-400 text-purple-600',
    pink: 'bg-pink-50 hover:bg-pink-100 border-pink-200 hover:border-pink-400 text-pink-600',
    amber: 'bg-amber-50 hover:bg-amber-100 border-amber-200 hover:border-amber-400 text-amber-600',
    red: 'bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-400 text-red-600',
    gray: 'bg-gray-50 hover:bg-gray-100 border-gray-200 hover:border-gray-400 text-gray-600',
  }
  
  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      className={`w-full text-left px-3 py-2.5 mb-2 rounded-lg border transition-all group ${colorClasses[color]}`}
    >
      <div className="flex items-start space-x-3">
        <div className="mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {label}
          </div>
          {description && (
            <div className="text-xs text-gray-500 mt-0.5">
              {description}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
