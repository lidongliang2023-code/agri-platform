/**
 * 页面名称：合规检查
 * 路由路径：/admin/production/farms/compliance
 * 所属模块：农场监管
 * PRD 序号：PRD 6.2 #11（禁限用农资抽查 / 记录缺失督导 / 整改跟踪）
 *
 * 说明：原型 28 页无本页，业务口径来自 PRD 6.2 #11 与 8.10 ADM-05「农场监管：GIS地图、合规检查」。
 */
import { useMemo, useState } from 'react'
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
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DownloadOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  PlusOutlined,
  SearchOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { listSupervisedFarms } from '@/api/admin/farms'
import {
  createSupervisedComplianceTask,
  updateSupervisedComplianceTask,
} from '@/api/admin/farms'
import type { BizId, ComplianceResult } from '@/types'
import {
  CHECK_RESULT_META,
  CHECK_TYPE_OPTIONS,
  RECTIFY_STATUS_META,
  SAMPLE_SUPERVISED_FARMS,
  addComplianceTask,
  exportCsv,
  formatDate,
  generateCheckId,
  resolveRectifyStatus,
  todayText,
  updateComplianceTask,
  upsertRemoteComplianceCheck,
  useComplianceTaskState,
} from './supervisionShared'
import type { ComplianceTaskItem, RectifyStatusKey } from './supervisionShared'

const { Text, Title } = Typography

/** 筛选条件 */
interface CheckFilters {
  /** 农场 ID */
  farmId: string
  /** 检查类型 */
  checkType: string
  /** 检查结果 */
  result: string
  /** 整改状态 */
  rectifyStatus: string
}

/** 发起抽查表单值 */
interface LaunchFormValues {
  /** 农场 ID */
  farmId: string
  /** 检查类型 */
  checkType: string
  /** 检查项 */
  checkItem: string
  /** 检查人 */
  checkerName: string
  /** 抽查说明 */
  remark?: string
}

/** 录入检查结果表单值 */
interface ResultFormValues {
  /** 检查结果 */
  result: ComplianceResult
  /** 问题描述 */
  problem?: string
  /** 整改要求 */
  rectifyRequirement?: string
  /** 整改期限 */
  rectifyDeadline?: Dayjs
  /** 检查人 */
  checkerName: string
}

/** 整改跟踪表单值 */
interface RectifyFormValues {
  /** 整改状态 */
  rectifyStatus: Extract<RectifyStatusKey, 'pending' | 'processing' | 'rectified'>
  /** 整改结果说明 */
  rectifyRemark?: string
  /** 整改凭证附件地址 */
  rectifyAttachment?: string
}

/**
 * 合规检查
 *
 * 业务职责（PRD 6.2 #11）：
 * 1. 发起抽查：支持「禁限用农资抽查」与「记录缺失督导」两类专项检查，另有常规检查；
 * 2. 录入检查结果：合规 / 限期整改 / 严重违规，非合规须填写问题描述、整改要求与整改期限；
 * 3. 整改跟踪：整改状态流转（待整改 → 整改中 → 已整改），上传整改结果凭证并记录闭环时间；
 * 4. 台账查询与导出：按农场 / 检查类型 / 检查结果 / 整改状态筛选。
 *
 * 数据落库策略：后端 `/admin/farms/compliance` 目前仅提供「合规画像」读取端点，
 * 暂无检查任务写接口，因此统一走「后端优先 + 本地登记降级」（见 createSupervisedComplianceTask），
 * 后端端点上线后无需改动页面逻辑。
 *
 * @returns 页面内容
 */
export default function ComplianceCheck(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()

  /** 已提交的筛选条件 */
  const [filters, setFilters] = useState<CheckFilters>({
    farmId: '',
    checkType: '',
    result: '',
    rectifyStatus: '',
  })
  /** 筛选草稿值 */
  const [draft, setDraft] = useState<CheckFilters>(filters)
  /** 发起抽查弹窗 */
  const [launchOpen, setLaunchOpen] = useState<boolean>(false)
  /** 录入结果弹窗当前任务 */
  const [resultTarget, setResultTarget] = useState<ComplianceTaskItem | null>(null)
  /** 整改跟踪抽屉当前任务 */
  const [trackTarget, setTrackTarget] = useState<ComplianceTaskItem | null>(null)
  /** 查看详情抽屉当前任务 */
  const [detailTarget, setDetailTarget] = useState<ComplianceTaskItem | null>(null)
  /** 提交中标记 */
  const [submitting, setSubmitting] = useState<boolean>(false)

  const [launchForm] = Form.useForm<LaunchFormValues>()
  const [resultForm] = Form.useForm<ResultFormValues>()
  const [trackForm] = Form.useForm<RectifyFormValues>()

  /**
   * 合规检查任务台账
   *
   * 远端优先：以 `GET /admin/farms/compliance/checks` 的服务端数据为准；
   * 后端不可达时降级到本地缓存并置 `degraded`，由页面顶部横幅显式告知。
   */
  const { tasks, degraded, degradeReason } = useComplianceTaskState()

  /** 农场列表（用于下拉选择） */
  const farmsQuery = useQuery({
    queryKey: ['admin', 'farms', 'compliance', 'farm-options'],
    queryFn: () => listSupervisedFarms({ pageNum: 1, pageSize: 200 }),
    retry: false,
  })

  /** 农场下拉选项：后端优先，无数据降级为原型示例农场 */
  const farmOptions = useMemo<Array<{ label: string; value: string }>>(() => {
    const remote = farmsQuery.data?.list ?? []
    if (remote.length > 0) {
      return remote.map((farm) => ({
        label: `${farm.farmName}（${farm.farmCode || farm.farmId}）`,
        value: String(farm.farmId),
      }))
    }
    return SAMPLE_SUPERVISED_FARMS.map((row) => ({
      label: `${row.farmName}（${row.farmCode}）`,
      value: String(row.farmId),
    }))
  }, [farmsQuery.data])

  /** 农场名称映射 */
  const farmNameMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    const remote = farmsQuery.data?.list ?? []
    remote.forEach((farm) => map.set(String(farm.farmId), farm.farmName))
    SAMPLE_SUPERVISED_FARMS.forEach((row) => {
      if (!map.has(String(row.farmId))) {
        map.set(String(row.farmId), row.farmName)
      }
    })
    tasks.forEach((task) => {
      if (!map.has(String(task.farmId))) {
        map.set(String(task.farmId), task.farmName)
      }
    })
    return map
  }, [farmsQuery.data, tasks])

  /** 筛选后的任务列表 */
  const filteredTasks = useMemo<ComplianceTaskItem[]>(
    () =>
      tasks
        .filter((task) => {
          if (filters.farmId && String(task.farmId) !== filters.farmId) {
            return false
          }
          if (filters.checkType && task.checkType !== filters.checkType) {
            return false
          }
          if (filters.result && String(task.result) !== filters.result) {
            return false
          }
          if (filters.rectifyStatus) {
            if (resolveRectifyStatus(task, todayText()) !== filters.rectifyStatus) {
              return false
            }
          }
          return true
        })
        .slice()
        .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt)),
    [tasks, filters],
  )

  /** 统计卡数据 */
  const stats = useMemo<{
    total: number
    pending: number
    overdue: number
    serious: number
    closed: number
  }>(() => {
    const today = todayText()
    let pending = 0
    let overdue = 0
    let serious = 0
    let closed = 0
    tasks.forEach((task) => {
      const status = resolveRectifyStatus(task, today)
      if (task.result === 3) {
        serious += 1
      }
      if (task.result !== 1) {
        if (status === 'rectified') {
          closed += 1
        } else if (status === 'overdue') {
          overdue += 1
        } else {
          pending += 1
        }
      }
    })
    return { total: tasks.length, pending, overdue, serious, closed }
  }, [tasks])

  /**
   * 是否处于降级态：后端合规检查接口不可达，当前列表是本地缓存而非服务端数据。
   * 必须显式告知，不能把本地数据伪装成服务端数据。
   */
  const localOnlyCount: number = tasks.filter((task) => task.source === 'local').length

  /**
   * 统一落库：先尝试写入后端，失败则登记到本地。
   *
   * @param task 检查任务
   * @returns 落库后的任务
   */
  async function persistTask(task: ComplianceTaskItem): Promise<ComplianceTaskItem> {
    const remote = await createSupervisedComplianceTask({
      checkId: task.checkId,
      farmId: task.farmId,
      farmName: task.farmName,
      checkType: task.checkType,
      checkItem: task.checkItem,
      result: task.result,
      problem: task.problem,
      rectifyRequirement: task.rectifyRequirement,
      rectifyDeadline: task.rectifyDeadline,
      checkerName: task.checkerName,
      checkedAt: task.checkedAt,
    })
    if (!remote) {
      const localTask: ComplianceTaskItem = { ...task, source: 'local' }
      addComplianceTask(localTask)
      return localTask
    }
    // 已落库：以服务端返回为准，本地不再保留副本（本地仅作离线兜底）
    upsertRemoteComplianceCheck(remote)
    return task
  }

  /**
   * 统一更新：先尝试更新后端，失败则更新本地。
   *
   * @param checkId 检查编号
   * @param patch 待更新字段
   * @returns 是否落后端
   */
  async function patchTask(
    checkId: string,
    patch: Partial<ComplianceTaskItem>,
  ): Promise<'remote' | 'local'> {
    const remote = await updateSupervisedComplianceTask(checkId, patch as Record<string, unknown>)
    if (!remote) {
      updateComplianceTask(checkId, { ...patch, source: 'local' })
      return 'local'
    }
    // 已落库：以服务端返回为准，本地不再保留副本（本地仅作离线兜底）
    upsertRemoteComplianceCheck(remote)
    return 'remote'
  }

  /** 发起抽查提交 */
  const handleLaunch = async (): Promise<void> => {
    try {
      const values = await launchForm.validateFields()
      setSubmitting(true)
      const farmName = farmNameMap.get(values.farmId) ?? '未知农场'
      const task: ComplianceTaskItem = {
        checkId: generateCheckId(),
        farmId: values.farmId as BizId,
        farmName,
        checkType: values.checkType,
        checkItem: values.checkItem,
        result: 1,
        problem: values.remark,
        checkerName: values.checkerName,
        checkedAt: `${todayText()} ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
        rectifyStatus: 'none',
        source: 'remote',
      }
      const saved = await persistTask(task)
      message.success(
        saved.source === 'remote'
          ? `已发起「${values.checkType}」，检查编号 ${task.checkId}`
          : `已发起「${values.checkType}」（后端写接口暂未开放，已本地登记）`,
      )
      launchForm.resetFields()
      setLaunchOpen(false)
    } catch {
      // 表单校验失败由 antd 自行提示
    } finally {
      setSubmitting(false)
    }
  }

  /** 录入检查结果提交 */
  const handleSubmitResult = async (): Promise<void> => {
    try {
      const values = await resultForm.validateFields()
      if (!resultTarget) {
        return
      }
      setSubmitting(true)
      const patch: Partial<ComplianceTaskItem> = {
        result: values.result,
        problem: values.problem,
        rectifyRequirement: values.result === 1 ? undefined : values.rectifyRequirement,
        rectifyDeadline:
          values.result === 1 ? undefined : values.rectifyDeadline?.format('YYYY-MM-DD'),
        checkerName: values.checkerName,
        rectifyStatus: values.result === 1 ? 'none' : resultTarget.rectifyStatus === 'none' ? 'pending' : resultTarget.rectifyStatus,
      }
      const target = await patchTask(resultTarget.checkId, patch)
      message.success(
        target === 'remote'
          ? '检查结果已保存'
          : '检查结果已保存（后端写接口暂未开放，已本地登记）',
      )
      resultForm.resetFields()
      setResultTarget(null)
    } catch {
      // 表单校验失败由 antd 自行提示
    } finally {
      setSubmitting(false)
    }
  }

  /** 整改跟踪提交 */
  const handleTrack = async (): Promise<void> => {
    try {
      const values = await trackForm.validateFields()
      if (!trackTarget) {
        return
      }
      setSubmitting(true)
      const patch: Partial<ComplianceTaskItem> = {
        rectifyStatus: values.rectifyStatus,
        rectifyRemark: values.rectifyRemark,
        rectifyAttachment: values.rectifyAttachment,
        rectifiedAt:
          values.rectifyStatus === 'rectified'
            ? `${todayText()} ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`
            : undefined,
      }
      const target = await patchTask(trackTarget.checkId, patch)
      message.success(
        target === 'remote' ? '整改信息已更新' : '整改信息已更新（后端写接口暂未开放，已本地登记）',
      )
      trackForm.resetFields()
      setTrackTarget(null)
    } catch {
      // 表单校验失败由 antd 自行提示
    } finally {
      setSubmitting(false)
    }
  }

  /** 导出当前筛选结果 */
  const handleExport = (): void => {
    if (filteredTasks.length === 0) {
      message.warning('当前没有可导出的数据')
      return
    }
    exportCsv<ComplianceTaskItem>('合规检查台账', filteredTasks, [
      { title: '检查编号', render: (row) => row.checkId },
      { title: '农场', render: (row) => row.farmName },
      { title: '检查类型', render: (row) => row.checkType },
      { title: '检查项', render: (row) => row.checkItem },
      { title: '检查人', render: (row) => row.checkerName ?? '—' },
      { title: '检查结果', render: (row) => CHECK_RESULT_META[row.result]?.label ?? '—' },
      { title: '问题描述', render: (row) => row.problem ?? '—' },
      { title: '整改要求', render: (row) => row.rectifyRequirement ?? '—' },
      { title: '整改期限', render: (row) => row.rectifyDeadline ?? '—' },
      {
        title: '整改状态',
        render: (row) => RECTIFY_STATUS_META[resolveRectifyStatus(row, todayText())].label,
      },
      { title: '整改结果', render: (row) => row.rectifyRemark ?? '—' },
      { title: '数据来源', render: (row) => (row.source === 'remote' ? '后端' : '本地登记') },
    ])
    message.success(`已导出 ${filteredTasks.length} 条合规检查记录`)
  }

  /** 表格列定义 */
  const columns: ColumnsType<ComplianceTaskItem> = [
    { title: '检查编号', dataIndex: 'checkId', width: 170 },
    {
      title: '农场',
      width: 150,
      render: (_value: unknown, row) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0 }}
          onClick={() => navigate(`/admin/production/farms/${row.farmId}`)}
        >
          {row.farmName}
        </Button>
      ),
    },
    {
      title: '检查类型',
      dataIndex: 'checkType',
      width: 140,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    { title: '检查项', dataIndex: 'checkItem', width: 200, ellipsis: true },
    { title: '检查人', width: 100, render: (_value: unknown, row) => row.checkerName || '—' },
    {
      title: '检查结果',
      dataIndex: 'result',
      width: 110,
      align: 'center',
      render: (value: ComplianceResult) => (
        <Tag color={CHECK_RESULT_META[value]?.color ?? 'default'}>
          {value === 1 ? '✅ ' : value === 2 ? '⚠ ' : '❌ '}
          {CHECK_RESULT_META[value]?.label ?? '—'}
        </Tag>
      ),
    },
    {
      title: '整改状态',
      width: 110,
      align: 'center',
      render: (_value: unknown, row) => {
        const status = resolveRectifyStatus(row, todayText())
        return <Tag color={RECTIFY_STATUS_META[status].color}>{RECTIFY_STATUS_META[status].label}</Tag>
      },
    },
    {
      title: '整改期限',
      dataIndex: 'rectifyDeadline',
      width: 120,
      render: (value?: string) => value || '—',
    },
    {
      title: '检查时间',
      dataIndex: 'checkedAt',
      width: 160,
      render: (value: string) => value?.slice(0, 16) ?? '—',
    },
    {
      title: '操作',
      key: 'action',
      width: 210,
      fixed: 'right',
      render: (_value: unknown, row) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => setDetailTarget(row)}>
            查看
          </Button>
          <Button type="link" size="small" onClick={() => setResultTarget(row)}>
            录入结果
          </Button>
          <Tooltip title={row.result === 1 ? '合规任务无需整改' : '填写整改状态与整改结果'}>
            <Button
              type="link"
              size="small"
              disabled={row.result === 1}
              onClick={() => setTrackTarget(row)}
            >
              整改跟踪
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 标题栏 + 操作 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            合规检查
          </Title>
          <Text type="secondary">首页 &gt; 生产管理 &gt; 农场监管 &gt; 合规检查</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setLaunchOpen(true)}>
              发起抽查
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 统计卡 */}
      <Row gutter={[12, 12]}>
        <Col xs={12} md={8} lg={5}>
          <Card size="small" styles={{ body: { padding: 14 } }}>
            <Statistic title="检查任务总数" value={stats.total} suffix="条" />
          </Card>
        </Col>
        <Col xs={12} md={8} lg={5}>
          <Card size="small" styles={{ body: { padding: 14 } }}>
            <Statistic title="待整改" value={stats.pending} suffix="条" valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={12} md={8} lg={5}>
          <Card size="small" styles={{ body: { padding: 14 } }}>
            <Statistic title="已逾期" value={stats.overdue} suffix="条" valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} md={8} lg={4}>
          <Card size="small" styles={{ body: { padding: 14 } }}>
            <Statistic title="严重违规" value={stats.serious} suffix="条" valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={12} md={8} lg={5}>
          <Card size="small" styles={{ body: { padding: 14 } }}>
            <Statistic title="已闭环" value={stats.closed} suffix="条" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      {/* 筛选器 */}
      <Card size="small" style={{ marginTop: 12 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={6}>
            <div>
              <Text type="secondary">农场：</Text>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                placeholder="全部"
                value={draft.farmId || undefined}
                onChange={(value?: string) => setDraft({ ...draft, farmId: value ?? '' })}
                options={farmOptions}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <div>
              <Text type="secondary">检查类型：</Text>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="全部"
                value={draft.checkType || undefined}
                onChange={(value?: string) => setDraft({ ...draft, checkType: value ?? '' })}
                options={CHECK_TYPE_OPTIONS.map((item) => ({ label: item, value: item }))}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <div>
              <Text type="secondary">检查结果：</Text>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="全部"
                value={draft.result || undefined}
                onChange={(value?: string) => setDraft({ ...draft, result: value ?? '' })}
                options={([1, 2, 3] as ComplianceResult[]).map((value) => ({
                  label: CHECK_RESULT_META[value].label,
                  value: String(value),
                }))}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <div>
              <Text type="secondary">整改状态：</Text>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="全部"
                value={draft.rectifyStatus || undefined}
                onChange={(value?: string) => setDraft({ ...draft, rectifyStatus: value ?? '' })}
                options={(['pending', 'processing', 'rectified', 'overdue', 'none'] as RectifyStatusKey[]).map(
                  (key) => ({ label: RECTIFY_STATUS_META[key].label, value: key }),
                )}
              />
            </div>
          </Col>
          <Col xs={24} sm={24} md={3}>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => setFilters({ ...draft })}
              >
                查询
              </Button>
              <Button
                onClick={() => {
                  const empty: CheckFilters = {
                    farmId: '',
                    checkType: '',
                    result: '',
                    rectifyStatus: '',
                  }
                  setDraft(empty)
                  setFilters(empty)
                }}
              >
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {degraded && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message="后端合规检查接口当前不可达，以下展示的是本地缓存数据（不是服务端数据）"
          description={
            `读取 GET /admin/farms/compliance/checks 失败${degradeReason ? `：${degradeReason}` : ''}。` +
            `当前 ${localOnlyCount} 条任务仅存在于本浏览器；此时的新建与修改也只会写入本地，` +
            '不会同步到服务端、其他账号也看不到。接口恢复后刷新页面即自动切回服务端数据。'
          }
        />
      )}

      {/* 台账表格 */}
      <Card size="small" style={{ marginTop: 12 }}>
        <Table<ComplianceTaskItem>
          rowKey="checkId"
          size="small"
          columns={columns}
          dataSource={filteredTasks}
          scroll={{ x: 1500 }}
          locale={{ emptyText: '暂无合规检查记录，点击右上角「发起抽查」登记' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* 发起抽查弹窗 */}
      <Modal
        open={launchOpen}
        title={
          <Space>
            <FileSearchOutlined />
            发起抽查
          </Space>
        }
        okText="确认发起"
        cancelText="取消"
        confirmLoading={submitting}
        destroyOnClose
        onCancel={() => {
          launchForm.resetFields()
          setLaunchOpen(false)
        }}
        onOk={() => {
          void handleLaunch()
        }}
      >
        <Form<LaunchFormValues>
          form={launchForm}
          layout="vertical"
          initialValues={{ checkType: '禁限用农资抽查' }}
        >
          <Form.Item label="抽查农场" name="farmId" rules={[{ required: true, message: '请选择抽查农场' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="请选择农场"
              options={farmOptions}
            />
          </Form.Item>
          <Form.Item
            label="检查类型"
            name="checkType"
            rules={[{ required: true, message: '请选择检查类型' }]}
          >
            <Select
              options={CHECK_TYPE_OPTIONS.map((item) => ({ label: item, value: item }))}
            />
          </Form.Item>
          <Form.Item
            label="检查项"
            name="checkItem"
            rules={[
              { required: true, message: '请填写检查项' },
              { min: 2, message: '检查项不少于 2 个字' },
            ]}
          >
            <Input placeholder="如：国家禁用农药清单核对、近30天生产记录完整性" maxLength={50} />
          </Form.Item>
          <Form.Item label="检查人" name="checkerName" rules={[{ required: true, message: '请填写检查人' }]}>
            <Input placeholder="请输入检查人姓名" maxLength={20} />
          </Form.Item>
          <Form.Item label="抽查说明" name="remark">
            <Input.TextArea rows={3} maxLength={200} showCount placeholder="可填写抽样批次、覆盖范围等说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 录入检查结果弹窗 */}
      <Modal
        open={resultTarget !== null}
        title={
          <Space>
            <ExclamationCircleOutlined />
            录入检查结果
          </Space>
        }
        okText="保存结果"
        cancelText="取消"
        confirmLoading={submitting}
        destroyOnClose
        onCancel={() => {
          resultForm.resetFields()
          setResultTarget(null)
        }}
        onOk={() => {
          void handleSubmitResult()
        }}
      >
        {resultTarget && (
          <div>
            <Row gutter={[0, 4]} style={{ marginBottom: 12 }}>
              <Col span={24}>
                检查编号：{resultTarget.checkId} · 农场：{resultTarget.farmName}
              </Col>
              <Col span={24}>检查类型：{resultTarget.checkType}</Col>
            </Row>
            <Form<ResultFormValues>
              form={resultForm}
              layout="vertical"
              initialValues={{
                result: resultTarget.result,
                checkerName: resultTarget.checkerName,
                problem: resultTarget.problem,
                rectifyRequirement: resultTarget.rectifyRequirement,
                rectifyDeadline: resultTarget.rectifyDeadline
                  ? dayjs(resultTarget.rectifyDeadline)
                  : undefined,
              }}
            >
              <Form.Item label="检查结果" name="result" rules={[{ required: true, message: '请选择检查结果' }]}>
                <Radio.Group
                  options={([1, 2, 3] as ComplianceResult[]).map((value) => ({
                    label: CHECK_RESULT_META[value].label,
                    value,
                  }))}
                />
              </Form.Item>
              <Form.Item label="检查人" name="checkerName" rules={[{ required: true, message: '请填写检查人' }]}>
                <Input placeholder="请输入检查人姓名" maxLength={20} />
              </Form.Item>
              <Form.Item
                label="问题描述"
                name="problem"
                rules={[
                  ({ getFieldValue }) => ({
                    validator: (_rule, value: string | undefined) =>
                      Number(getFieldValue('result')) !== 1 && !value?.trim()
                        ? Promise.reject(new Error('非合规结果须填写问题描述'))
                        : Promise.resolve(),
                  }),
                ]}
              >
                <Input.TextArea rows={3} maxLength={200} showCount placeholder="请描述发现的问题" />
              </Form.Item>
              <Form.Item
                label="整改要求"
                name="rectifyRequirement"
                rules={[
                  ({ getFieldValue }) => ({
                    validator: (_rule, value: string | undefined) =>
                      Number(getFieldValue('result')) !== 1 && !value?.trim()
                        ? Promise.reject(new Error('非合规结果须填写整改要求'))
                        : Promise.resolve(),
                  }),
                ]}
              >
                <Input.TextArea rows={3} maxLength={200} showCount placeholder="请填写整改要求" />
              </Form.Item>
              <Form.Item
                label="整改期限"
                name="rectifyDeadline"
                rules={[
                  ({ getFieldValue }) => ({
                    validator: (_rule, value?: Dayjs) =>
                      Number(getFieldValue('result')) !== 1 && !value
                        ? Promise.reject(new Error('非合规结果须选择整改期限'))
                        : Promise.resolve(),
                  }),
                ]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 整改跟踪抽屉 */}
      <Drawer
        open={trackTarget !== null}
        title={
          <Space>
            <ToolOutlined />
            整改跟踪
          </Space>
        }
        width={520}
        destroyOnClose
        onClose={() => {
          trackForm.resetFields()
          setTrackTarget(null)
        }}
      >
        {trackTarget && (
          <div>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="检查编号">{trackTarget.checkId}</Descriptions.Item>
              <Descriptions.Item label="农场">{trackTarget.farmName}</Descriptions.Item>
              <Descriptions.Item label="检查类型">{trackTarget.checkType}</Descriptions.Item>
              <Descriptions.Item label="检查项">{trackTarget.checkItem}</Descriptions.Item>
              <Descriptions.Item label="检查结果">
                <Tag color={CHECK_RESULT_META[trackTarget.result]?.color ?? 'default'}>
                  {CHECK_RESULT_META[trackTarget.result]?.label ?? '—'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="问题描述">{trackTarget.problem || '—'}</Descriptions.Item>
              <Descriptions.Item label="整改要求">{trackTarget.rectifyRequirement || '—'}</Descriptions.Item>
              <Descriptions.Item label="整改期限">
                {trackTarget.rectifyDeadline || '—'}
                {resolveRectifyStatus(trackTarget, todayText()) === 'overdue' && (
                  <Tag color="red" style={{ marginLeft: 8 }}>
                    已逾期
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="检查时间">{formatDate(trackTarget.checkedAt)}</Descriptions.Item>
              <Descriptions.Item label="检查人">{trackTarget.checkerName || '—'}</Descriptions.Item>
            </Descriptions>

            <Form<RectifyFormValues>
              form={trackForm}
              layout="vertical"
              initialValues={{
                rectifyStatus:
                  trackTarget.rectifyStatus === 'none' || trackTarget.rectifyStatus === 'overdue'
                    ? 'pending'
                    : trackTarget.rectifyStatus,
                rectifyRemark: trackTarget.rectifyRemark,
                rectifyAttachment: trackTarget.rectifyAttachment,
              }}
            >
              <Form.Item
                label="整改状态"
                name="rectifyStatus"
                rules={[{ required: true, message: '请选择整改状态' }]}
              >
                <Select
                  options={(['pending', 'processing', 'rectified'] as RectifyStatusKey[]).map((key) => ({
                    label: RECTIFY_STATUS_META[key].label,
                    value: key,
                  }))}
                />
              </Form.Item>
              <Form.Item
                label="整改结果说明"
                name="rectifyRemark"
                rules={[
                  ({ getFieldValue }) => ({
                    validator: (_rule, value: string | undefined) =>
                      getFieldValue('rectifyStatus') === 'rectified' && !value?.trim()
                        ? Promise.reject(new Error('标记为已整改时须填写整改结果说明'))
                        : Promise.resolve(),
                  }),
                ]}
              >
                <Input.TextArea
                  rows={3}
                  maxLength={200}
                  showCount
                  placeholder="请描述已完成的整改措施"
                />
              </Form.Item>
              <Form.Item
                label="整改结果凭证"
                name="rectifyAttachment"
                extra="填写整改照片 / 第三方处置单的文件地址（附件上传服务上线后替换为上传控件）"
              >
                <Input placeholder="https://oss.example.com/rectify/xxx.pdf" maxLength={200} />
              </Form.Item>
            </Form>

            <Space>
              <Button type="primary" loading={submitting} onClick={() => void handleTrack()}>
                保存整改信息
              </Button>
              <Button
                onClick={() => {
                  trackForm.resetFields()
                  setTrackTarget(null)
                }}
              >
                取消
              </Button>
            </Space>
          </div>
        )}
      </Drawer>

      {/* 查看详情抽屉 */}
      <Drawer
        open={detailTarget !== null}
        title="检查任务详情"
        width={520}
        destroyOnClose
        onClose={() => setDetailTarget(null)}
      >
        {detailTarget ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="检查编号">{detailTarget.checkId}</Descriptions.Item>
            <Descriptions.Item label="农场">{detailTarget.farmName}</Descriptions.Item>
            <Descriptions.Item label="检查类型">{detailTarget.checkType}</Descriptions.Item>
            <Descriptions.Item label="检查项">{detailTarget.checkItem}</Descriptions.Item>
            <Descriptions.Item label="检查人">{detailTarget.checkerName || '—'}</Descriptions.Item>
            <Descriptions.Item label="检查时间">{detailTarget.checkedAt}</Descriptions.Item>
            <Descriptions.Item label="检查结果">
              <Tag color={CHECK_RESULT_META[detailTarget.result]?.color ?? 'default'}>
                {CHECK_RESULT_META[detailTarget.result]?.label ?? '—'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="问题描述">{detailTarget.problem || '—'}</Descriptions.Item>
            <Descriptions.Item label="整改要求">{detailTarget.rectifyRequirement || '—'}</Descriptions.Item>
            <Descriptions.Item label="整改期限">{detailTarget.rectifyDeadline || '—'}</Descriptions.Item>
            <Descriptions.Item label="整改状态">
              <Tag color={RECTIFY_STATUS_META[resolveRectifyStatus(detailTarget, todayText())].color}>
                {RECTIFY_STATUS_META[resolveRectifyStatus(detailTarget, todayText())].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="整改结果">{detailTarget.rectifyRemark || '—'}</Descriptions.Item>
            <Descriptions.Item label="整改凭证">
              {detailTarget.rectifyAttachment || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="闭环时间">{detailTarget.rectifiedAt || '—'}</Descriptions.Item>
            <Descriptions.Item label="数据来源">
              {detailTarget.source === 'remote' ? <Tag color="green">后端</Tag> : <Tag color="orange">本地登记</Tag>}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="没有可查看的记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Drawer>
    </div>
  )
}
