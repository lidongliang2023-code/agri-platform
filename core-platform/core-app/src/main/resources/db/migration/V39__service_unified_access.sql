-- 综合服务用户端、服务商移动工作台与运营端接入统一账号和 RBAC。

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'service:read')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%service:read%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'service:write')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%service:write%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'service:consumer')
WHERE code = 'FARMER'
  AND permissions NOT LIKE '%service:consumer%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'service:admin')
WHERE code = 'MARKET_OPS'
  AND permissions NOT LIKE '%service:admin%';

INSERT IGNORE INTO platform_role (id, code, name, permissions) VALUES
    (1301, 'SERVICE_PROVIDER', '综合服务服务商',
     '["service:read","service:write","service:provider"]');
