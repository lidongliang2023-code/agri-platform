-- ------------------------------------------------ V19 运营端「食品安全」模块建表与演示种子
--
-- 驱动缺口：agri-production/frontend 的食品安全 5 个页面（P15 监控中心 / P16 流通异常检测 /
--   P17 合规校验管理 / P18 可信农产品管理 / P19 冷链资源撮合）已经交付，但
--   core-platform/mod-produce 下**没有任何 /admin/food-safety/* Controller**，
--   五个页面全部靠示例数据降级 + 顶部常驻「示例数据」横幅（见 foodSafety.ts 的
--   isMockSource 机制）。本迁移按《foodSafety接口契约.md》建 11 张 prod_fs_* 表并灌演示种子，
--   使后端实现落地后页面可直接切到真实数据分支。
--
-- 编号说明（**协作者须知**）：同期的 PRD 8.1.1/8.1.2 词表迁移已在 TaskStatus 的 Javadoc 中
--   预定 V18 作为任务状态数据切换版本。为避免抢号，本迁移取 V19。若将来 V18 在本迁移
--   **之后**才加入，Flyway 会因版本倒序在启动时报 validate 失败，需执行 flyway repair
--   或临时开启 out-of-order。
--
-- 口径纪律（沿用 V9/V14，务必遵守）：
--   1) 业务主键 varchar(32)，审计列 create_by/update_by/create_at/update_at/deleted；
--   2) market_id / tenant_id 由 MyMetaObjectHandler 在写入时填充，种子显式给 1/0 便于直查；
--   3) **后端不具备的字段一律留空**（NULL），不填 0、不填空串、不填占位值；
--   4) 演示行一律 DEMO-FS- 前缀，与真实业务数据物理区分，便于整体回收；
--   5) 农场类字段一律引用 prod_farm_info 里**真实存在的** DEMO-FARM-00x 主体，不编造农场；
--   6) 指标（P15）**全部由本模块明细表实时聚合**，刻意不建快照表 ——
--      快照表会形成第二数据源，与明细口径打架正是本项目反复治理的问题。
--      各字段口径见 AdminFoodSafetyMonitorService 的类注释。
--
-- 幂等：建表用 CREATE TABLE IF NOT EXISTS；种子统一先 DELETE 再 INSERT，
--   且 DELETE 一律限定 DEMO-FS-% 前缀，不触碰任何非演示数据。

-- ============================================================ 1. P15 食品安全监控中心

-- 1.1 农场风险评分（P15 4×4 热力图，按 stat_date 取当期；≥80 绿 / 60-80 黄 / <60 红）
CREATE TABLE IF NOT EXISTS prod_fs_farm_risk (
    risk_id        VARCHAR(32)  NOT NULL COMMENT 'riskId（业务主键）',
    market_id      BIGINT       NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT       NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS）',
    farm_id        VARCHAR(32)  COMMENT '农场ID（引用 prod_farm_info.farm_id）',
    farm_name      VARCHAR(100) COMMENT '农场名称（冗余，列表展示用）',
    score          DECIMAL(5,1) COMMENT '食品安全评分 0~100',
    stat_date      DATE         COMMENT '统计日期（当期取每月 1 日为锚点）',
    create_by      BIGINT       COMMENT '创建人',
    update_by      BIGINT       COMMENT '更新人',
    create_at      DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (risk_id),
    KEY idx_fs_risk_stat (stat_date),
    KEY idx_fs_risk_farm (farm_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '食品安全-农场风险评分（P15 热力图）';

-- 1.2 食品安全告警（P15 列表 + 处置写操作）
CREATE TABLE IF NOT EXISTS prod_fs_alert (
    alert_id      VARCHAR(32)  NOT NULL COMMENT 'id（告警编号，业务主键）',
    market_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '市场维度',
    tenant_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '租户ID',
    alert_type    VARCHAR(32)  COMMENT '告警类型：农残超标/重金属超标/农药超量使用/检测报告缺失/冷链温度异常',
    target_name   VARCHAR(100) COMMENT '告警对象（农场名称）',
    relate_code   VARCHAR(32)  COMMENT '关联编号，如 #A123',
    happen_time   DATETIME     COMMENT '发生时间（列表按 MM-dd HH:mm 展示）',
    level         VARCHAR(16)  COMMENT '级别：urgent 紧急 / important 重要 / normal 一般',
    status        VARCHAR(16)  NOT NULL DEFAULT '待处理' COMMENT '处置状态：待处理/处理中/已处理',
    measure       VARCHAR(500) COMMENT '处置措施（已处理时回填）',
    handle_remark VARCHAR(200) COMMENT '处置说明（与处置措施分开存，便于审计追溯）',
    handle_by     BIGINT       COMMENT '处置人',
    handle_time   DATETIME     COMMENT '处置时间',
    create_by     BIGINT       COMMENT '创建人',
    update_by     BIGINT       COMMENT '更新人',
    create_at     DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted       TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (alert_id),
    KEY idx_fs_alert_time (happen_time),
    KEY idx_fs_alert_level (level),
    KEY idx_fs_alert_status (status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '食品安全-告警（P15）';

-- ============================================================ 2. P16 流通异常检测

CREATE TABLE IF NOT EXISTS prod_fs_circulation_anomaly (
    anomaly_id    VARCHAR(32)  NOT NULL COMMENT 'id（异常编号，业务主键）',
    market_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '市场维度',
    tenant_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '租户ID',
    batch_no      VARCHAR(32)  COMMENT '批次号',
    product_name  VARCHAR(100) COMMENT '产品名称',
    anomaly_type  VARCHAR(16)  COMMENT '异常类型：temperature 温度异常 / overtime 超时滞留 / label 标签异常',
    severity      VARCHAR(16)  COMMENT '严重程度：severe 严重 / medium 中等 / minor 轻微',
    impact_range  VARCHAR(32)  COMMENT '影响范围，如 50kg',
    found_time    DATETIME     COMMENT '发现时间',
    found_date    DATE         COMMENT '发现日期（冗余列，供日期筛选；避免对 found_time 做函数索引）',
    status        VARCHAR(16)  NOT NULL DEFAULT 'pending' COMMENT '处理状态：pending/processing/done',
    measure       VARCHAR(500) COMMENT '处置方式（处理后回填）',
    handle_by     BIGINT       COMMENT '处置人',
    handle_time   DATETIME     COMMENT '处置时间',
    create_by     BIGINT       COMMENT '创建人',
    update_by     BIGINT       COMMENT '更新人',
    create_at     DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted       TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (anomaly_id),
    KEY idx_fs_circ_found_date (found_date),
    KEY idx_fs_circ_type (anomaly_type),
    KEY idx_fs_circ_status (status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '食品安全-流通异常（P16）';

-- ============================================================ 3. P17 合规校验管理

-- 3.1 Tab1 投入品合规台账（含超标处罚登记回填列）
CREATE TABLE IF NOT EXISTS prod_fs_input_compliance (
    record_id      VARCHAR(32)   NOT NULL COMMENT 'id（记录编号，业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID',
    farm_id        VARCHAR(32)   COMMENT '农场ID（引用 prod_farm_info.farm_id）',
    farm_name      VARCHAR(100)  COMMENT '农场名称',
    input_name     VARCHAR(64)   COMMENT '投入品名称',
    input_type     VARCHAR(16)   COMMENT '投入品类型：氮肥/磷肥/钾肥/农药/杀菌剂/除草/调节剂/有机肥',
    dosage         VARCHAR(32)   COMMENT '用量文案，如 50kg/亩',
    check_result   VARCHAR(8)    COMMENT '校验结果：pass 合规 / over 超标',
    violation      VARCHAR(200)  COMMENT '违规项描述，无违规时为 —（前端展示占位，库内留 NULL）',
    check_date     DATE          COMMENT '校验日期',
    punish_action  VARCHAR(64)   COMMENT '处罚方式（处罚登记后回填）',
    punish_amount  DECIMAL(12,2) COMMENT '处罚金额（元）',
    punish_remark  VARCHAR(200)  COMMENT '整改要求',
    punish_time    DATETIME      COMMENT '处罚登记时间',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (record_id),
    KEY idx_fs_input_result (check_result),
    KEY idx_fs_input_farm (farm_name),
    KEY idx_fs_input_date (check_date)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '食品安全-投入品合规台账（P17 Tab1）';

-- 3.2 Tab2 产品标签合规校验（必填字段口径按 GB 7718 取 10 项）
CREATE TABLE IF NOT EXISTS prod_fs_label_compliance (
    label_id         VARCHAR(32)  NOT NULL COMMENT 'id（标签编号，业务主键）',
    market_id        BIGINT       NOT NULL DEFAULT 0 COMMENT '市场维度',
    tenant_id        BIGINT       NOT NULL DEFAULT 0 COMMENT '租户ID',
    product_name     VARCHAR(100) COMMENT '产品名称',
    producer         VARCHAR(100) COMMENT '生产者',
    label_version    VARCHAR(16)  COMMENT '标签版本，如 V2.1',
    required_fields  INT          COMMENT '必填字段总数（GB 7718 口径 10）',
    filled_fields    INT          COMMENT '已填写字段数',
    missing_fields   VARCHAR(200) COMMENT '缺失字段（顿号分隔），无缺失时库内留 NULL',
    marking_result   VARCHAR(16)  COMMENT '标识合规性：compliant / violation',
    marking_note     VARCHAR(200) COMMENT '标识校验说明',
    check_result     VARCHAR(8)   COMMENT '校验结论：pass / fail',
    checked_at       DATETIME     COMMENT '校验时间',
    rectify_status   VARCHAR(16)  NOT NULL DEFAULT 'none' COMMENT '整改状态：none/notified/done',
    rectify_deadline VARCHAR(100) COMMENT '整改期限（文案或日期）',
    rectify_remark   VARCHAR(200) COMMENT '整改要求',
    rectify_time     DATETIME     COMMENT '下发整改时间',
    create_by        BIGINT       COMMENT '创建人',
    update_by        BIGINT       COMMENT '更新人',
    create_at        DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted          TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (label_id),
    KEY idx_fs_label_result (check_result),
    KEY idx_fs_label_rectify (rectify_status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '食品安全-产品标签合规（P17 Tab2）';

-- 3.3 Tab3 行业标准库（下拉数据源）
CREATE TABLE IF NOT EXISTS prod_fs_standard_library (
    standard_no   VARCHAR(32)  NOT NULL COMMENT 'value（标准编号，业务主键）',
    market_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '市场维度',
    tenant_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '租户ID',
    standard_name VARCHAR(100) COMMENT 'label（标准全称）',
    issuer        VARCHAR(64)  COMMENT '发布机构',
    status        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态 1启用 0停用',
    sort_no       INT          NOT NULL DEFAULT 0 COMMENT '排序号',
    create_by     BIGINT       COMMENT '创建人',
    update_by     BIGINT       COMMENT '更新人',
    create_at     DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted       TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (standard_no)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '食品安全-行业标准库（P17 Tab3）';

-- 3.4 Tab3 标准校验项明细（含 check_time，供当期/上期达标率计算）
CREATE TABLE IF NOT EXISTS prod_fs_standard_item (
    item_id        VARCHAR(32) NOT NULL COMMENT 'id（校验项ID，业务主键）',
    market_id      BIGINT      NOT NULL DEFAULT 0 COMMENT '市场维度',
    tenant_id      BIGINT      NOT NULL DEFAULT 0 COMMENT '租户ID',
    standard_no    VARCHAR(32) COMMENT '所属标准编号',
    item_name      VARCHAR(64) COMMENT '校验项名称，如 铅（以 Pb 计）',
    limit_value    VARCHAR(32) COMMENT '标准限值文案，如 ≤ 0.2 mg/kg',
    measured_value VARCHAR(32) COMMENT '实测值文案，如 0.08 mg/kg',
    check_result   VARCHAR(8)  COMMENT '结论：pass / fail',
    batch_no       VARCHAR(32) COMMENT '抽检批次号',
    check_time     DATETIME    COMMENT '抽检时间（当期/上期达标率按此分组）',
    create_by      BIGINT      COMMENT '创建人',
    update_by      BIGINT      COMMENT '更新人',
    create_at      DATETIME    DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT     NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (item_id),
    KEY idx_fs_std_item_no (standard_no),
    KEY idx_fs_std_item_time (check_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '食品安全-标准校验项（P17 Tab3）';

-- 3.5 Tab3 标准校验汇总（批次级通过率，口径：5 标准合计 1240 批 / 通过 1151 批 = 92.8%）
CREATE TABLE IF NOT EXISTS prod_fs_standard_summary (
    summary_id    VARCHAR(32)  NOT NULL COMMENT 'summaryId（业务主键）',
    market_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '市场维度',
    tenant_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '租户ID',
    standard_no   VARCHAR(32)  COMMENT '标准编号',
    batch_count   INT          COMMENT '校验批次总数',
    pass_count    INT          COMMENT '通过批次数',
    fail_count    INT          COMMENT '不通过批次数',
    pass_rate     DECIMAL(5,1) COMMENT '通过率（%）',
    last_run_time DATETIME     COMMENT '最近一次校验执行时间',
    create_by     BIGINT       COMMENT '创建人',
    update_by     BIGINT       COMMENT '更新人',
    create_at     DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted       TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (summary_id),
    KEY idx_fs_std_sum_no (standard_no)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '食品安全-标准校验汇总（P17 Tab3）';

-- ============================================================ 4. P18 可信农产品管理

CREATE TABLE IF NOT EXISTS prod_fs_trust_product (
    product_id    VARCHAR(32)  NOT NULL COMMENT 'id（产品编号，业务主键）',
    market_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '市场维度',
    tenant_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '租户ID',
    product_name  VARCHAR(100) COMMENT '产品名称',
    category      VARCHAR(16)  COMMENT '品类：粮食/水果/蔬菜/畜牧/禽蛋/水产/茶叶/粮油',
    producer      VARCHAR(100) COMMENT '生产者',
    trust_level   VARCHAR(16)  COMMENT '可信等级：diamond/gold/silver/normal',
    trust_score   INT          COMMENT '信任分数 0~100',
    cert_mark     VARCHAR(16)  COMMENT '认证标志：organic/green/pollution-free/none',
    cert_org      VARCHAR(64)  COMMENT '认证机构',
    valid_until   DATE         COMMENT '认证有效期',
    audit_status  VARCHAR(16)  NOT NULL DEFAULT 'pending' COMMENT '审核状态：approved/pending/rejected',
    audit_remark  VARCHAR(200) COMMENT '审核意见',
    audit_time    DATETIME     COMMENT '审核时间',
    audit_by      BIGINT       COMMENT '审核人',
    create_by     BIGINT       COMMENT '创建人',
    update_by     BIGINT       COMMENT '更新人',
    create_at     DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted       TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (product_id),
    KEY idx_fs_trust_level (trust_level),
    KEY idx_fs_trust_audit (audit_status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '食品安全-可信农产品（P18）';

-- ============================================================ 5. P19 冷链资源撮合

CREATE TABLE IF NOT EXISTS prod_fs_cold_chain_resource (
    resource_id        VARCHAR(32)  NOT NULL COMMENT 'id（资源编号，业务主键）',
    market_id          BIGINT       NOT NULL DEFAULT 0 COMMENT '市场维度',
    tenant_id          BIGINT       NOT NULL DEFAULT 0 COMMENT '租户ID',
    resource_name      VARCHAR(64)  COMMENT '资源名称（车牌号 / 库区名）',
    resource_type      VARCHAR(16)  COMMENT '资源类型：vehicle 冷链车 / warehouse 冷库',
    type_label         VARCHAR(16)  COMMENT '类型文案：冷链车 / 冷库',
    spec               VARCHAR(32)  COMMENT '规格文案，如 20吨 / 5000m²',
    temp_range         VARCHAR(32)  COMMENT '温区文案，如 -18°C ~ 5°C',
    city               VARCHAR(32)  COMMENT '所在城市',
    district           VARCHAR(32)  COMMENT '所在区县',
    resource_status    VARCHAR(16)  NOT NULL DEFAULT 'idle' COMMENT '状态：idle 空闲 / busy 繁忙 / offline 离线·故障',
    rating             DECIMAL(3,1) COMMENT '服务评分 0~5',
    contact_name       VARCHAR(32)  COMMENT '联系人',
    contact_phone      VARCHAR(20)  COMMENT '联系电话',
    last_maintain_date DATE         COMMENT '最近保养日期',
    create_by          BIGINT       COMMENT '创建人',
    update_by          BIGINT       COMMENT '更新人',
    create_at          DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted            TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (resource_id),
    KEY idx_fs_cc_status (resource_status),
    KEY idx_fs_cc_type (resource_type),
    KEY idx_fs_cc_city (city)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '食品安全-冷链资源（P19）';

CREATE TABLE IF NOT EXISTS prod_fs_cold_chain_match (
    match_id            VARCHAR(32) NOT NULL COMMENT 'id（撮合编号，业务主键）',
    market_id           BIGINT      NOT NULL DEFAULT 0 COMMENT '市场维度',
    tenant_id           BIGINT      NOT NULL DEFAULT 0 COMMENT '租户ID',
    resource_id         VARCHAR(32) COMMENT '资源编号（引用 prod_fs_cold_chain_resource.resource_id）',
    supplier_name       VARCHAR(64) COMMENT '资源方名称',
    resource_type_label VARCHAR(16) COMMENT '资源类型文案：冷链车 / 冷库',
    demander            VARCHAR(64) COMMENT '需求方',
    cargo               VARCHAR(64) COMMENT '货物 / 用途',
    temp_require        VARCHAR(32) COMMENT '温区要求',
    start_time          DATE        COMMENT '预约开始时间',
    expect_time         DATE        COMMENT '期望使用时间（入队场景）',
    match_time          DATETIME    COMMENT '撮合时间（列表按 MM-DD 展示）',
    match_status        VARCHAR(16) NOT NULL DEFAULT 'processing' COMMENT '状态：processing/done/queued',
    remark              VARCHAR(200) COMMENT '备注',
    create_by           BIGINT      COMMENT '创建人',
    update_by           BIGINT      COMMENT '更新人',
    create_at           DATETIME    DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at           DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted             TINYINT     NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (match_id),
    KEY idx_fs_ccm_status (match_status),
    KEY idx_fs_ccm_resource (resource_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '食品安全-冷链撮合记录（P19）';

-- ============================================================ 6. 演示种子（DEMO-FS- 前缀）

-- 6.1 农场风险评分：引用 prod_farm_info 真实存在的 6 个演示农场，两个统计月各 6 行。
--     当期(2026-10-01) 均值 = (98+95+92+88+75+58)/6 = 84.3，上期(2026-09-01) = 82.0，
--     故 safetyIndex=84.3、safetyIndexDelta=+2.3；配色覆盖绿(≥80)4 / 黄(60-80)1 / 红(<60)1。
--     ⚠️ 原型热力图为 4×4=16 格，但库内仅 6 个演示农场：不编造农场主体，
--        故实际渲染 6 格。补齐需产品决策（增加演示农场或改为按地块维度）。
DELETE FROM prod_fs_farm_risk WHERE risk_id LIKE 'DEMO-FS-%';
INSERT INTO prod_fs_farm_risk (risk_id, market_id, tenant_id, farm_id, farm_name, score, stat_date) VALUES
('DEMO-FS-RISK-001', 1, 0, 'DEMO-FARM-001', '【演示】华南绿色蔬菜示范农场', 98.0, '2026-10-01'),
('DEMO-FS-RISK-002', 1, 0, 'DEMO-FARM-002', '【演示】华东智慧稻田农场',     95.0, '2026-10-01'),
('DEMO-FS-RISK-003', 1, 0, 'DEMO-FARM-003', '【演示】鲁中设施果蔬农场',     92.0, '2026-10-01'),
('DEMO-FS-RISK-004', 1, 0, 'DEMO-FARM-004', '【演示】西北高原生态牧场',     88.0, '2026-10-01'),
('DEMO-FS-RISK-005', 1, 0, 'DEMO-FARM-005', '【演示】江汉稻渔综合种养农场', 75.0, '2026-10-01'),
('DEMO-FS-RISK-006', 1, 0, 'DEMO-FARM-006', '【演示】滇中花卉种苗基地',     58.0, '2026-10-01'),
('DEMO-FS-RISK-101', 1, 0, 'DEMO-FARM-001', '【演示】华南绿色蔬菜示范农场', 96.0, '2026-09-01'),
('DEMO-FS-RISK-102', 1, 0, 'DEMO-FARM-002', '【演示】华东智慧稻田农场',     93.0, '2026-09-01'),
('DEMO-FS-RISK-103', 1, 0, 'DEMO-FARM-003', '【演示】鲁中设施果蔬农场',     90.0, '2026-09-01'),
('DEMO-FS-RISK-104', 1, 0, 'DEMO-FARM-004', '【演示】西北高原生态牧场',     86.0, '2026-09-01'),
('DEMO-FS-RISK-105', 1, 0, 'DEMO-FARM-005', '【演示】江汉稻渔综合种养农场', 73.0, '2026-09-01'),
('DEMO-FS-RISK-106', 1, 0, 'DEMO-FARM-006', '【演示】滇中花卉种苗基地',     54.0, '2026-09-01');

-- 6.2 食品安全告警：12 条，覆盖 5 种类型 / 3 个级别（urgent 4、important 5、normal 3）/ 3 种状态。
--     alertCount=12、urgentAlertCount=4 由明细实时聚合，与此处行数天然一致。
DELETE FROM prod_fs_alert WHERE alert_id LIKE 'DEMO-FS-%';
INSERT INTO prod_fs_alert (alert_id, market_id, tenant_id, alert_type, target_name, relate_code, happen_time, level, status, measure, handle_time) VALUES
('DEMO-FS-ALM-001', 1, 0, '农残超标',     '【演示】华南绿色蔬菜示范农场', '#A123', '2026-10-10 10:30', 'urgent',    '待处理', NULL, NULL),
('DEMO-FS-ALM-002', 1, 0, '重金属超标',   '【演示】华东智慧稻田农场',     '#B456', '2026-10-10 09:15', 'urgent',    '待处理', NULL, NULL),
('DEMO-FS-ALM-003', 1, 0, '农药超量使用', '【演示】鲁中设施果蔬农场',     '#C789', '2026-10-10 08:42', 'important', '处理中', NULL, NULL),
('DEMO-FS-ALM-004', 1, 0, '检测报告缺失', '【演示】西北高原生态牧场',     '#D012', '2026-10-09 16:20', 'normal',    '待处理', NULL, NULL),
('DEMO-FS-ALM-005', 1, 0, '冷链温度异常', '【演示】江汉稻渔综合种养农场', '#E345', '2026-10-09 14:05', 'important', '已处理', '已联系承运方检修制冷机组', '2026-10-09 15:30'),
('DEMO-FS-ALM-006', 1, 0, '农残超标',     '【演示】滇中花卉种苗基地',     '#F678', '2026-10-08 17:40', 'urgent',    '已处理', '批次已封存并启动复检',     '2026-10-08 19:10'),
('DEMO-FS-ALM-007', 1, 0, '检测报告缺失', '【演示】华南绿色蔬菜示范农场', '#G901', '2026-10-08 09:28', 'normal',    '已处理', '已补传第三方检测报告',     '2026-10-08 11:02'),
('DEMO-FS-ALM-008', 1, 0, '农药超量使用', '【演示】华东智慧稻田农场',     '#H234', '2026-10-07 15:12', 'important', '处理中', NULL, NULL),
('DEMO-FS-ALM-009', 1, 0, '冷链温度异常', '【演示】鲁中设施果蔬农场',     '#J567', '2026-10-07 11:36', 'important', '已处理', '已切换备用冷藏车完成转运', '2026-10-07 13:20'),
('DEMO-FS-ALM-010', 1, 0, '重金属超标',   '【演示】西北高原生态牧场',     '#K890', '2026-10-06 14:50', 'urgent',    '处理中', NULL, NULL),
('DEMO-FS-ALM-011', 1, 0, '农残超标',     '【演示】江汉稻渔综合种养农场', '#L123', '2026-10-06 10:18', 'important', '已处理', '通知农场负责人整改并复检合格', '2026-10-06 16:40'),
('DEMO-FS-ALM-012', 1, 0, '检测报告缺失', '【演示】滇中花卉种苗基地',     '#M456', '2026-10-05 08:55', 'normal',    '待处理', NULL, NULL);

-- 6.3 流通异常：16 条，覆盖 3 类型 / 3 严重度 / 3 状态。
DELETE FROM prod_fs_circulation_anomaly WHERE anomaly_id LIKE 'DEMO-FS-%';
INSERT INTO prod_fs_circulation_anomaly (anomaly_id, market_id, tenant_id, batch_no, product_name, anomaly_type, severity, impact_range, found_time, found_date, status, measure) VALUES
('DEMO-FS-CIR-001', 1, 0, 'DEMO-BATCH-001', '番茄',   'temperature', 'severe',  '50kg',  '2026-10-10 11:20', '2026-10-10', 'pending',    NULL),
('DEMO-FS-CIR-002', 1, 0, 'DEMO-BATCH-002', '黄瓜',   'overtime',    'medium',  '120kg', '2026-10-10 09:05', '2026-10-10', 'processing', '通知责任方核查'),
('DEMO-FS-CIR-003', 1, 0, 'DEMO-BATCH-003', '辣椒',   'label',       'minor',   '80kg',  '2026-10-09 16:40', '2026-10-09', 'done',       '关闭'),
('DEMO-FS-CIR-004', 1, 0, 'DEMO-BATCH-004', '稻谷',   'temperature', 'medium',  '200L',  '2026-10-09 14:22', '2026-10-09', 'processing', '转人工复核'),
('DEMO-FS-CIR-005', 1, 0, 'DEMO-BATCH-005', '辣椒',   'overtime',    'severe',  '160kg', '2026-10-08 18:10', '2026-10-08', 'done',       '召回问题批次'),
('DEMO-FS-CIR-006', 1, 0, 'DEMO-BATCH-001', '番茄',   'label',       'minor',   '60kg',  '2026-10-08 10:32', '2026-10-08', 'done',       '关闭'),
('DEMO-FS-CIR-007', 1, 0, 'DEMO-BATCH-002', '黄瓜',   'temperature', 'severe',  '90kg',  '2026-10-07 15:48', '2026-10-07', 'done',       '召回问题批次'),
('DEMO-FS-CIR-008', 1, 0, 'DEMO-BATCH-003', '辣椒',   'overtime',    'medium',  '110kg', '2026-10-07 11:15', '2026-10-07', 'done',       '通知责任方核查'),
('DEMO-FS-CIR-009', 1, 0, 'DEMO-BATCH-004', '稻谷',   'label',       'minor',   '150kg', '2026-10-06 17:02', '2026-10-06', 'done',       '关闭'),
('DEMO-FS-CIR-010', 1, 0, 'DEMO-BATCH-005', '辣椒',   'temperature', 'medium',  '70kg',  '2026-10-06 13:26', '2026-10-06', 'done',       '转人工复核'),
('DEMO-FS-CIR-011', 1, 0, 'DEMO-BATCH-001', '番茄',   'overtime',    'minor',   '40kg',  '2026-10-05 16:44', '2026-10-05', 'done',       '关闭'),
('DEMO-FS-CIR-012', 1, 0, 'DEMO-BATCH-002', '黄瓜',   'label',       'medium',  '95kg',  '2026-10-05 10:08', '2026-10-05', 'done',       '通知责任方核查'),
('DEMO-FS-CIR-013', 1, 0, 'DEMO-BATCH-003', '辣椒',   'temperature', 'severe',  '130kg', '2026-10-04 15:31', '2026-10-04', 'done',       '召回问题批次'),
('DEMO-FS-CIR-014', 1, 0, 'DEMO-BATCH-004', '稻谷',   'overtime',    'minor',   '180kg', '2026-10-04 09:19', '2026-10-04', 'done',       '关闭'),
('DEMO-FS-CIR-015', 1, 0, 'DEMO-BATCH-005', '辣椒',   'label',       'minor',   '55kg',  '2026-10-03 14:57', '2026-10-03', 'done',       '关闭'),
('DEMO-FS-CIR-016', 1, 0, 'DEMO-BATCH-001', '番茄',   'temperature', 'medium',  '100kg', '2026-10-03 11:41', '2026-10-03', 'done',       '转人工复核');

-- 6.4 投入品合规台账：16 条，合规 11 / 超标 5；投入品名称取自 prod_input_info 常见品类口径。
DELETE FROM prod_fs_input_compliance WHERE record_id LIKE 'DEMO-FS-%';
INSERT INTO prod_fs_input_compliance (record_id, market_id, tenant_id, farm_id, farm_name, input_name, input_type, dosage, check_result, violation, check_date) VALUES
('DEMO-FS-INP-001', 1, 0, 'DEMO-FARM-001', '【演示】华南绿色蔬菜示范农场', '尿素',       '氮肥',   '20kg/亩',  'pass', NULL, '2026-10-10'),
('DEMO-FS-INP-002', 1, 0, 'DEMO-FARM-002', '【演示】华东智慧稻田农场',     '复合肥',     '氮肥',   '35kg/亩',  'over', '超量施用：限量 25kg/亩，实测 35kg/亩', '2026-10-10'),
('DEMO-FS-INP-003', 1, 0, 'DEMO-FARM-003', '【演示】鲁中设施果蔬农场',     '磷酸二氢钾', '磷肥',   '8kg/亩',   'pass', NULL, '2026-10-09'),
('DEMO-FS-INP-004', 1, 0, 'DEMO-FARM-004', '【演示】西北高原生态牧场',     '氯化钾',     '钾肥',   '12kg/亩',  'pass', NULL, '2026-10-09'),
('DEMO-FS-INP-005', 1, 0, 'DEMO-FARM-005', '【演示】江汉稻渔综合种养农场', '草甘膦',     '除草',   '300ml/亩', 'over', '超出登记用量且临近采收期使用', '2026-10-09'),
('DEMO-FS-INP-006', 1, 0, 'DEMO-FARM-006', '【演示】滇中花卉种苗基地',     '多菌灵',     '杀菌剂', '80g/亩',   'pass', NULL, '2026-10-08'),
('DEMO-FS-INP-007', 1, 0, 'DEMO-FARM-001', '【演示】华南绿色蔬菜示范农场', '有机肥',     '有机肥', '500kg/亩', 'pass', NULL, '2026-10-08'),
('DEMO-FS-INP-008', 1, 0, 'DEMO-FARM-002', '【演示】华东智慧稻田农场',     '吡虫啉',     '农药',   '40g/亩',   'pass', NULL, '2026-10-07'),
('DEMO-FS-INP-009', 1, 0, 'DEMO-FARM-003', '【演示】鲁中设施果蔬农场',     '乙烯利',     '调节剂', '25ml/亩',  'over', '未在登记作物范围内使用', '2026-10-07'),
('DEMO-FS-INP-010', 1, 0, 'DEMO-FARM-004', '【演示】西北高原生态牧场',     '过磷酸钙',   '磷肥',   '30kg/亩',  'pass', NULL, '2026-10-06'),
('DEMO-FS-INP-011', 1, 0, 'DEMO-FARM-005', '【演示】江汉稻渔综合种养农场', '硫酸钾',     '钾肥',   '15kg/亩',  'pass', NULL, '2026-10-06'),
('DEMO-FS-INP-012', 1, 0, 'DEMO-FARM-006', '【演示】滇中花卉种苗基地',     '百菌清',     '杀菌剂', '120g/亩',  'over', '超出安全间隔期要求', '2026-10-05'),
('DEMO-FS-INP-013', 1, 0, 'DEMO-FARM-001', '【演示】华南绿色蔬菜示范农场', '生物有机肥', '有机肥', '400kg/亩', 'pass', NULL, '2026-10-04'),
('DEMO-FS-INP-014', 1, 0, 'DEMO-FARM-002', '【演示】华东智慧稻田农场',     '阿维菌素',   '农药',   '20ml/亩',  'pass', NULL, '2026-10-03'),
('DEMO-FS-INP-015', 1, 0, 'DEMO-FARM-003', '【演示】鲁中设施果蔬农场',     '硝基复合肥', '氮肥',   '45kg/亩',  'over', '超量施用：限量 30kg/亩，实测 45kg/亩', '2026-10-03'),
('DEMO-FS-INP-016', 1, 0, 'DEMO-FARM-004', '【演示】西北高原生态牧场',     '腐殖酸肥',   '有机肥', '200kg/亩', 'pass', NULL, '2026-10-02');

-- 6.5 产品标签合规：12 条，其中 4 条缺失字段 / 3 条标识违规；必填字段按 GB 7718 取 10 项。
DELETE FROM prod_fs_label_compliance WHERE label_id LIKE 'DEMO-FS-%';
INSERT INTO prod_fs_label_compliance (label_id, market_id, tenant_id, product_name, producer, label_version, required_fields, filled_fields, missing_fields, marking_result, marking_note, check_result, checked_at, rectify_status) VALUES
('DEMO-FS-LBL-001', 1, 0, '有机番茄',     '【演示】华南绿色蔬菜示范农场', 'V2.1', 10, 10, NULL,                 'compliant', '标识齐全',                     'pass', '2026-10-10 09:30', 'none'),
('DEMO-FS-LBL-002', 1, 0, '精品黄瓜',     '【演示】华东智慧稻田农场',     'V1.4', 10, 8,  '贮存条件、追溯码',   'compliant', '标识齐全',                     'fail', '2026-10-10 09:35', 'notified'),
('DEMO-FS-LBL-003', 1, 0, '绿色辣椒',     '【演示】鲁中设施果蔬农场',     'V2.0', 10, 10, NULL,                 'violation', '标注有机认证但证书已过期',     'fail', '2026-10-10 09:40', 'notified'),
('DEMO-FS-LBL-004', 1, 0, '高原稻谷',     '【演示】西北高原生态牧场',     'V1.1', 10, 10, NULL,                 'compliant', '标识齐全',                     'pass', '2026-10-09 15:10', 'none'),
('DEMO-FS-LBL-005', 1, 0, '稻渔香米',     '【演示】江汉稻渔综合种养农场', 'V3.0', 10, 7,  '净含量、生产日期、执行标准号', 'compliant', '标识齐全',            'fail', '2026-10-09 15:15', 'notified'),
('DEMO-FS-LBL-006', 1, 0, '鲜切花苗',     '【演示】滇中花卉种苗基地',     'V1.0', 10, 10, NULL,                 'violation', '标注绿色认证但未提供认证编号', 'fail', '2026-10-08 16:20', 'done'),
('DEMO-FS-LBL-007', 1, 0, '小番茄',       '【演示】华南绿色蔬菜示范农场', 'V2.1', 10, 10, NULL,                 'compliant', '标识齐全',                     'pass', '2026-10-08 16:25', 'none'),
('DEMO-FS-LBL-008', 1, 0, '温室黄瓜',     '【演示】华东智慧稻田农场',     'V1.4', 10, 9,  '追溯码',             'compliant', '标识齐全',                     'fail', '2026-10-07 10:05', 'done'),
('DEMO-FS-LBL-009', 1, 0, '螺丝椒',       '【演示】鲁中设施果蔬农场',     'V2.0', 10, 10, NULL,                 'compliant', '标识齐全',                     'pass', '2026-10-07 10:10', 'none'),
('DEMO-FS-LBL-010', 1, 0, '生态稻米',     '【演示】西北高原生态牧场',     'V1.1', 10, 10, NULL,                 'violation', '标注无公害认证但证书编号为空', 'fail', '2026-10-05 14:40', 'done'),
('DEMO-FS-LBL-011', 1, 0, '稻渔米',       '【演示】江汉稻渔综合种养农场', 'V3.0', 10, 10, NULL,                 'compliant', '标识齐全',                     'pass', '2026-10-05 14:45', 'none'),
('DEMO-FS-LBL-012', 1, 0, '种苗礼盒',     '【演示】滇中花卉种苗基地',     'V1.0', 10, 8,  '生产者地址、保质期', 'compliant', '标识齐全',                     'fail', '2026-10-04 11:30', 'done');

-- 6.6 行业标准库：前端内置 5 项基准数据，保持一致。
DELETE FROM prod_fs_standard_library WHERE standard_no LIKE 'DEMO-FS-%' OR standard_no IN ('GB2762-2022','GB2763-2021','GB7718-2011','NYT391-2021','GBT19630-2019');
INSERT INTO prod_fs_standard_library (standard_no, market_id, tenant_id, standard_name, issuer, status, sort_no) VALUES
('GB2762-2022',   1, 0, 'GB 2762-2022 食品中污染物限量',       '国家卫生健康委员会', 1, 1),
('GB2763-2021',   1, 0, 'GB 2763-2021 食品中农药最大残留限量', '国家卫生健康委员会', 1, 2),
('GB7718-2011',   1, 0, 'GB 7718-2011 预包装食品标签通则',     '国家卫生健康委员会', 1, 3),
('NYT391-2021',   1, 0, 'NY/T 391-2021 绿色食品 产地环境质量', '农业农村部',         1, 4),
('GBT19630-2019', 1, 0, 'GB/T 19630-2019 有机产品',            '国家市场监督管理总局', 1, 5);

-- 6.7 标准校验项：5 标准 × 4 项 × 2 个月份 = 40 行。
--     当期(2026-10) 20 项达标 16 项（fail: ITM-003/007/011/019）→ passRate = 80.0%；
--     上期(2026-09) 20 项达标 12 项（fail: ITM-102/105/108/112/113/115/118/120）→ 60.0%，
--     故 passRateDelta = +20.0 个百分点。
DELETE FROM prod_fs_standard_item WHERE item_id LIKE 'DEMO-FS-%';
INSERT INTO prod_fs_standard_item (item_id, market_id, tenant_id, standard_no, item_name, limit_value, measured_value, check_result, batch_no, check_time) VALUES
('DEMO-FS-ITM-001', 1, 0, 'GB2762-2022',   '铅（以 Pb 计）',   '≤ 0.2 mg/kg',    '0.08 mg/kg',    'pass', 'DEMO-BATCH-001', '2026-10-09 10:00'),
('DEMO-FS-ITM-002', 1, 0, 'GB2762-2022',   '镉（以 Cd 计）',   '≤ 0.05 mg/kg',   '0.03 mg/kg',    'pass', 'DEMO-BATCH-001', '2026-10-09 10:00'),
('DEMO-FS-ITM-003', 1, 0, 'GB2762-2022',   '总砷（以 As 计）', '≤ 0.5 mg/kg',    '0.61 mg/kg',    'fail', 'DEMO-BATCH-002', '2026-10-09 10:05'),
('DEMO-FS-ITM-004', 1, 0, 'GB2762-2022',   '汞（以 Hg 计）',   '≤ 0.01 mg/kg',   '0.004 mg/kg',   'pass', 'DEMO-BATCH-002', '2026-10-09 10:05'),
('DEMO-FS-ITM-005', 1, 0, 'GB2763-2021',   '毒死蜱',           '≤ 0.02 mg/kg',   '0.008 mg/kg',   'pass', 'DEMO-BATCH-003', '2026-10-08 11:20'),
('DEMO-FS-ITM-006', 1, 0, 'GB2763-2021',   '吡虫啉',           '≤ 0.5 mg/kg',    '0.31 mg/kg',    'pass', 'DEMO-BATCH-003', '2026-10-08 11:20'),
('DEMO-FS-ITM-007', 1, 0, 'GB2763-2021',   '草甘膦',           '≤ 0.1 mg/kg',    '0.14 mg/kg',    'fail', 'DEMO-BATCH-004', '2026-10-08 11:25'),
('DEMO-FS-ITM-008', 1, 0, 'GB2763-2021',   '多菌灵',           '≤ 3.0 mg/kg',    '1.20 mg/kg',    'pass', 'DEMO-BATCH-004', '2026-10-08 11:25'),
('DEMO-FS-ITM-009', 1, 0, 'GB7718-2011',   '生产日期标注',     '符合 GB 7718 要求', '标注规范',    'pass', 'DEMO-BATCH-005', '2026-10-07 09:40'),
('DEMO-FS-ITM-010', 1, 0, 'GB7718-2011',   '净含量标注',       '符合 GB 7718 要求', '标注规范',    'pass', 'DEMO-BATCH-005', '2026-10-07 09:40'),
('DEMO-FS-ITM-011', 1, 0, 'GB7718-2011',   '配料表标注',       '符合 GB 7718 要求', '缺失配料表',  'fail', 'DEMO-BATCH-001', '2026-10-07 09:45'),
('DEMO-FS-ITM-012', 1, 0, 'GB7718-2011',   '贮存条件标注',     '符合 GB 7718 要求', '标注规范',    'pass', 'DEMO-BATCH-001', '2026-10-07 09:45'),
('DEMO-FS-ITM-013', 1, 0, 'NYT391-2021',   '土壤 pH 值',       '6.0 ~ 7.5',      '6.8',           'pass', 'DEMO-BATCH-002', '2026-10-06 14:10'),
('DEMO-FS-ITM-014', 1, 0, 'NYT391-2021',   '灌溉水总汞',       '≤ 0.001 mg/L',   '0.0006 mg/L',   'pass', 'DEMO-BATCH-002', '2026-10-06 14:10'),
('DEMO-FS-ITM-015', 1, 0, 'NYT391-2021',   '土壤镉含量',       '≤ 0.30 mg/kg',   '0.28 mg/kg',    'pass', 'DEMO-BATCH-003', '2026-10-06 14:15'),
('DEMO-FS-ITM-016', 1, 0, 'NYT391-2021',   '空气质量总悬浮物', '≤ 0.30 mg/m³',   '0.27 mg/m³',    'pass', 'DEMO-BATCH-003', '2026-10-06 14:15'),
('DEMO-FS-ITM-017', 1, 0, 'GBT19630-2019', '有机转换期',       '≥ 24 个月',      '已满 36 个月',  'pass', 'DEMO-BATCH-004', '2026-10-05 15:30'),
('DEMO-FS-ITM-018', 1, 0, 'GBT19630-2019', '禁用物质检测',     '不得检出',       '未检出',        'pass', 'DEMO-BATCH-004', '2026-10-05 15:30'),
('DEMO-FS-ITM-019', 1, 0, 'GBT19630-2019', '投入品清单完整性', '齐全',           '缺少种子来源记录', 'fail', 'DEMO-BATCH-005', '2026-10-05 15:35'),
('DEMO-FS-ITM-020', 1, 0, 'GBT19630-2019', '缓冲带设置',       '≥ 8 米',         '10 米',         'pass', 'DEMO-BATCH-005', '2026-10-05 15:35'),
('DEMO-FS-ITM-101', 1, 0, 'GB2762-2022',   '铅（以 Pb 计）',   '≤ 0.2 mg/kg',    '0.11 mg/kg',    'pass', 'DEMO-BATCH-001', '2026-09-09 10:00'),
('DEMO-FS-ITM-102', 1, 0, 'GB2762-2022',   '镉（以 Cd 计）',   '≤ 0.05 mg/kg',   '0.06 mg/kg',    'fail', 'DEMO-BATCH-001', '2026-09-09 10:00'),
('DEMO-FS-ITM-103', 1, 0, 'GB2762-2022',   '总砷（以 As 计）', '≤ 0.5 mg/kg',    '0.44 mg/kg',    'pass', 'DEMO-BATCH-002', '2026-09-09 10:05'),
('DEMO-FS-ITM-104', 1, 0, 'GB2762-2022',   '汞（以 Hg 计）',   '≤ 0.01 mg/kg',   '0.005 mg/kg',   'pass', 'DEMO-BATCH-002', '2026-09-09 10:05'),
('DEMO-FS-ITM-105', 1, 0, 'GB2763-2021',   '毒死蜱',           '≤ 0.02 mg/kg',   '0.026 mg/kg',   'fail', 'DEMO-BATCH-003', '2026-09-08 11:20'),
('DEMO-FS-ITM-106', 1, 0, 'GB2763-2021',   '吡虫啉',           '≤ 0.5 mg/kg',    '0.42 mg/kg',    'pass', 'DEMO-BATCH-003', '2026-09-08 11:20'),
('DEMO-FS-ITM-107', 1, 0, 'GB2763-2021',   '草甘膦',           '≤ 0.1 mg/kg',    '0.07 mg/kg',    'pass', 'DEMO-BATCH-004', '2026-09-08 11:25'),
('DEMO-FS-ITM-108', 1, 0, 'GB2763-2021',   '多菌灵',           '≤ 3.0 mg/kg',    '3.40 mg/kg',    'fail', 'DEMO-BATCH-004', '2026-09-08 11:25'),
('DEMO-FS-ITM-109', 1, 0, 'GB7718-2011',   '生产日期标注',     '符合 GB 7718 要求', '标注规范',    'pass', 'DEMO-BATCH-005', '2026-09-07 09:40'),
('DEMO-FS-ITM-110', 1, 0, 'GB7718-2011',   '净含量标注',       '符合 GB 7718 要求', '标注规范',    'pass', 'DEMO-BATCH-005', '2026-09-07 09:40'),
('DEMO-FS-ITM-111', 1, 0, 'GB7718-2011',   '配料表标注',       '符合 GB 7718 要求', '标注规范',    'pass', 'DEMO-BATCH-001', '2026-09-07 09:45'),
('DEMO-FS-ITM-112', 1, 0, 'GB7718-2011',   '贮存条件标注',     '符合 GB 7718 要求', '缺失贮存条件', 'fail', 'DEMO-BATCH-001', '2026-09-07 09:45'),
('DEMO-FS-ITM-113', 1, 0, 'NYT391-2021',   '土壤 pH 值',       '6.0 ~ 7.5',      '5.6',           'fail', 'DEMO-BATCH-002', '2026-09-06 14:10'),
('DEMO-FS-ITM-114', 1, 0, 'NYT391-2021',   '灌溉水总汞',       '≤ 0.001 mg/L',   '0.0008 mg/L',   'pass', 'DEMO-BATCH-002', '2026-09-06 14:10'),
('DEMO-FS-ITM-115', 1, 0, 'NYT391-2021',   '土壤镉含量',       '≤ 0.30 mg/kg',   '0.33 mg/kg',    'fail', 'DEMO-BATCH-003', '2026-09-06 14:15'),
('DEMO-FS-ITM-116', 1, 0, 'NYT391-2021',   '空气质量总悬浮物', '≤ 0.30 mg/m³',   '0.22 mg/m³',    'pass', 'DEMO-BATCH-003', '2026-09-06 14:15'),
('DEMO-FS-ITM-117', 1, 0, 'GBT19630-2019', '有机转换期',       '≥ 24 个月',      '已满 30 个月',  'pass', 'DEMO-BATCH-004', '2026-09-05 15:30'),
('DEMO-FS-ITM-118', 1, 0, 'GBT19630-2019', '禁用物质检测',     '不得检出',       '检出微量禁用物质', 'fail', 'DEMO-BATCH-004', '2026-09-05 15:30'),
('DEMO-FS-ITM-119', 1, 0, 'GBT19630-2019', '投入品清单完整性', '齐全',           '齐全',          'pass', 'DEMO-BATCH-005', '2026-09-05 15:35'),
('DEMO-FS-ITM-120', 1, 0, 'GBT19630-2019', '缓冲带设置',       '≥ 8 米',         '6 米',          'fail', 'DEMO-BATCH-005', '2026-09-05 15:35');

-- 6.8 标准校验汇总：5 标准合计 1240 批 / 通过 1151 批 = 92.8%（对齐契约 §4.7 建议口径）。
DELETE FROM prod_fs_standard_summary WHERE summary_id LIKE 'DEMO-FS-%';
INSERT INTO prod_fs_standard_summary (summary_id, market_id, tenant_id, standard_no, batch_count, pass_count, fail_count, pass_rate, last_run_time) VALUES
('DEMO-FS-SUM-001', 1, 0, 'GB2762-2022',   320, 302, 18, 94.4, '2026-10-09 10:10'),
('DEMO-FS-SUM-002', 1, 0, 'GB2763-2021',   280, 254, 26, 90.7, '2026-10-08 11:30'),
('DEMO-FS-SUM-003', 1, 0, 'GB7718-2011',   210, 196, 14, 93.3, '2026-10-07 09:50'),
('DEMO-FS-SUM-004', 1, 0, 'NYT391-2021',   240, 224, 16, 93.3, '2026-10-06 14:20'),
('DEMO-FS-SUM-005', 1, 0, 'GBT19630-2019', 190, 175, 15, 92.1, '2026-10-05 15:40');

-- 6.9 可信农产品：16 条，覆盖 4 个等级 / 3 种认证 / 3 种审核状态。
--     统计口径：total=16，diamond 5 / gold 5 / silver 4 / normal 2，pending 2（未审核）。
DELETE FROM prod_fs_trust_product WHERE product_id LIKE 'DEMO-FS-%';
INSERT INTO prod_fs_trust_product (product_id, market_id, tenant_id, product_name, category, producer, trust_level, trust_score, cert_mark, cert_org, valid_until, audit_status) VALUES
('DEMO-FS-TRP-001', 1, 0, '有机番茄',   '蔬菜', '【演示】华南绿色蔬菜示范农场', 'diamond', 96, 'organic',        '中绿华夏有机食品认证中心', '2027-05-31', 'approved'),
('DEMO-FS-TRP-002', 1, 0, '稻渔香米',   '粮食', '【演示】江汉稻渔综合种养农场', 'diamond', 94, 'green',          '中国绿色食品发展中心',     '2027-03-31', 'approved'),
('DEMO-FS-TRP-003', 1, 0, '生态稻米',   '粮食', '【演示】西北高原生态牧场',     'diamond', 93, 'organic',        '中绿华夏有机食品认证中心', '2026-12-31', 'approved'),
('DEMO-FS-TRP-004', 1, 0, '精品黄瓜',   '蔬菜', '【演示】华东智慧稻田农场',     'diamond', 91, 'green',          '中国绿色食品发展中心',     '2027-08-31', 'approved'),
('DEMO-FS-TRP-005', 1, 0, '鲜切花苗',   '茶叶', '【演示】滇中花卉种苗基地',     'diamond', 90, 'pollution-free', '云南省农产品质量安全中心', '2027-01-31', 'approved'),
('DEMO-FS-TRP-006', 1, 0, '绿色辣椒',   '蔬菜', '【演示】鲁中设施果蔬农场',     'gold',    88, 'green',          '中国绿色食品发展中心',     '2027-06-30', 'approved'),
('DEMO-FS-TRP-007', 1, 0, '高原稻谷',   '粮食', '【演示】西北高原生态牧场',     'gold',    87, 'organic',        '中绿华夏有机食品认证中心', '2027-04-30', 'approved'),
('DEMO-FS-TRP-008', 1, 0, '小番茄',     '蔬菜', '【演示】华南绿色蔬菜示范农场', 'gold',    85, 'pollution-free', '广东省农产品质量安全中心', '2027-02-28', 'approved'),
('DEMO-FS-TRP-009', 1, 0, '温室黄瓜',   '蔬菜', '【演示】华东智慧稻田农场',     'gold',    83, 'green',          '中国绿色食品发展中心',     '2026-11-30', 'approved'),
('DEMO-FS-TRP-010', 1, 0, '螺丝椒',     '蔬菜', '【演示】鲁中设施果蔬农场',     'gold',    80, 'none',           NULL,                       NULL,         'approved'),
('DEMO-FS-TRP-011', 1, 0, '稻渔米',     '粮油', '【演示】江汉稻渔综合种养农场', 'silver',  76, 'pollution-free', '湖北省农产品质量安全中心', '2027-07-31', 'approved'),
('DEMO-FS-TRP-012', 1, 0, '种苗礼盒',   '茶叶', '【演示】滇中花卉种苗基地',     'silver',  74, 'none',           NULL,                       NULL,         'approved'),
('DEMO-FS-TRP-013', 1, 0, '生态鸡蛋',   '禽蛋', '【演示】华南绿色蔬菜示范农场', 'silver',  71, 'pollution-free', '广东省农产品质量安全中心', '2027-09-30', 'approved'),
('DEMO-FS-TRP-014', 1, 0, '塘鱼',       '水产', '【演示】江汉稻渔综合种养农场', 'silver',  68, 'none',           NULL,                       NULL,         'approved'),
('DEMO-FS-TRP-015', 1, 0, '散养土鸡',   '畜牧', '【演示】西北高原生态牧场',     'normal',  62, 'none',           NULL,                       NULL,         'pending'),
('DEMO-FS-TRP-016', 1, 0, '时令蔬菜包', '蔬菜', '【演示】鲁中设施果蔬农场',     'normal',  58, 'none',           NULL,                       NULL,         'pending');

-- 6.10 冷链资源：12 条；口径 coldChainPassRate = 非离线资源占比 = (12-2)/12 = 83.3%。
DELETE FROM prod_fs_cold_chain_resource WHERE resource_id LIKE 'DEMO-FS-%';
INSERT INTO prod_fs_cold_chain_resource (resource_id, market_id, tenant_id, resource_name, resource_type, type_label, spec, temp_range, city, district, resource_status, rating, contact_name, contact_phone, last_maintain_date) VALUES
('DEMO-FS-CCR-001', 1, 0, '粤A·8F231',  'vehicle',   '冷链车', '20吨',    '-18°C ~ 5°C', '广州市', '白云区', 'idle',    4.8, '陈志强', '13800001101', '2026-08-15'),
('DEMO-FS-CCR-002', 1, 0, '粤A·6K908',  'vehicle',   '冷链车', '15吨',    '-18°C ~ 0°C', '广州市', '番禺区', 'busy',    4.6, '李伟明', '13800001102', '2026-07-28'),
('DEMO-FS-CCR-003', 1, 0, '沪B·2D457',  'vehicle',   '冷链车', '10吨',    '0°C ~ 8°C',   '上海市', '青浦区', 'idle',    4.9, '王建国', '13800001103', '2026-09-02'),
('DEMO-FS-CCR-004', 1, 0, '苏C·5T112',  'vehicle',   '冷链车', '30吨',    '-25°C ~ 5°C', '南京市', '江宁区', 'busy',    4.3, '赵晓东', '13800001104', '2026-06-20'),
('DEMO-FS-CCR-005', 1, 0, '云A·9H663',  'vehicle',   '冷链车', '8吨',     '-18°C ~ 5°C', '昆明市', '呈贡区', 'idle',    4.7, '杨春林', '13800001105', '2026-08-30'),
('DEMO-FS-CCR-006', 1, 0, '粤A·3L889',  'vehicle',   '冷链车', '12吨',    '-18°C ~ 0°C', '广州市', '增城区', 'offline', 4.1, '刘海涛', '13800001106', '2026-05-12'),
('DEMO-FS-CCR-007', 1, 0, '华南中心冷库A区', 'warehouse', '冷库', '5000m²', '-18°C ~ 5°C', '广州市', '白云区', 'idle',  4.9, '周慧敏', '13800001107', '2026-09-10'),
('DEMO-FS-CCR-008', 1, 0, '华南中心冷库B区', 'warehouse', '冷库', '3200m²', '0°C ~ 10°C',  '广州市', '白云区', 'busy',  4.7, '周慧敏', '13800001107', '2026-09-10'),
('DEMO-FS-CCR-009', 1, 0, '华东智慧冷库',    'warehouse', '冷库', '8000m²', '-25°C ~ 5°C', '上海市', '青浦区', 'idle',  4.8, '孙丽华', '13800001108', '2026-08-22'),
('DEMO-FS-CCR-010', 1, 0, '鲁中气调库',      'warehouse', '冷库', '2600m²', '0°C ~ 5°C',   '济南市', '历城区', 'busy',  4.4, '马国庆', '13800001109', '2026-07-15'),
('DEMO-FS-CCR-011', 1, 0, '滇中花卉冷库',    'warehouse', '冷库', '1800m²', '2°C ~ 8°C',   '昆明市', '呈贡区', 'idle',  4.6, '杨春林', '13800001105', '2026-08-08'),
('DEMO-FS-CCR-012', 1, 0, '江汉稻米冷库',    'warehouse', '冷库', '4000m²', '0°C ~ 15°C',  '武汉市', '江夏区', 'offline', 4.0, '吴志远', '13800001110', '2026-04-26');

-- 6.11 冷链撮合记录：8 条，覆盖 3 种状态。
DELETE FROM prod_fs_cold_chain_match WHERE match_id LIKE 'DEMO-FS-%';
INSERT INTO prod_fs_cold_chain_match (match_id, market_id, tenant_id, resource_id, supplier_name, resource_type_label, demander, cargo, temp_require, start_time, match_time, match_status, remark) VALUES
('DEMO-FS-CCM-001', 1, 0, 'DEMO-FS-CCR-002', '粤A·6K908',       '冷链车', '【演示】华南绿色蔬菜示范农场', '有机番茄冷链配送', '-18°C ~ 0°C', '2026-10-10', '2026-10-10 08:30', 'processing', '早班发车'),
('DEMO-FS-CCM-002', 1, 0, 'DEMO-FS-CCR-004', '苏C·5T112',       '冷链车', '【演示】鲁中设施果蔬农场',     '绿色辣椒冷藏运输', '-25°C ~ 5°C', '2026-10-09', '2026-10-09 14:10', 'done',       '已完成交付'),
('DEMO-FS-CCM-003', 1, 0, 'DEMO-FS-CCR-008', '华南中心冷库B区', '冷库',   '【演示】华南绿色蔬菜示范农场', '净菜暂存',         '0°C ~ 10°C',  '2026-10-09', '2026-10-09 10:05', 'processing', NULL),
('DEMO-FS-CCM-004', 1, 0, 'DEMO-FS-CCR-010', '鲁中气调库',      '冷库',   '【演示】鲁中设施果蔬农场',     '果蔬气调贮存',     '0°C ~ 5°C',   '2026-10-08', '2026-10-08 16:20', 'done',       '已入库'),
('DEMO-FS-CCM-005', 1, 0, 'DEMO-FS-CCR-001', '粤A·8F231',       '冷链车', '【演示】江汉稻渔综合种养农场', '稻渔香米配送',     '-18°C ~ 5°C', '2026-10-12', '2026-10-08 09:15', 'queued',     '资源排期待释放'),
('DEMO-FS-CCM-006', 1, 0, 'DEMO-FS-CCR-009', '华东智慧冷库',    '冷库',   '【演示】华东智慧稻田农场',     '生态稻米贮存',     '-25°C ~ 5°C', '2026-10-11', '2026-10-07 15:40', 'queued',     '等待库位释放'),
('DEMO-FS-CCM-007', 1, 0, 'DEMO-FS-CCR-005', '云A·9H663',       '冷链车', '【演示】滇中花卉种苗基地',     '鲜切花苗冷链运输', '-18°C ~ 5°C', '2026-10-07', '2026-10-07 07:50', 'done',       '已完成交付'),
('DEMO-FS-CCM-008', 1, 0, 'DEMO-FS-CCR-011', '滇中花卉冷库',    '冷库',   '【演示】滇中花卉种苗基地',     '花苗预冷',         '2°C ~ 8°C',   '2026-10-06', '2026-10-06 11:30', 'done',       '已完成预冷');
