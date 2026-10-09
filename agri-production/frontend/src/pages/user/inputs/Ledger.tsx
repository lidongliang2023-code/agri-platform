/**
 * 页面名称：投入品使用台账
 * 路由路径：/production/inputs/ledger
 * 所属模块：农资投入品管理
 * 原型来源：用户端原型 P22 inputs-ledger — 投入品台账
 *
 * 还原要点：
 * - 标题「💊 投入品台账」+ 扫码录入 / 手动添加 / 导出 按钮
 * - 筛选：日期区间、全部类型、全部地块、关键字；按钮 查询 / 重置
 * - Tab 1「使用台账」：日期 | 投入品 | 类型 | 地块 | 用量 | 操作人 | 合规 | 上链 | 操作（溯源 →）
 * - Tab 2「出入库流水」：时间 | 投入品 | 类型 | 数量 | 批次号 | 有效期 | 操作人 | 关联任务 | 备注
 * - 分页（共 N 条）+ CSV 导出
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { DownloadOutlined, PlusOutlined, ScanOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import { listPlots } from '@/api/plots'
import { pageInputs, pageStockFlows, pageUsages } from '@/api/inputs'
import type { InputInfo, InputStockFlow } from '@/api/inputs'
import { listChainRecords } from '@/api/blockchain'
import type { InputUsageRecord, Plot } from '@/types'
import {
  INPUT_CATEGORY_OPTIONS,
  categoryMeta,
  checkCompliance,
  downloadCsv,
  fmtDate,
  fmtNumber,
  flowTypeMeta,
  summarizeCompliance,
} from './shared'
import type { ComplianceItem, ComplianceLevel } from './shared'

/** 台账 Tab */
type LedgerTab = 'usage' | 'stock'

/** 筛选条件 */
interface LedgerFilters {
  /** 日期区间 */
  dateRange?: [Dayjs, Dayjs]
  /** 投入品分类 */
  category?: string
  /** 地块 */
  plotId?: string
  /** 关键字 */
  keyword?: string
}

/** 使用台账行 */
interface UsageRow {
  /** 使用记录 */
  usage: InputUsageRecord
  /** 关联投入品 */
  input?: InputInfo
  /** 四项合规校验 */
  items: ComplianceItem[]
  /** 整体等级 */
  level: ComplianceLevel
  /** 地块名 */
  plotName: string
}

/** 出入库流水行 */
interface FlowRow extends InputStockFlow {
  /** 投入品名称 */
  inputLabel: string
  /** 投入品分类 */
  category: string
}

/** 日期归一：截取 yyyy-MM-dd 前缀 */
function dateKey(value?: string): string {
  return (value ?? '').slice(0, 10)
}

/**
 * 投入品使用台账页
 *
 * 业务职责：汇总投入品使用流水与出入库流水，支持按日期 / 类型 / 地块检索与导出。
 *
 * @returns 页面内容
 */
export default function Ledger(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [tab, setTab] = useState<LedgerTab>('usage')
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [filters, setFilters] = useState<LedgerFilters>({})
  const [filterForm] = Form.useForm<LedgerFilters>()

  /** 投入品档案 */
  const inputsQuery = useQuery({
    queryKey: ['production-inputs', 'archive'],
    queryFn: () => pageInputs({ pageNum: 1, pageSize: 500 }),
  })

  /** 使用记录 */
  const usagesQuery = useQuery({
    queryKey: ['production-inputs', 'usages'],
    queryFn: () => pageUsages({ pageNum: 1, pageSize: 500 }),
  })

  /** 出入库流水：按投入品逐项拉取后合并 */
  const flowsQuery = useQuery({
    queryKey: ['production-inputs', 'all-stock-flows'],
    queryFn: async () => {
      const inputs = await pageInputs({ pageNum: 1, pageSize: 100 })
      const targets = inputs.list.slice(0, 50)
      const lists = await Promise.all(
        targets.map((input) => pageStockFlows(input.inputId, { pageNum: 1, pageSize: 100 })),
      )
      return lists.flatMap((page) => page.list ?? [])
    },
  })

  /** 地块下拉 */
  const plotsQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 链上存证（bizType 2 = 投入品使用） */
  const chainQuery = useQuery({
    queryKey: ['blockchain', 'records', 'input-usage'],
    queryFn: () => listChainRecords({ bizType: 2, pageNum: 1, pageSize: 200 }),
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

  const plotOptions = useMemo(
    () =>
      (plotsQuery.data?.list ?? []).map((plot: Plot) => ({
        value: plot.plotId,
        label: plot.plotName,
      })),
    [plotsQuery.data],
  )

  /** 已上链的业务单号集合 */
  const chainedBizIds = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    ;(chainQuery.data?.list ?? []).forEach((record) => {
      if (record.status === 3) set.add(record.bizId)
    })
    return set
  }, [chainQuery.data])

  /** 使用台账行（含合规校验） */
  const usageRows = useMemo<UsageRow[]>(() => {
    const start = filters.dateRange?.[0]?.format('YYYY-MM-DD')
    const end = filters.dateRange?.[1]?.format('YYYY-MM-DD')
    const keyword = (filters.keyword ?? '').trim()
    return (usagesQuery.data?.list ?? [])
      .filter((usage) => {
        const input = usage.inputId ? inputMap.get(usage.inputId) : undefined
        if (filters.category && (input?.inputType ?? 'OTHER') !== filters.category) return false
        if (filters.plotId && usage.plotId !== filters.plotId) return false
        if (start && dateKey(usage.usedAt) < start) return false
        if (end && dateKey(usage.usedAt) > end) return false
        if (keyword) {
          const haystack = `${usage.inputName ?? ''}${input?.inputName ?? ''}${
            usage.operatorId ?? ''
          }`
          if (!haystack.includes(keyword)) return false
        }
        return true
      })
      .map((usage) => {
        const input = usage.inputId ? inputMap.get(usage.inputId) : undefined
        const items = checkCompliance({
          inputName: usage.inputName ?? input?.inputName,
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
          items,
          level: summarizeCompliance(items),
          plotName: (usage.plotId ? plotMap.get(usage.plotId) : undefined) || usage.plotId || '-',
        }
      })
      .sort((a, b) => String(b.usage.usedAt ?? '').localeCompare(String(a.usage.usedAt ?? '')))
  }, [usagesQuery.data, inputMap, plotMap, filters])

  /** 出入库流水行 */
  const flowRows = useMemo<FlowRow[]>(() => {
    const start = filters.dateRange?.[0]?.format('YYYY-MM-DD')
    const end = filters.dateRange?.[1]?.format('YYYY-MM-DD')
    const keyword = (filters.keyword ?? '').trim()
    return (flowsQuery.data ?? [])
      .filter((flow) => {
        const input = flow.inputId ? inputMap.get(flow.inputId) : undefined
        if (filters.category && (input?.inputType ?? 'OTHER') !== filters.category) return false
        if (start && dateKey(flow.createdAt) < start) return false
        if (end && dateKey(flow.createdAt) > end) return false
        if (keyword) {
          const haystack = `${input?.inputName ?? ''}${flow.batchNo ?? ''}${
            flow.operatorId ?? ''
          }`
          if (!haystack.includes(keyword)) return false
        }
        return true
      })
      .map((flow) => {
        const input = flow.inputId ? inputMap.get(flow.inputId) : undefined
        return {
          ...flow,
          inputLabel: input?.inputName ?? flow.inputId ?? '-',
          category: input?.inputType ?? 'OTHER',
        }
      })
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  }, [flowsQuery.data, inputMap, filters])

  /** 分页切片 */
  const pagedUsage = useMemo<UsageRow[]>(
    () => usageRows.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [usageRows, pageNum, pageSize],
  )
  const pagedFlow = useMemo<FlowRow[]>(
    () => flowRows.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [flowRows, pageNum, pageSize],
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

  /** 导出当前 Tab */
  const handleExport = (): void => {
    if (tab === 'usage') {
      if (usageRows.length === 0) {
        message.warning('暂无可导出的数据')
        return
      }
      downloadCsv(
        '投入品使用台账',
        ['日期', '投入品', '类型', '地块', '用量', '单位', '操作人', '合规', '上链'],
        usageRows.map((row) => [
          fmtDate(row.usage.usedAt),
          row.usage.inputName ?? row.input?.inputName ?? '-',
          categoryMeta(row.input?.inputType).label,
          row.plotName,
          fmtNumber(row.usage.dosage),
          row.usage.unit ?? '',
          row.usage.operatorId ?? '',
          row.items.map((item) => `${item.label}:${item.result}`).join('；'),
          chainedBizIds.has(row.usage.usageId) ? '已上链' : '未上链',
        ]),
      )
      return
    }
    if (flowRows.length === 0) {
      message.warning('暂无可导出的数据')
      return
    }
    downloadCsv(
      '投入品出入库台账',
      ['时间', '投入品', '类型', '数量', '批次号', '有效期至', '操作人', '关联任务', '备注'],
      flowRows.map((row) => [
        fmtDate(row.createdAt, 'YYYY-MM-DD HH:mm'),
        row.inputLabel,
        categoryMeta(row.category).label,
        fmtNumber(row.qty),
        row.batchNo ?? '',
        fmtDate(row.expireDate),
        row.operatorId ?? '',
        row.relatedTaskId ?? '',
        row.remark ?? '',
      ]),
    )
  }

  /** 使用台账列（原型 P22） */
  const usageColumns: ProColumns<UsageRow>[] = [
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
      title: '类型',
      key: 'category',
      width: 90,
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
      title: '上链',
      key: 'chain',
      width: 90,
      render: (_, record) =>
        chainedBizIds.has(record.usage.usageId) ? (
          <Tag color="green">🔗</Tag>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
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

  /** 出入库流水列 */
  const flowColumns: ProColumns<FlowRow>[] = [
    {
      title: '时间',
      key: 'createdAt',
      width: 160,
      render: (_, record) => fmtDate(record.createdAt, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '投入品',
      key: 'inputLabel',
      width: 150,
      render: (_, record) => (
        <Typography.Link onClick={() => navigate(`/production/inputs/${record.inputId ?? ''}`)}>
          {record.inputLabel}
        </Typography.Link>
      ),
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
      width: 120,
      render: (_, record) => {
        const meta = flowTypeMeta(record.flowType)
        return (
          <Typography.Text type={meta.direction === 1 ? 'success' : 'danger'}>
            {meta.direction === 1 ? '+' : '-'}
            {fmtNumber(Math.abs(record.qty ?? 0))}
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

  const loading = inputsQuery.isFetching || usagesQuery.isFetching || flowsQuery.isFetching
  const isError = inputsQuery.isError || usagesQuery.isError || flowsQuery.isError

  return (
    <PageContainer
      title="💊 投入品使用台账"
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      extra={[
        <Button key="scan" icon={<ScanOutlined />} onClick={() => navigate('/production/inputs')}>
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
        <Button key="export" icon={<DownloadOutlined />} onClick={handleExport}>
          导出
        </Button>,
      ]}
    >
      <Card style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" style={{ rowGap: 12 }}>
          <Form.Item name="dateRange" label="日期区间">
            <DatePicker.RangePicker
              allowClear
              placeholder={['开始日期', '结束日期']}
              defaultValue={[dayjs().subtract(30, 'day'), dayjs()]}
            />
          </Form.Item>
          <Form.Item name="category" label="类型">
            <Select
              allowClear
              placeholder="全部类型"
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
          <Form.Item name="keyword" label="关键字">
            <Input allowClear placeholder="投入品 / 批次号 / 操作人" style={{ width: 180 }} />
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

      <Card>
        <Tabs
          activeKey={tab}
          onChange={(key) => {
            setTab(key as LedgerTab)
            setPageNum(1)
          }}
          items={[
            { key: 'usage', label: `使用台账(${usageRows.length})` },
            { key: 'stock', label: `出入库流水(${flowRows.length})` },
          ]}
        />
        {isError ? (
          <Empty
            description={
              <Space direction="vertical">
                <Typography.Text type="danger">台账数据加载失败，请稍后重试</Typography.Text>
                <Button
                  onClick={() =>
                    void queryClient.invalidateQueries({ queryKey: ['production-inputs'] })
                  }
                >
                  重新加载
                </Button>
              </Space>
            }
          />
        ) : tab === 'usage' ? (
          <ProTable<UsageRow>
            rowKey={(record) => record.usage.usageId}
            columns={usageColumns}
            dataSource={pagedUsage}
            loading={loading}
            search={false}
            options={{
              reload: () => void queryClient.invalidateQueries({ queryKey: ['production-inputs'] }),
              density: true,
              setting: true,
            }}
            pagination={{
              current: pageNum,
              pageSize,
              total: usageRows.length,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (nextPage, nextSize) => {
                setPageNum(nextPage)
                setPageSize(nextSize)
              },
            }}
          />
        ) : (
          <ProTable<FlowRow>
            rowKey="flowId"
            columns={flowColumns}
            dataSource={pagedFlow}
            loading={loading}
            search={false}
            options={{
              reload: () => void queryClient.invalidateQueries({ queryKey: ['production-inputs'] }),
              density: true,
              setting: true,
            }}
            pagination={{
              current: pageNum,
              pageSize,
              total: flowRows.length,
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
    </PageContainer>
  )
}
