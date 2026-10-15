-- 补丁：补齐「继承 BaseEntity 但表里缺列」的几张表（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-baseentity-columns.sql
--
-- 背景（2026-10-15）：扫雷脚本 check-entity-columns 原先只看实体文件里**自己声明**的字段，
-- 而大多数实体写的是 `extends BaseEntity` —— 基类映射的 tenant_id / farm_id / create_by /
-- create_time / update_by / update_time / deleted 会出现在每一条 SELECT/INSERT 里。
-- 把基类的列也算进来之后，立刻多出 4 处**此前完全看不见**的缺列：
--
--   · agri_prod_alert_rule      缺 farm_id      → 查告警规则直接 500（探针里那条 GET /alerts/rules → 500 就是它）
--   · agri_prod_emergency_plan  缺 farm_id      → 查应急预案列表 500（本轮做运营端时实测踩到）
--   · agri_prod_sop_template    缺 farm_id      → 查 SOP 模板 500
--   · agri_prod_sensor_data     缺 create_by / update_by / update_time / deleted
--                                               → 传感器数据读写 500
--
-- 这四处都是"表比实体窄"：实体是契约（谁在用它就按它写 SQL），表补上即可。
-- 这些列在平台级数据上留 NULL 是正常的（不是每张表都有农场维度）。

-- 各表补 farm_id（与 BaseEntity.farmId 对应）
SET @tables := 'agri_prod_alert_rule,agri_prod_emergency_plan,agri_prod_sop_template';

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_alert_rule' AND COLUMN_NAME = 'farm_id') = 0,
  'ALTER TABLE agri_prod_alert_rule ADD COLUMN farm_id BIGINT NULL COMMENT ''所属农场（规则可按农场限定；平台级规则留空）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_emergency_plan' AND COLUMN_NAME = 'farm_id') = 0,
  'ALTER TABLE agri_prod_emergency_plan ADD COLUMN farm_id BIGINT NULL COMMENT ''所属农场（平台级预案留空）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sop_template' AND COLUMN_NAME = 'farm_id') = 0,
  'ALTER TABLE agri_prod_sop_template ADD COLUMN farm_id BIGINT NULL COMMENT ''所属农场（平台级模板留空）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 传感器数据表缺的是审计四列
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sensor_data' AND COLUMN_NAME = 'create_by') = 0,
  'ALTER TABLE agri_prod_sensor_data ADD COLUMN create_by TEXT NULL',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sensor_data' AND COLUMN_NAME = 'update_by') = 0,
  'ALTER TABLE agri_prod_sensor_data ADD COLUMN update_by TEXT NULL',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sensor_data' AND COLUMN_NAME = 'update_time') = 0,
  'ALTER TABLE agri_prod_sensor_data ADD COLUMN update_time DATETIME DEFAULT CURRENT_TIMESTAMP',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_sensor_data' AND COLUMN_NAME = 'deleted') = 0,
  'ALTER TABLE agri_prod_sensor_data ADD COLUMN deleted BIGINT DEFAULT 0',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
