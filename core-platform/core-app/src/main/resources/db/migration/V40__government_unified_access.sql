-- 政府监管办事主体、移动执法人员与监管运营端接入统一账号和 RBAC。

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'gov:read')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%gov:read%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'gov:write')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%gov:write%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'gov:citizen')
WHERE code = 'FARMER'
  AND permissions NOT LIKE '%gov:citizen%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'gov:admin')
WHERE code = 'MARKET_OPS'
  AND permissions NOT LIKE '%gov:admin%';

INSERT IGNORE INTO platform_role (id, code, name, permissions) VALUES
    (1401, 'GOVERNMENT_INSPECTOR', '政府监管移动执法人员',
     '["gov:read","gov:write","gov:inspector"]');
