-- 补丁：IoT 演示数据 + 设备表补平台标识列（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-iot-demo.sql
--
-- 为什么要这一批：
--   1) agri_prod_iot_device 原先只有 3 台本地演示设备（DEV001~003），而页面上的设备台账来自平台侧
--      （prod_iot_device 的 10 台 DEMO-DEV-*）。本轮把 IoT 段切到本服务，页面读的就是本表 ——
--      不搬这 10 台，设备列表会从 10 台变成 3 台（切流变成了"丢数据"）。
--   2) 新增 platform_device_id 列（与农场表的 platform_farm_id 同法）：绑定/指令/维修记录里出现的是
--      平台侧标识 DEMO-DEV-xxx，靠这一列换算成本服务设备主键，否则这些记录在页面上永远挂不上设备。
--   3) 绑定/指令/维修三张新表的演示行由 agri_core 的同名演示表**机械转换**而来：
--      device_id 一律按 platform_device_id 换算成本地主键（子查询，取不到即报错，不静默少插）。
--      绑定对象（地块）仍写平台侧标识 DEMO-PLOT-xxx：地块主数据收敛属另一轮（见处置方案第六节）。
--
-- 排除项：agri_core 这几张表里还有**探针空体写入**留下的垃圾行（device_id 形如 DEVC2026...、DEV-B1、
-- DEV-TEST-01、TEST-ONLINE-*），一律按 DEMO- 前缀过滤掉 —— 它们不是演示数据。
--
-- 数量：设备 10 台、绑定 10 条、指令 4 条、维修 3 条。

-- 1) 设备表补平台标识列（守卫式 ALTER：列已存在则不动）
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_iot_device'
        AND COLUMN_NAME = 'platform_device_id') = 0,
  'ALTER TABLE agri_prod_iot_device ADD COLUMN platform_device_id VARCHAR(64) NULL COMMENT ''平台侧设备标识（DEMO-DEV-xxx）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_iot_device'
        AND INDEX_NAME = 'uk_iot_device_platform_id') = 0,
  'ALTER TABLE agri_prod_iot_device ADD UNIQUE KEY uk_iot_device_platform_id (platform_device_id)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1b) 设备表补"页面口径的地块标识"列（同样守卫式）：设备列表的"关联地块"列按这一列去页面地块名映射里查
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_iot_device'
        AND COLUMN_NAME = 'plot_ref') = 0,
  'ALTER TABLE agri_prod_iot_device ADD COLUMN plot_ref VARCHAR(64) NULL COMMENT ''地块标识（页面口径，如 DEMO-PLOT-001）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) 演示设备（device_code 唯一，INSERT IGNORE 可重复执行）
INSERT IGNORE INTO agri_prod_iot_device
    (device_code, device_name, device_type, device_model, manufacturer, firmware_version,
     install_date, status, last_online_time, farm_id, platform_device_id, plot_ref, tenant_id, is_enabled)
VALUES
    ('DEMO-DEVC-001', 'A区土壤墒情站', 'SENSOR', 'HW-SM200', '华维传感', 'v2.4.1', '2025-11-12 00:00:00', 'online', '2026-10-10 08:55:00', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-001'), 'DEMO-DEV-001', 'DEMO-PLOT-001', '2001', 1),
    ('DEMO-DEVC-002', 'A区环境监测站', 'SENSOR', 'HW-TH500', '华维传感', 'v2.4.1', '2025-11-12 00:00:00', 'online', '2026-10-10 08:56:00', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-001'), 'DEMO-DEV-002', 'DEMO-PLOT-001', '2001', 1),
    ('DEMO-DEVC-003', 'B区虫情测报灯', 'SENSOR', 'JD-PS15', '佳多科工', 'v1.8.0', '2026-03-20 00:00:00', 'online', '2026-10-10 08:50:00', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-001'), 'DEMO-DEV-003', 'DEMO-PLOT-002', '2001', 1),
    ('DEMO-DEVC-004', '稻田水位监测站', 'SENSOR', 'XY-WL100', '鑫源物联', 'v3.0.2', '2025-08-05 00:00:00', 'online', '2026-10-10 08:58:00', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-002'), 'DEMO-DEV-004', 'DEMO-PLOT-006', '2001', 1),
    ('DEMO-DEVC-005', '1号温室环境监控', 'SENSOR', 'LY-GH300', '鲁仪物联网', 'v2.1.7', '2025-09-18 00:00:00', 'online', '2026-10-10 08:52:00', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-003'), 'DEMO-DEV-005', 'DEMO-PLOT-010', '2001', 1),
    ('DEMO-DEVC-006', '1号温室卷帘控制器', 'CONTROLLER', 'LY-CT220', '鲁仪物联网', 'v1.5.3', '2025-09-18 00:00:00', 'offline', '2026-10-06 16:20:00', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-003'), 'DEMO-DEV-006', 'DEMO-PLOT-010', '2001', 1),
    ('DEMO-DEVC-007', '牧草区土壤氮素站', 'SENSOR', 'XN-NP200', '芯农电子', 'v1.2.9', '2026-04-02 00:00:00', 'online', '2026-10-10 08:40:00', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-004'), 'DEMO-DEV-007', 'DEMO-PLOT-016', '2001', 1),
    ('DEMO-DEVC-008', '舍饲区氨气监测仪', 'SENSOR', 'XN-GS110', '芯农电子', 'v1.2.9', '2026-04-02 00:00:00', 'offline', '2026-10-09 04:20:00', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-004'), 'DEMO-DEV-008', 'DEMO-PLOT-018', '2001', 1),
    ('DEMO-DEVC-009', '稻渔区水质监测浮标', 'SENSOR', 'MC-WQ600', '淼测科技', 'v4.0.0', '2026-05-11 00:00:00', 'online', '2026-10-10 08:59:00', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-005'), 'DEMO-DEV-009', 'DEMO-PLOT-019', '2001', 1),
    ('DEMO-DEVC-010', '花卉A棚摄像头', 'CAMERA', 'HS-IP712', '海视云', 'v2.9.4', '2025-12-01 00:00:00', 'offline', '2026-09-30 21:10:00', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-006'), 'DEMO-DEV-010', 'DEMO-PLOT-023', '2001', 1);

-- 2b) 已存在的设备行补齐"页面口径地块标识"（INSERT IGNORE 不会更新已有行，这里显式同步一次）
UPDATE agri_prod_iot_device SET plot_ref = 'DEMO-PLOT-001' WHERE platform_device_id = 'DEMO-DEV-001' AND (plot_ref IS NULL OR plot_ref <> 'DEMO-PLOT-001');
UPDATE agri_prod_iot_device SET plot_ref = 'DEMO-PLOT-001' WHERE platform_device_id = 'DEMO-DEV-002' AND (plot_ref IS NULL OR plot_ref <> 'DEMO-PLOT-001');
UPDATE agri_prod_iot_device SET plot_ref = 'DEMO-PLOT-002' WHERE platform_device_id = 'DEMO-DEV-003' AND (plot_ref IS NULL OR plot_ref <> 'DEMO-PLOT-002');
UPDATE agri_prod_iot_device SET plot_ref = 'DEMO-PLOT-006' WHERE platform_device_id = 'DEMO-DEV-004' AND (plot_ref IS NULL OR plot_ref <> 'DEMO-PLOT-006');
UPDATE agri_prod_iot_device SET plot_ref = 'DEMO-PLOT-010' WHERE platform_device_id = 'DEMO-DEV-005' AND (plot_ref IS NULL OR plot_ref <> 'DEMO-PLOT-010');
UPDATE agri_prod_iot_device SET plot_ref = 'DEMO-PLOT-010' WHERE platform_device_id = 'DEMO-DEV-006' AND (plot_ref IS NULL OR plot_ref <> 'DEMO-PLOT-010');
UPDATE agri_prod_iot_device SET plot_ref = 'DEMO-PLOT-016' WHERE platform_device_id = 'DEMO-DEV-007' AND (plot_ref IS NULL OR plot_ref <> 'DEMO-PLOT-016');
UPDATE agri_prod_iot_device SET plot_ref = 'DEMO-PLOT-018' WHERE platform_device_id = 'DEMO-DEV-008' AND (plot_ref IS NULL OR plot_ref <> 'DEMO-PLOT-018');
UPDATE agri_prod_iot_device SET plot_ref = 'DEMO-PLOT-019' WHERE platform_device_id = 'DEMO-DEV-009' AND (plot_ref IS NULL OR plot_ref <> 'DEMO-PLOT-019');
UPDATE agri_prod_iot_device SET plot_ref = 'DEMO-PLOT-023' WHERE platform_device_id = 'DEMO-DEV-010' AND (plot_ref IS NULL OR plot_ref <> 'DEMO-PLOT-023');

-- 3) 演示绑定关系（device_id 换算成本地主键；解绑时间留空 = 从未解绑）
INSERT IGNORE INTO agri_prod_iot_binding
    (binding_id, device_id, device_code, device_name, bind_type, bind_target_id, bind_target_name,
     metrics, frequency, status, bound_at, unbound_at, tenant_id)
VALUES
    ('DEMO-BIND-001', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-001'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-001'), (SELECT device_name FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-001'), 'PLOT', 'DEMO-PLOT-001', 'A区连栋大棚', 'soil_moisture,soil_temperature', 30, 'BOUND', '2025-11-12 10:00:00', NULL, '2001'),
    ('DEMO-BIND-002', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-002'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-002'), (SELECT device_name FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-002'), 'PLOT', 'DEMO-PLOT-001', 'A区连栋大棚', 'temperature,humidity,light', 15, 'BOUND', '2025-11-12 10:05:00', NULL, '2001'),
    ('DEMO-BIND-003', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-003'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-003'), (SELECT device_name FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-003'), 'PLOT', 'DEMO-PLOT-002', 'B区露天菜田', 'pest_count', 60, 'BOUND', '2026-03-20 09:00:00', NULL, '2001'),
    ('DEMO-BIND-004', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-004'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-004'), (SELECT device_name FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-004'), 'PLOT', 'DEMO-PLOT-006', '智慧稻田东片区', 'water_level', 30, 'BOUND', '2025-08-05 14:00:00', NULL, '2001'),
    ('DEMO-BIND-005', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-005'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-005'), (SELECT device_name FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-005'), 'PLOT', 'DEMO-PLOT-010', '1号日光温室', 'temperature,humidity,co2', 15, 'BOUND', '2025-09-18 11:00:00', NULL, '2001'),
    ('DEMO-BIND-006', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-006'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-006'), (SELECT device_name FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-006'), 'PLOT', 'DEMO-PLOT-010', '1号日光温室', 'curtain_position', 10, 'PAUSED', '2025-09-18 11:10:00', NULL, '2001'),
    ('DEMO-BIND-007', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-007'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-007'), (SELECT device_name FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-007'), 'PLOT', 'DEMO-PLOT-016', '牧草种植区A', 'nitrogen,soil_moisture', 60, 'BOUND', '2026-04-02 10:00:00', NULL, '2001'),
    ('DEMO-BIND-008', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-008'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-008'), (SELECT device_name FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-008'), 'PLOT', 'DEMO-PLOT-018', '舍饲养殖区', 'ammonia,temperature', 15, 'BOUND', '2026-04-02 10:10:00', NULL, '2001'),
    ('DEMO-BIND-009', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-009'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-009'), (SELECT device_name FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-009'), 'PLOT', 'DEMO-PLOT-019', '稻渔综合区1号田', 'dissolved_oxygen,ph,temperature', 30, 'BOUND', '2026-05-11 09:00:00', NULL, '2001'),
    ('DEMO-BIND-010', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-010'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-010'), (SELECT device_name FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-010'), 'PLOT', 'DEMO-PLOT-023', '花卉A棚', 'snapshot', 120, 'UNBOUND', '2025-12-01 15:00:00', NULL, '2001');

-- 4) 演示指令记录（状态与回执照抄平台侧演示行：那是"平台侧判定过"的终态，不是本服务的下发结果）
INSERT IGNORE INTO agri_prod_iot_command
    (command_id, device_id, device_code, command_type, params, operator, status, receipt,
     send_at, receipt_at, tenant_id)
VALUES
    ('DEMO-CMD-001', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-006'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-006'), 'VALVE_SWITCH', '{"open":true,"durationSec":600}', 'DEMO-MEM-007', 'SUCCESS', '{"code":0,"msg":"ok"}', '2026-09-28 07:30:00', '2026-09-28 07:30:08', '2001'),
    ('DEMO-CMD-002', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-006'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-006'), 'READING', '{"metric":"curtain_position"}', 'DEMO-MEM-007', 'SUCCESS', '{"code":0,"v":80}', '2026-09-28 07:35:00', '2026-09-28 07:35:06', '2001'),
    ('DEMO-CMD-003', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-008'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-008'), 'REBOOT', '{}', 'DEMO-MEM-009', 'FAILED', '{"code":-1,"msg":"timeout"}', '2026-10-09 04:50:00', '2026-10-09 04:50:35', '2001'),
    ('DEMO-CMD-004', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-001'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-001'), 'READING', '{"metric":"soil_moisture"}', 'DEMO-MEM-002', 'PENDING', NULL, '2026-10-10 08:30:00', NULL, '2001');

-- 5) 演示维修记录
INSERT IGNORE INTO agri_prod_iot_maintenance
    (maintain_id, device_id, device_code, maintain_type, content, operator, maintain_at, result,
     next_maintain_at, tenant_id)
VALUES
    ('DEMO-MAIN-001', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-001'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-001'), 'CALIBRATE', '土壤含水率探头标定，更换检定证书到期部件', '华维售后', '2026-04-18 10:00:00', '标定合格，误差 ≤1.5%', NULL, '2001'),
    ('DEMO-MAIN-002', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-004'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-004'), 'REPLACE', '水位计超声波探头老化，整体更换', '鑫源售后', '2026-06-22 14:30:00', '更换后读数与人工水尺一致', NULL, '2001'),
    ('DEMO-MAIN-003', (SELECT id FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-008'), (SELECT device_code FROM agri_prod_iot_device WHERE platform_device_id = 'DEMO-DEV-008'), 'REPAIR', '氨气监测仪离线排查，更换电源模块', '芯农售后', '2026-10-09 11:20:00', '设备仍不稳定，需进一步返修', NULL, '2001');
