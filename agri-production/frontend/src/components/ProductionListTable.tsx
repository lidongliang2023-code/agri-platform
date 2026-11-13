import { Table } from 'antd'
import type { TableProps } from 'antd'
import { productionPagination } from './ProductionPagination'

/** 普通运营列表统一入口：数据和列仍由业务页面提供。 */
export default function ProductionListTable<T extends object>(props: TableProps<T>): JSX.Element {
  return <Table<T> {...props} pagination={productionPagination(props.pagination)} />
}
