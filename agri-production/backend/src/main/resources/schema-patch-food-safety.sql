-- 补丁：食品安全（admin/food-safety）11 张表（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-food-safety.sql
--
-- 背景（2026-10-15 切运营端最后一块 admin/food-safety）：这 11 张表此前只存在于平台侧
-- （core-platform 的 V19/V20/V21 三个迁移），本服务一张都没有 —— 直接切，页面会从"有数据"变"空列表"。
--
-- 表结构**由平台侧 DDL 机械转换**而来（不是手抄，避免抄错列名/类型），只做四类改动：
--   1. 表名 prod_fs_* → agri_prod_fs_*（本服务前缀）；
--   2. 去掉 market_id：本服务口径是"一主体一租户"，不需要市场维度（与既有表一致）；
--   3. tenant_id 由 bigint 改为 varchar(191)：本服务的租户是经营主体 id 的字符串形式；
--   4. 审计列改名对齐本服务：create_at/update_at → create_time/update_time；
--      deleted 由 tinyint 改 bigint（配合 MyBatis-Plus 的逻辑删除）；
--      排序规则 utf8mb4_0900_ai_ci → utf8mb4_unicode_ci（与本服务其余表一致）。
-- 主键沿用平台侧的**业务编号**（alert_id / risk_id 等）：这些表的业务键本来就是字符串编号，
-- 前端契约里的 id 也是它，加一层自增主键只会多一层映射。create_by/update_by 保留但不映射。
--
-- 演示数据**不在本文件**：11 张表共 166 行，按子域分批迁移（见 schema-patch-food-safety-data-*.sql），
-- 每批与本轮要切的端点一起上，避免一次灌一大片还没人看的数。


CREATE TABLE IF NOT EXISTS `agri_prod_fs_alert` (
  `alert_id` varchar(32) NOT NULL COMMENT 'id（告警编号，业务主键）',
  `tenant_id` varchar(191) NOT NULL COMMENT '租户ID',
  `alert_type` varchar(32) DEFAULT NULL COMMENT '告警类型：农残超标/重金属超标/农药超量使用/检测报告缺失/冷链温度异常',
  `target_name` varchar(100) DEFAULT NULL COMMENT '告警对象（农场名称）',
  `relate_code` varchar(32) DEFAULT NULL COMMENT '关联编号，如 #A123',
  `happen_time` datetime DEFAULT NULL COMMENT '发生时间（列表按 MM-dd HH:mm 展示）',
  `level` varchar(16) DEFAULT NULL COMMENT '级别：urgent 紧急 / important 重要 / normal 一般',
  `status` varchar(16) NOT NULL DEFAULT '待处理' COMMENT '处置状态：待处理/处理中/已处理',
  `measure` varchar(500) DEFAULT NULL COMMENT '处置措施（已处理时回填）',
  `handle_remark` varchar(200) DEFAULT NULL COMMENT '处置说明（与处置措施分开存，便于审计追溯）',
  `handle_by` bigint DEFAULT NULL COMMENT '处置人',
  `handle_time` datetime DEFAULT NULL COMMENT '处置时间',
  `create_by` bigint DEFAULT NULL COMMENT '创建人',
  `update_by` bigint DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bigint DEFAULT 0 COMMENT '逻辑删除 0否 1是',
  PRIMARY KEY (`alert_id`),
  KEY `idx_fs_alert_time` (`happen_time`),
  KEY `idx_fs_alert_level` (`level`),
  KEY `idx_fs_alert_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品安全-告警（P15）';



CREATE TABLE IF NOT EXISTS `agri_prod_fs_circulation_anomaly` (
  `anomaly_id` varchar(32) NOT NULL COMMENT 'id（异常编号，业务主键）',
  `tenant_id` varchar(191) NOT NULL COMMENT '租户ID',
  `batch_no` varchar(32) DEFAULT NULL COMMENT '批次号',
  `product_name` varchar(100) DEFAULT NULL COMMENT '产品名称',
  `anomaly_type` varchar(16) DEFAULT NULL COMMENT '异常类型：temperature 温度异常 / overtime 超时滞留 / label 标签异常',
  `severity` varchar(16) DEFAULT NULL COMMENT '严重程度：severe 严重 / medium 中等 / minor 轻微',
  `impact_range` varchar(32) DEFAULT NULL COMMENT '影响范围，如 50kg',
  `found_time` datetime DEFAULT NULL COMMENT '发现时间',
  `found_date` date DEFAULT NULL COMMENT '发现日期（冗余列，供日期筛选；避免对 found_time 做函数索引）',
  `status` varchar(16) NOT NULL DEFAULT 'pending' COMMENT '处理状态：pending/processing/done',
  `measure` varchar(500) DEFAULT NULL COMMENT '处置方式（处理后回填）',
  `handle_remark` varchar(200) DEFAULT NULL COMMENT '处置说明（与处置方式分开存，便于审计追溯）',
  `handle_by` bigint DEFAULT NULL COMMENT '处置人',
  `handle_time` datetime DEFAULT NULL COMMENT '处置时间',
  `create_by` bigint DEFAULT NULL COMMENT '创建人',
  `update_by` bigint DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bigint DEFAULT 0 COMMENT '逻辑删除 0否 1是',
  PRIMARY KEY (`anomaly_id`),
  KEY `idx_fs_circ_found_date` (`found_date`),
  KEY `idx_fs_circ_type` (`anomaly_type`),
  KEY `idx_fs_circ_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品安全-流通异常（P16）';



CREATE TABLE IF NOT EXISTS `agri_prod_fs_farm_risk` (
  `risk_id` varchar(32) NOT NULL COMMENT 'riskId（业务主键）',
  `tenant_id` varchar(191) NOT NULL COMMENT '租户ID（SaaS）',
  `farm_id` varchar(32) DEFAULT NULL COMMENT '农场ID（引用 prod_farm_info.farm_id）',
  `farm_name` varchar(100) DEFAULT NULL COMMENT '农场名称（冗余，列表展示用）',
  `score` decimal(5,1) DEFAULT NULL COMMENT '食品安全评分 0~100',
  `stat_date` date DEFAULT NULL COMMENT '统计日期（当期取每月 1 日为锚点）',
  `create_by` bigint DEFAULT NULL COMMENT '创建人',
  `update_by` bigint DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bigint DEFAULT 0 COMMENT '逻辑删除 0否 1是',
  PRIMARY KEY (`risk_id`),
  KEY `idx_fs_risk_stat` (`stat_date`),
  KEY `idx_fs_risk_farm` (`farm_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品安全-农场风险评分（P15 热力图）';



CREATE TABLE IF NOT EXISTS `agri_prod_fs_cold_chain_match` (
  `match_id` varchar(32) NOT NULL COMMENT 'id（撮合编号，业务主键）',
  `tenant_id` varchar(191) NOT NULL COMMENT '租户ID',
  `resource_id` varchar(32) DEFAULT NULL COMMENT '资源编号（引用 prod_fs_cold_chain_resource.resource_id）',
  `supplier_name` varchar(64) DEFAULT NULL COMMENT '资源方名称',
  `resource_type_label` varchar(16) DEFAULT NULL COMMENT '资源类型文案：冷链车 / 冷库',
  `demander` varchar(64) DEFAULT NULL COMMENT '需求方',
  `cargo` varchar(64) DEFAULT NULL COMMENT '货物 / 用途',
  `temp_require` varchar(32) DEFAULT NULL COMMENT '温区要求',
  `start_time` date DEFAULT NULL COMMENT '预约开始时间',
  `expect_time` date DEFAULT NULL COMMENT '期望使用时间（入队场景）',
  `match_time` datetime DEFAULT NULL COMMENT '撮合时间（列表按 MM-DD 展示）',
  `match_status` varchar(16) NOT NULL DEFAULT 'processing' COMMENT '状态：processing/done/queued',
  `remark` varchar(200) DEFAULT NULL COMMENT '备注',
  `create_by` bigint DEFAULT NULL COMMENT '创建人',
  `update_by` bigint DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bigint DEFAULT 0 COMMENT '逻辑删除 0否 1是',
  PRIMARY KEY (`match_id`),
  KEY `idx_fs_ccm_status` (`match_status`),
  KEY `idx_fs_ccm_resource` (`resource_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品安全-冷链撮合记录（P19）';



CREATE TABLE IF NOT EXISTS `agri_prod_fs_cold_chain_resource` (
  `resource_id` varchar(32) NOT NULL COMMENT 'id（资源编号，业务主键）',
  `tenant_id` varchar(191) NOT NULL COMMENT '租户ID',
  `resource_name` varchar(64) DEFAULT NULL COMMENT '资源名称（车牌号 / 库区名）',
  `resource_type` varchar(16) DEFAULT NULL COMMENT '资源类型：vehicle 冷链车 / warehouse 冷库',
  `type_label` varchar(16) DEFAULT NULL COMMENT '类型文案：冷链车 / 冷库',
  `spec` varchar(32) DEFAULT NULL COMMENT '规格文案，如 20吨 / 5000m²',
  `temp_range` varchar(32) DEFAULT NULL COMMENT '温区文案，如 -18°C ~ 5°C',
  `city` varchar(32) DEFAULT NULL COMMENT '所在城市',
  `district` varchar(32) DEFAULT NULL COMMENT '所在区县',
  `resource_status` varchar(16) NOT NULL DEFAULT 'idle' COMMENT '状态：idle 空闲 / busy 繁忙 / offline 离线·故障',
  `rating` decimal(3,1) DEFAULT NULL COMMENT '服务评分 0~5',
  `contact_name` varchar(32) DEFAULT NULL COMMENT '联系人',
  `contact_phone` varchar(20) DEFAULT NULL COMMENT '联系电话',
  `last_maintain_date` date DEFAULT NULL COMMENT '最近保养日期',
  `create_by` bigint DEFAULT NULL COMMENT '创建人',
  `update_by` bigint DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bigint DEFAULT 0 COMMENT '逻辑删除 0否 1是',
  PRIMARY KEY (`resource_id`),
  KEY `idx_fs_cc_status` (`resource_status`),
  KEY `idx_fs_cc_type` (`resource_type`),
  KEY `idx_fs_cc_city` (`city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品安全-冷链资源（P19）';



CREATE TABLE IF NOT EXISTS `agri_prod_fs_input_compliance` (
  `record_id` varchar(32) NOT NULL COMMENT 'id（记录编号，业务主键）',
  `tenant_id` varchar(191) NOT NULL COMMENT '租户ID',
  `farm_id` varchar(32) DEFAULT NULL COMMENT '农场ID（引用 prod_farm_info.farm_id）',
  `farm_name` varchar(100) DEFAULT NULL COMMENT '农场名称',
  `input_name` varchar(64) DEFAULT NULL COMMENT '投入品名称',
  `input_type` varchar(16) DEFAULT NULL COMMENT '投入品类型：氮肥/磷肥/钾肥/农药/杀菌剂/除草/调节剂/有机肥',
  `dosage` varchar(32) DEFAULT NULL COMMENT '用量文案，如 50kg/亩',
  `check_result` varchar(8) DEFAULT NULL COMMENT '校验结果：pass 合规 / over 超标',
  `violation` varchar(200) DEFAULT NULL COMMENT '违规项描述，无违规时为 —（前端展示占位，库内留 NULL）',
  `check_date` date DEFAULT NULL COMMENT '校验日期',
  `punish_action` varchar(64) DEFAULT NULL COMMENT '处罚方式（处罚登记后回填）',
  `punish_amount` decimal(12,2) DEFAULT NULL COMMENT '处罚金额（元）',
  `punish_remark` varchar(200) DEFAULT NULL COMMENT '整改要求',
  `punish_time` datetime DEFAULT NULL COMMENT '处罚登记时间',
  `create_by` bigint DEFAULT NULL COMMENT '创建人',
  `update_by` bigint DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bigint DEFAULT 0 COMMENT '逻辑删除 0否 1是',
  PRIMARY KEY (`record_id`),
  KEY `idx_fs_input_result` (`check_result`),
  KEY `idx_fs_input_farm` (`farm_name`),
  KEY `idx_fs_input_date` (`check_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品安全-投入品合规台账（P17 Tab1）';



CREATE TABLE IF NOT EXISTS `agri_prod_fs_label_compliance` (
  `label_id` varchar(32) NOT NULL COMMENT 'id（标签编号，业务主键）',
  `tenant_id` varchar(191) NOT NULL COMMENT '租户ID',
  `product_name` varchar(100) DEFAULT NULL COMMENT '产品名称',
  `producer` varchar(100) DEFAULT NULL COMMENT '生产者',
  `label_version` varchar(16) DEFAULT NULL COMMENT '标签版本，如 V2.1',
  `required_fields` int DEFAULT NULL COMMENT '必填字段总数（GB 7718 口径 10）',
  `filled_fields` int DEFAULT NULL COMMENT '已填写字段数',
  `missing_fields` varchar(200) DEFAULT NULL COMMENT '缺失字段（顿号分隔），无缺失时库内留 NULL',
  `marking_result` varchar(16) DEFAULT NULL COMMENT '标识合规性：compliant / violation',
  `marking_note` varchar(200) DEFAULT NULL COMMENT '标识校验说明',
  `check_result` varchar(8) DEFAULT NULL COMMENT '校验结论：pass / fail',
  `checked_at` datetime DEFAULT NULL COMMENT '校验时间',
  `rectify_status` varchar(16) NOT NULL DEFAULT 'none' COMMENT '整改状态：none/notified/done',
  `rectify_deadline` varchar(100) DEFAULT NULL COMMENT '整改期限（文案或日期）',
  `rectify_remark` varchar(200) DEFAULT NULL COMMENT '整改要求',
  `rectify_time` datetime DEFAULT NULL COMMENT '下发整改时间',
  `create_by` bigint DEFAULT NULL COMMENT '创建人',
  `update_by` bigint DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bigint DEFAULT 0 COMMENT '逻辑删除 0否 1是',
  PRIMARY KEY (`label_id`),
  KEY `idx_fs_label_result` (`check_result`),
  KEY `idx_fs_label_rectify` (`rectify_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品安全-产品标签合规（P17 Tab2）';



CREATE TABLE IF NOT EXISTS `agri_prod_fs_standard_item` (
  `item_id` varchar(32) NOT NULL COMMENT 'id（校验项ID，业务主键）',
  `tenant_id` varchar(191) NOT NULL COMMENT '租户ID',
  `standard_no` varchar(32) DEFAULT NULL COMMENT '所属标准编号',
  `item_name` varchar(64) DEFAULT NULL COMMENT '校验项名称，如 铅（以 Pb 计）',
  `limit_value` varchar(32) DEFAULT NULL COMMENT '标准限值文案，如 ≤ 0.2 mg/kg',
  `measured_value` varchar(32) DEFAULT NULL COMMENT '实测值文案，如 0.08 mg/kg',
  `check_result` varchar(8) DEFAULT NULL COMMENT '结论：pass / fail',
  `batch_no` varchar(32) DEFAULT NULL COMMENT '抽检批次号',
  `check_time` datetime DEFAULT NULL COMMENT '抽检时间（当期/上期达标率按此分组）',
  `create_by` bigint DEFAULT NULL COMMENT '创建人',
  `update_by` bigint DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bigint DEFAULT 0 COMMENT '逻辑删除 0否 1是',
  PRIMARY KEY (`item_id`),
  KEY `idx_fs_std_item_no` (`standard_no`),
  KEY `idx_fs_std_item_time` (`check_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品安全-标准校验项（P17 Tab3）';



CREATE TABLE IF NOT EXISTS `agri_prod_fs_standard_library` (
  `standard_no` varchar(32) NOT NULL COMMENT 'value（标准编号，业务主键）',
  `tenant_id` varchar(191) NOT NULL COMMENT '租户ID',
  `standard_name` varchar(100) DEFAULT NULL COMMENT 'label（标准全称）',
  `issuer` varchar(64) DEFAULT NULL COMMENT '发布机构',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态 1启用 0停用',
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序号',
  `create_by` bigint DEFAULT NULL COMMENT '创建人',
  `update_by` bigint DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bigint DEFAULT 0 COMMENT '逻辑删除 0否 1是',
  PRIMARY KEY (`standard_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品安全-行业标准库（P17 Tab3）';



CREATE TABLE IF NOT EXISTS `agri_prod_fs_standard_summary` (
  `summary_id` varchar(32) NOT NULL COMMENT 'summaryId（业务主键）',
  `tenant_id` varchar(191) NOT NULL COMMENT '租户ID',
  `standard_no` varchar(32) DEFAULT NULL COMMENT '标准编号',
  `batch_count` int DEFAULT NULL COMMENT '校验批次总数',
  `pass_count` int DEFAULT NULL COMMENT '通过批次数',
  `fail_count` int DEFAULT NULL COMMENT '不通过批次数',
  `pass_rate` decimal(5,1) DEFAULT NULL COMMENT '通过率（%）',
  `last_run_time` datetime DEFAULT NULL COMMENT '最近一次校验执行时间',
  `create_by` bigint DEFAULT NULL COMMENT '创建人',
  `update_by` bigint DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bigint DEFAULT 0 COMMENT '逻辑删除 0否 1是',
  PRIMARY KEY (`summary_id`),
  KEY `idx_fs_std_sum_no` (`standard_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品安全-标准校验汇总（P17 Tab3）';



CREATE TABLE IF NOT EXISTS `agri_prod_fs_trust_product` (
  `product_id` varchar(32) NOT NULL COMMENT 'id（产品编号，业务主键）',
  `tenant_id` varchar(191) NOT NULL COMMENT '租户ID',
  `product_name` varchar(100) DEFAULT NULL COMMENT '产品名称',
  `category` varchar(16) DEFAULT NULL COMMENT '品类：粮食/水果/蔬菜/畜牧/禽蛋/水产/茶叶/粮油',
  `producer` varchar(100) DEFAULT NULL COMMENT '生产者',
  `trust_level` varchar(16) DEFAULT NULL COMMENT '可信等级：diamond/gold/silver/normal',
  `trust_score` int DEFAULT NULL COMMENT '信任分数 0~100',
  `cert_mark` varchar(16) DEFAULT NULL COMMENT '认证标志：organic/green/pollution-free/none',
  `cert_org` varchar(64) DEFAULT NULL COMMENT '认证机构',
  `valid_until` date DEFAULT NULL COMMENT '认证有效期',
  `audit_status` varchar(16) NOT NULL DEFAULT 'pending' COMMENT '审核状态：approved/pending/rejected',
  `audit_remark` varchar(200) DEFAULT NULL COMMENT '审核意见',
  `audit_time` datetime DEFAULT NULL COMMENT '审核时间',
  `audit_by` bigint DEFAULT NULL COMMENT '审核人',
  `create_by` bigint DEFAULT NULL COMMENT '创建人',
  `update_by` bigint DEFAULT NULL COMMENT '更新人',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted` bigint DEFAULT 0 COMMENT '逻辑删除 0否 1是',
  PRIMARY KEY (`product_id`),
  KEY `idx_fs_trust_level` (`trust_level`),
  KEY `idx_fs_trust_audit` (`audit_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食品安全-可信农产品（P18）';

