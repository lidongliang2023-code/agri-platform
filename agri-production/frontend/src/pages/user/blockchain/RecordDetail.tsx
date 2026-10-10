/**
 * 页面名称：存证详情
 * 路由路径：/production/blockchain/records/:recordId
 * 所属模块：区块链增强
 * 原型 pageId：bc-detail（P29）
 *
 * ⚠️ 真数据约束（本页此前多处造假，已修复，请勿回退）
 *
 * 后端 `GET /blockchain/{id}` 只返回 BlockchainRecordEntity 的真实字段：
 * recordId / bizType / bizNo / batchId / traceCode / chainType / chainNetwork /
 * txHash / blockHeight / payloadHash / anchorAt / status。
 * 后端**不返回** certNo / blockTime / chainId / confirmations / confirmThreshold /
 * dataHash / signature / anchorMethod / submittedAt / payload / bizTypeName。
 *
 * 旧版三处造假已全部拆除：
 * 1. `MOCK_DETAIL` 兜底，并把路由参数 recordId 塞进 MOCK 的 recordId / certNo / payload，
 *    使页面标题与 URL 一致、用户无从分辨 —— 现在取不到数据就明示空态 / 错误态；
 * 2. `MOCK_CHAIN_LINK` 在「关联存证链路」Timeline 里**无条件**渲染，即使详情是真数据链路也是编的
 *    —— 现在改为明示「后端暂未提供」；
 * 3. `buildChecks()` 用后端不存在的 dataHash / signature / blockTime 推导五项验真结论，
 *    `result.passed` 恒 undefined，实际走 `Boolean(res)` 分支并输出前端拼的结论
 *    —— 现在改为只调真接口 `GET /blockchain/verify/{txHash}`，按布尔结论渲染。
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Result,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  CopyOutlined,
  DownloadOutlined,
  LinkOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { getCertRecord, verifyChain } from '@/api/blockchain'
import type { BlockchainBizRecord } from '@/types'
import { asApiRequestError, httpStatusOf, toNumber } from '@/utils/request'

/** 等宽字体样式：链上哈希统一使用 */
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

/** 验真端点（展示在结果里，便于核对） */
const VERIFY_ENDPOINT = 'GET /api/v1/production/blockchain/verify/{txHash}'

/** 验真结论：只承载后端真实返回的字段 */
interface VerifyOutcome {
  /** 被验证的交易哈希 */
  txHash: string
  /** 后端真实返回的布尔值 */
  passed: boolean
  /** 验真时间 */
  verifiedAt: string
}

/** 验真失败描述 */
interface VerifyFailure {
  /** 失败标题 */
  title: string
  /** 失败详情 */
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
 * 把验真请求失败转成明示的失败描述。
 *
 * @param error catch 到的未知错误
 * @returns 失败描述
 */
function describeFailure(error: unknown): VerifyFailure {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const apiError = asApiRequestError(error)
  if (apiError && typeof apiError.bizCode === 'number') {
    return {
      title: '验真接口返回业务失败，未取得验真结论',
      detail: `后端业务码 ${apiError.bizCode}（HTTP ${apiError.httpStatus ?? 200}）：${rawMessage}`,
    }
  }
  const status = httpStatusOf(error)
  if (status > 0) {
    return { title: `验真接口返回 HTTP ${status}，未取得验真结论`, detail: rawMessage }
  }
  return { title: '无法连接验真接口（网络异常或超时），未取得验真结论', detail: rawMessage }
}

/**
 * 判断接口返回是否为有效存证详情
 *
 * @param data 接口返回数据
 * @returns 是否有效
 */
function isValidRecord(data: BlockchainBizRecord | undefined): boolean {
  return Boolean(data && data.recordId)
}

/**
 * 存证详情（原型 P29）
 *
 * 业务职责：展示单条存证的后端真实字段，并对「验真」这一唯一后端能力提供真实入口；
 * 取不到数据时渲染明示的空态 / 错误态，不使用任何示例存证。
 *
 * @returns 页面内容
 */
export default function RecordDetail(): JSX.Element {
  const navigate = useNavigate()
  const { recordId = '' } = useParams<{ recordId: string }>()
  const [verifying, setVerifying] = useState<boolean>(false)
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null)
  const [failure, setFailure] = useState<VerifyFailure | null>(null)

  /** 存证详情：只取真实数据 */
  const { data, isLoading, isError, error, refetch } = useQuery<BlockchainBizRecord>({
    queryKey: ['blockchain-record-detail', recordId],
    queryFn: () => getCertRecord(recordId),
    enabled: Boolean(recordId),
  })

  /** 验真：只调真接口 GET /blockchain/verify/{txHash} */
  const handleVerify = async (txHash: string): Promise<void> => {
    setVerifying(true)
    setOutcome(null)
    setFailure(null)
    try {
      const raw: unknown = await verifyChain(encodeURIComponent(txHash))
      if (typeof raw === 'boolean') {
        setOutcome({
          txHash,
          passed: raw,
          verifiedAt: new Date().toLocaleString('zh-CN'),
        })
      } else {
        // 后端返回了非布尔值：无法判定，按失败处理，绝不猜测结论
        setFailure({
          title: '后端返回了非预期的验真结果，未取得验真结论',
          detail: `期望布尔值，实际为 ${raw === null ? 'null' : typeof raw}`,
        })
      }
    } catch (err) {
      setFailure(describeFailure(err))
    } finally {
      setVerifying(false)
    }
  }

  /** 下载存证证书：只写后端真实返回的字段 */
  const handleDownloadCert = (record: BlockchainBizRecord): void => {
    const lines = [
      '========== 区块链存证证书 ==========',
      `存证记录号：${record.recordId}`,
      `业务类型：${BIZ_TYPE_NAME[record.bizType ?? ''] ?? record.bizType ?? '-'}`,
      `业务单号：${record.bizNo ?? '-'}`,
      `关联批次：${record.batchId ?? '-'}`,
      `关联溯源码：${record.traceCode ?? '-'}`,
      `链类型 / 网络：${record.chainType ?? '-'} / ${record.chainNetwork ?? '-'}`,
      `存证状态：${record.status ?? '-'}`,
      `上链时间：${record.anchorAt ?? '-'}`,
      '----------------------------------',
      `交易哈希：${record.txHash ?? '-'}`,
      `区块高度：${record.blockHeight ?? '-'}`,
      `内容哈希(payloadHash)：${record.payloadHash ?? '-'}`,
      '----------------------------------',
      `验真结论：${outcome ? (outcome.passed ? '通过' : '未通过') : '尚未验真'}`,
      `验真端点：${outcome ? VERIFY_ENDPOINT : '-'}`,
      '说明：后端不返回确认数 / 数字签名 / 链ID / 出块时间等字段，本证书不包含这些项。',
      '==================================',
    ]
    downloadFile(`存证证书_${record.recordId}.txt`, lines.join('\n'))
    message.success('存证证书已下载')
  }

  /** 导出验真报告：只有真的验过才写结论 */
  const handleExportReport = (record: BlockchainBizRecord): void => {
    const lines = [
      '========== 存证验真报告 ==========',
      `存证记录号：${record.recordId}`,
      `交易哈希：${record.txHash ?? '-'}`,
      `验真端点：${VERIFY_ENDPOINT}`,
      `验真时间：${outcome?.verifiedAt ?? '-'}`,
      `后端返回值：${outcome ? String(outcome.passed) : '-'}`,
      `验真结论：${outcome ? (outcome.passed ? '通过' : '未通过') : '尚未验真（未调用验真接口）'}`,
      '==================================',
    ]
    downloadFile(`验真报告_${record.recordId}.txt`, lines.join('\n'))
    message.success('验真报告已导出')
  }

  if (isLoading) {
    return (
      <Card>
        <Spin tip="正在读取链上存证数据...">
          <div style={{ minHeight: 280 }} />
        </Spin>
      </Card>
    )
  }

  /** 接口异常：明示错误态 + 重试，不渲染任何示例存证 */
  if (isError) {
    return (
      <Card>
        <Result
          status="error"
          title="存证详情接口调用失败"
          subTitle={
            <Space direction="vertical" size={4}>
              <Typography.Text>
                {(error as Error | undefined)?.message ??
                  '请检查后端服务 /api/v1/production/blockchain/{id}'}
              </Typography.Text>
              <Typography.Text type="secondary">
                未取得该存证的任何数据，此处不会展示占位存证 —— 留空即代表「未取得」。
              </Typography.Text>
            </Space>
          }
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => void refetch()}>
                重试
              </Button>
              <Button onClick={() => navigate('/production/blockchain/records')}>
                返回列表
              </Button>
            </Space>
          }
        />
      </Card>
    )
  }

  /** 接口正常但查无此记录：明示空态，不塞示例 */
  if (!isValidRecord(data)) {
    return (
      <Card>
        <Result
          status="warning"
          title="未找到该存证记录"
          subTitle={`后端 GET /api/v1/production/blockchain/{id} 未返回 recordId 为「${recordId || '-'}」的记录。该存证可能已被删除，或编号有误。`}
          extra={
            <Button type="primary" onClick={() => navigate('/production/blockchain/records')}>
              返回存证记录列表
            </Button>
          }
        />
      </Card>
    )
  }

  const record: BlockchainBizRecord = data as BlockchainBizRecord
  const txHash = record.txHash ?? ''
  const blockHeight = toNumber(record.blockHeight, 0)

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <Button
              type="link"
              icon={<ArrowLeftOutlined />}
              style={{ paddingLeft: 0 }}
              onClick={() => navigate('/production/blockchain/records')}
            >
              返回列表
            </Button>
            <span>存证详情 #{record.recordId}</span>
          </Space>
        }
      >
        <Descriptions bordered size="small" column={3} title={<Space><LinkOutlined />链上元数据</Space>}>
          <Descriptions.Item label="存证记录号">
            <Typography.Text style={MONO_STYLE} copyable={{ text: record.recordId, tooltips: ['复制编号', '已复制'] }}>
              {record.recordId}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="业务类型">
            <Tag color="geekblue">
              {BIZ_TYPE_NAME[record.bizType ?? ''] ?? record.bizType ?? '-'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="业务单号">{record.bizNo ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="关联批次">{record.batchId ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="链类型 / 网络">
            {record.chainType ?? '-'} / {record.chainNetwork ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="存证状态">
            {record.status === 'SUCCESS' ? (
              <Tag color="success" icon={<CheckCircleFilled />}>
                ✅ 已上链
              </Tag>
            ) : record.status === 'PENDING' ? (
              <Tag color="processing">⏳ 上链中</Tag>
            ) : (
              <Tag color="error" icon={<CloseCircleFilled />}>
                ❌ 上链失败
              </Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<Space><LinkOutlined />链上信息</Space>}>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="交易哈希">
            {txHash ? (
              <Space size={4}>
                <Typography.Text style={MONO_STYLE}>{txHash}</Typography.Text>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => void copyText(txHash)}
                >
                  复制
                </Button>
              </Space>
            ) : (
              <Typography.Text type="secondary">—（该记录尚未上链，后端未回填哈希）</Typography.Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="区块高度">
            <span style={MONO_STYLE}>
              {record.blockHeight === null || record.blockHeight === undefined
                ? '—'
                : blockHeight.toLocaleString('en-US')}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="上链时间">{record.anchorAt ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="内容哈希（payloadHash）">
            {record.payloadHash ? (
              <Typography.Text style={MONO_STYLE} copyable={{ text: record.payloadHash, tooltips: ['复制指纹', '已复制'] }}>
                {record.payloadHash}
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary">—</Typography.Text>
            )}
          </Descriptions.Item>
        </Descriptions>
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          message="以下字段后端未提供，本页不展示"
          description="确认数、区块确认阈值、数字签名、链ID、出块时间、上链方式、存证原始数据 JSON —— 后端 BlockchainRecordEntity 均无这些字段，旧版由本地推导填充，已移除。"
        />
      </Card>

      <Card
        title="链上验真"
        extra={
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            loading={verifying}
            disabled={!txHash}
            onClick={() => void handleVerify(txHash)}
          >
            验真
          </Button>
        }
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {!txHash && (
            <Alert
              type="warning"
              showIcon
              message="该记录尚未上链（无交易哈希），无法验真"
              description={`后端验真端点 ${VERIFY_ENDPOINT} 只接受交易哈希，且该记录 status=${record.status ?? '-'} 时 txHash 为 null。请先完成上链再验真。`}
            />
          )}

          {!outcome && !failure && txHash && (
            <Typography.Text type="secondary">
              尚未验真。点击右上角「验真」将调用 {VERIFY_ENDPOINT}
              ，后端返回布尔值：是否存在该交易哈希命中且存证状态为 SUCCESS 的记录。
              本页不会在调用前给出任何推导结论。
            </Typography.Text>
          )}

          {failure && (
            <Alert
              type="error"
              showIcon
              message={failure.title}
              description={
                <Space direction="vertical" size={4}>
                  <Typography.Text>{failure.detail}</Typography.Text>
                  <Typography.Text type="secondary">
                    未取得验真结论，页面不会按链上信息本地推导结论 —— 请修复后端连通性后重试。
                  </Typography.Text>
                </Space>
              }
            />
          )}

          {outcome && (
            <>
              <Alert
                type={outcome.passed ? 'success' : 'error'}
                showIcon
                icon={
                  outcome.passed ? (
                    <CheckCircleFilled style={{ color: '#13a05a' }} />
                  ) : (
                    <CloseCircleFilled style={{ color: '#ff4d4f' }} />
                  )
                }
                message={
                  <Space>
                    <Typography.Text strong style={{ fontSize: 16 }}>
                      {outcome.passed ? '✅ 验真通过' : '❌ 验真未通过'}
                    </Typography.Text>
                    <Typography.Text>
                      {outcome.passed
                        ? '链上存在该交易哈希对应的存证记录，且存证状态为 SUCCESS'
                        : '链上未检索到该交易哈希对应的成功存证记录'}
                    </Typography.Text>
                  </Space>
                }
              />
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="交易哈希">
                  <span style={MONO_STYLE}>{outcome.txHash}</span>
                </Descriptions.Item>
                <Descriptions.Item label="后端返回值">
                  <span style={MONO_STYLE}>{String(outcome.passed)}</span>
                </Descriptions.Item>
                <Descriptions.Item label="验真时间">{outcome.verifiedAt}</Descriptions.Item>
                <Descriptions.Item label="数据来源">
                  <span style={MONO_STYLE}>{VERIFY_ENDPOINT}</span>
                </Descriptions.Item>
              </Descriptions>
            </>
          )}
        </Space>
      </Card>

      <Card title={<Space><LinkOutlined />关联存证链路</Space>}>
        <Alert
          type="info"
          showIcon
          message="后端暂未提供「按溯源码查询关联存证链路」的能力"
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text>
                本存证的关联溯源码：
                <span style={MONO_STYLE}>{record.traceCode ?? '—（该记录无溯源码）'}</span>
              </Typography.Text>
              <Typography.Text type="secondary">
                旧版此处渲染的是一组固定示例链路（种植 / 施肥 / 防治 / 检测 / 采收，全部标记通过），
                与当前存证无任何关联 —— 已移除。后端补齐链路查询端点后再接真实数据。
              </Typography.Text>
            </Space>
          }
        />
      </Card>

      <Card>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => handleDownloadCert(record)}>
            下载存证证书
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => handleExportReport(record)}>
            导出验真报告
          </Button>
          {txHash && (
            <Button
              type="link"
              onClick={() =>
                navigate(`/production/blockchain/verify?type=tx&value=${encodeURIComponent(txHash)}`)
              }
            >
              在验真页打开
            </Button>
          )}
        </Space>
      </Card>
    </Space>
  )
}
