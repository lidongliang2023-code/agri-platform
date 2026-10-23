/**
 * 页面名称：运营管理大盘
 * 路由路径：/admin/production/dashboard
 * 所属模块：运营仪表盘
 * PRD 序号：PRD 6.2 #1
 * 原型来源：P1 dashboard — 运营管理大盘
 *
 * 数据来源约定（硬规矩：不造数据源；可以降级，不能骗人）：
 * - KPI 卡片只展示后端真实返回的字段，来源为 GET /admin/dashboard/overview
 *   与 GET /admin/tenants/overview；后端没有的指标不渲染、不用原型数字填充；
 * - 区域分布（/admin/dashboard/region-distribution）与近 7 天趋势（/admin/dashboard/trend）
 *   后端当前**没有端点**（实测返回 500「系统繁忙」），这两个区块展示空态并显式说明「后端暂未提供」；
 * - 告警级别分布取 GET /admin/dashboard/alert-trend，告警/审批列表取各自真实分页接口；
 * - 「较昨日涨跌」后端无同比数据源，因此不展示，也不再多保留一条造假百分比。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
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
  Statistic,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
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
import { getTenantOverview } from '@/api/admin/tenants'
import type { Alert as AlertItem0 } from '@/types'

const { Text, Title } = Typography

/** 自动刷新周期（秒） */
const AUTO_REFRESH_SECONDS = 300

/** KPI 卡片定义（value 为 null 表示后端未提供该指标，展示「—」而不是 0） */
interface KpiItem {
  /** 唯一标识 */
  key: string
  /** 标题 */
  title: string
  /** 数值；null 表示后端未提供数据源 */
  value: number | null
  /** 单位后缀 */
  suffix: string
  /** 小数位数 */
  precision: number
}

/** 近 7 天趋势数据项（后端 OpsTrendPoint 形态） */
interface TrendPoint {
  /** X 轴标签 */
  label: string
  /** 任务完成率（%） */
  taskRate: number
  /**
   * 当日作业人数（后端字段名 activeWorkers）。
   *
   * 口径：当日有作业记录的不同人数，**不是**登录活跃用户 / DAU。
   */
  activeWorkers: number
  /** 告警数 */
  alertCount: number
}

/** 区域统计项 */
interface RegionStatItem {
  /** 区域名称 */
  region: string
  /** 农场数量 */
  farmCount: number
  /** 在田面积（亩） */
  fieldArea: number
  /** 活跃主体数 */
  tenantCount: number
  /** 活跃度分层 */
  activityLevel: 'high' | 'middle' | 'low'
}

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

/**
 * 从后端返回的聚合 Map 中读取非负数值。
 *
 * 后端部分聚合字段会序列化成字符串（如 farmCount: "5"），故统一走 Number 强转；
 * 取不到值时返回 null（调用方展示「—」），**不再回退到任何原型口径数字**。
 *
 * @param source 后端返回对象
 * @param key 字段名
 * @returns 有效数字；缺失时为 null
 */
function pickNumber(source: unknown, key: string): number | null {
  if (!source || typeof source !== 'object') {
    return null
  }
  const raw = (source as Record<string, unknown>)[key]
  if (raw === null || raw === undefined || raw === '') {
    return null
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 按候选键顺序取第一个有值的数值（告警级别键名兼容用）。
 *
 * 告警级别枚举正在迁移，同一个桶在迁移前后是两个不同的键：
 * `CRITICAL→important`、`WARN→normal`、`INFO→info`、`URGENT→urgent`
 * （**不是**简单大小写转换）。迁移还没执行完，所以这里**新旧键都认**，
 * 且旧键排在前面——删掉旧键会在迁移落地前立刻退化成「—」。
 *
 * @param source 后端返回对象
 * @param keys 候选键，按优先级从高到低
 * @returns 第一个命中且能解析成有限数字的值；全都不命中时为 null
 */
function pickNumberAny(source: unknown, keys: string[]): number | null {
  for (const key of keys) {
    const value = pickNumber(source, key)
    if (value !== null) {
      return value
    }
  }
  return null
}

/**
 * 运营管理大盘
 *
 * 业务职责：平台级运营总览，含 KPI 卡片、全国生产分布、近 7 天趋势、
 * 平台告警中心与待办审批事项。所有区块只消费后端真实返回的数据，
 * 缺失的区块展示空态，不做本地兜底。
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

  /** 核心指标（/admin/dashboard/overview） */
  const metricsQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'metrics'],
    queryFn: () => getOpsDashboard(),
    retry: false,
  })

  /** 主体概览（/admin/tenants/overview，提供真实主体数） */
  const overviewQuery = useQuery({
    queryKey: ['admin', 'tenants', 'overview'],
    queryFn: () => getTenantOverview(),
    retry: false,
  })

  /** 区域分布（后端当前无此端点） */
  const regionQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'regions'],
    queryFn: () => fetchRegionStats(),
    retry: false,
  })

  /** 近 7 天趋势（后端当前无此端点） */
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

  /** KPI 卡片数据：全部取自后端真实返回的字段，缺项展示「—」 */
  const kpiItems: KpiItem[] = useMemo<KpiItem[]>(() => {
    const dash = metricsQuery.data as unknown as Record<string, unknown> | undefined
    const overview = overviewQuery.data
    return [
      {
        key: 'activeTenants',
        title: '活跃主体',
        value: overview ? Number(overview.activeTenantCount) : null,
        suffix: '家',
        precision: 0,
      },
      {
        key: 'farmCount',
        title: '农场总数',
        value: pickNumber(dash, 'farmCount'),
        suffix: '个',
        precision: 0,
      },
      {
        key: 'deviceOnline',
        title: '在线设备',
        value: pickNumber(dash, 'deviceOnline'),
        suffix: '台',
        precision: 0,
      },
      {
        key: 'taskPending',
        title: '未完成农事任务',
        value: pickNumber(dash, 'taskPending'),
        suffix: '条',
        precision: 0,
      },
      {
        key: 'alertPending',
        title: '待处理告警',
        value: pickNumber(dash, 'alertPending'),
        suffix: '条',
        precision: 0,
      },
    ]
  }, [metricsQuery.data, overviewQuery.data])

  /** 趋势数据：后端无此端点时为空数组，由页面渲染空态 */
  const trendPoints: TrendPoint[] = useMemo<TrendPoint[]>(
    () => (trendQuery.data ?? []).map((item) => ({
      label: item.label,
      taskRate: Number(item.taskRate) || 0,
      activeWorkers: Number(item.activeWorkers) || 0,
      alertCount: Number(item.alertCount) || 0,
    })),
    [trendQuery.data],
  )

  /** 区域分布数据：后端无此端点时为空数组，由页面渲染空态 */
  const regionStats: RegionStatItem[] = useMemo<RegionStatItem[]>(
    () =>
      (regionQuery.data ?? []).map((item) => ({
        region: item.region,
        farmCount: Number(item.farmCount) || 0,
        fieldArea: Number(item.fieldArea) || 0,
        tenantCount: Number(item.tenantCount) || 0,
        activityLevel: item.activityLevel,
      })),
    [regionQuery.data],
  )

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

  /**
   * 告警级别计数：紧急 / 重要 / 一般；后端未返回时为 null（展示「—」）。
   *
   * 键名兼容见 {@link pickNumberAny}：迁移前是 `CRITICAL / WARN / INFO`，
   * 迁移后是 `important / normal / info`，两套都认。
   *
   * ⚠️ `URGENT / urgent` 这一档**没有并入「紧急」**：旧端点实测只返回
   * `INFO / WARN / CRITICAL`（DB 里另有 3 条 URGENT 未计入），页面也只有三个卡片位，
   * 硬塞进去会在迁移落地那天悄悄改掉「紧急」的口径。是否新增第四个卡位
   * 由 team-lead 裁决，本批不擅自扩大口径。
   */
  const alertLevelCounts = useMemo<{ critical: number | null; warn: number | null; info: number | null }>(() => {
    const raw = alertLevelQuery.data
    const critical = pickNumberAny(raw, ['CRITICAL', 'important'])
    const warn = pickNumberAny(raw, ['WARN', 'normal'])
    const info = pickNumberAny(raw, ['INFO', 'info'])
    return { critical, warn, info }
  }, [alertLevelQuery.data])

  /** 告警列表：只用后端返回数据，无数据时为空（渲染空态） */
  const alertItems = useMemo<AlertItem[]>(() => {
    const remote: AlertItem0[] | undefined = alertsQuery.data?.list
    if (!remote || remote.length === 0) {
      return []
    }
    return remote.map((item) => ({
      id: item.alertId,
      title: item.alertTitle,
      content: item.alertContent,
      level: item.alertLevel >= 3 ? '紧急' : item.alertLevel === 2 ? '重要' : '一般',
      relativeTime: item.triggeredAt?.slice(11, 16) ?? '--:--',
      target: item.plotName ?? item.farmId ?? '—',
    }))
  }, [alertsQuery.data])

  /** 待办审批列表：只用后端返回数据，无数据时为空（渲染空态） */
  const approvalItems = useMemo<ApprovalItem[]>(() => {
    const remote = approvalsQuery.data?.list
    if (!remote || remote.length === 0) {
      return []
    }
    return remote.slice(0, 5).map((item) => ({
      id: item.approvalId,
      no: item.approvalNo,
      type: ['农场入驻', '计划变更', '投入品采购', '质量复检', '数据更正'][item.approvalType - 1] ?? '其他',
      target: item.bizSummary ?? item.tenantName ?? '—',
      applicant: item.applicantName,
      submitTime: item.submittedAt?.slice(11, 16) ?? '--:--',
      // 后端审批表无优先级字段，不展示编造的优先级
      priority: '—',
    }))
  }, [approvalsQuery.data])

  /** 后端缺失的区块端点清单（用于统一降级提示） */
  const unavailableBlocks = useMemo<string[]>(() => {
    const blocks: string[] = []
    if (trendQuery.isError) {
      blocks.push('近7天趋势：GET /admin/dashboard/trend 后端未实现（实测返回 500）')
    }
    if (regionQuery.isError) {
      blocks.push('全国生产分布：GET /admin/dashboard/region-distribution 后端未实现（实测返回 500）')
    }
    if (alertLevelQuery.isError) {
      blocks.push('告警级别分布（GET /admin/dashboard/alert-trend 不可用）')
    }
    if (metricsQuery.isError) {
      blocks.push('KPI 汇总（GET /admin/dashboard/overview 不可用）')
    }
    if (overviewQuery.isError) {
      blocks.push('主体概览（GET /admin/tenants/overview 不可用）')
    }
    if (rankQuery.isError) {
      blocks.push('种植面积排行（GET /admin/dashboard/rank 不可用）')
    }
    if (alertsQuery.isError) {
      blocks.push('告警列表（GET /admin/alerts 不可用）')
    }
    if (approvalsQuery.isError) {
      blocks.push('待办审批（GET /admin/approvals 不可用）')
    }
    return blocks
  }, [
    trendQuery.isError,
    regionQuery.isError,
    alertLevelQuery.isError,
    metricsQuery.isError,
    overviewQuery.isError,
    rankQuery.isError,
    alertsQuery.isError,
    approvalsQuery.isError,
  ])

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
      legend: { data: ['任务完成率', '作业人数', '告警数'], top: 0 },
      xAxis: { type: 'category', boundaryGap: false, data: trendPoints.map((item) => item.label) },
      yAxis: [
        { type: 'value', name: '作业/告警' },
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
          name: '作业人数',
          smooth: true,
          // 口径：当日有作业记录的不同人数（非登录活跃用户 / DAU）
          data: trendPoints.map((item) => item.activeWorkers),
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

  /** 后端不可用区块的统一空态文案 */
  const emptyBlock = (label: string): JSX.Element => (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<Text type="secondary">{label}：后端暂未提供该数据，此处不用原型示例数据兜底</Text>}
      />
    </div>
  )

  return (
    <div>
      {/* 顶部标题栏 + 自动刷新 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            运营管理大盘
          </Title>
          <Text type="secondary">
            数据均取自后端真实接口；后端未提供的指标展示「—」或未展示对应区块
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

      {/* 缺失端点必须让用户看见：明确列出哪些区块没有真实数据源 */}
      {unavailableBlocks.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`以下 ${unavailableBlocks.length} 个区块暂无后端数据源，已展示空态（不用示例数据填充）`}
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {unavailableBlocks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          }
        />
      )}

      {/* KPI 卡片区：只渲染后端有数据源的指标 */}
      <Row gutter={[12, 12]}>
        {kpiItems.map((item) => (
          <Col key={item.key} xs={24} sm={12} md={8} lg={6} xl={4}>
            <Card size="small" styles={{ body: { padding: 16 } }}>
              {metricsQuery.isLoading || overviewQuery.isLoading ? (
                <Skeleton active title={false} paragraph={{ rows: 2 }} />
              ) : (
                <Statistic
                  title={item.title}
                  value={item.value === null ? '—' : item.value}
                  precision={item.precision}
                  suffix={item.value === null ? undefined : item.suffix}
                  formatter={(value) =>
                    typeof value === 'number' ? Number(value).toLocaleString('zh-CN') : String(value)
                  }
                />
              )}
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
            ) : regionStats.length === 0 ? (
              emptyBlock('全国生产分布')
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
                                农场 {item.farmCount} · 主体 {item.tenantCount}
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
            extra={
              <Text type="secondary">
                任务完成率 / 作业人数（当日有作业记录的人数，非登录活跃用户）/ 告警数
              </Text>
            }
          >
            {trendQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : trendPoints.length === 0 ? (
              emptyBlock('近7天趋势')
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
                <Tag color="red">紧急 {alertLevelCounts.critical ?? '—'}</Tag>
              </Col>
              <Col span={8}>
                <Tag color="orange">重要 {alertLevelCounts.warn ?? '—'}</Tag>
              </Col>
              <Col span={8}>
                <Tag color="blue">一般 {alertLevelCounts.info ?? '—'}</Tag>
              </Col>
            </Row>
            {alertsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : alertItems.length === 0 ? (
              <Empty description="暂无告警（后端未返回告警数据）" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
              <Empty description="暂无待办审批（后端未返回待审数据）" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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

      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        数据说明：KPI 取自 `GET /admin/dashboard/overview` 与 `GET /admin/tenants/overview` 的真实返回值；
        「在田面积」与「溯源查询次数」后端无对应聚合字段，已从 KPI 中移除；
        「较昨日涨跌」后端无同比数据源，已不再展示。
        后端缺失的区块展示空态而非示例数据。
      </Text>

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
              <Col span={24}>关联对象：{activeAlert.target}</Col>
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
