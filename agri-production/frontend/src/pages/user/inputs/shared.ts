/**
 * 农资投入品模块共享常量与合规校验引擎
 *
 * 适用范围：投入品列表 / 新建 / 详情 / 台账 / 出入库 / 使用记录 六个页面。
 *
 * 设计说明：
 * - 禁用 / 限用农资清单与推荐剂量基准，当前内置于前端常量表；
 *   后端「农资登记数据库对接」上线后，改为调用合规校验接口，本文件保持函数签名不变即可替换实现。
 * - 合规等级三态与原型 4.2 节一致：✅ 通过 / ⚠️ 预警 / ❌ 拦截。
 */
import dayjs from 'dayjs'

/** 合规等级：通过 / 预警 / 拦截 */
export type ComplianceLevel = 'pass' | 'warning' | 'blocked'

/** 合规等级展示元数据 */
export interface ComplianceLevelMeta {
  /** 等级编码 */
  level: ComplianceLevel
  /** 展示文案 */
  label: string
  /** 图标 */
  icon: string
  /** 主题色 */
  color: string
  /** antd Tag 颜色 */
  tagColor: string
}

/** 三态等级元数据表 */
export const COMPLIANCE_LEVEL_META: Record<ComplianceLevel, ComplianceLevelMeta> = {
  pass: { level: 'pass', label: '通过', icon: '✅', color: '#52c41a', tagColor: 'green' },
  warning: { level: 'warning', label: '预警', icon: '⚠️', color: '#fa8c16', tagColor: 'orange' },
  blocked: { level: 'blocked', label: '拦截', icon: '❌', color: '#ff4d4f', tagColor: 'red' },
}

/** 等级降序权重，用于合并多项校验结果取最严等级 */
const LEVEL_WEIGHT: Record<ComplianceLevel, number> = {
  pass: 0,
  warning: 1,
  blocked: 2,
}

/** 库存四态：正常 / 预警 / 临期 / 不足（PRD R-INPUT-06 / INPUT-07 / HARV-07） */
export type StockState = 'normal' | 'warning' | 'expiring' | 'shortage'

/** 临期判定窗口：批次效期在 30 天内即视为临期（含已过期） */
export const EXPIRING_DAYS = 30

/** 库存四态展示元数据 */
export interface StockStateMeta {
  /** 状态编码 */
  state: StockState
  /** 展示文案 */
  label: string
  /** antd Tag 颜色 */
  tagColor: string
  /** 状态说明 */
  desc: string
}

/** 四态元数据表；判定优先级即下表顺序：不足 > 临期 > 预警 > 正常 */
export const STOCK_STATE_META: Record<StockState, StockStateMeta> = {
  shortage: {
    state: 'shortage',
    label: '不足',
    tagColor: 'red',
    desc: '库存已低于安全下限，需立即补货',
  },
  expiring: {
    state: 'expiring',
    label: '临期',
    tagColor: 'volcano',
    desc: `批次效期 ${EXPIRING_DAYS} 天内，需优先消耗`,
  },
  warning: {
    state: 'warning',
    label: '预警',
    tagColor: 'orange',
    desc: '库存接近预警阈值，建议补货',
  },
  normal: { state: 'normal', label: '正常', tagColor: 'green', desc: '库存充足且效期正常' },
}

/** 库存四态筛选选项（全部 + 四态） */
export const STOCK_STATE_OPTIONS: { value: StockState | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'warning', label: '预警' },
  { value: 'expiring', label: '临期' },
  { value: 'shortage', label: '不足' },
]

/**
 * 判定库存四态。
 *
 * 优先级自上而下、命中即返回：**不足 > 临期 > 预警 > 正常**。
 * - 不足：当前库存不高于预警阈值（安全下限）——缺货直接阻断农事作业，最紧急
 * - 临期：最近批次效期在 30 天内（含已过期）——还能用但必须优先消耗，过期即报废
 * - 预警：库存不高于预警阈值的 1.5 倍，且未命中上述两条
 * - 正常：其余
 *
 * 入参均允许 null：后端 `nearestExpireDate` 无流水时返回 `null`，
 * `warnQty` 也可能为 null，null 视同「未设置」并跳过对应维度判定。
 *
 * @param stockQty 当前库存
 * @param warnQty 预警阈值（安全下限），未设置时跳过库存维度判定
 * @param nearestExpireDate 最近的批次效期，为空时跳过效期维度判定
 * @returns 库存状态
 */
export function resolveStockState(
  stockQty?: number | null,
  warnQty?: number | null,
  nearestExpireDate?: string | null,
): StockState {
  const stock = stockQty ?? 0
  const hasWarn = warnQty !== undefined && warnQty !== null
  if (hasWarn && stock <= (warnQty as number)) return 'shortage'
  if (nearestExpireDate) {
    const expire = dayjs(nearestExpireDate)
    if (expire.isValid()) {
      const days = expire.startOf('day').diff(dayjs().startOf('day'), 'day')
      if (days <= EXPIRING_DAYS) return 'expiring'
    }
  }
  if (hasWarn && stock <= (warnQty as number) * 1.5) return 'warning'
  return 'normal'
}

/**
 * 由出入库流水构建「投入品 ID → 最近批次效期」映射。
 *
 * 效期是**批次维度**字段（后端挂在 `InputStockFlow.expireDate`），投入品实体上没有，
 * 所以临期判定必须回流水取。取值规则：优先取**最早的未过期效期**；
 * 若该投入品全部批次都已过期，则取**最接近今天**的那个过期日，
 * 避免拿陈年旧批次把整批误判成临期。
 *
 * @param flows 出入库流水（只需 inputId 与 expireDate 两个字段）
 * @returns 投入品 ID → 最近效期（YYYY-MM-DD）
 */
export function buildExpireMap(
  flows: { inputId?: string; expireDate?: string }[],
): Map<string, string> {
  const map = new Map<string, string>()
  const today = dayjs().startOf('day')
  flows.forEach((flow) => {
    const inputId = flow.inputId
    if (!inputId || !flow.expireDate) return
    const expire = dayjs(flow.expireDate)
    if (!expire.isValid()) return
    const day = expire.startOf('day')
    const value = day.format('YYYY-MM-DD')
    const current = map.get(inputId)
    if (!current) {
      map.set(inputId, value)
      return
    }
    const currentDay = dayjs(current).startOf('day')
    const currentFuture = !currentDay.isBefore(today)
    const nextFuture = !day.isBefore(today)
    let better = false
    if (currentFuture && nextFuture) {
      better = day.isBefore(currentDay)
    } else if (nextFuture && !currentFuture) {
      better = true
    } else if (!currentFuture && !nextFuture) {
      better = day.isAfter(currentDay)
    }
    if (better) map.set(inputId, value)
  })
  return map
}

/**
 * 合并多个等级为最严等级。
 *
 * @param levels 待合并的等级列表
 * @returns 最严等级，空列表返回 pass
 */
export function worstLevel(levels: ComplianceLevel[]): ComplianceLevel {
  return levels.reduce<ComplianceLevel>(
    (worst, current) => (LEVEL_WEIGHT[current] > LEVEL_WEIGHT[worst] ? current : worst),
    'pass',
  )
}

/* ---------------------------------------------------------------------------
 * 投入品分类
 * -------------------------------------------------------------------------*/

/** 投入品分类元数据 */
export interface InputCategoryMeta {
  /** 后端 inputType 枚举值 */
  value: string
  /** 展示名 */
  label: string
  /** antd Tag 颜色 */
  color: string
}

/** 分类元数据表（原型 4.2 节：肥料 / 农药 / 种苗 / 其他，另补饲料 / 兽药） */
export const INPUT_CATEGORIES: InputCategoryMeta[] = [
  { value: 'FERTILIZER', label: '肥料', color: 'green' },
  { value: 'PESTICIDE', label: '农药', color: 'volcano' },
  { value: 'SEED', label: '种苗', color: 'cyan' },
  { value: 'FEED', label: '饲料', color: 'gold' },
  { value: 'VET', label: '兽药', color: 'purple' },
  { value: 'OTHER', label: '其他', color: 'default' },
]

/** 分类编码 → 元数据 */
export const INPUT_CATEGORY_MAP: Record<string, InputCategoryMeta> = INPUT_CATEGORIES.reduce<
  Record<string, InputCategoryMeta>
>((acc, item) => {
  acc[item.value] = item
  return acc
}, {})

/** 分类下拉选项 */
export const INPUT_CATEGORY_OPTIONS: { value: string; label: string }[] = INPUT_CATEGORIES.map(
  (item) => ({ value: item.value, label: item.label }),
)

/**
 * 取分类元数据，未知编码回落到「其他」。
 *
 * @param inputType 后端分类编码
 * @returns 分类元数据
 */
export function categoryMeta(inputType?: string): InputCategoryMeta {
  if (!inputType) return { value: 'OTHER', label: '其他', color: 'default' }
  return INPUT_CATEGORY_MAP[inputType] ?? { value: inputType, label: inputType, color: 'default' }
}

/** 库存计量单位下拉 */
export const STOCK_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'L', label: 'L' },
  { value: 'mL', label: 'mL' },
  { value: '吨', label: '吨' },
  { value: '株', label: '株' },
  { value: '袋', label: '袋' },
  { value: '瓶', label: '瓶' },
  { value: '箱', label: '箱' },
  { value: '件', label: '件' },
]

/** 亩用量单位下拉（原型 P11：kg/亩、g/亩、mL/亩、L/亩） */
export const DOSAGE_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'kg/亩', label: 'kg/亩' },
  { value: 'g/亩', label: 'g/亩' },
  { value: 'mL/亩', label: 'mL/亩' },
  { value: 'L/亩', label: 'L/亩' },
  { value: '株/亩', label: '株/亩' },
]

/** 施用方式下拉 */
export const USAGE_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: '喷施', label: '喷施' },
  { value: '沟施', label: '沟施' },
  { value: '撒施', label: '撒施' },
  { value: '滴灌', label: '滴灌' },
  { value: '拌种', label: '拌种' },
  { value: '灌根', label: '灌根' },
  { value: '其他', label: '其他' },
]

/* ---------------------------------------------------------------------------
 * 禁用 / 限用农资清单（R-INPUT-02）
 * -------------------------------------------------------------------------*/

/** 国家禁用农药清单（部分，禁止建档与使用） */
export const FORBIDDEN_INPUTS: string[] = [
  '六六六',
  '滴滴涕',
  '毒杀芬',
  '杀虫脒',
  '除草醚',
  '敌枯双',
  '氟乙酰胺',
  '甘氟',
  '毒鼠强',
  '氟乙酸钠',
  '毒鼠硅',
  '甲胺磷',
  '对硫磷',
  '甲基对硫磷',
  '久效磷',
  '磷胺',
  '甲拌磷',
  '甲基异柳磷',
  '克百威',
  '涕灭威',
  '灭线磷',
  '水胺硫磷',
  '氧乐果',
  '内吸磷',
  '硫环磷',
  '氯唑磷',
  '三氯杀螨醇',
  '氰戊菊酯',
  '丁酰肼',
  '氟虫腈',
  '溴甲烷',
  '艾氏剂',
  '狄氏剂',
  '汞制剂',
  '砷类',
  '铅类',
]

/** 限用农药清单（建档需农场主确认并报平台备案） */
export const RESTRICTED_INPUTS: string[] = [
  '毒死蜱',
  '三唑磷',
  '乙酰甲胺磷',
  '丁硫克百威',
  '乐果',
  '敌敌畏',
  '马拉硫磷',
  '辛硫磷',
  '氯氰菊酯',
  '阿维菌素',
  '吡虫啉',
  '噻虫嗪',
  '百菌清',
  '代森锰锌',
]

/**
 * 在清单中模糊匹配投入品名称。
 *
 * @param inputName 投入品名称
 * @param list 清单
 * @returns 命中的清单项，未命中返回 null
 */
function matchInList(inputName: string | undefined, list: string[]): string | null {
  if (!inputName) return null
  const name = inputName.trim()
  if (!name) return null
  return list.find((item) => name.includes(item)) ?? null
}

/**
 * 匹配国家禁用清单。
 *
 * @param inputName 投入品名称
 * @returns 命中的禁用名称，未命中返回 null
 */
export function matchForbidden(inputName?: string): string | null {
  return matchInList(inputName, FORBIDDEN_INPUTS)
}

/**
 * 匹配限用清单。
 *
 * @param inputName 投入品名称
 * @returns 命中的限用名称，未命中返回 null
 */
export function matchRestricted(inputName?: string): string | null {
  return matchInList(inputName, RESTRICTED_INPUTS)
}

/** 准入校验结果 */
export interface AdmissionResult extends ComplianceLevelMeta {
  /** 详细说明 */
  detail: string
  /** 命中的清单名称 */
  hit?: string
}

/**
 * 准入校验（建档阶段）：禁用即拦截，限用预警待确认。
 *
 * @param inputName 投入品名称
 * @param inputType 投入品分类
 * @returns 准入校验结果
 */
export function checkAdmission(inputName?: string, inputType?: string): AdmissionResult {
  const forbidden = matchForbidden(inputName)
  if (forbidden) {
    return {
      ...COMPLIANCE_LEVEL_META.blocked,
      hit: forbidden,
      detail: `「${forbidden}」属国家禁用农资（R-INPUT-02），禁止建档与使用`,
    }
  }
  const restricted = matchRestricted(inputName)
  if (restricted) {
    return {
      ...COMPLIANCE_LEVEL_META.warning,
      hit: restricted,
      detail: `「${restricted}」属限用农资，建档需农场主确认并报平台备案（R-INPUT-02）`,
    }
  }
  if (!inputName) {
    return {
      ...COMPLIANCE_LEVEL_META.pass,
      detail: '填写投入品名称后自动校验禁用 / 限用清单',
    }
  }
  const typeLabel = inputType ? categoryMeta(inputType).label : '投入品'
  return {
    ...COMPLIANCE_LEVEL_META.pass,
    detail: `该${typeLabel}不在禁用 / 限用清单内，准入校验通过`,
  }
}

/* ---------------------------------------------------------------------------
 * 推荐剂量基准（R-INPUT-04）
 * -------------------------------------------------------------------------*/

/** 推荐剂量区间 */
export interface DosageRange {
  /** 推荐下限 */
  min: number
  /** 推荐上限（标签用量上限） */
  max: number
  /** 单位 */
  unit: string
}

/** 常用投入品推荐剂量表（单位统一为亩用量） */
export const RECOMMENDED_DOSAGE: Record<string, DosageRange> = {
  吡虫啉: { min: 30, max: 80, unit: 'g/亩' },
  多菌灵: { min: 20, max: 50, unit: 'g/亩' },
  代森锰锌: { min: 60, max: 120, unit: 'g/亩' },
  阿维菌素: { min: 10, max: 30, unit: 'mL/亩' },
  毒死蜱: { min: 40, max: 90, unit: 'mL/亩' },
  百菌清: { min: 50, max: 100, unit: 'g/亩' },
  复合肥: { min: 10, max: 30, unit: 'kg/亩' },
  尿素: { min: 8, max: 25, unit: 'kg/亩' },
  有机肥: { min: 30, max: 80, unit: 'kg/亩' },
  钾肥: { min: 8, max: 20, unit: 'kg/亩' },
  磷酸二铵: { min: 10, max: 25, unit: 'kg/亩' },
}

/**
 * 按投入品名称匹配推荐剂量区间。
 *
 * @param inputName 投入品名称
 * @returns 推荐剂量区间，无基准返回 null
 */
export function recommendDosage(inputName?: string): DosageRange | null {
  if (!inputName) return null
  for (const key of Object.keys(RECOMMENDED_DOSAGE)) {
    if (inputName.includes(key)) return RECOMMENDED_DOSAGE[key]
  }
  return null
}

/** 单季最多施用次数，用于折算累计用量上限（R-INPUT-04） */
export const SEASON_MAX_TIMES = 12

/**
 * 计算本季累计用量上限。
 *
 * @param inputName 投入品名称
 * @returns 累计上限，无推荐基准时返回 null
 */
export function cumulativeLimit(inputName?: string): number | null {
  const range = recommendDosage(inputName)
  if (!range) return null
  return Number((range.max * SEASON_MAX_TIMES).toFixed(3))
}

/* ---------------------------------------------------------------------------
 * 合规校验四项（原型 P12）
 * -------------------------------------------------------------------------*/

/** 合规校验项 */
export interface ComplianceItem {
  /** 校验项编码 */
  key: string
  /** 校验项名称 */
  label: string
  /** 校验等级 */
  level: ComplianceLevel
  /** 展示图标 */
  icon: string
  /** 主题色 */
  color: string
  /** 结果文案 */
  result: string
  /** 详细说明 */
  detail: string
}

/** 合规校验上下文 */
export interface ComplianceContext {
  /** 投入品名称 */
  inputName?: string
  /** 投入品分类 */
  inputType?: string
  /** 安全间隔期（天） */
  safetyInterval?: number
  /** 本次亩用量 */
  dosage?: number
  /** 用量单位 */
  unit?: string
  /** 最近一次使用时间 */
  lastUsedAt?: string
  /** 预计采收日期 */
  harvestDate?: string
  /** 本季累计用量 */
  cumulativeDosage?: number
  /** 关联地块名（用于说明文案） */
  plotName?: string
}

/**
 * 校验项 1：禁用农药检查。
 *
 * @param ctx 校验上下文
 * @returns 校验项
 */
function checkForbidden(ctx: ComplianceContext): ComplianceItem {
  const forbidden = matchForbidden(ctx.inputName)
  if (forbidden) {
    return {
      key: 'forbidden',
      label: '禁用农药检查',
      level: 'blocked',
      icon: COMPLIANCE_LEVEL_META.blocked.icon,
      color: COMPLIANCE_LEVEL_META.blocked.color,
      result: '拦截',
      detail: `「${forbidden}」属国家禁用农资，禁止使用`,
    }
  }
  const restricted = matchRestricted(ctx.inputName)
  if (restricted) {
    return {
      key: 'forbidden',
      label: '禁用农药检查',
      level: 'warning',
      icon: COMPLIANCE_LEVEL_META.warning.icon,
      color: COMPLIANCE_LEVEL_META.warning.color,
      result: '限用',
      detail: `「${restricted}」属限用农资，非国家禁用品，需农场主确认并报备后使用`,
    }
  }
  return {
    key: 'forbidden',
    label: '禁用农药检查',
    level: 'pass',
    icon: COMPLIANCE_LEVEL_META.pass.icon,
    color: COMPLIANCE_LEVEL_META.pass.color,
    result: '通过',
    detail: '非国家禁用品',
  }
}

/**
 * 校验项 2：用量合规检查（R-INPUT-04）。
 *
 * @param ctx 校验上下文
 * @returns 校验项
 */
function checkDosage(ctx: ComplianceContext): ComplianceItem {
  const base: Omit<ComplianceItem, 'level' | 'icon' | 'color' | 'result' | 'detail'> = {
    key: 'dosage',
    label: '用量合规检查',
  }
  if (ctx.dosage === undefined || ctx.dosage === null) {
    return {
      ...base,
      level: 'pass',
      icon: COMPLIANCE_LEVEL_META.pass.icon,
      color: COMPLIANCE_LEVEL_META.pass.color,
      result: '通过',
      detail: '未登记用量，登记后自动按标签用量校验',
    }
  }
  const range = recommendDosage(ctx.inputName)
  const unit = ctx.unit ?? range?.unit ?? ''
  if (!range) {
    return {
      ...base,
      level: 'pass',
      icon: COMPLIANCE_LEVEL_META.pass.icon,
      color: COMPLIANCE_LEVEL_META.pass.color,
      result: '通过',
      detail: `实际${ctx.dosage}${unit}，暂无推荐剂量基准，按标签用量登记`,
    }
  }
  if (ctx.dosage > range.max) {
    return {
      ...base,
      level: 'warning',
      icon: COMPLIANCE_LEVEL_META.warning.icon,
      color: COMPLIANCE_LEVEL_META.warning.color,
      result: '超量',
      detail: `推荐剂量${range.min}-${range.max}${range.unit}，实际${ctx.dosage}${unit}已超上限，需农艺师确认后方可提交`,
    }
  }
  if (ctx.dosage < range.min) {
    return {
      ...base,
      level: 'warning',
      icon: COMPLIANCE_LEVEL_META.warning.icon,
      color: COMPLIANCE_LEVEL_META.warning.color,
      result: '偏低',
      detail: `推荐剂量${range.min}-${range.max}${range.unit}，实际${ctx.dosage}${unit}低于下限，可能影响效果`,
    }
  }
  return {
    ...base,
    level: 'pass',
    icon: COMPLIANCE_LEVEL_META.pass.icon,
    color: COMPLIANCE_LEVEL_META.pass.color,
    result: '通过',
    detail: `推荐剂量${range.min}-${range.max}${range.unit}，实际${ctx.dosage}${unit}`,
  }
}

/**
 * 校验项 3：休药期检查（R-INPUT-03）。
 *
 * @param ctx 校验上下文
 * @returns 校验项
 */
function checkWithdrawal(ctx: ComplianceContext): ComplianceItem {
  const base: Omit<ComplianceItem, 'level' | 'icon' | 'color' | 'result' | 'detail'> = {
    key: 'withdrawal',
    label: '休药期检查',
  }
  const interval = ctx.safetyInterval
  if (interval === undefined || interval === null) {
    return {
      ...base,
      level: 'warning',
      icon: COMPLIANCE_LEVEL_META.warning.icon,
      color: COMPLIANCE_LEVEL_META.warning.color,
      result: '待补充',
      detail: '未登记安全间隔期，无法校验休药期，请在投入品档案中补充',
    }
  }
  if (!ctx.lastUsedAt) {
    return {
      ...base,
      level: 'pass',
      icon: COMPLIANCE_LEVEL_META.pass.icon,
      color: COMPLIANCE_LEVEL_META.pass.color,
      result: '通过',
      detail: `安全间隔期${interval}天，暂无使用记录`,
    }
  }
  const lastUsed = dayjs(ctx.lastUsedAt)
  if (!lastUsed.isValid()) {
    return {
      ...base,
      level: 'warning',
      icon: COMPLIANCE_LEVEL_META.warning.icon,
      color: COMPLIANCE_LEVEL_META.warning.color,
      result: '待补充',
      detail: '最近使用时间格式异常，无法校验休药期',
    }
  }
  if (ctx.harvestDate) {
    const gap = dayjs(ctx.harvestDate).diff(lastUsed, 'day')
    if (gap < interval) {
      return {
        ...base,
        level: 'blocked',
        icon: COMPLIANCE_LEVEL_META.blocked.icon,
        color: COMPLIANCE_LEVEL_META.blocked.color,
        result: '拦截',
        detail: `距采收期仅${gap}天，不足安全间隔期${interval}天，采收登记将被强制拦截`,
      }
    }
    return {
      ...base,
      level: 'pass',
      icon: COMPLIANCE_LEVEL_META.pass.icon,
      color: COMPLIANCE_LEVEL_META.pass.color,
      result: '通过',
      detail: `距采收期${gap}天，满足休药期要求（≥${interval}天）`,
    }
  }
  const passed = dayjs().diff(lastUsed, 'day')
  if (passed < interval) {
    return {
      ...base,
      level: 'blocked',
      icon: COMPLIANCE_LEVEL_META.blocked.icon,
      color: COMPLIANCE_LEVEL_META.blocked.color,
      result: '拦截',
      detail: `距上次使用仅${passed}天，不足安全间隔期${interval}天，暂不可采收`,
    }
  }
  return {
    ...base,
    level: 'pass',
    icon: COMPLIANCE_LEVEL_META.pass.icon,
    color: COMPLIANCE_LEVEL_META.pass.color,
    result: '通过',
    detail: `距上次使用已${passed}天，满足休药期要求（≥${interval}天）`,
  }
}

/**
 * 校验项 4：累计用量检查（R-INPUT-04）。
 *
 * @param ctx 校验上下文
 * @returns 校验项
 */
function checkCumulative(ctx: ComplianceContext): ComplianceItem {
  const base: Omit<ComplianceItem, 'level' | 'icon' | 'color' | 'result' | 'detail'> = {
    key: 'cumulative',
    label: '累计用量检查',
  }
  const limit = cumulativeLimit(ctx.inputName)
  const cumulative = ctx.cumulativeDosage
  if (limit === null || cumulative === undefined || cumulative === null) {
    return {
      ...base,
      level: 'pass',
      icon: COMPLIANCE_LEVEL_META.pass.icon,
      color: COMPLIANCE_LEVEL_META.pass.color,
      result: '通过',
      detail:
        cumulative === undefined || cumulative === null
          ? '本季累计未超上限'
          : `本季累计${cumulative}${ctx.unit ?? ''}，暂无累计上限基准`,
    }
  }
  const unit = ctx.unit ?? recommendDosage(ctx.inputName)?.unit ?? ''
  if (cumulative > limit) {
    return {
      ...base,
      level: 'blocked',
      icon: COMPLIANCE_LEVEL_META.blocked.icon,
      color: COMPLIANCE_LEVEL_META.blocked.color,
      result: '超限',
      detail: `本季累计${cumulative}${unit}，已超上限${limit}${unit}（按单季${SEASON_MAX_TIMES}次折算），禁止继续施用`,
    }
  }
  if (cumulative > limit * 0.8) {
    return {
      ...base,
      level: 'warning',
      icon: COMPLIANCE_LEVEL_META.warning.icon,
      color: COMPLIANCE_LEVEL_META.warning.color,
      result: '接近上限',
      detail: `本季累计${cumulative}${unit}，已达上限${limit}${unit}的 80%，请注意控制后续用量`,
    }
  }
  return {
    ...base,
    level: 'pass',
    icon: COMPLIANCE_LEVEL_META.pass.icon,
    color: COMPLIANCE_LEVEL_META.pass.color,
    result: '通过',
    detail: `本季累计${cumulative}${unit}，未超上限${limit}${unit}`,
  }
}

/**
 * 合规校验四项汇总（原型 P12「✅ 合规校验结果」）。
 *
 * @param ctx 校验上下文
 * @returns 四项校验结果
 */
export function checkCompliance(ctx: ComplianceContext): ComplianceItem[] {
  return [checkForbidden(ctx), checkDosage(ctx), checkWithdrawal(ctx), checkCumulative(ctx)]
}

/**
 * 由四项结果推导整体合规等级。
 *
 * @param items 校验结果
 * @returns 最严等级
 */
export function summarizeCompliance(items: ComplianceItem[]): ComplianceLevel {
  return worstLevel(items.map((item) => item.level))
}

/* ---------------------------------------------------------------------------
 * 库存流水类型（prod_input_stock_flow.flow_type）
 * -------------------------------------------------------------------------*/

/** 库存流水类型元数据 */
export interface FlowTypeMeta {
  /** 类型编码 */
  value: number
  /** 展示名 */
  label: string
  /** antd Tag 颜色 */
  color: string
  /** 库存方向：1 增加 / -1 减少 */
  direction: 1 | -1
}

/** 流水类型元数据表：1入库 2领用 3退回 4盘盈 5盘亏 6报损 */
export const FLOW_TYPES: FlowTypeMeta[] = [
  { value: 1, label: '入库', color: 'green', direction: 1 },
  { value: 2, label: '领用', color: 'blue', direction: -1 },
  { value: 3, label: '退回', color: 'cyan', direction: 1 },
  { value: 4, label: '盘盈', color: 'gold', direction: 1 },
  { value: 5, label: '盘亏', color: 'orange', direction: -1 },
  { value: 6, label: '报损', color: 'red', direction: -1 },
]

/** 流水类型编码 → 元数据 */
export const FLOW_TYPE_MAP: Record<number, FlowTypeMeta> = FLOW_TYPES.reduce<
  Record<number, FlowTypeMeta>
>((acc, item) => {
  acc[item.value] = item
  return acc
}, {})

/**
 * 取流水类型元数据。
 *
 * @param flowType 类型编码
 * @returns 元数据，未知回落到「入库」
 */
export function flowTypeMeta(flowType?: number): FlowTypeMeta {
  if (flowType === undefined || flowType === null) return FLOW_TYPES[0]
  return FLOW_TYPE_MAP[flowType] ?? FLOW_TYPES[0]
}

/** 流水类型下拉选项 */
export const FLOW_TYPE_OPTIONS: { value: number; label: string }[] = FLOW_TYPES.map((item) => ({
  value: item.value,
  label: item.label,
}))

/* ---------------------------------------------------------------------------
 * 登记证号格式校验
 * -------------------------------------------------------------------------*/

/** 登记证号格式规则 */
export interface RegNoPattern {
  /** 规则名称 */
  label: string
  /** 正则 */
  pattern: RegExp
}

/** 登记证号格式规则表（农药 PD/LS、肥料 农肥、种子 农种经许、兽药/饲料） */
export const REG_NO_PATTERNS: RegNoPattern[] = [
  { label: '农药登记证号（PD20180001）', pattern: /^PD\d{8}([A-Z]\d{4,8})?$/ },
  { label: '农药临时登记证号（LS20180001）', pattern: /^LS\d{8}$/ },
  { label: '卫生杀虫剂登记证号（WL20180001）', pattern: /^WL\d{8}$/ },
  {
    label: '肥料登记证号（农肥(2018)准字1234号）',
    pattern: /^[\u4e00-\u9fa5]{2,6}[(（]\d{4}[)）]准字\d{3,6}号?$/,
  },
  {
    label: '肥料临时登记证号（农肥临字1234号）',
    pattern: /^[\u4e00-\u9fa5]{2,8}临[^\s]{0,4}\d{3,8}号?$/,
  },
  {
    label: '种子生产经营许可证（(京)农种经许字(2018)第0001号）',
    pattern: /^[(（][\u4e00-\u9fa5]{1,6}[)）]?[\u4e00-\u9fa5]{2,10}[(（]\d{4}[)）]第\d{3,6}号?$/,
  },
  { label: '兽药生产许可证（兽药生字(2018)010001）', pattern: /^兽药[\u4e00-\u9fa5]{2,6}[(（]\d{4}[)）]\d{4,8}$/ },
  { label: '饲料生产许可证（饲证(2018)01001）', pattern: /^饲(证|预|添)[\u4e00-\u9fa5]{0,4}[(（]\d{4}[)）]\d{3,8}$/ },
]

/** 登记证号校验结果 */
export interface RegNoCheckResult {
  /** 是否通过 */
  ok: boolean
  /** 命中的规则名称 */
  matched?: string
  /** 不通过时的提示 */
  message?: string
}

/**
 * 校验登记证号格式。
 *
 * @param value 登记证号
 * @returns 校验结果
 */
export function checkRegNo(value?: string): RegNoCheckResult {
  const regNo = (value ?? '').trim()
  if (!regNo) {
    return { ok: false, message: '登记证号为必填项（R-INPUT-01）' }
  }
  const matched = REG_NO_PATTERNS.find((item) => item.pattern.test(regNo))
  if (matched) {
    return { ok: true, matched: matched.label }
  }
  return {
    ok: false,
    message: `登记证号格式不正确，参考格式：${REG_NO_PATTERNS.slice(0, 3)
      .map((item) => item.label.replace(/（.*）/, ''))
      .join(' / ')}`,
  }
}

/* ---------------------------------------------------------------------------
 * 通用工具
 * -------------------------------------------------------------------------*/

/**
 * 数值安全格式化：null / undefined 输出 '-'。
 *
 * @param value 数值
 * @param digits 小数位，默认 2
 * @returns 格式化文案
 */
export function fmtNumber(value?: number | null, digits = 2): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-'
  return Number(value).toFixed(digits)
}

/**
 * 日期安全格式化：null / undefined 输出 '-'。
 *
 * @param value 日期字符串
 * @param pattern 输出格式，默认 YYYY-MM-DD
 * @returns 格式化文案
 */
export function fmtDate(value?: string | null, pattern = 'YYYY-MM-DD'): string {
  if (!value) return '-'
  const date = dayjs(value)
  return date.isValid() ? date.format(pattern) : String(value)
}

/**
 * 确定性伪哈希：用于本地生成存证摘要占位（后端链上接口接入后由真实 txHash 覆盖）。
 *
 * @param seed 种子串
 * @param length 十六进制长度，默认 40
 * @returns 0x 前缀哈希串
 */
export function pseudoHash(seed: string, length = 40): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  const source = `agri-chain::${seed}`
  for (let i = 0; i < source.length; i += 1) {
    const code = source.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 16777619) >>> 0
    h2 = (Math.imul(h2 + code, 48271) + i) >>> 0
  }
  let out = ''
  while (out.length < length) {
    out += (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
    h1 = Math.imul(h1 ^ h2, 16777619) >>> 0
    h2 = (h2 + 0x9e3779b9) >>> 0
  }
  return `0x${out.slice(0, length)}`
}

/** CSV 单元格转义：包裹双引号并转义内部双引号 */
export function escapeCsv(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

/**
 * 导出二维数组为 CSV 文件（带 BOM，Excel 中文不乱码）。
 *
 * @param filename 文件名（不含扩展名）
 * @param header 表头
 * @param rows 数据行
 */
export function downloadCsv(filename: string, header: string[], rows: unknown[][]): void {
  const body = rows.map((row) => row.map(escapeCsv).join(','))
  const csv = `\uFEFF${[header.map(escapeCsv).join(','), ...body].join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${dayjs().format('YYYYMMDDHHmm')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** 时间范围选项（原型 P10：本月 / 本季度 / 本年） */
export interface RangeOption {
  /** 选项值 */
  value: string
  /** 展示名 */
  label: string
}

/** 时间范围下拉选项 */
export const RANGE_OPTIONS: RangeOption[] = [
  { value: 'month', label: '本月' },
  { value: 'quarter', label: '本季度' },
  { value: 'year', label: '本年' },
  { value: 'all', label: '全部' },
]

/**
 * 将时间范围选项解析为起止日期。
 *
 * @param range 范围编码
 * @returns [开始日期, 结束日期]，格式 yyyy-MM-dd
 */
export function resolveRange(range: string): [string, string] {
  const now = dayjs()
  switch (range) {
    case 'month':
      return [now.startOf('month').format('YYYY-MM-DD'), now.endOf('month').format('YYYY-MM-DD')]
    case 'quarter': {
      // dayjs 未加载 quarterOfYear 插件，按月份手工推算季度起止
      const quarterStartMonth = Math.floor(now.month() / 3) * 3
      const start = now.month(quarterStartMonth).startOf('month')
      const end = now.month(quarterStartMonth + 2).endOf('month')
      return [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
    }
    case 'year':
      return [now.startOf('year').format('YYYY-MM-DD'), now.endOf('year').format('YYYY-MM-DD')]
    default:
      return ['1970-01-01', now.format('YYYY-MM-DD')]
  }
}
