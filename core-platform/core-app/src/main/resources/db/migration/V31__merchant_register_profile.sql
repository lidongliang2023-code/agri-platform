-- ------------------------------------------------ V31 经营主体补注册档案字段
--
-- 背景：统一认证中心注册页按原型采集企业「所属行业 / 企业规模 / 注册地址」与个人「经营类型」。
-- 这些字段属于经营主体档案，原先 platform_merchant 没有对应列；如果不补列，
-- 注册接口只能把它们悄悄丢掉（用户填了但系统没存），这是不能接受的。
--
-- 口径：
--   · member_type   enterprise / personal —— 注册时选择的会员身份，登录时用于校验身份是否匹配；
--   · industry      企业所属行业；
--   · company_size  企业规模；
--   · address       注册地址；
--   · business_type 个人经营类型（家庭农场 / 合作社 / 个体采购户 / 经纪人 / 其他）。
--
-- 已存在的经营主体这些列保持 NULL（历史数据未采集），不影响现有查询与写入。
-- 幂等：先查 information_schema 再执行（MySQL 没有 ADD COLUMN IF NOT EXISTS）。

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant' AND COLUMN_NAME = 'member_type');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant` ADD COLUMN `member_type` VARCHAR(16) NULL COMMENT ''会员身份：enterprise 企业 / personal 个人'' AFTER `type`',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant' AND COLUMN_NAME = 'industry');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant` ADD COLUMN `industry` VARCHAR(64) NULL COMMENT ''所属行业'' AFTER `member_type`',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant' AND COLUMN_NAME = 'company_size');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant` ADD COLUMN `company_size` VARCHAR(32) NULL COMMENT ''企业规模'' AFTER `industry`',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant' AND COLUMN_NAME = 'address');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant` ADD COLUMN `address` VARCHAR(255) NULL COMMENT ''注册地址'' AFTER `company_size`',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant' AND COLUMN_NAME = 'business_type');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant` ADD COLUMN `business_type` VARCHAR(32) NULL COMMENT ''个人经营类型'' AFTER `address`',
  'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
