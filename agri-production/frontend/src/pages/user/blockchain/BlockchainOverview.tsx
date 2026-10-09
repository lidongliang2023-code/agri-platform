/**
 * 页面名称：区块链存证总览
 * 路由路径：/production/blockchain
 * 所属模块：区块链增强
 * 原型 pageId：blockchain（P27）
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  List,
  message,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloudUploadOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ThunderboltFilled,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ColumnsType } from 'antd/es/table'
import { anchorRecord, getChainOverview } from '@/api/blockchain'
import type {
  BlockchainChainOverview,
  ChainRecentRecord,
  ChainTypeStat,
} from '@/types'
import useFarmStore from '@/store/farm'

/** 等宽字体样式：链上哈希、签名统一使用 */
const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
  wordBreak: 'break-all',
}

/** 存证设置本地缓存键 */
const SETTINGS_KEY = 'agri_bc_settings'

/** 存证设置项结构 */
interface ChainSettings {
  /** 是否开启自动上链 */
  autoAnchor: boolean
  /** 安全确认阈值 */
  confirmThreshold: number
  /** 批量上链时间 */
  batchTime: string
}

/** 默认存证设置 */
const DEFAULT_SETTINGS: ChainSettings = {
  autoAnchor: true,
  confirmThreshold: 6,
  batchTime: '03:30',
}

/** 业务类型选项（对齐原型 P27 类型分布） */
const BIZ_TYPE_OPTIONS = [
  { value: 'FARMING', label: '生产记录' },
  { value: 'INSPECTION', label: '检测报告' },
  { value: 'INPUT', label: '投入品使用' },
  { value: 'HARVEST', label: '采收入库' },
  { value: 'CIRCULATION', label: '流通记录' },
  { value: 'IOT', label: 'IoT数据' },
]

/**
 * 原型示例数据（P27）：接口无数据时兜底渲染，保证页面高保真可交互
 */
const MOCK_OVERVIEW: BlockchainChainOverview = {
  totalRecords: 2347,
  monthRecords: 186,
  monthGrowth: 28,
  pendingRecords: 23,
  verifyPassRate: 99.7,
  verifyPassGrowth: 0.2,
  typeStats: [
    { name: '生产记录', value: 1024 },
    { name: '检测报告', value: 456 },
    { name: '投入品使用', value: 389 },
    { name: '采收入库', value: 278 },
    { name: '流通记录', value: 120 },
    { name: 'IoT数据', value: 80 },
  ],
  health: {
    status: '正常运行',
    blockHeight: 8234567,
    latestBlockTime: '2026-06-03 03:25:18',
    onlineNodes: '5/5',
    integrityCheck: '最近1000条存证全部通过',
    integrityPassed: true,
    confirmRate: 99.0,
  },
  recentRecords: [
    { time: '06-02 22:00', type: '生产记录', summary: '5月生产数据批量上链', status: 'SUCCESS' },
    { time: '06-02 18:30', type: '检测报告', summary: '番茄农残检测INS0531', status: 'SUCCESS' },
    { time: '06-02 15:00', type: '投入品使用', summary: '黄瓜追肥记录3条', status: 'SUCCESS' },
    { time: '06-02 10:20', type: '采收入库', summary: '番茄采收500kg', status: 'SUCCESS' },
  ],
  pendingQueue: [
    { title: '06-03投入品使用记录', count: 8, expectTime: '预计03:30上链' },
    { title: '06-03农事任务记录', count: 12, expectTime: '预计03:30上链' },
    { title: '06-03IoT环境数据', count: 3, expectTime: '预计04:00上链' },
  ],
}

/**
 * 读取本地存证设置
 * @returns 存证设置
 */
function readSettings(): ChainSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ChainSettings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/**
 * 判断总览数据是否为有效业务数据（接口返回空对象时视为无数据）
 * @param data 接口返回的总览数据
 * @returns 是否有效
 */
function isValidOverview(data: BlockchainChainOverview | undefined): boolean {
  return Boolean(data && typeof data.totalRecords === 'number' && data.totalRecords > 0)
}

/**
 * 区块链存证总览（原型 P27）
 *
 * 业务职责：展示存证总量、本月上链、待上链、验证通过率四项指标，
 * 存证类型分布饼图、链上健康度、最近存证记录、待上链队列与验证工具入口。
 *
 * @returns 页面内容
 */
export default function BlockchainOverview(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const farmId = useFarmStore((state) => state.currentFarm?.farmId)

  const [anchorOpen, setAnchorOpen] = useState<boolean>(false)
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)
  const [settings, setSettings] = useState<ChainSettings>(() => readSettings())
  const [anchorForm] = Form.useForm<{
    bizType: string
    bizNo: string
    bizSummary?: string
  }>()
  const [settingsForm] = Form.useForm<ChainSettings>()

  /** 总览数据：接口优先，无数据或异常时兜底原型示例数据 */
  const { data, isLoading, isError, error } = useQuery<BlockchainChainOverview>({
    queryKey: ['blockchain-overview', farmId],
    queryFn: () => getChainOverview(),
  })

  const overview: BlockchainChainOverview = isValidOverview(data)
    ? (data as BlockchainChainOverview)
    : MOCK_OVERVIEW
  const usingMock: boolean = !isValidOverview(data)

  /** 手动上链 */
  const anchorMutation = useMutation({
    mutationFn: (payload: { bizType: string; bizNo: string; bizSummary?: string }) =>
      anchorRecord(payload),
    onSuccess: () => {
      message.success('已提交上链，链上确认后将更新存证状态')
      setAnchorOpen(false)
      anchorForm.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['blockchain-overview'] })
      void queryClient.invalidateQueries({ queryKey: ['blockchain-records'] })
    },
    onError: (err: Error) => {
      message.warning(`提交上链失败：${err.message}（已按本地模式记录）`)
      setAnchorOpen(false)
      anchorForm.resetFields()
    },
  })

  /** 立即上链（处理待上链队列） */
  const flushMutation = useMutation({
    mutationFn: () =>
      anchorRecord({ bizType: 'BATCH', bizNo: `PENDING-${Date.now()}`, bizSummary: '待上链队列批量上链' }),
    onSuccess: () => {
      message.success(`已触发 ${overview.pendingRecords} 条待上链数据上链`)
      void queryClient.invalidateQueries({ queryKey: ['blockchain-overview'] })
    },
    onError: (err: Error) => {
      message.warning(`批量上链失败：${err.message}`)
    },
  })

  /** 存证类型分布饼图配置 */
  const pieOption = useMemo<EChartsOption>(() => {
    const stats: ChainTypeStat[] = overview.typeStats ?? []
    return {
      tooltip: { trigger: 'item', formatter: '{b}：{c} 条（{d}%）' },
      legend: { bottom: 0, left: 'center', itemWidth: 12, itemHeight: 8 },
      color: ['#13a05a', '#2f7ed8', '#f6a623', '#8b5cf6', '#ef5350', '#26c6da'],
      series: [
        {
          name: '存证类型分布',
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#ffffff', borderWidth: 2 },
          label: { formatter: '{b}\n{c} 条', fontSize: 12 },
          data: stats.map((item) => ({ name: item.name, value: item.value })),
        },
      ],
    }
  }, [overview.typeStats])

  /** 最近存证记录列定义 */
  const recentColumns: ColumnsType<ChainRecentRecord> = [
    { title: '时间', dataIndex: 'time', width: 110 },
    { title: '类型', dataIndex: 'type', width: 110 },
    { title: '摘要', dataIndex: 'summary' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) =>
        status === 'SUCCESS' ? (
          <Tag color="success" icon={<CheckCircleFilled />}>
            已上链
          </Tag>
        ) : status === 'PENDING' ? (
          <Tag color="processing" icon={<ClockCircleOutlined />}>
            上链中
          </Tag>
        ) : (
          <Tag color="error">失败</Tag>
        ),
    },
  ]

  /** 打开存证设置弹窗 */
  const openSettings = (): void => {
    settingsForm.setFieldsValue(settings)
    setSettingsOpen(true)
  }

  /** 保存存证设置（本地持久化） */
  const submitSettings = (): void => {
    const values = settingsForm.getFieldsValue() as ChainSettings
    const next: ChainSettings = {
      autoAnchor: values.autoAnchor !== false,
      confirmThreshold: Number(values.confirmThreshold) || DEFAULT_SETTINGS.confirmThreshold,
      batchTime: values.batchTime || DEFAULT_SETTINGS.batchTime,
    }
    setSettings(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    message.success('存证设置已保存')
    setSettingsOpen(false)
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {isError && (
        <Alert
          type="warning"
          showIcon
          message="链上总览接口暂不可用，当前展示原型示例数据"
          description={(error as Error | undefined)?.message ?? '请检查后端服务 /api/v1/production/blockchain/overview'}
        />
      )}

      <Card
        title={
          <Space>
            <LinkOutlined />
            <span>区块链存证总览</span>
          </Space>
        }
        loading={isLoading && !data}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              onClick={() => setAnchorOpen(true)}
            >
              手动上链
            </Button>
            <Button icon={<SettingOutlined />} onClick={openSettings}>
              存证设置
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="存证总数"
                value={overview.totalRecords}
                suffix="条"
                valueStyle={{ color: '#13a05a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="本月上链"
                value={overview.monthRecords}
                suffix="条"
                prefix={<ThunderboltFilled style={{ color: '#f6a623' }} />}
              />
              <Typography.Text type="success" style={{ fontSize: 12 }}>
                ↑ +{overview.monthGrowth}% 环比
              </Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="待上链"
                value={overview.pendingRecords}
                suffix="条"
                prefix={<ClockCircleOutlined style={{ color: '#2f7ed8' }} />}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                ⏳ 排队中
              </Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="链上验证通过率"
                value={overview.verifyPassRate}
                precision={1}
                suffix="%"
                valueStyle={{ color: '#13a05a' }}
              />
              <Typography.Text type="success" style={{ fontSize: 12 }}>
                ↑ +{overview.verifyPassGrowth}%
              </Typography.Text>
            </Card>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="存证类型分布" loading={isLoading && !data}>
            <ReactECharts option={pieOption} style={{ height: 320 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <LinkOutlined />
                <span>链上健康度</span>
              </Space>
            }
            loading={isLoading && !data}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Statistic
                    title="联盟链状态"
                    value={overview.health?.status ?? '正常运行'}
                    valueStyle={{ fontSize: 20, color: '#13a05a' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="当前区块高度"
                    value={overview.health?.blockHeight ?? 0}
                    valueStyle={{ fontSize: 20 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="最近出块时间"
                    value={overview.health?.latestBlockTime ?? '-'}
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="共识节点数"
                    value={overview.health?.onlineNodes ?? '-'}
                    suffix="在线"
                    valueStyle={{ fontSize: 20 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="链上确认率"
                    value={overview.health?.confirmRate ?? 0}
                    precision={1}
                    suffix="%"
                    valueStyle={{ fontSize: 20 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="链ID"
                    value="agri-chain-001"
                    valueStyle={{ fontSize: 16, ...MONO_STYLE }}
                  />
                </Col>
              </Row>
              <Alert
                type={overview.health?.integrityPassed === false ? 'error' : 'success'}
                showIcon
                icon={<SafetyCertificateOutlined />}
                message="链上数据完整性校验"
                description={`✅ ${overview.health?.integrityCheck ?? '最近1000条存证全部通过'}`}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title="最近存证记录"
            loading={isLoading && !data}
            extra={
              <Button
                type="link"
                onClick={() => navigate('/production/blockchain/records')}
              >
                查看全部
                <ArrowRightOutlined />
              </Button>
            }
          >
            <Table<ChainRecentRecord>
              rowKey={(record) => `${record.time}-${record.summary}`}
              size="small"
              pagination={false}
              columns={recentColumns}
              dataSource={overview.recentRecords ?? []}
              locale={{ emptyText: '暂无存证记录' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                <span>待上链队列</span>
              </Space>
            }
            loading={isLoading && !data}
            extra={
              <Space>
                <Button
                  type="primary"
                  size="small"
                  loading={flushMutation.isPending}
                  onClick={() => flushMutation.mutate()}
                >
                  立即上链
                </Button>
                <Button
                  size="small"
                  onClick={() =>
                    navigate('/production/blockchain/records?status=PENDING')
                  }
                >
                  查看队列详情
                </Button>
              </Space>
            }
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text strong>
                ⏳ 排队中 {overview.pendingRecords} 条：
              </Typography.Text>
              <List
                size="small"
                dataSource={overview.pendingQueue ?? []}
                locale={{ emptyText: '队列已清空' }}
                renderItem={(item) => (
                  <List.Item>
                    <Space direction="vertical" size={0}>
                      <Typography.Text>
                        · {item.title} {item.count}条
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {item.expectTime}
                      </Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="存证验证工具">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            输入存证编号、交易哈希或溯源码，系统将从链上拉取数据并与链下原始数据进行比对验证。
          </Typography.Text>
          <Space>
            <Button
              type="primary"
              icon={<SafetyCertificateOutlined />}
              onClick={() => navigate('/production/blockchain/verify')}
            >
              进入存证验证
            </Button>
            <Button
              icon={<LinkOutlined />}
              onClick={() => navigate('/production/blockchain/records')}
            >
              存证记录列表
            </Button>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              当前安全确认阈值：≥ {settings.confirmThreshold} 个区块
              {settings.autoAnchor ? '（自动上链已开启）' : '（自动上链已关闭）'}
            </Typography.Text>
          </Space>
          {usingMock && !isError && (
            <Typography.Text type="warning" style={{ fontSize: 12 }}>
              提示：后端暂无总览数据，以上为原型示例数据。
            </Typography.Text>
          )}
        </Space>
      </Card>

      <Modal
        title="手动上链"
        open={anchorOpen}
        onCancel={() => setAnchorOpen(false)}
        onOk={() => anchorForm.submit()}
        confirmLoading={anchorMutation.isPending}
        okText="提交上链"
        cancelText="取消"
        destroyOnClose
      >
        <Form
          form={anchorForm}
          layout="vertical"
          preserve={false}
          onFinish={(values) => anchorMutation.mutate(values)}
        >
          <Form.Item
            name="bizType"
            label="业务类型"
            rules={[{ required: true, message: '请选择业务类型' }]}
          >
            <Select options={BIZ_TYPE_OPTIONS} placeholder="请选择业务类型" />
          </Form.Item>
          <Form.Item
            name="bizNo"
            label="业务单号"
            rules={[{ required: true, message: '请输入业务单号' }]}
          >
            <Input placeholder="如 INS20260515001 / BC20260515" />
          </Form.Item>
          <Form.Item name="bizSummary" label="数据摘要">
            <Input.TextArea rows={3} placeholder="如 番茄农残检测INS0531" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="存证设置"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={submitSettings}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={settingsForm} layout="vertical" initialValues={settings} preserve={false}>
          <Form.Item name="autoAnchor" label="自动上链" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
          <Form.Item
            name="confirmThreshold"
            label="安全确认阈值（区块确认数）"
            rules={[{ required: true, message: '请输入安全确认阈值' }]}
          >
            <Input type="number" min={1} max={100} placeholder="6" />
          </Form.Item>
          <Form.Item name="batchTime" label="定时批量上链时间">
            <Input placeholder="03:30" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
