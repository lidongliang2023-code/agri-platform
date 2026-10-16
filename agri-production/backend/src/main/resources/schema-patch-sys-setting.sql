-- 补丁：用户端系统设置（参数配置）的演示数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-sys-setting.sql
--
-- 内容由平台库 agri_core.prod_sys_setting 的演示行机械转换而来（4 条）。
-- 刻意只搬 DEMO-SET-*：平台库里另有 38 条 setting_key 为空的行（早期探针空体 POST 的产物），
-- 搬进来会在参数配置页多出 38 行"键为空"的配置项。

INSERT IGNORE INTO agri_prod_sys_setting
    (setting_id, tenant_id, farm_id, setting_group, setting_key, setting_name, setting_value,
     default_value, value_type, remark, status, create_time, update_time, deleted)
VALUES
    ('DEMO-SET-001', '2001', NULL, 'ALERT', 'DEMO.alert.notifyChannels', '告警通知渠道', '["INBOX","SMS","WECHAT"]', '["INBOX"]', 'JSON', '演示数据：告警默认推送渠道', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-SET-002', '2001', NULL, 'ALERT', 'DEMO.alert.quietHours', '告警免打扰时段', '22:00-06:00', '23:00-06:00', 'STRING', '演示数据：免打扰不阻断 CRITICAL', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-SET-003', '2001', NULL, 'TRACE', 'DEMO.trace.autoActivate', '溯源码自动激活', 'true', 'false', 'BOOLEAN', '演示数据：采收后是否自动激活码', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-SET-004', '2001', NULL, 'QUALITY', 'DEMO.quality.passThreshold', '农残合格判定阈值', '0.05', '0.05', 'NUMBER', '演示数据：单位 mg/kg', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);
