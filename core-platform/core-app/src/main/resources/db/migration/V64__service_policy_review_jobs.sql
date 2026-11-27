-- Preserve policy ledger access for existing operations roles. Workflow actions require a named job.
UPDATE platform_role
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'service:policy:desk')
WHERE JSON_CONTAINS(permissions, JSON_QUOTE('service:admin'))
  AND NOT JSON_CONTAINS(permissions, JSON_QUOTE('service:policy:desk'));

INSERT INTO platform_role (id, code, name, scope_type, permissions) VALUES
(1361, 'SERVICE_POLICY_TOWN', '政策乡镇审核岗', 'REGULATORY', '["service:policy:desk","service:policy:town"]'),
(1362, 'SERVICE_POLICY_COUNTY', '政策区县审核岗', 'REGULATORY', '["service:policy:desk","service:policy:county"]'),
(1363, 'SERVICE_POLICY_PAYMENT', '政策兑付岗', 'REGULATORY', '["service:policy:desk","service:policy:payment"]');
