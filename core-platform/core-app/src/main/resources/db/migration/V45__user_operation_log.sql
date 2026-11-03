-- ------------------------------------------------ V45 用户中心 · 操作日志
--
-- 面向用户本人的操作流水（"我最近做了什么"），与平台侧运维审计不是一回事：
--   · 运维审计关心"谁改了别人的数据"，按操作人 + 目标全局查；
--   · 这张表只服务用户中心「操作日志」页，按 user_id 查，只含本人可感知的动作。
--
-- 写入方是 UserOperationLogService#record，**失败不抛异常** —— 记日志不能把业务搞挂。
--
-- 注意：列 COMMENT 一律用简短中文，不放标点密集的长句。
-- 上一版这里因为注释里多了一个单引号，导致字符串不闭合、整个迁移语法错误、服务起不来。

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_user_operation_log` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `user_id` BIGINT NOT NULL COMMENT ''账号ID'',
       `action` VARCHAR(48) NOT NULL COMMENT ''动作编码'',
       `action_label` VARCHAR(64) NOT NULL COMMENT ''动作中文名'',
       `target` VARCHAR(255) NULL COMMENT ''操作对象'',
       `detail` VARCHAR(500) NULL COMMENT ''补充说明'',
       `ip` VARCHAR(64) NULL COMMENT ''客户端IP'',
       `user_agent` VARCHAR(255) NULL COMMENT ''浏览器UA'',
       `result` VARCHAR(16) NOT NULL DEFAULT ''success'' COMMENT ''结果'',
       `market_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''市场维度'',
       `tenant_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''产业带预留'',
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0 COMMENT ''逻辑删除'',
       PRIMARY KEY (`id`),
       KEY `idx_user_time` (`user_id`, `created_at`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户操作日志''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_user_operation_log'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
