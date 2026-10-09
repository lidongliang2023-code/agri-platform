/**
 * 页面名称：采收管理列表
 * 路由路径：/production/harvests
 * 所属模块：采收与库存管理
 * 原型 pageId：P13 harvests
 *
 * 还原要点：
 * - 标题「🌾 采收管理」+ 新建采收 / 采收计划 / 库存管理 入口
 * - 概览卡 4 项：本季采收总量、本月采收次数、平均质量等级(A 占比)、待入库数量
 * - 状态 Tab：全部 / 待入库 / 已入库 / 已出库（带数量）
 * - 筛选：采收日期区间、地块、作物、等级、采收编号
 * - 批量操作：批量入库 / 批量导出；视图切换：列表视图 / 日历视图
 * - 表格列：复选框 | 采收编号 | 作物品种 | 采收地块 | 采收日期 | 数量(kg) | 质量等级 | 状态 | 操作
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  Badge,
  Button,
  Calendar,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { ExportOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import { inboundHarvest, queryHarvests } from '@/api/harvests'
import { listPlots } from '@/api/plots'
import type { HarvestBatch, HarvestGrade, InboundStatus, Plot } from '@/types'
import {
  BATCH_STATUS_META,
  GRADE_COLOR_MAP,
  GRADE_LABEL_MAP,
  GRADE_OPTIONS,
  INBOUND_STATUS_META,
} from '@/types'

/** 视图模式：列表 / 日历 */
type ViewMode = 'table' | 'calendar'

/** 状态 Tab 键值 */
type TabKey = 'all' | 'pending' | 'inbound' | 'outbound'

/** Tab → 入库状态（全部不传该条件） */
const TAB_INBOUND_STATUS: Record<TabKey, number | undefined> = {
  all: undefined,
  pending: 0,
  inbound: 1,
  outbound: 2,
}

/** 列表筛选条件 */
interface HarvestFilters {
  /** 采收日期区间 */
  dateRange?: [Dayjs, Dayjs]
  /** 地块 ID */
  plotId?: string
  /** 作物 ID */
  cropId?: string
  /** 质量等级 */
  grade?: HarvestGrade
  /** 采收编号关键字 */
  batchNo?: string
}

/** CSV 单元格转义 */
function escapeCsv(value: string): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

/**
 * 采收管理列表页
 *
 * 业务职责：采收批次台账，支持概览统计、状态 Tab、条件筛选、批量入库与导出、日历视图。
 *
 * @returns 页面内容
 */
export default function HarvestRecords(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [view, setView] = useState<ViewMode>('table')
  const [tab, setTab] = useState<TabKey>('all')
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [filters, setFilters] = useState<HarvestFilters>({})
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [filterForm] = Form.useForm<HarvestFilters>()

  /** 基础筛选（不含 Tab 入库状态），用于统计 / 日历 / 计数 */
  const baseFilters = useMemo(
    () => ({
      farmId,
      plotId: filters.plotId,
      cropId: filters.cropId,
      grade: filters.grade,
      batchNo: filters.batchNo,
      startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
    }),
    [farmId, filters],
  )

  /** 统计 / 日历 / Tab 计数数据源：一次性取较大页，客户端分组与计数 */
  const boardQuery = useQuery({
    queryKey: ['production-harvests', 'board', farmId, filters],
    enabled: Boolean(farmId),
    queryFn: () => queryHarvests({ ...baseFilters, pageNum: 1, pageSize: 200 }),
  })

  /** 列表视图数据源：服务端分页 */
  const tableQuery = useQuery({
    queryKey: ['production-harvests', 'table', farmId, filters, tab, pageNum, pageSize],
    enabled: Boolean(farmId) && view === 'table',
    queryFn: () =>
      queryHarvests({
        ...baseFilters,
        inboundStatus: TAB_INBOUND_STATUS[tab],
        pageNum,
        pageSize,
      }),
  })

  /** 地块下拉（按当前农场） */
  const plotQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 统一失效刷新 */
  const invalidateHarvests = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['production-harvests'] })

  /** 入库（单条 / 批量复用同一动作） */
  const inboundMutation = useMutation({
    mutationFn: (batchIds: string[]) =>
      Promise.all(batchIds.map((batchId) => inboundHarvest(batchId))),
    onSuccess: (_result, batchIds) => {
      message.success(`已提交入库 ${batchIds.length} 个批次`)
      setSelectedKeys([])
      void invalidateHarvests()
    },
    onError: () => {
      message.error('入库失败，请稍后重试')
    },
  })

  /** 全部批次（用于统计与日历） */
  const allBatches = useMemo<HarvestBatch[]>(() => boardQuery.data?.list ?? [], [boardQuery.data])

  /**
   * 统计数据。
   * 以数据集中最晚采收日期所在月份 / 季度为统计基准，
   * 避免演示数据与系统当前日期不在同一周期时统计恒为 0。
   */
  const overview = useMemo(() => {
    const dates = allBatches.map((item) => item.harvestDate).sort()
    const baseDate = dates.length > 0 ? dayjs(dates[dates.length - 1]) : dayjs()
    const baseMonth = baseDate.format('YYYY-MM')
    const baseQuarter = `${baseDate.year()}-Q${baseDate.quarter()}`
    let monthCount = 0
    let gradeACount = 0
    let pendingInbound = 0
    allBatches.forEach((item) => {
      if (dayjs(item.harvestDate).format('YYYY-MM') === baseMonth) monthCount += 1
      if (item.grade === 'A') gradeACount += 1
      if ((item.inboundStatus ?? 0) === 0) pendingInbound += 1
    })
    const seasonQuantity = allBatches
      .filter(
        (item) =>
          `${dayjs(item.harvestDate).year()}-Q${dayjs(item.harvestDate).quarter()}` === baseQuarter,
      )
      .reduce((sum, item) => sum + item.quantity, 0)
    return {
      seasonQuantity,
      monthCount,
      gradeARatio: allBatches.length > 0 ? Math.round((gradeACount / allBatches.length) * 100) : 0,
      pendingInbound,
    }
  }, [allBatches])

  /** Tab 计数 */
  const tabCounts = useMemo<Record<TabKey, number>>(() => {
    const counts: Record<TabKey, number> = {
      all: allBatches.length,
      pending: 0,
      inbound: 0,
      outbound: 0,
    }
    allBatches.forEach((item) => {
      const status = item.inboundStatus ?? 0
      if (status === 0) counts.pending += 1
      if (status === 1) counts.inbound += 1
      if (status === 2) counts.outbound += 1
    })
    return counts
  }, [allBatches])

  /** 地块下拉选项 */
  const plotOptions = useMemo(
    () =>
      (plotQuery.data?.list ?? []).map((plot: Plot) => ({
        value: plot.plotId,
        label: plot.plotName,
      })),
    [plotQuery.data],
  )

  /** 作物下拉选项（由当前数据集去重生成） */
  const cropOptions = useMemo(() => {
    const map = new Map<string, string>()
    allBatches.forEach((item) => {
      if (item.cropId && item.cropName) map.set(item.cropId, item.cropName)
    })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [allBatches])

  /** 查询按钮 */
  const handleSearch = (): void => {
    setPageNum(1)
    setFilters(filterForm.getFieldsValue())
  }

  /** 重置按钮 */
  const handleReset = (): void => {
    filterForm.resetFields()
    setPageNum(1)
    setFilters({})
  }

  /** 批量入库 */
  const handleBatchInbound = (): void => {
    if (selectedKeys.length === 0) {
      message.warning('请先勾选需要入库的采收批次')
      return
    }
    inboundMutation.mutate(selectedKeys)
  }

  /** 导出当前筛选结果为 CSV */
  const handleExport = (): void => {
    const rows =
      selectedKeys.length > 0
        ? allBatches.filter((item) => selectedKeys.includes(item.batchId))
        : allBatches
    if (rows.length === 0) {
      message.warning('暂无可导出的数据')
      return
    }
    const header = [
      '采收编号',
      '作物品种',
      '采收地块',
      '采收日期',
      '数量(kg)',
      '质量等级',
      '入库状态',
      '批次状态',
    ]
    const body = rows.map((item) =>
      [
        item.batchNo,
        `${item.cropName ?? '-'}${item.cropVariety ? `(${item.cropVariety})` : ''}`,
        item.plotName ?? item.plotId ?? '-',
        item.harvestDate,
        String(item.quantity),
        GRADE_LABEL_MAP[item.grade] ?? item.grade,
        INBOUND_STATUS_META[(item.inboundStatus ?? 0) as InboundStatus].label,
        BATCH_STATUS_META[item.status]?.label ?? String(item.status),
      ]
        .map(escapeCsv)
        .join(','),
    )
    const csv = `\uFEFF${[header.join(','), ...body].join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `采收记录_${dayjs().format('YYYYMMDDHHmm')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    message.success(`已导出 ${rows.length} 条采收记录`)
  }

  /** 列表视图列定义（对照原型 P13） */
  const columns: ProColumns<HarvestBatch>[] = [
    { title: '采收编号', dataIndex: 'batchNo', width: 130 },
    {
      title: '作物品种',
      key: 'crop',
      width: 160,
      render: (_, record) => (
        <span>
          {record.cropName ?? '-'}
          {record.cropVariety ? (
            <Typography.Text type="secondary"> ({record.cropVariety})</Typography.Text>
          ) : null}
        </span>
      ),
    },
    {
      title: '采收地块',
      dataIndex: 'plotName',
      width: 110,
      render: (_, record) => record.plotName ?? record.plotId ?? '-',
    },
    { title: '采收日期', dataIndex: 'harvestDate', width: 120 },
    {
      title: '数量(kg)',
      dataIndex: 'quantity',
      width: 110,
      render: (_, record) => `${record.quantity.toLocaleString()} ${record.unit}`,
    },
    {
      title: '质量等级',
      dataIndex: 'grade',
      width: 100,
      render: (_, record) => (
        <Tag color={GRADE_COLOR_MAP[record.grade] ?? 'default'}>
          {GRADE_LABEL_MAP[record.grade] ?? record.grade}
        </Tag>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 170,
      render: (_, record) => {
        const inbound = INBOUND_STATUS_META[(record.inboundStatus ?? 0) as InboundStatus]
        return (
          <Space size={4} wrap>
            <Tag color={inbound.color}>
              <span style={{ color: inbound.color }}>●</span> {inbound.label}
            </Tag>
            <Tag color={BATCH_STATUS_META[record.status]?.color ?? 'default'}>
              {BATCH_STATUS_META[record.status]?.label ?? record.status}
            </Tag>
          </Space>
        )
      },
    },
    {
      title: '操作',
      key: 'option',
      width: 150,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link
          key="detail"
          onClick={() => navigate(`/production/harvests/${record.batchId}`)}
        >
          查看
        </Typography.Link>,
        (record.inboundStatus ?? 0) === 0 ? (
          <Typography.Link
            key="inbound"
            onClick={() => inboundMutation.mutate([record.batchId])}
          >
            入库
          </Typography.Link>
        ) : (
          <Typography.Text key="inbound-done" type="secondary">
            已入库
          </Typography.Text>
        ),
      ],
    },
  ]

  /** 日历视图单元格：按采收日期聚合展示 */
  const renderCalendarCell = (current: Dayjs): JSX.Element => {
    const dayStr = current.format('YYYY-MM-DD')
    const items = allBatches.filter((item) => item.harvestDate === dayStr)
    if (items.length === 0) return <span />
    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 12 }}>
        {items.slice(0, 3).map((item) => {
          const inbound = INBOUND_STATUS_META[(item.inboundStatus ?? 0) as InboundStatus]
          return (
            <li key={item.batchId}>
              <Badge
                color={inbound.color}
                text={`${item.cropName ?? ''} ${item.quantity}${item.unit}`}
              />
            </li>
          )
        })}
        {items.length > 3 ? (
          <li>
            <Typography.Text type="secondary">共 {items.length} 条…</Typography.Text>
          </li>
        ) : null}
      </ul>
    )
  }

  /** 渲染列表视图 */
  const renderTable = (): JSX.Element => (
    <ProTable<HarvestBatch>
      rowKey="batchId"
      columns={columns}
      dataSource={tableQuery.data?.list ?? []}
      loading={tableQuery.isFetching}
      search={false}
      options={{ reload: () => void invalidateHarvests(), density: true, setting: true }}
      rowSelection={{
        selectedRowKeys: selectedKeys,
        onChange: (keys) => setSelectedKeys(keys.map(String)),
      }}
      pagination={{
        current: pageNum,
        pageSize,
        total: tableQuery.data?.total ?? 0,
        showSizeChanger: true,
        onChange: (nextPage, nextSize) => {
          setPageNum(nextPage)
          setPageSize(nextSize)
        },
      }}
    />
  )

  /** 渲染空态 / 错误态，返回 null 表示正常渲染主内容 */
  const renderStatus = (): JSX.Element | null => {
    if (!farmId) {
      return <Empty description="请先在顶部切换农场" />
    }
    if (boardQuery.isError) {
      return (
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="danger">采收数据加载失败，请稍后重试</Typography.Text>
              <Button onClick={() => void invalidateHarvests()}>重新加载</Button>
            </Space>
          }
        />
      )
    }
    if (boardQuery.isLoading) {
      return <Empty description="正在加载采收数据…" />
    }
    if (allBatches.length === 0) {
      return (
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="secondary">暂无采收记录，先登记一次采收吧</Typography.Text>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/production/harvests/create')}
              >
                新建采收
              </Button>
            </Space>
          }
        />
      )
    }
    return null
  }

  return (
    <PageContainer
      title="🌾 采收管理"
      subTitle={currentFarm?.farmName}
      extra={[
        <Segmented
          key="view"
          value={view}
          onChange={(value) => setView(value as ViewMode)}
          options={[
            { label: '列表视图', value: 'table' },
            { label: '日历视图', value: 'calendar' },
          ]}
        />,
        <Button key="plan" onClick={() => navigate('/production/harvests/plan')}>
          采收计划
        </Button>,
        <Button key="inventory" onClick={() => navigate('/production/harvests/inventory')}>
          库存管理
        </Button>,
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/production/harvests/create')}
        >
          新建采收
        </Button>,
      ]}
    >
      {boardQuery.data?.demo ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="后端采收接口暂未返回数据，当前展示内置演示数据（取自原型 P13）"
        />
      ) : null}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="本季采收总量"
              value={overview.seasonQuantity}
              precision={0}
              suffix="kg"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="本月采收次数" value={overview.monthCount} suffix="次" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均质量等级"
              value="A"
              suffix={`(${overview.gradeARatio}%)`}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待入库数量"
              value={overview.pendingInbound}
              suffix="条"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" style={{ rowGap: 12 }}>
          <Form.Item name="dateRange" label="采收日期">
            <DatePicker.RangePicker style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="plotId" label="地块">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部地块"
              options={plotOptions}
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item name="cropId" label="作物">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部作物"
              options={cropOptions}
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item name="grade" label="等级">
            <Select
              allowClear
              placeholder="全部等级"
              options={GRADE_OPTIONS}
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item name="batchNo" label="采收编号">
            <Input allowClear placeholder="按采收编号搜索" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        extra={
          <Space>
            <Button
              icon={<InboxOutlined />}
              loading={inboundMutation.isPending}
              onClick={handleBatchInbound}
            >
              批量入库
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              批量导出
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={tab}
          onChange={(key) => {
            setTab(key as TabKey)
            setPageNum(1)
          }}
          items={[
            { key: 'all', label: `全部(${tabCounts.all})` },
            { key: 'pending', label: `待入库(${tabCounts.pending})` },
            { key: 'inbound', label: `已入库(${tabCounts.inbound})` },
            { key: 'outbound', label: `已出库(${tabCounts.outbound})` },
          ]}
        />
        {renderStatus() ??
          (view === 'calendar' ? (
            <Calendar
              cellRender={(current, info) =>
                info.type === 'date' ? renderCalendarCell(current) : info.originNode
              }
            />
          ) : (
            renderTable()
          ))}
      </Card>
    </PageContainer>
  )
}
