# 改造路线图

> 目标：把"画图 + 亮灯"的演示工具，做成小型工厂可用的**电网构建 / 模拟运行 / 监视**系统。
> 原则：设计态与运行态分离；求解器是唯一真相源；皮肤只在渲染层。

## 一、产品定位

三层结构，同一套数据在三个视角下呈现：

```
构建 Design     人输入：单线图、元件、额定参数、拓扑约束
   | 纯函数求解
模拟 Simulate   电气真相：电位、电流、功率、状态、越限
   | 快照 + 事件
监控 Monitor    操作员视角：分段负荷、运行方式、告警、趋势、回放
```

四层电气语义：拓扑层 -> 电气层 -> 状态层 -> 操作层。拓扑层与电气层（M1 / M2）已完成，状态层与操作层继续推进。

## 二、已定决策

| 事项 | 决策 |
|---|---|
| 皮肤 | 首发 `industrial` / `schematic` / `paper` 三套，各带 light/dark 变体；暗色不做独立主题 |
| 功率流 | 先做纯功率汇总（无阻抗、无电压降），精度后置 |
| 母联 | 先做"节点 + 双端子"，边级设备形态留到 M5 评估 |
| 操作票 / 五防 | 放到最后（M6 之后单独评估） |

## 三、架构原则

1. `PowerGrid.nodes/edges` 只存设计态；运行态不落库（M3 起落独立快照表）。
2. `lib/grid` 不许出现任何颜色、尺寸、样式。
3. 端子位置与身份由元件定义决定，皮肤只换外观。
4. 皮肤不得改变语义；语义色必须配形状/描边/文字冗余。
5. 一切"能不能送电"的判断只能来自求解器，UI 不得自己推。

## 四、里程碑

| 期 | 内容 | 验收 | 状态 |
|---|---|---|---|
| M0 | 基线固化：提交、清仓库、文档 | `npm test` 全绿、文档与代码一致 | 已完成 |
| M1 | 语义地基：端子、电位、状态、母联运行方式 | 母联断开=真解列；合上=真并列 | 已完成 |
| M2 | 电气量：功率汇总、电流、负载率、合环检查 | 进线总功率 = 各段负荷之和 | 已完成 |
| M3 | 监控与演练：告警、事件、采样、故障注入、回放 | 跳闸->告警->恢复全过程留痕 | 未开始 |
| M4 | 皮肤体系：tokens、注册表、三套皮肤、导出 | 换皮肤不改 `lib/grid` | 已完成（收尾中） |
| M5 | 构建体验：拓扑 lint、连线校验、模板、自动布局 | 画错立刻给清单 | 未开始 |
| M6 | 收尾：测试矩阵、迁移、权限审计、部署 | 回归通过、文档齐 | 未开始 |

> v2.6.0 补充：Next.js 16.4.6 安全升级已完成，`npm audit` 0 漏洞；React 18 仍可运行但 Next 17 将移除支持，ReactFlow 11 → React 19 生态迁移列为独立事项。
### M1 进度

- [x] 数据契约与归一化（`normalize.ts`，旧图打开即兼容）
- [x] 母联端子身份由连线决定（`parseTieTerminal` + 端子占用校验 + `issues`）
- [x] 并查集电位传播、变压器变比传递、电位冲突（`UnionFind.ts` / `potential.ts`）
- [x] 电气分段 `sections` 与母联四种运行方式 `ties`（分段 / 并列 / 备用 / 危险并列）
- [x] 运行态与设计态分离：`runtime.ts` 只读叠加，`toPersistedNodes` 入库前剥运行态
- [x] 单设备操作接口 `PATCH /api/grids/[id]/operate`：只写本次操作的字段
- [x] 界面呈现：母联运行方式角标、侧栏分段与左右电压、边电压标签

遗留项（不阻塞 M1 验收）：保存链路整体复核（编辑页保存校验、并发操作保护）。

### M2 进度

- [x] 功率汇总：负荷功率沿生成树回推到电源，段负荷 / 电源出力 / 全网合计
- [x] 电流换算：I = P / (√3 · U · cosφ)，按下游电压逐边计算，变压器两侧电流不同
- [x] 环网标记：不在生成树上的并联边标 `shared`，电流不给数（避免编造）
- [x] 界面：总负荷卡片、段负荷与电流、边标签显示 `电压 · 电流`

遗留项（不阻塞 M2 验收）：合环校验清单（合上前"将形成环网/并列"的可执行提示）、载流校核（开关 `ratedCurrent` 粗校验）。

## 五、M0 清单

- [x] 现有 24 个未提交文件整理为一次提交
- [x] `power-grid-simulator.zip` 移出版本库并加入 `.gitignore`
- [x] `.env` 重复的 `DATABASE_URL` 清理
- [x] README 重写
- [x] CHANGELOG 追平到 v2.3
- [x] 新增 `docs/ROADMAP.md`
- [x] 新建分支 `feat/m1-electrical-model`

## 六、M1 详细设计

### 6.1 设计态数据契约

| 元件 | 字段 |
|---|---|
| `bus` | `label, ratedVoltage` |
| `powerSource` | `label, ratedVoltage, kind(grid/generator/ups), inService` |
| `switch`（含母联） | `label, subType(breaker/tie), closed, ratedCurrent, ratedVoltage` |
| `load` | `label, subType, running, ratedPower, ratedVoltage, powerFactor` |
| `transformer` | `label, ratedVoltage, ratio, ratedPower` |

旧数据在加载时经 `normalizeNode()` 归一，只读不写回：

```
closed        = data.closed ?? (data.status === 'on')
running       = data.running ?? (data.status === 'running')
ratedVoltage  = data.ratedVoltage ?? data.voltage ?? 380
```

保存时 `sanitize()` 剥掉所有运行态字段，防止再次污染。

### 6.2 运行态结构（`SolveResultV1`）

```
node:     energized, state(deenergized|energized|stopped|running|tripped|fault),
          ports{side:{energized, voltage}}, sectionId
edge:     active, flow, voltage, loop, conflict
sections: id, busIds, sourceIds, voltage
ties:     id, closed, mode(sectioned|parallel|standby|unsafeParallel),
          leftVoltage, rightVoltage, leftSources, rightSources
issues:   code, level, targetId, message
```

### 6.3 算法

1. 并查集合并等电位端子：母线四端口、闭合开关两端、每条边两端。
2. 变压器不参与合并：一次/二次侧属于不同 section，二次电位 = 一次 × `ratio`，按拓扑序传播防环。
3. 电源注入：电源 `bottom` 所在 section 电位 = `ratedVoltage`。
4. 无源 section 电位 0（失电），不再用 BFS 距离表达。
5. 母联运行方式：对每个母联，在"去掉该母联内部连接"的子图上求两侧 section 的电源与电位。
6. 同 section 多电源且电位不一致 -> conflict，M2 接入合环检查。

### 6.4 母联端子

- `resolvePort()`：handle 优先（`left-*` / `right-*`），其次几何兜底，再次报 issue，**绝不静默合并**。
- 约束：每端子最多 1 条线、对端必须是 `bus`、两条线必须落在不同端子。
- 迁移：加载时把几何推断结果写成 handle；无法推断的标"需重连"。

### 6.5 UI 同步

- 模拟页 `applyCircuitState` 只产出运行态；`/state` 路由保留但需按租户校验，禁止写回运行态。
- 母联：边框表达 `closed`，端子圆点表达 `energized`；确认框显示合环检查结果。
- 母线：显示额定电压与实时电位。

### 6.6 用例

| # | 场景 | 断言 |
|---|---|---|
| 1 | 母联断开 | busA 带电、busB 失电、负载失电 |
| 2 | 母联合上 | busB 带电、负载可运行、mode 正确 |
| 3 | 同一端子接两条母线 | 报 issue，且不合并两段母线 |
| 4 | 备用互投 | 断主进线 -> 合母联 -> busA 转供 |
| 5 | 非同期合环 | 380V 与 1000V -> unsafeParallel |
| 6 | 变压器 | 1000V x 0.4 -> 400V，无 conflict |
| 7 | 纯函数 | 两次求解一致，设计态未被修改 |

### 6.7 文件改动

新增：`lib/grid/normalize.ts`、`engine/UnionFind.ts`、`engine/potential.ts`、`engine/ties.ts`、`types.ts`

修改：`adapter.ts`、`models/NodeModel.ts`、`rules.ts`、`engine/GridGraph.ts`、`engine/GridSolver.ts`、`edit/page.tsx`、`simulate/page.tsx`、`SwitchNode.tsx`、`SimulateSwitchNode.tsx`、`SimulateBusNode.tsx`、`prisma/seed.ts`

不动：`prisma/schema.prisma`（M1 无需改表）

### 6.8 同时预留的渲染边界

渲染器签名固定为 `(元件模型, 运行态, 皮肤 token)`，M4 换皮肤时不需要回头改求解器与组件数据流。

## 七、M2 - M6 摘要

- **M2**：前推回代功率汇总；支路/设备电流与负载率；进线总功率；越限/欠压/无源岛；合环前检查与强制演练。
- **M3**：告警引擎（分级/去抖/确认）；`Event`(SOE) 与 `SimulationSample` 表；趋势图；故障注入；回放。
- **M4（已完成，收尾中）**：tokens + CSS 变量、皮肤注册表、三套皮肤、语义色冗余编码、设置页切换均已落地；SVG/PDF 导出为收尾项。
- **M5**：拓扑 lint 问题清单；连线实时合法性；参数面板由注册表生成；自动分层布局；三个模板。
- **M6**：单测 + 关键 e2e；旧数据迁移脚本；角色与审计；部署说明。

## 八、明确不做

- Newton-Raphson 潮流收敛
- IEC 60909 短路电流计算
- 继电保护整定与保护曲线
- SCADA / PLC 实时数据接入
- 多电压等级复杂环网的最优潮流

## 九、风险

| 风险 | 应对 |
|---|---|
| 皮肤改几何导致连线错位 | 端子由元件定义，皮肤只换外观 |
| 旧图 handle 缺失导致误判 | 迁移时标记"需重连"，禁止静默合并 |
| 撤销/重做被运行态污染 | 运行态不进 nodes/edges，normalize 只读 |
| 功率流精度被误解 | 界面明确标注"功率汇总，未含阻抗与压降" |
| ReactFlow 11 双向 handle | 统一 `resolvePort()`，不依赖 handle type |
