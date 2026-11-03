-- ------------------------------------------------ V56 证照到期提醒去重
--
-- 证照到期提醒由后台每天扫一次，通过站内信发给主体成员。
-- 同一张证照、同一档提醒（30 天内 / 已过期）对同一个用户只能发一次 ——
-- 否则每天扫一次就会天天给用户发同样的消息。
--
-- 为什么要单独一张表而不是查 platform_message：
--   站内信没有业务键，无法区分"这条是 A 证照的 D30 提醒"还是运营群发；
--   用 (cert_id, window_key, user_id) 唯一键做幂等，是最小且可解释的做法。

CREATE TABLE IF NOT EXISTS `platform_cert_reminder` (
  `id` BIGINT NOT NULL COMMENT '雪花主键',
  `cert_id` BIGINT NOT NULL COMMENT '证照ID（platform_merchant_certificate.id）',
  `merchant_id` BIGINT NOT NULL COMMENT '主体ID',
  `user_id` BIGINT NOT NULL COMMENT '接收用户',
  `window_key` VARCHAR(16) NOT NULL COMMENT '提醒档位：D30=30天内到期，EXPIRED=已过期7天内',
  `sent_at` DATETIME NOT NULL COMMENT '发送时间',
  `market_id` BIGINT NOT NULL DEFAULT 0,
  `tenant_id` BIGINT NOT NULL DEFAULT 0,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  `deleted` TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cert_window_user` (`cert_id`, `window_key`, `user_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户中心 · 证照到期提醒发送记录（幂等）';
