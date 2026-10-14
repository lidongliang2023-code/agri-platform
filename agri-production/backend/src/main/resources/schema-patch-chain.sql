-- 补丁：区块链存证两张表 + 演示数据（可重复执行）。
--
-- 背景：实体 ChainRecord / ChainVerifyLog 早就在 agri-production 里（列名、词表都定好了），
-- 而 **表一直没建** —— 一调就是 "Table 'agri_production.agri_prod_chain_record' doesn't exist"。
-- 这里按实体建列（= 接口口径），并补三条演示存证，让页面能看出成功/待上链/失败三种状态。
--
-- 列名的参照系：core-platform 的 prod_blockchain_record（record_id/biz_type/biz_no/batch_id/
-- trace_code/tx_hash/block_height/payload_hash/anchor_at/status）—— 两边的语义一致，
-- 本表用的是本服务实体的命名（record_no/chain_type/target_type/target_code/data_hash/…）。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-chain.sql

CREATE TABLE IF NOT EXISTS agri_prod_chain_record (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    record_no VARCHAR(191) NOT NULL UNIQUE,
    chain_type VARCHAR(64) COMMENT '链类型',
    target_type VARCHAR(64) COMMENT '业务类型（采收/质检/投入品/溯源码）',
    target_id BIGINT COMMENT '业务主键',
    target_code VARCHAR(191) COMMENT '业务单号/码值',
    data_hash VARCHAR(191) COMMENT '存证数据哈希',
    tx_hash VARCHAR(191) COMMENT '链上交易哈希；未上链为空',
    block_number BIGINT COMMENT '区块高度',
    chain_status VARCHAR(32) DEFAULT 'PENDING' COMMENT 'PENDING 待上链 / SUCCESS 已上链 / FAILED 失败',
    chain_time DATETIME COMMENT '出块时间',
    failed_reason VARCHAR(255) COMMENT '失败原因',
    retry_count INT DEFAULT 0,
    next_retry_time DATETIME,
    data_json TEXT COMMENT '存证原始数据（JSON）',
    del_flag INT DEFAULT 0,
    tenant_id VARCHAR(191) NOT NULL,
    create_by VARCHAR(191),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by VARCHAR(191),
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_chain_tenant_id` (tenant_id),
    INDEX `idx_chain_status` (chain_status),
    INDEX `idx_chain_target` (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_chain_verify_log (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    log_no VARCHAR(191) NOT NULL UNIQUE,
    chain_record_id BIGINT,
    target_type VARCHAR(64),
    target_id BIGINT,
    tx_hash VARCHAR(191),
    verify_status VARCHAR(32) COMMENT 'MATCH / MISMATCH / NOT_FOUND',
    verify_time DATETIME,
    verified_by VARCHAR(191),
    verify_result_json TEXT,
    remark TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_verify_chain_record_id` (chain_record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 演示存证（tenant 2001）：三条覆盖 SUCCESS / PENDING / FAILED，绑到演示批次与溯源码
INSERT IGNORE INTO agri_prod_chain_record
    (id, record_no, chain_type, target_type, target_id, target_code, data_hash, tx_hash, block_number,
     chain_status, chain_time, failed_reason, retry_count, tenant_id, create_time)
VALUES
    (1, 'CHAIN-20260601-0001', 'FISCO_BCOS', 'HARVEST', 1, 'H20260601',
     SHA2('H20260601|采收|1250kg', 256),
     '0x7f3a1c9e5b2d4a6f8c0e1d2b3a4c5d6e7f8091a2b3c4d5e6f7089a1b2c3d4e5f', 1024,
     'SUCCESS', '2026-06-01 16:02:00', NULL, 0, '2001', '2026-06-01 15:58:00'),
    (2, 'CHAIN-20260615-0002', 'FISCO_BCOS', 'QUALITY', 3, 'QC-DEMO-003',
     SHA2('QC-DEMO-003|质检|PASS', 256), NULL, NULL,
     'PENDING', NULL, NULL, 0, '2001', '2026-06-15 09:10:00'),
    (3, 'CHAIN-20260528-0003', 'FISCO_BCOS', 'TRACE', 2, 'AG010102202605280001',
     SHA2('AG010102202605280001|溯源码', 256), NULL, NULL,
     'FAILED', NULL, '链节点连接超时（演示数据）', 2, '2001', '2026-05-28 17:30:00');
