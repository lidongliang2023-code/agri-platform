# 交易撮合模块

交易撮合是独立部署的后端 + 独立前端工程：买家/卖家工作台与平台运营台在同一个 SPA 里
（路由 `/member/buyer`、`/member/seller`、`/admin/trade/**`），另有 uni-app 移动端。
业务数据落在 MySQL 库 `agri_trade`。

## 本地地址

| 入口 | 地址 |
| --- | --- |
| 用户端 + 运营端 SPA | http://localhost:8086/trade/index.html （任意路由刷新都回这个壳） |
| 移动端 H5 | http://localhost:8181/ |
| 后端 | http://localhost:8089（`--spring.profiles.active=dev` 时 8082，`h2` 时 8084） |
| 统一认证 | http://localhost:8090 |

`8086` 这个网关入口把 `/api/trade/**` 反代到交易后端、把 `/api/v1/**` 反代到核心平台，
所以受保护页面直达时会跳到 `:8090` 登录再回来（见 `ops/gateway/conf/conf.d/35-trade.conf`）。

## 身份与数据范围（经营主体）

**身份一律由服务端从访问令牌推导，请求体不参与"我是谁"的判断。**

- `PlatformIdentityService.currentScope()`：拿 Bearer 令牌调核心平台
  `/api/v1/platform/merchants/mine`，得到当前账号绑定的经营主体列表（`platform_merchant.id`）。
  结果按请求缓存一次；**平台不可达时不退化成"没有范围"**（那就是全量），而是报错让页面显示得出来。
- `selectMerchant(点名主体)`：一个人绑了多家时，交易动作必须点名用哪家，且点的必须是自己的；
  没绑主体就明确拒绝，不自动挑一家。
- 归属列是**参与方列**：`buyer_id` / `seller_id` / `merchant_id` / `applicant_id` / `recipient_id`。
  交易单据是双方的（一张订单同时属于买方与卖方），所以这里没有、也不该有单一 `tenant_id` 语义 ——
  表里遗留的 `tenant_id` 列以前被 23 个实体映射却从未由服务端写入，反而允许请求体往里塞值，
  本轮已删除这些映射（物理列保留，不参与判权，也不再可被伪造）。
- 跨主体的按 id 访问按"不存在"回（`报价不存在`），不说"存在但不是你的"——
  连号 id + 归属提示就是一个免费的探测接口。

## 交易类业务身份（写接口的第二道门）

`TradeCapabilityInterceptor` 对写方法按路径要一组业务身份：

| 路径 | 需要的能力（任一即可） |
| --- | --- |
| `/api/trade/seller/product/**`、`/api/trade/product/**` | `trade.wholesale` / `supply.farmer` / `coop.manage` |
| `/api/trade/demand/**` | `trade.wholesale` / `trade.retail` |
| `/api/trade/order|contract|negotiation|guarantee|compensation|dispute|invoice|logistics|evaluation/**` | 任一交易身份 |

两条豁免口径：

1. **运营端不在这道门里**：`/api/trade/admin/**` 与标了 `@OperatorOnly` 的接口是平台运营的动作
   （审核退款、核准赔付、冻结保证金…），准入由平台 RBAC 的 `trade:read` / `trade:write` 判定。
   以前这里对运营接口也要"批发商/农户"身份，结果是运营点"核准赔付"会被告知
   "请先在用户中心申请业务身份"——让运营去申请批发商身份本身就说明门装错了地方。
2. 没有落到控制器的路径（含本轮下线的旧路由）交给 Spring 自己回 `404`，
   不由能力闸门代答"你没有业务身份"。

演示环境里 `farmer / luochuan / provider` 都没有交易类业务身份（`platform_identity_application`
里 approved 的只有 inspector、provider 的服务商身份），**所以交易域的每条写接口原本都是 403**。
先跑 `node scripts/provision-trade-access.mjs`：它用账号自己的令牌提交批发商申请、
用运营端接口审核通过，并用一条不落库的校验分支自检放行结果。

## 审核与操作人留痕

退款审核、赔付审核、保证金审核/冻结/解冻、商品审核、保证金补缴的**操作人都取令牌里的登录账号**
（`SecurityUtils.getUsername()`），不再由前端传字符串：

- 平台访问令牌只签了 `sub / username / roles` 三个声明（`core-infra` 的 `JwtUtil`），
  没有 nickname，所以留痕写的是账号名（如 `admin`）而不是昵称；
- 前端 `api/admin.ts` 里以前那句 `getCurrentUser()?.nickname ?? '运营'` 已删除，
  两个运营页（退款审核、赔付执行）也不再出现"审核人"输入框；
- 保证金流水的每条动作都带 `operator` 与 `reason`（冻结/解冻必填原因）。

## 本轮下线的入口（都不是"改坏"，是本来就没人调用的旁路）

| 接口 | 为什么下线 |
| --- | --- |
| `GET /api/trade/negotiation/inquiry/buyer/{id}`、`/inquiry/seller/{id}`、`/quote/buyer/{id}`、`/quote/seller/{id}` | 换个 id 就能看别家正在谈的收货地、目标价与单价；页面用的都是按令牌取数的 `/mine`、`/received`、`/quote/page` |
| `PUT /api/trade/negotiation/inquiry/{id}/status` | 任意字符串改写别人询价单的状态；询价状态是事件推进的（报价→quoted、受理→converted） |
| `POST /api/trade/product/{id}/audit` | 不校验调用者是否运营、状态任意、审核人自报；运营端走 `/api/trade/admin/product/{id}/audit` |
| `GET /api/trade/guarantee/compensation/page`、`POST /guarantee/compensation`、`POST /guarantee/compensation/{id}/audit` | 绕开 `ICompensationService` 全部守卫：整实体直插（申请人/收款方自报、可不挂纠纷与订单）、审核无状态词表且可重复审、核准即写打款流水号 |
| `POST /api/trade/compensation/guarantee` 及其 `freeze/unfreeze/replenish` | 跳过审核直接建生效账户、流水操作人写 `system`、金额缺字段就 500；与 `/api/trade/guarantee/**`、`/api/trade/admin/guarantee/**` 是同一件事的第二份实现 |
| `POST /api/trade/nlp/parse-and-create` | 名字说要建需求实际只 `new` 了一个没入库的对象（id 为空），且归属人取请求体 `userId`、缺省写死 `1` |

同时删掉了服务层里只被这些路由用过的死方法（`createGuarantee` 三参、`freeze/unfreeze/replenish` 两参重载、
`deductGuarantee`、`transferToCompensation`、`updateInquiryStatus`、`getInquiriesByBuyer/Seller`、
`getQuotesByBuyer/Seller`、`parseNaturalLanguage`）。

## 单据字段的口径

- **采购需求**：`PUT /demand/{id}` 与 `DELETE /demand/{id}`、`POST /demand/{id}/match` 都要"我是发布方"；
  更新走字段白名单——单号、采购方、发布时间、响应计数、`del_flag` 由服务端持有；
  状态只认 `pending / matching / quoted / completed / closed`；已成交的需求删不掉（留作凭据）；
  数量必须 > 0，最低价不得高于最高价（创建与修改同一口径）。
- **询价**：只能对**自己发布的需求**发起；同一需求对同一货源只问一次。
  询价单号是 `IN + 毫秒 + 6 位随机段`——`uk_inquiry_no` 是唯一索引，批量发起时纯毫秒会撞号
  （第二条抛异常、整批回滚，页面只留下一句"发起询价失败"）。
- **报价**：改与删都要"我是报价方"；总价由服务端按单价×数量重算；受理/拒绝/转订单是采购方的动作。
- **赔付**：必须挂在一场纠纷或一张订单上（同一纠纷只赔一次）；申请人只能是这场纠纷的申请方
  或这张订单的买卖双方，申请人名称由服务端按单据取；核准与打款是两步，只有 `approved` 能打款，
  打款会写一条 `payment_type=compensation` 的出款流水。
- **物流状态**：只认 `pending / picked / in_transit / delivering / delivered`（库里出现过 `shipped`
  这类值时，前端既不归入"运输中"也不归入"已签收"，那张单子像凭空消失）。

## 产销对接改由供应商主体承接（2026-11-03）

口径：**产销对接是两个经营主体之间的事**——农业生产主体发布供给意向，交易撮合平台的**供应商主体**承接；
平台运营方不做对接。上一轮把发起侧归到了生产端用户端，本轮把承接侧从运营端搬到卖家中心。

后端分成两个控制器：

| 端 | 路由 | 谁在用 |
| --- | --- | --- |
| 卖家中心（承接侧） | `GET /api/trade/seller/p2t/pool`、`GET /offer/{offerNo}`、`POST /pool/{offerNo}/claim`、`GET /products`、`PUT /products/{id}/price` | 供应商主体自己；数据范围由令牌推出的主体集合决定，`sellerId` 只用于"我绑了多家主体时选一家"且必须属于我 |
| 平台运营侧（只做治理） | `/api/trade/admin/p2t` 的 `orders / retry / recon / diffs / trace / rules` | 回写状态与重试、产销对账、差异处置、全链路追踪、规则配置 |

原先进入运营端的 `pool → offer → audit → build → products → price` **五条路由保留处理器但返回 410**，
不是删掉：删掉后这条路径会落到静态资源兜底、回一个看不出原因的 HTTP 500，与真崩溃无法区分（本项目踩过）。
服务层里只被这五条路由用过的 `pool/audit/buildProduct/productPage/updatePrice` 已整体删除，
建品逻辑收成一处 `buildFromOffer`（承接与"平台代建"共用同一份代码的日子结束了）。

承接这一步真正改掉的四件事：

1. **商品归属**：`seller_id / seller_name` 写**承接方**卖家主体，货源主体只作为来源信息进描述与 `source_offer_no`；
   旧实现把 `seller_id` 写成生产主体的 `tenantId`，等于平台替供应商建了一件挂在农场名下的商品，
   供应商既改不了价也对不上自己的账。
2. **承接状态不另建表**：`agri_trade_product.source_offer_no` 非空且未删就是认领凭证，池子里的
   `claimed / claimedByMe / claimedProductCode` 全部从交易域库里实查——不信前端传参，
   也**不单信**生产端回写的 `tradeStatus`（回写失败时它还是旧值，只认它会让人再建一件重复商品）。
3. **回写不再是"发了不管"**：`markAccepted` 之后必须真的读 `p2tListed` 的响应并判 `code==0`（旧代码把返回值丢了，
   供给侧停在"已接受但未上架"没人知道）；`auditor` 写 `供应商承接：<承接方主体名>`，留痕留的是"谁接的货"。
4. **超卖闸门**：`listedQty` 上限是 `availableQty − reservedQty`，且必须 > 0；挂牌价必须 > 0，
   改价前先证明这件商品属于我的主体集合（`这不是你所属经营主体承接的商品，无权改价`）。

前端：卖家中心新增「产销对接（承接）」面板（池子 + 承接弹窗 + 我承接出来的商品与改价），
运营端删掉 `pages/admin/p2t/Pool.tsx`、`Products.tsx` 与对应路由/菜单，边界页按新口径重写。

## 验证

```powershell
node scripts/provision-trade-access.mjs     # 开通交易类业务身份（幂等）
node scripts/e2e-trade-identity.mjs         # 接口级端到端
node scripts/check-trade-ui.mjs             # 三端浏览器点检
```

端到端 **111 条断言全绿**：主体归属、跨主体判权、字段白名单、影子路由 404/405、
审核人取令牌、状态词表、批量询价幂等与唯一索引、赔付三步流、零残留清理。
浏览器点检 **37 项全绿**（截图与逐条结果见 `outputs/trade-ui-20261101/`）：
买家发布/编辑/看别人需求（动作区按归属收掉按钮）、卖家改报价后总价重算、
运营退款与赔付全流程（驳回必填原因、审核人落库为 `admin`）、保证金冻结留痕，
临时数据按主键区间清除、被改动的保证金种子逐条还原。

前端发布链：`trade@20261101-trade-identity-r1`（身份收口）→ `trade@20261103-p2t-claim-r1`
（承接面板 + 运营端下线两页 + 边界页）；生产端配套 `prod@20261103-p2t-owner-r2`：

```powershell
node ops/gateway/scripts/publish.mjs --app trade --version 20261103-p2t-claim-r1 --build
```

### 产销对接承接（2026-11-03 本轮）

```powershell
node scripts/e2e-p2t-claim-loop.mjs                      # 29 条断言全绿（本轮新建意向分支）
E2E_P2T_SKIP_PUBLISH=1 node scripts/e2e-p2t-claim-loop.mjs  # 30 条全绿（改用存量单那条分支）
node scripts/check-p2t-owner-side-ui.mjs                 # 20 条全绿（生产端发起侧归位点检）
node scripts/check-trade-ui.mjs                          # 37 条全绿（交易域三端点检，卖家侧菜单含「产销对接（承接）」）
```

`e2e-p2t-claim-loop` 的判据都是跑出来的，不是读代码推的：商品 `seller_id` 回库比对（2003 陕西洛川果业，
不是货源方 2001）、`source_offer_no` 追溯、改价落库 `13.8000`、挂牌价 0 被拒、重复承接被挡、
指定别人的主体承接回`你无权以该经营主体发起交易`、旧的运营端入口回 **410**（不是静默 500）、
生产端读到 `tradeStatus=LISTED` + 承接方形成的 `productCode` + `auditor=供应商承接：陕西洛川果业`；
浏览器侧验卖家中心面板渲染、池子里这一张单、"已由我承接 + 商品编号"回显、
运营端子菜单**展开后**只剩治理项（不展开就断言"菜单里没有"是假绿，antd 子菜单项是点击才进 DOM 的）。
用例数据零残留：本轮新建的意向删掉、承接商品物理删；跑存量单分支时**不删**别人的单子（清理判据按来源分支分别期望 0/1）。

## 已知边界

- **产销对接的承接只有"接"，没有"退"**：供应商能认领一张意向，却不能明确回绝；货源方等不到答复，
  只能靠生产端自己的关闭窗口。要做"退回/婉拒"得先定它算不算一次审核动作、要不要通知与再提交。
- **承接出来的商品被下架/删除后不回写"取消上架"**：`claim` 会回写"已接受 + 已上架"，反向没有对应通道，
  供给侧会一直停在 `LISTED`，只能靠产销对账/差异处置人工吸收。
- **跨模块通道仍是平台密钥**（`/p2t/platform/**`）：生产端看到的 `auditor=供应商承接：<主体名>`
  是交易端传来的**声明串**，生产端没有独立验证过那个主体号确实存在/同意。要变成可核验事实，
  通道得带承接方主体号并让生产端回查平台。
- 运营端旧的对接页删掉后，`/admin/trade/p2t/pool`、`/products` 这类深链不是"页面已下线"的说明页，
  而是被 SPA 的 `*` 兜底跳到买家中心（**后端 API 明确回 410**，缺的是前端那一页）。
- 路由仍是 `/api/trade/**` 老前缀（含 `/api/trade/admin/**`），没有迁到 `/api/v1/trade/app|ops/**`；
  与物联网/服务/政务那几个新写域的路径风格不一致，属后续统一项。
- 用户看板与运营大盘是"先全量查订单、再在 Java 里流式聚合"，不是 SQL 聚合：
  数字是真的，但单量上去后成本会先体现在响应时间上。
- 赔付打款只写资金流水，不动保证金账户余额（`deductGuarantee` 本轮作为死代码删掉了）；
  要做"赔付从保证金出"需要先定业务口径（谁的钱、够不够、不足怎么办）。
- `GET /api/trade/demand/page` 仍不带主体范围：采购需求在供需大厅是公开的，
  `buyerId` 只是筛选条件；改与删有判权，读没有。
- 合同签署、结算批次、承运商对账这几条链路的身份口径本轮未动。
