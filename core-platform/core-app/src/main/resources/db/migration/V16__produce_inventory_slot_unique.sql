-- 库存台账：库位唯一约束（BT-02 唯一性补强）
--
-- 背景（BT-02 静默假成功，se-verify-fix 回读验收发现）：
--   POST /harvests/inventory/in 此前恒返回 true，但实际是**新造一条台账**而不是累加到
--   已有台账 —— 种子 DEMO-INVT-004 的库位是 'M-01-01'，调用方不传 locationCode，
--   旧 findLedger 此时拼 WHERE location_code IS NULL，永远命中不到，于是走新建分支。
--   后果：同批次同仓库出现 N 条台账，列表里同一批次重复出现，「当前库存」不再唯一。
--
-- 代码侧已修（commit 5710b778）：不传库位 = 不关心库位，按 批次+仓库 唯一定位，
--   读-改-写加 FOR UPDATE。本迁移是**第二道防线**：把不变量固化到 DB，
--   使任何绕过 Service 的写入路径（脚本、后续新端点）也无法再制造重复行。
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 三个必须写清楚、否则后面一定有人踩的设计点
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1) 为什么 location_code 必须先改成 NOT NULL DEFAULT ''
--    MySQL 的唯一索引把 NULL 视为「互不相同」：uk(b, w, NULL) 可以插入无数条，
--    约束等于没有。而我们刚好有一种合法场景是「不指定库位」——
--    所以把它归一化为 NOT NULL DEFAULT ''，用空串表达「未指定库位」，
--    唯一索引才真正生效。代码侧同步用 normalizeLocation() 把 null/空白 落成 ''。
--
-- 2) 为什么唯一键里带 deleted
--    本项目既有惯例（V3__produce_iot_extension.sql:95
--    uk_iot_binding_device_target (device_id, bind_type, bind_target_id, deleted)）。
--    逻辑删除表若不加 deleted，删除后重建同库位会直接撞键、写不进去。
--
-- 3) 带 deleted 之后的新问题：为什么必须有「复活」逻辑
--    uk(..., deleted) 意味着同一三元组**最多 1 条在用 + 1 条已删除**。
--    第二次「删除台账 → 同库位再入库」时，(b, w, loc, 1) 已经有一条，
--    再插一条 deleted=1 就撞键 → 500。
--    因此 InventoryService#insertOrResurrect 在插入前先查墓碑行，
--    命中就 UPDATE 复活（deleted=0 并清零数量）再 updateById，而不是 INSERT。
--    **DB 约束与代码复活必须成对存在**：只加约束 = 把静默 bug 变成 500；
--    只做复活不加约束 = 约束不住绕过 Service 的写入。
--
-- 前置校验（本迁移编写时实测，agri_core）：
--   location_code IS NULL 的行数 = 0
--   (batch_id, warehouse_name, location_code) 在 deleted=0 内的重复组数 = 0
--   (batch_id, warehouse_name, location_code, deleted) 全局重复组数 = 0
-- 若 ADD UNIQUE KEY 报 Duplicate entry，说明期间有新造的重复行，
-- 处理口径：先把重复行 SELECT 出来留档，保留 current_qty 最大的一条，其余删除，再重跑。

-- -------------------------------------------- 1. 库位归一化：NULL → 空串
UPDATE prod_inventory
SET location_code = ''
WHERE location_code IS NULL;

-- -------------------------------------------- 2. 改为 NOT NULL DEFAULT ''
ALTER TABLE prod_inventory
    MODIFY COLUMN location_code VARCHAR(32) NOT NULL DEFAULT '' COMMENT '库位编号（空串表示未指定库位）';

-- -------------------------------------------- 3. 库位唯一约束
ALTER TABLE prod_inventory
    ADD UNIQUE KEY uk_inventory_slot (batch_id, warehouse_name, location_code, deleted);
