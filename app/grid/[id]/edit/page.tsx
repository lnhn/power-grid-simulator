'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import {
  ReactFlow,
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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

interface EdgeControlData {
  [key: string]: unknown
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

/** 数值输入解析：0 保持为 0；空串写 0；非数字才回退默认值，避免 `|| 默认值` 吞掉 0 */
const toNumberInput = (raw: string, fallback: number): number => {
  const trimmed = raw.trim()
  if (trimmed === '') return 0
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : fallback
}

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
          strokeWidth: selected ? 3 : (style?.strokeWidth as number) ?? 2,
          stroke: selected ? '#3b82f6' : (style?.stroke as string) ?? '#64748b',
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
import { useSkin } from '@/components/SkinProvider'
import { buildNodeRuntime, type NodeRuntimeView, type GridSolveResult } from '@/lib/grid'
import { buildGridModels, GridSolver, NodeModel, inferSide, inferTieHandle, normalizeNodeData, normalizeTieHandle, lintTopology, autoLayout, toPersistedNodes, toPersistedEdges, type GridNode, type GridEdge } from '@/lib/grid'
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

export default function EditGridPage() {
  // Next 16 中页面 params 为 Promise，客户端组件统一通过 useParams 读取
  const { id: gridId } = useParams<{ id: string }>()
  const { data: session, status } = useSession()
  const router = useRouter()
  const { tokens, mode } = useSkin()
  const [nodes, setNodes, baseOnNodesChange] = useNodesState<GridNode>([])
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState<GridEdge>([])
  const [gridName, setGridName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [validationCollapsed, setValidationCollapsed] = useState(false)
  const [showUnpowered, setShowUnpowered] = useState(true)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    open: boolean
    x: number
    y: number
    type: 'node' | 'edge' | 'pane'
    nodeId?: string
    edgeId?: string
  }>({ open: false, x: 0, y: 0, type: 'pane' })
  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([])
  const historyIndexRef = useRef(-1)
  const isRestoringRef = useRef(false)
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[]; mode: 'copy' | 'cut' } | null>(null)
  const historyTimerRef = useRef<number | null>(null)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [hasClipboard, setHasClipboard] = useState(false)
  /** 已保存的设计态快照，用来判断"有没有未保存的修改" */
  const savedSnapshotRef = useRef<string>('')
  const [dirty, setDirty] = useState(false)

  // 同步最新画布到 ref，供事件回调读取；在 effect 中写入避免渲染期变更 ref
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  const designSnapshot = useCallback(
    (n: Node[], e: Edge[]) => JSON.stringify({ nodes: toPersistedNodes(n as never), edges: toPersistedEdges(e as never) }),
    []
  )

  // 只在加载完成后比较，避免初始空画布误判为"已修改"
  useEffect(() => {
    if (!savedSnapshotRef.current) return
    setDirty(designSnapshot(nodes, edges) !== savedSnapshotRef.current)
  }, [nodes, edges, designSnapshot])

  // 有未保存修改时，关闭/刷新页面前给一次拦阻
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])


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
    setHistoryState({ canUndo: historyIndexRef.current > 0, canRedo: false })
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
    setHistoryState({ canUndo: index > 0, canRedo: index < stack.length - 1 })
  }, [setNodes, setEdges])

  const handleUndo = useCallback(() => {
    restoreHistory(historyIndexRef.current - 1)
  }, [restoreHistory])

  const handleRedo = useCallback(() => {
    restoreHistory(historyIndexRef.current + 1)
  }, [restoreHistory])

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
  }, [setNodes, setEdges, pushHistory])

  const handleCopy = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected)
    const selectedEdges = edges.filter((edge) => edge.selected)
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return
    let nodesToCopy: Node[] = []
    let edgesToCopy: Edge[] = []

    if (selectedNodes.length > 0) {
      const selectedNodeIds = new Set(selectedNodes.map((node) => node.id))
      edgesToCopy = edges.filter(
        (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
      )
      nodesToCopy = selectedNodes
    } else {
      edgesToCopy = selectedEdges
    }

    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(nodesToCopy)) as Node[],
      edges: JSON.parse(JSON.stringify(edgesToCopy)) as Edge[],
      mode: 'copy',
    }
    setHasClipboard(true)
  }, [nodes, edges])

  const handleCut = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected)
    const selectedEdges = edges.filter((edge) => edge.selected)
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return
    let nodesToCopy: Node[] = []
    let edgesToCopy: Edge[] = []

    if (selectedNodes.length > 0) {
      const selectedNodeIds = new Set(selectedNodes.map((node) => node.id))
      edgesToCopy = edges.filter(
        (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
      )
      nodesToCopy = selectedNodes
    } else {
      edgesToCopy = selectedEdges
    }

    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(nodesToCopy)) as Node[],
      edges: JSON.parse(JSON.stringify(edgesToCopy)) as Edge[],
      mode: 'cut',
    }
    setHasClipboard(true)
    deleteSelectedElements()
  }, [nodes, edges, deleteSelectedElements])

  const handlePaste = useCallback(() => {
    if (!clipboardRef.current) return
    const { nodes: copiedNodes, edges: copiedEdges, mode } = clipboardRef.current
    const idMap = new Map<string, string>()
    const offset = mode === 'copy' ? 30 : 0
    const hasNodes = copiedNodes.length > 0

    const newNodes = copiedNodes.map((node, index) => {
      const newId = mode === 'cut' ? node.id : `${node.id}_copy_${Date.now()}_${index}`
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
      id: mode === 'cut' ? edge.id : `${edge.id}_copy_${Date.now()}_${index}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
      selected: false,
    }))

    if (hasNodes) {
      setNodes((nds) => {
        const next = nds.map((node) => ({ ...node, selected: false })).concat(newNodes)
        pushHistory(next, edges.concat(newEdges))
        return next
      })
      setEdges((eds) => eds.concat(newEdges))
    } else {
      setEdges((eds) => {
        const next = eds.map((edge) => ({ ...edge, selected: false })).concat(newEdges)
        pushHistory(nodes, next)
        return next
      })
    }

    if (mode === 'cut') {
      clipboardRef.current = null
      setHasClipboard(false)
    }
  }, [edges, nodes, pushHistory, setNodes, setEdges])

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

  const toNodeModel = useCallback((node: Node) => {
    const type = (node.type || 'bus') as NodeModel['type']
    return new NodeModel(node.id, type, normalizeNodeData(type, node.data), node.position)
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

  const deleteNodeById = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const nextNodes = nds.filter((node) => node.id !== nodeId)
        setEdges((eds) => {
          const nextEdges = eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
          pushHistory(nextNodes, nextEdges)
          return nextEdges
        })
        return nextNodes
      })
    },
    [setNodes, setEdges, pushHistory]
  )

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

  const nodesWithHandlers = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onDelete: () => deleteNodeById(node.id),
        },
      })),
    [nodes, deleteNodeById]
  )

  const openContextMenu = useCallback(
    (
      event: MouseEvent | React.MouseEvent,
      type: 'node' | 'edge' | 'pane',
      target?: { nodeId?: string; edgeId?: string }
    ) => {
      event.preventDefault()
      event.stopPropagation()
      if (type === 'pane' && !clipboardRef.current) {
        return
      }
      if (type === 'node' && target?.nodeId) {
        selectNodeById(target.nodeId)
      } else if (type === 'edge' && target?.edgeId) {
        selectEdgeById(target.edgeId)
      } else {
        onPaneClick()
      }
      setContextMenu({
        open: true,
        x: event.clientX,
        y: event.clientY,
        type,
        nodeId: target?.nodeId,
        edgeId: target?.edgeId,
      })
    },
    [onPaneClick, selectEdgeById, selectNodeById]
  )

  useEffect(() => {
    if (!contextMenu.open) return
    const hasSelection = nodes.some((node) => node.selected) || edges.some((edge) => edge.selected)
    const canPaste = Boolean(clipboardRef.current)
    const hasItems = (contextMenu.type !== 'pane' && hasSelection) || canPaste
    if (!hasItems) {
      setContextMenu((prev) => ({ ...prev, open: false }))
      return
    }
    const close = () => setContextMenu((prev) => ({ ...prev, open: false }))
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
    }
  }, [contextMenu.open, contextMenu.type, nodes, edges])



  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'ENGINEER') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  // 会话就绪后才请求，未登录时不发起必然 401 的请求
  useEffect(() => {
    if (status === 'loading' || status === 'unauthenticated') return
    fetchGrid()
    // 仅在会话或电网 id 变化时加载；fetchGrid 为普通函数，刻意不入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridId, status])

  useEffect(() => {
    if (!selectedEdge) return
    const latestEdge = edges.find((edge) => edge.id === selectedEdge.id) ?? null
    setSelectedEdge(latestEdge)
  }, [edges, selectedEdge])

  // 校验为纯计算（含一次整图求解），仅在节点/连线变化后防抖执行，避免拖拽时每帧求解
  const computeValidation = useCallback(() => {
    const issues: { id: string; message: string; severity?: 'danger' | 'warning' | 'info' }[] = []
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

    const { nodeModels, edgeModels, issues: modelIssues } = buildGridModels(nodes, edges)
    modelIssues.forEach((issue) => {
      issues.push({ id: `edge:${issue.edgeId ?? issue.nodeId}:${issue.code}`, message: issue.message })
    })

    const lintIssues = lintTopology(nodeModels, edgeModels)
    lintIssues.forEach((issue) => {
      const anchor = issue.nodeIds[0] ?? issue.edgeIds[0] ?? 'grid'
      issues.push({ id: 'lint:' + issue.code + ':' + anchor, message: issue.message, severity: issue.severity })
    })

    const result = GridSolver.solve(nodeModels, edgeModels)
    // 同一份求解结果既喂校验清单，也喂画布上的运行态叠加，避免算两遍
    lastSolveRef.current = { result, runtime: buildNodeRuntime(nodeModels, result) }

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
  }, [nodes, edges, toNodeModel, showUnpowered])

  const [validation, setValidation] = useState<{ id: string; message: string; severity?: 'danger' | 'warning' | 'info' }[]>([])
  /** 运行态叠加：打开后把求解结果贴到画布上（只读，不写回设计数据） */
  const [liveMode, setLiveMode] = useState(false)
  const [snapshot, setSnapshot] = useState<{ result: GridSolveResult; runtime: Map<string, NodeRuntimeView> } | null>(null)
  const lastSolveRef = useRef<{ result: GridSolveResult; runtime: Map<string, NodeRuntimeView> } | null>(null)
  const selectedLive = selectedNode && snapshot ? snapshot.runtime.get(selectedNode.id) : undefined

  useEffect(() => {
    const timer = setTimeout(() => {
      setValidation(computeValidation())
      setSnapshot(lastSolveRef.current)
    }, 250)
    return () => clearTimeout(timer)
  }, [computeValidation])

  const fetchGrid = async () => {
    try {
      const res = await fetch(`/api/grids/${gridId}`)
      const data = await res.json()
      setGridName(data.name || '')
      
      // 安全解析 JSON，确保返回数组
      let parsedNodes = []
      let parsedEdges = []
      
      try {
        const nodesData = typeof data.nodes === 'string' ? JSON.parse(data.nodes) : data.nodes
        parsedNodes = Array.isArray(nodesData) ? nodesData : []
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
      } catch (e) {
        console.error('Failed to parse edges:', e)
        console.error('Edges data:', data.edges)
        parsedEdges = []
      }
      
      setNodes(parsedNodes)
      setEdges(parsedEdges)
      savedSnapshotRef.current = designSnapshot(parsedNodes, parsedEdges)
      setDirty(false)
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
      // 节点从 ref 读取，连线从 setEdges 的函数式更新读取，避免使用过期的 edges 快照
      const currentNodes = nodesRef.current
      const sourceNode = currentNodes.find((n) => n.id === source)
      const targetNode = currentNodes.find((n) => n.id === target)
      if (!sourceNode || !targetNode) return
      const nodeMap = new Map(currentNodes.map((node) => [node.id, node]))
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

      setEdges((eds) => {
        // 母联：只能接母线，每个端子只能接一条母线（基于最新 eds 校验）
        const tieModel = sourceModel.isTie() ? sourceModel : targetModel.isTie() ? targetModel : null
        if (tieModel) {
          const peerModel = sourceModel.isTie() ? targetModel : sourceModel
          const tieSide = sourceModel.isTie() ? sourceSide : targetSide
          if (peerModel.type !== 'bus') {
            setToast({ message: '母联只能连接母线', type: 'error' })
            return eds
          }
          const occupied = eds.some((edge) => {
            if (edge.source !== tieModel.id && edge.target !== tieModel.id) return false
            return inferSide(tieModel.id, edge, edge.source === tieModel.id, nodeMap) === tieSide
          })
          if (occupied) {
            setToast({ message: '该端子已连接一条母线，请从另一端子接入', type: 'error' })
            return eds
          }
        }

        // 母线是等电位汇流点，允许多路进线；其余节点保持一个输入端子一条线
        if (!targetModel.isTie() && targetModel.type !== 'bus') {
          const existingInput = eds.some((edge) => {
            if (edge.target !== target) return false
            const edgeTargetSide = inferSide(target, edge, false, nodeMap)
            return edgeTargetSide === inputSide
          })
          if (existingInput) {
            setToast({ message: '该节点输入端口已连接一条线路', type: 'error' })
            return eds
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
          style: { strokeWidth: 2, stroke: tokens.edgeIdle },
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
        const next = addEdge(edge, eds)
        pushHistory(currentNodes, next)
        return next
      })
    },
    [setEdges, pushHistory, toNodeModel, tokens.edgeIdle]
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
        heater: '加热器',
        oilPump: '油泵',
        oilHeater: '油加热器',
        electricHeatTracing: '电伴热',
        expander: '膨胀机',
        cryogenicPump: '低温泵',
        other: '其他用电设备',
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
      heater: 100,
      oilPump: 80,
      oilHeater: 120,
      electricHeatTracing: 40,
      expander: 150,
      cryogenicPump: 60,
      other: 50,
    }
    return powers[subType || 'pump'] || 50
  }

  const renderLoadPaletteIcon = (subType: string) => {
    const iconClass = 'w-5 h-5'
    const common = {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      viewBox: '0 0 24 24',
    } as const

    switch (subType) {
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

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/reactflow')
    if (!type) return
    const subType = event.dataTransfer.getData('application/reactflow-subtype') || undefined
    const bounds = reactFlowWrapper.current?.getBoundingClientRect()
    if (!bounds || !rfInstance) return
    const position = rfInstance.screenToFlowPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
    addNode(type, subType, position)
  }

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

  /** 一键整理：只改坐标，不动拓扑；整理后自动 fitView，让整张图落在视野里 */
  const handleAutoLayout = () => {
    const layout = autoLayout(nodes, edges)
    const nextNodes = nodes.map((node) => {
      const position = layout.get(node.id)
      return position ? { ...node, position } : node
    })
    // 整理也算一步可撤销的操作，避免手滑后没法退回
    pushHistory(nextNodes, edges)
    setNodes(nextNodes)
    window.requestAnimationFrame(() => {
      rfInstance?.fitView({ padding: 0.18, duration: 400 })
    })
    setToast({ message: '已按电气层级重排：电源在上、母线居中、负荷在下', type: 'success' })
  }

  const handleSave = async () => {
    // 结构性问题（悬空线、母联单侧、电源无出线）先拦住，避免把画错的图存成"正式图"
    const blocking = computeValidation().filter((item) => item.severity === 'danger')
    if (blocking.length > 0) {
      setToast({ message: '有 ' + blocking.length + ' 项必须修复：' + blocking[0].message, type: 'error' })
      return
    }
    setSaving(true)
    try {
      // 用统一的持久化投影：只剥运行态，保留 ratedVoltage / inService / closed / running 等设计参数
      const cleanNodes = toPersistedNodes(nodes as never)
      const cleanEdges = toPersistedEdges(edges as never)

      const response = await fetch(`/api/grids/${gridId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: JSON.stringify(cleanNodes),
          edges: JSON.stringify(cleanEdges),
          name: gridName.trim() || '未命名电网',
        }),
      })

      if (response.ok) {
        savedSnapshotRef.current = designSnapshot(nodes, edges)
        setDirty(false)
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
      if (Array.from(changes).some((change) => change.type !== 'select')) {
        scheduleHistoryPush()
      }
    },
    [baseOnNodesChange, scheduleHistoryPush]
  )

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof baseOnEdgesChange>[0]) => {
      baseOnEdgesChange(changes)
      if (isRestoringRef.current) return
      if (Array.from(changes).some((change) => change.type !== 'select')) {
        scheduleHistoryPush()
      }
    },
    [baseOnEdgesChange, scheduleHistoryPush]
  )


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
      if (isMeta && event.key.toLowerCase() === 'x') {
        event.preventDefault()
        handleCut()
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
  }, [deleteSelectedElements, handleUndo, handleRedo, handleCopy, handleCut, handlePaste])

  // 运行态下的节点：把运行视图挂到 data.live，节点卡片自己决定描边与角标
  const nodesForCanvas = useMemo(() => {
    if (!liveMode || !snapshot) return nodesWithHandlers
    return nodesWithHandlers.map((node) => ({
      ...node,
      data: { ...node.data, live: snapshot.runtime.get(node.id) ?? { powered: false, voltage: 0 } },
    }))
  }, [liveMode, snapshot, nodesWithHandlers])

  // 运行态下的连线：带电走实线绿，失电走灰虚线；环网并联另标
  const edgesForCanvas = useMemo(() => {
    if (!liveMode || !snapshot) return edges
    return edges.map((edge) => {
      const state = snapshot.result.edgeStates.get(edge.id)
      const active = state?.active ?? false
      return {
        ...edge,
        animated: active,
        style: {
          ...edge.style,
          stroke: state?.conflict ? '#dc2626' : active ? '#16a34a' : '#94a3b8',
          strokeWidth: active ? 2.5 : 1.5,
          strokeDasharray: active ? undefined : '6 4',
          opacity: active ? 1 : 0.7,
        },
      }
    })
  }, [liveMode, snapshot, edges])

  // 母联方式摘要（并列 / 分段 / 备用）
  const tieSummary = useMemo(() => {
    if (!snapshot) return ''
    const list = Array.from(snapshot.result.ties.values())
    if (list.length === 0) return '无母联'
    const label: Record<string, string> = { parallel: '并列', unsafeParallel: '危险并列', sectioned: '分段', standby: '备用' }
    return list.map((tie) => label[tie.mode] ?? tie.mode).join(' / ')
  }, [snapshot])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pg-surface">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 pg-muted">加载中...</p>
        </div>
      </div>
    )
  }

  const blockingCount = validation.filter((item) => item.severity === 'danger').length

  return (
    <div className="h-screen flex flex-col" style={{ background: tokens.bg }}>
      {/* 顶部工具栏 */}
      <div className="pg-panel border-b pg-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center space-x-2 pg-muted hover:pg-text"
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
              className="px-3 py-1.5 border pg-border rounded-lg text-base font-semibold pg-text pg-panel focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-72"
              placeholder="请输入电网名称"
            />
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
              编辑模式
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <button
                onClick={handleUndo}
                disabled={!historyState.canUndo}
                title="撤销 (Ctrl+Z)"
                className="px-2 py-2 text-sm rounded-lg border pg-border pg-text hover:bg-[var(--pg-surface)] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l-4-4 4-4M5 10h9a6 6 0 010 12H9" />
                </svg>
              </button>
              <button
                onClick={handleRedo}
                disabled={!historyState.canRedo}
                title="重做 (Ctrl+Shift+Z)"
                className="px-2 py-2 text-sm rounded-lg border pg-border pg-text hover:bg-[var(--pg-surface)] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 14l4-4-4-4M19 10H10a6 6 0 000 12h5" />
                </svg>
              </button>
            </div>
            <div className="h-6 w-px bg-gray-300" />
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopy}
                className="px-3 py-2 text-sm rounded-lg border pg-border pg-text hover:bg-[var(--pg-surface)] transition"
              >
                复制
              </button>
              <button
                onClick={handleCut}
                className="px-3 py-2 text-sm rounded-lg border pg-border pg-text hover:bg-[var(--pg-surface)] transition"
              >
                剪切
              </button>
              <button
                onClick={handlePaste}
                className="px-3 py-2 text-sm rounded-lg border pg-border pg-text hover:bg-[var(--pg-surface)] transition"
              >
                粘贴
              </button>
              <button
                onClick={deleteSelectedElements}
                className="px-3 py-2 text-sm rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition"
              >
                删除
              </button>
            </div>
            <button
              onClick={handleAutoLayout}
              className="px-3 py-2 text-sm rounded-lg border pg-border pg-text hover:bg-[var(--pg-surface)] transition"
            >
              一键整理
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <span className="flex items-center space-x-1.5">
                {dirty && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b' }} title="有未保存的修改" />}
                <span>{saving ? '保存中...' : '保存'}</span>
              </span>
            </button>
            <button
              onClick={() => setLiveMode((prev) => !prev)}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg transition shadow-md"
              style={
                liveMode
                  ? { background: '#16a34a', color: '#ffffff' }
                  : { background: 'var(--pg-panel-muted)', color: 'var(--pg-text)', border: '1px solid var(--pg-panel-border)' }
              }
              title="把求解结果直接叠到画布上：带电绿、失电灰、冲突红"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>{liveMode ? '退出运行态' : '运行态'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧组件面板 */}
        <div className="w-72 pg-panel border-r pg-border overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-bold pg-text mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              电气元件库
            </h2>
            
            {/* 电源部分 */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold pg-muted uppercase tracking-wider mb-3">电源</h3>
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
              <h3 className="text-xs font-semibold pg-muted uppercase tracking-wider mb-3">控制元件</h3>
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
                    <path strokeWidth={1.8} strokeLinecap="round" d="M4 12h7m2 0h7" />
                    <path strokeWidth={1.8} strokeLinecap="round" d="M11 12l-2-2M11 12l-2 2" />
                    <circle cx="4" cy="12" r="1.2" strokeWidth={1.6} />
                    <circle cx="20" cy="12" r="1.2" strokeWidth={1.6} />
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
                    <rect x="3" y="6" width="6" height="12" rx="2" strokeWidth={1.8} />
                    <rect x="15" y="6" width="6" height="12" rx="2" strokeWidth={1.8} />
                    <path strokeWidth={1.8} strokeLinecap="round" d="M9 9h6M9 12h6M9 15h6" />
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
              <h3 className="text-xs font-semibold pg-muted uppercase tracking-wider mb-3">用电设备</h3>
              
              <ComponentButton
                icon={renderLoadPaletteIcon('pump')}
                label="水泵"
                description="75kW 离心泵"
                color="cyan"
                onClick={() => addNode('load', 'pump')}
                onDragStart={handleDragStart('load', 'pump')}
              />
              
              <ComponentButton
                icon={renderLoadPaletteIcon('fan')}
                label="风机"
                description="55kW 轴流风机"
                color="sky"
                onClick={() => addNode('load', 'fan')}
                onDragStart={handleDragStart('load', 'fan')}
              />
              
              <ComponentButton
                icon={renderLoadPaletteIcon('compressor')}
                label="压缩机"
                description="90kW 空压机"
                color="purple"
                onClick={() => addNode('load', 'compressor')}
                onDragStart={handleDragStart('load', 'compressor')}
              />
              
              <ComponentButton
                icon={renderLoadPaletteIcon('heater')}
                label="加热器"
                description="100kW 电加热"
                color="red"
                onClick={() => addNode('load', 'heater')}
                onDragStart={handleDragStart('load', 'heater')}
              />
              
              <ComponentButton
                icon={renderLoadPaletteIcon('oilPump')}
                label="油泵"
                description="80kW 油路泵"
                color="orange"
                onClick={() => addNode('load', 'oilPump')}
                onDragStart={handleDragStart('load', 'oilPump')}
              />
              
              <ComponentButton
                icon={renderLoadPaletteIcon('oilHeater')}
                label="油加热器"
                description="120kW 油加热"
                color="rose"
                onClick={() => addNode('load', 'oilHeater')}
                onDragStart={handleDragStart('load', 'oilHeater')}
              />
              
              <ComponentButton
                icon={renderLoadPaletteIcon('electricHeatTracing')}
                label="电伴热"
                description="40kW 伴热"
                color="yellow"
                onClick={() => addNode('load', 'electricHeatTracing')}
                onDragStart={handleDragStart('load', 'electricHeatTracing')}
              />
              
              <ComponentButton
                icon={renderLoadPaletteIcon('expander')}
                label="膨胀机"
                description="150kW 膨胀"
                color="teal"
                onClick={() => addNode('load', 'expander')}
                onDragStart={handleDragStart('load', 'expander')}
              />
              
              <ComponentButton
                icon={renderLoadPaletteIcon('cryogenicPump')}
                label="低温泵"
                description="60kW 低温泵"
                color="blue"
                onClick={() => addNode('load', 'cryogenicPump')}
                onDragStart={handleDragStart('load', 'cryogenicPump')}
              />
              
              <ComponentButton
                icon={renderLoadPaletteIcon('other')}
                label="其他用电设备"
                description="50kW 其他"
                color="amber"
                onClick={() => addNode('load', 'other')}
                onDragStart={handleDragStart('load', 'other')}
              />
            </div>

            {/* 操作提示 */}
            <div className="mt-6 pt-6 border-t pg-border">
              <h3 className="text-sm font-semibold pg-text mb-3">💡 操作提示</h3>
              <div className="space-y-2 text-xs pg-muted">
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

              <div className="mt-4 p-3 pg-panel rounded-lg border pg-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold pg-text">规则校验</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowUnpowered((prev) => !prev)}
                      className="text-[10px] px-2 py-0.5 rounded-full border pg-border pg-muted hover:bg-[var(--pg-surface)]"
                    >
                      {showUnpowered ? '隐藏未供电' : '显示未供电'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setValidationCollapsed((prev) => !prev)}
                      className="text-[10px] px-2 py-0.5 rounded-full border pg-border pg-muted hover:bg-[var(--pg-surface)]"
                    >
                      {validationCollapsed ? '展开' : '折叠'}
                    </button>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      blockingCount > 0 ? 'bg-red-100 text-red-700' : validation.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {validation.length === 0 ? '通过' : blockingCount > 0 ? `${blockingCount} 项必须修复` : `${validation.length} 项提示`}
                    </span>
                  </div>
                </div>
                {validationCollapsed ? (
                  <div className="text-xs pg-muted">已折叠</div>
                ) : validation.length === 0 ? (
                  <div className="text-xs pg-muted">未发现问题</div>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {validation.slice(0, 6).map((issue) => {
                      const dot = issue.severity === 'danger' ? 'bg-red-500' : issue.severity === 'info' ? 'bg-blue-400' : 'bg-amber-400'
                      const tone = issue.severity === 'danger' ? 'text-red-600' : issue.severity === 'info' ? 'text-blue-600' : 'text-amber-700'
                      return (
                      <li key={issue.id} className={'flex items-start space-x-2 ' + tone}>
                        <span className={'mt-1 h-1.5 w-1.5 rounded-full ' + dot}></span>
                        <button
                          type="button"
                          onClick={() => {
                            if (issue.id.startsWith('lint:')) {
                              selectNodeById(issue.id.split(':')[2])
                              return
                            }
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
                      )
                    })}
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
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodesForCanvas}
            edges={edgesForCanvas}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onNodeContextMenu={(event, node) => openContextMenu(event, 'node', { nodeId: node.id })}
            onEdgeContextMenu={(event, edge) => openContextMenu(event, 'edge', { edgeId: edge.id })}
            onPaneContextMenu={(event) => openContextMenu(event, 'pane')}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: false,
              style: { strokeWidth: 2, stroke: tokens.edgeIdle },
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
            nodesDraggable={!liveMode}
            nodesConnectable={!liveMode}
            elementsSelectable={true}
            // 启用多选
            selectNodesOnDrag={true}
            panOnDrag={[1, 2]} // 中键和右键拖动画布
            selectionOnDrag={true}
            // 启用框选
            selectionMode={SelectionMode.Partial}
            className="pg-canvas"
            style={{ background: `radial-gradient(1100px 620px at 18% -8%, ${tokens.accentSoft} 0%, transparent 58%), ${tokens.bg}` }}
          >
            <Background id="minor" color={tokens.grid} gap={20} size={1} />
            <Background id="major" color={tokens.border} gap={100} size={2} />
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
              maskColor={mode === 'dark' ? 'rgba(11,18,32,0.55)' : 'rgba(241,245,249,0.55)'}
            />
          </ReactFlow>

          {liveMode && snapshot && (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-full shadow-lg text-xs"
              style={{ background: 'var(--pg-panel)', border: '1px solid var(--pg-panel-border)', color: 'var(--pg-text)' }}
            >
              <span className="flex items-center gap-1.5 font-semibold" style={{ color: '#16a34a' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: '#16a34a' }} />
                运行态
              </span>
              <span className="pg-muted">总负荷 {Math.round(snapshot.result.totalKw)} kW</span>
              <span className="pg-muted">分段 {snapshot.result.sections.length}</span>
              <span className="pg-muted">母联 {tieSummary}</span>
              <span className="pg-muted">绿色流动=带电 · 灰色虚线=失电</span>
            </div>
          )}
        </div>

        {/* 右侧属性面板：选中单个节点时显示 */}
        {selectedNode && (
          <div className="w-72 pg-panel border-l pg-border overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <h2 className="text-sm font-bold pg-text mb-4 flex items-center justify-between">
                <span className="flex items-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  属性
                </span>
                <span className="text-xs font-normal pg-muted">{selectedNode.type}</span>
              </h2>

              <div className="space-y-4">
                {/* 标签 - 所有类型 */}
                <div>
                  <label className="block text-xs font-medium pg-muted mb-1.5">标签</label>
                  <input
                    type="text"
                    value={selectedNode.data?.label ?? ''}
                    onChange={(e) => updateSelectedNodeData({ label: e.target.value })}
                    className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="显示名称"
                  />
                </div>

                {/* 母线：电压等级（决定该段母线的运行电位） */}
                {selectedNode.type === 'bus' && (
                  <div>
                    <label className="block text-xs font-medium pg-muted mb-1.5">电压等级 (V)</label>
                    <input
                      type="number"
                      min={1}
                      max={35000}
                      value={selectedNode.data?.voltage || 380}
                      onChange={(e) => updateSelectedNodeData({ voltage: toNumberInput(e.target.value, 380) })}
                      className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                )}

                {/* 开关：类型（断路器 / 母联） */}
                {selectedNode.type === 'switch' && (
                  <div>
                    <label className="block text-xs font-medium pg-muted mb-1.5">类型</label>
                    <select
                      value={selectedNode.data?.subType === 'tie' ? 'tie' : 'breaker'}
                      onChange={(e) => {
                        const subType = e.target.value
                        updateSelectedNodeData({ subType })
                      }}
                      className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="breaker">断路器</option>
                      <option value="tie">母联</option>
                    </select>
                    {selectedNode.data?.subType === 'tie' && (
                      <p className="mt-1 text-[10px] pg-muted">母联只有左右两个端子，必须分别接到两段不同的母线。</p>
                    )}
                  </div>
                )}

                {/* 断路器：状态 */}
                {selectedNode.type === 'switch' && (
                  <div>
                    <label className="block text-xs font-medium pg-muted mb-1.5">状态</label>
                    <select
                      value={selectedNode.data?.status ?? 'off'}
                      onChange={(e) => updateSelectedNodeData({ status: e.target.value })}
                      className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="off">断开</option>
                      <option value="on">闭合</option>
                    </select>
                  </div>
                )}

                {selectedNode.type === 'switch' && (
                  <div>
                    <label className="block text-xs font-medium pg-muted mb-1.5">额定电流 (A)</label>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={selectedNode.data?.ratedCurrent ?? 630}
                      onChange={(e) => updateSelectedNodeData({ ratedCurrent: toNumberInput(e.target.value, 630) })}
                      className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                )}

                {/* 负载：状态、功率、设备类型 */}
                {selectedNode.type === 'load' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium pg-muted mb-1.5">状态</label>
                      <select
                        value={selectedNode.data?.status ?? 'stopped'}
                        onChange={(e) => updateSelectedNodeData({ status: e.target.value })}
                        className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="stopped">停止</option>
                        <option value="running">运行</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium pg-muted mb-1.5">功率 (kW)</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={selectedNode.data?.power ?? 50}
                        onChange={(e) => updateSelectedNodeData({ power: toNumberInput(e.target.value, 50) })}
                        className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium pg-muted mb-1.5">设备类型</label>
                      <select
                        value={selectedNode.data?.subType ?? 'pump'}
                        onChange={(e) => {
                          const subType = e.target.value as string
                          const labels: Record<string, string> = {
                            pump: '水泵',
                            fan: '风机',
                            compressor: '压缩机',
                            heater: '加热器',
                            oilPump: '油泵',
                            oilHeater: '油加热器',
                            electricHeatTracing: '电伴热',
                            expander: '膨胀机',
                            cryogenicPump: '低温泵',
                            other: '其他用电设备',
                          }
                          const powers: Record<string, number> = {
                            pump: 75,
                            fan: 55,
                            compressor: 90,
                            heater: 100,
                            oilPump: 80,
                            oilHeater: 120,
                            electricHeatTracing: 40,
                            expander: 150,
                            cryogenicPump: 60,
                            other: 50,
                          }
                          updateSelectedNodeData({
                            subType,
                            label: labels[subType] || selectedNode.data?.label,
                            power: powers[subType] ?? 50,
                          })
                        }}
                        className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="pump">水泵</option>
                        <option value="fan">风机</option>
                        <option value="compressor">压缩机</option>
                        <option value="heater">加热器</option>
                        <option value="oilPump">油泵</option>
                        <option value="oilHeater">油加热器</option>
                        <option value="electricHeatTracing">电伴热</option>
                        <option value="expander">膨胀机</option>
                        <option value="cryogenicPump">低温泵</option>
                        <option value="other">其他用电设备</option>
                      </select>
                    </div>
                  </>
                )}

                {/* 电源：电压 / 类型 / 投运 */}
                {selectedNode.type === 'powerSource' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium pg-muted mb-1.5">电压 (V)</label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={selectedNode.data?.voltage || 380}
                        onChange={(e) => updateSelectedNodeData({ voltage: toNumberInput(e.target.value, 380) })}
                        className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium pg-muted mb-1.5">电源类型</label>
                      <select
                        value={selectedNode.data?.kind ?? 'grid'}
                        onChange={(e) => updateSelectedNodeData({ kind: e.target.value })}
                        className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="grid">市电接入</option>
                        <option value="generator">发电机</option>
                        <option value="ups">UPS</option>
                      </select>
                    </div>
                    <label className="flex items-center space-x-2 text-xs pg-text">
                      <input
                        type="checkbox"
                        checked={selectedNode.data?.inService !== false}
                        onChange={(e) => updateSelectedNodeData({ inService: e.target.checked })}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span>投运（取消勾选视为检修停用）</span>
                    </label>
                  </>
                )}

                {selectedNode.type === 'transformer' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium pg-muted mb-1.5">变压器电压 (V)</label>
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        value={selectedNode.data?.voltage || 380}
                        onChange={(e) => updateSelectedNodeData({ voltage: toNumberInput(e.target.value, 380) })}
                        className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium pg-muted mb-1.5">变比</label>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={selectedNode.data?.ratio ?? 1}
                        onChange={(e) => updateSelectedNodeData({ ratio: toNumberInput(e.target.value, 1) })}
                        className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium pg-muted mb-1.5">容量 (kVA)</label>
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        value={selectedNode.data?.capacity ?? 1000}
                        onChange={(e) => updateSelectedNodeData({ capacity: toNumberInput(e.target.value, 1000) })}
                        className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              {liveMode && selectedLive && (
                <div className="mt-4 pt-4 border-t pg-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold pg-text">运行态</span>
                    <span className="text-[10px] pg-muted">
                      {selectedLive.powered ? '带电' : '失电'}
                    </span>
                  </div>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <dt className="pg-muted">运行电压</dt>
                      <dd className="pg-text font-semibold">{Math.round(selectedLive.voltage)} V</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="pg-muted">端子带电</dt>
                      <dd className="pg-text font-semibold">
                        {Object.values(selectedLive.portStatus).filter(Boolean).length} / 4
                      </dd>
                    </div>
                    {selectedLive.sectionVoltage !== undefined && (
                      <div className="flex justify-between">
                        <dt className="pg-muted">所在分段</dt>
                        <dd className="pg-text font-semibold">{Math.round(selectedLive.sectionVoltage)} V</dd>
                      </div>
                    )}
                    {selectedNode.type === 'load' && (
                      <div className="flex justify-between">
                        <dt className="pg-muted">实际负荷</dt>
                        <dd className="pg-text font-semibold">{Math.round(selectedLive.loadKw ?? 0)} kW</dd>
                      </div>
                    )}
                    {selectedNode.type === 'powerSource' && (
                      <div className="flex justify-between">
                        <dt className="pg-muted">当前出力</dt>
                        <dd className="pg-text font-semibold">{Math.round(selectedLive.sourceKw ?? 0)} kW</dd>
                      </div>
                    )}
                    {selectedLive.tieMode && (
                      <div className="flex justify-between">
                        <dt className="pg-muted">母联方式</dt>
                        <dd className="pg-text font-semibold">
                          {selectedLive.tieMode === 'parallel' ? '并列' : selectedLive.tieMode === 'unsafeParallel' ? '危险并列' : selectedLive.tieMode === 'sectioned' ? '分段' : '备用'}
                        </dd>
                      </div>
                    )}
                    {selectedLive.conflict && (
                      <div className="flex justify-between">
                        <dt className="pg-muted">提示</dt>
                        <dd className="font-semibold" style={{ color: '#dc2626' }}>电位冲突</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              <p className="mt-4 text-xs pg-muted">点击画布空白处取消选择</p>
            </div>
          </div>
        )}

        {/* 右侧连线面板：选中单条连线时显示 */}
        {!selectedNode && selectedEdge && (
          <div className="w-72 pg-panel border-l pg-border overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <h2 className="text-sm font-bold pg-text mb-4">连线设置</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium pg-muted mb-1.5">段落调节说明</label>
                  <div className="w-full px-3 py-2 border pg-border rounded-lg text-sm pg-text pg-surface">
                    直接拖线段：垂直段左右移、水平段上下移（连接点前后 20px 固定）
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium pg-muted mb-1.5">X偏移</label>
                    <input
                      type="number"
                      value={Math.round(selectedEdgeData.controlOffsetX ?? 0)}
                      onChange={(event) =>
                        updateSelectedEdgeData({ controlOffsetX: toNumberInput(event.target.value, 0) })
                      }
                      className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium pg-muted mb-1.5">上横Y偏移</label>
                    <input
                      type="number"
                      value={Math.round(selectedEdgeData.sourceOffsetY ?? selectedEdgeData.controlOffsetY ?? 0)}
                      onChange={(event) =>
                        updateSelectedEdgeData({ sourceOffsetY: toNumberInput(event.target.value, 0) })
                      }
                      className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium pg-muted mb-1.5">电压等级 (V)</label>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={Math.round(selectedEdgeData.voltage ?? 380)}
                    onChange={(event) =>
                      updateSelectedEdgeData({ voltage: toNumberInput(event.target.value, 380) })
                    }
                    className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium pg-muted mb-1.5">下横Y偏移</label>
                  <input
                    type="number"
                    value={Math.round(selectedEdgeData.targetOffsetY ?? selectedEdgeData.controlOffsetY ?? 0)}
                    onChange={(event) =>
                      updateSelectedEdgeData({ targetOffsetY: toNumberInput(event.target.value, 0) })
                    }
                    className="w-full px-3 py-2 border pg-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium pg-muted mb-1.5">快速移动（10px）</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => moveSelectedEdgeControlPoint(-10, 0)}
                      className="px-3 py-2 text-sm border pg-border rounded-lg hover:bg-[var(--pg-surface)] transition"
                    >
                      左移
                    </button>
                    <button
                      onClick={() => moveSelectedEdgeControlPoint(10, 0)}
                      className="px-3 py-2 text-sm border pg-border rounded-lg hover:bg-[var(--pg-surface)] transition"
                    >
                      右移
                    </button>
                    <button
                      onClick={() => moveSelectedEdgeControlPoint(0, -10)}
                      className="px-3 py-2 text-sm border pg-border rounded-lg hover:bg-[var(--pg-surface)] transition"
                    >
                      上移
                    </button>
                    <button
                      onClick={() => moveSelectedEdgeControlPoint(0, 10)}
                      className="px-3 py-2 text-sm border pg-border rounded-lg hover:bg-[var(--pg-surface)] transition"
                    >
                      下移
                    </button>
                  </div>
                </div>
                <button
                  onClick={resetSelectedEdgeControlPoint}
                  className="w-full px-3 py-2 text-sm border pg-border rounded-lg hover:bg-[var(--pg-surface)] transition"
                >
                  重置编辑点
                </button>
                <p className="text-xs pg-muted">箭头方向跟随末端固定段，保持稳定不乱跳。</p>
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

      {contextMenu.open && (
        <div
          className="fixed z-[200] min-w-[160px] rounded-lg border pg-border pg-panel shadow-lg overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {contextMenu.type !== 'pane' && (nodes.some((node) => node.selected) || edges.some((edge) => edge.selected)) && (
            <>
              <button
                onClick={() => { handleCopy(); setContextMenu((prev) => ({ ...prev, open: false })) }}
                className="w-full text-left px-4 py-2 text-sm pg-text hover:bg-[var(--pg-surface)]"
              >复制</button>
              <button
                onClick={() => { handleCut(); setContextMenu((prev) => ({ ...prev, open: false })) }}
                className="w-full text-left px-4 py-2 text-sm pg-text hover:bg-[var(--pg-surface)]"
              >剪切</button>
            </>
          )}
          {hasClipboard && (
            <button
              onClick={() => { handlePaste(); setContextMenu((prev) => ({ ...prev, open: false })) }}
              className="w-full text-left px-4 py-2 text-sm pg-text hover:bg-[var(--pg-surface)]"
            >粘贴</button>
          )}
          {contextMenu.type !== 'pane' && (nodes.some((node) => node.selected) || edges.some((edge) => edge.selected)) && (
            <button
              onClick={() => { deleteSelectedElements(); setContextMenu((prev) => ({ ...prev, open: false })) }}
              className="w-full text-left px-4 py-2 text-sm pg-text hover:bg-[var(--pg-surface)]"
            >删除</button>
          )}
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
  // 皮肤化：底色/描边走面板变量，颜色只留在图标与悬停描边上
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600', emerald: 'text-emerald-600',
    indigo: 'text-indigo-600', cyan: 'text-cyan-600', sky: 'text-sky-600',
    purple: 'text-purple-600', pink: 'text-pink-600', amber: 'text-amber-600',
    red: 'text-red-600', orange: 'text-orange-600', rose: 'text-rose-600',
    yellow: 'text-yellow-600', teal: 'text-teal-600', gray: 'pg-muted',
  }
  
  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      className={`pg-chip w-full text-left px-3 py-2.5 mb-2 transition-all group ${colorClasses[color]}`}
    >
      <div className="flex items-start space-x-3">
        <div className="mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold pg-text truncate">
            {label}
          </div>
          {description && (
            <div className="text-xs pg-muted mt-0.5">
              {description}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
