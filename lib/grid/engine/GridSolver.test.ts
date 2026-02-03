import { describe, expect, it } from 'vitest'
import { EdgeModel, GridSolver, NodeModel } from '..'

const portId = (nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') => `${nodeId}:${side}`

describe('GridSolver', () => {
  it('propagates power from multiple sources through a bus', () => {
    const nodes = [
      new NodeModel('ps1', 'powerSource', { voltage: 380 }),
      new NodeModel('ps2', 'powerSource', { voltage: 380 }),
      new NodeModel('bus1', 'bus', { voltage: 380 }),
    ]
    const edges = [
      new EdgeModel('e1', portId('ps1', 'bottom'), portId('bus1', 'top'), 380),
      new EdgeModel('e2', portId('ps2', 'bottom'), portId('bus1', 'right'), 380),
    ]
    const result = GridSolver.solve(nodes, edges)

    expect(result.nodePowered.get('bus1')).toBe(true)
    expect(result.nodeState.get('bus1')).toBe(true)
    expect(result.portStatus.get('bus1')?.left).toBe(true)
    expect(result.portStatus.get('bus1')?.bottom).toBe(true)
    expect(result.edgeStates.get('e1')?.flow).toBe('forward')
    expect(result.edgeStates.get('e2')?.flow).toBe('forward')
  })

  it('propagates through a tie switch when closed', () => {
    const nodes = [
      new NodeModel('ps', 'powerSource', { voltage: 380 }),
      new NodeModel('tie', 'switch', { status: 'on', subType: 'tie' }),
      new NodeModel('load', 'load', { status: 'running' }),
    ]
    const edges = [
      new EdgeModel('e1', portId('ps', 'bottom'), portId('tie', 'left'), 380),
      new EdgeModel('e2', portId('tie', 'right'), portId('load', 'top'), 380),
    ]
    const result = GridSolver.solve(nodes, edges)

    expect(result.nodePowered.get('load')).toBe(true)
    expect(result.nodeState.get('tie')).toBe(true)
    expect(result.edgeStates.get('e2')?.flow).toBe('forward')
  })

  it('propagates through a transformer from top to bottom', () => {
    const nodes = [
      new NodeModel('ps', 'powerSource', { voltage: 380 }),
      new NodeModel('tx', 'transformer', { voltage: 380 }),
      new NodeModel('load', 'load', { status: 'running' }),
    ]
    const edges = [
      new EdgeModel('e1', portId('ps', 'bottom'), portId('tx', 'top'), 380),
      new EdgeModel('e2', portId('tx', 'bottom'), portId('load', 'top'), 380),
    ]
    const result = GridSolver.solve(nodes, edges)

    expect(result.nodePowered.get('tx')).toBe(true)
    expect(result.nodeState.get('tx')).toBe(true)
    expect(result.nodePowered.get('load')).toBe(true)
    expect(result.edgeStates.get('e2')?.flow).toBe('forward')
  })

  it('applies transformer ratio to downstream edge voltage', () => {
    const nodes = [
      new NodeModel('ps', 'powerSource', { voltage: 1000 }),
      new NodeModel('tx', 'transformer', { voltage: 1000, ratio: 0.4 }),
      new NodeModel('load', 'load', { status: 'running' }),
    ]
    const edges = [
      new EdgeModel('e1', portId('ps', 'bottom'), portId('tx', 'top'), undefined),
      new EdgeModel('e2', portId('tx', 'bottom'), portId('load', 'top'), undefined),
    ]
    const result = GridSolver.solve(nodes, edges)

    expect(result.edgeStates.get('e2')?.voltage).toBe(400)
  })

  it('tracks load node state independent of power', () => {
    const nodes = [new NodeModel('load', 'load', { status: 'running' })]
    const result = GridSolver.solve(nodes, [])

    expect(result.nodePowered.get('load')).toBe(false)
    expect(result.nodeState.get('load')).toBe(true)
  })
})
