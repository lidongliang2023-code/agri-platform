import { useEffect, useState } from 'react'
import { Button, Checkbox, Form, Input, Modal, Select, Table, Tag, message } from 'antd'
import { ucApi } from '../api'
import {
  AUDIENCE_LABEL,
  ErrorBlock,
  PageTitle,
  SCENE_LABEL,
  SectionHeading,
  StatusTag,
  channelText,
  formatTime,
} from '../components/ui'
import type { MessageTemplate, PushTask } from '../types'

const CHANNEL_OPTIONS = [
  { label: '站内信', value: 'station' },
  { label: '微信服务通知', value: 'wechat' },
  { label: '短信', value: 'sms' },
  { label: 'APP 推送', value: 'app' },
]

const AUDIENCE_OPTIONS = Object.entries(AUDIENCE_LABEL).map(([value, label]) => ({ value, label }))

/* ==================== 消息推送 ==================== */

export function MessagePushPage(): JSX.Element {
  const [rows, setRows] = useState<PushTask[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  // 预估触达：选完人群立刻查，避免手滑全量群发
  const [preview, setPreview] = useState<{ audience: string; count: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  // 有任务在投递中就持续轮询，投完自动停
  const [polling, setPolling] = useState(false)
  const [form] = Form.useForm()
  const audience = Form.useWatch('audience', form) as string | undefined

  const load = (silent = false): void => {
    if (!silent) {
      setLoading(true)
      setError('')
    }
    ucApi.pushes({ pageNum, pageSize: 10 })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
        // 队列里还有 queued / sending 就继续轮询
        setPolling(data.records.some((row) => row.status === 'queued' || row.status === 'sending'))
      })
      .catch((reason: Error) => {
        if (!silent) setError(reason.message)
      })
      .finally(() => {
        if (!silent) setLoading(false)
      })
  }

  useEffect(load, [pageNum])

  // 轮询：只在有在投任务时跑，2 秒一次，组件卸载或投完即停
  useEffect(() => {
    if (!polling) return undefined
    const timer = window.setInterval(() => load(true), 2000)
    return () => window.clearInterval(timer)
  }, [polling])

  useEffect(() => {
    ucApi.templates()
      .then(setTemplates)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!audience) return
    setPreviewLoading(true)
    ucApi.audienceCount(audience)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false))
  }, [audience])

  /** 选模板自动带出标题与正文，省得运营重写一遍。 */
  const applyTemplate = (code: string): void => {
    const hit = templates.find((item) => item.code === code)
    if (!hit) return
    form.setFieldsValue({ title: hit.title, content: hit.content })
  }

  const send = (): void => {
    form.validateFields()
      .then((values: {
        title?: string
        content?: string
        templateCode?: string
        audience: string
        channels: string[]
      }) => {
        setSending(true)
        return ucApi.sendPush({ ...values, channels: (values.channels ?? []).join(',') })
      })
      .then((result) => {
        message.success(result.message)
        form.resetFields()
        form.setFieldsValue({ audience: 'all', channels: ['station'] })
        load()
      })
      .catch((reason: Error) => {
        if (reason?.message) message.error(reason.message)
      })
      .finally(() => setSending(false))
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="消息中心"
        title="消息推送"
        description={`累计推送 ${total} 次 · 入队后由后台按批投递，站内信真实写入用户端「消息中心」`}
      />

      {error && <ErrorBlock message={error} onRetry={() => load()} />}

      <div className="grid-main-aside">
        <section className="surface-card">
          <SectionHeading kicker="新建推送" title="目标人群与内容" />
          <Form
            form={form}
            layout="vertical"
            initialValues={{ audience: 'all', channels: ['station'] }}
          >
            <Form.Item name="audience" label="目标人群" rules={[{ required: true }]}>
              <Select options={AUDIENCE_OPTIONS} />
            </Form.Item>
            <Form.Item name="templateCode" label="消息模板（可选，选中自动填充标题与正文）">
              <Select
                allowClear
                placeholder="不使用模板"
                options={templates.map((item) => ({
                  value: item.code,
                  label: `${item.code} · ${item.title}`,
                }))}
                onChange={(value) => value && applyTemplate(value)}
              />
            </Form.Item>
            <Form.Item name="channels" label="推送渠道">
              <Checkbox.Group options={CHANNEL_OPTIONS} />
            </Form.Item>
            {/* 标题不设前端必填：选模板时由模板带出，后端按「标题或模板二选一」校验 */}
            <Form.Item name="title" label="消息标题（选模板可留空）">
              <Input placeholder="如 资质临期提醒（10 月）" maxLength={120} />
            </Form.Item>
            <Form.Item name="content" label="消息正文">
              <Input.TextArea rows={4} placeholder="支持 {变量} 占位，实际发送前需由模板提供变量值" />
            </Form.Item>
            <Button type="primary" loading={sending} onClick={send}>加入推送队列</Button>
          </Form>
          <div className="uc-inline-note">
            <b>渠道说明：</b>当前只有「站内信」会真正落库到 <code>platform_message</code>；
            微信 / 短信 / APP 推送需要各自的通道凭据，未配置时只记录在任务里、不会实际外发。
            <br />
            <b>人群说明：</b>「批发商身份」「资质临期」两个口径依赖平台尚未落地的身份分类与证照有效期，
            目前按全量处理（宁可多发不漏发）。
          </div>
        </section>

        <section className="surface-card">
          <SectionHeading kicker="预估触达" title="这次会发给谁" />
          <div className="uc-metric" style={{ marginBottom: 12 }}>
            <div className="uc-metric-label">当前人群</div>
            <div className="uc-metric-value">
              {previewLoading ? '…' : (preview?.count ?? '—')}
            </div>
            <div className="uc-metric-note">
              {preview ? AUDIENCE_LABEL[preview.audience] ?? preview.audience : '选择人群后自动统计'}
            </div>
          </div>
          <div className="small muted" style={{ lineHeight: 1.9 }}>
            <div>· 全部用户 = 状态正常的账号</div>
            <div>· 已实名 = 最新一条实名记录状态为 verified</div>
            <div>· 企业账号 = 已认证组织下的全部成员账号</div>
            <div>· 30 日未登录 = 账号 30 天无更新</div>
            <div style={{ marginTop: 10 }}>
              提交后只入队，后台每 3 秒投一批（500 条）；列表里的「触达」列会实时往上走。
            </div>
          </div>
        </section>
      </div>

      <section className="surface-card">
        <SectionHeading
          kicker="推送任务"
          title={`历史记录（${total}）`}
          action={polling ? '投递中，自动刷新' : undefined}
          onAction={polling ? () => undefined : undefined}
        />
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1080 }}
          columns={[
            {
              title: '标题',
              dataIndex: 'title',
              render: (value: string, row) => (
                <div>
                  <b>{value}</b>
                  {row.templateCode && <div className="small muted">{row.templateCode}</div>}
                  {row.failReason && <div className="small" style={{ color: 'var(--red-700)' }}>{row.failReason}</div>}
                </div>
              ),
            },
            {
              title: '人群',
              dataIndex: 'audience',
              width: 130,
              render: (value: string) => AUDIENCE_LABEL[value] ?? value,
            },
            {
              title: '渠道',
              dataIndex: 'channels',
              width: 190,
              render: (value: string) => <span className="small">{channelText(value)}</span>,
            },
            {
              title: '触达 / 目标',
              dataIndex: 'reachCount',
              width: 130,
              render: (value: number, row) => (
                <div>
                  <b>{value}</b>
                  <span className="small muted"> / {row.targetCount || '—'}</span>
                </div>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (value: string) => <StatusTag status={value} />,
            },
            { title: '发送时间', dataIndex: 'sendTime', width: 150, render: (value: string) => formatTime(value) },
            { title: '操作人', dataIndex: 'operatorName', width: 110, render: (value: string) => value || '—' },
          ]}
          pagination={{
            current: pageNum,
            pageSize: 10,
            total,
            showTotal: (count) => `共 ${count} 次`,
            onChange: (next) => setPageNum(next),
          }}
        />
      </section>
    </div>
  )
}

/* ==================== 消息模板 ==================== */

export function MessageTemplatePage(): JSX.Element {
  const [rows, setRows] = useState<MessageTemplate[]>([])
  const [scene, setScene] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<MessageTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = (): void => {
    setLoading(true)
    setError('')
    ucApi.templates(scene || undefined)
      .then(setRows)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [scene])

  const openCreate = (): void => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ scene: 'cert_audit', status: 'enabled', channels: 'station' })
    setCreating(true)
  }

  const openEdit = (row: MessageTemplate): void => {
    setEditing(row)
    form.setFieldsValue(row)
    setCreating(true)
  }

  const submit = (): void => {
    form.validateFields()
      .then((values: Record<string, string>) => {
        setSaving(true)
        return editing
          ? ucApi.updateTemplate(String(editing.id), values)
          : ucApi.createTemplate(values)
      })
      .then(() => {
        message.success(editing ? '模板已更新' : '模板已创建')
        setCreating(false)
        load()
      })
      .catch((reason: Error) => {
        if (reason?.message) message.error(reason.message)
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="消息中心"
        title="消息模板"
        description={`${rows.length} 个模板 · 覆盖 ${new Set(rows.map((row) => row.scene)).size} 类场景 · 支持 {变量} 占位符`}
        actions={
          <>
            <Select
              value={scene}
              style={{ width: 160 }}
              options={[
                { label: '全部场景', value: '' },
                ...Object.entries(SCENE_LABEL).map(([value, label]) => ({ value, label })),
              ]}
              onChange={setScene}
            />
            <Button type="primary" onClick={openCreate}>＋ 新建模板</Button>
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
          scroll={{ x: 1100 }}
          columns={[
            {
              title: '模板',
              dataIndex: 'code',
              width: 210,
              render: (value: string, row) => (
                <div>
                  <b>{row.title}</b>
                  <div className="small muted">{value}</div>
                </div>
              ),
            },
            {
              title: '场景',
              dataIndex: 'scene',
              width: 110,
              render: (value: string) => (
                <Tag className="soft-tag">{SCENE_LABEL[value] ?? value}</Tag>
              ),
            },
            {
              title: '渠道',
              dataIndex: 'channels',
              width: 190,
              render: (value: string) => <span className="small">{channelText(value)}</span>,
            },
            {
              title: '内容预览',
              dataIndex: 'content',
              render: (value: string) => (
                <span className="small" style={{ color: '#53665a' }}>
                  {(value || '').slice(0, 60)}{(value || '').length > 60 ? '…' : ''}
                </span>
              ),
            },
            {
              title: '变量',
              dataIndex: 'variables',
              width: 200,
              render: (value: string) => (
                <div className="tag-row">
                  {(value || '').split(',').filter(Boolean).map((variable) => (
                    <Tag key={variable} className="soft-tag tone-purple">{`{${variable.trim()}}`}</Tag>
                  ))}
                  {!value && <span className="small muted">无</span>}
                </div>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 90,
              render: (value: string) => <StatusTag status={value} />,
            },
            {
              title: '操作',
              width: 90,
              render: (_, row) => (
                <Button size="small" type="link" onClick={() => openEdit(row)}>编辑</Button>
              ),
            },
          ]}
          pagination={false}
        />
      </section>

      <Modal
        open={creating}
        title={editing ? `编辑模板：${editing.code}` : '新建消息模板'}
        onCancel={() => setCreating(false)}
        onOk={submit}
        confirmLoading={saving}
        okText="保存"
        width={620}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="code"
            label="模板编码"
            rules={[{ required: true, message: '请填写编码' }]}
          >
            <Input placeholder="TPL_XXX_XXX" disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item name="scene" label="场景" rules={[{ required: true }]}>
            <Select options={Object.entries(SCENE_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="channels" label="适用渠道">
            <Input placeholder="逗号分隔，如 station,wechat,sms" />
          </Form.Item>
          <Form.Item name="title" label="标题模板" rules={[{ required: true, message: '请填写标题' }]}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="content" label="正文模板">
            <Input.TextArea rows={4} placeholder="用 {变量} 表示占位符" />
          </Form.Item>
          <Form.Item name="variables" label="可用变量">
            <Input placeholder="逗号分隔，如 orgName,expireDate" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[{ value: 'enabled', label: '启用' }, { value: 'disabled', label: '停用' }]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
