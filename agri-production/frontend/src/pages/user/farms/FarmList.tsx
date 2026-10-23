/**
 * 页面名称：农场列表
 * 路由路径：/production/farms
 * 所属模块：农场数字化管理
 * PRD 序号：PRD 6.1 #4
 * 原型来源：用户端原型 P1 farms
 *
 * 还原要点（对照原型 P1）：
 * - 标题「🏠 农场管理」，右上角操作 `+ 新建农场`、`📥 导入`
 * - 筛选器：搜索农场名称/编号、全部状态（运营中 / 已停用）、全部类型（六种业务类型）
 * - 统计条：共 N 个农场（并补充总面积 / 运营中 / 地块总数）
 * - **卡片视图**：每张卡含 🌾 农场名、状态标签、★默认标签、
 *   📍 地区 | 类型 | 面积 | 在田面积、地块数 | 本月任务 | 告警，
 *   底部操作 `查看详情`、`生产监控→`，右上角 `更多 ▾` 下拉
 * - 额外提供「卡片 / 列表」视图切换、设为默认农场、启停、删除、CSV 导入
 *
 * 数据口径说明：
 * - 农场主数据来自 GET /farms；地块数 / 在田面积来自 GET /farms/{farmId}/summary
 * - 本月任务数来自 GET /tasks 分页 total（后端未支持月份过滤时按全量任务数展示）
 * - 告警数来自 GET /alerts 分页 total
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import type { MenuProps } from 'antd'
import {
  AppstoreOutlined,
  DownOutlined,
  ImportOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { deleteFarm, getFarmSummary, listFarms, updateFarmStatus, createFarm } from '@/api/farms'
import { listAlerts } from '@/api/alerts'
import { listTasks } from '@/api/tasks'
import useFarmStore from '@/store/farm'
import type { Farm } from '@/types'

/** 视图模式：卡片 / 列表 */
type ViewMode = 'card' | 'table'

/** 筛选表单值 */
interface FilterValues {
  /** 关键字：农场名称 / 编号 */
  keyword?: string
  /** 状态：1 运营中 0 已停用 */
  status?: number
  /** 业务类型标签（客户端二次过滤） */
  typeLabel?: string
}

/** 农场概况（GET /farms/{farmId}/summary） */
interface FarmSummary {
  /** 地块总数 */
  plotCount: number
  /** 地块面积合计（亩） */
  plotAreaTotal: number
  /** 农场总面积（亩，后端返回） */
  areaTotal: number
}

/** 农场状态标签元数据 */
const FARM_STATUS_META: Record<number, { label: string; color: string }> = {
  1: { label: '运营中', color: 'green' },
  0: { label: '已停用', color: 'default' },
}

/** 农场类型（后端枚举 1 种植 2 养殖 3 混合）兜底文案 */
const FARM_TYPE_FALLBACK_MAP: Record<number, string> = {
  1: '种植类',
  2: '养殖类',
  3: '综合种养',
}

/** 农场业务类型选项（原型 P1 / P3 口径） */
const FARM_TYPE_BUSINESS_OPTIONS: string[] = [
  '蔬菜种植',
  '水稻种植',
  '果树种植',
  '综合养殖',
  '畜牧养殖',
  '水产养殖',
]

/**
 * 从 remark 中解析自定义键值。
 *
 * 后端 FarmInfoEntity 未包含「海拔」「业务类型」字段，
 * 新增农场页将其以 `海拔:35m；产业类型:蔬菜种植` 形式写入 remark，此处回读。
 *
 * @param remark 备注原文
 * @param key 键名
 * @returns 解析出的值，未命中返回 undefined
 */
function parseRemarkField(remark: string | undefined, key: string): string | undefined {
  if (!remark) return undefined
  const match = remark.match(new RegExp(`${key}[:：]\\s*([^；;]+)`))
  const value = match?.[1]?.trim()
  return value ? value : undefined
}

/** 解析农场业务类型文案：优先 remark 中的产业类型，兜底后端 farmType 枚举 */
function resolveFarmTypeLabel(farm: Farm): string {
  return (
    parseRemarkField(farm.remark, '产业类型') ??
    FARM_TYPE_FALLBACK_MAP[farm.farmType] ??
    '未分类'
  )
}

/** 解析农场海拔（米） */
function resolveAltitude(farm: Farm): string {
  return parseRemarkField(farm.remark, '海拔') ?? '暂未录入'
}

/** 将后端 map 型统计转换为强类型结构（缺省值 0，避免 NaN 渲染） */
function toFarmSummary(raw: Record<string, number> | undefined): FarmSummary {
  const pick = (key: string): number => {
    const value = (raw as unknown as Record<string, unknown> | undefined)?.[key]
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return {
    plotCount: pick('plotCount'),
    plotAreaTotal: pick('plotAreaTotal'),
    areaTotal: pick('areaTotal'),
  }
}

/** 格式化面积（亩） */
function formatArea(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-'
  return `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}亩`
}

/**
 * 农场列表页
 *
 * 业务职责：以卡片 / 列表双视图展示主体下全部农场，支持检索筛选、
 * 切换当前农场、启停、删除与 CSV 批量导入。
 *
 * @returns 页面内容
 */
export default function FarmList(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const setCurrentFarm = useFarmStore((state) => state.setCurrentFarm)

  const [view, setView] = useState<ViewMode>('card')
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(9)
  const [filters, setFilters] = useState<FilterValues>({})
  const [filterForm] = Form.useForm<FilterValues>()

  /** 农场分页数据（关键字 / 状态由服务端过滤） */
  const listQuery = useQuery({
    queryKey: ['farms', filters, pageNum, pageSize],
    queryFn: () =>
      listFarms({
        keyword: filters.keyword,
        farmName: filters.keyword,
        status: filters.status,
        pageNum,
        pageSize,
      }),
  })

  /** 当前页农场 ID，用于并行拉取各自概况 */
  const pageFarmIds = useMemo<string[]>(
    () => (listQuery.data?.list ?? []).map((farm) => farm.farmId).filter(Boolean),
    [listQuery.data],
  )

  /** 各农场概况（地块数 / 在田面积 / 总面积） */
  const summaryResults = useQueries({
    queries: pageFarmIds.map((farmId) => ({
      queryKey: ['farm-summary', farmId],
      queryFn: () => getFarmSummary(farmId),
      retry: false,
      staleTime: 60_000,
    })),
  })

  /** 各农场任务总数（原型「本月任务」） */
  const taskResults = useQueries({
    queries: pageFarmIds.map((farmId) => ({
      queryKey: ['farm-task-count', farmId],
      queryFn: () => listTasks({ farmId, pageNum: 1, pageSize: 1 }),
      retry: false,
      staleTime: 60_000,
    })),
  })

  /** 各农场告警总数（原型「告警 N 条」） */
  const alertResults = useQueries({
    queries: pageFarmIds.map((farmId) => ({
      queryKey: ['farm-alert-count', farmId],
      queryFn: () => listAlerts({ farmId, pageNum: 1, pageSize: 1 }),
      retry: false,
      staleTime: 60_000,
    })),
  })

  /** farmId → 概况映射 */
  const summaryMap = useMemo<Record<string, FarmSummary>>(() => {
    const map: Record<string, FarmSummary> = {}
    summaryResults.forEach((result, index) => {
      map[pageFarmIds[index]] = toFarmSummary(result.data)
    })
    return map
  }, [summaryResults, pageFarmIds])

  /** farmId → 任务数映射 */
  const taskCountMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    taskResults.forEach((result, index) => {
      map[pageFarmIds[index]] = result.data?.total ?? 0
    })
    return map
  }, [taskResults, pageFarmIds])

  /** farmId → 告警数映射 */
  const alertCountMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    alertResults.forEach((result, index) => {
      map[pageFarmIds[index]] = result.data?.total ?? 0
    })
    return map
  }, [alertResults, pageFarmIds])

  /** 统一刷新 */
  const invalidateFarms = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['farms'] })

  /** 启停农场 */
  const statusMutation = useMutation({
    mutationFn: (params: { farmId: string; status: number }) =>
      updateFarmStatus(params.farmId, params.status),
    onSuccess: () => {
      message.success('农场状态已更新')
      void invalidateFarms()
    },
  })

  /** 删除农场 */
  const deleteMutation = useMutation({
    mutationFn: (farmId: string) => deleteFarm(farmId),
    onSuccess: () => {
      message.success('农场已删除')
      void invalidateFarms()
    },
  })

  /** CSV 批量导入 */
  const importMutation = useMutation({
    mutationFn: async (rows: Record<string, string>[]) => {
      const results = await Promise.allSettled(
        rows.map((row) =>
          createFarm({
            farmName: row['农场名称'],
            province: row['省份'],
            city: row['城市'],
            district: row['区县'],
            address: row['详细地址'],
            areaTotal: Number(row['面积']) || 0,
            managerName: row['负责人'],
            managerPhone: row['联系电话'],
            status: 1,
            remark: row['产业类型'] ? `产业类型:${row['产业类型']}` : undefined,
          }),
        ),
      )
      const success = results.filter((item) => item.status === 'fulfilled').length
      return { success, failed: results.length - success }
    },
    onSuccess: (result) => {
      message.success(`导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`)
      void invalidateFarms()
    },
  })

  /** 业务类型过滤后的列表（服务端不支持类型过滤，前端二次过滤） */
  const filteredList = useMemo<Farm[]>(() => {
    const list = listQuery.data?.list ?? []
    if (!filters.typeLabel) return list
    return list.filter((farm) => resolveFarmTypeLabel(farm) === filters.typeLabel)
  }, [listQuery.data, filters.typeLabel])

  /** 统计条数据 */
  const stats = useMemo(() => {
    const total = listQuery.data?.total ?? 0
    const activeCount = filteredList.filter((farm) => farm.status === 1).length
    const areaTotal = filteredList.reduce(
      (sum, farm) => sum + (Number(farm.areaTotal) || 0),
      0,
    )
    const plotCount = filteredList.reduce(
      (sum, farm) => sum + (summaryMap[farm.farmId]?.plotCount ?? 0),
      0,
    )
    return { total, activeCount, areaTotal, plotCount }
  }, [listQuery.data, filteredList, summaryMap])

  /** 切换当前农场（作用域上下文） */
  const handleSwitchFarm = (farm: Farm): void => {
    setCurrentFarm({ farmId: farm.farmId, farmCode: farm.farmCode, farmName: farm.farmName })
    message.success(`已切换到「${farm.farmName}」`)
  }

  /** 停启用确认 */
  const confirmToggleStatus = (farm: Farm): void => {
    const next = farm.status === 1 ? 0 : 1
    Modal.confirm({
      title: next === 1 ? '确认启用该农场？' : '确认停用该农场？',
      content: `农场：${farm.farmName}。停用后该农场下的地块与任务将不再参与调度。`,
      okText: next === 1 ? '确认启用' : '确认停用',
      cancelText: '取消',
      onOk: () => statusMutation.mutate({ farmId: farm.farmId, status: next }),
    })
  }

  /** 删除确认 */
  const confirmDelete = (farm: Farm): void => {
    Modal.confirm({
      title: '确认删除该农场？',
      content: `农场：${farm.farmName}。删除后不可恢复，请先完成数据备份。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => deleteMutation.mutate(farm.farmId),
    })
  }

  /** 更多下拉：统一分发 */
  const handleMoreAction = (key: string, farm: Farm): void => {
    switch (key) {
      case 'default':
        handleSwitchFarm(farm)
        break
      case 'plots':
        navigate(`/production/plots?farmId=${farm.farmId}`)
        break
      case 'plot-create':
        navigate(`/production/plots/create?farmId=${farm.farmId}`)
        break
      case 'edit':
        navigate(`/production/farms/create?farmId=${farm.farmId}`)
        break
      case 'toggle':
        confirmToggleStatus(farm)
        break
      case 'delete':
        confirmDelete(farm)
        break
      default:
        break
    }
  }

  /** 构建卡片「更多」菜单 */
  const buildMenuItems = (farm: Farm): MenuProps['items'] => [
    { key: 'default', label: '设为默认农场' },
    { key: 'plots', label: '查看地块' },
    { key: 'plot-create', label: '新增地块' },
    { key: 'edit', label: '编辑资料' },
    { type: 'divider' },
    { key: 'toggle', label: farm.status === 1 ? '停用农场' : '启用农场' },
    { key: 'delete', label: '删除农场', danger: true },
  ]

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

  /** CSV 文件导入解析 */
  const handleImportFile = (file: File): void => {
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
      const rows = lines.slice(1).map((line) => {
        const cells = line.split(',').map((item) => item.trim())
        const row: Record<string, string> = {}
        headers.forEach((header, index) => {
          row[header] = cells[index] ?? ''
        })
        return row
      })
      const validRows = rows.filter((row) => Boolean(row['农场名称']))
      if (validRows.length === 0) {
        message.warning('未解析到有效数据，请检查「农场名称」列')
        return
      }
      importMutation.mutate(validRows)
    }
    reader.onerror = () => message.error('文件读取失败，请重试')
    reader.readAsText(file, 'UTF-8')
  }

  /** 列表视图列定义 */
  const columns: ColumnsType<Farm> = [
    { title: '农场编号', dataIndex: 'farmCode', width: 140, render: (value) => value || '-' },
    { title: '农场名称', dataIndex: 'farmName', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => (
        <Tag color={FARM_STATUS_META[record.status]?.color ?? 'default'}>
          {FARM_STATUS_META[record.status]?.label ?? '未知'}
        </Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'farmType',
      width: 110,
      render: (_, record) => <Tag>{resolveFarmTypeLabel(record)}</Tag>,
    },
    {
      title: '地区',
      key: 'region',
      width: 180,
      render: (_, record) =>
        `${record.province ?? ''}${record.city ?? ''}${record.district ?? ''}` || '-',
    },
    {
      title: '面积',
      dataIndex: 'areaTotal',
      width: 100,
      render: (_, record) => formatArea(Number(record.areaTotal)),
    },
    {
      title: '在田面积',
      key: 'planted',
      width: 110,
      render: (_, record) => formatArea(summaryMap[record.farmId]?.plotAreaTotal ?? 0),
    },
    {
      title: '地块数',
      key: 'plotCount',
      width: 90,
      render: (_, record) => summaryMap[record.farmId]?.plotCount ?? 0,
    },
    {
      title: '操作',
      key: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size={8}>
          <Typography.Link onClick={() => navigate(`/production/farms/${record.farmId}`)}>
            详情
          </Typography.Link>
          <Typography.Link onClick={() => navigate(`/production/monitor?farmId=${record.farmId}`)}>
            监控
          </Typography.Link>
          <Dropdown
            trigger={['click']}
            menu={{ items: buildMenuItems(record), onClick: (info) => handleMoreAction(info.key, record) }}
          >
            <Typography.Link>
              更多 <DownOutlined />
            </Typography.Link>
          </Dropdown>
        </Space>
      ),
    },
  ]

  /** 渲染单张农场卡片（原型 P1） */
  const renderFarmCard = (farm: Farm): JSX.Element => {
    const summary = summaryMap[farm.farmId]
    const taskCount = taskCountMap[farm.farmId] ?? 0
    const alertCount = alertCountMap[farm.farmId] ?? 0
    const isDefault = currentFarm?.farmId === farm.farmId
    const statusMeta = FARM_STATUS_META[farm.status] ?? { label: '未知', color: 'default' }
    const plantedArea = summary?.plotAreaTotal ?? 0
    const usageRate =
      summary && summary.areaTotal > 0
        ? Math.round((plantedArea / summary.areaTotal) * 100)
        : 0

    return (
      <Card
        hoverable
        loading={listQuery.isLoading}
        title={
          <Space size={6}>
            <span>🌾</span>
            <Typography.Text strong ellipsis style={{ maxWidth: 160 }}>
              {farm.farmName}
            </Typography.Text>
            {isDefault && (
              <Tag color="gold" style={{ marginInlineEnd: 0 }}>
                ★ 默认
              </Tag>
            )}
          </Space>
        }
        extra={
          <Dropdown
            trigger={['click']}
            menu={{ items: buildMenuItems(farm), onClick: (info) => handleMoreAction(info.key, farm) }}
          >
            <Button size="small">
              更多 <DownOutlined />
            </Button>
          </Dropdown>
        }
        actions={[
          <Typography.Link
            key="detail"
            onClick={() => navigate(`/production/farms/${farm.farmId}`)}
          >
            查看详情
          </Typography.Link>,
          <Typography.Link
            key="monitor"
            onClick={() => navigate(`/production/monitor?farmId=${farm.farmId}`)}
          >
            生产监控→
          </Typography.Link>,
        ]}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space size={6} wrap>
            <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            <Tag>{resolveFarmTypeLabel(farm)}</Tag>
          </Space>
          <Typography.Text type="secondary">
            📍 {farm.province ?? '-'}
            {farm.city ? `·${farm.city}` : ''}
            {farm.district ? `·${farm.district}` : ''} | {formatArea(Number(farm.areaTotal))} | 在田{' '}
            {formatArea(plantedArea)}（{usageRate}%）
          </Typography.Text>
          <Typography.Text type="secondary">
            海拔 {resolveAltitude(farm)} | 负责人 {farm.managerName ?? '-'} |{' '}
            {farm.managerPhone ?? '-'}
          </Typography.Text>
          <Space size={12} wrap>
            <Typography.Text>
              地块:{' '}
              <Typography.Text strong>{summary?.plotCount ?? 0}个</Typography.Text>
            </Typography.Text>
            <Typography.Text>
              本月任务: <Typography.Text strong>{taskCount}</Typography.Text>
            </Typography.Text>
            <Typography.Text type={alertCount > 0 ? 'danger' : 'secondary'}>
              告警: <Typography.Text strong>{alertCount}条</Typography.Text>
            </Typography.Text>
          </Space>
        </Space>
      </Card>
    )
  }

  /** 渲染内容区（加载 / 错误 / 空 / 卡片 / 列表） */
  const renderContent = (): JSX.Element => {
    if (listQuery.isLoading) {
      return (
        <Row gutter={[16, 16]}>
          {[0, 1, 2].map((key) => (
            <Col key={key} xs={24} md={12} xxl={8}>
              <Card loading />
            </Col>
          ))}
        </Row>
      )
    }
    if (listQuery.isError) {
      return (
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="danger">农场数据加载失败，请稍后重试</Typography.Text>
              <Button onClick={() => void listQuery.refetch()}>重新加载</Button>
            </Space>
          }
        />
      )
    }
    if (filteredList.length === 0) {
      return (
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="secondary">
                暂无匹配的农场，试试调整筛选条件
              </Typography.Text>
              <Button
                type="primary"
                onClick={() => navigate('/production/farms/create')}
              >
                立即新建农场
              </Button>
            </Space>
          }
        />
      )
    }
    if (view === 'table') {
      return <Table<Farm> rowKey="farmId" columns={columns} dataSource={filteredList} pagination={false} />
    }
    return (
      <Row gutter={[16, 16]}>
        {filteredList.map((farm) => (
          <Col key={farm.farmId} xs={24} md={12} xxl={8}>
            {renderFarmCard(farm)}
          </Col>
        ))}
      </Row>
    )
  }

  return (
    <PageContainer
      title="🏠 农场管理"
      subTitle={`共 ${stats.total} 个农场`}
      extra={[
        <Segmented
          key="view"
          value={view}
          onChange={(value) => setView(value as ViewMode)}
          options={[
            { label: '卡片视图', value: 'card', icon: <AppstoreOutlined /> },
            { label: '列表视图', value: 'table', icon: <UnorderedListOutlined /> },
          ]}
        />,
        <Upload
          key="import"
          accept=".csv,.txt"
          showUploadList={false}
          beforeUpload={(file) => {
            handleImportFile(file as File)
            return false
          }}
        >
          <Button icon={<ImportOutlined />}>📥 导入</Button>
        </Upload>,
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/production/farms/create')}
        >
          新建农场
        </Button>,
      ]}
    >
      <Card style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" style={{ rowGap: 12 }}>
          <Form.Item name="keyword" label="搜索">
            <Input allowClear placeholder="搜索农场名称/编号..." style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              placeholder="全部状态"
              style={{ width: 130 }}
              options={[
                { value: 1, label: '运营中' },
                { value: 0, label: '已停用' },
              ]}
            />
          </Form.Item>
          <Form.Item name="typeLabel" label="类型">
            <Select
              allowClear
              placeholder="全部类型"
              style={{ width: 140 }}
              options={FARM_TYPE_BUSINESS_OPTIONS.map((label) => ({ value: label, label }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="农场总数" value={stats.total} suffix="个" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="运营中"
              value={stats.activeCount}
              suffix="个"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="总面积" value={stats.areaTotal} suffix="亩" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="地块总数" value={stats.plotCount} suffix="个" />
          </Card>
        </Col>
      </Row>

      <Card>
        {renderContent()}
        {view === 'card' && filteredList.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Pagination
              current={pageNum}
              pageSize={pageSize}
              total={listQuery.data?.total ?? 0}
              showSizeChanger
              pageSizeOptions={[6, 9, 12, 24]}
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
