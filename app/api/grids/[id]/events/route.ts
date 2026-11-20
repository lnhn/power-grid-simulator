import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getScopedGrid, tenantIdOf } from '@/lib/tenant'

const SEVERITIES = ['danger', 'warning', 'info']
const STATES = ['raised', 'cleared']

/**
 * 运行事件：GET 拉最近事件（供面板与回放），POST 由前端解算出差分后批量写入。
 * 只接受结构化字段，不信任客户端传来的任意 JSON。
 */
export async function GET(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER', 'OPERATOR'])
    if (denied) return denied

    const scoped = await getScopedGrid(session, params.id)
    if (!scoped) return NextResponse.json({ error: 'Grid not found' }, { status: 404 })

    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 200)

    const events = await prisma.gridEvent.findMany({
      where: { gridId: params.id, tenantId: tenantIdOf(session) },
      orderBy: { at: 'desc' },
      take: limit,
      select: {
        id: true,
        at: true,
        severity: true,
        code: true,
        message: true,
        targetId: true,
        state: true,
      },
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('List grid events error:', error)
    return NextResponse.json({ error: 'Failed to list events' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER', 'OPERATOR'])
    if (denied) return denied

    const body = await request.json()
    const raw = Array.isArray(body?.events) ? body.events : null
    if (!raw || raw.length === 0) {
      return NextResponse.json({ error: '缺少 events' }, { status: 400 })
    }
    if (raw.length > 50) {
      return NextResponse.json({ error: '单次最多 50 条事件' }, { status: 400 })
    }

    const scoped = await getScopedGrid(session, params.id)
    if (!scoped) return NextResponse.json({ error: 'Grid not found' }, { status: 404 })

    const rows: {
      gridId: string
      tenantId: string
      severity: string
      code: string
      message: string
      targetId: string | null
      state: string
      snapshot: string | null
    }[] = []

    for (const item of raw) {
      const severity = String(item?.severity ?? '')
      const state = String(item?.state ?? '')
      const code = String(item?.code ?? '')
      const message = String(item?.message ?? '')
      if (!SEVERITIES.includes(severity) || !STATES.includes(state)) {
        return NextResponse.json({ error: '事件字段不合法' }, { status: 400 })
      }
      if (!code || code.length > 64 || !message || message.length > 200) {
        return NextResponse.json({ error: '事件编码或描述过长' }, { status: 400 })
      }
      const targetId = item?.targetId
      rows.push({
        gridId: params.id,
        tenantId: tenantIdOf(session),
        severity,
        code,
        message,
        targetId: typeof targetId === 'string' && targetId.length <= 64 ? targetId : null,
        state,
        snapshot: typeof item?.snapshot === 'string' ? item.snapshot.slice(0, 2000) : null,
      })
    }

    await prisma.gridEvent.createMany({ data: rows })
    return NextResponse.json({ ok: true, count: rows.length })
  } catch (error) {
    console.error('Create grid events error:', error)
    return NextResponse.json({ error: 'Failed to create events' }, { status: 500 })
  }
}