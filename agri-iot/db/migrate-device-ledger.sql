-- ============================================================================
-- 设备台账收敛迁移（一次性，可重复执行）
--
-- 背景：此前存在三套互不重叠的设备台账
--   · agri_iot.iot_device              16 台（物联网端，活的）
--   · agri_production.agri_prod_iot_device  13 台（生产端，自成一套）
--   · agri_core.prod_iot_device        50 台（历史遗留）
-- 生产端的设备列表/详情已改为直连物联网端，设备本体以 iot_device 为唯一来源，
-- 生产端只保留「绑定关系」（agri_prod_iot_binding）。
--
-- 本脚本做四件事：
--   1. 补 3 个物联网端缺失的设备类型（虫情测报灯 / 水位监测仪 / 氨气监测仪）
--   2. 把生产端 13 台设备注册进 iot_device（id 17~29，device_code 原样保留）
--   3. 把 iot_device.plot_id 归一化为生产地块主键（原值是已删除的 iot_plot 主键）
--   4. 把绑定记录的 device_id 从生产端本地主键（198~207）重映射到 iot_device 新主键
--
-- 执行前请先备份：
--   mysqldump -uroot -p agri_iot iot_device iot_device_type iot_plot > iot_device.sql
--   mysqldump -uroot -p agri_production agri_prod_iot_device agri_prod_iot_binding > prod_iot.sql
-- ============================================================================

USE agri_iot;

-- ---------------------------------------------------------------------------
-- 1. 补齐设备类型（生产端用自由文本写类型，物联网类型目录里没有对应项）
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO iot_device_type
    (id, type_name, category_name, protocol_name, icon_text, manufacturer, model_name, property_text, status)
VALUES
    (13, '虫情测报灯', '环境传感器', '4G', '🐛', '佳多科工', 'PS-15', 'pest_count', 'active'),
    (14, '水位监测仪', '环境传感器', 'LoRaWAN', '🌊', '鑫源物联', 'WL-100', 'water_level', 'active'),
    (15, '氨气监测仪', '环境传感器', 'LoRaWAN', '🧫', '芯农电子', 'GS-110', 'ammonia', 'active');

-- ---------------------------------------------------------------------------
-- 2. 生产端 13 台设备注册进物联网端
--    plot_id 已经是生产地块主键；farms 3~6 没有对应网关，gateway_id 留空
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO iot_device
    (id, tenant_id, farm_id, plot_id, gateway_id, group_id, device_code, device_name,
     type_id, type_name, protocol_name, online_status, status_text, last_report,
     signal_strength, battery_rate, firmware_version, latitude, longitude,
     control_capable, config_text, created_at)
VALUES
    (17, 2001, 1, 1,   1,    2, 'DEV001',        '一号大棚温湿度传感器', 1,  '空气温湿度传感器', 'MQTT',     'online',  'normal', '20秒前',   -55,  92,   'v1.2.3', NULL, NULL, FALSE, '{"model":"TH-100","vendor":"农芯科技","ip":"192.168.1.21","interval":60}',  '2026-02-11'),
    (18, 2001, 1, 2,   1,    2, 'DEV002',        '二号大棚土壤墒情仪',   2,  '土壤墒情传感器',   'MQTT',     'online',  'normal', '45秒前',   -61,  78,   'v1.1.8', NULL, NULL, FALSE, '{"model":"SM-200","vendor":"农芯科技","ip":"192.168.1.22","interval":60}',  '2026-02-11'),
    (19, 2001, 2, 3,   4,    2, 'DEV003',        '气象站（离线备用）',   10, '小型气象站',       'HTTP',     'offline', 'normal', '3天前',    NULL, NULL, 'v2.0.1', NULL, NULL, FALSE, '{"model":"WS-500","vendor":"云耕智能","ip":"192.168.1.30","interval":60}',  '2026-02-11'),
    (20, 2001, 1, 238, 1,    2, 'DEMO-DEVC-001', 'A区土壤墒情站',        2,  '土壤墒情传感器',   'LoRaWAN',  'online',  'normal', '30秒前',   NULL, 86,   'v2.4.1', NULL, NULL, FALSE, '{"model":"HW-SM200","vendor":"华维传感","interval":60}',                     '2026-03-02'),
    (21, 2001, 1, 238, 1,    2, 'DEMO-DEVC-002', 'A区环境监测站',        1,  '空气温湿度传感器', 'MQTT',     'online',  'normal', '15秒前',   NULL, 90,   'v2.4.1', NULL, NULL, FALSE, '{"model":"HW-TH500","vendor":"华维传感","interval":60}',                     '2026-03-02'),
    (22, 2001, 1, 239, 1,    2, 'DEMO-DEVC-003', 'B区虫情测报灯',        13, '虫情测报灯',       '4G',       'online',  'normal', '5分钟前',  NULL, 64,   'v1.8.0', NULL, NULL, FALSE, '{"model":"JD-PS15","vendor":"佳多科工","interval":60}',                      '2026-03-02'),
    (23, 2001, 2, 243, 4,    2, 'DEMO-DEVC-004', '稻田水位监测站',       14, '水位监测仪',       'LoRaWAN',  'online',  'normal', '40秒前',   NULL, 72,   'v3.0.2', NULL, NULL, FALSE, '{"model":"XY-WL100","vendor":"鑫源物联","interval":60}',                     '2026-03-02'),
    (24, 2001, 3, 247, NULL, 2, 'DEMO-DEVC-005', '1号温室环境监控',      1,  '空气温湿度传感器', 'MQTT',     'online',  'normal', '12秒前',   NULL, 88,   'v2.1.7', NULL, NULL, FALSE, '{"model":"LY-GH300","vendor":"鲁仪物联网","interval":60}',                   '2026-03-02'),
    (25, 2001, 3, 247, NULL, 4, 'DEMO-DEVC-006', '1号温室卷帘控制器',    8,  '卷帘控制器',       'Modbus',   'offline', 'normal', '1天前',    NULL, 55,   'v1.5.3', NULL, NULL, TRUE,  '{"model":"LY-CT220","vendor":"鲁仪物联网","interval":60}',                   '2026-03-02'),
    (26, 2001, 4, 253, NULL, 2, 'DEMO-DEVC-007', '牧草区土壤氮素站',     2,  '土壤墒情传感器',   'LoRaWAN',  'online',  'normal', '50秒前',   NULL, 70,   'v1.2.9', NULL, NULL, FALSE, '{"model":"XN-NP200","vendor":"芯农电子","interval":60}',                     '2026-03-02'),
    (27, 2001, 4, 255, NULL, 2, 'DEMO-DEVC-008', '舍饲区氨气监测仪',     15, '氨气监测仪',       'LoRaWAN',  'offline', 'normal', '8小时前',  NULL, 31,   'v1.2.9', NULL, NULL, FALSE, '{"model":"XN-GS110","vendor":"芯农电子","interval":60}',                     '2026-03-02'),
    (28, 2001, 5, 256, NULL, 2, 'DEMO-DEVC-009', '稻渔区水质监测浮标',   11, '水质监测仪',       'NB-IoT',   'online',  'normal', '35秒前',   NULL, 66,   'v4.0.0', NULL, NULL, FALSE, '{"model":"MC-WQ600","vendor":"淼测科技","interval":60}',                     '2026-03-02'),
    (29, 2001, 6, 260, NULL, 5, 'DEMO-DEVC-010', '花卉A棚摄像头',        9,  '高清球机摄像头',   'GB28181',  'offline', 'normal', '12小时前', NULL, NULL, 'v2.9.4', NULL, NULL, TRUE,  '{"model":"HS-IP712","vendor":"海视云","interval":60}',                       '2026-03-02');

-- ---------------------------------------------------------------------------
-- 3. iot_device.plot_id 归一化为生产地块主键
--    1~16 号设备的 plot_id 原来是 iot_plot 主键（1~6），跟生产地块对不上：
--    生产地块里 1/2/3 是「A区-地块1/2、B区-地块1」，4/5/6 根本不存在。
--    按「同农场 + 名称语义最接近」重新指向，只改这一次，重复执行无副作用。
-- ---------------------------------------------------------------------------
UPDATE iot_device SET plot_id = CASE id
        WHEN 1  THEN 238   -- 1号棚 …    → A区连栋大棚
        WHEN 2  THEN 238
        WHEN 3  THEN 238
        WHEN 4  THEN 238
        WHEN 5  THEN 238
        WHEN 6  THEN 239   -- 2号棚 …    → B区露天菜田
        WHEN 7  THEN 239
        WHEN 8  THEN 239
        WHEN 9  THEN 240   -- 3号田 …    → C区露天菜田
        WHEN 10 THEN 240
        WHEN 11 THEN 241   -- 4号田 …    → D区育苗棚
        WHEN 12 THEN 243   -- 东区 …     → 智慧稻田东片区
        WHEN 13 THEN 243
        WHEN 14 THEN 243
        WHEN 15 THEN 251   -- 养殖塘/粮田 → 露天大田东区
        WHEN 16 THEN 251
    END
WHERE id BETWEEN 1 AND 16
  AND plot_id IS NOT NULL
  AND plot_id <> CASE id
        WHEN 1  THEN 238 WHEN 2  THEN 238 WHEN 3  THEN 238 WHEN 4  THEN 238
        WHEN 5  THEN 238 WHEN 6  THEN 239 WHEN 7  THEN 239 WHEN 8  THEN 239
        WHEN 9  THEN 240 WHEN 10 THEN 240 WHEN 11 THEN 241 WHEN 12 THEN 243
        WHEN 13 THEN 243 WHEN 14 THEN 243 WHEN 15 THEN 251 WHEN 16 THEN 251
    END;

-- ---------------------------------------------------------------------------
-- 4. 绑定记录 device_id 重映射：生产端本地主键 → iot_device 主键
--    按 device_code 对齐（编码是唯一且跨服务稳定的），顺带同步设备名称。
--    这样重复执行也安全，且新产生的绑定（device_id 已经是物联网端 id）不会被误改。
-- ---------------------------------------------------------------------------
--    两个库的排序规则不同（agri_iot 是 utf8mb4_0900_ai_ci，agri_production 是
--    utf8mb4_unicode_ci），跨库 JOIN 必须显式 COLLATE，否则报 Illegal mix of collations。
UPDATE agri_production.agri_prod_iot_binding b
    JOIN iot_device d ON d.device_code COLLATE utf8mb4_unicode_ci = b.device_code
SET b.device_id   = CAST(d.id AS CHAR),
    b.device_name = d.device_name,
    b.farm_id     = d.farm_id
WHERE b.deleted = 0
  AND b.device_code IS NOT NULL
  AND b.device_id <> CAST(d.id AS CHAR) COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4b. 绑定目标标识归一化：平台地块标识（DEMO-PLOT-001）→ 生产地块主键
--     地块表的编码是 DEMO-PLOTC-001（多一个 C），跟 platform_plot_id 才能对上。
--     归一化后「绑定记录里的地块」和「设备 plot_id」是同一套 id，页面不用再猜。
-- ---------------------------------------------------------------------------
UPDATE agri_production.agri_prod_iot_binding b
    JOIN agri_production.agri_prod_plot_info p
        ON p.platform_plot_id = b.bind_target_id AND p.deleted = 0
SET b.bind_target_id = CAST(p.id AS CHAR)
WHERE b.deleted = 0
  AND b.bind_type = 'PLOT'
  AND b.bind_target_id LIKE 'DEMO-PLOT-%';

-- ---------------------------------------------------------------------------
-- 4c. 已解绑的设备不应再挂在地块上
--     只处理「地块绑定已全部解绑」的设备；没有绑定记录的设备（1~16 号，靠
--     plot_id 表达归属）不动 —— 它们本来就不走绑定表。
-- ---------------------------------------------------------------------------
UPDATE iot_device d
SET d.plot_id = NULL
WHERE d.plot_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM agri_production.agri_prod_iot_binding b
              WHERE b.deleted = 0 AND b.bind_type = 'PLOT' AND b.status = 'UNBOUND'
                AND b.device_id COLLATE utf8mb4_unicode_ci = CAST(d.id AS CHAR))
  AND NOT EXISTS (SELECT 1 FROM agri_production.agri_prod_iot_binding b
                  WHERE b.deleted = 0 AND b.bind_type = 'PLOT' AND b.status = 'BOUND'
                    AND b.device_id COLLATE utf8mb4_unicode_ci = CAST(d.id AS CHAR));

-- ---------------------------------------------------------------------------
-- 5. 重算分组/网关的统计列
--    种子数据里这两个数是演示用的虚数（「全部设备」写着 428 台，实际只有 16 台），
--    收敛后必须按真实台账重算，否则列表页的分组徽标和台账对不上。
-- ---------------------------------------------------------------------------
UPDATE iot_device_group g
SET device_count = (SELECT COUNT(*) FROM iot_device d WHERE d.group_id = g.id)
WHERE g.id <> 1;

-- 「全部设备」是聚合分组，不是真实归属，按全量计
UPDATE iot_device_group g
SET device_count = (SELECT COUNT(*) FROM iot_device)
WHERE g.id = 1;

UPDATE iot_gateway w
SET total_count = (SELECT COUNT(*) FROM iot_device d WHERE d.gateway_id = w.id);

-- ---------------------------------------------------------------------------
-- 6. iot_plot 彻底下线（已被 plots() 的生产地块接口取代，代码里已无任何读取）
--    确认备份后再取消注释执行：
-- DROP TABLE IF EXISTS iot_plot;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 6. 体检
-- ---------------------------------------------------------------------------
SELECT '① 设备总数（按来源）' AS check_item;
SELECT CASE WHEN id <= 16 THEN '物联网端原有' ELSE '生产端收敛' END AS source,
       COUNT(*) AS device_count
FROM iot_device GROUP BY source;

SELECT '② 类型分布' AS check_item;
SELECT t.id, t.type_name, COUNT(d.id) AS device_count
FROM iot_device_type t LEFT JOIN iot_device d ON d.type_id = t.id
GROUP BY t.id, t.type_name ORDER BY t.id;

SELECT '③ plot_id 是否存在悬空（应为 0）' AS check_item;
SELECT COUNT(*) AS dangling_plot_id
FROM iot_device d
WHERE d.plot_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM agri_production.agri_prod_plot_info p
                  WHERE p.id = d.plot_id AND p.deleted = 0);

SELECT '④ 绑定是否仍有悬空设备（应为 0）' AS check_item;
SELECT COUNT(*) AS dangling_binding
FROM agri_production.agri_prod_iot_binding b
WHERE b.deleted = 0
  AND NOT EXISTS (SELECT 1 FROM iot_device d
                  WHERE CAST(d.id AS CHAR) COLLATE utf8mb4_unicode_ci = b.device_id);

SELECT '⑤ 绑定与设备对齐情况' AS check_item;
SELECT b.binding_id, b.device_id, b.device_code, b.device_name, d.id AS iot_device_id,
       d.device_name AS iot_device_name, b.bind_type, b.bind_target_name, b.status
FROM agri_production.agri_prod_iot_binding b
LEFT JOIN iot_device d ON CAST(d.id AS CHAR) COLLATE utf8mb4_unicode_ci = b.device_id
WHERE b.deleted = 0 ORDER BY b.id;
