-- 物联网模块 MySQL 幂等迁移。
--
-- 为什么需要这个文件：schema-iot-app.sql 用的是 CREATE TABLE IF NOT EXISTS，
-- 已经存在的表不会被它改结构；而本模块这一轮把「租户主键」从遗留自增号
-- （iot_tenant.id = 1..4）统一成平台经营主体号（agri_core.platform_merchant.id，演示数据 2001/2003）。
-- 不迁移就会一直留着两套编号：设备表写 2001、告警表写 1，运营端设备列表 29 台里
-- 0 台能 join 出租户名。这里每条语句都可重复执行。

SET @db := DATABASE();

-- ========== 1. 补私域租户列 ==========
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_device_group' AND COLUMN_NAME='tenant_id')=0,
  'ALTER TABLE iot_device_group ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 2001', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_scene' AND COLUMN_NAME='tenant_id')=0,
  'ALTER TABLE iot_scene ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 2001', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_rule' AND COLUMN_NAME='tenant_id')=0,
  'ALTER TABLE iot_rule ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 2001', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_work_order' AND COLUMN_NAME='tenant_id')=0,
  'ALTER TABLE iot_work_order ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 2001', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_message' AND COLUMN_NAME='tenant_id')=0,
  'ALTER TABLE iot_message ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 2001', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_ota_task' AND COLUMN_NAME='tenant_id')=0,
  'ALTER TABLE iot_ota_task ADD COLUMN tenant_id BIGINT NOT NULL DEFAULT 2001', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 运维审计要记来源 IP（与交易/服务/监管模块同一口径），否则"谁做的"只能信前端自报
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_ops_log' AND COLUMN_NAME='ip_address')=0,
  'ALTER TABLE iot_ops_log ADD COLUMN ip_address VARCHAR(60)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 工单要留下报修描述：用户端表单一直在收「问题描述」，但表里没有这一列，提交后直接丢掉
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_work_order' AND COLUMN_NAME='description')=0,
  'ALTER TABLE iot_work_order ADD COLUMN description VARCHAR(500) AFTER technician', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ========== 2. 租户过滤要用到的索引 ==========
SET @s := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_alert' AND INDEX_NAME='idx_iot_alert_tenant')=0,
  'CREATE INDEX idx_iot_alert_tenant ON iot_alert (tenant_id, status, id)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_device' AND INDEX_NAME='idx_iot_device_tenant')=0,
  'CREATE INDEX idx_iot_device_tenant ON iot_device (tenant_id, farm_id)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_scene' AND INDEX_NAME='idx_iot_scene_tenant')=0,
  'CREATE INDEX idx_iot_scene_tenant ON iot_scene (tenant_id, id)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_rule' AND INDEX_NAME='idx_iot_rule_tenant')=0,
  'CREATE INDEX idx_iot_rule_tenant ON iot_rule (tenant_id, id)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_message' AND INDEX_NAME='idx_iot_message_tenant')=0,
  'CREATE INDEX idx_iot_message_tenant ON iot_message (tenant_id, id)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_work_order' AND INDEX_NAME='idx_iot_work_order_tenant')=0,
  'CREATE INDEX idx_iot_work_order_tenant ON iot_work_order (tenant_id, id)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_gateway' AND INDEX_NAME='idx_iot_gateway_farm')=0,
  'CREATE INDEX idx_iot_gateway_farm ON iot_gateway (farm_id)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_telemetry' AND INDEX_NAME='idx_iot_telemetry_device')=0,
  'CREATE INDEX idx_iot_telemetry_device ON iot_telemetry (device_id, recorded_at)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ========== 3. 遗留租户号 → 平台经营主体号 ==========
-- 2001=绿源农业合作社、2003=陕西洛川果业（与 agri_core.platform_merchant 一致）。
-- 只在"值还是遗留 1..4"时改写，重复执行不会把已经正确的 2001 再动一遍。
UPDATE iot_alert SET tenant_id = CASE tenant_id WHEN 1 THEN 2001 WHEN 2 THEN 2003 WHEN 3 THEN 2003 WHEN 4 THEN 2001 ELSE tenant_id END
WHERE tenant_id IN (1,2,3,4);

UPDATE iot_farm SET tenant_id = CASE tenant_id WHEN 1 THEN 2001 WHEN 2 THEN 2001 WHEN 3 THEN 2003 WHEN 4 THEN 2003 ELSE tenant_id END
WHERE tenant_id IN (1,2,3,4);

UPDATE iot_device SET tenant_id = 2001 WHERE tenant_id IN (1,2,3,4);

UPDATE iot_device_group SET tenant_id = 2001 WHERE tenant_id IN (1,2,3,4);
UPDATE iot_scene SET tenant_id = 2001 WHERE tenant_id IN (1,2,3,4);
UPDATE iot_rule SET tenant_id = 2001 WHERE tenant_id IN (1,2,3,4);
UPDATE iot_work_order SET tenant_id = 2001 WHERE tenant_id IN (1,2,3,4);
UPDATE iot_message SET tenant_id = 2001 WHERE tenant_id IN (1,2,3,4);
UPDATE iot_ota_task SET tenant_id = 2001 WHERE tenant_id IN (1,2,3,4);

-- 接入审核列表里存的是租户名文本，主键换了就要跟着对齐，否则运营看到的租户名和租户档案对不上
UPDATE iot_access_audit SET tenant_name = CASE tenant_name
        WHEN '绿源智慧农业科技有限公司' THEN '绿源农业合作社'
        WHEN '阳光家庭农场' THEN '陕西洛川果业'
        WHEN '金穗粮食合作社' THEN '绿源农业合作社'
        WHEN '丰盛果业' THEN '陕西洛川果业'
        ELSE tenant_name END
WHERE tenant_name IN ('绿源智慧农业科技有限公司','阳光家庭农场','金穗粮食合作社','丰盛果业');

-- ========== 4. 农场档案与生产域对齐 ==========
-- 农场的唯一来源是 agri-production（生产端 /farms/all）。设备引用的 farm_id 必须在
-- iot_farm 里存在，否则运营端设备列表的"所属农场"是空的。名称/归属照抄生产端。
INSERT INTO iot_farm (id,tenant_id,farm_name,manager,phone,address,area,device_count,online_count,alert_count,status,created_at) VALUES
(1,2001,'【演示】华南绿色蔬菜示范农场','李秀兰','13800121206','广东省广州市增城区永宁街道',128.50,0,0,0,'normal','2026-03-12'),
(2,2001,'【演示】华东智慧稻田农场','赵国平','13700137002','江苏省苏州市昆山市锦溪镇',86.20,0,0,0,'normal','2026-04-02'),
(3,2001,'【演示】鲁中设施果蔬农场','孙玉梅','13900139003','山东省潍坊市寿光市孙家集街道',260.00,0,0,0,'normal','2026-04-18'),
(4,2001,'【演示】西北高原生态牧场','马忠良','13600136004','甘肃省定西市安定区内官营镇',310.00,0,0,0,'normal','2026-05-06'),
(5,2001,'【演示】江汉稻渔综合种养农场','周建国','13500135005','湖北省武汉市江夏区金口街道',188.00,0,0,0,'normal','2026-05-22'),
(6,2001,'【演示】滇中花卉种苗基地','段红梅','13400134006','云南省昆明市呈贡区洛龙街道',76.00,0,0,0,'normal','2026-06-10')
ON DUPLICATE KEY UPDATE
    tenant_id = VALUES(tenant_id),
    farm_name = VALUES(farm_name),
    manager = VALUES(manager),
    phone = VALUES(phone),
    address = VALUES(address),
    area = VALUES(area);

-- 农场侧计数按设备台账实时回填（历史种子把这三列写成了常量，页面上一直对不上）
UPDATE iot_farm f
SET f.device_count = (SELECT COUNT(*) FROM iot_device d WHERE d.farm_id = f.id),
    f.online_count = (SELECT COUNT(*) FROM iot_device d WHERE d.farm_id = f.id AND d.online_status = 'online'),
    f.alert_count  = (SELECT COUNT(*) FROM iot_alert a WHERE a.farm_id = f.id AND a.status <> 'resolved');

-- ========== 5. 租户档案改用经营主体号做主键 ==========
INSERT INTO iot_tenant (id,tenant_name,tenant_code,plan_name,device_limit,device_count,region_name,status,expire_date) VALUES
(2001,'绿源农业合作社','M2001','旗舰版',2000,0,'广东省广州市','active','2027-12-31'),
(2003,'陕西洛川果业','M2003','专业版',800,0,'陕西省延安市','active','2027-06-30')
ON DUPLICATE KEY UPDATE
    tenant_name = VALUES(tenant_name),
    tenant_code = VALUES(tenant_code),
    region_name = VALUES(region_name);

UPDATE iot_tenant t
SET t.device_count = (SELECT COUNT(*) FROM iot_device d WHERE d.tenant_id = t.id);

-- 遗留自增租户（1..4）在平台侧没有对应主体，统一编号后必须清掉，
-- 否则运营端「租户列表」会出现点不进任何数据的假租户。
DELETE FROM iot_tenant WHERE id < 1000;

-- ========== 6. 相对时间文本 → yyyy-MM-dd HH:mm ==========
-- 老种子里的 recorded_at/created_at 写的是"今天 10:18""昨天 16:42""10-22 09:00"。
-- 报表按 SUBSTRING(col,1,10) 聚合日期时，这三种写法分不出同一个日期，
-- "今日"判定（前缀 = 今天）更是全部落空，所以先就地转成统一格式。
-- 只在值仍是相对文本时改写，转换后的行再次执行不会被重复处理。
UPDATE iot_telemetry SET recorded_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-%m-%d'),SUBSTRING(recorded_at,3))
WHERE recorded_at LIKE '今天 %';
UPDATE iot_telemetry SET recorded_at = CONCAT(DATE_FORMAT(CURDATE() - INTERVAL 1 DAY,'%Y-%m-%d'),SUBSTRING(recorded_at,3))
WHERE recorded_at LIKE '昨天 %';
UPDATE iot_telemetry SET recorded_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-'),recorded_at)
WHERE recorded_at REGEXP '^[0-9]{2}-[0-9]{2} ';

UPDATE iot_control_log SET created_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-%m-%d'),SUBSTRING(created_at,3))
WHERE created_at LIKE '今天 %';
UPDATE iot_control_log SET created_at = CONCAT(DATE_FORMAT(CURDATE() - INTERVAL 1 DAY,'%Y-%m-%d'),SUBSTRING(created_at,3))
WHERE created_at LIKE '昨天 %';
UPDATE iot_control_log SET created_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-'),created_at)
WHERE created_at REGEXP '^[0-9]{2}-[0-9]{2} ';

UPDATE iot_alert SET created_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-%m-%d'),SUBSTRING(created_at,3))
WHERE created_at LIKE '今天 %';
UPDATE iot_alert SET created_at = CONCAT(DATE_FORMAT(CURDATE() - INTERVAL 1 DAY,'%Y-%m-%d'),SUBSTRING(created_at,3))
WHERE created_at LIKE '昨天 %';
UPDATE iot_alert SET created_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-'),created_at)
WHERE created_at REGEXP '^[0-9]{2}-[0-9]{2} ';
UPDATE iot_alert SET handled_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-%m-%d'),SUBSTRING(handled_at,3))
WHERE handled_at LIKE '今天 %';
UPDATE iot_alert SET handled_at = CONCAT(DATE_FORMAT(CURDATE() - INTERVAL 1 DAY,'%Y-%m-%d'),SUBSTRING(handled_at,3))
WHERE handled_at LIKE '昨天 %';

UPDATE iot_message SET created_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-%m-%d'),SUBSTRING(created_at,3))
WHERE created_at LIKE '今天 %';
UPDATE iot_message SET created_at = CONCAT(DATE_FORMAT(CURDATE() - INTERVAL 1 DAY,'%Y-%m-%d'),SUBSTRING(created_at,3))
WHERE created_at LIKE '昨天 %';

UPDATE iot_work_order SET created_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-%m-%d'),SUBSTRING(created_at,3))
WHERE created_at LIKE '今天 %';
UPDATE iot_work_order SET created_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-'),created_at)
WHERE created_at REGEXP '^[0-9]{2}-[0-9]{2} ';
UPDATE iot_work_order SET completed_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-'),completed_at)
WHERE completed_at REGEXP '^[0-9]{2}-[0-9]{2} ';

UPDATE iot_rule SET last_trigger = CONCAT(DATE_FORMAT(CURDATE(),'%Y-%m-%d'),SUBSTRING(last_trigger,3))
WHERE last_trigger LIKE '今天 %';
UPDATE iot_rule SET last_trigger = CONCAT(DATE_FORMAT(CURDATE() - INTERVAL 1 DAY,'%Y-%m-%d'),SUBSTRING(last_trigger,3))
WHERE last_trigger LIKE '昨天 %';
UPDATE iot_rule SET last_trigger = CONCAT(DATE_FORMAT(CURDATE(),'%Y-'),last_trigger)
WHERE last_trigger REGEXP '^[0-9]{2}-[0-9]{2} ';

UPDATE iot_ops_log SET created_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-%m-%d'),SUBSTRING(created_at,3))
WHERE created_at LIKE '今天 %';
UPDATE iot_ops_log SET created_at = CONCAT(DATE_FORMAT(CURDATE() - INTERVAL 1 DAY,'%Y-%m-%d'),SUBSTRING(created_at,3))
WHERE created_at LIKE '昨天 %';
UPDATE iot_ops_log SET created_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-'),created_at)
WHERE created_at REGEXP '^[0-9]{2}-[0-9]{2} ';

UPDATE iot_access_audit SET submitted_at = CONCAT(DATE_FORMAT(CURDATE(),'%Y-%m-%d'),SUBSTRING(submitted_at,3))
WHERE submitted_at LIKE '今天 %';
UPDATE iot_access_audit SET submitted_at = CONCAT(DATE_FORMAT(CURDATE() - INTERVAL 1 DAY,'%Y-%m-%d'),SUBSTRING(submitted_at,3))
WHERE submitted_at LIKE '昨天 %';

-- 网关/设备的"最后在线/最后上报"是展示文案（30秒前、今天 10:18），不参与聚合，保持原样。

-- ========== 7. 阈值规则作用范围与租户名对齐 ==========
UPDATE iot_alert_rule SET tenant_scope='全部经营主体'
WHERE tenant_scope IN ('绿源果蔬合作社','全部地块','温室控制组');

-- ========== 8. 租户列不留默认值（与 schema-iot-app.sql 的口径一致） ==========
-- ADD COLUMN 时不得不给 DEFAULT 来给存量行填值；留着它，任何漏传 tenant_id 的写入
-- 都会静默落到 2001，变成"列表能看见、按主体查不到"的偏差。补完列就摘掉。
-- 改 NOT NULL 之前先把可能为空的告警补上归属，否则整条 ALTER 会直接失败。
UPDATE iot_alert SET tenant_id = 2001 WHERE tenant_id IS NULL;
ALTER TABLE iot_device      MODIFY COLUMN tenant_id BIGINT NOT NULL;
ALTER TABLE iot_device      MODIFY COLUMN farm_id   BIGINT NOT NULL;
ALTER TABLE iot_alert       MODIFY COLUMN tenant_id BIGINT NOT NULL;
ALTER TABLE iot_device_group MODIFY COLUMN tenant_id BIGINT NOT NULL;
ALTER TABLE iot_scene       MODIFY COLUMN tenant_id BIGINT NOT NULL;
ALTER TABLE iot_rule        MODIFY COLUMN tenant_id BIGINT NOT NULL;
ALTER TABLE iot_work_order  MODIFY COLUMN tenant_id BIGINT NOT NULL;
ALTER TABLE iot_message     MODIFY COLUMN tenant_id BIGINT NOT NULL;
ALTER TABLE iot_ota_task    MODIFY COLUMN tenant_id BIGINT NOT NULL;

-- ========== 9. 分组补齐第二个经营主体（分组是私域数据） ==========
INSERT IGNORE INTO iot_device_group (id,tenant_id,group_name,icon_text,color_value,device_count,is_default) VALUES
(7,2003,'全部设备','📦','#12764a',0,TRUE),
(8,2003,'果园环境监测组','🌡️','#176c93',0,FALSE),
(9,2003,'节水灌溉组','💧','#159a5e',0,FALSE),
(10,2003,'防雹通风组','🏠','#6b418d',0,FALSE),
(11,2003,'视频监控组','📷','#c26b27',0,FALSE),
(12,2003,'果品仓储组','🌾','#bd7c17',0,FALSE);

-- 分组计数改由注册/迁移设备时维护，种子常量（428/182/64…）与 29 台的实际台账差十几倍，
-- 这里按台账重算一次，页面不再显示对不上的数字。
UPDATE iot_device_group g SET g.device_count =
    (SELECT COUNT(*) FROM iot_device d WHERE d.group_id = g.id);

-- ========== 10. 存量工单补报修描述 ==========
-- 老库里的工单行早于 description 列，共享种子用 INSERT IGNORE 不会覆盖它们，
-- 不补就直接留一条"提交过描述却看不到"的空行。
UPDATE iot_work_order SET description = '阀门连续离线 2 小时以上，现场需检查供电线路与 NB 模块天线'
WHERE id = 1 AND description IS NULL;
UPDATE iot_work_order SET description = 'EC 值 5 分钟内从 1.8 升至 2.8 mS/cm，需核查施肥泵比例阀'
WHERE id = 2 AND description IS NULL;
UPDATE iot_work_order SET description = '季度巡检：清洁散热、检查 PoE 供电、升级固件至 v3.1.0'
WHERE id = 3 AND description IS NULL;

-- ========== 11. 升级任务的归属按主体名回认 ==========
-- iot_ota_task.tenant_id 是本轮补的列，ADD COLUMN 的默认值把已有两行都填成了 2001，
-- 于是 2003 看不到自己的升级任务、2001 多出一个不是它的任务。
-- 老种子里 target_scope 写的还是统一编号之前的旧主体名，先把名称对齐，再按名称回认租户。
UPDATE iot_ota_task SET target_scope = CASE target_scope
        WHEN '绿源智慧农业科技有限公司' THEN '绿源农业合作社'
        WHEN '金穗粮食合作社' THEN '绿源农业合作社'
        WHEN '阳光家庭农场' THEN '陕西洛川果业'
        WHEN '丰盛果业' THEN '陕西洛川果业'
        ELSE target_scope END
WHERE target_scope IN ('绿源智慧农业科技有限公司','金穗粮食合作社','阳光家庭农场','丰盛果业');

UPDATE iot_ota_task o
SET o.tenant_id = (SELECT t.id FROM iot_tenant t WHERE t.tenant_name = o.target_scope)
WHERE EXISTS (SELECT 1 FROM iot_tenant t WHERE t.tenant_name = o.target_scope AND t.id <> o.tenant_id);

-- ========== 12. 主体自定义阈值规则 ==========
-- 表由共享 schema-iot-app.sql 建（两个引擎同一份 DDL），这里只补判定要用的索引。
SET @s := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_alert_rule_tenant' AND INDEX_NAME='idx_iot_rule_tenant_scope')=0,
  'CREATE INDEX idx_iot_rule_tenant_scope ON iot_alert_rule_tenant (tenant_id, metric_key, enabled)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

CREATE TABLE IF NOT EXISTS iot_gateway_command (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 gateway_id BIGINT NOT NULL,
 gateway_name VARCHAR(160),
 action_name VARCHAR(120) NOT NULL,
 operator_name VARCHAR(300) NOT NULL,
 result_text VARCHAR(300),
 created_at VARCHAR(40) NOT NULL,
 command_no VARCHAR(40) NOT NULL,
 command_status VARCHAR(20) NOT NULL,
 dispatch_token VARCHAR(64),
 expires_at VARCHAR(40) NOT NULL,
 sent_at VARCHAR(40),
 receipt_at VARCHAR(40),
 UNIQUE KEY uk_gateway_command_no (command_no),
 KEY idx_gateway_command_status (gateway_id,command_status)
);

-- 固件包管理字段升级
-- 固件包字段升级；仅DDL，不回填或伪造历史包资料。
SET @db := DATABASE();
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_firmware' AND COLUMN_NAME='firmware_type')=0, 'ALTER TABLE iot_firmware ADD COLUMN firmware_type VARCHAR(40) DEFAULT ''gateway''', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_firmware' AND COLUMN_NAME='target_model')=0, 'ALTER TABLE iot_firmware ADD COLUMN target_model VARCHAR(80) DEFAULT ''ALL''', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_firmware' AND COLUMN_NAME='package_url')=0, 'ALTER TABLE iot_firmware ADD COLUMN package_url VARCHAR(1000) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_firmware' AND COLUMN_NAME='file_size_bytes')=0, 'ALTER TABLE iot_firmware ADD COLUMN file_size_bytes BIGINT DEFAULT 0', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_firmware' AND COLUMN_NAME='published_at')=0, 'ALTER TABLE iot_firmware ADD COLUMN published_at VARCHAR(40) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_firmware' AND COLUMN_NAME='deprecated_at')=0, 'ALTER TABLE iot_firmware ADD COLUMN deprecated_at VARCHAR(40) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_firmware' AND COLUMN_NAME='release_notes')=0, 'ALTER TABLE iot_firmware ADD COLUMN release_notes VARCHAR(500) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_firmware' AND COLUMN_NAME='changelog_text')=0, 'ALTER TABLE iot_firmware ADD COLUMN changelog_text VARCHAR(1000) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_firmware' AND COLUMN_NAME='created_at')=0, 'ALTER TABLE iot_firmware ADD COLUMN created_at VARCHAR(40) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_firmware' AND COLUMN_NAME='deprecate_reason')=0, 'ALTER TABLE iot_firmware ADD COLUMN deprecate_reason VARCHAR(300) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='iot_firmware' AND INDEX_NAME='uk_firmware_version')=0, 'CREATE UNIQUE INDEX uk_firmware_version ON iot_firmware(firmware_type,target_model,version_name)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
