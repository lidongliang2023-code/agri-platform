# S2B2C 模块

包含消费者商城、供应商端、小 B 渠道商端和平台运营端，默认使用独立 MySQL 数据库
`agri_s2b2c`。

## 访问地址

| 端 | 正式地址 | 开发地址 |
| --- | --- | --- |
| 消费者端 | http://127.0.0.1:8082/ | http://127.0.0.1:3000/ |
| 供应商端 | http://127.0.0.1:8084/ | http://127.0.0.1:3001/ |
| 渠道商端 | http://127.0.0.1:8085/ | http://127.0.0.1:3002/ |
| 平台运营端 | http://127.0.0.1:8103/ | http://127.0.0.1:3003/ |
| 消费者移动端（H5） | http://127.0.0.1:8182/ | http://127.0.0.1:5197/ |
| 供应商移动端（H5） | http://127.0.0.1:8183/ | http://127.0.0.1:5198/ |
| 渠道商移动端（H5） | http://127.0.0.1:8184/ | http://127.0.0.1:5199/ |
| 后端 | http://127.0.0.1:8088 | - |

## 数据库

默认连接 `root/root@127.0.0.1:3306/agri_s2b2c`，可通过以下变量覆盖：

- `S2B2C_DB_URL`
- `S2B2C_DB_USERNAME`
- `S2B2C_DB_PASSWORD`

## 统一账号与权限

S2B2C 不再维护独立登录账号。消费者端、供应商端、渠道商端、平台运营端及三个移动端
均使用丰链云统一用户名和密码，并由平台 RBAC 判定角色权限。

| 端 | SSO client_id | 必要权限 |
| --- | --- | --- |
| PC / H5 消费者端 | `mall-consumer` | `s2b2c:consumer` |
| PC / H5 供应商端 | `mall-supplier` | `s2b2c:supplier` |
| PC / H5 渠道商端 | `mall-channel` | `s2b2c:channel` |
| 平台运营端 | `s2b2c-platform` | `s2b2c:admin` |

通用权限为 `s2b2c:read`、`s2b2c:write`；供应商履约使用 `s2b2c:fulfillment`。
`FARMER` 角色默认开通消费者权限，`MARKET_OPS` 默认开通平台运营权限。
供应商和渠道商账号由平台运营分配 `S2B2C_SUPPLIER` / `S2B2C_CHANNEL` 角色。

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
- 渠道商：平台选品、货架商品、订单、佣金、营销素材和售后协同。
- 运营端：供应商/渠道商/商品审核、类目、订单发货、售后审核、佣金结算和增长看板。

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

供应商、渠道商的移动工程分别位于 `mobile-supplier/` 和 `mobile-channel/`，
三者使用相同的 uni-app 工具链，但登录态、菜单和业务接口按角色隔离。

## 消费者端（PC 商城，frontend-consumer）

`frontend-consumer/` 是按《S2B2C模块_消费者端PC原型_v1》重做的 PC 商城，与供应商端、
渠道商端、平台运营端共用 `frontend-shared/styles/s2b2c-admin.css` 的 `--s2-*` 品牌令牌
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

