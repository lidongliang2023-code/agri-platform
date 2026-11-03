-- ============================================================================
-- 主数据 · 权限点授权申请（2026-11-02）
--
-- 为什么要这张表：横幅上那颗「申请授权」按钮要的是**一条能走完的链路**。
-- 只写一行"有人申请了"而没有任何地方能看见、能处理，就是又一处
-- "有能力却说未接入" —— 那正是本轮之前一直在修的缺陷类型。
-- 所以这张表配套必须有：主体侧提交 → 运营端矩阵页看到待处理 → 同意即真的授权
-- （授权写的是 agri_md_role_permission，与拦截器读的是同一张表）。
--
-- 为什么 applicant 存用户名而不是主键：权限点本来就是按"平台账号用户名 → 本地账号"桥接的
-- （见 PermissionServiceImpl.localUserIdByUsername）。存主键会出现两套身份口径，
-- 而运营端令牌的主键来自 core-platform、主体侧令牌来自本模块，两边不同源。
--
-- 为什么**不加唯一键**：全局逻辑删除（application.yml 的 logic-delete-field: delFlag）会让
-- delete() 只置 del_flag=1、行仍占着唯一键，于是"驳回后重新申请"必然 Duplicate entry
-- （这个坑在 agri_md_role_permission 上已经踩过一次）。重复申请由服务层查重：
-- 同一申请人对同一个点只允许一条 PENDING。
--
-- 字符序必须显式 utf8mb4_unicode_ci：本库既有表都是它，MySQL 8.4 服务器默认是
-- utf8mb4_0900_ai_ci，不写就会在 JOIN agri_md_permission / agri_md_user 时报
-- Illegal mix of collations。
--
-- 可重复执行：CREATE TABLE IF NOT EXISTS。
-- ============================================================================

CREATE TABLE IF NOT EXISTS `agri_md_permission_request` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `applicant` VARCHAR(64) NOT NULL COMMENT '申请人：平台账号用户名（与权限点桥接同一口径）',
  `applicant_name` VARCHAR(128) NULL COMMENT '申请人姓名/昵称，仅展示用',
  `perm_code` VARCHAR(191) NOT NULL COMMENT '申请的权限点编码（agri_md_permission.perm_code）',
  `perm_name` VARCHAR(128) NULL COMMENT '提交时的名称快照：点可能后续下线，快照保证申请单仍可读',
  `page_path` VARCHAR(160) NULL COMMENT '从哪个页面提的（路由），处理人能对上具体按钮',
  `reason` VARCHAR(500) NULL COMMENT '申请理由；留空就是留空，不补一个"默认理由"冒充内容',
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING / APPROVED / REJECTED',
  `handler` VARCHAR(64) NULL COMMENT '处理人：取自令牌的平台账号，不写死"admin"',
  `handle_remark` VARCHAR(500) NULL COMMENT '处理说明（驳回原因 / 授权给了哪个角色）',
  `handle_time` DATETIME NULL COMMENT 'NULL = 还没处理',
  `del_flag` INT NOT NULL DEFAULT 0,
  `tenant_id` VARCHAR(64) NULL COMMENT '申请时所处经营主体；平台运营账号为 NULL',
  `create_time` DATETIME NULL,
  `update_time` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_md_req_status` (`status`, `del_flag`),
  KEY `idx_md_req_applicant` (`applicant`, `perm_code`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '权限点授权申请';

SELECT CONCAT('permission_requests=', COUNT(*)) FROM `agri_md_permission_request`;
