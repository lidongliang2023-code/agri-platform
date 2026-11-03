import { useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Select, Table, Tag, message } from 'antd'
import { ucApi } from '../api'
import { ErrorBlock, PageTitle, SectionHeading, StatusTag, formatTime } from '../components/ui'
import type { AuthRecord, ThirdPartyApp } from '../types'

const APP_TYPE_LABEL: Record<string, string> = {
  internal: '内部系统',
  partner: '合作机构',
  open: '开放平台',
}

/* ==================== 第三方应用 ==================== */

export function AuthAppPage(): JSX.Element {
  const [rows, setRows] = useState<ThirdPartyApp[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<ThirdPartyApp | null>(null)
  const [remark, setRemark] = useState('')
  const [form] = Form.useForm()

  const load = (): void => {
    setLoading(true)
    setError('')
    ucApi.authApps({ pageNum, pageSize: 20, status: status || undefined })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [pageNum, status])

  const create = (): void => {
    form.validateFields()
      .then((values: Record<string, string>) => {
        setCreating(true)
        return ucApi.createAuthApp(values)
      })
      .then(() => {
        message.success('应用已登记，等待审核上架')
        setCreateOpen(false)
        form.resetFields()
        load()
      })
      .catch((reason: Error) => {
        if (reason?.message) message.error(reason.message)
      })
      .finally(() => setCreating(false))
  }

  const review = (approved: boolean): void => {
    if (!reviewTarget) return
    ucApi.reviewAuthApp(String(reviewTarget.id), approved, remark)
      .then(() => {
        message.success(approved ? '已上架该应用' : '已驳回该应用')
        setReviewTarget(null)
        setRemark('')
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
  }

  const pendingCount = rows.filter((row) => row.status === 'pending').length

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="第三方授权"
        title="第三方应用"
        description={`已登记 ${total} 个应用 · 当前页待审 ${pendingCount} 个 · 审核通过后用户才能在其授权页看到`}
        actions={
          <>
            <Select
              value={status}
              style={{ width: 150 }}
              options={[
                { label: '全部状态', value: '' },
                { label: '待审核', value: 'pending' },
                { label: '已上架', value: 'online' },
                { label: '已驳回', value: 'rejected' },
                { label: '已下架', value: 'offline' },
              ]}
              onChange={(value) => { setStatus(value); setPageNum(1) }}
            />
            <Button type="primary" onClick={() => setCreateOpen(true)}>＋ 登记应用</Button>
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
          scroll={{ x: 1240 }}
          columns={[
            {
              title: '应用',
              dataIndex: 'appName',
              render: (value: string, row) => (
                <div>
                  <b>{value}</b>
                  <div className="small muted">{row.appKey}</div>
                </div>
              ),
            },
            {
              title: '类型',
              dataIndex: 'appType',
              width: 110,
              render: (value: string) => APP_TYPE_LABEL[value] ?? value,
            },
            { title: '申请方', dataIndex: 'applicant', width: 160, render: (value: string) => value || '—' },
            {
              title: '授权范围',
              dataIndex: 'scopes',
              render: (value: string) => (
                <div className="tag-row">
                  {(value || '').split(',').filter(Boolean).map((scope) => (
                    <Tag key={scope} className="soft-tag">{scope.trim()}</Tag>
                  ))}
                  {!value && <span className="small muted">—</span>}
                </div>
              ),
            },
            {
              title: '调用量',
              dataIndex: 'callCount',
              width: 120,
              render: (value: number, row) => (
                <div>
                  {value?.toLocaleString() ?? 0}
                  {row.lastCallAt && <div className="small muted">{formatTime(row.lastCallAt)}</div>}
                </div>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (value: string) => <StatusTag status={value} />,
            },
            {
              title: '操作',
              width: 110,
              render: (_, row) => (
                row.status === 'pending'
                  ? (
                    <Button size="small" type="primary" ghost onClick={() => setReviewTarget(row)}>
                      审核
                    </Button>
                  )
                  : <span className="small muted">{row.reviewerName || '—'}</span>
              ),
            },
          ]}
          pagination={{
            current: pageNum,
            pageSize: 20,
            total,
            showTotal: (count) => `共 ${count} 个应用`,
            onChange: (next) => setPageNum(next),
          }}
        />
      </section>

      <Modal
        open={createOpen}
        title="登记第三方应用"
        onCancel={() => setCreateOpen(false)}
        onOk={create}
        confirmLoading={creating}
        okText="提交登记"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="appKey" label="应用标识" rules={[{ required: true, message: '请填写应用标识' }]}>
            <Input placeholder="如 trace-open，小写字母与连字符" />
          </Form.Item>
          <Form.Item name="appName" label="应用名称" rules={[{ required: true, message: '请填写应用名称' }]}>
            <Input placeholder="如 溯源小程序开放接口" />
          </Form.Item>
          <Form.Item name="appType" label="应用类型" initialValue="partner">
            <Select
              options={Object.entries(APP_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="applicant" label="申请方">
            <Input placeholder="单位或团队名称" />
          </Form.Item>
          <Form.Item name="scopes" label="授权范围">
            <Input placeholder="逗号分隔，如 user:read,order:read" />
          </Form.Item>
          <Form.Item name="redirectUri" label="回调地址">
            <Input placeholder="https://example.com/cb" />
          </Form.Item>
        </Form>
        <div className="uc-inline-note">
          登记后状态为「待审核」，不会立即对用户可见。审核通过才上架 ——
          应用一旦能拿到 <code>user:read</code>，就等于能读用户的资料。
        </div>
      </Modal>

      <Modal
        open={Boolean(reviewTarget)}
        title={`应用上架审核：${reviewTarget?.appName ?? ''}`}
        onCancel={() => setReviewTarget(null)}
        footer={[
          <Button key="reject" danger onClick={() => review(false)}>驳回</Button>,
          <Button key="pass" type="primary" onClick={() => review(true)}>通过并上架</Button>,
        ]}
      >
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="small muted">
            申请方：{reviewTarget?.applicant || '—'} · 授权范围：{reviewTarget?.scopes || '—'}
          </div>
          <Input.TextArea
            rows={3}
            value={remark}
            placeholder="审核意见（驳回时建议写明原因）"
            onChange={(event) => setRemark(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}

/* ==================== 授权记录 ==================== */

export function AuthRecordPage(): JSX.Element {
  const [rows, setRows] = useState<AuthRecord[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    ucApi.authRecords({ pageNum, pageSize: 20, keyword: keyword || undefined })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [pageNum, keyword])

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="第三方授权"
        title="授权记录"
        description={`累计 ${total} 条授权流水 · 用户授权与撤回都留痕，用于合规追溯`}
      />

      {error && <ErrorBlock message={error} onRetry={() => setPageNum(pageNum)} />}

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <Input
            value={draft}
            placeholder="搜用户 / 应用名"
            style={{ width: 240 }}
            onChange={(event) => setDraft(event.target.value)}
            onPressEnter={() => { setKeyword(draft.trim()); setPageNum(1) }}
          />
          <Button type="primary" onClick={() => { setKeyword(draft.trim()); setPageNum(1) }}>搜索</Button>
        </div>
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={rows}
          columns={[
            { title: '时间', dataIndex: 'createdAt', width: 160, render: (value: string) => formatTime(value) },
            {
              title: '用户',
              dataIndex: 'userName',
              width: 160,
              render: (value: string, row) => value || `用户 ${row.userId}`,
            },
            { title: '应用', dataIndex: 'appName', render: (value: string) => value || '—' },
            {
              title: '动作',
              dataIndex: 'action',
              width: 100,
              render: (value: string) => (
                <Tag className={`soft-tag tone-${value === 'grant' ? 'green' : 'up'}`}>
                  {value === 'grant' ? '授权' : '撤回'}
                </Tag>
              ),
            },
            {
              title: '授权范围',
              dataIndex: 'scopes',
              render: (value: string) => <span className="small">{value || '—'}</span>,
            },
            { title: 'IP', dataIndex: 'ip', width: 140, render: (value: string) => value || '—' },
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

      <section className="surface-card">
        <SectionHeading kicker="说明" title="这张表和用户端「授权管理」的关系" />
        <div className="small muted" style={{ lineHeight: 1.9 }}>
          用户端「第三方授权」页读的是 <code>platform_user_binding</code> 的**当前绑定态**（现在授了谁）；
          本页读的是 <code>uc_third_party_auth_record</code> 的**历史流水**（什么时候授的、什么时候撤的）。
          两者不能合并：绑定态会被覆盖，而合规要求授权历史可追溯。
        </div>
      </section>
    </div>
  )
}
