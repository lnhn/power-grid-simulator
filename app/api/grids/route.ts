import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tenantIdOf } from '@/lib/tenant'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const grids = await prisma.powerGrid.findMany({
      where: { tenantId: tenantIdOf(session) },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(grids)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch grids' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER'])
    if (denied) return denied

    const { name, description } = await request.json()

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: '电网名称不能为空' }, { status: 400 })
    }
    if (description != null && typeof description !== 'string') {
      return NextResponse.json({ error: '电网描述格式不正确' }, { status: 400 })
    }

    // 创建初始空电网，并绑定当前租户
    const grid = await prisma.powerGrid.create({
      data: {
        tenantId: tenantIdOf(session),
        name: name.trim(),
        description: description?.trim() || null,
        nodes: JSON.stringify([]),
        edges: JSON.stringify([]),
      },
    })

    return NextResponse.json(grid)
  } catch {
    return NextResponse.json({ error: 'Failed to create grid' }, { status: 500 })
  }
}
