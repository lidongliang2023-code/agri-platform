CREATE TABLE IF NOT EXISTS agri_prod_process_optimization (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 batch_id BIGINT NULL,
 batch_no VARCHAR(128) NOT NULL,
 category VARCHAR(128) NOT NULL,
 grade VARCHAR(64) NULL,
 moisture DECIMAL(8,3) NOT NULL,
 uniformity DECIMAL(8,3) NOT NULL,
 input_quantity DECIMAL(18,3) NOT NULL,
 input_unit VARCHAR(16) NOT NULL,
 rain_affected TINYINT NOT NULL DEFAULT 0,
 equipment_snapshot_json LONGTEXT NOT NULL,
 input_json LONGTEXT NOT NULL,
 recommendation_json LONGTEXT NOT NULL,
 status VARCHAR(32) NOT NULL,
 source_version VARCHAR(64) NOT NULL,
 confirmed_by VARCHAR(191) NULL,
 confirmed_at DATETIME NULL,
 dispatched_at DATETIME NULL,
 created_by VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 KEY idx_process_opt_tenant_batch (tenant_id,batch_no,created_at),
 KEY idx_process_opt_status (tenant_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_process_optimization_event (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 optimization_id VARCHAR(36) NOT NULL,
 tenant_id VARCHAR(191) NOT NULL,
 event_type VARCHAR(40) NOT NULL,
 payload_json LONGTEXT NOT NULL,
 operator VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 KEY idx_process_opt_event (tenant_id,optimization_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_process_optimization_deviation (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 optimization_id VARCHAR(36) NOT NULL,
 tenant_id VARCHAR(191) NOT NULL,
 metric VARCHAR(64) NOT NULL,
 target_value VARCHAR(64) NULL,
 actual_value VARCHAR(64) NULL,
 action VARCHAR(255) NOT NULL,
 operator VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 KEY idx_process_opt_deviation (tenant_id,optimization_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_process_optimization_result (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 optimization_id VARCHAR(36) NOT NULL,
 tenant_id VARCHAR(191) NOT NULL,
 final_moisture DECIMAL(8,3) NULL,
 broken_rate DECIMAL(8,3) NULL,
 color_score DECIMAL(8,3) NULL,
 final_grade VARCHAR(64) NULL,
 note VARCHAR(500) NULL,
 operator VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 KEY idx_process_opt_result (tenant_id,optimization_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
