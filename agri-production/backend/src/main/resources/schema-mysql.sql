CREATE TABLE IF NOT EXISTS agri_prod_farm_info (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
farm_code VARCHAR(191) NOT NULL UNIQUE,
farm_name TEXT NOT NULL,
farm_type TEXT,
legal_person TEXT,
contact_phone TEXT,
province TEXT,
city TEXT,
district TEXT,
address TEXT,
longitude DECIMAL(12,8),
latitude DECIMAL(12,8),
total_area DECIMAL(12,4),
plot_count BIGINT DEFAULT 0,
farm_type_detail TEXT,
main_products TEXT,
certifications TEXT,
certification_expire_date DATE,
certifications_json TEXT,
logo_url TEXT,
intro TEXT,
register_date DATE,
audit_status VARCHAR(255) DEFAULT 'pending',
status VARCHAR(255) DEFAULT 'active',
tenant_id VARCHAR(191) NOT NULL,
farm_id VARCHAR(191),
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_farm_tenant_id` (tenant_id),
    INDEX `idx_farm_farm_code` (farm_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_plot_info (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
plot_code VARCHAR(191) NOT NULL UNIQUE,
plot_name TEXT NOT NULL,
farm_id BIGINT,
area DECIMAL(12,4),
shape TEXT,
soil_type TEXT,
terrain TEXT,
drainage TEXT,
irrigation_type TEXT,
current_crop TEXT,
planting_date DATE,
expected_harvest_date DATE,
status VARCHAR(255) DEFAULT 'active',
farm_code VARCHAR(191),
boundary TEXT,
center_longitude DECIMAL(12,6),
center_latitude DECIMAL(12,6),
soil_ph DECIMAL(6,2),
soil_organic_matter DECIMAL(10,4),
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_plot_tenant_id` (tenant_id),
    INDEX `idx_plot_plot_code` (plot_code),
    INDEX `idx_plot_farm_id` (farm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_task_info (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
task_code VARCHAR(191) NOT NULL UNIQUE,
task_name TEXT NOT NULL,
task_type TEXT,
-- 下面这批列实体早就在用、建表脚本原先没有（详见 schema-patch-task-page.sql 的说明）。
-- 一次建对，老库用补丁脚本补。
task_type_detail TEXT,
farm_code TEXT,
plot_code TEXT,
crop_name TEXT,
task_desc TEXT,
input_materials TEXT,
input_materials_json TEXT,
expected_output DECIMAL(18,4),
actual_output DECIMAL(18,4),
quality_requirement TEXT,
result_photo_urls TEXT,
result_desc TEXT,
template_id BIGINT,
-- 前端「农事任务」页契约里明确要的字段（任务列表/详情的 assignerName、acceptStatus、
-- acceptRemark、rejectCount、completedAt 都在这几列上）
assigner_id BIGINT,
assigner_name TEXT,
accept_status BIGINT DEFAULT 0,
accept_remark TEXT,
reject_count BIGINT DEFAULT 0,
-- 验收人与验收时间（前端 TaskAcceptance 要显示"谁在什么时候验收的"）
acceptor_id BIGINT,
acceptor_name VARCHAR(191),
accepted_at DATETIME,
description TEXT,
farm_id BIGINT,
plot_id BIGINT,
executor_id BIGINT,
executor_name TEXT,
plan_start_time DATETIME,
plan_end_time DATETIME,
actual_start_time DATETIME,
actual_end_time DATETIME,
priority VARCHAR(255) DEFAULT 'medium',
status VARCHAR(255) DEFAULT 'pending',
progress BIGINT DEFAULT 0,
task_data TEXT,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_task_tenant_id` (tenant_id),
    INDEX `idx_task_task_code` (task_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_input_material (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
material_code VARCHAR(191) NOT NULL UNIQUE,
material_name TEXT NOT NULL,
material_type TEXT,
specification TEXT,
unit TEXT,
manufacturer TEXT,
batch_number TEXT,
production_date DATE,
expire_date DATE,
shelf_life BIGINT,
storage_conditions TEXT,
safety_level TEXT,
toxicity_level TEXT,
usage_instructions TEXT,
dosage TEXT,
registration_no VARCHAR(191),
safety_interval INT,
stock_qty DECIMAL(18,4) DEFAULT 0,
supplier_id BIGINT,
status INT DEFAULT 1,
warning_threshold BIGINT DEFAULT 100,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_input_tenant_id` (tenant_id),
    INDEX `idx_input_material_code` (material_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_input_inventory (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
material_id BIGINT,
warehouse_id BIGINT,
quantity DECIMAL(12,4) DEFAULT 0,
location TEXT,
batch_number TEXT,
expire_date DATE,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    INDEX `idx_inventory_tenant_id` (tenant_id),
    INDEX `idx_inventory_material_id` (material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_harvest_record (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
harvest_code VARCHAR(191) NOT NULL UNIQUE,
crop_name TEXT NOT NULL,
farm_id BIGINT,
plot_id BIGINT,
harvest_date DATE,
quantity DECIMAL(12,4),
unit TEXT,
quality_grade TEXT,
moisture_content DECIMAL(5,2),
weight_net DECIMAL(12,4),
weight_gross DECIMAL(12,4),
batch_number VARCHAR(191),
expected_quantity DECIMAL(18,4),
actual_quantity DECIMAL(18,4),
farm_code VARCHAR(191),
plot_code VARCHAR(191),
harvest_team VARCHAR(191),
supervisor VARCHAR(191),
weather_condition VARCHAR(191),
photos TEXT,
notes TEXT,
trace_code VARCHAR(191),
storage_location TEXT,
transporter TEXT,
vehicle_number TEXT,
harvest_method TEXT,
status VARCHAR(255) DEFAULT 'pending',
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_harvest_tenant_id` (tenant_id),
    INDEX `idx_harvest_harvest_code` (harvest_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_harvest_inventory (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
harvest_id BIGINT,
location TEXT,
quantity DECIMAL(12,4),
quality_grade TEXT,
storage_conditions TEXT,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    INDEX `idx_harvest_inv_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_trace_code (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
trace_code VARCHAR(191) NOT NULL UNIQUE,
harvest_id BIGINT,
product_name TEXT,
product_spec TEXT,
batch_code TEXT,
production_date DATE,
expiry_date DATE,
status VARCHAR(255) DEFAULT 'inactive',
qr_code_url TEXT,
trace_data TEXT,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    INDEX `idx_trace_tenant_id` (tenant_id),
    INDEX `idx_trace_trace_code` (trace_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_alert_rule (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
rule_code VARCHAR(191) NOT NULL UNIQUE,
rule_name TEXT NOT NULL,
alert_type TEXT,
level TEXT,
source_type TEXT,
source_id BIGINT,
condition_expression TEXT,
threshold_min DECIMAL(12,4),
threshold_max DECIMAL(12,4),
unit TEXT,
description TEXT,
is_enabled BIGINT DEFAULT 1,
notify_users TEXT,
notify_methods TEXT,
remind_interval BIGINT DEFAULT 60,
auto_handle BIGINT DEFAULT 0,
handle_script TEXT,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_alert_rule_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_alert_record (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
alert_code VARCHAR(191) NOT NULL UNIQUE,
rule_id BIGINT,
title TEXT,
level TEXT,
source_type TEXT,
source_id BIGINT,
source_name TEXT,
content TEXT,
value DECIMAL(12,4),
threshold_min DECIMAL(12,4),
threshold_max DECIMAL(12,4),
status VARCHAR(255) DEFAULT 'unhandled',
handle_time DATETIME,
handle_user TEXT,
handle_result TEXT,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    INDEX `idx_alert_record_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_emergency_plan (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
plan_code VARCHAR(191) NOT NULL UNIQUE,
plan_name TEXT NOT NULL,
plan_type TEXT,
level TEXT,
description TEXT,
trigger_conditions TEXT,
response_steps TEXT,
responsible_person TEXT,
contact_info TEXT,
resources_required TEXT,
execute_script TEXT,
is_enabled BIGINT DEFAULT 1,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_emergency_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_quality_inspection (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
inspection_code VARCHAR(191) NOT NULL UNIQUE,
harvest_id BIGINT,
sample_code TEXT,
inspect_date DATE,
inspect_items TEXT,
results TEXT,
conclusion TEXT,
inspector TEXT,
audit_status VARCHAR(255) DEFAULT 'pending',
audit_time DATETIME,
auditor TEXT,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_quality_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_inspection_item (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
item_code VARCHAR(191) NOT NULL UNIQUE,
item_name TEXT NOT NULL,
item_type TEXT,
standard_value TEXT,
unit TEXT,
method TEXT,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_inspection_item_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_iot_device (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
device_code VARCHAR(191) NOT NULL UNIQUE,
device_name TEXT NOT NULL,
device_type TEXT,
device_model TEXT,
manufacturer TEXT,
install_location TEXT,
-- 下面这批列是**实体已经在用、而建表脚本原先没有**的（详见 schema-patch-device-columns.sql 的说明：
-- 设备表与实体是两套设计，交集只有 12 列）。这里补上是为新库一次建对；
-- location / last_online_time 与旧列 install_location / last_connect_time 同义，老库用补丁脚本搬迁。
location TEXT,
mac_address TEXT,
install_date DATETIME,
last_online_time DATETIME,
battery_level BIGINT,
signal_strength BIGINT,
serial_number TEXT,
firmware_version TEXT,
description TEXT,
farm_id BIGINT,
plot_id BIGINT,
status VARCHAR(255) DEFAULT 'offline',
last_connect_time DATETIME,
ip_address TEXT,
protocol TEXT,
data_interval BIGINT DEFAULT 60,
is_enabled BIGINT DEFAULT 1,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_iot_device_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_sensor_data (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
device_id BIGINT,
sensor_type TEXT,
value DECIMAL(12,4),
unit TEXT,
collect_time DATETIME DEFAULT CURRENT_TIMESTAMP,
quality VARCHAR(255) DEFAULT 'good',
-- 同上：实体用的是 data_time / quality_flag / device_code / sensor_name / raw_data / farm_id / plot_id
device_code TEXT,
sensor_name TEXT,
data_time DATETIME,
quality_flag VARCHAR(255),
raw_data TEXT,
farm_id BIGINT,
plot_id BIGINT,
tenant_id VARCHAR(191) NOT NULL,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sensor_tenant_id` (tenant_id),
    INDEX `idx_sensor_device_id` (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_sop_template (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
template_code VARCHAR(191) NOT NULL UNIQUE,
template_name TEXT NOT NULL,
crop_type TEXT,
task_type TEXT,
description TEXT,
steps TEXT,
duration BIGINT,
required_tools TEXT,
safety_notes TEXT,
is_enabled BIGINT DEFAULT 1,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_sop_template_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_sop_execution (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
execution_code VARCHAR(191) NOT NULL UNIQUE,
template_id BIGINT,
template_name TEXT,
farm_id BIGINT,
plot_id BIGINT,
executor_id BIGINT,
executor_name TEXT,
start_time DATETIME,
end_time DATETIME,
status VARCHAR(255) DEFAULT 'pending',
current_step BIGINT DEFAULT 0,
execution_log TEXT,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_sop_execution_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_soil_record (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
plot_id BIGINT,
sample_date DATE,
ph_value DECIMAL(4,2),
organic_matter DECIMAL(5,2),
nitrogen DECIMAL(10,4),
phosphorus DECIMAL(10,4),
potassium DECIMAL(10,4),
moisture_content DECIMAL(5,2),
temperature DECIMAL(5,2),
recommendations TEXT,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_soil_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_planting_plan (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
plan_code VARCHAR(191) NOT NULL UNIQUE,
plan_name TEXT NOT NULL,
-- 实体与前端契约要用、建表脚本原先没有的列（详见 schema-patch-plan-page.sql 的说明）：
--   实体侧：plan_year / plan_season / plan_status / total_area / total_budget / expected_output /
--           expected_profit / start_date / end_date / plan_summary / approval_comment / approver / approval_time
--   契约侧：plot_name / crop_id / crop_name / crop_variety / manager_id / manager_name /
--           sop_template_id / farm_name（后两个名字是冗余展示字段）
plan_year BIGINT,
plan_season VARCHAR(191),
plan_status VARCHAR(255) DEFAULT 'draft',
total_area DECIMAL(18,4),
total_budget DECIMAL(18,4),
expected_output DECIMAL(18,4),
expected_profit DECIMAL(18,4),
start_date DATETIME,
end_date DATETIME,
plan_summary TEXT,
approval_comment TEXT,
approver VARCHAR(191),
approval_time DATETIME,
plot_name VARCHAR(191),
farm_name VARCHAR(191),
crop_id BIGINT,
crop_name VARCHAR(191),
crop_variety VARCHAR(191),
manager_id BIGINT,
manager_name VARCHAR(191),
sop_template_id BIGINT,
crop_type TEXT,
variety TEXT,
farm_id BIGINT,
plot_id BIGINT,
planned_area DECIMAL(12,4),
actual_area DECIMAL(12,4),
planting_date DATE,
expected_harvest_date DATE,
target_yield DECIMAL(12,4),
status VARCHAR(255) DEFAULT 'pending',
tasks TEXT,
inputs TEXT,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_planting_plan_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- 种子里的 tenant_id = '2001' 是**演示经营主体**（绿源农业合作社）。
-- 口径（2026-10-14 拍板）：一主体一租户，tenant_id 存经营主体 id；不需要市场维度。
-- 也就是说这些演示数据只有绑定到 2001 的账号看得到；运营端不受租户限制（传 null 即全平台）。
INSERT IGNORE INTO agri_prod_farm_info (farm_code, farm_name, tenant_id) VALUES ('F001', '示范农场', '2001');
INSERT IGNORE INTO agri_prod_farm_info (farm_code, farm_name, tenant_id) VALUES ('F002', '绿色生态园', '2001');
INSERT IGNORE INTO agri_prod_plot_info (plot_code, plot_name, farm_id, tenant_id) VALUES ('P001', 'A区-地块1', 1, '2001');
INSERT IGNORE INTO agri_prod_plot_info (plot_code, plot_name, farm_id, tenant_id) VALUES ('P002', 'A区-地块2', 1, '2001');
INSERT IGNORE INTO agri_prod_plot_info (plot_code, plot_name, farm_id, tenant_id) VALUES ('P003', 'B区-地块1', 2, '2001');
INSERT IGNORE INTO agri_prod_task_info (task_code, task_name, task_type, farm_id, plot_id, tenant_id) VALUES ('T001', '春季施肥', '施肥', 1, 1, '2001');
INSERT IGNORE INTO agri_prod_task_info (task_code, task_name, task_type, farm_id, plot_id, tenant_id) VALUES ('T002', '病虫害防治', '防治', 1, 2, '2001');
INSERT IGNORE INTO agri_prod_input_material (material_code, material_name, material_type, unit, tenant_id) VALUES ('M001', '有机肥料', 'FERTILIZER', 'kg', '2001');
INSERT IGNORE INTO agri_prod_input_material (material_code, material_name, material_type, unit, tenant_id) VALUES ('M002', '生物农药', 'PESTICIDE', 'L', '2001');
INSERT IGNORE INTO agri_prod_input_inventory (material_id, quantity, tenant_id) VALUES (1, 5000, '2001');
INSERT IGNORE INTO agri_prod_input_inventory (material_id, quantity, tenant_id) VALUES (2, 200, '2001');
INSERT IGNORE INTO agri_prod_harvest_record (harvest_code, crop_name, farm_id, plot_id, harvest_date, quantity, unit, tenant_id) VALUES ('H001', '西红柿', 1, 1, '2024-01-15', 2500, 'kg', '2001');
INSERT IGNORE INTO agri_prod_alert_rule (rule_code, rule_name, alert_type, level, tenant_id) VALUES ('R001', '土壤湿度异常', 'soil', 'warning', '2001');
INSERT IGNORE INTO agri_prod_alert_rule (rule_code, rule_name, alert_type, level, tenant_id) VALUES ('R002', '温度超限', 'temperature', 'error', '2001');

-- 演示设备（设备列表页要有东西可看；device_code 唯一，INSERT IGNORE 可重复执行）
INSERT IGNORE INTO agri_prod_iot_device
    (device_code, device_name, device_type, device_model, manufacturer, install_location, location,
     farm_id, plot_id, status, ip_address, protocol, serial_number, firmware_version,
     battery_level, signal_strength, last_online_time, is_enabled, tenant_id)
VALUES
    ('DEV001', '一号大棚温湿度传感器', 'sensor', 'TH-100', '农芯科技', 'A区-地块1', 'A区-地块1',
     1, 1, 'online', '192.168.1.21', 'MQTT', 'SN-TH-0001', 'v1.2.3',
     92, -55, NOW(), 1, '2001'),
    ('DEV002', '二号大棚土壤墒情仪', 'sensor', 'SM-200', '农芯科技', 'A区-地块2', 'A区-地块2',
     1, 2, 'online', '192.168.1.22', 'MQTT', 'SN-SM-0002', 'v1.1.8',
     78, -61, NOW(), 1, '2001'),
    ('DEV003', '气象站（离线备用）', 'weather_station', 'WS-500', '云耕智能', 'B区-地块1', 'B区-地块1',
     2, 3, 'offline', '192.168.1.30', 'HTTP', 'SN-WS-0003', 'v2.0.1',
     NULL, NULL, NULL, 1, '2001');

-- 演示传感器读数（设备 1 的三条，让"历史数据/统计"两个接口有真实数值可看；
-- 表上没有唯一键，用显式 id + INSERT IGNORE 保证可重复执行）
INSERT IGNORE INTO agri_prod_sensor_data
    (id, device_id, device_code, sensor_type, sensor_name, value, unit, data_time, quality_flag, farm_id, plot_id, tenant_id)
VALUES
    -- 三条都是同一传感器类型：/sensor-data/statistics 的契约是"按设备"聚合（方法签名里没有
    -- sensorType），混着不同量纲会让 avg/max/min 变成没有意义的数字（℃ 和 % 一起平均）。
    (1, 1, 'DEV001', 'temperature', '空气温度', 24.5000, '℃', '2026-10-13 08:00:00', 'good', 1, 1, '2001'),
    (2, 1, 'DEV001', 'temperature', '空气温度', 26.3000, '℃', '2026-10-13 12:00:00', 'good', 1, 1, '2001'),
    (3, 1, 'DEV001', 'temperature', '空气温度', 27.8000, '℃', '2026-10-13 16:00:00', 'good', 1, 1, '2001');

-- ---------------------------------------------------------------- 任务模板库
-- 任务执行记录（打卡）。前端「农事任务详情」读的是 recordId/executeTime/executeType/
-- photos/gpsLat/gpsLng/gpsDistance/abnormalDesc/offlineFlag —— 实体字段名直接按这套命名，
-- 物理列用 snake_case。
CREATE TABLE IF NOT EXISTS agri_prod_task_record (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
task_id BIGINT NOT NULL,
executor_id BIGINT,
executor_name VARCHAR(191),
execute_time DATETIME,
execute_type BIGINT COMMENT '1 开始 2 过程 3 完成',
photos TEXT COMMENT '照片地址（JSON 数组字符串或逗号分隔）',
gps_lat DECIMAL(12,8),
gps_lng DECIMAL(12,8),
gps_distance DECIMAL(12,2) COMMENT '距地块中心距离（米）',
abnormal_desc TEXT,
offline_flag BIGINT DEFAULT 0 COMMENT '0 在线 1 离线补传',
tenant_id VARCHAR(191) NOT NULL,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_task_record_task_id` (task_id),
    INDEX `idx_task_record_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 演示打卡记录（任务 1 的两条：开始 + 过程）
INSERT IGNORE INTO agri_prod_task_record
    (id, task_id, executor_id, executor_name, execute_time, execute_type, photos, gps_lat, gps_lng, gps_distance, offline_flag, tenant_id)
VALUES
    (1, 1, 11, '王师傅', '2026-10-13 07:40:00', 1, '[]', 45.12345678, 126.65432100, 12.50, 0, '2001'),
    (2, 1, 11, '王师傅', '2026-10-13 09:20:00', 2, '[]', 45.12349999, 126.65439999, 15.20, 0, '2001');

-- ---------------------------------------------------------------- 任务模板库
-- 前端「农事任务管理 → 任务模板库」要读它；实体 TaskTemplate 早就写好，
-- 但建表脚本里一直没有这张表（接口一调就 "Table ... doesn't exist"）。
-- 列名按实体（= 接口口径）建。
CREATE TABLE IF NOT EXISTS agri_prod_task_template (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
template_code VARCHAR(191) NOT NULL UNIQUE,
template_name TEXT NOT NULL,
template_type VARCHAR(255),
crop_category VARCHAR(255),
crop_name VARCHAR(255),
task_type VARCHAR(255),
growth_stage VARCHAR(255),
description TEXT,
template_content TEXT,
recommended_duration_hours BIGINT,
required_inputs TEXT,
optional_inputs TEXT,
is_system BIGINT DEFAULT 0,
use_count BIGINT DEFAULT 0,
sort_order BIGINT DEFAULT 0,
status VARCHAR(255) DEFAULT 'active',
del_flag BIGINT DEFAULT 0,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
remark TEXT,
    INDEX `idx_task_template_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 演示模板（系统内置两条；template_code 唯一，INSERT IGNORE 可重复执行）
INSERT IGNORE INTO agri_prod_task_template
    (template_code, template_name, template_type, crop_category, crop_name, task_type, growth_stage,
     description, template_content, recommended_duration_hours, required_inputs, is_system, status, tenant_id)
VALUES
    ('TPL-FERT-01', '水稻春季追肥标准作业', 'system', '粮食作物', '水稻', '施肥', '分蘖期',
     '分蘖期追施尿素，促进有效分蘖', '1) 按 15kg/亩 称量尿素；2) 均匀撒施；3) 施后浅水灌溉并记录。',
     4, '尿素,复合肥', 1, 'active', '2001'),
    ('TPL-PEST-01', '大棚病虫害统防统治', 'system', '蔬菜', '西红柿', '打药', '结果期',
     '结果期预防灰霉病与白粉虱', '1) 检查虫口密度；2) 生物农药优先；3) 用药后记录安全间隔期。',
     3, '生物农药', 1, 'active', '2001');

-- ---------------------------------------------------------------- 生产计划（演示）
-- 种植计划页要有东西可看：一条"进行中"的水稻春茬计划。
-- plan_status 用词表值（draft / pending / active / completed / terminated），
-- 出参里由 PlantingPlanVO 映射成前端契约的 1..5。
INSERT IGNORE INTO agri_prod_planting_plan
    (plan_code, plan_name, plan_year, plan_season, plan_status, total_area, total_budget,
     expected_output, expected_profit, start_date, end_date, plan_summary,
     farm_id, farm_name, plot_id, plot_name, crop_id, crop_name, crop_variety,
     manager_id, manager_name, sop_template_id, tenant_id)
VALUES
    ('PLAN-2026-SPR-01', '2026 年春茬水稻种植计划', 2026, '春季', 'active', 120.0000, 86000.0000,
     60000.0000, 42000.0000, '2026-04-01 00:00:00', '2026-09-30 00:00:00',
     '五常基地春茬水稻：4 月整地播种，9 月收获；配套追肥与病虫防治 SOP。',
     1, '示范农场', 1, 'A区-地块1', 1, '水稻', '五常稻花香2号',
     1, '张工（农场管理员）', (SELECT id FROM agri_prod_task_template WHERE template_code = 'TPL-FERT-01'), '2001');

-- ---------------------------------------------------------------- 生育期阶段（种养计划详情页）
-- 前端「种养计划详情」页要读/写它：GET /plans/{planId}/stages/list 与
-- POST/PUT/DELETE /plans/{planId}/stages[/{stageId}]；实体 PlanStage 已按契约写好，
-- 而建表脚本里一直没有这张表 —— 一调就是 "Table 'agri_production.agri_prod_plan_stage'
-- doesn't exist"，详情页的阶段列表恒为空、新增阶段必然失败。
-- 列名按实体（= 接口口径）建。刻意**没有 farm_id**：阶段按"租户 + 计划"归属。
CREATE TABLE IF NOT EXISTS agri_prod_plan_stage (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    plan_id BIGINT NOT NULL,
    stage_seq INT,
    stage_name VARCHAR(191) NOT NULL,
    task_type VARCHAR(191),
    plan_start_date DATE,
    plan_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    description TEXT,
    status INT DEFAULT 1,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_plan_stage_plan_id` (plan_id),
    INDEX `idx_plan_stage_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 演示阶段：与演示计划 PLAN-2026-SPR-01 的说明一致（4 月整地播种 → 9 月收获）。
-- 前两个阶段已完成、第三个进行中、第四个未开始 —— 详情页的完成率与"最大延误"两处判定
-- 都需要"有真有假"的输入才有意义（全部已完成等于没验）。
INSERT IGNORE INTO agri_prod_plan_stage
    (id, plan_id, stage_seq, stage_name, task_type, plan_start_date, plan_end_date,
     actual_start_date, actual_end_date, description, status, tenant_id)
VALUES
    (1, (SELECT id FROM agri_prod_planting_plan WHERE plan_code = 'PLAN-2026-SPR-01'),
     1, '整地期', '整地', '2026-04-01', '2026-04-10', '2026-04-01', '2026-04-09',
     '旋耕两遍、施足底肥，田面平整度误差控制在 3cm 以内。', 3, '2001'),
    (2, (SELECT id FROM agri_prod_planting_plan WHERE plan_code = 'PLAN-2026-SPR-01'),
     2, '播种育秧期', '播种', '2026-04-11', '2026-04-30', '2026-04-11', '2026-04-28',
     '浸种催芽后播种，秧田期保持浅水层。', 3, '2001'),
    (3, (SELECT id FROM agri_prod_planting_plan WHERE plan_code = 'PLAN-2026-SPR-01'),
     3, '分蘖期', '追肥', '2026-05-01', '2026-06-20', NULL, NULL,
     '分蘖肥一次，配合灌排水晒田。', 2, '2001'),
    (4, (SELECT id FROM agri_prod_planting_plan WHERE plan_code = 'PLAN-2026-SPR-01'),
     4, '抽穗灌浆期', '防治', '2026-06-21', '2026-08-20', NULL, NULL,
     '重点防治稻瘟病与稻飞虱，保持田间湿润。', 1, '2001'),
    (5, (SELECT id FROM agri_prod_planting_plan WHERE plan_code = 'PLAN-2026-SPR-01'),
     5, '成熟收获期', '收获', '2026-08-21', '2026-09-30', NULL, NULL,
     '九成熟收割，晒场水分降到 14% 以下。', 1, '2001');

-- ---------------------------------------------------------------- 农资投入品（两张新表 + 演示数据）
-- 前端「投入品」这一组页面（台账 / 出入库 / 使用记录 / 流水账）读的是：
--   api/inputs.ts 的 InputInfo（inputCode/inputName/inputType/spec/unit/manufacturer/
--   registrationNo/safetyInterval/stockQty/warnQty/supplierId/status + 后端回填的 nearestExpireDate）、
--   InputStockFlow（flowType 1入库 2领用 3退回 4盘盈 5盘亏 6报损，qty 带符号）、
--   types/input 的 InputUsageRecord（dosage / method 是契约字段名）。
-- 档案表 agri_prod_input_material 本来就有，缺的 5 列已在上面的 CREATE 里补齐
-- （老库由 schema-patch-input-page.sql 补）；流水与使用记录两张表原先根本不存在。
--
-- ⚠️ 演示数据的 input_id **一律按 material_code 子查询取**，不写死自增号：
--    这张表在建库脚本前面就已经种下两条（M001 有机肥料 / M002 生物农药），
--    先前演示行用 id 1..4 时主键撞车被 INSERT IGNORE 静默跳过，
--    流水于是挂到了那两条种子身上 —— 档案库存 0、流水却写着 +40，两处对不上。

CREATE TABLE IF NOT EXISTS agri_prod_input_stock_flow (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    input_id BIGINT NOT NULL,
    warehouse_id BIGINT,
    flow_type INT NOT NULL COMMENT '1入库 2领用 3退回 4盘盈 5盘亏 6报损',
    qty DECIMAL(18,4) NOT NULL COMMENT '带符号：入库/退回/盘盈为正，领用/盘亏/报损为负',
    batch_no VARCHAR(191),
    expire_date DATE,
    operator_id BIGINT,
    related_task_id BIGINT,
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_input_flow_input_id` (input_id),
    INDEX `idx_input_flow_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_input_usage (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT,
    plot_id BIGINT,
    farm_id BIGINT,
    input_id BIGINT,
    input_name VARCHAR(191),
    dosage DECIMAL(18,4),
    unit VARCHAR(64),
    method VARCHAR(64) COMMENT '施用方式：喷施 / 沟施 / 撒施 …',
    operator_id BIGINT,
    used_at DATETIME,
    safety_interval_days INT,
    status INT DEFAULT 1 COMMENT '1正常 0作废',
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_input_usage_input_id` (input_id),
    INDEX `idx_input_usage_task_id` (task_id),
    INDEX `idx_input_usage_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 四条农资覆盖页面上会出现的三种关键状态：正常、低库存且临期、低库存（无效期流水）。
-- stock_qty 与流水**必须对得上**（这是这一页最容易被看穿的假数据）：
--   复合肥 40 = +40；稻瘟灵 6 = +10 − 4；种子 30 = +30；基质盘 2 = +2
INSERT IGNORE INTO agri_prod_input_material
    (id, material_code, material_name, material_type, specification, unit, manufacturer,
     registration_no, safety_interval, stock_qty, warning_threshold, status, tenant_id, remark)
VALUES
    (101, 'IN-DEMO-001', '复合肥（水稻专用）', 'FERTILIZER', '50kg/袋', '袋', '中化化肥有限公司',
     '农肥（2024）准字1234号', NULL, 40.0000, 20.0000, 1, '2001', '底肥与分蘖肥通用'),
    (102, 'IN-DEMO-002', '稻瘟灵乳油', 'PESTICIDE', '500ml/瓶', '瓶', '湖南海利化工股份有限公司',
     'PD20231234', 21, 6.0000, 10.0000, 1, '2001', '防治稻瘟病，安全间隔期 21 天'),
    (103, 'IN-DEMO-003', '五常稻花香2号种子', 'SEED', '5kg/袋', '袋', '五常市种子公司',
     NULL, NULL, 30.0000, 10.0000, 1, '2001', '春茬水稻用种'),
    (104, 'IN-DEMO-004', '育秧基质盘', 'OTHER', '60片/箱', '箱', '哈尔滨农垦塑料制品厂',
     NULL, NULL, 2.0000, 5.0000, 1, '2001', '育秧周转用');

INSERT IGNORE INTO agri_prod_input_stock_flow
    (id, input_id, flow_type, qty, batch_no, expire_date, operator_id, related_task_id, remark, tenant_id)
VALUES
    (101, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-001'),
     1, 40.0000, 'F20260401', '2027-04-01', 1, NULL, '春耕备肥入库', '2001'),
    (102, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-002'),
     1, 10.0000, 'P20260410', '2026-10-20', 1, NULL, '防治药剂入库（临期，用于验证临期提示）', '2001'),
    (103, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-002'),
     2, -4.0000, 'P20260410', '2026-10-20', 1, 2, '分蘖期稻瘟病防治领用', '2001'),
    (104, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-003'),
     1, 30.0000, 'S20260320', '2027-03-20', 1, NULL, '春播用种入库', '2001'),
    (105, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-004'),
     1, 2.0000, 'M20260101', NULL, 1, NULL, '育秧基质盘入库（无生产效期）', '2001');

-- 使用记录：挂到已有的演示任务 1（春季施肥）/ 2（病虫害防治）上，"关联任务"列才有内容
INSERT IGNORE INTO agri_prod_input_usage
    (id, task_id, plot_id, farm_id, input_id, input_name, dosage, unit, method, operator_id,
     used_at, safety_interval_days, status, tenant_id, remark)
VALUES
    (101, 1, 1, 1, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-001'),
     '复合肥（水稻专用）', 40.0000, '袋', '沟施', 1, '2026-04-05 08:00:00', NULL, 1, '2001', '整地期施底肥'),
    (102, 2, 1, 1, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-002'),
     '稻瘟灵乳油', 4.0000, '瓶', '喷施', 1, '2026-05-12 09:30:00', 21, 1, '2001', '分蘖期稻瘟病防治');

-- ---------------------------------------------------------------- 质量管理（检测单 + 检测机构 + 演示数据）
-- 前端「质量检测记录 / 质量分级管理」这一组页面读的是：
--   @agri/shared/types/quality 的 RawInspection（inspectionType SELF/SEND/SAMPLING、
--   status PENDING/TESTING/DONE、result PASS/FAIL、sampleQty/sampleAt、labId/labName、onChain）
--   与 TestingLab（labLevel 1国家级/2省级/3市级、status 1合作中/0已终止）。
--
-- 为什么不沿用旧的 agri_prod_quality_inspection：那张表的列是另一套设计
-- （inspection_code / inspect_date / inspect_items / conclusion / audit_status），与本契约
-- 几乎没有交集，而旧实体映射的 15 列里有 12 列在那张表上根本不存在 —— 也就是说运营端的
-- 检测单接口一直是 Unknown column。旧表实测 0 行，没有数据要迁，直接按契约另建。
-- 检测机构表原先不存在：页面上"送检机构"下拉永远是空的（接口 404，不是"还没有机构"）。

CREATE TABLE IF NOT EXISTS agri_prod_inspection (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    inspection_no VARCHAR(191) NOT NULL UNIQUE,
    batch_id BIGINT,
    batch_no VARCHAR(191),
    farm_id BIGINT,
    plot_id BIGINT,
    crop_id BIGINT,
    crop_name VARCHAR(191),
    inspection_type VARCHAR(32) COMMENT 'SELF 自检 / SEND 送检 / SAMPLING 抽检',
    inspector_id BIGINT,
    inspector_name VARCHAR(191),
    sample_qty DECIMAL(18,4),
    sample_at DATETIME,
    result VARCHAR(16) COMMENT 'PASS / FAIL，未出结论时为 NULL',
    report_url TEXT,
    status VARCHAR(32) DEFAULT 'PENDING' COMMENT 'PENDING / TESTING / DONE',
    lab_id BIGINT,
    lab_name VARCHAR(191),
    on_chain INT DEFAULT 0 COMMENT '1 已上链 / 0 未上链',
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_inspection_tenant_id` (tenant_id),
    INDEX `idx_inspection_batch_id` (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_testing_lab (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    lab_name VARCHAR(191) NOT NULL,
    lab_code VARCHAR(191) NOT NULL UNIQUE,
    lab_level INT COMMENT '1 国家级 / 2 省级 / 3 市级',
    contact_name VARCHAR(191),
    contact_phone VARCHAR(64),
    region VARCHAR(191),
    cert_no VARCHAR(191),
    status INT DEFAULT 1 COMMENT '1 合作中 / 0 已终止',
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_testing_lab_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 三家检测机构覆盖三个资质等级（页面按等级排序，三级要都有才有得看）
INSERT IGNORE INTO agri_prod_testing_lab
    (id, lab_name, lab_code, lab_level, contact_name, contact_phone, region, cert_no, status, tenant_id, remark)
VALUES
    (1, '黑龙江省农科院农产品质量检测中心', 'LAB-0001', 1, '王敏', '0451-86120001', '黑龙江省哈尔滨市',
     'HLJ-CMA-2024-001', 1, '2001', '国家级 CMA 资质'),
    (2, '中检集团黑龙江有限公司检测中心', 'LAB-0002', 2, '李强', '0451-86120002', '黑龙江省哈尔滨市',
     'CCIC-HLJ-2025-233', 1, '2001', '省级资质，可做农残与重金属'),
    (3, '五常市农产品质量安全检测站', 'LAB-0003', 3, '赵磊', '0451-86120003', '黑龙江省五常市',
     'WC-CMA-2023-017', 1, '2001', '市级资质，就近送检');

-- 五张检测单覆盖三种状态与三种结论组合（另有 2 张未出结论）：
--   PASS 2 张、FAIL 1 张、检测中 1 张、待检 1 张 —— 分级统计与各筛选条件都有真实命中。
-- 批次挂到已有的演示采收记录（id=1 / H001，作物西红柿），不另造批次。
INSERT IGNORE INTO agri_prod_inspection
    (id, inspection_no, batch_id, batch_no, farm_id, plot_id, crop_name, inspection_type,
     inspector_name, sample_qty, sample_at, result, status, lab_id, lab_name, on_chain, tenant_id, remark)
VALUES
    (1, 'QC-DEMO-001', 1, 'H001', 1, 1, '西红柿', 'SEND',
     '张工', 2.0000, '2026-05-20 09:15:00', 'PASS', 'DONE', 1, '黑龙江省农科院农产品质量检测中心', 1, '2001',
     '送检农残 48 项，全部合格'),
    (2, 'QC-DEMO-002', 1, 'H001', 1, 1, '西红柿', 'SAMPLING',
     '赵磊', 1.0000, '2026-06-02 10:00:00', 'FAIL', 'DONE', 2, '中检集团黑龙江有限公司检测中心', 0, '2001',
     '抽检检出毒死蜱超标，已转不合格品处置'),
    (3, 'QC-DEMO-003', 1, 'H001', 1, 1, '西红柿', 'SELF',
     '张工', 3.0000, '2026-06-15 08:40:00', 'PASS', 'DONE', 3, '五常市农产品质量安全检测站', 0, '2001',
     '基地自检糖度与外观分级'),
    (4, 'QC-DEMO-004', NULL, NULL, 1, 1, '西红柿', 'SEND',
     '张工', 2.0000, '2026-07-01 14:20:00', NULL, 'TESTING', 2, '中检集团黑龙江有限公司检测中心', 0, '2001',
     '送检微生物指标，实验室检测中'),
    (5, 'QC-DEMO-005', NULL, NULL, 1, 1, '西红柿', 'SELF',
     '李四', 1.0000, '2026-07-10 09:00:00', NULL, 'PENDING', NULL, NULL, 0, '2001',
     '待安排抽样');

-- ---------------------------------------------------------------- 质量分级规则（+ 演示数据）
-- POST / PUT / DELETE /quality/grading[/{id}] 在 core-platform 上是**既有实现**，
-- 切流到 agri-production 后这三个路径会变成 405（路径在、方法不在，网关回退只认 404 接不住）——
-- 也就是切流把原本能用的端点做坏了。这里把表和 CRUD 补回来。
-- GET /quality/grading 按"有没有分页/筛选参数"分流：无参 → 分级统计，带参 → 规则分页。
CREATE TABLE IF NOT EXISTS agri_prod_quality_grade_rule (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    grade_code VARCHAR(16) NOT NULL COMMENT 'A / B / C / D',
    grade_name VARCHAR(64),
    crop_id BIGINT,
    crop_name VARCHAR(191),
    metrics VARCHAR(255) COMMENT '分级指标，如 单果重 / 糖度 / 外观',
    criteria TEXT COMMENT '判定标准描述',
    price_factor DECIMAL(10,4) COMMENT '价格系数',
    status INT DEFAULT 1 COMMENT '1 启用 / 0 停用',
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_grade_rule_tenant_id` (tenant_id),
    INDEX `idx_grade_rule_crop_id` (crop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 四级规则（对应演示作物西红柿：A 特级 / B 一级 / C 二级 / D 等外），价格系数递减
INSERT IGNORE INTO agri_prod_quality_grade_rule
    (id, grade_code, grade_name, crop_id, crop_name, metrics, criteria, price_factor, status, tenant_id, remark)
VALUES
    (1, 'A', '特级', 1, '西红柿', '单果重 / 糖度 / 外观', '单果重≥200g，糖度≥6.5，无机械伤与病斑', 1.3000, 1, '2001', '供高端商超'),
    (2, 'B', '一级', 1, '西红柿', '单果重 / 糖度 / 外观', '单果重150-200g，糖度5.5-6.5，允许轻微色差', 1.1000, 1, '2001', '常规批发'),
    (3, 'C', '二级', 1, '西红柿', '单果重 / 糖度 / 外观', '单果重100-150g，糖度4.5-5.5', 0.9500, 1, '2001', '本地市场'),
    (4, 'D', '等外', 1, '西红柿', '单果重 / 糖度 / 外观', '不满足以上任一等级', 0.7000, 1, '2001', '加工原料');

-- ---------------------------------------------------------------- 采收批次 / 成品库存 / 库存流水
-- 前端「采收与库存」七页读的是三套契约（@agri/shared/types/harvest.ts）：
--   HarvestBatch（batchId/batchNo/plotId/cropId/harvestDate/quantity/unit/grade/status/
--     traceGenerated/inboundStatus/harvestArea/appearance/perMuYield/relatedTaskId…）
--   InventoryRecord（inventoryId/batchId/warehouseName/currentQty/frozenQty/locationCode/
--     lastInAt/lastOutAt/safeQty/expireDate/lossQty…）
--   InventoryFlow（flowId/batchId/flowType 1入库 2出库 3调拨 4损耗/quantity/orderNo/operatedAt…）
-- 这三张表原先都不存在（旧的是 harvest_record 那套"采收记录"，字段完全不同），
-- 所以按契约另建。采收记录表继续服务 /harvests/plan（按地块聚合已发生的采收）。

CREATE TABLE IF NOT EXISTS agri_prod_harvest_batch (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    batch_no VARCHAR(191) NOT NULL UNIQUE,
    plot_id BIGINT,
    plot_name VARCHAR(191),
    plan_id BIGINT,
    crop_id BIGINT,
    crop_name VARCHAR(191),
    crop_variety VARCHAR(191),
    harvest_date DATE,
    quantity DECIMAL(18,4),
    unit VARCHAR(32),
    grade VARCHAR(32) COMMENT 'A / B / C / D / reject / 待检',
    inspection_id BIGINT,
    inspection_no VARCHAR(191),
    operator_id BIGINT,
    operator_name VARCHAR(191),
    status INT DEFAULT 1 COMMENT '1 在库 2 部分出库 3 清空 4 冻结 5 归档',
    trace_generated INT DEFAULT 0,
    trace_code VARCHAR(191),
    farm_id BIGINT,
    farm_name VARCHAR(191),
    inbound_status INT DEFAULT 0 COMMENT '0 待入库 1 已入库 2 已出库',
    harvest_area DECIMAL(12,4) COMMENT '采收面积（亩）',
    appearance VARCHAR(32) COMMENT '外观等级：优 / 良 / 中 / 差',
    expected_quantity DECIMAL(18,4),
    per_mu_yield DECIMAL(18,4) COMMENT '亩产',
    related_task_id BIGINT,
    related_task_name VARCHAR(191),
    warehouse_name VARCHAR(191),
    inventory_id BIGINT,
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_harvest_batch_tenant_id` (tenant_id),
    INDEX `idx_harvest_batch_plot_id` (plot_id),
    INDEX `idx_harvest_batch_farm_id` (farm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_inventory (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    batch_no VARCHAR(191),
    warehouse_name VARCHAR(191) NOT NULL,
    current_qty DECIMAL(18,4) DEFAULT 0,
    unit VARCHAR(32),
    frozen_qty DECIMAL(18,4) DEFAULT 0,
    location_code VARCHAR(64),
    last_in_at DATETIME,
    last_out_at DATETIME,
    product_name VARCHAR(191),
    category VARCHAR(64),
    grade VARCHAR(32),
    safe_qty DECIMAL(18,4) COMMENT '安全库存',
    expire_date DATE,
    related_batch_no VARCHAR(191),
    loss_qty DECIMAL(18,4) DEFAULT 0,
    loss_reason VARCHAR(191),
    frozen INT DEFAULT 0 COMMENT '1 冻结 / 0 正常',
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_inventory_tenant_id` (tenant_id),
    INDEX `idx_inventory_batch_id` (batch_id),
    INDEX `idx_inventory_warehouse` (warehouse_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_inventory_flow (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    flow_type INT NOT NULL COMMENT '1 入库 2 出库 3 调拨 4 损耗',
    quantity DECIMAL(18,4) COMMENT '带符号：入库为正，出库/损耗为负',
    unit VARCHAR(32),
    operator_name VARCHAR(191),
    order_no VARCHAR(191),
    operated_at DATETIME,
    remark TEXT,
    warehouse_name VARCHAR(191),
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_inv_flow_batch_id` (batch_id),
    INDEX `idx_inv_flow_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 演示数据（tenant 2001）。三条批次 + 两条库存 + 三条流水，且**数量互为对账**：
--   批次 1：采收 1250kg → 入库 1250 → 库存 1250（未出库）
--   批次 2：采收  850kg → 入库 850 → 出库 450 → 库存 400
--   批次 3：采收  620kg → 尚未入库（inbound_status=0），因此没有库存行、没有流水
-- 地块/农场挂到已有的演示数据（plot 1/2、farm 1）。
INSERT IGNORE INTO agri_prod_harvest_batch
    (id, batch_no, plot_id, plot_name, crop_id, crop_name, crop_variety, harvest_date, quantity, unit,
     grade, operator_id, operator_name, status, trace_generated, trace_code, farm_id, farm_name,
     inbound_status, harvest_area, appearance, expected_quantity, per_mu_yield, warehouse_name,
     inventory_id, tenant_id, remark)
VALUES
    (1, 'H20260601', 1, 'A区-地块1', 1, '西红柿', '中杂9号', '2026-06-01', 1250.0000, 'kg',
     'A', 1, '张工', 1, 1, 'AG010101202606010001', 1, '示范农场',
     1, 2.0000, '优', 1500.0000, 625.0000, '冷藏库A', 1, '2001', '头茬果，全数入库'),
    (2, 'H20260528', 2, 'A区-地块2', 1, '西红柿', '中杂9号', '2026-05-28', 850.0000, 'kg',
     'B', 1, '张工', 2, 1, 'AG010102202605280001', 1, '示范农场',
     2, 1.5000, '良', 1200.0000, 567.0000, '冷藏库A', 2, '2001', '已出库 450kg 给批发商'),
    (3, 'H20260525', 1, 'A区-地块1', 1, '西红柿', '中杂9号', '2026-05-25', 620.0000, 'kg',
     'C', 1, '张工', 1, 0, NULL, 1, '示范农场',
     0, 1.0000, '中', 900.0000, 620.0000, NULL, NULL, '2001', '待入库');

INSERT IGNORE INTO agri_prod_inventory
    (id, batch_id, batch_no, warehouse_name, current_qty, unit, frozen_qty, location_code, last_in_at,
     last_out_at, product_name, category, grade, safe_qty, expire_date, related_batch_no, loss_qty,
     frozen, tenant_id, remark)
VALUES
    (1, 1, 'H20260601', '冷藏库A', 1250.0000, 'kg', 0, 'A-01-02', '2026-06-01 15:00:00',
     NULL, '西红柿(A级)', '西红柿', 'A', 200.0000, '2026-06-15', 'H20260601', 0,
     0, '2001', NULL),
    (2, 2, 'H20260528', '冷藏库A', 400.0000, 'kg', 0, 'A-02-01', '2026-05-28 16:20:00',
     '2026-06-02 10:00:00', '西红柿(B级)', '西红柿', 'B', 150.0000, '2026-06-10', 'H20260528', 0,
     0, '2001', NULL);

INSERT IGNORE INTO agri_prod_inventory_flow
    (id, batch_id, flow_type, quantity, unit, operator_name, order_no, operated_at, remark,
     warehouse_name, tenant_id)
VALUES
    (1, 1, 1, 1250.0000, 'kg', '张工', NULL, '2026-06-01 15:00:00', '采收入库', '冷藏库A', '2001'),
    (2, 2, 1, 850.0000, 'kg', '张工', NULL, '2026-05-28 16:20:00', '采收入库', '冷藏库A', '2001'),
    (3, 2, 2, -450.0000, 'kg', '张工', 'SO20260602', '2026-06-02 10:00:00', '销售出库', '冷藏库A', '2001');
