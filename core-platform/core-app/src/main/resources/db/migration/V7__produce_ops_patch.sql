-- ------------------------------------------------ V7 运营能力补丁
-- 三项改动，均由运营端页面真实缺口驱动：
--   1) prod_alert_info 补 device_id 索引（设备「故障态」由未处置告警派生，列表逐设备查询）
--   2) prod_farm_info 补 remark 列（UI 有备注字段但无处落库，属于假功能）
--   3) 计划状态口径收敛：2=进行中（在种），历史/误写的 3 统一纠正为 2

-- ------------------------------------------------ 1. 告警表设备索引
-- 故障态判定 = 该设备存在 status='PENDING' 的告警。查询形如
--   where device_id = ? and status = 'PENDING' and deleted = 0
-- 设备列表页每条设备都会跑一次，缺索引会全表扫。
ALTER TABLE prod_alert_info
    ADD KEY idx_alert_info_device (device_id);

-- ------------------------------------------------ 2. 农场备注
-- MySQL 8 不支持 ADD COLUMN IF NOT EXISTS，依赖 Flyway 版本机制保证只执行一次。
ALTER TABLE prod_farm_info
    ADD COLUMN remark VARCHAR(500) NULL COMMENT '备注' AFTER status;

-- ------------------------------------------------ 3. 计划状态口径纠正
-- 状态字典：1=编制中 2=进行中（在种） 3=已完成 4=已取消。
-- 后端 start() 写 2，前端 production-view.ts 亦注释「启动（1 编制中 → 2 进行中）」，
-- 两处自洽，故「在种」= 2。库内不存在同时段两个在种计划的强校验也以此为准。
-- 当前迁移脚本里没有 prod_plan_info 的种子 INSERT，本语句在全新库上影响 0 行；
-- 对已经通过接口写入、把状态误置为 3 的数据做一次兜底纠正。
UPDATE prod_plan_info
SET status = 2
WHERE status = 3;
