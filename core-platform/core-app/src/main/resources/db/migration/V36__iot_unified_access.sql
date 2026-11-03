-- 物联网用户端 / 运营端接入统一账号与平台 RBAC。
-- FARMER 可使用用户端设备、场景与告警能力；MARKET_OPS 额外拥有运营端管理权限。

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'iot:read')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%iot:read%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'iot:write')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%iot:write%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'iot:admin')
WHERE code = 'MARKET_OPS'
  AND permissions NOT LIKE '%iot:admin%';
