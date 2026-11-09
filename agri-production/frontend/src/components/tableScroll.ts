import type { CSSProperties } from 'react'

/**
 * 列表表格的横向滚动口径：列多、列内容长的表统一从这里取，不再每页自己写一个数字。
 *
 * 为什么不是 `scroll={{ x: 1100 }}` 这种写死的常数：这个数字与列宽总和没有任何联动，
 * 加一列、或把「上市窗口」显示成 `2026-10-01 ~ 2026-10-22` 这种长值，它立刻就失真 ——
 * 偏小时 antd 按 fixed 布局压缩列，数字与日期列竖排换行（读数一眼看不全）；
 * 偏大时容器明明放得下也拖出一条滚动条。
 *
 * `x: 'max-content'` 让 rc-table 给表元素写 `width: max-content; min-width: 100%`
 * 并走 auto 布局（源码原话："When scroll.x is max-content, no need to fix table layout"），
 * 列按内容的自然宽度排布，只在真放不下时出横向滚动条。
 */
export const SCROLL_BY_CONTENT = { x: 'max-content' } as const

/**
 * 长文本列（备注 / 建议 / 规格说明）的上限宽度：超出的部分省略，全文放进气泡与原生 title。
 *
 * 这里刻意**不用** antd 的 `ellipsis: true`：rc-table 见到任意一列带 ellipsis 就把整张表
 * 切成 `tableLayout: 'fixed'`（源码 `flattenColumns.some(({ellipsis}) => ellipsis) → 'fixed'`），
 * 而 fixed 布局叠加 `width: max-content` 时，没写 width 的列会按 0 参与分配 ——
 * 一张表里只要有一列用了 ellipsis，其余列就集体塌掉。
 *
 * auto 布局下 `width` 对单元格不生效，起作用的是 `max-width`，所以收口写在 td 的 style 上；
 * 数字 / 日期 / 枚举列不要用这个 —— 那些宽度稳定，交给 max-content 自然排布。
 */
export const wideTextCell = (dataIndex: string, maxWidth: number) => ({
  onCell: (row: unknown) => ({
    title: String((row as Record<string, unknown> | undefined)?.[dataIndex] ?? ''),
    style: {
      maxWidth,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    } as CSSProperties,
  }),
})
