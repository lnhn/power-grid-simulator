import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
    
    if (!session || session.user.role !== 'ENGINEER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { nodes, edges, name, description } = await request.json()

    const updateData: Record<string, unknown> = {}
    if (nodes !== undefined) updateData.nodes = nodes
    if (edges !== undefined) updateData.edges = edges
    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description

    const grid = await prisma.powerGrid.update({
      where: { id: params.id },
      data: updateData,
    })

    // 保存电网时自动同步设备清单（与电网节点一致）
    if (nodes !== undefined) {
      try {
        const parsed = typeof nodes === 'string' ? JSON.parse(nodes) : nodes
        const list = Array.isArray(parsed) ? parsed : []
        await prisma.equipment.deleteMany({ where: { gridId: params.id } })
        for (const node of list) {
          const d = node.data || {}
          await prisma.equipment.create({
            data: {
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
            },
          })
        }
      } catch (e) {
        console.error('Sync equipment error:', e)
      }
    }

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
    
    if (!session || session.user.role !== 'ENGINEER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.powerGrid.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete grid' }, { status: 500 })
  }
}
