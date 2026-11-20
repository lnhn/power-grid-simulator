/**
 * 一键整理（单线图专用分层布局）
 *
 * 之前只按"元件类型"分五条横带、每类按原 x 排开，两个根本问题：
 *   1) 同一类的元件全挤在一行，不管它接在谁下面 —— 两条支路的断路器会被拉到同一排；
 *   2) 列间距固定 220px，而卡片最小宽度 240px —— 同排必然重叠。
 *
 * 现在按"电气层级"排：
 *   1) 从电源做 BFS 得到每个元件的层号（电源 0、进线开关/变压器 1、母线 2、出线开关 3、负荷 4）；
 *   2) 母联贴着母线那一层放，横向落在它连的两段母线之间；
 *   3) 每一层用父节点的中位序号做重心排序（barycenter），两趟上下来回，减少交叉；
 *   4) 按真实卡片宽度 + 间距逐列排，单链拉直（只有一个父、一个子的节点对齐到父节点中轴）；
 *   5) 层高按该层最高卡片算，避免上下贴在一起。
 *
 * 只改坐标，不动拓扑与参数。
 */

export type LayoutNodeLike = {
  id: string
  type?: string
  position?: { x: number; y: number }
  data?: Record<string, unknown>
}

export type LayoutEdgeLike = { source: string; target: string }

/** 卡片最小宽度（与节点组件里的 min-w-[240px] 对齐） */
const NODE_W = 240
const COL_GAP = 110
const ROW_GAP = 90
const ORIGIN = 60

const NODE_H: Record<string, number> = {
  powerSource: 58,
  transformer: 60,
  bus: 54,
  switch: 58,
  load: 64,
}

const heightOf = (node: LayoutNodeLike) => NODE_H[node.type ?? 'bus'] ?? 60
const isTie = (node: LayoutNodeLike) => node.type === 'switch' && node.data?.subType === 'tie'

/** 未接线的孤儿元件按类型给个兜底层号，避免挤到电源排 */
const FALLBACK_RANK: Record<string, number> = {
  powerSource: 0,
  transformer: 1,
  switch: 1,
  bus: 2,
  load: 3,
}

type Node = {
  id: string
  type: string
  tie: boolean
  rank: number
  parents: string[]
  children: string[]
  order: number
  center: number
  h: number
}

export function autoLayout(nodes: LayoutNodeLike[], edges: LayoutEdgeLike[] = []): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>()
  if (nodes.length === 0) return result

  const byId = new Map<string, Node>()
  nodes.forEach((raw) => {
    byId.set(raw.id, {
      id: raw.id,
      type: raw.type ?? 'bus',
      tie: isTie(raw),
      rank: 0,
      parents: [],
      children: [],
      order: 0,
      center: 0,
      h: heightOf(raw),
    })
  })

  // 只认两端都存在、且不是自环的连线
  edges.forEach((edge) => {
    if (!byId.has(edge.source) || !byId.has(edge.target)) return
    if (edge.source === edge.target) return
    const from = byId.get(edge.source)!
    const to = byId.get(edge.target)!
    if (!from.children.includes(to.id)) from.children.push(to.id)
    if (!to.parents.includes(from.id)) to.parents.push(from.id)
  })

  // 1) 从电源做 BFS：层号取最短路径，避免长链把并联支路拖下去
  const roots = Array.from(byId.values()).filter((node) => node.type === 'powerSource')
  const fallbackRoots = Array.from(byId.values()).filter((node) => node.parents.length === 0 && node.type !== 'powerSource')
  const visit = (starts: Node[]) => {
    const queue: Node[] = []
    starts.forEach((node) => {
      node.rank = node.type === 'powerSource' ? 0 : node.rank || 0
      queue.push(node)
    })
    const seen = new Set(queue.map((node) => node.id))
    while (queue.length > 0) {
      const current = queue.shift()!
      current.children.forEach((childId) => {
        const child = byId.get(childId)!
        if (seen.has(child.id)) return
        seen.add(child.id)
        child.rank = current.rank + 1
        queue.push(child)
      })
    }
  }
  visit(roots.length > 0 ? roots : fallbackRoots)

  // 没被任何电源走到的元件：按类型兜底，排在同类后面
  const unvisited = Array.from(byId.values()).filter((node) => node.rank === 0 && node.type !== 'powerSource')
  if (roots.length > 0) {
    unvisited.forEach((node) => {
      node.rank = FALLBACK_RANK[node.type] ?? 2
    })
  }

  // 2) 母联与母线同层：左右两端都是母线，让它落在母线那一排
  Array.from(byId.values())
    .filter((node) => node.tie)
    .forEach((tie) => {
      const busParents = tie.parents.map((id) => byId.get(id)!).filter((parent) => parent.type === 'bus')
      const busChildren = tie.children.map((id) => byId.get(id)!).filter((child) => child.type === 'bus')
      const busRanks = [...busParents, ...busChildren].map((bus) => bus.rank)
      if (busRanks.length > 0) tie.rank = Math.min(...busRanks)
    })

  // 3) 分层
  const ranks = new Map<number, Node[]>()
  Array.from(byId.values()).forEach((node) => {
    const list = ranks.get(node.rank) ?? []
    list.push(node)
    ranks.set(node.rank, list)
  })
  const rankKeys = Array.from(ranks.keys()).sort((a, b) => a - b)

  // 初始顺序：沿用画布上的从左到右，减少"整理后全盘打乱"的陌生感
  const initialX = new Map(nodes.map((node) => [node.id, node.position?.x ?? 0]))
  rankKeys.forEach((key) => {
    ranks.get(key)!.sort((a, b) => (initialX.get(a.id) ?? 0) - (initialX.get(b.id) ?? 0))
  })

  const applyOrder = () => {
    rankKeys.forEach((key) => {
      ranks.get(key)!.forEach((node, index) => {
        node.order = index
      })
    })
  }
  applyOrder()

  /** 重心：父/子在同层里的序号中位数；没有邻居就保持原序 */
  const barycenter = (ids: string[]): number | null => {
    if (ids.length === 0) return null
    const values = ids.map((id) => byId.get(id)!.order).sort((a, b) => a - b)
    const mid = Math.floor(values.length / 2)
    return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid]
  }

  for (let pass = 0; pass < 4; pass += 1) {
    const downward = pass % 2 === 0
    const keys = downward ? rankKeys : rankKeys.slice().reverse()
    keys.forEach((key) => {
      const list = ranks.get(key)!
      const scored = list.map((node) => ({
        node,
        // 母联两端都是母线、方向不唯一，按左右邻居的中位算，才能落在两段母线之间
        score: barycenter(node.tie ? [...node.parents, ...node.children] : downward ? node.parents : node.children),
      }))
      const withScore = scored.filter((item) => item.score !== null)
      if (withScore.length === 0) return
      withScore.sort((a, b) => (a.score as number) - (b.score as number) || a.node.order - b.node.order)
      // 已有序号的节点按重心重排，没邻居的留在原位置附近
      const ordered = scored.slice().sort((a, b) => {
        if (a.score === null && b.score === null) return a.node.order - b.node.order
        if (a.score === null) return 1
        if (b.score === null) return -1
        return (a.score as number) - (b.score as number) || a.node.order - b.node.order
      })
      ranks.set(key, ordered.map((item) => item.node))
      applyOrder()
      void withScore
    })
  }

  // 4) 逐层横向排布：先按本地坐标排，再整体居中
  const rankWidth = new Map<number, number>()
  rankKeys.forEach((key) => {
    const list = ranks.get(key)!
    let cursor = 0
    list.forEach((node) => {
      node.center = cursor + NODE_W / 2
      cursor += NODE_W + COL_GAP
    })
    rankWidth.set(key, cursor - COL_GAP)
  })
  const maxWidth = Math.max(...Array.from(rankWidth.values()))
  rankKeys.forEach((key) => {
    const list = ranks.get(key)!
    const offset = (maxWidth - (rankWidth.get(key) ?? 0)) / 2
    list.forEach((node) => {
      node.center += offset
    })
  })

  // 5) 拉直单链：只有一个父、且父只有一个子 → 对齐到父节点中轴
  for (let pass = 0; pass < 2; pass += 1) {
    Array.from(byId.values()).forEach((node) => {
      if (node.parents.length !== 1) return
      const parent = byId.get(node.parents[0])!
      if (parent.children.length !== 1) return
      node.center = parent.center
    })
    // 拉直后同层可能贴住，按顺序推开
    rankKeys.forEach((key) => {
      const list = ranks.get(key)!.slice().sort((a, b) => a.center - b.center)
      for (let i = 1; i < list.length; i += 1) {
        const prev = list[i - 1]
        if (list[i].center - prev.center < NODE_W + 20) {
          list[i].center = prev.center + NODE_W + 20
        }
      }
      ranks.set(key, list)
    })
  }

  // 6) 纵坐标：层高按该层最高卡片算，母联与母线中心对齐
  const busRank = Array.from(byId.values()).find((node) => node.type === 'bus')?.rank ?? 2
  let top = ORIGIN
  const rankTop = new Map<number, number>()
  const rankHeight = new Map<number, number>()
  rankKeys.forEach((key) => {
    const list = ranks.get(key)!
    rankTop.set(key, top)
    const h = Math.max(...list.map((node) => node.h))
    rankHeight.set(key, h)
    top += h + ROW_GAP
  })

  Array.from(byId.values()).forEach((node) => {
    const yTop = rankTop.get(node.rank) ?? ORIGIN
    let y = yTop
    if (node.tie) {
      const busTop = rankTop.get(busRank) ?? yTop
      const busH = rankHeight.get(busRank) ?? node.h
      y = busTop + (busH - node.h) / 2
    }
    result.set(node.id, {
      x: Math.round(node.center - NODE_W / 2),
      y: Math.round(y),
    })
  })

  return result
}