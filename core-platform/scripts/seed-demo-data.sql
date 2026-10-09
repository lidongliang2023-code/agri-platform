-- =====================================================================================
-- 演示种子数据（DEMO SEED DATA）—— 非生产数据
-- =====================================================================================
--
-- 【这是什么】
--   本脚本向 agri_core 灌入一整套相互关联的**演示业务数据**，用于前端页面的功能演示
--   与验收走查（列表 / 详情 / 统计卡 / 关联跳转都能读到真实数据）。
--
-- 【它不是什么】
--   * 不是生产数据。所有农场、地块、告警、投入品、批次的内容均为虚构，
--     农场名称 / 负责人 / 手机号 / 证书编号等都不指向任何真实主体。
--   * 不是前端硬编码假数据。本脚本写入的是**数据库行**，可被后端接口正常增删改查，
--     也可被一键清空；它不改写任何前端或后端代码。
--
-- 【为什么一眼看得出是演示数据】
--   所有业务主键与业务编码统一带 DEMO- 前缀（DEMO-FARM-001 / DEMO-PLOT-001 /
--   DEMO-ALERT-001 …），农场名称也统一含「演示」字样，页面上一眼可辨。
--   清理时按该前缀删除即可，不会误伤真实业务数据。
--
-- 【适用环境】
--   仅限本地开发 / 演示 / 验收环境。**禁止在生产库执行。**
--
-- 【前置条件】
--   1) 数据库 agri_core 已由 Flyway 迁移至 V10（所有 prod_* 表已建好）。
--   2) 平台账号（platform_user.admin）已存在 —— 本脚本不写任何平台用户表。
--
-- 【执行方式】
--   "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -uroot -p agri_core \
--       --default-character-set=utf8mb4 < core-platform/scripts/seed-demo-data.sql
--   或：进入 mysql 客户端后执行  source core-platform/scripts/seed-demo-data.sql
--
-- 【可重复执行】
--   脚本第 0 节会先按 DEMO- 前缀清理本次涉及的全部表，再重新灌入，
--   因此可以反复执行，结果幂等（不会主键冲突、不会堆积重复数据）。
--
-- 【一键清空】
--   见脚本末尾「清理演示数据」注释块。
--
-- 【数据口径说明】
--   * market_id：按 ADR-005 行级隔离，与管理员会话解析出的市场保持一致，统一取 1。
--   * tenant_id：SaaS 预留列，统一取 0。
--   * deleted：逻辑删除位，统一取 0（保持活跃）。
--     注：此前库内遗留的 7 条 prod_farm_info 全部是历史验证脚本写入且 deleted=1 的
--     软删数据，接口查不到正是由此导致，与本脚本无关。
--   * 各表状态字典严格取自后端 AlertDict 与迁移脚本注释，未自创枚举值。
--
-- 【已知结构限制（如实报告，未回避）】
--   * prod_trace_code 是 V1 遗留表：主键 id 与 batch_id 均为 BIGINT 且无自增，
--     无法引用本脚本 varchar(32) 的 DEMO-BATCH-xxx 批次主键。
--     处理方式：id / batch_id 填合成 BIGINT，真实批次关联放在 V2 补列的
--     batch_no（varchar）里，溯源列表与扫码链路仍可正常演示。
--   * prod_plot / prod_device / prod_batch / prod_quality_report / prod_iot_alert
--     为 V1 遗留表，迁移注释已声明新链路不再使用，本脚本不灌。
-- =====================================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 演示数据公共常量：市场维度 1 / 租户 0 / 审计人与时间戳
SET @DEMO_MARKET_ID = 1;
SET @DEMO_TENANT_ID = 0;
SET @DEMO_AUDIT_BY = 1;
SET @DEMO_CREATE_AT = '2026-10-10 09:00:00';
SET @DEMO_UPDATE_AT = '2026-10-10 09:00:00';

-- =====================================================================================
-- 0. 清理历史演示数据（保证脚本可重复执行）
-- =====================================================================================

DELETE FROM prod_farm_info             WHERE farm_id       LIKE 'DEMO-FARM-%';
DELETE FROM prod_farm_cert             WHERE cert_id       LIKE 'DEMO-CERT-%';
DELETE FROM prod_farm_compliance_check WHERE check_id      LIKE 'DEMO-CHK-%';
DELETE FROM prod_plot_info             WHERE plot_id       LIKE 'DEMO-PLOT-%';
DELETE FROM prod_plot_soil             WHERE soil_id       LIKE 'DEMO-SOIL-%';
DELETE FROM prod_supplier              WHERE supplier_id   LIKE 'DEMO-SUP-%';
DELETE FROM prod_input_info            WHERE input_id      LIKE 'DEMO-INPUT-%';
DELETE FROM prod_input_usage           WHERE usage_id      LIKE 'DEMO-USE-%';
DELETE FROM prod_input_stock_flow      WHERE flow_id       LIKE 'DEMO-FLOW-%';
DELETE FROM prod_plan_info             WHERE plan_id       LIKE 'DEMO-PLAN-%';
DELETE FROM prod_plan_stage            WHERE stage_id      LIKE 'DEMO-STAGE-%';
DELETE FROM prod_task_info             WHERE task_id       LIKE 'DEMO-TASK-%';
DELETE FROM prod_task_record           WHERE record_id     LIKE 'DEMO-TREC-%';
DELETE FROM prod_task_template         WHERE template_id   LIKE 'DEMO-TPL-%';
DELETE FROM prod_growth_record         WHERE record_id     LIKE 'DEMO-GROW-%';
DELETE FROM prod_alert_rule            WHERE rule_id       LIKE 'DEMO-RULE-%';
DELETE FROM prod_alert_info            WHERE alert_id      LIKE 'DEMO-ALERT-%';
DELETE FROM prod_iot_device            WHERE device_id     LIKE 'DEMO-DEV-%';
DELETE FROM prod_iot_binding           WHERE binding_id    LIKE 'DEMO-BIND-%';
DELETE FROM prod_iot_reading           WHERE reading_id    LIKE 'DEMO-READ-%';
DELETE FROM prod_iot_command           WHERE command_id    LIKE 'DEMO-CMD-%';
DELETE FROM prod_iot_maintenance       WHERE maintain_id   LIKE 'DEMO-MAIN-%';
DELETE FROM prod_harvest_batch         WHERE batch_id      LIKE 'DEMO-BATCH-%';
DELETE FROM prod_harvest_record        WHERE record_id     LIKE 'DEMO-HARV-%';
DELETE FROM prod_inventory_flow        WHERE flow_id       LIKE 'DEMO-INV-%';
DELETE FROM prod_inspection            WHERE inspection_id LIKE 'DEMO-INSP-%';
DELETE FROM prod_quality_lab           WHERE lab_id        LIKE 'DEMO-LAB-%';
DELETE FROM prod_trace_code            WHERE batch_no      LIKE 'DEMO-BATCH-%' OR code LIKE 'DEMO-TC-%';
DELETE FROM prod_blockchain_record     WHERE record_id     LIKE 'DEMO-CHAIN-%';
DELETE FROM prod_member                WHERE member_id     LIKE 'DEMO-MEM-%';
DELETE FROM prod_message_notify        WHERE message_id    LIKE 'DEMO-MSG-%';
DELETE FROM prod_sys_setting           WHERE setting_id    LIKE 'DEMO-SET-%';
DELETE FROM prod_analytics_snapshot    WHERE snapshot_id   LIKE 'DEMO-SNAP-%';
DELETE FROM prod_ai_diagnosis          WHERE diagnosis_id  LIKE 'DEMO-AI-%';
DELETE FROM prod_tenant_quota          WHERE quota_id      LIKE 'DEMO-QUOTA-%';
DELETE FROM prod_approval              WHERE approval_id   LIKE 'DEMO-APR-%';
DELETE FROM prod_sop_library           WHERE sop_id        LIKE 'DEMO-SOP-%';
DELETE FROM prod_report_task           WHERE report_id     LIKE 'DEMO-RPT-%';
DELETE FROM prod_knowledge_article     WHERE article_id    LIKE 'DEMO-ART-%';

-- =====================================================================================
-- 1. 农场档案（6 个：不同类型 / 不同地区 / 含 1 个停用）
-- =====================================================================================

INSERT INTO prod_farm_info (
    farm_id, market_id, tenant_id, farm_code, farm_name, farm_type,
    province, city, district, address, area_total,
    manager_name, manager_phone, status, remark,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-FARM-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARMC-001', '【演示】华南绿色蔬菜示范农场', 1,
 '广东省', '广州市', '从化区', '鳌头镇现代农业产业园 1 号', 1280.00,
 '陈志强', '13900000001', 1, '演示数据：供智慧农业平台功能演示使用，非真实经营主体',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-FARM-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARMC-002', '【演示】华东智慧稻田农场', 1,
 '江苏省', '盐城市', '射阳县', '海通镇高标准农田示范区 A 区', 3600.00,
 '顾建平', '13900000002', 1, '演示数据：稻麦轮作，配套物联网墒情监测',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-FARM-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARMC-003', '【演示】鲁中设施果蔬农场', 1,
 '山东省', '潍坊市', '寿光市', '稻田镇设施蔬菜产业带 12 号', 860.00,
 '王秀兰', '13900000003', 1, '演示数据：日光温室为主，周年多茬栽培',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-FARM-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARMC-004', '【演示】西北高原生态牧场', 2,
 '甘肃省', '张掖市', '山丹县', '清泉镇草原生态畜牧业示范区', 5200.00,
 '马占军', '13900000004', 1, '演示数据：肉牛舍饲 + 牧草种植一体化',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-FARM-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARMC-005', '【演示】江汉稻渔综合种养农场', 3,
 '湖北省', '荆州市', '监利市', '周老嘴镇稻渔共生基地 3 号', 2150.00,
 '李道明', '13900000005', 1, '演示数据：水稻 + 小龙虾综合种养',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-FARM-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARMC-006', '【演示】滇中花卉种苗基地', 1,
 '云南省', '昆明市', '呈贡区', '斗南花卉产业园 B7 棚区', 320.00,
 '赵文彬', '13900000006', 0, '演示数据：停用状态农场，用于验证列表状态筛选',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

-- ----------------------------------------------------------------- 农场认证

INSERT INTO prod_farm_cert (
    cert_id, market_id, tenant_id, farm_id, cert_type, cert_name, cert_no, issuer,
    issue_date, expire_date, attach_url, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-CERT-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'GREEN',   '绿色食品认证',    'DEMO-GF-2025-0001', '中国绿色食品发展中心',      '2025-03-18', '2028-03-17', NULL, 1,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-CERT-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'HACCP',   'HACCP 体系认证',  'DEMO-HA-2025-0002', '方圆标志认证集团',          '2025-06-02', '2026-12-01', NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-CERT-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', 'ORGANIC', '有机产品认证',    'DEMO-OR-2024-0003', '中绿华夏有机食品认证中心',  '2024-11-10', '2027-11-09', NULL, 1,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-CERT-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'GREEN',   '绿色食品认证',    'DEMO-GF-2025-0004', '中国绿色食品发展中心',      '2025-01-22', '2026-01-21', NULL, 3,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-CERT-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', 'GEO',     '地理标志产品',    'DEMO-GI-2023-0005', '国家知识产权局',            '2023-08-15', '2033-08-14', NULL, 1,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-CERT-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', 'GREEN',   '绿色食品认证',    'DEMO-GF-2026-0006', '中国绿色食品发展中心',      '2026-04-09', '2029-04-08', NULL, 1,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 2. 地块/棚（每个农场 3~6 个，farm_id 全部指向上面真实存在的演示农场）
-- =====================================================================================

INSERT INTO prod_plot_info (
    plot_id, market_id, tenant_id, farm_id, plot_code, plot_name, area,
    planting_type, soil_type, irrigation_type, crop_id, crop_variety, current_plan_id,
    geo_boundary, status, create_by, update_by, create_at, update_at, deleted
) VALUES
-- DEMO-FARM-001 华南绿色蔬菜示范农场（5 个地块）
('DEMO-PLOT-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOTC-001', 'A区连栋大棚',   42.50,
 2, '壤土',   '滴灌',   'DEMO-CROP-001', '普罗旺斯',   'DEMO-PLAN-001',
 '{"type":"Polygon","coordinates":[[[113.61,23.52],[113.62,23.52],[113.62,23.53],[113.61,23.53],[113.61,23.52]]]}', 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOTC-002', 'B区露天菜田',   68.00,
 1, '沙壤土', '喷灌',   'DEMO-CROP-002', '津优35',     'DEMO-PLAN-002', NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOTC-003', 'C区露天菜田',   55.30,
 1, '壤土',   '沟灌',   'DEMO-CROP-004', '湘研15号',   'DEMO-PLAN-003', NULL, 3,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOTC-004', 'D区育苗棚',     18.00,
 2, '草炭土', '微喷',   'DEMO-CROP-001', '普罗旺斯',   NULL, NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOTC-005', 'E区休耕地',     36.00,
 1, '黏壤土', '无灌溉', NULL,           NULL,         NULL, NULL, 4,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),

-- DEMO-FARM-002 华东智慧稻田农场（4 个地块）
('DEMO-PLOT-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', 'DEMO-PLOTC-006', '智慧稻田东片区', 420.00,
 3, '水稻土',     '渠灌', 'DEMO-CROP-003', '南粳9108',  'DEMO-PLAN-004', NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', 'DEMO-PLOTC-007', '智慧稻田西片区', 396.00,
 3, '水稻土',     '渠灌', 'DEMO-CROP-003', '南粳9108',  'DEMO-PLAN-004', NULL, 3,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', 'DEMO-PLOTC-008', '智慧稻田中片区', 455.00,
 3, '水稻土',     '渠灌', 'DEMO-CROP-003', '淮稻5号',   'DEMO-PLAN-004', NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-009', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', 'DEMO-PLOTC-009', '智慧稻田北片区', 302.00,
 3, '盐化水稻土', '渠灌', NULL,           NULL,         NULL, NULL, 4,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),

-- DEMO-FARM-003 鲁中设施果蔬农场（6 个地块）
('DEMO-PLOT-010', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-PLOTC-010', '1号日光温室',     8.60,
 2, '潮土',   '膜下滴灌', 'DEMO-CROP-001', '金棚8号',   'DEMO-PLAN-005', NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-011', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-PLOTC-011', '2号日光温室',     8.20,
 2, '潮土',   '膜下滴灌', 'DEMO-CROP-002', '德瑞特79',  'DEMO-PLAN-005', NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-012', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-PLOTC-012', '3号日光温室',     8.80,
 2, '潮土',   '膜下滴灌', 'DEMO-CROP-004', '洛椒98A',   'DEMO-PLAN-005', NULL, 3,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-013', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-PLOTC-013', '4号日光温室',     7.90,
 2, '潮土',   '膜下滴灌', 'DEMO-CROP-001', '金棚8号',   'DEMO-PLAN-005', NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-014', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-PLOTC-014', '露天大田东区',  120.00,
 1, '潮褐土', '喷灌',     'DEMO-CROP-006', '饲用玉米',  NULL, NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-015', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-PLOTC-015', '工厂化育苗中心',  5.00,
 2, '基质',   '潮汐灌溉', 'DEMO-CROP-001', '金棚8号',   NULL, NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),

-- DEMO-FARM-004 西北高原生态牧场（3 个地块）
('DEMO-PLOT-016', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', 'DEMO-PLOTC-016', '牧草种植区A',   860.00,
 1, '栗钙土', '喷灌',   'DEMO-CROP-005', '紫花苜蓿WL656', 'DEMO-PLAN-006', NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-017', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', 'DEMO-PLOTC-017', '牧草种植区B',   740.00,
 1, '栗钙土', '喷灌',   'DEMO-CROP-005', '紫花苜蓿WL656', NULL, NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-018', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', 'DEMO-PLOTC-018', '舍饲养殖区',     96.00,
 1, '灰钙土', '无灌溉', NULL,           NULL,         NULL, NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),

-- DEMO-FARM-005 江汉稻渔综合种养农场（4 个地块）
('DEMO-PLOT-019', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', 'DEMO-PLOTC-019', '稻渔综合区1号田', 168.00,
 3, '水稻土',     '渠灌', 'DEMO-CROP-003', '丰两优4号', NULL, NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-020', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', 'DEMO-PLOTC-020', '稻渔综合区2号田', 155.00,
 3, '水稻土',     '渠灌', 'DEMO-CROP-003', '丰两优4号', NULL, NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-021', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', 'DEMO-PLOTC-021', '稻渔综合区3号田', 176.00,
 3, '潴育水稻土', '渠灌', 'DEMO-CROP-003', '丰两优4号', NULL, NULL, 3,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-022', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', 'DEMO-PLOTC-022', '稻渔综合区4号田', 142.00,
 3, '潴育水稻土', '渠灌', NULL,           NULL,         NULL, NULL, 4,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),

-- DEMO-FARM-006 滇中花卉种苗基地（3 个地块，农场停用但地块档案保留）
('DEMO-PLOT-023', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-006', 'DEMO-PLOTC-023', '花卉A棚',       12.00,
 2, '红壤', '滴灌', 'DEMO-CROP-008', '卡罗拉玫瑰', NULL, NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-024', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-006', 'DEMO-PLOTC-024', '花卉B棚',       12.50,
 2, '红壤', '滴灌', 'DEMO-CROP-008', '雪山玫瑰',   NULL, NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLOT-025', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-006', 'DEMO-PLOTC-025', '种苗繁育区',     9.00,
 2, '基质', '微喷', 'DEMO-CROP-008', '雪山玫瑰',   NULL, NULL, 2,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

-- ----------------------------------------------------------------- 地块土壤检测

INSERT INTO prod_plot_soil (
    soil_id, market_id, tenant_id, plot_id, sample_date, ph, organic_matter,
    nitrogen, phosphorus, potassium, moisture, salinity, tester, remark,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-SOIL-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-001', '2026-03-12', 6.45, 28.60, 118.00, 42.30, 186.50, 24.80, 0.82, '周农业', '演示数据：播种前基线采样',             @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SOIL-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-002', '2026-03-12', 6.10, 22.40,  96.50, 35.80, 152.00, 21.30, 0.65, '周农业', '演示数据：有机质偏低，建议增施有机肥', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SOIL-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-006', '2026-04-08', 7.02, 31.20, 132.40, 28.60, 210.30, 32.10, 1.24, '孙技员', '演示数据：水稻田常规监测',             @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SOIL-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-010', '2026-02-25', 6.80, 34.50, 156.00, 88.20, 268.40, 26.50, 1.86, '吴土肥', '演示数据：设施土壤盐渍化需关注',       @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SOIL-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-016', '2026-05-16', 8.15, 18.90,  62.30, 18.40, 142.60, 15.20, 2.34, '马技术', '演示数据：高原碱性土壤',               @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SOIL-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-019', '2026-04-22', 6.55, 29.80, 124.60, 33.20, 178.90, 38.40, 0.74, '胡水产', '演示数据：稻渔共生田，含水率偏高属正常', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 3. 投入品供应商 + 投入品档案 + 库存流水
-- =====================================================================================

INSERT INTO prod_supplier (
    supplier_id, market_id, tenant_id, supplier_code, supplier_name, contact_name,
    contact_phone, license_no, address, credit_level, cooperate_start, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-SUP-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-SUPC-001', '【演示】南方农化科技有限公司', '林经理', '13800001001', 'DEMO-LIC-91440101MA0001', '广州市天河区科华街 88 号',   'A', '2023-01-15', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SUP-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-SUPC-002', '【演示】华东农资连锁有限公司', '徐经理', '13800001002', 'DEMO-LIC-91320900MA0002', '盐城市亭湖区开放大道 200 号', 'A', '2022-06-01', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SUP-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-SUPC-003', '【演示】鲁中种业集团有限公司', '孔经理', '13800001003', 'DEMO-LIC-91370783MA0003', '寿光市农产品物流园 A 座',     'B', '2024-03-20', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_input_info (
    input_id, market_id, tenant_id, input_code, input_name, input_type, spec, unit,
    manufacturer, registration_no, safety_interval, stock_qty, warn_qty, supplier_id, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-INPUT-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUTC-001', '腐熟有机肥',            'FERTILIZER', '40kg/袋',    'kg', '南方农化', 'DEMO-REG-F20230001',  0,  8200.000, 2000.000, 'DEMO-SUP-001', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-INPUT-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUTC-002', '高钾水溶肥',            'FERTILIZER', '20kg/袋',    'kg', '南方农化', 'DEMO-REG-F20230002',  7,  1450.000,  500.000, 'DEMO-SUP-001', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-INPUT-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUTC-003', '番茄种子（普罗旺斯）',  'SEED',       '1000粒/袋',  '袋', '鲁中种业', 'DEMO-REG-S20240011',  0,   320.000,  100.000, 'DEMO-SUP-003', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-INPUT-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUTC-004', '黄瓜种子（津优35）',    'SEED',       '500粒/袋',   '袋', '鲁中种业', 'DEMO-REG-S20240012',  0,   260.000,  100.000, 'DEMO-SUP-003', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-INPUT-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUTC-005', '吡唑醚菌酯悬浮剂',      'PESTICIDE',  '500ml/瓶',   'L',  '华东农资', 'DEMO-REG-P20220045', 14,   180.000,   60.000, 'DEMO-SUP-002', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-INPUT-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUTC-006', '苏云金杆菌可湿性粉剂',  'PESTICIDE',  '200g/袋',    'kg', '华东农资', 'DEMO-REG-P20220046',  5,    95.000,   40.000, 'DEMO-SUP-002', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-INPUT-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUTC-007', '肉牛全混合日粮',        'FEED',       '50kg/袋',    'kg', '西北牧源', 'DEMO-REG-FD2023081',  0, 46000.000, 8000.000, 'DEMO-SUP-001', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-INPUT-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUTC-008', '伊维菌素注射液',        'VET',        '50ml/瓶',    'L',  '西北牧源', 'DEMO-REG-VT2023012', 28,    42.000,   20.000, 'DEMO-SUP-001', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_input_stock_flow (
    flow_id, market_id, tenant_id, input_id, warehouse_id, flow_type, qty, batch_no,
    expire_date, operator_id, related_task_id, remark,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-FLOW-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUT-001', 'DEMO-WH-001', 1,  5000.000, 'DEMO-IB-20260301', '2028-02-28', 'DEMO-MEM-003', NULL,            '演示数据：春季备肥入库',       @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-03-01 10:12:00', @DEMO_UPDATE_AT, 0),
('DEMO-FLOW-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUT-002', 'DEMO-WH-001', 1,  1000.000, 'DEMO-IB-20260410', '2028-04-09', 'DEMO-MEM-003', NULL,            '演示数据：追肥专用入库',       @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-04-10 14:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-FLOW-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUT-005', 'DEMO-WH-002', 1,   200.000, 'DEMO-IB-20260508', '2027-05-07', 'DEMO-MEM-006', NULL,            '演示数据：植保药剂入库',       @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-05-08 09:40:00', @DEMO_UPDATE_AT, 0),
('DEMO-FLOW-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUT-002', 'DEMO-WH-001', 2,  -320.000, 'DEMO-IB-20260410', '2028-04-09', 'DEMO-MEM-002', 'DEMO-TASK-003', '演示数据：随追肥任务领用',     @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-14 07:25:00', @DEMO_UPDATE_AT, 0),
('DEMO-FLOW-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUT-005', 'DEMO-WH-002', 2,   -48.000, 'DEMO-IB-20260508', '2027-05-07', 'DEMO-MEM-002', 'DEMO-TASK-005', '演示数据：随打药任务领用',     @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-03 06:50:00', @DEMO_UPDATE_AT, 0),
('DEMO-FLOW-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INPUT-007', 'DEMO-WH-003', 1, 20000.000, 'DEMO-IB-20260601', '2026-12-31', 'DEMO-MEM-008', NULL,            '演示数据：饲料批量入库',       @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-01 11:00:00', @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 4. 种养计划 + 计划阶段
-- =====================================================================================

INSERT INTO prod_plan_info (
    plan_id, market_id, tenant_id, farm_id, plot_id, plan_code, plan_name,
    crop_id, crop_variety, plan_start_date, plan_end_date, expected_yield, expected_amount,
    owner_id, status, create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-PLAN-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOT-001', 'DEMO-PLANC-001', '2026年春茬番茄种植计划',   'DEMO-CROP-001', '普罗旺斯',      '2026-02-01', '2026-07-31',  168000.00,  672000.00, 'DEMO-MEM-001', 2, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLAN-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOT-002', 'DEMO-PLANC-002', '2026年春茬黄瓜种植计划',   'DEMO-CROP-002', '津优35',        '2026-03-01', '2026-08-31',  142000.00,  369200.00, 'DEMO-MEM-002', 2, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLAN-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOT-003', 'DEMO-PLANC-003', '2026年辣椒种植计划',       'DEMO-CROP-004', '湘研15号',      '2026-04-01', '2026-10-31',   86000.00,  430000.00, 'DEMO-MEM-002', 2, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLAN-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', 'DEMO-PLOT-006', 'DEMO-PLANC-004', '2026年水稻单季晚粳种植计划', 'DEMO-CROP-003', '南粳9108',     '2026-05-01', '2026-11-15',  980000.00, 2744000.00, 'DEMO-MEM-004', 2, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLAN-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-PLOT-010', 'DEMO-PLANC-005', '2026年秋冬茬设施果蔬计划', 'DEMO-CROP-001', '金棚8号',       '2026-08-01', '2027-02-28',  236000.00,  944000.00, 'DEMO-MEM-006', 2, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-PLAN-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', 'DEMO-PLOT-016', 'DEMO-PLANC-006', '2026年苜蓿饲草生产计划',   'DEMO-CROP-005', '紫花苜蓿WL656', '2026-04-01', '2026-10-31', 3200000.00,  640000.00, 'DEMO-MEM-008', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_plan_stage (
    stage_id, market_id, tenant_id, plan_id, stage_name, stage_seq, plan_start_date,
    plan_end_date, task_type, description, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-STAGE-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-001', '整地施肥',   1, '2026-02-01', '2026-02-15', '整地', '深翻 25cm，亩施腐熟有机肥 2000kg',   3, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-STAGE-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-001', '定植',       2, '2026-02-20', '2026-03-05', '播种', '大行距 80cm，株距 40cm，亩栽 2200 株', 3, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-STAGE-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-001', '水肥管理',   3, '2026-03-10', '2026-06-20', '施肥', '花期控氮控水，果期高钾水溶肥追施',   2, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-STAGE-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-001', '采收',       4, '2026-06-25', '2026-07-31', '采收', '分批采收，成熟度八成以上',           1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-STAGE-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-002', '整地播种',   1, '2026-03-01', '2026-03-20', '播种', '起垄覆膜，直播穴距 30cm',            3, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-STAGE-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-002', '搭架引蔓',   2, '2026-03-25', '2026-04-15', '整地', '平棚吊蔓，及时打老叶',               3, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-STAGE-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-002', '病虫害防治', 3, '2026-04-20', '2026-08-10', '打药', '重点防治霜霉病与蚜虫，优先生物农药', 2, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-STAGE-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-004', '育秧',       1, '2026-05-01', '2026-05-25', '播种', '工厂化育秧，机插标准盘秧',           3, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-STAGE-009', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-004', '本田管理',   2, '2026-05-28', '2026-09-20', '施肥', '浅水分蘖，够苗晒田，穗肥看苗施用',   2, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-STAGE-010', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-004', '稻瘟病防控', 3, '2026-07-15', '2026-08-30', '打药', '破口前统一种子处理，无人机飞防',     1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-STAGE-011', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-005', '棚室消毒',   1, '2026-08-01', '2026-08-12', '整地', '高温闷棚 15 天，基质更换',           2, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-STAGE-012', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLAN-005', '定植后管理', 2, '2026-08-15', '2027-02-20', '灌溉', '膜下滴灌，日耗水按需调控',           1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 5. 农事任务模板 + 农事任务 + 执行记录
-- =====================================================================================

INSERT INTO prod_task_template (
    template_id, market_id, tenant_id, crop_id, template_name, task_type, stage_seq,
    interval_days, work_hours, work_content, input_ids, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-TPL-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-CROP-001', '番茄整地施肥模板',   '整地', 1,  0, 16.00, '深翻、起垄、施基肥',           '["DEMO-INPUT-001"]', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-TPL-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-CROP-001', '番茄果期追肥模板',   '施肥', 3, 12,  6.00, '随水追施高钾水溶肥',           '["DEMO-INPUT-002"]', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-TPL-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-CROP-002', '黄瓜霜霉病防治模板', '打药', 3, 10,  8.00, '叶面喷施，安全间隔期 14 天',   '["DEMO-INPUT-005"]', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-TPL-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-CROP-003', '水稻稻瘟病飞防模板', '打药', 3, 20, 10.00, '无人机统防统治',               '["DEMO-INPUT-006"]', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-TPL-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-CROP-005', '苜蓿刈割模板',       '采收', 2, 35, 12.00, '初花期刈割，留茬 5cm',         NULL,                 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_task_info (
    task_id, market_id, tenant_id, task_no, plan_id, plot_id, task_type, task_name,
    plan_start_date, plan_end_date, assignee_id, assigner_id, status, priority, template_id,
    related_usage_ids, reject_count, accept_status, completed_at,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-TASK-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-001', 'DEMO-PLAN-001', 'DEMO-PLOT-001', '整地', 'A区连栋大棚春茬整地施肥', '2026-02-01', '2026-02-15', 'DEMO-MEM-003', 'DEMO-MEM-001', 'done',     2, 'DEMO-TPL-001', '["DEMO-USE-001"]', 0, 1, '2026-02-15 16:40:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-01-28 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-002', 'DEMO-PLAN-001', 'DEMO-PLOT-001', '播种', 'A区连栋大棚番茄定植',     '2026-02-20', '2026-03-05', 'DEMO-MEM-003', 'DEMO-MEM-001', 'done',     1, NULL,           '["DEMO-USE-002"]', 0, 1, '2026-03-04 17:20:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-02-16 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-003', 'DEMO-PLAN-001', 'DEMO-PLOT-001', '施肥', 'A区果期高钾追肥',         '2026-06-10', '2026-06-20', 'DEMO-MEM-002', 'DEMO-MEM-001', 'done',     2, 'DEMO-TPL-002', '["DEMO-USE-003"]', 0, 1, '2026-06-18 11:05:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-08 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-004', 'DEMO-PLAN-001', 'DEMO-PLOT-001', '采收', 'A区番茄第三批采收',       '2026-07-15', '2026-07-25', 'DEMO-MEM-003', 'DEMO-MEM-001', 'doing',    1, NULL,           NULL,                0, 0, NULL,                  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-10 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-005', 'DEMO-PLAN-002', 'DEMO-PLOT-002', '打药', 'B区黄瓜霜霉病防治',       '2026-07-01', '2026-07-08', 'DEMO-MEM-002', 'DEMO-MEM-001', 'done',     1, 'DEMO-TPL-003', '["DEMO-USE-004"]', 0, 1, '2026-07-06 18:30:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-28 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-006', 'DEMO-PLAN-002', 'DEMO-PLOT-002', '灌溉', 'B区露天菜田喷灌补水',     '2026-08-05', '2026-08-12', 'DEMO-MEM-002', 'DEMO-MEM-001', 'rejected', 3, NULL,           NULL,                1, 2, NULL,                  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-02 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-007', 'DEMO-PLAN-003', 'DEMO-PLOT-003', '打药', 'C区辣椒疫病统防',         '2026-09-01', '2026-09-10', 'DEMO-MEM-002', 'DEMO-MEM-001', 'assigned', 2, NULL,           NULL,                0, 0, NULL,                  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-26 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-008', 'DEMO-PLAN-003', 'DEMO-PLOT-003', '采收', 'C区辣椒首批采收',         '2026-09-20', '2026-10-05', 'DEMO-MEM-003', 'DEMO-MEM-001', 'pending',  2, NULL,           NULL,                0, 0, NULL,                  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-15 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-009', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-009', 'DEMO-PLAN-004', 'DEMO-PLOT-006', '打药', '稻田稻瘟病无人机飞防',   '2026-08-05', '2026-08-15', 'DEMO-MEM-005', 'DEMO-MEM-004', 'done',     1, 'DEMO-TPL-004', '["DEMO-USE-005"]', 0, 1, '2026-08-13 15:45:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-01 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-010', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-010', 'DEMO-PLAN-004', 'DEMO-PLOT-006', '灌溉', '东片区浅水灌溉调度',     '2026-09-10', '2026-09-20', 'DEMO-MEM-005', 'DEMO-MEM-004', 'doing',    2, NULL,           NULL,                0, 0, NULL,                  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-08 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-011', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-011', 'DEMO-PLAN-005', 'DEMO-PLOT-010', '整地', '1号温室棚室消毒整地',     '2026-08-01', '2026-08-12', 'DEMO-MEM-007', 'DEMO-MEM-006', 'done',     2, 'DEMO-TPL-001', '["DEMO-USE-006"]', 0, 1, '2026-08-11 17:00:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-28 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-012', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-012', 'DEMO-PLAN-005', 'DEMO-PLOT-011', '播种', '2号温室黄瓜定植',         '2026-08-15', '2026-08-25', 'DEMO-MEM-007', 'DEMO-MEM-006', 'assigned', 2, NULL,           NULL,                0, 0, NULL,                  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-12 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-013', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-013', 'DEMO-PLAN-006', 'DEMO-PLOT-016', '采收', '牧草区A第三茬刈割',       '2026-09-05', '2026-09-18', 'DEMO-MEM-009', 'DEMO-MEM-008', 'done',     2, 'DEMO-TPL-005', NULL,                0, 1, '2026-09-16 16:20:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-01 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-TASK-014', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASKN-014', 'DEMO-PLAN-006', 'DEMO-PLOT-017', '灌溉', '牧草区B喷灌作业',         '2026-09-20', '2026-09-30', 'DEMO-MEM-009', 'DEMO-MEM-008', 'pending',  3, NULL,           NULL,                0, 0, NULL,                  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-18 09:00:00', @DEMO_UPDATE_AT, 0);

INSERT INTO prod_task_record (
    record_id, market_id, tenant_id, task_id, executor_id, execute_time, execute_type,
    photos, gps_lat, gps_lng, gps_distance, abnormal_desc, offline_flag,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-TREC-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-001', 'DEMO-MEM-003', '2026-02-02 08:30:00', 1, '[]', 23.524100, 113.615200,  12.00, NULL,                            0, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-02-02 08:35:00', @DEMO_UPDATE_AT, 0),
('DEMO-TREC-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-001', 'DEMO-MEM-003', '2026-02-15 16:40:00', 3, '["https://demo.example.com/task/T001/done.jpg"]', 23.524300, 113.615600, 8.00, NULL, 0, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-02-15 16:45:00', @DEMO_UPDATE_AT, 0),
('DEMO-TREC-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-003', 'DEMO-MEM-002', '2026-06-18 11:05:00', 3, '[]', 23.524200, 113.615400,  15.00, NULL,                            1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-18 11:20:00', @DEMO_UPDATE_AT, 0),
('DEMO-TREC-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-005', 'DEMO-MEM-002', '2026-07-06 18:30:00', 3, '[]', 23.514800, 113.635300, 210.00, '偏离地块中心较远，实际为相邻田块兼治', 0, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-06 18:40:00', @DEMO_UPDATE_AT, 0),
('DEMO-TREC-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-009', 'DEMO-MEM-005', '2026-08-13 15:45:00', 3, '[]', 33.786200, 120.261400,  32.00, NULL,                            0, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-13 15:55:00', @DEMO_UPDATE_AT, 0),
('DEMO-TREC-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-006', 'DEMO-MEM-002', '2026-08-06 10:15:00', 2, '[]', NULL, NULL, NULL, '喷头堵塞 3 处，作业中断后验收驳回', 0, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-06 10:30:00', @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 6. 投入品使用记录（farm_id 已补，保证「按农场筛选」接口能查到）
-- =====================================================================================

INSERT INTO prod_input_usage (
    usage_id, market_id, tenant_id, task_id, plot_id, farm_id, input_id, input_name,
    dosage, unit, method, operator_id, used_at, safety_interval_days, batch_no, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-USE-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-001', 'DEMO-PLOT-001', 'DEMO-FARM-001', 'DEMO-INPUT-001', '腐熟有机肥',             1360.000, 'kg', '撒施沟埋',     'DEMO-MEM-003', '2026-02-03 09:20:00',  0, 'DEMO-IB-20260301', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-02-03 09:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-002', 'DEMO-PLOT-001', 'DEMO-FARM-001', 'DEMO-INPUT-003', '番茄种子（普罗旺斯）',      12.000, '袋', '定植移栽',     'DEMO-MEM-003', '2026-02-22 08:10:00',  0, 'DEMO-IB-20251218', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-02-22 08:20:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-003', 'DEMO-PLOT-001', 'DEMO-FARM-001', 'DEMO-INPUT-002', '高钾水溶肥',              160.000, 'kg', '随水冲施',     'DEMO-MEM-002', '2026-06-14 07:25:00',  7, 'DEMO-IB-20260410', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-14 07:40:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-005', 'DEMO-PLOT-002', 'DEMO-FARM-001', 'DEMO-INPUT-005', '吡唑醚菌酯悬浮剂',         24.000, 'L',  '叶面喷雾',     'DEMO-MEM-002', '2026-07-03 06:50:00', 14, 'DEMO-IB-20260508', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-03 07:05:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-007', 'DEMO-PLOT-003', 'DEMO-FARM-001', 'DEMO-INPUT-006', '苏云金杆菌可湿性粉剂',      8.000, 'kg', '叶面喷雾',     'DEMO-MEM-002', '2026-09-03 07:15:00',  5, 'DEMO-IB-20260508', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-03 07:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL,            'DEMO-PLOT-004', 'DEMO-FARM-001', 'DEMO-INPUT-003', '番茄种子（普罗旺斯）',       3.000, '袋', '工厂化育苗',   'DEMO-MEM-003', '2026-07-20 09:00:00',  0, 'DEMO-IB-20251218', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-20 09:15:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-009', 'DEMO-PLOT-006', 'DEMO-FARM-002', 'DEMO-INPUT-006', '苏云金杆菌可湿性粉剂',     46.000, 'kg', '无人机飞防',   'DEMO-MEM-005', '2026-08-10 06:30:00',  5, 'DEMO-IB-20260508', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-10 06:50:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL,            'DEMO-PLOT-006', 'DEMO-FARM-002', 'DEMO-INPUT-002', '高钾水溶肥',             1200.000, 'kg', '随水冲施',     'DEMO-MEM-005', '2026-06-05 08:00:00',  7, 'DEMO-IB-20260410', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-05 08:20:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-009', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL,            'DEMO-PLOT-007', 'DEMO-FARM-002', 'DEMO-INPUT-001', '腐熟有机肥',             2400.000, 'kg', '撒施旋耕',     'DEMO-MEM-005', '2026-04-18 10:00:00',  0, 'DEMO-IB-20260301', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-04-18 10:20:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-010', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TASK-011', 'DEMO-PLOT-010', 'DEMO-FARM-003', 'DEMO-INPUT-001', '腐熟有机肥',              380.000, 'kg', '撒施沟埋',     'DEMO-MEM-007', '2026-08-03 09:10:00',  0, 'DEMO-IB-20260301', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-03 09:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-011', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL,            'DEMO-PLOT-012', 'DEMO-FARM-003', 'DEMO-INPUT-005', '吡唑醚菌酯悬浮剂',         12.000, 'L',  '叶面喷雾',     'DEMO-MEM-007', '2026-09-12 07:00:00', 14, 'DEMO-IB-20260508', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-12 07:20:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-012', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL,            'DEMO-PLOT-014', 'DEMO-FARM-003', 'DEMO-INPUT-002', '高钾水溶肥',              260.000, 'kg', '随水冲施',     'DEMO-MEM-007', '2026-07-22 08:40:00',  7, 'DEMO-IB-20260410', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-22 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-013', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL,            'DEMO-PLOT-018', 'DEMO-FARM-004', 'DEMO-INPUT-007', '肉牛全混合日粮',        18000.000, 'kg', '舍饲投喂',     'DEMO-MEM-009', '2026-09-01 06:00:00',  0, 'DEMO-IB-20260601', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-01 06:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-014', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL,            'DEMO-PLOT-018', 'DEMO-FARM-004', 'DEMO-INPUT-008', '伊维菌素注射液',            6.000, 'L',  '颈部皮下注射', 'DEMO-MEM-010', '2026-09-05 15:20:00', 28, 'DEMO-IB-20260601', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-05 15:40:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-015', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL,            'DEMO-PLOT-019', 'DEMO-FARM-005', 'DEMO-INPUT-006', '苏云金杆菌可湿性粉剂',     32.000, 'kg', '无人机飞防',   'DEMO-MEM-011', '2026-08-20 07:10:00',  5, 'DEMO-IB-20260508', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-20 07:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-016', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL,            'DEMO-PLOT-020', 'DEMO-FARM-005', 'DEMO-INPUT-001', '腐熟有机肥',              960.000, 'kg', '撒施旋耕',     'DEMO-MEM-011', '2026-05-06 09:30:00',  0, 'DEMO-IB-20260301', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-05-06 09:50:00', @DEMO_UPDATE_AT, 0),
('DEMO-USE-017', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL,            'DEMO-PLOT-023', 'DEMO-FARM-006', 'DEMO-INPUT-002', '高钾水溶肥',               36.000, 'kg', '随水冲施',     'DEMO-MEM-012', '2026-06-11 08:20:00',  7, 'DEMO-IB-20260410', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-11 08:40:00', @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 7. 告警规则 + 告警记录（覆盖 4 种 status × 4 种 level × 5 种 source）
-- =====================================================================================

INSERT INTO prod_alert_rule (
    rule_id, market_id, tenant_id, farm_id, plot_id, device_id, rule_name, metric,
    operator, threshold_value, duration_min, alert_level, notify_channels, enabled_flag, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-RULE-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', NULL,           NULL,           '棚内高温预警',        '空气温度',   'gt',  35.000, 10, 'WARN',     '站内,短信',       1, 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-RULE-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOT-001', 'DEMO-DEV-001', '土壤水分下限',        '土壤含水量', 'lt',  18.000, 30, 'CRITICAL', '站内,短信,微信', 1, 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-RULE-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', NULL,           NULL,           '棚内湿度过高',        '空气湿度',   'gt',  88.000, 20, 'INFO',     '站内',            1, 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-RULE-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', NULL,           NULL,           '田间水位超限',        '水位',       'gt', 120.000, 15, 'WARN',     '站内,微信',       1, 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-RULE-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', NULL,           NULL,           'CO2 浓度偏低',        'CO2浓度',    'lt', 380.000, 20, 'INFO',     '站内',            1, 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-RULE-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', NULL,           'DEMO-DEV-008', '设备离线心跳丢失',    '心跳间隔',   'gt', 600.000,  5, 'URGENT',   '站内,短信',       0, 0, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_alert_info (
    alert_id, market_id, tenant_id, farm_id, plot_id, device_id, rule_id, alert_source,
    alert_title, metric, metric_value, alert_level, alert_time,
    handle_by, handle_time, handle_remark, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
-- ---- DEMO-FARM-001 华南绿色蔬菜示范农场（6 条，覆盖各状态 / 级别 / 来源）
('DEMO-ALERT-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOT-001', 'DEMO-DEV-001', 'DEMO-RULE-002', 1,
 'A区连栋大棚土壤含水量低于阈值', '土壤含水量', 15.200, 'CRITICAL', '2026-10-08 14:20:00',
 NULL, NULL, NULL, 'PENDING',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-08 14:20:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOT-001', 'DEMO-DEV-001', 'DEMO-RULE-001', 1,
 'A区连栋大棚棚内温度持续偏高', '空气温度', 37.800, 'WARN', '2026-10-07 11:05:00',
 'DEMO-MEM-002', '2026-10-07 11:40:00', '已开启顶窗与遮阳网，棚温回落至 31 度', 'HANDLING',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-07 11:05:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOT-002', 'DEMO-DEV-003', 'DEMO-RULE-003', 3,
 'B区露天菜田监测到霜霉病高发风险', '病情指数', 42.500, 'WARN', '2026-10-05 08:30:00',
 'DEMO-MEM-002', '2026-10-05 15:10:00', '已完成一次吡唑醚菌酯叶面喷施', 'HANDLED',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-05 08:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOT-001', 'DEMO-DEV-002', NULL, 2,
 'A区光照传感器数据异常跳变', '光照强度', 0.000, 'INFO', '2026-10-03 19:45:00',
 'DEMO-MEM-003', '2026-10-04 09:00:00', '重启后读数恢复正常，判定为瞬时干扰', 'IGNORED',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-03 19:45:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOT-003', NULL, NULL, 5,
 'C区辣椒地块检出超安全间隔期用药', '安全间隔期', 2.000, 'URGENT', '2026-10-09 07:15:00',
 NULL, NULL, NULL, 'PENDING',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-09 07:15:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOT-001', NULL, NULL, 4,
 '番茄采收任务逾期未完成', '任务延期天数', 3.000, 'INFO', '2026-10-01 09:00:00',
 'DEMO-MEM-001', '2026-10-01 16:30:00', '已重新排期至 10 月 12 日', 'HANDLED',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-01 09:00:00', @DEMO_UPDATE_AT, 0),

-- ---- DEMO-FARM-002 华东智慧稻田农场（4 条）
('DEMO-ALERT-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', 'DEMO-PLOT-006', 'DEMO-DEV-004', 'DEMO-RULE-004', 1,
 '东片区田间水位超过警戒线', '水位', 138.500, 'WARN', '2026-10-08 22:10:00',
 NULL, NULL, NULL, 'PENDING',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-08 22:10:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', 'DEMO-PLOT-007', 'DEMO-DEV-004', 'DEMO-RULE-004', 1,
 '西片区持续降雨积水', '降雨量', 68.400, 'CRITICAL', '2026-10-06 05:30:00',
 'DEMO-MEM-005', '2026-10-06 12:00:00', '已开启排水闸，积水正在下降', 'HANDLING',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-06 05:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-009', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', 'DEMO-PLOT-006', NULL, NULL, 3,
 '东片区稻瘟病监测点病情上升', '病情指数', 28.600, 'INFO', '2026-09-28 10:20:00',
 'DEMO-MEM-004', '2026-09-29 09:30:00', '组织无人机统防统治一次', 'HANDLED',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-28 10:20:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-010', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', 'DEMO-PLOT-009', NULL, NULL, 2,
 '北片区网关设备离线', '心跳间隔', 900.000, 'URGENT', '2026-09-20 03:15:00',
 'DEMO-MEM-005', '2026-09-20 10:40:00', '更换网关电源模块后恢复在线', 'HANDLED',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-20 03:15:00', @DEMO_UPDATE_AT, 0),

-- ---- DEMO-FARM-003 鲁中设施果蔬农场（4 条）
('DEMO-ALERT-011', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-PLOT-010', 'DEMO-DEV-005', 'DEMO-RULE-005', 1,
 '1号日光温室 CO2 浓度偏低', 'CO2浓度', 342.000, 'INFO', '2026-10-07 08:00:00',
 'DEMO-MEM-007', '2026-10-07 09:20:00', '调整为间断通风模式，浓度已回升', 'HANDLED',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-07 08:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-012', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-PLOT-011', 'DEMO-DEV-005', 'DEMO-RULE-005', 2,
 '2号日光温室 CO2 传感器离线', '心跳间隔', 720.000, 'WARN', '2026-10-09 06:45:00',
 NULL, NULL, NULL, 'PENDING',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-09 06:45:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-013', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-PLOT-012', NULL, NULL, 4,
 '4号滴灌任务验收驳回', '任务驳回次数', 1.000, 'INFO', '2026-10-02 14:00:00',
 'DEMO-MEM-006', '2026-10-02 17:30:00', '喷头堵塞已疏通，任务重新派发', 'HANDLED',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-02 14:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-014', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-PLOT-014', NULL, NULL, 5,
 '露天大田东区肥料库存低于预警线', '库存余量', 380.000, 'WARN', '2026-10-04 09:10:00',
 NULL, NULL, NULL, 'PENDING',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-04 09:10:00', @DEMO_UPDATE_AT, 0),

-- ---- DEMO-FARM-004 / 005 / 006（6 条）
('DEMO-ALERT-015', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', 'DEMO-PLOT-018', 'DEMO-DEV-008', 'DEMO-RULE-006', 2,
 '舍饲养殖区环境监测网关离线', '心跳间隔', 1800.000, 'URGENT', '2026-10-09 04:30:00',
 NULL, NULL, NULL, 'PENDING',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-09 04:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-016', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', 'DEMO-PLOT-016', 'DEMO-DEV-007', NULL, 1,
 '牧草种植区A土壤含水量不足', '土壤含水量', 12.800, 'WARN', '2026-10-05 13:20:00',
 'DEMO-MEM-009', '2026-10-05 18:00:00', '启动喷灌 3 小时', 'HANDLED',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-05 13:20:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-017', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', 'DEMO-PLOT-018', NULL, NULL, 5,
 '兽药使用后未满休药期', '休药期剩余天数', 9.000, 'CRITICAL', '2026-10-08 10:00:00',
 NULL, NULL, NULL, 'PENDING',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-08 10:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-018', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', 'DEMO-PLOT-019', 'DEMO-DEV-009', NULL, 1,
 '稻渔区水体溶解氧偏低', '溶解氧', 3.200, 'CRITICAL', '2026-10-06 23:40:00',
 'DEMO-MEM-011', '2026-10-07 00:30:00', '开启增氧机，1 小时后复测 5.8 mg/L', 'HANDLING',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-06 23:40:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-019', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', 'DEMO-PLOT-021', NULL, NULL, 3,
 '稻渔区3号田小龙虾白斑症预警', '病情指数', 22.400, 'WARN', '2026-09-25 07:50:00',
 'DEMO-MEM-011', '2026-09-26 09:00:00', '全池泼洒生石灰消毒', 'HANDLED',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-25 07:50:00', @DEMO_UPDATE_AT, 0),
('DEMO-ALERT-020', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-006', 'DEMO-PLOT-023', 'DEMO-DEV-010', NULL, 1,
 '花卉A棚夜间温度过低', '空气温度', 9.400, 'INFO', '2026-10-02 02:10:00',
 'DEMO-MEM-012', NULL, NULL, 'IGNORED',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-02 02:10:00', @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 8. IoT 设备 + 绑定关系 + 监测读数 + 指令 + 维修
-- =====================================================================================

INSERT INTO prod_iot_device (
    device_id, market_id, tenant_id, device_code, device_name, device_type, farm_id, plot_id,
    manufacturer, model, firmware, install_date, online_flag, last_heartbeat_at, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-DEV-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEVC-001', 'A区土壤墒情站',     'SENSOR',     'DEMO-FARM-001', 'DEMO-PLOT-001', '华维传感',   'HW-SM200', 'v2.4.1', '2025-11-12', 1, '2026-10-10 08:55:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-DEV-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEVC-002', 'A区环境监测站',     'SENSOR',     'DEMO-FARM-001', 'DEMO-PLOT-001', '华维传感',   'HW-TH500', 'v2.4.1', '2025-11-12', 1, '2026-10-10 08:56:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-DEV-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEVC-003', 'B区虫情测报灯',     'SENSOR',     'DEMO-FARM-001', 'DEMO-PLOT-002', '佳多科工',   'JD-PS15',  'v1.8.0', '2026-03-20', 1, '2026-10-10 08:50:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-DEV-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEVC-004', '稻田水位监测站',     'SENSOR',     'DEMO-FARM-002', 'DEMO-PLOT-006', '鑫源物联',   'XY-WL100', 'v3.0.2', '2025-08-05', 1, '2026-10-10 08:58:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-DEV-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEVC-005', '1号温室环境监控',    'SENSOR',     'DEMO-FARM-003', 'DEMO-PLOT-010', '鲁仪物联网', 'LY-GH300', 'v2.1.7', '2025-09-18', 1, '2026-10-10 08:52:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-DEV-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEVC-006', '1号温室卷帘控制器',  'CONTROLLER', 'DEMO-FARM-003', 'DEMO-PLOT-010', '鲁仪物联网', 'LY-CT220', 'v1.5.3', '2025-09-18', 0, '2026-10-06 16:20:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-DEV-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEVC-007', '牧草区土壤氮素站',   'SENSOR',     'DEMO-FARM-004', 'DEMO-PLOT-016', '芯农电子',   'XN-NP200', 'v1.2.9', '2026-04-02', 1, '2026-10-10 08:40:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-DEV-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEVC-008', '舍饲区氨气监测仪',   'SENSOR',     'DEMO-FARM-004', 'DEMO-PLOT-018', '芯农电子',   'XN-GS110', 'v1.2.9', '2026-04-02', 0, '2026-10-09 04:20:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-DEV-009', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEVC-009', '稻渔区水质监测浮标', 'SENSOR',     'DEMO-FARM-005', 'DEMO-PLOT-019', '淼测科技',   'MC-WQ600', 'v4.0.0', '2026-05-11', 1, '2026-10-10 08:59:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-DEV-010', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEVC-010', '花卉A棚摄像头',      'CAMERA',     'DEMO-FARM-006', 'DEMO-PLOT-023', '海视云',     'HS-IP712', 'v2.9.4', '2025-12-01', 0, '2026-09-30 21:10:00', 0, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_iot_binding (
    binding_id, market_id, tenant_id, device_id, device_code, device_name,
    bind_type, bind_target_id, bind_target_name, metrics, frequency, status, bound_at,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-BIND-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-001', 'DEMO-DEVC-001', 'A区土壤墒情站',     'PLOT', 'DEMO-PLOT-001', 'A区连栋大棚',       'soil_moisture,soil_temperature',      30,  'BOUND',   '2025-11-12 10:00:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-BIND-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-002', 'DEMO-DEVC-002', 'A区环境监测站',     'PLOT', 'DEMO-PLOT-001', 'A区连栋大棚',       'temperature,humidity,light',          15,  'BOUND',   '2025-11-12 10:05:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-BIND-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-003', 'DEMO-DEVC-003', 'B区虫情测报灯',     'PLOT', 'DEMO-PLOT-002', 'B区露天菜田',       'pest_count',                          60,  'BOUND',   '2026-03-20 09:00:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-BIND-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-004', 'DEMO-DEVC-004', '稻田水位监测站',     'PLOT', 'DEMO-PLOT-006', '智慧稻田东片区',    'water_level',                         30,  'BOUND',   '2025-08-05 14:00:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-BIND-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-005', 'DEMO-DEVC-005', '1号温室环境监控',    'PLOT', 'DEMO-PLOT-010', '1号日光温室',       'temperature,humidity,co2',            15,  'BOUND',   '2025-09-18 11:00:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-BIND-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-006', 'DEMO-DEVC-006', '1号温室卷帘控制器',  'PLOT', 'DEMO-PLOT-010', '1号日光温室',       'curtain_position',                    10,  'PAUSED',  '2025-09-18 11:10:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-BIND-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-007', 'DEMO-DEVC-007', '牧草区土壤氮素站',   'PLOT', 'DEMO-PLOT-016', '牧草种植区A',       'nitrogen,soil_moisture',              60,  'BOUND',   '2026-04-02 10:00:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-BIND-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-008', 'DEMO-DEVC-008', '舍饲区氨气监测仪',   'PLOT', 'DEMO-PLOT-018', '舍饲养殖区',        'ammonia,temperature',                 15,  'BOUND',   '2026-04-02 10:10:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-BIND-009', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-009', 'DEMO-DEVC-009', '稻渔区水质监测浮标', 'PLOT', 'DEMO-PLOT-019', '稻渔综合区1号田',   'dissolved_oxygen,ph,temperature',     30,  'BOUND',   '2026-05-11 09:00:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-BIND-010', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-010', 'DEMO-DEVC-010', '花卉A棚摄像头',      'PLOT', 'DEMO-PLOT-023', '花卉A棚',           'snapshot',                           120, 'UNBOUND', '2025-12-01 15:00:00', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_iot_reading (
    reading_id, market_id, tenant_id, device_id, device_code, plot_id, metric, metric_value,
    unit, read_time, quality_flag, raw_payload,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-READ-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-001', 'DEMO-DEVC-001', 'DEMO-PLOT-001', '土壤含水量',    15.200, '%',     '2026-10-10 06:00:00', 1, '{"v":15.2,"bat":92}',                  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-001', 'DEMO-DEVC-001', 'DEMO-PLOT-001', '土壤含水量',    18.600, '%',     '2026-10-10 08:00:00', 1, '{"v":18.6,"bat":92}',                  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-001', 'DEMO-DEVC-001', 'DEMO-PLOT-001', '土壤温度',      22.400, '℃',     '2026-10-10 08:00:00', 1, '{"v":22.4,"bat":92}',                  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-002', 'DEMO-DEVC-002', 'DEMO-PLOT-001', '空气温度',      26.800, '℃',     '2026-10-10 08:00:00', 1, '{"v":26.8}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-002', 'DEMO-DEVC-002', 'DEMO-PLOT-001', '空气温度',      33.500, '℃',     '2026-10-10 13:00:00', 1, '{"v":33.5}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-002', 'DEMO-DEVC-002', 'DEMO-PLOT-001', '空气湿度',      71.200, '%',     '2026-10-10 13:00:00', 1, '{"v":71.2}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-002', 'DEMO-DEVC-002', 'DEMO-PLOT-001', '光照强度',   48200.000, 'lux',    '2026-10-10 13:00:00', 1, '{"v":48200}',                          @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-002', 'DEMO-DEVC-002', 'DEMO-PLOT-001', '空气温度',    -999.000, '℃',     '2026-10-09 21:30:00', 0, '{"v":-999,"err":"sensor_fault"}',      @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-009', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-003', 'DEMO-DEVC-003', 'DEMO-PLOT-002', '虫口密度',      12.000, '头/天', '2026-10-09 22:00:00', 1, '{"v":12}',                             @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-010', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-003', 'DEMO-DEVC-003', 'DEMO-PLOT-002', '虫口密度',      27.000, '头/天', '2026-10-10 22:00:00', 1, '{"v":27}',                             @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-011', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-004', 'DEMO-DEVC-004', 'DEMO-PLOT-006', '水位',          86.400, 'cm',     '2026-10-09 20:00:00', 1, '{"v":86.4}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-012', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-004', 'DEMO-DEVC-004', 'DEMO-PLOT-006', '水位',         138.500, 'cm',     '2026-10-10 02:00:00', 1, '{"v":138.5}',                          @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-013', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-004', 'DEMO-DEVC-004', 'DEMO-PLOT-006', '水位',         112.000, 'cm',     '2026-10-10 08:00:00', 1, '{"v":112.0}',                          @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-014', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-005', 'DEMO-DEVC-005', 'DEMO-PLOT-010', '空气温度',      24.600, '℃',     '2026-10-10 08:00:00', 1, '{"v":24.6}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-015', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-005', 'DEMO-DEVC-005', 'DEMO-PLOT-010', 'CO2浓度',      342.000, 'ppm',    '2026-10-10 08:00:00', 1, '{"v":342}',                            @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-016', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-005', 'DEMO-DEVC-005', 'DEMO-PLOT-010', 'CO2浓度',      468.000, 'ppm',    '2026-10-10 10:00:00', 1, '{"v":468}',                            @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-017', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-005', 'DEMO-DEVC-005', 'DEMO-PLOT-010', '空气湿度',      78.300, '%',     '2026-10-10 10:00:00', 1, '{"v":78.3}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-018', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-006', 'DEMO-DEVC-006', 'DEMO-PLOT-010', '卷帘开度',       0.000, '%',     '2026-10-06 16:20:00', 1, '{"v":0}',                              @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-019', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-007', 'DEMO-DEVC-007', 'DEMO-PLOT-016', '碱解氮',        64.200, 'mg/kg', '2026-10-09 08:00:00', 1, '{"v":64.2}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-020', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-007', 'DEMO-DEVC-007', 'DEMO-PLOT-016', '土壤含水量',    13.400, '%',     '2026-10-09 08:00:00', 1, '{"v":13.4}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-021', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-008', 'DEMO-DEVC-008', 'DEMO-PLOT-018', '氨气浓度',       8.600, 'ppm',    '2026-10-08 20:00:00', 1, '{"v":8.6}',                            @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-022', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-008', 'DEMO-DEVC-008', 'DEMO-PLOT-018', '氨气浓度',      14.200, 'ppm',    '2026-10-09 04:00:00', 1, '{"v":14.2}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-023', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-009', 'DEMO-DEVC-009', 'DEMO-PLOT-019', '溶解氧',         3.200, 'mg/L',   '2026-10-09 22:00:00', 1, '{"v":3.2}',                            @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-024', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-009', 'DEMO-DEVC-009', 'DEMO-PLOT-019', '溶解氧',         5.800, 'mg/L',   '2026-10-10 06:00:00', 1, '{"v":5.8}',                            @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-025', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-009', 'DEMO-DEVC-009', 'DEMO-PLOT-019', 'PH值',           7.350, '',       '2026-10-10 06:00:00', 1, '{"v":7.35}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-026', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-009', 'DEMO-DEVC-009', 'DEMO-PLOT-019', '水温',          21.800, '℃',     '2026-10-10 06:00:00', 1, '{"v":21.8}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-027', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-001', 'DEMO-DEVC-001', 'DEMO-PLOT-001', '土壤含水量',    19.100, '%',     '2026-10-09 08:00:00', 1, '{"v":19.1}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-028', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-002', 'DEMO-DEVC-002', 'DEMO-PLOT-001', '空气湿度',      82.600, '%',     '2026-10-09 20:00:00', 1, '{"v":82.6}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-029', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-004', 'DEMO-DEVC-004', 'DEMO-PLOT-006', '水位',          94.700, 'cm',     '2026-10-08 20:00:00', 1, '{"v":94.7}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-READ-030', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-005', 'DEMO-DEVC-005', 'DEMO-PLOT-010', '空气温度',      19.400, '℃',     '2026-10-09 02:00:00', 1, '{"v":19.4}',                           @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_iot_command (
    command_id, market_id, tenant_id, device_id, device_code, command_type, params,
    operator, status, receipt, send_at, receipt_at,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-CMD-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-006', 'DEMO-DEVC-006', 'VALVE_SWITCH', '{"open":true,"durationSec":600}', 'DEMO-MEM-007', 'SUCCESS', '{"code":0,"msg":"ok"}',        '2026-09-28 07:30:00', '2026-09-28 07:30:08', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-CMD-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-006', 'DEMO-DEVC-006', 'READING',      '{"metric":"curtain_position"}',   'DEMO-MEM-007', 'SUCCESS', '{"code":0,"v":80}',            '2026-09-28 07:35:00', '2026-09-28 07:35:06', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-CMD-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-008', 'DEMO-DEVC-008', 'REBOOT',       '{}',                              'DEMO-MEM-009', 'FAILED',  '{"code":-1,"msg":"timeout"}', '2026-10-09 04:50:00', '2026-10-09 04:50:35', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-CMD-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-001', 'DEMO-DEVC-001', 'READING',      '{"metric":"soil_moisture"}',      'DEMO-MEM-002', 'PENDING', NULL,                          '2026-10-10 08:30:00', NULL,                  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_iot_maintenance (
    maintain_id, market_id, tenant_id, device_id, device_code, maintain_type, content,
    operator, maintain_at, result,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-MAIN-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-001', 'DEMO-DEVC-001', 'CALIBRATE', '土壤含水率探头标定，更换检定证书到期部件', '华维售后', '2026-04-18 10:00:00', '标定合格，误差 ≤1.5%',       @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MAIN-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-004', 'DEMO-DEVC-004', 'REPLACE',   '水位计超声波探头老化，整体更换',           '鑫源售后', '2026-06-22 14:30:00', '更换后读数与人工水尺一致',   @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MAIN-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-DEV-008', 'DEMO-DEVC-008', 'REPAIR',    '氨气监测仪离线排查，更换电源模块',         '芯农售后', '2026-10-09 11:20:00', '设备仍不稳定，需进一步返修', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 9. 生长监测记录
-- =====================================================================================

INSERT INTO prod_growth_record (
    record_id, market_id, tenant_id, plot_id, plan_id, batch_id, crop_id, growth_stage,
    record_date, height, leaf_count, pest_level, weather, photos, recorder_id, remark, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-GROW-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-001', 'DEMO-PLAN-001', NULL,            'DEMO-CROP-001', '苗期',   '2026-03-15',  28.50,   9, 0, '晴',   '[]', 'DEMO-MEM-003', '定植后长势整齐',                 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-GROW-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-001', 'DEMO-PLAN-001', NULL,            'DEMO-CROP-001', '花期',   '2026-05-08',  96.00,  22, 1, '多云', '[]', 'DEMO-MEM-003', '第一穗花开放 60%',              1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-GROW-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-001', 'DEMO-PLAN-001', 'DEMO-BATCH-001', 'DEMO-CROP-001', '果期',   '2026-07-18', 152.00,  26, 1, '晴',   '[]', 'DEMO-MEM-003', '第三穗果膨大期',                1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-GROW-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-002', 'DEMO-PLAN-002', NULL,            'DEMO-CROP-002', '花期',   '2026-05-20',  38.40,  18, 1, '阴',   '[]', 'DEMO-MEM-002', '雌花密度正常',                  1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-GROW-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-002', 'DEMO-PLAN-002', 'DEMO-BATCH-002', 'DEMO-CROP-002', '果期',   '2026-07-26', 186.00,  24, 2, '晴',   '[]', 'DEMO-MEM-002', '下部叶片发现霜霉病斑，已施药',  1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-GROW-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-003', 'DEMO-PLAN-003', 'DEMO-BATCH-003', 'DEMO-CROP-004', '成熟期', '2026-09-28',  72.00,  34, 1, '晴',   '[]', 'DEMO-MEM-002', '首批采收前测产',                1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-GROW-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-006', 'DEMO-PLAN-004', NULL,            'DEMO-CROP-003', '分蘖期', '2026-06-28',  45.30,   6, 0, '小雨', '[]', 'DEMO-MEM-005', '亩茎蘖数约 22 万',              1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-GROW-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-006', 'DEMO-PLAN-004', NULL,            'DEMO-CROP-003', '抽穗期', '2026-08-28',  98.60,  11, 1, '晴',   '[]', 'DEMO-MEM-005', '抽穗整齐，稻瘟病零星发生',      1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-GROW-009', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-010', 'DEMO-PLAN-005', NULL,            'DEMO-CROP-001', '苗期',   '2026-09-12',  24.80,   8, 0, '晴',   '[]', 'DEMO-MEM-007', '定植成活率 98%',                1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-GROW-010', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-016', 'DEMO-PLAN-006', 'DEMO-BATCH-006', 'DEMO-CROP-005', '初花期', '2026-09-14',  68.00, NULL, 0, '晴',   '[]', 'DEMO-MEM-009', '第三茬刈割前调查',              1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 10. 采收批次 + 采收作业记录 + 库存流水
-- =====================================================================================

INSERT INTO prod_harvest_batch (
    batch_id, market_id, tenant_id, batch_no, plot_id, plan_id, crop_id, crop_variety,
    harvest_date, quantity, unit, grade, inspection_id, operator_id, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-BATCH-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-BATCHN-001', 'DEMO-PLOT-001', 'DEMO-PLAN-001', 'DEMO-CROP-001', '普罗旺斯',      '2026-06-28',   8600.00, 'kg', '一级', 'DEMO-INSP-001', 'DEMO-MEM-003', 2, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-28 17:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-BATCH-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-BATCHN-002', 'DEMO-PLOT-002', 'DEMO-PLAN-002', 'DEMO-CROP-002', '津优35',        '2026-07-26',   5200.00, 'kg', '一级', 'DEMO-INSP-002', 'DEMO-MEM-002', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-26 16:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-BATCH-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-BATCHN-003', 'DEMO-PLOT-003', 'DEMO-PLAN-003', 'DEMO-CROP-004', '湘研15号',      '2026-09-28',   3400.00, 'kg', '待检', NULL,             'DEMO-MEM-002', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-28 15:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-BATCH-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-BATCHN-004', 'DEMO-PLOT-007', 'DEMO-PLAN-004', 'DEMO-CROP-003', '南粳9108',      '2026-10-08',  96000.00, 'kg', '二级', 'DEMO-INSP-004', 'DEMO-MEM-005', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-08 18:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-BATCH-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-BATCHN-005', 'DEMO-PLOT-012', 'DEMO-PLAN-005', 'DEMO-CROP-004', '洛椒98A',       '2026-09-20',   7200.00, 'kg', '一级', 'DEMO-INSP-005', 'DEMO-MEM-007', 2, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-20 17:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-BATCH-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-BATCHN-006', 'DEMO-PLOT-016', 'DEMO-PLAN-006', 'DEMO-CROP-005', '紫花苜蓿WL656', '2026-09-16', 128000.00, 'kg', '二级', NULL,             'DEMO-MEM-009', 4, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-16 18:00:00', @DEMO_UPDATE_AT, 0);

INSERT INTO prod_harvest_record (
    record_id, market_id, tenant_id, plot_id, plan_id, crop_id, crop_variety, harvest_date,
    quantity, unit, grade, operator_id, weather, remark, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-HARV-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-001', 'DEMO-PLAN-001', 'DEMO-CROP-001', '普罗旺斯',      '2026-06-28',   8600.00, 'kg', '一级', 'DEMO-MEM-003', '晴',   '第三批采收，八成熟采摘',  1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-28 17:10:00', @DEMO_UPDATE_AT, 0),
('DEMO-HARV-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-002', 'DEMO-PLAN-002', 'DEMO-CROP-002', '津优35',        '2026-07-26',   5200.00, 'kg', '一级', 'DEMO-MEM-002', '多云', '首批次商品瓜采收',        1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-26 16:40:00', @DEMO_UPDATE_AT, 0),
('DEMO-HARV-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-003', 'DEMO-PLAN-003', 'DEMO-CROP-004', '湘研15号',      '2026-09-28',   3400.00, 'kg', '待检', 'DEMO-MEM-002', '晴',   '待送第三方检测',          1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-28 15:10:00', @DEMO_UPDATE_AT, 0),
('DEMO-HARV-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-007', 'DEMO-PLAN-004', 'DEMO-CROP-003', '南粳9108',      '2026-10-08',  96000.00, 'kg', '二级', 'DEMO-MEM-005', '晴',   '联合收割机整田作业',      1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-08 18:10:00', @DEMO_UPDATE_AT, 0),
('DEMO-HARV-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-012', 'DEMO-PLAN-005', 'DEMO-CROP-004', '洛椒98A',       '2026-09-20',   7200.00, 'kg', '一级', 'DEMO-MEM-007', '阴',   '温室采摘后立即预冷',      1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-20 17:40:00', @DEMO_UPDATE_AT, 0),
('DEMO-HARV-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-016', 'DEMO-PLAN-006', 'DEMO-CROP-005', '紫花苜蓿WL656', '2026-09-16', 128000.00, 'kg', '二级', 'DEMO-MEM-009', '晴',   '第三茬刈割青贮',          1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-16 18:10:00', @DEMO_UPDATE_AT, 0);

INSERT INTO prod_inventory_flow (
    flow_id, market_id, tenant_id, batch_id, warehouse_id, flow_type, qty, unit,
    before_qty, after_qty, operator_id, related_order_no, remark,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-INV-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-BATCH-001', 'DEMO-WH-001', 1,  8600.00, 'kg',     0.00,  8600.00, 'DEMO-MEM-003', NULL,             '演示数据：番茄批次入库',       @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-28 19:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-INV-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-BATCH-001', 'DEMO-WH-001', 2, -3200.00, 'kg',  8600.00,  5400.00, 'DEMO-MEM-003', 'DEMO-ORDER-001', '演示数据：商超渠道出库',       @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-02 10:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-INV-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-BATCH-002', 'DEMO-WH-001', 1,  5200.00, 'kg',     0.00,  5200.00, 'DEMO-MEM-002', NULL,             '演示数据：黄瓜批次入库',       @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-26 19:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-INV-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-BATCH-002', 'DEMO-WH-001', 4,  -120.00, 'kg',  5200.00,  5080.00, 'DEMO-MEM-002', NULL,             '演示数据：冷链运输损耗报损',   @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-30 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-INV-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-BATCH-004', 'DEMO-WH-002', 1, 96000.00, 'kg',     0.00, 96000.00, 'DEMO-MEM-005', NULL,             '演示数据：稻谷批次入库',       @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-08 20:00:00', @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 11. 检测机构 + 质量检测
-- =====================================================================================

INSERT INTO prod_quality_lab (
    lab_id, market_id, tenant_id, lab_code, lab_name, lab_type, contact_name, contact_phone,
    address, qualification_no, accredited_scope, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-LAB-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-LABC-001', '【演示】南方农产品质量检测中心', '第三方', '何主任', '13700001001', '广州市萝岗区科学大道 15 号', 'DEMO-CMA-20250001', '农药残留,重金属,微生物', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-LAB-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-LABC-002', '【演示】市农业农村局检测站',     '政府',   '罗站长', '13700001002', '寿光市圣城街 66 号',         'DEMO-CMA-20250002', '农药残留,兽药残留',       1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_inspection (
    inspection_id, market_id, tenant_id, inspection_no, batch_id, plot_id, crop_id,
    inspection_type, inspector_id, inspector_name, sample_qty, sample_at,
    result, report_url, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-INSP-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INSPC-001', 'DEMO-BATCH-001', 'DEMO-PLOT-001', 'DEMO-CROP-001', 'SEND',     'DEMO-MEM-001', '陈志强', 3.00, '2026-06-29 08:30:00', 'PASS', 'https://demo.example.com/report/INSPC-001.pdf', 'DONE',    @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-29 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-INSP-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INSPC-002', 'DEMO-BATCH-002', 'DEMO-PLOT-002', 'DEMO-CROP-002', 'SELF',     'DEMO-MEM-002', '刘玉华', 2.00, '2026-07-27 09:00:00', 'PASS', NULL,                                            'DONE',    @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-27 09:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-INSP-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INSPC-003', 'DEMO-BATCH-003', 'DEMO-PLOT-003', 'DEMO-CROP-004', 'SAMPLING', 'DEMO-MEM-001', '陈志强', 5.00, '2026-09-29 10:00:00', NULL,   NULL,                                            'TESTING', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-29 10:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-INSP-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INSPC-004', 'DEMO-BATCH-004', 'DEMO-PLOT-007', 'DEMO-CROP-003', 'SEND',     'DEMO-MEM-004', '顾建平', 6.00, '2026-10-09 09:20:00', 'PASS', 'https://demo.example.com/report/INSPC-004.pdf', 'DONE',    @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-09 10:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-INSP-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-INSPC-005', 'DEMO-BATCH-005', 'DEMO-PLOT-012', 'DEMO-CROP-004', 'SELF',     'DEMO-MEM-007', '孙建国', 2.00, '2026-09-21 08:40:00', 'FAIL', NULL,                                            'DONE',    @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-21 09:00:00', @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 12. 溯源码（V1 遗留表，主键/批次为 BIGINT，详见文件头「已知结构限制」）
-- =====================================================================================

INSERT INTO prod_trace_code (
    id, market_id, tenant_id, batch_id, batch_no, code, status, scan_count,
    activated_at, activated_by, last_scan_at, expire_date,
    create_by, update_by, created_at, updated_at, deleted
) VALUES
(910000000000000001, @DEMO_MARKET_ID, @DEMO_TENANT_ID, 920000000000000001, 'DEMO-BATCHN-001', 'DEMO-TC-0001', 'ACTIVE',   128, '2026-06-29 10:00:00', 'DEMO-MEM-003', '2026-10-09 15:22:00', '2027-06-28', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-28 19:30:00', @DEMO_UPDATE_AT, 0),
(910000000000000002, @DEMO_MARKET_ID, @DEMO_TENANT_ID, 920000000000000001, 'DEMO-BATCHN-001', 'DEMO-TC-0002', 'ACTIVE',    86, '2026-06-29 10:00:00', 'DEMO-MEM-003', '2026-10-08 11:04:00', '2027-06-28', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-28 19:30:00', @DEMO_UPDATE_AT, 0),
(910000000000000003, @DEMO_MARKET_ID, @DEMO_TENANT_ID, 920000000000000002, 'DEMO-BATCHN-002', 'DEMO-TC-0003', 'ACTIVE',    54, '2026-07-27 11:00:00', 'DEMO-MEM-002', '2026-10-07 09:48:00', '2027-07-26', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-26 19:30:00', @DEMO_UPDATE_AT, 0),
(910000000000000004, @DEMO_MARKET_ID, @DEMO_TENANT_ID, 920000000000000003, 'DEMO-BATCHN-003', 'DEMO-TC-0004', 'INACTIVE',   0, NULL,                  NULL,           NULL,                  '2027-09-28', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-28 16:00:00', @DEMO_UPDATE_AT, 0),
(910000000000000005, @DEMO_MARKET_ID, @DEMO_TENANT_ID, 920000000000000004, 'DEMO-BATCHN-004', 'DEMO-TC-0005', 'ACTIVE',    12, '2026-10-09 14:00:00', 'DEMO-MEM-005', '2026-10-10 08:15:00', '2027-10-08', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-08 20:30:00', @DEMO_UPDATE_AT, 0),
(910000000000000006, @DEMO_MARKET_ID, @DEMO_TENANT_ID, 920000000000000005, 'DEMO-BATCHN-005', 'DEMO-TC-0006', 'ACTIVE',    37, '2026-09-21 10:00:00', 'DEMO-MEM-007', '2026-10-06 16:30:00', '2027-09-20', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-20 18:00:00', @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 13. 区块链存证
-- =====================================================================================

INSERT INTO prod_blockchain_record (
    record_id, market_id, tenant_id, biz_type, biz_no, batch_id, trace_code, chain_type,
    chain_network, tx_hash, block_height, payload_hash, anchor_at, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-CHAIN-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'TRACE',      'DEMO-TC-0001',    'DEMO-BATCH-001', 'DEMO-TC-0001', 'TrustChain', 'agri-mainnet', 'DEMO-TX-0x1a2b3c4d5e6f0001', 12884201, 'DEMO-HASH-9f86d081884c7d659a2f', '2026-06-29 10:05:00', 'SUCCESS', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-29 10:05:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHAIN-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'INSPECTION', 'DEMO-INSPC-001', 'DEMO-BATCH-001', NULL,           'TrustChain', 'agri-mainnet', 'DEMO-TX-0x1a2b3c4d5e6f0002', 12884233, 'DEMO-HASH-2b8gd091c884c7d6591a', '2026-06-30 09:12:00', 'SUCCESS', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-30 09:12:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHAIN-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'HARVEST',    'DEMO-BATCHN-004', 'DEMO-BATCH-004', NULL,          'TrustChain', 'agri-mainnet', 'DEMO-TX-0x1a2b3c4d5e6f0003', 12901884, 'DEMO-HASH-c1f3ee8a1d2b4477011c', '2026-10-09 10:30:00', 'SUCCESS', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-09 10:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHAIN-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'TRACE',      'DEMO-TC-0006',    'DEMO-BATCH-005', 'DEMO-TC-0006', 'TrustChain', 'agri-mainnet', NULL,                         NULL,     NULL,                            NULL,                  'PENDING', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-21 10:10:00', @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 14. 生产团队成员 +站内消息 + 系统设置
-- =====================================================================================

INSERT INTO prod_member (
    member_id, market_id, tenant_id, farm_id, user_id, member_name, member_type,
    phone, role_code, post_name, join_date, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-MEM-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', NULL, '陈志强', 'OWNER',      '13900000001', 'FARM_OWNER', '农场负责人', '2022-03-01', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MEM-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', NULL, '刘玉华', 'AGRONOMIST', '13900000102', 'AGRONOMIST', '农艺师',     '2023-05-12', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MEM-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', NULL, '黄大军', 'OPERATOR',   '13900000103', 'OPERATOR',   '田间操作工', '2024-01-08', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MEM-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', NULL, '顾建平', 'OWNER',      '13900000002', 'FARM_OWNER', '农场负责人', '2021-11-20', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MEM-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', NULL, '吴有田', 'OPERATOR',   '13900000105', 'OPERATOR',   '农机手',     '2023-09-15', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MEM-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', NULL, '王秀兰', 'OWNER',      '13900000003', 'FARM_OWNER', '农场负责人', '2020-06-10', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MEM-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', NULL, '孙建国', 'INSPECTOR',  '13900000107', 'INSPECTOR',  '质量巡检员', '2024-02-26', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MEM-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', NULL, '马占军', 'OWNER',      '13900000004', 'FARM_OWNER', '牧场负责人', '2019-08-05', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MEM-009', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', NULL, '妥建国', 'OPERATOR',   '13900000109', 'OPERATOR',   '饲养员',     '2022-12-01', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MEM-010', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', NULL, '杨兽医', 'INSPECTOR',  '13900000110', 'INSPECTOR',  '驻场兽医',   '2023-04-18', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MEM-011', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', NULL, '李道明', 'OWNER',      '13900000005', 'FARM_OWNER', '农场负责人', '2021-03-22', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-MEM-012', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-006', NULL, '赵文彬', 'OWNER',      '13900000006', 'FARM_OWNER', '基地负责人', '2022-07-30', 0, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_message_notify (
    message_id, market_id, tenant_id, farm_id, receiver_id, msg_type, title, content,
    biz_id, read_flag, sent_at, read_at, channel, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-MSG-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-MEM-001', 'ALERT',  '土壤含水量告警', 'A区连栋大棚土壤含水量 15.2%，低于 18% 阈值，请及时灌溉', 'DEMO-ALERT-001', 0, '2026-10-08 14:21:00', NULL,                  'INBOX', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-08 14:21:00', @DEMO_UPDATE_AT, 0),
('DEMO-MSG-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-MEM-002', 'TASK',   '新农事任务派发', '您有一条新的打药任务：C区辣椒疫病统防，请于 9 月 10 日前完成', 'DEMO-TASK-007', 1, '2026-08-26 09:10:00', '2026-08-26 10:02:00', 'INBOX', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-26 09:10:00', @DEMO_UPDATE_AT, 0),
('DEMO-MSG-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-MEM-001', 'QUALITY','检测报告已出具', '批次 DEMO-BATCHN-001 农药残留检测结论为合格，报告已归档', 'DEMO-INSP-001',  1, '2026-06-30 09:20:00', '2026-06-30 11:00:00', 'INBOX', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-30 09:20:00', @DEMO_UPDATE_AT, 0),
('DEMO-MSG-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', 'DEMO-MEM-004', 'ALERT',  '田间水位超限',   '东片区水位 138.5cm，超过 120cm 警戒线，请注意排水', 'DEMO-ALERT-007', 0, '2026-10-08 22:11:00', NULL,                  'INBOX', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-08 22:11:00', @DEMO_UPDATE_AT, 0),
('DEMO-MSG-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', 'DEMO-MEM-006', 'SYSTEM', '认证临期提醒',   '本农场绿色食品认证将于 90 天后到期，请提前准备换证材料', NULL, 0, '2026-09-25 08:00:00', NULL, 'INBOX', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-25 08:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-MSG-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', 'DEMO-MEM-011', 'ALERT',  '溶解氧偏低',     '稻渔区1号田溶解氧 3.2mg/L，已低于安全阈值，请开启增氧设备', 'DEMO-ALERT-018', 0, '2026-10-06 23:41:00', NULL, 'SMS', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-06 23:41:00', @DEMO_UPDATE_AT, 0);

INSERT INTO prod_sys_setting (
    setting_id, market_id, tenant_id, farm_id, setting_group, setting_key, setting_name,
    setting_value, default_value, value_type, remark, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-SET-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL, 'ALERT',   'DEMO.alert.notifyChannels', '告警通知渠道',     '["INBOX","SMS","WECHAT"]', '["INBOX"]',                 'JSON',    '演示数据：告警默认推送渠道',   1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SET-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL, 'ALERT',   'DEMO.alert.quietHours',     '告警免打扰时段',   '22:00-06:00',             '23:00-06:00',               'STRING',  '演示数据：免打扰不阻断 CRITICAL', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SET-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL, 'TRACE',   'DEMO.trace.autoActivate',   '溯源码自动激活',   'true',                    'false',                     'BOOLEAN', '演示数据：采收后是否自动激活码', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SET-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, NULL, 'QUALITY', 'DEMO.quality.passThreshold','农残合格判定阈值', '0.05',                    '0.05',                      'NUMBER',  '演示数据：单位 mg/kg',          1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 15. AI 诊断记录 + 数据分析快照
-- =====================================================================================

INSERT INTO prod_ai_diagnosis (
    diagnosis_id, market_id, tenant_id, plot_id, crop_id, crop_name, image_url,
    diagnosis_type, result_label, confidence, suggestion, model_name, diagnosed_at, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-AI-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-002', 'DEMO-CROP-002', '黄瓜', 'https://demo.example.com/ai/cucumber-001.jpg', 'PEST',    '黄瓜霜霉病',       92.50, '立即摘除病叶，选用烯酰吗啉或吡唑醚菌酯叶面喷施，7 天后复诊', 'agri-pest-v3', '2026-07-02 08:15:00', 'SUCCESS', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-02 08:15:00', @DEMO_UPDATE_AT, 0),
('DEMO-AI-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-001', 'DEMO-CROP-001', '番茄', 'https://demo.example.com/ai/tomato-002.jpg',   'GROWTH',  '长势良好',         88.30, '维持现行水肥方案，注意整枝打杈',                           'agri-growth-v2', '2026-06-10 09:30:00', 'SUCCESS', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-06-10 09:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-AI-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-001', 'DEMO-CROP-001', '番茄', 'https://demo.example.com/ai/tomato-003.jpg',   'MATURITY','八成熟，可采收', 95.10, '建议 3 日内分批采收，采收后预冷至 10 度以下',             'agri-maturity-v2', '2026-07-14 07:45:00', 'SUCCESS', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-14 07:45:00', @DEMO_UPDATE_AT, 0),
('DEMO-AI-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-PLOT-006', 'DEMO-CROP-003', '水稻', 'https://demo.example.com/ai/rice-004.jpg',     'PEST',    '稻瘟病（叶瘟）',   81.60, '破口前统一施药一次，选用三环唑或稻瘟灵',                   'agri-pest-v3', '2026-08-12 10:20:00', 'SUCCESS', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-12 10:20:00', @DEMO_UPDATE_AT, 0);

INSERT INTO prod_analytics_snapshot (
    snapshot_id, market_id, tenant_id, farm_id, plot_id, biz_date, metric_code, metric_name,
    metric_value, unit, dim_type, dim_value, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-SNAP-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', NULL,           '2026-10-09', 'YIELD',      '累计产量',     86420.0000, 'kg',  'FARM', 'DEMO-FARM-001', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SNAP-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', NULL,           '2026-10-09', 'PASS_RATE',  '检测合格率',       96.8000, '%',   'FARM', 'DEMO-FARM-001', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SNAP-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', 'DEMO-PLOT-001', '2026-10-09', 'COST',       '亩均生产成本',  1284.5000, '元',  'PLOT', 'DEMO-PLOT-001', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SNAP-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', NULL,           '2026-10-09', 'YIELD',      '累计产量',    412300.0000, 'kg',  'FARM', 'DEMO-FARM-002', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SNAP-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', NULL,           '2026-10-09', 'PASS_RATE',  '检测合格率',       91.2000, '%',   'FARM', 'DEMO-FARM-003', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SNAP-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', 'DEMO-PLOT-019', '2026-10-09', 'COST',       '亩均生产成本',   682.3000, '元',  'PLOT', 'DEMO-PLOT-019', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 16. 运营端：农场合规检查任务（farm_id 全部指向真实存在的演示农场档案）
-- =====================================================================================

INSERT INTO prod_farm_compliance_check (
    check_id, market_id, tenant_id, farm_id, farm_name, check_type, check_item,
    check_result, problem_desc, rectify_requirement, rectify_deadline, checker_name, checked_at,
    rectify_status, rectify_remark, rectify_attachment, rectified_at,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-CHK-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', '【演示】华南绿色蔬菜示范农场', '禁限用农资抽查', '甲拌磷等高毒农药禁用核查',
 1, NULL, NULL, NULL, '监管员甲', '2026-08-12 10:30:00',
 'none', NULL, NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-12 10:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', '【演示】华南绿色蔬菜示范农场', '记录缺失督导', '投入品使用记录台账完整性',
 2, '5 月至 6 月共有 3 条用药记录缺失施用方式字段', '限期内补齐全部缺失字段，并提交台账复核申请', '2026-09-20', '监管员甲', '2026-09-05 14:00:00',
 'rectified', '已补齐 3 条记录并通过复核', 'https://demo.example.com/rectify/CHK-002.pdf', '2026-09-18 16:20:00',
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-05 14:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', '【演示】华南绿色蔬菜示范农场', '常规检查', '安全间隔期执行情况',
 3, 'C区辣椒地块在采收前 2 天检出农药施用记录，违反安全间隔期规定', '立即暂停该批次上市销售，整改后重新送检', '2026-10-20', '监管员乙', '2026-10-09 09:15:00',
 'processing', '已暂停 DEMO-BATCHN-003 批次出库，待复检', NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-09 09:15:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-004', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-001', '【演示】华南绿色蔬菜示范农场', '禁限用农资抽查', '库存禁用农药封存情况',
 2, '仓库留存 2 瓶已禁用农药未按规定封存登记', '完成封存登记并移交属地农业综合执法机构', '2026-10-25', '监管员乙', '2026-10-10 11:00:00',
 'pending', NULL, NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-10 11:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-005', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', '【演示】华东智慧稻田农场', '记录缺失督导', '水稻田间生产记录归档',
 1, NULL, NULL, NULL, '监管员甲', '2026-09-18 15:40:00',
 'none', NULL, NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-18 15:40:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-006', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-002', '【演示】华东智慧稻田农场', '常规检查', '灌溉水质检测频次',
 2, '本季度灌溉水质仅检测 1 次，未满足每季度 2 次要求', '补做一次灌溉水质检测并留存报告', '2026-11-30', '监管员丙', '2026-10-08 10:20:00',
 'pending', NULL, NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-08 10:20:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-007', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', '【演示】鲁中设施果蔬农场', '禁限用农资抽查', '禁限用农药网上追溯核验',
 1, NULL, NULL, NULL, '监管员丙', '2026-09-22 09:00:00',
 'none', NULL, NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-22 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-008', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', '【演示】鲁中设施果蔬农场', '常规检查', '绿色食品认证有效期',
 2, '绿色食品认证已于 2026-01-21 到期，仍在产品包装上标注相关标识', '立即停止使用过期认证标识，完成换证后方可恢复', '2026-08-31', '监管员甲', '2026-07-15 13:30:00',
 'overdue', '整改期限届满仍未提交换证材料，已移交执法线索', NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-07-15 13:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-009', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-003', '【演示】鲁中设施果蔬农场', '记录缺失督导', '自检台账与送检报告一致性',
 3, '自检记录显示合格但第三方送检同批次判定不合格，存在记录真实性存疑', '暂停自检资质，全部批次改为第三方检测', '2026-10-15', '监管员乙', '2026-09-21 16:00:00',
 'processing', '已切换第三方全项检测', NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-21 16:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-010', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', '【演示】西北高原生态牧场', '常规检查', '休药期与兽药使用记录',
 2, '2 头肉牛用药记录中的休药期字段与实际出栏时间冲突', '延期出栏至满足休药期，并完善用药台账', '2026-11-15', '监管员丙', '2026-10-08 14:30:00',
 'pending', NULL, NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-08 14:30:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-011', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-004', '【演示】西北高原生态牧场', '记录缺失督导', '饲草投入品入库验收单',
 1, NULL, NULL, NULL, '监管员甲', '2026-09-30 10:00:00',
 'none', NULL, NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-30 10:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-012', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', '【演示】江汉稻渔综合种养农场', '常规检查', '养殖尾水排放达标情况',
 2, '3 号田尾水总磷指标超出排放限值 0.4mg/L', '增设生态沟渠净化段，复测达标后方可排放', '2026-10-31', '监管员乙', '2026-09-26 09:20:00',
 'processing', '生态沟渠已完成改造，待复测', NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-26 09:20:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-013', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-005', '【演示】江汉稻渔综合种养农场', '禁限用农资抽查', '渔药使用合规性',
 1, NULL, NULL, NULL, '监管员丙', '2026-10-02 15:00:00',
 'none', NULL, NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-02 15:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-CHK-014', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-FARM-006', '【演示】滇中花卉种苗基地', '常规检查', '停用地块复垦与安全隔离',
 2, '停用基地仍有 3 个棚室在产，未按规定执行停止备案', '完成在产棚室处置并补办停用备案手续', '2026-12-31', '监管员甲', '2026-08-20 11:30:00',
 'pending', NULL, NULL, NULL,
 @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-20 11:30:00', @DEMO_UPDATE_AT, 0);

-- =====================================================================================
-- 17. 运营端：配额 / 审批 / SOP / 报表 / 知识库
-- =====================================================================================

INSERT INTO prod_tenant_quota (
    quota_id, market_id, tenant_id, tenant_code, tenant_name, farm_limit, plot_limit,
    device_limit, user_limit, storage_limit_gb, trace_code_limit, api_call_limit,
    used_farm_count, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-QUOTA-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TENANT-001', '【演示】华南示范农业合作社', 20, 200, 300, 100, 500.00, 200000, 200000, 2, 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-QUOTA-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-TENANT-002', '【演示】华东稻米产业联合体', 50, 800, 1000, 300, 2000.00, 1000000, 500000, 4, 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_approval (
    approval_id, market_id, tenant_id, biz_type, biz_id, title, applicant_id, applicant_name,
    approve_level, current_approver_id, approve_opinion, submit_at, approve_at, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-APR-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'CERT',   'DEMO-FARM-003', '绿色食品认证换证申请',     'DEMO-MEM-006', '王秀兰', 1, 'SUPER_ADMIN', '同意受理，需补交本年度检测报告',   '2026-09-01 09:00:00', '2026-09-03 10:30:00', 'APPROVED',  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-09-01 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-APR-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'RECALL', 'DEMO-BATCH-003', '辣椒批次风险召回申请',     'DEMO-MEM-001', '陈志强', 2, 'SUPER_ADMIN', NULL,                             '2026-10-09 11:00:00', NULL,                  'PENDING',   @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-09 11:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-APR-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'QUOTA',  'DEMO-QUOTA-001', '农场数上限扩容至 50 个',   'DEMO-MEM-001', '陈志强', 1, 'SUPER_ADMIN', '当前用量未达扩容门槛，暂不批准',   '2026-08-15 14:20:00', '2026-08-18 09:00:00', 'REJECTED',  @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-08-15 14:20:00', @DEMO_UPDATE_AT, 0);

INSERT INTO prod_sop_library (
    sop_id, market_id, tenant_id, crop_id, sop_code, sop_name, sop_type, version_no,
    content_url, stage_seq, applicable_region, publisher, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-SOP-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-CROP-001', 'DEMO-SOPC-001', '设施番茄绿色生产操作规程', 'PLANT',   'V1.2', 'https://demo.example.com/sop/tomato-v1.2.pdf', 1, '华南设施蔬菜主产区', '省农科院', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SOP-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-CROP-002', 'DEMO-SOPC-002', '黄瓜主要病虫害防控规程',   'PEST',    'V2.0', 'https://demo.example.com/sop/cucumber-v2.0.pdf', 3, '华东及黄淮海地区',   '省植保站', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-SOP-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'DEMO-CROP-003', 'DEMO-SOPC-003', '水稻机插收获作业规程',     'HARVEST', 'V1.5', 'https://demo.example.com/sop/rice-v1.5.pdf', 4, '长江中下游稻区',     '农业农村厅', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

INSERT INTO prod_report_task (
    report_id, market_id, tenant_id, report_type, report_name, farm_id, biz_date_from,
    biz_date_to, generator_id, file_url, generated_at, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-RPT-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'QUALITY', '2026年第三季度农产品质量安全报', NULL, '2026-07-01', '2026-09-30', 'SUPER_ADMIN', 'https://demo.example.com/report/2026Q3-quality.pdf', '2026-10-02 08:00:00', 'DONE',   @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-01 09:00:00', @DEMO_UPDATE_AT, 0),
('DEMO-RPT-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'GOV',     '2026年度农产品质量追溯监管年报', NULL, '2026-01-01', '2026-12-31', 'SUPER_ADMIN', NULL,                                                   NULL,                  'PENDING', @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, '2026-10-09 16:00:00', @DEMO_UPDATE_AT, 0);

INSERT INTO prod_knowledge_article (
    article_id, market_id, tenant_id, category_code, title, summary, content_url,
    author, source, read_count, publish_at, status,
    create_by, update_by, create_at, update_at, deleted
) VALUES
('DEMO-ART-001', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'PLANT',   '设施番茄越夏栽培关键技术要点', '高温季节设施番茄保花保果、遮阳降温与水肥调控的实操要点', 'https://demo.example.com/kb/tomato-summer.html', '李研究员', '省农业技术推广总站', 386, '2026-05-20 10:00:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-ART-002', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'PEST',    '稻瘟病识别与统防统治技术',     '叶瘟、穗颈瘟的田间识别特征与破口期统防统治施药窗口',     'https://demo.example.com/kb/rice-blast.html',     '王植保',   '全国农技推广中心',   512, '2026-07-08 09:30:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0),
('DEMO-ART-003', @DEMO_MARKET_ID, @DEMO_TENANT_ID, 'POLICY',  '绿色食品标志许可审查要点解读', '新版审查细则中关于产地环境、投入品管理的关键条款解读',   'https://demo.example.com/kb/green-food.html',     '张科长',   '绿色食品发展中心',   174, '2026-08-30 14:00:00', 1, @DEMO_AUDIT_BY, @DEMO_AUDIT_BY, @DEMO_CREATE_AT, @DEMO_UPDATE_AT, 0);

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================================
-- 99. 清理演示数据（一键清空，仅删 DEMO- 前缀行，不触碰任何真实业务数据）
-- =====================================================================================
--
-- 需要恢复空态时，逐条执行下面的语句即可。等价做法：直接重跑第 0 节。
--
-- DELETE FROM prod_farm_info             WHERE farm_id       LIKE 'DEMO-FARM-%';
-- DELETE FROM prod_farm_cert             WHERE cert_id       LIKE 'DEMO-CERT-%';
-- DELETE FROM prod_farm_compliance_check WHERE check_id      LIKE 'DEMO-CHK-%';
-- DELETE FROM prod_plot_info             WHERE plot_id       LIKE 'DEMO-PLOT-%';
-- DELETE FROM prod_plot_soil             WHERE soil_id       LIKE 'DEMO-SOIL-%';
-- DELETE FROM prod_supplier              WHERE supplier_id   LIKE 'DEMO-SUP-%';
-- DELETE FROM prod_input_info            WHERE input_id      LIKE 'DEMO-INPUT-%';
-- DELETE FROM prod_input_usage           WHERE usage_id      LIKE 'DEMO-USE-%';
-- DELETE FROM prod_input_stock_flow      WHERE flow_id       LIKE 'DEMO-FLOW-%';
-- DELETE FROM prod_plan_info             WHERE plan_id       LIKE 'DEMO-PLAN-%';
-- DELETE FROM prod_plan_stage            WHERE stage_id      LIKE 'DEMO-STAGE-%';
-- DELETE FROM prod_task_info             WHERE task_id       LIKE 'DEMO-TASK-%';
-- DELETE FROM prod_task_record           WHERE record_id     LIKE 'DEMO-TREC-%';
-- DELETE FROM prod_task_template         WHERE template_id   LIKE 'DEMO-TPL-%';
-- DELETE FROM prod_growth_record         WHERE record_id     LIKE 'DEMO-GROW-%';
-- DELETE FROM prod_alert_rule            WHERE rule_id       LIKE 'DEMO-RULE-%';
-- DELETE FROM prod_alert_info            WHERE alert_id      LIKE 'DEMO-ALERT-%';
-- DELETE FROM prod_iot_device            WHERE device_id     LIKE 'DEMO-DEV-%';
-- DELETE FROM prod_iot_binding           WHERE binding_id    LIKE 'DEMO-BIND-%';
-- DELETE FROM prod_iot_reading           WHERE reading_id    LIKE 'DEMO-READ-%';
-- DELETE FROM prod_iot_command           WHERE command_id    LIKE 'DEMO-CMD-%';
-- DELETE FROM prod_iot_maintenance       WHERE maintain_id   LIKE 'DEMO-MAIN-%';
-- DELETE FROM prod_harvest_batch         WHERE batch_id      LIKE 'DEMO-BATCH-%';
-- DELETE FROM prod_harvest_record        WHERE record_id     LIKE 'DEMO-HARV-%';
-- DELETE FROM prod_inventory_flow        WHERE flow_id       LIKE 'DEMO-INV-%';
-- DELETE FROM prod_inspection            WHERE inspection_id LIKE 'DEMO-INSP-%';
-- DELETE FROM prod_quality_lab           WHERE lab_id        LIKE 'DEMO-LAB-%';
-- DELETE FROM prod_trace_code            WHERE batch_no      LIKE 'DEMO-BATCH-%' OR code LIKE 'DEMO-TC-%';
-- DELETE FROM prod_blockchain_record     WHERE record_id     LIKE 'DEMO-CHAIN-%';
-- DELETE FROM prod_member                WHERE member_id     LIKE 'DEMO-MEM-%';
-- DELETE FROM prod_message_notify        WHERE message_id    LIKE 'DEMO-MSG-%';
-- DELETE FROM prod_sys_setting           WHERE setting_id    LIKE 'DEMO-SET-%';
-- DELETE FROM prod_analytics_snapshot    WHERE snapshot_id   LIKE 'DEMO-SNAP-%';
-- DELETE FROM prod_ai_diagnosis          WHERE diagnosis_id  LIKE 'DEMO-AI-%';
-- DELETE FROM prod_tenant_quota          WHERE quota_id      LIKE 'DEMO-QUOTA-%';
-- DELETE FROM prod_approval              WHERE approval_id   LIKE 'DEMO-APR-%';
-- DELETE FROM prod_sop_library           WHERE sop_id        LIKE 'DEMO-SOP-%';
-- DELETE FROM prod_report_task           WHERE report_id     LIKE 'DEMO-RPT-%';
-- DELETE FROM prod_knowledge_article     WHERE article_id    LIKE 'DEMO-ART-%';
--
-- =====================================================================================
-- 演示数据灌入完成。
-- =====================================================================================
