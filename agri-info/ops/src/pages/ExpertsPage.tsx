import { useEffect, useState } from 'react'
import { Button, Drawer, Form, Input, Modal, Radio, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { opsApi } from '../api'
import type { Expert, ExpertsAdmin } from '../types'
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, StatusTag, formatCount } from '../components/ui'

/**
 * 专家审核：核验证书编号与执业单位，通过后专家在用户端展示认证标识并可接单答疑。
 * 驳回必须写原因，用户端「专家认证」页会展示该意见。
 */
export function ExpertsPage(): JSX.Element {
  const [data, setData] = useState<ExpertsAdmin | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('pending')
  const [detail, setDetail] = useState<Expert | null>(null)
  const [target, setTarget] = useState<Expert | null>(null)
  const [form] = Form.useForm<{ action: string; note?: string }>()
  const [submitting, setSubmitting] = useState(false)

  const load = (overrides: Partial<{ status: string }> = {}): void => {
    const next = { status, ...overrides }
    setStatus(next.status)
    setError('')
    opsApi.experts(next.status === 'all' ? undefined : next.status)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load() }, [])

  const submit = (values: { action: string; note?: string }): void => {
    if (!target) return
    setSubmitting(true)
    opsApi.auditExpert(target.id, values)
      .then((result) => {
        message.success(result.message)
        setTarget(null)
        form.resetFields()
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSubmitting(false))
  }

  const columns: ColumnsType<Expert> = [
    {
      title: '专家',
      dataIndex: 'name',
      render: (_, record) => (
        <div className="row" style={{ gap: 8 }}>
          <span className="expert-avatar">{record.name.slice(0, 1)}</span>
          <div className="table-title-cell">
            <b>{record.name}</b>
            <span className="small muted">{record.title} · {record.orgName}</span>
          </div>
        </div>
      ),
    },
    { title: '领域', dataIndex: 'field', width: 110 },
    { title: '区域', dataIndex: 'region', width: 110 },
    { title: '证书编号', dataIndex: 'certNo', width: 140 },
    { title: '等级', dataIndex: 'level', width: 100, render: (value: string) => <Tag className="soft-tag">{value}</Tag> },
    { title: '答疑', dataIndex: 'answerCount', width: 80 },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <StatusTag status={value} /> },
    { title: '提交时间', dataIndex: 'applyAt', width: 120 },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <div className="row" style={{ gap: 6 }}>
          <Button size="small" onClick={() => setDetail(record)}>详情</Button>
          <Button size="small" type="primary" onClick={() => { setTarget(record); form.resetFields() }}>审核</Button>
        </div>
      ),
    },
  ]

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={() => load()} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="EXPERT REVIEW"
        title="专家审核"
        description="核验职称证书、执业单位与领域匹配度 · 通过后展示认证标识并开放接单 · 承诺 3 个工作日内完成"
      />

      <div className="grid-4">
        <StatTile label="申请总量" value={data.counts.all} unit="位" />
        <StatTile label="待审核" value={data.counts.pending} unit="位" note="3 个工作日内处理" tone="warn" />
        <StatTile label="已通过" value={data.counts.approved} unit="位" note="用户端可咨询" tone="up" />
        <StatTile label="未通过" value={data.counts.rejected} unit="位" note="可补充材料后重申" />
      </div>

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 12 }}>
          {[{ key: 'pending', label: '待审核' }, { key: 'approved', label: '已通过' }, { key: 'rejected', label: '未通过' }, { key: 'all', label: '全部' }].map((tab) => (
            <button type="button" key={tab.key} className={`chip${status === tab.key ? ' on' : ''}`} onClick={() => load({ status: tab.key })}>
              {tab.label}
            </button>
          ))}
        </div>
        <Table rowKey="id" size="middle" columns={columns} dataSource={data.items} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 1120 }} />
      </section>

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} width={540} title={detail ? `${detail.name} · ${detail.title}` : ''}>
        {detail && (
          <div className="stack">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Tag className="soft-tag tone-green">{detail.level}</Tag>
              <Tag className="soft-tag">{detail.field}</Tag>
              <Tag className="soft-tag">{detail.region}</Tag>
              <StatusTag status={detail.status} />
            </div>
            <p className="small">{detail.intro}</p>
            <div className="kv-list">
              <div className="kv"><span>所在单位</span><b>{detail.orgName}</b></div>
              <div className="kv"><span>证书编号</span><b>{detail.certNo}</b></div>
              <div className="kv"><span>累计答疑</span><b>{detail.answerCount} 条</b></div>
              <div className="kv"><span>用户评分</span><b>{Number(detail.rating).toFixed(1)} 分</b></div>
              <div className="kv"><span>关注人数</span><b>{formatCount(detail.followers)} 人</b></div>
              <div className="kv"><span>申请账号</span><b>{detail.owner}</b></div>
              <div className="kv"><span>提交时间</span><b>{detail.applyAt}</b></div>
              {detail.auditAt && <div className="kv"><span>审核时间</span><b>{detail.auditAt}</b></div>}
            </div>
            {detail.auditNote && <p className="source-note">审核意见：{detail.auditNote}</p>}
            <SectionHeading kicker="VERIFY" title="资质核验要点" />
            <ul className="safety-list">
              <li>证书编号格式应为「省份缩写-年份-序号」，与发证单位匹配。</li>
              <li>执业单位需为农业技术推广、科研院所或具备培训资质的机构。</li>
              <li>领域与历史答疑内容应一致，避免跨领域误导农户。</li>
            </ul>
            <Button type="primary" onClick={() => { setDetail(null); setTarget(detail); form.resetFields() }}>审核该专家</Button>
          </div>
        )}
      </Drawer>

      <Modal
        open={Boolean(target)}
        title={`专家审核：${target?.name ?? ''}`}
        onCancel={() => setTarget(null)}
        onOk={() => form.submit()}
        okText="提交结论"
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical" onFinish={submit} initialValues={{ action: 'approve' }}>
          <Form.Item name="action" label="审核结论" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="approve">通过认证</Radio.Button>
              <Radio.Button value="reject">驳回</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="note" label="审核意见" extra="驳回时必须填写原因，申请人可在「专家认证」页看到">
            <Input.TextArea rows={4} maxLength={200} showCount placeholder="例：证书编号与发证单位不匹配，请补充职称证书扫描件" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
