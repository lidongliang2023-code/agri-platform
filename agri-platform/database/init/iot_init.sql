-- =============================================
-- 物联网模块 - 数据库初始化脚本
-- 表前缀: agri_iot_
-- 公共字段: id, tenant_id, create_by, create_time, update_by, update_time, remark
-- =============================================

-- 1. 设备类型表
CREATE TABLE IF NOT EXISTS agri_iot_device_type (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    type_code VARCHAR(50) NOT NULL COMMENT '类型编码',
    type_name VARCHAR(100) NOT NULL COMMENT '类型名称',
    type_category VARCHAR(20) COMMENT '类型分类：sensor-传感器 controller-控制器 gateway-网关',
    icon VARCHAR(100) COMMENT '图标',
    protocol VARCHAR(20) COMMENT '通信协议：mqtt http coap modbus',
    manufacturer VARCHAR(100) COMMENT '生产厂商',
    model VARCHAR(100) COMMENT '型号',
    spec_json TEXT COMMENT '规格参数JSON',
    status TINYINT DEFAULT 1 COMMENT '状态：1正常 2禁用',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    UNIQUE KEY uk_type_code (type_code, tenant_id),
    INDEX idx_type_category (type_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备类型表';

-- 2. 设备属性定义表
CREATE TABLE IF NOT EXISTS agri_iot_device_property (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    type_id BIGINT NOT NULL COMMENT '设备类型ID',
    property_code VARCHAR(50) NOT NULL COMMENT '属性编码',
    property_name VARCHAR(100) NOT NULL COMMENT '属性名称',
    data_type VARCHAR(20) COMMENT '数据类型：int float double string boolean',
    unit VARCHAR(20) COMMENT '单位',
    min_value DECIMAL(10,2) COMMENT '最小值',
    max_value DECIMAL(10,2) COMMENT '最大值',
    default_value VARCHAR(100) COMMENT '默认值',
    is_readonly TINYINT DEFAULT 0 COMMENT '是否只读：0否 1是',
    is_control TINYINT DEFAULT 0 COMMENT '是否可控：0否 1是',
    display_order INT DEFAULT 0 COMMENT '显示顺序',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_type_property (type_id, property_code, tenant_id),
    INDEX idx_type_id (type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备属性定义表';

-- 3. 设备表
CREATE TABLE IF NOT EXISTS agri_iot_device (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    device_code VARCHAR(100) NOT NULL COMMENT '设备编码（唯一标识）',
    device_name VARCHAR(200) NOT NULL COMMENT '设备名称',
    device_type_id BIGINT NOT NULL COMMENT '设备类型ID',
    gateway_id BIGINT COMMENT '所属网关ID',
    parent_id BIGINT COMMENT '父设备ID（组网用）',
    plot_id BIGINT COMMENT '关联地块ID',
    location_lat DECIMAL(10,6) COMMENT '纬度',
    location_lng DECIMAL(10,6) COMMENT '经度',
    location_name VARCHAR(200) COMMENT '安装位置描述',
    online_status TINYINT DEFAULT 2 COMMENT '在线状态：1在线 2离线',
    last_online_time DATETIME COMMENT '最后上线时间',
    last_report_time DATETIME COMMENT '最后上报时间',
    device_status VARCHAR(50) DEFAULT 'normal' COMMENT '设备状态：normal-normal running-running fault-fault',
    protocol VARCHAR(20) COMMENT '通信协议',
    firmware_version VARCHAR(50) COMMENT '当前固件版本',
    config_json TEXT COMMENT '设备配置JSON',
    status TINYINT DEFAULT 1 COMMENT '状态：1正常 2停用 3报废',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    UNIQUE KEY uk_device_code (device_code, tenant_id),
    INDEX idx_device_type (device_type_id),
    INDEX idx_gateway (gateway_id),
    INDEX idx_plot (plot_id),
    INDEX idx_online_status (online_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备表';

-- 4. 设备数据表
CREATE TABLE IF NOT EXISTS agri_iot_device_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    device_id BIGINT NOT NULL COMMENT '设备ID',
    device_code VARCHAR(100) COMMENT '设备编码',
    plot_id BIGINT COMMENT '地块ID',
    data_json TEXT COMMENT '数据JSON（存储动态属性）',
    temperature DECIMAL(5,2) COMMENT '温度（℃）',
    humidity DECIMAL(5,2) COMMENT '湿度（%）',
    soil_moisture DECIMAL(5,2) COMMENT '土壤湿度（%）',
    soil_temp DECIMAL(5,2) COMMENT '土壤温度（℃）',
    ph DECIMAL(4,2) COMMENT 'pH值',
    light_intensity DECIMAL(10,2) COMMENT '光照强度（lux）',
    co2 DECIMAL(8,2) COMMENT 'CO2浓度（ppm）',
    device_status VARCHAR(20) COMMENT '设备状态',
    report_time DATETIME NOT NULL COMMENT '上报时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_device_id (device_id),
    INDEX idx_device_code (device_code),
    INDEX idx_report_time (report_time),
    INDEX idx_plot_id (plot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备数据表';

-- 5. 控制日志表
CREATE TABLE IF NOT EXISTS agri_iot_device_control_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    device_id BIGINT NOT NULL COMMENT '设备ID',
    device_code VARCHAR(100) COMMENT '设备编码',
    command_type VARCHAR(20) NOT NULL COMMENT '命令类型：switch-proportion-timing-param-formula',
    command_content JSON COMMENT '命令内容JSON',
    status TINYINT DEFAULT 0 COMMENT '状态：0-待执行 1-已下发 2-执行成功 3-执行失败 4-超时',
    send_time DATETIME COMMENT '下发时间',
    execute_time DATETIME COMMENT '执行时间',
    response_content TEXT COMMENT '设备响应内容',
    error_message VARCHAR(500) COMMENT '错误信息',
    operator VARCHAR(50) COMMENT '操作人',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_device_id (device_id),
    INDEX idx_send_time (send_time),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='控制日志表';

-- 6. 预警规则表
CREATE TABLE IF NOT EXISTS agri_iot_alert_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    rule_code VARCHAR(50) NOT NULL COMMENT '规则编码',
    rule_name VARCHAR(100) NOT NULL COMMENT '规则名称',
    rule_type VARCHAR(20) COMMENT '规则类型：threshold-阈值 compare-比较 trend-趋势',
    device_type_id BIGINT COMMENT '适用设备类型（空表示全部）',
    property_code VARCHAR(50) COMMENT '监测属性编码',
    property_name VARCHAR(100) COMMENT '监测属性名称',
    operator VARCHAR(10) COMMENT '运算符：> < >= <= == !=',
    threshold_value VARCHAR(50) COMMENT '阈值',
    duration_seconds INT DEFAULT 0 COMMENT '持续时长（秒），0表示立即触发',
    alert_level TINYINT NOT NULL COMMENT '告警级别：1-紧急 2-重要 3-一般 4-提醒',
    alert_channel VARCHAR(50) COMMENT '通知渠道：sms-email-wechat-system',
    alert_template VARCHAR(500) COMMENT '通知模板',
    enable_status TINYINT DEFAULT 1 COMMENT '启用状态：1启用 0禁用',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    UNIQUE KEY uk_rule_code (rule_code, tenant_id),
    INDEX idx_device_type (device_type_id),
    INDEX idx_enable (enable_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警规则表';

-- 7. 预警记录表
CREATE TABLE IF NOT EXISTS agri_iot_alert_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    alert_no VARCHAR(50) NOT NULL COMMENT '预警编号',
    rule_id BIGINT COMMENT '规则ID',
    rule_name VARCHAR(100) COMMENT '规则名称',
    device_id BIGINT COMMENT '设备ID',
    device_code VARCHAR(100) COMMENT '设备编码',
    device_name VARCHAR(200) COMMENT '设备名称',
    plot_id BIGINT COMMENT '地块ID',
    plot_name VARCHAR(200) COMMENT '地块名称',
    alert_level TINYINT NOT NULL COMMENT '告警级别：1-紧急 2-重要 3-一般 4-提醒',
    property_code VARCHAR(50) COMMENT '触发属性',
    property_name VARCHAR(100) COMMENT '属性名称',
    trigger_value VARCHAR(100) COMMENT '触发值',
    threshold_value VARCHAR(100) COMMENT '阈值',
    alert_content TEXT COMMENT '预警内容',
    alert_time DATETIME NOT NULL COMMENT '预警时间',
    handle_status TINYINT DEFAULT 1 COMMENT '处理状态：1-待处理 2-处理中 3-已处理 4-已忽略',
    handle_time DATETIME COMMENT '处理时间',
    handle_user VARCHAR(50) COMMENT '处理人',
    handle_result TEXT COMMENT '处理结果',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_alert_no (alert_no),
    INDEX idx_device_id (device_id),
    INDEX idx_alert_time (alert_time),
    INDEX idx_handle_status (handle_status),
    INDEX idx_alert_level (alert_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警记录表';

-- 8. 场景模式表
CREATE TABLE IF NOT EXISTS agri_iot_scene (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    scene_code VARCHAR(50) NOT NULL COMMENT '场景编码',
    scene_name VARCHAR(100) NOT NULL COMMENT '场景名称',
    scene_type VARCHAR(20) COMMENT '场景类型：preset-预置 custom-自定义',
    category VARCHAR(50) COMMENT '分类：seedling-育苗 growth-生长期 flowering-开花期 harvest-采摘期 overwinter-越冬',
    icon VARCHAR(100) COMMENT '图标',
    description VARCHAR(500) COMMENT '场景描述',
    applicable_plots TEXT COMMENT '适用地块ID列表，逗号分隔',
    scene_config JSON COMMENT '场景配置JSON',
    is_active TINYINT DEFAULT 0 COMMENT '是否激活：0否 1是',
    sort_order INT DEFAULT 0 COMMENT '排序',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    UNIQUE KEY uk_scene_code (scene_code, tenant_id),
    INDEX idx_scene_type (scene_type),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='场景模式表';

-- 9. 场景联动策略表
CREATE TABLE IF NOT EXISTS agri_iot_scene_strategy (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    scene_id BIGINT NOT NULL COMMENT '场景ID',
    strategy_name VARCHAR(100) NOT NULL COMMENT '策略名称',
    trigger_type VARCHAR(20) NOT NULL COMMENT '触发类型：time-定时 condition-条件 manual-手动',
    trigger_config JSON COMMENT '触发配置JSON',
    condition_json TEXT COMMENT '条件JSON（当trigger_type=condition时）',
    action_list JSON COMMENT '动作列表JSON',
    execution_order INT DEFAULT 1 COMMENT '执行顺序',
    execution_mode VARCHAR(20) DEFAULT 'parallel' COMMENT '执行方式：parallel-并行 sequential-顺序',
    enable_status TINYINT DEFAULT 1 COMMENT '启用状态',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_scene_id (scene_id),
    INDEX idx_trigger_type (trigger_type),
    INDEX idx_enable (enable_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='场景联动策略表';

-- 10. 自动化规则表
CREATE TABLE IF NOT EXISTS agri_iot_automation_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    rule_code VARCHAR(50) NOT NULL COMMENT '规则编码',
    rule_name VARCHAR(100) NOT NULL COMMENT '规则名称',
    rule_type VARCHAR(20) NOT NULL COMMENT '规则类型：condition-条件触发 time-定时触发',
    description VARCHAR(500) COMMENT '规则描述',
    trigger_config JSON COMMENT '触发条件配置JSON',
    condition_group JSON COMMENT '条件组JSON',
    action_list JSON COMMENT '动作列表JSON',
    cooldown_seconds INT DEFAULT 0 COMMENT '冷却时间（秒）',
    priority INT DEFAULT 0 COMMENT '优先级',
    enable_status TINYINT DEFAULT 1 COMMENT '启用状态',
    last_trigger_time DATETIME COMMENT '最后触发时间',
    trigger_count INT DEFAULT 0 COMMENT '触发次数',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    UNIQUE KEY uk_rule_code (rule_code, tenant_id),
    INDEX idx_rule_type (rule_type),
    INDEX idx_enable (enable_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动化规则表';

-- 11. 规则执行动作表
CREATE TABLE IF NOT EXISTS agri_iot_rule_action (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    rule_id BIGINT NOT NULL COMMENT '规则ID',
    action_type VARCHAR(20) NOT NULL COMMENT '动作类型：control-设备控制 scene-切换场景 notification-通知',
    device_id BIGINT COMMENT '目标设备ID',
    command_type VARCHAR(20) COMMENT '命令类型',
    command_params JSON COMMENT '命令参数JSON',
    action_order INT DEFAULT 1 COMMENT '执行顺序',
    action_status TINYINT DEFAULT 0 COMMENT '执行状态：0-待执行 1-执行中 2-成功 3-失败',
    execute_time DATETIME COMMENT '执行时间',
    execute_result TEXT COMMENT '执行结果',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_rule_id (rule_id),
    INDEX idx_device_id (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规则执行动作表';

-- 12. 边缘网关表
CREATE TABLE IF NOT EXISTS agri_iot_gateway (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    gateway_code VARCHAR(100) NOT NULL COMMENT '网关编码',
    gateway_name VARCHAR(200) NOT NULL COMMENT '网关名称',
    gateway_type VARCHAR(20) COMMENT '网关类型：edge-边缘 hub-智能Hub',
    manufacturer VARCHAR(100) COMMENT '厂商',
    model VARCHAR(100) COMMENT '型号',
    firmware_version VARCHAR(50) COMMENT '固件版本',
    ip_address VARCHAR(50) COMMENT 'IP地址',
    mac_address VARCHAR(50) COMMENT 'MAC地址',
    plot_id BIGINT COMMENT '安装地块ID',
    location_name VARCHAR(200) COMMENT '安装位置',
    online_status TINYINT DEFAULT 2 COMMENT '在线状态：1在线 2离线',
    last_online_time DATETIME COMMENT '最后上线时间',
    connected_device_count INT DEFAULT 0 COMMENT '已连接设备数',
    status TINYINT DEFAULT 1 COMMENT '状态：1正常 2停用',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    UNIQUE KEY uk_gateway_code (gateway_code, tenant_id),
    INDEX idx_plot_id (plot_id),
    INDEX idx_online_status (online_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='边缘网关表';

-- 13. 网关设备关联表
CREATE TABLE IF NOT EXISTS agri_iot_gateway_device (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    gateway_id BIGINT NOT NULL COMMENT '网关ID',
    device_id BIGINT NOT NULL COMMENT '设备ID',
    connection_status TINYINT DEFAULT 1 COMMENT '连接状态：1已连接 2断开',
    connect_time DATETIME COMMENT '连接时间',
    last_heartbeat DATETIME COMMENT '最后心跳时间',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_gateway_device (gateway_id, device_id),
    INDEX idx_device_id (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='网关设备关联表';

-- 14. 固件版本表
CREATE TABLE IF NOT EXISTS agri_iot_firmware (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    device_type_id BIGINT NOT NULL COMMENT '适用设备类型ID',
    firmware_version VARCHAR(50) NOT NULL COMMENT '固件版本号',
    firmware_name VARCHAR(100) COMMENT '固件名称',
    firmware_url VARCHAR(500) COMMENT '固件包URL',
    firmware_size BIGINT COMMENT '固件大小（字节）',
    checksum VARCHAR(64) COMMENT 'MD5校验码',
    release_note TEXT COMMENT '发布说明',
    is_latest TINYINT DEFAULT 0 COMMENT '是否最新版本：0否 1是',
    is_force TINYINT DEFAULT 0 COMMENT '是否强制升级：0否 1是',
    status TINYINT DEFAULT 1 COMMENT '状态：1正常 2停用',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_type_version (device_type_id, firmware_version),
    INDEX idx_device_type (device_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='固件版本表';

-- 15. OTA升级任务表
CREATE TABLE IF NOT EXISTS agri_iot_ota_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    task_name VARCHAR(100) NOT NULL COMMENT '任务名称',
    task_no VARCHAR(50) NOT NULL COMMENT '任务编号',
    firmware_id BIGINT NOT NULL COMMENT '目标固件ID',
    target_devices TEXT COMMENT '目标设备ID列表，逗号分隔',
    upgrade_type VARCHAR(20) DEFAULT 'batch' COMMENT '升级方式：batch-批量 single-单个',
    task_status VARCHAR(20) DEFAULT 'pending' COMMENT '任务状态：pending-待执行 running-执行中 paused-已暂停 completed-已完成 cancelled-已取消',
    total_devices INT DEFAULT 0 COMMENT '总设备数',
    success_count INT DEFAULT 0 COMMENT '成功数',
    fail_count INT DEFAULT 0 COMMENT '失败数',
    in_progress_count INT DEFAULT 0 COMMENT '进行中数',
    start_time DATETIME COMMENT '开始时间',
    end_time DATETIME COMMENT '结束时间',
    execute_config JSON COMMENT '执行配置JSON',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_task_no (task_no),
    INDEX idx_task_status (task_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OTA升级任务表';

-- 16. OTA升级进度表
CREATE TABLE IF NOT EXISTS agri_iot_ota_progress (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    task_id BIGINT NOT NULL COMMENT '任务ID',
    device_id BIGINT NOT NULL COMMENT '设备ID',
    old_version VARCHAR(50) COMMENT '原版本',
    new_version VARCHAR(50) COMMENT '目标版本',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态：pending-待升级 downloading-下载中 installing-安装中 success-成功 fail-失败 timeout-超时',
    progress INT DEFAULT 0 COMMENT '进度百分比',
    error_message VARCHAR(500) COMMENT '错误信息',
    download_start_time DATETIME COMMENT '下载开始时间',
    download_end_time DATETIME COMMENT '下载结束时间',
    install_start_time DATETIME COMMENT '安装开始时间',
    install_end_time DATETIME COMMENT '安装结束时间',
    complete_time DATETIME COMMENT '完成时间',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_task_device (task_id, device_id),
    INDEX idx_device_id (device_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OTA升级进度表';

-- 17. 地块监测表
CREATE TABLE IF NOT EXISTS agri_iot_plot (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    plot_code VARCHAR(50) NOT NULL COMMENT '地块编码',
    plot_name VARCHAR(100) NOT NULL COMMENT '地块名称',
    plot_type VARCHAR(20) COMMENT '地块类型：greenhouse-大棚 open-露天 water-水产',
    area DECIMAL(10,2) COMMENT '面积（亩）',
    location_lat DECIMAL(10,6) COMMENT '纬度',
    location_lng DECIMAL(10,6) COMMENT '经度',
    location_name VARCHAR(200) COMMENT '位置描述',
    crop_type VARCHAR(100) COMMENT '种植作物',
    crop_stage VARCHAR(50) COMMENT '生长阶段',
    device_count INT DEFAULT 0 COMMENT '设备数量',
    online_device_count INT DEFAULT 0 COMMENT '在线设备数',
    status TINYINT DEFAULT 1 COMMENT '状态：1正常 2停用',
    del_flag TINYINT DEFAULT 0 COMMENT '删除标记',
    tenant_id VARCHAR(20) DEFAULT '000000' COMMENT '租户ID',
    create_by VARCHAR(50) COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by VARCHAR(50) COMMENT '更新人',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    remark VARCHAR(500) COMMENT '备注',
    UNIQUE KEY uk_plot_code (plot_code, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='地块监测表';

-- 插入初始菜单数据
INSERT IGNORE INTO agri_md_menu (id, menu_name, parent_id, path, component, menu_type, perms, icon, order_num, visible, status, del_flag, tenant_id, create_by, create_time) VALUES
(200, '物联网管理', 0, '/iot', NULL, 'M', NULL, 'DashboardOutlined', 3, 1, 1, 0, '000000', 'admin', NOW()),
(201, '设备管理', 200, '/iot/device', '/iot/device/index', 'C', 'iot:device:list', 'ToolOutlined', 1, 1, 1, 0, '000000', 'admin', NOW()),
(202, '设备类型', 200, '/iot/device-type', '/iot/device-type/index', 'C', 'iot:device:type:list', 'DeviceOutlined', 2, 1, 1, 0, '000000', 'admin', NOW()),
(203, '数据监测', 200, '/iot/data', '/iot/data/index', 'C', 'iot:data:list', 'LineChartOutlined', 3, 1, 1, 0, '000000', 'admin', NOW()),
(204, '预警管理', 200, '/iot/alert', '/iot/alert/index', 'C', 'iot:alert:list', 'WarningOutlined', 4, 1, 1, 0, '000000', 'admin', NOW()),
(205, '远程控制', 200, '/iot/control', '/iot/control/index', 'C', 'iot:control:list', 'ControlOutlined', 5, 1, 1, 0, '000000', 'admin', NOW()),
(206, '场景模式', 200, '/iot/scene', '/iot/scene/index', 'C', 'iot:scene:list', 'LayoutOutlined', 6, 1, 1, 0, '000000', 'admin', NOW()),
(207, '自动化规则', 200, '/iot/automation', '/iot/automation/index', 'C', 'iot:automation:list', 'ZapOutlined', 7, 1, 1, 0, '000000', 'admin', NOW());

-- 插入初始角色菜单关联（超级管理员）
INSERT IGNORE INTO agri_md_role_menu (role_id, menu_id) VALUES
(1, 200), (1, 201), (1, 202), (1, 203), (1, 204), (1, 205), (1, 206), (1, 207);

-- 插入初始设备类型数据
INSERT IGNORE INTO agri_iot_device_type (id, type_code, type_name, type_category, icon, protocol, manufacturer) VALUES
(1, 'TEMP_SENSOR', '温度传感器', 'sensor', 'ThermometerOutlined', 'mqtt', '华为'),
(2, 'HUMIDITY_SENSOR', '湿度传感器', 'sensor', 'DropletOutlined', 'mqtt', '华为'),
(3, 'SOIL_MOISTURE', '土壤湿度传感器', 'sensor', 'DropletOutlined', 'mqtt', '阿里云'),
(4, 'PH_SENSOR', 'pH传感器', 'sensor', 'FlaskOutlined', 'mqtt', '阿里云'),
(5, 'LIGHT_SENSOR', '光照传感器', 'sensor', 'SunOutlined', 'mqtt', '腾讯'),
(6, 'CO2_SENSOR', 'CO2传感器', 'sensor', 'CloudOutlined', 'mqtt', '腾讯'),
(7, 'IRRIGATION_CTRL', '灌溉控制器', 'controller', 'WavesOutlined', 'mqtt', '华为'),
(8, 'VENT_CTRL', '通风控制器', 'controller', 'WindOutlined', 'mqtt', '阿里云'),
(9, 'HEAT_CTRL', '加热控制器', 'controller', 'FlameOutlined', 'mqtt', '腾讯'),
(10, 'EDGE_GATEWAY', '边缘网关', 'gateway', 'RouterOutlined', 'mqtt', '华为');

-- 插入初始设备属性数据
INSERT IGNORE INTO agri_iot_device_property (type_id, property_code, property_name, data_type, unit, min_value, max_value) VALUES
(1, 'temperature', '温度', 'float', '℃', -40, 80),
(2, 'humidity', '湿度', 'float', '%', 0, 100),
(3, 'soil_moisture', '土壤湿度', 'float', '%', 0, 100),
(4, 'ph', 'pH值', 'float', '', 0, 14),
(5, 'light_intensity', '光照强度', 'float', 'lux', 0, 100000),
(6, 'co2', 'CO2浓度', 'float', 'ppm', 0, 5000),
(7, 'valve_open', '阀门开度', 'float', '%', 0, 100),
(8, 'fan_speed', '风机转速', 'int', 'rpm', 0, 3000),
(9, 'heating_power', '加热功率', 'int', 'W', 0, 5000);

-- 插入初始预警规则数据
INSERT IGNORE INTO agri_iot_alert_rule (rule_code, rule_name, rule_type, property_code, property_name, operator, threshold_value, alert_level, enable_status) VALUES
('ALERT_TEMP_HIGH', '温度过高预警', 'threshold', 'temperature', '温度', '>', '35', 2, 1),
('ALERT_TEMP_LOW', '温度过低预警', 'threshold', 'temperature', '温度', '<', '10', 2, 1),
('ALERT_HUMIDITY_HIGH', '湿度过高预警', 'threshold', 'humidity', '湿度', '>', '90', 3, 1),
('ALERT_HUMIDITY_LOW', '湿度过低预警', 'threshold', 'humidity', '湿度', '<', '30', 3, 1),
('ALERT_SOIL_MOISTURE_LOW', '土壤湿度不足', 'threshold', 'soil_moisture', '土壤湿度', '<', '40', 2, 1),
('ALERT_PH_ABNORMAL', 'pH值异常', 'threshold', 'ph', 'pH值', '<', '5.5', 2, 1),
('ALERT_PH_ABNORMAL_HIGH', 'pH值偏高', 'threshold', 'ph', 'pH值', '>', '8.0', 2, 1),
('ALERT_CO2_HIGH', 'CO2浓度过高', 'threshold', 'co2', 'CO2浓度', '>', '2000', 2, 1);

-- 插入初始地块数据
INSERT IGNORE INTO agri_iot_plot (plot_code, plot_name, plot_type, area, crop_type, crop_stage) VALUES
('PLOT_001', '智能大棚A区', 'greenhouse', 5.5, '番茄', '生长期'),
('PLOT_002', '智能大棚B区', 'greenhouse', 4.8, '黄瓜', '开花期'),
('PLOT_003', '露天试验田', 'open', 10.0, '小麦', '育苗期'),
('PLOT_004', '水产养殖池', 'water', 8.0, '鲤鱼', '成长期');
