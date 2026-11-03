-- ------------------------------------------------ V53 用户中心运营端权限码
--
-- 用户中心运营端的前端准入检查的是 uc:admin。
-- SUPER_ADMIN 的权限是 ["*"]，通配通过；MARKET_OPS 没有这个码，会卡在"暂无用户中心运营权限"。
--
-- 为什么 MARKET_OPS 应该进得来：用户中心运营端做的正是「用户/身份/认证/组织/消息/风控」
-- 这一摊日常运营，本来就是市场运营的职责范围；真正的超级管理员专属动作
-- （改角色权限、改用户状态、看身份申请）后端另有 SUPER_ADMIN_ONLY 硬约束兜着。
--
-- 幂等：已存在就不动，避免重复追加导致数组里出现两个 uc:admin。

UPDATE `platform_role`
SET `permissions` = JSON_ARRAY_APPEND(`permissions`, '$', 'uc:admin')
WHERE `code` = 'MARKET_OPS'
  AND JSON_VALID(`permissions`)
  AND JSON_SEARCH(`permissions`, 'one', 'uc:admin') IS NULL;
