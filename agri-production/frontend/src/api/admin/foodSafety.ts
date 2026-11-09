/** 运营端食品安全真实接口。查询失败明确报错，空结果保持为空；禁止示例回退。 */
import { asApiRequestError, http, httpStatusOf } from '@/utils/request'
import type { BizId, PageQuery, PageResult } from '@/types'

/** 食品安全模块接口前缀 */
const BASE = '/admin/food-safety'

/* ==================== 通用工具 ==================== */



/**
 * 将数组按分页参数切片，并封装为前端统一分页结构。
 *
 * @param list 全量数据
 * @param pageNum 页码（从 1 开始）
 * @param pageSize 每页条数
 * @returns 分页结果
 */



/* ==================== 数据来源明示（合规强相关） ==================== */




const sourceFlags = new Map<string, boolean>()




export function isMockSource(...keys: string[]): boolean {
  return keys.some((key) => sourceFlags.get(key) === true)
}

/* ==================== 写操作结果（合规强相关：禁止假成功） ==================== */



/** 写操作失败原因 */
export type WriteFailureReason =
  /** 请求未到达业务处理（404 / 网络异常 / 5xx）：后端当前没有可用接口，未写入服务端 */
  | 'backend-not-implemented'
  /** 后端收到请求并明确拒绝（业务码非 0），错误信息取服务端原文 */
  | 'backend-rejected'
  
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
  message: '服务端台账登记与实际业务执行的边界',
  description: '保存成功仅代表本次记录已写入服务端。处理进展不等于整改结案；冻结与码作废统一进入不合格品处置。物流、退款、销毁须有对应业务执行凭据。',
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





/** 16 格对应农场名称 */





/** 查询食品安全监控中心核心指标 */
export async function getFoodSafetyMetrics(): Promise<FoodSafetyMetrics> {
  const res = await http.get<FoodSafetyMetrics>(`${BASE}/metrics`, undefined, { silent: true })
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
}

/** 查询农场食品安全风险评分（风险热力图） */
export async function listFarmRisk(): Promise<FarmRiskItem[]> {
  const res = await http.get<FarmRiskItem[]>(`${BASE}/risk-distribution`, undefined, {
      silent: true,
    })
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
}

/** 查询食品安全事件告警列表 */
export async function listFoodSafetyAlerts(limit = 20): Promise<FoodSafetyAlert[]> {
  const res = await http.get<FoodSafetyAlert[]>(`${BASE}/alerts`, { limit }, { silent: true })
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
}

/** 处置食品安全告警入参 */
export interface AlertHandlePayload {
  /** 处置措施 */
  measure: string
  /** 处置说明 */
  remark?: string
}


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


CIRCULATION_STORE[0].id = 'CIR20250714001'
CIRCULATION_STORE[1].id = 'CIR20250714002'
CIRCULATION_STORE[2].id = 'CIR20250714003'
CIRCULATION_STORE[3].id = 'CIR20250713010'
CIRCULATION_STORE[3].foundDate = '2025-07-13'
CIRCULATION_STORE[3].foundAt = '昨天'

/** 分页查询流通异常检测列表 */
export async function listCirculation(params: CirculationQuery): Promise<PageResult<CirculationRecord>> {
  const res = await http.get<PageResult<CirculationRecord>>(`${BASE}/circulation`, params, {
      silent: true,
    })
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
}

/** 流通异常处理入参 */
export interface CirculationHandlePayload {
  /** 处置方式 */
  action: string
  /** 处置说明 */
  remark: string
}


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


export interface InputCompliancePage extends PageResult<InputComplianceRecord> {
  
  unavailableReason?: string
}


export async function listInputCompliance(
  params: InputComplianceQuery,
): Promise<InputCompliancePage> {
  const res = await http.get<PageResult<InputComplianceRecord>>(
      `${BASE}/compliance/inputs`,
      params,
      { silent: true },
    )
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
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



/** 分页查询产品标签合规记录 */
export async function listLabelCompliance(
  params: LabelComplianceQuery,
): Promise<PageResult<LabelComplianceRecord>> {
  const res = await http.get<PageResult<LabelComplianceRecord>>(`${BASE}/compliance/labels`, params, {
      silent: true,
    })
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
}


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





/** 查询行业标准库 */
export async function listStandardLibrary(): Promise<StandardLibraryItem[]> {
  const res = await http.get<StandardLibraryItem[]>(`${BASE}/compliance/standards`, undefined, {
      silent: true,
    })
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
}

/** 查询某标准的校验项明细 */
export async function listStandardCheckItems(standardNo: string): Promise<StandardCheckItem[]> {
  const res = await http.get<StandardCheckItem[]>(
      `${BASE}/compliance/standards/${standardNo}/items`,
      undefined,
      { silent: true },
    )
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
}

/** 查询某标准的校验汇总 */
export async function getStandardCheckSummary(standardNo: string): Promise<StandardCheckSummary> {
  const res = await http.get<StandardCheckSummary>(
      `${BASE}/compliance/standards/${standardNo}/summary`,
      undefined,
      { silent: true },
    )
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
}

/** 执行标准自动校验入参 */
export interface StandardRunPayload {
  /** 标准编号 */
  standardNo: string
  /** 校验批次范围 */
  batchScope: string
}


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







/** 查询可信农产品统计 */
export async function getTrustStats(): Promise<TrustStats> {
  const res = await http.get<TrustStats>(`${BASE}/trust-label/stats`, undefined, { silent: true })
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
}

/** 分页查询可信农产品名单 */
export async function listTrustProducts(
  params: TrustProductQuery,
): Promise<PageResult<TrustProduct>> {
  const res = await http.get<PageResult<TrustProduct>>(`${BASE}/trust-label/products`, params, {
      silent: true,
    })
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
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



/** 分页查询冷链资源列表 */
export async function listColdChainResources(
  params: ColdChainQuery,
): Promise<PageResult<ColdChainResource>> {
  const res = await http.get<PageResult<ColdChainResource>>(`${BASE}/cold-chain/resources`, params, {
      silent: true,
    })
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
}

/** 撮合记录查询入参 */
export interface MatchRecordQuery extends PageQuery {
  /** 撮合状态 */
  status?: MatchRecord['status'] | 'all'
}

/** 分页查询撮合记录 */
export async function listMatchRecords(params: MatchRecordQuery): Promise<PageResult<MatchRecord>> {
  const res = await http.get<PageResult<MatchRecord>>(`${BASE}/cold-chain/matches`, params, {
      silent: true,
    })
  if (res == null) throw new Error('服务端未返回有效数据')
  return res
}


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


export async function enqueueResource(payload: EnqueuePayload): Promise<WriteResult> {
  try {
    await http.post<unknown>(`${BASE}/cold-chain/queue`, payload, { silent: true })
    return okResult('已加入撮合队列并写入服务端')
  } catch (error) {
    return failFromError('加入撮合队列', error)
  }
}

/* ==================== 后端能力核对清单（写操作） ==================== */



/* ==================== 前端字段对照表（后端上线时补「后端字段」列） ==================== */



export async function getColdChainStats(): Promise<ColdChainStats> { return http.get<ColdChainStats>(`${BASE}/cold-chain/stats`) }
