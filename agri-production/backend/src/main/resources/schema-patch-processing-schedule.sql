CREATE TABLE IF NOT EXISTS agri_prod_schedule_mutex (tenant_id VARCHAR(191) PRIMARY KEY) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS agri_prod_schedule_config (
 tenant_id VARCHAR(191) PRIMARY KEY, version INT NOT NULL, payload_json LONGTEXT NOT NULL,
 updated_by VARCHAR(191) NOT NULL, updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS agri_prod_schedule_plan (
 id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(191) NOT NULL, plan_no VARCHAR(80) NOT NULL,
 config_version INT NOT NULL, parent_id VARCHAR(36), status VARCHAR(32) NOT NULL,
 input_json LONGTEXT NOT NULL, result_json LONGTEXT NOT NULL, lock_until DATETIME,
 approval_required TINYINT NOT NULL DEFAULT 0, approved_by VARCHAR(191), approved_at DATETIME,
 reason VARCHAR(1000), created_by VARCHAR(191) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
 KEY idx_sched_plan(tenant_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS agri_prod_schedule_work (
 id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(191) NOT NULL, plan_id VARCHAR(36) NOT NULL,
 job_key VARCHAR(80) NOT NULL, order_id VARCHAR(64) NOT NULL, item_id VARCHAR(64) NOT NULL,
 batch_id BIGINT NOT NULL, resource_id VARCHAR(80) NOT NULL, operation VARCHAR(32) NOT NULL,
 quantity_kg DECIMAL(18,3) NOT NULL, setup_start DATETIME NOT NULL, starts_at DATETIME NOT NULL, ends_at DATETIME NOT NULL,
 setup_minutes INT NOT NULL, status VARCHAR(32) NOT NULL, process_record_id BIGINT,
 snapshot_json LONGTEXT NOT NULL, updated_at DATETIME NOT NULL,
 UNIQUE KEY uk_sched_process(tenant_id,process_record_id),
 KEY idx_sched_resource(tenant_id,resource_id,status,setup_start,ends_at),KEY idx_sched_plan_work(tenant_id,plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS agri_prod_schedule_event (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,tenant_id VARCHAR(191) NOT NULL,plan_id VARCHAR(36) NOT NULL,
 event_type VARCHAR(40) NOT NULL,payload_json LONGTEXT NOT NULL,operator VARCHAR(191) NOT NULL,created_at DATETIME NOT NULL,
 KEY idx_sched_event(tenant_id,plan_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS agri_prod_schedule_outsource (
 id VARCHAR(36) PRIMARY KEY,tenant_id VARCHAR(191) NOT NULL,plan_id VARCHAR(36) NOT NULL,job_key VARCHAR(80) NOT NULL,
 order_id VARCHAR(64) NOT NULL,item_id VARCHAR(64) NOT NULL,batch_id BIGINT NOT NULL,
 provider_json LONGTEXT NOT NULL,quantity_kg DECIMAL(18,3) NOT NULL,cost DECIMAL(18,2) NOT NULL,
 status VARCHAR(32) NOT NULL,receipt_json LONGTEXT,updated_at DATETIME NOT NULL,
 UNIQUE KEY uk_sched_outsource(tenant_id,plan_id,job_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
