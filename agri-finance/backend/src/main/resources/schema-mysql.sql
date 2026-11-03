-- 存量 MySQL 库的补列（schema.sql 用 CREATE TABLE IF NOT EXISTS，已建好的表不会加新列）。
-- 本文件只写 MySQL 方言（information_schema + PREPARE），所以不放进 schema.sql ——
-- 那份同时给 H2 集成测试用，H2 不认 PREPARE，会让测试库直接起不来。
-- 通过 application-mysql.yml 的 spring.sql.init.schema-locations 追加加载。

-- 资金机构 ↔ 平台经营主体绑定：资金方登录身份从令牌解析，机构号不再由前端自报
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE fund_provider ADD COLUMN merchant_id VARCHAR(64) NULL COMMENT ''绑定的平台经营主体号''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fund_provider' AND COLUMN_NAME = 'merchant_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_fund_provider_merchant ON fund_provider (merchant_id)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fund_provider' AND INDEX_NAME = 'idx_fund_provider_merchant'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 合同 ↔ 融资申请：放款闸门要按申请核对合同是否已双方签署
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE contract ADD COLUMN application_id VARCHAR(64) NULL COMMENT ''关联融资申请号''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract' AND COLUMN_NAME = 'application_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_contract_application ON contract (application_id)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract' AND INDEX_NAME = 'idx_contract_application'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 逾期台账按「借款 + 期次」登记，定时扫描要累加天数而不是重复开台账
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE overdue_record ADD COLUMN period INT NULL COMMENT ''逾期期次''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'overdue_record' AND COLUMN_NAME = 'period'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 仓单要能追溯到生产域的采收批次与质押物字典（批次号是唯一锚点，仓单不可凭空录入）
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE warehouse_receipt ADD COLUMN batch_id VARCHAR(64) NULL COMMENT ''生产域批次ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warehouse_receipt' AND COLUMN_NAME = 'batch_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE warehouse_receipt ADD COLUMN batch_no VARCHAR(64) NULL COMMENT ''生产域批次号''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warehouse_receipt' AND COLUMN_NAME = 'batch_no'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE warehouse_receipt ADD COLUMN unit VARCHAR(32) NULL COMMENT ''计量单位''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warehouse_receipt' AND COLUMN_NAME = 'unit'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE warehouse_receipt ADD COLUMN trace_code VARCHAR(64) NULL COMMENT ''溯源码''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warehouse_receipt' AND COLUMN_NAME = 'trace_code'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE warehouse_receipt ADD COLUMN goods_code VARCHAR(64) NULL COMMENT ''质押物字典编码''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warehouse_receipt' AND COLUMN_NAME = 'goods_code'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE warehouse_receipt ADD COLUMN farm_id VARCHAR(64) NULL COMMENT ''生产域农场ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warehouse_receipt' AND COLUMN_NAME = 'farm_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE warehouse_receipt ADD COLUMN plot_id VARCHAR(64) NULL COMMENT ''生产域地块ID''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warehouse_receipt' AND COLUMN_NAME = 'plot_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE warehouse_receipt ADD COLUMN user_id VARCHAR(64) NULL COMMENT ''仓单归属融资主体''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warehouse_receipt' AND COLUMN_NAME = 'user_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 一个批次只能有一张未释放的仓单，否则同一批货能重复质押
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_receipt_batch_status ON warehouse_receipt (batch_no, status)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warehouse_receipt' AND INDEX_NAME = 'idx_receipt_batch_status'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 质押要与借款对应，结清才谈得上自动释放质押物与仓单
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE pledge ADD COLUMN receipt_id VARCHAR(64) NULL COMMENT ''关联仓单''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pledge' AND COLUMN_NAME = 'receipt_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE pledge ADD COLUMN application_id VARCHAR(64) NULL COMMENT ''关联融资申请''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pledge' AND COLUMN_NAME = 'application_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE pledge ADD COLUMN loan_id VARCHAR(64) NULL COMMENT ''关联借款''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pledge' AND COLUMN_NAME = 'loan_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 存证哈希在生产侧是 VARCHAR(191)（SIMU+32 位或真实链 66 位），金融侧 128 会截断
SET @ddl := (
  SELECT IF(CHARACTER_MAXIMUM_LENGTH < 191,
    'ALTER TABLE warehouse_receipt MODIFY COLUMN blockchain_hash VARCHAR(191) NULL COMMENT ''区块链存证交易哈希''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warehouse_receipt' AND COLUMN_NAME = 'blockchain_hash'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 仓储读数快照要写清"读数来自哪台设备、是不是这个批次的传感器"，否则页面上的温度没有出处
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE pledge_monitor ADD COLUMN device_code VARCHAR(64) NULL COMMENT ''读数来源设备编码''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pledge_monitor' AND COLUMN_NAME = 'device_code'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE pledge_monitor ADD COLUMN device_note VARCHAR(255) NULL COMMENT ''读数口径说明''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pledge_monitor' AND COLUMN_NAME = 'device_note'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
