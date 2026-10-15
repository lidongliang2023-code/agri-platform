-- 补丁：运营端「审批管理」两张表 + 演示数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-approvals.sql
--
-- 背景（2026-10-15 切运营端 admin/approvals）：
--   · 审批单此前只在平台侧（agri_core.prod_approval，3 条演示行），本服务没有表；
--   · 审批**流程配置**在平台侧**根本没有表** —— core 的 /admin/approvals/config 返回的是三个硬编码骨架
--     （{bizType: CERT/RECALL/QUOTA, approveLevel}），而页面是带完整 CRUD 的
--     （ApprovalConfig.tsx：列表 / 新增 / 编辑，字段 flowId/flowName/approvalType/nodes/status）。
--     要给页面真东西，就得有这张表 —— 这里按页面契约建，并放三条与业务类型对应的演示流程。

CREATE TABLE IF NOT EXISTS agri_prod_approval (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    approval_code VARCHAR(64) NOT NULL UNIQUE COMMENT '审批单号（页面的 approvalId）',
    biz_type VARCHAR(20) COMMENT 'CERT 认证 / RECALL 召回 / QUOTA 配额',
    biz_id VARCHAR(64) COMMENT '关联业务编号',
    title VARCHAR(128),
    applicant_id VARCHAR(64),
    applicant_name VARCHAR(50),
    approve_level INT DEFAULT 1,
    current_approver_id VARCHAR(64),
    approve_opinion VARCHAR(500),
    submit_at DATETIME,
    approve_at DATETIME,
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING / APPROVED / REJECTED',
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_approval_status` (status),
    INDEX `idx_approval_biz_type` (biz_type),
    INDEX `idx_approval_tenant` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_approval_flow (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    flow_code VARCHAR(64) NOT NULL UNIQUE COMMENT '流程编号（页面的 flowId）',
    flow_name VARCHAR(100) NOT NULL,
    approval_type VARCHAR(20) COMMENT '适用类型（与审批单的 biz_type 同一套词表）',
    nodes_json TEXT COMMENT '节点列表（JSON 数组，字段见前端 ApprovalNodeConfig）',
    status TINYINT DEFAULT 1 COMMENT '1 启用 / 0 停用',
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_approval_flow_tenant` (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 演示审批单（3 条，与平台侧演示行一致：已通过 / 待审批 / 已驳回）
INSERT IGNORE INTO agri_prod_approval
    (approval_code, biz_type, biz_id, title, applicant_id, applicant_name, approve_level,
     current_approver_id, approve_opinion, submit_at, approve_at, status, tenant_id, create_time, update_time)
VALUES
    ('DEMO-APR-001', 'CERT', 'DEMO-FARM-003', '绿色食品认证换证申请', 'DEMO-MEM-006', '王秀兰', 1,
     'SUPER_ADMIN', '同意受理，需补交本年度检测报告', '2026-09-01 09:00:00', '2026-09-03 10:30:00', 'APPROVED',
     '2001', '2026-09-01 09:00:00', '2026-09-03 10:30:00'),
    ('DEMO-APR-002', 'RECALL', 'DEMO-BATCH-003', '辣椒批次风险召回申请', 'DEMO-MEM-001', '陈志强', 2,
     'SUPER_ADMIN', NULL, '2026-10-09 11:00:00', NULL, 'PENDING',
     '2001', '2026-10-09 11:00:00', '2026-10-09 11:00:00'),
    ('DEMO-APR-003', 'QUOTA', 'DEMO-QUOTA-001', '农场数上限扩容至 50 个', 'DEMO-MEM-001', '陈志强', 1,
     'SUPER_ADMIN', '当前用量未达扩容门槛，暂不批准', '2026-08-15 14:20:00', '2026-08-18 09:00:00', 'REJECTED',
     '2001', '2026-08-15 14:20:00', '2026-08-18 09:00:00');

-- 演示审批流程（三条，与三个业务类型一一对应；节点 JSON 字段名照抄前端 ApprovalNodeConfig）
INSERT IGNORE INTO agri_prod_approval_flow
    (flow_code, flow_name, approval_type, nodes_json, status, tenant_id, create_time, update_time)
VALUES
    ('DEMO-FLOW-CERT', '绿色食品认证换证审批流', 'CERT',
     '[{"nodeId":"n1","flowId":"DEMO-FLOW-CERT","nodeOrder":1,"nodeName":"平台初审","approveRoleCode":"PLATFORM_OPERATOR","approveRoleName":"平台运营","approveMode":1,"timeoutHours":24},{"nodeId":"n2","flowId":"DEMO-FLOW-CERT","nodeOrder":2,"nodeName":"专家复核","approveRoleCode":"AGRONOMIST","approveRoleName":"农艺专家","approveMode":2,"timeoutHours":48}]',
     1, '2001', '2026-09-01 09:00:00', '2026-09-01 09:00:00'),
    ('DEMO-FLOW-RECALL', '批次风险召回审批流', 'RECALL',
     '[{"nodeId":"n1","flowId":"DEMO-FLOW-RECALL","nodeOrder":1,"nodeName":"平台运营审批","approveRoleCode":"PLATFORM_OPERATOR","approveRoleName":"平台运营","approveMode":1,"timeoutHours":4},{"nodeId":"n2","flowId":"DEMO-FLOW-RECALL","nodeOrder":2,"nodeName":"监管备案","approveRoleCode":"REGULATOR","approveRoleName":"监管人员","approveMode":1,"timeoutHours":12}]',
     1, '2001', '2026-09-10 09:00:00', '2026-09-10 09:00:00'),
    ('DEMO-FLOW-QUOTA', '租户配额扩容审批流', 'QUOTA',
     '[{"nodeId":"n1","flowId":"DEMO-FLOW-QUOTA","nodeOrder":1,"nodeName":"平台运营审批","approveRoleCode":"PLATFORM_OPERATOR","approveRoleName":"平台运营","approveMode":1,"timeoutHours":24}]',
     1, '2001', '2026-08-20 09:00:00', '2026-08-20 09:00:00');
