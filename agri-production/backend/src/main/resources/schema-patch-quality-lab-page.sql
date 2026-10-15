-- 补丁：检测机构表的驳回原因列（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-quality-lab-page.sql
--
-- 背景（2026-10-15 做运营端 admin/quality 这一块时发现）：
-- 前端「检测机构管理」的准入驳回会把运营手填的驳回原因一起提交
-- （api/admin/trace.ts 的 rejectQualityLab → POST /admin/quality/labs/{id}/reject body {rejectReason}），
-- 而本表没有落这一列的地方 —— 不补列就只有两种选择：把用户输入丢掉，或者假装成功。
-- core-platform 那边有 prod_quality_lab.reject_reason（V11 之后）可对照。

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_testing_lab' AND COLUMN_NAME = 'reject_reason') = 0,
  'ALTER TABLE agri_prod_testing_lab ADD COLUMN reject_reason VARCHAR(500) NULL COMMENT ''准入驳回原因（驳回时由运营手填）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
