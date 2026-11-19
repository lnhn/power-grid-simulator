import { EdgeModel } from '../models/EdgeModel'
import { NodeModel } from '../models/NodeModel'
import { GridSolveResult, GridSolver, TieState } from './GridSolver'

export type CheckSeverity = 'info' | 'warning' | 'danger'

export type GridCheck = {
  code: string
  severity: CheckSeverity
  message: string
  nodeIds: string[]
  edgeIds: string[]
}

export type OperationPreview = {
  severity: CheckSeverity
  lines: string[]
}

const tieModeText = (mode: TieState['mode']) => {
  switch (mode) {
    case 'parallel':
      return '并列运行'
    case 'unsafeParallel':
      return '危险并列'
    case 'sectioned':
      return '分段运行'
    default:
      return '备用'
  }
}

/**
 * 运行校验清单：把求解结果翻译成"操作员看得懂的问题"。
 * 只描述事实，不给建议动作（建议交给后续的操作票/五防层）。
 */
export function evaluateChecks(nodes: NodeModel[], edges: EdgeModel[], result: GridSolveResult): GridCheck[] {
  const checks: GridCheck[] = []

  if (result.voltageConflict.size > 0) {
    const nodeIds = Array.from(new Set(Array.from(result.voltageConflict).map((portId) => portId.split(':')[0])))
    checks.push({
      code: 'VOLTAGE_CONFLICT',
      severity: 'danger',
      message: `存在电位冲突：${nodeIds.length} 个元件处于两种电压下，检查并列电源与变压器变比`,
      nodeIds,
      edgeIds: [],
    })
  }

  result.ties.forEach((tie) => {
    if (tie.mode === 'unsafeParallel') {
      checks.push({
        code: 'TIE_UNSAFE_PARALLEL',
        severity: 'danger',
        message: `母联处于危险并列：左 ${tie.leftVoltage}V / 右 ${tie.rightVoltage}V`,
        nodeIds: [tie.id],
        edgeIds: [],
      })
    }
  })

  result.sections.forEach((section) => {
    if (!section.energized) {
      checks.push({
        code: 'SECTION_DEENERGIZED',
        severity: 'warning',
        message: `第 ${section.busIds.length} 母线所在分段失电（${section.loadCount} 台设备停运）`,
        nodeIds: section.busIds,
        edgeIds: [],
      })
    }
  })

  if (result.loopEdges.size > 0) {
    checks.push({
      code: 'LOOP_PATH',
      severity: 'warning',
      message: `存在 ${result.loopEdges.size} 条并联回路，潮流无法按单一路径分配`,
      nodeIds: [],
      edgeIds: Array.from(result.loopEdges),
    })
  }

  nodes
    .filter((node) => node.type === 'switch' && typeof node.data.ratedCurrent === 'number')
    .forEach((node) => {
      const section = result.sections.find((item) => item.id === result.nodeSection.get(node.id))
      if (!section || section.currentA <= 0) return
      const rated = node.data.ratedCurrent as number
      if (section.currentA > rated) {
        checks.push({
          code: 'OVERLOAD_SWITCH',
          severity: 'danger',
          message: `「${node.data.label ?? node.id}」额定 ${rated}A，所在分段负荷电流 ${Math.round(section.currentA)}A`,
          nodeIds: [node.id],
          edgeIds: [],
        })
      }
    })

  return checks
}

/**
 * 操作预演：把"合/断这个母联"当作假设条件重新求解，对比前后。
 * 用于确认弹窗里提前告诉操作员会发生什么，而不是合上之后才暴露。
 */
export function previewTieToggle(
  nodes: NodeModel[],
  edges: EdgeModel[],
  tieId: string,
  close: boolean
): OperationPreview | null {
  const tie = nodes.find((node) => node.id === tieId)
  if (!tie || !tie.isTie()) return null

  const before = GridSolver.solve(nodes, edges)
  const hypothetical = nodes.map((node) =>
    node.id === tieId ? new NodeModel(node.id, node.type, { ...node.data, closed: close }, node.position) : node
  )
  const after = GridSolver.solve(hypothetical, edges)

  const tieBefore = before.ties.get(tieId)
  const tieAfter = after.ties.get(tieId)
  const lines: string[] = []
  let severity: CheckSeverity = 'info'

  if (!tieBefore || !tieAfter) return null

  if (close) {
    if (tieAfter.mode === 'unsafeParallel') {
      severity = 'danger'
      lines.push(`两侧电压不同（左 ${tieAfter.leftVoltage}V / 右 ${tieAfter.rightVoltage}V），禁止合环`)
    } else if (tieAfter.mode === 'parallel') {
      lines.push(`两侧同压 ${tieAfter.leftVoltage}V，合上后由「${tieModeText(tieBefore.mode)}」转为并列运行，两段合为一段`)
      const sectionAfter = after.sections.find((section) => section.energized && section.sourceIds.length > 1)
      if (sectionAfter && sectionAfter.sourceIds.length > 1) {
        lines.push(`合环后负荷 ${sectionAfter.loadKw.toFixed(0)}kW 由 ${sectionAfter.sourceIds.length} 台电源分担（约 ${Math.round(sectionAfter.currentA)}A）`)
      }
    } else if (tieAfter.mode === 'standby') {
      lines.push('仅一侧有电源，合上后由该侧转供另一段')
    }

    const newLoops = after.loopEdges.size - before.loopEdges.size
    if (newLoops > 0) {
      severity = severity === 'danger' ? 'danger' : 'warning'
      lines.push(`合上后新增 ${newLoops} 条并联回路，潮流无法唯一分配`)
    }
  } else {
    if (tieBefore.mode === 'sectioned') {
      lines.push('断开后解列为两段，各自独立供电')
    } else {
      const rightStillEnergized = Array.from(after.sections.values()).some((section) => section.energized)
      lines.push(rightStillEnergized ? '断开后一侧将由本段电源单独承担' : '断开后另一段将失电')
      if (!rightStillEnergized) severity = 'warning'
    }
  }

  return { severity, lines }
}