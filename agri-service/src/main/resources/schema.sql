CREATE TABLE IF NOT EXISTS service_provider (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL,
    category_icon VARCHAR(20) NOT NULL,
    rating DECIMAL(3,1) DEFAULT 5.0,
    order_count INT DEFAULT 0,
    distance_km DECIMAL(6,1) DEFAULT 0,
    response_minutes INT DEFAULT 30,
    price DECIMAL(12,2) DEFAULT 0,
    unit VARCHAR(20) DEFAULT '次',
    badge VARCHAR(40),
    tags VARCHAR(500),
    description VARCHAR(1000),
    certifications VARCHAR(500),
    region VARCHAR(200),
    available_slots VARCHAR(200),
    status VARCHAR(20) DEFAULT 'available',
    credit_code VARCHAR(40),
    contact_name VARCHAR(80),
    contact_phone VARCHAR(40),
    service_area VARCHAR(300),
    credit_score INT DEFAULT 90,
    cancel_rate DECIMAL(5,2) DEFAULT 0,
    risk_level VARCHAR(20) DEFAULT 'low',
    audit_reason VARCHAR(1000),
    merchant_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    provider_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    description VARCHAR(500),
    duration VARCHAR(80),
    selected_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'enabled',
    audit_status VARCHAR(20) DEFAULT 'approved',
    audit_reason VARCHAR(500),
    ai_score INT DEFAULT 90
);

CREATE TABLE IF NOT EXISTS service_demand (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    demand_no VARCHAR(40) NOT NULL UNIQUE,
    category VARCHAR(40) NOT NULL,
    service_name VARCHAR(160) NOT NULL,
    description VARCHAR(1200),
    location VARCHAR(240),
    area VARCHAR(80),
    preferred_date VARCHAR(40),
    budget_min DECIMAL(12,2),
    budget_max DECIMAL(12,2),
    contact_name VARCHAR(80),
    contact_phone VARCHAR(40),
    status VARCHAR(30) DEFAULT 'matching',
    match_count INT DEFAULT 0,
    accepted_provider_id BIGINT,
    accepted_provider_name VARCHAR(120),
    merchant_id BIGINT NULL,
    merchant_name VARCHAR(120) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_order (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(40) NOT NULL UNIQUE,
    provider_id BIGINT,
    provider_name VARCHAR(120) NOT NULL,
    service_name VARCHAR(160) NOT NULL,
    category VARCHAR(40) NOT NULL,
    quantity DECIMAL(12,2) DEFAULT 1,
    unit VARCHAR(20) DEFAULT '次',
    unit_price DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    deposit_amount DECIMAL(12,2) DEFAULT 0,
    appointment_date VARCHAR(40),
    appointment_slot VARCHAR(40),
    location VARCHAR(240),
    contact_name VARCHAR(80),
    contact_phone VARCHAR(40),
    notes VARCHAR(1000),
    status VARCHAR(30) DEFAULT 'pending_payment',
    progress INT DEFAULT 10,
    rating INT,
    review VARCHAR(1000),
    dispatch_status VARCHAR(30) DEFAULT 'normal',
    risk_flag VARCHAR(80),
    settle_status VARCHAR(30) DEFAULT 'pending',
    merchant_id BIGINT NULL,
    merchant_name VARCHAR(120) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_order_event (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    title VARCHAR(120) NOT NULL,
    note VARCHAR(500),
    event_time VARCHAR(40),
    completed BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS service_policy (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(240) NOT NULL,
    level_name VARCHAR(30),
    category VARCHAR(40),
    amount_text VARCHAR(100),
    deadline VARCHAR(40),
    match_score INT DEFAULT 0,
    conditions_text VARCHAR(1000),
    materials_text VARCHAR(1000),
    status VARCHAR(30) DEFAULT 'open',
    published_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS service_policy_application (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    application_no VARCHAR(40) NOT NULL UNIQUE,
    policy_id BIGINT NOT NULL,
    policy_title VARCHAR(240) NOT NULL,
    applicant VARCHAR(120),
    contact_phone VARCHAR(40),
    amount_text VARCHAR(100),
    status VARCHAR(40) DEFAULT 'submitted',
    progress INT DEFAULT 20,
    merchant_id BIGINT NULL,
    merchant_name VARCHAR(120) NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insurance_product (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(40) NOT NULL,
    premium VARCHAR(80),
    coverage VARCHAR(120),
    subsidy VARCHAR(80),
    icon VARCHAR(20),
    summary VARCHAR(800),
    tags VARCHAR(300),
    premium_rate DECIMAL(10,2) DEFAULT 0,
    coverage_per_mu DECIMAL(12,2) DEFAULT 0,
    unit_measure VARCHAR(20) DEFAULT '亩'
);

CREATE TABLE IF NOT EXISTS insurance_policy (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    policy_no VARCHAR(40) NOT NULL UNIQUE,
    product_id BIGINT NOT NULL,
    product_name VARCHAR(160) NOT NULL,
    insured_subject VARCHAR(160),
    insured_area VARCHAR(80),
    premium DECIMAL(12,2),
    coverage_amount DECIMAL(12,2),
    effective_date VARCHAR(40),
    status VARCHAR(30) DEFAULT 'effective',
    merchant_id BIGINT NULL,
    merchant_name VARCHAR(120) NULL
);

CREATE TABLE IF NOT EXISTS insurance_claim (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    claim_no VARCHAR(40) NOT NULL UNIQUE,
    policy_id BIGINT NOT NULL,
    policy_no VARCHAR(40) NOT NULL,
    disaster_type VARCHAR(80),
    description VARCHAR(1200),
    loss_area VARCHAR(80),
    status VARCHAR(30) DEFAULT 'surveying',
    progress INT DEFAULT 30,
    merchant_id BIGINT NULL,
    merchant_name VARCHAR(120) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_course (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    teacher VARCHAR(80),
    mode VARCHAR(40),
    duration VARCHAR(40),
    learners INT DEFAULT 0,
    rating DECIMAL(3,1) DEFAULT 5.0,
    progress INT DEFAULT 0,
    cover VARCHAR(20),
    summary VARCHAR(800),
    tags VARCHAR(300)
);

CREATE TABLE IF NOT EXISTS service_consultation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    consult_no VARCHAR(40) NOT NULL UNIQUE,
    type VARCHAR(40) NOT NULL,
    expert_name VARCHAR(80),
    subject VARCHAR(200),
    content VARCHAR(1200),
    ai_level VARCHAR(30),
    suggestion VARCHAR(1200),
    status VARCHAR(30) DEFAULT 'answered',
    merchant_id BIGINT NULL,
    merchant_name VARCHAR(120) NULL,
    expert_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(30) NOT NULL,
    title VARCHAR(160) NOT NULL,
    content VARCHAR(1000),
    is_read BOOLEAN DEFAULT FALSE,
    merchant_id BIGINT NULL,
    merchant_name VARCHAR(120) NULL,
    biz_type VARCHAR(40),
    biz_no VARCHAR(40),
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS service_complaint (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    complaint_no VARCHAR(40) NOT NULL UNIQUE,
    order_no VARCHAR(40),
    category VARCHAR(60),
    description VARCHAR(1200),
    demand VARCHAR(500),
    status VARCHAR(30) DEFAULT 'processing',
    progress INT DEFAULT 35,
    handler VARCHAR(80),
    resolution VARCHAR(1000),
    merchant_id BIGINT NULL,
    merchant_name VARCHAR(120) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_expert (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    title VARCHAR(80),
    category VARCHAR(40) NOT NULL,
    organization VARCHAR(160),
    service_scope VARCHAR(300),
    phone VARCHAR(40),
    rating DECIMAL(3,1) DEFAULT 4.8,
    consult_count INT DEFAULT 0,
    tags VARCHAR(300),
    summary VARCHAR(800),
    avatar_icon VARCHAR(20),
    status VARCHAR(20) DEFAULT 'available',
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS service_resource (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    resource_type VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    location VARCHAR(240),
    area_mu DECIMAL(12,2) DEFAULT 0,
    price DECIMAL(12,2) DEFAULT 0,
    unit VARCHAR(20),
    description VARCHAR(1000),
    contact_name VARCHAR(80),
    contact_phone VARCHAR(40),
    merchant_id BIGINT NULL,
    merchant_name VARCHAR(120) NULL,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_enrollment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL,
    merchant_id BIGINT NOT NULL,
    merchant_name VARCHAR(120),
    progress INT DEFAULT 0,
    note_text VARCHAR(1000),
    cert_no VARCHAR(40),
    completed_at VARCHAR(40),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_favorite (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    merchant_id BIGINT NOT NULL,
    provider_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_settlement (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_no VARCHAR(40) NOT NULL UNIQUE,
    period_name VARCHAR(80),
    order_count INT DEFAULT 0,
    amount DECIMAL(14,2) DEFAULT 0,
    commission DECIMAL(14,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'pending',
    reviewed_by VARCHAR(80),
    reviewed_at VARCHAR(40),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_campaign (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    scope_name VARCHAR(160),
    quota INT DEFAULT 0,
    claimed INT DEFAULT 0,
    budget DECIMAL(14,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'running',
    starts_at VARCHAR(40),
    ends_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS service_quality_alert (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    provider_id BIGINT,
    provider_name VARCHAR(120),
    alert_type VARCHAR(80),
    content VARCHAR(1000),
    score DECIMAL(5,2),
    level VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(30) DEFAULT 'open',
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS service_strategy (
    config_key VARCHAR(60) PRIMARY KEY,
    label VARCHAR(120) NOT NULL,
    value_text VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    updated_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS service_team_member (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80),
    role_name VARCHAR(100),
    scope_name VARCHAR(120),
    permissions_text VARCHAR(800),
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS service_op_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operator_name VARCHAR(80),
    role_name VARCHAR(80),
    action_name VARCHAR(100),
    target_name VARCHAR(200),
    detail VARCHAR(1000),
    ip_address VARCHAR(60),
    created_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS service_daily_metric (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    metric_date VARCHAR(20) NOT NULL UNIQUE,
    order_count INT DEFAULT 0,
    gmv DECIMAL(14,2) DEFAULT 0,
    provider_count INT DEFAULT 0,
    complaint_count INT DEFAULT 0
);
