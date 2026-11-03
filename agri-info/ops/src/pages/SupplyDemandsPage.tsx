import { useEffect, useState } from 'react'
import { Button, Drawer, Form, Input, Modal, Radio, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { opsApi } from '../api'
import type { SupplyDemand, SupplyDemandsAdmin } from '../types'
import { ErrorBlock, LoadingBlock, PageTitle, StatTile, StatusTag } from '../components/ui'

/**
 * 供需审核：审核通过后信息才在用户端大厅展示并参与 AI 撮合，
 * 因此这里是信息质量的关键闸门；联系方式脱敏展示，防止运营侧泄露。
 */
export function SupplyDemandsPage(): JSX.Element {
  const [data, setData] = useState<SupplyDemandsAdmin | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('pending')
  const [keyword, setKeyword] = useState('')
  const [detail, setDetail] = useState<SupplyDemand | null>(null)
  const [auditTarget, setAuditTarget] = useState<SupplyDemand | null>(null)
  const [form] = Form.useForm<{ action: string; note?: string }>()
  const [submitting, setSubmitting] = useState(false)

  const load = (overrides: Partial<{ status: string; keyword: string }> = {}): void => {
    const next = { status, keyword, ...overrides }
    setStatus(next.status)
    setKeyword(next.keyword)
    setError('')
    opsApi.supplyDemands({
      status: next.status === 'all' ? undefined : next.status,
      keyword: next.keyword || undefined,
    })
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load() }, [])

  const submit = (values: { action: string; note?: string }): void => {
    if (!auditTarget) return
    setSubmitting(true)
    opsApi.auditSupplyDemand(auditTarget.id, values, auditTarget.sdType)
      .then((result) => {
        message.success(result.message)
        setAuditTarget(null)
        form.resetFields()
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSubmitting(false))
  }

  const columns: ColumnsType<SupplyDemand> = [
    {
      title: '信息',
      dataIndex: 'title',
      render: (_, record) => (
        <div className="table-title-cell">
          <b>{record.title}</b>
          <span className="small muted">{record.sdNo} · {record.orgName} · {record.createdAt}</span>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'sdType',
      width: 80,
      render: (value: string) => <Tag className={`soft-tag ${value === 'supply' ? 'tone-green' : 'tone-blue'}`}>{value === 'supply' ? '供应' : '需求'}</Tag>,
    },
    { title: '品类', dataIndex: 'category', width: 80 },
    {
      title: '价格',
      dataIndex: 'price',
      width: 130,
      render: (value: number, record) => `${Number(value).toFixed(2)} ${record.priceUnit}`,
    },
    { title: '数量', dataIndex: 'quantity', width: 130 },
    { title: '产地', dataIndex: 'origin', width: 140 },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <StatusTag status={value} /> },
    {
      title: '操作',
      width: 160,
      render: (_, record) => (
        <div className="row" style={{ gap: 6 }}>
          <Button size="small" onClick={() => setDetail(record)}>详情</Button>
          <Button size="small" type="primary" onClick={() => { setAuditTarget(record); form.resetFields() }}>审核</Button>
        </div>
      ),
    },
  ]

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={() => load()} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="SUPPLY & DEMAND REVIEW"
        title="供需审核"
        description="审核对象直接来自交易撮合：供应=卖家中心商品，需求=买家中心采购需求 · 审核通过后才会在大厅展示 · 承诺 2 小时内完成"
      />

      <div className="grid-4">
        <StatTile label="信息总量" value={data.counts.all} unit="条" note="含历史归档" />
        <StatTile label="待审核" value={data.counts.pending} unit="条" note="承诺 2 小时内处理" tone="warn" />
        <StatTile label="在线" value={data.counts.online} unit="条" note="大厅可见" tone="up" />
        <StatTile label="已下架" value={data.counts.offline} unit="条" note="过期或违规" />
      </div>

      <section className="surface-card">
        <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div className="chip-row">
            {[{ key: 'pending', label: '待审核' }, { key: 'online', label: '在线' }, { key: 'offline', label: '已下架' }, { key: 'all', label: '全部' }].map((tab) => (
              <button type="button" key={tab.key} className={`chip${status === tab.key ? ' on' : ''}`} onClick={() => load({ status: tab.key })}>
                {tab.label}
              </button>
            ))}
          </div>
          <Input.Search
            allowClear
            style={{ width: 240 }}
            placeholder="搜索标题 / 主体 / 编号"
            defaultValue={keyword}
            onSearch={(value) => load({ keyword: value.trim() })}
          />
        </div>

        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={data.items}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: 1180 }}
        />
      </section>

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} width={560} title={detail?.title ?? ''}>
        {detail && (
          <div className="stack">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Tag className={`soft-tag ${detail.sdType === 'supply' ? 'tone-green' : 'tone-blue'}`}>{detail.sdType === 'supply' ? '供应' : '需求'}</Tag>
              <StatusTag status={detail.status} />
              {detail.verified && <Tag className="soft-tag tone-green">已认证</Tag>}
              {detail.badge && detail.badge !== '—' && <Tag className="soft-tag tone-amber">{detail.badge}</Tag>}
            </div>
            <div className="kv-list">
              <div className="kv"><span>信息编号</span><b>{detail.sdNo}</b></div>
              <div className="kv"><span>发布主体</span><b>{detail.orgName}（{detail.orgType}）</b></div>
              <div className="kv"><span>发布账号</span><b>{detail.owner}</b></div>
              <div className="kv"><span>联系人</span><b>{detail.contactName} · {detail.contactPhone}</b></div>
              <div className="kv"><span>规格</span><b>{detail.spec || '—'}</b></div>
              <div className="kv"><span>数量</span><b>{detail.quantity}</b></div>
              <div className="kv"><span>报价</span><b>{Number(detail.price).toFixed(2)} {detail.priceUnit}</b></div>
              <div className="kv"><span>产地</span><b>{detail.origin}</b></div>
              <div className="kv"><span>行情参照</span><b>{detail.marketRef}</b></div>
              <div className="kv"><span>有效期</span><b>{detail.availableDate} 起 {detail.durationDays} 天（至 {detail.expireDate}）</b></div>
              <div className="kv"><span>浏览 / 沟通</span><b>{detail.viewCount} / {detail.chatCount}</b></div>
            </div>
            {detail.auditNote && <p className="source-note">审核意见：{detail.auditNote}</p>}
            <Button type="primary" onClick={() => { setDetail(null); setAuditTarget(detail); form.resetFields() }}>审核该信息</Button>
          </div>
        )}
      </Drawer>

      <Modal
        open={Boolean(auditTarget)}
        title={`审核：${auditTarget?.title ?? ''}`}
        onCancel={() => setAuditTarget(null)}
        onOk={() => form.submit()}
        okText="提交结论"
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical" onFinish={submit} initialValues={{ action: 'approve' }}>
          <Form.Item name="action" label="审核结论" rules={[{ required: true }]}>
            {/* 供应=商品货源，有真正的审核环节；采购需求发布即可见，运营只能下架或恢复。 */}
            {auditTarget?.sdType === 'demand' ? (
              <Radio.Group>
                <Radio.Button value="approve">恢复展示</Radio.Button>
                <Radio.Button value="offline">下架</Radio.Button>
              </Radio.Group>
            ) : (
              <Radio.Group>
                <Radio.Button value="approve">通过并上线</Radio.Button>
                <Radio.Button value="reject">驳回</Radio.Button>
                <Radio.Button value="offline">下架</Radio.Button>
              </Radio.Group>
            )}
          </Form.Item>
          <Form.Item name="note" label="处理意见" extra="驳回或下架时必须填写原因，发布者可在「我的发布」中看到">
            <Input.TextArea rows={4} maxLength={200} showCount placeholder="例：报价明显高于平台监测价 60%，请补充规格说明后重新提交" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
