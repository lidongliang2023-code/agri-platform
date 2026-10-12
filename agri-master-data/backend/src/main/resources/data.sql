INSERT INTO `agri_md_user` (`user_code`, `username`, `password`, `real_name`, `status`, `tenant_id`, `create_time`, `create_by`) 
SELECT 'ADMIN001', 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq', '系统管理员', 1, 'TENANT001', NOW(), 'system'
WHERE NOT EXISTS (SELECT * FROM `agri_md_user` WHERE `username` = 'admin');

INSERT INTO `agri_md_tenant` (`tenant_code`, `tenant_name`, `tenant_type`, `status`, `create_time`, `create_by`) 
SELECT 'TENANT001', '系统租户', 'SYSTEM', 1, NOW(), 'system'
WHERE NOT EXISTS (SELECT * FROM `agri_md_tenant` WHERE `tenant_code` = 'TENANT001');

INSERT INTO `agri_md_role` (`role_code`, `role_name`, `role_type`, `role_status`, `is_system`, `status`, `tenant_id`, `create_time`, `create_by`) 
SELECT 'ADMIN', '超级管理员', 'SYSTEM', 'ACTIVE', 1, 1, 'TENANT001', NOW(), 'system'
WHERE NOT EXISTS (SELECT * FROM `agri_md_role` WHERE `role_code` = 'ADMIN');
