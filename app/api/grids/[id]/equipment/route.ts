import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getScopedGrid } from '@/lib/tenant'

/** 获取该电网的设备清单（保存电网时已自动同步） */
export async function GET(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER', 'OPERATOR'])
    if (denied) return denied

    const grid = await getScopedGrid(session, params.id)
    if (!grid) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 })
    }

    const equipment = await prisma.equipment.findMany({
      where: { gridId: params.id },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ ...grid, equipment })
  } catch (error) {
    console.error('Fetch grid equipment error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch equipment' },
      { status: 500 }
    )
  }
}
