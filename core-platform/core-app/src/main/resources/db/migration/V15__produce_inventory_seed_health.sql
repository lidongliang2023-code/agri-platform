-- 库存台账演示种子口径修正（只改 5 行种子数据，不建表、不改结构）
--
-- 为什么单独开一个 V15 而不是回头改 V14：
--   V14 已经在开发库应用过了，Flyway 会对已应用迁移做**校验和校验**。
--   改 V14 的文件内容会让 `Validate failed: Migration checksum mismatch for
--   migration version 14` 在启动时抛出，进而 `flywayInitializer` 建不出来、
--   `userMapper → adminUserInitializer` 连带失败，**整个应用起不来**
--   （本轮实测踩到过）。已应用的迁移一律不再编辑，修正走新版本，这是 Flyway 的硬规矩。
--
-- 修的是什么：
--   V14 里 5 条种子手填的 health_status / safe_qty / expire_date 与后端
--   InventoryService#resolveHealth 的实际输出对不上。该算法的顺序是
--   「不足（≤安全库存一半）> 临期（≤3 天到期）> 预警（≤安全库存）> 正常」，
--   而 V14 手填时把 001/002 的保质期写在了过去（2026-08-28 / 2026-08-26），
--   003 的 safe_qty 又填成了 500（620 > 500，算法算 normal 而不是手填的 warning）。
--   结果是「种子说一套、写操作重算后接口回读说另一套」—— 正是本项目反复在治的口径打架。
--
-- 修完之后四种健康状态各有一例，且与算法一致：
--   001 normal    5400 远高于安全库存 200，保质期 2027-06-30
--   002 expiring  保质期 2026-10-12，距今 ≤ 3 天
--   003 warning   620 介于安全库存 1000 与其一半 500 之间
--   004 normal    96000 远高于安全库存 1000，保质期 2027-10-08
--   005 shortage  80 ≤ 安全库存 800 的一半 400
--
-- 幂等：全部是按主键的 UPDATE，重复执行结果一致。
-- 只作用于 DEMO-INVT-% 演示行，不触碰任何真实业务台账。

UPDATE prod_inventory
   SET expire_date   = '2027-06-30',
       health_status = 'normal',
       remark        = '演示数据：番茄批次台账（8600 入库 -3200 出库）'
 WHERE inventory_id = 'DEMO-INVT-001';

UPDATE prod_inventory
   SET expire_date   = '2026-10-12',
       health_status = 'expiring',
       remark        = '演示数据：黄瓜批次台账（5200 入库 -120 报损，临期）'
 WHERE inventory_id = 'DEMO-INVT-002';

UPDATE prod_inventory
   SET safe_qty      = 1000.00,
       expire_date   = '2027-06-30',
       health_status = 'warning',
       remark        = '演示数据：辣椒批次台账（620 介于安全库存 1000 与其一半之间，预警）'
 WHERE inventory_id = 'DEMO-INVT-003';

UPDATE prod_inventory
   SET expire_date   = '2027-10-08',
       health_status = 'normal',
       remark        = '演示数据：稻谷批次台账'
 WHERE inventory_id = 'DEMO-INVT-004';

UPDATE prod_inventory
   SET expire_date   = '2027-06-30',
       health_status = 'shortage',
       remark        = '演示数据：辣椒批次台账（冻结 200kg，80 不足安全库存 800 的一半）'
 WHERE inventory_id = 'DEMO-INVT-005';
