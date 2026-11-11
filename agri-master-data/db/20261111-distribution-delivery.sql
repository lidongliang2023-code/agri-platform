
-- 真实分发快照与逐次回执；旧汇总任务不伪造载荷。
CREATE TABLE IF NOT EXISTS agri_md_distribution_delivery (
 task_id BIGINT PRIMARY KEY, idempotency_key VARCHAR(64) NOT NULL UNIQUE, payload LONGTEXT NOT NULL,
 state VARCHAR(20) NOT NULL, attempts INT NOT NULL DEFAULT 0, claim_token VARCHAR(64), claim_until DATETIME,
 receipt LONGTEXT, last_error VARCHAR(500), INDEX idx_delivery_state(state,claim_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS agri_md_distribution_attempt (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,task_id BIGINT NOT NULL,attempt_token VARCHAR(64) NOT NULL UNIQUE,
 success BOOLEAN NOT NULL,receipt LONGTEXT,error_message VARCHAR(500),created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_attempt_task(task_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
