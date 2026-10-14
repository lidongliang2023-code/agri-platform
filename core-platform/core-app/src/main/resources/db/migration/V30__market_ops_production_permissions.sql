-- MARKET_OPS 补上生产管理运营端的权限码（production:read / production:write）
--
-- 背景：运营端准入按平台 RBAC 实时判定（子系统的 /admin/** 与 @OperatorOnly 接口
-- 分别要求 <域>:read / <域>:write）。生产管理模块的运营接口在 /api/v1/production/admin/**，
-- 要求 production:read（GET）与 production:write（非 GET）。
--
-- 口径与两点说明：
--   1) 只动 MARKET_OPS —— 它的定位就是跨域的市场运营，V1 种子本来就给了
--      trade:* / produce:* / quote:*，补一个生产域与既有口径一致；
--      SUPER_ADMIN 是 ["*"]，本就覆盖；FARMER 这类角色不能加（见下）。
--   2) 刻意**不复用** produce:* —— platform_role 里 FARMER 也持有 produce:read/write
--      （那是"生产数据"的权限，农户本来就该有）。运营端若用 produce:*，
--      等于每个农户账号都能进生产管理运营端。两个码字面相近、后果相反。
--   3) masterdata:* 与 iot:* 本轮**不加**：数据标准/租户/角色权限更像平台管理职能，
--      设备管理更像运维职能，是否交给市场运营需要单独裁决。
--
-- 幂等：先读当前值拼接，重复执行不会重复追加（用 LIKE 判存在）。

-- 注意 JSON_ARRAY_APPEND 一次只能追一个值（多个值要么写成 path/value 交替，
-- 要么像这样嵌套调用）—— 写成 (permissions,'$','a','b') 会报
-- "Incorrect parameter count in the call to native function"（实测踩到过）。
UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(
        JSON_ARRAY_APPEND(permissions, '$', 'production:read'),
        '$', 'production:write')
WHERE code = 'MARKET_OPS'
  AND permissions NOT LIKE '%production:read%';
