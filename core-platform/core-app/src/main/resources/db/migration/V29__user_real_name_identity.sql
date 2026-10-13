-- 个人实名认证（平台级，与 platform_merchant_certification 的"企业认证"并列）
--
-- 【口径】库里**不存身份证号明文**：只存
--   · id_no_masked  掩码（前 3 位 + 11 个 * + 后 4 位，例如 330***********1234）
--   · id_no_hash    加盐 SHA-256（每人一盐，同一人重复提交用同盐比对，用于判断"号码有没有换"）
--   · id_no_salt    该记录的随机盐
-- 真实的三要素核验（姓名 + 身份证 + 人脸/公安库比对）须接合规服务，届时也只把
-- **核验结果**与掩码入库；这套表结构不变。
--
-- 状态机：pending（待审核）→ verified / rejected（驳回带原因）；驳回后当事人可重新提交。
-- 与 platform_merchant_certification 同一套做法：**每次提交留一条记录**，
-- 当前状态取最新一条。只维护一个状态的话，"我上次为什么被驳回"就再也答不上来，
-- 而认证记录要能追溯、当事人不能自己删。

CREATE TABLE IF NOT EXISTS `platform_user_identity` (
    `id` BIGINT NOT NULL COMMENT '主键ID',
    `user_id` BIGINT NOT NULL COMMENT '平台用户ID',
    `market_id` BIGINT NULL COMMENT '市场ID（ADR-005：云管家按市场隔离运营）',
    `identity_no` VARCHAR(64) NOT NULL COMMENT '认证单号',
    `real_name` VARCHAR(64) NOT NULL COMMENT '真实姓名',
    `id_no_masked` VARCHAR(32) NOT NULL COMMENT '身份证号掩码（不存明文）',
    `id_no_hash` VARCHAR(128) NOT NULL COMMENT '身份证号加盐 SHA-256',
    `id_no_salt` VARCHAR(64) NOT NULL COMMENT '盐（每条记录独立随机）',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/verified/rejected',
    `submit_time` DATETIME NOT NULL COMMENT '提交时间',
    `reviewer_id` BIGINT NULL COMMENT '审核人用户ID',
    `reviewer_name` VARCHAR(64) NULL COMMENT '审核人',
    `review_time` DATETIME NULL COMMENT '审核时间',
    `review_remark` VARCHAR(500) NULL COMMENT '审核意见（驳回原因）',
    `created_at` DATETIME NULL COMMENT '创建时间',
    `updated_at` DATETIME NULL COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_identity_no` (`identity_no`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='个人实名认证';
