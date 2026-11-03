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
 * 【存证口径 2026-11-01 再次修订】
 *
 * 存证表只有一张：{@code agri_prod_chain_record}。它有两个读入口，别误当成两套数据：
 *   · {@code GET /blockchain/by-biz} —— 按业务键单查（本页给采收 / 质检节点用）；
 *   · {@code GET /trace/full-chain/{batchId}/nodes} —— 后端聚合链路时**已把每个节点的
 *     attested / onChain / chainStatus / txHash / blockNumber / failedReason 一并给出**，
 *     本页的溯源码节点直接用这份（它是"这个码自己的"存证，而不是查询框里那一个码的）。
 *
 * 后端在 2026-11-01 之前给的是代理判断：采收节点 onChain = "批次有没有码"、其余节点一律 false、
 * txHash 全空 —— 于是同一批次在属主页与监管核验页能得出两个结论，现在两边共用一处判定。
 *
 * 三态 / 四态口径（**不是**「未接入」，那措辞已废弃）：
 *   已上链 = 存证 SUCCESS；待上链 = 已提交未出块（PENDING）；存证失败 = FAILED（带原因）；
 *   无存证记录 = 查过存证表、该业务没有记录。
 * 存证表覆盖四类业务：HARVEST（批次号）/ QUALITY（质检单号）/ TRACE（溯源码）/ INPUT（使用记录 ID）。
 * 种植、入库、出库没有存证环节，它们的真实结论是「无存证记录」（不是"能力未接入"）。
 *
 * ⚠️ 本部署是**模拟链**（chainType=SIMULATED、交易哈希带 SIMU 前缀）：这里的"已上链"只表示
 *    存证表里有一条 SUCCESS 记录，不是公链完整性校验，页面必须点明。
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
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
import { listBlockchainByBiz } from '@/api/blockchain'
import type {
  BlockchainBizRecord,
  GrowthRecord,
  InputUsage,
  InventoryFlow,
  RawInspection,
  TraceFullChainNode,
} from '@/types'

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
   * 是否已上链（按存证表 `agri_prod_chain_record` 的真实记录推导，不是本地估算）。
   * - true  = 存证记录 chainStatus === SUCCESS（已出块，带 txHash / blockNumber）
   * - false = 有记录但没出块：PENDING 待上链，或 FAILED 已失败（看 chainStatus / failReason）
   * - null  = **查过存证表、没有该业务单号的存证记录**（区别于「未接入」：能力是通的，只是没记录）
   */
  onChain: boolean | null
  /** 存证状态原值：PENDING / SUCCESS / FAILED（null 时没有） */
  chainStatus?: string
  /** 上链交易哈希（SUCCESS 记录才有值，PENDING / FAILED 为 null） */
  txHash?: string
  /** 区块高度（SUCCESS 记录才有值；后端序列化为字符串，展示前已 String() 归一） */
  blockHeight?: string
  /** 上链失败原因（FAILED 才有） */
  failReason?: string
  /** 链类型：本部署为 SIMULATED（模拟链），出参带了就透出来 */
  chainType?: string
}

/**
 * 「无存证记录」的口径说明。
 *
 * 与旧版「未接入」的关键区别：存证域是通的、也查过了，结论是**这条业务没有存证**，
 * 而不是「系统没接这个能力」。两者对运营的动作指引完全相反。
 */
const NO_ANCHOR_TIP =
  '已查询存证表（agri_prod_chain_record），该业务单号没有链上存证记录。存证表覆盖 HARVEST / QUALITY(INSPECTION) / TRACE / INPUT 四类业务；种植、入库、出库没有存证环节'

/** FAILED 与其他未出块状态的措辞不同：失败是有原因的，不能都写成「待上链」 */
function chainLabel(item: Pick<ChainNode, 'onChain' | 'chainStatus'>): string {
  if (item.onChain === null) return '无存证记录'
  if (item.onChain === true) return '已上链'
  return item.chainStatus === 'FAILED' ? '存证失败' : '待上链'
}

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
 * 由存证记录（/blockchain/by-biz 的形状）推导节点的上链状态。
 *
 * @param record 存证记录；undefined 表示「查过存证表但没有该单号的记录」
 * @returns onChain（true 已上链 / false 有记录但未出块 / null 无存证记录）+ 链上明细
 */
function resolveAnchor(record: BlockchainBizRecord | undefined): {
  onChain: boolean | null
  chainStatus?: string
  txHash?: string
  blockHeight?: string
  failReason?: string
  chainType?: string
} {
  if (!record) {
    return { onChain: null }
  }
  const txHash = record.txHash ?? undefined
  return {
    onChain: record.status === 'SUCCESS',
    chainStatus: record.status ?? undefined,
    txHash,
    // 后端把 blockHeight 序列化成字符串（"12884201"），统一转字符串避免类型泄漏
    blockHeight: record.blockHeight == null ? undefined : String(record.blockHeight),
    failReason: record.failReason ?? undefined,
    chainType: record.chainType ?? undefined,
  }
}

/**
 * 后端 /trace/full-chain/{batchId}/nodes 的节点自 2026-11-01 起已带链上凭证
 * （与监管核验视图同一处判定），这里只做形状转换，**不再由前端二次关联存证域** ——
 * 同一个事实在两处判定，就会出现"属主页说已上链、核验页说没上链"。
 */
function nodeAnchor(node: TraceFullChainNode): ReturnType<typeof resolveAnchor> {
  if (node.attested !== true) {
    return { onChain: null }
  }
  return {
    onChain: node.onChain === true,
    chainStatus: node.chainStatus ?? undefined,
    txHash: node.txHash ?? undefined,
    blockHeight: node.blockNumber == null ? undefined : String(node.blockNumber),
    failReason: node.failedReason ?? undefined,
    chainType: node.chainType ?? undefined,
  }
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

  /**
   * 存证域关联键。
   *
   * ⚠️ 三个 bizType 的 bizNo 口径不同，且 HARVEST 必须传 **batch_no 不是 batch_id**：
   * 实测 `bizNo=DEMO-BATCH-001` 返回 []，同批次的 `DEMO-BATCHN-001` 才有数据。
   */
  const harvestBatchNo = batchQuery.data?.batchNo ?? ''

  /** 存证域：HARVEST 类存证（bizNo = 批次号） */
  const harvestAnchorQuery = useQuery({
    queryKey: ['blockchain-by-biz', 'HARVEST', harvestBatchNo],
    enabled: Boolean(harvestBatchNo),
    retry: false,
    queryFn: () => listBlockchainByBiz({ bizType: 'HARVEST', bizNo: harvestBatchNo }),
  })

  /** 本批次质检单号列表（INSPECTION 类存证按单号逐条查） */
  const inspectionNos = useMemo<string[]>(
    () =>
      (inspectionQuery.data ?? [])
        .map((item: RawInspection) => String(item.inspectionNo ?? item.inspectionId ?? ''))
        .filter((item) => item !== ''),
    [inspectionQuery.data],
  )

  /** 存证域：INSPECTION 类存证（质检单可能有多个，按单号并发查） */
  const inspectionAnchorQueries = useQueries({
    queries: inspectionNos.map((bizNo) => ({
      queryKey: ['blockchain-by-biz', 'INSPECTION', bizNo],
      enabled: Boolean(bizNo),
      retry: false,
      queryFn: () => listBlockchainByBiz({ bizType: 'INSPECTION' as const, bizNo }),
    })),
  })

  /** 业务单号 → 存证记录（同单号多条时取第一条） */
  const anchorMap = useMemo(() => {
    const map = new Map<string, BlockchainBizRecord>()
    const collect = (list: BlockchainBizRecord[] | undefined): void => {
      ;(list ?? []).forEach((record) => {
        const key = String(record.bizNo ?? '')
        if (key !== '' && !map.has(key)) {
          map.set(key, record)
        }
      })
    }
    collect(harvestAnchorQuery.data)
    inspectionAnchorQueries.forEach((query) => collect(query.data))
    return map
  }, [harvestAnchorQuery.data, inspectionAnchorQueries])

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
        // 种植记录在存证表里没有对应业务类型 → 无存证记录
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
        // 投入品使用有存证业务类型（INPUT，业务键=使用记录 ID）；没记录就是"无存证记录"
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
        // INSPECTION 类存证，bizNo = 质检单号
        ...resolveAnchor(
          anchorMap.get(String(item.inspectionNo ?? item.inspectionId ?? '')),
        ),
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
        // HARVEST 类存证，bizNo = 批次号（batchNo，不是 batchId）
        ...resolveAnchor(anchorMap.get(harvestBatchNo)),
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
        // 存证域无入库业务类型 → 无存证记录
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
        // 存证域无流通业务类型 → 无存证记录
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

    // 溯源码节点（后端全链路接口返回，链上凭证由后端按存证表判定，前端不再二次关联）
    ;(nodesQuery.data ?? [])
      .filter((node) => node.nodeType === 'trace')
      .forEach((node, index) => {
        nodes.push({
          key: `trace-${node.refId ?? index}`,
          stage: 'trace',
          title: `${node.nodeName ?? '溯源码'} - ${node.refNo ?? '—'}`,
          time: node.occurredAt,
          timeText: formatTime(node.occurredAt),
          operator: node.operatorName,
          detail: node.description ?? `节点类型 ${node.nodeType}`,
          ...nodeAnchor(node),
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
    anchorMap,
    activeCode,
    harvestBatchNo,
  ])

  /**
   * 存证统计（全部来自存证表真实记录：节点自带的链上凭证 + by-biz 查询，不做本地估算）。
   *
   * `onChain` 是**真实条数**，0 就是 0 —— 0 是一个合法且真实的结论，不需要降级成「—」。
   * `failed` 单独数出来：FAILED 与 PENDING 都是"没出块"，但一个是等出块、一个是要人工重试，
   * 混在一个数字里就等于把失败说没了。
   */
  const chainStats = useMemo(() => {
    const total = chainNodes.length
    const anchored = chainNodes.filter((item) => item.onChain !== null).length
    const onChain = chainNodes.filter((item) => item.onChain === true).length
    const failed = chainNodes.filter((item) => item.onChain === false && item.chainStatus === 'FAILED').length
    const pending = chainNodes.filter((item) => item.onChain === false && item.chainStatus !== 'FAILED').length
    return { total, anchored, onChain, pending, failed }
  }, [chainNodes])

  /** 存证查询是否仍在进行（进行中不渲染结论，避免把「还没查到」显示成「无记录」） */
  const anchorLoading =
    harvestAnchorQuery.isFetching ||
    inspectionAnchorQueries.some((query) => query.isFetching)

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
    const header = ['环节', '节点', '时间', '操作人', '记录详情', '存证状态', '交易哈希', '失败原因']
    const body = chainNodes.map((item) =>
      [
        STAGE_META[item.stage].title,
        item.title,
        item.timeText,
        item.operator ?? '—',
        item.detail ?? '—',
        chainLabel(item),
        item.txHash ?? '',
        item.failReason ?? '',
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
    flowQuery.isFetching ||
    anchorLoading

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
          type="info"
          showIcon
          message="存证状态口径说明：上链状态取自存证表 agri_prod_chain_record，按「批次号(HARVEST) / 质检单号(QUALITY) / 溯源码(TRACE) / 使用记录 ID(INPUT)」关联；本部署为模拟链（chainType=SIMULATED），已上链只代表存证表里有一条 SUCCESS 记录，不是公链完整性校验。已上链=SUCCESS、待上链=PENDING、存证失败=FAILED（带原因）、无存证记录=查过但没有匹配记录。种植 / 入库 / 出库没有存证环节，显示为无存证记录"
        />
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic title="全链路节点" value={chainStats.total} suffix="条" />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <MetricStatistic
                title="已上链"
                value={chainStats.anchored === 0 ? null : chainStats.onChain}
                suffix="条"
                missingTip="本批次下没有任何节点命中存证记录（存证表覆盖 HARVEST / QUALITY / TRACE / INPUT 四类业务），因此无法统计已上链条数"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="未出块 / 失败"
                value={`${chainStats.pending} / ${chainStats.failed}`}
                valueStyle={{ color: chainStats.failed > 0 ? '#ff4d4f' : '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="验证状态"
                value={
                  chainStats.anchored === 0
                    ? '无存证记录'
                    : chainStats.failed > 0
                      ? `存证失败 ${chainStats.failed} 条`
                      : chainStats.onChain === chainStats.anchored
                        ? '通过'
                        : `部分上链 ${chainStats.onChain}/${chainStats.anchored}`
                }
                valueStyle={{
                  color:
                    chainStats.anchored === 0
                      ? '#bfbfbf'
                      : chainStats.failed > 0
                        ? '#ff4d4f'
                        : chainStats.onChain === chainStats.anchored
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
                        <Tooltip title={NO_ANCHOR_TIP}>
                          <Tag color="default">无存证记录</Tag>
                        </Tooltip>
                      ) : item.onChain ? (
                        <Tooltip title={item.chainType === 'SIMULATED' ? '模拟链存证（本部署不连真链）' : undefined}>
                          <Tag color="green">🔗 已上链</Tag>
                        </Tooltip>
                      ) : item.chainStatus === 'FAILED' ? (
                        <Tooltip title={item.failReason || '存证记录状态 FAILED，未给出原因'}>
                          <Tag color="red">⚠ 存证失败</Tag>
                        </Tooltip>
                      ) : (
                        <Tag>⏳ 待上链</Tag>
                      )}
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      <Typography.Text type="secondary">
                        操作人：{item.operator ?? '—'}
                        {item.detail ? ` · ${item.detail}` : ''}
                        {item.txHash ? ` · 交易哈希 ${item.txHash}` : ''}
                        {item.blockHeight ? ` · 区块高度 ${item.blockHeight}` : ''}
                        {item.chainStatus === 'FAILED' && !item.txHash
                          ? ` · ${item.failReason || '存证失败，未生成交易哈希'}`
                          : ''}
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
