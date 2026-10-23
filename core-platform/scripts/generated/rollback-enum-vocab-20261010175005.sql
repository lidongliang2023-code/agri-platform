-- =============================================================================
-- 枚举词表迁移回滚文件
-- 生成时间: 2026-10-10 17:50:11
-- 生成脚本: core-platform/scripts/backup-enum-vocab.sh
-- 来源库:   agri_core@127.0.0.1
--
-- 【回滚顺序依赖 —— 必读】
--   ⚠️ 必须先执行本文件（把新值改回旧值），**再**回滚列宽 V17。
--      目标词表里 important 是 9 字符，当前列宽是 varchar(8)；
--      若先缩列宽，本文件里的 'important' 会被静默截断成 'importan'，
--      原值丢失且不报错。
--
-- 【执行方式】
--   MYSQL_PWD=<口令> mysql -uroot -h127.0.0.1 agri_core --default-character-set=utf8mb4 < 本文件
--
-- 【覆盖范围与预期条数】
--   prod_task_info.status          （任务状态，8.1.1）        预期 14 条
--   prod_alert_info.alert_level    （告警级别，告警表，8.1.2）预期 22 条
--   prod_alert_rule.alert_level    （告警级别，规则表）       预期 8 条
--   合计预期 44 条
-- =============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------- 1. 任务状态
UPDATE prod_task_info SET status='done' WHERE task_id='DEMO-TASK-001';
UPDATE prod_task_info SET status='done' WHERE task_id='DEMO-TASK-002';
UPDATE prod_task_info SET status='done' WHERE task_id='DEMO-TASK-003';
UPDATE prod_task_info SET status='doing' WHERE task_id='DEMO-TASK-004';
UPDATE prod_task_info SET status='done' WHERE task_id='DEMO-TASK-005';
UPDATE prod_task_info SET status='rejected' WHERE task_id='DEMO-TASK-006';
UPDATE prod_task_info SET status='assigned' WHERE task_id='DEMO-TASK-007';
UPDATE prod_task_info SET status='pending' WHERE task_id='DEMO-TASK-008';
UPDATE prod_task_info SET status='done' WHERE task_id='DEMO-TASK-009';
UPDATE prod_task_info SET status='doing' WHERE task_id='DEMO-TASK-010';
UPDATE prod_task_info SET status='done' WHERE task_id='DEMO-TASK-011';
UPDATE prod_task_info SET status='assigned' WHERE task_id='DEMO-TASK-012';
UPDATE prod_task_info SET status='done' WHERE task_id='DEMO-TASK-013';
UPDATE prod_task_info SET status='pending' WHERE task_id='DEMO-TASK-014';

-- ---------------------------------------------------------------- 2. 告警级别（告警表）
UPDATE prod_alert_info SET alert_level='CRITICAL' WHERE alert_id='ALRT202610091143435884';
UPDATE prod_alert_info SET alert_level='CRITICAL' WHERE alert_id='ALRT202610091145562417';
UPDATE prod_alert_info SET alert_level='CRITICAL' WHERE alert_id='DEMO-ALERT-001';
UPDATE prod_alert_info SET alert_level='WARN' WHERE alert_id='DEMO-ALERT-002';
UPDATE prod_alert_info SET alert_level='WARN' WHERE alert_id='DEMO-ALERT-003';
UPDATE prod_alert_info SET alert_level='INFO' WHERE alert_id='DEMO-ALERT-004';
UPDATE prod_alert_info SET alert_level='URGENT' WHERE alert_id='DEMO-ALERT-005';
UPDATE prod_alert_info SET alert_level='INFO' WHERE alert_id='DEMO-ALERT-006';
UPDATE prod_alert_info SET alert_level='WARN' WHERE alert_id='DEMO-ALERT-007';
UPDATE prod_alert_info SET alert_level='CRITICAL' WHERE alert_id='DEMO-ALERT-008';
UPDATE prod_alert_info SET alert_level='INFO' WHERE alert_id='DEMO-ALERT-009';
UPDATE prod_alert_info SET alert_level='URGENT' WHERE alert_id='DEMO-ALERT-010';
UPDATE prod_alert_info SET alert_level='INFO' WHERE alert_id='DEMO-ALERT-011';
UPDATE prod_alert_info SET alert_level='WARN' WHERE alert_id='DEMO-ALERT-012';
UPDATE prod_alert_info SET alert_level='INFO' WHERE alert_id='DEMO-ALERT-013';
UPDATE prod_alert_info SET alert_level='WARN' WHERE alert_id='DEMO-ALERT-014';
UPDATE prod_alert_info SET alert_level='URGENT' WHERE alert_id='DEMO-ALERT-015';
UPDATE prod_alert_info SET alert_level='WARN' WHERE alert_id='DEMO-ALERT-016';
UPDATE prod_alert_info SET alert_level='CRITICAL' WHERE alert_id='DEMO-ALERT-017';
UPDATE prod_alert_info SET alert_level='CRITICAL' WHERE alert_id='DEMO-ALERT-018';
UPDATE prod_alert_info SET alert_level='WARN' WHERE alert_id='DEMO-ALERT-019';
UPDATE prod_alert_info SET alert_level='INFO' WHERE alert_id='DEMO-ALERT-020';

-- ---------------------------------------------------------------- 3. 告警级别（规则表）
-- 注：本表可能含他人探针残留（deleted=1，rule_name 形如 __probe__ / __secrash2d-*）。
--     本文件**一并原样备份**，不清理、不改写 —— 它们不属于本次迁移范围，
--     保持原样是既定处置（断言一律限定 deleted=0）。
UPDATE prod_alert_rule SET alert_level='WARN' WHERE rule_id='DEMO-RULE-001';
UPDATE prod_alert_rule SET alert_level='CRITICAL' WHERE rule_id='DEMO-RULE-002';
UPDATE prod_alert_rule SET alert_level='INFO' WHERE rule_id='DEMO-RULE-003';
UPDATE prod_alert_rule SET alert_level='WARN' WHERE rule_id='DEMO-RULE-004';
UPDATE prod_alert_rule SET alert_level='INFO' WHERE rule_id='DEMO-RULE-005';
UPDATE prod_alert_rule SET alert_level='URGENT' WHERE rule_id='DEMO-RULE-006';
UPDATE prod_alert_rule SET alert_level='CRITICAL' WHERE rule_id='RULE202610091143552084';
UPDATE prod_alert_rule SET alert_level='CRITICAL' WHERE rule_id='RULE202610091146073024';

-- =============================================================================
-- 回滚后自检（执行完上面所有 UPDATE 后跑一遍，应与迁移前的分布完全一致）
--   SELECT status, COUNT(*) FROM prod_task_info GROUP BY status;
--   SELECT alert_level, COUNT(*) FROM prod_alert_info GROUP BY alert_level;
--   SELECT alert_level, COUNT(*) FROM prod_alert_rule GROUP BY alert_level;
-- =============================================================================
