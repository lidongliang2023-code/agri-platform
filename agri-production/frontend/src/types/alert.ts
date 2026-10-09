/**
 * 告警 / 告警规则 实体类型
 */

/** 告警级别：1 提示 2 一般 3 严重 4 紧急 */
export type AlertLevel = 1 | 2 | 3 | 4

/** 告警状态：1 未处理 2 处理中 3 已处理 4 已忽略 */
export type AlertStatus = 1 | 2 | 3 | 4

/** 告警来源：1 环境 2 设备 3 病虫害 4 任务 5 投入品 */
export type AlertSource = 1 | 2 | 3 | 4 | 5

/** 告警记录 */
export interface Alert {
  /** 告警 ID */
  alertId: string
  /** 告警编号 */
  alertNo: string
  /** 告警标题 */
  alertTitle: string
  /** 告警内容 */
  alertContent: string
  /** 告警级别：1 提示 2 一般 3 严重 4 紧急 */
  alertLevel: AlertLevel
  /** 告警来源：1 环境 2 设备 3 病虫害 4 任务 5 投入品 */
  alertSource: AlertSource
  /** 关联农场 ID */
  farmId?: string
  /** 关联地块 ID */
  plotId?: string
  /** 关联地块名称（冗余） */
  plotName?: string
  /** 关联设备 ID */
  deviceId?: string
  /** 触发规则 ID */
  ruleId?: string
  /** 触发值 */
  triggerValue?: string
  /** 状态：1 未处理 2 处理中 3 已处理 4 已忽略 */
  status: AlertStatus
  /** 处理人 ID */
  handlerId?: string
  /** 处理人姓名 */
  handlerName?: string
  /** 处理意见 */
  handleRemark?: string
  /** 触发时间 */
  triggeredAt: string
  /** 处理时间 */
  handledAt?: string
}

/** 告警规则 */
export interface AlertRule {
  /** 规则 ID */
  ruleId: string
  /** 规则名称 */
  ruleName: string
  /** 监测指标，如 soilMoisture / airTemperature */
  metric: string
  /** 比较运算符：gt / gte / lt / lte / eq */
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  /** 阈值 */
  threshold: number
  /** 持续时间（分钟），超过该时长才触发 */
  duration: number
  /** 告警级别：1 提示 2 一般 3 严重 4 紧急 */
  alertLevel: AlertLevel
  /** 适用范围：farm 表示农场级，plot 表示地块级 */
  scope: 'farm' | 'plot'
  /** 适用范围 ID 列表 */
  scopeIds?: string[]
  /** 通知方式：1 站内 2 短信 3 微信 */
  notifyChannels: number[]
  /** 启用状态：1 启用 0 停用 */
  status: 0 | 1
  /** 创建时间 */
  createdAt: string
}

/** 应急预案 */
export interface EmergencyPlan {
  /** 预案 ID */
  planId: string
  /** 预案名称 */
  planName: string
  /** 适用告警类型 */
  alertType: string
  /** 响应级别：1 一级 2 二级 3 三级 */
  responseLevel: 1 | 2 | 3
  /** 处置流程描述 */
  process: string
  /** 责任人 */
  ownerName: string
  /** 责任人电话 */
  ownerPhone: string
  /** 启用状态：1 启用 0 停用 */
  status: 0 | 1
  /** 更新时间 */
  updatedAt: string
}

/** 灾害事件复盘 */
export interface DisasterReview {
  /** 复盘 ID */
  reviewId: string
  /** 事件名称 */
  eventName: string
  /** 灾害类型，如 洪涝 / 干旱 / 霜冻 */
  disasterType: string
  /** 发生时间 */
  occurredAt: string
  /** 影响农场数量 */
  affectedFarmCount: number
  /** 影响面积（亩） */
  affectedArea: number
  /** 经济损失（元） */
  economicLoss: number
  /** 处置过程 */
  handleProcess: string
  /** 改进措施 */
  improvement: string
  /** 复盘人 */
  reviewerName: string
  /** 创建时间 */
  createdAt: string
}
