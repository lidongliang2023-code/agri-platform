/**
 * 页面名称：生产全链路溯源
 * 路由路径：/production/trace/full-chain
 * 所属模块：质量检测与溯源
 * PRD 序号：PRD 6.1 #37
 * 原型来源：用户端原型 P24 trace-fullchain
 *
 * 还原要点：
 * - 头部 `< 返回 全链路溯源`（→trace）+ `导出溯源报告` / `生成报告`（→trace-reports）
 * - 溯源码头卡：溯源码 / 产品 / 农场 / 品种 / 地块 / 批次 / 采收数量 / 等级 / 采收日期
 * - 🔗 全链路流程图（种植 → 投入品 → 检测 → 采收 → 入库 → 流通）+ 时间轴明细
 * - 每个节点展示：时间、操作人、记录详情、存证状态
 * - 支持按批次号 / 溯源码查询（/trace/full-chain/{batchId}/nodes）
 *
 * 【数据源实测 2026-10-09】后端 5 个链路相关端点（growth / inputs/usages /
 * quality/inspections/by-batch / trace/full-chain/{id}/nodes / harvests/{id}）
 * 返回体中**均不存在 onChain、txHash 字段**（已连服实测确认）。
 * 因此「已上链 / 待上链」不是真实判断，而是把 undefined 当 false 渲染出来的假结论——
 * 它会让运营以为数据"还没上链"而去推动上链动作。
 * 现统一降级为显式「未接入」（MetricStatistic value={null} → 「—」+ 橙色 ⓘ + Tooltip），
 * 节点的 onChain 类型改为 boolean | null（null = 后端未提供），接口补齐后自动填充。
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Row,
  Space,
  Statistic,
  Steps,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  FileTextOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import { MetricStatistic } from '@/components'
import { fetchFullChainNodes, fetchTraceCodeDetail } from '@/api/trace'
import { listInspectionsByBatch } from '@/api/quality'
import { getHarvest, listInventoryFlows } from '@/api/harvests'
import { listGrowthRecords } from '@/api/growth'
import { listInputUsages } from '@/api/inputs'
import type { GrowthRecord, InputUsage, InventoryFlow, RawInspection } from '@/types'

/** 全链路环节 */
type StageKey = 'plant' | 'input' | 'inspect' | 'harvest' | 'storage' | 'logistics' | 'trace'

/** 环节展示元数据 */
interface StageMeta {
  /** 环节标题 */
  title: string
  /** 环节图标 */
  icon: string
  /** 主题色 */
  color: string
}

/** 环节展示元数据表（对照原型 P24 时间线顺序） */
const STAGE_META: Record<StageKey, StageMeta> = {
  plant: { title: '种植记录', icon: '📋', color: '#52c41a' },
  input: { title: '投入品使用', icon: '💊', color: '#fa8c16' },
  inspect: { title: '质量检测', icon: '🔬', color: '#722ed1' },
  harvest: { title: '采收记录', icon: '🌾', color: '#eb2f96' },
  storage: { title: '入库记录', icon: '📦', color: '#1677ff' },
  logistics: { title: '流通记录', icon: '🚛', color: '#13c2c2' },
  trace: { title: '溯源码', icon: '🏷️', color: '#2f54eb' },
}

/** 流程图展示顺序（入库 / 流通为待操作环节） */
const FLOW_STAGES: StageKey[] = ['plant', 'input', 'inspect', 'harvest', 'storage', 'logistics']

/** 链路节点 */
interface ChainNode {
  /** 节点唯一键 */
  key: string
  /** 所属环节 */
  stage: StageKey
  /** 节点标题 */
  title: string
  /** 发生时间（用于排序展示，空表示待操作） */
  time?: string
  /** 时间展示文案 */
  timeText: string
  /** 操作人 */
  operator?: string
  /** 记录详情 */
  detail?: string
  /**
   * 是否已上链。
   * null = 后端未提供该字段（实测所有链路端点返回体均无 onChain），显示为「未接入」；
   * true / false 仅在后端真正返回该字段后才会出现。
   */
  onChain: boolean | null
  /** 上链交易哈希（后端实测未返回） */
  txHash?: string
}

/** 上链状态缺失时的提示语 */
const ON_CHAIN_MISSING_TIP =
  '后端未提供上链状态字段（onChain），显示为「未接入」；不做本地估算，接口补齐后自动填充'

/** 检测类型展示文案 */
const INSPECT_TYPE_TEXT: Record<string, string> = {
  SELF: '自检',
  SEND: '送检',
  SAMPLING: '抽检',
}

/** 格式化时间文案 */
function formatTime(value?: string): string {
  if (!value) return '待操作'
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : value
}

/** 仅保留日期 */
function formatDate(value?: string): string {
  if (!value) return '-'
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD') : value
}

/** CSV 单元格转义 */
function escapeCsv(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

/**
 * 生产全链路溯源页
 *
 * 业务职责：按批次号 / 溯源码还原「种植 → 投入品 → 检测 → 采收 → 入库 → 流通」全链路，
 * 汇总各业务系统的真实记录并展示存证状态。
 *
 * @returns 页面内容
 */
export default function FullChainTrace(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentFarm = useFarmStore((state) => state.currentFarm)

  const initialBatchId = searchParams.get('batchId') ?? ''
  const initialCode = searchParams.get('code') ?? ''

  const [codeInput, setCodeInput] = useState<string>(initialCode)
  const [batchIdInput, setBatchIdInput] = useState<string>(initialBatchId)
  const [activeCode, setActiveCode] = useState<string>(initialCode)
  const [batchId, setBatchId] = useState<string>(initialBatchId)

  /** 溯源码详情（按溯源码查询时先取详情，再取 batchId） */
  const codeQuery = useQuery({
    queryKey: ['trace-code-detail', activeCode],
    enabled: Boolean(activeCode),
    retry: false,
    queryFn: () => fetchTraceCodeDetail(activeCode),
  })

  /** 溯源码详情反查到的批次 ID */
  const codeBatchId = String(codeQuery.data?.batchId ?? '')

  /** 生效批次 ID：手动输入的批次优先，其次取溯源码所属的批次 */
  const effectiveBatchId = batchId || codeBatchId

  /** 批次（采收）详情 */
  const batchQuery = useQuery({
    queryKey: ['harvest-batch-detail', effectiveBatchId],
    enabled: Boolean(effectiveBatchId),
    retry: false,
    queryFn: () => getHarvest(effectiveBatchId),
  })

  /** 全链路节点（后端 /trace/full-chain/{batchId}/nodes） */
  const nodesQuery = useQuery({
    queryKey: ['trace-full-chain-nodes', effectiveBatchId],
    enabled: Boolean(effectiveBatchId),
    queryFn: () => fetchFullChainNodes(effectiveBatchId),
  })

  /** 批次检测记录 */
  const inspectionQuery = useQuery({
    queryKey: ['trace-chain-inspections', effectiveBatchId],
    enabled: Boolean(effectiveBatchId),
    queryFn: () => listInspectionsByBatch(effectiveBatchId),
  })

  /** 库存流水（入库 / 出库） */
  const flowQuery = useQuery({
    queryKey: ['trace-chain-flows', effectiveBatchId],
    enabled: Boolean(effectiveBatchId),
    queryFn: () => listInventoryFlows(effectiveBatchId, { pageNum: 1, pageSize: 50 }),
  })

  /** 地块 ID（用于关联生长记录与投入品使用记录） */
  const plotId = batchQuery.data?.plotId ?? ''

  /** 生长记录（种植 / 农事管理） */
  const growthQuery = useQuery({
    queryKey: ['trace-chain-growth', plotId],
    enabled: Boolean(plotId),
    queryFn: () => listGrowthRecords({ plotId, pageNum: 1, pageSize: 100 }),
  })

  /** 投入品使用记录（施肥 / 病虫害防治） */
  const usageQuery = useQuery({
    queryKey: ['trace-chain-usages', plotId],
    enabled: Boolean(plotId),
    queryFn: () => listInputUsages({ plotId, pageNum: 1, pageSize: 100 }),
  })

  /** 与地块匹配的生长记录（后端未支持 plotId 过滤，前端二次过滤） */
  const growthRecords = useMemo<GrowthRecord[]>(() => {
    const list = growthQuery.data?.list ?? []
    return plotId ? list.filter((item) => String(item.plotId) === String(plotId)) : []
  }, [growthQuery.data, plotId])

  /** 与地块匹配的投入品使用记录 */
  const usageRecords = useMemo<InputUsage[]>(() => {
    const list = usageQuery.data?.list ?? []
    return plotId ? list.filter((item) => String(item.plotId ?? '') === String(plotId)) : []
  }, [usageQuery.data, plotId])

  /** 入库流水 */
  const storageFlow = useMemo<InventoryFlow | undefined>(
    () => (flowQuery.data?.list ?? []).find((item) => item.flowType === 1),
    [flowQuery.data],
  )

  /** 出库（流通）流水 */
  const outboundFlow = useMemo<InventoryFlow | undefined>(
    () => (flowQuery.data?.list ?? []).find((item) => item.flowType === 2),
    [flowQuery.data],
  )

  /** 全链路节点集合（真实业务数据聚合） */
  const chainNodes = useMemo<ChainNode[]>(() => {
    const nodes: ChainNode[] = []

    // 种植记录：取该地块最早一条生长记录
    const sortedGrowth = [...growthRecords].sort((a, b) =>
      String(a.recordDate).localeCompare(String(b.recordDate)),
    )
    const firstGrowth = sortedGrowth[0]
    if (firstGrowth) {
      nodes.push({
        key: `plant-${firstGrowth.recordId}`,
        stage: 'plant',
        title: `种植记录 - ${firstGrowth.cropName ?? batchQuery.data?.cropId ?? '作物'}（${firstGrowth.growthStage}）`,
        time: firstGrowth.recordDate,
        timeText: formatDate(firstGrowth.recordDate),
        operator: firstGrowth.recorderName ?? firstGrowth.recorderId,
        detail: [firstGrowth.growthStage, firstGrowth.pestInfo, firstGrowth.remark]
          .filter(Boolean)
          .join(' · '),
        // 后端生长记录返回体无 onChain 字段，按「未提供」处理
        onChain: null,
      })
    }

    // 投入品使用（施肥 / 用药）
    usageRecords.forEach((usage) => {
      nodes.push({
        key: `input-${usage.usageId}`,
        stage: 'input',
        title: `投入品使用 - ${usage.inputName ?? usage.inputId}`,
        time: usage.usedAt,
        timeText: formatTime(usage.usedAt),
        operator: usage.operatorName ?? usage.operatorId,
        detail: `${usage.quantity ?? 0}${usage.unit ?? ''} · ${usage.usageMethod ?? '常规施用'}`,
        // 后端投入品使用记录返回体无 onChain 字段，按「未提供」处理
        onChain: null,
      })
    })

    // 质量检测
    ;(inspectionQuery.data ?? []).forEach((item: RawInspection, index: number) => {
      const passed = item.result === 'PASS'
      nodes.push({
        key: `inspect-${item.inspectionId ?? index}`,
        stage: 'inspect',
        title: `质量检测 - ${item.inspectionNo ?? item.inspectionId} ${
          passed ? '合格' : item.result === 'FAIL' ? '不合格' : '待出结论'
        }`,
        time: item.sampleAt ?? item.createdAt,
        timeText: formatDate(item.sampleAt ?? item.createdAt),
        operator: item.inspectorName ?? item.inspectorId,
        detail: `${INSPECT_TYPE_TEXT[String(item.inspectionType)] ?? item.inspectionType ?? '检测'} · 机构 ${
          item.labName ?? '—'
        }`,
        // 后端质检记录返回体无 onChain 字段，按「未提供」处理
        onChain: null,
      })
    })

    // 采收记录
    if (batchQuery.data) {
      nodes.push({
        key: `harvest-${batchQuery.data.batchId}`,
        stage: 'harvest',
        title: `采收记录 - 采收 ${batchQuery.data.quantity ?? 0}${batchQuery.data.unit ?? 'kg'}`,
        time: batchQuery.data.harvestDate,
        timeText: formatDate(batchQuery.data.harvestDate),
        operator: batchQuery.data.operatorName ?? batchQuery.data.operatorId,
        detail: `批次 ${batchQuery.data.batchNo ?? batchQuery.data.batchId} · 地块 ${
          batchQuery.data.plotName ?? batchQuery.data.plotId ?? '—'
        }`,
        onChain: null,
      })
    }

    // 入库记录
    if (storageFlow) {
      nodes.push({
        key: `storage-${storageFlow.flowId}`,
        stage: 'storage',
        title: `入库记录 - 入库 ${storageFlow.quantity}${storageFlow.unit}`,
        time: storageFlow.operatedAt,
        timeText: formatTime(storageFlow.operatedAt),
        operator: storageFlow.operatorName,
        detail: `关联单据 ${storageFlow.orderNo ?? '—'}`,
        onChain: null,
      })
    } else {
      nodes.push({
        key: 'storage-pending',
        stage: 'storage',
        title: '入库记录 - 待操作',
        timeText: '待入库',
        onChain: null,
      })
    }

    // 流通记录
    if (outboundFlow) {
      nodes.push({
        key: `logistics-${outboundFlow.flowId}`,
        stage: 'logistics',
        title: `流通记录 - 出库 ${Math.abs(Number(outboundFlow.quantity))}${outboundFlow.unit}`,
        time: outboundFlow.operatedAt,
        timeText: formatTime(outboundFlow.operatedAt),
        operator: outboundFlow.operatorName,
        detail: `关联单据 ${outboundFlow.orderNo ?? '—'}`,
        onChain: null,
      })
    } else {
      nodes.push({
        key: 'logistics-pending',
        stage: 'logistics',
        title: '流通记录 - 待操作',
        timeText: '待出库',
        onChain: null,
      })
    }

    // 溯源码节点（后端全链路接口返回）
    ;(nodesQuery.data ?? []).forEach((node, index) => {
      nodes.push({
        key: `trace-${node.refId ?? index}`,
        stage: 'trace',
        title: `${node.nodeName ?? '溯源码'} - ${node.refNo ?? '—'}`,
        time: node.occurredAt,
        timeText: formatTime(node.occurredAt),
        operator: node.operatorName,
        detail: node.description ?? `节点类型 ${node.nodeType}`,
        // 后端全链路节点返回体无 onChain / txHash 字段，按「未提供」处理
        onChain: null,
        txHash: undefined,
      })
    })

    // 有时间的按时间升序，待操作节点保持在末尾
    return nodes.sort((a, b) => {
      if (!a.time) return 1
      if (!b.time) return -1
      return String(a.time).localeCompare(String(b.time))
    })
  }, [
    growthRecords,
    usageRecords,
    inspectionQuery.data,
    batchQuery.data,
    storageFlow,
    outboundFlow,
    nodesQuery.data,
  ])

  /**
   * 存证统计。
   *
   * 后端未提供 onChain 字段时 onChain 为 null（不是 0），
   * verifyPassed 同步为 null，页面显示「未接入」而不是「待上链」——
   * 避免用 undefined 算出一个看起来像判断的假结论。
   */
  const chainStats = useMemo(() => {
    const total = chainNodes.length
    const known = chainNodes.filter((item) => item.onChain !== null)
    const onChain = known.length === 0 ? null : known.filter((item) => item.onChain === true).length
    return {
      total,
      onChain,
      verifyPassed: onChain === null ? null : total > 0 && onChain === total,
    }
  }, [chainNodes])

  /** 流程图步骤 */
  const flowSteps = useMemo(
    () =>
      FLOW_STAGES.map((stage) => {
        const hit = chainNodes.filter((item) => item.stage === stage)
        const done = hit.some((item) => Boolean(item.time))
        return {
          title: `${STAGE_META[stage].icon} ${STAGE_META[stage].title}`,
          description: hit.length === 0 ? '暂无记录' : done ? `${hit.length} 条记录` : '待操作',
          status: done ? ('finish' as const) : ('wait' as const),
        }
      }),
    [chainNodes],
  )

  /** 查询 */
  const handleSearch = (): void => {
    const code = codeInput.trim()
    const nextBatchId = batchIdInput.trim()
    setActiveCode(code)
    setBatchId(nextBatchId)
    if (!code && !nextBatchId) {
      message.warning('请输入批次号或溯源码')
    }
  }

  /** 导出全链路记录为 CSV */
  const handleExport = (): void => {
    if (chainNodes.length === 0) {
      message.warning('暂无可导出的链路记录')
      return
    }
    const header = ['环节', '节点', '时间', '操作人', '记录详情', '存证状态']
    const body = chainNodes.map((item) =>
      [
        STAGE_META[item.stage].title,
        item.title,
        item.timeText,
        item.operator ?? '—',
        item.detail ?? '—',
        item.onChain === null ? '未接入' : item.onChain ? '已上链' : '待上链',
      ]
        .map(escapeCsv)
        .join(','),
    )
    const csv = `\uFEFF${[header.join(','), ...body].join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `全链路溯源_${effectiveBatchId || activeCode || '未指定'}_${dayjs().format('YYYYMMDDHHmm')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    message.success(`已导出 ${chainNodes.length} 条链路记录`)
  }

  /** 跳转生成溯源报告 */
  const handleGenerateReport = (): void => {
    navigate(
      `/production/trace/reports?batchId=${encodeURIComponent(effectiveBatchId)}&code=${encodeURIComponent(activeCode)}`,
    )
  }

  /** 是否处于加载态 */
  const loading =
    nodesQuery.isFetching ||
    batchQuery.isFetching ||
    inspectionQuery.isFetching ||
    growthQuery.isFetching ||
    usageQuery.isFetching ||
    flowQuery.isFetching

  /** 渲染主体 */
  const renderContent = (): JSX.Element => {
    if (!effectiveBatchId) {
      return (
        <Empty
          description="请输入批次号或溯源码后查询全链路溯源信息"
          style={{ padding: '48px 0' }}
        />
      )
    }
    if (chainNodes.length === 0 && !loading) {
      return (
        <Empty
          description={`批次 ${effectiveBatchId} 暂无全链路记录，请确认批次是否存在或已完成采收登记`}
          style={{ padding: '48px 0' }}
        />
      )
    }
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          banner
          type="warning"
          showIcon
          message="存证状态口径说明：后端所有链路端点均未返回上链状态字段（onChain / 交易哈希），页面的「已上链 / 待上链」一律显示为「未接入」，不做本地估算"
        />
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic title="全链路存证记录" value={chainStats.total} suffix="条" />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <MetricStatistic
                title="已上链"
                value={chainStats.onChain}
                suffix="条"
                missingTip={ON_CHAIN_MISSING_TIP}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="验证状态"
                value={
                  chainStats.verifyPassed === null
                    ? '未接入'
                    : chainStats.verifyPassed
                      ? '通过'
                      : '待上链'
                }
                valueStyle={{
                  color:
                    chainStats.verifyPassed === null
                      ? '#bfbfbf'
                      : chainStats.verifyPassed
                        ? '#52c41a'
                        : '#fa8c16',
                }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="🧭 全链路流程图">
          <Steps items={flowSteps} />
        </Card>

        <Card title="🔗 全链路时间线">
          <Timeline
            items={chainNodes.map((item) => {
              const meta = STAGE_META[item.stage]
              return {
                dot: <span style={{ fontSize: 16 }}>{meta.icon}</span>,
                children: (
                  <div>
                    <Space size={8} wrap>
                      <Typography.Text strong>{item.timeText}</Typography.Text>
                      <Typography.Text style={{ color: meta.color }}>
                        {item.title}
                      </Typography.Text>
                      {item.onChain === null ? (
                        <Tooltip title={ON_CHAIN_MISSING_TIP}>
                          <Tag color="default">未接入</Tag>
                        </Tooltip>
                      ) : item.onChain ? (
                        <Tag color="green">🔗 已上链</Tag>
                      ) : (
                        <Tag>⏳ 待上链</Tag>
                      )}
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      <Typography.Text type="secondary">
                        操作人：{item.operator ?? '—'}
                        {item.detail ? ` · ${item.detail}` : ''}
                        {item.txHash ? ` · 交易哈希 ${item.txHash}` : ''}
                      </Typography.Text>
                    </div>
                  </div>
                ),
              }
            })}
          />
        </Card>
      </Space>
    )
  }

  return (
    <PageContainer
      title={
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/production/trace')}
          >
            返回
          </Button>
          <span>全链路溯源</span>
        </Space>
      }
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      extra={[
        <Button key="export" icon={<DownloadOutlined />} onClick={handleExport}>
          导出溯源报告
        </Button>,
        <Button
          key="report"
          type="primary"
          icon={<FileTextOutlined />}
          onClick={handleGenerateReport}
        >
          生成报告
        </Button>,
      ]}
    >
      <Card style={{ marginBottom: 16 }}>
        <Form layout="inline" style={{ rowGap: 12 }}>
          <Form.Item label="批次号/批次ID">
            <Input
              allowClear
              value={batchIdInput}
              placeholder="如 BC20260601 或批次 ID"
              style={{ width: 220 }}
              onChange={(event) => setBatchIdInput(event.target.value)}
              onPressEnter={handleSearch}
            />
          </Form.Item>
          <Form.Item label="溯源码">
            <Input
              allowClear
              value={codeInput}
              placeholder="如 AG010101202606010001"
              style={{ width: 240 }}
              onChange={(event) => setCodeInput(event.target.value)}
              onPressEnter={handleSearch}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              查询
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card style={{ marginBottom: 16 }} loading={Boolean(activeCode) && codeQuery.isFetching}>
        <Descriptions column={3} bordered size="small">
          <Descriptions.Item label="🏷️ 溯源码">
            {activeCode || codeQuery.data?.code || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="产品">
            {batchQuery.data?.cropName ?? batchQuery.data?.cropId ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="农场">{currentFarm?.farmName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="品种">
            {batchQuery.data?.cropVariety ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="地块">
            {batchQuery.data?.plotName ?? batchQuery.data?.plotId ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="批次">
            {batchQuery.data?.batchNo ?? (effectiveBatchId || '—')}
          </Descriptions.Item>
          <Descriptions.Item label="采收数量">
            {batchQuery.data
              ? `${batchQuery.data.quantity ?? 0}${batchQuery.data.unit ?? ''}`
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="质量等级">
            {batchQuery.data?.grade ? <Tag color="blue">{batchQuery.data.grade} 级</Tag> : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="采收日期">
            {formatDate(batchQuery.data?.harvestDate)}
          </Descriptions.Item>
        </Descriptions>
        {codeQuery.isError && (
          <Alert
            style={{ marginTop: 12 }}
            type="warning"
            showIcon
            message={`溯源码 ${activeCode} 查询失败，可能不存在或已作废`}
          />
        )}
      </Card>

      {renderContent()}
    </PageContainer>
  )
}
