-- 主数据管理模块：本地演示数据（2026-10-12）
--
-- 用途：让已接后台的列表页有内容可看。此前库里只有 3 行（1 租户 / 1 用户 / 1 角色），
-- 页面即使全部接通也只会显示空表 —— 空表看不出"接对了没有"，也验不出分页、筛选、列绑定。
--
-- 三条纪律：
--   1. **不挂进应用启动路径**。生产环境不应该因为启动就被塞进演示数据，
--      所以这是一份需要手工执行的脚本（`db/` 目录下），而不是加入 spring.sql.init。
--   2. **可重复执行**。显式指定 1001 起的 id + INSERT IGNORE：
--      主键冲突时静默跳过，重复执行不会长出第二份。
--   3. **可整体清除**。所有演示行的 id 都落在 1000～2399（含 2001 起的供应商/关系/认证/配额），
--      见文件末尾的清理语句。清理语句一律用 BETWEEN 1000 AND 2999，
--      范围留宽一点是为了"以后再加演示表也不会漏删"，代价只是多扫几行。
--
-- 状态口径按已统一的 StatusEnum：status = 1 表示启用，0 表示禁用；del_flag = 0 表示未删除。
--
-- **tenant_id 的两种写法（请勿混用）**：
--   * 除配额表外，各业务表的 `tenant_id` 存的是**租户编码**（如 'T1001'）。
--     这是库内既有约定——种子 admin 的 tenant_id 就是租户编码 'TENANT001'。
--   * `agri_md_tenant_quota.tenant_id` 存的是**租户主键的字符串形式**（如 '1001'），
--     因为 AdminTenantServiceImpl#getTenantQuota 就是用 `id.toString()` 去找配额的。
--   一开始我按主键填了业务表，结果总览的"租户活跃度"里每个租户都算成 0 个用户 ——
--   统计条件拿租户编码去比用户表的 tenant_id，两边写法不同自然一条都对不上。
--
-- 说明：密码列沿用与内置 admin 相同的一段 bcrypt 串，仅用于本地演示登录，
-- 不代表任何真实口令；生产不允许出现演示账号。

-- ---------------------------------------------------------------------------
-- 租户（10 个）
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `agri_md_tenant`
  (`id`,`tenant_code`,`tenant_name`,`tenant_type`,`contact_name`,`contact_person`,`contact_phone`,`email`,
   `province`,`city`,`district`,`address`,`status`,`del_flag`,`expire_time`,`max_users`,`create_time`,`create_by`,`remark`)
VALUES
  (1001,'T1001','阳光农业集团','ENTERPRISE','张建国','张建国','13800001001','contact@sunny-agri.example','山东省','济南市','历下区','济南市历下区经十路 100 号',1,0,'2027-12-31 23:59:59',500,'2025-03-01 09:12:00','system','示范数据'),
  (1002,'T1002','绿野生态科技','ENTERPRISE','李文博','李文博','13800001002','contact@luye.example','河南省','郑州市','金水区','郑州市金水区农业路 88 号',1,0,'2027-06-30 23:59:59',300,'2025-03-04 10:20:00','system','示范数据'),
  (1003,'T1003','丰收供应链','ENTERPRISE','王海燕','王海燕','13800001003','contact@fengshou.example','广东省','广州市','天河区','广州市天河区珠江新城 5 号',1,0,'2027-09-30 23:59:59',200,'2025-03-08 14:05:00','system','示范数据'),
  (1004,'T1004','农资经销联合体','ENTERPRISE','赵德胜','赵德胜','13800001004','contact@nzjt.example','河北省','石家庄市','裕华区','石家庄市裕华区体育大街 22 号',1,0,'2027-03-31 23:59:59',120,'2025-03-12 11:30:00','system','示范数据'),
  (1005,'T1005','川西高原果蔬合作社','COOPERATIVE','陈美玲','陈美玲','13800001005','contact@chuanxi.example','四川省','成都市','武侯区','成都市武侯区人民南路 66 号',1,0,'2028-01-31 23:59:59',80,'2025-03-15 16:40:00','system','示范数据'),
  (1006,'T1006','江南水产养殖公司','ENTERPRISE','周立新','周立新','13800001006','contact@jiangnan.example','江苏省','南京市','鼓楼区','南京市鼓楼区中山北路 9 号',1,0,'2027-08-31 23:59:59',150,'2025-03-19 08:50:00','system','示范数据'),
  (1007,'T1007','西北牧业发展','ENTERPRISE','马俊峰','马俊峰','13800001007','contact@xibei.example','陕西省','西安市','雁塔区','西安市雁塔区科技路 18 号',1,0,'2027-05-31 23:59:59',90,'2025-03-22 13:15:00','system','示范数据'),
  (1008,'T1008','岭南果业合作社','COOPERATIVE','黄志强','黄志强','13800001008','contact@lingnan.example','广东省','茂名市','茂南区','茂名市茂南区果园路 3 号',1,0,'2027-11-30 23:59:59',60,'2025-03-26 15:25:00','system','示范数据'),
  (1009,'T1009','东北粮仓贸易','ENTERPRISE','孙丽华','孙丽华','13800001009','contact@dongbei.example','黑龙江省','哈尔滨市','南岗区','哈尔滨市南岗区西大直街 45 号',1,0,'2027-07-31 23:59:59',260,'2025-03-29 09:05:00','system','示范数据'),
  (1010,'T1010','云贵中药材种植','INDIVIDUAL','杨秀英','杨秀英','13800001010','contact@yungui.example','云南省','昆明市','盘龙区','昆明市盘龙区北京路 128 号',0,0,'2026-12-31 23:59:59',30,'2025-04-02 10:45:00','system','已停用，用于验证状态筛选');

-- ---------------------------------------------------------------------------
-- 组织（12 个，三层树）
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `agri_md_organization`
  (`id`,`org_code`,`org_name`,`org_type`,`parent_id`,`ancestors`,`org_level`,`org_path`,
   `legal_person`,`contact_person`,`contact_phone`,`contact_mobile`,`province`,`city`,`district`,`address`,
   `business_license`,`tax_no`,`member_count`,`org_status`,`auth_status`,`status`,`del_flag`,`tenant_id`,`create_time`,`create_by`,`remark`)
VALUES
  (1101,'ORG1001','阳光农业集团','ENTERPRISE',0,'0',1,'/ORG1001','张建国','张建国','0531-88880001','13800001001','山东省','济南市','历下区','济南市历下区经十路 100 号','91370100MA00000001','91370100MA000000X1',120,'ACTIVE','verified',1,0,'T1001','2025-03-01 09:15:00','system','示范数据'),
  (1102,'ORG1002','阳光种植事业部','ENTERPRISE',1101,'0,1101',2,'/ORG1001/ORG1002','李文博','李文博','0531-88880002','13800001002','山东省','济南市','历城区','济南市历城区荷花路 12 号','91370100MA00000002','91370100MA000000X2',46,'ACTIVE','verified',1,0,'T1001','2025-03-02 10:10:00','system','示范数据'),
  (1103,'ORG1003','阳光加工事业部','ENTERPRISE',1101,'0,1101',2,'/ORG1001/ORG1003','王海燕','王海燕','0531-88880003','13800001003','山东省','济南市','章丘区','济南市章丘区工业二路 8 号','91370100MA00000003','91370100MA000000X3',38,'ACTIVE','pending',1,0,'T1001','2025-03-03 11:25:00','system','示范数据'),
  (1104,'ORG1004','历城一号农场','FARM',1102,'0,1101,1102',3,'/ORG1001/ORG1002/ORG1004','陈美玲','陈美玲','0531-88880004','13800001004','山东省','济南市','历城区','济南市历城区唐王街道 1 号',NULL,'91370100MA000000X4',22,'ACTIVE','verified',1,0,'T1001','2025-03-05 09:40:00','system','示范数据'),
  (1105,'ORG1005','历城二号农场','FARM',1102,'0,1101,1102',3,'/ORG1001/ORG1002/ORG1005','赵德胜','赵德胜','0531-88880005','13800001005','山东省','济南市','历城区','济南市历城区董家街道 6 号',NULL,'91370100MA000000X5',18,'ACTIVE','unverified',1,0,'T1001','2025-03-06 14:20:00','system','示范数据'),
  (1106,'ORG1006','绿野生态科技','ENTERPRISE',0,'0',1,'/ORG1006','李文博','李文博','0371-66660001','13800001006','河南省','郑州市','金水区','郑州市金水区农业路 88 号','91410100MA00000006','91410100MA000000X6',76,'ACTIVE','verified',1,0,'T1002','2025-03-04 10:15:00','system','示范数据'),
  (1107,'ORG1007','绿野技术中心','DEPARTMENT',1106,'0,1106',2,'/ORG1006/ORG1007','周立新','周立新','0371-66660002','13800001007','河南省','郑州市','金水区','郑州市金水区农业路 90 号',NULL,'91410100MA000000X7',24,'ACTIVE','verified',1,0,'T1002','2025-03-07 15:35:00','system','示范数据'),
  (1108,'ORG1008','丰收供应链','ENTERPRISE',0,'0',1,'/ORG1008','王海燕','王海燕','020-33330001','13800001008','广东省','广州市','天河区','广州市天河区珠江新城 5 号','91440100MA00000008','91440100MA000000X8',54,'ACTIVE','verified',1,0,'T1003','2025-03-08 14:10:00','system','示范数据'),
  (1109,'ORG1009','川西高原果蔬合作社','COOPERATIVE',0,'0',1,'/ORG1009','陈美玲','陈美玲','028-77770001','13800001009','四川省','成都市','武侯区','成都市武侯区人民南路 66 号','91510100MA00000009','91510100MA000000X9',40,'ACTIVE','pending',1,0,'T1005','2025-03-15 16:45:00','system','示范数据'),
  (1110,'ORG1010','江南水产养殖公司','ENTERPRISE',0,'0',1,'/ORG1010','周立新','周立新','025-55550001','13800001010','江苏省','南京市','鼓楼区','南京市鼓楼区中山北路 9 号','91320100MA00000010','91320100MA000000X10',33,'ACTIVE','verified',1,0,'T1006','2025-03-19 08:55:00','system','示范数据'),
  (1111,'ORG1011','东北粮仓贸易','ENTERPRISE',0,'0',1,'/ORG1011','孙丽华','孙丽华','0451-22220001','13800001011','黑龙江省','哈尔滨市','南岗区','哈尔滨市南岗区西大直街 45 号','91230100MA00000011','91230100MA000000X11',61,'INACTIVE','unverified',0,0,'T1009','2025-03-29 09:10:00','system','已停用，用于验证状态列'),
  (1112,'ORG1012','云贵中药材种植','FARM',0,'0',1,'/ORG1012','杨秀英','杨秀英','0871-11110001','13800001012','云南省','昆明市','盘龙区','昆明市盘龙区北京路 128 号',NULL,'91530100MA000000X12',15,'ACTIVE','unverified',1,0,'T1010','2025-04-02 10:50:00','system','示范数据');

-- ---------------------------------------------------------------------------
-- 用户（12 个）。username / phone / email 都有唯一索引，务必保持唯一。
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `agri_md_user`
  (`id`,`user_code`,`username`,`password`,`real_name`,`nick_name`,`user_type`,`id_card_type`,`id_card_no`,
   `phone`,`email`,`gender`,`province`,`city`,`district`,`address`,`org_id`,`user_status`,`real_name_status`,
   `risk_level`,`credit_score`,`last_login_time`,`last_login_ip`,`login_count`,`status`,`del_flag`,`tenant_id`,`create_time`,`create_by`,`remark`)
VALUES
  (1201,'USER1001','zhangjianguo','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','张建国','建国','enterprise','identity_card','370102197801011234','13900001001','zhangjianguo@demo.example','male','山东省','济南市','历下区','济南市历下区经十路 100 号',1101,'active','verified','low',820,'2026-10-11 09:20:00','192.168.1.21',126,1,0,'T1001','2025-03-01 09:20:00','system','示范数据'),
  (1202,'USER1002','liwenbo','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','李文博','文博','enterprise','identity_card','410105198203041234','13900001002','liwenbo@demo.example','male','河南省','郑州市','金水区','郑州市金水区农业路 88 号',1106,'active','verified','low',790,'2026-10-11 10:05:00','192.168.1.22',98,1,0,'T1002','2025-03-04 10:25:00','system','示范数据'),
  (1203,'USER1003','wanghaiyan','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','王海燕','海燕','enterprise','identity_card','440106198609121234','13900001003','wanghaiyan@demo.example','female','广东省','广州市','天河区','广州市天河区珠江新城 5 号',1108,'active','verified','low',845,'2026-10-10 16:40:00','192.168.1.23',143,1,0,'T1003','2025-03-08 14:15:00','system','示范数据'),
  (1204,'USER1004','zhaodesheng','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','赵德胜','德胜','enterprise','business_license','130108197512251234','13900001004','zhaodesheng@demo.example','male','河北省','石家庄市','裕华区','石家庄市裕华区体育大街 22 号',1105,'active','pending','medium',640,NULL,NULL,0,1,0,'T1004','2025-03-12 11:35:00','system','认证审核中，用于验证审核页'),
  (1205,'USER1005','chenmeiling','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','陈美玲','美玲','individual','identity_card','510107199003171234','13900001005','chenmeiling@demo.example','female','四川省','成都市','武侯区','成都市武侯区人民南路 66 号',1109,'active','pending','low',705,'2026-10-09 08:30:00','192.168.1.25',52,1,0,'T1005','2025-03-15 16:50:00','system','认证审核中，用于验证审核页'),
  (1206,'USER1006','zhoulinxin','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','周立新','立新','enterprise','identity_card','320106198712081234','13900001006','zhoulinxin@demo.example','male','江苏省','南京市','鼓楼区','南京市鼓楼区中山北路 9 号',1110,'active','verified','low',812,'2026-10-11 11:15:00','192.168.1.26',110,1,0,'T1006','2025-03-19 09:00:00','system','示范数据'),
  (1207,'USER1007','majunfeng','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','马俊峰','俊峰','enterprise','business_license','610113198009201234','13900001007','majunfeng@demo.example','male','陕西省','西安市','雁塔区','西安市雁塔区科技路 18 号',NULL,'inactive','unverified','medium',560,'2026-08-02 09:45:00','192.168.1.27',31,0,0,'T1007','2025-03-22 13:20:00','system','已停用，用于验证状态列'),
  (1208,'USER1008','huangzhiqiang','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','黄志强','志强','enterprise','identity_card','440902198805051234','13900001008','huangzhiqiang@demo.example','male','广东省','茂名市','茂南区','茂名市茂南区果园路 3 号',NULL,'active','verified','low',768,'2026-10-08 14:20:00','192.168.1.28',87,1,0,'T1008','2025-03-26 15:30:00','system','示范数据'),
  (1209,'USER1009','sunlihua','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','孙丽华','丽华','enterprise','business_license','230103198511111234','13900001009','sunlihua@demo.example','female','黑龙江省','哈尔滨市','南岗区','哈尔滨市南岗区西大直街 45 号',NULL,'active','pending','low',733,'2026-10-07 10:35:00','192.168.1.29',64,1,0,'T1009','2025-03-29 09:15:00','system','认证审核中，用于验证审核页'),
  (1210,'USER1010','yangxiuying','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','杨秀英','秀英','individual','identity_card','530103199209091234','13900001010','yangxiuying@demo.example','female','云南省','昆明市','盘龙区','昆明市盘龙区北京路 128 号',1112,'active','pending','medium',598,NULL,NULL,0,1,0,'T1010','2025-04-02 10:55:00','system','认证审核中，用于验证审核页'),
  (1211,'USER1011','lizhenhua','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','李振华','振华','individual','identity_card','320102199501011234','13900001011','lizhenhua@demo.example','male','江苏省','南京市','玄武区','南京市玄武区中央路 77 号',NULL,'active','unverified','low',610,'2026-09-30 17:05:00','192.168.1.31',12,1,0,'T1006','2025-04-06 09:30:00','system','示范数据'),
  (1212,'USER1012','qiandefu','$2a$10$N9qo8uLOickgx2ZMRZoMye.IjzqAKL9xL5jvMFVdNJHvGCgTq/VEq','钱德富','德富','individual','identity_card','330102198804041234','13900001012','qiandefu@demo.example','male','浙江省','杭州市','西湖区','杭州市西湖区文三路 210 号',NULL,'active','unverified','low',587,'2026-09-26 15:50:00','192.168.1.32',9,1,0,'T1003','2025-04-09 11:05:00','system','示范数据');

-- ---------------------------------------------------------------------------
-- 角色（6 个）
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `agri_md_role`
  (`id`,`role_code`,`role_name`,`role_key`,`role_type`,`description`,`role_level`,`data_scope`,`sort_order`,`status`,`del_flag`,`tenant_id`,`create_time`,`create_by`,`remark`)
VALUES
  (1301,'PLATFORM_ADMIN','平台管理员','platformAdmin','system','平台侧最高权限，可管理全部租户',1,'ALL',1,1,0,'T1001','2025-03-01 09:30:00','system','示范数据'),
  (1302,'TENANT_ADMIN','租户管理员','tenantAdmin','system','租户内最高权限',2,'TENANT',2,1,0,'T1001','2025-03-01 09:31:00','system','示范数据'),
  (1303,'DATA_AUDITOR','数据审核员','dataAuditor','custom','主数据审核与质量处置',3,'TENANT',3,1,0,'T1001','2025-03-02 10:05:00','system','示范数据'),
  (1304,'ORG_MANAGER','组织管理员','orgManager','custom','组织与部门维护',3,'ORG',4,1,0,'T1002','2025-03-04 10:35:00','system','示范数据'),
  (1305,'READONLY','只读账号','readonly','custom','仅可查询，用于对外协作',4,'OWNER',5,1,0,'T1003','2025-03-08 14:25:00','system','示范数据'),
  (1306,'TEMP_OPS','临时运营','tempOps','custom','活动期临时权限，已停用',4,'OWNER',6,0,0,'T1001','2025-03-10 09:00:00','system','已停用，用于验证状态列');

INSERT IGNORE INTO `agri_md_user_role` (`id`,`user_id`,`role_id`,`status`,`del_flag`,`tenant_id`,`create_time`,`create_by`)
VALUES
  (1401,1201,1302,1,0,'T1001','2025-03-01 09:35:00','system'),
  (1402,1202,1302,1,0,'T1002','2025-03-04 10:40:00','system'),
  (1403,1203,1302,1,0,'T1003','2025-03-08 14:30:00','system'),
  (1404,1204,1304,1,0,'T1004','2025-03-12 11:40:00','system'),
  (1405,1205,1305,1,0,'T1005','2025-03-15 16:55:00','system'),
  (1406,1206,1302,1,0,'T1006','2025-03-19 09:05:00','system');

-- ---------------------------------------------------------------------------
-- 数据字典（6 个字典 + 18 个字典项）
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `agri_md_dict`
  (`id`,`dict_code`,`dict_name`,`dict_type`,`description`,`status`,`del_flag`,`tenant_id`,`create_time`,`create_by`,`remark`)
VALUES
  (1501,'TENANT_TYPE','租户类型','base','平台租户的类别',1,0,'T1001','2025-03-01 09:40:00','system','示范数据'),
  (1502,'ORG_TYPE','组织类型','base','组织主数据的类别',1,0,'T1001','2025-03-01 09:41:00','system','示范数据'),
  (1503,'USER_TYPE','用户类型','base','个人 / 企业',1,0,'T1001','2025-03-01 09:42:00','system','示范数据'),
  (1504,'PRODUCT_UNIT','计量单位','base','商品计量单位',1,0,'T1001','2025-03-01 09:43:00','system','示范数据'),
  (1505,'AUTH_STATUS','认证状态','base','实名与资质认证状态',1,0,'T1001','2025-03-01 09:44:00','system','示范数据'),
  (1506,'RISK_LEVEL','风险等级','base','主体风险等级',0,0,'T1001','2025-03-01 09:45:00','system','已停用，用于验证状态列');

INSERT IGNORE INTO `agri_md_dict_item`
  (`id`,`dict_id`,`dict_code`,`item_code`,`item_name`,`item_text`,`item_value`,`item_label`,`item_sort`,`status`,`del_flag`,`tenant_id`,`create_time`,`create_by`)
VALUES
  (1601,1501,'TENANT_TYPE','ENTERPRISE','企业','企业','ENTERPRISE','企业',1,1,0,'T1001','2025-03-01 09:40:10','system'),
  (1602,1501,'TENANT_TYPE','COOPERATIVE','合作社','合作社','COOPERATIVE','合作社',2,1,0,'T1001','2025-03-01 09:40:11','system'),
  (1603,1501,'TENANT_TYPE','INDIVIDUAL','个体经营','个体经营','INDIVIDUAL','个体经营',3,1,0,'T1001','2025-03-01 09:40:12','system'),
  (1604,1502,'ORG_TYPE','ENTERPRISE','企业','企业','ENTERPRISE','企业',1,1,0,'T1001','2025-03-01 09:41:10','system'),
  (1605,1502,'ORG_TYPE','COOPERATIVE','合作社','合作社','COOPERATIVE','合作社',2,1,0,'T1001','2025-03-01 09:41:11','system'),
  (1606,1502,'ORG_TYPE','FARM','农场','农场','FARM','农场',3,1,0,'T1001','2025-03-01 09:41:12','system'),
  (1607,1502,'ORG_TYPE','DEPARTMENT','部门','部门','DEPARTMENT','部门',4,1,0,'T1001','2025-03-01 09:41:13','system'),
  (1608,1503,'USER_TYPE','enterprise','企业用户','企业用户','enterprise','企业用户',1,1,0,'T1001','2025-03-01 09:42:10','system'),
  (1609,1503,'USER_TYPE','individual','个人用户','个人用户','individual','个人用户',2,1,0,'T1001','2025-03-01 09:42:11','system'),
  (1610,1504,'PRODUCT_UNIT','kg','千克','千克','kg','千克',1,1,0,'T1001','2025-03-01 09:43:10','system'),
  (1611,1504,'PRODUCT_UNIT','ton','吨','吨','ton','吨',2,1,0,'T1001','2025-03-01 09:43:11','system'),
  (1612,1504,'PRODUCT_UNIT','box','箱','箱','box','箱',3,1,0,'T1001','2025-03-01 09:43:12','system'),
  (1613,1504,'PRODUCT_UNIT','bag','袋','袋','bag','袋',4,1,0,'T1001','2025-03-01 09:43:13','system'),
  (1614,1505,'AUTH_STATUS','unverified','未认证','未认证','unverified','未认证',1,1,0,'T1001','2025-03-01 09:44:10','system'),
  (1615,1505,'AUTH_STATUS','pending','审核中','审核中','pending','审核中',2,1,0,'T1001','2025-03-01 09:44:11','system'),
  (1616,1505,'AUTH_STATUS','verified','已认证','已认证','verified','已认证',3,1,0,'T1001','2025-03-01 09:44:12','system'),
  (1617,1505,'AUTH_STATUS','rejected','已驳回','已驳回','rejected','已驳回',4,1,0,'T1001','2025-03-01 09:44:13','system'),
  (1618,1506,'RISK_LEVEL','low','低','低','low','低',1,0,0,'T1001','2025-03-01 09:45:10','system');

-- ---------------------------------------------------------------------------
-- 商品分类（6 个）与商品（12 个）
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `agri_md_product_category`
  (`id`,`category_code`,`category_name`,`parent_id`,`category_level`,`sort_order`,`ancestors`,`order_num`,`icon`,`status`,`del_flag`,`tenant_id`,`create_time`,`create_by`,`remark`)
VALUES
  (1701,'CAT-AGR','农产品',0,1,1,'0',1,'🌾',1,0,'T1001','2025-03-01 09:50:00','system','示范数据'),
  (1702,'CAT-AGR-GRAIN','粮食作物',1701,2,2,'0,1701',1,'🌽',1,0,'T1001','2025-03-01 09:50:10','system','示范数据'),
  (1703,'CAT-AGR-FRUIT','水果',1701,2,3,'0,1701',2,'🍎',1,0,'T1001','2025-03-01 09:50:20','system','示范数据'),
  (1704,'CAT-AGR-VEG','蔬菜',1701,2,4,'0,1701',3,'🥬',1,0,'T1001','2025-03-01 09:50:30','system','示范数据'),
  (1705,'CAT-MAT','农业生产资料',0,1,5,'0',2,'🧪',1,0,'T1001','2025-03-01 09:50:40','system','示范数据'),
  (1706,'CAT-PRO','加工食品',0,1,6,'0',3,'🥫',1,0,'T1001','2025-03-01 09:50:50','system','示范数据');

INSERT IGNORE INTO `agri_md_product`
  (`id`,`product_code`,`product_name`,`category_id`,`category_path`,`brand`,`spec`,`spec_json`,`unit`,`origin`,
   `price`,`min_order_qty`,`description`,`image_urls`,`audit_status`,`status`,`del_flag`,`tenant_id`,`create_time`,`create_by`,`remark`)
VALUES
  (1801,'P1001','章丘大葱','1704','/农产品/蔬菜','阳光农场','5kg/箱','{"weight":"5kg","grade":"一级"}','box','山东省济南市章丘区',36.00,10,'当日采摘直发','[]','APPROVED',1,0,'T1001','2025-03-05 10:00:00','system','示范数据'),
  (1802,'P1002','金乡大蒜','1704','/农产品/蔬菜','阳光农场','10kg/袋','{"weight":"10kg"}','bag','山东省济宁市金乡县',52.00,20,'冷库储存','[]','APPROVED',1,0,'T1001','2025-03-05 10:05:00','system','示范数据'),
  (1803,'P1003','五常大米','1702','/农产品/粮食作物','东北粮仓','25kg/袋','{"weight":"25kg","polish":"精磨"}','bag','黑龙江省五常市',188.00,5,'当季新米','[]','APPROVED',1,0,'T1009','2025-03-30 09:30:00','system','示范数据'),
  (1804,'P1004','烟台苹果','1703','/农产品/水果','绿野生态','20kg/箱','{"weight":"20kg","grade":"一级"}','box','山东省烟台市栖霞市',96.00,10,'冷库分选','[]','APPROVED',1,0,'T1002','2025-03-06 10:30:00','system','示范数据'),
  (1805,'P1005','赣南脐橙','1703','/农产品/水果','丰收供应链','10kg/箱','{"weight":"10kg"}','box','江西省赣州市',78.00,10,'产地直发','[]','APPROVED',1,0,'T1003','2025-03-09 11:00:00','system','示范数据'),
  (1806,'P1006','茂名荔枝','1703','/农产品/水果','岭南果业','5kg/箱','{"weight":"5kg","variety":"妃子笑"}','box','广东省茂名市',128.00,10,'冷链直发','[]','APPROVED',1,0,'T1008','2025-03-27 15:40:00','system','示范数据'),
  (1807,'P1007','川西猕猴桃','1703','/农产品/水果','川西合作社','5kg/箱','{"weight":"5kg"}','box','四川省成都市蒲江县',88.00,10,'示范数据','[]','APPROVED',1,0,'T1005','2025-03-16 09:20:00','system','示范数据'),
  (1808,'P1008','有机复合肥','1705','/农业生产资料','农资经销','25kg/袋','{"weight":"25kg","formula":"15-15-15"}','bag','河北省石家庄市',135.00,20,'通用型','[]','APPROVED',1,0,'T1004','2025-03-13 09:40:00','system','示范数据'),
  (1809,'P1009','生物有机肥','1705','/农业生产资料','绿野生态','20kg/袋','{"weight":"20kg"}','bag','河南省郑州市',98.00,20,'示范数据','[]','APPROVED',1,0,'T1002','2025-03-06 14:20:00','system','示范数据'),
  (1810,'P1010','果园专用剪','1705','/农业生产资料','农资经销','单把','{"length":"210mm"}','box','河北省石家庄市',45.00,50,'示范数据','[]','PENDING',1,0,'T1004','2025-03-13 10:10:00','system','待审核，用于验证审核状态'),
  (1811,'P1011','冷水鱼初加工','1706','/加工食品','江南水产','2kg/袋','{"weight":"2kg","process":"低温锁鲜"}','bag','江苏省南京市',156.00,5,'示范数据','[]','APPROVED',1,0,'T1006','2025-03-20 09:15:00','system','示范数据'),
  (1812,'P1012','高原藜麦','1702','/农产品/粮食作物','云贵中药材','5kg/袋','{"weight":"5kg"}','bag','云南省昆明市',110.00,10,'示范数据','[]','APPROVED',0,0,'T1010','2025-04-03 10:25:00','system','已停用，用于验证状态列');

-- ---------------------------------------------------------------------------
-- 客户（8 个）与供应商（6 个）
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `agri_md_customer`
  (`id`,`customer_code`,`customer_name`,`short_name`,`customer_type`,`org_id`,`credit_code`,`legal_person`,
   `contact_name`,`contact_phone`,`address`,`level`,`status`,`del_flag`,`tenant_id`,`create_time`,`create_by`,`remark`)
VALUES
  (1901,'C1001','华联超市连锁','华联超市','enterprise',NULL,'91370100MA10000001','刘伟','刘伟','13700001001','济南市历下区解放路 66 号','A',1,0,'T1001','2025-03-10 09:00:00','system','示范数据'),
  (1902,'C1002','惠民农贸市场','惠民市场','enterprise',NULL,'91370100MA10000002','张丽','张丽','13700001002','济南市市中区英雄山路 18 号','B',1,0,'T1001','2025-03-10 09:05:00','system','示范数据'),
  (1903,'C1003','郑州连锁餐饮集团','郑餐集团','enterprise',NULL,'91410100MA10000003','王强','王强','13700001003','郑州市金水区花园路 120 号','A',1,0,'T1002','2025-03-11 10:20:00','system','示范数据'),
  (1904,'C1004','广州生鲜电商','生鲜电商','enterprise',NULL,'91440100MA10000004','陈静','陈静','13700001004','广州市天河区体育东路 8 号','A',1,0,'T1003','2025-03-11 11:30:00','system','示范数据'),
  (1905,'C1005','成都社区团购','社区团购','enterprise',NULL,'91510100MA10000005','李娜','李娜','13700001005','成都市武侯区科华北路 33 号','B',1,0,'T1005','2025-03-20 09:40:00','system','示范数据'),
  (1906,'C1006','南京农副产品批发','南京批发','enterprise',NULL,'91320100MA10000006','周斌','周斌','13700001006','南京市建邺区江东中路 200 号','B',1,0,'T1006','2025-03-21 10:50:00','system','示范数据'),
  (1907,'C1007','哈尔滨粮油经销','哈尔滨粮油','enterprise',NULL,'91230100MA10000007','孙涛','孙涛','13700001007','哈尔滨市道里区友谊路 55 号','C',0,0,'T1009','2025-03-30 14:10:00','system','已停用，用于验证状态列'),
  (1908,'C1008','茂名果品贸易部','茂名果品','individual',NULL,NULL,'黄小燕','黄小燕','13700001008','茂名市茂南区人民路 12 号','C',1,0,'T1008','2025-03-27 16:00:00','system','示范数据');

INSERT IGNORE INTO `agri_md_supplier`
  (`id`,`supplier_code`,`supplier_name`,`short_name`,`supplier_type`,`org_id`,`credit_code`,`legal_person`,
   `contact_name`,`contact_person`,`contact_phone`,`address`,`level`,`qualification`,`supply_category`,
   `status`,`del_flag`,`tenant_id`,`create_time`,`create_by`,`remark`)
VALUES
  (2001,'S1001','河北农资制造厂','农资制造厂','manufacturer',NULL,'91130100MA10000001','赵德胜','赵德胜','赵德胜','13600001001','石家庄市裕华区体育大街 22 号','A','生产许可证 SC12345','化肥',
   1,0,'T1004','2025-03-13 08:50:00','system','示范数据'),
  (2002,'S1002','郑州生物肥厂','生物肥厂','manufacturer',NULL,'91410100MA10000002','李文博','李文博','李文博','13600001002','郑州市金水区农业路 88 号','A','生产许可证 SC67890','有机肥',
   1,0,'T1002','2025-03-07 09:30:00','system','示范数据'),
  (2003,'S1003','广州农资经销部','广州经销部','dealer',NULL,'91440100MA10000003','王海燕','王海燕','王海燕','13600001003','广州市天河区珠江新城 5 号','B','经营许可证 JY0001','农药',
   1,0,'T1003','2025-03-09 10:15:00','system','示范数据'),
  (2004,'S1004','济南农机代理商','农机代理','agent',NULL,'91370100MA10000004','张建国','张建国','张建国','13600001004','济南市历下区经十路 100 号','B','授权代理书 AG0002','农机具',
   1,0,'T1001','2025-03-02 11:00:00','system','示范数据'),
  (2005,'S1005','成都包装材料厂','包装材料厂','manufacturer',NULL,'91510100MA10000005','陈美玲','陈美玲','陈美玲','13600001005','成都市武侯区人民南路 66 号','C','生产许可证 SC24680','包装材料',
   1,0,'T1005','2025-03-17 14:25:00','system','示范数据'),
  (2006,'S1006','西安冷链物流','西安冷链','dealer',NULL,'91610100MA10000006','马俊峰','马俊峰','马俊峰','13600001006','西安市雁塔区科技路 18 号','C','道路运输经营许可证 YS0003','冷链服务',
   0,0,'T1007','2025-03-23 10:40:00','system','已停用，用于验证状态列');

INSERT IGNORE INTO `agri_md_customer_supplier_relation`
  (`id`,`relation_id`,`customer_id`,`supplier_id`,`relation_type`,`cooperation_level`,`start_date`,`end_date`,
   `transaction_count`,`total_amount`,`avg_unit_price`,`payment_status`,`dispute_count`,`status`,`del_flag`,`tenant_id`,`create_time`,`create_by`)
VALUES
  (2101,'REL1001',1901,2001,'purchase','A','2025-03-15 00:00:00',NULL,26,186000.00,135.00,'settled',0,1,0,'T1001','2025-03-15 09:00:00','system'),
  (2102,'REL1002',1903,2002,'purchase','A','2025-03-18 00:00:00',NULL,18,124800.00,98.00,'settled',0,1,0,'T1002','2025-03-18 09:00:00','system'),
  (2103,'REL1003',1904,2003,'purchase','B','2025-03-22 00:00:00',NULL,9,40500.00,45.00,'partial',1,1,0,'T1003','2025-03-22 09:00:00','system'),
  (2104,'REL1004',1906,2005,'purchase','B','2025-04-01 00:00:00',NULL,5,12000.00,24.00,'settled',0,1,0,'T1006','2025-04-01 09:00:00','system');

-- ---------------------------------------------------------------------------
-- 用户认证记录（5 条待审 + 2 条已通过）—— 让"待认证用户"与认证审核页有数据
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `agri_md_user_authentication`
  (`id`,`auth_id`,`user_id`,`auth_type`,`auth_status`,`auth_level`,`auth_data`,`auth_result`,
   `verified_by`,`verified_time`,`status`,`del_flag`,`tenant_id`,`create_time`,`create_by`,`remark`)
VALUES
  (2201,'AUTH2001','1204','enterprise','pending',2,'{"license":"130108197512251234"}',NULL,NULL,NULL,1,0,'T1004','2025-03-12 11:45:00','system','待审：企业资质'),
  (2202,'AUTH2002','1205','individual','pending',1,'{"idCard":"510107199003171234"}',NULL,NULL,NULL,1,0,'T1005','2025-03-15 17:00:00','system','待审：个人实名'),
  (2203,'AUTH2003','1209','enterprise','pending',2,'{"license":"230103198511111234"}',NULL,NULL,NULL,1,0,'T1009','2025-03-29 09:25:00','system','待审：企业资质'),
  (2204,'AUTH2004','1210','individual','pending',1,'{"idCard":"530103199209091234"}',NULL,NULL,NULL,1,0,'T1010','2025-04-02 11:05:00','system','待审：个人实名'),
  (2205,'AUTH2005','1211','individual','pending',1,'{"idCard":"320102199501011234"}',NULL,NULL,NULL,1,0,'T1006','2025-04-06 09:40:00','system','待审：个人实名'),
  (2206,'AUTH2006','1201','enterprise','approved',2,'{"license":"370102197801011234"}','pass','admin','2025-03-02 10:00:00',1,0,'T1001','2025-03-01 09:25:00','system','已通过'),
  (2207,'AUTH2007','1202','enterprise','approved',2,'{"license":"410105198203041234"}','pass','admin','2025-03-05 10:00:00',1,0,'T1002','2025-03-04 10:30:00','system','已通过');

-- ---------------------------------------------------------------------------
-- 编码规则（5 条）—— 对应运营端「数据标准 → 编码规则」页
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `agri_md_code_rule`
  (`id`,`rule_code`,`rule_name`,`rule_type`,`rule_pattern`,`description`,`seq_length`,`date_format`,`prefix`,`suffix`,
   `status`,`del_flag`,`tenant_id`,`create_time`,`create_by`,`remark`)
VALUES
  (2401,'RULE_PRODUCT','商品编码规则','auto','PRD{yyyyMMdd}{seq}','商品主数据编码，前缀 PRD + 日期 + 6 位序号',6,'yyyyMMdd','PRD',NULL,1,0,'T1001','2025-03-01 10:00:00','system','示范数据'),
  (2402,'RULE_TENANT','租户编码规则','auto','TEN{seq}','租户编码，前缀 TEN + 4 位序号',4,NULL,'TEN',NULL,1,0,'T1001','2025-03-01 10:01:00','system','示范数据'),
  (2403,'RULE_USER','用户编码规则','auto','USR{yyyyMM}{seq}','用户编码，前缀 USR + 年月 + 5 位序号',5,'yyyyMM','USR',NULL,1,0,'T1001','2025-03-01 10:02:00','system','示范数据'),
  (2404,'RULE_ORG','组织编码规则','auto','ORG{seq}','组织编码，前缀 ORG + 6 位序号',6,NULL,'ORG',NULL,1,0,'T1001','2025-03-01 10:03:00','system','示范数据'),
  (2405,'RULE_MANUAL','手工录入编码','manual','MANUAL','特殊场景由人工录入，不使用系统生成',0,NULL,NULL,NULL,0,0,'T1001','2025-03-01 10:04:00','system','已停用，用于验证状态列及筛选');

-- ---------------------------------------------------------------------------
-- 租户配额（每租户一条；tenant_id 存的是租户主键的字符串形式）
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `agri_md_tenant_quota`
  (`id`,`tenant_id`,`quota_type`,`user_limit`,`used_users`,`org_limit`,`used_orgs`,`product_limit`,`used_products`,
   `storage_limit`,`used_storage`,`api_limit`,`used_api`,`status`,`del_flag`,`create_time`,`create_by`,`remark`)
VALUES
  (2301,'1001','STANDARD',500,8,50,4,2000,12,10240,1200,1000000,86000,1,0,'2025-03-01 09:35:00','system','示范数据'),
  (2302,'1002','STANDARD',300,3,30,2,1200,4,5120,640,600000,32000,1,0,'2025-03-04 10:30:00','system','示范数据'),
  (2303,'1003','STANDARD',200,2,20,1,800,3,5120,320,400000,18000,1,0,'2025-03-08 14:20:00','system','示范数据'),
  (2304,'1004','BASIC',120,1,10,0,400,2,2560,160,200000,9000,1,0,'2025-03-12 11:40:00','system','示范数据'),
  (2305,'1005','BASIC',80,1,10,1,300,2,2560,120,150000,6400,1,0,'2025-03-15 16:55:00','system','示范数据'),
  (2306,'1006','STANDARD',150,2,15,1,600,1,5120,280,300000,12000,1,0,'2025-03-19 09:05:00','system','示范数据'),
  (2307,'1007','BASIC',90,1,10,0,300,0,2560,60,150000,3200,1,0,'2025-03-22 13:25:00','system','示范数据'),
  (2308,'1008','BASIC',60,1,10,1,200,1,2560,80,100000,2800,1,0,'2025-03-26 15:35:00','system','示范数据'),
  (2309,'1009','STANDARD',260,1,25,1,1000,1,5120,420,500000,21000,1,0,'2025-03-29 09:20:00','system','示范数据'),
  (2310,'1010','BASIC',30,1,5,1,100,1,1280,40,50000,1100,0,0,'2025-04-02 11:00:00','system','已停用，用于验证状态列');

-- ---------------------------------------------------------------------------
-- 清理演示数据（需要时手工执行）
-- ---------------------------------------------------------------------------
-- DELETE FROM `agri_md_tenant_quota`               WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_code_rule`                  WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_user_authentication`        WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_customer_supplier_relation` WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_supplier`                   WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_customer`                   WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_product`                    WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_product_category`           WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_dict_item`                  WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_dict`                       WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_user_role`                  WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_role`                       WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_user`                       WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_organization`               WHERE `id` BETWEEN 1000 AND 2999;
-- DELETE FROM `agri_md_tenant`                     WHERE `id` BETWEEN 1000 AND 2999;
