-- ------------------------------------------------ V50 用户中心 · 二次验证（TOTP）
--
-- 存 TOTP 密钥与备用码。一个账号最多一条记录（user_id 唯一）。
--
-- 关于密钥存储：`secret_cipher` 存的是 **AES-GCM 加密后的密文**，不是明文 base32。
-- 加密密钥来自配置 `agri.mfa.encrypt-key`（生产用环境变量注入）。
-- 注意：**默认值写在配置文件里等于没有加密**，只是避免"数据库一泄露就全裸"，
-- 不要把它当成完整的安全措施 —— 真正的做法是密钥托管（KMS / 密钥服务）。
--
-- 备用码只存 SHA-256 哈希，明文仅在生成时返回一次；用过即从列表移除。

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_user_mfa` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `user_id` BIGINT NOT NULL COMMENT ''账号ID'',
       `secret_cipher` VARCHAR(255) NOT NULL COMMENT ''TOTP密钥密文'',
       `status` VARCHAR(16) NOT NULL DEFAULT ''pending'' COMMENT ''pending / active / disabled'',
       `recovery_codes` TEXT NULL COMMENT ''备用码哈希JSON数组'',
       `enabled_at` DATETIME NULL COMMENT ''启用时间'',
       `last_used_at` DATETIME NULL COMMENT ''最近一次验证通过时间'',
       `last_used_step` BIGINT NULL COMMENT ''最近一次通过的时间步，防重放'',
       `market_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''市场维度'',
       `tenant_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''产业带预留'',
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0 COMMENT ''逻辑删除'',
       PRIMARY KEY (`id`),
       UNIQUE KEY `uk_user` (`user_id`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户二次验证''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_user_mfa'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
