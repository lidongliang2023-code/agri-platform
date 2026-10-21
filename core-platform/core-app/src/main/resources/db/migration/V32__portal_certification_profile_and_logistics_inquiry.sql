ALTER TABLE `platform_user_identity`
    ADD COLUMN `valid_start` VARCHAR(20) NULL COMMENT '证件有效期起' AFTER `id_no_salt`,
    ADD COLUMN `valid_end` VARCHAR(20) NULL COMMENT '证件有效期止' AFTER `valid_start`,
    ADD COLUMN `contact_phone` VARCHAR(32) NULL COMMENT '联系电话' AFTER `valid_end`,
    ADD COLUMN `address` VARCHAR(255) NULL COMMENT '常住地址' AFTER `contact_phone`,
    ADD COLUMN `email` VARCHAR(128) NULL COMMENT '联系邮箱' AFTER `address`,
    ADD COLUMN `business_type` VARCHAR(64) NULL COMMENT '个人经营类型' AFTER `email`;

CREATE TABLE IF NOT EXISTS `platform_logistics_inquiry` (
    `id` BIGINT NOT NULL COMMENT '主键',
    `market_id` BIGINT NULL COMMENT '市场ID',
    `tenant_id` BIGINT NULL COMMENT '租户ID',
    `inquiry_no` VARCHAR(64) NOT NULL COMMENT '询价单号',
    `user_id` BIGINT NULL COMMENT '登录用户ID（匿名询价为空）',
    `origin` VARCHAR(255) NOT NULL COMMENT '发货地',
    `origin_detail` VARCHAR(255) NULL COMMENT '发货详细地址',
    `destination` VARCHAR(255) NOT NULL COMMENT '收货地',
    `destination_detail` VARCHAR(255) NULL COMMENT '收货详细地址',
    `cargo_type` VARCHAR(64) NULL COMMENT '货物类型',
    `weight` DECIMAL(12,3) NOT NULL COMMENT '货物重量',
    `unit` VARCHAR(20) NULL COMMENT '重量单位',
    `truck_type` VARCHAR(64) NULL COMMENT '运输方式',
    `expected_date` VARCHAR(32) NULL COMMENT '期望发货日期',
    `expected_time` VARCHAR(32) NULL COMMENT '期望时段',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/contacted/closed',
    `created_at` DATETIME NULL COMMENT '创建时间',
    `updated_at` DATETIME NULL COMMENT '更新时间',
    `deleted` TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_logistics_inquiry_no` (`inquiry_no`),
    INDEX `idx_logistics_inquiry_user` (`user_id`),
    INDEX `idx_logistics_inquiry_status` (`status`),
    INDEX `idx_logistics_inquiry_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门户物流询价单';
