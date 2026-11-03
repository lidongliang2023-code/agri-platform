-- 交易撮合移动端统一账号需要基础交易权限；运营端仍由 trade:admin 类角色控制。

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'trade:read')
WHERE code = 'FARMER'
  AND permissions NOT LIKE '%trade:read%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'trade:write')
WHERE code = 'FARMER'
  AND permissions NOT LIKE '%trade:write%';
