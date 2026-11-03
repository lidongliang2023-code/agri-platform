import { useEffect, useState } from 'react'
import { Button, Descriptions, Form, Input, Modal, Select, Table, Tag, message } from 'antd'
import { ucApi } from '../api'
import {
  BarList,
  ErrorBlock,
  FREEZE_TYPE_LABEL,
  LineChart,
  PageTitle,
  SectionHeading,
  StatusTag,
  formatTime,
} from '../components/ui'
import type { DeviceLog, FreezeRecord, SecurityRiskData } from '../types'

/* ==================== 安全风险监控 ==================== */

export function SecurityRiskPage(): JSX.Element {
  const [data, setData] = useState<SecurityRiskData | null>(null)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    ucApi.risks(days)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [days])

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="安全风控"
        title="安全风险监控"
        description={
          data
            ? `近 ${days} 日风险事件 ${data.total} 起 · 登录成功 ${data.handled} 次 · 失败 ${data.pending} 次`
            : `近 ${days} 日风险事件`
        }
        actions={
          <Select
            value={days}
            style={{ width: 140 }}
            options={[
              { label: '近 7 天', value: 7 },
              { label: '近 14 天', value: 14 },
              { label: '近 30 天', value: 30 },
            ]}
            onChange={setDays}
          />
        }
      />

      {error && <ErrorBlock message={error} />}

      {data && (
        <>
          <div className="uc-metric-grid">
            {data.categories.map((category) => (
              <div className="uc-metric" key={category.key}>
                <div className="uc-metric-label">{category.label}</div>
                <div className="uc-metric-value">{category.count}</div>
                <div className="uc-metric-note">{category.detail}</div>
              </div>
            ))}
          </div>

          <div className="grid-main-aside">
            <section className="surface-card">
              <SectionHeading kicker="趋势" title="登录行为（含失败）" />
              <LineChart
                labels={data.trend.labels}
                series={[{ name: '登录相关操作', color: '#17698f', values: data.trend.loginFail }]}
                height={220}
              />
              <div className="uc-inline-note">
                这里统计的是 <code>platform_user_operation_log</code> 中 action 以 login 开头的记录。
                平台目前没有独立的风控事件流，所以「风险事件」是从登录日志聚合出来的，
                不是一张专门的告警表 —— 与其造一张空表假装有风控引擎，不如把口径说清楚。
              </div>
            </section>

            <section className="surface-card">
              <SectionHeading kicker="等级" title="风险等级分布" />
              <BarList
                items={data.severity.map((item) => ({
                  label: item.label,
                  value: item.count,
                  tone: item.level === 'high' ? 'danger' : item.level === 'medium' ? 'warn' : '',
                }))}
              />
              <SectionHeading kicker="来源" title="失败登录 Top IP" />
              {data.topIp.length === 0 && <span className="small muted">窗口期内无失败登录</span>}
              <div className="stack">
                {data.topIp.map((item) => (
                  <div className="row" key={item.ip} style={{ justifyContent: 'space-between' }}>
                    <span className="small">{item.ip}</span>
                    <b className="small">{item.c} 次</b>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {loading && !data && <div className="small muted">正在加载…</div>}
    </div>
  )
}

/* ==================== 设备与登录日志 ==================== */

export function DeviceLogPage(): JSX.Element {
  const [rows, setRows] = useState<DeviceLog[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    ucApi.deviceLogs({ pageNum, pageSize: 20, keyword: keyword || undefined, result: result || undefined })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [pageNum, keyword, result])

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="安全风控"
        title="设备与登录日志"
        description={`累计 ${total} 条操作日志 · 与用户端「登录设备」读同一张表，口径一致`}
      />

      {error && <ErrorBlock message={error} />}

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <Input
            value={draft}
            placeholder="搜动作 / IP / UA"
            style={{ width: 240 }}
            onChange={(event) => setDraft(event.target.value)}
            onPressEnter={() => { setKeyword(draft.trim()); setPageNum(1) }}
          />
          <Button type="primary" onClick={() => { setKeyword(draft.trim()); setPageNum(1) }}>搜索</Button>
          <Select
            value={result}
            style={{ width: 140 }}
            options={[
              { label: '全部结果', value: '' },
              { label: '成功', value: 'success' },
              { label: '失败', value: 'fail' },
            ]}
            onChange={(value) => { setResult(value); setPageNum(1) }}
          />
        </div>
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1100 }}
          columns={[
            { title: '时间', dataIndex: 'createdAt', width: 160, render: (value: string) => formatTime(value) },
            {
              title: '账号',
              dataIndex: 'username',
              width: 160,
              render: (value: string) => value || '—',
            },
            {
              title: '动作',
              dataIndex: 'actionLabel',
              render: (value: string, row) => (
                <div>
                  {value || row.action}
                  <div className="small muted">{row.action}</div>
                </div>
              ),
            },
            { title: '端类型', dataIndex: 'device', width: 110, render: (value: string) => <Tag className="soft-tag">{value}</Tag> },
            { title: 'IP', dataIndex: 'ip', width: 140, render: (value: string) => value || '—' },
            {
              title: '结果',
              dataIndex: 'result',
              width: 90,
              render: (value: string) => <StatusTag status={value} />,
            },
            {
              title: 'User-Agent',
              dataIndex: 'userAgent',
              render: (value: string) => (
                <span className="small muted">{(value || '—').slice(0, 56)}</span>
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
    </div>
  )
}

/* ==================== 账号冻结与解封 ==================== */

export function AccountFreezePage(): JSX.Element {
  const [rows, setRows] = useState<FreezeRecord[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [status, setStatus] = useState('frozen')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [unfreezeTarget, setUnfreezeTarget] = useState<FreezeRecord | null>(null)
  const [remark, setRemark] = useState('')
  // 申诉筛选与处理：默认只看「申诉中」，运营打开页面就该看到待办
  const [appealStatus, setAppealStatus] = useState('appealing')
  const [appealTarget, setAppealTarget] = useState<FreezeRecord | null>(null)
  const [appealPass, setAppealPass] = useState(true)
  const [appealRemark, setAppealRemark] = useState('')
  const [appealBusy, setAppealBusy] = useState(false)
  const [form] = Form.useForm()

  const load = (): void => {
    setLoading(true)
    setError('')
    ucApi.freezes({
      pageNum,
      pageSize: 20,
      status: status || undefined,
      appealStatus: appealStatus || undefined,
    })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [pageNum, status, appealStatus])

  const freeze = (): void => {
    form.validateFields()
      .then((values: { userId: string; freezeType: string; reason: string }) => {
        setCreating(true)
        return ucApi.freeze(values)
      })
      .then(() => {
        message.success('账号已冻结，同时置为停用状态')
        setCreateOpen(false)
        form.resetFields()
        load()
      })
      .catch((reason: Error) => {
        if (reason?.message) message.error(reason.message)
      })
      .finally(() => setCreating(false))
  }

  const submitAppeal = (): void => {
    if (!appealTarget) return
    if (!appealPass && !appealRemark.trim()) {
      message.warning('驳回申诉必须填写理由')
      return
    }
    setAppealBusy(true)
    ucApi.handleAppeal(String(appealTarget.id), appealPass, appealRemark.trim())
      .then((result) => {
        message.success(result.message)
        setAppealTarget(null)
        setAppealRemark('')
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setAppealBusy(false))
  }

  const unfreeze = (): void => {
    if (!unfreezeTarget) return
    ucApi.unfreeze(String(unfreezeTarget.id), remark)
      .then(() => {
        message.success('已解封，账号恢复可用')
        setUnfreezeTarget(null)
        setRemark('')
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="安全风控"
        title="账号冻结与解封"
        description={`当前筛选 ${total} 条 · 冻结会同时改 platform_user.status，两处必须一致 · 申诉受理即解封`}
        actions={
          <>
            <Select
              value={status}
              style={{ width: 140 }}
              options={[
                { label: '冻结中', value: 'frozen' },
                { label: '已解封', value: 'unfrozen' },
                { label: '全部状态', value: '' },
              ]}
              onChange={(value) => { setStatus(value); setPageNum(1) }}
            />
            <Select
              value={appealStatus}
              style={{ width: 150 }}
              options={[
                { label: '申诉中', value: 'appealing' },
                { label: '申诉已受理', value: 'accepted' },
                { label: '申诉已驳回', value: 'rejected' },
                { label: '全部申诉', value: '' },
              ]}
              onChange={(value) => { setAppealStatus(value); setPageNum(1) }}
            />
            <Button type="primary" danger onClick={() => setCreateOpen(true)}>＋ 手动冻结</Button>
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
          scroll={{ x: 1280 }}
          columns={[
            {
              title: '账号',
              dataIndex: 'username',
              width: 180,
              render: (value: string, row) => (
                <div>
                  <b>{value || `用户 ${row.userId}`}</b>
                  <div className="small muted">{row.userId}</div>
                </div>
              ),
            },
            {
              title: '冻结类型',
              dataIndex: 'freezeType',
              width: 120,
              render: (value: string) => (
                <Tag className="soft-tag tone-up">{FREEZE_TYPE_LABEL[value] ?? value}</Tag>
              ),
            },
            {
              title: '原因',
              dataIndex: 'reason',
              width: 200,
              render: (value: string) => <span className="small">{value || '—'}</span>,
            },
            { title: '冻结时间', dataIndex: 'freezeTime', width: 150, render: (value: string) => formatTime(value) },
            {
              title: '期限',
              dataIndex: 'expireTime',
              width: 150,
              render: (value: string) => (value ? formatTime(value) : '永久'),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (value: string) => <StatusTag status={value} />,
            },
            { title: '操作人', dataIndex: 'operatorName', width: 100, render: (value: string) => value || '—' },
            {
              title: '申诉',
              dataIndex: 'appealStatus',
              width: 210,
              render: (value: string, row) => {
                if (!value || value === 'none') return <span className="small muted">未申诉</span>
                return (
                  <div>
                    <StatusTag status={value} />
                    {row.appealReason && (
                      <div className="small muted" style={{ marginTop: 4 }}>
                        {row.appealReason.slice(0, 28)}{row.appealReason.length > 28 ? '…' : ''}
                      </div>
                    )}
                    {row.appealRemark && (
                      <div className="small muted">处理意见：{row.appealRemark.slice(0, 24)}</div>
                    )}
                  </div>
                )
              },
            },
            {
              title: '操作',
              width: 150,
              render: (_, row) => (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {row.appealStatus === 'appealing' && (
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => { setAppealTarget(row); setAppealPass(true); setAppealRemark('') }}
                    >
                      处理申诉
                    </Button>
                  )}
                  {row.status === 'frozen' && (
                    <Button size="small" ghost onClick={() => setUnfreezeTarget(row)}>解封</Button>
                  )}
                  {row.status !== 'frozen' && row.appealStatus !== 'appealing' && (
                    <span className="small muted">{formatTime(row.unfreezeTime)}</span>
                  )}
                </div>
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
        open={createOpen}
        title="手动冻结账号"
        onCancel={() => setCreateOpen(false)}
        onOk={freeze}
        confirmLoading={creating}
        okText="确认冻结"
        okButtonProps={{ danger: true }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="userId"
            label="用户 ID"
            rules={[{ required: true, message: '请填写用户 ID（雪花 ID，可从用户详情页复制）' }]}
          >
            <Input placeholder="19 位用户 ID" />
          </Form.Item>
          <Form.Item name="freezeType" label="冻结类型" initialValue="violation">
            <Select
              options={Object.entries(FREEZE_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="reason" label="冻结原因" rules={[{ required: true, message: '请填写原因' }]}>
            <Input.TextArea rows={3} placeholder="会记入冻结记录，用于后续申诉核对" />
          </Form.Item>
        </Form>
        <div className="uc-inline-note">
          冻结会同时把 <code>platform_user.status</code> 置 0，账号立即无法登录。
          解封时两处一起恢复 —— 只改一处会出现「记录说冻了、人还能登」。
        </div>
      </Modal>

      <Modal
        open={Boolean(unfreezeTarget)}
        title={`解封：${unfreezeTarget?.username ?? ''}`}
        onCancel={() => setUnfreezeTarget(null)}
        onOk={unfreeze}
        okText="确认解封"
      >
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="small muted">冻结原因：{unfreezeTarget?.reason || '—'}</div>
          <Input.TextArea
            rows={3}
            value={remark}
            placeholder="解封说明（如申诉通过、误判等）"
            onChange={(event) => setRemark(event.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(appealTarget)}
        title={`处理申诉：${appealTarget?.username ?? ''}`}
        onCancel={() => setAppealTarget(null)}
        onOk={submitAppeal}
        confirmLoading={appealBusy}
        okText={appealPass ? '受理并解封' : '驳回申诉'}
        okButtonProps={{ danger: !appealPass }}
        width={560}
      >
        <div className="stack" style={{ marginTop: 12 }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="冻结类型">
              {FREEZE_TYPE_LABEL[appealTarget?.freezeType ?? ''] ?? appealTarget?.freezeType ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="冻结原因">{appealTarget?.reason || '—'}</Descriptions.Item>
            <Descriptions.Item label="冻结时间">{formatTime(appealTarget?.freezeTime)}</Descriptions.Item>
            <Descriptions.Item label="申诉提交">{formatTime(appealTarget?.appealTime)}</Descriptions.Item>
            <Descriptions.Item label="申诉理由">{appealTarget?.appealReason || '—'}</Descriptions.Item>
          </Descriptions>
          <Select
            value={appealPass ? 'pass' : 'reject'}
            style={{ width: '100%' }}
            options={[
              { label: '受理（复核通过，立即解封）', value: 'pass' },
              { label: '驳回（账号保持冻结）', value: 'reject' },
            ]}
            onChange={(value) => setAppealPass(value === 'pass')}
          />
          <Input.TextArea
            rows={3}
            value={appealRemark}
            placeholder={appealPass ? '受理说明（可选）' : '驳回理由（必填，用户需要知道为什么）'}
            onChange={(event) => setAppealRemark(event.target.value)}
          />
          <div className="small muted">
            受理会同时解除冻结并恢复账号可用（与「解封」走同一段逻辑）；
            驳回则保持冻结，但申诉状态改为「已驳回」，用户可补充说明后重新提交。
          </div>
        </div>
      </Modal>
    </div>
  )
}
