/**
 * 审批管理 / 合规检查 / SOP 与知识库 实体类型
 */

/** 审批类型：1 农场入驻 2 计划变更 3 投入品采购 4 质量复检 5 数据更正 */
export type ApprovalType = 1 | 2 | 3 | 4 | 5

/** 审批状态：1 待审批 2 已通过 3 已驳回 4 已撤回 */
export type ApprovalStatus = 1 | 2 | 3 | 4

/** 审批单 */
export interface Approval {
  /** 审批单 ID */
  approvalId: string
  /** 审批单号 */
  approvalNo: string
  /** 审批类型：1 农场入驻 2 计划变更 3 投入品采购 4 质量复检 5 数据更正 */
  approvalType: ApprovalType
  /** 业务 ID */
  bizId: string
  /** 业务摘要 */
  bizSummary?: string
  /** 申请人姓名 */
  applicantName: string
  /** 所属租户 ID */
  tenantId?: string
  /** 所属租户名称（冗余） */
  tenantName?: string
  /** 审批状态：1 待审批 2 已通过 3 已驳回 4 已撤回 */
  status: ApprovalStatus
  /** 当前审批节点 */
  currentNode?: string
  /** 审批人姓名 */
  approverName?: string
  /** 审批意见 */
  approveRemark?: string
  /** 提交时间 */
  submittedAt: string
  /** 审批时间 */
  approvedAt?: string

  /* ------------------------------------------------------------------
   * 以下字段对齐后端 ApprovalEntity / prod_approval 的真实返回口径。
   *
   * 上面那组是「理想口径」，后端并不返回 approvalNo / approvalType /
   * submittedAt / approverName / approveRemark；实际返回的是
   * bizType / title / submitAt / approveAt / approveOpinion / currentApproverId。
   * 前端此前只按理想口径取值，页面上每一列都是 undefined。
   * 另外 status 后端是字符串枚举（APPROVED / PENDING / REJECTED），
   * 与本接口声明的数字 ApprovalStatus 不同，取值时需按字符串比较。
   * ------------------------------------------------------------------ */
  /** 业务类型（后端 biz_type：CERT / RECALL / QUOTA） */
  bizType?: string
  /** 审批标题（后端 title） */
  title?: string
  /** 提交时间（后端 submit_at） */
  submitAt?: string
  /** 审批时间（后端 approve_at） */
  approveAt?: string
  /** 审批意见（后端 approve_opinion） */
  approveOpinion?: string
  /** 当前审批人（后端 current_approver_id，后端不返回审批人姓名） */
  currentApproverId?: string
  /** 审批层级（后端 approve_level） */
  approveLevel?: number
}

/** 审批流程节点配置 */
export interface ApprovalNodeConfig {
  /** 节点 ID */
  nodeId: string
  /** 流程 ID */
  flowId: string
  /** 节点序号 */
  nodeOrder: number
  /** 节点名称 */
  nodeName: string
  /** 审批角色编码 */
  approveRoleCode: string
  /** 审批角色名称 */
  approveRoleName?: string
  /** 审批方式：1 或签 2 会签 */
  approveMode: 1 | 2
  /** 超时时长（小时） */
  timeoutHours?: number
}

/** 审批流程配置 */
export interface ApprovalFlowConfig {
  /** 流程 ID */
  flowId: string
  /** 流程名称 */
  flowName: string
  /** 适用审批类型 */
  approvalType: ApprovalType
  /** 流程节点列表 */
  nodes: ApprovalNodeConfig[]
  /** 启用状态：1 启用 0 停用 */
  status: 0 | 1
  /** 更新时间 */
  updatedAt: string
}

/** 合规检查结果：1 合规 2 限期整改 3 严重违规 */
export type ComplianceResult = 1 | 2 | 3

/** 合规检查记录 */
export interface ComplianceCheck {
  /** 检查 ID */
  checkId: string
  /** 农场 ID */
  farmId: string
  /** 农场名称（冗余） */
  farmName?: string
  /** 检查项名称 */
  checkItem: string
  /** 检查结果：1 合规 2 限期整改 3 严重违规 */
  result: ComplianceResult
  /** 问题描述 */
  problem?: string
  /** 整改要求 */
  rectifyRequirement?: string
  /** 整改期限 */
  rectifyDeadline?: string
  /** 检查人姓名 */
  checkerName?: string
  /** 检查时间 */
  checkedAt: string
}

/** SOP 模板审核状态：1 待审核 2 已通过 3 已驳回 */
export type SopAuditStatus = 1 | 2 | 3

/** SOP 模板 */
export interface SopTemplate {
  /** 模板 ID */
  templateId: string
  /** 模板名称 */
  templateName: string
  /** 适用作物 ID */
  cropId?: string
  /** 适用作物名称（冗余） */
  cropName?: string
  /** 适用环节 */
  stage?: string
  /** 模板内容 */
  content: string
  /** 提交人姓名 */
  submitterName?: string
  /** 审核状态：1 待审核 2 已通过 3 已驳回 */
  auditStatus: SopAuditStatus
  /** 审核意见 */
  auditRemark?: string
  /** 引用次数 */
  usageCount: number
  /** 提交时间 */
  submittedAt: string
  /** 审核时间 */
  auditedAt?: string
}

/**
 * 知识库文章
 *
 * ⚠️ 契约口径（2026-10 实测 `GET /api/v1/production/admin/knowledge`）：
 * 后端直接吐 `KnowledgeArticleEntity`，真实字段是
 * `articleId / categoryCode / title / summary / contentUrl / author / source /
 * readCount / publishAt / status` + 基类审计列 `createdAt / updatedAt`。
 *
 * 此前本类型声明的 `category`（数字 1-4）、`content`（正文）、`viewCount`（浏览量）、
 * `publisherName`、`publishedAt` **后端一个都不返回**，其中 `viewCount` 直接导致
 * 知识库页「查看数」列与详情抽屉崩在 `v.toLocaleString()`（整页白屏）。
 *
 * 处置：
 * - 后端真字段全部补进类型（`categoryCode` / `contentUrl` / `author` / `source` /
 *   `readCount` / `publishAt`），页面按真字段名消费；
 * - 前端历史声明但没有后端对应列的字段一律改成可选，由页面显式降级为「—」，
 *   不许再让 TS 用必填标注「担保」运行时一定有值。
 */
export interface KnowledgeArticle {
  /** 文章 ID */
  articleId: string
  /** 文章标题 */
  title: string
  /** 分类编码（后端真字段）：如 PLANT / PEST / POLICY */
  categoryCode?: string
  /**
   * 分类数字编码：1 种植技术 2 病虫害防治 3 政策法规 4 农资知识。
   * 后端无 `category` 列（只有 `categoryCode` 字符串），声明为可选，
   * 写入时后端同样不消费该字段。
   */
  category?: 1 | 2 | 3 | 4
  /** 摘要 */
  summary?: string
  /** 正文链接（后端真字段 `contentUrl`；不是正文内容本身） */
  contentUrl?: string
  /**
   * 正文内容：后端无该列（只有正文链接），声明为可选，页面显示「—」。
   */
  content?: string
  /** 标签列表 */
  tags?: string[]
  /** 阅读数（后端真字段 `readCount`） */
  readCount?: number
  /**
   * 浏览量：前端历史声明名，后端无该列。
   * 页面用 `readCount` 填充；两者都缺失时为 undefined，渲染「—」。
   */
  viewCount?: number
  /** 发布状态：1 已发布 0 草稿 */
  status?: 0 | 1
  /** 作者（后端真字段 `author`） */
  author?: string
  /** 来源（后端真字段 `source`） */
  source?: string
  /** 发布时间（后端真字段 `publishAt`） */
  publishAt?: string
  /** 发布时间：前端历史声明名，后端无该列 */
  publishedAt?: string
  /** 发布人姓名：前端历史声明名，后端无该列（只有 `author`） */
  publisherName?: string
  /** 更新时间（后端基类审计列 `updatedAt`） */
  updatedAt?: string
}
