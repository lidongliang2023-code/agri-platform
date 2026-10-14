-- 一次性补丁：生产计划页（**只需跑一次**，ALTER 不幂等）。
--
-- 口径同前两页（2026-10-14 拍板）：以接口/实体为准，表按它们补齐，既有列一律不动。
--
-- 背景（scripts/check-entity-columns.mjs 照出来的 13 处）：
--   实体 PlantingPlan 映射了 plan_year / plan_season / plan_status / total_area / total_budget /
--   expected_output / expected_profit / start_date / end_date / plan_summary /
--   approval_comment / approver / approval_time —— 表里一列都没有。
--   只要有一列不存在，MyBatis-Plus 生成的 SELECT 就会带上它 → 整个计划接口
--   Unknown column（这正是农事任务那一页踩过的同一个坑）。
--   另外前端 Plan 契约还要 plot_name / crop_id / crop_name / crop_variety / manager_id /
--   manager_name / sop_template_id / farm_name（后两个是冗余展示字段）。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-plan-page.sql
-- ⚠️ --default-character-set=utf8mb4 不能省：Windows 版 mysql 客户端默认按**系统本地编码**
--    （中文机器上是 gbk）声明连接，而本文件是 UTF-8。省掉它，脚本里的中文会被双重编码写进库 ——
--    实测演示数据落库成 "2026 骞存槬鑼?按绋荤?妞嶈?鍒"，接口与页面跟着一起乱，且**不可逆**。
-- 新库不用跑：schema-mysql.sql 里这张表已经建全。

ALTER TABLE agri_prod_planting_plan
    ADD COLUMN plan_year BIGINT NULL COMMENT '计划年度（实体字段）',
    ADD COLUMN plan_season VARCHAR(191) NULL COMMENT '计划季节（实体字段）',
    ADD COLUMN plan_status VARCHAR(255) DEFAULT 'draft' COMMENT '计划状态：draft/pending/active/completed/terminated（实体字段）',
    ADD COLUMN total_area DECIMAL(18,4) NULL COMMENT '计划面积（亩，实体字段）',
    ADD COLUMN total_budget DECIMAL(18,4) NULL COMMENT '计划预算（实体字段）',
    ADD COLUMN expected_output DECIMAL(18,4) NULL COMMENT '计划产量（前端 expectedYield）',
    ADD COLUMN expected_profit DECIMAL(18,4) NULL COMMENT '预期收益（实体字段）',
    ADD COLUMN start_date DATETIME NULL COMMENT '计划开始日期',
    ADD COLUMN end_date DATETIME NULL COMMENT '计划结束日期',
    ADD COLUMN plan_summary TEXT NULL COMMENT '计划说明（实体字段）',
    ADD COLUMN approval_comment TEXT NULL COMMENT '审批意见',
    ADD COLUMN approver VARCHAR(191) NULL COMMENT '审批人',
    ADD COLUMN approval_time DATETIME NULL COMMENT '审批时间',
    ADD COLUMN plot_name VARCHAR(191) NULL COMMENT '地块名称（冗余展示）',
    ADD COLUMN farm_name VARCHAR(191) NULL COMMENT '农场名称（冗余展示）',
    ADD COLUMN crop_id BIGINT NULL COMMENT '作物ID（前端 cropId）',
    ADD COLUMN crop_name VARCHAR(191) NULL COMMENT '作物名称（前端 cropName）',
    ADD COLUMN crop_variety VARCHAR(191) NULL COMMENT '作物品种（前端 cropVariety）',
    ADD COLUMN manager_id BIGINT NULL COMMENT '负责人ID（前端 managerId）',
    ADD COLUMN manager_name VARCHAR(191) NULL COMMENT '负责人姓名（前端 managerName）',
    ADD COLUMN sop_template_id BIGINT NULL COMMENT '关联 SOP 模板ID（前端 sopTemplateId）';

-- 演示计划（plan_status 用词表值；出参由 VO 映射成前端契约的 1..5）
INSERT IGNORE INTO agri_prod_planting_plan
    (plan_code, plan_name, plan_year, plan_season, plan_status, total_area, total_budget,
     expected_output, expected_profit, start_date, end_date, plan_summary,
     farm_id, farm_name, plot_id, plot_name, crop_id, crop_name, crop_variety,
     manager_id, manager_name, sop_template_id, tenant_id)
VALUES
    ('PLAN-2026-SPR-01', '2026 年春茬水稻种植计划', 2026, '春季', 'active', 120.0000, 86000.0000,
     60000.0000, 42000.0000, '2026-04-01 00:00:00', '2026-09-30 00:00:00',
     '五常基地春茬水稻：4 月整地播种，9 月收获；配套追肥与病虫防治 SOP。',
     1, '示范农场', 1, 'A区-地块1', 1, '水稻', '五常稻花香2号',
     1, '张工（农场管理员）', (SELECT id FROM agri_prod_task_template WHERE template_code = 'TPL-FERT-01'), '2001');

-- ---------------------------------------------------------------- 生育期阶段（种养计划详情页）
-- 前端「种养计划详情」页要读/写它：GET /plans/{planId}/stages/list 与
-- POST/PUT/DELETE /plans/{planId}/stages[/{stageId}]；实体 PlanStage 已按契约写好，
-- 而建表脚本里一直没有这张表 —— 一调就是 "Table 'agri_production.agri_prod_plan_stage'
-- doesn't exist"，详情页的阶段列表恒为空、新增阶段必然失败。
-- 列名按实体（= 接口口径）建。刻意**没有 farm_id**：阶段按"租户 + 计划"归属。
CREATE TABLE IF NOT EXISTS agri_prod_plan_stage (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    plan_id BIGINT NOT NULL,
    stage_seq INT,
    stage_name VARCHAR(191) NOT NULL,
    task_type VARCHAR(191),
    plan_start_date DATE,
    plan_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    description TEXT,
    status INT DEFAULT 1,
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_plan_stage_plan_id` (plan_id),
    INDEX `idx_plan_stage_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 演示阶段：与演示计划 PLAN-2026-SPR-01 的说明一致（4 月整地播种 → 9 月收获）。
-- 前两个阶段已完成、第三个进行中、第四个未开始 —— 详情页的完成率与"最大延误"两处判定
-- 都需要"有真有假"的输入才有意义（全部已完成等于没验）。
INSERT IGNORE INTO agri_prod_plan_stage
    (id, plan_id, stage_seq, stage_name, task_type, plan_start_date, plan_end_date,
     actual_start_date, actual_end_date, description, status, tenant_id)
VALUES
    (1, (SELECT id FROM agri_prod_planting_plan WHERE plan_code = 'PLAN-2026-SPR-01'),
     1, '整地期', '整地', '2026-04-01', '2026-04-10', '2026-04-01', '2026-04-09',
     '旋耕两遍、施足底肥，田面平整度误差控制在 3cm 以内。', 3, '2001'),
    (2, (SELECT id FROM agri_prod_planting_plan WHERE plan_code = 'PLAN-2026-SPR-01'),
     2, '播种育秧期', '播种', '2026-04-11', '2026-04-30', '2026-04-11', '2026-04-28',
     '浸种催芽后播种，秧田期保持浅水层。', 3, '2001'),
    (3, (SELECT id FROM agri_prod_planting_plan WHERE plan_code = 'PLAN-2026-SPR-01'),
     3, '分蘖期', '追肥', '2026-05-01', '2026-06-20', NULL, NULL,
     '分蘖肥一次，配合灌排水晒田。', 2, '2001'),
    (4, (SELECT id FROM agri_prod_planting_plan WHERE plan_code = 'PLAN-2026-SPR-01'),
     4, '抽穗灌浆期', '防治', '2026-06-21', '2026-08-20', NULL, NULL,
     '重点防治稻瘟病与稻飞虱，保持田间湿润。', 1, '2001'),
    (5, (SELECT id FROM agri_prod_planting_plan WHERE plan_code = 'PLAN-2026-SPR-01'),
     5, '成熟收获期', '收获', '2026-08-21', '2026-09-30', NULL, NULL,
     '九成熟收割，晒场水分降到 14% 以下。', 1, '2001');
