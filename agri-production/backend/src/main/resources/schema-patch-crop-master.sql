-- 补丁：作物主数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-crop-master.sql
--
-- 【建表】表结构与索引在 schema-mysql.sql 里（启动时 CREATE TABLE IF NOT EXISTS 自动建）。
-- 本补丁只做**种子**：把系统里**已经在用的**作物补成主数据行。
--
-- 【种子从哪来】只有两处真实来源（平台没有作物主数据表，也不凭空造清单）：
--   ① 种养计划的 crop_name（如 水稻 / 番茄）；
--   ② 地块台账的 current_crop（如 西红柿 / 水稻）。
-- 两处都按当前库里已有的值 INSERT，**不写死任何作物名** —— 换个库跑就是那个库的真实情况。
--
-- 【编码怎么给】crop_code 形如 CROP-0001，按插入顺序编号（同租户内唯一）。
-- 之所以不把名称当编码：编码是给人看的稳定标识，名称以后要能改（改名不该换编码）。
--
-- 【幂等】两处 INSERT 都带 NOT EXISTS 判断（按 tenant_id + crop_name 判重），重复跑不会插重复行；
-- 已经手工维护过的作物不会被覆盖。

-- 1) 建表（与 schema-mysql.sql 同定义；单独跑本补丁的环境也能一次建好）
CREATE TABLE IF NOT EXISTS agri_prod_crop_info (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    crop_code VARCHAR(64) NOT NULL COMMENT '作物编码（业务主键，页面 cropCode，同租户内唯一）',
    crop_name VARCHAR(100) NOT NULL COMMENT '作物名称（页面 cropName）',
    crop_category VARCHAR(50) COMMENT '作物类别（可空）',
    growth_cycle_days INT COMMENT '生长周期（天，可空）',
    measurement_unit VARCHAR(20) COMMENT '计量单位（可空）',
    status TINYINT DEFAULT 1 COMMENT '1 启用 / 0 停用',
    sort_no INT DEFAULT 0 COMMENT '排序号',
    remark VARCHAR(500) COMMENT '备注',
    farm_id BIGINT COMMENT '本表不使用（租户级主数据）',
    tenant_id VARCHAR(191) NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    UNIQUE KEY `uk_crop_tenant_code` (tenant_id, crop_code),
    INDEX `idx_crop_tenant` (tenant_id),
    INDEX `idx_crop_name` (crop_name),
    INDEX `idx_crop_status` (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) 种子：两处来源合并成一份名单（同名只留一行），再按租户编号
--
-- 为什么合并成一条语句：分两条插的话，两条都从 0001 开始编号，第二个租户 / 第二段就会撞上
-- 唯一索引 (tenant_id, crop_code)；合并后 ROW_NUMBER 是**跨两处来源**统一编号，天然不重。
-- 编号前先加上该租户已有行数（`已存在作物` 子查询），这样"库里已经手工维护过几条"时也不会重号。
INSERT INTO agri_prod_crop_info (crop_code, crop_name, status, sort_no, remark, tenant_id)
SELECT
    CONCAT('CROP-', LPAD(
        (SELECT COUNT(*) FROM agri_prod_crop_info c2 WHERE c2.tenant_id = s.tenant_id)
            + ROW_NUMBER() OVER (PARTITION BY s.tenant_id ORDER BY s.crop_name),
        4, '0')),
    s.crop_name,
    1,
    0,
    s.origin,
    s.tenant_id
FROM (
    SELECT tenant_id, crop_name, MIN(origin) AS origin
    FROM (
        SELECT tenant_id, TRIM(crop_name) AS crop_name, '由既有种养计划的作物迁移而来' AS origin
        FROM agri_prod_planting_plan
        WHERE deleted = 0 AND crop_name IS NOT NULL AND TRIM(crop_name) <> ''
        UNION ALL
        SELECT tenant_id, TRIM(current_crop) AS crop_name, '由既有地块登记的当前作物迁移而来' AS origin
        FROM agri_prod_plot_info
        WHERE deleted = 0 AND current_crop IS NOT NULL AND TRIM(current_crop) <> ''
    ) u
    GROUP BY tenant_id, crop_name
) s
WHERE NOT EXISTS (
    SELECT 1 FROM agri_prod_crop_info c
    WHERE c.tenant_id = s.tenant_id AND c.crop_name = s.crop_name
);

-- 3) 回填：既有计划只存了 crop_name、crop_id 为空（作物做成主数据之前建的）
--
-- 不回填的话，那些计划在编辑弹窗里要靠"名字对主数据"才能显示出来，数据也一直处于半关联状态。
-- 只按**同租户同名的未删除作物**配对；对不上的（名字不在主数据里）保持不动 —— 不猜。
UPDATE agri_prod_planting_plan p
    JOIN agri_prod_crop_info c
        ON c.tenant_id = p.tenant_id
       AND c.crop_name = TRIM(p.crop_name)
       AND c.deleted = 0
SET p.crop_id = c.id
WHERE p.deleted = 0
  AND p.crop_id IS NULL
  AND p.crop_name IS NOT NULL
  AND TRIM(p.crop_name) <> '';

-- 4) 地块的 current_crop 是文本列（地块表没有 crop_id 列），**不做回填**：
-- 地块的"当前作物"是由计划的执行结果反推的展示字段，改结构属于另一轮的事。
-- 这里只保证下拉与计划侧共用同一份主数据。
