-- 库存台账：新增 prod_inventory（BT-01）+ 补齐批次入库状态 + 流水操作人（BT-07）
--
-- 背景（与既有事实对齐，勿凭直觉改）：
--   * V2__produce_domain.sql:573 建 prod_inventory_flow —— 那是**出入库流水**（每一次
--     变动一行，含 before_qty / after_qty），不是台账。全库此前**不存在任何库存台账表**，
--     所以 GET /harvests/inventory 只能返回流水，前端 InventoryRecord 契约的
--     inventoryId / warehouseName / currentQty / frozenQty / productName / category /
--     safeQty / expireDate / healthStatus / locationCode 十个字段全部取不到（BT-01）。
--   * 后果链：入库 / 报损 / 调拨 / 新增库存四个写接口没有表可写（BT-02/03/04/05），
--     库存详情页拿不到单条台账（BT-06）。本迁移是这五条工单的前置。
--
-- 本迁移做四件事，不多做：
--   1) 建 prod_inventory（库存台账，按 批次+仓库+库位 聚合当前库存）；
--   2) prod_harvest_batch 补 inbound_status / warehouse_name —— 此前后端从不返回这两个
--      字段，前端 Detail.tsx 用 (batch.inboundStatus ?? 0) !== 0 判断，恒为 0 导致
--      「所有批次恒显示待入库」；
--   3) prod_inventory_flow 补 operator_name / warehouse_name —— 此前 POST
--      /inventory/{batchId}/out 只收 operatorId，调用方传的 operatorName 既不落库也不
--      报错（BT-07：静默丢弃）。落库而不是"明确拒绝"，因为前端 StockInPayload /
--      LossPayload 都真实传了 operatorName；
--   4) 灌入 DEMO-INVT-* 演示种子（与本项目其它表一致的 DEMO- 前缀口径），
--      并对已有 DEMO-BATCH-* 批次回填入库状态与仓库名。
--
-- 口径纪律：
--   * 全部列沿用 PRD 11.2 审计列命名（create_by / update_by / create_at / update_at /
--     deleted），与 prod_harvest_batch 完全一致，由 MyMetaObjectHandler 自动填充。
--   * market_id / tenant_id 取 ADR-005 行级隔离口径，与其它表一致。
--   * 种子用 INSERT IGNORE：若目标库已存在同主键行则保留原行，不覆盖、不堆积。

-- ---------------------------------------------------------------- 1. 库存台账
CREATE TABLE prod_inventory (
    inventory_id   VARCHAR(32)   NOT NULL COMMENT 'inventoryId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    batch_id       VARCHAR(32)   NOT NULL COMMENT '采收批次ID',
    batch_no       VARCHAR(32)   COMMENT '批次号（冗余，台账列表直接展示）',
    warehouse_id   VARCHAR(32)   COMMENT '仓库ID（无仓库主数据表，留待后续接入）',
    warehouse_name VARCHAR(64)   COMMENT '仓库名称',
    location_code  VARCHAR(32)   COMMENT '库位编号',
    product_name   VARCHAR(64)   COMMENT '品名，如「番茄(A级)」',
    category       VARCHAR(32)   COMMENT '品类，如 番茄/黄瓜/辣椒',
    grade          VARCHAR(10)   COMMENT '质量等级（冗余自批次 grade）',
    current_qty    DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '当前库存数量',
    frozen_qty     DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '冻结数量',
    safe_qty       DECIMAL(12,2) COMMENT '安全库存',
    unit           VARCHAR(10)   COMMENT '计量单位，默认 kg',
    loss_qty       DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '累计损耗数量',
    loss_reason    VARCHAR(200)  COMMENT '最近损耗原因',
    last_in_at     DATETIME      COMMENT '最近入库时间',
    last_out_at    DATETIME      COMMENT '最近出库时间',
    expire_date    DATE          COMMENT '保质期至',
    health_status  VARCHAR(16)   COMMENT '库存健康状态 normal正常 warning预警 shortage不足 expiring临期',
    frozen         TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '是否冻结 0否 1是',
    related_batch_no VARCHAR(32) COMMENT '关联采收批次号',
    remark         VARCHAR(200)  COMMENT '备注',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (inventory_id),
    KEY idx_inventory_market (market_id),
    KEY idx_inventory_batch (batch_id),
    KEY idx_inventory_warehouse (warehouse_name),
    KEY idx_inventory_category (category),
    KEY idx_inventory_health (health_status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '库存台账（按批次+仓库+库位聚合当前库存）';

-- -------------------------------------------- 2. 批次入库状态与仓库名（观察项裁决）
ALTER TABLE prod_harvest_batch
    ADD COLUMN inbound_status TINYINT     NOT NULL DEFAULT 0 COMMENT '入库状态 0未入库 1已入库 2部分入库' AFTER status,
    ADD COLUMN warehouse_name VARCHAR(64) COMMENT '入库仓库名称（冗余自库存台账）' AFTER inbound_status;

-- ------------------------------------------------- 3. 流水补操作人与仓库名（BT-07）
ALTER TABLE prod_inventory_flow
    ADD COLUMN operator_name VARCHAR(32) COMMENT '操作人姓名' AFTER operator_id,
    ADD COLUMN warehouse_name VARCHAR(64) COMMENT '仓库名称（调拨/出库展示）' AFTER operator_name;

-- ------------------------------------------------------------------ 4. 演示种子
-- 口径与 scripts/seed-demo-data.sql 第 10 节保持一致（market_id=1 / tenant_id=0 /
-- deleted=0）。主键前缀取 DEMO-INVT-，与流水的 DEMO-INV- 前缀物理区分，
-- 避免与既有 DELETE FROM prod_inventory_flow WHERE flow_id LIKE 'DEMO-INV-%' 互伤。
INSERT IGNORE INTO prod_inventory (
    inventory_id, market_id, tenant_id, batch_id, batch_no, warehouse_id, warehouse_name,
    location_code, product_name, category, grade, current_qty, frozen_qty, safe_qty, unit,
    loss_qty, loss_reason, last_in_at, last_out_at, expire_date, health_status, frozen,
    related_batch_no, remark,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-INVT-001', 1, 0, 'DEMO-BATCH-001', 'DEMO-BATCHN-001', 'DEMO-WH-001', '冷藏库A',
 'A-01-02', '番茄(一级)', '番茄', '一级', 5400.00, 0.00, 200.00, 'kg',
 120.00, NULL, '2026-06-28 19:00:00', '2026-07-02 10:30:00', '2026-08-28', 'normal', 0,
 'DEMO-BATCHN-001', '演示数据：番茄批次台账（8600 入库 -3200 出库）',
 1, 1, '2026-06-28 19:00:00', '2026-10-10 09:00:00', 0),
('DEMO-INVT-002', 1, 0, 'DEMO-BATCH-002', 'DEMO-BATCHN-002', 'DEMO-WH-001', '冷藏库A',
 'A-02-01', '黄瓜(一级)', '黄瓜', '一级', 5080.00, 0.00, 150.00, 'kg',
 120.00, '冷链运输损耗', '2026-07-26 19:00:00', '2026-07-30 09:00:00', '2026-08-26', 'normal', 0,
 'DEMO-BATCHN-002', '演示数据：黄瓜批次台账（5200 入库 -120 报损）',
 1, 1, '2026-07-26 19:00:00', '2026-10-10 09:00:00', 0),
('DEMO-INVT-003', 1, 0, 'DEMO-BATCH-003', 'DEMO-BATCHN-003', 'DEMO-WH-002', '冷藏库B',
 'B-01-03', '辣椒(待检)', '辣椒', '待检', 620.00, 0.00, 500.00, 'kg',
 0.00, NULL, '2026-09-28 15:00:00', NULL, '2026-10-28', 'warning', 0,
 'DEMO-BATCHN-003', '演示数据：辣椒批次台账（低于安全库存，预警）',
 1, 1, '2026-09-28 15:00:00', '2026-10-10 09:00:00', 0),
('DEMO-INVT-004', 1, 0, 'DEMO-BATCH-004', 'DEMO-BATCHN-004', 'DEMO-WH-002', '主仓库',
 'M-01-01', '稻谷(二级)', '稻谷', '二级', 96000.00, 0.00, 1000.00, 'kg',
 0.00, NULL, '2026-10-08 20:00:00', NULL, '2027-10-08', 'normal', 0,
 'DEMO-BATCHN-004', '演示数据：稻谷批次台账',
 1, 1, '2026-10-08 20:00:00', '2026-10-10 09:00:00', 0),
('DEMO-INVT-005', 1, 0, 'DEMO-BATCH-005', 'DEMO-BATCHN-005', 'DEMO-WH-003', '冷藏库C',
 'C-02-04', '辣椒(一级)', '辣椒', '一级', 80.00, 200.00, 800.00, 'kg',
 0.00, NULL, '2026-09-20 17:30:00', NULL, '2026-10-12', 'shortage', 1,
 'DEMO-BATCHN-005', '演示数据：辣椒批次台账（冻结 200kg，库存不足）',
 1, 1, '2026-09-20 17:30:00', '2026-10-10 09:00:00', 0);

-- 对既有演示批次回填入库状态与仓库名：填的是「该批次是否真的进了库」这一真值，
-- 与上面台账种子同源（同一 batch_id），不凭空给没有台账的批次标已入库。
UPDATE prod_harvest_batch
   SET inbound_status = 1,
       warehouse_name = '冷藏库A'
 WHERE batch_id = 'DEMO-BATCH-001';

UPDATE prod_harvest_batch
   SET inbound_status = 1,
       warehouse_name = '冷藏库A'
 WHERE batch_id = 'DEMO-BATCH-002';

UPDATE prod_harvest_batch
   SET inbound_status = 1,
       warehouse_name = '冷藏库B'
 WHERE batch_id = 'DEMO-BATCH-003';

UPDATE prod_harvest_batch
   SET inbound_status = 1,
       warehouse_name = '主仓库'
 WHERE batch_id = 'DEMO-BATCH-004';

UPDATE prod_harvest_batch
   SET inbound_status = 1,
       warehouse_name = '冷藏库C'
 WHERE batch_id = 'DEMO-BATCH-005';

-- DEMO-BATCH-006 是「已冻结」批次（status=4）且无台账，保持 0 未入库 —— 这是真值，
-- 不回填。前端 Detail.tsx 的 (inboundStatus ?? 0) !== 0 因此会在这一条上正确显示待入库。
