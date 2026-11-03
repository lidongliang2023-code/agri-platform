/**
 * 页面名称：投入品详情
 * 路由路径：/production/inputs/:inputId
 * 所属模块：农资管理
 * 原型来源：用户端原型 P12 input-detail — 投入品详情
 *
 * 还原要点：
 * - 头部「< 返回 {名称} · 投入品详情」+ 🔗 查看溯源链路
 * - 「📋 基本信息」：编号 / 名称 / 投入品类型 / 登记证号 / 生产厂家 / 规格 / 单位 / 安全间隔期 / 库存 / 状态
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
import { listPlots } from '@/api/plots'
import { getInputInfo, pageStockFlows, pageUsages } from '@/api/inputs'
import type { InputStockFlow } from '@/api/inputs'
import { listChainRecords, submitChain } from '@/api/blockchain'
import type { BlockchainBizRecord, InputUsageRecord } from '@/types'
import useFarmStore from '@/store/farm'
import { DetailInfoGrid } from '@/components'
import {
  categoryMeta,
  checkCompliance,
  fmtDate,
  fmtNumber,
  flowTypeMeta,
  summarizeCompliance,
} from './shared'
import type { ComplianceItem } from './shared'

/** 上链状态：1 待上链 2 上链中 3 已上链 4 上链失败 */
/** 存证状态（按后端返回的字符串状态推导；'pending' 那一档已删除 —— 后端没有"上链中"这个中间态） */
type ChainState = 'none' | 'chaining' | 'chained' | 'failed'

/**
 * 存证状态展示元数据。
 *
 * `none` 的措辞是「无存证记录」而不是「待上链」：前者是"查过了，这条业务没存证"，
 * 后者暗示"马上就上链了"，两者对运营的动作指引完全不同。
 */
const CHAIN_STATE_META: Record<ChainState, { label: string; color: string; tagColor: string }> = {
  none: { label: '无存证记录', color: '#8c8c8c', tagColor: 'default' },
  chaining: { label: '⏳ 已提交待出块', color: '#1677ff', tagColor: 'blue' },
  chained: { label: '✅ 已上链（模拟链）', color: '#52c41a', tagColor: 'green' },
  failed: { label: '❌ 存证失败', color: '#ff4d4f', tagColor: 'red' },
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

  /**
   * 使用记录（按投入品服务端过滤）。
   *
   * ⚠️ 旧版是"全量拉 500 条再本地 `usage.inputId === inputId` 过滤"：路由参数是**字符串**、
   * 后端返回的 inputId 是**数字**，严格相等永远 false，于是这个页面的「使用记录 / 累计用量 /
   * 合规校验 / 区块链存证」四块**常年显示空值**，接口 200、控制台无报错。
   * 后端 `/inputs/usages` 一直支持 inputId 过滤，改为服务端过滤（顺带不再拉全量）。
   */
  const usagesQuery = useQuery({
    queryKey: ['production-inputs', 'usages', inputId],
    enabled: Boolean(inputId),
    queryFn: () => pageUsages({ inputId, pageNum: 1, pageSize: 200 }),
  })

  /** 出入库流水 */
  const flowsQuery = useQuery({
    queryKey: ['production-inputs', 'stock-flows', inputId],
    enabled: Boolean(inputId),
    queryFn: () => pageStockFlows(inputId, { pageNum: 1, pageSize: 200 }),
  })

  /** 链上存证记录（业务类型 INPUT = 投入品使用；历史上是数字 2，服务端已下线该写法） */
  const chainQuery = useQuery({
    queryKey: ['blockchain', 'records', 'input-usage'],
    queryFn: () => listChainRecords({ bizType: 'INPUT', pageNum: 1, pageSize: 200 }),
  })

  /** 地块名称映射 */
  const plotsQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /**
   * 上链提交。
   *
   * 成功话术按**服务端返回的真实状态**说：本部署是模拟链，写一条就是 SUCCESS 并带回交易哈希，
   * 所以不能再写"等待链上确认"（那是把已完成的动作说成未完成）。
   * 失败必须显式报错：服务端会核对这条使用记录是否真的属于当前经营主体，
   * 静默失败会让人以为"点了没反应"，其实是被拒了。
   */
  const chainMutation = useMutation({
    mutationFn: (bizId: string) =>
      submitChain({ bizId, bizType: 'INPUT', bizSummary: '投入品使用记录存证' }),
    onSuccess: (record) => {
      message.success(
        record?.status === 'SUCCESS'
          ? `已存证（模拟链 SUCCESS${record.txHash ? `，交易哈希 ${record.txHash}` : ''}）`
          : `已提交存证，当前状态 ${record?.status ?? '未知'}`,
      )
      void queryClient.invalidateQueries({ queryKey: ['blockchain'] })
    },
    onError: (err: Error) => {
      message.error(`存证失败，未写入任何记录：${err.message}`)
    },
  })

  const item = detailQuery.data
  const inputName = item?.inputName ?? ''

  /** 该投入品的使用记录，按时间倒序 */
  const usages = useMemo<InputUsageRecord[]>(
    () =>
      [...(usagesQuery.data?.list ?? [])].sort((a, b) =>
        String(b.usedAt ?? '').localeCompare(String(a.usedAt ?? '')),
      ),
    [usagesQuery.data],
  )

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

  /**
   * 当前记录的链上存证（按业务键对号：存证的 target_code 就是使用记录 ID 的字符串形式）。
   *
   * ⚠️ 旧版写的是 `record.bizId === latestUsage.usageId` —— 后端把业务键序列化成**字符串**，
   * 而 usageId 是 number，这个严格相等永远为 false，于是页面**一直显示"待上链"**，
   * 哪怕存证表里真有这条记录。接口 200、不报错、结论是假的，属于最难被发现的一类。
   */
  const chainRecord = useMemo<BlockchainBizRecord | undefined>(
    () =>
      (chainQuery.data?.list ?? []).find(
        (record) =>
          latestUsage && String(record.bizNo ?? record.bizId ?? '') === String(latestUsage.usageId),
      ),
    [chainQuery.data, latestUsage],
  )

  /**
   * 存证状态：按后端返回的**字符串状态**判（PENDING / SUCCESS / FAILED）。
   * 旧版比较的是 1/2/3/4 这套数字，本服务从不返回数字状态，所以分支永远走不到。
   */
  const chainState: ChainState = !latestUsage
    ? 'none'
    : chainRecord?.status === 'SUCCESS'
      ? 'chained'
      : chainRecord?.status === 'PENDING'
        ? 'chaining'
        : chainRecord?.status === 'FAILED'
          ? 'failed'
          : 'none'

  /** 存证编号 / 交易哈希 / 上链时间：只从真实存证记录取，没有记录就说没有，不本地编造 */
  const certNo = chainRecord?.recordNo ?? '—（尚无存证记录）'
  const txHash = chainRecord?.txHash ?? '未生成交易哈希'
  const chainedAt = chainRecord?.anchorAt ?? chainRecord?.chainedAt ?? chainRecord?.createdAt ?? ''

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
      title: '流水类型',
      key: 'flowType',
      width: 100,
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

  /**
   * 存证核对项（只列**本部署真能核对**的事实）。
   *
   * 旧版这五张卡写的是"ECDSA 签名验证通过""链上哈希 = 链下计算哈希""原始数据完整性校验通过"
   * "时间戳可信" —— 后端从来没有这些校验：存证表是本地库，`/blockchain/verify` 只回答
   * "本库有没有一条同键的 SUCCESS 记录"，而且本部署是**模拟链**（chainType=SIMULATED）。
   * 把这些写成"校验通过"是在替安全能力编事实，用户会据此认为数据经过链上验证。
   * 现在每条只说自己依据哪个字段、结论是什么，做不到的直接写"本部署不做该核验"。
   */
  const verifyChecks = useMemo(
    () => [
      {
        key: 'record',
        label: '有无存证记录',
        passed: Boolean(chainRecord),
        detail: chainRecord
          ? `存证编号 ${chainRecord.recordNo ?? '—'}，业务键 ${chainRecord.bizNo ?? chainRecord.bizId ?? '—'}`
          : '存证表（agri_prod_chain_record）里没有这条使用记录的存证',
      },
      {
        key: 'status',
        label: '存证状态',
        passed: chainRecord?.status === 'SUCCESS',
        detail: chainRecord
          ? `${chainRecord.status ?? '未知'}${chainRecord.failReason ? `（原因：${chainRecord.failReason}）` : ''}`
          : '无记录，无状态',
      },
      {
        key: 'anchor',
        label: '是否已出块',
        passed: Boolean(chainRecord?.txHash),
        detail: chainRecord?.txHash
          ? `交易哈希 ${chainRecord.txHash}，区块高度 ${chainRecord.blockHeight ?? '—'}`
          : '尚未出块，没有交易哈希与区块高度',
      },
      {
        key: 'payload',
        label: '内容指纹是否留档',
        passed: Boolean(chainRecord?.payloadHash ?? chainRecord?.dataHash),
        detail: chainRecord
          ? '存证记录里存了 data_hash（内容指纹）。注意：本部署不连真链，**没有做"链上=链下"比对**'
          : '无存证记录，也就没有可比对的内容指纹',
      },
      {
        key: 'chainType',
        label: '链类型',
        passed: false,
        detail: '本部署为 SIMULATED（模拟链）：签名校验、区块确认数、公链完整性校验都不存在',
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
      title={`📦 ${inputName || '投入品'}`}
      subTitle={item ? `编号 ${item.inputCode ?? item.inputId}` : undefined}
      onBack={() => navigate('/production/inputs')}
      backIcon={<ArrowLeftOutlined />}
      loading={detailQuery.isLoading}
      extra={[
        <Button
          key="trace"
          icon={<LinkOutlined />}
          onClick={() => navigate('/production/trace/full-chain')}
        >
          查看溯源链路
        </Button>,
      ]}
    >
      <Row gutter={16}>
        <Col span={16}>
          <Card
            title="📋 基本信息"
            style={{ marginBottom: 16 }}
            extra={item?.status === 1 ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>}
          >
            <DetailInfoGrid
              columns={2}
              items={[
                {
                  key: 'code',
                  label: '投入品编号',
                  value: item?.inputCode ?? item?.inputId ?? '-',
                },
                { key: 'name', label: '投入品名称', value: item?.inputName ?? '-' },
                {
                  key: 'type',
                  label: '投入品类型',
                  value: categoryMeta(item?.inputType).label,
                },
                { key: 'regNo', label: '登记证号', value: item?.registrationNo ?? '-' },
                { key: 'manufacturer', label: '生产厂家', value: item?.manufacturer ?? '-' },
                { key: 'spec', label: '规格', value: item?.spec ?? '-' },
                { key: 'unit', label: '计量单位', value: item?.unit ?? '-' },
                {
                  key: 'safety',
                  label: '安全间隔期',
                  value:
                    item?.safetyInterval === undefined || item?.safetyInterval === null
                      ? '-'
                      : `${item.safetyInterval} 天`,
                },
                {
                  key: 'stock',
                  label: '当前库存',
                  value: `${fmtNumber(item?.stockQty)} ${item?.unit ?? ''}`,
                },
                {
                  key: 'warn',
                  label: '库存预警阈值',
                  value:
                    item?.warnQty === undefined || item?.warnQty === null
                      ? '-'
                      : `${fmtNumber(item.warnQty)} ${item?.unit ?? ''}`,
                },
                {
                  key: 'createdAt',
                  label: '创建时间',
                  value: fmtDate(item?.createdAt, 'YYYY-MM-DD HH:mm'),
                },
                {
                  key: 'updatedAt',
                  label: '更新时间',
                  value: fmtDate(item?.updatedAt, 'YYYY-MM-DD HH:mm'),
                },
              ]}
            />
          </Card>

          <Card
            title={`✅ 合规校验结果（${complianceItems.length} 项）`}
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
                      // 列宽合计约 890，窄屏时表格内部横向滚动
                      scroll={{ x: 900 }}
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
                      // 固定列宽合计约 970，备注列需额外空间，窄屏时表格内部横向滚动
                      scroll={{ x: 1120 }}
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
            <DetailInfoGrid
              columns={1}
              items={[
                {
                  key: 'batch',
                  label: '最近批次',
                  value: flows.find((flow) => flow.batchNo)?.batchNo ?? '-',
                },
                {
                  key: 'expire',
                  label: '有效期至',
                  value: fmtDate(flows.find((flow) => flow.expireDate)?.expireDate),
                },
                {
                  key: 'latest',
                  label: '最近使用',
                  value: latestUsage
                    ? `${fmtDate(latestUsage.usedAt)} · ${fmtNumber(latestUsage.dosage)} ${
                        latestUsage.unit ?? ''
                      }`
                    : '暂无使用记录',
                },
                {
                  key: 'cumulative',
                  label: '累计用量',
                  value: `${fmtNumber(cumulativeDosage)} ${latestUsage?.unit ?? ''}`,
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
            <DetailInfoGrid
              columns={1}
              items={[
                { key: 'certNo', label: '存证编号', value: certNo },
                {
                  key: 'txHash',
                  label: '交易哈希',
                  value: chainRecord?.txHash ? (
                    <Typography.Text copyable style={{ fontSize: 12, wordBreak: 'break-all' }}>
                      {chainRecord.txHash}
                    </Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">{txHash}</Typography.Text>
                  ),
                },
                {
                  key: 'chainAt',
                  label: '上链时间',
                  value: chainedAt
                    ? fmtDate(chainedAt, 'YYYY-MM-DD HH:mm:ss')
                    : '未出块（无存证记录或存证仍待上链）',
                },
                {
                  key: 'blockHeight',
                  label: '区块高度',
                  value: chainRecord?.blockHeight ?? '未出块',
                },
                {
                  key: 'bizId',
                  label: '关联业务单号',
                  value: latestUsage?.usageId ?? '-',
                },
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
