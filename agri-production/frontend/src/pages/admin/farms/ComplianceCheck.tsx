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
import type { ComplianceWriteResult } from '@/api/admin/farms'
import type { BizId, ComplianceResult } from '@/types'
import {
  CHECK_RESULT_META,
  CHECK_TYPE_OPTIONS,
  RECTIFY_STATUS_META,
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

/**
 * 农场建档页面路由。
 *
 * 运营端目前没有建档入口，建档在生产端「新增农场」页（src/pages/user/farms/Create.tsx），
 * 其提交接口即 `POST /api/v1/production/farms`。合规检查必须绑定到真实存在的农场档案，
 * 因此空档案时必须给出可达的建档路径，而不是只写一句"请先建档"。
 */
const FARM_CREATE_PATH = '/production/farms/create'

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
 * 数据落库策略：写接口 `POST /admin/farms/compliance` 与 `PUT /admin/farms/compliance/{checkId}`
 * 均已上线（表 prod_farm_compliance_check，见 V9__produce_farm_compliance_check.sql），
 * 读取走 `GET /admin/farms/compliance/checks`。
 *
 * ⚠️ 写失败**不允许**一律降级后弹成功提示（那等于骗人）。分支口径：
 * - 成功 → success；
 * - 后端明确拒绝（业务码非 0，典型是 404 农场档案不存在）→ 错误提示，且**不写本地**
 *   （写本地等于把一条注定关联不上的任务留在用户机器上）；
 * - 后端不可达（无响应 / 5xx）→ 离线兜底，但弹 warning 而非 success，
 *   并说明"仅本浏览器可见、其他账号看不到、接口恢复后不会自动同步"。
 *
 * @returns 页面内容
 */
export default function ComplianceCheck(): JSX.Element {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()

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

  /**
   * 农场下拉选项：只取后端 GET /admin/farms 的真实农场档案。
   * 原实现在后端无数据时用示例农场顶上，会让运营把检查登记到一个不存在的农场上。
   */
  const farmOptions = useMemo<Array<{ label: string; value: string }>>(() => {
    const remote = farmsQuery.data?.list ?? []
    return remote.map((farm) => ({
      label: `${farm.farmName}（${farm.farmCode || farm.farmId}）`,
      value: String(farm.farmId),
    }))
  }, [farmsQuery.data])

  /** 农场名称映射（真实档案优先，任务自带的农场名兜底） */
  const farmNameMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    const remote = farmsQuery.data?.list ?? []
    remote.forEach((farm) => map.set(String(farm.farmId), farm.farmName))
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
   * 把后端「明确拒绝」翻译成人能看懂的原因。
   *
   * 404 在本接口有确定含义：后端 create() 只在 farmId 查不到对应农场档案时抛 NOT_FOUND
   * （见 AdminFarmComplianceService），所以必须说清"是农场档案不存在，请先建档"，
   * 不能含糊成"接口未开放"或"请求失败"。
   *
   * @param result 后端拒绝结果
   * @returns 面向运营的说明文案
   */
  function describeRejection(result: ComplianceWriteResult): string {
    if (result.code === 404) {
      return (
        '该农场编号在档案库中不存在（后端返回 404，请求已被拒绝）。' +
        '合规检查必须绑定到真实存在的农场档案：请先完成建档，再发起检查。' +
        '本次没有写入任何数据（也没有存到本地）——避免留下一条永远关联不上农场的任务。'
      )
    }
    if (result.code === 400) {
      return `提交参数被后端拒绝（400）${result.message ? `：${result.message}` : ''}。本次未写入任何数据。`
    }
    return (
      `后端拒绝了本次提交（业务码 ${result.code ?? '未知'}）` +
      `${result.message ? `：${result.message}` : ''}。本次未写入任何数据。`
    )
  }

  /**
   * 落库结果（三分支：成功 / 离线兜底 / 被拒绝）。
   *
   * `source` 为 'local' 时表示"确实存下来了，但只在本浏览器"；
   * 'failed' 表示"什么都没存下来"，二者必须给用户不同的反馈等级。
   */
  interface PersistOutcome {
    /** 数据最终去向 */
    source: 'remote' | 'local' | 'failed'
    /** 需要告知用户的原因（local / failed 时必有值） */
    reason?: string
  }

  /**
   * 统一落库：写后端，按失败性质决定是拒绝、还是离线兜底。
   *
   * @param task 检查任务
   * @returns 落库结果
   */
  async function persistTask(task: ComplianceTaskItem): Promise<PersistOutcome> {
    const result = await createSupervisedComplianceTask({
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
    if (result.ok && result.remote) {
      // 已落库：以服务端返回为准，本地不再保留副本（本地仅作离线兜底）
      upsertRemoteComplianceCheck(result.remote)
      return { source: 'remote' }
    }
    if (result.kind === 'unreachable') {
      const localTask: ComplianceTaskItem = { ...task, source: 'local' }
      addComplianceTask(localTask)
      return {
        source: 'local',
        reason:
          `${result.message}。已临时登记到本地：仅本浏览器可见，其他账号看不到，` +
          '接口恢复后不会自动同步到服务端。',
      }
    }
    // 后端明确拒绝：不写本地
    return { source: 'failed', reason: describeRejection(result) }
  }

  /**
   * 统一更新：先更新后端，按失败性质决定是拒绝、还是离线兜底。
   *
   * 与创建的两点差异（都有实际依据）：
   * 1. PUT 的 404 是"检查编号不存在"，不一定是农场问题；
   * 2. 若这条任务本身就是本地任务（离线时建的），服务端查不到是**预期行为**，
   *    此时更新本地是正确降级，不算骗人——但要弹 warning 说明。
   *
   * @param checkId 检查编号
   * @param patch 待更新字段
   * @param isLocalTask 该任务是否本来就只存在于本地
   * @returns 更新结果
   */
  async function patchTask(
    checkId: string,
    patch: Partial<ComplianceTaskItem>,
    isLocalTask: boolean,
  ): Promise<PersistOutcome> {
    const result = await updateSupervisedComplianceTask(checkId, patch as Record<string, unknown>)
    if (result.ok && result.remote) {
      upsertRemoteComplianceCheck(result.remote)
      return { source: 'remote' }
    }
    if (result.kind === 'unreachable') {
      updateComplianceTask(checkId, { ...patch, source: 'local' })
      return {
        source: 'local',
        reason:
          `${result.message}。已临时更新到本地：仅本浏览器可见，其他账号看不到，` +
          '接口恢复后不会自动同步到服务端。',
      }
    }
    if (isLocalTask && result.code === 404) {
      // 本地任务在服务端本就没有记录，404 是预期的：更新本地即可
      updateComplianceTask(checkId, { ...patch, source: 'local' })
      return {
        source: 'local',
        reason:
          '这条任务本来就只存在于本地（服务端暂无此检查编号），已更新本地副本。' +
          '它不会出现在服务端台账里，其他账号看不到。',
      }
    }
    return { source: 'failed', reason: describeRejection(result) }
  }

  /**
   * 按落库结果弹出对应等级的提示。
   *
   * success 只用于真正落库；离线兜底用 warning；被拒绝用错误弹窗（文案较长）。
   *
   * @param title 操作名，如「发起抽查」
   * @param successText 成功文案
   * @param outcome 落库结果
   */
  function notifyOutcome(title: string, successText: string, outcome: PersistOutcome): void {
    if (outcome.source === 'remote') {
      message.success(successText)
      return
    }
    if (outcome.source === 'local') {
      message.warning(`${title}已登记到本地，但未写入服务端：${outcome.reason ?? ''}`, 6)
      return
    }
    modal.error({
      title: `${title}失败`,
      content: outcome.reason ?? '后端拒绝了本次提交，未写入任何数据。',
    })
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
      const outcome = await persistTask(task)
      notifyOutcome('发起抽查', `已发起「${values.checkType}」，检查编号 ${task.checkId}`, outcome)
      // 被拒绝时不关闭弹窗，方便直接改选农场重试；成功与离线兜底都视为"已登记"，关闭
      if (outcome.source !== 'failed') {
        launchForm.resetFields()
        setLaunchOpen(false)
      }
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
      const outcome = await patchTask(
        resultTarget.checkId,
        patch,
        resultTarget.source === 'local',
      )
      notifyOutcome('录入检查结果', '检查结果已保存', outcome)
      if (outcome.source !== 'failed') {
        resultForm.resetFields()
        setResultTarget(null)
      }
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
      const outcome = await patchTask(trackTarget.checkId, patch, trackTarget.source === 'local')
      notifyOutcome('整改跟踪', '整改信息已更新', outcome)
      if (outcome.source !== 'failed') {
        trackForm.resetFields()
        setTrackTarget(null)
      }
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

      {!farmsQuery.isLoading && farmOptions.length === 0 && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message={
            farmsQuery.isError
              ? '读取农场档案失败，当前无法发起抽查'
              : '当前没有农场档案，发起合规检查前必须先建档'
          }
          description={
            farmsQuery.isError ? (
              <Space direction="vertical" size={4}>
                <Text>
                  GET /admin/farms 请求失败
                  {farmsQuery.error instanceof Error ? `：${farmsQuery.error.message}` : ''}
                  。此处不再用示例农场填充下拉框，请先恢复农场档案接口。
                </Text>
                <Button
                  size="small"
                  onClick={() => {
                    void farmsQuery.refetch()
                  }}
                >
                  重试读取农场档案
                </Button>
              </Space>
            ) : (
              <Space direction="vertical" size={4}>
                <Text>
                  GET /admin/farms 返回 0 条。此处不再用示例农场填充下拉框
                  （会把检查登记到并不存在的农场上）。合规检查必须绑定到真实存在的农场档案，
                  否则整改跟踪、风险统计与责任追溯全部失去锚点；
                  后端也会对不存在的 farmId 直接拒绝（404），不会留下脏数据。
                </Text>
                <Space wrap>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => navigate(FARM_CREATE_PATH)}
                  >
                    前往新增农场档案
                  </Button>
                  <Text type="secondary">
                    建档接口 POST /api/v1/production/farms，页面路由 {FARM_CREATE_PATH}
                  </Text>
                </Space>
              </Space>
            )
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
