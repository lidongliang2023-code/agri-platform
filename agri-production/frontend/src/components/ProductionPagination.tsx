import { Pagination } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'
import './ProductionPagination.css'

/** 表格和卡片列表共用的分页规则，保留业务查询及选择回调。 */
export function productionPagination(config: TablePaginationConfig | false = {}): TablePaginationConfig | false {
  if (config === false) return false
  const { onChange, ...rest } = config
  const size = config.pageSize ?? config.defaultPageSize ?? 20
  const sizes = [...new Set([10, 20, 50, 100, size, ...(config.pageSizeOptions ?? []).map(Number)])]
    .filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b)
  return {
    ...rest,
    defaultPageSize: config.defaultPageSize ?? 20,
    position: ['bottomRight'],
    className: `production-pagination ${config.className ?? ''}`.trim(),
    size: 'default',
    responsive: false,
    simple: false,
    hideOnSinglePage: false,
    showQuickJumper: false,
    showSizeChanger: true,
    pageSizeOptions: sizes,
    showTotal: (total, range) => `第 ${total === 0 ? 0 : range[0]}-${total === 0 ? 0 : range[1]} 条/总共 ${total} 条`,
    locale: { ...config.locale, items_per_page: '条/页' },
    onChange: (page, nextSize) => onChange?.(config.pageSize !== undefined && nextSize !== config.pageSize ? 1 : page, nextSize),
  }
}

/** 用于非表格的资源卡片列表，与表格分页共用同一配置。 */
export default function ProductionPagination(props: TablePaginationConfig): JSX.Element {
  const config = productionPagination(props) as TablePaginationConfig
  const { position: _position, ...pagination } = config
  return <div className="production-pagination-footer"><Pagination {...pagination} /></div>
}
