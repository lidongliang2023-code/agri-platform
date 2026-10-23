/**
 * 页面名称：检测机构管理
 * 路由路径：/admin/production/quality/labs
 * 所属模块：质量追溯管理
 * PRD 序号：PRD 6.2 #18（检测机构准入、LIMS对接配置、服务评价）
 * 关联表：prod_quality_lab（PRD 11.2）
 *
 * 真实性约定（2026 修订）：
 * - 机构列表、新增、准入、驳回全部走真实接口，接口失败一律报错，不再用本地示例数据顶上；
 * - LIMS 对接配置与机构服务评价**后端完全没有对应表和接口**，短期也补不上，
 *   因此这两块保留浏览器本地存储，但必须在 UI 上醒目标注「仅本机、不同步服务端」。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Rate,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  StarOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { httpStatusOf } from '@/utils/request'
import type {
  CreateQualityLabPayload,
  LabLimsConfig,
  LabServiceRating,
  QualityLab,
} from '@/api/admin/trace'
import {
  accreditQualityLab,
  createQualityLab,
  fetchQualityLabs,
  rejectQualityLab,
  updateQualityLab,
} from '@/api/admin/trace'

const { Text } = Typography

/** LIMS 本地配置持久化 key */
const LIMS_STORAGE_KEY = 'agri.admin.quality.lab.lims.config'

/** 服务评价本地持久化 key */
const RATING_STORAGE_KEY = 'agri.admin.quality.lab.service.rating'

/** 准入审核意见本地留存 key（accredit 端点不接收审核意见，只能本机留存） */
const AUDIT_REMARK_STORAGE_KEY = 'agri.admin.quality.lab.audit.remark'

/** 机构准入审核状态 */
type LabAuditStatus = '合作中' | '待准入' | '已终止'

/** 资质等级文案（1国家级 / 2省级 / 3市级） */
const LAB_LEVEL_TEXT: Record<number, string> = {
  1: '国家级',
  2: '省级',
  3: '市级',
}

/** 资质等级 → 展示标签 */
function renderLabLevel(value?: number | null): JSX.Element {
  if (value === null || value === undefined) {
    return <Tag>未定级</Tag>
  }
  const text = LAB_LEVEL_TEXT[value]
  if (!text) {
    return <Tag>未定级</Tag>
  }
  return <Tag color={value === 1 ? 'gold' : value === 2 ? 'blue' : 'default'}>{text}</Tag>
}

/** 合作状态 → 展示 */
const STATUS_VIEW: Record<number, { text: LabAuditStatus; color: string }> = {
  1: { text: '合作中', color: 'success' },
  2: { text: '待准入', color: 'warning' },
  0: { text: '已终止', color: 'default' },
}

/** LIMS 认证方式选项 */
const AUTH_TYPE_OPTIONS: Array<{ label: string; value: LabLimsConfig['authType'] }> = [
  { label: '无认证', value: 'NONE' },
  { label: 'Basic 账号密码', value: 'BASIC' },
  { label: 'Token 令牌', value: 'TOKEN' },
  { label: 'OAuth2', value: 'OAUTH2' },
]

/** LIMS 同步方式选项 */
const SYNC_MODE_OPTIONS: Array<{ label: string; value: LabLimsConfig['syncMode'] }> = [
  { label: '机构推送（PUSH）', value: 'PUSH' },
  { label: '平台拉取（PULL）', value: 'PULL' },
]

/** 默认字段映射（PRD #18 字段映射：LIMS 字段 → 平台字段） */
const DEFAULT_FIELD_MAPPING: Array<{ source: string; target: string }> = [
  { source: 'report_no', target: 'inspectionNo' },
  { source: 'batch_no', target: 'batchNo' },
  { source: 'sample_time', target: 'sampleAt' },
  { source: 'conclusion', target: 'result' },
  { source: 'report_pdf', target: 'reportUrl' },
]

/** 机构类型 → 展示 */
const LAB_TYPE_TEXT: Record<string, string> = {
  THIRD_PARTY: '第三方',
  GOVERNMENT: '政府',
  SELF_BUILT: '自建',
}

/**
 * 后端能力缺失说明：LIMS 对接配置。
 *
 * 全仓无 lims 相关表与接口，配置只能存浏览器本地，必须让用户一眼看到这个事实。
 */
const LIMS_LOCAL_ONLY_ALERT = {
  message: '该配置仅保存在当前浏览器本地，不会同步到服务端',
  description:
    '后端暂无 LIMS 对接配置的存储能力（无对应数据表、无接口）。保存后仅本机可见：换设备、换浏览器或清理浏览器数据都会丢失，其他运营账号也看不到。后端补齐存储能力后将切换为接口读写。',
}

/**
 * 后端能力缺失说明：机构服务评价。
 */
const RATING_LOCAL_ONLY_ALERT = {
  message: '后端暂无机构服务评价数据源，未登记时显示「未接入」',
  description:
    '后端没有服务评价相关的数据表与接口，平台无法统计准时率 / 准确率 / 服务单数。当前展示的本机登记评价仅本机可见，不会同步服务端；清理浏览器数据后会丢失。',
}

/** LIMS 配置表单值 */
interface LimsFormValues {
  /** 是否启用 */
  enabled: boolean
  /** 接口地址 */
  endpoint: string
  /** 认证方式 */
  authType: LabLimsConfig['authType']
  /** 认证账号 */
  appKey?: string
  /** 认证密钥 */
  appSecret?: string
  /** 同步方式 */
  syncMode: LabLimsConfig['syncMode']
  /** 字段映射（每行 source=target，页面用文本域承接） */
  fieldMappingText: string
}

/** 准入审核表单值 */
interface AuditFormValues {
  /** 审核结论 */
  approved: boolean
  /** 审核意见 */
  remark: string
}

/** 新增机构表单值 */
interface CreateLabFormValues {
  /** 机构名称 */
  labName: string
  /** 机构编码 */
  labCode: string
  /** 机构类型 */
  labType: string
  /** 资质编号 */
  qualificationNo: string
  /** 资质等级 */
  labLevel: 1 | 2 | 3
  /** 联系人 */
  contactName?: string
  /** 联系电话 */
  contactPhone?: string
  /** 机构地址 */
  address?: string
  /** 认可范围 */
  accreditedScope?: string
  /** 初始合作状态：2 待准入 / 1 合作中 */
  status: number
}

/**
 * 服务评价登记表单值（本地登记，非服务端数据）。
 *
 * 后端没有服务评价表与接口，运营只能在本地登记自己的观察结果；
 * UI 上必须标注「本机登记」，不能让人误以为是平台统计出来的指标。
 */
interface RatingFormValues {
  /** 报告准时率（0-100） */
  onTimeRate: number
  /** 结果准确率（0-100） */
  accuracyRate: number
  /** 服务态度评分（0-5） */
  attitudeScore: number
  /** 累计服务单数 */
  orderCount: number
  /** 评价说明 */
  remark?: string
}

/**
 * 读取本地持久化的 LIMS 配置。
 *
 * 后端暂未提供 LIMS 配置端点，页面层本地登记并持久化到 localStorage，
 * 保证配置在刷新后仍然生效（后端补齐后可直接切换为接口读写）。
 *
 * @returns 机构 ID → LIMS 配置
 */
function loadLimsConfigs(): Record<string, LabLimsConfig> {
  try {
    const raw = window.localStorage.getItem(LIMS_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, LabLimsConfig>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * 读取本地持久化的服务评价。
 *
 * 后端没有服务评价数据源，这里只加载**本机登记过**的评价：历史版本曾把原型口径的示例
 * 评价（含从原型 4.2「活跃主体数」抄来的累计服务单数等编造数字）写进同一个 key，
 * 这些条目没有登记时间，一律丢弃，不继续渲染给用户。
 *
 * @returns 机构 ID → 服务评价
 */
function loadRatings(): Record<string, LabServiceRating> {
  try {
    const raw = window.localStorage.getItem(RATING_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, LabServiceRating>
    if (typeof parsed !== 'object' || parsed === null) {
      return {}
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, item]) => item !== null && typeof item === 'object' && typeof item.updatedAt === 'string',
      ),
    )
  } catch {
    return {}
  }
}

/**
 * 读取本地留存的准入审核意见。
 *
 * 后端 accredit 端点不接收审核意见，运营填写的内容只能在本机留存并原样展示，
 * 不伪装成「已提交服务端」。
 *
 * @returns 机构 ID → 审核意见
 */
function loadAuditRemarks(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(AUDIT_REMARK_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * 把写操作失败转换成用户可读文案。
 *
 * 端点未就绪（404 / 501）与业务拒绝、网络不可达要分开说，
 * 统一口径是「数据未保存」，绝不让失败看起来像成功。
 *
 * @param error mutation 抛出的错误
 * @param action 操作名，如「新增机构」
 * @param endpoint 对应后端端点路径
 * @returns 展示给用户的错误文案
 */
function describeFailure(error: unknown, action: string, endpoint: string): string {
  const status = httpStatusOf(error)
  if (status === 404 || status === 501) {
    return `${action}失败：后端端点 ${endpoint} 尚未就绪（HTTP ${status}），数据未保存，请联系后端补齐该接口后重试`
  }
  const detail = error instanceof Error ? error.message : ''
  if (status === 0) {
    return `${action}失败：接口不可达（${detail || '网络异常'}），数据未保存`
  }
  return `${action}失败：${detail || `后端 ${endpoint} 未返回成功`}，数据未保存`
}

/**
 * 检测机构管理
 *
 * 业务职责：检测机构准入审核（通过 / 驳回）、LIMS 对接配置（接口地址 / 认证方式 / 字段映射）
 * 与服务评价展示，维护机构资质与合作状态。
 *
 * 数据来源（全部为真实接口，失败即报错，不回落示例数据）：
 * - GET  /admin/quality/labs（机构分页，keyword 按名称模糊）
 * - POST /quality/labs（新增机构，返回新机构 ID）
 * - POST /admin/quality/labs/{labId}/accredit（准入通过，status 置 1）
 * - POST /admin/quality/labs/{labId}/reject（准入驳回，status 置 0 并落驳回原因）
 *
 * 本地降级（已在 UI 醒目提示）：LIMS 对接配置、服务评价、准入审核意见。
 *
 * @returns 页面内容
 */
export default function LabManage(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 分页 */
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  /** 关键字输入值 */
  const [keyword, setKeyword] = useState<string>('')
  /** 已提交关键字 */
  const [submittedKeyword, setSubmittedKeyword] = useState<string>('')
  /** 状态筛选（后端无 status 参数，仅作用于当前页） */
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined)
  /** LIMS 配置（本地持久化） */
  const [limsConfigs, setLimsConfigs] = useState<Record<string, LabLimsConfig>>({})
  /** 服务评价（本地持久化） */
  const [ratings, setRatings] = useState<Record<string, LabServiceRating>>({})
  /** 准入审核意见（本地留存，后端 accredit 不接收） */
  const [auditRemarks, setAuditRemarks] = useState<Record<string, string>>({})
  /** LIMS 配置弹窗目标机构 */
  const [limsTarget, setLimsTarget] = useState<QualityLab | null>(null)
  /** LIMS 配置表单 */
  const [limsForm] = Form.useForm<LimsFormValues>()
  /** 准入审核弹窗目标机构 */
  const [auditTarget, setAuditTarget] = useState<QualityLab | null>(null)
  /** 准入审核表单 */
  const [auditForm] = Form.useForm<AuditFormValues>()
  /** 详情抽屉目标机构 */
  const [detailTarget, setDetailTarget] = useState<QualityLab | null>(null)
  /** 新增机构弹窗开关 */
  const [createOpen, setCreateOpen] = useState<boolean>(false)
  /** 新增机构表单 */
  const [createForm] = Form.useForm<CreateLabFormValues>()
  /** 服务评价登记目标机构（本地登记） */
  const [ratingTarget, setRatingTarget] = useState<QualityLab | null>(null)
  /** 服务评价表单 */
  const [ratingForm] = Form.useForm<RatingFormValues>()
  /** 编辑机构弹窗目标机构 */
  const [editTarget, setEditTarget] = useState<QualityLab | null>(null)
  /** 编辑机构表单 */
  const [editForm] = Form.useForm<CreateLabFormValues>()

  /** 首次挂载时读取本地登记的配置与评价 */
  useEffect(() => {
    setLimsConfigs(loadLimsConfigs())
    setRatings(loadRatings())
    setAuditRemarks(loadAuditRemarks())
  }, [])

  /** 机构分页 */
  const listQuery = useQuery({
    queryKey: ['admin', 'quality', 'labs', pageNum, pageSize, submittedKeyword],
    queryFn: () => fetchQualityLabs({ pageNum, pageSize, keyword: submittedKeyword }),
    retry: false,
  })

  /** 列表刷新：新增 / 准入 / 驳回后同步 */
  const refreshList = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'quality', 'labs'] })
  }, [queryClient])

  /** 准入通过 */
  const accreditMutation = useMutation({
    mutationFn: (labId: string) => accreditQualityLab(labId),
    onSuccess: () => {
      message.success('机构准入已通过，合作状态更新为「合作中」')
      refreshList()
    },
    onError: (error: unknown) => {
      message.error(
        describeFailure(error, '准入通过', 'POST /admin/quality/labs/{labId}/accredit'),
      )
    },
  })

  /** 准入驳回 */
  const rejectMutation = useMutation({
    mutationFn: (params: { labId: string; rejectReason: string }) =>
      rejectQualityLab(params.labId, params.rejectReason),
    onSuccess: (_data, variables) => {
      message.success(
        `已驳回机构准入，合作状态更新为「已终止」${variables.rejectReason ? `，驳回原因已提交：${variables.rejectReason}` : ''}`,
      )
      refreshList()
    },
    onError: (error: unknown) => {
      message.error(
        describeFailure(error, '准入驳回', 'POST /admin/quality/labs/{labId}/reject'),
      )
    },
  })

  /** 新增机构 */
  const createMutation = useMutation({
    mutationFn: (payload: CreateQualityLabPayload) => createQualityLab(payload),
    onSuccess: (labId: string) => {
      message.success(`机构已创建（机构 ID：${labId}），请按合作状态完成后续准入审核`)
      setCreateOpen(false)
      createForm.resetFields()
      setPageNum(1)
      refreshList()
    },
    onError: (error: unknown) => {
      message.error(describeFailure(error, '新增机构', 'POST /quality/labs'))
    },
  })

  /**
   * 编辑机构。
   *
   * <p>只提交机构描述性字段 + 资质等级（{@code labLevel}，V11 已加列）。
   * 刻意**不包含**合作状态 {@code status}：状态变更必须走准入审核
   * （accredit / reject）这条有记录的链路，编辑表单里改状态等于绕开审计。</p>
   */
  const updateMutation = useMutation({
    mutationFn: (params: { labId: string; payload: Partial<CreateQualityLabPayload> }) =>
      updateQualityLab(params.labId, params.payload),
    onSuccess: (_data, variables) => {
      message.success(`机构资料已更新（机构 ID：${variables.labId}）`)
      setEditTarget(null)
      editForm.resetFields()
      refreshList()
    },
    onError: (error: unknown) => {
      message.error(describeFailure(error, '编辑机构', 'PUT /quality/labs/{labId}'))
    },
  })

  /** 打开编辑弹窗：用行内真实数据回填，不做任何本地兜底 */
  const openEditForm = useCallback(
    (record: QualityLab): void => {
      setEditTarget(record)
      editForm.setFieldsValue({
        labName: record.labName,
        labCode: record.labCode,
        labType: record.labType,
        labLevel: (record.labLevel ?? undefined) as 1 | 2 | 3 | undefined,
        qualificationNo: record.qualificationNo,
        contactName: record.contactName,
        contactPhone: record.contactPhone,
        address: record.address,
        accreditedScope: record.accreditedScope,
      })
    },
    [editForm],
  )

  /** 提交编辑 */
  const submitEdit = useCallback((): void => {
    if (!editTarget) {
      return
    }
    void editForm.validateFields().then((values: CreateLabFormValues) => {
      updateMutation.mutate({
        labId: editTarget.labId,
        payload: {
          labName: values.labName,
          labCode: values.labCode,
          labType: values.labType,
          labLevel: values.labLevel,
          qualificationNo: values.qualificationNo,
          contactName: values.contactName,
          contactPhone: values.contactPhone,
          address: values.address,
          accreditedScope: values.accreditedScope,
        },
      })
    })
  }, [editForm, editTarget, updateMutation])

  /** 表格数据源（只读后端；后端无数据即为空，不再用示例数据顶上） */
  const { rows, total } = useMemo(() => {
    const remote = listQuery.data?.list ?? []
    const filtered =
      statusFilter === undefined ? remote : remote.filter((row) => row.status === statusFilter)
    return { rows: filtered, total: listQuery.data?.total ?? 0 }
  }, [listQuery.data, statusFilter])

  /** 顶部统计（合作中 / 待准入为当前页口径，后端未提供全量状态聚合） */
  const stats = useMemo(() => {
    const currentPage = listQuery.data?.list ?? []
    return {
      /** 机构总数（后端分页返回的真实总数） */
      total: listQuery.data?.total ?? 0,
      /** 当前页合作中 */
      cooperating: currentPage.filter((item) => item.status === 1).length,
      /** 当前页待准入 */
      pending: currentPage.filter((item) => item.status === 2).length,
      /** 本机登记的 LIMS 已对接数量 */
      limsEnabled: Object.values(limsConfigs).filter((item) => item.enabled).length,
    }
  }, [listQuery.data, limsConfigs])

  /** 打开 LIMS 配置弹窗 */
  const openLimsConfig = useCallback(
    (record: QualityLab): void => {
      setLimsTarget(record)
      const existing = limsConfigs[record.labId]
      limsForm.setFieldsValue({
        enabled: existing?.enabled ?? false,
        endpoint: existing?.endpoint ?? `https://lims.${record.labCode?.toLowerCase() ?? 'lab'}.com/api/v1/reports`,
        authType: existing?.authType ?? 'TOKEN',
        appKey: existing?.appKey ?? '',
        appSecret: existing?.appSecret ?? '',
        syncMode: existing?.syncMode ?? 'PULL',
        fieldMappingText: (existing?.fieldMapping ?? DEFAULT_FIELD_MAPPING)
          .map((item) => `${item.source}=${item.target}`)
          .join('\n'),
      })
    },
    [limsConfigs, limsForm],
  )

  /** 提交 LIMS 配置（本地持久化，已醒目标注不会同步服务端） */
  const handleLimsSubmit = async (): Promise<void> => {
    const values = await limsForm.validateFields()
    if (!limsTarget) {
      return
    }
    const fieldMapping: Array<{ source: string; target: string }> = values.fieldMappingText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const [source, target] = line.split('=')
        return { source: (source ?? '').trim(), target: (target ?? '').trim() }
      })
      .filter((item) => item.source.length > 0 && item.target.length > 0)

    if (values.enabled && fieldMapping.length === 0) {
      message.error('启用对接时至少配置一条字段映射')
      return
    }
    if (values.enabled && !values.endpoint.startsWith('http')) {
      message.error('接口地址需以 http(s):// 开头')
      return
    }

    const nextConfig: LabLimsConfig = {
      enabled: values.enabled,
      endpoint: values.endpoint,
      authType: values.authType,
      appKey: values.appKey,
      appSecret: values.appSecret,
      syncMode: values.syncMode,
      fieldMapping,
      updatedAt: new Date().toISOString(),
    }
    const next = { ...limsConfigs, [limsTarget.labId]: nextConfig }
    setLimsConfigs(next)
    let persisted = true
    try {
      window.localStorage.setItem(LIMS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 隐私模式下 localStorage 不可用时，仅保留内存态
      persisted = false
    }
    if (persisted) {
      message.success(
        `已保存到本机浏览器：${limsTarget.labName} 的 LIMS 对接配置（未同步服务端，换设备或清理浏览器数据后会丢失）`,
      )
    } else {
      message.warning(
        `浏览器本地存储不可用，${limsTarget.labName} 的 LIMS 配置仅保留在当前页面，刷新后会丢失`,
      )
    }
    setLimsTarget(null)
  }

  /** 打开服务评价登记弹窗（本地登记，后端无评价接口） */
  const openRatingForm = useCallback(
    (record: QualityLab): void => {
      setRatingTarget(record)
      const existing = ratings[record.labId]
      ratingForm.setFieldsValue({
        onTimeRate: existing?.onTimeRate ?? 90,
        accuracyRate: existing?.accuracyRate ?? 95,
        attitudeScore: existing?.attitudeScore ?? 4,
        orderCount: existing?.orderCount ?? 0,
        remark: existing?.remark ?? '',
      })
    },
    [ratings, ratingForm],
  )

  /** 提交服务评价（仅写入本机浏览器，已醒目标注不会同步服务端） */
  const handleRatingSubmit = async (): Promise<void> => {
    const values = await ratingForm.validateFields()
    if (!ratingTarget) {
      return
    }
    const nextRating: LabServiceRating = {
      onTimeRate: Number(values.onTimeRate),
      accuracyRate: Number(values.accuracyRate),
      attitudeScore: Number(values.attitudeScore),
      orderCount: Number(values.orderCount),
      remark: values.remark,
      updatedAt: new Date().toISOString(),
    }
    const next = { ...ratings, [ratingTarget.labId]: nextRating }
    setRatings(next)
    let persisted = true
    try {
      window.localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 隐私模式下 localStorage 不可用时，仅保留内存态
      persisted = false
    }
    if (persisted) {
      message.success(
        `已保存到本机浏览器：${ratingTarget.labName} 的服务评价（本机登记，非平台统计值，不会同步服务端）`,
      )
    } else {
      message.warning('浏览器本地存储不可用，本次服务评价仅保留在当前页面，刷新后会丢失')
    }
    setRatingTarget(null)
  }

  /** 提交准入审核（通过走 accredit，驳回走 reject，均为真实写接口） */
  const handleAuditSubmit = async (): Promise<void> => {
    const values = await auditForm.validateFields()
    if (!auditTarget) {
      return
    }
    const labId = auditTarget.labId
    const remark = (values.remark ?? '').trim()
    if (values.approved) {
      /** 审核意见：accredit 端点不接收，仅本机留存并原样展示 */
      if (remark) {
        const next = { ...auditRemarks, [labId]: remark }
        setAuditRemarks(next)
        try {
          window.localStorage.setItem(AUDIT_REMARK_STORAGE_KEY, JSON.stringify(next))
        } catch {
          // 隐私模式下 localStorage 不可用时，仅保留内存态
        }
      }
      accreditMutation.mutate(labId)
    } else {
      if (!remark) {
        message.error('驳回时必须填写驳回原因（后端会落库 reject_reason）')
        return
      }
      rejectMutation.mutate({ labId, rejectReason: remark })
    }
    setAuditTarget(null)
    auditForm.resetFields()
  }

  /** 提交新增机构（真实调用 POST /quality/labs） */
  const handleCreateSubmit = async (): Promise<void> => {
    const values = await createForm.validateFields()
    const payload: CreateQualityLabPayload = {
      labCode: values.labCode,
      labName: values.labName,
      labType: values.labType,
      labLevel: values.labLevel,
      contactName: values.contactName,
      contactPhone: values.contactPhone,
      address: values.address,
      qualificationNo: values.qualificationNo,
      accreditedScope: values.accreditedScope,
      status: values.status,
    }
    createMutation.mutate(payload)
  }

  /** 表格列（PRD #18 字段） */
  const columns: ColumnsType<QualityLab> = [
    {
      title: '机构名称',
      dataIndex: 'labName',
      width: 200,
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setDetailTarget(record)}>
            {value}
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.labCode ?? '—'}</Text>
        </Space>
      ),
    },
    {
      title: '资质编号',
      dataIndex: 'qualificationNo',
      width: 180,
      render: (value: string) => <Text copyable>{value ?? '—'}</Text>,
    },
    {
      title: '资质等级',
      dataIndex: 'labLevel',
      width: 100,
      render: (value: number | null | undefined) => renderLabLevel(value),
    },
    {
      title: '类型',
      dataIndex: 'labType',
      width: 100,
      render: (value: string) => LAB_TYPE_TEXT[value] ?? value ?? '—',
    },
    {
      title: '合作状态',
      dataIndex: 'status',
      width: 110,
      render: (value: number) => (
        <Tag color={STATUS_VIEW[value]?.color ?? 'default'}>{STATUS_VIEW[value]?.text ?? '未知'}</Tag>
      ),
    },
    {
      title: 'LIMS 对接',
      key: 'lims',
      width: 140,
      render: (_value, record) => {
        const config = limsConfigs[record.labId]
        return config?.enabled ? (
          <Tag color="success" icon={<ApiOutlined />}>已对接（本机）</Tag>
        ) : (
          <Tag>未对接</Tag>
        )
      },
    },
    {
      title: '服务评价',
      key: 'rating',
      width: 180,
      render: (_value, record) => {
        const rating = ratings[record.labId]
        if (!rating) {
          return <Text type="secondary">未接入</Text>
        }
        return (
          <Space direction="vertical" size={0}>
            <Rate disabled allowHalf value={rating.attitudeScore} style={{ fontSize: 12 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              本机登记 · 准时 {rating.onTimeRate}% · 准确 {rating.accuracyRate}%
            </Text>
          </Space>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_value, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditForm(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => openLimsConfig(record)}
          >
            LIMS配置
          </Button>
          <Button
            type="link"
            size="small"
            icon={<StarOutlined />}
            onClick={() => openRatingForm(record)}
          >
            评价
          </Button>
          {record.status === 2 ? (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                loading={accreditMutation.isPending}
                onClick={() => {
                  setAuditTarget(record)
                  auditForm.setFieldsValue({ approved: true, remark: '' })
                }}
              >
                通过
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                loading={rejectMutation.isPending}
                onClick={() => {
                  setAuditTarget(record)
                  auditForm.setFieldsValue({ approved: false, remark: '' })
                }}
              >
                驳回
              </Button>
            </>
          ) : (
            <Button type="link" size="small" onClick={() => setDetailTarget(record)}>
              详情
            </Button>
          )}
        </Space>
      ),
    },
  ]

  /** 列表加载失败文案 */
  const listErrorText =
    listQuery.error instanceof Error && listQuery.error.message
      ? listQuery.error.message
      : '接口不可达或返回异常'

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {listQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message={`检测机构列表加载失败：${listErrorText}`}
          description="页面不再使用本地示例机构数据兜底——接口恢复前列表为空。请确认后端 GET /api/v1/production/admin/quality/labs 可用后重试。"
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : null}

      {/* 统计卡 */}
      <Row gutter={16}>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic title="机构总数" value={stats.total} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic
              title="合作中（当前页）"
              value={stats.cooperating}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待准入（当前页）"
              value={stats.pending}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic
              title="LIMS 已对接（本机登记）"
              value={stats.limsEnabled}
              suffix="家"
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              服务评价：后端未接入
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 筛选区 */}
      <Card>
        <Space wrap size={12}>
          <Input
            placeholder="请输入机构名称"
            value={keyword}
            allowClear
            style={{ width: 220 }}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select
            placeholder="合作状态：全部"
            allowClear
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(value: number | undefined) => setStatusFilter(value)}
            options={[
              { label: '合作中', value: 1 },
              { label: '待准入', value: 2 },
              { label: '已终止', value: 0 },
            ]}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              setPageNum(1)
              setSubmittedKeyword(keyword)
            }}
          >
            查询
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setKeyword('')
              setStatusFilter(undefined)
              setPageNum(1)
              setSubmittedKeyword('')
            }}
          >
            重置
          </Button>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            合作状态筛选仅对当前页生效：后端 GET /admin/quality/labs 暂无 status 参数，仅支持按机构名称模糊查询。
          </Text>
        </div>
      </Card>

      {/* 列表区 */}
      <Card
        title="检测机构清单"
        extra={
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新增机构
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table<QualityLab>
          rowKey="labId"
          size="small"
          loading={listQuery.isLoading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1300 }}
          locale={{ emptyText: <Empty description="暂无检测机构，请新增机构或调整筛选条件" /> }}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 家机构`,
            onChange: (page, size) => {
              setPageNum(page)
              setPageSize(size)
            },
          }}
        />
      </Card>

      {/* 机构详情抽屉：资质 + 服务评价 + LIMS */}
      <Drawer
        title="检测机构详情"
        width={560}
        open={detailTarget !== null}
        onClose={() => setDetailTarget(null)}
        destroyOnClose
      >
        {detailTarget ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions
              column={1}
              size="small"
              bordered
              items={[
                { key: 'name', label: '机构名称', children: detailTarget.labName },
                { key: 'code', label: '机构编码', children: detailTarget.labCode ?? '—' },
                { key: 'level', label: '资质等级', children: renderLabLevel(detailTarget.labLevel) },
                { key: 'qual', label: '资质编号', children: detailTarget.qualificationNo ?? '—' },
                { key: 'scope', label: '认可范围', children: detailTarget.accreditedScope ?? '—' },
                { key: 'type', label: '机构类型', children: LAB_TYPE_TEXT[detailTarget.labType ?? ''] ?? detailTarget.labType ?? '—' },
                { key: 'contact', label: '联系人', children: detailTarget.contactName ?? '—' },
                { key: 'phone', label: '联系电话', children: detailTarget.contactPhone ?? '—' },
                { key: 'address', label: '机构地址', children: detailTarget.address ?? '—' },
                {
                  key: 'status',
                  label: '合作状态',
                  children: (
                    <Tag color={STATUS_VIEW[detailTarget.status]?.color ?? 'default'}>
                      {STATUS_VIEW[detailTarget.status]?.text ?? '未知'}
                    </Tag>
                  ),
                },
                { key: 'reject', label: '驳回原因', children: detailTarget.rejectReason ?? '—' },
                {
                  key: 'auditRemark',
                  label: '审核意见（本机留存）',
                  children: auditRemarks[detailTarget.labId] ?? '—',
                },
              ]}
            />
            <Card
              title="服务评价"
              size="small"
              extra={
                <Button
                  type="link"
                  size="small"
                  icon={<StarOutlined />}
                  onClick={() => openRatingForm(detailTarget)}
                >
                  {ratings[detailTarget.labId] ? '更新本机评价' : '登记本机评价'}
                </Button>
              }
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Alert
                  type="warning"
                  showIcon
                  message={RATING_LOCAL_ONLY_ALERT.message}
                  description={RATING_LOCAL_ONLY_ALERT.description}
                />
                {(() => {
                  const rating = ratings[detailTarget.labId]
                  if (!rating) {
                    return <Empty description="未接入：后端暂无服务评价数据，本机也未登记" />
                  }
                  return (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Row align="middle" justify="space-between">
                        <Space>
                          <StarOutlined style={{ color: '#faad14' }} />
                          <Text strong>综合服务评分</Text>
                          <Tag color="orange">本机登记</Tag>
                        </Space>
                        <Rate disabled allowHalf value={rating.attitudeScore} />
                      </Row>
                      <div>
                        <Text type="secondary">报告准时率</Text>
                        <Progress percent={rating.onTimeRate} size="small" strokeColor="#52c41a" />
                      </div>
                      <div>
                        <Text type="secondary">结果准确率</Text>
                        <Progress percent={rating.accuracyRate} size="small" strokeColor="#1677ff" />
                      </div>
                      <Row justify="space-between">
                        <Text type="secondary">累计服务单数</Text>
                        <Text strong>{rating.orderCount.toLocaleString('zh-CN')} 单</Text>
                      </Row>
                      <Row justify="space-between">
                        <Text type="secondary">本机登记时间</Text>
                        <Text type="secondary">{rating.updatedAt ?? '—'}</Text>
                      </Row>
                      {rating.remark ? (
                        <Alert type="info" showIcon message={rating.remark} />
                      ) : null}
                    </Space>
                  )
                })()}
              </Space>
            </Card>
            <Card title="LIMS 对接配置" size="small">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Alert
                  type="warning"
                  showIcon
                  message={LIMS_LOCAL_ONLY_ALERT.message}
                  description={LIMS_LOCAL_ONLY_ALERT.description}
                />
                {(() => {
                  const config = limsConfigs[detailTarget.labId]
                  if (!config) {
                    return <Empty description="尚未配置 LIMS 对接（当前记录保存在本机浏览器）" />
                  }
                  return (
                    <Descriptions
                      column={1}
                      size="small"
                      items={[
                        {
                          key: 'enabled',
                          label: '启用状态',
                          children: config.enabled ? <Tag color="success">已启用</Tag> : <Tag>未启用</Tag>,
                        },
                        { key: 'endpoint', label: '接口地址', children: config.endpoint },
                        {
                          key: 'auth',
                          label: '认证方式',
                          children: AUTH_TYPE_OPTIONS.find((item) => item.value === config.authType)?.label ?? config.authType,
                        },
                        {
                          key: 'sync',
                          label: '同步方式',
                          children: SYNC_MODE_OPTIONS.find((item) => item.value === config.syncMode)?.label ?? config.syncMode,
                        },
                        {
                          key: 'mapping',
                          label: '字段映射',
                          children: config.fieldMapping.map((item) => (
                            <div key={`${item.source}-${item.target}`}>
                              <Text code>{item.source}</Text> → <Text code>{item.target}</Text>
                            </div>
                          )),
                        },
                        { key: 'updatedAt', label: '本机保存时间', children: config.updatedAt ?? '—' },
                      ]}
                    />
                  )
                })()}
              </Space>
            </Card>
          </Space>
        ) : null}
      </Drawer>

      {/* LIMS 对接配置弹窗（PRD #18） */}
      <Modal
        title={`LIMS 对接配置 - ${limsTarget?.labName ?? ''}`}
        open={limsTarget !== null}
        onCancel={() => setLimsTarget(null)}
        onOk={() => void handleLimsSubmit()}
        okText="保存到本机"
        cancelText="取消"
        width={620}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message={LIMS_LOCAL_ONLY_ALERT.message}
            description={LIMS_LOCAL_ONLY_ALERT.description}
          />
          <Form form={limsForm} layout="vertical" preserve={false}>
            <Form.Item name="enabled" label="启用对接" valuePropName="checked">
              <Switch checkedChildren="已启用" unCheckedChildren="未启用" />
            </Form.Item>
            <Form.Item
              name="endpoint"
              label="接口地址"
              rules={[{ required: true, message: '请输入 LIMS 接口地址' }]}
            >
              <Input placeholder="https://lims.example.com/api/v1/reports" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="authType" label="认证方式" rules={[{ required: true, message: '请选择认证方式' }]}>
                  <Select options={AUTH_TYPE_OPTIONS} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="syncMode" label="同步方式" rules={[{ required: true, message: '请选择同步方式' }]}>
                  <Select options={SYNC_MODE_OPTIONS} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="appKey" label="账号 / AppKey">
                  <Input placeholder="选填" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="appSecret" label="密钥 / AppSecret">
                  <Input.Password placeholder="选填" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="fieldMappingText"
              label="字段映射（每行一条，格式：LIMS字段=平台字段）"
              rules={[{ required: true, message: '请配置字段映射' }]}
            >
              <Input.TextArea rows={6} placeholder={'report_no=inspectionNo\nbatch_no=batchNo'} />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      {/* 准入审核弹窗（PRD #18 机构准入） */}
      <Modal
        title={`准入审核 - ${auditTarget?.labName ?? ''}`}
        open={auditTarget !== null}
        onCancel={() => setAuditTarget(null)}
        onOk={() => void handleAuditSubmit()}
        okText="提交审核"
        cancelText="取消"
        confirmLoading={accreditMutation.isPending || rejectMutation.isPending}
        destroyOnClose
      >
        <Form form={auditForm} layout="vertical" preserve={false}>
          <Form.Item name="approved" label="审核结论" rules={[{ required: true, message: '请选择审核结论' }]}>
            <Select
              options={[
                { label: '通过（置为合作中）', value: true },
                { label: '驳回（终止合作）', value: false },
              ]}
            />
          </Form.Item>
          <Form.Item name="remark" label="审核意见">
            <Input.TextArea rows={4} placeholder="驳回时必填，将作为驳回原因提交到后端保存" />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            通过：调用 POST /admin/quality/labs/{'{labId}'}/accredit；审核意见后端不接收，仅在本机留存展示。
            驳回：调用 POST /admin/quality/labs/{'{labId}'}/reject，驳回原因落库。
          </Text>
        </Form>
      </Modal>

      {/* 服务评价登记弹窗（本地登记：后端无评价接口，已醒目标注） */}
      <Modal
        title={`服务评价登记 - ${ratingTarget?.labName ?? ''}`}
        open={ratingTarget !== null}
        onCancel={() => setRatingTarget(null)}
        onOk={() => void handleRatingSubmit()}
        okText="保存到本机"
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message={RATING_LOCAL_ONLY_ALERT.message}
            description={RATING_LOCAL_ONLY_ALERT.description}
          />
          <Form form={ratingForm} layout="vertical" preserve={false}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="onTimeRate"
                  label="报告准时率（%）"
                  rules={[{ required: true, message: '请输入报告准时率' }]}
                >
                  <Input type="number" min={0} max={100} placeholder="0-100" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="accuracyRate"
                  label="结果准确率（%）"
                  rules={[{ required: true, message: '请输入结果准确率' }]}
                >
                  <Input type="number" min={0} max={100} placeholder="0-100" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="orderCount"
                  label="累计服务单数"
                  rules={[{ required: true, message: '请输入累计服务单数' }]}
                >
                  <Input type="number" min={0} placeholder="0" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="attitudeScore"
                  label="服务态度评分"
                  rules={[{ required: true, message: '请给出服务态度评分' }]}
                >
                  <Rate allowHalf />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="remark" label="评价说明">
              <Input.TextArea rows={3} placeholder="选填，如 出报告周期稳定、旺季存在排期" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      {/* 新增机构弹窗（真实调用 POST /quality/labs） */}
      <Modal
        title="新增检测机构"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreateSubmit()}
        okText="提交"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        width={620}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          preserve={false}
          initialValues={{ status: 2 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="labName" label="机构名称" rules={[{ required: true, message: '请输入机构名称' }]}>
                <Input placeholder="如 国家质检中心" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="labCode" label="机构编码" rules={[{ required: true, message: '请输入机构编码' }]}>
                <Input placeholder="如 NAT-QC-001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="labType" label="机构类型" rules={[{ required: true, message: '请选择机构类型' }]}>
                <Select
                  options={[
                    { label: '第三方', value: 'THIRD_PARTY' },
                    { label: '政府', value: 'GOVERNMENT' },
                    { label: '自建', value: 'SELF_BUILT' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="labLevel" label="资质等级" rules={[{ required: true, message: '请选择资质等级' }]}>
                <Select
                  options={[
                    { label: '国家级', value: 1 },
                    { label: '省级', value: 2 },
                    { label: '市级', value: 3 },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="qualificationNo" label="资质编号" rules={[{ required: true, message: '请输入资质编号' }]}>
            <Input placeholder="如 CNAS-L2025-0018" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contactName" label="联系人">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactPhone" label="联系电话">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="机构地址">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="accreditedScope" label="认可检测范围">
            <Input.TextArea rows={3} placeholder="如 农残、重金属、微生物" />
          </Form.Item>
          <Form.Item
            name="status"
            label="初始合作状态"
            rules={[{ required: true, message: '请选择初始合作状态' }]}
          >
            <Select
              options={[
                { label: '待准入（需完成准入审核）', value: 2 },
                { label: '合作中', value: 1 },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑机构弹窗（PUT /quality/labs/{labId}，真实落库；不含合作状态，状态变更走准入审核） */}
      <Modal
        title={editTarget ? `编辑检测机构：${editTarget.labName}` : '编辑检测机构'}
        open={editTarget !== null}
        onCancel={() => {
          setEditTarget(null)
          editForm.resetFields()
        }}
        onOk={submitEdit}
        confirmLoading={updateMutation.isPending}
        okText="保存"
        cancelText="取消"
        width={720}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="labName" label="机构名称" rules={[{ required: true, message: '请输入机构名称' }]}>
                <Input placeholder="如 国家质检中心" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="labCode" label="机构编码" rules={[{ required: true, message: '请输入机构编码' }]}>
                <Input placeholder="如 NAT-QC-001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="labType" label="机构类型" rules={[{ required: true, message: '请选择机构类型' }]}>
                <Select
                  options={[
                    { label: '第三方', value: 'THIRD_PARTY' },
                    { label: '政府', value: 'GOVERNMENT' },
                    { label: '自建', value: 'SELF_BUILT' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="labLevel" label="资质等级" rules={[{ required: true, message: '请选择资质等级' }]}>
                <Select
                  options={[
                    { label: '国家级', value: 1 },
                    { label: '省级', value: 2 },
                    { label: '市级', value: 3 },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="qualificationNo" label="资质编号" rules={[{ required: true, message: '请输入资质编号' }]}>
            <Input placeholder="如 CNAS-L2025-0018" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contactName" label="联系人">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactPhone" label="联系电话">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="机构地址">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="accreditedScope" label="认可检测范围">
            <Input.TextArea rows={3} placeholder="如 农残、重金属、微生物" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="合作状态不在此处修改"
            description="机构合作状态只能通过「通过 / 驳回」准入审核变更（有审核记录可追溯），编辑表单不提供该字段，避免绕开审计。"
          />
        </Form>
      </Modal>
    </Space>
  )
}
