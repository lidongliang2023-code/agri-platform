/**
 * 页面名称：质量报表
 * 路由路径：/admin/production/reports/quality
 * 所属模块：统计报表
 * PRD 序号：PRD 6.2 #30
 * 原型页码：P28 quality-reports
 *
 * 交互说明（对照原型 P28）：
 * - 顶部按钮：下载PDF / 导出Excel / 返回报表中心；
 * - 指标卡：检测合格率 95.2%、本月检测次数 1,280、不合格批次 62、整改完成率 88.5%；
 * - 多维筛选：统计月份、区域、作物、检测机构；
 * - 图表：检测合格率趋势(近6月) 折线图、不合格原因分布 饼图；
 * - 明细表：质量检测结果明细（月份 / 检测批次 / 合格数 / 不合格数 / 合格率 / 整改数 / 整改完成）。
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
import { generateQualityReport, listQualityReports } from '@/api'

/** 近 6 月合格率趋势（原型 P28） */
const TREND_BASE: { month: string; checkBatch: number; passCount: number; failCount: number; rectifyCount: number; rectifyDone: number }[] = [
  { month: '2025-02', checkBatch: 920, passCount: 861, failCount: 59, rectifyCount: 52, rectifyDone: 46 },
  { month: '2025-03', checkBatch: 1010, passCount: 953, failCount: 57, rectifyCount: 50, rectifyDone: 45 },
  { month: '2025-04', checkBatch: 980, passCount: 918, failCount: 62, rectifyCount: 55, rectifyDone: 48 },
  { month: '2025-05', checkBatch: 1080, passCount: 1020, failCount: 60, rectifyCount: 54, rectifyDone: 50 },
  { month: '2025-06', checkBatch: 1150, passCount: 1092, failCount: 58, rectifyCount: 52, rectifyDone: 48 },
  { month: '2025-07', checkBatch: 1280, passCount: 1218, failCount: 62, rectifyCount: 55, rectifyDone: 49 },
]

/** 不合格原因分布（原型 P28） */
const FAIL_REASON_BASE: { reason: string; rate: number }[] = [
  { reason: '农药超标', rate: 35 },
  { reason: '重金属', rate: 25 },
  { reason: '微生物', rate: 20 },
  { reason: '物理指标', rate: 12 },
  { reason: '其他', rate: 8 },
]

/** 区域选项 */
const REGION_OPTIONS: { value: string; label: string; factor: number }[] = [
  { value: 'ALL', label: '全部区域', factor: 1 },
  { value: '河南', label: '河南', factor: 0.26 },
  { value: '山东', label: '山东', factor: 0.24 },
  { value: '黑龙江', label: '黑龙江', factor: 0.19 },
  { value: '江苏', label: '江苏', factor: 0.16 },
  { value: '广东', label: '广东', factor: 0.15 },
]

/** 作物选项 */
const CROP_OPTIONS: { value: string; label: string; factor: number }[] = [
  { value: 'ALL', label: '全部作物', factor: 1 },
  { value: 'RICE', label: '水稻', factor: 0.4 },
  { value: 'WHEAT', label: '小麦', factor: 0.3 },
  { value: 'FRUIT', label: '果蔬', factor: 0.22 },
  { value: 'LIVESTOCK', label: '畜禽产品', factor: 0.16 },
]

/** 检测机构选项 */
const LAB_OPTIONS: { value: string; label: string; factor: number }[] = [
  { value: 'ALL', label: '全部机构', factor: 1 },
  { value: 'NQCC', label: '国家质检中心', factor: 0.45 },
  { value: 'SGS', label: 'SGS', factor: 0.33 },
  { value: 'PROV', label: '省农检中心', factor: 0.22 },
]

/** 筛选条件 */
interface FilterState {
  month?: dayjs.Dayjs
  region: string
  crop: string
  lab: string
}

/**
 * 质量报表页面
 * @returns 页面内容
 */
export default function AdminQualityReport(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm<FilterState>()
  const [filters, setFilters] = useState<FilterState>({
    month: dayjs('2025-07'),
    region: 'ALL',
    crop: 'ALL',
    lab: 'ALL',
  })
  const [refreshing, setRefreshing] = useState<boolean>(false)

  /** 按筛选条件折算后的报表数据 */
  const report = useMemo(() => {
    const regionFactor = REGION_OPTIONS.find((item) => item.value === filters.region)?.factor ?? 1
    const cropFactor = CROP_OPTIONS.find((item) => item.value === filters.crop)?.factor ?? 1
    const labFactor = LAB_OPTIONS.find((item) => item.value === filters.lab)?.factor ?? 1
    const factor = Math.max(regionFactor * cropFactor * labFactor, 0.02)
    const rows = TREND_BASE.map((item) => {
      const checkBatch = Math.max(1, Math.round(item.checkBatch * factor))
      const passCount = Math.max(0, Math.round(item.passCount * factor))
      const failCount = Math.max(0, checkBatch - passCount)
      const rectifyCount = Math.max(0, Math.round(item.rectifyCount * factor))
      const rectifyDone = Math.min(rectifyCount, Math.max(0, Math.round(item.rectifyDone * factor)))
      return {
        key: item.month,
        month: item.month,
        checkBatch,
        passCount,
        failCount,
        passRate: Number(((passCount / checkBatch) * 100).toFixed(1)),
        rectifyCount,
        rectifyDone,
      }
    })
    const current = rows[rows.length - 1]
    return {
      rows,
      current,
      passRate: current.passRate,
      checkBatch: current.checkBatch,
      failCount: current.failCount,
      rectifyDoneRate:
        current.rectifyCount === 0
          ? 0
          : Number(((current.rectifyDone / current.rectifyCount) * 100).toFixed(1)),
      failReasons: FAIL_REASON_BASE.map((item) => ({
        reason: item.reason,
        rate: item.rate,
        count: Math.max(0, Math.round((current.failCount * item.rate) / 100)),
      })),
    }
  }, [filters])

  /** 合格率趋势图配置 */
  const trendChart: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 56, right: 24, top: 32, bottom: 40 },
    legend: { data: ['合格率(%)'], bottom: 0 },
    xAxis: { type: 'category', data: report.rows.map((item) => item.month) },
    yAxis: {
      type: 'value',
      name: '合格率(%)',
      min: 80,
      max: 100,
      splitLine: { lineStyle: { type: 'dashed' } },
    },
    series: [
      {
        name: '合格率(%)',
        type: 'line',
        smooth: true,
        data: report.rows.map((item) => item.passRate),
        itemStyle: { color: '#13a05a' },
        areaStyle: { color: 'rgba(19,160,90,0.12)' },
        markLine: {
          silent: true,
          data: [{ yAxis: 95, name: '目标 95%' }],
          lineStyle: { color: '#faad14', type: 'dashed' },
        },
      },
    ],
  }

  /** 不合格原因分布图配置 */
  const reasonChart: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 批次 ({d}%)' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10 },
    series: [
      {
        type: 'pie',
        radius: ['38%', '62%'],
        data: report.failReasons.map((item) => ({ name: item.reason, value: item.count })),
        label: { formatter: '{b}\n{d}%' },
      },
    ],
  }

  /** 统计月份文案 */
  const monthText = filters.month ? filters.month.format('YYYY-MM') : dayjs().format('YYYY-MM')
  const regionLabel = REGION_OPTIONS.find((item) => item.value === filters.region)?.label ?? '全部区域'
  const cropLabel = CROP_OPTIONS.find((item) => item.value === filters.crop)?.label ?? '全部作物'
  const labLabel = LAB_OPTIONS.find((item) => item.value === filters.lab)?.label ?? '全部机构'

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

  /** 导出 Excel（CSV 格式） */
  const handleExportExcel = (): void => {
    const header = [
      '月份',
      '检测批次',
      '合格数',
      '不合格数',
      '合格率(%)',
      '整改数',
      '整改完成',
    ]
    const rows = report.rows.map((item) => [
      item.month,
      String(item.checkBatch),
      String(item.passCount),
      String(item.failCount),
      String(item.passRate),
      String(item.rectifyCount),
      String(item.rectifyDone),
    ])
    const header2 = ['不合格原因', '占比(%)', '批次']
    const rows2 = report.failReasons.map((item) => [
      item.reason,
      String(item.rate),
      String(item.count),
    ])
    const csv = [header, ...rows, [], header2, ...rows2]
      .map((line) => line.map((cell) => `"${cell}"`).join(','))
      .join('\r\n')
    download(csv, `质量报表_${monthText}.csv`)
  }

  /** 下载 PDF（摘要文本） */
  const handleDownloadPdf = (): void => {
    const content = [
      `质量月报 · ${monthText}`,
      `统计范围：${regionLabel} / ${cropLabel} / ${labLabel}`,
      `检测合格率(%)：${report.passRate}`,
      `检测批次：${report.checkBatch}`,
      `不合格批次：${report.failCount}`,
      `整改完成率(%)：${report.rectifyDoneRate}`,
      '',
      ...report.failReasons.map((item) => `${item.reason}：占比 ${item.rate}%，批次 ${item.count}`),
    ].join('\n')
    download(content, `质量月报_${monthText}.txt`)
  }

  /** 触发生成质量报表 */
  const handleGenerate = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await generateQualityReport({ period: monthText })
      message.success('已向服务端提交报表生成任务')
      const page = await listQualityReports({ pageNum: 1, pageSize: 10, period: monthText })
      if (page && Array.isArray(page.list)) {
        message.info(`服务端已存在 ${page.total} 份该周期质量报表`)
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
          onFinish={(values) => setFilters({ ...values, month: values.month ?? dayjs() })}
        >
          <Form.Item name="month" label="统计月份">
            <DatePicker picker="month" allowClear={false} />
          </Form.Item>
          <Form.Item name="region" label="区域">
            <Select style={{ width: 140 }} options={REGION_OPTIONS} />
          </Form.Item>
          <Form.Item name="crop" label="作物">
            <Select style={{ width: 140 }} options={CROP_OPTIONS} />
          </Form.Item>
          <Form.Item name="lab" label="检测机构">
            <Select style={{ width: 160 }} options={LAB_OPTIONS} />
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
        title={`质量月报 · ${monthText}`}
        extra={
          <Space>
            <Typography.Text type="secondary">
              {regionLabel} / {cropLabel} / {labLabel}
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
              title="检测合格率"
              value={report.passRate}
              suffix="% ↑ 0.5%"
              valueStyle={{ color: '#13a05a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic title="本月检测次数" value={report.checkBatch} suffix="批次" />
          </Col>
          <Col span={6}>
            <Statistic
              title="不合格批次"
              value={report.failCount}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col span={6}>
            <Statistic title="整改完成率" value={report.rectifyDoneRate} suffix="%" />
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="检测合格率趋势(近6月)">
            <ReactECharts option={trendChart} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="不合格原因分布">
            <ReactECharts option={reasonChart} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <Card title="质量检测结果明细">
        <Table
          size="small"
          pagination={false}
          rowKey="key"
          dataSource={report.rows}
          columns={[
            { title: '月份', dataIndex: 'month' },
            { title: '检测批次', dataIndex: 'checkBatch' },
            { title: '合格数', dataIndex: 'passCount' },
            { title: '不合格数', dataIndex: 'failCount' },
            { title: '合格率', dataIndex: 'passRate', render: (v: number) => `${v}%` },
            { title: '整改数', dataIndex: 'rectifyCount' },
            { title: '整改完成', dataIndex: 'rectifyDone' },
          ]}
        />
      </Card>
    </Space>
  )
}
