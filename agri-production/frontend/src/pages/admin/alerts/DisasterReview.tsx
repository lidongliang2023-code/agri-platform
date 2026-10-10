/**
 * 页面名称：灾害事件复盘（PRD 6.2 #25）
 * 路由路径：/admin/production/alerts/review
 * 所属模块：异常告警处理
 *
 * ⚠️ 数据源口径（2026-10 实测 + 后端源码取证，**本页定位经 team-lead 裁决修正**）
 *
 * 本页后端数据源是 `GET /api/v1/production/admin/alerts/review`，返回 **AlertVO（已处置告警）**。
 * 关键取证（`AdminAlertController.java:95-100` 与 `AdminAlertService.java:191-199` 的注释原文）：
 * 「运营端「灾情复核」页（/admin/production/alerts/review）与告警中心共用 1/2/3/4 数字枚举映射，
 *   此前直接吐实体 AlertInfoEntity，alertLevel 是 "URGENT" 这类英文串，前端取 LEVEL_MAP['URGENT']
 *   得到 undefined 后访问 .color 抛错，页面崩溃（实测 pageerror 4 条）」
 * → 该端点是**后端专门为本页写的**，且曾专门为本页修过一次枚举崩溃。
 *   所以正确定性是「后端主动拿『已处置告警』顶替灾情复盘」，不是「前端复用错端点」。
 *
 * 因此本页的处置口径是**消费真数据 + 标注口径**，而不是降级成「未接入」：
 * - AlertVO 有 **13 个真字段**可直接喂这张表（见 DATA_SOURCE_NOTE 的映射清单）；
 * - 真正没有的只有 4 个 PRD 字段：灾害类型 / 受灾面积 / 经济损失 / 改进措施
 *   （注意：`alertSource` 是「告警来源」，与「灾害类型」语义不同，不拿来顶替）；
 * - 那 4 个用「—」+ 橙色提示图标（沿用 MetricNumber 机制），不兜 0、不留空白。
 *
 * 上一版（4369a59d）把 8 行真实已处置告警整批 filter 掉、只挂一句「未接入」，
 * 属**过度降级**：用「信息缺失」换「不撒谎」，比保留 + 标注口径更糟。本版纠正。
 *
 * 另注：api 层 `listDisasterReviews` 的返回类型标注为 `PageResult<DisasterReview>`，
 * 与运行时（AlertVO）不符。本单范围限定只改本文件，故不改 api 层，
 * 在此按 AlertVO 真字段收窄消费，并显式注释这处谎报。
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
import { hasNonEmptyTextFields } from '@/utils/shape-guard'
import type { DisasterReview as DisasterReviewBase, PageResult } from '@/types'

/** 告警级别：1 提示 2 一般 3 重要 4 紧急（与后端 AlertDict + AdminAlertCenter 同口径） */
type AlertLevel = 1 | 2 | 3 | 4

/** 告警级别文案与颜色（与告警中心 AdminAlertCenter 完全一致，避免同域两处口径打架） */
const LEVEL_MAP: Record<AlertLevel, { label: string; color: string }> = {
  4: { label: '紧急', color: 'red' },
  3: { label: '重要', color: 'orange' },
  2: { label: '一般', color: 'blue' },
  1: { label: '提示', color: 'default' },
}

/** 处置状态：1 待处理 2 处理中 3 已处理 4 已忽略（与 AdminAlertCenter 同口径） */
const STATUS_MAP: Record<number, { label: string; color: string }> = {
  1: { label: '待处理', color: 'red' },
  2: { label: '处理中', color: 'gold' },
  3: { label: '已处理', color: 'green' },
  4: { label: '已忽略', color: 'default' },
}

/**
 * 告警来源编码 → 文案（后端 AlertSource 注释：1 环境 2 设备 3 病虫害 4 任务 5 投入品）。
 *
 * 这里比 AdminAlertCenter 映射得更全：告警中心只有「设备故障/环境异常/任务超时」三类桶，
 * 3(病虫害)、5(投入品) 在它那里无处可放才显示「—」；本页是「灾害/告警处置复核」，
 * 病虫害与投入品本身就是有效来源，直接照后端注释映射是真实的，不是臆测归类。
 */
const SOURCE_MAP: Record<number, string> = {
  1: '环境异常',
  2: '设备故障',
  3: '病虫害',
  4: '任务超时',
  5: '投入品',
}

/**
 * 安全取告警级别展示元数据。
 *
 * 越界 / 缺失返回「—」，避免 LEVEL_MAP[level] 取到 undefined 后再访问 .color 整页白屏
 * （后端注释里记的那次崩溃就是这么来的）。
 *
 * @param level 后端告警级别
 * @returns 展示文案与 Tag 颜色
 */
function levelMeta(level: number): { label: string; color: string } {
  return LEVEL_MAP[level as AlertLevel] ?? { label: MISSING_VALUE_TEXT, color: 'default' }
}

/**
 * 安全取处置状态展示元数据。
 *
 * @param status 后端处置状态
 * @returns 展示文案与 Tag 颜色；未知返回「—」
 */
function statusMeta(status: number): { label: string; color: string } {
  return STATUS_MAP[status] ?? { label: MISSING_VALUE_TEXT, color: 'default' }
}

/**
 * 后端 AlertVO 在本页消费的真字段。
 *
 * 为什么另立接口而不直接用 `DisasterReview`：api 层标注的 `DisasterReview` 字段
 * （reviewId/eventName/affectedArea/economicLoss/improvement...）后端**一个都不返回**，
 * 沿用它会让 TS 继续「担保」这些字段存在，重蹈整页崩溃。
 * 本接口只声明 AlertVO 里真实存在的字段，且几乎全部可选。
 */
interface AlertReviewItem {
  /** 告警 ID：本页唯一键 */
  alertId: string
  /** 告警标题 → 事件名称 */
  alertTitle?: string
  /** 告警级别 1-4 */
  alertLevel?: number
  /** 告警来源 1-5 */
  alertSource?: number
  /** 关联农场 ID */
  farmId?: string
  /** 关联地块 ID */
  plotId?: string
  /** 关联设备 ID */
  deviceId?: string
  /** 触发值（后端 BigDecimal，运行时可能是数字字符串） */
  triggerValue?: number | string
  /** 处置状态 1-4 */
  status?: number
  /** 处置人 */
  handlerName?: string
  /** 处置说明 → 处置过程 */
  handleRemark?: string
  /** 触发时间 */
  triggeredAt?: string
  /** 处置时间 */
  handledAt?: string
}

/** 受灾面积缺失提示 */
const AREA_MISSING_TIP = '未接入：后端 AlertVO 无 affectedArea（受灾面积）字段，显示为「—」而非 0'

/** 经济损失缺失提示 */
const LOSS_MISSING_TIP = '未接入：后端 AlertVO 无 economicLoss（经济损失）字段，显示为「—」而非 0'

/** 灾害类型缺失提示 */
const DISASTER_TYPE_MISSING_TIP =
  '未接入：后端 AlertVO 无 disasterType（灾害类型）字段；alertSource 是「告警来源」，语义不同，不拿来顶替'

/** 改进措施缺失提示 */
const IMPROVEMENT_MISSING_TIP = '未接入：后端 AlertVO 无 improvement（改进措施）字段，显示为「—」'

/** 数据源口径说明（顶部 Alert 正文） */
const DATA_SOURCE_NOTE =
  '本页后端数据源为「已处置告警」GET /api/v1/production/admin/alerts/review——' +
  '该端点是后端专门为本页提供的 AlertVO 视图（后端无独立的灾害复盘域）。' +
  '字段映射：事件名称←alertTitle、告警级别←alertLevel、告警来源←alertSource、' +
  '关联农场←farmId、关联地块←plotId、关联设备←deviceId、触发值←triggerValue、' +
  '处置人←handlerName、处置过程←handleRemark、触发时间←triggeredAt、处置时间←handledAt、状态←status。' +
  '以下 PRD 字段后端未提供，统一显示「—」：灾害类型 / 受灾面积 / 经济损失 / 改进措施。'

/** 写接口缺失说明（放在损失评估 / 改进措施两个 Tab 内，避免用户以为能存） */
const WRITE_UNAVAILABLE_NOTE =
  '后端没有 PUT /admin/alerts/review/{id}，且 AlertVO 不含受灾面积 / 经济损失 / 改进措施字段。' +
  '下方表单为 PRD 形态保留，提交会如实报错，不会假装保存成功。'

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

/** 筛选条件（后端 /review 不收任何业务筛选参数，故全部在前端过滤） */
interface ReviewFilters {
  /** 事件名称关键字 */
  keyword?: string
  /** 告警级别 */
  alertLevel?: AlertLevel
}

/**
 * 灾害事件复盘页面（数据源：已处置告警）
 * @returns 页面内容
 */
export default function DisasterReview(): JSX.Element {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [filterForm] = Form.useForm<ReviewFilters>()
  const [lossForm] = Form.useForm<LossFormValues>()
  const [measureForm] = Form.useForm<MeasureFormValues>()
  const [createForm] = Form.useForm<CreateFormValues>()
  const [filters, setFilters] = useState<ReviewFilters>({})
  const [rows, setRows] = useState<AlertReviewItem[]>([])
  const [detailRow, setDetailRow] = useState<AlertReviewItem | undefined>(undefined)
  const [detailOpen, setDetailOpen] = useState<boolean>(false)
  const [createOpen, setCreateOpen] = useState<boolean>(false)

  const listQuery = useQuery({
    queryKey: ['admin-disaster-reviews', filters],
    queryFn: async (): Promise<AlertReviewItem[]> => {
      // api 层标注 PageResult<DisasterReview> 与运行时（AlertVO）不符，见文件头说明；
      // 本单不改 api 层，在页面内按真形状收窄消费。
      const page: PageResult<DisasterReviewBase> = await listDisasterReviews({
        pageNum: 1,
        pageSize: 100,
      })
      const list = (page?.list ?? []) as unknown as AlertReviewItem[]
      if (!Array.isArray(list) || list.length === 0) {
        return []
      }
      // 形状校验：只认带 alertId 的行（alertId 是 AlertVO 唯一键，也是 rowKey 来源）
      return list.filter((item) => hasNonEmptyTextFields(item, ['alertId']))
    },
  })

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data)
    }
  }, [listQuery.data])

  /** 前端过滤（后端 /review 只收 page/size，不收业务筛选参数） */
  const displayRows = useMemo(
    () =>
      rows.filter((row) => {
        if (filters.keyword && !(row.alertTitle ?? '').includes(filters.keyword)) {
          return false
        }
        if (filters.alertLevel !== undefined && row.alertLevel !== filters.alertLevel) {
          return false
        }
        return true
      }),
    [rows, filters],
  )

  /**
   * 统计汇总。
   *
   * 分开处理，不再一刀切：
   * - 事件数、涉及农场数：后端有真数据（farmId），**真实算**；
   * - 累计受灾面积、累计经济损失：AlertVO 根本没有这两个字段，**恒为 null → 「—」**。
   *   （不是说「0 条所以算不出来」，是字段压根不存在，就算有 100 行也算不出来。）
   */
  const summary = useMemo(
    () => ({
      count: rows.length,
      farms: new Set(rows.map((row) => row.farmId).filter((id): id is string => Boolean(id))).size,
      area: null as number | null,
      loss: null as number | null,
    }),
    [rows],
  )

  /** 更新复盘（受灾面积 / 经济损失 / 改进措施后端均无该字段与写入端点，失败如实报错） */
  const updateMutation = useMutation({
    mutationFn: async (payload: { row: AlertReviewItem; patch: Partial<AlertReviewItem> }) => {
      const next = { ...payload.row, ...payload.patch }
      await updateDisasterReview(payload.row.alertId, {
        handleProcess: next.handleRemark,
      })
      return next
    },
    onSuccess: () => {
      message.success('复盘信息已保存')
      void queryClient.invalidateQueries({ queryKey: ['admin-disaster-reviews'] })
    },
    onError: (error: Error) => {
      message.error(`保存失败：${error.message || '后端未提供该写入接口'}`)
    },
  })

  /** 新增复盘（后端无 POST /admin/alerts/review，失败如实报错） */
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

  /** 删除复盘（后端无 DELETE /admin/alerts/review/{id}，失败如实报错） */
  const removeMutation = useMutation({
    mutationFn: async (row: AlertReviewItem) => {
      await deleteDisasterReview(row.alertId)
      return row.alertId
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
   * @param row 目标记录
   */
  const openDetail = (row: AlertReviewItem): void => {
    setDetailRow(row)
    setDetailOpen(true)
    lossForm.setFieldsValue({
      handleProcess: row.handleRemark,
      affectedArea: undefined,
      economicLoss: undefined,
      affectedFarmCount: undefined,
      yieldLossRate: undefined,
    })
    measureForm.setFieldsValue({ measures: [] })
  }

  /**
   * 由后端真实时间字段构造处置时间线。
   *
   * 只放 `triggeredAt → handledAt` 两个**真节点**，不补「灾前预警 / 灾中处置 / 灾后恢复」
   * 这类 PRD 三阶段——后端没有对应数据，补了就是编的。
   */
  const timelineNodes = useMemo<TimelineNode[]>(() => {
    if (!detailRow) {
      return []
    }
    const nodes: TimelineNode[] = []
    if (detailRow.triggeredAt) {
      nodes.push({
        time: detailRow.triggeredAt,
        title: '告警触发',
        detail: `${detailRow.alertTitle ?? MISSING_VALUE_TEXT}（来源：${
          SOURCE_MAP[detailRow.alertSource ?? 0] ?? MISSING_VALUE_TEXT
        }）`,
        color: 'red',
      })
    }
    if (detailRow.handledAt) {
      nodes.push({
        time: detailRow.handledAt,
        title: '处置完成',
        detail: detailRow.handleRemark ?? MISSING_VALUE_TEXT,
        color: 'green',
      })
    }
    return nodes
  }, [detailRow])

  const columns = useMemo(
    () => [
      { title: '告警编号', dataIndex: 'alertId', width: 150 },
      {
        title: '事件名称',
        dataIndex: 'alertTitle',
        width: 240,
        render: (text?: string) => <Typography.Text strong>{text ?? MISSING_VALUE_TEXT}</Typography.Text>,
      },
      {
        title: '告警级别',
        dataIndex: 'alertLevel',
        width: 100,
        render: (level?: number) => {
          if (level === undefined || level === null) {
            return MISSING_VALUE_TEXT
          }
          const meta = levelMeta(level)
          return <Tag color={meta.color}>{meta.label}</Tag>
        },
      },
      {
        title: '告警来源',
        dataIndex: 'alertSource',
        width: 110,
        render: (source?: number) => {
          const label = source === undefined || source === null ? undefined : SOURCE_MAP[source]
          return label ? <Tag>{label}</Tag> : MISSING_VALUE_TEXT
        },
      },
      {
        title: '灾害类型',
        key: 'disasterType',
        width: 110,
        render: () => <MetricNumber value={null} missingTip={DISASTER_TYPE_MISSING_TIP} />,
      },
      {
        title: '受灾面积',
        key: 'affectedArea',
        width: 120,
        render: () => <MetricNumber value={null} missingTip={AREA_MISSING_TIP} />,
      },
      {
        title: '经济损失',
        key: 'economicLoss',
        width: 130,
        render: () => <MetricNumber value={null} missingTip={LOSS_MISSING_TIP} />,
      },
      {
        title: '触发时间',
        dataIndex: 'triggeredAt',
        width: 160,
        render: (text?: string) => text ?? MISSING_VALUE_TEXT,
      },
      {
        title: '触发值',
        dataIndex: 'triggerValue',
        width: 110,
        render: (v: unknown) => <MetricNumber value={v} precision={2} />,
      },
      {
        title: '关联农场',
        dataIndex: 'farmId',
        width: 150,
        render: (text?: string) => text ?? MISSING_VALUE_TEXT,
      },
      {
        title: '处置人',
        dataIndex: 'handlerName',
        width: 120,
        render: (text?: string) => text ?? MISSING_VALUE_TEXT,
      },
      {
        title: '处置时间',
        dataIndex: 'handledAt',
        width: 160,
        render: (text?: string) => text ?? MISSING_VALUE_TEXT,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (status?: number) => {
          if (status === undefined || status === null) {
            return MISSING_VALUE_TEXT
          }
          const meta = statusMeta(status)
          return <Tag color={meta.color}>{meta.label}</Tag>
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 150,
        fixed: 'right' as const,
        render: (_: unknown, row: AlertReviewItem) => (
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
                  title: `确认删除复盘「${row.alertTitle ?? row.alertId}」？`,
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
          message="已处置告警加载失败"
          description={`${(listQuery.error as Error | null)?.message ?? '未知错误'}（不使用本地示例数据兜底，列表为空）`}
        />
      ) : null}

      <Alert
        type="info"
        showIcon
        message="数据源口径：本页展示的是「已处置告警」，不是 PRD 完整的灾害复盘模型"
        description={DATA_SOURCE_NOTE}
      />

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
              <Typography.Text type="secondary">涉及农场数（farmId 去重）</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>
                <MetricNumber value={summary.farms} suffix=" 个" />
              </Typography.Title>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Typography.Text type="secondary">累计受灾面积</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>
                <MetricNumber value={summary.area} suffix=" 亩" missingTip={AREA_MISSING_TIP} />
              </Typography.Title>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Typography.Text type="secondary">累计经济损失</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0, color: '#cf1322' }}>
                <MetricNumber value={summary.loss} prefix="¥ " missingTip={LOSS_MISSING_TIP} />
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
          <Form.Item name="keyword" label="事件名称">
            <Input allowClear placeholder="请输入事件名称关键字" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="alertLevel" label="告警级别">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 160 }}
              options={[
                { value: 4, label: '紧急' },
                { value: 3, label: '重要' },
                { value: 2, label: '一般' },
                { value: 1, label: '提示' },
              ]}
            />
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

        <Table<AlertReviewItem>
          rowKey="alertId"
          columns={columns}
          dataSource={displayRows}
          loading={listQuery.isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1900 }}
          locale={{ emptyText: <Empty description="暂无已处置告警记录" /> }}
        />
      </Card>

      {/* 详情抽屉：时间线 / 损失评估 / 改进措施 */}
      <Drawer
        title={detailRow ? `事件复盘 - ${detailRow.alertTitle ?? detailRow.alertId}` : '事件复盘'}
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
                      <Descriptions.Item label="告警编号">{detailRow.alertId}</Descriptions.Item>
                      <Descriptions.Item label="告警级别">
                        {detailRow.alertLevel === undefined || detailRow.alertLevel === null
                          ? MISSING_VALUE_TEXT
                          : (() => {
                              const meta = levelMeta(detailRow.alertLevel)
                              return <Tag color={meta.color}>{meta.label}</Tag>
                            })()}
                      </Descriptions.Item>
                      <Descriptions.Item label="告警来源">
                        {detailRow.alertSource === undefined || detailRow.alertSource === null
                          ? MISSING_VALUE_TEXT
                          : (SOURCE_MAP[detailRow.alertSource] ?? MISSING_VALUE_TEXT)}
                      </Descriptions.Item>
                      <Descriptions.Item label="灾害类型">
                        <MetricNumber value={null} missingTip={DISASTER_TYPE_MISSING_TIP} />
                      </Descriptions.Item>
                      <Descriptions.Item label="触发时间">
                        {detailRow.triggeredAt ?? MISSING_VALUE_TEXT}
                      </Descriptions.Item>
                      <Descriptions.Item label="触发值">
                        <MetricNumber value={detailRow.triggerValue} precision={2} />
                      </Descriptions.Item>
                      <Descriptions.Item label="关联农场">
                        {detailRow.farmId ?? MISSING_VALUE_TEXT}
                      </Descriptions.Item>
                      <Descriptions.Item label="关联地块">
                        {detailRow.plotId ?? MISSING_VALUE_TEXT}
                      </Descriptions.Item>
                      <Descriptions.Item label="关联设备">
                        {detailRow.deviceId ?? MISSING_VALUE_TEXT}
                      </Descriptions.Item>
                      <Descriptions.Item label="处置人">
                        {detailRow.handlerName ?? MISSING_VALUE_TEXT}
                      </Descriptions.Item>
                      <Descriptions.Item label="处置时间">
                        {detailRow.handledAt ?? MISSING_VALUE_TEXT}
                      </Descriptions.Item>
                      <Descriptions.Item label="处置状态">
                        {detailRow.status === undefined || detailRow.status === null
                          ? MISSING_VALUE_TEXT
                          : (() => {
                              const meta = statusMeta(detailRow.status)
                              return <Tag color={meta.color}>{meta.label}</Tag>
                            })()}
                      </Descriptions.Item>
                      <Descriptions.Item label="受灾面积">
                        <MetricNumber value={null} suffix=" 亩" missingTip={AREA_MISSING_TIP} />
                      </Descriptions.Item>
                      <Descriptions.Item label="经济损失">
                        <MetricNumber value={null} prefix="¥ " missingTip={LOSS_MISSING_TIP} />
                      </Descriptions.Item>
                      <Descriptions.Item label="改进措施" span={2}>
                        <MetricNumber value={null} missingTip={IMPROVEMENT_MISSING_TIP} />
                      </Descriptions.Item>
                      <Descriptions.Item label="处置过程" span={2}>
                        {detailRow.handleRemark ?? MISSING_VALUE_TEXT}
                      </Descriptions.Item>
                    </Descriptions>
                    {timelineNodes.length > 0 ? (
                      <Timeline
                        items={timelineNodes.map((node) => ({
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
                      <Empty description="该告警缺少触发/处置时间，无法生成时间线" />
                    )}
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      时间线仅由后端真实时间字段（triggeredAt / handledAt）构成；
                      PRD 的「灾前预警 → 灾中处置 → 灾后恢复」三阶段后端无对应数据，不补。
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                key: 'loss',
                label: '② 损失评估',
                children: (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Alert type="warning" showIcon message="该组字段后端未提供" description={WRITE_UNAVAILABLE_NOTE} />
                    <Form<LossFormValues>
                      form={lossForm}
                      layout="vertical"
                      onFinish={(values) =>
                        updateMutation.mutate({
                          row: detailRow,
                          patch: { handleRemark: values.handleProcess },
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
                        label="处置过程（对应后端 handleRemark）"
                        rules={[{ required: true, message: '请填写处置过程' }]}
                      >
                        <Input.TextArea rows={4} maxLength={500} showCount />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                        保存损失评估
                      </Button>
                    </Form>
                  </Space>
                ),
              },
              {
                key: 'improvement',
                label: '③ 改进措施',
                children: (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Alert type="warning" showIcon message="该组字段后端未提供" description={WRITE_UNAVAILABLE_NOTE} />
                    <Form<MeasureFormValues>
                      form={measureForm}
                      layout="vertical"
                      onFinish={(values) =>
                        updateMutation.mutate({
                          row: detailRow,
                          patch: { handleRemark: values.measures.filter(Boolean).join('\n') },
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
                  </Space>
                ),
              },
            ]}
          />
        ) : null}
      </Drawer>

      {/* 新增复盘抽屉（后端无 POST /admin/alerts/review，提交会如实报错） */}
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
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="后端无新增端点"
          description="后端没有 POST /admin/alerts/review，提交会如实报错，不会假装创建成功。"
        />
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
                <Select
                  options={[
                    { value: '洪涝', label: '洪涝' },
                    { value: '干旱', label: '干旱' },
                    { value: '霜冻', label: '霜冻' },
                    { value: '台风', label: '台风' },
                    { value: '病虫害', label: '病虫害' },
                    { value: '冰雹', label: '冰雹' },
                  ]}
                />
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
