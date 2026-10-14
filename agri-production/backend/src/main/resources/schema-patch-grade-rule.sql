-- 补丁：质量分级规则表（可重复执行，CREATE TABLE IF NOT EXISTS + INSERT IGNORE）。
--
-- 背景：POST / PUT / DELETE /quality/grading[/{id}] 在 core-platform 上是既有实现，
-- 切流到 agri-production 后这三个路径变成 405（路径在、方法不在，回退只认 404 接不住）。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-grade-rule.sql

CREATE TABLE IF NOT EXISTS agri_prod_quality_grade_rule (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    grade_code VARCHAR(16) NOT NULL COMMENT 'A / B / C / D',
    grade_name VARCHAR(64),
    crop_id BIGINT,
    crop_name VARCHAR(191),
    metrics VARCHAR(255) COMMENT '分级指标，如 单果重 / 糖度 / 外观',
    criteria TEXT COMMENT '判定标准描述',
    price_factor DECIMAL(10,4) COMMENT '价格系数',
    status INT DEFAULT 1 COMMENT '1 启用 / 0 停用',
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_grade_rule_tenant_id` (tenant_id),
    INDEX `idx_grade_rule_crop_id` (crop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO agri_prod_quality_grade_rule
    (id, grade_code, grade_name, crop_id, crop_name, metrics, criteria, price_factor, status, tenant_id, remark)
VALUES
    (1, 'A', '特级', 1, '西红柿', '单果重 / 糖度 / 外观', '单果重≥200g，糖度≥6.5，无机械伤与病斑', 1.3000, 1, '2001', '供高端商超'),
    (2, 'B', '一级', 1, '西红柿', '单果重 / 糖度 / 外观', '单果重150-200g，糖度5.5-6.5，允许轻微色差', 1.1000, 1, '2001', '常规批发'),
    (3, 'C', '二级', 1, '西红柿', '单果重 / 糖度 / 外观', '单果重100-150g，糖度4.5-5.5', 0.9500, 1, '2001', '本地市场'),
    (4, 'D', '等外', 1, '西红柿', '单果重 / 糖度 / 外观', '不满足以上任一等级', 0.7000, 1, '2001', '加工原料');
