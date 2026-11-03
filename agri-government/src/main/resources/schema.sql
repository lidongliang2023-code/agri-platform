CREATE TABLE IF NOT EXISTS gov_subject (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subject_name VARCHAR(200) NOT NULL,
    credit_code VARCHAR(40) NOT NULL UNIQUE,
    subject_type VARCHAR(60),
    legal_person VARCHAR(80),
    contact_phone VARCHAR(40),
    address VARCHAR(300),
    region VARCHAR(100),
    industry VARCHAR(80),
    scale_text VARCHAR(80),
    credit_score INT DEFAULT 90,
    credit_level VARCHAR(20) DEFAULT 'A',
    risk_level VARCHAR(20) DEFAULT 'low',
    supervision_status VARCHAR(30) DEFAULT 'normal',
    certification_status VARCHAR(30) DEFAULT 'certified',
    annual_report_status VARCHAR(30) DEFAULT 'completed',
    merchant_id BIGINT,
    updated_at VARCHAR(40),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gov_license (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    license_name VARCHAR(200) NOT NULL,
    license_no VARCHAR(100),
    authority VARCHAR(160),
    issue_date VARCHAR(30),
    expire_date VARCHAR(30),
    status VARCHAR(30) DEFAULT 'valid',
    attachment_name VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS gov_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_no VARCHAR(50) NOT NULL UNIQUE,
    subject_id BIGINT NOT NULL,
    report_type VARCHAR(80),
    title VARCHAR(240),
    description VARCHAR(1200),
    period_name VARCHAR(80),
    status VARCHAR(30) DEFAULT 'submitted',
    ai_score INT DEFAULT 95,
    chain_hash VARCHAR(100),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gov_self_check (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    check_no VARCHAR(50) NOT NULL UNIQUE,
    score INT DEFAULT 0,
    risk_count INT DEFAULT 0,
    result_text VARCHAR(2000),
    items_text VARCHAR(2000),
    status VARCHAR(30) DEFAULT 'completed',
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gov_credit_event (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    event_type VARCHAR(40),
    title VARCHAR(200),
    score_change INT DEFAULT 0,
    detail VARCHAR(1000),
    source_name VARCHAR(100),
    event_date VARCHAR(30),
    public_flag BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS gov_credit_repair (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    repair_no VARCHAR(50) NOT NULL UNIQUE,
    subject_id BIGINT NOT NULL,
    repair_type VARCHAR(80),
    reason VARCHAR(1000),
    attachment_name VARCHAR(200),
    status VARCHAR(30) DEFAULT 'submitted',
    progress INT DEFAULT 20,
    review_note VARCHAR(1000),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gov_inspection (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    inspection_no VARCHAR(50) NOT NULL UNIQUE,
    subject_id BIGINT NOT NULL,
    subject_name VARCHAR(200),
    inspection_type VARCHAR(80),
    inspectors VARCHAR(200),
    result_text VARCHAR(1000),
    risk_count INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'completed',
    inspection_date VARCHAR(30),
    chain_hash VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS gov_rectification (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rectification_no VARCHAR(50) NOT NULL UNIQUE,
    subject_id BIGINT NOT NULL,
    inspection_id BIGINT,
    issue_text VARCHAR(1000),
    requirement VARCHAR(1000),
    deadline VARCHAR(30),
    status VARCHAR(30) DEFAULT 'pending',
    progress INT DEFAULT 20,
    feedback_text VARCHAR(1200),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gov_penalty (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    penalty_no VARCHAR(50) NOT NULL UNIQUE,
    subject_id BIGINT NOT NULL,
    subject_name VARCHAR(200),
    violation_text VARCHAR(1000),
    legal_basis VARCHAR(500),
    penalty_text VARCHAR(500),
    amount DECIMAL(12,2) DEFAULT 0,
    document_date VARCHAR(30),
    statement_status VARCHAR(30) DEFAULT 'not_submitted',
    statement_text VARCHAR(1500),
    public_flag BOOLEAN DEFAULT TRUE,
    status VARCHAR(30) DEFAULT 'effective'
);

CREATE TABLE IF NOT EXISTS gov_policy (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(260) NOT NULL,
    policy_level VARCHAR(40),
    category VARCHAR(80),
    issuing_authority VARCHAR(160),
    policy_no VARCHAR(100),
    summary VARCHAR(1200),
    content_text VARCHAR(4000),
    publish_date VARCHAR(30),
    effective_date VARCHAR(30),
    deadline VARCHAR(30),
    status VARCHAR(30) DEFAULT 'open',
    tags_text VARCHAR(400)
);

CREATE TABLE IF NOT EXISTS gov_subsidy (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    application_no VARCHAR(50) NOT NULL UNIQUE,
    policy_id BIGINT,
    subject_id BIGINT,
    subject_name VARCHAR(200),
    project_name VARCHAR(240),
    amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(40) DEFAULT 'submitted',
    progress INT DEFAULT 20,
    remote_check_status VARCHAR(40),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gov_warning (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    warning_no VARCHAR(50) NOT NULL UNIQUE,
    warning_type VARCHAR(80),
    level_name VARCHAR(20),
    subject_id BIGINT,
    subject_name VARCHAR(200),
    location VARCHAR(240),
    title VARCHAR(240),
    content VARCHAR(1500),
    ai_confidence INT DEFAULT 85,
    status VARCHAR(30) DEFAULT 'pending',
    assigned_to VARCHAR(80),
    assignee_id BIGINT,
    handle_note VARCHAR(1200),
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS gov_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_no VARCHAR(50) NOT NULL UNIQUE,
    task_type VARCHAR(80),
    subject_id BIGINT,
    subject_name VARCHAR(200),
    address VARCHAR(300),
    distance_km DECIMAL(6,1) DEFAULT 0,
    deadline VARCHAR(30),
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(30) DEFAULT 'pending',
    checklist_done INT DEFAULT 0,
    checklist_total INT DEFAULT 8,
    assigned_to VARCHAR(80),
    assignee_id BIGINT,
    result_text VARCHAR(1500),
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS gov_case (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_no VARCHAR(50) NOT NULL UNIQUE,
    task_id BIGINT,
    subject_id BIGINT,
    subject_name VARCHAR(200),
    case_type VARCHAR(80),
    summary VARCHAR(1200),
    legal_basis VARCHAR(800),
    status VARCHAR(40) DEFAULT 'filing',
    stage_progress INT DEFAULT 20,
    penalty_amount DECIMAL(12,2) DEFAULT 0,
    handler VARCHAR(80),
    handler_id BIGINT,
    filed_at VARCHAR(30),
    closed_at VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS gov_trace_event (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    trace_code VARCHAR(80) NOT NULL,
    product_name VARCHAR(160),
    batch_no VARCHAR(80),
    subject_id BIGINT,
    subject_name VARCHAR(200),
    stage_name VARCHAR(80),
    event_title VARCHAR(200),
    location VARCHAR(240),
    event_time VARCHAR(40),
    evidence_text VARCHAR(1000),
    chain_hash VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS gov_sampling (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sampling_no VARCHAR(50) NOT NULL UNIQUE,
    product_name VARCHAR(160),
    subject_id BIGINT,
    subject_name VARCHAR(200),
    region VARCHAR(100),
    sample_date VARCHAR(30),
    test_items VARCHAR(300),
    result_text VARCHAR(100),
    disposition VARCHAR(500),
    public_flag BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS gov_complaint (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    complaint_no VARCHAR(50) NOT NULL UNIQUE,
    complaint_type VARCHAR(80),
    title VARCHAR(240),
    content VARCHAR(1600),
    reporter_name VARCHAR(80),
    reporter_phone VARCHAR(40),
    anonymous BOOLEAN DEFAULT FALSE,
    target_name VARCHAR(200),
    status VARCHAR(30) DEFAULT 'accepted',
    priority VARCHAR(20) DEFAULT 'normal',
    assigned_org VARCHAR(120),
    handle_note VARCHAR(1200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gov_message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_type VARCHAR(20) DEFAULT 'subject',
    subject_id BIGINT,
    assignee_id BIGINT,
    message_type VARCHAR(40),
    title VARCHAR(200),
    content VARCHAR(1200),
    biz_type VARCHAR(40),
    biz_no VARCHAR(60),
    is_read BOOLEAN DEFAULT FALSE,
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS gov_data_share (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    resource_name VARCHAR(200) NOT NULL,
    owner_department VARCHAR(120),
    receiver_department VARCHAR(120),
    share_type VARCHAR(40),
    sensitive_level VARCHAR(20),
    status VARCHAR(30) DEFAULT 'pending',
    record_count INT DEFAULT 0,
    updated_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS gov_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80),
    role_name VARCHAR(100),
    organization VARCHAR(160),
    grid_name VARCHAR(120),
    certificate_no VARCHAR(40),
    platform_user_id BIGINT,
    status VARCHAR(20) DEFAULT 'active'
);

-- 执法事项清单模板：移动执法的任务详情按这张表出检查项，而不是在代码里写死 8 条
CREATE TABLE IF NOT EXISTS gov_check_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(160) NOT NULL,
    note VARCHAR(300),
    sort_order INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active'
);

-- 每个任务的逐项检查结论（提交时写，详情读这张表；原来"第一项已完成"是代码里的字面量）
CREATE TABLE IF NOT EXISTS gov_task_check (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    item_id BIGINT,
    item_name VARCHAR(160) NOT NULL,
    note VARCHAR(300),
    done BOOLEAN DEFAULT FALSE,
    checked_at VARCHAR(40)
);

-- 现场取证记录：原来只往操作日志里塞一句话就回一个临时哈希，证据本身没有落库
CREATE TABLE IF NOT EXISTS gov_evidence (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    evidence_no VARCHAR(50) NOT NULL UNIQUE,
    task_id BIGINT,
    task_no VARCHAR(50),
    case_id BIGINT,
    subject_id BIGINT,
    evidence_type VARCHAR(40),
    description VARCHAR(1200),
    evidence_hash VARCHAR(120),
    captured_by VARCHAR(80),
    captured_by_id BIGINT,
    captured_at VARCHAR(40),
    uploaded BOOLEAN DEFAULT FALSE,
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS gov_daily_metric (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    metric_date VARCHAR(20) NOT NULL UNIQUE,
    subject_count INT DEFAULT 0,
    warning_count INT DEFAULT 0,
    inspection_count INT DEFAULT 0,
    sampling_rate DECIMAL(5,2) DEFAULT 0,
    case_count INT DEFAULT 0,
    trade_amount DECIMAL(14,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gov_op_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operator_name VARCHAR(80),
    operator_id BIGINT,
    role_name VARCHAR(80),
    action_name VARCHAR(120),
    target_name VARCHAR(200),
    subject_id BIGINT,
    detail VARCHAR(1200),
    ip_address VARCHAR(60),
    created_at VARCHAR(40)
);
