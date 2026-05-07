INSERT INTO `sys_role` (`id`, `name`, `code`, `description`, `status`, `created_at`, `updated_at`) VALUES
(1, '超级管理员', 'admin', '系统超级管理员', 1, NOW(), NOW()),
(2, '普通用户', 'user', '普通用户', 1, NOW(), NOW());

INSERT INTO `sys_user` (`id`, `username`, `password`, `real_name`, `phone`, `email`, `status`, `role_id`, `organization_id`, `created_at`, `updated_at`) VALUES
(1, 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq', '超级管理员', '13800138000', 'admin@example.com', 1, 1, NULL, NOW(), NOW());

INSERT INTO `sys_permission` (`id`, `name`, `code`, `url`, `method`, `parent_id`, `sort_order`, `icon`, `type`, `status`, `created_at`, `updated_at`) VALUES
(1, '系统管理', 'system', '/system', NULL, 0, 1, 'setting', 0, 1, NOW(), NOW()),
(2, '用户管理', 'system:user', '/api/users', NULL, 1, 1, 'user', 0, 1, NOW(), NOW()),
(3, '用户列表', 'system:user:list', '/api/users', 'GET', 2, 1, NULL, 1, 1, NOW(), NOW()),
(4, '用户创建', 'system:user:create', '/api/users', 'POST', 2, 2, NULL, 1, 1, NOW(), NOW()),
(5, '用户编辑', 'system:user:update', '/api/users/{id}', 'PUT', 2, 3, NULL, 1, 1, NOW(), NOW()),
(6, '用户删除', 'system:user:delete', '/api/users/{id}', 'DELETE', 2, 4, NULL, 1, 1, NOW(), NOW()),
(7, '角色管理', 'system:role', '/api/roles', NULL, 1, 2, 'team', 0, 1, NOW(), NOW()),
(8, '权限管理', 'system:permission', '/api/permissions', NULL, 1, 3, 'lock', 0, 1, NOW(), NOW());

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5),
(1, 6),
(1, 7),
(1, 8);