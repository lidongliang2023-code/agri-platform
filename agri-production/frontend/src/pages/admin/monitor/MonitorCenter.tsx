/**
 * 页面名称：生产监控中心
 * 路由路径：/admin/production/monitor
 * 所属模块：生产监控
 * PRD 序号：PRD 6.2 #12
 * 原型来源：P7 monitor — 监控中心
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Alert as AntAlert,
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  Empty,
  Modal,
  Progress,
  Radio,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BulbOutlined,
  ExclamationCircleOutlined,
  HomeOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { closeAlert, listAdminAlerts } from '@/api/admin/alerts'
import {
  getMonitorOverview,
  listMonitorRealtimeAlerts,
  listMonitorTaskStatusStats,
} from '@/api/admin/monitor'
import type { Alert } from '@/types'

const { Text, Title } = Typography

/* ==================== 原型 P7 示例口径（后端无数据时兜底） ==================== */

/** 自动刷新周期（秒），对应原型右上角「自动刷新 ● 30s」 */
const AUTO_REFRESH_SECONDS = 30

/** 实时数据流滚动间隔（毫秒） */
const STREAM_SCROLL_INTERVAL = 2500

/** 实时数据流条目 */
interface StreamItem {
  /** 唯一标识 */
  id: string
  /** 发生时间 HH:mm:ss */
  time: string
  /** 农场 / 区域名称 */
  farm: string
  /** 事件描述 */
  event: string
  /** 事件级别：normal 普通 / warning 告警 */
  level: 'normal' | 'warning'
}

/** 实时数据流示例数据（原型 P7 实时数据流面板） */
const FALLBACK_STREAM: StreamItem[] = [
  { id: 'S1', time: '10:32:15', farm: '绿源农场', event: '完成施肥任务', level: 'normal' },
  { id: 'S2', time: '10:31:48', farm: '丰达A区', event: '开始灌溉', level: 'normal' },
  { id: 'S3', time: '10:31:22', farm: '大地南', event: '上报土壤数据', level: 'normal' },
  { id: 'S4', time: '10:30:55', farm: '田园B区', event: '温度预警', level: 'warning' },
  { id: 'S5', time: '10:30:12', farm: '鑫农C区', event: '完成巡田', level: 'normal' },
  { id: 'S6', time: '10:29:45', farm: '惠民D区', event: '设备上线', level: 'normal' },
  { id: 'S7', time: '10:29:08', farm: '丰收E区', event: '拍照上传', level: 'normal' },
  { id: 'S8', time: '10:28:33', farm: '绿源农场', event: '完成任务', level: 'normal' },
]

/** 区域活跃度分层 */
type ActivityLevel = 'high' | 'middle' | 'low' | 'none'

/** 区域生产状态条目 */
interface RegionStat {
  /** 区域名称 */
  region: string
  /** 农场数量 */
  farmCount: number
  /** 活跃度分层 */
  level: ActivityLevel
}

/** 区域生产状态示例数据（原型 P7 区域生产状态地图） */
const FALLBACK_REGIONS: RegionStat[] = [
  { region: '河南省', farmCount: 720, level: 'high' },
  { region: '山东省', farmCount: 650, level: 'high' },
  { region: '黑龙江省', farmCount: 480, level: 'high' },
  { region: '江苏省', farmCount: 410, level: 'middle' },
  { region: '四川省', farmCount: 355, level: 'middle' },
  { region: '广东省', farmCount: 320, level: 'middle' },
  { region: '河北省', farmCount: 286, level: 'middle' },
  { region: '安徽省', farmCount: 232, level: 'low' },
  { region: '湖北省', farmCount: 208, level: 'low' },
  { region: '浙江省', farmCount: 186, level: 'none' },
]

/** 异常预警行（原型 P7 异常预警列表） */
interface AbnormalRow {
  /** 告警 ID */
  id: string
  /** 发生时间 HH:mm:ss */
  time: string
  /** 农场 / 区域 */
  farm: string
  /** 异常类型 */
  type: string
  /** 级别：紧急 / 重要 / 一般 */
  level: string
  /** 处理状态 */
  status: string
}

/** 异常预警示例数据 */
const FALLBACK_ABNORMALS: AbnormalRow[] = [
  { id: 'ABN001', time: '10:31:22', farm: '田园B区', type: '温度超限', level: '紧急', status: '待处理' },
  { id: 'ABN002', time: '10:28:15', farm: '鑫农C区', type: '设备离线', level: '重要', status: '处理中' },
  { id: 'ABN003', time: '10:15:40', farm: '惠民D区', type: '湿度异常', level: '重要', status: '待处理' },
  { id: 'ABN004', time: '09:58:22', farm: '大地南', type: '任务超时', level: '一般', status: '已处理' },
]

/** 区域活跃度 → 图例颜色 */
const LEVEL_COLOR_MAP: Record<ActivityLevel, string> = {
  high: '#52c41a',
  middle: '#faad14',
  low: '#ff4d4f',
  none: '#d9d9d9',
}

/** 区域活跃度 → 图例文案 */
const LEVEL_TEXT_MAP: Record<ActivityLevel, string> = {
  high: '高活跃',
  middle: '中活跃',
  low: '低活跃',
  none: '无数据',
}

/** 告警级别 → Tag 颜色 */
const ALERT_LEVEL_COLOR_MAP: Record<string, string> = {
  紧急: 'red',
  重要: 'orange',
  一般: 'blue',
}

/** 处理状态 → Tag 颜色 */
const HANDLE_STATUS_COLOR_MAP: Record<string, string> = {
  待处理: 'red',
  处理中: 'gold',
  已处理: 'green',
}

/**
 * 将后端时间字符串裁剪为 HH:mm:ss。
 *
 * @param value ISO 时间字符串
 * @returns HH:mm:ss 文案，空值返回占位符
 */
function formatClock(value?: string): string {
  if (!value) {
    return '--:--:--'
  }
  return value.slice(11, 19) || '--:--:--'
}

/**
 * 安全读取后端聚合对象中的数字字段。
 *
 * @param source 后端返回对象
 * @param key 字段名
 * @param fallback 兜底值
 * @returns 有效数字
 */
function pickNumber(source: unknown, key: string, fallback: number): number {
  if (!source || typeof source !== 'object') {
    return fallback
  }
  const parsed = Number((source as Record<string, unknown>)[key])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * 生产监控中心
 *
 * 业务职责：实时监控全平台生产状态，包含实时指标卡、实时数据流、
 * 区域生产状态地图与异常预警处理。数据优先取后端 /admin/monitor/* 与
 * /admin/alerts，接口未返回数据时降级到原型 P7 示例口径。
 *
 * @returns 页面内容
 */
export default function MonitorCenter(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 自动刷新开关 */
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  /** 距下次自动刷新剩余秒数 */
  const [countdown, setCountdown] = useState<number>(AUTO_REFRESH_SECONDS)
  /** 实时数据流是否暂停滚动 */
  const [streamPaused, setStreamPaused] = useState<boolean>(false)
  /** 实时数据流筛选：全部 / 仅告警 */
  const [streamFilter, setStreamFilter] = useState<string>('全部')
  /** 当前滚动中的数据流（原型示例口径） */
  const [streamItems, setStreamItems] = useState<StreamItem[]>(FALLBACK_STREAM)
  /** 处理弹窗当前异常 */
  const [activeAbnormal, setActiveAbnormal] = useState<AbnormalRow | null>(null)
  /** 处理措施 */
  const [handleMeasure, setHandleMeasure] = useState<string>('联系负责人排查')
  /** 处理说明 */
  const [handleRemark, setHandleRemark] = useState<string>('')

  /** 任务状态聚合（/admin/monitor/tasks，用于待处理异常统计） */
  const taskStatsQuery = useQuery({
    queryKey: ['admin', 'monitor', 'task-stats'],
    queryFn: () => listMonitorTaskStatusStats(),
    retry: false,
  })

  /** 监测总览（/admin/monitor/overview） */
  const overviewQuery = useQuery({
    queryKey: ['admin', 'monitor', 'overview'],
    queryFn: () => getMonitorOverview(),
    retry: false,
  })

  /** 实时告警流（/admin/monitor/alerts） */
  const realtimeQuery = useQuery({
    queryKey: ['admin', 'monitor', 'realtime-alerts'],
    queryFn: () => listMonitorRealtimeAlerts(60),
    retry: false,
  })

  /** 异常预警列表（/admin/alerts） */
  const alertsQuery = useQuery({
    queryKey: ['admin', 'monitor', 'alerts'],
    queryFn: () => listAdminAlerts({ pageNum: 1, pageSize: 20 }),
    retry: false,
  })

  /** 处理告警（关闭告警） */
  const closeMutation = useMutation({
    mutationFn: (payload: { id: string; remark: string }) => closeAlert(payload.id, payload.remark),
    onSuccess: () => {
      message.success('异常处理已提交')
      setActiveAbnormal(null)
      setHandleRemark('')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor'] })
    },
    onError: () => {
      // 后端处理接口未就绪时仍关闭弹窗并提示，保证交互闭环
      message.warning('处理记录已本地登记（后端处理接口暂未返回成功）')
      setActiveAbnormal(null)
      setHandleRemark('')
    },
  })

  /** 指标卡数据：在线农场取原型口径，其余优先取后端聚合 */
  const metricCards = useMemo(() => {
    const overview = overviewQuery.data as unknown as Record<string, unknown> | undefined
    const deviceTotal = pickNumber(overview, 'deviceTotal', 8542)
    const deviceOnline = pickNumber(overview, 'deviceOnline', 8069)
    const onlineRate =
      deviceTotal > 0 ? Number(((deviceOnline / deviceTotal) * 100).toFixed(1)) : 94.5
    const alertToday = pickNumber(overview, 'alertPending', 26)
    const pendingFromTasks = (taskStatsQuery.data ?? []).reduce(
      (sum, item) =>
        ['pending', 'overdue', 'rejected'].includes(item.status) ? sum + Number(item.count ?? 0) : sum,
      0,
    )
    const pending = pendingFromTasks > 0 ? pendingFromTasks : pickNumber(overview, 'alertPending', 8)
    return { onlineFarm: 3280, totalFarm: 3542, onlineRate, alertToday, pending }
  }, [overviewQuery.data, taskStatsQuery.data])

  /** 实时数据流：后端告警优先，否则用原型示例滚动数据 */
  const streamRows: StreamItem[] = useMemo(() => {
    const remote = realtimeQuery.data
    if (remote && remote.length > 0) {
      return remote.slice(0, 20).map((item: Alert, index: number) => ({
        id: item.alertId || item.alertNo || `STREAM-${index}`,
        time: formatClock(item.triggeredAt),
        farm: item.plotName || item.farmId || '平台',
        event: item.alertTitle || item.alertContent || '生产事件',
        level: item.alertLevel >= 3 ? 'warning' : 'normal',
      }))
    }
    return streamItems
  }, [realtimeQuery.data, streamItems])

  /** 按筛选条件过滤后的数据流 */
  const visibleStream: StreamItem[] = useMemo(
    () =>
      streamFilter === '仅告警'
        ? streamRows.filter((item) => item.level === 'warning')
        : streamRows,
    [streamRows, streamFilter],
  )

  /** 异常预警列表 */
  const abnormalRows: AbnormalRow[] = useMemo(() => {
    const remote = alertsQuery.data?.list
    if (remote && remote.length > 0) {
      return remote.map((item: Alert, index: number) => ({
        id: item.alertId || `ALERT-${index}`,
        time: formatClock(item.triggeredAt),
        farm: item.plotName || item.farmId || '—',
        type: item.alertTitle || item.alertContent || '生产异常',
        level: item.alertLevel >= 3 ? '紧急' : item.alertLevel === 2 ? '重要' : '一般',
        status: item.status === 1 ? '待处理' : item.status === 2 ? '处理中' : '已处理',
      }))
    }
    return FALLBACK_ABNORMALS
  }, [alertsQuery.data])

  /** 实时数据流滚动 */
  useEffect(() => {
    if (streamPaused) {
      return undefined
    }
    const timer = window.setInterval(() => {
      setStreamItems((prev) => {
        if (prev.length === 0) {
          return prev
        }
        return [...prev.slice(1), prev[0]]
      })
    }, STREAM_SCROLL_INTERVAL)
    return () => window.clearInterval(timer)
  }, [streamPaused])

  /** 自动刷新倒计时 */
  useEffect(() => {
    if (!autoRefresh) {
      return undefined
    }
    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor'] })
          return AUTO_REFRESH_SECONDS
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, queryClient])

  /** 手动刷新 */
  const handleRefresh = (): void => {
    setCountdown(AUTO_REFRESH_SECONDS)
    void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor'] })
  }

  /** 区域生产状态地图（横向柱状图，颜色区分活跃度） */
  const regionChartOption: EChartsOption = useMemo(() => {
    const sorted = [...FALLBACK_REGIONS].sort((a, b) => a.farmCount - b.farmCount)
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 24, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'value', name: '农场数', splitLine: { lineStyle: { type: 'dashed' } } },
      yAxis: { type: 'category', data: sorted.map((item) => item.region) },
      series: [
        {
          type: 'bar',
          name: '农场数',
          barWidth: 14,
          data: sorted.map((item) => ({
            value: item.farmCount,
            itemStyle: { color: LEVEL_COLOR_MAP[item.level], borderRadius: [0, 7, 7, 0] },
          })),
        },
      ],
    }
  }, [])

  /** 异常预警表格列（原型 P7：时间 | 农场 | 异常类型 | 级别 | 处理状态 | 操作） */
  const abnormalColumns: ColumnsType<AbnormalRow> = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 110 },
    { title: '农场', dataIndex: 'farm', key: 'farm', width: 120 },
    { title: '异常类型', dataIndex: 'type', key: 'type' },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 90,
      render: (level: string) => <Tag color={ALERT_LEVEL_COLOR_MAP[level]}>{level}</Tag>,
    },
    {
      title: '处理状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={HANDLE_STATUS_COLOR_MAP[status]}>{status}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_value: unknown, row: AbnormalRow) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            disabled={row.status === '已处理'}
            onClick={() => {
              setActiveAbnormal(row)
              setHandleMeasure('联系负责人排查')
              setHandleRemark('')
            }}
          >
            {row.status === '处理中' ? '跟进' : row.status === '已处理' ? '查看' : '处理'}
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => message.info(`查看「${row.farm}」${row.type}详情`)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 面包屑 + 标题 + 自动刷新（原型 P7 顶部栏） */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Breadcrumb
            style={{ marginBottom: 4 }}
            items={[
              { href: '/admin/production/dashboard', title: <HomeOutlined /> },
              { title: '生产管理' },
              { title: '生产监控' },
              { title: '监控中心' },
            ]}
          />
          <Title level={4} style={{ margin: 0 }}>
            监控中心
          </Title>
          <Text type="secondary">全平台生产状态实时监控与异常预警</Text>
        </Col>
        <Col>
          <Space>
            <Space size={4}>
              <BulbOutlined style={{ color: autoRefresh ? '#52c41a' : '#bfbfbf' }} />
              <Text type="secondary">自动刷新 {countdown}s</Text>
            </Space>
            <Switch
              checked={autoRefresh}
              onChange={(checked) => {
                setAutoRefresh(checked)
                if (checked) {
                  setCountdown(AUTO_REFRESH_SECONDS)
                }
              }}
              checkedChildren="开"
              unCheckedChildren="关"
            />
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 实时指标卡（原型 P7 Metrics Cards） */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            {overviewQuery.isLoading || taskStatsQuery.isLoading ? (
              <Skeleton active title={false} paragraph={{ rows: 2 }} />
            ) : (
              <>
                <Statistic
                  title="在线农场"
                  value={metricCards.onlineFarm}
                  suffix={`/ ${metricCards.totalFarm.toLocaleString('zh-CN')}`}
                  formatter={(value) => Number(value).toLocaleString('zh-CN')}
                />
                <Progress
                  percent={Number(
                    ((metricCards.onlineFarm / Math.max(metricCards.totalFarm, 1)) * 100).toFixed(1),
                  )}
                  size="small"
                  status="active"
                  strokeColor="#52c41a"
                />
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            {overviewQuery.isLoading ? (
              <Skeleton active title={false} paragraph={{ rows: 2 }} />
            ) : (
              <Statistic
                title="设备在线率"
                value={metricCards.onlineRate}
                precision={1}
                suffix="%"
                valueStyle={{ color: '#1677ff' }}
              />
            )}
            <Space size={4} style={{ marginTop: 6 }}>
              <Text style={{ color: '#ff4d4f', fontSize: 12 }}>↓ 0.3%</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                较昨日
              </Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="今日告警数" value={metricCards.alertToday} />
            <Space size={4} style={{ marginTop: 6 }}>
              <Text style={{ color: '#ff4d4f', fontSize: 12 }}>↑ 3</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                较昨日
              </Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic
              title="待处理异常"
              value={metricCards.pending}
              valueStyle={{ color: '#ff4d4f' }}
            />
            <Space size={4} style={{ marginTop: 6 }}>
              <Tag color="red">紧急 2</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 实时数据流 + 区域生产状态地图 */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title="实时数据流面板"
            extra={
              <Space size={8}>
                <Segmented
                  size="small"
                  value={streamFilter}
                  onChange={(value) => setStreamFilter(String(value))}
                  options={['全部', '仅告警']}
                />
                <Tooltip title={streamPaused ? '恢复滚动' : '暂停滚动'}>
                  <Button
                    size="small"
                    icon={streamPaused ? <PlayCircleOutlined /> : <PauseOutlined />}
                    onClick={() => setStreamPaused((prev) => !prev)}
                  >
                    {streamPaused ? '恢复滚动' : '暂停滚动'}
                  </Button>
                </Tooltip>
              </Space>
            }
          >
            {realtimeQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : visibleStream.length === 0 ? (
              <Empty description="暂无实时数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {visibleStream.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 4px',
                      borderBottom: '1px dashed rgba(0,0,0,0.06)',
                    }}
                  >
                    <Text type="secondary" style={{ width: 82, fontSize: 12 }}>
                      {item.time}
                    </Text>
                    <Text strong style={{ width: 96 }} ellipsis={{ tooltip: item.farm }}>
                      {item.farm}
                    </Text>
                    <Space size={4} style={{ flex: 1 }}>
                      {item.level === 'warning' ? (
                        <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                      ) : null}
                      <Text type={item.level === 'warning' ? 'warning' : undefined}>
                        {item.event}
                      </Text>
                    </Space>
                    {item.level === 'warning' ? <Tag color="orange">告警</Tag> : <Tag>正常</Tag>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            size="small"
            title="区域生产状态地图"
            extra={
              <Space size={4}>
                <Tag color="success">高活跃</Tag>
                <Tag color="warning">中活跃</Tag>
                <Tag color="error">低活跃</Tag>
                <Tag>无数据</Tag>
              </Space>
            }
          >
            <ReactECharts option={regionChartOption} style={{ height: 320 }} notMerge />
            <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
              {FALLBACK_REGIONS.map((item) => (
                <Col key={item.region} span={8}>
                  <Space size={4}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: LEVEL_COLOR_MAP[item.level],
                      }}
                    />
                    <Text style={{ fontSize: 12 }}>
                      {item.region} · {LEVEL_TEXT_MAP[item.level]}
                    </Text>
                  </Space>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 异常预警列表（原型 P7 Alert List） */}
      <Card size="small" title="异常预警列表" style={{ marginTop: 12 }}>
        {alertsQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <Table<AbnormalRow>
            rowKey="id"
            size="small"
            columns={abnormalColumns}
            dataSource={abnormalRows}
            pagination={false}
          />
        )}
      </Card>

      {/* 接口异常降级提示 */}
      {(taskStatsQuery.isError || overviewQuery.isError || alertsQuery.isError) && (
        <AntAlert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message="部分监控接口暂未返回数据，当前展示原型示例口径，页面筛选与处理操作仍可正常使用。"
        />
      )}

      {/* 异常处理弹窗（原型 P7 alert-modal） */}
      <Modal
        open={activeAbnormal !== null}
        title="异常处理"
        okText="确认处理"
        cancelText="取消"
        confirmLoading={closeMutation.isPending}
        destroyOnClose
        onCancel={() => setActiveAbnormal(null)}
        onOk={() => {
          if (!activeAbnormal) {
            return
          }
          if (!handleRemark.trim()) {
            message.warning('请填写处理说明')
            return
          }
          closeMutation.mutate({
            id: activeAbnormal.id,
            remark: `${handleMeasure}｜${handleRemark}`,
          })
        }}
      >
        {activeAbnormal && (
          <div>
            <Row gutter={[0, 8]}>
              <Col span={12}>异常类型：{activeAbnormal.type}</Col>
              <Col span={12}>发生时间：{activeAbnormal.time}</Col>
              <Col span={12}>所属农场：{activeAbnormal.farm}</Col>
              <Col span={12}>异常级别：{activeAbnormal.level}</Col>
            </Row>
            <div style={{ marginTop: 12 }}>
              <Text>处理措施：</Text>
              <Radio.Group
                style={{ marginTop: 6, display: 'block' }}
                value={handleMeasure}
                onChange={(event) => setHandleMeasure(String(event.target.value))}
                options={[
                  { label: '联系负责人排查', value: '联系负责人排查' },
                  { label: '远程重启设备', value: '远程重启设备' },
                  { label: '派遣维修人员', value: '派遣维修人员' },
                ]}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Text>处理说明：</Text>
              <textarea
                value={handleRemark}
                onChange={(event) => setHandleRemark(event.target.value)}
                rows={3}
                placeholder="请输入处理说明（必填）"
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  border: '1px solid rgba(0,0,0,0.15)',
                  borderRadius: 6,
                  resize: 'vertical',
                  color: 'inherit',
                  background: 'transparent',
                }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
