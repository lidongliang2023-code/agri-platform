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
 *
 * ⚠️ 数据源现状（2026-10 实测，见 @/utils/shape-guard 与 @/utils/metric-format）：
 * `GET /api/v1/production/admin/alerts/review` 返回的是 **AlertVO（告警复核记录）**：
 * `alertId / alertTitle / alertLevel / alertSource / farmId / plotId / deviceId /
 * triggerValue / status / handlerName / handleRemark / triggeredAt / handledAt`。
 * 它**不含**本页需要的 `reviewId / eventName / disasterType / affectedFarmCount /
 * affectedArea / economicLoss / handleProcess / improvement / reviewerName / createdAt`
 * 任何一个字段——后端根本没有「灾害事件复盘」这个域。
 *
 * 因此本页做过两件事，且顺序不能反：
 * 1. **形状校验**（`hasNonEmptyTextFields(item, ['reviewId', 'eventName'])`）：
 *    只有真正带复盘字段的行才算真数据。告警记录一律不当复盘行渲染——
 *    否则就是把 8 条告警渲染成 8 条「复盘」，每行字段全空，比不显示更骗人。
 * 2. **缺失值显式降级**：仍保留逐字段的「—」渲染，
 *    这样后端哪天补上了一半字段（比如有 reviewId 但没 economicLoss），
 *    页面不会崩、也不会把缺失显示成 0 或空白。
 *
 * 同时撤掉了本地示例复盘数据（MOCK_REVIEWS）：本模块既有口径是
 * 「撤掉硬编码兜底假数据，改为只消费后端真实数据」（见 2b741f94 监控告警域修复），
 * 用一个带「示例」横幅的假列表盖住「后端没这个域」只会让问题更难发现。
 */
import { useEffect, useMemo, useState } from 'react'
import type { Dayjs } from 'dayjs'
import {
  Alert,
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
import { MISSING_VALUE_TEXT, MetricNumber } from '@/components'
import { sumMetric } from '@/utils/metric-format'
import { hasNonEmptyTextFields } from '@/utils/shape-guard'
import type { DisasterReview as DisasterReviewBase, PageResult } from '@/types'

/** 复盘状态：draft 草稿 / archived 已归档（后端无该字段，缺失时展示「—」） */
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

/**
 * 复盘行模型。
 *
 * 继承 `Partial<DisasterReviewBase>` 而不是 `DisasterReviewBase`：
 * 后端当前一个复盘字段都不返回，若按「全部必填」建模，
 * TS 会担保 `row.affectedArea` 一定是 number，
 * 于是 `row.affectedArea.toLocaleString()` 通过编译却在运行时抛 TypeError——
 * 这正是本页此前整页白屏的根因。建模成可选才能逼着调用方处理缺失。
 */
interface ReviewRow extends Partial<DisasterReviewBase> {
  /** 事件编号（后端无该字段时回落为 reviewId，再没有则「—」） */
  reviewNo: string
  /** 复盘状态：后端无该字段时为 undefined，展示「—」 */
  reviewStatus?: ReviewStatus
  /** 减产比例（%）：后端无该字段 */
  yieldLossRate?: number
  /** 事件时间线：后端无该字段，恒为空数组 */
  timeline: TimelineNode[]
  /** 改进措施清单：由 improvement 文本拆分而来 */
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

/**
 * 汇总指标缺失提示语。
 *
 * 带具体端点与后端真实返回形状，便于下一个人直接定位，
 * 而不是只看到一句「暂无数据」。
 */
const SUMMARY_MISSING_TIP =
  '未接入：后端 /admin/alerts/review 返回的是告警复核记录（AlertVO），' +
  '不含 affectedArea / economicLoss / affectedFarmCount，显示为「—」而非 0'

/** 后端未接入时的页面说明 */
const NO_DATA_NOTE =
  '后端 /api/v1/production/admin/alerts/review 当前返回的是「告警复核」记录' +
  '（AlertVO：alertId / alertTitle / alertLevel / triggerValue / status …），' +
  '不含 reviewId / eventName / disasterType / affectedArea / economicLoss 等灾害复盘字段。' +
  '本页按数据形状判定为「无真数据」，不把告警记录渲染成复盘行，也不使用本地示例数据顶替。' +
  '新增 / 保存 / 删除接口后端同样未接入，操作会如实报错。'

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
    queryFn: async (): Promise<ReviewRow[]> => {
      const page: PageResult<DisasterReviewBase> = await listDisasterReviews({
        pageNum: 1,
        pageSize: 100,
        disasterType: filters.disasterType,
      })
      const list = page?.list
      if (!Array.isArray(list) || list.length === 0) {
        return []
      }
      // 形状校验：只认真正带「复盘」字段的行。
      // 接口通了、数组非空、code=0 都判不出「返回的是别的东西」，
      // 只有按字段形状判才能把 AlertVO 挡在页面之外。
      return list
        .filter((item) => hasNonEmptyTextFields(item, ['reviewId', 'eventName']))
        .map<ReviewRow>((item) => ({
          ...item,
          reviewNo: item.reviewId ?? MISSING_VALUE_TEXT,
          reviewStatus: undefined,
          yieldLossRate: undefined,
          timeline: [],
          measures: (item.improvement ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        }))
    },
  })

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data)
    }
  }, [listQuery.data])

  /** 更新复盘（损失评估 / 改进措施统一走该接口） */
  const updateMutation = useMutation({
    mutationFn: async (payload: { row: ReviewRow; patch: Partial<ReviewRow> }) => {
      const next = { ...payload.row, ...payload.patch }
      await updateDisasterReview(payload.row.reviewId ?? '', {
        affectedFarmCount: next.affectedFarmCount,
        affectedArea: next.affectedArea,
        economicLoss: next.economicLoss,
        handleProcess: next.handleProcess,
        improvement: next.measures.join('\n'),
      })
      return next
    },
    onSuccess: () => {
      message.success('复盘信息已保存')
      void queryClient.invalidateQueries({ queryKey: ['admin-disaster-reviews'] })
    },
    onError: (error: Error) => {
      // 后端没有 PUT /admin/alerts/review/{id}，如实报错，不再提示「已保存到本地示例数据」这种假成功
      message.error(`保存失败：${error.message || '后端未提供该写入接口'}`)
    },
  })

  /** 新增复盘 */
  const createMutation = useMutation({
    mutationFn: async (values: CreateFormValues) => {
      const occurredAt = values.occurredAt.format('YYYY-MM-DD HH:mm')
      await createDisasterReview({ ...values, occurredAt })
      return occurredAt
    },
    onSuccess: () => {
      message.success('复盘已创建')
      setCreateOpen(false)
      createForm.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['admin-disaster-reviews'] })
    },
    onError: (error: Error) => {
      message.error(`创建失败：${error.message || '后端未提供该写入接口'}`)
    },
  })

  /** 删除复盘 */
  const removeMutation = useMutation({
    mutationFn: async (row: ReviewRow) => {
      await deleteDisasterReview(row.reviewId ?? '')
      return row.reviewId ?? ''
    },
    onSuccess: () => {
      message.success('复盘已删除')
      void queryClient.invalidateQueries({ queryKey: ['admin-disaster-reviews'] })
    },
    onError: (error: Error) => {
      message.error(`删除失败：${error.message || '后端未提供该删除接口'}`)
    },
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

  /**
   * 统计汇总。
   *
   * `area` / `loss` / `farms` 用 `sumMetric`：只要有一行缺该字段，
   * 整个汇总就是 null（渲染「—」），不把缺失行当 0 加起来凑总数。
   * `count` 是「当前拿到的复盘条数」，是事实而非指标，直接给数字。
   *
   * 没有任何行时汇总同样置 null：0 条复盘的「累计受灾面积」不是 0，
   * 而是「根本没有数据」，渲染成 0 亩等于宣称统计过了。
   */
  const summary = useMemo(
    () => ({
      count: rows.length,
      area: rows.length === 0 ? null : sumMetric(rows.map((row) => row.affectedArea)),
      loss: rows.length === 0 ? null : sumMetric(rows.map((row) => row.economicLoss)),
      farms: rows.length === 0 ? null : sumMetric(rows.map((row) => row.affectedFarmCount)),
    }),
    [rows],
  )

  const columns = useMemo(
    () => [
      {
        title: '事件编号',
        dataIndex: 'reviewNo',
        width: 150,
        render: (text?: string) => text ?? MISSING_VALUE_TEXT,
      },
      {
        title: '事件名称',
        dataIndex: 'eventName',
        width: 240,
        render: (text?: string) => <Typography.Text strong>{text ?? MISSING_VALUE_TEXT}</Typography.Text>,
      },
      {
        title: '灾害类型',
        dataIndex: 'disasterType',
        width: 110,
        render: (text?: string) =>
          text ? <Tag color={DISASTER_COLOR[text] ?? 'default'}>{text}</Tag> : MISSING_VALUE_TEXT,
      },
      {
        title: '发生时间',
        dataIndex: 'occurredAt',
        width: 150,
        render: (text?: string) => text ?? MISSING_VALUE_TEXT,
      },
      {
        title: '影响农场',
        dataIndex: 'affectedFarmCount',
        width: 110,
        render: (v: unknown) => <MetricNumber value={v} suffix=" 个" missingTip={SUMMARY_MISSING_TIP} />,
      },
      {
        title: '受灾面积',
        dataIndex: 'affectedArea',
        width: 130,
        render: (v: unknown) => <MetricNumber value={v} suffix=" 亩" missingTip={SUMMARY_MISSING_TIP} />,
      },
      {
        title: '经济损失',
        dataIndex: 'economicLoss',
        width: 140,
        render: (v: unknown) => <MetricNumber value={v} prefix="¥ " missingTip={SUMMARY_MISSING_TIP} />,
      },
      {
        title: '状态',
        dataIndex: 'reviewStatus',
        width: 100,
        render: (status?: ReviewStatus) => {
          if (status === 'archived') {
            return <Tag color="success">已归档</Tag>
          }
          if (status === 'draft') {
            return <Tag color="gold">草稿</Tag>
          }
          return MISSING_VALUE_TEXT
        },
      },
      {
        title: '复盘人',
        dataIndex: 'reviewerName',
        width: 100,
        render: (text?: string) => text ?? MISSING_VALUE_TEXT,
      },
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
                  title: `确认删除复盘「${row.eventName ?? row.reviewNo}」？`,
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
      {listQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="复盘列表加载失败"
          description={`${(listQuery.error as Error | null)?.message ?? '未知错误'}（不使用本地示例数据兜底，列表与汇总均为空）`}
        />
      ) : null}
      {!listQuery.isError && !listQuery.isLoading && rows.length === 0 ? (
        <Alert type="warning" showIcon message="后端暂无「灾害事件复盘」数据源" description={NO_DATA_NOTE} />
      ) : null}

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
                <MetricNumber value={summary.area} suffix=" 亩" missingTip={SUMMARY_MISSING_TIP} />
              </Typography.Title>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Typography.Text type="secondary">涉及农场数</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>
                <MetricNumber value={summary.farms} suffix=" 个" missingTip={SUMMARY_MISSING_TIP} />
              </Typography.Title>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Typography.Text type="secondary">累计经济损失</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0, color: '#cf1322' }}>
                <MetricNumber value={summary.loss} prefix="¥ " missingTip={SUMMARY_MISSING_TIP} />
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
          locale={{ emptyText: <Empty description="暂无灾害事件复盘记录（后端未提供该数据源）" /> }}
        />
      </Card>

      {/* 详情抽屉：时间线 / 损失评估 / 改进措施 */}
      <Drawer
        title={detailRow ? `事件复盘 - ${detailRow.eventName ?? detailRow.reviewNo}` : '事件复盘'}
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
                        {detailRow.disasterType ? (
                          <Tag color={DISASTER_COLOR[detailRow.disasterType] ?? 'default'}>
                            {detailRow.disasterType}
                          </Tag>
                        ) : (
                          MISSING_VALUE_TEXT
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="发生时间">
                        {detailRow.occurredAt ?? MISSING_VALUE_TEXT}
                      </Descriptions.Item>
                      <Descriptions.Item label="复盘人">
                        {detailRow.reviewerName ?? MISSING_VALUE_TEXT}
                      </Descriptions.Item>
                      <Descriptions.Item label="创建时间">
                        {detailRow.createdAt ?? MISSING_VALUE_TEXT}
                      </Descriptions.Item>
                      <Descriptions.Item label="复盘状态">
                        {detailRow.reviewStatus === 'archived' ? (
                          <Tag color="success">已归档</Tag>
                        ) : detailRow.reviewStatus === 'draft' ? (
                          <Tag color="gold">草稿</Tag>
                        ) : (
                          MISSING_VALUE_TEXT
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
                      <Empty description="该事件暂未生成时间线（后端无该字段）" />
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
