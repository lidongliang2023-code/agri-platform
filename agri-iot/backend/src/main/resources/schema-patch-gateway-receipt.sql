-- 网关指令独立台账；不回填历史重启日志，不修改心跳。
CREATE TABLE IF NOT EXISTS iot_gateway_command (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 gateway_id BIGINT NOT NULL,
 gateway_name VARCHAR(160),
 action_name VARCHAR(120) NOT NULL,
 operator_name VARCHAR(300) NOT NULL,
 result_text VARCHAR(300),
 created_at VARCHAR(40) NOT NULL,
 command_no VARCHAR(40) NOT NULL,
 command_status VARCHAR(20) NOT NULL,
 dispatch_token VARCHAR(64),
 expires_at VARCHAR(40) NOT NULL,
 sent_at VARCHAR(40),
 receipt_at VARCHAR(40),
 UNIQUE KEY uk_gateway_command_no (command_no),
 KEY idx_gateway_command_status (gateway_id,command_status)
);
