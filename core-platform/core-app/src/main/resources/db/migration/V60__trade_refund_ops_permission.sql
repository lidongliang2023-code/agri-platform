-- 退款审核属于交易运营动作，不能由普通交易写权限账号执行。
UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'trade:ops')
WHERE code = 'MARKET_OPS'
  AND permissions NOT LIKE '%trade:ops%';
