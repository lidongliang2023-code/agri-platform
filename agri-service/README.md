# 综合服务模块

综合服务模块包含 PC 用户端、移动端和运营端，后端默认使用 MySQL 数据库
`agri_service`。

## 本地地址

- 用户端：http://127.0.0.1:8105/
- 移动端 H5：http://127.0.0.1:8106/
- 运营端：http://127.0.0.1:8107/
- 后端：http://127.0.0.1:8094

开发模式端口分别为 `5194`、`5195`、`5196`。

## 统一用户与权限

综合服务不再维护独立登录账号。PC 用户端、移动端和运营端均使用丰链云统一用户；
PC 端采用 OAuth2 授权码 + PKCE，移动端使用统一账号密码并校验平台 RBAC。

| 入口 | SSO client_id | 必要权限 |
| --- | --- | --- |
| PC 用户端 / H5 | `service` | `service:consumer` |
| 服务商移动接单台 | `service` | `service:provider` |
| 运营端 | `service-ops` | `service:admin` |

通用权限为 `service:read`、`service:write`。`FARMER` 默认具备综合服务用户权限，
`MARKET_OPS` 默认具备运营权限，服务商账号由平台运营分配 `SERVICE_PROVIDER` 角色。
后端所有 `/api/**` 均要求平台令牌：未登录返回 `401`，角色不匹配返回 `403`。

## 数据库

默认连接为 `root/root@127.0.0.1:3306/agri_service`，可通过以下变量覆盖：

- `AGRI_SERVICE_DB_URL`
- `AGRI_SERVICE_DB_USERNAME`
- `AGRI_SERVICE_DB_PASSWORD`

建表与演示数据位于 `src/main/resources/schema.sql` 和 `data.sql`。

## 移动端

```powershell
cd agri-service/mobile
npm run build:h5
npm run build:mp-weixin
npm run build:app
```

- H5：`dist/build/h5`
- 微信小程序：`dist/build/mp-weixin`
- App 资源：`dist/build/app`

小程序和 App 的 HTTPS API 地址通过 `VITE_SERVICE_API_BASE` 注入。正式发布前需要填写
微信小程序 AppID、配置 request 合法域名；App 使用 HBuilderX 配置签名并执行原生打包。
统一认证地址通过 `VITE_SERVICE_AUTH_BASE` 注入，示例见 `mobile/.env.example`。

## 发布

```powershell
node ops/gateway/scripts/publish.mjs --app service --version 20261101-service-identity-r2 --build
node ops/gateway/scripts/publish.mjs --app service-mobile --version 20261101-service-identity-r2 --build
node ops/gateway/scripts/publish.mjs --app service-ops --version 20261101-service-identity-r2 --build
```

## 身份与数据范围

服务域的三端都不再接收"前端自报身份"。当前是谁、代表哪家主体，一律由访问令牌在服务端解析：

| 需要判断的身份 | 解析方式 | 解析不到时 |
| --- | --- | --- |
| 下单/发需求/投保的政策方 | 令牌 → 平台 `/platform/merchants/mine` → 经营主体号 | 403，并提示去平台「用户-主体绑定」配置 |
| 服务商（接单台） | 令牌主体号 → `service_provider.merchant_id` | 403，提示先完成档案绑定与入驻审核 |
| 运营操作人与来源 IP | 令牌声明 + `X-Forwarded-For`/`X-Real-IP` | 写不进审计日志就直接拒绝 |

因此私域表都带 `merchant_id`（`schema.sql` 建列、`schema-mysql.sql` 幂等补列并回填），列表与统计一律按主体过滤；
跨主体读取按 404 处理，不暴露"存在但不是你的"。服务商移动工作台的路径里已经没有 `providerId`。

## 验证

```powershell
node scripts/provision-service-access.mjs   # 服务商账号、档案绑定与"未绑定即拒绝"的自检
node scripts/e2e-service-flow.mjs           # 接口级主链路（身份、金额、状态机、越权、清理）
node scripts/check-service-ui.mjs           # 三端浏览器点检（真实登录点击 + CSV 下载 + 残留归零）
```

三个脚本都要在 core-platform :8093、agri-service :8094、gateway 8105/8106/8107 都在跑的前提下执行，
且**不要并行**跑：它们会读写同一批种子数据。临时数据按"建前最大 id"清理，被改动的种子逐条还原。

## 已知边界

- 演示账号密码统一是 `Admin@123`，上生产前必须改。
- 保险补贴比例、结算分账只记录结论，不触发真实资金动作；同一批次不允许重复复核。
- AI 初判是关键词规则库，没有接入拍照、视频与语音；合同页是**要素清单 + 可复算 SHA-256 摘要**，
  平台侧尚未接入第三方电子签章与司法存证。
- 资源、需求、订单里的联系方式对外一律脱敏，只有归属方自己与已接单服务商能看全号。
- 培训没有视频播放器，「推进 25%」是按学习行为累计进度的占位动作；进度到 100% 才由服务端签发证书。
- 服务商账号默认只有 `service:provider`，看不到消费侧数据；「我的」页会明确说明是权限不足而不是没有数据。
