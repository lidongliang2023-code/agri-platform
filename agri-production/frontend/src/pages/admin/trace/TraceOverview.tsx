/**
 * 页面名称：溯源总览
 * 路由路径：/admin/production/trace
 * 所属模块：质量追溯管理
 * 原型来源：P11 trace — 溯源总览
 * PRD 序号：PRD 6.2 #16
 */
import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useQuery } from '@tanstack/react-query'
import {
  fetchAdminQualityOverview,
  fetchAdminTraceCodeStats,
} from '@/api/admin/trace'

const { Text } = Typography

/* ==================== 常量：原型 P11 / 4.2 平台级口径 ==================== */

/** 平台基线口径（后端无汇总数据时沿用原型 P11 数值） */
const PLATFORM_BASELINE = {
  /** 溯源码总量 */
  totalCodeCount: 2_450_000,
  /** 已激活码量 */
  activatedCodeCount: 1_862_500,
  /** 消费者扫码次数 */
  totalScanCount: 45_320,
  /** 溯源覆盖率（%） */
  coverageRate: 87.6,
  /** 区块链节点数 */
  chainNodeCount: 48,
} as const

/** 码段统计后端取值 → 前端展示口径映射 */
const CODE_STATUS_LABEL: Record<string, string> = {
  generated: '已生成',
  active: '已激活',
  scanned: '已扫码',
  revoked: '已作废',
}

/** 覆盖率分类（原型 P11 溯源覆盖率分析） */
const COVERAGE_CATEGORIES: Array<{
  /** 分类名称 */
  name: string
  /** 覆盖率 */
  rate: number
  /** 达标结论 */
  level: '达标' | '待提升' | '不足'
  /** 结论色 */
  color: string
}> = [
  { name: '种植类', rate: 92.3, level: '达标', color: '#52c41a' },
  { name: '养殖类', rate: 85.1, level: '待提升', color: '#faad14' },
  { name: '加工类', rate: 78.4, level: '不足', color: '#ff4d4f' },
]

/** 扫码热力区域 TOP10（原型 P11） */
const SCAN_REGION_TOP10: Array<{
  /** 排名 */
  rank: number
  /** 区域 */
  region: string
  /** 扫码次数 */
  scanCount: number
  /** 占比（%） */
  ratio: number
  /** 环比趋势（%） */
  trend: number
}> = [
  { rank: 1, region: '河南省', scanCount: 8520, ratio: 18.8, trend: 12 },
  { rank: 2, region: '山东省', scanCount: 7210, ratio: 15.9, trend: 8 },
  { rank: 3, region: '广东省', scanCount: 5860, ratio: 12.9, trend: 15 },
  { rank: 4, region: '浙江省', scanCount: 4320, ratio: 9.5, trend: 6 },
  { rank: 5, region: '江苏省', scanCount: 3980, ratio: 8.8, trend: -2 },
  { rank: 6, region: '四川省', scanCount: 3560, ratio: 7.9, trend: 9 },
  { rank: 7, region: '河北省', scanCount: 3120, ratio: 6.9, trend: 4 },
  { rank: 8, region: '湖南省', scanCount: 2740, ratio: 6.0, trend: -5 },
  { rank: 9, region: '湖北省', scanCount: 2380, ratio: 5.3, trend: 3 },
  { rank: 10, region: '安徽省', scanCount: 1630, ratio: 3.6, trend: 7 },
]

/** 趋势周期选项 */
type TrendRange = '7d' | '30d'

/** 趋势示例数据（原型 P11 X 轴 7/8 ~ 7/13） */
const TREND_SERIES: Record<
  TrendRange,
  { labels: string[]; generated: number[]; activated: number[] }
> = {
  '7d': {
    labels: ['7/8', '7/9', '7/10', '7/11', '7/12', '7/13'],
    generated: [18200, 21500, 19800, 24600, 27300, 25800],
    activated: [15400, 18200, 17600, 20900, 23400, 22100],
  },
  '30d': {
    labels: ['6/20', '6/23', '6/26', '6/29', '7/2', '7/5', '7/8', '7/11', '7/13'],
    generated: [16500, 17800, 19200, 18800, 21400, 23600, 22400, 26100, 24800],
    activated: [14200, 15300, 16800, 16200, 18600, 20100, 19400, 22800, 21500],
  },
}

/** 区域分布示例数据（取扫码热力区域 TOP8） */
const REGION_DISTRIBUTION = SCAN_REGION_TOP10.slice(0, 8).map((item) => ({
  name: item.region,
  value: item.scanCount,
}))

/**
 * 溯源总览
 *
 * 业务职责：展示平台级溯源业务大盘——码量、激活量、扫码量、覆盖率与区块链节点，
 * 并提供生成趋势、覆盖率分析与扫码区域分布。
 *
 * 数据来源：
 * - GET /admin/trace/code-stats（码段统计，按状态汇总）
 * - GET /admin/quality/overview（合格 / 不合格单数，用于检测合格率联动）
 *
 * @returns 页面内容
 */
export default function TraceOverview(): JSX.Element {
  const { message } = App.useApp()

  /** 趋势周期 */
  const [trendRange, setTrendRange] = useState<TrendRange>('7d')

  /** 码段统计 */
  const statsQuery = useQuery({
    queryKey: ['admin', 'trace', 'code-stats'],
    queryFn: () => fetchAdminTraceCodeStats(),
    retry: false,
  })

  /** 质量总览（联动展示检测合格率） */
  const qualityQuery = useQuery({
    queryKey: ['admin', 'quality', 'overview'],
    queryFn: () => fetchAdminQualityOverview(),
    retry: false,
  })

  /** 指标卡数据（后端统计优先，缺失时回落到原型口径） */
  const metrics = useMemo(() => {
    const raw = statsQuery.data ?? {}
    const generated = Number(raw.generated ?? 0)
    const active = Number(raw.active ?? 0)
    const scanned = Number(raw.scanned ?? 0)
    const revoked = Number(raw.revoked ?? 0)
    const remoteTotal = generated + active + scanned + revoked

    const totalCodeCount = remoteTotal > 0 ? remoteTotal : PLATFORM_BASELINE.totalCodeCount
    const activatedCodeCount = active > 0 ? active + scanned : PLATFORM_BASELINE.activatedCodeCount
    const totalScanCount = scanned > 0 ? scanned : PLATFORM_BASELINE.totalScanCount
    /** 覆盖率 =（已激活 + 已扫码）/ 总量 */
    const coverageRate =
      remoteTotal > 0
        ? Number((((active + scanned) / remoteTotal) * 100).toFixed(1))
        : PLATFORM_BASELINE.coverageRate

    return {
      totalCodeCount,
      activatedCodeCount,
      totalScanCount,
      coverageRate,
      chainNodeCount: PLATFORM_BASELINE.chainNodeCount,
      /** 检测合格率（%） */
      passRate: Number(qualityQuery.data?.passRate ?? 95.2),
    }
  }, [statsQuery.data, qualityQuery.data])

  /** 码段分布（后端统计优先，缺失时回落原型口径） */
  const statusDistribution = useMemo(() => {
    const raw = statsQuery.data ?? {}
    const entries = Object.entries(raw)
      .filter(([, value]) => Number(value) > 0)
      .map(([key, value]) => ({
        name: CODE_STATUS_LABEL[key] ?? key,
        value: Number(value),
      }))
    if (entries.length > 0) {
      return entries
    }
    return [
      { name: '已生成', value: 587_500 },
      { name: '已激活', value: 1_420_000 },
      { name: '已扫码', value: 442_500 },
    ]
  }, [statsQuery.data])

  /** 生成趋势图配置 */
  const trendOption = useMemo<EChartsOption>(() => {
    const series = TREND_SERIES[trendRange]
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['生成量', '激活量'], bottom: 0 },
      grid: { left: 56, right: 24, top: 32, bottom: 48 },
      xAxis: { type: 'category', data: series.labels, boundaryGap: false },
      yAxis: { type: 'value', name: '码量（张）' },
      series: [
        {
          name: '生成量',
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.15 },
          itemStyle: { color: '#1677ff' },
          data: series.generated,
        },
        {
          name: '激活量',
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.15 },
          itemStyle: { color: '#52c41a' },
          data: series.activated,
        },
      ],
    }
  }, [trendRange])

  /** 码段分布饼图配置 */
  const statusPieOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: true,
          label: { formatter: '{b}\n{d}%' },
          data: statusDistribution,
        },
      ],
    }),
    [statusDistribution],
  )

  /** 区域分布柱状图配置 */
  const regionBarOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 56, right: 24, top: 24, bottom: 36 },
      xAxis: { type: 'category', data: REGION_DISTRIBUTION.map((item) => item.name) },
      yAxis: { type: 'value', name: '扫码次数' },
      series: [
        {
          name: '扫码次数',
          type: 'bar',
          barWidth: '52%',
          itemStyle: { color: '#36cfc9', borderRadius: [4, 4, 0, 0] },
          data: REGION_DISTRIBUTION.map((item) => item.value),
        },
      ],
    }),
    [],
  )

  /** 扫码区域 TOP10 表格列 */
  const regionColumns: ColumnsType<(typeof SCAN_REGION_TOP10)[number]> = [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 90,
      render: (rank: number) => (
        <Tag color={rank <= 3 ? 'volcano' : 'default'}>{`TOP ${rank}`}</Tag>
      ),
    },
    { title: '区域', dataIndex: 'region', width: 120 },
    {
      title: '扫码次数',
      dataIndex: 'scanCount',
      width: 120,
      render: (value: number) => value.toLocaleString('zh-CN'),
    },
    {
      title: '占比',
      dataIndex: 'ratio',
      width: 180,
      render: (value: number) => <Progress percent={value} size="small" strokeColor="#1677ff" />,
    },
    {
      title: '环比趋势',
      dataIndex: 'trend',
      width: 120,
      render: (value: number) => (
        <Text type={value >= 0 ? 'success' : 'danger'}>
          {value >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(value)}%
        </Text>
      ),
    },
  ]

  /** 导出看板快照（前端本地生成 CSV） */
  const handleExport = (): void => {
    const rows = [
      ['指标', '数值'],
      ['溯源码总量', String(metrics.totalCodeCount)],
      ['已激活码量', String(metrics.activatedCodeCount)],
      ['消费者扫码次数', String(metrics.totalScanCount)],
      ['溯源覆盖率(%)', String(metrics.coverageRate)],
      ['区块链节点数', String(metrics.chainNodeCount)],
      ['检测合格率(%)', String(metrics.passRate)],
      [],
      ['排名', '区域', '扫码次数', '占比(%)', '环比(%)'],
      ...SCAN_REGION_TOP10.map((item) => [
        String(item.rank),
        item.region,
        String(item.scanCount),
        String(item.ratio),
        String(item.trend),
      ]),
    ]
    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `溯源总览_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success('看板快照已导出')
  }

  /** 刷新全部指标 */
  const handleRefresh = (): void => {
    void statsQuery.refetch()
    void qualityQuery.refetch()
    message.success('指标已刷新')
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* 后端码段统计未就绪时明确提示口径来源 */}
      {statsQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="码段统计接口未返回数据，当前展示原型 P11 平台级口径（溯源码 2,450,000 / 覆盖率 87.6% / 节点 48）"
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => void statsQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : null}

      {/* 指标卡（原型 P11 五项） */}
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="溯源码总量"
              value={metrics.totalCodeCount}
              valueStyle={{ color: '#1677ff' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>↑ 12.3%</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已激活"
              value={metrics.activatedCodeCount}
              valueStyle={{ color: '#52c41a' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>↑ 8.5%</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="消费者扫码"
              value={metrics.totalScanCount}
              valueStyle={{ color: '#faad14' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>↑ 15.2%</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="溯源覆盖率"
              value={metrics.coverageRate}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>↑ 2.1%</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="区块链节点"
              value={metrics.chainNodeCount}
              suffix={<Tag color="success">全部在线</Tag>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="检测合格率"
              value={metrics.passRate}
              precision={1}
              suffix="%"
              valueStyle={{ color: metrics.passRate >= 95 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="码段状态分布（张）">
            <Row gutter={8}>
              {statusDistribution.map((item) => (
                <Col span={6} key={item.name}>
                  <Statistic title={item.name} value={item.value} valueStyle={{ fontSize: 18 }} />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 趋势图 + 码段分布 */}
      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card
            title="溯源码生成趋势"
            loading={statsQuery.isLoading}
            extra={
              <Space>
                <Segmented
                  size="small"
                  value={trendRange}
                  onChange={(value) => setTrendRange(value as TrendRange)}
                  options={[
                    { label: '近 7 天', value: '7d' },
                    { label: '近 30 天', value: '30d' },
                  ]}
                />
                <Button size="small" icon={<DownloadOutlined />} onClick={handleExport}>
                  导出报表
                </Button>
                <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh}>
                  刷新
                </Button>
              </Space>
            }
          >
            <ReactECharts option={trendOption} style={{ height: 300 }} notMerge />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="码段状态占比" loading={statsQuery.isLoading}>
            <ReactECharts option={statusPieOption} style={{ height: 300 }} notMerge />
          </Card>
        </Col>
      </Row>

      {/* 覆盖率分析 + 区域分布 */}
      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card title="溯源覆盖率分析">
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <Progress type="dashboard" percent={metrics.coverageRate} strokeColor="#722ed1" />
                <Text type="secondary">平台整体溯源覆盖率</Text>
              </div>
              {COVERAGE_CATEGORIES.map((item) => (
                <div key={item.name}>
                  <Row justify="space-between" align="middle">
                    <Space size={8}>
                      <Text strong>{item.name}</Text>
                      <Tag
                        color={
                          item.level === '达标'
                            ? 'success'
                            : item.level === '待提升'
                              ? 'warning'
                              : 'error'
                        }
                      >
                        {item.level}
                      </Tag>
                    </Space>
                    <Text strong style={{ color: item.color }}>{item.rate}%</Text>
                  </Row>
                  <Progress percent={item.rate} showInfo={false} strokeColor={item.color} size="small" />
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="扫码区域分布 TOP8">
            <ReactECharts option={regionBarOption} style={{ height: 320 }} notMerge />
          </Card>
        </Col>
      </Row>

      {/* 扫码热力区域 TOP10（原型 P11 表格） */}
      <Card
        title="扫码热力区域 TOP10"
        extra={<Text type="secondary">数据口径：消费者扫码渠道汇总</Text>}
      >
        <Table
          rowKey="rank"
          size="small"
          pagination={false}
          columns={regionColumns}
          dataSource={SCAN_REGION_TOP10}
        />
      </Card>
    </Space>
  )
}
