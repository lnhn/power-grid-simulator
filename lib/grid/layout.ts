
/** 单线图的排版习惯：电源在上，母线和母联在中，负荷在下 */
const BANDS: Record<string, { y: number; label: string }> = {
  powerSource: { y: 0, label: '电源' },
  transformer: { y: 140, label: '变压器' },
  bus: { y: 280, label: '母线' },
  switch: { y: 420, label: '开关' },
  load: { y: 560, label: '负荷' },
}

const COLUMN_GAP = 220

/**
 * 一键整理：只改坐标，不动拓扑与参数。
 * 同一排内按原有 x 顺序排开，尽量保留用户"从左到右"的意图。
 */
export function autoLayout(
  nodes: { id: string; type?: string; position?: { x: number; y: number }; data?: Record<string, unknown> }[]
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>()

  Object.keys(BANDS).forEach((type) => {
    const row = nodes.filter((node) => node.type === type).slice().sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0))
    row.forEach((node, index) => {
      result.set(node.id, { x: index * COLUMN_GAP, y: BANDS[type].y })
    })
  })

  // 母联夹在两段母线之间：放在 bus 排同一高度，右移半格
  const ties = nodes.filter((node) => node.type === 'switch' && node.data?.subType === 'tie')
  const buses = nodes.filter((node) => node.type === 'bus')
  ties.forEach((tie, index) => {
    const busCount = Math.max(buses.length, 1)
    const x = Math.min(index + 1, busCount - 1) * COLUMN_GAP + COLUMN_GAP / 2
    result.set(tie.id, { x, y: BANDS.bus.y })
  })

  return result
}
