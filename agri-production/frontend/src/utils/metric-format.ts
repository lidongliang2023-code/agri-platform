/**
 * 安全数值格式化助手（缺失值显式降级）
 *
 * 背景：全站 `src` 下有 73 处 `toLocaleString()`，绝大多数直接写在
 * `render: (v: number) => v.toLocaleString()` 里，靠 TS 的 `number` 标注「担保」运行时一定有值。
 * 但这个担保是假的：后端 VO 少一个字段、字段名对不上、或把数字序列化成字符串，
 * 运行时拿到的就是 `undefined`，`undefined.toLocaleString()` 直接抛 TypeError，
 * React error boundary 接管后整页白屏。
 *
 * 本项目已经踩到的实例：
 * - `/admin/alerts/review` 返回的是 `AlertVO`（告警复核），根本没有
 *   `affectedArea` / `economicLoss`，灾害事件复盘页两列崩在 `v.toLocaleString()`；
 * - `/admin/knowledge` 返回 `KnowledgeArticleEntity`，浏览量字段叫 `readCount`
 *   而不是前端声明的 `viewCount`，知识库页「查看数」列与详情抽屉同时崩。
 *
 * 纪律（与 `MetricStatistic` 的 `MISSING_VALUE_TEXT` 同口径）：
 * - 缺失值返回 `null` / 渲染「—」，**不许兜成 0、不许渲染成空白**；
 *   0 是一个结论（"统计过了，结果是 0"），空白让用户分不清「没数」还是「出错」。
 * - 汇总类指标只要**任一项**缺失，整个汇总就是 `null`，
 *   不允许「跳过缺失项再把剩下的加起来」——那等于用部分数据冒充全量。
 */

/** 缺失值展示文案（与 MetricStatistic.MISSING_VALUE_TEXT 同口径） */
export const MISSING_METRIC_TEXT = '—'

/** 数值格式化可选项 */
export interface MetricFormatOptions {
  /** 区域，缺省 zh-CN（千分位） */
  locale?: string
  /** 最小小数位，缺省 0 */
  minimumFractionDigits?: number
  /** 最大小数位，缺省 3（与原生 Number#toLocaleString() 默认一致） */
  maximumFractionDigits?: number
}

/**
 * 把「可能是 undefined / null / 数字字符串」的值安全转成有限数字。
 *
 * 为什么要显式判 `Number.isFinite`：后端把数字序列化成字符串是常态
 * （本项目 `PageResult.total` 实测就是 `"8"`），而 `Number('') === 0`、
 * `Number('abc') === NaN`，直接 `Number(v)` 会把空串谎报成 0、把脏数据算成 NaN。
 *
 * @param value 原始值（number / 数字字符串 / null / undefined / 其它）
 * @returns 有限数字；无法解析为有限数字时返回 null（表示「缺失」）
 */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * 格式化数值为千分位文案；缺失时返回「—」。
 *
 * 适用于不需要额外提示图标的位置（表格列、纯文本副标题等）。
 *
 * @param value 原始值
 * @param options 格式化选项
 * @returns 千分位文案，或缺失标记「—」
 */
export function formatMetric(value: unknown, options: MetricFormatOptions = {}): string {
  const numeric = toFiniteNumber(value)
  if (numeric === null) {
    return MISSING_METRIC_TEXT
  }
  const {
    locale = 'zh-CN',
    minimumFractionDigits = 0,
    maximumFractionDigits = 3,
  } = options
  return numeric.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  })
}

/**
 * 汇总一组数值；**任一项缺失则整个汇总为 null**。
 *
 * 语义：累计受灾面积 = Σ 各行受灾面积。只要有一行没返回该字段，
 * 结果就不是"真实的累计值"，返回 null 由页面显示「—」，
 * 强过把缺失行当 0 加进去凑出一个偏小的假总数。
 *
 * @param values 待汇总的原始值数组
 * @returns 汇总值；任一项缺失或不可解析时返回 null
 */
export function sumMetric(values: readonly unknown[]): number | null {
  let total = 0
  for (const value of values) {
    const numeric = toFiniteNumber(value)
    if (numeric === null) {
      return null
    }
    total += numeric
  }
  return total
}
