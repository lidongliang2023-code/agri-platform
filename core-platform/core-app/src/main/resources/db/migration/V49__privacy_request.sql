-- ------------------------------------------------ V49 用户中心 · 隐私与数据申请
--
-- 承载两类"需要平台人工处理"的请求：
--   export   —— 数据导出（打包本人数据并交付）
--   deletion —— 账号注销
--
-- 为什么不像"意见反馈"那样一次就办结：这两件事都要动真东西 ——
-- 导出要跨多个业务库取数，注销要连带处理主体归属、合同、结算、审计留存。
-- 系统里能自动做的只有"收单 + 流转状态"，所以表只记录单据，不假装已经执行。
--
-- 「授权撤回」不进这张表：第三方授权撤回是可以立刻生效的真实动作，
-- 直接复用 platform_user_binding 的解绑接口，不需要走审批。

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_privacy_request` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `user_id` BIGINT NOT NULL COMMENT ''申请人ID'',
       `request_type` VARCHAR(32) NOT NULL COMMENT ''export / deletion'',
       `reason` VARCHAR(500) NULL COMMENT ''申请理由'',
       `scope` VARCHAR(255) NULL COMMENT ''导出范围或注销说明'',
       `status` VARCHAR(16) NOT NULL DEFAULT ''pending'' COMMENT ''pending / processing / completed / rejected / cancelled'',
       `handler_id` BIGINT NULL COMMENT ''处理人ID'',
       `handler_name` VARCHAR(64) NULL COMMENT ''处理人姓名'',
       `handle_time` DATETIME NULL COMMENT ''处理时间'',
       `handle_remark` VARCHAR(500) NULL COMMENT ''处理意见'',
       `market_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''市场维度'',
       `tenant_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''产业带预留'',
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0 COMMENT ''逻辑删除'',
       PRIMARY KEY (`id`),
       KEY `idx_user` (`user_id`),
       KEY `idx_status` (`status`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''隐私与数据申请''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_privacy_request'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
