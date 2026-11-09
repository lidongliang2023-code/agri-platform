import ProTable from '@/components/ProductionTable'
import Card from '@/components/SectionCard'
import './inputs.css'
/**
 * 页面名称：农资管理（投入品档案 / 使用台账）
 * 路由路径：/production/inputs（旧 /production/inputs/usages 跳 ?tab=ledger；旧 /production/inputs/stock 回落到本页）
 * 所属模块：农资管理
 * 原型来源：用户端原型 P10 inputs — 投入品列表（台账），并合并原出入库管理页、使用记录页
 *
 * 还原要点：
 * - 标题「🌾 农资管理」+ 扫码录入 / 手动添加 / 导入 / 导出 按钮（仅投入品档案 Tab 展示）
 * - 筛选器：统计周期（本月 / 本季度 / 本年）、全部类型、全部地块、全部合规
 * - 「📊 投入概况」4 项：肥料 / 农药 / 种苗 / 其他 的用量与次数
 * - 合规汇总：合规状态 / 拦截次数 / 预警次数 / 休药期地块数
 * - Tab 1 投入品档案：查询条件 + 投入概况 + 合规汇总 + 库存总览（原出入库管理）+ 投入品档案表
 * - Tab 2 使用台账：使用记录 + 合规/上链 + 出入库流水（原出入库管理）
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import PageContainer from '@/components/ProductionPageContainer'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  DownloadOutlined,
  ImportOutlined,
  PlusOutlined,
  ScanOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import useFarmStore from '@/store/farm'
import { listPlots } from '@/api/plots'
import {
  createInputInfo,
  pageInputs,
  pageUsages,
  removeInput,
  updateInputInfo,
} from '@/api/inputs'
import type { InputInfo } from '@/api/inputs'
import type { InputUsageRecord, Plot } from '@/types'
import {
  INPUT_CATEGORY_OPTIONS,
  RANGE_OPTIONS,
  STOCK_STATE_META,
  STOCK_STATE_OPTIONS,
  checkAdmission,
  checkCompliance,
  categoryMeta,
  downloadCsv,
  fmtNumber,
  resolveRange,
  resolveStockState,
  summarizeCompliance,
} from './shared'
import type { ComplianceItem, ComplianceLevel, StockState } from './shared'
import InputStock from './InputStock'
import type { StockActionShortcut } from './InputStock'
import InputUsages from './InputUsages'

/** 主 Tab：投入品档案 / 使用台账（原「出入库管理」已拆入这两个 Tab） */
type MainTab = 'archive' | 'ledger'

/**
 * 归一化 `?tab=` 参数。
 *
 * <p>旧的「使用记录」页（`/production/inputs/usages`）映射到 ledger；
 * 旧的「出入库管理」页（`/production/inputs/stock`）已拆入两个 Tab，统一回落到
 * 投入品档案（库存总览所在位置）。</p>
 *
 * @param value 查询参数原始值
 * @returns 合法 Tab 值，缺省为投入品档案
 */
function normalizeTab(value: string | null): MainTab {
  return value === 'ledger' ? 'ledger' : 'archive'
}

/** 列表筛选条件 */
interface FilterState {
  /** 关键字：投入品名称 / 登记证号 */
  keyword?: string
  /** 分类（后端 inputType 枚举） */
  category?: string
  /** 合规等级 */
  compliance?: ComplianceLevel
  /** 库存状态筛选：全部 / 正常 / 预警 / 临期 / 不足 */
  stockState?: StockState | 'all'
  /** 统计周期 */
  range?: string
  /** 地块 ID */
  plotId?: string
}

/** 概览统计项 */
interface OverviewItem {
  /** 分类编码 */
  value: string
  /** 分类名称 */
  label: string
  /** 用量合计 */
  qty: number
  /** 用量单位 */
  unit: string
  /** 使用次数 */
  count: number
}

/** 使用台账行（含四项合规校验结果） */
interface LedgerRow {
  /** 使用记录 */
  usage: InputUsageRecord
  /** 关联投入品 */
  input?: InputInfo
  /** 四项合规校验结果 */
  items: ComplianceItem[]
  /** 整体合规等级 */
  level: ComplianceLevel
  /** 地块名称 */
  plotName: string
}

/**
 * 库存四态判定（优先级：不足 > 临期 > 预警 > 正常）
 *
 * 效期直接取后端回填的 `nearestExpireDate`（一次批量查询，不再逐项拉流水）。
 *
 * @param item 投入品
 * @returns 库存状态
 */
function stockStateOf(item: InputInfo): StockState {
  return resolveStockState(item.stockQty, item.warnQty, item.nearestExpireDate)
}

/**
 * 日期归一：截取 yyyy-MM-dd 前缀，保证字典序可直接比较。
 *
 * @param value 日期 / 时间字符串
 * @returns yyyy-MM-dd 串
 */
function dateKey(value: string): string {
  return value.slice(0, 10)
}

/**
 * 投入品列表页
 *
 * 业务职责：投入品档案增删改查 + 投入概况 + 合规汇总 + 使用台账。
 *
 * @returns 页面内容
 */
export default function InputList(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [searchParams, setSearchParams] = useSearchParams()
  // Tab 直接由 URL 派生：深链 ?tab=ledger（原「使用记录」页）/ ?tab=stock（原「出入库管理」页）
  // 与页内跳转（如出入库 Tab 的「使用登记」）都能即时落位
  const tab = normalizeTab(searchParams.get('tab'))
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [filters, setFilters] = useState<FilterState>({ range: 'month' })
  const [filterForm] = Form.useForm<FilterState>()
  const [editForm] = Form.useForm<Partial<InputInfo>>()

  const [editTarget, setEditTarget] = useState<InputInfo | null>(null)
  const [scanOpen, setScanOpen] = useState<boolean>(false)
  const [scanCode, setScanCode] = useState<string>('')
  const [importOpen, setImportOpen] = useState<boolean>(false)
  const [importing, setImporting] = useState<boolean>(false)
  const [stockShortcut, setStockShortcut] = useState<StockActionShortcut>()

  /** 投入品档案（一次性取全量，前端完成分类 / 合规 / 库存预警过滤与分页） */
  const inputsQuery = useQuery({
    queryKey: ['production-inputs', 'archive'],
    queryFn: () => pageInputs({ pageNum: 1, pageSize: 500 }),
  })

  /** 使用记录（概况统计与台账数据源） */
  const usagesQuery = useQuery({
    queryKey: ['production-inputs', 'usages'],
    queryFn: () => pageUsages({ pageNum: 1, pageSize: 500 }),
  })

  /** 地块下拉（地块筛选与地块名展示） */
  const plotsQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 统一失效刷新 */
  const invalidateAll = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['production-inputs'] })

  /** 删除投入品档案 */
  const deleteMutation = useMutation({
    mutationFn: (inputId: string) => removeInput(inputId),
    onSuccess: () => {
      message.success('投入品已删除')
      void invalidateAll()
    },
  })

  /** 编辑弹窗保存 */
  const saveMutation = useMutation({
    mutationFn: (payload: Partial<InputInfo>) => {
      if (!editTarget?.inputId) {
        return Promise.reject(new Error('缺少投入品 ID'))
      }
      return updateInputInfo(editTarget.inputId, payload)
    },
    onSuccess: () => {
      message.success('投入品已更新')
      setEditTarget(null)
      editForm.resetFields()
      void invalidateAll()
    },
  })

  const allInputs = useMemo<InputInfo[]>(() => inputsQuery.data?.list ?? [], [inputsQuery.data])


  const inputMap = useMemo<Map<string, InputInfo>>(() => {
    const map = new Map<string, InputInfo>()
    allInputs.forEach((item) => map.set(item.inputId, item))
    return map
  }, [allInputs])

  const plotMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    ;(plotsQuery.data?.list ?? []).forEach((plot: Plot) => map.set(plot.plotId, plot.plotName))
    return map
  }, [plotsQuery.data])

  const plotOptions = useMemo(
    () =>
      (plotsQuery.data?.list ?? []).map((plot: Plot) => ({
        value: plot.plotId,
        label: plot.plotName,
      })),
    [plotsQuery.data],
  )

  /** 统计周期区间 */
  const [rangeStart, rangeEnd] = useMemo(
    () => resolveRange(filters.range ?? 'month'),
    [filters.range],
  )

  /** 周期内使用记录 */
  const rangedUsages = useMemo<InputUsageRecord[]>(
    () =>
      (usagesQuery.data?.list ?? []).filter((usage) => {
        if (!usage.usedAt) return false
        const used = dateKey(usage.usedAt)
        if (used < rangeStart || used > rangeEnd) return false
        if (filters.plotId && usage.plotId !== filters.plotId) return false
        return true
      }),
    [usagesQuery.data, rangeStart, rangeEnd, filters.plotId],
  )

  /** 按投入品聚合周期内累计用量 */
  const cumulativeMap = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>()
    rangedUsages.forEach((usage) => {
      if (!usage.inputId) return
      map.set(usage.inputId, (map.get(usage.inputId) ?? 0) + (usage.dosage ?? 0))
    })
    return map
  }, [rangedUsages])

  /** 台账行：逐条执行四项合规校验 */
  const ledgerRows = useMemo<LedgerRow[]>(
    () =>
      rangedUsages.map((usage) => {
        const input = usage.inputId ? inputMap.get(usage.inputId) : undefined
        const items = checkCompliance({
          inputName: usage.inputName ?? input?.inputName,
          inputType: input?.inputType,
          safetyInterval: usage.safetyIntervalDays ?? input?.safetyInterval,
          dosage: usage.dosage,
          unit: usage.unit,
          lastUsedAt: usage.usedAt,
          cumulativeDosage: usage.inputId ? cumulativeMap.get(usage.inputId) : undefined,
          plotName: usage.plotId ? plotMap.get(usage.plotId) : undefined,
        })
        return {
          usage,
          input,
          items,
          level: summarizeCompliance(items),
          plotName: (usage.plotId ? plotMap.get(usage.plotId) : undefined) || usage.plotId || '-',
        }
      }),
    [rangedUsages, inputMap, plotMap, cumulativeMap],
  )

  /** 投入概况：肥料 / 农药 / 种苗 / 其他 */
  const overview = useMemo<OverviewItem[]>(() => {
    const targets = ['FERTILIZER', 'PESTICIDE', 'SEED', 'OTHER']
    return targets.map((value) => {
      const rows = ledgerRows.filter(
        (row) => (row.input?.inputType ?? 'OTHER') === value,
      )
      let qty = 0
      const unitCount = new Map<string, number>()
      rows.forEach((row) => {
        qty += row.usage.dosage ?? 0
        const unit = row.usage.unit ?? ''
        if (unit) unitCount.set(unit, (unitCount.get(unit) ?? 0) + 1)
      })
      let unit = ''
      let max = 0
      unitCount.forEach((count, key) => {
        if (count > max) {
          max = count
          unit = key
        }
      })
      return { value, label: categoryMeta(value).label, qty, unit, count: rows.length }
    })
  }, [ledgerRows])

  /** 合规汇总 */
  const complianceSummary = useMemo(() => {
    let blocked = 0
    let warning = 0
    const withdrawalPlots = new Set<string>()
    ledgerRows.forEach((row) => {
      if (row.level === 'blocked') blocked += 1
      if (row.level === 'warning') warning += 1
      const withdrawal = row.items.find((item) => item.key === 'withdrawal')
      if (withdrawal && withdrawal.level !== 'pass' && row.usage.plotId) {
        withdrawalPlots.add(row.usage.plotId)
      }
    })
    return { blocked, warning, withdrawalPlots: withdrawalPlots.size, total: ledgerRows.length }
  }, [ledgerRows])

  /** 档案过滤结果（合并库存总览后仍按低库存优先） */
  const filteredInputs = useMemo<InputInfo[]>(() => {
    const keyword = (filters.keyword ?? '').trim()
    const stateOrder: Record<StockState, number> = {
      shortage: 0,
      expiring: 1,
      warning: 2,
      normal: 3,
    }
    return allInputs
      .filter((item) => {
        if (keyword) {
          const haystack = `${item.inputName ?? ''}${item.registrationNo ?? ''}${
            item.manufacturer ?? ''
          }`
          if (!haystack.includes(keyword)) return false
        }
        if (filters.category && (item.inputType ?? 'OTHER') !== filters.category) return false
        if (filters.compliance) {
          if (checkAdmission(item.inputName, item.inputType).level !== filters.compliance) {
            return false
          }
        }
        if (filters.stockState && filters.stockState !== 'all') {
          if (stockStateOf(item) !== filters.stockState) return false
        }
        return true
      })
      .sort((left, right) => {
        const byState = stateOrder[stockStateOf(left)] - stateOrder[stockStateOf(right)]
        if (byState !== 0) return byState
        return String(left.nearestExpireDate ?? '9999-12-31').localeCompare(
          String(right.nearestExpireDate ?? '9999-12-31'),
        )
      })
  }, [allInputs, filters])

  /** 当前页档案数据 */
  const pagedInputs = useMemo<InputInfo[]>(
    () => filteredInputs.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [filteredInputs, pageNum, pageSize],
  )

  /** 查询 */
  const handleSearch = (): void => {
    const values = filterForm.getFieldsValue()
    setPageNum(1)
    setFilters((prev) => ({ ...prev, ...values }))
  }

  /** 重置 */
  const handleReset = (): void => {
    filterForm.resetFields()
    setPageNum(1)
    setFilters({ range: 'month' })
  }

  /**
   * 切换主 Tab（只改 URL，Tab 由 `?tab=` 派生）。
   *
   * <p>`create` / `usageId` 是一次性深链参数，切换 Tab 时一并清掉，避免下次进入
   * 使用台账时又弹出登记窗或残留筛选。</p>
   */
  const switchTab = (next: MainTab): void => {
    setPageNum(1)
    const params = new URLSearchParams(searchParams)
    params.delete('create')
    params.delete('usageId')
    if (next === 'archive') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  /** 打开编辑弹窗 */
  const openEdit = (record: InputInfo): void => {
    setEditTarget(record)
    editForm.setFieldsValue({
      inputName: record.inputName,
      inputType: record.inputType,
      registrationNo: record.registrationNo,
      manufacturer: record.manufacturer,
      spec: record.spec,
      unit: record.unit,
      safetyInterval: record.safetyInterval,
      stockQty: record.stockQty,
      warnQty: record.warnQty,
      status: record.status ?? 1,
    })
  }

  /** 提交编辑 */
  const submitEdit = (): void => {
    const values = editForm.getFieldsValue()
    if (!values.inputName) {
      message.warning('请填写投入品名称')
      return
    }
    saveMutation.mutate(values)
  }

  /** 扫码录入：按条码 / 登记证号 / 名称匹配 */
  const handleScan = (): void => {
    const code = scanCode.trim()
    if (!code) {
      message.warning('请输入或扫描投入品条码')
      return
    }
    const hit = allInputs.find(
      (item) => item.inputCode === code || item.registrationNo === code || item.inputName === code,
    )
    setScanOpen(false)
    setScanCode('')
    if (hit) {
      message.success(`已匹配：${hit.inputName ?? code}`)
      navigate(`/production/inputs/${hit.inputId}`)
      return
    }
    message.info(`未匹配到「${code}」，请手动建档`)
    navigate('/production/inputs/create')
  }

  /** 解析导入 CSV 文本 */
  const parseImportText = (text: string): Partial<InputInfo>[] => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (lines.length === 0) return []
    const startIndex = lines[0].startsWith('投入品名称') ? 1 : 0
    return lines.slice(startIndex).map((line) => {
      const cells = line.split(',').map((cell) => cell.trim())
      const matchedType = INPUT_CATEGORY_OPTIONS.find((option) => option.label === (cells[1] ?? ''))
      return {
        inputName: cells[0] ?? '',
        inputType: matchedType?.value ?? 'OTHER',
        registrationNo: cells[2] ?? '',
        manufacturer: cells[3] ?? '',
        spec: cells[4] ?? '',
        unit: cells[5] || 'kg',
        safetyInterval: Number(cells[6]) || undefined,
        stockQty: Number(cells[7]) || 0,
        warnQty: Number(cells[8]) || undefined,
        status: 1,
      }
    })
  }

  /** 执行批量导入 */
  const runImport = (payloads: Partial<InputInfo>[]): void => {
    if (payloads.length === 0) {
      message.warning('未解析到有效数据行')
      return
    }
    setImporting(true)
    Promise.allSettled(payloads.map((payload) => createInputInfo(payload)))
      .then((results) => {
        const success = results.filter((item) => item.status === 'fulfilled').length
        const failed = results.length - success
        if (failed === 0) {
          message.success(`导入成功 ${success} 条`)
        } else {
          message.warning(`导入完成：成功 ${success} 条，失败 ${failed} 条`)
        }
        setImportOpen(false)
        void invalidateAll()
      })
      .finally(() => setImporting(false))
  }

  /** 导入文件读取（阻止自动上传，前端解析后批量提交） */
  const handleImportFile = (file: File): boolean => {
    const reader = new FileReader()
    reader.onload = () => {
      runImport(parseImportText(String(reader.result ?? '')))
    }
    reader.readAsText(file, 'utf-8')
    return false
  }

  /** 下载导入模板 */
  const downloadTemplate = (): void => {
    downloadCsv(
      '投入品导入模板',
      [
        '投入品名称',
        '投入品类型',
        '登记证号',
        '生产厂家',
        '规格',
        '单位',
        '安全间隔期(天)',
        '库存',
        '预警阈值',
      ],
      [['复合肥', '肥料', '农肥(2018)准字1234号', '某某肥业', '50kg/袋', 'kg', 15, 500, 100]],
    )
  }

  /** 导出投入品档案（使用台账 / 出入库 Tab 各自有导出按钮） */
  const handleExport = (): void => {
    if (filteredInputs.length === 0) {
      message.warning('暂无可导出的数据')
      return
    }
    downloadCsv(
      '投入品档案',
      [
        '投入品名称',
        '投入品类型',
        '登记证号',
        '生产厂家',
        '规格',
        '库存',
        '单位',
        '安全间隔期(天)',
        '准入校验',
        '状态',
      ],
      filteredInputs.map((item) => [
        item.inputName ?? '',
        categoryMeta(item.inputType).label,
        item.registrationNo ?? '',
        item.manufacturer ?? '',
        item.spec ?? '',
        fmtNumber(item.stockQty),
        item.unit ?? '',
        item.safetyInterval ?? '',
        checkAdmission(item.inputName, item.inputType).label,
        item.status === 1 ? '启用' : '停用',
      ]),
    )
  }

  /** 档案列定义 */
  const archiveColumns: ProColumns<InputInfo>[] = [
    {
      title: '投入品',
      dataIndex: 'inputName',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.inputName ?? '-'}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.inputCode ?? record.inputId}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '投入品类型',
      dataIndex: 'inputType',
      width: 110,
      render: (_, record) => {
        const meta = categoryMeta(record.inputType)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '登记证号',
      dataIndex: 'registrationNo',
      width: 170,
      ellipsis: true,
      render: (_, record) => record.registrationNo ?? '-',
    },
    {
      title: '生产厂家',
      dataIndex: 'manufacturer',
      width: 160,
      ellipsis: true,
      render: (_, record) => record.manufacturer ?? '-',
    },
    {
      title: '规格',
      dataIndex: 'spec',
      width: 110,
      render: (_, record) => record.spec ?? '-',
    },
    {
      title: '库存',
      dataIndex: 'stockQty',
      width: 170,
      render: (_, record) => {
        const state = stockStateOf(record)
        const meta = STOCK_STATE_META[state]
        return (
          <Space size={4}>
            <span>
              {fmtNumber(record.stockQty)} {record.unit ?? ''}
            </span>
            {state === 'normal' ? (
              <Tag color={meta.tagColor}>{meta.label}</Tag>
            ) : (
              <Tag icon={<WarningOutlined />} color={meta.tagColor}>
                {meta.label}
              </Tag>
            )}
          </Space>
        )
      },
    },
    {
      title: '预警阈值',
      dataIndex: 'warnQty',
      width: 120,
      render: (_, record) =>
        record.warnQty === undefined || record.warnQty === null
          ? '-'
          : `${fmtNumber(record.warnQty)} ${record.unit ?? ''}`,
    },
    {
      title: '最近批次效期',
      dataIndex: 'nearestExpireDate',
      width: 130,
      render: (_, record) => record.nearestExpireDate?.slice(0, 10) ?? '-',
    },
    {
      title: '安全间隔期',
      dataIndex: 'safetyInterval',
      width: 110,
      render: (_, record) =>
        record.safetyInterval === undefined || record.safetyInterval === null
          ? '-'
          : `${record.safetyInterval} 天`,
    },
    {
      title: '准入校验',
      key: 'admission',
      width: 120,
      render: (_, record) => {
        const result = checkAdmission(record.inputName, record.inputType)
        return (
          <Tag color={result.tagColor}>
            {result.icon} {result.label}
          </Tag>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, record) => (
        <Tag color={record.status === 1 ? 'green' : 'default'}>
          {record.status === 1 ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      fixed: 'right',
      key: 'option',
      width: 300,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link
          key="stock-in"
          onClick={() =>
            setStockShortcut((previous) => ({
              requestId: (previous?.requestId ?? 0) + 1,
              action: 'in',
              inputId: record.inputId,
            }))
          }
        >
          入库
        </Typography.Link>,
        <Typography.Link
          key="usage"
          onClick={() => navigate('/production/inputs?tab=ledger&create=1')}
        >
          使用登记
        </Typography.Link>,
        <Typography.Link
          key="detail"
          onClick={() => navigate(`/production/inputs/${record.inputId}`)}
        >
          详情
        </Typography.Link>,
        <Typography.Link key="edit" onClick={() => openEdit(record)}>
          编辑
        </Typography.Link>,
        <Popconfirm
          key="delete"
          title="确认删除该投入品？"
          description="删除后不可恢复，请谨慎操作。"
          okText="确认删除"
          cancelText="取消"
          onConfirm={() => deleteMutation.mutate(record.inputId)}
        >
          <Typography.Link type="danger">删除</Typography.Link>
        </Popconfirm>,
      ],
    },
  ]

  const loading = inputsQuery.isFetching || usagesQuery.isFetching
  const isError = inputsQuery.isError || usagesQuery.isError
  const rangeLabel =
    RANGE_OPTIONS.find((item) => item.value === (filters.range ?? 'month'))?.label ?? '本月'

  return (
    <PageContainer
      className="inputs-page"
      title="农资台账"
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      // 页头操作按钮只在「投入品档案」Tab 展示；使用台账与流水各自带作业按钮
      extra={
        tab !== 'archive'
          ? undefined
          : [
              <Button key="scan" icon={<ScanOutlined />} onClick={() => setScanOpen(true)}>
                扫码录入
              </Button>,
              <Button
                key="create"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/production/inputs/create')}
              >
                手动添加
              </Button>,
              <Button key="import" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
                导入
              </Button>,
              <Button key="export" icon={<DownloadOutlined />} onClick={handleExport}>
                导出
              </Button>,
            ]
      }
    >
      <Card className="input-tabs-card">
        <Tabs
          activeKey={tab}
          onChange={(key) => switchTab(key as MainTab)}
          items={[
            {
              key: 'archive',
              label: `投入品档案(${filteredInputs.length})`,
              children: (
                <>
                  <Card style={{ marginBottom: 16 }}>
                    <Form form={filterForm} layout="inline" style={{ rowGap: 12 }}>
                      <Form.Item name="range" label="统计周期">
                        <Select
                          placeholder="请选择周期"
                          options={RANGE_OPTIONS}
                          style={{ width: 120 }}
                          defaultValue="month"
                        />
                      </Form.Item>
                      <Form.Item name="category" label="投入品类型">
                        <Select
                          allowClear
                          placeholder="全部投入品类型"
                          options={INPUT_CATEGORY_OPTIONS}
                          style={{ width: 120 }}
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
                      <Form.Item name="compliance" label="合规">
                        <Select
                          allowClear
                          placeholder="全部合规"
                          style={{ width: 120 }}
                          options={[
                            { value: 'pass', label: '✅ 通过' },
                            { value: 'warning', label: '⚠️ 预警' },
                            { value: 'blocked', label: '❌ 拦截' },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item name="keyword" label="关键字">
                        <Input allowClear placeholder="投入品名称 / 登记证号" style={{ width: 180 }} />
                      </Form.Item>
                      <Form.Item label="库存状态">
                        <Segmented
                          size="small"
                          value={filters.stockState ?? 'all'}
                          onChange={(value) => {
                            const next = value as StockState | 'all'
                            filterForm.setFieldValue('stockState', next)
                            setFilters((prev) => ({ ...prev, stockState: next }))
                          }}
                          options={STOCK_STATE_OPTIONS}
                        />
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
                  </Card>

                  <Card
                    title={`📊 投入概况（${rangeLabel}）`}
                    style={{ marginBottom: 16 }}
                    loading={loading}
                  >
                    <Row gutter={[16, 16]}>
                      {overview.map((item) => (
                        <Col key={item.value} xs={12} lg={6}>
                          <Statistic
                            title={`${item.label}（${item.count} 次）`}
                            value={item.qty}
                            precision={2}
                            suffix={item.unit || '-'}
                          />
                        </Col>
                      ))}
                    </Row>
                  </Card>

                  <Alert
                    style={{ marginBottom: 16 }}
                    type={complianceSummary.blocked > 0 ? 'error' : 'success'}
                    showIcon
                    message={
                      <Space size={16} wrap>
                        <span>
                          合规状态：
                          {complianceSummary.blocked > 0 ? (
                            <Tag color="red">❌ 存在拦截</Tag>
                          ) : (
                            <Tag color="green">✅ 全部通过</Tag>
                          )}
                        </span>
                        <span>拦截：{complianceSummary.blocked} 次</span>
                        <span>预警：{complianceSummary.warning} 次</span>
                        <span>休药期地块：{complianceSummary.withdrawalPlots} 个</span>
                        <Typography.Text type="secondary">
                          统计口径 {rangeStart} ~ {rangeEnd}，共 {complianceSummary.total} 条使用记录
                        </Typography.Text>
                      </Space>
                    }
                  />

                  {/* 库存统计与作业保留；库存列表已并入下方唯一主表 */}
                  <InputStock part="overview" showTable={false} shortcut={stockShortcut} />

                  {isError ? (
                    <Empty
                      description={
                        <Space direction="vertical">
                          <Typography.Text type="danger">投入品数据加载失败，请稍后重试</Typography.Text>
                          <Button onClick={() => void invalidateAll()}>重新加载</Button>
                        </Space>
                      }
                    />
                  ) : (
                    <Card
                      className="input-record-section"
                      title="投入品档案"
                      extra={
                        <Typography.Text type="secondary">
                          共 {filteredInputs.length} 种
                        </Typography.Text>
                      }
                    >
                      <ProTable<InputInfo>
            cardProps={false}
            className="input-record-table"
                        rowKey="inputId"
                        columns={archiveColumns}
                        dataSource={pagedInputs}
                        loading={loading}
                        search={false}
                        headerTitle="投入品档案"
                        rowSelection={{}}
                        // 库存、效期和作业并入同一张表，窄屏只在这一张表内横向滚动
                        scroll={{ x: 1750 }}
                        options={{ reload: () => void invalidateAll(), density: true, setting: true }}
                        pagination={{
                          current: pageNum,
                          pageSize,
                          total: filteredInputs.length,
                          showSizeChanger: true,
                          showTotal: (total) => `共 ${total} 条`,
                          onChange: (nextPage, nextSize) => {
                            setPageNum(nextPage)
                            setPageSize(nextSize)
                          },
                        }}
                      />
                    </Card>
                  )}
                </>
              ),
            },
            {
              key: 'ledger',
              label: '使用台账',
              children: (
                <InputUsages />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="编辑投入品"
        open={Boolean(editTarget)}
        okText="保存"
        cancelText="取消"
        confirmLoading={saveMutation.isPending}
        onOk={submitEdit}
        onCancel={() => {
          setEditTarget(null)
          editForm.resetFields()
        }}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="投入品名称" name="inputName" rules={[{ required: true }]}>
            <Input placeholder="请输入投入品名称" />
          </Form.Item>
          <Form.Item label="投入品类型" name="inputType">
            <Select options={INPUT_CATEGORY_OPTIONS} placeholder="请选择投入品类型" />
          </Form.Item>
          <Form.Item label="登记证号" name="registrationNo">
            <Input placeholder="如 PD20180001 / 农肥(2018)准字1234号" />
          </Form.Item>
          <Form.Item label="生产厂家" name="manufacturer">
            <Input placeholder="请输入生产厂家" />
          </Form.Item>
          <Form.Item label="规格" name="spec">
            <Input placeholder="如 50kg/袋" />
          </Form.Item>
          <Form.Item label="计量单位" name="unit">
            <Select
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'g', label: 'g' },
                { value: 'L', label: 'L' },
                { value: 'mL', label: 'mL' },
                { value: '株', label: '株' },
                { value: '袋', label: '袋' },
              ]}
              placeholder="请选择单位"
            />
          </Form.Item>
          <Form.Item label="安全间隔期（天）" name="safetyInterval">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="当前库存" name="stockQty">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="库存预警阈值" name="warnQty">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Radio.Group
              options={[
                { value: 1, label: '启用' },
                { value: 0, label: '停用' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="📷 扫码录入"
        open={scanOpen}
        okText="匹配并继续"
        cancelText="取消"
        onOk={handleScan}
        onCancel={() => {
          setScanOpen(false)
          setScanCode('')
        }}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 12 }}>
          <Typography.Text type="secondary">
            扫描或手动输入投入品条码 / 登记证号，系统自动匹配档案；未匹配时引导手动建档。
          </Typography.Text>
          <Input
            value={scanCode}
            onChange={(event) => setScanCode(event.target.value)}
            placeholder="扫码或手动输入条码"
            onPressEnter={handleScan}
          />
        </Space>
      </Modal>

      <Modal
        title="批量导入投入品"
        open={importOpen}
        okText="关闭"
        cancelText="取消"
        confirmLoading={importing}
        onOk={() => setImportOpen(false)}
        onCancel={() => setImportOpen(false)}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 12 }}>
          <Typography.Text type="secondary">
            支持 CSV 文件，列顺序：投入品名称,投入品类型,登记证号,生产厂家,规格,单位,安全间隔期,库存,预警阈值。
          </Typography.Text>
          <Space>
            <Button onClick={downloadTemplate}>下载模板</Button>
            <Upload
              accept=".csv,.txt"
              showUploadList={false}
              beforeUpload={(file) => handleImportFile(file as unknown as File)}
            >
              <Button type="primary" loading={importing}>
                选择文件导入
              </Button>
            </Upload>
          </Space>
        </Space>
      </Modal>
    </PageContainer>
  )
}
