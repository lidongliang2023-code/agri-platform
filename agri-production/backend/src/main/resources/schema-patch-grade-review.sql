
-- 正式等级复核：仅认定关联工单履约商品等级，不改写批次或交易价格。
CREATE TABLE IF NOT EXISTS agri_prod_grade_review (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 tenant_id VARCHAR(64) NOT NULL, review_no VARCHAR(64) NOT NULL,
 ticket_id BIGINT NOT NULL, ticket_no VARCHAR(64) NOT NULL,
 offer_no VARCHAR(64) NOT NULL, order_no VARCHAR(64) NOT NULL, batch_id BIGINT NOT NULL,
 original_grade VARCHAR(16) NOT NULL, reviewed_grade VARCHAR(16) NOT NULL,
 inspection_id BIGINT NOT NULL, inspection_no VARCHAR(64), reason VARCHAR(500) NOT NULL,
 applicant_id VARCHAR(64) NOT NULL, reviewer_id VARCHAR(64), review_remark VARCHAR(500),
 status VARCHAR(16) NOT NULL, create_time DATETIME NOT NULL, reviewed_at DATETIME, consumed_at DATETIME,
 UNIQUE KEY uk_grade_review_no (review_no), KEY idx_grade_review_ticket (tenant_id,ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
