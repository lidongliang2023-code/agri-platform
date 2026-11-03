-- ------------------------------------------------ V44 用户中心 · 通知设置
--
-- 用户级通知偏好：一个用户一行（user_id 唯一）。
--
-- 口径说明（页面会同步写明，避免误导）：
--   · 站内信（inapp）**已接入** —— 平台 MessageFacade 写 platform_message，用户中心消息中心可读；
--   · 短信（sms）/ 推送（push）**尚未接入** —— 这里只存偏好，等消息触达器上线后直接生效，
--     现在不会真的发出去。
--   · 类型编码与消息标题对应：join_request / audit_result 已能产生消息；
--     order / alert / system 属预留，等对应域接消息门面后生效。

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_notification_setting` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `user_id` BIGINT NOT NULL COMMENT ''平台账号 ID'',
       `inapp_types` VARCHAR(255) NOT NULL DEFAULT ''join_request,audit_result'' COMMENT ''站内信开启的类型（逗号分隔）'',
       `sms_types` VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''短信开启的类型（渠道未接入，仅存偏好）'',
       `push_types` VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''推送开启的类型（渠道未接入，仅存偏好）'',
       `quiet_start` VARCHAR(5) NULL COMMENT ''免打扰开始 HH:mm'',
       `quiet_end` VARCHAR(5) NULL COMMENT ''免打扰结束 HH:mm'',
       `digest` VARCHAR(16) NOT NULL DEFAULT ''realtime'' COMMENT ''realtime / daily / weekly'',
       `market_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''市场隔离维度'',
       `tenant_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''产业带（预留）'',
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0 COMMENT ''逻辑删除'',
       PRIMARY KEY (`id`),
       UNIQUE KEY `uk_user` (`user_id`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户通知偏好''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_notification_setting'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
