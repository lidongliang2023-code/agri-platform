-- S2B2C 平台供货运营（/api/platform/supply/**、/api/platform/supply-sources 等）收口为平台自营，
-- 控制器要求 s2b2c:platform 权限码；为 MARKET_OPS 补齐该权限码，使非超管市场运营账号可正常使用平台供货工作区。
UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 's2b2c:platform')
WHERE code = 'MARKET_OPS'
  AND NOT JSON_CONTAINS(permissions, JSON_QUOTE('s2b2c:platform'));
