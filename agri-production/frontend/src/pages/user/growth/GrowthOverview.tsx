/**
 * 页面名称：生长监测总览
 * 路由路径：/production/growth
 * 所属模块：生长监测与IoT
 * 原型来源：用户端原型 P20 growth
 *
 * 还原要点：
 * - 标题「🌱 生长监测总览」+ 农场 / 作物 / 阶段 / 地块 筛选
 * - 视图切换：卡片、时间轴、日历
 * - 生育期分布图（ECharts 饼图）
 * - 地块卡：作物(品种) + 生育期 + 第 N 天 + 生育期进度条 + 长势评分 + AI 诊断 + 环境
 * - 操作：AI 识别病虫害、查看详情
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Badge,
  Button,
  Calendar,
  Card,
  Col,
  Empty,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Steps,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BugOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import { getGrowthOverviewByPlot, listEnvironmentData, listGrowthRecords } from '@/api/growth'
import { unwrapList } from '@/api/iot'
import { listPlots } from '@/api/plots'
import type { EnvironmentData, GrowthRecord, Plot } from '@/types'

/** 生育期顺序（进度条与下拉筛选项） */
const STAGES: string[] = ['苗期', '开花期', '结果期', '采收期']

/** 长势评级 → 评分（1 弱 2 偏弱 3 正常 4 旺盛） */
const LEVEL_SCORE: Record<number, number> = {
  1: 55,
  2: 70,
  3: 85,
  4: 92,
}

/** 长势评级 → 文案与颜色 */
const LEVEL_META: Record<number, { label: string; color: string }> = {
  1: { label: '偏弱', color: 'red' },
  2: { label: '一般', color: 'orange' },
  3: { label: '良好', color: 'green' },
  4: { label: '优秀', color: 'cyan' },
}

/** 视图模式 */
type ViewMode = 'card' | 'timeline' | 'calendar'

/** 地块长势聚合结果 */
interface PlotGrowth {
  /** 地块 */
  plot: Plot
  /** 作物名称（取品种或作物 ID） */
  cropName: string
  /** 作物图标 */
  icon: string
  /** 当前生育期 */
  stage: string
  /** 生长天数 */
  days: number
  /** 长势评分；该地块无任何生长记录时为 null（后端没数据，不臆造评分） */
  score: number | null
  /** 长势评级；无记录时为 null */
  level: number | null
  /** 病虫害描述 */
  pestInfo: string
  /**
   * 病虫害等级（1 高 2 中 3 低，0 表示无）。
   * null 表示该地块没有任何生长记录，AI 诊断结论未知（不能默认显示「健康」）。
   */
  pestLevel: number | null
  /** 环境状态文案 */
  envText: string
  /** 该地块记录数 */
  recordCount: number
}

/**
 * 按作物名称推断图标。
 *
 * @param cropName 作物名称
 * @returns emoji 图标
 */
function cropIcon(cropName: string): string {
  if (/番茄|西红柿/.test(cropName)) return '🍅'
  if (/黄瓜/.test(cropName)) return '🥒'
  if (/辣椒|胡椒/.test(cropName)) return '🌶️'
  if (/茄子/.test(cropName)) return '🍆'
  if (/白菜|青菜|油菜/.test(cropName)) return '🥬'
  if (/玉米/.test(cropName)) return '🌽'
  if (/水稻|稻/.test(cropName)) return '🌾'
  return '🌱'
}

/**
 * 读取记录时间（兼容 recordDate / createdAt）。
 *
 * @param record 生长记录
 * @returns 时间字符串
 */
function recordTime(record: GrowthRecord): string {
  return record.recordDate ?? record.createdAt ?? ''
}

/**
 * 读取病虫害等级（后端实体字段 pestLevel）。
 *
 * @param record 生长记录
 * @returns 病虫害等级，0 表示无
 */
function pestLevelOf(record: GrowthRecord): number {
  const raw = record as unknown as { pestLevel?: number }
  return Number(raw.pestLevel ?? (record.pestInfo ? 2 : 0))
}

/**
 * 计算地块环境状态。
 *
 * @param rows 地块环境数据
 * @returns 环境状态文案
 */
function resolveEnvText(rows: EnvironmentData[]): string {
  if (rows.length === 0) return '暂无数据'
  const latest = rows[rows.length - 1]
  const humidity = latest.airHumidity
  const soil = latest.soilMoisture
  if (typeof humidity === 'number' && humidity > 80) return '偏湿'
  if (typeof soil === 'number' && soil < 40) return '偏干'
  if (typeof soil === 'number' && soil > 85) return '偏湿'
  return '正常'
}

/**
 * 生长监测总览
 *
 * 业务职责：按地块展示作物生育期进度、长势评分、AI 诊断与环境状态，
 * 提供生育期分布图与卡片 / 时间轴 / 日历三种视图。
 *
 * @returns 页面内容
 */
export default function GrowthOverview(): JSX.Element {
  const navigate = useNavigate()
  const { currentFarm } = useFarmStore()
  const farmId = currentFarm?.farmId

  /** 视图模式 */
  const [view, setView] = useState<ViewMode>('card')
  /** 作物筛选 */
  const [cropFilter, setCropFilter] = useState<string | undefined>(undefined)
  /** 生育期筛选 */
  const [stageFilter, setStageFilter] = useState<string | undefined>(undefined)
  /** 地块筛选 */
  const [plotFilter, setPlotFilter] = useState<string | undefined>(undefined)
  /** 手动刷新计数 */
  const [refreshKey, setRefreshKey] = useState<number>(0)

  /** 地块列表 */
  const plotsQuery = useQuery({
    queryKey: ['growth-overview-plots', farmId, refreshKey],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 100, farmId }),
    retry: false,
  })

  /** 生长记录（一次性拉取后在前端按地块聚合，避免 N+1 请求） */
  const recordsQuery = useQuery({
    queryKey: ['growth-overview-records', farmId, refreshKey],
    queryFn: () => listGrowthRecords({ pageNum: 1, pageSize: 200, farmId }),
    retry: false,
  })

  /** 环境数据（地块环境状态标签） */
  const envQuery = useQuery({
    queryKey: ['growth-overview-env', refreshKey],
    queryFn: () => listEnvironmentData({ pageNum: 1, pageSize: 200 }),
    retry: false,
  })

  /** 生长总览统计（后端 Map，用于补充评分口径） */
  const overviewQuery = useQuery({
    queryKey: ['growth-overview-stat', plotFilter, refreshKey],
    queryFn: () => getGrowthOverviewByPlot(plotFilter),
    retry: false,
  })

  const plots: Plot[] = useMemo(() => unwrapList<Plot>(plotsQuery.data), [plotsQuery.data])
  const records: GrowthRecord[] = useMemo(
    () => unwrapList<GrowthRecord>(recordsQuery.data),
    [recordsQuery.data],
  )
  const envRows: EnvironmentData[] = useMemo(
    () => unwrapList<EnvironmentData>(envQuery.data),
    [envQuery.data],
  )

  /** 按地块聚合长势 */
  const plotGrowthList = useMemo<PlotGrowth[]>(() => {
    const grouped = new Map<string, GrowthRecord[]>()
    records.forEach((record) => {
      if (!record.plotId) return
      const list = grouped.get(record.plotId) ?? []
      list.push(record)
      grouped.set(record.plotId, list)
    })

    return plots.map<PlotGrowth>((plot) => {
      const rows = (grouped.get(plot.plotId) ?? []).slice().sort((a, b) => {
        const left = dayjs(recordTime(a)).valueOf()
        const right = dayjs(recordTime(b)).valueOf()
        return left - right
      })
      const latest = rows.length > 0 ? rows[rows.length - 1] : null
      const first = rows.length > 0 ? rows[0] : null
      const cropName = plot.cropVariety ?? plot.cropId ?? latest?.cropName ?? '未指定作物'
      // 该地块没有任何生长记录时，长势评分 / 评级 / 病虫害等级一律为 null：
      // 此前这里写的是 `latest?.growthLevel ?? 3`，会给「一条记录都没有」的地块凭空打出
      // 85 分「良好」，属于把本地默认值伪装成服务端数据。
      const level = latest ? Number(latest.growthLevel ?? 3) : null
      const validLevel = level !== null && Number.isFinite(level) ? level : null
      const days = first ? Math.max(dayjs().diff(dayjs(recordTime(first)), 'day') + 1, 1) : 0
      const plotEnv = envRows.filter((item) => item.plotId === plot.plotId)
      return {
        plot,
        cropName,
        icon: cropIcon(cropName),
        stage: latest?.growthStage ?? '未记录',
        days,
        score: validLevel === null ? null : (LEVEL_SCORE[validLevel] ?? null),
        level: validLevel,
        pestInfo: latest?.pestInfo ?? '',
        pestLevel: latest ? pestLevelOf(latest) : null,
        envText: resolveEnvText(plotEnv),
        recordCount: rows.length,
      }
    })
  }, [plots, records, envRows])

  /** 作物下拉选项（去重） */
  const cropOptions = useMemo(
    () =>
      Array.from(new Set(plotGrowthList.map((item) => item.cropName))).map((name) => ({
        value: name,
        label: name,
      })),
    [plotGrowthList],
  )

  /** 过滤后的地块长势 */
  const filteredList = useMemo(
    () =>
      plotGrowthList.filter((item) => {
        if (cropFilter && item.cropName !== cropFilter) return false
        if (plotFilter && item.plot.plotId !== plotFilter) return false
        if (stageFilter && item.stage !== stageFilter) return false
        return true
      }),
    [plotGrowthList, cropFilter, plotFilter, stageFilter],
  )

  /** 生育期分布图配置 */
  const stageChartOption = useMemo<EChartsOption>(() => {
    const counter = new Map<string, number>()
    filteredList.forEach((item) => {
      const key = STAGES.includes(item.stage) ? item.stage : '未记录'
      counter.set(key, (counter.get(key) ?? 0) + 1)
    })
    const data = Array.from(counter.entries()).map(([name, value]) => ({ name, value }))
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} 个地块 ({d}%)' },
      legend: { bottom: 0 },
      series: [
        {
          name: '生育期分布',
          type: 'pie',
          radius: ['40%', '65%'],
          center: ['50%', '45%'],
          data,
          label: { formatter: '{b}\n{c} 个' },
        },
      ],
    }
  }, [filteredList])

  /** 表格列定义 */
  const columns = useMemo<ColumnsType<PlotGrowth>>(
    () => [
      {
        title: '地块',
        key: 'plotName',
        render: (_value: unknown, row: PlotGrowth) => `${row.icon} ${row.plot.plotName}`,
      },
      { title: '作物', dataIndex: 'cropName', key: 'cropName' },
      {
        title: '生育期',
        key: 'stage',
        render: (_value: unknown, row: PlotGrowth) => (
          <Space size={4}>
            <Tag color="blue">{row.stage}</Tag>
            {row.days > 0 && <Typography.Text type="secondary">第{row.days}天</Typography.Text>}
          </Space>
        ),
      },
      {
        title: '长势评分',
        key: 'score',
        sorter: (a: PlotGrowth, b: PlotGrowth) => (a.score ?? -1) - (b.score ?? -1),
        render: (_value: unknown, row: PlotGrowth) =>
          row.score === null ? (
            <Tooltip title="该地块暂无生长记录，后端未返回长势评级，不臆造评分">
              <Tag color="default">
                —
                <InfoCircleOutlined style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }} />
              </Tag>
            </Tooltip>
          ) : (
            <Tag color={LEVEL_META[row.level ?? 3]?.color ?? 'green'}>
              {row.score}分（{LEVEL_META[row.level ?? 3]?.label ?? '正常'}）
            </Tag>
          ),
      },
      {
        title: 'AI诊断',
        key: 'pestInfo',
        render: (_value: unknown, row: PlotGrowth) => {
          // 没有生长记录 = 没做过诊断，不能显示「✅ 健康」
          if (row.pestLevel === null) {
            return (
              <Tooltip title="该地块暂无生长记录，未做过病虫害诊断，结论未知">
                <Tag color="default">
                  未诊断
                  <InfoCircleOutlined style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }} />
                </Tag>
              </Tooltip>
            )
          }
          if (row.pestLevel === 1) return <Tag color="red">🔴 {row.pestInfo || '病虫害预警'}</Tag>
          if (row.pestLevel === 2) return <Tag color="orange">⚠️ {row.pestInfo || '病虫害风险'}</Tag>
          return <Tag color="green">✅ 健康</Tag>
        },
      },
      {
        title: '环境',
        key: 'envText',
        render: (_value: unknown, row: PlotGrowth) => (
          <Tag color={row.envText === '正常' ? 'green' : row.envText === '暂无数据' ? 'default' : 'orange'}>
            {row.envText}
          </Tag>
        ),
      },
      {
        title: '操作',
        key: 'action',
        render: (_value: unknown, row: PlotGrowth) => (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              icon={<BugOutlined />}
              onClick={() => navigate(`/production/ai/pest-detection?plotId=${row.plot.plotId}`)}
            >
              AI识别
            </Button>
            <Button type="link" size="small" onClick={() => navigate(`/production/plots/${row.plot.plotId}`)}>
              详情
            </Button>
          </Space>
        ),
      },
    ],
    [navigate],
  )

  /** 日历单元格渲染：当天记录数 */
  const renderCalendarCell = (current: Dayjs): JSX.Element => {
    const dayRecords = records.filter((record) => {
      const time = recordTime(record)
      return time ? dayjs(time).isSame(current, 'day') : false
    })
    if (dayRecords.length === 0) return <span />
    return (
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        {dayRecords.slice(0, 2).map((record) => (
          <Tag key={record.recordId} color="green" style={{ fontSize: 11, margin: 0 }}>
            {record.plotName ?? record.plotId} {record.growthStage}
          </Tag>
        ))}
        {dayRecords.length > 2 && (
          <Typography.Text type="secondary">共 {dayRecords.length} 条</Typography.Text>
        )}
      </Space>
    )
  }

  /** 渲染单个地块卡片 */
  const renderPlotCard = (item: PlotGrowth): JSX.Element => {
    const stageIndex = STAGES.indexOf(item.stage)
    // pestLevel 为 null 表示该地块没有任何生长记录：没诊断过就不能显示「✅ 健康」
    const pestTag =
      item.pestLevel === 1 ? (
        <Tag color="red">🔴 {item.pestInfo || '病虫害预警'}</Tag>
      ) : item.pestLevel === 2 ? (
        <Tag color="orange">⚠️ {item.pestInfo || '病虫害风险'}</Tag>
      ) : item.pestLevel === null ? (
        <Tooltip title="该地块暂无生长记录，未做过病虫害诊断，结论未知">
          <Tag color="default">
            未诊断
            <InfoCircleOutlined style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }} />
          </Tag>
        </Tooltip>
      ) : (
        <Tag color="green">✅ 健康</Tag>
      )
    /** 长势评分展示：无记录时显示「—」而不是臆造分数 */
    const scoreNode =
      item.score === null ? (
        <Tooltip title="该地块暂无生长记录，后端未返回长势评级，不臆造评分">
          <Typography.Text strong style={{ color: '#bfbfbf', cursor: 'help' }}>
            —
            <InfoCircleOutlined style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }} />
          </Typography.Text>
        </Tooltip>
      ) : (
        <>
          <Typography.Text strong style={{ color: item.score >= 85 ? '#3f8600' : '#fa8c16' }}>
            {item.score}分
          </Typography.Text>
          <Tag color={LEVEL_META[item.level ?? 3]?.color ?? 'green'}>
            {LEVEL_META[item.level ?? 3]?.label ?? '正常'}
          </Tag>
        </>
      )
    return (
      <Col xs={24} md={12} xl={8} key={item.plot.plotId}>
        <Card
          title={
            <Space>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>
                {item.plot.plotName} - {item.cropName}
              </span>
            </Space>
          }
          extra={
            <Space>
              <Tag color="blue">{item.stage}</Tag>
              {item.days > 0 && <Typography.Text type="secondary">第{item.days}天</Typography.Text>}
            </Space>
          }
          actions={[
            <Button
              key="ai"
              type="link"
              icon={<BugOutlined />}
              onClick={() => navigate(`/production/ai/pest-detection?plotId=${item.plot.plotId}`)}
            >
              🤖 AI识别病虫害
            </Button>,
            <Button key="detail" type="link" onClick={() => navigate(`/production/plots/${item.plot.plotId}`)}>
              查看详情→
            </Button>,
          ]}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Steps
              size="small"
              current={stageIndex < 0 ? 0 : stageIndex}
              status={stageIndex < 0 ? 'wait' : 'process'}
              items={STAGES.map((stage) => ({ title: stage }))}
            />
            <Row justify="space-between">
              <Space size={8}>
                <Typography.Text type="secondary">长势评分</Typography.Text>
                {scoreNode}
              </Space>
              <Space size={8}>
                <Typography.Text type="secondary">记录数</Typography.Text>
                <Badge count={item.recordCount} color="#1677ff" />
              </Space>
            </Row>
            <Row>
              <Space size={8} wrap>
                <Typography.Text type="secondary">AI诊断</Typography.Text>
                {pestTag}
                <Typography.Text type="secondary">环境</Typography.Text>
                <Tag color={item.envText === '正常' ? 'green' : 'orange'}>{item.envText}</Tag>
              </Space>
            </Row>
          </Space>
        </Card>
      </Col>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          🌱 生长监测总览
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey((key) => key + 1)}>
            刷新
          </Button>
          <Button type="primary" onClick={() => navigate('/production/growth/records')}>
            生长记录
          </Button>
          <Button onClick={() => navigate('/production/growth/environment')}>环境数据</Button>
        </Space>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder="全部作物"
            value={cropFilter}
            options={cropOptions}
            onChange={setCropFilter}
          />
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder="全部阶段"
            value={stageFilter}
            options={STAGES.map((stage) => ({ value: stage, label: stage }))}
            onChange={setStageFilter}
          />
          <Select
            allowClear
            style={{ width: 180 }}
            placeholder="全部地块"
            value={plotFilter}
            options={plots.map((item) => ({ value: item.plotId, label: item.plotName }))}
            onChange={setPlotFilter}
          />
          <Segmented
            value={view}
            onChange={(value) => setView(value as ViewMode)}
            options={[
              { label: '卡片', value: 'card' },
              { label: '时间轴', value: 'timeline' },
              { label: '日历', value: 'calendar' },
            ]}
          />
        </Space>
      </Card>

      {plotsQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="地块数据加载失败"
          description={(plotsQuery.error as Error)?.message ?? '请稍后重试'}
        />
      )}
      {recordsQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="生长记录加载失败"
          description={(recordsQuery.error as Error)?.message ?? '请稍后重试'}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="生育期分布">
            {plotsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : filteredList.length === 0 ? (
              <Empty description="暂无地块数据" />
            ) : (
              <ReactECharts option={stageChartOption} style={{ height: 300 }} notMerge />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="地块长势列表" bodyStyle={{ paddingTop: 8 }}>
            <Table<PlotGrowth>
              rowKey={(row) => row.plot.plotId}
              size="small"
              loading={plotsQuery.isLoading || recordsQuery.isLoading}
              dataSource={filteredList}
              columns={columns}
              pagination={{ pageSize: 5 }}
              locale={{ emptyText: <Empty description="暂无地块长势数据" /> }}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 16 }}>
        {view === 'card' && (
          <Row gutter={[16, 16]}>
            {plotsQuery.isLoading || recordsQuery.isLoading ? (
              <Col span={24}>
                <Card>
                  <Skeleton active paragraph={{ rows: 6 }} />
                </Card>
              </Col>
            ) : filteredList.length === 0 ? (
              <Col span={24}>
                <Card>
                  <Empty description="没有符合筛选条件的地块" />
                </Card>
              </Col>
            ) : (
              filteredList.map(renderPlotCard)
            )}
          </Row>
        )}

        {view === 'timeline' && (
          <Card title="生长记录时间轴">
            {recordsQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : records.length === 0 ? (
              <Empty description="暂无生长记录" />
            ) : (
              <Timeline
                items={records
                  .slice()
                  .sort((a, b) => dayjs(recordTime(b)).valueOf() - dayjs(recordTime(a)).valueOf())
                  .slice(0, 30)
                  .map((record) => ({
                    color: Number(record.growthLevel) >= 3 ? 'green' : 'orange',
                    children: (
                      <Space wrap size={8}>
                        <Typography.Text type="secondary">
                          {recordTime(record) ? dayjs(recordTime(record)).format('YYYY-MM-DD') : '-'}
                        </Typography.Text>
                        <Tag color="blue">{record.growthStage}</Tag>
                        <Typography.Text>
                          {record.plotName ?? record.plotId} · {record.cropName ?? '未指定作物'}
                        </Typography.Text>
                        <Typography.Text type="secondary">株高 {record.plantHeight ?? '-'} cm</Typography.Text>
                        <Tag color={LEVEL_META[Number(record.growthLevel)]?.color ?? 'green'}>
                          {LEVEL_SCORE[Number(record.growthLevel)] ?? 80}分
                        </Tag>
                        <Typography.Text type="secondary">{record.recorderName ?? '-'}</Typography.Text>
                      </Space>
                    ),
                  }))}
              />
            )}
          </Card>
        )}

        {view === 'calendar' && (
          <Card title="生长记录日历">
            <Calendar
              cellRender={(current: Dayjs, info: { type: string; originNode: ReactNode }) =>
                info.type === 'date' ? renderCalendarCell(current) : info.originNode
              }
            />
          </Card>
        )}
      </div>

      {overviewQuery.isError && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="生长总览统计接口暂不可用"
          description="页面已使用本地聚合口径展示长势评分，不影响主流程。"
        />
      )}
    </div>
  )
}
