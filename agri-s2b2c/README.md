# S2B2C 模块

包含消费者商城、商家端和平台运营端（含整合收敛的供货工作台业务），默认使用独立 MySQL 数据库
`agri_s2b2c`。

## 访问地址

| 端 | 正式地址 | 开发地址 |
| --- | --- | --- |
| 消费者端 | http://127.0.0.1:8082/ | http://127.0.0.1:3000/ |
| 供应商端（已合并至平台运营端供货工作台） | http://127.0.0.1:8103/supply | - |
| 商家端 | http://127.0.0.1:8085/ | http://127.0.0.1:3002/ |
| 平台运营端 | http://127.0.0.1:8103/ | http://127.0.0.1:3003/ |
| 消费者移动端（H5） | http://127.0.0.1:8182/ | http://127.0.0.1:5197/ |
| 供应商移动端（H5）（已停用并收敛至平台端） | - | - |
| 商家移动端（H5） | http://127.0.0.1:8184/ | http://127.0.0.1:5199/ |
| 后端 | http://127.0.0.1:8088 | - |

## 数据库

默认连接 `root/root@127.0.0.1:3306/agri_s2b2c`，可通过以下变量覆盖：

- `S2B2C_DB_URL`
- `S2B2C_DB_USERNAME`
- `S2B2C_DB_PASSWORD`

## 统一账号与权限

S2B2C 不再维护独立登录账号。消费者端、供应商端、商家端、平台运营端及三个移动端
均使用丰链云统一用户名和密码，并由平台 RBAC 判定角色权限。

| 端 | SSO client_id | 必要权限 |
| --- | --- | --- |
| PC / H5 消费者端 | `mall-consumer` | `s2b2c:consumer` |
| 平台运营端供货工作台（原供应商业务） | `s2b2c-platform` | `s2b2c:admin` / 平台供货角色 |
| PC / H5 商家端 | `mall-channel` | `s2b2c:channel` |
| 平台运营端 | `s2b2c-platform` | `s2b2c:admin` |

通用权限为 `s2b2c:read`、`s2b2c:write`；供应商履约使用 `s2b2c:fulfillment`。
`FARMER` 角色默认开通消费者权限，`MARKET_OPS` 默认开通平台运营权限。
供应商和商家账号由平台运营分配 `S2B2C_SUPPLIER` / `S2B2C_CHANNEL` 角色。

PC 端使用 OAuth2 授权码 + PKCE；H5、微信小程序和 App 使用统一账号密码登录后，
再调用平台权限接口校验角色权限。`agri-s2b2c` 后端所有 `/api/**` 请求均要求平台
访问令牌，未登录返回 `401`，角色不匹配返回 `403`。

应用启动时执行 `src/main/resources/schema.sql`。H2 仅用于测试：

```powershell
java -jar target/agri-s2b2c-1.0.0.jar --spring.profiles.active=h2
```

## 核心业务

- 消费者：商品、购物车、下单、支付、收货、地址、领券、秒杀、拼团、溯源和售后。
- 供应商：入驻、商品创建与编辑、订单查看、审核进度。
- 商家：平台选品、货架商品、订单、佣金、营销素材和售后协同。
- 运营端：供应商/商家/商品审核、类目、订单发货、售后审核、佣金结算和增长看板。

## 资金口径与身份收口（2026-11-02）

**佣金什么时候才能结给渠道。** 佣金在**下单时**就按订单金额生成并置 `PENDING`，
而「批量结算」原先只按 `status='PENDING'` 筛、**完全不看订单状态** ——
买家不付款、付款后退款，运营端点一次结算就能把钱结给渠道，渠道再提现、平台打款。
现在判定收成一处 `CommissionSettlementRule`：

| 订单状态 | 能不能结算 | 页面/回执说什么 |
| :-- | :-- | :-- |
| `PENDING_PAY` | 否 | 买家尚未付款 |
| `PENDING_SHIP` | 否 | 订单未发货 |
| `SHIPPED` / `PENDING_RECEIVE` | 否 | 买家尚未确认收货 |
| `CANCELLED` / `REFUNDED` | 否 | 订单已取消 / 已退款 |
| `REFUNDING` | 否 | 订单退款中，等退款结论 |
| `COMPLETED` 且有进行中售后 | 否 | 订单有处理中的售后 |
| `COMPLETED` 且无进行中售后 | **是** | 进批次，佣金转 `SETTLED` |

- 结算回执必须带 `blockedCount / blockedAmount / blocked[]`：只回"结算 0 笔"会被读成"没有佣金"，
  而事实往往是"有 N 笔订单还没走完"。运营端 `Settlement.vue` 因此常驻「本次结算结果」面板逐条列原因。
- 渠道可提现余额只累计 `SETTLED`（`ChannelPartnerController.sumCommission`），
  所以这张表真正守住了"钱在货成交之后才出去"。
- 状态词表、中文文案、允许的流转、"哪些算已支付"统一到 `OrderStatus` 一处；
  `OrderServiceImpl.updateStatus` 换成 `changeStatus`，**待付款的单不能确认收货、不能发货**，
  被拒时回的是「订单「待付款」不能已完成」而不是"操作失败"。
  `ChannelGradeService` 与售后申请的状态列表也改为读它，不再三份各写一遍。

**身份只从令牌取。** `ExperienceController` 里五个端点原先把 `consumerId / channelId` 当身份用：
传别人的号就能替别人领券（还真的扣券库存）、读别人的券与售后、看任意渠道的佣金。
现在 `receiveCoupon / consumerCoupons / consumerAfterSales / createAfterSale` 一律用
`consumerIdentityService.current()`，`channelGrowth` 用 `channelIdentityService.requireCurrent()`；
多余的请求参数由 Spring 忽略，老前端不会因此报 400。
`/api/platform/order/ship` 补了归属校验：**有供应商档案的账号只能发自己店铺的订单**（403），
平台运营（无供应商档案）仍可代发 —— 这是两类调用者的真实区别。
结算操作人、提现审核人、打款人、商品审核人、对账单生成人全部改为取令牌账号（原先六处写死 `"平台运营"`，
审计字段等于装饰）；取不到时写 `unknown`，不冒充一个看起来像真名的字符串。

顺带修掉 `POST /api/consumer/address/add` 的 NPE：`isDefault` 是包装类型 `Boolean`，
请求体不传时 `if (address.getIsDefault())` 直接 500。

端到端：`scripts/e2e-s2b2c-money-guard.mjs` **50 项全绿**，真单走完
下单 → 支付 → 发货 → 确认收货 → 结算 → 提现 → 打款，并在每个"还不该给钱"的节点断言结算被挡住
（截图 `outputs/s2b2c-money-guard-20261102/`）。造出的订单/佣金/批次/提现/售后/券记录/收货地址
跑完全部删除，商品库存与销量、优惠券 `remain_count` 按本次件数还原。

## 一物一码溯源闭环（2026-11-03 收口）

**链路只有一份，在农业生产域。** 商城不再自己拼一段"溯源介绍"：
`ProductionTraceQueryService` 是唯一聚合处（按商品 / 按溯源码 / 按批次三个入口，出参同一形状），
渲染也只有一处 `TraceTimeline.vue`（PC 商品详情、PC 溯源查询页、移动端扫码页共用）。
两处各写一遍是本项目反复出现的病：同一个数据三个页面三个说法。

**三种结果必须是三句话**，压成"空列表"就等于把系统故障说成"这货没来历"：

| 出参 | 页面说什么 | 反例（改之前） |
| :-- | :-- | :-- |
| `bound=false` | 该商品尚未绑定生产批次（供应商去商品编辑页绑） | 全都显示"暂无溯源记录" |
| `bound=true, matched=false` | 绑定的批次在生产管理模块查不到（批次删了或编号填错） | 同上 |
| 生产域不可达（HTTP 503） | 溯源链路暂时连不上生产管理模块，这不是"没有溯源记录" | 同上 |
| 命中 | 种植/投入/质检/采收/入库/加工逐节点 + 链上结论 | —— |

### 扫码的人不该先注册

- 后端：`PublicTraceController` 挂在 `/api/public/trace/**`，`WebConfig` 把这一族从登录拦截里排除
  （只回链路节点、码状态、链上结论，不回价格库存客户数据）。
- 前端 PC：`frontend-consumer/src/config/public-paths.js` 登记 `['/trace']`，
  `bootstrapUnifiedSso` 在公开路径上**没有会话也照常挂载**（返回 `{ anonymous: true }`），
  且公开路径上的 401 **不再跳登录** —— 溯源页顺带拉一次商品下拉必然 401，
  跟着跳就等于扫码第一步是"请先登录"。
- 前端移动端：同一条判据落在 `mobile-unified-auth.handleUnauthorized(publicPages)` +
  `api.ts` 的 `PUBLIC_PAGES=['pages/services/index']`；未登录不再请求 `/consumer/marketing`
  私域接口（请求必 401，页面会把"没登录"弹成"登录已失效"），
  优惠活动页签改说"统一账号登录后显示"。
- 深链：`?code=AG…` 直接自动查询（PC `Trace.vue` 与移动端 `onLoad` 都认 `code`），
  停在「扫码溯源」页签，不再要求人手输一遍。

实测（无 cookie 的真实浏览器）：`http://localhost:8082/trace?code=AG010101202606010001` 直接出 11 个节点、
加工两道工序与「2/11 已上链」结论；`http://localhost:8182/#/pages/services/index?code=…` 同样直接渲染。

### 商品绑哪个生产批次，只有供应商本人能说了算

`s2b2c_product.prod_batch_no` 是新列：`src/main/resources/schema.sql` 里既有建表定义，
也带一条只在缺列时才执行的 `ALTER TABLE`（存量演示库不用手工补列）。绑与解的口径：

- 候选来自生产域且按**调用方令牌**取（`GET /api/supplier/production-batches`），
  所以选出来的必然是自己主体登记过的采收批次；
- 写入前 `requireOwnBatch()` 再核一次（`POST/PUT` 直接构造请求体塞别人的批次号 → 400，
  错误里说清"不在你所属经营主体名下"）；
- 清空即解绑，落库是 **NULL**：这一列的更新策略是 `FieldStrategy.IGNORED`（否则 `updateById`
  的 NOT_NULL 会跳过 null，"解绑"永远写不进去），代价是空串也会原样落库，
  所以 `ProductServiceImpl.normalizeBatchBinding()` 把空白统一压成 NULL ——
  库里"未绑定"只留一个写法，同一列既 NULL 又 `''` 的话，以后每个统计都得写两种条件。

### 商品编辑页曾经读错对象（本轮真发现的缺陷）

`ProductEdit.vue` 原来调 `GET /api/supplier/detail/{id}` —— 那是**供应商档案**详情，
按商品 id 传进去拿到的是"id 恰好等于这个数的供应商"，于是表单除了名字全是空，
而保存是整表提交：没显示出来的列（含 `prod_batch_no`）被写成默认值。
现在：

- 新增 `GET /api/supplier/product/{id}`，返回**实体全字段**（`ProductVO` 是列表页投影，
  缺 `categoryId/costPrice/stockWarning/detail/prodBatchNo`，用它回读就一定会漏列）；
  不是本主体的商品一律 **404**（不确认它存在）；
- 档案读不到就在页面顶部说明原因并**禁用「保存修改」**：读不全就不许写回；
- `watch(() => route.params.id)` 重新读档案：同一路由换参数不会重新挂载组件，
  否则表单带着上一条商品的（或读失败后的空）状态继续显示。

回归见 `scripts/check-supplier-batch-bind-ui.mjs`（20 项：读对档案 → 下拉里的批次确是生产域登记过的 →
链路预览 → 保存落库 → 重进仍显示 → 别人的商品读不到且按钮禁用 → 换 id 仍重读 → 解绑落 NULL → 还原开场值）。

### 深链到生产端的地址只有一个写法

生产端是 `createBrowserRouter`（history 模式），网关把 `/prod/` 当静态产物目录、业务路由在**根路径**上。
所以 `…/prod/#/production/...` 与 `…/prod/production/...` 都会落进生产端的 404 页；
正确形态是 `http://<host>/production/trace/full-chain?code=…`。拼装收在
`frontend-consumer/src/config/cross-module.js` 的 `productionChainUrl()` 一处。

顺带修掉生产端一个会吃掉深链的坑：`SsoHandoff` 跳统一认证时没带 `returnTo`，
未登录用户从商城点「在生产管理模块看全链路」→ 登录成功后落在**看板页**，那支码的链路根本打不开
（`agri-production/frontend/src/pages/sso/SsoHandoff.tsx`，改为把 `RequireAuth` 记下的原地址
存进 sessionStorage，回跳后仍打开原地址）。

端到端：`scripts/e2e-traceability-loop.mjs` **47 项全绿**，覆盖
"绑定 → 消费者读到真节点 → 按码与按商品同源 → 解绑再绑仍同源 → 加工工序在生产端登记并立刻进链 →
删除后链路同步少掉 → PC/移动端匿名渲染 → 深链落到生产端同一批次"，
以及四条负分支（绑别人的批次被拒、查无此码 404、未绑定 `bound=false`、越权读档案 404）。
供应商端真机点检 `scripts/check-supplier-batch-bind-ui.mjs` **20 项全绿**。

### 溯源点检的夹具账号（2026-11-03 补，红的是夹具不是产品）

`GET /api/supplier/production-batches` 只回**当前令牌主体名下**的采收批次（跨主体不可见是设计），
而演示账号 `supplier1` 的主体在 2026-11-03 14:08 被改绑到「五常大米专营有限公司」——名下 0 个批次，
下拉合法为空，两条溯源脚本从第一步就断。有批次的主体 2001（绿源农业合作社）名下的 `farmer/admin`
又没有 `s2b2c:supplier` 权限，且 `/api/supplier/**` 整族（含 `/apply`）被这个权限码拦着——
所以**没有"未入驻先申请"的口子**，这是口径而不是 bug。

于是新增幂等夹具脚本 `scripts/provision-supplier-with-batches.mjs`，四步全走产品自己的端点：

1. `POST /api/v1/admin/users` 建账号 `lvyuanshop`（角色 `S2B2C_SUPPLIER`）；
2. `POST /api/v1/admin/user-merchants` 绑到主体 `2001`（雪花号按字符串传，`Number()` 会丢精度）；
3. 身份申请 + 运营端审核通过 → `s2b2c.supplier` 能力成立（判定只认 `mall_supplier` 身份，见 `CapabilityFacadeImpl.isMallSupplier`）；
4. 账号自己 `POST /api/supplier/apply` → 平台 `PUT /api/platform/supplier/audit` 通过 → 有 `s2b2c_supplier` 行，能建商品。

两条脚本都改成 `E2E_SUPPLIER_USER`（默认 `lvyuanshop`）取夹具，比对基准也从"全库批次"收紧成
"**该账号主体名下**的批次"；点检里没有现成商品时**自建用例商品并物理删除**，不再改演示商品 1 的档案。
另一条同类坑：`/api/v1/production/process/{id}` 的删除是逻辑删除（`deleted=1`），
链路视图看不到了但行还在表里，所以脚本收尾按本轮工序号物理删并回库核对 `COUNT=0`。
浏览器侧还有一条：core-platform 的 `/authorize` 现在只认 `agri_sso_session_<clientId>`，
点检取会话要 `POST /api/v1/sso/login` 带 `clientId`（`login-standalone` 只写全局 Cookie，注入后会一路弹回登录页）。

### 本轮没有覆盖的分支（别当成已支持）

- **匿名只能看到链路，看不到商品本身**：`/api/consumer/**` 整族仍要求登录，
  所以扫码的人知道"这批西红柿哪来的"，却不知道"这盒卖多少钱、还有没有货"。
  要把商品浏览也放开，得单独开一组公开只读端点（价格库存属于经营数据，不能顺手放进 `/api/public`）。
- 公开核验端点**没有**限流与防码值枚举（`PublicTraceController` 顶部注释同样写了这条边界），上线前要在网关侧补。
- `ProductAdd.vue`（发布新商品）还没有批次选择器：新建的商品要**再进编辑页**绑定；
  后端 `POST /api/supplier/product/create` 已接受 `prodBatchNo` 并做同样的归属校验，只是页面没给入口。
- 商家端与运营端看不到"这个商品绑了哪个批次"：`ProductVO`（列表投影）没有这一列，
  只有供应商编辑页按实体全字段读得到。真要在货架上标"可溯源"，得先把列加进出参再谈展示。
- 移动端公开页的判定是**按页面路由**（`pages/services/index`）而不是按页签：
  未登录进这一页仍看得到"优惠活动/售后服务"两个页签的壳，只是内容改成"登录后显示"；
  点领取/提交会照旧送去登录页。

## 发布

```powershell
node ops/gateway/scripts/publish.mjs --app mall-consumer --version 20261026-s2b2c-sso-r1 --build
node ops/gateway/scripts/publish.mjs --app mall-supplier --version 20261026-s2b2c-sso-r1 --build
node ops/gateway/scripts/publish.mjs --app mall-channel --version 20261026-s2b2c-sso-r1 --build
node ops/gateway/scripts/publish.mjs --app s2b2c-platform --version 20261026-s2b2c-sso-r1 --build
node ops/gateway/scripts/publish.mjs --app mall-mobile --version 20261026-s2b2c-sso-r2 --build
node ops/gateway/scripts/publish.mjs --app mall-supplier-mobile --version 20261026-s2b2c-sso-r1 --build
node ops/gateway/scripts/publish.mjs --app mall-channel-mobile --version 20261026-s2b2c-sso-r1 --build
```

## 消费者移动端

`mobile/` 是基于 uni-app 的独立消费者移动端工程，和 Web 商城共用 S2B2C 接口：

```powershell
cd agri-s2b2c/mobile
pnpm install
pnpm dev:h5
pnpm build:h5
pnpm build:mp-weixin
pnpm build:app
```

- H5 产物：`dist/build/h5`
- 微信小程序产物：`dist/build/mp-weixin`
- App 产物：`dist/build/app`

微信小程序发布前需在 `src/manifest.json` 填写正式 `mp-weixin.appid`；
小程序和 App 发布时必须通过 `VITE_S2B2C_API_BASE` 指向已备案的 HTTPS API 地址。
认证与权限接口通过 `VITE_S2B2C_AUTH_BASE` 指向统一认证所在域名。示例见各移动端
目录的 `.env.example`。

供应商、商家的移动工程分别位于 `mobile-supplier/` 和 `mobile-channel/`，
三者使用相同的 uni-app 工具链，但登录态、菜单和业务接口按角色隔离。

## 消费者端（PC 商城，frontend-consumer）

`frontend-consumer/` 是按《S2B2C模块_消费者端PC原型_v1》重做的 PC 商城，与供应商端、
商家端、平台运营端共用 `frontend-shared/styles/s2b2c-admin.css` 的 `--s2-*` 品牌令牌
（绿 #12764a、价格 #d45b32、底 #f4f7f5），技术栈为 Vue 3 + Element Plus + Vite。

页面（36 个路由）按域划分：

| 域 | 页面 |
| --- | --- |
| 商城 | 首页、分类、商品列表、搜索、商品详情、溯源查询、渠道专柜 |
| 交易 | 购物车、确认订单、支付、支付结果 |
| 订单 | 订单列表、订单详情、物流追踪、售后申请、售后详情 |
| 互动 | 评价中心、发表评价、评价详情 |
| 营销 | 领券中心、我的优惠券、限时秒杀、拼团专区、拼团详情 |
| 账户 | 个人中心、会员中心、成长值、积分、积分商城、签到、收藏、足迹、地址、账户安全、消息 |
| 说明 | 模块边界（能力归属 + 跨模块跳转清单） |

接口边界：消费者端只调用 `/api/consumer/**`（消费者域），不复用 `/api/platform/**`、
`/api/supplier/**`、`/api/channel/**`。新增的消费者域接口在
`ConsumerEngagementController`：分类树、溯源码查询、物流轨迹、取消订单、消息中心、
收藏、足迹、评价、签到与积分、积分兑换；`ConsumerController` 增加购物车勾选
（`/cart/update?selected=`、`/cart/select-all`）。跨模块能力（货源主数据、生产溯源、
交易撮合）以跳转方式提供，集中在 `src/config/cross-module.js` 登记。

### 活动价口径（秒杀）

秒杀价由 `ActivityPriceService` 统一判定，同一套规则作用于商品列表、购物车与下单，
避免「页面 58、结算 68」：

- 命中条件：时间窗内、状态 `ACTIVE/RUNNING`、秒杀库存 &gt; 0；同商品多场次取最低价；
- 下单时按活动价落 `order_item.price`，并**乐观扣减** `flash_sale.remain_stock`；
- 超过 `per_user_limit` 不阻断下单，自动退回商品原价（避免购物车跨场次卡死）。

### 拼团口径

拼团不再只是展示价：`s2b2c_group_buy` 是活动模板，`s2b2c_group_instance` 是「这一团」，
`s2b2c_group_buy_order` 记录参团成员（本轮补齐 `instance_id / consumer_id / role`）。
`GroupBuyService` 负责校验与建单：

- 发起人按 `leader_price`（未配置则 `group_price`）、参团人按 `group_price`，**下单即按团价落单**；
- 一次只能结算一件活动商品（购物车只勾该商品），数量不超过 `per_user_limit`；拼团价与秒杀价互斥；
- 参团用 `UPDATE ... WHERE status='PENDING' AND joined_count<required_size AND expire_time>NOW()`
  做原子占位，并发下不会超员；同团每人只能参一次；
- 满员置 `SUCCESS`，到期未满在读取时惰性置 `FAILED`；**未成团退款由运营端处理**，消费者端只展示状态；
- 订单新增 `group_buy_id / group_instance_id`，订单列表与详情据此显示「拼团」标。
- 接口：`GET /api/consumer/group-buy/open`、`GET /api/consumer/group-buy/{id}`、
  `GET /api/consumer/group-buy/mine`；下单时 `POST /order/create` 带 `groupBuyId`（开团）或
  `groupBuyId + groupInstanceId`（参团）。

```powershell
cd agri-s2b2c/frontend-consumer
pnpm install
pnpm dev      # http://127.0.0.1:3000
pnpm build    # 产物 dist/
```

发布走网关版本目录（与其它四端一致）：

```powershell
node ops/gateway/scripts/publish.mjs --app mall-consumer --version <标签> --build
```

