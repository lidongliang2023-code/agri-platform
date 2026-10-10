/**
 * 页面名称：存证记录
 * 路由路径：/production/blockchain/records
 * 所属模块：区块链增强
 * 原型 pageId：bc-records（P28）
 *
 * ⚠️ 真数据约束（本页此前造假量最大，已修复，请勿回退）
 *
 * 旧版三处造假已全部拆除：
 * 1. `MOCK_RECORDS` 共 2347 条（PROTOTYPE_ROWS 5 行 + buildMockRecord 确定性伪随机生成，
 *    含伪造的哈希与签名），在 `isError || remoteRows.length === 0` 时整表顶替真实数据。
 *    —— 服务端真的返回空列表就是空：`length === 0` 的兜底分支已删除，现在显示空态。
 * 2. 批量验真 catch 分支用本地 `confirmations >= 6` 判定并输出
 *    「接口不可用，按链上确认数 N 判定为通过（示例结论）」—— 写操作假成功，最恶劣的一处。
 *    —— 现在批量验真只调真接口 `GET /blockchain/verify/{txHash}`，失败就是失败，明示
 *    「未取得验真结论」，不做任何本地判定。
 * 3. 表格列渲染后端根本不返回的字段（confirmations / anchorMethod / chainId / certNo）、
 *    筛选区传后端不接收的参数（bizType / startDate / endDate，实测被静默忽略）。
 *    —— 现在只展示后端 BlockchainRecordEntity 的真实字段，筛选只保留后端支持的 status 与 keyword。
 *
 * 覆盖率低（全表仅数条存证）是真实结论，按真实渲染，不补假数据。
 */
import { useState } from 'react'
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
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { listCertRecords, verifyChain } from '@/api/blockchain'
import type { BlockchainBizRecord, CertStatusCode } from '@/types'
import { asApiRequestError, httpStatusOf, toNumber } from '@/utils/request'
import useFarmStore from '@/store/farm'

/** 等宽字体样式：哈希统一使用 */
const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
  wordBreak: 'break-all',
}

/** 业务类型编码 → 名称（后端实测取值：TRACE / INSPECTION / HARVEST） */
const BIZ_TYPE_NAME: Record<string, string> = {
  FARMING: '生产记录',
  INSPECTION: '检测报告',
  INPUT: '投入品使用',
  HARVEST: '采收入库',
  CIRCULATION: '流通记录',
  IOT: 'IoT数据',
  TRACE: '溯源记录',
}

/** 存证状态字典（后端 records 接口支持 status 过滤） */
const STATUS_OPTIONS: { value: CertStatusCode; label: string }[] = [
  { value: 'SUCCESS', label: '✅已上链' },
  { value: 'PENDING', label: '⏳上链中' },
  { value: 'FAILED', label: '❌上链失败' },
]

/** 筛选条件：只保留后端 records 接口真正支持的参数 */
interface FilterState {
  /** 存证状态 PENDING / SUCCESS / FAILED */
  status?: CertStatusCode
  /** 关键字：后端仅按 biz_no（业务单号）模糊匹配 */
  keyword?: string
}

/** 批量验真结果 */
interface BatchResult {
  /** 存证记录号 */
  recordId: string
  /** 是否通过（仅来自后端真实返回） */
  passed: boolean | null
  /** 结论说明 */
  detail: string
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
 * 把列表查询失败原因转成明示文案：区分「后端业务拒绝」「HTTP 非 200」「后端不可达」。
 *
 * @param error catch 到的未知错误
 * @returns 失败文案
 */
function describeError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const apiError = asApiRequestError(error)
  if (apiError && typeof apiError.bizCode === 'number') {
    return `后端业务码 ${apiError.bizCode}（HTTP ${apiError.httpStatus ?? 200}）：${rawMessage}`
  }
  const status = httpStatusOf(error)
  if (status > 0) {
    return `HTTP ${status}：${rawMessage}`
  }
  return `网络异常或超时：${rawMessage}`
}

/**
 * 把验真请求失败转成明示的失败文案。
 *
 * @param error catch 到的未知错误
 * @returns 失败文案（不含任何本地判定结论）
 */
function describeFailure(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const apiError = asApiRequestError(error)
  if (apiError && typeof apiError.bizCode === 'number') {
    return `验真接口返回业务失败（业务码 ${apiError.bizCode}）：${rawMessage}`
  }
  const status = httpStatusOf(error)
  if (status > 0) {
    return `验真接口返回 HTTP ${status}：${rawMessage}`
  }
  return `无法连接验真接口（网络异常或超时）：${rawMessage}`
}

/**
 * 存证记录列表（原型 P28）
 *
 * 业务职责：存证流水查询（后端支持 status 与 biz_no 关键字），
 * 支持勾选后批量验真（后端只支持按交易哈希验真）与导出。
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
      status: status === 'PENDING' || status === 'SUCCESS' || status === 'FAILED' ? status : undefined,
      keyword: undefined,
    }
  })
  /** 表单草稿，点击「搜索」后才生效 */
  const [draft, setDraft] = useState<FilterState>(filters)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [batchOpen, setBatchOpen] = useState<boolean>(false)
  const [batchLoading, setBatchLoading] = useState<boolean>(false)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])

  /** 远程数据：只用后端真实返回，不做任何示例兜底 */
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['blockchain-records', farmId, filters, pageNum, pageSize],
    queryFn: () =>
      listCertRecords({
        pageNum,
        pageSize,
        status: filters.status,
        keyword: filters.keyword,
      }),
  })

  const rows: BlockchainBizRecord[] = data?.list ?? []
  const total: number = data?.total ?? 0

  /** 执行筛选 */
  const handleSearch = (): void => {
    setPageNum(1)
    setFilters(draft)
    setSelectedKeys([])
  }

  /** 重置筛选 */
  const handleReset = (): void => {
    const empty: FilterState = { status: undefined, keyword: undefined }
    setDraft(empty)
    setFilters(empty)
    setPageNum(1)
    setSelectedKeys([])
  }

  /**
   * 批量验真：只调真接口 GET /blockchain/verify/{txHash}。
   *
   * 失败时 passed 记 null（未取得结论），detail 写失败原因，
   * **不**做 confirmations >= 阈值 之类的本地判定。
   */
  const handleBatchVerify = async (): Promise<void> => {
    const targets = rows.filter(
      (item) => selectedKeys.includes(item.recordId ?? '') && Boolean(item.txHash),
    )
    if (targets.length === 0) {
      message.warning('请勾选至少一条已上链（含交易哈希）的存证记录')
      return
    }
    setBatchOpen(true)
    setBatchLoading(true)
    const results: BatchResult[] = await Promise.all(
      targets.map(async (item): Promise<BatchResult> => {
        const txHash = item.txHash as string
        const recordId = item.recordId ?? '-'
        try {
          const raw: unknown = await verifyChain(encodeURIComponent(txHash))
          if (typeof raw === 'boolean') {
            return {
              recordId,
              passed: raw,
              detail: raw
                ? '后端验真返回 true：存在该交易哈希且状态为 SUCCESS 的存证记录'
                : '后端验真返回 false：未检索到该交易哈希对应的成功存证记录',
            }
          }
          return {
            recordId,
            passed: null,
            detail: `未取得验真结论：后端返回了非布尔值（${raw === null ? 'null' : typeof raw}）`,
          }
        } catch (err) {
          return {
            recordId,
            passed: null,
            detail: `未取得验真结论：${describeFailure(err)}`,
          }
        }
      }),
    )
    setBatchResults(results)
    setBatchLoading(false)
    const okCount = results.filter((item) => item.passed === true).length
    const failCount = results.filter((item) => item.passed === null).length
    message.info(
      `批量验真完成：通过 ${okCount} 条、未通过 ${results.length - okCount - failCount} 条、未取得结论 ${failCount} 条`,
    )
  }

  /** 导出当前页结果为 CSV（只导出后端真实字段） */
  const handleExport = (): void => {
    const header = [
      '存证记录号',
      '业务类型',
      '业务单号',
      '关联批次',
      '关联溯源码',
      '交易哈希',
      '区块高度',
      '上链时间',
      '状态',
    ]
    const body = rows.map((item) =>
      [
        item.recordId ?? '',
        BIZ_TYPE_NAME[item.bizType ?? ''] ?? item.bizType ?? '',
        item.bizNo ?? '',
        item.batchId ?? '',
        item.traceCode ?? '',
        item.txHash ?? '',
        item.blockHeight ?? '',
        item.anchorAt ?? '',
        item.status === 'SUCCESS' ? '已上链' : item.status === 'PENDING' ? '上链中' : '上链失败',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
    downloadFile(`存证记录_${dayjs().format('YYYYMMDDHHmmss')}.csv`, [header.join(','), ...body].join('\n'))
    message.success(`已导出 ${rows.length} 条存证记录`)
  }

  /** 表格列定义：全部为后端 BlockchainRecordEntity 真实字段 */
  const columns: ProColumns<BlockchainBizRecord>[] = [
    {
      title: '存证记录号',
      dataIndex: 'recordId',
      width: 190,
      render: (_, record) => (
        <Typography.Text style={MONO_STYLE} copyable={{ text: record.recordId, tooltips: ['复制编号', '已复制'] }}>
          {record.recordId ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '业务类型',
      dataIndex: 'bizType',
      width: 110,
      render: (_, record) => (
        <Tag color="geekblue">
          {BIZ_TYPE_NAME[record.bizType ?? ''] ?? record.bizType ?? '-'}
        </Tag>
      ),
    },
    { title: '业务单号', dataIndex: 'bizNo', width: 160, ellipsis: true },
    { title: '关联批次', dataIndex: 'batchId', width: 160, ellipsis: true },
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
          <Typography.Text type="secondary">—（未上链）</Typography.Text>
        ),
    },
    {
      title: '区块高度',
      dataIndex: 'blockHeight',
      width: 130,
      render: (_, record) =>
        record.blockHeight === null || record.blockHeight === undefined ? (
          <Typography.Text type="secondary">-</Typography.Text>
        ) : (
          // 后端 blockHeight 运行时是字符串，必须先 toNumber 再格式化
          <span style={MONO_STYLE}>{toNumber(record.blockHeight, 0).toLocaleString('en-US')}</span>
        ),
    },
    {
      title: '上链时间',
      dataIndex: 'anchorAt',
      width: 160,
      render: (_, record) => record.anchorAt ?? '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_, record) => {
        if (record.status === 'SUCCESS') {
          return (
            <Tag color="success" icon={<CheckCircleFilled />}>
              ✅已上链
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
          {record.txHash ? (
            <Button
              type="link"
              size="small"
              onClick={() =>
                navigate(
                  `/production/blockchain/verify?type=tx&value=${encodeURIComponent(record.txHash as string)}`,
                )
              }
            >
              验证
            </Button>
          ) : (
            // 后端验真只接受 txHash：无哈希时不给入口，避免点进去必然失败
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              未上链，不可验真
            </Typography.Text>
          )}
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
            批量验真
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
            type="error"
            showIcon
            message="存证记录接口调用失败，未取得任何记录"
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text>
                  {error ? describeError(error) : '请检查后端服务 /api/v1/production/blockchain/records'}
                </Typography.Text>
                <Typography.Text type="secondary">
                  此处不会用占位数据顶替 —— 列表为空即代表未取得，不代表后端没有存证。
                </Typography.Text>
              </Space>
            }
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={() => void refetch()}>
                重试
              </Button>
            }
          />
        )}

        {!isError && !isLoading && total === 0 && (
          <Alert
            type="info"
            showIcon
            message="后端当前没有存证记录"
            description="接口调用成功但返回 0 条。这是真实结论，不是接口故障 —— 可先在「区块链存证总览」页用「手动上链」创建一条存证。"
          />
        )}

        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="全部状态"
              value={draft.status}
              options={STATUS_OPTIONS}
              onChange={(value) => setDraft((prev) => ({ ...prev, status: value }))}
            />
          </Col>
          <Col xs={24} sm={12} md={10}>
            <Input
              allowClear
              placeholder="业务单号模糊匹配（后端 keyword 只匹配 biz_no）"
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
                共 {total.toLocaleString('en-US')} 条（后端真实返回）
              </Typography.Text>
            </Space>
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          message="筛选与字段口径说明"
          description="后端 GET /blockchain/records 只接收 status 与 keyword（仅按 biz_no 模糊匹配）。业务类型筛选、按时间范围筛选后端不支持（实测传参被静默忽略），已从筛选区移除，避免「筛了不生效」。表格同样只展示后端真实字段：确认数、上链方式、存证编号（certNo）、数字签名、链ID 后端均不返回，故不展示。"
        />

        <ProTable<BlockchainBizRecord>
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
          locale={{ emptyText: '后端当前没有存证记录（接口成功返回 0 条）' }}
        />

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          已选 {selectedKeys.length} 条 · 批量验真仅支持「已上链（含交易哈希）」的记录 ——
          后端验真端点只接受 txHash，无哈希的记录不参与。
        </Typography.Text>
      </Space>

      <Modal
        title="批量验真结果"
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
                key={item.recordId}
                type={item.passed === null ? 'warning' : item.passed ? 'success' : 'error'}
                showIcon
                message={
                  <span style={MONO_STYLE}>
                    {item.recordId}{' '}
                    {item.passed === null ? '未取得验真结论' : item.passed ? '验真通过' : '验真未通过'}
                  </span>
                }
                description={item.detail}
              />
            ))}
          {!batchLoading && batchResults.length === 0 && (
            <Typography.Text type="secondary">无验真结果</Typography.Text>
          )}
        </Space>
      </Modal>
    </Card>
  )
}
