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

# 域：`api/admin/farms`（运营端农场监管）

> 扫描人：se-verify-fix　日期：2026-10-10　性质：**只读调研**（GET 实测 +
> 后端源码对照 + 前端静态审计），**不改任何业务代码**。
> 后端 `AdminFarmController` 全部映射（9 个）：`GET ""`、`GET /{farmId}/compliance`、
> `GET /cert-expiring`、`PUT /{farmId}/status`、`GET /map`、`GET /compliance`、
> `GET /compliance/checks`、`POST /compliance`、`PUT /compliance/{checkId}`。

**总体印象：这个域已经被诚实化过一轮**（`FarmSupervisionList` / `FarmSupervisionDetail` /
`ComplianceCheck` 三页里到处是"原实现会用示例农场顶替，此处不再…"的注释），
**没有发现写操作谎报成功**。下面的条目主要是"端点不存在 + 零调用方的死声明"和两处残留示例口径。

## 本域已验证有真数据的端点

| 端点 | 实测 |
| --- | --- |
| `GET /admin/farms` | code=0，`PageResult<FarmInfoEntity>`（DEMO-FARM-001 等）✅ |
| `GET /admin/farms/map` | code=0，`[{farmId, farmName, province, city, district, areaTotal}]` ✅（⚠️ 确实**不含经纬度**，与前端注释一致） |
| `GET /admin/farms/compliance/checks` | code=0，`PageResult<FarmComplianceCheckEntity>`（DEMO-CHK-004）✅ |
| `GET /admin/farms/compliance` | code=0，List<Map> 真数据 ⚠️（字段类型混用，见 BT-49） |
| `GET /admin/farms/{farmId}/compliance` | code=0，Map 真数据 ⚠️（同上） |
| `GET /admin/farms/cert-expiring` | code=0，但 `data: []`（端点在、无数据） |
| `GET /admin/farms/{farmId}` | **真 id `DEMO-FARM-001` 也 500** ❌（见 BT-46） |

✅ **值得记一笔"没编造，别改坏"**：`/admin/farms/map` 不含经纬度，而
`FarmGisMap.tsx` 里 **grep `longitude` / `latitude` / `Math.random` 全部零命中**
——GIS 页**没有**拿随机数伪造坐标。这是对的，保持。

## BT-46　`GET / PUT / DELETE /admin/farms/{farmId}` 三个端点都不存在 · 零调用方 → 建议删

**成对实测**（比"同 id 两条路径"更直接：**真 id 与假 id 都打同一路径**，再拿同前缀下有 handler 的路径做对照）：

```
GET /admin/farms/DEMO-FARM-001          → 500   ← 真 id 也是 500
GET /admin/farms/FARM-NOPE              → 500
对照 GET /admin/farms/DEMO-FARM-001/compliance → 200  ← 同前缀、有 handler 的路径长这样
```

后端 9 个映射里也没有 `GET /{farmId}` / `PUT /{farmId}` / `DELETE /{farmId}`。

**受影响的前端声明**（`api/admin/farms.ts`，**全部零外部引用**）：
`getSupervisedFarm`（GET）、`updateSupervisedFarm`（PUT）、`deleteSupervisedFarm`（DELETE）。

按判定规则（**端点不存在 + 零调用方**）→ **建议删除**这三个声明。待裁决。

## BT-47　`updateSupervisedFarmStatus` 用 PATCH，后端是 PUT；且与正确实现重复

| 函数 | 前端写法 | 后端 |
| --- | --- | --- |
| `updateSupervisedFarmStatus` | **`PATCH`** `/{farmId}/status`，body `{status}` | `PUT /{farmId}/status?enable=true\|false` |
| `toggleSupervisedFarmStatus` | **`PUT`** `/{farmId}/status?enable=` | ✅ 正确 |

两个函数打同一个路径，一个对一个错。`updateSupervisedFarmStatus` **零外部引用**，
`toggleSupervisedFarmStatus` 也零外部引用（本域监管停用/恢复目前没接上页面）。
错的那个建议删（端点形式与后端不符 + 无调用方 + 有正确的孪生实现）。待裁决。

## BT-48　`deleteComplianceCheck` 端点不存在 · 零调用方 → 建议删

前端 `DELETE /admin/farms/compliance/{checkId}`；后端只有
`POST /compliance` 与 `PUT /compliance/{checkId}`，**没有 DELETE**。零外部引用 → 建议删。待裁决。

## BT-49　合规画像接口**同对象内字符串与数字混用** → 类型撒谎 ⚠️

**实测**（`GET /admin/farms/compliance`，两条端点形状一致）：

```json
{"farmId":"DEMO-FARM-001","farmName":"…","plotCount":"5","certCount":2,
 "certExpiring":"0","certExpired":"0","complianceLevel":"OK"}
```

| 字段 | 实际类型 | 前端 `FarmComplianceProfile` 声明 |
| --- | --- | --- |
| `plotCount` | **字符串** `"5"` | `number` ❌ |
| `certCount` | 数字 `2` | `number` ✅ |
| `certExpiring` | **字符串** `"0"` | `number` ❌ |
| `certExpired` | **字符串** `"0"` | `number` ❌ |

**同一个对象里字符串和数字并存**——与 `#76 修正 dashboard 计数类型混用` 是同一类问题，
属于后端 `Map<String,Object>` 组装时没做类型收敛。

⚠️ **为什么现在没炸**：`FarmSupervisionDetail.tsx:319-324` 算合规率时用的是
`(certCount - certExpired) / certCount`，JS 减法会隐式把 `"0"` 转数字，
所以**恰好不出错**。但这是运气不是契约——一旦后端把 `certCount` 也拼成字符串，
`("2" - "0") / "2"` 仍侥幸成立，而任何 `+` 拼接或 `===` 比较都会立刻翻车。

**建议**：后端统一为数字（或前端在 api 层做一次 `Number()` 收敛）。

## BT-50　`FarmSupervisionDetail` 合规率趋势图：6 个点里 **5 个是编造的** ⚠️ 待裁决

**源码**：`FarmSupervisionDetail.tsx:172-193` `buildComplianceSeries()`

```ts
const offset = ((seedValue >> (i * 2)) % 7) - 3          // 由 farmId 哈希出来的偏移
values.push(Math.min(100, Math.max(0, currentRate + offset)))   // 前 5 点
values.push(currentRate)                                  // 只有第 6 点是真的
```

以「当前合规率」为末点、按 farmId 的稳定哈希**反推**出前 5 个月的值，画出一条"近 6 个月合规率趋势"。
**只有末点是真实数据，其余 5 点是编造的**（哈希保证多次渲染不跳变，反而更像真数据）。

**当前的提示方式**：只在卡片右上角挂了一个 `Text type="secondary"` + Tooltip
「历史点位为示例口径」——**一条六点折线里五个点不是真的，用小字标注不够**，
读图的人看的是曲线形状（"合规率在回升/恶化"），而形状完全是哈希决定的。

**与 BT-33 同类**：示例数据不该靠标注留在图上。
**建议**（待裁决）：后端没有时间序列就不画趋势图，改为只显示「当前合规率」这一个真值。

## 附：本域诚实的地方（不要改坏）

- `FarmSupervisionList.tsx`：`mapFarmToRow` 注释明确"任何情况下表格里都不会再出现示例农场"；
  统计卡片注释"不再显示原型示例数字（原 3,542 / 2,980 / 412 / 150 均为示例口径）"。
- `FarmSupervisionDetail.tsx`：查不到农场时显式「未找到」，注释写明"绝不拿原型示例档案冒充
  （可能被误当作真实档案用于下发整改与风险判定）"；产量/完成率原示例值 580 吨 / 92.5% 已撤。
- `ComplianceCheck.tsx`：写操作失败用 `message.warning('…已登记到本地，但未写入服务端')`；
  下拉框"不再用示例农场填充"。
- `api/admin/farms.ts` 的 `ComplianceWriteResult`：把失败拆成 `rejected`（服务端明确拒绝，**不降级**）
  与 `unreachable`（服务端故障，才可离线兜底）——**这个口径是对的，值得作为其他域的模板**。

---

# 域：`api/admin/monitor`（运营端生产监控）

> 扫描人：se-verify-fix　日期：2026-10-10　性质：**只读调研**（GET 实测 +
> 后端源码对照 + 前端静态审计），**不改任何业务代码**。
> 后端 `AdminMonitorController` 全部映射（7 个，**全是 GET**）：
> `GET /overview`、`GET /devices`、`GET /alerts`、`GET /readings/latest`、
> `GET /tasks`、`GET /iot`、`GET /inputs`——**一个写端点都没有**。

**写操作诚实性**：本域两个真实写操作（`IotMonitor.tsx` 重启设备、`TaskMonitor.tsx` 催办）
都写了 `onError` 且注释明确"失败就是失败：不能把「没下发成功」说成「已登记」"。
**没有谎报成功**。但两个端点后端都不存在 → 功能 100% 死（见 BT-55）。

## 本域已验证有真数据的端点

| 端点 | 实测 |
| --- | --- |
| `GET /admin/monitor/overview` | code=0，`{deviceTotal:"12",deviceOnline:"10",onlineRate:"83",alertPending:"7",ruleEnabled:"5"}` ⚠️ 全字符串（BT-52） |
| `GET /admin/monitor/iot` | code=0，与 `/overview` **逐字节相同** ⚠️（BT-51） |
| `GET /admin/monitor/tasks` | code=0，`[{status:"pending",count:"2"},{assigned…},{doing…},{done:"7"},{rejected:"1"}]` ⚠️ 是聚合不是台账（BT-53） |
| `GET /admin/monitor/inputs` | code=0，`[{inputId,inputName,stockQty:8200.000,warnQty:2000.000,warning:false}…]` ⚠️ 是预警清单（BT-54） |
| `GET /admin/monitor/devices` | code=0，`List<IotDeviceEntity>` 真数据 ✅ |
| `GET /admin/monitor/readings/latest?deviceId=` | code=0，`IotReadingEntity` 真数据 ✅ |
| `GET /admin/monitor/alerts` | code=0，但 `data: []`（端点在、无数据） |
| `GET /admin/monitor/metrics` | **500** ❌（BT-55） |

## BT-51　`GET /admin/monitor/iot` 就是 `/overview`，前端却把它当设备列表 ⚠️

**源码铁证**（`AdminMonitorController:57-60`）：

```java
@GetMapping("/iot")
public ApiResponse<Map<String, Object>> iot() {
    return ApiResponse.ok(adminMonitorService.overview());   // ← 直接返回 overview()
}
```

**实测**：`/overview` 与 `/iot` 返回**逐字节相同**的
`{"deviceTotal":"12","deviceOnline":"10","onlineRate":"83","alertPending":"7","ruleEnabled":"5"}`。

**前端**：`listMonitorDevices()` 声明 `GET /admin/monitor/iot` → `Promise<PageResult<IotDevice>>`，
还传 `tenantId` / `onlineStatus`（后端**不接受任何入参**）。实际拿到的是 5 个统计数字，
`list` 恒为 undefined → 页面恒空。**零调用方**（IoT 监控页实际用的是 `/devices`）。

**与 BT-29 同类**（`overview` == `dashboard`）：两个路径、**一个实现**，
会被当成"主数据源 + 备用数据源"两个独立来源来用——**备用数据源是假的**。

## BT-52　监控总览 5 个指标**全是字符串**，前端全声明 number → 类型撒谎

实测 `"deviceTotal":"12"` / `"deviceOnline":"10"` / `"onlineRate":"83"` /
`"alertPending":"7"` / `"ruleEnabled":"5"`——**值全是字符串**。
前端 `MonitorOverview`（`api/admin/monitor.ts:73-84`）5 个字段全部声明为 `number`。

⚠️ 当前能显示是因为 `MonitorCenter.tsx:239-244` 的 `pickNumber()` 做了
`Number(...)` 收敛，但这属于**前端替后端擦屁股**。
与 BT-49（farms 合规画像字符串/数字混用）是同一个后端组装习惯问题，建议一并治理。

## BT-53　`GET /admin/monitor/tasks` 是**任务状态聚合**，前端同一路径声明了两种返回类型

**实测**：`[{"status":"pending","count":"2"},{"status":"assigned","count":"2"},
{"status":"doing","count":"2"},{"status":"done","count":"7"},{"status":"rejected","count":"1"}]`
——5 条**状态聚合**，`count` 还是字符串，且后端**不接受任何入参**。

前端对**同一个路径**声明了两种形状：
- `listMonitorTasks()` → `Promise<PageResult<Task>>` —— **完全错**（那不是任务台账）
- `listMonitorTaskStatusStats()` → `Promise<MonitorTaskStatusStat[]>` —— 形状对，
  但 `count: number` 与实际字符串不符

实际只有后者被调用（`MonitorCenter.tsx:277`）；前者零调用方。
⚠️ 建议：删掉 `listMonitorTasks`，或改打真正的任务分页端点（`/admin/.../tasks` 若有的话）。

## BT-54　`GET /admin/monitor/inputs` 是**投入品库存预警清单**，同样两种声明冲突

**实测**：`[{"inputId":"DEMO-INPUT-001","inputName":"腐熟有机肥","stockQty":8200.000,
"warnQty":2000.000,"warning":false}, …]`——是**库存预警**，字段与 `MonitorInputWarning` 吻合
（这几个是**真数字**），且后端同样**不接受任何入参**。

前端同一路径两种声明：
- `listMonitorInputUsages()` → `Promise<PageResult<InputUsage>>` —— **错**（那不是投入品使用台账）
- `listMonitorInputWarnings()` → `Promise<MonitorInputWarning[]>` —— **对**

两者目前**都零调用方**（`InputMonitor.tsx` 实际打的是 `/inputs/usages`）。

## BT-55　四个端点不存在：其中两个有真实调用方 →「重启设备 / 催办」100% 失败 ⚠️ P1

| 前端函数 | 路径 | 后端 | 调用方 |
| --- | --- | --- | --- |
| `getMonitorMetrics` | `GET /admin/monitor/metrics` | **无**（实测 500） | 零调用方 |
| `getMonitorTask` | `GET /admin/monitor/tasks/{taskId}` | **无** | 零调用方 |
| `urgeTask` | `PATCH /admin/monitor/tasks/{taskId}/urge` | **无** | **`TaskMonitor.tsx:283`** |
| `rebootDevice` | `PATCH /admin/monitor/iot/{deviceId}/reboot` | **无** | **`IotMonitor.tsx:249`** |

后端 7 个映射**全是 GET**，没有任何 PATCH/POST。
→ 「催办任务」与「远程重启设备」两个运营动作**必然失败**。
页面侧是诚实的（`onError` 里 `message.error`），所以不是假成功，但**功能不存在**。

**建议**：后端补端点；或若产品上暂不支持远程重启 / 催办，前端应把按钮置灰并写明
"后端未提供该能力"，而不是让使用者点了才看到失败。

## BT-56　三个页面的 JSDoc 仍写着"降级到原型示例口径"，与实际实现**矛盾** ⚠️

注释撒谎也是"假可用"的一种——后来的人照注释就会以为这里还在回落示例数据。

| 文件 | 过时注释 | 实际实现 |
| --- | --- | --- |
| `InputMonitor.tsx:147` | "接口无数据时降级到 PRD 示例口径" | `:683/:704` 明写"不使用示例数据兜底" |
| `IotMonitor.tsx:198` | "接口无数据时降级到原型 P9 示例口径" | `:629` 明写"不使用示例数据兜底，失败期间表格为空" |
| `TaskMonitor.tsx:242` | "接口无数据时降级到原型 P8 示例口径" | 实际 `tasksQuery.data?.list ?? []`，无兜底 |

**建议**：把三处注释改成与实际一致（"接口无数据即空态，不使用示例数据"）。属文档修正，待裁决。

## 附：本域诚实的地方（不要改坏）

- `MonitorCenter.tsx`：指标卡注释"不再用 8542 / 8069 / 94.5 / 3280 / 3542 这类示例数字顶替"；
  `pickNumber` 的兜底值是 **0**，不是示例数字；「在线农场 / 农场总数」后端无聚合 → 恒为 null 显示「—」。
- `IotMonitor.tsx`：低电量筛选注释"后端不返回 battery 时一律视为「非低电量」，**不臆造电量值**"。
- `Environment.tsx`：注释"后端无数据时各区块展示空态 / 「—」，不用示例数字顶替"。
- 两个写 mutation 的 `onError` 注释"失败就是失败"。

---

## 域 5：SOP 与知识库（`api/admin/sop.ts` + `pages/admin/sop` + `pages/admin/knowledge`）

> 扫描人：se-verify-fix　日期：2026-10-10　性质：**只读调研**为主，
> 另按「快照 → 调用 → 回读 → 还原」做了**一次可还原的写入实测**（BT-57 必须要回读才能定性）。
> 后端：`AdminSopController`（6 个映射）+ `AdminKnowledgeController`（6 个映射），
> 实测端点全部落在我自己的实例 `:8095`（jar `C:/Users/.../Temp/sevf/core-app-sevf.jar`，
> 日志 `sevf-8095.log`）。
> **写操作诚实性**：⚠️ **本域有一例真 P0 静默写空**（BT-57，知识库新增/编辑）。
> SOP 侧 `SopLibrary.tsx` 是纯只读页，无写操作，也没有兜底数据。

## 本域已验证有真数据的端点

| 端点 | 实测 |
| --- | --- |
| `GET /admin/sop?page&size` | code=0，3 条 `DEMO-SOP-001/002/003`（`sopType` PLANT/PEST/HARVEST，`status` 全 1）✅ |
| `GET /admin/sop/DEMO-SOP-001` | code=0，真数据 ✅ |
| `GET /admin/sop/zzz-not-exist` | **code=404** → handler 存在、实体不存在，判定诚实 ✅ |
| `GET /admin/sop/by-crop?cropId=DEMO-CROP-001` | code=0，真数据 ✅ |
| `POST /admin/sop/zzz-not-exist/publish` | **code=404**（`publish` 先走 `detail()`）✅ 诚实 |
| `GET /admin/knowledge?page&size` | code=0，3 条 `DEMO-ART-001/002/003`（`categoryCode` PLANT/PEST/POLICY，`readCount` 386/512/174）✅ |
| `GET /admin/knowledge/DEMO-ART-001` | code=0，真数据 ✅ |
| `GET /admin/knowledge/zzz-not-exist` | **code=404** ✅ 诚实 |
| `GET /admin/knowledge/by-category?categoryCode=PLANT` | code=0，真数据 ✅ |
| `DELETE /admin/knowledge/{不存在}` | **code=0 + data:null** ❌（BT-59） |
| `DELETE /admin/sop/{不存在}` | **code=0 + data:null** ❌（BT-59） |
| `PATCH /admin/knowledge/{真id}/publish` | **code=500「系统繁忙」** ❌（BT-58） |
| `POST /admin/knowledge/{真id}/publish` | code=0，`status` 由 0 → 1 ✅ |

> 分页入参说明：后端 `page()` 只认 `page` / `size`，前端统一传 `pageNum` / `pageSize`，
> 由后端 `PageParamAliasFilter` 做等价兼容。实测
> `?pageNum=1&pageSize=1` 与 `?page=1&size=1` 返回完全一致（`size=1`，`records=1`），
> **这条不是问题**，特此留档避免后人重复排查。

## BT-57　知识库「新增 / 编辑知识条目」：分类（表单必填项）写入后被静默丢弃，仍弹「知识条目已保存」⚠️ **P0（本轮第三例写操作静默写空）**

**现象**：`KnowledgeBase.tsx` 的保存抽屉里「分类」是 `rules: [{ required: true }]` 的必填项。
用户选完分类、填完正文、点保存 → 后端 200 + `code:0` → 页面 `onSuccess` 弹
`message.success('知识条目已保存')` → **刷新后分类列是「—」**。

**根因**（两端对照）：

| 前端 `saveMutation` 组装的 payload | 后端 `KnowledgeArticleEntity` 是否存在该列 |
| --- | --- |
| `title` | ✅ `title` |
| `category: 1｜2｜3｜4` | ❌ **无 `category` 列**（只有 `categoryCode: String`）→ **静默丢弃** |
| `summary` | ✅ `summary` |
| `content`（正文） | ❌ **无 `content` 列** → **静默丢弃** |
| `contentUrl: values.content` | ✅ `contentUrl`，但把正文文本塞进了「正文链接」列 → **字段语义污染** |
| `tags: [分类名]` | ❌ **无 `tags` 列** → **静默丢弃** |
| `source` / `author` | ✅ |
| `status: 0` | ✅ |

后端 `@PostMapping public ApiResponse<String> create(@RequestBody KnowledgeArticleEntity entity)`
——Jackson 对未知属性**不报错**（未开 `FAIL_ON_UNKNOWN_PROPERTIES`），`category` / `content` /
`tags` 三个字段直接蒸发，返回值仍是 `code:0` + 新主键。前端拿到 `code:0` 就报成功。

**成对实测（我先快照 → 调用 → 回读 → 已还原）**：

```
写入前：SELECT COUNT(*) FROM prod_knowledge_article → 3

POST /admin/knowledge
{"title":"ZZZ-SEVF-写入验证","category":1,"summary":"摘要ABC",
 "content":"正文内容正文内容","contentUrl":"正文内容正文内容",
 "tags":["种植技术"],"source":"来源X","author":"来源X","status":0}
→ {"code":0,"message":"success","data":"KNWL202610101634127017","traceId":null}   ← 看起来成功

GET  /admin/knowledge/KNWL202610101634127017
→ {"code":0,"data":{"articleId":"KNWL202610101634127017",
                    "categoryCode":null,          ← 分类没了（前端传了 category:1）
                    "title":"ZZZ-SEVF-写入验证",
                    "summary":"摘要ABC",
                    "contentUrl":"正文内容正文内容",  ← 正文被塞进了「正文链接」列
                    "author":"来源X","source":"来源X","readCount":null,"status":0}}

DELETE /admin/knowledge/KNWL202610101634127017   ← 还原
写入后：GET /admin/knowledge → total=3，['DEMO-ART-001','DEMO-ART-002','DEMO-ART-003']  ✅ 已复原
```

**编辑路径同样静默**：`updateKnowledgeArticle` → `PUT /{id}` → `update()` 里
`updateById(entity)`（MyBatis-Plus 默认 `NOT_NULL`，不传的字段不动）+ `detail(id)`。
payload 里**根本没有 `categoryCode`**，所以改分类在编辑态也是**无操作 + code:0 + 提示成功**。

**为什么这是 P0 而不是"小瑕疵"**：用户在必填项里选了分类，系统回了一句"已保存"，
回读发现没存——这是「说了做了其实没做」，和 BT-25（报表生成）、BT-40（审批通过）同类，
但更隐蔽：那两例是**整条写失败**，这一例是**写进去了但少写了**，
列表不刷新看不出来，刷新也只是「—」，不会报错。

**待裁决（我不自行改代码）**，三个选项：
1. 前端改为写 `categoryCode` 字符串（`PLANT` / `PEST` / `POLICY`），并把 `content` / `tags`
   从 payload 里删掉（写了也不存就别写），同时保存后**回读校验**再报成功；
2. 后端在 `KnowledgeArticleEntity` 上补 `content` 列、`category` → `categoryCode` 的兼容映射；
3. 两者都做。另：`CATEGORY_OPTIONS` 里的「农资知识 / 土壤管理」在任何方案下都**没有对应的
   `categoryCode`**，需单独决定是砍掉这两个选项还是补编码（见 BT-62）。

## BT-58　`publishKnowledgeArticle` 用 PATCH，后端只有 POST →「审核通过」100% 失败；且后端不接受 `status` ⚠️ P1

**方法不匹配**（与 BT-35 / BT-41 / BT-47 同一类后端/前端动词分歧）：

```java
// AdminKnowledgeController:59-62
@PostMapping("/{articleId}/publish")                    // ← 只有 POST
public ApiResponse<KnowledgeArticleEntity> publish(@PathVariable String articleId) {
    return ApiResponse.ok(knowledgeArticleService.publish(articleId));
}
```
```ts
// api/admin/sop.ts:137
return http.patch<boolean>(`${KB_BASE}/${articleId}/publish`, { status })   // ← 用 PATCH
```

**实测**（对我自己新建的 status=0 行）：
- `PATCH /admin/knowledge/{id}/publish` body `{"status":1}` → `code:500`「系统繁忙，请稍后重试」；
  回读 `status` 仍为 **0**，`publishAt` 仍为 **null** —— **确实没写进去**。
- `POST /admin/knowledge/{id}/publish` → `code:0`，回读 `status` = **1** ✅

→ 页面上「审核通过」按钮（`KnowledgeBase.tsx:439`、`:630`）**每次点都失败**，
用户看到的文案是「审核失败：系统繁忙，请稍后重试」——**"系统繁忙"会误导成偶发故障**，
实际是永久性的方法不匹配。

**第二层：即使把动词改成 POST，`status` 参数也是谎**。
后端 `KnowledgeArticleService.publish()` 硬置 `setStatus(1); setPublishAt(now())`，
**方法签名上没有任何 status 入参**。而前端 `publishKnowledgeArticle(articleId, status)`
承诺"可以传任意状态"——下架（status=0）在后端**根本做不到**。
（`AdminSopController.publish` 同样硬置 `setStatus(1)`，无 status 入参。）

**待裁决**：
1. 前端改 `http.post` 并把签名收敛成 `publishKnowledgeArticle(articleId)`（去掉 status 参数，
   不承诺后端做不到的事）；或
2. 后端把 `publish(articleId, status)` 做成真能上下架，前端再保留 status。

附带：`publishKnowledgeArticle` 声明 `Promise<boolean>`，后端返回的是
`KnowledgeArticleEntity`（对象）——**类型撒谎**（返回值实际是 `null`/实体，不是布尔）。

## BT-59　`DELETE /admin/knowledge/{不存在}` 与 `DELETE /admin/sop/{不存在}` 都返回 200 + code 0 ⚠️ 挂 **G-01**

**实测**：
```
DELETE /admin/knowledge/zzz-not-exist → {"code":0,"message":"success","data":null}
DELETE /admin/sop/zzz-not-exist       → {"code":0,"message":"success","data":null}
```

**源码**：两个 controller 都是 `sopLibraryService.delete(id); return ApiResponse.ok();`
——`delete()` 里 `sopLibraryMapper.deleteById(id)` 的**影响行数被丢弃**，
删不到任何行也照样 `ok()`。前端 `deleteSopLibrary` / `deleteKnowledgeArticle`
声明 `Promise<boolean>`，但 `data` 是 `null`（不是 `false`），页面也不读返回值。

**影响**：`KnowledgeBase.tsx` 的 `removeMutation.onSuccess` 无条件弹「条目已删除」。
删一条已被别人删掉的行 → 依旧提示"已删除"（这条尚可接受，因为目标确实没了），
但**删一条主键写错的行 → 也提示"已删除"，而那行还躺着**。

**归属**：与 **G-01**（`deleteById` 丢弃影响行数）完全同源，**挂在 G-01 下统一治理**，
不在 sop / knowledge 两个实体上分别打补丁。前端侧若要先行，可参照 BT-22 的做法：
调用后回读一次，确认真的没了再报成功。

## BT-60　`api/admin/sop.ts` 里 5 个 SOP 函数零调用方；后端 `POST /admin/sop/{sopId}/publish` 也零调用方 → 建议删

全仓 grep（含 `@/api` 桶导出）确认，SOP 侧实际被页面引用的**只有** `listSopLibrary`
（`SopLibrary.tsx:48`）与类型 `SopLibraryItem`：

| 函数 | 路径 | 后端是否存在 | 调用方 |
| --- | --- | --- | --- |
| `getSopLibrary` | `GET /admin/sop/{sopId}` | ✅ | **零** |
| `createSopLibrary` | `POST /admin/sop` | ✅ | **零** |
| `updateSopLibrary` | `PUT /admin/sop/{sopId}` | ✅ | **零** |
| `deleteSopLibrary` | `DELETE /admin/sop/{sopId}` | ✅ | **零**（且见 BT-59） |
| `listSopLibraryByCrop` | `GET /admin/sop/by-crop` | ✅ | **零** |
| （无对应前端函数） | `POST /admin/sop/{sopId}/publish` | ✅ | **零** |

即：**SOP 规程库目前是一个纯只读页面**，没有任何新增/编辑/删除/发布入口。
后端 6 个映射里 5 个没有任何前端消费者。

**待裁决**：删这 5 个声明（与 BT-36 / BT-46 / BT-48 同一批处理），
还是先把 SOP 的增删改做成真页面。⚠️ 若选择"做成真页面"，请先读 BT-57——
照现在这套 payload 组装习惯做出来，会再复制一例静默写空。

## BT-61　`listKnowledgeArticles` 仍带 `title` / `category` 两个后端不消费的入参

```ts
// api/admin/sop.ts:101-105
export function listKnowledgeArticles(
  params: PageQuery & { title?: string; keyword?: string; category?: number; status?: number },
): Promise<PageResult<KnowledgeArticle>> {
  return http.get<PageResult<KnowledgeArticle>>(KB_BASE, params)
}
```

后端 `AdminKnowledgeController#page` 只接收 `page / size / keyword / status` 四个参数
（源码 `:29-35`），`title` 与 `category` **传了也不进查询条件**（这一点文件头 JSDoc 已写明）。

现状：唯一调用方 `KnowledgeBase.tsx:196` 只传 `{pageNum, pageSize, keyword}`，
**没有传 `title` / `category`**，所以当前不产生实际的谎报。
但这两个入参留在签名里，就是在**邀请**下一个人传它然后以为生效了。

**待裁决**：从签名里删掉 `title` / `category`（保留 JSDoc 里那段"后端不消费"的说明），
与 BT-60 一并清理。

## BT-62　`CATEGORY_TO_CODE` 的注释说"仅保留写入兼容"，实际**完全不兼容** → 注释撒谎

```ts
/** 分类名 → 后端历史数字编码（后端实际不消费该字段，仅保留写入兼容） */
const CATEGORY_TO_CODE: Record<string, 1 | 2 | 3 | 4> = {
  种植技术: 1, 病虫害防治: 2, 政策法规: 3, 农资知识: 4, 土壤管理: 4,
}
```

三条与事实不符：
1. 后端**没有** `category` 列，字段名都不一样（`categoryCode` 是 String，
   取值为 `PLANT` / `PEST` / `POLICY`），**不是"不消费"而是"字段对不上"**，
   "兼容"二字会让人以为改个数字就能通；
2. 读侧映射 `CATEGORY_CODE_TO_NAME` 只认 `PLANT` / `PEST` / `POLICY`，
   **「农资知识」「土壤管理」在任何编码体系下都不存在** —— 选了它们写进去，
   读回来必然是「—」，是 BT-57 里最隐蔽的一支；
3. `土壤管理` 与 `农资知识` **共用编码 4**，本身就是两个名字挤一个号。

**待裁决**：要么把注释改成"后端字段为 `categoryCode`（PLANT/PEST/POLICY），
本表仅为历史遗留、当前不参与读写"，要么连表一起删（配合 BT-57 的方案 1）。
另需单独裁决「农资知识 / 土壤管理」两个分类是砍掉还是后端补编码。

## 附：本域诚实的地方（不要改坏）

- `SopLibrary.tsx`：整页**只读**，无任何写操作；`dash()` 对缺失值统一显示「—」，
  注释明写"无本地示例数据、无空结果兜底塞数据"；旧的「SOP 模板审核」模型
  （AUDIT_STATUS_MAP / 6 条 MOCK_TEMPLATES / `PATCH /{id}/audit`）已被整段删掉，
  并在文件头留了原因——**这是本域最值得保住的一段**。
- `KnowledgeBase.tsx`：「废弃」按钮走
  `throw new Error('后端知识库无「废弃」状态，标记废弃未接入')`，注释明写
  "不做本地假更新（那等于宣称已废弃，刷新即露馅）"——**主动失败，不伪造状态**。
- 三个明示缺失的提示语：`VIEW_COUNT_MISSING_TIP` / `ENTRY_TYPE_MISSING_TIP` /
  `DEPRECATED_MISSING_TIP`，文案都是"未接入：…显示为「—」而非 0"。
- 硬编码统计卡 `15680 / 14200 / 850 / 630` 已删除，统计全部由后端真实条目聚合。
- `saveMutation` / `removeMutation` / `auditMutation` **三个都写了 `onError`**，
  没有 `catch {}` 静默 —— BT-57 的问题在于**字段被丢**，不在于失败被吞。
- 分类树 `treeData` 的条目数由后端真实条目聚合；分类名未知时回落编码原文，
  注释明写"不做「看起来像」的猜测映射"。

---

## 域 6：溯源与质量（`api/admin/trace.ts` + `pages/admin/trace` + `pages/admin/quality`）

> 扫描人：se-verify-fix　日期：2026-10-10　性质：**只读调研**（GET 实测 + 源码对照 +
> 前端静态审计），**不改任何业务代码**。写端点只用「不存在的 batchId」做**无副作用**探测
> （命中即 0 行受影响），未写入任何真实数据。
> 后端：`AdminTraceController`（7 个映射）、`AdminQualityController`（7 个映射）、
> `QualityController`（`/quality`，20 个映射）、`TraceController`（`/trace`）。
> 实测落在我自己的实例 `:8095`。
>
> **写操作诚实性**：⚠️ **本域有一例 P0 静默假成功**（BT-63，一键召回），
> 且读侧有两处**整页/整列编造**（BT-64 / BT-65）。
> 但 `AdminQualityService` 的三个写操作（accredit / reject / recall）**是诚实的**
> ——同样的「目标不存在」场景它抛 404，正好是 BT-63 的对照组。

## 本域已验证有真数据的端点

| 端点 | 实测 |
| --- | --- |
| `GET /admin/trace?page&size` | code=0，6 条 `DEMO-TC-0001..0006`（`status` 是 **ACTIVE/INACTIVE 大写**）✅ |
| `GET /admin/trace/codes?page&size` | code=0，**与上一行逐字段相同**（BT-68） |
| `GET /admin/trace/code-stats` | code=0，`{"generated":"0","active":"5","scanned":"0","revoked":"0"}` ⚠️ 值全字符串、四桶中三桶恒 0（BT-66） |
| `GET /admin/trace/labs` | code=0，`[{labId,labName,labType,qualificationNo}…]` 真数据 ✅ |
| `GET /admin/quality/overview` | code=0，`{"passCount":"3","failCount":"1","passRate":"75","labCount":"3","frozenBatch":"1"}` ⚠️ 全字符串（BT-70） |
| `GET /admin/quality/labs?page&size` | code=0，真数据 ✅ |
| `GET /admin/quality/inspections?page&size` | code=0，真数据 ✅ |
| `GET /admin/quality/inspections/failed` | code=0，真数据 ✅ |
| `GET /admin/trace/overview` | **code=500** ❌ 端点不存在（BT-69） |
| `GET /admin/trace/codes/{code}` | **code=500** ❌ 端点不存在（BT-69） |
| `GET /admin/trace/nodes/{batchId}` | **code=500** ❌ 端点不存在（BT-69） |
| `POST /admin/trace/recall?batchId=不存在` | **code=0 + data:0** ❌ 静默假成功（BT-63） |
| `POST /admin/trace/recalls?batchId=不存在` | **code=0 + data:0** ❌ 同上（别名，BT-68） |
| `POST /admin/quality/recalls?batchId=不存在` | **code=404「资源不存在」** ✅ 诚实（对照组） |

## BT-63　一键召回对**不存在的批次**返回 `code:0 + data:0`，前端无条件宣称「批次已冻结」⚠️ **P0（本轮第四例写假成功，且是第一例「目标不存在也说成功」）**

**源码**（`AdminTraceService.recall`，`:118-136`）：

```java
@Transactional
public int recall(String batchId) {
    HarvestBatchEntity batch = harvestBatchMapper.selectById(batchId);
    int count = 0;
    if (batch != null) {                    // ← 查不到就什么都不做，也不抛异常
        ... 逐条 setStatus("revoked") ...
        batch.setStatus(4);
        harvestBatchMapper.updateById(batch);
    }
    return count;                           // ← 返回 0
}
```

**前端**（`Detail.tsx:110`、`RecallManage.tsx:348`）：

```ts
onSuccess: (count) => {
  message.success(`召回已执行：作废溯源码 ${count} 张，批次已冻结`)   // ← 无条件
}
```

**成对实测（同一个不存在的 `batchId=zzz-not-exist`）**：

```
POST /admin/trace/recall?batchId=zzz-not-exist    → {"code":0,"data":0}          ← 什么都没做
POST /admin/trace/recalls?batchId=zzz-not-exist   → {"code":0,"data":0}          ← 别名，同样
POST /admin/quality/recalls?batchId=zzz-not-exist → {"code":404,"message":"资源不存在"}  ← 对照组
```

→ 运营在「一键召回」里填错/粘错批次 ID（或批次已被清理）→ 弹窗写
「**召回已执行：作废溯源码 0 张，批次已冻结**」。
「0 张」是诚实的数字，但「**批次已冻结**」是凭空的——那一行批次从头到尾没被碰过。

**为什么比 BT-25 / BT-40 / BT-57 更该先修**：那三例刷新列表就会露馅；
这一例刷新列表**不会露馅**——列表里本来就没有这个批次，
运营会认为"召回了，只是这个批次没有码"，只有去库里查 `prod_harvest_batch.status` 才知道没冻结。

**对照组说明**：`AdminQualityService.recall`（`POST /admin/quality/recalls`）
在 `batch == null` 时 `throw new BusinessException(ErrorCode.NOT_FOUND)` → 404 →
前端 `onError` 弹「召回接口未返回成功，请确认批次 ID 是否有效」。
**同一件事，两个 service 两种处置**。这说明修法很明确：照 `AdminQualityService` 抄即可。

**建议归属**：与 **G-01** 同源（都是「写操作在目标不存在 / 影响 0 行时静默返回成功」）。
BT-22 / BT-28 是 `deleteById` 丢弃影响行数，这一例是 `selectById → null → 不抛异常`，
**代码形态不同但用户可见后果完全一致**。建议把 G-01 的口径从
「`deleteById` 丢弃影响行数」放宽为「**写操作在目标不存在或影响 0 行时必须显式失败**」，
把 BT-22 / BT-28 / BT-59 / BT-63 一并收进去治理，别一个实体打一个补丁。

**待裁决（我不自行改代码）**：
1. `AdminTraceService.recall` 在 `batch == null` 时抛 `NOT_FOUND`（与 quality 侧对齐）；
2. 前端 `onSuccess` 改为**回读校验**（确认 `status === 4`）后再报成功，
   并把「已冻结」这句从「无条件断言」改成「按回读结果表述」；
3. 两者都做（推荐）。

## BT-64　溯源码管理页：后端返回空时 `buildFallbackRows()` 编造整页行，`total` 编成 **2,450,000** ⚠️ **P0（读侧编造量级最大）**

**源码**（`AdminTraceCodeManage.tsx:307-346`）：

```ts
/** 表格数据源：后端数据优先，缺失时回落兜底数据 */
const { rows, total } = useMemo(() => {
  if (remoteRows.length > 0) { ... }
  const fallback = buildFallbackRows(pageNum, pageSize)      // ← 编造
  ...
  return { rows: filtered, total: fallback.total }            // ← 编造的 total
}, [...])
```

```ts
const PROTOTYPE_TOTAL = 2_450_000      // 「原型口径总码量」
...
return { list, total: PROTOTYPE_TOTAL }   // buildFallbackRows 末尾
```
```ts
const PRODUCT_POOL = ['有机大米','红富士苹果','有机蔬菜','有机牛奶','土鸡蛋']
const FARM_POOL    = ['绿源1号','丰达A区','大地南','惠民D','鑫农试']
const CODE_PREFIX  = 'TRC'
```

**后果**：只要接口返回空数组（后端没数据 / 该状态过滤无命中 / 接口失败期间），
页面就渲染出一整页 `TRC20250714xxx` 开头的**编造溯源码**，
分页器显示「**共 2,450,000 条**」，其中前 8 条直接照抄
`PROTOTYPE_ROWS`（`TRC20250714001`…`TRC20250713011`，含编造的批次号 `B2025071`、
产品名、农场名、扫码次数），第 9 条起用 `(seq*5)%10` 滚动生成状态、
`(seq*3)%12` 生成扫码次数、`2025-07-xx` 生成日期。

⚠️ 这些行**长得和真行一模一样**，且「生成日期 / 扫码 / 批量导出 / 跳转链路详情」
的按钮全都可点（点了才会失败或跳到不存在的码）。

**注意**：后端现在**有** 6 条真数据，所以当前打开页面看到的是真数据，
这个兜底**只在接口为空或失败时触发**——正因如此它更危险：
平时测不出来，一旦后端抖动，页面立刻变成"有 245 万条码"的假象。

**建议**：删掉 `buildFallbackRows` / `PROTOTYPE_ROWS` / `PROTOTYPE_TOTAL` /
`PRODUCT_POOL` / `FARM_POOL`，空结果走 `<Empty>` + 失败原因（与本轮 BT-33 的处置一致）。

## BT-65　同一页面「产品」与「农场」两列 **100% 编造**——后端 `TraceCodeEntity` 根本没有这两个字段 ⚠️ P1

后端 `GET /admin/trace/codes` 单条记录的**全部字段**（实测）：
`id / marketId / tenantId / createdAt / updatedAt / deleted / batchId / batchNo /
code / status / activatedAt / activatedBy / scanCount / lastScanAt / expireDate`
——**没有 `productName`，没有 `farmName`**。

而页面列定义里明写着「产品」「农场」两列（`:376-377`），映射代码是：

```ts
productName: item.productName ?? PRODUCT_POOL[seq % PRODUCT_POOL.length],
farmName:    item.farmName    ?? FARM_POOL[seq % FARM_POOL.length],
```

`item.productName` 恒为 `undefined` → **每一行**的产品名与农场名都取自常量池，
按行序号轮换。也就是说页面上「有机大米 / 绿源1号」这类内容
**与数据库里的任何一张表都没有关系**，却和真码 `DEMO-TC-0005` 并排显示在同一行。

**这不是"缺失兜底"，是"没有这个字段却造了两列"**：
后端 `prod_trace_code` 只关联到 `batch_no`，产品与农场要经批次/地块再跳两级才能拿到，
属于后端缺口。**正确处置是删掉这两列，或显示「未接入」**，不是从池子里取值。

## BT-66　溯源码 status 存在**三套互不通的词表** ⚠️ P1

| 口径 | 取值 | 出处 |
| --- | --- | --- |
| 数据库实际值 | `ACTIVE` / `INACTIVE`（**大写**） | `SELECT code,status FROM prod_trace_code` 实测 6/6 |
| 前端词表 | `generated` / `active` / `scanned` / `revoked`（**小写**） | `CodeStatusView`（`AdminTraceCodeManage.tsx:49`） |
| 召回写入 | `revoked`（**小写**） | `AdminTraceService.recall` `setStatus("revoked")` |
| 统计桶 | `generated` / `active` / `scanned` / `revoked` | `codeStats()` 按这四个字符串 count |

三段后果：
1. **状态列显示原始英文大写**：`STATUS_TEXT[value] ?? value`（`:390`）取不到大写键，
   直接把 `"ACTIVE"` / `"INACTIVE"` 渲染给用户看；
2. **`codeStats` 四个桶里三个恒为 0**：实测 `{"generated":"0","active":"5","scanned":"0","revoked":"0"}`
   ——`generated` / `scanned` / `revoked` 在现有数据口径下永远统计不到，
   统计卡却把这 4 个桶并列展示，看上去像"四个维度都有数据"；
   （`active=5` 能对上是因为 MySQL 默认排序规则大小写不敏感，
   换成区分大小写的库/列就会全部变 0——目前**是靠数据库 collation 侥幸成立的**。）
3. **召回会往同一列写第三种大小写**：`recall()` 写小写 `revoked`，
   与种子数据的大写 `ACTIVE` 混在同一列，之后任何按大小写敏感的统计都会漏掉这批。

**待裁决**：统一词表（建议后端枚举定死一套 + 存量数据一次性订正），
前端 `CodeStatusView` 按真实词表建模；在那之前，「状态」列不应把未知值原样渲染给用户，
应显式标注「未知状态：ACTIVE」。

## BT-67　`Number(item.batchId)` 把 18 位批次 ID 截断；且该 ID 与批次主键口径不通

```ts
batchId: Number(item.batchId ?? 0),
```

后端 `batchId` 实测是 **`"920000000000000004"`**（18 位）。`Number()` 只有 53 位有效精度
（≈16 位十进制），转换后末几位被抹平——页面上显示的 `batchId` 已经不是库里的值，
拿它去跳详情或反查必然查不到。

而且这个字段口径本来就不通：后端 `AdminTraceService.chain()` 的注释已经写明
「`prod_trace_code.batch_id` 是 V1 遗留 BIGINT，与 `prod_harvest_batch` 的 varchar(32)
主键口径不通（实测 6/6 条溯源码均为合成数字串，按 id 关联命中 0 条，batch 恒为 null）」，
真实关联走 `batch_no`。

→ 前端仍把这个不可用的 `batchId` 转成 number 展示，是"把一个已知无效的字段渲染得像有效"。
建议：直接显示后端原字符串，或改显示 `batchNo`（后端注释确认这个才是可关联的口径）。

## BT-68　「两个路径、一个实现」在本域出现**两例** → 累计第 3、4 例，请开治理项

```java
// AdminTraceController
@GetMapping                       page(...)  → adminTraceService.page(page, size, status)
@GetMapping("/codes")             codes(...) → adminTraceService.page(page, size, status)   // 同一个方法
@PostMapping("/recall")           recall(...)  → adminTraceService.recall(batchId)
@PostMapping("/recalls")          recalls(...) → adminTraceService.recall(batchId)          // 注释即写「别名」
```

实测 `/admin/trace?page=1&size=3` 与 `/admin/trace/codes?page=1&size=3` **返回逐字段相同**。

这是继 **BT-29**（`overview` == `dashboard`）与 **BT-51**（`/iot` == `/overview`）之后
的第三、第四例。我在 monitor 域已经提过一次，这里证据更硬（源码注释直接写了"别名"）。
**风险**：两条路径会被后来的人当成"主数据源 + 备用数据源"，
而"备用数据源"其实是同一个东西——一旦主路径出错，切过去不是降级而是同一个错。
请裁决是否开一个治理项统一收口（我建议开，编号你定）。

## BT-69　`api/admin/trace.ts` 前半段 **15 个函数零调用方**，且后端根本没有对应映射

全仓 grep 确认，被页面引用的只有文件下半段那批
（`fetchAdminTraceCodeStats` / `fetchAdminTraceCodes` / `fetchAdminTraceChain` /
`recallAdminTraceBatch` / `fetchQualityLabs` / `accreditQualityLab` / `rejectQualityLab` /
`createQualityLab` / `updateQualityLab` / `fetchQualityInspections` /
`fetchFailedInspections` / `fetchAdminQualityOverview` / `recallQualityBatch`）。

上半段 15 个（`BASE = '/admin/trace'`）：`getTraceOverview`、`listAdminTraceCodes`、
`getAdminTraceCode`、`freezeTraceCode`、`listAdminTraceNodes`、`listLabs`、`getLab`、
`createLab`、`updateLab`、`deleteLab`、`listRecalls`、`getRecall`、`createRecall`、
`updateRecall`、`closeRecall`，**全部零调用方**，另加 `fetchChainLabs`（`:494`）也是零调用。

后端 `AdminTraceController` 的 7 个映射里**没有**
`/overview`、`/codes/{code}`、`/codes/{code}/freeze`、`/nodes/{batchId}`、`/labs/{labId}`、
`/recalls/{recallId}`、`/recalls/{id}/close`——实测 `/admin/trace/overview` = **code 500**。

即：这些声明**既是死代码，又指向不存在的端点**。若哪天有人按名字取用
（比如 `freezeTraceCode` 冻结码），会立刻踩到「200 + code 500」的假可用。
（`updateLab` 的 JSDoc 已经自认"是一个不可达的死函数（全仓无调用方）"——
说明清理时是逐个确认过的，剩下这 14 个建议一并清掉。）

## BT-70　`/admin/quality/overview` 五个值**全是字符串**，前端声明 number → 顺带造成 `passCount + failCount` 变**字符串拼接** ⚠️ P1

实测：`{"passCount":"3","failCount":"1","passRate":"75","labCount":"3","frozenBatch":"1"}`
（后端用 `long` 计数 + 全局 JacksonConfig 给 Long 注册了 `ToStringSerializer`）。

前端 `AdminQualityOverview`（`api/admin/trace.ts:230-241`）5 个字段**全部声明 `number`**。

**已造成的实际错误**（`Inspections.tsx:329`）：

```ts
totalReports: raw ? raw.passCount + raw.failCount : PROTOTYPE_TOTAL,
```

`"3" + "1"` = **`"31"`**，而 `<Statistic title="报告总数" value={metrics.totalReports} />`
（`:484`）照单全收 → **页面显示「报告总数 31」，真实值是 4**。
这不是理论风险，是当前就能复现的错误数字。

同一类问题的其他出口：`RecallManage.tsx:406`
`frozenBatch: overviewQuery.data?.frozenBatch ?? finished` → 拿到字符串 `"1"`，
渲染成「/ 已冻结 1」（`:681`），目前**碰巧对**，但类型依旧是谎。

**对照**：`TraceOverview.tsx:141-155` 用了 `toNumber(...)` 收敛并显示「未接入」，
**那一处是对的**（见"诚实的地方"）；`Inspections.tsx` 与 `RecallManage.tsx` 没做这层收敛。

**建议**：`fetchAdminQualityOverview` 在 api 层逐键 `toNumber` 归一
（与 `fetchAdminTraceCodeStats` 已有的做法一致），从根上不再让字符串冒充数字；
`Inspections.tsx:329` 的 `+` 改成数值相加。

## BT-71　`Inspections.tsx`：总览取不到时用硬编码 `11_850` / `95.2` / `12_450` 顶替，表格空结果同样走原型兜底 ⚠️ P1

```ts
const PROTOTYPE_TOTAL = 12_450                       // :170
...
totalReports: raw ? raw.passCount + raw.failCount : PROTOTYPE_TOTAL,   // :329
passCount:    raw?.passCount  ?? 11_850,                                // :331
failCount:    raw?.failCount  ?? failedCount,
passRate:     Number(raw?.passRate ?? 95.2),                            // :335
labCount:     raw?.labCount   ?? LAB_OPTIONS.length,                    // :337
frozenBatch:  raw?.frozenBatch ?? 0,
```

`raw` 是 `overviewQuery.data`，**接口失败 / 加载中时它是 `undefined`** →
指标卡显示「合格报告 **11850**」「检测合格率 **95.2%**」「报告总数 **12450**」。
这三个数字与后端 4 条检测记录毫无关系，是原型 P14 里抄来的。

⚠️ 尤其 `95.2` 会直接影响**颜色语义**：`:513` 的
`valueStyle={{ color: metrics.passRate >= 95 ? '#52c41a' : '#faad14' }}`
——接口一失败，合格率就"恰好"落在 95 以上，**指标卡变绿**。

表格侧同样是空结果兜底（`:307` `buildFallbackRows(pageNum, pageSize)`，
注释直写「缺失时回落原型 P14 示例」）。

**建议**：指标卡在 `overviewQuery` 未取到数据时显示「未接入」+ 失败原因（照
`TraceOverview.tsx` 的写法），删掉 `11_850` / `95.2` / `12_450` / `PROTOTYPE_TOTAL`
与 `buildFallbackRows`。

## BT-72　`AdminTraceCodeManage.tsx` 激活溯源码时把操作人**硬编码**成「运营管理员」

```ts
mutationFn: (code: string) => activateTraceCode(code, '运营管理员'),
```

后端 `POST /trace/activate` 会把 `activatedBy` 落进 `prod_trace_code.activated_by`。
运营端这样调用后，库里记的操作人永远是字符串「运营管理员」，**不是真实登录用户**——
溯源链路上"谁激活的码"这条审计信息从此失真。
（真数据里 `DEMO-TC-0005.activatedBy = "DEMO-MEM-005"`，说明这列本来是存真实主体的。）

**建议**：改成取当前登录用户（或后端从 token 里取，前端不再传）。

## BT-73　`RecallManage.tsx` 的「本地处置登记」只存在 `useState`，刷新即丢，却与接口数据合并进同一张表和同一组统计 · P2

```ts
/** 本地处置台账（后端无处置单端点时承接运营登记） */
const [localRows, setLocalRows] = useState<RecallRow[]>([])
```

处置方式 / 处置状态 / 回收数量 / 责任人 / 复盘记录全部走 `patchRow()` 写进 `localRows`，
**没有任何持久化**（无 localStorage、无后端端点）。后果：
1. 运营填完处置闭环 → 刷新页面 → 全部回到接口原始态，且**没有任何提示**；
2. `localRows` 与后端行 `{...row, ...local}` 合并（`:370`），页面上分不出哪部分是后端真态、
   哪部分是本机登记；
3. 顶部统计 `pending / processing / finished`（`:393-395`）直接由合并后的 `status` 算出，
   **本地登记会改变"待处置 / 处置中 / 已闭环"三个官方口径的计数**。

✅ **这一条有明示文案**：页面顶部 `CONTRACT_NOTE`（`:200-203`）写明了
"后端没有「不合格品处置单」实体…处置方式 / 处置状态 / 回收数量由运营在本页本地登记
（后端无处置单写入端点），**不代表后端已有该状态**"。
所以它不是"偷偷造假"，属于"说了但不持久"，定 P2。

**建议**（二选一，待裁决）：
1. 后端补「不合格品处置单」实体与端点，本地登记改为真写入；
2. 维持本地登记，但补上持久化 + 在行上打「本地登记」标记，
   并让顶部三个统计**只统计后端口径**，不让本地登记污染官方计数。

## 附：本域诚实的地方（不要改坏）

- **`AdminQualityService` 三个写操作在目标不存在时都抛 `NOT_FOUND`**
  （`accredit` / `reject` / `recall`，各自 `throw new BusinessException(ErrorCode.NOT_FOUND)`）
  → 404 → 前端 `onError` 报「…未返回成功」。**这正是 BT-63 的对照组与修法模板**。
- `AdminQualityController.reject` 的 JSDoc 明写"此前运营端「驳回」是纯前端假动作：
  只弹「已驳回」提示、刷新列表，后端无任何端点，库里状态纹丝不动"——**假动作已被修掉，
  并把原因留在了代码里**，这是最值得保住的一类痕迹。
- `LabManage.tsx` 四个 mutation 全有 `onError` + `describeFailure(error, 动作, 端点)`；
  `createMutation.onSuccess` 用**服务端返回的 `labId`**（不是本地造一个）；
  `updateMutation` 刻意**不包含 `status`**，注释写明"状态变更必须走准入审核
  （accredit / reject）这条有记录的链路，编辑表单里改状态等于绕开审计"；
  `openEditForm` 注释"用行内真实数据回填，不做任何本地兜底"。
- **`CreateQualityLabPayload` 的 10 个字段与 `QualityLabEntity` 逐字段对齐**
  （`labId/labCode/labName/labType/labLevel/contactName/contactPhone/address/
  qualificationNo/accreditedScope/status`）——**对照 BT-57（知识库 `category` 被静默丢弃），
  这里没有同款问题**，不要在清理时误伤。
- `fetchAdminTraceCodeStats`（`api/admin/trace.ts:452`）已把 `code-stats` 的字符串值
  **逐键 `readNumber` 归一为真 number**，JSDoc 说明了「Long → ToStringSerializer」的根因，
  并写明"不能让字符串冒充数字流到页面"。**这是 BT-70 的修法模板。**
- `TraceOverview.tsx:141-155 / :261-271` 一律 `toNumber(...) === undefined ? '未接入'`，
  **不兜 0**。
- `RecallManage.tsx` 明写"**不再回落 PROTOTYPE_RECALLS 原型台账**——那 4 条原型行
  （RC20250714001 / 有机蔬菜 5200kg / 省农检中心…）与后端数据毫无关系，
  接口偶发失败时会被当成真实不合格批次展示"，并给出了理由。
- `RecallManage.tsx:265`「`sampleQty` 是后端真实字段，直接取原值，**不做放大、不做兜底**」。
- `Detail.tsx` 全部档案字段 `?? '未接入'`，批次档案取不到时明写
  "后端未关联到批次档案（batch = null）"。
- `AdminTraceService.chain()` 的注释如实记录了 V1 遗留 BIGINT 与 varchar 主键口径不通、
  `batch` 恒为 null 的事实，以及改用 `batch_no` 关联的原因——**把已知缺陷写在代码里而不是藏起来**。

---
