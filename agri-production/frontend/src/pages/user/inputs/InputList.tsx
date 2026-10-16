/**
 * 页面名称：投入品列表（台账）
 * 路由路径：/production/inputs
 * 所属模块：农资投入品管理
 * 原型来源：用户端原型 P10 inputs — 投入品列表（台账）
 *
 * 还原要点：
 * - 标题「💊 投入品台账」+ 扫码录入 / 手动添加 / 导入 / 导出 按钮
 * - 筛选器：统计周期（本月 / 本季度 / 本年）、全部类型、全部地块、全部合规
 * - 「📊 投入概况」4 项：肥料 / 农药 / 种苗 / 其他 的用量与次数
 * - 合规汇总：合规状态 / 拦截次数 / 预警次数 / 休药期地块数
 * - Tab 1 投入品档案：分类检索 + 准入校验标识 + 库存预警，支持增删改查
 * - Tab 2 使用台账：日期 | 投入品 | 类型 | 地块 | 用量 | 合规 | 操作（溯源 → 详情）
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Card,
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
  fmtDate,
  fmtNumber,
  resolveRange,
  resolveStockState,
  summarizeCompliance,
} from './shared'
import type { ComplianceItem, ComplianceLevel, StockState } from './shared'

/** 主 Tab：投入品档案 / 使用台账 */
type MainTab = 'archive' | 'ledger'

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

  const [tab, setTab] = useState<MainTab>('archive')
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

  /** 档案过滤结果 */
  const filteredInputs = useMemo<InputInfo[]>(() => {
    const keyword = (filters.keyword ?? '').trim()
    return allInputs.filter((item) => {
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
  }, [allInputs, filters])

  /** 当前页档案数据 */
  const pagedInputs = useMemo<InputInfo[]>(
    () => filteredInputs.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [filteredInputs, pageNum, pageSize],
  )

  /** 当前页台账数据 */
  const pagedLedger = useMemo<LedgerRow[]>(
    () => ledgerRows.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [ledgerRows, pageNum, pageSize],
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

  /** 导出当前视图数据 */
  const handleExport = (): void => {
    if (tab === 'archive') {
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
      return
    }
    if (ledgerRows.length === 0) {
      message.warning('暂无可导出的数据')
      return
    }
    downloadCsv(
      '投入品使用台账',
      ['日期', '投入品', '投入品类型', '地块', '用量', '单位', '操作人', '合规结论'],
      ledgerRows.map((row) => [
        fmtDate(row.usage.usedAt),
        row.usage.inputName ?? row.input?.inputName ?? '-',
        categoryMeta(row.input?.inputType).label,
        row.plotName,
        fmtNumber(row.usage.dosage),
        row.usage.unit ?? '',
        row.usage.operatorId ?? '',
        row.items.map((item) => `${item.label}:${item.result}`).join('；'),
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
      width: 150,
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
      key: 'option',
      width: 210,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link
          key="detail"
          onClick={() => navigate(`/production/inputs/${record.inputId}`)}
        >
          详情
        </Typography.Link>,
        <Typography.Link key="edit" onClick={() => openEdit(record)}>
          编辑
        </Typography.Link>,
        <Typography.Link key="stock" onClick={() => navigate('/production/inputs/stock')}>
          出入库
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

  /** 台账列定义（原型 P10 表格列） */
  const ledgerColumns: ProColumns<LedgerRow>[] = [
    {
      title: '日期',
      key: 'usedAt',
      width: 120,
      render: (_, record) => fmtDate(record.usage.usedAt),
    },
    {
      title: '投入品',
      key: 'inputName',
      width: 150,
      render: (_, record) => (
        <Typography.Link onClick={() => navigate(`/production/inputs/${record.usage.inputId ?? ''}`)}>
          {record.usage.inputName ?? record.input?.inputName ?? '-'}
        </Typography.Link>
      ),
    },
    {
      title: '投入品类型',
      key: 'category',
      width: 110,
      render: (_, record) => {
        const meta = categoryMeta(record.input?.inputType)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: '地块', key: 'plotName', width: 120, render: (_, record) => record.plotName },
    {
      title: '用量',
      key: 'dosage',
      width: 120,
      render: (_, record) => `${fmtNumber(record.usage.dosage)} ${record.usage.unit ?? ''}`,
    },
    {
      title: '操作人',
      key: 'operatorId',
      width: 110,
      render: (_, record) => record.usage.operatorId ?? '-',
    },
    {
      title: '合规',
      key: 'compliance',
      width: 120,
      render: (_, record) => {
        const meta = {
          pass: { icon: '✅', color: 'green', label: '通过' },
          warning: { icon: '⚠️', color: 'orange', label: '预警' },
          blocked: { icon: '❌', color: 'red', label: '拦截' },
        }[record.level]
        return (
          <Tag color={meta.color}>
            {meta.icon} {meta.label}
          </Tag>
        )
      },
    },
    {
      title: '操作',
      key: 'option',
      width: 110,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link
          key="trace"
          onClick={() => navigate(`/production/inputs/${record.usage.inputId ?? ''}`)}
        >
          溯源 →
        </Typography.Link>,
      ],
    },
  ]

  const loading = inputsQuery.isFetching || usagesQuery.isFetching
  const isError = inputsQuery.isError || usagesQuery.isError
  const rangeLabel =
    RANGE_OPTIONS.find((item) => item.value === (filters.range ?? 'month'))?.label ?? '本月'

  return (
    <PageContainer
      title="💊 投入品台账"
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      extra={[
        <Button key="scan" icon={<ScanOutlined />} onClick={() => setScanOpen(true)}>
          📷 扫码录入
        </Button>,
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/production/inputs/create')}
        >
          + 手动添加
        </Button>,
        <Button key="import" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
          导入
        </Button>,
        <Button key="export" icon={<DownloadOutlined />} onClick={handleExport}>
          导出
        </Button>,
      ]}
    >
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

      <Card title={`📊 投入概况（${rangeLabel}）`} style={{ marginBottom: 16 }} loading={loading}>
        <Row gutter={16}>
          {overview.map((item) => (
            <Col key={item.value} span={6}>
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

      <Card>
        <Tabs
          activeKey={tab}
          onChange={(key) => {
            setTab(key as MainTab)
            setPageNum(1)
          }}
          // 「登记使用记录」入口（2026-10-16 菜单收口配套）：
          // 「使用记录」(/production/inputs/usages) 的菜单叶子已撤销（它与本页「使用台账」Tab 重叠），
          // 但**新建使用记录 / 合规校验 / 上链 / 删除**是那一页独有的能力 —— 收口不能顺手砍功能，
          // 所以把入口挂到最相关的这个 Tab 右上角，页面上仍然可达（不再单独占菜单位）。
          tabBarExtraContent={
            <Button type="link" onClick={() => navigate('/production/inputs/usages')}>
              登记使用记录 →
            </Button>
          }
          items={[
            { key: 'archive', label: `投入品档案(${filteredInputs.length})` },
            { key: 'ledger', label: `使用台账(${ledgerRows.length})` },
          ]}
        />
        {isError ? (
          <Empty
            description={
              <Space direction="vertical">
                <Typography.Text type="danger">投入品数据加载失败，请稍后重试</Typography.Text>
                <Button onClick={() => void invalidateAll()}>重新加载</Button>
              </Space>
            }
          />
        ) : tab === 'archive' ? (
          <ProTable<InputInfo>
            rowKey="inputId"
            columns={archiveColumns}
            dataSource={pagedInputs}
            loading={loading}
            search={false}
            rowSelection={{}}
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
        ) : (
          <ProTable<LedgerRow>
            rowKey={(record) => record.usage.usageId}
            columns={ledgerColumns}
            dataSource={pagedLedger}
            loading={loading}
            search={false}
            rowSelection={{}}
            options={{ reload: () => void invalidateAll(), density: true, setting: true }}
            pagination={{
              current: pageNum,
              pageSize,
              total: ledgerRows.length,
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
