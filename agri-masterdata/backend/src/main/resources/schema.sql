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
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_region` (`product_id`, `region_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品产区关联表';
