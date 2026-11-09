-- 租户主键口径（本轮统一，别再回到两套编号）：
-- 所有表的 tenant_id 一律是**平台经营主体号**（agri_core.platform_merchant.id，演示数据里是 2001/2003），
-- 与生产域 farm 接口返回的 tenantId、iot_device 运行时写入的值同源。
-- 以前 iot_tenant 用自己的自增 1..4，而设备写的是 2001，导致运营端
-- "LEFT JOIN iot_tenant t ON t.id=d.tenant_id" 对 29 台设备里 0 台能解析出租户名。
-- 因此 iot_tenant.id 也必须用经营主体号，这张表就是平台商户在物联网侧的配额档案。
--
-- 两条配套约定，缺一个就会重新长出"看不见的数据"：
--   · 租户列一律 NOT NULL 且**不给默认值**：漏传就直接报错，而不是默默落到某个默认主体上，
--     变成"页面列表有条数、租户筛选查不到"这种谁也说不清的偏差；
--   · 参与统计的时间列（recorded_at / created_at / last_trigger）统一存 'yyyy-MM-dd HH:mm' 文本，
--     与仓储里 nowLabel() 的格式一致；报表按 SUBSTRING(col,1,10) 聚合日期、
--     SUBSTRING(col,12,2) 聚合小时。写"今天 10:18"这类相对文本会让聚合彻底失效。
CREATE TABLE IF NOT EXISTS iot_tenant (
    id BIGINT NOT NULL PRIMARY KEY,
    tenant_name VARCHAR(160) NOT NULL,
    tenant_code VARCHAR(50) NOT NULL UNIQUE,
    plan_name VARCHAR(40),
    device_limit INT DEFAULT 0,
    device_count INT DEFAULT 0,
    region_name VARCHAR(80),
    status VARCHAR(30) DEFAULT 'active',
    expire_date VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS iot_farm (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    farm_name VARCHAR(160) NOT NULL,
    manager VARCHAR(80),
    phone VARCHAR(40),
    address VARCHAR(300),
    area DECIMAL(12,2) DEFAULT 0,
    device_count INT DEFAULT 0,
    online_count INT DEFAULT 0,
    alert_count INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'normal',
    created_at VARCHAR(40)
);

-- iot_plot 已删除：地块档案的唯一来源是 agri-production 的租户地块接口
-- （ProductionPlotClient），这里再存一份就必然与生产端不一致。
-- iot_device.plot_id 直接存生产地块主键。

CREATE TABLE IF NOT EXISTS iot_gateway (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    farm_id BIGINT NOT NULL,
    gateway_code VARCHAR(50) NOT NULL UNIQUE,
    gateway_name VARCHAR(120) NOT NULL,
    gateway_model VARCHAR(80),
    protocol_name VARCHAR(50),
    firmware_version VARCHAR(40),
    ip_address VARCHAR(60),
    online_count INT DEFAULT 0,
    total_count INT DEFAULT 0,
    online_status VARCHAR(30) DEFAULT 'online',
    cpu_rate DECIMAL(5,2) DEFAULT 0,
    memory_rate DECIMAL(5,2) DEFAULT 0,
    last_online VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS iot_device_type (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(120) NOT NULL,
    category_name VARCHAR(40),
    protocol_name VARCHAR(40),
    icon_text VARCHAR(20),
    manufacturer VARCHAR(120),
    model_name VARCHAR(80),
    property_text VARCHAR(500),
    status VARCHAR(30) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS iot_device_group (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    group_name VARCHAR(120) NOT NULL,
    icon_text VARCHAR(20),
    color_value VARCHAR(30),
    device_count INT DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS iot_device (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    farm_id BIGINT NOT NULL,
    plot_id BIGINT,
    gateway_id BIGINT,
    group_id BIGINT,
    device_code VARCHAR(60) NOT NULL UNIQUE,
    device_name VARCHAR(160) NOT NULL,
    type_id BIGINT,
    type_name VARCHAR(120),
    protocol_name VARCHAR(40),
    online_status VARCHAR(30) DEFAULT 'online',
    status_text VARCHAR(30) DEFAULT 'normal',
    last_report VARCHAR(40),
    signal_strength INT DEFAULT -60,
    battery_rate INT DEFAULT 100,
    firmware_version VARCHAR(40),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    control_capable BOOLEAN DEFAULT FALSE,
    config_text VARCHAR(1000),
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS iot_telemetry (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    metric_key VARCHAR(40) NOT NULL,
    metric_value DECIMAL(12,3) NOT NULL,
    unit_name VARCHAR(20),
    recorded_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS iot_alert (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_no VARCHAR(50) NOT NULL UNIQUE,
    tenant_id BIGINT NOT NULL,
    farm_id BIGINT,
    device_id BIGINT,
    device_name VARCHAR(160),
    alert_type VARCHAR(80),
    level_name VARCHAR(20),
    title VARCHAR(240) NOT NULL,
    content VARCHAR(1200),
    trigger_value VARCHAR(80),
    threshold_value VARCHAR(80),
    status VARCHAR(30) DEFAULT 'pending',
    handled_by VARCHAR(80),
    handle_note VARCHAR(800),
    created_at VARCHAR(40),
    handled_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS iot_alert_rule (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_name VARCHAR(160) NOT NULL,
    device_type VARCHAR(120),
    metric_key VARCHAR(40),
    metric_name VARCHAR(80),
    operator_text VARCHAR(10),
    threshold_value VARCHAR(40),
    duration_seconds INT DEFAULT 300,
    level_name VARCHAR(20),
    enabled BOOLEAN DEFAULT TRUE,
    tenant_scope VARCHAR(120)
);

-- 主体自定义阈值（本轮新增）。上一轮把用户端的「停用/启用平台预置规则」下线了，
-- 因为 iot_alert_rule 的 enabled 是全平台开关：任何一个合作社点一下就关掉所有人的高温告警。
-- 但"大棚 35℃ 报警"对蔬菜棚和苹果园并不是同一个合理值，所以这里补一张主体维度的规则表：
--   · 同一个 metric_key（且设备类型匹配或不限类型）上，主体规则**覆盖**平台预置；
--   · 没有主体规则的指标继续用平台预置，平台预置本身对租户只读；
--   · duration_seconds 不是摆设：判定回到 iot_telemetry 的实际读数序列，
--     要求窗口内每条读数都越线，缺读数就不算"持续越线"。
CREATE TABLE IF NOT EXISTS iot_alert_rule_tenant (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    rule_name VARCHAR(160) NOT NULL,
    device_type VARCHAR(120),
    metric_key VARCHAR(40) NOT NULL,
    metric_name VARCHAR(80),
    operator_text VARCHAR(10) NOT NULL,
    threshold_value VARCHAR(40) NOT NULL,
    duration_seconds INT DEFAULT 0,
    level_name VARCHAR(20) DEFAULT 'major',
    enabled BOOLEAN DEFAULT TRUE,
    remark VARCHAR(400),
    source_rule_id BIGINT,
    created_by VARCHAR(80),
    updated_by VARCHAR(80),
    created_at VARCHAR(40),
    updated_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS iot_scene (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    scene_code VARCHAR(40) NOT NULL UNIQUE,
    scene_name VARCHAR(160) NOT NULL,
    icon_text VARCHAR(20),
    category_name VARCHAR(50),
    description VARCHAR(800),
    config_text VARCHAR(1000),
    is_active BOOLEAN DEFAULT FALSE,
    plot_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS iot_rule (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    rule_code VARCHAR(40) NOT NULL UNIQUE,
    rule_name VARCHAR(160) NOT NULL,
    trigger_text VARCHAR(800),
    action_text VARCHAR(800),
    enabled BOOLEAN DEFAULT TRUE,
    last_trigger VARCHAR(40),
    trigger_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS iot_rule_config (
    rule_id BIGINT PRIMARY KEY,
    rule_type VARCHAR(40),
    trigger_metric VARCHAR(60),
    operator_text VARCHAR(10),
    threshold_value VARCHAR(80),
    duration_seconds INT DEFAULT 0,
    schedule_text VARCHAR(120),
    action_device_id BIGINT,
    action_device_name VARCHAR(160),
    action_command VARCHAR(120),
    action_value VARCHAR(160),
    cooldown_seconds INT DEFAULT 0,
    config_json VARCHAR(2000),
    updated_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS iot_control_log (
    command_no VARCHAR(40) UNIQUE,
    command_status VARCHAR(20),
    dispatch_token VARCHAR(64),
    expires_at VARCHAR(40),
    sent_at VARCHAR(40),
    receipt_at VARCHAR(40),
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT,
    device_name VARCHAR(160),
    action_name VARCHAR(120),
    operator_name VARCHAR(80),
    result_text VARCHAR(300),
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS iot_work_order (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    order_no VARCHAR(50) NOT NULL UNIQUE,
    source_name VARCHAR(80),
    device_name VARCHAR(160),
    order_type VARCHAR(80),
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(30) DEFAULT 'pending',
    technician VARCHAR(80),
    description VARCHAR(500),
    created_at VARCHAR(40),
    completed_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS iot_firmware (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(120),
    version_name VARCHAR(40),
    file_size VARCHAR(40),
    sha256_text VARCHAR(100),
    status VARCHAR(30) DEFAULT 'stable',
    release_at VARCHAR(40),
    firmware_type VARCHAR(40) DEFAULT 'gateway',
    target_model VARCHAR(80) DEFAULT 'ALL',
    package_url VARCHAR(1000) NULL,
    file_size_bytes BIGINT DEFAULT 0,
    published_at VARCHAR(40) NULL,
    deprecated_at VARCHAR(40) NULL,
    release_notes VARCHAR(500) NULL,
    changelog_text VARCHAR(1000) NULL,
    created_at VARCHAR(40) NULL,
    deprecate_reason VARCHAR(300) NULL,
    UNIQUE KEY uk_firmware_version (firmware_type,target_model,version_name)
);

CREATE TABLE IF NOT EXISTS iot_ota_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    task_no VARCHAR(50) NOT NULL UNIQUE,
    firmware_id BIGINT,
    firmware_version VARCHAR(40),
    target_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    target_scope VARCHAR(200),
    status VARCHAR(30) DEFAULT 'scheduled',
    execute_window VARCHAR(80),
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS iot_message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    message_type VARCHAR(40),
    title VARCHAR(200),
    content VARCHAR(1000),
    is_read BOOLEAN DEFAULT FALSE,
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS iot_product (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(160) NOT NULL,
    product_key VARCHAR(80) NOT NULL UNIQUE,
    category_name VARCHAR(40),
    protocol_name VARCHAR(40),
    model_name VARCHAR(80),
    property_count INT DEFAULT 0,
    device_count INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'published'
);

CREATE TABLE IF NOT EXISTS iot_protocol (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    protocol_name VARCHAR(80) NOT NULL,
    protocol_type VARCHAR(40),
    endpoint_text VARCHAR(160),
    port_text VARCHAR(40),
    status VARCHAR(30) DEFAULT 'running',
    connections INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS iot_access_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_code VARCHAR(60) NOT NULL,
    device_name VARCHAR(160),
    tenant_name VARCHAR(160),
    request_type VARCHAR(80),
    status VARCHAR(30) DEFAULT 'pending',
    submitted_at VARCHAR(40),
    auditor VARCHAR(80),
    note VARCHAR(800)
);

CREATE TABLE IF NOT EXISTS iot_ops_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(60),
    operator_name VARCHAR(80),
    action_name VARCHAR(120),
    target_name VARCHAR(200),
    detail_text VARCHAR(1000),
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS iot_gateway_command (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 gateway_id BIGINT NOT NULL,
 gateway_name VARCHAR(160),
 action_name VARCHAR(120) NOT NULL,
 operator_name VARCHAR(300) NOT NULL,
 result_text VARCHAR(300),
 created_at VARCHAR(40) NOT NULL,
 command_no VARCHAR(40) NOT NULL,
 command_status VARCHAR(20) NOT NULL,
 dispatch_token VARCHAR(64),
 expires_at VARCHAR(40) NOT NULL,
 sent_at VARCHAR(40),
 receipt_at VARCHAR(40),
 UNIQUE KEY uk_gateway_command_no (command_no),
 KEY idx_gateway_command_status (gateway_id,command_status)
);

CREATE TABLE IF NOT EXISTS iot_ota_receipt (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 task_id BIGINT NOT NULL, gateway_id BIGINT NOT NULL,
 command_no VARCHAR(40) NOT NULL UNIQUE,
 command_status VARCHAR(20) NOT NULL,
 firmware_version VARCHAR(40) NOT NULL, firmware_url VARCHAR(1000) NOT NULL,
 sha256_text VARCHAR(64) NOT NULL, dispatch_token VARCHAR(64),
 progress INT NOT NULL DEFAULT 0, installed_version VARCHAR(40),
 result_text VARCHAR(300), operator_name VARCHAR(160),
 created_at VARCHAR(40), expires_at VARCHAR(40), sent_at VARCHAR(40), receipt_at VARCHAR(40),
 UNIQUE KEY uk_ota_task_gateway(task_id,gateway_id)
);
