-- 补丁：产销对接（交易侧）。
--
-- 边界：交易端只做审核、建品、定价、接单与回写；产量/可上市量/等级归生产端，交易端只读。
--
-- 跑法：mysql -uroot -proot --default-character-set=utf8mb4 agri_trade < schema-patch-p2t.sql

-- 商品增加「来源供给」两个字段（双向索引：商品能查批次，批次能查商品）
SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE agri_trade_product ADD COLUMN source_offer_no VARCHAR(64) NULL COMMENT ''来源供给单号''',
    'SELECT 1')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_trade_product' AND COLUMN_NAME = 'source_offer_no');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE agri_trade_product ADD COLUMN source_offer_qty DECIMAL(18,2) NULL COMMENT ''来源供给量''',
    'SELECT 1')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_trade_product' AND COLUMN_NAME = 'source_offer_qty');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 订单增加回写状态：回写与订单状态是两个独立维度
SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE agri_trade_order ADD COLUMN source_offer_no VARCHAR(64) NULL COMMENT ''来源供给单号''',
    'SELECT 1')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_trade_order' AND COLUMN_NAME = 'source_offer_no');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE agri_trade_order ADD COLUMN p2t_writeback_status VARCHAR(16) NULL COMMENT ''SUCCESS / FAILED / RETRYING''',
    'SELECT 1')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_trade_order' AND COLUMN_NAME = 'p2t_writeback_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE agri_trade_order ADD COLUMN p2t_writeback_message VARCHAR(500) NULL COMMENT ''回写结果说明''',
    'SELECT 1')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_trade_order' AND COLUMN_NAME = 'p2t_writeback_message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE agri_trade_order ADD COLUMN p2t_writeback_time DATETIME NULL COMMENT ''最近回写时间''',
    'SELECT 1')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_trade_order' AND COLUMN_NAME = 'p2t_writeback_time');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS agri_trade_p2t_rule (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    rule_code VARCHAR(64) NOT NULL,
    rule_name VARCHAR(191),
    rule_json TEXT COMMENT '规则内容 JSON',
    version VARCHAR(32) DEFAULT 'RULE-P2T-V4',
    status INT DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_p2t_rule_code (rule_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO agri_trade_p2t_rule (rule_code, rule_name, rule_json, version, status)
VALUES
    ('AUDIT', '审核规则',
     '{"autoPassMaxQty":20,"slaHours":4,"escalateHours":12,"qualityFreshDays":7,"qualityProcessedDays":30,"partialPass":true}',
     'RULE-P2T-V4', 1),
    ('LISTING', '建品规则',
     '{"minPriceFloorPercent":8,"titleAuto":true,"tracePublic":true,"channels":["HALL","MALL","S2B2C","DIRECT"]}',
     'RULE-P2T-V4', 1),
    ('WRITEBACK', '回写规则',
     '{"retry":[1,5,15,60],"idempotent":"orderNo+eventType","timeoutSeconds":30,"dailyReconAt":"02:00"}',
     'RULE-P2T-V4', 1);
