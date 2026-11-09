import { isValidElement, useState } from 'react'
import type { ReactNode } from 'react'
import { Empty, Pagination, Skeleton } from 'antd'
import Card from './SectionCard'
import type { TableProps } from 'antd'
import DetailInfoGrid from './DetailInfoGrid'

/** 业务记录以详情信息卡呈现，沿用列的字段和操作定义。 */
export default function BusinessCards<T extends object>({ dataSource = [], columns = [], rowKey, loading, pagination, locale }: TableProps<T>): JSX.Element {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  if (loading) return <Card><Skeleton active /></Card>
  if (!dataSource.length) return <Empty description={typeof locale?.emptyText === 'function' ? locale.emptyText() : locale?.emptyText ?? '暂无记录'} />
  const config = pagination === false ? null : pagination ?? {}
  const pageSize = config?.pageSize ?? size
  const total = config?.total ?? dataSource.length
  const current = config?.current ?? Math.min(page, Math.max(1, Math.ceil(total / pageSize)))
  const remote = total > dataSource.length
  const rows = config && !remote ? dataSource.slice((current - 1) * pageSize, current * pageSize) : dataSource
  return <>
    <div style={{ display: 'grid', gap: 16 }}>
      {rows.map((record, index) => {
        const key = typeof rowKey === 'function' ? rowKey(record, index) : String((record as Record<string, unknown>)[String(rowKey ?? 'id')] ?? index)
        const items = columns.flatMap((column, columnIndex) => {
          if ('children' in column) return []
          const keys = column.dataIndex === undefined ? [] : Array.isArray(column.dataIndex) ? column.dataIndex : [column.dataIndex]
          const value = keys.reduce<unknown>((result, field) => result == null ? undefined : (result as Record<string, unknown>)[String(field)], record)
          const rendered = column.render ? column.render(value, record, index) : value
          const content = rendered && typeof rendered === 'object' && !isValidElement(rendered) && 'children' in rendered ? rendered.children : rendered
          return [{ key: String(column.key ?? columnIndex), label: typeof column.title === 'function' ? '业务信息' : column.title, value: content as ReactNode, fullWidth: column.title === '操作' || column.title === '排产建议' || column.title === '说明' }]
        })
        return <Card key={key}><DetailInfoGrid columns={3} items={items} /></Card>
      })}
    </div>
    {config && <Pagination {...config} current={current} pageSize={pageSize} total={total} style={{ marginTop: 16 }} onChange={(next, nextSize) => { setPage(next); setSize(nextSize); config.onChange?.(next, nextSize) }} />}
  </>
}
