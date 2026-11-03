-- ------------------------------------------------ V54 消息推送异步化
--
-- 原来的推送是"请求里同步循环插站内信 + 硬上限 2000 人"：再多会超时，而且一旦超时
-- 前面已经插进去的站内信不会回滚 —— 用户收到一半，运营看到的是 500。
--
-- 改成两段式：
--   1) 请求只做"建任务 + 落人群名单"，立刻返回；
--   2) 后台 worker 每 3 秒取一批（500 条）投递，投完把名单行删掉，最后置 sent。
--
-- 为什么要单独一张名单表，而不是在任务上记个游标：
--   人群口径是「已实名 / 企业成员 / 30 天未登录」这类**跨表条件**，
--   用游标重算每批都得再跑一次子查询，且中途用户状态变化会导致同一批人反复进出。
--   先把名单固定下来，投递过程就只是"读一批、发一批、删一批"，重启也能接着发。

-- ---------- 任务表补失败原因 ----------
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_uc_message_push_task`
       ADD COLUMN `fail_reason` VARCHAR(255) NULL COMMENT ''投递失败原因（status=failed 时有值）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_uc_message_push_task'
    AND COLUMN_NAME = 'fail_reason'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 投递名单 ----------
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_uc_push_target` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `task_id` BIGINT NOT NULL COMMENT ''推送任务ID'',
       `user_id` BIGINT NOT NULL COMMENT ''目标用户'',
       `market_id` BIGINT NOT NULL DEFAULT 0,
       `tenant_id` BIGINT NOT NULL DEFAULT 0,
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0,
       PRIMARY KEY (`id`),
       UNIQUE KEY `uk_task_user` (`task_id`, `user_id`),
       KEY `idx_task` (`task_id`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户中心 · 推送投递名单（投递后删除）''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_uc_push_target'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
