-- S2B2C 四类角色接入平台统一账号与 RBAC。
-- FARMER 复用为消费者；供应商、渠道商使用独立角色，平台运营使用 MARKET_OPS。

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 's2b2c:read')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%s2b2c:read%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 's2b2c:write')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%s2b2c:write%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 's2b2c:consumer')
WHERE code = 'FARMER'
  AND permissions NOT LIKE '%s2b2c:consumer%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 's2b2c:admin')
WHERE code = 'MARKET_OPS'
  AND permissions NOT LIKE '%s2b2c:admin%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 's2b2c:fulfillment')
WHERE code = 'MARKET_OPS'
  AND permissions NOT LIKE '%s2b2c:fulfillment%';

INSERT IGNORE INTO platform_role (id, code, name, permissions) VALUES
    (1101, 'S2B2C_SUPPLIER', 'S2B2C供应商',
     '["s2b2c:read","s2b2c:write","s2b2c:supplier","s2b2c:fulfillment"]'),
    (1102, 'S2B2C_CHANNEL', 'S2B2C渠道商',
     '["s2b2c:read","s2b2c:write","s2b2c:channel"]');
