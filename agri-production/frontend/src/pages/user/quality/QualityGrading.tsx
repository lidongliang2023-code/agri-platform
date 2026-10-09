/**
 * 页面名称：质量分级管理
 * 路由路径：/production/quality/grading
 * 所属模块：质量检测与溯源
 * PRD 序号：PRD 6.1 #35（原型无此页，按 PRD「等级评定、人工复核、等级变更记录」设计）
 *
 * 页面结构：
 * - 统计卡：待复核 / 已确认 / 检测合格 / 检测不合格
 * - 等级分布：A / B / C / D / 待检 各等级批次数（ECharts 饼图）
 * - 等级评定列表：批次号 | 产品 | 地块 | 采收日期 | 初评等级 | 复核等级 | 评定人 | 评定时间 | 状态 | 操作
 * - 人工复核：改判等级 + 填写变更原因，调用 PUT /harvests/{batchId} 回写批次等级
 * - 等级变更记录：谁在何时从什么等级改为什么等级、原因（时间线，按批次与全局两种视角）
 *
 * 设计说明：后端 prod_inspection 暂无独立的等级评定表，本页以「采收批次等级」为初评等级，
 * 复核结果通过 PUT /harvests/{batchId} 真实回写；等级变更流水持久化在浏览器
 * localStorage（key: agri_quality_grade_reviews_v1），待后端补齐后可整体切换为接口。
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd'
import { CheckCircleOutlined, HistoryOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { EChartsOption } from 'echarts'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import { fetchGradingStats } from '@/api/quality'
import { listHarvests, updateHarvest } from '@/api/harvests'
import type {
  GradeAssessment,
  GradeChangeRecord,
  HarvestBatch,
  HarvestGrade,
} from '@/types'

/** 等级评定本地存储键 */
const STORAGE_KEY = 'agri_quality_grade_reviews_v1'

/** 可选复核等级 */
const GRADE_OPTIONS: { value: string; label: string }[] = [
  { value: 'A', label: 'A 级（优质）' },
  { value: 'B', label: 'B 级（良好）' },
  { value: 'C', label: 'C 级（合格）' },
  { value: 'D', label: 'D 级（等外）' },
]

/** 等级展示色 */
const GRADE_COLOR: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
  reject: 'volcano',
}

/** 等级评定标准参考（PRD 2.2.3 质量分级标准体系） */
const GRADE_CRITERIA: { grade: string; criteria: string }[] = [
  { grade: 'A 级', criteria: '外观完整、单果重达标、糖度高于基准、无病斑与机械损伤' },
  { grade: 'B 级', criteria: '外观轻微瑕疵、单果重达标、糖度达到基准值' },
  { grade: 'C 级', criteria: '外观有明显瑕疵或单果重略低于基准，仍符合食品安全标准' },
  { grade: 'D 级', criteria: '等外品，仅可用于深加工或饲料，禁止作为鲜食商品销售' },
]

/** 人工复核表单值 */
interface ReviewFormValues {
  /** 复核等级 */
  grade: string
  /** 评定人 */
  assessorName: string
  /** 变更原因 */
  reason?: string
}

/** 列表筛选条件 */
interface GradeFilters {
  /** 关键字（批次号 / 作物） */
  keyword?: string
  /** 等级 */
  grade?: string
  /** 复核状态 */
  reviewStatus?: string
}

/** 本地等级评定状态 */
interface GradeStore {
  /** 批次 → 复核结果 */
  reviews: Record<string, { grade: string; assessorName: string; assessedAt: string; remark?: string }>
  /** 等级变更流水 */
  changes: GradeChangeRecord[]
}

/**
 * 读取本地等级评定状态。
 *
 * @returns 等级评定状态
 */
function readStore(): GradeStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { reviews: {}, changes: [] }
    const parsed = JSON.parse(raw) as Partial<GradeStore>
    return {
      reviews: parsed.reviews ?? {},
      changes: Array.isArray(parsed.changes) ? parsed.changes : [],
    }
  } catch {
    return { reviews: {}, changes: [] }
  }
}

/**
 * 写入本地等级评定状态。
 *
 * @param store 等级评定状态
 */
function writeStore(store: GradeStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // localStorage 不可用时静默降级为内存态
  }
}

/** 仅保留日期 */
function formatDate(value?: string): string {
  if (!value) return '-'
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD') : value
}

/**
 * 读取分级统计中的单项数量。
 *
 * 纪律：接口未返回该项（或请求失败）时返回 null，由页面显示「—」+ 可见提示，
 * **不回落 0**——0 会被用户读成「确实一条不合格都没有」，与「没数据」是两回事。
 *
 * @param stats 分级统计（后端 GET /quality/grading 返回 { PASS: n, FAIL: n }）
 * @param key 统计项
 * @returns 数量；未提供返回 null
 */
function pickGradingCount(stats: Record<string, number> | undefined, key: string): number | null {
  if (!stats) return null
  const raw = stats[key]
  if (raw === undefined || raw === null) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 渲染可能为 null 的统计值（null 显示「—」并给出可见提示）。
 *
 * @param value 统计值
 * @returns 展示节点
 */
function renderGradingValue(value: number | null): JSX.Element {
  if (value === null) {
    return (
      <Tooltip title="后端未返回该统计项（或接口不可用），显示为「—」，不按 0 处理">
        <Typography.Text type="secondary" style={{ cursor: 'help', fontSize: 24 }}>
          —
          <InfoCircleOutlined style={{ fontSize: 12, color: '#faad14', marginLeft: 4 }} />
        </Typography.Text>
      </Tooltip>
    )
  }
  return <Statistic value={value} />
}

/**
 * 质量分级管理页
 *
 * 业务职责：维护批次质量等级评定，支持人工复核改判与等级变更追溯。
 *
 * @returns 页面内容
 */
export default function QualityGrading(): JSX.Element {
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [filters, setFilters] = useState<GradeFilters>({})
  const [filterForm] = Form.useForm<GradeFilters>()

  const [store, setStore] = useState<GradeStore>(() => readStore())
  const [reviewTarget, setReviewTarget] = useState<GradeAssessment | null>(null)
  const [reviewForm] = Form.useForm<ReviewFormValues>()
  const [historyBatchId, setHistoryBatchId] = useState<string>('')

  /** 采收批次（等级评定数据源） */
  const batchQuery = useQuery({
    queryKey: ['quality-grading-batches', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listHarvests({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 检测结论统计（合格 / 不合格） */
  const statsQuery = useQuery({
    queryKey: ['quality-grading-stats'],
    enabled: Boolean(farmId),
    queryFn: () => fetchGradingStats(),
  })

  /** 检测结论统计：接口未返回即为 null，页面显示「—」而非 0 */
  const passCount = pickGradingCount(statsQuery.data, 'PASS')
  const failCount = pickGradingCount(statsQuery.data, 'FAIL')

  /**
   * 持久化本地状态。
   *
   * @param next 最新状态
   */
  const persist = (next: GradeStore): void => {
    setStore(next)
    writeStore(next)
  }

  /** 等级评定列表 */
  const assessments = useMemo<GradeAssessment[]>(() => {
    return (batchQuery.data?.list ?? []).map((batch: HarvestBatch) => {
      const review = store.reviews[String(batch.batchId)]
      return {
        batchId: String(batch.batchId),
        batchNo: batch.batchNo,
        cropName: batch.cropName ?? batch.cropId,
        plotName: batch.plotName ?? batch.plotId,
        harvestDate: batch.harvestDate,
        initialGrade: batch.grade ? String(batch.grade) : undefined,
        reviewGrade: review?.grade,
        assessorName: review?.assessorName,
        assessedAt: review?.assessedAt,
        reviewStatus: review ? 'confirmed' : 'pending',
        remark: review?.remark,
      }
    })
  }, [batchQuery.data, store.reviews])

  /** 前端过滤后的列表 */
  const filteredList = useMemo<GradeAssessment[]>(() => {
    const keyword = (filters.keyword ?? '').trim().toLowerCase()
    return assessments.filter((item) => {
      if (filters.grade && filters.grade !== 'all') {
        const current = item.reviewGrade ?? item.initialGrade ?? ''
        if (current !== filters.grade) return false
      }
      if (filters.reviewStatus && filters.reviewStatus !== 'all') {
        if ((item.reviewStatus ?? 'pending') !== filters.reviewStatus) return false
      }
      if (!keyword) return true
      return [item.batchNo, item.cropName, item.plotName]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(keyword))
    })
  }, [assessments, filters])

  /** 等级分布（复核等级优先，未复核取初评等级） */
  const gradeDistribution = useMemo(() => {
    const counter: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, 待检: 0 }
    assessments.forEach((item) => {
      const grade = item.reviewGrade ?? item.initialGrade ?? '待检'
      const key = counter[grade] === undefined ? '待检' : grade
      counter[key] += 1
    })
    return Object.entries(counter)
      .filter(([, count]) => count > 0)
      .map(([name, value]) => ({ name, value }))
  }, [assessments])

  /** 等级分布饼图配置 */
  const pieOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}：{c} 个批次（{d}%）' },
      legend: { bottom: 0 },
      series: [
        {
          name: '等级分布',
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: true,
          label: { formatter: '{b}\n{c} 个' },
          data: gradeDistribution,
        },
      ],
    }),
    [gradeDistribution],
  )

  /** 统计 */
  const summary = useMemo(() => {
    const pending = assessments.filter((item) => (item.reviewStatus ?? 'pending') === 'pending')
    return {
      pending: pending.length,
      confirmed: assessments.length - pending.length,
      total: assessments.length,
    }
  }, [assessments])

  /** 人工复核：回写批次等级并记录变更流水 */
  const reviewMutation = useMutation({
    mutationFn: async (params: { batchId: string; grade: string; assessorName: string; reason?: string }) => {
      const target = assessments.find((item) => item.batchId === params.batchId)
      const fromGrade = target?.reviewGrade ?? target?.initialGrade
      await updateHarvest(params.batchId, { grade: params.grade as HarvestGrade })
      const changedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
      const next: GradeStore = {
        reviews: {
          ...store.reviews,
          [params.batchId]: {
            grade: params.grade,
            assessorName: params.assessorName,
            assessedAt: changedAt,
            remark: params.reason,
          },
        },
        changes: [
          {
            changeId: `CHG${Date.now()}`,
            batchId: params.batchId,
            batchNo: target?.batchNo,
            fromGrade,
            toGrade: params.grade,
            operatorName: params.assessorName,
            changedAt,
            reason: params.reason,
          },
          ...store.changes,
        ],
      }
      return next
    },
    onSuccess: async (next) => {
      persist(next)
      message.success('人工复核已提交，批次等级已更新')
      setReviewTarget(null)
      reviewForm.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['quality-grading-batches'] })
      await queryClient.invalidateQueries({ queryKey: ['harvest-batch-options'] })
    },
    onError: () => {
      message.error('复核失败，请稍后重试')
    },
  })

  /** 打开人工复核弹窗 */
  const openReview = (record: GradeAssessment): void => {
    setReviewTarget(record)
  }

  /** 提交人工复核 */
  const submitReview = (): void => {
    if (!reviewTarget) return
    void reviewForm.validateFields().then((values) => {
      const changed = (values.grade ?? '') !== (reviewTarget.reviewGrade ?? reviewTarget.initialGrade ?? '')
      if (changed && !values.reason) {
        message.warning('等级发生变更，请填写变更原因')
        return
      }
      reviewMutation.mutate({
        batchId: reviewTarget.batchId,
        grade: values.grade,
        assessorName: values.assessorName,
        reason: values.reason,
      })
    })
  }

  /** 查询 */
  const handleSearch = (): void => {
    setFilters(filterForm.getFieldsValue())
    setPageNum(1)
  }

  /** 重置 */
  const handleReset = (): void => {
    filterForm.resetFields()
    setFilters({})
    setPageNum(1)
  }

  /** 当前查看变更记录的批次流水 */
  const historyChanges = useMemo<GradeChangeRecord[]>(
    () => store.changes.filter((item) => item.batchId === historyBatchId),
    [store.changes, historyBatchId],
  )

  /** 表格列定义 */
  const columns: ProColumns<GradeAssessment>[] = [
    { title: '批次号', dataIndex: 'batchNo', width: 160 },
    {
      title: '产品',
      dataIndex: 'cropName',
      width: 130,
      render: (_, record) => record.cropName ?? '-',
    },
    {
      title: '地块',
      dataIndex: 'plotName',
      width: 130,
      render: (_, record) => record.plotName ?? '-',
    },
    {
      title: '采收日期',
      dataIndex: 'harvestDate',
      width: 120,
      render: (_, record) => formatDate(record.harvestDate),
    },
    {
      title: '初评等级',
      key: 'initialGrade',
      width: 110,
      render: (_, record) =>
        record.initialGrade ? (
          <Tag color={GRADE_COLOR[record.initialGrade] ?? 'default'}>{record.initialGrade} 级</Tag>
        ) : (
          <Tag>待检</Tag>
        ),
    },
    {
      title: '复核等级',
      key: 'reviewGrade',
      width: 110,
      render: (_, record) =>
        record.reviewGrade ? (
          <Tag color={GRADE_COLOR[record.reviewGrade] ?? 'default'}>{record.reviewGrade} 级</Tag>
        ) : (
          <Typography.Text type="secondary">未复核</Typography.Text>
        ),
    },
    {
      title: '评定人',
      dataIndex: 'assessorName',
      width: 120,
      render: (_, record) => record.assessorName ?? '-',
    },
    {
      title: '评定时间',
      dataIndex: 'assessedAt',
      width: 170,
      render: (_, record) => record.assessedAt ?? '-',
    },
    {
      title: '状态',
      key: 'reviewStatus',
      width: 100,
      render: (_, record) =>
        (record.reviewStatus ?? 'pending') === 'confirmed' ? (
          <Tag color="green">已确认</Tag>
        ) : (
          <Tag color="orange">待复核</Tag>
        ),
    },
    {
      title: '操作',
      key: 'option',
      width: 190,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link key="review" onClick={() => openReview(record)}>
          <CheckCircleOutlined /> 人工复核
        </Typography.Link>,
        <Typography.Link
          key="history"
          onClick={() => setHistoryBatchId(record.batchId)}
        >
          <HistoryOutlined /> 变更记录
        </Typography.Link>,
      ],
    },
  ]

  return (
    <PageContainer
      title="🏅 质量分级管理"
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      extra={[
        <Button
          key="reload"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ['quality-grading-batches'] })
          }}
        >
          刷新
        </Button>,
      ]}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card loading={batchQuery.isFetching}>
            <Statistic title="待复核批次" value={summary.pending} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={batchQuery.isFetching}>
            <Statistic
              title="已确认批次"
              value={summary.confirmed}
              suffix="个"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsQuery.isFetching}>
            {renderGradingValue(passCount)}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              检测合格（单）
            </Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsQuery.isFetching}>
            {renderGradingValue(failCount)}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              检测不合格（单）
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      {statsQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="检测结论统计接口不可用，合格 / 不合格数量显示为「—」"
          description="GET /quality/grading 未返回数据，此处不按 0 处理，避免把「没数据」误读成「没有不合格」。"
          action={
            <Button size="small" onClick={() => void statsQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : null}

      {batchQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="采收批次接口不可用，等级评定列表为空"
          description="GET /harvests 未返回数据，此处不生成任何示例批次。接口恢复后列表会自动加载。"
          action={
            <Button size="small" onClick={() => void batchQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : null}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card title="📊 等级分布">
            {gradeDistribution.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Typography.Text type="secondary">暂无批次数据</Typography.Text>}
              />
            ) : (
              <ReactECharts option={pieOption} style={{ height: 260 }} notMerge />
            )}
          </Card>
        </Col>
        <Col span={16}>
          <Card title="📏 等级评定标准参考" extra={<Tag>PRD 2.2.3 质量分级标准体系</Tag>}>
            <Descriptions column={1} size="small" bordered>
              {GRADE_CRITERIA.map((item) => (
                <Descriptions.Item key={item.grade} label={item.grade}>
                  {item.criteria}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" style={{ rowGap: 12 }}>
          <Form.Item name="keyword" label="关键字">
            <Input allowClear placeholder="批次号 / 产品 / 地块" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="grade" label="等级">
            <Select
              allowClear
              placeholder="全部等级"
              options={[{ value: 'all', label: '全部等级' }, ...GRADE_OPTIONS]}
              style={{ width: 150 }}
            />
          </Form.Item>
          <Form.Item name="reviewStatus" label="复核状态">
            <Select
              allowClear
              placeholder="全部状态"
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '待复核' },
                { value: 'confirmed', label: '已确认' },
              ]}
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

      <ProTable<GradeAssessment>
        rowKey="batchId"
        size="small"
        columns={columns}
        dataSource={filteredList}
        loading={batchQuery.isFetching}
        search={false}
        options={{
          reload: () => {
            void queryClient.invalidateQueries({ queryKey: ['quality-grading-batches'] })
          },
          density: true,
          setting: true,
        }}
        pagination={{
          current: pageNum,
          pageSize,
          total: filteredList.length,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (nextPage, nextSize) => {
            setPageNum(nextPage)
            setPageSize(nextSize)
          },
        }}
      />

      <Card title="🕓 最近等级变更记录">
        {store.changes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Typography.Text type="secondary">暂无等级变更记录</Typography.Text>}
          />
        ) : (
          <Timeline
            items={store.changes.slice(0, 10).map((item) => ({
              children: (
                <div>
                  <Space size={8} wrap>
                    <Typography.Text strong>{item.changedAt}</Typography.Text>
                    <Typography.Text>{item.operatorName}</Typography.Text>
                    <Typography.Text type="secondary">
                      批次 {item.batchNo ?? item.batchId}
                    </Typography.Text>
                    <Tag color={GRADE_COLOR[item.fromGrade ?? ''] ?? 'default'}>
                      {item.fromGrade ?? '未定级'}
                    </Tag>
                    <Typography.Text type="secondary">→</Typography.Text>
                    <Tag color={GRADE_COLOR[item.toGrade] ?? 'default'}>{item.toGrade} 级</Tag>
                  </Space>
                  <div>
                    <Typography.Text type="secondary">
                      变更原因：{item.reason || '—'}
                    </Typography.Text>
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Card>

      <Modal
        title={`人工复核：${reviewTarget?.batchNo ?? reviewTarget?.batchId ?? ''}`}
        open={Boolean(reviewTarget)}
        okText="提交复核"
        cancelText="取消"
        confirmLoading={reviewMutation.isPending}
        destroyOnClose
        onOk={submitReview}
        onCancel={() => setReviewTarget(null)}
      >
        <Form
          form={reviewForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{
            grade: reviewTarget?.reviewGrade ?? reviewTarget?.initialGrade ?? 'A',
            assessorName: currentFarm?.farmName ?? '',
          }}
        >
          <Form.Item label="初评等级">
            <Tag color={GRADE_COLOR[reviewTarget?.initialGrade ?? ''] ?? 'default'}>
              {reviewTarget?.initialGrade ?? '未定级'}
            </Tag>
          </Form.Item>
          <Form.Item
            name="grade"
            label="复核等级"
            rules={[{ required: true, message: '请选择复核等级' }]}
          >
            <Select options={GRADE_OPTIONS} placeholder="请选择复核等级" />
          </Form.Item>
          <Form.Item
            name="assessorName"
            label="评定人"
            rules={[{ required: true, message: '请输入评定人' }]}
          >
            <Input placeholder="如 张三（农艺师）" />
          </Form.Item>
          <Form.Item name="reason" label="变更原因">
            <Input.TextArea
              rows={3}
              placeholder="等级发生变化时必填，如：复检后糖度达到 A 级标准"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="等级变更记录"
        width={640}
        open={Boolean(historyBatchId)}
        onClose={() => setHistoryBatchId('')}
      >
        {historyChanges.length === 0 ? (
          <Empty
            description={
              <Typography.Text type="secondary">
                该批次暂无等级变更记录，初评等级即为当前等级
              </Typography.Text>
            }
          />
        ) : (
          <Timeline
            items={historyChanges.map((item) => ({
              children: (
                <div>
                  <Space size={8} wrap>
                    <Typography.Text strong>{item.changedAt}</Typography.Text>
                    <Typography.Text>{item.operatorName}</Typography.Text>
                    <Tag color={GRADE_COLOR[item.fromGrade ?? ''] ?? 'default'}>
                      {item.fromGrade ?? '未定级'}
                    </Tag>
                    <Typography.Text type="secondary">→</Typography.Text>
                    <Tag color={GRADE_COLOR[item.toGrade] ?? 'default'}>{item.toGrade} 级</Tag>
                  </Space>
                  <div>
                    <Typography.Text type="secondary">
                      变更原因：{item.reason || '—'}
                    </Typography.Text>
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Drawer>
    </PageContainer>
  )
}
