-- 补丁：地块主数据 + 土壤检测档案（可重复执行；本轮 farms/plots 段第一步）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-plot-soil-demo.sql
--
-- 【为什么先做这一步】/plots 段仍在平台侧服务，而土壤检测（/{plotId}/soil*）已经切到本服务：
-- 页面传回的地块标识是平台侧的 DEMO-PLOT-xxx，本服务的地块主键是数字 id。
-- 与农场表的 platform_farm_id 同法，这里给地块表补 platform_plot_id，把平台侧演示地块搬过来 ——
-- 顺带解决"切 /plots 段会丢数据"（本服务原来只有 3 个本地演示地块）。
--
-- 机械转换口径：
--   plot_code / plot_name / area / soil_type / irrigation_type 照抄；
--   boundary ← geo_boundary、farm_id ← 平台农场标识经 platform_farm_id 换算、platform_plot_id ← plot_id；
--   current_crop **留空**：平台侧的 prod_plot_info 只有 crop_id（DEMO-CROP-001）与 crop_variety（普罗旺斯），
--   没有"作物名称"这一层数据源，硬拿品种当作物名会让"作物分布"这类聚合算到品种上；
--   status 统一 'active'（平台侧 status 是 1/2/3 的数字枚举，含义与本服务的文本口径不同，逐一对应属产品口径）。
--
--   土壤档案：sample_date→sample_date、ph→ph_value、organic_matter→organic_matter、
--   nitrogen→nitrogen、phosphorus→phosphorus、potassium→potassium、moisture→moisture_content、
--   tester→tester 照抄；**salinity 不映射到 conductivity**（含盐量与电导率是两回事，宁可留空），
--   test_org / conclusion / report_url 平台侧没有对应列，一并留空。
--   排除了探针空体写入的垃圾行（prod_plot_soil 44 行里 38 行 soil_id 形如 SOIL2026…）。
--
-- 数量：地块 25 个、土壤档案 6 条。

-- 1) 地块表补平台标识列（守卫式 ALTER：列已存在则不动）
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_plot_info'
        AND COLUMN_NAME = 'platform_plot_id') = 0,
  'ALTER TABLE agri_prod_plot_info ADD COLUMN platform_plot_id VARCHAR(64) NULL COMMENT ''平台侧地块标识（DEMO-PLOT-xxx）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_plot_info'
        AND INDEX_NAME = 'uk_plot_platform_id') = 0,
  'ALTER TABLE agri_prod_plot_info ADD UNIQUE KEY uk_plot_platform_id (platform_plot_id)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) 平台侧演示地块（plot_code 唯一，INSERT IGNORE 可重复执行）
INSERT IGNORE INTO agri_prod_plot_info
    (plot_code, plot_name, farm_id, area, soil_type, irrigation_type, boundary, status,
     platform_plot_id, tenant_id)
VALUES
    ('DEMO-PLOTC-001', 'A区连栋大棚', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-001'), 42.50, '壤土', '滴灌', '{"type":"Polygon","coordinates":[[[113.61,23.52],[113.62,23.52],[113.62,23.53],[113.61,23.53],[113.61,23.52]]]}', 'active', 'DEMO-PLOT-001', '2001'),
    ('DEMO-PLOTC-002', 'B区露天菜田', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-001'), 68.00, '沙壤土', '喷灌', NULL, 'active', 'DEMO-PLOT-002', '2001'),
    ('DEMO-PLOTC-003', 'C区露天菜田', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-001'), 55.30, '壤土', '沟灌', NULL, 'active', 'DEMO-PLOT-003', '2001'),
    ('DEMO-PLOTC-004', 'D区育苗棚', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-001'), 18.00, '草炭土', '微喷', NULL, 'active', 'DEMO-PLOT-004', '2001'),
    ('DEMO-PLOTC-005', 'E区休耕地', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-001'), 36.00, '黏壤土', '无灌溉', NULL, 'active', 'DEMO-PLOT-005', '2001'),
    ('DEMO-PLOTC-006', '智慧稻田东片区', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-002'), 420.00, '水稻土', '渠灌', NULL, 'active', 'DEMO-PLOT-006', '2001'),
    ('DEMO-PLOTC-007', '智慧稻田西片区', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-002'), 396.00, '水稻土', '渠灌', NULL, 'active', 'DEMO-PLOT-007', '2001'),
    ('DEMO-PLOTC-008', '智慧稻田中片区', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-002'), 455.00, '水稻土', '渠灌', NULL, 'active', 'DEMO-PLOT-008', '2001'),
    ('DEMO-PLOTC-009', '智慧稻田北片区', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-002'), 302.00, '盐化水稻土', '渠灌', NULL, 'active', 'DEMO-PLOT-009', '2001'),
    ('DEMO-PLOTC-010', '1号日光温室', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-003'), 8.60, '潮土', '膜下滴灌', NULL, 'active', 'DEMO-PLOT-010', '2001'),
    ('DEMO-PLOTC-011', '2号日光温室', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-003'), 8.20, '潮土', '膜下滴灌', NULL, 'active', 'DEMO-PLOT-011', '2001'),
    ('DEMO-PLOTC-012', '3号日光温室', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-003'), 8.80, '潮土', '膜下滴灌', NULL, 'active', 'DEMO-PLOT-012', '2001'),
    ('DEMO-PLOTC-013', '4号日光温室', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-003'), 7.90, '潮土', '膜下滴灌', NULL, 'active', 'DEMO-PLOT-013', '2001'),
    ('DEMO-PLOTC-014', '露天大田东区', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-003'), 120.00, '潮褐土', '喷灌', NULL, 'active', 'DEMO-PLOT-014', '2001'),
    ('DEMO-PLOTC-015', '工厂化育苗中心', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-003'), 5.00, '基质', '潮汐灌溉', NULL, 'active', 'DEMO-PLOT-015', '2001'),
    ('DEMO-PLOTC-016', '牧草种植区A', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-004'), 860.00, '栗钙土', '喷灌', NULL, 'active', 'DEMO-PLOT-016', '2001'),
    ('DEMO-PLOTC-017', '牧草种植区B', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-004'), 740.00, '栗钙土', '喷灌', NULL, 'active', 'DEMO-PLOT-017', '2001'),
    ('DEMO-PLOTC-018', '舍饲养殖区', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-004'), 96.00, '灰钙土', '无灌溉', NULL, 'active', 'DEMO-PLOT-018', '2001'),
    ('DEMO-PLOTC-019', '稻渔综合区1号田', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-005'), 168.00, '水稻土', '渠灌', NULL, 'active', 'DEMO-PLOT-019', '2001'),
    ('DEMO-PLOTC-020', '稻渔综合区2号田', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-005'), 155.00, '水稻土', '渠灌', NULL, 'active', 'DEMO-PLOT-020', '2001'),
    ('DEMO-PLOTC-021', '稻渔综合区3号田', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-005'), 176.00, '潴育水稻土', '渠灌', NULL, 'active', 'DEMO-PLOT-021', '2001'),
    ('DEMO-PLOTC-022', '稻渔综合区4号田', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-005'), 142.00, '潴育水稻土', '渠灌', NULL, 'active', 'DEMO-PLOT-022', '2001'),
    ('DEMO-PLOTC-023', '花卉A棚', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-006'), 12.00, '红壤', '滴灌', NULL, 'active', 'DEMO-PLOT-023', '2001'),
    ('DEMO-PLOTC-024', '花卉B棚', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-006'), 12.50, '红壤', '滴灌', NULL, 'active', 'DEMO-PLOT-024', '2001'),
    ('DEMO-PLOTC-025', '种苗繁育区', (SELECT id FROM agri_prod_farm_info WHERE platform_farm_id = 'DEMO-FARM-006'), 9.00, '基质', '微喷', NULL, 'active', 'DEMO-PLOT-025', '2001');

-- 3) 土壤检测档案表补页面契约需要的列（同样是守卫式 ALTER）
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_soil_record'
        AND COLUMN_NAME = 'farm_id') = 0,
  'ALTER TABLE agri_prod_soil_record ADD COLUMN farm_id BIGINT NULL COMMENT ''所属农场（本服务农场主键）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_soil_record'
        AND COLUMN_NAME = 'tester') = 0,
  'ALTER TABLE agri_prod_soil_record ADD COLUMN tester VARCHAR(64) NULL COMMENT ''检测人（页面 tester）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_soil_record'
        AND COLUMN_NAME = 'test_org') = 0,
  'ALTER TABLE agri_prod_soil_record ADD COLUMN test_org VARCHAR(100) NULL COMMENT ''检测机构（页面 testOrg；本部署无数据源）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_soil_record'
        AND COLUMN_NAME = 'conductivity') = 0,
  'ALTER TABLE agri_prod_soil_record ADD COLUMN conductivity DECIMAL(10,4) NULL COMMENT ''电导率（页面 conductivity；平台侧只有含盐量，不混用）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_soil_record'
        AND COLUMN_NAME = 'conclusion') = 0,
  'ALTER TABLE agri_prod_soil_record ADD COLUMN conclusion VARCHAR(500) NULL COMMENT ''检测结论（页面 conclusion）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_soil_record'
        AND COLUMN_NAME = 'report_url') = 0,
  'ALTER TABLE agri_prod_soil_record ADD COLUMN report_url VARCHAR(500) NULL COMMENT ''检测报告附件（页面 reportUrl）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_soil_record'
        AND COLUMN_NAME = 'soil_id') = 0,
  'ALTER TABLE agri_prod_soil_record ADD COLUMN soil_id VARCHAR(64) NULL COMMENT ''档案编号（业务主键，页面 recordId）''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_soil_record'
        AND INDEX_NAME = 'uk_soil_soil_id') = 0,
  'ALTER TABLE agri_prod_soil_record ADD UNIQUE KEY uk_soil_soil_id (soil_id)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) 演示土壤档案（soil_id 唯一，INSERT IGNORE 可重复执行）
INSERT IGNORE INTO agri_prod_soil_record
    (plot_id, sample_date, ph_value, organic_matter, nitrogen, phosphorus, potassium, moisture_content,
     tester, soil_id, remark, farm_id, tenant_id)
VALUES
    ((SELECT id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-001'), '2026-03-12', 6.45, 28.60, 118.00, 42.30, 186.50, 24.80, '周农业', 'DEMO-SOIL-001', '演示数据：播种前基线采样', (SELECT farm_id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-001'), '2001'),
    ((SELECT id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-002'), '2026-03-12', 6.10, 22.40, 96.50, 35.80, 152.00, 21.30, '周农业', 'DEMO-SOIL-002', '演示数据：有机质偏低，建议增施有机肥', (SELECT farm_id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-002'), '2001'),
    ((SELECT id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-006'), '2026-04-08', 7.02, 31.20, 132.40, 28.60, 210.30, 32.10, '孙技员', 'DEMO-SOIL-003', '演示数据：水稻田常规监测', (SELECT farm_id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-006'), '2001'),
    ((SELECT id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-010'), '2026-02-25', 6.80, 34.50, 156.00, 88.20, 268.40, 26.50, '吴土肥', 'DEMO-SOIL-004', '演示数据：设施土壤盐渍化需关注', (SELECT farm_id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-010'), '2001'),
    ((SELECT id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-016'), '2026-05-16', 8.15, 18.90, 62.30, 18.40, 142.60, 15.20, '马技术', 'DEMO-SOIL-005', '演示数据：高原碱性土壤', (SELECT farm_id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-016'), '2001'),
    ((SELECT id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-019'), '2026-04-22', 6.55, 29.80, 124.60, 33.20, 178.90, 38.40, '胡水产', 'DEMO-SOIL-006', '演示数据：稻渔共生田，含水率偏高属正常', (SELECT farm_id FROM agri_prod_plot_info WHERE platform_plot_id = 'DEMO-PLOT-019'), '2001');
