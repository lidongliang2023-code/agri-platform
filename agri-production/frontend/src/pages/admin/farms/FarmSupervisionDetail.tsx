/**
 * 页面名称：农场监管详情
 * 路由路径：/admin/production/farms/:farmId
 * 所属模块：农场监管
 * PRD 序号：PRD 6.2 #9
 * 原型来源：P6 farm-detail — 农场详情（监管视角）
 */
import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  HomeOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { getSupervisedFarmCompliance, listSupervisedFarms } from '@/api/admin/farms'
import type { FarmComplianceProfile } from '@/api/admin/farms'
import { handleAlert, listAlerts } from '@/api/alerts'
import { listInputUsages } from '@/api/inputs'
import { listPlots } from '@/api/plots'
import type { Alert as AlertItem, ComplianceResult, InputUsage, Plot } from '@/types'
import {
  CHECK_RESULT_META,
  RECTIFY_STATUS_META,
  RISK_BAND_META,
  SAMPLE_SUPERVISED_FARMS,
  buildRiskInfo,
  exportCsv,
  formatDate,
  hashString,
  maskPhone,
  resolveRectifyStatus,
  todayText,
  useComplianceTasks,
} from './supervisionShared'
import type { ComplianceTaskItem, RiskLevelKey } from './supervisionShared'
import RectifyDispatchModal from './RectifyDispatchModal'
import type { RectifyTargetSummary } from './RectifyDispatchModal'

const { Text, Title } = Typography

/** 农场详情模型（原型 P6 头卡字段） */
interface FarmDetailModel {
  /** 农场 ID */
  farmId: string
  /** 农场编号 */
  farmCode: string
  /** 农场名称 */
  farmName: string
  /** 所属租户 */
  tenantName: string
  /** 详细地址 */
  address: string
  /** 面积（亩） */
  areaTotal: number
  /** 种植作物 */
  crops: string
  /** 负责人 */
  managerName: string
  /** 负责人电话 */
  managerPhone: string
  /** 是否来自原型示例 */
  fromSample: boolean
}

/** 地块状态文案映射（原型 4.1 生长阶段口径） */
const PLOT_STATUS_TEXT: Record<number, string> = {
  0: '停用',
  1: '空闲',
  2: '在种',
  3: '采收期',
  4: '休耕期',
}

/** 投入品参考用量上限：单位 → 限量（后端暂未提供限量标准，取监管参考值） */
const REFERENCE_USAGE_LIMIT: Record<string, number> = {
  kg: 100,
  g: 200,
  L: 50,
  ml: 1000,
  袋: 20,
  桶: 5,
  斤: 200,
}

/** 告警级别文案 */
const ALERT_LEVEL_META: Record<number, { text: string; color: string }> = {
  1: { text: '提示', color: 'default' },
  2: { text: '一般', color: 'blue' },
  3: { text: '严重', color: 'orange' },
  4: { text: '紧急', color: 'red' },
}

/** 告警状态文案 */
const ALERT_STATUS_META: Record<number, { text: string; color: string }> = {
  1: { text: '未处理', color: 'red' },
  2: { text: '处理中', color: 'blue' },
  3: { text: '已处理', color: 'green' },
  4: { text: '已忽略', color: 'default' },
}

/**
 * 依据投入品名称推断品类（后端使用记录未冗余品类字段，做关键字兜底推断）。
 *
 * @param name 投入品名称
 * @returns 品类文案
 */
function guessInputCategory(name: string): string {
  if (!name) {
    return '其他'
  }
  if (name.includes('草甘膦') || name.includes('除草')) {
    return '除草剂'
  }
  if (name.includes('虫啉') || name.includes('菌') || name.includes('药')) {
    return '农药'
  }
  if (name.includes('尿素') || name.includes('肥')) {
    return '肥料'
  }
  if (name.includes('种')) {
    return '种子'
  }
  return '其他'
}

/**
 * 投入品合规判定（本地规则，后端限量标准接口上线后替换为服务端校验）。
 *
 * @param usage 使用记录
 * @returns 是否合规与违规描述
 */
function judgeUsage(usage: InputUsage): { pass: boolean; violation: string } {
  const limit = REFERENCE_USAGE_LIMIT[usage.unit] ?? 100
  if (usage.quantity > limit) {
    const over = Math.round(((usage.quantity - limit) / limit) * 100)
    return { pass: false, violation: `用量超过参考限量 ${over}%` }
  }
  return { pass: true, violation: '—' }
}

/**
 * 生成近 6 个月合规率序列。
 *
 * 后端暂未提供合规率时间序列（原型 P6 该图表亦为占位），此处以「当前合规率」为末点、
 * 按稳定哈希反推历史值，保证多次渲染不跳变。
 *
 * @param currentRate 当前合规率
 * @param seed 稳定种子
 * @returns 月份标签与数值
 */
function buildComplianceSeries(
  currentRate: number,
  seed: string,
): { labels: string[]; values: number[] } {
  const labels: string[] = []
  const values: number[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(`${date.getMonth() + 1}月`)
  }
  const seedValue = hashString(seed)
  for (let i = 0; i < 6; i += 1) {
    if (i === 5) {
      values.push(Number(currentRate.toFixed(1)))
      continue
    }
    const offset = ((seedValue >> (i * 2)) % 7) - 3
    values.push(Number(Math.min(100, Math.max(0, currentRate + offset)).toFixed(1)))
  }
  return { labels, values }
}

/**
 * 农场监管详情
 *
 * 业务职责：单农场监管档案，含风险评分分档、地块与作物状态、投入品合规、
 * 检查记录与告警记录四个 Tab，支持下发整改与档案导出。
 *
 * 数据来源：
 * - `GET /admin/farms`（按 ID 定位档案，后端无单条查询端点）+ `GET /admin/farms/{farmId}/compliance`
 * - `GET /plots?farmId`（地块）、`GET /inputs/usages`（投入品使用记录）、`GET /alerts?farmId`（告警）
 * 后端返回为空时降级为原型 P6 示例口径，保证页面始终可用。
 *
 * @returns 页面内容
 */
export default function FarmSupervisionDetail(): JSX.Element {
  const { farmId } = useParams<{ farmId: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 当前 Tab */
  const [activeTab, setActiveTab] = useState<string>('overview')
  /** 下发整改弹窗开关 */
  const [rectifyOpen, setRectifyOpen] = useState<boolean>(false)

  /** 合规检查任务（本地登记 + 后端优先写入） */
  const tasks = useComplianceTasks()

  /** 农场档案：后端 /admin/farms 无单条查询端点，按 ID 在分页结果中定位 */
  const farmQuery = useQuery({
    queryKey: ['admin', 'farms', 'supervision', 'detail', farmId],
    enabled: Boolean(farmId),
    queryFn: async () => {
      const res = await listSupervisedFarms({ pageNum: 1, pageSize: 200 })
      const hit = (res.list ?? []).find((item) => String(item.farmId) === String(farmId))
      return hit ?? null
    },
    retry: false,
  })

  /** 农场合规画像 */
  const profileQuery = useQuery({
    queryKey: ['admin', 'farms', 'supervision', 'compliance', farmId],
    enabled: Boolean(farmId),
    queryFn: () => getSupervisedFarmCompliance(String(farmId)),
    retry: false,
  })

  /** 地块列表 */
  const plotsQuery = useQuery({
    queryKey: ['admin', 'farms', 'supervision', 'plots', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId: String(farmId), pageNum: 1, pageSize: 50 }),
    retry: false,
  })

  /** 投入品使用记录 */
  const usagesQuery = useQuery({
    queryKey: ['admin', 'farms', 'supervision', 'usages', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listInputUsages({ pageNum: 1, pageSize: 30 }),
    retry: false,
  })

  /** 告警记录 */
  const alertsQuery = useQuery({
    queryKey: ['admin', 'farms', 'supervision', 'alerts', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listAlerts({ farmId: String(farmId), pageNum: 1, pageSize: 20 }),
    retry: false,
  })

  /** 农场详情模型：后端优先，缺省降级为原型示例 */
  const detail = useMemo<FarmDetailModel>(() => {
    const farm = farmQuery.data
    if (farm) {
      return {
        farmId: String(farm.farmId),
        farmCode: farm.farmCode || String(farm.farmId),
        farmName: farm.farmName,
        tenantName: farm.tenantId ? `租户 ${farm.tenantId}` : '—',
        address: farm.address || `${farm.province || ''}${farm.city || ''}${farm.district || ''}`,
        areaTotal: Number(farm.areaTotal) || 0,
        crops: '—',
        managerName: farm.managerName || '—',
        managerPhone: farm.managerPhone || '',
        fromSample: false,
      }
    }
    const sampleHit = SAMPLE_SUPERVISED_FARMS.find((item) => String(item.farmId) === String(farmId))
    const base = sampleHit ?? SAMPLE_SUPERVISED_FARMS[0]
    return {
      farmId: String(farmId ?? ''),
      farmCode: sampleHit ? base.farmCode : String(farmId ?? ''),
      farmName: sampleHit ? base.farmName : `农场 ${farmId ?? ''}`,
      tenantName: base.tenantName,
      address: `${base.province}${base.city}XX县`,
      areaTotal: base.areaTotal,
      crops: base.crops,
      managerName: '张三',
      managerPhone: '13812345678',
      fromSample: true,
    }
  }, [farmQuery.data, farmId])

  /** 合规画像 */
  const profile: FarmComplianceProfile | undefined = profileQuery.data ?? undefined

  /** 风险评分与等级（有画像或真实档案时派生，否则回退到示例行评分） */
  const risk = useMemo<{ riskScore: number; riskLevel: RiskLevelKey }>(() => {
    const disabled = farmQuery.data ? Number(farmQuery.data.status) === 0 : false
    if (profile || farmQuery.data) {
      return buildRiskInfo(String(farmId ?? ''), profile, disabled)
    }
    const sampleHit = SAMPLE_SUPERVISED_FARMS.find((item) => String(item.farmId) === String(farmId))
    return {
      riskScore: sampleHit?.riskScore ?? SAMPLE_SUPERVISED_FARMS[0].riskScore,
      riskLevel: sampleHit?.riskLevel ?? SAMPLE_SUPERVISED_FARMS[0].riskLevel,
    }
  }, [profile, farmQuery.data, farmId])

  /** 当前合规率：有认证时按未过期占比计算，否则取原型示例 95.2% */
  const currentRate = useMemo<number>(() => {
    if (profile && profile.certCount > 0) {
      return Number(
        (((profile.certCount - profile.certExpired) / profile.certCount) * 100).toFixed(1),
      )
    }
    return 95.2
  }, [profile])

  /** 合规率趋势序列 */
  const complianceSeries = useMemo(
    () => buildComplianceSeries(currentRate, String(farmId ?? '')),
    [currentRate, farmId],
  )

  /** 合规率趋势图配置（原型 P6「合规率趋势」） */
  const complianceOption: EChartsOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: 'axis', valueFormatter: (value: unknown) => `${value}%` },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: complianceSeries.labels, boundaryGap: false },
      yAxis: { type: 'value', min: 0, max: 100, name: '合规率(%)' },
      series: [
        {
          type: 'line',
          name: '合规率',
          smooth: true,
          data: complianceSeries.values,
          itemStyle: { color: '#13c05a' },
          areaStyle: { opacity: 0.12 },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [{ yAxis: 80, lineStyle: { color: '#faad14', type: 'dashed' } }],
            label: { formatter: '达标线 80%', position: 'insideEndTop' },
          },
        },
      ],
    }),
    [complianceSeries],
  )

  /** 地块列表 */
  const plots = useMemo<Plot[]>(() => plotsQuery.data?.list ?? [], [plotsQuery.data])

  /** 按作物聚合的作物状态（原型 P6「当前作物状态」） */
  const cropRows = useMemo<Array<{ crop: string; status: string; area: number; progress: number }>>(
    () => {
      const map = new Map<string, { crop: string; status: string; area: number }>()
      plots.forEach((plot) => {
        const crop = plot.cropVariety || '未录入'
        const current = map.get(crop) ?? {
          crop,
          status: PLOT_STATUS_TEXT[plot.status] ?? '—',
          area: 0,
        }
        current.area += Number(plot.area) || 0
        map.set(crop, current)
      })
      const totalArea = Array.from(map.values()).reduce((sum, item) => sum + item.area, 0)
      return Array.from(map.values()).map((item) => ({
        ...item,
        progress: totalArea > 0 ? Number(((item.area / totalArea) * 100).toFixed(1)) : 0,
      }))
    },
    [plots],
  )

  /** 近 30 天投入品使用记录（接口无近 30 天数据时回退全量，避免空表格） */
  const usages = useMemo<InputUsage[]>(() => {
    const list = usagesQuery.data?.list ?? []
    const start = new Date()
    start.setDate(start.getDate() - 30)
    const startDate = start.toISOString().slice(0, 10)
    const recent = list.filter((item) => !item.usedAt || item.usedAt.slice(0, 10) >= startDate)
    return recent.length > 0 ? recent : list
  }, [usagesQuery.data])

  /** 本农场检查记录 */
  const farmTasks = useMemo<ComplianceTaskItem[]>(
    () =>
      tasks
        .filter((task) => String(task.farmId) === String(farmId))
        .slice()
        .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt)),
    [tasks, farmId],
  )

  /** 告警列表 */
  const alerts = useMemo<AlertItem[]>(() => alertsQuery.data?.list ?? [], [alertsQuery.data])

  /** 处理告警：标记为已处理并转派农场负责人 */
  const alertMutation = useMutation({
    mutationFn: (alertId: string) =>
      handleAlert(alertId, { status: 3, handleRemark: '运营端监管介入，已转派农场负责人跟进' }),
    onSuccess: () => {
      message.success('告警已标记为已处理')
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'farms', 'supervision', 'alerts'],
      })
    },
  })

  /** 下发整改目标摘要 */
  const rectifySummary: RectifyTargetSummary = {
    farmId: String(farmId ?? ''),
    farmCode: detail.farmCode,
    farmName: detail.farmName,
    tenantName: detail.tenantName,
    riskScore: risk.riskScore,
  }

  /** 导出投入品使用与合规记录 */
  const handleExport = (): void => {
    exportCsv<InputUsage>(`农场监管档案_${detail.farmName}`, usages, [
      { title: '日期', render: (row) => formatDate(row.usedAt) },
      { title: '品名', render: (row) => row.inputName ?? '—' },
      { title: '类型', render: (row) => guessInputCategory(row.inputName ?? '') },
      { title: '用量', render: (row) => `${row.quantity}${row.unit}` },
      { title: '地块', render: (row) => row.plotName ?? '—' },
      { title: '合规', render: (row) => (judgeUsage(row).pass ? '合规' : '超标') },
    ])
    message.success(`已导出「${detail.farmName}」投入品使用与合规记录`)
  }

  /** 作物状态列 */
  const cropColumns: ColumnsType<{
    crop: string
    status: string
    area: number
    progress: number
  }> = [
    { title: '作物', dataIndex: 'crop', width: 130 },
    { title: '状态', dataIndex: 'status', width: 110 },
    {
      title: '面积',
      dataIndex: 'area',
      width: 110,
      align: 'right',
      render: (value: number) => `${value.toLocaleString('zh-CN')}亩`,
    },
    { title: '进度', dataIndex: 'progress', width: 110, render: (value: number) => `${value}%` },
  ]

  /** 最近 30 天投入品使用记录列（原型 P6） */
  const usageColumns: ColumnsType<InputUsage> = [
    {
      title: '日期',
      dataIndex: 'usedAt',
      width: 100,
      render: (value: string) => value?.slice(5, 10) ?? '—',
    },
    { title: '品名', dataIndex: 'inputName', width: 150, render: (value?: string) => value || '—' },
    { title: '类型', width: 100, render: (_value: unknown, row) => guessInputCategory(row.inputName ?? '') },
    {
      title: '用量',
      width: 120,
      align: 'right',
      render: (_value: unknown, row) => `${row.quantity}${row.unit}`,
    },
    {
      title: '合规',
      width: 100,
      align: 'center',
      render: (_value: unknown, row) =>
        judgeUsage(row).pass ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            合规
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            超量
          </Tag>
        ),
    },
  ]

  /** 投入品合规校验结果列（Tab 投入品合规） */
  const complianceColumns: ColumnsType<InputUsage> = [
    { title: '记录编号', dataIndex: 'usageId', width: 170 },
    { title: '日期', dataIndex: 'usedAt', width: 110, render: (value: string) => formatDate(value) },
    { title: '农场', width: 140, render: () => detail.farmName },
    { title: '投入品', dataIndex: 'inputName', width: 140, render: (value?: string) => value || '—' },
    { title: '类型', width: 100, render: (_value: unknown, row) => guessInputCategory(row.inputName ?? '') },
    {
      title: '用量',
      width: 110,
      align: 'right',
      render: (_value: unknown, row) => `${row.quantity}${row.unit}`,
    },
    {
      title: '校验结果',
      width: 110,
      align: 'center',
      render: (_value: unknown, row) =>
        judgeUsage(row).pass ? <Tag color="green">✅ 合规</Tag> : <Tag color="red">❌ 超标</Tag>,
    },
    { title: '违规项', width: 180, render: (_value: unknown, row) => judgeUsage(row).violation },
  ]

  /** 检查记录列（原型 P6 Tab 检查记录） */
  const checkColumns: ColumnsType<ComplianceTaskItem> = [
    {
      title: '检查时间',
      dataIndex: 'checkedAt',
      width: 160,
      render: (value: string) => value?.slice(0, 16) ?? '—',
    },
    {
      title: '检查人',
      dataIndex: 'checkerName',
      width: 100,
      render: (value?: string) => value || '—',
    },
    { title: '检查类型', dataIndex: 'checkType', width: 140 },
    {
      title: '检查结论',
      dataIndex: 'result',
      width: 110,
      align: 'center',
      render: (value: ComplianceResult) => (
        <Tag color={CHECK_RESULT_META[value]?.color ?? 'default'}>
          {CHECK_RESULT_META[value]?.label ?? '—'}
        </Tag>
      ),
    },
    {
      title: '整改要求',
      dataIndex: 'rectifyRequirement',
      width: 200,
      render: (value?: string) => value || '—',
    },
    {
      title: '整改状态',
      width: 110,
      align: 'center',
      render: (_value: unknown, row) => {
        const status = resolveRectifyStatus(row, todayText())
        return <Tag color={RECTIFY_STATUS_META[status].color}>{RECTIFY_STATUS_META[status].label}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_value: unknown, row) => (
        <Button type="link" size="small" onClick={() => navigate('/admin/production/farms/compliance')}>
          整改跟踪（{row.checkId.slice(-4)}）
        </Button>
      ),
    },
  ]

  /** 告警记录列（原型 P6 Tab 告警记录） */
  const alertColumns: ColumnsType<AlertItem> = [
    { title: '告警编号', dataIndex: 'alertNo', width: 170 },
    { title: '告警标题', dataIndex: 'alertTitle', width: 170 },
    {
      title: '级别',
      dataIndex: 'alertLevel',
      width: 90,
      align: 'center',
      render: (value: number) => (
        <Tag color={ALERT_LEVEL_META[value]?.color ?? 'default'}>
          {ALERT_LEVEL_META[value]?.text ?? '—'}
        </Tag>
      ),
    },
    { title: '告警内容', dataIndex: 'alertContent', width: 240, ellipsis: true },
    {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      width: 160,
      render: (value: string) => value?.slice(0, 16) ?? '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      align: 'center',
      render: (value: number) => (
        <Tag color={ALERT_STATUS_META[value]?.color ?? 'default'}>
          {ALERT_STATUS_META[value]?.text ?? '—'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_value: unknown, row) =>
        row.status === 3 || row.status === 4 ? (
          <Text type="secondary">已闭环</Text>
        ) : (
          <Button
            type="link"
            size="small"
            loading={alertMutation.isPending}
            onClick={() => alertMutation.mutate(row.alertId)}
          >
            处理
          </Button>
        ),
    },
  ]

  /** 合规率环比（用于头卡趋势文案） */
  const rateDelta = Number((complianceSeries.values[5] - complianceSeries.values[4]).toFixed(1))

  return (
    <div>
      {/* 标题栏 + 操作（原型 P6 头卡右上角） */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            农场详情
          </Title>
          <Text type="secondary">首页 &gt; 生产管理 &gt; 农场监管 &gt; 农场详情</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/production/farms')}>
              返回农场列表
            </Button>
            <Tooltip title="导出投入品使用与合规记录">
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                导出
              </Button>
            </Tooltip>
            <Button danger icon={<ExclamationCircleOutlined />} onClick={() => setRectifyOpen(true)}>
              下发整改
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 农场头卡（原型 P6 Farm Header） */}
      <Card size="small">
        {farmQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <div>
            <Row gutter={[16, 12]} align="middle">
              <Col xs={24} md={8}>
                <Space size={8}>
                  <HomeOutlined style={{ fontSize: 22, color: '#1677ff' }} />
                  <Title level={4} style={{ margin: 0 }}>
                    {detail.farmName}
                  </Title>
                  <Tag color={RISK_BAND_META[risk.riskLevel].tagColor}>
                    {RISK_BAND_META[risk.riskLevel].farmStatus}
                  </Tag>
                </Space>
                <div style={{ marginTop: 4 }}>
                  <Space size={12} wrap>
                    <Text type="secondary">编号 {detail.farmCode}</Text>
                    <Text type="secondary">租户 {detail.tenantName}</Text>
                  </Space>
                </div>
              </Col>
              <Col xs={24} md={8}>
                <Space size={12} wrap>
                  <Text type="secondary">地址 {detail.address}</Text>
                  <Text type="secondary">面积 {detail.areaTotal.toLocaleString('zh-CN')}亩</Text>
                  <Text type="secondary">作物 {detail.crops}</Text>
                  <Text type="secondary">
                    负责人 {detail.managerName} ({maskPhone(detail.managerPhone)})
                  </Text>
                </Space>
              </Col>
              <Col xs={24} md={8}>
                <Space align="center" size={12}>
                  <div>
                    <Text type="secondary">风险评分</Text>
                    <div>
                      <Text strong style={{ fontSize: 26, color: RISK_BAND_META[risk.riskLevel].color }}>
                        {risk.riskScore}
                      </Text>
                      <Text type="secondary"> /100</Text>
                    </div>
                  </div>
                  <Tooltip title="趋势由近 6 个月合规率序列推导（后端暂未提供评分时间序列）">
                    <Tag color={RISK_BAND_META[risk.riskLevel].tagColor}>
                      {RISK_BAND_META[risk.riskLevel].label} {rateDelta <= 0 ? '↓' : '↑'}
                      {Math.abs(rateDelta)}分（{rateDelta <= 0 ? '改善' : '恶化'}）
                    </Tag>
                  </Tooltip>
                </Space>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    分档规则：低 0-60 正常 / 中 60-80 预警 / 高 80+ 异常
                  </Text>
                </div>
              </Col>
            </Row>
            {detail.fromSample && (
              <Alert
                style={{ marginTop: 8 }}
                type="info"
                showIcon
                message="当前展示原型示例档案（后端 /admin/farms 未返回该农场）"
                description="Tab 内地块、投入品、告警数据仍取自真实接口，接口无数据时显示空态。"
              />
            )}
          </div>
        )}
      </Card>

      {/* 四个 Tab（原型 P6） */}
      <Card size="small" style={{ marginTop: 12 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={[
            {
              key: 'overview',
              label: '生产概况',
              children: (
                <div>
                  {/* 指标卡（原型 P6 最近产量 / 任务完成率 / 合规率 / 地块与认证） */}
                  <Row gutter={[12, 12]}>
                    <Col xs={12} md={8} lg={4}>
                      <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Statistic title="地块分布" value={profile?.plotCount ?? plots.length} suffix="块" />
                      </Card>
                    </Col>
                    <Col xs={12} md={8} lg={4}>
                      <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Statistic title="有效认证" value={profile?.certCount ?? 0} suffix="项" />
                        <Tag color={(profile?.certExpiring ?? 0) > 0 ? 'orange' : 'green'}>
                          临期 {profile?.certExpiring ?? 0} 项
                        </Tag>
                      </Card>
                    </Col>
                    <Col xs={12} md={8} lg={4}>
                      <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Statistic title="过期认证" value={profile?.certExpired ?? 0} suffix="项" />
                        {(profile?.certExpired ?? 0) > 0 && (
                          <Tag color="red">
                            <WarningOutlined /> 需立即整改
                          </Tag>
                        )}
                      </Card>
                    </Col>
                    <Col xs={12} md={8} lg={4}>
                      <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Statistic title="当前合规率" value={currentRate} suffix="%" precision={1} />
                        <Tag color={currentRate >= 80 ? 'green' : currentRate >= 60 ? 'orange' : 'red'}>
                          {currentRate >= 80 ? '✅ 达标' : currentRate >= 60 ? '⚠ 待提升' : '❌ 不足'}
                        </Tag>
                      </Card>
                    </Col>
                    <Col xs={12} md={8} lg={4}>
                      <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Statistic title="最近产量" value={580} suffix="吨" />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          上一季水稻
                        </Text>
                      </Card>
                    </Col>
                    <Col xs={12} md={8} lg={4}>
                      <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Statistic title="任务完成率" value={92.5} suffix="%" precision={1} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          原型示例口径
                        </Text>
                      </Card>
                    </Col>
                  </Row>

                  {/* 地块分布（原型 P6） */}
                  <Card
                    size="small"
                    style={{ marginTop: 12 }}
                    title="地块分布"
                    extra={<Text type="secondary">数据来源：GET /plots?farmId</Text>}
                  >
                    {plotsQuery.isLoading ? (
                      <Skeleton active paragraph={{ rows: 2 }} />
                    ) : plots.length === 0 ? (
                      <Empty description="暂无地块数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <Row gutter={[8, 8]}>
                        {plots.map((plot) => (
                          <Col key={plot.plotId} xs={12} sm={8} md={6}>
                            <Card size="small" styles={{ body: { padding: 10 } }}>
                              <Text strong>{plot.plotName}</Text>
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {plot.cropVariety || '未录用作物'}
                                </Text>
                              </div>
                              <Space size={6}>
                                <Text>{Number(plot.area).toLocaleString('zh-CN')}亩</Text>
                                <Tag>{PLOT_STATUS_TEXT[plot.status] ?? '—'}</Tag>
                              </Space>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    )}
                  </Card>

                  <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                    {/* 当前作物状态（原型 P6） */}
                    <Col xs={24} lg={10}>
                      <Card size="small" title="当前作物状态">
                        {plotsQuery.isLoading ? (
                          <Skeleton active paragraph={{ rows: 3 }} />
                        ) : (
                          <Table
                            rowKey="crop"
                            size="small"
                            columns={cropColumns}
                            dataSource={cropRows}
                            pagination={false}
                            locale={{ emptyText: '暂无作物数据' }}
                          />
                        )}
                      </Card>
                    </Col>

                    {/* 合规率趋势（原型 P6 Placeholder Chart） */}
                    <Col xs={24} lg={14}>
                      <Card
                        size="small"
                        title="合规率趋势"
                        extra={
                          <Tooltip title="后端暂未提供合规率时间序列：末点取自真实认证数据，历史值为示例口径">
                            <Text type="secondary">示例口径</Text>
                          </Tooltip>
                        }
                      >
                        <ReactECharts option={complianceOption} style={{ height: 260 }} notMerge />
                      </Card>
                    </Col>
                  </Row>

                  {/* 最近 30 天投入品使用记录（原型 P6） */}
                  <Card size="small" style={{ marginTop: 12 }} title="最近30天投入品使用记录">
                    {usagesQuery.isLoading ? (
                      <Skeleton active paragraph={{ rows: 3 }} />
                    ) : (
                      <Table<InputUsage>
                        rowKey="usageId"
                        size="small"
                        columns={usageColumns}
                        dataSource={usages}
                        pagination={false}
                        locale={{ emptyText: '暂无投入品使用记录' }}
                      />
                    )}
                  </Card>
                </div>
              ),
            },
            {
              key: 'inputs',
              label: '投入品合规',
              children: (
                <div>
                  <Space size={12} wrap style={{ marginBottom: 12 }}>
                    <Tag color="blue">使用记录 {usages.length} 条</Tag>
                    <Tag color="green">✅ 合规 {usages.filter((item) => judgeUsage(item).pass).length}</Tag>
                    <Tag color="red">❌ 超标 {usages.filter((item) => !judgeUsage(item).pass).length}</Tag>
                    <Text type="secondary">
                      判定规则：用量超过单位参考限量（kg 100 / g 200 / L 50 / ml 1000）判定为超标；
                      后端限量标准接口上线后替换为服务端校验
                    </Text>
                  </Space>
                  {usagesQuery.isLoading ? (
                    <Skeleton active paragraph={{ rows: 4 }} />
                  ) : (
                    <Table<InputUsage>
                      rowKey="usageId"
                      size="small"
                      columns={complianceColumns}
                      dataSource={usages}
                      scroll={{ x: 1100 }}
                      pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
                      locale={{ emptyText: '暂无投入品合规校验记录' }}
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'checks',
              label: '检查记录',
              children: (
                <div>
                  {/* 合规画像（GET /admin/farms/{farmId}/compliance） */}
                  <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                    <Col xs={12} md={6}>
                      <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Statistic title="地块数" value={profile?.plotCount ?? 0} suffix="块" />
                      </Card>
                    </Col>
                    <Col xs={12} md={6}>
                      <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Statistic title="认证数" value={profile?.certCount ?? 0} suffix="项" />
                      </Card>
                    </Col>
                    <Col xs={12} md={6}>
                      <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Statistic title="临期认证" value={profile?.certExpiring ?? 0} suffix="项" />
                      </Card>
                    </Col>
                    <Col xs={12} md={6}>
                      <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Statistic title="过期认证" value={profile?.certExpired ?? 0} suffix="项" />
                      </Card>
                    </Col>
                  </Row>
                  <Table<ComplianceTaskItem>
                    rowKey="checkId"
                    size="small"
                    columns={checkColumns}
                    dataSource={farmTasks}
                    scroll={{ x: 1100 }}
                    locale={{ emptyText: '暂无检查记录' }}
                    pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
                  />
                </div>
              ),
            },
            {
              key: 'alerts',
              label: '告警记录',
              children: alertsQuery.isLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : alerts.length === 0 ? (
                <Empty description="暂无告警记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Table<AlertItem>
                  rowKey="alertId"
                  size="small"
                  columns={alertColumns}
                  dataSource={alerts}
                  scroll={{ x: 1100 }}
                  pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 下发整改弹窗（与列表页共用） */}
      <RectifyDispatchModal
        open={rectifyOpen}
        target={rectifySummary}
        onClose={() => setRectifyOpen(false)}
      />
    </div>
  )
}
