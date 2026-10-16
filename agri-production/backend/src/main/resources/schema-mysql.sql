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
-- farm_id 是基类 BaseEntity 的通用"所属农场"（Long）；本表这一列是历史遗留的 VARCHAR，
-- 不参与农场身份映射（平台侧标识用下面的 platform_farm_id），也不能删：
-- BaseEntity.farmId 映射到它，MyBatis-Plus 的 selectById 会带上这一列。
farm_id VARCHAR(191),
platform_farm_id VARCHAR(64) COMMENT '平台侧农场标识（DEMO-FARM-xxx），用于把页面传回的 farmId 换算成本地主键；见 schema-patch-farm-identity.sql',
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
remark TEXT,
    INDEX `idx_farm_tenant_id` (tenant_id),
    INDEX `idx_farm_farm_code` (farm_code),
    -- 平台侧农场标识唯一（一个平台农场只映射到一行本地农场）；演示数据见 schema-patch-farm-identity.sql
    UNIQUE KEY `uk_farm_platform_id` (platform_farm_id)
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
harvest_code VARCHAR(191),
batch_number VARCHAR(191),
product_code VARCHAR(191),
farm_id BIGINT,
farm_code VARCHAR(191),
farm_name VARCHAR(191),
plot_id BIGINT,
plot_code VARCHAR(191),
crop_name VARCHAR(191),
quality_grade VARCHAR(64),
harvest_date DATE,
activate_time DATETIME,
first_query_time DATETIME,
query_count INT DEFAULT 0,
blockchain_tx_hash VARCHAR(191),
blockchain_block_height BIGINT,
remark TEXT,
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
rule_code VARCHAR(64) COMMENT '规则编码（冗余，便于列表直接展示）',
alert_type VARCHAR(64) COMMENT '预警类型；列表按此筛选',
farm_id BIGINT COMMENT '所属农场',
plot_id BIGINT COMMENT '所属地块',
unit VARCHAR(32) COMMENT '指标单位（阈值/实测值共用）',
remark TEXT COMMENT '备注',
emergency_plan_id BIGINT COMMENT '命中的应急预案',
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    INDEX `idx_alert_record_tenant_id` (tenant_id),
    INDEX `idx_alert_record_type` (alert_type)
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
-- 以下 4 列由 schema-patch-alert-page.sql 补（旧库已有本表，CREATE IF NOT EXISTS 不会加列）。
-- 另注：实体还声明了 triggerCondition / alertLevel / steps / resourcesNeeded 四个字段，
-- 它们**映射到上面的 trigger_conditions / level / response_steps / resources_required 旧列**，
-- 不再新增同义列 —— 见 EmergencyPlan 类注释与补丁文件说明。
steps_json TEXT COMMENT '处置步骤（结构化 JSON；与 response_steps 的纯文本互为两种形态）',
related_parties TEXT COMMENT '联动单位/相关方',
execute_count INT DEFAULT 0 COMMENT '已执行次数',
last_execute_time DATETIME COMMENT '最近一次执行时间',
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
-- 平台侧设备标识（prod_iot_device.device_id，形如 DEMO-DEV-001）：
-- 与农场表的 platform_farm_id 同法，用于把平台侧标识（绑定/指令/维修记录、页面回传值）换算成本地主键。
-- 存量库没有这一列，用 schema-patch-iot-demo.sql 里的守卫式 ALTER 补上。
platform_device_id VARCHAR(64) COMMENT '平台侧设备标识（DEMO-DEV-xxx）',
-- 地块标识（页面口径）：设备列表要显示"关联地块"，而页面用 device.plotId 去它的地块名映射里查 ——
-- 映射的键是平台侧地块标识（DEMO-PLOT-xxx）。本服务的 plot_id 是数字主键，两边未收敛前用这一列承载
-- 平台侧标识（与绑定表的 bind_target_id 同源），否则设备列表的"关联地块"永远是"未绑定"。
plot_ref VARCHAR(64) COMMENT '地块标识（页面口径，如 DEMO-PLOT-001）',
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
    INDEX `idx_iot_device_tenant_id` (tenant_id),
    UNIQUE KEY `uk_iot_device_platform_id` (platform_device_id)
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
-- 以下 7 列由 schema-patch-sop-page.sql 补（旧库已有本表，CREATE IF NOT EXISTS 不会加列）。
-- 另注：实体还声明了 stepsText / estimatedDuration，它们**映射到上面的 steps / duration 旧列**，
-- 不再新增同义列 —— 见 SopTemplate 类注释。
category VARCHAR(64) COMMENT '标准分类',
applicable_crops TEXT COMMENT '适用作物（多值）',
applicable_seasons TEXT COMMENT '适用季节（多值）',
steps_json TEXT COMMENT '步骤（结构化 JSON）；纯文本形态复用已有 steps 列',
required_materials TEXT COMMENT '所需物料（与 required_tools 的"工具"区分开）',
version INT DEFAULT 1 COMMENT '版本号',
usage_count INT DEFAULT 0 COMMENT '被引用/下发次数',
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
-- 以下 5 列由 schema-patch-sop-page.sql 补（旧库已有本表，CREATE IF NOT EXISTS 不会加列）。
-- 另注：实体还声明了 executor / startedAt / completedAt / stepRecords / notes，
-- 它们**映射到上面的 executor_name / start_time / end_time / execution_log / remark 旧列**，
-- 不再新增同义列 —— 见 SopExecution 类注释。
template_code VARCHAR(64) COMMENT '模板编码（冗余，便于按编码检索）',
task_id BIGINT COMMENT '关联农事任务',
total_steps INT DEFAULT 0 COMMENT '总步骤数（与 current_step 配对算进度）',
actual_duration INT COMMENT '实际耗时（分钟）',
attachments TEXT COMMENT '附件（图片/文件 URL 列表）',
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
-- 这两个农场的 farm_code / 名称 / 平台标识必须与 schema-patch-farm-identity.sql 保持一致。
-- 教训（2026-10-15 实际踩到）：本文件每次启动都会跑，靠的是 farm_code 唯一键让 INSERT IGNORE 跳过；
-- 只要把已有行的 farm_code 换成别的值，重启就会**再插一条**（那天多出 2 行"示范农场/绿色生态园"，
-- 且不带平台标识，看起来像数据自己长出来的）。改演示行的唯一键值 = 改种子的幂等前提，两边要一起改。
-- 农场带所在地与面积：区域分布、种植面积排行都读这两组字段，缺了仪表盘上就只有"未标注区域"与 0。
-- 取值与平台侧演示农场（agri_core.prod_farm_info）一致 —— 同一批农场两边不该有两套面积。
INSERT IGNORE INTO agri_prod_farm_info
    (farm_code, farm_name, platform_farm_id, tenant_id, province, city, district, total_area)
    VALUES ('DEMO-FARMC-001', '【演示】华南绿色蔬菜示范农场', 'DEMO-FARM-001', '2001', '广东省', '广州市', '从化区', 1280.00);
INSERT IGNORE INTO agri_prod_farm_info
    (farm_code, farm_name, platform_farm_id, tenant_id, province, city, district, total_area)
    VALUES ('DEMO-FARMC-002', '【演示】华东智慧稻田农场', 'DEMO-FARM-002', '2001', '江苏省', '盐城市', '射阳县', 3600.00);
-- 地块带面积与在田作物：这两列曾经是空的，运营端仪表盘的「在田面积」与作物维度聚合因此恒为 0 /
-- 只剩"未标注作物"。新库从种子就要带上（存量库走 schema-patch-demo-areas.sql）。
INSERT IGNORE INTO agri_prod_plot_info (plot_code, plot_name, farm_id, tenant_id, area, current_crop)
    VALUES ('P001', 'A区-地块1', 1, '2001', 8.50, '西红柿');
INSERT IGNORE INTO agri_prod_plot_info (plot_code, plot_name, farm_id, tenant_id, area, current_crop)
    VALUES ('P002', 'A区-地块2', 1, '2001', 12.00, '西红柿');
INSERT IGNORE INTO agri_prod_plot_info (plot_code, plot_name, farm_id, tenant_id, area, current_crop)
    VALUES ('P003', 'B区-地块1', 2, '2001', 4.50, '水稻');
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
    -- reject_reason 由 schema-patch-quality-lab-page.sql 补（旧库已有本表，CREATE IF NOT EXISTS 不会加列）。
    -- 运营端「准入驳回」要落运营手填的原因，没有这一列就只能丢输入或假装成功。
    reject_reason VARCHAR(500) COMMENT '准入驳回原因（驳回时由运营手填）',
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

-- 演示溯源码（tenant 2001）：绑到演示采收批次，字段从批次推导，不编造
INSERT IGNORE INTO agri_prod_trace_code
    (id, trace_code, harvest_code, batch_number, product_name, status, farm_id, plot_id, crop_name,
     quality_grade, harvest_date, query_count, tenant_id)
SELECT 1, 'AG010101202606010001', b.batch_no, b.batch_no, CONCAT(b.crop_name, '(', b.grade, '级)'),
       'active', b.farm_id, b.plot_id, b.crop_name, b.grade, b.harvest_date, 0, '2001'
FROM agri_prod_harvest_batch b WHERE b.batch_no = 'H20260601';
INSERT IGNORE INTO agri_prod_trace_code
    (id, trace_code, harvest_code, batch_number, product_name, status, farm_id, plot_id, crop_name,
     quality_grade, harvest_date, query_count, tenant_id)
SELECT 2, 'AG010102202605280001', b.batch_no, b.batch_no, CONCAT(b.crop_name, '(', b.grade, '级)'),
       'inactive', b.farm_id, b.plot_id, b.crop_name, b.grade, b.harvest_date, 0, '2001'
FROM agri_prod_harvest_batch b WHERE b.batch_no = 'H20260528';
-- ---------------------------------------------------------------- 领域事件 outbox
-- 口径（2026-10-14 拍板）：**复用 core-platform core-infra 那套事件契约**，不自创机制 ——
-- 那边已有 DomainEventPublisher + EventTransport（local/http/rocketmq 三种实现）
-- + 事务性 outbox（OutboxMessage/OutboxService/OutboxRelay，状态 NEW → SENT）。
-- 这里落一张同构的表：payload 的字段名照抄 mod-produce 的 ProduceEvents record
-- （ProdBatchHarvested / QualityTestPassed / QualityTestFailed / TraceActivated）。
-- 投递由本服务的 DomainEventRelay 承担（业务代码不动）：NEW →（接收端确认 code=0）SENT；
-- 失败按指数退避重试，次数用尽转 DEAD（可经运营端重放）。
-- **绝不谎报"已发送"**：接收端只是 HTTP 200 但响应码非 0（例如入口在、监听器没有 = 404）
-- 一律算投递失败，原因记在 last_error 上 —— 详见 DomainEventRelay 的类注释。
CREATE TABLE IF NOT EXISTS agri_prod_domain_event (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(191) NOT NULL COMMENT '与 ProduceEvents 常量同名，如 prod.batch.harvested',
    event_key VARCHAR(191) COMMENT '事件键（业务主键），便于消费者幂等',
    payload TEXT COMMENT '事件载荷 JSON（字段名与平台 record 对齐）',
    status VARCHAR(32) DEFAULT 'NEW' COMMENT 'NEW 待投递 / SENT 已投递 / DEAD 投递失败（可重放）',
    occurred_at DATETIME COMMENT '事件发生时间',
    sent_at DATETIME COMMENT '投递时间；未投递为空',
    retry_count INT DEFAULT 0 COMMENT '已尝试投递次数（成功也计一次）',
    next_retry_at DATETIME NULL COMMENT '下次可投递时间；为空表示立即可投',
    last_error VARCHAR(500) NULL COMMENT '最近一次投递失败的原因',
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_domain_event_type` (event_type),
    INDEX `idx_domain_event_status` (status),
    INDEX `idx_domain_event_next_retry` (next_retry_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;-- 补丁：区块链存证两张表 + 演示数据（可重复执行）。
--
-- 背景：实体 ChainRecord / ChainVerifyLog 早就在 agri-production 里（列名、词表都定好了），
-- 而 **表一直没建** —— 一调就是 "Table 'agri_production.agri_prod_chain_record' doesn't exist"。
-- 这里按实体建列（= 接口口径），并补三条演示存证，让页面能看出成功/待上链/失败三种状态。
--
-- 列名的参照系：core-platform 的 prod_blockchain_record（record_id/biz_type/biz_no/batch_id/
-- trace_code/tx_hash/block_height/payload_hash/anchor_at/status）—— 两边的语义一致，
-- 本表用的是本服务实体的命名（record_no/chain_type/target_type/target_code/data_hash/…）。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-chain.sql

CREATE TABLE IF NOT EXISTS agri_prod_chain_record (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    record_no VARCHAR(191) NOT NULL UNIQUE,
    chain_type VARCHAR(64) COMMENT '链类型',
    target_type VARCHAR(64) COMMENT '业务类型（采收/质检/投入品/溯源码）',
    target_id BIGINT COMMENT '业务主键',
    target_code VARCHAR(191) COMMENT '业务单号/码值',
    data_hash VARCHAR(191) COMMENT '存证数据哈希',
    tx_hash VARCHAR(191) COMMENT '链上交易哈希；未上链为空',
    block_number BIGINT COMMENT '区块高度',
    chain_status VARCHAR(32) DEFAULT 'PENDING' COMMENT 'PENDING 待上链 / SUCCESS 已上链 / FAILED 失败',
    chain_time DATETIME COMMENT '出块时间',
    failed_reason VARCHAR(255) COMMENT '失败原因',
    retry_count INT DEFAULT 0,
    next_retry_time DATETIME,
    data_json TEXT COMMENT '存证原始数据（JSON）',
    del_flag INT DEFAULT 0,
    tenant_id VARCHAR(191) NOT NULL,
    create_by VARCHAR(191),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by VARCHAR(191),
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_chain_tenant_id` (tenant_id),
    INDEX `idx_chain_status` (chain_status),
    INDEX `idx_chain_target` (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_chain_verify_log (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    log_no VARCHAR(191) NOT NULL UNIQUE,
    chain_record_id BIGINT,
    target_type VARCHAR(64),
    target_id BIGINT,
    tx_hash VARCHAR(191),
    verify_status VARCHAR(32) COMMENT 'MATCH / MISMATCH / NOT_FOUND',
    verify_time DATETIME,
    verified_by VARCHAR(191),
    verify_result_json TEXT,
    remark TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_verify_chain_record_id` (chain_record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 演示存证（tenant 2001）：三条覆盖 SUCCESS / PENDING / FAILED，绑到演示批次与溯源码
INSERT IGNORE INTO agri_prod_chain_record
    (id, record_no, chain_type, target_type, target_id, target_code, data_hash, tx_hash, block_number,
     chain_status, chain_time, failed_reason, retry_count, tenant_id, create_time)
VALUES
    (1, 'CHAIN-20260601-0001', 'SIMULATED', 'HARVEST', 1, 'H20260601',
     SHA2('H20260601|采收|1250kg', 256),
     'SIMU7F3A1C9E5B2D4A6F8C0E1D2B3A4C5D6E', 1024,
     'SUCCESS', '2026-06-01 16:02:00', NULL, 0, '2001', '2026-06-01 15:58:00'),
    (2, 'CHAIN-20260615-0002', 'SIMULATED', 'QUALITY', 3, 'QC-DEMO-003',
     SHA2('QC-DEMO-003|质检|PASS', 256), NULL, NULL,
     'PENDING', NULL, NULL, 0, '2001', '2026-06-15 09:10:00'),
    (3, 'CHAIN-20260528-0003', 'SIMULATED', 'TRACE', 2, 'AG010102202605280001',
     SHA2('AG010102202605280001|溯源码', 256), NULL, NULL,
     'FAILED', NULL, '模拟链提交失败（演示数据，已重试 2 次）', 2, '2001', '2026-05-28 17:30:00');

-- 站内消息通知（用户端「消息中心」+ 布局右上角未读角标）。
--
-- 这张表原先只存在于平台侧（prod_message_notify），本服务没有 —— 而「消息中心」页与
-- 每个页面头部轮询的未读数都打 /api/v1/production/messages/**，属生产域用户端。
-- 建表放在 schema-mysql.sql（随应用启动自动建，IF NOT EXISTS 幂等），演示数据在
-- schema-patch-message-notify.sql。
--
-- msg_type 存平台侧的**字符串口径**（SYSTEM/TASK/ALERT/QUALITY），不落成数字：
-- 页面自己把字符串归一成 1~4（见 utils/production-adapter.ts 的 normalizeMessageType），
-- 后端再转一次等于两处维护同一张映射表，迟早对不上。
CREATE TABLE IF NOT EXISTS agri_prod_message_notify (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
message_id VARCHAR(32) NOT NULL COMMENT '消息编号（业务主键）',
tenant_id VARCHAR(191) NOT NULL,
farm_id VARCHAR(64) COMMENT '关联农场（本服务农场主键，字符串存）',
receiver_id VARCHAR(64) COMMENT '接收人（平台侧成员编号，如 DEMO-MEM-001）',
msg_type VARCHAR(20) COMMENT 'SYSTEM/TASK/ALERT/QUALITY',
title VARCHAR(128),
content VARCHAR(1000),
biz_id VARCHAR(64) COMMENT '业务单号（页面据此跳转）',
link_path VARCHAR(200) COMMENT '指定跳转路径；为空时页面按 biz_id 兜底',
read_flag TINYINT DEFAULT 0 COMMENT '已读 0否 1是',
sent_at DATETIME COMMENT '发送时间（列表按它倒序）',
read_at DATETIME COMMENT '阅读时间',
channel VARCHAR(20) DEFAULT 'INBOX' COMMENT '渠道 INBOX/SMS/WECHAT',
status TINYINT DEFAULT 1 COMMENT '状态 1有效 0撤回',
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    UNIQUE KEY `uk_msg_message_id` (message_id),
    INDEX `idx_msg_tenant_id` (tenant_id),
    INDEX `idx_msg_read_flag` (read_flag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 生产团队成员（用户端「团队与人员」）。
--
-- 字段口径照抄平台侧 prod_member（member_type = OWNER/AGRONOMIST/INSPECTOR/OPERATOR、
-- role_code = FARM_OWNER/AGRONOMIST/...），只在结构上换成本服务的约定：
-- 自增主键 + 业务编号 member_id、tenant_id varchar、create_time/update_time、deleted bigint。
--
-- status 的取值范围按**页面口径**：1 在职 / 2 待激活 / 0 已停用。平台侧老数据只有 1/0 两种，
-- 页面「邀请」时发的是 2（"邀请已发出，成员待激活"），所以这一列不能按布尔用。
CREATE TABLE IF NOT EXISTS agri_prod_member (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
member_id VARCHAR(32) NOT NULL COMMENT '成员编号（业务主键）',
tenant_id VARCHAR(191) NOT NULL,
farm_id VARCHAR(64) COMMENT '所属农场（本服务农场主键，字符串存）',
user_id VARCHAR(64) COMMENT '平台用户编号（未激活为空）',
member_name VARCHAR(50) COMMENT '姓名',
member_type VARCHAR(20) COMMENT 'OWNER/AGRONOMIST/INSPECTOR/OPERATOR',
phone VARCHAR(20),
role_code VARCHAR(32) COMMENT '角色编码，用于「角色与权限」页按角色聚合在职人数',
post_name VARCHAR(50) COMMENT '岗位',
join_date DATE COMMENT '加入日期',
status TINYINT DEFAULT 1 COMMENT '1 在职 / 2 待激活 / 0 已停用',
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    UNIQUE KEY `uk_member_member_id` (member_id),
    INDEX `idx_member_tenant_id` (tenant_id),
    INDEX `idx_member_role_code` (role_code),
    INDEX `idx_member_status` (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 系统配置项（用户端「报表与设置」→ 系统设置 → 参数配置）。
--
-- 列口径照抄平台侧 prod_sys_setting（setting_group / setting_key / setting_name / setting_value /
-- default_value / value_type / status），结构上换成本服务的约定（自增主键 + 业务编号 setting_id、
-- tenant_id varchar、create_time/update_time、deleted bigint）。
--
-- setting_key 上建唯一索引：本服务的保存语义是**按 key upsert**（与平台侧 saveSetting 一致），
-- 没有这个约束，并发下同一个 key 会出现两行，而"读配置"永远只取一行 —— 那种不一致极难发现。
CREATE TABLE IF NOT EXISTS agri_prod_sys_setting (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
setting_id VARCHAR(32) NOT NULL COMMENT '配置编号（业务主键）',
tenant_id VARCHAR(191) NOT NULL,
farm_id VARCHAR(64) COMMENT '所属农场（本服务农场主键，字符串存；全局配置为空）',
setting_group VARCHAR(32) COMMENT '分组：ALERT / TRACE / QUALITY …',
setting_key VARCHAR(64) NOT NULL COMMENT '配置键（页面叫 configKey）',
setting_name VARCHAR(100) COMMENT '配置名称',
setting_value VARCHAR(500) COMMENT '配置值（页面叫 configValue）',
default_value VARCHAR(500) COMMENT '默认值（用于页面"恢复默认"）',
value_type VARCHAR(16) COMMENT '值类型：string / number / boolean / json',
remark VARCHAR(200) COMMENT '说明（页面叫 description）',
status TINYINT DEFAULT 1 COMMENT '1 启用 0 停用',
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    UNIQUE KEY `uk_setting_setting_id` (setting_id),
    UNIQUE KEY `uk_setting_key` (tenant_id, setting_key),
    INDEX `idx_setting_group` (setting_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 生长监测记录（用户端「生长记录」「生长监测总览」）。
--
-- 【为什么建新表而不是复用平台侧 prod_growth_record 那套列】
-- 页面 GrowthRecord 契约要的是 growthLevel（长势评级 1~4）、leafAreaIndex（叶面积指数）、
-- pestInfo（病虫害描述）；平台侧的表只有 height / leaf_count / pest_level 三列能沾边。
-- 若把这三列做成"由株高/叶数现场推算"，页面上的长势与叶面积指数就是**算出来的**而不是**记下来的**，
-- 一旦被当成记录值使用（长势对比、评分），错误会被放大。所以按页面契约直接建列，由人工录入；
-- 只有演示行才按固定规则推（规则写在 schema-patch-growth-demo.sql 的注释里，可被推翻）。
--
-- 【plot_id 为什么是 VARCHAR 而不是本地数字主键】
-- 本服务的地块主数据（agri_prod_plot_info）与平台侧是**两份**，需要一个 platform_plot_id 映射才能
-- 对齐 —— 而这条映射属于「farms/plots 主数据收敛」那一轮（见《生产管理模块_剩余缺口处置方案_2026-10-16》
-- 第六节），本轮还没有。同时，页面上的地块下拉来自**仍留在平台侧的** GET /plots，回传的是
-- DEMO-PLOT-001 这类平台标识。此刻若把 plot_id 定义成本地数字主键：
--   · 机械转换演示数据时无映射可依，硬凑一个对应关系等于编数据；
--   · 页面按地块筛选/对比/总览会一条都匹配不上（或报错），表现为"筛了跟没筛一样"——
--     正是本项目一直在治的那类静默失效。
-- 因此本阶段的 plot_id 存**页面口径的地块标识**（机械抄自平台侧演示数据），plot_name 冗余落地供页面直接展示。
-- ⚠️ 第 6 轮地块主数据收敛时必须一并处理本表：给 agri_prod_plot_info 补 platform_plot_id 之后，
--    按它把本表 plot_id 回填成本地主键，并让所有按地块的过滤走同一套换算（FarmIdResolver 同法）。
CREATE TABLE IF NOT EXISTS agri_prod_growth_record (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
record_id VARCHAR(64) NOT NULL COMMENT '记录编号（业务主键，页面 recordId）',
plot_id VARCHAR(64) COMMENT '地块标识（当前为页面口径的平台侧标识，见上方说明）',
plot_name VARCHAR(100) COMMENT '地块名称（冗余，页面直接展示；平台侧标识无法本地反查，故随行落地）',
plan_id VARCHAR(64) COMMENT '种养计划标识（页面 planId，当前留空）',
crop_id VARCHAR(64) COMMENT '作物标识（页面 cropId，当前留空）',
crop_name VARCHAR(100) COMMENT '作物名称（页面 cropName）',
growth_stage VARCHAR(32) COMMENT '生育期：苗期 / 开花期 / 结果期 / 采收期',
record_date DATE COMMENT '记录日期',
plant_height DECIMAL(8,2) COMMENT '株高（cm）',
leaf_count INT COMMENT '叶片数',
leaf_area_index DECIMAL(6,2) COMMENT '叶面积指数（页面 leafAreaIndex；人工录入或演示规则推算）',
growth_level TINYINT COMMENT '长势评级 1 弱 / 2 偏弱 / 3 正常 / 4 旺盛',
pest_level TINYINT COMMENT '病虫害等级 0 无 / 1 轻 / 2 中 / 3 重',
pest_info VARCHAR(200) COMMENT '病虫害描述（页面 pestInfo）',
weather VARCHAR(50) COMMENT '天气',
photos TEXT COMMENT '现场照片（JSON 数组字符串；页面 resolveGrowthPhotos 两种形态都认）',
recorder_id VARCHAR(64) COMMENT '记录人标识（页面未回传，留空）',
recorder_name VARCHAR(100) COMMENT '记录人姓名（页面 recorderName）',
remark VARCHAR(500) COMMENT '备注（全链路溯源用）',
status TINYINT DEFAULT 1 COMMENT '1 有效 0 停用',
farm_id BIGINT COMMENT '所属农场（本服务农场主键；页面传回的农场标识经 FarmIdResolver 换算）',
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    UNIQUE KEY `uk_growth_record_id` (record_id),
    INDEX `idx_growth_tenant_id` (tenant_id),
    INDEX `idx_growth_plot_id` (plot_id),
    INDEX `idx_growth_farm_id` (farm_id),
    INDEX `idx_growth_record_date` (record_date),
    INDEX `idx_growth_pest_level` (pest_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 生产报表（用户端「数据分析 → 生产报表」的列表与导出）。
--
-- 【口径】`POST /analytics/reports` 是**即时聚合落库快照**，不是异步任务：按「类型 + 周期」当场从
-- 已有表（任务 / 采收 / 投入品 / 检测 / 告警）聚合出一份摘要写进本表，status 落库即 2（已完成）。
-- 页面上的"生成中"状态因此不会长时间停留 —— 与其做一个"永远转圈"的假异步，不如让数据立刻可用。
--
-- 【列为什么这样定】方案文档给的是 report_id/report_name/report_type/period_start/period_end/status/
-- file_url/generated_at/generated_by/remark，这里在其之上补了页面契约与实现必需的四列：
--   · period        —— 页面 ReportItem.period 是**周期标签**（如 2026-03），生成入参也只给一个日期，
--                      period_start/period_end 由服务端按类型推导；两个都留，既能按标签展示也能按区间聚合；
--   · summary_json  —— 聚合快照本体（页面只读元数据，快照用于导出与追溯"当时算出来是什么"）；
--   · file_size     —— 页面要显示文件大小；由导出接口落盘后回填（未导出前为空）；
--   · download_key  —— 导出文件要能被 window.open 打开，而 window.open **带不了 Authorization 头**，
--                      所以用一次性下载令牌而不是把会话令牌拼进 URL（后者会进浏览器历史与访问日志）。
CREATE TABLE IF NOT EXISTS agri_prod_report (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
report_id VARCHAR(32) NOT NULL COMMENT '报表编号（业务主键，页面 reportId）',
report_name VARCHAR(120) NOT NULL COMMENT '报表名称',
report_type TINYINT NOT NULL COMMENT '1 日报 / 2 周报 / 3 月报 / 4 季报 / 5 年报',
period VARCHAR(32) NOT NULL COMMENT '周期标签（日报 yyyy-MM-dd / 周报 yyyy-Www / 月报 yyyy-MM / 季报 yyyy-Qn / 年报 yyyy）',
period_start DATE COMMENT '统计区间起（含）',
period_end DATE COMMENT '统计区间止（含）',
status TINYINT DEFAULT 2 COMMENT '1 生成中 / 2 已完成 / 3 失败',
summary_json MEDIUMTEXT COMMENT '聚合快照（JSON）',
file_url VARCHAR(255) COMMENT '导出地址（指向本服务的 /file 端点，带下载令牌）',
file_size BIGINT COMMENT '导出文件字节数（未导出时为空）',
download_key VARCHAR(64) COMMENT '导出下载令牌（window.open 无法带 Authorization 头，故用独立令牌）',
generated_at DATETIME COMMENT '生成时间',
generated_by VARCHAR(64) COMMENT '生成人（本服务拿不到平台用户档案，暂留空）',
remark VARCHAR(500) COMMENT '备注',
farm_id BIGINT COMMENT '所属农场（本服务农场主键，可空表示不限农场）',
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    UNIQUE KEY `uk_report_report_id` (report_id),
    INDEX `idx_report_tenant_id` (tenant_id),
    INDEX `idx_report_type` (report_type),
    INDEX `idx_report_period` (period),
    INDEX `idx_report_generated_at` (generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 报表订阅（用户端「数据分析 → 生产报表」的订阅卡片）。
--
-- 【列名与方案文档的差异，写在最前面免得下一个人以为是笔误】
-- 方案文档写的是 frequency(WEEKLY/MONTHLY) / receiver（单数）。页面契约不是这样：
--   入参 period ∈ {daily, weekly, monthly, quarterly}，receivers 是**数组**（可填多个接收人）。
-- 按文档那两个名字建列会立刻产生两处静默失真：daily/quarterly 无处安放、多个接收人只存得下第一个。
-- 所以这里 period / receivers 按页面契约建列，channels 存 JSON 数组。
--
-- 【不写真投递】本部署没有任何消息通道（邮件/短信/微信都没接）。POST /reports/subscribe 只落一行，
-- 响应里显式带 delivery = "not-configured"，last_pushed_at 永远为空 ——
-- 让"订阅了但永远收不到"这件事在接口层就看得见，而不是让页面以为已经生效。
CREATE TABLE IF NOT EXISTS agri_prod_report_subscription (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
subscribe_id VARCHAR(32) NOT NULL COMMENT '订阅编号（业务主键）',
report_type TINYINT COMMENT '报表类型 1~5',
period VARCHAR(16) COMMENT '订阅周期：daily / weekly / monthly / quarterly',
channels VARCHAR(64) COMMENT '接收渠道（JSON 数组，1 站内 2 邮件 3 微信）',
receivers VARCHAR(500) COMMENT '接收人（JSON 数组，可多个）',
status TINYINT DEFAULT 1 COMMENT '1 启用 0 停用',
last_pushed_at DATETIME COMMENT '最近推送时间（本部署不推送，恒为空）',
farm_id BIGINT COMMENT '所属农场（本服务农场主键）',
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    UNIQUE KEY `uk_report_subscribe_id` (subscribe_id),
    INDEX `idx_report_sub_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IoT 设备绑定关系（用户端「IoT 设备管理 → 设备绑定」）。
--
-- 【口径】列按**页面契约**建（对齐 @agri/shared/types/iot.ts 的 IotBinding）：
-- binding_id / device_id / device_code / device_name / bind_type / bind_target_id / bind_target_name /
-- metrics / frequency / status / bound_at，外加 unbound_at（页面不显示，但"解绑了什么时间"是运维事实）。
-- 方案文档写的是「device_id ↔ plot_id，含绑定时间/解绑时间/状态」—— 那是这个契约在"只绑地块"时的特例；
-- 页面的 bindType 有 PLOT / GREENHOUSE / FARM 三种，只建 plot_id 会让大棚/农场绑定无处安放。
--
-- 【为什么 device_code / device_name / bind_target_name 冗余落列】
-- 与平台侧的 prod_iot_binding 同法：绑定列表要显示设备名与对象名，而设备/地块主数据在本服务与平台侧
-- 尚未收敛（见 docs/生产管理模块_剩余缺口处置方案_2026-10-16.md 第六节），逐行回查会查不到、
-- 显示成一串标识。冗余列在绑定时落库，之后即使主数据改名也不影响历史行。
--
-- 【metrics / frequency 的类型】metrics 存逗号分隔字符串（页面既发逗号串也给数组，服务端统一存串、
-- 出参转数组）；frequency 是采集频率（分钟），未设置时为 NULL —— 不默认填 30：那是编出来的采集周期。
CREATE TABLE IF NOT EXISTS agri_prod_iot_binding (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
binding_id VARCHAR(32) NOT NULL COMMENT '绑定编号（业务主键，页面 bindingId）',
device_id VARCHAR(64) NOT NULL COMMENT '设备标识（页面口径；本服务设备主键或设备编码）',
device_code VARCHAR(64) COMMENT '设备编码（冗余）',
device_name VARCHAR(191) COMMENT '设备名称（冗余）',
bind_type VARCHAR(16) NOT NULL COMMENT '绑定对象类型：PLOT 地块 / GREENHOUSE 大棚 / FARM 农场',
bind_target_id VARCHAR(64) COMMENT '绑定对象标识（地块/大棚/农场）',
bind_target_name VARCHAR(191) COMMENT '绑定对象名称（冗余）',
metrics VARCHAR(500) COMMENT '采集指标（逗号分隔；出参转数组）',
frequency INT COMMENT '采集频率（分钟），未设置为空',
status VARCHAR(16) NOT NULL DEFAULT 'BOUND' COMMENT 'BOUND 已绑定 / UNBOUND 已解绑 / PAUSED 已暂停',
bound_at DATETIME COMMENT '绑定时间',
unbound_at DATETIME COMMENT '解绑时间（解绑时写入）',
remark VARCHAR(500) COMMENT '备注',
farm_id BIGINT COMMENT '所属农场（本服务农场主键）',
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    UNIQUE KEY `uk_binding_binding_id` (binding_id),
    INDEX `idx_binding_tenant_id` (tenant_id),
    INDEX `idx_binding_device_id` (device_id),
    INDEX `idx_binding_target` (bind_type, bind_target_id),
    INDEX `idx_binding_status` (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IoT 指令记录（用户端「设备详情 → 指令下发」）。
--
-- 【关键口径：本部署没有下发通道，指令只记录不真下发】
-- 平台侧的实现会"按设备在线状态判终态"（在线→SUCCESS、离线→FAILED）。本服务**不这么做**：
-- 没有真实通道却写 SUCCESS，等于告诉使用者"指令已送达"——那是编出来的执行结果。
-- 这里统一落 status=ISSUED（页面按 status 渲染 Tag 时会显示原样文案），回执里写明未送达，
-- 响应体另带 delivery="record-only"。等接入真实下发通道时，再由通道回执把状态推进到 SUCCESS/FAILED。
CREATE TABLE IF NOT EXISTS agri_prod_iot_command (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
command_id VARCHAR(32) NOT NULL COMMENT '指令编号（业务主键，页面 commandId）',
device_id VARCHAR(64) NOT NULL COMMENT '设备标识（页面口径）',
device_code VARCHAR(64) COMMENT '设备编码（冗余）',
command_type VARCHAR(64) NOT NULL COMMENT '指令类型（如 VALVE_SWITCH / REBOOT / READING）',
params VARCHAR(1000) COMMENT '指令参数（JSON 文本）',
operator VARCHAR(64) COMMENT '操作人',
status VARCHAR(20) NOT NULL DEFAULT 'ISSUED' COMMENT 'ISSUED 已记录（本部署无下发通道）/ 通道接入后为 PENDING|SUCCESS|FAILED',
receipt VARCHAR(500) COMMENT '回执说明',
send_at DATETIME COMMENT '下发（记录）时间',
receipt_at DATETIME COMMENT '回执时间（本部署恒为空）',
farm_id BIGINT COMMENT '所属农场（本服务农场主键）',
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    UNIQUE KEY `uk_command_command_id` (command_id),
    INDEX `idx_command_tenant_id` (tenant_id),
    INDEX `idx_command_device_id` (device_id),
    INDEX `idx_command_send_at` (send_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IoT 设备维修/保养记录（用户端「设备详情 → 维修记录」）。
--
-- 列按页面契约（IotMaintenance）：maintain_id / device_id / device_code / maintain_type / content /
-- operator / maintain_at / result；另补 next_maintain_at（方案文档要求的"下次保养日期"，
-- 当前页面没有这个字段，先落列不落值 —— 需要页面配合才能录入）。
CREATE TABLE IF NOT EXISTS agri_prod_iot_maintenance (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
maintain_id VARCHAR(32) NOT NULL COMMENT '维修记录编号（业务主键）',
device_id VARCHAR(64) NOT NULL COMMENT '设备标识（页面口径）',
device_code VARCHAR(64) COMMENT '设备编码（冗余）',
maintain_type VARCHAR(32) COMMENT 'INSPECT 巡检 / REPAIR 维修 / REPLACE 更换 / CALIBRATE 校准 / UPGRADE 升级',
content VARCHAR(1000) COMMENT '维修/保养内容',
operator VARCHAR(64) COMMENT '操作人',
maintain_at DATETIME COMMENT '维修时间',
result VARCHAR(500) COMMENT '维修结果',
next_maintain_at DATETIME COMMENT '下次保养日期（页面暂无此字段，预留给保养计划）',
farm_id BIGINT COMMENT '所属农场（本服务农场主键）',
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
deleted BIGINT DEFAULT 0,
    UNIQUE KEY `uk_maintain_maintain_id` (maintain_id),
    INDEX `idx_maintain_tenant_id` (tenant_id),
    INDEX `idx_maintain_device_id` (device_id),
    INDEX `idx_maintain_at` (maintain_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
