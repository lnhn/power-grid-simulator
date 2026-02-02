import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 获取该电网的设备清单（保存电网时已自动同步） */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const grid = await prisma.powerGrid.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, description: true },
    })
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
