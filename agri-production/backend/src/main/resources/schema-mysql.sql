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
INSERT IGNORE INTO agri_prod_input_material (material_code, material_name, material_type, unit, tenant_id) VALUES ('M001', '有机肥料', '肥料', 'kg', '2001');
INSERT IGNORE INTO agri_prod_input_material (material_code, material_name, material_type, unit, tenant_id) VALUES ('M002', '生物农药', '农药', 'L', '2001');
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
