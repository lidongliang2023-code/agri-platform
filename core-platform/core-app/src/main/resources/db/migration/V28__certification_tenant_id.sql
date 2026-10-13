-- ------------------------------------------------ V28 认证表补 tenant_id
--
-- 缺口（实测）：V27 建的 platform_merchant_certification 漏了 tenant_id，
-- 而平台侧实体基类 BaseEntity 带 tenantId 并在插入时自动填充 ——
-- 于是插一条就报 Unknown column 'tenant_id' in 'field list'，列表接口 500。
--
-- 为什么不是直接改 V27：V27 已经在库里执行过并被 Flyway 记了校验和，
-- 改了会导致下次启动校验和不符、整个平台起不来。已应用的迁移只能往前加。
--
-- 幂等：先查 information_schema 再执行（MySQL 没有 ADD COLUMN IF NOT EXISTS）。

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification' AND COLUMN_NAME = 'tenant_id');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant_certification` ADD COLUMN `tenant_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''多租户预留字段（平台侧 BaseEntity 自带）'' AFTER `market_id`',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
