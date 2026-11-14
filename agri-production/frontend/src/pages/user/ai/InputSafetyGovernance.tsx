import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Drawer, Form, Input, InputNumber, Select, Space, Table, Tabs, Tag, Typography } from 'antd'
import { pageInputs } from '@/api/inputs'
import { listSafetyRules, saveSafetyRule, listSafetyRisks, reviewSafetyRisk, getRegistrationSyncConfig, listRegistrationSyncBatches, syncRegistrationData } from '@/api/input-safety'
import type { SafetyRuleKind } from '@/api/input-safety'

const LABELS = { registration: '作物靶标登记规则', restrictions: '属地禁限用名录', compatibility: '配伍禁忌规则' }
export default function InputSafetyGovernance(): JSX.Element {
  const { message } = App.useApp()
  const client = useQueryClient()
  const [kind, setKind] = useState<SafetyRuleKind>('registration')
  const [editing, setEditing] = useState(false)
  const [reviewId, setReviewId] = useState<string>()
  const [note, setNote] = useState('')
  const [form] = Form.useForm<Record<string, unknown>>()
  const rules = useQuery({ queryKey: ['safety-rules', kind], queryFn: () => listSafetyRules(kind) })
  const risks = useQuery({ queryKey: ['safety-risks'], queryFn: listSafetyRisks })
  const syncConfig = useQuery({ queryKey: ['registration-sync-config'], queryFn: getRegistrationSyncConfig })
  const batches = useQuery({ queryKey: ['registration-sync-batches'], queryFn: listRegistrationSyncBatches })
  const sync = useMutation({ mutationFn: () => syncRegistrationData(), onSuccess: row => { void client.invalidateQueries({ queryKey: ['registration-sync-batches'] }); void client.invalidateQueries({ queryKey: ['safety-rules'] }); message.success(`同步完成：解析 ${row.parsed_rows ?? 0} 条，生成草稿 ${row.imported_rows ?? 0} 条`) }, onError: (e: Error) => message.error(e.message) })
  const inputs = useQuery({ queryKey: ['input-safety-inputs'], queryFn: () => pageInputs({ pageNum: 1, pageSize: 500 }) })
  const options = (inputs.data?.list ?? []).map(x => ({ value: String(x.inputId), label: x.inputName }))
  const save = useMutation({ mutationFn: (values: Record<string, unknown>) => saveSafetyRule(kind, values), onSuccess: () => { setEditing(false); void client.invalidateQueries({ queryKey: ['safety-rules'] }); message.success('规则及版本快照已保存') }, onError: (e: Error) => message.error(e.message) })
  const review = useMutation({ mutationFn: () => reviewSafetyRisk(reviewId!, note), onSuccess: () => { setReviewId(undefined); setNote(''); void client.invalidateQueries({ queryKey: ['safety-risks'] }); message.success('复核处置已留痕，不改变原用药事实') }, onError: (e: Error) => message.error(e.message) })
  const field = (name: string | string[], label: string, required = false): JSX.Element => <Form.Item key={String(name)} name={name} label={label} rules={[{ required, message: `请填写${label}` }]}><Input maxLength={500} /></Form.Item>
  return <Card title="安全依据与实际用药复核">
    <Tabs items={[{ key: 'rules', label: '安全依据维护', children: <>
      <Alert type="info" showIcon message="主体所有者维护并审核依据；草稿不参与推荐。请依据真实有效的登记证和属地名录填写，不使用原型示例处方。" />
      <Card size="small" title="农业农村部登记数据同步" style={{ marginTop: 16 }} extra={<Button type="primary" loading={sync.isPending} onClick={() => sync.mutate()}>同步官方登记清单</Button>}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>来源：{syncConfig.data?.sourceName ?? '农业农村部农药登记信息'}</Typography.Text>
          <Typography.Text type="secondary">同步后只生成草稿；官方清单缺少剂量和安全间隔时，必须补充核准标签并人工审核，不能直接推荐。</Typography.Text>
          <Table size="small" rowKey="id" loading={batches.isLoading} dataSource={(batches.data ?? []).slice(0, 5)} pagination={false} columns={[{ title: '时间', dataIndex: 'started_at' }, { title: '状态', dataIndex: 'status', render: v => <Tag color={v === 'SUCCEEDED' ? 'green' : v === 'FAILED' ? 'red' : 'blue'}>{v === 'SUCCEEDED' ? '成功' : v === 'FAILED' ? '失败' : '进行中'}</Tag> }, { title: '解析 / 草稿', render: (_, r) => `${r.parsed_rows ?? 0} / ${r.imported_rows ?? 0}` }, { title: '待处理', dataIndex: 'skipped_rows' }, { title: '错误', dataIndex: 'error_message', ellipsis: true }]} locale={{ emptyText: '暂无同步批次' }} />
        </Space>
      </Card>
      <Space wrap style={{ margin: '16px 0' }}><Select value={kind} onChange={setKind} style={{ width: 220 }} options={Object.entries(LABELS).map(([value, label]) => ({ value, label }))} /><Button onClick={() => { form.resetFields(); form.setFieldsValue({ status: 'DRAFT' }); setEditing(true) }}>新增依据</Button><Button onClick={() => void rules.refetch()}>刷新</Button></Space>
      {rules.isError && <Alert type="error" message="安全依据加载失败，请重试" />}
      <Table<Record<string, unknown>> size="small" rowKey="id" loading={rules.isLoading} dataSource={rules.data ?? []} scroll={{ x: 850 }} pagination={{ pageSize: 8 }} columns={[{ title: '编号', dataIndex: 'id' }, { title: '投入品 / 名录', render: (_, r) => String(r.input_name || r.input_id || r.restriction_type || '—') }, { title: '登记范围 / 原因', render: (_, r) => Boolean(r.crop_name) ? `${String(r.crop_name)} · ${String(r.target_name)}` : String(r.reason ?? '—') }, { title: '依据', dataIndex: 'source', ellipsis: true }, { title: '状态', dataIndex: 'status', render: value => <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>{value === 'ACTIVE' ? '已启用' : value === 'DRAFT' ? '草稿' : '已停用'}</Tag> }, { title: '操作', render: (_, r) => <Button type="link" onClick={() => { form.resetFields(); form.setFieldsValue({ ...r, input_id: r.input_id == null ? undefined : String(r.input_id), other_input_id: r.other_input_id == null ? undefined : String(r.other_input_id), evidence: (r.evidence ?? {}) as Record<string, unknown> }); setEditing(true) }}>编辑 / 审核</Button> }]} />
    </> }, { key: 'risks', label: `实际用药待复核（${(risks.data ?? []).filter(x => x.state === 'OPEN').length}）`, children: <>
      <Alert type="warning" showIcon message="风险来自真实台账比对；复核只记录处置，不把违规用药变成合规，也不改库存或原台账。" />
      <Table<Record<string, unknown>> style={{ marginTop: 16 }} rowKey="id" dataSource={risks.data ?? []} loading={risks.isLoading} pagination={{ pageSize: 8 }} columns={[{ title: '台账编号', dataIndex: 'usage_id' }, { title: '风险依据', render: (_, r) => { try { const p = JSON.parse(String(r.payload_json)) as { reasons?: string[] }; return p.reasons?.join('；') } catch { return '读取失败' } } }, { title: '状态', dataIndex: 'state', render: v => v === 'OPEN' ? <Tag color="red">待复核</Tag> : <Tag>已复核</Tag> }, { title: '处置', render: (_, r) => r.state === 'OPEN' ? <Button type="link" onClick={() => { setReviewId(String(r.id)); setNote('') }}>登记复核</Button> : <Typography.Text>{String(r.review_note ?? '')}</Typography.Text> }]} />
    </> }]} />
    <Drawer title={`维护${LABELS[kind]}`} open={editing} onClose={() => setEditing(false)} width={600} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={values => save.mutate(values)}>
        <Form.Item name="id" hidden><Input /></Form.Item>
        <Form.Item name="status" label="审核状态" rules={[{ required: true }]}><Select options={[{ value: 'DRAFT', label: '草稿' }, { value: 'ACTIVE', label: '审核启用' }, { value: 'INACTIVE', label: '停用' }]} /></Form.Item>
        <Form.Item name="input_id" label={kind === 'restrictions' ? '匹配投入品（名录整表核验时留空）' : '投入品'} rules={[{ required: kind !== 'restrictions' }]}><Select allowClear showSearch optionFilterProp="label" options={options} /></Form.Item>
        {kind === 'registration' && <>
          {field('crop_name', '登记作物', true)}{field('target_name', '登记靶标', true)}{field('registration_no', '登记证号')}
          <Space align="start"><Form.Item name="dosage_min" label="最低登记剂量"><InputNumber min={0} /></Form.Item><Form.Item name="dosage_max" label="最高登记剂量"><InputNumber min={0} /></Form.Item><Form.Item name="safety_interval_days" label="安全间隔（天）"><InputNumber min={0} precision={0} /></Form.Item></Space>
          {field('dosage_unit', '登记剂量单位（例如克/亩）')}{field('application_method', '登记施用方式')}{field('rotation_group', '作用机制 / 轮换组')}{field('source_version', '登记资料版本')}
          {field(['evidence', 'validFrom'], '登记生效日期（YYYY-MM-DD）')}{field(['evidence', 'validUntil'], '登记到期日期（YYYY-MM-DD）')}{field(['evidence', 'ingredients'], '有效成分（多项以逗号分隔）')}
        </>}
        {kind === 'restrictions' && <>
          <Form.Item name="restriction_type" label="名录类型" rules={[{ required: true }]}><Select options={[{ value: 'CATALOG', label: '属地完整名录核验凭据（须另录禁限用条目）' }, { value: 'FORBIDDEN', label: '禁用' }, { value: 'RESTRICTED', label: '限用（拦截待核验）' }]} /></Form.Item>
          {field('input_name', '匹配名称 / 有效成分')}{field('effective_date', '生效日期（YYYY-MM-DD）')}{field('expires_at', '失效日期（YYYY-MM-DD）')}
        </>}
        {kind === 'compatibility' && <Form.Item name="other_input_id" label="组合中另一个投入品" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={options} /></Form.Item>}
        {kind !== 'registration' && <>{field('reason', '限制 / 禁忌说明', true)}{field(['evidence', 'sourceVersion'], '依据版本', true)}</>}
        {kind === 'compatibility' && field('alternative', '替代单剂处理说明')}
        {field('source', '权威出处 / 原文地址', true)}{field(['evidence', 'region'], '适用属地（校验时须完全匹配；登记可填全国）', true)}{field(['evidence', 'verifiedOn'], '核验日期（YYYY-MM-DD）', true)}
        <Button htmlType="submit" type="primary" loading={save.isPending}>保存并留存版本</Button>
      </Form>
    </Drawer>
    <Drawer title="用药风险复核处置" open={Boolean(reviewId)} onClose={() => setReviewId(undefined)} width={520}><Input.TextArea rows={6} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="填写核对结果、处置措施与依据；不以复核放行原违规事实" /><Button style={{ marginTop: 16 }} type="primary" disabled={!note.trim()} loading={review.isPending} onClick={() => review.mutate()}>保存处置留痕</Button></Drawer>
  </Card>
}
