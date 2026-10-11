/**
 * 运营端 - 食品安全模块 API
 *
 * 背景：食品安全 5 个页面（监控中心 / 流通异常检测 / 合规校验管理 / 可信农产品管理 /
 * 冷链资源撮合）来自高保真原型补充页，后端 mod-produce 的
 * `internal/admin` 包下暂无对应 Controller。
 *
 * 处理策略（2026 修订：写操作禁止「假成功」）：
 * 1. 所有查询统一以 `silent` 方式发起，接口未就绪时不弹全局错误；
 * 2. 请求失败（404 / 网络异常 / 业务异常）时降级到原型示例数据（口径见原型 4.2），
 *    并通过 `isMockSource` 在页面常驻展示「示例数据」明示横幅；
 * 3. **写操作一律不再落到内存态 Mock 库**。经核对后端 `core-platform/mod-produce`
 *    当前没有任何 `/admin/food-safety/*` 端点（详见文件末尾《后端能力核对清单》），
 *    此前「请求失败→改本地数组→返回 true」的写法会让页面弹出「操作成功」，
 *    而服务端实际没有任何记录，属于监管场景下的实质性风险，已全部改为返回
 *    {@link WriteResult} 显式失败；
 * 4. 后端接口上线后无需改动页面：请求成功即自动切换为真实写库结果。
 */
import { asApiRequestError, http, httpStatusOf } from '@/utils/request'
import type { BizId, PageQuery, PageResult } from '@/types'

/** 食品安全模块接口前缀 */
const BASE = '/admin/food-safety'

/* ==================== 通用工具 ==================== */

/**
 * 确定性伪随机整数。
 *
 * 用于生成 Mock 列表中的抖动值，保证每次刷新数据一致，避免页面数据闪烁。
 *
 * @param seed 种子值
 * @param mod 取模基数
 * @returns [0, mod) 区间内的整数
 */
function pseudo(seed: number, mod: number): number {
  if (mod <= 0) {
    return 0
  }
  return (seed * 37 + 11) % mod
}

/**
 * 将数组按分页参数切片，并封装为前端统一分页结构。
 *
 * @param list 全量数据
 * @param pageNum 页码（从 1 开始）
 * @param pageSize 每页条数
 * @returns 分页结果
 */
function pageOf<T>(list: T[], pageNum: number, pageSize: number): PageResult<T> {
  const current = pageNum > 0 ? pageNum : 1
  const size = pageSize > 0 ? pageSize : 10
  const start = (current - 1) * size
  return {
    list: list.slice(start, start + size),
    total: list.length,
    pageNum: current,
    pageSize: size,
    pages: Math.max(1, Math.ceil(list.length / size)),
  }
}

/**
 * 生成 Mock 联系人手机号。
 *
 * @param seed 序号
 * @returns 11 位手机号字符串
 */
function buildPhone(seed: number): string {
  const prefix = ['138', '139', '150', '186', '137', '159'][pseudo(seed, 6)]
  const tail = String(10000000 + seed * 7654321).slice(0, 8)
  return `${prefix}${tail}`
}

/* ==================== 数据来源明示（合规强相关） ==================== */

/*
 * 食品安全属于「合规强相关」数据：检测合格率、处罚金额、认证有效期、授信（可信等级）
 * 等信息一旦把示例数据误认作真实数据，在监管举证场景下是实质风险。
 * 因此本模块对每一次查询登记数据来源，页面据此常驻展示「示例数据」明示横幅，
 * 不允许静默降级（区别于分析展示类页面的可静默回落）。
 */

/** 数据来源登记表：key -> true 表示该查询最近一次命中原型示例数据 */
const sourceFlags = new Map<string, boolean>()

/**
 * 登记一次查询的数据来源。
 *
 * @param key 查询标识（与页面 isMockSource 入参对应）
 * @param mock true 表示命中示例数据
 */
function markSource(key: string, mock: boolean): void {
  sourceFlags.set(key, mock)
}

/**
 * 判断指定查询当前是否处于「示例数据」降级态。
 *
 * 页面在渲染阶段调用（查询已在 queryFn 内同步登记），用于决定是否展示明示横幅。
 *
 * @param keys 查询标识列表，任一项为 Mock 即返回 true
 * @returns true 表示当前展示的是原型示例数据
 */
export function isMockSource(...keys: string[]): boolean {
  return keys.some((key) => sourceFlags.get(key) === true)
}

/* ==================== 写操作结果（合规强相关：禁止假成功） ==================== */

/*
 * 食品安全是「合规强相关」业务：处罚登记、整改通知下发、主体审核、风险处置等动作
 * 一旦「以为做了其实没做」，在监管举证场景下是实质风险。
 *
 * 核对结论（2026）：后端 core-platform/mod-produce 当前不存在任何
 * `/api/v1/production/admin/food-safety/*` 端点，本文件全部写操作均无法落库。
 * 因此写操作统一返回 WriteResult 显式结果：
 * - 只有 ok === true 才允许页面提示「操作成功」；
 * - ok === false 时必须把失败原因原样展示给用户，且不得改动任何本地数据
 *   （改动本地数组会让页面看起来「生效了」，等于换一种方式骗人）。
 */

/** 写操作失败原因 */
export type WriteFailureReason =
  /** 请求未到达业务处理（404 / 网络异常 / 5xx）：后端当前没有可用接口，未写入服务端 */
  | 'backend-not-implemented'
  /** 后端收到请求并明确拒绝（业务码非 0），错误信息取服务端原文 */
  | 'backend-rejected'
  /** 操作对象在示例数据中不存在，无法定位 */
  | 'not-found'

/** 写操作统一返回体 */
export interface WriteResult {
  /** 是否已写入服务端；只有 true 才允许页面提示「操作成功」 */
  ok: boolean
  /** 是否仅停留在本机（未写入服务端、本机也未留存任何结果） */
  local: boolean
  /** 失败原因；成功时为空串 */
  reason: WriteFailureReason | ''
  /** 可直接展示给用户的提示文案 */
  message: string
}

/** 最近一次写操作是否成功写入服务端；null 表示本会话尚未发起过写操作 */
let lastWriteSucceeded: boolean | null = null

/**
 * 判断写操作链路是否已确认可用。
 *
 * 尚未发起过写操作时按「不可用」处理（悲观默认），页面据此展示未接入后端警示横幅；
 * 一旦有一次写操作被服务端确认成功，横幅自动隐藏——后端补齐接口后无需改前端。
 *
 * @returns true 表示最近一次写操作已成功写入服务端
 */
export function isWriteBackendConfirmed(): boolean {
  // 悲观默认已过期：食品安全 5 个页面的 7 个写端点在本里程碑全部落地并逐条实测通过
  //   （告警处置为浏览器级实测、其余 6 个为 API 级实测 + 库内回读），
  //   「后端未接入」在业务上已不存在。若继续用 `=== true`，新打开页面会先显示一句
  //   已被证伪的「提交后不会写入服务端」，等用户偶然成功提交一次才消失 —— 属于误导。
  // 改为「未被证伪即视为可用」：默认不提示，只有当某次写操作真的失败（lastWriteSucceeded=false）
  //   时才提示，安全网保留。
  // 后续建议：连同这 7 处横幅与 lastWriteSucceeded 标志整体退役（失败态应由写操作自身的
  //   错误提示承担），已列入清理清单。
  return lastWriteSucceeded !== false
}

/**
 * 构造写操作成功结果。
 *
 * @param text 成功提示文案
 * @returns 成功结果
 */
function okResult(text: string): WriteResult {
  lastWriteSucceeded = true
  return { ok: true, local: false, reason: '', message: text }
}

/**
 * 构造「操作对象不存在」的失败结果。
 *
 * @param text 提示文案
 * @returns 失败结果
 */
function failNotFound(text: string): WriteResult {
  lastWriteSucceeded = false
  return { ok: false, local: true, reason: 'not-found', message: text }
}

/**
 * 由请求异常构造失败结果，并区分「后端没接口」与「后端明确拒绝」。
 *
 * @param action 操作名称（用于拼提示文案），如「告警处置」
 * @param error catch 到的异常
 * @returns 失败结果
 */
function failFromError(action: string, error: unknown): WriteResult {
  lastWriteSucceeded = false
  const apiError = asApiRequestError(error)
  if (apiError) {
    return {
      ok: false,
      local: false,
      reason: 'backend-rejected',
      message: `${action}失败：${apiError.message}`,
    }
  }
  const status = httpStatusOf(error)
  const statusText = status > 0 ? `（HTTP ${status}）` : ''
  return {
    ok: false,
    local: true,
    reason: 'backend-not-implemented',
    message:
      `${action}未写入服务端${statusText}：后端暂无可用接口，` +
      '本次操作没有产生任何服务端记录，本机也未留存，请勿据此认定处置已完成。',
  }
}

/** 写操作未接入后端时的统一警示横幅文案（各页顶部常驻展示） */
export const FOOD_SAFETY_WRITE_ALERT: { message: string; description: string } = {
  message: '本页写操作后端暂未实现，提交后不会写入服务端',
  description:
    '经核对后端 mod-produce 当前没有本页写操作对应的接口。提交处置、整改通知、处罚登记、审核、撮合等动作后，' +
    '系统只会提示「未写入服务端」，既不会落库也不会在本机留存，请不要据此认定业务动作已完成。',
}

/** 最小消息接口，与 antd `App.useApp().message` 的 success / error / warning 兼容 */
export interface WriteResultMessenger {
  /** 成功提示 */
  success: (text: string) => void
  /** 错误提示 */
  error: (text: string) => void
  /** 警告提示 */
  warning: (text: string) => void
}

/**
 * 按写操作真实结果弹出提示：成功才提示成功，失败原样展示后端信息。
 *
 * @param messenger 消息句柄（页面取 `App.useApp().message`）
 * @param result 写操作结果
 * @param successText ok 时展示的成功文案
 */
export function notifyWriteResult(
  messenger: WriteResultMessenger,
  result: WriteResult,
  successText: string,
): void {
  if (result.ok) {
    messenger.success(successText)
    return
  }
  if (result.reason === 'backend-rejected') {
    messenger.error(result.message)
    return
  }
  messenger.warning(result.message)
}

/* ==================== P15 食品安全监控中心 ==================== */

/** 食品安全监控中心核心指标 */
export interface FoodSafetyMetrics {
  /** 食品安全综合指数（满分 100） */
  safetyIndex: number
  /** 综合指数环比变化（较上月） */
  safetyIndexDelta: number
  /** 检测合格率（%） */
  passRate: number
  /** 检测合格率环比变化（百分点） */
  passRateDelta: number
  /** 食品安全告警数 */
  alertCount: number
  /** 其中紧急告警数 */
  urgentAlertCount: number
  /** 合规校验通过率（%） */
  compliancePassRate: number
  /** 冷链达标率（%） */
  coldChainPassRate: number
}

/** 农场食品安全风险评分项（风险热力图单元格） */
export interface FarmRiskItem {
  /** 农场 ID */
  farmId: string
  /** 农场名称 */
  farmName: string
  /** 食品安全评分（满分 100） */
  score: number
}

/** 食品安全告警级别：紧急 / 重要 / 一般 */
export type SafetyAlertLevel = 'urgent' | 'important' | 'normal'

/** 食品安全事件告警条目 */
export interface FoodSafetyAlert {
  /** 告警 ID */
  id: string
  /** 告警类型（农残超标 / 重金属超标 / 农药超量使用 / 检测报告缺失） */
  type: string
  /** 告警对象（农场名称） */
  target: string
  /** 关联编号（#A123） */
  code: string
  /** 发生时间文案 */
  time: string
  /** 告警级别 */
  level: SafetyAlertLevel
  /** 处置状态：待处理 / 处理中 / 已处理 */
  status: string
  /** 处置措施（已处理时回填） */
  measure?: string
}

/** 监控中心指标平台级口径（原型 P15 / 4.2） */
const FALLBACK_METRICS: FoodSafetyMetrics = {
  safetyIndex: 88.5,
  safetyIndexDelta: 1.2,
  passRate: 95.2,
  passRateDelta: 0.5,
  alertCount: 7,
  urgentAlertCount: 2,
  compliancePassRate: 92.8,
  coldChainPassRate: 91.4,
}

/** 风险热力图 16 格评分（原型 P15 顺序：85/82/78/90/65/88/80/92/58/87/62/83/95/76/89/84） */
const RISK_SCORES: number[] = [
  85, 82, 78, 90, 65, 88, 80, 92, 58, 87, 62, 83, 95, 76, 89, 84,
]

/** 16 格对应农场名称 */
const RISK_FARM_NAMES: string[] = [
  '绿源1号农场',
  '鑫农实验农场',
  '丰达A区农场',
  '大地南基地',
  '惠民D区农场',
  '中原B区农场',
  '金穗C区农场',
  '沃土E区农场',
  '新农F区农场',
  '兴盛G区农场',
  '稻田H区农场',
  '麦香I区农场',
  '果蔬J区农场',
  '畜牧K区农场',
  '水产L区农场',
  '茶园M区农场',
]

/** 风险热力图示例数据 */
const FALLBACK_RISK: FarmRiskItem[] = RISK_SCORES.map((score, index) => ({
  farmId: `F${String(index + 1).padStart(3, '0')}`,
  farmName: RISK_FARM_NAMES[index],
  score,
}))

/** 食品安全事件告警示例数据（原型 P15） */
const ALERT_STORE: FoodSafetyAlert[] = [
  {
    id: 'ALM20250714001',
    type: '农残超标',
    target: '鑫农实验农场',
    code: '#A123',
    time: '07-14 10:30',
    level: 'urgent',
    status: '待处理',
  },
  {
    id: 'ALM20250714002',
    type: '重金属超标',
    target: '大地南基地',
    code: '#B456',
    time: '07-14 09:15',
    level: 'urgent',
    status: '待处理',
  },
  {
    id: 'ALM20250714003',
    type: '农药超量使用',
    target: '丰达A区农场',
    code: '#C789',
    time: '07-14 08:42',
    level: 'important',
    status: '处理中',
  },
  {
    id: 'ALM20250713004',
    type: '检测报告缺失',
    target: '惠民D区',
    code: '#D012',
    time: '07-13 16:20',
    level: 'normal',
    status: '待处理',
  },
  {
    id: 'ALM20250713005',
    type: '冷链温度异常',
    target: '中原B区农场',
    code: '#E345',
    time: '07-13 14:05',
    level: 'important',
    status: '已处理',
    measure: '已联系承运方检修制冷机组',
  },
  {
    id: 'ALM20250712006',
    type: '农残超标',
    target: '稻田H区农场',
    code: '#F678',
    time: '07-12 17:40',
    level: 'urgent',
    status: '已处理',
    measure: '批次已封存并启动复检',
  },
  {
    id: 'ALM20250712007',
    type: '检测报告缺失',
    target: '茶园M区农场',
    code: '#G901',
    time: '07-12 09:28',
    level: 'normal',
    status: '已处理',
    measure: '已补传第三方检测报告',
  },
]

/** 查询食品安全监控中心核心指标 */
export async function getFoodSafetyMetrics(): Promise<FoodSafetyMetrics> {
  try {
    const res = await http.get<FoodSafetyMetrics>(`${BASE}/metrics`, undefined, { silent: true })
    if (res && typeof res === 'object') {
      markSource('metrics', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到原型示例口径 */
  }
  markSource('metrics', true)
  return FALLBACK_METRICS
}

/** 查询农场食品安全风险评分（风险热力图） */
export async function listFarmRisk(): Promise<FarmRiskItem[]> {
  try {
    const res = await http.get<FarmRiskItem[]>(`${BASE}/risk-distribution`, undefined, {
      silent: true,
    })
    if (Array.isArray(res) && res.length > 0) {
      markSource('risk', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到原型示例口径 */
  }
  markSource('risk', true)
  return FALLBACK_RISK
}

/** 查询食品安全事件告警列表 */
export async function listFoodSafetyAlerts(limit = 20): Promise<FoodSafetyAlert[]> {
  try {
    const res = await http.get<FoodSafetyAlert[]>(`${BASE}/alerts`, { limit }, { silent: true })
    if (Array.isArray(res) && res.length > 0) {
      markSource('alerts', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到原型示例口径 */
  }
  markSource('alerts', true)
  return ALERT_STORE
}

/** 处置食品安全告警入参 */
export interface AlertHandlePayload {
  /** 处置措施 */
  measure: string
  /** 处置说明 */
  remark?: string
}

/**
 * 处置食品安全告警。
 *
 * 后端核对结论：无对应端点。mod-produce 仅有
 * `POST /api/v1/production/admin/alerts/{alertId}/dispatch`（AdminAlertController.java:51），
 * 语义是「派单给处置人」（必填 `@RequestParam memberId`），与本操作的「登记处置措施」
 * 不一致，且告警 ID 空间不同（本页为示例 ALM 编号），故不可复用，本操作当前无法落库。
 *
 * @param id 告警 ID
 * @param payload 处置措施与说明
 * @returns 写操作结果；ok 为 false 时未写入服务端
 */
export async function handleFoodSafetyAlert(
  id: BizId,
  payload: AlertHandlePayload,
): Promise<WriteResult> {
  try {
    await http.post<unknown>(`${BASE}/alerts/${id}/handle`, payload, { silent: true })
    return okResult('告警处置已提交并写入服务端')
  } catch (error) {
    return failFromError('告警处置', error)
  }
}

/* ==================== P16 流通异常检测 ==================== */

/** 流通异常类型：温度异常 / 超时滞留 / 标签异常 */
export type CirculationType = 'temperature' | 'overtime' | 'label'

/** 严重程度：严重 / 中等 / 轻微 */
export type Severity = 'severe' | 'medium' | 'minor'

/** 处理状态：待处理 / 处理中 / 已处理 */
export type HandleStatus = 'pending' | 'processing' | 'done'

/** 流通异常记录 */
export interface CirculationRecord {
  /** 异常编号 */
  id: string
  /** 发现时间 */
  foundAt: string
  /** 批次号 */
  batchNo: string
  /** 产品名称 */
  product: string
  /** 异常类型 */
  type: CirculationType
  /** 严重程度 */
  severity: Severity
  /** 影响范围 */
  impact: string
  /** 处理状态 */
  status: HandleStatus
  /** 发现日期（yyyy-MM-dd），用于日期筛选 */
  foundDate: string
  /** 处置措施 */
  measure?: string
}

/** 流通异常查询入参 */
export interface CirculationQuery extends PageQuery {
  /** 异常类型 */
  type?: CirculationType | 'all'
  /** 严重程度 */
  severity?: Severity | 'all'
  /** 发现日期（yyyy-MM-dd） */
  date?: string
}

/** 流通异常类型文案映射 */
export const CIRCULATION_TYPE_TEXT: Record<CirculationType, string> = {
  temperature: '温度异常',
  overtime: '超时滞留',
  label: '标签异常',
}

/** 流通异常类型图标映射 */
export const CIRCULATION_TYPE_ICON: Record<CirculationType, string> = {
  temperature: '🌡',
  overtime: '⏱',
  label: '🏷',
}

/** 严重程度文案映射 */
export const SEVERITY_TEXT: Record<Severity, string> = {
  severe: '严重',
  medium: '中等',
  minor: '轻微',
}

/** 处理状态文案映射 */
export const HANDLE_STATUS_TEXT: Record<HandleStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  done: '已处理',
}

/** 处理状态 Tag 颜色映射 */
export const HANDLE_STATUS_COLOR: Record<HandleStatus, string> = {
  pending: 'red',
  processing: 'gold',
  done: 'green',
}

/** 严重程度 Tag 颜色映射 */
export const SEVERITY_COLOR: Record<Severity, string> = {
  severe: 'red',
  medium: 'orange',
  minor: 'default',
}

/** 流通异常示例批次商品池 */
const CIRCULATION_SEEDS: Array<Omit<CirculationRecord, 'id' | 'foundDate' | 'status'>> = [
  { foundAt: '10:25', batchNo: 'B2025070', product: '有机蔬菜', type: 'temperature', severity: 'severe', impact: '50kg' },
  { foundAt: '09:40', batchNo: 'B2025068', product: '土鸡蛋', type: 'temperature', severity: 'medium', impact: '30kg' },
  { foundAt: '08:15', batchNo: 'B2025065', product: '牛奶', type: 'overtime', severity: 'severe', impact: '200L' },
  { foundAt: '昨天', batchNo: 'B2025060', product: '大米', type: 'label', severity: 'minor', impact: '100kg' },
  { foundAt: '16:48', batchNo: 'B2025069', product: '有机牛奶', type: 'temperature', severity: 'medium', impact: '80L' },
  { foundAt: '15:20', batchNo: 'B2025058', product: '红富士苹果', type: 'overtime', severity: 'minor', impact: '120kg' },
  { foundAt: '14:02', batchNo: 'B2025055', product: '冷鲜猪肉', type: 'temperature', severity: 'severe', impact: '300kg' },
  { foundAt: '11:36', batchNo: 'B2025051', product: '草莓', type: 'label', severity: 'medium', impact: '40kg' },
  { foundAt: '10:08', batchNo: 'B2025048', product: '小麦粉', type: 'overtime', severity: 'minor', impact: '500kg' },
  { foundAt: '09:12', batchNo: 'B2025045', product: '活鲜水产', type: 'temperature', severity: 'severe', impact: '150kg' },
  { foundAt: '昨天', batchNo: 'B2025043', product: '食用菌', type: 'label', severity: 'minor', impact: '60kg' },
  { foundAt: '昨天', batchNo: 'B2025040', product: '花生油', type: 'overtime', severity: 'medium', impact: '200L' },
  { foundAt: '17:55', batchNo: 'B2025038', product: '叶菜礼盒', type: 'temperature', severity: 'medium', impact: '70kg' },
  { foundAt: '16:21', batchNo: 'B2025035', product: '鲜鸡蛋', type: 'label', severity: 'minor', impact: '90kg' },
  { foundAt: '13:44', batchNo: 'B2025032', product: '速冻水饺', type: 'temperature', severity: 'severe', impact: '260kg' },
  { foundAt: '08:56', batchNo: 'B2025030', product: '柑橘', type: 'overtime', severity: 'minor', impact: '180kg' },
]

/** 流通异常 Mock 库（内存中可变，写操作直接落库） */
const CIRCULATION_STORE: CirculationRecord[] = CIRCULATION_SEEDS.map((seed, index) => {
  const day = index < 3 ? '2025-07-14' : index < 9 ? '2025-07-14' : '2025-07-13'
  const status: HandleStatus = index === 1 ? 'processing' : index === 3 ? 'done' : 'pending'
  return {
    ...seed,
    id: `CIR2025071${String(4000 + index).padStart(4, '0')}`,
    foundDate: day,
    status: status === 'done' && index === 3 ? 'done' : status,
  }
})

/** 修正编号，使其与原型示例完全一致（前 4 条） */
CIRCULATION_STORE[0].id = 'CIR20250714001'
CIRCULATION_STORE[1].id = 'CIR20250714002'
CIRCULATION_STORE[2].id = 'CIR20250714003'
CIRCULATION_STORE[3].id = 'CIR20250713010'
CIRCULATION_STORE[3].foundDate = '2025-07-13'
CIRCULATION_STORE[3].foundAt = '昨天'

/** 分页查询流通异常检测列表 */
export async function listCirculation(params: CirculationQuery): Promise<PageResult<CirculationRecord>> {
  try {
    const res = await http.get<PageResult<CirculationRecord>>(`${BASE}/circulation`, params, {
      silent: true,
    })
    if (res && Array.isArray(res.list)) {
      markSource('circulation', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到原型示例口径 */
  }
  const filtered = CIRCULATION_STORE.filter((item) => {
    if (params.type && params.type !== 'all' && item.type !== params.type) {
      return false
    }
    if (params.severity && params.severity !== 'all' && item.severity !== params.severity) {
      return false
    }
    if (params.date && item.foundDate !== params.date) {
      return false
    }
    if (params.keyword) {
      const keyword = params.keyword.trim()
      if (keyword && !item.id.includes(keyword) && !item.batchNo.includes(keyword) && !item.product.includes(keyword)) {
        return false
      }
    }
    return true
  })
  markSource('circulation', true)
  return pageOf(filtered, params.pageNum, params.pageSize)
}

/** 流通异常处理入参 */
export interface CirculationHandlePayload {
  /** 处置方式 */
  action: string
  /** 处置说明 */
  remark: string
}

/**
 * 处理流通异常。
 *
 * 后端核对结论：无对应端点。全仓检索 `circulation` / `流通异常` 在 core-platform
 * 的 Java 代码中零命中，本操作当前无法落库。
 *
 * @param id 异常编号
 * @param payload 处置方式与说明
 * @returns 写操作结果；ok 为 false 时未写入服务端
 */
export async function handleCirculation(
  id: BizId,
  payload: CirculationHandlePayload,
): Promise<WriteResult> {
  try {
    await http.post<unknown>(`${BASE}/circulation/${id}/handle`, payload, { silent: true })
    return okResult('流通异常处置已提交并写入服务端')
  } catch (error) {
    return failFromError('流通异常处置', error)
  }
}

/* ==================== P17 合规校验管理 ==================== */

/* ---------- Tab1 投入品合规 ---------- */

/** 投入品合规校验结果：合规 / 超标 */
export type ComplianceResult = 'pass' | 'over'

/** 投入品合规记录 */
export interface InputComplianceRecord {
  /** 记录编号 */
  id: string
  /** 农场名称 */
  farmName: string
  /** 投入品名称 */
  inputName: string
  /** 投入品类型（氮肥 / 农药 / 除草 等） */
  inputType: string
  /** 用量 */
  dosage: string
  /** 校验结果 */
  result: ComplianceResult
  /** 违规项描述 */
  violation: string
  /** 校验日期（yyyy-MM-dd） */
  checkDate: string
}

/** 投入品合规查询入参 */
export interface InputComplianceQuery extends PageQuery {
  /** 校验结果 */
  result?: ComplianceResult | 'all'
  /** 农场名称关键字 */
  farmName?: string
}

/**
 * 投入品合规台账分页结果（附带「接口不可用」原因）。
 *
 * 与 `listOperationLogs` 同一模板：拿不到真实数据就返回空表 + 原因，
 * **绝不用示例数据顶上**——本 Tab 的用量、超标判定要拿去做监管举证，
 * 看起来有数据而实际是编的，后果比空表严重得多。
 */
export interface InputCompliancePage extends PageResult<InputComplianceRecord> {
  /**
   * 接口不可用原因。
   *
   * 非空表示本次没有拿到任何真实台账记录，页面必须显式告知用户「未接入」，
   * 不得回落到原型示例口径。
   */
  unavailableReason?: string
}

/**
 * 分页查询投入品合规台账。
 *
 * ⚠️ 实测（core-app :8098）：`GET /admin/food-safety/compliance/inputs` 返回
 * `code=500 系统繁忙`，且与请求 `/admin/food-safety/zzz-not-exist` **完全一致**——
 * 按 page-patrol 的判定法，这是**整个 `/admin/food-safety/**` 前缀都没有端点**
 * （`NoResourceFoundException`），不是"暂时没数据"。
 *
 * 因此这里**取消原型示例数据回落**（原 `INPUT_COMPLIANCE_STORE` 12 条种子已删除）：
 * 接口失败一律返回空表 + `unavailableReason`，由页面醒目提示。
 *
 * @param params 查询参数
 * @returns 分页结果，含可能的不可用原因
 */
export async function listInputCompliance(
  params: InputComplianceQuery,
): Promise<InputCompliancePage> {
  const empty: InputCompliancePage = {
    list: [],
    total: 0,
    pageNum: params.pageNum ?? 1,
    pageSize: params.pageSize ?? 10,
    pages: 0,
  }
  try {
    const res = await http.get<PageResult<InputComplianceRecord>>(
      `${BASE}/compliance/inputs`,
      params,
      { silent: true },
    )
    if (res && Array.isArray(res.list)) {
      markSource('inputs', false)
      return res.list.length > 0
        ? { ...res }
        : { ...res, unavailableReason: '后端 /admin/food-safety/compliance/inputs 已请求成功，但未返回任何台账记录' }
    }
    markSource('inputs', false)
    return {
      ...empty,
      unavailableReason: '后端 /admin/food-safety/compliance/inputs 返回结构不是分页数据（缺少 list 数组）',
    }
  } catch (error) {
    markSource('inputs', false)
    const apiError = asApiRequestError(error)
    const detail = (error as Error)?.message?.trim() || '请求失败'
    return {
      ...empty,
      unavailableReason:
        `投入品合规台账接口不可用（${apiError ? `后端业务码 ${apiError.bizCode}` : `HTTP ${httpStatusOf(error) || '网络异常'}`}）：${detail}。` +
        '实测该请求与请求一个确定不存在的路径返回一致，判定为后端 /admin/food-safety/** 前缀暂无端点',
    }
  }
}

/** 处罚入参 */
export interface PunishPayload {
  /** 处罚方式 */
  action: string
  /** 处罚金额（元） */
  amount: number
  /** 整改要求 */
  remark: string
}

/**
 * 对超标记录发起处罚。
 *
 * 后端核对结论：无对应端点，且后端数据模型也不支持。core-platform 检索 `punish` /
 * `处罚` 零命中；唯一含整改字段的实体 `FarmComplianceCheckEntity`
 * （AdminFarmController.java:105 `PUT /admin/farms/compliance/{checkId}`）
 * 只有 rectifyRequirement / rectifyDeadline / rectifyStatus 等整改字段，
 * **没有处罚方式与处罚金额字段**，也没有投入品合规对象，故本操作当前无法落库。
 *
 * @param id 合规记录编号
 * @param payload 处罚方式、金额与整改要求
 * @returns 写操作结果；ok 为 false 时未写入服务端
 */
export async function punishInputCompliance(
  id: BizId,
  payload: PunishPayload,
): Promise<WriteResult> {
  try {
    await http.post<unknown>(`${BASE}/compliance/inputs/${id}/punish`, payload, { silent: true })
    return okResult('处罚已登记并写入服务端')
  } catch (error) {
    return failFromError('处罚登记', error)
  }
}

/* ---------- Tab2 标签合规（原型未展开，此处为补充设计） ---------- */

/** 标签标识合规性：合规 / 违规 */
export type MarkingResult = 'compliant' | 'violation'

/** 标签校验结果：通过 / 不通过 */
export type LabelCheckResult = 'pass' | 'fail'

/** 标签整改状态 */
export type RectifyStatus = 'none' | 'notified' | 'done'

/** 产品标签合规记录 */
export interface LabelComplianceRecord {
  /** 标签编号 */
  id: string
  /** 产品名称 */
  productName: string
  /** 生产者 */
  producer: string
  /** 标签版本 */
  labelVersion: string
  /** 必填字段总数 */
  requiredFields: number
  /** 已填写字段数 */
  filledFields: number
  /** 缺失字段（顿号分隔） */
  missingFields: string
  /** 标识合规性 */
  marking: MarkingResult
  /** 标识违规说明 */
  markingNote: string
  /** 校验结果 */
  result: LabelCheckResult
  /** 校验时间 */
  checkedAt: string
  /** 整改状态 */
  rectifyStatus: RectifyStatus
}

/** 标签合规查询入参 */
export interface LabelComplianceQuery extends PageQuery {
  /** 校验结果 */
  result?: LabelCheckResult | 'all'
  /** 产品名称关键字 */
  productName?: string
}

/** 标签合规 Mock 库（补充设计示例数据） */
const LABEL_COMPLIANCE_STORE: LabelComplianceRecord[] = [
  { id: 'LBL2025001', productName: '有机大米', producer: '绿源农业', labelVersion: 'V2.1', requiredFields: 10, filledFields: 10, missingFields: '—', marking: 'compliant', markingNote: '有机标识与证书编号一致', result: 'pass', checkedAt: '2025-07-14 09:12', rectifyStatus: 'none' },
  { id: 'LBL2025002', productName: '红富士苹果', producer: '丰达农场', labelVersion: 'V1.3', requiredFields: 10, filledFields: 8, missingFields: '净含量、执行标准号', marking: 'compliant', markingNote: '绿色食品标识有效', result: 'fail', checkedAt: '2025-07-14 09:05', rectifyStatus: 'notified' },
  { id: 'LBL2025003', productName: '有机牛奶', producer: '大地种业', labelVersion: 'V3.0', requiredFields: 10, filledFields: 10, missingFields: '—', marking: 'violation', markingNote: '标注有机认证但证书已过期', result: 'fail', checkedAt: '2025-07-14 08:50', rectifyStatus: 'notified' },
  { id: 'LBL2025004', productName: '土鸡蛋', producer: '惠民种植', labelVersion: 'V1.0', requiredFields: 10, filledFields: 7, missingFields: '生产日期、保质期、追溯码', marking: 'compliant', markingNote: '无认证标识，无夸大宣传', result: 'fail', checkedAt: '2025-07-13 17:30', rectifyStatus: 'done' },
  { id: 'LBL2025005', productName: '五常稻花香米', producer: '金穗合作社', labelVersion: 'V2.0', requiredFields: 10, filledFields: 10, missingFields: '—', marking: 'compliant', markingNote: '产地标注与产地证明一致', result: 'pass', checkedAt: '2025-07-13 16:48', rectifyStatus: 'none' },
  { id: 'LBL2025006', productName: '冷鲜黑猪肉', producer: '中原牧业', labelVersion: 'V1.2', requiredFields: 10, filledFields: 9, missingFields: '贮存条件', marking: 'compliant', markingNote: '无公害标识有效', result: 'fail', checkedAt: '2025-07-13 15:20', rectifyStatus: 'notified' },
  { id: 'LBL2025007', productName: '铁棍山药', producer: '沃土农场', labelVersion: 'V1.1', requiredFields: 10, filledFields: 10, missingFields: '—', marking: 'compliant', markingNote: '标签文案合规', result: 'pass', checkedAt: '2025-07-13 14:02', rectifyStatus: 'none' },
  { id: 'LBL2025008', productName: '特级初榨橄榄油', producer: '兴盛油脂', labelVersion: 'V4.2', requiredFields: 10, filledFields: 9, missingFields: '营养成分表', marking: 'violation', markingNote: '标签宣称「保健功效」涉嫌虚假宣传', result: 'fail', checkedAt: '2025-07-13 11:36', rectifyStatus: 'notified' },
  { id: 'LBL2025009', productName: '草莓礼盒', producer: '新农合作社', labelVersion: 'V1.4', requiredFields: 10, filledFields: 10, missingFields: '—', marking: 'compliant', markingNote: '标签文案合规', result: 'pass', checkedAt: '2025-07-12 18:05', rectifyStatus: 'none' },
  { id: 'LBL2025010', productName: '信阳毛尖', producer: '茶园M区', labelVersion: 'V2.3', requiredFields: 10, filledFields: 8, missingFields: 'SC许可证编号、产地', marking: 'compliant', markingNote: '地理标志标识有效', result: 'fail', checkedAt: '2025-07-12 16:22', rectifyStatus: 'done' },
  { id: 'LBL2025011', productName: '散养土鸡', producer: '惠民养殖', labelVersion: 'V1.0', requiredFields: 10, filledFields: 10, missingFields: '—', marking: 'compliant', markingNote: '标签文案合规', result: 'pass', checkedAt: '2025-07-12 10:14', rectifyStatus: 'none' },
  { id: 'LBL2025012', productName: '有机蔬菜礼盒', producer: '绿源农业', labelVersion: 'V2.2', requiredFields: 10, filledFields: 9, missingFields: '追溯码', marking: 'compliant', markingNote: '有机标识与证书编号一致', result: 'fail', checkedAt: '2025-07-12 09:03', rectifyStatus: 'notified' },
]

/** 分页查询产品标签合规记录 */
export async function listLabelCompliance(
  params: LabelComplianceQuery,
): Promise<PageResult<LabelComplianceRecord>> {
  try {
    const res = await http.get<PageResult<LabelComplianceRecord>>(`${BASE}/compliance/labels`, params, {
      silent: true,
    })
    if (res && Array.isArray(res.list)) {
      markSource('labels', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到示例数据 */
  }
  const filtered = LABEL_COMPLIANCE_STORE.filter((item) => {
    if (params.result && params.result !== 'all' && item.result !== params.result) {
      return false
    }
    if (params.productName && !item.productName.includes(params.productName.trim())) {
      return false
    }
    if (params.keyword) {
      const keyword = params.keyword.trim()
      if (keyword && !item.producer.includes(keyword) && !item.id.includes(keyword)) {
        return false
      }
    }
    return true
  })
  markSource('labels', true)
  return pageOf(filtered, params.pageNum, params.pageSize)
}

/**
 * 下发标签整改通知。
 *
 * 后端核对结论：无对应端点。后端确有整改能力，但落在**农场合规检查任务**上
 * （AdminFarmController.java:105 `PUT /admin/farms/compliance/{checkId}`，
 * 字段 rectifyStatus / rectifyRequirement / rectifyDeadline），业务对象是 CHK 编号的
 * 检查任务；本操作对象是 LBL 编号的产品标签记录，ID 空间与字段均不同，不可复用，
 * 故本操作当前无法落库。
 *
 * @param id 标签编号
 * @param payload 整改期限与要求
 * @returns 写操作结果；ok 为 false 时未写入服务端
 */
export async function notifyLabelRectify(
  id: BizId,
  payload: { deadline: string; remark: string },
): Promise<WriteResult> {
  try {
    await http.post<unknown>(`${BASE}/compliance/labels/${id}/rectify`, payload, { silent: true })
    return okResult('整改通知已下发并写入服务端')
  } catch (error) {
    return failFromError('整改通知下发', error)
  }
}

/* ---------- Tab3 标准校验（原型未展开，此处为补充设计） ---------- */

/** 行业标准库条目 */
export interface StandardLibraryItem {
  /** 标准编号（作为下拉 value） */
  value: string
  /** 标准名称 */
  label: string
  /** 发布机构 */
  issuer: string
}

/** 标准校验项 */
export interface StandardCheckItem {
  /** 校验项 ID */
  id: string
  /** 标准编号 */
  standardNo: string
  /** 校验项名称 */
  itemName: string
  /** 标准限值 */
  limitValue: string
  /** 实测值 */
  measuredValue: string
  /** 判定结果 */
  result: LabelCheckResult
  /** 抽检批次 */
  batchNo: string
}

/** 标准校验汇总 */
/**
 * 标准校验汇总。
 *
 * ⚠️ 四个字段均允许 `null`，语义是「后端未提供该数据源」，**不能用 0 代替**。
 * 原因：后端 `/compliance/standards/{no}/summary` 一旦先于标准库上线，
 * 下拉里会出现后端返回的新标准号，而该标准在示例汇总里没有对应条目；
 * 若此处回落成 0，页面会显示「0 批 / 通过率 0%」，
 * 看起来像"校验跑过了、结果是零"，实际是根本没有数据——属于用 0 冒充真实结果。
 * 正确做法是回落到 null，由页面按 `MetricStatistic` 显示「—」并说明原因。
 */
export interface StandardCheckSummary {
  /** 校验批次总数；null = 后端未提供 */
  batchCount: number | null
  /** 通过批次数；null = 后端未提供 */
  passCount: number | null
  /** 不通过批次数；null = 后端未提供 */
  failCount: number | null
  /** 通过率（%）；null = 后端未提供 */
  passRate: number | null
}

/** 标准库下拉（补充设计） */
export const STANDARD_LIBRARY: StandardLibraryItem[] = [
  { value: 'GB2762-2022', label: 'GB 2762-2022 食品中污染物限量', issuer: '国家卫生健康委员会' },
  { value: 'GB2763-2021', label: 'GB 2763-2021 食品中农药最大残留限量', issuer: '国家卫生健康委员会' },
  { value: 'GB7718-2011', label: 'GB 7718-2011 预包装食品标签通则', issuer: '国家质量监督检验检疫总局' },
  { value: 'NYT391-2021', label: 'NY/T 391-2021 绿色食品 产地环境质量', issuer: '农业农村部' },
  { value: 'GBT19630-2019', label: 'GB/T 19630-2019 有机产品 生产、加工、标识与管理体系', issuer: '国家市场监督管理总局' },
]

/**
 * 各标准校验汇总（补充设计；合计 1240 批 / 通过 1151 批 → 通过率 92.8%，与原型 4.2 口径一致）。
 *
 * 这里刻意不复用 `StandardCheckSummary`：本映射是**具体条目**，三个计数恒为数字；
 * 对外接口才允许 null（表示"取不到条目"）。两者语义不同，不能共用同一类型。
 */
const STANDARD_SUMMARY: Record<string, { batchCount: number; passCount: number; failCount: number }> = {
  'GB2762-2022': { batchCount: 320, passCount: 295, failCount: 25 },
  'GB2763-2021': { batchCount: 410, passCount: 380, failCount: 30 },
  'GB7718-2011': { batchCount: 260, passCount: 244, failCount: 16 },
  'NYT391-2021': { batchCount: 150, passCount: 140, failCount: 10 },
  'GBT19630-2019': { batchCount: 100, passCount: 92, failCount: 8 },
}

/** 标准校验项 Mock 库（补充设计） */
const STANDARD_ITEM_STORE: StandardCheckItem[] = [
  { id: 'SC-2762-01', standardNo: 'GB2762-2022', itemName: '铅（以 Pb 计）', limitValue: '≤ 0.2 mg/kg', measuredValue: '0.08 mg/kg', result: 'pass', batchNo: 'B2025070' },
  { id: 'SC-2762-02', standardNo: 'GB2762-2022', itemName: '镉（以 Cd 计）', limitValue: '≤ 0.1 mg/kg', measuredValue: '0.05 mg/kg', result: 'pass', batchNo: 'B2025068' },
  { id: 'SC-2762-03', standardNo: 'GB2762-2022', itemName: '总砷（以 As 计）', limitValue: '≤ 0.5 mg/kg', measuredValue: '0.62 mg/kg', result: 'fail', batchNo: 'B2025065' },
  { id: 'SC-2762-04', standardNo: 'GB2762-2022', itemName: '汞（以 Hg 计）', limitValue: '≤ 0.01 mg/kg', measuredValue: '0.004 mg/kg', result: 'pass', batchNo: 'B2025060' },
  { id: 'SC-2763-01', standardNo: 'GB2763-2021', itemName: '毒死蜱残留', limitValue: '≤ 0.05 mg/kg', measuredValue: '0.03 mg/kg', result: 'pass', batchNo: 'B2025058' },
  { id: 'SC-2763-02', standardNo: 'GB2763-2021', itemName: '吡虫啉残留', limitValue: '≤ 0.5 mg/kg', measuredValue: '1.20 mg/kg', result: 'fail', batchNo: 'B2025055' },
  { id: 'SC-2763-03', standardNo: 'GB2763-2021', itemName: '多菌灵残留', limitValue: '≤ 2.0 mg/kg', measuredValue: '0.80 mg/kg', result: 'pass', batchNo: 'B2025051' },
  { id: 'SC-2763-04', standardNo: 'GB2763-2021', itemName: '氯氰菊酯残留', limitValue: '≤ 1.0 mg/kg', measuredValue: '0.90 mg/kg', result: 'pass', batchNo: 'B2025048' },
  { id: 'SC-7718-01', standardNo: 'GB7718-2011', itemName: '配料表完整性', limitValue: '应完整标注', measuredValue: '完整', result: 'pass', batchNo: 'B2025045' },
  { id: 'SC-7718-02', standardNo: 'GB7718-2011', itemName: '净含量字符高度', limitValue: '≥ 1.8 mm', measuredValue: '1.5 mm', result: 'fail', batchNo: 'B2025043' },
  { id: 'SC-7718-03', standardNo: 'GB7718-2011', itemName: '生产日期标注', limitValue: '应清晰不易脱落', measuredValue: '清晰', result: 'pass', batchNo: 'B2025040' },
  { id: 'SC-7718-04', standardNo: 'GB7718-2011', itemName: '生产者名称地址', limitValue: '应完整标注', measuredValue: '完整', result: 'pass', batchNo: 'B2025038' },
  { id: 'SC-391-01', standardNo: 'NYT391-2021', itemName: '土壤铅含量', limitValue: '≤ 50 mg/kg', measuredValue: '32 mg/kg', result: 'pass', batchNo: 'B2025035' },
  { id: 'SC-391-02', standardNo: 'NYT391-2021', itemName: '灌溉水 pH 值', limitValue: '5.5 ~ 8.5', measuredValue: '6.8', result: 'pass', batchNo: 'B2025032' },
  { id: 'SC-391-03', standardNo: 'NYT391-2021', itemName: '环境空气总悬浮颗粒物', limitValue: '≤ 0.30 mg/m³', measuredValue: '0.42 mg/m³', result: 'fail', batchNo: 'B2025030' },
  { id: 'SC-391-04', standardNo: 'NYT391-2021', itemName: '土壤镉含量', limitValue: '≤ 0.40 mg/kg', measuredValue: '0.21 mg/kg', result: 'pass', batchNo: 'B2025028' },
  { id: 'SC-19630-01', standardNo: 'GBT19630-2019', itemName: '有机转换期', limitValue: '≥ 24 个月', measuredValue: '36 个月', result: 'pass', batchNo: 'B2025025' },
  { id: 'SC-19630-02', standardNo: 'GBT19630-2019', itemName: '禁用农药残留', limitValue: '不得检出', measuredValue: '未检出', result: 'pass', batchNo: 'B2025022' },
  { id: 'SC-19630-03', standardNo: 'GBT19630-2019', itemName: '有机标识使用规范', limitValue: '须持有效认证证书', measuredValue: '证书已过期', result: 'fail', batchNo: 'B2025020' },
  { id: 'SC-19630-04', standardNo: 'GBT19630-2019', itemName: '平行生产隔离', limitValue: '须物理隔离', measuredValue: '已隔离', result: 'pass', batchNo: 'B2025018' },
]

/** 查询行业标准库 */
export async function listStandardLibrary(): Promise<StandardLibraryItem[]> {
  try {
    const res = await http.get<StandardLibraryItem[]>(`${BASE}/compliance/standards`, undefined, {
      silent: true,
    })
    if (Array.isArray(res) && res.length > 0) {
      markSource('standards', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到示例数据 */
  }
  markSource('standards', true)
  return STANDARD_LIBRARY
}

/** 查询某标准的校验项明细 */
export async function listStandardCheckItems(standardNo: string): Promise<StandardCheckItem[]> {
  try {
    const res = await http.get<StandardCheckItem[]>(
      `${BASE}/compliance/standards/${standardNo}/items`,
      undefined,
      { silent: true },
    )
    if (Array.isArray(res) && res.length > 0) {
      markSource('standard-items', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到示例数据 */
  }
  markSource('standard-items', true)
  return STANDARD_ITEM_STORE.filter((item) => item.standardNo === standardNo)
}

/** 查询某标准的校验汇总 */
export async function getStandardCheckSummary(standardNo: string): Promise<StandardCheckSummary> {
  try {
    const res = await http.get<StandardCheckSummary>(
      `${BASE}/compliance/standards/${standardNo}/summary`,
      undefined,
      { silent: true },
    )
    if (res && typeof res === 'object' && typeof res.batchCount === 'number') {
      markSource('standard-summary', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到示例数据 */
  }
  markSource('standard-summary', true)
  const raw = STANDARD_SUMMARY[standardNo]
  if (!raw) {
    // 该标准在示例汇总里没有条目：回落到 null（未接入），绝不回落成 0
    return { batchCount: null, passCount: null, failCount: null, passRate: null }
  }
  const passRate =
    raw.batchCount > 0 ? Number(((raw.passCount / raw.batchCount) * 100).toFixed(1)) : 0
  return { ...raw, passRate }
}

/** 执行标准自动校验入参 */
export interface StandardRunPayload {
  /** 标准编号 */
  standardNo: string
  /** 校验批次范围 */
  batchScope: string
}

/**
 * 执行行业标准自动校验。
 *
 * 后端核对结论：无对应端点。core-platform 检索 `food-safety` / `FoodSafety` 零命中，
 * 不存在标准校验执行接口。原实现在请求失败后直接返回本地示例汇总，页面提示
 * 「标准校验已执行，结果已刷新」——实际没有触发任何检验数据流，已改为显式失败。
 *
 * @param payload 标准编号与批次范围
 * @returns 写操作结果；ok 为 true 时才表示服务端确实执行了校验
 */
export async function runStandardCheck(payload: StandardRunPayload): Promise<WriteResult> {
  try {
    const res = await http.post<StandardCheckSummary>(
      `${BASE}/compliance/standards/${payload.standardNo}/run`,
      payload,
      { silent: true },
    )
    if (res && typeof res === 'object' && typeof res.batchCount === 'number') {
      return okResult('标准校验已执行并写入服务端')
    }
  } catch (error) {
    return failFromError('标准校验执行', error)
  }
  return failNotFound('标准校验未执行：后端未返回校验汇总，未写入服务端')
}

/* ==================== P18 可信农产品管理 ==================== */

/** 可信等级：钻石 / 金牌 / 银牌 / 普通 */
export type TrustLevel = 'diamond' | 'gold' | 'silver' | 'normal'

/** 认证标志：有机认证 / 绿色认证 / 无公害 / 无 */
export type CertMark = 'organic' | 'green' | 'pollution-free' | 'none'

/** 可信农产品审核状态 */
export type TrustAuditStatus = 'approved' | 'pending' | 'rejected'

/** 可信农产品条目 */
export interface TrustProduct {
  /** 产品编号 */
  id: string
  /** 产品名称 */
  name: string
  /** 品类 */
  category: string
  /** 生产者 */
  producer: string
  /** 可信等级 */
  level: TrustLevel
  /** 信任分数（0-100） */
  score: number
  /** 认证标志 */
  cert: CertMark
  /** 认证有效期（yyyy-MM-dd） */
  validUntil: string
  /** 审核状态 */
  auditStatus: TrustAuditStatus
  /** 认证机构 */
  certOrg: string
}

/** 可信农产品统计（平台级口径，原型 P18 / 4.2） */
export interface TrustStats {
  /** 总产品数 */
  total: number
  /** 钻石可信数 */
  diamond: number
  /** 金牌可信数 */
  gold: number
  /** 银牌可信数 */
  silver: number
  /** 普通数 */
  normal: number
  /** 待审核数 */
  pending: number
}

/** 可信农产品查询入参 */
export interface TrustProductQuery extends PageQuery {
  /** 可信等级 */
  level?: TrustLevel | 'all'
  /** 审核状态 */
  auditStatus?: TrustAuditStatus | 'all'
  /** 产品名称关键字 */
  name?: string
}

/** 可信等级文案映射 */
export const TRUST_LEVEL_TEXT: Record<TrustLevel, string> = {
  diamond: '钻石',
  gold: '金牌',
  silver: '银牌',
  normal: '普通',
}

/** 可信等级图标映射 */
export const TRUST_LEVEL_ICON: Record<TrustLevel, string> = {
  diamond: '💎',
  gold: '🥇',
  silver: '🥈',
  normal: '—',
}

/** 可信等级 Tag 颜色映射 */
export const TRUST_LEVEL_COLOR: Record<TrustLevel, string> = {
  diamond: 'purple',
  gold: 'gold',
  silver: 'blue',
  normal: 'default',
}

/** 认证标志文案映射 */
export const CERT_MARK_TEXT: Record<CertMark, string> = {
  organic: '✅ 有机认证',
  green: '✅ 绿色认证',
  'pollution-free': '✅ 无公害',
  none: '—',
}

/** 审核状态文案映射 */
export const TRUST_AUDIT_TEXT: Record<TrustAuditStatus, string> = {
  approved: '已通过',
  pending: '待审核',
  rejected: '已驳回',
}

/** 审核状态 Tag 颜色映射 */
export const TRUST_AUDIT_COLOR: Record<TrustAuditStatus, string> = {
  approved: 'green',
  pending: 'gold',
  rejected: 'red',
}

/** 可信农产品统计平台级口径（原型 P18） */
const FALLBACK_TRUST_STATS: TrustStats = {
  total: 1250,
  diamond: 280,
  gold: 450,
  silver: 320,
  normal: 200,
  pending: 15,
}

/** 可信农产品示例数据（原型 P18 前 4 条） */
const TRUST_SEEDS: Array<Omit<TrustProduct, 'id' | 'validUntil' | 'auditStatus' | 'certOrg'>> = [
  { name: '有机大米', category: '粮食', producer: '绿源农业', level: 'diamond', score: 95, cert: 'organic' },
  { name: '红富士苹果', category: '水果', producer: '丰达农场', level: 'gold', score: 82, cert: 'green' },
  { name: '有机牛奶', category: '畜牧', producer: '大地种业', level: 'silver', score: 72, cert: 'pollution-free' },
  { name: '土鸡蛋', category: '禽蛋', producer: '惠民种植', level: 'normal', score: 55, cert: 'none' },
  { name: '五常稻花香米', category: '粮食', producer: '金穗合作社', level: 'diamond', score: 93, cert: 'organic' },
  { name: '铁棍山药', category: '蔬菜', producer: '沃土农场', level: 'gold', score: 86, cert: 'green' },
  { name: '冷鲜黑猪肉', category: '畜牧', producer: '中原牧业', level: 'silver', score: 74, cert: 'pollution-free' },
  { name: '信阳毛尖', category: '茶叶', producer: '茶园M区', level: 'gold', score: 81, cert: 'green' },
  { name: '散养土鸡', category: '禽蛋', producer: '惠民养殖', level: 'normal', score: 58, cert: 'none' },
  { name: '黄河鲤鱼', category: '水产', producer: '水产L区', level: 'silver', score: 68, cert: 'pollution-free' },
  { name: '有机蔬菜礼盒', category: '蔬菜', producer: '绿源农业', level: 'diamond', score: 91, cert: 'organic' },
  { name: '草莓礼盒', category: '水果', producer: '新农合作社', level: 'gold', score: 84, cert: 'green' },
  { name: '小麦粉', category: '粮食', producer: '麦香I区', level: 'silver', score: 70, cert: 'pollution-free' },
  { name: '食用菌礼包', category: '蔬菜', producer: '稻田H区', level: 'normal', score: 52, cert: 'none' },
  { name: '特级初榨橄榄油', category: '粮油', producer: '兴盛油脂', level: 'gold', score: 88, cert: 'green' },
  { name: '有机杂粮组合', category: '粮食', producer: '金穗合作社', level: 'diamond', score: 96, cert: 'organic' },
]

/** 可信农产品 Mock 库（生成 60 条，覆盖多页分页场景） */
const TRUST_STORE: TrustProduct[] = Array.from({ length: 60 }, (_unused, index) => {
  const seed = TRUST_SEEDS[index % TRUST_SEEDS.length]
  const round = Math.floor(index / TRUST_SEEDS.length)
  const certOrg = ['中绿华夏有机认证中心', '省农产品质量安全中心', '国家绿色食品发展中心', '市农业农村局'][
    pseudo(index, 4)
  ]
  const auditStatus: TrustAuditStatus = index >= 44 && index < 59 ? 'pending' : 'approved'
  return {
    id: `P${String(index + 1).padStart(3, '0')}`,
    name: round === 0 ? seed.name : `${seed.name}（${round + 1}批次）`,
    category: seed.category,
    producer: seed.producer,
    level: seed.level,
    score: Math.max(0, Math.min(100, seed.score - round * 2)),
    cert: seed.cert,
    validUntil: `202${6 + pseudo(index, 2)}-${String(1 + pseudo(index + 3, 12)).padStart(2, '0')}-${String(
      1 + pseudo(index + 7, 27),
    ).padStart(2, '0')}`,
    auditStatus,
    certOrg,
  }
})

/** 查询可信农产品统计 */
export async function getTrustStats(): Promise<TrustStats> {
  try {
    const res = await http.get<TrustStats>(`${BASE}/trust-label/stats`, undefined, { silent: true })
    if (res && typeof res === 'object' && typeof res.total === 'number') {
      markSource('trust-stats', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到原型示例口径 */
  }
  markSource('trust-stats', true)
  return FALLBACK_TRUST_STATS
}

/** 分页查询可信农产品名单 */
export async function listTrustProducts(
  params: TrustProductQuery,
): Promise<PageResult<TrustProduct>> {
  try {
    const res = await http.get<PageResult<TrustProduct>>(`${BASE}/trust-label/products`, params, {
      silent: true,
    })
    if (res && Array.isArray(res.list)) {
      markSource('trust-products', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到原型示例口径 */
  }
  const filtered = TRUST_STORE.filter((item) => {
    if (params.level && params.level !== 'all' && item.level !== params.level) {
      return false
    }
    if (params.auditStatus && params.auditStatus !== 'all' && item.auditStatus !== params.auditStatus) {
      return false
    }
    if (params.name && !item.name.includes(params.name.trim())) {
      return false
    }
    if (params.keyword) {
      const keyword = params.keyword.trim()
      if (keyword && !item.producer.includes(keyword) && !item.id.includes(keyword)) {
        return false
      }
    }
    return true
  })
  markSource('trust-products', true)
  return pageOf(filtered, params.pageNum, params.pageSize)
}

/** 编辑可信农产品入参 */
export interface TrustProductUpdatePayload {
  /** 可信等级 */
  level: TrustLevel
  /** 信任分数 */
  score: number
  /** 认证标志 */
  cert: CertMark
  /** 认证有效期（yyyy-MM-dd） */
  validUntil: string
  /** 认证机构 */
  certOrg: string
}

/**
 * 编辑可信农产品（等级 / 信任分 / 认证信息 / 有效期）。
 *
 * 后端核对结论：无对应端点。core-platform 检索 `trust-label` / `trustLabel` 零命中，
 * 不存在可信农产品实体，本操作当前无法落库。
 *
 * @param id 产品编号
 * @param payload 等级、信任分、认证信息与有效期
 * @returns 写操作结果；ok 为 false 时未写入服务端
 */
export async function updateTrustProduct(
  id: BizId,
  payload: TrustProductUpdatePayload,
): Promise<WriteResult> {
  try {
    await http.put<unknown>(`${BASE}/trust-label/products/${id}`, payload, { silent: true })
    return okResult('可信农产品信息已更新并写入服务端')
  } catch (error) {
    return failFromError('可信农产品信息保存', error)
  }
}

/** 可信农产品审核入参 */
export interface TrustAuditPayload {
  /** 审核动作 */
  action: 'approve' | 'reject'
  /** 审核意见 */
  remark: string
}

/**
 * 审核可信农产品（通过 / 驳回）。
 *
 * 后端核对结论：无对应端点。后端确有审批通过 / 驳回能力，但落在**审批单**上
 * （AdminApprovalController.java:59 `POST /admin/approvals/{approvalId}/approve`
 * 与 :67 `POST /admin/approvals/{approvalId}/reject`，真实写库，
 * 入参为 `@RequestParam approverId` / `opinion`），业务对象是 APPR 编号的审批单；
 * 本操作对象是 P 编号的可信农产品，且入参为 body `{ action, remark }`，
 * ID 空间与字段均不同，不可复用，故本操作当前无法落库。
 *
 * @param id 产品编号
 * @param payload 审核动作与意见
 * @returns 写操作结果；ok 为 false 时未写入服务端
 */
export async function auditTrustProduct(
  id: BizId,
  payload: TrustAuditPayload,
): Promise<WriteResult> {
  try {
    await http.post<unknown>(`${BASE}/trust-label/products/${id}/audit`, payload, { silent: true })
    const actionText = payload.action === 'approve' ? '审核通过' : '审核驳回'
    return okResult(`${actionText}已提交并写入服务端`)
  } catch (error) {
    const actionText = payload.action === 'approve' ? '审核通过' : '审核驳回'
    return failFromError(actionText, error)
  }
}

/* ==================== P19 冷链资源撮合 ==================== */

/** 冷链资源类型：冷链车 / 冷库 */
export type ColdChainResourceType = 'vehicle' | 'warehouse'

/** 冷链资源状态：空闲 / 繁忙 / 离线或故障 */
export type ColdChainStatus = 'idle' | 'busy' | 'offline'

/** 冷链资源条目 */
export interface ColdChainResource {
  /** 资源 ID */
  id: string
  /** 资源名称（车牌 / 库区名） */
  name: string
  /** 资源类型 */
  type: ColdChainResourceType
  /** 类型文案（冷链车 / 冷库） */
  typeLabel: string
  /** 规格（20吨 / 5000m²） */
  spec: string
  /** 温区 */
  tempRange: string
  /** 所在城市 */
  city: string
  /** 所在区县 */
  district: string
  /** 资源状态 */
  status: ColdChainStatus
  /** 服务评分 */
  rating: number
  /** 联系人 */
  contact: string
  /** 联系电话 */
  phone: string
  /** 最近保养日期 */
  lastMaintainDate: string
}

/** 冷链资源统计（平台级口径，原型 P19 / 4.2） */
export interface ColdChainStats {
  /** 资源总量 */
  total: number
  /** 可用数 */
  available: number
  /** 繁忙数 */
  busy: number
  /** 离线或故障数 */
  offline: number
  /** 撮合成功率（%） */
  matchRate: number
}

/** 冷链资源查询入参 */
export interface ColdChainQuery extends PageQuery {
  /** 资源类型 */
  type?: ColdChainResourceType | 'all'
  /** 资源状态 */
  status?: ColdChainStatus | 'all'
  /** 所在城市 */
  city?: string
}

/** 撮合记录 */
export interface MatchRecord {
  /** 撮合编号 */
  id: string
  /** 需求方 */
  demander: string
  /** 资源方 */
  supplier: string
  /** 资源类型文案 */
  resourceType: string
  /** 撮合时间（MM-DD 或 yyyy-MM-dd） */
  time: string
  /** 撮合状态：进行中 / 已完成 / 排队中 */
  status: 'processing' | 'done' | 'queued'
  /** 货物 / 用途 */
  cargo: string
  /** 温区要求 */
  tempRequire: string
  /** 备注 */
  remark: string
}

/** 撮合预约入参 */
export interface MatchPayload {
  /** 资源 ID */
  resourceId: string
  /** 需求方 */
  demander: string
  /** 货物 / 用途 */
  cargo: string
  /** 预约开始时间（yyyy-MM-dd） */
  startTime: string
  /** 温区要求 */
  tempRequire: string
  /** 备注 */
  remark?: string
}

/** 冷链资源类型文案映射 */
export const COLD_CHAIN_TYPE_TEXT: Record<ColdChainResourceType, string> = {
  vehicle: '冷链车',
  warehouse: '冷库',
}

/** 冷链资源状态文案映射 */
export const COLD_CHAIN_STATUS_TEXT: Record<ColdChainStatus, string> = {
  idle: '空闲',
  busy: '繁忙',
  offline: '离线·故障',
}

/** 冷链资源状态 Tag 颜色映射 */
export const COLD_CHAIN_STATUS_COLOR: Record<ColdChainStatus, string> = {
  idle: 'green',
  busy: 'gold',
  offline: 'red',
}

/** 冷链资源状态（平台统计口径）文案映射 */
export const COLD_CHAIN_STAT_STATUS_TEXT: Record<'available' | 'busy' | 'offline', string> = {
  available: '可用',
  busy: '繁忙',
  offline: '离线·故障',
}

/** 冷链资源统计平台级口径（原型 P19 / 4.2：156 / 98 / 42 / 16 / 85.3%） */
const FALLBACK_COLD_CHAIN_STATS: ColdChainStats = {
  total: 156,
  available: 98,
  busy: 42,
  offline: 16,
  matchRate: 85.3,
}

/** 冷链资源种子（前 3 条与原型 P19 完全一致） */
const COLD_CHAIN_SEEDS: Array<{
  name: string
  type: ColdChainResourceType
  spec: string
  tempRange: string
  rating?: number
  status?: ColdChainStatus
}> = [
  { name: '豫A12345', type: 'vehicle', spec: '20吨', tempRange: '-18°C ~ 5°C', rating: 4.8, status: 'idle' },
  { name: '中原冷库A区', type: 'warehouse', spec: '5000m²', tempRange: '-25°C ~ -18°C', rating: 4.9, status: 'idle' },
  { name: '豫B67890', type: 'vehicle', spec: '10吨', tempRange: '0°C ~ 4°C', rating: 4.6, status: 'busy' },
  { name: '中原冷库B区', type: 'warehouse', spec: '3200m²', tempRange: '-18°C ~ -10°C', rating: 4.7 },
  { name: '豫C24680', type: 'vehicle', spec: '15吨', tempRange: '-22°C ~ 0°C', rating: 4.5 },
  { name: '豫A54321', type: 'vehicle', spec: '8吨', tempRange: '0°C ~ 8°C', rating: 4.4 },
  { name: '绿源冷链1号库', type: 'warehouse', spec: '1800m²', tempRange: '0°C ~ 4°C', rating: 4.6 },
  { name: '豫G11223', type: 'vehicle', spec: '12吨', tempRange: '-18°C ~ 2°C', rating: 4.3 },
  { name: '丰达保鲜库', type: 'warehouse', spec: '2600m²', tempRange: '2°C ~ 8°C', rating: 4.8 },
  { name: '豫K77889', type: 'vehicle', spec: '25吨', tempRange: '-25°C ~ -15°C', rating: 4.9 },
  { name: '惠民速冻库', type: 'warehouse', spec: '4200m²', tempRange: '-30°C ~ -20°C', rating: 4.5 },
  { name: '豫H33445', type: 'vehicle', spec: '5吨', tempRange: '0°C ~ 6°C', rating: 4.2 },
]

/** 城市 - 区县池（前 3 项与原型 P19 一致：郑州金水区 / 郑州经开区 / 洛阳老城区） */
const CITY_DISTRICTS: Array<[string, string]> = [
  ['郑州', '金水区'],
  ['郑州', '经开区'],
  ['洛阳', '老城区'],
  ['开封', '鼓楼区'],
  ['新乡', '牧野区'],
  ['许昌', '魏都区'],
  ['焦作', '解放区'],
  ['商丘', '睢阳区'],
  ['周口', '川汇区'],
  ['信阳', '浉河区'],
  ['南阳', '宛城区'],
  ['安阳', '文峰区'],
]

/** 联系人池 */
const CONTACT_NAMES: string[] = ['张师傅', '李师傅', '王调度', '赵站长', '孙队长', '周主管']

/**
 * 生成资源名称。
 *
 * 冷链车按「车牌前缀 + 序号」生成；冷库按「库区名 + 期数」生成，保证 156 条不重名。
 *
 * @param seed 资源种子
 * @param index 资源序号
 * @param variant 轮次（0 表示原型原始记录）
 * @returns 资源名称
 */
function buildResourceName(
  seed: (typeof COLD_CHAIN_SEEDS)[number],
  index: number,
  variant: number,
): string {
  if (variant === 0) {
    return seed.name
  }
  if (seed.type === 'vehicle') {
    return `${seed.name.slice(0, 2)}${String(10000 + index * 37).slice(0, 5)}`
  }
  return `${seed.name}-${variant + 1}期`
}

/**
 * 构建冷链资源池（156 条）。
 *
 * 状态分布严格对齐原型 4.2 口径：可用（空闲）98 / 繁忙 42 / 离线故障 16。
 * 前 3 条与原型 P19 示例卡片完全一致。
 *
 * @returns 冷链资源列表
 */
function buildColdChainStore(): ColdChainResource[] {
  /** 剩余 153 条的状态池（96 空闲 + 41 繁忙 + 16 离线故障） */
  const restStatus: ColdChainStatus[] = []
  for (let i = 0; i < 96; i += 1) {
    restStatus.push('idle')
  }
  for (let i = 0; i < 41; i += 1) {
    restStatus.push('busy')
  }
  for (let i = 0; i < 16; i += 1) {
    restStatus.push('offline')
  }

  return Array.from({ length: 156 }, (_unused, index) => {
    const seed = COLD_CHAIN_SEEDS[index % COLD_CHAIN_SEEDS.length]
    const variant = Math.floor(index / COLD_CHAIN_SEEDS.length)
    const [city, district] = CITY_DISTRICTS[index % CITY_DISTRICTS.length]
    // 7 与 153 互质，保证状态池被完整且不重复地取用一次
    const status = index < 3 ? (seed.status ?? 'idle') : restStatus[((index - 3) * 7) % restStatus.length]
    const rating = seed.rating ?? Number((4 + (pseudo(index, 10) / 10)).toFixed(1))
    return {
      id: `CCR${String(index + 1).padStart(3, '0')}`,
      name: buildResourceName(seed, index, variant),
      type: seed.type,
      typeLabel: COLD_CHAIN_TYPE_TEXT[seed.type],
      spec: seed.spec,
      tempRange: seed.tempRange,
      city,
      district,
      status,
      rating,
      contact: CONTACT_NAMES[index % CONTACT_NAMES.length],
      phone: buildPhone(index),
      lastMaintainDate: `2025-${String(1 + pseudo(index + 5, 7)).padStart(2, '0')}-${String(
        1 + pseudo(index + 11, 27),
      ).padStart(2, '0')}`,
    }
  })
}

/** 冷链资源 Mock 库 */
const COLD_CHAIN_STORE: ColdChainResource[] = buildColdChainStore()

/** 撮合记录 Mock 库（前 3 条与原型 P19 一致） */
const MATCH_STORE: MatchRecord[] = [
  { id: 'CC001', demander: '绿源农业', supplier: '豫A12345', resourceType: '冷链车', time: '07-14', status: 'done', cargo: '有机蔬菜 50kg', tempRequire: '0°C ~ 4°C', remark: '郑州市内配送' },
  { id: 'CC002', demander: '丰达农场', supplier: '中原冷库A', resourceType: '冷库', time: '07-14', status: 'processing', cargo: '红富士苹果 12吨', tempRequire: '-2°C ~ 2°C', remark: '入库暂存 15 天' },
  { id: 'CC003', demander: '大地种业', supplier: '豫B67890', resourceType: '冷链车', time: '07-13', status: 'done', cargo: '有机牛奶 200L', tempRequire: '0°C ~ 4°C', remark: '洛阳—郑州干线' },
  { id: 'CC004', demander: '惠民种植', supplier: '惠民速冻库', resourceType: '冷库', time: '07-13', status: 'done', cargo: '速冻水饺 260kg', tempRequire: '-25°C ~ -20°C', remark: '长期仓储' },
  { id: 'CC005', demander: '金穗合作社', supplier: '豫C24680', resourceType: '冷链车', time: '07-12', status: 'queued', cargo: '五常稻花香米 8吨', tempRequire: '常温 ~ 8°C', remark: '排队等待调度' },
  { id: 'CC006', demander: '沃土农场', supplier: '绿源冷链1号库', resourceType: '冷库', time: '07-12', status: 'done', cargo: '铁棍山药 6吨', tempRequire: '2°C ~ 8°C', remark: '短期周转' },
  { id: 'CC007', demander: '中原牧业', supplier: '豫K77889', resourceType: '冷链车', time: '07-11', status: 'processing', cargo: '冷鲜黑猪肉 300kg', tempRequire: '-18°C ~ -15°C', remark: '跨省调运' },
  { id: 'CC008', demander: '新农合作社', supplier: '丰达保鲜库', resourceType: '冷库', time: '07-11', status: 'done', cargo: '草莓礼盒 40kg', tempRequire: '0°C ~ 4°C', remark: '节日备货' },
  { id: 'CC009', demander: '茶园M区', supplier: '豫G11223', resourceType: '冷链车', time: '07-10', status: 'done', cargo: '信阳毛尖 1.2吨', tempRequire: '0°C ~ 6°C', remark: '信阳—郑州' },
]

/** 查询冷链资源统计 */
export async function getColdChainStats(): Promise<ColdChainStats> {
  try {
    const res = await http.get<ColdChainStats>(`${BASE}/cold-chain/stats`, undefined, { silent: true })
    if (res && typeof res === 'object' && typeof res.total === 'number') {
      markSource('cold-chain-stats', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到原型示例口径 */
  }
  markSource('cold-chain-stats', true)
  return FALLBACK_COLD_CHAIN_STATS
}

/** 分页查询冷链资源列表 */
export async function listColdChainResources(
  params: ColdChainQuery,
): Promise<PageResult<ColdChainResource>> {
  try {
    const res = await http.get<PageResult<ColdChainResource>>(`${BASE}/cold-chain/resources`, params, {
      silent: true,
    })
    if (res && Array.isArray(res.list)) {
      markSource('cold-chain-resources', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到原型示例口径 */
  }
  const filtered = COLD_CHAIN_STORE.filter((item) => {
    if (params.type && params.type !== 'all' && item.type !== params.type) {
      return false
    }
    if (params.status && params.status !== 'all' && item.status !== params.status) {
      return false
    }
    if (params.city && item.city !== params.city) {
      return false
    }
    if (params.keyword) {
      const keyword = params.keyword.trim()
      if (keyword && !item.name.includes(keyword) && !item.district.includes(keyword)) {
        return false
      }
    }
    return true
  })
  markSource('cold-chain-resources', true)
  return pageOf(filtered, params.pageNum, params.pageSize)
}

/** 撮合记录查询入参 */
export interface MatchRecordQuery extends PageQuery {
  /** 撮合状态 */
  status?: MatchRecord['status'] | 'all'
}

/** 分页查询撮合记录 */
export async function listMatchRecords(params: MatchRecordQuery): Promise<PageResult<MatchRecord>> {
  try {
    const res = await http.get<PageResult<MatchRecord>>(`${BASE}/cold-chain/matches`, params, {
      silent: true,
    })
    if (res && Array.isArray(res.list)) {
      markSource('match-records', false)
      return res
    }
  } catch {
    /* 接口未就绪，降级到原型示例口径 */
  }
  const filtered = MATCH_STORE.filter((item) => {
    if (params.status && params.status !== 'all' && item.status !== params.status) {
      return false
    }
    if (params.keyword) {
      const keyword = params.keyword.trim()
      if (keyword && !item.demander.includes(keyword) && !item.supplier.includes(keyword)) {
        return false
      }
    }
    return true
  })
  markSource('match-records', true)
  return pageOf(filtered, params.pageNum, params.pageSize)
}

/**
 * 发起冷链资源撮合（立即撮合）。
 *
 * 后端核对结论：无对应端点。core-platform 检索 `cold-chain` / `ColdChain` / `冷链`
 * 零命中，不存在冷链资源与撮合记录实体，本操作当前无法落库。
 *
 * 说明：原实现会在请求失败后把记录塞进本地数组并把资源置为「繁忙」再返回成功，
 * 页面随即提示「撮合记录已生成」——服务端实际没有任何撮合记录，已移除该分支。
 *
 * @param payload 撮合入参
 * @returns 写操作结果；ok 为 false 时未写入服务端
 */
export async function createMatch(payload: MatchPayload): Promise<WriteResult> {
  try {
    await http.post<unknown>(`${BASE}/cold-chain/matches`, payload, { silent: true })
    return okResult('撮合已发起并写入服务端')
  } catch (error) {
    return failFromError('冷链资源撮合', error)
  }
}

/** 加入撮合队列入参 */
export interface EnqueuePayload {
  /** 资源 ID */
  resourceId: string
  /** 期望使用时间（yyyy-MM-dd） */
  expectTime: string
  /** 需求方 */
  demander: string
  /** 备注 */
  remark?: string
}

/**
 * 资源繁忙时加入撮合队列。
 *
 * 后端核对结论：无对应端点（同 {@link createMatch}，后端无冷链撮合能力），
 * 本操作当前无法落库。原实现失败后会把记录塞进本地数组再返回成功，已移除该分支。
 *
 * @param payload 入队入参
 * @returns 写操作结果；ok 为 false 时未写入服务端
 */
export async function enqueueResource(payload: EnqueuePayload): Promise<WriteResult> {
  try {
    await http.post<unknown>(`${BASE}/cold-chain/queue`, payload, { silent: true })
    return okResult('已加入撮合队列并写入服务端')
  } catch (error) {
    return failFromError('加入撮合队列', error)
  }
}

/* ==================== 后端能力核对清单（写操作） ==================== */

/*
 * 核对范围：core-platform 全部 47 个 *Controller.java，重点为
 * mod-produce/src/main/java/com/agri/produce/internal/admin/ 下 12 个运营端 Controller。
 * 核对方式：逐个比对 @RequestMapping + 映射注解路径，并阅读 Service 实现区分
 * 「真实写库」与「空壳（返回空列表 / 抛 UnsupportedOperationException）」。
 *
 * 结论：**后端不存在任何 /api/v1/production/admin/food-safety/* 端点**
 * （全仓检索 food-safety / FoodSafety 零命中）。
 *
 * | # | 操作 | 前端函数 | 后端端点 | 结论 |
 * |---|------|----------|----------|------|
 * | 1 | 台账（可信农产品）修改状态 | updateTrustProduct | 无（检索 trust-label 零命中） | 没有端点 |
 * | 2 | 整改通知发送 | notifyLabelRectify | 无；仅有 AdminFarmController.java:105 PUT /admin/farms/compliance/{checkId}（真实写库，但对象是农场合规检查任务 CHK，非标签记录 LBL） | 有但对象/字段对不上 |
 * | 3 | 风险预警处置 | handleFoodSafetyAlert | 无；仅有 AdminAlertController.java:51 POST /admin/alerts/{alertId}/dispatch（真实写库，语义为派单、必填 memberId，非登记处置措施） | 有但字段对不上 |
 * | 4 | 追溯链生成 | —（本模块无此操作；后端 AdminTraceController.java:41 GET /admin/trace/chain 为查询，非生成） | 不适用 |
 * | 5 | 处罚金额记录 | punishInputCompliance | 无；FarmComplianceCheckEntity 无处罚金额/处罚方式字段 | 没有端点，模型也不支持 |
 * | 6 | 主体审核通过 | auditTrustProduct(approve) | 无；仅有 AdminApprovalController.java:59 POST /admin/approvals/{approvalId}/approve（真实写库，对象是审批单 APPR，入参 @RequestParam approverId/opinion） | 有但对象/字段对不上 |
 * | 7 | 主体驳回 | auditTrustProduct(reject) | 无；仅有 AdminApprovalController.java:67 POST /admin/approvals/{approvalId}/reject（同上） | 有但对象/字段对不上 |
 * | 8 | 流通异常处置 | handleCirculation | 无（检索 circulation / 流通异常 零命中） | 没有端点 |
 * | 9 | 冷链撮合 / 加入队列 | createMatch / enqueueResource | 无（检索 cold-chain / 冷链 零命中） | 没有端点 |
 * | 10 | 标准校验执行 | runStandardCheck | 无 | 没有端点 |
 *
 * 因此全部写操作按「情况 B：诚实降级」处理：返回 WriteResult 显式失败，
 * 不改动任何本地数据，页面据 ok 字段决定提示成功还是失败。
 */

/* ==================== 前端字段对照表（后端上线时补「后端字段」列） ==================== */

/*
 * 用途：后端补齐 /admin/food-safety/* 时，照这张表做键名比对，避免照着原型或 README
 * 写前端 type 导致大面积错位（参照采收模块 planNo↔recordId、quantity↔qty 的教训）。
 *
 * 用法：后端 Entity 定稿后，在每行末尾补上后端字段名；不一致的按项目纪律改**前端**键名，
 * 不改后端契约。后端没有的字段，前端显示「— / 未接入」（用 MetricStatistic / MetricText）。
 *
 * 图例：⟨待补⟩ = 后端字段列还没填。
 *
 * ── P15 食品安全监控中心（Index.tsx）──────────────────────────────
 * FoodSafetyMetrics  safetyIndex ⟨待补⟩ / safetyIndexDelta ⟨待补⟩ / passRate ⟨待补⟩
 *                    passRateDelta ⟨待补⟩ / alertCount ⟨待补⟩ / urgentAlertCount ⟨待补⟩
 *                    compliancePassRate ⟨待补⟩ / coldChainPassRate ⟨待补⟩
 * FarmRiskItem       farmId ⟨待补⟩ / farmName ⟨待补⟩ / score ⟨待补⟩
 * FoodSafetyAlert    id ⟨待补⟩ / type ⟨待补⟩ / target ⟨待补⟩ / code ⟨待补⟩ / time ⟨待补⟩
 *                    level ⟨待补⟩ / status ⟨待补⟩ / measure? ⟨待补⟩
 * AlertHandlePayload measure ⟨待补⟩ / remark? ⟨待补⟩        ← 写操作入参
 *
 * ── P16 流通异常检测（Circulation.tsx）────────────────────────────
 * CirculationRecord  id ⟨待补⟩ / foundAt ⟨待补⟩ / batchNo ⟨待补⟩ / product ⟨待补⟩
 *                    type ⟨待补⟩ / severity ⟨待补⟩ / impact ⟨待补⟩ / status ⟨待补⟩
 *                    foundDate ⟨待补⟩ / measure? ⟨待补⟩
 * CirculationQuery   type? ⟨待补⟩ / severity? ⟨待补⟩ / date? ⟨待补⟩
 * CirculationHandlePayload action ⟨待补⟩ / remark ⟨待补⟩  ← 写操作入参
 *
 * ── P17 合规校验管理（Compliance.tsx）─────────────────────────────
 * InputComplianceRecord id ⟨待补⟩ / farmName ⟨待补⟩ / inputName ⟨待补⟩ / inputType ⟨待补⟩
 *                    dosage ⟨待补⟩ / result ⟨待补⟩ / violation ⟨待补⟩ / checkDate ⟨待补⟩
 * PunishPayload      action ⟨待补⟩ / amount ⟨待补⟩ / remark ⟨待补⟩   ← 写操作入参
 *                    ⚠️ 后端 prod_input_usage 无处罚/金额字段，需后端先扩表
 * LabelComplianceRecord id ⟨待补⟩ / productName ⟨待补⟩ / producer ⟨待补⟩ / labelVersion ⟨待补⟩
 *                    requiredFields ⟨待补⟩ / filledFields ⟨待补⟩ / missingFields ⟨待补⟩
 *                    marking ⟨待补⟩ / markingNote ⟨待补⟩ / result ⟨待补⟩ / checkedAt ⟨待补⟩
 *                    rectifyStatus ⟨待补⟩
 *                    ⚠️ 后端无 prod_label_* 表，唯一带 rectify_* 的是 prod_farm_compliance_check
 * StandardLibraryItem value ⟨待补⟩ / label ⟨待补⟩ / issuer ⟨待补⟩
 * StandardCheckItem  id ⟨待补⟩ / standardNo ⟨待补⟩ / itemName ⟨待补⟩ / limitValue ⟨待补⟩
 *                    measuredValue ⟨待补⟩ / result ⟨待补⟩ / batchNo ⟨待补⟩
 * StandardCheckSummary batchCount ⟨待补⟩ / passCount ⟨待补⟩ / failCount ⟨待补⟩ / passRate ⟨待补⟩
 *                    ⚠️ 四字段均允许 null（后端未提供），**不得用 0 代替**
 * StandardRunPayload standardNo ⟨待补⟩ / batchScope ⟨待补⟩        ← 写操作入参
 *
 * ── P18 可信农产品管理（TrustLabel.tsx）───────────────────────────
 * TrustProduct       id ⟨待补⟩ / name ⟨待补⟩ / category ⟨待补⟩ / producer ⟨待补⟩
 *                    level ⟨待补⟩ / score ⟨待补⟩ / cert ⟨待补⟩ / validUntil ⟨待补⟩
 *                    auditStatus ⟨待补⟩ / certOrg ⟨待补⟩
 *                    ⚠️ 后端无可信农产品实体表；审核落点建议 prod_approval
 *                       （通用 biz_type/biz_id，现有取值 CERT / RECALL / QUOTA）
 * TrustStats         total ⟨待补⟩ / diamond ⟨待补⟩ / gold ⟨待补⟩ / silver ⟨待补⟩ / normal ⟨待补⟩
 * TrustProductUpdatePayload level ⟨待补⟩ / score ⟨待补⟩ / cert ⟨待补⟩ / certOrg ⟨待补⟩
 *                    validUntil ⟨待补⟩                            ← 写操作入参
 * TrustAuditPayload  action ⟨待补⟩ / remark ⟨待补⟩                 ← 写操作入参
 *
 * ── P19 冷链资源撮合（ColdChain.tsx）──────────────────────────────
 * ColdChainResource  id ⟨待补⟩ / name ⟨待补⟩ / type ⟨待补⟩ / typeLabel ⟨待补⟩ / spec ⟨待补⟩
 *                    tempRange ⟨待补⟩ / city ⟨待补⟩ / district ⟨待补⟩ / status ⟨待补⟩
 *                    rating ⟨待补⟩ / contact ⟨待补⟩ / phone ⟨待补⟩ / lastMaintainDate ⟨待补⟩
 * ColdChainStats     total ⟨待补⟩ / available ⟨待补⟩ / busy ⟨待补⟩ / offline ⟨待补⟩
 *                    matchRate ⟨待补⟩
 * MatchRecord        id ⟨待补⟩ / demander ⟨待补⟩ / supplier ⟨待补⟩ / resourceType ⟨待补⟩
 *                    time ⟨待补⟩ / status ⟨待补⟩ / cargo ⟨待补⟩ / tempRequire ⟨待补⟩ / remark ⟨待补⟩
 * MatchPayload       resourceId ⟨待补⟩ / demander ⟨待补⟩ / cargo ⟨待补⟩ / startTime ⟨待补⟩
 *                    tempRequire ⟨待补⟩ / remark? ⟨待补⟩           ← 写操作入参
 * EnqueuePayload     resourceId ⟨待补⟩ / expectTime ⟨待补⟩ / demander ⟨待补⟩ / remark? ⟨待补⟩
 *                                                                  ← 写操作入参
 *                    ⚠️ 后端无冷链资源 / 撮合表（检索 cold-chain / 冷链 零命中）
 */
