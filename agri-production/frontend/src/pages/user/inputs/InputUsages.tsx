import ProTable from '@/components/ProductionTable'
import Card from '@/components/SectionCard'
import './inputs.css'
/**
 * 页面名称：使用记录
 * 路由路径：/production/inputs?tab=ledger（旧 /production/inputs/usages 自动跳转）
 * 所属模块：农资管理
 * PRD 序号：PRD 6.1 #22「使用记录」（原型未覆盖，按 PRD 7.2 与 11.2.4 实现）
 *
 * 实现要点：
 * - 统一台账：使用记录与入库 / 退回 / 盘点等库存业务在同一列表按时间倒序展示
 * - 领用流水已归并使用记录，避免同一次使用在列表中重复出现
 * - 用量合规校验：超过登记上限（推荐剂量上限）标红提示（R-INPUT-04）
 * - 合规列：四项校验（禁用 / 用量 / 休药期 / 累计用量）取最严结论
 * - 上链列：展示链上状态，支持手动提交存证（业务类型 INPUT = 投入品使用，服务端按 usageId 校验记录真实存在）
 * - 支持按投入品 / 地块 / 任务 / 日期区间筛选，新建使用记录与导出
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import { DownloadOutlined, PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import { listPlots } from '@/api/plots'
import { listMembers } from '@/api/members'
import { fetchTaskPage } from '@/api/tasks'
import {
  createUsage,
  pageAllStockFlows,
  pageInputs,
  pageUsages,
  removeUsage,
} from '@/api/inputs'
import type { InputInfo, InputStockFlow } from '@/api/inputs'
import { listChainRecords, submitChain } from '@/api/blockchain'
import type { InputUsageRecord, Member, Plot, Task } from '@/types'
import { MISSING_VALUE_TEXT, MetricText } from '@/components/MetricStatistic'
import {
  DOSAGE_UNIT_OPTIONS,
  USAGE_METHOD_OPTIONS,
  categoryMeta,
  checkCompliance,
  downloadCsv,
  fmtDate,
  fmtNumber,
  flowTypeMeta,
  recommendDosage,
  summarizeCompliance,
} from './shared'
import type { ComplianceItem, ComplianceLevel } from './shared'

/** 筛选条件 */
interface UsageFilters {
  /** 使用记录 ID（从存证列表带 `?usageId=` 跳进来时用） */
  usageId?: string
  /** 投入品 ID */
  inputId?: string
  /** 地块 ID */
  plotId?: string
  /** 关联任务 ID */
  taskId?: string
  /** 统一台账类型：全部 / 使用 / 库存业务编码 */
  ledgerType?: 'all' | 'usage' | number
  /** 库存流水批次号 */
  batchNo?: string
  /** 日期区间 */
  dateRange?: [Dayjs, Dayjs]
}

/** 使用记录行（含派生字段） */
interface UsageRow {
  /** 原始记录 */
  usage: InputUsageRecord
  /** 关联投入品 */
  input?: InputInfo
  /** 地块名 */
  plotName: string
  /** 任务名 */
  taskName: string
  /** 四项合规校验 */
  items: ComplianceItem[]
  /** 整体合规等级 */
  level: ComplianceLevel
  /** 推荐剂量上限 */
  recommendMax?: number
  /** 是否超量 */
  overdose: boolean
}

/** 合并台账中的一行：使用记录或非领用类库存流水 */
interface LedgerEventRow {
  /** React / ProTable 行键 */
  eventKey: string
  /** 记录来源 */
  kind: 'usage' | 'flow'
  /** 业务发生时间 */
  time: string
  /** 使用记录及其合规派生字段 */
  usageRow?: UsageRow
  /** 库存业务流水 */
  flow?: InputStockFlow
}

/** 新建使用记录表单值 */
interface CreateUsageForm {
  inputId?: string
  plotId?: string
  taskId?: string
  dosage?: number
  unit?: string
  method?: string
  operatorId?: string
  usedAt?: Dayjs
  safetyIntervalDays?: number
}

/** 日期归一：截取 yyyy-MM-dd 前缀 */
function dateKey(value?: string): string {
  return (value ?? '').slice(0, 10)
}

/** 用量缺失时的提示语（dosage 为空不填 0，按全站缺失值口径显示「—」） */
const DOSAGE_MISSING_TIP = '该记录未登记用量（dosage 为空），显示为「—」，不填 0'

/**
 * 用量数值判空。
 *
 * 后端 `InputUsageEntity.dosage` 是 BigDecimal，允许为 NULL。
 *
 * @param dosage 用量
 * @returns 是否为缺失值
 */
function isDosageMissing(dosage?: number | null): boolean {
  return dosage === undefined || dosage === null || Number.isNaN(dosage)
}

/**
 * 用量纯文本（导出 CSV 等不能渲染 React 节点的位置使用）。
 *
 * @param dosage 用量
 * @param unit 单位
 * @returns 「1360.00 kg」，缺失时返回「—」
 */
function dosageText(dosage?: number | null, unit?: string | null): string {
  if (isDosageMissing(dosage)) return MISSING_VALUE_TEXT
  const unitPart = unit ? ` ${unit}` : ''
  return `${fmtNumber(dosage)}${unitPart}`
}

/**
 * 投入品使用记录页
 *
 * 业务职责：投入品田间使用台账，含用量合规校验、上链存证与新建登记。
 *
 * @returns 页面内容
 */
export default function InputUsages(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  /** 支持存证列表带 `?usageId=<使用记录 ID>` 跳进来（存证的 target_code 就是这个 ID） */
  const [searchParams, setSearchParams] = useSearchParams()
  const linkedUsageId = searchParams.get('usageId') ?? ''
  /** 从地块详情进入时按地块过滤，并可自动打开新增弹窗 */
  const presetPlotId = searchParams.get('plotId') ?? undefined
  const [filters, setFilters] = useState<UsageFilters>(() =>
    linkedUsageId
      ? { usageId: linkedUsageId }
      : presetPlotId
        ? { plotId: presetPlotId }
        : {},
  )
  const [filterForm] = Form.useForm<UsageFilters>()
  const [createForm] = Form.useForm<CreateUsageForm>()
  const [createOpen, setCreateOpen] = useState<boolean>(false)

  useEffect(() => {
    // 支持两种入口：地块详情带 plotId 直接预填；农资台账「使用登记」只带 create=1
    if (searchParams.get('create') !== '1') return
    createForm.setFieldsValue(presetPlotId ? { plotId: presetPlotId } : {})
    setCreateOpen(true)
    // create=1 是一次性深链参数，消费后从 URL 移除，刷新不会再次弹窗
    const params = new URLSearchParams(searchParams)
    params.delete('create')
    setSearchParams(params, { replace: true })
  }, [presetPlotId, searchParams, createForm, setSearchParams])

  /** 使用记录 */
  const usagesQuery = useQuery({
    queryKey: ['production-inputs', 'usages'],
    queryFn: () => pageUsages({ pageNum: 1, pageSize: 500 }),
  })

  /**
   * 库存业务流水。
   *
   * <p>type=2 的领用流水由同一次「登记使用记录」事务生成，已在使用记录行中体现，
   * 合并台账时剔除，避免同一个田间动作显示两遍。其余入库、退回、盘盈、盘亏、报损
   * 作为独立业务行进入同一列表。</p>
   */
  const flowsQuery = useQuery({
    queryKey: ['production-inputs', 'stock-flows', 'unified-ledger'],
    queryFn: () => pageAllStockFlows({ pageNum: 1, pageSize: 2000 }),
  })

  /** 投入品档案 */
  const inputsQuery = useQuery({
    queryKey: ['production-inputs', 'archive'],
    queryFn: () => pageInputs({ pageNum: 1, pageSize: 500 }),
  })

  /** 地块下拉 */
  const plotsQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 成员下拉 */
  const membersQuery = useQuery({
    queryKey: ['member-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listMembers({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 任务下拉 */
  const tasksQuery = useQuery({
    queryKey: ['task-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => fetchTaskPage({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 链上存证（业务类型 INPUT = 投入品使用；历史上是数字 2，服务端已下线该写法） */
  const chainQuery = useQuery({
    queryKey: ['blockchain', 'records', 'input-usage'],
    queryFn: () => listChainRecords({ bizType: 'INPUT', pageNum: 1, pageSize: 200 }),
  })

  /** 统一刷新 */
  const invalidateAll = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['production-inputs'] })

  /** 新建使用记录 */
  const createMutation = useMutation({
    mutationFn: (values: CreateUsageForm) =>
      createUsage({
        inputId: values.inputId,
        inputName: inputsQuery.data?.list?.find((item) => item.inputId === values.inputId)
          ?.inputName,
        plotId: values.plotId,
        taskId: values.taskId,
        dosage: values.dosage,
        unit: values.unit ?? 'kg/亩',
        method: values.method,
        operatorId: values.operatorId,
        usedAt: values.usedAt ? values.usedAt.format('YYYY-MM-DDTHH:mm:ss') : undefined,
        safetyIntervalDays: values.safetyIntervalDays,
        status: 1,
      }),
    onSuccess: () => {
      message.success('使用记录已登记，已生成领用流水并扣减库存')
      setCreateOpen(false)
      createForm.resetFields()
      void invalidateAll()
    },
  })

  /** 删除使用记录 */
  const deleteMutation = useMutation({
    mutationFn: (usageId: string) => removeUsage(usageId),
    onSuccess: () => {
      message.success('使用记录已删除')
      void invalidateAll()
    },
  })

  /**
   * 提交上链（业务类型 INPUT，业务键 = 使用记录 ID）。
   *
   * 服务端会先按当前经营主体核对这条使用记录真实存在，不存在/不属于本主体一律拒绝；
   * 失败必须显式报错（否则点了按钮没反应，人只会以为"网络慢"）。
   * 成功话术按返回的真实状态说：本部署是模拟链，写入即 SUCCESS。
   */
  const chainMutation = useMutation({
    mutationFn: (usageId: string) =>
      submitChain({ bizId: usageId, bizType: 'INPUT', bizSummary: '投入品使用记录存证' }),
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

  const inputMap = useMemo<Map<string, InputInfo>>(() => {
    const map = new Map<string, InputInfo>()
    ;(inputsQuery.data?.list ?? []).forEach((item) => map.set(item.inputId, item))
    return map
  }, [inputsQuery.data])

  const plotMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    ;(plotsQuery.data?.list ?? []).forEach((plot: Plot) => map.set(plot.plotId, plot.plotName))
    return map
  }, [plotsQuery.data])

  const taskMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    ;(tasksQuery.data?.list ?? []).forEach((task: Task) =>
      map.set(task.taskId, task.taskName ?? task.taskNo ?? task.taskId),
    )
    return map
  }, [tasksQuery.data])

  const inputOptions = useMemo(
    () =>
      (inputsQuery.data?.list ?? []).map((item) => ({
        value: item.inputId,
        label: item.inputName ?? item.inputId,
      })),
    [inputsQuery.data],
  )

  const plotOptions = useMemo(
    () =>
      (plotsQuery.data?.list ?? []).map((plot: Plot) => ({
        value: plot.plotId,
        label: plot.plotName,
      })),
    [plotsQuery.data],
  )

  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.list ?? []).map((member: Member) => ({
        value: member.memberId,
        label: member.realName,
      })),
    [membersQuery.data],
  )

  const taskOptions = useMemo(
    () =>
      (tasksQuery.data?.list ?? []).map((task: Task) => ({
        value: task.taskId,
        label: task.taskName ?? task.taskNo ?? task.taskId,
      })),
    [tasksQuery.data],
  )

  /**
   * 已出块的存证业务键集合。
   *
   * 两处都得比字符串：后端把业务键与状态都序列化成字符串（`bizNo='102'`、`status='SUCCESS'`），
   * 旧版写的是 `record.status === 3` 与 `set.add(record.bizId)` 配 `set.has(usage.usageId)`（number），
   * 类型不匹配不报错、结果永远是 false —— 明明存过证的记录被显示成"未上链"。
   */
  const chainedBizIds = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    ;(chainQuery.data?.list ?? []).forEach((record) => {
      if (record.status === 'SUCCESS') set.add(String(record.bizNo ?? record.bizId ?? ''))
    })
    return set
  }, [chainQuery.data])

  /** 使用记录行（含合规校验与超量判定） */
  const usageRows = useMemo<UsageRow[]>(() => {
    const start = filters.dateRange?.[0]?.format('YYYY-MM-DD')
    const end = filters.dateRange?.[1]?.format('YYYY-MM-DD')
    return (usagesQuery.data?.list ?? [])
      .filter((usage) => {
        if (
          filters.ledgerType &&
          filters.ledgerType !== 'all' &&
          filters.ledgerType !== 'usage'
        ) {
          return false
        }
        // 使用记录没有批次字段；指定流水批次时只展示对应库存业务
        if (filters.batchNo?.trim()) return false
        if (filters.usageId && String(usage.usageId) !== String(filters.usageId)) return false
        if (filters.inputId && usage.inputId !== filters.inputId) return false
        if (filters.plotId && usage.plotId !== filters.plotId) return false
        if (filters.taskId && usage.taskId !== filters.taskId) return false
        if (start && dateKey(usage.usedAt) < start) return false
        if (end && dateKey(usage.usedAt) > end) return false
        return true
      })
      .map((usage) => {
        const input = usage.inputId ? inputMap.get(usage.inputId) : undefined
        const name = usage.inputName ?? input?.inputName
        const range = recommendDosage(name)
        const items = checkCompliance({
          inputName: name,
          inputType: input?.inputType,
          safetyInterval: usage.safetyIntervalDays ?? input?.safetyInterval,
          dosage: usage.dosage,
          unit: usage.unit,
          lastUsedAt: usage.usedAt,
          cumulativeDosage: usage.dosage,
        })
        return {
          usage,
          input,
          plotName: (usage.plotId ? plotMap.get(usage.plotId) : undefined) || usage.plotId || '-',
          taskName: (usage.taskId ? taskMap.get(usage.taskId) : undefined) || usage.taskId || '-',
          items,
          level: summarizeCompliance(items),
          recommendMax: range?.max,
          overdose: Boolean(range && usage.dosage !== undefined && usage.dosage > range.max),
        }
      })
      .sort((a, b) => String(b.usage.usedAt ?? '').localeCompare(String(a.usage.usedAt ?? '')))
  }, [usagesQuery.data, inputMap, plotMap, taskMap, filters])

  /** 使用记录 + 库存业务合并后的唯一台账行 */
  const ledgerEvents = useMemo<LedgerEventRow[]>(() => {
    const start = filters.dateRange?.[0]?.format('YYYY-MM-DD')
    const end = filters.dateRange?.[1]?.format('YYYY-MM-DD')
    const batchKeyword = filters.batchNo?.trim().toLowerCase()

    const usageEvents: LedgerEventRow[] = usageRows.map((row) => ({
      eventKey: `usage-${row.usage.usageId}`,
      kind: 'usage',
      time: row.usage.usedAt ?? '',
      usageRow: row,
    }))

    const flowEvents: LedgerEventRow[] = (flowsQuery.data?.list ?? [])
      .filter((flow) => {
        // 领用流水由使用记录承载，不在合并列表中重复展示
        if (flow.flowType === 2) return false
        if (
          filters.ledgerType &&
          filters.ledgerType !== 'all' &&
          filters.ledgerType !== 'usage' &&
          flow.flowType !== filters.ledgerType
        ) {
          return false
        }
        if (filters.ledgerType === 'usage') return false
        if (filters.inputId && flow.inputId !== filters.inputId) return false
        // 库存流水没有地块字段；选择地块时只保留能定位到地块的使用记录
        if (filters.plotId) return false
        if (filters.taskId && flow.relatedTaskId !== filters.taskId) return false
        if (batchKeyword && !(flow.batchNo ?? '').toLowerCase().includes(batchKeyword)) return false
        const day = dateKey(flow.createdAt)
        if (start && day < start) return false
        if (end && day > end) return false
        return true
      })
      .map((flow) => ({
        eventKey: `flow-${flow.flowId}`,
        kind: 'flow',
        time: flow.createdAt ?? '',
        flow,
      }))

    return [...usageEvents, ...flowEvents].sort((left, right) =>
      String(right.time).localeCompare(String(left.time)),
    )
  }, [usageRows, flowsQuery.data, filters])

  /** 统计 */
  const stats = useMemo(() => {
    const plots = new Set<string>()
    usageRows.forEach((row) => {
      if (row.usage.plotId) plots.add(row.usage.plotId)
    })
    return {
      total: usageRows.length,
      plotCount: plots.size,
      overdose: usageRows.filter((row) => row.overdose).length,
      chained: usageRows.filter((row) => chainedBizIds.has(String(row.usage.usageId))).length,
      stockBusiness: ledgerEvents.filter((event) => event.kind === 'flow').length,
    }
  }, [usageRows, ledgerEvents, chainedBizIds])

  const pagedEvents = useMemo<LedgerEventRow[]>(
    () => ledgerEvents.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [ledgerEvents, pageNum, pageSize],
  )

  /** 查询 */
  const handleSearch = (): void => {
    setPageNum(1)
    setFilters(filterForm.getFieldsValue())
  }

  /** 重置 */
  const handleReset = (): void => {
    filterForm.resetFields()
    setPageNum(1)
    setFilters({})
  }

  /** 导出 */
  const handleExport = (): void => {
    if (ledgerEvents.length === 0) {
      message.warning('暂无可导出的数据')
      return
    }
    downloadCsv(
      '投入品使用与库存台账',
      [
        '业务时间',
        '台账类型',
        '投入品',
        '投入品类型',
        '地块',
        '关联任务',
        '数量 / 用量',
        '批次号',
        '有效期至',
        '操作人',
        '合规结论',
        '上链',
        '备注',
      ],
      ledgerEvents.map((event) => {
        const usage = event.usageRow
        const flow = event.flow
        const input = usage?.input ?? (flow?.inputId ? inputMap.get(flow.inputId) : undefined)
        const flowMeta = flow ? flowTypeMeta(flow.flowType) : undefined
        return [
          fmtDate(event.time, 'YYYY-MM-DD HH:mm'),
          usage ? '使用' : (flowMeta?.label ?? '库存业务'),
          usage?.usage.inputName ?? usage?.input?.inputName ?? flow?.inputName ?? input?.inputName ?? '-',
          categoryMeta(input?.inputType).label,
          usage?.plotName ?? '-',
          usage?.taskName ??
            (flow?.relatedTaskId
              ? taskMap.get(flow.relatedTaskId) ?? flow.relatedTaskId
              : '-'),
          usage
            ? dosageText(usage.usage.dosage, usage.usage.unit)
            : `${flowMeta?.direction === 1 ? '+' : '-'}${fmtNumber(Math.abs(flow?.qty ?? 0))} ${
                flow?.inputUnit ?? input?.unit ?? ''
              }`.trim(),
          flow?.batchNo ?? '',
          fmtDate(flow?.expireDate),
          usage?.usage.operatorId ?? flow?.operatorId ?? '',
          usage
            ? usage.items.map((item) => `${item.label}:${item.result}`).join('；')
            : '-',
          usage
            ? chainedBizIds.has(String(usage.usage.usageId))
              ? '已上链'
              : '未上链'
            : '-',
          usage?.usage.method ?? flow?.remark ?? '',
        ]
      }),
    )
  }

  /** 合并台账列定义 */
  const columns: ProColumns<LedgerEventRow>[] = [
    {
      title: '业务时间',
      key: 'time',
      width: 160,
      render: (_, record) => fmtDate(record.time, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '台账类型',
      key: 'ledgerType',
      width: 100,
      render: (_, record) => {
        if (record.kind === 'usage') return <Tag color="blue">使用</Tag>
        const meta = flowTypeMeta(record.flow?.flowType)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '投入品',
      key: 'inputName',
      width: 160,
      render: (_, record) => {
        const usage = record.usageRow
        const flow = record.flow
        const inputId = usage?.usage.inputId ?? flow?.inputId
        const inputName =
          usage?.usage.inputName ??
          usage?.input?.inputName ??
          flow?.inputName ??
          (flow?.inputId ? inputMap.get(flow.inputId)?.inputName : undefined) ??
          inputId ??
          '-'
        return (
          <Typography.Link onClick={() => navigate(`/production/inputs/${inputId ?? ''}`)}>
            {inputName}
          </Typography.Link>
        )
      },
    },
    {
      title: '投入品类型',
      key: 'category',
      width: 100,
      render: (_, record) => {
        const input =
          record.usageRow?.input ??
          (record.flow?.inputId ? inputMap.get(record.flow.inputId) : undefined)
        const meta = categoryMeta(input?.inputType)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '数量 / 用量',
      key: 'quantity',
      width: 160,
      render: (_, record) => {
        const usage = record.usageRow
        if (usage) {
          const unit = usage.usage.unit ?? ''
          const suffix = unit ? ` ${unit}` : ''
          const rawDosage = usage.usage.dosage
          const dosageValue: number | null =
            rawDosage === undefined || rawDosage === null || Number.isNaN(rawDosage)
              ? null
              : rawDosage
          const metric = (
            <MetricText
              value={dosageValue}
              precision={2}
              suffix={suffix}
              missingTip={DOSAGE_MISSING_TIP}
            />
          )
          if (!usage.overdose) return metric
          return (
            <Tooltip
              title={`超过登记上限 ${usage.recommendMax ?? MISSING_VALUE_TEXT}${suffix}，需农艺师确认（R-INPUT-04）`}
            >
              <Typography.Text strong type="danger">
                {metric} ⚠️ 超量
              </Typography.Text>
            </Tooltip>
          )
        }
        const flow = record.flow
        const meta = flowTypeMeta(flow?.flowType)
        const input = flow?.inputId ? inputMap.get(flow.inputId) : undefined
        return (
          <Typography.Text type={meta.direction === 1 ? 'success' : 'danger'}>
            {meta.direction === 1 ? '+' : '-'}
            {fmtNumber(Math.abs(flow?.qty ?? 0))} {flow?.inputUnit ?? input?.unit ?? ''}
          </Typography.Text>
        )
      },
    },
    {
      title: '地块',
      key: 'plotName',
      width: 110,
      render: (_, record) => record.usageRow?.plotName ?? '-',
    },
    {
      title: '关联任务',
      key: 'taskName',
      width: 150,
      ellipsis: true,
      render: (_, record) => {
        if (record.usageRow) return record.usageRow.taskName
        const taskId = record.flow?.relatedTaskId
        return taskId ? taskMap.get(taskId) ?? taskId : '-'
      },
    },
    {
      title: '批次号',
      key: 'batchNo',
      width: 130,
      render: (_, record) => record.flow?.batchNo ?? '-',
    },
    {
      title: '有效期至',
      key: 'expireDate',
      width: 115,
      render: (_, record) => fmtDate(record.flow?.expireDate),
    },
    {
      title: '操作人',
      key: 'operatorId',
      width: 105,
      render: (_, record) => record.usageRow?.usage.operatorId ?? record.flow?.operatorId ?? '-',
    },
    {
      title: '合规',
      key: 'compliance',
      width: 115,
      render: (_, record) => {
        const usage = record.usageRow
        if (!usage) return '-'
        const meta = {
          pass: { icon: '✅', color: 'green', label: '通过' },
          warning: { icon: '⚠️', color: 'orange', label: '预警' },
          blocked: { icon: '❌', color: 'red', label: '拦截' },
        }[usage.level]
        return (
          <Tooltip title={usage.items.map((item) => `${item.label}：${item.result}`).join('；')}>
            <Tag color={meta.color}>
              {meta.icon} {meta.label}
            </Tag>
          </Tooltip>
        )
      },
    },
    {
      title: '上链',
      key: 'chain',
      width: 105,
      render: (_, record) => {
        const usage = record.usageRow
        if (!usage) return '-'
        return chainedBizIds.has(String(usage.usage.usageId)) ? (
          <Tooltip title="模拟链（chainType=SIMULATED）存证 SUCCESS，交易哈希见存证记录">
            <Tag color="green">🔗 已上链</Tag>
          </Tooltip>
        ) : (
          <Button
            size="small"
            icon={<SafetyCertificateOutlined />}
            loading={chainMutation.isPending}
            onClick={() => chainMutation.mutate(usage.usage.usageId)}
          >
            上链
          </Button>
        )
      },
    },
    {
      title: '操作',
      fixed: 'right',
      key: 'option',
      width: 125,
      valueType: 'option',
      render: (_, record) => {
        const usage = record.usageRow
        const inputId = usage?.usage.inputId ?? record.flow?.inputId
        return [
          <Typography.Link
            key="detail"
            onClick={() => navigate(`/production/inputs/${inputId ?? ''}`)}
          >
            详情
          </Typography.Link>,
          ...(usage
            ? [
                <Popconfirm
                  key="delete"
                  title="确认删除该使用记录？"
                  okText="确认删除"
                  cancelText="取消"
                  onConfirm={() => deleteMutation.mutate(usage.usage.usageId)}
                >
                  <Typography.Link type="danger">删除</Typography.Link>
                </Popconfirm>,
              ]
            : []),
        ]
      },
    },
  ]

  const loading = usagesQuery.isFetching || flowsQuery.isFetching || inputsQuery.isFetching
  const isError = usagesQuery.isError || flowsQuery.isError || inputsQuery.isError

  /** 使用台账作业入口（并入农资管理页后放在内容顶部） */
  const actionButtons = (
    <Space wrap>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
        登记使用记录
      </Button>
      <Button icon={<DownloadOutlined />} onClick={handleExport}>
        导出
      </Button>
    </Space>
  )

  return (
    <>
      <div style={{ marginBottom: 16 }}>{actionButtons}</div>
      {filters.usageId ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`正在按存证列表带过来的使用记录 ID 筛选：${filters.usageId}（共 ${stats.total} 条匹配）`}
          action={
            <Button
              size="small"
              onClick={() => {
                setFilters((prev) => ({ ...prev, usageId: undefined }))
                setPageNum(1)
              }}
            >
              看全部
            </Button>
          }
        />
      ) : null}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="台账记录" value={ledgerEvents.length} suffix="条" />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="使用记录" value={stats.total} suffix="条" />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="库存业务" value={stats.stockBusiness} suffix="条" />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="涉及地块" value={stats.plotCount} suffix="个" />
          </Card>
        </Col>
      </Row>

      {stats.overdose > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="error"
          showIcon
          message={`❌ 检出 ${stats.overdose} 条超量使用记录（超过登记上限），需农艺师确认后方可继续提交（R-INPUT-04）`}
        />
      )}

      <Card
        className="input-record-section"
        title="农资使用与库存台账"
        extra={
          <Typography.Text type="secondary">
            使用记录 {stats.total} 条 · 库存业务 {stats.stockBusiness} 条 · 已上链{' '}
            {stats.chained} 条
          </Typography.Text>
        }
      >
        <Form form={filterForm} layout="inline" style={{ rowGap: 12, marginBottom: 12 }}>
          <Form.Item name="ledgerType" label="台账类型">
            <Select
              allowClear
              placeholder="全部台账"
              style={{ width: 120 }}
              options={[
                { value: 'all', label: '全部台账' },
                { value: 'usage', label: '使用记录' },
                { value: 1, label: '入库' },
                { value: 3, label: '退回' },
                { value: 4, label: '盘盈' },
                { value: 5, label: '盘亏' },
                { value: 6, label: '报损' },
              ]}
            />
          </Form.Item>
          <Form.Item name="inputId" label="投入品">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部投入品"
              options={inputOptions}
              style={{ width: 160 }}
            />
          </Form.Item>
          <Form.Item name="plotId" label="地块">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部地块"
              options={plotOptions}
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item name="taskId" label="关联任务">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部任务"
              options={taskOptions}
              style={{ width: 160 }}
            />
          </Form.Item>
          <Form.Item name="batchNo" label="批次号">
            <Input allowClear placeholder="仅筛选库存业务" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="dateRange" label="业务日期">
            <DatePicker.RangePicker allowClear placeholder={['开始日期', '结束日期']} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>

        {isError ? (
          <Empty
            description={
              <Space direction="vertical">
                <Typography.Text type="danger">农资台账加载失败，请稍后重试</Typography.Text>
                <Button onClick={() => void invalidateAll()}>重新加载</Button>
              </Space>
            }
          />
        ) : (
          <ProTable<LedgerEventRow>
            cardProps={false}
            className="input-record-table"
            headerTitle="农资使用与库存台账"
            rowKey="eventKey"
            columns={columns}
            dataSource={pagedEvents}
            loading={loading}
            search={false}
            // 使用记录与库存业务共用一张宽表，窄屏时表格内部横向滚动
            scroll={{ x: 1750 }}
            options={{ reload: () => void invalidateAll(), density: true, setting: true }}
            pagination={{
              current: pageNum,
              pageSize,
              total: ledgerEvents.length,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (nextPage, nextSize) => {
                setPageNum(nextPage)
                setPageSize(nextSize)
              },
            }}
          />
        )}
      </Card>

      <Modal
        title="登记投入品使用记录"
        open={createOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        onOk={() => {
          void createForm.validateFields().then((values) => {
            createMutation.mutate(values)
          })
        }}
        onCancel={() => setCreateOpen(false)}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{ unit: 'kg/亩', usedAt: dayjs() }}
        >
          <Form.Item
            label="投入品"
            name="inputId"
            rules={[{ required: true, message: '请选择投入品' }]}
          >
            <Select showSearch optionFilterProp="label" options={inputOptions} placeholder="请选择投入品" />
          </Form.Item>
          <Form.Item label="使用地块" name="plotId" rules={[{ required: true, message: '请选择使用地块' }]}>
            <Select showSearch optionFilterProp="label" options={plotOptions} placeholder="请选择地块" />
          </Form.Item>
          <Form.Item label="关联农事任务" name="taskId">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={taskOptions}
              placeholder="请选择关联任务（可选）"
            />
          </Form.Item>
          <Form.Item label="用量" name="dosage" rules={[{ required: true, message: '请输入用量' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="单位" name="unit">
            <Select options={DOSAGE_UNIT_OPTIONS} />
          </Form.Item>
          <Form.Item label="施用方式" name="method">
            <Select allowClear options={USAGE_METHOD_OPTIONS} placeholder="请选择施用方式" />
          </Form.Item>
          <Form.Item label="安全间隔期（天）" name="safetyIntervalDays">
            <InputNumber min={0} max={365} style={{ width: '100%' }} placeholder="如 15" />
          </Form.Item>
          <Form.Item label="操作人" name="operatorId">
            <Select showSearch optionFilterProp="label" options={memberOptions} placeholder="请选择操作人" />
          </Form.Item>
          <Form.Item label="使用时间" name="usedAt" rules={[{ required: true, message: '请选择使用时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
