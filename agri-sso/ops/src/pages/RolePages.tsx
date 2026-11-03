import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Input, Select, Table, Tag, message } from 'antd'
import { useApp } from '../app-context'
import { ucApi } from '../api'
import { ErrorBlock, PageTitle, SectionHeading, formatTime, roleText } from '../components/ui'
import type { RoleRecord } from '../types'

/** 权限码形如 `info:read` / `trade:write`；`*` 表示全权限（超级管理员）。 */
const ACTIONS: Array<{ key: string; label: string }> = [
  { key: 'read', label: '查看' },
  { key: 'write', label: '新增/编辑' },
  { key: 'delete', label: '删除' },
  { key: 'export', label: '导出' },
  { key: 'audit', label: '审核' },
  { key: 'admin', label: '管理' },
]

/** 业务域的中文名。没登记的域直接显示原始前缀，不猜。 */
const MODULE_LABEL: Record<string, string> = {
  info: '信息资讯',
  trade: '交易撮合',
  produce: '生产管理',
  production: '生产管理',
  iot: '物联网',
  finance: '供应链金融',
  s2b2c: 'S2B2C 商城',
  service: '综合服务',
  gov: '政府监管',
  mdm: '主数据',
  uc: '用户中心',
  user: '账号',
}

function parsePermissions(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    // 老数据可能是逗号分隔的裸字符串，容错一下
    return raw.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

/* ==================== 角色管理 ==================== */

export function RoleListPage(): JSX.Element {
  const { navigate } = useApp()
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    ucApi.roles()
      .then(setRoles)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(
    () => roles.filter((role) => {
      if (!keyword) return true
      const text = `${role.code} ${role.name}`.toLowerCase()
      return text.includes(keyword.toLowerCase())
    }),
    [roles, keyword],
  )

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="角色权限"
        title="角色管理"
        description={`平台共 ${roles.length} 个角色 · 角色权限存在 platform_role.permissions（JSON 数组）`}
      />

      {error && <ErrorBlock message={error} />}

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <Input
            value={keyword}
            placeholder="搜角色编码 / 名称"
            style={{ width: 240 }}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <span className="small muted">点「配置权限」进入权限矩阵</span>
        </div>
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={filtered}
          pagination={false}
          columns={[
            {
              title: '角色',
              dataIndex: 'name',
              render: (value: string, row) => (
                <div>
                  <b>{value || roleText(row.code)}</b>
                  <div className="small muted">{row.code}</div>
                </div>
              ),
            },
            {
              title: '权限数',
              dataIndex: 'permissions',
              width: 110,
              render: (value: string) => {
                const list = parsePermissions(value)
                return list.includes('*')
                  ? <Tag className="soft-tag tone-green">全部权限</Tag>
                  : `${list.length} 项`
              },
            },
            {
              title: '权限预览',
              dataIndex: 'permissions',
              render: (value: string) => {
                const list = parsePermissions(value)
                if (list.includes('*')) return <span className="small muted">*（通配全部）</span>
                if (list.length === 0) return <span className="small muted">未配置</span>
                return (
                  <div className="tag-row">
                    {list.slice(0, 8).map((code) => <Tag key={code} className="soft-tag">{code}</Tag>)}
                    {list.length > 8 && <span className="small muted">等 {list.length} 项</span>}
                  </div>
                )
              },
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 150,
              render: (value: string) => formatTime(value),
            },
            {
              title: '操作',
              width: 120,
              render: (_, row) => (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  onClick={() => navigate('perm-matrix', undefined, { code: row.code })}
                >
                  配置权限
                </Button>
              ),
            },
          ]}
        />
      </section>
    </div>
  )
}

/* ==================== 权限矩阵 ==================== */

export function PermMatrixPage({ code }: { code?: string }): JSX.Element {
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [active, setActive] = useState(code ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    ucApi.roles()
      .then((list) => {
        setRoles(list)
        setActive((current) => current || list[0]?.code || '')
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  // 角色权限码从后端单独取，而不是读列表里的 JSON —— 列表那份是快照，
  // 保存后如果不重新拉取，界面会显示"改了但没生效"。
  const loadPermissions = (roleCode: string): void => {
    if (!roleCode) return
    setError('')
    ucApi.rolePermissions(roleCode)
      .then((list) => {
        setSelected(new Set(list))
        setDirty(false)
      })
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => {
    loadPermissions(active)
  }, [active])

  /** 矩阵的行：所有角色出现过的模块前缀，加上已知业务域。 */
  const modules = useMemo(() => {
    const found = new Set<string>(Object.keys(MODULE_LABEL))
    roles.forEach((role) => {
      parsePermissions(role.permissions).forEach((perm) => {
        const prefix = perm.split(':')[0]
        if (prefix && prefix !== '*') found.add(prefix)
      })
    })
    return Array.from(found).sort()
  }, [roles])

  const wildcard = selected.has('*')

  const toggle = (module: string, action: string): void => {
    const perm = `${module}:${action}`
    const next = new Set(selected)
    if (next.has(perm)) next.delete(perm)
    else next.add(perm)
    setSelected(next)
    setDirty(true)
  }

  const save = (): void => {
    if (!active) return
    setSaving(true)
    ucApi.saveRolePermissions(active, Array.from(selected))
      .then(() => {
        message.success('权限已保存，5 分钟内全端同步')
        setDirty(false)
        loadPermissions(active)
      })
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setSaving(false))
  }

  /** 不在矩阵列里的权限码（如 trade:consumer、finance:borrower）单独列出来，不能弄丢。 */
  const otherCodes = useMemo(() => {
    const matrixKeys = new Set<string>()
    modules.forEach((module) => ACTIONS.forEach((action) => matrixKeys.add(`${module}:${action}`)))
    return Array.from(selected).filter((perm) => perm !== '*' && !matrixKeys.has(perm))
  }, [modules, selected])

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="角色权限"
        title="权限矩阵"
        description="行是业务域，列是动作；勾选即改，保存后写入 platform_role.permissions 并即时生效"
        actions={
          <>
            <Select
              value={active}
              style={{ width: 220 }}
              loading={loading}
              options={roles.map((role) => ({
                value: role.code,
                label: `${role.name || roleText(role.code)}（${role.code}）`,
              }))}
              onChange={(value) => setActive(value)}
            />
            <Button onClick={() => loadPermissions(active)}>重置</Button>
            <Button type="primary" loading={saving} disabled={!dirty} onClick={save}>
              保存权限配置
            </Button>
          </>
        }
      />

      {error && <ErrorBlock message={error} onRetry={() => loadPermissions(active)} />}

      {wildcard && (
        <div className="uc-inline-note">
          当前角色是通配权限（<code>*</code>），拥有全部业务域的读写权。要改成细粒度授权，
          请先取消通配再逐项勾选 —— 保存时会整体覆盖。
        </div>
      )}

      <section className="surface-card">
        <SectionHeading
          kicker="菜单 / 功能权限"
          title={`${active || '未选择角色'} · 已选 ${selected.size} 项`}
        />
        <Table
          rowKey="module"
          className="uc-matrix"
          size="small"
          pagination={false}
          dataSource={modules.map((module) => ({ module }))}
          columns={[
            {
              title: '业务域',
              dataIndex: 'module',
              render: (value: string) => (
                <div>
                  <b>{MODULE_LABEL[value] ?? value}</b>
                  <span className="small muted"> · {value}</span>
                </div>
              ),
            },
            ...ACTIONS.map((action) => ({
              title: action.label,
              key: action.key,
              width: 100,
              render: (_: unknown, row: { module: string }) => (
                <Checkbox
                  checked={wildcard || selected.has(`${row.module}:${action.key}`)}
                  disabled={wildcard}
                  onChange={() => toggle(row.module, action.key)}
                />
              ),
            })),
          ]}
        />
      </section>

      {otherCodes.length > 0 && (
        <section className="surface-card">
          <SectionHeading
            kicker="其它权限码"
            title="不在矩阵列里的授权"
            action=""
          />
          <div className="tag-row">
            {otherCodes.map((perm) => (
              <Tag
                key={perm}
                className="soft-tag"
                closable
                onClose={() => {
                  const next = new Set(selected)
                  next.delete(perm)
                  setSelected(next)
                  setDirty(true)
                }}
              >
                {perm}
              </Tag>
            ))}
          </div>
          <div className="uc-inline-note">
            这些是「身份型」权限（如 <code>finance:borrower</code>、<code>trade:consumer</code>），
            不是增删改查，所以没有放进矩阵的列里。直接删标签即可收回。
          </div>
        </section>
      )}
    </div>
  )
}
