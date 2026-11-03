# 政府监管模块

独立政府监管子系统，包含主体办事、公众查询、移动执法与监管运营。

## 工程

- `frontend/`：主体办事与公众查询 PC 端，Vite + React + Ant Design。
- `mobile/`：移动执法端，Vue 3 + uni-app，同一源码构建 H5、微信小程序和 App。
- `ops/`：监管运营端，Vite + React + Ant Design。
- `src/`：Spring Boot 后端，默认连接 MySQL `agri_government`。
- `database/init-agri-government.sql`：DBA 建库入口。

## 后端

```powershell
mvn -s C:\Users\71502\.m2\settings.xml -Dmaven.repo.local=C:\maven\repository -pl agri-government -am -DskipTests package
java -jar agri-government/target/agri-government-1.0.0.jar
```

默认地址 `http://localhost:8095`。可通过以下变量覆盖数据库配置：

- `AGRI_GOVERNMENT_DB_URL`
- `AGRI_GOVERNMENT_DB_USERNAME`
- `AGRI_GOVERNMENT_DB_PASSWORD`

无 MySQL 环境可使用 `--spring.profiles.active=h2` 运行内存数据库。

建表分两层：`schema.sql` 是两端共用的建表与种子，`schema-mysql.sql` 只放 MySQL 方言的
幂等补列、建索引和"姓名→ID"回填（`application-mysql.yml` 按顺序加载两者）。
新增列必须同时补进种子的可显式列清单——位置式 `INSERT INTO ... VALUES` 加列后会静默错位。

## 移动执法端

```powershell
cd agri-government/mobile
pnpm run build:h5
pnpm run build:mp-weixin
pnpm run build:app
```

- H5：`dist/build/h5`
- 微信小程序：`dist/build/mp-weixin`
- App：`dist/build/app`

小程序和 App 的 API 域名通过 `VITE_GOVERNMENT_API_BASE` 注入，要求 HTTPS。微信正式发布前还需填写小程序 AppID 并配置 request 合法域名；App 资源使用 HBuilderX 完成原生签名和安装包制作。
统一认证地址通过 `VITE_GOVERNMENT_AUTH_BASE` 注入，示例见 `mobile/.env.example`。

## 本地端口

- 用户端：5181
- 移动端：5182
- 运营端：5183
- 后端：8095

网关发布端口分别为 8108、8109、8110。

## 统一登录与权限

政府监管不再维护独立登录账号。用户端、移动执法端和运营端统一使用丰链云账号；
PC 端使用 OAuth2 授权码 + PKCE，移动端使用统一账号密码并校验平台 RBAC。

| 入口 | SSO client_id | 必要权限 |
| --- | --- | --- |
| 用户端（主体办事） | `gov` | `gov:citizen` |
| 公众查询（公示与溯源核验） | `gov` | 免登录（`platform.rbac.public-paths`） |
| 移动执法端 | `gov` | `gov:inspector` |
| 监管运营端 | `gov-ops` | `gov:admin` |

基础权限为 `gov:read`、`gov:write`。`FARMER` 默认具备用户端权限，`MARKET_OPS`
默认具备运营端权限；移动执法人员由平台运营分配 `GOVERNMENT_INSPECTOR` 角色。
后端所有 `/api/**` 均要求平台令牌：未登录返回 `401`，角色不匹配返回 `403`。

移动执法端的写操作还要过平台能力闸门 `gov.oversight`，该能力来自一份**已通过的
「政府人员」业务身份申请**（`platform_identity_application`），只给角色不给身份会 403。

## 身份由令牌解析（不再有写死的"我是谁"）

`GET /api/v1/government/identity` 是唯一身份解析入口，三端都只读不算：

| 解析链 | 用途 | 失败时 |
| --- | --- | --- |
| 令牌 → 经营主体 → `gov_subject.merchant_id` | 主体端能办谁的事故、看谁的证照与通知 | 403 并提示"请在监管主体台账完成绑定" |
| 令牌 → 平台用户 → `gov_user.platform_user_id` | 执法端"我的任务/我的案件/我的取证/我的收件箱" | 403 并提示"请联系平台运营开通执法账号" |

两条绑定都由运营端显式建立：`PUT /ops/subjects/{id}/merchant-binding`、
`PUT /ops/users/{id}/platform-binding`（同名不等于同一家，不按名字猜）。
数据范围一律按解析出的 `subject_id` / `assignee_id` / `handler_id` 过滤，
`gov_message` 的收件人也由这两条绑定决定，写操作同时留痕到 `gov_op_log`。

现场取证写 `gov_evidence`（编号、SHA-256 摘要、承办人、任务/案件归属、是否离线暂存），
现场检查的逐项结论写 `gov_task_check`，勾选项来自 `gov_check_item` 模板表：
`GET/POST/PUT /ops/check-items`、`POST /ops/check-items/{id}/toggle`（停用只影响新建任务）。

## 验证

```powershell
node scripts/provision-gov-access.mjs      # 开通执法账号 + 业务身份 + 两条绑定，16 项断言
node scripts/e2e-government-flow.mjs       # 接口级主链路（含越权、状态机、残留归零），129 项
node scripts/check-gov-ui.mjs              # 三端真浏览器点检（含溯源核验读生产域），81 项
node ops/ci/verify.mjs                     # schema ↔ 实体一致性
```

`check-gov-ui.mjs` 会临时建举报、检查项、执法任务与取证记录，跑完按"建前最大 id"清理，
并还原被改动的种子状态（预警分派结果、收件箱已读标志、主体绑定）。演示口令 `Admin@123`
仅限本地，生产必须换掉。

## 溯源核验的数据来源

公众查询页与移动执法端的扫码核验**不读本域任何表**，而是走生产域的公开核验入口
`GET /api/v1/production/trace/public/verify/{code}`（配置项 `agri.production.url`，默认 8092）：

- 码是否存在、状态是否有效，由生产域判断（软删的码不参与核验）；
  **有效期也归生产域判**：`verifiable` 不只看状态，还按 `expiry_date` 兜一层
  （生产域的到期扫描是每小时的，两次之间状态可能还是 `active`），
  出参另给 `expiryDate / expired`，过期码的结论会写明"有效期 X 已过，不再作为核验依据"；
  本模块不再自己拼状态文案，两端（公众查询、移动执法）共用生产域返回的状态与
  `ProductionTraceClient#statusText` 一处映射，已过期一律显示"已过期"；
- 每条链路节点的 `attested / onChain / chainStatus / txHash / recordNo` 按生产域
  `agri_prod_chain_record` 的**真实存证记录**匹配得出 —— 有记录且状态 SUCCESS 才算已上链；
  没匹配到就写"未上链"，PENDING/FAILED 也照实说（FAILED 带 `failedReason`）。
  存证覆盖四类业务：`HARVEST`（批次号）/ `QUALITY`（质检单号）/ `TRACE`（溯源码）/
  `INPUT`（投入品使用记录 ID）。
  生产域属主侧的全链路走的是**同一处判定**，所以监管页与属主页对同一批次不会有两种说法；
- `verified` 是三态：码无效 / 码有效但存证不全 / 全部节点已上链，页面分别标红、橙、绿；
- 生产域不可达时返回 503 并说明"没有给出结论"，**绝不退回本域种子表、也不把"没查到"显示成"核验通过"**。

`gov_trace_event` 仍在库里，但只作为监管侧的历史归档被"追溯管理"维度计数（文案已写明
"本域归档 N 条…实时存证以生产域核验结果为准"），不再是核验数据源。

## 已知边界

- ~~生产域属主侧全链路的 `onChain` 是代理判断、`txHash` 空~~ **已于 2026-11-01 修掉**：
  属主侧 `/trace/full-chain/**` 与核验视图现在共用生产域同一处判定（`agri_prod_chain_record`，
  SUCCESS 才算已上链，PENDING/FAILED 连原因一起给），两边不可能再对同一批次给出不同结论；
  `scripts/e2e-production-flow.mjs` 里有逐节点同源的断言。
- ~~属主查询会看到已软删的溯源码~~ **是上一轮的误判**：生产域实体继承 `BaseEntity`，
  `deleted` 带 `@TableLogic`，MyBatis-Plus 自动补 `deleted = 0`。实测（2026-11-01）
  `/trace/codes` 只回未删的 2 条、`/trace/codes/{已删码}` 与公开核验都是 404。
  上一轮之所以在 SQL 里看到"已删码"，是因为回归脚本把软删写成 `deleted = id`（不是 1），
  那类非规范值已归一回 1，脚本也改成写 1。
- 报送与自查的 `chain_hash` 为空时如实显示"未上链"，本模块不代填链上凭证。
- 主体端证照变更、依申请公开没有自助入口，页面文案改为指向监管运营台账办理。
- 单条消息已读没有接口，页面只提供"全部已读"，不再假装能标记单条。
- 生产域存证里曾有 `target_type='2'` 这类脏值（历史表单把业务类型当数字传）——
  **2026-11-02 已迁移**：写侧现在只接受 `HARVEST / QUALITY / TRACE / INPUT` 四个字符串值
  （数字枚举直接报错），历史两条已按"业务键能查到才改"的规则归一成 `INPUT`。
  本模块的核验匹配只认这四类，其它值不会被算成某个节点的存证。

发布版本：

```powershell
node ops/gateway/scripts/publish.mjs --app gov --version 20261101-gov-trace-r1 --build
node ops/gateway/scripts/publish.mjs --app gov-mobile --version 20261101-gov-trace-r1 --build
node ops/gateway/scripts/publish.mjs --app gov-ops --version 20261101-gov-identity-r1 --build
```
