-- 采收窗口决策与用工协同排程（生产域专用）
-- 职责边界：不替代采收批次库存、通用农事日历、加工排产。
CREATE TABLE IF NOT EXISTS agri_prod_harvest_window_plan (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NOT NULL,
 plan_no VARCHAR(64) NOT NULL,
 status VARCHAR(20) NOT NULL,
 version INT NOT NULL DEFAULT 1,
 window_start DATE NOT NULL,
 window_end DATE NOT NULL,
 input_json LONGTEXT NOT NULL,
 result_json LONGTEXT NOT NULL,
 metrics_json LONGTEXT NOT NULL,
 approved_by VARCHAR(191),
 approved_at DATETIME,
 created_by VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 UNIQUE KEY uk_harvest_window_plan_no(tenant_id,plan_no),
 KEY idx_harvest_window_plan(tenant_id,farm_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_harvest_window_dispatch (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NOT NULL,
 plan_id VARCHAR(36) NOT NULL,
 plot_id BIGINT,
 plot_name VARCHAR(191) NOT NULL,
 dispatch_date DATE NOT NULL,
 area DECIMAL(12,2) NOT NULL,
 people INT NOT NULL,
 assigned_people INT NOT NULL DEFAULT 0,
 unassigned_people INT NOT NULL DEFAULT 0,
 machines INT NOT NULL DEFAULT 0,
 trucks INT NOT NULL DEFAULT 0,
 labor_source VARCHAR(64) NOT NULL,
 team_name VARCHAR(128),
 shift_start TIME,
 shift_end TIME,
 planned_hours DECIMAL(5,2) NOT NULL DEFAULT 8.00,
 actual_people INT NOT NULL DEFAULT 0,
 actual_hours DECIMAL(7,2) NOT NULL DEFAULT 0,
 status VARCHAR(20) NOT NULL,
 actual_area DECIMAL(12,2) NOT NULL DEFAULT 0,
 note TEXT,
 created_by VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 KEY idx_harvest_window_dispatch(tenant_id,plan_id,dispatch_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 兼容标准 MySQL：通过元数据判断字段是否存在，可重复执行。
SET @hw_column_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_harvest_window_dispatch' AND COLUMN_NAME='assigned_people'), 'SELECT 1', 'ALTER TABLE agri_prod_harvest_window_dispatch ADD COLUMN assigned_people INT NOT NULL DEFAULT 0 AFTER people');
PREPARE hw_column_stmt FROM @hw_column_sql;
EXECUTE hw_column_stmt;
DEALLOCATE PREPARE hw_column_stmt;
SET @hw_column_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_harvest_window_dispatch' AND COLUMN_NAME='unassigned_people'), 'SELECT 1', 'ALTER TABLE agri_prod_harvest_window_dispatch ADD COLUMN unassigned_people INT NOT NULL DEFAULT 0 AFTER assigned_people');
PREPARE hw_column_stmt FROM @hw_column_sql;
EXECUTE hw_column_stmt;
DEALLOCATE PREPARE hw_column_stmt;
SET @hw_column_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_harvest_window_dispatch' AND COLUMN_NAME='team_name'), 'SELECT 1', 'ALTER TABLE agri_prod_harvest_window_dispatch ADD COLUMN team_name VARCHAR(128) AFTER labor_source');
PREPARE hw_column_stmt FROM @hw_column_sql;
EXECUTE hw_column_stmt;
DEALLOCATE PREPARE hw_column_stmt;
SET @hw_column_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_harvest_window_dispatch' AND COLUMN_NAME='shift_start'), 'SELECT 1', 'ALTER TABLE agri_prod_harvest_window_dispatch ADD COLUMN shift_start TIME AFTER team_name');
PREPARE hw_column_stmt FROM @hw_column_sql;
EXECUTE hw_column_stmt;
DEALLOCATE PREPARE hw_column_stmt;
SET @hw_column_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_harvest_window_dispatch' AND COLUMN_NAME='shift_end'), 'SELECT 1', 'ALTER TABLE agri_prod_harvest_window_dispatch ADD COLUMN shift_end TIME AFTER shift_start');
PREPARE hw_column_stmt FROM @hw_column_sql;
EXECUTE hw_column_stmt;
DEALLOCATE PREPARE hw_column_stmt;
SET @hw_column_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_harvest_window_dispatch' AND COLUMN_NAME='planned_hours'), 'SELECT 1', 'ALTER TABLE agri_prod_harvest_window_dispatch ADD COLUMN planned_hours DECIMAL(5,2) NOT NULL DEFAULT 8.00 AFTER shift_end');
PREPARE hw_column_stmt FROM @hw_column_sql;
EXECUTE hw_column_stmt;
DEALLOCATE PREPARE hw_column_stmt;
SET @hw_column_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_harvest_window_dispatch' AND COLUMN_NAME='actual_people'), 'SELECT 1', 'ALTER TABLE agri_prod_harvest_window_dispatch ADD COLUMN actual_people INT NOT NULL DEFAULT 0 AFTER planned_hours');
PREPARE hw_column_stmt FROM @hw_column_sql;
EXECUTE hw_column_stmt;
DEALLOCATE PREPARE hw_column_stmt;
SET @hw_column_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_harvest_window_dispatch' AND COLUMN_NAME='actual_hours'), 'SELECT 1', 'ALTER TABLE agri_prod_harvest_window_dispatch ADD COLUMN actual_hours DECIMAL(7,2) NOT NULL DEFAULT 0 AFTER actual_people');
PREPARE hw_column_stmt FROM @hw_column_sql;
EXECUTE hw_column_stmt;
DEALLOCATE PREPARE hw_column_stmt;

CREATE TABLE IF NOT EXISTS agri_prod_harvest_window_dispatch_worker (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NOT NULL,
 plan_id VARCHAR(36) NOT NULL,
 dispatch_id VARCHAR(36) NOT NULL,
 worker_id VARCHAR(36) NOT NULL,
 worker_no VARCHAR(64) NOT NULL,
 worker_name VARCHAR(64) NOT NULL,
 source_type VARCHAR(32) NOT NULL,
 skill_type VARCHAR(32) NOT NULL,
 planned_hours DECIMAL(5,2) NOT NULL DEFAULT 8.00,
 actual_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
 attendance_status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
 actual_area DECIMAL(12,2) NOT NULL DEFAULT 0,
 note VARCHAR(500),
 created_by VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 UNIQUE KEY uk_harvest_dispatch_worker(dispatch_id,worker_id),
 KEY idx_harvest_dispatch_worker(tenant_id,plan_id,dispatch_id),
 KEY idx_harvest_dispatch_worker_person(tenant_id,farm_id,worker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='采收派单人员明细';

CREATE TABLE IF NOT EXISTS agri_prod_harvest_window_event (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NOT NULL,
 plan_id VARCHAR(36) NOT NULL,
 event_type VARCHAR(40) NOT NULL,
 payload_json LONGTEXT NOT NULL,
 operator VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 KEY idx_harvest_window_event(tenant_id,plan_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 采收派单农机明细：记录本次采收计划使用的设备快照，不维护通用设备资产台账。
CREATE TABLE IF NOT EXISTS agri_prod_harvest_window_dispatch_machine (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NOT NULL,
 plan_id VARCHAR(36) NOT NULL,
 dispatch_id VARCHAR(36) NOT NULL,
 machine_type VARCHAR(20) NOT NULL,
 machine_no VARCHAR(64) NOT NULL,
 machine_name VARCHAR(128) NOT NULL,
 operator_worker_id VARCHAR(36),
 operator_worker_no VARCHAR(64),
 operator_worker_name VARCHAR(64),
 planned_hours DECIMAL(5,2) NOT NULL DEFAULT 8.00,
 actual_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
 planned_area DECIMAL(12,2) NOT NULL DEFAULT 0,
 actual_area DECIMAL(12,2) NOT NULL DEFAULT 0,
 status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
 note VARCHAR(500),
 created_by VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 UNIQUE KEY uk_harvest_dispatch_machine(dispatch_id,machine_no),
 KEY idx_harvest_dispatch_machine(tenant_id,plan_id,dispatch_id),
 KEY idx_harvest_dispatch_machine_operator(tenant_id,farm_id,operator_worker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='采收派单农机明细';

-- 采收派单故障处置单：仅记录停机、恢复及换机，不承担设备维修台账职责。
CREATE TABLE IF NOT EXISTS agri_prod_harvest_window_machine_fault (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NOT NULL,
 plan_id VARCHAR(36) NOT NULL,
 dispatch_id VARCHAR(36) NOT NULL,
 machine_id VARCHAR(36) NOT NULL,
 machine_no VARCHAR(64) NOT NULL,
 machine_name VARCHAR(128) NOT NULL,
 severity VARCHAR(20) NOT NULL,
 description VARCHAR(500) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
 reported_by VARCHAR(191) NOT NULL,
 reported_at DATETIME NOT NULL,
 resolved_by VARCHAR(191),
 resolved_at DATETIME,
 resolution VARCHAR(500),
 replacement_machine_id VARCHAR(36),
 replacement_machine_no VARCHAR(64),
 KEY idx_hw_fault_dispatch(tenant_id,plan_id,dispatch_id),
 KEY idx_hw_fault_machine(tenant_id,machine_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='采收农机故障处置记录';

-- 故障影响重排确认快照；一张故障单只允许应用一次。
CREATE TABLE IF NOT EXISTS agri_prod_harvest_window_reschedule (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NOT NULL,
 plan_id VARCHAR(36) NOT NULL,
 fault_id VARCHAR(36) NOT NULL,
 base_version INT NOT NULL,
 new_version INT NOT NULL,
 ready_date DATE NOT NULL,
 reason VARCHAR(500) NOT NULL,
 snapshot_json LONGTEXT NOT NULL,
 confirmed_by VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 UNIQUE KEY uk_hw_reschedule_fault(tenant_id,plan_id,fault_id),
 KEY idx_hw_reschedule_plan(tenant_id,plan_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='故障影响重排确认记录';


-- 窗口外兜底扩展：记录采用的兜底方式、状态和负责人选择的目标日期。
SET @hw_column_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_harvest_window_reschedule' AND COLUMN_NAME='fallback_mode'), 'SELECT 1', 'ALTER TABLE agri_prod_harvest_window_reschedule ADD COLUMN fallback_mode VARCHAR(32) NOT NULL DEFAULT ''WINDOW_CONTINUATION'' AFTER ready_date');
PREPARE hw_column_stmt FROM @hw_column_sql;
EXECUTE hw_column_stmt;
DEALLOCATE PREPARE hw_column_stmt;
SET @hw_column_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_harvest_window_reschedule' AND COLUMN_NAME='fallback_status'), 'SELECT 1', 'ALTER TABLE agri_prod_harvest_window_reschedule ADD COLUMN fallback_status VARCHAR(40) NOT NULL DEFAULT ''WINDOW_CONTINUATION'' AFTER fallback_mode');
PREPARE hw_column_stmt FROM @hw_column_sql;
EXECUTE hw_column_stmt;
DEALLOCATE PREPARE hw_column_stmt;
SET @hw_column_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_harvest_window_reschedule' AND COLUMN_NAME='fallback_date'), 'SELECT 1', 'ALTER TABLE agri_prod_harvest_window_reschedule ADD COLUMN fallback_date DATE NULL AFTER fallback_status');
PREPARE hw_column_stmt FROM @hw_column_sql;
EXECUTE hw_column_stmt;
DEALLOCATE PREPARE hw_column_stmt;

-- 风险批量重排复用确认快照，非故障重排没有故障单；不创建第二份审批台账。
ALTER TABLE agri_prod_harvest_window_reschedule MODIFY COLUMN fault_id VARCHAR(36) NULL;
