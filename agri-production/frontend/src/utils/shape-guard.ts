/**
 * 运行时形状校验助手
 *
 * 用途：后端「接口通了、也返了数据，但返回的不是页面要的那种东西」时，
 * 让页面按**数据形状**判定，而不是按「接口通不通 / 数组空不空」判定。
 *
 * 背景（都是本项目实测到的真事）：
 * - `GET /api/v1/production/admin/approvals/config` 返回 `{ bizType, approveLevel }`
 *   骨架，而不是审批流程配置（没有 flowId / flowName / nodes）；
 * - `GET /api/v1/production/analytics/reports` 返回指标快照
 *   `{ metricCode, metricValue, ... }`，而不是报表（没有 reportId / reportName）。
 *
 * 这两个接口都是 `code: 0` + 非空数组，「接口成功」判据完全看不出问题，
 * 页面却会把骨架数据渲染成带错标签的行（凭空造标签），或者把指标冒充成报表。
 * 本模块提供的最小必要形状校验就是用来堵这一类谎报的。
 *
 * 设计：只依赖语言本身，不引入 React / antd / axios，
 * 因此可以在 node 里被直接加载做实测校验。
 */

/**
 * 判断一个值是否为「非空字符串」。
 *
 * 后端字段经常是字符串化的数字或空串；只判 `typeof === 'string'`
 * 会把 `''` 也算作有值，故必须再判 trim 后非空。
 *
 * @param value 待判定的值
 * @returns 是非空字符串时返回 true
 */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * 校验一行数据是否**同时**具备所有指定的非空字符串字段。
 *
 * 这是「这行数据是不是我要的那种东西」的最小必要形状判据：
 * 只要缺任何一个关键字段，就说明后端给的是别的东西（骨架 / 指标 / 汇总），
 * 页面不应把它当目标实体渲染。
 *
 * @param row 后端返回的一行（运行时形状不可信）
 * @param fields 必须具备的非空字符串字段名
 * @returns 全部字段都具备且非空时返回 true（并收窄掉 undefined / null）
 */
export function hasNonEmptyTextFields<T>(
  row: T | undefined | null,
  fields: readonly (keyof T)[],
): row is T {
  if (!row || typeof row !== 'object') {
    return false
  }
  const record = row as Record<string, unknown>
  return fields.every((field) => isNonEmptyString(record[field as string]))
}
