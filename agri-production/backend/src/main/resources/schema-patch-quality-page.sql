-- 一次性补丁：质量管理页（检测单 + 检测机构）。
--
-- 口径同前几页（2026-10-14 拍板）：以接口/实体为准，按契约建表。
--
-- 背景：
--   1) 旧的 agri_prod_quality_inspection 是另一套设计（inspection_code / inspect_date /
--      inspect_items / conclusion / audit_status），而实体映射的 15 列里有 12 列在那张表上
--      根本不存在 —— 运营端的检测单统计与列表一直是 Unknown column（接口 500）。
--      实测那张表 0 行，没有数据要迁，直接按契约另建 agri_prod_inspection。
--   2) 检测机构表原先不存在：页面"送检机构"下拉永远是空的（接口 404）。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-quality-page.sql
-- ⚠️ --default-character-set=utf8mb4 不能省：Windows 版 mysql 客户端默认按**系统本地编码**
--    （中文机器上是 gbk）声明连接，而本文件是 UTF-8。省掉它，脚本里的中文会被双重编码写进库，
--    且不可逆（本项目已实测踩过一次）。
--
-- 新库不用跑：schema-mysql.sql 里这些已经建全。

CREATE TABLE IF NOT EXISTS agri_prod_inspection (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    inspection_no VARCHAR(191) NOT NULL UNIQUE,
    batch_id BIGINT,
    batch_no VARCHAR(191),
    farm_id BIGINT,
    plot_id BIGINT,
    crop_id BIGINT,
    crop_name VARCHAR(191),
    inspection_type VARCHAR(32) COMMENT 'SELF 自检 / SEND 送检 / SAMPLING 抽检',
    inspector_id BIGINT,
    inspector_name VARCHAR(191),
    sample_qty DECIMAL(18,4),
    sample_at DATETIME,
    result VARCHAR(16) COMMENT 'PASS / FAIL，未出结论时为 NULL',
    report_url TEXT,
    status VARCHAR(32) DEFAULT 'PENDING' COMMENT 'PENDING / TESTING / DONE',
    lab_id BIGINT,
    lab_name VARCHAR(191),
    on_chain INT DEFAULT 0 COMMENT '1 已上链 / 0 未上链',
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_inspection_tenant_id` (tenant_id),
    INDEX `idx_inspection_batch_id` (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_testing_lab (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    lab_name VARCHAR(191) NOT NULL,
    lab_code VARCHAR(191) NOT NULL UNIQUE,
    lab_level INT COMMENT '1 国家级 / 2 省级 / 3 市级',
    contact_name VARCHAR(191),
    contact_phone VARCHAR(64),
    region VARCHAR(191),
    cert_no VARCHAR(191),
    status INT DEFAULT 1 COMMENT '1 合作中 / 0 已终止',
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_testing_lab_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO agri_prod_testing_lab
    (id, lab_name, lab_code, lab_level, contact_name, contact_phone, region, cert_no, status, tenant_id, remark)
VALUES
    (1, '黑龙江省农科院农产品质量检测中心', 'LAB-0001', 1, '王敏', '0451-86120001', '黑龙江省哈尔滨市',
     'HLJ-CMA-2024-001', 1, '2001', '国家级 CMA 资质'),
    (2, '中检集团黑龙江有限公司检测中心', 'LAB-0002', 2, '李强', '0451-86120002', '黑龙江省哈尔滨市',
     'CCIC-HLJ-2025-233', 1, '2001', '省级资质，可做农残与重金属'),
    (3, '五常市农产品质量安全检测站', 'LAB-0003', 3, '赵磊', '0451-86120003', '黑龙江省五常市',
     'WC-CMA-2023-017', 1, '2001', '市级资质，就近送检');

INSERT IGNORE INTO agri_prod_inspection
    (id, inspection_no, batch_id, batch_no, farm_id, plot_id, crop_name, inspection_type,
     inspector_name, sample_qty, sample_at, result, status, lab_id, lab_name, on_chain, tenant_id, remark)
VALUES
    (1, 'QC-DEMO-001', 1, 'H001', 1, 1, '西红柿', 'SEND',
     '张工', 2.0000, '2026-05-20 09:15:00', 'PASS', 'DONE', 1, '黑龙江省农科院农产品质量检测中心', 1, '2001',
     '送检农残 48 项，全部合格'),
    (2, 'QC-DEMO-002', 1, 'H001', 1, 1, '西红柿', 'SAMPLING',
     '赵磊', 1.0000, '2026-06-02 10:00:00', 'FAIL', 'DONE', 2, '中检集团黑龙江有限公司检测中心', 0, '2001',
     '抽检检出毒死蜱超标，已转不合格品处置'),
    (3, 'QC-DEMO-003', 1, 'H001', 1, 1, '西红柿', 'SELF',
     '张工', 3.0000, '2026-06-15 08:40:00', 'PASS', 'DONE', 3, '五常市农产品质量安全检测站', 0, '2001',
     '基地自检糖度与外观分级'),
    (4, 'QC-DEMO-004', NULL, NULL, 1, 1, '西红柿', 'SEND',
     '张工', 2.0000, '2026-07-01 14:20:00', NULL, 'TESTING', 2, '中检集团黑龙江有限公司检测中心', 0, '2001',
     '送检微生物指标，实验室检测中'),
    (5, 'QC-DEMO-005', NULL, NULL, 1, 1, '西红柿', 'SELF',
     '李四', 1.0000, '2026-07-10 09:00:00', NULL, 'PENDING', NULL, NULL, 0, '2001',
     '待安排抽样');
