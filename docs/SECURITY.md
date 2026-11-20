# 安全与权限说明

本文记录当前版本的安全边界，便于交付前自查。它不是"安全认证"，只是如实说明做了什么、没做什么。

## 角色与权限

| 能力 | ENGINEER | OPERATOR |
| --- | --- | --- |
| 查看电网 / 设备清单 / 操作日志 | 是 | 是 |
| 新建电网、保存拓扑（整体覆盖） | 是 | 否 |
| 单设备操作（开关、启停、投退） | 是 | 是 |
| 写入运行事件 | 是 | 是 |
| 导出设备清单（json/csv） | 是 | 是 |

所有 API 统一走 `requireRole()`：未登录返回 401，角色不符返回 403。

## 租户隔离

- `User` / `PowerGrid` / `GridEvent` 均带 `tenantId`，会话 JWT 每次请求回查数据库，角色变更即时生效。
- 按 id 访问电网的接口一律经 `getScopedGrid(session, id)`，查不到或不属于本租户统一 404（不区分"不存在"与"无权"）。
- 日志查询强制 `grid.tenantId = 当前租户`，不传 `gridId` 时也只返回本租户。
- 事件写入校验电网归属，避免往别人的电网里灌数据。

## 数据完整性

- 运行态（带电、电位、流向、并列方式）**永不落库**；可写字段白名单为 `status / closed / running / inService / label`。
- 保存拓扑走 `toPersistedNodes / toPersistedEdges`，只剥运行态与渲染态，保留 `ratedVoltage / inService / closed / running / ratio` 等设计参数。
- 保存与设备台账同步在同一事务内，避免"图存了、台账没更新"。
- 前端拓扑 lint 在保存前拦截 danger 级问题（悬空线、母联单侧、电源无出线）。

## 传输与响应头

`next.config.js` 全站加：`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: SAMEORIGIN`；`/api/*` 额外 `Cache-Control: no-store`。未启用严格 CSP（Next 内联脚本会受影响），这是明确的取舍。

## 密钥与部署

- `.env` 不入库；`.env.example` 只放键名。
- 生产必须设置 `NEXTAUTH_SECRET` 与 `SEED_PASSWORD`，`docker-compose.yml` 用 `${VAR:?}` 强制校验，缺失直接拒绝启动。
- 种子默认口令仅在开发环境（未设 `SEED_PASSWORD` 且 `NODE_ENV !== production`）使用。

## 已知未做（如实记录）

1. 无登录失败限流与验证码，公网暴露前应加反向代理层的限流。
2. 无多因素认证，账号体系只有用户名 + 密码（bcrypt）。
3. SQLite 单写者：适合单厂区、低并发；多人同时编辑同一张图仍可能后写覆盖先写，需要乐观锁或版本号才能根治。
4. 无字段级审计（谁改了哪个坐标），只有操作日志与运行事件。
5. 未做渗透测试，`npm audit` 当前 0 漏洞，但依赖漏洞是动态的，建议纳入 CI 定期跑。