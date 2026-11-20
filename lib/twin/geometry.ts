/**
 * 3D 配电室的几何参数（单位：米）。
 *
 * 第一版不引入任何模型资产，全部用参数化柜体拼出来；尺寸集中在这里，
 * 后续要"更像现场"只改这张表，不改场景图代码。
 */

/** 2D 画布像素 → 米：240px 宽的元件卡片约等于 6 米长的柜体 */
export const METER_PER_PX = 0.025

/** 纵深拉伸：2D 的 y 方向是"往下"，3D 里对应"往里"，稍微拉开一点免得挤在一起 */
export const DEPTH_STRETCH = 1.6

export const TWIN_BOXES = {
  source: { w: 1.2, h: 2.2, d: 0.8 },
  breaker: { w: 0.9, h: 2.0, d: 0.7 },
  tie: { w: 1.4, h: 1.8, d: 0.9 },
  transformer: { w: 1.8, h: 2.4, d: 1.4 },
  /** 母线铜排：长度固定 6m，截面 0.16×0.16 */
  busbar: { w: 6, h: 0.16, d: 0.16 },
  /** 负荷：3D 里只做一个"接入点"标记，不建模设备本体 */
  load: { w: 1.0, h: 0.8, d: 1.0 },
} as const

/** 配电室地面与墙的包围盒余量（米） */
export const ROOM_MARGIN = 3

/** 柜体高出地面的安装间隙：柜底落在 0，母线悬在柜顶附近 */
export const BUSBAR_HEIGHT = 2.6
