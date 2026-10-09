-- =====================================================================
-- core-platform V2 生产域（PRD 第 11 章）结构补齐
-- 纪律：生产模块表一律 prod_ 前缀（ArchUnit TablePrefixTest 门禁）；
--       V1 已建的 6 张表（prod_plot / prod_device / prod_batch / prod_trace_code /
--       prod_quality_report / prod_iot_alert）不重复创建，仅 ALTER 补齐字段。
--       每张表保留 market_id 行级隔离列（ADR-005，TenantLineInnerInterceptor 注入）。
--
-- 遗留表与终态口径（架构侧已裁决，本轮只标注、不迁移、不 DROP）：
--   1) prod_plot：V1 存量地块表，雪花 Long 主键。
--      本轮起所有地块接口已迁至 prod_plot_info（varchar(32) 业务主键），
--      该表不再被任何 Controller/Service 引用，属待处置遗留表，
--      后续如需统一由专项迁移处理。
--   2) 批次体系：最终以 prod_harvest_batch（PRD 11.2.5 采收批次）为准，是采收批次的权威表。
--      prod_batch 是 V1 的旧「农事批次」概念，保留仅供存量链路兼容，
--      新生产链路一律使用 prod_harvest_batch。
-- =====================================================================

-- ------------------------------------------------ 农场档案与认证（用户端）

CREATE TABLE prod_farm_info (
    farm_id        VARCHAR(32)   NOT NULL COMMENT 'farmId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    farm_code      VARCHAR(32)   COMMENT '农场编码（租户内唯一）',
    farm_name      VARCHAR(100)  COMMENT '农场名称',
    farm_type      TINYINT       COMMENT '农场类型 1种植 2养殖 3混合',
    province       VARCHAR(32)   COMMENT '省',
    city           VARCHAR(32)   COMMENT '市',
    district       VARCHAR(32)   COMMENT '区县',
    address        VARCHAR(200)  COMMENT '详细地址',
    area_total     DECIMAL(12,2) COMMENT '总面积（亩）',
    manager_name   VARCHAR(50)   COMMENT '负责人',
    manager_phone  VARCHAR(50)   COMMENT '联系电话',
    status         TINYINT       COMMENT '状态 1启用 0停用',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (farm_id),
    KEY idx_farm_info_market (market_id),
    KEY idx_farm_info_status (status),
    UNIQUE KEY uk_farm_info_farm_code (farm_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '农场档案（生产基地主数据）';

CREATE TABLE prod_farm_cert (
    cert_id        VARCHAR(32)   NOT NULL COMMENT 'certId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    farm_id        VARCHAR(32)   COMMENT '所属农场ID',
    cert_type      VARCHAR(32)   COMMENT '认证类型 GREEN/ORGANIC/GEO/HACCP',
    cert_name      VARCHAR(100)  COMMENT '认证名称',
    cert_no        VARCHAR(64)   COMMENT '认证编号',
    issuer         VARCHAR(100)  COMMENT '发证机构',
    issue_date     DATE          COMMENT '发证日期',
    expire_date    DATE          COMMENT '有效期至',
    attach_url     VARCHAR(255)  COMMENT '证书附件',
    status         TINYINT       COMMENT '状态 1有效 2临期 3过期 0作废',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (cert_id),
    KEY idx_farm_cert_market (market_id),
    KEY idx_farm_cert_farm (farm_id),
    KEY idx_farm_cert_status (status),
    UNIQUE KEY uk_farm_cert_cert_no (cert_no)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '农场认证（绿色/有机/无公害等）';

-- ------------------------------------------------ 地块/棚管理（用户端）

CREATE TABLE prod_plot_info (
    plot_id        VARCHAR(32)   NOT NULL COMMENT 'plotId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    farm_id        VARCHAR(32)   COMMENT '所属农场ID',
    plot_code      VARCHAR(32)   COMMENT '地块编码（租户内唯一）',
    plot_name      VARCHAR(100)  COMMENT '地块名称',
    area           DECIMAL(10,2) COMMENT '面积（亩）',
    planting_type  TINYINT       COMMENT '种植方式 1露天 2大棚 3水田 4山地',
    soil_type      VARCHAR(50)   COMMENT '土壤类型',
    irrigation_type VARCHAR(50)   COMMENT '灌溉方式',
    crop_id        VARCHAR(32)   COMMENT '当前作物ID',
    crop_variety   VARCHAR(32)   COMMENT '当前品种',
    current_plan_id VARCHAR(32)   COMMENT '当前种养计划ID',
    geo_boundary   TEXT          COMMENT '地块边界 GeoJSON',
    status         TINYINT       COMMENT '状态 1空闲 2在种 3采收期 4休耕 0停用',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (plot_id),
    KEY idx_plot_info_market (market_id),
    KEY idx_plot_info_farm (farm_id),
    KEY idx_plot_info_status (status),
    UNIQUE KEY uk_plot_info_plot_code (plot_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '地块/棚（生产底册，溯源链路起点）';

CREATE TABLE prod_plot_soil (
    soil_id        VARCHAR(32)   NOT NULL COMMENT 'soilId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    sample_date    DATE          COMMENT '采样日期',
    ph             DECIMAL(4,2)  COMMENT 'pH 值',
    organic_matter DECIMAL(8,2)  COMMENT '有机质(g/kg)',
    nitrogen       DECIMAL(8,2)  COMMENT '碱解氮(mg/kg)',
    phosphorus     DECIMAL(8,2)  COMMENT '有效磷(mg/kg)',
    potassium      DECIMAL(8,2)  COMMENT '速效钾(mg/kg)',
    moisture       DECIMAL(6,2)  COMMENT '含水率(%)',
    salinity       DECIMAL(8,2)  COMMENT '含盐量(g/kg)',
    tester         VARCHAR(50)   COMMENT '检测人',
    remark         VARCHAR(200)  COMMENT '备注',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (soil_id),
    KEY idx_plot_soil_market (market_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '地块土壤检测记录';

-- ------------------------------------------------ 种养计划与阶段（用户端）

CREATE TABLE prod_plan_info (
    plan_id        VARCHAR(32)   NOT NULL COMMENT 'planId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    farm_id        VARCHAR(32)   COMMENT '农场ID',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    plan_code      VARCHAR(32)   COMMENT '计划编码（租户内唯一）',
    plan_name      VARCHAR(100)  COMMENT '计划名称',
    crop_id        VARCHAR(32)   COMMENT '作物ID',
    crop_variety   VARCHAR(32)   COMMENT '品种',
    plan_start_date DATE          COMMENT '计划开始',
    plan_end_date  DATE          COMMENT '计划结束',
    expected_yield DECIMAL(12,2) COMMENT '预期产量',
    expected_amount DECIMAL(14,2) COMMENT '预期产值（元）',
    owner_id       VARCHAR(32)   COMMENT '负责人',
    status         TINYINT       COMMENT '状态 1草稿 2进行中 3已完成 4已终止 0作废',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (plan_id),
    KEY idx_plan_info_market (market_id),
    KEY idx_plan_info_farm (farm_id),
    KEY idx_plan_info_status (status),
    UNIQUE KEY uk_plan_info_plan_code (plan_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '种养计划（作物/品种/周期/预期产量）';

CREATE TABLE prod_plan_stage (
    stage_id       VARCHAR(32)   NOT NULL COMMENT 'stageId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    plan_id        VARCHAR(32)   COMMENT '计划ID',
    stage_name     VARCHAR(100)  COMMENT '阶段名称',
    stage_seq      INT           COMMENT '阶段序号',
    plan_start_date DATE          COMMENT '计划开始',
    plan_end_date  DATE          COMMENT '计划结束',
    task_type      VARCHAR(20)   COMMENT '默认任务类型',
    description    VARCHAR(500)  COMMENT '阶段说明',
    status         TINYINT       COMMENT '状态 1未开始 2进行中 3已完成 0取消',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (stage_id),
    KEY idx_plan_stage_market (market_id),
    KEY idx_plan_stage_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '种养计划阶段（整地/播种/施肥…）';

-- ------------------------------------------------ 农事任务与执行记录（用户端）

CREATE TABLE prod_task_info (
    task_id        VARCHAR(32)   NOT NULL COMMENT 'taskId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    task_no        VARCHAR(32)   COMMENT '任务单号（租户内唯一）',
    plan_id        VARCHAR(32)   COMMENT '计划ID',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    task_type      VARCHAR(20)   COMMENT '任务类型 整地/播种/施肥/打药/灌溉/采收',
    task_name      VARCHAR(100)  COMMENT '任务名称',
    plan_start_date DATE          COMMENT '计划开始',
    plan_end_date  DATE          COMMENT '计划结束',
    assignee_id    VARCHAR(32)   COMMENT '执行人',
    assigner_id    VARCHAR(32)   COMMENT '派发人',
    status         VARCHAR(20)   COMMENT '状态 pending/assigned/doing/done/rejected',
    priority       TINYINT       COMMENT '优先级 1高 2中 3低',
    template_id    VARCHAR(32)   COMMENT '来源模板ID',
    related_usage_ids JSON          COMMENT '关联投入品使用ID（JSON 数组）',
    reject_count   INT           COMMENT '驳回次数',
    accept_status  TINYINT       COMMENT '验收 0待验收 1通过 2驳回',
    completed_at   DATETIME      COMMENT '完成时间',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (task_id),
    KEY idx_task_info_market (market_id),
    KEY idx_task_info_status (status),
    UNIQUE KEY uk_task_info_task_no (task_no)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '农事任务（派发/执行/验收闭环）';

CREATE TABLE prod_task_record (
    record_id      VARCHAR(32)   NOT NULL COMMENT 'recordId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    task_id        VARCHAR(32)   COMMENT '任务ID',
    executor_id    VARCHAR(32)   COMMENT '执行人',
    execute_time   DATETIME      COMMENT '执行时间',
    execute_type   TINYINT       COMMENT '记录类型 1开始 2过程 3完成',
    photos         JSON          COMMENT '现场照片（JSON 数组）',
    gps_lat        DECIMAL(10,6) COMMENT '执行纬度',
    gps_lng        DECIMAL(10,6) COMMENT '执行经度',
    gps_distance   DECIMAL(8,2)  COMMENT '与地块中心距离（米）',
    abnormal_desc  VARCHAR(500)  COMMENT '异常说明',
    offline_flag   TINYINT       COMMENT '离线回传 0否 1是',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (record_id),
    KEY idx_task_record_market (market_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '农事任务执行记录（支持离线回传）';

CREATE TABLE prod_task_template (
    template_id    VARCHAR(32)   NOT NULL COMMENT 'templateId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    crop_id        VARCHAR(32)   COMMENT '作物ID',
    template_name  VARCHAR(100)  COMMENT '模板名称',
    task_type      VARCHAR(20)   COMMENT '任务类型',
    stage_seq      INT           COMMENT '适用阶段序号',
    interval_days  INT           COMMENT '距上一阶段间隔天数',
    work_hours     DECIMAL(8,2)  COMMENT '标准工时',
    work_content   VARCHAR(500)  COMMENT '作业内容',
    input_ids      JSON          COMMENT '建议投入品ID（JSON 数组）',
    status         TINYINT       COMMENT '状态 1启用 0停用',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (template_id),
    KEY idx_task_template_market (market_id),
    KEY idx_task_template_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '农事任务模板（按作物/阶段预置）';

-- ------------------------------------------------ 投入品与供应商（用户端）

CREATE TABLE prod_input_info (
    input_id       VARCHAR(32)   NOT NULL COMMENT 'inputId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    input_code     VARCHAR(32)   COMMENT '投入品编码（租户内唯一）',
    input_name     VARCHAR(100)  COMMENT '投入品名称',
    input_type     VARCHAR(20)   COMMENT '类型 SEED/FERTILIZER/PESTICIDE/FEED/VET',
    spec           VARCHAR(64)   COMMENT '规格',
    unit           VARCHAR(16)   COMMENT '计量单位',
    manufacturer   VARCHAR(100)  COMMENT '生产厂家',
    registration_no VARCHAR(64)   COMMENT '登记证号',
    safety_interval INT           COMMENT '安全间隔期（天）',
    stock_qty      DECIMAL(12,3) COMMENT '当前库存',
    warn_qty       DECIMAL(12,3) COMMENT '库存预警阈值',
    supplier_id    VARCHAR(32)   COMMENT '默认供应商ID',
    status         TINYINT       COMMENT '状态 1启用 0停用',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (input_id),
    KEY idx_input_info_market (market_id),
    KEY idx_input_info_status (status),
    UNIQUE KEY uk_input_info_input_code (input_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '投入品档案（种子/肥料/农药/饲料/兽药）';

CREATE TABLE prod_input_stock_flow (
    flow_id        VARCHAR(32)   NOT NULL COMMENT 'flowId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    input_id       VARCHAR(32)   COMMENT '投入品ID',
    warehouse_id   VARCHAR(32)   COMMENT '仓库ID',
    flow_type      TINYINT       COMMENT '流水类型 1入库 2领用 3退回 4盘盈 5盘亏 6报损',
    qty            DECIMAL(12,3) COMMENT '数量（出入库为负/正）',
    batch_no       VARCHAR(32)   COMMENT '批次号',
    expire_date    DATE          COMMENT '有效期至',
    operator_id    VARCHAR(32)   COMMENT '操作人',
    related_task_id VARCHAR(32)   COMMENT '关联农事任务ID',
    remark         VARCHAR(200)  COMMENT '备注',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (flow_id),
    KEY idx_input_stock_flow_market (market_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '投入品库存流水';

CREATE TABLE prod_input_usage (
    usage_id       VARCHAR(32)   NOT NULL COMMENT 'usageId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    task_id        VARCHAR(32)   COMMENT '农事任务ID',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    input_id       VARCHAR(32)   COMMENT '投入品ID',
    input_name     VARCHAR(100)  COMMENT '投入品名称',
    dosage         DECIMAL(12,3) COMMENT '用量',
    unit           VARCHAR(16)   COMMENT '单位',
    method         VARCHAR(50)   COMMENT '施用方式',
    operator_id    VARCHAR(32)   COMMENT '操作人',
    used_at        DATETIME      COMMENT '使用时间',
    safety_interval_days INT           COMMENT '安全间隔期（天）',
    status         TINYINT       COMMENT '状态 1正常 0作废',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (usage_id),
    KEY idx_input_usage_market (market_id),
    KEY idx_input_usage_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '投入品使用记录（农事任务落地，溯源关键证据）';

CREATE TABLE prod_supplier (
    supplier_id    VARCHAR(32)   NOT NULL COMMENT 'supplierId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    supplier_code  VARCHAR(32)   COMMENT '供应商编码（租户内唯一）',
    supplier_name  VARCHAR(100)  COMMENT '供应商名称',
    contact_name   VARCHAR(50)   COMMENT '联系人',
    contact_phone  VARCHAR(50)   COMMENT '联系电话',
    license_no     VARCHAR(64)   COMMENT '营业执照号',
    address        VARCHAR(200)  COMMENT '地址',
    credit_level   VARCHAR(16)   COMMENT '信用等级 A/B/C',
    cooperate_start DATE          COMMENT '合作起始日',
    status         TINYINT       COMMENT '状态 1合作中 0已终止',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (supplier_id),
    KEY idx_supplier_market (market_id),
    KEY idx_supplier_status (status),
    UNIQUE KEY uk_supplier_supplier_code (supplier_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '投入品供应商';

-- ------------------------------------------------ 生长监测记录（用户端）

CREATE TABLE prod_growth_record (
    record_id      VARCHAR(32)   NOT NULL COMMENT 'recordId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    plan_id        VARCHAR(32)   COMMENT '计划ID',
    batch_id       VARCHAR(32)   COMMENT '批次ID',
    crop_id        VARCHAR(32)   COMMENT '作物ID',
    growth_stage   VARCHAR(32)   COMMENT '生育期 苗期/花期/果期/成熟期',
    record_date    DATE          COMMENT '记录日期',
    height         DECIMAL(8,2)  COMMENT '株高(cm)',
    leaf_count     INT           COMMENT '叶片数',
    pest_level     TINYINT       COMMENT '病虫害等级 0无 1轻 2中 3重',
    weather        VARCHAR(50)   COMMENT '天气',
    photos         JSON          COMMENT '现场照片（JSON 数组）',
    recorder_id    VARCHAR(32)   COMMENT '记录人',
    remark         VARCHAR(500)  COMMENT '备注',
    status         TINYINT       COMMENT '状态 1有效 0作废',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (record_id),
    KEY idx_growth_record_market (market_id),
    KEY idx_growth_record_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '作物生长监测记录（株高/叶片/病虫害/气象）';

-- ------------------------------------------------ 告警规则与告警记录（用户端）

CREATE TABLE prod_alert_rule (
    rule_id        VARCHAR(32)   NOT NULL COMMENT 'ruleId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    farm_id        VARCHAR(32)   COMMENT '农场ID',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    device_id      VARCHAR(32)   COMMENT '设备ID',
    rule_name      VARCHAR(100)  COMMENT '规则名称',
    metric         VARCHAR(32)   COMMENT '监测指标 温度/湿度/土壤水分/CO2',
    operator       VARCHAR(8)    COMMENT '比较符 gt/lt/ge/le/eq',
    threshold_value DECIMAL(12,3) COMMENT '阈值',
    duration_min   INT           COMMENT '持续时长（分钟）',
    alert_level    VARCHAR(8)    COMMENT '告警级别 INFO/WARN/CRITICAL',
    notify_channels VARCHAR(100)  COMMENT '通知渠道 站内/短信/微信（逗号分隔）',
    enabled_flag   TINYINT       COMMENT '是否启用 1是 0否',
    status         TINYINT       COMMENT '状态 1正常 0删除',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (rule_id),
    KEY idx_alert_rule_market (market_id),
    KEY idx_alert_rule_farm (farm_id),
    KEY idx_alert_rule_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '告警规则（阈值/持续时长/通知渠道）';

CREATE TABLE prod_alert_info (
    alert_id       VARCHAR(32)   NOT NULL COMMENT 'alertId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    farm_id        VARCHAR(32)   COMMENT '农场ID',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    device_id      VARCHAR(32)   COMMENT '设备ID',
    rule_id        VARCHAR(32)   COMMENT '触发规则ID',
    alert_title    VARCHAR(100)  COMMENT '告警标题',
    metric         VARCHAR(32)   COMMENT '监测指标',
    metric_value   DECIMAL(12,3) COMMENT '触发值',
    alert_level    VARCHAR(8)    COMMENT '告警级别 INFO/WARN/CRITICAL',
    alert_time     DATETIME      COMMENT '告警时间',
    handle_by      VARCHAR(32)   COMMENT '处置人',
    handle_time    DATETIME      COMMENT '处置时间',
    handle_remark  VARCHAR(500)  COMMENT '处置说明',
    status         VARCHAR(20)   COMMENT '状态 PENDING/HANDLED/IGNORED',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (alert_id),
    KEY idx_alert_info_market (market_id),
    KEY idx_alert_info_farm (farm_id),
    KEY idx_alert_info_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '告警记录（规则触发后的处置闭环）';

-- ------------------------------------------------ IoT 设备与监测读数（用户端）

CREATE TABLE prod_iot_device (
    device_id      VARCHAR(32)   NOT NULL COMMENT 'deviceId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    device_code    VARCHAR(32)   COMMENT '设备编码（全局唯一）',
    device_name    VARCHAR(100)  COMMENT '设备名称',
    device_type    VARCHAR(20)   COMMENT '设备类型 SENSOR/CONTROLLER/CAMERA',
    farm_id        VARCHAR(32)   COMMENT '农场ID',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    manufacturer   VARCHAR(100)  COMMENT '厂商',
    model          VARCHAR(64)   COMMENT '型号',
    firmware       VARCHAR(32)   COMMENT '固件版本',
    install_date   DATE          COMMENT '安装日期',
    online_flag    TINYINT       COMMENT '在线状态 1在线 0离线',
    last_heartbeat_at DATETIME      COMMENT '最后心跳',
    status         TINYINT       COMMENT '状态 1启用 0停用',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (device_id),
    KEY idx_iot_device_market (market_id),
    KEY idx_iot_device_farm (farm_id),
    KEY idx_iot_device_status (status),
    UNIQUE KEY uk_iot_device_device_code (device_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = 'IoT 设备档案（采集与长连接在 satellite-iot）';

CREATE TABLE prod_iot_reading (
    reading_id     VARCHAR(32)   NOT NULL COMMENT 'readingId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    device_id      VARCHAR(32)   COMMENT '设备ID',
    device_code    VARCHAR(32)   COMMENT '设备编码',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    metric         VARCHAR(32)   COMMENT '监测指标',
    metric_value   DECIMAL(12,3) COMMENT '读数',
    unit           VARCHAR(16)   COMMENT '单位',
    read_time      DATETIME      COMMENT '采集时间',
    quality_flag   TINYINT       COMMENT '数据质量 1正常 0异常',
    raw_payload    VARCHAR(500)  COMMENT '原始报文',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (reading_id),
    KEY idx_iot_reading_market (market_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = 'IoT 监测读数（时序，卫星服务回传）';

-- ------------------------------------------------ 采收、批次与库存（用户端）
-- 【权威表】prod_harvest_batch 是采收批次的权威表（PRD 11.2.5），
--          新生产链路（采收 / 检测 / 库存 / 溯源挂载）一律以此表为准。
--          V1 的 prod_batch（旧农事批次）仅作存量链路兼容，不再承接新业务。

CREATE TABLE prod_harvest_batch (
    batch_id       VARCHAR(32)   NOT NULL COMMENT 'batchId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    batch_no       VARCHAR(32)   COMMENT '批次号（全局唯一）',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    plan_id        VARCHAR(32)   COMMENT '计划ID',
    crop_id        VARCHAR(32)   COMMENT '作物ID',
    crop_variety   VARCHAR(32)   COMMENT '品种',
    harvest_date   DATE          COMMENT '采收日期',
    quantity       DECIMAL(12,2) COMMENT '采收数量',
    unit           VARCHAR(10)   COMMENT '单位，默认 kg',
    grade          VARCHAR(10)   COMMENT '等级，默认 待检',
    inspection_id  VARCHAR(32)   COMMENT '检测报告ID',
    operator_id    VARCHAR(32)   COMMENT '采收人',
    status         TINYINT       COMMENT '状态 1在库 2部分出库 3清空 4冻结 5归档',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (batch_id),
    KEY idx_harvest_batch_market (market_id),
    KEY idx_harvest_batch_status (status),
    UNIQUE KEY uk_harvest_batch_batch_no (batch_no)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '采收批次（溯源主链：地块 → 采收 → 检测 → 批次 → 溯源码）';

CREATE TABLE prod_harvest_record (
    record_id      VARCHAR(32)   NOT NULL COMMENT 'recordId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    plan_id        VARCHAR(32)   COMMENT '计划ID',
    crop_id        VARCHAR(32)   COMMENT '作物ID',
    crop_variety   VARCHAR(32)   COMMENT '品种',
    harvest_date   DATE          COMMENT '采收日期',
    quantity       DECIMAL(12,2) COMMENT '采收数量',
    unit           VARCHAR(10)   COMMENT '单位',
    grade          VARCHAR(10)   COMMENT '等级',
    operator_id    VARCHAR(32)   COMMENT '采收人',
    weather        VARCHAR(50)   COMMENT '天气',
    remark         VARCHAR(500)  COMMENT '备注',
    status         TINYINT       COMMENT '状态 1有效 0作废',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (record_id),
    KEY idx_harvest_record_market (market_id),
    KEY idx_harvest_record_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '采收作业记录（每次下地采收的原始登记）';

CREATE TABLE prod_inventory_flow (
    flow_id        VARCHAR(32)   NOT NULL COMMENT 'flowId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    batch_id       VARCHAR(32)   COMMENT '采收批次ID',
    warehouse_id   VARCHAR(32)   COMMENT '仓库ID',
    flow_type      TINYINT       COMMENT '类型 1入库 2出库 3盘点 4损耗',
    qty            DECIMAL(12,2) COMMENT '变动数量（出库为负）',
    unit           VARCHAR(10)   COMMENT '单位',
    before_qty     DECIMAL(12,2) COMMENT '变动前库存',
    after_qty      DECIMAL(12,2) COMMENT '变动后库存',
    operator_id    VARCHAR(32)   COMMENT '操作人',
    related_order_no VARCHAR(32)   COMMENT '关联交易单号',
    remark         VARCHAR(200)  COMMENT '备注',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (flow_id),
    KEY idx_inventory_flow_market (market_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '批次库存流水（出入库/盘点/损耗）';

-- ------------------------------------------------ 质量检测与检测机构（用户端）

CREATE TABLE prod_inspection (
    inspection_id  VARCHAR(32)   NOT NULL COMMENT 'inspectionId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    inspection_no  VARCHAR(32)   COMMENT '检测单号（租户内唯一）',
    batch_id       VARCHAR(32)   COMMENT '采收批次ID',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    crop_id        VARCHAR(32)   COMMENT '作物ID',
    inspection_type VARCHAR(20)   COMMENT '检测类型 SELF/SEND/SAMPLING',
    inspector_id   VARCHAR(32)   COMMENT '检测人',
    inspector_name VARCHAR(50)   COMMENT '检测人姓名',
    sample_qty     DECIMAL(12,2) COMMENT '抽样数量',
    sample_at      DATETIME      COMMENT '抽样时间',
    result         VARCHAR(8)    COMMENT '结论 PASS/FAIL',
    report_url     VARCHAR(255)  COMMENT '检测报告',
    status         VARCHAR(20)   COMMENT '状态 PENDING/TESTING/DONE',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (inspection_id),
    KEY idx_inspection_market (market_id),
    KEY idx_inspection_status (status),
    UNIQUE KEY uk_inspection_inspection_no (inspection_no)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '质量检测（自检/送检/抽检）';

CREATE TABLE prod_quality_lab (
    lab_id         VARCHAR(32)   NOT NULL COMMENT 'labId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    lab_code       VARCHAR(32)   COMMENT '机构编码（租户内唯一）',
    lab_name       VARCHAR(100)  COMMENT '机构名称',
    lab_type       VARCHAR(20)   COMMENT '机构类型 第三方/政府/自建',
    contact_name   VARCHAR(50)   COMMENT '联系人',
    contact_phone  VARCHAR(50)   COMMENT '联系电话',
    address        VARCHAR(200)  COMMENT '地址',
    qualification_no VARCHAR(64)   COMMENT '资质编号',
    accredited_scope VARCHAR(500)  COMMENT '认可检测范围',
    status         TINYINT       COMMENT '状态 1合作中 0已终止',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (lab_id),
    KEY idx_quality_lab_market (market_id),
    KEY idx_quality_lab_status (status),
    UNIQUE KEY uk_quality_lab_lab_code (lab_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '检测机构/实验室（资质与认可范围）';

-- ------------------------------------------------ 区块链存证（用户端）

CREATE TABLE prod_blockchain_record (
    record_id      VARCHAR(32)   NOT NULL COMMENT 'recordId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    biz_type       VARCHAR(20)   COMMENT '业务类型 TRACE/INSPECTION/HARVEST',
    biz_no         VARCHAR(32)   COMMENT '业务单号',
    batch_id       VARCHAR(32)   COMMENT '批次ID',
    trace_code     VARCHAR(64)   COMMENT '溯源码',
    chain_type     VARCHAR(20)   COMMENT '链类型 如 TrustChain/FISCO',
    chain_network  VARCHAR(32)   COMMENT '链网络标识',
    tx_hash        VARCHAR(128)  COMMENT '交易哈希',
    block_height   BIGINT        COMMENT '区块高度',
    payload_hash   VARCHAR(128)  COMMENT '存证内容哈希',
    anchor_at      DATETIME      COMMENT '上链时间',
    status         VARCHAR(20)   COMMENT '状态 PENDING/SUCCESS/FAILED',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (record_id),
    KEY idx_blockchain_record_market (market_id),
    KEY idx_blockchain_record_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '区块链存证记录（溯源关键数据锚定）';

-- ------------------------------------------------ AI 识别与诊断（用户端，模型能力在 satellite-ai-gateway）

CREATE TABLE prod_ai_diagnosis (
    diagnosis_id   VARCHAR(32)   NOT NULL COMMENT 'diagnosisId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    crop_id        VARCHAR(32)   COMMENT '作物ID',
    crop_name      VARCHAR(64)   COMMENT '作物名称',
    image_url      VARCHAR(255)  COMMENT '识别图片',
    diagnosis_type VARCHAR(20)   COMMENT '诊断类型 PEST/GROWTH/MATURITY',
    result_label   VARCHAR(100)  COMMENT '识别结果',
    confidence     DECIMAL(5,2)  COMMENT '置信度(%)',
    suggestion     VARCHAR(1000) COMMENT '处置建议',
    model_name     VARCHAR(64)   COMMENT '模型名称',
    diagnosed_at   DATETIME      COMMENT '诊断时间',
    status         VARCHAR(20)   COMMENT '状态 PENDING/SUCCESS/FAILED',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (diagnosis_id),
    KEY idx_ai_diagnosis_market (market_id),
    KEY idx_ai_diagnosis_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = 'AI 诊断记录（病虫害/长势/成熟度识别）';

-- ------------------------------------------------ 生产数据分析（用户端）

CREATE TABLE prod_analytics_snapshot (
    snapshot_id    VARCHAR(32)   NOT NULL COMMENT 'snapshotId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    farm_id        VARCHAR(32)   COMMENT '农场ID',
    plot_id        VARCHAR(32)   COMMENT '地块ID',
    biz_date       DATE          COMMENT '业务日期',
    metric_code    VARCHAR(32)   COMMENT '指标编码 YIELD/COST/PASS_RATE',
    metric_name    VARCHAR(64)   COMMENT '指标名称',
    metric_value   DECIMAL(16,4) COMMENT '指标值',
    unit           VARCHAR(16)   COMMENT '单位',
    dim_type       VARCHAR(16)   COMMENT '维度类型 FARM/PLOT/CROP',
    dim_value      VARCHAR(64)   COMMENT '维度值',
    status         TINYINT       COMMENT '状态 1有效 0失效',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (snapshot_id),
    KEY idx_analytics_snapshot_market (market_id),
    KEY idx_analytics_snapshot_farm (farm_id),
    KEY idx_analytics_snapshot_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '分析指标快照（产量/成本/达标率，T+1 汇聚）';

-- ------------------------------------------------ 生产团队与人员（用户端）

CREATE TABLE prod_member (
    member_id      VARCHAR(32)   NOT NULL COMMENT 'memberId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    farm_id        VARCHAR(32)   COMMENT '农场ID',
    user_id        VARCHAR(32)   COMMENT '平台用户ID',
    member_name    VARCHAR(50)   COMMENT '姓名',
    member_type    VARCHAR(20)   COMMENT '成员类型 OWNER/AGRONOMIST/INSPECTOR/OPERATOR',
    phone          VARCHAR(20)   COMMENT '手机号',
    role_code      VARCHAR(32)   COMMENT '角色编码',
    post_name      VARCHAR(50)   COMMENT '岗位',
    join_date      DATE          COMMENT '加入日期',
    status         TINYINT       COMMENT '状态 1在职 0离职',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (member_id),
    KEY idx_member_market (market_id),
    KEY idx_member_farm (farm_id),
    KEY idx_member_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '生产团队成员（农场主/农技员/巡检员/操作员）';

-- ------------------------------------------------ 生产域消息通知（用户端）

CREATE TABLE prod_message_notify (
    message_id     VARCHAR(32)   NOT NULL COMMENT 'messageId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    farm_id        VARCHAR(32)   COMMENT '农场ID',
    receiver_id    VARCHAR(32)   COMMENT '接收人',
    msg_type       VARCHAR(20)   COMMENT '消息类型 TASK/ALERT/QUALITY/SYSTEM',
    title          VARCHAR(128)  COMMENT '标题',
    content        VARCHAR(1000) COMMENT '内容',
    biz_id         VARCHAR(32)   COMMENT '业务ID',
    read_flag      TINYINT       COMMENT '已读 0否 1是',
    sent_at        DATETIME      COMMENT '发送时间',
    read_at        DATETIME      COMMENT '阅读时间',
    channel        VARCHAR(20)   COMMENT '渠道 INBOX/SMS/WECHAT',
    status         TINYINT       COMMENT '状态 1有效 0撤回',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (message_id),
    KEY idx_message_notify_market (market_id),
    KEY idx_message_notify_farm (farm_id),
    KEY idx_message_notify_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '站内通知（任务/告警/质检/系统）';

-- ------------------------------------------------ 生产域系统设置（用户端）

CREATE TABLE prod_sys_setting (
    setting_id     VARCHAR(32)   NOT NULL COMMENT 'settingId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    farm_id        VARCHAR(32)   COMMENT '农场ID（空表示租户级）',
    setting_group  VARCHAR(32)   COMMENT '配置分组 ALERT/TRACE/QUALITY',
    setting_key    VARCHAR(64)   COMMENT '配置键',
    setting_name   VARCHAR(100)  COMMENT '配置名称',
    setting_value  VARCHAR(500)  COMMENT '配置值',
    default_value  VARCHAR(500)  COMMENT '默认值',
    value_type     VARCHAR(16)   COMMENT '值类型 STRING/NUMBER/BOOLEAN/JSON',
    remark         VARCHAR(200)  COMMENT '备注',
    status         TINYINT       COMMENT '状态 1启用 0停用',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (setting_id),
    KEY idx_sys_setting_market (market_id),
    KEY idx_sys_setting_farm (farm_id),
    KEY idx_sys_setting_status (status),
    UNIQUE KEY uk_sys_setting_setting_key (setting_key)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '系统配置项（租户/农场级参数）';

-- ------------------------------------------------ 运营端：租户与配额管理

CREATE TABLE prod_tenant_quota (
    quota_id       VARCHAR(32)   NOT NULL COMMENT 'quotaId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    tenant_code    VARCHAR(32)   COMMENT '租户编码',
    tenant_name    VARCHAR(100)  COMMENT '租户名称',
    farm_limit     INT           COMMENT '农场数上限',
    plot_limit     INT           COMMENT '地块数上限',
    device_limit   INT           COMMENT '设备数上限',
    user_limit     INT           COMMENT '用户数上限',
    storage_limit_gb DECIMAL(12,2) COMMENT '存储空间上限(GB)',
    trace_code_limit INT           COMMENT '溯源码上限',
    api_call_limit INT           COMMENT '日 API 调用上限',
    used_farm_count INT           COMMENT '已用农场数',
    status         TINYINT       COMMENT '状态 1正常 0停用',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (quota_id),
    KEY idx_tenant_quota_market (market_id),
    KEY idx_tenant_quota_status (status),
    UNIQUE KEY uk_tenant_quota_tenant_code (tenant_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '租户配额（SaaS 资源上限与用量）';

-- ------------------------------------------------ 运营端：审批流程

CREATE TABLE prod_approval (
    approval_id    VARCHAR(32)   NOT NULL COMMENT 'approvalId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    biz_type       VARCHAR(20)   COMMENT '业务类型 CERT/RECALL/QUOTA',
    biz_id         VARCHAR(32)   COMMENT '业务ID',
    title          VARCHAR(128)  COMMENT '审批标题',
    applicant_id   VARCHAR(32)   COMMENT '申请人',
    applicant_name VARCHAR(50)   COMMENT '申请人姓名',
    approve_level  INT           COMMENT '审批层级',
    current_approver_id VARCHAR(32)   COMMENT '当前审批人',
    approve_opinion VARCHAR(500)  COMMENT '审批意见',
    submit_at      DATETIME      COMMENT '提交时间',
    approve_at     DATETIME      COMMENT '审批时间',
    status         VARCHAR(20)   COMMENT '状态 PENDING/APPROVED/REJECTED',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (approval_id),
    KEY idx_approval_market (market_id),
    KEY idx_approval_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '审批单（认证/召回/配额变更等）';

-- ------------------------------------------------ 运营端：标准作业规程库

CREATE TABLE prod_sop_library (
    sop_id         VARCHAR(32)   NOT NULL COMMENT 'sopId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    crop_id        VARCHAR(32)   COMMENT '作物ID',
    sop_code       VARCHAR(32)   COMMENT '规程编码',
    sop_name       VARCHAR(100)  COMMENT '规程名称',
    sop_type       VARCHAR(20)   COMMENT '规程类型 PLANT/PEST/HARVEST',
    version_no     VARCHAR(16)   COMMENT '版本号',
    content_url    VARCHAR(255)  COMMENT '规程文件',
    stage_seq      INT           COMMENT '适用阶段序号',
    applicable_region VARCHAR(100)  COMMENT '适用区域',
    publisher      VARCHAR(50)   COMMENT '发布人',
    status         TINYINT       COMMENT '状态 1发布 0草稿',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (sop_id),
    KEY idx_sop_library_market (market_id),
    KEY idx_sop_library_status (status),
    UNIQUE KEY uk_sop_library_sop_code (sop_code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = 'SOP 标准作业规程库（按作物/阶段下发）';

-- ------------------------------------------------ 运营端：监管报表任务

CREATE TABLE prod_report_task (
    report_id      VARCHAR(32)   NOT NULL COMMENT 'reportId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    report_type    VARCHAR(20)   COMMENT '报表类型 GOV/BIZ/QUALITY',
    report_name    VARCHAR(100)  COMMENT '报表名称',
    farm_id        VARCHAR(32)   COMMENT '农场ID（空表示全量）',
    biz_date_from  DATE          COMMENT '统计起始日',
    biz_date_to    DATE          COMMENT '统计截止日',
    generator_id   VARCHAR(32)   COMMENT '生成人',
    file_url       VARCHAR(255)  COMMENT '报表文件',
    generated_at   DATETIME      COMMENT '生成时间',
    status         VARCHAR(20)   COMMENT '状态 PENDING/RUNNING/DONE/FAILED',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (report_id),
    KEY idx_report_task_market (market_id),
    KEY idx_report_task_farm (farm_id),
    KEY idx_report_task_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '监管/经营报表生成任务';

-- ------------------------------------------------ 运营端：农技知识库

CREATE TABLE prod_knowledge_article (
    article_id     VARCHAR(32)   NOT NULL COMMENT 'articleId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    category_code  VARCHAR(32)   COMMENT '分类编码',
    title          VARCHAR(128)  COMMENT '标题',
    summary        VARCHAR(500)  COMMENT '摘要',
    content_url    VARCHAR(255)  COMMENT '正文/附件',
    author         VARCHAR(50)   COMMENT '作者',
    source         VARCHAR(100)  COMMENT '来源',
    read_count     INT           COMMENT '阅读数',
    publish_at     DATETIME      COMMENT '发布时间',
    status         TINYINT       COMMENT '状态 1已发布 0草稿',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (article_id),
    KEY idx_knowledge_article_market (market_id),
    KEY idx_knowledge_article_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '农技知识文章（种植/植保/政策）';

-- =====================================================================
-- V1 已建生产表字段补齐（不重复建表，仅 ALTER 追加 PRD 11.2 缺失列）
-- =====================================================================

ALTER TABLE prod_plot
    ADD COLUMN farm_id       VARCHAR(32)  NULL COMMENT '所属农场ID',
    ADD COLUMN plot_code     VARCHAR(32)  NULL COMMENT '地块编码',
    ADD COLUMN planting_type TINYINT      NULL COMMENT '种植方式 1露天 2大棚 3水田 4山地',
    ADD COLUMN soil_type     VARCHAR(50)  NULL COMMENT '土壤类型',
    ADD COLUMN crop_id       VARCHAR(32)  NULL COMMENT '当前作物ID',
    ADD COLUMN create_by     BIGINT       NULL COMMENT '创建人',
    ADD COLUMN update_by     BIGINT       NULL COMMENT '更新人',
    ADD KEY idx_plot_farm (farm_id);

ALTER TABLE prod_device
    ADD COLUMN farm_id          VARCHAR(32) NULL COMMENT '所属农场ID',
    ADD COLUMN manufacturer     VARCHAR(100) NULL COMMENT '厂商',
    ADD COLUMN model            VARCHAR(64) NULL COMMENT '型号',
    ADD COLUMN firmware         VARCHAR(32) NULL COMMENT '固件版本',
    ADD COLUMN install_date     DATE        NULL COMMENT '安装日期',
    ADD COLUMN last_heartbeat_at DATETIME   NULL COMMENT '最后心跳',
    ADD COLUMN create_by        BIGINT      NULL COMMENT '创建人',
    ADD COLUMN update_by        BIGINT      NULL COMMENT '更新人',
    ADD KEY idx_device_farm (farm_id);

ALTER TABLE prod_batch
    ADD COLUMN farm_id      VARCHAR(32) NULL COMMENT '所属农场ID',
    ADD COLUMN plan_id      VARCHAR(32) NULL COMMENT '种养计划ID',
    ADD COLUMN crop_id      VARCHAR(32) NULL COMMENT '作物ID',
    ADD COLUMN crop_variety VARCHAR(32) NULL COMMENT '品种',
    ADD COLUMN unit         VARCHAR(10) NULL COMMENT '单位',
    ADD COLUMN grade        VARCHAR(10) NULL COMMENT '等级',
    ADD COLUMN inspector_id VARCHAR(32) NULL COMMENT '质检人',
    ADD COLUMN create_by    BIGINT      NULL COMMENT '创建人',
    ADD COLUMN update_by    BIGINT      NULL COMMENT '更新人',
    ADD KEY idx_batch_farm (farm_id);

ALTER TABLE prod_trace_code
    ADD COLUMN batch_no     VARCHAR(32) NULL COMMENT '批次号',
    ADD COLUMN activated_at DATETIME    NULL COMMENT '激活时间',
    ADD COLUMN activated_by VARCHAR(32) NULL COMMENT '激活人',
    ADD COLUMN scan_count   INT         NOT NULL DEFAULT 0 COMMENT '扫码次数',
    ADD COLUMN last_scan_at DATETIME    NULL COMMENT '最后扫码时间',
    ADD COLUMN expire_date  DATE        NULL COMMENT '有效期至',
    ADD COLUMN create_by    BIGINT      NULL COMMENT '创建人',
    ADD COLUMN update_by    BIGINT      NULL COMMENT '更新人',
    ADD KEY idx_trace_batch_no (batch_no);

ALTER TABLE prod_quality_report
    ADD COLUMN inspection_type VARCHAR(20)  NULL COMMENT '检测类型 SELF/SEND/SAMPLING',
    ADD COLUMN lab_id          VARCHAR(32)  NULL COMMENT '检测机构ID',
    ADD COLUMN sample_qty      DECIMAL(12,2) NULL COMMENT '抽样数量',
    ADD COLUMN report_url      VARCHAR(255) NULL COMMENT '报告附件',
    ADD COLUMN status          VARCHAR(20)  NULL COMMENT '状态 PENDING/TESTING/DONE',
    ADD COLUMN create_by       BIGINT       NULL COMMENT '创建人',
    ADD COLUMN update_by       BIGINT       NULL COMMENT '更新人';

ALTER TABLE prod_iot_alert
    ADD COLUMN farm_id      VARCHAR(32) NULL COMMENT '农场ID',
    ADD COLUMN plot_id      VARCHAR(32) NULL COMMENT '地块ID',
    ADD COLUMN rule_id      VARCHAR(32) NULL COMMENT '触发规则ID',
    ADD COLUMN handle_by    VARCHAR(32) NULL COMMENT '处置人',
    ADD COLUMN handle_time  DATETIME    NULL COMMENT '处置时间',
    ADD COLUMN handle_remark VARCHAR(500) NULL COMMENT '处置说明',
    ADD COLUMN create_by    BIGINT      NULL COMMENT '创建人',
    ADD COLUMN update_by    BIGINT      NULL COMMENT '更新人',
    ADD KEY idx_alert_farm (farm_id);

