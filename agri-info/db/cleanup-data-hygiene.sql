-- ============================================================================
-- 信息资讯 / 交易撮合 · 数据卫生清理（可重复执行）
--
-- 背景：
--   1. e2e 脚本造完数据后调 DELETE /api/trade/product/{id}，MyBatis-Plus 走的是
--      逻辑删除（del_flag=1），记录仍留在表里，跑多了会积累成噪音。
--   2. 交易端删商品不会通知信息端，info_sd_contact 里对应的联系方式会变成孤儿：
--      商品查不到了，联系方式还挂着。不影响展示，但会一直涨。
--
-- 用法：
--   "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -uroot -proot \
--     --default-character-set=utf8mb4 < agri-info/db/cleanup-data-hygiene.sql
--
-- 注意：只删「测试数据」和「孤儿联系方式」，不动任何真实业务数据。
-- ============================================================================

-- 临时表建在 agri_trade 下，避免 "No database selected"
USE agri_trade;

-- ---------- 1. 物理清除 e2e 遗留的软删测试商品（含从属的图片/SKU） ----------
-- 只匹配脚本固定命名的测试数据，真实商品不会命中。
SELECT COUNT(*) INTO @n_test_products FROM agri_trade.agri_trade_product
WHERE del_flag = 1
  AND product_name REGEXP '回归|闭环验证|审核台|联系方式回归|同源商品|联调|手工验证|持久化验证';

CREATE TEMPORARY TABLE tmp_test_products AS
SELECT id FROM agri_trade.agri_trade_product
WHERE del_flag = 1
  AND product_name REGEXP '回归|闭环验证|审核台|联系方式回归|同源商品|联调|手工验证|持久化验证';

DELETE FROM agri_trade.agri_trade_product_image WHERE product_id IN (SELECT id FROM tmp_test_products);
DELETE FROM agri_trade.agri_trade_product_sku   WHERE product_id IN (SELECT id FROM tmp_test_products);
DELETE FROM agri_trade.agri_trade_product       WHERE id         IN (SELECT id FROM tmp_test_products);

SELECT '清理软删测试商品' AS step, @n_test_products AS rows_affected;
DROP TEMPORARY TABLE tmp_test_products;

-- ---------- 2. 物理清除 e2e 遗留的软删测试需求 ----------
SELECT COUNT(*) INTO @n_test_demands FROM agri_trade.agri_trade_demand
WHERE del_flag = 1
  AND demand_name REGEXP '回归|闭环验证|测试';
DELETE FROM agri_trade.agri_trade_demand
WHERE del_flag = 1
  AND demand_name REGEXP '回归|闭环验证|测试';
SELECT '清理软删测试需求' AS step, @n_test_demands AS rows_affected;

-- ---------- 3. 清理 info_sd_contact 孤儿记录 ----------
-- 对应的商品/需求已被删除（或已软删），联系方式留着也没有任何入口能看到。
SELECT COUNT(*) INTO @n_orphan_contact FROM agri_info.info_sd_contact c
WHERE (c.trade_type = 'product' AND NOT EXISTS (
          SELECT 1 FROM agri_trade.agri_trade_product p
          WHERE p.id = c.trade_id AND p.del_flag = 0))
   OR (c.trade_type = 'demand' AND NOT EXISTS (
          SELECT 1 FROM agri_trade.agri_trade_demand d
          WHERE d.id = c.trade_id AND d.del_flag = 0));

DELETE c FROM agri_info.info_sd_contact c
WHERE (c.trade_type = 'product' AND NOT EXISTS (
          SELECT 1 FROM agri_trade.agri_trade_product p
          WHERE p.id = c.trade_id AND p.del_flag = 0))
   OR (c.trade_type = 'demand' AND NOT EXISTS (
          SELECT 1 FROM agri_trade.agri_trade_demand d
          WHERE d.id = c.trade_id AND d.del_flag = 0));
SELECT '清理孤儿联系方式' AS step, @n_orphan_contact AS rows_affected;

-- ---------- 4. 清理 info_sd_message 孤儿留言 ----------
-- 需求侧留言的 sd_id 是交易端需求 id，需求没了留言就是孤儿。
SELECT COUNT(*) INTO @n_orphan_msg FROM agri_info.info_sd_message m
WHERE NOT EXISTS (SELECT 1 FROM agri_trade.agri_trade_demand d WHERE d.id = m.sd_id);

DELETE FROM agri_info.info_sd_message m
WHERE NOT EXISTS (SELECT 1 FROM agri_trade.agri_trade_demand d WHERE d.id = m.sd_id);
SELECT '清理孤儿留言' AS step, @n_orphan_msg AS rows_affected;

-- ---------- 5. 体检 ----------
SELECT '在架商品' AS item, COUNT(*) AS total FROM agri_trade.agri_trade_product WHERE del_flag = 0
UNION ALL SELECT '软删商品残留', COUNT(*) FROM agri_trade.agri_trade_product WHERE del_flag = 1
UNION ALL SELECT '在架需求',     COUNT(*) FROM agri_trade.agri_trade_demand  WHERE del_flag = 0
UNION ALL SELECT '软删需求残留', COUNT(*) FROM agri_trade.agri_trade_demand  WHERE del_flag = 1
UNION ALL SELECT 'info_sd_contact', COUNT(*) FROM agri_info.info_sd_contact
UNION ALL SELECT 'info_sd_message', COUNT(*) FROM agri_info.info_sd_message;
