ALTER TABLE `platform_user`
    ADD COLUMN `email` VARCHAR(128) NULL COMMENT '联系邮箱' AFTER `phone`;

CREATE TABLE IF NOT EXISTS `platform_user_address` (
    `id` BIGINT NOT NULL COMMENT '主键',
    `market_id` BIGINT NULL COMMENT '市场ID',
    `tenant_id` BIGINT NULL COMMENT '租户ID',
    `user_id` BIGINT NOT NULL COMMENT '平台用户ID',
    `receiver_name` VARCHAR(64) NOT NULL COMMENT '收货人',
    `contact_phone` VARCHAR(32) NOT NULL COMMENT '联系电话',
    `province` VARCHAR(64) NOT NULL COMMENT '省份',
    `city` VARCHAR(64) NOT NULL COMMENT '城市',
    `district` VARCHAR(64) NULL COMMENT '区县',
    `detail_address` VARCHAR(255) NOT NULL COMMENT '详细地址',
    `postal_code` VARCHAR(20) NULL COMMENT '邮编',
    `is_default` TINYINT NOT NULL DEFAULT 0 COMMENT '是否默认地址',
    `created_at` DATETIME NULL,
    `updated_at` DATETIME NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_user_address_user` (`user_id`),
    KEY `idx_user_address_default` (`user_id`, `is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户收货地址';

CREATE TABLE IF NOT EXISTS `platform_merchant_join_request` (
    `id` BIGINT NOT NULL COMMENT '主键',
    `market_id` BIGINT NULL COMMENT '市场ID',
    `tenant_id` BIGINT NULL COMMENT '租户ID',
    `user_id` BIGINT NOT NULL COMMENT '申请用户ID',
    `merchant_id` BIGINT NOT NULL COMMENT '申请加入的主体ID',
    `requested_role` VARCHAR(32) NOT NULL COMMENT 'buyer/seller/finance',
    `message` VARCHAR(500) NULL COMMENT '申请说明',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected/cancelled',
    `reviewer_id` BIGINT NULL COMMENT '审核用户ID',
    `reviewer_name` VARCHAR(64) NULL COMMENT '审核人',
    `review_time` DATETIME NULL COMMENT '审核时间',
    `review_remark` VARCHAR(500) NULL COMMENT '审核意见',
    `created_at` DATETIME NULL,
    `updated_at` DATETIME NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_join_user` (`user_id`, `status`),
    KEY `idx_join_merchant` (`merchant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='经营主体加入申请';
