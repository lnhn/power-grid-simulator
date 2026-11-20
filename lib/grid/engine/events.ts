import type { CheckSeverity, GridCheck } from './checks'

/** 事件是"校验清单的差分"，不是新算一遍：同一问题只在产生与消失时各记一次 */
export type GridEventState = 'raised' | 'cleared'

export type GridEventInput = {
  severity: CheckSeverity
  code: string
  message: string
  targetId: string | null
  state: GridEventState
  snapshot?: string
}

/** 同一 code + 同一主元件视为同一条问题；换一个元件就是另一条 */
export const checkKey = (check: GridCheck): string => {
  const target = check.nodeIds[0] ?? check.edgeIds[0] ?? ''
  return check.code + '|' + target
}

export const checkTarget = (check: GridCheck): string | null =>
  check.nodeIds[0] ?? check.edgeIds[0] ?? null

/**
 * 对比前后两次校验结果，得到需要落库的事件。
 * 返回顺序：先 cleared（问题消失），再 raised（新问题），方便阅读"先解列后并列"这类过程。
 */
export function diffChecks(
  prev: GridCheck[],
  next: GridCheck[],
  snapshot?: string
): GridEventInput[] {
  const prevMap = new Map(prev.map((check) => [checkKey(check), check]))
  const nextMap = new Map(next.map((check) => [checkKey(check), check]))

  const cleared: GridEventInput[] = []
  const raised: GridEventInput[] = []

  prevMap.forEach((check, key) => {
    if (nextMap.has(key)) return
    cleared.push({
      severity: check.severity,
      code: check.code,
      message: '已恢复：' + check.message,
      targetId: checkTarget(check),
      state: 'cleared',
      snapshot,
    })
  })

  nextMap.forEach((check, key) => {
    if (prevMap.has(key)) return
    raised.push({
      severity: check.severity,
      code: check.code,
      message: check.message,
      targetId: checkTarget(check),
      state: 'raised',
      snapshot,
    })
  })

  return [...cleared, ...raised]
}

/** 顶部横幅用的一句话结论 */
export function summarizeChecks(checks: GridCheck[]): string {
  if (checks.length === 0) return '运行正常'
  const danger = checks.filter((check) => check.severity === 'danger').length
  const warning = checks.filter((check) => check.severity === 'warning').length
  if (danger > 0) return danger + ' 项危险' + (warning > 0 ? '、' + warning + ' 项告警' : '')
  return warning + ' 项告警'
}