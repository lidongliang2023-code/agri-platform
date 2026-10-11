-- ------------------------------------------------ V21 补 prod_fs_circulation_anomaly.handle_remark
--
-- 缺陷（V19 遗漏，实测暴露）：
--   P16 的处置请求体是 {action, remark} 两个字段，V19 建 prod_fs_circulation_anomaly 时
--   只落了 handle_by / handle_time，漏了 handle_remark；而实体 CirculationAnomalyEntity
--   声明了 handleRemark 字段。后果是**该表所有读写都失败**：
--   MyBatis-Plus 的 selectPage/updateById 都会带上该列，MySQL 报
--   `Unknown column 'handle_remark' in 'field list'` → 接口 500。
--   实测：GET /circulation 与 POST /circulation/{id}/handle 均 500。
--
--   同类问题在 V19 里对 prod_fs_alert 已经处理（该表建表时就带了 handle_remark），
--   本次属漏加，故按 Flyway 硬规矩走新版本，不回改 V19（改已应用迁移会引发
--   `Migration checksum mismatch` 让应用起不来）。
--
-- 幂等：MySQL 8 不支持 ADD COLUMN IF NOT EXISTS，用 information_schema 判存后动态执行。

SET @col_exists := (
    SELECT COUNT(*)
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'prod_fs_circulation_anomaly'
       AND column_name = 'handle_remark'
);

SET @ddl := IF(@col_exists = 0,
    'ALTER TABLE prod_fs_circulation_anomaly
        ADD COLUMN handle_remark VARCHAR(200) NULL COMMENT ''处置说明（与处置方式分开存，便于审计追溯）'' AFTER measure',
    'SELECT 1');

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
