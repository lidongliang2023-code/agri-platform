/**
 * 页面名称：区块链存证总览
 * 路由路径：/production/blockchain
 * 所属模块：区块链增强
 * 原型 pageId：blockchain（P27）
 *
 * ⚠️ 真数据约束（本页此前必现造假，已修复，请勿回退）
 *
 * 后端 `GET /blockchain/overview` 只返回 `{total, success, failed}`（且三个值是**字符串**），
 * 不返回 monthRecords / monthGrowth / pendingRecords / verifyPassRate / typeStats / health /
 * recentRecords / pendingQueue。旧版用 `MOCK_OVERVIEW` 兜底，且 `isValidOverview()` 只认
 * `totalRecords` —— 后端根本没有这个字段，导致**接口完全正常时也 100% 展示示例数据**。
 *
 * 现在：
 * 1. 指标卡只消费后端真实返回的 total / success / failed（先 toNumber 再渲染与运算）；
 * 2. 「存证类型分布」「最近存证记录」改用**真实的** GET /blockchain/records 数据本地统计，
 *    并明示统计口径；
 * 3. 后端完全没有提供的指标（链上健康度、待上链队列）改为明示「后端暂未提供」，不填任何值；
 * 4. 接口失败只渲染错误态，不渲染任何示例数据。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloudUploadOutlined,
  LinkOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ColumnsType } from 'antd/es/table'
import {
  anchorRecord,
  getChainOverview,
  listCertRecords,
} from '@/api/blockchain'
import type { BlockchainBizRecord } from '@/types'
import { asApiRequestError, httpStatusOf, toNumber } from '@/utils/request'
import useFarmStore from '@/store/farm'

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

/** 业务类型编码 → 名称（后端 bizType 实测取值：TRACE / INSPECTION / HARVEST） */
const BIZ_TYPE_NAME: Record<string, string> = {
  FARMING: '生产记录',
  INSPECTION: '检测报告',
  INPUT: '投入品使用',
  HARVEST: '采收入库',
  CIRCULATION: '流通记录',
  IOT: 'IoT数据',
  TRACE: '溯源记录',
}

/** 业务类型选项（手动上链表单） */
const BIZ_TYPE_OPTIONS = [
  { value: 'FARMING', label: '生产记录' },
  { value: 'INSPECTION', label: '检测报告' },
  { value: 'INPUT', label: '投入品使用' },
  { value: 'HARVEST', label: '采收入库' },
  { value: 'CIRCULATION', label: '流通记录' },
  { value: 'IOT', label: 'IoT数据' },
]

/** 类型分布取数上限：后端 records 是分页接口，这里一次性取一批做本地分组统计 */
const STAT_SCAN_SIZE = 500

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
 * 把查询失败原因转成明示文案：区分「后端业务拒绝」「HTTP 非 200」「后端不可达」，
 * 避免把所有故障笼统说成「接口暂不可用」。
 *
 * @param error catch 到的未知错误
 * @returns 失败文案
 */
function describeError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const apiError = asApiRequestError(error)
  if (apiError && typeof apiError.bizCode === 'number') {
    return `后端业务码 ${apiError.bizCode}（HTTP ${apiError.httpStatus ?? 200}）：${rawMessage}`
  }
  const status = httpStatusOf(error)
  if (status > 0) {
    return `HTTP ${status}：${rawMessage}`
  }
  return `网络异常或超时：${rawMessage}`
}

/** 最近存证记录行（由真实存证记录映射而来） */
interface RecentRow {
  /** 上链时间；未上链时展示创建时间占位 */
  time: string
  /** 业务类型名称 */
  type: string
  /** 业务单号 */
  summary: string
  /** 存证状态 */
  status: string
}

/**
 * 区块链存证总览（原型 P27）
 *
 * 业务职责：展示后端真实提供的存证总量 / 上链成功 / 上链失败三项指标，
 * 用真实存证记录统计类型分布与最近存证，并对后端未提供的能力做明示说明。
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

  /** 总览统计：后端真实形状 {total, success, failed}（值可能是字符串） */
  const overviewQuery = useQuery({
    queryKey: ['blockchain-overview', farmId],
    queryFn: () => getChainOverview(),
  })

  /** 真实存证记录：用于类型分布与最近存证（后端 overview 不提供这两项） */
  const recordsQuery = useQuery({
    queryKey: ['blockchain-overview-records', farmId],
    queryFn: () => listCertRecords({ pageNum: 1, pageSize: STAT_SCAN_SIZE }),
  })

  const rawStat = overviewQuery.data
  const total = toNumber(rawStat?.total, 0)
  const success = toNumber(rawStat?.success, 0)
  const failed = toNumber(rawStat?.failed, 0)
  /** 未成功条数：由三个真实计数推导（total − success − failed），不是估算 */
  const notSuccess = total - success - failed

  const allRecords: BlockchainBizRecord[] = recordsQuery.data?.list ?? []
  /** 本次实际参与统计的样本条数（后端分页上限内取到的真实记录数） */
  const scannedCount: number = allRecords.length
  /** 后端存证总条数（用于判断样本是否为全量） */
  const backendTotal: number = toNumber(recordsQuery.data?.total, scannedCount)

  /** 类型分布：按 bizType 对真实记录分组计数 */
  const typeStats = useMemo<{ name: string; value: number }[]>(() => {
    const counter = new Map<string, number>()
    allRecords.forEach((item) => {
      const key = item.bizType ?? 'UNKNOWN'
      counter.set(key, (counter.get(key) ?? 0) + 1)
    })
    return Array.from(counter.entries())
      .map(([code, value]) => ({ name: BIZ_TYPE_NAME[code] ?? code, value }))
      .sort((a, b) => b.value - a.value)
  }, [allRecords])

  /** 最近存证记录：按上链时间倒序取前 5 条真实记录 */
  const recentRows = useMemo<RecentRow[]>(
    () =>
      allRecords
        .slice()
        .sort((a, b) => String(b.anchorAt ?? b.createdAt ?? '').localeCompare(String(a.anchorAt ?? a.createdAt ?? '')))
        .slice(0, 5)
        .map((item) => ({
          time: String(item.anchorAt ?? item.createdAt ?? '-').slice(5, 16),
          type: BIZ_TYPE_NAME[item.bizType ?? ''] ?? item.bizType ?? '-',
          summary: item.bizNo ?? '-',
          status: item.status ?? '-',
        })),
    [allRecords],
  )

  /** 手动上链 */
  const anchorMutation = useMutation({
    mutationFn: (payload: { bizType: string; bizNo: string; bizSummary?: string }) =>
      anchorRecord(payload),
    onSuccess: () => {
      message.success('已提交上链，链上确认后将更新存证状态')
      setAnchorOpen(false)
      anchorForm.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['blockchain-overview'] })
      void queryClient.invalidateQueries({ queryKey: ['blockchain-overview-records'] })
      void queryClient.invalidateQueries({ queryKey: ['blockchain-records'] })
    },
    onError: (err: Error) => {
      // 写操作失败就是失败，不允许「已按本地模式记录」这类假成功话术
      message.error(`提交上链失败，未写入任何存证：${err.message}`)
    },
  })

  /** 存证类型分布饼图配置 */
  const pieOption = useMemo<EChartsOption>(
    () => ({
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
          data: typeStats.map((item) => ({ name: item.name, value: item.value })),
        },
      ],
    }),
    [typeStats],
  )

  /** 最近存证记录列定义 */
  const recentColumns: ColumnsType<RecentRow> = [
    { title: '时间', dataIndex: 'time', width: 110 },
    { title: '类型', dataIndex: 'type', width: 110 },
    { title: '业务单号', dataIndex: 'summary' },
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

  const overviewError = overviewQuery.isError
  const recordsError = recordsQuery.isError

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {overviewError && (
        <Alert
          type="error"
          showIcon
          message="存证总览接口调用失败，未取得任何统计数据"
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text>
                {overviewQuery.error
                  ? describeError(overviewQuery.error)
                  : '请检查后端服务 /api/v1/production/blockchain/overview'}
              </Typography.Text>
              <Typography.Text type="secondary">
                此处不会用占位数据顶替 —— 统计数字显示为「—」即代表未取得，不代表 0。
              </Typography.Text>
            </Space>
          }
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => void overviewQuery.refetch()}
            >
              重试
            </Button>
          }
        />
      )}

      {recordsError && (
        <Alert
          type="error"
          showIcon
          message="存证记录接口调用失败，类型分布与最近存证无法统计"
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text>
                {recordsQuery.error
                  ? describeError(recordsQuery.error)
                  : '请检查后端服务 /api/v1/production/blockchain/records'}
              </Typography.Text>
            </Space>
          }
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => void recordsQuery.refetch()}
            >
              重试
            </Button>
          }
        />
      )}

      <Card
        title={
          <Space>
            <LinkOutlined />
            <span>区块链存证总览</span>
          </Space>
        }
        loading={overviewQuery.isLoading && !overviewQuery.data}
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
                value={overviewError ? '—' : total}
                suffix="条"
                valueStyle={{ color: '#13a05a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="上链成功"
                value={overviewError ? '—' : success}
                suffix="条"
                valueStyle={{ color: '#13a05a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="上链失败"
                value={overviewError ? '—' : failed}
                suffix="条"
                valueStyle={{ color: failed > 0 ? '#ff4d4f' : undefined }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="未成功（含上链中）"
                value={overviewError ? '—' : notSuccess}
                suffix="条"
                valueStyle={{ color: '#2f7ed8' }}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                按 total − success − failed 推导
              </Typography.Text>
            </Card>
          </Col>
        </Row>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          数据来源：GET /api/v1/production/blockchain/overview。「存证总数 / 上链成功 /
          上链失败」是后端直接返回的字段（后端返回的是字符串，展示前已转数字）；
          「未成功（含上链中）」是<strong>推导值</strong> = total − success − failed，
          <strong>不是后端字段</strong>。环比增幅、验证通过率等指标后端未提供，故不展示。
        </Typography.Text>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title="存证类型分布"
            loading={recordsQuery.isLoading && !recordsQuery.data}
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                样本 N={scannedCount}
              </Typography.Text>
            }
          >
            {/* 图上方就把样本量摆出来：N 很小时百分比没有统计意义，藏掉 N 等于误导 */}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              按 biz_type 分组统计 · 样本 {scannedCount} 条
              {backendTotal > scannedCount
                ? `（后端共 ${backendTotal} 条，本次仅统计前 ${scannedCount} 条，占比不代表全量）`
                : '（即后端全部存证，占比即全量占比）'}
            </Typography.Text>
            {typeStats.length > 0 ? (
              <ReactECharts option={pieOption} style={{ height: 320 }} notMerge />
            ) : (
              <Empty
                description={
                  recordsError
                    ? '接口调用失败，无法统计类型分布'
                    : '后端暂无存证记录，无法统计类型分布'
                }
              />
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              统计口径：后端 overview 不返回类型分布，此处对 GET /blockchain/records 返回的
              <strong>真实记录</strong>按 biz_type 分组计数（单次最多取 {STAT_SCAN_SIZE} 条），
              不是后端直接下发的统计值。
            </Typography.Text>
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
          >
            <Alert
              type="info"
              showIcon
              message="后端暂未提供链上健康度指标"
              description="联盟链运行状态、当前区块高度、最近出块时间、共识节点数、链上确认率、链ID、数据完整性校验 —— 后端 GET /blockchain/overview 均不返回这些字段，本页不填充任何占位数值。"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title="最近存证记录"
            loading={recordsQuery.isLoading && !recordsQuery.data}
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
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              按 anchor_at 倒序取前 5 条 · 样本 {scannedCount} 条（后端共 {backendTotal} 条）
            </Typography.Text>
            <Table<RecentRow>
              rowKey={(row) => `${row.time}-${row.summary}`}
              size="small"
              pagination={false}
              columns={recentColumns}
              dataSource={recentRows}
              locale={{ emptyText: '后端暂无存证记录' }}
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
            extra={
              <Button
                size="small"
                onClick={() => navigate('/production/blockchain/records?status=PENDING')}
              >
                查看上链中的记录
              </Button>
            }
          >
            <Alert
              type="info"
              showIcon
              message="后端暂未提供待上链队列与批量上链能力"
              description="后端没有「待上链队列」查询端点，也没有批量上链 / 重试上链端点（POST /blockchain/anchor 只能单条新建存证）。本页不再提供「立即上链」按钮 —— 旧实现点一次只新建一条 BATCH 存证，却提示「N 条待上链数据已上链」，属于写操作假成功。请到存证记录列表按状态筛选后逐条处理。"
            />
          </Card>
        </Col>
      </Row>

      <Card title="存证验证工具">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            当前后端仅支持「按交易哈希」验真（GET /blockchain/verify/{"{txHash}"}
            ，返回布尔值）；按存证编号 / 溯源码验真后端暂未提供。
          </Typography.Text>
          <Space>
            <Button
              type="primary"
              icon={<LinkOutlined />}
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
              安全确认阈值设置：≥ {settings.confirmThreshold} 个区块
              {settings.autoAnchor ? '（自动上链已开启）' : '（自动上链已关闭）'}
              （该阈值为本地设置项，后端验真不使用它）
            </Typography.Text>
          </Space>
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
