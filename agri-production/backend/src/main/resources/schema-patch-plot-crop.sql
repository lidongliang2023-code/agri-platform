-- 补丁：地块的「当前作物」关联作物主数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-plot-crop.sql
--
-- 【为什么】作物做成主数据后（schema-patch-crop-master.sql），计划侧已经落 crop_id，
-- 而地块侧只有 current_crop 这个文本列 —— 名字在、ID 没有，"按作物统计 / 关联主数据"在地块侧无从谈起。
-- 本补丁给地块补 crop_id，并把**已有的作物名**按同租户同名对到主数据上。
--
-- 【口径】
--   · current_crop 保留（页面各处显示的是名称，不改成 join 取）；
--   · 对不上主数据的行**保持 crop_id 为空**，不猜、不新建主数据行（名字可能是品种误填，见下）；
--   · 地块的 crop_variety（品种）**不动**：它是品种不是作物 —— 演示数据里"普罗旺斯"这类值
--     被历史页面临时当作物显示过，本轮不改写它，只保证"作物"这一层有权威口径。

-- 1) 补列（守卫式：列已存在则不动）
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'agri_prod_plot_info'
                  AND COLUMN_NAME = 'crop_id') = 0,
    'ALTER TABLE agri_prod_plot_info ADD COLUMN crop_id BIGINT NULL COMMENT ''当前作物主数据主键（agri_prod_crop_info.id）'' AFTER current_crop',
    'SELECT ''crop_id 已存在，跳过'' AS notice');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) 回填：地块的作物名 → 作物主数据主键（同租户同名、未删除）
UPDATE agri_prod_plot_info p
    JOIN agri_prod_crop_info c
        ON c.tenant_id = p.tenant_id
       AND c.crop_name = TRIM(p.current_crop)
       AND c.deleted = 0
SET p.crop_id = c.id
WHERE p.deleted = 0
  AND p.crop_id IS NULL
  AND p.current_crop IS NOT NULL
  AND TRIM(p.current_crop) <> '';
