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
 * 数据说明：后端地块列表接口仅支持 keyword / status 过滤，不支持农场与作物过滤，
 * 因此本页一次性取全量（≤500 条）后在客户端完成四维筛选与分页，保证统计口径准确。
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import {
  AppstoreOutlined,
  DeleteOutlined,
  ImportOutlined,
  PlusOutlined,
  TableOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { deletePlot, listPlots } from '@/api/plots'
import { listAllFarms } from '@/api/farms'
import { listGrowthRecords } from '@/api/growth'
import type { Plot } from '@/types'
// 地块状态与作物 emoji 已统一收敛到 @/types（原各页面各存一份）
import { CROP_EMOJI_MAP, PLOT_STATUS_META } from '@/types'

/** 视图模式：列表 / 地图 / 看板（卡片） */
type ViewMode = 'table' | 'map' | 'board'

/** 地块状态元数据 */
/** 种植类型元数据 */
const PLANTING_TYPE_META: Record<number, { label: string; color: string }> = {
  1: { label: '露天', color: 'green' },
  2: { label: '大棚', color: 'cyan' },
  3: { label: '水田', color: 'blue' },
  4: { label: '山地', color: 'geekblue' },
}

/** 原型 P4 生长阶段取值 */
const DEFAULT_STAGE_OPTIONS: string[] = ['苗期', '开花期', '结果期', '采收期']

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

/** 地图视图色块配色（按状态） */
const MAP_COLOR_MAP: Record<number, string> = {
  0: '#d9d9d9',
  1: '#91caff',
  2: '#95de64',
  3: '#ffd591',
  4: '#ffe58f',
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

  const [view, setView] = useState<ViewMode>('table')
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [filters, setFilters] = useState<PlotFilters>({
    farmId: searchParams.get('farmId') ?? undefined,
  })
  const [filterForm] = Form.useForm<PlotFilters>()

  /** 地块全量数据（≤500 条，客户端筛选） */
  const plotsQuery = useQuery({
    queryKey: ['plots-all'],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 500 }),
  })

  /** 农场下拉 */
  const farmQuery = useQuery({
    queryKey: ['farm-options'],
    queryFn: () => listAllFarms(),
  })

  /** 生长记录：构建 地块 → 最新生育期映射 */
  const growthQuery = useQuery({
    queryKey: ['growth-stage-options'],
    queryFn: () => listGrowthRecords({ pageNum: 1, pageSize: 200 }),
    retry: false,
  })

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

  /** 批量删除 */
  const batchDeleteMutation = useMutation({
    mutationFn: (plotIds: string[]) =>
      Promise.allSettled(plotIds.map((plotId) => deletePlot(plotId))),
    onSuccess: () => {
      message.success('批量删除完成')
      setSelectedRowKeys([])
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

  /** 作物下拉选项（取自真实数据） */
  const cropOptions = useMemo<string[]>(() => {
    const set = new Set<string>()
    ;(plotsQuery.data?.list ?? []).forEach((plot) => {
      const crop = plot.cropVariety?.trim()
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
      if (filters.crop && (plot.cropVariety ?? '') !== filters.crop) return false
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
      fallow: list.filter((plot) => plot.status === 4).length,
      area: list.reduce((sum, plot) => sum + (Number(plot.area) || 0), 0),
    }
  }, [filteredPlots])

  /** 当前页数据 */
  const pagePlots = useMemo<Plot[]>(
    () => filteredPlots.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [filteredPlots, pageNum, pageSize],
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

  /** CSV 导入（演示：解析后提示，实际写入需后端批量接口） */
  const handleImport = (file: File): void => {
    const reader = new FileReader()
    reader.onload = () => {
      const lines = String(reader.result ?? '')
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
      if (lines.length < 2) {
        message.warning('文件内容为空，请检查 CSV 模板')
        return
      }
      const headers = lines[0].split(',').map((item) => item.trim())
      if (!headers.includes('地块名称')) {
        message.warning('缺少「地块名称」列，请下载模板后重新填写')
        return
      }
      message.info(`已解析 ${lines.length - 1} 条地块记录，请等待后端批量导入接口开放`)
    }
    reader.onerror = () => message.error('文件读取失败，请重试')
    reader.readAsText(file, 'UTF-8')
  }

  /** 列表视图列定义（原型 P4） */
  const columns: ColumnsType<Plot> = [
    { title: '地块编号', dataIndex: 'plotCode', width: 140, render: (value) => value || '-' },
    {
      title: '地块名',
      dataIndex: 'plotName',
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
      render: (_, record) =>
        record.cropVariety ? (
          <Space size={4}>
            <span>{CROP_EMOJI_MAP[record.cropVariety] ?? '🌱'}</span>
            <span>{record.cropVariety}</span>
          </Space>
        ) : (
          <Typography.Text type="secondary">未种植</Typography.Text>
        ),
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
      width: 160,
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

  /** 渲染地图视图（占位示意图） */
  const renderMap = (): JSX.Element => (
    <div
      style={{
        position: 'relative',
        minHeight: 420,
        borderRadius: 8,
        border: '1px dashed #91caff',
        background:
          'repeating-linear-gradient(45deg, #f0f7ff, #f0f7ff 12px, #e6f4ff 12px, #e6f4ff 24px)',
        padding: 16,
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          🗺️ 地块分布示意（接入高德 / 天地图后将展示真实地块边界）
        </Typography.Text>
        <Row gutter={[12, 12]}>
          {pagePlots.map((plot) => (
            <Col key={plot.plotId} xs={12} sm={8} md={6} lg={4}>
              <Card
                size="small"
                hoverable
                onClick={() => navigate(`/production/plots/${plot.plotId}`)}
                style={{ background: MAP_COLOR_MAP[plot.status] ?? '#f5f5f5' }}
              >
                <Typography.Text strong ellipsis>
                  {plot.plotName}
                </Typography.Text>
                <div>
                  <Typography.Text type="secondary">
                    {Number(plot.area || 0).toLocaleString('zh-CN')}亩
                  </Typography.Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Space>
    </div>
  )

  /** 渲染看板（卡片）视图 */
  const renderBoard = (): JSX.Element => (
    <Row gutter={[12, 12]}>
      {pagePlots.map((plot) => {
        const statusMeta = PLOT_STATUS_META[plot.status] ?? { label: '未知', color: 'default' }
        const plantingMeta = PLANTING_TYPE_META[plot.plantingType] ?? {
          label: '未知',
          color: 'default',
        }
        return (
          <Col key={plot.plotId} xs={24} sm={12} md={8} xl={6}>
            <Card
              hoverable
              onClick={() => navigate(`/production/plots/${plot.plotId}`)}
              title={
                <Space size={4}>
                  <span>{CROP_EMOJI_MAP[plot.cropVariety ?? ''] ?? '🌱'}</span>
                  <Typography.Text ellipsis style={{ maxWidth: 120 }}>
                    {plot.plotName}
                  </Typography.Text>
                </Space>
              }
              extra={<Tag color={statusMeta.color}>{statusMeta.label}</Tag>}
              actions={[
                <Typography.Link
                  key="soil"
                  onClick={(event) => {
                    event.stopPropagation()
                    navigate(`/production/plots/${plot.plotId}/soil`)
                  }}
                >
                  土壤档案
                </Typography.Link>,
                <Popconfirm
                  key="delete"
                  title="确认删除该地块？"
                  okText="确认删除"
                  cancelText="取消"
                  onConfirm={() => deleteMutation.mutate(plot.plotId)}
                >
                  <Typography.Link type="danger" onClick={(event) => event.stopPropagation()}>
                    <DeleteOutlined /> 删除
                  </Typography.Link>
                </Popconfirm>,
              ]}
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Typography.Text type="secondary">{plot.plotCode || '无编号'}</Typography.Text>
                <Typography.Text>
                  {Number(plot.area || 0).toLocaleString('zh-CN')}亩 | {plot.soilType || '未检测'} |{' '}
                  {plot.irrigationType || '未配置'}
                </Typography.Text>
                <Space size={4} wrap>
                  <Tag color={plantingMeta.color}>{plantingMeta.label}</Tag>
                  {plotStageMap[plot.plotId] && (
                    <Tag color="geekblue">{plotStageMap[plot.plotId]}</Tag>
                  )}
                </Space>
              </Space>
            </Card>
          </Col>
        )
      })}
    </Row>
  )

  /** 渲染内容区 */
  const renderContent = (): JSX.Element => {
    if (plotsQuery.isLoading) {
      return <Card loading />
    }
    if (plotsQuery.isError) {
      return (
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="danger">地块数据加载失败，请稍后重试</Typography.Text>
              <Button onClick={() => void plotsQuery.refetch()}>重新加载</Button>
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
      <Table<Plot>
        rowKey="plotId"
        dataSource={pagePlots}
        columns={columns}
        pagination={false}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        scroll={{ x: 1100 }}
      />
    )
  }

  return (
    <PageContainer
      title="🗺️ 地块管理"
      subTitle={`共 ${stats.total} 个地块 | 在田 ${stats.planting} | 休耕 ${stats.fallow} | 合计 ${stats.area}亩`}
      extra={[
        <Segmented
          key="view"
          value={view}
          onChange={(value) => setView(value as ViewMode)}
          options={[
            { label: '列表', value: 'table', icon: <TableOutlined /> },
            { label: '地图', value: 'map', icon: <EnvironmentOutlined /> },
            { label: '看板', value: 'board', icon: <AppstoreOutlined /> },
          ]}
        />,
        <Upload
          key="import"
          accept=".csv,.txt"
          showUploadList={false}
          beforeUpload={(file) => {
            handleImport(file as File)
            return false
          }}
        >
          <Button icon={<ImportOutlined />}>📥 批量导入</Button>
        </Upload>,
        <Button key="batch" danger disabled={selectedRowKeys.length === 0} onClick={confirmBatchDelete}>
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
      <Card style={{ marginBottom: 16 }}>
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

      <Card>
        {renderContent()}
        {view !== 'map' && filteredPlots.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Pagination
              current={pageNum}
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
    </PageContainer>
  )
}
