/**
 * 页面名称：生产总览
 * 路由路径：/admin/production/dashboard/overview
 * 所属模块：运营仪表盘
 * PRD 序号：PRD 6.2 #2
 * 说明：原型无此页（原型仅有运营管理大盘），按 PRD「多维度生产数据统计、区域分析、租户分析」实现。
 */
import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { fetchOverviewRows, getOpsProductionOverview } from '@/api/admin/dashboard'

const { Text, Title } = Typography

/** 统计维度 */
type Dimension = 'region' | 'crop' | 'tenant'

/** 展示方式 */
type ViewMode = 'table' | 'chart'

/** 过滤条件 */
interface OverviewFilter {
  /** 起始日期 yyyy-MM-dd */
  startDate: string
  /** 截止日期 yyyy-MM-dd */
  endDate: string
  /** 区域 */
  region: string
  /** 统计维度 */
  dimension: Dimension
  /** 展示方式 */
  view: ViewMode
}

/** 维度统计行 */
interface OverviewRow {
  /** 维度名称 */
  name: string
  /** 农场数 */
  farmCount: number
  /** 在田面积（亩） */
  fieldArea: number
  /** 本期产量（吨） */
  outputTon: number
  /** 任务完成率（%） */
  taskRate: number
  /** 告警数 */
  alertCount: number
}

/** 区域下拉选项（原型 P5 / 4.2 口径） */
const REGION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部' },
  { value: '河南省', label: '河南省' },
  { value: '山东省', label: '山东省' },
  { value: '黑龙江省', label: '黑龙江省' },
  { value: '江苏省', label: '江苏省' },
  { value: '四川省', label: '四川省' },
  { value: '广东省', label: '广东省' },
]

/* ==================== 示例数据（后端无明细接口时兜底） ==================== */

/** 按区域示例数据 */
const FALLBACK_ROWS: Record<Dimension, OverviewRow[]> = {
  region: [
    { name: '河南省', farmCount: 720, fieldArea: 185000, outputTon: 5200, taskRate: 89.2, alertCount: 12 },
    { name: '山东省', farmCount: 650, fieldArea: 162000, outputTon: 4800, taskRate: 91.5, alertCount: 8 },
    { name: '黑龙江省', farmCount: 480, fieldArea: 214000, outputTon: 7600, taskRate: 86.4, alertCount: 15 },
    { name: '江苏省', farmCount: 410, fieldArea: 96000, outputTon: 3200, taskRate: 88.7, alertCount: 6 },
    { name: '四川省', farmCount: 355, fieldArea: 88000, outputTon: 2800, taskRate: 84.3, alertCount: 9 },
    { name: '广东省', farmCount: 320, fieldArea: 62000, outputTon: 2500, taskRate: 82.1, alertCount: 11 },
  ],
  crop: [
    { name: '水稻', farmCount: 1180, fieldArea: 326000, outputTon: 12400, taskRate: 90.1, alertCount: 14 },
    { name: '小麦', farmCount: 960, fieldArea: 248000, outputTon: 8600, taskRate: 88.9, alertCount: 9 },
    { name: '玉米', farmCount: 740, fieldArea: 212000, outputTon: 9800, taskRate: 87.2, alertCount: 12 },
    { name: '果蔬', farmCount: 512, fieldArea: 108000, outputTon: 4200, taskRate: 85.6, alertCount: 16 },
    { name: '大豆', farmCount: 386, fieldArea: 96000, outputTon: 3100, taskRate: 86.8, alertCount: 7 },
    { name: '其它', farmCount: 264, fieldArea: 62000, outputTon: 1900, taskRate: 83.4, alertCount: 5 },
  ],
  tenant: [
    { name: '绿源农业科技有限公司', farmCount: 45, fieldArea: 12500, outputTon: 860, taskRate: 92.5, alertCount: 1 },
    { name: '大地种业', farmCount: 52, fieldArea: 15200, outputTon: 1120, taskRate: 90.8, alertCount: 2 },
    { name: '丰达农场', farmCount: 38, fieldArea: 9800, outputTon: 640, taskRate: 89.4, alertCount: 1 },
    { name: '田园生态', farmCount: 33, fieldArea: 10100, outputTon: 580, taskRate: 84.2, alertCount: 3 },
    { name: '丰收集团', farmCount: 29, fieldArea: 8600, outputTon: 520, taskRate: 88.1, alertCount: 0 },
    { name: '惠民种植', farmCount: 15, fieldArea: 4200, outputTon: 210, taskRate: 76.5, alertCount: 4 },
  ],
}

/**
 * 生产总览
 *
 * 业务职责：按区域 / 作物 / 租户三个维度聚合展示全平台生产数据，
 * 支持时间范围与区域筛选、表格与图表两种展示方式。
 *
 * @returns 页面内容
 */
export default function OpsProductionOverview(): JSX.Element {
  const { message } = App.useApp()

  /** 默认时间范围：近 30 天 */
  const [filter, setFilter] = useState<OverviewFilter>({
    startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
    region: 'all',
    dimension: 'region',
    view: 'table',
  })

  /** 日期区间选择器的受控值 */
  const rangeValue: [Dayjs, Dayjs] = [dayjs(filter.startDate), dayjs(filter.endDate)]

  /** 汇总指标（后端 /admin/dashboard/overview） */
  const summaryQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'overview-summary', filter.startDate, filter.endDate],
    queryFn: () => getOpsProductionOverview({ startDate: filter.startDate, endDate: filter.endDate }),
    retry: false,
  })

  /** 维度明细（后端扩展接口，未就绪时降级示例数据） */
  const rowsQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'overview-rows', filter],
    queryFn: () =>
      fetchOverviewRows({
        dimension: filter.dimension,
        startDate: filter.startDate,
        endDate: filter.endDate,
        region: filter.region === 'all' ? undefined : filter.region,
      }),
    retry: false,
  })

  /** 维度明细数据 */
  const rows = useMemo<OverviewRow[]>(() => {
    const remote = rowsQuery.data
    if (remote && remote.length > 0) {
      return remote.map((item) => ({
        name: item.name,
        farmCount: Number(item.farmCount) || 0,
        fieldArea: Number(item.fieldArea) || 0,
        outputTon: Number(item.outputTon) || 0,
        taskRate: Number(item.taskRate) || 0,
        alertCount: Number(item.alertCount) || 0,
      }))
    }
    const fallback = FALLBACK_ROWS[filter.dimension]
    if (filter.region === 'all') {
      return fallback
    }
    return fallback.filter((item) => item.name === filter.region)
  }, [rowsQuery.data, filter.dimension, filter.region])

  /** 汇总指标卡（后端无数据时用明细聚合 + 平台口径兜底） */
  const summary = useMemo(() => {
    const totals = rows.reduce(
      (acc, item) => ({
        farmCount: acc.farmCount + item.farmCount,
        fieldArea: acc.fieldArea + item.fieldArea,
        outputTon: acc.outputTon + item.outputTon,
        alertCount: acc.alertCount + item.alertCount,
      }),
      { farmCount: 0, fieldArea: 0, outputTon: 0, alertCount: 0 },
    )
    const raw = summaryQuery.data as unknown as Record<string, unknown> | undefined
    const avgTaskRate =
      rows.length > 0
        ? rows.reduce((acc, item) => acc + item.taskRate, 0) / rows.length
        : 87.3
    return {
      /** 农场总数 */
      farmCount: Number(raw?.farmCount ?? 0) || totals.farmCount || 3542,
      /** 在田面积（亩） */
      fieldArea: Number(raw?.fieldArea ?? 0) || totals.fieldArea || 856000,
      /** 本期产量（吨） */
      outputTon: Number(raw?.outputTon ?? 0) || totals.outputTon || 2450,
      /** 平均任务完成率（%） */
      taskRate: Number(raw?.taskRate ?? 0) || Number(avgTaskRate.toFixed(1)),
      /** 告警数 */
      alertCount: Number(raw?.alertCount ?? 0) || totals.alertCount || 26,
    }
  }, [rows, summaryQuery.data])

  /** 表格列定义 */
  const columns: ColumnsType<OverviewRow> = [
    {
      title: filter.dimension === 'tenant' ? '租户名称' : filter.dimension === 'crop' ? '作物' : '区域',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    { title: '农场数', dataIndex: 'farmCount', key: 'farmCount', sorter: (a, b) => a.farmCount - b.farmCount },
    {
      title: '在田面积(亩)',
      dataIndex: 'fieldArea',
      key: 'fieldArea',
      sorter: (a, b) => a.fieldArea - b.fieldArea,
      render: (value: number) => Number(value).toLocaleString('zh-CN'),
    },
    {
      title: '本期产量(吨)',
      dataIndex: 'outputTon',
      key: 'outputTon',
      sorter: (a, b) => a.outputTon - b.outputTon,
      render: (value: number) => Number(value).toLocaleString('zh-CN'),
    },
    {
      title: '任务完成率',
      dataIndex: 'taskRate',
      key: 'taskRate',
      sorter: (a, b) => a.taskRate - b.taskRate,
      render: (value: number) => (
        <Tag color={value >= 90 ? 'green' : value >= 85 ? 'blue' : 'orange'}>{value.toFixed(1)}%</Tag>
      ),
    },
    {
      title: '告警数',
      dataIndex: 'alertCount',
      key: 'alertCount',
      sorter: (a, b) => a.alertCount - b.alertCount,
      render: (value: number) => (
        <Tag color={value > 10 ? 'red' : value > 5 ? 'orange' : 'green'}>{value}</Tag>
      ),
    },
  ]

  /** 图表配置：区域 / 租户用柱状图，作物用饼图 */
  const chartOption: EChartsOption = useMemo<EChartsOption>(() => {
    if (filter.dimension === 'crop') {
      return {
        tooltip: { trigger: 'item', formatter: '{b}: {c} 亩 ({d}%)' },
        legend: { orient: 'vertical', left: 0, top: 12 },
        series: [
          {
            type: 'pie',
            name: '在田面积',
            radius: ['42%', '68%'],
            center: ['55%', '52%'],
            data: rows.map((item) => ({ name: item.name, value: item.fieldArea })),
            label: { formatter: '{b}\n{d}%', color: 'inherit' },
          },
        ],
      }
    }
    const sorted = [...rows].sort((a, b) => b.fieldArea - a.fieldArea)
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['在田面积(亩)', '本期产量(吨)'], top: 0 },
      grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: sorted.map((item) => item.name), axisLabel: { interval: 0, rotate: 20 } },
      yAxis: [
        { type: 'value', name: '面积(亩)' },
        { type: 'value', name: '产量(吨)' },
      ],
      series: [
        {
          type: 'bar',
          name: '在田面积(亩)',
          data: sorted.map((item) => item.fieldArea),
          itemStyle: { color: '#13a05a', borderRadius: [4, 4, 0, 0] },
        },
        {
          type: 'line',
          name: '本期产量(吨)',
          yAxisIndex: 1,
          smooth: true,
          data: sorted.map((item) => item.outputTon),
          itemStyle: { color: '#1677ff' },
        },
      ],
    }
  }, [rows, filter.dimension])

  /** 重置筛选条件 */
  const handleReset = (): void => {
    setFilter({
      startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
      region: 'all',
      dimension: 'region',
      view: 'table',
    })
    message.success('筛选条件已重置')
  }

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            生产总览
          </Title>
          <Text type="secondary">
            {rowsQuery.data && rowsQuery.data.length > 0
              ? '数据来源：平台生产数据聚合'
              : '当前为原型示例口径（后端明细接口暂未返回数据）'}
          </Text>
        </Col>
      </Row>

      {/* 筛选区 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={8}>
            <Space>
              <Text>时间范围</Text>
              <DatePicker.RangePicker
                allowClear={false}
                value={rangeValue}
                onChange={(dates) => {
                  const start = dates?.[0]
                  const end = dates?.[1]
                  if (!start || !end) {
                    message.warning('请选择完整的时间范围')
                    return
                  }
                  setFilter((prev) => ({
                    ...prev,
                    startDate: start.format('YYYY-MM-DD'),
                    endDate: end.format('YYYY-MM-DD'),
                  }))
                }}
              />
            </Space>
          </Col>
          <Col xs={24} md={6}>
            <Space>
              <Text>区域</Text>
              <Select
                style={{ width: 160 }}
                value={filter.region}
                options={REGION_OPTIONS}
                onChange={(value) => setFilter((prev) => ({ ...prev, region: value }))}
              />
            </Space>
          </Col>
          <Col xs={24} md={6}>
            <Space>
              <Text>展示</Text>
              <Segmented
                value={filter.view}
                onChange={(value) => setFilter((prev) => ({ ...prev, view: value as ViewMode }))}
                options={[
                  { label: '表格', value: 'table' },
                  { label: '图表', value: 'chart' },
                ]}
              />
            </Space>
          </Col>
          <Col xs={24} md={4}>
            <Space>
              <Button onClick={handleReset}>重置</Button>
              <Tooltip title="刷新">
                <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()} />
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 汇总指标卡 */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            {summaryQuery.isLoading ? (
              <Skeleton active title={false} paragraph={{ rows: 2 }} />
            ) : (
              <Statistic
                title="纳入统计农场"
                value={summary.farmCount}
                suffix="个"
                formatter={(value) => Number(value).toLocaleString('zh-CN')}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="在田面积"
              value={Number((summary.fieldArea / 10000).toFixed(1))}
              suffix="万亩"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="本期产量"
              value={summary.outputTon}
              suffix="吨"
              formatter={(value) => Number(value).toLocaleString('zh-CN')}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="平均任务完成率"
              value={summary.taskRate}
              precision={1}
              suffix="%"
              valueStyle={{ color: summary.taskRate >= 88 ? '#13a05a' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 维度切换 + 明细区 */}
      <Card
        size="small"
        style={{ marginTop: 12 }}
        title={
          <Segmented
            value={filter.dimension}
            onChange={(value) => setFilter((prev) => ({ ...prev, dimension: value as Dimension }))}
            options={[
              { label: '按区域', value: 'region' },
              { label: '按作物', value: 'crop' },
              { label: '按租户', value: 'tenant' },
            ]}
          />
        }
        extra={
          <Text type="secondary">
            统计区间 {filter.startDate} ~ {filter.endDate} · 共 {rows.length} 个
            {filter.dimension === 'tenant' ? '租户' : filter.dimension === 'crop' ? '作物' : '区域'}
          </Text>
        }
      >
        {rowsQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : rows.length === 0 ? (
          <Empty description="当前筛选条件下暂无生产数据" />
        ) : filter.view === 'table' ? (
          <Table<OverviewRow>
            rowKey="name"
            size="small"
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 800 }}
          />
        ) : (
          <ReactECharts option={chartOption} style={{ height: 380 }} notMerge />
        )}
      </Card>
    </div>
  )
}
