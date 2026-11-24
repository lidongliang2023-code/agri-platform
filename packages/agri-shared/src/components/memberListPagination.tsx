import type { TablePaginationConfig } from 'antd/es/table'
import './MemberListPagination.css'

/** 表格和卡片列表共用的分页规则，保留业务查询及选择回调。 */
export function memberListPagination(
  config: TablePaginationConfig | false = {},
  selectedCount = 0,
): TablePaginationConfig | false {
  if (config === false) return false
  const { onChange, ...rest } = config
  const size = config.pageSize ?? config.defaultPageSize ?? 20
  const sizes = [...new Set([10, 20, 50, 100, size, ...(config.pageSizeOptions ?? []).map(Number)])]
    .filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b)
  const formatTotal = (total: number, range: [number, number]) => {
    const base = typeof config.showTotal === 'function' ? config.showTotal(total, range) : `共 ${total} 条`
    if (selectedCount > 0) {
      return (
        <span className="production-pagination-total">
          <span className="production-pagination-selected">已选 {selectedCount} 项</span>
          <span aria-hidden="true"> · </span>
          <span>{base}</span>
        </span>
      )
    }
    return base
  }
  return {
    ...rest,
    defaultPageSize: config.defaultPageSize ?? 20,
    position: ['bottomRight'],
    className: `agri-list-pagination production-pagination ${config.className ?? ''}`.trim(),
    size: 'default',
    responsive: false,
    simple: false,
    hideOnSinglePage: false,
    showQuickJumper: true,
    showSizeChanger: true,
    pageSizeOptions: sizes,
    showTotal: formatTotal,
    locale: { ...config.locale, items_per_page: '条/页' },
    onChange: (page, nextSize) => onChange?.(config.pageSize !== undefined && nextSize !== config.pageSize ? 1 : page, nextSize),
  }
}

