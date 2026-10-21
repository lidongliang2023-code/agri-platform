import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { productionApi } from './productionApi'
import { MEMBER_TYPES, roleLabel } from './teamModel'
import type { ProductionRole, TeamMember } from './teamModel'
import './account-team.css'

interface Props {
  merchantId: string | null
  merchantName: string | null
  onNotice: (message: string) => void
  onError: (message: string) => void
}

interface MemberPage {
  records: TeamMember[]
  total: number
}

const emptyForm = {
  memberName: '',
  phone: '',
  memberType: 'OPERATOR',
  roleCode: '',
  postName: '',
  joinDate: new Date().toISOString().slice(0, 10),
}

export function TeamMembers({ merchantId, merchantName, onNotice, onError }: Props): JSX.Element {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [roles, setRoles] = useState<ProductionRole[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [form, setForm] = useState({ ...emptyForm })

  const load = async (): Promise<void> => {
    if (!merchantId) {
      setMembers([])
      setRoles([])
      return
    }
    setLoading(true)
    try {
      const query = new URLSearchParams({ pageNum: '1', pageSize: '200' })
      if (keyword.trim()) query.set('keyword', keyword.trim())
      const [memberPage, roleRows] = await Promise.all([
        productionApi<MemberPage>(`/members?${query.toString()}`),
        productionApi<ProductionRole[]>('/members/roles'),
      ])
      setMembers(memberPage.records ?? [])
      setRoles(roleRows ?? [])
      setForm((current) => ({
        ...current,
        roleCode: current.roleCode || roleRows?.[0]?.roleCode || '',
      }))
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [merchantId])

  const openCreate = (): void => {
    setEditing(null)
    setForm({ ...emptyForm, roleCode: roles[0]?.roleCode || '' })
    setFormOpen(true)
  }

  const openEdit = (member: TeamMember): void => {
    setEditing(member)
    setForm({
      memberName: member.realName,
      phone: member.phone,
      memberType: member.memberType,
      roleCode: member.roleCode || roles[0]?.roleCode || '',
      postName: member.position || '',
      joinDate: member.joinedAt || new Date().toISOString().slice(0, 10),
    })
    setFormOpen(true)
  }

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!form.memberName.trim()) return onError('请填写成员姓名')
    if (!/^1[3-9]\d{9}$/.test(form.phone.trim())) return onError('请填写正确的 11 位手机号')
    if (!form.roleCode) return onError('请选择主体内角色')
    setBusy(true)
    try {
      if (editing) {
        await productionApi(`/members/${encodeURIComponent(editing.memberId)}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        })
        onNotice('成员信息已更新')
      } else {
        await productionApi('/members', {
          method: 'POST',
          body: JSON.stringify({ ...form, status: 2 }),
        })
        onNotice('成员邀请已提交，状态为待激活')
      }
      setFormOpen(false)
      await load()
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (member: TeamMember, status: number): Promise<void> => {
    setBusy(true)
    try {
      await productionApi(`/members/${encodeURIComponent(member.memberId)}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      onNotice(status === 1 ? '成员已启用' : '成员已停用')
      await load()
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (member: TeamMember): Promise<void> => {
    if (!window.confirm(`确认移除成员「${member.realName}」？`)) return
    setBusy(true)
    try {
      await productionApi(`/members/${encodeURIComponent(member.memberId)}`, { method: 'DELETE' })
      onNotice('成员已移除')
      await load()
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
        <small>{merchantId ? `主体 ID：${merchantId}` : '请先在主体资料中完成主体创建或切换'}</small>
      </div>
      <div className="card account-card">
        <div className="account-card-head">
          <h2>团队与成员</h2>
          <button className="btn btn-primary" disabled={!merchantId || busy} onClick={openCreate}>邀请成员</button>
        </div>
        <form className="account-business-search" onSubmit={(event) => { event.preventDefault(); void load() }}>
          <input className="input" value={keyword} placeholder="搜索姓名或手机号" onChange={(event) => setKeyword(event.target.value)} />
          <button className="btn btn-outline" disabled={loading}>搜索</button>
        </form>
        <div className="account-team-table-wrap">
          <table className="account-team-table">
            <thead><tr><th>姓名</th><th>手机号</th><th>岗位</th><th>角色</th><th>状态</th><th>加入时间</th><th>操作</th></tr></thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.memberId}>
                  <td><strong>{member.realName}</strong></td>
                  <td>{member.phone}</td>
                  <td>{member.position || '—'}</td>
                  <td>{roleLabel(member.roleCode, roles)}</td>
                  <td><span className={`account-status ${member.status === 1 ? 'green' : member.status === 2 ? 'amber' : 'ghost'}`}>{member.status === 1 ? '在职' : member.status === 2 ? '待激活' : '已停用'}</span></td>
                  <td>{member.joinedAt || '—'}</td>
                  <td className="account-team-actions">
                    <button type="button" onClick={() => openEdit(member)}>编辑</button>
                    <button type="button" onClick={() => void changeStatus(member, member.status === 1 ? 0 : 1)}>{member.status === 1 ? '停用' : '启用'}</button>
                    <button type="button" className="danger" onClick={() => void remove(member)}>移除</button>
                  </td>
                </tr>
              ))}
              {!members.length && <tr><td colSpan={7} className="account-team-empty">{loading ? '加载中…' : merchantId ? '当前主体暂无团队成员' : '暂无可操作主体'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="account-modal-mask" onClick={() => setFormOpen(false)}>
          <form className="account-modal account-team-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => void save(event)}>
            <div className="account-card-head">
              <h2>{editing ? '编辑成员' : '邀请成员'}</h2>
              <button type="button" className="account-modal-close" onClick={() => setFormOpen(false)}>×</button>
            </div>
            <div className="account-form-grid">
              <label>姓名<input className="input" value={form.memberName} onChange={(event) => setForm({ ...form, memberName: event.target.value })} /></label>
              <label>手机号<input className="input" maxLength={11} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, '') })} /></label>
              <label>成员类型<select className="select" value={form.memberType} onChange={(event) => setForm({ ...form, memberType: event.target.value })}>{MEMBER_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label>分配角色<select className="select" value={form.roleCode} onChange={(event) => setForm({ ...form, roleCode: event.target.value })}>{roles.map((role) => <option key={role.roleId} value={role.roleCode}>{role.roleName}</option>)}</select></label>
              <label>岗位<input className="input" value={form.postName} placeholder="如：种植技术员" onChange={(event) => setForm({ ...form, postName: event.target.value })} /></label>
              <label>加入日期<input className="input" type="date" value={form.joinDate} onChange={(event) => setForm({ ...form, joinDate: event.target.value })} /></label>
            </div>
            <p className="muted">成员与角色均绑定当前主体「{merchantName || '—'}」，切换主体后不会混用。</p>
            <div className="account-form-actions">
              <button className="btn btn-primary" disabled={busy}>{busy ? '保存中…' : editing ? '保存修改' : '发送邀请'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)}>取消</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
