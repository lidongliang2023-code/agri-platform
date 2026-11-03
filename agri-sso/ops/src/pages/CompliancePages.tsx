import { useEffect, useState } from 'react'
import { Button, Descriptions, Input, Modal, Select, Table, Tag, message } from 'antd'
import { ucApi } from '../api'
import { ErrorBlock, PageTitle, SectionHeading, StatusTag, formatTime } from '../components/ui'
import type { FeedbackRecord, PrivacyRecord } from '../types'

const REQUEST_TYPE_LABEL: Record<string, string> = {
  export: '数据导出',
  deletion: '账号注销',
}

const FEEDBACK_TYPE_LABEL: Record<string, string> = {
  suggestion: '建议',
  bug: '缺陷',
  complaint: '投诉',
  other: '其他',
}

/* ==================== 隐私请求处理 ==================== */

export function PrivacyRequestPage(): JSX.Element {
  const [rows, setRows] = useState<PrivacyRecord[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [target, setTarget] = useState<PrivacyRecord | null>(null)
  const [nextStatus, setNextStatus] = useState('processing')
  const [remark, setRemark] = useState('')

  const load = (): void => {
    setLoading(true)
    setError('')
    ucApi.privacyRequests({ pageNum, pageSize: 20, status: status || undefined })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [pageNum, status])

  const submit = (): void => {
    if (!target) return
    ucApi.handlePrivacy(String(target.id), nextStatus, remark)
      .then(() => {
        message.success('已更新处理状态')
        setTarget(null)
        setRemark('')
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="合规服务"
        title="隐私请求处理"
        description="数据导出与账号注销申请 · 法规要求 15 个工作日内答复，本页按提交时间正序排列"
        actions={
          <Select
            value={status}
            style={{ width: 150 }}
            options={[
              { label: '待处理', value: 'pending' },
              { label: '处理中', value: 'processing' },
              { label: '已完成', value: 'completed' },
              { label: '已驳回', value: 'rejected' },
              { label: '全部', value: '' },
            ]}
            onChange={(value) => { setStatus(value); setPageNum(1) }}
          />
        }
      />

      {error && <ErrorBlock message={error} onRetry={load} />}

      <section className="surface-card">
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1080 }}
          columns={[
            { title: '提交时间', dataIndex: 'createdAt', width: 160, render: (value: string) => formatTime(value) },
            {
              title: '类型',
              dataIndex: 'requestType',
              width: 120,
              render: (value: string) => (
                <Tag className="soft-tag">{REQUEST_TYPE_LABEL[value] ?? value}</Tag>
              ),
            },
            { title: '申请人', dataIndex: 'userId', width: 200, render: (value: string) => `用户 ${value}` },
            { title: '理由 / 范围', dataIndex: 'reason', render: (value: string, row) => (
              <div>
                {value || '—'}
                {row.scope && <div className="small muted">范围：{row.scope}</div>}
              </div>
            ) },
            {
              title: '状态',
              dataIndex: 'status',
              width: 110,
              render: (value: string) => <StatusTag status={value} />,
            },
            { title: '处理人', dataIndex: 'handlerName', width: 110, render: (value: string) => value || '—' },
            {
              title: '操作',
              width: 100,
              render: (_, row) => (
                ['pending', 'processing'].includes(row.status)
                  ? (
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      onClick={() => {
                        setTarget(row)
                        setNextStatus(row.status === 'pending' ? 'processing' : 'completed')
                        setRemark('')
                      }}
                    >
                      处理
                    </Button>
                  )
                  : <span className="small muted">{formatTime(row.handleTime)}</span>
              ),
            },
          ]}
          pagination={{
            current: pageNum,
            pageSize: 20,
            total,
            showTotal: (count) => `共 ${count} 件`,
            onChange: (next) => setPageNum(next),
          }}
        />
      </section>

      <section className="surface-card">
        <SectionHeading kicker="边界说明" title="这张表只记录流转，不假装已经执行" />
        <div className="small muted" style={{ lineHeight: 1.9 }}>
          数据导出要跨多个业务库取数、账号注销要连带处理主体归属与结算，系统目前能自动做的只有
          「收单 + 流转状态」。所以这里标记「已完成」表示**人工已办结**，不代表系统自动打包了数据。
          真要自动化，得先有跨库导出任务与注销编排，属独立改造。
        </div>
      </section>

      <Modal
        open={Boolean(target)}
        title={`处理隐私请求：${target ? REQUEST_TYPE_LABEL[target.requestType] ?? target.requestType : ''}`}
        onCancel={() => setTarget(null)}
        onOk={submit}
        okText="保存处理结果"
      >
        <div className="stack" style={{ marginTop: 12 }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="申请理由">{target?.reason || '—'}</Descriptions.Item>
            <Descriptions.Item label="范围">{target?.scope || '—'}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{formatTime(target?.createdAt)}</Descriptions.Item>
          </Descriptions>
          <Select
            value={nextStatus}
            style={{ width: '100%' }}
            options={[
              { label: '标记为处理中', value: 'processing' },
              { label: '标记为已完成', value: 'completed' },
              { label: '驳回', value: 'rejected' },
            ]}
            onChange={setNextStatus}
          />
          <Input.TextArea
            rows={3}
            value={remark}
            placeholder="处理说明（会同步给申请人）"
            onChange={(event) => setRemark(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}

/* ==================== 反馈处理 ==================== */

export function FeedbackPage(): JSX.Element {
  const [rows, setRows] = useState<FeedbackRecord[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [status, setStatus] = useState('pending')
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [target, setTarget] = useState<FeedbackRecord | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const load = (): void => {
    setLoading(true)
    setError('')
    ucApi.feedbacks({ pageNum, pageSize: 20, status: status || undefined, type: type || undefined })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [pageNum, status, type])

  const submit = (): void => {
    if (!target) return
    if (!reply.trim()) {
      message.warning('请填写回复内容')
      return
    }
    setSending(true)
    ucApi.replyFeedback(target.id, reply.trim())
      .then(() => {
        message.success('已回复，用户会在消息中心收到通知')
        setTarget(null)
        setReply('')
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSending(false))
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="合规服务"
        title="反馈处理"
        description={`${total} 条反馈 · 回复后用户端「意见反馈」与消息中心同时可见`}
        actions={
          <>
            <Select
              value={status}
              style={{ width: 140 }}
              options={[
                { label: '待回复', value: 'pending' },
                { label: '已回复', value: 'replied' },
                { label: '已关闭', value: 'closed' },
                { label: '全部', value: '' },
              ]}
              onChange={(value) => { setStatus(value); setPageNum(1) }}
            />
            <Select
              value={type}
              style={{ width: 130 }}
              options={[
                { label: '全部类型', value: '' },
                ...Object.entries(FEEDBACK_TYPE_LABEL).map(([value, label]) => ({ value, label })),
              ]}
              onChange={(value) => { setType(value); setPageNum(1) }}
            />
          </>
        }
      />

      {error && <ErrorBlock message={error} onRetry={load} />}

      <section className="surface-card">
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1060 }}
          columns={[
            { title: '提交时间', dataIndex: 'createdAt', width: 160, render: (value: string) => formatTime(value) },
            {
              title: '类型',
              dataIndex: 'feedbackType',
              width: 100,
              render: (value: string) => (
                <Tag className="soft-tag">{FEEDBACK_TYPE_LABEL[value] ?? value}</Tag>
              ),
            },
            {
              title: '标题 / 内容',
              dataIndex: 'title',
              render: (value: string, row) => (
                <div>
                  <b>{value}</b>
                  <div className="small muted">{(row.content || '').slice(0, 60)}</div>
                </div>
              ),
            },
            { title: '联系方式', dataIndex: 'contact', width: 150, render: (value: string) => value || '—' },
            { title: '来源页面', dataIndex: 'pagePath', width: 160, render: (value: string) => (
              <span className="small muted">{value || '—'}</span>
            ) },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (value: string) => <StatusTag status={value} />,
            },
            {
              title: '操作',
              width: 100,
              render: (_, row) => (
                row.status !== 'closed'
                  ? (
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      onClick={() => { setTarget(row); setReply(row.replyContent ?? '') }}
                    >
                      {row.status === 'replied' ? '再回复' : '回复'}
                    </Button>
                  )
                  : <span className="small muted">已关闭</span>
              ),
            },
          ]}
          pagination={{
            current: pageNum,
            pageSize: 20,
            total,
            showTotal: (count) => `共 ${count} 条`,
            onChange: (next) => setPageNum(next),
          }}
        />
      </section>

      <Modal
        open={Boolean(target)}
        title={`回复反馈：${target?.title ?? ''}`}
        onCancel={() => setTarget(null)}
        onOk={submit}
        confirmLoading={sending}
        okText="发送回复"
      >
        <div className="stack" style={{ marginTop: 12 }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="用户反馈">{target?.content || '—'}</Descriptions.Item>
            <Descriptions.Item label="联系方式">{target?.contact || '—'}</Descriptions.Item>
            <Descriptions.Item label="来源页面">{target?.pagePath || '—'}</Descriptions.Item>
          </Descriptions>
          <Input.TextArea
            rows={4}
            value={reply}
            placeholder="回复内容会推送到用户消息中心"
            onChange={(event) => setReply(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}
