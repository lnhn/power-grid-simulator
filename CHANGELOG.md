# 更新日志

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