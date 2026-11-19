import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireRole } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const grid = await prisma.powerGrid.findUnique({
      where: { id: params.id },
    })

    if (!grid) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 })
    }

    return NextResponse.json(grid)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch grid' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER'])
    if (denied) return denied

    const { nodes, edges, name, description } = await request.json()

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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const denied = requireRole(session, ['ENGINEER'])
    if (denied) return denied

    await prisma.$transaction([
      prisma.operationLog.deleteMany({
        where: { gridId: params.id },
      }),
      prisma.powerGrid.delete({
        where: { id: params.id },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete grid' }, { status: 500 })
  }
}
