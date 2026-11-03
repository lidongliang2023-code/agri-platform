import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { opsApi } from '../api'
import type { AuditLog } from '../types'
import { ErrorBlock, LoadingBlock, PageTitle, StatTile } from '../components/ui'

/** 操作审计：所有写操作由后端统一落库，页面只读，不提供删除入口。 */
export function AuditLogsPage(): JSX.Element {
  const [items, setItems] = useState<AuditLog[] | null>(null)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')

  const load = (): void => {
    setError('')
    opsApi.auditLogs().then(setItems).catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  const visible = useMemo(() => {
    if (!items) return []
    const q = keyword.trim()
    if (!q) return items
    return items.filter((item) => `${item.operator}${item.action}${item.target}${item.detail}`.includes(q))
  }, [items, keyword])

  const columns: ColumnsType<AuditLog> = [
    { title: '时间', dataIndex: 'createdAt', width: 150 },
    { title: '操作人', dataIndex: 'operator', width: 130 },
    { title: '动作', dataIndex: 'action', width: 170, render: (value: string) => <Tag className="soft-tag tone-green">{value}</Tag> },
    { title: '对象', dataIndex: 'target' },
    { title: '详情', dataIndex: 'detail', width: 320 },
    { title: 'IP', dataIndex: 'ip', width: 130 },
  ]

  if (!items && !error) return <LoadingBlock rows={4} />
  if (error || !items) return <ErrorBlock message={error} onRetry={load} />

  const operators = new Set(items.map((item) => item.operator)).size

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="AUDIT TRAIL"
        title="操作审计"
        description="内容审核、行情录入、供需审核、推荐策略等所有写操作自动留痕 · 日志只读，不可编辑或删除"
        actions={<Button onClick={load}>刷新</Button>}
      />

      <div className="grid-4">
        <StatTile label="日志总量" value={items.length} unit="条" note="近 30 日" />
        <StatTile label="操作人数" value={operators} unit="人" note="含运营与审核岗" />
        <StatTile label="今日操作" value={items.filter((item) => item.createdAt.startsWith('2026-06-27')).length} unit="条" note="按当前数据统计" tone="up" />
        <StatTile label="保留策略" value="180" unit="天" note="到期归档至数据仓库" />
      </div>

      <section className="surface-card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <span className="small muted">共 {visible.length} 条记录</span>
          <Input.Search
            allowClear
            style={{ width: 260 }}
            placeholder="搜索操作人 / 动作 / 对象"
            onSearch={(value) => setKeyword(value)}
          />
        </div>
        <Table rowKey="id" size="middle" columns={columns} dataSource={visible} pagination={{ pageSize: 12, showSizeChanger: false }} />
      </section>
    </div>
  )
}
