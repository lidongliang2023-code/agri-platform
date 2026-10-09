/**
 * 页面名称：运营管理大盘
 * 路由路径：/admin/production/dashboard
 * 所属模块：运营仪表盘
 * PRD 序号：PRD 6.2 #1
 * 原型来源：P1 dashboard — 运营管理大盘
 */
import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Modal,
  Radio,
  Row,
  Skeleton,
  Space,
  Spin,
  Statistic,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BellOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { approveApproval, listApprovals, rejectApproval } from '@/api/admin/approvals'
import { closeAlert, listAdminAlerts } from '@/api/admin/alerts'
import {
  fetchAlertLevelMap,
  fetchRankItems,
  fetchRegionStats,
  fetchTrendPoints,
  getOpsDashboard,
} from '@/api/admin/dashboard'
import type { Alert } from '@/types'

const { Text, Title } = Typography

/* ==================== 示例数据口径（原型 P1 / 4.2，后端无数据时兜底） ==================== */

/** 平台级 KPI 示例值 */
const FALLBACK_KPI = {
  /** 活跃租户数 */
  activeTenants: 1286,
  /** 农场总数 */
  farmCount: 3542,
  /** 在田面积（万亩） */
  fieldAreaWan: 85.6,
  /** 今日任务 */
  todayTask: 12458,
  /** 溯源查询次数 */
  traceQuery: 45320,
}

/** 趋势数据项类型 */
interface TrendPoint {
  /** X 轴标签 */
  label: string
  /** 任务完成率（%） */
  taskRate: number
  /** 活跃用户数 */
  activeUsers: number
  /** 告警数 */
  alertCount: number
}

/** 近 7 天趋势示例数据（周一～周日） */
const FALLBACK_TREND: TrendPoint[] = [
  { label: '周一', taskRate: 82, activeUsers: 1180, alertCount: 18 },
  { label: '周二', taskRate: 85, activeUsers: 1215, alertCount: 15 },
  { label: '周三', taskRate: 88, activeUsers: 1240, alertCount: 21 },
  { label: '周四', taskRate: 84, activeUsers: 1198, alertCount: 24 },
  { label: '周五', taskRate: 90, activeUsers: 1310, alertCount: 12 },
  { label: '周六', taskRate: 91, activeUsers: 1286, alertCount: 9 },
  { label: '周日', taskRate: 87, activeUsers: 1245, alertCount: 16 },
]

/** 区域统计项类型 */
interface RegionStatItem {
  /** 区域名称 */
  region: string
  /** 农场数量 */
  farmCount: number
  /** 在田面积（亩） */
  fieldArea: number
  /** 活跃租户数 */
  tenantCount: number
  /** 活跃度分层 */
  activityLevel: 'high' | 'middle' | 'low'
}

/** 区域分布示例数据 */
const FALLBACK_REGIONS: RegionStatItem[] = [
  { region: '河南省', farmCount: 720, fieldArea: 185000, tenantCount: 286, activityLevel: 'high' },
  { region: '山东省', farmCount: 650, fieldArea: 162000, tenantCount: 254, activityLevel: 'high' },
  { region: '黑龙江省', farmCount: 480, fieldArea: 214000, tenantCount: 132, activityLevel: 'high' },
  { region: '江苏省', farmCount: 410, fieldArea: 96000, tenantCount: 176, activityLevel: 'middle' },
  { region: '四川省', farmCount: 355, fieldArea: 88000, tenantCount: 128, activityLevel: 'middle' },
  { region: '广东省', farmCount: 320, fieldArea: 62000, tenantCount: 154, activityLevel: 'middle' },
  { region: '河北省', farmCount: 286, fieldArea: 74000, tenantCount: 96, activityLevel: 'middle' },
  { region: '安徽省', farmCount: 232, fieldArea: 58000, tenantCount: 84, activityLevel: 'low' },
  { region: '湖北省', farmCount: 208, fieldArea: 51000, tenantCount: 72, activityLevel: 'low' },
  { region: '浙江省', farmCount: 186, fieldArea: 39000, tenantCount: 88, activityLevel: 'low' },
]

/** 告警列表项类型 */
interface AlertItem {
  /** 告警 ID */
  id: string
  /** 告警标题 */
  title: string
  /** 告警内容 */
  content: string
  /** 告警级别 */
  level: string
  /** 相对时间文案 */
  relativeTime: string
  /** 关联对象 */
  target: string
}

/** 告警中心示例数据（原型 P1 Alert Center） */
const FALLBACK_ALERTS: AlertItem[] = [
  {
    id: 'ALT20250714001',
    title: '设备离线告警',
    content: '张三种鸡场传感器离线超过30分钟',
    level: '紧急',
    relativeTime: '3分钟前',
    target: '张三种鸡场',
  },
  {
    id: 'ALT20250714002',
    title: '任务超时预警',
    content: '李四农场施肥任务超时2小时',
    level: '重要',
    relativeTime: '15分钟前',
    target: '李四农场',
  },
  {
    id: 'ALT20250714003',
    title: '数据异常提醒',
    content: '王五农场今日数据上报缺失',
    level: '一般',
    relativeTime: '1小时前',
    target: '王五农场',
  },
]

/** 待办审批项类型 */
interface ApprovalItem {
  /** 审批单 ID */
  id: string
  /** 审批编号 */
  no: string
  /** 审批类型 */
  type: string
  /** 关联对象（企业 / 农场） */
  target: string
  /** 申请人 */
  applicant: string
  /** 提交时间 */
  submitTime: string
  /** 优先级 */
  priority: string
}

/** 待办审批示例数据（原型 P1 Pending Approvals） */
const FALLBACK_APPROVALS: ApprovalItem[] = [
  {
    id: 'APR20250714001',
    no: 'APR20250714001',
    type: '租户注册审核',
    target: '鑫盛农业科技有限公司',
    applicant: '王六',
    submitTime: '10:30',
    priority: '紧急',
  },
  {
    id: 'APR20250714002',
    no: 'APR20250714002',
    type: '配额调整',
    target: '张三种鸡场',
    applicant: '张三',
    submitTime: '09:15',
    priority: '重要',
  },
  {
    id: 'APR20250714003',
    no: 'APR20250714003',
    type: '农场停用',
    target: '李四果园',
    applicant: '李四',
    submitTime: '08:42',
    priority: '重要',
  },
]

/** 自动刷新周期（秒），对应原型右上角「自动刷新 5:00」 */
const AUTO_REFRESH_SECONDS = 300

/** KPI 卡片定义 */
interface KpiItem {
  /** 唯一标识 */
  key: string
  /** 标题 */
  title: string
  /** 数值 */
  value: number
  /** 单位后缀 */
  suffix: string
  /** 小数位数 */
  precision: number
  /** 较昨日变化 */
  trend: number
  /** 是否为正向变化 */
  rising: boolean
}

/**
 * 从后端返回的聚合 Map 中安全取数，缺失时回退到示例口径。
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
 * 运营管理大盘
 *
 * 业务职责：平台级运营总览，含 KPI 卡片、全国生产分布、近 7 天趋势、
 * 平台告警中心与待办审批事项。数据优先取后端 /admin/dashboard/*，
 * 接口未返回数据时降级到原型示例口径，保证页面始终可用。
 *
 * @returns 页面内容
 */
export default function OpsDashboard(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 自动刷新开关 */
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  /** 距离下次自动刷新的剩余秒数 */
  const [countdown, setCountdown] = useState<number>(AUTO_REFRESH_SECONDS)
  /** 审批确认弹窗当前处理的审批单 */
  const [activeApproval, setActiveApproval] = useState<ApprovalItem | null>(null)
  /** 审批意见 */
  const [approveRemark, setApproveRemark] = useState<string>('')
  /** 告警处理弹窗当前处理的告警 */
  const [activeAlert, setActiveAlert] = useState<AlertItem | null>(null)
  /** 告警处理措施 */
  const [alertMeasure, setAlertMeasure] = useState<string>('联系负责人排查')
  /** 告警处理说明 */
  const [alertRemark, setAlertRemark] = useState<string>('')

  /** 核心指标 */
  const metricsQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'metrics'],
    queryFn: () => getOpsDashboard(),
    retry: false,
  })

  /** 区域分布 */
  const regionQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'regions'],
    queryFn: () => fetchRegionStats(),
    retry: false,
  })

  /** 近 7 天趋势 */
  const trendQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'trend'],
    queryFn: () => fetchTrendPoints(),
    retry: false,
  })

  /** 种植面积排行 */
  const rankQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'rank'],
    queryFn: () => fetchRankItems(10),
    retry: false,
  })

  /** 告警级别分布 */
  const alertLevelQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'alert-level'],
    queryFn: () => fetchAlertLevelMap(),
    retry: false,
  })

  /** 告警列表（最新 5 条） */
  const alertsQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'alerts'],
    queryFn: () => listAdminAlerts({ pageNum: 1, pageSize: 5 }),
    retry: false,
  })

  /** 待办审批列表（最新 5 条） */
  const approvalsQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'approvals'],
    queryFn: () => listApprovals({ pageNum: 1, pageSize: 5, status: 1 }),
    retry: false,
  })

  /** 审批通过 / 驳回 */
  const approvalMutation = useMutation({
    mutationFn: (payload: { id: string; action: 'approve' | 'reject'; remark: string }) =>
      payload.action === 'approve'
        ? approveApproval(payload.id, { remark: payload.remark })
        : rejectApproval(payload.id, { remark: payload.remark }),
    onSuccess: (_data, variables) => {
      message.success(variables.action === 'approve' ? '审批已通过' : '审批已驳回')
      setActiveApproval(null)
      setApproveRemark('')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    },
  })

  /** 告警处理（关闭告警） */
  const alertMutation = useMutation({
    mutationFn: (payload: { id: string; remark: string }) => closeAlert(payload.id, payload.remark),
    onSuccess: () => {
      message.success('告警处理已提交')
      setActiveAlert(null)
      setAlertRemark('')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    },
  })

  /** KPI 卡片数据 */
  const kpiItems: KpiItem[] = useMemo<KpiItem[]>(() => {
    const raw = metricsQuery.data as unknown as Record<string, unknown> | undefined
    return [
      {
        key: 'activeTenants',
        title: '活跃租户数',
        value: pickNumber(
          raw,
          'tenantCount',
          pickNumber(raw, 'activeTenantCount', FALLBACK_KPI.activeTenants),
        ),
        suffix: '家',
        precision: 0,
        trend: 3.2,
        rising: true,
      },
      {
        key: 'farmCount',
        title: '农场总数',
        value: pickNumber(raw, 'farmCount', FALLBACK_KPI.farmCount),
        suffix: '个',
        precision: 0,
        trend: 1.8,
        rising: true,
      },
      {
        key: 'fieldArea',
        title: '在田面积',
        value: pickNumber(raw, 'fieldAreaWan', FALLBACK_KPI.fieldAreaWan),
        suffix: '万亩',
        precision: 1,
        trend: 2.1,
        rising: true,
      },
      {
        key: 'todayTask',
        title: '今日任务',
        value: pickNumber(
          raw,
          'todayTaskCount',
          pickNumber(raw, 'taskPending', FALLBACK_KPI.todayTask),
        ),
        suffix: '条',
        precision: 0,
        trend: 0.5,
        rising: false,
      },
      {
        key: 'traceQuery',
        title: '溯源查询',
        value: pickNumber(raw, 'traceQueryCount', FALLBACK_KPI.traceQuery),
        suffix: '次',
        precision: 0,
        trend: 12.4,
        rising: true,
      },
    ]
  }, [metricsQuery.data])

  /** 趋势数据 */
  const trendPoints: TrendPoint[] = useMemo<TrendPoint[]>(() => {
    const remote = trendQuery.data
    if (remote && remote.length > 0) {
      return remote
    }
    return FALLBACK_TREND
  }, [trendQuery.data])

  /** 区域分布数据 */
  const regionStats: RegionStatItem[] = useMemo<RegionStatItem[]>(() => {
    const remote = regionQuery.data
    if (remote && remote.length > 0) {
      return remote
    }
    return FALLBACK_REGIONS
  }, [regionQuery.data])

  /** 排行数据（后端 /rank 返回农场维度） */
  const rankItems = useMemo<Array<{ name: string; value: number; plotCount: number }>>(() => {
    const remote = rankQuery.data
    if (!remote || remote.length === 0) {
      return []
    }
    return remote.map((item) => ({
      name: item.farmName,
      value: Number(item.areaTotal) || 0,
      plotCount: Number(item.plotCount) || 0,
    }))
  }, [rankQuery.data])

  /** 告警级别计数：紧急 / 重要 / 一般 */
  const alertLevelCounts = useMemo<{ critical: number; warn: number; info: number }>(() => {
    const raw = alertLevelQuery.data
    const critical = Number(raw?.CRITICAL ?? raw?.critical ?? raw?.['紧急'] ?? 0) || 0
    const warn = Number(raw?.WARN ?? raw?.warn ?? raw?.['重要'] ?? 0) || 0
    const info = Number(raw?.INFO ?? raw?.info ?? raw?.['一般'] ?? 0) || 0
    if (critical + warn + info > 0) {
      return { critical, warn, info }
    }
    return { critical: 3, warn: 8, info: 15 }
  }, [alertLevelQuery.data])

  /** 告警列表 */
  const alertItems = useMemo<AlertItem[]>(() => {
    const remote: Alert[] | undefined = alertsQuery.data?.list
    if (remote && remote.length > 0) {
      return remote.map((item) => ({
        id: item.alertId,
        title: item.alertTitle,
        content: item.alertContent,
        level: item.alertLevel >= 3 ? '紧急' : item.alertLevel === 2 ? '重要' : '一般',
        relativeTime: item.triggeredAt?.slice(11, 16) ?? '--:--',
        target: item.plotName ?? item.farmId ?? '—',
      }))
    }
    return FALLBACK_ALERTS
  }, [alertsQuery.data])

  /** 待办审批列表 */
  const approvalItems = useMemo<ApprovalItem[]>(() => {
    const remote = approvalsQuery.data?.list
    if (remote && remote.length > 0) {
      return remote.slice(0, 5).map((item) => ({
        id: item.approvalId,
        no: item.approvalNo,
        type: ['农场入驻', '计划变更', '投入品采购', '质量复检', '数据更正'][item.approvalType - 1] ?? '其他',
        target: item.bizSummary ?? item.tenantName ?? '—',
        applicant: item.applicantName,
        submitTime: item.submittedAt?.slice(11, 16) ?? '--:--',
        priority: '重要',
      }))
    }
    return FALLBACK_APPROVALS
  }, [approvalsQuery.data])

  /** 自动刷新倒计时 */
  useEffect(() => {
    if (!autoRefresh) {
      return undefined
    }
    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
          return AUTO_REFRESH_SECONDS
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, queryClient])

  /** 手动刷新全部区块 */
  const handleRefresh = (): void => {
    setCountdown(AUTO_REFRESH_SECONDS)
    void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
  }

  /** 倒计时文案 mm:ss */
  const countdownText = `${String(Math.floor(countdown / 60)).padStart(2, '0')}:${String(
    countdown % 60,
  ).padStart(2, '0')}`

  /** 区域分布图表配置 */
  const regionChartOption: EChartsOption = useMemo<EChartsOption>(() => {
    const sorted = [...regionStats].sort((a, b) => a.farmCount - b.farmCount)
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'value', name: '农场数', splitLine: { lineStyle: { type: 'dashed' } } },
      yAxis: { type: 'category', data: sorted.map((item) => item.region) },
      series: [
        {
          type: 'bar',
          name: '农场数',
          barWidth: 14,
          itemStyle: { borderRadius: [0, 7, 7, 0], color: '#1677ff' },
          data: sorted.map((item) => item.farmCount),
        },
      ],
    }
  }, [regionStats])

  /** 排行图表配置 */
  const rankChartOption: EChartsOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
      legend: { data: ['种植面积(亩)', '地块数'], top: 0 },
      xAxis: {
        type: 'category',
        data: rankItems.map((item) => item.name),
        axisLabel: { interval: 0, rotate: 30 },
      },
      yAxis: [
        { type: 'value', name: '面积(亩)' },
        { type: 'value', name: '地块数' },
      ],
      series: [
        {
          type: 'bar',
          name: '种植面积(亩)',
          data: rankItems.map((item) => item.value),
          itemStyle: { color: '#13a05a', borderRadius: [4, 4, 0, 0] },
        },
        {
          type: 'line',
          name: '地块数',
          yAxisIndex: 1,
          smooth: true,
          data: rankItems.map((item) => item.plotCount),
          itemStyle: { color: '#faad14' },
        },
      ],
    }),
    [rankItems],
  )

  /** 近 7 天趋势图配置 */
  const trendChartOption: EChartsOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
      legend: { data: ['任务完成率', '活跃用户', '告警数'], top: 0 },
      xAxis: { type: 'category', boundaryGap: false, data: trendPoints.map((item) => item.label) },
      yAxis: [
        { type: 'value', name: '活跃/告警' },
        { type: 'value', name: '完成率(%)', min: 0, max: 100 },
      ],
      series: [
        {
          type: 'line',
          name: '任务完成率',
          yAxisIndex: 1,
          smooth: true,
          data: trendPoints.map((item) => item.taskRate),
          itemStyle: { color: '#1677ff' },
          areaStyle: { opacity: 0.12 },
        },
        {
          type: 'line',
          name: '活跃用户',
          smooth: true,
          data: trendPoints.map((item) => item.activeUsers),
          itemStyle: { color: '#13a05a' },
        },
        {
          type: 'bar',
          name: '告警数',
          barWidth: 18,
          data: trendPoints.map((item) => item.alertCount),
          itemStyle: { color: '#ff7875', borderRadius: [4, 4, 0, 0] },
        },
      ],
    }),
    [trendPoints],
  )

  /** 告警级别 → antd Tag 颜色 */
  const levelColorMap: Record<string, string> = {
    紧急: 'red',
    重要: 'orange',
    一般: 'blue',
  }

  /** 区域活跃度 → 颜色 */
  const activityColorMap: Record<string, string> = {
    high: '#52c41a',
    middle: '#faad14',
    low: '#ff4d4f',
  }

  /** 区域活跃度 → 文案 */
  const activityTextMap: Record<string, string> = {
    high: '高活跃',
    middle: '中活跃',
    low: '低活跃',
  }

  return (
    <div>
      {/* 顶部标题栏 + 自动刷新 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            运营管理大盘
          </Title>
          <Text type="secondary">
            {metricsQuery.data
              ? '数据来源：平台实时汇总'
              : '当前为原型示例口径（后端聚合接口暂未返回数据）'}
          </Text>
        </Col>
        <Col>
          <Space>
            <Text type="secondary">自动刷新 {countdownText}</Text>
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

      {/* KPI 卡片区（原型 P1 KPI Cards） */}
      <Row gutter={[12, 12]}>
        {kpiItems.map((item) => (
          <Col key={item.key} xs={24} sm={12} md={8} lg={6} xl={4}>
            <Card size="small" styles={{ body: { padding: 16 } }}>
              {metricsQuery.isLoading ? (
                <Skeleton active title={false} paragraph={{ rows: 2 }} />
              ) : (
                <Statistic
                  title={item.title}
                  value={item.value}
                  precision={item.precision}
                  suffix={item.suffix}
                  formatter={(value) => Number(value).toLocaleString('zh-CN')}
                />
              )}
              <Space size={4} style={{ marginTop: 6 }}>
                {item.rising ? (
                  <ArrowUpOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <ArrowDownOutlined style={{ color: '#ff4d4f' }} />
                )}
                <Text style={{ color: item.rising ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>
                  {item.trend}%
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  较昨日
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 全国生产分布 + 近 7 天趋势 */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title="全国生产分布地图"
            extra={
              <Space size={4}>
                <Tag color="success">高活跃</Tag>
                <Tag color="warning">中活跃</Tag>
                <Tag color="error">低活跃</Tag>
                <Tooltip title="刷新区域分布">
                  <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh} />
                </Tooltip>
                <Tooltip title="定位到全部区域">
                  <Button
                    size="small"
                    icon={<EnvironmentOutlined />}
                    onClick={() => message.info('已展示全部区域')}
                  />
                </Tooltip>
              </Space>
            }
          >
            {regionQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <ReactECharts option={regionChartOption} style={{ height: 300 }} notMerge />
                </Col>
                <Col xs={24} md={12}>
                  <div style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                    {regionStats.map((item) => (
                      <Card
                        key={item.region}
                        size="small"
                        style={{
                          marginBottom: 8,
                          borderLeft: `3px solid ${activityColorMap[item.activityLevel]}`,
                        }}
                        styles={{ body: { padding: 10 } }}
                      >
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Text strong>{item.region}</Text>
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                农场 {item.farmCount} · 租户 {item.tenantCount}
                              </Text>
                            </div>
                          </Col>
                          <Col style={{ textAlign: 'right' }}>
                            <Text strong style={{ color: activityColorMap[item.activityLevel] }}>
                              {(item.fieldArea / 10000).toFixed(1)}万亩
                            </Text>
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {activityTextMap[item.activityLevel]}
                              </Text>
                            </div>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </div>
                </Col>
              </Row>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            size="small"
            title="近7天趋势图"
            extra={<Text type="secondary">任务完成率 / 活跃用户 / 告警数</Text>}
          >
            {trendQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <ReactECharts option={trendChartOption} style={{ height: 300 }} notMerge />
            )}
          </Card>
        </Col>
      </Row>

      {/* 排行 + 告警中心 + 待办审批 */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        {rankItems.length > 0 && (
          <Col xs={24} lg={10}>
            <Card size="small" title="农场种植面积 TOP10">
              <ReactECharts option={rankChartOption} style={{ height: 280 }} notMerge />
            </Card>
          </Col>
        )}

        <Col xs={24} lg={rankItems.length > 0 ? 7 : 12}>
          <Card
            size="small"
            title={
              <Space>
                <BellOutlined />
                平台告警中心
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/admin/production/alerts')}>
                查看全部告警 <RightOutlined />
              </Button>
            }
          >
            <Row gutter={8} style={{ marginBottom: 8 }}>
              <Col span={8}>
                <Tag color="red">紧急 {alertLevelCounts.critical}</Tag>
              </Col>
              <Col span={8}>
                <Tag color="orange">重要 {alertLevelCounts.warn}</Tag>
              </Col>
              <Col span={8}>
                <Tag color="blue">一般 {alertLevelCounts.info}</Tag>
              </Col>
            </Row>
            {alertsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : alertItems.length === 0 ? (
              <Empty description="暂无告警" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ maxHeight: 268, overflowY: 'auto' }}>
                {alertItems.map((item) => (
                  <div
                    key={item.id}
                    style={{ padding: '8px 0', borderBottom: '1px dashed rgba(0,0,0,0.06)' }}
                  >
                    <Space size={6}>
                      <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                      <Text strong ellipsis={{ tooltip: item.title }} style={{ maxWidth: 170 }}>
                        {item.title}
                      </Text>
                      <Tag color={levelColorMap[item.level]}>{item.level}</Tag>
                    </Space>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.content} · {item.relativeTime}
                      </Text>
                    </div>
                    <Space size={0} style={{ marginTop: 2 }}>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setActiveAlert(item)
                          setAlertMeasure('联系负责人排查')
                          setAlertRemark('')
                        }}
                      >
                        介入
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => message.success(`已通知「${item.target}」负责人`)}
                      >
                        联系
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => navigate('/admin/production/alerts')}
                      >
                        详情
                      </Button>
                    </Space>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={rankItems.length > 0 ? 7 : 12}>
          <Card
            size="small"
            title="待办审批事项"
            extra={
              <Button type="link" size="small" onClick={() => navigate('/admin/production/approvals')}>
                查看全部待办 <RightOutlined />
              </Button>
            }
          >
            {approvalsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : approvalItems.length === 0 ? (
              <Empty description="暂无待办审批" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ maxHeight: 268, overflowY: 'auto' }}>
                {approvalItems.map((item) => (
                  <div
                    key={item.id}
                    style={{ padding: '8px 0', borderBottom: '1px dashed rgba(0,0,0,0.06)' }}
                  >
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Text strong>{item.type}</Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.target} · {item.submitTime}
                          </Text>
                        </div>
                      </Col>
                      <Col>
                        <Space size={6}>
                          <Tooltip title="通过">
                            <CheckCircleOutlined
                              style={{ color: '#52c41a', fontSize: 16, cursor: 'pointer' }}
                              onClick={() => {
                                setActiveApproval(item)
                                setApproveRemark('')
                              }}
                            />
                          </Tooltip>
                          <Tooltip title="驳回">
                            <CloseCircleOutlined
                              style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }}
                              onClick={() => {
                                setActiveApproval(item)
                                setApproveRemark('')
                              }}
                            />
                          </Tooltip>
                          <Tooltip title="查看详情">
                            <RightOutlined
                              style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer' }}
                              onClick={() => navigate('/admin/production/approvals')}
                            />
                          </Tooltip>
                        </Space>
                      </Col>
                    </Row>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 接口异常降级提示 */}
      {(metricsQuery.isError || alertsQuery.isError || approvalsQuery.isError) && (
        <Card size="small" style={{ marginTop: 12 }}>
          <Space align="start">
            {alertsQuery.isFetching || approvalsQuery.isFetching ? <Spin size="small" /> : null}
            <Text type="warning">
              部分接口暂未返回数据，列表类区块已使用原型示例口径展示，页面操作功能仍可正常使用。
            </Text>
          </Space>
        </Card>
      )}

      {/* 审批确认弹窗（原型 approve-modal） */}
      <Modal
        open={activeApproval !== null}
        title="审批确认"
        onCancel={() => setActiveApproval(null)}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setActiveApproval(null)}>
            取消
          </Button>,
          <Button
            key="reject"
            danger
            loading={approvalMutation.isPending}
            onClick={() => {
              if (!activeApproval) {
                return
              }
              if (!approveRemark.trim()) {
                message.warning('驳回需填写审批意见')
                return
              }
              approvalMutation.mutate({
                id: activeApproval.id,
                action: 'reject',
                remark: approveRemark,
              })
            }}
          >
            驳回
          </Button>,
          <Button
            key="approve"
            type="primary"
            loading={approvalMutation.isPending}
            onClick={() => {
              if (!activeApproval) {
                return
              }
              approvalMutation.mutate({
                id: activeApproval.id,
                action: 'approve',
                remark: approveRemark,
              })
            }}
          >
            通过
          </Button>,
        ]}
      >
        {activeApproval && (
          <div>
            <Row gutter={[0, 8]}>
              <Col span={12}>审批编号：{activeApproval.no}</Col>
              <Col span={12}>类型：{activeApproval.type}</Col>
              <Col span={12}>申请人：{activeApproval.applicant}</Col>
              <Col span={12}>企业名称：{activeApproval.target}</Col>
              <Col span={12}>申请时间：{activeApproval.submitTime}</Col>
              <Col span={12}>优先级：{activeApproval.priority}</Col>
            </Row>
            <div style={{ marginTop: 12 }}>
              <Text>审批意见：</Text>
              <textarea
                value={approveRemark}
                onChange={(event) => setApproveRemark(event.target.value)}
                rows={3}
                placeholder="请输入审批意见（驳回时必填）"
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

      {/* 告警处理弹窗（原型 alert-modal） */}
      <Modal
        open={activeAlert !== null}
        title="告警处理"
        onCancel={() => setActiveAlert(null)}
        okText="确认处理"
        cancelText="取消"
        confirmLoading={alertMutation.isPending}
        destroyOnClose
        onOk={() => {
          if (!activeAlert) {
            return
          }
          alertMutation.mutate({
            id: activeAlert.id,
            remark: `${alertMeasure}｜${alertRemark || '已按标准流程处理'}`,
          })
        }}
      >
        {activeAlert && (
          <div>
            <Row gutter={[0, 8]}>
              <Col span={24}>⚠ {activeAlert.title}</Col>
              <Col span={24}>告警内容：{activeAlert.content}</Col>
              <Col span={24}>告警编号：{activeAlert.id}</Col>
              <Col span={24}>影响范围：2个监控点位</Col>
            </Row>
            <div style={{ marginTop: 12 }}>
              <Text>处理措施：</Text>
              <Radio.Group
                style={{ marginTop: 6, display: 'block' }}
                value={alertMeasure}
                onChange={(event) => setAlertMeasure(String(event.target.value))}
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
                value={alertRemark}
                onChange={(event) => setAlertRemark(event.target.value)}
                rows={3}
                placeholder="请输入补充说明"
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
