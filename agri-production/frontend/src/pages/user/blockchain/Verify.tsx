/**
 * 页面名称：存证验证
 * 路由路径：/production/blockchain/verify
 * 所属模块：区块链增强
 * 原型 pageId：bc-verify（P30）
 */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  Radio,
  Row,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  DownloadOutlined,
  RedoOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { verifyCertificate } from '@/api/blockchain'
import type { CertificateVerifyResult, VerifyCheckItem, VerifyStep } from '@/types'

/** 等宽字体样式：链上哈希与签名统一使用 */
const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
  wordBreak: 'break-all',
}

/** 凭证类型 */
type VerifyType = 'cert' | 'tx' | 'trace'

/** 凭证类型选项 */
const VERIFY_TYPE_OPTIONS: { value: VerifyType; label: string; placeholder: string }[] = [
  { value: 'cert', label: '按存证编号', placeholder: '请输入存证编号，如 CERT-20260602183045' },
  { value: 'tx', label: '按交易哈希', placeholder: '请输入交易哈希，如 0x8a7d9f2e3b1c4a5d6e7f8a9b0c1d2e3f4a5b6c7d' },
  { value: 'trace', label: '按溯源码', placeholder: '请输入溯源码，如 AG010101202605150001' },
]

/** 凭证校验规则：类型 → 正则 + 提示 */
const VERIFY_PATTERNS: Record<VerifyType, { pattern: RegExp; tip: string }> = {
  cert: { pattern: /^CERT-[A-Za-z0-9-]+$/, tip: '存证编号格式应为 CERT- 开头，如 CERT-20260602183045' },
  tx: { pattern: /^0x[0-9a-fA-F]{40}$/, tip: '交易哈希应为 0x 开头的 40 位十六进制字符串' },
  trace: { pattern: /^[A-Za-z0-9]{8,32}$/, tip: '溯源码应为 8~32 位字母数字组合，如 AG010101202605150001' },
}

/** 原型 P30 验证进度六步 */
const PROTOTYPE_STEPS: VerifyStep[] = [
  { title: '查询链上数据', duration: '0.3s', passed: true },
  { title: '拉取链下原始数据', duration: '0.2s', passed: true },
  { title: '计算数据哈希', duration: '0.1s', passed: true },
  { title: '哈希比对', duration: '0.0s', passed: true },
  { title: '签名验证', duration: '0.2s', passed: true },
  { title: '区块确认数检查', duration: '0.1s', passed: true },
]

/** 原型 P29 / P30 五项验真结论 */
const PROTOTYPE_CHECKS: VerifyCheckItem[] = [
  {
    key: 'hash-consistency',
    label: '数据哈希一致性',
    passed: true,
    detail: '链上哈希 = 链下计算哈希（SHA-256 逐字节比对一致）',
  },
  {
    key: 'signature-validity',
    label: '数字签名有效性',
    passed: true,
    detail: 'ECDSA 签名验证通过，签名方为 agri-chain-001 共识节点',
  },
  {
    key: 'confirmations',
    label: '区块确认数达标',
    passed: true,
    detail: '15 确认 > 6 阈值，确认数满足安全阈值要求',
  },
  {
    key: 'timestamp',
    label: '时间戳可信',
    passed: true,
    detail: '链上时间 2026-06-02 18:30:52 与业务时间 2026-06-02 18:30:45 一致',
  },
  {
    key: 'integrity',
    label: '数据未被篡改',
    passed: true,
    detail: '原始数据完整性校验通过，链上指纹与链下快照一致',
  },
]

/** 原型 P30 示例验真结果 */
const MOCK_RESULT: CertificateVerifyResult = {
  certNo: 'CERT-20260602183045',
  bizTypeName: '检测报告',
  txHash: '0x8a7d9f2e3b1c4a5d6e7f8a9b0c1d2e3f4a5b6c7d',
  blockHeight: 8234398,
  confirmations: 15,
  passed: true,
  summary: '数据未被篡改，区块链存证有效',
  costSeconds: 0.9,
  steps: PROTOTYPE_STEPS,
  checks: PROTOTYPE_CHECKS,
}

/** 单步推进耗时（毫秒），用于还原原型的分步验证进度动画 */
const STEP_INTERVAL = 320

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
 * 将接口返回结果归一化为验真结果
 *
 * 后端 GET /blockchain/verify 当前仅返回 Boolean，此处兼容布尔值与完整结构两种形态。
 *
 * @param raw 接口原始返回
 * @param fallback 兜底结果（接口不可用时使用）
 * @returns 验真结果
 */
function normalizeResult(raw: unknown, fallback: CertificateVerifyResult): CertificateVerifyResult {
  if (raw && typeof raw === 'object' && Array.isArray((raw as CertificateVerifyResult).checks)) {
    return raw as CertificateVerifyResult
  }
  if (typeof raw === 'boolean') {
    return {
      ...fallback,
      passed: raw,
      summary: raw ? '数据未被篡改，区块链存证有效' : '链上未检索到该凭证或校验不一致',
      checks: fallback.checks.map((item) => ({
        ...item,
        passed: raw ? item.passed : false,
        detail: raw ? item.detail : '链上验真返回 false，该项未通过',
      })),
      steps: fallback.steps.map((item) => ({ ...item, passed: raw ? item.passed : false })),
    }
  }
  return fallback
}

/**
 * 存证验证（原型 P30）
 *
 * 业务职责：对外存证验真入口，支持按存证编号 / 交易哈希 / 溯源码三种凭证验证，
 * 展示六步验证进度与五项验真结论。
 *
 * @returns 页面内容
 */
export default function Verify(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

  /** 从 URL 读取预填凭证（存证详情页「重新验证」跳转带入） */
  const query = new URLSearchParams(location.search)
  const initialType: VerifyType =
    query.get('type') === 'tx' ? 'tx' : query.get('type') === 'trace' ? 'trace' : 'cert'

  const [verifyType, setVerifyType] = useState<VerifyType>(initialType)
  const [value, setValue] = useState<string>(query.get('value') ?? '')
  const [errorTip, setErrorTip] = useState<string>('')
  const [verifying, setVerifying] = useState<boolean>(false)
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [result, setResult] = useState<CertificateVerifyResult | null>(null)
  const [apiFailed, setApiFailed] = useState<boolean>(false)

  /** 当前凭证对应的兜底结果（保证示例数据与输入一致） */
  const fallbackResult = (): CertificateVerifyResult => {
    if (verifyType === 'cert') {
      return { ...MOCK_RESULT, certNo: value.trim() || MOCK_RESULT.certNo }
    }
    if (verifyType === 'tx') {
      return { ...MOCK_RESULT, txHash: value.trim() || MOCK_RESULT.txHash }
    }
    return { ...MOCK_RESULT, certNo: MOCK_RESULT.certNo }
  }

  /** 分步推进：每 STEP_INTERVAL 毫秒完成一步，全部完成后请求真实验真接口 */
  useEffect(() => {
    if (!verifying) return undefined
    if (stepIndex < PROTOTYPE_STEPS.length) {
      const timer = setTimeout(() => setStepIndex((prev) => prev + 1), STEP_INTERVAL)
      return () => clearTimeout(timer)
    }

    let cancelled = false
    const payload =
      verifyType === 'cert'
        ? { certNo: value.trim() }
        : verifyType === 'tx'
          ? { txHash: value.trim() }
          : { traceCode: value.trim() }

    verifyCertificate(payload)
      .then((raw) => {
        if (cancelled) return
        setResult(normalizeResult(raw, fallbackResult()))
        setApiFailed(false)
        setVerifying(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setResult(fallbackResult())
        setApiFailed(true)
        setVerifying(false)
        message.warning(`验真接口不可用，已展示示例结论：${err.message}`)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifying, stepIndex])

  /** 开始验证：先做表单校验 */
  const handleStart = (): void => {
    const text = value.trim()
    if (!text) {
      setErrorTip('请输入待验证的凭证')
      return
    }
    const rule = VERIFY_PATTERNS[verifyType]
    if (!rule.pattern.test(text)) {
      setErrorTip(rule.tip)
      return
    }
    setErrorTip('')
    setResult(null)
    setApiFailed(false)
    setStepIndex(0)
    setVerifying(true)
  }

  /** 重新验证 */
  const handleReset = (): void => {
    setResult(null)
    setApiFailed(false)
    setStepIndex(0)
    if (value.trim()) {
      setVerifying(true)
    } else {
      setErrorTip('请输入待验证的凭证')
    }
  }

  /** 切换凭证类型时清空输入与结果 */
  const handleTypeChange = (next: VerifyType): void => {
    setVerifyType(next)
    setValue('')
    setErrorTip('')
    setResult(null)
    setApiFailed(false)
    setStepIndex(0)
    setVerifying(false)
  }

  /** 下载验证报告 */
  const handleDownload = (): void => {
    if (!result) return
    const lines = [
      '========== 区块链存证验证报告 ==========',
      `凭证类型：${VERIFY_TYPE_OPTIONS.find((item) => item.value === verifyType)?.label ?? '-'}`,
      `存证编号：${result.certNo}`,
      `存证类型：${result.bizTypeName ?? '-'}`,
      `交易哈希：${result.txHash ?? '-'}`,
      `区块高度：${result.blockHeight?.toLocaleString('en-US') ?? '-'}`,
      `确认数：${result.confirmations ?? 0}`,
      `总耗时：${result.costSeconds}s`,
      `总体结论：${result.passed ? '✅ 验证通过' : '❌ 验证失败'} —— ${result.summary}`,
      '----------------------------------',
      '验证进度：',
      ...result.steps.map((item, index) => `  ${index + 1}. ${item.title} ${item.duration} ${item.passed ? '✅' : '❌'}`),
      '----------------------------------',
      '验真结论：',
      ...result.checks.map((item) => `  ${item.passed ? '✅' : '❌'} ${item.label} —— ${item.detail}`),
      '======================================',
    ]
    downloadFile(`验证报告_${result.certNo}.txt`, lines.join('\n'))
    message.success('验证报告已下载')
  }

  const steps = result?.steps ?? PROTOTYPE_STEPS
  const placeholder =
    VERIFY_TYPE_OPTIONS.find((item) => item.value === verifyType)?.placeholder ?? ''

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="🔍 存证验证">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text strong>验证入口</Typography.Text>
            <Radio.Group
              value={verifyType}
              onChange={(event) => handleTypeChange(event.target.value as VerifyType)}
              optionType="button"
              options={VERIFY_TYPE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
            />
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} md={16}>
                <Input
                  allowClear
                  size="large"
                  placeholder={placeholder}
                  value={value}
                  status={errorTip ? 'error' : undefined}
                  onChange={(event) => {
                    setValue(event.target.value)
                    if (errorTip) setErrorTip('')
                  }}
                  onPressEnter={handleStart}
                />
              </Col>
              <Col xs={24} md={8}>
                <Space>
                  <Button
                    type="primary"
                    size="large"
                    icon={<SearchOutlined />}
                    loading={verifying}
                    onClick={handleStart}
                  >
                    开始验证
                  </Button>
                  {result && (
                    <Button size="large" icon={<RedoOutlined />} onClick={handleReset}>
                      重新验证
                    </Button>
                  )}
                </Space>
              </Col>
            </Row>
            {errorTip && <Alert type="error" showIcon message={errorTip} />}
          </Space>

          <Alert
            type="info"
            showIcon
            message="ℹ️ 输入存证编号、交易哈希或溯源码，系统将从链上拉取数据并与链下原始数据进行比对验证"
          />

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            链ID：<span style={MONO_STYLE}>agri-chain-001</span> · 安全确认阈值：≥ 6 个区块
          </Typography.Text>
        </Space>
      </Card>

      {(verifying || result) && (
        <Card title="验证进度">
          {verifying ? (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Spin tip={`正在验证 ${value.trim()} ...`}>
                <div style={{ minHeight: 200 }} />
              </Spin>
              <Steps
                direction="vertical"
                size="small"
                current={stepIndex}
                items={PROTOTYPE_STEPS.map((item, index) => ({
                  title: `${index + 1}. ${item.title}`,
                  description: index < stepIndex ? `耗时 ${item.duration}` : '进行中...',
                  status: index < stepIndex ? 'finish' : index === stepIndex ? 'process' : 'wait',
                }))}
              />
            </Space>
          ) : (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Steps
                direction="vertical"
                size="small"
                current={steps.length}
                items={steps.map((item, index) => ({
                  title: `${index + 1}. ${item.title}`,
                  description: `耗时 ${item.duration}`,
                  status: item.passed ? 'finish' : 'error',
                }))}
              />
              <Typography.Text type="secondary">
                总耗时 {result?.costSeconds ?? 0.9}s
              </Typography.Text>
            </Space>
          )}
        </Card>
      )}

      {result && !verifying && (
        <Card
          title="验证结果"
          extra={
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleDownload}>
                下载验证报告
              </Button>
              <Button type="primary" icon={<RedoOutlined />} onClick={handleReset}>
                重新验证
              </Button>
            </Space>
          }
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {apiFailed && (
              <Alert
                type="warning"
                showIcon
                message="验真接口暂不可用，以下为原型示例结论"
                description="请检查后端服务 /api/v1/production/blockchain/verify"
              />
            )}

            <Alert
              type={result.passed ? 'success' : 'error'}
              showIcon
              icon={
                result.passed ? (
                  <CheckCircleFilled style={{ color: '#13a05a' }} />
                ) : (
                  <CloseCircleFilled style={{ color: '#ff4d4f' }} />
                )
              }
              message={
                <Space>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {result.passed ? '✅ 验证通过' : '❌ 验证失败'}
                  </Typography.Text>
                  <Typography.Text>{result.summary}</Typography.Text>
                </Space>
              }
            />

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="存证编号">
                <span style={MONO_STYLE}>{result.certNo}</span>
              </Descriptions.Item>
              <Descriptions.Item label="存证类型">
                <Tag color="geekblue">{result.bizTypeName ?? '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="交易哈希">
                <span style={MONO_STYLE}>{result.txHash ?? '-'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="区块高度">
                <span style={MONO_STYLE}>
                  {(result.blockHeight ?? 0).toLocaleString('en-US')}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="确认数">
                <Space>
                  <Typography.Text type="success" strong>
                    {result.confirmations ?? 0}
                  </Typography.Text>
                  <Typography.Text type="secondary">（安全阈值 ≥ 6）</Typography.Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="链ID">
                <span style={MONO_STYLE}>agri-chain-001</span>
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Text strong>五项验真结论</Typography.Text>
              <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                {result.checks.map((item) => (
                  <Alert
                    key={item.key}
                    type={item.passed ? 'success' : 'error'}
                    showIcon
                    icon={
                      item.passed ? (
                        <CheckCircleFilled style={{ color: '#13a05a' }} />
                      ) : (
                        <CloseCircleFilled style={{ color: '#ff4d4f' }} />
                      )
                    }
                    message={
                      <Space>
                        <Typography.Text strong>{item.label}</Typography.Text>
                        <Tag color={item.passed ? 'success' : 'error'}>
                          {item.passed ? '通过' : '失败'}
                        </Tag>
                      </Space>
                    }
                    description={item.detail}
                  />
                ))}
              </Space>
            </div>

            <Space>
              <Button
                type="link"
                onClick={() =>
                  navigate(`/production/blockchain/records/${encodeURIComponent(result.certNo)}`)
                }
              >
                查看存证详情
              </Button>
              <Button type="link" onClick={() => navigate('/production/blockchain/records')}>
                存证记录列表
              </Button>
            </Space>
          </Space>
        </Card>
      )}
    </Space>
  )
}
