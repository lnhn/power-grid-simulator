import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toPersistedNodes } from '@/lib/grid/persist'

/** 允许操作员修改的设计态字段：开关位置、设备运行状态、设备投退 */
const ALLOWED_FIELDS = ['status', 'closed', 'running', 'inService', 'label']

/**
 * 单设备操作：只写入本次操作的字段，运行态（带电/电位/流向）永不落库
 * body: { nodeId, patch: { status?: 'on'|'off'|'running'|'stopped', ... } }
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER', 'OPERATOR'])
    if (denied) return denied

    const body = await request.json()
    const nodeId: string | undefined = body?.nodeId
    const patch: Record<string, unknown> | undefined = body?.patch

    if (!nodeId || !patch || typeof patch !== 'object') {
      return NextResponse.json({ error: '缺少 nodeId 或 patch' }, { status: 400 })
    }

    const unknownKey = Object.keys(patch).find((key) => !ALLOWED_FIELDS.includes(key))
    if (unknownKey) {
      return NextResponse.json({ error: `不允许修改字段 ${unknownKey}` }, { status: 400 })
    }

    const grid = await prisma.powerGrid.findUnique({ where: { id: params.id } })
    if (!grid) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 })
    }

    const nodes = JSON.parse(grid.nodes as string)
    if (!Array.isArray(nodes)) {
      return NextResponse.json({ error: '电网数据损坏' }, { status: 500 })
    }

    const target = nodes.find((node: { id: string }) => node.id === nodeId)
    if (!target) {
      return NextResponse.json({ error: `节点 ${nodeId} 不存在` }, { status: 404 })
    }

    target.data = { ...target.data, ...patch }

    const updated = await prisma.powerGrid.update({
      where: { id: params.id },
      data: { nodes: JSON.stringify(toPersistedNodes(nodes)) },
    })

    return NextResponse.json({ ok: true, nodes: updated.nodes })
  } catch (error) {
    console.error('Operate node error:', error)
    return NextResponse.json({ error: 'Failed to operate node' }, { status: 500 })
  }
}