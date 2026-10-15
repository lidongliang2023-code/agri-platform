-- 补丁：预警域（预警记录 / 应急预案）的缺列（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-alert-page.sql
--
-- 背景（2026-10-15 扫雷脚本 check-entity-columns 报出的 11 处不一致之一）：
-- 实体 AlertRecord / EmergencyPlan 映射的列在表里**不存在** —— 一调就是
-- "Unknown column"。其中 alert_type 与 farm_id 不是"将来才用"的字段：
-- AlertRecordMapper.xml 的 pageQuery 现在就按这两列过滤（<if test="dto.alertType ..."> AND alert_type = ...），
-- 也就是说预警列表这条查询在**当前代码**下就会 1054 失败，不只是切流风险。
--
-- 为什么是"补列"而不是"删字段"：AlertRecordVO 是接口出参，包含 ruleCode / alertType /
-- farmId / plotId / unit / remark / emergencyPlanId —— 它们是页面契约的一部分（农场、地块、单位
-- 都要展示），删实体字段等于把接口悄悄减项。
--
-- 应急预案（agri_prod_emergency_plan）另有一半是"两代脚手架同名不同列"，处理方式不同，见 schema-mysql.sql
-- 该表段落末尾的说明：那 4 个同义列改由实体映射到旧列，不新增重复列；这里只补真正没有对应物的 4 列。

-- ---------------------------------------------------------------- 预警记录：补 7 列
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_alert_record' AND COLUMN_NAME = 'rule_code') = 0,
  'ALTER TABLE agri_prod_alert_record ADD COLUMN rule_code VARCHAR(64) NULL COMMENT ''规则编码（冗余，便于列表直接展示）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_alert_record' AND COLUMN_NAME = 'alert_type') = 0,
  'ALTER TABLE agri_prod_alert_record ADD COLUMN alert_type VARCHAR(64) NULL COMMENT ''预警类型；列表按此筛选''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_alert_record' AND COLUMN_NAME = 'farm_id') = 0,
  'ALTER TABLE agri_prod_alert_record ADD COLUMN farm_id BIGINT NULL COMMENT ''所属农场''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_alert_record' AND COLUMN_NAME = 'plot_id') = 0,
  'ALTER TABLE agri_prod_alert_record ADD COLUMN plot_id BIGINT NULL COMMENT ''所属地块''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_alert_record' AND COLUMN_NAME = 'unit') = 0,
  'ALTER TABLE agri_prod_alert_record ADD COLUMN unit VARCHAR(32) NULL COMMENT ''指标单位（阈值/实测值共用）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_alert_record' AND COLUMN_NAME = 'remark') = 0,
  'ALTER TABLE agri_prod_alert_record ADD COLUMN remark TEXT NULL COMMENT ''备注''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_alert_record' AND COLUMN_NAME = 'emergency_plan_id') = 0,
  'ALTER TABLE agri_prod_alert_record ADD COLUMN emergency_plan_id BIGINT NULL COMMENT ''命中的应急预案''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 列表按 alert_type 过滤，加索引（表当前 0 行，加索引无代价）
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_alert_record' AND INDEX_NAME = 'idx_alert_record_type') = 0,
  'ALTER TABLE agri_prod_alert_record ADD INDEX idx_alert_record_type (alert_type)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------- 应急预案：补 4 列（另 4 个同义列走实体映射）
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_emergency_plan' AND COLUMN_NAME = 'steps_json') = 0,
  'ALTER TABLE agri_prod_emergency_plan ADD COLUMN steps_json TEXT NULL COMMENT ''处置步骤（结构化 JSON；与 response_steps 的纯文本互为两种形态）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_emergency_plan' AND COLUMN_NAME = 'related_parties') = 0,
  'ALTER TABLE agri_prod_emergency_plan ADD COLUMN related_parties TEXT NULL COMMENT ''联动单位/相关方''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_emergency_plan' AND COLUMN_NAME = 'execute_count') = 0,
  'ALTER TABLE agri_prod_emergency_plan ADD COLUMN execute_count INT DEFAULT 0 COMMENT ''已执行次数''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_emergency_plan' AND COLUMN_NAME = 'last_execute_time') = 0,
  'ALTER TABLE agri_prod_emergency_plan ADD COLUMN last_execute_time DATETIME NULL COMMENT ''最近一次执行时间''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
