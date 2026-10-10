/**
 * 页面名称：生产数据看板
 * 路由路径：/production/dashboard
 * 所属模块：首页看板
 * PRD 序号：PRD 6.1 #1
 *
 * 页面用途（PRD）：生产概况、待办任务、告警提醒、关键指标。
 * 布局与配色参照原型 P2 农场详情的指标卡 + P19 生产监控看板的分区结构。
 */
import { useMemo } from 'react'
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
  Skeleton,
  Space,
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
  formatNumber,
  metricText,
  priorityMeta,
  taskStatusMeta,
  taskTypeLabel,
} from '@/utils/production-adapter'
import { TASK_STATUS_DOING } from '@/types/task'
import { MetricStatistic, MetricText } from '@/components'

/** 指标卡渲染参数 */
interface MetricCard {
  /** 唯一 key */
  key: string
  /** 标题 */
  title: string
  /** 数值；null 表示后端暂无该指标数据源，渲染成「—」 */
  value: number | null
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

  /** 指标卡数据（后端没返回的指标一律 null → 渲染「—」+ 可见提示） */
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
        footer: `地块 ${metricText(overview.plotCount, 0, ' 个')} · 在田作物 ${metricText(
          overview.cropCount,
          0,
          ' 种',
        )}`,
      },
      {
        key: 'yieldTotal',
        title: '累计产量',
        value: overview.yieldTotal,
        precision: 0,
        suffix: 'kg',
        color: '#1677ff',
        icon: <CheckCircleOutlined />,
        footer: `合格率 ${metricText(overview.passRate, 1, '%')} · 亩均成本 ${metricText(
          overview.avgCostPerMu,
          0,
          ' 元',
        )}`,
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
        footer: `已接入指标 ${metricText(overview.metricCount, 0, ' 项')}`,
      },
      {
        key: 'activeDeviceCount',
        title: '在线设备',
        value: overview.activeDeviceCount,
        precision: 0,
        suffix: '台',
        color: '#722ed1',
        icon: <DashboardOutlined />,
        footer: `溯源码累计 ${formatNumber(overview.traceCodeCount ?? 0)} 个`,
      },
    ]
  }, [overview])

  /**
   * 构造趋势图配置
   *
   * 后端暂无「本月农事趋势」数据源，这里不生成任何本地序列，
   * 图表渲染「暂无趋势数据源」占位文案，避免把假曲线当真数据看。
   *
   * @returns ECharts 配置
   */
  function buildTrendOption(): Record<string, unknown> {
    return {
      color: ['#13a05a', '#1677ff'],
      tooltip: { trigger: 'axis' },
      legend: { data: [], show: false },
      grid: { left: 40, right: 20, top: 30, bottom: 40 },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value', minInterval: 1 },
      series: [],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: 'middle',
          style: {
            text: '后端暂无农事趋势数据源，暂不展示曲线',
            fill: '#999',
            fontSize: 13,
          },
        },
      ],
      animationDuration: 400,
    }
  }

  /**
   * 任务状态流转（开始执行）。
   *
   * ⚠️ 状态值必须是后端真值：后端只认 `doing`（旧代码写 `executing`，
   * 后端不存在该值，等于写了一个永远不会出现的状态）。
   */
  const startMutation = useMutation({
    mutationFn: (taskId: string) => updateTask(taskId, { status: TASK_STATUS_DOING }),
    onSuccess: () => {
      message.success('任务已置为执行中')
      void todoQuery.refetch()
    },
    onError: (error: Error) => message.error(error.message || '操作失败'),
  })

  const loading = overviewQuery.isLoading || todoQuery.isLoading || alertQuery.isLoading
  /** 总览接口不可用（请求失败 / 后端不可达） */
  const overviewUnavailable = overview?.available === false
  /** 后端未提供数据源的指标清单 */
  const missingFields = overview?.missingFields ?? []

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
        {overviewUnavailable ? (
          <AntAlert
            type="warning"
            showIcon
            message="统计接口暂不可用，本页指标显示为「—」"
            description="GET /analytics/overview 请求失败。本页不使用任何本地示例值回填，接口恢复后会自动重新拉取。"
            action={
              <Button size="small" onClick={() => void overviewQuery.refetch()}>
                重试
              </Button>
            }
          />
        ) : missingFields.length > 0 ? (
          <AntAlert
            type="warning"
            showIcon
            message="本页部分指标后端暂未提供数据源，显示为「—」"
            description={`暂无数据源的指标：${missingFields.join('、')}。带 ⓘ 图标的数值即为后端未接入项，接口补齐后自动填充。`}
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
                    <MetricStatistic
                      title={metric.title}
                      value={metric.value}
                      precision={metric.precision}
                      suffix={metric.value === null ? undefined : metric.suffix}
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
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                后端暂无趋势数据源
              </Typography.Text>
            }
          >
            <ReactECharts
              option={buildTrendOption()}
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
                    <Typography.Text>检测合格率</Typography.Text>
                    <MetricText value={overview.passRate} precision={1} suffix="%" />
                  </Space>
                  <Progress
                    percent={overview.passRate === null ? 0 : Math.min(100, overview.passRate)}
                    strokeColor={overview.passRate === null ? '#d9d9d9' : '#1677ff'}
                    showInfo={overview.passRate !== null}
                    format={() => (overview.passRate === null ? '未接入' : '')}
                  />
                </div>
                <Row gutter={16}>
                  <Col span={12}>
                    <MetricStatistic title="累计产量" value={overview.yieldTotal} suffix="kg" />
                  </Col>
                  <Col span={12}>
                    <MetricStatistic title="亩均生产成本" value={overview.avgCostPerMu} suffix="元" />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <MetricStatistic title="农场数量" value={overview.farmCount} suffix="个" />
                  </Col>
                  <Col span={12}>
                    <MetricStatistic title="溯源码累计" value={overview.traceCodeCount} suffix="个" />
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
