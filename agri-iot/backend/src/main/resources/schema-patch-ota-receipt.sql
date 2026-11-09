CREATE TABLE IF NOT EXISTS iot_ota_receipt (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 task_id BIGINT NOT NULL, gateway_id BIGINT NOT NULL,
 command_no VARCHAR(40) NOT NULL UNIQUE,
 command_status VARCHAR(20) NOT NULL,
 firmware_version VARCHAR(40) NOT NULL, firmware_url VARCHAR(1000) NOT NULL,
 sha256_text VARCHAR(64) NOT NULL, dispatch_token VARCHAR(64),
 progress INT NOT NULL DEFAULT 0, installed_version VARCHAR(40),
 result_text VARCHAR(300), operator_name VARCHAR(160),
 created_at VARCHAR(40), expires_at VARCHAR(40), sent_at VARCHAR(40), receipt_at VARCHAR(40),
 UNIQUE KEY uk_ota_task_gateway(task_id,gateway_id)
);
