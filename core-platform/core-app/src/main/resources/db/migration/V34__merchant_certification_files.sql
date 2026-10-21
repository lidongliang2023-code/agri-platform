-- ------------------------------------------------ V34 企业认证材料文件
--
-- 企业主体认证除文字资料外，还需要营业执照、法人身份证人像面/国徽面。
-- 文件本身保存在 uploads（生产应替换为私有对象存储），本表仅保存受控下载地址。
-- 地址由服务端生成，不能由前端任意指定；提交认证时服务端会再次校验文件归属。
--
-- MySQL 没有 ADD COLUMN IF NOT EXISTS，沿用 V27/V28 的 information_schema 幂等写法。

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'business_license_url');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant_certification` ADD COLUMN `business_license_url` VARCHAR(500) NULL COMMENT ''营业执照照片地址'' AFTER `attach_note`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'legal_person_id_front_url');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant_certification` ADD COLUMN `legal_person_id_front_url` VARCHAR(500) NULL COMMENT ''法人身份证人像面照片地址'' AFTER `business_license_url`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'legal_person_id_back_url');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant_certification` ADD COLUMN `legal_person_id_back_url` VARCHAR(500) NULL COMMENT ''法人身份证国徽面照片地址'' AFTER `legal_person_id_front_url`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
