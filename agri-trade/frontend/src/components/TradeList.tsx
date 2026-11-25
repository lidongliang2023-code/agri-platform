import { useId, type ReactNode } from 'react'
import { Button } from 'antd'
import { AgriListTable, CollapsibleFilterDiv, type AgriListTableProps } from '@agri/shared'
import './trade-list.css'

interface TradeListProps<T extends object> extends AgriListTableProps<T> {
  listId: string
  selectable?: boolean
}

export function TradeList<T extends object>({ listId, selectable = true, rowSelection, wrapperClassName, ...props }: TradeListProps<T>) {
  return (
    <AgriListTable<T>
      key={listId}
      columnSettingsStorageKey={`trade:list:columns:${listId}`}
      columnWidthStorageKey={`trade:list:widths:${listId}`}
      wrapperClassName={['trade-list', wrapperClassName].filter(Boolean).join(' ')}
      rowSelection={selectable ? { preserveSelectedRowKeys: true, ...rowSelection } : undefined}
      {...props}
    />
  )
}

interface FilterField {
  label: string
  control: ReactNode
  wide?: boolean
}

export function TradeFilters({ fields, onQuery, onReset, loading, queryText = '查询' }: {
  fields: FilterField[]
  onQuery: () => void
  onReset: () => void
  loading?: boolean
  queryText?: string
}) {
  const id = useId()
  return (
    <CollapsibleFilterDiv className="trade-list-filters" fieldCount={fields.length}>
      {({ toggleButton }) => (
        <>
          {fields.map(({ label, control, wide }, index) => (
            <div key={label} className={`agri-filter-field${wide ? ' agri-filter-span-2' : ''}`} role="group" aria-labelledby={`${id}-${index}`}>
              <label id={`${id}-${index}`}>{label}</label>
              {control}
            </div>
          ))}
          <div className="agri-filter-actions">
            <Button onClick={onReset}>重置</Button>
            <Button type="primary" loading={loading} onClick={onQuery}>{queryText}</Button>
            {toggleButton}
          </div>
        </>
      )}
    </CollapsibleFilterDiv>
  )
}
