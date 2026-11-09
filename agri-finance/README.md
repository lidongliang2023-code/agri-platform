# 供应链金融模块

## 数据库

默认运行环境使用 MySQL 8：

- 数据库：`agri_finance`
- 默认地址：`localhost:3306`
- 默认账号：`root`
- 默认密码：`root`

首次启动前创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS agri_finance
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

后端启动时执行 `schema.sql`（MySQL 与 H2 共用的建表）建表，MySQL profile 再追加
`schema-mysql.sql`（存量库补列与索引，用的是 `information_schema` + `PREPARE` 的 MySQL 方言，
所以不能放进 `schema.sql`，否则 H2 集成测试库直接起不来），最后用 `data-mysql.sql` 写入幂等初始化数据。
种子插入一律写显式列名：这些表会随版本追加列，位置式 `INSERT ... VALUES` 在新列上线后必然报列数不匹配。

可通过环境变量覆盖连接信息：

```text
MYSQL_HOST
MYSQL_PORT
MYSQL_DATABASE
MYSQL_USERNAME
MYSQL_PASSWORD
```

H2 文件数据库仅作为可选开发模式保留：

```powershell
$env:SPRING_PROFILES_ACTIVE = "h2"
java -jar target/agri-finance-1.0.0-SNAPSHOT.jar
```

## 本地启动

```powershell
cd agri-finance/backend
mvn -s C:\Users\71502\.m2\settings.xml "-Dmaven.repo.local=C:\maven\repository" clean package -DskipTests
powershell -NoProfile -ExecutionPolicy Bypass -File ..\..\ops\local\start-production-stack.ps1
```

前端开发服务使用 `5176` 端口：

```powershell
cd agri-finance/frontend
pnpm run dev
```

访问 `http://127.0.0.1:5176/finance/#/borrower/home`。生产网关入口为
`http://127.0.0.1:8081/finance/#/borrower/home`。

仓单链路要读生产域的采收批次、库存、链上存证与物联网读数，因此本模块还依赖 `agri-production`（默认
`http://localhost:8092`，可用 `PRODUCTION_SERVICE_URL` 覆盖）。跨域只走接口、不走直连库，
并且带的是调用方自己的令牌（生产侧按令牌解析主体）；生产域不可达时报 `503`，不会静默返回空列表。

访问地址：

- 融资方端：`http://localhost:8081/finance/#/borrower/home`
- 资金方端：`http://localhost:8081/finance/#/fund/workbench`
- 运营风控端：`http://localhost:8081/finance/#/admin/workbench`

## 统一登录与权限

供应链金融不再使用独立登录账号，三个入口统一接入丰链云认证中心，SSO 客户端为
`finance`，授权方式为 OAuth2 授权码 + PKCE。

| 入口 | 必要权限 | 默认角色 |
| --- | --- | --- |
| 融资方端 | `finance:borrower` | `FARMER` |
| 资金方端 | `finance:fund` | `FINANCE_FUND` |
| 运营风控端 | `finance:admin` | `MARKET_OPS` |

资金审核操作使用 `finance:review`。所有接口还要求 `finance:read` / `finance:write`，
未登录返回 `401`，角色不匹配返回 `403`。`SUPER_ADMIN` 的 `*` 权限可访问三个入口。

现有融资主体业务编号和资金机构业务编号保持不变，页面右上角及侧边栏显示的登录用户名称来自
平台统一用户。资金方账号由平台运营分配 `FINANCE_FUND` 角色后即可访问资金方端。

## 融资产品主数据

`finance_product_config` 是资金方产品配置、官网门户金融产品、融资方产品中心和融资申请共用的
唯一产品主数据。资金方端支持新增、编辑、启停和逻辑删除，启用产品通过公开接口输出给门户和
融资方端：

- 资金方配置：`/api/v1/product-config`（需要 `finance:fund`）
- 启用产品目录：`/open/finance/products`

公开目录只返回 `del_flag=0` 且 `status=启用` 的产品。产品保存后无需重新发布前端即可同步到
官网和融资方产品中心；融资申请提交时后端还会校验产品是否启用，以及申请金额、期限是否处于
配置范围。

## 三角链风控中台

资金方端入口：`http://127.0.0.1:8081/finance/#/fund/risk-center`

风控中台实时聚合四类数据并生成可追溯快照：

- 交易信用：订单数量、成交金额、履约率、结算率、争议/退款、信用评分和历史逾期。
- 物流数据：物流单、签收率、运输状态、温控异常、订单签收状态不一致。
- 仓单监管：质押仓单、仓单价值、仓储监测、重量偏差、温湿度及设备状态。
- 生产 IoT：设备在线率、生产地块、遥测数据、电池和未处理 IoT 告警。

本地一体化部署默认跨库读取 `agri_trade`、`agri_iot`、`agri_production`，可通过
`AGRI_RISK_TRADE_DATABASE`、`AGRI_RISK_IOT_DATABASE`、`AGRI_RISK_PRODUCTION_DATABASE`
覆盖。数据源不可用时对应维度标记为 `NO_DATA`，不把未知结果当作通过。

接口：

- `GET /api/v1/risk-control/center?subjectId={id}`
- `POST /api/v1/risk-control/center/assess/{id}`
- `GET /api/v1/risk-control/center/snapshots?subjectId={id}`

每次评估结果写入 `risk_assessment_snapshot`，包含四维得分、综合分、风险等级、处置建议、
数据完整度、交叉验证结论和生成时间。

## 资金方工作台与资产市场

- 资金方工作台：`http://127.0.0.1:8081/finance/#/fund/workbench`
- 资产市场：`http://127.0.0.1:8081/finance/#/fund/asset-market`
- 资产详情：`http://127.0.0.1:8081/finance/#/fund/asset-market/{assetId}`
- 我的投资：`http://127.0.0.1:8081/finance/#/fund/my-investment`

工作台统一聚合机构资金额度、在投本金、预期收益、近期回款、融资审批、存量逾期与启用风控规则。
资产市场展示真实募集进度、剩余额度、主体评级、配置依据和资金方自己的已配置金额；资产详情
已取消静态模拟数据，全部从后端查询。

资金配置闭环：

1. 校验资金机构准入状态、最低起投金额、机构可配置余额和资产剩余额度。
2. 使用数据库条件更新原子占用资产额度，防止并发超募；同一资金机构的额度校验使用行锁串行化。
3. 事务内创建投资记录并生成资金方消息，任一步失败都会回滚额度占用。
4. 投资到期后自动从“投资中”迁移为“待回款”。
5. 资金方确认本息到账后投资变为“已完成”，释放机构资金额度并计入已实现收益。

资金机构总额度和最低起投金额可通过环境变量配置：

```text
AGRI_FUND_TOTAL_LIMIT=50000000
AGRI_FUND_MINIMUM_INVESTMENT=1000
```

接口：

- `GET /api/v1/fund-workbench/mine`：工作台聚合数据（机构号由访问令牌解析）
- `GET /api/v1/fund-workbench/mine/market`：资产市场与资金头寸
- `GET /api/v1/fund-workbench/mine/asset/{assetId}`：资产详情、配置依据与流转进度
- `POST /api/v1/investment/subscribe`：事务化资产配置（机构取登录身份，请求体不再接受 providerId）
- `POST /api/v1/investment/complete/{investmentId}`：确认本息回款（机构取登录身份）

回归测试位于
`agri-finance/backend/src/test/java/com/agri/finance/controller/FundInvestmentFlowTest.java`，
覆盖聚合查询、资金与资产额度扣减、投资落库、本息回款、最低起投和跨机构操作隔离。

## 资金方审批与投资组合

- 审批管理：`http://127.0.0.1:8081/finance/#/fund/approval`
- 我的投资：`http://127.0.0.1:8081/finance/#/fund/my-investment`

审批流程已补齐资金方决策闭环：

1. 审批前展示主体信用、申请用途、还款来源、质押增信、AI 预审和申请材料。
2. 使用数据库行锁串行化同一申请的审批操作，只允许 `待审批` 状态提交一次决策。
3. 每次审批写入 `finance_approval_record`，保留资金机构、审批金额、利率、意见、审批人和时间。
4. 审批通过后自动将融资申请转换为可投资产，并通知融资方与资金方；拒绝申请同样生成融资方消息。
5. 已通过申请生成资产后可直接跳转资产详情，继续完成尽调、资金配置和回款流程。

投资组合统一返回机构资金头寸、在投本金、预期收益、已回收本息、完成率、配置分布、近期回款和逾期情况。
逐笔投资提供资产类型、借款人、增信措施、到期天数、下一步处置建议及回款时间线，并支持导出当前筛选结果。

接口：

- `GET /api/v1/loan/approval/overview`：审批统计、逐笔申请、审计结果及生成资产（机构取登录身份）
- `POST /api/v1/loan/review`：资金方审批决策，机构与审批人都由访问令牌解析，请求体只带结论
- `GET /api/v1/investment/mine/portfolio`：投资组合聚合与逐笔处置建议
- `POST /api/v1/investment/complete/{investmentId}`：确认本息到账并释放资金额度

## 融资方身份与主链路闭环（2026-11-01）

### 身份：从"前端自报"改成"令牌解析"

之前 `api/finance.js` 写死融资主体 `2001`、`api/operations.js` 写死资金机构 `PROVIDER-BANK-001`，
后端再按请求参数过滤 —— 结果是**任何人登录看到的都是这一家**，而且把参数换成别人的主体号
就能读、能改别人的借款/合同/还款。现在：

| 入口 | 口径 |
| --- | --- |
| `GET /api/v1/finance/subject` | 当前账号的融资主体（经营主体号）、资金机构、角色位；前端身份卡唯一来源 |
| `GET /api/v1/finance/subjects` | 发生过融资业务的主体清单（运营端「信用查询 / 风控中心」选择器，替代写死的 2001） |
| 融资方读接口 | 一律按令牌解析出的主体过滤；运营/审批角色（`finance:review`、`finance:admin`）才可按参数跨主体筛 |
| 融资方写接口 | 主体号由服务端写入，请求里的 `userId` 一律忽略 |
| 资金方接口 | 机构号取 `fund_provider.merchant_id` 绑定；未绑定一律 403 并说明该找谁绑定 |
| 审批人 / 复核人 / 催收 | 取令牌里的平台用户号与用户名，不再接受前端参数 |
| 站内信 | 收件人只能是自己的主体号或自己绑定的机构号，传别人的直接 403 |

新增列（`schema.sql` 建新库、`schema-mysql.sql` 给存量库补列）：
`fund_provider.merchant_id`、`contract.application_id`、`overdue_record.period`。

### 资金机构与主体绑定（运营端页面）

运营风控端菜单「风险与资产 → 资金机构」（`#/admin/fund-provider`）承担三件事：

1. 台账：机构、准入状态、当前绑定的经营主体（名称按号回源平台客商中心反查，不在金融侧另存一份）；
2. 准入：`待审核` 的机构可「通过 / 拒绝」，拒绝必须填原因，审核人取当前登录者；
3. 绑定：远程搜索平台经营主体后绑定；可换绑、可解绑（解绑后该机构账号进资金端会被明确拒绝）。

接口（均要求 `finance:admin`，主体候选转调平台 `/api/v1/admin/merchants`，带调用方令牌）：

- `GET /api/v1/fund-provider/admin/list?keyword=&bound=`：机构台账与汇总（bound 可取 `bound` / `unbound`）
- `GET /api/v1/fund-provider/merchant-options?keyword=`：可绑定的经营主体候选
- `PUT /api/v1/fund-provider/{id}/binding`：`{ merchantId }`；传空即解绑；主体不存在返回 400、被别家占用返回 409

### 资金方账号怎么开

一次性执行（幂等，全部走接口，不手改库）：

```bash
node scripts/provision-finance-fund-account.mjs
```

它会：建/复用银行经营主体 → 按 `FINANCE_FUND` 角色建账号 `fund`（默认口令 `Admin@123`）→
绑定账号↔主体 → 调上面的绑定接口把 `PROVIDER-BANK-001` 绑到该主体 → 用 `fund` 登录自检
（身份卡、资金工作台可读、不能以融资方身份申请、读不到运营端逾期台账）。
执行后会打印账号、主体号与入口地址；`FINANCE_FUND_USERNAME` / `FINANCE_FUND_PASSWORD` 可覆盖默认值。

### 主链路：签署闸门、结清收尾、逾期登记

1. **申请** → 智能初评（基线按主体稳定，逾期数 / 在贷余额 / 履约率 / 累计放款一律真算）
   → `POST /api/v1/loan/apply`，主体在黑名单生效时直接 403。
2. **审批** → `POST /api/v1/loan/review`：同一申请只能决策一次（重复返回 409），
   写 `finance_approval_record`、生成可投资产、给融资方与资金机构各发一条站内信。
3. **确认借款** → `POST /api/v1/loan/{id}/accept`：只生成待签合同，**不落借款**
   （原实现是审批一过就把借款置为「还款中」并起算还款计划）。
4. **签署** → 融资方 `POST /api/v1/contract/sign`、资金方 `POST /api/v1/contract/{id}/lender-sign`：
   签署方由服务端判定（原来 `signType` 由前端传，融资方能替银行签字）；
   **谁签完最后一笔就触发放款**，借款 + 还款计划 + 双方通知同事务落库，幂等（重复调用返回既有借款）。
5. **还款** → `POST /api/v1/repayment/pay`：校验账单归属；本金还清自动「已结清」，
   同事务关闭逾期台账、重算授信评分、写结清通知。
6. **逾期** → `RepaymentOverdueScanner`（每日 03:10，或 `POST /api/v1/overdue/scan` 手动触发）：
   到期未还的账单转「逾期」，按「借款 + 期次」登记逾期台账（重复扫描累加天数，不重复开台账）、
   发逾期通知、重算授信；`/overdue/assign`、`/overdue/paid` 补状态校验与结清后重算。
7. **黑名单** → 列入需复核，复核生效后拦截融资申请，解除后可再申请，每一步都给主体发站内信。

### 仓单链路（2026-11-01）

**口径：仓单不是融资方填的一张表单，而是生产域一个已入库采收批次在金融侧的凭据。**
品类、数量、单位、仓库、溯源码、区块链存证一律实时读生产域（`ProductionWarehouseClient`，
带调用方自己的令牌 —— 生产侧按令牌解析租户，所以"能查到这个批次"就等于"批次确实是你名下的"）；
金融侧只补两件金融才有的事：质押物字典编码（决定折算率上限与最长期限）与单价（估值口径）。

1. **可质押批次** → `GET /api/v1/warehouse-receipt/batches`：当前主体已入库的批次 + 金融侧已有仓单状态。
2. **开单前核对** → `GET /api/v1/warehouse-receipt/batch-preview?batchId=`：批次详情、分仓库存、
   在库可用量（`Σ currentQty − frozenQty`）、链上存证记录、该批次未释放的旧仓单。
3. **生成仓单** → `POST /api/v1/warehouse-receipt/create`，逐项校验（按"错的代价"排序）：
   批次归属主体（403）→ 必须已入库（409）→ 同一批次只能有一张未释放仓单（409，防重复担保）→
   在库可用量（400）→ 字典品种存在且启用（404/409）→ 数量与单价（400）。
   状态 `待质押`，`blockchain_hash` 存生产域 `agri_prod_chain_record.tx_hash`（该列已放宽到 191）。
4. **按仓单质押** → `POST /api/v1/pledge/create` `{ receiptId, pledgeRate, applicationId? }`：
   品类/数量/估值/仓库都从仓单取（不接受前端自报），折算率超过字典上限返回 400，
   落库同时把仓单推到 `已质押`（防止同一批货二次质押）；可选绑定融资申请，绑定前校验申请归属。
5. **审核与释放** → 运营 `POST /api/v1/pledge/approve` 置为 `已生效`；放款时 `linkLoan`
   把担保关系从"申请"落到"借款"上；**借款结清自动释放质押并连带放行仓单**（`已释放`），
   没挂任何融资的质押不在这里动 —— 那条路留给运营人工释放。
6. **仓储读数** → `POST /api/v1/warehouse-receipt/{id}/monitor/refresh`：按批次农场/地块筛设备、
   取最新温湿度读数存成快照；本部署没有称重与气体采集通道，`realtime_weight`/`gas_concentration`
   存 null，页面显示「—」而不是 0。快照记录 `device_code` + `device_note`（读数出处与口径），
   批次地块没有在线传感器时如实写明"取自主体名下其它设备，不是该批次的仓储冷链通道"。

新增列：`warehouse_receipt`（`batch_id/batch_no/unit/trace_code/goods_code/farm_id/plot_id/user_id` + 索引）、
`pledge`（`receipt_id/application_id/loan_id`）、`pledge_monitor`（`device_code/device_note`）。
`pledge_goods` 首次有种子（9 个品种，含 1 个 `禁用` 用于验证停用拦截）—— 字典为空时开不出任何仓单。
`PledgeGoodsController` 的 `@OperatorOnly("finance:admin")` 从类级下调到写操作，
融资方能读 `/enabled`（开单要选品种、要看折算率上限），写操作仍是运营的事。

页面：融资方端 `#/borrower/pledge`（批次→开单→质押→读数抽屉）、
运营端 `#/admin/pledge`（仓单台账 + 质押审核，跨主体）、`#/admin/pledge-goods`（质押物目录维护）。

### 验证

```bash
node scripts/provision-finance-fund-account.mjs   # 12 项：开通资金方账号 + 角色边界自检（幂等，可重复执行）
node scripts/e2e-finance-flow.mjs     # 120 项：身份/越权 + 申请→审批→仓单→质押→合同→签署→放款→还款→结清（含质押与仓单自动释放）→逾期→黑名单，全程回查数据库
node scripts/check-finance-ui.mjs     # 56 项：真实浏览器登录点击（批次开单→质押→读数→运营审核→字典停用再启用、资金方签署放款、运营端解绑再换绑）
mvn -o test                            # agri-finance/backend：5 项资金/投资闭环单测（含"请求体机构号冒充被忽略"回归）
node ops/ci/verify.mjs                 # 64 项（带 MYSQL_PWD=root 时含"列与实体一致性"，能抓到漏加的 ALTER）
```

两个链路脚本都要求 `agri-production :8092` 在跑（仓单要读批次、库存、存证与 IoT 读数）；
生产域不可达时金融侧报 503 而不是给出空列表。主链路脚本不改资金机构绑定：审批与签署由真实资金方账号
`fund` 完成，脚本只在认证单上临时放行 `finance.apply` 并在 `finally` 还原，两个脚本连跑不会互相清掉
对方的前置数据；跑完 `agri_finance` 回到种子规模（仓单、读数快照、由仓单发起的质押都归零）。

### 字号规范（2026-11-03 收口）

三端（`views/borrower` 融资方、`views/fund` 资金方、`views/admin` 运营端）原先把大量文字写在 **6–11.5px**：
共 433 处（`font-size: 8px` 就有 116 处），表头、金额、状态标签在 1080p 上要凑近屏幕才读得清。

现在字号只有 `finance-ui.css` 的 `:root` 一处定义，任何新页面都从这里取值：

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--fin-fs-xs` | 12px | 可读下限：徽标、轴标签、表格元信息（原先 6–11.5px 一律并到这档） |
| `--fin-fs-sm` | 13px | 次要说明 |
| `--fin-fs-base` | 14px | 正文与表单，与 `--el-font-size-base` 同值 |
| `--fin-fs-md` | 16px | 卡片标题 |
| `--fin-fs-lg` | 18px | 分组标题 |
| `--fin-fs-xl` | 22px | 页面标题 |
| `--fin-fs-xxl` | 28px | 主数字 / 大标题 |

规范只有一条硬约束：**可见文字不得小于 12px**；层级靠字重与颜色拉开，不靠把字压小。

> 这一条已经不再是金融端独有：同日把同一口径推到了其余 10 个端（合计 875 处 6–11.5px，含 uni-app 的 12–23rpx），
> 并加了 `node ops/ci/verify.mjs --only font` 守着。全平台口径、令牌落点与两类"grep 源码看不见"的漏点
> （uni-app tabBar 缺省 10px、`<small>` 走 0.833em）见 [packages/agri-shared/README.md](../packages/agri-shared/README.md) 的「字号：全平台一条下限」。

真机对比（同一套 14 个页面，`:8081/finance/`，1440×900）：

| 版本 | 最小字号 | 低于 12px 的文字节点 | 文字裁切 | 横向溢出 |
| --- | --- | --- | --- | --- |
| `20261101-receipt-chain-r4`（改前） | 6–7px | 每页 53–169 处，共 14 页全红 | 0 | 0 |
| `20261103-font-scale-r1`（改后） | 12px | 0 | 0 | 0 |

复验命令：`node D:/tmp/verify-finance-font.mjs`（逐页量 computed `font-size`、查
`scrollWidth > clientWidth` 的裁切与脚本异常）。改前快照在 `D:/tmp/finance-src-before/`。

### 已知边界

- 仓单的价值评估只有"数量 × 融资方自报单价"一个来源：字典里的 `price_source` 只是文字说明，
  还没有接行情源回写公允价，所以货值仍可能被高估；波动阈值（`price_volatility_threshold`）也还没有
  接进贷后盯市。
- 结清释放只覆盖**挂到这笔借款（或其申请）上**的质押；没有绑定任何融资的质押需要运营人工释放。
- 读数快照是按需拉取（点一次存一条），没有定时任务；生产域的采收批次地块普遍挂的是大田传感器，
  与"仓储冷链"不是同一套设备，口径说明会如实写在快照里，但真要按批次的冷库读数需要生产侧补设备绑定。
- 账号绑定了多家经营主体时，生产域会要求显式指定 `X-Merchant-Id`，而金融侧目前取令牌解析出的第一家，
  多主体账号开仓单会读不到批次（报的是生产域的原因，不会静默给出别人的数据）。
- 授信评分的外部征信源未接入：基线分按主体稳定生成，只有逾期数、在贷余额、按期履约率、累计放款参与计算；
  仓单与质押尚不参与评分。
- 演示账号 `fund` 沿用本地统一口令 `Admin@123`，上生产必须改；主体候选下拉转调的是平台
  `/api/v1/admin/merchants`，因此要求调用方同时具备平台运营权限。
