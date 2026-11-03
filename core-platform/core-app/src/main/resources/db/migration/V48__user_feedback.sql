-- ------------------------------------------------ V48 用户中心 · 意见反馈
--
-- 用户提交意见 / 问题 / 投诉，运营端回复后用户能看到回复内容。
--
-- 与「站内信」的关系：回复时会给提交人写一条站内信（复用 MessageFacade），
-- 但反馈单本身要留档，所以单独建表 —— 站内信会被用户删掉，反馈记录不能跟着丢。

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_user_feedback` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `user_id` BIGINT NOT NULL COMMENT ''提交人ID'',
       `feedback_type` VARCHAR(32) NOT NULL COMMENT ''suggestion / bug / complaint / other'',
       `title` VARCHAR(120) NOT NULL COMMENT ''标题'',
       `content` VARCHAR(2000) NOT NULL COMMENT ''反馈内容'',
       `contact` VARCHAR(64) NULL COMMENT ''联系方式'',
       `page_path` VARCHAR(255) NULL COMMENT ''来源页面'',
       `status` VARCHAR(16) NOT NULL DEFAULT ''pending'' COMMENT ''pending / replied / closed'',
       `reply_content` VARCHAR(1000) NULL COMMENT ''回复内容'',
       `replier_id` BIGINT NULL COMMENT ''回复人ID'',
       `replier_name` VARCHAR(64) NULL COMMENT ''回复人姓名'',
       `reply_time` DATETIME NULL COMMENT ''回复时间'',
       `market_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''市场维度'',
       `tenant_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''产业带预留'',
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0 COMMENT ''逻辑删除'',
       PRIMARY KEY (`id`),
       KEY `idx_user` (`user_id`),
       KEY `idx_status` (`status`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户意见反馈''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_user_feedback'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
