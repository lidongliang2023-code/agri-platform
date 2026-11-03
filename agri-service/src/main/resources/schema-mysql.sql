-- ============================================================================
-- 综合服务 · MySQL 方言增量（只在已有库上补列、补索引、回填历史行）
--
-- 与 schema.sql 的分工：schema.sql 是"全新环境一次建对"的基线（H2 与 MySQL 共用），
-- 这个文件只解决"库已经跑着、列后加了"的情形，全部写成幂等判断，可重复执行。
--
-- 回填口径与 data.sql 保持一致：
--   2001 绿源农业合作社（需求方 A） / 2003 陕西洛川果业（需求方 B）
-- 只有 merchant_id 为空的行才回填，避免覆盖测试期间真实写入的归属。
-- ============================================================================

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE service_provider ADD COLUMN merchant_id BIGINT NULL COMMENT ''绑定平台经营主体（服务商工作台由此认身份）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_provider' AND COLUMN_NAME = 'merchant_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE insurance_product
       ADD COLUMN premium_rate DECIMAL(10,2) DEFAULT 0 COMMENT ''单位保费（按 unit_measure）'',
       ADD COLUMN coverage_per_mu DECIMAL(12,2) DEFAULT 0 COMMENT ''单位保额'',
       ADD COLUMN unit_measure VARCHAR(20) DEFAULT ''亩'' COMMENT ''计价单位''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'insurance_product' AND COLUMN_NAME = 'premium_rate'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 私域主体列
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE service_order
       ADD COLUMN merchant_id BIGINT NULL COMMENT ''下单主体（平台经营主体号）'',
       ADD COLUMN merchant_name VARCHAR(120) NULL COMMENT ''下单主体名称快照''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_order' AND COLUMN_NAME = 'merchant_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE service_demand
       ADD COLUMN merchant_id BIGINT NULL COMMENT ''发布需求的主体'',
       ADD COLUMN merchant_name VARCHAR(120) NULL COMMENT ''主体名称快照''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_demand' AND COLUMN_NAME = 'merchant_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE service_message
       ADD COLUMN merchant_id BIGINT NULL COMMENT ''收件主体'',
       ADD COLUMN merchant_name VARCHAR(120) NULL COMMENT ''收件主体名称'',
       ADD COLUMN biz_type VARCHAR(40) NULL COMMENT ''关联业务类型'',
       ADD COLUMN biz_no VARCHAR(40) NULL COMMENT ''关联业务单号''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_message' AND COLUMN_NAME = 'merchant_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE service_complaint
       ADD COLUMN merchant_id BIGINT NULL COMMENT ''投诉方主体'',
       ADD COLUMN merchant_name VARCHAR(120) NULL COMMENT ''主体名称快照''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_complaint' AND COLUMN_NAME = 'merchant_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE service_consultation
       ADD COLUMN merchant_id BIGINT NULL COMMENT ''问诊方主体'',
       ADD COLUMN merchant_name VARCHAR(120) NULL COMMENT ''主体名称快照'',
       ADD COLUMN expert_id BIGINT NULL COMMENT ''承接专家（service_expert.id）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_consultation' AND COLUMN_NAME = 'merchant_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE insurance_policy
       ADD COLUMN merchant_id BIGINT NULL COMMENT ''投保主体'',
       ADD COLUMN merchant_name VARCHAR(120) NULL COMMENT ''主体名称快照''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'insurance_policy' AND COLUMN_NAME = 'merchant_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE insurance_claim
       ADD COLUMN merchant_id BIGINT NULL COMMENT ''报案主体'',
       ADD COLUMN merchant_name VARCHAR(120) NULL COMMENT ''主体名称快照''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'insurance_claim' AND COLUMN_NAME = 'merchant_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE service_policy_application
       ADD COLUMN merchant_id BIGINT NULL COMMENT ''申报主体'',
       ADD COLUMN merchant_name VARCHAR(120) NULL COMMENT ''主体名称快照''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_policy_application' AND COLUMN_NAME = 'merchant_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 数据范围全靠这几条 merchant_id 过滤，没索引就是每次全表扫
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_service_order_merchant ON service_order (merchant_id, created_at)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_order' AND INDEX_NAME = 'idx_service_order_merchant'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_service_demand_merchant ON service_demand (merchant_id)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_demand' AND INDEX_NAME = 'idx_service_demand_merchant'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_service_message_merchant ON service_message (merchant_id, is_read)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_message' AND INDEX_NAME = 'idx_service_message_merchant'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_service_complaint_merchant ON service_complaint (merchant_id)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_complaint' AND INDEX_NAME = 'idx_service_complaint_merchant'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_service_enrollment_merchant ON service_enrollment (merchant_id, course_id)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_enrollment' AND INDEX_NAME = 'idx_service_enrollment_merchant'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_service_favorite_merchant ON service_favorite (merchant_id, provider_id)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_favorite' AND INDEX_NAME = 'idx_service_favorite_merchant'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 历史行回填：只补 merchant_id IS NULL 的行，测试期间写入的归属一律不动
-- ---------------------------------------------------------------------------
UPDATE service_order SET merchant_id = 2001, merchant_name = '绿源农业合作社'
WHERE merchant_id IS NULL AND id IN (1,3,4,5,6);
UPDATE service_order SET merchant_id = 2003, merchant_name = '陕西洛川果业'
WHERE merchant_id IS NULL AND id IN (2,7);

UPDATE service_demand SET merchant_id = 2001, merchant_name = '绿源农业合作社'
WHERE merchant_id IS NULL AND id IN (1,3);
UPDATE service_demand SET merchant_id = 2003, merchant_name = '陕西洛川果业'
WHERE merchant_id IS NULL AND id IN (2,4);

UPDATE insurance_policy SET merchant_id = 2001, merchant_name = '绿源农业合作社'
WHERE merchant_id IS NULL AND id IN (1,3);
UPDATE insurance_policy SET merchant_id = 2003, merchant_name = '陕西洛川果业'
WHERE merchant_id IS NULL AND id = 2;

UPDATE insurance_claim c
  SET c.merchant_id = (SELECT p.merchant_id FROM insurance_policy p WHERE p.id = c.policy_id),
      c.merchant_name = (SELECT p.merchant_name FROM insurance_policy p WHERE p.id = c.policy_id)
WHERE c.merchant_id IS NULL
  AND (SELECT p.merchant_id FROM insurance_policy p WHERE p.id = c.policy_id) IS NOT NULL;

UPDATE service_policy_application SET merchant_id = 2001, merchant_name = '绿源农业合作社'
WHERE merchant_id IS NULL;
UPDATE service_complaint SET merchant_id = 2003, merchant_name = '陕西洛川果业'
WHERE merchant_id IS NULL AND id = 2;
UPDATE service_complaint SET merchant_id = 2001, merchant_name = '绿源农业合作社'
WHERE merchant_id IS NULL;

UPDATE service_consultation SET merchant_id = 2003, merchant_name = '陕西洛川果业'
WHERE merchant_id IS NULL AND id = 2;
UPDATE service_consultation SET merchant_id = 2001, merchant_name = '绿源农业合作社'
WHERE merchant_id IS NULL;

-- 问诊挂到真实专家档案的回填放在 data.sql 末尾：这个脚本先于种子执行，
-- 此刻 service_expert 还是空的，在这里 JOIN 只会一行都改不到。

UPDATE service_message SET merchant_id = 2003, merchant_name = '陕西洛川果业'
WHERE merchant_id IS NULL AND id = 3;
UPDATE service_message SET merchant_id = 2001, merchant_name = '绿源农业合作社'
WHERE merchant_id IS NULL;

-- 收件箱时间原先写的是"今天 13:52 / 昨天 08:30"：这类相对文案不会过期，只会一直骗人
UPDATE service_message SET created_at = '2026-10-24 13:52' WHERE created_at LIKE '%今天%';
UPDATE service_message SET created_at = '2026-10-23 17:40' WHERE created_at LIKE '%昨天 17%';
UPDATE service_message SET created_at = '2026-10-24 10:20' WHERE created_at LIKE '%今天 10%';
UPDATE service_message SET created_at = '2026-10-23 08:30' WHERE created_at LIKE '%昨天 08%';
UPDATE service_quality_alert SET created_at = '2026-10-24 08:20' WHERE created_at LIKE '%今天%';
UPDATE service_quality_alert SET created_at = '2026-10-23 16:40' WHERE created_at LIKE '%昨天 16%';
UPDATE service_quality_alert SET created_at = '2026-10-23 11:10' WHERE created_at LIKE '%昨天 11%';

-- 投保费率：老库里产品表只有文案（"10 元/亩自缴"），算不出保费，补数值列的取值
UPDATE insurance_product SET premium_rate = 10, coverage_per_mu = 1200, unit_measure = '亩' WHERE id = 1;
UPDATE insurance_product SET premium_rate = 12, coverage_per_mu = 1000, unit_measure = '亩' WHERE id = 2;
UPDATE insurance_product SET premium_rate = 12, coverage_per_mu = 3000, unit_measure = '亩' WHERE id = 3;
UPDATE insurance_product SET premium_rate = 18, coverage_per_mu = 1500, unit_measure = '头' WHERE id = 4;
UPDATE insurance_product SET premium_rate = 8, coverage_per_mu = 8500, unit_measure = '亩' WHERE id = 5;

-- 运营人员名单是岗位不是真人：真人操作人一律从登录令牌取（service_op_log.operator_name）
UPDATE service_team_member SET name = '运营主管岗' WHERE id = 1;
UPDATE service_team_member SET name = '服务商审核岗' WHERE id = 2;
UPDATE service_team_member SET name = '调度岗' WHERE id = 3;
UPDATE service_team_member SET name = '质量仲裁岗' WHERE id = 4;
UPDATE service_team_member SET name = '结算岗' WHERE id = 5;
