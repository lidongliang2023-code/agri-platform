/**
 * 页面名称：采收计划
 * 路由路径：/production/harvests/plan
 * 所属模块：采收与库存管理
 * PRD 序号：PRD 6.1 #31（采收计划制定、成熟度评估、人力安排）
 *
 * 说明：原型未覆盖本页，按 PRD 6.1 #31 / 8.6.2 HARV-01 设计，沿用原型 P13 的视觉语言。
 *
 * 设计决策：
 * 1. 计划表格字段取自 PRD「采收计划制定」：地块 / 作物 / 预计采收期 / 预计产量 / 成熟度 / 人力安排 / 状态
 * 2. 成熟度评估：以 0-100 评分 + 分级（未成熟 <60 / 初熟 60-79 / 适采 80-94 / 过熟 ≥95），
 *    表格内用进度条直观呈现，弹窗内滑块评分并自动推导分级
 * 3. 人力安排：多选团队成员 + 计划人数 + 机具安排，安排后计划自动从「待采收」进入「采收中」
 * 4. 计划与采收登记联动：操作列提供「登记采收」直达新建采收页
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
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Slider,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd'
import { PlusOutlined, UserSwitchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import { queryHarvestPlans, submitHarvestPlan, submitLabor, submitMaturity } from '@/api/harvests'
import { listMembers } from '@/api/members'
import { listPlots } from '@/api/plots'
import { listPlans } from '@/api/plans'
import type { HarvestPlan, Member, Plan, Plot } from '@/types'
import type { MaturityLevel } from '@/types'
import {
  HARVEST_PLAN_STATUS_META,
  HARVEST_PLAN_STATUS_OPTIONS,
  HARVEST_UNIT_OPTIONS,
  MATURITY_LEVEL_META,
  resolveMaturityLevel,
} from '@/types'

/** 计划筛选条件 */
interface PlanFilters {
  /** 地块 ID */
  plotId?: string
  /** 执行状态 */
  status?: 1 | 2 | 3
}

/** 新建计划表单值 */
interface PlanFormValues {
  /** 地块 ID */
  plotId?: string
  /** 作物名称 */
  cropName?: string
  /** 作物品种 */
  cropVariety?: string
  /** 预计采收日期 */
  planHarvestDate?: Dayjs
  /** 预计产量 */
  expectedQuantity?: number
  /** 计量单位 */
  unit?: string
  /** 负责人 */
  managerId?: string
  /** 计划人力 */
  laborCount?: number
  /** 备注 */
  remark?: string
}

/** 成熟度评估表单值 */
interface MaturityFormValues {
  /** 成熟度评分 */
  maturityScore?: number
  /** 评估人 */
  maturityOperator?: string
  /** 评估说明 */
  remark?: string
}

/** 人力安排表单值 */
interface LaborFormValues {
  /** 人员 ID 列表 */
  laborIds?: string[]
  /** 计划人力 */
  laborCount?: number
  /** 机具安排 */
  toolPlan?: string
}

/** 成熟度评分 → 进度条状态 */
function maturityProgressStatus(score: number): 'success' | 'exception' | 'normal' | 'active' {
  if (score >= 95) return 'exception'
  if (score >= 80) return 'success'
  if (score >= 60) return 'active'
  return 'normal'
}

/**
 * 采收计划页面
 *
 * 业务职责：制定地块采收计划，跟踪成熟度评估与人力安排，并联动采收登记。
 *
 * @returns 页面内容
 */
export default function HarvestPlan(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [filters, setFilters] = useState<PlanFilters>({})
  const [filterForm] = Form.useForm<PlanFilters>()

  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [maturityTarget, setMaturityTarget] = useState<HarvestPlan | null>(null)
  const [laborTarget, setLaborTarget] = useState<HarvestPlan | null>(null)
  const [maturityScore, setMaturityScore] = useState<number>(60)
  const [createForm] = Form.useForm<PlanFormValues>()
  const [maturityForm] = Form.useForm<MaturityFormValues>()
  const [laborForm] = Form.useForm<LaborFormValues>()

  /** 计划列表 */
  const planQuery = useQuery({
    queryKey: ['production-harvest-plans', farmId, filters, pageNum, pageSize],
    enabled: Boolean(farmId),
    queryFn: () => queryHarvestPlans({ farmId, ...filters, pageNum, pageSize }),
  })

  /** 地块下拉 */
  const plotQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 人员下拉 */
  const memberQuery = useQuery({
    queryKey: ['member-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listMembers({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 种养计划（新建计划时自动带出作物 / 品种 / 面积） */
  const planRefQuery = useQuery({
    queryKey: ['plan-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlans({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 统一失效刷新 */
  const invalidatePlans = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['production-harvest-plans'] })

  /** 新建计划 */
  const createMutation = useMutation({
    mutationFn: (payload: Partial<HarvestPlan>) => submitHarvestPlan(payload),
    onSuccess: () => {
      message.success('采收计划已创建')
      setCreateOpen(false)
      createForm.resetFields()
      void invalidatePlans()
    },
    onError: (error) => {
      message.error(error.message || '创建失败，请稍后重试', 6)
    },
  })

  /** 成熟度评估 */
  const maturityMutation = useMutation({
    mutationFn: (payload: { planId: string; score: number; operator?: string; remark?: string }) =>
      submitMaturity(payload.planId, {
        maturityScore: payload.score,
        maturityLevel: resolveMaturityLevel(payload.score),
        maturityOperator: payload.operator,
        remark: payload.remark,
      }),
    onSuccess: () => {
      message.success('成熟度评估已提交')
      setMaturityTarget(null)
      maturityForm.resetFields()
      void invalidatePlans()
    },
    onError: (error) => {
      message.error(error.message || '提交失败，请稍后重试', 6)
    },
  })

  /** 人力安排 */
  const laborMutation = useMutation({
    mutationFn: (payload: {
      planId: string
      laborIds: string[]
      laborNames: string
      laborCount?: number
      toolPlan?: string
    }) => submitLabor(payload.planId, payload),
    onSuccess: () => {
      message.success('人力安排已保存')
      setLaborTarget(null)
      laborForm.resetFields()
      void invalidatePlans()
    },
    onError: (error) => {
      message.error(error.message || '保存失败，请稍后重试', 6)
    },
  })

  const plans = useMemo<HarvestPlan[]>(() => planQuery.data?.list ?? [], [planQuery.data])

  /** 统计概览 */
  const overview = useMemo(() => {
    const total = plans.length
    const pending = plans.filter((item) => item.status === 1).length
    const harvesting = plans.filter((item) => item.status === 2).length
    const expected = plans.reduce((sum, item) => sum + item.expectedQuantity, 0)
    return { total, pending, harvesting, expected }
  }, [plans])

  /** 地块下拉选项 */
  const plotOptions = useMemo(
    () =>
      (plotQuery.data?.list ?? []).map((plot: Plot) => ({
        value: plot.plotId,
        label: plot.plotName,
      })),
    [plotQuery.data],
  )

  /** 人员下拉选项 */
  const memberOptions = useMemo(
    () =>
      (memberQuery.data?.list ?? []).map((member: Member) => ({
        value: member.memberId,
        label: member.realName,
      })),
    [memberQuery.data],
  )

  /** 查询 / 重置 */
  const handleSearch = (): void => {
    setPageNum(1)
    setFilters(filterForm.getFieldsValue())
  }

  const handleReset = (): void => {
    filterForm.resetFields()
    setPageNum(1)
    setFilters({})
  }

  /** 地块变化时自动带出作物信息 */
  const handlePlotChange = (value: string): void => {
    const ref = (planRefQuery.data?.list ?? []).find((plan: Plan) => plan.plotId === value)
    if (ref) {
      createForm.setFieldsValue({
        cropName: ref.cropName,
        cropVariety: ref.cropVariety,
        expectedQuantity: ref.expectedYield,
      })
    }
  }

  /** 提交新建计划 */
  const handleCreate = (): void => {
    createForm.validateFields().then((values) => {
      const manager = (memberQuery.data?.list ?? []).find(
        (member: Member) => member.memberId === values.managerId,
      )
      const plot = (plotQuery.data?.list ?? []).find((item: Plot) => item.plotId === values.plotId)
      createMutation.mutate({
        farmId,
        farmName: currentFarm?.farmName,
        plotId: values.plotId,
        plotName: plot?.plotName,
        cropId: plot?.cropId ?? '',
        cropName: values.cropName,
        cropVariety: values.cropVariety,
        planHarvestDate: values.planHarvestDate?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
        expectedQuantity: values.expectedQuantity ?? 0,
        unit: values.unit ?? 'kg',
        managerId: values.managerId,
        managerName: manager?.realName,
        status: 1,
        laborCount: values.laborCount ?? 0,
        laborIds: [],
        laborNames: '',
        maturityScore: 0,
        remark: values.remark,
      })
    })
  }

  /** 打开成熟度评估弹窗 */
  const openMaturity = (plan: HarvestPlan): void => {
    setMaturityTarget(plan)
    const score = plan.maturityScore ?? 60
    setMaturityScore(score)
    maturityForm.setFieldsValue({
      maturityScore: score,
      maturityOperator: plan.managerName,
      remark: plan.remark,
    })
  }

  /** 提交成熟度评估 */
  const handleMaturity = (): void => {
    if (!maturityTarget) return
    maturityForm.validateFields().then((values) => {
      maturityMutation.mutate({
        planId: maturityTarget.planId,
        score: values.maturityScore ?? maturityScore,
        operator: values.maturityOperator,
        remark: values.remark,
      })
    })
  }

  /** 打开人力安排弹窗 */
  const openLabor = (plan: HarvestPlan): void => {
    setLaborTarget(plan)
    laborForm.setFieldsValue({
      laborIds: plan.laborIds ?? [],
      laborCount: plan.laborCount ?? 0,
      toolPlan: plan.toolPlan,
    })
  }

  /** 提交人力安排 */
  const handleLabor = (): void => {
    if (!laborTarget) return
    laborForm.validateFields().then((values) => {
      const ids = values.laborIds ?? []
      const names = (memberQuery.data?.list ?? [])
        .filter((member: Member) => ids.includes(member.memberId))
        .map((member: Member) => member.realName)
        .join(',')
      laborMutation.mutate({
        planId: laborTarget.planId,
        laborIds: ids,
        laborNames: names,
        laborCount: values.laborCount ?? ids.length,
        toolPlan: values.toolPlan,
      })
    })
  }

  /** 表格列定义 */
  const columns: ProColumns<HarvestPlan>[] = [
    { title: '计划编号', dataIndex: 'planNo', width: 130 },
    {
      title: '地块',
      dataIndex: 'plotName',
      width: 110,
      render: (_, record) => record.plotName ?? record.plotId ?? '-',
    },
    {
      title: '作物',
      key: 'crop',
      width: 160,
      render: (_, record) => (
        <span>
          {record.cropName ?? '-'}
          {record.cropVariety ? (
            <Typography.Text type="secondary"> ({record.cropVariety})</Typography.Text>
          ) : null}
        </span>
      ),
    },
    { title: '预计采收期', dataIndex: 'planHarvestDate', width: 130 },
    {
      title: '预计产量',
      dataIndex: 'expectedQuantity',
      width: 120,
      render: (_, record) => `${record.expectedQuantity.toLocaleString()} ${record.unit}`,
    },
    {
      title: '成熟度',
      key: 'maturity',
      width: 220,
      render: (_, record) => {
        const score = record.maturityScore ?? 0
        const level = (record.maturityLevel ?? resolveMaturityLevel(score)) as MaturityLevel
        const meta = MATURITY_LEVEL_META[level]
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Progress
              percent={score}
              size="small"
              status={maturityProgressStatus(score)}
              format={(percent) => `${percent ?? 0} 分`}
            />
            <Space size={4}>
              <Tag color={meta?.color ?? 'default'}>{meta?.label ?? level}</Tag>
              {record.maturityOperator ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  评估人 {record.maturityOperator}
                </Typography.Text>
              ) : null}
            </Space>
          </Space>
        )
      },
    },
    {
      title: '人力安排',
      key: 'labor',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Space size={4} wrap>
            <Tag icon={<UserSwitchOutlined />} color="blue">
              {record.laborCount ?? 0} 人
            </Tag>
            {(record.laborIds ?? []).length === 0 ? (
              <Tag color="default">未分配</Tag>
            ) : (
              (record.laborNames ?? '')
                .split(',')
                .filter(Boolean)
                .map((name) => (
                  <Tag key={name}>{name}</Tag>
                ))
            )}
          </Space>
          {record.toolPlan ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              机具：{record.toolPlan}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => {
        const meta = HARVEST_PLAN_STATUS_META[record.status]
        return <Tag color={meta?.color ?? 'default'}>{meta?.label ?? record.status}</Tag>
      },
    },
    {
      title: '操作',
      key: 'option',
      width: 220,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link key="maturity" onClick={() => openMaturity(record)}>
          成熟度评估
        </Typography.Link>,
        <Typography.Link key="labor" onClick={() => openLabor(record)}>
          人力安排
        </Typography.Link>,
        <Typography.Link
          key="harvest"
          onClick={() => navigate(`/production/harvests/create?plotId=${record.plotId ?? ''}`)}
        >
          登记采收
        </Typography.Link>,
      ],
    },
  ]

  return (
    <PageContainer
      title="📅 采收计划"
      subTitle={currentFarm?.farmName}
      extra={[
        <Button key="records" onClick={() => navigate('/production/harvests')}>
          采收记录
        </Button>,
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          新建采收计划
        </Button>,
      ]}
    >
      {planQuery.data?.demo ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前显示的是本地示例数据，未连接服务端"
          description="采收计划接口不可用（服务未启动或网络异常），以下计划为前端内置示例，不是真实业务数据；新建计划、成熟度评估、人力安排均不会写入服务端。"
        />
      ) : null}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="计划总数" value={overview.total} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待采收" value={overview.pending} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="采收中"
              value={overview.harvesting}
              suffix="条"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="预计总产量"
              value={overview.expected}
              suffix="kg"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" style={{ rowGap: 12 }}>
          <Form.Item name="plotId" label="地块">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部地块"
              options={plotOptions}
              style={{ width: 160 }}
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              placeholder="全部状态"
              options={HARVEST_PLAN_STATUS_OPTIONS}
              style={{ width: 140 }}
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

      <Card>
        {!farmId ? (
          <Empty description="请先在顶部切换农场" />
        ) : planQuery.isError ? (
          <Empty
            description={
              <Space direction="vertical">
                <Typography.Text type="danger">采收计划加载失败，请稍后重试</Typography.Text>
                <Button onClick={() => void invalidatePlans()}>重新加载</Button>
              </Space>
            }
          />
        ) : (
          <ProTable<HarvestPlan>
            rowKey="planId"
            columns={columns}
            dataSource={plans}
            loading={planQuery.isFetching}
            search={false}
            options={{ reload: () => void invalidatePlans(), density: true, setting: true }}
            pagination={{
              current: pageNum,
              pageSize,
              total: planQuery.data?.total ?? 0,
              showSizeChanger: true,
              onChange: (nextPage, nextSize) => {
                setPageNum(nextPage)
                setPageSize(nextSize)
              },
            }}
          />
        )}
      </Card>

      {/* 新建采收计划 */}
      <Modal
        title="新建采收计划"
        open={createOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false)
          createForm.resetFields()
        }}
        destroyOnClose
        width={720}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="plotId"
                label="地块"
                rules={[{ required: true, message: '请选择地块' }]}
              >
                <Select
                  placeholder="请选择地块"
                  options={plotOptions}
                  showSearch
                  optionFilterProp="label"
                  onChange={handlePlotChange}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cropName"
                label="作物名称"
                rules={[{ required: true, message: '请输入作物名称' }]}
              >
                <Input placeholder="如 番茄" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cropVariety" label="作物品种">
                <Input placeholder="如 中杂9号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="planHarvestDate"
                label="预计采收日期"
                rules={[{ required: true, message: '请选择预计采收日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="expectedQuantity"
                label="预计产量"
                rules={[{ required: true, message: '请输入预计产量' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit" label="单位" initialValue="kg">
                <Select options={HARVEST_UNIT_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="laborCount" label="计划人力(人)">
                <InputNumber style={{ width: '100%' }} min={0} precision={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="managerId" label="负责人">
            <Select
              allowClear
              placeholder="请选择负责人"
              options={memberOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可填写采收标准、注意事项等" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 成熟度评估 */}
      <Modal
        title={`成熟度评估：${maturityTarget?.planNo ?? ''}`}
        open={Boolean(maturityTarget)}
        okText="提交评估"
        cancelText="取消"
        confirmLoading={maturityMutation.isPending}
        onOk={handleMaturity}
        onCancel={() => {
          setMaturityTarget(null)
          maturityForm.resetFields()
        }}
        destroyOnClose
      >
        <Form form={maturityForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="maturityScore"
            label="成熟度评分（0-100）"
            rules={[{ required: true, message: '请拖动滑块评分' }]}
          >
            <Slider
              min={0}
              max={100}
              step={1}
              marks={{ 0: '0', 60: '初熟', 80: '适采', 95: '过熟', 100: '100' }}
              onChange={(value) => setMaturityScore(Number(value))}
            />
          </Form.Item>
          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message={`当前评分 ${maturityScore} 分，系统判定为「${resolveMaturityLevel(maturityScore)}」`}
          />
          <Form.Item name="maturityOperator" label="评估人">
            <Select
              allowClear
              placeholder="请选择评估人"
              options={memberOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="remark" label="评估说明">
            <Input.TextArea rows={3} placeholder="可填写果实着色度、硬度、糖度等观察结果" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 人力安排 */}
      <Modal
        title={`人力安排：${laborTarget?.planNo ?? ''}`}
        open={Boolean(laborTarget)}
        okText="保存安排"
        cancelText="取消"
        confirmLoading={laborMutation.isPending}
        onOk={handleLabor}
        onCancel={() => {
          setLaborTarget(null)
          laborForm.resetFields()
        }}
        destroyOnClose
      >
        <Form form={laborForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="laborIds"
            label="分配人员"
            rules={[{ required: true, message: '请至少选择一名采收人员' }]}
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="请选择采收人员"
              options={memberOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="laborCount" label="计划人力(人)">
            <InputNumber style={{ width: '100%' }} min={0} precision={0} />
          </Form.Item>
          <Form.Item name="toolPlan" label="机具安排">
            <Input.TextArea rows={2} placeholder="如 采收筐 20 个、电动转运车 2 台" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="保存后计划状态自动由「待采收」推进为「采收中」"
          />
        </Form>
      </Modal>
    </PageContainer>
  )
}
