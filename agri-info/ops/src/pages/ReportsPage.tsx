import { useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Radio, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { opsApi } from '../api'
import type { Report, ReportsAdmin } from '../types'
import { ErrorBlock, LoadingBlock, PageTitle, StatTile, StatusTag, formatCount } from '../components/ui'

/** 报告审核：报告发布后即进入用户端「研究报告」，并自动触发内容存证。 */
export function ReportsPage(): JSX.Element {
  const [data, setData] = useState<ReportsAdmin | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('pending')
  const [target, setTarget] = useState<Report | null>(null)
  const [form] = Form.useForm<{ action: string; note?: string }>()
  const [submitting, setSubmitting] = useState(false)

  const load = (overrides: Partial<{ status: string }> = {}): void => {
    const next = { status, ...overrides }
    setStatus(next.status)
    setError('')
    opsApi.reports(next.status === 'all' ? undefined : next.status)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load() }, [])

  const submit = (values: { action: string; note?: string }): void => {
    if (!target) return
    setSubmitting(true)
    opsApi.auditReport(target.id, values)
      .then((result) => {
        message.success(result.message)
        setTarget(null)
        form.resetFields()
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSubmitting(false))
  }

  const columns: ColumnsType<Report> = [
    {
      title: '报告',
      dataIndex: 'title',
      render: (_, record) => (
        <div className="table-title-cell">
          <b>{record.title}</b>
          <span className="small muted">{record.reportNo} · {record.category} · {record.period}</span>
        </div>
      ),
    },
    { title: '页数', dataIndex: 'pageCount', width: 80 },
    {
      title: '价格',
      dataIndex: 'price',
      width: 100,
      render: (value: number, record) => (record.isFree ? '免费' : `¥${Number(value).toFixed(2)}`),
    },
    { title: '下载', dataIndex: 'downloads', width: 90, render: (value: number) => formatCount(value) },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <StatusTag status={value} /> },
    { title: '发布时间', dataIndex: 'publishedAt', width: 150, render: (value: string) => value || '—' },
    {
      title: '操作',
      width: 90,
      render: (_, record) => (
        <Button size="small" type="primary" onClick={() => { setTarget(record); form.resetFields() }}>审核</Button>
      ),
    },
  ]

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={() => load()} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="REPORT REVIEW"
        title="报告审核"
        description="报告需经审核后才对用户开放下载 · 关键结论自动上链存证 · 付费报告由平台统一结算"
      />

      <div className="grid-4">
        <StatTile label="报告总量" value={data.counts.all} unit="份" />
        <StatTile label="待审核" value={data.counts.pending} unit="份" note="承诺 1 个工作日" tone="warn" />
        <StatTile label="已发布" value={data.counts.published} unit="份" note="用户端可下载" tone="up" />
        <StatTile label="累计下载" value={formatCount(data.items.reduce((sum, item) => sum + item.downloads, 0))} unit="次" note="全平台统计" />
      </div>

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {[{ key: 'pending', label: '待审核' }, { key: 'published', label: '已发布' }, { key: 'all', label: '全部' }].map((tab) => (
            <button type="button" key={tab.key} className={`chip${status === tab.key ? ' on' : ''}`} onClick={() => load({ status: tab.key })}>
              {tab.label}
            </button>
          ))}
        </div>
        <Table rowKey="id" size="middle" columns={columns} dataSource={data.items} pagination={{ pageSize: 8, showSizeChanger: false }} />
      </section>

      <Modal
        open={Boolean(target)}
        title={`审核：${target?.title ?? ''}`}
        onCancel={() => setTarget(null)}
        onOk={() => form.submit()}
        okText="提交结论"
        confirmLoading={submitting}
      >
        {target && (
          <div className="stack" style={{ marginBottom: 12 }}>
            <p className="small muted">{target.summary}</p>
            <p className="small muted">目录：{target.sections}</p>
          </div>
        )}
        <Form form={form} layout="vertical" onFinish={submit} initialValues={{ action: 'approve' }}>
          <Form.Item name="action" label="审核结论" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="approve">通过并发布</Radio.Button>
              <Radio.Button value="reject">驳回</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="note" label="处理意见" extra="驳回时必须填写原因">
            <Input.TextArea rows={3} maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
