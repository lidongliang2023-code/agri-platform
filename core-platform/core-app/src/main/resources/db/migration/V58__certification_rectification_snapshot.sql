ALTER TABLE platform_merchant_certification
    ADD COLUMN address VARCHAR(1000) NULL COMMENT '提交时注册地址',
    ADD COLUMN industry VARCHAR(255) NULL COMMENT '提交时行业',
    ADD COLUMN company_size VARCHAR(100) NULL COMMENT '提交时规模',
    ADD COLUMN previous_certification_id BIGINT NULL COMMENT '补正前申请ID';
