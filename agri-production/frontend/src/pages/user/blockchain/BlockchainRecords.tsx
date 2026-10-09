/**
 * 页面名称：存证记录
 * 路由路径：/production/blockchain/records
 * 所属模块：区块链增强
 * 原型 pageId：bc-records（P28）
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  CopyOutlined,
  ExportOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { listCertRecords, verifyCertificate } from '@/api/blockchain'
import type { BlockchainCertRecord, CertStatusCode, CertificateVerifyResult } from '@/types'
import useFarmStore from '@/store/farm'

/** 等宽字体样式：哈希与签名统一使用 */
const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
  wordBreak: 'break-all',
}

/** 存证总数（原型口径 4.3：存证 2,347 条） */
const MOCK_TOTAL_COUNT = 2347

/** 原型示例数据的基准时间（页面示例数据围绕该时间生成） */
const MOCK_BASE: Dayjs = dayjs('2026-06-02 22:00:00')

/** 业务类型字典 */
const BIZ_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'FARMING', label: '生产记录' },
  { value: 'INSPECTION', label: '检测报告' },
  { value: 'INPUT', label: '投入品使用' },
  { value: 'HARVEST', label: '采收入库' },
  { value: 'CIRCULATION', label: '流通记录' },
  { value: 'IOT', label: 'IoT数据' },
]

/** 业务类型编码 → 名称 */
const BIZ_TYPE_NAME: Record<string, string> = BIZ_TYPE_OPTIONS.reduce<
  Record<string, string>
>((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {})

/** 存证状态字典 */
const STATUS_OPTIONS: { value: CertStatusCode; label: string }[] = [
  { value: 'SUCCESS', label: '✅已确认' },
  { value: 'PENDING', label: '⏳上链中' },
  { value: 'FAILED', label: '❌上链失败' },
]

/** 时间范围字典 */
const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'MONTH', label: '本月' },
  { value: 'LAST_MONTH', label: '上月' },
  { value: 'QUARTER', label: '本季度' },
]

/** 上链方式取值（原型 4.2） */
const ANCHOR_METHODS: string[] = ['定时批量', '实时上链', '手动上链']

/**
 * 生成确定性伪随机十六进制串，用于示例数据的哈希与签名
 *
 * @param seed 种子字符串
 * @param length 目标长度
 * @returns 十六进制字符串
 */
function pseudoHex(seed: string, length: number): string {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  let out = ''
  while (out.length < length) {
    out += (hash >>> 0).toString(16).padStart(8, '0')
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177)
  }
  return out.slice(0, length)
}

/**
 * 按权重挑选业务类型，使示例数据的类型分布贴近原型 P27
 *
 * @param index 数据序号
 * @returns 业务类型编码
 */
function pickBizType(index: number): string {
  const bucket = index % 100
  if (bucket < 44) return 'FARMING'
  if (bucket < 63) return 'INSPECTION'
  if (bucket < 80) return 'INPUT'
  if (bucket < 92) return 'HARVEST'
  if (bucket < 97) return 'CIRCULATION'
  return 'IOT'
}

/**
 * 构造单条示例存证记录
 *
 * @param index 数据序号，0 起
 * @returns 存证记录
 */
function buildMockRecord(index: number): BlockchainCertRecord {
  const time = MOCK_BASE.subtract(index * 37, 'minute')
  const dateText = time.format('YYYYMMDD')
  const bizType = pickBizType(index)
  const bizTypeName = BIZ_TYPE_NAME[bizType] ?? '生产记录'
  const bizNoPrefix: Record<string, string> = {
    FARMING: 'PRD',
    INSPECTION: 'INS',
    INPUT: 'INP',
    HARVEST: 'BC',
    CIRCULATION: 'LOG',
    IOT: 'IOT',
  }
  const status: CertStatusCode =
    index % 23 === 0 ? 'FAILED' : index % 17 === 0 ? 'PENDING' : 'SUCCESS'
  const anchorMethod = ANCHOR_METHODS[index % 3]
  const traceCode = `AG010101202605${String(150001 + index).padStart(6, '0')}`
  const baseBlock = 8234401 - index

  return {
    recordId: `CERT-${dateText}${String(183000 + index)}`,
    certNo: `CERT-${dateText}${String(183000 + index)}`,
    bizType,
    bizTypeName,
    bizNo: `${bizNoPrefix[bizType] ?? 'PRD'}${dateText}${String(1001 + index).padStart(3, '0')}`,
    traceCode,
    bizSummary: `${bizTypeName}批量数据 ${index + 1}`,
    txHash: `0x${pseudoHex(`tx-${index}`, 40)}`,
    blockHeight: status === 'SUCCESS' ? baseBlock : undefined,
    blockTime: status === 'SUCCESS' ? time.add(7, 'second').format('YYYY-MM-DD HH:mm:ss') : undefined,
    chainId: 'agri-chain-001',
    confirmations:
      status === 'SUCCESS' ? 6 + (index % 20) : status === 'PENDING' ? index % 6 : 0,
    confirmThreshold: 6,
    dataHash: pseudoHex(`hash-${index}`, 64),
    signature: `MEUCIQ${pseudoHex(`sig-${index}`, 24)}...`,
    anchorMethod,
    status,
    failReason: status === 'FAILED' ? '共识节点超时，未获得足额区块确认' : undefined,
    submittedAt: time.format('YYYY-MM-DD HH:mm:ss'),
    anchorAt: status === 'SUCCESS' ? time.add(7, 'second').format('YYYY-MM-DD HH:mm:ss') : undefined,
    payload: {
      存证编号: `CERT-${dateText}${String(183000 + index)}`,
      业务类型: bizTypeName,
      业务单号: `${bizNoPrefix[bizType] ?? 'PRD'}${dateText}${String(1001 + index).padStart(3, '0')}`,
      关联溯源码: traceCode,
      数据摘要: `${bizTypeName}批量数据 ${index + 1}`,
    },
  }
}

/** 原型 P28 表格前 5 行（逐行还原） */
const PROTOTYPE_ROWS: BlockchainCertRecord[] = [
  {
    recordId: 'CERT-20260602220000',
    certNo: 'CERT-20260602220000',
    bizType: 'FARMING',
    bizTypeName: '生产记录',
    bizNo: 'PRD20260602001',
    traceCode: 'AG010101202605150001',
    bizSummary: '5月批量数据',
    txHash: '0x3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    blockHeight: 8234401,
    blockTime: '2026-06-02 22:00:07',
    chainId: 'agri-chain-001',
    confirmations: 18,
    confirmThreshold: 6,
    dataHash: pseudoHex('hash-p0', 64),
    signature: 'MEUCIQ3a2b1c4d5e6f7a8b9c0d1e2f3a4b...',
    anchorMethod: '定时批量',
    status: 'SUCCESS',
    submittedAt: '2026-06-02 22:00:00',
    anchorAt: '2026-06-02 22:00:07',
    payload: { 数据摘要: '5月批量数据', 关联溯源码: 'AG010101202605150001' },
  },
  {
    recordId: 'CERT-20260602183045',
    certNo: 'CERT-20260602183045',
    bizType: 'INSPECTION',
    bizTypeName: '检测报告',
    bizNo: 'INS20260515001',
    traceCode: 'AG010101202605150001',
    bizSummary: '农残检测',
    txHash: '0x8a7d9f2e3b1c4a5d6e7f8a9b0c1d2e3f4a5b6c7d',
    blockHeight: 8234398,
    blockTime: '2026-06-02 18:30:52',
    chainId: 'agri-chain-001',
    confirmations: 15,
    confirmThreshold: 6,
    dataHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca4967412345678',
    signature: 'MEUCIQDd8vJfK3Hh2N7Yx1bZ6Vk9N8a3mQfWjKHp+RxdYlVq...',
    anchorMethod: '实时上链',
    status: 'SUCCESS',
    submittedAt: '2026-06-02 18:30:45',
    anchorAt: '2026-06-02 18:30:52',
    payload: {
      检测编号: 'INS20260515001',
      产品名称: '有机番茄',
      批次号: 'BC20260515',
      检测项目: ['农药残留', '重金属'],
      检测结果: '合格',
      检测机构: '中检集团',
      质量等级: 'A级',
      关联溯源码: 'AG010101202605150001',
    },
  },
  {
    recordId: 'CERT-20260602150000',
    certNo: 'CERT-20260602150000',
    bizType: 'INPUT',
    bizTypeName: '投入品使用',
    bizNo: 'INP20260602003',
    traceCode: 'AG010101202605150002',
    bizSummary: '黄瓜追肥',
    txHash: '0x7f8e6d5c4b3a291807162534435261708192a3b',
    blockHeight: 8234395,
    blockTime: '2026-06-02 15:00:09',
    chainId: 'agri-chain-001',
    confirmations: 21,
    confirmThreshold: 6,
    dataHash: pseudoHex('hash-p2', 64),
    signature: 'MEUCIQ7f8e6d5c4b3a2918071625344352617...',
    anchorMethod: '实时上链',
    status: 'SUCCESS',
    submittedAt: '2026-06-02 15:00:00',
    anchorAt: '2026-06-02 15:00:09',
    payload: { 数据摘要: '黄瓜追肥', 关联溯源码: 'AG010101202605150002' },
  },
  {
    recordId: 'CERT-20260603010000',
    certNo: 'CERT-20260603010000',
    bizType: 'INPUT',
    bizTypeName: '投入品使用',
    bizNo: 'INP20260603001',
    traceCode: 'AG010101202605150003',
    bizSummary: '辣椒用药',
    txHash: undefined,
    blockHeight: undefined,
    blockTime: undefined,
    chainId: 'agri-chain-001',
    confirmations: 2,
    confirmThreshold: 6,
    dataHash: pseudoHex('hash-p3', 64),
    signature: undefined,
    anchorMethod: '实时上链',
    status: 'PENDING',
    submittedAt: '2026-06-03 01:00:00',
    anchorAt: undefined,
    payload: { 数据摘要: '辣椒用药', 关联溯源码: 'AG010101202605150003' },
  },
  {
    recordId: 'CERT-20260602090000',
    certNo: 'CERT-20260602090000',
    bizType: 'FARMING',
    bizTypeName: '生产记录',
    bizNo: 'PRD20260602005',
    traceCode: 'AG010101202605150002',
    bizSummary: '除草记录',
    txHash: undefined,
    blockHeight: undefined,
    blockTime: undefined,
    chainId: 'agri-chain-001',
    confirmations: 0,
    confirmThreshold: 6,
    dataHash: pseudoHex('hash-p4', 64),
    signature: undefined,
    anchorMethod: '手动上链',
    status: 'FAILED',
    failReason: '节点签名校验失败，业务数据已回滚',
    submittedAt: '2026-06-02 09:00:00',
    anchorAt: undefined,
    payload: { 数据摘要: '除草记录', 关联溯源码: 'AG010101202605150002' },
  },
]

/** 完整示例数据集（接口无数据时兜底，共 2,347 条） */
const MOCK_RECORDS: BlockchainCertRecord[] = Array.from(
  { length: MOCK_TOTAL_COUNT },
  (_, index) => (index < PROTOTYPE_ROWS.length ? PROTOTYPE_ROWS[index] : buildMockRecord(index)),
)

/** 筛选条件 */
interface FilterState {
  /** 业务类型 */
  bizType?: string
  /** 存证状态 */
  status?: CertStatusCode
  /** 时间范围 */
  period?: string
  /** 关键字：存证编号 / 交易哈希 / 溯源码 */
  keyword?: string
}

/**
 * 复制文本到剪贴板
 *
 * @param text 待复制文本
 */
async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败，请手动选中复制')
  }
}

/**
 * 触发浏览器下载
 *
 * @param filename 文件名
 * @param content 文件内容
 */
function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 解析时间范围
 *
 * @param period 时间范围编码
 * @param anchor 基准时间
 * @returns 起止日期
 */
function resolveRange(
  period: string | undefined,
  anchor: Dayjs,
): { startDate?: string; endDate?: string } {
  if (!period) return {}
  if (period === 'MONTH') {
    return {
      startDate: anchor.startOf('month').format('YYYY-MM-DD'),
      endDate: anchor.endOf('month').format('YYYY-MM-DD'),
    }
  }
  if (period === 'LAST_MONTH') {
    const last = anchor.subtract(1, 'month')
    return {
      startDate: last.startOf('month').format('YYYY-MM-DD'),
      endDate: last.endOf('month').format('YYYY-MM-DD'),
    }
  }
  return {
    startDate: anchor.startOf('month').subtract((anchor.month() % 3), 'month').format('YYYY-MM-DD'),
    endDate: anchor.endOf('month').format('YYYY-MM-DD'),
  }
}

/**
 * 存证记录列表（原型 P28）
 *
 * 业务职责：存证流水查询，支持类型 / 时间 / 状态 / 溯源码筛选，
 * 支持勾选后批量验证与导出。
 *
 * @returns 页面内容
 */
export default function BlockchainRecords(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const farmId = useFarmStore((state) => state.currentFarm?.farmId)

  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [filters, setFilters] = useState<FilterState>(() => {
    const status = searchParams.get('status')
    return {
      bizType: undefined,
      status: status === 'PENDING' || status === 'SUCCESS' || status === 'FAILED' ? status : undefined,
      period: undefined,
      keyword: undefined,
    }
  })
  /** 表单草稿，点击「搜索」后才生效 */
  const [draft, setDraft] = useState<FilterState>(filters)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [batchOpen, setBatchOpen] = useState<boolean>(false)
  const [batchLoading, setBatchLoading] = useState<boolean>(false)
  const [batchResults, setBatchResults] = useState<
    { certNo: string; passed: boolean; detail: string }[]
  >([])

  /** 远程数据 */
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['blockchain-records', farmId, filters, pageNum, pageSize],
    queryFn: () =>
      listCertRecords({
        pageNum,
        pageSize,
        bizType: filters.bizType,
        status: filters.status,
        keyword: filters.keyword,
        ...resolveRange(filters.period, dayjs()),
      }),
  })

  const remoteRows: BlockchainCertRecord[] = data?.list ?? []
  const usingMock: boolean = !isLoading && (isError || remoteRows.length === 0)

  /** 最终渲染数据：接口数据优先，否则使用示例数据（并按条件本地筛选分页） */
  const { rows, total } = useMemo<{ rows: BlockchainCertRecord[]; total: number }>(() => {
    if (!usingMock) {
      return { rows: remoteRows, total: data?.total ?? 0 }
    }
    const range = resolveRange(filters.period, MOCK_BASE)
    const keyword = filters.keyword?.trim().toLowerCase() ?? ''
    const filtered = MOCK_RECORDS.filter((item) => {
      if (filters.bizType && item.bizType !== filters.bizType) return false
      if (filters.status && item.status !== filters.status) return false
      if (range.startDate && range.endDate) {
        const day = (item.submittedAt ?? '').slice(0, 10)
        if (!day || day < range.startDate || day > range.endDate) return false
      }
      if (keyword) {
        const haystack = `${item.certNo} ${item.txHash ?? ''} ${item.traceCode ?? ''} ${item.bizNo ?? ''}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      return true
    })
    const start = (pageNum - 1) * pageSize
    return { rows: filtered.slice(start, start + pageSize), total: filtered.length }
  }, [usingMock, remoteRows, data?.total, filters, pageNum, pageSize, isLoading, isError])

  /** 执行筛选 */
  const handleSearch = (): void => {
    setPageNum(1)
    setFilters(draft)
    setSelectedKeys([])
  }

  /** 重置筛选 */
  const handleReset = (): void => {
    const empty: FilterState = { bizType: undefined, status: undefined, period: undefined, keyword: undefined }
    setDraft(empty)
    setFilters(empty)
    setPageNum(1)
    setSelectedKeys([])
  }

  /** 批量验证 */
  const handleBatchVerify = async (): Promise<void> => {
    const targets = rows.filter(
      (item) => selectedKeys.includes(item.recordId) && Boolean(item.txHash),
    )
    if (targets.length === 0) {
      message.warning('请勾选至少一条已上链（含交易哈希）的存证记录')
      return
    }
    setBatchOpen(true)
    setBatchLoading(true)
    const results = await Promise.all(
      targets.map(async (item) => {
        try {
          const res: unknown = await verifyCertificate({ txHash: item.txHash as string })
          const result = res as CertificateVerifyResult
          if (result && typeof result === 'object' && typeof result.passed === 'boolean') {
            return {
              certNo: item.certNo,
              passed: result.passed,
              detail: result.summary,
            }
          }
          return {
            certNo: item.certNo,
            passed: Boolean(res),
            detail: `链上验真返回：${String(res)}（确认数 ${item.confirmations ?? 0}）`,
          }
        } catch {
          const passed = (item.confirmations ?? 0) >= (item.confirmThreshold ?? 6)
          return {
            certNo: item.certNo,
            passed,
            detail: passed
              ? `接口不可用，按链上确认数 ${item.confirmations ?? 0} 判定为通过（示例结论）`
              : `接口不可用，确认数 ${item.confirmations ?? 0} 未达阈值 ${item.confirmThreshold ?? 6}`,
          }
        }
      }),
    )
    setBatchResults(results)
    setBatchLoading(false)
  }

  /** 导出当前筛选结果为 CSV */
  const handleExport = (): void => {
    const header = [
      '存证编号',
      '存证时间',
      '存证类型',
      '数据摘要',
      '关联溯源码',
      '交易哈希',
      '上链方式',
      '区块高度',
      '确认数',
      '状态',
    ]
    const body = rows.map((item) =>
      [
        item.certNo,
        item.anchorAt ?? item.submittedAt ?? '',
        item.bizTypeName ?? '',
        item.bizSummary ?? '',
        item.traceCode ?? '',
        item.txHash ?? '',
        item.anchorMethod ?? '',
        item.blockHeight ?? '',
        item.confirmations ?? '',
        item.status === 'SUCCESS' ? '已确认' : item.status === 'PENDING' ? '上链中' : '上链失败',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
    downloadFile(`存证记录_${dayjs().format('YYYYMMDDHHmmss')}.csv`, [header.join(','), ...body].join('\n'))
    message.success(`已导出 ${rows.length} 条存证记录`)
  }

  /** 表格列定义 */
  const columns: ProColumns<BlockchainCertRecord>[] = [
    {
      title: '存证编号',
      dataIndex: 'certNo',
      width: 190,
      render: (_, record) => (
        <Typography.Text style={MONO_STYLE} copyable={{ text: record.certNo, tooltips: ['复制编号', '已复制'] }}>
          {record.certNo}
        </Typography.Text>
      ),
    },
    {
      title: '存证时间',
      dataIndex: 'anchorAt',
      width: 160,
      render: (_, record) => record.anchorAt ?? record.submittedAt ?? '-',
    },
    {
      title: '存证类型',
      dataIndex: 'bizTypeName',
      width: 110,
      render: (_, record) => <Tag color="geekblue">{record.bizTypeName ?? '-'}</Tag>,
    },
    { title: '数据摘要', dataIndex: 'bizSummary', width: 160, ellipsis: true },
    {
      title: '关联溯源码',
      dataIndex: 'traceCode',
      width: 190,
      render: (_, record) => (
        <Typography.Text style={MONO_STYLE} ellipsis={{ tooltip: record.traceCode }}>
          {record.traceCode ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '交易哈希',
      dataIndex: 'txHash',
      width: 230,
      render: (_, record) =>
        record.txHash ? (
          <Space size={4}>
            <Typography.Text style={MONO_STYLE}>
              {`${record.txHash.slice(0, 10)}...${record.txHash.slice(-6)}`}
            </Typography.Text>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => void copyText(record.txHash as string)}
            />
          </Space>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    { title: '上链方式', dataIndex: 'anchorMethod', width: 100 },
    {
      title: '区块高度',
      dataIndex: 'blockHeight',
      width: 120,
      render: (_, record) =>
        record.blockHeight ? (
          <span style={MONO_STYLE}>{record.blockHeight.toLocaleString('en-US')}</span>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    {
      title: '确认数',
      dataIndex: 'confirmations',
      width: 110,
      render: (_, record) => {
        const value = record.confirmations ?? 0
        const threshold = record.confirmThreshold ?? 6
        return (
          <Typography.Text type={value >= threshold ? 'success' : 'warning'}>
            {value} / ≥{threshold}
          </Typography.Text>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_, record) => {
        if (record.status === 'SUCCESS') {
          return (
            <Tag color="success" icon={<CheckCircleFilled />}>
              ✅已确认
            </Tag>
          )
        }
        if (record.status === 'PENDING') {
          return (
            <Tag color="processing" icon={<ClockCircleOutlined />}>
              ⏳上链中
            </Tag>
          )
        }
        return (
          <Tag color="error" icon={<CloseCircleFilled />}>
            ❌上链失败
          </Tag>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/production/blockchain/records/${record.recordId}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() =>
              navigate(
                `/production/blockchain/verify?type=tx&value=${encodeURIComponent(record.txHash ?? record.certNo)}`,
              )
            }
          >
            验证
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="📋 存证记录"
      extra={
        <Space>
          <Button
            icon={<SafetyCertificateOutlined />}
            disabled={selectedKeys.length === 0}
            onClick={() => void handleBatchVerify()}
          >
            批量验证
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {isError && (
          <Alert
            type="warning"
            showIcon
            message="存证记录接口暂不可用，当前展示原型示例数据"
            description={(error as Error | undefined)?.message ?? '请检查后端服务 /api/v1/production/blockchain/records'}
          />
        )}

        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="全部类型"
              value={draft.bizType}
              options={BIZ_TYPE_OPTIONS}
              onChange={(value) => setDraft((prev) => ({ ...prev, bizType: value }))}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="时间范围"
              value={draft.period}
              options={PERIOD_OPTIONS}
              onChange={(value) => setDraft((prev) => ({ ...prev, period: value }))}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="全部状态"
              value={draft.status}
              options={STATUS_OPTIONS}
              onChange={(value) => setDraft((prev) => ({ ...prev, status: value }))}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Input
              allowClear
              placeholder="搜索存证编号 / 交易哈希 / 溯源码..."
              value={draft.keyword}
              onChange={(event) => setDraft((prev) => ({ ...prev, keyword: event.target.value }))}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col xs={24} md={24}>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                共 {total.toLocaleString('en-US')} 条
                {usingMock ? '（示例数据）' : ''}
              </Typography.Text>
            </Space>
          </Col>
        </Row>

        <ProTable<BlockchainCertRecord>
          rowKey="recordId"
          size="small"
          columns={columns}
          dataSource={rows}
          loading={isLoading}
          search={false}
          options={false}
          scroll={{ x: 1620 }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => setSelectedKeys(keys as string[]),
          }}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (value) => `共 ${value.toLocaleString('en-US')} 条`,
            onChange: (nextPage, nextSize) => {
              setPageNum(nextPage)
              setPageSize(nextSize)
            },
          }}
          locale={{ emptyText: '暂无存证记录，试试调整筛选条件' }}
        />

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          已选 {selectedKeys.length} 条 · 上链方式取值：定时批量 / 实时上链 / 手动上链 · 链ID：
          <span style={MONO_STYLE}>agri-chain-001</span>
        </Typography.Text>
      </Space>

      <Modal
        title="批量验证结果"
        open={batchOpen}
        onCancel={() => setBatchOpen(false)}
        footer={[
          <Button key="close" onClick={() => setBatchOpen(false)}>
            关闭
          </Button>,
        ]}
        destroyOnClose
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {batchLoading && <Typography.Text type="secondary">正在批量验真，请稍候...</Typography.Text>}
          {!batchLoading &&
            batchResults.map((item) => (
              <Alert
                key={item.certNo}
                type={item.passed ? 'success' : 'error'}
                showIcon
                message={
                  <span style={MONO_STYLE}>{item.certNo} {item.passed ? '验证通过' : '验证不通过'}</span>
                }
                description={item.detail}
              />
            ))}
          {!batchLoading && batchResults.length === 0 && (
            <Typography.Text type="secondary">无验证结果</Typography.Text>
          )}
        </Space>
      </Modal>
    </Card>
  )
}
