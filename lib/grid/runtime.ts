import { NodeModel } from './models/NodeModel'
import { Side } from './models/PortModel'
import { GridSolveResult, TieMode } from './engine/GridSolver'

const SIDES: Side[] = ['top', 'bottom', 'left', 'right']

/** 节点的运行态视图：只存在于内存，永不写回设计数据 */
export type NodeRuntimeView = {
  powered: boolean
  nodeState: boolean
  /** 运行电压：母线取所在电气节点电位，其他元件取端口电位最大值 */
  voltage: number
  portStatus: Record<Side, boolean>
  conflict: boolean
  sectionId?: string
  sectionVoltage?: number
  tieMode?: TieMode
  /** 负荷当前功率（kW） */
  loadKw?: number
  /** 电源当前出力（kW） */
  sourceKw?: number
}

export function buildNodeRuntime(nodes: NodeModel[], result: GridSolveResult): Map<string, NodeRuntimeView> {
  const view = new Map<string, NodeRuntimeView>()

  nodes.forEach((node) => {
    const portStatus =
      result.portStatus.get(node.id) ??
      ({ top: false, bottom: false, left: false, right: false } as Record<Side, boolean>)
    const section = node.type === 'bus' ? result.sections.find((item) => item.busIds.includes(node.id)) : undefined
    const voltages = SIDES.map((side) => result.portVoltages.get(`${node.id}:${side}`) ?? 0)
    const voltage = section ? section.voltage : Math.max(0, ...voltages)
    const tie = node.isTie() ? result.ties.get(node.id) : undefined

    view.set(node.id, {
      powered: result.nodePowered.get(node.id) ?? false,
      nodeState: result.nodeState.get(node.id) ?? false,
      voltage,
      portStatus,
      conflict: SIDES.some((side) => result.voltageConflict.has(`${node.id}:${side}`)),
      sectionId: section?.id,
      sectionVoltage: section?.voltage,
      tieMode: tie?.mode,
      loadKw: result.loadKw.get(node.id) ?? 0,
      sourceKw: result.sourceOutput.get(node.id) ?? 0,
    })
  })

  return view
}
