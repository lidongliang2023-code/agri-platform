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
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  DownloadOutlined,
  ExportOutlined,
  InfoCircleOutlined,
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
import { MISSING_VALUE_TEXT, MetricNumber } from '@/components/MetricStatistic'
import { toFiniteNumber } from '@/utils/metric-format'

const { Text } = Typography

/** 溯源码状态（前端展示口径，兼容后端 active / revoked / expired） */
type CodeStatusView = 'generated' | 'active' | 'scanned' | 'revoked' | 'expired'

/** 状态 → 展示文案 */
const STATUS_TEXT: Record<CodeStatusView, string> = {
  generated: '未激活',
  active: '已激活',
  scanned: '已扫码',
  revoked: '已作废',
  // 2026-11-02 溯源码有了到期扫描；这一档不加，过期码就会从统计卡与列表文案里凭空消失
  expired: '已过期',
}

/** 状态 → Tag 颜色 */
const STATUS_COLOR: Record<CodeStatusView, string> = {
  generated: 'default',
  active: 'blue',
  scanned: 'green',
  revoked: 'red',
  expired: 'orange',
}

/**
 * 溯源码行（页面消费形态）。
 *
 * ⚠️ 字段口径以 `prod_trace_code` 真实列为准（BT-64/65 实测）：
 * `id / market_id / tenant_id / batch_id / batch_no / code / status /
 *  activated_at / activated_by / scan_count / last_scan_at / expire_date / create_at`。
 * **没有 `product_name`、没有 `farm_name`**——这两列此前是前端用
 * `PRODUCT_POOL[seq % 5]` / `FARM_POOL[seq % 5]` 编出来的，每一行看起来都有归属、实际全是假的。
 *
 * 所有可缺失字段一律 `| null`，由渲染层显示「—」，不兜 0、不兜原型数字。
 */
interface TraceCodeRow {
  /** 溯源码（业务定位字段，链路跳转用它） */
  code: string
  /** 批次 ID（后端是 Long，转 number 会丢精度，故保留原始字符串） */
  batchId: string | null
  /** 批次号 */
  batchNo: string | null
  /** 生成日期（YYYY-MM-DD） */
  createdAt: string | null
  /** 扫码次数 */
  scanCount: number | null
  /** 状态（后端枚举外的取值归为 null，但原始值仍保留在 statusText 里如实展示） */
  status: CodeStatusView | null
  /** 状态展示文案：已知枚举给中文，未知取值原样显示，缺失显示「—」 */
  statusText: string
  /**
   * 链上凭证（后端按存证表 agri_prod_chain_record 判定后给出）。
   *
   * 三个字段各自的含义不能混：{@code attested=false} 是"查过存证表，这条码没有记录"，
   * {@code onChain=false && attested=true} 才是"有记录但没出块"（PENDING/FAILED）。
   * 后端以前用溯源码表那个没人写的 blockchain_tx_hash 判 onChain，永远 false。
   */
  attested: boolean | null
  onChain: boolean | null
  chainStatus: string | null
  recordNo: string | null
}

/** 后端已知的状态枚举（TraceService 写入的是这套小写值） */
const KNOWN_STATUS: CodeStatusView[] = ['generated', 'active', 'scanned', 'revoked', 'expired']

/** 文本字段缺失提示语 */
const TEXT_MISSING_TIP = '后端未返回该字段，显示为「—」，接口补齐后自动填充'

/**
 * 文本型字段渲染：有值显示原文，缺失显示「—」+ 橙色信息图标。
 *
 * ⚠️ 不能用 `MetricNumber` 渲染文本——它内部走 `toFiniteNumber`，
 * 会把「DEMO-BATCHN-004」这类**非数字字符串判成缺失**而显示「—」，
 * 反而把真数据藏起来了（本轮验收第一轮就踩到）。
 *
 * @param value 后端原始文本值
 * @returns 文本节点或缺失标记
 */
function renderTextOrMissing(value: string | null): JSX.Element {
  if (value) {
    return <Text>{value}</Text>
  }
  return (
    <Tooltip title={TEXT_MISSING_TIP}>
      <Typography.Text type="secondary" style={{ cursor: 'help' }}>
        {MISSING_VALUE_TEXT}
        <InfoCircleOutlined style={{ fontSize: 12, color: '#faad14', marginLeft: 2 }} />
      </Typography.Text>
    </Tooltip>
  )
}

/** 筛选表单值 */
/** 运营端列表筛选条件（全部发给后端，服务端生效） */
interface FilterFormValues {
  /** 溯源码 */
  code?: string
  /** 批次号 */
  batchNo?: string
  /** 状态 */
  status?: CodeStatusView
  /** 链上状态 */
  chain?: 'onChain' | 'unconfirmed' | 'none'
  /** 有效期 */
  expiry?: 'expired' | 'valid' | 'unset'
  /** 生成日期区间 */
  dateRange?: [Dayjs, Dayjs]
}

/** 链上状态筛选项（与列表列的三种显示一致） */
const CHAIN_OPTIONS: { value: 'onChain' | 'unconfirmed' | 'none'; label: string }[] = [
  { value: 'onChain', label: '已上链' },
  { value: 'unconfirmed', label: '有存证但未成功' },
  { value: 'none', label: '无存证记录' },
]

/** 有效期筛选项 */
const EXPIRY_OPTIONS: { value: 'expired' | 'valid' | 'unset'; label: string }[] = [
  { value: 'valid', label: '有效期内' },
  { value: 'expired', label: '已过期' },
  { value: 'unset', label: '未设置有效期' },
]

/** 批量生成表单值 */
interface GenerateFormValues {
  /** 关联批次 ID（存量 prod_batch.id，number） */
  batchId: number
  /** 生成数量 */
  count: number
  /** 有效期至 */
  expireDate?: Dayjs
}

/**
 * 溯源码管理
 *
 * 业务职责：全平台溯源码查询与状态管理，支持按溯源码 / 批次号 / 状态 / 生成日期筛选，
 * 提供批量生成、批量激活、批量作废与批量导出能力，并可跳转溯源链路详情（按 code）。
 *
 * ⚠️ 「产品」筛选项与「产品 / 农场」两列已删除（BT-65）：
 * `prod_trace_code` 没有这两个字段，此前整列由 `PRODUCT_POOL[seq % 5]` 编造。
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

  /** 溯源码分页数据（筛选条件全部发给后端，见 {@code fetchAdminTraceCodes}） */
  const listQuery = useQuery({
    queryKey: ['admin', 'trace', 'codes', pageNum, pageSize, filter],
    queryFn: () =>
      fetchAdminTraceCodes({
        pageNum,
        pageSize,
        status: filter.status,
        keyword: (filter.code ?? filter.batchNo ?? '').trim() || undefined,
        chain: filter.chain,
        expiry: filter.expiry,
        from: filter.dateRange?.[0]?.format('YYYY-MM-DD'),
        to: filter.dateRange?.[1]?.format('YYYY-MM-DD'),
      }),
    retry: false,
  })

  /**
   * 后端分页结果（归一化后：list / total）。
   * `total` 为 null 表示**没拿到总数**（接口未返回 / 失败），渲染「—」；
   * 不用 0 顶替——0 是「查过了、确实 0 条」的结论。
   */
  const remoteRows = listQuery.data?.list ?? []
  const remoteTotal: number | null = listQuery.data?.total ?? null

  /** 激活溯源码 */
  const activateMutation = useMutation({
    // 不传 activatedBy：溯源码表没有这一列，后端只记日志、不落库。
    // 以前页面写死传 '运营管理员'，看起来像"操作人已留痕"，实际库里什么都没记。
    mutationFn: (code: string) => activateTraceCode(code),
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

  /** 表格数据源：只认后端真数据，空结果就是空态 */
  const { rows, total } = useMemo(() => {
    /*
     * 只用后端真数据，缺失一律 null → 渲染「—」。
     * 此前后端没有数据时（乃至任何一页为空时）会走 `buildFallbackRows()`
     * 凭空造出整页行、并把 total 写成 2,450,000（BT-64），已删除。
     */
    const mapped: TraceCodeRow[] = remoteRows.map((item) => {
      const rawStatus = typeof item.status === 'string' ? item.status : ''
      const known = KNOWN_STATUS.includes(rawStatus as CodeStatusView)
      const status: CodeStatusView | null = known ? (rawStatus as CodeStatusView) : null
      const scanCount = toFiniteNumber(item.scanCount)
      return {
        code: item.code ?? '',
        batchId: typeof item.batchId === 'string' ? item.batchId : String(item.batchId ?? ''),
        batchNo: item.batchNo ?? null,
        createdAt: item.createdAt ? String(item.createdAt).slice(0, 10) : null,
        scanCount,
        status,
        attested: typeof item.attested === 'boolean' ? item.attested : null,
        onChain: typeof item.onChain === 'boolean' ? item.onChain : null,
        chainStatus: item.chainStatus ?? null,
        recordNo: item.recordNo ?? null,
        // 枚举外的取值（如种子数据里的大写 ACTIVE / INACTIVE）原样显示，不冒充成已知状态
        statusText: status ? STATUS_TEXT[status] : rawStatus || MISSING_VALUE_TEXT,
      }
    })
    /**
     * 服务端已经按全部条件筛过了（{@code TraceCodeFilter}），这里不再本地二次过滤。
     *
     * 旧版这段是"前端侧补充关键字过滤（后端 /codes 仅支持 status 过滤）"——
     * 它只在**当前这一页 10 行**里筛，所以搜一个在第 3 页的码会筛出空列表，
     * 而分页器上的 total 还是服务端没筛的数，看起来就像"这个码不存在"。
     */
    return { rows: mapped, total: remoteTotal }
  }, [remoteRows, remoteTotal])

  /**
   * 表格列（对齐原型 P12，**删掉「产品」「农场」两列**）。
   *
   * BT-65：后端 `prod_trace_code` 没有 product_name / farm_name，
   * 这两列此前 100% 由 `PRODUCT_POOL[seq % 5]` / `FARM_POOL[seq % 5]` 编造——
   * 每一行看起来都有产品归属和农场归属，实际全是假的。后端补齐字段前不展示。
   */
  const columns: ColumnsType<TraceCodeRow> = [
    {
      title: '溯源码',
      dataIndex: 'code',
      width: 180,
      render: (value: string) =>
        value ? <Text copyable>{value}</Text> : <MetricNumber value={null} />,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 120,
      render: (value: string | null) => renderTextOrMissing(value),
    },
    {
      title: '生成日期',
      dataIndex: 'createdAt',
      width: 120,
      render: (value: string | null) => renderTextOrMissing(value),
    },
    {
      title: '扫码次数',
      dataIndex: 'scanCount',
      width: 100,
      render: (value: number | null) =>
        value === null ? <MetricNumber value={null} /> : <Text strong>{value}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: CodeStatusView | null, record) => (
        <Tag color={value ? (STATUS_COLOR[value] ?? 'default') : 'default'}>{record.statusText}</Tag>
      ),
    },
    {
      /**
       * 链上状态：三态分开说，不合并成"是/否"。
       * 已上链 = 存证 SUCCESS；存证未成功 = 有记录但 PENDING/FAILED；无存证记录 = 查过存证表没有。
       * 最后一种不是"能力未接入"——存证域是通的，只是这条码没存过。
       */
      title: '链上状态',
      key: 'chain',
      width: 130,
      render: (_value, record) => {
        if (record.onChain === true) {
          return (
            <Tooltip title={record.recordNo ? `存证 ${record.recordNo}（模拟链 SUCCESS）` : '模拟链 SUCCESS'}>
              <Tag color="green">🔗 已上链</Tag>
            </Tooltip>
          )
        }
        if (record.attested === true) {
          return (
            <Tooltip title={`存证记录 ${record.recordNo ?? '—'} 状态 ${record.chainStatus ?? '未知'}，尚未出块`}>
              <Tag color={record.chainStatus === 'FAILED' ? 'red' : 'orange'}>
                {record.chainStatus === 'FAILED' ? '存证失败' : '存证未出块'}
              </Tag>
            </Tooltip>
          )
        }
        return (
          <Tooltip title="已查询存证表 agri_prod_chain_record，这条溯源码没有链上存证记录">
            <Tag>无存证记录</Tag>
          </Tooltip>
        )
      },
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
      // 同单码激活：不传写死的操作人，表里没有这一列
      activateTraceCode(code)
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
    // 导出列与表格列一致：后端没有产品 / 农场字段，不导出
    const header = ['溯源码', '批次号', '生成日期', '扫码次数', '状态']
    const body = source.map((row) =>
      [
        row.code,
        row.batchNo ?? MISSING_VALUE_TEXT,
        row.createdAt ?? MISSING_VALUE_TEXT,
        row.scanCount === null ? MISSING_VALUE_TEXT : String(row.scanCount),
        row.statusText,
      ].join(','),
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
          type="error"
          showIcon
          message="溯源码分页接口未返回数据，列表为空"
          description={`${(listQuery.error as Error | null)?.message ?? '未知错误'}（不使用原型 P12 示例数据兜底，列表为空）`}
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
          {/*
            「产品」筛选项已删除（BT-65）：它过滤的是前端编造的 productName 列，
            后端既没有该字段也不支持按产品过滤，留着只会让人以为过滤生效了。
          */}
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
                // 溯源码有到期扫描后新增的一档；不加就筛不到过期码，列表也解释不了总数为何少一档
                { label: '已过期', value: 'expired' },
              ]}
            />
          </Form.Item>
          <Form.Item name="chain" label="链上状态">
            <Select placeholder="全部" allowClear style={{ width: 170 }} options={CHAIN_OPTIONS} />
          </Form.Item>
          <Form.Item name="expiry" label="有效期">
            <Select placeholder="全部" allowClear style={{ width: 150 }} options={EXPIRY_OPTIONS} />
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
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    listQuery.isError
                      ? '溯源码分页接口未返回数据'
                      : '后端暂无溯源码（不使用原型示例数据兜底）'
                  }
                />
              ),
            }}
            pagination={{
              current: pageNum,
              pageSize,
              // total 为 null（没拿到总数）时给 0，并用 showTotal 如实显示「—」而不是编一个数
              total: total ?? 0,
              showSizeChanger: true,
              showTotal: () =>
                total === null ? '总数未知（后端未返回 total）' : `共 ${total.toLocaleString('zh-CN')} 条`,
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
