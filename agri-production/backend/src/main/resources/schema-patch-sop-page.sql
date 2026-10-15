-- 补丁：SOP（作业标准）两张表的缺列（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-sop-page.sql
--
-- 判据差异（2026-10-15 处理扫雷脚本报出的 11 处不一致时定的口径）：
--   · **表根本不存在**的实体（ProdPlot / Facility / SoilRecord / TestRecord / TestTask / TraceRecord / Tenant）
--     → 按"从来没落过地"处理，连同其 controller/service/mapper 一起删（可随时从 git 恢复）；
--   · **表存在、但列落后于实体**的（本文件的两张、以及预警域两张）
--     → 按"功能起过头但没做完"处理，把 schema 对齐到实体。
--   SOP 属于后者：表早就建了，而实体声明的列（步骤 JSON、适用作物/季节、版本、使用次数…）一个都没有。
--
-- 另一半是"两代脚手架同名不同列"，处理方式与预警域一致：**改实体映射到已有列，不新增重复列**
-- （列名只影响 SQL，不影响接口出参字段名）。对应关系见 SopTemplate / SopExecution 类注释。

-- ---------------------------------------------------------------- 作业标准模板：补 7 列
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_template' AND COLUMN_NAME = 'category') = 0,
  'ALTER TABLE agri_prod_sop_template ADD COLUMN category VARCHAR(64) NULL COMMENT ''标准分类''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_template' AND COLUMN_NAME = 'applicable_crops') = 0,
  'ALTER TABLE agri_prod_sop_template ADD COLUMN applicable_crops TEXT NULL COMMENT ''适用作物（多值）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_template' AND COLUMN_NAME = 'applicable_seasons') = 0,
  'ALTER TABLE agri_prod_sop_template ADD COLUMN applicable_seasons TEXT NULL COMMENT ''适用季节（多值）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_template' AND COLUMN_NAME = 'steps_json') = 0,
  'ALTER TABLE agri_prod_sop_template ADD COLUMN steps_json TEXT NULL COMMENT ''步骤（结构化 JSON）；纯文本形态复用已有的 steps 列''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_template' AND COLUMN_NAME = 'required_materials') = 0,
  'ALTER TABLE agri_prod_sop_template ADD COLUMN required_materials TEXT NULL COMMENT ''所需物料（与 required_tools 的"工具"区分开）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_template' AND COLUMN_NAME = 'version') = 0,
  'ALTER TABLE agri_prod_sop_template ADD COLUMN version INT DEFAULT 1 COMMENT ''版本号''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_template' AND COLUMN_NAME = 'usage_count') = 0,
  'ALTER TABLE agri_prod_sop_template ADD COLUMN usage_count INT DEFAULT 0 COMMENT ''被引用/下发次数''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------- 作业执行记录：补 5 列
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_execution' AND COLUMN_NAME = 'template_code') = 0,
  'ALTER TABLE agri_prod_sop_execution ADD COLUMN template_code VARCHAR(64) NULL COMMENT ''模板编码（冗余，便于按编码检索）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_execution' AND COLUMN_NAME = 'task_id') = 0,
  'ALTER TABLE agri_prod_sop_execution ADD COLUMN task_id BIGINT NULL COMMENT ''关联农事任务''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_execution' AND COLUMN_NAME = 'total_steps') = 0,
  'ALTER TABLE agri_prod_sop_execution ADD COLUMN total_steps INT DEFAULT 0 COMMENT ''总步骤数（与 current_step 配对算进度）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_execution' AND COLUMN_NAME = 'actual_duration') = 0,
  'ALTER TABLE agri_prod_sop_execution ADD COLUMN actual_duration INT NULL COMMENT ''实际耗时（分钟）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_execution' AND COLUMN_NAME = 'attachments') = 0,
  'ALTER TABLE agri_prod_sop_execution ADD COLUMN attachments TEXT NULL COMMENT ''附件（图片/文件 URL 列表）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
