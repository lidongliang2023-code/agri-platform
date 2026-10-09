/**
 * 页面名称：投入品使用监管
 * 路由路径：/admin/production/monitor/inputs
 * 所属模块：生产监控
 * PRD 序号：PRD 6.2 #15（原型无此页，按 PRD 独立设计）
 */
import { useMemo, useState } from 'react'
import {
  Alert as AntAlert,
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Modal,
  Radio,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, HomeOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { listMonitorInputUsages } from '@/api/admin/monitor'

const { Text, Title } = Typography

/** 处置状态：待处理 / 已通知 / 已整改 */
type HandleStatus = 'pending' | 'notified' | 'rectified'

/** 处置状态 → 展示信息 */
const HANDLE_STATUS_META: Record<HandleStatus, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'red' },
  notified: { label: '已通知', color: 'gold' },
  rectified: { label: '已整改', color: 'green' },
}

/** 异常类型 */
type AbnormalType = 'restricted' | 'overdose' | 'interval'

/** 异常类型 → 展示信息 */
const ABNORMAL_TYPE_META: Record<AbnormalType, { label: string; color: string }> = {
  restricted: { label: '禁限用投入品', color: 'red' },
  overdose: { label: '用量超标准', color: 'orange' },
  interval: { label: '安全间隔期违规', color: 'volcano' },
}

/** 异常类型下拉选项 */
const ABNORMAL_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'restricted', label: '禁限用投入品' },
  { value: 'overdose', label: '用量超标准' },
  { value: 'interval', label: '安全间隔期违规' },
]

/** 农场下拉选项 */
const FARM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部' },
  { value: '绿源1号', label: '绿源1号' },
  { value: '丰达A区', label: '丰达A区' },
  { value: '大地南', label: '大地南' },
  { value: '鑫农实验农场', label: '鑫农实验农场' },
  { value: '惠民D区', label: '惠民D区' },
]

/**
 * 监管规则：禁限用投入品清单（农业部禁用/限用农药名录节选）。
 * 说明：后端投入品主数据暂无「是否禁限用」标记，前端以规则表命中判定，
 * 后续后端补齐字段后可直接切换为服务端判定。
 */
const RESTRICTED_INPUTS: string[] = ['氧乐果', '克百威', '甲拌磷', 'XX农药']

/**
 * 监管规则：单位面积标准用量（kg/亩）。
 * 超出即判定为用量异常，用于用量异常分析。
 */
const STD_DOSAGE_MAP: Record<string, number> = {
  '尿素': 15,
  '复合肥': 20,
  'XX农药': 0.8,
  '吡虫啉': 0.5,
  '多菌灵': 1.2,
}

/** 监管预警行 */
interface InputWarningRow {
  /** 预警 ID */
  id: string
  /** 农场 */
  farm: string
  /** 地块 */
  plot: string
  /** 投入品名称 */
  inputName: string
  /** 投入品类别 */
  category: string
  /** 异常类型 */
  type: AbnormalType
  /** 实际用量（kg） */
  usedQty: number
  /** 标准用量（kg） */
  stdQty: number
  /** 使用时间 */
  usedAt: string
  /** 处置状态 */
  status: HandleStatus
}

/** 监管预警示例数据（PRD 6.2 #15 禁限用投入品预警 / 用量异常分析） */
const FALLBACK_WARNINGS: InputWarningRow[] = [
  {
    id: 'IW20250714001',
    farm: '绿源1号',
    plot: 'A-03 地块',
    inputName: 'XX农药',
    category: '农药',
    type: 'restricted',
    usedQty: 1.5,
    stdQty: 0.8,
    usedAt: '2025-07-14 09:20',
    status: 'pending',
  },
  {
    id: 'IW20250714002',
    farm: '丰达A区',
    plot: 'B-11 地块',
    inputName: '尿素',
    category: '肥料',
    type: 'overdose',
    usedQty: 22.4,
    stdQty: 15,
    usedAt: '2025-07-14 08:05',
    status: 'notified',
  },
  {
    id: 'IW20250713005',
    farm: '大地南',
    plot: 'C-02 地块',
    inputName: '克百威',
    category: '农药',
    type: 'restricted',
    usedQty: 0.6,
    stdQty: 0.8,
    usedAt: '2025-07-13 16:40',
    status: 'rectified',
  },
  {
    id: 'IW20250713008',
    farm: '鑫农实验农场',
    plot: 'D-07 地块',
    inputName: '复合肥',
    category: '肥料',
    type: 'overdose',
    usedQty: 28.6,
    stdQty: 20,
    usedAt: '2025-07-13 10:15',
    status: 'pending',
  },
  {
    id: 'IW20250712003',
    farm: '惠民D区',
    plot: 'E-05 地块',
    inputName: '多菌灵',
    category: '农药',
    type: 'interval',
    usedQty: 1.4,
    stdQty: 1.2,
    usedAt: '2025-07-12 14:30',
    status: 'notified',
  },
]

/** 用量趋势示例数据（近 7 天，实际用量 vs 建议用量，单位 kg） */
const FALLBACK_TREND: Array<{ date: string; actual: number; standard: number }> = [
  { date: '7/8', actual: 18.2, standard: 15 },
  { date: '7/9', actual: 21.5, standard: 15 },
  { date: '7/10', actual: 16.8, standard: 15 },
  { date: '7/11', actual: 24.3, standard: 16 },
  { date: '7/12', actual: 19.6, standard: 16 },
  { date: '7/13', actual: 26.4, standard: 16 },
  { date: '7/14', actual: 22.1, standard: 16 },
]

/**
 * 导出 CSV 文件（带 BOM，Excel 可直接打开）。
 *
 * @param filename 文件名
 * @param headers 表头
 * @param rows 数据行
 */
function exportCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const content = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 投入品使用监管
 *
 * 业务职责：监管全平台投入品使用记录，识别「禁限用投入品命中」与「用量异常」，
 * 支持按异常类型 / 农场 / 时间查询，提供用量趋势分析与处置状态闭环
 * （待处理 → 已通知 → 已整改）。数据优先取 /admin/monitor/inputs，
 * 接口无数据时降级到 PRD 示例口径。
 *
 * @returns 页面内容
 */
export default function InputMonitor(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 筛选草稿：异常类型 */
  const [draftType, setDraftType] = useState<string>('all')
  /** 筛选草稿：农场 */
  const [draftFarm, setDraftFarm] = useState<string>('all')
  /** 筛选草稿：开始日期 */
  const [draftStart, setDraftStart] = useState<Dayjs | null>(dayjs().subtract(7, 'day'))
  /** 筛选草稿：结束日期 */
  const [draftEnd, setDraftEnd] = useState<Dayjs | null>(dayjs())
  /** 已应用的筛选条件 */
  const [applied, setApplied] = useState<{
    type: string
    farm: string
    startDate: string
    endDate: string
  }>({
    type: 'all',
    farm: 'all',
    startDate: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
  })
  /** 处置状态覆盖表：预警 ID → 最新处置状态（本地处置闭环） */
  const [statusOverrides, setStatusOverrides] = useState<Record<string, HandleStatus>>({})
  /** 处置弹窗当前预警 */
  const [activeRow, setActiveRow] = useState<InputWarningRow | null>(null)
  /** 处置动作：通知 / 整改 */
  const [handleAction, setHandleAction] = useState<'notify' | 'rectify'>('notify')
  /** 处置措施 */
  const [measure, setMeasure] = useState<string>('下发整改通知书')
  /** 处置说明 */
  const [remark, setRemark] = useState<string>('')

  /** 投入品使用记录（/admin/monitor/inputs） */
  const usageQuery = useQuery({
    queryKey: ['admin', 'monitor', 'inputs', applied],
    queryFn: () =>
      listMonitorInputUsages({
        pageNum: 1,
        pageSize: 100,
        inputId: undefined,
        overLimit: applied.type === 'overdose' ? true : undefined,
      }),
    retry: false,
  })

  /** 预警列表：真实使用记录命中规则优先，否则用示例口径 */
  const warnings: InputWarningRow[] = useMemo(() => {
    const remote = usageQuery.data?.list ?? []
    const fromRemote: InputWarningRow[] = remote
      .map((item, index) => {
        const name = item.inputName ?? '未知投入品'
        const stdQty = STD_DOSAGE_MAP[name] ?? 10
        const usedQty = Number(item.quantity) || 0
        const isRestricted = RESTRICTED_INPUTS.includes(name)
        const isOverdose = usedQty > stdQty * 1.1
        if (!isRestricted && !isOverdose) {
          return null
        }
        return {
          id: item.usageId || `IU${index}`,
          farm: item.plotName ?? '—',
          plot: item.plotName ?? '—',
          inputName: name,
          category: isRestricted ? '农药' : '肥料',
          type: (isRestricted ? 'restricted' : 'overdose') as AbnormalType,
          usedQty,
          stdQty,
          usedAt: item.usedAt ?? '—',
          status: 'pending' as HandleStatus,
        }
      })
      .filter((item): item is InputWarningRow => item !== null)
    const base = fromRemote.length > 0 ? fromRemote : FALLBACK_WARNINGS
    return base
      .map((item) => ({
        ...item,
        status: statusOverrides[item.id] ?? item.status,
      }))
      .filter((item) => (applied.type === 'all' ? true : item.type === applied.type))
      .filter((item) => (applied.farm === 'all' ? true : item.farm === applied.farm))
      .filter((item) => {
        const usedDay = item.usedAt.slice(0, 10)
        const afterStart = applied.startDate ? usedDay >= applied.startDate : true
        const beforeEnd = applied.endDate ? usedDay <= applied.endDate : true
        return afterStart && beforeEnd
      })
  }, [usageQuery.data, applied, statusOverrides])

  /** 是否使用真实接口数据 */
  const hasRealData = (usageQuery.data?.list?.length ?? 0) > 0

  /** 统计卡数据 */
  const stats = useMemo(() => {
    const total = warnings.length
    const restricted = warnings.filter((item) => item.type === 'restricted').length
    const overdose = warnings.filter((item) => item.type !== 'restricted').length
    const rectified = warnings.filter((item) => item.status === 'rectified').length
    return {
      total,
      restricted,
      overdose,
      rectifiedRate: total === 0 ? 0 : Number(((rectified / total) * 100).toFixed(1)),
    }
  }, [warnings])

  /** 用量趋势：真实数据按使用时间聚合，否则用示例口径 */
  const trend = useMemo(() => {
    const remote = usageQuery.data?.list ?? []
    if (remote.length > 0) {
      const buckets = new Map<string, { actual: number; standard: number }>()
      remote.forEach((item) => {
        if (!item.usedAt) {
          return
        }
        const day = item.usedAt.slice(5, 10).replace('-', '/')
        const prev = buckets.get(day) ?? { actual: 0, standard: 0 }
        buckets.set(day, {
          actual: prev.actual + (Number(item.quantity) || 0),
          standard: prev.standard + (STD_DOSAGE_MAP[item.inputName ?? ''] ?? 15),
        })
      })
      return Array.from(buckets.entries())
        .map(([date, value]) => ({
          date,
          actual: Number(value.actual.toFixed(1)),
          standard: Number(value.standard.toFixed(1)),
        }))
        .slice(-7)
    }
    return FALLBACK_TREND
  }, [usageQuery.data])

  /** 用量趋势图配置 */
  const trendOption: EChartsOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { data: ['实际用量', '建议用量'], top: 0 },
      grid: { left: 8, right: 24, top: 36, bottom: 8, containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: trend.map((item) => item.date) },
      yAxis: { type: 'value', name: '用量(kg)' },
      series: [
        {
          type: 'line',
          name: '实际用量',
          smooth: true,
          data: trend.map((item) => item.actual),
          itemStyle: { color: '#ff4d4f' },
          areaStyle: { opacity: 0.12 },
          markPoint: { data: [{ type: 'max', name: '峰值' }] },
        },
        {
          type: 'line',
          name: '建议用量',
          smooth: true,
          data: trend.map((item) => item.standard),
          itemStyle: { color: '#52c41a' },
          lineStyle: { type: 'dashed' },
        },
      ],
    }),
    [trend],
  )

  /** 预警表格列 */
  const columns: ColumnsType<InputWarningRow> = [
    { title: '预警编号', dataIndex: 'id', key: 'id', width: 150 },
    { title: '农场', dataIndex: 'farm', key: 'farm', width: 120 },
    { title: '地块', dataIndex: 'plot', key: 'plot', width: 110 },
    { title: '投入品', dataIndex: 'inputName', key: 'inputName', width: 100 },
    {
      title: '异常类型',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (value: AbnormalType) => (
        <Tag color={ABNORMAL_TYPE_META[value]?.color ?? 'default'}>
          {ABNORMAL_TYPE_META[value]?.label ?? value}
        </Tag>
      ),
    },
    {
      title: '实际用量',
      dataIndex: 'usedQty',
      key: 'usedQty',
      width: 100,
      render: (value: number, row: InputWarningRow) => (
        <Text style={{ color: value > row.stdQty ? '#ff4d4f' : undefined }}>{value} kg</Text>
      ),
    },
    { title: '标准用量', dataIndex: 'stdQty', key: 'stdQty', width: 100, render: (value: number) => `${value} kg` },
    {
      title: '超标',
      key: 'over',
      width: 90,
      render: (_value: unknown, row: InputWarningRow) => {
        if (row.type === 'restricted') {
          return <Tag color="red">禁限用</Tag>
        }
        const rate = row.stdQty === 0 ? 0 : Number((((row.usedQty - row.stdQty) / row.stdQty) * 100).toFixed(0))
        return rate > 0 ? <Tag color="orange">+{rate}%</Tag> : <Tag>正常</Tag>
      },
    },
    { title: '使用时间', dataIndex: 'usedAt', key: 'usedAt', width: 140 },
    {
      title: '处置状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: HandleStatus) => (
        <Tag color={HANDLE_STATUS_META[value]?.color ?? 'default'}>
          {HANDLE_STATUS_META[value]?.label ?? value}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_value: unknown, row: InputWarningRow) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            disabled={row.status !== 'pending'}
            onClick={() => {
              setActiveRow(row)
              setHandleAction('notify')
              setMeasure('下发整改通知书')
              setRemark('')
            }}
          >
            通知
          </Button>
          <Button
            type="link"
            size="small"
            disabled={row.status !== 'notified'}
            onClick={() => {
              setActiveRow(row)
              setHandleAction('rectify')
              setMeasure('现场复查确认整改')
              setRemark('')
            }}
          >
            确认整改
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() =>
              message.info(
                `${row.farm} / ${row.plot} 使用「${row.inputName}」${row.usedQty}kg（标准 ${row.stdQty}kg）`,
              )
            }
          >
            详情
          </Button>
        </Space>
      ),
    },
  ]

  /** 查询 */
  const handleSearch = (): void => {
    if (draftStart && draftEnd && draftStart.isAfter(draftEnd)) {
      message.warning('开始日期不能晚于结束日期')
      return
    }
    setApplied({
      type: draftType,
      farm: draftFarm,
      startDate: draftStart ? draftStart.format('YYYY-MM-DD') : '',
      endDate: draftEnd ? draftEnd.format('YYYY-MM-DD') : '',
    })
  }

  /** 重置 */
  const handleReset = (): void => {
    const start = dayjs().subtract(7, 'day')
    const end = dayjs()
    setDraftType('all')
    setDraftFarm('all')
    setDraftStart(start)
    setDraftEnd(end)
    setApplied({
      type: 'all',
      farm: 'all',
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    })
  }

  /** 提交处置 */
  const submitHandle = (): void => {
    if (!activeRow) {
      return
    }
    if (!remark.trim()) {
      message.warning('请填写处置说明')
      return
    }
    const nextStatus: HandleStatus = handleAction === 'notify' ? 'notified' : 'rectified'
    setStatusOverrides((prev) => ({ ...prev, [activeRow.id]: nextStatus }))
    message.success(
      `${activeRow.farm}「${activeRow.inputName}」${nextStatus === 'notified' ? '通知已下发' : '整改已确认'}：${measure}`,
    )
    setActiveRow(null)
    setRemark('')
  }

  /** 导出预警清单 */
  const handleExport = (): void => {
    if (warnings.length === 0) {
      message.warning('当前无预警数据可导出')
      return
    }
    const rows = warnings.map((item) => [
      item.id,
      item.farm,
      item.plot,
      item.inputName,
      ABNORMAL_TYPE_META[item.type]?.label ?? item.type,
      `${item.usedQty}kg`,
      `${item.stdQty}kg`,
      item.usedAt,
      HANDLE_STATUS_META[item.status]?.label ?? item.status,
    ])
    exportCsv(
      `投入品使用监管预警_${applied.startDate}_${applied.endDate}.csv`,
      ['预警编号', '农场', '地块', '投入品', '异常类型', '实际用量', '标准用量', '使用时间', '处置状态'],
      rows,
    )
    message.success('预警清单已导出')
  }

  return (
    <div>
      {/* 面包屑 + 标题 + 导出（PRD 6.2 #15） */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Breadcrumb
            style={{ marginBottom: 4 }}
            items={[
              { href: '/admin/production/dashboard', title: <HomeOutlined /> },
              { title: '生产管理' },
              { title: '生产监控' },
              { title: '投入品使用监管' },
            ]}
          />
          <Title level={4} style={{ margin: 0 }}>
            投入品使用监管
          </Title>
          <Text type="secondary">禁限用投入品预警、用量异常分析与处置闭环</Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'inputs'] })
              }
            >
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出预警清单
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 筛选器：异常类型 / 农场 / 时间范围 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={12}>
          <Space size={6}>
            <Text>异常类型：</Text>
            <Select
              style={{ width: 160 }}
              value={draftType}
              onChange={(value) => setDraftType(value)}
              options={ABNORMAL_TYPE_OPTIONS}
            />
          </Space>
          <Space size={6}>
            <Text>农场：</Text>
            <Select
              style={{ width: 160 }}
              value={draftFarm}
              onChange={(value) => setDraftFarm(value)}
              options={FARM_OPTIONS}
            />
          </Space>
          <Space size={6}>
            <Text>使用时间：</Text>
            <DatePicker
              value={draftStart}
              onChange={(value) => setDraftStart(value)}
              placeholder="开始日期"
            />
            <Text type="secondary">~</Text>
            <DatePicker
              value={draftEnd}
              onChange={(value) => setDraftEnd(value)}
              placeholder="结束日期"
            />
          </Space>
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      {/* 统计卡：预警总数 / 禁限用命中 / 用量异常 / 整改率 */}
      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            {usageQuery.isLoading ? (
              <Skeleton active title={false} paragraph={{ rows: 2 }} />
            ) : (
              <Statistic title="预警总数" value={stats.total} />
            )}
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic
              title="禁限用投入品命中"
              value={stats.restricted}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="用量异常" value={stats.overdose} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic
              title="整改完成率"
              value={stats.rectifiedRate}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 用量趋势 + 预警列表 */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={10}>
          <Card size="small" title="投入品用量趋势" extra={<Text type="secondary">近 7 天（kg）</Text>}>
            <ReactECharts option={trendOption} style={{ height: 300 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card size="small" title="监管规则说明">
            <Space direction="vertical" size={6}>
              <Text>
                1. 禁限用投入品：命中《禁限用农药名录》的投入品（
                {RESTRICTED_INPUTS.join('、')}）一旦出现在使用记录中即产生紧急预警。
              </Text>
              <Text>
                2. 用量异常：实际用量超过标准用量 10% 即判定为用量异常，趋势图中红色实线为实际用量、
                绿色虚线为建议用量。
              </Text>
              <Text>
                3. 处置闭环：待处理 →（通知）→ 已通知 →（确认整改）→ 已整改，全程留痕可导出。
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 预警列表 */}
      <Card size="small" title="投入品使用预警列表" style={{ marginTop: 12 }}>
        {usageQuery.isError ? (
          <AntAlert
            type="error"
            showIcon
            message="投入品使用记录接口请求失败"
            description="已切换为示例口径展示，请检查后端服务后重试。"
            action={
              <Button size="small" onClick={() => void usageQuery.refetch()}>
                重试
              </Button>
            }
          />
        ) : (
          <Table<InputWarningRow>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={warnings}
            pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 条` }}
            locale={{ emptyText: <Empty description="当前筛选条件下暂无投入品预警" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          />
        )}
      </Card>

      {/* 数据口径提示 */}
      <AntAlert
        style={{ marginTop: 12 }}
        type={hasRealData ? 'success' : 'info'}
        showIcon
        message={
          hasRealData
            ? '已基于真实投入品使用记录命中监管规则生成预警'
            : '当前展示 PRD 示例口径（后端投入品使用接口未返回数据），筛选、处置与导出功能均可正常使用。'
        }
      />

      {/* 处置弹窗 */}
      <Modal
        open={activeRow !== null}
        title={handleAction === 'notify' ? '下发整改通知' : '确认整改完成'}
        okText={handleAction === 'notify' ? '确认通知' : '确认整改'}
        cancelText="取消"
        destroyOnClose
        onCancel={() => setActiveRow(null)}
        onOk={submitHandle}
      >
        {activeRow && (
          <div>
            <Row gutter={[0, 8]}>
              <Col span={12}>预警编号：{activeRow.id}</Col>
              <Col span={12}>农场：{activeRow.farm}</Col>
              <Col span={12}>地块：{activeRow.plot}</Col>
              <Col span={12}>投入品：{activeRow.inputName}</Col>
              <Col span={12}>异常类型：{ABNORMAL_TYPE_META[activeRow.type]?.label}</Col>
              <Col span={12}>
                用量：{activeRow.usedQty}kg / 标准 {activeRow.stdQty}kg
              </Col>
            </Row>
            <div style={{ marginTop: 12 }}>
              <Text>处置措施：</Text>
              <Radio.Group
                style={{ marginTop: 6, display: 'block' }}
                value={measure}
                onChange={(event) => setMeasure(String(event.target.value))}
                options={
                  handleAction === 'notify'
                    ? [
                        { label: '下发整改通知书', value: '下发整改通知书' },
                        { label: '电话通知负责人', value: '电话通知负责人' },
                        { label: '现场核查', value: '现场核查' },
                      ]
                    : [
                        { label: '现场复查确认整改', value: '现场复查确认整改' },
                        { label: '整改材料已归档', value: '整改材料已归档' },
                      ]
                }
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Text>处置说明：</Text>
              <textarea
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                rows={3}
                placeholder="请输入处置说明（必填）"
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
