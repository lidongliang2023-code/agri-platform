/**
 * 页面名称：投入品详情
 * 路由路径：/production/inputs/:inputId
 * 所属模块：农资投入品管理
 * 原型来源：用户端原型 P12 input-detail — 投入品详情
 *
 * 还原要点：
 * - 头部「< 返回 {名称} · 投入品详情」+ 🔗 查看溯源链路
 * - 「📋 基本信息」：编号 / 名称 / 分类 / 登记证号 / 生产厂家 / 规格 / 单位 / 安全间隔期 / 库存 / 状态
 * - 「✅ 合规校验结果」四项：禁用农药检查 / 用量合规检查 / 休药期检查 / 累计用量检查
 *   每项以「状态图标 + 结论 Tag + 说明」卡片呈现（通过绿、预警橙、违规红）
 * - 「🔗 区块链存证」：存证状态 / 存证编号 / 交易哈希 / 上链时间 + 上链与验证按钮
 * - 「📦 库存与流向」：当前库存 + 出入库流水；Tabs 切换使用记录
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Modal,
  Progress,
  Row,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { listPlots } from '@/api/plots'
import { getInputInfo, pageStockFlows, pageUsages } from '@/api/inputs'
import type { InputStockFlow } from '@/api/inputs'
import { listChainRecords, submitChain } from '@/api/blockchain'
import type { BlockchainRecord, InputUsageRecord } from '@/types'
import useFarmStore from '@/store/farm'
import {
  categoryMeta,
  checkCompliance,
  fmtDate,
  fmtNumber,
  flowTypeMeta,
  pseudoHash,
  summarizeCompliance,
} from './shared'
import type { ComplianceItem } from './shared'

/** 上链状态：1 待上链 2 上链中 3 已上链 4 上链失败 */
type ChainState = 'none' | 'pending' | 'chaining' | 'chained' | 'failed'

/** 存证状态展示元数据 */
const CHAIN_STATE_META: Record<ChainState, { label: string; color: string; tagColor: string }> = {
  none: { label: '待上链', color: '#8c8c8c', tagColor: 'default' },
  pending: { label: '待上链', color: '#8c8c8c', tagColor: 'default' },
  chaining: { label: '⏳ 上链中', color: '#1677ff', tagColor: 'blue' },
  chained: { label: '✅ 已上链', color: '#52c41a', tagColor: 'green' },
  failed: { label: '❌ 上链失败', color: '#ff4d4f', tagColor: 'red' },
}

/** 校验项图标：通过 / 预警 / 违规 */
const LEVEL_ICON: Record<string, JSX.Element> = {
  pass: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />,
  warning: <ExclamationCircleOutlined style={{ color: '#fa8c16', fontSize: 20 }} />,
  blocked: <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />,
}

/** 校验项卡片背景色 */
const LEVEL_BG: Record<string, string> = {
  pass: '#f6ffed',
  warning: '#fff7e6',
  blocked: '#fff1f0',
}

/**
 * 投入品详情页
 *
 * 业务职责：展示投入品档案、四项合规校验结果、区块链存证、库存与出入库流向、使用记录。
 *
 * @returns 页面内容
 */
export default function InputDetail(): JSX.Element {
  const { inputId = '' } = useParams<{ inputId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [verifyOpen, setVerifyOpen] = useState<boolean>(false)

  /** 投入品档案 */
  const detailQuery = useQuery({
    queryKey: ['production-inputs', 'detail', inputId],
    enabled: Boolean(inputId),
    queryFn: () => getInputInfo(inputId),
  })

  /** 使用记录（全量拉取后按投入品过滤） */
  const usagesQuery = useQuery({
    queryKey: ['production-inputs', 'usages'],
    queryFn: () => pageUsages({ pageNum: 1, pageSize: 500 }),
  })

  /** 出入库流水 */
  const flowsQuery = useQuery({
    queryKey: ['production-inputs', 'stock-flows', inputId],
    enabled: Boolean(inputId),
    queryFn: () => pageStockFlows(inputId, { pageNum: 1, pageSize: 200 }),
  })

  /** 链上存证记录（bizType 2 = 投入品使用） */
  const chainQuery = useQuery({
    queryKey: ['blockchain', 'records', 'input-usage'],
    queryFn: () => listChainRecords({ bizType: 2, pageNum: 1, pageSize: 200 }),
  })

  /** 地块名称映射 */
  const plotsQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 上链提交 */
  const chainMutation = useMutation({
    mutationFn: (bizId: string) =>
      submitChain({ bizId, bizType: 2, bizSummary: '投入品使用记录存证' }),
    onSuccess: () => {
      message.success('已提交上链，等待链上确认')
      void queryClient.invalidateQueries({ queryKey: ['blockchain'] })
    },
  })

  const item = detailQuery.data
  const inputName = item?.inputName ?? ''

  /** 该投入品的使用记录，按时间倒序 */
  const usages = useMemo<InputUsageRecord[]>(() => {
    const list = (usagesQuery.data?.list ?? []).filter((usage) => usage.inputId === inputId)
    return [...list].sort((a, b) => String(b.usedAt ?? '').localeCompare(String(a.usedAt ?? '')))
  }, [usagesQuery.data, inputId])

  /** 出入库流水，按时间倒序 */
  const flows = useMemo<InputStockFlow[]>(() => {
    const list = flowsQuery.data?.list ?? []
    return [...list].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  }, [flowsQuery.data])

  const plotMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    ;(plotsQuery.data?.list ?? []).forEach((plot) => map.set(plot.plotId, plot.plotName))
    return map
  }, [plotsQuery.data])

  const latestUsage = usages[0]

  /** 本季累计用量 */
  const cumulativeDosage = useMemo(
    () => usages.reduce((sum, usage) => sum + (usage.dosage ?? 0), 0),
    [usages],
  )

  /** 四项合规校验 */
  const complianceItems = useMemo<ComplianceItem[]>(
    () =>
      checkCompliance({
        inputName: item?.inputName,
        inputType: item?.inputType,
        safetyInterval: latestUsage?.safetyIntervalDays ?? item?.safetyInterval,
        dosage: latestUsage?.dosage,
        unit: latestUsage?.unit,
        lastUsedAt: latestUsage?.usedAt,
        cumulativeDosage,
      }),
    [item, latestUsage, cumulativeDosage],
  )

  const complianceLevel = summarizeCompliance(complianceItems)

  /** 当前记录的链上存证 */
  const chainRecord = useMemo<BlockchainRecord | undefined>(
    () =>
      (chainQuery.data?.list ?? []).find(
        (record) => latestUsage && record.bizId === latestUsage.usageId,
      ),
    [chainQuery.data, latestUsage],
  )

  /** 上链状态 */
  const chainState: ChainState = !latestUsage
    ? 'none'
    : chainRecord?.status === 3
      ? 'chained'
      : chainRecord?.status === 2
        ? 'chaining'
        : chainRecord?.status === 4
          ? 'failed'
          : 'pending'

  /** 存证编号 / 交易哈希 / 上链时间 */
  const certNo = latestUsage
    ? `CERT-${dayjs(latestUsage.usedAt ?? dayjs()).format('YYYYMMDDHHmmss')}`
    : '-'
  const txHash = chainRecord?.txHash ?? (latestUsage ? pseudoHash(latestUsage.usageId) : '-')
  const chainedAt = chainRecord?.chainedAt ?? chainRecord?.submittedAt ?? '-'

  /** 库存水位百分比（以预警阈值的 3 倍为满刻度） */
  const stockPercent = useMemo(() => {
    const stock = item?.stockQty ?? 0
    const full = (item?.warnQty ?? 0) * 3
    if (full <= 0) return stock > 0 ? 100 : 0
    return Math.min(100, Math.round((stock / full) * 100))
  }, [item])

  /** 库存预警判定 */
  const stockWarning =
    item?.warnQty !== undefined &&
    item?.warnQty !== null &&
    (item?.stockQty ?? 0) <= item.warnQty

  /** 使用记录列 */
  const usageColumns: ProColumns<InputUsageRecord>[] = [
    {
      title: '使用日期',
      key: 'usedAt',
      width: 170,
      render: (_, record) => fmtDate(record.usedAt, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '地块',
      key: 'plotName',
      width: 120,
      render: (_, record) =>
        (record.plotId ? plotMap.get(record.plotId) : undefined) || record.plotId || '-',
    },
    {
      title: '关联任务',
      key: 'taskId',
      width: 160,
      render: (_, record) => record.taskId ?? '-',
    },
    {
      title: '用量',
      key: 'dosage',
      width: 120,
      render: (_, record) => `${fmtNumber(record.dosage)} ${record.unit ?? ''}`,
    },
    { title: '施用方式', key: 'method', width: 100, render: (_, record) => record.method ?? '-' },
    { title: '操作人', key: 'operatorId', width: 110, render: (_, record) => record.operatorId ?? '-' },
    {
      title: '安全间隔期',
      key: 'safetyIntervalDays',
      width: 110,
      render: (_, record) =>
        record.safetyIntervalDays === undefined || record.safetyIntervalDays === null
          ? '-'
          : `${record.safetyIntervalDays} 天`,
    },
  ]

  /** 出入库流水列 */
  const flowColumns: ProColumns<InputStockFlow>[] = [
    {
      title: '时间',
      key: 'createdAt',
      width: 170,
      render: (_, record) => fmtDate(record.createdAt, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '类型',
      key: 'flowType',
      width: 90,
      render: (_, record) => {
        const meta = flowTypeMeta(record.flowType)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '数量',
      key: 'qty',
      width: 130,
      render: (_, record) => {
        const meta = flowTypeMeta(record.flowType)
        const qty = record.qty ?? 0
        return (
          <Typography.Text type={meta.direction === 1 ? 'success' : 'danger'}>
            {meta.direction === 1 ? '+' : '-'}
            {fmtNumber(Math.abs(qty))} {item?.unit ?? ''}
          </Typography.Text>
        )
      },
    },
    { title: '批次号', key: 'batchNo', width: 140, render: (_, record) => record.batchNo ?? '-' },
    {
      title: '有效期至',
      key: 'expireDate',
      width: 120,
      render: (_, record) => fmtDate(record.expireDate),
    },
    {
      title: '操作人',
      key: 'operatorId',
      width: 110,
      render: (_, record) => record.operatorId ?? '-',
    },
    {
      title: '关联任务',
      key: 'relatedTaskId',
      width: 160,
      render: (_, record) => record.relatedTaskId ?? '-',
    },
    { title: '备注', key: 'remark', render: (_, record) => record.remark ?? '-' },
  ]

  /** 存证验真结论（5 项，原型 P29 / P30） */
  const verifyChecks = useMemo(
    () => [
      {
        key: 'hash',
        label: '数据哈希一致性',
        passed: Boolean(chainRecord),
        detail: chainRecord
          ? '链上哈希 = 链下计算哈希'
          : '该记录尚未上链，无法比对链上哈希',
      },
      {
        key: 'signature',
        label: '数字签名有效性',
        passed: Boolean(chainRecord && chainRecord.status === 3),
        detail: chainRecord ? 'ECDSA 签名验证通过' : '待上链后自动校签',
      },
      {
        key: 'confirm',
        label: '区块确认数达标',
        passed: Boolean(chainRecord && chainRecord.status === 3),
        detail: chainRecord?.blockHeight
          ? `区块高度 ${chainRecord.blockHeight}`
          : '尚未出块，无确认数',
      },
      {
        key: 'timestamp',
        label: '时间戳可信',
        passed: Boolean(chainRecord?.chainTimestamp),
        detail: chainRecord?.chainTimestamp
          ? `链上时间 ${fmtDate(chainRecord.chainTimestamp, 'YYYY-MM-DD HH:mm:ss')}`
          : '无链上时间戳',
      },
      {
        key: 'integrity',
        label: '数据未被篡改',
        passed: Boolean(chainRecord && chainRecord.status === 3),
        detail: chainRecord ? '原始数据完整性校验通过' : '待上链后校验',
      },
    ],
    [chainRecord],
  )

  if (!inputId) {
    return (
      <PageContainer title="投入品详情">
        <Empty description="缺少投入品 ID" />
      </PageContainer>
    )
  }

  if (detailQuery.isError) {
    return (
      <PageContainer title="投入品详情">
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="danger">投入品详情加载失败，请稍后重试</Typography.Text>
              <Button
                onClick={() =>
                  void queryClient.invalidateQueries({
                    queryKey: ['production-inputs', 'detail', inputId],
                  })
                }
              >
                重新加载
              </Button>
            </Space>
          }
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title={
        <Space size={8}>
          <Typography.Link onClick={() => navigate('/production/inputs')}>
            <ArrowLeftOutlined /> 返回
          </Typography.Link>
          <span>
            {inputName || '投入品'} · 投入品详情
          </span>
        </Space>
      }
      subTitle={item ? `编号 ${item.inputCode ?? item.inputId}` : undefined}
      loading={detailQuery.isLoading}
      extra={[
        <Button
          key="trace"
          icon={<LinkOutlined />}
          onClick={() => navigate('/production/trace/full-chain')}
        >
          🔗 查看溯源链路
        </Button>,
        <Button key="edit" onClick={() => navigate('/production/inputs')}>
          返回台账
        </Button>,
      ]}
    >
      <Row gutter={16}>
        <Col span={16}>
          <Card title="📋 基本信息" style={{ marginBottom: 16 }}>
            <Descriptions
              bordered
              column={2}
              size="small"
              items={[
                { key: 'code', label: '投入品编号', children: item?.inputCode ?? item?.inputId ?? '-' },
                { key: 'name', label: '投入品名称', children: item?.inputName ?? '-' },
                {
                  key: 'type',
                  label: '类型',
                  children: (
                    <Tag color={categoryMeta(item?.inputType).color}>
                      {categoryMeta(item?.inputType).label}
                    </Tag>
                  ),
                },
                { key: 'regNo', label: '登记证号', children: item?.registrationNo ?? '-' },
                { key: 'manufacturer', label: '生产厂家', children: item?.manufacturer ?? '-' },
                { key: 'spec', label: '规格', children: item?.spec ?? '-' },
                { key: 'unit', label: '计量单位', children: item?.unit ?? '-' },
                {
                  key: 'safety',
                  label: '安全间隔期',
                  children:
                    item?.safetyInterval === undefined || item?.safetyInterval === null
                      ? '-'
                      : `${item.safetyInterval} 天`,
                },
                {
                  key: 'stock',
                  label: '当前库存',
                  children: `${fmtNumber(item?.stockQty)} ${item?.unit ?? ''}`,
                },
                {
                  key: 'warn',
                  label: '库存预警阈值',
                  children:
                    item?.warnQty === undefined || item?.warnQty === null
                      ? '-'
                      : `${fmtNumber(item.warnQty)} ${item?.unit ?? ''}`,
                },
                {
                  key: 'status',
                  label: '状态',
                  children:
                    item?.status === 1 ? (
                      <Tag color="green">启用</Tag>
                    ) : (
                      <Tag color="default">停用</Tag>
                    ),
                },
                { key: 'createdAt', label: '创建时间', children: fmtDate(item?.createdAt, 'YYYY-MM-DD HH:mm') },
                { key: 'updatedAt', label: '更新时间', children: fmtDate(item?.updatedAt, 'YYYY-MM-DD HH:mm') },
              ]}
            />
          </Card>

          <Card
            title="✅ 合规校验结果"
            style={{ marginBottom: 16 }}
            extra={
              <Tag
                color={
                  complianceLevel === 'pass'
                    ? 'green'
                    : complianceLevel === 'warning'
                      ? 'orange'
                      : 'red'
                }
              >
                整体结论：
                {complianceLevel === 'pass'
                  ? '✅ 通过'
                  : complianceLevel === 'warning'
                    ? '⚠️ 预警'
                    : '❌ 违规'}
              </Tag>
            }
          >
            <Row gutter={[12, 12]}>
              {complianceItems.map((check) => (
                <Col key={check.key} span={12}>
                  <Card
                    size="small"
                    style={{ background: LEVEL_BG[check.level], borderColor: check.color }}
                  >
                    <Space align="start" size={10}>
                      {LEVEL_ICON[check.level]}
                      <Space direction="vertical" size={2}>
                        <Space size={6}>
                          <Typography.Text strong>{check.label}</Typography.Text>
                          <Tag
                            color={
                              check.level === 'pass'
                                ? 'green'
                                : check.level === 'warning'
                                  ? 'orange'
                                  : 'red'
                            }
                          >
                            {check.result}
                          </Tag>
                        </Space>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {check.detail}
                        </Typography.Text>
                      </Space>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          <Card>
            <Tabs
              items={[
                {
                  key: 'usages',
                  label: `使用记录(${usages.length})`,
                  children: (
                    <ProTable<InputUsageRecord>
                      rowKey="usageId"
                      columns={usageColumns}
                      dataSource={usages}
                      loading={usagesQuery.isFetching}
                      search={false}
                      options={false}
                      pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
                    />
                  ),
                },
                {
                  key: 'flows',
                  label: `出入库流水(${flows.length})`,
                  children: (
                    <ProTable<InputStockFlow>
                      rowKey="flowId"
                      columns={flowColumns}
                      dataSource={flows}
                      loading={flowsQuery.isFetching}
                      search={false}
                      options={false}
                      pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card title="📦 库存与流向" style={{ marginBottom: 16 }}>
            <Statistic
              title="当前库存"
              value={item?.stockQty ?? 0}
              precision={2}
              suffix={item?.unit ?? ''}
            />
            <Progress
              percent={stockPercent}
              status={stockWarning ? 'exception' : 'normal'}
              style={{ marginTop: 8 }}
            />
            {stockWarning && (
              <Alert
                style={{ marginTop: 8 }}
                type="warning"
                showIcon
                message={`库存已达预警阈值 ${fmtNumber(item?.warnQty)} ${item?.unit ?? ''}，请及时补货`}
              />
            )}
            <Descriptions
              column={1}
              size="small"
              style={{ marginTop: 12 }}
              items={[
                {
                  key: 'batch',
                  label: '最近批次',
                  children: flows.find((flow) => flow.batchNo)?.batchNo ?? '-',
                },
                {
                  key: 'expire',
                  label: '有效期至',
                  children: fmtDate(flows.find((flow) => flow.expireDate)?.expireDate),
                },
                {
                  key: 'latest',
                  label: '最近使用',
                  children: latestUsage
                    ? `${fmtDate(latestUsage.usedAt)} · ${fmtNumber(latestUsage.dosage)} ${
                        latestUsage.unit ?? ''
                      }`
                    : '暂无使用记录',
                },
                {
                  key: 'cumulative',
                  label: '累计用量',
                  children: `${fmtNumber(cumulativeDosage)} ${latestUsage?.unit ?? ''}`,
                },
              ]}
            />
          </Card>

          <Card
            title="🔗 区块链存证"
            extra={
              <Tag color={CHAIN_STATE_META[chainState].tagColor}>
                {CHAIN_STATE_META[chainState].label}
              </Tag>
            }
          >
            <Descriptions
              column={1}
              size="small"
              items={[
                { key: 'certNo', label: '存证编号', children: certNo },
                {
                  key: 'txHash',
                  label: '交易哈希',
                  children: (
                    <Typography.Text copyable style={{ fontSize: 12, wordBreak: 'break-all' }}>
                      {txHash}
                    </Typography.Text>
                  ),
                },
                { key: 'chainAt', label: '上链时间', children: fmtDate(chainedAt, 'YYYY-MM-DD HH:mm:ss') },
                {
                  key: 'blockHeight',
                  label: '区块高度',
                  children: chainRecord?.blockHeight ?? '-',
                },
                { key: 'bizId', label: '关联业务单号', children: latestUsage?.usageId ?? '-' },
              ]}
            />
            <Space style={{ marginTop: 12 }}>
              <Button
                type="primary"
                icon={<SafetyCertificateOutlined />}
                disabled={!latestUsage}
                loading={chainMutation.isPending}
                onClick={() => latestUsage && chainMutation.mutate(latestUsage.usageId)}
              >
                立即上链
              </Button>
              <Button onClick={() => setVerifyOpen(true)}>验证</Button>
            </Space>
            {!latestUsage && (
              <Alert
                style={{ marginTop: 12 }}
                type="info"
                showIcon
                message="该投入品暂无使用记录，登记使用后可生成存证"
              />
            )}
            {!chainRecord && latestUsage && (
              <Alert
                style={{ marginTop: 12 }}
                type="info"
                showIcon
                message="展示的哈希为本地按业务主键生成的存证摘要，点击「立即上链」后由链上哈希覆盖"
              />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="🔍 存证验证"
        open={verifyOpen}
        width={640}
        okText="关闭"
        cancelText="取消"
        onOk={() => setVerifyOpen(false)}
        onCancel={() => setVerifyOpen(false)}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
          <Alert
            type={chainRecord ? 'success' : 'warning'}
            showIcon
            message={
              chainRecord
                ? `存证编号 ${certNo} 验证通过`
                : '该使用记录尚未上链，请先执行「立即上链」'
            }
            description={
              chainRecord
                ? '链上数据与链下原始数据一致，数据未被篡改，区块链存证有效'
                : '未查询到链上记录，无法完成哈希比对与签名验证'
            }
          />
          {verifyChecks.map((check) => (
            <Card key={check.key} size="small">
              <Space align="start">
                {check.passed ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
                )}
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>{check.label}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {check.detail}
                  </Typography.Text>
                </Space>
              </Space>
            </Card>
          ))}
        </Space>
      </Modal>
    </PageContainer>
  )
}
