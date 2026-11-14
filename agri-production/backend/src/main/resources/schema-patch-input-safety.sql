-- 投入品推荐与用药安全校验：规则域独立于投入品库存、使用台账和病虫害诊断。
-- 规则是可版本化依据；推荐结果保存不可变快照，实际使用仍由 input_usage 业务域维护。
CREATE TABLE IF NOT EXISTS agri_prod_input_safety_rule (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    input_id BIGINT NULL,
    input_name VARCHAR(191) NOT NULL,
    crop_name VARCHAR(100) NOT NULL,
    target_name VARCHAR(191) NOT NULL,
    registration_no VARCHAR(191) NULL,
    dosage_min DECIMAL(18,4) NULL,
    dosage_max DECIMAL(18,4) NULL,
    dosage_unit VARCHAR(64) NULL,
    application_method VARCHAR(64) NULL,
    safety_interval_days INT NULL,
    rotation_group VARCHAR(100) NULL,
    source VARCHAR(500) NOT NULL,
    source_version VARCHAR(100) NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    created_by VARCHAR(191) NOT NULL DEFAULT 'system',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_input_safety_rule(tenant_id,input_id,crop_name,target_name(128),source_version),
    KEY idx_input_safety_scope(tenant_id,crop_name,target_name,status),
    KEY idx_input_safety_input(tenant_id,input_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_input_restriction (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    input_id BIGINT NULL,
    input_name VARCHAR(191) NULL,
    restriction_type VARCHAR(32) NOT NULL COMMENT 'FORBIDDEN / RESTRICTED',
    reason VARCHAR(500) NOT NULL,
    source VARCHAR(500) NOT NULL,
    effective_date DATE NULL,
    expires_at DATE NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_input_restriction(tenant_id,input_id,input_name,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_input_compatibility (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    input_id BIGINT NOT NULL,
    other_input_id BIGINT NULL,
    other_input_name VARCHAR(191) NULL,
    reason VARCHAR(500) NOT NULL,
    alternative VARCHAR(500) NULL,
    source VARCHAR(500) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_input_compatibility(tenant_id,input_id,other_input_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_input_recommendation (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    crop_name VARCHAR(100) NOT NULL,
    target_name VARCHAR(191) NOT NULL,
    application_date DATE NULL,
    harvest_date DATE NULL,
    request_json LONGTEXT NOT NULL,
    result_json LONGTEXT NOT NULL,
    state VARCHAR(24) NOT NULL COMMENT 'PASSED / BLOCKED / REJECTED / NEEDS_REVIEW',
    created_by VARCHAR(191) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_input_recommendation_request(tenant_id,request_id),
    KEY idx_input_recommendation_scope(tenant_id,crop_name,target_name,created_at),
    KEY idx_input_recommendation_state(tenant_id,state,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_input_recommendation_event (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    recommendation_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(40) NOT NULL COMMENT 'CHECK / ACTUAL_USAGE_COMPARE / EXPORT',
    payload_json LONGTEXT NOT NULL,
    operator VARCHAR(191) NOT NULL,
    created_at DATETIME NOT NULL,
    KEY idx_input_recommendation_event(tenant_id,recommendation_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 安全证据元数据由 Schema 按列幂等升级；不启用任何演示处方。
UPDATE agri_prod_input_safety_rule SET status='DRAFT' WHERE source_version LIKE 'DEMO-%' AND status='ACTIVE';
CREATE TABLE IF NOT EXISTS agri_prod_input_safety_revision (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(191) NOT NULL,
 kind VARCHAR(32) NOT NULL, rule_id BIGINT NOT NULL, payload_json LONGTEXT NOT NULL,
 operator VARCHAR(191) NOT NULL, created_at DATETIME NOT NULL,
 KEY idx_safety_revision(tenant_id,kind,rule_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS agri_prod_input_safety_risk (
 id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(191) NOT NULL,
 recommendation_id VARCHAR(36) NOT NULL, usage_id BIGINT NOT NULL,
 state VARCHAR(24) NOT NULL, payload_json LONGTEXT NOT NULL,
 review_note VARCHAR(2000), reviewed_by VARCHAR(191), reviewed_at DATETIME,
 created_at DATETIME NOT NULL,
 UNIQUE KEY uk_safety_risk(tenant_id,recommendation_id,usage_id),
 KEY idx_safety_risk(tenant_id,state,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
