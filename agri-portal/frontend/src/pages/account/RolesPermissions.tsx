import { useEffect, useMemo, useState } from 'react'
import { productionApi } from './productionApi'
import {
  ACTION_LABELS,
  DATA_SCOPES,
  PERMISSION_GROUPS,
  ROLE_TEMPLATES,
} from './teamModel'
import type { ProductionRole } from './teamModel'
import './account-team.css'

interface Props {
  merchantId: string | null
  merchantName: string | null
  onNotice: (message: string) => void
  onError: (message: string) => void
}

export function RolesPermissions({ merchantId, merchantName, onNotice, onError }: Props): JSX.Element {
  const [roles, setRoles] = useState<ProductionRole[]>([])
  const [activeRole, setActiveRole] = useState<ProductionRole | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [dataScope, setDataScope] = useState('TENANT')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [keyword, setKeyword] = useState('')

  const load = async (): Promise<void> => {
    if (!merchantId) {
      setRoles([])
      return
    }
    setLoading(true)
    try {
      setRoles(await productionApi<ProductionRole[]>('/members/roles'))
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setActiveRole(null)
    void load()
  }, [merchantId])

  const visibleRoles = useMemo(() => roles.filter((role) =>
    !keyword.trim()
    || `${role.roleName}${role.roleCode}${role.description || ''}`
      .toLowerCase().includes(keyword.trim().toLowerCase())), [roles, keyword])

  const openRole = (role: ProductionRole): void => {
    setActiveRole(role)
    setPermissions([...role.permissions])
    setDataScope(role.dataScope || 'TENANT')
  }

  const togglePermission = (code: string): void => {
    setPermissions((current) => current.includes(code)
      ? current.filter((item) => item !== code)
      : [...current, code])
  }

  const toggleGroup = (domain: string, action: string, checked: boolean): void => {
    const group = PERMISSION_GROUPS.find((item) => item.domain === domain)
    if (!group) return
    const codes = group.resources.map((resource) => `${group.domain}.${resource.code}.${action}`)
    setPermissions((current) => checked
      ? Array.from(new Set([...current, ...codes]))
      : current.filter((code) => !codes.includes(code)))
  }

  const save = async (): Promise<void> => {
    if (!activeRole) return
    setBusy(true)
    try {
      const updated = await productionApi<ProductionRole>(
        `/members/roles/${encodeURIComponent(activeRole.roleId)}/permissions`,
        { method: 'PUT', body: JSON.stringify({ permissions, dataScope }) },
      )
      setRoles((current) => current.map((role) => role.roleId === updated.roleId ? updated : role))
      setActiveRole(updated)
      onNotice(`「${updated.roleName}」权限已保存`)
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-team-panel">
      <div className="account-subject-strip">
        <div><span>当前经营主体</span><strong>{merchantName || '未选择主体'}</strong></div>
        <small>角色、权限点和数据范围仅对本主体成员生效</small>
      </div>
      <div className="card account-card">
        <div className="account-card-head">
          <h2>角色与权限</h2>
          <span>{roles.length} 个主体角色</span>
        </div>
        <div className="account-business-search">
          <input className="input" value={keyword} placeholder="搜索角色名称或编码" onChange={(event) => setKeyword(event.target.value)} />
          <button className="btn btn-outline" disabled={loading} onClick={() => void load()}>刷新</button>
        </div>
        <div className="account-role-grid">
          {visibleRoles.map((role) => (
            <button type="button" className={`account-role-card ${activeRole?.roleId === role.roleId ? 'on' : ''}`} key={role.roleId} onClick={() => openRole(role)}>
              <span><strong>{role.roleName}</strong><small>{role.roleCode}</small></span>
              <b>{role.permissions.length} 个权限 · {role.memberCount} 人</b>
              <em>{role.description || '暂无职责说明'}</em>
            </button>
          ))}
          {!visibleRoles.length && <div className="account-team-empty">{loading ? '加载中…' : merchantId ? '当前主体暂无角色' : '暂无可操作主体'}</div>}
        </div>
      </div>

      {activeRole && (
        <div className="card account-card">
          <div className="account-card-head">
            <h2>配置权限 · {activeRole.roleName}</h2>
            <div className="account-form-actions">
              <select className="select account-scope-select" value={dataScope} onChange={(event) => setDataScope(event.target.value)}>
                {DATA_SCOPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? '保存中…' : '保存权限'}</button>
            </div>
          </div>
          <div className="account-permission-toolbar">
            <span>已选 <b>{permissions.length}</b> 个权限点</span>
            <button type="button" onClick={() => setPermissions(ROLE_TEMPLATES[activeRole.roleCode] || [])}>按角色模板填充</button>
            <button type="button" onClick={() => setPermissions([])}>清空</button>
          </div>
          <div className="account-permission-groups">
            {PERMISSION_GROUPS.map((group) => (
              <section className="account-permission-group" key={group.domain}>
                <h3>{group.name}<small>{group.domain}</small></h3>
                <div className="account-permission-actions">
                  {group.actions.map((action) => <span key={action}>{ACTION_LABELS[action] || action}</span>)}
                </div>
                <div className="account-permission-resources">
                  {group.resources.map((resource) => (
                    <div key={resource.code}>
                      <strong>{resource.name}</strong>
                      <span>
                        {group.actions.map((action) => {
                          const code = `${group.domain}.${resource.code}.${action}`
                          return (
                            <label key={code}>
                              <input type="checkbox" checked={permissions.includes(code)} onChange={() => togglePermission(code)} />
                              {ACTION_LABELS[action] || action}
                            </label>
                          )
                        })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="account-permission-batch">
                  {group.actions.map((action) => {
                    const codes = group.resources.map((resource) => `${group.domain}.${resource.code}.${action}`)
                    const allChecked = codes.every((code) => permissions.includes(code))
                    return <button type="button" key={action} onClick={() => toggleGroup(group.domain, action, !allChecked)}>{allChecked ? '清除' : '全选'}「{ACTION_LABELS[action] || action}」</button>
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
