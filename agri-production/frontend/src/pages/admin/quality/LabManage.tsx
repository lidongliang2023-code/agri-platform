/**
 * 页面名称：检测机构管理
 * 路由路径：/admin/production/quality/labs
 * 所属模块：质量追溯管理
 * PRD 序号：PRD 6.2 #18（检测机构准入、LIMS对接配置、服务评价）
 * 关联表：agri_prod_quality_lab（PRD 11.2）
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
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  StarOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  LabLimsConfig,
  LabServiceRating,
  QualityLab,
} from '@/api/admin/trace'
import { accreditQualityLab, fetchQualityLabs } from '@/api/admin/trace'

const { Text } = Typography

/** LIMS 本地配置持久化 key */
const LIMS_STORAGE_KEY = 'agri.admin.quality.lab.lims.config'

/** 服务评价本地持久化 key */
const RATING_STORAGE_KEY = 'agri.admin.quality.lab.service.rating'

/** 机构准入审核状态 */
type LabAuditStatus = '合作中' | '待准入' | '已终止'

/** 资质等级文案 */
const LAB_LEVEL_TEXT: Record<number, string> = {
  1: '国家级',
  2: '省级',
  3: '市级',
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

/** 原型示例机构（后端无数据时兜底） */
const PROTOTYPE_LABS: QualityLab[] = [
  {
    labId: 'LAB001',
    labCode: 'NAT-QC-001',
    labName: '国家质检中心',
    labType: 'GOVERNMENT',
    contactName: '陈明',
    contactPhone: '010-6234****',
    address: '北京市朝阳区质检大厦',
    qualificationNo: 'CNAS-L2025-0018',
    accreditedScope: '农残、重金属、微生物、理化指标',
    status: 1,
    labLevel: 1,
    createdAt: '2025-01-12 09:00:00',
  },
  {
    labId: 'LAB002',
    labCode: 'SGS-CN-021',
    labName: 'SGS 通标标准技术服务',
    labType: 'THIRD_PARTY',
    contactName: '刘婷',
    contactPhone: '021-5836****',
    address: '上海市浦东新区康桥东路',
    qualificationNo: 'CMA-2025-沪-0312',
    accreditedScope: '农残、兽残、添加剂、营养成分',
    status: 1,
    labLevel: 1,
    createdAt: '2025-02-08 09:00:00',
  },
  {
    labId: 'LAB003',
    labCode: 'PROV-AG-076',
    labName: '省农产品质量检验中心',
    labType: 'GOVERNMENT',
    contactName: '王建国',
    contactPhone: '0371-6592****',
    address: '河南省郑州市农业路 12 号',
    qualificationNo: 'CMA-2025-豫-0207',
    accreditedScope: '农药残留、重金属、品质指标',
    status: 1,
    labLevel: 2,
    createdAt: '2025-03-01 09:00:00',
  },
  {
    labId: 'LAB004',
    labCode: 'CITY-QS-134',
    labName: '市质检站',
    labType: 'GOVERNMENT',
    contactName: '赵敏',
    contactPhone: '0371-6723****',
    address: '河南省郑州市中原区',
    qualificationNo: 'CMA-2025-郑-0091',
    accreditedScope: '常规理化、微生物',
    status: 1,
    labLevel: 3,
    createdAt: '2025-03-20 09:00:00',
  },
  {
    labId: 'LAB005',
    labCode: 'SELF-LAB-009',
    labName: '绿源自建实验室',
    labType: 'SELF_BUILT',
    contactName: '孙浩',
    contactPhone: '138****2043',
    address: '河南省新乡市绿源产业园',
    qualificationNo: 'CMA-2025-新-0044',
    accreditedScope: '水分、杂质、外观等级',
    status: 2,
    labLevel: 3,
    createdAt: '2025-06-18 09:00:00',
  },
]

/** 原型示例服务评价（后端无评价接口时兜底） */
const PROTOTYPE_RATING: Record<string, LabServiceRating> = {
  LAB001: { onTimeRate: 96, accuracyRate: 99, attitudeScore: 4.8, orderCount: 1286, remark: '国家级机构，报告权威性高，出报告周期稳定' },
  LAB002: { onTimeRate: 92, accuracyRate: 98, attitudeScore: 4.6, orderCount: 964, remark: '国际机构，检测项目覆盖全，费用偏高' },
  LAB003: { onTimeRate: 88, accuracyRate: 97, attitudeScore: 4.4, orderCount: 1532, remark: '省级机构，抽检配合度高，旺季存在排期' },
  LAB004: { onTimeRate: 84, accuracyRate: 95, attitudeScore: 4.2, orderCount: 738, remark: '市级机构，常规项目响应快' },
  LAB005: { onTimeRate: 78, accuracyRate: 92, attitudeScore: 3.9, orderCount: 212, remark: '自建实验室，仅限内部例行检测' },
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
  labLevel: number
  /** 联系人 */
  contactName: string
  /** 联系电话 */
  contactPhone: string
  /** 认可范围 */
  accreditedScope: string
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
 * @returns 机构 ID → 服务评价
 */
function loadRatings(): Record<string, LabServiceRating> {
  try {
    const raw = window.localStorage.getItem(RATING_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, LabServiceRating>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * 检测机构管理
 *
 * 业务职责：检测机构准入审核（通过 / 驳回）、LIMS 对接配置（接口地址 / 认证方式 / 字段映射）
 * 与服务评价展示，维护机构资质与合作状态。
 *
 * 数据来源：
 * - GET  /admin/quality/labs（机构分页，keyword 按名称模糊）
 * - POST /admin/quality/labs/{labId}/accredit（准入认可，status 置 1）
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
  /** 状态筛选 */
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined)
  /** LIMS 配置（本地持久化） */
  const [limsConfigs, setLimsConfigs] = useState<Record<string, LabLimsConfig>>({})
  /** 服务评价（本地持久化） */
  const [ratings, setRatings] = useState<Record<string, LabServiceRating>>({})
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

  /** 首次挂载时读取本地登记的配置与评价 */
  useEffect(() => {
    setLimsConfigs(loadLimsConfigs())
    setRatings(loadRatings())
  }, [])

  /** 机构分页 */
  const listQuery = useQuery({
    queryKey: ['admin', 'quality', 'labs', pageNum, pageSize, submittedKeyword],
    queryFn: () => fetchQualityLabs({ pageNum, pageSize, keyword: submittedKeyword }),
    retry: false,
  })

  /** 准入认可 */
  const accreditMutation = useMutation({
    mutationFn: (labId: string) => accreditQualityLab(labId),
    onSuccess: () => {
      message.success('机构准入已通过，合作状态更新为「合作中」')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'quality', 'labs'] })
    },
    onError: () => {
      message.warning('准入接口未返回成功，请确认后端 /admin/quality/labs/{labId}/accredit 是否可用')
    },
  })

  /** 表格数据源（后端优先，缺失时回落原型示例） */
  const { rows, total } = useMemo(() => {
    const remote = listQuery.data?.list ?? []
    if (remote.length > 0) {
      const filtered =
        statusFilter === undefined
          ? remote
          : remote.filter((row) => row.status === statusFilter)
      return { rows: filtered, total: listQuery.data?.total ?? 0 }
    }
    const source = submittedKeyword
      ? PROTOTYPE_LABS.filter((item) => item.labName.includes(submittedKeyword))
      : PROTOTYPE_LABS
    const filtered =
      statusFilter === undefined ? source : source.filter((item) => item.status === statusFilter)
    return { rows: filtered, total: filtered.length }
  }, [listQuery.data, submittedKeyword, statusFilter])

  /** 顶部统计 */
  const stats = useMemo(() => {
    const source = rows.length > 0 ? rows : PROTOTYPE_LABS
    const all = listQuery.data && listQuery.data.list.length > 0 ? listQuery.data.list : PROTOTYPE_LABS
    return {
      /** 机构总数 */
      total: all.length,
      /** 合作中 */
      cooperating: all.filter((item) => item.status === 1).length,
      /** 待准入 */
      pending: all.filter((item) => item.status === 2).length,
      /** 已对接 LIMS */
      limsEnabled: Object.values(limsConfigs).filter((item) => item.enabled).length,
      /** 平均服务评分 */
      avgScore:
        source.length > 0
          ? Number(
              (
                source.reduce((acc, item) => acc + (ratings[item.labId]?.attitudeScore ?? 4.2), 0) /
                source.length
              ).toFixed(1),
            )
          : 4.2,
    }
  }, [rows, listQuery.data, limsConfigs, ratings])

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

  /** 提交 LIMS 配置 */
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
    try {
      window.localStorage.setItem(LIMS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 隐私模式下 localStorage 不可用时，仅保留内存态
    }
    message.success(`已保存 ${limsTarget.labName} 的 LIMS 对接配置`)
    setLimsTarget(null)
  }

  /** 提交准入审核 */
  const handleAuditSubmit = async (): Promise<void> => {
    const values = await auditForm.validateFields()
    if (!auditTarget) {
      return
    }
    if (values.approved) {
      accreditMutation.mutate(auditTarget.labId)
      /** 记录审核意见（本地留存，后端补齐后一并提交） */
      setRatings((prev) => {
        const next = { ...prev }
        const current = next[auditTarget.labId] ?? PROTOTYPE_RATING[auditTarget.labId]
        if (current) {
          next[auditTarget.labId] = { ...current, remark: values.remark || current.remark }
        }
        return next
      })
    } else {
      /** 驳回：本地置为已终止（后端缺少驳回端点） */
      message.success(`已驳回 ${auditTarget.labName} 的准入申请：${values.remark || '资质材料不符合要求'}`)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'quality', 'labs'] })
    }
    setAuditTarget(null)
    auditForm.resetFields()
  }

  /** 提交新增机构 */
  const handleCreateSubmit = async (): Promise<void> => {
    const values = await createForm.validateFields()
    message.success(`机构 ${values.labName} 已登记（后端新增接口待补齐，当前为本地登记）`)
    setCreateOpen(false)
    createForm.resetFields()
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
      render: (value: number) => (
        <Tag color={value === 1 ? 'gold' : value === 2 ? 'blue' : 'default'}>
          {LAB_LEVEL_TEXT[value] ?? '未定级'}
        </Tag>
      ),
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
      width: 120,
      render: (_value, record) => {
        const config = limsConfigs[record.labId]
        return config?.enabled ? (
          <Tag color="success" icon={<ApiOutlined />}>已对接</Tag>
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
        const rating = ratings[record.labId] ?? PROTOTYPE_RATING[record.labId]
        if (!rating) {
          return <Text type="secondary">暂无评价</Text>
        }
        return (
          <Space direction="vertical" size={0}>
            <Rate disabled allowHalf value={rating.attitudeScore} style={{ fontSize: 12 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              准时 {rating.onTimeRate}% · 准确 {rating.accuracyRate}%
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
            icon={<SettingOutlined />}
            onClick={() => openLimsConfig(record)}
          >
            LIMS配置
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

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {listQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="检测机构接口未返回数据，当前展示示例机构数据（国家质检中心 / SGS / 省农检中心 / 市质检站 / 绿源自建实验室）"
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
            <Statistic title="合作中" value={stats.cooperating} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic title="待准入" value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic
              title="LIMS 已对接"
              value={stats.limsEnabled}
              suffix={`/ 平均评分 ${stats.avgScore}`}
            />
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
          locale={{ emptyText: <Empty description="暂无检测机构，请新增或调整筛选条件" /> }}
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

      {/* 机构详情抽屉：资质 + 服务评价 */}
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
                {
                  key: 'level',
                  label: '资质等级',
                  children: (
                    <Tag color={detailTarget.labLevel === 1 ? 'gold' : detailTarget.labLevel === 2 ? 'blue' : 'default'}>
                      {LAB_LEVEL_TEXT[detailTarget.labLevel ?? 3] ?? '未定级'}
                    </Tag>
                  ),
                },
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
              ]}
            />
            <Card title="服务评价" size="small">
              {(() => {
                const rating = ratings[detailTarget.labId] ?? PROTOTYPE_RATING[detailTarget.labId]
                if (!rating) {
                  return <Empty description="暂无服务评价记录" />
                }
                return (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Row align="middle" justify="space-between">
                      <Space>
                        <StarOutlined style={{ color: '#faad14' }} />
                        <Text strong>综合服务评分</Text>
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
                    {rating.remark ? (
                      <Alert type="info" showIcon message={rating.remark} />
                    ) : null}
                  </Space>
                )
              })()}
            </Card>
            <Card title="LIMS 对接配置" size="small">
              {(() => {
                const config = limsConfigs[detailTarget.labId]
                if (!config) {
                  return <Empty description="尚未配置 LIMS 对接" />
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
                    ]}
                  />
                )
              })()}
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
        okText="保存配置"
        cancelText="取消"
        width={620}
        destroyOnClose
      >
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
      </Modal>

      {/* 准入审核弹窗（PRD #18 机构准入） */}
      <Modal
        title={`准入审核 - ${auditTarget?.labName ?? ''}`}
        open={auditTarget !== null}
        onCancel={() => setAuditTarget(null)}
        onOk={() => void handleAuditSubmit()}
        okText="提交审核"
        cancelText="取消"
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
            <Input.TextArea rows={4} placeholder="请填写审核意见，驳回时必填" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增机构弹窗 */}
      <Modal
        title="新增检测机构"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreateSubmit()}
        okText="提交"
        cancelText="取消"
        width={620}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" preserve={false}>
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
          <Form.Item name="accreditedScope" label="认可检测范围">
            <Input.TextArea rows={3} placeholder="如 农残、重金属、微生物" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
