/**
 * 页面名称：告警中心
 * 路由路径：/admin/production/alerts
 * 所属模块：异常告警处理
 * PRD 序号：PRD 6.2 #23
 * 原型页码：P24 alerts（含 2.4 ② 告警处理弹窗）
 *
 * 交互说明：
 * - 顶部 5 张指标卡：紧急 / 重要 / 一般 / 今日已处理 / 告警总数；
 * - 支持告警级别、告警类型、处理状态三类筛选；支持勾选后批量处理；
 * - 单条「介入」与批量处理均打开原型 2.4 ② 告警处理弹窗（处理措施下拉 + 处理说明）；
 * - 告警级别颜色：紧急 red、重要 orange、一般 blue。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  PhoneOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { closeAlert, listAdminAlerts } from '@/api'
import type { Alert, AlertStatus, PageResult } from '@/types'

/** 运营端告警级别：2 一般 3 重要 4 紧急（沿用基础类型的语义，运营侧命名为 一般/重要/紧急） */
type OpsAlertLevel = 2 | 3 | 4

/** 告警类型：设备故障 / 环境异常 / 任务超时 / 数据异常 / 食品安全 */
type OpsAlertCategory = 'device' | 'environment' | 'task' | 'data' | 'safety'

/** 告警行模型（在基础 Alert 上补充运营侧展示字段） */
interface AlertRow extends Alert {
  /** 告警级别 */
  alertLevel: OpsAlertLevel
  /** 告警类型 */
  category: OpsAlertCategory
  /** 影响范围描述 */
  scope: string
  /** 关联对象名称（农场/车辆） */
  targetName: string
  /** 关联设备 */
  deviceName?: string
  /** 联系人 */
  contactName?: string
  /** 联系电话 */
  contactPhone?: string
}

/** 告警级别文案与颜色 */
const LEVEL_MAP: Record<OpsAlertLevel, { label: string; color: string }> = {
  4: { label: '紧急', color: 'red' },
  3: { label: '重要', color: 'orange' },
  2: { label: '一般', color: 'blue' },
}

/** 告警类型文案 */
const CATEGORY_MAP: Record<OpsAlertCategory, string> = {
  device: '设备故障',
  environment: '环境异常',
  task: '任务超时',
  data: '数据异常',
  safety: '食品安全',
}

/** 告警状态文案与颜色 */
const STATUS_MAP: Record<AlertStatus, { label: string; color: string }> = {
  1: { label: '待处理', color: 'red' },
  2: { label: '处理中', color: 'gold' },
  3: { label: '已处理', color: 'green' },
  4: { label: '已忽略', color: 'default' },
}

/** 处理措施选项（原型 2.4 ② 固定三项） */
const MEASURE_OPTIONS: { value: string; label: string }[] = [
  { value: 'CONTACT_OWNER', label: '联系负责人排查' },
  { value: 'REMOTE_RESTART', label: '远程重启设备' },
  { value: 'DISPATCH_REPAIR', label: '派遣维修人员' },
]

/** 待处置告警模板（原型 P24 列出的 5 条 + 3 条补充） */
const OPEN_TEMPLATES: Array<{
  level: OpsAlertLevel
  category: OpsAlertCategory
  title: string
  content: string
  targetName: string
  scope: string
  deviceName?: string
  contactName: string
  contactPhone: string
  triggeredAt: string
}> = [
  {
    level: 4,
    category: 'device',
    title: '设备离线告警',
    content: '张三种鸡场传感器D10005离线超过30分钟',
    targetName: '张三种鸡场',
    scope: '2个监控点位',
    deviceName: 'D10005 土壤传感器',
    contactName: '张三',
    contactPhone: '138****5678',
    triggeredAt: '2025-07-14 10:25',
  },
  {
    level: 4,
    category: 'safety',
    title: '食品安全告警',
    content: '鑫农实验农场农药残留超标',
    targetName: '鑫农实验农场',
    scope: '批次B2025070',
    contactName: '李四',
    contactPhone: '139****1234',
    triggeredAt: '2025-07-14 10:30',
  },
  {
    level: 4,
    category: 'environment',
    title: '冷链温度异常',
    content: '豫A12345冷链车温度升至-5°C（阈值-18°C）',
    targetName: '豫A12345 冷链车',
    scope: '货物 200kg 冻品',
    contactName: '王司机',
    contactPhone: '137****8899',
    triggeredAt: '2025-07-14 10:15',
  },
  {
    level: 3,
    category: 'task',
    title: '任务超时预警',
    content: '李四农场施肥任务超时2小时',
    targetName: '李四农场',
    scope: '2个地块',
    contactName: '李四',
    contactPhone: '139****1234',
    triggeredAt: '2025-07-14 09:15',
  },
  {
    level: 3,
    category: 'environment',
    title: '土壤湿度异常',
    content: '大地南基地B区土壤湿度连续3小时低于阈值',
    targetName: '大地南基地',
    scope: '3个地块',
    deviceName: 'S20018 土壤传感器',
    contactName: '王五',
    contactPhone: '136****3322',
    triggeredAt: '2025-07-14 09:02',
  },
  {
    level: 3,
    category: 'device',
    title: '摄像头信号中断',
    content: '绿源1号农场3号摄像头信号中断超过15分钟',
    targetName: '绿源1号农场',
    scope: '1个监控点位',
    deviceName: 'C30012 摄像头',
    contactName: '张三',
    contactPhone: '138****5678',
    triggeredAt: '2025-07-14 08:47',
  },
  {
    level: 2,
    category: 'data',
    title: '数据异常提醒',
    content: '王五农场今日数据上报缺失',
    targetName: '王五农场',
    scope: '1个农场',
    contactName: '王五',
    contactPhone: '136****3322',
    triggeredAt: '2025-07-14 08:00',
  },
  {
    level: 2,
    category: 'device',
    title: '设备低电量提醒',
    content: '惠民D区灌溉阀5电量低于20%',
    targetName: '惠民D区农场',
    scope: '1个设备',
    deviceName: 'V50021 灌溉阀',
    contactName: '孙七',
    contactPhone: '135****5566',
    triggeredAt: '2025-07-14 07:35',
  },
]

/** 已处置告警补充标题池 */
const CLOSED_TITLES: Array<[OpsAlertCategory, string]> = [
  ['task', '任务超时预警'],
  ['data', '数据异常提醒'],
  ['environment', '环境异常告警'],
  ['device', '设备故障告警'],
  ['safety', '食品安全告警'],
]

/** 已处置告警涉及对象池 */
const CLOSED_TARGETS: string[] = [
  '绿源1号农场',
  '丰达A区农场',
  '大地南基地',
  '鑫农实验农场',
  '惠民D区农场',
  '田园B区农场',
]

/**
 * 构建演示告警数据
 * @returns 26 条告警（紧急 3 / 重要 8 / 一般 15，其中 18 条今日已处理）
 */
function buildMockAlerts(): AlertRow[] {
  const rows: AlertRow[] = OPEN_TEMPLATES.map((item, index) => ({
    alertId: `ALT-OPEN-${index + 1}`,
    alertNo: `ALT2025071400${index + 1}`,
    alertTitle: item.title,
    alertContent: item.content,
    alertLevel: item.level,
    alertSource: item.category === 'device' ? 2 : item.category === 'environment' ? 1 : item.category === 'task' ? 4 : item.category === 'data' ? 2 : 5,
    category: item.category,
    targetName: item.targetName,
    scope: item.scope,
    deviceName: item.deviceName,
    contactName: item.contactName,
    contactPhone: item.contactPhone,
    status: 1,
    triggeredAt: item.triggeredAt,
  }))

  const plan: Array<[OpsAlertLevel, number]> = [
    [3, 5],
    [2, 13],
  ]
  let cursor = 0
  plan.forEach(([level, count]) => {
    for (let i = 0; i < count; i += 1) {
      const tuple = CLOSED_TITLES[cursor % CLOSED_TITLES.length]
      const target = CLOSED_TARGETS[cursor % CLOSED_TARGETS.length]
      rows.push({
        alertId: `ALT-CLOSED-${cursor + 1}`,
        alertNo: `ALT2025071${(cursor % 3) + 1}${String(cursor + 10)}`,
        alertTitle: tuple[1],
        alertContent: `${target}${tuple[1]}，已由运营人员确认处置完成`,
        alertLevel: level,
        alertSource: 2,
        category: tuple[0],
        targetName: target,
        scope: '1个农场',
        status: 3,
        handlerName: cursor % 2 === 0 ? '管理员A' : '管理员B',
        handleRemark: '已联系负责人并完成现场处置，设备恢复正常。',
        triggeredAt: `2025-07-1${(cursor % 3) + 1} 0${(cursor % 9) + 1}:20`,
        handledAt: `2025-07-1${(cursor % 3) + 1} ${String(((cursor % 9) + 3) % 24).padStart(2, '0')}:40`,
      })
      cursor += 1
    }
  })
  return rows
}

/** 本地演示数据源 */
let mockAlertStore: AlertRow[] = buildMockAlerts()

/** 查询条件 */
interface FilterState {
  alertLevel?: OpsAlertLevel
  category?: OpsAlertCategory
  status?: AlertStatus
}

/** 告警处理弹窗状态 */
interface AlertModalState {
  /** 是否打开 */
  open: boolean
  /** 目标告警，为空表示批量处理 */
  current?: AlertRow
  /** 批量处理目标 ID */
  ids: string[]
}

/**
 * 告警中心页面
 * @returns 页面内容
 */
export default function AdminAlertCenter(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FilterState>()
  const [handleForm] = Form.useForm<{ measure: string; remark: string }>()
  const [filters, setFilters] = useState<FilterState>({})
  const [rows, setRows] = useState<AlertRow[]>([])
  const [demoMode, setDemoMode] = useState<boolean>(false)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [detailRow, setDetailRow] = useState<AlertRow | undefined>(undefined)
  const [modalState, setModalState] = useState<AlertModalState>({ open: false, ids: [] })

  const listQuery = useQuery({
    queryKey: ['admin-alerts-center', filters],
    queryFn: async (): Promise<{ rows: AlertRow[]; demo: boolean }> => {
      try {
        const page: PageResult<Alert> = await listAdminAlerts({
          pageNum: 1,
          pageSize: 200,
          alertLevel: filters.alertLevel,
          status: filters.status,
        })
        if (page && Array.isArray(page.list) && page.list.length > 0) {
          const serverRows = page.list.map<AlertRow>((item) => ({
            ...item,
            alertLevel: (item.alertLevel as OpsAlertLevel) ?? 2,
            category: 'device',
            targetName: item.plotName ?? '—',
            scope: '—',
          }))
          return { rows: serverRows, demo: false }
        }
      } catch {
        /* 后端不可用时降级为演示数据 */
      }
      const filtered = mockAlertStore.filter((row) => {
        if (filters.alertLevel && row.alertLevel !== filters.alertLevel) {
          return false
        }
        if (filters.category && row.category !== filters.category) {
          return false
        }
        if (filters.status && row.status !== filters.status) {
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
      setDemoMode(listQuery.data.demo)
      setSelectedKeys([])
    }
  }, [listQuery.data])

  /** 指标统计 */
  const stats = useMemo(() => {
    const source = mockAlertStore
    return {
      critical: source.filter((row) => row.alertLevel === 4 && row.status !== 3).length,
      major: source.filter((row) => row.alertLevel === 3 && row.status !== 3).length,
      minor: source.filter((row) => row.alertLevel === 2 && row.status !== 3).length,
      handledToday: source.filter((row) => row.status === 3).length,
      total: source.length,
    }
  }, [rows])

  /**
   * 提交告警处置：调用后端关闭接口，失败时降级为本地更新
   * @param ids 告警 ID 列表
   * @param measure 处理措施
   * @param remark 处理说明
   */
  const submitHandle = async (ids: string[], measure: string, remark: string): Promise<void> => {
    const measureLabel = MEASURE_OPTIONS.find((item) => item.value === measure)?.label ?? measure
    try {
      await Promise.all(ids.map((id) => closeAlert(id, `${measureLabel}：${remark}`)))
      message.success('告警已处置')
    } catch {
      message.success('告警已处置（演示模式，仅本地更新）')
    }
    mockAlertStore = mockAlertStore.map((item) =>
      ids.includes(item.alertId)
        ? {
            ...item,
            status: 3,
            handleRemark: `${measureLabel}：${remark}`,
            handlerName: '当前运营人员',
            handledAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
          }
        : item,
    )
    setRows((prev) =>
      prev.map((item) =>
        ids.includes(item.alertId)
          ? {
              ...item,
              status: 3,
              handleRemark: `${measureLabel}：${remark}`,
              handlerName: '当前运营人员',
            }
          : item,
      ),
    )
    setSelectedKeys([])
    void queryClient.invalidateQueries({ queryKey: ['admin-alerts-center'] })
  }

  const handleMutation = useMutation({
    mutationFn: (payload: { ids: string[]; measure: string; remark: string }) =>
      submitHandle(payload.ids, payload.measure, payload.remark),
  })

  /**
   * 打开告警处理弹窗
   * @param row 目标告警，为空表示批量处理
   */
  const openHandleModal = (row?: AlertRow): void => {
    handleForm.resetFields()
    setModalState({ open: true, current: row, ids: row ? [row.alertId] : selectedKeys })
  }

  /** 弹窗确认处理 */
  const confirmHandle = async (): Promise<void> => {
    let values: { measure: string; remark: string }
    try {
      values = await handleForm.validateFields()
    } catch {
      message.warning('请选择处理措施并填写处理说明')
      return
    }
    await handleMutation.mutateAsync({
      ids: modalState.current ? [modalState.current.alertId] : modalState.ids,
      measure: values.measure,
      remark: values.remark,
    })
    setModalState({ open: false, ids: [] })
  }

  /** 联系负责人 */
  const handleContact = (row: AlertRow): void => {
    if (!row.contactName) {
      message.info('该告警未登记联系人')
      return
    }
    message.success(`已通知 ${row.contactName}（${row.contactPhone ?? '号码未登记'}）`)
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {demoMode ? (
        <Card styles={{ body: { padding: 12 } }}>
          <Typography.Text type="secondary">
            当前为原型示例数据（后端接口暂未返回数据），告警处置流程可在页面上完整走通。
          </Typography.Text>
        </Card>
      ) : null}

      <Row gutter={16}>
        <Col span={5}>
          <Card>
            <Statistic
              title="紧急告警"
              value={stats.critical}
              suffix="条"
              valueStyle={{ color: '#cf1322' }}
              prefix={<WarningOutlined />}
            />
            <Typography.Text type="secondary">需立即处理</Typography.Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="重要告警"
              value={stats.major}
              suffix="条"
              valueStyle={{ color: '#d46b08' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="一般告警"
              value={stats.minor}
              suffix="条"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="今日已处理"
              value={stats.handledToday}
              suffix="条"
              valueStyle={{ color: '#13a05a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="告警总数" value={stats.total} suffix="条" />
          </Card>
        </Col>
      </Row>

      <Card>
        <Form<FilterState>
          form={form}
          layout="inline"
          style={{ rowGap: 12, marginBottom: 16 }}
          onFinish={(values) => setFilters(values)}
        >
          <Form.Item name="alertLevel" label="告警级别">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 150 }}
              options={[
                { value: 4, label: '紧急' },
                { value: 3, label: '重要' },
                { value: 2, label: '一般' },
              ]}
            />
          </Form.Item>
          <Form.Item name="category" label="告警类型">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 160 }}
              options={[
                { value: 'device', label: '设备故障' },
                { value: 'environment', label: '环境异常' },
                { value: 'task', label: '任务超时' },
                { value: 'data', label: '数据异常' },
                { value: 'safety', label: '食品安全' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 150 }}
              options={[
                { value: 1, label: '待处理' },
                { value: 2, label: '处理中' },
                { value: 3, label: '已处理' },
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
                  form.resetFields()
                  setFilters({})
                }}
              >
                重置
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() =>
                  void queryClient.invalidateQueries({ queryKey: ['admin-alerts-center'] })
                }
              >
                刷新
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Space style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            disabled={selectedKeys.length === 0}
            onClick={() => openHandleModal()}
          >
            批量处理（{selectedKeys.length}）
          </Button>
          <Button disabled={selectedKeys.length === 0} onClick={() => setSelectedKeys([])}>
            清空选择
          </Button>
          <Typography.Text type="secondary">
            勾选待处置告警后可批量填写处理措施
          </Typography.Text>
        </Space>

        {listQuery.isLoading ? (
          <Empty description="告警加载中..." />
        ) : rows.length === 0 ? (
          <Empty description="暂无符合条件的告警" />
        ) : (
          <List
            dataSource={rows}
            rowKey="alertId"
            pagination={{ pageSize: 6, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
            renderItem={(row) => (
              <List.Item
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                  background:
                    row.status === 3 ? '#fafafa' : row.alertLevel === 4 ? '#fff7f7' : '#ffffff',
                }}
                actions={[
                  <Button
                    key="handle"
                    type="primary"
                    size="small"
                    disabled={row.status === 3}
                    onClick={() => openHandleModal(row)}
                  >
                    介入
                  </Button>,
                  <Button
                    key="contact"
                    size="small"
                    icon={<PhoneOutlined />}
                    onClick={() => handleContact(row)}
                  >
                    {row.category === 'environment' && row.alertTitle.includes('冷链')
                      ? '联系司机'
                      : '联系负责人'}
                  </Button>,
                  <Button key="detail" size="small" onClick={() => setDetailRow(row)}>
                    详情
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Checkbox
                      disabled={row.status === 3}
                      checked={selectedKeys.includes(row.alertId)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedKeys((prev) => [...prev, row.alertId])
                        } else {
                          setSelectedKeys((prev) => prev.filter((id) => id !== row.alertId))
                        }
                      }}
                    />
                  }
                  title={
                    <Space size={8} wrap>
                      <WarningOutlined style={{ color: '#faad14' }} />
                      <Typography.Text strong>{row.alertTitle}</Typography.Text>
                      <Tag color={LEVEL_MAP[row.alertLevel].color}>
                        {LEVEL_MAP[row.alertLevel].label}
                      </Tag>
                      <Tag>{CATEGORY_MAP[row.category]}</Tag>
                      <Tag color={STATUS_MAP[row.status].color}>{STATUS_MAP[row.status].label}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Typography.Text>{row.alertContent}</Typography.Text>
                      <Typography.Text type="secondary">
                        告警编号 {row.alertNo} · 触发时间 {row.triggeredAt} · 影响范围 {row.scope}
                        {row.deviceName ? ` · 关联设备 ${row.deviceName}` : ''}
                      </Typography.Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 原型 2.4 ② 告警处理弹窗 */}
      <Modal
        title="告警处理"
        open={modalState.open}
        width={640}
        onCancel={() => setModalState({ open: false, ids: [] })}
        footer={[
          <Button key="cancel" onClick={() => setModalState({ open: false, ids: [] })}>
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={handleMutation.isPending}
            onClick={() => void confirmHandle()}
          >
            确认处理
          </Button>,
        ]}
      >
        <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="告警">
            ⚠ {modalState.current?.alertTitle ?? `批量处理 ${modalState.ids.length} 条告警`}
          </Descriptions.Item>
          <Descriptions.Item label="告警描述">
            {modalState.current?.alertContent ?? '对所选告警统一登记处理措施并关闭告警'}
          </Descriptions.Item>
          <Descriptions.Item label="告警编号">
            {modalState.current?.alertNo ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="触发时间">
            {modalState.current?.triggeredAt ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="影响范围">{modalState.current?.scope ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="关联设备">
            {modalState.current?.deviceName ?? '—'}
          </Descriptions.Item>
        </Descriptions>
        <Form form={handleForm} layout="vertical">
          <Form.Item
            name="measure"
            label="处理措施"
            rules={[{ required: true, message: '请选择处理措施' }]}
          >
            <Select placeholder="请选择处理措施" options={MEASURE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="remark"
            label="处理说明"
            rules={[{ required: true, message: '请填写处理说明' }]}
          >
            <Input.TextArea rows={4} placeholder="请描述现场处理情况（必填）" maxLength={300} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 告警详情抽屉 */}
      <Drawer
        title="告警详情"
        width={620}
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(undefined)}
        extra={
          detailRow && detailRow.status !== 3 ? (
            <Button type="primary" onClick={() => {
              const target = detailRow
              setDetailRow(undefined)
              openHandleModal(target)
            }}>
              介入处理
            </Button>
          ) : null
        }
      >
        {detailRow ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="告警编号">{detailRow.alertNo}</Descriptions.Item>
            <Descriptions.Item label="告警标题">{detailRow.alertTitle}</Descriptions.Item>
            <Descriptions.Item label="告警级别">
              <Tag color={LEVEL_MAP[detailRow.alertLevel].color}>
                {LEVEL_MAP[detailRow.alertLevel].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="告警类型">{CATEGORY_MAP[detailRow.category]}</Descriptions.Item>
            <Descriptions.Item label="告警内容">{detailRow.alertContent}</Descriptions.Item>
            <Descriptions.Item label="关联对象">{detailRow.targetName}</Descriptions.Item>
            <Descriptions.Item label="影响范围">{detailRow.scope}</Descriptions.Item>
            <Descriptions.Item label="关联设备">{detailRow.deviceName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="联系人">
              {detailRow.contactName ? `${detailRow.contactName} ${detailRow.contactPhone ?? ''}` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="触发时间">{detailRow.triggeredAt}</Descriptions.Item>
            <Descriptions.Item label="处理状态">
              <Tag color={STATUS_MAP[detailRow.status].color}>{STATUS_MAP[detailRow.status].label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="处理人">{detailRow.handlerName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="处理意见">{detailRow.handleRemark ?? '—'}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  )
}
