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

CREATE TABLE IF NOT EXISTS s2b2c_shop (
    id BIGINT PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    owner_type VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    logo VARCHAR(500),
    desc VARCHAR(1000),
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

INSERT INTO s2b2c_category (id, parent_id, name, icon, sort_order, level) VALUES
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

INSERT INTO s2b2c_supplier (id, company_name, credit_code, industry, province, city, district, address, legal_name, legal_id_card, contact_phone, bank_name, bank_account, shop_name, audit_status, status) VALUES
(1, '五常大米专营有限公司', '91230100MA1BCDEF12', '种植业', '黑龙江省', '哈尔滨市', '五常市', '五常镇XX路XX号', '张五常', '230100198001011234', '13800138001', '中国工商银行', '6222021234567890123', '五常大米旗舰店', 'APPROVED', 'ACTIVE'),
(2, '云南有机农业合作社', '91530100MA2BCDEF34', '种植业', '云南省', '昆明市', '五华区', 'XX街道XX号', '李云南', '530100197802022345', '13900139002', '中国农业银行', '6228481234567890123', '云南有机馆', 'APPROVED', 'ACTIVE'),
(3, '黄山毛峰茶业公司', '91340100MA3BCDEF56', '茶业', '安徽省', '黄山市', '徽州区', 'XX乡XX村', '王黄山', '340100198203033456', '13700137003', '中国建设银行', '6227001234567890123', '黄山茶庄', 'PENDING', 'ACTIVE');

INSERT INTO s2b2c_product (id, supplier_id, category_id, name, selling_point, origin, grade, spec, unit, price, original_price, cost_price, stock, commission_rate, images, certifications, status, sales) VALUES
(1, 1, 7, '有机五常大米 5kg袋装', '精选五常核心产区，有机种植，颗粒饱满', '黑龙江五常', '一级', '5kg/袋', '袋', 68.00, 98.00, 52.00, 1000, 10.00, '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=organic%20rice%205kg%20bag%20premium%20quality&image_size=square\"]', '[\"有机认证\"]', 'APPROVED', 520),
(2, 1, 7, '有机五常大米 10kg袋装', '家庭装，实惠之选', '黑龙江五常', '一级', '10kg/袋', '袋', 128.00, 188.00, 98.00, 500, 10.00, '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=organic%20rice%2010kg%20bag%20bulk&image_size=square\"]', '[\"有机认证\"]', 'APPROVED', 234),
(3, 2, 16, '土鸡蛋30枚装', '农家散养，营养丰富', '云南昆明', '特级', '30枚/盒', '盒', 38.00, 58.00, 28.00, 800, 8.00, '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=fresh%20farm%20eggs%2030%20pieces%20organic&image_size=square\"]', '[\"绿色食品\"]', 'APPROVED', 386),
(4, 2, 12, '阳光玫瑰葡萄5斤装', '无籽脆甜，果香浓郁', '云南宾川', '一级', '5斤/盒', '盒', 68.00, 98.00, 52.00, 300, 12.00, '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=green%20grape%205%20pounds%20premium%20fresh&image_size=square\"]', '[\"有机认证\"]', 'APPROVED', 187),
(5, 3, 17, '黄山毛峰特级250g', '明前特级，清香悠长', '安徽黄山', '特级', '250g/罐', '罐', 268.00, 388.00, 188.00, 100, 15.00, '[\"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=premium%20green%20tea%20250g%20can%20Chinese&image_size=square\"]', '[\"地理标志\"]', 'PENDING', 0);

INSERT INTO s2b2c_channel_partner (id, register_type, company_name, contact_name, contact_phone, shop_name, grade, audit_status, status) VALUES
(1, 'PERSONAL', '', '李四', '13800138004', '李四优选店', 'LEVEL_3', 'APPROVED', 'ACTIVE'),
(2, 'PERSONAL', '', '王五', '13900139005', '王五生鲜馆', 'LEVEL_2', 'APPROVED', 'ACTIVE'),
(3, 'ENTERPRISE', '钱氏农业科技有限公司', '钱七', '13700137006', '钱七特产店', 'LEVEL_3', 'PENDING', 'ACTIVE');

INSERT INTO s2b2c_consumer (id, nickname, phone, avatar, province, city) VALUES
(1, '张三', '13800138007', '', '浙江省', '杭州市'),
(2, '赵六', '13900139008', '', '广东省', '深圳市'),
(3, '孙八', '13700137009', '', '江苏省', '南京市');

INSERT INTO s2b2c_address (id, consumer_id, name, phone, province, city, district, address, is_default) VALUES
(1, 1, '张三', '13800138007', '浙江省', '杭州市', '西湖区', '文三路XX号XX大厦1201室', TRUE),
(2, 1, '张三', '13800138007', '浙江省', '杭州市', '拱墅区', 'XX街道XX小区3栋502', FALSE),
(3, 2, '赵六', '13900139008', '广东省', '深圳市', '南山区', '科技园XX路XX号', TRUE);

INSERT INTO s2b2c_coupon (id, name, type, amount, min_amount, total_count, remain_count, valid_start, valid_end, status) VALUES
(1, '新人专享20元红包', 'FIXED', 20.00, 59.00, 1000, 985, '2025-01-01', '2025-12-31', 'ACTIVE'),
(2, '满100减10', 'FIXED', 10.00, 100.00, 5000, 4820, '2025-01-01', '2025-12-31', 'ACTIVE'),
(3, '生鲜8折券', 'DISCOUNT', 0, 80.00, 2000, 1950, '2025-01-01', '2025-01-31', 'ACTIVE');