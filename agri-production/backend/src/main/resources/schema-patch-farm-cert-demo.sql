-- 补丁：农场资质证照台账 + 演示数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-farm-cert-demo.sql
--
-- 演示数据是**跨库机械转换**（不是手抄）：从 agri_core.prod_farm_cert 取 DEMO- 行，
-- farm_id 经 agri_prod_farm_info.platform_farm_id 换算成本地主键；排除了探针空体写入的垃圾行
-- （该表 44 行里只有 6 行是 DEMO- 演示行）。
INSERT IGNORE INTO agri_prod_farm_cert
    (cert_id, farm_id, cert_type, cert_name, cert_no, issuer, issue_date, expire_date, attach_url,
     status, tenant_id)
SELECT c.cert_id, f.id, c.cert_type, c.cert_name, c.cert_no, c.issuer, c.issue_date, c.expire_date,
       c.attach_url, c.status, '2001'
FROM agri_core.prod_farm_cert c
-- 两边库的默认排序规则不同（utf8mb4_unicode_ci vs utf8mb4_0900_ai_ci），连接时必须显式统一，
-- 否则报 Illegal mix of collations（实测踩过）
JOIN agri_prod_farm_info f
  ON f.platform_farm_id COLLATE utf8mb4_unicode_ci = c.farm_id COLLATE utf8mb4_unicode_ci
WHERE c.cert_id LIKE 'DEMO-%' AND c.farm_id LIKE 'DEMO-%' AND c.deleted = 0;
