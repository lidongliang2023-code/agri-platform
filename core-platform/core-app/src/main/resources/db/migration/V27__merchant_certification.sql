-- ------------------------------------------------ V27 经营主体认证
--
-- 缺口：platform_merchant 有 credit_code / contact_name / contact_phone 这些**登记信息**，
-- 但没有任何"验没验过"的字段。也就是说运营端做不了企业认证 ——
-- 谁提交了材料、审到哪一步、审过还是驳回、凭什么驳回，都无处可放。
--
-- 两份东西：
--   ① platform_merchant 上加三个状态列（verify_status / verify_time / verify_remark）。
--      查列表时要用到"这家验没验过"，如果只存在认证表里，每列一次都要 join 一次取最新记录。
--   ② 建 platform_merchant_certification 存**每一次提交**（含被驳回后重新提交的次数）。
--      只留状态的话，商家会问"我上次为什么被驳回"，而那条理由已经被新的提交覆盖掉了。
--
-- 幂等：加列先查 information_schema（MySQL 没有 ADD COLUMN IF NOT EXISTS），
-- 建表用 IF NOT EXISTS。与 V25 是同一套写法。

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant' AND COLUMN_NAME = 'verify_status');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant` ADD COLUMN `verify_status` VARCHAR(32) NULL DEFAULT ''unverified'' COMMENT ''认证状态：unverified 未认证 / pending 待审核 / approved 已认证 / rejected 已驳回''',
  'SELECT 1');
PREPARE s1 FROM @ddl; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant' AND COLUMN_NAME = 'verify_time');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant` ADD COLUMN `verify_time` DATETIME NULL COMMENT ''认证通过时间''',
  'SELECT 1');
PREPARE s2 FROM @ddl; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant' AND COLUMN_NAME = 'verify_remark');
SET @ddl := IF(@col = 0,
  'ALTER TABLE `platform_merchant` ADD COLUMN `verify_remark` VARCHAR(500) NULL COMMENT ''最近一次审核意见''',
  'SELECT 1');
PREPARE s3 FROM @ddl; EXECUTE s3; DEALLOCATE PREPARE s3;

CREATE TABLE IF NOT EXISTS `platform_merchant_certification` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `market_id` BIGINT NULL COMMENT '市场ID（ADR-005，框架层统一注入）',
  `merchant_id` BIGINT NOT NULL COMMENT '经营主体ID（platform_merchant.id）',
  `merchant_name` VARCHAR(128) NULL COMMENT '主体名称（提交时快照）',
  `cert_no` VARCHAR(64) NOT NULL COMMENT '认证申请单号',
  `company_name` VARCHAR(128) NOT NULL COMMENT '企业名称（应与营业执照一致）',
  `credit_code` VARCHAR(64) NOT NULL COMMENT '统一社会信用代码',
  `legal_person` VARCHAR(32) NULL COMMENT '法定代表人',
  `license_no` VARCHAR(64) NULL COMMENT '营业执照编号',
  `contact_name` VARCHAR(32) NULL COMMENT '联系人',
  `contact_phone` VARCHAR(20) NULL COMMENT '联系电话',
  `attach_note` VARCHAR(500) NULL COMMENT '材料说明（当前阶段只登记说明文本，不存文件）',
  `cert_status` VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending 待审核 / approved 已通过 / rejected 已驳回',
  `submit_time` DATETIME NULL COMMENT '提交时间',
  `reviewer` VARCHAR(64) NULL COMMENT '审核人',
  `review_time` DATETIME NULL COMMENT '审核时间',
  `review_remark` VARCHAR(500) NULL COMMENT '审核意见（驳回时必须填）',
  -- 注意列名：平台侧的逻辑删除字段是 deleted（BaseEntity 的 @TableLogic），
  -- 不是交易模块那边用的 del_flag。写成 del_flag 的话，框架做逻辑删除/过滤时会找不到列。
  `deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '删除标记',
  `created_at` DATETIME NULL COMMENT '创建时间',
  `updated_at` DATETIME NULL COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cert_no` (`cert_no`),
  KEY `idx_merchant` (`merchant_id`),
  KEY `idx_cert_status` (`cert_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='经营主体认证申请表';

-- 演示数据：给主体 2001 一条待审核的认证申请，好让运营端有东西可审。
-- 手写 id 固定 9501+，便于单独清理。
INSERT IGNORE INTO `platform_merchant_certification`
  (`id`, `market_id`, `merchant_id`, `merchant_name`, `cert_no`, `company_name`, `credit_code`,
   `legal_person`, `license_no`, `contact_name`, `contact_phone`, `attach_note`, `cert_status`,
   `submit_time`, `deleted`, `created_at`, `updated_at`)
VALUES
  (9501, 1, 2001, '绿源农业合作社', 'CT20261013D01', '绿源农业专业合作社', '91370700MA3D5K8N2X',
   '王振海', '370700MA3D5K8N2X', '王振海', '13800000002', '营业执照 + 法人身份证（纸质已归档）', 'pending',
   NOW(), 0, NOW(), NOW());

UPDATE `platform_merchant` SET `verify_status` = 'pending' WHERE `id` = 2001 AND (`verify_status` IS NULL OR `verify_status` = 'unverified');

-- 清理语句（默认注释）：只删本迁移造的演示认证申请
-- DELETE FROM `platform_merchant_certification` WHERE `id` BETWEEN 9501 AND 9599;
