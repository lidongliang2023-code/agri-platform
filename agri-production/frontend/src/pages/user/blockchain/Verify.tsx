/**
 * 页面名称：存证验证
 * 路由路径：/production/blockchain/verify
 * 所属模块：区块链增强
 * 原型 pageId：bc-verify（P30）
 *
 * ⚠️ 真数据约束（本页此前在此造假，已修复，请勿回退）
 *
 * 后端 `BlockchainController` 只提供了 `GET /api/v1/production/blockchain/verify/{txHash}`，
 * 其返回体是**布尔值**：是否存在 txHash 命中且 status=SUCCESS 的存证记录
 * （见 BlockchainRecordService#verify 的 selectCount 判定）。
 * 后端**不返回**存证编号 / 存证类型 / 区块高度 / 确认数 / 签名 / 分步耗时等明细，
 * 也**没有**按存证编号（certNo）或溯源码（traceCode）验真的端点。
 *
 * 据此本页遵守三条硬规则：
 * 1. 只渲染后端真实返回的结论，不补全任何后端未返回的字段（无数据即留空）；
 * 2. 接口失败 / 返回异常形状时渲染**明示错误态**，绝不用示例结论顶替；
 * 3. certNo / traceCode 模式在 UI 上被**明示禁用**并说明「后端暂未提供」，引导改用交易哈希。
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
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  DownloadOutlined,
  RedoOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { verifyCertificate, verifyChain } from '@/api/blockchain'
import { asApiRequestError, httpStatusOf } from '@/utils/request'

/** 等宽字体样式：链上哈希统一使用 */
const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
  wordBreak: 'break-all',
}

/** 凭证类型 */
type VerifyType = 'cert' | 'tx' | 'trace'

/**
 * 凭证类型选项。
 *
 * <p>三种方式**都可用**了（2026-10-15 后端补上写路径与 `certNo` 入参后）：
 * `tx` 走 `GET /blockchain/verify/{txHash}`，`cert` / `trace` 走
 * `GET /blockchain/verify?certNo=…`。此处不再有"已停用"的入口 —— 停用入口只有在
 * 后端真的没有该能力时才成立，能力补上就必须同时把入口打开，否则页面会继续
 * 告诉用户"暂未提供"，而那句话已经是假的了。</p>
 */
const VERIFY_TYPE_OPTIONS: { value: VerifyType; label: string; placeholder: string }[] = [
  { value: 'cert', label: '按业务单号', placeholder: '请输入存证对应的业务单号，如 H20260601' },
  { value: 'tx', label: '按交易哈希', placeholder: '请输入交易哈希，如 SIMU5B2D4A6F8C0E1D2B3A4C5D6E7F8091A2' },
  { value: 'trace', label: '按溯源码', placeholder: '请输入溯源码，如 AG010101202606010001' },
]

/**
 * 交易哈希格式规则。
 *
 * 说明：后端 `verify` 是按 txHash 做**精确匹配**（selectCount），对格式没有约束；
 * 库内真实哈希存在多种形态 —— 演示种子 `0x` + 32 位十六进制，以及本部署写路径生成的
 * `SIMU` + 十六进制（模拟链）。旧版写死 `/^0x[0-9a-fA-F]{40}$/`，会把这两类真实哈希
 * **全部拒掉**（假不可用），因此这里只做「非空 + URL 安全字符 + 长度」的宽松校验，
 * 其余交给后端精确匹配。
 */
const TX_PATTERN = /^[A-Za-z0-9_-]{4,128}$/
const TX_TIP = '交易哈希应为 4~128 位字母、数字、- 或 _，如 SIMU5B2D4A6F8C0E1D2B3A4C5D6E7F8091A2'
/** 业务单号 / 溯源码的宽松校验（同样交给后端精确匹配） */
const CODE_TIP = '应为 4~64 位字母、数字、- 或 _，如 H20260601 / AG010101202606010001'

/**
 * 各验真方式对应的后端调用与端点（展示在数据来源中，便于用户核对）。
 *
 * <p>{@code cert} 与 {@code trace} 在后端是**同一个入参** {@code certNo}，
 * 匹配的都是存证的业务键列（{@code agri_prod_chain_record.target_code}）——
 * 业务单号与溯源码都存这一列，所以两种入口点下去是同一个查询。
 * 这里如实把这一点写出来，避免用户以为"按溯源码"和"按业务单号"是两套不同的判定逻辑。</p>
 */
const VERIFY_METHODS: Record<VerifyType, { label: string; endpoint: string; matchHint: string }> = {
  tx: {
    label: '按交易哈希',
    endpoint: 'GET /api/v1/production/blockchain/verify/{txHash}',
    matchHint: '交易哈希（tx_hash）',
  },
  cert: {
    label: '按业务单号',
    endpoint: 'GET /api/v1/production/blockchain/verify?certNo=…',
    matchHint: '业务键（target_code，业务单号/溯源码同列）',
  },
  trace: {
    label: '按溯源码',
    endpoint: 'GET /api/v1/production/blockchain/verify?certNo=…',
    matchHint: '业务键（target_code，业务单号/溯源码同列）',
  },
}

/** 验真通过时的结论说明（对应后端返回 true 的真实语义） */
const PASS_DETAIL = '本库存在同键、状态为 SUCCESS 的存证记录'

/** 验真未通过时的结论说明（对应后端返回 false 的真实语义） */
const FAIL_DETAIL = '本库没有同键且状态为 SUCCESS 的存证记录'

/**
 * 验真的真实边界（本部署）。
 *
 * <p>必须写在页面上：本部署是**模拟链**（存证的 {@code chainType = SIMULATED}，
 * 交易哈希带 {@code SIMU} 前缀），后端验真做的是"库里有没有一条 SUCCESS 的同键记录"，
 * **不是**链上完整性校验（没有 merkle / 回执 / 节点比对）。说成"链上验真"会让人以为
 * 数据被动过就会被发现 —— 实际做不到，这句话不能省。</p>
 */
const VERIFY_SCOPE_TIP =
  '判定依据：本库是否存在同键且存证状态为 SUCCESS 的存证记录（后端 selectCount > 0）。'

const SIMULATED_CHAIN_TIP =
  '本部署未接真链：存证的 chainType 为 SIMULATED、交易哈希带 SIMU 前缀。因此本页结论表示' +
  '「平台库内存证台账已登记」，不等于链上完整性校验（不含 merkle 校验、链上回执核对）。'

/**
 * 验真结论：只承载后端真实返回的字段。
 *
 * 与旧版 `CertificateVerifyResult` 的区别：不含 certNo / bizTypeName / blockHeight /
 * confirmations / steps / checks —— 后端均不返回，填进去就是编的。
 */
interface VerifyOutcome {
  /** 被验证的凭证值（交易哈希 / 业务单号 / 溯源码） */
  subject: string
  /** 本次使用的验真方式 */
  method: VerifyType
  /** 后端 GET /blockchain/verify 真实返回的布尔值 */
  passed: boolean
  /** 验真完成时间 */
  verifiedAt: string
}

/** 验真失败描述：区分故障类型，避免笼统提示掩盖真实原因 */
interface VerifyFailure {
  /** 失败标题 */
  title: string
  /** 失败详情（含后端业务码 / HTTP 状态码 / 原始错误信息） */
  detail: string
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
 * 区分三种故障：后端明确业务拒绝（请求已到达服务端）/ HTTP 非 200 / 后端不可达，
 * 便于用户与运维判断是「接口报错」还是「服务没起」。
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
    return {
      title: `验真接口返回 HTTP ${status}，未取得验真结论`,
      detail: rawMessage,
    }
  }
  return {
    title: '无法连接验真接口（网络异常或超时），未取得验真结论',
    detail: rawMessage,
  }
}

/**
 * 存证验证（原型 P30）
 *
 * 业务职责：对外存证验真入口。后端当前仅支持按交易哈希验真，返回布尔结论；
 * 三种方式（交易哈希 / 业务单号 / 溯源码）后端均已支持，出参只有布尔值。
 * 接口失败时只渲染错误态，不渲染任何示例结论。
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
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null)
  const [failure, setFailure] = useState<VerifyFailure | null>(null)

  /** 请求真实验真接口：按当前验真方式选端点（三种方式后端都已支持） */
  useEffect(() => {
    if (!verifying) return undefined

    let cancelled = false
    const subject = value.trim()
    const method = verifyType

    // tx 走路径参数端点；业务单号 / 溯源码走后端同一个 certNo 入参
    const request: Promise<boolean> =
      method === 'tx'
        ? verifyChain(encodeURIComponent(subject))
        : verifyCertificate({ certNo: subject })

    request
      .then((raw: unknown) => {
        if (cancelled) return
        if (typeof raw === 'boolean') {
          setOutcome({
            subject,
            method,
            passed: raw,
            verifiedAt: new Date().toLocaleString('zh-CN'),
          })
          setFailure(null)
        } else {
          // 后端返回了非布尔值：无法判定，按失败处理，绝不猜测一个结论
          setOutcome(null)
          setFailure({
            title: '后端返回了非预期的验真结果，未取得验真结论',
            detail: `期望布尔值，实际为 ${raw === null ? 'null' : typeof raw}`,
          })
        }
        setVerifying(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // 关键：失败时只记录失败原因，不写入任何结论
        setOutcome(null)
        setFailure(describeFailure(error))
        setVerifying(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifying])

  /** 开始验证：先做格式校验 */
  const handleStart = (): void => {
    const text = value.trim()
    if (!text) {
      setErrorTip(`请输入待验证的${VERIFY_METHODS[verifyType].label.replace('按', '')}`)
      return
    }
    if (!TX_PATTERN.test(text)) {
      setErrorTip(verifyType === 'tx' ? TX_TIP : CODE_TIP)
      return
    }
    setErrorTip('')
    setOutcome(null)
    setFailure(null)
    setVerifying(true)
  }

  /** 重新验证 */
  const handleReset = (): void => {
    setOutcome(null)
    setFailure(null)
    if (value.trim()) {
      setVerifying(true)
    } else {
      setErrorTip(`请输入待验证的${VERIFY_METHODS[verifyType].label.replace('按', '')}`)
    }
  }

  /** 切换凭证类型时清空输入与结论 */
  const handleTypeChange = (next: VerifyType): void => {
    setVerifyType(next)
    setValue('')
    setErrorTip('')
    setOutcome(null)
    setFailure(null)
    setVerifying(false)
  }

  /** 下载验证报告：只写入后端真实返回的内容 */
  const handleDownload = (): void => {
    if (!outcome) return
    const method = VERIFY_METHODS[outcome.method]
    const lines = [
      '========== 区块链存证验证报告 ==========',
      `验真方式：${method.label}`,
      `凭证值：${outcome.subject}`,
      `验真时间：${outcome.verifiedAt}`,
      `数据来源：${method.endpoint}`,
      `后端返回：${String(outcome.passed)}`,
      `验真结论：${outcome.passed ? '通过' : '未通过'}`,
      `结论说明：${outcome.passed ? PASS_DETAIL : FAIL_DETAIL}`,
      '----------------------------------',
      '说明一：后端该端点仅返回布尔值（是否存在该凭证键且状态为 SUCCESS 的存证记录），',
      '不提供区块高度 / 确认数 / 签名等明细，故本报告不包含这些字段。',
      '说明二：本部署未接真链（chainType=SIMULATED，交易哈希带 SIMU 前缀），',
      '上述结论表示平台库内存证台账已登记，不等于链上完整性校验。',
      '======================================',
    ]
    downloadFile(`验证报告_${outcome.subject}.txt`, lines.join('\n'))
  }

  const placeholder =
    VERIFY_TYPE_OPTIONS.find((item) => item.value === verifyType)?.placeholder ?? ''

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="🔍 存证验真">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text strong>验真方式</Typography.Text>
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
                    开始验真
                  </Button>
                  {(outcome || failure) && (
                    <Button size="large" icon={<RedoOutlined />} onClick={handleReset}>
                      重新验真
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
            message="验真口径"
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text>
                  数据来源：<span style={MONO_STYLE}>{VERIFY_METHODS[verifyType].endpoint}</span>
                </Typography.Text>
                <Typography.Text>匹配字段：{VERIFY_METHODS[verifyType].matchHint}</Typography.Text>
                <Typography.Text>{VERIFY_SCOPE_TIP}</Typography.Text>
              </Space>
            }
          />

          <Alert type="warning" showIcon message="模拟链提示" description={SIMULATED_CHAIN_TIP} />

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            后端未返回区块高度、确认数、数字签名、分步耗时等明细，本页不展示这些字段；接口失败时只给出失败提示，不会编造任何结论。
          </Typography.Text>
        </Space>
      </Card>

      {verifying && (
        <Card title="验真进行中">
          <Spin tip="正在请求后端验真接口 ...">
            <div style={{ minHeight: 120 }} />
          </Spin>
        </Card>
      )}

      {!verifying && failure && (
        <Card
          title="验真失败"
          extra={
            <Button icon={<RedoOutlined />} onClick={handleReset}>
              重试
            </Button>
          }
        >
          <Alert
            type="error"
            showIcon
            message={failure.title}
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text>{failure.detail}</Typography.Text>
                <Typography.Text type="secondary">
                  未取得验真结论，页面不会编造任何结果 —— 请修复后端连通性后重试，
                  或前往存证记录列表确认该交易哈希是否存在。
                </Typography.Text>
              </Space>
            }
          />
        </Card>
      )}

      {!verifying && outcome && (
        <Card
          title="验真结果"
          extra={
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleDownload}>
                下载验证报告
              </Button>
              <Button type="primary" icon={<RedoOutlined />} onClick={handleReset}>
                重新验真
              </Button>
            </Space>
          }
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
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
                  <Typography.Text>{outcome.passed ? PASS_DETAIL : FAIL_DETAIL}</Typography.Text>
                </Space>
              }
            />

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label={VERIFY_METHODS[outcome.method].label}>
                <span style={MONO_STYLE}>{outcome.subject}</span>
              </Descriptions.Item>
              <Descriptions.Item label="验真结论">
                <Tag color={outcome.passed ? 'success' : 'error'}>
                  {outcome.passed ? '通过' : '未通过'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="后端返回值">
                <span style={MONO_STYLE}>{String(outcome.passed)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="验真时间">{outcome.verifiedAt}</Descriptions.Item>
              <Descriptions.Item label="数据来源" span={2}>
                <span style={MONO_STYLE}>{VERIFY_METHODS[outcome.method].endpoint}</span>
              </Descriptions.Item>
              <Descriptions.Item label="判定依据" span={2}>
                {VERIFY_METHODS[outcome.method].matchHint}；{VERIFY_SCOPE_TIP}
              </Descriptions.Item>
              <Descriptions.Item label="链类型" span={2}>
                <Tag color="orange">SIMULATED（模拟链，未接真链）</Tag>
              </Descriptions.Item>
            </Descriptions>

            {!outcome.passed && (
              <Alert
                type="info"
                showIcon
                message="未通过的可能原因"
                description="该凭证在库内没有对应记录；或对应存证记录的状态不是 SUCCESS（仍处于 PENDING / 失败重试中）。请到存证记录列表核对后重试。"
              />
            )}

            <Space>
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
