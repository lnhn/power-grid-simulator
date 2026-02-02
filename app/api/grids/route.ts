import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const grids = await prisma.powerGrid.findMany({
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(grids)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch grids' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ENGINEER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description } = await request.json()

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: '电网名称不能为空' }, { status: 400 })
    }

    // 创建初始空电网
    const grid = await prisma.powerGrid.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        nodes: JSON.stringify([]),
        edges: JSON.stringify([]),
      },
    })

    return NextResponse.json(grid)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create grid' }, { status: 500 })
  }
}
