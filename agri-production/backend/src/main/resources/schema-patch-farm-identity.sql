-- 补丁：农场身份映射（agri_prod_farm_info.farm_id）+ 16 个演示农场（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-farm-identity.sql
--
-- 要解决的问题（2026-10-15 实测）：
--   页面上的"当前农场"来自 GET /farms —— 这一段仍在**平台侧**服务，返回的 farmId 是平台主键
--   `DEMO-FARM-001` 这种字符串；而本服务的农场主键是数字 id。前端把这个值原样作为过滤参数发过来，
--   本服务 Long.parseLong 失败 → 过滤条件被**悄悄丢掉**：
--       GET /harvests?farmId=DEMO-FARM-010  → 全部 3 条（看起来筛过了，其实没筛）
--       GET /plans?farmId=DEMO-FARM-010     → 1 条（同上）
--       GET /tasks?farmId=DEMO-FARM-010     → 400「参数类型不匹配」
--   同一件事三种表现、且最危险的两种是静默的。
--
-- 做法：新增 **platform_farm_id** 列存平台侧农场标识，由 FarmIdResolver 把平台标识换算成本地主键。
--
-- 为什么不复用本表已有的 farm_id 列（它此前没被映射、值一直是 NULL，看着正好合身）：
-- 实体基类 BaseEntity **已经**把 farm_id 映射成 Long（所有生产实体通用的"所属农场"字段），
-- 而本表这一列是 VARCHAR(191) —— 类型对不上。给 Farm 再声明一个 String farmId 会直接编译不过
-- （getFarmId 返回类型冲突，这正是本次先试后改的那一版）。所以平台标识单独一列，名字带上前缀。
-- 顺带说明那个 farm_id 列不能删：BaseEntity.farmId 映射到它，MyBatis-Plus 的 selectById 会带上它，
-- 删掉所有农场查询都会 Unknown column。它属于"基类审计字段在农场表上的历史遗留"，先留着。
--
-- 为什么本地 id 与平台序号对齐（1↔001 … 16↔016）：
--   演示生产数据（采收批次、地块、任务、溯源码…）都挂在本地 farm_id = 1 上，
--   而对齐后 1 就代表「【演示】华南绿色蔬菜示范农场」（DEMO-FARM-001）——
--   这既与平台侧演示数据的归属一致（平台的演示批次也在 DEMO-FARM-001），
--   也与数据本身的主题一致（西红柿/蔬菜），且**不需要搬动任何业务数据**。
--
-- 注意：页面农场下拉框默认选中的是列表第一项，平台侧按创建时间倒序 → 当前是 DEMO-FARM-007
-- （东北寒地黑土玉米农场），它本来就没有演示生产数据，切到 DEMO-FARM-001 才看得到 ——
-- 这是"该农场确实没有数据"，不是筛选坏了。

-- 清理上一版试作（当时借用了 farm_id 列）：把值挪回 NULL，并去掉建在错误列上的索引
UPDATE agri_prod_farm_info SET farm_id = NULL WHERE farm_id LIKE 'DEMO-FARM-%';
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_farm_info' AND INDEX_NAME = 'uk_farm_platform_id') > 0,
  'ALTER TABLE agri_prod_farm_info DROP INDEX uk_farm_platform_id',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 平台侧农场标识列
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_farm_info' AND COLUMN_NAME = 'platform_farm_id') = 0,
  'ALTER TABLE agri_prod_farm_info ADD COLUMN platform_farm_id VARCHAR(64) NULL COMMENT ''平台侧农场标识（DEMO-FARM-xxx），用于把页面传回的 farmId 换算成本地主键''',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 唯一索引：一个平台农场只能映射到一行本地农场（NULL 不参与唯一性，历史行不受影响）
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agri_prod_farm_info' AND INDEX_NAME = 'uk_farm_platform_id') = 0,
  'ALTER TABLE agri_prod_farm_info ADD UNIQUE KEY uk_farm_platform_id (platform_farm_id)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 已有两行：把名称/编码对齐到平台侧演示农场，并补上平台标识
UPDATE agri_prod_farm_info SET platform_farm_id='DEMO-FARM-001', farm_code='DEMO-FARMC-001',
       farm_name='【演示】华南绿色蔬菜示范农场' WHERE id=1;
UPDATE agri_prod_farm_info SET platform_farm_id='DEMO-FARM-002', farm_code='DEMO-FARMC-002',
       farm_name='【演示】华东智慧稻田农场' WHERE id=2;

-- 其余 14 个演示农场（名称与编码与核心侧 prod_farm_info 的演示数据一致，2026-10-15 抄录）。
-- 用 ON DUPLICATE KEY UPDATE 而不是 INSERT IGNORE：重跑补丁时要能**补齐**已存在行的
-- platform_farm_id（上一次试作可能把值写在了别的列上），IGNORE 会让这种行永远留在未映射状态。
INSERT INTO agri_prod_farm_info
    (id, platform_farm_id, farm_code, farm_name, farm_type, status, tenant_id, total_area, plot_count, remark)
VALUES
    ( 3, 'DEMO-FARM-003',  'DEMO-FARMC-003',  '【演示】鲁中设施果蔬农场',      'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    ( 4, 'DEMO-FARM-004',  'DEMO-FARMC-004',  '【演示】西北高原生态牧场',      'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    ( 5, 'DEMO-FARM-005',  'DEMO-FARMC-005',  '【演示】江汉稻渔综合种养农场',  'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    ( 6, 'DEMO-FARM-006',  'DEMO-FARMC-006',  '【演示】滇中花卉种苗基地',      'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    ( 7, 'DEMO-FARM-007',  'DEMO-FARMC-007',  '【演示】东北寒地黑土玉米农场',  'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    ( 8, 'DEMO-FARM-008',  'DEMO-FARMC-008',  '【演示】川西平原粮油种植基地',  'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    ( 9, 'DEMO-FARM-009',  'DEMO-FARMC-009',  '【演示】赣南脐橙标准化果园',    'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    (10, 'DEMO-FARM-010',  'DEMO-FARMC-010',  '【演示】闽南设施食用菌基地',    'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    (11, 'DEMO-FARM-011',  'DEMO-FARMC-011',  '【演示】桂北砂糖橘产业农场',    'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    (12, 'DEMO-FARM-012',  'DEMO-FARMC-012',  '【演示】冀东沿海水产养殖场',    'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    (13, 'DEMO-FARM-013',  'DEMO-FARMC-013',  '【演示】皖北优质小麦农场',      'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    (14, 'DEMO-FARM-014',  'DEMO-FARMC-014',  '【演示】湘西柑橘山地果园',      'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    (15, 'DEMO-FARM-015',  'DEMO-FARMC-015',  '【演示】陕南茶叶生态园',        'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql'),
    (16, 'DEMO-FARM-016',  'DEMO-FARMC-016',  '【演示】海南热带果蔬基地',      'plant', 'active', '2001', 0, 0, '演示数据：身份映射见 schema-patch-farm-identity.sql')
ON DUPLICATE KEY UPDATE
    platform_farm_id = VALUES(platform_farm_id),
    farm_name = VALUES(farm_name);
