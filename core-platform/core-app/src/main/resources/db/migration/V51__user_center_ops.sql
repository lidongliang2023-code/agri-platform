-- ------------------------------------------------ V51 用户中心运营端
--
-- 只建"确实没有落处"的 6 张表。其余能力（用户 / 角色 / 身份申请 / 实名 / 资质 /
-- 组织 / 反馈 / 隐私请求 / 操作日志）在 platform_* 里已有，运营端直接读同一份数据，
-- 不再复制一套 —— 重复建表会让"用户在用户端提交、运营端看不到"这类问题反复出现。
--
-- 为什么这 6 张必须新建：
--   platform_uc_third_party_app          第三方应用注册表，原来只有"用户绑定关系"，没有"应用档案"
--   platform_uc_third_party_auth_record  授权流水，platform_user_binding 只有当前态、没有历史
--   platform_uc_message_template         消息模板，platform_message 是收件箱，没有模板概念
--   platform_uc_message_push_task        推送任务，同上
--   platform_uc_account_freeze           冻结记录，platform_user.status 只有"当前是否可用"，
--                               缺原因/期限/申诉，冻结 30 天后无法解释为什么冻的
--   platform_uc_system_config            账号侧参数配置，原来散在 application.yml，运营改不了
--
-- 市场维度：用户中心是**平台级**，不按 market_id 隔离（与 platform_user 一致），
-- 实体上用 @InterceptorIgnore 旁路，这里仍保留 market_id 列以便将来真的分市场。

-- ---------- 第三方应用 ----------
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_uc_third_party_app` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `app_key` VARCHAR(64) NOT NULL COMMENT ''应用标识'',
       `app_name` VARCHAR(128) NOT NULL COMMENT ''应用名称'',
       `app_type` VARCHAR(16) NOT NULL DEFAULT ''partner'' COMMENT ''internal / partner / open'',
       `applicant` VARCHAR(128) NULL COMMENT ''申请方'',
       `contact_name` VARCHAR(64) NULL COMMENT ''联系人'',
       `contact_phone` VARCHAR(32) NULL COMMENT ''联系电话'',
       `scopes` VARCHAR(500) NULL COMMENT ''授权范围，逗号分隔'',
       `redirect_uri` VARCHAR(500) NULL COMMENT ''回调地址'',
       `status` VARCHAR(16) NOT NULL DEFAULT ''pending'' COMMENT ''pending / online / rejected / offline'',
       `call_count` BIGINT NOT NULL DEFAULT 0 COMMENT ''累计调用次数'',
       `last_call_at` DATETIME NULL COMMENT ''最近调用时间'',
       `reviewer_name` VARCHAR(64) NULL COMMENT ''审核人'',
       `review_time` DATETIME NULL COMMENT ''审核时间'',
       `review_remark` VARCHAR(500) NULL COMMENT ''审核意见'',
       `market_id` BIGINT NOT NULL DEFAULT 0,
       `tenant_id` BIGINT NOT NULL DEFAULT 0,
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0,
       PRIMARY KEY (`id`),
       UNIQUE KEY `uk_app_key` (`app_key`),
       KEY `idx_status` (`status`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户中心 · 第三方应用''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_uc_third_party_app'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 第三方授权流水 ----------
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_uc_third_party_auth_record` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `user_id` BIGINT NOT NULL COMMENT ''授权用户'',
       `user_name` VARCHAR(64) NULL COMMENT ''用户昵称快照'',
       `app_id` BIGINT NULL COMMENT ''应用ID'',
       `app_name` VARCHAR(128) NULL COMMENT ''应用名称快照'',
       `scopes` VARCHAR(500) NULL COMMENT ''本次授权范围'',
       `action` VARCHAR(16) NOT NULL DEFAULT ''grant'' COMMENT ''grant / revoke'',
       `ip` VARCHAR(64) NULL,
       `market_id` BIGINT NOT NULL DEFAULT 0,
       `tenant_id` BIGINT NOT NULL DEFAULT 0,
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0,
       PRIMARY KEY (`id`),
       KEY `idx_user` (`user_id`),
       KEY `idx_app` (`app_id`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户中心 · 第三方授权流水''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_uc_third_party_auth_record'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 消息模板 ----------
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_uc_message_template` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `code` VARCHAR(64) NOT NULL COMMENT ''模板编码'',
       `scene` VARCHAR(32) NOT NULL COMMENT ''cert_audit / security / cert_expire / identity / privacy'',
       `channels` VARCHAR(64) NULL COMMENT ''适用渠道，逗号分隔'',
       `title` VARCHAR(128) NOT NULL COMMENT ''标题模板'',
       `content` VARCHAR(1000) NULL COMMENT ''正文模板，支持花括号变量占位'',
       `variables` VARCHAR(255) NULL COMMENT ''可用变量，逗号分隔'',
       `status` VARCHAR(16) NOT NULL DEFAULT ''enabled'' COMMENT ''enabled / disabled'',
       `market_id` BIGINT NOT NULL DEFAULT 0,
       `tenant_id` BIGINT NOT NULL DEFAULT 0,
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0,
       PRIMARY KEY (`id`),
       UNIQUE KEY `uk_code` (`code`),
       KEY `idx_scene` (`scene`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户中心 · 消息模板''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_uc_message_template'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 消息推送任务 ----------
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_uc_message_push_task` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `title` VARCHAR(128) NOT NULL,
       `content` VARCHAR(1000) NULL,
       `template_code` VARCHAR(64) NULL,
       `audience` VARCHAR(32) NOT NULL DEFAULT ''all'' COMMENT ''all / realname / enterprise / wholesaler / inactive / cert_expiring'',
       `channels` VARCHAR(64) NULL COMMENT ''station / wechat / sms / app'',
       `target_count` INT NOT NULL DEFAULT 0 COMMENT ''目标人数'',
       `reach_count` INT NOT NULL DEFAULT 0 COMMENT ''实际触达'',
       `open_rate` DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT ''打开率 %'',
       `status` VARCHAR(16) NOT NULL DEFAULT ''draft'' COMMENT ''draft / sending / sent / failed'',
       `send_time` DATETIME NULL,
       `operator_name` VARCHAR(64) NULL,
       `market_id` BIGINT NOT NULL DEFAULT 0,
       `tenant_id` BIGINT NOT NULL DEFAULT 0,
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0,
       PRIMARY KEY (`id`),
       KEY `idx_status` (`status`),
       KEY `idx_send_time` (`send_time`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户中心 · 消息推送任务''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_uc_message_push_task'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 账号冻结记录 ----------
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_uc_account_freeze` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `user_id` BIGINT NOT NULL,
       `username` VARCHAR(64) NULL COMMENT ''账号快照'',
       `freeze_type` VARCHAR(16) NOT NULL DEFAULT ''risk'' COMMENT ''risk / violation / judicial / cancel'',
       `reason` VARCHAR(500) NULL,
       `freeze_time` DATETIME NULL,
       `expire_time` DATETIME NULL COMMENT ''NULL 表示永久'',
       `status` VARCHAR(16) NOT NULL DEFAULT ''frozen'' COMMENT ''frozen / unfrozen'',
       `appeal_status` VARCHAR(16) NOT NULL DEFAULT ''none'' COMMENT ''none / appealing / accepted / rejected'',
       `operator_name` VARCHAR(64) NULL,
       `unfreeze_time` DATETIME NULL,
       `unfreeze_remark` VARCHAR(500) NULL,
       `market_id` BIGINT NOT NULL DEFAULT 0,
       `tenant_id` BIGINT NOT NULL DEFAULT 0,
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0,
       PRIMARY KEY (`id`),
       KEY `idx_user` (`user_id`),
       KEY `idx_status` (`status`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户中心 · 账号冻结记录''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_uc_account_freeze'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 账号侧参数配置 ----------
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_uc_system_config` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `config_group` VARCHAR(32) NOT NULL COMMENT ''register / realname / password / session / captcha'',
       `config_key` VARCHAR(64) NOT NULL,
       `label` VARCHAR(128) NULL,
       `config_value` VARCHAR(500) NULL,
       `value_type` VARCHAR(16) NOT NULL DEFAULT ''text'' COMMENT ''text / number / switch / select / multi'',
       `options` VARCHAR(500) NULL COMMENT ''选项，逗号分隔'',
       `remark` VARCHAR(255) NULL,
       `sort_no` INT NOT NULL DEFAULT 0,
       `market_id` BIGINT NOT NULL DEFAULT 0,
       `tenant_id` BIGINT NOT NULL DEFAULT 0,
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0,
       PRIMARY KEY (`id`),
       UNIQUE KEY `uk_key` (`config_key`),
       KEY `idx_group` (`config_group`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''用户中心 · 账号侧参数配置''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_uc_system_config'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
