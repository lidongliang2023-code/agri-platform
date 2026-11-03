-- ------------------------------------------------ V46 用户中心 · 资质证照
--
-- 经营主体名下的资质证照台账（营业执照 / 食品生产许可 / 食品经营许可 / 有机认证 等）。
-- 挂在 merchant_id 上而不是 user_id 上：证照属于主体，不属于个人；
-- 同一主体下的多个成员都能看到，但只有主体成员能维护。
--
-- 到期预警不落库，由接口按 expire_date 现算（valid / expiring / expired），
-- 避免"库里存的预警状态"和"今天的日期"对不上。

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE `platform_merchant_certificate` (
       `id` BIGINT NOT NULL COMMENT ''雪花主键'',
       `merchant_id` BIGINT NOT NULL COMMENT ''经营主体ID'',
       `cert_type` VARCHAR(32) NOT NULL COMMENT ''证照类型'',
       `cert_name` VARCHAR(128) NOT NULL COMMENT ''证照名称'',
       `cert_no` VARCHAR(128) NULL COMMENT ''证照编号'',
       `issue_org` VARCHAR(128) NULL COMMENT ''发证机关'',
       `issue_date` DATE NULL COMMENT ''发证日期'',
       `expire_date` DATE NULL COMMENT ''有效期至'',
       `file_url` VARCHAR(512) NULL COMMENT ''影像件地址'',
       `status` VARCHAR(16) NOT NULL DEFAULT ''active'' COMMENT ''active / revoked'',
       `remark` VARCHAR(255) NULL COMMENT ''备注'',
       `market_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''市场维度'',
       `tenant_id` BIGINT NOT NULL DEFAULT 0 COMMENT ''产业带预留'',
       `created_at` DATETIME NULL,
       `updated_at` DATETIME NULL,
       `deleted` TINYINT NOT NULL DEFAULT 0 COMMENT ''逻辑删除'',
       PRIMARY KEY (`id`),
       KEY `idx_merchant` (`merchant_id`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''主体资质证照''',
    'SELECT 1')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_merchant_certificate'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
