# agri-platform 项目长期约定

## 前端发布（静态产物）
唯一入口：`node ops/gateway/scripts/publish.mjs --app <slug> --version <标签> --build`
- 脚本内部会跑 `tsc --noEmit` + `vite build --base=/<app>/versions/<version>/`，再切 `bucket/<app>/index.html` 指针。
- **版本目录不可变**：重发必须换新版本号；回滚用 `--repoint <旧版本>`。
- 已登记 slug 见脚本内 `APPS`（info / info-ops / info-mobile / trade / trade-mobile / portal / sso / mdm / finance …）。
- 本地网关 nginx 常驻，发布后**无需 reload**，静态文件直接生效。

## 本机踩坑（必看）
- **Git Bash 会改写 vite 的 `--base`**：`--base=/trade/...` 被 MSYS 转成 `C:/Program Files/...`，
  产物引用本机路径。执行 publish.mjs 时加 `MSYS_NO_PATHCONV=1`。
- **后端启动端口被沙箱劫持**：直接 `java -jar` 时 Tomcat 会绑到 `58858`（沙箱端口，已占用）并启动失败。
  必须显式加 `--server.port=<端口>`（命令行参数优先级高于环境变量）。
- 后台起服务用工具的 `run_in_background`，**不要**用 `&`（shell 退出会杀进程）。
- `npx vite` 在中文路径下可能静默失败；用 `node node_modules/vite/bin/vite.js` 直调。

## 子系统边界
- 交易撮合（agri-trade）是**商品/采购需求/撮合/洽谈**的唯一数据源。
- 信息资讯（agri-info）的供需大厅是 BFF：读 trade、字段映射，联系方式存本地 `info_sd_contact`。
- 信息资讯 PC 端**不再有发布表单**，只提供跳转入口（`src/trade-link.ts`）到
  `/member/seller?tab=publish` / `/member/buyer?tab=publish`，带 `returnUrl` 回跳。
- 移动端（含小程序）受运行环境限制，仍保留本地发布表单，但写入的同样是 trade 数据。

## 浏览器 E2E
- 无 puppeteer/playwright 依赖。用 Edge headless + CDP，Node 22 内置 `WebSocket` 即可驱动。
- 现成脚本（都在 `scripts/`，直接 `node scripts/xxx.mjs`）：
  - `e2e-info-publish-link.mjs`：供需发布跳转闭环，22 项断言。
  - `e2e-info-trade-data-closure.mjs`：接口层数据闭环（发布→大厅可见性→我的发布状态），12 项断言。
  - `e2e-info-mine-drawer.mjs`：供需大厅「我的发布」抽屉 + 智能匹配页，15 项断言。
- 测试账号：`13800000001 / Admin@123`（跳转闭环用）、`19900002005 / Test12345`（有大量供需数据）。
  SSO 登录页默认停在「手机号+验证码」标签，自动化需先点「账号+密码」。

## 供需数据规则（重要）
- 交易端卖家中心发布商品默认 `publish_status=pending`（配置 `product.publish-requires-audit`），
  **审核通过前不出现在任何大厅**；只有请求头 `X-Agri-Source: info` 才跳过审核直接上架。
  信息资讯改成跳转复用后，用户发完回大厅看不到自己的商品属正常，靠 UI 说明兜住，不要改审核策略。
- 采购需求发布即可见（`/public/demands` 不过滤状态）。
- 供应与需求是两张表、id 各自自增，**所有按 id 的接口都必须带 `type`**，否则会串到另一侧。
- **运营端审核台直接读写交易端**（`/api/trade/admin/product/page` + `/product/{id}/audit`），
  不要再接回 `info_supply_demand` / `info_sd_match` —— 那两张表用户端早就不写了，
  接回去就是审演示数据、审了也不生效。`InfoOpsRepository` 里已删除对应实现并留了注释。
- 审核三态要分开：通过 `published` / 驳回 `rejected` / 违规下架 `offline`。
  `/product/{id}/audit` 用 `action=offline` 表达下架，不要拿 `approved=false` 一律记 rejected。

## 本机账号与数据库
- `admin / Admin@123`：SUPER_ADMIN，可进运营端（`info:admin`）。
- `13800000001 / Admin@123`、`19900002005 / Test12345`、`19900002001 / Test12345`：普通账号。
- MySQL root 口令是 `root`（`C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe`），
  `agri_core` 库存 `platform_user` / `platform_role` / `platform_user_role`。
- **agri-info 已切回 MySQL**（`agri_info` 库，`createDatabaseIfNotExist=true`，`schema.sql` 是 MySQL 兼容写法）。
  起服务用 `--spring.profiles.active=mysql`，不要再默认用 h2 —— 内存库每次重启会清空 `info_sd_contact`，
  供需详情的联系电话会全部变空。

## 联系方式规则
- 交易模块**不公开联系方式**：`info_sd_contact` 只记录信息资讯自己发布时的联系人/电话，
  从卖家中心直接发布的商品没有这条记录。
- 因此 `fromProduct` / `fromDemand` 会从描述里兜底解析 `联系人：x　电话：x`；
  `fillContacts` 在无记录时**不得覆盖 contactName、不得清空 contactPhone**，否则详情页会出现「公司名 · 」空尾缀。
- 前端详情页无电话时显示「未公开电话，请通过站内沟通联系」，按钮置灰。




## 核心平台（core-platform）硬约定
- **Long 一律序列化成字符串**（防雪花 ID 超 JS 安全整数）。副作用：`total` / `count` / 统计数字也是字符串，
  前端做加法会变成拼接（`0+3+8+7+0` → `"03870"`）。所有统计类响应必须在前端归一化回 number。
- **实名通过态是 `verified`，不是 `approved`**。`platform_user_identity.status` 实际取值：
  `draft / pending / verified / rejected`。而 `platform_merchant.verify_status` 才是 `approved`。
  这两个词写反不会报错，只会静默统计出 0。
- `platform_user_identity` **没有 `deleted` 列**（其余 `platform_*` 大都有）。聚合 SQL 照抄 `WHERE deleted = 0` 会
  `Unknown column`。
- **表名必须匹配包前缀**（CI 门禁 `core-app/src/test/.../TablePrefixTest`）：
  `com.agri.platform.*` 下的 `@TableName` 必须 `platform_` 开头。用户中心的表是
  `platform_uc_*`（不是 `uc_*`）。`mvn package -DskipTests` **不会**发现这个违规，
  改动后要跑 `mvn -pl core-app -am test -Dtest='TablePrefixTest,ArchitectureTest'`。
- **改了已应用的迁移要连其后版本一起重跑**：删 `flyway_schema_history` 里 V(n) 及之后的记录，
  否则报 `Detected resolved migration not applied to database`（默认 outOfOrder=false）。
- 账号侧策略统一走 `AccountPolicyService`（读 `platform_uc_system_config`，30s 缓存，
  保存配置时 invalidate）。新增"可配置项"必须同时在它里面加读取方法并接到执行点，
  否则就是页面上的假开关。
- Flyway 迁移里**不能出现 `${...}`**（含注释），会被当占位符解析失败。写「花括号变量占位」这种描述即可。
- `platform_user` / `platform_role` / `platform_user_role` 在 `agri.market.ignore-tables` 里（全局表）；
  新增的全局表用 `@InterceptorIgnore(tenantLine = "true")` 旁路，不要往 yml 的 ignore 列表里堆。
- 核心平台启动要显式传口令：`MYSQL_PASSWORD=root java -jar core-app/target/core-app-1.0.0.jar --server.port=8093`
  （yml 默认 `root123`，本机是 `root`）。

## 新增运营端（前端产物）接入清单
1. `ops/gateway/scripts/publish.mjs` 的 `APPS` 加条目（frontendDir / title / accessUrl）
2. `ops/modules/catalog.json` 登记 deploymentUnit（id / kind=operator-frontend / port / publishApp / source）
3. `ops/gateway/conf/conf.d/` 新建 server 块：静态托管 `/xxx/versions/` + `/api/v1/...` 转发到对应上游
4. **SSO 客户端必须登记**，否则授权页直接 400「未注册的 client_id」：
   `SsoProperties` 默认表 + `application-dev.yml` 的 `agri.sso.clients` 两处都要加
5. 角色权限码：前端 `UnifiedSsoGate requiredPermissions` 用的码要真的在某角色 `permissions` 里
   （如 `uc:admin` 已加进 `MARKET_OPS`，`SUPER_ADMIN` 是 `*` 通配）
6. 发布必须带 `MSYS_NO_PATHCONV=1`（Git Bash 会改写 `--base`）

## 用户中心运营端（agri-sso/ops，:8115 / 网关路径 /user-center-ops/）
- 24 个页面，导航 11 组。后端全部走 `/api/v1/admin/**`（要求 SUPER_ADMIN / MARKET_OPS）。
- **复用既有 admin 接口**：用户、角色、身份申请、实名、资质、组织、反馈、隐私请求 —— 不重建。
- **新增 `uc_*` 六张表**：第三方应用 / 授权流水 / 消息模板 / 推送任务 / 冻结记录 / 参数配置。
- 运营端前端**没有** baseURL 前缀，完整路径写在每个方法里（admin 与 uc 不同前缀）。
