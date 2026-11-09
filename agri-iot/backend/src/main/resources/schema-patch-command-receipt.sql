-- 已有运行库升级：仅扩展结构，历史行保持原结果，不补造回执。
ALTER TABLE iot_control_log
 ADD COLUMN command_no VARCHAR(40) NULL,
 ADD COLUMN command_status VARCHAR(20) NULL,
 ADD COLUMN dispatch_token VARCHAR(64) NULL,
 ADD COLUMN expires_at VARCHAR(40) NULL,
 ADD COLUMN sent_at VARCHAR(40) NULL,
 ADD COLUMN receipt_at VARCHAR(40) NULL,
 ADD UNIQUE KEY uk_control_command_no (command_no),
 ADD KEY idx_control_device_status (device_id,command_status);
