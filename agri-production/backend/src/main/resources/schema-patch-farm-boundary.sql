-- 可重复执行；不变更已有农场坐标、面积与地块边界。
SET @farm_boundary_ddl = IF(
 (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='agri_prod_farm_info' AND COLUMN_NAME='boundary')=0,
 'ALTER TABLE agri_prod_farm_info ADD COLUMN boundary MEDIUMTEXT NULL COMMENT ''农场边界GeoJSON Polygon''',
 'SELECT 1');
PREPARE farm_boundary_stmt FROM @farm_boundary_ddl;
EXECUTE farm_boundary_stmt;
DEALLOCATE PREPARE farm_boundary_stmt;
