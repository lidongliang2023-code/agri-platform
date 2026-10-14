-- 补丁：采收批次 / 成品库存 / 库存流水三张表 + 演示数据（可重复执行）。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-harvest-batch.sql
-- 说明见 schema-mysql.sql 末尾同名段落。

CREATE TABLE IF NOT EXISTS agri_prod_harvest_batch (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    batch_no VARCHAR(191) NOT NULL UNIQUE,
    plot_id BIGINT,
    plot_name VARCHAR(191),
    plan_id BIGINT,
    crop_id BIGINT,
    crop_name VARCHAR(191),
    crop_variety VARCHAR(191),
    harvest_date DATE,
    quantity DECIMAL(18,4),
    unit VARCHAR(32),
    grade VARCHAR(32),
    inspection_id BIGINT,
    inspection_no VARCHAR(191),
    operator_id BIGINT,
    operator_name VARCHAR(191),
    status INT DEFAULT 1,
    trace_generated INT DEFAULT 0,
    trace_code VARCHAR(191),
    farm_id BIGINT,
    farm_name VARCHAR(191),
    inbound_status INT DEFAULT 0,
    harvest_area DECIMAL(12,4),
    appearance VARCHAR(32),
    expected_quantity DECIMAL(18,4),
    per_mu_yield DECIMAL(18,4),
    related_task_id BIGINT,
    related_task_name VARCHAR(191),
    warehouse_name VARCHAR(191),
    inventory_id BIGINT,
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_harvest_batch_tenant_id` (tenant_id),
    INDEX `idx_harvest_batch_plot_id` (plot_id),
    INDEX `idx_harvest_batch_farm_id` (farm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_inventory (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    batch_no VARCHAR(191),
    warehouse_name VARCHAR(191) NOT NULL,
    current_qty DECIMAL(18,4) DEFAULT 0,
    unit VARCHAR(32),
    frozen_qty DECIMAL(18,4) DEFAULT 0,
    location_code VARCHAR(64),
    last_in_at DATETIME,
    last_out_at DATETIME,
    product_name VARCHAR(191),
    category VARCHAR(64),
    grade VARCHAR(32),
    safe_qty DECIMAL(18,4),
    expire_date DATE,
    related_batch_no VARCHAR(191),
    loss_qty DECIMAL(18,4) DEFAULT 0,
    loss_reason VARCHAR(191),
    frozen INT DEFAULT 0,
    remark TEXT,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_inventory_tenant_id` (tenant_id),
    INDEX `idx_inventory_batch_id` (batch_id),
    INDEX `idx_inventory_warehouse` (warehouse_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_inventory_flow (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    flow_type INT NOT NULL,
    quantity DECIMAL(18,4),
    unit VARCHAR(32),
    operator_name VARCHAR(191),
    order_no VARCHAR(191),
    operated_at DATETIME,
    remark TEXT,
    warehouse_name VARCHAR(191),
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_inv_flow_batch_id` (batch_id),
    INDEX `idx_inv_flow_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO agri_prod_harvest_batch
    (id, batch_no, plot_id, plot_name, crop_id, crop_name, crop_variety, harvest_date, quantity, unit,
     grade, operator_id, operator_name, status, trace_generated, trace_code, farm_id, farm_name,
     inbound_status, harvest_area, appearance, expected_quantity, per_mu_yield, warehouse_name,
     inventory_id, tenant_id, remark)
VALUES
    (1, 'H20260601', 1, 'A区-地块1', 1, '西红柿', '中杂9号', '2026-06-01', 1250.0000, 'kg',
     'A', 1, '张工', 1, 1, 'AG010101202606010001', 1, '示范农场',
     1, 2.0000, '优', 1500.0000, 625.0000, '冷藏库A', 1, '2001', '头茬果，全数入库'),
    (2, 'H20260528', 2, 'A区-地块2', 1, '西红柿', '中杂9号', '2026-05-28', 850.0000, 'kg',
     'B', 1, '张工', 2, 1, 'AG010102202605280001', 1, '示范农场',
     2, 1.5000, '良', 1200.0000, 567.0000, '冷藏库A', 2, '2001', '已出库 450kg 给批发商'),
    (3, 'H20260525', 1, 'A区-地块1', 1, '西红柿', '中杂9号', '2026-05-25', 620.0000, 'kg',
     'C', 1, '张工', 1, 0, NULL, 1, '示范农场',
     0, 1.0000, '中', 900.0000, 620.0000, NULL, NULL, '2001', '待入库');

INSERT IGNORE INTO agri_prod_inventory
    (id, batch_id, batch_no, warehouse_name, current_qty, unit, frozen_qty, location_code, last_in_at,
     last_out_at, product_name, category, grade, safe_qty, expire_date, related_batch_no, loss_qty,
     frozen, tenant_id, remark)
VALUES
    (1, 1, 'H20260601', '冷藏库A', 1250.0000, 'kg', 0, 'A-01-02', '2026-06-01 15:00:00',
     NULL, '西红柿(A级)', '西红柿', 'A', 200.0000, '2026-06-15', 'H20260601', 0, 0, '2001', NULL),
    (2, 2, 'H20260528', '冷藏库A', 400.0000, 'kg', 0, 'A-02-01', '2026-05-28 16:20:00',
     '2026-06-02 10:00:00', '西红柿(B级)', '西红柿', 'B', 150.0000, '2026-06-10', 'H20260528', 0, 0, '2001', NULL);

INSERT IGNORE INTO agri_prod_inventory_flow
    (id, batch_id, flow_type, quantity, unit, operator_name, order_no, operated_at, remark,
     warehouse_name, tenant_id)
VALUES
    (1, 1, 1, 1250.0000, 'kg', '张工', NULL, '2026-06-01 15:00:00', '采收入库', '冷藏库A', '2001'),
    (2, 2, 1, 850.0000, 'kg', '张工', NULL, '2026-05-28 16:20:00', '采收入库', '冷藏库A', '2001'),
    (3, 2, 2, -450.0000, 'kg', '张工', 'SO20260602', '2026-06-02 10:00:00', '销售出库', '冷藏库A', '2001');
