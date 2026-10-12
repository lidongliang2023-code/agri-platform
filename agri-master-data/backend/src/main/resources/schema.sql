CREATE TABLE IF NOT EXISTS `agri_md_user` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_code` VARCHAR(64) NOT NULL COMMENT '用户编码',
  `username` VARCHAR(64) NOT NULL UNIQUE COMMENT '用户名',
  `password` VARCHAR(255) NOT NULL COMMENT '密码',
  `real_name` VARCHAR(128) COMMENT '真实姓名',
  `nick_name` VARCHAR(64) COMMENT '昵称',
  `user_type` VARCHAR(32) COMMENT '用户类型',
  `id_card_type` VARCHAR(32) COMMENT '证件类型',
  `id_card_no` VARCHAR(64) COMMENT '证件号码',
  `phone` VARCHAR(32) COMMENT '手机号',
  `email` VARCHAR(128) COMMENT '邮箱',
  `avatar_url` VARCHAR(512) COMMENT '头像URL',
  `gender` VARCHAR(16) COMMENT '性别',
  `birthday` DATE COMMENT '出生日期',
  `province` VARCHAR(64) COMMENT '省份',
  `city` VARCHAR(64) COMMENT '城市',
  `district` VARCHAR(64) COMMENT '区县',
  `address` VARCHAR(512) COMMENT '详细地址',
  `org_id` BIGINT COMMENT '所属组织ID',
  `user_status` VARCHAR(32) COMMENT '用户状态',
  `real_name_status` VARCHAR(32) COMMENT '实名状态',
  `risk_level` VARCHAR(32) COMMENT '风险等级',
  `credit_score` INT COMMENT '信用评分',
  `last_login_time` DATETIME COMMENT '最后登录时间',
  `last_login_ip` VARCHAR(64) COMMENT '最后登录IP',
  `login_count` INT COMMENT '登录次数',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_phone` (`phone`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

CREATE TABLE IF NOT EXISTS `agri_md_tenant` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '租户编码',
  `tenant_name` VARCHAR(128) NOT NULL COMMENT '租户名称',
  `tenant_type` VARCHAR(32) COMMENT '租户类型',
  `contact_name` VARCHAR(64) COMMENT '联系人',
  `contact_phone` VARCHAR(32) COMMENT '联系电话',
  `email` VARCHAR(128) COMMENT '邮箱',
  `province` VARCHAR(64) COMMENT '省份',
  `city` VARCHAR(64) COMMENT '城市',
  `district` VARCHAR(64) COMMENT '区县',
  `address` VARCHAR(512) COMMENT '详细地址',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `contact_person` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `contact_email` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `logo_url` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `domain` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `expire_time` DATETIME NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `max_users` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `tenant_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_code` (`tenant_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户表';

CREATE TABLE IF NOT EXISTS `agri_md_tenant_quota` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` VARCHAR(64) NOT NULL COMMENT '租户ID',
  `user_limit` INT DEFAULT 100 COMMENT '用户数量限制',
  `storage_limit` BIGINT DEFAULT 1073741824 COMMENT '存储空间限制(字节)',
  `product_limit` INT DEFAULT 1000 COMMENT '商品数量限制',
  `api_limit` INT DEFAULT 10000 COMMENT 'API调用限制(次/天)',
  `used_users` INT DEFAULT 0 COMMENT '已使用用户数',
  `used_storage` BIGINT DEFAULT 0 COMMENT '已使用存储空间',
  `used_products` INT DEFAULT 0 COMMENT '已使用商品数',
  `used_api` INT DEFAULT 0 COMMENT '今日已调用API次数',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `quota_type` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `org_limit` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `used_orgs` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `max_value` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `current_value` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户配额表';

CREATE TABLE IF NOT EXISTS `agri_md_role` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `role_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '角色编码',
  `role_name` VARCHAR(128) NOT NULL COMMENT '角色名称',
  `role_type` VARCHAR(32) COMMENT '角色类型',
  `parent_id` BIGINT COMMENT '父角色ID',
  `role_level` INT COMMENT '角色级别',
  `role_desc` VARCHAR(512) COMMENT '角色描述',
  `role_status` VARCHAR(32) COMMENT '角色状态',
  `is_system` INT DEFAULT 0 COMMENT '是否系统角色',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `role_key` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `description` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `data_scope` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_code` (`role_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

CREATE TABLE IF NOT EXISTS `agri_md_user_role` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `role_id` BIGINT NOT NULL COMMENT '角色ID',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`, `role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表';

CREATE TABLE IF NOT EXISTS `agri_md_menu` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `menu_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '菜单编码',
  `menu_name` VARCHAR(128) NOT NULL COMMENT '菜单名称',
  `parent_id` BIGINT COMMENT '父菜单ID',
  `menu_type` VARCHAR(32) COMMENT '菜单类型',
  `path` VARCHAR(256) COMMENT '路径',
  `component` VARCHAR(256) COMMENT '组件',
  `icon` VARCHAR(128) COMMENT '图标',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `order_num` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `visible` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `perms` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_menu_code` (`menu_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜单表';

CREATE TABLE IF NOT EXISTS `agri_md_role_menu` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `role_id` BIGINT NOT NULL COMMENT '角色ID',
  `menu_id` BIGINT NOT NULL COMMENT '菜单ID',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_menu` (`role_id`, `menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色菜单关联表';

CREATE TABLE IF NOT EXISTS `agri_md_permission` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `perm_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '权限编码',
  `perm_name` VARCHAR(128) NOT NULL COMMENT '权限名称',
  `perm_type` VARCHAR(32) COMMENT '权限类型',
  `api_path` VARCHAR(512) COMMENT 'API路径',
  `http_method` VARCHAR(16) COMMENT 'HTTP方法',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `permission_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `permission_code` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `permission_name` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `permission_type` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `parent_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `permission_path` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `permission_icon` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `permission_url` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `component` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `is_leaf` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `sort_order` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_perm_code` (`perm_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表';

CREATE TABLE IF NOT EXISTS `agri_md_role_permission` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `role_id` BIGINT NOT NULL COMMENT '角色ID',
  `perm_id` BIGINT NOT NULL COMMENT '权限ID',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `permission_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_perm` (`role_id`, `perm_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色权限关联表';

CREATE TABLE IF NOT EXISTS `agri_md_organization` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `org_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '组织编码',
  `org_name` VARCHAR(128) NOT NULL COMMENT '组织名称',
  `org_type` VARCHAR(32) COMMENT '组织类型',
  `parent_id` BIGINT COMMENT '父组织ID',
  `legal_person` VARCHAR(64) COMMENT '法人',
  `contact_mobile` VARCHAR(32) COMMENT '联系电话',
  `province` VARCHAR(64) COMMENT '省份',
  `city` VARCHAR(64) COMMENT '城市',
  `district` VARCHAR(64) COMMENT '区县',
  `longitude` DECIMAL(10,7) COMMENT '经度',
  `latitude` DECIMAL(10,7) COMMENT '纬度',
  `registered_capital` DECIMAL(18,2) COMMENT '注册资本',
  `business_scope` VARCHAR(1024) COMMENT '经营范围',
  `business_license` VARCHAR(256) COMMENT '营业执照',
  `tax_no` VARCHAR(64) COMMENT '税号',
  `logo_url` VARCHAR(512) COMMENT 'LOGO URL',
  `intro` VARCHAR(1024) COMMENT '简介',
  `member_count` INT COMMENT '成员数量',
  `org_status` VARCHAR(32) COMMENT '组织状态',
  `risk_level` VARCHAR(32) COMMENT '风险等级',
  `credit_level` VARCHAR(32) COMMENT '信用等级',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `ancestors` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `org_level` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `org_path` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `contact_person` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `contact_phone` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `address` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `auth_status` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `audit_note` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_org_code` (`org_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='组织表';

CREATE TABLE IF NOT EXISTS `agri_md_department` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `dept_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '部门编码',
  `dept_name` VARCHAR(128) NOT NULL COMMENT '部门名称',
  `parent_id` BIGINT COMMENT '父部门ID',
  `org_id` BIGINT COMMENT '所属组织ID',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `dept_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `parent_dept_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `dept_manager` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `contact_phone` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `dept_count` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dept_code` (`dept_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门表';

CREATE TABLE IF NOT EXISTS `agri_md_position` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `pos_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '岗位编码',
  `pos_name` VARCHAR(128) NOT NULL COMMENT '岗位名称',
  `dept_id` BIGINT COMMENT '所属部门ID',
  `pos_level` VARCHAR(32) COMMENT '岗位级别',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `position_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `position_code` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `position_name` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `position_level` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `position_desc` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `incumbent_count` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pos_code` (`pos_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='岗位表';

CREATE TABLE IF NOT EXISTS `agri_md_product` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `product_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '商品编码',
  `product_name` VARCHAR(256) NOT NULL COMMENT '商品名称',
  `category_id` BIGINT COMMENT '分类ID',
  `category_path` VARCHAR(512) COMMENT '分类路径',
  `brand` VARCHAR(128) COMMENT '品牌',
  `spec` VARCHAR(256) COMMENT '规格',
  `unit` VARCHAR(32) COMMENT '单位',
  `price` DECIMAL(18,4) COMMENT '价格',
  `min_order_qty` INT COMMENT '最小起订量',
  `description` TEXT COMMENT '描述',
  `audit_status` VARCHAR(32) COMMENT '审核状态',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `origin` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `spec_json` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `image_urls` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_code` (`product_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';

CREATE TABLE IF NOT EXISTS `agri_md_product_category` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `category_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '分类编码',
  `category_name` VARCHAR(128) NOT NULL COMMENT '分类名称',
  `parent_id` BIGINT COMMENT '父分类ID',
  `category_level` INT COMMENT '分类级别',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `ancestors` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `order_num` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `icon` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_code` (`category_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品分类表';

CREATE TABLE IF NOT EXISTS `agri_md_product_attribute` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `attr_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '属性编码',
  `attr_name` VARCHAR(128) NOT NULL COMMENT '属性名称',
  `category_id` BIGINT COMMENT '所属分类ID',
  `attr_type` VARCHAR(32) COMMENT '属性类型',
  `attr_value` TEXT COMMENT '属性值',
  `is_required` INT DEFAULT 0 COMMENT '是否必填',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `attribute_code` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `attribute_name` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `attribute_type` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `unit` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `options` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `is_unique` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_attr_code` (`attr_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品属性表';

CREATE TABLE IF NOT EXISTS `agri_md_quality_standard` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `standard_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '标准编码',
  `standard_name` VARCHAR(256) NOT NULL COMMENT '标准名称',
  `standard_type` VARCHAR(32) COMMENT '标准类型',
  `category_id` BIGINT COMMENT '适用分类ID',
  `standard_content` TEXT COMMENT '标准内容',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `attribute_code` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `attribute_name` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `operator` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `min_value` DECIMAL(18,4) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `max_value` DECIMAL(18,4) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `unit` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `reference` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_standard_code` (`standard_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质量标准表';

CREATE TABLE IF NOT EXISTS `agri_md_customer` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `customer_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '客户编码',
  `customer_name` VARCHAR(256) NOT NULL COMMENT '客户名称',
  `customer_type` VARCHAR(32) COMMENT '客户类型',
  `contact_name` VARCHAR(64) COMMENT '联系人',
  `contact_phone` VARCHAR(32) COMMENT '联系电话',
  `email` VARCHAR(128) COMMENT '邮箱',
  `province` VARCHAR(64) COMMENT '省份',
  `city` VARCHAR(64) COMMENT '城市',
  `district` VARCHAR(64) COMMENT '区县',
  `address` VARCHAR(512) COMMENT '详细地址',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `short_name` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `org_id` BIGINT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `credit_code` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `legal_person` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `level` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_code` (`customer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户表';

CREATE TABLE IF NOT EXISTS `agri_md_supplier` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `supplier_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '供应商编码',
  `supplier_name` VARCHAR(256) NOT NULL COMMENT '供应商名称',
  `supplier_type` VARCHAR(32) COMMENT '供应商类型',
  `contact_name` VARCHAR(64) COMMENT '联系人',
  `contact_phone` VARCHAR(32) COMMENT '联系电话',
  `email` VARCHAR(128) COMMENT '邮箱',
  `province` VARCHAR(64) COMMENT '省份',
  `city` VARCHAR(64) COMMENT '城市',
  `district` VARCHAR(64) COMMENT '区县',
  `address` VARCHAR(512) COMMENT '详细地址',
  `qualification` TEXT COMMENT '资质信息',
  `supply_category` VARCHAR(512) COMMENT '供应品类',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `short_name` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `org_id` BIGINT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `credit_code` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `legal_person` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `contact_person` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `level` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_supplier_code` (`supplier_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='供应商表';

CREATE TABLE IF NOT EXISTS `agri_md_customer_supplier_relation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `customer_id` BIGINT NOT NULL COMMENT '客户ID',
  `supplier_id` BIGINT NOT NULL COMMENT '供应商ID',
  `relation_type` VARCHAR(32) COMMENT '关系类型',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `relation_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `cooperation_level` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `start_date` DATETIME NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `end_date` DATETIME NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `transaction_count` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `total_amount` DECIMAL(18,4) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `avg_unit_price` DECIMAL(18,4) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `payment_status` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `dispute_count` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_supplier` (`customer_id`, `supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户供应商关系表';

CREATE TABLE IF NOT EXISTS `agri_md_address_region` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `region_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '区域编码',
  `region_name` VARCHAR(128) NOT NULL COMMENT '区域名称',
  `parent_code` VARCHAR(64) COMMENT '父区域编码',
  `region_level` INT COMMENT '区域级别',
  `longitude` DECIMAL(10,7) COMMENT '经度',
  `latitude` DECIMAL(10,7) COMMENT '纬度',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `region_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `level` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `pinyin` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `pinyin_abbr` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `area_code` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `postal_code` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `tenant_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_region_code` (`region_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='行政区划表';

CREATE TABLE IF NOT EXISTS `agri_md_production_region` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `region_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '产区编码',
  `region_name` VARCHAR(128) NOT NULL COMMENT '产区名称',
  `address_code` VARCHAR(64) COMMENT '行政区划编码',
  `climate_type` VARCHAR(64) COMMENT '气候类型',
  `soil_type` VARCHAR(64) COMMENT '土壤类型',
  `elevation` INT COMMENT '海拔(米)',
  `description` TEXT COMMENT '产区描述',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `parent_code` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `region_type` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `province` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `city` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `district` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `address` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `longitude` DECIMAL(18,4) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `latitude` DECIMAL(18,4) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `rainfall` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `sunshine_hours` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `specialty` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `certification` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pr_region_code` (`region_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产区表';

CREATE TABLE IF NOT EXISTS `agri_md_logistics_node` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `node_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '节点编码',
  `node_name` VARCHAR(128) NOT NULL COMMENT '节点名称',
  `node_type` VARCHAR(32) COMMENT '节点类型',
  `address_code` VARCHAR(64) COMMENT '行政区划编码',
  `longitude` DECIMAL(10,7) COMMENT '经度',
  `latitude` DECIMAL(10,7) COMMENT '纬度',
  `description` TEXT COMMENT '节点描述',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `node_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `region_code` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `address` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `capacity` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `services` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `contact_person` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `contact_phone` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_node_code` (`node_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='物流节点表';

CREATE TABLE IF NOT EXISTS `agri_md_dict` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `dict_code` VARCHAR(64) NOT NULL UNIQUE COMMENT '字典编码',
  `dict_name` VARCHAR(128) NOT NULL COMMENT '字典名称',
  `dict_type` VARCHAR(32) COMMENT '字典类型',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `description` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dict_code` (`dict_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='字典表';

CREATE TABLE IF NOT EXISTS `agri_md_dict_item` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `dict_code` VARCHAR(64) NOT NULL COMMENT '字典编码',
  `item_code` VARCHAR(64) NOT NULL COMMENT '字典项编码',
  `item_value` VARCHAR(256) COMMENT '字典项值',
  `item_label` VARCHAR(128) COMMENT '字典项标签',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `dict_id` BIGINT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `item_name` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `item_text` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `item_sort` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dict_item` (`dict_code`, `item_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='字典项表';

CREATE TABLE IF NOT EXISTS `agri_md_user_authentication` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `auth_type` VARCHAR(32) COMMENT '认证类型',
  `auth_status` VARCHAR(32) COMMENT '认证状态',
  `auth_data` TEXT COMMENT '认证数据',
  `audit_time` DATETIME COMMENT '审核时间',
  `audit_by` VARCHAR(64) COMMENT '审核人',
  `audit_note` VARCHAR(512) COMMENT '审核备注',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `auth_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `auth_level` INT NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `auth_result` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `verified_by` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `verified_time` DATETIME NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_auth` (`user_id`, `auth_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户认证表';

CREATE TABLE IF NOT EXISTS `agri_md_user_identity` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `identity_type` VARCHAR(32) COMMENT '身份类型',
  `identity_data` TEXT COMMENT '身份数据',
  `is_default` INT DEFAULT 0 COMMENT '是否默认',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `identity_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `identity_name` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `identity_status` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `verified_time` DATETIME NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `expire_time` DATETIME NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户身份表';

CREATE TABLE IF NOT EXISTS `agri_md_user_profile` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `profile_key` VARCHAR(64) NOT NULL COMMENT '画像标签键',
  `profile_value` VARCHAR(512) COMMENT '画像标签值',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `profile_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `profile_type` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `profile_data` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `tags` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `score_data` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `remark` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_profile` (`user_id`, `profile_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户画像表';

CREATE TABLE IF NOT EXISTS `agri_md_data_permission` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `role_id` BIGINT NOT NULL COMMENT '角色ID',
  `perm_type` VARCHAR(32) COMMENT '数据权限类型',
  `perm_scope` VARCHAR(512) COMMENT '数据权限范围',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `dp_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `data_scope` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `custom_depts` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `data_conditions` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `module_type` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据权限表';

CREATE TABLE IF NOT EXISTS `agri_md_org_hierarchy` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `org_id` BIGINT NOT NULL COMMENT '组织ID',
  `ancestor_id` BIGINT NOT NULL COMMENT '祖先组织ID',
  `depth` INT COMMENT '层级深度',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `hierarchy_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `parent_org_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `ancestor_org_id` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `path` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_org_ancestor` (`org_id`, `ancestor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='组织层级表';

CREATE TABLE IF NOT EXISTS `agri_md_product_region` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `product_id` BIGINT NOT NULL COMMENT '商品ID',
  `region_id` BIGINT NOT NULL COMMENT '产区ID',
  `status` INT DEFAULT 0 COMMENT '状态',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `region_code` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `region_name` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `region_type` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `main_products` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `description` VARCHAR(500) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `advantage` VARCHAR(255) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `capacity` DECIMAL(18,4) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  `output_ratio` DECIMAL(18,4) NULL COMMENT '实体字段对齐补齐（2026-10-12）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_region` (`product_id`, `region_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品产区关联表';

-- ---------------------------------------------------------------------------
-- 编码规则表（2026-10-12 新增）
--
-- 为什么此时才建：运营端「数据标准 → 编码规则」页与 /admin/masterdata/standard/code-rule/*
-- 六个端点早就存在，但后端是空壳（列表恒返回空数组、test 返回写死的 TEST001），
-- 页面上永远看不到东西 —— 缺的不是数据，是这张表。建表让该族从占位变成真实现。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `agri_md_code_rule` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `rule_code` VARCHAR(64) NOT NULL COMMENT '规则编码',
  `rule_name` VARCHAR(128) NOT NULL COMMENT '规则名称',
  `rule_type` VARCHAR(32) COMMENT '规则类型：auto 自动生成 / manual 手动输入',
  `rule_pattern` VARCHAR(255) COMMENT '编码格式示例，如 PRD{yyyyMMdd}{seq}',
  `description` VARCHAR(500) COMMENT '规则说明',
  `seq_length` INT COMMENT '序号段长度（不足补零）',
  `date_format` VARCHAR(64) COMMENT '日期段格式，如 yyyyMMdd；为空表示不含日期',
  `prefix` VARCHAR(32) COMMENT '前缀',
  `suffix` VARCHAR(32) COMMENT '后缀',
  `status` INT DEFAULT 1 COMMENT '状态：1 启用 / 0 禁用',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志：0 未删除 / 1 已删除',
  `tenant_id` VARCHAR(64) COMMENT '租户ID（此处存租户编码）',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `remark` VARCHAR(500) COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code_rule_code` (`rule_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='编码规则表';

-- ---------------------------------------------------------------------------
-- 系统配置表（2026-10-12 新增）
--
-- 与编码规则同样的情况：/admin/masterdata/config/* 七个端点早就存在，
-- 但列表恒返回空数组、getConfigValue 恒返回写死的 "test.value"、
-- 详情报的是 "test.key / 测试配置"，页面上看不到任何真实配置项。
--
-- 列名注意：`key` 与 `group` 都是 MySQL 保留字，故用 `config_key` / `group_name`。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `agri_md_system_config` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `config_key` VARCHAR(128) NOT NULL COMMENT '参数编码，唯一',
  `config_name` VARCHAR(128) NOT NULL COMMENT '参数名称',
  `config_value` TEXT COMMENT '参数值（JSON 类型也存这里，按文本保存）',
  `config_type` VARCHAR(32) COMMENT '数据类型：string/number/boolean/json',
  `group_name` VARCHAR(64) COMMENT '参数分组',
  `sort_order` INT DEFAULT 0 COMMENT '组内排序',
  `description` VARCHAR(500) COMMENT '参数说明',
  `status` INT DEFAULT 1 COMMENT '状态：1 启用 / 0 禁用',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志：0 未删除 / 1 已删除',
  `tenant_id` VARCHAR(64) COMMENT '租户ID（全局配置为空）',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `remark` VARCHAR(500) COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_system_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- ---------------------------------------------------------------------------
-- 租户套餐表（2026-10-12 新增）
--
-- 与编码规则/系统配置同样：/admin/masterdata/tenant/package/* 四个端点早就存在，
-- 但 getPackageList 是在代码里手搓三个 VO（基础版/专业版/企业版）返回的，
-- 增删改全是空方法体 —— 页面上"能看懂、能编辑"，改完刷新就没了。
--
-- **为什么没有"套餐功能清单"子表**：页面上的 pkg.features[] 并不是独立的功能目录，
-- 而是下面 user_limit / org_limit / product_limit / storage_limit / api_limit / 服务级别
-- 这几个字段的展示形态（页面的 editPackage 就是把这些名字反解回表单数值）。
-- 再建一张子表等于把同一批数字存两遍，必然对不齐。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `agri_md_tenant_package` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `package_code` VARCHAR(64) NOT NULL COMMENT '套餐编码：BASE/PRO/ENTERPRISE，唯一',
  `package_name` VARCHAR(128) NOT NULL COMMENT '套餐名称',
  `package_desc` VARCHAR(500) COMMENT '套餐说明',
  `user_limit` INT COMMENT '用户数上限',
  `org_limit` INT COMMENT '组织数上限',
  `product_limit` INT COMMENT '商品数上限',
  `storage_limit` BIGINT COMMENT '存储上限（字节）',
  `api_limit` INT COMMENT '每日 API 调用上限',
  `service_level` INT COMMENT '服务级别：1 基础 / 2 标准 / 3 专属',
  `service_level_desc` VARCHAR(128) COMMENT '服务级别描述，如"7x24小时专属支持"',
  `price` DECIMAL(18,2) COMMENT '价格',
  `duration` INT COMMENT '有效期（天）',
  `status` INT DEFAULT 1 COMMENT '状态：1 启用 / 0 禁用',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志：0 未删除 / 1 已删除',
  `tenant_id` VARCHAR(64) COMMENT '租户ID（套餐为平台级配置，通常为空）',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `remark` VARCHAR(500) COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_package_code` (`package_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户套餐表';

-- ---------------------------------------------------------------------------
-- 数据质量问题表（2026-10-12 新增）
--
-- /admin/masterdata/quality/* 六个端点（statistics / issues / issues/{id} / handle /
-- batch-handle / trend）此前全是空壳：统计是 builder 写死的数字、列表恒返回空数组。
-- 质量监控、问题工单、质量仪表盘三个页面因此永远看不到数据。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `agri_md_quality_issue` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `issue_code` VARCHAR(64) NOT NULL COMMENT '问题编码，唯一',
  `issue_type` VARCHAR(64) COMMENT '问题类型：completeness 缺失 / accuracy 格式 / consistency 一致性 / uniqueness 重复 / timeliness 时效',
  `severity` VARCHAR(16) COMMENT '严重程度：high / medium / low',
  `domain_code` VARCHAR(64) COMMENT '所属数据域编码：user / org / product / permission / customer',
  `domain_name` VARCHAR(128) COMMENT '所属数据域名称',
  `description` VARCHAR(500) COMMENT '问题描述',
  `affected_data` VARCHAR(255) COMMENT '关联数据（表名/字段/主键等定位信息）',
  `affected_records` INT COMMENT '受影响记录数',
  `status` VARCHAR(32) COMMENT '处理状态：pending 待处理 / processing 处理中 / resolved 已解决 / ignored 已忽略',
  `handler` VARCHAR(64) COMMENT '处理人',
  `resolve_remark` VARCHAR(500) COMMENT '处置说明',
  `rule_id` BIGINT NULL COMMENT '检出的质量规则ID（手工登记的问题为空）',
  `detect_time` DATETIME COMMENT '检测（发现）时间',
  `resolve_time` DATETIME COMMENT '处置完成时间',
  `tenant_id` VARCHAR(64) COMMENT '租户ID（此处存租户编码）',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志：0 未删除 / 1 已删除',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `remark` VARCHAR(500) COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quality_issue_code` (`issue_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据质量问题表';

-- ---------------------------------------------------------------------------
-- 质量问题处置记录表（2026-10-12 新增）
--
-- 质量详情里要展示"处置历史"（谁、什么时候、做了什么）。这部分必须是独立的表：
-- 只把最后一次处置结果写在问题行上，等于把"过程"丢了，出了问题回溯不了。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `agri_md_quality_issue_handle` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `issue_id` BIGINT NOT NULL COMMENT '问题ID',
  `action` VARCHAR(64) COMMENT '动作：fixed 已修复 / ignored 无需处理 / processing 转处理中 / reopen 重新打开',
  `operator` VARCHAR(64) COMMENT '操作人',
  `remark` VARCHAR(500) COMMENT '处置说明',
  `status` INT DEFAULT 1 COMMENT '状态：1 有效 / 0 失效',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  PRIMARY KEY (`id`),
  KEY `idx_quality_handle_issue` (`issue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质量问题处置记录表';

-- ---------------------------------------------------------------------------
-- 质量规则表（2026-10-12 新增）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `agri_md_quality_rule` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `rule_code` VARCHAR(64) NOT NULL COMMENT '规则编码，唯一',
  `rule_name` VARCHAR(128) NOT NULL COMMENT '规则名称',
  `rule_type` VARCHAR(32) COMMENT '规则类型：completeness 缺失 / accuracy 格式 / consistency 一致性 / uniqueness 重复 / timeliness 时效',
  `description` VARCHAR(500) COMMENT '规则说明',
  `target_domain` VARCHAR(64) COMMENT '目标数据域编码：user / org / product / permission / customer',
  `target_table` VARCHAR(128) COMMENT '目标表名',
  `target_field` VARCHAR(128) COMMENT '目标字段',
  `expression` VARCHAR(500) COMMENT '校验表达式或判定条件',
  `threshold` INT COMMENT '阈值（0-100）',
  `severity` VARCHAR(16) COMMENT '检出问题的默认严重程度：high / medium / low',
  `status` INT DEFAULT 1 COMMENT '状态：1 启用 / 0 禁用',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `remark` VARCHAR(500) COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quality_rule_code` (`rule_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据质量规则表';

-- ---------------------------------------------------------------------------
-- 质量检测任务表（2026-10-12 新增）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `agri_md_quality_task` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `task_code` VARCHAR(64) NOT NULL COMMENT '任务编码，唯一',
  `task_name` VARCHAR(128) NOT NULL COMMENT '任务名称',
  `task_type` VARCHAR(32) COMMENT '执行类型：scheduled 定时 / realtime 实时 / manual 手动',
  `cron_expression` VARCHAR(64) COMMENT '调度表达式（定时任务）',
  `status` VARCHAR(32) COMMENT '任务状态：scheduled / running / completed / failed / paused',
  `last_run_time` DATETIME COMMENT '最近执行时间',
  `next_run_time` DATETIME COMMENT '下次执行时间',
  `last_success_count` INT COMMENT '最近一次成功检测项数',
  `last_fail_count` INT COMMENT '最近一次失败（检出问题）项数',
  `success_rate` DECIMAL(5,2) COMMENT '最近一次成功率（%）',
  `run_count` INT DEFAULT 0 COMMENT '累计执行次数',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `remark` VARCHAR(500) COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quality_task_code` (`task_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质量检测任务表';

-- ---------------------------------------------------------------------------
-- 任务与规则的关联表（2026-10-12 新增）
-- 一个任务可挂多条规则，一条规则也可被多个任务引用，故用独立的关联表。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `agri_md_quality_task_rule` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `task_id` BIGINT NOT NULL COMMENT '任务ID',
  `rule_id` BIGINT NOT NULL COMMENT '规则ID',
  `status` INT DEFAULT 1 COMMENT '状态：1 有效 / 0 失效',
  `del_flag` INT DEFAULT 0 COMMENT '删除标志',
  `tenant_id` VARCHAR(64) COMMENT '租户ID',
  `create_time` DATETIME COMMENT '创建时间',
  `create_by` VARCHAR(64) COMMENT '创建人',
  `update_time` DATETIME COMMENT '更新时间',
  `update_by` VARCHAR(64) COMMENT '更新人',
  `remark` VARCHAR(500) COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quality_task_rule` (`task_id`, `rule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='质量检测任务-规则关联表';
