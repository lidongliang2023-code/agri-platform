/**
 * 农事任务 / 任务模板 实体类型
 */
import type { OptionItem } from './common'

/**
 * 任务状态。
 *
 * ⚠️ 取值来自后端，非空想。实测依据（2026-10-10，core-app :8098）：
 * - `GET /api/v1/production/tasks` 全量 14 条，status 取值集合 =
 *   `pending / assigned / doing / done / rejected`；
 * - `TaskInfoService.java:103` 派发写 `assigned`，`:122` 验收通过写 `done`、驳回写 `rejected`；
 * - 全后端 java 代码 grep `accepted` / `executing` / `submitted` / `overdue` **均零命中**。
 *
 * 因此旧词汇表里的 `executing` / `accepted` 一律不存在（写库路径也不写这两个值），
 * 前端凡是判 `status === 'accepted'` 的地方**分母恒为 0**（完成率恒显示 0.0%）。
 * 现已收敛为后端真值：`executing → doing`，`accepted → done`。
 *
 * `submitted`（待验收）后端同样没有对应状态，**本轮未裁决**（去掉 Tab 与否待产品拍板），
 * 故仍保留在联合类型里，但不得视为"后端会返回该值"。
 *
 * `overdue`（逾期）后端**不存储**，是前端按 `planEndDate` 推导的派生口径，
 * 统一走 {@link isTaskOverdue}，UI 必须带 {@link OVERDUE_DERIVED_NOTICE} 标注。
 */
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'doing'
  | 'done'
  | 'rejected'
  /** 后端无此状态，保留仅为未裁决的「待验收」Tab；不会由后端返回 */
  | 'submitted'

/** 后端真实存在的任务状态（不含 `submitted`） */
export type BackendTaskStatus = Exclude<TaskStatus, 'submitted'>

/** 已终结状态：进入这两态后不再计入逾期 */
export const TASK_FINAL_STATUSES: readonly BackendTaskStatus[] = ['done', 'rejected']

/** 「已完成」对应的后端真值（旧代码误用 `accepted`，后端不存在该值） */
export const TASK_STATUS_DONE: BackendTaskStatus = 'done'

/** 「执行中」对应的后端真值（旧代码误用 `executing`，后端不存在该值） */
export const TASK_STATUS_DOING: BackendTaskStatus = 'doing'

/**
 * 判断任务是否已按后端口径完成。
 *
 * @param status 任务状态
 * @returns 后端 `done` 时为 true
 */
export function isTaskDone(status: unknown): boolean {
  return status === 'done'
}

/**
 * 判断任务是否为「已逾期」——**派生口径，非后端状态**。
 *
 * 判据：存在 `planEndDate`、且早于当前时间、且状态不属于 {@link TASK_FINAL_STATUSES}。
 *
 * @param task 任务对象（只需 planEndDate / status）
 * @param now 当前时间，默认 `new Date()`
 * @returns 是否逾期
 */
export function isTaskOverdue(
  task: { planEndDate?: string | null; status?: unknown },
  now: Date = new Date(),
): boolean {
  if (!task.planEndDate) {
    return false
  }
  const end = new Date(task.planEndDate).getTime()
  if (!Number.isFinite(end)) {
    return false
  }
  if (TASK_FINAL_STATUSES.includes(task.status as BackendTaskStatus)) {
    return false
  }
  return end < now.getTime()
}

/** 逾期口径标注：凡在 UI 上展示「逾期 / 超时」数量或列表，必须带上这句 */
export const OVERDUE_DERIVED_NOTICE = '已逾期为本地按计划结束时间推导，非后端状态字段；后端状态只有 pending/assigned/doing/done/rejected'

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
  /** 状态：后端真值为 pending/assigned/doing/done/rejected（详见 TaskStatus 注释） */
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

/**
 * 任务状态选项（取值与后端一致）。
 *
 * `submitted` 后端无此状态，保留是因为「待验收」Tab 的去留尚未裁决，
 * 选中它传给后端会返回 0 条——这是已知现状，不是"没数据"。
 */
export const TASK_STATUS_OPTIONS: OptionItem[] = [
  { value: 'pending', label: '待执行' },
  { value: 'assigned', label: '已派发' },
  { value: 'doing', label: '执行中' },
  { value: 'done', label: '已完成' },
  { value: 'rejected', label: '已驳回' },
  { value: 'submitted', label: '待验收（后端无该状态，待裁决）' },
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

/** 任务状态 → Tag 颜色（键为后端真值；兼容旧字面量 accepted/executing/completed） */
export const TASK_STATUS_COLOR_MAP: Record<string, string> = {
  pending: 'default',
  assigned: 'blue',
  doing: 'processing',
  executing: 'processing',
  submitted: 'gold',
  done: 'success',
  accepted: 'success',
  completed: 'success',
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
