/**
 * 数据迁移脚本（幂等，可反复执行）
 *
 * 背景：项目从"单租户 + 画布直接存运行态"演进到"多租户 + 设计态/运行态分离"。
 * 老库里可能残留两类脏数据：
 *   1) tenantId 为空（多租户改造之前建的电网/账号）；
 *   2) PowerGrid.nodes/edges 里混进了运行态字段（powered / portStatus / loadKw ...）
 *      以及当次渲染产生的 label / style 描边，这些本该由求解器每次重算，不该入库。
 *
 * 用法：
 *   npx tsx scripts/migrate-data.ts            # 只体检，不写库
 *   npx tsx scripts/migrate-data.ts --apply    # 实际写库
 */
import { PrismaClient } from '@prisma/client'
import { toPersistedEdges, toPersistedNodes } from '../lib/grid'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

type FlowNode = { id: string; type?: string; position?: unknown; data?: Record<string, unknown> }
type FlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  data?: Record<string, unknown>
}

type GridReport = {
  id: string
  name: string
  tenantId: string
  nodes: number
  edges: number
  droppedNodeKeys: string[]
  droppedEdgeKeys: string[]
  duplicateNodeIds: string[]
  duplicateEdgeIds: string[]
  danglingEdges: string[]
  changed: boolean
}

function parseJsonArray<T>(raw: string, label: string, gridId: string): T[] {
  try {
    const value = JSON.parse(raw || '[]')
    if (!Array.isArray(value)) throw new Error('not an array')
    return value as T[]
  } catch (error) {
    console.warn(`[skip] grid ${gridId} 的 ${label} 不是合法 JSON：${(error as Error).message}`)
    return []
  }
}

function diffKeys(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined) {
  const a = new Set(Object.keys(before ?? {}))
  const b = new Set(Object.keys(after ?? {}))
  return Array.from(a).filter((key) => !b.has(key))
}

async function main() {
  console.log(APPLY ? '== 数据迁移：写入模式 ==' : '== 数据迁移：体检模式（加 --apply 才写库）==')

  const grids = await prisma.powerGrid.findMany({ orderBy: { createdAt: 'asc' } })
  const reports: GridReport[] = []

  for (const grid of grids) {
    const nodes = parseJsonArray<FlowNode>(grid.nodes, 'nodes', grid.id)
    const edges = parseJsonArray<FlowEdge>(grid.edges, 'edges', grid.id)

    const cleanNodes = toPersistedNodes(nodes) as FlowNode[]
    const cleanEdges = toPersistedEdges(edges) as FlowEdge[]

    const droppedNodeKeys = Array.from(
      new Set(nodes.flatMap((node, index) => diffKeys(node.data, cleanNodes[index]?.data))
    )).sort()
    const droppedEdgeKeys = Array.from(
      new Set(edges.flatMap((edge, index) => diffKeys(edge.data, cleanEdges[index]?.data))
    )).sort()

    const nodeIdSet = new Set<string>()
    const duplicateNodeIds: string[] = []
    nodes.forEach((node) => {
      if (nodeIdSet.has(node.id)) duplicateNodeIds.push(node.id)
      nodeIdSet.add(node.id)
    })

    const edgeIdSet = new Set<string>()
    const duplicateEdgeIds: string[] = []
    edges.forEach((edge) => {
      if (edgeIdSet.has(edge.id)) duplicateEdgeIds.push(edge.id)
      edgeIdSet.add(edge.id)
    })

    const danglingEdges = edges
      .filter((edge) => !nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target))
      .map((edge) => edge.id)

    const tenantId = grid.tenantId && grid.tenantId.trim() ? grid.tenantId : 'default'
    const nodesJson = JSON.stringify(cleanNodes)
    const edgesJson = JSON.stringify(cleanEdges)
    const changed = nodesJson !== grid.nodes || edgesJson !== grid.edges || tenantId !== grid.tenantId

    reports.push({
      id: grid.id,
      name: grid.name,
      tenantId,
      nodes: cleanNodes.length,
      edges: cleanEdges.length,
      droppedNodeKeys,
      droppedEdgeKeys,
      duplicateNodeIds,
      duplicateEdgeIds,
      danglingEdges,
      changed,
    })

    if (APPLY && changed) {
      await prisma.powerGrid.update({
        where: { id: grid.id },
        data: { tenantId, nodes: nodesJson, edges: edgesJson },
      })
    }
  }

  // GridEvent 的 tenantId 跟随所属电网
  const events = await prisma.gridEvent.findMany({ select: { id: true, gridId: true, tenantId: true } })
  const gridTenant = new Map(reports.map((report) => [report.id, report.tenantId]))
  const eventUpdates = events.filter((event) => {
    const target = gridTenant.get(event.gridId)
    return target && target !== event.tenantId
  })

  // 账号 tenantId 兜底
  const users = await prisma.user.findMany({ select: { id: true, username: true, tenantId: true } })
  const userUpdates = users.filter((user) => !user.tenantId || !user.tenantId.trim())

  reports.forEach((report) => {
    const flags = [
      report.droppedNodeKeys.length ? `剥运行态(node): ${report.droppedNodeKeys.join(',')}` : '',
      report.droppedEdgeKeys.length ? `剥运行态(edge): ${report.droppedEdgeKeys.join(',')}` : '',
      report.duplicateNodeIds.length ? `重复节点: ${report.duplicateNodeIds.join(',')}` : '',
      report.duplicateEdgeIds.length ? `重复连线: ${report.duplicateEdgeIds.join(',')}` : '',
      report.danglingEdges.length ? `悬空连线: ${report.danglingEdges.join(',')}` : '',
    ].filter(Boolean)
    console.log(
      `- ${report.name} (${report.id}) tenant=${report.tenantId} nodes=${report.nodes} edges=${report.edges}` +
        (report.changed ? ' [需迁移]' : ' [已干净]')
    )
    flags.forEach((flag) => console.log(`    · ${flag}`))
  })

  if (APPLY) {
    if (eventUpdates.length) {
      await prisma.gridEvent.updateMany({
        where: { id: { in: eventUpdates.map((event) => event.id) } },
        data: { tenantId: 'default' },
      })
    }
    for (const event of eventUpdates) {
      await prisma.gridEvent.update({ where: { id: event.id }, data: { tenantId: gridTenant.get(event.gridId) } })
    }
    for (const user of userUpdates) {
      await prisma.user.update({ where: { id: user.id }, data: { tenantId: 'default' } })
    }
  }

  console.log(
    `\n汇总：电网 ${reports.length} 个，需迁移 ${reports.filter((report) => report.changed).length} 个；` +
      `事件补租户 ${eventUpdates.length} 条；账号补租户 ${userUpdates.length} 个。`
  )
  if (!APPLY) console.log('提示：以上为体检结果，执行 `npx tsx scripts/migrate-data.ts --apply` 才会写库。')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })