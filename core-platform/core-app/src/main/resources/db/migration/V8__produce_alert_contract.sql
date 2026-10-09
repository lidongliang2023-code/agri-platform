-- ------------------------------------------------ V8 告警域契约补齐
-- 由「前端有调用、后端无对应」的真实缺口驱动，三项改动：
--   1) prod_alert_info 补 alert_source 列（前端 AlertSource 1-5 已在列表筛选与详情展示中使用，
--      后端原先根本没有这一列，筛选条件被静默丢弃 —— 属于典型假功能）
--   2) 告警状态字典补 HANDLING（前端 AlertStatus 2=处理中，后端只有 PENDING/HANDLED/IGNORED，
--      缺一档导致「处理中」永远选不中）
--   3) 补 (farm_id, status) 复合索引：告警中心与运营端监管详情都按 农场+状态 过滤

-- ------------------------------------------------ 1. 告警来源
-- 口径：1 环境 2 设备 3 病虫害 4 任务 5 投入品（与前端 src/types/alert.ts AlertSource 一致）
-- 允许为空：存量告警由规则触发时未必能判定来源，空值前端显示「—」，不编造。
ALTER TABLE prod_alert_info
    ADD COLUMN alert_source TINYINT NULL COMMENT '告警来源 1环境 2设备 3病虫害 4任务 5投入品' AFTER rule_id;

ALTER TABLE prod_alert_info
    ADD KEY idx_alert_info_source (alert_source);

-- ------------------------------------------------ 2. 状态字典说明更新（DDL 注释，不锁表语义）
-- 状态：PENDING 未处理 / HANDLING 处理中 / HANDLED 已处理 / IGNORED 已忽略
-- 对应前端数字编码 1/2/3/4，映射在 com.agri.produce.internal.alert.AlertDict 内收敛，
-- 数据库始终存大写英文枚举（AdminAlertService / IotDeviceService / TenantOverviewService
-- 等多处按 status='PENDING' 查询，改数字会静默击穿这些链路）。
ALTER TABLE prod_alert_info
    MODIFY COLUMN status VARCHAR(20) DEFAULT 'PENDING' COMMENT '状态 PENDING未处理/HANDLING处理中/HANDLED已处理/IGNORED已忽略';

-- ------------------------------------------------ 3. 农场 + 状态复合索引
ALTER TABLE prod_alert_info
    ADD KEY idx_alert_info_farm_status (farm_id, status);
