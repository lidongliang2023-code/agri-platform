-- 补丁：领域事件 outbox 的**投递**列（可重复执行）。
-- 口径见 schema-mysql.sql 末尾同名段落。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-domain-event-relay.sql
--
-- 为什么要补列：中继（DomainEventRelay）投递失败必须能表达"试了几次、下次什么时候试、
-- 上次为什么失败"，否则失败只剩日志一条路，页面上看不出任何异常。
-- 三列都允许为空，加列不动存量行 —— 存量事件（NEW）语义不变：retry_count=0、立即可投。
--
-- MySQL 8 没有 ADD COLUMN IF NOT EXISTS，所以用 information_schema + 动态 SQL 做到**可重复执行**：
-- 直接 ADD COLUMN 第二次跑会报 1060（列已存在），一个"幂等补丁"跑第二次就失败，
-- 下一个人只会以为是补丁坏了。

SET @ddl := IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_domain_event' AND COLUMN_NAME = 'retry_count') = 0,
    'ALTER TABLE agri_prod_domain_event ADD COLUMN retry_count INT DEFAULT 0 COMMENT ''已尝试投递次数（成功也计一次）''',
    'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_domain_event' AND COLUMN_NAME = 'next_retry_at') = 0,
    'ALTER TABLE agri_prod_domain_event ADD COLUMN next_retry_at DATETIME NULL COMMENT ''下次可投递时间；为空表示立即可投''',
    'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_domain_event' AND COLUMN_NAME = 'last_error') = 0,
    'ALTER TABLE agri_prod_domain_event ADD COLUMN last_error VARCHAR(500) NULL COMMENT ''最近一次投递失败的原因''',
    'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 状态取值由 "NEW / SENT" 扩为 "NEW / SENT / DEAD"（DEAD = 投递失败且重试次数用尽，可重放）。
-- status 列本来就是 VARCHAR(32)，不需要改列；只把注释对齐，免得读库的人以为只有两个状态。
ALTER TABLE agri_prod_domain_event
    MODIFY COLUMN status VARCHAR(32) DEFAULT 'NEW' COMMENT 'NEW 待投递 / SENT 已投递 / DEAD 投递失败（可重放）';
