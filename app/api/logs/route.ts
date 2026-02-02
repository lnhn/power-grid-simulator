import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gridId, action, targetId, details } = await request.json()

    if (!gridId || !action || !targetId) {
      return NextResponse.json(
        { error: '缺少必要字段: gridId, action, targetId' },
        { status: 400 }
      )
    }

    const log = await prisma.operationLog.create({
      data: {
        userId: session.user.id,
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
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const gridId = searchParams.get('gridId')

    const logs = await prisma.operationLog.findMany({
      where: gridId ? { gridId } : undefined,
      include: {
        user: {
          select: {
            username: true,
            role: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    })

    return NextResponse.json(logs)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
