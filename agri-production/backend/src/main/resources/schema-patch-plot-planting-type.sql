-- 补丁：地块表补「种植类型」列（1 露天 2 大棚 3 水田 4 山地；可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-plot-planting-type.sql
--
-- 为什么现在加：产品确认要保留「种植类型」，而本服务地块表一直没有这一列 ——
-- 之前 PC 表单提交了也被 PlotSaveDTO 丢弃，列表还用默认值 1 把每块地都显示成「露天」。
-- 存量行**不回填**（平台侧没有对应列，不猜）：保持 NULL、页面显示「—」；
-- 新建/编辑时由表单写入真实值。
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_plot_info'
        AND COLUMN_NAME = 'planting_type') = 0,
  'ALTER TABLE agri_prod_plot_info ADD COLUMN planting_type TINYINT NULL COMMENT ''种植类型：1 露天 2 大棚 3 水田 4 山地''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
