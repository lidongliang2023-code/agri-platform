
CREATE TABLE IF NOT EXISTS tenant (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_name VARCHAR(100) NOT NULL COMMENT '租户名称',
    tenant_code VARCHAR(50) NOT NULL COMMENT '租户编码',
    contact_name VARCHAR(50) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    email VARCHAR(100) COMMENT '邮箱',
    address VARCHAR(500) COMMENT '地址',
    status TINYINT(1) DEFAULT 1 COMMENT '状态 1启用 0禁用',
    expire_time DATETIME COMMENT '过期时间',
    create_by VARCHAR(64) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(64) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    del_flag TINYINT(1) DEFAULT 0 COMMENT '删除标志',
    UNIQUE KEY uk_tenant_code (tenant_code, del_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户表';

INSERT INTO tenant (tenant_name, tenant_code, contact_name, contact_phone, email, status) VALUES
('默认租户', 'default', '管理员', '13800138000', 'admin@example.com', 1),
('测试租户', 'test', '测试用户', '13800138001', 'test@example.com', 1);

CREATE TABLE IF NOT EXISTS agri_iot_device_group (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    group_name VARCHAR(100) NOT NULL COMMENT '分组名称',
    group_icon VARCHAR(50) COMMENT '分组图标',
    group_color VARCHAR(20) COMMENT '分组颜色',
    description VARCHAR(500) COMMENT '分组描述',
    is_preset TINYINT(1) DEFAULT 0 COMMENT '是否预置分组',
    status TINYINT(1) DEFAULT 1 COMMENT '状态',
    device_count INT DEFAULT 0 COMMENT '设备数量',
    create_by VARCHAR(64) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(64) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    del_flag TINYINT(1) DEFAULT 0 COMMENT '删除标志',
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_is_preset (is_preset)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备分组表';

CREATE TABLE IF NOT EXISTS agri_iot_device_group_relation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    group_id BIGINT NOT NULL COMMENT '分组ID',
    device_id BIGINT NOT NULL COMMENT '设备ID',
    create_by VARCHAR(64) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(64) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    del_flag TINYINT(1) DEFAULT 0 COMMENT '删除标志',
    INDEX idx_group_id (group_id),
    INDEX idx_device_id (device_id),
    UNIQUE KEY uk_group_device (group_id, device_id, del_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备分组关系表';

CREATE TABLE IF NOT EXISTS agri_iot_push_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    push_enabled TINYINT(1) DEFAULT 1 COMMENT '推送开关',
    all_day_push TINYINT(1) DEFAULT 1 COMMENT '全天推送',
    start_hour VARCHAR(5) COMMENT '开始时间',
    end_hour VARCHAR(5) COMMENT '结束时间',
    urgent_alert TINYINT(1) DEFAULT 1 COMMENT '紧急告警推送',
    normal_alert TINYINT(1) DEFAULT 1 COMMENT '一般告警推送',
    device_offline TINYINT(1) DEFAULT 1 COMMENT '设备离线推送',
    control_result TINYINT(1) DEFAULT 1 COMMENT '控制结果推送',
    system_notice TINYINT(1) DEFAULT 1 COMMENT '系统通知推送',
    data_exception TINYINT(1) DEFAULT 1 COMMENT '数据异常推送',
    scheduled_reminder TINYINT(1) DEFAULT 1 COMMENT '定时提醒推送',
    urgent_sound TINYINT(1) DEFAULT 1 COMMENT '紧急告警声音',
    other_sound TINYINT(1) DEFAULT 1 COMMENT '其他通知声音',
    silent_enabled TINYINT(1) DEFAULT 0 COMMENT '静默时段启用',
    silent_start_hour VARCHAR(5) COMMENT '静默开始时间',
    silent_end_hour VARCHAR(5) COMMENT '静默结束时间',
    create_by VARCHAR(64) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(64) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    del_flag TINYINT(1) DEFAULT 0 COMMENT '删除标志',
    UNIQUE KEY uk_user_id (user_id, del_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送配置表';

CREATE TABLE IF NOT EXISTS agri_iot_push_notification (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    notification_id VARCHAR(64) NOT NULL COMMENT '通知ID',
    type VARCHAR(50) COMMENT '通知类型',
    level VARCHAR(20) COMMENT '通知级别',
    title VARCHAR(200) COMMENT '通知标题',
    content TEXT COMMENT '通知内容',
    device_id VARCHAR(64) COMMENT '设备ID',
    device_name VARCHAR(100) COMMENT '设备名称',
    action VARCHAR(500) COMMENT '跳转链接',
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    read_status TINYINT(1) DEFAULT 0 COMMENT '阅读状态',
    channel VARCHAR(50) COMMENT '推送渠道',
    create_by VARCHAR(64) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(64) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    del_flag TINYINT(1) DEFAULT 0 COMMENT '删除标志',
    INDEX idx_notification_id (notification_id),
    INDEX idx_user_id (user_id),
    INDEX idx_read_status (read_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送通知表';

CREATE TABLE IF NOT EXISTS agri_iot_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    report_name VARCHAR(100) NOT NULL COMMENT '报表名称',
    report_code VARCHAR(50) NOT NULL COMMENT '报表编码',
    description VARCHAR(500) COMMENT '报表描述',
    data_source TEXT COMMENT '数据源配置',
    chart_type VARCHAR(50) COMMENT '图表类型',
    time_range VARCHAR(50) COMMENT '时间范围',
    aggregation_type VARCHAR(50) COMMENT '聚合方式',
    time_granularity VARCHAR(20) COMMENT '时间粒度',
    scheduled_enabled TINYINT(1) DEFAULT 0 COMMENT '定时生成启用',
    scheduled_type VARCHAR(20) COMMENT '定时类型',
    scheduled_time VARCHAR(20) COMMENT '定时时间',
    email_enabled TINYINT(1) DEFAULT 0 COMMENT '邮件订阅启用',
    email_recipients TEXT COMMENT '邮件接收人',
    push_enabled TINYINT(1) DEFAULT 0 COMMENT '推送订阅启用',
    push_recipients TEXT COMMENT '推送接收人',
    config_json TEXT COMMENT '配置JSON',
    status TINYINT(1) DEFAULT 1 COMMENT '状态',
    create_by VARCHAR(64) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(64) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    del_flag TINYINT(1) DEFAULT 0 COMMENT '删除标志',
    UNIQUE KEY uk_report_code (report_code, del_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报表配置表';

INSERT INTO agri_iot_device_group (tenant_id, group_name, group_icon, group_color, description, is_preset, status) VALUES
('default', '全部设备', '📦', '#6B7280', '默认分组，包含所有设备', 1, 1),
('default', '环境监测组', '🌡️', '#3B82F6', '温湿度、光照、CO2等环境传感器', 1, 1),
('default', '灌溉控制组', '💧', '#06B6D4', '电磁阀、水肥一体机、水泵等', 1, 1),
('default', '温室控制组', '🏠', '#8B5CF6', '风机、湿帘、卷帘、补光灯等', 1, 1),
('default', '视频监控组', '📷', '#EC4899', '所有视频监控设备', 1, 1),
('default', '水产养殖组', '🐟', '#0EA5E9', '增氧机、投饵机等', 1, 1),
('default', '畜牧养殖组', '🐄', '#F97316', '饲喂器、环控设备等', 1, 1);
