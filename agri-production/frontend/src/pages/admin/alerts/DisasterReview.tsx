/**
 * 页面名称：灾害事件复盘
 * 路由路径：/admin/production/alerts/review
 * 所属模块：异常告警处理
 * PRD 序号：PRD 6.2 #25（PRD 独有页面，原型未绘制）
 *
 * 设计决策（依据 PRD「重大事件时间线、损失评估、改进措施」）：
 * - 列表：事件编号 / 事件名称 / 灾害类型 / 发生时间 / 影响农场数 / 影响面积 / 经济损失 / 复盘人 / 状态；
 * - 详情抽屉三个 Tab：① 重大事件时间线（灾前预警 → 灾中处置 → 灾后恢复）
 *   ② 损失评估表单（影响农场数、受灾面积、经济损失、减产比例，可保存并回调 updateDisasterReview）
 *   ③ 改进措施（可编辑清单，保存到 improvement 字段）；
 * - 支持新增复盘（createDisasterReview）与删除（deleteDisasterReview）。
 */
import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDisasterReview,
  deleteDisasterReview,
  listDisasterReviews,
  updateDisasterReview,
} from '@/api'
import type { DisasterReview as DisasterReviewBase, PageResult } from '@/types'

/** 复盘状态：draft 草稿 / reviewed 已归档 */
type ReviewStatus = 'draft' | 'archived'

/** 事件时间线节点 */
interface TimelineNode {
  /** 节点时间 */
  time: string
  /** 节点标题 */
  title: string
  /** 节点描述 */
  detail: string
  /** 节点状态色 */
  color: 'green' | 'blue' | 'red' | 'gray'
}

/** 复盘行模型 */
interface ReviewRow extends DisasterReviewBase {
  /** 事件编号 */
  reviewNo: string
  /** 复盘状态 */
  reviewStatus: ReviewStatus
  /** 减产比例（%） */
  yieldLossRate: number
  /** 事件时间线 */
  timeline: TimelineNode[]
  /** 改进措施清单 */
  measures: string[]
}

/** 灾害类型选项 */
const DISASTER_OPTIONS: { value: string; label: string }[] = [
  { value: '洪涝', label: '洪涝' },
  { value: '干旱', label: '干旱' },
  { value: '霜冻', label: '霜冻' },
  { value: '台风', label: '台风' },
  { value: '病虫害', label: '病虫害' },
  { value: '冰雹', label: '冰雹' },
]

/** 灾情颜色映射 */
const DISASTER_COLOR: Record<string, string> = {
  洪涝: 'blue',
  干旱: 'orange',
  霜冻: 'cyan',
  台风: 'volcano',
  病虫害: 'purple',
  冰雹: 'geekblue',
}

/** 演示复盘数据 */
const MOCK_REVIEWS: ReviewRow[] = [
  {
    reviewId: 'DR-001',
    reviewNo: 'DR20250620001',
    eventName: '河南中部特大暴雨内涝灾害',
    disasterType: '洪涝',
    occurredAt: '2025-06-20 02:30',
    affectedFarmCount: 126,
    affectedArea: 28500,
    economicLoss: 12600000,
    handleProcess:
      '6月20日凌晨接报后立即启动极端天气应急预案，组织 42 台抽水泵抢排积水；48 小时内完成受灾核查并协助农户提交保险理赔材料。',
    improvement:
      '1. 提前疏通排水沟渠并在低洼地块加装备用泵\n2. 与气象局打通分钟级降雨预警\n3. 高风险区域推广耐涝品种并建立轮作台账',
    reviewerName: '管理员A',
    createdAt: '2025-06-28 10:15',
    reviewStatus: 'archived',
    yieldLossRate: 32.5,
    timeline: [
      {
        time: '2025-06-19 18:00',
        title: '气象预警发布',
        detail: '气象局发布暴雨橙色预警，系统自动向区域内 126 个农场推送预警通知。',
        color: 'blue',
      },
      {
        time: '2025-06-20 02:30',
        title: '灾情发生',
        detail: '短时强降雨导致低洼地块积水，平均积水深度 35cm。',
        color: 'red',
      },
      {
        time: '2025-06-20 03:10',
        title: '启动应急预案',
        detail: '启动极端天气应对预案，调度 42 台抽水泵与周边农户互助排涝。',
        color: 'green',
      },
      {
        time: '2025-06-22 16:00',
        title: '抢排完成',
        detail: '完成 2.85 万亩受灾地块排涝，转入补种与病害防控。',
        color: 'green',
      },
      {
        time: '2025-06-28 10:15',
        title: '复盘归档',
        detail: '完成损失评估与根因分析，形成改进措施清单并归档。',
        color: 'gray',
      },
    ],
    measures: [
      '提前疏通排水沟渠并在低洼地块加装备用泵',
      '与气象局打通分钟级降雨预警推送',
      '高风险区域推广耐涝品种并建立轮作台账',
    ],
  },
  {
    reviewId: 'DR-002',
    reviewNo: 'DR20250705002',
    eventName: '鲁西北阶段性干旱减产事件',
    disasterType: '干旱',
    occurredAt: '2025-07-05 09:00',
    affectedFarmCount: 84,
    affectedArea: 19200,
    economicLoss: 7600000,
    handleProcess:
      '协调灌溉设备 260 台套，调整灌溉计划并启用节水灌溉策略；同步调整玉米追肥方案，减少因旱导致的减产。',
    improvement:
      '1. 建设墒情监测点位 120 个并实现自动灌溉\n2. 完善抗旱水源调度预案\n3. 推广保水剂与覆膜保墒技术',
    reviewerName: '管理员B',
    createdAt: '2025-07-12 15:40',
    reviewStatus: 'archived',
    yieldLossRate: 18.6,
    timeline: [
      {
        time: '2025-06-28 09:00',
        title: '墒情异常预警',
        detail: '土壤湿度连续 5 天低于阈值，系统生成一般级告警。',
        color: 'blue',
      },
      {
        time: '2025-07-05 09:00',
        title: '旱情确认',
        detail: '1.92 万亩玉米进入抽雄期，缺水导致叶片卷曲。',
        color: 'red',
      },
      {
        time: '2025-07-06 08:30',
        title: '调度灌溉资源',
        detail: '协调灌溉设备 260 台套，启用节水灌溉策略并分时轮灌。',
        color: 'green',
      },
      {
        time: '2025-07-12 15:40',
        title: '复盘归档',
        detail: '完成减产评估，形成抗旱改进措施。',
        color: 'gray',
      },
    ],
    measures: [
      '建设墒情监测点位并实现自动灌溉',
      '完善抗旱水源调度预案',
      '推广保水剂与覆膜保墒技术',
    ],
  },
  {
    reviewId: 'DR-003',
    reviewNo: 'DR20250710003',
    eventName: '中原地区稻飞虱集中爆发事件',
    disasterType: '病虫害',
    occurredAt: '2025-07-10 11:20',
    affectedFarmCount: 56,
    affectedArea: 12800,
    economicLoss: 4300000,
    handleProcess:
      '通过病虫害识别模型确认虫情，48 小时内组织统防统治，累计防治面积 1.28 万亩，虫口减退率 92%。',
    improvement: '1. 加密虫情测报灯点位\n2. 建立统防统治物资储备\n3. 将虫情预警纳入 SOP 模板',
    reviewerName: '管理员A',
    createdAt: '2025-07-18 09:05',
    reviewStatus: 'draft',
    yieldLossRate: 9.4,
    timeline: [
      {
        time: '2025-07-09 16:00',
        title: '虫情识别上报',
        detail: '农户拍照上传，AI 识别判定为稻飞虱，置信度 0.93。',
        color: 'blue',
      },
      {
        time: '2025-07-10 11:20',
        title: '确认爆发',
        detail: '田间调查百丛虫量达 1800 头，达到防治指标。',
        color: 'red',
      },
      {
        time: '2025-07-12 07:00',
        title: '统防统治',
        detail: '调度植保无人机 38 架，完成 1.28 万亩统防统治。',
        color: 'green',
      },
      {
        time: '2025-07-18 09:05',
        title: '复盘草稿',
        detail: '虫口减退率 92%，损失评估待复核。',
        color: 'gray',
      },
    ],
    measures: ['加密虫情测报灯点位', '建立统防统治物资储备', '将虫情预警纳入 SOP 模板'],
  },
]

/** 本地演示数据源 */
let mockReviewStore: ReviewRow[] = [...MOCK_REVIEWS]

/** 损失评估表单值 */
interface LossFormValues {
  affectedFarmCount: number
  affectedArea: number
  economicLoss: number
  yieldLossRate: number
  handleProcess: string
}

/** 改进措施表单值 */
interface MeasureFormValues {
  measures: string[]
}

/** 新增复盘表单值 */
interface CreateFormValues {
  eventName: string
  disasterType: string
  /** 发生时间（DatePicker 产出） */
  occurredAt: Dayjs
  affectedFarmCount: number
  affectedArea: number
  economicLoss: number
  handleProcess: string
  improvement: string
  reviewerName: string
}

/**
 * 灾害事件复盘页面
 * @returns 页面内容
 */
export default function DisasterReview(): JSX.Element {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [filterForm] = Form.useForm<{ eventName?: string; disasterType?: string }>()
  const [lossForm] = Form.useForm<LossFormValues>()
  const [measureForm] = Form.useForm<MeasureFormValues>()
  const [createForm] = Form.useForm<CreateFormValues>()
  const [filters, setFilters] = useState<{ eventName?: string; disasterType?: string }>({})
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [detailRow, setDetailRow] = useState<ReviewRow | undefined>(undefined)
  const [detailOpen, setDetailOpen] = useState<boolean>(false)
  const [createOpen, setCreateOpen] = useState<boolean>(false)

  const listQuery = useQuery({
    queryKey: ['admin-disaster-reviews', filters],
    queryFn: async (): Promise<{ rows: ReviewRow[]; demo: boolean }> => {
      try {
        const page: PageResult<DisasterReviewBase> = await listDisasterReviews({
          pageNum: 1,
          pageSize: 100,
          disasterType: filters.disasterType,
        })
        if (page && Array.isArray(page.list) && page.list.length > 0) {
          return {
            rows: page.list.map<ReviewRow>((item) => ({
              ...item,
              reviewNo: item.reviewId,
              reviewStatus: 'archived',
              yieldLossRate: 0,
              timeline: [],
              measures: (item.improvement ?? '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
            })),
            demo: false,
          }
        }
      } catch {
        /* 后端不可用时降级为演示数据 */
      }
      const filtered = mockReviewStore.filter((row) => {
        if (filters.eventName && !row.eventName.includes(filters.eventName)) {
          return false
        }
        if (filters.disasterType && row.disasterType !== filters.disasterType) {
          return false
        }
        return true
      })
      return { rows: filtered, demo: true }
    },
  })

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.rows)
    }
  }, [listQuery.data])

  /** 更新复盘（损失评估 / 改进措施统一走该接口） */
  const updateMutation = useMutation({
    mutationFn: async (payload: { row: ReviewRow; patch: Partial<ReviewRow> }) => {
      const next = { ...payload.row, ...payload.patch }
      try {
        await updateDisasterReview(payload.row.reviewId, {
          affectedFarmCount: next.affectedFarmCount,
          affectedArea: next.affectedArea,
          economicLoss: next.economicLoss,
          handleProcess: next.handleProcess,
          improvement: next.measures.join('\n'),
        })
        message.success('复盘信息已保存')
      } catch {
        message.success('复盘信息已保存（演示模式，仅本地更新）')
      }
      mockReviewStore = mockReviewStore.map((item) =>
        item.reviewId === payload.row.reviewId ? next : item,
      )
      setDetailRow(next)
      void queryClient.invalidateQueries({ queryKey: ['admin-disaster-reviews'] })
      return next
    },
  })

  /** 新增复盘 */
  const createMutation = useMutation({
    mutationFn: async (values: CreateFormValues) => {
      const occurredAt = values.occurredAt.format('YYYY-MM-DD HH:mm')
      try {
        await createDisasterReview({ ...values, occurredAt })
        message.success('复盘已创建')
      } catch {
        message.success('复盘已创建（演示模式，仅本地更新）')
      }
      const nextRow: ReviewRow = {
        reviewId: `DR-${Date.now()}`,
        reviewNo: `DR${dayjs().format('YYYYMMDD')}${String(mockReviewStore.length + 1).padStart(3, '0')}`,
        eventName: values.eventName,
        disasterType: values.disasterType,
        occurredAt,
        affectedFarmCount: values.affectedFarmCount,
        affectedArea: values.affectedArea,
        economicLoss: values.economicLoss,
        handleProcess: values.handleProcess,
        improvement: values.improvement,
        reviewerName: values.reviewerName,
        createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
        reviewStatus: 'draft',
        yieldLossRate: 0,
        timeline: [
          {
            time: occurredAt,
            title: '事件发生',
            detail: values.handleProcess,
            color: 'red',
          },
          {
            time: dayjs().format('YYYY-MM-DD HH:mm'),
            title: '复盘草稿创建',
            detail: `由 ${values.reviewerName} 创建复盘草稿`,
            color: 'gray',
          },
        ],
        measures: values.improvement
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      }
      mockReviewStore = [nextRow, ...mockReviewStore]
      return nextRow
    },
    onSuccess: () => {
      setCreateOpen(false)
      createForm.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['admin-disaster-reviews'] })
    },
  })

  /** 删除复盘 */
  const removeMutation = useMutation({
    mutationFn: async (row: ReviewRow) => {
      try {
        await deleteDisasterReview(row.reviewId)
        message.success('复盘已删除')
      } catch {
        message.success('复盘已删除（演示模式）')
      }
      mockReviewStore = mockReviewStore.filter((item) => item.reviewId !== row.reviewId)
      return row.reviewId
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-disaster-reviews'] }),
  })

  /**
   * 打开详情抽屉
   * @param row 目标复盘
   */
  const openDetail = (row: ReviewRow): void => {
    setDetailRow(row)
    setDetailOpen(true)
    lossForm.setFieldsValue({
      affectedFarmCount: row.affectedFarmCount,
      affectedArea: row.affectedArea,
      economicLoss: row.economicLoss,
      yieldLossRate: row.yieldLossRate,
      handleProcess: row.handleProcess,
    })
    measureForm.setFieldsValue({ measures: row.measures })
  }

  /** 统计汇总 */
  const summary = useMemo(
    () => ({
      count: rows.length,
      area: rows.reduce((sum, row) => sum + row.affectedArea, 0),
      loss: rows.reduce((sum, row) => sum + row.economicLoss, 0),
      farms: rows.reduce((sum, row) => sum + row.affectedFarmCount, 0),
    }),
    [rows],
  )

  const columns = useMemo(
    () => [
      { title: '事件编号', dataIndex: 'reviewNo', width: 150 },
      {
        title: '事件名称',
        dataIndex: 'eventName',
        width: 240,
        render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
      },
      {
        title: '灾害类型',
        dataIndex: 'disasterType',
        width: 110,
        render: (text: string) => (
          <Tag color={DISASTER_COLOR[text] ?? 'default'}>{text}</Tag>
        ),
      },
      { title: '发生时间', dataIndex: 'occurredAt', width: 150 },
      { title: '影响农场', dataIndex: 'affectedFarmCount', width: 100, render: (v: number) => `${v} 个` },
      { title: '受灾面积', dataIndex: 'affectedArea', width: 120, render: (v: number) => `${v.toLocaleString()} 亩` },
      {
        title: '经济损失',
        dataIndex: 'economicLoss',
        width: 140,
        render: (v: number) => `¥ ${v.toLocaleString()}`,
      },
      {
        title: '状态',
        dataIndex: 'reviewStatus',
        width: 100,
        render: (status: ReviewStatus) =>
          status === 'archived' ? <Tag color="success">已归档</Tag> : <Tag color="gold">草稿</Tag>,
      },
      { title: '复盘人', dataIndex: 'reviewerName', width: 100 },
      {
        title: '操作',
        key: 'action',
        width: 150,
        fixed: 'right' as const,
        render: (_: unknown, row: ReviewRow) => (
          <Space size={0}>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openDetail(row)}>
              查看复盘
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                modal.confirm({
                  title: `确认删除复盘「${row.eventName}」？`,
                  okText: '确认删除',
                  cancelText: '取消',
                  okButtonProps: { danger: true },
                  onOk: () => removeMutation.mutateAsync(row),
                })
              }
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [modal, removeMutation],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Typography.Text type="secondary">复盘事件数</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {summary.count}
              </Typography.Title>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Typography.Text type="secondary">累计受灾面积</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {summary.area.toLocaleString()} 亩
              </Typography.Title>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Typography.Text type="secondary">涉及农场数</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {summary.farms} 个
              </Typography.Title>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Typography.Text type="secondary">累计经济损失</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0, color: '#cf1322' }}>
                ¥ {summary.loss.toLocaleString()}
              </Typography.Title>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card>
        <Form
          form={filterForm}
          layout="inline"
          style={{ rowGap: 12, marginBottom: 16 }}
          onFinish={(values) => setFilters(values)}
        >
          <Form.Item name="eventName" label="事件名称">
            <Input allowClear placeholder="请输入事件名称关键字" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="disasterType" label="灾害类型">
            <Select allowClear placeholder="全部" style={{ width: 160 }} options={DISASTER_OPTIONS} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button
                onClick={() => {
                  filterForm.resetFields()
                  setFilters({})
                }}
              >
                重置
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() =>
                  void queryClient.invalidateQueries({ queryKey: ['admin-disaster-reviews'] })
                }
              >
                刷新
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Table<ReviewRow>
          rowKey="reviewId"
          columns={columns}
          dataSource={rows}
          loading={listQuery.isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1400 }}
          locale={{ emptyText: <Empty description="暂无灾害事件复盘记录" /> }}
        />
      </Card>

      {/* 详情抽屉：时间线 / 损失评估 / 改进措施 */}
      <Drawer
        title={detailRow ? `事件复盘 - ${detailRow.eventName}` : '事件复盘'}
        width={820}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        destroyOnHidden
      >
        {detailRow ? (
          <Tabs
            defaultActiveKey="timeline"
            items={[
              {
                key: 'timeline',
                label: '① 重大事件时间线',
                children: (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="事件编号">{detailRow.reviewNo}</Descriptions.Item>
                      <Descriptions.Item label="灾害类型">
                        <Tag color={DISASTER_COLOR[detailRow.disasterType] ?? 'default'}>
                          {detailRow.disasterType}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="发生时间">{detailRow.occurredAt}</Descriptions.Item>
                      <Descriptions.Item label="复盘人">{detailRow.reviewerName}</Descriptions.Item>
                      <Descriptions.Item label="创建时间">{detailRow.createdAt}</Descriptions.Item>
                      <Descriptions.Item label="复盘状态">
                        {detailRow.reviewStatus === 'archived' ? (
                          <Tag color="success">已归档</Tag>
                        ) : (
                          <Tag color="gold">草稿</Tag>
                        )}
                      </Descriptions.Item>
                    </Descriptions>
                    {detailRow.timeline.length > 0 ? (
                      <Timeline
                        items={detailRow.timeline.map((node) => ({
                          color: node.color,
                          children: (
                            <Space direction="vertical" size={2}>
                              <Typography.Text strong>
                                {node.title} · {node.time}
                              </Typography.Text>
                              <Typography.Text type="secondary">{node.detail}</Typography.Text>
                            </Space>
                          ),
                        }))}
                      />
                    ) : (
                      <Empty description="该事件暂未生成时间线" />
                    )}
                  </Space>
                ),
              },
              {
                key: 'loss',
                label: '② 损失评估',
                children: (
                  <Form<LossFormValues>
                    form={lossForm}
                    layout="vertical"
                    onFinish={(values) =>
                      updateMutation.mutate({
                        row: detailRow,
                        patch: {
                          affectedFarmCount: values.affectedFarmCount,
                          affectedArea: values.affectedArea,
                          economicLoss: values.economicLoss,
                          yieldLossRate: values.yieldLossRate,
                          handleProcess: values.handleProcess,
                        },
                      })
                    }
                  >
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="affectedFarmCount"
                          label="影响农场数（个）"
                          rules={[{ required: true, message: '请输入影响农场数' }]}
                        >
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="affectedArea"
                          label="受灾面积（亩）"
                          rules={[{ required: true, message: '请输入受灾面积' }]}
                        >
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="economicLoss"
                          label="经济损失（元）"
                          rules={[{ required: true, message: '请输入经济损失' }]}
                        >
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="yieldLossRate"
                          label="减产比例（%）"
                          rules={[{ required: true, message: '请输入减产比例' }]}
                        >
                          <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item
                      name="handleProcess"
                      label="处置过程"
                      rules={[{ required: true, message: '请填写处置过程' }]}
                    >
                      <Input.TextArea rows={4} maxLength={500} showCount />
                    </Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                        保存损失评估
                      </Button>
                      <Button
                        onClick={() =>
                          updateMutation.mutate({ row: detailRow, patch: { reviewStatus: 'archived' } })
                        }
                      >
                        标记为已归档
                      </Button>
                    </Space>
                  </Form>
                ),
              },
              {
                key: 'improvement',
                label: '③ 改进措施',
                children: (
                  <Form<MeasureFormValues>
                    form={measureForm}
                    layout="vertical"
                    onFinish={(values) =>
                      updateMutation.mutate({
                        row: detailRow,
                        patch: {
                          measures: values.measures.filter(Boolean),
                          improvement: values.measures.filter(Boolean).join('\n'),
                        },
                      })
                    }
                  >
                    <Form.List name="measures">
                      {(fields, { add, remove }) => (
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          {fields.map((field) => (
                            <Space key={field.key} align="baseline">
                              <Form.Item
                                {...field}
                                style={{ marginBottom: 0 }}
                                rules={[{ required: true, message: '请填写改进措施' }]}
                              >
                                <Input.TextArea rows={2} style={{ width: 520 }} placeholder="请输入改进措施" />
                              </Form.Item>
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => remove(field.name)}
                              />
                            </Space>
                          ))}
                          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add('')}>
                            添加改进措施
                          </Button>
                        </Space>
                      )}
                    </Form.List>
                    <Button
                      type="primary"
                      htmlType="submit"
                      style={{ marginTop: 16 }}
                      loading={updateMutation.isPending}
                    >
                      保存改进措施
                    </Button>
                  </Form>
                ),
              },
            ]}
          />
        ) : null}
      </Drawer>

      {/* 新增复盘抽屉 */}
      <Drawer
        title="新增灾害事件复盘"
        width={680}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setCreateOpen(false)}>取消</Button>
            <Button type="primary" loading={createMutation.isPending} onClick={() => createForm.submit()}>
              提交
            </Button>
          </Space>
        }
      >
        <Form<CreateFormValues>
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            name="eventName"
            label="事件名称"
            rules={[{ required: true, message: '请输入事件名称' }]}
          >
            <Input placeholder="如：河南中部特大暴雨内涝灾害" maxLength={60} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="disasterType"
                label="灾害类型"
                rules={[{ required: true, message: '请选择灾害类型' }]}
              >
                <Select options={DISASTER_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="occurredAt"
                label="发生时间"
                rules={[{ required: true, message: '请选择发生时间' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="affectedFarmCount"
                label="影响农场数"
                rules={[{ required: true, message: '请输入影响农场数' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="affectedArea"
                label="受灾面积（亩）"
                rules={[{ required: true, message: '请输入受灾面积' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="economicLoss"
                label="经济损失（元）"
                rules={[{ required: true, message: '请输入经济损失' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="handleProcess"
            label="处置过程"
            rules={[{ required: true, message: '请填写处置过程' }]}
          >
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
          <Form.Item
            name="improvement"
            label="改进措施"
            tooltip="每行一条，保存后自动拆分为措施清单"
            rules={[{ required: true, message: '请填写改进措施' }]}
          >
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
          <Form.Item
            name="reviewerName"
            label="复盘人"
            rules={[{ required: true, message: '请输入复盘人' }]}
          >
            <Input placeholder="如：管理员A" />
          </Form.Item>
        </Form>
      </Drawer>

      <Card
        styles={{ body: { padding: 12 } }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新增事件复盘
          </Button>
        }
      >
        <Typography.Text type="secondary">
          记录重大灾害事件的影响范围、处置过程与改进措施，支持归档后沉淀到应急预案库。
        </Typography.Text>
      </Card>
    </Space>
  )
}
