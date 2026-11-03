-- 信息资讯模块 · 建表脚本
-- 兼容 MySQL 8.0 与 H2（MODE=MySQL）。所有表以 info_ 前缀，避免与其他模块的同名表冲突。
-- 说明：演示环境由 spring.sql.init 直接执行本脚本；生产库通过 database/agri_info.sql 初始化。

-- ============ 栏目 / 作者 ============
CREATE TABLE IF NOT EXISTS info_channel (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(60) NOT NULL,
    icon VARCHAR(20),
    description VARCHAR(300),
    sort_no INT DEFAULT 0,
    article_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'enabled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS info_author (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    author_type VARCHAR(20) DEFAULT 'official',
    avatar_text VARCHAR(10),
    title VARCHAR(80),
    org_name VARCHAR(120),
    article_count INT DEFAULT 0,
    followers INT DEFAULT 0,
    verified BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'enabled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ 资讯内容 ============
CREATE TABLE IF NOT EXISTS info_article (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    article_no VARCHAR(40),
    title VARCHAR(300) NOT NULL,
    channel VARCHAR(60) NOT NULL,
    content_type VARCHAR(20) DEFAULT '图文',
    summary VARCHAR(1000),
    content TEXT,
    author VARCHAR(80),
    author_type VARCHAR(20) DEFAULT 'official',
    cover_icon VARCHAR(20),
    tags VARCHAR(400),
    read_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    favorite_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'published',
    risk_level VARCHAR(20) DEFAULT 'none',
    risk_note VARCHAR(500),
    audit_note VARCHAR(500),
    is_top BOOLEAN DEFAULT FALSE,
    ai_generated BOOLEAN DEFAULT FALSE,
    source VARCHAR(200),
    published_at VARCHAR(40),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS info_article_comment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    article_id BIGINT NOT NULL,
    user_name VARCHAR(60),
    user_region VARCHAR(80),
    content VARCHAR(1000),
    like_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ 行情报价 ============
CREATE TABLE IF NOT EXISTS info_quote (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(60) NOT NULL,
    icon VARCHAR(20),
    category VARCHAR(40) NOT NULL,
    origin VARCHAR(80),
    market VARCHAR(80),
    price DECIMAL(10,2) DEFAULT 0,
    price_unit VARCHAR(20) DEFAULT '元/公斤',
    change_amount DECIMAL(10,2) DEFAULT 0,
    change_pct DECIMAL(6,2) DEFAULT 0,
    week_pct DECIMAL(6,2) DEFAULT 0,
    month_pct DECIMAL(6,2) DEFAULT 0,
    spec VARCHAR(200),
    source VARCHAR(200),
    trend VARCHAR(200),
    monitor_level VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'online',
    updated_at VARCHAR(40),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS info_quote_series (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    quote_id BIGINT NOT NULL,
    stat_date VARCHAR(20) NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    volume DECIMAL(12,2) DEFAULT 0,
    forecast BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS info_price_index (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(40),
    index_value DECIMAL(10,2) DEFAULT 0,
    change_pct DECIMAL(6,2) DEFAULT 0,
    base_period VARCHAR(40),
    sample_count INT DEFAULT 0,
    method VARCHAR(200),
    trend VARCHAR(200),
    status VARCHAR(20) DEFAULT 'published',
    published_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS info_forecast (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    quote_id BIGINT NOT NULL,
    horizon VARCHAR(20) DEFAULT '7d',
    mid_price DECIMAL(10,2) DEFAULT 0,
    low_price DECIMAL(10,2) DEFAULT 0,
    high_price DECIMAL(10,2) DEFAULT 0,
    up_probability INT DEFAULT 0,
    flat_probability INT DEFAULT 0,
    down_probability INT DEFAULT 0,
    supply_index INT DEFAULT 50,
    demand_index INT DEFAULT 50,
    stock_days VARCHAR(40),
    sales_advice VARCHAR(1000),
    plant_advice VARCHAR(1000),
    confidence INT DEFAULT 80,
    mape DECIMAL(6,2) DEFAULT 6.0,
    risk_json VARCHAR(600),
    drivers VARCHAR(600),
    updated_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS info_quote_source (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    source_type VARCHAR(40),
    frequency VARCHAR(40),
    point_count INT DEFAULT 0,
    error_rate DECIMAL(6,2) DEFAULT 0,
    last_sync VARCHAR(40),
    status VARCHAR(20) DEFAULT 'normal'
);

CREATE TABLE IF NOT EXISTS info_collect_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    source_name VARCHAR(120),
    cron_text VARCHAR(60),
    last_run VARCHAR(40),
    last_rows INT DEFAULT 0,
    duration_ms INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'success',
    remark VARCHAR(300)
);

-- ============ 供需大厅（关联表） ============
-- info_supply_demand / info_sd_match 已删除：供应与需求的主数据统一由交易模块持有
-- （agri_trade_product / agri_trade_demand），撮合走 /api/trade/match/*，
-- 信息资讯不再维护第二份供需库，只保留下面这两张必要的关联表。

CREATE TABLE IF NOT EXISTS info_sd_message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sd_id BIGINT NOT NULL,
    direction VARCHAR(10) DEFAULT 'in',
    from_name VARCHAR(120),
    content VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 供需信息与交易撮合的联系方式关联。
-- 主数据（供应=agri_trade_product，需求=agri_trade_demand）统一由交易模块持有，
-- 但交易模块按平台规范不公开联系电话（走洽谈/询价流程），
-- 而信息撮合场景需要把联系方式摆在明面上，所以这张表只补这一块，不复制主数据。
CREATE TABLE IF NOT EXISTS info_sd_contact (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    trade_type VARCHAR(20) NOT NULL,
    trade_id BIGINT NOT NULL,
    contact_name VARCHAR(60),
    contact_phone VARCHAR(40),
    org_name VARCHAR(160),
    org_type VARCHAR(40),
    owner VARCHAR(80),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (trade_type, trade_id)
);

-- 推荐位内容编排。
-- info_recommend_slot 只存"槽位叫什么、放几条、什么策略"，没有内容关联，
-- 运营改不了"到底展示哪几条"。这张表补上内容与顺序，门户首页据此出稿。
CREATE TABLE IF NOT EXISTS info_recommend_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slot_id BIGINT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'article',
    content_id BIGINT NOT NULL,
    sort_no INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'online',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (slot_id, content_type, content_id)
);

-- ============ 农技知识 / 培训 / AI问答 ============
CREATE TABLE IF NOT EXISTS info_course (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    teacher VARCHAR(80),
    course_mode VARCHAR(20) DEFAULT '录播',
    duration VARCHAR(40),
    learners INT DEFAULT 0,
    rating DECIMAL(3,1) DEFAULT 4.8,
    progress INT DEFAULT 0,
    cover_icon VARCHAR(20),
    summary VARCHAR(1000),
    tags VARCHAR(300),
    live_at VARCHAR(60),
    is_live BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 课程章节：一门课 N 节，每节一个播放源。
-- 为什么单独建表而不在 info_course 上加 video_url：真实课程是"多集"结构，
-- 单集字段撑不住目录/续播/试看，后期再拆表反而要迁数据。
-- video_url 存相对路径（如 course-2/l03.mp4），绝对地址由 play-ticket 现场签发，
-- 落库存签名地址会在 5 分钟后集体失效。
CREATE TABLE IF NOT EXISTS info_course_lesson (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL,
    seq INT NOT NULL DEFAULT 1,
    title VARCHAR(200) NOT NULL,
    duration_sec INT DEFAULT 0,
    media_type VARCHAR(20) DEFAULT 'vod',
    video_url VARCHAR(500) NOT NULL,
    cover_url VARCHAR(500),
    free_preview BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户级学习记录：info_course.progress 是全站共享的一个数字，
-- 两个人看同一门课会互相覆盖，所以真实进度必须按 owner 分开存。
CREATE TABLE IF NOT EXISTS info_course_learn (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL,
    lesson_id BIGINT NOT NULL,
    owner VARCHAR(80) NOT NULL,
    position_sec INT DEFAULT 0,
    progress INT DEFAULT 0,
    finished BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, lesson_id, owner)
);

CREATE TABLE IF NOT EXISTS info_knowledge (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(40),
    crop VARCHAR(60),
    summary VARCHAR(600),
    content TEXT,
    source_name VARCHAR(160),
    view_count INT DEFAULT 0,
    tags VARCHAR(300),
    status VARCHAR(20) DEFAULT 'published',
    updated_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS info_qa_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    qa_no VARCHAR(40),
    qa_type VARCHAR(20) DEFAULT 'ai',
    question VARCHAR(600) NOT NULL,
    answer TEXT,
    category VARCHAR(40),
    crop VARCHAR(60),
    source_refs VARCHAR(500),
    confidence INT DEFAULT 85,
    expert_name VARCHAR(60),
    status VARCHAR(20) DEFAULT 'answered',
    asked_by VARCHAR(60),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS info_expert (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    title_name VARCHAR(80),
    org_name VARCHAR(160),
    field_name VARCHAR(60),
    region VARCHAR(80),
    cert_no VARCHAR(60),
    expert_level VARCHAR(40),
    intro VARCHAR(600),
    answer_count INT DEFAULT 0,
    rating DECIMAL(3,1) DEFAULT 4.9,
    followers INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'approved',
    apply_at VARCHAR(40),
    audit_at VARCHAR(40),
    audit_note VARCHAR(500),
    owner VARCHAR(60),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ 数据报告 / 存证 ============
CREATE TABLE IF NOT EXISTS info_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_no VARCHAR(40),
    title VARCHAR(200) NOT NULL,
    category VARCHAR(40),
    period VARCHAR(40),
    summary VARCHAR(1000),
    sections VARCHAR(2000),
    page_count INT DEFAULT 20,
    price DECIMAL(10,2) DEFAULT 0,
    downloads INT DEFAULT 0,
    is_free BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'published',
    audit_note VARCHAR(400),
    published_at VARCHAR(40),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS info_attestation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    attest_no VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content_type VARCHAR(40),
    content_id BIGINT DEFAULT 0,
    content_hash VARCHAR(100),
    chain_name VARCHAR(40) DEFAULT '农业联盟链',
    block_height VARCHAR(40),
    tx_id VARCHAR(120),
    attested_at VARCHAR(40),
    status VARCHAR(20) DEFAULT 'confirmed',
    verify_count INT DEFAULT 0,
    owner VARCHAR(60),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ 预警 / 订阅 / 收藏 ============
CREATE TABLE IF NOT EXISTS info_alert_rule (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_name VARCHAR(120) NOT NULL,
    quote_id BIGINT DEFAULT 0,
    quote_name VARCHAR(120),
    metric VARCHAR(40) DEFAULT '涨跌幅',
    operator_type VARCHAR(10) DEFAULT '>=',
    threshold_value DECIMAL(10,2) DEFAULT 5,
    channel VARCHAR(80) DEFAULT '站内消息',
    enabled BOOLEAN DEFAULT TRUE,
    hit_count INT DEFAULT 0,
    owner VARCHAR(60),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS info_alert_message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_id BIGINT DEFAULT 0,
    title VARCHAR(200) NOT NULL,
    content VARCHAR(1000),
    alert_level VARCHAR(20) DEFAULT 'warning',
    quote_name VARCHAR(120),
    trigger_value VARCHAR(60),
    is_read BOOLEAN DEFAULT FALSE,
    owner VARCHAR(60),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS info_subscription (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    target_type VARCHAR(40) NOT NULL,
    target_name VARCHAR(120) NOT NULL,
    channel VARCHAR(80) DEFAULT '站内消息',
    frequency VARCHAR(40) DEFAULT '每日',
    enabled BOOLEAN DEFAULT TRUE,
    owner VARCHAR(60),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS info_favorite (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    target_type VARCHAR(40) NOT NULL,
    target_id BIGINT DEFAULT 0,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(400),
    owner VARCHAR(60),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ 运营支撑 ============
CREATE TABLE IF NOT EXISTS info_recommend_slot (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slot_name VARCHAR(120) NOT NULL,
    position_name VARCHAR(120),
    strategy_name VARCHAR(200),
    item_count INT DEFAULT 0,
    ctr DECIMAL(6,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'online',
    updated_at VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS info_sensitive_word (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    word VARCHAR(60) NOT NULL,
    word_level VARCHAR(20) DEFAULT 'medium',
    action_name VARCHAR(40) DEFAULT '人工复核',
    hit_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'enabled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS info_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operator_name VARCHAR(60),
    action_name VARCHAR(80),
    target_name VARCHAR(200),
    detail VARCHAR(500),
    ip_address VARCHAR(60),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
