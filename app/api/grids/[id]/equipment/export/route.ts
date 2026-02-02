import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 导出该电网的设备清单（保存时已自动同步，与电网一致） */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    const grid = await prisma.powerGrid.findUnique({
      where: { id: params.id },
      include: { equipment: { orderBy: { createdAt: 'asc' } } },
    })
    if (!grid) {
      return NextResponse.json({ error: 'Grid not found' }, { status: 404 })
    }

    if (format === 'csv') {
      const headers = [
        '序号',
        '节点ID',
        '设备名称',
        '类型',
        '子类型',
        '功率(kW)',
        '电压(V)',
        '电流(A)',
        '描述',
        '扩展属性',
      ]
      const rows = grid.equipment.map((e, i) => [
        i + 1,
        e.nodeId,
        e.name,
        e.type,
        e.subType || '',
        e.power ?? '',
        e.voltage ?? '',
        e.current ?? '',
        e.description || '',
        e.specs || '',
      ])
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n')
      const bom = '\uFEFF'
      return new NextResponse(bom + csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(grid.name)}-设备清单.csv"`,
        },
      })
    }

    const payload = {
      grid: { id: grid.id, name: grid.name, description: grid.description },
      equipment: grid.equipment.map((e) => ({
        id: e.id,
        nodeId: e.nodeId,
        name: e.name,
        type: e.type,
        subType: e.subType,
        power: e.power,
        voltage: e.voltage,
        current: e.current,
        description: e.description,
        specs: e.specs ? (() => { try { return JSON.parse(e.specs); } catch { return e.specs; } })() : null,
      })),
      exportedAt: new Date().toISOString(),
    }
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(grid.name)}-设备清单.json"`,
      },
    })
  } catch (error) {
    console.error('Export equipment error:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}
