/**
 * 页面名称：溯源码管理
 * 路由路径：/production/trace
 * 所属模块：质量检测与溯源
 * PRD 序号：PRD 6.1 #36
 * 原型来源：用户端原型 P23 trace
 *
 * 还原要点：
 * - 标题 🏷️ 溯源码管理 + `+ 生成溯源码` / `批量生成` / `刷新` 按钮
 * - 统计卡 4 项：溯源码总量 / 已激活 / 已扫码 / 待分配
 * - 筛选：全部状态（已生成 / 已激活 / 已扫码 / 已作废）+ 全部农场 + 搜索溯源码 + 查询 / 重置
 * - 表格列：溯源码 | 关联产品 | 农场/地块 | 批次号 | 生成时间 | 状态 | 扫码次数 | 有效期 | 操作
 * - 行操作：全链路→（跳转 P24）/ 激活（prod.trace.activated）/ 模拟扫码 / 作废
 * - 勾选后支持批量激活、批量作废、导出 CSV
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  AutoComplete,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { Dayjs } from 'dayjs'
import {
  ExportOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import {
  activateTraceCode,
  fetchTraceCodePage,
  generateTraceCode,
  revokeTraceCode,
  scanTraceCode,
} from '@/api/trace'
import { listHarvests } from '@/api/harvests'
import type { HarvestBatch, RawTraceCode, TraceCodeStatus } from '@/types'

/** 状态展示元数据（generated 灰 / activated 绿 / scanned 蓝 / expired 红） */
const STATUS_META: Record<TraceCodeStatus, { label: string; color: string }> = {
  generated: { label: '已生成', color: 'default' },
  activated: { label: '已激活', color: 'green' },
  scanned: { label: '已扫码', color: 'blue' },
  expired: { label: '已作废', color: 'red' },
}

/** 状态下拉选项 */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'generated', label: '已生成' },
  { value: 'activated', label: '已激活' },
  { value: 'scanned', label: '已扫码' },
  { value: 'expired', label: '已作废' },
]

/** 列表一次性拉取上限（后端未提供关键字检索，关键字过滤在前端完成） */
const MAX_FETCH_SIZE = 500

/** 生成弹窗表单值 */
interface GenerateFormValues {
  /** 关联批次 ID */
  batchId: string
  /** 生成数量 */
  count: number
  /** 有效期 */
  expireDate?: Dayjs
}

/** 列表筛选条件 */
interface CodeFilters {
  /** 状态 */
  status?: string
  /** 农场 ID */
  farmId?: string
  /** 关键字（溯源码 / 批次号 / 产品） */
  keyword?: string
}

/**
 * 归一化后端状态为前端状态枚举。
 *
 * 后端 prod_trace_code 写入值为 generated / active / scanned / revoked，
 * 前端统一展示口径为 generated / activated / scanned / expired。
 *
 * @param status 后端状态字符串
 * @returns 前端状态枚举
 */
function normalizeStatus(status?: string): TraceCodeStatus {
  switch (status) {
    case 'active':
    case 'activated':
      return 'activated'
    case 'scanned':
      return 'scanned'
    case 'revoked':
    case 'expired':
      return 'expired'
    default:
      return 'generated'
  }
}

/**
 * 前端状态转换为后端查询值。
 *
 * @param status 前端状态
 * @returns 后端状态查询值，全部时返回 undefined
 */
function toServerStatus(status?: string): string | undefined {
  switch (status) {
    case 'generated':
      return 'generated'
    case 'activated':
      return 'active'
    case 'scanned':
      return 'scanned'
    case 'expired':
      return 'revoked'
    default:
      return undefined
  }
}

/** 格式化时间：仅保留日期部分 */
function toDateText(value?: string): string {
  if (!value) return '-'
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD') : value
}

/** CSV 单元格转义 */
function escapeCsv(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

/**
 * 溯源码管理页
 *
 * 业务职责：溯源码台账维护，支持按批次批量生成、激活、扫码累计、作废与全链路跳转。
 *
 * @returns 页面内容
 */
export default function TraceCodeManage(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmOptions = useFarmStore((state) => state.farmOptions)
  const farmId = currentFarm?.farmId

  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [filters, setFilters] = useState<CodeFilters>({})
  const [filterForm] = Form.useForm<CodeFilters>()

  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [genOpen, setGenOpen] = useState<boolean>(false)
  const [genMode, setGenMode] = useState<'single' | 'batch'>('single')
  const [genForm] = Form.useForm<GenerateFormValues>()

  /** 列表数据源（按状态过滤，关键字在前端二次过滤） */
  const listQuery = useQuery({
    queryKey: ['trace-codes', farmId, filters.status],
    enabled: Boolean(farmId),
    queryFn: () =>
      fetchTraceCodePage({
        status: toServerStatus(filters.status),
        pageNum: 1,
        pageSize: MAX_FETCH_SIZE,
      }),
  })

  /** 统计卡：总量 */
  const totalQuery = useQuery({
    queryKey: ['trace-code-total', 'all'],
    enabled: Boolean(farmId),
    queryFn: () => fetchTraceCodePage({ pageNum: 1, pageSize: 1 }),
  })

  /** 统计卡：已激活 */
  const activatedQuery = useQuery({
    queryKey: ['trace-code-total', 'active'],
    enabled: Boolean(farmId),
    queryFn: () => fetchTraceCodePage({ status: 'active', pageNum: 1, pageSize: 1 }),
  })

  /** 统计卡：已扫码 */
  const scannedQuery = useQuery({
    queryKey: ['trace-code-total', 'scanned'],
    enabled: Boolean(farmId),
    queryFn: () => fetchTraceCodePage({ status: 'scanned', pageNum: 1, pageSize: 1 }),
  })

  /** 统计卡：待分配（已生成未激活） */
  const generatedQuery = useQuery({
    queryKey: ['trace-code-total', 'generated'],
    enabled: Boolean(farmId),
    queryFn: () => fetchTraceCodePage({ status: 'generated', pageNum: 1, pageSize: 1 }),
  })

  /** 采收批次下拉（生成溯源码时选择关联批次） */
  const batchQuery = useQuery({
    queryKey: ['harvest-batch-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listHarvests({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 批次下拉选项 */
  const batchOptions = useMemo(
    () =>
      (batchQuery.data?.list ?? []).map((batch: HarvestBatch) => ({
        value: String(batch.batchId),
        label: `${batch.batchNo ?? batch.batchId} · ${batch.cropName ?? batch.cropId ?? '未知名产品'}`,
      })),
    [batchQuery.data],
  )

  /** 累计扫码次数（用于统计卡副标题） */
  const totalScanCount = useMemo(
    () => (listQuery.data?.list ?? []).reduce((sum, item) => sum + Number(item.scanCount ?? 0), 0),
    [listQuery.data],
  )

  /** 前端过滤后的列表 */
  const filteredList = useMemo<RawTraceCode[]>(() => {
    const keyword = (filters.keyword ?? '').trim().toLowerCase()
    return (listQuery.data?.list ?? []).filter((item) => {
      if (filters.farmId && item.farmId && item.farmId !== filters.farmId) return false
      if (!keyword) return true
      return [item.code, item.batchNo, item.productName, item.batchId]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(keyword))
    })
  }, [listQuery.data, filters.keyword, filters.farmId])

  /** 统一失效刷新 */
  const invalidateAll = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['trace-codes'] })
    await queryClient.invalidateQueries({ queryKey: ['trace-code-total'] })
    await queryClient.invalidateQueries({ queryKey: ['harvest-batch-options'] })
  }

  /**
   * 批量执行溯源码动作并按成功 / 失败分别提示。
   *
   * @param codes 溯源码集合
   * @param action 单个溯源码执行的动作
   * @param okText 成功提示前缀
   */
  const runBatchAction = async (
    codes: string[],
    action: (code: string) => Promise<unknown>,
    okText: string,
  ): Promise<void> => {
    const results = await Promise.allSettled(codes.map((code) => action(code)))
    const ok = results.filter((item) => item.status === 'fulfilled').length
    const fail = results.length - ok
    if (ok > 0) message.success(`${okText}成功 ${ok} 个`)
    if (fail > 0) message.error(`${fail} 个溯源码操作失败，请刷新后重试`)
    if (ok === 0 && fail === 0) message.warning('请先选择溯源码')
    await invalidateAll()
  }

  /** 批量生成溯源码 */
  const generateMutation = useMutation({
    mutationFn: async (payload: { batchId: string; count: number; expireDate?: string }) => {
      const results = await Promise.allSettled(
        Array.from({ length: payload.count }, () =>
          generateTraceCode(payload.batchId, payload.expireDate),
        ),
      )
      const ok = results.filter((item) => item.status === 'fulfilled').length
      const first = results.find((item) => item.status === 'fulfilled')
      return {
        ok,
        fail: results.length - ok,
        firstCode: first && first.status === 'fulfilled' ? String(first.value) : undefined,
      }
    },
    onSuccess: async (result) => {
      if (result.ok > 0) {
        message.success(
          result.firstCode
            ? `成功生成 ${result.ok} 个溯源码：${result.firstCode}`
            : `成功生成 ${result.ok} 个溯源码`,
        )
      }
      if (result.fail > 0) {
        message.warning(`${result.fail} 个未生成（后端生成接口不可用，或该批次不存在）`)
      }
      setGenOpen(false)
      setSelectedKeys([])
      await invalidateAll()
    },
    onError: () => {
      message.error('生成溯源码失败，请确认批次是否存在')
    },
  })

  /** 批量激活 */
  const activateMutation = useMutation({
    mutationFn: (codes: string[]) =>
      runBatchAction(
        codes,
        (code) => activateTraceCode(code, currentFarm?.farmName ?? '农场主'),
        '激活',
      ),
    onSuccess: () => setSelectedKeys([]),
  })

  /** 批量作废 */
  const revokeMutation = useMutation({
    mutationFn: (codes: string[]) => runBatchAction(codes, revokeTraceCode, '作废'),
    onSuccess: () => setSelectedKeys([]),
  })

  /** 单个扫码（模拟消费者扫码） */
  const scanMutation = useMutation({
    mutationFn: (code: string) => scanTraceCode(code),
    onSuccess: () => {
      message.success('扫码记录已累计')
      void invalidateAll()
    },
  })

  /** 打开生成弹窗 */
  const openGenerate = (mode: 'single' | 'batch'): void => {
    setGenMode(mode)
    setGenOpen(true)
  }

  /** 提交生成 */
  const submitGenerate = (): void => {
    void genForm.validateFields().then((values) => {
      generateMutation.mutate({
        batchId: String(values.batchId).trim(),
        count: Number(values.count ?? 1),
        expireDate: values.expireDate ? values.expireDate.format('YYYY-MM-DD') : undefined,
      })
    })
  }

  /** 查询 */
  const handleSearch = (): void => {
    setFilters(filterForm.getFieldsValue())
    setPageNum(1)
    setSelectedKeys([])
  }

  /** 重置 */
  const handleReset = (): void => {
    filterForm.resetFields()
    setFilters({})
    setPageNum(1)
    setSelectedKeys([])
  }

  /** 导出当前筛选结果为 CSV */
  const handleExport = (): void => {
    if (filteredList.length === 0) {
      message.warning('暂无可导出的数据')
      return
    }
    const header = [
      '溯源码',
      '关联产品',
      '农场',
      '地块',
      '批次号',
      '生成时间',
      '状态',
      '扫码次数',
      '最近扫码',
      '有效期',
    ]
    const body = filteredList.map((item) =>
      [
        item.code,
        item.productName ?? (item.batchId ? (item.batchNo ?? '-') : '待分配'),
        item.farmName ?? currentFarm?.farmName ?? '-',
        item.plotName ?? '-',
        item.batchNo ?? item.batchId ?? '-',
        toDateText(item.createdAt),
        STATUS_META[normalizeStatus(item.status)].label,
        item.scanCount ?? 0,
        item.lastScanAt ?? '-',
        item.expireDate ?? '-',
      ]
        .map(escapeCsv)
        .join(','),
    )
    const csv = `\uFEFF${[header.join(','), ...body].join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `溯源码_${dayjs().format('YYYYMMDDHHmm')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    message.success(`已导出 ${filteredList.length} 条溯源码`)
  }

  /** 表格列定义 */
  const columns: ProColumns<RawTraceCode>[] = [
    {
      title: '溯源码',
      dataIndex: 'code',
      width: 220,
      render: (_, record) => (
        <Typography.Text copyable code>
          {record.code}
        </Typography.Text>
      ),
    },
    {
      title: '关联产品',
      key: 'productName',
      width: 150,
      render: (_, record) =>
        record.productName ?? (record.batchId ? (record.batchNo ?? '-') : <Tag>待分配</Tag>),
    },
    {
      title: '农场/地块',
      key: 'farmPlot',
      width: 170,
      render: (_, record) => {
        const farm = record.farmName ?? currentFarm?.farmName ?? '-'
        return record.plotName ? `${farm}/${record.plotName}` : farm
      },
    },
    {
      title: '批次号',
      key: 'batchNo',
      width: 130,
      render: (_, record) => record.batchNo ?? (record.batchId ? String(record.batchId) : '-'),
    },
    {
      title: '生成时间',
      dataIndex: 'createdAt',
      width: 120,
      render: (_, record) => toDateText(record.createdAt),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const meta = STATUS_META[normalizeStatus(record.status)]
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '扫码次数',
      dataIndex: 'scanCount',
      width: 110,
      render: (_, record) => (
        <Tooltip title={record.lastScanAt ? `最近扫码：${record.lastScanAt}` : '暂无扫码记录'}>
          <span>{record.scanCount ?? 0}</span>
        </Tooltip>
      ),
    },
    {
      title: '有效期',
      dataIndex: 'expireDate',
      width: 120,
      render: (_, record) => toDateText(record.expireDate),
    },
    {
      title: '操作',
      key: 'option',
      width: 230,
      valueType: 'option',
      render: (_, record) => {
        const status = normalizeStatus(record.status)
        const canChain = Boolean(record.batchId)
        return [
          canChain ? (
            <Typography.Link
              key="chain"
              onClick={() =>
                navigate(
                  `/production/trace/full-chain?batchId=${encodeURIComponent(String(record.batchId))}&code=${encodeURIComponent(record.code)}`,
                )
              }
            >
              全链路→
            </Typography.Link>
          ) : (
            <Typography.Text key="chain-disabled" type="secondary">
              未关联批次
            </Typography.Text>
          ),
          status === 'generated' ? (
            <Typography.Link
              key="activate"
              onClick={() => activateMutation.mutate([record.code])}
            >
              激活
            </Typography.Link>
          ) : null,
          status === 'activated' || status === 'scanned' ? (
            <Typography.Link key="scan" onClick={() => scanMutation.mutate(record.code)}>
              模拟扫码
            </Typography.Link>
          ) : null,
          status === 'expired' ? null : (
            <Popconfirm
              key="revoke"
              title="确认作废该溯源码？"
              description="作废后消费者扫码将提示已失效，不可恢复。"
              okText="确认作废"
              cancelText="取消"
              onConfirm={() => revokeMutation.mutate([record.code])}
            >
              <Typography.Link type="danger">作废</Typography.Link>
            </Popconfirm>
          ),
        ].filter(Boolean)
      },
    },
  ]

  /** 统计卡是否加载中 */
  const statsLoading =
    totalQuery.isFetching ||
    activatedQuery.isFetching ||
    scannedQuery.isFetching ||
    generatedQuery.isFetching

  return (
    <PageContainer
      title="🏷️ 溯源码管理"
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      extra={[
        <Button
          key="single"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openGenerate('single')}
        >
          + 生成溯源码
        </Button>,
        <Button key="batch" icon={<ThunderboltOutlined />} onClick={() => openGenerate('batch')}>
          批量生成
        </Button>,
        <Button
          key="reload"
          icon={<ReloadOutlined />}
          onClick={() => {
            void invalidateAll()
          }}
        >
          刷新
        </Button>,
      ]}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic title="溯源码总量" value={totalQuery.data?.total ?? 0} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="已激活"
              value={activatedQuery.data?.total ?? 0}
              suffix="个"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="已扫码（消费者扫码次数）"
              value={scannedQuery.data?.total ?? 0}
              suffix="个"
              valueStyle={{ color: '#1677ff' }}
            />
            <Typography.Text type="secondary">
              当前页累计扫码 {totalScanCount} 次
            </Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic title="待分配" value={generatedQuery.data?.total ?? 0} suffix="个" />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" style={{ rowGap: 12 }}>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              placeholder="全部状态"
              options={STATUS_OPTIONS}
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item name="farmId" label="农场">
            <Select
              allowClear
              placeholder="全部农场"
              options={farmOptions.map((farm) => ({
                value: farm.farmId,
                label: farm.farmName,
              }))}
              style={{ width: 160 }}
            />
          </Form.Item>
          <Form.Item name="keyword" label="关键字">
            <Input allowClear placeholder="搜索溯源码 / 批次号 / 产品" style={{ width: 220 }} />
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

      <ProTable<RawTraceCode>
        rowKey="code"
        size="small"
        columns={columns}
        dataSource={filteredList}
        loading={listQuery.isFetching}
        search={false}
        options={{
          reload: () => {
            void invalidateAll()
          },
          density: true,
          setting: true,
        }}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys.map((key) => String(key))),
        }}
        pagination={{
          current: pageNum,
          pageSize,
          total: filteredList.length,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (nextPage, nextSize) => {
            setPageNum(nextPage)
            setPageSize(nextSize)
          },
        }}
        toolBarRender={() => [
          <Button
            key="batch-activate"
            type="primary"
            disabled={selectedKeys.length === 0}
            loading={activateMutation.isPending}
            onClick={() => activateMutation.mutate(selectedKeys)}
          >
            批量激活（{selectedKeys.length}）
          </Button>,
          <Button
            key="batch-revoke"
            danger
            disabled={selectedKeys.length === 0}
            loading={revokeMutation.isPending}
            onClick={() => revokeMutation.mutate(selectedKeys)}
          >
            批量作废（{selectedKeys.length}）
          </Button>,
          <Button key="export" icon={<ExportOutlined />} onClick={handleExport}>
            导出
          </Button>,
        ]}
      />

      <Modal
        title={genMode === 'batch' ? '批量生成溯源码' : '生成溯源码'}
        open={genOpen}
        okText="确认生成"
        cancelText="取消"
        confirmLoading={generateMutation.isPending}
        destroyOnClose
        onOk={submitGenerate}
        onCancel={() => setGenOpen(false)}
      >
        <Form
          form={genForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{ count: genMode === 'batch' ? 10 : 1 }}
        >
          <Form.Item
            name="batchId"
            label="关联批次"
            rules={[{ required: true, message: '请选择或输入采收批次 ID' }]}
            extra="一个批次可生成多个溯源码，每次提交发一个新码（唯一性由 uk_trace_code 保证）"
          >
            <AutoComplete
              options={batchOptions}
              placeholder="选择或输入采收批次 ID"
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item
            name="count"
            label="生成数量"
            rules={[{ required: true, message: '请输入生成数量' }]}
          >
            <InputNumber min={1} max={200} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expireDate" label="有效期">
            <DatePicker style={{ width: '100%' }} placeholder="留空则默认批次归档后 2 年" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}
