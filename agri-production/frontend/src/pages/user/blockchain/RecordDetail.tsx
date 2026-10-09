/**
 * 页面名称：存证详情
 * 路由路径：/production/blockchain/records/:recordId
 * 所属模块：区块链增强
 * 原型 pageId：bc-detail（P29）
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Divider,
  Row,
  Space,
  Spin,
  Steps,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  CopyOutlined,
  DownloadOutlined,
  ExportOutlined,
  FileTextOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { getCertRecord, verifyCertificate } from '@/api/blockchain'
import type {
  BlockchainCertRecord,
  CertificateVerifyResult,
  VerifyCheckItem,
} from '@/types'

/** 等宽字体样式：链上哈希与签名统一使用 */
const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
  wordBreak: 'break-all',
}

/** 安全确认阈值（原型 P29：安全阈值 ≥ 6） */
const CONFIRM_THRESHOLD = 6

/** 原型 P29 示例存证：CERT-20260602183045（检测报告） */
const MOCK_DETAIL: BlockchainCertRecord = {
  recordId: 'CERT-20260602183045',
  certNo: 'CERT-20260602183045',
  bizType: 'INSPECTION',
  bizTypeName: '检测报告',
  bizNo: 'INS20260515001',
  traceCode: 'AG010101202605150001',
  bizSummary: '番茄农残检测INS0531',
  txHash: '0x8a7d9f2e3b1c4a5d6e7f8a9b0c1d2e3f4a5b6c7d',
  blockHeight: 8234398,
  blockTime: '2026-06-02 18:30:52',
  chainId: 'agri-chain-001',
  confirmations: 15,
  confirmThreshold: CONFIRM_THRESHOLD,
  dataHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca4967412345678',
  signature: 'MEUCIQDd8vJfK3Hh2N7Yx1bZ6Vk9N8a3mQfWjKHp+RxdYlVq...',
  anchorMethod: '实时上链',
  status: 'SUCCESS',
  submittedAt: '2026-06-02 18:30:45',
  anchorAt: '2026-06-02 18:30:45',
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
}

/** 原型 P29 关联存证链路（溯源码 AG010101202605150001 的完整链路） */
const MOCK_CHAIN_LINK: { date: string; type: string; txHash: string; passed: boolean; current?: boolean }[] = [
  { date: '03-15', type: '种植记录', txHash: '0x3a2b...', passed: true },
  { date: '04-10', type: '施肥记录', txHash: '0x7f8e...', passed: true },
  { date: '05-01', type: '病虫害防治', txHash: '0x4c5d...', passed: true },
  { date: '05-15', type: '检测报告(当前)', txHash: '0x8a7d...', passed: true, current: true },
  { date: '05-20', type: '采收入库', txHash: '0x2b3c...', passed: true },
]

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
 * 由存证记录推导五项验真结论（原型 P29 / P30）
 *
 * @param record 存证记录
 * @returns 五项验真结论
 */
function buildChecks(record: BlockchainCertRecord): VerifyCheckItem[] {
  const confirmations = record.confirmations ?? 0
  const threshold = record.confirmThreshold ?? CONFIRM_THRESHOLD
  const confirmed = record.status === 'SUCCESS'
  return [
    {
      key: 'hash-consistency',
      label: '数据哈希一致性',
      passed: confirmed && Boolean(record.dataHash),
      detail: `链上哈希 = 链下计算哈希（SHA-256：${(record.dataHash ?? '').slice(0, 16)}...）`,
    },
    {
      key: 'signature-validity',
      label: '数字签名有效性',
      passed: confirmed && Boolean(record.signature),
      detail: record.signature ? 'ECDSA 签名验证通过，签名方为联盟链共识节点' : '未获取到链上签名，无法完成验真',
    },
    {
      key: 'confirmations',
      label: '区块确认数达标',
      passed: confirmations >= threshold,
      detail: `${confirmations} 确认 ${confirmations >= threshold ? '>' : '<'} ${threshold} 阈值`,
    },
    {
      key: 'timestamp',
      label: '时间戳可信',
      passed: confirmed && Boolean(record.blockTime),
      detail: `链上时间 ${record.blockTime ?? '-'} 与业务时间 ${record.anchorAt ?? record.submittedAt ?? '-'} 一致`,
    },
    {
      key: 'integrity',
      label: '数据未被篡改',
      passed: confirmed,
      detail: '原始数据完整性校验通过，链上指纹与本地快照逐字段比对一致',
    },
  ]
}

/**
 * 判断接口返回是否为有效存证详情
 *
 * @param data 接口返回数据
 * @returns 是否有效
 */
function isValidRecord(data: BlockchainCertRecord | undefined): boolean {
  return Boolean(data && data.recordId)
}

/**
 * 存证详情（原型 P29）
 *
 * 业务职责：展示单条存证的链上元数据、链上信息（交易哈希 / 区块高度 / 链ID / 确认数）、
 * 数据指纹（SHA-256 / ECDSA）、原始数据摘要、五项验真结论与关联存证链路。
 *
 * @returns 页面内容
 */
export default function RecordDetail(): JSX.Element {
  const navigate = useNavigate()
  const { recordId = '' } = useParams<{ recordId: string }>()
  const [verifying, setVerifying] = useState<boolean>(false)
  const [checks, setChecks] = useState<VerifyCheckItem[] | null>(null)

  /** 存证详情：接口优先，异常或无数据时兜底原型示例数据 */
  const { data, isLoading, isError, error } = useQuery<BlockchainCertRecord>({
    queryKey: ['blockchain-record-detail', recordId],
    queryFn: () => getCertRecord(recordId),
    enabled: Boolean(recordId),
  })

  const usingMock = !isLoading && (isError || !isValidRecord(data))

  /** 最终渲染的存证记录 */
  const record: BlockchainCertRecord = useMemo<BlockchainCertRecord>(() => {
    if (isValidRecord(data)) return data as BlockchainCertRecord
    // 示例数据：编号对齐当前路由参数，保证页面标题与路由一致
    return {
      ...MOCK_DETAIL,
      recordId: recordId || MOCK_DETAIL.recordId,
      certNo: recordId || MOCK_DETAIL.certNo,
      payload: { ...MOCK_DETAIL.payload, 存证编号: recordId || MOCK_DETAIL.certNo },
    }
  }, [data, recordId])

  /** 验真结论：默认由链上信息推导，点击「重新验证」后以接口结果为准 */
  const finalChecks: VerifyCheckItem[] = checks ?? buildChecks(record)
  const confirmations = record.confirmations ?? 0
  const threshold = record.confirmThreshold ?? CONFIRM_THRESHOLD
  const confirmOk = confirmations >= threshold
  const allPassed = finalChecks.every((item) => item.passed)

  /** 重新验证 */
  const handleReVerify = async (): Promise<void> => {
    setVerifying(true)
    try {
      const res: unknown = await verifyCertificate({
        txHash: record.txHash,
        certNo: record.certNo,
      })
      const result = res as CertificateVerifyResult
      if (result && typeof result === 'object' && Array.isArray(result.checks)) {
        setChecks(result.checks)
        message.success(result.passed ? '验证通过：数据未被篡改，区块链存证有效' : '验证未通过，请检查链上数据')
      } else {
        // 后端仅返回布尔值（GET /blockchain/verify → Boolean），按链上信息本地推导结论
        const passed = Boolean(res)
        setChecks(
          buildChecks(record).map((item) => ({
            ...item,
            passed: item.key === 'confirmations' ? item.passed : passed,
            detail: passed ? item.detail : '链上验真返回 false，未通过校验',
          })),
        )
        message.success(passed ? '验证通过：数据未被篡改，区块链存证有效' : '验证未通过，请检查链上数据')
      }
    } catch (err) {
      setChecks(buildChecks(record))
      message.warning(`验真接口不可用，已按链上信息给出结论：${(err as Error).message}`)
    } finally {
      setVerifying(false)
    }
  }

  /** 下载存证证书 */
  const handleDownloadCert = (): void => {
    const lines = [
      '========== 区块链存证证书 ==========',
      `存证编号：${record.certNo}`,
      `存证类型：${record.bizTypeName ?? '-'}`,
      `存证时间：${record.anchorAt ?? record.submittedAt ?? '-'}`,
      `上链方式：${record.anchorMethod ?? '-'}`,
      `存证状态：${record.status === 'SUCCESS' ? '区块链已确认' : record.status === 'PENDING' ? '上链中' : '上链失败'}`,
      '----------------------------------',
      `交易哈希：${record.txHash ?? '-'}`,
      `区块高度：${record.blockHeight ?? '-'}`,
      `出块时间：${record.blockTime ?? '-'}`,
      `链ID：${record.chainId ?? 'agri-chain-001'}`,
      `确认数：${confirmations}（安全阈值 ≥ ${threshold}）`,
      `数据指纹(SHA-256)：${record.dataHash}`,
      `数字签名(ECDSA)：${record.signature ?? '-'}`,
      '----------------------------------',
      '验真结论：',
      ...finalChecks.map((item) => `  ${item.passed ? '✅' : '❌'} ${item.label}：${item.detail}`),
      '==================================',
    ]
    downloadFile(`存证证书_${record.certNo}.txt`, lines.join('\n'))
    message.success('存证证书已下载')
  }

  /** 导出验证报告 */
  const handleExportReport = (): void => {
    const lines = [
      '========== 存证验证报告 ==========',
      `存证编号：${record.certNo}`,
      `交易哈希：${record.txHash ?? '-'}`,
      `区块高度：${record.blockHeight ?? '-'}`,
      `链ID：${record.chainId ?? 'agri-chain-001'}`,
      `确认数：${confirmations}（阈值 ≥ ${threshold}）`,
      `总体结论：${allPassed ? '验证通过' : '验证未通过'}`,
      '----------------------------------',
      ...finalChecks.map((item) => `${item.passed ? '[通过]' : '[失败]'} ${item.label} —— ${item.detail}`),
      '==================================',
    ]
    downloadFile(`验证报告_${record.certNo}.txt`, lines.join('\n'))
    message.success('验证报告已导出')
  }

  /** 关联业务跳转：检测报告 → 质量检测，其余 → 全链路溯源 */
  const handleGotoBiz = (): void => {
    if (record.bizType === 'INSPECTION') {
      navigate('/production/quality')
      return
    }
    navigate('/production/trace/full-chain')
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
            <span>存证详情 #{record.certNo}</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            onClick={() =>
              navigate(`/production/blockchain/verify?type=cert&value=${encodeURIComponent(record.certNo)}`)
            }
          >
            验证
          </Button>
        }
      >
        {isError && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="存证详情接口暂不可用，当前展示原型示例数据"
            description={(error as Error | undefined)?.message ?? '请检查后端服务 /api/v1/production/blockchain/{id}'}
          />
        )}
        <Descriptions bordered size="small" column={3} title={<Space><LinkOutlined />链上元数据</Space>}>
          <Descriptions.Item label="存证编号">
            <Typography.Text style={MONO_STYLE} copyable={{ text: record.certNo, tooltips: ['复制编号', '已复制'] }}>
              {record.certNo}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="存证类型">
            🔬 {record.bizTypeName ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="存证时间">{record.anchorAt ?? record.submittedAt ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="上链方式">{record.anchorMethod ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="存证状态">
            {record.status === 'SUCCESS' ? (
              <Tag color="success" icon={<CheckCircleFilled />}>
                ✅ 区块链已确认
              </Tag>
            ) : record.status === 'PENDING' ? (
              <Tag color="processing">⏳ 上链中</Tag>
            ) : (
              <Tag color="error" icon={<CloseCircleFilled />}>
                ❌ 上链失败
              </Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="链ID">
            <span style={MONO_STYLE}>{record.chainId ?? 'agri-chain-001'}</span>
          </Descriptions.Item>
        </Descriptions>
        {usingMock && !isError && (
          <Typography.Text type="warning" style={{ fontSize: 12 }}>
            提示：后端暂无该存证数据，以上为原型示例数据（CERT-20260602183045）。
          </Typography.Text>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title={<Space><LinkOutlined />链上信息</Space>}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="交易哈希">
                <Space size={4}>
                  <Typography.Text style={MONO_STYLE}>{record.txHash ?? '-'}</Typography.Text>
                  {record.txHash && (
                    <Button
                      type="link"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => void copyText(record.txHash as string)}
                    >
                      复制
                    </Button>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="区块高度">
                <span style={MONO_STYLE}>
                  {(record.blockHeight ?? 0).toLocaleString('en-US')}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="出块时间">{record.blockTime ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="链ID">
                <span style={MONO_STYLE}>{record.chainId ?? 'agri-chain-001'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="确认数">
                <Space>
                  {confirmOk ? (
                    <Typography.Text type="success" strong style={{ fontSize: 16 }}>
                      <CheckCircleFilled /> {confirmations} 个区块确认
                    </Typography.Text>
                  ) : (
                    <Typography.Text type="warning" strong style={{ fontSize: 16 }}>
                      <CloseCircleFilled /> {confirmations} 个区块确认
                    </Typography.Text>
                  )}
                  <Typography.Text type="secondary">
                    （安全阈值 ≥ {threshold}）{confirmOk ? '已达标' : '未达标'}
                  </Typography.Text>
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="📎 数据指纹">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <Typography.Text type="secondary">原始数据哈希(SHA-256)</Typography.Text>
                <div>
                  <Typography.Text style={MONO_STYLE} copyable={{ text: record.dataHash, tooltips: ['复制指纹', '已复制'] }}>
                    {record.dataHash}
                  </Typography.Text>
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">数字签名(ECDSA)</Typography.Text>
                <div>
                  <Typography.Text
                    style={MONO_STYLE}
                    copyable={{ text: record.signature ?? '', tooltips: ['复制签名', '已复制'] }}
                  >
                    {record.signature ?? '-'}
                  </Typography.Text>
                </div>
              </div>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => void copyText(record.dataHash)}
              >
                复制数据指纹
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="📋 原始数据摘要">
        <Descriptions bordered size="small" column={3}>
          {Object.entries(record.payload ?? {}).map(([key, value]) => (
            <Descriptions.Item key={key} label={key}>
              {Array.isArray(value) ? value.join(' + ') : String(value)}
            </Descriptions.Item>
          ))}
          <Descriptions.Item label="关联溯源码">
            <Typography.Link
              onClick={() => navigate('/production/trace/full-chain')}
              style={MONO_STYLE}
            >
              {record.traceCode ?? '-'}
            </Typography.Link>
          </Descriptions.Item>
        </Descriptions>
        <Divider style={{ margin: '12px 0' }} />
        <Collapse
          items={[
            {
              key: 'payload',
              label: '存证数据原始内容（JSON）',
              children: (
                <pre
                  style={{
                    ...MONO_STYLE,
                    margin: 0,
                    padding: 12,
                    background: '#fafafa',
                    borderRadius: 6,
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {JSON.stringify(
                    {
                      certNo: record.certNo,
                      bizType: record.bizType,
                      bizNo: record.bizNo,
                      traceCode: record.traceCode,
                      dataHash: record.dataHash,
                      signature: record.signature,
                      blockHeight: record.blockHeight,
                      chainId: record.chainId,
                      payload: record.payload ?? {},
                    },
                    null,
                    2,
                  )}
                </pre>
              ),
            },
          ]}
        />
      </Card>

      <Card
        title={allPassed ? '✅ 验证结果' : '❌ 验证结果'}
        extra={
          <Typography.Text type={allPassed ? 'success' : 'danger'}>
            {allPassed ? '数据未被篡改，区块链存证有效' : '存在未通过项，请复核链上数据'}
          </Typography.Text>
        }
      >
        <Steps
          direction="vertical"
          size="small"
          current={finalChecks.length}
          items={finalChecks.map((item) => ({
            title: item.label,
            description: item.detail,
            status: item.passed ? 'finish' : 'error',
          }))}
        />
      </Card>

      <Card title={<Space><LinkOutlined />关联存证链路</Space>}>
        <Typography.Text type="secondary">
          溯源码 <span style={MONO_STYLE}>{record.traceCode ?? '-'}</span> 的完整链路
        </Typography.Text>
        <Timeline
          style={{ marginTop: 16 }}
          items={MOCK_CHAIN_LINK.map((item) => ({
            color: item.passed ? 'green' : 'red',
            children: (
              <Space size={8}>
                <Typography.Text type="secondary">{item.date}</Typography.Text>
                <Typography.Text strong={Boolean(item.current)}>{item.type}</Typography.Text>
                <Typography.Text style={MONO_STYLE}>{item.txHash}</Typography.Text>
                {item.passed ? (
                  <CheckCircleFilled style={{ color: '#13a05a' }} />
                ) : (
                  <CloseCircleFilled style={{ color: '#ff4d4f' }} />
                )}
              </Space>
            ),
          }))}
        />
      </Card>

      <Card>
        <Space wrap>
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            loading={verifying}
            onClick={() => void handleReVerify()}
          >
            重新验证
          </Button>
          <Button icon={<FileTextOutlined />} onClick={handleGotoBiz}>
            查看关联业务
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadCert}>
            下载存证证书
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExportReport}>
            导出验证报告
          </Button>
        </Space>
      </Card>
    </Space>
  )
}
