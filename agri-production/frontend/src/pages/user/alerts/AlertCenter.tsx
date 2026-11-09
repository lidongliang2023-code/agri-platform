import Table from '@/components/BusinessRecordList'
/**
 * 页面名称：告警中心
 * 路由路径：/production/alerts
 * 所属模块：生长监测预警
 * PRD 序号：PRD 6.1 #26
 * 关联领域事件：prod.alert.triggered（载荷 alertId / level / scene / tenantId / farmId / content）
 *
 * 还原要点：
 * - 顶部指标卡：未处理 / 处理中 / 已处理 / 已忽略 与各级别分布
 * - 筛选：告警级别（紧急 / 严重 / 一般 / 提示）、处理状态、告警场景（来源）、触发时间、关键字
 * - 列表：告警编号、标题、级别 Tag、场景、触发值、地块、触发时间、状态、处理人
 * - 处理闭环：确认受理（1→2）→ 提交处理（2→3，填处理措施与结果），已处理即归档；忽略为独立终态
 * - 支持单条忽略与批量忽略
 *
 * 数据来源：`/alerts` + `/alerts/stats`；仅使用服务端真实记录，失败时提示重试。
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App as AntdApp,
  Alert as Feedback,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Steps,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BellOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import { getAlert, getAlertStats, handleAlert, ignoreAlerts, listAlerts } from '@/api/alerts'
import { alertLevelMeta, alertStatusMeta, formatNumber } from '@/utils/production-adapter'
import { errorMessageOf } from '@/utils/request'
import type { Alert, AlertStatus } from '@/types'

const { RangePicker } = DatePicker
const { Text, Paragraph } = Typography


/** 告警来源（对应领域事件中的 scene）文案 */
const ALERT_SOURCE_LABEL: Record<number, string> = {
  1: '环境监测',
  2: '设备状态',
  3: '病虫害',
  4: '农事任务',
  5: '投入品',
}

/** 告警场景下拉选项 */
const ALERT_SOURCE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '环境监测' },
  { value: 2, label: '设备状态' },
  { value: 3, label: '病虫害' },
  { value: 4, label: '农事任务' },
  { value: 5, label: '投入品' },
]

/** 告警级别下拉选项（级别数值对齐 types/alert.ts） */
const ALERT_LEVEL_OPTIONS: { value: number; label: string }[] = [
  { value: 4, label: '紧急' },
  { value: 3, label: '严重' },
  { value: 2, label: '一般' },
  { value: 1, label: '提示' },
]

/** 处理状态下拉选项 */
const ALERT_STATUS_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '未处理' },
  { value: 2, label: '处理中' },
  { value: 3, label: '已处理' },
  { value: 4, label: '已忽略' },
]

/** 列表筛选条件 */
interface AlertFilters {
  /** 告警级别 */
  level?: number
  /** 处理状态 */
  status?: number
  /** 告警场景（来源） */
  source?: number
  /** 关键字：编号 / 标题 / 内容 */
  keyword?: string
  /** 触发时间区间 */
  range?: [Dayjs, Dayjs]
}

/** 处理表单字段 */
interface HandleFormValues {
  /** 处理措施 */
  handleMeasure?: string
  /** 处理结果 */
  handleResult?: string
  /** 处理人 */
  handlerName?: string
}

/**
 * 告警状态文案
 *
 * 状态 4 在业务上区分「已关闭」（填写了处理意见）与「已忽略」（未填写）。
 *
 * @param alert 告警记录
 * @returns Tag 元信息
 */
function resolveStatus(alert: Alert): { label: string; color: string } {
  return alertStatusMeta(alert.status)
}

/**
 * 告警中心
 *
 * 业务职责：告警台账查询、级别 / 状态 / 场景筛选与「确认 → 处理 → 关闭」闭环处置。
 *
 * @returns 页面内容
 */
export default function AlertCenter(): JSX.Element {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const farmId = useFarmStore((state) => state.currentFarm?.farmId)

  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [filters, setFilters] = useState<AlertFilters>({})
  const [draft, setDraft] = useState<AlertFilters>({})
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  /** 处理弹窗 */
  const [handleOpen, setHandleOpen] = useState<boolean>(false)
  const [handleTarget, setHandleTarget] = useState<Alert | null>(null)
  const [handleSubmitting, setHandleSubmitting] = useState<boolean>(false)
  const [handleForm] = Form.useForm<HandleFormValues>()

  /** 详情弹窗 */
  const [searchParams] = useSearchParams()
  const [detailId, setDetailId] = useState<string | null>(null)
  useEffect(() => { setDetailId(searchParams.get('alertId')) }, [searchParams])
  useEffect(() => { setSelectedKeys([]); setHandleOpen(false) }, [farmId])
  const detailQuery = useQuery({
    queryKey: ['production-alert-detail', farmId, detailId],
    queryFn: () => getAlert(detailId!), enabled: Boolean(detailId), staleTime: 0,
  })
  const detailTarget = detailQuery.isError ? null : detailQuery.data ?? null

  /** 告警列表 */
  const listQuery = useQuery({
    queryKey: ['production-alerts', farmId, filters, pageNum, pageSize],
    queryFn: () =>
      listAlerts({
        pageNum,
        pageSize,
        farmId,
        alertLevel: filters.level,
        status: filters.status,
        alertSource: filters.source,
        keyword: filters.keyword,
        startDate: filters.range?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.range?.[1]?.format('YYYY-MM-DD'),
      }),
  })

  /** 告警统计 */
  const statsQuery = useQuery({
    queryKey: ['production-alerts-stats', farmId],
    queryFn: () => getAlertStats(farmId),
  })

  const rows = listQuery.isError ? [] : listQuery.data?.list ?? []
  const total = listQuery.isError ? 0 : listQuery.data?.total ?? 0
  const levelCounts = Object.fromEntries((statsQuery.data?.levelCounts ?? []).map(x => [x.level, x.count]))
  const stats = statsQuery.data
  const statCards = [
    { key: 'unhandled', title: '未处理', value: stats?.unhandled, color: '#ff4d4f' },
    { key: 'handling', title: '处理中', value: stats?.handling, color: '#fa8c16' },
    { key: 'resolved', title: '已处理归档', value: stats?.resolved, color: '#52c41a' },
    { key: 'ignored', title: '已忽略', value: stats?.ignored, color: '#8c8c8c' },
  ]
  const applyPatch = (alert: Alert): Alert => alert

  /**
   * 执行处置动作
   *
   * 此前 `catch {}` 空吞后，受理 / 处理 / 关闭三个调用点一律 `message.success`——
   * 后端没写进去也报「已受理 / 已处理 / 已关闭」，刷新就打回原形。现在把
   * 「是否真的写到服务端」作为结果的一部分返回，由调用方按结果分别提示。
   *
   * 注意 `handleAlert` 的返回值含义：后端 `AlertInfoService.handle` 返回
   * `updateById(alert) > 0`，即**真的改到了行**才为 true。返回 false 同样算失败
   * （告警不存在 / 已被他人处置），不能因为「没抛异常」就当成功。
   *
   * @param alert 目标告警
   * @param nextStatus 目标状态
   * @param remark 处理意见
   * @param handlerName 处理人
   * @returns remoteOk 是否真的写进服务端；reason 失败原因（成功时为空串）
   */
  async function doHandle(
    alert: Alert,
    nextStatus: AlertStatus,
    remark: string,
  ): Promise<{ remoteOk: boolean; reason: string }> {
    let remoteOk = false
    let reason = ''
    try {
      const updated = await handleAlert(alert.alertId, { status: nextStatus, handleRemark: remark })
      if (updated) {
        remoteOk = true
        await queryClient.invalidateQueries({ queryKey: ['production-alerts'] })
        await queryClient.invalidateQueries({ queryKey: ['production-alerts-stats'] })
      } else {
        reason = '服务端未更新任何记录（该告警可能不存在或已被他人处置）'
      }
    } catch (error) {
      reason = errorMessageOf(error)
    }
    return { remoteOk, reason }
  }

  /** 打开处理弹窗 */
  const openHandle = (alert: Alert): void => {
    setHandleTarget(alert)
    handleForm.setFieldsValue({
      handleMeasure: alert.handleRemark ?? '',
      handleResult: '',
      handlerName: alert.handlerName ?? '',
    })
    setHandleOpen(true)
  }

  /** 确认受理：1 → 2 */
  const handleConfirm = async (): Promise<void> => {
    if (!handleTarget) return
    const values = handleForm.getFieldsValue()
    setHandleSubmitting(true)
    const { remoteOk, reason } = await doHandle(
      handleTarget,
      2,
      values.handleMeasure || '已确认受理，待现场处置。',
    )
    setHandleSubmitting(false)
    if (remoteOk) {
      message.success('告警已确认受理，进入处理中')
    } else {
      message.warning(`受理未同步到服务端（${reason}），未改变告警状态，请重试`)
    }
    if (remoteOk) setHandleOpen(false)
  }

  /** 提交处理：2 → 3 */
  const handleProcess = async (): Promise<void> => {
    if (!handleTarget) return
    let values: HandleFormValues
    try {
      values = await handleForm.validateFields()
    } catch {
      message.warning('请填写处理措施后再提交')
      return
    }
    const remark = `处理措施：${values.handleMeasure ?? ''}；处理结果：${values.handleResult ?? ''}`
    setHandleSubmitting(true)
    const { remoteOk, reason } = await doHandle(
      handleTarget,
      3,
      remark,
    )
    setHandleSubmitting(false)
    if (remoteOk) {
      message.success('处理结果已提交，告警标记为已处理')
    } else {
      message.warning(`处理未同步到服务端（${reason}），未改变告警状态，请重试`)
    }
    if (remoteOk) setHandleOpen(false)
  }

  /**
   * 忽略告警（批量）。
   *
   * 此前 `catch {}` 空吞后无条件报「已忽略所选告警」，服务端一条都没改也报成功。
   * 后端 `AlertInfoService.ignoreBatch` 的返回值同样是「真的改到行」才为 true
   * （id 列表为空返回 false，id 不存在抛 404），因此 false 也按失败处理。
   */
  const ignoreMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!await ignoreAlerts(ids)) throw new Error('服务端未更新记录，请刷新后重试')
      return ids.length
    },
    onSuccess: (count) => {
      message.success(`已忽略 ${count} 条告警`)
      setSelectedKeys([])
      void queryClient.invalidateQueries({ queryKey: ['production-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['production-alerts-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['production-alert-detail'] })
    },
    onError: (error) => message.error(errorMessageOf(error)),
  })
  const openFreshHandle = async (alert: Alert): Promise<void> => {
    try { openHandle(await getAlert(alert.alertId)) }
    catch (error) { message.error(errorMessageOf(error)) }
  }

  /** 触发搜索 */
  const handleSearch = (): void => {
    setPageNum(1)
    setFilters(draft)
    setSelectedKeys([])
  }

  /** 重置筛选 */
  const handleReset = (): void => {
    const empty: AlertFilters = {}
    setDraft(empty)
    setFilters(empty)
    setPageNum(1)
    setSelectedKeys([])
  }

  /** 表格列定义 */
  const columns: ColumnsType<Alert> = [
    {
      title: '告警编号',
      dataIndex: 'alertNo',
      width: 180,
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Text copyable={{ text: value }} style={{ fontSize: 12 }}>
            {value}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.plotName ? `地块：${record.plotName}` : '农场级'}
          </Text>
        </Space>
      ),
    },
    {
      title: '告警标题',
      dataIndex: 'alertTitle',
      render: (value: string, record) => (
        <Space direction="vertical" size={2} style={{ maxWidth: 320 }}>
          <Text strong>{value}</Text>
          <Tooltip title={record.alertContent}>
            <Paragraph
              type="secondary"
              ellipsis={{ rows: 1 }}
              style={{ marginBottom: 0, fontSize: 12, maxWidth: 320 }}
            >
              {record.alertContent}
            </Paragraph>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '级别',
      dataIndex: 'alertLevel',
      width: 90,
      render: (level: number) => {
        const meta = alertLevelMeta(level)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '告警场景',
      dataIndex: 'alertSource',
      width: 110,
      render: (source: number) => <Tag>{ALERT_SOURCE_LABEL[source] ?? '其他'}</Tag>,
    },
    {
      title: '触发值',
      dataIndex: 'triggerValue',
      width: 130,
      render: (value?: string) => value || '-',
    },
    {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      width: 160,
      render: (value: string) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (_value: number, record) => {
        const meta = resolveStatus(record)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '处理人',
      dataIndex: 'handlerName',
      width: 100,
      render: (value?: string) => value || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      fixed: 'right',
      render: (_value: unknown, record) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => setDetailId(record.alertId)}>
            详情
          </Button>
          {record.status !== 3 && record.status !== 4 && (
            <Button type="link" size="small" onClick={() => void openFreshHandle(record)}>
              处理
            </Button>
          )}

        </Space>
      ),
    },
  ]

  /** 当前处理目标（合并本地补丁） */
  const currentTarget: Alert | null = handleTarget ? applyPatch(handleTarget) : null
  const currentStep: number = currentTarget?.status === 1 ? 0 : currentTarget?.status === 2 ? 1 : 2

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card className="production-custom-page-header">
          <Row align="middle" gutter={16}>
            <Col flex="auto">
              <Space size={8}>
                <BellOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
                <span className="production-page-heading">告警中心</span>
                <Text type="secondary">
                  事件 prod.alert.triggered · 场景 / 级别 / 内容由规则引擎与 IoT 监听触发
                </Text>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    void queryClient.invalidateQueries({ queryKey: ['production-alerts'] })
                    void queryClient.invalidateQueries({ queryKey: ['production-alerts-stats'] })
                  }}
                >
                  刷新
                </Button>
                <Popconfirm
                  title={`确认忽略所选 ${selectedKeys.length} 条告警？`}
                  disabled={selectedKeys.length === 0}
                  onConfirm={() => ignoreMutation.mutate(selectedKeys)}
                >
                  <Button danger disabled={selectedKeys.length === 0}>
                    批量忽略
                  </Button>
                </Popconfirm>
              </Space>
            </Col>
          </Row>
        </Card>

        {statsQuery.isError && <Feedback type="error" showIcon message="告警统计加载失败" action={<Button onClick={() => void statsQuery.refetch()}>重试</Button>} />}
        <Row gutter={16}>
          {statCards.map((card) => (
            <Col span={6} key={card.key}>
              <Card>
                <Statistic
                  title={card.title}
                  value={statsQuery.isError ? '—' : card.value ?? '—'}
                  suffix="条"
                  valueStyle={{ color: card.color }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        <Card>
          <Space wrap size={12} style={{ marginBottom: 16 }}>
            <span>级别</span>
            <Segmented
              value={draft.level ?? 0}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  level: Number(value) === 0 ? undefined : Number(value),
                }))
              }
              options={[
                { label: '全部', value: 0 },
                ...ALERT_LEVEL_OPTIONS.map((item) => ({
                  label: `${item.label}(${levelCounts[item.value] ?? 0})`,
                  value: item.value,
                })),
              ]}
            />
            <Select
              allowClear
              placeholder="处理状态"
              style={{ width: 170 }}
              value={draft.status}
              options={ALERT_STATUS_OPTIONS}
              onChange={(value) => setDraft((prev) => ({ ...prev, status: value }))}
            />
            <Select
              allowClear
              placeholder="告警场景"
              style={{ width: 150 }}
              value={draft.source}
              options={ALERT_SOURCE_OPTIONS}
              onChange={(value) => setDraft((prev) => ({ ...prev, source: value }))}
            />
            <RangePicker
              value={draft.range}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  range: value?.[0] && value?.[1] ? [value[0], value[1]] : undefined,
                }))
              }
            />
            <Input.Search
              allowClear
              placeholder="编号 / 标题 / 内容"
              style={{ width: 220 }}
              value={draft.keyword}
              onChange={(event) => setDraft((prev) => ({ ...prev, keyword: event.target.value }))}
              onSearch={handleSearch}
            />
            <Button type="primary" onClick={handleSearch}>
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>

          {listQuery.isError && (
            <Empty
              description="告警加载失败，未展示任何示例数据。请点击刷新重试。"
              style={{ margin: '12px 0' }}
            />
          )}

          <Spin spinning={listQuery.isLoading}>
            <Table<Alert>
              rowKey="alertId"
              columns={columns}
              dataSource={rows}
              scroll={{ x: 1240 }}
              rowSelection={{
                selectedRowKeys: selectedKeys,
                onChange: (keys) => setSelectedKeys(keys as string[]),
                getCheckboxProps: (record) => ({ disabled: record.status !== 1 }),
              }}
              pagination={{
                current: pageNum,
                pageSize,
                total,
                showSizeChanger: true,
                showTotal: (value) => `共 ${formatNumber(value)} 条`,
                onChange: (page, size) => {
                  setPageNum(page)
                  setPageSize(size)
                },
              }}
            />
          </Spin>
        </Card>
      </Space>

      {/* 处理闭环弹窗 */}
      <Modal
        title={`告警处置 · ${currentTarget?.alertNo ?? ''}`}
        open={handleOpen}
        onCancel={() => setHandleOpen(false)}
        width={720}
        footer={[
          <Button key="cancel" onClick={() => setHandleOpen(false)}>
            取消
          </Button>,
          <Button
            key="confirm"
            icon={<CheckCircleOutlined />}
            disabled={currentTarget?.status !== 1}
            loading={handleSubmitting}
            onClick={() => void handleConfirm()}
          >
            确认受理
          </Button>,
          <Button
            key="process"
            type="primary"
            icon={<ToolOutlined />}
            disabled={currentTarget?.status !== 2}
            loading={handleSubmitting}
            onClick={() => void handleProcess()}
          >
            提交处理
          </Button>,

        ]}
      >
        {currentTarget && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Steps
              size="small"
              current={currentStep}
              items={[{ title: '确认受理' }, { title: '处理处置' }, { title: '已处理归档' }]}
            />
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="告警标题" span={2}>
                {currentTarget.alertTitle}
              </Descriptions.Item>
              <Descriptions.Item label="告警级别">
                <Tag color={alertLevelMeta(currentTarget.alertLevel).color}>
                  {alertLevelMeta(currentTarget.alertLevel).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="告警场景">
                {ALERT_SOURCE_LABEL[currentTarget.alertSource] ?? '其他'}
              </Descriptions.Item>
              <Descriptions.Item label="触发值">
                {currentTarget.triggerValue || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="触发时间">{currentTarget.triggeredAt}</Descriptions.Item>
              <Descriptions.Item label="关联地块">
                {currentTarget.plotName || '农场级'}
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={resolveStatus(currentTarget).color}>
                  {resolveStatus(currentTarget).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="告警内容" span={2}>
                {currentTarget.alertContent}
              </Descriptions.Item>
            </Descriptions>
            <Form form={handleForm} layout="vertical">
              <Form.Item
                name="handleMeasure"
                label="处理措施"
                rules={[{ required: true, message: '请填写处理措施' }]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="如：立即通风降湿至 65% 以下，并喷施代森锰锌 800 倍液"
                />
              </Form.Item>
              <Form.Item name="handleResult" label="处理结果">
                <Input.TextArea rows={2} placeholder="如：2 小时后湿度回落至 63%，病斑未继续扩展" />
              </Form.Item>
              <Form.Item name="handlerName" label="处理人">
                <Input placeholder="如：张三" />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="告警详情"
        open={Boolean(detailId)}
        onCancel={() => setDetailId(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDetailId(null)}>
            关闭
          </Button>,
        ]}
        width={680}
      >
        {detailQuery.isLoading && <Spin />}
        {detailQuery.isError && <Feedback type="error" message="详情加载失败" action={<Button onClick={() => void detailQuery.refetch()}>重试</Button>} />}
        {detailTarget && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="告警编号">{detailTarget.alertNo}</Descriptions.Item>
            <Descriptions.Item label="告警级别">
              <Tag color={alertLevelMeta(detailTarget.alertLevel).color}>
                {alertLevelMeta(detailTarget.alertLevel).label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="告警场景">
              {ALERT_SOURCE_LABEL[detailTarget.alertSource] ?? '其他'}
            </Descriptions.Item>
            <Descriptions.Item label="处理状态">
              <Tag color={resolveStatus(detailTarget).color}>
                {resolveStatus(detailTarget).label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="触发值">{detailTarget.triggerValue || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联地块">
              {detailTarget.plotName || '农场级'}
            </Descriptions.Item>
            <Descriptions.Item label="触发时间">{detailTarget.triggeredAt}</Descriptions.Item>
            <Descriptions.Item label="处理时间">{detailTarget.handledAt || '-'}</Descriptions.Item>
            <Descriptions.Item label="处理人">{detailTarget.handlerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联规则">{detailTarget.ruleId || '-'}</Descriptions.Item>
            <Descriptions.Item label="告警内容" span={2}>
              {detailTarget.alertContent}
            </Descriptions.Item>
            <Descriptions.Item label="处理意见" span={2}>
              {detailTarget.handleRemark || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
