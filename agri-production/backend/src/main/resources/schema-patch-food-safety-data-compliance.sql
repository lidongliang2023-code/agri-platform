-- 补丁：食品安全-合规抽查的演示数据（P17 三个 Tab；可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-food-safety-data-compliance.sql
--
-- 内容由平台库 agri_core 的演示行**机械转换**而来（这是页面上本来就看得见的那一份数据）：
--   投入品合规 16 / 标签合规 12 / 标准库 5 / 校验项明细 40 / 校验汇总 5。
-- 只改两处：farm_id 由 DEMO-FARM-xxx 映射成本库农场数字 id；tenant_id 统一 2001（本服务租户口径）。
-- 为什么不整段照抄：平台表有 market_id，本服务没有这个维度（一主体一租户）；
-- 为什么机械转换而不是手抄：78 行里有 ≤ / ·/㎡ / 顿号分隔的中文，手抄必错，且错了很难被发现。
--
-- ⚠️ 校验项明细里 2026-09 那 20 行是**上期**数据（monitoring 子域的「当期/上期」环比要用），
--    不是脏数据，清理演示环境时不要按时间删。

INSERT IGNORE INTO agri_prod_fs_input_compliance
    (record_id, tenant_id, farm_id, farm_name, input_name, input_type, dosage, check_result, violation, check_date, punish_action, punish_amount, punish_remark, punish_time, create_time, update_time, deleted)
VALUES
    ('DEMO-FS-INP-001', '2001', '1', '【演示】华南绿色蔬菜示范农场', '尿素', '氮肥', '20kg/亩', 'pass', NULL, '2026-10-10', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-002', '2001', '2', '【演示】华东智慧稻田农场', '复合肥', '氮肥', '35kg/亩', 'over', '超量施用：限量 25kg/亩，实测 35kg/亩；【已处罚：罚款并暂停供货，罚款 3000 元】', '2026-10-10', '罚款并暂停供货', 3000.00, '限期 10 日内完成施肥方案整改并提交复核', '2026-10-10 21:45:07', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-003', '2001', '3', '【演示】鲁中设施果蔬农场', '磷酸二氢钾', '磷肥', '8kg/亩', 'pass', NULL, '2026-10-09', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-004', '2001', '4', '【演示】西北高原生态牧场', '氯化钾', '钾肥', '12kg/亩', 'pass', NULL, '2026-10-09', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-005', '2001', '5', '【演示】江汉稻渔综合种养农场', '草甘膦', '除草', '300ml/亩', 'over', '超出登记用量且临近采收期使用', '2026-10-09', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-006', '2001', '6', '【演示】滇中花卉种苗基地', '多菌灵', '杀菌剂', '80g/亩', 'pass', NULL, '2026-10-08', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-007', '2001', '1', '【演示】华南绿色蔬菜示范农场', '有机肥', '有机肥', '500kg/亩', 'pass', NULL, '2026-10-08', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-008', '2001', '2', '【演示】华东智慧稻田农场', '吡虫啉', '农药', '40g/亩', 'pass', NULL, '2026-10-07', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-009', '2001', '3', '【演示】鲁中设施果蔬农场', '乙烯利', '调节剂', '25ml/亩', 'over', '未在登记作物范围内使用', '2026-10-07', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-010', '2001', '4', '【演示】西北高原生态牧场', '过磷酸钙', '磷肥', '30kg/亩', 'pass', NULL, '2026-10-06', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-011', '2001', '5', '【演示】江汉稻渔综合种养农场', '硫酸钾', '钾肥', '15kg/亩', 'pass', NULL, '2026-10-06', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-012', '2001', '6', '【演示】滇中花卉种苗基地', '百菌清', '杀菌剂', '120g/亩', 'over', '超出安全间隔期要求', '2026-10-05', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-013', '2001', '1', '【演示】华南绿色蔬菜示范农场', '生物有机肥', '有机肥', '400kg/亩', 'pass', NULL, '2026-10-04', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-014', '2001', '2', '【演示】华东智慧稻田农场', '阿维菌素', '农药', '20ml/亩', 'pass', NULL, '2026-10-03', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-015', '2001', '3', '【演示】鲁中设施果蔬农场', '硝基复合肥', '氮肥', '45kg/亩', 'over', '超量施用：限量 30kg/亩，实测 45kg/亩', '2026-10-03', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-INP-016', '2001', '4', '【演示】西北高原生态牧场', '腐殖酸肥', '有机肥', '200kg/亩', 'pass', NULL, '2026-10-02', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

INSERT IGNORE INTO agri_prod_fs_label_compliance
    (label_id, tenant_id, product_name, producer, label_version, required_fields, filled_fields, missing_fields, marking_result, marking_note, check_result, checked_at, rectify_status, rectify_deadline, rectify_remark, rectify_time, create_time, update_time, deleted)
VALUES
    ('DEMO-FS-LBL-001', '2001', '有机番茄', '【演示】华南绿色蔬菜示范农场', 'V2.1', 10, 10, NULL, 'compliant', '标识齐全', 'pass', '2026-10-10 09:30:00', 'none', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-LBL-002', '2001', '精品黄瓜', '【演示】华东智慧稻田农场', 'V1.4', 10, 8, '贮存条件、追溯码', 'compliant', '标识齐全', 'fail', '2026-10-10 09:35:00', 'notified', '2026-11-20 前完成标签改版并提交复审', '补齐贮存条件与追溯码后方可继续上架', '2026-10-10 21:45:15', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-LBL-003', '2001', '绿色辣椒', '【演示】鲁中设施果蔬农场', 'V2.0', 10, 10, NULL, 'violation', '标注有机认证但证书已过期', 'fail', '2026-10-10 09:40:00', 'notified', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-LBL-004', '2001', '高原稻谷', '【演示】西北高原生态牧场', 'V1.1', 10, 10, NULL, 'compliant', '标识齐全', 'pass', '2026-10-09 15:10:00', 'none', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-LBL-005', '2001', '稻渔香米', '【演示】江汉稻渔综合种养农场', 'V3.0', 10, 7, '净含量、生产日期、执行标准号', 'compliant', '标识齐全', 'fail', '2026-10-09 15:15:00', 'notified', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-LBL-006', '2001', '鲜切花苗', '【演示】滇中花卉种苗基地', 'V1.0', 10, 10, NULL, 'violation', '标注绿色认证但未提供认证编号', 'fail', '2026-10-08 16:20:00', 'done', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-LBL-007', '2001', '小番茄', '【演示】华南绿色蔬菜示范农场', 'V2.1', 10, 10, NULL, 'compliant', '标识齐全', 'pass', '2026-10-08 16:25:00', 'none', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-LBL-008', '2001', '温室黄瓜', '【演示】华东智慧稻田农场', 'V1.4', 10, 9, '追溯码', 'compliant', '标识齐全', 'fail', '2026-10-07 10:05:00', 'done', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-LBL-009', '2001', '螺丝椒', '【演示】鲁中设施果蔬农场', 'V2.0', 10, 10, NULL, 'compliant', '标识齐全', 'pass', '2026-10-07 10:10:00', 'none', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-LBL-010', '2001', '生态稻米', '【演示】西北高原生态牧场', 'V1.1', 10, 10, NULL, 'violation', '标注无公害认证但证书编号为空', 'fail', '2026-10-05 14:40:00', 'done', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-LBL-011', '2001', '稻渔米', '【演示】江汉稻渔综合种养农场', 'V3.0', 10, 10, NULL, 'compliant', '标识齐全', 'pass', '2026-10-05 14:45:00', 'none', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-LBL-012', '2001', '种苗礼盒', '【演示】滇中花卉种苗基地', 'V1.0', 10, 8, '生产者地址、保质期', 'compliant', '标识齐全', 'fail', '2026-10-04 11:30:00', 'done', NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

INSERT IGNORE INTO agri_prod_fs_standard_library
    (standard_no, tenant_id, standard_name, issuer, status, sort_no, create_time, update_time, deleted)
VALUES
    ('GB2762-2022', '2001', 'GB 2762-2022 食品中污染物限量', '国家卫生健康委员会', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('GB2763-2021', '2001', 'GB 2763-2021 食品中农药最大残留限量', '国家卫生健康委员会', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('GB7718-2011', '2001', 'GB 7718-2011 预包装食品标签通则', '国家卫生健康委员会', 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('NYT391-2021', '2001', 'NY/T 391-2021 绿色食品 产地环境质量', '农业农村部', 1, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('GBT19630-2019', '2001', 'GB/T 19630-2019 有机产品', '国家市场监督管理总局', 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

INSERT IGNORE INTO agri_prod_fs_standard_item
    (item_id, tenant_id, standard_no, item_name, limit_value, measured_value, check_result, batch_no, check_time, create_time, update_time, deleted)
VALUES
    ('DEMO-FS-ITM-001', '2001', 'GB2762-2022', '铅（以 Pb 计）', '≤ 0.2 mg/kg', '0.08 mg/kg', 'pass', 'DEMO-BATCH-001', '2026-10-09 10:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-002', '2001', 'GB2762-2022', '镉（以 Cd 计）', '≤ 0.05 mg/kg', '0.03 mg/kg', 'pass', 'DEMO-BATCH-001', '2026-10-09 10:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-003', '2001', 'GB2762-2022', '总砷（以 As 计）', '≤ 0.5 mg/kg', '0.61 mg/kg', 'fail', 'DEMO-BATCH-002', '2026-10-09 10:05:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-004', '2001', 'GB2762-2022', '汞（以 Hg 计）', '≤ 0.01 mg/kg', '0.004 mg/kg', 'pass', 'DEMO-BATCH-002', '2026-10-09 10:05:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-005', '2001', 'GB2763-2021', '毒死蜱', '≤ 0.02 mg/kg', '0.008 mg/kg', 'pass', 'DEMO-BATCH-003', '2026-10-08 11:20:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-006', '2001', 'GB2763-2021', '吡虫啉', '≤ 0.5 mg/kg', '0.31 mg/kg', 'pass', 'DEMO-BATCH-003', '2026-10-08 11:20:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-007', '2001', 'GB2763-2021', '草甘膦', '≤ 0.1 mg/kg', '0.14 mg/kg', 'fail', 'DEMO-BATCH-004', '2026-10-08 11:25:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-008', '2001', 'GB2763-2021', '多菌灵', '≤ 3.0 mg/kg', '1.20 mg/kg', 'pass', 'DEMO-BATCH-004', '2026-10-08 11:25:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-009', '2001', 'GB7718-2011', '生产日期标注', '符合 GB 7718 要求', '标注规范', 'pass', 'DEMO-BATCH-005', '2026-10-07 09:40:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-010', '2001', 'GB7718-2011', '净含量标注', '符合 GB 7718 要求', '标注规范', 'pass', 'DEMO-BATCH-005', '2026-10-07 09:40:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-011', '2001', 'GB7718-2011', '配料表标注', '符合 GB 7718 要求', '缺失配料表', 'fail', 'DEMO-BATCH-001', '2026-10-07 09:45:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-012', '2001', 'GB7718-2011', '贮存条件标注', '符合 GB 7718 要求', '标注规范', 'pass', 'DEMO-BATCH-001', '2026-10-07 09:45:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-013', '2001', 'NYT391-2021', '土壤 pH 值', '6.0 ~ 7.5', '6.8', 'pass', 'DEMO-BATCH-002', '2026-10-06 14:10:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-014', '2001', 'NYT391-2021', '灌溉水总汞', '≤ 0.001 mg/L', '0.0006 mg/L', 'pass', 'DEMO-BATCH-002', '2026-10-06 14:10:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-015', '2001', 'NYT391-2021', '土壤镉含量', '≤ 0.30 mg/kg', '0.28 mg/kg', 'pass', 'DEMO-BATCH-003', '2026-10-06 14:15:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-016', '2001', 'NYT391-2021', '空气质量总悬浮物', '≤ 0.30 mg/m³', '0.27 mg/m³', 'pass', 'DEMO-BATCH-003', '2026-10-06 14:15:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-017', '2001', 'GBT19630-2019', '有机转换期', '≥ 24 个月', '已满 36 个月', 'pass', 'DEMO-BATCH-004', '2026-10-05 15:30:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-018', '2001', 'GBT19630-2019', '禁用物质检测', '不得检出', '未检出', 'pass', 'DEMO-BATCH-004', '2026-10-05 15:30:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-019', '2001', 'GBT19630-2019', '投入品清单完整性', '齐全', '缺少种子来源记录', 'fail', 'DEMO-BATCH-005', '2026-10-05 15:35:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-020', '2001', 'GBT19630-2019', '缓冲带设置', '≥ 8 米', '10 米', 'pass', 'DEMO-BATCH-005', '2026-10-05 15:35:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-101', '2001', 'GB2762-2022', '铅（以 Pb 计）', '≤ 0.2 mg/kg', '0.11 mg/kg', 'pass', 'DEMO-BATCH-001', '2026-09-09 10:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-102', '2001', 'GB2762-2022', '镉（以 Cd 计）', '≤ 0.05 mg/kg', '0.06 mg/kg', 'fail', 'DEMO-BATCH-001', '2026-09-09 10:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-103', '2001', 'GB2762-2022', '总砷（以 As 计）', '≤ 0.5 mg/kg', '0.44 mg/kg', 'pass', 'DEMO-BATCH-002', '2026-09-09 10:05:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-104', '2001', 'GB2762-2022', '汞（以 Hg 计）', '≤ 0.01 mg/kg', '0.005 mg/kg', 'pass', 'DEMO-BATCH-002', '2026-09-09 10:05:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-105', '2001', 'GB2763-2021', '毒死蜱', '≤ 0.02 mg/kg', '0.026 mg/kg', 'fail', 'DEMO-BATCH-003', '2026-09-08 11:20:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-106', '2001', 'GB2763-2021', '吡虫啉', '≤ 0.5 mg/kg', '0.42 mg/kg', 'pass', 'DEMO-BATCH-003', '2026-09-08 11:20:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-107', '2001', 'GB2763-2021', '草甘膦', '≤ 0.1 mg/kg', '0.07 mg/kg', 'pass', 'DEMO-BATCH-004', '2026-09-08 11:25:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-108', '2001', 'GB2763-2021', '多菌灵', '≤ 3.0 mg/kg', '3.40 mg/kg', 'fail', 'DEMO-BATCH-004', '2026-09-08 11:25:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-109', '2001', 'GB7718-2011', '生产日期标注', '符合 GB 7718 要求', '标注规范', 'pass', 'DEMO-BATCH-005', '2026-09-07 09:40:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-110', '2001', 'GB7718-2011', '净含量标注', '符合 GB 7718 要求', '标注规范', 'pass', 'DEMO-BATCH-005', '2026-09-07 09:40:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-111', '2001', 'GB7718-2011', '配料表标注', '符合 GB 7718 要求', '标注规范', 'pass', 'DEMO-BATCH-001', '2026-09-07 09:45:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-112', '2001', 'GB7718-2011', '贮存条件标注', '符合 GB 7718 要求', '缺失贮存条件', 'fail', 'DEMO-BATCH-001', '2026-09-07 09:45:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-113', '2001', 'NYT391-2021', '土壤 pH 值', '6.0 ~ 7.5', '5.6', 'fail', 'DEMO-BATCH-002', '2026-09-06 14:10:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-114', '2001', 'NYT391-2021', '灌溉水总汞', '≤ 0.001 mg/L', '0.0008 mg/L', 'pass', 'DEMO-BATCH-002', '2026-09-06 14:10:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-115', '2001', 'NYT391-2021', '土壤镉含量', '≤ 0.30 mg/kg', '0.33 mg/kg', 'fail', 'DEMO-BATCH-003', '2026-09-06 14:15:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-116', '2001', 'NYT391-2021', '空气质量总悬浮物', '≤ 0.30 mg/m³', '0.22 mg/m³', 'pass', 'DEMO-BATCH-003', '2026-09-06 14:15:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-117', '2001', 'GBT19630-2019', '有机转换期', '≥ 24 个月', '已满 30 个月', 'pass', 'DEMO-BATCH-004', '2026-09-05 15:30:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-118', '2001', 'GBT19630-2019', '禁用物质检测', '不得检出', '检出微量禁用物质', 'fail', 'DEMO-BATCH-004', '2026-09-05 15:30:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-119', '2001', 'GBT19630-2019', '投入品清单完整性', '齐全', '齐全', 'pass', 'DEMO-BATCH-005', '2026-09-05 15:35:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-ITM-120', '2001', 'GBT19630-2019', '缓冲带设置', '≥ 8 米', '6 米', 'fail', 'DEMO-BATCH-005', '2026-09-05 15:35:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

INSERT IGNORE INTO agri_prod_fs_standard_summary
    (summary_id, tenant_id, standard_no, batch_count, pass_count, fail_count, pass_rate, last_run_time, create_time, update_time, deleted)
VALUES
    ('DEMO-FS-SUM-001', '2001', 'GB2762-2022', 2, 1, 1, 50.0, '2026-10-10 21:45:25', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-SUM-002', '2001', 'GB2763-2021', 280, 254, 26, 90.7, '2026-10-08 11:30:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-SUM-003', '2001', 'GB7718-2011', 210, 196, 14, 93.3, '2026-10-07 09:50:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-SUM-005', '2001', 'GBT19630-2019', 190, 175, 15, 92.1, '2026-10-05 15:40:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-SUM-004', '2001', 'NYT391-2021', 240, 224, 16, 93.3, '2026-10-06 14:20:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);
