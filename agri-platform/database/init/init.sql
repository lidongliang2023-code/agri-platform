CREATE DATABASE IF NOT EXISTS agri_platform
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE agri_platform;

-- 用户表
CREATE TABLE IF NOT EXISTS agri_md_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(200) NOT NULL COMMENT '密码（加密存储）',
    real_name VARCHAR(50) COMMENT '真实姓名',
    phone VARCHAR(20) COMMENT '手机号',
    email VARCHAR(100) COMMENT '邮箱',
    avatar VARCHAR(500) COMMENT '头像URL',
    org_id BIGINT COMMENT '所属组织ID',
    status TINYINT DEFAULT 1 COMMENT '状态：1正常 2禁用',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记：0未删 1已删',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_org_id (org_id),
    INDEX idx_phone (phone),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 角色表
CREATE TABLE IF NOT EXISTS agri_md_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    role_code VARCHAR(50) NOT NULL UNIQUE COMMENT '角色编码',
    role_name VARCHAR(50) NOT NULL COMMENT '角色名称',
    role_key VARCHAR(100) NOT NULL COMMENT '角色标识',
    role_sort INT DEFAULT 0 COMMENT '显示顺序',
    data_scope TINYINT DEFAULT 1 COMMENT '数据范围：1全部 2本部门 3本部门及以下 4仅本人 5自定义',
    status TINYINT DEFAULT 1 COMMENT '状态：1正常 2禁用',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- 菜单权限表
CREATE TABLE IF NOT EXISTS agri_md_menu (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    menu_name VARCHAR(50) NOT NULL COMMENT '菜单名称',
    parent_id BIGINT DEFAULT 0 COMMENT '父菜单ID',
    order_num INT DEFAULT 0 COMMENT '显示顺序',
    path VARCHAR(200) COMMENT '路由地址',
    component VARCHAR(255) COMMENT '组件路径',
    menu_type CHAR(1) COMMENT '菜单类型：M目录 C菜单 F按钮',
    visible TINYINT DEFAULT 1 COMMENT '显示状态：1显示 2隐藏',
    status TINYINT DEFAULT 1 COMMENT '状态：1正常 2禁用',
    perms VARCHAR(100) COMMENT '权限标识',
    icon VARCHAR(100) COMMENT '菜单图标',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单权限表';

-- 用户角色关联表
CREATE TABLE IF NOT EXISTS agri_md_user_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    role_id BIGINT NOT NULL COMMENT '角色ID',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户和角色关联表';

-- 角色菜单关联表
CREATE TABLE IF NOT EXISTS agri_md_role_menu (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL COMMENT '角色ID',
    menu_id BIGINT NOT NULL COMMENT '菜单ID',
    INDEX idx_role_id (role_id),
    INDEX idx_menu_id (menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色和菜单关联表';

-- 组织表
CREATE TABLE IF NOT EXISTS agri_md_organization (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    org_name VARCHAR(100) NOT NULL COMMENT '组织名称',
    parent_id BIGINT DEFAULT 0 COMMENT '父组织ID',
    ancestors VARCHAR(500) COMMENT '祖级列表',
    org_code VARCHAR(50) COMMENT '组织编码',
    org_type VARCHAR(20) COMMENT '组织类型：1平台 2企业 3农场',
    contact_person VARCHAR(50) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    address VARCHAR(255) COMMENT '详细地址',
    status TINYINT DEFAULT 1 COMMENT '状态',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组织表';

-- 商品分类表
CREATE TABLE IF NOT EXISTS agri_md_product_category (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    category_name VARCHAR(100) NOT NULL COMMENT '分类名称',
    parent_id BIGINT DEFAULT 0 COMMENT '父分类ID',
    ancestors VARCHAR(500) COMMENT '祖级列表',
    order_num INT DEFAULT 0 COMMENT '排序',
    category_code VARCHAR(50) COMMENT '分类编码',
    icon VARCHAR(100) COMMENT '图标',
    status TINYINT DEFAULT 1 COMMENT '状态',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类表';

-- 商品表
CREATE TABLE IF NOT EXISTS agri_md_product (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    product_code VARCHAR(50) NOT NULL COMMENT '商品编码',
    product_name VARCHAR(200) NOT NULL COMMENT '商品名称',
    category_id BIGINT COMMENT '分类ID',
    brand VARCHAR(100) COMMENT '品牌',
    unit VARCHAR(20) COMMENT '单位',
    origin VARCHAR(100) COMMENT '产地',
    spec_json TEXT COMMENT '规格属性JSON',
    price DECIMAL(12,2) COMMENT '参考价',
    image_urls TEXT COMMENT '图片URL列表，逗号分隔',
    status TINYINT DEFAULT 1 COMMENT '状态：1上架 2下架',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_category_id (category_id),
    INDEX idx_product_code (product_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';

-- 客户表
CREATE TABLE IF NOT EXISTS agri_md_customer (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    customer_code VARCHAR(50) NOT NULL COMMENT '客户编码',
    customer_name VARCHAR(200) NOT NULL COMMENT '客户名称',
    customer_type VARCHAR(20) COMMENT '客户类型：1采购商 2经销商 3消费者',
    org_id BIGINT COMMENT '所属组织ID',
    credit_code VARCHAR(50) COMMENT '统一社会信用代码',
    legal_person VARCHAR(50) COMMENT '法人代表',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    address VARCHAR(255) COMMENT '地址',
    level VARCHAR(20) COMMENT '客户等级：A/B/C',
    status TINYINT DEFAULT 1 COMMENT '状态',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_customer_code (customer_code),
    INDEX idx_org_id (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户表';

-- 供应商表
CREATE TABLE IF NOT EXISTS agri_md_supplier (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    supplier_code VARCHAR(50) NOT NULL COMMENT '供应商编码',
    supplier_name VARCHAR(200) NOT NULL COMMENT '供应商名称',
    supplier_type VARCHAR(20) COMMENT '供应商类型：1生产型 2贸易型 3混合型',
    org_id BIGINT COMMENT '所属组织ID',
    credit_code VARCHAR(50) COMMENT '统一社会信用代码',
    legal_person VARCHAR(50) COMMENT '法人代表',
    contact_person VARCHAR(50) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    address VARCHAR(255) COMMENT '地址',
    level VARCHAR(20) COMMENT '供应商等级：A/B/C',
    status TINYINT DEFAULT 1 COMMENT '状态',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_supplier_code (supplier_code),
    INDEX idx_org_id (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商表';

-- 数据字典表
CREATE TABLE IF NOT EXISTS agri_md_dict (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    dict_name VARCHAR(100) NOT NULL COMMENT '字典名称',
    dict_code VARCHAR(100) NOT NULL COMMENT '字典编码',
    dict_type VARCHAR(20) DEFAULT 'string' COMMENT '字典类型',
    status TINYINT DEFAULT 1 COMMENT '状态',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_dict_code (dict_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字典表';

-- 字典项表
CREATE TABLE IF NOT EXISTS agri_md_dict_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    dict_id BIGINT NOT NULL COMMENT '字典ID',
    item_text VARCHAR(100) NOT NULL COMMENT '字典项文本',
    item_value VARCHAR(100) NOT NULL COMMENT '字典项值',
    item_sort INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '状态',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_dict_id (dict_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字典项表';

-- 插入默认管理员用户
INSERT INTO agri_md_user (id, username, password, real_name, status, tenant_id, create_by, create_time)
VALUES (1, 'admin', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE/TU5G9STIGUa', '系统管理员', 1, '000000', 'system', NOW());

-- 插入默认角色
INSERT INTO agri_md_role (id, role_code, role_name, role_key, role_sort, data_scope, status, tenant_id, create_by, create_time)
VALUES
(1, 'ADMIN', '超级管理员', 'admin', 1, 1, 1, '000000', 'system', NOW()),
(2, 'USER', '普通用户', 'user', 2, 4, 1, '000000', 'system', NOW());

-- 插入默认菜单
INSERT INTO agri_md_menu (id, menu_name, parent_id, order_num, path, component, menu_type, visible, status, perms, icon, tenant_id, create_by, create_time)
VALUES
(1, '系统管理', 0, 1, '/system', 'Layout', 'M', 1, 1, '', 'setting', '000000', 'system', NOW()),
(2, '用户管理', 1, 1, '/system/user', 'system/user/index', 'C', 1, 1, 'system:user:list', 'user', '000000', 'system', NOW()),
(3, '角色管理', 1, 2, '/system/role', 'system/role/index', 'C', 1, 1, 'system:role:list', 'role', '000000', 'system', NOW()),
(4, '菜单管理', 1, 3, '/system/menu', 'system/menu/index', 'C', 1, 1, 'system:menu:list', 'menu', '000000', 'system', NOW()),
(5, '用户查询', 2, 1, '', '', 'F', 0, 1, 'system:user:query', '', '000000', 'system', NOW()),
(6, '用户新增', 2, 2, '', '', 'F', 0, 1, 'system:user:add', '', '000000', 'system', NOW()),
(7, '用户编辑', 2, 3, '', '', 'F', 0, 1, 'system:user:edit', '', '000000', 'system', NOW()),
(8, '用户删除', 2, 4, '', '', 'F', 0, 1, 'system:user:delete', '', '000000', 'system', NOW()),
(9, '角色查询', 3, 1, '', '', 'F', 0, 1, 'system:role:query', '', '000000', 'system', NOW()),
(10, '角色新增', 3, 2, '', '', 'F', 0, 1, 'system:role:add', '', '000000', 'system', NOW()),
(11, '角色编辑', 3, 3, '', '', 'F', 0, 1, 'system:role:edit', '', '000000', 'system', NOW()),
(12, '角色删除', 3, 4, '', '', 'F', 0, 1, 'system:role:delete', '', '000000', 'system', NOW());

-- 绑定管理员角色
INSERT INTO agri_md_user_role (user_id, role_id, tenant_id) VALUES (1, 1, '000000');

-- 绑定管理员菜单权限
INSERT INTO agri_md_role_menu (role_id, menu_id)
SELECT 1, id FROM agri_md_menu WHERE del_flag = 0;

-- 插入默认数据字典
INSERT INTO agri_md_dict (id, dict_name, dict_code, dict_type, status, tenant_id, create_by, create_time)
VALUES
(1, '用户状态', 'user_status', 'int', 1, '000000', 'system', NOW()),
(2, '角色状态', 'role_status', 'int', 1, '000000', 'system', NOW()),
(3, '客户类型', 'customer_type', 'string', 1, '000000', 'system', NOW()),
(4, '供应商类型', 'supplier_type', 'string', 1, '000000', 'system', NOW()),
(5, '组织类型', 'org_type', 'string', 1, '000000', 'system', NOW()),
(6, '数据范围', 'data_scope', 'int', 1, '000000', 'system', NOW());

-- 插入字典项
INSERT INTO agri_md_dict_item (dict_id, item_text, item_value, item_sort, status, tenant_id, create_by, create_time)
VALUES
(1, '正常', '1', 1, 1, '000000', 'system', NOW()),
(1, '禁用', '2', 2, 1, '000000', 'system', NOW()),
(2, '正常', '1', 1, 1, '000000', 'system', NOW()),
(2, '禁用', '2', 2, 1, '000000', 'system', NOW()),
(3, '采购商', '1', 1, 1, '000000', 'system', NOW()),
(3, '经销商', '2', 2, 1, '000000', 'system', NOW()),
(3, '消费者', '3', 3, 1, '000000', 'system', NOW()),
(4, '生产型', '1', 1, 1, '000000', 'system', NOW()),
(4, '贸易型', '2', 2, 1, '000000', 'system', NOW()),
(4, '混合型', '3', 3, 1, '000000', 'system', NOW()),
(5, '平台', '1', 1, 1, '000000', 'system', NOW()),
(5, '企业', '2', 2, 1, '000000', 'system', NOW()),
(5, '农场', '3', 3, 1, '000000', 'system', NOW()),
(6, '全部', '1', 1, 1, '000000', 'system', NOW()),
(6, '本部门', '2', 2, 1, '000000', 'system', NOW()),
(6, '本部门及以下', '3', 3, 1, '000000', 'system', NOW()),
(6, '仅本人', '4', 4, 1, '000000', 'system', NOW()),
(6, '自定义', '5', 5, 1, '000000', 'system', NOW());
