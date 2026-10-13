-- ------------------------------------------------ V25 绑定表补 market_id
--
-- 缺口（实测）：core-platform 按 ADR-005「market_id 内建于核心实体、框架层统一注入」
-- 给核心实体的**每次查询自动追加 market_id = 当前市场**。V24 建的
-- platform_user_merchant 没有这一列，于是新接口一调就报
--   Unknown column 'market_id' in 'where clause'
-- （不是 SQL 写错，是平台约定的列缺了）。
--
-- 所以这里不是"可选优化"，而是这张表要成为核心实体就必须补：
--   ① 加列；② V24 里手写的演示绑定必须补 market_id —— 它们走 SQL 直插、
--   绕过了框架注入，不补就会因为 market_id 为 NULL 而**查不出来**
--   （表现为"明明绑定了、解析接口却返回空"）。
--
-- 【为什么写成条件式，而不是直接 ALTER】
-- MySQL 不支持 ADD COLUMN IF NOT EXISTS，而 ALTER 重复执行会因
-- "Duplicate column name" 失败 —— Flyway 在启动阶段跑迁移，失败即启动失败，
-- 也就是下一次正常启动会把整个平台带崩。这条迁移在开发中已被手工执行过一次，
-- 所以必须写成"先查 information_schema 再执行"：手工跑过、没跑过都能通过。

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_user_merchant' AND COLUMN_NAME = 'market_id'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `platform_user_merchant` ADD COLUMN `market_id` BIGINT NULL COMMENT ''市场ID（ADR-005，框架层统一注入）'' AFTER `merchant_id`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_user_merchant' AND INDEX_NAME = 'idx_market'
);
SET @ddl2 := IF(@idx_exists = 0,
  'CREATE INDEX `idx_market` ON `platform_user_merchant` (`market_id`)',
  'SELECT 1');
PREPARE stmt2 FROM @ddl2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 演示绑定补市场号（只补本迁移造的那两条，id 区间 9000-9099）
UPDATE `platform_user_merchant` SET `market_id` = 1 WHERE `market_id` IS NULL AND `id` BETWEEN 9000 AND 9099;
