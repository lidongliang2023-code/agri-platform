import { useEffect, useState } from 'react'
import { Button, Descriptions, Input, Modal, Popconfirm, Select, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useApp } from '../app-context'
import { ucApi } from '../api'
import {
  BarList,
  EmptyState,
  ErrorBlock,
  PageTitle,
  ROLE_LABEL,
  SectionHeading,
  StatusTag,
  formatMillis,
  formatTime,
  roleText,
} from '../components/ui'
import type { IdentityPageData, SessionRow, UserDetailData, UserRow } from '../types'

/* ==================== 用户列表 ==================== */

// 取值必须与 platform_user_identity.status 一致：通过是 verified（不是 approved）。
// 写成 approved 会静默筛出空列表 —— 不报错，但看起来像"没人实名"。
const REALNAME_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '已实名', value: 'verified' },
  { label: '待审核', value: 'pending' },
  { label: '已驳回', value: 'rejected' },
]

export function UserListPage(): JSX.Element {
  const { navigate } = useApp()
  const [rows, setRows] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState('')
  const [roleCode, setRoleCode] = useState('')
  const [realnameStatus, setRealnameStatus] = useState('')
  const [status, setStatus] = useState<number | undefined>(undefined)
  const [roles, setRoles] = useState<Array<{ label: string; value: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ucApi.roles()
      .then((list) => setRoles(list.map((role) => ({
        value: role.code,
        label: ROLE_LABEL[role.code] ?? role.name ?? role.code,
      }))))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    ucApi.users({ pageNum, pageSize, keyword: keyword || undefined, roleCode: roleCode || undefined,
      realnameStatus: realnameStatus || undefined, status })
      .then((data) => {
        setRows(data.records)
        setTotal(data.total)
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [pageNum, pageSize, keyword, roleCode, realnameStatus, status])

  const toggleStatus = (row: UserRow): void => {
    const next = row.status === 1 ? 0 : 1
    ucApi.setUserStatus(row.id, next)
      .then(() => {
        message.success(next === 1 ? '已启用该账号' : '已停用该账号')
        setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: next } : item)))
      })
      .catch((reason: Error) => message.error(reason.message))
  }

  const columns: ColumnsType<UserRow> = [
    {
      title: '账号',
      dataIndex: 'username',
      render: (_, row) => (
        <div>
          <b>{row.nickname || row.username}</b>
          <div className="small muted">{row.username} · {row.phone || '未绑定手机'}</div>
        </div>
      ),
    },
    {
      title: '身份',
      dataIndex: 'roles',
      width: 190,
      render: (value: string[]) => (
        <div className="tag-row">
          {value.length === 0 && <span className="small muted">无角色</span>}
          {value.map((code) => <Tag key={code} className="soft-tag">{roleText(code)}</Tag>)}
        </div>
      ),
    },
    {
      title: '实名',
      dataIndex: 'realnameStatus',
      width: 110,
      render: (value: string, row) => (
        <div>
          <StatusTag status={value} />
          {row.realName && <div className="small muted">{row.realName}</div>}
        </div>
      ),
    },
    {
      title: '所属组织',
      dataIndex: 'orgCount',
      width: 190,
      render: (value: number, row) => (
        value === 0
          ? <span className="small muted">未绑定</span>
          : (
            <div>
              <b>{value} 个</b>
              <div className="small muted">{row.orgNames.join('、') || '—'}</div>
            </div>
          )
      ),
    },
    {
      title: '账号状态',
      dataIndex: 'status',
      width: 130,
      render: (value: number, row) => (
        <div className="tag-row">
          <StatusTag status={value === 1 ? 'success' : 'frozen'} />
          {row.frozen && <Tag className="soft-tag tone-up">{row.freezeType ?? '冻结'}</Tag>}
        </div>
      ),
    },
    { title: '注册时间', dataIndex: 'createdAt', width: 150, render: (value: string) => formatTime(value) },
    {
      title: '操作',
      width: 160,
      render: (_, row) => (
        <>
          <Button size="small" type="link" onClick={() => navigate('user-detail', row.id)}>详情</Button>
          <Button size="small" type="link" danger={row.status === 1} onClick={() => toggleStatus(row)}>
            {row.status === 1 ? '停用' : '启用'}
          </Button>
        </>
      ),
    },
  ]

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="用户与身份"
        title="用户列表"
        description={`全平台注册账号 ${total} 个 · 支持按身份、实名状态、账号状态筛选`}
      />

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <Input
            value={draft}
            placeholder="搜账号 / 昵称 / 手机号"
            style={{ width: 240 }}
            onChange={(event) => setDraft(event.target.value)}
            onPressEnter={() => { setKeyword(draft.trim()); setPageNum(1) }}
          />
          <Button type="primary" onClick={() => { setKeyword(draft.trim()); setPageNum(1) }}>搜索</Button>
          <Select
            value={roleCode}
            style={{ width: 170 }}
            options={[{ label: '全部身份', value: '' }, ...roles]}
            onChange={(value) => { setRoleCode(value); setPageNum(1) }}
          />
          <Select
            value={realnameStatus}
            style={{ width: 140 }}
            options={REALNAME_OPTIONS}
            onChange={(value) => { setRealnameStatus(value); setPageNum(1) }}
          />
          <Select
            value={status === undefined ? '' : String(status)}
            style={{ width: 130 }}
            options={[
              { label: '全部状态', value: '' },
              { label: '正常', value: '1' },
              { label: '停用', value: '0' },
            ]}
            onChange={(value) => {
              setStatus(value === '' ? undefined : Number(value))
              setPageNum(1)
            }}
          />
        </div>

        {error && <ErrorBlock message={error} />}
        {!error && (
          <Table
            rowKey="id"
            size="middle"
            loading={loading}
            columns={columns}
            dataSource={rows}
            scroll={{ x: 1120 }}
            pagination={{
              current: pageNum,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (count) => `共 ${count} 个账号`,
              onChange: (nextPage, nextSize) => { setPageNum(nextPage); setPageSize(nextSize) },
            }}
          />
        )}
      </section>
    </div>
  )
}

/* ==================== 用户详情 ==================== */

export function UserDetailPage({ id }: { id: string }): JSX.Element {
  const { navigate } = useApp()
  const [data, setData] = useState<UserDetailData | null>(null)
  const [error, setError] = useState('')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [acting, setActing] = useState(false)
  // 临时密码只在这里显示一次，关掉就拿不回来了
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const loadSessions = (): void => {
    if (!id) return
    setSessionsLoading(true)
    ucApi.userSessions(id)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false))
  }

  useEffect(() => {
    if (!id) {
      setError('缺少用户 ID')
      return
    }
    setError('')
    ucApi.userDetail(id)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
    loadSessions()
  }, [id])

  const doForceLogout = (): void => {
    setActing(true)
    ucApi.forceLogout(id)
      .then((result) => {
        message.success(result.message)
        loadSessions()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setActing(false))
  }

  const doResetPassword = (): void => {
    setActing(true)
    ucApi.resetPassword(id)
      .then((result) => {
        setTempPassword(result.tempPassword)
        loadSessions()
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setActing(false))
  }

  if (error) {
    return (
      <div className="page-stack">
        <PageTitle title="用户详情" />
        <ErrorBlock message={error} onRetry={() => navigate('user-list')} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page-stack">
        <PageTitle title="用户详情" description="正在加载…" />
      </div>
    )
  }

  const { user, roles, identity, orgs, freeze, recentLogs } = data

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="用户与身份"
        title="用户详情"
        actions={<Button onClick={() => navigate('user-list')}>返回列表</Button>}
      />

      <section className="surface-card">
        <div className="uc-detail-head">
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div className="uc-detail-avatar">{(user.nickname || user.username).slice(0, 1)}</div>
            <div>
              <h2 className="uc-detail-title">{user.nickname || user.username}</h2>
              <div className="uc-detail-sub">
                账号 {user.username} · 手机 {user.phone || '未绑定'} · 注册于 {formatTime(user.createdAt)}
              </div>
              <div className="tag-row" style={{ marginTop: 10 }}>
                <StatusTag status={user.status === 1 ? 'success' : 'frozen'} />
                {roles.map((role) => (
                  <Tag key={role.code} className="soft-tag">{roleText(role.code)}</Tag>
                ))}
                {freeze && <Tag className="soft-tag tone-up">{freeze.freezeType} 冻结中</Tag>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => navigate('account-freeze')}>
              {freeze ? '去解封' : '去冻结'}
            </Button>
            <Button onClick={() => navigate('device-log')}>登录日志</Button>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="surface-card">
          <SectionHeading kicker="实名认证" title="身份核验" />
          {identity ? (
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="真实姓名">{identity.realName || '—'}</Descriptions.Item>
              <Descriptions.Item label="证件号（掩码）">{identity.idNoMasked || '—'}</Descriptions.Item>
              <Descriptions.Item label="状态"><StatusTag status={identity.status} /></Descriptions.Item>
              <Descriptions.Item label="公安库比对">
                {identity.policeVerified ? '已通过' : '未通过 / 未做'}
              </Descriptions.Item>
              <Descriptions.Item label="活体检测">
                {identity.livenessVerified ? '已通过' : '未通过 / 未做'}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">{formatTime(identity.submitTime)}</Descriptions.Item>
              <Descriptions.Item label="审核人">
                {identity.reviewerName || '—'}
                {identity.reviewRemark && (
                  <div className="small muted">意见：{identity.reviewRemark}</div>
                )}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <EmptyState icon="🪪" title="尚未提交实名认证" description="该账号未做过实名核验，无法进行交易与融资。" />
          )}
        </section>

        <section className="surface-card">
          <SectionHeading kicker="组织归属" title={`所属组织（${orgs.length}）`} />
          {orgs.length === 0 && <span className="small muted">未绑定任何经营主体</span>}
          <div className="stack">
            {orgs.map((org) => (
              <div className="row" key={String(org.id)} style={{ justifyContent: 'space-between' }}>
                <div>
                  <b>{org.name}</b>
                  <div className="small muted">{org.code} · {org.address || '未填写地址'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <StatusTag status={org.verifyStatus} />
                  <Button size="small" type="link" onClick={() => navigate('org-detail', String(org.id))}>
                    查看
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="surface-card">
        <SectionHeading kicker="账号处置" title="会话与安全操作" />
        <div className="uc-inline-note" style={{ marginTop: 0, marginBottom: 14 }}>
          会话数据与用户端「登录设备」是同一份（都读 Redis 里的 SSO 会话），运营看到的台数
          与用户自己看到的必须一致 —— 否则"用户说三台、运营说一台"没法对账。
        </div>
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <Button onClick={loadSessions} loading={sessionsLoading}>刷新会话</Button>
          <Popconfirm
            title="强制该账号下线？"
            description="会清掉全部 SSO 会话并吊销已发出的访问令牌，用户需重新登录。"
            okText="确认下线"
            cancelText="取消"
            onConfirm={doForceLogout}
          >
            <Button danger disabled={acting}>强制下线（{sessions.length} 个会话）</Button>
          </Popconfirm>
          <Popconfirm
            title="重置该账号的登录密码？"
            description="会生成一次性临时密码、吊销全部会话，并给用户发站内信通知。"
            okText="确认重置"
            cancelText="取消"
            onConfirm={doResetPassword}
          >
            <Button disabled={acting}>重置登录密码</Button>
          </Popconfirm>
        </div>
        <Table
          rowKey="sessionKey"
          size="small"
          loading={sessionsLoading}
          dataSource={sessions}
          pagination={false}
          locale={{ emptyText: '当前没有活跃会话' }}
          columns={[
            {
              title: '设备',
              dataIndex: 'device',
              width: 130,
              render: (value: string) => <b>{value || '未知端'}</b>,
            },
            { title: 'IP', dataIndex: 'ip', width: 140, render: (value: string) => value || '—' },
            {
              title: '登录时间',
              dataIndex: 'loginAt',
              width: 160,
              render: (value: string) => formatMillis(value),
            },
            {
              title: 'User-Agent',
              dataIndex: 'userAgent',
              render: (value: string) => (
                <span className="small muted">{(value || '—').slice(0, 64)}</span>
              ),
            },
          ]}
        />
      </section>

      <section className="surface-card">
        <SectionHeading kicker="操作流水" title="最近 20 条操作" />
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={recentLogs}
          columns={[
            { title: '时间', dataIndex: 'createdAt', width: 160, render: (value: string) => formatTime(value) },
            { title: '动作', dataIndex: 'actionLabel', render: (value: string, row) => value || row.action },
            { title: '对象', dataIndex: 'target', render: (value: string) => value || '—' },
            { title: '说明', dataIndex: 'detail', render: (value: string) => value || '—' },
            { title: 'IP', dataIndex: 'ip', width: 140, render: (value: string) => value || '—' },
            {
              title: '结果',
              dataIndex: 'result',
              width: 90,
              render: (value: string) => <StatusTag status={value} />,
            },
          ]}
        />
      </section>

      <Modal
        open={Boolean(tempPassword)}
        title="临时密码（仅显示这一次）"
        onCancel={() => setTempPassword(null)}
        footer={[
          <Button
            key="copy"
            onClick={() => {
              if (tempPassword) {
                void navigator.clipboard?.writeText(tempPassword)
                message.success('已复制临时密码')
              }
            }}
          >
            复制
          </Button>,
          <Button key="ok" type="primary" onClick={() => setTempPassword(null)}>我已转告本人</Button>,
        ]}
      >
        <div className="stack" style={{ marginTop: 12 }}>
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 10,
              background: 'var(--green-050, #f1fbf5)',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              textAlign: 'center',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {tempPassword}
          </div>
          <div className="small muted" style={{ lineHeight: 1.9 }}>
            关掉这个弹窗后就查不到了 —— 系统不保存明文密码。<br />
            该账号的全部会话已被下线，并已收到一条「密码已被重置」的站内信。<br />
            <b>注意</b>：平台没有「首次登录强制改密」的标记位，这个临时密码在用户自行修改前一直有效，
            请通过电话等安全渠道转告本人，并提醒其登录后立即修改。
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ==================== 身份管理 ==================== */

export function IdentityPage(): JSX.Element {
  const [data, setData] = useState<IdentityPageData | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [roleCode, setRoleCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    ucApi.identities({ pageNum, pageSize: 20, roleCode: roleCode || undefined })
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [pageNum, roleCode])

  const distribution = data?.distribution ?? []
  const instanceTotal = distribution.reduce((sum, item) => sum + item.c, 0)

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="用户与身份"
        title="身份管理"
        description={`全平台身份实例 ${instanceTotal} 个 · ${distribution.filter((item) => item.c > 0).length} 类身份 · 一个账号可同时持有多个身份`}
      />

      {error && <ErrorBlock message={error} />}

      <div className="grid-main-aside">
        <section className="surface-card">
          <SectionHeading kicker="身份实例" title="按账号列出的身份" />
          <div className="chip-row" style={{ marginBottom: 12 }}>
            <Select
              value={roleCode}
              style={{ width: 180 }}
              options={[
                { label: '全部身份类型', value: '' },
                ...distribution.map((item) => ({ label: roleText(item.code), value: item.code })),
              ]}
              onChange={(value) => { setRoleCode(value); setPageNum(1) }}
            />
          </div>
          <Table
            rowKey="id"
            size="middle"
            loading={loading}
            dataSource={data?.page.records ?? []}
            scroll={{ x: 780 }}
            columns={[
              {
                title: '账号',
                dataIndex: 'username',
                render: (_, row) => (
                  <div>
                    <b>{row.nickname || row.username}</b>
                    <div className="small muted">{row.username}</div>
                  </div>
                ),
              },
              {
                title: '身份',
                dataIndex: 'roleName',
                width: 150,
                render: (value: string, row) => <Tag className="soft-tag">{roleText(row.roleCode) || value}</Tag>,
              },
              {
                title: '实名',
                dataIndex: 'realnameStatus',
                width: 110,
                render: (value: string) => <StatusTag status={value} />,
              },
              {
                title: '组织数',
                dataIndex: 'orgCount',
                width: 100,
                render: (value: number) => (value === 0 ? '—' : `${value} 个`),
              },
              {
                title: '操作',
                width: 110,
                render: (_, row) => (
                  <Button size="small" type="link" onClick={() => { window.location.hash = `/user-detail/${row.userId}` }}>
                    查看账号
                  </Button>
                ),
              },
            ]}
            pagination={{
              current: pageNum,
              pageSize: 20,
              total: data?.page.total ?? 0,
              showTotal: (count) => `共 ${count} 条身份`,
              onChange: (next) => setPageNum(next),
            }}
          />
        </section>

        <section className="surface-card">
          <SectionHeading kicker="分布" title="按身份类型" />
          <BarList
            items={distribution.map((item) => ({ label: roleText(item.code), value: item.c }))}
          />
          <div className="uc-inline-note">
            身份实例来自 <code>platform_user_role</code>：一个账号绑了几个角色就计几次，
            因此总数会大于账号数。实名状态取该账号最新一条实名记录。
          </div>
        </section>
      </div>
    </div>
  )
}
