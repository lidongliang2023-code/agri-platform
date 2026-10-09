/**
 * 页面名称：生产报表
 * 路由路径：/admin/production/reports/production
 * 所属模块：统计报表
 * PRD 序号：PRD 6.2 #29
 * 原型页码：P27 prod-reports
 *
 * 交互说明（对照原型 P27）：
 * - 顶部按钮：下载PDF / 导出Excel / 返回报表中心；标题「生产日报 · {统计日期}」；
 * - 多维筛选：统计日期、区域、作物、租户，筛选结果实时作用到指标卡与图表；
 * - 指标卡：总产量(吨)、任务完成率、活跃农场、设备在线率；
 * - 图表：各区域产量对比（柱状图）、任务执行分布（饼图）；
 * - 明细表：区域产量明细、任务执行明细，支持导出 Excel(CSV)。
 */
import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
} from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, FilePdfOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { generateProductionReport, listProductionReports } from '@/api'

/** 区域维度基础数据（原型 P27 各区域产量对比） */
const REGION_BASE: { region: string; output: number; area: number; activeFarms: number }[] = [
  { region: '河南', output: 520, area: 185000, activeFarms: 820 },
  { region: '山东', output: 480, area: 168000, activeFarms: 760 },
  { region: '黑龙江', output: 380, area: 226000, activeFarms: 610 },
  { region: '江苏', output: 320, area: 132000, activeFarms: 540 },
  { region: '四川', output: 280, area: 118000, activeFarms: 470 },
  { region: '广东', output: 250, area: 96000, activeFarms: 380 },
]

/** 任务类型分布基础数据（原型 P27 任务执行分布） */
const TASK_BASE: { taskType: string; count: number; doneRate: number; avgHours: number }[] = [
  { taskType: '施肥', count: 3738, doneRate: 91.2, avgHours: 2.4 },
  { taskType: '灌溉', count: 3114, doneRate: 88.6, avgHours: 1.8 },
  { taskType: '巡田', count: 1869, doneRate: 86.4, avgHours: 2.1 },
  { taskType: '喷药', count: 1495, doneRate: 82.3, avgHours: 2.9 },
  { taskType: '收割', count: 1246, doneRate: 79.5, avgHours: 4.2 },
  { taskType: '其他', count: 996, doneRate: 84.7, avgHours: 2.6 },
]

/** 作物选项 */
const CROP_OPTIONS: { value: string; label: string; factor: number }[] = [
  { value: 'ALL', label: '全部作物', factor: 1 },
  { value: 'RICE', label: '水稻', factor: 0.42 },
  { value: 'WHEAT', label: '小麦', factor: 0.33 },
  { value: 'CORN', label: '玉米', factor: 0.38 },
  { value: 'FRUIT', label: '果蔬', factor: 0.21 },
]

/** 租户选项 */
const TENANT_OPTIONS: { value: string; label: string; factor: number }[] = [
  { value: 'ALL', label: '全部租户', factor: 1 },
  { value: 'T20250001', label: '绿源农业', factor: 0.28 },
  { value: 'T20250002', label: '丰达农场', factor: 0.22 },
  { value: 'T20250003', label: '大地种业', factor: 0.31 },
  { value: 'T20250004', label: '丰收集团', factor: 0.19 },
]

/** 区域选项 */
const REGION_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: '全部区域' },
  ...REGION_BASE.map((item) => ({ value: item.region, label: item.region })),
]

/** 筛选条件 */
interface FilterState {
  date?: dayjs.Dayjs
  region: string
  crop: string
  tenant: string
}

/**
 * 生产报表页面
 * @returns 页面内容
 */
export default function AdminProductionReport(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm<FilterState>()
  const [filters, setFilters] = useState<FilterState>({
    date: dayjs('2025-07-14'),
    region: 'ALL',
    crop: 'ALL',
    tenant: 'ALL',
  })
  const [refreshing, setRefreshing] = useState<boolean>(false)

  /** 按筛选条件折算后的报表数据 */
  const report = useMemo(() => {
    const cropFactor = CROP_OPTIONS.find((item) => item.value === filters.crop)?.factor ?? 1
    const tenantFactor = TENANT_OPTIONS.find((item) => item.value === filters.tenant)?.factor ?? 1
    const factor = cropFactor * tenantFactor
    const regionRows = REGION_BASE.filter(
      (item) => filters.region === 'ALL' || item.region === filters.region,
    ).map((item) => {
      const output = Math.round(item.output * factor)
      return {
        key: item.region,
        region: item.region,
        area: Math.round(item.area * factor),
        output,
        share: 0,
        doneRate: Number((82 + ((item.activeFarms % 7) + 1)).toFixed(1)),
        activeFarms: Math.round(item.activeFarms * factor),
      }
    })
    const totalOutput = regionRows.reduce((sum, item) => sum + item.output, 0)
    const regionRowsWithShare = regionRows.map((item) => ({
      ...item,
      share: totalOutput === 0 ? 0 : Number(((item.output / totalOutput) * 100).toFixed(1)),
    }))
    const taskRows = TASK_BASE.map((item) => {
      const count = Math.round(item.count * factor)
      return {
        key: item.taskType,
        taskType: item.taskType,
        count,
        share: 0,
        doneRate: item.doneRate,
        avgHours: item.avgHours,
      }
    })
    const totalTasks = taskRows.reduce((sum, item) => sum + item.count, 0)
    const taskRowsWithShare = taskRows.map((item) => ({
      ...item,
      share: totalTasks === 0 ? 0 : Number(((item.count / totalTasks) * 100).toFixed(1)),
    }))
    const areaSum = regionRows.reduce((sum, item) => sum + item.area, 0)
    const farmsSum = regionRows.reduce((sum, item) => sum + item.activeFarms, 0)
    const taskDoneRate =
      totalTasks === 0
        ? 0
        : Number(
            (
              taskRows.reduce((sum, item) => sum + item.count * (item.doneRate / 100), 0) /
              totalTasks *
              100
            ).toFixed(1),
          )
    return {
      totalOutput,
      taskDoneRate,
      activeFarms: farmsSum,
      deviceOnlineRate: 94.5,
      totalTasks,
      area: areaSum,
      regionRows: regionRowsWithShare,
      taskRows: taskRowsWithShare,
    }
  }, [filters])

  /** 各区域产量对比图配置 */
  const regionChart: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 48, right: 24, top: 32, bottom: 40 },
    xAxis: {
      type: 'category',
      data: report.regionRows.map((item) => item.region),
      axisLabel: { color: '#666' },
    },
    yAxis: { type: 'value', name: '产量(吨)', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      {
        type: 'bar',
        barWidth: '45%',
        data: report.regionRows.map((item) => item.output),
        itemStyle: { color: '#13a05a', borderRadius: [4, 4, 0, 0] },
      },
    ],
  }

  /** 任务执行分布图配置 */
  const taskChart: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        data: report.taskRows.map((item) => ({ name: item.taskType, value: item.count })),
        label: { formatter: '{b}\n{d}%' },
      },
    ],
  }

  /** 统计日期文案 */
  const dateText = filters.date ? filters.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
  const tenantLabel = TENANT_OPTIONS.find((item) => item.value === filters.tenant)?.label ?? '全部租户'
  const cropLabel = CROP_OPTIONS.find((item) => item.value === filters.crop)?.label ?? '全部作物'
  const regionLabel = filters.region === 'ALL' ? '全部区域' : filters.region

  /**
   * 导出文件通用实现（前端 Blob）
   * @param content 文件内容
   * @param filename 文件名
   */
  const download = (content: string, filename: string): void => {
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    message.success(`${filename} 已导出`)
  }

  /** 导出 Excel（CSV 格式，Excel 可直接打开） */
  const handleExportExcel = (): void => {
    const header = ['区域', '种植面积(亩)', '总产量(吨)', '占比(%)', '任务完成率(%)', '活跃农场数']
    const rows = report.regionRows.map((item) => [
      item.region,
      String(item.area),
      String(item.output),
      String(item.share),
      String(item.doneRate),
      String(item.activeFarms),
    ])
    const header2 = ['任务类型', '任务数', '占比(%)', '完成率(%)', '平均耗时(h)']
    const rows2 = report.taskRows.map((item) => [
      item.taskType,
      String(item.count),
      String(item.share),
      String(item.doneRate),
      String(item.avgHours),
    ])
    const csv = [header, ...rows, [], header2, ...rows2]
      .map((line) => line.map((cell) => `"${cell}"`).join(','))
      .join('\r\n')
    download(csv, `生产报表_${dateText}.csv`)
  }

  /** 下载 PDF（摘要文本，占位 PDF 生成能力） */
  const handleDownloadPdf = (): void => {
    const content = [
      `生产日报 · ${dateText}`,
      `统计范围：${regionLabel} / ${cropLabel} / ${tenantLabel}`,
      `总产量(吨)：${report.totalOutput}`,
      `任务完成率(%)：${report.taskDoneRate}`,
      `活跃农场数：${report.activeFarms}`,
      `设备在线率(%)：${report.deviceOnlineRate}`,
      `在田面积(亩)：${report.area.toLocaleString()}`,
      '',
      ...report.regionRows.map(
        (item) => `${item.region}：产量 ${item.output} 吨，占比 ${item.share}%，活跃农场 ${item.activeFarms}`,
      ),
    ].join('\n')
    download(content, `生产日报_${dateText}.txt`)
  }

  /** 触发生成报表（调用后端，失败时提示演示模式） */
  const handleGenerate = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await generateProductionReport({ period: dateText, tenantId: filters.tenant })
      message.success('已向服务端提交报表生成任务')
      const page = await listProductionReports({ pageNum: 1, pageSize: 10, period: dateText })
      if (page && Array.isArray(page.list)) {
        message.info(`服务端已存在 ${page.total} 份该周期报表`)
      }
    } catch {
      message.info('后端服务暂不可用，当前使用本地计算结果')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Form<FilterState>
          form={form}
          layout="inline"
          style={{ rowGap: 12 }}
          initialValues={filters}
          onFinish={(values) => setFilters({ ...values, date: values.date ?? dayjs() })}
        >
          <Form.Item name="date" label="统计日期">
            <DatePicker allowClear={false} />
          </Form.Item>
          <Form.Item name="region" label="区域">
            <Select style={{ width: 140 }} options={REGION_OPTIONS} />
          </Form.Item>
          <Form.Item name="crop" label="作物">
            <Select style={{ width: 140 }} options={CROP_OPTIONS} />
          </Form.Item>
          <Form.Item name="tenant" label="租户">
            <Select style={{ width: 160 }} options={TENANT_OPTIONS} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void handleGenerate()}>
                生成报表
              </Button>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/production/reports')}>
                返回报表中心
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={`生产日报 · ${dateText}`}
        extra={
          <Space>
            <Typography.Text type="secondary">
              {regionLabel} / {cropLabel} / {tenantLabel}
            </Typography.Text>
            <Button icon={<FilePdfOutlined />} onClick={handleDownloadPdf}>
              下载PDF
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportExcel}>
              导出Excel
            </Button>
          </Space>
        }
      >
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="总产量(吨)"
              value={report.totalOutput}
              precision={0}
              suffix="↑ 3.2%"
              valueStyle={{ color: '#13a05a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="任务完成率"
              value={report.taskDoneRate}
              suffix="% ↑ 1.8%"
              valueStyle={{ color: '#13a05a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic title="活跃农场" value={report.activeFarms} suffix="→ 持平" />
          </Col>
          <Col span={6}>
            <Statistic
              title="设备在线率"
              value={report.deviceOnlineRate}
              suffix="% ↓ 0.3%"
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="各区域产量对比">
            <ReactECharts option={regionChart} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="任务执行分布">
            <ReactECharts option={taskChart} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <Card title="区域产量明细">
        <Table
          size="small"
          pagination={false}
          rowKey="key"
          dataSource={report.regionRows}
          columns={[
            { title: '区域', dataIndex: 'region' },
            { title: '种植面积(亩)', dataIndex: 'area', render: (v: number) => v.toLocaleString() },
            { title: '总产量(吨)', dataIndex: 'output' },
            { title: '占比', dataIndex: 'share', render: (v: number) => `${v}%` },
            { title: '任务完成率', dataIndex: 'doneRate', render: (v: number) => `${v}%` },
            { title: '活跃农场', dataIndex: 'activeFarms' },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                {report.area.toLocaleString()}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2}>{report.totalOutput}</Table.Summary.Cell>
              <Table.Summary.Cell index={3}>100%</Table.Summary.Cell>
              <Table.Summary.Cell index={4}>—</Table.Summary.Cell>
              <Table.Summary.Cell index={5}>{report.activeFarms}</Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>

      <Card title="任务执行明细">
        <Table
          size="small"
          pagination={false}
          rowKey="key"
          dataSource={report.taskRows}
          columns={[
            { title: '任务类型', dataIndex: 'taskType' },
            { title: '任务数', dataIndex: 'count' },
            { title: '占比', dataIndex: 'share', render: (v: number) => `${v}%` },
            { title: '完成率', dataIndex: 'doneRate', render: (v: number) => `${v}%` },
            { title: '平均耗时(小时)', dataIndex: 'avgHours' },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
              <Table.Summary.Cell index={1}>{report.totalTasks}</Table.Summary.Cell>
              <Table.Summary.Cell index={2}>100%</Table.Summary.Cell>
              <Table.Summary.Cell index={3}>—</Table.Summary.Cell>
              <Table.Summary.Cell index={4}>—</Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </Space>
  )
}
