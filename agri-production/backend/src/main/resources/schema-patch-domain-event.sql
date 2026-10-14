-- 补丁：领域事件 outbox 表（可重复执行）。
-- 口径见 schema-mysql.sql 末尾同名段落。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-domain-event.sql

CREATE TABLE IF NOT EXISTS agri_prod_domain_event (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(191) NOT NULL,
    event_key VARCHAR(191),
    payload TEXT,
    status VARCHAR(32) DEFAULT 'NEW',
    occurred_at DATETIME,
    sent_at DATETIME,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_domain_event_type` (event_type),
    INDEX `idx_domain_event_status` (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;