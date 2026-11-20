# 小型工厂电网模拟系统

面向小型工厂（车间/装置区）的单线图构建、通断模拟与设备台账管理工具。

当前版本：**v2.7.0**（电气语义 + 运行校验 + 多租户隔离 + 皮肤体系 + M3 监控演练核心 + Next 16 / React 19 现代化，见 [docs/ROADMAP.md](docs/ROADMAP.md)）

## 它解决什么问题

1. **构建**：用拖拽方式画出一张工厂单线图（进线 -> 母线 -> 馈线 -> 设备），并维护设备台账。
2. **模拟**：开合断路器、启停设备，实时计算哪一段带电、负荷由哪一路供电。
3. **追溯**：每一次操作都记录操作人、时间、对象；告警类事件按产生/消失差分留痕，支持按电网查询。

> 定位说明：当前是**电气语义模拟器**（带电/失电 + 分段 + 功率汇总 + 操作预演），不是潮流计算程序。阻抗、电压降与短路计算明确不在范围内，详见路线图。

## 技术栈

- Next.js 16.4.x（App Router，Turbopack 默认）+ React 19 + TypeScript
- XYFlow（@xyflow/react 13，画布与连线）
- Tailwind CSS 3
- Prisma 5 + SQLite
- NextAuth 4（Credentials + JWT，4.24.15+）
- Vitest 5（求解器单元测试）
- ESLint 9（Flat Config，直接通过 CLI 运行）

## 快速开始

```bash
npm install
npx prisma generate
npx prisma db push
npm run seed        # 初始化账号、租户与示例电网
npm run dev         # http://localhost:3000

# 旧库体检/迁移（幂等，只加 --apply 才写库）
npm run db:migrate-data
npm run db:migrate-data:apply
```

Windows 下也可用 `start.sh`（Git Bash / MSYS2）完成首次初始化。

环境变量见 `.env.example`：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | SQLite 路径，默认 `file:./dev.db` |
| `NEXTAUTH_SECRET` | 生产环境必须替换为随机值 |
| `NEXTAUTH_URL` | 站点地址 |
| `SEED_PASSWORD` | 种子账号初始口令；生产环境必填，本地缺省时回退为 `password` 并告警 |
| `SEED_TENANT_ID` | 种子账号与示例电网归属的租户，默认 `default` |

## 测试账号

| 账号 | 口令 | 角色 | 权限 |
|---|---|---|---|
| `engineer` | `password` | 工程师 | 创建/编辑电网、导出设备清单、模拟操作 |
| `operator` | `password` | 操作员 | 查看、模拟操作、导出设备清单 |

表中口令为本地开发缺省值，生产环境必须通过 `SEED_PASSWORD` 覆盖。账号与电网均归属某一租户，见下方「多租户隔离」。

## 多租户隔离

- `User` 与 `PowerGrid` 均增加 `tenantId` 字段；用户只归属一个租户，电网归属创建它的租户。
- 电网列表、详情、编辑、设备清单与操作日志等 API 一律**按当前会话的 `tenantId` 过滤**，跨租户访问返回 404（不暴露资源是否存在）。
- 模拟操作同样受租户约束：**OPERATOR 只能查看并模拟其被授权租户内的电网**，不能跨租户操作；ENGINEER 也只能在本租户内创建与编辑。
- 运行态数据不落库，租户隔离只作用于持久化的设计态与台账数据。

## 电气元件

| 元件 | 端子 | 说明 |
|---|---|---|
| 电源 `powerSource` | 底部输出 | 提供额定电压（默认 380V），始终带电 |
| 母线 `bus` | 四向互通 | 电力分配节点，四端口内部短接 |
| 断路器 `switch` | 上入下出 | 开/合决定是否通流，带额定电流 |
| 母联 `switch(subType=tie)` | 左右两端 | 两段母线之间的联络开关，双向 |
| 变压器 `transformer` | 上入下出（有向） | 二次侧电压 = 一次侧 × `ratio` |
| 负载 `load` | 上入 | 泵、风机、压缩机、加热器等，可启停 |

## 目录结构

```
power-grid-simulator/
├── app/
│   ├── api/
│   │   ├── auth/                        # NextAuth
│   │   ├── grids/                       # 电网 CRUD（按 tenantId 过滤）
│   │   │   └── [id]/
│   │   │       ├── operate/             # 单设备操作 PATCH（只写设计态字段）
│   │   │       ├── state/               # 模拟状态同步（保留，按租户校验，禁止写回运行态）
│   │   │       └── equipment/           # 设备清单查询与导出（json/csv）
│   │   └── logs/                        # 操作日志（分页）
│   ├── dashboard/                       # 电网列表
│   ├── grid/[id]/edit/                  # 编辑模式（画布 + 属性面板 + 校验）
│   ├── grid/[id]/simulate/              # 模拟模式（操作 + 状态 + 日志 + 草稿预览）
│   ├── equipment/                       # 设备台账
│   ├── logs/                            # 日志查询
│   ├── settings/                        # 外观设置（皮肤 / 明暗）
│   ├── login/
│   ├── layout.tsx
│   ├── providers.tsx
│   └── globals.css
├── components/
│   ├── nodes/                           # 编辑态/模拟态元件渲染器
│   ├── SkinProvider.tsx                 # 皮肤上下文（CSS 变量注入）
│   ├── ConfirmModal.tsx
│   └── Toast.tsx
├── lib/
│   ├── auth.ts                          # NextAuth 配置 + requireRole()
│   ├── prisma.ts
│   ├── skins/
│   │   └── tokens.ts                    # 皮肤 tokens / 注册表（三套皮肤 × 明暗）
│   └── grid/
│       ├── adapter.ts                   # ReactFlow <-> 端口模型
│       ├── rules.ts                     # 各元件端子与状态规则
│       ├── normalize.ts                 # 旧图数据归一化（只读）
│       ├── persist.ts                   # 入库前剥离运行态
│       ├── runtime.ts                   # 运行态只读叠加
│       ├── models/                      # NodeModel / EdgeModel / PortModel
│       └── engine/
│           ├── GridGraph.ts             # 端口图构建
│           ├── GridSolver.ts            # 求解入口与状态传播
│           ├── UnionFind.ts             # 等电位合并
│           ├── potential.ts             # 电位与变压器变比传递
│           ├── checks.ts                # 电气校验与问题清单
│           ├── power.ts                 # 功率汇总 / 电流换算
│           └── GridSolver.test.ts
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── dev.db                           # 本地库（不入版本库）
└── docs/ROADMAP.md                      # 改造路线图
```

## 数据模型

| 模型 | 说明 |
|---|---|
| `User` | `username` / `password`(bcrypt) / `role`(ENGINEER\|OPERATOR) / `tenantId` |
| `PowerGrid` | `name` / `nodes` / `edges`（ReactFlow JSON 字符串）/ `tenantId` |
| `OperationLog` | 操作人、电网、动作、目标元件、时间、详情 |
| `GridEvent` | 运行事件（告警产生/消失）：级别、代码、目标元件、快照、`tenantId` |
| `Equipment` | 设备台账，保存电网时由节点同步生成（含子类型/功率/电压/电流） |

## 已知限制（v2.9.0）

- 会话回放只保留本次页面的最近 40 帧，刷新即清空；跨会话回放需要 `SimulationSample` 落库（未做）；
- 告警去抖宽限期固定 3 秒，未做成可配置项；
- 皮肤覆盖面板、节点卡片、字体与圆角，但导出（SVG/PDF）与打印仍走默认样式；
- 功率仍是"汇总"口径（不含阻抗与压降），不是潮流解。

仍然是**电气语义模拟器**，以下边界如实记录：

1. **不做阻抗 / 电压降 / 短路计算**：电位按拓扑与变压器变比传播，电力分配不依赖线路参数；不含 IEC 60909 短路电流与电压跌落。
2. **功率是汇总，不是潮流**：按"电源端口生成树 + 负荷沿父边回推"分配，多电源场景按首次到达的供电路径归属，电源出力与边功率同口径；没有阻抗、没有电压降、没有网损，界面标注为"功率汇总"。
3. **变压器为有向模型**：只按一次侧 → 二次侧 × `ratio` 传递；当前未实现反送电（二次侧向一次侧倒送）的建模，该场景不在支持范围内。
4. 电流按 `I = P / (√3 · U · cosφ)` 估算，默认 cosφ = 0.85，不做温升与载流曲线校核。
5. 开关载流校验只跟 `ratedCurrent` 静态比较，不考虑短时过载与保护动作时间。
6. 没有短路计算与继保整定；告警已做"产生/消失"差分落库 + 3 秒去抖（瞬态抖动不刷屏），负荷趋势为前端 5 秒采样折线，会话内可滑杆回放；**跨会话回放与采样落库**仍未实现（M3 待做部分），人工确认（操作票/五防）按既定优先级排在最后。
7. 依赖安全：v2.6.0 已升级到 Next.js 16.4.6（App Router 的 `params` 全部改为异步读取，`next lint` 改为 ESLint 9 CLI），`npm audit` 当前为 **0 漏洞**。
8. 画布库：v2.7.0 已将 `reactflow` 11 迁移到 `@xyflow/react` 13，并升级到 React 19；旧包名与 CSS 路径不再使用。

已修复的历史问题（v2.3 → v2.4 → v2.5）：

- 电位沿拓扑传播（并查集 + 变压器变比逐级换算），母线显示实测电压；
- 运行态与设计态分离，模拟不再把 `voltage:0` 写回数据库；
- 母联端子身份由 `handle` 决定（几何仅作旧数据兜底），断开的母联不再静默导通；
- 双电缆并联、母联合环均按电气节点判定，不再只看单一连线；
- 变压器降压后并列不再误报电压冲突；
- v2.5.0 修复功率守恒与引擎边界问题，并恢复 ESLint 门禁；
- v2.6.0 完成 Next 16 安全升级，异步 `params`、Flat Config ESLint 与跨租户校验均已回归验证；
- v2.7.0 完成 React 19 + XYFlow 13 迁移，画布渲染、带电状态与操作确认链路已用无头浏览器回归；同期落地 M3 核心：运行事件差分落库、电源失电故障注入（仅内存）与负荷趋势采样。

## 部署

### 本地生产模式

```bash
npm ci
npx prisma generate
npx prisma db push
npm run seed          # 需要先在 .env 设置 SEED_PASSWORD
npm run build
npm run start
```

### Docker

```bash
# 必须提供两个密钥，缺一个就拒绝启动
export NEXTAUTH_SECRET="$(openssl rand -base64 32)"
export SEED_PASSWORD="换成你自己的初始口令"

docker compose up -d --build
docker compose exec power-grid npx tsx prisma/seed.ts   # 首次初始化账号
```

数据库文件挂在 `./data/dev.db`，容器重建不丢数据。备份只需复制该文件（先停容器）。

## 开发

```bash
npm test          # Vitest 5：求解器用例
npm run lint      # ESLint 9 Flat Config 工程门禁
npm test          # Vitest：求解器、lint、模板、去抖、矩阵回归共 65 例
npm run build     # 依赖升级后已验证通过
```

新增元件类型：在 `lib/grid/rules.ts` 注册规则 -> 在 `components/nodes/` 增加渲染器 -> 在编辑/模拟页注册 `nodeTypes`。

## 许可证

MIT

