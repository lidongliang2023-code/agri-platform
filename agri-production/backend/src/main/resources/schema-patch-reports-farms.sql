-- 补丁：运营端「统计报表」与「农场监管-合规检查」两张表 + 演示数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-reports-farms.sql
--
-- 背景（2026-10-15 切运营端 admin/reports 与 admin/farms 这两块）：
--   两块的内容此前只存在于平台侧（agri_core.prod_report_task / prod_farm_compliance_check），
--   本服务一张表都没有 —— 直接切过去，页面会从"有数据"变成"空列表"。
--   字段按页面契约（api/admin/reports.ts 的 ReportTask、@agri/shared 的 ComplianceCheck）定。
--
-- 演示数据：内容沿用平台侧那几条**真实演示行**。
--   · 平台侧报表表里另有 3 条 RPT2026… 的行（名字是"生产监管报表 · 2025-07-14"、无状态），
--     那是历史验证脚本建出来的垃圾，没有搬；
--   · 合规检查搬了引用本库农场 1-3 的 8 条（平台侧共 14 条，其余引用的农场本库没有）。

CREATE TABLE IF NOT EXISTS agri_prod_report_task (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    report_code VARCHAR(64) NOT NULL UNIQUE COMMENT '报表编号（页面的 reportId）',
    report_type VARCHAR(20) COMMENT 'GOV 政务监管 / BIZ 经营 / QUALITY 质量',
    report_name VARCHAR(100),
    farm_id BIGINT COMMENT '限定农场；空表示全量',
    biz_date_from DATE,
    biz_date_to DATE,
    generator_id VARCHAR(64),
    file_url VARCHAR(255),
    generated_at DATETIME,
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING / RUNNING / DONE / FAILED',
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_report_task_type` (report_type),
    INDEX `idx_report_task_status` (status),
    INDEX `idx_report_task_tenant` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_farm_compliance_check (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    check_code VARCHAR(64) NOT NULL UNIQUE COMMENT '检查编号（页面的 checkId）',
    farm_id BIGINT,
    farm_name VARCHAR(100),
    check_type VARCHAR(32),
    check_item VARCHAR(200),
    check_result TINYINT COMMENT '1 合规 / 2 限期整改 / 3 严重违规',
    problem_desc VARCHAR(500),
    rectify_requirement VARCHAR(500),
    rectify_deadline DATE,
    checker_name VARCHAR(50),
    checked_at DATETIME,
    rectify_status VARCHAR(20) DEFAULT 'none' COMMENT 'none / pending / processing / rectified / overdue',
    rectify_remark VARCHAR(500),
    rectified_at DATETIME,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_compliance_check_farm` (farm_id),
    INDEX `idx_compliance_check_result` (check_result),
    INDEX `idx_compliance_check_tenant` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 演示报表（2 条，与平台侧演示行一致）
INSERT IGNORE INTO agri_prod_report_task
    (report_code, report_type, report_name, biz_date_from, biz_date_to, generator_id, file_url, generated_at, status, tenant_id, create_time, update_time)
VALUES
    ('DEMO-RPT-001', 'QUALITY', '2026年第三季度农产品质量安全报', '2026-07-01', '2026-09-30',
     'SUPER_ADMIN', 'https://demo.example.com/report/2026Q3-quality.pdf', '2026-10-02 09:00:00', 'DONE', '2001',
     '2026-10-02 09:00:00', '2026-10-02 09:00:00'),
    ('DEMO-RPT-002', 'GOV', '2026年度农产品质量追溯监管年报', '2026-01-01', '2026-12-31',
     'SUPER_ADMIN', NULL, NULL, 'PENDING', '2001',
     '2026-10-01 09:00:00', '2026-10-01 09:00:00');

-- 演示合规检查（8 条，引用本库农场 1/2/3，覆盖 合规 / 限期整改 / 严重违规 与 未整改/处理中/已整改/逾期 四种状态）
INSERT IGNORE INTO agri_prod_farm_compliance_check
    (check_code, farm_id, farm_name, check_type, check_item, check_result, problem_desc, rectify_requirement,
     rectify_deadline, checker_name, checked_at, rectify_status, rectify_remark, rectified_at, tenant_id, create_time, update_time)
VALUES
    ('DEMO-CHK-001', 1, '【演示】华南绿色蔬菜示范农场', '禁限用农资抽查', '甲拌磷等高毒农药禁用核查', 1,
     NULL, NULL, NULL, '监管员甲', '2026-08-12 10:30:00', 'none', NULL, NULL, '2001', '2026-08-12 10:30:00', '2026-08-12 10:30:00'),
    ('DEMO-CHK-002', 1, '【演示】华南绿色蔬菜示范农场', '记录缺失督导', '投入品使用记录台账完整性', 2,
     '5 月至 6 月共有 3 条用药记录缺失施用方式字段', '限期内补齐全部缺失字段，并提交台账复核申请',
     '2026-09-20', '监管员甲', '2026-09-05 14:00:00', 'rectified', '已补齐 3 条记录并通过复核', '2026-09-18 16:20:00',
     '2001', '2026-09-05 14:00:00', '2026-09-18 16:20:00'),
    ('DEMO-CHK-003', 1, '【演示】华南绿色蔬菜示范农场', '常规检查', '安全间隔期执行情况', 3,
     'C区辣椒地块在采收前 2 天检出农药施用记录，违反安全间隔期规定', '立即暂停该批次上市销售，整改后重新送检',
     '2026-10-20', '监管员乙', '2026-10-09 09:15:00', 'processing', '已暂停该批次出库，待复检', NULL,
     '2001', '2026-10-09 09:15:00', '2026-10-11 09:00:00'),
    ('DEMO-CHK-004', 1, '【演示】华南绿色蔬菜示范农场', '禁限用农资抽查', '库存禁用农药封存情况', 2,
     '仓库留存 2 瓶已禁用农药未按规定封存登记', '完成封存登记并移交属地农业综合执法机构',
     '2026-10-25', '监管员乙', '2026-10-10 11:00:00', 'pending', NULL, NULL, '2001', '2026-10-10 11:00:00', '2026-10-10 11:00:00'),
    ('DEMO-CHK-005', 2, '【演示】华东智慧稻田农场', '记录缺失督导', '水稻田间生产记录归档', 1,
     NULL, NULL, NULL, '监管员甲', '2026-09-18 15:40:00', 'none', NULL, NULL, '2001', '2026-09-18 15:40:00', '2026-09-18 15:40:00'),
    ('DEMO-CHK-006', 2, '【演示】华东智慧稻田农场', '常规检查', '灌溉水质检测频次', 2,
     '本季度灌溉水质仅检测 1 次，未满足每季度 2 次要求', '补做一次灌溉水质检测并留存报告',
     '2026-11-30', '监管员丙', '2026-10-08 10:20:00', 'pending', NULL, NULL, '2001', '2026-10-08 10:20:00', '2026-10-08 10:20:00'),
    ('DEMO-CHK-007', 3, '【演示】鲁中设施果蔬农场', '禁限用农资抽查', '禁限用农药网上追溯核验', 1,
     NULL, NULL, NULL, '监管员丙', '2026-09-22 09:00:00', 'none', NULL, NULL, '2001', '2026-09-22 09:00:00', '2026-09-22 09:00:00'),
    ('DEMO-CHK-008', 3, '【演示】鲁中设施果蔬农场', '常规检查', '绿色食品认证有效期', 2,
     '绿色食品认证已于 2026-01-21 到期，仍在产品包装上标注相关标识', '立即停止使用过期认证标识，完成换证后方可恢复',
     '2026-08-31', '监管员甲', '2026-07-15 13:30:00', 'overdue', '整改期限届满仍未提交换证材料，已移交执法线索', NULL,
     '2001', '2026-07-15 13:30:00', '2026-08-20 10:00:00');
