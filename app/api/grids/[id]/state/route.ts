import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * 模拟状态同步：仅更新 nodes/edges，允许工程师和操作员在模拟时持久化当前状态
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { nodes, edges } = await request.json()

    if (nodes === undefined || edges === undefined) {
      return NextResponse.json(
        { error: '缺少 nodes 或 edges' },
        { status: 400 }
      )
    }

    const grid = await prisma.powerGrid.update({
      where: { id: params.id },
      data: { nodes, edges },
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
