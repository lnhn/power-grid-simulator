# 更新日志






## v2.10.1 - 皮肤 2.0 回归修复：老皮肤保持原样

v2.10.0 重构时顺手把「图纸」收成紧凑条、把「纸感」的图标底板改成圆形、把卡片圆角改成倍率缩放，观感比原来差了。这一版把老皮肤全部还原成重构前的尺寸与样式，新形态只由新皮肤（端子）承担。

### 修复
- 工业 / 图纸 / 纸感三套皮肤：卡片宽度回到 240、内边距 20/12、2px 描边、原始圆角（`radiusScale: 1`）、方块图标底板；图纸只保留原有的 BUSBAR 小注，不再收窄
- 开关的"闭合 / 断开"副标题恢复语义色（闭合绿、断开灰），闭合时图标底板回到淡绿底——骨架化时这两处被统一成灰色，属于回归
- `NodeShell` 增加 `subtitleTone` 与 `iconBackground` 两个口子，语义色仍由元件自己给，不外泄到皮肤

### 结果
- `npx tsc --noEmit` 无错，`npx eslint .` 无告警，`npx vitest run` 70 例全绿，`npx build` 通过
- 实机对照：工业皮肤下画布与 v2.9.5 时一致；切到「端子」才出现窄条形态
## v2.10.0 - 皮肤 2.0：从"配色包"升级为"形态包"

原来皮肤只改颜色、圆角与字体，卡片外形在五个元件组件里各写一份——想换"元器件长相"就得改五遍。这一版把皮肤扩成规格包。

### 新增
- `lib/skins/spec.ts`：`SkinSpec{ shape, wire, defaultSymbolSet, view3d }`。形态含卡片/紧凑条/端子式，另有圆角倍率、描边粗细、阴影、图标底板（方块/圆形/无）、最小宽度、内外边距、字号、是否显示小注；`view3d` 预留给三维材质与光照
- `components/nodes/NodeShell.tsx`：所有编辑态元件共用的外壳，按 `spec.shape` 渲染卡片、状态角标、删除按钮与选中描边；元件只管图标、名称、副标题和端口
- `components/nodes/loadGlyphs.tsx`：负荷图标从 LoadNode 抽出，按 subType 换形
- 新皮肤「端子」（`terminal`）：4px 圆角、132px 窄条、只用状态点不给图标底板，适合现场小屏；浅色/深色两套调色板

### 改造
- 电源、开关、母线、变压器、负荷五个节点全部改走 NodeShell，视觉逻辑从五处收到一处
- 「图纸」皮肤改为紧凑条（184px、1px 描边、无阴影、显示 BUSBAR 小注），「工业」保持整卡，「纸感」圆形图标底板
- 设置页每张皮肤卡加"直接用该皮肤形状画的元件预览"，并标注 `形态 · 连线 · 3D 材质`，换皮肤前就能看出长得不一样

### 边界（继续守住）
- 皮肤仍不碰语义色：带电绿 `#16a34a`、失电灰 `#94a3b8`、冲突红 `#dc2626` 与皮肤无关
- 皮肤不碰 `lib/grid`，求解与校验完全不受影响

### 验证
- `npx tsc --noEmit` 无错，`npx eslint .` 无告警，`npx vitest run` 70 例全绿，`npm run build` 通过
- 实机：端子皮肤下编辑画布节点宽 130px、运行态与连线正常；设置页四套皮肤预览互不相同
## v2.9.5 - 母线直连提示 + 未保存变更标记

### 拓扑校验
- 新增 `BUS_BUS_DIRECT`（warning）：两段母线直接连线时提示"电气上等价于合并为一段；若要分段运行，请改用母联开关"，带动两段母线的节点定位
- 新增对应单测，`cs` 算例的"母线→母线"现在会出现在规则校验里，而非"未发现问题"

### 未保存变更
- 编辑页按持久化投影（`toPersistedNodes/Edges`，已剥运行态/选中态）生成设计态快照，与"上次保存/加载"的快照比对得出 `dirty`
- 保存按钮左侧出现琥珀色小点表示"有未保存的修改"，保存成功后自动消失
- 有未保存修改时注册 `beforeunload`，关闭或刷新页面前弹系统确认，避免整张图白画
- 实测：改母线电压 → 小点出现；重新加载丢弃改动 → 小点消失

### 验证
- `npx tsc --noEmit` 无错，`npx eslint .` 无告警，`npx vitest run` 70 例全绿，`npm run build` 通过
## v2.9.4 - 编辑体验：属性面板补全 + 撤销重做外露

在 `cs` 小算例上实测暴露：选中母线只有"标签"一个输入框，开关的"类型"改不了，撤销/重做只有快捷键没有入口。

### 属性面板（`app/grid/[id]/edit/page.tsx`）
- 母线补"电压等级 (V)"，直接决定该段母线的运行电位；值为 0 时回落 380，不再显示 0
- 开关补"类型：断路器 / 母联"切换，选了母联时提示"只有左右两个端子，必须分别接到两段不同母线"
- 电源补"电源类型（市电 / 发电机 / UPS）"和"投运"勾选（取消勾选即视为检修停用，求解器按停运处理）
- 运行态开启并选中元件时，面板底部追加"运行态"区块：运行电压、端子带电数（x/4）、所在分段电压、负荷实际功率、电源当前出力、母联方式、电位冲突提示
- 所有电压输入统一收回 0 值，避免把母线写成 0 V

### 撤销 / 重做
- 顶栏加入撤销、重做按钮（`Ctrl+Z` / `Ctrl+Shift+Z` 仍可用），按历史栈深度自动置灰
- `pushHistory` / `restoreHistory` 同步维护 `canUndo / canRedo`
- "一键整理"也压入历史，手滑整理后可以一步退回
- 实测：初始两键均置灰 → 点"一键整理" → 点撤销，撤销置灰、重做点亮，坐标回到原样

### 验证
- `npx tsc --noEmit` 无错，`npx eslint .` 无告警，`npx vitest run` 69 例全绿，`npm run build` 通过
## v2.9.3 - 一键整理重写为电气分层布局

原来的 `autoLayout` 只按元件类型分横带（`BANDS` 常数），同类元件全塞同一排，220px 的间距又小于 240px 的卡片宽度——必然重叠，同一条支路上的元件也被扯开。重写为按拓扑分层的排布。

### 算法（`lib/grid/layout.ts` 整文件重写）
- 签名改为 `autoLayout(nodes, edges)`，从电源做 BFS 定层级：电源 0 → 变压器/开关 1 → 母线 2 → 负荷 3，没连上的元件按类型兜底
- 母联的层级强制对齐到母线那一排，横向位置按其左右母线取中位，落在两段母线之间（原来靠 `index+1` 硬凑位置）
- 4 趟重心排序（父/子中位序号，正反交替）决定同排的左右顺序，尽量让线不交叉
- 同排按 `NODE_W + 110` 逐列排开，再整体居中；之后两趟"单链拉直"把唯一父唯一子的元件对齐到父节点中轴
- 母联 y 取母线层中线，和母线视觉同高

### 接入
- `lib/grid/templates.ts`：`place(nodes, edges)` 接收边，三个模板建图即带正确层级
- 编辑页"一键整理"传 edges，整理后 `fitView` 动画落到全图，Toast 文案改为"电源在上、母线居中、负荷在下"
- 新增 `lib/grid/layout.test.ts`（4 条）+ 更新旧断言：分层有序、母联在两母线之间、同排间距 ≥ 240、单链保持竖直

### 验证
- `npx vitest run` 69 例全绿，`npx eslint .` 无告警，`npm run build` 通过
- 在 `车间` 电网（14 节点）实机点"一键整理"：两台电源在上、各经断路器接一段母线、母联夹在两段母线之间、四台负荷落底排，无重叠
## v2.9.1 - 实机验收后的画布与预览修复

对着真实浏览器截图改观感，把"黑画布"和"预览报错"两个现场问题修掉，顺手清了编辑页里的死代码。

### 画布（黑色画布根因）
- `app/globals.css`：`.react-flow__background` 强制 `background-color: transparent !important`。XYFlow 13 这一层会按 `prefers-color-scheme: dark` 自行铺 `rgb(20,20,20)`，压住节点与网格；保留透明让画布底色由 `<ReactFlow style>` 决定
- 画布改为"径向渐变 + 双层网格"：`radial-gradient(1100px 620px at 18% -8%, accentSoft, bg)` 给左上角一点光晕，`<Background id="minor" gap=20 size=1>` 细点 + `<Background id="major" gap=100 size=2>` 粗点定分区，不再是整片纯色
- 小地图改为中性色（结构用 panelBorder、母线用 muted、选中用 accent），不再五颜六色；遮罩色跟随明暗
- 深色皮肤卡片提亮：industrial `panel #1b2740 / panelBorder #3a4d6b`，schematic `#1a241c / #405240`，paper `#312922 / #52483c`

### 预览（模拟预览抽屉）
- 母线不再是"单输入"元件：`onConnect` 独占校验只对非母线、非母联生效，两路电源并联进同一段母线不再弹"该节点输入端口已连接一条线路"
- 抽屉内关闭按钮、日志条目、操作指南等 `bg-gray-50/100`、彩色渐变卡片全部换成 `pg-panel / pg-surface`，深浅色都跟皮肤走
- 系统状态四张卡从彩色渐变底改为面板底，颜色只留在图标上

### 校验文案
- `SECTION_DEENERGIZED` 原来把 `busIds.length` 当段号，出现"第 1 母线"的误导；改为按母线名称输出，无负荷时明确写"该段无负荷，母线带电状态未知"

### 清理
- 删除编辑页从未接入 UI 的对齐/分布工具（`alignNodes`、`distributeNodes`、`snapNodesToGrid`、`bringToFront`、`sendToBack`、两版 `distribute*WithGap`）与 `summarizeLint` 引用、`LoadNode` 的 `getLoadColor`；`onConnect` 补 `tokens.edgeIdle` 依赖

### 验证
- `tsc --noEmit` 0 错误、`eslint .` 0 warning、`vitest` 65/65、`next build` 通过

## v2.9.0 - 告警去抖、会话回放、拓扑模板与数据迁移

这一版把"能看"补成"能复盘、能开箱建图"，并把皮肤下沉到面板与元件本体。

### 监控（M3 收尾）
- `lib/grid/engine/debounce.ts`：`CheckDebouncer` 给校验清单加 3 秒宽限期——瞬态抖动不报，持续存在问题才 raised；问题消失立刻 cleared
- 模拟页接入去抖：每次求解与 5 秒采样都推进去抖器，事件统一从 `flushEvents` 出口 POST，草稿预览不写库
- 会话回放：每次操作/故障注入记一帧（上限 40 帧，含节点、连线、总功率、告警数），顶部滑杆可回看历史画面，回放中操作被禁用，可一键回到实时
- 说明：回放帧只存在本次会话内存，刷新即清空；跨会话历史回放仍需 `SimulationSample` 落库（见 ROADMAP）

### 建图（M5 收尾）
- `lib/grid/templates.ts`：四套模板（空白、单母单线、单母分段+母联、变压器进线），内部跑一键整理保证不叠图
- `POST /api/grids` 接受 `template` 白名单参数，创建即带拓扑
- 新建电网弹窗增加模板选择器（2×2 卡片），默认空白

### 数据（M6 收尾）
- `scripts/migrate-data.ts`：幂等迁移/体检脚本，剥掉入库节点与连线里的运行态字段、回填租户、检出重复节点/连线与悬空连线
- `npm run db:migrate-data` 只体检，`npm run db:migrate-data:apply` 才写库；已对 `prisma/dev.db` 执行一次（剥除 13 条连线的 `flow` 残留，备份 `prisma/dev.db.bak-m6`）

### 皮肤下沉（M4 收尾）
- `SkinTokens` 增加 `panel / panelBorder / panelMuted / radius / fontFamily`，输出 `--pg-panel*`、`--pg-radius`、`--pg-font`
- 编辑态与模拟态的全部节点卡片改用面板变量：皮肤换底色、圆角、字体，语义色（带电绿 / 失电灰 / 冲突红 / 断开红）固定不变
- 新增 `components/nodes/SymbolIcon.tsx`：IEC / 国标 / 简化 三套元件符号（电源、母排、开关与母联、变压器、负荷），设置页可切换，存 `pg.symbol`
- 模拟页与仪表盘的 `bg-white / text-gray-*` 改为 `pg-panel / pg-text / pg-muted` 工具类，跟随皮肤

### 验证
- `tsc --noEmit` 0 错误、`eslint .` 0 error（仅编辑页历史遗留的未使用函数 warning）、`vitest` 65/65、`next build` 通过
- 生产服务冒烟：`/login`、`/settings`、`/dashboard`、`/grid/{id}/simulate`、`/grid/{id}/edit` 均 200，未登录 `/api/grids` 401


## v2.8.0 - 拓扑 lint、一键整理与部署收尾

这一版解决"画错了但保存成功"的问题，并把交付形态补上。

### 编辑体验（M5）
- 新增 `lib/grid/engine/lint.ts`：悬空连线、母联单侧接线、电源无出线、母线无接线、孤立元件、端子复用、自环，共 7 类规则
- 校验分 danger / warning：danger 在保存前拦截并提示第一条原因，warning 只显示不阻塞
- 校验面板按严重级着色，点击条目可定位到对应元件
- 保存改用 `toPersistedNodes / toPersistedEdges`：修掉手工白名单丢失 `ratedVoltage`、`inService` 的问题
- 新增 `lib/grid/layout.ts` 与"一键整理"按钮：按 电源→变压器→母线→开关→负荷 重排，只改坐标

### 测试与文档（M6）
- 新增 `matrix.test.ts`：分段、并列、变压器降压、电源停运、变压器变比冲突五个结构回归
- 新增 `docs/SECURITY.md`：角色矩阵、租户隔离、字段白名单、响应头、未做的安全项
- 删除长期无人调用的 `/api/grids/[id]/state`（会把运行态写回设计数据的隐患路由）

### 部署
- 新增 `Dockerfile`（三阶段）与 `docker-compose.yml`（SQLite 挂载 `/data`，缺密钥拒绝启动）
- 新增 `.dockerignore`，README 增加"部署"章节

测试：53 → 58（新增 lint 8 例、matrix 5 例）
## v2.7.0 - React 19 / XYFlow 13 迁移与 M3 监控演练核心

消除 Next 16 对 React 18 的弃用告警，完成画布库与 React 生态的现代化升级，并落地 M3 监控演练的核心能力。

### M3 监控与演练（核心已落地）
- 新增 `GridEvent` 表与 `/api/grids/[id]/events`（GET/POST，租户过滤、字段白名单、单次 50 条上限）
- `lib/grid/engine/events.ts`：对校验清单做差分，同一问题只在"产生 / 消失"各记一次，避免重复刷屏
- 模拟页：首次求解作基线，之后仅记录变化；电源失电故障注入（仅内存、不写库）；总负荷 5 秒采样折线
- 测试数 39 → 45
- 仍待做：告警去抖与人工确认、采样历史落库与故障回放（见 ROADMAP M3）

### 依赖升级
- React / React DOM 18 → 19.3.1，`@types/react` / `@types/react-dom` → 19.3.0
- `reactflow` 11 → `@xyflow/react` 13，CSS 路径同步切换为 `@xyflow/react/dist/style.css`

### 破坏性适配
- 所有画布组件导入改为 `@xyflow/react`；`ReactFlow` 从默认导入改为命名导入
- 新增 `GridNode` / `GridEdge` / `GridNodeData` 共享类型，`useNodesState` / `NodeProps` 统一带泛型，避免 v13 的 data 类型收紧报错
- `ReactFlowInstance.project` → `screenToFlowPosition`
- `OnNodesChange` 参数由数组改为 `NodeChangeset`，历史记录判断改用 `Array.from(changes)`
- `edge` 数据补充索引签名；右键菜单事件兼容原生 `MouseEvent | React.MouseEvent`

### 回归验证
- `npx tsc --noEmit`、`npm run lint`（0 error）、`npm test`（45/45）、`npm run build`、`npm audit`（0 漏洞）全部通过
- 无头浏览器验证：编辑页 14 节点 / 13 边 / 29 端子正常渲染，模拟页带电状态与功率汇总正确，点击开关的操作确认弹窗（含预演信息）正常触发，控制台零错误

## v2.6.0 - Next.js 16 安全升级

清理上一轮审计残留的唯一 critical 依赖告警，完成框架 major 升级与回归验证。

### 依赖与安全
- Next.js 14.2.35 → 16.4.6，`npm audit` 从 1 critical / 12 其他告警降为 **0 漏洞**
- next-auth 4.24.15 保持（已声明支持 Next 16），会话与租户校验回归通过
- ESLint 8 / `next lint` → ESLint 9 Flat Config + CLI（`eslint .`），保留 Hooks 核心规则

### 破坏性变更适配
- 所有 Route Handler 的 `params` 改为 `Promise` 并 `await`；两个客户端页面改用 `useParams()`
- 启用 Turbopack 默认构建，`tsconfig.json` 自动补齐 `jsx: react-jsx` 与生成的类型路径
- 修正 React Compiler 新增规则误报：渲染期不再直接写入 ref，右键菜单改为直接条件渲染

### 回归验证
- `npx tsc --noEmit`、`npm run lint`（0 error）、`npm test`（39/39）、`npm run build` 全部通过
- 生产服务冒烟：登录/会话、电网 CRUD 读、日志读取、动态页面均正常；跨租户访问电网/日志/设备接口仍返回 404


## v2.5.0 - 租户隔离与工程门禁

本轮以依赖安全升级为契机，恢复工程门禁并补齐多租户与引擎正确性。

### 工程与依赖
- 恢复 ESLint，`npm run lint` 重新纳入工程门禁；构建在依赖升级后验证通过
- 依赖安全升级：Next.js 14.2.35、next-auth 4.24.15+、Vitest 5

### 多租户隔离
- `User` / `PowerGrid` 增加 `tenantId`，电网与账号归属租户
- 电网 CRUD、设备清单与操作日志 API 按当前会话 `tenantId` 过滤，跨租户不暴露资源
- OPERATOR 只能查看并模拟被授权租户内的电网，不能跨租户操作

### 引擎与正确性
- 修复功率守恒问题，功率汇总与进线总功率口径一致
- 修复引擎边界：运行态与设计态进一步分离，`/state` 路由保留但禁止写回运行态

### 功能与文档
- 新增草稿预览，模拟前可预演操作结果
- 皮肤体系收尾（三套皮肤 × 明暗，设置页切换）
- README / CHANGELOG / ROADMAP / USAGE 同步到 v2.5.0 现状

## v2.3 - 语义与工程化整理

本次把停留在 v1.0.1 的文档追平代码，并固化此前的重构。

### 求解与建模
- 新增变压器元件（有向，二次侧按 `ratio` 换算电压）
- 新增母联（`switch/subType=tie`）双向联络，左右端子
- 求解器增加环网交叉边（`loop`）与多源电压冲突（`conflict`）标记
- 边电压改为按端点元件类型推导，变压器二次侧按变比换算
- 补 9 个求解器单元测试（多源、母联、变压器、开断、环网、冲突）

### 接口与权限
- 抽取 `requireRole()`：未登录 401、角色不符 403，替换各路由的散装判断
- 电网保存与设备清单同步合并进同一事务，避免半成功
- 操作日志接口支持分页（`page` / `pageSize`，上限 100）
- 模拟状态保存前校验电网存在（404）
- 设备清单导出支持 `json` / `csv`（带 BOM）

### 数据
- `OperationLog` 增加 `gridId` 索引
- `Equipment.type` 增加 `transformer`
- 种子口令改由 `SEED_PASSWORD` 控制，源码不再硬编码

### 仓库
- 移除误提交的 `power-grid-simulator.zip`
- `.env.example` 入库；`README` 重写；新增 `docs/ROADMAP.md`

## v1.0.1 - 修复 Bug

### Bug 修复
1. **修复数据解析错误** - 修复了 "nodes.forEach is not a function" 错误
   - 增加了安全的 JSON 解析
   - 确保 nodes 和 edges 始终是数组类型
   - 添加了错误处理和日志

2. **修复数据库 Schema** - SQLite enum 兼容性
   - 将 Role enum 改为 String 类型
   - 保持功能不变，兼容 SQLite
