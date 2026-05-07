-- 物联网模块数据库表
-- 设备表
CREATE TABLE IF NOT EXISTS agri_iot_device (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    device_code VARCHAR(100) NOT NULL UNIQUE COMMENT '设备编码',
    device_name VARCHAR(100) NOT NULL COMMENT '设备名称',
    device_type VARCHAR(50) COMMENT '设备类型',
    device_model VARCHAR(100) COMMENT '设备型号',
    manufacturer VARCHAR(100) COMMENT '制造商',
    installation_location VARCHAR(255) COMMENT '安装位置',
    latitude DECIMAL(10, 6) COMMENT '纬度',
    longitude DECIMAL(10, 6) COMMENT '经度',
    org_id BIGINT COMMENT '所属组织ID',
    status TINYINT DEFAULT 1 COMMENT '状态: 1-在线 2-离线 3-故障',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记: 0-未删 1-已删',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_device_code (device_code),
    INDEX idx_org_id (org_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备表';

-- 设备数据表
CREATE TABLE IF NOT EXISTS agri_iot_device_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    device_id BIGINT NOT NULL COMMENT '设备ID',
    data_type VARCHAR(50) COMMENT '数据类型',
    data_value VARCHAR(255) COMMENT '数据值',
    data_unit VARCHAR(20) COMMENT '数据单位',
    collection_time DATETIME COMMENT '采集时间',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记: 0-未删 1-已删',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_device_id (device_id),
    INDEX idx_collection_time (collection_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备数据表';

-- 预警规则表
CREATE TABLE IF NOT EXISTS agri_iot_alert_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    rule_name VARCHAR(100) NOT NULL COMMENT '规则名称',
    rule_desc VARCHAR(255) COMMENT '规则描述',
    device_id BIGINT COMMENT '关联设备ID',
    data_type VARCHAR(50) COMMENT '数据类型',
    operator VARCHAR(20) COMMENT '比较运算符: >,<,>=,<=,==,!=',
    threshold_value VARCHAR(100) COMMENT '阈值',
    alert_level TINYINT COMMENT '预警级别: 1-低 2-中 3-高',
    status TINYINT DEFAULT 1 COMMENT '状态: 1-启用 2-禁用',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记: 0-未删 1-已删',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_device_id (device_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警规则表';

-- 预警记录表
CREATE TABLE IF NOT EXISTS agri_iot_alert (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    alert_title VARCHAR(200) COMMENT '预警标题',
    alert_content TEXT COMMENT '预警内容',
    alert_level TINYINT COMMENT '预警级别: 1-低 2-中 3-高',
    device_id BIGINT COMMENT '关联设备ID',
    rule_id BIGINT COMMENT '关联规则ID',
    data_value VARCHAR(255) COMMENT '触发数据值',
    handle_status TINYINT DEFAULT 1 COMMENT '处理状态: 1-未处理 2-处理中 3-已处理',
    handle_time DATETIME COMMENT '处理时间',
    handle_remark VARCHAR(500) COMMENT '处理备注',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记: 0-未删 1-已删',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_device_id (device_id),
    INDEX idx_handle_status (handle_status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警记录表';

-- 插入初始菜单数据
INSERT IGNORE INTO agri_md_menu (id, menu_name, parent_id, path, component, menu_type, perms, icon, order_num, visible, status, del_flag, tenant_id, create_by, create_time) VALUES
(200, '物联网管理', 0, '/iot', NULL, 'M', NULL, 'DashboardOutlined', 3, 1, 1, 0, '000000', 'admin', NOW()),
(201, '设备管理', 200, '/iot/device', '/iot/device/index', 'C', 'iot:device:list', 'ToolOutlined', 1, 1, 1, 0, '000000', 'admin', NOW()),
(202, '数据监测', 200, '/iot/data', '/iot/data/index', 'C', 'iot:data:list', 'LineChartOutlined', 2, 1, 1, 0, '000000', 'admin', NOW()),
(203, '预警管理', 200, '/iot/alert', '/iot/alert/index', 'C', 'iot:alert:list', 'WarningOutlined', 3, 1, 1, 0, '000000', 'admin', NOW());

-- 插入初始角色菜单关联（超级管理员）
INSERT IGNORE INTO agri_md_role_menu (role_id, menu_id) VALUES
(1, 200), (1, 201), (1, 202), (1, 203);
