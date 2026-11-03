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
 * - 筛选：状态（已生成 / 已激活 / 已扫码 / 已作废 / 已过期）+ 全部农场 + 搜索溯源码 + 链上状态 + 有效期 + 生成日期 + 查询 / 重置
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

/**
 * 状态展示元数据 —— 键是**后端原始状态**（generated / active / scanned / revoked / expired），一档一个说法。
 *
 * <p>旧版这张表挂在前端四档枚举上，把后端的 {@code revoked} 和 {@code expired} 都塞进 {@code 'expired'}
 * 再统一显示"已作废"。2026-11-02 到期扫描上线后库里真的同时存在这两种码：
 * 一个是到了有效期自动失效，一个是被人工作废，原因与处置都不同，列表不能说成同一句话。</p>
 */
const STATUS_META: Record<string, { label: string; color: string }> = {
  generated: { label: '已生成', color: 'default' },
  active: { label: '已激活', color: 'green' },
  scanned: { label: '已扫码', color: 'blue' },
  revoked: { label: '已作废', color: 'red' },
  expired: { label: '已过期', color: 'volcano' },
}

/** 状态列与导出的文案：认识的值给中文档，词表外的取值原样显示，不冒充成已知状态 */
function statusView(status?: string): { label: string; color: string } {
  const key = (status ?? '').trim().toLowerCase()
  return STATUS_META[key] ?? { label: status || '-', color: 'default' }
}

/** 状态下拉选项 */
/**
 * 状态筛选项。
 *
 * ⚠️ value 直接用**服务端词表**（generated/active/scanned/revoked/expired），不再自己编一套内部键。
 * 旧版有一项是 `{ value: 'expired', label: '已作废' }` 再经 toServerStatus 映射成 revoked ——
 * 内部键名与词表含义相反，2026-11-02 溯源码真的有了 expired 状态后，这一项就会变成歧义源
 * （"已过期"和"已作废"抢同一个键）。翻译函数一并删掉，留着只会让人以为还需要翻译。
 */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'generated', label: '已生成' },
  { value: 'active', label: '已激活' },
  { value: 'scanned', label: '已扫码' },
  { value: 'revoked', label: '已作废' },
  { value: 'expired', label: '已过期' },
]

/** 链上状态筛选项（与列表「链上状态」列的三种显示一一对应） */
const CHAIN_OPTIONS: { value: 'onChain' | 'unconfirmed' | 'none'; label: string }[] = [
  { value: 'onChain', label: '已上链' },
  { value: 'unconfirmed', label: '有存证但未成功' },
  { value: 'none', label: '无存证记录' },
]

/** 有效期筛选项（unset = 没设有效期，这类码不参与到期扫描，不能算成已过期） */
const EXPIRY_OPTIONS: { value: 'expired' | 'valid' | 'unset'; label: string }[] = [
  { value: 'valid', label: '有效期内' },
  { value: 'expired', label: '已过期' },
  { value: 'unset', label: '未设置有效期' },
]

/**
 * 导出相关：分页取全的页大小与单次上限。
 *
 * 上限不是性能考虑，是**诚实**考虑：不设上限就可能把几十万行拉进浏览器，
 * 而设了上限就必须告诉用户"还有多少没导出去"（见 handleExport 的提示）。
 */
const EXPORT_PAGE_SIZE = 200
const EXPORT_MAX_ROWS = 5000

/** 生成弹窗表单值 */
interface GenerateFormValues {
  /** 关联批次 ID */
  batchId: string
  /** 生成数量 */
  count: number
  /** 有效期 */
  expireDate?: Dayjs
}

/** 列表筛选条件（全部在服务端生效） */
interface CodeFilters {
  /** 状态（服务端词表原值） */
  status?: string
  /** 农场 ID */
  farmId?: string
  /** 关键字（溯源码 / 批次号 / 产品） */
  keyword?: string
  /** 链上状态 */
  chain?: 'onChain' | 'unconfirmed' | 'none'
  /** 有效期 */
  expiry?: 'expired' | 'valid' | 'unset'
  /** 生成日期区间（服务端按 create_time 比，两端都含当天） */
  dateRange?: [Dayjs, Dayjs]
}

/**
 * 归一化后端状态，**只用于操作按钮的开关**（能不能激活/扫码/作废）。
 *
 * <p>展示文案不走这里，走 {@link statusView}：这一档把 revoked 与 expired 合并成 'expired'，
 * 用来判断"这条码已经终态、不用再给作废按钮"是对的；拿它当文案就会把两种失效说成一种。</p>
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
  const [exporting, setExporting] = useState<boolean>(false)
  const [genOpen, setGenOpen] = useState<boolean>(false)
  const [genMode, setGenMode] = useState<'single' | 'batch'>('single')
  const [genForm] = Form.useForm<GenerateFormValues>()

  /**
   * 列表：筛选与分页都在服务端。
   *
   * <p>两步修过的痕迹都在这段注释里，因为它们属于同一类问题：</p>
   * <ul>
   *   <li>2026-11-02 上午：只发 status，关键字与农场在拿回的那 500 条里本地过滤 ——
   *       超过 500 条后，不在这一批里的码搜出来是空的，看起来像"这个码不存在"；</li>
   *   <li>本轮：一次取 500 条再由表格本地翻页 —— 表格里"第 2 页"其实是这 500 条的第 11~20 行，
   *       码数超过 500 的主体永远翻不到后面的数据。现在 {@code pageNum/pageSize} 直接进请求。</li>
   * </ul>
   */
  /** 当前筛选条件对应的请求参数（列表与导出共用一份，避免两处各拼一遍走偏） */
  const filterParams = (): Parameters<typeof fetchTraceCodePage>[0] => ({
    status: filters.status,
    keyword: filters.keyword?.trim() || undefined,
    farmId: filters.farmId ? String(filters.farmId) : undefined,
    chain: filters.chain,
    expiry: filters.expiry,
    from: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
    to: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
  })

  const listQuery = useQuery({
    queryKey: ['trace-codes', farmId, filters, pageNum, pageSize],
    enabled: Boolean(farmId),
    queryFn: () => fetchTraceCodePage({ ...filterParams(), pageNum, pageSize }),
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

  /** 当前页数据（服务端已按筛选与分页取好，这里不再本地过滤或本地翻页） */
  const pageRows = useMemo<RawTraceCode[]>(() => listQuery.data?.list ?? [], [listQuery.data])

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

  /**
   * 导出当前筛选结果为 CSV。
   *
   * <p>分页搬到服务端后，列表里只有当前这一页；要是继续拿列表数据导出，
   * "导出"就会悄悄变成"导出这一页"。所以这里按同样的筛选条件翻页取全，
   * 到 {@code EXPORT_MAX_ROWS} 上限就停，并在提示里说清楚还剩多少条没导出去 ——
   * 不假装导全了。</p>
   */
  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const first = await fetchTraceCodePage({ ...filterParams(), pageNum: 1, pageSize: EXPORT_PAGE_SIZE })
      const total = first.total ?? 0
      if (total === 0) {
        message.warning('当前筛选条件下没有可导出的数据')
        return
      }
      const rows = [...(first.list ?? [])]
      const pages = Math.ceil(Math.min(total, EXPORT_MAX_ROWS) / EXPORT_PAGE_SIZE)
      for (let next = 2; next <= pages; next += 1) {
        const pageData = await fetchTraceCodePage({ ...filterParams(), pageNum: next, pageSize: EXPORT_PAGE_SIZE })
        rows.push(...(pageData.list ?? []))
      }
      const truncated = total > rows.length
      const header = [
        '溯源码',
        '关联产品',
        '农场',
        '地块',
        '批次号',
        '生成时间',
        '状态',
        '扫码次数',
        '首次扫码',
        '有效期',
        '链上状态',
      ]
      const body = rows.map((item) =>
        [
          item.code,
          item.productName ?? (item.batchId ? (item.batchNo ?? '-') : '待分配'),
          item.farmName ?? '-',
          item.plotName ?? '-',
          item.batchNo ?? item.batchId ?? '-',
          toDateText(item.createdAt),
          statusView(item.status).label,
          item.scanCount ?? 0,
          item.firstQueryTime ?? '尚未被扫码',
          item.expireDate ?? '未设置有效期',
          item.onChain === true ? '已上链' : item.attested === true ? '存证未成功' : '无存证记录',
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
      message.success(
        truncated
          ? `已导出 ${rows.length} 条；筛选共 ${total} 条，超过单次上限 ${EXPORT_MAX_ROWS} 条未导完，请缩小筛选范围`
          : `已导出 ${rows.length} 条溯源码（当前筛选的全部结果）`,
      )
    } catch (error) {
      message.error(`导出失败，未生成文件：${(error as Error)?.message ?? '未知错误'}`)
    } finally {
      setExporting(false)
    }
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
        const meta = statusView(record.status)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      /**
       * 链上状态（后端按存证表判定，与全链路页、监管核验同一处规则）。
       * 三态分开：已上链 / 存证未出块或失败 / 无存证记录 —— 最后一种不是"未接入"。
       */
      title: '链上状态',
      key: 'chain',
      width: 130,
      render: (_, record) => {
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
      title: '扫码次数',
      dataIndex: 'scanCount',
      width: 110,
      render: (_, record) => (
        // 后端只有**首次**扫码时间（first_query_time），没有"最近扫码"这一列；
        // 旧代码读 record.lastScanAt（后端从来不给这个键），扫过 3 次的码也会显示"暂无扫码记录"。
        <Tooltip title={record.firstQueryTime ? `首次扫码：${record.firstQueryTime}` : '尚未被扫码'}>
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
          <Form.Item name="chain" label="链上状态">
            <Select allowClear placeholder="全部" options={CHAIN_OPTIONS} style={{ width: 170 }} />
          </Form.Item>
          <Form.Item name="expiry" label="有效期">
            <Select allowClear placeholder="全部" options={EXPIRY_OPTIONS} style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="dateRange" label="生成日期">
            <DatePicker.RangePicker placeholder={['生成起', '生成止']} style={{ width: 240 }} />
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
        dataSource={pageRows}
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
          // 总数只认服务端给的；拿不到就显示 0，不拿"本页行数"冒充总数（旧写法是本地翻页时代的残留）
          total: listQuery.data?.total ?? 0,
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
          <Button key="export" icon={<ExportOutlined />} loading={exporting} onClick={() => void handleExport()}>
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
