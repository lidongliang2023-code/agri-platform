-- 补丁：食品安全-冷链资源撮合（P19）的演示数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-food-safety-data-cold-chain.sql
--
-- 内容由平台库 agri_core 的演示行机械转换而来（资源 12 条、撮合 10 条；去 market_id、tenant_id 统一 2001）。
-- ⚠️ 撮合记录里有 2 条是**平台侧联调时真的点出来的**（FS-CCM-20261010215631xxx），一并搬过来：
--    它们是"立即撮合 → 资源转 busy"与"繁忙资源入队"两条写链路的真实产物，
--    删掉的话 P19 页面上就没有 queued 状态的样本了。

INSERT IGNORE INTO agri_prod_fs_cold_chain_resource
    (resource_id, tenant_id, resource_name, resource_type, type_label, spec, temp_range, city, district, resource_status, rating, contact_name, contact_phone, last_maintain_date, create_time, update_time, deleted)
VALUES
    ('DEMO-FS-CCR-001', '2001', '粤A·8F231', 'vehicle', '冷链车', '20吨', '-18°C ~ 5°C', '广州市', '白云区', 'busy', 4.8, '陈志强', '13800001101', '2026-08-15', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCR-002', '2001', '粤A·6K908', 'vehicle', '冷链车', '15吨', '-18°C ~ 0°C', '广州市', '番禺区', 'busy', 4.6, '李伟明', '13800001102', '2026-07-28', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCR-003', '2001', '沪B·2D457', 'vehicle', '冷链车', '10吨', '0°C ~ 8°C', '上海市', '青浦区', 'idle', 4.9, '王建国', '13800001103', '2026-09-02', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCR-004', '2001', '苏C·5T112', 'vehicle', '冷链车', '30吨', '-25°C ~ 5°C', '南京市', '江宁区', 'busy', 4.3, '赵晓东', '13800001104', '2026-06-20', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCR-005', '2001', '云A·9H663', 'vehicle', '冷链车', '8吨', '-18°C ~ 5°C', '昆明市', '呈贡区', 'idle', 4.7, '杨春林', '13800001105', '2026-08-30', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCR-006', '2001', '粤A·3L889', 'vehicle', '冷链车', '12吨', '-18°C ~ 0°C', '广州市', '增城区', 'offline', 4.1, '刘海涛', '13800001106', '2026-05-12', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCR-007', '2001', '华南中心冷库A区', 'warehouse', '冷库', '5000m²', '-18°C ~ 5°C', '广州市', '白云区', 'idle', 4.9, '周慧敏', '13800001107', '2026-09-10', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCR-008', '2001', '华南中心冷库B区', 'warehouse', '冷库', '3200m²', '0°C ~ 10°C', '广州市', '白云区', 'busy', 4.7, '周慧敏', '13800001107', '2026-09-10', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCR-009', '2001', '华东智慧冷库', 'warehouse', '冷库', '8000m²', '-25°C ~ 5°C', '上海市', '青浦区', 'idle', 4.8, '孙丽华', '13800001108', '2026-08-22', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCR-010', '2001', '鲁中气调库', 'warehouse', '冷库', '2600m²', '0°C ~ 5°C', '济南市', '历城区', 'busy', 4.4, '马国庆', '13800001109', '2026-07-15', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCR-011', '2001', '滇中花卉冷库', 'warehouse', '冷库', '1800m²', '2°C ~ 8°C', '昆明市', '呈贡区', 'idle', 4.6, '杨春林', '13800001105', '2026-08-08', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCR-012', '2001', '江汉稻米冷库', 'warehouse', '冷库', '4000m²', '0°C ~ 15°C', '武汉市', '江夏区', 'offline', 4.0, '吴志远', '13800001110', '2026-04-26', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

INSERT IGNORE INTO agri_prod_fs_cold_chain_match
    (match_id, tenant_id, resource_id, supplier_name, resource_type_label, demander, cargo, temp_require, start_time, expect_time, match_time, match_status, remark, create_time, update_time, deleted)
VALUES
    ('DEMO-FS-CCM-001', '2001', 'DEMO-FS-CCR-002', '粤A·6K908', '冷链车', '【演示】华南绿色蔬菜示范农场', '有机番茄冷链配送', '-18°C ~ 0°C', '2026-10-10', NULL, '2026-10-10 08:30:00', 'processing', '早班发车', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCM-002', '2001', 'DEMO-FS-CCR-004', '苏C·5T112', '冷链车', '【演示】鲁中设施果蔬农场', '绿色辣椒冷藏运输', '-25°C ~ 5°C', '2026-10-09', NULL, '2026-10-09 14:10:00', 'done', '已完成交付', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCM-003', '2001', 'DEMO-FS-CCR-008', '华南中心冷库B区', '冷库', '【演示】华南绿色蔬菜示范农场', '净菜暂存', '0°C ~ 10°C', '2026-10-09', NULL, '2026-10-09 10:05:00', 'processing', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCM-004', '2001', 'DEMO-FS-CCR-010', '鲁中气调库', '冷库', '【演示】鲁中设施果蔬农场', '果蔬气调贮存', '0°C ~ 5°C', '2026-10-08', NULL, '2026-10-08 16:20:00', 'done', '已入库', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCM-005', '2001', 'DEMO-FS-CCR-001', '粤A·8F231', '冷链车', '【演示】江汉稻渔综合种养农场', '稻渔香米配送', '-18°C ~ 5°C', '2026-10-12', NULL, '2026-10-08 09:15:00', 'queued', '资源排期待释放', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCM-006', '2001', 'DEMO-FS-CCR-009', '华东智慧冷库', '冷库', '【演示】华东智慧稻田农场', '生态稻米贮存', '-25°C ~ 5°C', '2026-10-11', NULL, '2026-10-07 15:40:00', 'queued', '等待库位释放', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCM-007', '2001', 'DEMO-FS-CCR-005', '云A·9H663', '冷链车', '【演示】滇中花卉种苗基地', '鲜切花苗冷链运输', '-18°C ~ 5°C', '2026-10-07', NULL, '2026-10-07 07:50:00', 'done', '已完成交付', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-FS-CCM-008', '2001', 'DEMO-FS-CCR-011', '滇中花卉冷库', '冷库', '【演示】滇中花卉种苗基地', '花苗预冷', '2°C ~ 8°C', '2026-10-06', NULL, '2026-10-06 11:30:00', 'done', '已完成预冷', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('FS-CCM-20261010215631066', '2001', 'DEMO-FS-CCR-001', '粤A·8F231', '冷链车', '【演示】华南绿色蔬菜示范农场', '有机番茄冷链配送', '-18°C ~ 5°C', '2026-10-12', NULL, '2026-10-10 21:56:31', 'processing', '周末早班发车', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('FS-CCM-20261010215631166', '2001', 'DEMO-FS-CCR-002', '粤A·6K908', '冷链车', '【演示】鲁中设施果蔬农场', NULL, NULL, NULL, '2026-10-15', '2026-10-10 21:56:31', 'queued', '等待该车返程', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);
