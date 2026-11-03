-- ------------------------------------------------ 主体 2001 · 联调数据
--
-- 用途：让企业端（绿源农业合作社，core merchantId=2001）的组织 / 成员 / 部门岗位 /
--       品类 / 商品 / 客商 / 关系页面有可核对的数据。
--
-- 口径：
--   1. 本文件只写 tenant_id = '2001' 的数据，不碰演示租户 T1001 与其它主体；
--   2. 主键统一用 9200000000000001xx 段，便于识别与清理；
--   3. 全部 INSERT ... ON DUPLICATE KEY UPDATE 空操作，重复执行不会产生脏数据；
--   4. 成员账号是「主数据档案」不是登录账号：password 写 '!'（非 bcrypt），
--      任何登录尝试都会失败 —— 这些记录本来就不用于登录；
--   5. 不造操作日志：审计流水应由真实写操作产生，seed 里造假日志会污染审计。
--
-- 执行：
--   mysql -uroot -proot agri_masterdata < agri-master-data/db/2026-10-30-tenant-2001-seed.sql

SET NAMES utf8mb4;

-- ------------------------------ 组织（5） ------------------------------
INSERT INTO agri_md_organization
  (id, org_code, org_name, org_type, parent_id, ancestors, org_level, org_path,
   contact_person, contact_phone, province, city, district, address,
   status, del_flag, tenant_id, create_time, create_by, auth_status)
VALUES
  (920000000000000101, 'ORG2001-001', '绿源农业集团',            'ENTERPRISE',  0,                  '0',       1, '/2001/101', '王建国', '13800001101', '黑龙江省', '哈尔滨市', '道里区', '哈尔滨市道里区群力大道 1 号', 1, 0, '2001', NOW(), 'seed', 'VERIFIED'),
  (920000000000000102, 'ORG2001-002', '绿源粮油加工子公司',      'ENTERPRISE',  920000000000000101, '0,101',   2, '/2001/101/102', '周敏', '13800001102', '黑龙江省', '哈尔滨市', '香坊区', '哈尔滨市香坊区红旗大街 88 号', 1, 0, '2001', NOW(), 'seed', 'VERIFIED'),
  (920000000000000103, 'ORG2001-003', '肇东有机水稻种植合作社',  'COOPERATIVE', 920000000000000101, '0,101',   2, '/2001/101/103', '陈伟', '13800001103', '黑龙江省', '绥化市', '肇东市', '肇东市五站镇', 1, 0, '2001', NOW(), 'seed', 'VERIFIED'),
  (920000000000000104, 'ORG2001-004', '五常第一家庭农场',        'FARM',        920000000000000103, '0,101,103', 3, '/2001/101/103/104', '刘洋', '13800001104', '黑龙江省', '哈尔滨市', '五常市', '五常市民乐乡', 1, 0, '2001', NOW(), 'seed', 'PENDING'),
  (920000000000000105, 'ORG2001-005', '绿源冷链物流有限公司',    'ENTERPRISE',  920000000000000101, '0,101',   2, '/2001/101/105', '孙丽', '13800001105', '黑龙江省', '哈尔滨市', '松北区', '哈尔滨市松北区科技一路 6 号', 1, 0, '2001', NOW(), 'seed', 'VERIFIED')
ON DUPLICATE KEY UPDATE id = id;

-- ------------------------------ 部门（3） ------------------------------
INSERT INTO agri_md_department
  (id, dept_id, dept_code, dept_name, parent_dept_id, org_id,
   dept_manager, contact_phone, dept_count, status, del_flag, tenant_id, create_time, create_by)
VALUES
  (920000000000000201, 'DEPT-2001-01', 'DEPT2001-01', '综合管理部',   NULL,              920000000000000101, '王建国', '13800001101', 12, 1, 0, '2001', NOW(), 'seed'),
  (920000000000000202, 'DEPT-2001-02', 'DEPT2001-02', '生产管理中心', 'DEPT-2001-01',    920000000000000101, '陈伟',   '13800001103', 26, 1, 0, '2001', NOW(), 'seed'),
  (920000000000000203, 'DEPT-2001-03', 'DEPT2001-03', '市场营销中心', 'DEPT-2001-01',    920000000000000101, '周敏',   '13800001102', 21, 1, 0, '2001', NOW(), 'seed')
ON DUPLICATE KEY UPDATE id = id;

-- ------------------------------ 岗位（4） ------------------------------
INSERT INTO agri_md_position
  (id, position_id, position_code, pos_code, position_name, pos_name, dept_id,
   position_level, pos_level, position_desc, incumbent_count, status, del_flag, tenant_id, create_time, create_by)
VALUES
  (920000000000000301, 'POS-2001-01', 'POS-P-01', 'POS-P-01', '综合主管',   '综合主管',   920000000000000201, 3, 'M3', '统筹行政、人事与 IT 支持', 1, 1, 0, '2001', NOW(), 'seed'),
  (920000000000000302, 'POS-2001-02', 'POS-P-02', 'POS-P-02', '生产经理',   '生产经理',   920000000000000202, 2, 'M2', '负责种植计划与品控',       1, 1, 0, '2001', NOW(), 'seed'),
  (920000000000000303, 'POS-2001-03', 'POS-P-03', 'POS-P-03', '质检员',     '质检员',     920000000000000202, 5, 'P5', '来料与成品检验',           2, 1, 0, '2001', NOW(), 'seed'),
  (920000000000000304, 'POS-2001-04', 'POS-P-04', 'POS-P-04', '销售代表',   '销售代表',   920000000000000203, 6, 'P3', '客户跟进与订单执行',       3, 1, 0, '2001', NOW(), 'seed')
ON DUPLICATE KEY UPDATE id = id;

-- ------------------------------ 角色（2，本主体自定义） ------------------------------
INSERT INTO agri_md_role
  (id, role_code, role_name, role_key, role_type, role_level, data_scope, status, is_system, del_flag, tenant_id, sort_order, create_time, create_by)
VALUES
  (920000000000000501, 'COOP_ADMIN_2001', '合作社社长', 'coop_admin', 'business', 20, 'TENANT', 1, 0, 0, '2001', 1, NOW(), 'seed'),
  (920000000000000502, 'PROD_ADMIN_2001', '生产管理员', 'prod_admin', 'business', 10, 'ORG',    1, 0, 0, '2001', 2, NOW(), 'seed')
ON DUPLICATE KEY UPDATE id = id;

-- ------------------------------ 成员（5，仅主数据档案） ------------------------------
INSERT INTO agri_md_user
  (id, user_code, username, password, real_name, nick_name, phone, email,
   user_type, org_id, user_status, real_name_status, status, del_flag, tenant_id, create_time, create_by)
VALUES
  (920000000000000401, 'USR2001001', 'seed_2001_wang', '!', '王建国', '王社长', '13800001101', 'wang@lvyuan2001.example', 'employee', 920000000000000101, 'active', 'verified', 1, 0, '2001', NOW(), 'seed'),
  (920000000000000402, 'USR2001002', 'seed_2001_zhou', '!', '周敏',   '周经理', '13800001102', 'zhou@lvyuan2001.example', 'employee', 920000000000000101, 'active', 'verified', 1, 0, '2001', NOW(), 'seed'),
  (920000000000000403, 'USR2001003', 'seed_2001_chen', '!', '陈伟',   '老陈',   '13800001103', 'chen@lvyuan2001.example', 'employee', 920000000000000103, 'active', 'verified', 1, 0, '2001', NOW(), 'seed'),
  (920000000000000404, 'USR2001004', 'seed_2001_liu',  '!', '刘洋',   '小刘',   '13800001104', 'liu@lvyuan2001.example',  'employee', 920000000000000104, 'active', 'pending',  1, 0, '2001', NOW(), 'seed'),
  (920000000000000405, 'USR2001005', 'seed_2001_sun',  '!', '孙丽',   '孙丽',   '13800001105', 'sun@lvyuan2001.example',  'employee', 920000000000000105, 'active', 'draft',    0, 0, '2001', NOW(), 'seed')
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO agri_md_user_role (id, user_id, role_id, status, del_flag, tenant_id, create_time)
VALUES
  (920000000000000601, 920000000000000401, 920000000000000501, 1, 0, '2001', NOW()),
  (920000000000000602, 920000000000000402, 920000000000000501, 1, 0, '2001', NOW()),
  (920000000000000603, 920000000000000403, 920000000000000502, 1, 0, '2001', NOW()),
  (920000000000000604, 920000000000000404, 920000000000000502, 1, 0, '2001', NOW())
ON DUPLICATE KEY UPDATE id = id;

-- ------------------------------ 品类（3，本主体自定义） ------------------------------
INSERT INTO agri_md_product_category
  (id, category_code, category_name, parent_id, category_level, sort_order, order_num, icon,
   status, del_flag, tenant_id, create_time, create_by, ancestors)
VALUES
  (920000000000000701, 'CAT-2001-01', '绿源礼盒系列', 0, 1, 1, 1, '🎁', 1, 0, '2001', NOW(), 'seed', '0'),
  (920000000000000702, 'CAT-2001-02', '有机杂粮',     0, 1, 2, 2, '🌾', 1, 0, '2001', NOW(), 'seed', '0'),
  (920000000000000703, 'CAT-2001-03', '鲜果',         0, 1, 3, 3, '🍎', 1, 0, '2001', NOW(), 'seed', '0')
ON DUPLICATE KEY UPDATE id = id;

-- ------------------------------ 商品 SPU（3） ------------------------------
INSERT INTO agri_md_product
  (id, product_code, product_name, category_id, brand, unit, price, status, audit_status,
   origin, spec_json, description, del_flag, tenant_id, create_time, create_by)
VALUES
  (920000000000000801, 'SPU2001-001', '五常有机稻花香大米', 920000000000000702, '绿源', '袋', 128.0000, 1, 'APPROVED', '黑龙江省五常市', '{"weight":"5kg"}', '五常核心产区，当季新米', 0, '2001', NOW(), 'seed'),
  (920000000000000802, 'SPU2001-002', '中秋杂粮礼盒',       920000000000000701, '绿源', '盒', 168.0000, 0, 'PENDING',  '黑龙江省哈尔滨市', '{"items":"6"}', '六格杂粮礼盒，待审核', 0, '2001', NOW(), 'seed'),
  (920000000000000803, 'SPU2001-003', '烟台红富士苹果',     920000000000000703, '绿源', '箱',  98.0000, 1, 'APPROVED', '山东省烟台市', '{"weight":"10kg"}', '一级果，脆甜', 0, '2001', NOW(), 'seed')
ON DUPLICATE KEY UPDATE id = id;

-- ------------------------------ 客户（3） ------------------------------
INSERT INTO agri_md_customer
  (id, customer_code, customer_name, customer_type, level, credit_code, contact_name, contact_phone,
   address, status, del_flag, tenant_id, create_time, create_by)
VALUES
  (920000000000000901, 'CUS2001-001', '沈阳绿源农产品有限公司', 'enterprise', 'A', '91210100MA2001001X', '刘伟', '13900001101', '沈阳市于洪区物流大道 1 号', 1, 0, '2001', NOW(), 'seed'),
  (920000000000000902, 'CUS2001-002', '北京丰盛粮油连锁商超',   'enterprise', 'A', '91110100MA2001002X', '张丽', '13900001102', '北京市丰台区南三环 8 号',   1, 0, '2001', NOW(), 'seed'),
  (920000000000000903, 'CUS2001-003', '哈尔滨中央城农贸市场',   'enterprise', 'C', '91230100MA2001003X', '孙姐', '13900001103', '哈尔滨市南岗区中央大街 66 号', 0, 0, '2001', NOW(), 'seed')
ON DUPLICATE KEY UPDATE id = id;

-- ------------------------------ 供应商（2） ------------------------------
INSERT INTO agri_md_supplier
  (id, supplier_code, supplier_name, supplier_type, level, credit_code, contact_person, contact_phone,
   address, status, del_flag, tenant_id, create_time, create_by)
VALUES
  (920000000000001001, 'SUP2001-001', '五常市民乐乡水稻种植合作社', 'manufacturer', 'A', '91230184MA2001001X', '赵国庆', '13900002201', '五常市民乐乡', 1, 0, '2001', NOW(), 'seed'),
  (920000000000001002, 'SUP2001-002', '山东寿光绿野蔬菜合作社',     'dealer',       'B', '91370783MA2001002X', '李春梅', '13900002202', '寿光市稻田镇', 1, 0, '2001', NOW(), 'seed')
ON DUPLICATE KEY UPDATE id = id;

-- ------------------------------ 客商关系（2） ------------------------------
INSERT INTO agri_md_customer_supplier_relation
  (id, relation_id, customer_id, supplier_id, relation_type, cooperation_level,
   transaction_count, total_amount, status, del_flag, tenant_id, create_time, create_by)
VALUES
  (920000000000001101, 'REL-2001-01', 920000000000000901, 920000000000001001, 'LONG_TERM', 'A', 128, 4862000.00, 1, 0, '2001', NOW(), 'seed'),
  (920000000000001102, 'REL-2001-02', 920000000000000902, 920000000000001002, 'NORMAL',    'B',  64, 1628000.00, 1, 0, '2001', NOW(), 'seed')
ON DUPLICATE KEY UPDATE id = id;
