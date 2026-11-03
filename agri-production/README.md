# 生产管理模块

独立部署的后端 + 前端 + uni-app 移动端，业务数据在 MySQL 库 `agri_production`
（表前缀 `agri_prod_`）。覆盖种养计划与审批、农事任务、投入品与库存、采收与仓储、
质检与分级、IoT 设备与告警、溯源码与区块链存证、报表与 AI 问答。

## 本地地址

| 入口 | 地址 |
| --- | --- |
| 后端 | http://localhost:8092（`--spring.profiles.active=dev`） |
| 用户端 SPA（网关） | http://localhost/production/… ，壳在 http://localhost/prod/index.html |
| 运营端 SPA（网关） | http://localhost/admin/production/… |
| 移动端 H5 | http://localhost:8180/ |
| 统一认证 | http://localhost:8090 |

## 溯源链上凭证的口径（2026-11-01 收口）

**存证只有一张表：`agri_prod_chain_record`（`del_flag=0`）。判定只有一处：
`TraceLifecycleServiceImpl#attachChainEvidence`。** 属主视图与核验视图都从它出结论，
所以同一批次不可能在两个页面上各说一套。

| 出参字段 | 含义 |
| --- | --- |
| `attested` | 存证表里**有没有**这条业务的记录（false = 没有，不是"能力没接入"） |
| `onChain` | 只有 `chain_status=SUCCESS` 才是 true；PENDING / FAILED 都是 false |
| `chainStatus` | `PENDING` / `SUCCESS` / `FAILED` 原值 |
| `txHash` / `blockNumber` / `chainTime` | SUCCESS 才有哈希与块高；未出块时为空，页面写"存证未生成交易哈希" |
| `failedReason` | FAILED 的原因，不笼统写成"待上链" |
| `recordNo` / `chainType` | 人读存证编号；链类型本部署固定 `SIMULATED` |

节点 ↔ 存证记录的对号规则（`chainTargetType` + `matchRecord`）：
采收→`HARVEST`、质检→`QUALITY`（前端旧词表叫 `INSPECTION`，后端一处归一）、
溯源码→`TRACE`、投入品使用→`INPUT`；
先按业务编号（`target_code`）对，再按主键（`target_id`）对。
**入库、出库、种植在存证表里没有业务类型，结论就是"无存证记录"** —— 不硬凑一个 true。

## 存证写入口的口径（2026-11-02 收口）

**业务类型词表只有 `ChainRecordServiceImpl#normalizeType` 一处**，读写共用：

| 值 | 业务键（落 `target_code`） | 主键（落 `target_id`） |
| --- | --- | --- |
| `HARVEST` | 批次号 `batch_no`（纯数字也认批次 id） | `agri_prod_harvest_batch.id` |
| `QUALITY`（旧词表 `INSPECTION` 自动归一） | 质检单号 `inspection_no`（纯数字也认 id） | `agri_prod_inspection.id` |
| `TRACE` | 溯源码 `trace_code` | `agri_prod_trace_code.id` |
| `INPUT` | 投入品使用记录 ID | `agri_prod_input_usage.id` |

三条硬规则，都是为了让"已上链"这个结论不可伪造：

1. **数字枚举拒绝**（`bizType=2` 那套 V1 词表已下线）。它的历史后果是：控制器
   `String.valueOf(2)` 原样落库成 `target_type='2'`，读侧按四类对号永远匹配不上 ——
   **那条存证等于没写过**，可存证列表照旧把它显示成一条 SUCCESS 的"已上链"。
   历史值用 `schema-patch-chain-type-normalize.sql` 归一（**要求业务键能在业务表里查到才改**，
   查不到的只列清单不猜、不自动删）。
2. **写之前先证明业务存在**（`resolveTarget`）：按令牌主体在对应业务表里定位这条记录，
   不存在、已软删、或属于别家经营主体 → 404「找不到要存证的业务」。跨主体也走这一句，
   不说"存在但不是你的"（那是一个免费的探测接口）。
3. **`FARMING / CIRCULATION / IOT / OTHER` 拒绝**：本部署没有可校验的业务主数据入口，
   单号由人自由填写，出证等于给可能不存在的东西发链上凭证。手动上链表单已同步删掉这几个选项。

读侧同样不接受数字：筛一个不存在的类型必须报错，不能静默回空列表
（"筛了不生效"比"不能筛"更隐蔽）。

**存证列表每一行都能点回它存证的那条业务**（`ChainRecordContractVO.targetId` 透出 `target_id`）：

| 业务类型 | 跳转目标 | 用的键 |
| --- | --- | --- |
| `HARVEST` | `/production/harvests/{targetId}` | 主键（批次号进不去详情页） |
| `QUALITY` | `/production/quality?keyword={bizNo}` | 检测单号（该页服务端筛选） |
| `TRACE` | `/production/trace/full-chain?code={bizNo}` | 溯源码 |
| `INPUT` | `/production/inputs/usages?usageId={bizNo}` | 使用记录 ID |

拿不到主键或编号的行显示纯文本并说明"只能按编号自行查找"，不给跳过去只会报记录不存在的死链。


三个读入口，两种语义：

- `GET /trace/full-chain/{batchId}/nodes`、`GET /trace/full-chain/trace/{code}` —— **属主侧**，
  按令牌主体（`TenantContextService.currentTenantId()`）过滤，取不到就 404；
- `GET /trace/public/verify/{code}` —— **核验侧**，刻意跨主体、免登录（配在
  `platform.rbac.public-paths`），只回核验要用的字段 + `nodeCount/onChainCount/attestedCount/chainConclusion`。
  政府监管的公众查询页与移动执法端扫码读的就是这一条（见 `agri-government/README.md`）。

**本部署是模拟链**：四条写接口（`/blockchain/records`、`/anchor`、`/retry`）会真的写库，
生成 `SIMU` 前缀的交易哈希与自增块高，并把 `chain_type=SIMULATED` 随出参给出。
"已上链"只表示本库有一条 SUCCESS 记录，不是公链完整性校验，页面文案必须点明这一点。

## 溯源码有效期（2026-11-02 接通）

表上一直有 `expiry_date` 列，但**没有任何代码读写它**，而生成接口的 `expireDate` 入参也一直被丢掉
—— 于是页面「有效期至」永远是 `-`，过期码照样显示"可核验"。现在三处都接上了：

| 环节 | 行为 |
| --- | --- |
| 生成 | `POST /trace/codes/generate?batchId=&expireDate=yyyy-MM-dd` 真的落库；格式不对 → 400 并给出正确格式；不填 → 保持为空，**不参与到期扫描**（不拿采收日编一个） |
| 扫描 | `TraceCodeExpiryJob` 每小时扫一次全部主体；页面/回归可手动触发 `PATCH /trace/codes/expire-overdue`（只扫本主体）。只把 `expiry_date < 今天` 且状态还是 `generated/active/scanned` 的码置为 `expired` |
| 核验 | `public/verify` 除状态外**再按日期判一次**（扫描是每小时的，两次之间状态可能还是 `active`），给出 `expiryDate/expired`，`verifiable=false` 且结论写明"有效期 X 已过，不再作为核验依据" |

出参字段：用户端 `TraceCodeContractVO.expireDate`、运营端 `AdminTraceCodeVO.expireDate`。
运营端详情页此前读的是 `activatedAt / lastScanAt`（VO 里根本没有这两个键，所以永远显示"未接入"），
现已按真实字段改成 `activateTime` 与 `firstQueryTime`（后端只有**首次**扫码，没有"最近扫码"）。

## 软删与数据可见性

实体统一继承 `BaseEntity`，其中 `deleted` 带 `@TableLogic`，全局配置
`logic-delete-field: deleted / logic-delete-value: 1 / logic-not-delete-value: 0`，
所以 MyBatis-Plus 的查询会自动补 `deleted = 0`，**不需要**在业务代码里再写一遍条件。
实测判据（`scripts/e2e-production-flow.mjs` 的"清理后复核"段）：溯源码、批次、全链路
在软删后分别于属主接口与公开核验接口回 404。

回归脚本清理时一律写 `deleted = 1`。曾经写过 `deleted = id`（11、12…），查询效果碰巧一样
（都不是 0），但那是应用永远产生不了的值，用 SQL 审计残留时会被它误导 —— 2026-11-01
已把库内 179 条这类历史值归一回 1，脚本也一并改掉。

## 验证

```powershell
node scripts/e2e-production-flow.mjs        # 端到端 80 条（链上口径 8 + 存证写入口 10 + 有效期 7 + 列表链上状态 6 + 筛选 10 + 服务端分页 3 + 状态两档与出参键 4 + 质检服务端 5 + 生成日期 2 + 清理后复核 5 等）
node scripts/check-production-flow-ui.mjs   # 浏览器点检 56 项（全链路 5 + 投入品上链 6 + 有效期 3 + 存证跳转 2 + 两端列表列 3 + 筛选 2 + 服务端分页与导出 7 + 出参键与行内跳全链路 3 + 生成日期区间 2 + 质检服务端 5 + 菜单文案 3）
node scripts/e2e-government-flow.mjs        # 监管侧 129 条（含与生产域核验逐字段对照）
node scripts/check-gov-ui.mjs               # 监管三端 81 项
node ops/ci/verify.mjs                      # 路由/菜单/schema 一致性 64 项
```

`check-production-flow-ui.mjs` 会临时建计划/任务/批次/溯源码/投入品与使用记录，外加 **12 张检测单**
（机构用机构表里真存在的两家，否则页面下拉选不到、测的就不是用户能做的事），
写一条真实存证（HARVEST→SUCCESS）与一条 FAILED 存证，并**在页面上真的点「上链」按钮、
真的从存证列表点回采收详情、真的点第 2 页与「导出」把 CSV 收下来核对行数、真的从下拉里选「待检」与机构**；
为了验证服务端分页，它会给本批次补到 12 条码（跑完连同到期码、作废码一起按主键逻辑删除）。
业务表按主键逻辑删除（`deleted = 1`）、存证记录物理删除，最后断言库内没有残留
（`CHAIN-UI-*` 存证与 `QC-UI-*` 检测单都算残留）。演示口令 `Admin@123` 仅限本地。

历史脏值迁移（可重复执行，改前要求业务键能查到）：

```powershell
mysql -uroot -p --default-character-set=utf8mb4 agri_production `
  < agri-production/backend/src/main/resources/schema-patch-chain-type-normalize.sql
```

发布：

```powershell
node ops/gateway/scripts/publish.mjs --app prod --version 20261102-prod-menu-farm-r2 --build
```

## 用户端菜单文案（2026-11-02）

一级菜单「农场数字化管理」→ **「我的农场」**，其下叶子「农场列表」→ **「农场管理」**
（与页面自己的标题 `🏠 农场管理` 对齐；以前菜单说"列表"、页面说"管理"，同一个东西两个名字）。

面包屑读的是菜单分组名（`buildBreadcrumb` 取 `group.label`），所以改名后自动跟着变成
「首页 / 我的农场 / 农场管理」，不需要另改一处。农场详情页那颗"返回农场列表"按钮也一并改成
"返回农场管理" —— 菜单说一个新名字、页面留一个旧名字，用户会以为是两个地方。

> 没跟着改的是**模块归属**这个词：路由 `meta.module` 与页面头注释里的"农场数字化管理"说的是 PRD 的模块划分，
> 不是菜单名；运营端的「农场监管 / 农场监管列表」是另一套菜单，也没动。

## 链上结论只有一处规则（2026-11-02 收口）

`ChainEvidenceRule` 是"这条业务算不算已上链"的**唯一**判定，四个消费方都走它：
全链路节点、公开核验的码自身存证、用户端溯源码列表/详情、运营端溯源码列表与链路详情。

| 情况 | `attested` | `onChain` | 页面文案 |
| --- | --- | --- | --- |
| 存证表里没有该业务的记录 | false | false | 无存证记录 |
| 有记录，最新一条是 PENDING | true | false | 存证未出块 |
| 有记录，只有 FAILED（或最新是 FAILED 且没有成功过） | true | false | 存证失败 |
| 有任一 SUCCESS（**取最早那条 SUCCESS**） | true | true | 已上链 |

同一业务键有多条记录时（反复提交存证）：先找 SUCCESS，找到就以它为准 —— 已经出过块不会被后来
一次失败抹掉；一条都没成功时取**最新**那条，说"当前状态"而不是"历史第一次"。

> 修之前的样子：两个列表的 `onChain` 读的是溯源码表 `blockchain_tx_hash` 那个**从来没人写**的死列，
> 于是有真实 SUCCESS 存证的码也被判成未上链；节点视图另用"取最早一条"，两边能对同一个码给出相反结论。
>
> 顺带纠正我上一轮写进本文的一句话：当时说"运营端列表整列显示未上链"——**不准确**，
> 那两个列表页当时根本没有链上状态列，字段是算了但没人消费。本轮才是真的把列加上、把值接对。

## 列表筛选一律在服务端（2026-11-02）

条件解析集中在 `TraceCodeFilter`（用户端 `/trace/codes` 与运营端 `/admin/trace/codes` 共用）：

| 参数 | 取值 | 说明 |
| --- | --- | --- |
| `status` | generated / active / scanned / revoked / expired | `generated` 同时吃掉存量写法 `inactive`，否则那批行筛不到 |
| `keyword` | 任意串 | 模糊匹配溯源码 / 批次号 / 产品名 |
| `farmId` | 数字 | 非数字直接 400，不静默忽略 |
| `chain` | onChain / unconfirmed / none | 相关子查询 `EXISTS agri_prod_chain_record`，与列表列的三种显示一一对应 |
| `expiry` | expired / valid / unset | 按 `expiry_date` 与今天比；`unset` 是"没设有效期"，**不能**算成已过期 |
| `from` / `to` | yyyy-MM-dd | 生成日期区间，格式错报 400 |

非法取值一律 400 并列出可选项 —— 静默当"没筛"会让用户以为筛过了。

> 改之前的样子：运营端把 `code/batchNo/dateRange` 发给后端再**本地筛当前页 10 行**
> （代码注释写着"后端 /codes 仅支持 status 过滤"），所以搜一个在第 3 页的码会筛出空列表，
> 而分页器总数还是服务端没筛的数；用户端除了同样的本地关键字过滤，农场条件比的是
> 出参里当时根本没有的 `farmId`，那个下拉从来没起过作用。
> 顺带一处词表事故：用户端状态选项里 `{ value: 'expired', label: '已作废' }` 经翻译映射成 `revoked` ——
> 溯源码真的有 `expired` 状态后，"已过期"和"已作废"会抢同一个键，现在选项值直接用服务端词表。

## 用户端列表翻页与导出（2026-11-02 收口）

`/trace/codes` 的 `page/size` 与筛选条件一起进请求，表格直接渲染服务端返回的那一页 ——
不再有"一次取 500 条再由表格本地翻页"这一步。

| 位置 | 以前 | 现在 |
| --- | --- | --- |
| 列表翻页 | 取回 500 条，"第 2 页"只是这 500 条的第 11~20 行；码多于 500 的主体永远翻不到后面的数据 | `page=2&size=10` 进请求，两页不重不漏（点检按请求串与行内容双重取证） |
| 每页条数 | 同上，本地重切 | `size=20` 进请求，由服务端返回对应条数 |
| 导出 CSV | 导的是"已经拿回的那 500 条里筛完的"，用户以为导全了 | 按**当前筛选条件**翻页取全（200 条/次、上限 5000），到上限如实提示"还剩 N 条未导完" |
| 统计卡 | 与列表共用那 500 条，翻页后副标题的扫码数说不清是哪一批 | 四个数各走一次全量计数请求；扫码副标题明写「当前页累计」 |

状态文案一并拆开：`revoked` = **已作废**（人为），`expired` = **已过期**（到期扫描置位）。
以前一张 `STATUS_META` 挂在前端四档枚举上，把这两个值都归到 `expired` 再统一显示"已作废"；
到期扫描上线后库里两种码并存，列表就会把"到期了"说成"被人作废了"（原因与处置都不同）。
现在按后端原始状态取文案，词表外的取值原样显示、不冒充已知状态。

出参的批次键也跟着改了名：用户端契约以前给 `batchNumber`，而页面（和运营端、共享类型声明的）
读的是 `batchNo` + `batchId` —— 于是「批次号」列永远是 `-`，行内「全链路→」永远显示"未关联批次"，
**这一页最主要的跳转等于从来不存在**；同一处还漏了 `createdAt`（VO 只给 `updatedAt`），
「生成时间」列与导出那一列因此常年是 "-"。现在 `harvest_id→batchId`、`batch_number→batchNo`、
`create_time→createdAt`，点检里既断言出参有这几个键，也真的点一次链接跳进该批次的全链路。

> 一处没修的边界：`POST /trace/{code}/revoke` 会把**已过期**的码直接改成 `revoked`，
> 于是那条码"曾经到期"只剩 `expiry_date` 维度还看得出来。页面不给已失效的码出作废按钮，
> 所以点不出来；接口层要不要拦"给失效码再作废一次"，等有真实需求再定，不先加校验。

## 质检列表同样搬到服务端（2026-11-02）

`/quality/inspections` 的筛选以前只有一半在服务端：页面只发 `keyword`，**结果与机构是浏览器在
拿回的那 200 条里二次过滤**，表格再本地翻页 —— 单数一填满 200，"待检"筛不出东西、换机构没反应。

| 条件 | 以前 | 现在 |
| --- | --- | --- |
| 结果（合格 / 不合格 / 待检） | 本地比字符串；`'all'` 是"全部"这个选项的值，绝不能发给后端 | 进请求；`'all'` 在前端就地折成"不筛这一项" |
| 机构 | 本地比 `labName`，而后端**没有这个入参**（发了也没用） | 后端补 `labName` 精确匹配，下拉换了立刻生效 |
| 翻页 / 每页条数 | 表格本地切，分页器总数是"本地筛完的条数" | `page/size` 进请求，total 只认服务端 |

**「待检」这一档值得记一笔**：库里还没出结论的检测单 `result` 是 **NULL**，不是 `'PENDING'`。
接口以前按等值筛 `result=PENDING`，一条都命中不到 —— 页面看起来就是"没有待检的单"，
而它其实是筛错了。现在在服务端把它解释成"`result` 为空（或历史写成 PENDING）"，与文案一致。

## 溯源码列表补生成日期区间（2026-11-02）

`TraceCodeFilter` 上一轮就支持 `from/to`（按 `create_time`，两端含当天），但**用户端页面没有对应控件**，
运营端有 —— 同一个条件两端能力不一样，用户想找某天生成的码只能靠翻页。
现在筛选卡加 `DatePicker.RangePicker`，`from/to` 与别的条件一起进请求；格式不对后端报 400
并给出 `yyyy-MM-dd`，不静默当"没筛"。

## 地块「当前作物」只由种养品种台账决定（2026-11-03 收口）

作物录入入口在 2026-11-02 从「新增/编辑地块」表单搬进了**地块详情 → 种养品种**（`agri_prod_plot_crop`，
一块地可登记多个品种），但地块列表那一列「作物」、农场详情缩略卡读的还是 `agri_prod_plot_info.current_crop`：
结果新建地块永远显示空，而且地块更新是**整表提交**语义（`PlotSaveDTO` 省略的字段会被 `BeanCopyUtils` 清空），
`PlotServiceImpl.resolveCrop()` 在未下发作物时把 `crop_id`/`current_crop` 一起清掉 ——
在天地图上补画一次边界，就会把演示数据里原有的「水稻」抹掉。

现在这两列定成台账的**派生缓存**，口径只有一处：

- `PlotCropServiceImpl.earliest(plotId, tenantId)` —— 台账里最早登记的一条，就是地块的当前作物；
- `syncCurrentCropToPlot()` —— 台账新增/编辑/删除后回写两列，台账清空则两列一起清掉
  （必须用 `LambdaUpdateWrapper` 显式 set：`updateById` 的 NOT_NULL 策略会跳过 null，"清空"这一步会静默不写）；
- `PlotServiceImpl.resolveCrop()` —— 请求未下发作物时按 `台账最早一条 → 地块原值` 兜底，
  所以早期只有单值、没有台账行的演示数据不会被一次无关编辑抹掉。

页面口径：列表「作物」列 = 台账第一条作物名；详情页的「种养品种（N）」卡才是完整台账。
删掉台账最后一行会把两列一起清空，这是设计（派生缓存不能比它的来源活得久）。
回归见 `scripts/e2e-plot-crop.mjs`（登记品种 → 两列落地 → 列表显示 → 编辑不丢 → 清空台账后两列清掉 → 停用/启用口径）。

## 已知边界

- 溯源码表上的 `blockchain_tx_hash / blockchain_block_height` 是历史遗留列：**没有任何写路径**
  维护它们（全为空），链上凭证一律以存证表为准。列暂不删（怕动到存量导出），也不再作为判定依据。
- 到期扫描的粒度是"每小时 + 手动触发"，不是实时：刚过期的那一小时内，属主列表的状态可能还是旧的
  （核验接口按日期兜底，不会把过期码说成可核验）。
- 同一业务键重复存证会攒出多条记录，规则见上文 `ChainEvidenceRule`（有 SUCCESS 取最早那条 SUCCESS，
  否则取最新一条）；但**重试历史看不到** —— `retry` 是就地改写同一条记录，页面上只留最终状态。
- `FARMING / CIRCULATION / IOT` 只是**被拒绝**，不是被支持：等这三类业务有了可校验的业务键契约
  （明确 `target_code` 取哪一列），再放进词表并把表单选项加回来。
- 溯源码**没有操作人列**：`/trace/activate` 的 `activatedBy` 只进日志、不入库，所以"激活操作人"
  在运营端详情里只能是"未接入（表无该列）"。运营端此前写死传 `'运营管理员'`，看着像留痕、其实没记，
  已停止传这个假名字；真要留痕得先加列。
- 一个批次多条溯源码时，属主全链路会把每条码都列成节点；核验视图按被扫的那一条给 `selfAttestation`。
- 溯源报告页（`/production/trace/reports`）的"全链路记录数"取自同一个 nodes 聚合，
  本轮未改它的其他统计口径。
- 移动端 H5（:8180）本轮未改代码、也未复跑点检。


