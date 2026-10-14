-- 一次性补丁：给设备主表与传感器数据表补上**实体已经在用的列**。
--
-- 背景：这两张表与实体是两套设计（实测对照：IoTDevice 实体 21 列 / 表 22 列 / 交集 12；
-- SensorData 实体 12 列 / 表 9 列 / 交集 5）。缺列的直接后果有两个：
--   1) 接口一调就 500 —— 这类表的 XML 语句本来就缺（IoTDeviceMapper.pageQuery 等 13 个方法
--      在 XML 里根本没有对应语句），而即便补上 SQL，只要 WHERE/SELECT 里用到这些列，
--      MySQL 就报 Unknown column；
--   2) 只改 SELECT 不改 WHERE 的话，接口 200 但字段全 null，页面"有行没值"。
--
-- 处理口径（**只增不改**）：把实体需要、表里没有的列加上；与既有列同义的做一次数据搬迁；
-- 既有列一律保留不动（不知道还有谁在读它们，重命名风险更大）。
-- 同义列对照（左=新增列，右=既有列）：
--   iot_device.location            ← install_location
--   iot_device.last_online_time    ← last_connect_time
--   sensor_data.data_time          ← collect_time
--   sensor_data.quality_flag       ← quality
-- 其余新增列在当前库里没有对应来源，留空（不编数据）。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-device-columns.sql
-- ⚠️ --default-character-set=utf8mb4 不能省：Windows 版 mysql 客户端默认按**系统本地编码**
--    （中文机器上是 gbk）声明连接，而本文件是 UTF-8。省掉它，脚本里的中文会被双重编码写进库 ——
--    实测演示数据落库成 "2026 骞存槬鑼?按绋荤?妞嶈?鍒"，接口与页面跟着一起乱，且**不可逆**。
-- 新库不用跑：schema-mysql.sql 里这两张表已经把这些列建好了。

-- ---------- 设备主表 ----------
ALTER TABLE agri_prod_iot_device
    ADD COLUMN location VARCHAR(255) NULL COMMENT '安装位置（实体字段；旧列为 install_location）',
    ADD COLUMN mac_address VARCHAR(64) NULL COMMENT 'MAC 地址',
    ADD COLUMN install_date DATETIME NULL COMMENT '安装日期',
    ADD COLUMN last_online_time DATETIME NULL COMMENT '最近在线时间（旧列为 last_connect_time）',
    ADD COLUMN battery_level INT NULL COMMENT '电量百分比',
    ADD COLUMN signal_strength INT NULL COMMENT '信号强度',
    ADD COLUMN serial_number VARCHAR(64) NULL COMMENT '出厂序列号',
    ADD COLUMN firmware_version VARCHAR(64) NULL COMMENT '固件版本',
    ADD COLUMN description VARCHAR(500) NULL COMMENT '设备说明';

UPDATE agri_prod_iot_device
SET location = install_location
WHERE location IS NULL AND install_location IS NOT NULL;

UPDATE agri_prod_iot_device
SET last_online_time = last_connect_time
WHERE last_online_time IS NULL AND last_connect_time IS NOT NULL;

-- ---------- 传感器数据 ----------
ALTER TABLE agri_prod_sensor_data
    ADD COLUMN device_code VARCHAR(64) NULL COMMENT '设备编码（冗余，便于直接展示）',
    ADD COLUMN sensor_name VARCHAR(64) NULL COMMENT '传感器名称',
    ADD COLUMN data_time DATETIME NULL COMMENT '采集时间（旧列为 collect_time）',
    ADD COLUMN quality_flag VARCHAR(20) NULL COMMENT '数据质量标记（旧列为 quality）',
    ADD COLUMN raw_data TEXT NULL COMMENT '原始报文',
    ADD COLUMN farm_id BIGINT NULL COMMENT '农场ID',
    ADD COLUMN plot_id BIGINT NULL COMMENT '地块ID';

UPDATE agri_prod_sensor_data
SET data_time = collect_time
WHERE data_time IS NULL AND collect_time IS NOT NULL;

UPDATE agri_prod_sensor_data
SET quality_flag = quality
WHERE quality_flag IS NULL AND quality IS NOT NULL;
