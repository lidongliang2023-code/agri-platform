-- 接收回执状态：幂等登记与业务投影分离后，支持并发请求等待最终回执。
ALTER TABLE platform_master_data_receipt
    ADD COLUMN receive_status VARCHAR(20) NOT NULL DEFAULT 'success' AFTER accepted_count,
    ADD COLUMN receive_message VARCHAR(500) NULL AFTER receive_status;

-- V62 已落库的历史回执都是成功完成的，默认值 success 与历史数据一致。
