# 小型工厂电网模拟系统

面向小型工厂（车间/装置区）的单线图构建、通断模拟与设备台账管理工具。

当前版本：**v2.3**（电气语义重建进行中，见 [docs/ROADMAP.md](docs/ROADMAP.md)）

## 它解决什么问题

1. **构建**：用拖拽方式画出一张工厂单线图（进线 -> 母线 -> 馈线 -> 设备），并维护设备台账。
2. **模拟**：开合断路器、启停设备，实时计算哪一段带电、负荷由哪一路供电。
3. **追溯**：每一次操作都记录操作人、时间、对象，支持按电网查询。

> 定位说明：当前是**连通性模拟器**（带电/失电 + 电流流向），不是潮流计算程序。电气量（电流、功率、负载率）在 v2.4 引入，详见路线图。

## 技术栈

- Next.js 14（App Router）+ React 18 + TypeScript
- ReactFlow 11（画布与连线）
- Tailwind CSS 3
- Prisma 5 + SQLite
- NextAuth 4（Credentials + JWT）
- Vitest（求解器单元测试）

## 快速开始

```bash
npm install
npx prisma generate
npx prisma db push
npm run seed        # 初始化账号与示例电网
npm run dev         # http://localhost:3000
```

Windows 下也可用 `start.sh`（Git Bash / MSYS2）完成首次初始化。

环境变量见 `.env.example`：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | SQLite 路径，默认 `file:./dev.db` |
| `NEXTAUTH_SECRET` | 生产环境必须替换为随机值 |
| `NEXTAUTH_URL` | 站点地址 |
| `SEED_PASSWORD` | 种子账号初始口令，默认 `password`（仅本地开发） |

## 测试账号

| 账号 | 口令 | 角色 | 权限 |
|---|---|---|---|
| `engineer` | `password` | 工程师 | 创建/编辑电网、导出设备清单、模拟操作 |
| `operator` | `password` | 操作员 | 查看、模拟操作、导出设备清单 |

口令由 `SEED_PASSWORD` 决定，可在种子前覆盖。

## 电气元件

| 元件 | 端子 | 说明 |
|---|---|---|
| 电源 `powerSource` | 底部输出 | 提供额定电压，始终带电 |
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
│   │   ├── grids/                       # 电网 CRUD
│   │   │   └── [id]/
│   │   │       ├── state/               # 模拟状态回写（v2.4 将改为快照）
│   │   │       └── equipment/           # 设备清单查询与导出（json/csv）
│   │   └── logs/                        # 操作日志（分页）
│   ├── dashboard/                       # 电网列表
│   ├── grid/[id]/edit/                  # 编辑模式（画布 + 属性面板 + 校验）
│   ├── grid/[id]/simulate/              # 模拟模式（操作 + 状态 + 日志）
│   ├── equipment/                       # 设备台账
│   ├── logs/                            # 日志查询
│   └── login/
├── components/
│   ├── nodes/                           # 编辑态/模拟态元件渲染器
│   ├── ConfirmModal.tsx
│   └── Toast.tsx
├── lib/
│   ├── auth.ts                          # NextAuth 配置 + requireRole()
│   ├── prisma.ts
│   └── grid/
│       ├── adapter.ts                   # ReactFlow <-> 端口模型
│       ├── rules.ts                     # 各元件端子与状态规则
│       ├── models/                      # NodeModel / EdgeModel / PortModel
│       └── engine/
│           ├── GridGraph.ts             # 端口图构建
│           ├── GridSolver.ts            # 带电传播与流向
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
| `User` | `username` / `password`(bcrypt) / `role`(ENGINEER\|OPERATOR) |
| `PowerGrid` | `nodes` / `edges`（ReactFlow JSON 字符串） |
| `OperationLog` | 操作人、电网、动作、目标元件、时间、详情 |
| `Equipment` | 设备台账，保存电网时由节点同步生成（含子类型/功率/电压/电流） |

## 已知限制（v2.3）

这些是路线图 M1/M2 要解决的问题，先如实记录：

1. 求解器只做**连通性**判断，不计算电流、功率、电压降。
2. **电压不沿拓扑传播**：连线电压取端点配置值，母线默认 0，因此电压配色分级基本失效。
3. **模拟状态会写回设计数据**：失电节点的 `voltage` 被置 0 并持久化，可能覆盖额定参数。
4. **母联端子靠坐标推断**：`inferSide` 对母联忽略 handle，两段母线可能被判到同一端子而静默合并，导致母联断开仍然导通。
5. 变压器降压后与另一路电源并列时，可能**误报电压冲突**。
6. 没有告警、趋势、故障注入与回放。

## 开发

```bash
npm test          # Vitest：求解器用例
npm run lint
npm run build
```

新增元件类型：在 `lib/grid/rules.ts` 注册规则 -> 在 `components/nodes/` 增加渲染器 -> 在编辑/模拟页注册 `nodeTypes`。

## 许可证

MIT