-- =====================================================================
-- core-platform V1 初始结构
-- 纪律：表归属唯一，以表前缀区分模块（platform_ / trade_ / prod_ / svc_），
--       物理上就写不出跨模块 JOIN（ADR-001 纪律 2，ArchUnit 门禁校验实体前缀）。
--       核心实体携带 market_id（ADR-005 Day 1 内建）；tenant_id 预留默认 0。
-- =====================================================================

-- ------------------------------------------------ 平台域 platform_（主数据四统一，ADR-004）

CREATE TABLE platform_market (
    id         BIGINT       PRIMARY KEY,
    code       VARCHAR(32)  NOT NULL,
    name       VARCHAR(64)  NOT NULL,
    status     TINYINT      NOT NULL DEFAULT 1 COMMENT '1=营业中 0=停业',
    created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_market_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '市场（三大市场多业态）';

CREATE TABLE platform_user (
    id         BIGINT       PRIMARY KEY,
    username   VARCHAR(64)  NOT NULL,
    password   VARCHAR(100) NOT NULL,
    nickname   VARCHAR(64),
    phone      VARCHAR(20),
    status     TINYINT      NOT NULL DEFAULT 1 COMMENT '1=启用 0=禁用',
    created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted    TINYINT      NOT NULL DEFAULT 0,
    UNIQUE KEY uk_user_username (username)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '统一用户（全局表，无 market_id）';

CREATE TABLE platform_role (
    id          BIGINT        PRIMARY KEY,
    code        VARCHAR(32)   NOT NULL,
    name        VARCHAR(64)   NOT NULL,
    permissions VARCHAR(1000) COMMENT '权限码 JSON 数组',
    created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '角色（全局表）';

CREATE TABLE platform_user_role (
    id        BIGINT PRIMARY KEY,
    user_id   BIGINT NOT NULL,
    role_id   BIGINT NOT NULL,
    market_id BIGINT NOT NULL,
    KEY idx_ur_user (user_id),
    KEY idx_ur_market (market_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '用户×角色×市场绑定（权限模型四维）';

CREATE TABLE platform_category (
    id         BIGINT      PRIMARY KEY,
    market_id  BIGINT      NOT NULL DEFAULT 0,
    tenant_id  BIGINT      NOT NULL DEFAULT 0,
    parent_id  BIGINT      NOT NULL DEFAULT 0,
    code       VARCHAR(32),
    name       VARCHAR(64),
    level      INT,
    created_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted    TINYINT     NOT NULL DEFAULT 0,
    KEY idx_cat_market (market_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '统一商品类目';

CREATE TABLE platform_product (
    id         BIGINT         PRIMARY KEY,
    market_id  BIGINT         NOT NULL DEFAULT 0,
    tenant_id  BIGINT         NOT NULL DEFAULT 0,
    category_id BIGINT,
    merchant_id BIGINT,
    code       VARCHAR(32),
    name       VARCHAR(128)   NOT NULL,
    spec       VARCHAR(64),
    unit       VARCHAR(16),
    price      DECIMAL(18, 2),
    stock      DECIMAL(18, 2) DEFAULT 0,
    trace_code VARCHAR(64) COMMENT '溯源码（生产域事件后挂载）',
    status     TINYINT        DEFAULT 1 COMMENT '1=在售 0=下架',
    created_at DATETIME       DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted    TINYINT        NOT NULL DEFAULT 0,
    KEY idx_prod_market (market_id),
    KEY idx_prod_name (name)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '统一商品';

CREATE TABLE platform_merchant (
    id            BIGINT      PRIMARY KEY,
    market_id     BIGINT      NOT NULL DEFAULT 0,
    tenant_id     BIGINT      NOT NULL DEFAULT 0,
    code          VARCHAR(32),
    name          VARCHAR(128) NOT NULL,
    type          VARCHAR(16) COMMENT 'CUSTOMER/SUPPLIER/BOTH',
    credit_code   VARCHAR(64),
    contact_name  VARCHAR(32),
    contact_phone VARCHAR(20),
    status        TINYINT     DEFAULT 1,
    created_at    DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted       TINYINT     NOT NULL DEFAULT 0,
    KEY idx_mch_market (market_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '客商（客户供应商统一）';

CREATE TABLE platform_message (
    id         BIGINT       PRIMARY KEY,
    market_id  BIGINT       NOT NULL DEFAULT 0,
    tenant_id  BIGINT       NOT NULL DEFAULT 0,
    user_id    BIGINT       NOT NULL,
    title      VARCHAR(128),
    content    TEXT,
    read_flag  TINYINT      DEFAULT 0,
    created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted    TINYINT      NOT NULL DEFAULT 0,
    KEY idx_msg_user (user_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '站点内信（消息中心）';

-- 本地消息表（ADR-003）：与业务同事务写入，OutboxRelay 异步投递
CREATE TABLE platform_outbox_message (
    id            BIGINT      PRIMARY KEY,
    event_type    VARCHAR(64) NOT NULL,
    event_key     VARCHAR(64),
    payload       JSON,
    market_id     BIGINT,
    tenant_id     BIGINT,
    status        TINYINT     NOT NULL DEFAULT 0 COMMENT '0=待投递 1=已投递 2=死信',
    retry_count   INT         NOT NULL DEFAULT 0,
    next_retry_at DATETIME,
    created_at    DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_outbox_status (status, next_retry_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '本地消息表';

-- 消费幂等表（消费端幂等，ADR-003）
CREATE TABLE platform_consumed_event (
    id             BIGINT      PRIMARY KEY,
    consumer_group VARCHAR(64) NOT NULL,
    topic          VARCHAR(64) NOT NULL,
    event_key      VARCHAR(64) NOT NULL,
    consumed_at    DATETIME    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_consumed (consumer_group, topic, event_key)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '事件消费幂等';

-- ------------------------------------------------ 交易域 trade_（撮合交易 B2B 大宗 MVP）

CREATE TABLE trade_listing (
    id           BIGINT         PRIMARY KEY,
    market_id    BIGINT         NOT NULL DEFAULT 0,
    tenant_id    BIGINT         NOT NULL DEFAULT 0,
    listing_no   VARCHAR(32),
    type         VARCHAR(8)     NOT NULL COMMENT 'SELL=供货 BUY=求购',
    merchant_id  BIGINT         NOT NULL,
    product_id   BIGINT         NOT NULL,
    product_name VARCHAR(128),
    quantity     DECIMAL(18, 2) NOT NULL,
    price        DECIMAL(18, 2) NOT NULL,
    status       VARCHAR(16)    NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN/MATCHED/CLOSED',
    created_at   DATETIME       DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted      TINYINT        NOT NULL DEFAULT 0,
    KEY idx_listing_market (market_id),
    KEY idx_listing_product (product_id),
    KEY idx_listing_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '挂牌（撮合交易）';

CREATE TABLE trade_order (
    id                 BIGINT         PRIMARY KEY,
    market_id          BIGINT         NOT NULL DEFAULT 0,
    tenant_id          BIGINT         NOT NULL DEFAULT 0,
    order_no           VARCHAR(32)    NOT NULL,
    listing_id         BIGINT,
    buyer_merchant_id  BIGINT         NOT NULL,
    seller_merchant_id BIGINT         NOT NULL,
    product_id         BIGINT         NOT NULL,
    product_name       VARCHAR(128),
    quantity           DECIMAL(18, 2) NOT NULL,
    unit_price         DECIMAL(18, 2) NOT NULL,
    amount             DECIMAL(18, 2) NOT NULL,
    status             VARCHAR(16)    NOT NULL DEFAULT 'CREATED' COMMENT 'CREATED/PAID/SETTLED/CANCELLED',
    pay_no             VARCHAR(64),
    trace_code         VARCHAR(64),
    paid_at            DATETIME,
    settled_at         DATETIME,
    created_at         DATETIME       DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted            TINYINT        NOT NULL DEFAULT 0,
    UNIQUE KEY uk_order_no (order_no),
    KEY idx_order_market (market_id),
    KEY idx_order_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '交易订单';

-- ------------------------------------------------ 生产域 prod_（批次 / 溯源 / 质检 / 设备档案）

CREATE TABLE prod_plot (
    id         BIGINT         PRIMARY KEY,
    market_id  BIGINT         NOT NULL DEFAULT 0,
    tenant_id  BIGINT         NOT NULL DEFAULT 0,
    code       VARCHAR(32),
    name       VARCHAR(64)    NOT NULL,
    area_mu    DECIMAL(10, 2),
    location   VARCHAR(255),
    status     TINYINT        DEFAULT 1,
    created_at DATETIME       DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted    TINYINT        NOT NULL DEFAULT 0,
    KEY idx_plot_market (market_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '地块/棚';

CREATE TABLE prod_device (
    id         BIGINT      PRIMARY KEY,
    market_id  BIGINT      NOT NULL DEFAULT 0,
    tenant_id  BIGINT      NOT NULL DEFAULT 0,
    device_no  VARCHAR(32) NOT NULL,
    name       VARCHAR(64),
    type       VARCHAR(16) COMMENT 'SENSOR/CONTROLLER/CAMERA',
    plot_id    BIGINT,
    status     TINYINT     DEFAULT 0 COMMENT '1=在线 0=离线',
    created_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted    TINYINT     NOT NULL DEFAULT 0,
    KEY idx_device_no (device_no)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '设备档案（连接与采集在 satellite-iot）';

CREATE TABLE prod_batch (
    id         BIGINT         PRIMARY KEY,
    market_id  BIGINT         NOT NULL DEFAULT 0,
    tenant_id  BIGINT         NOT NULL DEFAULT 0,
    batch_code VARCHAR(32)    NOT NULL,
    plot_id    BIGINT,
    product_id BIGINT,
    quantity   DECIMAL(18, 2),
    status     VARCHAR(16)    NOT NULL DEFAULT 'GROWING' COMMENT 'GROWING/HARVESTED/CLOSED',
    harvest_at DATETIME,
    created_at DATETIME       DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted    TINYINT        NOT NULL DEFAULT 0,
    UNIQUE KEY uk_batch_code (batch_code),
    KEY idx_batch_market (market_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '农事批次';

CREATE TABLE prod_trace_code (
    id         BIGINT      PRIMARY KEY,
    market_id  BIGINT      NOT NULL DEFAULT 0,
    tenant_id  BIGINT      NOT NULL DEFAULT 0,
    batch_id   BIGINT      NOT NULL,
    code       VARCHAR(64) NOT NULL,
    status     VARCHAR(16) DEFAULT 'ACTIVE',
    created_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted    TINYINT     NOT NULL DEFAULT 0,
    UNIQUE KEY uk_trace_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '溯源码（一物一码）';

CREATE TABLE prod_quality_report (
    id         BIGINT      PRIMARY KEY,
    market_id  BIGINT      NOT NULL DEFAULT 0,
    tenant_id  BIGINT      NOT NULL DEFAULT 0,
    batch_id   BIGINT      NOT NULL,
    report_no  VARCHAR(32) NOT NULL,
    item       VARCHAR(64),
    result     VARCHAR(8)  COMMENT 'PASS/FAIL',
    tested_at  DATETIME,
    created_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted    TINYINT     NOT NULL DEFAULT 0,
    KEY idx_qr_batch (batch_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '质量检测报告';

CREATE TABLE prod_iot_alert (
    id         BIGINT         PRIMARY KEY,
    market_id  BIGINT         NOT NULL DEFAULT 0,
    tenant_id  BIGINT         NOT NULL DEFAULT 0,
    device_no  VARCHAR(32),
    metric     VARCHAR(32),
    value      DECIMAL(18, 2),
    threshold  DECIMAL(18, 2),
    level      VARCHAR(8) COMMENT 'INFO/WARN/CRITICAL',
    message    VARCHAR(255),
    created_at DATETIME       DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted    TINYINT        NOT NULL DEFAULT 0,
    KEY idx_alert_device (device_no)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = 'IoT 预警台账（消费自卫星服务事件）';

-- ------------------------------------------------ 服务域 svc_（行情资讯 v1）

CREATE TABLE svc_quote (
    id           BIGINT         PRIMARY KEY,
    market_id    BIGINT         NOT NULL DEFAULT 0,
    tenant_id    BIGINT         NOT NULL DEFAULT 0,
    product_name VARCHAR(128)   NOT NULL,
    category     VARCHAR(64),
    price        DECIMAL(18, 2) NOT NULL,
    change_pct   DECIMAL(8, 2),
    source       VARCHAR(32),
    quoted_at    DATETIME,
    created_at   DATETIME       DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted      TINYINT        NOT NULL DEFAULT 0,
    KEY idx_quote_name (product_name)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '行情报价';

CREATE TABLE svc_news (
    id           BIGINT      PRIMARY KEY,
    market_id    BIGINT      NOT NULL DEFAULT 0,
    tenant_id    BIGINT      NOT NULL DEFAULT 0,
    title        VARCHAR(128) NOT NULL,
    summary      VARCHAR(255),
    content      TEXT,
    published_at DATETIME,
    created_at   DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted      TINYINT     NOT NULL DEFAULT 0,
    KEY idx_news_market (market_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '资讯';

-- =====================================================================
-- 种子数据（市场/角色/类目/客商/商品/行情/地块/批次/挂牌；管理员账号由首启引导创建）
-- =====================================================================

INSERT INTO platform_market (id, code, name, status) VALUES
    (1, 'M-HN', '华南农产品中心市场', 1),
    (2, 'M-HD', '华东农产品中心市场', 1),
    (3, 'M-XB', '西北农产品产地市场', 1);

INSERT INTO platform_role (id, code, name, permissions) VALUES
    (1, 'SUPER_ADMIN', '超级管理员', '["*"]'),
    (2, 'MARKET_OPS', '市场运营', '["trade:read","trade:write","produce:read","produce:write","quote:read","quote:write"]');

INSERT INTO platform_category (id, market_id, parent_id, code, name, level) VALUES
    (1001, 1, 0, 'C-FRUIT', '水果', 1),
    (1002, 1, 0, 'C-VEG', '蔬菜', 1);

INSERT INTO platform_merchant (id, market_id, code, name, type, credit_code, contact_name, contact_phone, status) VALUES
    (2001, 1, 'M20260001', '绿源农业合作社', 'BOTH', '91440300MA5XXXXX0X', '李绿源', '13800000000', 1);

INSERT INTO platform_product (id, market_id, category_id, merchant_id, code, name, spec, unit, price, stock, status) VALUES
    (3001, 1, 1001, 2001, 'P20260001', '红富士苹果', '一级 80#', 'kg', 6.50, 10000, 1);

INSERT INTO svc_quote (id, market_id, product_name, category, price, change_pct, source, quoted_at) VALUES
    (4001, 1, '红富士苹果', '水果', 6.48, 1.20, '产地批发', NOW());

INSERT INTO prod_plot (id, market_id, code, name, area_mu, location, status) VALUES
    (5001, 1, 'GT-A01', '1号智能大棚', 2.50, '基地东区', 1);

INSERT INTO prod_batch (id, market_id, batch_code, plot_id, product_id, quantity, status) VALUES
    (6001, 1, 'PH20260901001', 5001, 3001, 5000, 'GROWING');

INSERT INTO trade_listing (id, market_id, listing_no, type, merchant_id, product_id, product_name, quantity, price, status) VALUES
    (7001, 1, 'LP20260901001', 'SELL', 2001, 3001, '红富士苹果', 5000, 6.50, 'OPEN');
