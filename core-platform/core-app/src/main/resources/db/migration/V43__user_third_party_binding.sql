-- ------------------------------------------------ V43 用户中心 · 第三方账号绑定
--
-- 用户中心「第三方绑定」页的数据落点。一个用户对同一个第三方渠道只保留一条有效绑定
-- （(user_id, provider) 唯一），解绑走逻辑删除，便于留痕。
--
-- 口径说明：本部署**未接入第三方 OAuth**，绑定记录的是"外部账号标识"（openid / unionid /
-- 手机号等），由用户在页面上登记，用于后续对接登录、消息推送时把两边账号对上。
-- 不是"点了绑定就完成了授权"—— 页面会明确写出这一点，避免让人误以为已经联通了。

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_user_binding` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `user_id` BIGINT NOT NULL COMMENT ''平台账号 ID'',
       `provider` VARCHAR(32) NOT NULL COMMENT ''第三方渠道：wechat / alipay / dingtalk'',
       `external_account` VARCHAR(128) NOT NULL COMMENT ''外部账号标识（openid / unionid / 手机号等）'',
       `display_name` VARCHAR(128) NULL COMMENT ''外部账号昵称，仅用于页面展示'',
       `bind_status` VARCHAR(16) NOT NULL DEFAULT ''bound'' COMMENT ''bound / unbound'',
       `bind_at` DATETIME NULL COMMENT ''绑定时间'',
       `unbind_at` DATETIME NULL COMMENT ''解绑时间'',
       `remark` VARCHAR(255) NULL COMMENT ''备注'',
       `market_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''市场隔离维度'',
       `tenant_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''产业带（预留）'',
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0 COMMENT ''逻辑删除'',
       PRIMARY KEY (`id`),
       UNIQUE KEY `uk_user_provider` (`user_id`, `provider`),
       KEY `idx_user` (`user_id`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户第三方账号绑定''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_user_binding'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
