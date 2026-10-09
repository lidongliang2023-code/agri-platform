/**
 * 页面名称：土壤检测档案
 * 路由路径：/production/plots/:plotId/soil
 * 所属模块：农场数字化管理
 * PRD 序号：PRD 6.1 #8
 *
 * 原型无此页，按 PRD「土壤检测记录、肥力趋势、改良建议」设计：
 * 1. 检测记录列表：检测日期 / pH / 有机质 / 全氮 / 有效磷 / 速效钾 / 含水量 / 检测机构（支持新增与删除）
 * 2. 肥力趋势图：ECharts 多序列折线（pH 走右轴，有机质与氮磷钾走左轴）
 * 3. 改良建议：依据最新检测值按农艺阈值自动推导（酸碱调节 / 有机质提升 / 氮磷钾补充 / 水分管理）
 *
 * 数据说明：后端 entity 字段为 soilId / sampleDate / nitrogen / phosphorus / potassium /
 * salinity / tester，与本仓 SoilTestRecord 命名并存，本页按两套键名兼容读取。
 *
 * 接口层约定：全部读写走 `@/api/plots`（listSoilRecords / createSoilTest / deleteSoilTest），
 * 本页不含 http 直连。注意列表必须用 listSoilRecords（打真分页端点 GET /{plotId}/soil），
 * 不能用 listSoilTests（打 /soil-tests 别名，返回裸数组、不吃分页）。
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import ReactECharts from 'echarts-for-react'
import {
  CheckCircleOutlined,
  ExperimentOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  PlusOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  createSoilTest,
  deleteSoilTest,
  getPlot,
  listSoilRecords,
} from '@/api/plots'
import type { SoilCreatePayload } from '@/api/plots'
import type { SoilTestRecord } from '@/types'

/**
 * 土壤检测记录行（兼容两套字段命名）
 *
 * - 后端 PlotSoilEntity：soilId / sampleDate / nitrogen / phosphorus / potassium / salinity / tester
 * - 本仓 SoilTestRecord：recordId / testDate / totalNitrogen / availablePhosphorus /
 *   availablePotassium / testOrg
 * 两者并存，本页统一按两套键名读取（见 pickNumber / pickDate / pickId / pickTester）。
 */
interface SoilRow extends Partial<SoilTestRecord> {
  /** 记录 ID（后端 PlotSoilEntity） */
  soilId?: string
  /** 采样 / 检测日期（后端 PlotSoilEntity） */
  sampleDate?: string
  /** 碱解氮 mg/kg（后端 PlotSoilEntity） */
  nitrogen?: number
  /** 有效磷 mg/kg（后端 PlotSoilEntity） */
  phosphorus?: number
  /** 速效钾 mg/kg（后端 PlotSoilEntity） */
  potassium?: number
  /** 含盐量 g/kg（后端 PlotSoilEntity） */
  salinity?: number
  /** 检测人（后端 PlotSoilEntity） */
  tester?: string
  /** 备注 */
  remark?: string
}

/** 新增记录表单值 */
interface SoilFormValues {
  /** 检测日期 */
  date: dayjs.Dayjs
  /** pH */
  ph?: number
  /** 有机质 */
  organicMatter?: number
  /** 全氮 */
  nitrogen?: number
  /** 有效磷 */
  phosphorus?: number
  /** 速效钾 */
  potassium?: number
  /** 含水量 */
  moisture?: number
  /** 检测机构 / 检测人 */
  tester?: string
  /** 备注 */
  remark?: string
}

/** 建议等级 */
type SuggestionLevel = 'success' | 'warning' | 'info'

/** 改良建议条目 */
interface Suggestion {
  /** 唯一键 */
  key: string
  /** 等级 */
  level: SuggestionLevel
  /** 标题 */
  title: string
  /** 建议详情 */
  desc: string
}

/** 取兼容字段：优先后端实体命名，其次本仓 SoilTestRecord 命名 */
function pickNumber(row: SoilRow, key: keyof SoilRow, alias: keyof SoilRow): number | undefined {
  const primary = row[key]
  if (primary !== undefined && primary !== null && !Number.isNaN(Number(primary))) {
    return Number(primary)
  }
  const secondary = row[alias]
  if (secondary !== undefined && secondary !== null && !Number.isNaN(Number(secondary))) {
    return Number(secondary)
  }
  return undefined
}

/** 取日期兼容字段 */
function pickDate(row: SoilRow): string | undefined {
  return row.sampleDate ?? row.testDate
}

/** 取记录主键 */
function pickId(row: SoilRow): string {
  return row.soilId ?? row.recordId ?? ''
}

/** 取检测机构 / 检测人 */
function pickTester(row: SoilRow): string | undefined {
  return row.tester ?? row.testOrg
}

/**
 * 根据最新检测记录推导改良建议。
 *
 * @param row 最新检测记录
 * @returns 建议列表
 */
function buildSuggestions(row: SoilRow | undefined): Suggestion[] {
  if (!row) return []
  const list: Suggestion[] = []
  const ph = pickNumber(row, 'ph', 'ph')
  const organic = pickNumber(row, 'organicMatter', 'organicMatter')
  const nitrogen = pickNumber(row, 'nitrogen', 'totalNitrogen')
  const phosphorus = pickNumber(row, 'phosphorus', 'availablePhosphorus')
  const potassium = pickNumber(row, 'potassium', 'availablePotassium')
  const moisture = pickNumber(row, 'moisture', 'moisture')

  if (ph !== undefined) {
    if (ph < 6) {
      list.push({
        key: 'ph-low',
        level: 'warning',
        title: '土壤偏酸，建议施用石灰调酸',
        desc: `当前 pH ${ph}，低于多数作物适宜下限 6.0。建议每亩施用生石灰 100-150kg 于整地前均匀撒施，配合增施有机肥以提升缓冲能力，施用后 30 天复测 pH。`,
      })
    } else if (ph > 7.8) {
      list.push({
        key: 'ph-high',
        level: 'warning',
        title: '土壤偏碱，建议施用硫磺粉改碱',
        desc: `当前 pH ${ph}，高于 7.8，易诱发缺铁、缺锌黄化。建议每亩施用硫磺粉 20-30kg 或硫酸亚铁 15-25kg，并优先选择酸性肥料（硫酸铵、磷酸二铵）。`,
      })
    } else {
      list.push({
        key: 'ph-ok',
        level: 'success',
        title: '酸碱度适宜',
        desc: `当前 pH ${ph}，处于作物适宜区间 6.0-7.8，维持现有施肥方案即可，建议每季复测一次。`,
      })
    }
  }

  if (organic !== undefined) {
    if (organic < 15) {
      list.push({
        key: 'om-low',
        level: 'warning',
        title: '有机质偏低，建议增施有机肥',
        desc: `当前有机质 ${organic} g/kg，低于 15 g/kg 的地力下限。建议每亩增施腐熟有机肥 2-3 方或商品有机肥 300-500kg，配合秸秆还田，连续 2-3 季提升至 20 g/kg 以上。`,
      })
    } else {
      list.push({
        key: 'om-ok',
        level: 'success',
        title: '有机质含量充足',
        desc: `当前有机质 ${organic} g/kg，地力基础良好，建议保持有机肥年度投入，避免连续单施化肥导致有机质下降。`,
      })
    }
  }

  if (nitrogen !== undefined) {
    if (nitrogen < 1) {
      list.push({
        key: 'n-low',
        level: 'info',
        title: '全氮偏低，建议补充氮肥',
        desc: `当前全氮 ${nitrogen} g/kg，低于 1.0 g/kg。建议基肥增施尿素 10-15kg/亩，结合作物关键生育期追肥，注意少量多次以减少淋溶损失。`,
      })
    } else {
      list.push({
        key: 'n-ok',
        level: 'success',
        title: '全氮供应充足',
        desc: `当前全氮 ${nitrogen} g/kg，处于正常水平，按作物需肥规律分次施用即可。`,
      })
    }
  }

  if (phosphorus !== undefined) {
    if (phosphorus < 10) {
      list.push({
        key: 'p-low',
        level: 'warning',
        title: '有效磷缺乏，建议增施磷肥',
        desc: `当前有效磷 ${phosphorus} mg/kg，低于 10 mg/kg 缺磷临界值。建议基肥增施过磷酸钙 30-40kg/亩或磷酸二铵 15-20kg/亩，集中沟施以提高利用率。`,
      })
    } else if (phosphorus > 40) {
      list.push({
        key: 'p-high',
        level: 'info',
        title: '有效磷偏高，建议控磷',
        desc: `当前有效磷 ${phosphorus} mg/kg，超过 40 mg/kg，存在面源污染风险。建议本季暂停磷肥投入，改以氮钾为主并监测淋溶流失。`,
      })
    } else {
      list.push({
        key: 'p-ok',
        level: 'success',
        title: '有效磷水平适宜',
        desc: `当前有效磷 ${phosphorus} mg/kg，处于 10-40 mg/kg 适宜区间，维持常规磷肥投入即可。`,
      })
    }
  }

  if (potassium !== undefined) {
    if (potassium < 100) {
      list.push({
        key: 'k-low',
        level: 'warning',
        title: '速效钾不足，建议补施钾肥',
        desc: `当前速效钾 ${potassium} mg/kg，低于 100 mg/kg。建议追施硫酸钾 10-15kg/亩（忌氯作物优先硫酸钾），膨果/灌浆期分次施用。`,
      })
    } else if (potassium > 200) {
      list.push({
        key: 'k-high',
        level: 'info',
        title: '速效钾富余，建议减量',
        desc: `当前速效钾 ${potassium} mg/kg，高于 200 mg/kg。建议本季钾肥减半并关注钙镁拮抗问题。`,
      })
    } else {
      list.push({
        key: 'k-ok',
        level: 'success',
        title: '速效钾水平合理',
        desc: `当前速效钾 ${potassium} mg/kg，处于 100-200 mg/kg 合理区间，按需补施即可。`,
      })
    }
  }

  if (moisture !== undefined) {
    if (moisture < 60) {
      list.push({
        key: 'water-low',
        level: 'info',
        title: '土壤含水量偏低，建议及时补灌',
        desc: `当前含水量 ${moisture}%，建议结合滴灌补至田间持水量 70% 左右，避免干旱胁迫影响养分吸收。`,
      })
    } else if (moisture > 85) {
      list.push({
        key: 'water-high',
        level: 'info',
        title: '土壤含水量过高，建议控水排渍',
        desc: `当前含水量 ${moisture}%，土壤通气性差易致根系病害。建议暂停灌溉并清理排水沟，必要时中耕散墒。`,
      })
    }
  }

  return list
}

/**
 * 构建肥力趋势图配置。
 *
 * @param rows 检测记录（按日期升序）
 * @returns ECharts 配置
 */
function buildTrendOption(rows: SoilRow[]): Record<string, unknown> {
  const dates = rows.map((row) => pickDate(row) ?? '-')
  return {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['pH', '有机质', '全氮', '有效磷', '速效钾'],
      bottom: 0,
      type: 'scroll',
    },
    grid: { left: 56, right: 56, top: 24, bottom: 56 },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: [
      { type: 'value', name: 'mg/kg · g/kg' },
      { type: 'value', name: 'pH', min: 4, max: 9 },
    ],
    series: [
      {
        name: 'pH',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: rows.map((row) => pickNumber(row, 'ph', 'ph') ?? null),
        itemStyle: { color: '#722ed1' },
      },
      {
        name: '有机质',
        type: 'line',
        smooth: true,
        data: rows.map((row) => pickNumber(row, 'organicMatter', 'organicMatter') ?? null),
        itemStyle: { color: '#52c41a' },
      },
      {
        name: '全氮',
        type: 'line',
        smooth: true,
        data: rows.map((row) => pickNumber(row, 'nitrogen', 'totalNitrogen') ?? null),
        itemStyle: { color: '#1677ff' },
      },
      {
        name: '有效磷',
        type: 'line',
        smooth: true,
        data: rows.map((row) => pickNumber(row, 'phosphorus', 'availablePhosphorus') ?? null),
        itemStyle: { color: '#fa8c16' },
      },
      {
        name: '速效钾',
        type: 'line',
        smooth: true,
        data: rows.map((row) => pickNumber(row, 'potassium', 'availablePotassium') ?? null),
        itemStyle: { color: '#eb2f96' },
      },
    ],
  }
}

/** 建议等级 → 图标与颜色 */
const LEVEL_META: Record<SuggestionLevel, { icon: JSX.Element; color: string }> = {
  success: { icon: <CheckCircleOutlined />, color: '#52c41a' },
  warning: { icon: <WarningOutlined />, color: '#fa8c16' },
  info: { icon: <InfoCircleOutlined />, color: '#1677ff' },
}

/**
 * 土壤检测档案页
 *
 * 业务职责：展示地块历次土壤检测指标、肥力趋势与自动生成的改良建议。
 *
 * @returns 页面内容
 */
export default function PlotSoilRecords(): JSX.Element {
  const { plotId } = useParams<{ plotId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [createForm] = Form.useForm<SoilFormValues>()

  /** 地块信息 */
  const plotQuery = useQuery({
    queryKey: ['plot-detail', plotId],
    enabled: Boolean(plotId),
    queryFn: () => getPlot(plotId as string),
  })

  /** 土壤检测记录（分页，走 api 层 listSoilRecords → GET /plots/{plotId}/soil） */
  const soilQuery = useQuery({
    queryKey: ['plot-soil-records', plotId],
    enabled: Boolean(plotId),
    queryFn: () => listSoilRecords(plotId as string, { pageNum: 1, pageSize: 100 }),
    retry: false,
  })

  /** 新增检测记录（写操作走 api 层 createSoilTest → POST /plots/{plotId}/soil） */
  const createMutation = useMutation({
    mutationFn: (values: SoilFormValues) => {
      const payload: SoilCreatePayload = {
        plotId,
        sampleDate: values.date.format('YYYY-MM-DD'),
        ph: values.ph,
        organicMatter: values.organicMatter,
        nitrogen: values.nitrogen,
        phosphorus: values.phosphorus,
        potassium: values.potassium,
        moisture: values.moisture,
        tester: values.tester,
        remark: values.remark,
      }
      // 后端实际返回 ApiResponse<String>（新记录主键），此处只依赖副作用，不消费返回值。
      return createSoilTest(plotId as string, payload)
    },
    onSuccess: () => {
      message.success('土壤检测记录已保存')
      setCreateOpen(false)
      createForm.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['plot-soil-records', plotId] })
    },
  })

  /** 删除检测记录（写操作走 api 层 deleteSoilTest → DELETE /plots/{plotId}/soil/{recordId}） */
  const deleteMutation = useMutation({
    mutationFn: (recordId: string) => deleteSoilTest(plotId as string, recordId),
    onSuccess: () => {
      message.success('检测记录已删除')
      void queryClient.invalidateQueries({ queryKey: ['plot-soil-records', plotId] })
    },
  })

  /** 按日期升序排列的记录 */
  const rows = useMemo<SoilRow[]>(() => {
    // listSoilRecords 返回 PageResult<SoilTestRecord>，运行时实体是 PlotSoilEntity 命名，
    // 由 SoilRow 吸收两套字段名差异（结构兼容，无需断言转换）。
    const list: SoilRow[] = soilQuery.data?.list ?? []
    return [...list].sort((a, b) => (pickDate(a) ?? '').localeCompare(pickDate(b) ?? ''))
  }, [soilQuery.data])

  /** 最新一条记录 */
  const latest = rows.length > 0 ? rows[rows.length - 1] : undefined

  /** 改良建议 */
  const suggestions = useMemo<Suggestion[]>(() => buildSuggestions(latest), [latest])

  /** 列表列定义 */
  const columns: ColumnsType<SoilRow> = [
    {
      title: '检测日期',
      dataIndex: 'sampleDate',
      width: 120,
      render: (_, record) => pickDate(record) ?? '-',
    },
    {
      title: 'pH',
      key: 'ph',
      width: 90,
      render: (_, record) => {
        const value = pickNumber(record, 'ph', 'ph')
        if (value === undefined) return '-'
        const abnormal = value < 6 || value > 7.8
        return <Tag color={abnormal ? 'orange' : 'green'}>{value}</Tag>
      },
    },
    {
      title: '有机质(g/kg)',
      key: 'organicMatter',
      width: 120,
      render: (_, record) => pickNumber(record, 'organicMatter', 'organicMatter') ?? '-',
    },
    {
      title: '全氮(g/kg)',
      key: 'nitrogen',
      width: 110,
      render: (_, record) => pickNumber(record, 'nitrogen', 'totalNitrogen') ?? '-',
    },
    {
      title: '有效磷(mg/kg)',
      key: 'phosphorus',
      width: 120,
      render: (_, record) => pickNumber(record, 'phosphorus', 'availablePhosphorus') ?? '-',
    },
    {
      title: '速效钾(mg/kg)',
      key: 'potassium',
      width: 120,
      render: (_, record) => pickNumber(record, 'potassium', 'availablePotassium') ?? '-',
    },
    {
      title: '含水量(%)',
      key: 'moisture',
      width: 110,
      render: (_, record) => pickNumber(record, 'moisture', 'moisture') ?? '-',
    },
    {
      title: '检测机构 / 检测人',
      key: 'tester',
      width: 160,
      render: (_, record) => pickTester(record) ?? '-',
    },
    {
      title: '备注',
      key: 'remark',
      ellipsis: true,
      render: (_, record) => record.remark ?? '-',
    },
    {
      title: '操作',
      key: 'option',
      width: 90,
      fixed: 'right',
      render: (_, record) => (
        <Popconfirm
          title="确认删除该检测记录？"
          okText="确认删除"
          cancelText="取消"
          onConfirm={() => deleteMutation.mutate(pickId(record))}
        >
          <Typography.Link type="danger">删除</Typography.Link>
        </Popconfirm>
      ),
    },
  ]

  return (
    <PageContainer
      title={`🧪 ${plotQuery.data?.plotName ?? '土壤检测档案'}`}
      subTitle={plotQuery.data ? `${plotQuery.data.plotCode} · 土壤肥力档案` : undefined}
      onBack={() => navigate(`/production/plots/${plotId}`)}
      backIcon={<LeftOutlined />}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          新增检测记录
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <Card>
              <Typography.Text type="secondary">检测次数</Typography.Text>
              <div>
                <Typography.Text strong style={{ fontSize: 22 }}>
                  {rows.length}
                </Typography.Text>
                <Typography.Text type="secondary"> 次</Typography.Text>
              </div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Typography.Text type="secondary">最新 pH</Typography.Text>
              <div>
                <Typography.Text strong style={{ fontSize: 22 }}>
                  {latest ? (pickNumber(latest, 'ph', 'ph') ?? '-') : '-'}
                </Typography.Text>
              </div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Typography.Text type="secondary">有机质(g/kg)</Typography.Text>
              <div>
                <Typography.Text strong style={{ fontSize: 22 }}>
                  {latest ? (pickNumber(latest, 'organicMatter', 'organicMatter') ?? '-') : '-'}
                </Typography.Text>
              </div>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Typography.Text type="secondary">最近检测日期</Typography.Text>
              <div>
                <Typography.Text strong style={{ fontSize: 22 }}>
                  {latest ? (pickDate(latest) ?? '-') : '-'}
                </Typography.Text>
              </div>
            </Card>
          </Col>
        </Row>

        <Card title="📋 检测记录">
          {soilQuery.isLoading ? (
            <Card loading />
          ) : rows.length === 0 ? (
            <Empty
              description={
                <Space direction="vertical">
                  <Typography.Text type="secondary">
                    该地块暂无土壤检测记录
                  </Typography.Text>
                  <Button type="primary" onClick={() => setCreateOpen(true)}>
                    录入首条检测数据
                  </Button>
                </Space>
              }
            />
          ) : (
            <Table<SoilRow>
              rowKey={(record) => pickId(record) || pickDate(record) || Math.random().toString()}
              columns={columns}
              dataSource={rows}
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: 1200 }}
            />
          )}
        </Card>

        <Card title="📈 肥力趋势">
          {rows.length < 2 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="至少需要 2 条检测记录才能生成肥力趋势"
            />
          ) : (
            <ReactECharts option={buildTrendOption(rows)} style={{ height: 320 }} notMerge />
          )}
        </Card>

        <Card title="🌱 改良建议">
          {suggestions.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无检测数据，无法生成改良建议"
            />
          ) : (
            <Row gutter={[12, 12]}>
              {suggestions.map((item) => {
                const meta = LEVEL_META[item.level]
                return (
                  <Col key={item.key} xs={24} md={12} xl={8}>
                    <Card
                      size="small"
                      style={{ borderLeft: `3px solid ${meta.color}`, height: '100%' }}
                    >
                      <Space align="start" size={8}>
                        <span style={{ color: meta.color, fontSize: 16 }}>{meta.icon}</span>
                        <div>
                          <Typography.Text strong>{item.title}</Typography.Text>
                          <div>
                            <Typography.Text type="secondary">{item.desc}</Typography.Text>
                          </div>
                        </div>
                      </Space>
                    </Card>
                  </Col>
                )
              })}
            </Row>
          )}
        </Card>
      </Space>

      <Modal
        title="新增土壤检测记录"
        open={createOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={() => {
          void createForm.validateFields().then((values) => createMutation.mutate(values))
        }}
        destroyOnClose
        width={640}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="date"
            label="检测日期"
            rules={[{ required: true, message: '请选择检测日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="请选择检测日期" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ph" label="pH 值">
                <InputNumber min={0} max={14} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="organicMatter" label="有机质(g/kg)">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="nitrogen" label="全氮(g/kg)">
                <InputNumber min={0} precision={3} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="phosphorus" label="有效磷(mg/kg)">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="potassium" label="速效钾(mg/kg)">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="moisture" label="含水量(%)">
                <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tester" label="检测机构 / 检测人">
                <Input placeholder="例如：中检集团" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} maxLength={200} showCount placeholder="选填，200 字以内" />
          </Form.Item>
        </Form>
      </Modal>

      {!plotId && (
        <Empty description={<Typography.Text type="danger">缺少地块参数</Typography.Text>} />
      )}
      <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
        <ExperimentOutlined /> 提示：建议每季至少检测 1 次，连续记录可显著提升肥力趋势预测准确度。
      </Typography.Paragraph>
    </PageContainer>
  )
}
