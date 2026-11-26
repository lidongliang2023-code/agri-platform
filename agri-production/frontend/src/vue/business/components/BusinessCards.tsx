import { defineComponent, isVNode, ref, type PropType, type VNodeChild } from 'vue'
import { Empty, Pagination, Skeleton, type ColumnType } from '@/vue/ui'
import Card from './SectionCard'
import DetailInfoGrid from './DetailInfoGrid'

/** 业务记录以详情信息卡呈现，沿用列的字段和操作定义。 */
export default defineComponent({
  name: 'ProductionVueBusinessCards',
  props: {
    dataSource: { type: Array as PropType<readonly any[]>, default: () => [] },
    columns: { type: Array as PropType<ColumnType<any>[]>, default: () => [] },
    rowKey: [String, Function] as PropType<string | ((record: any, index?: number) => string | number)>,
    loading: Boolean,
    pagination: { type: [Object, Boolean] as PropType<any>, default: undefined },
    locale: Object as PropType<{ emptyText?: VNodeChild | (() => VNodeChild) }>,
  },
  setup(props) {
    const page = ref(1)
    const size = ref(20)
    return () => {
      if (props.loading) return <Card><Skeleton active /></Card>
      if (!props.dataSource.length) {
        const empty = props.locale?.emptyText
        return <Empty description={(typeof empty === 'function' ? empty() : empty ?? '暂无记录') as any} />
      }
      const config = props.pagination === false ? null : props.pagination ?? {}
      const pageSize = config?.pageSize ?? size.value
      const total = config?.total ?? props.dataSource.length
      const current = config?.current ?? Math.min(page.value, Math.max(1, Math.ceil(total / pageSize)))
      const remote = total > props.dataSource.length
      const rows = config && !remote ? props.dataSource.slice((current - 1) * pageSize, current * pageSize) : props.dataSource
      return <>
        <div style={{ display: 'grid', gap: '16px' }}>
          {rows.map((record, index) => {
            const key = typeof props.rowKey === 'function' ? String(props.rowKey(record, index)) : String((record as Record<string, unknown>)[String(props.rowKey ?? 'id')] ?? index)
            const items = props.columns.flatMap((column, columnIndex) => {
              if ('children' in column && column.children) return []
              const keys = column.dataIndex === undefined ? [] : Array.isArray(column.dataIndex) ? column.dataIndex : [column.dataIndex]
              const value = keys.reduce<unknown>((result, field) => result == null ? undefined : (result as Record<string, unknown>)[String(field)], record)
              const rendered = column.render ? column.render(value, record, index) : value
              const content = rendered && typeof rendered === 'object' && !isVNode(rendered) && 'children' in (rendered as any) ? (rendered as any).children : rendered
              return [{ key: String(column.key ?? columnIndex), label: typeof column.title === 'function' ? '业务信息' : column.title, value: content as VNodeChild, fullWidth: column.title === '操作' || column.title === '排产建议' || column.title === '说明' }]
            })
            return <Card key={key}><DetailInfoGrid columns={3} items={items} /></Card>
          })}
        </div>
        {config && <Pagination showTotal={(t: number) => `共 ${t} 条`} showSizeChanger showQuickJumper pageSizeOptions={['10', '20', '50', '100']} {...config} current={current} pageSize={pageSize} total={total} style={{ marginTop: '16px' }} onChange={(next: number, nextSize: number) => { page.value = next; size.value = nextSize; config.onChange?.(next, nextSize) }} />}
      </>
    }
  },
})
