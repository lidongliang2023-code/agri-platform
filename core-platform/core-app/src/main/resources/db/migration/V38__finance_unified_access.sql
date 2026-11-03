-- 供应链金融借款方、资金方、运营端接入平台统一账号与 RBAC。

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:read')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%finance:read%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:write')
WHERE code IN ('FARMER', 'MARKET_OPS')
  AND permissions NOT LIKE '%finance:write%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:borrower')
WHERE code = 'FARMER'
  AND permissions NOT LIKE '%finance:borrower%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:admin')
WHERE code = 'MARKET_OPS'
  AND permissions NOT LIKE '%finance:admin%';

UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'finance:review')
WHERE code = 'MARKET_OPS'
  AND permissions NOT LIKE '%finance:review%';

INSERT IGNORE INTO platform_role (id, code, name, permissions) VALUES
    (1201, 'FINANCE_FUND', '供应链金融资金方',
     '["finance:read","finance:write","finance:fund","finance:review"]');
