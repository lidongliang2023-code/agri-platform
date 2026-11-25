/**
 * React 公共列表组件纯逻辑工具：列角色判定、列宽持久化校验、列显隐过滤与总宽计算。
 */

export type ColumnWidths = Record<string, number>

export const MIN_RESIZABLE_COLUMN_WIDTH = 80
export const MAX_RESIZABLE_COLUMN_WIDTH = 1200
export const DEFAULT_SELECTION_COLUMN_WIDTH = 48

export function clampColumnWidth(width: number, minWidth = MIN_RESIZABLE_COLUMN_WIDTH): number {
  const safeMin = Number.isFinite(minWidth) && minWidth > 0 ? Math.round(minWidth) : MIN_RESIZABLE_COLUMN_WIDTH
  if (!Number.isFinite(width)) return safeMin
  return Math.min(MAX_RESIZABLE_COLUMN_WIDTH, Math.max(safeMin, Math.round(width)))
}

export function deriveColumnWidthStorageKey(
  columnWidthStorageKey?: string | false,
  columnSettingsStorageKey?: string | false,
): string | null {
  if (columnWidthStorageKey === false) return null
  if (typeof columnWidthStorageKey === 'string' && columnWidthStorageKey.trim()) {
    return columnWidthStorageKey.trim()
  }
  if (typeof columnSettingsStorageKey === 'string' && columnSettingsStorageKey.trim()) {
    return `${columnSettingsStorageKey.trim()}:widths`
  }
  return null
}

export const NUMERIC_TITLE_RE =
  /^(数量|金额|单价|总价|小计|合计|库存|面积|面积（亩）|面积\(亩\)|产量|重量|余额|采收数量|当前库存|安全库存|扫码次数|可供量|已认购|供给总量|净认购量|未认购意向量|认购率|本次数量|差异量|折算系数|区块高度|日薪|可到岗率|工时上限|采集频率|抽取置信度|株高\(cm\)|数值|冻结量|过期未冻结量|库存可用量|供给占用|可发布|笔数|总额|件数|成交额|费率|利率|比例|占比|催办次数|生长周期\(天\)|排序权重|标准工时\(h\)|冻结库存记录|阅读|收藏|延迟\(ms\)|电量|信号|经度|纬度|得分|评分|合规得分|异常数|次数|批次总数|设备总数|地块数|任务数|申请金额|授信额度|可用额度|已用额度|放款金额|本金|利息|罚息|逾期金额|质押估值|质押率|期限|佣金|佣金率|返佣金额|退款金额|实付金额|订单金额|商品价格|售价|原价|秒杀价|拼团价|预算|已用预算|成团人数|销量|起订量|排序|赔付金额|开票金额|索赔金额|订单总额|平台服务费|卖家应收|货款|运费|已付|可用|冻结|已用|准时率|承运单数|订单笔数|成交笔数|结算笔数|结算金额|退款额|客单价|供给量|成交量|剩余|成交率|入仓量|期望价|报价数|价格|当前价格|均价|品类评分|价格评分|距离评分|质量评分|综合评分|匹配分数|撮合分数|协商单价|含运费总额|期望单价|挂牌价|采购量|采购数量|期望价格|已报价|合同金额|订单数|交易额)$/

export const STATUS_TITLE_RE =
  /^(状态|审核|审核状态|承接状态|订单状态|交易状态|回写状态|回写|级别|告警级别|质量等级|风险等级|合规状态|处理状态|在线状态|链上状态|结果|结论|库存校验|质检|品种映射|数据来源|启用状态|审批状态|支付状态|履约状态|发布状态|经营状态|合作状态|管控状态|坐标状态|边界状态|原单状态|执行状态|凭证状态|链上凭证|核验状态|处置状态|告警状态|流转状态|复核状态|认证状态|达标状态|信用等级|客户等级|授信状态|放款状态|还款状态|逾期状态|质押状态|结算状态|售后状态|退款状态|上架状态|活动状态|入驻状态|渠道状态|黑名单状态|展示状态|询价状态|合同状态|启停)$/

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
      Object.entries(parsed)
        .filter(
          ([, value]) =>
            typeof value === 'number' &&
            Number.isFinite(value) &&
            value >= MIN_RESIZABLE_COLUMN_WIDTH &&
            value <= MAX_RESIZABLE_COLUMN_WIDTH,
        )
        .map(([key, value]) => [key, Math.round(value as number)]),
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
