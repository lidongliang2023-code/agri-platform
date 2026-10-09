/**
 * 农事任务 / 任务模板 实体类型
 */
import type { OptionItem } from './common'

/** 任务状态 */
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'executing'
  | 'submitted'
  | 'accepted'
  | 'rejected'

/** 任务优先级：1 低 2 中 3 高 4 紧急 */
export type TaskPriority = 1 | 2 | 3 | 4

/** 验收状态：0 待验收 1 通过 2 驳回 */
export type AcceptStatus = 0 | 1 | 2

/** 农事任务 */
export interface Task {
  /** 任务 ID */
  taskId: string
  /** 任务编号 */
  taskNo: string
  /** 所属计划 ID */
  planId?: string
  /** 所属地块 ID */
  plotId?: string
  /** 所属地块名称（冗余） */
  plotName?: string
  /** 任务类型，如 播种 / 施肥 / 打药 / 采收 */
  taskType: string
  /** 任务名称 */
  taskName: string
  /** 任务描述 */
  description?: string
  /** 计划开始时间 */
  planStartDate: string
  /** 计划结束时间 */
  planEndDate: string
  /** 实际开始时间 */
  actualStartDate?: string
  /** 实际完成时间 */
  actualEndDate?: string
  /** 执行人 ID */
  assigneeId?: string
  /** 执行人姓名 */
  assigneeName?: string
  /** 派发人 ID */
  assignerId?: string
  /** 派发人姓名 */
  assignerName?: string
  /** 状态：pending/assigned/executing/submitted/accepted/rejected */
  status: TaskStatus
  /** 优先级：1 低 2 中 3 高 4 紧急 */
  priority: TaskPriority
  /** 关联任务模板 ID */
  templateId?: string
  /** 关联投入品使用记录 ID（后端为 JSON 数组字符串） */
  relatedUsageIds?: string
  /** 所属农场 ID（创建表单入参，后端按地块归属农场） */
  farmId?: string
  /** 所属农场名称（冗余展示） */
  farmName?: string
  /** 驳回次数 */
  rejectCount: number
  /** 验收状态：0 待验收 1 通过 2 驳回 */
  acceptStatus: AcceptStatus
  /** 验收意见 */
  acceptRemark?: string
  /** 完成时间 */
  completedAt?: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/** 任务模板 */
export interface TaskTemplate {
  /** 模板 ID */
  templateId: string
  /** 模板编码 */
  templateCode: string
  /** 模板名称 */
  templateName: string
  /** 适用作物 ID */
  cropId?: string
  /** 适用作物名称 */
  cropName?: string
  /** 任务类型 */
  taskType: string
  /** 标准作业内容 */
  content: string
  /** 标准工时（小时） */
  standardHours: number
  /** 关联投入品清单 */
  inputItems?: string[]
  /** 是否为系统内置模板 */
  isSystem: boolean
  /** 启用状态：1 启用 0 停用 */
  status: 0 | 1
  /** 创建时间 */
  createdAt: string
  /** 适用阶段序号（后端 task_template.stage_seq） */
  stageSeq?: number
  /** 距上一阶段间隔天数（后端 task_template.interval_days） */
  intervalDays?: number
  /** 标准工时（后端 task_template.work_hours，与 standardHours 同义） */
  workHours?: number
  /** 标准作业内容（后端 task_template.work_content，与 content 同义） */
  workContent?: string
  /** 关联投入品 ID（后端 task_template.input_ids，逗号分隔） */
  inputIds?: string
}

/** 任务验收记录 */
export interface TaskAcceptance {
  /** 验收记录 ID */
  acceptanceId: string
  /** 任务 ID */
  taskId: string
  /** 验收结果：0 待验收 1 通过 2 驳回 */
  acceptStatus: AcceptStatus
  /** 验收人 ID */
  acceptorId: string
  /** 验收人姓名 */
  acceptorName: string
  /** 验收意见 */
  remark?: string
  /** 验收附件地址列表 */
  attachmentUrls?: string[]
  /** 验收时间 */
  acceptedAt: string
}

/** 任务执行记录（打卡 / 过程 / 完成） */
export interface TaskRecord {
  /** 记录 ID */
  recordId: string
  /** 任务 ID */
  taskId: string
  /** 执行人 ID */
  executorId?: string
  /** 执行人姓名（冗余） */
  executorName?: string
  /** 打卡时间 */
  executeTime: string
  /** 记录类型：1 开始 2 过程 3 完成 */
  executeType: 1 | 2 | 3
  /** 照片地址（后端为 JSON 数组字符串或逗号分隔） */
  photos?: string
  /** 照片地址列表（前端解析后） */
  photoList?: string[]
  /** 打卡纬度 */
  gpsLat?: number
  /** 打卡经度 */
  gpsLng?: number
  /** 距地块中心距离（米） */
  gpsDistance?: number
  /** 异常说明 */
  abnormalDesc?: string
  /** 离线补传标记：0 在线 1 离线补传 */
  offlineFlag?: 0 | 1
}

/** 任务类型选项（PRD 12.1.6 任务类型枚举） */
export const TASK_TYPE_OPTIONS: OptionItem[] = [
  { value: 'tillage', label: '整地' },
  { value: 'sowing', label: '播种/移栽' },
  { value: 'fertilizing', label: '施肥' },
  { value: 'irrigating', label: '灌溉' },
  { value: 'pest_control', label: '病虫害防治' },
  { value: 'pruning', label: '整枝/修剪' },
  { value: 'weeding', label: '除草' },
  { value: 'pollination', label: '授粉' },
  { value: 'harvesting', label: '采收' },
  { value: 'patrol', label: '巡田/巡检' },
  { value: 'other', label: '其他' },
]

/** 任务状态选项 */
export const TASK_STATUS_OPTIONS: OptionItem[] = [
  { value: 'pending', label: '待执行' },
  { value: 'assigned', label: '已派发' },
  { value: 'executing', label: '执行中' },
  { value: 'submitted', label: '待验收' },
  { value: 'accepted', label: '已完成' },
  { value: 'rejected', label: '已驳回' },
]

/** 任务优先级选项：4 紧急 / 3 重要 / 2 普通 / 1 低 */
export const TASK_PRIORITY_OPTIONS: OptionItem<number>[] = [
  { value: 4, label: '紧急' },
  { value: 3, label: '重要' },
  { value: 2, label: '普通' },
  { value: 1, label: '低' },
]

/** 执行记录类型选项：1 开始 / 2 过程 / 3 完成 */
export const TASK_RECORD_TYPE_OPTIONS: OptionItem<number>[] = [
  { value: 1, label: '开始执行' },
  { value: 2, label: '过程记录' },
  { value: 3, label: '完成打卡' },
]

/** 任务类型 → 显示名称 */
export const TASK_TYPE_LABEL_MAP: Record<string, string> = TASK_TYPE_OPTIONS.reduce<
  Record<string, string>
>((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {})

/** 任务状态 → 显示名称 */
export const TASK_STATUS_LABEL_MAP: Record<string, string> = TASK_STATUS_OPTIONS.reduce<
  Record<string, string>
>((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {})

/** 任务状态 → Tag 颜色 */
export const TASK_STATUS_COLOR_MAP: Record<string, string> = {
  pending: 'default',
  assigned: 'blue',
  executing: 'processing',
  submitted: 'gold',
  accepted: 'success',
  rejected: 'error',
}

/** 任务优先级 → 显示名称 */
export const TASK_PRIORITY_LABEL_MAP: Record<number, string> = {
  4: '紧急',
  3: '重要',
  2: '普通',
  1: '低',
}

/** 任务优先级 → Tag 颜色 */
export const TASK_PRIORITY_COLOR_MAP: Record<number, string> = {
  4: 'red',
  3: 'orange',
  2: 'blue',
  1: 'default',
}

/** 验收状态：0 待验收 / 1 通过 / 2 驳回 */
export const ACCEPT_STATUS_META: Record<number, { label: string; color: string }> = {
  0: { label: '待验收', color: 'gold' },
  1: { label: '验收通过', color: 'success' },
  2: { label: '验收驳回', color: 'error' },
}
