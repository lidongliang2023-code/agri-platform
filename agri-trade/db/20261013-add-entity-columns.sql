-- ===========================================================================
-- 交易撮合模块 · 补齐「实体有、表没有」的列（2026-10-13）
--
-- 背景：这 9 张表是按一份更薄的字段清单建的，而实体类声明了 114 个表里不存在的列。
-- MyBatis-Plus 的 selectPage 会先查 COUNT(*)，**总数为 0 时直接跳过明细查询** ——
-- 所以表里没数据时一切正常，一旦有数据就报
--   "Unknown column 'xxx' in 'field list'"
-- 分页接口整片 500。演示数据灌进去之后这个问题才暴露出来。
--
-- 用法（既有库一次性执行；新库不需要，schema.sql 里已经把这些列写进建表语句）：
--   mysql -uroot -proot --default-character-set=utf8mb4 agri_trade -e "source <本文件>"
--
-- 类型按实体里的 Java 类型推：String→VARCHAR(255)（长文本用 TEXT、地址类 512）、
-- BigDecimal→DECIMAL(18,4)/(5,2)/(10,7)、Date→DATETIME、Integer→INT、Long→BIGINT。
-- 全部允许 NULL：这些列目前没有业务写入方，加它们是为了让实体与表一致、查询不再报错。
-- ===========================================================================
-- agri_trade_contract：补 19 列
ALTER TABLE `agri_trade_contract`
    ADD COLUMN `contract_name` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `template_id` BIGINT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `order_no` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `buyer_sign_status` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `buyer_sign_ip` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `buyer_signature` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `seller_sign_status` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `seller_sign_ip` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `seller_signature` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `contract_hash` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `contract_file_url` VARCHAR(512) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `contract_amount` DECIMAL(18,4) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `delivery_date` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `sign_date` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `archive_status` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `archive_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `chain_status` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `chain_tx_hash` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `chain_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）';

-- agri_trade_demand：补 10 列
ALTER TABLE `agri_trade_demand`
    ADD COLUMN `demand_name` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `category_code` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `product_name` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `spec_desc` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `quality_level` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `demand_quantity` DECIMAL(18,4) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `expected_price` DECIMAL(18,4) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `delivery_location` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `additional_requirements` TEXT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `publish_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）';

-- agri_trade_dispute：补 13 列
ALTER TABLE `agri_trade_dispute`
    ADD COLUMN `order_no` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `complainant_type` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `complainant_id` BIGINT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `complainant_name` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `dispute_reason` TEXT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `dispute_description` TEXT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `process_stage` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `arbitrator` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `arbitration_doc_url` VARCHAR(512) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `compensation_amount` DECIMAL(18,4) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `compensation_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `close_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `close_reason` TEXT NULL COMMENT '实体字段补齐（2026-10-13）';

-- agri_trade_evaluation：补 12 列
ALTER TABLE `agri_trade_evaluation`
    ADD COLUMN `order_no` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `order_item_id` BIGINT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `evaluator_type` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `rating_delivery` DECIMAL(5,2) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `rating_price` DECIMAL(5,2) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `rating_payment` DECIMAL(5,2) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `rating_communication` DECIMAL(5,2) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `rating_honesty` DECIMAL(5,2) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `evaluation_tags` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `is_anonymous` INT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `is_system` INT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `hide_reason` TEXT NULL COMMENT '实体字段补齐（2026-10-13）';

-- agri_trade_logistics：补 32 列
ALTER TABLE `agri_trade_logistics`
    ADD COLUMN `order_no` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `carrier_no` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `temp_require` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `vehicle_type` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `sender_province` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `sender_city` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `sender_district` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `sender_address` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `sender_contact` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `sender_phone` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `receiver_province` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `receiver_city` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `receiver_district` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `receiver_address` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `receiver_contact` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `receiver_phone` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `goods_name` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `goods_weight` DECIMAL(18,4) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `goods_volume` DECIMAL(18,4) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `goods_count` INT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `pay_method` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `expect_delivery_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `delivery_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `estimate_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `actual_arrival_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `sign_receiver` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `current_location` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `current_lat` DECIMAL(10,7) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `current_lng` DECIMAL(10,7) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `temperature` DECIMAL(18,2) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `is_cod` INT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `cod_amount` DECIMAL(18,4) NULL COMMENT '实体字段补齐（2026-10-13）';

-- agri_trade_match_record：补 13 列
ALTER TABLE `agri_trade_match_record`
    ADD COLUMN `category_score` DECIMAL(5,2) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `price_score` DECIMAL(5,2) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `distance_score` DECIMAL(5,2) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `quality_score` DECIMAL(5,2) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `match_reason` TEXT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `recommend_order` INT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `buyer_viewed` INT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `buyer_view_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `seller_viewed` INT NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `seller_view_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `inquiry_status` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `order_status` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `convert_time` DATETIME NULL COMMENT '实体字段补齐（2026-10-13）';

-- agri_trade_order_item：补 4 列
ALTER TABLE `agri_trade_order_item`
    ADD COLUMN `total_price` DECIMAL(18,4) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `origin_province` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `origin_city` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `harvest_batch_no` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）';

-- agri_trade_order：补 7 列
ALTER TABLE `agri_trade_order`
    ADD COLUMN `buyer_province` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `buyer_city` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `seller_province` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `seller_city` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `seller_address` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `product_name` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `total_quantity` DECIMAL(18,4) NULL COMMENT '实体字段补齐（2026-10-13）';

-- agri_trade_product：补 4 列
ALTER TABLE `agri_trade_product`
    ADD COLUMN `category_code` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `quality_level` VARCHAR(255) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `unit_price` DECIMAL(18,4) NULL COMMENT '实体字段补齐（2026-10-13）',
    ADD COLUMN `sales_volume` INT NULL COMMENT '实体字段补齐（2026-10-13）';

