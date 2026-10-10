# 后端工单（采收与库存域）

> 产出人：se-verify-fix　日期：2026-10-10　裁决：team-lead
> 判定规则：**端点不存在 + 无调用方 → 前端删死代码；端点不存在 + 有调用方 → 提后端工单。**
> 本文所有工单都属于后者——前端侧**不删除、不伪造**，失败一律如实抛错，等后端补。

**实测环境**：`core-app`（core-platform）快照 jar，`--server.port=8098`，MySQL `agri_core`，
token 取自 `AdminUserInitializer.java`。**全部结论来自实际 HTTP 调用与后端日志，不是读代码推断。**

**读法提醒**：本后端 HTTP 恒为 200，必须读响应体 `code`；
而 `NoResourceFoundException`（端点不存在）与 `HttpRequestMethodNotSupportedException`（方法不被允许）
都表现为 **`code=500 / message=系统繁忙，请稍后重试`**，与"服务端真异常"在响应体上无法区分，
**唯一可靠的判据是日志里的异常类名**（本文每张工单都附了日志原文）。

**验收通则（写操作）**：调用 → **回读** → 比对。只看到 200 / code 0 不算数。

---

## BT-01　库存台账实体缺失（最高优先，是 BT-02/03/04 的根因之一）

| 项 | 内容 |
| --- | --- |
| 端点 | `GET /api/v1/production/harvests/inventory` |
| 方法 | GET |
| 前端函数 | `harvests.ts` `queryInventory()` → 页面 `InventoryManage.tsx:425` |
| 前端契约 | `types/harvest.ts:162` `InventoryRecord` |

**实测返回**：HTTP 200 / `code=0`，返回 6 条；但每条的字段是
`flowId / batchId / warehouseId / flowType / qty / unit / beforeQty / afterQty / operatorId / relatedOrderNo / remark`
—— 后端 Javadoc 自己也承认返回的是 `InventoryFlowEntity`（**库存流水**），不是库存台账。

**契约逐字段比对**（前端 `InventoryRecord` 12 个关键字段）：

- 命中：`batchId`、`unit`（仅 2 个）
- 缺失：`inventoryId`、`warehouseName`、`currentQty`、`frozenQty`、`productName`、
  `category`、`safeQty`、`expireDate`、`healthStatus`、`locationCode`（10 个）

**数据库佐证**：`SHOW TABLES LIKE '%inventory%'` 只有 `prod_inventory_flow`，
**不存在任何库存台账表**（`prod_harvest_batch` / `prod_harvest_record` 是别的域）。

**后果**：「库存管理」页拿不到一条真实台账。当前页面按缺失字段显示「—」并挂了说明横幅，
属于诚实降级；但**只要后端不补台账，这一页就永远没有真数据**。

**期望语义**：提供库存台账实体（按批次 + 仓库 + 库位聚合当前库存），
至少覆盖上述 12 个字段，并支持 `warehouseName / category / healthStatus / batchNo / keyword` 筛选。

**验收**：调 `GET /harvests/inventory` 逐字段比对，`inventoryId / currentQty / warehouseName` 必须非空。

---

## BT-02　入库端点不存在

| 项 | 内容 |
| --- | --- |
| 端点 | `POST /api/v1/production/harvests/inventory/in` |
| 方法 | POST |
| 前端函数 | `inboundInventory()` → `stockInInventory()` |
| 真实调用方 | `InventoryManage.tsx:44,120` 「入库」 |

**实测返回**：HTTP 200 / `code=500` / `message=系统繁忙，请稍后重试`，`data=null`。
**日志**：`NoResourceFoundException: No static resource api/v1/production/harvests/inventory/in.`

**期望语义**：按批次入库，写入库存流水并更新台账当前库存；返回成功时**台账 currentQty 必须真的变化**。

**验收**：调一次 → `GET /harvests/{batchId}/flows` 回读应多一条 `flowType=1` 的流水；
台账上线后（BT-01）还应回读 `currentQty` 增量等于入库量。

---

## BT-03　损耗登记端点不存在

| 项 | 内容 |
| --- | --- |
| 端点 | `POST /api/v1/production/harvests/inventory/{batchId}/loss` |
| 方法 | POST |
| 前端函数 | `registerLoss()` → `registerInventoryLoss()` |
| 真实调用方 | `InventoryManage.tsx:47,148` 「损耗登记」 |

**实测返回**：HTTP 200 / `code=500`，`data=null`。
**日志**：`NoResourceFoundException: No static resource api/v1/production/harvests/inventory/DEMO-BATCH-001/loss.`

**期望语义**：登记损耗（PRD 对应 `flowType=4` 报损），写流水并扣减台账。

**验收**：调一次 → 回读应多一条 `flowType=4` 且 `qty<0` 的流水。

---

## BT-04　库存调拨端点不存在

| 项 | 内容 |
| --- | --- |
| 端点 | `POST /api/v1/production/harvests/inventory/{batchId}/transfer` |
| 方法 | POST |
| 前端函数 | `transferInventoryRecord()` → `transferInventory()` |
| 真实调用方 | `InventoryDetail.tsx:57,169` 「调拨」 |

**实测返回**：HTTP 200 / `code=500`，`data=null`。
**日志**：`NoResourceFoundException: No static resource api/v1/production/harvests/inventory/DEMO-BATCH-001/transfer.`

**期望语义**：按 `targetWarehouse` / `locationCode` 调拨，`quantity` 从原库位扣、目标库位加。

**验收**：调一次 → 回读应出现成对的出库 / 入库流水（或台账库位变更）。

---

## BT-05　新增库存记录：端点只有 GET，POST 不被允许

| 项 | 内容 |
| --- | --- |
| 端点 | `POST /api/v1/production/harvests/inventory` |
| 方法 | POST（**已存在的是 GET**） |
| 前端函数 | `submitInventory()` → `createInventory()` |
| 真实调用方 | `InventoryCreate.tsx:35,110` 「新增库存」整页 |

**实测返回**：HTTP 200 / `code=500`，`data=null`。
**日志**：`HttpRequestMethodNotSupportedException: Request method 'POST' is not supported`

**注意**：这条与 BT-02/03/04 的成因不同——**路径存在（GET 列表），只是没有 POST**，
所以异常类名是 `HttpRequestMethodNotSupportedException` 而不是 `NoResourceFoundException`。

**期望语义**：新建库存台账记录，返回带 `inventoryId` 的实体。
**依赖**：BT-01（没有台账表，本条无从落库）。

**验收**：POST 后用返回的 `inventoryId` 回读，必须查得到且字段非空（防止"静默写空"）。

---

## BT-06　库存记录详情端点不存在

| 项 | 内容 |
| --- | --- |
| 端点 | `GET /api/v1/production/harvests/inventory/{inventoryId}` |
| 方法 | GET |
| 前端函数 | `queryInventoryRecord()` |
| 真实调用方 | `InventoryDetail.tsx` 「库存详情」整页 |

**实测返回**：HTTP 200 / `code=500`，`data=null`。
**日志**：`NoResourceFoundException: No static resource api/v1/production/harvests/inventory/DEMO-INV-001.`

**现有映射对照**（`HarvestController.java`）只有：
`GET /inventory`（列表）、`POST /inventory/{batchId}/out`、`POST /inventory/{batchId}/freeze`
—— **没有 `GET /inventory/{id}`**。注意 `/harvests/{id}` 只吃一段路径，吃不到两段。

**期望语义**：按 `inventoryId` 返回单条台账。
**依赖**：BT-01。

---

## BT-07　出库：payload 里的 `operatorName` 被静默丢弃

| 项 | 内容 |
| --- | --- |
| 端点 | `POST /api/v1/production/harvests/inventory/{batchId}/out` |
| 方法 | POST（**端点存在且可用**） |
| 前端函数 | `outboundInventory()` → `stockOut()` |
| 真实调用方 | `InventoryDetail.tsx:52,151`、`InventoryManage.tsx:45,136` |

**状态**：这条**能真写入**（本轮唯一一个通过回读验证的写操作）。

实测：HTTP 200 / `code=0` + `flowId=INVF202610101425085811`；
回读 `prod_inventory_flow` **6 → 7 行**，按 batchId 回查到该新行（`qty=-1`、`relatedOrderNo=VERIFY-TEST-1`），
验证后已 `DELETE` 还原。

**问题**：前端 `outboundInventory` 的 payload 允许传 `operatorName`，
但 `stockOut()` 只发 `qty` / `relatedOrderNo`；后端签名也只收
`qty` / `operatorId` / `relatedOrderNo`，**没有 `operatorName`**。
→ 调用方传了 `operatorName`，它**既不报错也不落库**，与"静默写空"同型。

**期望语义**：二选一——后端加 `operatorName`（或 `operatorId`）落库，
或前端把该字段从 payload 里删掉并同步改调用方，**不允许"传了但静默丢弃"**。

---

## 观察项（未开工单，供裁决）

**`HarvestBatch` 缺 `inboundStatus` / `warehouseName`**

`GET /harvests/DEMO-BATCH-001` 实测返回字段全集：
`batchId / batchNo / plotId / planId / cropId / cropVariety / harvestDate / quantity / unit / grade / inspectionId / operatorId / status`
—— **没有 `inboundStatus`（入库状态）与 `warehouseName`**（前端 `HarvestBatch` 契约里的 11 个关键字段命中 9 个）。

前端 `Detail.tsx` 用 `(batch.inboundStatus ?? 0) !== 0` 判断「确认入库」是否可点，
后端从不返回该字段 → 恒为 `0` → **所有批次的入库状态恒显示「待入库」、按钮恒可点**。

这是"后端没给、前端用默认值兜底"，不是前端编造，但**页面显示的状态并非服务端真值**。

**team-lead 裁决（2026-10-10）：两边都做。** 后端补 `inboundStatus` + `warehouseName`（已并入
`se-backend-inv` 的工单）；前端**过渡期改成明示"后端未提供入库状态"**，不再用 `?? 0` 兜底成"待入库"。

### 前端过渡期改法（实施规格）

后端未补字段前，`HarvestBatch.inboundStatus` 在**任何一条真实数据上都是 `undefined`**，
所以下面三处的 `?? 0` 等价于"恒为待入库"，必须改为显式的「未提供」判定。

判定统一收口成一个变量（放在 `Detail.tsx` 里 `const inbound = ...` 之前）：

```ts
/** 后端 HarvestBatchEntity 当前不返回 inboundStatus；未返回时不得当成 0（待入库） */
const inboundStatusProvided: boolean =
  batch.inboundStatus !== undefined && batch.inboundStatus !== null
```

| 位置 | 现状 | 过渡期改法 |
| --- | --- | --- |
| `Detail.tsx:138`<br>`const inbound = INBOUND_STATUS_META[(batch.inboundStatus ?? 0) as InboundStatus]` | 恒取「待入库」的文案与颜色 | `inboundStatusProvided` 为 false 时不要取 `INBOUND_STATUS_META[0]`，改渲染一个中性 Tag：`<Tag>入库状态未提供</Tag>`，并挂 Tooltip「后端未返回入库状态字段，此处不是服务端真值（后端工单已派）」 |
| `Detail.tsx:160`<br>`disabled={(batch.inboundStatus ?? 0) !== 0}` | 恒为 false →「确认入库」**恒可点**（即使用户已入库过，也没有任何提示） | **不要改成禁用**（那会让入库功能彻底不可用）。保持可点，但在按钮上加 Tooltip：「后端未提供入库状态，无法判断是否已入库；若已入库请勿重复提交」，点击后弹窗里也带一行同样措辞的 Alert |
| `Detail.tsx:286`<br>`{(batch.inboundStatus ?? 0) === 0 ? '（入库后自动生成）' : null}` | 恒显示「（入库后自动生成）」 | `inboundStatusProvided` 为 false 时改为「（是否已入库后端未提供，溯源码在入库成功后生成）」 |

**顺带（同型问题）**：`Detail.tsx:332` 入库弹窗 `initialValues={{ warehouseName: '主仓库' }}`
把仓库名**默认写死成"主仓库"**——用户不填就直接以"主仓库"入库，这是"默认值冒充真实值"，
与 `?? 0` 同型。改为**留空 + 必填校验**（或给一个真实存在的仓库下拉），不要给默认值。

**用户最终看到什么**：
1. 入库状态一栏显示「入库状态未提供」（灰色 Tag + Tooltip 说明原因），**不再显示"待入库"**；
2. 「确认入库」按钮仍可点，但 hover 有提示说明"无法判断是否已入库，请勿重复提交"；
3. 入库弹窗里的仓库名必须自己填/选，不再默认"主仓库"。

**依赖**：`Detail.tsx` 曾在 `se-harvest2` 的编辑范围内，动手前先 `git status --porcelain`
确认无在途改动；有则按"协同纪律"用 `git apply --cached` 按 hunk 提交。

---

---

# 域 2：`admin/tenants`（运营端租户管理）

> 产出人：se-verify-fix　日期：2026-10-10
> 实测环境同域 1（`core-app` :8098）。本域**只出工单不改代码**（除 BT-08 需裁决）。

**现有端点清单**（`AdminTenantController.java`，实测可用）：
`GET /admin/tenants`（3 条）、`GET /overview`、`GET /overview/{tenantId}`、`GET /{quotaId}`、
`GET /{quotaId}/usage`、`GET /quotas`（3 条）、`GET /segments`（3 条）、
`GET /quota-overview`（3 条）、`GET /{quotaId}/quota-overview`、
`POST /admin/tenants`、`PUT /{id}`、`DELETE /{id}`、`POST /{quotaId}/reset-usage`、
`PUT /{tenantId}/quota-limits`、`PUT /quota-limits/batch`。

---

## BT-08　「重置已用配额」**前端路径写错**（不是后端缺端点）⭐

| 项 | 内容 |
| --- | --- |
| 前端调用 | `POST /admin/tenants/{tenantId}/quota-usage/reset` |
| **真端点** | `POST /admin/tenants/{quotaId}/reset-usage` |
| 前端函数 | `tenants.ts` `resetTenantQuotaUsage()` |
| 真实调用方 | `TenantDetail.tsx:77,336`、`TenantQuotas.tsx:45` |

**成对实测（同一个不存在的 id，排除"id 无效"干扰）**：

```
POST /admin/tenants/NOPE/reset-usage          → code=404「资源不存在」  ← 端点存在，id 无效
POST /admin/tenants/NOPE/quota-usage/reset    → code=500「系统繁忙」    ← 端点不存在
```

**日志原文**：`NoResourceFoundException: No static resource api/v1/production/admin/tenants/NOPE/quota-usage/reset.`

**性质**：与域 1 的 `queryInventoryFlows` 同型——**端点其实存在，是前端把路径写错了**，
所以用户点「重置已用配额」必失败，而页面看到的是"系统繁忙"，排障极易误判成后端没做。

**期望语义**：前端改为 `POST /admin/tenants/{quotaId}/reset-usage`（注意入参也从 tenantId 换成 quotaId，见 BT-09）。

**⚠️ 需裁决**：这条是**前端一处路径修错**，不是后端工单。是否由我直接改（一行）？
（`api/admin/tenants.ts` 当前无人在途改动，可安全修改。）

---

## BT-09　租户标识体系：`tenantId` 恒为 `"0"` → 租户详情页 100% 打不开 ⭐（本域根因）

**实测**：`GET /admin/tenants?page=1&size=10` 全部 3 条：

```
{"quotaId":"DEMO-QUOTA-001","tenantId":"0","tenantCode":"DEMO-TENANT-001","tenantName":"【演示】华南示范农业合作社","status":1}
{"quotaId":"DEMO-QUOTA-002","tenantId":"0","tenantCode":"DEMO-TENANT-002","tenantName":"【演示】华东稻米产业联合体","status":1}
{"quotaId":"QUOT202610090954433640","tenantId":"0","tenantCode":"T001","tenantName":"绿源合作社","status":1}
```

**三条的 `tenantId` 全是 `"0"`**（`prod_tenant_quota.tenant_id` 未填，默认 0）。

**连带失效链（逐环实测）**：

1. `TenantList.tsx:291` 用 `entity.tenantId` 跳转 → 三个「查看」按钮**全部**跳到
   `/admin/production/tenants/0`；
2. `getTenant('0')` → `GET /admin/tenants/0` → **code=404「资源不存在」**
   （而 `GET /admin/tenants/DEMO-QUOTA-001` → **code=0 正常**）；
3. `getTenantQuotaOverview('0')` → `GET /admin/tenants/0/quota-overview` → **code=404「租户不存在：0」**
   （而 `GET /admin/tenants/DEMO-QUOTA-001/quota-overview` → **code=0，4 项真数据**
   `农场数 used=2 / limit=20 / usageRate=10`）；
4. `getTenantOverviewById('0')` → `GET /admin/tenants/overview/0` → code=0 **但只返回 1 行**
   （三条租户被聚成 tenantId=0 一条），`GET /overview/1` → 404。

**结论**：`quotaId` 才是可用的租户标识；前端在 `quotaId` / `tenantId` 之间混用。

**期望语义**：
- 后端：建租户主表、给 `prod_tenant_quota.tenant_id` 填真值（三个租户不能共用一个 0），
  并明确"租户标识"到底用哪个；
- 前端：后端补齐前，统一改用 `quotaId` 作为跳转与查询入参（涉及 `TenantList.tsx:291`
  及 `TenantDetail` 的 `tenantId` 来源）。

**验收**：三条租户应有三个互不相同的 `tenantId`；`GET /admin/tenants/{tenantId}` 各自返回自己那条。

---

## BT-10　租户农场列表端点不存在（详情 Tab2）

| 项 | 内容 |
| --- | --- |
| 端点 | `GET /admin/tenants/{tenantId}/farms` |
| 前端函数 | `listTenantFarms()` |
| 调用方 | `TenantDetail.tsx:75,250` |

**实测**：`GET /admin/tenants/0/farms?page=1&size=5` → code=500；
`GET /admin/tenants/NOPE/farms` → code=500。
**日志**：`NoResourceFoundException: No static resource api/v1/production/admin/tenants/NOPE/farms.`

**期望语义**：按租户返回其农场列表（分页），字段至少含农场名 / 地块数 / 状态。
**依赖**：BT-09（先有真 tenantId，否则按 0 查不到归属）。

---

## BT-11　租户操作日志端点不存在（详情 Tab4）

| 项 | 内容 |
| --- | --- |
| 端点 | `GET /admin/tenants/{tenantId}/logs` |
| 前端函数 | `listTenantOperationLogs()` |
| 调用方 | `TenantDetail.tsx:76,266` |

**实测**：code=500；日志 `NoResourceFoundException: ... /NOPE/logs.`

**期望语义**：按租户返回操作日志（分页）。**依赖**：BT-09 与"操作日志表/审计日志"是否有数据源。

---

## BT-12　租户分层画像端点不存在（分层运营页列表）

| 项 | 内容 |
| --- | --- |
| 端点 | `GET /admin/tenants/profiles` |
| 前端函数 | `listTenantProfiles()` |
| 调用方 | `TenantSegments.tsx:47,156` |

**实测**：`GET /admin/tenants/profiles?page=1&size=5` → **code=404「资源不存在」**。

**⚠️ 注意成因与上面不同**：这里是 **404 而不是 500**，因为 `/profiles` 被通配的
`GET /{id}` 吞了（把 "profiles" 当成 id 去查，查不到 → 404）。
**不要因为看到 404 就判"没数据"**——端点根本不存在（见域 1 文档头的排障提醒）。

**契约差距**：前端 `TenantSegmentProfile` 要 11 个字段（`segment / tags / activity /
quotaUsageRate / activeDays / revenue / strategy` …），后端**没有任何数据源**。

---

## BT-13　分层汇总统计端点不存在（分层运营页统计卡）

| 项 | 内容 |
| --- | --- |
| 端点 | `GET /admin/tenants/segment-summary` |
| 前端函数 | `listTenantSegmentSummary()` |
| 调用方 | `TenantSegments.tsx:47,148` |

**实测**：code=404（同样被 `GET /{id}` 吞）。后端无分层数据源。

---

## BT-14　分层/配额的写端点不存在

| 前端调用 | 方法 | 实测 | 调用方 |
| --- | --- | --- | --- |
| `/admin/tenants/{tenantId}/profile` | PUT | 500 `NoResourceFoundException` | `TenantSegments.tsx:47,168` |
| `/admin/tenants/segments` | POST | 500 `NoResourceFoundException` | （`createTenantSegment`） |
| `/admin/tenants/segments/{id}` | DELETE | 500 `NoResourceFoundException` | （`deleteTenantSegment`） |
| `/admin/tenants/quotas/{id}` | PUT | 500 `NoResourceFoundException` | （`updateTenantQuota`） |
| `/admin/tenants/{id}/status` | PATCH | 500 `NoResourceFoundException` | （`updateTenantStatus`） |

**后端现状**：只有 `GET /quotas`、`GET /segments` 两个**读**端点，没有任何对应的写端点。

**期望语义**：分层可写（分层 / 标签 / 策略）、配额可改、租户可冻结解冻。

---

## 死代码候选（按规则：端点不存在 **且** 无调用方 → 前端删）

- `updateTenantStatus()`（`PATCH /{id}/status`）：端点不存在 + 全仓 grep **零调用方** → 建议删除声明。
- `listTenantQuotas()`（`GET /quotas`）：端点**存在且有 3 条数据**，但零调用方 → 不删，
  等页面接入或后端确认该端点是否废弃。

（本轮只记录，未删除——删除属代码改动，等 team-lead 裁决。）

---

## 附：已验证为"真生效 / 有真数据"的对照（跨两个域）

| 操作 | 端点 | 结果 |
| --- | --- | --- |
| 出库 | `POST /harvests/inventory/{batchId}/out` | `prod_inventory_flow` +1 行，按 batchId 回查得到新行 ✅ |
| 采收批次详情 | `GET /harvests/{batchId}` | 真数据，`demo=false`，9/11 关键字段命中 ✅ |
| 出入库流水 | `GET /harvests/{batchId}/flows` | 真数据，`demo=false`，每批次 2 条 ✅ |
| 任务提交验收 | `POST /tasks/{taskId}/submit` | `status=done` + `acceptStatus=0`（已还原）✅ |
| 租户列表 | `GET /admin/tenants` | 3 条真数据 ✅ |
| 租户详情（**传 quotaId**） | `GET /admin/tenants/DEMO-QUOTA-001` | 真数据，19 字段 ✅ |
| 租户配额概览（**传 quotaId**） | `GET /admin/tenants/DEMO-QUOTA-001/quota-overview` | 4 项真数据（农场数 used 2 / limit 20 / rate 10%）✅ |
| 配额用量 | `GET /admin/tenants/DEMO-QUOTA-001/usage` | 真数据 ✅ |
| 平台级租户概览 | `GET /admin/tenants/overview` | 真数据（含 farmTotal / deviceOnlineCount / pendingAlertCount）✅ |
| 配额一览 / 分层列表 | `GET /admin/tenants/quota-overview`、`/segments` | 各 3 条 ✅ |
