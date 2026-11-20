import type { GridCheck } from './checks'
import { diffChecks, checkKey, type GridEventInput } from './events'

/**
 * 告警去抖：一个问题必须连续存在 graceMs 才升级为事件。
 * 目的不是"少报"，而是把合环预演、开关抖动这类瞬态操作从事件流里滤掉。
 * cleared 不等待：问题消失就立刻记录，避免回放时看到"还在告警"的错觉。
 */
export class CheckDebouncer {
  private pending = new Map<string, { since: number; check: GridCheck }>()
  private stable: GridCheck[] = []
  private readonly graceMs: number

  constructor(graceMs = 3000) {
    this.graceMs = graceMs
  }

  getStable(): GridCheck[] {
    return this.stable
  }

  update(current: GridCheck[], now: number): GridEventInput[] {
    const currentKeys = new Set(current.map((check) => checkKey(check)))
    const events: GridEventInput[] = []

    // 消失的问题：stable 立刻转 cleared，pending 直接丢弃
    const keptStable = this.stable.filter((check) => {
      if (currentKeys.has(checkKey(check))) return true
      events.push(...diffChecks([check], []))
      return false
    })
    Array.from(this.pending.keys()).forEach((key) => {
      if (!currentKeys.has(key)) this.pending.delete(key)
    })

    const nextPending = new Map<string, { since: number; check: GridCheck }>()
    const stableKeys = new Set(keptStable.map((check) => checkKey(check)))
    const raisedNow: GridCheck[] = []

    current.forEach((check) => {
      const key = checkKey(check)
      if (stableKeys.has(key)) return
      const entry = this.pending.get(key)
      if (!entry) {
        nextPending.set(key, { since: now, check })
        return
      }
      if (now - entry.since >= this.graceMs) {
        raisedNow.push(check)
        return
      }
      nextPending.set(key, entry)
    })

    events.push(...diffChecks([], raisedNow))
    this.pending = nextPending
    this.stable = [...keptStable, ...raisedNow]
    return events
  }
}