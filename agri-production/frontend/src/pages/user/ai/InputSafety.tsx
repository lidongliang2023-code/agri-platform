import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, AutoComplete, Button, Card, Col, DatePicker, Drawer, Empty, Form, Input, List, Row, Select, Space, Statistic, Steps, Table, Tag, Typography } from 'antd'
import { CheckCircleOutlined, FileSearchOutlined, ReloadOutlined, SafetyCertificateOutlined, StopOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import PageContainer from '@/components/ProductionPageContainer'
import { pageInputs } from '@/api/inputs'
import { checkInputSafety, getInputSafety, listInputSafety } from '@/api/input-safety'
import type { SafetyCheckRequest, SafetyCheckResult } from '@/api/input-safety'
import InputSafetyGovernance from './InputSafetyGovernance'
import InputSafetyEvidence from './InputSafetyEvidence'
import './InputSafety.css'

const STATE_META: Record<string, { label: string; color: string }> = {
  PASSED: { label: '推荐可用', color: 'success' },
  NEEDS_REVIEW: { label: '待复核', color: 'warning' },
  BLOCKED: { label: '已拦截', color: 'error' },
  REJECTED: { label: '拒答', color: 'red' },
}
const CROP_OPTIONS = ['番茄', '草莓', '黄瓜', '大白菜', '生菜', '水稻', '柑橘', '葡萄']
type SafetyFormValues = Omit<SafetyCheckRequest, 'applicationDate' | 'harvestDate'> & { applicationDate: Dayjs; harvestDate?: Dayjs }

export default function InputSafety(): JSX.Element {
  const { message } = App.useApp()
  const [form] = Form.useForm<SafetyFormValues>()
  const [pageNum, setPageNum] = useState(1)
  const [activeId, setActiveId] = useState<string>()
  const [result, setResult] = useState<SafetyCheckResult>()
  const queryClient = useQueryClient()
  const inputs = useQuery({ queryKey: ['input-safety-inputs'], queryFn: () => pageInputs({ pageNum: 1, pageSize: 500 }) })
  const history = useQuery({ queryKey: ['input-safety-history', pageNum], queryFn: () => listInputSafety({ pageNum, pageSize: 20 }) })
  const detail = useQuery({ queryKey: ['input-safety-detail', activeId], queryFn: () => getInputSafety(activeId!), enabled: Boolean(activeId) })
  const check = useMutation({ mutationFn: checkInputSafety, onSuccess: row => { setResult(row); void queryClient.invalidateQueries({ queryKey: ['input-safety-history'] }); message.success(row.state === 'PASSED' ? '安全校验通过，结果已留痕' : '校验结果已保存，请按拦截原因复核') }, onError: (error: Error) => message.error(error.message) })
  const pesticideOptions = (inputs.data?.list ?? []).filter(x => x.inputType === 'PESTICIDE').map(x => ({ value: String(x.inputId), label: `${x.inputName ?? ''}${x.registrationNo ? ` · ${x.registrationNo}` : ''}` }))
  const submit = (values: SafetyFormValues): void => {
    check.mutate({ ...values, requestId: crypto.randomUUID(), applicationDate: values.applicationDate.format('YYYY-MM-DD'), harvestDate: values.harvestDate?.format('YYYY-MM-DD') })
  }
  return <PageContainer title="投入品推荐与用药安全校验" subTitle="登记范围匹配 · 禁限用拦截 · 配伍与安全间隔校验 · 推荐留痕">
    <div className="input-safety-page">
      <div className="input-safety-hero"><div><Tag color="blue">AI 农技助手 · 场景 48</Tag><Typography.Title level={3}>按登记依据给出可追溯的用药建议</Typography.Title><Typography.Paragraph>只推荐作物与靶标均在有效登记规则内的投入品，超范围、禁限用或安全间隔不足时拒答并保留原因。</Typography.Paragraph></div><SafetyCertificateOutlined className="input-safety-hero-icon" /></div>
      <Steps className="input-safety-steps" size="small" items={[{ title: '靶标匹配' }, { title: '禁忌校验' }, { title: '间隔校验' }, { title: '方案输出' }, { title: '用药留痕' }]} current={result ? 4 : 0} />
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={9}><Card title={<Space><FileSearchOutlined />发起用药安全校验</Space>}>
          <Alert type="info" showIcon message="校验结果不是处方" description="登记规则需由农资管理员维护并核验；实际用药仍在投入品使用台账登记。" />
          <Form form={form} layout="vertical" onFinish={submit} initialValues={{ applicationDate: dayjs() }} disabled={check.isPending} style={{ marginTop: 18 }}>
            <Form.Item label="作物" name="cropName" rules={[{ required: true, message: '请选择或填写作物' }]}><AutoComplete allowClear options={CROP_OPTIONS.map(value => ({ value, label: value }))} placeholder="选择或输入登记作物名称" /></Form.Item>
            <Form.Item label="实际属地" name="region" rules={[{ required: true, message: '填写属地，与已核验名录完全匹配' }]}><Input maxLength={100} placeholder="例如：北京市通州区" /></Form.Item>
            <Form.Item label="病虫害靶标" name="targetName" rules={[{ required: true, message: '填写已确认的病虫害靶标' }]}><Input maxLength={191} placeholder="例如：灰霉病；不能把症状直接当作确诊" /></Form.Item>
            <Row gutter={12}><Col span={12}><Form.Item label="拟施用日期" name="applicationDate" rules={[{ required: true, message: '请选择施用日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item label="计划采收日期" name="harvestDate" rules={[{ required: true, message: '须提供采收日期以校验安全间隔' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col></Row>
            <Form.Item label="拟混用投入品" name="mixInputIds" extra="用于配伍禁忌校验"><Select mode="multiple" showSearch optionFilterProp="label" options={pesticideOptions} placeholder={inputs.isLoading ? '投入品加载中' : '选择同次拟混用投入品'} /></Form.Item>
            <Form.Item label="近期已用投入品" name="recentInputIds" extra="用于重复成分和轮换提示"><Select mode="multiple" showSearch optionFilterProp="label" options={pesticideOptions} placeholder="选择近期用过的投入品" /></Form.Item>
            <Button block type="primary" htmlType="submit" icon={<SafetyCertificateOutlined />} loading={check.isPending}>开始安全校验</Button>
          </Form>
        </Card></Col>
        <Col xs={24} xl={15}><Card title="校验结果" extra={<Button icon={<ReloadOutlined />} onClick={() => void history.refetch()}>刷新历史</Button>}>
          {!result ? <Empty description="填写作物、靶标和日期后开始校验" /> : <SafetyResult result={result} />}
        </Card></Col>
      </Row>
      <Card title="校验历史与留痕" style={{ marginTop: 20 }}>
        <Table size="middle" rowKey="id" loading={history.isLoading} dataSource={history.data?.list ?? []} locale={{ emptyText: <Empty description="暂无校验记录" /> }} columns={[{ title: '作物 / 靶标', render: (_, r: Record<string, unknown>) => <><Typography.Text strong>{String(r.crop_name ?? '')}</Typography.Text><div><Typography.Text type="secondary">{String(r.target_name ?? '')}</Typography.Text></div></> }, { title: '状态', dataIndex: 'state', render: (value: string) => <Tag color={STATE_META[value]?.color}>{STATE_META[value]?.label ?? value}</Tag> }, { title: '请求时间', dataIndex: 'created_at' }, { title: '操作', render: (_, r: Record<string, unknown>) => <Button type="link" onClick={() => setActiveId(String(r.id))}>查看依据</Button> }]} pagination={{ current: pageNum, pageSize: 20, total: history.data?.total ?? 0, onChange: setPageNum, showSizeChanger: false }} />
      </Card>
      <InputSafetyGovernance />
      <Alert style={{ marginTop: 20 }} type="warning" showIcon message="规则与边界" description="推荐必须以有效登记证标注的作物、靶标、剂量和安全间隔为依据；没有有效规则时拒答。禁限用、配伍冲突和采收间隔不足会被拦截。推荐不创建任务、不扣库存；实际领用必须回到投入品使用台账，跨域行为按原业务流程留痕。" />
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}><Col xs={24} md={8}><Card title="使用角色 / 适用对象"><Typography.Paragraph>种植户、农技员、农资店人员，以及负责登记证复核的管理人员。</Typography.Paragraph></Card></Col><Col xs={24} md={8}><Card title="业务价值"><Typography.Paragraph>把超范围用药、禁限用和安全间隔风险拦在建议环节，减少经验用法进入实际台账。</Typography.Paragraph></Card></Col><Col xs={24} md={8}><Card title="依赖组件 / 关联模块"><Typography.Paragraph>投入品档案、病虫害图谱、登记规则、禁限用名录、配伍禁忌库和投入品使用台账。</Typography.Paragraph></Card></Col></Row>
      <Drawer title="安全校验详情" open={Boolean(activeId)} width={720} onClose={() => setActiveId(undefined)}>{detail.isLoading ? <Typography.Text>正在读取…</Typography.Text> : detail.data ? <InputSafetyEvidence record={detail.data} /> : <Empty description="记录不存在" />}</Drawer>
    </div>
  </PageContainer>
}

function SafetyResult({ result }: { result: SafetyCheckResult }): JSX.Element {
  return <Space direction="vertical" size={16} style={{ width: '100%' }}><Space wrap><Tag color={STATE_META[result.state]?.color}>{STATE_META[result.state]?.label ?? result.state}</Tag><Typography.Text type="secondary">规则命中 {result.ruleCount} 条</Typography.Text></Space><Row gutter={12}><Col span={8}><Statistic title="推荐可用" value={result.recommendations.length} valueStyle={{ color: '#3c8c62' }} /></Col><Col span={8}><Statistic title="拦截 / 拒答" value={result.blocked.length} valueStyle={{ color: '#cf4b47' }} /></Col><Col span={8}><Statistic title="配伍命中" value={result.compatibility.length} valueStyle={{ color: '#c8892d' }} /></Col></Row>{result.recommendations.length > 0 && <Card size="small" title={<Space><CheckCircleOutlined style={{ color: '#3c8c62' }} />登记范围内推荐</Space>}><List size="small" dataSource={result.recommendations} renderItem={item => <List.Item><List.Item.Meta title={<Space>{item.inputName}<Tag color="green">可用</Tag></Space>} description={`登记证：${item.registrationNo || '未提供'} · 安全间隔：${item.safetyIntervalDays ?? '—'} 天 · 剂量：${item.dosageMin ?? '—'}-${item.dosageMax ?? '—'} ${item.dosageUnit || ''} · 方式：${item.applicationMethod || '—'}`} /><Typography.Text type="secondary">{item.sourceVersion || '规则版本未提供'}</Typography.Text></List.Item>} /></Card>}{result.blocked.length > 0 && <Card size="small" title={<Space><StopOutlined style={{ color: '#cf4b47' }} />拦截与拒答原因</Space>}><List size="small" dataSource={result.blocked} renderItem={item => <List.Item><Typography.Text type="danger">{String(item.reason ?? '未通过安全校验')}</Typography.Text></List.Item>} /></Card>}<Alert type="warning" showIcon message={result.notice} /></Space>
}
