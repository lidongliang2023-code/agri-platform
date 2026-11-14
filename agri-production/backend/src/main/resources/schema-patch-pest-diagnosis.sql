CREATE TABLE IF NOT EXISTS agri_prod_pest_case (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 tenant_id VARCHAR(64) NOT NULL,
 farm_id BIGINT NOT NULL,
 plot_id BIGINT NOT NULL,
 plot_name VARCHAR(200) NOT NULL,
 crop_name VARCHAR(100) NOT NULL,
 request_id VARCHAR(64) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 status VARCHAR(32) NOT NULL,
 attempt_id VARCHAR(36) NOT NULL,
 input_json LONGTEXT NOT NULL,
 result_json LONGTEXT NULL,
 review_json TEXT NULL,
 feedback_json LONGTEXT NULL,
 task_id BIGINT NULL,
 failure_message VARCHAR(500) NULL,
 created_by VARCHAR(100) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 UNIQUE KEY uk_pest_request (tenant_id,request_id),
 KEY idx_pest_scope (tenant_id,farm_id,created_at),
 KEY idx_pest_plot (tenant_id,plot_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agri_prod_pest_event (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 case_id VARCHAR(36) NOT NULL,
 tenant_id VARCHAR(64) NOT NULL,
 event_type VARCHAR(32) NOT NULL,
 payload_json LONGTEXT NOT NULL,
 created_at DATETIME(3) NOT NULL,
 KEY idx_pest_event_case (tenant_id,case_id,created_at),
 CONSTRAINT fk_pest_event_case FOREIGN KEY (case_id) REFERENCES agri_prod_pest_case(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
