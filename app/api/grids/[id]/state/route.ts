import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getScopedGrid } from '@/lib/tenant'
import { toPersistedNodes, toPersistedEdges } from '@/lib/grid/persist'

/**
 * 模拟状态同步：仅更新设计态的位置/开关位置，运行态字段由 toPersisted* 剥离。
 * 仍保留此路由以兼容旧客户端，但禁止把带电/电位/流向写回数据库。
 */
export async function PATCH(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER', 'OPERATOR'])
    if (denied) return denied

    const { nodes, edges } = await request.json()

    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return NextResponse.json(
        { error: 'nodes 与 edges 必须是数组' },
        { status: 400 }
      )
    }

    const existing = await getScopedGrid(session, params.id)
    if (!existing) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 })
    }

    const grid = await prisma.powerGrid.update({
      where: { id: params.id },
      data: {
        nodes: JSON.stringify(toPersistedNodes(nodes)),
        edges: JSON.stringify(toPersistedEdges(edges)),
      },
    })

    return NextResponse.json(grid)
  } catch (error) {
    console.error('Update grid state error:', error)
    return NextResponse.json(
      { error: 'Failed to update grid state' },
      { status: 500 }
    )
  }
}
