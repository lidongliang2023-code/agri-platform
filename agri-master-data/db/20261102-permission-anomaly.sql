-- ============================================================================
-- 主数据运营端 · 权限异常巡检（2026-11-02）
--
-- 为什么要这三张表：`/admin/masterdata/permission/anomaly` 以前固定返回空数组，
-- 页面因此挂了一条"巡检引擎尚未接入数据源"的横幅。代码注释里写的结论是对的 ——
-- 缺的不是数据，是**一张规则表 + 一个按规则扫描的任务**。本脚本把缺的这两样补上。
--
-- 口径来自页面自己那张《检测规则口径》表（四类），一条不多、一条不少：
--   权限过大 / 互斥角色 / 过期权限 / 重复·幽灵。
-- 任何一条规则都只读真实授权关系，不产出"示例异常"。
--
-- 可重复执行：建表 IF NOT EXISTS、种子 ON DUPLICATE KEY、加列先查 information_schema
-- （MySQL 8.4 没有 ADD COLUMN IF NOT EXISTS，直接重复执行会 1060）。
--
-- 字符序必须显式写 utf8mb4_unicode_ci：本库既有表都是它，而 MySQL 8.4 的服务器默认是
-- utf8mb4_0900_ai_ci。不写就等于新建的表跟 agri_md_role / agri_md_menu 字符序不一致，
-- 巡检 SQL 里 role_mutex.role_code = role.role_code 这种字符串关联会直接报
-- "Illegal mix of collations" —— 建表时就对不上，比运行期再改便宜得多。
-- ============================================================================

-- 规则定义：阈值与开关放库里，页面才能把"判定口径"照实渲染出来而不是写死在模板里
CREATE TABLE IF NOT EXISTS `agri_md_permission_rule` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `rule_code` VARCHAR(64) NOT NULL COMMENT '规则编码（扫描结果按它归因）',
  `rule_name` VARCHAR(64) NOT NULL COMMENT '规则名（页面展示）',
  `anomaly_type` VARCHAR(32) NOT NULL COMMENT 'OVER_PRIVILEGE / MUTEX_ROLE / EXPIRED_GRANT / BINDING_INTEGRITY',
  `severity` VARCHAR(16) NOT NULL COMMENT 'danger / warning',
  `metric` VARCHAR(32) NOT NULL COMMENT '判定口径，一处实现对应一个取值',
  `threshold` INT NULL COMMENT '阈值；不适用的规则为 NULL（不编一个数冒充可配置）',
  `enabled` INT NOT NULL DEFAULT 1 COMMENT '1=生效',
  `remark` VARCHAR(255) NULL COMMENT '这条规则到底在查什么（页面 tooltip 读它）',
  `del_flag` INT NOT NULL DEFAULT 0,
  `tenant_id` VARCHAR(32) NULL COMMENT 'NULL=平台级规则（对所有主体生效）',
  `create_time` DATETIME NULL,
  `update_time` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_md_perm_rule` (`rule_code`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '权限巡检规则';

-- 互斥角色对：没有这张表，"互斥职责"就只能靠代码里写死角色编码，改一次发一次版
CREATE TABLE IF NOT EXISTS `agri_md_role_mutex` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `role_code_a` VARCHAR(64) NOT NULL,
  `role_code_b` VARCHAR(64) NOT NULL,
  `reason` VARCHAR(255) NOT NULL COMMENT '为什么互斥（异常描述里会带上，审计要能看懂）',
  `enabled` INT NOT NULL DEFAULT 1,
  `del_flag` INT NOT NULL DEFAULT 0,
  `create_time` DATETIME NULL,
  `update_time` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_md_role_mutex` (`role_code_a`, `role_code_b`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '角色互斥对（职责分离）';

-- 扫描结果：按 (规则, 对象类型, 对象) 唯一，重复扫描只更新 last_seen，
-- 本轮没再复现的自动转 RESOLVED —— 修好授权后异常不会永远挂在列表上
CREATE TABLE IF NOT EXISTS `agri_md_permission_anomaly` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `rule_code` VARCHAR(64) NOT NULL,
  `anomaly_type` VARCHAR(32) NOT NULL,
  `severity` VARCHAR(16) NOT NULL,
  `target_type` VARCHAR(32) NOT NULL COMMENT 'USER / ROLE / ROLE_MENU / USER_ROLE',
  `target_id` VARCHAR(64) NOT NULL COMMENT '雪花主键按字符串存，避免前端精度丢失',
  `target_name` VARCHAR(128) NULL,
  `tenant_id` VARCHAR(32) NULL,
  `detail` VARCHAR(512) NULL COMMENT '判定依据：数字与对象名，不写"可能存在风险"这种空话',
  `status` VARCHAR(16) NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN / RESOLVED',
  `first_seen` DATETIME NOT NULL,
  `last_seen` DATETIME NOT NULL,
  `resolved_time` DATETIME NULL,
  `del_flag` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_md_anomaly_target` (`rule_code`, `target_type`, `target_id`),
  KEY `idx_md_anomaly_status` (`status`, `last_seen`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '权限巡检结果';

-- ---------------------------------------------------------------------------
-- 「过期权限」这条口径以前没有数据源：两张授权表都没有到期时间。
-- 补 NULL 列（NULL = 永久），不改任何现有语义，也不拿 create_time+90 天编一个到期日。
-- ---------------------------------------------------------------------------
SET @col_rm := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'agri_md_role_menu' AND column_name = 'expire_time');
SET @sql_rm := IF(@col_rm = 0,
  'ALTER TABLE `agri_md_role_menu` ADD COLUMN `expire_time` DATETIME NULL COMMENT ''授权到期时间；NULL=永久''',
  'SELECT ''agri_md_role_menu.expire_time 已存在''');
PREPARE st FROM @sql_rm; EXECUTE st; DEALLOCATE PREPARE st;

SET @col_ur := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'agri_md_user_role' AND column_name = 'expire_time');
SET @sql_ur := IF(@col_ur = 0,
  'ALTER TABLE `agri_md_user_role` ADD COLUMN `expire_time` DATETIME NULL COMMENT ''授权到期时间；NULL=永久''',
  'SELECT ''agri_md_user_role.expire_time 已存在''');
PREPARE st FROM @sql_ur; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- 规则种子。阈值按库内实际规模定：菜单共 52 条（M=9 目录 + C=43 菜单），
-- 所以"权限过大"取 40（≈ 77%）—— 一个账号能看到 40 个菜单就不是岗位角色了。
-- ---------------------------------------------------------------------------
INSERT INTO `agri_md_permission_rule`
  (`rule_code`, `rule_name`, `anomaly_type`, `severity`, `metric`, `threshold`, `enabled`, `remark`, `create_time`, `update_time`)
VALUES
  ('OVER_PRIVILEGE', '权限过大', 'OVER_PRIVILEGE', 'HIGH', 'USER_MENU_COUNT', 40, 1,
   '同一账号（含其全部角色）能看到的菜单数达到阈值', NOW(), NOW()),
  ('MUTEX_ROLE', '互斥角色', 'MUTEX_ROLE', 'HIGH', 'ROLE_MUTEX_PAIR', NULL, 1,
   '同一账号同时持有互斥对里的两个角色（职责未分离）', NOW(), NOW()),
  ('EXPIRED_GRANT', '过期权限', 'EXPIRED_GRANT', 'MEDIUM', 'GRANT_EXPIRE', NULL, 1,
   '授权到期时间已过但绑定关系仍然生效', NOW(), NOW()),
  ('BINDING_INTEGRITY', '重复 / 幽灵绑定', 'BINDING_INTEGRITY', 'MEDIUM', 'BINDING_INTEGRITY', NULL, 1,
   '同一绑定重复出现，或绑定指向已删除/不存在的角色、菜单', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `rule_name` = VALUES(`rule_name`), `anomaly_type` = VALUES(`anomaly_type`),
  `severity` = VALUES(`severity`), `metric` = VALUES(`metric`),
  `remark` = VALUES(`remark`), `update_time` = NOW();

-- 互斥对取自库里真实存在的角色编码（不是编出来的示范数据）：
-- 审核员与组织管理员 / 超管与审核员 —— 都是"自己审自己"或"管人的人兼审核"。
INSERT INTO `agri_md_role_mutex` (`role_code_a`, `role_code_b`, `reason`, `enabled`, `create_time`, `update_time`)
VALUES
  ('DATA_AUDITOR', 'ORG_MANAGER', '数据审核与组织管理必须分离：管人配岗的人不应同时是数据的审核人', 1, NOW(), NOW()),
  ('TENANT_ADMIN', 'DATA_AUDITOR', '租户管理员与数据审核员同一人时，等于自己审核自己的变更', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `reason` = VALUES(`reason`), `enabled` = VALUES(`enabled`), `update_time` = NOW();

-- 现状核对（执行后应看到 4 条规则、2 条互斥对、0 条异常 —— 库内当前没有重复与幽灵绑定）
SELECT CONCAT('rules=', COUNT(*)) FROM `agri_md_permission_rule` WHERE del_flag = 0;
SELECT CONCAT('mutex_pairs=', COUNT(*)) FROM `agri_md_role_mutex` WHERE del_flag = 0 AND enabled = 1;
SELECT CONCAT('anomalies=', COUNT(*)) FROM `agri_md_permission_anomaly`;
