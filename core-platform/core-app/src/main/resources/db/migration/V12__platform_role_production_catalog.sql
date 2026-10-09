-- 平台域角色种子：补齐 PRD 3.1 角色目录（生产管理端实际使用的 6 个角色编码）
--
-- 背景：运营端「角色与权限」页（pages/user/members/RoleList.tsx）的角色取自
-- utils/production-adapter.ts ROLE_CATALOG，编码为 farm_owner / tenant_admin / farm_manager /
-- agronomist / worker / finance。而 platform_role 表里原本只有 V1 迁移种的 SUPER_ADMIN、
-- MARKET_OPS（以及一条手工插入的 FARMER），这 6 个编码一个都不存在。
-- 结果就是：权限写入端点按 code 定位角色时全部 404，页面功能不可用。
--
-- 口径（严格遵守，不越界）：
--   1) permissions 一律填 '[]' —— 空数组表达的是「尚未配置」，这是真话；
--      凭空编一套权限码出来就是假数据。权限由运营在页面上勾选后写入。
--   2) 库里已有的 3 个角色（SUPER_ADMIN / MARKET_OPS / FARMER）一律不动。
--      FARMER 与 farm_owner 语义上疑似重复，但角色体系收敛要跟 PRD 对齐，
--      不在本轮删除，仅在此记录待裁决。
--   3) INSERT IGNORE + 显式 id：platform_role 对 code 有唯一键 uk_role_code，
--      若目标库已手工存在同名角色则跳过、保留原有行，不重复插入、不覆盖。
--      id 取 1001~1006，与 V1 种子（1/2）及雪花 ID（19 位）均不冲突。

INSERT IGNORE INTO platform_role (id, code, name, permissions) VALUES
    (1001, 'farm_owner',   '农场主',     '[]'),
    (1002, 'tenant_admin', '租户管理员', '[]'),
    (1003, 'farm_manager', '农场管理员', '[]'),
    (1004, 'agronomist',   '农艺师',     '[]'),
    (1005, 'worker',       '作业员工',   '[]'),
    (1006, 'finance',      '财务人员',   '[]');
