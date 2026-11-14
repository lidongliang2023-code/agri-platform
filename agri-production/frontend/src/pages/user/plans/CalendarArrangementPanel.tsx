import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Checkbox, Col, Collapse, DatePicker, Descriptions, Drawer, Empty, Form, Input, InputNumber, Row, Select, Space, Statistic, Switch, Table, Tag, Timeline, Typography } from 'antd'
import { CalendarOutlined, PlusOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '@/store/auth'
import { actOnArrangement, calendarContext, createArrangement, getArrangement, getCalendarWeather, listArrangements, listCalendarInterventions, refreshCalendarWeather, resolveCalendarIntervention, rescheduleArrangement, reviseArrangement } from '@/api/calendar-arrangement'
import type { CalendarArrangeInput, CalendarArrangement, CalendarDaySupply, CalendarOperation, CalendarScheduleItem, CalendarWeather } from '@/api/calendar-arrangement'
import './calendar-arrangement.css'

const TYPES = [{ value: 'pruning', label: '整枝 / 疏果' }, { value: 'fertilizing', label: '追肥' }, { value: 'ventilation', label: '通风控湿' }, { value: 'pollination', label: '授粉' }, { value: 'harvesting', label: '采收' }, { value: 'pest_control', label: '施药防治' }, { value: 'irrigating', label: '灌溉' }, { value: 'other', label: '其他农事' }]
const STATES: Record<string, string> = { DRAFT: '编排草稿', APPROVED: '已审核待下发', PUBLISHED: '已下发任务', CLOSED: '已验收结案' }
const EVENTS: Record<string, string> = { GENERATED: '生成草稿', REVISED: '调整并重排', APPROVED: '审核通过', PUBLISHED: '任务下发', CLOSED: '验收结案', DAILY_REPLAN: '每日草稿重排', RESCHEDULED: '重排并更新原任务' }
const newDays = (start: string): CalendarDaySupply[] => Array.from({ length: 7 }, (_, i) => ({ date: dayjs(start).add(i, 'day').format('YYYY-MM-DD'), people: 0, machineSlots: 0, rain: false, strongWind: false, weatherVerified: false }))
function freshInput(farmId: string): CalendarArrangeInput { const start = dayjs().format('YYYY-MM-DD'); return { farmId, requestId: crypto.randomUUID(), weekStart: start, source: '', weatherSource: '', days: newDays(start), operations: [] } }
function DateField({ value, onChange, disabled }: { value?: string; onChange: (value?: string) => void; disabled?: boolean }): JSX.Element { return <DatePicker value={value ? dayjs(value) : null} onChange={d => onChange(d?.format('YYYY-MM-DD'))} disabled={disabled} /> }

export default function CalendarArrangementPanel({ farmId }: { farmId?: string }): JSX.Element {
  const tenant = useAuthStore(s => s.userInfo?.tenantId)
  return <ArrangementWorkspace key={`${tenant}:${farmId}`} farmId={farmId} />
}
function ArrangementWorkspace({ farmId }: { farmId?: string }): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const cache = useQueryClient()
  const [editor, setEditor] = useState(false)
  const [input, setInput] = useState<CalendarArrangeInput>(() => freshInput(farmId ?? ''))
  const [editing, setEditing] = useState<CalendarArrangement>()
  const [active, setActive] = useState<string>()
  const [reason, setReason] = useState('')
  const [cross, setCross] = useState(false)
  const [selectedStages, setSelectedStages] = useState<number[]>([])
  const [intervention, setIntervention] = useState<string>()
  const [interventionNote, setInterventionNote] = useState('')
  const context = useQuery({ queryKey: ['calendar-arrange-context', farmId], queryFn: () => calendarContext(farmId!), enabled: !!farmId })
  const history = useQuery({ queryKey: ['calendar-arrangements', farmId], queryFn: () => listArrangements(farmId!), enabled: !!farmId })
  const detail = useQuery({ queryKey: ['calendar-arrangement', active], queryFn: () => getArrangement(active!), enabled: !!active })
  const interventions = useQuery({ queryKey: ['calendar-interventions', farmId], queryFn: () => listCalendarInterventions(farmId!), enabled: !!farmId })
  const row = detail.data
  const refresh = (): void => { void cache.invalidateQueries({ queryKey: ['calendar-arrangements'] }); void cache.invalidateQueries({ queryKey: ['calendar-arrangement'] }); void cache.invalidateQueries({ queryKey: ['calendar-interventions'] }); void cache.invalidateQueries({ queryKey: ['plan-calendar'] }); void cache.invalidateQueries({ queryKey: ['production-tasks'] }) }
  const update = (saved: CalendarArrangement): void => { setActive(saved.id); cache.setQueryData(['calendar-arrangement', saved.id], saved); refresh(); setReason(''); setCross(false) }
  const save = useMutation({ mutationFn: () => editing ? editing.status === 'PUBLISHED' ? rescheduleArrangement(editing.id, editing.revision, reason, input, cross) : reviseArrangement(editing.id, editing.revision, reason, input) : createArrangement(input), onSuccess: saved => { update(saved); setEditor(false); setEditing(undefined); message.success('编排与依据快照已保存') }, onError: (e: Error) => message.error(e.message) })
  const weatherQuery = useQuery({ queryKey: ['calendar-weather', farmId, input.weekStart], queryFn: () => getCalendarWeather(farmId!, input.weekStart), enabled: editor && !!farmId && !!input.weekStart, staleTime: 60_000 })
  const weatherRefresh = useMutation({ mutationFn: () => refreshCalendarWeather(farmId!, input.weekStart), onSuccess: (weather: CalendarWeather) => {
    const forecast = new Map(weather.days.map(day => [day.date, day]))
    patch({ weatherIssuedAt: weather.issuedAt, weatherSource: weather.provider ? `${weather.provider}${weather.sourceUrl ? ` · ${weather.sourceUrl}` : ''}` : weather.error, days: input.days.map(day => { const item = forecast.get(day.date); return item ? { ...day, rain: item.rain, strongWind: item.strongWind, weatherVerified: item.weatherVerified, minTemperature: item.minTemperature, note: item.note } : { ...day, weatherVerified: false, note: weather.error || '未取得对应日期预报' } }) })
    cache.setQueryData(['calendar-weather', farmId, input.weekStart], weather)
    message.success(weather.status === 'SUCCESS' ? '真实天气已刷新并回填7天排程' : '天气刷新失败，已保留未核验状态')
  }, onError: (e: Error) => message.error(e.message) })
  const action = useMutation({ mutationFn: (kind: 'approve' | 'publish' | 'close' | 'explain') => actOnArrangement(row!.id, kind, row!.revision, reason, cross), onSuccess: saved => { update(saved); message.success('处理结果已保存') }, onError: (e: Error) => message.error(e.message) })
  const resolve = useMutation({ mutationFn: () => resolveCalendarIntervention(intervention!, interventionNote), onSuccess: () => { setIntervention(undefined); setInterventionNote(''); refresh(); message.success('技术员介入记录已保存') }, onError: (e: Error) => message.error(e.message) })
  const patch = (values: Partial<CalendarArrangeInput>): void => setInput(v => ({ ...v, ...values, requestId: crypto.randomUUID() }))
  const opPatch = (key: string, values: Partial<CalendarOperation>): void => patch({ operations: input.operations.map(o => o.key === key ? { ...o, ...values } : o) })
  const dayPatch = (date: string, values: Partial<CalendarDaySupply>): void => patch({ days: input.days.map(d => d.date === date ? { ...d, ...values } : d) })
  const openNew = (): void => { setEditing(undefined); setInput(freshInput(farmId!)); setSelectedStages([]); setReason(''); setEditor(true) }
  const openEdit = (): void => { if (!row) return; setEditing(row); setInput({ ...row.input, requestId: crypto.randomUUID() }); setSelectedStages([]); setReason(''); setEditor(true) }
  const addStages = (): void => {
    const operations = [...input.operations]
    for (const id of selectedStages) {
      const stage = context.data?.stages.find(s => s.stageId === id)
      if (!stage || operations.some(o => o.stageId === stage.stageId)) continue
      const earliest = stage.earliest && stage.earliest > input.weekStart ? stage.earliest : input.weekStart
      const end = dayjs(input.weekStart).add(6, 'day').format('YYYY-MM-DD')
      operations.push({ key: crypto.randomUUID(), planId: stage.planId, stageId: stage.stageId, taskName: `${stage.cropName ?? ''} · ${stage.stageName}`, taskType: TYPES.some(t => t.value === stage.taskType) ? stage.taskType! : 'other', mandatory: true, priority: 2, earliest, latest: stage.latest && stage.latest < end ? stage.latest : end, people: 1, machineSlots: 0, standardRef: stage.source ?? '', greenhouse: false, weatherSensitive: true })
    }
    patch({ operations }); setSelectedStages([])
  }
  const exportResult = (): void => {
    if (!row) return
    const columns = ['农事', '地块', '作物', '品种', '生育期', '计划', '阶段', '建议日期', '状态', '人数', '机具位', '依据', '调整原因']
    const escape = (v: unknown): string => { const raw = String(v ?? ''); return `"${(/^[=+\-@\t\r]/.test(raw) ? "'" : '') + raw.replace(/"/g, '""')}"` }
    const csv = '\uFEFF' + [columns, ...row.items.map(i => [i.taskName, i.plotName, i.cropName, i.variety, i.stageName, i.planId, i.stageId, i.date, i.status === 'SCHEDULED' ? '已安排' : '阻塞', i.people, i.machineSlots, i.standardRef, i.reasons.join('；')])].map(line => line.map(escape).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); const a = document.createElement('a'); a.href = url; a.download = `农事编排_${row.weekStart}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const pendingInterventions = interventions.data?.filter(i => i.state === 'PENDING') ?? []
  return <Card className="calendar-arrangement" title={<Space><ThunderboltOutlined />农事日历智能编排</Space>} extra={<Space><Button icon={<ReloadOutlined />} onClick={refresh} disabled={!farmId}>刷新</Button><Button type="primary" icon={<PlusOutlined />} onClick={openNew} disabled={!farmId || context.isError}>新建周编排</Button></Space>}>
    <div className="arrange-intro"><div><Typography.Title level={4}>把阶段目标排成可执行的一周</Typography.Title><Typography.Paragraph>以既有计划阶段和标准为依据，按关键窗口、天气和资源容量排程；人工审核后下发原农事任务，验收结果自动回显。</Typography.Paragraph></div><CalendarOutlined /></div>
    <Alert type="info" showIcon message="编排建议须审核，执行与验收统一在农事任务管理" description="天气按农场经纬度接入真实15天预报；创建、重排和审核前自动刷新，天气敏感农事只接受已核验日期。每日06:00仅重排未审核草稿，不自动改动已下发任务。" />
    {context.isError && <Alert type="error" showIcon message="编排基础数据加载失败" description={(context.error as Error).message} action={<Button onClick={() => void context.refetch()}>重试</Button>} />}
    {history.isError && <Alert type="error" message="编排列表加载失败" description={(history.error as Error).message} />}
    <Table size="small" rowKey="id" loading={history.isLoading} dataSource={history.data ?? []} pagination={{ pageSize: 5 }} scroll={{ x: 620 }} locale={{ emptyText: <Empty description={farmId ? '尚无周编排，从已有计划阶段开始' : '请先选择当前农场'} /> }} columns={[
      { title: '编排周起始', dataIndex: 'weekStart', render: (v: string) => dayjs(v).format('YYYY-MM-DD') },
      { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'CLOSED' ? 'green' : v === 'PUBLISHED' ? 'blue' : 'gold'}>{STATES[v] ?? v}</Tag> },
      { title: '版本', dataIndex: 'revision' }, { title: '操作', render: (_, r) => <Button type="link" onClick={() => { setActive(r.id); setReason(''); setCross(false) }}>查看与处理</Button> },
    ]} />
    {interventions.isError && <Alert type="warning" message="技术员介入记录未能加载" description={(interventions.error as Error).message} />}
    {!!pendingInterventions.length && <Alert showIcon type="warning" message={`${pendingInterventions.length} 个地块连续两周有未验收事项，需技术员介入`} description={<Space direction="vertical">{pendingInterventions.map(i => <Button key={i.id} type="link" onClick={() => { setIntervention(i.id); setInterventionNote('') }}>地块 {i.plotId} · {dayjs(i.weekStart).format('MM-DD')} · 登记处理</Button>)}</Space>} />}
    <Drawer title={editing?.status === 'PUBLISHED' ? '审核调整并更新原任务（仅未开始任务）' : editing ? '调整周编排 · 审核结果将重置' : '新建农事周编排'} width="min(1240px, 100vw)" open={editor} onClose={() => { if (!save.isPending) setEditor(false) }} maskClosable={!save.isPending} extra={<Button type="primary" loading={save.isPending} onClick={() => save.mutate()} disabled={!input.operations.length}>{editing?.status === 'PUBLISHED' ? '确认调整并更新原任务' : '保存并约束排程'}</Button>}>
      <Form layout="vertical" disabled={save.isPending}>
        <Alert showIcon type="warning" message="请填写真实标准与现场数据，不确定的天气和安全条件不要默认正常" description="人数为全天人次容量，机具为全天作业位；责任人每天只排一项。无法核算资源的既有任务会保守占满当日，请先在原任务页面协调。" />
        <Row gutter={16}><Col xs={24} md={8}><Form.Item label="连续7天起始日"><DateField value={input.weekStart} onChange={v => { if (v) patch({ weekStart: v, days: newDays(v) }) }} /></Form.Item></Col><Col xs={24} md={16}><Form.Item label="农事标准 / 资源快照出处（必填）"><Input maxLength={1000} value={input.source} onChange={e => patch({ source: e.target.value })} placeholder="标准版本、人员排班与机具容量的核验出处" /></Form.Item></Col></Row>
        <Alert showIcon type={weatherQuery.data?.status === 'FAILED' || weatherQuery.data?.status === 'NOT_FOUND' ? 'warning' : input.days.every(day => day.weatherVerified) ? 'success' : 'info'} message={weatherQuery.data?.status === 'SUCCESS' || input.days.some(day => day.weatherVerified) ? `天气来源：${input.weatherSource || '真实预报'}${input.weatherIssuedAt ? ` · ${dayjs(input.weatherIssuedAt).format('YYYY-MM-DD HH:mm')}` : ''}` : '尚未取得真实天气预报'} description={weatherQuery.data?.error || '提交编排时服务端会再次刷新并校验天气；天气敏感农事只接受已核验日期。'} action={<Button size="small" icon={<ReloadOutlined />} loading={weatherRefresh.isPending} onClick={() => weatherRefresh.mutate()} disabled={!farmId}>刷新真实天气</Button>} />
        <Row gutter={16}><Col xs={24} md={14}><Form.Item label="天气出处 / 版本"><Input value={input.weatherSource} maxLength={1000} onChange={e => patch({ weatherSource: e.target.value })} placeholder="刷新后自动记录供应商与来源地址" /></Form.Item></Col><Col xs={24} md={10}><Form.Item label="预报发布时间"><DatePicker showTime value={input.weatherIssuedAt ? dayjs(input.weatherIssuedAt) : null} onChange={v => patch({ weatherIssuedAt: v?.format('YYYY-MM-DDTHH:mm:ss') })} /></Form.Item></Col></Row>
        <Table rowKey="date" dataSource={input.days} pagination={false} size="small" scroll={{ x: 1250 }} columns={[
          { title: '日期', dataIndex: 'date', width: 110 },
          { title: '可用人数', render: (_, d) => <InputNumber aria-label={`${d.date}可用人数`} min={0} max={10000} value={d.people} onChange={v => dayPatch(d.date, { people: v ?? 0 })} /> },
          { title: '机具位', render: (_, d) => <InputNumber min={0} max={1000} value={d.machineSlots} onChange={v => dayPatch(d.date, { machineSlots: v ?? 0 })} /> },
          { title: '天气核验', render: (_, d) => <Tag color={d.weatherVerified ? 'green' : 'orange'}>{d.weatherVerified ? '真实预报' : '未核验'}</Tag> },
          { title: '降雨', render: (_, d) => <Switch checked={d.rain} onChange={v => dayPatch(d.date, { rain: v })} /> },
          { title: '大风', render: (_, d) => <Switch checked={d.strongWind} onChange={v => dayPatch(d.date, { strongWind: v })} /> },
          { title: '露地最低℃', render: (_, d) => <InputNumber min={-80} max={80} value={d.minTemperature} onChange={v => dayPatch(d.date, { minTemperature: v ?? undefined })} /> },
          { title: '棚内修正℃', render: (_, d) => <InputNumber min={-80} max={80} value={d.greenhouseTemperature} onChange={v => dayPatch(d.date, { greenhouseTemperature: v ?? undefined })} /> },
          { title: '核验备注', render: (_, d) => <Input maxLength={500} value={d.note} onChange={e => dayPatch(d.date, { note: e.target.value })} /> },
        ]} />
        <Typography.Title level={5}>从既有计划阶段匹配农事</Typography.Title>
        <Space wrap><Select mode="multiple" style={{ minWidth: 360, maxWidth: '100%' }} value={selectedStages} onChange={setSelectedStages} placeholder="选择阶段，可继续修改为有标准依据的具体农事" options={(context.data?.stages ?? []).map(s => ({ value: s.stageId, label: `${s.plotName ?? ''} · ${s.cropName ?? ''} ${s.variety ?? ''} · ${s.stageName}（${s.earliest ?? '?'}至${s.latest ?? '?'}）` }))} /><Button onClick={addStages} disabled={!selectedStages.length}>加入农事</Button><Button onClick={() => navigate('/production/plans')}>维护计划与阶段</Button></Space>
        <Collapse style={{ marginTop: 16 }} items={input.operations.map(op => ({ key: op.key, label: <Space><Tag color={op.mandatory ? 'red' : 'default'}>{op.mandatory ? '必须做' : '可延后'}</Tag>{op.taskName || '未命名农事'} · {op.earliest} 至 {op.latest}</Space>, children: <>
          <Row gutter={12}><Col xs={24} md={12}><Form.Item label="农事名称"><Input value={op.taskName} maxLength={150} onChange={e => opPatch(op.key, { taskName: e.target.value })} /></Form.Item></Col><Col xs={12} md={6}><Form.Item label="农事类型"><Select options={TYPES} value={op.taskType} onChange={v => opPatch(op.key, { taskType: v })} /></Form.Item></Col><Col xs={12} md={6}><Form.Item label="优先级（1最高）"><InputNumber min={1} max={4} value={op.priority} onChange={v => opPatch(op.key, { priority: v ?? 2 })} /></Form.Item></Col></Row>
          <Row gutter={12}><Col xs={12} md={6}><Form.Item label="最早日期"><DateField value={op.earliest} onChange={v => opPatch(op.key, { earliest: v ?? '' })} /></Form.Item></Col><Col xs={12} md={6}><Form.Item label="最晚日期"><DateField value={op.latest} onChange={v => opPatch(op.key, { latest: v ?? '' })} /></Form.Item></Col><Col xs={12} md={6}><Form.Item label="人数（全天人次）"><InputNumber min={1} max={10000} value={op.people} onChange={v => opPatch(op.key, { people: v ?? 1 })} /></Form.Item></Col><Col xs={12} md={6}><Form.Item label="机具位"><InputNumber min={0} max={1000} value={op.machineSlots} onChange={v => opPatch(op.key, { machineSlots: v ?? 0 })} /></Form.Item></Col></Row>
          <Row gutter={12}><Col xs={24} md={12}><Form.Item label="本农场责任人（必选）"><Select options={(context.data?.members ?? []).map(m => ({ value: m.id, label: m.memberName }))} value={op.memberId} onChange={v => opPatch(op.key, { memberId: v })} /></Form.Item></Col><Col xs={24} md={12}><Form.Item label="农事标准出处 / 页码 / 版本（必填）"><Input value={op.standardRef} maxLength={1000} onChange={e => opPatch(op.key, { standardRef: e.target.value })} /></Form.Item></Col></Row>
          <Space wrap style={{ marginBottom: 16 }}><Checkbox checked={op.mandatory} onChange={e => opPatch(op.key, { mandatory: e.target.checked })}>必须做</Checkbox><Checkbox checked={op.greenhouse} onChange={e => opPatch(op.key, { greenhouse: e.target.checked })}>设施大棚（用棚内温度）</Checkbox><Checkbox checked={op.weatherSensitive} onChange={e => opPatch(op.key, { weatherSensitive: e.target.checked })}>天气敏感</Checkbox></Space>
          <Row gutter={12}><Col xs={24} md={8}><Form.Item label="最低作业温度℃（按标准）"><InputNumber min={-80} max={80} value={op.minimumTemperature} onChange={v => opPatch(op.key, { minimumTemperature: v ?? undefined })} /></Form.Item></Col><Col xs={24} md={8}><Form.Item label="所需技能"><Input value={op.requiredSkill} maxLength={200} onChange={e => opPatch(op.key, { requiredSkill: e.target.value })} /></Form.Item></Col><Col xs={24} md={8}><Form.Item label="责任人技能核验证明"><Input value={op.skillEvidence} maxLength={500} onChange={e => opPatch(op.key, { skillEvidence: e.target.value })} /></Form.Item></Col></Row>
          {op.taskType === 'pest_control' && <Card size="small" title="施药安全依据（缺少任何一项将阻塞）"><Alert type="warning" message="仅编排经人工核验的防治窗口，不生成药剂或剂量处方。未开花也需填写已核实、不重叠的开花窗口。" /><Row gutter={12}><Col xs={24} md={12}><Form.Item label="开花期起"><DateField value={op.floweringStart} onChange={v => opPatch(op.key, { floweringStart: v })} /></Form.Item></Col><Col xs={24} md={12}><Form.Item label="开花期止"><DateField value={op.floweringEnd} onChange={v => opPatch(op.key, { floweringEnd: v })} /></Form.Item></Col><Col xs={24} md={12}><Form.Item label="预计采收日"><DateField value={op.harvestDate} onChange={v => opPatch(op.key, { harvestDate: v })} /></Form.Item></Col><Col xs={24} md={12}><Form.Item label="登记安全间隔天数"><InputNumber min={0} max={365} value={op.safetyIntervalDays} onChange={v => opPatch(op.key, { safetyIntervalDays: v ?? undefined })} /></Form.Item></Col></Row><Form.Item label="登记适用范围、安全间隔的核验出处"><Input maxLength={1000} value={op.registrationRef} onChange={e => opPatch(op.key, { registrationRef: e.target.value })} /></Form.Item></Card>}
          <Space style={{ marginTop: 12 }}><Button onClick={() => patch({ operations: [...input.operations, { ...op, key: crypto.randomUUID(), taskName: `${op.taskName}（另一项）` }] })}>同阶段新增农事</Button><Button danger onClick={() => patch({ operations: input.operations.filter(o => o.key !== op.key) })}>移除此项</Button></Space>
        </> }))} />
        {editing?.status === 'PUBLISHED' && <Checkbox checked={cross} onChange={e => setCross(e.target.checked)}>本农场农技员确认跨月调整</Checkbox>}
        {editing && <Form.Item label="调整原因（必填）" style={{ marginTop: 20 }}><Input.TextArea value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} /></Form.Item>}
      </Form>
    </Drawer>
    <Drawer title="农事周编排详情" width="min(1160px, 100vw)" open={!!active && !editor} onClose={() => setActive(undefined)} extra={<Button onClick={() => void detail.refetch()} loading={detail.isFetching}>刷新执行结果</Button>}>
      {detail.isError && <Alert type="error" message="编排读取失败" description={(detail.error as Error).message} />}
      {row && <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space wrap><Tag color="green">{STATES[row.status]}</Tag><Typography.Text copyable>{row.id}</Typography.Text><Tag>版本 {row.revision}</Tag></Space>
        <Row gutter={16}><Col span={8}><Statistic title="农事总数" value={row.items.length} /></Col><Col span={8}><Statistic title="阻塞项" value={row.items.filter(i => i.status === 'BLOCKED').length} valueStyle={{ color: '#d46b08' }} /></Col><Col span={8}><Statistic title="任务已验收" value={row.acceptedCount} suffix={`/ ${row.tasks.length}`} /></Col></Row>
        <Descriptions column={1} size="small" items={[{ key: 'date', label: '编排区间', children: `${dayjs(row.weekStart).format('YYYY-MM-DD')} 至 ${dayjs(row.weekStart).add(6, 'day').format('YYYY-MM-DD')}` }, { key: 'source', label: '标准与资源出处', children: row.input.source }, { key: 'weather', label: '天气快照', children: `${row.input.weatherSource || '未提供'} · ${row.input.weatherIssuedAt || '未提供'}` }, { key: 'review', label: '审核 / 跨月确认', children: `${row.approvedBy || '待审核'} / ${row.crossMonthBy || '无'}` }]} />
        <Space wrap>{['DRAFT', 'APPROVED', 'PUBLISHED'].includes(row.status) && <Button onClick={openEdit}>调整输入并重排</Button>}<Button onClick={exportResult}>导出编排结果</Button><Button loading={action.isPending} onClick={() => action.mutate('explain')}>获取AI解释</Button></Space>
        <Table<CalendarScheduleItem> rowKey="key" dataSource={row.items} size="small" pagination={false} scroll={{ x: 950 }} columns={[
          { title: '农事', dataIndex: 'taskName', render: (v, i) => <><Typography.Text strong>{v}</Typography.Text><div><Tag color={i.mandatory ? 'red' : 'default'}>{i.mandatory ? '必须做' : '可延后'}</Tag>{i.windowWarning && <Tag color="orange">窗口不足3天</Tag>}{i.crossMonth && <Tag color="purple">跨月</Tag>}</div></> },
          { title: '地块 / 作物 / 生育期', render: (_, i) => <>{i.plotName}<div>{i.cropName} {i.variety}</div><Typography.Text type="secondary">{i.stageName}</Typography.Text></> },
          { title: '建议日期', dataIndex: 'date', render: (v?: string) => v || <Tag color="error">无法安排</Tag> },
          { title: '劳力 / 机具', render: (_, i) => `${i.people}人 / ${i.machineSlots}位` },
          { title: '依据与顺延原因', render: (_, i) => <><Typography.Text>{i.standardRef}</Typography.Text>{i.reasons.map(r => <div key={r}><Typography.Text type="warning">{r}</Typography.Text></div>)}</> },
        ]} />
        {row.tasks.length > 0 && <Card size="small" title="关联原农事任务 · 任务改期以实际排期为准"><Table rowKey="taskId" dataSource={row.tasks} pagination={false} size="small" scroll={{ x: 700 }} columns={[{ title: '任务', dataIndex: 'taskName' }, { title: '原编排日', dataIndex: 'scheduledDate' }, { title: '实际任务排期', dataIndex: 'actualScheduledStart', render: (v?: string) => v || '无' }, { title: '执行 / 验收', render: (_, t) => t.deleted ? <Tag color="red">任务已删除</Tag> : <>{t.status} · {t.acceptStatus === 1 ? '验收通过' : t.acceptStatus === 2 ? '验收驳回' : '待验收'}</> }, { title: '操作', render: (_, t) => <Button type="link" onClick={() => navigate(`/production/tasks/${t.taskId}`)}>原任务处理</Button> }]} /></Card>}
        {row.ai && <Alert type={row.ai.status === 'REAL_MODEL' ? 'info' : 'warning'} showIcon message={row.ai.status === 'REAL_MODEL' ? 'AI辅助解释（不得替代审核或更改约束排程）' : row.ai.message} description={row.ai.result ? <pre className="arrange-model-text">{JSON.stringify(row.ai.result, null, 2)}</pre> : undefined} />}
        {row.status !== 'CLOSED' && <Card size="small" title="审核与办理"><Input.TextArea rows={2} value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} placeholder="审核意见、调整或结案原因" /><Space wrap style={{ marginTop: 12 }}><Checkbox checked={cross} onChange={e => setCross(e.target.checked)}>本农场农技员确认跨月安排</Checkbox>{row.status === 'DRAFT' && <Button type="primary" disabled={!reason.trim() || row.items.some(i => i.status === 'BLOCKED')} loading={action.isPending} onClick={() => action.mutate('approve')}>审核通过</Button>}{row.status === 'APPROVED' && <Button type="primary" loading={action.isPending} onClick={() => action.mutate('publish')}>下发为原农事任务</Button>}{row.status === 'PUBLISHED' && <Button type="primary" disabled={!reason.trim() || row.acceptedCount !== row.tasks.length || !row.tasks.length} loading={action.isPending} onClick={() => action.mutate('close')}>全部验收后结案</Button>}</Space></Card>}
        <Collapse items={[{ key: 'events', label: `调整与操作留痕（${row.events.length}条）`, children: <Timeline items={row.events.map((e, i) => ({ key: i, children: <><Typography.Text strong>{EVENTS[e.type] ?? e.type}</Typography.Text><div>{e.operator} · {dayjs(e.createdAt).format('YYYY-MM-DD HH:mm')}</div><details><summary>查看依据和变更快照</summary><pre className="arrange-model-text">{e.payload}</pre></details></> }))} /> }]} />
      </Space>}
    </Drawer>
    <Drawer title="技术员介入处理" width={560} open={!!intervention} onClose={() => setIntervention(undefined)} extra={<Button type="primary" loading={resolve.isPending} disabled={!interventionNote.trim()} onClick={() => resolve.mutate()}>登记处理</Button>}><Alert showIcon type="info" message="仅本农场在职农技员可登记，处理记录不等于任务验收" /><Input.TextArea style={{ marginTop: 20 }} rows={6} value={interventionNote} maxLength={2000} placeholder="现场核查、未完成原因、协调方案和后续责任人" onChange={e => setInterventionNote(e.target.value)} /></Drawer>
  </Card>
}
