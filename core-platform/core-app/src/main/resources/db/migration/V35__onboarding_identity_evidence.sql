-- ------------------------------------------------ V35 分步注册认证证据
--
-- 个人认证：公安二要素、活体检测是提交审核前的必要前置条件。
-- 企业认证：营业执照、法人扫脸、对公账户打款凭证是提交审核前的必要材料。
--
-- 本地开发环境的公安/活体通道由 agri.auth.identity.verification-mode=dev 模拟；
-- 生产环境必须切换为真实合规服务商，不能把开发态结果当作真实身份核验结果。

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_user_identity` ADD COLUMN `police_verified` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''公安二要素是否通过''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_user_identity'
    AND COLUMN_NAME = 'police_verified'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_user_identity` ADD COLUMN `police_verified_at` DATETIME NULL COMMENT ''公安二要素通过时间'' AFTER `police_verified`',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_user_identity'
    AND COLUMN_NAME = 'police_verified_at'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_user_identity` ADD COLUMN `liveness_verified` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''活体检测是否通过'' AFTER `police_verified_at`',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_user_identity'
    AND COLUMN_NAME = 'liveness_verified'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_user_identity` ADD COLUMN `liveness_verified_at` DATETIME NULL COMMENT ''活体检测通过时间'' AFTER `liveness_verified`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_user_identity'
    AND COLUMN_NAME = 'liveness_verified_at'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_user_identity` ADD COLUMN `verification_channel` VARCHAR(64) NULL COMMENT ''实名认证渠道'' AFTER `liveness_verified_at`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_user_identity'
    AND COLUMN_NAME = 'verification_channel'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `registered_capital` VARCHAR(64) NULL COMMENT ''注册资本''',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'registered_capital'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `legal_person_face_url` VARCHAR(500) NULL COMMENT ''法人扫脸材料地址'' AFTER `legal_person_id_back_url`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'legal_person_face_url'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `legal_person_face_status` VARCHAR(20) NULL COMMENT ''法人扫脸状态'' AFTER `legal_person_face_url`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'legal_person_face_status'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `legal_person_face_at` DATETIME NULL COMMENT ''法人扫脸完成时间'' AFTER `legal_person_face_status`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'legal_person_face_at'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `corporate_bank_name` VARCHAR(128) NULL COMMENT ''对公账户户名'' AFTER `legal_person_face_at`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'corporate_bank_name'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `corporate_bank_account` VARCHAR(64) NULL COMMENT ''对公账户账号（仅存掩码）'' AFTER `corporate_bank_name`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'corporate_bank_account'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `corporate_transfer_amount` VARCHAR(32) NULL COMMENT ''对公打款金额'' AFTER `corporate_bank_account`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'corporate_transfer_amount'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `corporate_transfer_reference` VARCHAR(128) NULL COMMENT ''对公打款流水号'' AFTER `corporate_transfer_amount`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'corporate_transfer_reference'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `corporate_transfer_proof_url` VARCHAR(500) NULL COMMENT ''对公打款凭证地址'' AFTER `corporate_transfer_reference`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'corporate_transfer_proof_url'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `corporate_transfer_status` VARCHAR(20) NULL COMMENT ''对公打款核验状态'' AFTER `corporate_transfer_proof_url`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'corporate_transfer_status'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `corporate_transfer_at` DATETIME NULL COMMENT ''对公打款凭证提交时间'' AFTER `corporate_transfer_status`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'corporate_transfer_at'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_merchant_certification` ADD COLUMN `verification_channel` VARCHAR(64) NULL COMMENT ''企业认证渠道'' AFTER `corporate_transfer_at`',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certification'
    AND COLUMN_NAME = 'verification_channel'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
