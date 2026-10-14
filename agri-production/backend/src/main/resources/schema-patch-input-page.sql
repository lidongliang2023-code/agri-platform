-- 一次性补丁：农资投入品页（**只需跑一次**，ALTER 不幂等）。
--
-- 口径同前几页（2026-10-14 拍板）：以接口/实体为准，表按它们补齐，既有列一律不动。
--
-- 背景：
--   1) 档案表 agri_prod_input_material 缺 5 列（契约要 registrationNo / safetyInterval /
--      stockQty / warnQty / supplierId / status）。其中 warnQty 复用表上已有的
--      warning_threshold（语义相同：库存预警阈值），其余 4 列新增。
--   2) 实体 InputMaterial 原先映射的是 agri_prod_input_ledger —— 那张表从来没建过，
--      接口一调就是 Unknown column / Table doesn't exist。现在改回这张真实存在的表。
--   3) 库存流水、使用记录两张表原先根本不存在（页面上的"流水账 / 使用记录"恒为空）。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-input-page.sql
-- ⚠️ --default-character-set=utf8mb4 不能省：Windows 版 mysql 客户端默认按**系统本地编码**
--    （中文机器上是 gbk）声明连接，而本文件是 UTF-8。省掉它，脚本里的中文会被双重编码写进库 ——
--    实测演示数据落库成乱码，接口与页面跟着一起乱，且**不可逆**。
--
-- 新库不用跑：schema-mysql.sql 里这些已经建全。

ALTER TABLE agri_prod_input_material
    ADD COLUMN registration_no VARCHAR(191) NULL COMMENT '登记证号（前端 registrationNo）',
    ADD COLUMN safety_interval INT NULL COMMENT '安全间隔期，天（前端 safetyInterval）',
    ADD COLUMN stock_qty DECIMAL(18,4) DEFAULT 0 COMMENT '当前库存（前端 stockQty）',
    ADD COLUMN supplier_id BIGINT NULL COMMENT '默认供应商（前端 supplierId）',
    ADD COLUMN status INT DEFAULT 1 COMMENT '1启用 0停用（前端 status）';

CREATE TABLE IF NOT EXISTS agri_prod_input_stock_flow (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    input_id BIGINT NOT NULL,
    warehouse_id BIGINT,
    flow_type INT NOT NULL COMMENT '1入库 2领用 3退回 4盘盈 5盘亏 6报损',
    qty DECIMAL(18,4) NOT NULL COMMENT '带符号：入库/退回/盘盈为正，领用/盘亏/报损为负',
    batch_no VARCHAR(191),
    expire_date DATE,
    operator_id BIGINT,
    related_task_id BIGINT,
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_input_flow_input_id` (input_id),
    INDEX `idx_input_flow_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_input_usage (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT,
    plot_id BIGINT,
    farm_id BIGINT,
    input_id BIGINT,
    input_name VARCHAR(191),
    dosage DECIMAL(18,4),
    unit VARCHAR(64),
    method VARCHAR(64) COMMENT '施用方式：喷施 / 沟施 / 撒施 …',
    operator_id BIGINT,
    used_at DATETIME,
    safety_interval_days INT,
    status INT DEFAULT 1 COMMENT '1正常 0作废',
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_input_usage_input_id` (input_id),
    INDEX `idx_input_usage_task_id` (task_id),
    INDEX `idx_input_usage_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 老库：既有那两条种子的分类对齐到枚举（新建库在 schema-mysql.sql 里已经写对）
UPDATE agri_prod_input_material SET material_type = 'FERTILIZER' WHERE material_code = 'M001';
UPDATE agri_prod_input_material SET material_type = 'PESTICIDE' WHERE material_code = 'M002';
-- 前端「投入品」这一组页面（台账 / 出入库 / 使用记录 / 流水账）读的是：
--   api/inputs.ts 的 InputInfo（inputCode/inputName/inputType/spec/unit/manufacturer/
--   registrationNo/safetyInterval/stockQty/warnQty/supplierId/status + 后端回填的 nearestExpireDate）、
--   InputStockFlow（flowType 1入库 2领用 3退回 4盘盈 5盘亏 6报损，qty 带符号）、
--   types/input 的 InputUsageRecord（dosage / method 是契约字段名）。
-- 档案表 agri_prod_input_material 本来就有，缺的 5 列已在上面的 CREATE 里补齐
-- （老库由 schema-patch-input-page.sql 补）；流水与使用记录两张表原先根本不存在。
--
-- ⚠️ 演示数据的 input_id **一律按 material_code 子查询取**，不写死自增号：
--    这张表在建库脚本前面就已经种下两条（M001 有机肥料 / M002 生物农药），
--    先前演示行用 id 1..4 时主键撞车被 INSERT IGNORE 静默跳过，
--    流水于是挂到了那两条种子身上 —— 档案库存 0、流水却写着 +40，两处对不上。

CREATE TABLE IF NOT EXISTS agri_prod_input_stock_flow (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    input_id BIGINT NOT NULL,
    warehouse_id BIGINT,
    flow_type INT NOT NULL COMMENT '1入库 2领用 3退回 4盘盈 5盘亏 6报损',
    qty DECIMAL(18,4) NOT NULL COMMENT '带符号：入库/退回/盘盈为正，领用/盘亏/报损为负',
    batch_no VARCHAR(191),
    expire_date DATE,
    operator_id BIGINT,
    related_task_id BIGINT,
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_input_flow_input_id` (input_id),
    INDEX `idx_input_flow_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_input_usage (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT,
    plot_id BIGINT,
    farm_id BIGINT,
    input_id BIGINT,
    input_name VARCHAR(191),
    dosage DECIMAL(18,4),
    unit VARCHAR(64),
    method VARCHAR(64) COMMENT '施用方式：喷施 / 沟施 / 撒施 …',
    operator_id BIGINT,
    used_at DATETIME,
    safety_interval_days INT,
    status INT DEFAULT 1 COMMENT '1正常 0作废',
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_input_usage_input_id` (input_id),
    INDEX `idx_input_usage_task_id` (task_id),
    INDEX `idx_input_usage_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 四条农资覆盖页面上会出现的三种关键状态：正常、低库存且临期、低库存（无效期流水）。
-- stock_qty 与流水**必须对得上**（这是这一页最容易被看穿的假数据）：
--   复合肥 40 = +40；稻瘟灵 6 = +10 − 4；种子 30 = +30；基质盘 2 = +2
INSERT IGNORE INTO agri_prod_input_material
    (id, material_code, material_name, material_type, specification, unit, manufacturer,
     registration_no, safety_interval, stock_qty, warning_threshold, status, tenant_id, remark)
VALUES
    (101, 'IN-DEMO-001', '复合肥（水稻专用）', 'FERTILIZER', '50kg/袋', '袋', '中化化肥有限公司',
     '农肥（2024）准字1234号', NULL, 40.0000, 20.0000, 1, '2001', '底肥与分蘖肥通用'),
    (102, 'IN-DEMO-002', '稻瘟灵乳油', 'PESTICIDE', '500ml/瓶', '瓶', '湖南海利化工股份有限公司',
     'PD20231234', 21, 6.0000, 10.0000, 1, '2001', '防治稻瘟病，安全间隔期 21 天'),
    (103, 'IN-DEMO-003', '五常稻花香2号种子', 'SEED', '5kg/袋', '袋', '五常市种子公司',
     NULL, NULL, 30.0000, 10.0000, 1, '2001', '春茬水稻用种'),
    (104, 'IN-DEMO-004', '育秧基质盘', 'OTHER', '60片/箱', '箱', '哈尔滨农垦塑料制品厂',
     NULL, NULL, 2.0000, 5.0000, 1, '2001', '育秧周转用');

INSERT IGNORE INTO agri_prod_input_stock_flow
    (id, input_id, flow_type, qty, batch_no, expire_date, operator_id, related_task_id, remark, tenant_id)
VALUES
    (101, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-001'),
     1, 40.0000, 'F20260401', '2027-04-01', 1, NULL, '春耕备肥入库', '2001'),
    (102, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-002'),
     1, 10.0000, 'P20260410', '2026-10-20', 1, NULL, '防治药剂入库（临期，用于验证临期提示）', '2001'),
    (103, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-002'),
     2, -4.0000, 'P20260410', '2026-10-20', 1, 2, '分蘖期稻瘟病防治领用', '2001'),
    (104, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-003'),
     1, 30.0000, 'S20260320', '2027-03-20', 1, NULL, '春播用种入库', '2001'),
    (105, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-004'),
     1, 2.0000, 'M20260101', NULL, 1, NULL, '育秧基质盘入库（无生产效期）', '2001');

-- 使用记录：挂到已有的演示任务 1（春季施肥）/ 2（病虫害防治）上，"关联任务"列才有内容
INSERT IGNORE INTO agri_prod_input_usage
    (id, task_id, plot_id, farm_id, input_id, input_name, dosage, unit, method, operator_id,
     used_at, safety_interval_days, status, tenant_id, remark)
VALUES
    (101, 1, 1, 1, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-001'),
     '复合肥（水稻专用）', 40.0000, '袋', '沟施', 1, '2026-04-05 08:00:00', NULL, 1, '2001', '整地期施底肥'),
    (102, 2, 1, 1, (SELECT id FROM agri_prod_input_material WHERE material_code = 'IN-DEMO-002'),
     '稻瘟灵乳油', 4.0000, '瓶', '喷施', 1, '2026-05-12 09:30:00', 21, 1, '2001', '分蘖期稻瘟病防治');
