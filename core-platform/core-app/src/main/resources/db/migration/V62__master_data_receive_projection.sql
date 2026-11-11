-- 主数据接收批次幂等与租户映射
-- 主数据中心仍是权威源；核心平台只落本域投影，不复制 agri_md_* 表。
CREATE TABLE IF NOT EXISTS platform_master_data_tenant_mapping (
    id BIGINT NOT NULL PRIMARY KEY,
    tenant_code VARCHAR(64) NOT NULL,
    core_tenant_id BIGINT NOT NULL,
    status TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_md_tenant_code (tenant_code),
    KEY idx_md_core_tenant (core_tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='主数据租户编码到核心租户ID映射';

CREATE TABLE IF NOT EXISTS platform_master_data_receipt (
    id BIGINT NOT NULL PRIMARY KEY,
    receipt_id VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(64) NOT NULL,
    source_task_id VARCHAR(64) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    tenant_code VARCHAR(64) NOT NULL,
    core_tenant_id BIGINT NOT NULL,
    accepted_count INT NOT NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_md_receipt_idempotency (idempotency_key),
    UNIQUE KEY uk_md_receipt_id (receipt_id),
    KEY idx_md_receipt_task (source_task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='主数据分发接收回执（幂等）';

-- 本地开发环境已有核心租户为 0；生产环境应由部署初始化脚本替换为正式映射。
INSERT IGNORE INTO platform_master_data_tenant_mapping
    (id, tenant_code, core_tenant_id, status)
VALUES (620000000000001, 'TENANT001', 0, 1);
INSERT IGNORE INTO platform_master_data_tenant_mapping
    (id, tenant_code, core_tenant_id, status)
VALUES (620000000000002, '0', 0, 1);
INSERT IGNORE INTO platform_master_data_tenant_mapping
    (id, tenant_code, core_tenant_id, status)
VALUES (620000000000003, '1', 1, 1);
