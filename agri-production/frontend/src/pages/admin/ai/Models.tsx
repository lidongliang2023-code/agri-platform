import Table from '@/components/ProductionListTable'
import { useMemo, useState } from 'react'
import { Alert, Card, Col, Descriptions, Empty, Row, Space, Statistic, Tabs, Tag, Typography } from 'antd'
import { LinkOutlined, RobotOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getAiHubOverview, listAiHubCalls, listAiHubProviders, listAiHubScenes } from '@/api'
import type { AiHubCall, AiHubProvider, AiHubScene } from '@/api'

function boolTag(value?: boolean): JSX.Element {
  return value ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>
}

function dash(value: unknown): string {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

export default function Models(): JSX.Element {
  const [callPage, setCallPage] = useState(1)
  const [callSize, setCallSize] = useState(20)
  const overview = useQuery({ queryKey: ['ai-hub-overview'], queryFn: getAiHubOverview })
  const scenes = useQuery({ queryKey: ['ai-hub-scenes'], queryFn: listAiHubScenes })
  const providers = useQuery({ queryKey: ['ai-hub-providers'], queryFn: listAiHubProviders })
  const calls = useQuery({
    queryKey: ['ai-hub-calls', callPage, callSize],
    queryFn: () => listAiHubCalls({ page: callPage, pageSize: callSize }),
  })

  const sceneColumns = useMemo(() => [
    { title: '场景编码', dataIndex: 'sceneCode', width: 240 },
    { title: '场景名称', dataIndex: 'sceneName', render: (v: string) => dash(v) },
    { title: '业务系统', dataIndex: 'bizSystem', render: (v: string) => dash(v) },
    { title: '业务领域', dataIndex: 'domain', render: (v: string) => dash(v) },
    { title: '状态', dataIndex: 'enabled', render: (v: boolean) => boolTag(v) },
    { title: '当前模型', dataIndex: 'model', render: (v: string) => dash(v) },
    { title: '提示词版本', dataIndex: 'promptVersion', render: (v: string) => dash(v) },
  ], [])

  const providerColumns = useMemo(() => [
    { title: '渠道标识', dataIndex: 'id', width: 220 },
    { title: '渠道名称', dataIndex: 'name', render: (v: string, row: AiHubProvider) => dash(v ?? row.provider) },
    { title: '状态', dataIndex: 'enabled', render: (v: boolean, row: AiHubProvider) => boolTag(v ?? row.active) },
    { title: '版本', dataIndex: 'revision', render: (v: number) => dash(v) },
    { title: '模型', dataIndex: 'model', render: (v: string) => dash(v) },
  ], [])

  const callColumns = useMemo(() => [
    { title: '任务编号', dataIndex: 'taskId', render: (v: string) => dash(v) },
    { title: '场景', dataIndex: 'sceneCode', render: (v: string) => dash(v) },
    { title: '业务系统', dataIndex: 'bizSystem', render: (v: string) => dash(v) },
    { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'success' : 'error'}>{dash(v)}</Tag> },
    { title: '耗时', dataIndex: 'latencyMs', render: (v: number) => v === undefined ? '—' : `${v} ms` },
    { title: '链路', dataIndex: 'traceId', render: (v: string) => dash(v) },
  ], [])

  if (overview.isError || scenes.isError || providers.isError) {
    return <Alert type="error" showIcon message="AI中台数据加载失败" description="请检查 AI 中台服务和统一登录状态。生产域不再维护本地模型台账。" />
  }

  const data = overview.data
  const callData = calls.data?.records ?? []

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        icon={<RobotOutlined />}
        message="模型、场景、渠道与提示词统一由 AI 中台治理"
        description="生产运营端只展示 AI 中台的真实状态，不再创建或编辑本机模型台账。生产知识文章、SOP 和诊断会话仍由生产域分别负责。需要配置模型或提示词时进入 AI 中台管理端。"
        action={<Typography.Link href="/ai-ops/" target="_blank"><LinkOutlined /> 打开 AI 中台</Typography.Link>}
      />
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title="AI中台状态" value={dash(data?.status)} valueStyle={{ color: data?.status === 'UP' ? '#13a05a' : undefined }} /></Card></Col>
        <Col span={6}><Card><Statistic title="治理场景" value={data?.sceneCount ?? 0} suffix="个" /></Card></Col>
        <Col span={6}><Card><Statistic title="调用次数" value={data?.callCount ?? 0} suffix="次" /></Card></Col>
        <Col span={6}><Card><Statistic title="平均耗时" value={data?.averageLatencyMs ?? 0} suffix="ms" /></Card></Col>
      </Row>
      <Card title={<Space><SafetyCertificateOutlined />领域边界</Space>}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="模型/渠道/场景">AI 中台统一配置、发布、故障切换和审计</Descriptions.Item>
          <Descriptions.Item label="生产知识文章">生产域维护文章、分类、发布状态和来源</Descriptions.Item>
          <Descriptions.Item label="生产 SOP">生产域维护规程、版本、适用阶段和发布状态</Descriptions.Item>
          <Descriptions.Item label="生产 AI 会话">生产域保存会话、消息和业务引用，回答来源明确标记</Descriptions.Item>
          <Descriptions.Item label="当前模型配置">{data?.modelConfigured ? '已配置' : '未配置'}</Descriptions.Item>
          <Descriptions.Item label="调用审计持久化">{data?.auditWritable ? '文件审计已启用' : '文件不可写，当前仅内存审计'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card>
        <Tabs items={[
          { key: 'scenes', label: `场景治理（${scenes.data?.length ?? 0}）`, children: <Table<AiHubScene> rowKey="sceneCode" loading={scenes.isLoading} columns={sceneColumns} dataSource={scenes.data ?? []} pagination={{ defaultPageSize: 20 }} scroll={{ x: 1050 }} /> },
          { key: 'providers', label: `模型渠道（${providers.data?.length ?? 0}）`, children: <Table<AiHubProvider> rowKey="id" loading={providers.isLoading} columns={providerColumns} dataSource={providers.data ?? []} pagination={{ defaultPageSize: 20 }} scroll={{ x: 800 }} /> },
          { key: 'calls', label: '调用审计', children: <Table<AiHubCall> rowKey={(row) => `${row.taskId ?? ''}-${row.traceId ?? ''}`} loading={calls.isLoading} columns={callColumns} dataSource={callData} pagination={{ current: callPage, pageSize: callSize, total: calls.data?.total ?? 0, onChange: (page, size) => { setCallPage(page); setCallSize(size) } }} scroll={{ x: 900 }} /> },
        ]} />
        {!scenes.isLoading && !providers.isLoading && (scenes.data?.length ?? 0) === 0 && (providers.data?.length ?? 0) === 0 ? <Empty description="AI中台暂无治理数据" /> : null}
      </Card>
    </Space>
  )
}
