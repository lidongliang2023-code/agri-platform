-- 权限点目录（2026-10-30）
--
-- 为什么单独一个文件：schema.sql / data.sql 每次启动都会跑，这里只放"必须存在"的目录数据。
-- 目录内容与运营端真实导航一一对应（components/Layout.vue 的 9 组 / 43 个页面），
-- 不写不存在的页面，否则权限矩阵会出现一堆点不开的权限点。
--
-- 幂等靠 menu_code（表上有唯一键 uk_menu_code）：已存在的行不会被重复插入。
-- 固定 id 只是为了 parent_id 能写常量，与数据本身无关。

-- ============ 一级分组 ============
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000101,'MDM_G_OVERVIEW','运营总览',0,'M',NULL,1,1,1,1,0,NULL,NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_G_OVERVIEW');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000102,'MDM_G_SUBJECT','租户与配额',0,'M',NULL,2,2,1,1,0,NULL,NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_G_SUBJECT');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000103,'MDM_G_PERMISSION','组织与权限',0,'M',NULL,3,3,1,1,0,NULL,NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_G_PERMISSION');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000104,'MDM_G_PRODUCT','商品主数据',0,'M',NULL,4,4,1,1,0,NULL,NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_G_PRODUCT');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000105,'MDM_G_PARTNER','客商主数据',0,'M',NULL,5,5,1,1,0,NULL,NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_G_PARTNER');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000106,'MDM_G_STANDARD','数据标准',0,'M',NULL,6,6,1,1,0,NULL,NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_G_STANDARD');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000107,'MDM_G_GOVERN','数据治理',0,'M',NULL,7,7,1,1,0,NULL,NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_G_GOVERN');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000108,'MDM_G_SYSTEM','系统与审计',0,'M',NULL,8,8,1,1,0,NULL,NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_G_SYSTEM');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000109,'MDM_G_LINKED','关联系统（只读）',0,'M',NULL,9,9,1,1,0,NULL,NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_G_LINKED');

-- ============ 运营总览 ============
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000201,'MDM_DASHBOARD','运营大盘',930000000000000101,'C','/dashboard',1,1,1,1,0,'mdm:dashboard:view',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_DASHBOARD');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000202,'MDM_CENTER','主数据总览',930000000000000101,'C','/masterdata/center',2,2,1,1,0,'mdm:center:view',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_CENTER');

-- ============ 租户与配额 ============
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000211,'MDM_TENANT_LIST','租户列表',930000000000000102,'C','/subject/list',1,1,1,1,0,'mdm:tenant:list',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_TENANT_LIST');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000212,'MDM_TENANT_AUDIT','入驻与生命周期',930000000000000102,'C','/subject/audit',2,2,1,1,0,'mdm:tenant:audit',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_TENANT_AUDIT');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000213,'MDM_TENANT_CREATE','开通配置',930000000000000102,'C','/subject/create',3,3,1,1,0,'mdm:tenant:create',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_TENANT_CREATE');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000214,'MDM_TENANT_QUOTA','配额与超限',930000000000000102,'C','/subject/quota',4,4,1,1,0,'mdm:tenant:quota',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_TENANT_QUOTA');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000215,'MDM_TENANT_PACKAGE','套餐模板',930000000000000102,'C','/subject/package',5,5,1,1,0,'mdm:tenant:package',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_TENANT_PACKAGE');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000216,'MDM_TENANT_STATS','主体数据统计',930000000000000102,'C','/subject/statistics',6,6,1,1,0,'mdm:tenant:stats',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_TENANT_STATS');

-- ============ 组织与权限 ============
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000221,'MDM_ORG_LIST','全平台组织',930000000000000103,'C','/org/list',1,1,1,1,0,'mdm:org:list',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_ORG_LIST');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000222,'MDM_ROLE_LIST','角色与权限点',930000000000000103,'C','/permission/role',2,2,1,1,0,'mdm:role:list',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_ROLE_LIST');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000223,'MDM_ROLE_MATRIX','角色权限矩阵',930000000000000103,'C','/permission/matrix',3,3,1,1,0,'mdm:role:matrix',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_ROLE_MATRIX');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000224,'MDM_PERM_ANOMALY','异常权限检测',930000000000000103,'C','/permission/anomaly',4,4,1,1,0,'mdm:permission:anomaly',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_PERM_ANOMALY');

-- ============ 商品主数据 ============
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000231,'MDM_PRODUCT_CATALOG','品类标准与单位',930000000000000104,'C','/product/catalog',1,1,1,1,0,'mdm:product:catalog',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_PRODUCT_CATALOG');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000232,'MDM_PRODUCT_TEMPLATE','属性模板与 SKU',930000000000000104,'C','/product/template',2,2,1,1,0,'mdm:product:template',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_PRODUCT_TEMPLATE');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000233,'MDM_PRODUCT_SPU_AUDIT','商品审核',930000000000000104,'C','/product/spu-audit',3,3,1,1,0,'mdm:product:audit',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_PRODUCT_SPU_AUDIT');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000234,'MDM_PRODUCT_LIST','官网上架商品',930000000000000104,'C','/product/list',4,4,1,1,0,'mdm:product:list',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_PRODUCT_LIST');

-- ============ 客商主数据 ============
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000241,'MDM_CUSTOMER_LIST','客户主数据',930000000000000105,'C','/customer/list',1,1,1,1,0,'mdm:customer:list',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_CUSTOMER_LIST');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000242,'MDM_SUPPLIER_LIST','供应商主数据',930000000000000105,'C','/supplier/list',2,2,1,1,0,'mdm:supplier:list',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_SUPPLIER_LIST');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000243,'MDM_BLACKLIST','黑名单管理',930000000000000105,'C','/customer/blacklist',3,3,1,1,0,'mdm:blacklist:manage',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_BLACKLIST');

-- ============ 数据标准 ============
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000251,'MDM_CODE_RULE','编码规则管理',930000000000000106,'C','/datastandard/code-rule',1,1,1,1,0,'mdm:code-rule:manage',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_CODE_RULE');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000252,'MDM_DICT','数据字典',930000000000000106,'C','/datastandard/dict',2,2,1,1,0,'mdm:dict:manage',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_DICT');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000253,'MDM_METADATA','标准与元数据',930000000000000106,'C','/datastandard/metadata',3,3,1,1,0,'mdm:standard:manage',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_METADATA');

-- ============ 数据治理 ============
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000261,'MDM_QUALITY_DASH','质量稽核',930000000000000107,'C','/quality/dashboard',1,1,1,1,0,'mdm:quality:dashboard',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_QUALITY_DASH');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000262,'MDM_QUALITY_MONITOR','质量监控',930000000000000107,'C','/quality/list',2,2,1,1,0,'mdm:quality:monitor',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_QUALITY_MONITOR');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000263,'MDM_QUALITY_ISSUE','问题治理与合并',930000000000000107,'C','/quality/issue',3,3,1,1,0,'mdm:quality:issue',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_QUALITY_ISSUE');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000264,'MDM_QUALITY_RULE','质量规则',930000000000000107,'C','/quality/rule',4,4,1,1,0,'mdm:quality:rule',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_QUALITY_RULE');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000265,'MDM_QUALITY_TASK','检测任务',930000000000000107,'C','/quality/task',5,5,1,1,0,'mdm:quality:task',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_QUALITY_TASK');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000266,'MDM_DISTRIBUTION','血缘与分发',930000000000000107,'C','/distribution/list',6,6,1,1,0,'mdm:distribution:list',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_DISTRIBUTION');

-- ============ 系统与审计 ============
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000271,'MDM_OPLOG','操作审计',930000000000000108,'C','/permission/log',1,1,1,1,0,'mdm:log:audit',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_OPLOG');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000272,'MDM_OPS_ACCOUNTS','运营账号与角色',930000000000000108,'C','/system/ops-accounts',2,2,1,1,0,'mdm:ops-account:manage',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_OPS_ACCOUNTS');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000273,'MDM_PARAMS','参数配置',930000000000000108,'C','/system/params',3,3,1,1,0,'mdm:system:param',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_PARAMS');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000274,'MDM_TEMPLATE','通知模板',930000000000000108,'C','/system/template',4,4,1,1,0,'mdm:system:template',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_TEMPLATE');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000275,'MDM_ANNOUNCEMENT','公告管理',930000000000000108,'C','/system/announcement',5,5,1,1,0,'mdm:system:announcement',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_ANNOUNCEMENT');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000276,'MDM_REGION','行政区划',930000000000000108,'C','/system/region',6,6,1,1,0,'mdm:system:region',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_REGION');

-- ============ 关联系统（只读） ============
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000281,'MDM_USER_LIST','全平台用户',930000000000000109,'C','/user/list',1,1,1,1,0,'mdm:uc:user:list',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_USER_LIST');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000282,'MDM_USER_AUDIT','实名认证审核',930000000000000109,'C','/user/audit',2,2,1,1,0,'mdm:uc:user:audit',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_USER_AUDIT');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000283,'MDM_UC_OVERVIEW','用户中心总览',930000000000000109,'C','/uc/overview',3,3,1,1,0,'mdm:uc:overview',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_UC_OVERVIEW');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000284,'MDM_UC_IDENTITY','身份管理',930000000000000109,'C','/uc/identity',4,4,1,1,0,'mdm:uc:identity',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_UC_IDENTITY');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000285,'MDM_UC_IDENTITY_AUDIT','身份申请审核',930000000000000109,'C','/uc/identity-audit',5,5,1,1,0,'mdm:uc:identity-audit',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_UC_IDENTITY_AUDIT');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000286,'MDM_UC_CERT','资质审核',930000000000000109,'C','/uc/certification',6,6,1,1,0,'mdm:uc:certification',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_UC_CERT');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000287,'MDM_UC_FEEDBACK','意见反馈处理',930000000000000109,'C','/uc/feedback',7,7,1,1,0,'mdm:uc:feedback',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_UC_FEEDBACK');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000288,'MDM_UC_PRIVACY','隐私与数据申请',930000000000000109,'C','/uc/privacy',8,8,1,1,0,'mdm:uc:privacy',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_UC_PRIVACY');
INSERT INTO `agri_md_menu` (`id`,`menu_code`,`menu_name`,`parent_id`,`menu_type`,`path`,`sort_order`,`order_num`,`visible`,`status`,`del_flag`,`perms`,`create_time`,`create_by`)
SELECT 930000000000000289,'MDM_BOUNDARY','模块边界与协同',930000000000000109,'C','/masterdata/boundary',9,9,1,1,0,'mdm:boundary:view',NOW(),'system'
WHERE NOT EXISTS (SELECT 1 FROM `agri_md_menu` WHERE `menu_code`='MDM_BOUNDARY');
