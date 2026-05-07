USE agri_platform;

-- 添加普通用户
INSERT INTO agri_md_user (username, password, real_name, status, tenant_id, create_by, create_time)
VALUES ('user', '$2a$10$bf9RDsc03t7vwRPGsJ2lcOPcd1cIG7XR5CW4cm1cTTq340KlF9G2K', '普通用户', 1, '000000', 'system', NOW());

-- 绑定普通用户角色
INSERT INTO agri_md_user_role (user_id, role_id, tenant_id) 
SELECT (SELECT id FROM agri_md_user WHERE username = 'user'), 2, '000000';