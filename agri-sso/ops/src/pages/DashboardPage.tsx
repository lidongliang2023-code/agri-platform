import { useEffect, useState } from 'react'
import {
  ClusterOutlined,
  IdcardOutlined,
  ReloadOutlined,
  RiseOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Segmented, message } from 'antd'
import { useApp } from '../app-context'
import { ucApi } from '../api'
import {
  BarList,
  ErrorBlock,
  LineChart,
  LoadingBlock,
  PageTitle,
  StatusTag,
  formatCount,
  formatTime,
  roleText,
} from '../components/ui'
import type { DashboardData, OpsPageKey } from '../types'

/** 总览页：四张核心指标 + 待办 + 三条趋势 + 身份分布。 */
export function DashboardPage(): JSX.Element {
  const { navigate } = useApp()
  const [days, setDays] = useState(30)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = (span: number): void => {
    setLoading(true)
    setError('')
    ucApi.dashboard(span)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(days)
  }, [days])

  const metrics = data?.metrics
  const todoTotal = data?.todos.reduce((sum, todo) => sum + todo.count, 0) ?? 0

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="运营总览"
        title="用户中心总览"
        description={
          data
            ? `平台全量账号 · 身份 · 认证 · 安全一体化视图 · 数据更新于 ${formatTime(data.updatedAt)}`
            : '平台全量账号 · 身份 · 认证 · 安全一体化视图'
        }
        actions={
          <>
            <Segmented
              value={days}
              options={[
                { label: '近 7 天', value: 7 },
                { label: '近 30 天', value: 30 },
                { label: '近 90 天', value: 90 },
              ]}
              onChange={(value) => setDays(Number(value))}
            />
            <Button icon={<ReloadOutlined />} onClick={() => load(days)}>刷新</Button>
          </>
        }
      />

      {error && <ErrorBlock message={error} onRetry={() => load(days)} />}
      {loading && !data && <LoadingBlock rows={4} />}

      {data && metrics && (
        <>
          <div className="uc-metric-grid">
            <div className="uc-metric">
              <div className="uc-metric-label"><i><UserOutlined /></i>注册用户</div>
              <div className="uc-metric-value">{formatCount(metrics.userTotal)}</div>
              <div className="uc-metric-note">今日新增 <b>{metrics.todayNew}</b> 个账号</div>
            </div>
            <div className="uc-metric">
              <div className="uc-metric-label"><i><IdcardOutlined /></i>已实名认证</div>
              <div className="uc-metric-value">{formatCount(metrics.identityTotal)}</div>
              <div className="uc-metric-note">
                实名率 <b>{metrics.realnameRate}%</b> · 待审 {metrics.identityPending} 件
              </div>
            </div>
            <div className="uc-metric">
              <div className="uc-metric-label"><i><ClusterOutlined /></i>组织主体</div>
              <div className="uc-metric-value">{formatCount(metrics.merchantTotal)}</div>
              <div className="uc-metric-note">
                已认证 <b>{metrics.merchantCertified}</b> / {metrics.merchantTotal}
              </div>
            </div>
            <div className="uc-metric">
              <div className="uc-metric-label"><i><RiseOutlined /></i>活跃用户（{days} 天）</div>
              <div className="uc-metric-value">{formatCount(metrics.activeUsers)}</div>
              <div className="uc-metric-note">
                活跃率 <b>{metrics.activeRate}%</b> · 冻结 {metrics.frozenCount} 个
              </div>
            </div>
          </div>

          <div className="grid-main-aside">
            <section className="surface-card">
              <div className="section-heading compact">
                <div>
                  <span className="section-kicker">增长</span>
                  <h2>新增注册 / 实名 / 组织</h2>
                </div>
                <span className="small muted">按日统计，缺日补 0</span>
              </div>
              <LineChart
                labels={data.trend.labels}
                series={[
                  { name: '新增注册', color: '#12764a', values: data.trend.register },
                  { name: '新增实名', color: '#17698f', values: data.trend.realname },
                  { name: '新增组织', color: '#d88718', values: data.trend.org },
                ]}
                height={240}
              />
            </section>

            <section className="surface-card">
              <div className="section-heading compact">
                <div>
                  <span className="section-kicker">我的待办</span>
                  <h2>合计 {todoTotal} 件</h2>
                </div>
              </div>
              {data.todos.map((todo) => (
                <div className="uc-todo" key={todo.key}>
                  <div className="uc-todo-main">
                    <span className={`uc-todo-count${todo.count === 0 ? ' zero' : ''}`}>{todo.count}</span>
                    <span className="uc-todo-label">{todo.label}</span>
                  </div>
                  <Button
                    size="small"
                    type={todo.count > 0 ? 'primary' : 'default'}
                    ghost={todo.count > 0}
                    onClick={() => navigate(todo.route as OpsPageKey)}
                  >
                    处理
                  </Button>
                </div>
              ))}
              <div className="uc-inline-note">
                待办数直接取自各单据表的 pending 状态，与用户端提交的是同一份数据 ——
                用户在「我的身份」提交后，这里立刻加一。
              </div>
            </section>
          </div>

          <div className="grid-3">
            <section className="surface-card">
              <div className="section-heading compact">
                <div><span className="section-kicker">身份分布</span><h2>按角色</h2></div>
              </div>
              <BarList
                items={data.roles.slice(0, 7).map((role) => ({
                  label: `${roleText(role.code)}${role.name && role.name !== role.code ? '' : ''}`,
                  value: role.c,
                }))}
              />
            </section>

            <section className="surface-card">
              <div className="section-heading compact">
                <div><span className="section-kicker">组织分布</span><h2>按主体类型</h2></div>
              </div>
              <BarList
                items={data.orgTypes.map((item) => ({ label: item.type, value: item.c }))}
              />
            </section>

            <section className="surface-card">
              <div className="section-heading compact">
                <div><span className="section-kicker">实名状态</span><h2>认证漏斗</h2></div>
              </div>
              <div className="stack">
                {data.identityStatus.length === 0 && <span className="small muted">暂无实名记录</span>}
                {data.identityStatus.map((item) => (
                  <div className="row" key={item.status} style={{ justifyContent: 'space-between' }}>
                    <StatusTag status={item.status} />
                    <b>{item.c}</b>
                  </div>
                ))}
              </div>
              <Button
                type="link"
                style={{ paddingLeft: 0 }}
                onClick={() => navigate('realname-audit')}
              >
                去审核实名 →
              </Button>
            </section>
          </div>

          <section className="surface-card">
            <div className="section-heading compact">
              <div><span className="section-kicker">快捷入口</span><h2>常用操作</h2></div>
            </div>
            <div className="chip-row">
              <button type="button" className="chip" onClick={() => navigate('user-list')}>
                <TeamOutlined /> 用户列表
              </button>
              <button type="button" className="chip" onClick={() => navigate('org-list')}>
                <ClusterOutlined /> 组织列表
              </button>
              <button type="button" className="chip" onClick={() => navigate('security-risk')}>
                安全风险
              </button>
              <button type="button" className="chip" onClick={() => navigate('message-push')}>
                发一条推送
              </button>
              <button type="button" className="chip" onClick={() => navigate('config')}>
                参数配置
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  void navigator.clipboard?.writeText(window.location.href)
                  message.success('已复制当前页面地址')
                }}
              >
                复制本页链接
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
