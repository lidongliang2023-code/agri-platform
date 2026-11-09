-- 发布前执行一次：补发凭据关联；不回填或伪造历史物流。
ALTER TABLE agri_trade_logistics
  ADD COLUMN diff_ticket_no VARCHAR(64) NULL COMMENT '生产短装工单号',
  ADD COLUMN diff_subject_id BIGINT NULL COMMENT '生产主体/订单卖方',
  ADD COLUMN reship_qty DECIMAL(20,6) NULL COMMENT '原供给单位下的足额补发量',
  ADD COLUMN reship_unit VARCHAR(64) NULL,
  ADD COLUMN signed_buyer_id BIGINT NULL COMMENT '通过订单买方身份确认签收',
  ADD UNIQUE KEY uk_logistics_diff_subject (diff_subject_id, diff_ticket_no);
