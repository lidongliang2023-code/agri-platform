-- 农技知识问答与培训陪练：独立于普通 AI 助手会话，所有记录按租户隔离，可重复执行
CREATE TABLE IF NOT EXISTS agri_prod_tech_qa_record (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    record_id VARCHAR(64) NOT NULL UNIQUE,
    tenant_id VARCHAR(191) NOT NULL,
    session_id VARCHAR(64),
    question VARCHAR(2000) NOT NULL,
    answer MEDIUMTEXT NOT NULL,
    intent VARCHAR(32) NOT NULL COMMENT 'KNOWLEDGE_QA / SAFETY_BOUNDARY / UNKNOWN',
    source_ids VARCHAR(2000),
    source_snapshot MEDIUMTEXT,
    confidence DECIMAL(5,4),
    status VARCHAR(20) NOT NULL DEFAULT 'ANSWERED' COMMENT 'ANSWERED / NEEDS_REVIEW / REFUSED',
    created_by VARCHAR(64),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tech_qa_tenant_time (tenant_id, create_time),
    INDEX idx_tech_qa_session (tenant_id, session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_training_session (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    training_id VARCHAR(64) NOT NULL UNIQUE,
    tenant_id VARCHAR(191) NOT NULL,
    title VARCHAR(128) NOT NULL,
    topic VARCHAR(64) NOT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'BASIC',
    question_count INT NOT NULL DEFAULT 0,
    answered_count INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    score DECIMAL(6,2),
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' COMMENT 'IN_PROGRESS / COMPLETED / NEEDS_REVIEW',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    created_by VARCHAR(64),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_training_tenant_time (tenant_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_training_question (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    training_id VARCHAR(64) NOT NULL,
    question_no INT NOT NULL,
    question_text VARCHAR(1000) NOT NULL,
    options_json TEXT NOT NULL,
    answer_key VARCHAR(20) NOT NULL,
    explanation MEDIUMTEXT,
    source_ids VARCHAR(2000),
    source_snapshot MEDIUMTEXT,
    user_answer VARCHAR(20),
    is_correct TINYINT,
    answered_at DATETIME,
    INDEX idx_training_question (training_id, question_no),
    UNIQUE KEY uk_training_question_no (training_id, question_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
