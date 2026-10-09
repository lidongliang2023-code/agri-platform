/**
 * 页面名称：使用记录
 * 路由路径：/production/inputs/usages
 * 所属模块：农资投入品管理
 * PRD 序号：PRD 6.1 #22「使用记录」（原型未覆盖，按 PRD 7.2 与 11.2.4 实现）
 *
 * 实现要点：
 * - 使用记录台账：关联任务 / 关联地块 / 用量 / 使用日期 / 操作人 / 施用方式
 * - 用量合规校验：超过登记上限（推荐剂量上限）标红提示（R-INPUT-04）
 * - 合规列：四项校验（禁用 / 用量 / 休药期 / 累计用量）取最严结论
 * - 上链列：展示链上状态，支持手动提交存证（bizType 2 = 投入品使用）
 * - 支持按投入品 / 地块 / 任务 / 日期区间筛选，新建使用记录与导出
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
  DatePicker,
  Empty,
  Form,
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
import { createUsage, pageInputs, pageUsages, removeUsage } from '@/api/inputs'
import type { InputInfo } from '@/api/inputs'
import { listChainRecords, submitChain } from '@/api/blockchain'
import type { InputUsageRecord, Member, Plot, Task } from '@/types'
import {
  DOSAGE_UNIT_OPTIONS,
  USAGE_METHOD_OPTIONS,
  categoryMeta,
  checkCompliance,
  downloadCsv,
  fmtDate,
  fmtNumber,
  recommendDosage,
  summarizeCompliance,
} from './shared'
import type { ComplianceItem, ComplianceLevel } from './shared'

/** 筛选条件 */
interface UsageFilters {
  /** 投入品 ID */
  inputId?: string
  /** 地块 ID */
  plotId?: string
  /** 关联任务 ID */
  taskId?: string
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
  const [filters, setFilters] = useState<UsageFilters>({})
  const [filterForm] = Form.useForm<UsageFilters>()
  const [createForm] = Form.useForm<CreateUsageForm>()
  const [createOpen, setCreateOpen] = useState<boolean>(false)

  /** 使用记录 */
  const usagesQuery = useQuery({
    queryKey: ['production-inputs', 'usages'],
    queryFn: () => pageUsages({ pageNum: 1, pageSize: 500 }),
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

  /** 链上存证（bizType 2 = 投入品使用） */
  const chainQuery = useQuery({
    queryKey: ['blockchain', 'records', 'input-usage'],
    queryFn: () => listChainRecords({ bizType: 2, pageNum: 1, pageSize: 200 }),
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
      message.success('使用记录已登记')
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

  /** 提交上链 */
  const chainMutation = useMutation({
    mutationFn: (usageId: string) =>
      submitChain({ bizId: usageId, bizType: 2, bizSummary: '投入品使用记录存证' }),
    onSuccess: () => {
      message.success('已提交上链')
      void queryClient.invalidateQueries({ queryKey: ['blockchain'] })
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

  /** 已上链业务单号集合 */
  const chainedBizIds = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    ;(chainQuery.data?.list ?? []).forEach((record) => {
      if (record.status === 3) set.add(record.bizId)
    })
    return set
  }, [chainQuery.data])

  /** 使用记录行（含合规校验与超量判定） */
  const rows = useMemo<UsageRow[]>(() => {
    const start = filters.dateRange?.[0]?.format('YYYY-MM-DD')
    const end = filters.dateRange?.[1]?.format('YYYY-MM-DD')
    return (usagesQuery.data?.list ?? [])
      .filter((usage) => {
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

  /** 统计 */
  const stats = useMemo(() => {
    const plots = new Set<string>()
    rows.forEach((row) => {
      if (row.usage.plotId) plots.add(row.usage.plotId)
    })
    return {
      total: rows.length,
      plotCount: plots.size,
      overdose: rows.filter((row) => row.overdose).length,
      chained: rows.filter((row) => chainedBizIds.has(row.usage.usageId)).length,
    }
  }, [rows, chainedBizIds])

  const pagedRows = useMemo<UsageRow[]>(
    () => rows.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [rows, pageNum, pageSize],
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
    if (rows.length === 0) {
      message.warning('暂无可导出的数据')
      return
    }
    downloadCsv(
      '投入品使用记录',
      [
        '使用日期',
        '投入品',
        '分类',
        '地块',
        '关联任务',
        '用量',
        '单位',
        '施用方式',
        '操作人',
        '安全间隔期(天)',
        '合规结论',
        '上链',
      ],
      rows.map((row) => [
        fmtDate(row.usage.usedAt, 'YYYY-MM-DD HH:mm'),
        row.usage.inputName ?? row.input?.inputName ?? '-',
        categoryMeta(row.input?.inputType).label,
        row.plotName,
        row.taskName,
        fmtNumber(row.usage.dosage),
        row.usage.unit ?? '',
        row.usage.method ?? '',
        row.usage.operatorId ?? '',
        row.usage.safetyIntervalDays ?? '',
        row.items.map((item) => `${item.label}:${item.result}`).join('；'),
        chainedBizIds.has(row.usage.usageId) ? '已上链' : '未上链',
      ]),
    )
  }

  /** 列定义 */
  const columns: ProColumns<UsageRow>[] = [
    {
      title: '使用日期',
      key: 'usedAt',
      width: 160,
      render: (_, record) => fmtDate(record.usage.usedAt, 'YYYY-MM-DD HH:mm'),
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
      title: '分类',
      key: 'category',
      width: 90,
      render: (_, record) => {
        const meta = categoryMeta(record.input?.inputType)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: '地块', key: 'plotName', width: 120, render: (_, record) => record.plotName },
    {
      title: '关联任务',
      key: 'taskName',
      width: 160,
      ellipsis: true,
      render: (_, record) => record.taskName,
    },
    {
      title: '用量',
      key: 'dosage',
      width: 150,
      render: (_, record) => {
        const text = `${fmtNumber(record.usage.dosage)} ${record.usage.unit ?? ''}`
        if (record.overdose) {
          return (
            <Tooltip
              title={`超过登记上限 ${record.recommendMax ?? '-'} ${
                record.usage.unit ?? ''
              }，需农艺师确认（R-INPUT-04）`}
            >
              <Typography.Text strong type="danger">
                {text} ⚠️ 超量
              </Typography.Text>
            </Tooltip>
          )
        }
        return <Typography.Text>{text}</Typography.Text>
      },
    },
    { title: '施用方式', key: 'method', width: 100, render: (_, record) => record.usage.method ?? '-' },
    {
      title: '操作人',
      key: 'operatorId',
      width: 110,
      render: (_, record) => record.usage.operatorId ?? '-',
    },
    {
      title: '安全间隔期',
      key: 'safetyIntervalDays',
      width: 110,
      render: (_, record) =>
        record.usage.safetyIntervalDays === undefined || record.usage.safetyIntervalDays === null
          ? '-'
          : `${record.usage.safetyIntervalDays} 天`,
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
          <Tooltip title={record.items.map((item) => `${item.label}：${item.result}`).join('；')}>
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
      width: 110,
      render: (_, record) =>
        chainedBizIds.has(record.usage.usageId) ? (
          <Tag color="green">🔗 已上链</Tag>
        ) : (
          <Button
            size="small"
            icon={<SafetyCertificateOutlined />}
            loading={chainMutation.isPending}
            onClick={() => chainMutation.mutate(record.usage.usageId)}
          >
            上链
          </Button>
        ),
    },
    {
      title: '操作',
      key: 'option',
      width: 130,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link
          key="detail"
          onClick={() => navigate(`/production/inputs/${record.usage.inputId ?? ''}`)}
        >
          详情
        </Typography.Link>,
        <Popconfirm
          key="delete"
          title="确认删除该使用记录？"
          okText="确认删除"
          cancelText="取消"
          onConfirm={() => deleteMutation.mutate(record.usage.usageId)}
        >
          <Typography.Link type="danger">删除</Typography.Link>
        </Popconfirm>,
      ],
    },
  ]

  const loading = usagesQuery.isFetching || inputsQuery.isFetching
  const isError = usagesQuery.isError || inputsQuery.isError

  return (
    <PageContainer
      title="🧾 投入品使用记录"
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          + 登记使用记录
        </Button>,
        <Button key="export" icon={<DownloadOutlined />} onClick={handleExport}>
          导出
        </Button>,
      ]}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="使用记录" value={stats.total} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="涉及地块" value={stats.plotCount} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="超量记录"
              value={stats.overdose}
              suffix="条"
              valueStyle={{ color: stats.overdose > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已上链" value={stats.chained} suffix="条" />
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

      <Card>
        <Form form={filterForm} layout="inline" style={{ rowGap: 12, marginBottom: 12 }}>
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
          <Form.Item name="dateRange" label="使用日期">
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
                <Typography.Text type="danger">使用记录加载失败，请稍后重试</Typography.Text>
                <Button onClick={() => void invalidateAll()}>重新加载</Button>
              </Space>
            }
          />
        ) : (
          <ProTable<UsageRow>
            rowKey={(record) => record.usage.usageId}
            columns={columns}
            dataSource={pagedRows}
            loading={loading}
            search={false}
            options={{ reload: () => void invalidateAll(), density: true, setting: true }}
            pagination={{
              current: pageNum,
              pageSize,
              total: rows.length,
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
    </PageContainer>
  )
}
