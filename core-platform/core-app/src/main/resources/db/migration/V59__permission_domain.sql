-- 单平台：market_id 保留兼容，不再作为用户授权切换范围。
-- 历史业务角色不因迁移获得平台认证、生产全量运营、监管执法权限。
ALTER TABLE platform_role ADD COLUMN scope_type VARCHAR(24) NOT NULL DEFAULT 'BUSINESS';
UPDATE platform_role SET scope_type='PLATFORM' WHERE code='SUPER_ADMIN';
UPDATE platform_role SET scope_type='SUBJECT' WHERE code='FARMER';
UPDATE platform_role SET scope_type='REGULATORY' WHERE code='GOVERNMENT_INSPECTOR';
