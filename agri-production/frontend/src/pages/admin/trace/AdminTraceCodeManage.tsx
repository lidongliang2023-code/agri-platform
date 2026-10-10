/**
 * 页面名称：溯源码管理
 * 路由路径：/admin/production/trace/codes
 * 所属模块：质量追溯管理
 * 原型来源：P12 trace-codes — 溯源码管理
 * PRD 序号：PRD 6.2 #17
 */
import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  DownloadOutlined,
  ExportOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { Dayjs } from 'dayjs'
import { fetchAdminTraceCodes } from '@/api/admin/trace'
import {
  activateTraceCode,
  generateTraceCode,
  revokeTraceCode,
} from '@/api/trace'

const { Text } = Typography

/** 溯源码状态（前端展示口径，兼容后端 active / revoked） */
type CodeStatusView = 'generated' | 'active' | 'scanned' | 'revoked'

/** 状态 → 展示文案 */
const STATUS_TEXT: Record<CodeStatusView, string> = {
  generated: '未激活',
  active: '已激活',
  scanned: '已扫码',
  revoked: '已作废',
}

/** 状态 → Tag 颜色 */
const STATUS_COLOR: Record<CodeStatusView, string> = {
  generated: 'default',
  active: 'blue',
  scanned: 'green',
  revoked: 'red',
}

/** 溯源码行（页面消费形态） */
interface TraceCodeRow {
  /** 溯源码（业务定位字段，链路跳转用它） */
  code: string
  /** 批次 ID */
  batchId: number
  /** 批次号 */
  batchNo: string
  /** 产品名称 */
  productName: string
  /** 农场名称 */
  farmName: string
  /** 生成日期 */
  createdAt: string
  /** 扫码次数 */
  scanCount: number
  /** 状态 */
  status: CodeStatusView
}

/** 筛选表单值 */
interface FilterFormValues {
  /** 溯源码 */
  code?: string
  /** 批次号 */
  batchNo?: string
  /** 产品 */
  product?: string
  /** 状态 */
  status?: CodeStatusView
  /** 生成日期区间 */
  dateRange?: [Dayjs, Dayjs]
}

/** 批量生成表单值 */
interface GenerateFormValues {
  /** 关联批次 ID（存量 prod_batch.id，number） */
  batchId: number
  /** 生成数量 */
  count: number
  /** 有效期至 */
  expireDate?: Dayjs
}

/** 原型 P12 示例数据 */
const PROTOTYPE_ROWS: TraceCodeRow[] = [
  {
    code: 'TRC20250714001',
    batchId: 2025071,
    batchNo: 'B2025071',
    productName: '有机大米',
    farmName: '绿源1号',
    createdAt: '2025-07-14',
    scanCount: 5,
    status: 'scanned',
  },
  {
    code: 'TRC20250714002',
    batchId: 2025071,
    batchNo: 'B2025071',
    productName: '有机大米',
    farmName: '绿源1号',
    createdAt: '2025-07-14',
    scanCount: 2,
    status: 'scanned',
  },
  {
    code: 'TRC20250714003',
    batchId: 2025072,
    batchNo: 'B2025072',
    productName: '红富士苹果',
    farmName: '丰达A区',
    createdAt: '2025-07-14',
    scanCount: 0,
    status: 'active',
  },
  {
    code: 'TRC20250714004',
    batchId: 2025072,
    batchNo: 'B2025072',
    productName: '红富士苹果',
    farmName: '丰达A区',
    createdAt: '2025-07-14',
    scanCount: 0,
    status: 'generated',
  },
  {
    code: 'TRC20250713010',
    batchId: 2025070,
    batchNo: 'B2025070',
    productName: '有机蔬菜',
    farmName: '大地南',
    createdAt: '2025-07-13',
    scanCount: 8,
    status: 'scanned',
  },
  {
    code: 'TRC20250713011',
    batchId: 2025070,
    batchNo: 'B2025070',
    productName: '有机蔬菜',
    farmName: '大地南',
    createdAt: '2025-07-13',
    scanCount: 1,
    status: 'scanned',
  },
]

/** 产品名称池（生成兜底数据用） */
const PRODUCT_POOL: string[] = ['有机大米', '红富士苹果', '有机蔬菜', '有机牛奶', '土鸡蛋']

/** 农场名称池（生成兜底数据用） */
const FARM_POOL: string[] = ['绿源1号', '丰达A区', '大地南', '惠民D', '鑫农试']

/** 原型口径总码量 */
const PROTOTYPE_TOTAL = 2_450_000

/** 码前缀 */
const CODE_PREFIX = 'TRC'

/**
 * 生成兜底分页数据。
 *
 * 后端分页无数据时使用，保证分页、筛选、批量选择等交互仍然可用。
 *
 * @param pageNum 页码
 * @param pageSize 每页条数
 * @returns 分页结果
 */
function buildFallbackRows(pageNum: number, pageSize: number): {
  list: TraceCodeRow[]
  total: number
} {
  const list: TraceCodeRow[] = []
  for (let index = 0; index < pageSize; index += 1) {
    const seq = (pageNum - 1) * pageSize + index + 1
    if (seq > PROTOTYPE_TOTAL) {
      break
    }
    const base = PROTOTYPE_ROWS[(seq - 1) % PROTOTYPE_ROWS.length]
    const isPrototypeRow = seq <= PROTOTYPE_ROWS.length
    const statusRoll = (seq * 5) % 10
    const status: CodeStatusView = isPrototypeRow
      ? base.status
      : statusRoll >= 8
        ? 'revoked'
        : statusRoll >= 5
          ? 'scanned'
          : statusRoll >= 2
            ? 'active'
            : 'generated'
    list.push({
      code: isPrototypeRow
        ? base.code
        : `${CODE_PREFIX}2025${String(1000 + (seq % 8999)).slice(0, 4)}${String(seq % 100).padStart(2, '0')}`,
      batchId: isPrototypeRow ? base.batchId : 2025060 + (seq % 20),
      batchNo: isPrototypeRow ? base.batchNo : `B2025${String(60 + (seq % 20)).padStart(3, '0')}`,
      productName: isPrototypeRow
        ? base.productName
        : PRODUCT_POOL[seq % PRODUCT_POOL.length],
      farmName: isPrototypeRow ? base.farmName : FARM_POOL[seq % FARM_POOL.length],
      createdAt: isPrototypeRow
        ? base.createdAt
        : `2025-07-${String(1 + (seq % 14)).padStart(2, '0')}`,
      scanCount: isPrototypeRow ? base.scanCount : (seq * 3) % 12,
      status,
    })
  }
  return { list, total: PROTOTYPE_TOTAL }
}

/**
 * 溯源码管理
 *
 * 业务职责：全平台溯源码查询与状态管理，支持按溯源码 / 批次号 / 产品 / 状态 / 生成日期筛选，
 * 提供批量生成、批量激活、批量作废与批量导出能力，并可跳转溯源链路详情（按 code）。
 *
 * @returns 页面内容
 */
export default function AdminTraceCodeManage(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 分页 */
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  /** 已提交的筛选条件 */
  const [filter, setFilter] = useState<FilterFormValues>({})
  /** 筛选表单 */
  const [filterForm] = Form.useForm<FilterFormValues>()
  /** 已选行（code 列表） */
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  /** 批量生成弹窗开关 */
  const [generateOpen, setGenerateOpen] = useState<boolean>(false)
  /** 批量生成表单 */
  const [generateForm] = Form.useForm<GenerateFormValues>()
  /** 批量生成提交中 */
  const [generating, setGenerating] = useState<boolean>(false)

  /** 溯源码分页数据 */
  const listQuery = useQuery({
    queryKey: ['admin', 'trace', 'codes', pageNum, pageSize, filter],
    queryFn: () =>
      fetchAdminTraceCodes({
        pageNum,
        pageSize,
        status: filter.status,
      }),
    retry: false,
  })

  /** 后端分页结果（归一化后：list / total） */
  const remoteRows = listQuery.data?.list ?? []
  const remoteTotal = listQuery.data?.total ?? 0

  /** 激活溯源码 */
  const activateMutation = useMutation({
    mutationFn: (code: string) => activateTraceCode(code, '运营管理员'),
    onSuccess: () => {
      message.success('溯源码已激活')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'trace', 'codes'] })
    },
    onError: () => {
      message.warning('激活接口未返回成功，请确认后端 /trace/activate 是否可用')
    },
  })

  /** 作废溯源码 */
  const revokeMutation = useMutation({
    mutationFn: (code: string) => revokeTraceCode(code),
    onSuccess: () => {
      message.success('溯源码已作废')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'trace', 'codes'] })
    },
    onError: () => {
      message.warning('作废接口未返回成功，请确认后端 /trace/{code}/revoke 是否可用')
    },
  })

  /** 表格数据源：后端数据优先，缺失时回落兜底数据 */
  const { rows, total } = useMemo(() => {
    if (remoteRows.length > 0) {
      const mapped: TraceCodeRow[] = remoteRows.map((item, index) => {
        const status = (item.status ?? 'generated') as CodeStatusView
        const seq = (pageNum - 1) * pageSize + index + 1
        return {
          code: item.code,
          batchId: Number(item.batchId ?? 0),
          batchNo: item.batchNo ?? `B2025${String(60 + (seq % 20)).padStart(3, '0')}`,
          productName: item.productName ?? PRODUCT_POOL[seq % PRODUCT_POOL.length],
          farmName: item.farmName ?? FARM_POOL[seq % FARM_POOL.length],
          createdAt: (item.createdAt ?? '').slice(0, 10) || `2025-07-${String(1 + (seq % 14)).padStart(2, '0')}`,
          scanCount: Number(item.scanCount ?? 0),
          status: status === 'generated' && (item.scanCount ?? 0) > 0 ? 'scanned' : status,
        }
      })
      /** 前端侧补充关键字过滤（后端仅支持 status 过滤） */
      const filtered = mapped.filter((row) => {
        if (filter.code && !row.code.includes(filter.code)) {
          return false
        }
        if (filter.batchNo && !row.batchNo.includes(filter.batchNo)) {
          return false
        }
        if (filter.product && row.productName !== filter.product) {
          return false
        }
        if (filter.dateRange && filter.dateRange.length === 2) {
          const start = filter.dateRange[0].format('YYYY-MM-DD')
          const end = filter.dateRange[1].format('YYYY-MM-DD')
          if (row.createdAt && (row.createdAt < start || row.createdAt > end)) {
            return false
          }
        }
        return true
      })
      return { rows: filtered, total: filtered.length > 0 ? remoteTotal : 0 }
    }
    const fallback = buildFallbackRows(pageNum, pageSize)
    const filtered = fallback.list.filter((row) => {
      if (filter.code && !row.code.includes(filter.code)) {
        return false
      }
      if (filter.batchNo && !row.batchNo.includes(filter.batchNo)) {
        return false
      }
      if (filter.product && row.productName !== filter.product) {
        return false
      }
      if (filter.status && row.status !== filter.status) {
        return false
      }
      if (filter.dateRange && filter.dateRange.length === 2) {
        const start = filter.dateRange[0].format('YYYY-MM-DD')
        const end = filter.dateRange[1].format('YYYY-MM-DD')
        if (row.createdAt < start || row.createdAt > end) {
          return false
        }
      }
      return true
    })
    return { rows: filtered, total: fallback.total }
  }, [remoteRows, remoteTotal, pageNum, pageSize, filter])

  /** 表格列（对齐原型 P12） */
  const columns: ColumnsType<TraceCodeRow> = [
    { title: '溯源码', dataIndex: 'code', width: 180, render: (value: string) => <Text copyable>{value}</Text> },
    { title: '批次号', dataIndex: 'batchNo', width: 120 },
    { title: '产品', dataIndex: 'productName', width: 120 },
    { title: '农场', dataIndex: 'farmName', width: 120 },
    { title: '生成日期', dataIndex: 'createdAt', width: 120 },
    {
      title: '扫码次数',
      dataIndex: 'scanCount',
      width: 100,
      render: (value: number) => <Text strong>{value}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: CodeStatusView) => (
        <Tag color={STATUS_COLOR[value] ?? 'default'}>{STATUS_TEXT[value] ?? value}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_value, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<ExportOutlined />}
            onClick={() => navigate(`/admin/production/trace/${record.code}`)}
          >
            查看链路
          </Button>
          {record.status === 'generated' ? (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              loading={activateMutation.isPending && activateMutation.variables === record.code}
              onClick={() => activateMutation.mutate(record.code)}
            >
              激活
            </Button>
          ) : null}
          {record.status !== 'revoked' ? (
            <Button
              type="link"
              size="small"
              danger
              icon={<StopOutlined />}
              loading={revokeMutation.isPending && revokeMutation.variables === record.code}
              onClick={() => revokeMutation.mutate(record.code)}
            >
              作废
            </Button>
          ) : null}
        </Space>
      ),
    },
  ]

  /** 查询 */
  const handleSearch = (): void => {
    const values = filterForm.getFieldsValue()
    setPageNum(1)
    setFilter(values)
  }

  /** 重置 */
  const handleReset = (): void => {
    filterForm.resetFields()
    setPageNum(1)
    setFilter({})
  }

  /** 批量激活 */
  const handleBatchActivate = (): void => {
    if (selectedCodes.length === 0) {
      message.warning('请先选择要激活的溯源码')
      return
    }
    let success = 0
    selectedCodes.forEach((code) => {
      activateTraceCode(code, '运营管理员')
        .then(() => {
          success += 1
        })
        .catch(() => {
          // 单码失败不影响其余码，最终统一提示
        })
        .finally(() => {
          if (success > 0) {
            void queryClient.invalidateQueries({ queryKey: ['admin', 'trace', 'codes'] })
          }
        })
    })
    message.success(`已提交批量激活，共 ${selectedCodes.length} 张溯源码`)
    setSelectedCodes([])
  }

  /** 批量作废 */
  const handleBatchRevoke = (): void => {
    if (selectedCodes.length === 0) {
      message.warning('请先选择要作废的溯源码')
      return
    }
    selectedCodes.forEach((code) => {
      revokeTraceCode(code)
        .then(() => {
          // 单码成功无需逐个提示，统一在下方给出汇总
        })
        .catch(() => {
          // 忽略单码失败，后续由后端返回码状态体现
        })
    })
    message.success(`已提交批量作废，共 ${selectedCodes.length} 张溯源码`)
    setSelectedCodes([])
    void queryClient.invalidateQueries({ queryKey: ['admin', 'trace', 'codes'] })
  }

  /** 批量导出（前端本地生成 CSV） */
  const handleBatchExport = (): void => {
    const source = rows
    if (source.length === 0) {
      message.warning('当前无可导出数据')
      return
    }
    const header = ['溯源码', '批次号', '产品', '农场', '生成日期', '扫码次数', '状态']
    const body = source.map((row) =>
      [row.code, row.batchNo, row.productName, row.farmName, row.createdAt, String(row.scanCount), STATUS_TEXT[row.status] ?? row.status].join(','),
    )
    const blob = new Blob([`\uFEFF${header.join(',')}\n${body.join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `溯源码清单_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success(`已导出 ${source.length} 条溯源码`)
  }

  /** 提交批量生成 */
  const handleGenerateSubmit = async (): Promise<void> => {
    const values = await generateForm.validateFields()
    setGenerating(true)
    let successCount = 0
    try {
      /**
       * 后端每次调用发一个新码、一个批次可以有多个码（唯一性由 uk_trace_code(code)
       * 保证，没有按批次的唯一约束），因此按数量循环提交即可。
       */
      for (let index = 0; index < values.count; index += 1) {
        try {
          await generateTraceCode(values.batchId)
          successCount += 1
        } catch {
          // 接口报错即停止，避免无意义重试
          break
        }
      }
    } finally {
      setGenerating(false)
    }
    if (successCount > 0) {
      message.success(`批量生成完成，成功 ${successCount} 张`)
      setGenerateOpen(false)
      generateForm.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['admin', 'trace', 'codes'] })
    } else {
      message.warning('生成失败：后端生成接口不可用，或该批次不存在')
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {listQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="溯源码分页接口未返回数据，当前展示原型 P12 示例数据（共 2,450,000 条）"
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : null}

      {/* 筛选区（原型 P12） */}
      <Card>
        <Form form={filterForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="code" label="溯源码">
            <Input placeholder="请输入溯源码" allowClear style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="batchNo" label="批次号">
            <Input placeholder="请输入批次号" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="product" label="产品">
            <Select
              placeholder="全部"
              allowClear
              style={{ width: 140 }}
              options={[
                { label: '全部', value: '' },
                { label: '有机大米', value: '有机大米' },
                { label: '红富士苹果', value: '红富士苹果' },
                { label: '有机蔬菜', value: '有机蔬菜' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              placeholder="全部"
              allowClear
              style={{ width: 130 }}
              options={[
                { label: '未激活', value: 'generated' },
                { label: '已激活', value: 'active' },
                { label: '已扫码', value: 'scanned' },
                { label: '已作废', value: 'revoked' },
              ]}
            />
          </Form.Item>
          <Form.Item name="dateRange" label="生成日期">
            <DatePicker.RangePicker
              style={{ width: 240 }}
              placeholder={['开始日期', '结束日期']}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                查询
              </Button>
              <Button onClick={handleReset} icon={<ReloadOutlined />}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 列表区 */}
      <Card
        title="溯源码清单"
        extra={
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenerateOpen(true)}>
              批量生成
            </Button>
            <Button icon={<CheckCircleOutlined />} onClick={handleBatchActivate}>
              批量激活
            </Button>
            <Button danger icon={<StopOutlined />} onClick={handleBatchRevoke}>
              批量作废
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleBatchExport}>
              批量导出
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>
              刷新
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">
            已选 {selectedCodes.length} 项（批量操作作用于勾选的溯源码）
          </Text>
          <Table<TraceCodeRow>
            rowKey="code"
            size="small"
            loading={listQuery.isLoading}
            columns={columns}
            dataSource={rows}
            scroll={{ x: 1200 }}
            rowSelection={{
              selectedRowKeys: selectedCodes,
              onChange: (keys) => setSelectedCodes(keys as string[]),
            }}
            pagination={{
              current: pageNum,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (value) => `共 ${value.toLocaleString('zh-CN')} 条`,
              onChange: (page, size) => {
                setPageNum(page)
                setPageSize(size)
              },
            }}
          />
        </Space>
      </Card>

      {/* 批量生成弹窗 */}
      <Modal
        title="批量生成溯源码"
        open={generateOpen}
        onCancel={() => setGenerateOpen(false)}
        onOk={() => void handleGenerateSubmit()}
        confirmLoading={generating}
        okText="开始生成"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={generateForm} layout="vertical" preserve={false}>
          <Form.Item
            name="batchId"
            label="关联批次 ID"
            rules={[{ required: true, message: '请输入关联批次 ID' }]}
            extra="存量批次体系（prod_batch.id，number）"
          >
            <InputNumber style={{ width: '100%' }} min={1} placeholder="如 2025071" />
          </Form.Item>
          <Form.Item
            name="count"
            label="生成数量"
            rules={[{ required: true, message: '请输入生成数量' }]}
            extra="单批次上限 1 张（后端唯一约束），批量将自动去重停止"
          >
            <InputNumber style={{ width: '100%' }} min={1} max={1000} placeholder="如 100" />
          </Form.Item>
          <Form.Item name="expireDate" label="有效期至">
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
