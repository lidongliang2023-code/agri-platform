-- satellite-ai-gateway 独立库 agri_ai：幂等建表
CREATE TABLE IF NOT EXISTS ai_call_log (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    scenario   VARCHAR(32)    NOT NULL COMMENT 'general/vision/...',
    model      VARCHAR(64),
    tokens     BIGINT         DEFAULT 0,
    cost       DECIMAL(12, 6) DEFAULT 0 COMMENT '成本（元）',
    status     VARCHAR(16) COMMENT 'OK/DEGRADED/FAILED',
    called_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_call_scene (scenario, called_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '模型调用成本核算（ADR-008）';
