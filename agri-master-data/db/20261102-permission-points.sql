-- ============================================================================
-- 主数据 · 按钮级 / API 级权限点（2026-11-02）
--
-- 为什么只动两处：`agri_md_permission` 与 `agri_md_role_permission` 的**真实列**一直都在
-- （id / perm_code / perm_name / perm_type / api_path / http_method / status / del_flag，
--  role_permission 是 role_id + perm_id），但实体只映射了 2026-10-12 为"字段对齐"补的那串
-- 全 NULL 列（主键还写成 permission_id VARCHAR）—— 结果谁都写不进去，两张表一直 0 行，
-- 角色详情里的「接口权限」也永远是 0。本轮把映射改回真实列，并加一列 module 存控制器 @Tag
-- 的中文名，矩阵页按它分组；另一处把 perm_code 放宽，因为编码里装的是整条端点路径模板。
--
-- 目录数据不手工编：由 PermissionPointCatalogService 从 Spring 的实际端点映射同步，
-- 端点消失时置 del_flag=1，所以这张表不会与代码漂移。
--
-- 可重复执行：加列先查 information_schema（MySQL 8.4 没有 ADD COLUMN IF NOT EXISTS）。
-- 字符序沿用 utf8mb4_unicode_ci（与全库一致，跨表 JOIN 字符串列不会报 Illegal mix of collations）。
-- ============================================================================

SET @col_mod := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'agri_md_permission' AND column_name = 'module');
SET @sql_mod := IF(@col_mod = 0,
  'ALTER TABLE `agri_md_permission` ADD COLUMN `module` VARCHAR(64) NULL COMMENT ''所属功能模块（同步自控制器 @Tag 名称）'' AFTER `http_method`',
  'SELECT ''agri_md_permission.module 已存在''');
PREPARE st FROM @sql_mod; EXECUTE st; DEALLOCATE PREPARE st;

SET @idx_mod := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'agri_md_permission' AND index_name = 'idx_md_perm_module');
SET @sql_idx := IF(@idx_mod = 0,
  'ALTER TABLE `agri_md_permission` ADD INDEX `idx_md_perm_module` (`module`, `del_flag`)',
  'SELECT ''idx_md_perm_module 已存在''');
PREPARE st FROM @sql_idx; EXECUTE st; DEALLOCATE PREPARE st;

-- 授权表也补一条按权限点反查的索引（收紧判定要问"这个点有没有任何角色持有"）
SET @idx_rp := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'agri_md_role_permission' AND index_name = 'idx_md_rp_perm');
SET @sql_rp := IF(@idx_rp = 0,
  'ALTER TABLE `agri_md_role_permission` ADD INDEX `idx_md_rp_perm` (`perm_id`, `del_flag`)',
  'SELECT ''idx_md_rp_perm 已存在''');
PREPARE st FROM @sql_rp; EXECUTE st; DEALLOCATE PREPARE st;

-- perm_code 放的是 "METHOD /路径模板"（如 POST /api/product/channel-sku/{id}），原来只有 VARCHAR(64)。
-- 目录由端点同步生成，路径长度不由人控制：长一点就 "Data too long for column 'perm_code'"，
-- 而那次同步在事务里，结果是整批权限点一个都建不出来。这里一次放宽到 191（utf8mb4 下 191*4 < 3072，
-- 唯一索引仍可用）。
SET @widen := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'agri_md_permission'
    AND column_name = 'perm_code' AND character_maximum_length < 191);
SET @sql_widen := IF(@widen > 0,
  'ALTER TABLE `agri_md_permission` MODIFY COLUMN `perm_code` VARCHAR(191) NOT NULL COMMENT ''权限点编码：METHOD + 端点路径模板''',
  'SELECT ''perm_code 宽度已足够''');
PREPARE st FROM @sql_widen; EXECUTE st; DEALLOCATE PREPARE st;

-- 现状核对（本轮同步接口上线后应看到 permissions > 0、role_permissions 仍为 0）
SELECT CONCAT('permissions=', COUNT(*)) FROM `agri_md_permission`;
SELECT CONCAT('role_permissions=', COUNT(*)) FROM `agri_md_role_permission`;
