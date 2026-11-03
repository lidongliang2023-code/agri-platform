import { useEffect, useState } from 'react'
import { Button, Drawer, Form, Input, Modal, Radio, Select, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { opsApi } from '../api'
import { useApp } from '../app-context'
import type { Article, Contents } from '../types'
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageTitle,
  SectionHeading,
  StatTile,
  StatusTag,
  formatCount,
  riskLabel,
  statusLabel,
} from '../components/ui'

const STATUS_TABS = [
  // 草稿原先没有页签：点一次「退回修改」，这条稿子就从四个页签里全部消失（数据还在库里，只是没人看得见）
  { key: 'draft', label: '草稿' },
  { key: 'pending', label: '待审核' },
  { key: 'published', label: '已发布' },
  { key: 'rejected', label: '未通过' },
  { key: 'offline', label: '已下架' },
  { key: 'all', label: '全部' },
]

/** 页签上的数字直接取后端 counts，不在前端再数一遍当前一页 */
const countOf = (counts: Contents['counts'], key: string): number =>
  (counts as unknown as Record<string, number>)[key] ?? 0

/**
 * 内容审核：按状态/栏目/关键词筛选，支持通过、驳回、退回修改、转专家复核与下架。
 * 驳回与退回必须填处理意见，与后端校验保持一致。
 */
export function ContentsPage(): JSX.Element {
  const { navigate } = useApp()
  const [data, setData] = useState<Contents | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('pending')
  const [channel, setChannel] = useState('全部栏目')
  const [keyword, setKeyword] = useState('')
  const [detail, setDetail] = useState<Article | null>(null)
  const [auditTarget, setAuditTarget] = useState<Article | null>(null)
  const [auditForm] = Form.useForm<{ action: string; note?: string }>()
  const [submitting, setSubmitting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm<Record<string, string>>()

  const load = (overrides: Partial<{ status: string; channel: string; keyword: string }> = {}): void => {
    const next = { status, channel, keyword, ...overrides }
    setStatus(next.status)
    setChannel(next.channel)
    setKeyword(next.keyword)
    setError('')
    opsApi.contents({
      status: next.status === 'all' ? undefined : next.status,
      channel: next.channel === '全部栏目' ? undefined : next.channel,
      keyword: next.keyword || undefined,
    })
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load() }, [])

  /**
   * 打开审核弹窗。默认结论按当前状态给：草稿/未通过的内容默认是「提交审核」，
   * 而不是一进来就选中「通过并发布」—— 后者会让运营员在没注意的情况下把没审过的稿子直接上线。
   */
  const openAudit = (article: Article): void => {
    setAuditTarget(article)
    auditForm.resetFields()
    auditForm.setFieldsValue({
      action: article.status === 'draft' || article.status === 'rejected' ? 'submit' : 'approve',
    })
  }

  const submitAudit = (values: { action: string; note?: string }): void => {
    if (!auditTarget) return
    setSubmitting(true)
    opsApi.auditContent(auditTarget.id, values)
      .then((result) => {
        message.success(result.message)
        setAuditTarget(null)
        auditForm.resetFields()
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSubmitting(false))
  }

  const columns: ColumnsType<Article> = [
    {
      title: '内容',
      dataIndex: 'title',
      render: (_, record) => (
        <div className="table-title-cell">
          <b>{record.coverIcon} {record.title}</b>
          <span className="small muted">{record.articleNo} · {record.author} · {record.publishedAt || '待发布'}</span>
        </div>
      ),
    },
    { title: '栏目', dataIndex: 'channel', width: 100 },
    { title: '形态', dataIndex: 'contentType', width: 80 },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      width: 90,
      render: (value: string) => {
        const risk = riskLabel(value)
        return <Tag className={`soft-tag tone-${risk.tone}`}>{risk.label}</Tag>
      },
    },
    { title: '阅读', dataIndex: 'readCount', width: 90, render: (value: number) => formatCount(value) },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <StatusTag status={value} /> },
    {
      title: '操作',
      width: 190,
      render: (_, record) => (
        <div className="row" style={{ gap: 6 }}>
          <Button size="small" onClick={() => setDetail(record)}>详情</Button>
          <Button size="small" type="primary" onClick={() => openAudit(record)}>审核</Button>
          {record.status === 'published' && (
            <Button size="small" danger onClick={() => {
              Modal.confirm({
                title: '确认下架该内容？',
                content: '下架后用户端立即不可见，需填写下架原因。',
                onOk: () => opsApi.offlineContent(record.id, { note: '运营人工下架' })
                  .then((result) => { message.success(result.message); load() })
                  .catch((reason: Error) => message.error(reason.message)),
              })
            }}>
              下架
            </Button>
          )}
        </div>
      ),
    },
  ]

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={() => load()} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="CONTENT REVIEW"
        title="内容审核"
        description="机器预审 + 人工复核双闸门 · 高风险内容必须人工通过 · 审核结论与操作人全部留痕"
        actions={
          <>
            <Button onClick={() => navigate('channels')}>栏目与作者</Button>
            <Button type="primary" onClick={() => setCreateOpen(true)}>＋ 新建内容</Button>
          </>
        }
      />

      <div className="grid-4">
        <StatTile label="内容总量" value={data.counts.all} unit="篇" note="全栏目合计" />
        <StatTile label="待审核" value={data.counts.pending} unit="篇" note="承诺 2 小时内处理" tone="warn" />
        <StatTile label="已发布" value={data.counts.published} unit="篇" note="用户端可见" tone="up" />
        <StatTile label="未通过 / 已下架" value={`${data.counts.rejected} / ${data.counts.offline}`} unit="篇" note="保留审计轨迹" />
      </div>

      <section className="surface-card">
        <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div className="chip-row">
            {STATUS_TABS.map((tab) => (
              <button type="button" key={tab.key} className={`chip${status === tab.key ? ' on' : ''}`} onClick={() => load({ status: tab.key })}>
                {tab.label} {countOf(data.counts, tab.key)}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <select className="chip" value={channel} onChange={(event) => load({ channel: event.target.value })}>
              {['全部栏目', ...data.channels].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Input.Search
              allowClear
              style={{ width: 220 }}
              placeholder="搜索标题 / 作者"
              defaultValue={keyword}
              onSearch={(value) => load({ keyword: value.trim() })}
            />
          </div>
        </div>

        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={data.items}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: <EmptyState icon="📄" title="没有符合条件的内容" description="切换状态或清空筛选条件试试。" /> }}
        />
      </section>

      <Drawer open={Boolean(detail)} onClose={() => setDetail(null)} width={620} title={detail?.title ?? ''}>
        {detail && (
          <div className="stack">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Tag className="soft-tag tone-green">{detail.channel}</Tag>
              <Tag className="soft-tag">{detail.contentType}</Tag>
              <StatusTag status={detail.status} />
              {detail.aiGenerated && <Tag className="soft-tag tone-purple">AI 生成</Tag>}
              {detail.isTop && <Tag className="soft-tag tone-amber">置顶</Tag>}
            </div>
            <div className="kv-list">
              <div className="kv"><span>内容编号</span><b>{detail.articleNo}</b></div>
              <div className="kv"><span>作者</span><b>{detail.author}</b></div>
              <div className="kv"><span>来源</span><b>{detail.source}</b></div>
              <div className="kv"><span>发布时间</span><b>{detail.publishedAt || '待发布'}</b></div>
              <div className="kv"><span>互动数据</span><b>阅读 {formatCount(detail.readCount)} · 赞 {detail.likeCount} · 评 {detail.commentCount}</b></div>
            </div>
            <SectionHeading kicker="SUMMARY" title="摘要" />
            <p className="small">{detail.summary}</p>
            {detail.riskNote && (
              <p className="source-note">机器预审风险提示：{detail.riskNote}</p>
            )}
            {detail.auditNote && <p className="source-note">历史审核意见：{detail.auditNote}</p>}
            <Button type="primary" onClick={() => { setDetail(null); openAudit(detail) }}>审核该内容</Button>
          </div>
        )}
      </Drawer>

      <Modal
        open={Boolean(auditTarget)}
        title={`审核：${auditTarget?.title ?? ''}`}
        onCancel={() => setAuditTarget(null)}
        onOk={() => auditForm.submit()}
        okText="提交结论"
        confirmLoading={submitting}
      >
        <Form form={auditForm} layout="vertical" onFinish={submitAudit} initialValues={{ action: 'approve' }}>
          <p className="source-note">
            当前状态：<b>{statusLabel(auditTarget?.status ?? '') || '未知'}</b>。
            能不能上线由服务端按状态流转判定，不合法的结论会被拒绝并说明原因（编辑内容不会改变状态）。
          </p>
          <Form.Item name="action" label="审核结论" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="submit">提交审核</Radio.Button>
              <Radio.Button value="approve">通过并发布</Radio.Button>
              <Radio.Button value="reject">驳回</Radio.Button>
              <Radio.Button value="revise">退回修改</Radio.Button>
              <Radio.Button value="expert">转专家复核</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="note"
            label="处理意见"
            extra="驳回或退回修改时必须填写具体原因，作者可在用户端看到该意见"
          >
            <Input.TextArea rows={4} maxLength={200} showCount placeholder="例：标题含极限词「最便宜」，请修改后重新提交" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={createOpen}
        title="新建内容"
        width={620}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="保存"
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ contentType: '图文', status: 'pending' }}
          onFinish={(values) => {
            opsApi.saveContent({ ...values, tags: values.tags ?? '' })
              .then((result) => {
                message.success(result.message)
                setCreateOpen(false)
                createForm.resetFields()
                load()
              })
              .catch((reason: Error) => message.error(reason.message))
          }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写标题' }]}>
            <Input placeholder="例：大蒜价格周度分析" />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="channel" label="所属栏目" rules={[{ required: true, message: '请选择栏目' }]}>
              <Select options={data.channels.map((item) => ({ value: item, label: item }))} />
            </Form.Item>
            <Form.Item name="contentType" label="内容形态" rules={[{ required: true }]}>
              <Select options={['图文', '短视频', '直播', '专题'].map((item) => ({ value: item, label: item }))} />
            </Form.Item>
            <Form.Item name="author" label="作者">
              <Input placeholder="默认取当前运营账号" />
            </Form.Item>
            <Form.Item name="tags" label="标签（逗号分隔）">
              <Input placeholder="例：大蒜,行情分析,价格周报" />
            </Form.Item>
          </div>
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={2} maxLength={120} showCount />
          </Form.Item>
          {/*
            新建只能落在这两档：后端会拒掉其它 status（原先传 published 就能跳过审核直接上线）。
            没有这个控件时运营员只能全部送审，「退回修改」改完也没法先存草稿。
          */}
          <Form.Item name="status" label="保存方式" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="pending">提交审核</Radio.Button>
              <Radio.Button value="draft">存为草稿</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="content" label="正文">
            <Input.TextArea rows={6} placeholder="支持纯文本；正式版接入富文本编辑器" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
