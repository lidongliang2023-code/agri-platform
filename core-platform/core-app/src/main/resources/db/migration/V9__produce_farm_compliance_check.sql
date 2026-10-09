-- ------------------------------------------------ V9 运营端「合规检查」任务落库
-- 由「前端有真实交互、后端无落库端点」的缺口驱动（PRD 6.2 #11：禁限用农资抽查 /
-- 记录缺失督导 / 整改跟踪）。此前 ComplianceCheck.tsx 只能把任务写进 localStorage，
-- 属于典型假功能；本表承接 POST /admin/farms/compliance 与 PUT /admin/farms/compliance/{id}。
--
-- 字段口径完全对齐前端 src/types/approval.ts 的 ComplianceCheck 与
-- src/pages/admin/farms/supervisionShared.ts 的 ComplianceTaskItem：
--   checkId / farmId / farmName / checkItem / result / problem /
--   rectifyRequirement / rectifyDeadline / checkerName / checkedAt
--   + 整改跟踪扩展：rectifyStatus / rectifyRemark / rectifyAttachment / rectifiedAt
--
-- 纪律：所有列均可为空，后端不具备的字段一律返回 null（前端显示「—」），
--       不填 0、不填空串、不填占位值。仅 rectify_status 有业务默认值 'none'
--       （新建任务尚未进入整改流程，是真实业务状态，不是占位数据）。
-- 注：前端创建请求（persistTask）目前未携带 checkType，故该列可为空；
--     后端已支持读写，前端补齐传参即可直接落库（无需再改后端）。

CREATE TABLE prod_farm_compliance_check (
    check_id            VARCHAR(32)   NOT NULL COMMENT 'checkId（业务主键，前端生成 CHK+时间戳+序号）',
    market_id           BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id           BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    farm_id             VARCHAR(32)   COMMENT '农场ID',
    farm_name           VARCHAR(100)  COMMENT '农场名称（冗余，列表展示用）',
    check_type          VARCHAR(32)   COMMENT '检查类型：禁限用农资抽查/记录缺失督导/常规检查',
    check_item          VARCHAR(200)  COMMENT '检查项',
    check_result        TINYINT       COMMENT '检查结果 1合规 2限期整改 3严重违规',
    problem_desc        VARCHAR(500)  COMMENT '问题描述',
    rectify_requirement VARCHAR(500)  COMMENT '整改要求',
    rectify_deadline    DATE          COMMENT '整改期限（yyyy-MM-dd）',
    checker_name        VARCHAR(50)   COMMENT '检查人',
    checked_at          DATETIME      COMMENT '检查时间',
    rectify_status      VARCHAR(20)   NOT NULL DEFAULT 'none' COMMENT '整改状态 none未进入/pending待整改/processing整改中/rectified已整改/overdue已逾期',
    rectify_remark      VARCHAR(500)  COMMENT '整改结果说明',
    rectify_attachment  VARCHAR(255)  COMMENT '整改凭证附件地址',
    rectified_at        DATETIME      COMMENT '整改闭环时间',
    create_by           BIGINT        COMMENT '创建人',
    update_by           BIGINT        COMMENT '更新人',
    create_at           DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at           DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted             TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (check_id),
    KEY idx_compliance_check_farm (farm_id),
    KEY idx_compliance_check_result (check_result),
    KEY idx_compliance_check_status (rectify_status),
    KEY idx_compliance_check_checked_at (checked_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = '农场合规检查任务（运营端 PRD 6.2 #11）';
