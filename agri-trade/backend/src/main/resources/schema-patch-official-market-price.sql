CREATE TABLE IF NOT EXISTS agri_trade_official_price_batch (
 id VARCHAR(36) PRIMARY KEY, provider VARCHAR(64) NOT NULL, source_url VARCHAR(512) NOT NULL,
 content_hash VARCHAR(64) NULL, status VARCHAR(24) NOT NULL, report_date DATE NULL,
 parsed_count INT NOT NULL DEFAULT 0, skipped_count INT NOT NULL DEFAULT 0,
 raw_html LONGTEXT NULL, error_message VARCHAR(500) NULL, operator VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL, UNIQUE KEY uk_official_report(provider,content_hash),
 KEY idx_official_batch(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS agri_trade_official_price_quote (
 id VARCHAR(36) PRIMARY KEY, batch_id VARCHAR(36) NOT NULL, crop_name VARCHAR(128) NOT NULL,
 source_name VARCHAR(128) NOT NULL, specification VARCHAR(191) NOT NULL, market_name VARCHAR(191) NOT NULL,
 region_name VARCHAR(128) NOT NULL, quote_date DATE NOT NULL, price_kg DECIMAL(18,4) NOT NULL,
 original_price DECIMAL(18,4) NOT NULL, original_unit VARCHAR(32) NOT NULL,
 source_url VARCHAR(512) NOT NULL, created_at DATETIME NOT NULL,
 UNIQUE KEY uk_official_quote(batch_id,source_name,specification),
 KEY idx_official_crop(crop_name,quote_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
