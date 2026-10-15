-- 补丁：运营端「生产监控」两个动作要落的状态列（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-monitor-page.sql
--
-- 背景（2026-10-15 做运营端 admin/monitor 这一块）：
--   · 页面 TaskMonitor 的「催办」调 PATCH /admin/monitor/tasks/{id}/urge —— 这个端点
--     **在任何后端都不存在**（core-platform 的 AdminMonitorController 只有几个 GET），
--     也就是按钮点了没有任何真实后果。要让它"真的做了点什么"，就得有地方记"催过几次、最近一次什么时候"；
--   · 页面 IotMonitor 的「重启」调 PATCH /admin/monitor/iot/{id}/reboot —— 同样不存在。
--     本部署没有设备网关，能诚实做到的是**记录一条重启指令**（页面文案也正是"重启指令已下发"），
--     而不是假装设备已经重启。记录要落列，否则"下发"只是嘴上说说。

-- 任务催办痕迹
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_task_info' AND COLUMN_NAME = 'urge_count') = 0,
  'ALTER TABLE agri_prod_task_info ADD COLUMN urge_count INT DEFAULT 0 COMMENT ''累计催办次数''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_task_info' AND COLUMN_NAME = 'last_urge_time') = 0,
  'ALTER TABLE agri_prod_task_info ADD COLUMN last_urge_time DATETIME NULL COMMENT ''最近一次催办时间''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_task_info' AND COLUMN_NAME = 'last_urge_by') = 0,
  'ALTER TABLE agri_prod_task_info ADD COLUMN last_urge_by VARCHAR(191) NULL COMMENT ''最近一次催办人''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 设备重启指令痕迹
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_iot_device' AND COLUMN_NAME = 'reboot_requested_at') = 0,
  'ALTER TABLE agri_prod_iot_device ADD COLUMN reboot_requested_at DATETIME NULL COMMENT ''最近一次重启指令下发时间（待设备侧执行）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
