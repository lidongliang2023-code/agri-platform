-- =====================================================================================
-- 演示数据一键清理脚本（DEMO DATA CLEANUP）
-- =====================================================================================
--
-- 【作用】
--   删除 seed-demo-data.sql 灌入的全部演示数据，让数据库回到"演示数据未灌入"的空态。
--   与种子脚本配对使用：
--       灌入 → core-platform/scripts/seed-demo-data.sql
--       清空 → 本脚本 core-platform/scripts/clean-demo-data.sql
--
-- 【安全性：只删 DEMO- 前缀，绝不误伤真实业务数据】
--   本脚本的全部删除语句都带 `LIKE 'DEMO-xxx-%'` 前缀条件，作用范围被死死限定在
--   种子脚本自己写入的那些行上。以下数据**不受影响**，执行后仍会保留：
--     * 平台账号（platform_user 等平台表，本脚本根本不碰）
--     * 其他同事真机验证写入的记录，例如
--         - prod_quality_lab 里的 LABVFY001 / LABVFY002（无 DEMO- 前缀）
--         - prod_inventory_flow 里调 POST /inventory/{batchId}/out 真实写入的 INVF... 流水
--     * 历史遗留软删数据（如 prod_farm_info 里 deleted=1 的老验证行）
--
-- 【适用环境】
--   仅限本地开发 / 演示 / 验收环境。**禁止在生产库执行。**
--
-- 【执行方式】
--   "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -uroot -proot agri_core \
--       --default-character-set=utf8mb4 < core-platform/scripts/clean-demo-data.sql
--   或：进入 mysql 客户端后执行  source core-platform/scripts/clean-demo-data.sql
--
--   注意：本机 MySQL 实际口令是 root（不是 application.yml 里写的 root123）。
--
-- 【可重复执行】
--   是。全部语句都是幂等的 DELETE，重复执行不会报错、也不会产生副作用
--   （第二次执行时已无匹配行，影响 0 行）。
--
-- 【执行后想恢复演示数据】
--   重新跑一遍种子脚本即可：
--       core-platform/scripts/seed-demo-data.sql
--   种子脚本第 0 节本身也会先执行与本脚本等价的清理，因此直接跑种子脚本同样能"重置"。
--
-- 【表清单来源】
--   下列 39 张表与 seed-demo-data.sql 第 0 节逐行一致。若日后种子脚本新增了表，
--   请同步在此补上对应 DELETE，两边必须保持一致，否则会留下清不干净的残留。
-- =====================================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------- 1. 农场与地块域

DELETE FROM prod_farm_info             WHERE farm_id       LIKE 'DEMO-FARM-%';
DELETE FROM prod_farm_cert             WHERE cert_id       LIKE 'DEMO-CERT-%';
DELETE FROM prod_farm_compliance_check WHERE check_id      LIKE 'DEMO-CHK-%';
DELETE FROM prod_plot_info             WHERE plot_id       LIKE 'DEMO-PLOT-%';
DELETE FROM prod_plot_soil             WHERE soil_id       LIKE 'DEMO-SOIL-%';

-- ----------------------------------------------------------------- 2. 投入品域

DELETE FROM prod_supplier              WHERE supplier_id   LIKE 'DEMO-SUP-%';
DELETE FROM prod_input_info            WHERE input_id      LIKE 'DEMO-INPUT-%';
DELETE FROM prod_input_usage           WHERE usage_id      LIKE 'DEMO-USE-%';
DELETE FROM prod_input_stock_flow      WHERE flow_id       LIKE 'DEMO-FLOW-%';

-- ----------------------------------------------------------------- 3. 计划与农事任务域

DELETE FROM prod_plan_info             WHERE plan_id       LIKE 'DEMO-PLAN-%';
DELETE FROM prod_plan_stage            WHERE stage_id      LIKE 'DEMO-STAGE-%';
DELETE FROM prod_task_info             WHERE task_id       LIKE 'DEMO-TASK-%';
DELETE FROM prod_task_record           WHERE record_id     LIKE 'DEMO-TREC-%';
DELETE FROM prod_task_template         WHERE template_id   LIKE 'DEMO-TPL-%';

-- ----------------------------------------------------------------- 4. 生长与 IoT 域

DELETE FROM prod_growth_record         WHERE record_id     LIKE 'DEMO-GROW-%';
DELETE FROM prod_iot_device            WHERE device_id     LIKE 'DEMO-DEV-%';
DELETE FROM prod_iot_binding           WHERE binding_id    LIKE 'DEMO-BIND-%';
DELETE FROM prod_iot_reading           WHERE reading_id    LIKE 'DEMO-READ-%';
DELETE FROM prod_iot_command           WHERE command_id    LIKE 'DEMO-CMD-%';
DELETE FROM prod_iot_maintenance       WHERE maintain_id   LIKE 'DEMO-MAIN-%';

-- ----------------------------------------------------------------- 5. 告警域

DELETE FROM prod_alert_rule            WHERE rule_id       LIKE 'DEMO-RULE-%';
DELETE FROM prod_alert_info            WHERE alert_id      LIKE 'DEMO-ALERT-%';

-- ----------------------------------------------------------------- 6. 采收 / 库存 / 质量 / 溯源域

DELETE FROM prod_harvest_batch         WHERE batch_id      LIKE 'DEMO-BATCH-%';
DELETE FROM prod_harvest_record        WHERE record_id     LIKE 'DEMO-HARV-%';
DELETE FROM prod_inventory_flow        WHERE flow_id       LIKE 'DEMO-INV-%';
-- 库存台账（V14 新增表）。主键前缀 DEMO-INVT-：与流水的 DEMO-INV- 物理区分，
-- 「DEMO-INV-%」匹配不到「DEMO-INVT-001」，两张表必须各写各的 DELETE。
DELETE FROM prod_inventory             WHERE inventory_id  LIKE 'DEMO-INVT-%';
DELETE FROM prod_inspection            WHERE inspection_id LIKE 'DEMO-INSP-%';
DELETE FROM prod_quality_lab           WHERE lab_id        LIKE 'DEMO-LAB-%';
DELETE FROM prod_trace_code            WHERE batch_no      LIKE 'DEMO-BATCH-%' OR code LIKE 'DEMO-TC-%';
DELETE FROM prod_blockchain_record     WHERE record_id     LIKE 'DEMO-CHAIN-%';

-- ----------------------------------------------------------------- 7. 运营与支撑域

DELETE FROM prod_member                WHERE member_id     LIKE 'DEMO-MEM-%';
DELETE FROM prod_message_notify        WHERE message_id    LIKE 'DEMO-MSG-%';
DELETE FROM prod_sys_setting           WHERE setting_id    LIKE 'DEMO-SET-%';
DELETE FROM prod_analytics_snapshot    WHERE snapshot_id   LIKE 'DEMO-SNAP-%';
DELETE FROM prod_ai_diagnosis          WHERE diagnosis_id  LIKE 'DEMO-AI-%';
DELETE FROM prod_tenant_quota          WHERE quota_id      LIKE 'DEMO-QUOTA-%';
DELETE FROM prod_approval              WHERE approval_id   LIKE 'DEMO-APR-%';
DELETE FROM prod_sop_library           WHERE sop_id        LIKE 'DEMO-SOP-%';
DELETE FROM prod_report_task           WHERE report_id     LIKE 'DEMO-RPT-%';
DELETE FROM prod_knowledge_article     WHERE article_id    LIKE 'DEMO-ART-%';

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================================
-- 清理结果验收：全部应为 0（只读查询，无副作用）
-- =====================================================================================
-- 若下面任何一行不为 0，说明该表还有 DEMO- 前缀残留，需要排查：
--   1) 种子脚本是否新增了表但本脚本没同步补 DELETE
--   2) 是否有别的表也存在 DEMO- 前缀行

SELECT 'prod_farm_info'            AS t, COUNT(*) AS remain FROM prod_farm_info            WHERE farm_id       LIKE 'DEMO-%'
UNION ALL SELECT 'prod_farm_cert',             COUNT(*) FROM prod_farm_cert             WHERE cert_id       LIKE 'DEMO-%'
UNION ALL SELECT 'prod_farm_compliance_check', COUNT(*) FROM prod_farm_compliance_check WHERE check_id      LIKE 'DEMO-%'
UNION ALL SELECT 'prod_plot_info',             COUNT(*) FROM prod_plot_info             WHERE plot_id       LIKE 'DEMO-%'
UNION ALL SELECT 'prod_plot_soil',             COUNT(*) FROM prod_plot_soil             WHERE soil_id       LIKE 'DEMO-%'
UNION ALL SELECT 'prod_supplier',              COUNT(*) FROM prod_supplier              WHERE supplier_id   LIKE 'DEMO-%'
UNION ALL SELECT 'prod_input_info',            COUNT(*) FROM prod_input_info            WHERE input_id      LIKE 'DEMO-%'
UNION ALL SELECT 'prod_input_usage',           COUNT(*) FROM prod_input_usage           WHERE usage_id      LIKE 'DEMO-%'
UNION ALL SELECT 'prod_input_stock_flow',      COUNT(*) FROM prod_input_stock_flow      WHERE flow_id       LIKE 'DEMO-%'
UNION ALL SELECT 'prod_plan_info',             COUNT(*) FROM prod_plan_info             WHERE plan_id       LIKE 'DEMO-%'
UNION ALL SELECT 'prod_plan_stage',            COUNT(*) FROM prod_plan_stage            WHERE stage_id      LIKE 'DEMO-%'
UNION ALL SELECT 'prod_task_info',             COUNT(*) FROM prod_task_info             WHERE task_id       LIKE 'DEMO-%'
UNION ALL SELECT 'prod_task_record',           COUNT(*) FROM prod_task_record           WHERE record_id     LIKE 'DEMO-%'
UNION ALL SELECT 'prod_task_template',         COUNT(*) FROM prod_task_template         WHERE template_id   LIKE 'DEMO-%'
UNION ALL SELECT 'prod_growth_record',         COUNT(*) FROM prod_growth_record         WHERE record_id     LIKE 'DEMO-%'
UNION ALL SELECT 'prod_iot_device',            COUNT(*) FROM prod_iot_device            WHERE device_id     LIKE 'DEMO-%'
UNION ALL SELECT 'prod_iot_binding',           COUNT(*) FROM prod_iot_binding           WHERE binding_id    LIKE 'DEMO-%'
UNION ALL SELECT 'prod_iot_reading',           COUNT(*) FROM prod_iot_reading           WHERE reading_id    LIKE 'DEMO-%'
UNION ALL SELECT 'prod_iot_command',           COUNT(*) FROM prod_iot_command           WHERE command_id    LIKE 'DEMO-%'
UNION ALL SELECT 'prod_iot_maintenance',       COUNT(*) FROM prod_iot_maintenance       WHERE maintain_id   LIKE 'DEMO-%'
UNION ALL SELECT 'prod_alert_rule',            COUNT(*) FROM prod_alert_rule            WHERE rule_id       LIKE 'DEMO-%'
UNION ALL SELECT 'prod_alert_info',            COUNT(*) FROM prod_alert_info            WHERE alert_id      LIKE 'DEMO-%'
UNION ALL SELECT 'prod_harvest_batch',         COUNT(*) FROM prod_harvest_batch         WHERE batch_id      LIKE 'DEMO-%'
UNION ALL SELECT 'prod_harvest_record',        COUNT(*) FROM prod_harvest_record        WHERE record_id     LIKE 'DEMO-%'
UNION ALL SELECT 'prod_inventory_flow',        COUNT(*) FROM prod_inventory_flow        WHERE flow_id       LIKE 'DEMO-%'
UNION ALL SELECT 'prod_inventory',             COUNT(*) FROM prod_inventory             WHERE inventory_id  LIKE 'DEMO-%'
UNION ALL SELECT 'prod_inspection',            COUNT(*) FROM prod_inspection            WHERE inspection_id LIKE 'DEMO-%'
UNION ALL SELECT 'prod_quality_lab',           COUNT(*) FROM prod_quality_lab           WHERE lab_id        LIKE 'DEMO-%'
UNION ALL SELECT 'prod_trace_code',            COUNT(*) FROM prod_trace_code            WHERE batch_no      LIKE 'DEMO-%' OR code LIKE 'DEMO-TC-%'
UNION ALL SELECT 'prod_blockchain_record',     COUNT(*) FROM prod_blockchain_record     WHERE record_id     LIKE 'DEMO-%'
UNION ALL SELECT 'prod_member',                COUNT(*) FROM prod_member                WHERE member_id     LIKE 'DEMO-%'
UNION ALL SELECT 'prod_message_notify',        COUNT(*) FROM prod_message_notify        WHERE message_id    LIKE 'DEMO-%'
UNION ALL SELECT 'prod_sys_setting',           COUNT(*) FROM prod_sys_setting           WHERE setting_id    LIKE 'DEMO-%'
UNION ALL SELECT 'prod_analytics_snapshot',    COUNT(*) FROM prod_analytics_snapshot    WHERE snapshot_id   LIKE 'DEMO-%'
UNION ALL SELECT 'prod_ai_diagnosis',          COUNT(*) FROM prod_ai_diagnosis          WHERE diagnosis_id  LIKE 'DEMO-%'
UNION ALL SELECT 'prod_tenant_quota',          COUNT(*) FROM prod_tenant_quota          WHERE quota_id      LIKE 'DEMO-%'
UNION ALL SELECT 'prod_approval',              COUNT(*) FROM prod_approval              WHERE approval_id   LIKE 'DEMO-%'
UNION ALL SELECT 'prod_sop_library',           COUNT(*) FROM prod_sop_library           WHERE sop_id        LIKE 'DEMO-%'
UNION ALL SELECT 'prod_report_task',           COUNT(*) FROM prod_report_task           WHERE report_id     LIKE 'DEMO-%'
UNION ALL SELECT 'prod_knowledge_article',     COUNT(*) FROM prod_knowledge_article     WHERE article_id    LIKE 'DEMO-%';

-- =====================================================================================
-- 清理完成。需要重新灌入演示数据时执行：core-platform/scripts/seed-demo-data.sql
-- =====================================================================================
