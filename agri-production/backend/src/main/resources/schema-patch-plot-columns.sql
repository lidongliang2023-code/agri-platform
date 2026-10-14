-- 一次性补丁：地块表补 6 列（**只需跑一次**，ALTER 不幂等）。
--
-- 背景：实体 Plot（com.agri.production.entity.Plot，@TableName agri_prod_plot_info）映射了
--   farm_code / boundary / center_longitude / center_latitude / soil_ph / soil_organic_matter
-- 六列，而表里一列都没有 → MyBatis-Plus 生成的 SELECT 带上它们，**任何**按 id 读地块的调用
-- 都会 `Unknown column 'farm_code' in 'field list'`，接口返 500。
--
-- 实测触发点（本轮踩到的）：投入品使用记录按 plotId 推导 farmId 时调 plotMapper.selectById，
-- 一条本来只是"补个冗余字段"的读操作把整个新增接口打成 500。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-plot-columns.sql
-- ⚠️ --default-character-set=utf8mb4 不能省（Windows 版 mysql 客户端默认按本机 GBK 声明连接，
--    脚本是 UTF-8，中文会被双重编码写进库且不可逆）。
-- 新库不用跑：schema-mysql.sql 里这张表已经建全。

ALTER TABLE agri_prod_plot_info
    ADD COLUMN farm_code VARCHAR(191) NULL COMMENT '所属农场编码（冗余展示，前端 farmCode）',
    ADD COLUMN boundary TEXT NULL COMMENT '地块边界（GeoJSON）',
    ADD COLUMN center_longitude DECIMAL(12,6) NULL COMMENT '中心点经度',
    ADD COLUMN center_latitude DECIMAL(12,6) NULL COMMENT '中心点纬度',
    ADD COLUMN soil_ph DECIMAL(6,2) NULL COMMENT '土壤 pH',
    ADD COLUMN soil_organic_matter DECIMAL(10,4) NULL COMMENT '土壤有机质（g/kg）';

-- 既有两条演示地块补上农场编码（farm_code 可从 farm_id 推导，属可推导的冗余字段，不算编数据）
UPDATE agri_prod_plot_info p
    JOIN agri_prod_farm_info f ON f.id = p.farm_id
SET p.farm_code = f.farm_code
WHERE p.farm_code IS NULL;
