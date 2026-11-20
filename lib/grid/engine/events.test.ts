import { describe, expect, it } from 'vitest'
import { checkKey, diffChecks, summarizeChecks } from './events'
import type { GridCheck } from './checks'

const check = (code: string, nodeId: string, severity: GridCheck['severity'] = 'danger'): GridCheck => ({
  code,
  severity,
  message: code + ' 说明',
  nodeIds: [nodeId],
  edgeIds: [],
})

describe('运行事件差分', () => {
  it('首次出现问题记为 raised', () => {
    const events = diffChecks([], [check('VOLTAGE_CONFLICT', 'tie')])
    expect(events).toHaveLength(1)
    expect(events[0].state).toBe('raised')
    expect(events[0].targetId).toBe('tie')
  })

  it('同一问题持续存在不重复记录', () => {
    const events = diffChecks([check('VOLTAGE_CONFLICT', 'tie')], [check('VOLTAGE_CONFLICT', 'tie')])
    expect(events).toHaveLength(0)
  })

  it('问题消失记为 cleared，且文案带已恢复', () => {
    const events = diffChecks([check('LOOP_PATH', 'sw')], [])
    expect(events).toHaveLength(1)
    expect(events[0].state).toBe('cleared')
    expect(events[0].message.startsWith('已恢复')).toBe(true)
  })

  it('先 cleared 后 raised', () => {
    const events = diffChecks([check('LOOP_PATH', 'sw1')], [check('TIE_UNSAFE_PARALLEL', 'tie')])
    expect(events.map((event) => event.state)).toEqual(['cleared', 'raised'])
  })

  it('同 code 不同元件是不同问题', () => {
    expect(checkKey(check('LOOP_PATH', 'a'))).not.toBe(checkKey(check('LOOP_PATH', 'b')))
  })

  it('汇总文案区分危险与告警', () => {
    expect(summarizeChecks([])).toBe('运行正常')
    expect(summarizeChecks([check('A', 'x', 'warning')])).toContain('告警')
    expect(summarizeChecks([check('A', 'x', 'danger'), check('B', 'y', 'warning')])).toContain('危险')
  })
})