import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Checkbox, Col, Descriptions, Drawer, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, Timeline, Typography, Upload } from 'antd'
import { AudioOutlined, CheckCircleOutlined, FileTextOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import useAuthStore from '@/store/auth'
import { createVoice, exportVoice, saveVoice, voiceAction, voiceAudio, voiceContext, voiceDetail, voiceList } from '@/api/voice-records'
import type { VoiceDetail, VoiceDraft, VoiceSummary } from '@/api/voice-records'

const TYPES = [{ value: 'pest_control', label: '施药防治' }, { value: 'fertilizing', label: '施肥' }, { value: 'irrigating', label: '灌溉' }, { value: 'ventilation', label: '通风控湿' }, { value: 'pruning', label: '整枝疏果' }, { value: 'harvesting', label: '采收' }, { value: 'other', label: '其他农事' }]
const STATES: Record<string, string> = { DRAFT: '待核对', REVIEW_REQUIRED: '异常待复核', ARCHIVED: '已确认归档', VOID: '已作废' }
const EVENTS: Record<string, string> = { CREATED: '采集凭证', TRANSCRIBED: '真实转写尝试', EXTRACTED: '结构化提取尝试', REVISED: '修订与校验', REVIEWED: '技术员复核', ARCHIVED: '农户确认归档', VOID: '作废草稿' }
function download(value: unknown, name: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
export default function VoiceFarmRecords(): JSX.Element {
  const farm = useFarmStore(s => s.currentFarm)
  const tenant = useAuthStore(s => s.userInfo?.tenantId)
  return <Workspace key={`${tenant}:${farm?.farmId}`} farmId={farm?.farmId} />
}
function Workspace({ farmId }: { farmId?: string }): JSX.Element {
  const { message } = App.useApp(); const cache = useQueryClient()
  const [tab, setTab] = useState('all'), [active, setActive] = useState<VoiceDetail>(), [capture, setCapture] = useState(false)
  const [transcript, setTranscript] = useState(''), [file, setFile] = useState<File>(), [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0), [audioUrl, setAudioUrl] = useState('')
  const [autoProcess, setAutoProcess] = useState(true)
  const recorder = useRef<MediaRecorder>(); const stream = useRef<MediaStream>(); const timer = useRef<ReturnType<typeof setInterval>>()
  const [draft, setDraft] = useState<VoiceDraft>({}), [editText, setEditText] = useState(''), [reason, setReason] = useState(''), [dirty, setDirty] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false), [confirmed, setConfirmed] = useState(false), [abnormal, setAbnormal] = useState(false), [existingUsageId, setExistingUsageId] = useState<number>()
  const ctx = useQuery({ queryKey: ['voice-context', farmId], queryFn: () => voiceContext(farmId!), enabled: !!farmId })
  const list = useQuery({ queryKey: ['voice-records', farmId], queryFn: () => voiceList(farmId!), enabled: !!farmId })
  useEffect(() => () => { recorder.current?.state === 'recording' && recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); if (timer.current) clearInterval(timer.current) }, [])
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])
  const rows = list.data ?? []; const editable = !!active && ['DRAFT', 'REVIEW_REQUIRED'].includes(active.state)
  const inputType = ['pest_control', 'fertilizing'].includes(draft.operationType ?? '')
  const warnings = active?.risks?.warnings ?? [], missing = active?.risks?.missing ?? []
  function show(value: VoiceDetail) { setActive(value); setDraft(value.draft ?? {}); setEditText(value.transcript ?? ''); setDirty(false); setAudioUrl(''); setConfirmed(false); setAbnormal(false); setExistingUsageId(undefined); void cache.invalidateQueries({ queryKey: ['voice-records', farmId] }) }
  function patch(value: Partial<VoiceDraft>) { setDraft(d => ({ ...d, ...value })); setDirty(true) }
  async function run(action: () => Promise<void>) { setBusy(true); try { await action() } catch (e) { message.error(e instanceof Error ? e.message : '操作失败，请刷新后重试') } finally { setBusy(false) } }
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { message.warning('当前环境不支持直接录音，请使用上传音频或文字补录。录音需安全页面环境。'); return }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t))
      const rec = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined); recorder.current = rec
      const chunks: BlobPart[] = []; rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = () => { const mime = rec.mimeType || 'audio/webm'; const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'; setFile(new File(chunks, `现场录音.${ext}`, { type: mime })); setRecording(false); stream.current?.getTracks().forEach(t => t.stop()); if (timer.current) clearInterval(timer.current) }
      rec.start(); setSeconds(0); setRecording(true)
      let elapsed = 0; timer.current = setInterval(() => { elapsed++; setSeconds(elapsed); if (elapsed >= 180 && rec.state === 'recording') rec.stop() }, 1000)
    } catch { stream.current?.getTracks().forEach(t => t.stop()); message.error('无法访问麦克风，请上传录音或手工补录。') }
  }
  async function create() {
    const data = new FormData(); data.append('farmId', farmId!); data.append('requestId', crypto.randomUUID()); data.append('transcript', transcript); if (file) data.append('audio', file)
    let result = await createVoice(data); setCapture(false); setFile(undefined); setTranscript(''); show(result)
    if (autoProcess) {
      try {
        if (file && ctx.data?.asrConfigured && !transcript.trim()) { result = await voiceAction(result.id, 'transcribe', { revision: result.revision }); show(result) }
        if (result.transcript?.trim()) { result = await voiceAction(result.id, 'extract', { revision: result.revision }); show(result) }
      } catch { message.warning('原始凭证已保存，自动处理未完成，可在详情重试。') }
    }
    message.success('采集凭证已保存，请核对字段并确认归档')
  }
  async function act(action: string) { if (!active) return; if (dirty) { message.warning('请先保存核对字段再继续'); return } show(await voiceAction(active.id, action, { revision: active.revision, reason, confirmed, abnormalConfirmed: abnormal, existingUsageId })); if (action === 'archive') { setConfirmOpen(false); message.success('已确认归档') } }
  if (!farmId) return <Empty description="请先在顶部选择农场" />
  return <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
    <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 20 }} wrap><div><Typography.Title level={3} style={{ marginBottom: 6 }}>语音农事记录与结构化归档</Typography.Title><Typography.Text type="secondary">采集凭证 → 七要素核对 → 异常复核 → 农户确认 → 原台账与溯源</Typography.Text></div><Space wrap><Button icon={<ReloadOutlined />} onClick={() => void list.refetch()}>刷新</Button><Button onClick={() => void run(async () => download(await exportVoice(farmId), '已确认农事归档.json'))}>导出已归档</Button><Button type="primary" icon={<AudioOutlined />} onClick={() => setCapture(true)}>录音 / 补录</Button></Space></Space>
    <Alert type="info" showIcon message="记录事实，不代替任务验收" description={ctx.data?.notice ?? '语音必须经农户确认才能进入台账与溯源，异常记录先复核，原始音频保留六个月。'} style={{ marginBottom: 18 }} />
    {ctx.isError && <Alert type="error" message="当前农场数据加载失败" description="请刷新重试，未加载完成时不能创建或归档。" />}
    <Row gutter={16} style={{ marginBottom: 20 }}>{[['待核对', rows.filter(r => r.state === 'DRAFT').length], ['异常待复核', rows.filter(r => r.state === 'REVIEW_REQUIRED').length], ['已确认归档', rows.filter(r => r.state === 'ARCHIVED').length], ['作业归档组', new Set(rows.filter(r => r.archiveGroup).map(r => r.archiveGroup)).size]].map(([title, value]) => <Col xs={12} md={6} key={title}><Card size="small"><Statistic title={`${title}（最近200条）`} value={value} /></Card></Col>)}</Row>
    <Card><Tabs activeKey={tab} onChange={setTab} items={[{ key: 'all', label: '全部采集凭证' }, { key: 'DRAFT', label: '待核对' }, { key: 'REVIEW_REQUIRED', label: '异常复核队列' }, { key: 'ARCHIVED', label: '归档台账' }]} /><Table<VoiceSummary> rowKey="id" loading={list.isLoading} dataSource={tab === 'all' ? rows : rows.filter(r => r.state === tab)} scroll={{ x: 1000 }} columns={[
      { title: '记录编号', dataIndex: 'id', width: 140, render: (v: string, r) => <Button type="link" onClick={() => void run(async () => show(await voiceDetail(r.id)))}>{v.slice(0, 8).toUpperCase()}</Button> },
      { title: '地块 / 日期', render: (_, r) => <>{r.plotName ?? '待确认地块'}<br /><Typography.Text type="secondary">{r.operationDate ?? '待确认日期'}</Typography.Text></> },
      { title: '口述摘要', dataIndex: 'transcript', ellipsis: true }, { title: '农事类型', dataIndex: 'operationType', render: v => TYPES.find(t => t.value === v)?.label ?? '待确认' },
      { title: '结构化摘要', width: 240, render: (_, r) => { try { const d = JSON.parse(r.draftJson ?? '{}') as VoiceDraft; return <>{d.operatedAt ?? '待确认时间'}<br />{d.areaMu == null ? '待确认面积' : `${d.areaMu}亩`} · {d.quantity == null ? d.durationHours == null ? '待核对' : `${d.durationHours}小时` : `${d.quantity}${d.unit ?? ''}`}</> } catch { return '待核对' } } },
      { title: '抽取置信度', width: 110, render: (_, r) => { try { const e = JSON.parse(r.extractionJson ?? '{}') as { suggestion?: { confidence?: number } }; return e.suggestion?.confidence ?? '未提取' } catch { return '未提取' } } },
      { title: '状态', dataIndex: 'state' , render: (s: string) => <Tag color={s === 'ARCHIVED' ? 'green' : s === 'REVIEW_REQUIRED' ? 'orange' : 'default'}>{STATES[s] ?? s}</Tag> },
      { title: '确认人', dataIndex: 'confirmedBy', render: v => v ?? '未确认，不进入溯源' }, { title: '操作', render: (_, r) => <Button onClick={() => void run(async () => show(await voiceDetail(r.id)))}>查看 / 核对</Button> },
    ]} /></Card>
    <Modal open={capture} title="记录一段已发生的农事" onCancel={() => { if (recording) { message.warning('请先停止录音'); return } setCapture(false) }} onOk={() => void run(create)} okText="保存采集凭证" confirmLoading={busy} okButtonProps={{ disabled: recording || (!file && !transcript.trim()) || !ctx.data }}>
      <Alert type={ctx.data?.asrConfigured ? 'info' : 'warning'} showIcon message={ctx.data?.asrConfigured ? ctx.data.asrCapability?.description ?? '真实转写可用，结果必须核对' : '语音转写暂不可用：支持保存录音和人工补录'} style={{ marginBottom: 16 }} />
      <Space wrap><Button danger={recording} icon={<AudioOutlined />} onClick={() => recording ? recorder.current?.stop() : void startRecording()}>{recording ? `停止录音 ${seconds}s / 180s` : '开始现场录音'}</Button><Upload maxCount={1} showUploadList={false} accept="audio/*,.webm,.m4a" beforeUpload={f => { if (f.size > 12 * 1024 * 1024) { message.error('音频不得超过12MB'); return false } setFile(f); return false }}><Button icon={<UploadOutlined />} disabled={recording}>上传已有录音</Button></Upload></Space>
      {file && <Typography.Paragraph style={{ marginTop: 12 }}>{file.name} · {(file.size / 1024).toFixed(0)} KB <Button size="small" type="link" onClick={() => setFile(undefined)}>移除</Button></Typography.Paragraph>}
      <Typography.Paragraph type="secondary" style={{ marginTop: 14 }}>录音私有保存六个月，仅本农场授权人员可访问；可随时改为人工补录。上传应为真实音频，单次现场录音最长三分钟。</Typography.Paragraph>
      <Checkbox checked={autoProcess} onChange={e => setAutoProcess(e.target.checked)}>保存后自动转写并提取七要素（仍需核对确认）</Checkbox>
      <Input.TextArea rows={5} value={transcript} maxLength={8000} onChange={e => setTranscript(e.target.value)} placeholder="口述文本或人工补录：时间、地块、做了什么、投入品、数量、面积、作业人；不清楚的请保持为空，不猜测。" />
    </Modal>
    <Drawer open={!!active} onClose={() => { setActive(undefined); setAudioUrl('') }} width={Math.min(1100, window.innerWidth)} title={<Space><FileTextOutlined />记录核对与归档<Tag>{active ? STATES[active.state] : ''}</Tag></Space>}>
      {active && <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Descriptions bordered size="small" column={2} items={[{ key: 'id', label: '记录编号', children: active.id }, { key: 'version', label: '版本', children: active.revision }, { key: 'expire', label: '音频保留至', children: active.audioExpiresAt ? dayjs(active.audioExpiresAt).format('YYYY-MM-DD HH:mm') : '纯文本补录' }, { key: 'confirmed', label: '确认归档人', children: active.confirmedBy ?? '未确认' }, { key: 'group', label: '归档组', children: active.archiveGroup ?? '未归档' }, { key: 'usage', label: '原用量台账编号', children: active.usageId ?? '无' }]} />
        <Card size="small" title="1 · 原始凭证与真实转写" extra={<Space><Button disabled={!editable || !active.audioAvailable || dirty} loading={busy} onClick={() => void run(() => act('transcribe'))}>转写 / 重试</Button><Button disabled={!editable || dirty || !active.transcript} loading={busy} onClick={() => void run(() => act('extract'))}>提取七要素</Button></Space>}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {active.audioAvailable ? <><Button onClick={() => void run(async () => { const blob = await voiceAudio(active.id); setAudioUrl(URL.createObjectURL(blob)) })}>加载原始录音</Button>{audioUrl && <audio controls src={audioUrl} style={{ width: '100%' }} />}</> : <Typography.Text type="secondary">无可播放录音，可能为文本补录或已超过保留期；文本和审计仍保留。</Typography.Text>}
            {active.asr && <Alert showIcon type={active.asr.status === 'SUCCESS' && (active.asr.confidence == null || active.asr.confidence >= 0.6) ? 'success' : 'warning'} message={active.asr.status === 'SUCCESS' ? `${active.asr.confidence != null && active.asr.confidence < 0.6 ? '低置信，请重点核对名称和数字 · ' : ''}${active.asr.provider === 'WINDOWS_LOCAL' ? '本机普通话真实转写' : '真实转写'}已返回${active.asr.confidence == null ? '' : ` · 识别置信度 ${active.asr.confidence.toFixed(2)}`}，请对照录音核对` : active.asr.message} />}
            <Input.TextArea rows={4} disabled={!editable} value={editText} maxLength={8000} onChange={e => { setEditText(e.target.value); setDirty(true) }} />
            {active.extraction && <Alert showIcon type={active.extraction.status === 'REAL_MODEL' ? 'info' : 'warning'} message={active.extraction.status === 'REAL_MODEL' ? `真实模型候选 · 抽取置信度 ${active.extraction.suggestion?.confidence ?? '未返回'}（不是事实正确率）` : active.extraction.message} description={active.extraction.status === 'REAL_MODEL' ? <><Typography.Paragraph>待确认字段：{active.extraction.suggestion?.uncertainFields?.join('、') || '请仍逐项核对'}</Typography.Paragraph><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(active.extraction.suggestion, null, 2)}</pre><Button disabled={!editable} onClick={() => { const suggestion = active.extraction?.suggestion?.draft; if (suggestion && typeof suggestion === 'object') { patch(suggestion); message.info('已填入候选，必须逐项核对并保存') } }}>填入候选待核对</Button></> : undefined} />}
          </Space>
        </Card>
        <Card size="small" title="2 · 七要素与业务关联（不清楚的保持为空）">
          <Form layout="vertical" disabled={!editable}><Row gutter={16}>
            <Col span={12}><Form.Item label="地块"><Select allowClear value={draft.plotId} options={ctx.data?.plots.map(p => ({ value: p.id, label: `${p.plotName} · ${p.area ?? '未知'}亩` }))} onChange={v => patch({ plotId: v, batchId: undefined })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="农事类型"><Select value={draft.operationType} options={TYPES} onChange={v => patch({ operationType: v, inputId: undefined, quantity: undefined, unit: undefined })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="实际作业时间（请核对，不自动填今天）"><Input type="datetime-local" value={draft.operatedAt ?? ''} onChange={e => patch({ operatedAt: e.target.value || undefined })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="实际作业人"><Select allowClear value={draft.operatorId} options={ctx.data?.members.map(m => ({ value: m.id, label: m.memberName }))} onChange={v => patch({ operatorId: v })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="实际作业面积（亩）"><InputNumber min={0.001} precision={3} style={{ width: '100%' }} value={draft.areaMu} onChange={v => patch({ areaMu: v ?? undefined })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="关联原采收批次（采收必填，其他按实际关联）"><Select allowClear value={draft.batchId} options={ctx.data?.batches.filter(b => b.plotId === draft.plotId).map(b => ({ value: b.batchId, label: `${b.batchNo} · ${b.harvestDate} · ${b.quantity}${b.unit}` }))} onChange={v => patch({ batchId: v })} /></Form.Item></Col>
            {inputType && <Col span={12}><Form.Item label="投入品档案（原台账，不按模糊名称自动匹配）"><Select showSearch optionFilterProp="label" allowClear value={draft.inputId} options={ctx.data?.inputs.map(i => ({ value: i.inputId, label: i.inputName }))} onChange={v => patch({ inputId: v, unit: ctx.data?.inputs.find(i => i.inputId === v)?.unit })} /></Form.Item></Col>}
            {(inputType || draft.operationType === 'harvesting') && <><Col span={6}><Form.Item label={inputType ? '实际投入总量' : '实际采收量'}><InputNumber min={0.001} style={{ width: '100%' }} value={draft.quantity} onChange={v => patch({ quantity: v ?? undefined })} /></Form.Item></Col><Col span={6}><Form.Item label="单位（斤须换算，台账单位须一致）"><Input value={draft.unit} onChange={e => patch({ unit: e.target.value })} /></Form.Item></Col></>}
            {draft.operationType === 'ventilation' && <Col span={12}><Form.Item label="通风时长（小时）"><InputNumber min={0.01} value={draft.durationHours} onChange={v => patch({ durationHours: v ?? undefined })} /></Form.Item></Col>}
            {draft.operationType === 'pest_control' && <><Col span={12}><Form.Item label="核验的登记上限（台账单位 / 亩）"><InputNumber min={0.001} value={draft.registeredMaxPerMu} onChange={v => patch({ registeredMaxPerMu: v ?? undefined })} /></Form.Item></Col><Col span={12}><Form.Item label="核验的安全间隔（天）"><InputNumber min={0} precision={0} value={draft.safetyIntervalDays} onChange={v => patch({ safetyIntervalDays: v ?? undefined })} /></Form.Item></Col><Col span={24}><Form.Item label="登记核验依据（登记证号、作物、适用范围及原文出处）"><Input value={draft.evidenceRef} onChange={e => patch({ evidenceRef: e.target.value })} /></Form.Item></Col></>}
            <Col span={24}><Form.Item label="实际作业描述"><Input.TextArea rows={3} maxLength={4000} value={draft.description} onChange={e => patch({ description: e.target.value })} /></Form.Item></Col>
          </Row></Form>
          {editable && <Space direction="vertical" style={{ width: '100%' }}><Input.TextArea rows={2} value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} placeholder="填写修订、复核或确认说明（至少2字）" /><Button type="primary" loading={busy} onClick={() => void run(async () => show(await saveVoice(active.id, active.revision, editText, draft, reason)))}>保存核对字段并校验</Button>{dirty && <Typography.Text type="warning">存在尚未保存的修改，保存后才可转写、复核或归档。</Typography.Text>}</Space>}
        </Card>
        <Card size="small" title="3 · 校验、复核与确认">
          <Space direction="vertical" style={{ width: '100%' }}>{missing.length > 0 && <Alert type="error" showIcon message="缺失项阻止归档" description={missing.join('；')} />}{warnings.length > 0 && <Alert type="warning" showIcon message="异常必须技术员复核并由农户二次确认" description={warnings.join('；')} />}
            {active.reviewedBy && <Alert type="info" message={`复核人：${active.reviewedBy}`} description={active.reviewNote} />}
            {editable && <Space wrap><Button disabled={dirty || !!missing.length} loading={busy} onClick={() => void run(() => act('review'))}>技术员复核当前版本</Button><Button type="primary" icon={<CheckCircleOutlined />} disabled={dirty || !!missing.length || !draft.plotId} onClick={() => setConfirmOpen(true)}>农户确认归档</Button><Button danger disabled={dirty} onClick={() => void run(() => act('void'))}>作废草稿</Button></Space>}
            {active.groupRecords && <Alert type="success" message={`本作业归档组共 ${active.groupRecords.length} 段凭证`} description="同地块、同批次、同日、同类型合组展示，保留独立音频与时间；不自动累加用量。投入品及采收事实仍以原业务台账为准。" />}
          </Space>
        </Card>
        <Card size="small" title="操作留痕"><Timeline items={active.events.map((e, i) => ({ key: i, children: <><strong>{EVENTS[e.type] ?? e.type}</strong> · {e.operator} · {dayjs(e.createdAt).format('MM-DD HH:mm')}<details><summary>查看当次证据快照</summary><pre style={{ whiteSpace: 'pre-wrap', maxHeight: 250, overflow: 'auto' }}>{JSON.stringify(JSON.parse(e.payload), null, 2)}</pre></details></> }))} /></Card>
      </Space>}
    </Drawer>
    <Modal open={confirmOpen} title="确认实际发生的农事并归档" confirmLoading={busy} okText="确认归档" okButtonProps={{ disabled: !confirmed || (!!warnings.length && !abnormal) }} onCancel={() => setConfirmOpen(false)} onOk={() => void run(() => act('archive'))}>
      <Space direction="vertical" style={{ width: '100%' }}><Alert type="warning" showIcon message="归档后固定凭证，不能直接改写" description="药肥记录将调用原用量台账并扣减库存；采收仅关联已有批次，不重复入库。异常确认不是合规证明，也不自动完成或验收农事任务。" />
        {!!warnings.length && <Alert type="error" message={warnings.join('；')} />}
        {inputType && <><Typography.Text>如这是已登记用量的补充录音，请填写原用量编号；不填写表示新增实际用量，同日疑似重复会被拦截。</Typography.Text><InputNumber min={1} precision={0} value={existingUsageId} onChange={v => setExistingUsageId(v ?? undefined)} placeholder="已有用量编号（可选）" style={{ width: '100%' }} /></>}
        <Checkbox checked={confirmed} onChange={e => setConfirmed(e.target.checked)}>我是实际作业人或主体负责人，已逐项核对时间、地块、农事、投入品、用量、面积、作业人。</Checkbox>
        {!!warnings.length && <Checkbox checked={abnormal} onChange={e => setAbnormal(e.target.checked)}>我已阅读异常和技术员复核意见，确认按实际事实留痕。</Checkbox>}
        <Input.TextArea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="确认说明（至少2字）" />
      </Space>
    </Modal>
  </div>
}
