-- 双边交易Agent只拥有委托、协商和审计；成交复用询价/报价/订单，履约读取原台账。
CREATE TABLE IF NOT EXISTS agri_trade_agent_mandate (
 id VARCHAR(36) PRIMARY KEY, role VARCHAR(8) NOT NULL, merchant_id BIGINT NOT NULL,
 ref_id BIGINT NOT NULL, target_price DECIMAL(18,4) NOT NULL, limit_price DECIMAL(18,4) NOT NULL,
 quantity DECIMAL(18,4) NOT NULL, freight DECIMAL(18,2) NOT NULL,
 max_rounds INT NOT NULL, delivery_date DATE NOT NULL, expires_at DATETIME NOT NULL,
 status VARCHAR(16) NOT NULL, policy_version VARCHAR(40) NOT NULL,
 created_by VARCHAR(191) NOT NULL, created_at DATETIME NOT NULL,
 KEY idx_agent_owner(merchant_id,role,status), KEY idx_agent_ref(role,ref_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS agri_trade_agent_session (
 id VARCHAR(36) PRIMARY KEY, buyer_mandate_id VARCHAR(36) NOT NULL, seller_mandate_id VARCHAR(36) NOT NULL,
 buyer_id BIGINT NOT NULL, seller_id BIGINT NOT NULL, demand_id BIGINT NOT NULL, product_id BIGINT NOT NULL,
 quantity DECIMAL(18,4) NOT NULL, unit VARCHAR(32) NOT NULL,
 agreed_price DECIMAL(18,4), freight DECIMAL(18,2) NOT NULL, delivery_date DATE NOT NULL,
 status VARCHAR(24) NOT NULL, revision INT NOT NULL DEFAULT 1, buyer_confirmed TINYINT NOT NULL DEFAULT 0,
 seller_confirmed TINYINT NOT NULL DEFAULT 0, quote_id BIGINT, order_id BIGINT,
 public_snapshot LONGTEXT NOT NULL, expires_at DATETIME NOT NULL,
 created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
 UNIQUE KEY uk_agent_pair(buyer_mandate_id,seller_mandate_id),
 KEY idx_agent_session_buyer(buyer_id,created_at), KEY idx_agent_session_seller(seller_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS agri_trade_agent_event (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, session_id VARCHAR(36) NOT NULL,
 event_type VARCHAR(40) NOT NULL, actor VARCHAR(191) NOT NULL, detail_json LONGTEXT NOT NULL,
 created_at DATETIME NOT NULL, KEY idx_agent_event(session_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
