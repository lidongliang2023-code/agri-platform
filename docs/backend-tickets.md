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
是否开工单请 team-lead 裁决（倾向：后端补字段，或前端改为明示"后端未提供入库状态"）。

---

## 附：本轮已验证为"真生效"的对照

| 操作 | 端点 | 回读结果 |
| --- | --- | --- |
| 出库 | `POST /harvests/inventory/{batchId}/out` | `prod_inventory_flow` +1 行，按 batchId 回查得到新行 ✅ |
| 采收批次详情 | `GET /harvests/{batchId}` | 真数据，`demo=false`，9/11 关键字段命中 ✅ |
| 出入库流水 | `GET /harvests/{batchId}/flows` | 真数据，`demo=false`，每批次 2 条 ✅ |
| 任务提交验收 | `POST /tasks/{taskId}/submit` | `status=done` + `acceptStatus=0`（已还原）✅ |
