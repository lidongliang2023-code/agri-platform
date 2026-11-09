import PlotImportModal from './PlotImportModal'
import BusinessRecordList from '@/components/BusinessRecordList'
import BusinessCards from '@/components/BusinessCards'
import DetailMetricGrid from '@/components/DetailMetricGrid'
import Card from '@/components/SectionCard'
/**
 * 页面名称：地块列表
 * 路由路径：/production/plots
 * 所属模块：农场数字化管理
 * PRD 序号：PRD 6.1 #6
 * 原型来源：用户端原型 P4 plots
 *
 * 还原要点（对照原型 P4）：
 * - 标题 🗺️ 地块管理；按钮 `+ 新增地块`、`📥 批量导入`
 * - 四维筛选：全部农场 / 全部作物 / 全部生长阶段 / 全部状态
 * - 视图切换 Tab：列表 / 地图 / 看板（卡片）
 * - 统计条：`共 N 个地块 | 在田 X | 休耕 Y`
 * - 表格列：复选框 | 地块编号 | 地块名 | 农场 | 面积 | 作物 | 生长阶段 | 状态 | 操作
 *
 * 数据说明：逐页加载当前主体全部地块和生长记录，完整加载后统一筛选、统计与展示。
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageContainer from '@/components/ProductionPageContainer'
import {
  AppstoreOutlined,
  ImportOutlined,
  PlusOutlined,
  TableOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { deletePlot, listPlots, updatePlotStatus } from '@/api/plots'
import { listAllFarms } from '@/api/farms'
import { listGrowthRecords } from '@/api/growth'
import { loadCompletePages } from '@/utils/load-complete-pages'
import type { Plot } from '@/types'
import { TiandituMap, type TiandituMapPoint } from '@agri/shared'
// 地块状态与作物 emoji 已统一收敛到 @/types（原各页面各存一份）
import { CROP_EMOJI_MAP, PLOT_STATUS_META } from '@/types'

/** 视图模式：列表 / 地图 / 看板（卡片） */
type ViewMode = 'table' | 'map' | 'board'

/** 地块状态元数据 */
/** 原型 P4 生长阶段取值 */
const DEFAULT_STAGE_OPTIONS: string[] = ['苗期', '开花期', '结果期', '采收期']

/**
 * 地块的「作物」显示值。

 *
 * <p>优先 {@code currentCrop}（作物主数据来的名称，2026-10-16 起地块表单可选）；
 * 历史行没有它时退回 {@code cropVariety} —— 平台侧的演示数据只有"品种"这一层
 * （如"普罗旺斯"），当年就是拿它当作物显示的，列表里这些行不该突然变成"未种植"。</p>
 *
 * @param plot 地块（或任何带这两个字段的行）
 * @returns 作物显示值；两者都没有时为空串
 */
function cropLabelOf(plot: Pick<Plot, 'currentCrop' | 'cropVariety'>): string {
  return (plot.currentCrop || plot.cropVariety || '').trim()
}

/** 筛选条件 */
interface PlotFilters {
  /** 所属农场 */
  farmId?: string
  /** 作物名称 */
  crop?: string
  /** 生长阶段 */
  stage?: string
  /** 地块状态 */
  status?: number
  /** 关键字 */
  keyword?: string
}

/**
 * 地块列表页
 *
 * 业务职责：地块台账，支持四维筛选、三种视图切换、导出、批量删除与单地块删除。
 *
 * @returns 页面内容
 */
export default function PlotList(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const [importOpen, setImportOpen] = useState(false)
  const [view, setView] = useState<ViewMode>('table')
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [filters, setFilters] = useState<PlotFilters>({
    farmId: searchParams.get('farmId') ?? undefined,
  })
  const [filterForm] = Form.useForm<PlotFilters>()

  /** 完整加载地块：不得用单页结果冒充主体全量。 */
  const plotsQuery = useQuery({
    queryKey: ['plots-all'],
    queryFn: () => loadCompletePages(listPlots, (plot) => plot.plotId),
    retry: false,
  })

  /** 农场下拉 */
  const farmQuery = useQuery({
    queryKey: ['farm-options'],
    queryFn: () => listAllFarms(),
  })

  /** 生长记录：构建 地块 → 最新生育期映射 */
  const growthQuery = useQuery({
    queryKey: ['growth-stage-options'],
    queryFn: () => loadCompletePages(listGrowthRecords, (record) => record.recordId),
    retry: false,
  })

  const complete = plotsQuery.isSuccess && growthQuery.isSuccess && !plotsQuery.isFetching && !growthQuery.isFetching

  /** 刷新地块数据 */
  const invalidatePlots = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['plots-all'] })

  /** 删除地块 */
  const deleteMutation = useMutation({
    mutationFn: (plotId: string) => deletePlot(plotId),
    onSuccess: () => {
      message.success('地块已删除')
      setSelectedRowKeys([])
      void invalidatePlots()
    },
  })

  /**
   * 启用 / 停用地块。

   * <p>停用时后端会拦"地块上还有在种计划"的情况（400，消息里带计划名与 ID）——
   * 这里把后端给的原因原样弹出来，不写一句笼统的"操作失败"（用户得知道该先去终止哪条计划）。</p>
   */
  const statusMutation = useMutation({
    mutationFn: (params: { plotId: string; status: number }) =>
      updatePlotStatus(params.plotId, params.status),
    onSuccess: (_data, variables) => {
      message.success(variables.status === 1 ? '地块已启用' : '地块已停用')
      void invalidatePlots()
    },
    onError: (error: Error) => message.error(error.message || '操作失败'),
  })

  /** 批量删除 */
  const batchDeleteMutation = useMutation({
    mutationFn: (plotIds: string[]) =>
      Promise.allSettled(plotIds.map((plotId) => deletePlot(plotId))),
    onSuccess: (results, plotIds) => {
      const failed = results.flatMap((result, index) => result.status === 'rejected' ? [plotIds[index]] : [])
      const succeeded = results.length - failed.length
      if (failed.length) message.warning(`已删除 ${succeeded} 个地块，${failed.length} 个删除失败，请核对后重试`)
      else message.success(`已删除 ${succeeded} 个地块`)
      setSelectedRowKeys(failed)
      void invalidatePlots()
    },
  })

  /** 地块 → 农场名称 */
  const farmNameMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    ;(farmQuery.data ?? []).forEach((farm) => {
      map[farm.farmId] = farm.farmName
    })
    return map
  }, [farmQuery.data])

  /** 地块 → 最新生育期 */
  const plotStageMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    const sorted = [...(growthQuery.data?.list ?? [])].sort((a, b) =>
      (a.recordDate ?? '').localeCompare(b.recordDate ?? ''),
    )
    sorted.forEach((record) => {
      if (record.plotId && record.growthStage) {
        map[record.plotId] = record.growthStage
      }
    })
    return map
  }, [growthQuery.data])

  /**
   * 拉页面当前作物名单。
   *
   * <p>优先用 {@code currentCrop}（作物主数据来的名称），历史行退回 {@code cropVariety}
   * —— 演示数据里品种（如"普罗旺斯"）曾被当成作物显示过，列表里这类行不该突然变"未种植"。</p>
   */
  const cropOptions = useMemo<string[]>(() => {
    const set = new Set<string>()
    ;(plotsQuery.data?.list ?? []).forEach((plot) => {
      const crop = cropLabelOf(plot)
      if (crop) set.add(crop)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }, [plotsQuery.data])

  /** 生长阶段下拉选项（真实数据 ∪ 原型取值） */
  const stageOptions = useMemo<string[]>(() => {
    const set = new Set<string>(DEFAULT_STAGE_OPTIONS)
    Object.values(plotStageMap).forEach((stage) => {
      if (stage) set.add(stage)
    })
    return Array.from(set)
  }, [plotStageMap])

  /** 四维过滤后的数据 */
  const filteredPlots = useMemo<Plot[]>(() => {
    const list = plotsQuery.data?.list ?? []
    return list.filter((plot) => {
      if (filters.farmId && plot.farmId !== filters.farmId) return false
      if (filters.crop && cropLabelOf(plot) !== filters.crop) return false
      if (filters.status !== undefined && plot.status !== filters.status) return false
      if (filters.stage && plotStageMap[plot.plotId] !== filters.stage) return false
      if (
        filters.keyword &&
        !`${plot.plotCode ?? ''}${plot.plotName ?? ''}`
          .toLowerCase()
          .includes(filters.keyword.toLowerCase())
      ) {
        return false
      }
      return true
    })
  }, [plotsQuery.data, filters, plotStageMap])

  /** 统计条：总数 / 在田 / 休耕 */
  const stats = useMemo(() => {
    const list = filteredPlots
    return {
      total: list.length,
      planting: list.filter((plot) => plot.status === 2 || plot.status === 3).length,
      idle: list.filter((plot) => plot.status === 1).length,
      area: list.reduce((sum, plot) => sum + (Number(plot.area) || 0), 0),
    }
  }, [filteredPlots])

  const currentPage = Math.min(pageNum, Math.max(1, Math.ceil(filteredPlots.length / pageSize)))
  useEffect(() => {
    setPageNum(currentPage)
    const visibleIds = new Set(filteredPlots.map((plot) => plot.plotId))
    setSelectedRowKeys((keys) => keys.filter((key) => visibleIds.has(key)))
  }, [currentPage, filteredPlots])

  /** 当前页数据 */
  const pagePlots = useMemo<Plot[]>(
    () => filteredPlots.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredPlots, currentPage, pageSize],
  )

  /** 查询 */
  const handleSearch = (): void => {
    setFilters(filterForm.getFieldsValue())
    setPageNum(1)
  }

  /** 重置 */
  const handleReset = (): void => {
    filterForm.resetFields()
    setFilters({})
    setPageNum(1)
  }

  /** 批量删除确认 */
  const confirmBatchDelete = (): void => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的地块')
      return
    }
    Modal.confirm({
      title: `确认删除选中的 ${selectedRowKeys.length} 个地块？`,
      content: '删除后地块下的种植记录与土壤档案将不再可用。',
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => batchDeleteMutation.mutate(selectedRowKeys),
    })
  }

  /** 列表视图列定义（原型 P4） */
  const columns: ColumnsType<Plot> = [
    { title: '地块编号', dataIndex: 'plotCode', width: 140, fixed: 'left', render: (value) => value || '-' },
    {
      title: '地块名',
      dataIndex: 'plotName',
      width: 180,
      ellipsis: true,
      render: (value: string, record) => (
        <Typography.Link onClick={() => navigate(`/production/plots/${record.plotId}`)}>
          {value}
        </Typography.Link>
      ),
    },
    {
      title: '农场',
      dataIndex: 'farmId',
      width: 160,
      render: (_, record) => record.farmName ?? farmNameMap[record.farmId] ?? '-',
    },
    {
      title: '面积',
      dataIndex: 'area',
      width: 100,
      render: (_, record) => `${Number(record.area || 0).toLocaleString('zh-CN')}亩`,
    },
    {
      title: '作物',
      key: 'crop',
      width: 120,
      render: (_, record) => {
        // 作物取 currentCrop（主数据），历史行退回 cropVariety（见 cropLabelOf 的说明）
        const crop = cropLabelOf(record)
        return crop ? (
          <Space size={4}>
            <span>{CROP_EMOJI_MAP[crop] ?? '🌱'}</span>
            <span>{crop}</span>
          </Space>
        ) : (
          <Typography.Text type="secondary">未种植</Typography.Text>
        )
      },
    },
    {
      title: '生长阶段',
      key: 'stage',
      width: 110,
      render: (_, record) =>
        plotStageMap[record.plotId] ? (
          <Tag color="geekblue">{plotStageMap[record.plotId]}</Tag>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => {
        const meta = PLOT_STATUS_META[record.status] ?? { label: '未知', color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '操作',
      key: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => (
        <Space size={8}>
          <Typography.Link onClick={() => navigate(`/production/plots/${record.plotId}`)}>
            详情
          </Typography.Link>
          <Typography.Link
            onClick={() => navigate(`/production/plots/${record.plotId}/soil`)}
          >
            土壤档案
          </Typography.Link>
          {record.status === 0 ? (
            <Typography.Link onClick={() => statusMutation.mutate({ plotId: record.plotId, status: 1 })}>
              启用
            </Typography.Link>
          ) : (
            <Popconfirm
              title="确认停用该地块？"
              description="停用后该地块不再出现在新建计划的选地列表里；地块上还有在种计划时不允许停用。"
              okText="确认停用"
              cancelText="取消"
              onConfirm={() => statusMutation.mutate({ plotId: record.plotId, status: 0 })}
            >
              <Typography.Link type="warning">停用</Typography.Link>
            </Popconfirm>
          )}
          <Popconfirm
            title="确认删除该地块？"
            okText="确认删除"
            cancelText="取消"
            onConfirm={() => deleteMutation.mutate(record.plotId)}
          >
            <Typography.Link type="danger">删除</Typography.Link>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  /** 渲染地图视图：统一使用天地图，中心点与 GeoJSON 边界均来自地块台账 */
  const renderMap = (): JSX.Element => {
    const mapPoints: TiandituMapPoint[] = filteredPlots
      .filter(
        (plot) =>
          typeof plot.centerLongitude === 'number' &&
          Number.isFinite(plot.centerLongitude) &&
          typeof plot.centerLatitude === 'number' &&
          Number.isFinite(plot.centerLatitude),
      )
      .map((plot) => ({
        id: plot.plotId,
        longitude: Number(plot.centerLongitude),
        latitude: Number(plot.centerLatitude),
        title: plot.plotName,
        meta: `${cropLabelOf(plot) || '未种植'} · ${Number(plot.area || 0).toLocaleString('zh-CN')}亩`,
        tone: plot.status === 2 ? 'green' : plot.status === 0 ? 'gray' : 'orange',
        boundary: plot.boundary,
      }))
    return (
      <Card
        size="small"
        title="生产地块分布"
        extra={
          <Space>
            <Tag color="green">天地图</Tag>
            <Typography.Text type="secondary">
              {mapPoints.length}/{filteredPlots.length} 个地块有坐标
            </Typography.Text>
          </Space>
        }
      >
        <TiandituMap
          points={mapPoints}
          height={560}
          onPointClick={(point) => navigate(`/production/plots/${point.id}`)}
        />
        {mapPoints.length === 0 && (
          <Typography.Text type="secondary">
            当前筛选地块尚未维护中心经纬度，可在地块编辑页通过天地图选点后保存。
          </Typography.Text>
        )}
      </Card>
    )
  }

  /** 与列表共用字段和操作，避免两种视图能力不一致。 */
  const renderBoard = (): JSX.Element => (
    <BusinessCards<Plot> rowKey="plotId" dataSource={pagePlots} columns={columns} pagination={false} />
  )

  /** 渲染内容区 */
  const renderContent = (): JSX.Element => {
    if (plotsQuery.isLoading || growthQuery.isLoading || plotsQuery.isFetching || growthQuery.isFetching) {
      return <Card loading />
    }
    if (plotsQuery.isError || growthQuery.isError) {
      return (
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="danger">全量数据加载失败，筛选与统计暂不可用：{(plotsQuery.error ?? growthQuery.error)?.message ?? '请重试'}</Typography.Text>
              <Button onClick={() => { void plotsQuery.refetch(); void growthQuery.refetch() }}>重新加载</Button>
            </Space>
          }
        />
      )
    }
    if (pagePlots.length === 0) {
      return (
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="secondary">暂无匹配的地块</Typography.Text>
              <Button type="primary" onClick={() => navigate('/production/plots/create')}>
                立即新增地块
              </Button>
            </Space>
          }
        />
      )
    }
    if (view === 'map') return renderMap()
    if (view === 'board') return renderBoard()
    return (
      <BusinessRecordList<Plot>
        onReload={() => Promise.all([plotsQuery.refetch(), growthQuery.refetch(), farmQuery.refetch()])}
        rowKey="plotId"
        dataSource={pagePlots}
        columns={columns}
        pagination={false}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        scroll={{ x: 1400 }}
      />
    )
  }

  return (
    <PageContainer
      title="地块管理"
      subTitle="管理地块档案、空间边界与生产关联记录"
      extra={[
        <Segmented
          key="view"
          value={view}
          onChange={(value) => setView(value as ViewMode)}
          options={[
            { label: '列表', value: 'table', icon: <TableOutlined /> },
            { label: '地图', value: 'map', icon: <EnvironmentOutlined /> },
            { label: '卡片', value: 'board', icon: <AppstoreOutlined /> },
          ]}
        />,
        <Button key="import" icon={<ImportOutlined />} disabled={!farmQuery.isSuccess || !farmQuery.data?.length}
          onClick={() => setImportOpen(true)}>导入地块</Button>,
        <Button key="batch" danger disabled={!complete || selectedRowKeys.length === 0} onClick={confirmBatchDelete}>
          批量删除（{selectedRowKeys.length}）
        </Button>,
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/production/plots/create')}
        >
          新增地块
        </Button>,
      ]}
    >
      <DetailMetricGrid items={[
        { key: 'total', title: '筛选地块', value: complete ? stats.total : null, suffix: '个' },
        { key: 'planting', title: '筛选在田', value: complete ? stats.planting : null, suffix: '个' },
        { key: 'idle', title: '筛选空闲', value: complete ? stats.idle : null, suffix: '个' },
        { key: 'area', title: '筛选面积', value: complete ? stats.area : null, suffix: '亩', precision: 2 },
      ]} />

      {(plotsQuery.isError || growthQuery.isError) && <Alert type="error" showIcon message="全量数据未加载完成，暂不显示统计" style={{ marginBottom: 16 }} />}
      <Card title="筛选地块" style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" initialValues={{ farmId: filters.farmId }} style={{ rowGap: 12 }}>
          <Form.Item name="farmId" label="农场">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部农场"
              style={{ width: 180 }}
              options={(farmQuery.data ?? []).map((farm) => ({
                value: farm.farmId,
                label: farm.farmName,
              }))}
            />
          </Form.Item>
          <Form.Item name="crop" label="作物">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部作物"
              style={{ width: 140 }}
              options={cropOptions.map((crop) => ({ value: crop, label: crop }))}
            />
          </Form.Item>
          <Form.Item name="stage" label="生长阶段">
            <Select
              allowClear
              placeholder="全部生长阶段"
              style={{ width: 150 }}
              options={stageOptions.map((stage) => ({ value: stage, label: stage }))}
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              placeholder="全部状态"
              style={{ width: 130 }}
              options={[1, 2, 3, 4, 0].map((value) => ({
                value,
                label: PLOT_STATUS_META[value].label,
              }))}
            />
          </Form.Item>
          <Form.Item name="keyword" label="关键字">
            <Input allowClear placeholder="地块编号 / 名称" style={{ width: 180 }} />
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

      <Card title="地块档案">
        {renderContent()}
        {complete && view !== 'map' && filteredPlots.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredPlots.length}
              showSizeChanger
              pageSizeOptions={[10, 20, 50]}
              onChange={(nextPage, nextSize) => {
                setPageNum(nextPage)
                setPageSize(nextSize)
              }}
            />
          </div>
        )}
      </Card>
      {importOpen && <PlotImportModal farms={farmQuery.data ?? []} initialFarmId={filters.farmId}
        onClose={() => setImportOpen(false)} onComplete={() => queryClient.invalidateQueries({ queryKey: ['plots-all'] })} />}
    </PageContainer>
  )
}
