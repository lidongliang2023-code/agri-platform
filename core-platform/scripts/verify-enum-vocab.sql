-- =============================================================================
-- 枚举词表迁移 —— 迁移后校验（只读，无任何写操作）
-- =============================================================================
--
-- 【这是什么】
--   词表迁移（V16 列宽 / V17 任务状态 / V18 告警级别）执行后跑一遍，
--   用可判定的断言确认「数据真的按新词表落库了」，而不是只看迁移没报错。
--
-- 【为什么断言不写进 Flyway 迁移】
--   Flyway 里写断言很别扭（失败只能抛异常让整个应用起不来，且看不到实际值）。
--   做成独立 SQL 手动跑，能把 actual / expect / verdict 三列一起打出来，
--   一眼看出差在哪。
--
-- 【执行方式】
--   MYSQL_PWD=<口令> mysql -uroot -h127.0.0.1 agri_core \
--       --default-character-set=utf8mb4 --table < core-platform/scripts/verify-enum-vocab.sql
--
-- 【判读】
--   verdict 列全为 PASS 才算迁移完成。出现 FAIL 按 actual 列定位。
--   INFO 行是「已知项」而非失败，用于人工核对，不要当成 FAIL。
--
-- 【为什么断言都限定 deleted=0】
--   prod_alert_rule 有 3 行 deleted=1 的数字残留（alert_level='3'/'4'，
--   rule_name 为 __probe__ / __secrash2d-* 探针）。它们是别人的测试残留、
--   不是业务数据，既定处置是**保持原样不清理**（不制造无法复原的删除）。
--   若不排除，第 3 条断言会恒为 FAIL，掩盖真问题。
-- =============================================================================

SET NAMES utf8mb4;

-- =============================================================================
-- 第一部分：断言（verdict 必须全 PASS）
-- =============================================================================

-- ⚠️⚠️ 最关键的一条：所有字符串断言必须 COLLATE utf8mb4_bin（大小写敏感）
--
--   本库 alert_level / status 的排序规则是 utf8mb4_0900_ai_ci（ai = accent
--   insensitive、ci = case insensitive）。实测：
--       SELECT 'INFO' = 'info';                       -> 1（真）
--       SELECT 'INFO' COLLATE utf8mb4_bin = 'info';   -> 0（假）
--
--   后果：朴素写法 `alert_level NOT IN ('urgent','important','normal','info')`
--   会把 'INFO' 当成已经等于 'info'、把 'URGENT' 当成已经等于 'urgent'，
--   于是迁移前实测只报 11 行非法（真实是 20 行）—— **漏掉的那 9 行正是
--   INFO(6) 和 URGENT(3)**。
--   更危险的是：如果迁移只跑了 WARN→normal / CRITICAL→important 两条、
--   INFO/URGENT 漏跑，朴素断言会直接报 0 = PASS，把「做了一半」判成「做完了」。
--
--   所以下面每条字符串比较都显式 COLLATE utf8mb4_bin。GROUP BY 同理，
--   否则 'info' 与 'INFO' 会被合并成一组，看不到半迁移状态。

SELECT
    'A1 告警表级别最大长度 ≤ 9'                    AS chk,
    IFNULL(MAX(CHAR_LENGTH(alert_level)), 0)      AS actual,
    '≤ 9'                                        AS expect,
    IF(IFNULL(MAX(CHAR_LENGTH(alert_level)), 0) <= 9, 'PASS', 'FAIL') AS verdict
  FROM prod_alert_info
UNION ALL
SELECT
    'A2 告警表非法级别值 = 0（区分大小写）',
    COUNT(*),
    '0',
    IF(COUNT(*) = 0, 'PASS', 'FAIL')
  FROM prod_alert_info
 WHERE deleted = 0
   AND alert_level COLLATE utf8mb4_bin NOT IN ('urgent', 'important', 'normal', 'info')
UNION ALL
SELECT
    'A3 规则表非法级别值 = 0（区分大小写，排除 deleted=1 探针残留）',
    COUNT(*),
    '0',
    IF(COUNT(*) = 0, 'PASS', 'FAIL')
  FROM prod_alert_rule
 WHERE deleted = 0
   AND alert_level COLLATE utf8mb4_bin NOT IN ('urgent', 'important', 'normal', 'info')
UNION ALL
SELECT
    'A4 任务表非法状态值 = 0（区分大小写）',
    COUNT(*),
    '0',
    IF(COUNT(*) = 0, 'PASS', 'FAIL')
  FROM prod_task_info
 WHERE status COLLATE utf8mb4_bin NOT IN ('pending', 'assigned', 'executing', 'completed',
                                          'suspended', 'cancelled', 'expired', 'rejected')
UNION ALL
SELECT
    'A8 告警表无残留大写形式（旧词表已清空）',
    COUNT(*),
    '0',
    IF(COUNT(*) = 0, 'PASS', 'FAIL')
  FROM prod_alert_info
 WHERE deleted = 0
   AND alert_level COLLATE utf8mb4_bin IN ('INFO', 'WARN', 'CRITICAL', 'URGENT')
UNION ALL
SELECT
    'A9 任务表无残留旧状态（doing/done 已清空）',
    COUNT(*),
    '0',
    IF(COUNT(*) = 0, 'PASS', 'FAIL')
  FROM prod_task_info
 WHERE status COLLATE utf8mb4_bin IN ('doing', 'done')
UNION ALL
SELECT
    'A5 告警表列宽 ≥ 16（V16 已生效）',
    IFNULL(CHARACTER_MAXIMUM_LENGTH, 0),
    '≥ 16',
    IF(IFNULL(CHARACTER_MAXIMUM_LENGTH, 0) >= 16, 'PASS', 'FAIL')
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'prod_alert_info'
   AND COLUMN_NAME = 'alert_level'
UNION ALL
SELECT
    'A6 规则表列宽 ≥ 16（V16 已生效）',
    IFNULL(CHARACTER_MAXIMUM_LENGTH, 0),
    '≥ 16',
    IF(IFNULL(CHARACTER_MAXIMUM_LENGTH, 0) >= 16, 'PASS', 'FAIL')
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'prod_alert_rule'
   AND COLUMN_NAME = 'alert_level'
UNION ALL
SELECT
    'A7 IoT 告警表列宽 ≥ 16（V16 已生效）',
    IFNULL(CHARACTER_MAXIMUM_LENGTH, 0),
    '≥ 16',
    IF(IFNULL(CHARACTER_MAXIMUM_LENGTH, 0) >= 16, 'PASS', 'FAIL')
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME = 'prod_iot_alert'
   AND COLUMN_NAME = 'level';

-- =============================================================================
-- 第二部分：分布对照（人工核对，期望值与迁移前实测一一对应）
-- =============================================================================
--
-- 零漂移映射的验收核心：**每一档的行数和配色都不变**，只是串换了写法。
--   INFO 6 行 -> info      (编码 1 蓝)
--   WARN 7 行 -> normal    (编码 2 黄)
--   CRITICAL 6 行 -> important (编码 3 橙)
--   URGENT 3 行 -> urgent  (编码 4 红)
-- 若下面任何一档行数对不上，说明映射写错了，立刻走回滚文件。

-- 期望值（迁移前实测基线，2026-10-10 15:45）：
--   prod_alert_info(deleted=0)：INFO 6 -> info 6 / WARN 7 -> normal 7 /
--                               CRITICAL 4 -> important 4 / URGENT 3 -> urgent 3
--   prod_alert_rule(deleted=0)：CRITICAL 1 / INFO 2 / URGENT 1 / WARN 2
--   prod_task_info：pending 2 / assigned 2 / doing 2 -> executing 2 /
--                   done 7 -> completed 7 / rejected 1
-- 注意：这三张表被多个并发线读写，行数会漂移；跑之前先确认基线，
--       不要拿这份注释里的数字当断言依据（断言只看第一部分 A1~A9）。

-- 注：下面 SELECT 的 val 列必须也写 COLLATE utf8mb4_bin，否则在
--     sql_mode=only_full_group_by 下会报 ERROR 1055（SELECT 列表与 GROUP BY
--     表达式不一致），本文件会在中途断掉、后面的残留检查就跑不到了。
SELECT 'prod_alert_info 级别分布' AS item,
       alert_level COLLATE utf8mb4_bin AS val, COUNT(*) AS cnt
  FROM prod_alert_info WHERE deleted = 0 GROUP BY alert_level COLLATE utf8mb4_bin
UNION ALL SELECT 'prod_alert_rule 级别分布',
       alert_level COLLATE utf8mb4_bin, COUNT(*)
  FROM prod_alert_rule WHERE deleted = 0 GROUP BY alert_level COLLATE utf8mb4_bin
UNION ALL SELECT 'prod_task_info 状态分布',
       status COLLATE utf8mb4_bin, COUNT(*)
  FROM prod_task_info GROUP BY status COLLATE utf8mb4_bin
 ORDER BY item, val;

-- =============================================================================
-- 第三部分：已知残留（INFO，不是 FAIL）
-- =============================================================================
--
-- prod_alert_rule 里 deleted=1 的数字残留，既定处置是保持原样不清理。
-- 期望恒为 3 行；如果变成别的数，说明有人又写了探针或有人清理过，需要问清归属。

SELECT 'prod_alert_rule deleted=1 数字残留（期望 3，不清理）' AS item,
       alert_level AS val,
       COUNT(*) AS cnt
  FROM prod_alert_rule
 WHERE deleted = 1
   AND alert_level NOT IN ('urgent', 'important', 'normal', 'info', 'WARN', 'CRITICAL', 'URGENT', 'INFO')
 GROUP BY alert_level;

-- =============================================================================
-- 第四部分：代码侧回归提示（本文件查不到，需人工/接口验证）
-- =============================================================================
--
-- 数据对了不等于功能对了。迁移**必须**与下列代码改动同批次上线，否则：
--   * AlertDict.levelOf/codeOfLevel 不认新串 -> AlertVO.alertLevel 变 null
--     -> 前端 LEVEL_MAP[null] -> 有 ?? 兜底不崩，但所有级别显示「—」（静默退化）
--   * AdminAlertService:118 / AdminDashboardService:129 的统计循环 -> 全部归 0
--   * AdminAlertService:183 紧急告警筛选 -> 0 行
--   * satellite-iot IngestService:37 -> 继续灌旧值
-- 上线后请实测：GET /admin/dashboard/alert-trend、GET /admin/alerts/stats、
--             GET /admin/alerts/emergency，确认不是空/零。
