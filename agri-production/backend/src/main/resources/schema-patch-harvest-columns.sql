-- 一次性补丁：采收记录表补 11 列（**只需跑一次**，ALTER 不幂等）。
--
-- 背景：实体 Harvest（@TableName agri_prod_harvest_record）映射了
--   batch_number / expected_quantity / actual_quantity / farm_code / plot_code /
--   harvest_team / supervisor / weather_condition / photos / notes / trace_code
-- 十一列，而表里一列都没有 → 任何按 id 读采收记录都是
-- `Unknown column 'farm_code' in 'field list'`，接口返 500（实测 GET /harvests/1）。
-- 既有列（quantity / moisture_content / weight_net / weight_gross / transporter /
-- vehicle_number …）一律保留——按"只增不改"的口径。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-harvest-columns.sql

ALTER TABLE agri_prod_harvest_record
    ADD COLUMN batch_number VARCHAR(191) NULL COMMENT '批次号（前端 batchNo）',
    ADD COLUMN expected_quantity DECIMAL(18,4) NULL COMMENT '预计产量（实体字段）',
    ADD COLUMN actual_quantity DECIMAL(18,4) NULL COMMENT '实际产量（实体字段）',
    ADD COLUMN farm_code VARCHAR(191) NULL COMMENT '农场编码（冗余展示）',
    ADD COLUMN plot_code VARCHAR(191) NULL COMMENT '地块编码（冗余展示）',
    ADD COLUMN harvest_team VARCHAR(191) NULL COMMENT '采收班组',
    ADD COLUMN supervisor VARCHAR(191) NULL COMMENT '监收人',
    ADD COLUMN weather_condition VARCHAR(191) NULL COMMENT '采收天气',
    ADD COLUMN photos TEXT NULL COMMENT '现场照片（JSON 数组字符串）',
    ADD COLUMN notes TEXT NULL COMMENT '备注（实体字段 notes）',
    ADD COLUMN trace_code VARCHAR(191) NULL COMMENT '溯源码';

-- 已有的那条演示采收记录（H001）补上可推导的冗余编码
UPDATE agri_prod_harvest_record h
    JOIN agri_prod_farm_info f ON f.id = h.farm_id
    LEFT JOIN agri_prod_plot_info p ON p.id = h.plot_id
SET h.farm_code = f.farm_code,
    h.plot_code = p.plot_code
WHERE h.farm_code IS NULL OR h.plot_code IS NULL;
