-- 一次性补丁：农事任务页（建表 + 实体对齐）。**只需跑一次**（ALTER 不是幂等的）。
--
-- 口径（2026-10-14 拍板）：**以接口/实体为准** —— 前端页面读哪些字段，后端就产出哪些字段，
-- 表按它们补齐（而不是反过来改代码去迁就表）。
--
-- 背景（实测对照 scripts/check-entity-columns.mjs）：
--   · agri_prod_task_info 实体/VO 用到 15 列表里没有（task_desc / template_id / actual_output …），
--     写进 WHERE 就是 Unknown column，只 SELECT 出来就是"接口 200、字段全 null"；
--   · 前端 Task 类型还要 assignerId/assignerName/acceptStatus/acceptRemark/rejectCount/completedAt，
--     这些在表里也不存在；验收相关还要 acceptorId/acceptorName/acceptedAt；
--   · agri_prod_task_template **整张表都没有**，而实体 TaskTemplate 早就写好了 —— 模板库一打开就报错。
--
-- 顺序要求：先把模板表建出来，再做"任务补模板 id"的 UPDATE —— 反过来会报
-- Table 'agri_prod_task_template' doesn't exist（第一版就是这么写错的，实测踩到）。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-task-page.sql
-- ⚠️ --default-character-set=utf8mb4 不能省：Windows 版 mysql 客户端默认按**系统本地编码**
--    （中文机器上是 gbk）声明连接，而本文件是 UTF-8。省掉它，脚本里的中文会被双重编码写进库 ——
--    实测演示数据落库成 "2026 骞存槬鑼?按绋荤?妞嶈?鍒"，接口与页面跟着一起乱，且**不可逆**。
-- 新库不用跑：schema-mysql.sql 里这些已经建全。

-- ---------- 1. 任务表补列 ----------
ALTER TABLE agri_prod_task_info
    ADD COLUMN task_type_detail TEXT NULL COMMENT '任务类型细分（实体字段）',
    ADD COLUMN farm_code VARCHAR(191) NULL COMMENT '农场编码（冗余展示）',
    ADD COLUMN plot_code VARCHAR(191) NULL COMMENT '地块编码（冗余展示）',
    ADD COLUMN crop_name VARCHAR(191) NULL COMMENT '作物名称',
    ADD COLUMN task_desc TEXT NULL COMMENT '任务描述（前端 description）',
    ADD COLUMN input_materials TEXT NULL COMMENT '投入品（文本清单）',
    ADD COLUMN input_materials_json TEXT NULL COMMENT '投入品（JSON）',
    ADD COLUMN expected_output DECIMAL(18,4) NULL COMMENT '预计产量',
    ADD COLUMN actual_output DECIMAL(18,4) NULL COMMENT '实际产量',
    ADD COLUMN quality_requirement TEXT NULL COMMENT '质量要求',
    ADD COLUMN result_photo_urls TEXT NULL COMMENT '成果照片（JSON/逗号分隔）',
    ADD COLUMN result_desc TEXT NULL COMMENT '成果说明',
    ADD COLUMN template_id BIGINT NULL COMMENT '来源任务模板ID',
    ADD COLUMN assigner_id BIGINT NULL COMMENT '派发人ID（前端 assignerId）',
    ADD COLUMN assigner_name VARCHAR(191) NULL COMMENT '派发人姓名（前端 assignerName）',
    ADD COLUMN accept_status BIGINT DEFAULT 0 COMMENT '验收状态：0 待验收 1 通过 2 驳回（前端 acceptStatus）',
    ADD COLUMN accept_remark TEXT NULL COMMENT '验收意见（前端 acceptRemark）',
    ADD COLUMN reject_count BIGINT DEFAULT 0 COMMENT '驳回次数（前端 rejectCount）',
    ADD COLUMN acceptor_id BIGINT NULL COMMENT '验收人ID',
    ADD COLUMN acceptor_name VARCHAR(191) NULL COMMENT '验收人姓名',
    ADD COLUMN accepted_at DATETIME NULL COMMENT '验收时间';

-- ---------- 2. 任务模板库 ----------
CREATE TABLE IF NOT EXISTS agri_prod_task_template (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
template_code VARCHAR(191) NOT NULL UNIQUE,
template_name TEXT NOT NULL,
template_type VARCHAR(255),
crop_category VARCHAR(255),
crop_name VARCHAR(255),
task_type VARCHAR(255),
growth_stage VARCHAR(255),
description TEXT,
template_content TEXT,
recommended_duration_hours BIGINT,
required_inputs TEXT,
optional_inputs TEXT,
is_system BIGINT DEFAULT 0,
use_count BIGINT DEFAULT 0,
sort_order BIGINT DEFAULT 0,
status VARCHAR(255) DEFAULT 'active',
del_flag BIGINT DEFAULT 0,
tenant_id VARCHAR(191) NOT NULL,
create_by TEXT,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
update_by TEXT,
update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
remark TEXT,
    INDEX `idx_task_template_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO agri_prod_task_template
    (template_code, template_name, template_type, crop_category, crop_name, task_type, growth_stage,
     description, template_content, recommended_duration_hours, required_inputs, is_system, status, tenant_id)
VALUES
    ('TPL-FERT-01', '水稻春季追肥标准作业', 'system', '粮食作物', '水稻', '施肥', '分蘖期',
     '分蘖期追施尿素，促进有效分蘖', '1) 按 15kg/亩 称量尿素；2) 均匀撒施；3) 施后浅水灌溉并记录。',
     4, '尿素,复合肥', 1, 'active', '2001'),
    ('TPL-PEST-01', '大棚病虫害统防统治', 'system', '蔬菜', '西红柿', '打药', '结果期',
     '结果期预防灰霉病与白粉虱', '1) 检查虫口密度；2) 生物农药优先；3) 用药后记录安全间隔期。',
     3, '生物农药', 1, 'active', '2001');

-- ---------- 3. 演示任务补上新列的值 ----------
-- ---------- 3. 任务打卡记录（执行记录）----------
-- 前端「农事任务详情」的打卡与记录列表要它；实体 TaskRecord 字段名直接按前端契约命名
-- （recordId 映射到列 id，其余同名 snake_case）。
CREATE TABLE IF NOT EXISTS agri_prod_task_record (
id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
task_id BIGINT NOT NULL,
executor_id BIGINT,
executor_name VARCHAR(191),
execute_time DATETIME,
execute_type BIGINT COMMENT '1 开始 2 过程 3 完成',
photos TEXT COMMENT '照片地址（JSON 数组字符串或逗号分隔）',
gps_lat DECIMAL(12,8),
gps_lng DECIMAL(12,8),
gps_distance DECIMAL(12,2) COMMENT '距地块中心距离（米）',
abnormal_desc TEXT,
offline_flag BIGINT DEFAULT 0 COMMENT '0 在线 1 离线补传',
tenant_id VARCHAR(191) NOT NULL,
create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_task_record_task_id` (task_id),
    INDEX `idx_task_record_tenant_id` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO agri_prod_task_record
    (id, task_id, executor_id, executor_name, execute_time, execute_type, photos, gps_lat, gps_lng, gps_distance, offline_flag, tenant_id)
VALUES
    (1, 1, 11, '王师傅', '2026-10-13 07:40:00', 1, '[]', 45.12345678, 126.65432100, 12.50, 0, '2001'),
    (2, 1, 11, '王师傅', '2026-10-13 09:20:00', 2, '[]', 45.12349999, 126.65439999, 15.20, 0, '2001');

-- ---------- 4. 演示任务补上新列的值 ----------
-- 不补的话列表里这些字段都是空的（"有行没值"看起来像 bug，实测就是这种观感）
UPDATE agri_prod_task_info SET
    task_desc = '分蘖期按 15kg/亩 追施尿素，施后浅水灌溉',
    crop_name = '水稻',
    plot_code = 'P001',
    farm_code = 'F001',
    template_id = (SELECT id FROM agri_prod_task_template WHERE template_code = 'TPL-FERT-01' LIMIT 1),
    assigner_id = 1,
    assigner_name = '张工（农场管理员）',
    accept_status = 0,
    reject_count = 0,
    expected_output = 2500.0000
WHERE task_code = 'T001' AND task_desc IS NULL;

UPDATE agri_prod_task_info SET
    task_desc = '结果期统防统治，优先生物农药，注意安全间隔期',
    crop_name = '西红柿',
    plot_code = 'P002',
    farm_code = 'F001',
    template_id = (SELECT id FROM agri_prod_task_template WHERE template_code = 'TPL-PEST-01' LIMIT 1),
    assigner_id = 1,
    assigner_name = '张工（农场管理员）',
    accept_status = 1,
    accept_remark = '作业到位，通过验收',
    acceptor_name = '李主管',
    accepted_at = '2026-10-13 18:00:00',
    reject_count = 0,
    expected_output = 1200.0000,
    actual_output = 1180.0000,
    result_desc = '已完成统防统治，未见明显病虫害'
WHERE task_code = 'T002' AND task_desc IS NULL;
