-- 一次性补丁：把两张表里「实体已经不用、却还是 NOT NULL」的历史列改成可空。
--
-- 什么时候要跑：如果这个库是 2026-10-13 之前建的，就必须跑一次，否则
--   POST /api/trade/dispute    → 500 Field 'applicant_id' doesn't have a default value
--   POST /api/trade/contract   → 500 Field 'goods_name' doesn't have a default value
-- 新建的库不用跑：schema.sql 里这两张表已经直接建成可空。
--
-- 跑法（口令自己带，别写进脚本）：
--   mysql -uroot -p agri_trade < schema-patch-legacy-notnull.sql
--
-- 这些列本身保留不动，只为兼容旧数据；接口和实体用的是 complainant_* / contract_amount 那一套。

ALTER TABLE agri_trade_dispute
    MODIFY COLUMN applicant_id BIGINT NULL COMMENT '申请人ID（历史列，实体改用 complainant_id）',
    MODIFY COLUMN applicant_name VARCHAR(100) NULL COMMENT '申请人名称（历史列，实体改用 complainant_name）',
    MODIFY COLUMN dispute_content TEXT NULL COMMENT '纠纷内容（历史列，实体改用 dispute_reason/dispute_description）';

ALTER TABLE agri_trade_contract
    MODIFY COLUMN goods_name VARCHAR(200) NULL COMMENT '商品名称（历史列，实体未映射）',
    MODIFY COLUMN quantity DECIMAL(18,4) NULL COMMENT '数量（历史列，实体未映射）',
    MODIFY COLUMN unit VARCHAR(20) NULL COMMENT '计量单位（历史列，实体未映射）',
    MODIFY COLUMN unit_price DECIMAL(18,4) NULL COMMENT '单价（历史列，实体未映射）',
    MODIFY COLUMN total_amount DECIMAL(18,2) NULL COMMENT '总金额（历史列，实体改用 contract_amount）';
