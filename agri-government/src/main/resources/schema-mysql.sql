-- 存量 MySQL 库的补列（schema.sql 用的是 CREATE TABLE IF NOT EXISTS，已建好的表不会加新列）。
-- 本文件只写 MySQL 方言（information_schema + PREPARE），所以不放进 schema.sql ——
-- 那份同时给 H2 用，H2 不认 PREPARE，会让测试库直接起不来。
-- 通过 application-mysql.yml 的 spring.sql.init.schema-locations 追加加载。

-- 监管档案 ↔ 平台经营主体：主体端登录身份从令牌解析，不再在 SQL 里写死 subject_id=1
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_subject ADD COLUMN merchant_id BIGINT NULL COMMENT ''绑定的平台经营主体号''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_subject' AND COLUMN_NAME = 'merchant_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_gov_subject_merchant ON gov_subject (merchant_id)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_subject' AND INDEX_NAME = 'idx_gov_subject_merchant'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 执法人员档案 ↔ 平台账号：移动执法端"我的任务/我的案件"按账号解析，不再写死 '王磊'
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_user ADD COLUMN certificate_no VARCHAR(40) NULL COMMENT ''执法证号''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_user' AND COLUMN_NAME = 'certificate_no'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_user ADD COLUMN platform_user_id BIGINT NULL COMMENT ''绑定的平台用户号''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_user' AND COLUMN_NAME = 'platform_user_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_gov_user_platform ON gov_user (platform_user_id)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_user' AND INDEX_NAME = 'idx_gov_user_platform'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 任务、案件、预警都要能按"分派给谁"筛，所以落账号号而不是只落一个人名快照
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_task ADD COLUMN assignee_id BIGINT NULL COMMENT ''承办执法人员（gov_user.id）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_task' AND COLUMN_NAME = 'assignee_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_warning ADD COLUMN assignee_id BIGINT NULL COMMENT ''分派执法人员（gov_user.id）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_warning' AND COLUMN_NAME = 'assignee_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_case ADD COLUMN handler_id BIGINT NULL COMMENT ''办案人员（gov_user.id）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_case' AND COLUMN_NAME = 'handler_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 站内信必须知道"发给哪家主体 / 哪位执法人员"，否则任何人都能读到全部消息
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_message ADD COLUMN subject_id BIGINT NULL COMMENT ''收件监管主体''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_message' AND COLUMN_NAME = 'subject_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_message ADD COLUMN assignee_id BIGINT NULL COMMENT ''收件执法人员（gov_user.id）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_message' AND COLUMN_NAME = 'assignee_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_message ADD COLUMN biz_type VARCHAR(40) NULL COMMENT ''关联业务类型''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_message' AND COLUMN_NAME = 'biz_type'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_message ADD COLUMN biz_no VARCHAR(60) NULL COMMENT ''关联业务单号''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_message' AND COLUMN_NAME = 'biz_no'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_gov_message_subject ON gov_message (subject_id, is_read)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_message' AND INDEX_NAME = 'idx_gov_message_subject'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 抽检结果必须能追到"抽的是哪家主体"，否则主体端只能按名字猜
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_sampling ADD COLUMN subject_id BIGINT NULL COMMENT ''被抽检主体（gov_subject.id）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_sampling' AND COLUMN_NAME = 'subject_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 执法留痕要记下操作人账号与针对的主体：只留一个人名快照既无法审计，也无法按主体筛给主体端看
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_op_log ADD COLUMN operator_id BIGINT NULL COMMENT ''操作人（gov_user.id，公众操作为空）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_op_log' AND COLUMN_NAME = 'operator_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE gov_op_log ADD COLUMN subject_id BIGINT NULL COMMENT ''针对的监管主体''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gov_op_log' AND COLUMN_NAME = 'subject_id'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 存量行按监管登记名回填主体号：只在列为空时回填，重复执行不会改动已有绑定
UPDATE gov_sampling s JOIN gov_subject g ON g.subject_name = s.subject_name
  SET s.subject_id = g.id WHERE s.subject_id IS NULL;
UPDATE gov_warning w JOIN gov_subject g ON g.subject_name = w.subject_name
  SET w.subject_id = g.id WHERE w.subject_id IS NULL AND w.subject_name IS NOT NULL;

-- 人名快照 ↔ 档案号：种子里的分派/承办只写了姓名，补上账号号后移动端的「我的任务」才有内容。
-- 同样只在空列上回填；新库由 data.sql 直接带上 assignee_id/handler_id。
UPDATE gov_task t JOIN gov_user u ON u.name = t.assigned_to
  SET t.assignee_id = u.id WHERE t.assignee_id IS NULL;
UPDATE gov_warning w JOIN gov_user u ON u.name = w.assigned_to
  SET w.assignee_id = u.id WHERE w.assignee_id IS NULL;
UPDATE gov_case c JOIN gov_user u ON u.name = c.handler
  SET c.handler_id = u.id WHERE c.handler_id IS NULL;

-- 执法证号补齐（与 data.sql 的种子一致；原来是代码里的常量，档案里根本没有这一列）
UPDATE gov_user SET certificate_no = CASE name
    WHEN '张科长' THEN 'ZF15060220240011'
    WHEN '王磊' THEN '15060220240118'
    WHEN '赵宁' THEN '15060220240125'
    WHEN '李敏' THEN 'XY15060220240007'
    WHEN '刘审核' THEN 'CY15060220240003'
    ELSE certificate_no END
  WHERE certificate_no IS NULL;

-- 执法人员 ↔ 平台账号、监管主体 ↔ 平台经营主体这两条绑定关系不在这里写死：
-- 由 scripts/provision-gov-access.mjs 走监管运营端接口建立（幂等，可反复执行，也会纠正上一轮的错绑）。

SET @scope_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE gov_subject ADD COLUMN region_code VARCHAR(12) NULL', 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='gov_subject' AND column_name='region_code');
PREPARE scope_stmt FROM @scope_ddl;
EXECUTE scope_stmt;
DEALLOCATE PREPARE scope_stmt;

SET @scope_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE gov_complaint ADD COLUMN region_code VARCHAR(12) NULL', 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='gov_complaint' AND column_name='region_code');
PREPARE scope_stmt FROM @scope_ddl;
EXECUTE scope_stmt;
DEALLOCATE PREPARE scope_stmt;
