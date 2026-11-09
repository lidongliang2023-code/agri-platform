-- 补丁：产销对接（生产侧）数据表。可重复执行。
--
-- 边界：生产端只存「可供事实」——品种→品类映射、供给意向、认购回写、差异工单；
-- 不存商品、价格、订单（这些归交易撮合）。
--
-- 跑法：mysql -uroot -proot --default-character-set=utf8mb4 agri_production < schema-patch-p2t.sql

CREATE TABLE IF NOT EXISTS agri_p2t_variety_map (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    crop_id BIGINT COMMENT '生产作物主数据 id',
    crop_code VARCHAR(64) COMMENT '作物编码（快照）',
    crop_name VARCHAR(191) NOT NULL COMMENT '生产品种/作物名',
    variety_name VARCHAR(191) COMMENT '具体品种，如 早熟紫皮',
    category_code VARCHAR(64) NOT NULL COMMENT '交易端品类码',
    category_name VARCHAR(191) COMMENT '交易端品类名',
    spec_standard VARCHAR(255) COMMENT '标准规格：包装/净重/装箱数',
    grade_rule VARCHAR(500) COMMENT '等级规则',
    main_origin VARCHAR(191) COMMENT '主产区',
    window_start VARCHAR(8) COMMENT '上市窗口起（MM-DD）',
    window_end VARCHAR(8) COMMENT '上市窗口止（MM-DD）',
    conversion_rate DECIMAL(10,4) DEFAULT 1.0000 COMMENT '计量折算系数（稻谷→大米 0.7）',
    status INT DEFAULT 1 COMMENT '1 生效 / 0 停用',
    version VARCHAR(32) DEFAULT 'MAP-2026-V1' COMMENT '映射版本，变更留快照',
    remark VARCHAR(500),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX idx_p2t_variety_tenant (tenant_id),
    INDEX idx_p2t_variety_crop (crop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_p2t_offer (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    offer_no VARCHAR(64) NOT NULL COMMENT '供给单号 OFFERyyyymmddNNN',
    batch_id BIGINT NOT NULL,
    batch_no VARCHAR(64) NOT NULL,
    crop_id BIGINT,
    crop_name VARCHAR(191),
    variety_name VARCHAR(191),
    category_code VARCHAR(64),
    category_name VARCHAR(191),
    farm_id BIGINT,
    farm_name VARCHAR(191),
    origin VARCHAR(191) COMMENT '产区展示串',
    unit VARCHAR(16) DEFAULT 'kg',
    available_qty DECIMAL(18,2) NOT NULL COMMENT '本次可供量（≤ 可上市量）',
    reserved_qty DECIMAL(18,2) DEFAULT 0 COMMENT '已认购（交易端回写累加）',
    min_order_qty DECIMAL(18,2) DEFAULT 0,
    delivery_type VARCHAR(32) COMMENT 'ORIGIN 产地自提 / WAREHOUSE 送到指定仓 / PLATFORM 平台统仓',
    window_start DATE,
    window_end DATE,
    grade_a_ratio DECIMAL(6,2) DEFAULT 0,
    grade_b_ratio DECIMAL(6,2) DEFAULT 0,
    grade_c_ratio DECIMAL(6,2) DEFAULT 0,
    quality_no VARCHAR(64) COMMENT '引用质检单号',
    quality_valid_until DATE,
    trace_code_seg VARCHAR(128),
    price_ref_min DECIMAL(18,2) COMMENT '内部参考价，不对外、不参与撮合',
    price_ref_max DECIMAL(18,2),
    audit_status VARCHAR(24) DEFAULT 'PENDING' COMMENT 'PENDING / APPROVED / REJECTED',
    audit_remark VARCHAR(500),
    audit_time DATETIME,
    auditor VARCHAR(64),
    trade_status VARCHAR(24) DEFAULT 'PENDING' COMMENT 'PENDING 待审核 / LISTED 已上架 / SOLD 已售罄 / CLOSED 已关闭',
    product_code VARCHAR(64) COMMENT '交易端建品后回写的 SPU 编码',
    product_name VARCHAR(191),
    listed_qty DECIMAL(18,2) COMMENT '交易端上架可售量',
    listed_price DECIMAL(18,2) COMMENT '交易端挂牌价（仅供链路展示，生产端不参与定价）',
    listed_time DATETIME,
    publish_time DATETIME,
    remark VARCHAR(500),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    UNIQUE KEY uk_p2t_offer_no (offer_no),
    INDEX idx_p2t_offer_tenant (tenant_id),
    INDEX idx_p2t_offer_batch (batch_id),
    INDEX idx_p2t_offer_status (audit_status, trade_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_p2t_subscription (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    offer_no VARCHAR(64) NOT NULL,
    batch_no VARCHAR(64),
    order_no VARCHAR(64) NOT NULL,
    buyer_name VARCHAR(191),
    buyer_type VARCHAR(32) COMMENT 'WHOLESALE / SUPERMARKET / PROCESSING / GROUP',
    qty DECIMAL(18,2) NOT NULL,
    grade VARCHAR(32),
    lock_from DATE,
    lock_to DATE,
    event_type VARCHAR(24) DEFAULT 'ORDER_PAID' COMMENT 'ORDER_PAID / ORDER_CANCELLED / RELEASED / SHORT_SHIPPED',
    writeback_status VARCHAR(16) DEFAULT 'SUCCESS' COMMENT 'SUCCESS / FAILED / RETRYING',
    writeback_message VARCHAR(500),
    idempotent_key VARCHAR(128) NOT NULL COMMENT 'orderNo + eventType',
    paid_at DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_p2t_subscription_idem (idempotent_key),
    INDEX idx_p2t_subscription_tenant (tenant_id),
    INDEX idx_p2t_subscription_offer (offer_no),
    INDEX idx_p2t_subscription_order (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_p2t_diff_ticket (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    ticket_no VARCHAR(64) NOT NULL,
    diff_type VARCHAR(24) NOT NULL COMMENT 'SHORT_SHIP / GRADE_DOWN / WINDOW_EXPIRED / OVERSELL',
    offer_no VARCHAR(64),
    order_no VARCHAR(64),
    diff_qty DECIMAL(18,2),
    discovered_at DATETIME,
    owner_side VARCHAR(16) DEFAULT 'PRODUCTION' COMMENT 'PRODUCTION / TRADE',
    status VARCHAR(24) DEFAULT 'PENDING' COMMENT 'PENDING / PROCESSING / CLOSED',
    handle_way VARCHAR(64),
    handle_remark VARCHAR(500),
    handle_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    UNIQUE KEY uk_p2t_diff_no (ticket_no),
    INDEX idx_p2t_diff_tenant (tenant_id),
    INDEX idx_p2t_diff_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 演示种子：把现有作物映射到交易端品类（可重复执行，已存在则忽略）。
INSERT IGNORE INTO agri_p2t_variety_map
    (tenant_id, crop_id, crop_code, crop_name, variety_name, category_code, category_name,
     spec_standard, grade_rule, main_origin, window_start, window_end, conversion_rate, status, version)
VALUES
    ('2001', 3, 'CROP-0003', '西红柿', '早熟粉果', 'vegetable', '蔬菜',
     '5kg 周转箱 · 4 箱/件', '一级 / 二级 / 等外（单果重 ≥180g 为一级）', '河南中牟', '05-01', '11-30', 1.0000, 1, 'MAP-2026-V1'),
    ('2001', 1, 'CROP-0001', '水稻', '黄金晴', 'grain_rice', '大米',
     '5kg 真空 · 4 袋/件', '一级 / 二级（整精米率 ≥60% 为一级）', '河南原阳', '10-01', '02-28', 0.7000, 1, 'MAP-2026-V1'),
    ('2001', 2, 'CROP-0002', '番茄', '红宝石', 'vegetable', '蔬菜',
     '10kg 纸箱 · 单层托盘', '一级 / 二级 / 等外（果径 80-85mm 为一级）', '河南灵宝', '06-01', '10-31', 1.0000, 1, 'MAP-2026-V1');
