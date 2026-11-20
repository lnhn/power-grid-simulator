import { describe, expect, it } from 'vitest'
import { CheckDebouncer } from './debounce'
import type { GridCheck } from './checks'

const check = (code: string, node: string): GridCheck => ({
  code,
  severity: 'warning',
  message: code,
  nodeIds: [node],
  edgeIds: [],
})

describe('告警去抖', () => {
  it('瞬态问题不产生事件', () => {
    const d = new CheckDebouncer(3000)
    expect(d.update([check('LOOP_PATH', 'sw')], 1000)).toHaveLength(0)
    expect(d.update([], 1500)).toHaveLength(0)
  })

  it('持续超过宽限期才升级为事件', () => {
    const d = new CheckDebouncer(3000)
    d.update([check('LOOP_PATH', 'sw')], 1000)
    expect(d.update([check('LOOP_PATH', 'sw')], 2500)).toHaveLength(0)
    const events = d.update([check('LOOP_PATH', 'sw')], 4200)
    expect(events).toHaveLength(1)
    expect(events[0].state).toBe('raised')
  })

  it('已稳定的问题消失时立刻记录 cleared', () => {
    const d = new CheckDebouncer(1000)
    d.update([check('LOOP_PATH', 'sw')], 0)
    d.update([check('LOOP_PATH', 'sw')], 1200)
    const events = d.update([], 1300)
    expect(events[0].state).toBe('cleared')
  })

  it('稳定后重复上报不重复产生事件', () => {
    const d = new CheckDebouncer(1000)
    d.update([check('LOOP_PATH', 'sw')], 0)
    d.update([check('LOOP_PATH', 'sw')], 1500)
    expect(d.update([check('LOOP_PATH', 'sw')], 3000)).toHaveLength(0)
  })
})