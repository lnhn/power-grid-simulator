import { describe, expect, it } from 'vitest'
import { buildGridModels, EdgeModel, evaluateChecks, GridSolver, NodeModel, normalizeNodeData, previewTieToggle } from '..'

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
describe('tie operation modes', () => {
  const busNode = (id: string, x: number, y: number, voltage: number) => ({ id, type: 'bus', position: { x, y }, data: { voltage } })
  const sourceNode = (id: string, x: number, y: number, voltage: number) => ({ id, type: 'powerSource', position: { x, y }, data: { voltage } })
  const tieNode = (status: string) => ({ id: 'tie', type: 'switch', position: { x: 600, y: 200 }, data: { subType: 'tie', status } })

  const build = (tieStatus: string, secondSourceVoltage?: number) => {
    const nodes: unknown[] = [
      sourceNode('ps1', 100, 80, 380),
      busNode('busA', 300, 200, 380),
      tieNode(tieStatus),
      busNode('busB', 900, 200, 380),
    ]
    const edges: unknown[] = [
      { id: 'e1', source: 'ps1', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e2', source: 'busA', target: 'tie', sourceHandle: 'right', targetHandle: 'left-target' },
      { id: 'e3', source: 'tie', target: 'busB', sourceHandle: 'right-source', targetHandle: 'top' },
    ]
    if (secondSourceVoltage !== undefined) {
      nodes.push(sourceNode('ps2', 1100, 80, secondSourceVoltage))
      edges.push({ id: 'e4', source: 'ps2', target: 'busB', sourceHandle: 'bottom', targetHandle: 'top' })
    }
    return buildGridModels(asNodes(nodes), asEdges(edges))
  }

  it('reports sectioned operation when the tie is open between two sources', () => {
    const { nodeModels, edgeModels } = build('off', 380)
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.ties.get('tie')?.mode).toBe('sectioned')
    expect(result.nodePowered.get('busA')).toBe(true)
    expect(result.nodePowered.get('busB')).toBe(true)
    expect(result.sections).toHaveLength(2)
    expect(result.voltageConflict.size).toBe(0)
  })

  it('reports parallel operation when closed with equal voltage', () => {
    const { nodeModels, edgeModels } = build('on', 380)
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.ties.get('tie')?.mode).toBe('parallel')
    expect(result.sections).toHaveLength(1)
    expect(result.voltageConflict.size).toBe(0)
  })

  it('flags unsafe parallel when closing between different voltages', () => {
    const { nodeModels, edgeModels } = build('on', 1000)
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.ties.get('tie')?.mode).toBe('unsafeParallel')
    expect(result.voltageConflict.has('tie:left')).toBe(true)
    expect(result.edgeStates.get('e1')?.conflict).toBe(true)
  })

  it('keeps the standby section energized after closing the tie', () => {
    const openGrid = build('off')
    const openResult = GridSolver.solve(openGrid.nodeModels, openGrid.edgeModels)
    expect(openResult.ties.get('tie')?.mode).toBe('standby')
    expect(openResult.nodePowered.get('busB')).toBe(false)

    const closedGrid = build('on')
    const closedResult = GridSolver.solve(closedGrid.nodeModels, closedGrid.edgeModels)
    expect(closedResult.nodePowered.get('busB')).toBe(true)
    expect(closedResult.ties.get('tie')?.rightVoltage).toBe(0)
  })

  it('does not flag a transformer step-down that matches the parallel source voltage', () => {
    const nodes: unknown[] = [
      sourceNode('ps1', 100, 60, 1000),
      { id: 'tx', type: 'transformer', position: { x: 300, y: 140 }, data: { voltage: 1000, ratio: 0.4 } },
      busNode('busA', 500, 240, 400),
      busNode('busB', 900, 240, 400),
      sourceNode('ps2', 1100, 160, 400),
    ]
    const edges: unknown[] = [
      { id: 'e1', source: 'ps1', target: 'tx', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e2', source: 'tx', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e3', source: 'busA', target: 'busB', sourceHandle: 'right', targetHandle: 'left' },
      { id: 'e4', source: 'ps2', target: 'busB', sourceHandle: 'bottom', targetHandle: 'top' },
    ]
    const { nodeModels, edgeModels } = buildGridModels(asNodes(nodes), asEdges(edges))
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.voltageConflict.size).toBe(0)
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].voltage).toBe(400)
  })

  it('reports live voltage on energized edges', () => {
    const { nodeModels, edgeModels } = build('off', 380)
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.edgeStates.get('e2')?.voltage).toBe(380)
  })
})

describe('power aggregation', () => {
  const src = (id: string, x: number, y: number, voltage = 380) => ({ id, type: 'powerSource', position: { x, y }, data: { voltage } })
  const bus = (id: string, x: number, y: number, voltage = 380) => ({ id, type: 'bus', position: { x, y }, data: { voltage } })
  const sw = (id: string, status: string, x: number, y: number) => ({ id, type: 'switch', position: { x, y }, data: { status } })
  const load = (id: string, power: number, status: string, x: number, y: number) => ({
    id,
    type: 'load',
    position: { x, y },
    data: { status, power },
  })

  const chain = (loadStatus: string, switchStatus: string) => {
    const nodes: unknown[] = [src('ps', 100, 60), bus('b', 300, 160), sw('k', switchStatus, 300, 260), load('m', 100, loadStatus, 300, 360)]
    const edges: unknown[] = [
      { id: 'e1', source: 'ps', target: 'b', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e2', source: 'b', target: 'k', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e3', source: 'k', target: 'm', sourceHandle: 'bottom', targetHandle: 'top' },
    ]
    return buildGridModels(asNodes(nodes), asEdges(edges))
  }

  it('sums running load power into the section and the source', () => {
    const { nodeModels, edgeModels } = chain('running', 'on')
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.totalKw).toBe(100)
    expect(result.sections[0].loadKw).toBe(100)
    expect(result.sections[0].loadCount).toBe(1)
    expect(result.sourceOutput.get('ps')).toBe(100)
    expect(result.loadKw.get('m')).toBe(100)
  })

  it('counts a stopped load as zero', () => {
    const { nodeModels, edgeModels } = chain('stopped', 'on')
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.totalKw).toBe(0)
    expect(result.sections[0].loadCount).toBe(0)
  })

  it('counts an unpowered running load as zero', () => {
    const { nodeModels, edgeModels } = chain('running', 'off')
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.totalKw).toBe(0)
    expect(result.loadKw.get('m')).toBe(0)
  })

  it('accumulates current along the supply path', () => {
    const { nodeModels, edgeModels } = chain('running', 'on')
    const result = GridSolver.solve(nodeModels, edgeModels)
    const expected = (100 * 1000) / (Math.sqrt(3) * 380 * 0.85)
    expect(result.edgeStates.get('e3')?.kw).toBe(100)
    expect(result.edgeStates.get('e3')?.amp).toBeCloseTo(expected, 1)
    expect(result.edgeStates.get('e1')?.amp).toBeCloseTo(expected, 1)
    expect(result.sections[0].currentA).toBeCloseTo(expected, 1)
  })

  it('splits section load evenly between parallel sources when the tie is closed', () => {
    const nodes: unknown[] = [
      src('ps1', 100, 60),
      bus('b1', 300, 160),
      { id: 'tie', type: 'switch', position: { x: 600, y: 160 }, data: { subType: 'tie', status: 'on' } },
      bus('b2', 900, 160),
      src('ps2', 1100, 60),
      load('m1', 100, 'running', 300, 360),
      load('m2', 300, 'running', 900, 360),
    ]
    const edges: unknown[] = [
      { id: 'e1', source: 'ps1', target: 'b1', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e2', source: 'b1', target: 'tie', sourceHandle: 'right', targetHandle: 'left-target' },
      { id: 'e3', source: 'tie', target: 'b2', sourceHandle: 'right-source', targetHandle: 'top' },
      { id: 'e4', source: 'ps2', target: 'b2', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e5', source: 'b1', target: 'm1', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e6', source: 'b2', target: 'm2', sourceHandle: 'bottom', targetHandle: 'top' },
    ]
    const { nodeModels, edgeModels } = buildGridModels(asNodes(nodes), asEdges(edges))
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.sections).toHaveLength(1)
    expect(result.totalKw).toBe(400)
    expect(result.sourceOutput.get('ps1')).toBe(200)
    expect(result.sourceOutput.get('ps2')).toBe(200)
    expect(result.ties.get('tie')?.mode).toBe('parallel')
  })

  it('keeps load power across a transformer and converts current per side', () => {
    const nodes: unknown[] = [
      src('ps', 100, 60, 1000),
      { id: 'tx', type: 'transformer', position: { x: 300, y: 140 }, data: { voltage: 1000, ratio: 0.4 } },
      bus('b', 500, 260, 400),
      load('m', 100, 'running', 500, 360),
    ]
    const edges: unknown[] = [
      { id: 'e1', source: 'ps', target: 'tx', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e2', source: 'tx', target: 'b', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e3', source: 'b', target: 'm', sourceHandle: 'bottom', targetHandle: 'top' },
    ]
    const { nodeModels, edgeModels } = buildGridModels(asNodes(nodes), asEdges(edges))
    const result = GridSolver.solve(nodeModels, edgeModels)
    expect(result.totalKw).toBe(100)
    expect(result.edgeStates.get('e1')?.kw).toBe(100)
    expect(result.edgeStates.get('e1')?.amp).toBeCloseTo((100 * 1000) / (Math.sqrt(3) * 1000 * 0.85), 1)
    expect(result.edgeStates.get('e3')?.amp).toBeCloseTo((100 * 1000) / (Math.sqrt(3) * 400 * 0.85), 1)
  })
})

describe('checks and tie preview', () => {
  const busNode = (id: string, x: number, y: number, voltage = 380) => ({ id, type: 'bus', position: { x, y }, data: { voltage } })
  const sourceNode = (id: string, x: number, y: number, voltage = 380) => ({ id, type: 'powerSource', position: { x, y }, data: { voltage } })
  const tieNode = (status: string) => ({ id: 'tie', type: 'switch', position: { x: 600, y: 200 }, data: { subType: 'tie', status } })
  const loadNode = (id: string, power: number, status: string, x: number, y: number) => ({
    id,
    type: 'load',
    position: { x, y },
    data: { status, power },
  })

  const build = (tieStatus: string, secondSourceVoltage?: number, loadPower?: number, ratedCurrent?: number) => {
    const nodes: unknown[] = [sourceNode('ps1', 100, 80), busNode('busA', 300, 200), tieNode(tieStatus), busNode('busB', 900, 200)]
    const edges: unknown[] = [
      { id: 'e1', source: 'ps1', target: 'busA', sourceHandle: 'bottom', targetHandle: 'top' },
      { id: 'e2', source: 'busA', target: 'tie', sourceHandle: 'right', targetHandle: 'left-target' },
      { id: 'e3', source: 'tie', target: 'busB', sourceHandle: 'right-source', targetHandle: 'top' },
    ]
    if (secondSourceVoltage !== undefined) {
      nodes.push(sourceNode('ps2', 1100, 80, secondSourceVoltage))
      edges.push({ id: 'e4', source: 'ps2', target: 'busB', sourceHandle: 'bottom', targetHandle: 'top' })
    }
    if (loadPower !== undefined) {
      nodes.push(loadNode('m', loadPower, 'running', 300, 360))
      edges.push({ id: 'e5', source: 'busA', target: 'm', sourceHandle: 'bottom', targetHandle: 'top' })
    }
    if (ratedCurrent !== undefined) {
      nodes.push({ id: 'k', type: 'switch', position: { x: 300, y: 290 }, data: { status: 'on', ratedCurrent } })
      edges.push({ id: 'e6', source: 'busA', target: 'k', sourceHandle: 'bottom', targetHandle: 'top' })
    }
    return buildGridModels(asNodes(nodes), asEdges(edges))
  }

  it('flags unsafe parallel and voltage conflict', () => {
    const { nodeModels, edgeModels } = build('on', 1000)
    const result = GridSolver.solve(nodeModels, edgeModels)
    const checks = evaluateChecks(nodeModels, edgeModels, result)
    expect(checks.some((check) => check.code === 'TIE_UNSAFE_PARALLEL')).toBe(true)
    expect(checks.some((check) => check.code === 'VOLTAGE_CONFLICT')).toBe(true)
    expect(checks.some((check) => check.severity === 'danger')).toBe(true)
  })

  it('flags a switch overloaded by its section current', () => {
    const { nodeModels, edgeModels } = build('off', 200, 150, 100)
    const result = GridSolver.solve(nodeModels, edgeModels)
    const checks = evaluateChecks(nodeModels, edgeModels, result)
    expect(checks.some((check) => check.code === 'OVERLOAD_SWITCH')).toBe(true)
  })

  it('previews a safe parallel close with load sharing', () => {
    const { nodeModels, edgeModels } = build('off', 380, 100)
    const preview = previewTieToggle(nodeModels, edgeModels, 'tie', true)
    expect(preview?.severity).toBe('info')
    expect(preview?.lines.join('')).toContain('并列运行')
    expect(preview?.lines.join('')).toContain('2 台电源')
  })

  it('refuses to preview a close between different voltages', () => {
    const { nodeModels, edgeModels } = build('off', 1000)
    const preview = previewTieToggle(nodeModels, edgeModels, 'tie', true)
    expect(preview?.severity).toBe('danger')
    expect(preview?.lines.join('')).toContain('禁止合环')
  })

  it('previews splitting when opening an already sectioned tie', () => {
    const { nodeModels, edgeModels } = build('off', 380)
    const preview = previewTieToggle(nodeModels, edgeModels, 'tie', false)
    expect(preview?.lines.join('')).toContain('解列为两段')
  })
})
