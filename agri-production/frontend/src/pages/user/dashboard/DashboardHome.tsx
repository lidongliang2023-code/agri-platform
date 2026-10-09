/**
 * 页面名称：生产数据看板
 * 路由路径：/production/dashboard
 * 所属模块：首页看板
 * PRD 序号：PRD 6.1 #1
 *
 * 页面用途（PRD）：生产概况、待办任务、告警提醒、关键指标。
 * 布局与配色参照原型 P2 农场详情的指标卡 + P19 生产监控看板的分区结构。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Alert as AntAlert,
  App as AntdApp,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  List,
  Progress,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowRightOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  ExperimentOutlined,
  FieldTimeOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import useFarmStore from '@/store/farm'
import { fetchActiveAlerts, fetchDashboardOverview, fetchTodoTasks } from '@/api/production-view'
import { updateTask } from '@/api'
import {
  alertLevelMeta,
  buildMonthTrendFallback,
  formatNumber,
  priorityMeta,
  taskStatusMeta,
  taskTypeLabel,
} from '@/utils/production-adapter'
import type { TrendPointView } from '@/utils/production-adapter'

/** 趋势图时间范围 */
type TrendRange = 'month' | 'week'

/** 指标卡渲染参数 */
interface MetricCard {
  /** 唯一 key */
  key: string
  /** 标题 */
  title: string
  /** 数值 */
  value: number
  /** 小数位 */
  precision: number
  /** 单位后缀 */
  suffix: string
  /** 主色 */
  color: string
  /** 图标 */
  icon: JSX.Element
  /** 副标题 */
  footer: string
}

/**
 * 生产数据看板
 * @returns 页面内容
 */
export default function DashboardHome(): JSX.Element {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId
  const [trendRange, setTrendRange] = useState<TrendRange>('month')

  const overviewQuery = useQuery({
    queryKey: ['dashboard-overview', farmId],
    queryFn: () => fetchDashboardOverview(farmId),
  })

  const todoQuery = useQuery({
    queryKey: ['dashboard-todo', farmId],
    queryFn: () => fetchTodoTasks(farmId, 6),
  })

  const alertQuery = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: () => fetchActiveAlerts(6),
  })

  const overview = overviewQuery.data
  const todoTasks = todoQuery.data ?? []
  const alerts = alertQuery.data ?? []

  /**
   * 刷新全部区块
   * @returns void
   */
  async function refreshAll(): Promise<void> {
    await Promise.all([overviewQuery.refetch(), todoQuery.refetch(), alertQuery.refetch()])
    message.success('看板数据已刷新')
  }

  /** 指标卡数据 */
  const metrics = useMemo<MetricCard[]>(() => {
    if (!overview) return []
    return [
      {
        key: 'plantingArea',
        title: '在田面积',
        value: overview.plantingArea,
        precision: 0,
        suffix: '亩',
        color: '#13a05a',
        icon: <EnvironmentOutlined />,
        footer: `地块 ${overview.plotCount} 个 · 在田作物 ${overview.cropCount} 种`,
      },
      {
        key: 'taskCompletionRate',
        title: '本月任务完成率',
        value: overview.taskCompletionRate,
        precision: 1,
        suffix: '%',
        color: '#1677ff',
        icon: <CheckCircleOutlined />,
        footer: `本月任务 ${overview.monthTaskTotal} 条 · 已完成 ${overview.monthTaskDone} 条`,
      },
      {
        key: 'pendingTaskCount',
        title: '待办任务',
        value: overview.pendingTaskCount,
        precision: 0,
        suffix: '条',
        color: '#fa8c16',
        icon: <FieldTimeOutlined />,
        footer: '含待执行 / 执行中',
      },
      {
        key: 'alertCount',
        title: '活跃告警',
        value: overview.alertCount,
        precision: 0,
        suffix: '条',
        color: '#ff4d4f',
        icon: <WarningOutlined />,
        footer: '未处置告警，进入告警中心处理',
      },
      {
        key: 'monthHarvestQty',
        title: '本月采收量',
        value: overview.monthHarvestQty,
        precision: 0,
        suffix: 'kg',
        color: '#52c41a',
        icon: <ExperimentOutlined />,
        footer: `质量合格率 ${overview.passRate}%`,
      },
      {
        key: 'activeDeviceCount',
        title: '在线设备',
        value: overview.activeDeviceCount,
        precision: 0,
        suffix: '台',
        color: '#722ed1',
        icon: <DashboardOutlined />,
        footer: `溯源码累计 ${formatNumber(overview.traceCodeCount)} 个`,
      },
    ]
  }, [overview])

  /** 本月完整趋势（兜底口径来自原型 4.3） */
  const monthTrend = useMemo<TrendPointView[]>(() => buildMonthTrendFallback(), [])

  /** 当前展示的趋势切片 */
  const trendData = useMemo<TrendPointView[]>(() => {
    if (trendRange === 'week') return monthTrend.slice(0, 7)
    return monthTrend
  }, [monthTrend, trendRange])

  /**
   * 构造趋势图配置
   * @param rows 趋势数据
   * @returns ECharts 配置
   */
  function buildTrendOption(rows: TrendPointView[]): Record<string, unknown> {
    return {
      color: ['#13a05a', '#1677ff'],
      tooltip: { trigger: 'axis' },
      legend: { data: ['计划农事', '已完成'], bottom: 0 },
      grid: { left: 40, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: rows.map((row) => row.date.slice(5)),
        axisLine: { lineStyle: { color: '#d9d9d9' } },
        axisLabel: { color: 'rgba(0,0,0,0.45)' },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: [
        {
          name: '计划农事',
          type: 'bar',
          barWidth: '45%',
          data: rows.map((row) => row.planned),
          itemStyle: { borderRadius: [3, 3, 0, 0] },
        },
        {
          name: '已完成',
          type: 'line',
          smooth: true,
          symbolSize: 5,
          data: rows.map((row) => row.done),
        },
      ],
      graphic: rows.length
        ? []
        : [
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: { text: '本月暂无农事数据', fill: '#999', fontSize: 13 },
            },
          ],
      animationDuration: 400,
    }
  }

  /** 任务状态流转（开始执行） */
  const startMutation = useMutation({
    mutationFn: (taskId: string) => updateTask(taskId, { status: 'executing' }),
    onSuccess: () => {
      message.success('任务已置为执行中')
      void todoQuery.refetch()
    },
    onError: (error: Error) => message.error(error.message || '操作失败'),
  })

  const loading = overviewQuery.isLoading || todoQuery.isLoading || alertQuery.isLoading
  const hasError = overviewQuery.isError && !overview

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <DashboardOutlined style={{ color: '#13a05a' }} />
            <span>生产数据看板</span>
            {currentFarm ? <Tag color="green">{currentFarm.farmName}</Tag> : null}
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              onClick={() => navigate('/production/dashboard/production')}
            >
              进入生产驾驶舱
            </Button>
          </Space>
        }
      >
        {hasError ? (
          <AntAlert
            type="warning"
            showIcon
            message="统计接口暂不可用，当前展示原型示例口径数据"
            description="请确认后端生产分析服务已启动；接口恢复后本页会自动重新拉取。"
            action={
              <Button size="small" onClick={() => void overviewQuery.refetch()}>
                重试
              </Button>
            }
          />
        ) : null}
      </Card>

      <Row gutter={[16, 16]}>
        {loading
          ? Array.from({ length: 6 }, (_unused, index) => (
              <Col key={`metric-skeleton-${index}`} xs={24} sm={12} md={8} xl={4}>
                <Card>
                  <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 1 }} />
                </Card>
              </Col>
            ))
          : metrics.map((metric) => (
              <Col key={metric.key} xs={24} sm={12} md={8} xl={4}>
                <Card
                  hoverable
                  styles={{ body: { padding: 16 } }}
                  style={{ borderLeft: `3px solid ${metric.color}` }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <Statistic
                      title={metric.title}
                      value={metric.value}
                      precision={metric.precision}
                      suffix={metric.suffix}
                      valueStyle={{ color: metric.color, fontSize: 22, fontWeight: 600 }}
                    />
                    <span style={{ fontSize: 18, color: metric.color }}>{metric.icon}</span>
                  </div>
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12, display: 'block', marginTop: 8 }}
                  >
                    {metric.footer}
                  </Typography.Text>
                </Card>
              </Col>
            ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <FieldTimeOutlined style={{ color: '#fa8c16' }} />
                <span>待办任务</span>
                <Badge count={todoTasks.length} color="#fa8c16" />
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/production/tasks')}>
                查看全部任务 →
              </Button>
            }
          >
            {todoQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : todoTasks.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有待办任务" />
            ) : (
              <List
                dataSource={todoTasks}
                rowKey="taskId"
                renderItem={(item) => {
                  const statusMeta = taskStatusMeta(item.status)
                  const priority = priorityMeta(item.priority)
                  return (
                    <List.Item
                      actions={[
                        <Button
                          key="detail"
                          type="link"
                          size="small"
                          onClick={() => navigate(`/production/tasks/${item.taskId}`)}
                        >
                          详情
                        </Button>,
                        item.status === 'pending' ? (
                          <Button
                            key="start"
                            type="link"
                            size="small"
                            loading={startMutation.isPending}
                            onClick={() => startMutation.mutate(item.taskId)}
                          >
                            开始执行
                          </Button>
                        ) : null,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space size={8} wrap>
                            <Typography.Text strong>{item.taskName}</Typography.Text>
                            <Tag color={priority.color}>{priority.label}</Tag>
                            <Tag>{taskTypeLabel(item.taskType)}</Tag>
                            <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                          </Space>
                        }
                        description={
                          <Space size={12} wrap>
                            <Typography.Text type="secondary">
                              地块：{item.plotName || '-'}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              计划：{item.planStartDate || '-'} ~ {item.planEndDate || '-'}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              执行人：{item.assigneeName || '未指派'}
                            </Typography.Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )
                }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <BellOutlined style={{ color: '#ff4d4f' }} />
                <span>告警提醒</span>
                <Badge count={alerts.length} color="#ff4d4f" />
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/production/alerts')}>
                进入告警中心 →
              </Button>
            }
          >
            {alertQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : alerts.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无未处置告警" />
            ) : (
              <List
                dataSource={alerts}
                rowKey="alertId"
                renderItem={(item) => {
                  const level = alertLevelMeta(item.alertLevel)
                  return (
                    <List.Item
                      actions={[
                        <Button
                          key="handle"
                          type="link"
                          size="small"
                          onClick={() => navigate('/production/alerts')}
                        >
                          去处理
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space size={8} wrap>
                            <Tag color={level.color}>{level.label}</Tag>
                            <Typography.Text strong>{item.alertTitle}</Typography.Text>
                          </Space>
                        }
                        description={
                          <Space size={12} wrap>
                            <Typography.Text type="secondary">
                              {item.plotName ? `地块：${item.plotName}` : '农场级告警'}
                            </Typography.Text>
                            <Typography.Text type="secondary">{item.triggeredAt || '-'}</Typography.Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title="本月农事趋势"
            extra={
              <Segmented<TrendRange>
                value={trendRange}
                onChange={setTrendRange}
                options={[
                  { label: '本月', value: 'month' },
                  { label: '近 7 天', value: 'week' },
                ]}
              />
            }
          >
            <ReactECharts
              option={buildTrendOption(trendData)}
              style={{ height: 280 }}
              opts={{ renderer: 'canvas' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="关键指标">
            {!overview ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text>本月任务完成率</Typography.Text>
                    <Typography.Text strong>{overview.taskCompletionRate}%</Typography.Text>
                  </Space>
                  <Progress
                    percent={Math.min(100, overview.taskCompletionRate)}
                    strokeColor="#13a05a"
                  />
                </div>
                <div>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text>质量合格率</Typography.Text>
                    <Typography.Text strong>{overview.passRate}%</Typography.Text>
                  </Space>
                  <Progress percent={Math.min(100, overview.passRate)} strokeColor="#1677ff" />
                </div>
                <div>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text>进行中种养计划</Typography.Text>
                    <Typography.Text strong>{overview.runningPlanCount} 个</Typography.Text>
                  </Space>
                  <Progress
                    percent={Math.min(100, overview.runningPlanCount * 20)}
                    strokeColor="#fa8c16"
                    showInfo={false}
                  />
                </div>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic title="农场数量" value={overview.farmCount} suffix="个" />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="溯源码累计"
                      value={overview.traceCodeCount}
                      formatter={(value) => formatNumber(Number(value))}
                    />
                  </Col>
                </Row>
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  )
}
