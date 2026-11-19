import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER', 'OPERATOR'])
    if (denied) return denied

    const { gridId, action, targetId, details } = await request.json()

    if (!gridId || !action || !targetId) {
      return NextResponse.json(
        { error: '缺少必要字段: gridId, action, targetId' },
        { status: 400 }
      )
    }

    const log = await prisma.operationLog.create({
      data: {
        userId: session!.user.id,
        gridId,
        action,
        targetId,
        details,
      },
    })

    return NextResponse.json(log)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create log' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER', 'OPERATOR'])
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const gridId = searchParams.get('gridId')

    // 分页参数：页码从 1 开始，每页最大 100 条，避免无上限查询
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20))
    const where = gridId ? { gridId } : undefined

    const [logs, total] = await Promise.all([
      prisma.operationLog.findMany({
        where,
        include: {
          user: {
            select: {
              username: true,
              role: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.operationLog.count({ where }),
    ])

    return NextResponse.json({ logs, total, page, pageSize })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
