-- 一次性补丁：溯源码表补 17 列（**只需跑一次**，ALTER 不幂等）。
--
-- 背景：实体 TraceCode（@TableName agri_prod_trace_code）映射了
--   harvest_code / batch_number / product_code / farm_id / farm_code / farm_name /
--   plot_id / plot_code / crop_name / quality_grade / harvest_date / activate_time /
--   first_query_time / query_count / blockchain_tx_hash / blockchain_block_height / remark
-- 十七列，而表里一列都没有 → 任何按码读溯源都是
--   `Unknown column 'harvest_code' in 'field list'`，接口返 500。
-- 既有列（product_spec / batch_code / production_date / expiry_date / qr_code_url / trace_data …）
-- 一律保留 —— 按"只增不改"的口径。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-trace-columns.sql

ALTER TABLE agri_prod_trace_code
    ADD COLUMN harvest_code VARCHAR(191) NULL COMMENT '采收单号（冗余展示）',
    ADD COLUMN batch_number VARCHAR(191) NULL COMMENT '批次号（前端 batchNo）',
    ADD COLUMN product_code VARCHAR(191) NULL COMMENT '产品编码',
    ADD COLUMN farm_id BIGINT NULL COMMENT '农场 ID',
    ADD COLUMN farm_code VARCHAR(191) NULL COMMENT '农场编码',
    ADD COLUMN farm_name VARCHAR(191) NULL COMMENT '农场名称',
    ADD COLUMN plot_id BIGINT NULL COMMENT '地块 ID',
    ADD COLUMN plot_code VARCHAR(191) NULL COMMENT '地块编码',
    ADD COLUMN crop_name VARCHAR(191) NULL COMMENT '作物名称',
    ADD COLUMN quality_grade VARCHAR(64) NULL COMMENT '质量等级',
    ADD COLUMN harvest_date DATE NULL COMMENT '采收日期',
    ADD COLUMN activate_time DATETIME NULL COMMENT '激活时间',
    ADD COLUMN first_query_time DATETIME NULL COMMENT '首次查询时间',
    ADD COLUMN query_count INT DEFAULT 0 COMMENT '查询次数',
    ADD COLUMN blockchain_tx_hash VARCHAR(191) NULL COMMENT '上链交易哈希',
    ADD COLUMN blockchain_block_height BIGINT NULL COMMENT '上链区块高度',
    ADD COLUMN remark TEXT NULL COMMENT '备注';

-- 已有的演示溯源码把批次号/状态等已有信息对齐到新列（可推导的冗余，不算编数据）
UPDATE agri_prod_trace_code
SET batch_number = COALESCE(batch_number, batch_code),
    query_count = COALESCE(query_count, 0)
WHERE batch_number IS NULL OR query_count IS NULL;

-- 演示溯源码（tenant 2001）：绑到演示采收批次，字段从批次推导，不编造
INSERT IGNORE INTO agri_prod_trace_code
    (id, trace_code, harvest_code, batch_number, product_name, status, farm_id, plot_id, crop_name,
     quality_grade, harvest_date, query_count, tenant_id)
SELECT 1, 'AG010101202606010001', b.batch_no, b.batch_no, CONCAT(b.crop_name, '(', b.grade, '级)'),
       'active', b.farm_id, b.plot_id, b.crop_name, b.grade, b.harvest_date, 0, '2001'
FROM agri_prod_harvest_batch b WHERE b.batch_no = 'H20260601';
INSERT IGNORE INTO agri_prod_trace_code
    (id, trace_code, harvest_code, batch_number, product_name, status, farm_id, plot_id, crop_name,
     quality_grade, harvest_date, query_count, tenant_id)
SELECT 2, 'AG010102202605280001', b.batch_no, b.batch_no, CONCAT(b.crop_name, '(', b.grade, '级)'),
       'inactive', b.farm_id, b.plot_id, b.crop_name, b.grade, b.harvest_date, 0, '2001'
FROM agri_prod_harvest_batch b WHERE b.batch_no = 'H20260528';
