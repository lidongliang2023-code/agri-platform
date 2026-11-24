import { Pagination } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'
import './ProductionPagination.css'

import { memberListPagination as productionPagination } from '@agri/shared/components/memberListPagination'
export { productionPagination }

/** 用于非表格的资源卡片列表，与表格分页共用同一配置。 */
export default function ProductionPagination({ selectedCount = 0, ...props }: TablePaginationConfig & { selectedCount?: number }): JSX.Element {
  const config = productionPagination(props, selectedCount) as TablePaginationConfig
  const { position: _position, ...pagination } = config
  return <div className="production-pagination-footer"><Pagination {...pagination} /></div>
}
