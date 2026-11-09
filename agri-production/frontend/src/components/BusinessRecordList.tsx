import ProTable from './ProductionTable'
import type { ProColumns } from '@ant-design/pro-components'
import { useQueryClient } from '@tanstack/react-query'
import type { TableProps } from 'antd'
import type { ReactNode } from 'react'

interface BusinessRecordListProps<T extends object> extends TableProps<T> {
  /** 重新读取当前列表及关联统计；未指定时刷新当前激活的查询。 */
  onReload?: () => unknown
  toolbarTitle?: ReactNode
  columnWidthStorageKey?: string | false
}

/** 多条业务记录共用列表：刷新、密度、列设置，操作列固定在右侧。 */
export default function BusinessRecordList<T extends object>({ scroll, columns, onReload, toolbarTitle, ...props }: BusinessRecordListProps<T>): JSX.Element {
  const queryClient = useQueryClient()
  const fixedColumns = columns?.map((column, index) => ({
    ...column,
    key: column.key ?? ('dataIndex' in column ? String(column.dataIndex ?? index) : String(index)),
    ...(!('children' in column) && (column.title === '操作' || ['option', 'action', 'actions'].includes(String(column.key)))
      ? { fixed: 'right' as const, width: column.width ?? 180 }
      : {}),
  })) as ProColumns<T>[] | undefined
  return <ProTable<T>
    size="small"
    {...props}
    columns={fixedColumns}
    search={false}
    headerTitle={toolbarTitle ?? false}
    toolBarRender={() => []}
    cardProps={false}
    options={{
      reload: () => { void (onReload ? onReload() : queryClient.invalidateQueries({ refetchType: 'active' })) },
      density: true,
      setting: true,
      fullScreen: false,
    }}
    scroll={{ x: 'max-content', ...scroll }}
  />
}
