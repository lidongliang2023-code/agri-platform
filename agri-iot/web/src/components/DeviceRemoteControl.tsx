import { useEffect, useRef, useState } from 'react'
import { App, Button, Radio, Tag } from 'antd'
import { ReloadOutlined, SendOutlined } from '@ant-design/icons'
import type { CommandReceipt } from '../../../shared-ui/CommandReceipts'
import { CommandSubmissionError, iotApi, type IotDevice } from '../api/iotExperience'
import './device-remote-control.css'

const actions = [
  { value: '开启设备', label: '开启', hint: '申请启动设备，请确认现场具备启动条件。' },
  { value: '关闭设备', label: '关闭', hint: '可能中断当前作业，请确认可以停止设备。' },
  { value: '重启设备', label: '重启', hint: '将暂时中断设备连接与作业，请确认现场允许重启。' },
]
const statusMeta: Record<string, { label: string; color?: string }> = {
  PENDING: { label: '待领取', color: 'gold' },
  SENT: { label: '待回执', color: 'blue' },
  RUNNING: { label: '执行中', color: 'blue' },
  SUCCEEDED: { label: '回执成功', color: 'green' },
  FAILED: { label: '回执失败', color: 'red' },
  TIMEOUT: { label: '超时待核实', color: 'orange' },
  EXPIRED: { label: '未领取已过期', color: 'default' },
  LEGACY: { label: '历史无回执' },
}
type PendingSubmission = { deviceId:number; action:string; requestNo:string }
const pendingKey=(id:number)=>`iot-control-pending-${id}`
const restorePending=(id:number):PendingSubmission|null=>{
  try { const v=JSON.parse(sessionStorage.getItem(pendingKey(id))||'null'); return v?.deviceId===id&&/^CMD[a-f0-9]{32}$/i.test(v.requestNo)&&actions.some(a=>a.value===v.action)?v:null } catch { return null }
}
const guidance:Record<string,string>={
  PENDING:'等待接入端领取；请勿重复提交。', SENT:'接入端已领取，请等待执行回执。',
  FAILED:'请核实失败原因和现场状态，排除故障后再申请；平台不会自动重发。',
  TIMEOUT:'执行结果未知，请核实现场、设备日志或联系运维，勿直接重发。',
  EXPIRED:'有效期内未领取，平台未下发；核实现场后可重新申请。',
}
const time = (value?: string | null) => value ? value.replace('T', ' ').replace(/(\d{2}:\d{2}:\d{2})\.\d+/, '$1') : '—'

export default function DeviceRemoteControl({ device }: { device: IotDevice }) {
  const { message, modal } = App.useApp()
  const [action, setAction] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [rows, setRows] = useState<CommandReceipt[]>([])
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [updatedAt, setUpdatedAt] = useState('')
  const recordScope=useRef('')
  const [submittedNo, setSubmittedNo] = useState('')
  const [pending,setPending]=useState<PendingSubmission|null>(()=>restorePending(device.id))
  const [submitError,setSubmitError]=useState('')
  const locked = useRef(false)
  const mounted = useRef(true)
  const activeDialog = useRef<{destroy:()=>void}>()
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;activeDialog.current?.destroy()}},[])
  useEffect(()=>{setPage(1);setAction(undefined);setSubmittedNo('');setSubmitError('');setPending(restorePending(device.id));activeDialog.current?.destroy();locked.current=false},[device.id])
  const clearPending=()=>{try{sessionStorage.removeItem(pendingKey(device.id))}catch{/* 会话存储不可用时保留内存状态 */}setPending(null)}
  const selection = actions.find(item => item.value === action)
  const disabled = device.status === 'disabled'
  const offline = device.onlineStatus === 'offline'

  useEffect(() => {
    let active = true, running = false
    const scope=`${device.id}:${page}`
    if(recordScope.current!==scope){setRows([]);setUpdatedAt('');setError('');recordScope.current=scope}
    const refresh = async () => {
      if (running) return
      running = true
      setBusy(true)
      try {
        const next = await iotApi.commandReceipts(device.id, page)
        if (active) {
          const saved=restorePending(device.id)
          if(saved&&next.some(row=>row.commandNo===saved.requestNo)) {
            try{sessionStorage.removeItem(pendingKey(device.id))}catch{/* 忽略存储不可用 */}
            setPending(null);setSubmitError('');setSubmittedNo(saved.requestNo)
          }
          setRows(next); setError(''); setUpdatedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false })) }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : '指令记录加载失败')
      } finally {
        running = false
        if (active) setBusy(false)
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [device.id, page, revision])

  const activeCommand=rows.find(row=>['PENDING','SENT','RUNNING'].includes(row.status))
  const confirm = (retry=false) => {
    const chosen=retry&&pending?actions.find(item=>item.value===pending.action):selection
    if (!chosen || locked.current || disabled || !device.controlCapable || (!retry&&(pending||busy||error||activeCommand))) return
    locked.current = true
    const command = chosen.value
    const request=retry&&pending?pending:{deviceId:device.id,action:command,requestNo:'CMD'+crypto.randomUUID().replace(/-/g,'')}
    const dialog = modal.confirm({
      title: retry ? `核对原申请：${command}` : `确认${command}？`,
      content: <div className="device-control-confirm">
        <p><b>{device.deviceName}</b></p><p>{device.deviceCode}</p>
        <p>{chosen.hint}</p>
        {offline && <p>设备当前离线，指令登记后仍需等待接入端领取。</p>}
        <p>{retry?`本次复用原提交编号 ${request.requestNo}；已登记则只返回原记录，未登记才创建申请。`:'指令有效期为 5 分钟，提交成功不代表设备执行成功，请以回执为准。'}</p>
      </div>,
      okText: '确认提交', cancelText: '取消', maskClosable: false,
      okButtonProps: { danger: command !== '开启设备' },
      onCancel: () => { locked.current = false },
      afterClose: () => { locked.current = false },
      onOk: async () => {
        setSubmitting(true)
        setPending(request);setSubmitError('')
        try{sessionStorage.setItem(pendingKey(device.id),JSON.stringify(request))}catch{/* 仍由内存保留原编号 */}
        dialog.update({ cancelButtonProps: { disabled: true }, closable: false, keyboard: false })
        try {
          const result = await iotApi.control(device.id, command, request.requestNo)
          if(!mounted.current)return
          clearPending();setSubmitError('')
          setSubmittedNo(String(result.commandNo || ''))
          setPage(1)
          setRevision(value => value + 1)
          setAction(undefined)
          message.success('申请记录已确认，请以下方实际回执为准')
        } catch (e) {
          if(!mounted.current)return
          const uncertain=!(e instanceof CommandSubmissionError)||e.uncertain
          const text=e instanceof Error?e.message:'指令提交结果尚未确认'
          setSubmitError(text)
          if(!uncertain)clearPending()
          setPage(1);setRevision(value=>value+1)
          message[uncertain?'warning':'error'](text)
        } finally { if(mounted.current)setSubmitting(false) }
      },
    })
    activeDialog.current=dialog
  }

  return <section className="device-remote-control" aria-label="远程控制">
    <header className="device-control-head">
      <div><h3>远程控制</h3><span>提交申请 → 接入端领取 → 执行回执</span></div>
      <Tag color={disabled ? undefined : offline ? 'orange' : 'green'}>{disabled ? '设备已停用' : offline ? '设备离线' : '设备在线'}</Tag>
    </header>
    {device.controlCapable ? <>
      <div className="device-control-form">
        <span className="device-control-label">控制动作</span>
        <Radio.Group value={action} onChange={event => setAction(event.target.value)} disabled={submitting || disabled || Boolean(pending)} optionType="button" buttonStyle="solid"
          options={actions.map(item => ({ value: item.value, label: item.label }))} />
        <Button type="primary" danger={action === '关闭设备' || action === '重启设备'} icon={<SendOutlined />} disabled={!action || disabled || Boolean(pending) || Boolean(activeCommand) || busy || Boolean(error)} loading={submitting} onClick={()=>confirm()}>提交指令</Button>
      </div>
      <p className="device-control-hint">{disabled ? '设备已停用，当前不可提交控制申请。' : selection?.hint || '选择控制动作后提交；具体能力以设备接入端支持为准。'}{offline && !disabled ? ' 当前离线，登记后需等待接入端领取。' : ''}</p>
    </> : <p className="device-control-hint">该设备仅采集数据，不支持远程控制，可在下方查看历史指令。</p>}
    <div className="device-control-notice">有效期 5 分钟 · 登记成功 ≠ 执行成功 · 超时先核实现场，不自动重发</div>
    {(pending||submitError)&&<div className="device-command-error" role="alert">
      {pending?<><b>提交结果待核对</b><div>动作：{pending.action} · 原编号：<code>{pending.requestNo}</code></div><p>{submitError||'存在尚未确认的申请，请先刷新指令记录。'} 不要重新生成相同指令；如仍无法确认，可复用原编号重试。</p><Button size="small" disabled={submitting||disabled} onClick={()=>confirm(true)}>复用原编号重试</Button></>:submitError}
    </div>}
    {activeCommand&&<p className="device-control-notice">设备有待完成指令（{activeCommand.action}），暂不可提交新的控制申请。</p>}
    {submittedNo && <div className="device-control-submitted" role="status">最新提交：<code>{submittedNo}</code><span>请以下方实时回执为准</span></div>}
    <div className="device-command-head">
      <div><h4>指令记录</h4><span>每 10 秒更新{updatedAt ? ` · 最近更新 ${updatedAt}` : ''}</span></div>
      <Button size="small" icon={<ReloadOutlined />} loading={busy} onClick={() => setRevision(value => value + 1)}>刷新</Button>
    </div>
    {error && <div className="device-command-error" role="alert">{error}{rows.length > 0 ? '，下方为上次读取的记录。' : '，请刷新重试。'}</div>}
    <div className="device-command-table" aria-busy={busy}>
      <div className="device-command-columns"><span>指令 / 申请时间</span><span>执行状态</span><span>申请人</span><span>结果与详情</span></div>
      {rows.map((row, index) => {
        const meta = statusMeta[row.status] || { label: row.status || '状态未知' }
        return <article className="device-command-row" key={row.commandNo || `${page}-${index}`}>
          <div className="device-command-action"><b>{row.action || '历史指令'}</b><time>{time(row.createdAt)}</time></div>
          <div><Tag color={meta.color}>{meta.label}</Tag></div>
          <div className="device-command-operator"><span className="device-command-mobile-label">申请人：</span>{row.operator || '—'}</div>
          <div className="device-command-result"><span>{row.result || '暂无执行结果'}</span>{guidance[row.status]&&<p className="device-command-guidance">{guidance[row.status]}</p>}
            <details><summary>查看详情</summary><dl>
              <dt>指令编号</dt><dd><code>{row.commandNo || '历史记录（未采集编号）'}</code></dd>
              <dt>申请时间</dt><dd>{time(row.createdAt)}</dd>
              <dt>领取时间</dt><dd>{time(row.sentAt)}</dd>
              <dt>回执时间</dt><dd>{time(row.receiptAt)}</dd>
              <dt>到期时间</dt><dd>{time(row.expiresAt)}</dd>
              {row.progress != null && <><dt>执行进度</dt><dd>{row.progress}%{row.installedVersion ? ` · ${row.installedVersion}` : ''}</dd></>}
            </dl></details>
          </div>
        </article>
      })}
      {!rows.length && <div className="device-command-empty">{busy ? '正在读取指令记录…' : error ? '暂时无法读取指令记录' : '暂无指令记录'}</div>}
    </div>
    <footer className="device-command-footer"><span>第 {page} 页 · 本页 {rows.length} 条</span><div>
      <Button size="small" disabled={page === 1 || busy} onClick={() => setPage(value => value - 1)}>上一页</Button>
      <Button size="small" disabled={rows.length < 20 || busy || Boolean(error)} onClick={() => setPage(value => value + 1)}>下一页</Button>
    </div></footer>
  </section>
}
