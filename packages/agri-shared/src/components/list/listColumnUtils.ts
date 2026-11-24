/**
 * React 公共列表组件纯逻辑工具：列角色判定、列宽持久化校验、列显隐过滤与总宽计算。
 */

export type ColumnWidths = Record<string, number>

export const MIN_RESIZABLE_COLUMN_WIDTH = 80
export const DEFAULT_SELECTION_COLUMN_WIDTH = 48

export const NUMERIC_TITLE_RE =
  /^(数量|金额|单价|总价|小计|合计|库存|面积|产量|重量|余额|采收数量|当前库存|安全库存|扫码次数|可供量|已认购|供给总量|净认购量|未认购意向量|认购率|本次数量|差异量|折算系数|区块高度|日薪|可到岗率|工时上限|采集频率|抽取置信度|株高\(cm\)|数值|冻结量|过期未冻结量|库存可用量|供给占用|可发布|笔数|总额|件数|成交额|费率|利率|比例|占比)$/

export const STATUS_TITLE_RE =
  /^(状态|审核|审核状态|承接状态|订单状态|交易状态|回写状态|级别|告警级别|质量等级|风险等级|合规状态|处理状态|在线状态|链上状态|结果|库存校验|质检|品种映射|数据来源|启用状态|审批状态|支付状态|履约状态|发布状态)$/

export function isActionColumnMeta(title: string, key?: string | number, valueType?: unknown): boolean {
  if (valueType === 'option' || title === '操作') return true
  const normalizedKey = key == null ? '' : String(key)
  return ['option', 'action', 'actions'].includes(normalizedKey)
}

export function isNumericColumnMeta(title: string, valueType?: unknown): boolean {
  if (valueType != null && ['money', 'digit', 'percent'].includes(String(valueType))) return true
  return NUMERIC_TITLE_RE.test(title)
}

export function isStatusColumnMeta(title: string): boolean {
  return STATUS_TITLE_RE.test(title)
}

export function parseConfiguredWidth(width: unknown): number | undefined {
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) return width
  if (typeof width === 'string' && /^\d+(\.\d+)?(px)?$/.test(width.trim())) {
    const parsed = Number.parseFloat(width)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }
  return undefined
}

export function parseStoredWidths(raw: string | null): ColumnWidths {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= MIN_RESIZABLE_COLUMN_WIDTH,
      ),
    )
  } catch {
    return {}
  }
}

export function parseHiddenColumnKeys(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function sanitizeHiddenColumnKeys(keys: string[], lockedKeys: string[]): string[] {
  const locked = new Set(lockedKeys)
  return [...new Set(keys.filter((key) => !locked.has(key)))]
}

export function resolveColumnKey(
  column: { key?: unknown; dataIndex?: unknown },
  index: number,
  parent = '',
): string {
  const dataIndexPart = Array.isArray(column.dataIndex)
    ? column.dataIndex.join('.')
    : column.dataIndex
  const raw = String(column.key ?? dataIndexPart ?? index)
  return parent ? `${parent}/${raw}` : raw
}
