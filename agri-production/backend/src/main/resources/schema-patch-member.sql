-- 补丁：用户端「团队与人员」的演示数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-member.sql
--
-- 内容由平台库 agri_core.prod_member 的演示行机械转换而来（12 条）：
--   farm_id 由 DEMO-FARM-xxx 映射成本库农场主键、tenant_id 统一 2001，其余照抄。
-- 在职/离职分布：{"0":1,"1":11}（status 1 在职，其余按原值）。
-- 「角色与权限」页的"在职人数"就是按这一列的 role_code 聚合的，改演示数据会影响那一列。

INSERT IGNORE INTO agri_prod_member
    (member_id, tenant_id, farm_id, user_id, member_name, member_type, phone, role_code, post_name,
     join_date, status, create_time, update_time, deleted)
VALUES
    ('DEMO-MEM-001', '2001', '1', NULL, '陈志强', 'OWNER', '13900000001', 'FARM_OWNER', '农场负责人', '2022-03-01', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MEM-002', '2001', '1', NULL, '刘玉华', 'AGRONOMIST', '13900000102', 'AGRONOMIST', '农艺师', '2023-05-12', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MEM-003', '2001', '1', NULL, '黄大军', 'OPERATOR', '13900000103', 'OPERATOR', '田间操作工', '2024-01-08', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MEM-004', '2001', '2', NULL, '顾建平', 'OWNER', '13900000002', 'FARM_OWNER', '农场负责人', '2021-11-20', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MEM-005', '2001', '2', NULL, '吴有田', 'OPERATOR', '13900000105', 'OPERATOR', '农机手', '2023-09-15', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MEM-006', '2001', '3', NULL, '王秀兰', 'OWNER', '13900000003', 'FARM_OWNER', '农场负责人', '2020-06-10', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MEM-007', '2001', '3', NULL, '孙建国', 'INSPECTOR', '13900000107', 'INSPECTOR', '质量巡检员', '2024-02-26', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MEM-008', '2001', '4', NULL, '马占军', 'OWNER', '13900000004', 'FARM_OWNER', '牧场负责人', '2019-08-05', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MEM-009', '2001', '4', NULL, '妥建国', 'OPERATOR', '13900000109', 'OPERATOR', '饲养员', '2022-12-01', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MEM-010', '2001', '4', NULL, '杨兽医', 'INSPECTOR', '13900000110', 'INSPECTOR', '驻场兽医', '2023-04-18', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MEM-011', '2001', '5', NULL, '李道明', 'OWNER', '13900000005', 'FARM_OWNER', '农场负责人', '2021-03-22', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
    ('DEMO-MEM-012', '2001', '6', NULL, '赵文彬', 'OWNER', '13900000006', 'FARM_OWNER', '基地负责人', '2022-07-30', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);
