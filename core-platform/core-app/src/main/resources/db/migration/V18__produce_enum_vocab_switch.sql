-- =============================================================================
-- V18　枚举词表数据切换（PRD 8.1.1 任务状态 / 8.1.2 告警级别）第 2 步：改值
-- =============================================================================
--
-- 【为什么是 V18 且属"插队"】
--   TaskStatus / AlertDict 的类注释早已预定词表数据切换为 V18，此前一直空缺。
--   本版本落地时 V19~V23 已应用，**晚于后续版本**执行。Flyway 默认禁止版本倒序，
--   因此应用本版本需一次性带上：--spring.flyway.out-of-order=true
--   落库成功后（库内已有 V18 记录）即可去掉该参数，不再是倒序。
--
-- 【顺序依赖：不得早于 V17】
--   V17 已把 prod_alert_info.alert_level 放宽到 varchar(16)。目标值 'important' 是 9 字符，
--   原 varchar(8) 在非严格模式下会被**静默截断成 'importan'**（只 warning 不报错），
--   前端将永远匹配不上。故改列宽必须先行 —— 本版本只改值。
--
-- 【映射（零漂移：前端数字编码与配色全不变）】
--   任务状态（PRD 8.1.1）：doing → executing、done → completed；
--                          pending / assigned / rejected 语义未变，不动。
--   告警级别（PRD 8.1.2）：INFO → info、WARN → normal、CRITICAL → important、URGENT → urgent。
--
-- 【为什么这次改值不会造成静默归零】
--   库排序规则为 utf8mb4_0900_ai_ci（大小写不敏感），迁后 WHERE alert_level='INFO'
--   依然能命中 'info'，因此尚未改造完的旧查询不会突然查出 0 行；
--   而查询侧（TaskStatus#valuesOf / AlertDict#levelValuesOfName）已提前用 IN (...) 兼容两套写法。
--
-- 【回滚】
--   core-platform/scripts/generated/rollback-enum-vocab-<时间戳>.sql（执行前已由
--   backup-enum-vocab.sh 生成）。回滚顺序必须**先改值、再缩列宽**：
--   若先缩回 varchar(8)，'important' 会被截断成 'importan'，原值丢失且不报错。
--
-- 【幂等】
--   全部为按值匹配的 UPDATE：重复执行时第 2 次匹配 0 行，结果一致。
-- =============================================================================

-- 1) 农事任务状态：doing → executing、done → completed
UPDATE prod_task_info SET status = 'executing' WHERE status = 'doing';
UPDATE prod_task_info SET status = 'completed' WHERE status = 'done';

-- 2) 告警级别（告警台账）
UPDATE prod_alert_info SET alert_level = 'info'      WHERE alert_level = 'INFO';
UPDATE prod_alert_info SET alert_level = 'normal'    WHERE alert_level = 'WARN';
UPDATE prod_alert_info SET alert_level = 'important' WHERE alert_level = 'CRITICAL';
UPDATE prod_alert_info SET alert_level = 'urgent'    WHERE alert_level = 'URGENT';

-- 3) 告警级别（告警规则）
UPDATE prod_alert_rule SET alert_level = 'info'      WHERE alert_level = 'INFO';
UPDATE prod_alert_rule SET alert_level = 'normal'    WHERE alert_level = 'WARN';
UPDATE prod_alert_rule SET alert_level = 'important' WHERE alert_level = 'CRITICAL';
UPDATE prod_alert_rule SET alert_level = 'urgent'    WHERE alert_level = 'URGENT';
