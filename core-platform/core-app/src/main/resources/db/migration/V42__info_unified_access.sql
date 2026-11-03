-- 信息资讯用户端与运营端接入统一账号和 RBAC。
--
-- 与综合服务（V39）同一套词表与做法：
--   info:read / info:write  —— 平台侧通用读写位，供后续网关与审计统一识别；
--   info:consumer           —— 用户端准入（农户角色）；
--   info:admin              —— 运营端准入（市场运营角色）。
-- 用 NOT LIKE 做幂等保护：重复执行不会把同一权限追加两遍。

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'info:read')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%info:read%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'info:write')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%info:write%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'info:consumer')
WHERE code = 'FARMER'
  AND permissions NOT LIKE '%info:consumer%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'info:admin')
WHERE code = 'MARKET_OPS'
  AND permissions NOT LIKE '%info:admin%';
