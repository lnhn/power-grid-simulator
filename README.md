# 化工厂电网模拟系统

一个基于 Next.js、TypeScript、Tailwind CSS 和 Prisma 的化工厂小型电网模拟应用。

## 功能特点

### 用户角色
- **工程师**：可以创建、编辑电网图，并进行模拟测试
- **操作员**：只能进行模拟操作，不能编辑电网

### 核心功能
1. **登录系统**：基于 NextAuth 的安全认证
2. **电网管理**：创建、查看、编辑多个电网
3. **可视化编辑**：
   - 拖拽添加电气元件（电源、开关、负载、母线）
   - 使用曼哈顿式连线
   - 编辑元件属性
   - 删除元件和连线
4. **实时模拟**：
   - 开关操作
   - 电流流动动画
   - 电路通断模拟
   - 实时状态显示
5. **操作日志**：记录所有操作（操作员、时间、操作类型）

## 技术栈

- **前端框架**：Next.js 14 (App Router)
- **UI 框架**：React 18
- **样式**：Tailwind CSS
- **流程图**：ReactFlow
- **数据库**：SQLite + Prisma ORM
- **认证**：NextAuth.js
- **语言**：TypeScript

## 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npx prisma generate
npx prisma db push
```

### 3. 填充初始数据
```bash
npx tsx prisma/seed.ts
```

### 4. 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:3000

## 测试账号

### 工程师账号
- 用户名: `engineer`
- 密码: `password`
- 权限: 可以创建和编辑电网

### 操作员账号
- 用户名: `operator`
- 密码: `password`
- 权限: 只能查看和模拟操作

## 使用指南

### 工程师操作流程

1. **登录**：使用工程师账号登录
2. **创建电网**：
   - 点击"创建电网"按钮
   - 输入电网名称和描述
3. **编辑电网**：
   - 从左侧面板拖拽元件到画布
   - 点击元件边缘的连接点拖拽连线
   - 按 Delete/Backspace 删除选中元素
   - 点击"保存"保存更改
4. **模拟运行**：点击"模拟运行"测试电网

### 操作员操作流程

1. **登录**：使用操作员账号登录
2. **选择电网**：从列表中选择要操作的电网
3. **模拟操作**：
   - 点击开关节点切换开关状态
   - 观察电流流动动画
   - 查看系统状态面板
   - 查看操作日志

## 电气元件说明

### 电源（Power Source）
- 提供 220V 电压
- 蓝色边框
- 始终处于运行状态

### 开关（Switch）
- 可以切换开/关状态
- 绿色边框表示闭合，红色边框表示断开
- 点击切换状态（仅在模拟模式）

### 负载（Load）
- 消耗电能的设备
- 琥珀色边框
- 显示功率和电压信息

### 母线（Bus）
- 电力分配节点
- 靛蓝色边框
- 可以多方向连接

## 项目结构

```
power-grid-simulator/
├── app/                      # Next.js App Router
│   ├── api/                 # API 路由
│   │   ├── auth/           # 认证 API
│   │   ├── grids/          # 电网管理 API
│   │   └── logs/           # 操作日志 API
│   ├── dashboard/          # 仪表盘页面
│   ├── grid/[id]/          # 电网详情
│   │   ├── edit/          # 编辑模式
│   │   └── simulate/      # 模拟模式
│   ├── login/              # 登录页面
│   └── globals.css         # 全局样式
├── components/              # React 组件
│   └── nodes/              # 自定义节点组件
├── lib/                     # 工具库
│   ├── auth.ts             # 认证配置
│   └── prisma.ts           # Prisma 客户端
├── prisma/                  # 数据库
│   ├── schema.prisma       # 数据模型
│   └── seed.ts             # 初始数据
└── types/                   # TypeScript 类型定义
```

## 数据库模型

### User（用户）
- username: 用户名
- password: 加密密码
- role: 角色（ENGINEER/OPERATOR）

### PowerGrid（电网）
- name: 电网名称
- description: 描述
- nodes: 节点数据（JSON）
- edges: 连线数据（JSON）

### OperationLog（操作日志）
- userId: 操作用户
- gridId: 电网ID
- action: 操作类型
- targetId: 目标元件ID
- timestamp: 操作时间

## 特色设计

1. **现代化UI**：采用浅色主题，渐变色设计
2. **实时反馈**：操作即时生效，动画流畅
3. **权限控制**：严格的角色权限管理
4. **操作追溯**：完整的操作日志记录
5. **响应式布局**：适配不同屏幕尺寸

## 开发说明

### 添加新的电气元件

1. 在 `components/nodes/` 创建新节点组件
2. 在编辑页面的 `nodeTypes` 中注册
3. 在模拟页面的 `nodeTypes` 中注册
4. 更新 `addNode` 函数添加新类型

### 扩展电路计算

修改 `calculateCircuitState` 函数实现更复杂的电路计算逻辑。

## 许可证

MIT License
