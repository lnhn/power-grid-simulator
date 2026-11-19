import { describe, expect, it } from 'vitest'
import { buildGridModels, EdgeModel, GridSolver, NodeModel, normalizeNodeData } from '..'

const portId = (nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') => `${nodeId}:${side}`

const asNodes = (list: unknown[]) => list as never[]
const asEdges = (list: unknown[]) => list as never[]

describe('normalizeNodeData', () => {
  it('maps legacy switch status to closed', () => {
    const data = normalizeNodeData('switch', { status: 'on', voltage: 380, subType: 'tie' })
    expect(data.closed).toBe(true)
    expect(data.subType).toBe('tie')
    expect(data.ratedVoltage).toBe(380)
  })

  it('maps legacy load status to running and power to ratedPower', () => {
    const data = normalizeNodeData('load', { status: 'running', power: 75 })
    expect(data.running).toBe(true)
    expect(data.ratedPower).toBe(75)
    expect(data.ratedVoltage).toBe(380)
  })

  it('falls back to 380V when a legacy bus carries voltage 0', () => {
    expect(normalizeNodeData('bus', { voltage: 0 }).ratedVoltage).toBe(380)
  })
})

describe('tie switch terminals', () => {
  const bus = (id: string, x: number) => ({ id, type: 'bus', position: { x, y: 200 }, data: { label: id } })
  const source = (id: string, x: number) => ({ id, type: 'powerSource', position: { x, y: 80 }, data: { voltage: 380 } })

  const buildGrid = (tieStatus: string) => {
    const nodes = [source('ps', 100), bus('busA', 300), { id: 'tie', type: 'switch', position: { x: 600, y: 200 }, data: { label: '母联', subType: 'tie', status: tieStatus } }, bus('busB', 900), { id: 'loadB', type: 'load', position: { x: 900, y: 340 }, data: { label: '负载', status: 'running', power: 50 } }]
    const edges = [
      { id: 'e1', source: 'ps', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e2', source: 'busA', target: 'tie', sourceHandle: 'right', targetHandle: 'left-target' },
      { id: 'e3', source: 'tie', target: 'busB', sourceHandle: 'right-source', targetHandle: 'top' },
      { id: 'e4', source: 'busB', target: 'loadB', sourceHandle: 'bottom', targetHandle: 'top' },
    ]
    return buildGridModels(asNodes(nodes), asEdges(edges))
  }

  it('keeps the second bus section de-energized while the tie is open', () => {
    const { nodeModels, edgeModels, issues } = buildGrid('off')
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(issues).toHaveLength(0)
    expect(result.nodePowered.get('busA')).toBe(true)
    expect(result.nodePowered.get('busB')).toBe(false)
    expect(result.nodePowered.get('loadB')).toBe(false)
  })

  it('feeds the second bus section once the tie is closed', () => {
    const { nodeModels, edgeModels } = buildGrid('on')
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.nodePowered.get('busB')).toBe(true)
    expect(result.nodePowered.get('loadB')).toBe(true)
  })

  it('rejects a second line on the same tie terminal instead of silently merging buses', () => {
    const nodes = [source('ps', 100), bus('busA', 300), bus('busB', 900), { id: 'tie', type: 'switch', position: { x: 600, y: 200 }, data: { label: '母联', subType: 'tie', status: 'off' } }]
    const edges = [
      { id: 'e1', source: 'ps', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e2', source: 'busA', target: 'tie', sourceHandle: 'right', targetHandle: 'left-target' },
      { id: 'e3', source: 'busB', target: 'tie', sourceHandle: 'top', targetHandle: 'left-target' },
    ]
    const { nodeModels, edgeModels, issues } = buildGridModels(asNodes(nodes), asEdges(edges))
    expect(issues.some((issue) => issue.code === 'TIE_DUPLICATE_TERMINAL')).toBe(true)
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.nodePowered.get('busB')).toBe(false)
  })

  it('rejects a tie connected to a non-bus element', () => {
    const nodes = [source('ps', 100), bus('busA', 300), { id: 'tie', type: 'switch', position: { x: 600, y: 200 }, data: { subType: 'tie', status: 'on' } }, { id: 'load1', type: 'load', position: { x: 900, y: 200 }, data: { status: 'running' } }]
    const edges = [
      { id: 'e1', source: 'ps', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e2', source: 'busA', target: 'tie', sourceHandle: 'right', targetHandle: 'left-target' },
      { id: 'e3', source: 'tie', target: 'load1', sourceHandle: 'left-source', targetHandle: 'top' },
    ]
    const { issues } = buildGridModels(asNodes(nodes), asEdges(edges))
    expect(issues.some((issue) => issue.code === 'TIE_PEER_NOT_BUS')).toBe(true)
  })
})

describe('GridSolver', () => {
  it('propagates power from multiple sources through a bus', () => {
    const nodes = [
      new NodeModel('ps1', 'powerSource', { ratedVoltage: 380 }),
      new NodeModel('ps2', 'powerSource', { ratedVoltage: 380 }),
      new NodeModel('bus1', 'bus', { ratedVoltage: 380 }),
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
      new NodeModel('ps', 'powerSource', { ratedVoltage: 380 }),
      new NodeModel('tie', 'switch', { closed: true, subType: 'tie' }),
      new NodeModel('load', 'load', { running: true }),
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
      new NodeModel('ps', 'powerSource', { ratedVoltage: 380 }),
      new NodeModel('tx', 'transformer', { ratedVoltage: 380 }),
      new NodeModel('load', 'load', { running: true }),
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
      new NodeModel('ps', 'powerSource', { ratedVoltage: 1000 }),
      new NodeModel('tx', 'transformer', { ratedVoltage: 1000, ratio: 0.4 }),
      new NodeModel('load', 'load', { running: true }),
    ]
    const edges = [
      new EdgeModel('e1', portId('ps', 'bottom'), portId('tx', 'top'), undefined),
      new EdgeModel('e2', portId('tx', 'bottom'), portId('load', 'top'), undefined),
    ]
    const result = GridSolver.solve(nodes, edges)

    expect(result.edgeStates.get('e2')?.voltage).toBe(400)
  })

  it('tracks load node state independent of power', () => {
    const nodes = [new NodeModel('load', 'load', { running: true })]
    const result = GridSolver.solve(nodes, [])

    expect(result.nodePowered.get('load')).toBe(false)
    expect(result.nodeState.get('load')).toBe(true)
  })

  it('blocks power when the switch is open', () => {
    const nodes = [
      new NodeModel('ps', 'powerSource', { ratedVoltage: 380 }),
      new NodeModel('sw', 'switch', { closed: false }),
      new NodeModel('load', 'load', { running: true }),
    ]
    const edges = [
      new EdgeModel('e1', portId('ps', 'bottom'), portId('sw', 'top'), 380),
      new EdgeModel('e2', portId('sw', 'bottom'), portId('load', 'top'), 380),
    ]
    const result = GridSolver.solve(nodes, edges)

    expect(result.portStatus.get('sw')?.top).toBe(true)
    expect(result.portStatus.get('sw')?.bottom).toBe(false)
    expect(result.nodePowered.get('load')).toBe(false)
    expect(result.edgeStates.get('e2')?.active).toBe(false)
    expect(result.edgeStates.get('e2')?.flow).toBe('none')
  })

  it('marks ring cross edges with undefined flow direction', () => {
    const nodes = [
      new NodeModel('ps1', 'powerSource', { ratedVoltage: 380 }),
      new NodeModel('ps2', 'powerSource', { ratedVoltage: 380 }),
      new NodeModel('busA', 'bus', { ratedVoltage: 380 }),
      new NodeModel('busB', 'bus', { ratedVoltage: 380 }),
    ]
    const edges = [
      new EdgeModel('e1', portId('ps1', 'bottom'), portId('busA', 'top'), 380),
      new EdgeModel('e2', portId('ps2', 'bottom'), portId('busB', 'top'), 380),
      new EdgeModel('e3', portId('busA', 'left'), portId('busB', 'left'), 380),
    ]
    const result = GridSolver.solve(nodes, edges)

    expect(result.loopEdges.has('e3')).toBe(true)
    expect(result.edgeStates.get('e3')?.loop).toBe(true)
    expect(result.edgeStates.get('e3')?.flow).toBe('none')
    expect(result.voltageConflict.size).toBe(0)
  })

  it('detects multi-source voltage conflicts at closed tie switches', () => {
    const nodes = [
      new NodeModel('ps1', 'powerSource', { ratedVoltage: 380 }),
      new NodeModel('ps2', 'powerSource', { ratedVoltage: 1000 }),
      new NodeModel('tie', 'switch', { closed: true, subType: 'tie' }),
    ]
    const edges = [
      new EdgeModel('e1', portId('ps1', 'bottom'), portId('tie', 'left'), 380),
      new EdgeModel('e2', portId('ps2', 'bottom'), portId('tie', 'right'), 1000),
    ]
    const result = GridSolver.solve(nodes, edges)

    expect(result.voltageConflict.has(portId('tie', 'left'))).toBe(true)
    expect(result.voltageConflict.has(portId('tie', 'right'))).toBe(true)
    expect(result.edgeStates.get('e1')?.conflict).toBe(true)
  })

  it('does not flag transformer voltage ratio as a conflict', () => {
    const nodes = [
      new NodeModel('ps', 'powerSource', { ratedVoltage: 1000 }),
      new NodeModel('tx', 'transformer', { ratedVoltage: 1000, ratio: 0.4 }),
    ]
    const edges = [new EdgeModel('e1', portId('ps', 'bottom'), portId('tx', 'top'), undefined)]
    const result = GridSolver.solve(nodes, edges)

    expect(result.voltageConflict.size).toBe(0)
  })
})