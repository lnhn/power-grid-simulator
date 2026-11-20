import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gridBelongsToTenant, tenantIdOf } from '@/lib/tenant'

/** 仅允许记录这些由服务端业务语义定义的动作，避免客户端伪造任意审计事件 */
const ALLOWED_ACTIONS = new Set(['SWITCH_ON', 'SWITCH_OFF', 'LOAD_START', 'LOAD_STOP'])

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER', 'OPERATOR'])
    if (denied) return denied

    const { gridId, action, targetId, details } = await request.json()

    if (!gridId || typeof gridId !== 'string' || !action || typeof action !== 'string' || !targetId || typeof targetId !== 'string') {
      return NextResponse.json(
        { error: '缺少必要字段: gridId, action, targetId' },
        { status: 400 }
      )
    }

    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ error: '不支持的操作类型' }, { status: 400 })
    }
    if (details != null && (typeof details !== 'string' || details.length > 2000)) {
      return NextResponse.json({ error: '操作详情格式不正确' }, { status: 400 })
    }

    // 只能给当前租户内的电网写日志，且目标元件必须真实存在
    const grid = await prisma.powerGrid.findFirst({
      where: { id: gridId, tenantId: tenantIdOf(session) },
      select: { nodes: true },
    })
    if (!grid) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 })
    }

    let nodes: unknown
    try {
      nodes = JSON.parse(grid.nodes as string)
    } catch {
      return NextResponse.json({ error: '电网数据损坏' }, { status: 500 })
    }
    const targetExists = Array.isArray(nodes) && nodes.some(
      (node: { id?: string }) => node && typeof node === 'object' && node.id === targetId
    )
    if (!targetExists) {
      return NextResponse.json({ error: `节点 ${targetId} 不存在` }, { status: 404 })
    }

    const log = await prisma.operationLog.create({
      data: {
        userId: session!.user.id,
        gridId,
        action,
        targetId,
        details: details ?? null,
      },
    })

    return NextResponse.json(log)
  } catch (error) {
    console.error('Create log error:', error)
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
    const tenantId = tenantIdOf(session)

    // gridId 可选：不传时返回当前租户全部日志，绝不跨租户
    const where = gridId
      ? { gridId, grid: { is: { tenantId } } }
      : { grid: { is: { tenantId } } }
    if (gridId && !(await gridBelongsToTenant(session, gridId))) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 })
    }

    // 分页参数：页码从 1 开始，每页最大 100 条，避免无上限查询
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20))

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
    console.error('Fetch logs error:', error)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
