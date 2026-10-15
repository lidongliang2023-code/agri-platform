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

-- 演示存证（tenant 2001）：三条覆盖 SUCCESS / PENDING / FAILED，绑到演示批次与溯源码。
--
-- chain_type 用 **SIMULATED** 而不是真链名：本部署不连真链（2026-10-15 拍板），
-- 演示数据若写成 FISCO_BCOS，页面上就会出现"链类型 FISCO_BCOS"这种与部署事实相反的字段值，
-- 而写路径新建的存证又是 SIMULATED —— 同一张表两种链类型混排，读的人只会以为真的接了链。
-- 交易哈希同理用 SIMU 前缀，不要拿 0x 开头的形状去冒充真实交易。
INSERT IGNORE INTO agri_prod_chain_record
    (id, record_no, chain_type, target_type, target_id, target_code, data_hash, tx_hash, block_number,
     chain_status, chain_time, failed_reason, retry_count, tenant_id, create_time)
VALUES
    (1, 'CHAIN-20260601-0001', 'SIMULATED', 'HARVEST', 1, 'H20260601',
     SHA2('H20260601|采收|1250kg', 256),
     'SIMU7F3A1C9E5B2D4A6F8C0E1D2B3A4C5D6E', 1024,
     'SUCCESS', '2026-06-01 16:02:00', NULL, 0, '2001', '2026-06-01 15:58:00'),
    (2, 'CHAIN-20260615-0002', 'SIMULATED', 'QUALITY', 3, 'QC-DEMO-003',
     SHA2('QC-DEMO-003|质检|PASS', 256), NULL, NULL,
     'PENDING', NULL, NULL, 0, '2001', '2026-06-15 09:10:00'),
    (3, 'CHAIN-20260528-0003', 'SIMULATED', 'TRACE', 2, 'AG010102202605280001',
     SHA2('AG010102202605280001|溯源码', 256), NULL, NULL,
     'FAILED', NULL, '模拟链提交失败（演示数据，已重试 2 次）', 2, '2001', '2026-05-28 17:30:00');
