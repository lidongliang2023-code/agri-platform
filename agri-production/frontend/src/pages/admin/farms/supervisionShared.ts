/**
 * 农场监管（admin/farms）页面共享工具
 *
 * 仅服务于 `src/pages/admin/farms/` 目录下的四个页面：
 * - FarmSupervisionList（P4 农场列表 / 监管视角）
 * - FarmGisMap（P5 GIS 地图监管）
 * - FarmSupervisionDetail（P6 农场详情 / 监管视角）
 * - ComplianceCheck（PRD 6.2 #11 合规检查）
 *
 * 之所以抽到本文件而不是散落在各页面：
 * 1. 风险评分派生规则、风险等级分档、状态着色必须四个页面完全一致（原型 4.1 通用口径）；
 * 2. 合规检查任务目前后端尚未提供落库端点，需要一个「本地登记 + 后端优先」的统一存储，
 *    列表页的「下发整改」与合规检查页的任务台账必须看到同一份数据。
 *
 * 注意：本文件属于页面私有工具，不属于 `@/utils` 公共层，其他模块不应引用。
 */
import { useEffect, useSyncExternalStore } from 'react'
import type { BizId, ComplianceCheck, ComplianceResult } from '@/types'
import type { FarmComplianceProfile } from '@/api/admin/farms'
import { listComplianceChecks } from '@/api/admin/farms'

/* ==================== 一、风险评分与风险等级分档（原型 P4 / P6 / 4.1） ==================== */

/** 风险等级分档键：低 / 中 / 高 */
export type RiskLevelKey = 'low' | 'medium' | 'high'

/** 风险等级元数据 */
export interface RiskBandMeta {
  /** 分档键 */
  key: RiskLevelKey
  /** 完整标签，如 低风险(0-60) */
  label: string
  /** 简短标签，用于 Tag */
  shortLabel: string
  /** 原型 4.1 中的农场状态口径 */
  farmStatus: string
  /** antd Tag 颜色 */
  tagColor: string
  /** 十六进制色值，用于图表 / 卡片边框 */
  color: string
  /** 区间文案 */
  rangeText: string
}

/**
 * 风险等级元数据表
 *
 * 分档规则（原型 P4 末行 / P6 头卡）：
 * - 低风险 0-60  → 农场状态「正常」
 * - 中风险 60-80 → 农场状态「预警」
 * - 高风险 80+   → 农场状态「异常」
 */
export const RISK_BAND_META: Record<RiskLevelKey, RiskBandMeta> = {
  low: {
    key: 'low',
    label: '低风险',
    shortLabel: '低',
    farmStatus: '正常',
    tagColor: 'green',
    color: '#52c41a',
    rangeText: '0-60',
  },
  medium: {
    key: 'medium',
    label: '中风险',
    shortLabel: '中',
    farmStatus: '预警',
    tagColor: 'orange',
    color: '#fa8c16',
    rangeText: '60-80',
  },
  high: {
    key: 'high',
    label: '高风险',
    shortLabel: '高',
    farmStatus: '异常',
    tagColor: 'red',
    color: '#ff4d4f',
    rangeText: '80+',
  },
}

/**
 * 按分数判定风险等级分档。
 *
 * @param score 风险评分（0-100）
 * @returns 风险等级键
 */
export function resolveRiskLevel(score: number): RiskLevelKey {
  if (score >= 80) {
    return 'high'
  }
  if (score >= 60) {
    return 'medium'
  }
  return 'low'
}

/**
 * 字符串稳定哈希（FNV-1a 变体）。
 *
 * 用于把后端不返回的不确定性指标（如风险评分）派生为「同一农场每次结果一致」的值，
 * 避免随机值在分页 / 刷新时跳变。
 *
 * @param input 输入字符串
 * @returns 32 位无符号整数
 */
export function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

/** 风险评分派生入参 */
export interface RiskScoreInput {
  /** 派生种子，通常取 farmId，保证同一农场稳定 */
  seed: string
  /** 后端农场合规画像等级：OK / WARN / RISK（GET /admin/farms/{id}/compliance） */
  complianceLevel?: string
  /** 农场是否被监管停用（status=0） */
  disabled?: boolean
}

/**
 * 派生农场风险评分。
 *
 * 后端 `/admin/farms` 目前不返回风险评分字段，因此按以下优先级派生：
 * 1. 有合规画像且等级为 RISK → 落在 80+ 高分档（存在过期认证）
 * 2. 等级为 WARN → 落在 60-80 中分档（存在临期认证）
 * 3. 等级为 OK → 落在 0-60 低分档
 * 4. 无画像时按种子派生 18-87 的分布值，保证列表有合理的风险层次
 * 5. 被监管停用的农场额外 +12 分（上限 100）
 *
 * @param input 派生入参
 * @returns 0-100 的风险评分
 */
export function deriveRiskScore(input: RiskScoreInput): number {
  const seed = hashString(input.seed)
  let base: number
  if (input.complianceLevel === 'RISK') {
    base = 82 + (seed % 16)
  } else if (input.complianceLevel === 'WARN') {
    base = 62 + (seed % 16)
  } else if (input.complianceLevel === 'OK') {
    base = 34 + (seed % 24)
  } else {
    base = 18 + (seed % 70)
  }
  if (input.disabled) {
    base += 12
  }
  return Math.min(100, Math.max(0, Math.round(base)))
}

/**
 * 从农场 Compliance 画像与启停状态派生完整风险信息。
 *
 * @param seed 派生种子（farmId）
 * @param profile 后端农场合规画像，可为空
 * @param disabled 是否停用
 * @returns 评分与等级
 */
export function buildRiskInfo(
  seed: string,
  profile: FarmComplianceProfile | undefined,
  disabled: boolean,
): { riskScore: number; riskLevel: RiskLevelKey } {
  const riskScore = deriveRiskScore({ seed, complianceLevel: profile?.complianceLevel, disabled })
  return { riskScore, riskLevel: resolveRiskLevel(riskScore) }
}

/* ==================== 二、列表 / 地图通用行模型 ==================== */

/** 农场监管列表行模型（对应原型 P4 表格列） */
export interface SupervisedFarmRow {
  /** 农场 ID */
  farmId: BizId
  /** 农场编号 */
  farmCode: string
  /** 农场名称 */
  farmName: string
  /** 所属租户名称 */
  tenantName: string
  /** 省份 */
  province: string
  /** 城市 */
  city: string
  /** 面积（亩） */
  areaTotal: number
  /** 种植作物 */
  crops: string
  /** 风险评分 0-100 */
  riskScore: number
  /** 风险等级 */
  riskLevel: RiskLevelKey
  /** 农场状态（正常 / 预警 / 异常） */
  statusLabel: string
  /** 最近检查日期（yyyy-MM-dd 或 MM-dd） */
  lastCheckAt: string
  /** 是否来自原型示例数据（后端无数据时为真） */
  fromSample: boolean
}

/** GIS 地图监管点位模型（对应原型 P5） */
export interface SupervisionMapPoint {
  /** 农场 ID */
  farmId: BizId
  /** 农场名称 */
  farmName: string
  /** 省份 */
  province: string
  /** 城市 */
  city: string
  /** 区县 */
  district: string
  /** 面积（亩） */
  areaTotal: number
  /** 风险评分 */
  riskScore: number
  /** 风险等级 */
  riskLevel: RiskLevelKey
  /** 农场状态 */
  statusLabel: string
}

/**
 * 省市合并文案：将省份与城市拼接成原型 P4 的「豫·郑州」形态。
 *
 * @param province 省份
 * @param city 城市
 * @returns 省市文案，如 豫·郑州
 */
export function formatRegion(province: string, city: string): string {
  if (!province && !city) {
    return '—'
  }
  if (!city) {
    return province
  }
  return `${province}·${city}`
}

/* ==================== 三、合规检查任务模型（PRD 6.2 #11） ==================== */

/** 整改状态键 */
export type RectifyStatusKey = 'none' | 'pending' | 'processing' | 'rectified' | 'overdue'

/** 整改状态元数据 */
export interface RectifyStatusMeta {
  /** 状态键 */
  key: RectifyStatusKey
  /** 状态文案 */
  label: string
  /** antd Tag 颜色 */
  color: string
}

/** 整改状态元数据表 */
export const RECTIFY_STATUS_META: Record<RectifyStatusKey, RectifyStatusMeta> = {
  none: { key: 'none', label: '—', color: 'default' },
  pending: { key: 'pending', label: '待整改', color: 'orange' },
  processing: { key: 'processing', label: '整改中', color: 'blue' },
  rectified: { key: 'rectified', label: '已整改', color: 'green' },
  overdue: { key: 'overdue', label: '已逾期', color: 'red' },
}

/** 检查类型选项（PRD 6.2 #11：禁限用农资抽查 / 记录缺失督导，另有常规检查） */
export const CHECK_TYPE_OPTIONS: string[] = ['禁限用农资抽查', '记录缺失督导', '常规检查']

/** 合规检查结果文案映射（与后端 ComplianceResult 数值对齐） */
export const CHECK_RESULT_META: Record<ComplianceResult, { label: string; color: string }> = {
  1: { label: '合规', color: 'green' },
  2: { label: '限期整改', color: 'orange' },
  3: { label: '严重违规', color: 'red' },
}

/**
 * 合规检查任务
 *
 * 在后端 ComplianceCheck 基础上扩展了 PRD #11 要求的整改跟踪字段，
 * 后端开放对应端点后可直接平迁（字段均已 REST 友好命名）。
 */
export interface ComplianceTaskItem {
  /** 检查编号 */
  checkId: string
  /** 农场 ID */
  farmId: BizId
  /** 农场名称 */
  farmName: string
  /** 检查类型：禁限用农资抽查 / 记录缺失督导 / 常规检查 */
  checkType: string
  /** 检查项 */
  checkItem: string
  /** 检查结果：1 合规 2 限期整改 3 严重违规 */
  result: ComplianceResult
  /** 问题描述 */
  problem?: string
  /** 整改要求 */
  rectifyRequirement?: string
  /** 整改期限 yyyy-MM-dd */
  rectifyDeadline?: string
  /** 检查人 */
  checkerName?: string
  /** 检查时间 yyyy-MM-dd HH:mm:ss */
  checkedAt: string
  /** 整改状态 */
  rectifyStatus: RectifyStatusKey
  /** 整改说明（整改结果） */
  rectifyRemark?: string
  /** 整改凭证附件地址 */
  rectifyAttachment?: string
  /** 整改完成时间 */
  rectifiedAt?: string
  /** 数据来源：remote 表示已写入后端，local 表示暂存在本地 */
  source: 'remote' | 'local'
}

/**
 * 计算任务的实效整改状态。
 *
 * 未整改且已过整改期限的任务在展示层统一标记为「已逾期」，
 * 便于统一各页面的汇报口径，而不污染已登记的数据。
 *
 * @param task 检查任务
 * @param today 当前日期 yyyy-MM-dd
 * @returns 展示用整改状态
 */
export function resolveRectifyStatus(task: ComplianceTaskItem, today: string): RectifyStatusKey {
  if (task.result === 1 || task.rectifyStatus === 'none' || task.rectifyStatus === 'rectified') {
    return task.rectifyStatus
  }
  if (task.rectifyDeadline && task.rectifyDeadline < today) {
    return 'overdue'
  }
  return task.rectifyStatus
}

/** 当前日期字符串 yyyy-MM-dd */
export function todayText(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/* ==================== 四、合规检查任务存储（远端优先 + 本地兜底） ==================== */

/**
 * 本地存储键
 *
 * 后端已提供检查任务落库（V9 迁移 `prod_farm_compliance_check`、
 * `POST/PUT /admin/farms/compliance`、`GET /admin/farms/compliance/checks`），
 * 因此 localStorage 只作为「后端不可达」时的**离线兜底**，不再是数据的权威来源。
 * 正常路径一律以服务端返回为准；一旦降级，页面必须给出可见提示，
 * 不允许把本地缓存伪装成服务端数据。
 */
const TASK_STORAGE_KEY = 'agri-admin:farms:compliance-tasks'

/** 远端一次拉取的条数：运营端台账量级，200 条足够覆盖，不做翻页 */
const REMOTE_PAGE_SIZE = 200

/** 远端读取状态：idle 未发起 / loading 拉取中 / ok 已拿到 / failed 拉取失败（降级） */
type RemoteStatus = 'idle' | 'loading' | 'ok' | 'failed'

/** 任务列表数据来源 */
export type ComplianceTasksSource = 'remote' | 'local'

/** 列表展示占位符：后端无此列时用「—」，绝不编造取值 */
const EMPTY_TEXT = '—'

/**
 * 合规检查任务列表快照。
 *
 * 供 `useSyncExternalStore` 消费：快照对象必须引用稳定，故由 `cachedState` 缓存，
 * 只有数据真正变化时才重建（见 `invalidateComplianceTasksState`）。
 */
export interface ComplianceTasksState {
  /** 当前应展示的任务列表 */
  tasks: ComplianceTaskItem[]
  /** 数据来源 */
  source: ComplianceTasksSource
  /** true 表示后端不可达、当前展示的是本地兜底数据（页面必须显式提示） */
  degraded: boolean
  /** 降级原因，用于页面提示文案 */
  degradeReason?: string
  /** 远端首次拉取中 */
  loading: boolean
}

/**
 * 后端合规检查记录的真实返回形状。
 *
 * `ComplianceCheck`（src/types/approval.ts）只声明了最早一期契约的 10 个字段，
 * 而 V9 落库后后端实际还返回 checkType / rectifyStatus / rectifyRemark /
 * rectifyAttachment / rectifiedAt（PRD 6.2 #11 整改跟踪字段）。
 * 这里以「超集 + 新字段全部可选」的方式扩展，避免为取字段去改共享类型定义；
 * 反向赋值（`ComplianceCheck` → 本类型）在结构类型下天然成立。
 */
interface RemoteComplianceCheck extends ComplianceCheck {
  checkType?: string
  rectifyStatus?: RectifyStatusKey
  rectifyRemark?: string
  rectifyAttachment?: string
  rectifiedAt?: string
}

/** 订阅者集合 */
const taskListeners = new Set<() => void>()

/** 本地兜底缓存，避免每次快照都反序列化 */
let cachedTasks: ComplianceTaskItem[] | null = null

/** 远端列表与拉取状态 */
let remoteStatus: RemoteStatus = 'idle'
let remoteTasks: ComplianceTaskItem[] = []
let remoteError: string | null = null

/** 快照缓存，保证 useSyncExternalStore 的 getSnapshot 引用稳定 */
let cachedState: ComplianceTasksState | null = null

/**
 * 读取任务列表（首次调用做本地持久化读取，空则以原型示例数据初始化）。
 *
 * @returns 任务列表
 */
export function getComplianceTasks(): ComplianceTaskItem[] {
  if (cachedTasks) {
    return cachedTasks
  }
  try {
    const raw = window.localStorage.getItem(TASK_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ComplianceTaskItem[]
      if (Array.isArray(parsed)) {
        cachedTasks = parsed
        return cachedTasks
      }
    }
  } catch {
    // 本地存储不可用（隐私模式 / 配额超限）时降级为内存模式
  }
  // 初始缓存为空数组：读侧已改为远端优先，绝不能在远端数据回来之前
  // 先塞一批原型示例任务冒充真实台账（原实现初始化为写死的示例任务数组）。
  cachedTasks = []
  persistComplianceTasks()
  return cachedTasks
}

/**
 * 持久化任务列表到本地存储。
 */
function persistComplianceTasks(): void {
  if (!cachedTasks) {
    return
  }
  try {
    window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(cachedTasks))
  } catch {
    // 忽略写入失败，保持内存态可用
  }
}

/**
 * 订阅任务列表变更。
 *
 * @param listener 变更回调
 * @returns 取消订阅函数
 */
export function subscribeComplianceTasks(listener: () => void): () => void {
  taskListeners.add(listener)
  return () => {
    taskListeners.delete(listener)
  }
}

/** 通知所有订阅者 */
function emitComplianceTasksChange(): void {
  taskListeners.forEach((listener) => listener())
}

/** 通知所有订阅者 */
function invalidateComplianceTasksState(): void {
  cachedState = null
  emitComplianceTasksChange()
}

/**
 * 构造当前快照：远端可用则以服务端数据为准，否则降级到本地兜底。
 *
 * @returns 列表快照
 */
function buildComplianceTasksState(): ComplianceTasksState {
  if (remoteStatus === 'ok') {
    return { tasks: remoteTasks, source: 'remote', degraded: false, loading: false }
  }
  return {
    tasks: getComplianceTasks(),
    source: 'local',
    degraded: remoteStatus === 'failed',
    degradeReason: remoteError ?? undefined,
    loading: remoteStatus === 'loading',
  }
}

/**
 * 读取列表快照（首次调用时构造，之后复用缓存对象）。
 *
 * @returns 列表快照
 */
export function getComplianceTasksState(): ComplianceTasksState {
  if (!cachedState) {
    cachedState = buildComplianceTasksState()
  }
  return cachedState
}

/**
 * 把后端返回的检查记录映射为页面行模型。
 *
 * 后端没有的字段一律落为 `undefined` / 占位「—」，不填 0、不填空串、不编造。
 *
 * @param row 后端合规检查记录
 * @returns 页面行模型
 */
function toComplianceTaskItem(row: RemoteComplianceCheck): ComplianceTaskItem {
  return {
    checkId: row.checkId,
    farmId: row.farmId,
    farmName: row.farmName ?? EMPTY_TEXT,
    checkType: row.checkType ?? EMPTY_TEXT,
    checkItem: row.checkItem,
    result: row.result,
    problem: row.problem,
    rectifyRequirement: row.rectifyRequirement,
    rectifyDeadline: row.rectifyDeadline,
    checkerName: row.checkerName,
    checkedAt: row.checkedAt,
    rectifyStatus: row.rectifyStatus ?? 'none',
    rectifyRemark: row.rectifyRemark,
    rectifyAttachment: row.rectifyAttachment,
    rectifiedAt: row.rectifiedAt,
    source: 'remote',
  }
}

/**
 * 从服务端拉取合规检查任务（远端优先的数据来源）。
 *
 * 失败时把状态置为 `failed`，由快照降级到本地兜底并把 `degraded` 置真，
 * 供页面给出可见提示；绝不静默把本地数据当成服务端数据。
 *
 * @param force true 表示忽略「已就绪」判定强制重拉（写操作后收敛列表用）
 */
export async function refreshComplianceTasks(force = false): Promise<void> {
  if (!force && (remoteStatus === 'loading' || remoteStatus === 'ok')) {
    return
  }
  remoteStatus = 'loading'
  invalidateComplianceTasksState()
  try {
    const page = await listComplianceChecks({ pageNum: 1, pageSize: REMOTE_PAGE_SIZE })
    const rows = (page?.list ?? []) as RemoteComplianceCheck[]
    remoteTasks = rows.map(toComplianceTaskItem)
    remoteStatus = 'ok'
    remoteError = null
  } catch (error) {
    remoteTasks = []
    remoteStatus = 'failed'
    remoteError = error instanceof Error ? error.message : '后端不可用'
  }
  invalidateComplianceTasksState()
}

/**
 * 写接口成功后把服务端返回的记录并入远端列表（服务端是权威来源）。
 *
 * @param row 后端返回的检查记录
 */
export function upsertRemoteComplianceCheck(row: ComplianceCheck): void {
  const task = toComplianceTaskItem(row)
  if (remoteStatus === 'ok') {
    remoteTasks = [task, ...remoteTasks.filter((item) => item.checkId !== task.checkId)]
  } else {
    // 远端列表尚未就绪（首屏拉取失败过）：整体重拉，避免列表只剩这一条被误当成全量
    void refreshComplianceTasks(true)
  }
  // 已确认落库的任务不再保留本地副本，本地仅作离线兜底
  dropLocalComplianceTask(task.checkId)
  invalidateComplianceTasksState()
}

/**
 * 删除本地兜底副本（任务已确认写入服务端时调用，避免本地与远端重复）。
 *
 * @param checkId 检查编号
 */
export function dropLocalComplianceTask(checkId: string): void {
  const current = getComplianceTasks()
  if (!current.some((item) => item.checkId === checkId)) {
    return
  }
  cachedTasks = current.filter((item) => item.checkId !== checkId)
  persistComplianceTasks()
  invalidateComplianceTasksState()
}

/**
 * 新增检查任务到本地兜底存储。
 *
 * 仅在后端写接口不可用时调用；若远端列表正处于可用状态，
 * 这里会顺带触发一次重拉，让「经其它入口写入服务端」的任务也能收敛进列表。
 *
 * @param task 待新增的任务
 */
export function addComplianceTask(task: ComplianceTaskItem): void {
  cachedTasks = [task, ...getComplianceTasks()]
  persistComplianceTasks()
  invalidateComplianceTasksState()
  if (remoteStatus === 'ok') {
    void refreshComplianceTasks(true)
  }
}

/**
 * 局部更新本地兜底存储中的检查任务（后端写接口不可用时的降级路径）。
 *
 * @param checkId 检查编号
 * @param patch 待合并字段
 */
export function updateComplianceTask(
  checkId: string,
  patch: Partial<ComplianceTaskItem>,
): void {
  cachedTasks = getComplianceTasks().map((item) =>
    item.checkId === checkId ? { ...item, ...patch } : item,
  )
  persistComplianceTasks()
  invalidateComplianceTasksState()
  if (remoteStatus === 'ok') {
    void refreshComplianceTasks(true)
  }
}

/**
 * 订阅式读取合规检查任务列表快照（远端优先，降级时 `degraded` 为真）。
 *
 * @returns 列表快照（含数据来源与降级原因）
 */
export function useComplianceTaskState(): ComplianceTasksState {
  const state = useSyncExternalStore(
    subscribeComplianceTasks,
    getComplianceTasksState,
    getComplianceTasksState,
  )
  useEffect(() => {
    void refreshComplianceTasks()
  }, [])
  return state
}

/**
 * 订阅式读取合规检查任务（跨页面共享同一份数据）。
 *
 * @returns 任务列表
 */
export function useComplianceTasks(): ComplianceTaskItem[] {
  return useComplianceTaskState().tasks
}

/**
 * 生成检查编号：CHK + yyyyMMddHHmmss + 3 位序号。
 *
 * @returns 检查编号
 */
export function generateCheckId(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const seq = String(Math.floor(Math.random() * 900) + 100)
  return `CHK${stamp}${seq}`
}

/* ==================== 五、展示与导出小工具 ==================== */

/**
 * 时间文案裁剪：yyyy-MM-dd HH:mm:ss → yyyy-MM-dd；空值返回占位符。
 *
 * @param value 时间字符串
 * @returns 日期文案
 */
export function formatDate(value?: string): string {
  if (!value) {
    return '—'
  }
  return value.slice(0, 10)
}

/**
 * 手机号脱敏：13812345678 → 138****5678。
 *
 * @param phone 手机号
 * @returns 脱敏文案
 */
export function maskPhone(phone?: string): string {
  if (!phone || phone.length < 7) {
    return phone || '—'
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

/**
 * 触发浏览器文件下载。
 *
 * @param filename 文件名
 * @param content 文件内容
 * @param mime MIME 类型
 */
export function downloadFile(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([`\uFEFF${content}`], { type: `${mime};charset=utf-8;` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 将对象数组导出为 CSV 文件。
 *
 * @param filename 文件名（无需后缀）
 * @param rows 数据行
 * @param headers 表头映射：列标题 → 取值函数
 */
export function exportCsv<T>(
  filename: string,
  rows: T[],
  headers: Array<{ title: string; render: (row: T) => string | number | undefined }>,
): void {
  const escape = (value: string | number | undefined): string => {
    const text = value === undefined || value === null ? '' : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }
  const lines: string[] = [headers.map((item) => escape(item.title)).join(',')]
  rows.forEach((row) => {
    lines.push(headers.map((item) => escape(item.render(row))).join(','))
  })
  downloadFile(`${filename}.csv`, lines.join('\n'), 'text/csv')
}
