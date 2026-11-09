import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
  Collapse,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useApp } from '../app-context'
import { ucApi } from '../api'
import { ErrorBlock, PageTitle, SectionHeading, formatTime, roleText } from '../components/ui'
import type { RoleRecord } from '../types'

/**
 * 权限码形如 `info:read` / `trade:write`；`*` 表示全权限（超级管理员）。
 *
 * <p>分层约定：`read` 是菜单级权限（能进入业务域、看到列表），其余为操作级
 * （新增/编辑、删除、导出、审核、管理）。菜单只是前端骨架，授权挂载点始终是
 * 权限码；矩阵里用视觉分组把两层区分开，而不是再造一张菜单权限表。</p>
 */
const MENU_ACTION = 'read'
const ACTION_LABEL: Record<string, string> = {
  read: '查看',
  write: '新增/编辑',
  delete: '删除',
  export: '导出',
  audit: '审核',
  admin: '管理',
}
const ACTIONS: Array<{ key: string; label: string }> = Object.entries(ACTION_LABEL)
  .map(([key, label]) => ({ key, label }))
const OPERATION_ACTIONS = ACTIONS.filter((action) => action.key !== MENU_ACTION)

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

/** 固定业务域顺序；角色里出现但未登记的前缀追加在后。 */
const KNOWN_MODULES = ['info', 'trade', 'produce', 'iot', 'finance', 's2b2c', 'service', 'gov', 'mdm', 'uc', 'user']

function moduleLabel(module: string): string {
  return MODULE_LABEL[module] ?? module
}

function permissionLabel(code: string): string {
  if (code === '*') return '全部权限'
  const [module, action] = code.split(':')
  return `${moduleLabel(module ?? code)}·${ACTION_LABEL[action] ?? action ?? '未知'}`
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

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((item) => rightSet.has(item))
}

/* ==================== 角色管理 ==================== */

type RoleFormState = { mode: 'create' } | { mode: 'edit'; role: RoleRecord } | null

/** 权限预览：可读名称 + 有限项 + 悬浮查看全部，避免列宽截断或只显示原始权限码。 */
function PermissionPreview({ raw }: { raw: string }): JSX.Element {
  const list = parsePermissions(raw)
  if (list.includes('*')) {
    return <Tag className="soft-tag tone-green">全部权限</Tag>
  }
  if (list.length === 0) {
    return <span className="small muted">未配置</span>
  }
  const visible = list.slice(0, 3)
  return (
    <Popover
      trigger="click"
      placement="topLeft"
      title={`全部权限（${list.length} 项）`}
      content={(
        <div className="tag-row" style={{ maxWidth: 360, maxHeight: 260, overflow: 'auto' }}>
          {list.map((code) => (
            <Tag key={code} className="soft-tag">{permissionLabel(code)}</Tag>
          ))}
        </div>
      )}
    >
      <div className="tag-row" style={{ cursor: 'pointer' }} title={list.map(permissionLabel).join('、')}>
        {visible.map((code) => (
          <Tag key={code} className="soft-tag">{permissionLabel(code)}</Tag>
        ))}
        {list.length > visible.length && (
          <Tag className="soft-tag">等 {list.length} 项</Tag>
        )}
      </div>
    </Popover>
  )
}

export function RoleListPage(): JSX.Element {
  const { navigate } = useApp()
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formState, setFormState] = useState<RoleFormState>(null)
  const [submitting, setSubmitting] = useState(false)
  const [detail, setDetail] = useState<RoleRecord | null>(null)
  const [detailPermissions, setDetailPermissions] = useState<string[]>([])
  const [form] = Form.useForm<{ code: string; name: string; description?: string }>()

  const loadRoles = (): void => {
    setLoading(true)
    setError('')
    ucApi.roles()
      .then(setRoles)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadRoles, [])

  const filtered = useMemo(
    () => roles.filter((role) => {
      if (statusFilter && (role.status || 'enabled') !== statusFilter) return false
      if (!keyword) return true
      const text = `${role.code} ${role.name} ${role.description ?? ''}`.toLowerCase()
      return text.includes(keyword.toLowerCase())
    }),
    [roles, keyword, statusFilter],
  )

  const enabledCount = roles.filter((role) => (role.status || 'enabled') === 'enabled').length
  const paged = filtered.slice((pageNum - 1) * pageSize, pageNum * pageSize)

  const openCreate = (): void => {
    setFormState({ mode: 'create' })
    form.resetFields()
  }

  const openEdit = (role: RoleRecord): void => {
    setFormState({ mode: 'edit', role })
    form.setFieldsValue({
      code: role.code,
      name: role.name || roleText(role.code),
      description: role.description ?? '',
    })
  }

  const submitForm = async (): Promise<void> => {
    let values: { code: string; name: string; description?: string }
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const code = values.code.trim()
    const name = values.name.trim()
    if (formState?.mode === 'create'
      && roles.some((role) => role.code.toLowerCase() === code.toLowerCase())) {
      message.error('角色编码已存在，请换一个')
      return
    }
    setSubmitting(true)
    try {
      if (formState?.mode === 'edit') {
        await ucApi.updateRole(formState.role.code, {
          name,
          description: values.description?.trim() ?? '',
        })
        message.success('角色已更新')
      } else {
        await ucApi.createRole({ code, name, description: values.description?.trim() })
        message.success('角色已创建，可以继续配置权限')
      }
      setFormState(null)
      loadRoles()
    } catch (reason) {
      message.error((reason as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = async (role: RoleRecord): Promise<void> => {
    const next = (role.status || 'enabled') === 'disabled' ? 'enabled' : 'disabled'
    try {
      await ucApi.updateRole(role.code, { status: next })
      message.success(next === 'enabled' ? '角色已启用' : '角色已停用')
      loadRoles()
    } catch (reason) {
      message.error((reason as Error).message)
    }
  }

  const removeRole = async (role: RoleRecord): Promise<void> => {
    try {
      await ucApi.deleteRole(role.code)
      message.success('角色已删除')
      loadRoles()
    } catch (reason) {
      // 后端对「仍被用户绑定」「内置角色」会返回明确原因，原样展示，不静默失败
      message.error((reason as Error).message)
    }
  }

  const openDetail = (role: RoleRecord): void => {
    setDetail(role)
    setDetailPermissions([])
    ucApi.rolePermissions(role.code)
      .then(setDetailPermissions)
      .catch((reason: Error) => message.error(reason.message))
  }

  const columns: ColumnsType<RoleRecord> = [
    {
      title: '角色名称 / 编码',
      dataIndex: 'name',
      render: (value: string, row) => (
        <div>
          <b>{value || roleText(row.code)}</b>
          <div className="small muted">{row.code}</div>
        </div>
      ),
    },
    {
      title: '适用层级',
      width: 110,
      render: () => <Tag className="soft-tag">平台级</Tag>,
    },
    {
      title: '成员数',
      dataIndex: 'memberCount',
      width: 90,
      render: (value: number | null) => (value ? `${value} 人` : '0 人'),
    },
    {
      title: '权限',
      width: 90,
      render: (_, row) => {
        const list = parsePermissions(row.permissions)
        return list.includes('*') ? '全部' : `${list.length} 项`
      },
    },
    {
      title: '权限预览',
      dataIndex: 'permissions',
      render: (value: string) => <PermissionPreview raw={value} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => (
        value === 'disabled'
          ? <Tag className="soft-tag">已停用</Tag>
          : <Tag className="soft-tag tone-green">启用中</Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 150,
      render: (value: string, row) => formatTime(value ?? row.createdAt),
    },
    {
      title: '操作',
      width: 220,
      render: (_, row) => (
        <Space size={4} wrap>
          <Button size="small" type="primary" ghost onClick={() => navigate('perm-matrix', undefined, { code: row.code })}>
            配置权限
          </Button>
          <Button size="small" type="link" onClick={() => openDetail(row)}>详情</Button>
          <Button size="small" type="link" onClick={() => openEdit(row)}>编辑</Button>
          <Button size="small" type="link" onClick={() => void toggleStatus(row)}>
            {(row.status || 'enabled') === 'disabled' ? '启用' : '停用'}
          </Button>
          <Popconfirm
            title="删除角色"
            description="删除后该角色的权限配置一并失效，且无法恢复。"
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => removeRole(row)}
          >
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="角色权限"
        title="角色管理"
        description="平台级角色的名称、成员、授权与启停。组织级角色归主数据域，不在此处维护"
        actions={<Button type="primary" onClick={openCreate}>新建角色</Button>}
      />

      <div className="grid-3">
        <div className="stat-tile">
          <span className="stat-label">角色总数</span>
          <b className="stat-value">{roles.length}<small>个</small></b>
          <span className="stat-note">平台级角色</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">启用中</span>
          <b className="stat-value">{enabledCount}<small>个</small></b>
          <span className="stat-note">参与授权判定</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">已停用</span>
          <b className="stat-value">{roles.length - enabledCount}<small>个</small></b>
          <span className="stat-note">保留配置但不生效</span>
        </div>
      </div>

      <section className="surface-card list-card">
        <div className="list-toolbar">
          <Input
            value={draft}
            placeholder="搜角色编码 / 名称 / 说明"
            style={{ width: 260 }}
            onChange={(event) => setDraft(event.target.value)}
            onPressEnter={() => { setKeyword(draft.trim()); setPageNum(1) }}
          />
          <Button type="primary" onClick={() => { setKeyword(draft.trim()); setPageNum(1) }}>搜索</Button>
          <Select
            value={statusFilter}
            style={{ width: 140 }}
            options={[
              { label: '全部状态', value: '' },
              { label: '启用中', value: 'enabled' },
              { label: '已停用', value: 'disabled' },
            ]}
            onChange={(value) => { setStatusFilter(value); setPageNum(1) }}
          />
          {(keyword || statusFilter) && (
            <Button
              type="link"
              onClick={() => {
                setDraft('')
                setKeyword('')
                setStatusFilter('')
                setPageNum(1)
              }}
            >
              清空筛选
            </Button>
          )}
        </div>

        {error && <ErrorBlock message={error} onRetry={loadRoles} />}
        {!error && (
          <Table
            className="agri-list-table"
            rowKey="id"
            size="middle"
            loading={loading}
            columns={columns}
            dataSource={paged}
            scroll={{ x: 1180 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={keyword || statusFilter ? '没有符合条件的角色' : '还没有角色，先新建一个'}
                >
                  {!keyword && !statusFilter && <Button type="primary" onClick={openCreate}>新建角色</Button>}
                </Empty>
              ),
            }}
            pagination={{
              current: pageNum,
              pageSize,
              total: filtered.length,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (count) => `共 ${count} 个角色`,
              onChange: (next, nextSize) => {
                setPageNum(next)
                if (nextSize && nextSize !== pageSize) {
                  setPageSize(nextSize)
                  setPageNum(1)
                }
              },
            }}
          />
        )}
      </section>

      <Modal
        open={Boolean(formState)}
        title={formState?.mode === 'edit' ? '编辑角色' : '新建角色'}
        okText={formState?.mode === 'edit' ? '保存' : '创建'}
        confirmLoading={submitting}
        onCancel={() => setFormState(null)}
        onOk={() => void submitForm()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="code"
            label="角色编码"
            rules={[
              { required: true, message: '请输入角色编码' },
              { pattern: /^[A-Za-z][A-Za-z0-9_-]{1,63}$/, message: '以字母开头，仅允许字母、数字、下划线、短横线，2-64 位' },
            ]}
            extra={formState?.mode === 'edit' ? '编码是权限与绑定的业务主键，创建后不可修改' : '创建后不可修改，建议用大写常量，如 FARM_OPERATOR'}
          >
            <Input disabled={formState?.mode === 'edit'} maxLength={64} placeholder="例如 FARM_OPERATOR" />
          </Form.Item>
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }, { max: 128, message: '不超过 128 字' }]}
          >
            <Input maxLength={128} placeholder="例如 农场运营员" />
          </Form.Item>
          <Form.Item name="description" label="角色说明" rules={[{ max: 255, message: '不超过 255 字' }]}>
            <Input.TextArea rows={3} maxLength={255} placeholder="这个角色负责什么、给谁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(detail)}
        title={detail ? `角色详情 · ${detail.name || roleText(detail.code)}` : '角色详情'}
        width={720}
        onCancel={() => setDetail(null)}
        footer={(
          <Space>
            <Button onClick={() => setDetail(null)}>关闭</Button>
            {detail && (
              <Button
                type="primary"
                onClick={() => {
                  const code = detail.code
                  setDetail(null)
                  navigate('perm-matrix', undefined, { code })
                }}
              >
                配置权限
              </Button>
            )}
          </Space>
        )}
      >
        {detail && (
          <div className="stack">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="角色名称">{detail.name || roleText(detail.code)}</Descriptions.Item>
              <Descriptions.Item label="角色编码">{detail.code}</Descriptions.Item>
              <Descriptions.Item label="适用层级">平台级</Descriptions.Item>
              <Descriptions.Item label="状态">
                {(detail.status || 'enabled') === 'disabled' ? '已停用' : '启用中'}
              </Descriptions.Item>
              <Descriptions.Item label="成员数">{detail.memberCount ?? 0} 人</Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {formatTime(detail.updatedAt ?? detail.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="角色说明" span={2}>{detail.description || '—'}</Descriptions.Item>
            </Descriptions>
            <SectionHeading kicker="已分配权限" title={`${detailPermissions.length} 项`} />
            {detailPermissions.length === 0
              ? <div className="small muted">尚未配置权限</div>
              : (
                <div className="tag-row">
                  {detailPermissions.map((code) => (
                    <Tag key={code} className="soft-tag">{permissionLabel(code)}</Tag>
                  ))}
                </div>
              )}
          </div>
        )}
      </Modal>
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

  const switchRole = (next: string): void => {
    if (next === active) return
    if (!dirty) {
      setActive(next)
      return
    }
    Modal.confirm({
      title: '当前角色有未保存的勾选',
      content: '切换角色会丢失这些未保存的改动。',
      okText: '放弃并切换',
      cancelText: '继续编辑',
      onOk: () => setActive(next),
    })
  }

  /** 矩阵的行：所有角色出现过的模块前缀，加上已知业务域。 */
  const modules = useMemo(() => {
    const found = new Set<string>(KNOWN_MODULES)
    roles.forEach((role) => {
      parsePermissions(role.permissions).forEach((perm) => {
        const prefix = perm.split(':')[0]
        if (prefix && prefix !== '*') found.add(prefix)
      })
    })
    const sorted = KNOWN_MODULES.filter((module) => found.has(module))
    const extra = Array.from(found).filter((module) => !KNOWN_MODULES.includes(module)).sort()
    return [...sorted, ...extra]
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

  const matrixCodes = useMemo(
    () => modules.flatMap((module) => ACTIONS.map((action) => `${module}:${action.key}`)),
    [modules],
  )

  /** 通配角色下矩阵只读：批量操作先要求「转为细粒度」，避免把 `*` 和细粒度码混存。 */
  const blockWildcard = (): boolean => {
    if (wildcard) {
      message.info('当前是通配权限，请先点「转为细粒度」再编辑')
      return true
    }
    return false
  }

  const selectAll = (): void => {
    if (blockWildcard()) return
    const next = new Set(selected)
    matrixCodes.forEach((perm) => next.add(perm))
    setSelected(next)
    setDirty(true)
  }

  const invertSelection = (): void => {
    if (blockWildcard()) return
    const next = new Set(selected)
    matrixCodes.forEach((perm) => {
      if (next.has(perm)) next.delete(perm)
      else next.add(perm)
    })
    setSelected(next)
    setDirty(true)
  }

  const clearMatrix = (): void => {
    if (blockWildcard()) return
    const next = new Set(selected)
    matrixCodes.forEach((perm) => next.delete(perm))
    setSelected(next)
    setDirty(true)
  }

  const selectModule = (module: string, checked: boolean): void => {
    if (blockWildcard()) return
    const next = new Set(selected)
    ACTIONS.forEach((action) => {
      const perm = `${module}:${action.key}`
      if (checked) next.add(perm)
      else next.delete(perm)
    })
    setSelected(next)
    setDirty(true)
  }

  const dropWildcard = (): void => {
    const next = new Set(selected)
    next.delete('*')
    matrixCodes.forEach((perm) => next.add(perm))
    setSelected(next)
    setDirty(true)
  }

  const save = async (): Promise<void> => {
    if (!active) return
    setSaving(true)
    const payload = Array.from(selected)
    try {
      await ucApi.saveRolePermissions(active, payload)
      // 保存后必须回读：接口成功不等于真的落库，回读不一致要明确报错
      const readback = await ucApi.rolePermissions(active)
      if (!sameSet(payload, readback)) {
        throw new Error('保存后回读不一致，请刷新页面后重试')
      }
      setSelected(new Set(readback))
      setDirty(false)
      message.success('权限已保存，并通过回读校验')
    } catch (reason) {
      message.error((reason as Error).message)
    } finally {
      setSaving(false)
    }
  }

  /** 不在矩阵列里的权限码（如 trade:consumer、finance:borrower）单独列出来，不能弄丢。 */
  const otherCodes = useMemo(() => {
    const matrixKeys = new Set(matrixCodes)
    return Array.from(selected).filter((perm) => perm !== '*' && !matrixKeys.has(perm))
  }, [matrixCodes, selected])

  const selectedCount = Array.from(selected).filter((perm) => perm !== '*').length

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="角色权限"
        title="权限矩阵"
        description="菜单级＝进入业务域，操作级＝写/删/导出/审核/管理；保存后整体覆盖 platform_role.permissions 并回读校验"
        actions={(
          <Space wrap>
            <Select
              value={active}
              style={{ width: 240 }}
              loading={loading}
              options={roles.map((role) => ({
                value: role.code,
                label: `${role.name || roleText(role.code)}（${role.code}）`,
              }))}
              onChange={switchRole}
            />
            <Button onClick={selectAll}>全选</Button>
            <Button onClick={invertSelection}>反选</Button>
            <Button onClick={clearMatrix}>清空矩阵</Button>
            <Button onClick={() => loadPermissions(active)}>重置</Button>
            <Button type="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>
              保存权限配置
            </Button>
          </Space>
        )}
      />

      {error && <ErrorBlock message={error} onRetry={() => loadPermissions(active)} />}

      {wildcard && (
        <div className="uc-inline-note">
          当前角色是通配权限（<code>*</code>），拥有全部业务域。要改成细粒度授权，
          先点「转为细粒度」，再按需勾选；保存时整体覆盖。
          <Button type="link" size="small" onClick={dropWildcard}>转为细粒度</Button>
        </div>
      )}

      <section className="surface-card list-card">
        <SectionHeading
          kicker="角色 × 权限点"
          title={`${active || '未选择角色'} · 已选 ${wildcard ? '全部' : `${selectedCount} 项`}${dirty ? ' · 未保存' : ''}`}
        />
        <Collapse
          className="perm-collapse"
          defaultActiveKey={modules.slice(0, 2)}
          items={modules.map((module) => {
            const moduleSelected = ACTIONS.filter((action) => selected.has(`${module}:${action.key}`)).length
            return {
              key: module,
              label: (
                <div className="perm-group-title">
                  <b>{moduleLabel(module)}</b>
                  <span className="small muted">{module} · 已选 {wildcard ? ACTIONS.length : moduleSelected}/{ACTIONS.length}</span>
                </div>
              ),
              extra: (
                <span onClick={(event) => event.stopPropagation()}>
                  <Space size={4}>
                    <Button size="small" type="link" onClick={() => selectModule(module, true)}>全选</Button>
                    <Button size="small" type="link" onClick={() => selectModule(module, false)}>清空</Button>
                  </Space>
                </span>
              ),
              children: (
                <div className="perm-panel">
                  <div className="perm-row perm-row--menu">
                    <span className="perm-row-label">菜单级</span>
                    <Checkbox
                      checked={wildcard || selected.has(`${module}:${MENU_ACTION}`)}
                      disabled={wildcard}
                      onChange={() => toggle(module, MENU_ACTION)}
                    >
                      {ACTION_LABEL[MENU_ACTION]}（进入该业务域 / 查看列表）
                    </Checkbox>
                  </div>
                  <div className="perm-row perm-row--action">
                    <span className="perm-row-label">操作级</span>
                    {OPERATION_ACTIONS.map((action) => (
                      <Checkbox
                        key={action.key}
                        checked={wildcard || selected.has(`${module}:${action.key}`)}
                        disabled={wildcard}
                        onChange={() => toggle(module, action.key)}
                      >
                        {action.label}
                      </Checkbox>
                    ))}
                  </div>
                </div>
              ),
            }
          })}
        />
      </section>

      {otherCodes.length > 0 && (
        <section className="surface-card list-card">
          <SectionHeading
            kicker="其它权限码"
            title="不在矩阵列里的授权"
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
                {permissionLabel(perm)}
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
