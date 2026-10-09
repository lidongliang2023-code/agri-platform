/**
 * 租户（运营端）实体类型
 */

/** 租户等级：1 免费版 2 基础版 3 专业版 4 旗舰版 */
export type TenantLevel = 1 | 2 | 3 | 4

/** 租户状态：1 正常 2 待审核 3 已冻结 0 已注销 */
export type TenantStatus = 0 | 1 | 2 | 3

/** 租户 */
export interface Tenant {
  /** 租户 ID */
  tenantId: string
  /** 租户编码 */
  tenantCode: string
  /** 租户名称 */
  tenantName: string
  /** 联系人 */
  contactName?: string
  /** 联系电话 */
  contactPhone?: string
  /** 所在地区 */
  region?: string
  /** 租户等级：1 免费版 2 基础版 3 专业版 4 旗舰版 */
  tenantLevel: TenantLevel
  /** 状态：1 正常 2 待审核 3 已冻结 0 已注销 */
  status: TenantStatus
  /** 农场数量 */
  farmCount: number
  /** 成员数量 */
  memberCount: number
  /** 设备数量 */
  deviceCount: number
  /** 开通时间 */
  activatedAt?: string
  /** 到期时间 */
  expireAt?: string
  /** 创建时间 */
  createdAt: string
}

/** 配额类型：1 农场数 2 地块数 3 成员数 4 设备数 5 存储容量 6 API 调用 */
export type QuotaType = 1 | 2 | 3 | 4 | 5 | 6

/** 租户配额 */
export interface TenantQuota {
  /** 配额 ID */
  quotaId: string
  /** 租户 ID */
  tenantId: string
  /** 租户名称（冗余） */
  tenantName?: string
  /** 配额类型：1 农场数 2 地块数 3 成员数 4 设备数 5 存储容量 6 API 调用 */
  quotaType: QuotaType
  /** 配额上限 */
  quotaLimit: number
  /** 已使用量 */
  usedAmount: number
  /** 使用百分比 */
  usageRate: number
  /** 更新时间 */
  updatedAt: string
}

/** 租户分层 */
export interface TenantSegment {
  /** 分层 ID */
  segmentId: string
  /** 分层名称，如 头部客户 / 成长客户 / 长尾客户 */
  segmentName: string
  /** 分层规则描述 */
  rule: string
  /** 租户数量 */
  tenantCount: number
  /** 贡献收入（元） */
  revenue: number
  /** 运营策略 */
  strategy?: string
  /** 更新时间 */
  updatedAt: string
}

/* ==================== 运营端页面扩展类型 ==================== */
/* 以下类型为运营端「仪表盘组 + 租户管理组」页面新增，纯追加，不影响既有定义。 */

/** 租户活跃度取值（原型 P2「活跃」列） */
export type TenantActivity = '正常' | '低活跃' | '不活跃'

/** 租户运营标签（分层运营页使用） */
export type TenantTag =
  | '重点客户'
  | '高潜成长'
  | '续费预警'
  | '配额预警'
  | '政策试点'
  | '待激活'

/** 租户分层取值（原型等级：钻石 / 金牌 / 银牌 / 普通） */
export type TenantSegmentLevel = '钻石' | '金牌' | '银牌' | '普通'

/** 租户的运营侧扩展字段（与 Tenant 交叉后用于列表 / 详情展示） */
export interface TenantOpsExtra {
  /** 统一社会信用代码 */
  creditCode?: string
  /** 法定代表人 */
  legalPerson?: string
  /** 注册地址 */
  address?: string
  /** 经营范围 */
  businessScope?: string
  /** 在田面积（亩） */
  fieldArea?: number
  /** 活跃度 */
  activity?: TenantActivity
  /** 配额使用率（%，可超过 100） */
  quotaUsageRate?: number
  /** 运营标签 */
  tags?: TenantTag[]
  /** 年度贡献收入（元） */
  revenue?: number
  /** 近 30 天活跃天数 */
  activeDays?: number
  /** 差异化运营策略 */
  strategy?: string
}

/** 运营端租户（含运营扩展字段） */
export type OpsTenant = Tenant & TenantOpsExtra

/** 运营端配额项（对齐原型 P3「配额详情」4 项） */
export interface OpsQuotaItem {
  /** 配额编码 */
  key: 'farm' | 'traceCode' | 'storage' | 'api'
  /** 配额名称 */
  name: string
  /** 计量单位 */
  unit: string
  /** 已使用量 */
  used: number
  /** 配额上限 */
  limit: number
  /** 使用率（%） */
  usageRate: number
  /** 展示小数位 */
  precision: number
  /** 更新时间 */
  updatedAt: string
  /** 后端配额记录 ID（后端存在时才有） */
  quotaId?: string
  /** 后端配额类型：1 农场数 5 存储容量 6 API 调用；溯源码无枚举记为 0 */
  quotaType: number
  /**
   * 用量数据来源（后端 {@code OpsQuotaItem.source}），决定前端能否展示用量：
   * - `COLUMN`：有真实用量数据源（当前为「农场数」与「溯源码」），used / usageRate 可信，正常展示；
   * - `NONE`：完全没有用量数据源，used 恒为 0 仅为满足结构，**必须展示「—」而不是 0**；
   * - `UNAVAILABLE`：数据源暂时不可用（统计失败等），同样展示「—」。
   *
   * 缺省 undefined 一律按「无数据源」处理，避免把结构占位的 0 误读成真实用量。
   */
  source?: 'COLUMN' | 'NONE' | 'UNAVAILABLE'
}

/** 租户配额一行（配额管理页） */
export interface OpsTenantQuotaRow {
  /** 租户 ID */
  tenantId: string
  /** 租户编号 */
  tenantCode: string
  /** 租户名称 */
  tenantName: string
  /** 分层 */
  segment: TenantSegmentLevel
  /** 农场数配额 */
  farm: OpsQuotaItem
  /** 溯源码配额 */
  traceCode: OpsQuotaItem
  /** 存储空间配额 */
  storage: OpsQuotaItem
  /** API 调用配额 */
  api: OpsQuotaItem
  /** 四项中最高使用率（%） */
  maxUsageRate: number
  /** 更新时间 */
  updatedAt: string
}

/** 租户农场列表项（原型 P3 Tab 农场列表） */
export interface TenantFarmItem {
  /** 农场 ID */
  farmId: string
  /** 农场编号 */
  farmCode: string
  /** 农场名称 */
  farmName: string
  /** 面积（亩） */
  areaMu: number
  /** 主要作物 */
  crops: string[]
  /** 状态：正常 / 预警 / 异常 */
  status: string
  /** 负责人 */
  ownerName?: string
}

/** 租户操作日志（原型 P3 Tab 操作日志） */
export interface TenantOperationLog {
  /** 日志 ID */
  logId: string
  /** 操作时间 */
  operateTime: string
  /** 操作人 */
  operator: string
  /** 操作类型 */
  operateType: string
  /** 操作详情 */
  detail: string
  /** IP 地址 */
  ipAddress: string
}

/** 租户画像（分层运营页表格行） */
export interface TenantSegmentProfile {
  /** 租户 ID */
  tenantId: string
  /** 租户编号 */
  tenantCode: string
  /** 租户名称 */
  tenantName: string
  /** 分层标签 */
  segment: TenantSegmentLevel
  /** 运营标签 */
  tags: TenantTag[]
  /** 活跃度 */
  activity: TenantActivity
  /** 配额使用率（%） */
  quotaUsageRate: number
  /** 近 30 天活跃天数 */
  activeDays: number
  /** 年度贡献收入（元） */
  revenue: number
  /** 差异化运营策略 */
  strategy: string
  /** 更新时间 */
  updatedAt: string
}

/** 分层汇总（分层运营页统计卡） */
export interface TenantSegmentSummary {
  /** 分层名称 */
  segment: TenantSegmentLevel
  /** 租户数量 */
  tenantCount: number
  /** 贡献收入（元） */
  revenue: number
  /** 平均配额使用率（%） */
  avgUsageRate: number
  /** 运营策略 */
  strategy: string
}
