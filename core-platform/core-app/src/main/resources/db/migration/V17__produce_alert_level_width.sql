-- =============================================================================
-- V17　枚举词表迁移（PRD 8.1.2）第 1 步：列宽 widen
-- =============================================================================
--
-- 【为什么必须先做这一步】
--   目标词表（PRD 8.1.2）四档为 info / normal / important / urgent，
--   其中 `important` 是 **9 个字符**，而 alert_level 当前是 **varchar(8)**。
--   若先写值再改列宽，MySQL 在非严格模式下会把 'important'
--   **静默截断成 'importan'** —— 只发 warning，不报错，前端因此永远匹配不上。
--   这正是本项目反复在治的那类错误，所以 widen 必须独立成一个版本、先于改值执行。
--
-- 【为什么选 16 而不是 9】
--   最长目标值 9 字符，取 16 留出 7 字符余量，避免以后再加档位又要再来一次
--   迁移（迁移版本一旦应用就不可再编辑，见 V14 的教训）。
--
-- 【顺序依赖 —— 回滚时必须反着来】
--   迁移顺序：V17 改列宽 → V18/V19 改值
--   回滚顺序：先执行 backup-enum-vocab.sh 产出的回滚文件把新值改回旧值 → 再缩列宽。
--   若先缩回 varchar(8)，回滚文件里的 'important' 会被静默截断成 'importan'，
--   原值丢失且不报错。
--
-- 【字符集/排序规则必须显式写出】
--   MODIFY COLUMN 不写 CHARACTER SET / COLLATE 时会取表默认，虽然这里恰好相同，
--   但显式写出可以把「列宽变更」与「排序规则意外变更」解耦——
--   本项目是 utf8mb4_0900_ai_ci（大小写不敏感），一旦跑偏会让断言结果失真
--   （'INFO' = 'info' 为真），所以断言一律要带 COLLATE utf8mb4_bin。
--
-- 【prod_task_info.status 不在本版本内】
--   它是 varchar(20)，目标词表最长 9 字符（cancelled / executing），装得下，无需 widen。
-- =============================================================================

ALTER TABLE prod_alert_info
    MODIFY COLUMN alert_level VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL
        COMMENT '告警级别 info/normal/important/urgent（PRD 8.1.2）';

ALTER TABLE prod_alert_rule
    MODIFY COLUMN alert_level VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL
        COMMENT '告警级别 info/normal/important/urgent（PRD 8.1.2）';

ALTER TABLE prod_iot_alert
    MODIFY COLUMN level VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL
        COMMENT '告警级别 info/normal/important/urgent（PRD 8.1.2）';
