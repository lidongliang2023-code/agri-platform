import { useEffect, useState } from 'react'
import { Alert, App, Button, Input, Modal, Table, Tag } from 'antd'
import { opsApi, type OpsExpert } from './api'

export function ExpertsPage(): JSX.Element {
  const { message, modal } = App.useApp()
  const [items, setItems] = useState<OpsExpert[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState<OpsExpert | null>(null)
  const [userId, setUserId] = useState('')
  const [saving, setSaving] = useState(false)
  async function load(): Promise<void> {
    setLoading(true); setError('')
    try { setItems(await opsApi.experts()) }
    catch (e) { setError(e instanceof Error ? e.message : '加载失败') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  async function save(): Promise<void> {
    if (!active || saving) return
    if (!/^[1-9]\d*$/.test(userId.trim())) { message.warning('请填写有效的统一账号编号'); return }
    setSaving(true)
    try { await opsApi.bindExpert(active.id, userId.trim()); setActive(null); message.success('专家账号已绑定'); await load() }
    catch (e) { message.error(e instanceof Error ? e.message : '绑定失败') }
    finally { setSaving(false) }
  }
  function unbind(row: OpsExpert): void {
    modal.confirm({ title: `解除 ${row.name} 的账号绑定？`, content: `账号 ${row.userId} 将失去该专家工作台访问权限，既有回复留痕保留。`, okText: '解除绑定', cancelText: '取消', async onOk() {
      try { await opsApi.bindExpert(row.id, null); message.success('已解除绑定'); await load() }
      catch (e) { message.error(e instanceof Error ? e.message : '解绑失败'); throw e }
    } })
  }
  return <div className="ops-page"><div className="ops-page-title"><div><h1>专家账号绑定</h1><p>将已核实的专家档案绑定到本人统一账号，专家登录移动端后在“我的 → 专家工作台”回复问诊。</p></div><Button onClick={() => void load()}>刷新</Button></div>
    <Alert type="info" showIcon message="绑定要求" description="一位专家对应一个统一账号。账号须已启用，并具有 service:read / service:write 权限。绑定操作还需平台用户查询权限；不会自动新增角色或扩大账号权限。" />
    {error && <Alert type="error" showIcon message={error} />}
    <section className="ops-card ops-table-card"><Table<OpsExpert> rowKey="id" loading={loading} dataSource={items} pagination={{ defaultPageSize: 20, showSizeChanger: true, showQuickJumper: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (total) => `共 ${total} 条` }} columns={[
      { title: '专家', render: (_, row) => <><b>{row.name}</b><div>{row.title} · {row.organization}</div></> },
      { title: '领域', dataIndex: 'category' },
      { title: '状态', render: (_, row) => <Tag color={row.status === 'available' ? 'green' : 'orange'}>{row.status === 'available' ? '可接诊' : '暂停接诊'}</Tag> },
      { title: '统一账号', render: (_, row) => row.userId ? `${row.accountName || ''}（${row.userId}）` : '未绑定' },
      { title: '操作', render: (_, row) => <><Button type="link" onClick={() => { setActive(row); setUserId(row.userId || '') }}>{row.userId ? '更换绑定' : '绑定账号'}</Button>{row.userId && <Button type="link" danger onClick={() => unbind(row)}>解除绑定</Button>}</> },
    ]} /></section>
    <Modal title={`绑定专家：${active?.name || ''}`} open={!!active} confirmLoading={saving} onCancel={() => { if (!saving) setActive(null) }} onOk={() => void save()} okText="保存绑定" cancelText="取消"><p>请填写已核实属于该专家本人的统一账号编号；系统将验证账号有效性并记录操作人。</p><Input aria-label="统一账号编号" value={userId} disabled={saving} onChange={e => setUserId(e.target.value)} placeholder="统一用户中心中的账号编号" /></Modal>
  </div>
}
