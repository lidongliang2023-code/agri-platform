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
  Alert as AntAlert,
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
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { closeAlert, listAdminAlerts } from '@/api'
import type { Alert, AlertStatus, PageResult } from '@/types'

/** 运营端告警级别：1 提示 2 一般 3 重要 4 紧急（与后端 AlertDict 的 INFO/WARN/CRITICAL/URGENT 对齐） */
type OpsAlertLevel = 1 | 2 | 3 | 4

/** 告警类型：后端 alertSource 只覆盖设备故障 / 环境异常 / 任务超时三类 */
type OpsAlertCategory = 'device' | 'environment' | 'task'

/** 告警行模型（在基础 Alert 上补充运营侧展示字段） */
interface AlertRow extends Alert {
  /** 告警级别 */
  alertLevel: OpsAlertLevel
  /** 告警类型：后端 alertSource 无法归入上述三类时为 undefined，展示「—」 */
  category?: OpsAlertCategory
  /** 关联对象名称：优先地块名，其次农场 ID / 地块 ID，都没有时展示「—」 */
  targetName: string
  /** 关联设备：后端只有 deviceId，无设备名称字段 */
  deviceName?: string
}

/** 告警级别文案与颜色 */
const LEVEL_MAP: Record<OpsAlertLevel, { label: string; color: string }> = {
  4: { label: '紧急', color: 'red' },
  3: { label: '重要', color: 'orange' },
  2: { label: '一般', color: 'blue' },
  1: { label: '提示', color: 'default' },
}

/**
 * 安全取告警级别展示元数据。
 *
 * 后端级别越界 / 缺失时返回「—」，避免 LEVEL_MAP[level] 取到 undefined 后
 * 再访问 .color 导致整页白屏（历史上踩过这个坑）。
 *
 * @param level 后端告警级别数字
 * @returns 展示文案与 Tag 颜色
 */
function levelMeta(level: number): { label: string; color: string } {
  return LEVEL_MAP[level as OpsAlertLevel] ?? { label: '—', color: 'default' }
}

/** 告警类型文案 */
const CATEGORY_MAP: Record<OpsAlertCategory, string> = {
  device: '设备故障',
  environment: '环境异常',
  task: '任务超时',
}

/**
 * 后端 alertSource 编码 → 页面告警类型。
 *
 * 后端取值：1 环境 2 设备 3 病虫害 4 任务 5 投入品；病虫害(3) 与投入品(5)
 * 在本页没有对应分类，返回 undefined 由调用方显示「—」，不做臆测归类。
 *
 * @param alertSource 后端告警来源编码
 * @returns 页面告警类型，无法映射时返回 undefined
 */
function resolveCategory(alertSource?: number | string): OpsAlertCategory | undefined {
  const code = Number(alertSource)
  if (code === 1) {
    return 'environment'
  }
  if (code === 2) {
    return 'device'
  }
  if (code === 4) {
    return 'task'
  }
  return undefined
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

/**
 * 查询条件
 *
 * 只保留后端 /admin/alerts 实际支持的 alertLevel 与 status 两个参数；
 * 「告警类型」后端列表接口没有该筛选维度（已在页面上移除，避免点了没反应）。
 */
interface FilterState {
  alertLevel?: OpsAlertLevel
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
  /** 后端返回的告警总数（分页 total），未加载时为 null，卡片展示「—」 */
  const [total, setTotal] = useState<number | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [detailRow, setDetailRow] = useState<AlertRow | undefined>(undefined)
  const [modalState, setModalState] = useState<AlertModalState>({ open: false, ids: [] })

  const listQuery = useQuery({
    queryKey: ['admin-alerts-center', filters],
    queryFn: async (): Promise<{ rows: AlertRow[]; total: number }> => {
      // 只取后端真实数据：返回空就是空，报错交给 TanStack Query 标记 isError，
      // 页面据实展示空态 / 错误提示，不再有任何本地演示数据兜底
      const page: PageResult<Alert> = await listAdminAlerts({
        pageNum: 1,
        pageSize: 200,
        alertLevel: filters.alertLevel,
        status: filters.status,
      })
      const list = page?.list ?? []
      return {
        rows: list.map<AlertRow>((item) => ({
          ...item,
          alertLevel: (item.alertLevel ?? 1) as OpsAlertLevel,
          category: resolveCategory(item.alertSource),
          targetName: item.plotName ?? item.farmId ?? item.plotId ?? '—',
          // 后端只有 deviceId，没有设备名称字段
          deviceName: item.deviceId ?? undefined,
        })),
        total: Number(page?.total ?? list.length),
      }
    },
  })

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.rows)
      setTotal(listQuery.data.total)
      setSelectedKeys([])
    }
  }, [listQuery.data])

  /**
   * 指标统计
   *
   * 全部基于后端真实返回的告警列表聚合：每页请求 200 条（当前库内共 20 条），
   * 因此分级计数等价于全量口径。后端另有 /admin/alerts/stats 聚合接口，
   * 但前端 api 层尚未暴露该函数，这里用列表聚合，绝不编造数字。
   */
  const stats = useMemo(() => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`
    return {
      critical: rows.filter((row) => row.alertLevel === 4 && row.status !== 3).length,
      major: rows.filter((row) => row.alertLevel === 3 && row.status !== 3).length,
      minor: rows.filter((row) => row.alertLevel === 2 && row.status !== 3).length,
      handledToday: rows.filter(
        (row) => row.status === 3 && (row.handledAt ?? '').slice(0, 10) === today,
      ).length,
      total,
    }
  }, [rows, total])

  /**
   * 提交告警处置：只调用后端关闭接口，成功 / 失败都如实反馈
   * @param ids 告警 ID 列表
   * @param measure 处理措施
   * @param remark 处理说明
   */
  const submitHandle = async (ids: string[], measure: string, remark: string): Promise<void> => {
    const measureLabel = MEASURE_OPTIONS.find((item) => item.value === measure)?.label ?? measure
    await Promise.all(ids.map((id) => closeAlert(id, `${measureLabel}：${remark}`)))
    message.success('告警已处置')
    setSelectedKeys([])
    // 以服务端数据为准重新拉取，不在本地伪造「已处置」状态
    void queryClient.invalidateQueries({ queryKey: ['admin-alerts-center'] })
  }

  const handleMutation = useMutation({
    mutationFn: (payload: { ids: string[]; measure: string; remark: string }) =>
      submitHandle(payload.ids, payload.measure, payload.remark),
    onError: (error) => {
      // 失败就是失败：不能把「没提交成功」说成「已本地登记」
      message.error(`告警处置失败：${(error as Error | null)?.message ?? '未知错误'}`)
    },
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
    try {
      await handleMutation.mutateAsync({
        ids: modalState.current ? [modalState.current.alertId] : modalState.ids,
        measure: values.measure,
        remark: values.remark,
      })
      setModalState({ open: false, ids: [] })
    } catch {
      // 处置失败时保留弹窗，错误提示由 handleMutation.onError 统一给出
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {listQuery.isError ? (
        <AntAlert
          type="error"
          showIcon
          message="告警列表加载失败"
          description={`${(listQuery.error as Error | null)?.message ?? '未知错误'}（不使用本地示例数据兜底，列表与统计均为空）`}
        />
      ) : null}
      {!listQuery.isError && !listQuery.isLoading && rows.length > 0 ? (
        <AntAlert
          type="info"
          showIcon
          message="数据口径说明"
          description="列表与统计均来自后端 /admin/alerts 真实数据；告警编号、告警内容、地块名称与处理人后端暂无数据，统一展示「—」。分级统计基于已加载告警（每页请求 200 条），告警总数取后端分页 total。"
        />
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
            <Statistic
              title="告警总数"
              value={stats.total ?? '—'}
              suffix={stats.total === null ? undefined : '条'}
            />
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
          <Empty
            description={
              listQuery.isError
                ? '告警加载失败，暂无数据可展示（不使用示例数据兜底）'
                : '后端 /admin/alerts 暂无符合条件的告警'
            }
          />
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
                      <Tag color={levelMeta(row.alertLevel).color}>
                        {levelMeta(row.alertLevel).label}
                      </Tag>
                      {row.category ? <Tag>{CATEGORY_MAP[row.category]}</Tag> : null}
                      <Tag color={STATUS_MAP[row.status].color}>{STATUS_MAP[row.status].label}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Typography.Text>{row.alertContent ?? '—'}</Typography.Text>
                      <Typography.Text type="secondary">
                        告警编号 {row.alertNo ?? '—'} · 触发时间 {row.triggeredAt ?? '—'} · 触发值{' '}
                        {row.triggerValue ?? '—'} · 关联对象 {row.targetName}
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
          <Descriptions.Item label="告警级别">
            {modalState.current ? levelMeta(modalState.current.alertLevel).label : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="关联对象">
            {modalState.current?.targetName ?? '—'}
          </Descriptions.Item>
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
            <Descriptions.Item label="告警编号">{detailRow.alertNo ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="告警标题">{detailRow.alertTitle}</Descriptions.Item>
            <Descriptions.Item label="告警级别">
              <Tag color={levelMeta(detailRow.alertLevel).color}>
                {levelMeta(detailRow.alertLevel).label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="告警类型">
              {detailRow.category ? CATEGORY_MAP[detailRow.category] : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="告警内容">{detailRow.alertContent ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="关联对象">{detailRow.targetName}</Descriptions.Item>
            <Descriptions.Item label="触发值">{detailRow.triggerValue ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="关联设备">{detailRow.deviceName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="触发时间">{detailRow.triggeredAt ?? '—'}</Descriptions.Item>
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
