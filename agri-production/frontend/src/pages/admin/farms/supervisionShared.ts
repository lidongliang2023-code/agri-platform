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
import { useSyncExternalStore } from 'react'
import type { BizId, ComplianceResult } from '@/types'
import type { FarmComplianceProfile } from '@/api/admin/farms'

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

/** 原型 4.2 平台级示例规模（后端无数据时的统计口径） */
export const SAMPLE_FARM_TOTALS = {
  /** 总农场数 */
  total: 3542,
  /** 正常 */
  normal: 2980,
  /** 预警 */
  warning: 412,
  /** 异常 */
  abnormal: 150,
}

/** 原型 P4 示例农场数据（后端无数据时降级展示，保证页面可交互） */
export const SAMPLE_SUPERVISED_FARMS: SupervisedFarmRow[] = [
  {
    farmId: 'F202501',
    farmCode: 'F202501',
    farmName: '绿源1号农场',
    tenantName: '绿源农业',
    province: '河南省',
    city: '郑州市',
    areaTotal: 500,
    crops: '水稻、小麦',
    riskScore: 35,
    riskLevel: 'low',
    statusLabel: '正常',
    lastCheckAt: '07-12',
    fromSample: true,
  },
  {
    farmId: 'F202502',
    farmCode: 'F202502',
    farmName: '丰达A区农场',
    tenantName: '丰达农场',
    province: '山东省',
    city: '济南市',
    areaTotal: 320,
    crops: '蔬菜',
    riskScore: 68,
    riskLevel: 'medium',
    statusLabel: '预警',
    lastCheckAt: '07-10',
    fromSample: true,
  },
  {
    farmId: 'F202503',
    farmCode: 'F202503',
    farmName: '大地南基地',
    tenantName: '大地种业',
    province: '黑龙江省',
    city: '哈尔滨市',
    areaTotal: 800,
    crops: '玉米、大豆',
    riskScore: 72,
    riskLevel: 'medium',
    statusLabel: '预警',
    lastCheckAt: '07-08',
    fromSample: true,
  },
  {
    farmId: 'F202504',
    farmCode: 'F202504',
    farmName: '鑫农实验农场',
    tenantName: '鑫农科技',
    province: '广东省',
    city: '广州市',
    areaTotal: 120,
    crops: '草莓',
    riskScore: 85,
    riskLevel: 'high',
    statusLabel: '异常',
    lastCheckAt: '07-05',
    fromSample: true,
  },
  {
    farmId: 'F202505',
    farmCode: 'F202505',
    farmName: '惠民D区农场',
    tenantName: '惠民种植',
    province: '河北省',
    city: '石家庄市',
    areaTotal: 260,
    crops: '小麦',
    riskScore: 25,
    riskLevel: 'low',
    statusLabel: '正常',
    lastCheckAt: '07-13',
    fromSample: true,
  },
]

/**
 * 原型 P5 / P1 示例地理分布数据。
 *
 * 后端 `/admin/farms/map` 仅返回省市区与面积（无经纬度），
 * 项目内也没有中国 GeoJSON，故这里提供一组带风险属性的示例点位用于降级展示。
 */
export const SAMPLE_MAP_POINTS: SupervisionMapPoint[] = [
  { farmId: 'F202501', farmName: '绿源1号农场', province: '河南省', city: '郑州市', district: '中牟县', areaTotal: 500, riskScore: 35, riskLevel: 'low', statusLabel: '正常' },
  { farmId: 'F202506', farmName: '绿源蔬菜大棚', province: '河南省', city: '洛阳市', district: '偃师区', areaTotal: 120, riskScore: 45, riskLevel: 'low', statusLabel: '正常' },
  { farmId: 'F202507', farmName: '中原生态农场', province: '河南省', city: '新乡市', district: '原阳县', areaTotal: 640, riskScore: 66, riskLevel: 'medium', statusLabel: '预警' },
  { farmId: 'F202502', farmName: '丰达A区农场', province: '山东省', city: '济南市', district: '章丘区', areaTotal: 320, riskScore: 68, riskLevel: 'medium', statusLabel: '预警' },
  { farmId: 'F202508', farmName: '丰达果蔬基地', province: '山东省', city: '潍坊市', district: '寿光市', areaTotal: 410, riskScore: 28, riskLevel: 'low', statusLabel: '正常' },
  { farmId: 'F202503', farmName: '大地南基地', province: '黑龙江省', city: '哈尔滨市', district: '五常市', areaTotal: 800, riskScore: 72, riskLevel: 'medium', statusLabel: '预警' },
  { farmId: 'F202509', farmName: '大地北基地', province: '黑龙江省', city: '齐齐哈尔市', district: '甘南县', areaTotal: 1250, riskScore: 52, riskLevel: 'low', statusLabel: '正常' },
  { farmId: 'F202504', farmName: '鑫农实验农场', province: '广东省', city: '广州市', district: '从化区', areaTotal: 120, riskScore: 85, riskLevel: 'high', statusLabel: '异常' },
  { farmId: 'F202510', farmName: '惠民种植园', province: '广东省', city: '惠州市', district: '博罗县', areaTotal: 260, riskScore: 83, riskLevel: 'high', statusLabel: '异常' },
  { farmId: 'F202505', farmName: '惠民D区农场', province: '河北省', city: '石家庄市', district: '正定县', areaTotal: 260, riskScore: 25, riskLevel: 'low', statusLabel: '正常' },
  { farmId: 'F202511', farmName: '江南水田农场', province: '江苏省', city: '南京市', district: '溧水区', areaTotal: 480, riskScore: 41, riskLevel: 'low', statusLabel: '正常' },
  { farmId: 'F202512', farmName: '蜀中粮油农场', province: '四川省', city: '成都市', district: '崇州市', areaTotal: 720, riskScore: 58, riskLevel: 'low', statusLabel: '正常' },
  { farmId: 'F202513', farmName: '江汉平原农场', province: '湖北省', city: '荆州市', district: '监利市', areaTotal: 960, riskScore: 88, riskLevel: 'high', statusLabel: '异常' },
  { farmId: 'F202514', farmName: '浙北果蔬农场', province: '浙江省', city: '湖州市', district: '长兴县', areaTotal: 220, riskScore: 33, riskLevel: 'low', statusLabel: '正常' },
]

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

/** 原型 P6 检查记录 / P17 投入品合规的检查任务示例数据 */
export const SAMPLE_COMPLIANCE_TASKS: ComplianceTaskItem[] = [
  {
    checkId: 'CHK20250712001',
    farmId: 'F202501',
    farmName: '绿源1号农场',
    checkType: '常规检查',
    checkItem: '农药存放与记录完整性',
    result: 1,
    checkerName: '王检查',
    checkedAt: '2025-07-12 10:30:00',
    rectifyStatus: 'none',
    source: 'local',
  },
  {
    checkId: 'CHK20250615002',
    farmId: 'F202501',
    farmName: '绿源1号农场',
    checkType: '记录缺失督导',
    checkItem: '生产记录缺失率抽查',
    result: 2,
    problem: '5-6月农药使用记录缺失 6 条',
    rectifyRequirement: '规范农药存放并补齐缺失记录',
    rectifyDeadline: '2025-06-30',
    checkerName: '李监管',
    checkedAt: '2025-06-15 09:15:00',
    rectifyStatus: 'rectified',
    rectifyRemark: '已完成农药专柜存放改造，缺失记录已补齐',
    rectifyAttachment: 'https://oss.agri.example/rectify/CHK20250615002.pdf',
    rectifiedAt: '2025-06-26 16:20:00',
    source: 'local',
  },
  {
    checkId: 'CHK20250520003',
    farmId: 'F202501',
    farmName: '绿源1号农场',
    checkType: '禁限用农资抽查',
    checkItem: 'XX农药（禁限用清单）使用核查',
    result: 3,
    problem: '检出国家禁用农药 XX农药，库存 3 件',
    rectifyRequirement: '立即停用XX农药并封存库存',
    rectifyDeadline: '2025-06-05',
    checkerName: '王检查',
    checkedAt: '2025-05-20 14:05:00',
    rectifyStatus: 'rectified',
    rectifyRemark: '已封存库存并交由第三方销毁，附处置单',
    rectifyAttachment: 'https://oss.agri.example/rectify/CHK20250520003.pdf',
    rectifiedAt: '2025-05-28 11:00:00',
    source: 'local',
  },
  {
    checkId: 'CHK20250710004',
    farmId: 'F202502',
    farmName: '丰达A区农场',
    checkType: '禁限用农资抽查',
    checkItem: '草甘膦用量合规性抽查',
    result: 2,
    problem: '草甘膦单位面积用量超标准 24%',
    rectifyRequirement: '限期提交用药整改说明并接受复检',
    rectifyDeadline: '2025-12-31',
    checkerName: '赵监管',
    checkedAt: '2025-07-10 15:40:00',
    rectifyStatus: 'processing',
    source: 'local',
  },
  {
    checkId: 'CHK20250705005',
    farmId: 'F202504',
    farmName: '鑫农实验农场',
    checkType: '禁限用农资抽查',
    checkItem: '高毒农药残留抽检',
    result: 3,
    problem: '草莓批次农残检出超标（吡虫啉 1.8mg/kg）',
    rectifyRequirement: '批次封存停用，7 日内提交溯源整改报告',
    rectifyDeadline: '2025-07-20',
    checkerName: '李监管',
    checkedAt: '2025-07-05 08:42:00',
    rectifyStatus: 'pending',
    source: 'local',
  },
  {
    checkId: 'CHK20250713006',
    farmId: 'F202505',
    farmName: '惠民D区农场',
    checkType: '记录缺失督导',
    checkItem: '小麦施肥记录完整性',
    result: 1,
    checkerName: '王检查',
    checkedAt: '2025-07-13 11:20:00',
    rectifyStatus: 'none',
    source: 'local',
  },
]

/* ==================== 四、合规检查任务本地登记存储 ==================== */

/**
 * 本地存储键
 *
 * 后端 `/admin/farms/compliance` 目前只提供「合规画像」读取，
 * 缺失检查任务写接口，这里用 localStorage 承接登记的检查任务，
 * 使列表页「下发整改」→ 合规检查页「整改跟踪」形成闭环。
 */
const TASK_STORAGE_KEY = 'agri-admin:farms:compliance-tasks'

/** 订阅者集合 */
const taskListeners = new Set<() => void>()

/** 内存缓存，避免每次快照都反序列化 */
let cachedTasks: ComplianceTaskItem[] | null = null

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
  cachedTasks = [...SAMPLE_COMPLIANCE_TASKS]
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

/**
 * 新增检查任务。
 *
 * @param task 待新增的任务
 */
export function addComplianceTask(task: ComplianceTaskItem): void {
  cachedTasks = [task, ...getComplianceTasks()]
  persistComplianceTasks()
  emitComplianceTasksChange()
}

/**
 * 局部更新检查任务。
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
  emitComplianceTasksChange()
}

/**
 * 订阅式读取合规检查任务（跨页面共享同一份数据）。
 *
 * @returns 任务列表
 */
export function useComplianceTasks(): ComplianceTaskItem[] {
  return useSyncExternalStore(
    subscribeComplianceTasks,
    getComplianceTasks,
    getComplianceTasks,
  )
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
