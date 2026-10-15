-- 补丁：用户端消息中心的演示数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-message-notify.sql
--
-- 内容由平台库 agri_core.prod_message_notify 的演示行机械转换而来（6 条）：
--   farm_id 由 DEMO-FARM-xxx 映射成本库农场主键、tenant_id 统一 2001，其余照抄。
-- 刻意**排除**平台侧的 MSGN202610091416505466（标题 verify-tmp）：那是联调留下的测试行，
-- 搬进来只会在消息中心多出一条叫 "verify-tmp" 的消息。
-- 未读 4 条（001 土壤含水量告警 / 004 田间水位超限 / 005 认证临期提醒 / 006 溶解氧偏低），
-- 头部角标与「未读消息」分类都靠这个数，改演示数据时注意别把它清零。

INSERT IGNORE INTO agri_prod_message_notify
    (message_id, tenant_id, farm_id, receiver_id, msg_type, title, content, biz_id, link_path,
     read_flag, sent_at, read_at, channel, status, create_time, update_time, deleted)
VALUES
    ('DEMO-MSG-001', '2001', '1', 'DEMO-MEM-001', 'ALERT', '土壤含水量告警', 'A区连栋大棚土壤含水量 15.2%，低于 18% 阈值，请及时灌溉', 'DEMO-ALERT-001', NULL, 0, '2026-10-08 14:21:00', NULL, 'INBOX', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MSG-002', '2001', '1', 'DEMO-MEM-002', 'TASK', '新农事任务派发', '您有一条新的打药任务：C区辣椒疫病统防，请于 9 月 10 日前完成', 'DEMO-TASK-007', NULL, 1, '2026-08-26 09:10:00', '2026-08-26 10:02:00', 'INBOX', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MSG-003', '2001', '1', 'DEMO-MEM-001', 'QUALITY', '检测报告已出具', '批次 DEMO-BATCHN-001 农药残留检测结论为合格，报告已归档', 'DEMO-INSP-001', NULL, 1, '2026-06-30 09:20:00', '2026-06-30 11:00:00', 'INBOX', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MSG-004', '2001', '2', 'DEMO-MEM-004', 'ALERT', '田间水位超限', '东片区水位 138.5cm，超过 120cm 警戒线，请注意排水', 'DEMO-ALERT-007', NULL, 0, '2026-10-08 22:11:00', NULL, 'INBOX', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MSG-005', '2001', '3', 'DEMO-MEM-006', 'SYSTEM', '认证临期提醒', '本农场绿色食品认证将于 90 天后到期，请提前准备换证材料', NULL, NULL, 0, '2026-09-25 08:00:00', NULL, 'INBOX', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MSG-006', '2001', '5', 'DEMO-MEM-011', 'ALERT', '溶解氧偏低', '稻渔区1号田溶解氧 3.2mg/L，已低于安全阈值，请开启增氧设备', 'DEMO-ALERT-018', NULL, 0, '2026-10-06 23:41:00', NULL, 'SMS', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);
