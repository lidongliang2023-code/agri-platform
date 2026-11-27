-- 告警复盘追加式历史：复盘不改变原告警处置状态。
CREATE TABLE IF NOT EXISTS agri_prod_alert_review (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 alert_id BIGINT NOT NULL,
 revision INT NOT NULL,
 request_id VARCHAR(64) NOT NULL,
 review_status VARCHAR(24) NOT NULL,
 root_cause VARCHAR(1000) NOT NULL,
 effectiveness VARCHAR(1000) NOT NULL,
 prevention VARCHAR(1000) NOT NULL,
 evidence VARCHAR(1000) NOT NULL,
 follow_up_owner VARCHAR(100) NULL,
 follow_up_date DATE NULL,
 reviewer_id VARCHAR(191) NOT NULL,
 reviewed_at DATETIME NOT NULL,
 alert_snapshot LONGTEXT NOT NULL,
 UNIQUE KEY uk_alert_review_revision (tenant_id, alert_id, revision),
 UNIQUE KEY uk_alert_review_request (tenant_id, alert_id, request_id),
 KEY idx_alert_review_status (tenant_id, review_status, follow_up_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
