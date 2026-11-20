# 更新日志

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
