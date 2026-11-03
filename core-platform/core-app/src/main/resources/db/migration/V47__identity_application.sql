-- ------------------------------------------------ V47 用户中心 · 身份申请
--
-- 用户申请开通某个业务身份（批发商 / 零售商 / 农户 / 合作社管理员 / 服务商 / 政府人员），
-- 运营端审核通过后生效。
--
-- 与「主体」的关系：身份申请可以关联一个经营主体（merchant_id 可空），
-- 但审核通过**不改主体绑定关系**，只把申请单置为 approved —— 是否据此开通权限由后续
-- 权限模块决定。这里只做"申请 + 审核"这条单子，不越界去改 RBAC。

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_identity_application` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `user_id` BIGINT NOT NULL COMMENT ''申请人ID'',
       `identity_type` VARCHAR(32) NOT NULL COMMENT ''身份类型'',
       `merchant_id` BIGINT NULL COMMENT ''关联主体ID'',
       `subject_name` VARCHAR(160) NULL COMMENT ''主体名称'',
       `credit_code` VARCHAR(32) NULL COMMENT ''统一社会信用代码'',
       `business_place` VARCHAR(255) NULL COMMENT ''经营场所'',
       `business_category` VARCHAR(128) NULL COMMENT ''经营品类'',
       `annual_volume` VARCHAR(64) NULL COMMENT ''年交易量'',
       `contact_name` VARCHAR(64) NULL COMMENT ''联系人'',
       `contact_phone` VARCHAR(32) NULL COMMENT ''联系电话'',
       `apply_note` VARCHAR(500) NULL COMMENT ''申请说明'',
       `status` VARCHAR(16) NOT NULL DEFAULT ''pending'' COMMENT ''pending / approved / rejected / cancelled'',
       `reviewer_id` BIGINT NULL COMMENT ''审核人ID'',
       `reviewer_name` VARCHAR(64) NULL COMMENT ''审核人姓名'',
       `review_time` DATETIME NULL COMMENT ''审核时间'',
       `review_remark` VARCHAR(255) NULL COMMENT ''审核意见'',
       `market_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''市场维度'',
       `tenant_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''产业带预留'',
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0 COMMENT ''逻辑删除'',
       PRIMARY KEY (`id`),
       KEY `idx_user` (`user_id`),
       KEY `idx_status` (`status`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''身份申请单''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_identity_application'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
