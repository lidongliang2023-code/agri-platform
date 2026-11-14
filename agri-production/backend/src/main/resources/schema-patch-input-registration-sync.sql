-- 农药登记数据同步：官方原始批次、标准化明细和应用留痕。
-- 同步只产生 DRAFT 规则；启用仍由主体所有者按有效标签人工审核。
CREATE TABLE IF NOT EXISTS agri_prod_input_registration_sync_batch (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    source_name VARCHAR(191) NOT NULL,
    source_url VARCHAR(1000) NOT NULL,
    source_published_at DATE NULL,
    source_checksum VARCHAR(128) NOT NULL,
    status VARCHAR(24) NOT NULL COMMENT 'RUNNING/SUCCEEDED/FAILED',
    total_rows INT NOT NULL DEFAULT 0,
    parsed_rows INT NOT NULL DEFAULT 0,
    imported_rows INT NOT NULL DEFAULT 0,
    skipped_rows INT NOT NULL DEFAULT 0,
    error_message VARCHAR(2000) NULL,
    started_at DATETIME NOT NULL,
    finished_at DATETIME NULL,
    created_by VARCHAR(191) NOT NULL,
    UNIQUE KEY uk_registration_sync_batch(tenant_id,source_checksum),
    KEY idx_registration_sync_batch(tenant_id,started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_input_registration_raw (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    batch_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(191) NOT NULL,
    registration_no VARCHAR(191) NOT NULL,
    holder_name VARCHAR(255) NULL,
    input_name VARCHAR(191) NOT NULL,
    formulation VARCHAR(191) NULL,
    toxicity VARCHAR(64) NULL,
    ingredients VARCHAR(500) NULL,
    category VARCHAR(100) NULL,
    crop_name VARCHAR(191) NULL,
    target_name VARCHAR(255) NULL,
    standard_no VARCHAR(191) NULL,
    source_json LONGTEXT NOT NULL,
    parse_status VARCHAR(24) NOT NULL COMMENT 'PARSED/SKIPPED/NEEDS_LABEL',
    parse_message VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uk_registration_raw(batch_id,registration_no,input_name,crop_name,target_name(128)), 
    KEY idx_registration_raw(tenant_id,registration_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_input_registration_apply_log (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    batch_id VARCHAR(36) NOT NULL,
    raw_id BIGINT NOT NULL,
    rule_id BIGINT NULL,
    action VARCHAR(32) NOT NULL COMMENT 'CREATED/UPDATED/SKIPPED/NEEDS_REVIEW',
    reason VARCHAR(1000) NULL,
    operator VARCHAR(191) NOT NULL,
    created_at DATETIME NOT NULL,
    KEY idx_registration_apply(tenant_id,batch_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
