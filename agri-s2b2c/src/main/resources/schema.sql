CREATE TABLE IF NOT EXISTS s2b2c_supplier (
    id BIGINT PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL,
    credit_code VARCHAR(18) UNIQUE,
    industry VARCHAR(100),
    province VARCHAR(50),
    city VARCHAR(50),
    district VARCHAR(50),
    address VARCHAR(500),
    legal_name VARCHAR(100),
    legal_id_card VARCHAR(18),
    contact_phone VARCHAR(20),
    bank_name VARCHAR(100),
    bank_account VARCHAR(50),
    bank_branch VARCHAR(200),
    shop_name VARCHAR(200),
    shop_desc VARCHAR(1000),
    shop_logo VARCHAR(500),
    audit_status VARCHAR(20) DEFAULT 'PENDING',
    audit_time TIMESTAMP,
    audit_opinion VARCHAR(1000),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_supplier_cert (
    id BIGINT PRIMARY KEY,
    supplier_id BIGINT NOT NULL,
    cert_type VARCHAR(50),
    cert_name VARCHAR(200),
    cert_image VARCHAR(500),
    cert_no VARCHAR(100),
    expire_date DATE,
    status VARCHAR(20) DEFAULT 'VALID',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_channel_partner (
    id BIGINT PRIMARY KEY,
    register_type VARCHAR(20) DEFAULT 'PERSONAL',
    company_name VARCHAR(200),
    credit_code VARCHAR(18),
    industry VARCHAR(100),
    province VARCHAR(50),
    city VARCHAR(50),
    district VARCHAR(50),
    address VARCHAR(500),
    contact_name VARCHAR(100),
    contact_phone VARCHAR(20),
    referrer_id BIGINT,
    shop_name VARCHAR(200),
    shop_desc VARCHAR(1000),
    shop_logo VARCHAR(500),
    grade VARCHAR(20) DEFAULT 'LEVEL_1',
    audit_status VARCHAR(20) DEFAULT 'PENDING',
    audit_time TIMESTAMP,
    audit_opinion VARCHAR(1000),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 渠道选品关系表：一个商品可被多个渠道同时选中，渠道不再改写商品自身的归属
-- 渠道等级 → 佣金比例规则（渠道订单结算时优先于商品自带的佣金率）
-- 佣金提现申请：渠道把已结算佣金提现，运营审核后打款
-- 佣金结算批次：按渠道/账期把 PENDING 佣金结算成 SETTLED，并留一个批次号
CREATE TABLE IF NOT EXISTS s2b2c_commission_settlement (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_no VARCHAR(40) NOT NULL,
    channel_id BIGINT NULL,
    period_start DATE NULL,
    period_end DATE NULL,
    commission_count INT NOT NULL DEFAULT 0,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    operator VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_batch_no (batch_no),
    KEY idx_channel (channel_id, created_at)
);

-- 佣金行记录所属结算批次
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_commission ADD COLUMN settle_batch_no VARCHAR(40) NULL COMMENT ''结算批次号''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_commission' AND COLUMN_NAME = 'settle_batch_no'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS s2b2c_commission_withdrawal (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    channel_id BIGINT NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    apply_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewer VARCHAR(100),
    review_time TIMESTAMP NULL,
    remark VARCHAR(500),
    payout_no VARCHAR(64) NULL COMMENT '打款流水号',
    payout_operator VARCHAR(100) NULL COMMENT '打款操作人',
    payout_time TIMESTAMP NULL COMMENT '打款时间',
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_channel_status (channel_id, status)
);

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_commission_withdrawal ADD COLUMN payout_no VARCHAR(64) NULL COMMENT ''打款流水号''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_commission_withdrawal' AND COLUMN_NAME = 'payout_no'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_commission_withdrawal ADD COLUMN payout_operator VARCHAR(100) NULL COMMENT ''打款操作人''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_commission_withdrawal' AND COLUMN_NAME = 'payout_operator'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_commission_withdrawal ADD COLUMN payout_time TIMESTAMP NULL COMMENT ''打款时间''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_commission_withdrawal' AND COLUMN_NAME = 'payout_time'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS s2b2c_commission_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    grade VARCHAR(20) NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    remark VARCHAR(200),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_grade (grade)
);

-- 渠道等级考核：按周期内有效渠道订单数与 GMV 自动定级
CREATE TABLE IF NOT EXISTS s2b2c_grade_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    grade VARCHAR(20) NOT NULL,
    min_orders INT NOT NULL DEFAULT 0,
    min_gmv DECIMAL(18,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    remark VARCHAR(200),
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_grade (grade)
);

CREATE TABLE IF NOT EXISTS s2b2c_grade_change_log (
    id BIGINT PRIMARY KEY,
    channel_id BIGINT NOT NULL,
    from_grade VARCHAR(20),
    to_grade VARCHAR(20),
    orders_count INT NOT NULL DEFAULT 0,
    gmv DECIMAL(18,2) NOT NULL DEFAULT 0,
    period_start DATE,
    period_end DATE,
    operator VARCHAR(100),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_channel (channel_id, create_time)
);

CREATE TABLE IF NOT EXISTS s2b2c_channel_product (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    channel_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    supplier_id BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_channel_product (channel_id, product_id),
    KEY idx_channel (channel_id, status),
    KEY idx_product (product_id)
);

-- 渠道零售价与货架状态：渠道只维护分销层，不改写商品主数据
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_channel_product ADD COLUMN retail_price DECIMAL(18,2) NULL COMMENT ''渠道零售价（空=按商品价）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_channel_product' AND COLUMN_NAME = 'retail_price'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_channel_product ADD COLUMN shelf_status VARCHAR(20) DEFAULT ''ON'' COMMENT ''渠道货架：ON/OFF''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_channel_product' AND COLUMN_NAME = 'shelf_status'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 老数据回填：历史上"选品"是直接写 product.channel_id，这里按现有值生成一条关系
INSERT IGNORE INTO s2b2c_channel_product (channel_id, product_id, supplier_id, status, picked_at)
SELECT channel_id, id, supplier_id, 'ACTIVE', NOW()
FROM s2b2c_product
WHERE channel_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS s2b2c_consumer (
    id BIGINT PRIMARY KEY,
    nickname VARCHAR(100),
    phone VARCHAR(20) UNIQUE,
    avatar VARCHAR(500),
    gender VARCHAR(10),
    age INT,
    province VARCHAR(50),
    city VARCHAR(50),
    district VARCHAR(50),
    member_level VARCHAR(20) DEFAULT 'NORMAL',
    total_consume DECIMAL(18,2) DEFAULT 0,
    points INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 渠道合伙人 ↔ 平台账号（渠道操作需要校验归属）
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_channel_partner ADD COLUMN user_id BIGINT NULL COMMENT ''平台账号ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_channel_partner' AND COLUMN_NAME = 'user_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 供应商档案 ↔ 平台账号（商品写入需要校验归属）
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_supplier ADD COLUMN user_id BIGINT NULL COMMENT ''平台账号ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_supplier' AND COLUMN_NAME = 'user_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 统一登录后补的映射列：消费者档案 ↔ 平台账号
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_consumer ADD COLUMN user_id BIGINT NULL COMMENT ''平台账号ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_consumer' AND COLUMN_NAME = 'user_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS s2b2c_category (
    id BIGINT PRIMARY KEY,
    parent_id BIGINT DEFAULT 0,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(500),
    sort_order INT DEFAULT 0,
    level INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_product (
    id BIGINT PRIMARY KEY,
    supplier_id BIGINT NOT NULL,
    channel_id BIGINT,
    category_id BIGINT NOT NULL,
    name VARCHAR(500) NOT NULL,
    selling_point VARCHAR(500),
    origin VARCHAR(200),
    grade VARCHAR(50),
    shelf_life VARCHAR(50),
    spec VARCHAR(200),
    unit VARCHAR(20) DEFAULT '件',
    price DECIMAL(18,2) NOT NULL,
    original_price DECIMAL(18,2),
    cost_price DECIMAL(18,2),
    stock INT DEFAULT 0,
    stock_warning INT DEFAULT 10,
    commission_rate DECIMAL(5,2) DEFAULT 0,
    images TEXT,
    video_url VARCHAR(500),
    detail TEXT,
    freight_template VARCHAR(200),
    delivery_time VARCHAR(50),
    certifications VARCHAR(500),
    traceability_info TEXT,
    -- 绑定的生产域采收批次号（agri_production.agri_prod_harvest_batch.batch_no）。
    -- 这是"一物一码可溯源"的连接点：详情页那条链路不是商城自己写的，而是按这个批次去生产域实查回来的
    -- （种植/采收/加工/质检/仓储 + 链上存证）。为空就是没绑，页面据此说"尚未绑定生产批次"，
    -- 不再拿本地种子批次冒充。
    prod_batch_no VARCHAR(64) NULL COMMENT '绑定的生产域采收批次号（空=未绑定，溯源链路不可展示）',
    status VARCHAR(20) DEFAULT 'PENDING',
    audit_time TIMESTAMP,
    audit_opinion VARCHAR(1000),
    sales INT DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_product_sku (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    spec_name VARCHAR(200),
    spec_value VARCHAR(200),
    price DECIMAL(18,2) NOT NULL,
    cost_price DECIMAL(18,2),
    stock INT DEFAULT 0,
    sku_code VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 存量库补列：CREATE TABLE IF NOT EXISTS 对已存在的表不生效，老库必须靠这条幂等 ALTER 才拿得到新列。
-- （漏掉这一步的后果是"接口 200、SQL 报 Unknown column"，本项目已为此踩过一次。）
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_product ADD COLUMN prod_batch_no VARCHAR(64) NULL COMMENT ''绑定的生产域采收批次号''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_product' AND COLUMN_NAME = 'prod_batch_no'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS s2b2c_shop (
    id BIGINT PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    owner_type VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    logo VARCHAR(500),
    `desc` VARCHAR(1000),
    main_categories VARCHAR(500),
    contact_phone VARCHAR(20),
    province VARCHAR(50),
    city VARCHAR(50),
    district VARCHAR(50),
    address VARCHAR(500),
    business_hours VARCHAR(200),
    delivery_range VARCHAR(200),
    delivery_days VARCHAR(50),
    business_status VARCHAR(20) DEFAULT 'OPEN',
    decoration_template VARCHAR(200),
    banners TEXT,
    announcement TEXT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_order (
    id BIGINT PRIMARY KEY,
    order_no VARCHAR(50) UNIQUE NOT NULL,
    consumer_id BIGINT NOT NULL,
    shop_id BIGINT NOT NULL,
    supplier_id BIGINT,
    channel_id BIGINT,
    address_id BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING_PAY',
    total_amount DECIMAL(18,2) NOT NULL,
    discount_amount DECIMAL(18,2) DEFAULT 0,
    freight_amount DECIMAL(18,2) DEFAULT 0,
    pay_amount DECIMAL(18,2) NOT NULL,
    pay_method VARCHAR(20),
    pay_time TIMESTAMP,
    delivery_type VARCHAR(20) DEFAULT 'EXPRESS',
    delivery_time VARCHAR(50),
    logistics_no VARCHAR(100),
    logistics_company VARCHAR(100),
    remark VARCHAR(500),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_order_item (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    sku_id BIGINT,
    name VARCHAR(500) NOT NULL,
    spec VARCHAR(200),
    price DECIMAL(18,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    total_amount DECIMAL(18,2) NOT NULL,
    image VARCHAR(500),
    trace_code VARCHAR(100),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_cart (
    id BIGINT PRIMARY KEY,
    consumer_id BIGINT NOT NULL,
    shop_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    sku_id BIGINT,
    quantity INT DEFAULT 1,
    selected BOOLEAN DEFAULT TRUE,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 购物车行记录"从哪个渠道加购"：渠道店铺加购会带 channel_id，结算时按行归属拆单
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_cart ADD COLUMN channel_id BIGINT NULL COMMENT ''渠道ID（渠道店铺加购）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_cart' AND COLUMN_NAME = 'channel_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS s2b2c_address (
    id BIGINT PRIMARY KEY,
    consumer_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    province VARCHAR(50) NOT NULL,
    city VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    address VARCHAR(500) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_coupon (
    id BIGINT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) DEFAULT 'FIXED',
    amount DECIMAL(18,2) DEFAULT 0,
    discount_rate DECIMAL(5,2),
    min_amount DECIMAL(18,2) DEFAULT 0,
    total_count INT DEFAULT 1000,
    remain_count INT DEFAULT 1000,
    per_user_limit INT DEFAULT 1,
    valid_start DATE NOT NULL,
    valid_end DATE NOT NULL,
    applicable_scope VARCHAR(20) DEFAULT 'ALL',
    applicable_categories VARCHAR(500),
    applicable_shops VARCHAR(500),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_coupon_user (
    id BIGINT PRIMARY KEY,
    coupon_id BIGINT NOT NULL,
    consumer_id BIGINT NOT NULL,
    order_id BIGINT,
    status VARCHAR(20) DEFAULT 'UNUSED',
    receive_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    use_time TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_commission (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    settle_time TIMESTAMP,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_commission ADD COLUMN remark VARCHAR(200) NULL COMMENT ''冲回/调整说明''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_commission' AND COLUMN_NAME = 'remark'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS s2b2c_logistics (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    logistics_no VARCHAR(100) NOT NULL,
    logistics_company VARCHAR(100),
    tracking_info TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_after_sale (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    order_item_id BIGINT,
    consumer_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL,
    reason VARCHAR(500),
    images TEXT,
    amount DECIMAL(18,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    handle_opinion VARCHAR(1000),
    handle_time TIMESTAMP,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 退货退款：买家回寄物流与商家收货时间
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_after_sale ADD COLUMN return_company VARCHAR(100) NULL',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_after_sale' AND COLUMN_NAME = 'return_company'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_after_sale ADD COLUMN return_logistics_no VARCHAR(100) NULL',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_after_sale' AND COLUMN_NAME = 'return_logistics_no'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_after_sale ADD COLUMN return_shipped_at TIMESTAMP NULL',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_after_sale' AND COLUMN_NAME = 'return_shipped_at'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_after_sale ADD COLUMN return_received_at TIMESTAMP NULL',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_after_sale' AND COLUMN_NAME = 'return_received_at'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS s2b2c_traceability (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    batch_code VARCHAR(100) UNIQUE NOT NULL,
    origin VARCHAR(200),
    planting_date DATE,
    harvest_date DATE,
    processing_info VARCHAR(1000),
    quality_report VARCHAR(500),
    storage_info VARCHAR(500),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_flash_sale (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    sale_price DECIMAL(18,2) NOT NULL,
    original_price DECIMAL(18,2) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    total_stock INT NOT NULL,
    remain_stock INT NOT NULL,
    per_user_limit INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'UPCOMING',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_group_buy (
    id BIGINT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    product_id BIGINT NOT NULL,
    single_price DECIMAL(18,2) NOT NULL,
    group_price DECIMAL(18,2) NOT NULL,
    leader_price DECIMAL(18,2),
    group_size INT NOT NULL DEFAULT 3,
    per_user_limit INT DEFAULT 1,
    valid_hours INT DEFAULT 24,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'UPCOMING',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_group_buy_order (
    id BIGINT PRIMARY KEY,
    group_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    leader_id BIGINT,
    status VARCHAR(20) DEFAULT 'PENDING',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 活动预算与费用承担：券/秒杀/拼团共用同一组字段；budget NULL 表示不限
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_coupon ADD COLUMN budget DECIMAL(18,2) NULL COMMENT ''活动预算，NULL=不限''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_coupon' AND COLUMN_NAME = 'budget'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_coupon ADD COLUMN budget_used DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT ''已消耗预算''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_coupon' AND COLUMN_NAME = 'budget_used'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_coupon ADD COLUMN cost_bearer VARCHAR(20) NOT NULL DEFAULT ''PLATFORM'' COMMENT ''PLATFORM/SUPPLIER/CHANNEL''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_coupon' AND COLUMN_NAME = 'cost_bearer'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_flash_sale ADD COLUMN budget DECIMAL(18,2) NULL COMMENT ''活动预算，NULL=不限''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_flash_sale' AND COLUMN_NAME = 'budget'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_flash_sale ADD COLUMN budget_used DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT ''已消耗预算''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_flash_sale' AND COLUMN_NAME = 'budget_used'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_flash_sale ADD COLUMN cost_bearer VARCHAR(20) NOT NULL DEFAULT ''PLATFORM'' COMMENT ''PLATFORM/SUPPLIER/CHANNEL''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_flash_sale' AND COLUMN_NAME = 'cost_bearer'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_group_buy ADD COLUMN budget DECIMAL(18,2) NULL COMMENT ''活动预算，NULL=不限''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_group_buy' AND COLUMN_NAME = 'budget'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_group_buy ADD COLUMN budget_used DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT ''已消耗预算''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_group_buy' AND COLUMN_NAME = 'budget_used'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_group_buy ADD COLUMN cost_bearer VARCHAR(20) NOT NULL DEFAULT ''PLATFORM'' COMMENT ''PLATFORM/SUPPLIER/CHANNEL''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_group_buy' AND COLUMN_NAME = 'cost_bearer'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS s2b2c_message (
    id BIGINT PRIMARY KEY,
    sender_id BIGINT,
    receiver_id BIGINT NOT NULL,
    receiver_type VARCHAR(20) NOT NULL,
    type VARCHAR(20) DEFAULT 'NOTICE',
    title VARCHAR(200),
    content TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO s2b2c_category (id, parent_id, name, icon, sort_order, level) VALUES
(1, 0, '粮油调味', '🍚', 1, 1),
(2, 0, '新鲜果蔬', '🥬', 2, 1),
(3, 0, '肉禽蛋奶', '🥩', 3, 1),
(4, 0, '茶叶茶饮', '🍵', 4, 1),
(5, 0, '滋补养生', '🍯', 5, 1),
(6, 0, '地方特产', '🎁', 6, 1),
(7, 1, '大米', '', 1, 2),
(8, 1, '面粉', '', 2, 2),
(9, 1, '食用油', '', 3, 2),
(10, 1, '调味品', '', 4, 2),
(11, 2, '时令蔬菜', '', 1, 2),
(12, 2, '新鲜水果', '', 2, 2),
(13, 2, '有机蔬菜', '', 3, 2),
(14, 3, '猪肉', '', 1, 2),
(15, 3, '牛羊肉', '', 2, 2),
(16, 3, '鲜蛋', '', 3, 2),
(17, 4, '绿茶', '', 1, 2),
(18, 4, '红茶', '', 2, 2),
(19, 4, '普洱茶', '', 3, 2);

INSERT IGNORE INTO s2b2c_supplier (id, company_name, credit_code, industry, province, city, district, address, legal_name, legal_id_card, contact_phone, bank_name, bank_account, shop_name, audit_status, status) VALUES
(1, '五常大米专营有限公司', '91230100MA1BCDEF12', '种植业', '黑龙江省', '哈尔滨市', '五常市', '五常镇XX路XX号', '张五常', '230100198001011234', '13800138001', '中国工商银行', '6222021234567890123', '五常大米旗舰店', 'APPROVED', 'ACTIVE'),
(2, '云南有机农业合作社', '91530100MA2BCDEF34', '种植业', '云南省', '昆明市', '五华区', 'XX街道XX号', '李云南', '530100197802022345', '13900139002', '中国农业银行', '6228481234567890123', '云南有机馆', 'APPROVED', 'ACTIVE'),
(3, '黄山毛峰茶业公司', '91340100MA3BCDEF56', '茶业', '安徽省', '黄山市', '徽州区', 'XX乡XX村', '王黄山', '340100198203033456', '13700137003', '中国建设银行', '6227001234567890123', '黄山茶庄', 'PENDING', 'ACTIVE');

INSERT IGNORE INTO s2b2c_product (id, supplier_id, category_id, name, selling_point, origin, grade, spec, unit, price, original_price, cost_price, stock, commission_rate, images, certifications, status, sales) VALUES
(1, 1, 7, '有机五常大米 5kg袋装', '精选五常核心产区，有机种植，颗粒饱满', '黑龙江五常', '一级', '5kg/袋', '袋', 68.00, 98.00, 52.00, 1000, 10.00, '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=organic%20rice%205kg%20bag%20premium%20quality&image_size=square\"]', '[\"有机认证\"]', 'APPROVED', 520),
(2, 1, 7, '有机五常大米 10kg袋装', '家庭装，实惠之选', '黑龙江五常', '一级', '10kg/袋', '袋', 128.00, 188.00, 98.00, 500, 10.00, '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=organic%20rice%2010kg%20bag%20bulk&image_size=square\"]', '[\"有机认证\"]', 'APPROVED', 234),
(3, 2, 16, '土鸡蛋30枚装', '农家散养，营养丰富', '云南昆明', '特级', '30枚/盒', '盒', 38.00, 58.00, 28.00, 800, 8.00, '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=fresh%20farm%20eggs%2030%20pieces%20organic&image_size=square\"]', '[\"绿色食品\"]', 'APPROVED', 386),
(4, 2, 12, '阳光玫瑰葡萄5斤装', '无籽脆甜，果香浓郁', '云南宾川', '一级', '5斤/盒', '盒', 68.00, 98.00, 52.00, 300, 12.00, '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=green%20grape%205%20pounds%20premium%20fresh&image_size=square\"]', '[\"有机认证\"]', 'APPROVED', 187),
(5, 3, 17, '黄山毛峰特级250g', '明前特级，清香悠长', '安徽黄山', '特级', '250g/罐', '罐', 268.00, 388.00, 188.00, 100, 15.00, '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=premium%20green%20tea%20250g%20can%20Chinese&image_size=square\"]', '[\"地理标志\"]', 'PENDING', 0);

INSERT IGNORE INTO s2b2c_channel_partner (id, register_type, company_name, contact_name, contact_phone, shop_name, grade, audit_status, status) VALUES
(1, 'PERSONAL', '', '李四', '13800138004', '李四优选店', 'LEVEL_3', 'APPROVED', 'ACTIVE'),
(2, 'PERSONAL', '', '王五', '13900139005', '王五生鲜馆', 'LEVEL_2', 'APPROVED', 'ACTIVE'),
(3, 'ENTERPRISE', '钱氏农业科技有限公司', '钱七', '13700137006', '钱七特产店', 'LEVEL_3', 'PENDING', 'ACTIVE');

INSERT IGNORE INTO s2b2c_consumer (id, nickname, phone, avatar, province, city) VALUES
(1, '张三', '13800138007', '', '浙江省', '杭州市'),
(2, '赵六', '13900139008', '', '广东省', '深圳市'),
(3, '孙八', '13700137009', '', '江苏省', '南京市');

INSERT IGNORE INTO s2b2c_address (id, consumer_id, name, phone, province, city, district, address, is_default) VALUES
(1, 1, '张三', '13800138007', '浙江省', '杭州市', '西湖区', '文三路XX号XX大厦1201室', TRUE),
(2, 1, '张三', '13800138007', '浙江省', '杭州市', '拱墅区', 'XX街道XX小区3栋502', FALSE),
(3, 2, '赵六', '13900139008', '广东省', '深圳市', '南山区', '科技园XX路XX号', TRUE);

INSERT IGNORE INTO s2b2c_coupon (id, name, type, amount, min_amount, total_count, remain_count, valid_start, valid_end, status) VALUES
(1, '新人专享20元红包', 'FIXED', 20.00, 59.00, 1000, 985, '2026-01-01', '2026-12-31', 'ACTIVE'),
(2, '满100减10', 'FIXED', 10.00, 100.00, 5000, 4820, '2026-01-01', '2026-12-31', 'ACTIVE'),
(3, '生鲜8折券', 'DISCOUNT', 0, 80.00, 2000, 1950, '2026-10-01', '2026-12-31', 'ACTIVE');

INSERT IGNORE INTO s2b2c_flash_sale
(id,product_id,sale_price,original_price,start_time,end_time,total_stock,remain_stock,per_user_limit,status) VALUES
(1,1,58.00,68.00,'2026-10-20 00:00:00','2026-12-31 23:59:59',1000,620,2,'ACTIVE'),
(2,4,58.00,68.00,'2026-10-25 00:00:00','2026-12-31 23:59:59',300,168,2,'ACTIVE');

INSERT IGNORE INTO s2b2c_group_buy
(id,name,product_id,single_price,group_price,leader_price,group_size,per_user_limit,valid_hours,start_time,end_time,status) VALUES
(1,'五常大米邻里团',1,68.00,58.00,55.00,3,3,24,'2026-10-20 00:00:00','2026-12-31 23:59:59','ACTIVE'),
(2,'阳光玫瑰亲友团',4,68.00,55.00,52.00,5,2,48,'2026-10-20 00:00:00','2026-12-31 23:59:59','ACTIVE');

INSERT IGNORE INTO s2b2c_traceability
(id,product_id,batch_code,origin,planting_date,harvest_date,processing_info,quality_report,storage_info) VALUES
(1,1,'WUCHANG-2026-001','黑龙江五常核心产区','2026-04-12','2026-09-28','低温烘干、色选、真空分装','农残与重金属检测合格','恒温仓储 18℃'),
(2,4,'YUNNAN-GRAPE-2026-01','云南宾川葡萄基地','2026-03-10','2026-10-18','采后预冷、分级装箱','糖度与农残检测合格','冷链运输 2-8℃');

-- ── 消费者域：收藏 / 足迹 / 评价 / 签到 / 积分流水 ──────────────────────
-- 说明：这几张是消费者端独有的关系表，供应商端、商家端、运营端不读取，故不改动既有表结构。

CREATE TABLE IF NOT EXISTS s2b2c_favorite (
    id BIGINT PRIMARY KEY,
    consumer_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_fav (consumer_id, product_id)
);

-- 足迹：同一消费者同商品只保留一行，重复访问刷新 update_time，按 update_time 倒序展示
CREATE TABLE IF NOT EXISTS s2b2c_footprint (
    id BIGINT PRIMARY KEY,
    consumer_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_fp (consumer_id, product_id)
);

-- 评价：consumer + order + product 唯一，避免同一订单商品重复评价
CREATE TABLE IF NOT EXISTS s2b2c_review (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    order_item_id BIGINT,
    product_id BIGINT NOT NULL,
    consumer_id BIGINT NOT NULL,
    rating INT NOT NULL,
    content TEXT,
    tags VARCHAR(200),
    images TEXT,
    anonymous BOOLEAN DEFAULT FALSE,
    reply VARCHAR(1000),
    reply_time TIMESTAMP NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_review (consumer_id, order_id, product_id)
);

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_review ADD COLUMN reply_by VARCHAR(20) NULL COMMENT ''SUPPLIER/CHANNEL''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_review' AND COLUMN_NAME = 'reply_by'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_review ADD COLUMN hidden BOOLEAN DEFAULT FALSE',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_review' AND COLUMN_NAME = 'hidden'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS s2b2c_sign_in (
    id BIGINT PRIMARY KEY,
    consumer_id BIGINT NOT NULL,
    sign_date DATE NOT NULL,
    points INT DEFAULT 5,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sign (consumer_id, sign_date)
);

CREATE TABLE IF NOT EXISTS s2b2c_points_log (
    id BIGINT PRIMARY KEY,
    consumer_id BIGINT NOT NULL,
    type VARCHAR(20),
    reason VARCHAR(200),
    points INT,
    balance INT,
    order_id BIGINT NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 拼团：活动配置（s2b2c_group_buy）之外的「这一团」 ─────────────────────────
-- group_buy 是活动模板（价格、成团人数、有效期）；group_instance 是一次真实的开团，
-- 有人参团就 joined_count+1，满员置 SUCCESS，到期未满置 FAILED（退款由运营端处理）。
CREATE TABLE IF NOT EXISTS s2b2c_group_instance (
    id BIGINT PRIMARY KEY,
    group_buy_id BIGINT NOT NULL,
    leader_consumer_id BIGINT NOT NULL,
    required_size INT NOT NULL DEFAULT 2,
    joined_count INT NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    expire_time TIMESTAMP NOT NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 参团记录表沿用 s2b2c_group_buy_order（原名即「团购订单关联」），补齐三个必要列：
-- instance_id=哪一团，consumer_id=谁参的，role=LEADER/MEMBER。
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_group_buy_order ADD COLUMN instance_id BIGINT NULL COMMENT ''团实例ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_group_buy_order' AND COLUMN_NAME = 'instance_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_group_buy_order ADD COLUMN consumer_id BIGINT NULL COMMENT ''参团消费者ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_group_buy_order' AND COLUMN_NAME = 'consumer_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_group_buy_order ADD COLUMN role VARCHAR(10) DEFAULT ''MEMBER'' COMMENT ''LEADER=团长''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_group_buy_order' AND COLUMN_NAME = 'role'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_group_buy_order ADD INDEX idx_gbo_instance (instance_id)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_group_buy_order' AND INDEX_NAME = 'idx_gbo_instance'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 订单要能反查自己属于哪个团（订单列表/详情据此显示「拼团」标）
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_order ADD COLUMN group_buy_id BIGINT NULL COMMENT ''拼团活动ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order' AND COLUMN_NAME = 'group_buy_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_order ADD COLUMN group_instance_id BIGINT NULL COMMENT ''团实例ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order' AND COLUMN_NAME = 'group_instance_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 风控规则（只读计算信号 + 人工复核；不做自动拦截/处置）
CREATE TABLE IF NOT EXISTS s2b2c_risk_rule (
    code VARCHAR(40) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    threshold DECIMAL(18,2) NOT NULL,
    unit VARCHAR(20),
    level VARCHAR(20) DEFAULT 'MEDIUM',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    action_note VARCHAR(200),
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO s2b2c_risk_rule (code, name, threshold, unit, level, status, action_note) VALUES
('HIGH_REFUND_BUYER', '买家 30 天已同意售后单数', 3, '单', 'HIGH', 'ACTIVE', '人工复核售后凭证后决定是否限制'),
('QUICK_REFUND', '支付后 X 分钟内申请售后', 5, '分钟', 'MEDIUM', 'ACTIVE', '核对物流签收与凭证时间'),
('CHANNEL_AFTER_SALE_RATE', '渠道 30 天售后率', 10, '%', 'HIGH', 'ACTIVE', '联系渠道核实并复盘履约'),
('LOW_PRICE', '渠道零售价低于供货价', 0, '元', 'MEDIUM', 'ACTIVE', '通知渠道调价，不自动下架');

-- 总部集采批次：平台发起、渠道报名；只登记需求与到货状态，不代支付/不生成采购合同
CREATE TABLE IF NOT EXISTS s2b2c_group_purchase (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    supplier_id BIGINT,
    title VARCHAR(200) NOT NULL,
    purchase_price DECIMAL(18,2) NOT NULL,
    min_quantity INT DEFAULT 0,
    target_quantity INT DEFAULT 0,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    warehouse VARCHAR(200),
    remark VARCHAR(500),
    status VARCHAR(20) DEFAULT 'OPEN',
    created_by VARCHAR(100),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS s2b2c_group_purchase_order (
    id BIGINT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'RESERVED',
    remark VARCHAR(500),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_batch_channel (batch_id, channel_id),
    KEY idx_batch (batch_id, status),
    KEY idx_channel (channel_id, status)
);

-- 商品分销准入审核留痕（只记录 S2B2C 审核动作，不改商品主数据字段）
CREATE TABLE IF NOT EXISTS s2b2c_product_audit_log (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL,
    opinion VARCHAR(500),
    operator VARCHAR(100),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_product (product_id)
);

-- 订单发货协同：一方提交物流，另一方确认后才置为已发货
CREATE TABLE IF NOT EXISTS s2b2c_order_shipment (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    proposer_type VARCHAR(20) NOT NULL,
    proposer_id BIGINT,
    logistics_no VARCHAR(100) NOT NULL,
    logistics_company VARCHAR(100),
    status VARCHAR(20) DEFAULT 'PROPOSED',
    reason VARCHAR(500),
    confirmed_by_type VARCHAR(20),
    confirmed_by_id BIGINT,
    confirmed_at TIMESTAMP NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_order (order_id, status)
);

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_order ADD COLUMN ship_confirm_status VARCHAR(20) DEFAULT ''NONE'' COMMENT ''NONE/PENDING/CONFIRMED/REJECTED''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order' AND COLUMN_NAME = 'ship_confirm_status'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_order ADD COLUMN ship_proposed_by VARCHAR(20) NULL COMMENT ''SUPPLIER/CHANNEL''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order' AND COLUMN_NAME = 'ship_proposed_by'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 订单优惠券归因：拆单后每个子单记录自己分摊到的券优惠
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_order ADD COLUMN coupon_user_id BIGINT NULL COMMENT ''使用的券记录ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order' AND COLUMN_NAME = 'coupon_user_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_order ADD COLUMN coupon_discount DECIMAL(18,2) DEFAULT 0 COMMENT ''子单分摊的券优惠''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order' AND COLUMN_NAME = 'coupon_discount'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_order ADD INDEX idx_coupon_user (coupon_user_id)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order' AND INDEX_NAME = 'idx_coupon_user'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 取消订单时用于回补拼团预算
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_order ADD COLUMN group_subsidy DECIMAL(18,2) DEFAULT 0 COMMENT ''拼团补贴金额''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order' AND COLUMN_NAME = 'group_subsidy'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 秒杀主键归因：取消时精确恢复秒杀库存与预算
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_order_item ADD COLUMN flash_sale_id BIGINT NULL COMMENT ''秒杀活动ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order_item' AND COLUMN_NAME = 'flash_sale_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_order_item ADD COLUMN flash_subsidy DECIMAL(18,2) DEFAULT 0 COMMENT ''秒杀补贴金额''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order_item' AND COLUMN_NAME = 'flash_subsidy'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 下单时的供货价快照：供应商收入按成交时价格计算，不受后续调价影响
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_order_item ADD COLUMN supply_price DECIMAL(18,2) NULL COMMENT ''下单时供货价快照''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order_item' AND COLUMN_NAME = 'supply_price'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 供应商 / 渠道站内通知（订单、发货协同等业务事件）
CREATE TABLE IF NOT EXISTS s2b2c_notice (
    id BIGINT PRIMARY KEY,
    recipient_type VARCHAR(20) NOT NULL,
    recipient_id BIGINT NOT NULL,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(200),
    content VARCHAR(500),
    ref_type VARCHAR(30),
    ref_id BIGINT,
    read_flag TINYINT DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_recipient (recipient_type, recipient_id, read_flag)
);

-- 通知偏好：无记录时默认开启
CREATE TABLE IF NOT EXISTS s2b2c_notice_preference (
    id BIGINT PRIMARY KEY,
    recipient_type VARCHAR(20) NOT NULL,
    recipient_id BIGINT NOT NULL,
    notice_type VARCHAR(40) NOT NULL,
    enabled TINYINT DEFAULT 1,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pref (recipient_type, recipient_id, notice_type)
);

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_product ADD COLUMN distribution_enabled TINYINT DEFAULT 1 COMMENT ''供应商是否允许渠道投放''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_product' AND COLUMN_NAME = 'distribution_enabled'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_product ADD COLUMN max_channels INT DEFAULT 0 COMMENT ''最大授权渠道数，0=不限''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_product' AND COLUMN_NAME = 'max_channels'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 渠道投放白名单（空=不限制）
CREATE TABLE IF NOT EXISTS s2b2c_distribution_whitelist (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_product_channel (product_id, channel_id),
    KEY idx_product (product_id)
);

-- 渠道投放限售区域（省级；空=全国不限）。匹配时忽略 省/市/自治区 等后缀
CREATE TABLE IF NOT EXISTS s2b2c_distribution_region (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    region_name VARCHAR(50) NOT NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_product_region (product_id, region_name),
    KEY idx_product (product_id)
);

-- 价盘巡检记录：每次自动下架留痕（手动/规则/商品更新/每日定时）
CREATE TABLE IF NOT EXISTS s2b2c_price_guard_log (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    product_name VARCHAR(200),
    supplier_id BIGINT NULL,
    channel_id BIGINT NOT NULL,
    relation_id BIGINT NULL,
    retail_price DECIMAL(18,2),
    floor_price DECIMAL(18,2),
    action VARCHAR(30) DEFAULT 'AUTO_OFF_SHELF',
    trigger_source VARCHAR(20) DEFAULT 'MANUAL',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_product (product_id, create_time),
    KEY idx_channel (channel_id, create_time)
);

-- 供应商供货对账单：按已完成订单的供货价快照生成，只做对账确认，不含打款
CREATE TABLE IF NOT EXISTS s2b2c_supplier_statement (
    id BIGINT PRIMARY KEY,
    batch_no VARCHAR(40) NOT NULL,
    supplier_id BIGINT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    order_count INT NOT NULL DEFAULT 0,
    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'OPEN',
    supplier_remark VARCHAR(500),
    confirmed_at TIMESTAMP NULL,
    created_by VARCHAR(100),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_batch_no (batch_no),
    UNIQUE KEY uk_supplier_period (supplier_id, period_start, period_end),
    KEY idx_supplier (supplier_id, create_time)
);

CREATE TABLE IF NOT EXISTS s2b2c_supplier_statement_order (
    id BIGINT PRIMARY KEY,
    statement_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    order_no VARCHAR(50),
    supply_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    completed_at TIMESTAMP NULL,
    UNIQUE KEY uk_statement_order (statement_id, order_id),
    KEY idx_statement (statement_id)
);

-- 供应商分销商招募：邀请码 + 渠道入驻绑定
CREATE TABLE IF NOT EXISTS s2b2c_supplier_invite (
    id BIGINT PRIMARY KEY,
    supplier_id BIGINT NOT NULL,
    code VARCHAR(40) NOT NULL UNIQUE,
    channel_limit INT DEFAULT 0 COMMENT '0=不限',
    used_count INT DEFAULT 0,
    expire_at TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_supplier (supplier_id)
);

CREATE TABLE IF NOT EXISTS s2b2c_supplier_recruit (
    id BIGINT PRIMARY KEY,
    supplier_id BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    invite_code VARCHAR(40),
    status VARCHAR(20) DEFAULT 'PENDING',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_supplier_channel (supplier_id, channel_id),
    KEY idx_supplier (supplier_id, status)
);

-- 风控事件处置留痕（人工复核/忽略，不做自动拦截）
CREATE TABLE IF NOT EXISTS s2b2c_risk_event_action (
    id BIGINT PRIMARY KEY,
    event_key VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL,
    remark VARCHAR(500),
    operator VARCHAR(100),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_event_key (event_key)
);

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_product ADD COLUMN min_retail_price DECIMAL(18,2) NULL COMMENT ''渠道最低零售价''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_product' AND COLUMN_NAME = 'min_retail_price'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE s2b2c_product ADD COLUMN max_retail_price DECIMAL(18,2) NULL COMMENT ''渠道最高零售价''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_product' AND COLUMN_NAME = 'max_retail_price'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 订单来源批次快照：不根据当前商品回填历史订单。
SET @ddl := (
 SELECT IF(COUNT(*) = 0,
 'ALTER TABLE s2b2c_order_item ADD COLUMN prod_batch_no VARCHAR(100) NULL COMMENT ''下单来源批次快照''',
 'SELECT 1') FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's2b2c_order_item' AND COLUMN_NAME = 'prod_batch_no'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 每个销售单位一码，唯一约束防止一码分配给多个订单；不存生产事实副本。
CREATE TABLE IF NOT EXISTS s2b2c_order_trace_unit (
 trace_code VARCHAR(100) NOT NULL PRIMARY KEY,
 order_id BIGINT NOT NULL,
 order_item_id BIGINT NOT NULL,
 batch_no VARCHAR(100) NOT NULL,
 create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_trace_order(order_id, order_item_id)
);
