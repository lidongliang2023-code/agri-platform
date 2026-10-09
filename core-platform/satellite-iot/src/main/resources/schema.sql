-- satellite-iot 独立库 agri_iot：幂等建表（spring.sql.init 每次启动执行）
-- 本地消息表：与核心单体同构（core-infra OutboxRelay 复用）
CREATE TABLE IF NOT EXISTS platform_outbox_message (
    id            BIGINT      PRIMARY KEY,
    event_type    VARCHAR(64) NOT NULL,
    event_key     VARCHAR(64),
    payload       JSON,
    market_id     BIGINT,
    tenant_id     BIGINT,
    status        TINYINT     NOT NULL DEFAULT 0,
    retry_count   INT         NOT NULL DEFAULT 0,
    next_retry_at DATETIME,
    created_at    DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_outbox_status (status, next_retry_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '本地消息表（ADR-003）';

CREATE TABLE IF NOT EXISTS iot_device_reading (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    market_id    BIGINT DEFAULT 0,
    device_no    VARCHAR(32) NOT NULL,
    metric       VARCHAR(32) NOT NULL,
    metric_value DECIMAL(18, 2),
    reported_at  DATETIME,
    KEY idx_read_device (device_no, reported_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '设备时序读数（规模触发迁 TimescaleDB/IoTDB，8.2）';

CREATE TABLE IF NOT EXISTS iot_alert_log (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    market_id    BIGINT DEFAULT 0,
    device_no    VARCHAR(32) NOT NULL,
    metric       VARCHAR(32),
    metric_value DECIMAL(18, 2),
    threshold    DECIMAL(18, 2),
    level        VARCHAR(8),
    message      VARCHAR(255),
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_alert_device (device_no)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '告警日志（本地）';
