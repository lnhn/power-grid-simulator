import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireRole } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getScopedGrid } from '@/lib/tenant'

function isValidJsonArray(value: string): boolean {
  try {
    return Array.isArray(JSON.parse(value))
  } catch {
    return false
  }
}

export async function GET(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const grid = await getScopedGrid(session, params.id)

    if (!grid) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 })
    }

    return NextResponse.json(grid)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch grid' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER'])
    if (denied) return denied

    const existing = await getScopedGrid(session, params.id)
    if (!existing) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 })
    }

    const { nodes, edges, name, description } = await request.json()

    if (nodes !== undefined && (typeof nodes !== 'string' || !isValidJsonArray(nodes))) {
      return NextResponse.json({ error: 'nodes 必须是合法的 JSON 数组字符串' }, { status: 400 })
    }
    if (edges !== undefined && (typeof edges !== 'string' || !isValidJsonArray(edges))) {
      return NextResponse.json({ error: 'edges 必须是合法的 JSON 数组字符串' }, { status: 400 })
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return NextResponse.json({ error: '电网描述格式不正确' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (nodes !== undefined) updateData.nodes = nodes
    if (edges !== undefined) updateData.edges = edges
    if (name !== undefined) {
      const safeName = String(name).trim()
      updateData.name = safeName || '未命名电网'
    }
    if (description !== undefined) updateData.description = description

    // 电网更新与设备清单同步在同一事务内完成，保证数据一致性
    const equipmentData: Prisma.EquipmentCreateManyInput[] = []
    if (nodes !== undefined) {
      const parsed = typeof nodes === 'string' ? JSON.parse(nodes) : nodes
      const list = Array.isArray(parsed) ? parsed : []
      for (const node of list) {
        const d = node.data || {}
        equipmentData.push({
          gridId: params.id,
          nodeId: node.id || '',
          name: d.label || node.type || '未命名',
          type: node.type || 'bus',
          subType: d.subType || null,
          power: d.power != null ? Number(d.power) : null,
          voltage: d.voltage != null ? Number(d.voltage) : null,
          current: d.current != null ? Number(d.current) : null,
          description: null,
          specs: null,
        })
      }
    }

    const [grid] = await prisma.$transaction([
      prisma.powerGrid.update({
        where: { id: params.id },
        data: updateData,
      }),
      ...(nodes !== undefined
        ? [
            prisma.equipment.deleteMany({ where: { gridId: params.id } }),
            prisma.equipment.createMany({ data: equipmentData }),
          ]
        : []),
    ])

    return NextResponse.json(grid)
  } catch (error) {
    console.error('Update grid error:', error)
    return NextResponse.json({ error: 'Failed to update grid' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER'])
    if (denied) return denied

    const existing = await getScopedGrid(session, params.id)
    if (!existing) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.operationLog.deleteMany({
        where: { gridId: params.id },
      }),
      prisma.powerGrid.delete({
        where: { id: params.id },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete grid' }, { status: 500 })
  }
}
