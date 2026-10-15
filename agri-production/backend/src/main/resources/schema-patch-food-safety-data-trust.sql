-- 补丁：食品安全-可信农产品（P18）的演示数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-food-safety-data-trust.sql
--
-- 内容由平台库 agri_core 的 16 条演示行机械转换而来（去 market_id、tenant_id 统一 2001）。
-- 统计口径不落库：total/等级计数/pending 由 /trust-label/stats 实时聚合，所以这里不造汇总行 ——
-- 造了就会和明细对不上，而统计恰恰是这张页面上最容易被当真的数字。

INSERT IGNORE INTO agri_prod_fs_trust_product
    (product_id, tenant_id, product_name, category, producer, trust_level, trust_score, cert_mark, cert_org, valid_until, audit_status, audit_remark, audit_time, create_time, update_time, deleted)
VALUES
    ('DEMO-FS-TRP-001', '2001', '有机番茄', '蔬菜', '【演示】华南绿色蔬菜示范农场', 'diamond', 96, 'organic', '中绿华夏有机食品认证中心', '2027-05-31', 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-002', '2001', '稻渔香米', '粮食', '【演示】江汉稻渔综合种养农场', 'diamond', 94, 'green', '中国绿色食品发展中心', '2027-03-31', 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-003', '2001', '生态稻米', '粮食', '【演示】西北高原生态牧场', 'diamond', 93, 'organic', '中绿华夏有机食品认证中心', '2026-12-31', 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-004', '2001', '精品黄瓜', '蔬菜', '【演示】华东智慧稻田农场', 'diamond', 91, 'green', '中国绿色食品发展中心', '2027-08-31', 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-005', '2001', '鲜切花苗', '茶叶', '【演示】滇中花卉种苗基地', 'diamond', 90, 'pollution-free', '云南省农产品质量安全中心', '2027-01-31', 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-006', '2001', '绿色辣椒', '蔬菜', '【演示】鲁中设施果蔬农场', 'gold', 88, 'green', '中国绿色食品发展中心', '2027-06-30', 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-007', '2001', '高原稻谷', '粮食', '【演示】西北高原生态牧场', 'gold', 87, 'organic', '中绿华夏有机食品认证中心', '2027-04-30', 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-008', '2001', '小番茄', '蔬菜', '【演示】华南绿色蔬菜示范农场', 'gold', 85, 'pollution-free', '广东省农产品质量安全中心', '2027-02-28', 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-009', '2001', '温室黄瓜', '蔬菜', '【演示】华东智慧稻田农场', 'gold', 83, 'green', '中国绿色食品发展中心', '2026-11-30', 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-010', '2001', '螺丝椒', '蔬菜', '【演示】鲁中设施果蔬农场', 'gold', 80, 'none', NULL, NULL, 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-011', '2001', '稻渔米', '粮油', '【演示】江汉稻渔综合种养农场', 'silver', 76, 'pollution-free', '湖北省农产品质量安全中心', '2027-07-31', 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-012', '2001', '种苗礼盒', '茶叶', '【演示】滇中花卉种苗基地', 'silver', 74, 'none', NULL, NULL, 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-013', '2001', '生态鸡蛋', '禽蛋', '【演示】华南绿色蔬菜示范农场', 'silver', 71, 'pollution-free', '广东省农产品质量安全中心', '2027-09-30', 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-014', '2001', '塘鱼', '水产', '【演示】江汉稻渔综合种养农场', 'silver', 68, 'none', NULL, NULL, 'approved', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-015', '2001', '散养土鸡', '畜牧', '【演示】西北高原生态牧场', 'normal', 62, 'none', NULL, NULL, 'approved', '认证材料齐全，准予通过', '2026-10-10 21:53:43', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-TRP-016', '2001', '时令蔬菜包', '蔬菜', '【演示】鲁中设施果蔬农场', 'silver', 70, 'pollution-free', '海南省农产品质量安全中心', '2027-12-31', 'pending', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);
