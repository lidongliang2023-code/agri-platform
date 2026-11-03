-- ------------------------------------------------ V55 冻结申诉闭环
--
-- 原来 platform_uc_account_freeze 有 appeal_status 字段，但两头都没有入口：
-- 用户端没有申诉入口（而且账号被冻结后**根本登不进来**），运营端也没有处理按钮。
-- 于是这个字段永远是 none —— 一个看起来有、实际没用的状态位。
--
-- 这次补齐：
--   用户：登录页「账号被冻结？提交申诉」→ 公开接口（凭手机号，不需要登录）
--   运营：冻结记录页按「申诉中」筛选 → 受理（顺带解封）/ 驳回
--
-- 为什么要加这些列：申诉是一次**带内容与时效**的交互，只记一个状态字
-- 会出现"运营看到 appealing 但不知道用户说了什么、什么时候说的"。

-- ---------- 申诉内容与时间 ----------
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_uc_account_freeze`
       ADD COLUMN `appeal_reason` VARCHAR(500) NULL COMMENT ''用户申诉理由'',
       ADD COLUMN `appeal_time` DATETIME NULL COMMENT ''申诉提交时间'',
       ADD COLUMN `appeal_handle_time` DATETIME NULL COMMENT ''申诉处理时间'',
       ADD COLUMN `appeal_remark` VARCHAR(500) NULL COMMENT ''运营处理意见（驳回理由会展示给用户）''',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_uc_account_freeze'
    AND COLUMN_NAME = 'appeal_reason'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 按申诉状态筛选（运营端默认只看「申诉中」）
SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `platform_uc_account_freeze` ADD KEY `idx_appeal` (`appeal_status`)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_uc_account_freeze'
    AND INDEX_NAME = 'idx_appeal'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
