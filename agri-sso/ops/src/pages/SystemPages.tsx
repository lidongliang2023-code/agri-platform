import { useEffect, useMemo, useState } from 'react'
import { Button, Input, InputNumber, Select, Switch, Table, Tag, message } from 'antd'
import { ucApi } from '../api'
import {
  BarList,
  ErrorBlock,
  LineChart,
  PageTitle,
  SectionHeading,
  StatTile,
  StatusTag,
  formatCount,
  formatTime,
  roleText,
} from '../components/ui'
import type { AuditLog, StatsData, SystemConfig } from '../types'

/* ==================== 用户统计分析 ==================== */

export function StatsPage(): JSX.Element {
  const [data, setData] = useState<StatsData | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    ucApi.stats(days)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [days])

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="数据分析"
        title="用户统计分析"
        description={
          data
            ? `统计区间 ${data.range.from} ~ ${data.range.to}（${data.range.days} 天）· 数据直接取自业务表，非离线汇总`
            : '统计区间加载中'
        }
        actions={
          <Select
            value={days}
            style={{ width: 150 }}
            options={[
              { label: '近 7 天', value: 7 },
              { label: '近 30 天', value: 30 },
              { label: '近 90 天', value: 90 },
              { label: '近 1 年', value: 365 },
            ]}
            onChange={setDays}
          />
        }
      />

      {error && <ErrorBlock message={error} />}
      {loading && !data && <div className="small muted">正在加载…</div>}

      {data && (
        <>
          <div className="grid-3">
            <StatTile label="区间新增注册" value={formatCount(data.summary.register)} unit="个" />
            <StatTile label="区间新增实名" value={formatCount(data.summary.realname)} unit="条" />
            <StatTile label="区间新增组织" value={formatCount(data.summary.org)} unit="家" />
          </div>

          <section className="surface-card">
            <SectionHeading kicker="趋势" title="注册 / 实名 / 组织" />
            <LineChart
              labels={data.trend.labels}
              series={[
                { name: '新增注册', color: '#12764a', values: data.trend.register },
                { name: '新增实名', color: '#17698f', values: data.trend.realname },
                { name: '新增组织', color: '#d88718', values: data.trend.org },
              ]}
              height={260}
            />
          </section>

          <div className="grid-3">
            <section className="surface-card">
              <SectionHeading kicker="身份" title="角色分布" />
              <BarList
                items={data.roles.slice(0, 8).map((item) => ({
                  label: roleText(item.code),
                  value: item.c,
                }))}
              />
            </section>
            <section className="surface-card">
              <SectionHeading kicker="组织" title="主体类型" />
              <BarList items={data.orgTypes.map((item) => ({ label: item.type, value: item.c }))} />
            </section>
            <section className="surface-card">
              <SectionHeading kicker="认证" title="组织认证状态" />
              <div className="stack">
                {data.orgVerify.length === 0 && <span className="small muted">暂无组织</span>}
                {data.orgVerify.map((item) => (
                  <div className="row" key={item.status} style={{ justifyContent: 'space-between' }}>
                    <StatusTag status={item.status} />
                    <b>{item.c}</b>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="surface-card">
            <SectionHeading kicker="地域" title="组织所在地区 Top 12" />
            <BarList
              items={data.regions.map((item) => ({ label: item.region, value: item.c }))}
            />
            <div className="uc-inline-note">
              地区按 <code>platform_merchant.address</code> 的首段粗分（空格前），
              不做行政区划编码归一 —— 平台目前没有地区字典，硬做会把「山东省潍坊市寿光市」切成一个地区。
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/* ==================== 参数配置 ==================== */

/**
 * 已经真正接到执行点的配置键。
 *
 * <p>这份清单必须与后端 {@code AccountPolicyService} 的实际调用处保持一致 ——
 * 页面上标「已生效」但代码里没读，比不标更糟。</p>
 */
const ENFORCED_KEYS = new Set([
  'register.mode',
  'register.channels',
  'register.default.role',
  'password.policy',
  'password.weak.block',
  'session.remember.days',
  'captcha.sms.ttl',
])

const GROUP_LABEL: Record<string, string> = {
  register: '注册策略',
  realname: '实名强度',
  password: '密码与登录策略',
  session: '会话策略',
  captcha: '验证码策略',
}

export function ConfigPage(): JSX.Element {
  const [rows, setRows] = useState<SystemConfig[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = (): void => {
    setLoading(true)
    setError('')
    ucApi.configs()
      .then((list) => {
        setRows(list)
        setDraft(Object.fromEntries(list.map((item) => [item.configKey, item.configValue ?? ''])))
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const grouped = useMemo(() => {
    const map = new Map<string, SystemConfig[]>()
    rows.forEach((row) => {
      const list = map.get(row.configGroup) ?? []
      list.push(row)
      map.set(row.configGroup, list)
    })
    return Array.from(map.entries())
  }, [rows])

  const changed = rows.filter((row) => (draft[row.configKey] ?? '') !== (row.configValue ?? ''))

  const save = (): void => {
    if (changed.length === 0) {
      message.info('没有改动')
      return
    }
    setSaving(true)
    ucApi.saveConfigs(changed.map((row) => ({ key: row.configKey, value: draft[row.configKey] ?? '' })))
      .then((result) => {
        message.success(result.message)
        load()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSaving(false))
  }

  const renderControl = (row: SystemConfig): JSX.Element => {
    const value = draft[row.configKey] ?? ''
    if (row.valueType === 'switch') {
      return (
        <Switch
          checked={value === '1' || value === 'true'}
          onChange={(checked) => setDraft((prev) => ({ ...prev, [row.configKey]: checked ? '1' : '0' }))}
        />
      )
    }
    if (row.valueType === 'select' || row.valueType === 'multi') {
      return (
        <Select
          mode={row.valueType === 'multi' ? 'multiple' : undefined}
          style={{ width: '100%' }}
          value={row.valueType === 'multi' ? value.split(',').filter(Boolean) : value}
          options={(row.options ?? '').split(',').filter(Boolean).map((option) => ({
            value: option.trim(),
            label: option.trim(),
          }))}
          onChange={(next) => setDraft((prev) => ({
            ...prev,
            [row.configKey]: Array.isArray(next) ? next.join(',') : String(next),
          }))}
        />
      )
    }
    if (row.valueType === 'number') {
      return (
        <InputNumber
          style={{ width: '100%' }}
          value={value === '' ? undefined : Number(value)}
          onChange={(next) => setDraft((prev) => ({ ...prev, [row.configKey]: String(next ?? '') }))}
        />
      )
    }
    return (
      <Input
        value={value}
        onChange={(event) => setDraft((prev) => ({ ...prev, [row.configKey]: event.target.value }))}
      />
    )
  }

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="系统设置"
        title="参数配置"
        description="注册 / 实名 / 密码 / 会话 / 验证码五组账号侧策略 · 保存即写库、记审计，其中 7 项实时生效"
        actions={
          <>
            <Button onClick={load}>重置</Button>
            <Button type="primary" loading={saving} onClick={save}>
              保存配置{changed.length > 0 ? `（${changed.length} 项）` : ''}
            </Button>
          </>
        }
      />

      {error && <ErrorBlock message={error} onRetry={load} />}

      {loading && rows.length === 0 && <div className="small muted">正在加载…</div>}

      {grouped.map(([group, items]) => (
        <section className="surface-card" key={group}>
          <SectionHeading kicker={group} title={GROUP_LABEL[group] ?? group} />
          <div className="form-grid">
            {items.map((row) => (
              <div className="field" key={row.configKey}>
                <label>
                  {row.label ?? row.configKey}
                  <Tag
                    className={`soft-tag tone-${ENFORCED_KEYS.has(row.configKey) ? 'green' : 'default'}`}
                    style={{ marginLeft: 6, fontSize: 'var(--o-fs-micro)' }}
                  >
                    {ENFORCED_KEYS.has(row.configKey) ? '已生效' : '仅记录'}
                  </Tag>
                  {row.remark && <span className="small muted"> · {row.remark}</span>}
                </label>
                {renderControl(row)}
                <span className="small muted">{row.configKey}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="surface-card">
        <SectionHeading kicker="生效范围" title="哪些改完立刻起作用" />
        <div className="small" style={{ lineHeight: 1.95 }}>
          <div>
            <b>已生效（7 项）</b>：注册开关、注册方式、新用户默认身份、密码复杂度、禁止弱口令、
            记住我天数、短信验证码有效期。这些值由后端 <code>AccountPolicyService</code> 读取，
            注册、登录、改密码、重置密码时实时校验；保存后缓存立刻失效，不用等。
          </div>
          <div style={{ marginTop: 10 }}>
            <b>仅记录（其余）</b>：实名等级、人脸活体、公安库比对、密码过期、失败锁定、会话空闲超时、
            异地二次验证、图形验证码、IP/手机号注册上限。
            这些的执行点在 <code>core-infra</code> 的令牌与安全模块里，或依赖尚未落地的外部能力
            （公安库、活体检测、短信通道），本页只做记录与审计，<b>改完不会改变现有行为</b>。
          </div>
          <div style={{ marginTop: 10 }} className="muted">
            把它们标出来而不是假装全都能用 —— 运营改完发现没反应，比没有这个页面更糟。
          </div>
        </div>
      </section>
    </div>
  )
}

/* ==================== 操作审计 ==================== */

const ACTION_PREFIX_OPTIONS = [
  { label: '全部动作', value: '' },
  { label: '审核类（uc.review）', value: 'uc.review' },
  { label: '冻结/解封（uc.freeze）', value: 'uc.freeze' },
  { label: '配置变更（uc.config）', value: 'uc.config' },
  { label: '推送（uc.push）', value: 'uc.push' },
  { label: '应用审核（uc.auth-app）', value: 'uc.auth-app' },
  { label: '用户端操作（account.）', value: 'account.' },
]

export function AuditLogPage(): JSX.Element {
  const [rows, setRows] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState('')
  const [actionPrefix, setActionPrefix] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    ucApi.auditLogs({
      pageNum,
      pageSize: 20,
      keyword: keyword || undefined,
      actionPrefix: actionPrefix || undefined,
    })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [pageNum, keyword, actionPrefix])

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="系统设置"
        title="操作审计"
        description={`管理员与运营动作流水 ${total} 条 · 只读视图，本运营端没有任何删除或修改审计记录的接口`}
      />

      {error && <ErrorBlock message={error} />}

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <Input
            value={draft}
            placeholder="搜动作名 / 对象 / 说明"
            style={{ width: 260 }}
            onChange={(event) => setDraft(event.target.value)}
            onPressEnter={() => { setKeyword(draft.trim()); setPageNum(1) }}
          />
          <Button type="primary" onClick={() => { setKeyword(draft.trim()); setPageNum(1) }}>搜索</Button>
          <Select
            value={actionPrefix}
            style={{ width: 240 }}
            options={ACTION_PREFIX_OPTIONS}
            onChange={(value) => { setActionPrefix(value); setPageNum(1) }}
          />
        </div>
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1120 }}
          columns={[
            { title: '时间', dataIndex: 'createdAt', width: 160, render: (value: string) => formatTime(value) },
            {
              title: '操作人',
              dataIndex: 'operator',
              width: 130,
              render: (value: string) => <b>{value}</b>,
            },
            {
              title: '动作',
              dataIndex: 'actionLabel',
              render: (value: string, row) => (
                <div>
                  {value || '—'}
                  <div className="small muted">{row.action}</div>
                </div>
              ),
            },
            { title: '对象', dataIndex: 'target', width: 200, render: (value: string) => value || '—' },
            { title: '说明', dataIndex: 'detail', render: (value: string) => (
              <span className="small">{value || '—'}</span>
            ) },
            { title: 'IP', dataIndex: 'ip', width: 130, render: (value: string) => value || '—' },
            {
              title: '结果',
              dataIndex: 'result',
              width: 90,
              render: (value: string) => <StatusTag status={value} />,
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

      <section className="surface-card">
        <SectionHeading kicker="口径" title="和用户端「操作日志」是同一张表" />
        <div className="small muted" style={{ lineHeight: 1.9 }}>
          审计记录写在 <code>platform_user_operation_log</code>，用户端「账号安全 · 操作日志」读的也是它。
          这里额外能看到**别人**的动作（按 admin 权限），用户端只能看到自己的。
          <Tag className="soft-tag tone-green" style={{ marginLeft: 8 }}>不可篡改（无写接口）</Tag>
        </div>
      </section>
    </div>
  )
}
