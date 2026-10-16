-- 补丁：地块表补"作物品种"列并从平台侧回填（切 /plots 段的前置；可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-plot-variety.sql
--
-- 为什么要它：页面 Plot 契约里有 cropVariety（如"普罗旺斯""南粳9108"），而本服务地块表没有这一列；
-- 不补的话切 /plots 之后地块列表的"作物"列会全空。品种是平台侧**实有**的数据（prod_plot_info.crop_variety），
-- 属于机械回填；与之相对，current_crop（作物名称）平台侧没有对应列，仍留空、不编。
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_plot_info'
        AND COLUMN_NAME = 'crop_variety') = 0,
  'ALTER TABLE agri_prod_plot_info ADD COLUMN crop_variety VARCHAR(100) NULL COMMENT ''作物品种（页面 cropVariety）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 跨库回填：两库排序规则不同，连接条件必须显式统一 COLLATE，否则报 Illegal mix of collations
UPDATE agri_prod_plot_info p
JOIN agri_core.prod_plot_info c
  ON c.plot_id COLLATE utf8mb4_unicode_ci = p.platform_plot_id COLLATE utf8mb4_unicode_ci
SET p.crop_variety = c.crop_variety
WHERE p.platform_plot_id IS NOT NULL
  AND c.deleted = 0
  AND (p.crop_variety IS NULL OR p.crop_variety = '');
