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

# 跨实体治理项 G-01　`deleteById` 丢弃受影响行数 → 「删了个寂寞」还报 success

> 开单人：se-verify-fix　日期：2026-10-10　裁决：team-lead
> 性质：**不是某个实体的 bug，是通用 Service 模板的问题**。因此单独立项，
> 不逐实体补工单——否则每接一个新实体就多一处静默无操作。

## 现象（两处不同模块、同一成因，均为实测）

| # | 调用 | 响应 | 实际效果 | 源码 |
|---|---|---|---|---|
| BT-22 | `DELETE /settings/{不存在的 id}` | `code=0 success` | 一行没删，记录原封不动 | `SysSettingService#delete` |
| BT-28 | `DELETE /analytics/NOPE` | `code=0 success` | 一行没删 | `AnalyticsSnapshotService.java:93-95` |

两处的 Service 都是同一写法：

```java
public void delete(String id) {
    xxxMapper.deleteById(id);   // MyBatis-Plus 的受影响行数被直接丢弃
}
```

`deleteById` 返回 `int`（受影响行数），这里既没接收、也没判断、也没抛错，
于是不管删没删到，Controller 一律返回成功。

## 为什么必须放在基础设施层解决

- 逐实体改 = 每个新实体复制粘贴一次同样的坑；今天两处，明天十处。
- 调用方（前端）**无法通过响应判断删除是否生效**——响应体里没有任何受影响行数的痕迹。
  前端只能靠"删完再查一次"兜底（BT-22 的 `deleteSetting` 已这么做），
  但那是防御性代码，不该是每个调用方各自的负担。
- 与「静默写空」是同一类问题：响应体说成功，服务端什么都没做。

## 期望语义（建议方案，请后端定）

1. **统一**：在通用 Service 基类 / 模板方法里收口删除——
   `int affected = mapper.deleteById(id); if (affected == 0) throw NOT_FOUND;`
   （或在响应里带上 `affected`，由调用方判断，二者选一，但**必须全库一致**）。
2. 逻辑删除（`deleted` 字段）的实体同理：`updateById` 也要看返回值。
3. 治理完成后，前端 `deleteSetting` 里的"删完回读复核"可以撤掉，
   改为直接信任响应——**但撤之前必须先实测确认受影响行数真的回来了**。

## 挂在 G-01 下的既有工单

- **BT-22**（settings 域）：`DELETE /settings/{id}` 删不到也返回 success。
- **BT-28**（analytics 域）：`DELETE /analytics/{id}` 删不到也返回 success，第二例。
  - 附注：BT-28 的路径还删错了实体（删的是指标快照，不是报表），
    那部分属于**实体/端点**问题，仍归 BT-27 / BT-28 自身，不并入 G-01。

## 前端侧已做的防护（不等后端，先不骗人）

- `src/api/settings.ts` 的 `deleteSetting`：先按 key 查出 `settingId`，
  删完**回读复核**，记录仍在就抛错（不允许"返回成功但没删"静默过去）。
- `ProductionReports.tsx` 的 `handleDelete`：删除后校验返回，
  "后端返回成功但没有记录被删除"时如实报错；且因端点删错实体，
  服务端行的删除按钮当前置灰并写明原因（BT-27）。

---

## BT-01　库存台账实体缺失（最高优先，是 BT-02/03/04 的根因之一）

> ⚠️ **本条结论已过期，需修订**（2026-10-10 复核，只读）：
> 原文称「`SHOW TABLES LIKE '%inventory%'` 只有 `prod_inventory_flow`，**不存在任何库存台账表**」。
> 现在 **`prod_inventory` 已存在**（`inventory_id / batch_id / warehouse_id / warehouse_name /
> location_code / current_qty / frozen_qty / safe_qty / health_status / expire_date` 全齐），
> 且有 5 条真种子数据（DEMO-INVT-001~005，current_qty 分别为 5400 / 5080 / 80 / 620 / 96000）。
> **台账表和数据都已有了**，剩下的问题是"列表接口读的不是它"（见下方 BT-01 补充）。
>
> 保留本条作为历史记录，但**不要再以"没有台账表"为由给新工单定性**。

---

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

### BT-01 补充（2026-10-10 只读复核）：台账表有了，但列表接口读的是**流水**

**只读实测**（core-app :8095，MySQL `agri_core` 直读，未做任何写操作）：

| 事实 | 证据 |
| --- | --- |
| 台账表 `prod_inventory` 存在且有 5 条真数据 | `DEMO-INVT-001~005`，`current_qty` = 5400 / 5080 / 80 / 620 / **96000** |
| 流水表 `prod_inventory_flow` 有 5 条 | `DEMO-INV-001~005`，含 `before_qty` / `after_qty` |
| `GET /harvests/inventory`（列表）返回的是**流水**，不是台账 | 5 行里 `inventoryId / currentQty / warehouseName / locationCode / frozenQty` **全为 null**，只有 `batchId` / `warehouseId` |
| `GET /harvests/inventory/{id}` 取不到台账 | `DEMO-INVT-004` 与 `zzz-not-exist` **均 500**（两者同响应 → 未形成对照，只能判定该路径无 handler，需换差一段路径再确认） |

⚠️ **一次差点误报，记下来免得别人再踩**：列表里 `DEMO-BATCH-001 + DEMO-WH-001` 出现了**两次**，
第一眼很像"同批次同仓库重复台账"。但那两行是**流水**（入 8600 / 出 -3200），
同一批次有多条流水是**正常的**——台账表 `prod_inventory` 里 `GROUP BY batch_id, warehouse_id HAVING COUNT(*)>1`
**零命中**，并不存在重复台账。判断"重复"前必须先确认看的是哪张表。

**结论**：写走 `prod_inventory`（台账）、读走 `prod_inventory_flow`（流水）——
**入库写成功了，页面上也永远看不见**（列表恒显示流水形状，currentQty 恒 null）。
这条与 BT-02 是同一个根因的两面。

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
台账上线后（BT-01 已完成，见上文补充）还应回读 `currentQty` 增量等于入库量。

### ⚠️ BT-02 二次实测（2026-10-10 15:58，:8098）：端点后来出现了，但它是**静默假成功** —— 已转 se-backend-inv

> 定性升级：原先是"端点不存在"（500），现在端点存在了，问题反而更严重——
> **返回成功但没干成事**，前端照着 `data=true` 弹「入库成功」。

**实测**（调用 → 回读 → 比对）：

```
POST /harvests/inventory/in  →  {"code":0,"message":"success","data":true}
回读 DEMO-INVT-004            →  current_qty 仍为 96000.00（**没变**）
实际发生的事                   →  新造了一条台账 INV202610101558046365（同 batch + 同 warehouse）
                                 + 一条流水
```

**后果比"没生效"更麻烦**：同一批次同一仓库可以存在 N 条台账 →
列表里同一批次重复出现，**"当前库存"不再唯一**，任何按 `batch_id` 聚合的口径都会翻倍。

**库当前是干净的**（2026-10-10 复核，只读）：`prod_inventory` 只有 5 条 `DEMO-INVT-*`，
`inventory_id LIKE 'INV2026%'` 零命中；`prod_inventory_flow` 无今天 15:00 之后的行
→ 那次探针写入的痕迹已经清掉了，**不需要额外还原**。

**整改要求（se-backend-inv）**：
1. 按 `batch + warehouse + location` 定位已有台账做 **upsert**，不要每次新增；
2. 加**唯一约束**，从库层面禁止同批次同库位多台账；
3. 返回值回传**更新后的 `currentQty`**，不要只返 `boolean`——
   只返 boolean 的话调用方无法判断"到底加到多少了"，等于把验收责任推给前端回读。

**回读验收（本条由 se-verify-fix 执行）**：先快照 → 调用 → 回读 → 还原。
判据：`data` 里的 `currentQty` = 快照值 + 入库量，且台账**条数不增加**。

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

### 附：BT-03 / BT-04 共用一套错误文案（team-lead 转述，已一并派给 se-backend-inv）

调拨（BT-04）场景失败时，页面读到的是**「报损」**的文案——BT-03 与 BT-04 复用了同一段错误提示，
导致使用者在调拨失败时看到与操作完全不相干的提示，会按错误的方向去排查。

整改：两个操作各自的失败提示必须带上**自己的操作名**（损耗登记 / 调拨），不要共用。
（本段依据 team-lead 转述登记，**实测原文待补**——se-backend-inv 改完后由 se-verify-fix 回读验收时一并补上。）

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

**裁决（team-lead 2026-10-10）**：批准改，但要求先确认调用方手上有 quotaId。
**已确认有**：实测 `GET /admin/tenants/quota-overview` 的行里，`tenantId` 字段**填的其实就是
quotaId**（三条为 `DEMO-QUOTA-001` / `DEMO-QUOTA-002` / `QUOT202610090954433640`），
且 `farm.quotaId` 同为这个值；`TenantDetail` 侧 `OpsTenantRow.quotaId` 也可得。

**已修复（commit `9bb52bf5`）**：路径改回 `POST /admin/tenants/{quotaId}/reset-usage`，
入参语义同步改为 quotaId（`TenantQuotas` 传 `row.farm?.quotaId ?? row.tenantId`；
`TenantDetail` 传 `tenant?.quotaId`，取不到就直接抛错，**不拿 tenantId 冒充 quotaId**）。

**修复后实测（真实模块 `ssrLoadModule` + 真后端 :8098）**：

| 用例 | 结果 |
| --- | --- |
| 真 quotaId `DEMO-QUOTA-001` | 业务码 **1000** 明确拒绝：**「该租户未绑定 tenant_id（当前值为 0）：按 tenant_id 统计会退化成「全部未打标农场的总数」，与全平台统计等价并产出误导性数值，已拒绝执行；请先回填 `prod_farm_info.tenant_id` 后重试（quotaId=DEMO-QUOTA-001）」** |
| 不存在的 id `NOPE` | **bizCode=404**（不是 500）✅ |

两条合起来说明：**路径与入参都已命中真端点**（不再是 500 路径不存在），
但功能仍不可用——**根因是 BT-09**：不仅 `prod_tenant_quota.tenant_id` 全库为 0，
**`prod_farm_info.tenant_id` 也是全 0**（实测 6 个农场 `COUNT(DISTINCT tenant_id)=1`、min=max=0），
后端自己都拒绝按 tenant_id 统计（怕产出误导性数值）。

**这条后端守卫做得对**：它宁可明确拒绝，也不返回一个"看起来有数、实际是全平台总数"的值。
前端侧无需再改，等 BT-09 回填数据后即可用。

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

**补充实测（2026-10-10，BT-08 修复后触发出来的）**：问题不止 `prod_tenant_quota.tenant_id`。
后端 `reset-usage` 直接拒绝执行并点名另一张表：

> 「该租户未绑定 tenant_id（当前值为 0）……请先回填 **`prod_farm_info.tenant_id`** 后重试」

DB 复核：`SELECT COUNT(*) , COUNT(DISTINCT tenant_id), MIN(tenant_id), MAX(tenant_id) FROM prod_farm_info`
→ `6 个农场 / distinct=1 / min=0 / max=0`。**农场表的 tenant_id 同样全是 0。**

即：**租户维度在配额表与农场表两张主表上都没有区分度**，与 team-lead 已知的
「生产域 7 张主表 `COUNT(DISTINCT tenant_id)` 全部为 1」是同一个系统性问题。

**裁决（team-lead 2026-10-10）**：
1. 前端改用 `quotaId` 作为租户标识（它有三条不同的真值，可用）——不等后端回填；
2. 后端工单记一条**标识口径**类（不是"补端点"）：要么回填 `tenant_id`，
   要么明确 `quotaId` 即租户标识并在 API 层统一——**二选一，不许继续混用**；
3. 页面顶部明说口径："当前租户标识取自配额记录（quotaId），后端 tenant_id 字段全库为 0 暂不可用"。

**验收**：三条租户应有三个互不相同的 `tenantId`；`GET /admin/tenants/{tenantId}` 各自返回自己那条；
`prod_farm_info.tenant_id` 要有真值且能区分到具体租户（否则 `reset-usage` 仍会被后端拒绝）。

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

## 死代码处置（team-lead 2026-10-10 裁决）

- **`updateTenantStatus()`（`PATCH /{id}/status`）→ 已删除**（commit `9bb52bf5`）。
  判据：端点不存在 **且** 无调用方 → 删。删除处留了说明注释（含实测证据），
  避免以后有人以为"租户冻结/解冻有接口，只是暂时没接"。
- **`listTenantQuotas()`（`GET /quotas`）→ 保留**。判据：端点**存在且有 3 条真数据**，
  只是暂时没人用（"暂时没人用"≠"不能用"），删了以后要用还得重建。

---

---

# 域 3：`admin/reports`（运营端统计报表）

> 产出人：se-verify-fix　日期：2026-10-10　实测环境同域 1（`core-app` :8098）。
> 本域前端**已由前序同事做过一轮诚实化**（`catch` 里的"后端暂不可用，当前使用本地计算结果"
> 已删、`/stat` 与列表都改为返回 `unavailableReason`），所以本轮**没有发现新的"假数据"**，
> 剩余 4 条全是"后端缺能力 / 契约不符"。

**现有端点**（`AdminReportController.java`）：`GET /admin/reports`（page / size / keyword / status）、
`GET /{id}`、`POST`、`PUT /{id}`、`DELETE /{id}`、`POST /{reportId}/generate`、
`GET /by-type?reportType=`、`GET /production`、`GET /quality`。

---

## BT-15　`GET /admin/reports/stat` 端点不存在（报表中心统计卡）

| 项 | 内容 |
| --- | --- |
| 端点 | `GET /admin/reports/stat` |
| 前端函数 | `getReportCenterStat()` |
| 调用方 | `ReportCenter.tsx` 顶部统计卡 |

**实测**：`GET /admin/reports/stat` → **code=404「资源不存在」**，与对照组
`GET /admin/reports/zzz-not-exist`（404）**完全一致**。

**成因**：`/stat` 被 `@GetMapping("/{id}")` 吞掉，后端拿 "stat" 当报表 id 去查，查不到 → 404。
（不是"没数据"，是端点根本不存在——见域 2 的 BT-12/13，同一个坑。）

**前端现状**：`getReportCenterStat` 已改为返回 `unavailableReason`，页面显示失败态与「—」，
**不再用示例数字顶上**（旧代码曾在 catch 里返回 `monthCount: 128` 这类编造值）。
→ **前端侧无需改动**，纯等后端。

**期望语义**：4 项统计——报表总数 / 本月生成数 / 已下载次数 / 生成失败数。

---

## BT-16　`getAdminReport` 声明的 `ReportItem` 契约与后端 `ReportTaskEntity` 不符 ⚠️ 前端侧问题

| 项 | 内容 |
| --- | --- |
| 端点 | `GET /admin/reports/{id}`（**端点存在且有真数据**） |
| 前端声明 | `reports.ts:149` `getAdminReport(): Promise<ReportItem>` |
| 契约来源 | `types/analytics.ts:51` `ReportItem` |

**实测** `GET /admin/reports/DEMO-RPT-002` 真值：

```json
{"reportId":"DEMO-RPT-002","reportType":"GOV","reportName":"2026年度农产品质量追溯监管年报",
 "status":"PENDING","fileUrl":null,"generatedAt":null,
 "bizDateFrom":"2026-01-01","bizDateTo":"2026-12-31","generatorId":"SUPER_ADMIN","farmId":null}
```

**逐字段比对**：

| 前端 `ReportItem` | 后端真值 | 结果 |
| --- | --- | --- |
| `reportType: ReportType`（1日报/2周报/3月报/4季报/5年报） | `"GOV"` / `"BIZ"` / `"QUALITY"`（**字符串**） | ❌ 类型完全不同 |
| `status: 1 \| 2 \| 3` | `"PENDING"` / `"RUNNING"` / `"DONE"` / `"FAILED"`（**字符串**） | ❌ 数字判断恒不成立 |
| `period: string`（必填，如 "2026-03"） | **后端没有该字段**（用 `bizDateFrom` / `bizDateTo`） | ❌ 恒 undefined |
| `fileSize?: number` | **后端没有** | ❌ 恒 undefined |
| `generatorName?: string` | 后端是 `generatorId`（`"SUPER_ADMIN"`） | ❌ 恒 undefined |

**性质**：端点存在、数据真实，但**前端声明的返回类型是一个后端不会返回的形状**——
调用方按 `ReportItem` 渲染会全空，且 `status` 的数字判断恒不成立。这是"契约撒谎"，不是后端问题。

**零调用方**：全仓 grep `getAdminReport` 只命中声明本身，没有任何页面调用。

### ✅ team-lead 裁决（2026-10-10）：改走 `ReportTask`，**不删**

> 判定规则：**端点存在 + 有真数据 → 保留并修契约；端点不存在 + 零调用方 → 才删。**
> "零调用方"只在端点不存在时才构成删除理由；端点在、数据真，留着错误契约
> 会被下一个人复制粘贴走，删掉反而丢掉"这里有个端点"的信息。

**已执行**（commit `见本轮域5提交`）：返回类型 `ReportItem` → `ReportTask`，
注释里写明端点存在、真值形状、以及成对探测结论；同时移除已不再使用的
`ReportItem` 导入。`./node_modules/.bin/tsc --noEmit -p tsconfig.json` 退出 0。

---

## BT-17　`GET /admin/reports/by-type` 参数名不匹配 → 500（端点**存在**）

**实测**：`GET /admin/reports/by-type?type=GOV` → **code=500「系统繁忙」**。
**日志**：`MissingServletRequestParameterException: Required request parameter 'reportType' is not present`

**成因**：端点存在，但必填入参叫 **`reportType`**，不是 `type`。
这正是"端点存在但参数名不匹配同样返回 500"的典型（与 `NoResourceFoundException` 的 500
在响应体上无法区分，只能靠日志）。

**前端现状**：`api/admin/reports.ts` **未声明**该端点，零调用方 → 暂无影响，记录备查。
**注意**：该端点返回**裸数组**（`List<ReportTaskEntity>`，非 PageResult），接入时必须用 `toPageResult`。

---

## BT-18　`POST /admin/reports/{reportId}/generate` 不产出真实文件

| 项 | 内容 |
| --- | --- |
| 端点 | `POST /admin/reports/{reportId}/generate` |
| 存在性实测 | `POST /admin/reports/NOPE/generate` → **404」（端点存在，id 无效；若端点不存在会是 500） |

**问题**：后端 `ReportTaskService#generate` 只把状态改成 `DONE`、
回填一个 `/report/{id}.xlsx` **字符串**，**并不产出任何真实报表文件**。
用户点「生成」会看到"已完成"，但拿不到文件——这是"写操作谎称成功"。

**前端现状**：`createReportTask` 的注释里已明确"不调用它，调用等于向用户谎称已生成"，
**前端已诚实（不调用）**。→ 纯后端工单。

**期望语义**：真正产出报表文件并返回可下载的真实地址；或明确该能力未实现。

### 补充实测（2026-10-10，:8097）：真调一次 generate，证明「产物不存在」

上面只证了端点存在（`NOPE` → 404）。这里**真调用一次**（`DEMO-RPT-002`，测后已用 mysql 还原）：

```
BEFORE            {"status":"PENDING","generatedAt":null,"fileUrl":null}
POST /generate    code=0 → {"status":"DONE","generatedAt":"2026-10-10 15:20:17",
                            "fileUrl":"/report/DEMO-RPT-002.xlsx"}

GET /report/DEMO-RPT-002.xlsx   → HTTP 200  响应体 {"code":500,"message":"系统繁忙，请稍后重试"}
GET /report/NOPE-999.xlsx       → HTTP 200  响应体 **完全一致**      ← 对照组
```

关键：**HTTP 是 200**（JSON 包装体），不是 404，所以只看 HTTP 状态会以为文件在。
对"生成出来的文件名"和"根本不存在的文件名"请求，**返回完全相同** → 产物确实不存在。

`DEMO-RPT-002` 已还原为 `status=PENDING / generatedAt=null / fileUrl=null` 并回读确认。

---

## 附：`admin/reports` 域已验证有真数据的端点

| 端点 | 实测 |
| --- | --- |
| `GET /admin/reports?page=1&size=5` | code=0，**2 条**真任务（DEMO-RPT-002 / GOV / PENDING；DEMO-RPT-001 / QUALITY / DONE）✅ |
| `GET /admin/reports/{id}` | code=0，真数据（17 字段）✅ |
| `GET /admin/reports/production` | code=0，**裸数组** 1 条 ✅（前端已用 `toPageResult` 处理） |
| `GET /admin/reports/quality` | code=0，**裸数组** 1 条 ✅ |
| `POST /admin/reports`、`PUT /{id}`、`DELETE /{id}` | 端点存在（来自映射；**未实际调用**，避免造脏数据） |

**另**：`ReportCenter.tsx:161` 有个 `catch { return [] }`，但它是
`localStorage` 收藏夹的 JSON 解析失败兜底（坏了就当没收藏），**不涉及真数据判定，可接受的兜底**。

---

---

# 域 4：`settings`（系统设置）

> 产出人：se-verify-fix　日期：2026-10-10　实测端口 **8097**
> 本域**只出工单不改代码**。

**现有端点**（`SettingController.java`）：`GET /settings`（4 条）、`GET /{id}`、`POST`、
`PUT /{id}`、`DELETE /{id}`、`GET /by-key?settingKey=`、`POST /save`。

---

## BT-19　租户档案端点不存在（读 + 写都没有）

| 项 | 内容 |
| --- | --- |
| 读端点 | `GET /api/v1/production/settings/tenant` → **code=404「资源不存在」** |
| 写端点 | `PUT /api/v1/production/settings/tenant` → **code=404「资源不存在」** |
| 前端函数 | `getTenantProfile()` / `saveTenantProfile()` |
| 调用方 | `SystemSettings.tsx:50-54,286,327` |

**前端现状**：已诚实化——`getTenantProfile` 返回 `unavailableReason`，页面显示「—」并挂说明横幅；
`saveTenantProfile` 失败则如实报错、不写本地。**纯后端工单。**

**期望语义**：租户档案的读与保存（农场名称 / 统一社会信用代码 / 联系人 / 区域 / 简介等）。
需先确认落库位置（`prod_sys_setting` 显然不是放档案的地方）。

---

## BT-20　操作日志端点不存在 ⚠️（它是巡检手册里的"标准模板"）

| 项 | 内容 |
| --- | --- |
| 端点 | `GET /api/v1/production/settings/logs` → **code=404「资源不存在」** |
| 前端函数 | `listOperationLogs()` |
| 调用方 | `SystemSettings.tsx:51` |

**全后端佐证**：`core-platform` 下 grep `OperationLog` / `SysLog` **零命中**，也没有任何 `/logs` 映射。

**⚠️ 必须说清楚的一点**：`scripts/page-patrol.md` 与本文档都把 `listOperationLogs` 当作
**"失败带 `unavailableReason`、不回落示例数据"的正确模板**——这个**写法**仍然是标准，
但**它自己的端点同样不存在**，所以它当前也永远返回 `unavailableReason`、拿不到一条真实日志。
引用它时请引**结构**，不要误以为"这个接口是通的"。

**期望语义**：提供操作日志数据源与分页端点（谁 / 何时 / 做了什么 / 结果）。

---

## BT-21　`getSetting(configKey)` 的路径取不到数据（**与既有裁决冲突，请裁决**）

**实测**（同一个配置项，三种取法）：

```
GET /settings/by-key?settingKey=DEMO.alert.notifyChannels → code=0 ✅ 正确用法
GET /settings/DEMO-SET-001                                → code=0 ✅（传的是 settingId）
GET /settings/DEMO.alert.notifyChannels                   → code=404 ❌（前端 getSetting 的写法）
```

**成因**：`@GetMapping("/{id}")` 里的 `id` 是 **`settingId`**，不是 `settingKey`。
前端 `getSetting(configKey)`（`api/settings.ts:78-79`）把 configKey 拼进 `/{configKey}`，
对该端点而言就是在用一个不存在的 id 去查 → 404。

**零调用方**：全仓 grep `getSetting(` 只命中声明本身，**没有任何页面调用**。

**⚠️ 与既有裁决冲突**：上一轮 team-lead 曾裁决「`getSetting(configKey)`（path `/{configKey}`）
必须 NOT be changed」。当时的上下文是"不要顺手改"，现在实测证明**这个写法取不到数据**。

### ✅ team-lead 裁决（2026-10-10）：选 2，**改走 `by-key`，不删**

> 判定规则：**端点存在 + 有真数据 → 保留并修契约；端点不存在 + 零调用方 → 才删。**
> `/settings/by-key?settingKey=` 有真值（实测返回 `["INBOX","SMS","WECHAT"]`），
> 而 `deleteSetting` 已经在用这个正确取法——留一个错的、一个对的，下一个人会照错的抄。

**已执行**：`getSetting` 改为 `GET /settings/by-key?settingKey=`，
返回类型 `Promise<SettingItem>` → `Promise<SettingItem | null>`（键不存在时后端返回
`data: null`，如实返回 null，不伪造、不抛"没数据"当资源不存在），
并把后端 `settingKey / settingValue / remark` 映射回前端 `configKey / configValue / description`。
零调用方，无回归面。`./node_modules/.bin/tsc --noEmit -p tsconfig.json` 退出 0。

---

## BT-22　写端点的两处"静默"行为（后端）

> **已挂到跨实体治理项 [G-01](#跨实体治理项-g-01deletebyid-丢弃受影响行数--删了个寂寞还报-success)**：
> 第一条（DELETE 不校验受影响行数）与 BT-28 同源，**统一在基础设施层解决，不逐实体补**。
> 本条继续保留，用于跟踪第二条（空体 POST 静默写空）——那条是**入参校验**问题，与 G-01 不同源。

| 现象 | 实测 | 类型 |
| --- | --- | --- |
| `DELETE /settings/{不存在的 id}` | `code=0 / success`，**一行也没删** | **静默无操作**（→ G-01） |
| `POST /settings/save` **空体** `{}` | `code=0 / success`，且**真的 INSERT 了一条 `setting_key` / `setting_value` 全为 NULL 的行** | **静默写空** |

（第二条是本轮实测**亲手触发**的：为探端点存在性发了一次空体 POST，库里多了一条
`SETG202610101458363756`（键值全 NULL），**已 DELETE 清理**；顺带把早前探针留下的另外两条
NULL 键值行也一并清理，当前 `prod_sys_setting` 已无 `setting_key IS NULL` 的行。）

**期望语义**：
- `DELETE` 应返回受影响行数，删不到就报错（不要让调用方以为删成功了）；
- `POST /save` 应校验 `settingKey` 非空，空则 400 且**不落库**。

**前端侧**已按"回读验收"标准处理：`deleteSetting` 就是「取真实 id → 删 → 再读校验」，
正是为了防这类静默；但**服务端不该依赖调用方回读才发现没删成**。

---

## 观察项（未开工单）

`GET /settings?page=1&size=10` 返回 **4 条**（`DEMO-SET-001~004`），而库里
`prod_sys_setting` 有 18 行——差额是按 `market_id` / `tenant_id` 隔离的结果。
即：**通过页面保存的 10 条参数配置（13:34 那批）不在当前租户的列表里**。
需确认这是预期的多租户隔离，还是保存时写错了 market/tenant 归属。

---

## 附：已验证为"真生效 / 有真数据"的对照（跨四个域）

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
| 报表任务列表 | `GET /admin/reports` | 2 条真任务（GOV/PENDING、QUALITY/DONE）✅ |
| 报表任务详情 | `GET /admin/reports/DEMO-RPT-002` | 真数据，17 字段 ✅ |
| 生产/质量报表 | `GET /admin/reports/production`、`/quality` | 各 1 条（裸数组）✅ |
| 系统配置列表 | `GET /settings?page=1&size=10` | 4 条真配置 ✅ |
| 配置项（按 id / 按 key） | `GET /settings/DEMO-SET-001`、`GET /settings/by-key?settingKey=…` | 真数据，17 字段 ✅ |
| 保存配置 | `POST /settings/save` | 真写入并回读校验通过（见 BT-01 同款标准）✅ |

---

---

# 域 5：`analytics`（用户端数据分析与生产报表）

> 产出人：se-verify-fix　日期：2026-10-10　实测环境：`core-app` :8098（自有实例）。
> 本域**读侧已经被前序同事诚实化过**（`AnalyticsOverview.tsx` 全文无示例值兜底、
> `ProductionReports.tsx` 列表侧有形状守卫），所以本轮**读侧没有新假数据**；
> 新发现的问题集中在**写侧（4 处假成功）**与**后端缺能力**。
> 按本轮纪律：**只出工单不改代码**，写侧修法已写明，等 team-lead 裁决。

**后端现有端点**（`AnalyticsController.java` 全文 80 行，已逐行核对）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/analytics`（page / size / status） | 指标快照分页 |
| GET | `/analytics/{id}` | 快照详情 |
| POST | `/analytics` | **新建指标快照**（不是报表） |
| PUT / DELETE | `/analytics/{id}` | 快照更新 / 删除 |
| GET | `/analytics/trend?metricCode=` | 单指标趋势 ✅ 真数据 |
| GET | `/analytics/overview?farmId=` | 指标 Map ✅ |
| GET | `/analytics/dashboard?farmId=` | **与 overview 同一实现** |
| GET | `/analytics/reports?metricCode=` | **指标快照分组，不是报表** |

前端 `api/analytics.ts` 共 11 个函数，其中 **6 个打在后端不存在的路径上**。

---

## BT-23　`yield-trend` / `task-trend` / `dimension` 三个端点不存在（404）

| 端点 | 实测 | 对照 |
| --- | --- | --- |
| `GET /analytics/yield-trend?startDate=…&endDate=…` | **404 资源不存在** | `/analytics/zzz-not-exist` → 404（完全一致） |
| `GET /analytics/task-trend?startDate=…&endDate=…` | **404 资源不存在** | 同上 |
| `GET /analytics/dimension?dimension=crop` | **404 资源不存在** | 同上 |

**成因**：三者都被 `@GetMapping("/{id}")` 吞掉，后端拿 "yield-trend" 当快照 id 去查 → 404。
（本项目的第 4、5、6 例同类坑，见 BT-12/13/15。）

**前端现状**：
- `getYieldTrend` / `getTaskTrend`（`api/analytics.ts:25-40`）**零调用方**——页面已改用
  `fetchMetricTrend('YIELD')`（`@/api/production-view`）打真的 `GET /analytics/trend?metricCode=`；
- `getAnalyticsDimension` 的 catch 吞成 `[]`，页面走空态并显示「后端暂无该数据源」
  （`AnalyticsOverview.tsx:217-221,265`），**不回落示例维度表** → **前端已诚实**。

→ **纯后端工单**。期望语义：产量趋势 / 任务完成趋势 / 多维度分析（作物 / 地块 / 月份）。

⚠️ 接入提醒：真的趋势端点 `GET /analytics/trend?metricCode=YIELD` 返回的是
`AnalyticsSnapshotEntity`（`snapshotId / farmId / bizDate / metricCode / metricValue …`），
**不是**前端声明的 `TrendPoint { date, value }`，接入前必须对齐字段名，否则又是一次静默写空。

---

## BT-24　报表订阅 4 个端点全部不存在（500），前端 3 处假成功 ⚠️ P0

**实测（同一 id 成对探测，`NOPE` 为不存在的 id）**：

| 端点 | 实测 |
| --- | --- |
| `GET /analytics/reports/subscriptions` | **500** `系统繁忙`（无 handler） |
| `POST /analytics/reports/subscribe` | **500** |
| `DELETE /analytics/reports/subscriptions/{id}` | **500** |

**全后端佐证**：`core-platform` 下 grep `subscribe` / `subscriptions` 只命中 RocketMQ 与 MQTT 的
`consumer.subscribe(...)`，**没有任何订阅实体、表或映射**——是能力缺失，不是路径写错。

**前端现状（`ProductionReports.tsx`，三处都违反"写操作验收标准"）**：

| 位置 | 现状 | 性质 |
| --- | --- | --- |
| `:531-543` 提交订阅 | POST 500 → `catch {}` 静默 → 生成 `LOCAL-SUB-<时间戳>` 写 localStorage → `message.success('订阅已保存')` | **假成功**：用户以为已订阅，实际只写进本机浏览器 localStorage，换设备 / 清缓存即消失，且永远不会推送。违反手册「本地暂存必须明示未同步服务端 + 常驻横幅」 |
| `:547-555` 取消订阅 | DELETE 500 → `catch {}` 忽略 → 本地移除 → `message.success('订阅已取消')` | **假成功** |
| `:343-357` 订阅列表 | GET 500 → `catch {}` → `[]` → 回落 localStorage 读取 | 把**本机 localStorage** 里的订阅当真实订阅展示 |

**建议修法（等裁决）**：订阅保存失败时要么如实报错，要么成功提示改为
「已保存在本浏览器，未同步服务端，不会真的推送」并常驻一条横幅；
列表侧区分「服务端订阅」与「本地订阅」两列 / 两个来源标记。

### ✅ team-lead 裁决（2026-10-10）：授权改前端，按手册"本地暂存"口径执行 — 已修

**已执行**（`ProductionReports.tsx`）：

| 位置 | 改法 |
| --- | --- |
| 提交订阅 | `synced` 标记区分：成功 → 「订阅已保存到服务端」；失败 → **warning**「订阅仅保存在本浏览器，不会推送，也未同步到服务端」，并把真实失败原因记进 `subscribeNote` |
| 取消订阅 | 成功 → 「订阅已取消（服务端已同步）」；失败 → 「已在本浏览器移除该订阅；服务端未同步（订阅端点不存在）」 |
| 订阅列表 | 卡片顶部**常驻** `Alert banner`：「以下订阅配置仅保存在本浏览器（localStorage），未同步服务端，不会真的推送」——不能只靠 3 秒就消失的 toast |

---

## BT-25　「生成报表」全程无真实数据 ⚠️ P0（本域最严重的一条）

| 项 | 内容 |
| --- | --- |
| 端点 | `POST /analytics/reports` → **500 系统繁忙（端点不存在）** |
| 前端函数 | `generateReport()`（`api/analytics.ts:60-66`） |
| 调用方 | `ProductionReports.tsx:462-475` |

**实测证据链**：

1. `POST /analytics/reports` → 500。后端**没有任何"生成报表"能力**；
   `/analytics` 上唯一的 POST 是 `create(@RequestBody AnalyticsSnapshotEntity)`，
   即**新建一条指标快照**，与报表无关。
2. 前端 `submitGenerate` 先在本地造一条 `draft` 塞进列表（`:448-460`），
   调用后端失败后 `catch { // 后端骨架阶段生成接口不可用，走本地模拟 }` **完全静默**；
3. 然后**无条件**执行 `window.setTimeout(…, 2500)`：把该行改成
   `status: 2`（已完成）、`fileSize: 156 * 1024`（**硬编码 156KB**）、`fileUrl: ''`，
   并 `message.success(`${draft.reportName} 生成完成`)`。

**性质**：用户点「生成报表」→ 后端没这个端点 → 页面 2.5 秒后弹「生成完成」，
列表多出一条"已完成 / 156KB"的报表 —— **从状态到文件大小到成功提示，没有一处是真实数据**。
这是本次战役定义里最典型的 fake-usable（比"回落示例数据"更严重：它是**写操作谎称成功**）。

**建议修法（等裁决）**：
- 后端失败 → `message.error('生成失败：' + 真实原因)`，**不得**标记完成；
- `fileSize` 不许硬编码常量（没有就显示「—」）；
- 本地生成物保留可以，但状态列必须显示「本地生成，未同步服务端」，不能显示"已完成"。

⚠️ **不要为了消掉 500 就改打 `POST /analytics`**：那是往指标快照表里插一条报表数据，
会把"假装成功"升级成"真的写脏了库"。

### ✅ team-lead 裁决（2026-10-10）：授权改代码 — 已修，附改前 / 改后成对实测

**已执行**：删掉 `catch {}` 静默、删掉无条件 `setTimeout(…, 2500)`、删掉硬编码
`fileSize: 156 * 1024`；以**服务端返回**为准，没有 `reportId` 就
`message.error('生成失败：报表生成服务未接入（后端 POST /analytics/reports 不存在），未生成任何文件')`。
⚠️ 那条"不许改打 `POST /analytics`"的警告已**写进代码注释**（常量
`GENERATE_UNAVAILABLE_HINT` 的 JSDoc），防止后人手滑。
弹窗顶部另加常驻 `Alert` 说明「点击确定会如实报错，不会产生任何报表文件」。

#### 成对实测（jsdom 挂载**真实页面** + 真实后端 :8098；改前用 `git show HEAD:` 的页面源码，
后端状态一致，唯一变量是前端代码）

| 观测点 | 改前（HEAD） | 改后 |
| --- | --- | --- |
| 初始表格行数 | 0 | 0 |
| 点击「生成报表 → 生产日报 → 确定」 | 成功 | 成功 |
| **0.2s 的 toast** | （无） | `生成失败：后端返回业务码 500（系统繁忙，请稍后重试）。报表生成服务未接入（后端 POST /analytics/reports 不存在），未生成任何文件` |
| **2.2s 的 toast** | `2026-10-04 生产日报（任务 / 采收 / 告警） 生成完成` | （无） |
| 点击后表格行数 | **1**（凭空多一行） | **0** |
| 首行文本 | `2026-10-04 生产日报…｜本地生成｜周期 2026-10-04｜15:41:02｜当前用户｜**156.0 KB**｜**已完成**｜导出 打印 删除` | `(无数据行)` |
| 出现「156.0KB」/「已完成」 | **true / true** | **false / false** |
| 出现「报表生成服务未接入」 | **false** | **true** |

> 采样方式：每 200ms 采一次 toast（antd message 是 portal，必须用 portal 作用域查，
> 否则查不到），共 3.2s。改前的成功 toast 出现在 2.2s，正好是那个 2500ms 定时器。

---

## BT-26　「导出报表」回落本地 CSV，且对编造出来的行同样生效

| 端点 | 实测 |
| --- | --- |
| `GET /analytics/reports/{id}/export` | **500**（端点不存在） |
| 成对对照 `GET /analytics/NOPE/export` | **500**（同样是两段路径、无 handler） |

**前端现状**（`ProductionReports.tsx:499-512`）：`exportReport` 失败 → `catch {}` 静默 →
用**前端内存里的对象** `buildReportCsv(report)` 拼 CSV → `message.success('已导出为 CSV 文件')`。

**问题**：导出内容不是服务端数据；对 BT-25 编造出来的行执行导出时，CSV 里是编造的报表名与周期，
而提示语「已导出为 CSV 文件」让它看起来像正常功能。

**建议修法**：失败时明确提示「后端导出不可用，以下为页面当前展示内容的本地导出」，
并在文件名上带 `本地` 标记；或直接报错不导出。

### ✅ team-lead 裁决（2026-10-10）：授权改代码 — 已修

**已执行**：
1. 示例行（BT-25 编造出来的行 / `DEMO-REPORT-*`）**禁止导出**，点导出直接
   `message.warning('这是页面内置的示例报表，不是真实数据，不可导出')`；
2. 回落本地 CSV 时先提示「后端导出不可用（真实原因），以下为本地生成的文件」，
   文件名带 `本地导出-` 前缀，成功提示改为「已导出 CSV（**本地生成，未同步服务端**）」；
3. **额外发现一并修掉**：`buildReportCsv` 里硬编码了 5 行"业务指标"
   （在种面积 2500 / 本月采收量 12850 / 任务完成率 92.8 / 质量合格率 98.6 / 投入产出比 3.42）。
   那是**编造的业务数据**，落到用户磁盘上就是一份看起来有内容的假报表，
   比在页面上显示更难被发现 → 已删除，CSV 只写报表自身真实字段，
   并明确写「后端未提供报表明细指标，本文件不含任何业务指标数值」。

---

## BT-27　删除报表无条件报成功（且删错实体）

**实测（同一 id 成对探测）**：

```
DELETE /analytics/reports/NOPE → 500（两段路径，无 handler → 端点不存在）
DELETE /analytics/NOPE         → 404（一段路径，进 @DeleteMapping("/{id}") → 端点存在、id 无效）
```

**前端现状**（`ProductionReports.tsx:640-647`）：

```ts
void deleteReport(record.reportId).catch(() => undefined)   // 失败完全静默
setExtraReports(prev => prev.filter(...))
message.success('报表已删除')                                // 无条件成功
```

服务端一个字节都没变，用户看到「报表已删除」。

**另一层语义错位**：即使把路径改对成 `DELETE /analytics/{id}`，它删的是
**指标快照**（`AnalyticsSnapshotService#delete` → `analyticsSnapshotMapper.deleteById`），
不是报表——会把"删报表"变成"删指标"，属于删错实体。

### ✅ team-lead 裁决（2026-10-10）：授权改代码 — 已修

**已执行**：
1. 删掉 `void deleteReport(...).catch(() => undefined)` 之后的无条件
   `message.success('报表已删除')`；
2. 删除必须**校验返回值**：后端返回成功但没有记录被删除 →
   `message.error('删除未生效：后端返回成功但没有记录被删除')`；失败 →
   `message.error('删除失败，未执行删除：<真实原因>')`；
3. **因端点删错实体，删除按钮对服务端行置灰**，`Tooltip` 写明原因：
   「删除暂不可用：后端 DELETE /analytics/{id} 删的是指标快照（错误实体，见 BT-27 / 治理项 G-01），
   端点修正前不开放」。
   仅**本页暂存**的行（示例行 / 本次会话生成行）可「移除」——那是纯前端状态操作，
   提示语如实说明「该行不在服务端」，不做成"看起来删了服务端数据"。

---

## BT-28　`DELETE` 不校验受影响行数，删不到也返回 success（后端 · 第二例 → 已升级为治理项）

> **已升级并挂到跨实体治理项 [G-01](#跨实体治理项-g-01deletebyid-丢弃受影响行数--删了个寂寞还报-success)**。
> team-lead 裁决：**不要逐实体补，统一在基础设施层解决**。本条保留作为 G-01 的第二例证据。

**实测**：`DELETE /analytics/NOPE`（NOPE 不存在）→ `{"code":0,"message":"success"}`，
但**一行也没删**。

**源码**：`AnalyticsSnapshotService.java:93-95`

```java
public void delete(String id) {
    analyticsSnapshotMapper.deleteById(id);   // MyBatis-Plus 的受影响行数被丢弃
}
```

**与 BT-22 同源**：`DELETE /settings/{不存在的 id}` 同样返回 success 且一行没删。
两处不同模块、同一成因 → 这是**通用 Service 模板的问题**，不是某个实体的 bug。

**期望语义**：受影响行数 = 0 时抛 NOT_FOUND（或返回受影响行数让调用方判断），
不要让调用方以为删成功了。

**建议**：作为**全库统一治理项**处理（所有 `deleteById` 都应当检查返回值），
而不是逐个实体补——否则每接一个新实体就多一处静默无操作。

---

## BT-29　`overview` 与 `dashboard` 是同一实现；`ProductionOverview` / `AnalyticsOverview` 类型零字段命中

**实测**（同一个 farmId）：

```
GET /analytics/overview?farmId=DEMO-FARM-001  → {"YIELD":86420,"PASS_RATE":96.8,"COST":1284.5,"metricCount":3}
GET /analytics/dashboard?farmId=DEMO-FARM-001 → 与上面**逐字节相同**
（不带 farmId 时 metricCount=6 → farmId 确实有过滤作用，但两个端点始终相同）
```

**源码**：`AnalyticsController.java:63-73`，`dashboard()` 直接 `return overview(farmId)`。

**类型比对**：

| 前端声明（`types/analytics.ts`） | 后端真值 | 结果 |
| --- | --- | --- |
| `ProductionOverview` 8 字段（farmCount / plotCount / plantingArea / runningPlanCount / pendingTaskCount / monthHarvestQty / passRate / activeDeviceCount） | 只有 `YIELD` / `PASS_RATE` / `COST` / `metricCount` 四个键 | **8 个字段名零命中**（`PASS_RATE` 与 `passRate` 也只是语义相近、取值口径未对齐） |
| `AnalyticsOverview`（overview / yieldTrend / taskTrend / inputRanking / cropDistribution） | 裸 `Map<String,Object>` | **零命中** |

**前端现状**：页面**没有**按这两个类型渲染——`AnalyticsOverview.tsx` 用 `buildOverview()` 读
`metricCode` 键、缺字段显示「—」，所以当前**不会显示错误数字**。
但类型声明仍是"契约撒谎"（与域 3 BT-16 同源），且：

⚠️ 页面把 `dashboard` 当主数据源、`overview` 当备用数据源
（`AnalyticsOverview.tsx:205-215`，注释写"两者都失败才标记不可用"）——
而两者是**同一个后端实现**，一个挂另一个必挂，**这个"备用数据源"是假的**。

**建议**：类型改为 `Record<string, number>`（或新增 `AnalyticsMetricMap`）；
备用数据源逻辑要么删掉，要么换成真有差异的端点。

---

## BT-30　`GET /analytics/reports` 静默忽略分页与筛选参数

**实测**：

```
/analytics/reports                                             → 6 条
/analytics/reports?reportType=1&period=2026-10&pageNum=1&pageSize=2 → 仍是 6 条
/analytics/reports?metricCode=YIELD                            → 2 条（只有 metricCode 生效）
```

**源码**：`reports(@RequestParam(required=false) String metricCode)`——其余入参一律丢弃。

**前端影响**：`listReports` 传了 `pageNum / pageSize / reportType / period`，
其中 `reportType` / `period` **后端完全不读**；分页之所以"看起来生效"，
是 `toPageResult` 在**前端**切的片。使用者会以为是服务端筛选。

**附带的契约错位**（与域 3 BT-16/17 同源）：该端点返回的是
`{ metricCode, metricName, metricValue, unit, bizDate }` 的**指标快照**，
不是报表——没有 `reportId` / `reportName` / `reportType` / `period`。
前端 `ProductionReports.tsx:373-402` 已用形状守卫挡住（不满足就空态 + 明示），**前端侧已诚实**。

**期望语义**：要么支持 `reportType` / 分页参数，要么在契约里写明"本端点仅按 metricCode 过滤"；
真正的"报表列表"能力应另开端点（域 3 的 `GET /admin/reports` 才是报表）。

---

## BT-33　列表接口报错时回落 16 条内置示例报表（前端侧 · 待裁决）

> **编号订正**：原登记为 BT-31，与 team-lead 另开的 CORS `allowedMethods` 缺 PATCH 工单撞号，
> 改号 **BT-33**。（BT-32 = team-lead 的 `OpsDataScreen.tsx` 告警级别键名兼容工单，与本条无关。）

### ✅ 裁决（team-lead / 用户，2026-10-10）：**删**，不是"保留但标注"

1. 删掉 16 条 `DEMO-REPORT-*` 内置示例，**连同 `usingFallback` 分支一起删**（没有生产者就别留机制）；
2. `isError` / 空结果走 `<Empty>` + 明示真实原因；
3. 生成按钮保留，点击仍如实报错（BT-25 已做，保持）；
4. `buildReportCsv` 的硬编码指标保持删除状态（BT-26）。

理由：`/admin/reports` 也不是答案（见下"前置核查"），"改端点"这条路不通，
诚实承认能力缺失才是对的。补用户端报表端点 + 真导出（BT-18）另开后端工单排队。

**已执行**（commit `fcac21fa`）：
- 删除 `DEMO_REPORTS` / `usingFallback` / `DEMO_REPORT_ID_PREFIX` / `isDemoReport`
  （连带删掉"示例行禁导出 / 禁打印"两个已无生产者的分支），
  `isPageOnlyReport` 简化为 `isSessionReport`；
- `rows.length === 0` 时走 `<Empty>`，`emptyReason` 分三种：
  接口失败 → 「报表列表接口请求失败：…」；返的是指标快照 → 「后端暂未提供用户端报表能力：
  …返回 N 条指标快照…」；确实没有 → 「服务端当前没有任何报表记录」。
  表格 `locale.emptyText` 同步带上原因。

**成对实测**（jsdom 真实页面 + 真实后端 :8095；改前用 `3c923cf9` 的页面源码，唯一变量是前端代码）：

| 观测点 | 改前 | 改后 |
| --- | --- | --- |
| **场景1 后端挂了** 表格行数 | **10** | **0** |
| 首行文本 | `2026-06-03 生产日报｜日报｜**示例数据**｜周期 2026-06-03｜08:00:00｜系统自动｜**128.0 KB**｜**已完成**｜导出 打印 移除` | `(无数据行)` |
| 出现「示例数据」 | **true** | **false** |
| 出现「暂无报表」 | false | **true** |
| 出现「请求失败」 | false | **true** |
| **场景2 后端正常** 表格行数 | 0（仅有一条 Alert） | 0 |
| 出现「暂未提供用户端报表能力」 | false | **true** |

两场景下改后「示例数据」/「DEMO-REPORT-」均为 **false**。`tsc --noEmit -p tsconfig.json` 退出 0。

**发现经过**：BT-25 改完后做成对实测时，后端 :8098 一度挂掉，页面 `listReports` 报错 →
`usingFallback` 为真 → 列表里出现 **16 条 `DEMO-REPORT-*` 内置示例报表**（每页 10 条）。
这与本轮战役目标（消除"回落原型/示例数据"）直接冲突，但**不在已授权的 BT-24~BT-27 范围内**，
故本轮**未删除**，只做止血 + 登记，等裁决。

**源码**：`ProductionReports.tsx` 的 `DEMO_REPORTS`（`Array.from({ length: 16 }, …)`），
在 `usingFallback` 分支与 `extraReports` 一起展示。

**本轮已做的止血（不删数据，但把话说清楚）**：
1. 每一行加红色 `示例数据` Tag（原来**逐行没有任何标记**，只有一条空态说明）；
2. 示例行**禁止导出**（BT-26）、**禁止打印**——不让假数据落到用户磁盘 / 纸上；
3. 原来的空态文案「当前展示示例报表（生成 / 订阅 / 导出 / 打印均可用）」是**假的**
   （BT-25/26 之后生成会报错、导出被禁）→ 改成常驻 `Alert`：
   「以下为内置示例报表，不是真实数据……示例行不可导出、不可打印；「生成报表」当前也会如实报错」；
4. 顶部计数在回落时显示「共 N 份报表**（示例）**」；
5. 示例行可「移除」（纯前端），提示如实说明"示例数据本就不在服务端，刷新页面会重新出现"。

**待裁决**：`DEMO_REPORTS` 是否整个删除（与 `settings` / `admin/reports` 域"不回落示例数据"
的既定口径一致）？删掉后 `usingFallback` 分支即为空态 + 原因说明。

### 前置核查：这个页面到底该打哪个端点？（team-lead 要求只读核查，结论如下）

#### 1. 调用链（现状）

```
ProductionReports.tsx（pages/user/analytics/，路由 /production/analytics/reports，**用户端**）
  → listReports()                       @/api/analytics.ts:52
    → http.get('/analytics/reports', params)
      → GET /api/v1/production/analytics/reports
```

#### 2. 两个候选端点的实测形状（均 :8098 实测，本轮）

**A. `GET /analytics/reports`（当前在打的那个）**

```json
{"code":0,"message":"success","data":[
  {"metricCode":"YIELD","metricName":"累计产量","metricValue":86420.0000,"unit":"kg","bizDate":"2026-10-09"},
  {"metricCode":"PASS_RATE","metricName":"检测合格率","metricValue":96.8000,"unit":"%","bizDate":"2026-10-09"},
  {"metricCode":"…"}
]}
```

存在性对照：`GET /analytics/zzz-not-exist` → `code=404 资源不存在`（进 `@GetMapping("/{id}")`）。
**源码铁证**（`AnalyticsSnapshotService#reports`，:124-141）：它 `selectList` 的是
**`AnalyticsSnapshotEntity`（表 `prod_analytics_snapshot`）**，然后手工 `row.put("metricCode"/"metricName"/"metricValue"/"unit"/"bizDate")`。
→ **这个端点从头到尾没碰过报表表，它叫 reports 但返回的是指标快照。**

**B. `GET /admin/reports?page=1&size=2`**

```json
{"code":0,"message":"success","data":{"records":[
 {"reportId":"DEMO-RPT-002","reportType":"GOV","reportName":"2026年度农产品质量追溯监管年报",
  "farmId":null,"bizDateFrom":"2026-01-01","bizDateTo":"2026-12-31",
  "generatorId":"SUPER_ADMIN","fileUrl":null,"generatedAt":null,"status":"PENDING"}
]}}
```

存在性对照：`GET /admin/reports/NOPE-NOPE` → `code=404 资源不存在`。
实体：`ReportTaskEntity` → **表 `prod_report_task`**，这才是真的报表实体。

#### 3. 结论：**是契约错位，不是"数据不足"** —— 但**不是"改打 B"就能了事**

页面把**指标快照列表**当**报表列表**渲染。16 条内置示例正是在掩盖这个错位——
所以"删示例"和"留示例"单独讨论都不成立，得先定"这个页面该展示什么"。

⚠️ 但 B 也不是现成答案，四处不通：

| 维度 | 页面口径 | `/admin/reports` 实际 | 是否通 |
| --- | --- | --- | --- |
| 报表类型词表 | 日报 / 周报 / 月报 / 季报 / 年报 + 专题（1-5） | `GOV` / `BIZ` / `QUALITY` | ❌ 词表不通（与 BT-32 同类问题） |
| 生成人 | 当前用户 | `generatorId = "SUPER_ADMIN"` | ❌ 是运营端造的监管报表，不是农场自己的报表 |
| 农场范围 | 当前 farmId | `page()` **不接受 farmId**；`farmId` 可为 `null` | ❌ 无农场维度 |
| 数据隔离 | 只看到自己农场的 | `TenantLineInnerInterceptor` 隔离的是 **`market_id`（市场）**，不是农场 / 租户 | ❌ 会把整个市场所有农场的报表列出来 |

#### 4. 用户端页面打运营端 `/admin/reports` 是否可行？

- **技术上能通**：`JwtAuthFilter` 只校验 token 有效性（无 token → 401），**不按路径 / 角色鉴权**；
  `admin` 包内没有任何 `@PreAuthorize` / `hasRole`；`WebConfig` 里只有 CORS，没有安全规则。
  → 任意有效 token 都能调通 `/admin/**`。
- **但架构上零先例**：全仓 grep，`@/api/admin/*` **只被 `pages/admin/**` 引用**，
  `pages/user/**` 里没有任何一处打 `/admin/` 端点。
- **数据范围会越界**：见上表第 4 行，会把全市场的监管报表列给用户端农场。

**→ 不建议用户端页面直接改打 `/admin/reports`。**

#### 5. 给裁决的三个选项（按推荐度排序）

1. **后端补用户端报表端点**（推荐）：`prod_report_task` 按 `farmId` 过滤 + 报表类型词表
   与用户端对齐（或新增 farm 级报表表）。页面改打新端点 → 示例数据自然可删。
2. **先定页面定位**：如果产品上这个页面就该展示"运营下发的监管年报"，那它不是用户端页面，
   应挪到运营端，并接受 `GOV/BIZ/QUALITY` 词表 —— 这是产品裁决，不是前端能定的。
3. **维持现状 + 删示例**：承认"后端没有用户端报表能力"，页面走"未接入"空态。
   这一条无论选 1 还是 2 都该做（示例数据本就不该留），与端点选择**不冲突**，可先行。

---

## 附：本域已验证有真数据的端点

| 端点 | 实测 |
| --- | --- |
| `GET /analytics/overview?farmId=` | code=0，真指标 Map（YIELD 86420 / PASS_RATE 96.8 / COST 1284.5 / metricCount）✅ |
| `GET /analytics/dashboard?farmId=` | 同上（与 overview 同源）✅ |
| `GET /analytics/trend?metricCode=YIELD` | code=0，真快照序列 ✅ |
| `GET /analytics?page=1&size=3` | code=0，PageResult 真数据 ✅ |
| `GET /analytics/reports` | code=0，6 条指标快照（**不是报表**，见 BT-30）⚠️ |

**读侧已诚实化，本轮不重复开工单**：
- `AnalyticsOverview.tsx` 头部注释明确"没有的指标一律显示「—」、绝不使用本地示例值回填"，
  作物分布 / 投入排行由地块、投入品使用记录两个真接口聚合，无数据显示「暂无数据」；
- `ProductionReports.tsx` 列表侧有形状守卫，接口通了但返的不是报表时走空态 + 明示，
  **不**回落示例报表；
- ⚠️ 但**接口报错（isError）**时仍会回落 16 条 `DEMO-REPORT-*` 内置示例报表——
  这一条已登记为 **BT-33**（编号订正：原写作 BT-31，与 team-lead 另开的 CORS PATCH
  工单撞号，故改号；BT-32 是 team-lead 的 `OpsDataScreen.tsx` 枚举键名兼容工单，不归本条）。
  已做的止血：逐行标「示例数据」+ 禁导出 / 禁打印 + 修正假文案。
  **是否整个删除，取决于 BT-33 的裁决结论**（见 BT-33，已裁决删除并执行）。

---

# 域：`api/admin/alerts`（运营端异常告警）

> 扫描人：se-verify-fix　日期：2026-10-10　性质：**只读调研**（只做 GET 实测 +
> 后端源码对照 + 前端静态审计），**不改任何业务代码**。
> 后端 `AdminAlertController`（`core-platform/mod-produce/.../internal/admin/`）的全部映射：
> `GET /rules`、`GET ""`、`GET /stats`、`POST /{alertId}/dispatch`、
> `POST /rules/{ruleId}/toggle`、`GET /emergency`、`GET /review`——**一共 7 个，没有第八个**。

## 本域已验证有真数据的端点

| 端点 | 实测 |
| --- | --- |
| `GET /admin/alerts` | code=0，`PageResult<AlertVO>` 真数据（DEMO-ALERT-005 等）✅ |
| `GET /admin/alerts/stats` | code=0，`{INFO:"6",WARN:"7",CRITICAL:"4",total:"20",handled:"8",handleRate:"40"}` ✅ |
| `GET /admin/alerts/rules` | code=0，`PageResult<AlertRuleEntity>` 真数据 ✅ |
| `GET /admin/alerts/review` | code=0，`PageResult<AlertVO>` 真数据 ✅ |
| `GET /admin/alerts/emergency` | code=0，但 `data: []`，且是**告警**不是预案（见 BT-38）⚠️ |

## BT-34　`closeAlert` 端点不存在 →「告警处置 / 关闭」100% 失败 ⚠️ P1

**前端**：`api/admin/alerts.ts:28` `PATCH /admin/alerts/{alertId}/close`。
**后端**：控制器里**没有任何 `/close` 映射**（7 个映射见上，无 close）。

**真实调用方（3 处，都有调用）**：
- `pages/admin/alerts/AdminAlertCenter.tsx:232`
- `pages/admin/dashboard/OpsDashboard.tsx:288`
- `pages/admin/monitor/MonitorCenter.tsx:304`

**性质**：不是"假成功"——三处都在 `onError` 里如实报错，使用者看到的是失败。
问题是**这个能力后端压根没有**，所以"处置告警"这个核心动作**永远点不动**。
按判定规则属"端点不存在 + 有调用方" → 后端工单。

**期望语义**：提供关闭 / 处置告警的端点（PATCH 或 POST 由后端定，前端跟随），
落处置措施与说明，并回传处置后的告警对象。

## BT-35　`dispatchAlert` 用 PATCH，后端是 POST → 方法不匹配（端点**存在**）⚠️

| 项 | 前端 | 后端 |
| --- | --- | --- |
| 方法 | **`PATCH`** `/admin/alerts/{alertId}/dispatch` | **`POST`** `/admin/alerts/{alertId}/dispatch` |
| 返回 | `Promise<boolean>` | `ApiResponse<AlertVO>` |

**实测**：`GET /admin/alerts/DEMO-ALERT-005` → 500（见 BT-36，详情端点不存在），
因此无法用"真 id 走一遍"验证；但源码层面方法确实不一致。

**零调用方**：全仓 grep `dispatchAlert` 只命中声明本身。
按 team-lead 裁决口径（端点存在 + 有真数据 → 修契约不删；只有端点不存在 + 零调用方才删）：
端点**存在**，故**应改为 POST 并把返回类型改成 `AlertVO`**，不删——
留着一个方法写错的声明会被下一个人复制粘贴走。

**另一半也错**：后端返回 `AlertVO`，前端声明 `boolean`——
调用方拿 boolean 判断成功与否，而实际拿到的是一个对象（恒为真值），
等于"永远判断成成功"。这是**类型撒谎 + 潜在的假成功**，即使现在没人调用也要修。

## BT-36　`getAdminAlert` 端点不存在（用真 id 与假 id 成对验证）· 零调用方 → 建议删

**成对实测**（core-app :8095）：

```
GET /admin/alerts/DEMO-ALERT-005   → code=500   ← **真 id 也 500**
GET /admin/alerts/ALERT-NOPE       → code=500
对照 GET /admin/tenants/NOPE       → code=404   ← 已知有 /{id} handler 的路径长这样
```

**判读**：真 id 与假 id 都是 500，而有 `/{id}` handler 的对照路径是 404 →
**`GET /admin/alerts/{id}` 没有任何 handler**（控制器里也没有 `@GetMapping("/{id}")`）。
注意这次的对照形式比"同一个 id 打两条路径"更强：**真 id 都取不到，就不是"id 无效"，是端点不存在**。

**零调用方** → 按规则（端点不存在 + 零调用方）建议**删除**该声明。待裁决。

## BT-37　应急预案 CRUD 四个端点全不存在；`GET /emergency` 也不是预案库

**前端声明**（`api/admin/alerts.ts`）：
`GET /emergency/{planId}`、`POST /emergency`、`PUT /emergency/{planId}`、`DELETE /emergency/{planId}`。
**后端**：这四个**一个都没有**（映射表见域首）。

**现状**：`pages/admin/alerts/EmergencyPlan.tsx` 的写操作在 catch 里
`message.warning('预案已保存到本地示例数据（演示模式，未写入服务端，刷新后失效）')`——
**写操作是诚实的**（明说没写进服务端），并有 `DemoDataAlert` 常驻横幅。所以不是"假成功"。
问题是**预案库能力后端完全没有**，页面只能靠本地 mock 撑着。

⚠️ **另有一条 read 侧问题**：`GET /admin/alerts/emergency` 的后端实现是
`emergency(@RequestParam(defaultValue="60") int minutes)`，返回 `List<AlertVO>`——
它是**「近 N 分钟的紧急告警」**，不是「应急预案库」。
前端却按 `PageResult<EmergencyPlan>` 取 `pageNum / pageSize / alertType / status`，
后端**只认 `minutes`**，其余入参全部丢弃（与 BT-30 同类的"静默忽略入参"）。
实测 `GET /admin/alerts/emergency` → `data: []`。

## BT-38　`EmergencyPlan.tsx` 在「返回空数组」时也回落 mock 数据（read 侧兜底）⚠️

**源码**：`EmergencyPlan.tsx:359-390`

```ts
if (page && Array.isArray(page.list) && page.list.length > 0) { return {rows: …, demo: false} }
} catch { /* 后端不可用时降级为演示数据 */ }
return { rows: mockPlanStore, demo: true }      // ← 空列表**也**走这里
```

**问题**：`GET /admin/alerts/emergency` 当前就返回 `[]`，于是页面**稳定地**展示 mock 预案库。
虽然挂了 `DemoDataAlert` 横幅，但列表里躺着一套服务端并不存在的预案，
且映射时**硬编码了字段**：`region: '全域'`、`creatorName: '管理员A'`、`drillDate: item.updatedAt.slice(0,10)`、`steps: []`。

**与 BT-33 同类**：BT-33 已裁决"删示例、走诚实空态"，本条口径应当一致。
**待裁决**：是否同样删除 `mockPlanStore` 回落、改走空态 + 原因说明。
（本轮按纪律只登记，未改代码。）

## BT-39　灾害复盘 `POST / PUT / DELETE /review` 三个写端点不存在

**前端声明**：`POST /admin/alerts/review`、`PUT /admin/alerts/review/{reviewId}`、
`DELETE /admin/alerts/review/{reviewId}`。**后端**：控制器里只有 `GET /review`，三个写端点都没有。

**现状**：`DisasterReview.tsx` 三个 mutation 都在 catch 里
`message.error('…失败：…')`，**写操作诚实**（不谎报成功）。

**契约附带项**：`GET /admin/alerts/review` 返回的是 `PageResult<AlertVO>`（**告警**），
而前端声明 `PageResult<DisasterReview>`（灾害复盘）。页面已自己
`(page?.list ?? []) as unknown as AlertReviewItem[]` 强转了，等于承认"这就是告警"——
**类型声明仍是撒谎**，建议把 `listDisasterReviews` 的返回类型直接改成告警复盘类型。

---

# 域：`api/admin/approvals`（运营端审批管理）

> 扫描人：se-verify-fix　日期：2026-10-10　性质：**只读调研**（GET 实测 +
> 后端源码对照 + 前端静态审计），**不改任何业务代码**。
> 后端 `AdminApprovalController` 全部映射：`GET ""`、`GET /{id}`、`POST ""`、`PUT /{id}`、
> `DELETE /{id}`、`POST /{approvalId}/approve`、`POST /{approvalId}/reject`、
> `GET /pending`、`GET /history`、`GET /config`——**共 10 个**。

## 本域已验证有真数据的端点

| 端点 | 实测 |
| --- | --- |
| `GET /admin/approvals` | code=0，`PageResult<ApprovalEntity>`（DEMO-APR-002 / bizType=RECALL）✅ |
| `GET /admin/approvals/history` | code=0，PageResult 真数据 ✅ |
| `GET /admin/approvals/pending` | code=0，**裸数组** `List<ApprovalEntity>` 真数据 ✅（⚠️ 前端**没有**声明这个端点） |
| `GET /admin/approvals/config` | code=0，但只有 `[{bizType:"CERT",approveLevel:2},{bizType:"RECALL",approveLevel:1},{bizType:"QUOTA",approveLevel:1}]` ⚠️（见 BT-43） |
| `GET /admin/approvals/{id}` | `APPROVAL-NOPE` → **404**（有 handler，id 无效）✅ |

## BT-40　「审批通过 / 驳回」失败也 `message.success` ⚠️ **P0（本轮第二例写操作谎称成功）**

**源码**：`pages/admin/approvals/ApprovalPending.tsx:356-369`

```ts
const successText = action === 'approve' ? '审批已通过' : '审批已驳回'
try {
  …await approveApproval(ids[0], { remark }) / batchApprove(…) / rejectApproval(…)
  message.success(successText)
} catch {
  message.success(`${successText}（演示模式，仅本地更新）`)   // ← 失败也是 success
}
mockApprovalStore = …                                          // ← 本地改状态
setRows((prev) => prev.filter((item) => !ids.includes(item.approvalId)))  // ← 行从列表消失
```

**性质**：跟 BT-25 同一类，但**危害更大**——
- 失败分支用的是 `message.success`，只是加了个"（演示模式，仅本地更新）"后缀；
  绿色成功提示里写着「审批已通过」，服务端一条都没改；
- 紧接着还在本地把该行**从待审列表里移除**，页面看起来"审批完了"，无一点异常痕迹；
- **审批是有业务效力的动作**（召回 / 认证 / 配额），"已通过"但服务端未通过，
  比报表生成假成功更容易导致真实损失。

**旁证：同一域里两种写法不一致，Pending 页是漏网之鱼**——
`ApprovalConfig.tsx` 的保存 / 启停 / 删除，catch 里用的都是
`message.warning('…（演示模式，仅本地更新，未写入服务端，刷新后失效）')`（**诚实**）；
`ApprovalPending.tsx` 用的是 `message.success`。

**建议修法（待裁决后执行）**：catch 分支改 `message.error` + 真实失败原因；
「仅本地更新」只允许用 `warning` 且必须写明"服务端未变更、刷新后失效"。

## BT-41　`approveApproval` / `rejectApproval` **三重不匹配**，必然失败 ⚠️ P1

| 维度 | 前端（`api/admin/approvals.ts:35-48`） | 后端（`AdminApprovalController:59-73`） |
| --- | --- | --- |
| HTTP 方法 | **`PATCH`** `/{id}/approve` | **`POST`** `/{approvalId}/approve` |
| 参数形态 | **请求体** `{ remark }` | **`@RequestParam`** `approverId` / `opinion`（**不读 body**） |
| 参数名 | `remark` | `opinion` |
| 返回类型 | `Promise<boolean>` | `ApiResponse<ApprovalEntity>` |

也就是说就算把 PATCH 改成 POST，`{remark}` 仍然绑不上（后端要 query 上的 `opinion`）。
**当前这两个调用必然失败**——这正是 BT-40 那条"失败也报成功"必然被触发的原因，两条要一起看。

**类型撒谎**：后端返回 `ApprovalEntity`，前端声明 `boolean`。
调用方若用 `if (await approveApproval(...))` 判断，拿到的是一个**对象**（恒为真值），
**永远判断成成功**。与 BT-35（`dispatchAlert`）是同一个坑。

**真实调用方**：`ApprovalPending.tsx:360/362/365`、`OpsDashboard.tsx:276-277`。

## BT-42　`batchApprove` 端点不存在

前端 `PATCH /admin/approvals/batch-approve`。后端 10 个映射里**没有** `batch-approve`。
实测 `GET /admin/approvals/batch-approve` → **404**（被 `@GetMapping("/{id}")` 当 id 吞了），
说明也没有 GET handler；`PATCH` 更是无 handler。
调用方：`ApprovalPending.tsx:362`（多选审批时走这条）→ 多选审批**必然失败**。

## BT-43　审批流程配置：4 个 CRUD 端点全不存在；`GET /config` 返回的也不是 `ApprovalFlowConfig`

**前端声明**：`GET /config/{flowId}`、`POST /config`、`PUT /config/{flowId}`、`DELETE /config/{flowId}`。
**后端**：只有 `GET /config`，另外四个**一个都没有**（实测 `GET /config/NOPE` → 500，无 handler）。

**契约错位**：`GET /admin/approvals/config` 实测返回
`[{"bizType":"CERT","approveLevel":2},{"bizType":"RECALL","approveLevel":1},{"bizType":"QUOTA","approveLevel":1}]`
——只有**两个字段**，是「每种业务类型的审批级数」，**不是流程台账**。
没有 `flowId` / `flowName` / `nodes` / `conditionRoutes` / `escalations`。

**前端现状（诚实，值得保留）**：`ApprovalConfig.tsx:288-300` 做了形状校验，
注释明确"接口通了但只给骨架，仍然算没有真数据，保持 `demo: true`，
让 `DemoDataAlert` 横幅继续提示——否则三条骨架被标成凭空的「租户注册」，比降级更骗人"。
**这段是对的，不要改成"有数据就去掉横幅"。**

## BT-44　`listApprovals` / `listApprovalHistory` 静默忽略大部分入参

| 端点 | 前端传 | 后端实际接受 |
| --- | --- | --- |
| `GET /admin/approvals` | `pageNum/pageSize/approvalType/status/tenantId/applicantName` | `page` / `size` / **`keyword`** / `status`（且 `status` 是 **String**） |
| `GET /admin/approvals/history` | 同上 | **只有** `page` / `size` |

后果：`approvalType` / `tenantId` / `applicantName` **全部被丢弃**，
`history` 连 `status` 都不认。使用者按类型 / 申请人筛选会看到"筛了但结果没变"。
与 BT-30 同类（"静默忽略入参"）。

⚠️ 另：后端 `page()` 的 `status` 是 `String`，前端 `ApprovalListParams.status` 是 `number`——
`status=1` 传过去被当字符串比较，属于**类型口径不一致**，需要实测确认是否真能筛。

## BT-45　`OpsDashboard` 的审批 mutation 只有 `onSuccess`，失败**完全静默**

`OpsDashboard.tsx:273-281` 的 `approvalMutation` 只定义了 `onSuccess`（弹「审批已通过」），
全文件 **grep `onError` 零命中**。结合 BT-41（这两个端点必然失败）的结果是：
使用者点「通过」→ **什么提示都没有** → 弹窗不关（`setActiveApproval(null)` 在 onSuccess 里）
→ 只能反复点。**不是谎报成功，但是"静默失败"**，同样违反写操作验收标准。

**建议**：补 `onError` 如实报错（或至少 `message.error`），失败时不要把弹窗留在半开状态。

## 附：本域诚实的地方（不要改坏）

- `ApprovalHistory.tsx`：注释明确"不再 try/catch 兜底到演示数据，请求失败时让 react-query 进入 isError"，
  空态文案写明"后端 /admin/approvals/history 未返回数据……页面不会用示例数据填充"。✅
- `ApprovalConfig.tsx`：写操作失败用 `message.warning` 明说未写入服务端；
  形状校验不让骨架数据冒充真流程。✅

---
