-- satellite-gov-exchange 独立库 agri_gov：幂等建表
CREATE TABLE IF NOT EXISTS gov_submit_log (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_no   VARCHAR(32) NOT NULL,
    data_type  VARCHAR(32) NOT NULL,
    status     VARCHAR(16) NOT NULL DEFAULT 'EXPORTED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_gov_batch (batch_no)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '政务数据提交审计（日志留存 ≥ 6 个月，等保三级）';
