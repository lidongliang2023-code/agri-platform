-- 补丁：演示告警数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-alert-demo.sql
--
-- 为什么需要它（2026-10-15）：运营端「告警中心」与「灾害事件复盘」两个页面的数据源都是告警
-- （复盘页的列表就是"已处置告警"，页面只认带 alertId 的行）。而 agri_prod_alert_record **一行都没有**，
-- core-platform 侧有 20 条演示告警 —— 直接把 /admin/alerts 切过来，这两个页面会从"有数据"变成"空列表"。
--
-- 内容口径沿用 core-platform 的演示告警集（同样的事件与处置说明），但**引用改成本库能对上的键**：
--   · farm_id / plot_id 用本库的农场与地块 id（本库只有 3 个演示地块）；
--   · 设备编码、处置人放到 source_name / handle_user 这类文本列（本库的 source_id 是 BIGINT，
--     装不下 'DEMO-DEV-001' 这种业务编码 —— 硬塞会得到一个"看起来有值其实对不上"的引用）。
-- 因此条数少于 core 的 20 条：对不上引用的那几条没有搬（宁缺，不编一个假引用）。

INSERT IGNORE INTO agri_prod_alert_record
    (id, alert_code, rule_id, rule_code, alert_type, level, source_type, source_name,
     farm_id, plot_id, title, content, value, unit, status, handle_time, handle_user,
     handle_result, remark, tenant_id, create_time, update_time, deleted)
VALUES
    (1, 'DEMO-ALERT-001', 1, 'R001', 'soil', 'important', 'environment', 'DEMO-DEV-001',
     1, 1, 'A区连栋大棚土壤含水量低于阈值', '土壤含水量 15.2%，低于下限 18%', 15.2000, '%',
     'PENDING', NULL, NULL, NULL, '演示数据：来源为平台演示告警集', '2001', '2026-10-08 14:20:00', '2026-10-08 14:20:00', 0),
    (2, 'DEMO-ALERT-002', 2, 'R002', 'temperature', 'normal', 'environment', 'DEMO-DEV-001',
     1, 1, 'A区连栋大棚棚内温度持续偏高', '棚内空气温度 37.8℃，高于上限 35℃', 37.8000, '℃',
     'HANDLING', '2026-10-07 11:40:00', 'DEMO-MEM-002', '已开启顶窗与遮阳网，棚温回落至 31 度',
     '演示数据：来源为平台演示告警集', '2001', '2026-10-07 11:05:00', '2026-10-07 11:40:00', 0),
    (3, 'DEMO-ALERT-003', NULL, NULL, 'pest', 'normal', 'pest', NULL,
     1, 2, 'B区露天菜田监测到霜霉病高发风险', '病情指数 42.5，超过防治指标 30', 42.5000, NULL,
     'HANDLED', '2026-10-05 15:10:00', 'DEMO-MEM-002', '已完成一次吡唑醚菌酯叶面喷施',
     '演示数据：来源为平台演示告警集', '2001', '2026-10-05 08:30:00', '2026-10-05 15:10:00', 0),
    (4, 'DEMO-ALERT-004', NULL, NULL, 'device', 'info', 'device', 'DEMO-DEV-002',
     1, 1, 'A区光照传感器数据异常跳变', '光照强度读数在 3 分钟内由 0 跳到 68000 lux', 0.0000, 'lux',
     'IGNORED', '2026-10-04 09:00:00', 'DEMO-MEM-003', '重启后读数恢复正常，判定为瞬时干扰',
     '演示数据：来源为平台演示告警集', '2001', '2026-10-03 19:45:00', '2026-10-04 09:00:00', 0),
    (5, 'DEMO-ALERT-005', NULL, NULL, 'input', 'critical', 'input', NULL,
     1, NULL, 'C区地块检出超安全间隔期用药', '距上次施药仅 2 天，未满 7 天安全间隔期', 2.0000, '天',
     'PENDING', NULL, NULL, NULL, '演示数据：来源为平台演示告警集', '2001', '2026-10-09 07:15:00', '2026-10-09 07:15:00', 0),
    (6, 'DEMO-ALERT-006', NULL, NULL, 'task', 'info', 'task', NULL,
     1, 1, '番茄采收任务逾期未完成', '计划完成日 2026-09-30，当前已逾期 3 天', 3.0000, '天',
     'HANDLED', '2026-10-01 16:30:00', 'DEMO-MEM-001', '已重新排期至 10 月 12 日',
     '演示数据：来源为平台演示告警集', '2001', '2026-10-01 09:00:00', '2026-10-01 16:30:00', 0),
    (7, 'DEMO-ALERT-007', NULL, NULL, 'environment', 'normal', 'environment', NULL,
     2, 3, '东片区田间水位超过警戒线', '田间水位 138.5mm，超过警戒线 120mm', 138.5000, 'mm',
     'PENDING', NULL, NULL, NULL, '演示数据：来源为平台演示告警集', '2001', '2026-10-08 22:10:00', '2026-10-08 22:10:00', 0),
    (8, 'DEMO-ALERT-008', NULL, NULL, 'environment', 'important', 'environment', NULL,
     2, 3, '西片区持续降雨积水', '24 小时降雨量 68.4mm，田间出现积水', 68.4000, 'mm',
     'HANDLING', '2026-10-06 12:00:00', 'DEMO-MEM-005', '已开启排水闸，积水正在下降',
     '演示数据：来源为平台演示告警集', '2001', '2026-10-06 05:30:00', '2026-10-06 12:00:00', 0),
    (9, 'DEMO-ALERT-009', NULL, NULL, 'pest', 'info', 'pest', NULL,
     2, 3, '东片区稻瘟病监测点病情上升', '病情指数 28.6，周环比 +12', 28.6000, NULL,
     'HANDLED', '2026-09-29 09:30:00', 'DEMO-MEM-004', '组织无人机统防统治一次',
     '演示数据：来源为平台演示告警集', '2001', '2026-09-28 10:20:00', '2026-09-29 09:30:00', 0),
    (10, 'DEMO-ALERT-010', NULL, NULL, 'device', 'critical', 'device', 'DEMO-DEV-004',
     2, 3, '北片区网关设备离线', '心跳间隔 900 秒，超过阈值 300 秒', 900.0000, 's',
     'HANDLED', '2026-09-20 10:40:00', 'DEMO-MEM-005', '更换网关电源模块后恢复在线',
     '演示数据：来源为平台演示告警集', '2001', '2026-09-20 03:15:00', '2026-09-20 10:40:00', 0),
    (11, 'DEMO-ALERT-011', NULL, NULL, 'environment', 'info', 'environment', 'DEMO-DEV-005',
     3, NULL, '1号日光温室 CO2 浓度偏低', '棚内 CO2 浓度 342ppm，低于下限 400ppm', 342.0000, 'ppm',
     'HANDLED', '2026-10-07 09:20:00', 'DEMO-MEM-007', '调整为间断通风模式，浓度已回升',
     '演示数据：来源为平台演示告警集', '2001', '2026-10-07 08:00:00', '2026-10-07 09:20:00', 0),
    (12, 'DEMO-ALERT-012', NULL, NULL, 'device', 'normal', 'device', 'DEMO-DEV-005',
     3, NULL, '2号日光温室 CO2 传感器离线', '心跳间隔 720 秒，超过阈值 300 秒', 720.0000, 's',
     'PENDING', NULL, NULL, NULL, '演示数据：来源为平台演示告警集', '2001', '2026-10-09 06:45:00', '2026-10-09 06:45:00', 0);
