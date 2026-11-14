import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Col, Descriptions, Drawer, Empty, Form, Image, Input, Modal, Progress, Row, Select, Space, Spin, Steps, Table, Tag, Timeline, Typography, Upload, DatePicker, Switch } from 'antd'
import { ExperimentOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, FileSearchOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import PageContainer from '@/components/ProductionPageContainer'
import useAuthStore from '@/store/auth'
import useFarmStore from '@/store/farm'
import { listPlots } from '@/api/plots'
import { listMembers } from '@/api/members'
import { createPestTask, followUpPestCase, getPestCase, listPestCases, retryPestCase, reviewPestCase, submitPestCase, savePestHandoff } from '@/api/pest-diagnosis'
import type { PestCase, PestCaseStatus, PestCaseSummary, PestDiagnosisInput } from '@/api/pest-diagnosis'
import PestKnowledgeEvidence from './PestKnowledgeEvidence'
import PestImageEvidence from './PestImageEvidence'
import './PestDetection.css'

const STATUS: Record<PestCaseStatus, { label: string; color: string }> = {
  NEEDS_RETAKE: { label: '待重拍', color: 'orange' },
  RUNNING: { label: '诊断中', color: 'processing' }, FAILED: { label: '诊断失败', color: 'error' },
  DIAGNOSED: { label: '待人工核验', color: 'gold' }, REVIEWED: { label: '已核验', color: 'cyan' },
  FOLLOW_UP: { label: '处置随访中', color: 'blue' }, CLOSED: { label: '已结案', color: 'success' },
}
const OUTCOME: Record<string, string> = { IMPROVED: '已有改善', UNCHANGED: '暂无变化', WORSE: '症状加重', RESOLVED: '症状消退' }
const riskLabels = { LOW: '低风险', MEDIUM: '中风险', HIGH: '高风险', UNCERTAIN: '证据不足' }
function fileData(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片读取失败')); reader.readAsDataURL(file) })
}

export default function PestDetection(): JSX.Element {
  const tenant = useAuthStore(s => s.userInfo?.tenantId)
  const farmId = useFarmStore(s => s.currentFarm?.farmId)
  return <PestWorkspace key={`${tenant ?? ''}:${farmId ?? ''}`} tenant={String(tenant ?? '')} farmId={farmId} />
}
function PestWorkspace({ tenant, farmId }: { tenant: string; farmId?: string }): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [params] = useSearchParams()
  const cache = useQueryClient()
  const [form] = Form.useForm<PestDiagnosisInput>()
  const [reviewForm] = Form.useForm()
  const [handoffForm] = Form.useForm()
  const [taskForm] = Form.useForm()
  const [feedbackForm] = Form.useForm()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [status, setStatus] = useState<string>()
  const [page, setPage] = useState(1)
  const [activeId, setActiveId] = useState<string>()
  const [action, setAction] = useState<'review' | 'task' | 'feedback' | 'handoff'>()
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const plotId = params.get('plotId') ?? undefined
  const plots = useQuery({ queryKey: ['pest-plots', tenant, farmId], queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 100 }), enabled: Boolean(farmId) })
  const history = useQuery({ queryKey: ['pest-cases', tenant, farmId, plotId, status, page], queryFn: () => listPestCases({ farmId, plotId, status, pageNum: page, pageSize: 10 }), enabled: Boolean(tenant && farmId), refetchInterval: query => query.state.data?.list.some(x => x.status === 'RUNNING') ? 5000 : false })
  const detail = useQuery({ queryKey: ['pest-case', tenant, activeId], queryFn: () => getPestCase(activeId!), enabled: Boolean(activeId), refetchInterval: query => query.state.data?.status === 'RUNNING' ? 5000 : false })
  const members = useQuery({ queryKey: ['pest-members', tenant, detail.data?.farmId], queryFn: () => listMembers({ farmId: detail.data?.farmId, pageNum: 1, pageSize: 100 }), enabled: action === 'task' && Boolean(detail.data?.farmId) })
  const update = (row: PestCase): void => { setActiveId(row.id); cache.setQueryData(['pest-case', tenant, row.id], row); void cache.invalidateQueries({ queryKey: ['pest-cases', tenant] }) }
  const submit = useMutation({ mutationFn: async (values: PestDiagnosisInput) => {
    if (!files.length) throw new Error('请添加至少一张现场照片')
    const images = await Promise.all(files.map(f => fileData(f.originFileObj!)))
    return submitPestCase({ ...values, requestId, images })
  }, onSuccess: row => { update(row); setRequestId(crypto.randomUUID()); if (row.status !== 'FAILED' && row.status !== 'NEEDS_RETAKE') { setFiles([]); form.resetFields(); message.success('病例和诊断结果已保存') } else message.warning(row.status === 'NEEDS_RETAKE' ? '病例已保存，请根据质量指引重新拍摄发起诊断' : '病例已保存，真实模型诊断失败，可在详情重试或人工核验') }, onError: (error: Error) => message.error(error.message) })
  const retry = useMutation({ mutationFn: retryPestCase, onSuccess: update })
  const review = useMutation({ mutationFn: (values: { conclusion: string; advice: string; modelCorrect: boolean }) => reviewPestCase(activeId!, values), onSuccess: row => { update(row); setAction(undefined); message.success('人工核验已保存') } })
  const task = useMutation({ mutationFn: (values: { taskName: string; assigneeId?: string; priority: string; dates: [dayjs.Dayjs, dayjs.Dayjs] }) => createPestTask(activeId!, { taskName: values.taskName, taskType: 'pest_control', assigneeId: values.assigneeId, priority: values.priority, planStartDate: values.dates[0].format('YYYY-MM-DD HH:mm:ss'), planEndDate: values.dates[1].format('YYYY-MM-DD HH:mm:ss') }), onSuccess: row => { update(row); setAction(undefined); message.success('已创建并关联农事任务，请前往任务管理派发及验收') } })
  const feedback = useMutation({ mutationFn: (values: { outcome: string; note: string; close: boolean }) => followUpPestCase(activeId!, values), onSuccess: row => { update(row); setAction(undefined); message.success(row.status === 'CLOSED' ? '随访已保存，病例已结案' : '随访观察已保存') } })
  const handoff = useMutation({ mutationFn: (values: { kind: string; state: string; target: string; receipt?: string; note: string }) => savePestHandoff(activeId!, values), onSuccess: record => { update(record); setAction(undefined); message.success('办理记录已保存；对外提交请以实际回执为准') } })
  const row = detail.data
  const step = row?.status === 'CLOSED' ? 4 : row?.status === 'FOLLOW_UP' ? 3 : row?.status === 'REVIEWED' ? 2 : row?.status === 'DIAGNOSED' ? 1 : 0
  const openAction = (kind: 'review' | 'task' | 'feedback' | 'handoff'): void => {
    if (kind === 'review') reviewForm.setFieldsValue({ conclusion: row?.review?.conclusion ?? row?.result?.summary, advice: row?.review?.advice ?? row?.result?.suggestions })
    if (kind === 'task') { taskForm.resetFields(); taskForm.setFieldsValue({ taskName: `${row?.cropName}病虫害处置`, priority: '2' }) }
    if (kind === 'handoff') { handoffForm.resetFields(); handoffForm.setFieldsValue({ kind: row?.result?.quarantineSuspected ? 'REPORT' : row?.expertRequired ? 'EXPERT' : 'SAMPLE', state: 'PENDING' }) }
    if (kind === 'feedback') { feedbackForm.resetFields(); feedbackForm.setFieldsValue({ close: false }) }
    setAction(kind)
  }
  return <PageContainer title="多模态病虫害诊断" subTitle="图像与现场症状联合分析 · 人工核验 · 农事处置 · 效果随访">
    <div className="pest-workspace">
      <div className="pest-hero"><div><Tag color="green">生产管理 · 智能植保</Tag><Typography.Title level={3}>让每一次诊断都有依据、有跟进</Typography.Title><Typography.Paragraph>保留现场事实，结合图像分析候选病因，由人工核验后进入农事执行。</Typography.Paragraph></div><SafetyCertificateOutlined className="pest-hero-icon" /></div>
      <Steps className="pest-overview-steps" size="small" items={[{ title: '图文采集' }, { title: '模型分析' }, { title: '人工核验' }, { title: '任务与随访' }, { title: '效果结案' }]} current={0} />
      {!farmId && <Alert showIcon type="warning" message="请先选择当前农场，再发起诊断和查询病例" />}
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}><Card title={<Space><ExperimentOutlined />发起现场诊断</Space>}>
          <Alert type="info" showIcon message="AI输出为辅助判断，核验后再执行处置" description="支持1至3张JPEG/PNG照片，每张不超过1MB。建议包含全株、病部近景和叶背；不要上传个人敏感信息。" />
          <Form form={form} layout="vertical" onFinish={values => submit.mutate(values)} initialValues={{ plotId }} onValuesChange={() => setRequestId(crypto.randomUUID())} disabled={submit.isPending || !farmId} style={{ marginTop: 20 }}>
            <Form.Item label="诊断地块" name="plotId" rules={[{ required: true, message: '请选择地块' }]}><Select showSearch optionFilterProp="label" loading={plots.isLoading} placeholder="选择当前农场地块" options={(plots.data?.list ?? []).map(p => ({ value: String(p.plotId), label: p.plotName }))} onChange={value => { const p = plots.data?.list.find(p => String(p.plotId) === value); if (p) form.setFieldValue('cropName', p.currentCrop ?? '') }} /></Form.Item>
            <Row gutter={12}><Col span={12}><Form.Item label="作物名称" name="cropName" rules={[{ required: true, whitespace: true, max: 100, message: '填写作物名称，最多100字' }]}><Input maxLength={100} placeholder="例如：番茄" /></Form.Item></Col><Col span={12}><Form.Item label="生育阶段" name="growthStage"><Input maxLength={100} placeholder="例如：开花结果期" /></Form.Item></Col></Row>
            <Form.Item label="现场照片" required><Upload listType="picture-card" fileList={files} accept="image/jpeg,image/png" maxCount={3} beforeUpload={file => { if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 1024 * 1024 || !file.size) { message.error('请选择不超过1MB的JPEG/PNG图片'); return Upload.LIST_IGNORE } return false }} onChange={({ fileList }) => { setFiles(fileList); setRequestId(crypto.randomUUID()) }} onPreview={file => { if (file.originFileObj) void fileData(file.originFileObj).then(url => { Modal.info({ title: '现场照片', width: 700, content: <Image src={url} alt="诊断现场照片" /> }) }) }}>{files.length < 3 && <div><PlusOutlined /><div>添加照片</div></div>}</Upload></Form.Item>
            <Form.Item label="症状描述" name="symptoms" rules={[{ required: true, whitespace: true, max: 3000, message: '请描述症状，最多3000字' }]}><Input.TextArea rows={4} maxLength={3000} showCount placeholder="发生时间、受害部位、斑点形态、扩散范围等" /></Form.Item>
            <Form.Item label="环境与天气" name="environment"><Input.TextArea rows={2} maxLength={1000} placeholder="温湿度、近期降雨、棚内通风等现场观测" /></Form.Item>
            <Form.Item label="语音转写文本（可选）" name="voiceTranscript"><Input.TextArea rows={2} maxLength={3000} placeholder="粘贴语音转写，或使用设备语音输入；本页暂不上传录音" /></Form.Item>
            <Form.Item label="本地植保周报 / 发生情况（可选）" name="localBulletin"><Input.TextArea rows={2} maxLength={2000} placeholder="补充实际周报内容，未提供时不假定当地发生情况" /></Form.Item>
            <Form.Item label="周报出处与日期 / 版本" name="bulletinSource"><Input maxLength={200} placeholder="如：植保站名称、周报日期、期号" /></Form.Item>
            <Form.Item label="近期农事与用药" name="recentTreatment"><Input.TextArea rows={2} maxLength={1000} placeholder="近期施肥、灌溉、用药及处理后的变化" /></Form.Item>
            <Button block type="primary" htmlType="submit" icon={<FileSearchOutlined />} loading={submit.isPending} disabled={!farmId}>保存病例并开始诊断</Button>
            {submit.isPending && <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>正在分析现场图文，请勿重复提交。模型调用失败也会保留病例。</Typography.Paragraph>}
          </Form>
        </Card></Col>
        <Col xs={24} xl={14}><Card title="诊断病例工作台" extra={<Button icon={<ReloadOutlined />} onClick={() => void history.refetch()} disabled={!farmId}>刷新</Button>}>
          <div className="pest-list-toolbar"><Typography.Text type="secondary">当前农场{plotId ? ' · 指定地块' : ''}的病例记录</Typography.Text><Select allowClear placeholder="全部状态" value={status} style={{ width: 160 }} options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} onChange={value => { setStatus(value); setPage(1) }} /></div>
          {history.isError ? <Alert type="error" showIcon message="病例加载失败" action={<Button onClick={() => void history.refetch()}>重试</Button>} /> : <Table<PestCaseSummary> rowKey="id" dataSource={history.data?.list ?? []} loading={history.isLoading} size="middle" scroll={{ x: 560 }} locale={{ emptyText: <Empty description="暂无病例，上传现场照片开始第一次诊断" /> }} pagination={{ current: page, total: history.data?.total ?? 0, pageSize: 10, showSizeChanger: false, onChange: setPage }} columns={[
            { title: '地块 / 作物', key: 'plot', render: (_, r) => <><Typography.Text strong>{r.plotName}</Typography.Text><div><Typography.Text type="secondary">{r.cropName}</Typography.Text></div></> },
            { title: '状态', dataIndex: 'status', render: (s: PestCaseStatus) => <Tag color={STATUS[s]?.color}>{STATUS[s]?.label ?? s}</Tag> },
            { title: '采集时间', dataIndex: 'createdAt', render: (v: string) => dayjs(v).format('MM-DD HH:mm') },
            { title: '操作', key: 'actions', render: (_, r) => <Button type="link" onClick={() => setActiveId(r.id)}>查看病例</Button> },
          ]} />}
          <Alert style={{ marginTop: 20 }} type="success" showIcon message="病例与执行职责清晰" description="此处管理诊断证据、核验及效果记录；任务派发、执行和验收统一在农事任务中完成。AI中台负责模型与提示词管理。" />
        </Card></Col>
      </Row>
      <Drawer title="诊断病例详情" open={Boolean(activeId)} width={Math.min(880, window.innerWidth)} onClose={() => setActiveId(undefined)}>
        {detail.isLoading ? <Spin /> : detail.isError ? <Alert type="error" message="病例读取失败" action={<Button onClick={() => void detail.refetch()}>重试</Button>} /> : row && <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Space wrap><Tag color={STATUS[row.status].color}>{STATUS[row.status].label}</Tag><Typography.Text copyable>{row.id}</Typography.Text></Space>
          <Steps size="small" current={step} status={row.status === 'FAILED' ? 'error' : undefined} items={[{ title: '诊断' }, { title: '核验' }, { title: '处置' }, { title: '随访' }, { title: '结案' }]} />
          <Descriptions size="small" column={2} items={[{ key: 'plot', label: '地块', children: row.plotName }, { key: 'crop', label: '作物', children: row.cropName }, { key: 'stage', label: '生育阶段', children: row.input.growthStage || '未填写' }, { key: 'at', label: '采集时间', children: dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') }]} />
          <Card size="small" title="现场事实"><Image.PreviewGroup><Space wrap>{row.input.images.map((url, i) => <Image key={i} src={url} width={130} height={110} style={{ objectFit: 'cover' }} alt={`现场照片${i + 1}`} />)}</Space></Image.PreviewGroup><Typography.Paragraph className="pest-preline">{row.input.symptoms}</Typography.Paragraph><Typography.Paragraph>环境：{row.input.environment || '未填写'}</Typography.Paragraph><Typography.Paragraph>语音转写：{row.input.voiceTranscript || '未提供'}</Typography.Paragraph><Typography.Paragraph>本地发生：{row.input.localBulletin || '未提供'} · 出处：{row.input.bulletinSource || '未提供'}</Typography.Paragraph><Typography.Paragraph>近期处置：{row.input.recentTreatment || '未填写'}</Typography.Paragraph></Card>
          {row.status === 'RUNNING' && <Alert showIcon type="info" message="诊断处理中，页面将自动刷新；超过2分钟可重试" />}
          {row.status === 'NEEDS_RETAKE' && <Alert type="warning" showIcon message="现场图像质量不足，请重拍" description={row.result?.qualityGuidance || '请补充全株、病部近景和叶背照片，保持清晰、自然光，避免逆光反光。'} action={<Button onClick={() => { form.setFieldsValue({ ...row.input, requestId: undefined, images: undefined }); setFiles([]); setRequestId(crypto.randomUUID()); setActiveId(undefined) }}>带入信息重新拍摄</Button>} />}
          {row.result && row.status !== 'NEEDS_RETAKE' && <Alert showIcon type={row.result.quarantineSuspected ? 'error' : 'warning'} message={({ HIGH_CONFIDENCE: '高置信候选 · 人工核验后处置', SUSPECTED: '疑似 · 建议48小时内采样', EXPERT: '低置信或图谱外 · 需专家复核', REPORT: '检疫性病害疑似 · 当日上报属地植保机构', RETAKE: '低质图 · 需要重拍' } as Record<string, string>)[row.result.tier]} description={row.result.quarantineSuspected ? '不得自行防治；请联系属地植保机构并在此登记回执及处理意见。' : '模型置信度不等于准确率。图谱范围由服务端依据实际检索证据及引用编号校验；无有效引用时需专家复核。'} />}
          {(row.expertRequired || row.followUpOverdue || row.modelRecallRequired) && <Alert showIcon type="warning" message={[row.expertRequired ? '需要专家复核' : '', row.followUpOverdue ? '7天随访已到期' : '', row.modelRecallRequired ? '该地块连续3次复核判为误诊，需模型回溯' : ''].filter(Boolean).join('；')} />}
          <Descriptions size="small" column={1} items={[{ key: 'followDue', label: '7天跟踪截止', children: row.followUpDueAt ? dayjs(row.followUpDueAt).format('YYYY-MM-DD HH:mm') : '未开始' }, ...(row.sampleDueAt ? [{ key: 'sampleDue', label: '建议采样截止', children: dayjs(row.sampleDueAt).format('YYYY-MM-DD HH:mm') }] : []), ...(row.reportDueAt ? [{ key: 'reportDue', label: '属地上报截止', children: dayjs(row.reportDueAt).format('YYYY-MM-DD HH:mm') }] : [])]} />
          {row.failureMessage && <Alert type="warning" showIcon message="模型未生成有效诊断" description={row.failureMessage} />}
          {row.result && <Card size="small" title="模型辅助分析" extra={<Tag color={row.result.riskLevel === 'HIGH' ? 'red' : 'orange'}>{riskLabels[row.result.riskLevel]}</Tag>}><Typography.Paragraph className="pest-preline">{row.result.summary}</Typography.Paragraph>{row.result.candidates.map((c, i) => <div className="pest-candidate" key={i}><Space><Typography.Text strong>{c.name}</Typography.Text><Tag>候选病因</Tag></Space><Progress percent={Math.round(c.confidence * 100)} size="small" strokeColor="#43936c" /><Typography.Paragraph type="secondary">{c.evidence}</Typography.Paragraph></div>)}<Typography.Title level={5}>建议与补充证据</Typography.Title><Typography.Paragraph className="pest-preline">{row.result.suggestions}</Typography.Paragraph><Typography.Paragraph type="warning">{row.result.medicationPolicy}</Typography.Paragraph><Typography.Paragraph>图谱引用：{row.result.knowledgeReferences || '本次没有有效图谱引用'}</Typography.Paragraph><Typography.Paragraph>待补充：{row.result.missingEvidence || '请由人工结合现场继续核验'}</Typography.Paragraph><Typography.Text type="secondary">模型：{row.result.usage?.model ?? '未返回'} · 提示词版本：{row.result.usage?.prompt_version ?? '未返回'} · 追踪：{row.result.traceId ?? '未返回'}</Typography.Text></Card>}
          <PestImageEvidence snapshot={row.result?.imageSnapshot} attempts={row.imageAttempts} />
          <PestKnowledgeEvidence snapshot={row.result?.knowledgeSnapshot ?? row.knowledgeAttempts?.[row.knowledgeAttempts.length - 1]?.snapshot} referenceIds={row.result?.referenceIds} />
          {row.review && <Card size="small" title="人工核验记录"><Typography.Paragraph className="pest-preline">{row.review.conclusion}</Typography.Paragraph><Typography.Paragraph className="pest-preline">{row.review.advice}</Typography.Paragraph><Typography.Text type="secondary">核验人：{row.review.reviewer} · {dayjs(row.review.reviewedAt).format('YYYY-MM-DD HH:mm')}</Typography.Text></Card>}
          {row.taskId && <Alert type="info" message={`已关联农事任务 ${row.taskId}`} description="在农事任务中派发、执行、提交成果和验收，再回此处随访结案。" action={<Button onClick={() => navigate(`/production/tasks/${row.taskId}`)}>查看任务</Button>} />}
          {Boolean(row.feedback?.length) && <Card size="small" title="效果随访"><Timeline items={row.feedback!.map((f, i) => ({ key: i, children: <><Typography.Text strong>{OUTCOME[f.outcome]}{f.closed ? ' · 已结案' : ''}</Typography.Text><Typography.Paragraph className="pest-preline">{f.note}</Typography.Paragraph><Typography.Text type="secondary">{f.operator} · {dayjs(f.createdAt).format('YYYY-MM-DD HH:mm')}</Typography.Text></> }))} /></Card>}
          {Boolean(row.events?.some(e => e.type === 'HANDOFF')) && <Card size="small" title="采样 / 专家 / 属地上报办理留痕"><Timeline items={row.events!.filter(e => e.type === 'HANDOFF').map((e, i) => ({ key: i, children: <><Typography.Text strong>{({ EXPERT: '专家复核', REPORT: '属地上报', SAMPLE: '采样送检' } as Record<string, string>)[e.payload.kind ?? '']} · {({ PENDING: '待办理', SUBMITTED: '已提交', RESOLVED: '已收到处理结论' } as Record<string, string>)[e.payload.state ?? '']}</Typography.Text><Typography.Paragraph>{e.payload.target} · 回执：{e.payload.receipt || '尚无回执'}</Typography.Paragraph><Typography.Paragraph>{e.payload.note}</Typography.Paragraph><Typography.Text type="secondary">{dayjs(e.createdAt).format('YYYY-MM-DD HH:mm')}</Typography.Text></> }))} /></Card>}
          <Alert type="info" showIcon message="人工核验、转任务和结案需主体负责人操作；专业结论请结合现场农技人员意见。" />
          <Space wrap>
            {(row.status === 'FAILED' || (row.status === 'RUNNING' && dayjs().diff(dayjs(row.updatedAt), 'minute') >= 2)) && <Button loading={retry.isPending} onClick={() => retry.mutate(row.id)}>重试真实诊断</Button>}
            {['DIAGNOSED', 'FAILED', 'REVIEWED'].includes(row.status) && <Button type="primary" onClick={() => openAction('review')}>人工核验</Button>}
            {!['CLOSED', 'RUNNING', 'NEEDS_RETAKE'].includes(row.status) && <Button onClick={() => openAction('handoff')}>采样 / 专家 / 上报登记</Button>}
            {row.status === 'REVIEWED' && !row.taskId && <Button onClick={() => openAction('task')}>转农事任务</Button>}
            {['REVIEWED', 'FOLLOW_UP'].includes(row.status) && <Button onClick={() => openAction('feedback')}>记录随访 / 结案</Button>}
          </Space>
        </Space>}
      </Drawer>
      <Modal title="人工核验" open={action === 'review'} onCancel={() => setAction(undefined)} onOk={() => reviewForm.submit()} confirmLoading={review.isPending} destroyOnClose><Alert type="warning" showIcon message="请依据现场专业意见核验，勿直接把AI候选病因当作确诊。" /><Form form={reviewForm} layout="vertical" onFinish={values => review.mutate(values)} style={{ marginTop: 16 }}><Form.Item name="conclusion" label="核验结论" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={4} maxLength={2000} /></Form.Item><Form.Item name="modelCorrect" label="模型判断是否正确" rules={[{ required: true, message: '请选择复核评价' }]}><Select options={[{ value: true, label: '基本正确' }, { value: false, label: '错误 / 无有效判断' }]} /></Form.Item><Form.Item name="advice" label="核验后的处置建议（用药须核对登记范围和标签）" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={5} maxLength={5000} /></Form.Item></Form></Modal>
      <Modal title="转农事任务" open={action === 'task'} onCancel={() => setAction(undefined)} onOk={() => taskForm.submit()} confirmLoading={task.isPending} destroyOnClose><Alert type="info" showIcon message="复用农事任务执行闭环，地块、核验结论与病例来源将自动关联；同一病例不会重复建任务。" /><Form form={taskForm} layout="vertical" onFinish={values => task.mutate(values)} style={{ marginTop: 16 }}><Form.Item name="taskName" label="任务名称" rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item><Form.Item name="assigneeId" label="执行成员"><Select allowClear loading={members.isLoading} placeholder="可稍后在任务中派发" options={(members.data?.list ?? []).map(m => ({ value: String(m.memberId), label: m.realName }))} /></Form.Item><Form.Item name="dates" label="计划执行时间" rules={[{ required: true }, { validator: (_, value) => !value || value[1].isAfter(value[0]) ? Promise.resolve() : Promise.reject(new Error('结束时间必须晚于开始时间')) }]}><DatePicker.RangePicker showTime style={{ width: '100%' }} /></Form.Item><Form.Item name="priority" label="优先级"><Select options={[{ value: '2', label: '普通' }, { value: '3', label: '重要' }, { value: '4', label: '紧急' }]} /></Form.Item></Form></Modal>
      <Modal title="跨域办理留痕" open={action === 'handoff'} onCancel={() => setAction(undefined)} onOk={() => handoffForm.submit()} confirmLoading={handoff.isPending} destroyOnClose><Alert showIcon type="warning" message="此处登记实际办理过程，不会自动向专家或政府发送内容。专家接诊由综合服务办理，检疫疑似联系属地植保机构；请填写真实回执。" /><Form form={handoffForm} layout="vertical" style={{ marginTop: 16 }} onFinish={values => handoff.mutate(values)}><Form.Item name="kind" label="办理事项" rules={[{ required: true }]}><Select options={[{ value: 'EXPERT', label: '专家复核' }, { value: 'SAMPLE', label: '采样送检' }, { value: 'REPORT', label: '属地植保机构上报' }]} /></Form.Item><Form.Item name="target" label="接收专家 / 机构" rules={[{ required: true, whitespace: true }]}><Input maxLength={200} /></Form.Item><Form.Item name="state" label="办理状态" rules={[{ required: true }]}><Select options={[{ value: 'PENDING', label: '待办理' }, { value: 'SUBMITTED', label: '已提交，等待结论' }, { value: 'RESOLVED', label: '已收到处理结论' }]} /></Form.Item><Form.Item noStyle shouldUpdate={(a, b) => a.state !== b.state}>{({ getFieldValue }) => <Form.Item name="receipt" label="问诊单号 / 送检编号 / 上报回执" rules={[{ required: getFieldValue('state') !== 'PENDING', whitespace: true, message: '已提交或已办结时必须填写真实回执' }]}><Input maxLength={200} /></Form.Item>}</Form.Item><Form.Item name="note" label="办理情况 / 接收方处理结论" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={4} maxLength={3000} /></Form.Item></Form></Modal>
      <Modal title="处置效果随访" open={action === 'feedback'} onCancel={() => setAction(undefined)} onOk={() => feedbackForm.submit()} confirmLoading={feedback.isPending} destroyOnClose><Alert type="info" showIcon message="未改善或恶化时继续跟踪；结案需症状改善或消退，且关联任务已完成验收。" /><Form form={feedbackForm} layout="vertical" onFinish={values => feedback.mutate(values)} style={{ marginTop: 16 }}><Form.Item name="outcome" label="观察结果" rules={[{ required: true }]}><Select options={Object.entries(OUTCOME).map(([value, label]) => ({ value, label }))} /></Form.Item><Form.Item name="note" label="观察情况与后续安排" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={4} maxLength={2000} /></Form.Item><Form.Item name="close" label="本次结案" valuePropName="checked"><Switch /></Form.Item></Form></Modal>
    </div>
  </PageContainer>
}
