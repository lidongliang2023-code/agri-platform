-- Create Database
CREATE DATABASE IF NOT EXISTS agri_platform
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE agri_platform;

-- Create User Table
CREATE TABLE IF NOT EXISTS `agrimd_user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'User ID',
    `tenant_id` VARCHAR(32) DEFAULT NULL COMMENT 'Tenant ID',
    `username` VARCHAR(64) NOT NULL COMMENT 'Username',
    `password` VARCHAR(128) NOT NULL COMMENT 'Password',
    `nickname` VARCHAR(64) DEFAULT NULL COMMENT 'Nickname',
    `email` VARCHAR(128) DEFAULT NULL COMMENT 'Email',
    `phone` VARCHAR(32) DEFAULT NULL COMMENT 'Phone Number',
    `avatar` VARCHAR(255) DEFAULT NULL COMMENT 'Avatar URL',
    `sex` TINYINT DEFAULT 0 COMMENT 'Gender: 0-Unknown, 1-Male, 2-Female',
    `status` TINYINT DEFAULT 1 COMMENT 'Status: 0-Disabled, 1-Enabled',
    `dept_id` BIGINT DEFAULT NULL COMMENT 'Department ID',
    `del_flag` TINYINT DEFAULT 0 COMMENT 'Delete Flag: 0-Not Deleted, 1-Deleted',
    `create_by` VARCHAR(64) DEFAULT '' COMMENT 'Creator',
    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Create Time',
    `update_by` VARCHAR(64) DEFAULT '' COMMENT 'Updater',
    `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Update Time',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT 'Remark',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`),
    KEY `idx_tenant_id` (`tenant_id`),
    KEY `idx_dept_id` (`dept_id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User Table';

-- Create Role Table
CREATE TABLE IF NOT EXISTS `agrimd_role` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Role ID',
    `tenant_id` VARCHAR(32) DEFAULT NULL COMMENT 'Tenant ID',
    `role_name` VARCHAR(64) NOT NULL COMMENT 'Role Name',
    `role_key` VARCHAR(64) NOT NULL COMMENT 'Role Key',
    `role_sort` INT DEFAULT 0 COMMENT 'Role Sort',
    `data_scope` VARCHAR(50) DEFAULT '1' COMMENT 'Data Scope',
    `status` TINYINT DEFAULT 1 COMMENT 'Status: 0-Disabled, 1-Enabled',
    `del_flag` TINYINT DEFAULT 0 COMMENT 'Delete Flag: 0-Not Deleted, 1-Deleted',
    `create_by` VARCHAR(64) DEFAULT '' COMMENT 'Creator',
    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Create Time',
    `update_by` VARCHAR(64) DEFAULT '' COMMENT 'Updater',
    `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Update Time',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT 'Remark',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_role_key` (`role_key`),
    KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Role Table';

-- Create Permission Table
CREATE TABLE IF NOT EXISTS `agrimd_permission` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Permission ID',
    `parent_id` BIGINT DEFAULT 0 COMMENT 'Parent Permission ID',
    `name` VARCHAR(64) NOT NULL COMMENT 'Permission Name',
    `permission` VARCHAR(128) DEFAULT NULL COMMENT 'Permission Code',
    `menu_type` TINYINT DEFAULT 1 COMMENT 'Menu Type: 0-Directory, 1-Menu, 2-Button',
    `path` VARCHAR(255) DEFAULT NULL COMMENT 'Route Path',
    `icon` VARCHAR(64) DEFAULT NULL COMMENT 'Icon',
    `sort_order` INT DEFAULT 0 COMMENT 'Sort Order',
    `status` TINYINT DEFAULT 1 COMMENT 'Status: 0-Disabled, 1-Enabled',
    `del_flag` TINYINT DEFAULT 0 COMMENT 'Delete Flag: 0-Not Deleted, 1-Deleted',
    `create_by` VARCHAR(64) DEFAULT '' COMMENT 'Creator',
    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Create Time',
    `update_by` VARCHAR(64) DEFAULT '' COMMENT 'Updater',
    `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Update Time',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT 'Remark',
    PRIMARY KEY (`id`),
    KEY `idx_parent_id` (`parent_id`),
    KEY `idx_permission` (`permission`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Permission Table';

-- Create Department Table
CREATE TABLE IF NOT EXISTS `agrimd_dept` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Department ID',
    `tenant_id` VARCHAR(32) DEFAULT NULL COMMENT 'Tenant ID',
    `parent_id` BIGINT DEFAULT 0 COMMENT 'Parent Department ID',
    `dept_name` VARCHAR(64) NOT NULL COMMENT 'Department Name',
    `leader` VARCHAR(64) DEFAULT NULL COMMENT 'Department Leader',
    `phone` VARCHAR(32) DEFAULT NULL COMMENT 'Phone Number',
    `email` VARCHAR(128) DEFAULT NULL COMMENT 'Email',
    `sort_order` INT DEFAULT 0 COMMENT 'Sort Order',
    `status` TINYINT DEFAULT 1 COMMENT 'Status: 0-Disabled, 1-Enabled',
    `del_flag` TINYINT DEFAULT 0 COMMENT 'Delete Flag: 0-Not Deleted, 1-Deleted',
    `create_by` VARCHAR(64) DEFAULT '' COMMENT 'Creator',
    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Create Time',
    `update_by` VARCHAR(64) DEFAULT '' COMMENT 'Updater',
    `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Update Time',
    `remark` VARCHAR(500) DEFAULT NULL COMMENT 'Remark',
    PRIMARY KEY (`id`),
    KEY `idx_parent_id` (`parent_id`),
    KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Department Table';

-- Create User-Role Relation Table
CREATE TABLE IF NOT EXISTS `agrimd_user_role` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `user_id` BIGINT NOT NULL COMMENT 'User ID',
    `role_id` BIGINT NOT NULL COMMENT 'Role ID',
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User-Role Relation Table';

-- Create Role-Permission Relation Table
CREATE TABLE IF NOT EXISTS `agrimd_role_permission` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `role_id` BIGINT NOT NULL COMMENT 'Role ID',
    `permission_id` BIGINT NOT NULL COMMENT 'Permission ID',
    PRIMARY KEY (`id`),
    KEY `idx_role_id` (`role_id`),
    KEY `idx_permission_id` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Role-Permission Relation Table';

-- Insert Default Admin User (Password: admin123)
INSERT INTO `agrimd_user` (`id`, `username`, `password`, `nickname`, `status`, `del_flag`, `create_by`, `create_time`, `remark`)
VALUES (1, 'admin', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE/TU5G9STIGUa', 'Administrator', 1, 0, 'system', NOW(), 'Default Administrator Account');

-- Insert Default Roles
INSERT INTO `agrimd_role` (`id`, `role_name`, `role_key`, `role_sort`, `status`, `del_flag`, `create_by`, `create_time`, `remark`)
VALUES
(1, 'Super Admin', 'admin', 1, 1, 0, 'system', NOW(), 'Super Administrator Role'),
(2, 'Normal User', 'user', 2, 1, 0, 'system', NOW(), 'Normal User Role');

-- Insert Default Admin Permissions
INSERT INTO `agrimd_permission` (`id`, `parent_id`, `name`, `permission`, `menu_type`, `path`, `icon`, `sort_order`, `status`, `del_flag`, `create_by`, `create_time`)
VALUES
(1, 0, 'System Management', NULL, 0, NULL, 'setting', 1, 1, 0, 'system', NOW()),
(2, 1, 'User Management', 'system:user:list', 1, '/system/user', 'user', 1, 1, 0, 'system', NOW()),
(3, 1, 'Role Management', 'system:role:list', 1, '/system/role', 'role', 2, 1, 0, 'system', NOW()),
(4, 1, 'Menu Management', 'system:menu:list', 1, '/system/menu', 'menu', 3, 1, 0, 'system', NOW()),
(5, 0, 'Master Data', NULL, 0, NULL, 'database', 2, 1, 0, 'system', NOW()),
(6, 5, 'Department Management', 'masterdata:dept:list', 1, '/masterdata/dept', 'dept', 1, 1, 0, 'system', NOW()),
(100, 2, 'User Query', 'system:user:query', 2, NULL, NULL, 1, 1, 0, 'system', NOW()),
(101, 2, 'User Add', 'system:user:add', 2, NULL, NULL, 2, 1, 0, 'system', NOW()),
(102, 2, 'User Edit', 'system:user:edit', 2, NULL, NULL, 3, 1, 0, 'system', NOW()),
(103, 2, 'User Delete', 'system:user:delete', 2, NULL, NULL, 4, 1, 0, 'system', NOW()),
(104, 3, 'Role Query', 'system:role:query', 2, NULL, NULL, 1, 1, 0, 'system', NOW()),
(105, 3, 'Role Add', 'system:role:add', 2, NULL, NULL, 2, 1, 0, 'system', NOW()),
(106, 3, 'Role Edit', 'system:role:edit', 2, NULL, NULL, 3, 1, 0, 'system', NOW()),
(107, 3, 'Role Delete', 'system:role:delete', 2, NULL, NULL, 4, 1, 0, 'system', NOW());

-- Bind Admin User to Admin Role
INSERT INTO `agrimd_user_role` (`user_id`, `role_id`) VALUES (1, 1);

-- Bind Admin Role to All Permissions
INSERT INTO `agrimd_role_permission` (`role_id`, `permission_id`)
SELECT 1, `id` FROM `agrimd_permission` WHERE `del_flag` = 0;
