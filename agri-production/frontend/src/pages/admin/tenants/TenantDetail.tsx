/**
 * 页面名称：租户详情
 * 路由路径：/admin/production/tenants/:tenantId
 * 所属模块：租户管理
 * PRD 序号：PRD 6.2 #5
 * 原型来源：P3 tenant-detail — 租户详情（基本信息 / 农场列表 / 配额详情 / 操作日志）
 *
 * ⚠️ 契约错位（2026-10-10 实测，后端 8096）：
 * 后端 AdminTenantController 没有租户主表，租户以**配额记录**为载体，
 * GET /admin/tenants/{id} 返回 TenantQuotaEntity，实测键为
 *   marketId, tenantId, createBy, updateBy, createdAt, updatedAt, deleted, quotaId,
 *   tenantCode, tenantName, farmLimit, plotLimit, deviceLimit, userLimit,
 *   storageLimitGb, traceCodeLimit, apiCallLimit, usedFarmCount, status
 * 因此 PRD 原型里的「统一社会信用代码 / 法定代表人 / 注册地址 / 经营范围 / 所属区域 /
 * 联系人 / 联系电话 / 到期时间 / 租户等级 / 成员数量 / 在田面积 / 活跃度」**后端均无此列**。
 *
 * 此前本页用 FALLBACK_TENANT 原型档案（张三 / 138****5678 / 河南省郑州市 / 91410100MA45XXXX /
 * 在田面积 12500 / 配额使用率 96.4 …）与后端返回值合并，后端没给的字段全部由原型补位，
 * 页面看上去档案完整，实际每一个补位值都是编造的。现按项目铁律改为「—」+ 提示。
 *
 * 另：GET /admin/tenants/{id}/farms 与 /admin/tenants/{id}/logs **端点不存在**
 * （实测 HTTP 200 / code=500，源码 AdminTenantController 无对应映射；
 * 注意不是路径漏 production 段——带段实测同样是 500，而带段的已存在端点返回 code=0）。
 * 此前农场列表回落 5 条原型农场、日志回落按页码生成的示例日志并把总数写死 2456，
 * 现改为空态 + 显式说明端点缺失。
 *
 * 真实可用的补充数据源：GET /admin/tenants/overview/{tenantId}（入参为 Long，
 * 只能用详情里的 tenantId，传 quotaId 返回 400）返回 farmCount / plotCount /
 * deviceCount / farmUsageRate 等真实聚合值，本页用它填「农场数量 / 设备数量 / 配额使用率」。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  InfoCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { MetricNumber } from '@/components'
import type {
  OpsQuotaItem,
  TenantFarmItem,
  TenantOperationLog,
  TenantStatus,
} from '@/types'
import {
  getTenant,
  getTenantOverviewById,
  getTenantQuotaOverview,
  listTenantFarms,
  listTenantOperationLogs,
  resetTenantQuotaUsage,
  updateTenant,
  updateTenantQuotaLimits,
} from '@/api/admin/tenants'
import type { OpsTenantRow } from '@/api/admin/tenants'

const { Text, Title } = Typography

/** 状态 → 文案（对齐后端 TenantQuotaEntity.status：1 正常 / 0 停用） */
const STATUS_TEXT: Record<number, string> = {
  1: '正常',
  0: '停用',
}

/** 状态 → 颜色 */
const STATUS_COLOR: Record<string, string> = {
  正常: 'green',
  停用: 'default',
}

/**
 * 配额预警阈值（%），与后端 TenantQuotaService.WARNING_THRESHOLD 保持一致。
 * 后端「配额预警」按此阈值判定，前端标红口径必须同步，否则会出现两处口径打架。
 */
const WARNING_THRESHOLD = 80

/** 后端标记「有真实用量数据源」的取值（OpsQuotaItem.SOURCE_COLUMN） */
const QUOTA_SOURCE_COLUMN = 'COLUMN'

/** 无用量数据源时的提示文案（存储 / API 调用：后端完全没有用量数据源） */
const NO_SOURCE_TIP = '后端暂无该维度的用量数据源，无法统计，故不展示用量与使用率'

/**
 * 溯源码维度的提示文案。
 *
 * 后端确实有溯源码统计端点（/trace/codes/stats），但生产域 prod_trace_code 等表
 * tenant_id 全为 0，只有平台口径、没有租户维度，因此不能按租户（本租户）展示用量。
 */
const NO_SOURCE_TIP_TRACE =
  '后端仅有平台口径的溯源码统计（/trace/codes/stats），无租户维度；不能按租户展示用量，故显示「—」'

/** 后端无此列的档案字段统一提示 */
const NO_COLUMN_TIP =
  '后端 TenantQuotaEntity（库内以配额记录承载租户）无此列，显示为「—」，后端补齐字段后自动填充'

/** 无聚合数据源的统计字段提示 */
const NO_STAT_TIP = '后端未提供该租户此统计项的数据源，显示为「—」，接口补齐后自动填充'

/** 农场 / 日志端点缺失说明 */
const FARMS_ENDPOINT_TIP =
  '后端 AdminTenantController 无 GET /admin/tenants/{id}/farms 映射（实测 code=500，端点不存在），已列入后端缺口批次'

/** 日志端点缺失说明 */
const LOGS_ENDPOINT_TIP =
  '后端 AdminTenantController 无 GET /admin/tenants/{id}/logs 映射（实测 code=500，端点不存在），已列入后端缺口批次'

/** 配额调整表单 */
interface QuotaFormValues {
  farmLimit: number
  traceCodeLimit: number
  storageLimit: number
  apiLimit: number
}

/** 租户编辑表单（仅后端真实存在的字段） */
interface TenantFormValues {
  tenantName: string
}

/**
 * 缺失值文本（带可见提示图标）。
 *
 * 不渲染 0、不渲染空白：0 是一个结论（"统计过了，结果是 0"），
 * 空白让用户分不清「没数」还是「出错」。
 *
 * @param props tip 悬浮说明
 * @returns 「—」+ 橙色信息图标
 */
function MissingText({ tip }: { tip: string }): JSX.Element {
  return (
    <Tooltip title={tip}>
      <Text type="secondary" style={{ cursor: 'help' }}>
        —<InfoCircleOutlined style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }} />
      </Text>
    </Tooltip>
  )
}

/**
 * 按小数位格式化数字（千分位）。
 *
 * @param value 待格式化的数字
 * @param precision 小数位
 * @returns 格式化后的字符串
 */
function formatNumber(value: number, precision: number): string {
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })
}

/**
 * 租户展示名：后端未提供租户名称时兜底展示租户编号 / 标识，避免出现空白。
 *
 * @param tenant 后端配额记录
 * @returns 用于展示的租户标识
 */
function resolveTenantName(tenant: OpsTenantRow | null, tenantId: string): string {
  const name = tenant?.tenantName?.trim()
  if (name) {
    return name
  }
  return tenant?.tenantCode?.trim() || tenantId
}

/**
 * 租户详情
 *
 * 业务职责：展示单个租户的档案信息、下属农场、配额使用情况与操作日志，
 * 支持编辑租户、停用 / 启用与配额调整。
 *
 * @returns 页面内容
 */
export default function TenantDetail(): JSX.Element {
  const { tenantId = '' } = useParams<{ tenantId: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 当前 Tab */
  const [activeTab, setActiveTab] = useState<string>('basic')
  /** 编辑弹窗 */
  const [editOpen, setEditOpen] = useState<boolean>(false)
  /** 配额调整弹窗 */
  const [quotaOpen, setQuotaOpen] = useState<boolean>(false)
  /** 编辑表单实例 */
  const [editForm] = Form.useForm<TenantFormValues>()
  /** 配额表单实例 */
  const [quotaForm] = Form.useForm<QuotaFormValues>()
  /** 农场分页 */
  const [farmPage, setFarmPage] = useState<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: 10 })
  /** 日志分页 */
  const [logPage, setLogPage] = useState<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: 10 })

  /** 租户档案（后端 TenantQuotaEntity，无数据就是 null，不用原型档案补位） */
  const tenantQuery = useQuery({
    queryKey: ['admin', 'tenants', tenantId],
    queryFn: () => getTenant(tenantId),
    retry: false,
    enabled: tenantId !== '',
  })

  /** 后端真实档案 */
  const tenant: OpsTenantRow | null = tenantQuery.data ?? null

  /**
   * 单租户概览（真实聚合值）。
   *
   * 入参必须是 Long（详情里的 tenantId），传 quotaId 后端返回 400，故用正则先判纯数字。
   */
  const numericTenantId: string = tenant?.tenantId ?? ''
  const overviewQuery = useQuery({
    queryKey: ['admin', 'tenants', 'overview-of', numericTenantId],
    queryFn: () => getTenantOverviewById(numericTenantId),
    retry: false,
    enabled: numericTenantId !== '' && /^\d+$/.test(numericTenantId),
  })
  const overview = overviewQuery.data ?? null

  /** 农场列表（端点不存在，失败即空态） */
  const farmsQuery = useQuery({
    queryKey: ['admin', 'tenants', tenantId, 'farms', farmPage],
    queryFn: () => listTenantFarms(tenantId, farmPage),
    retry: false,
    enabled: tenantId !== '' && activeTab === 'farms',
  })

  /** 配额概览 */
  const quotasQuery = useQuery({
    queryKey: ['admin', 'tenants', tenantId, 'quotas'],
    queryFn: () => getTenantQuotaOverview(tenantId),
    retry: false,
    enabled: tenantId !== '' && activeTab === 'quotas',
  })

  /** 操作日志（端点不存在，失败即空态） */
  const logsQuery = useQuery({
    queryKey: ['admin', 'tenants', tenantId, 'logs', logPage],
    queryFn: () => listTenantOperationLogs(tenantId, logPage),
    retry: false,
    enabled: tenantId !== '' && activeTab === 'logs',
  })

  /** 打开编辑弹窗时回填表单（只回填后端真实字段） */
  useEffect(() => {
    if (editOpen) {
      editForm.setFieldsValue({ tenantName: tenant?.tenantName ?? '' })
    }
  }, [editOpen, editForm, tenant])

  /**
   * 打开配额弹窗时回填当前配额上限。
   *
   * 只用后端返回的真实上限：后端没给就留空（由 InputNumber 的 placeholder 提示量级），
   * 不再用原型示例数字回填，避免把示例值当成该租户的真实配额。
   */
  useEffect(() => {
    if (quotaOpen) {
      const remote = quotasQuery.data ?? []
      quotaForm.setFieldsValue({
        farmLimit: remote.find((item) => item.key === 'farm')?.limit ?? undefined,
        traceCodeLimit: remote.find((item) => item.key === 'traceCode')?.limit ?? undefined,
        storageLimit: remote.find((item) => item.key === 'storage')?.limit ?? undefined,
        apiLimit: remote.find((item) => item.key === 'api')?.limit ?? undefined,
      })
    }
  }, [quotaOpen, quotaForm, quotasQuery.data])

  /** 更新租户（PUT /admin/tenants/{id}，真实端点） */
  const editMutation = useMutation({
    mutationFn: (payload: TenantFormValues) => updateTenant(tenantId, payload),
    onSuccess: () => {
      message.success('租户名称已更新')
      setEditOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] })
    },
  })

  /**
   * 停用 / 启用租户。
   *
   * 走真实端点 `PUT /admin/tenants/{id}`（请求体为 TenantQuotaEntity）。
   * 后端 **没有** `PATCH /admin/tenants/{id}/status` 映射（AdminTenantController 无此方法），
   * 此前调用它必然 500——按钮看着能用，实际一次也没生效过。
   */
  const statusMutation = useMutation({
    mutationFn: (status: TenantStatus) => updateTenant(tenantId, { status }),
    onSuccess: (_, status) => {
      message.success(status === 1 ? '租户已启用' : '租户已停用')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] })
    },
    onError: (error: Error) => {
      message.error(`状态更新失败：${error.message}`)
    },
  })

  /** 调整配额 */
  const quotaMutation = useMutation({
    mutationFn: (values: QuotaFormValues) => updateTenantQuotaLimits(tenantId, values),
    onSuccess: () => {
      message.success('配额调整已提交')
      setQuotaOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId, 'quotas'] })
    },
  })

  /**
   * 重置已用配额。
   *
   * ⚠️ 真端点 `POST /admin/tenants/{quotaId}/reset-usage` 要的是 **quotaId**，
   * 路由上的 `tenantId` 不是它要的标识（种子数据里 tenant_id 全库为 0，
   * 见 `docs/backend-tickets.md` BT-09）。取不到 quotaId 就直接失败，
   * **不拿 tenantId 冒充 quotaId**——那只会制造一次必失败的调用。
   */
  const resetMutation = useMutation({
    mutationFn: () => {
      const quotaId = tenant?.quotaId
      if (!quotaId) {
        throw new Error('未能取到配额记录 ID（quotaId），未提交重算请求')
      }
      return resetTenantQuotaUsage(quotaId)
    },
    onSuccess: () => {
      message.success('已按实际业务数据重算配额用量')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId, 'quotas'] })
    },
  })

  /** 农场列表：只使用后端返回值，端点缺失时为空（不再回落原型农场） */
  const farms: TenantFarmItem[] = useMemo<TenantFarmItem[]>(
    () => farmsQuery.data?.list ?? [],
    [farmsQuery.data],
  )

  /**
   * 配额数据：只使用后端返回值。
   *
   * 后端无数据就是空（渲染空态 + 说明），不再用原型示例配额兜底——
   * 原 FALLBACK_QUOTAS 里的 used（85000 / 6.2 / 48200）是编造的用量，
   * 展示出来会让用户以为该租户真的用了这么多。
   */
  const quotas: OpsQuotaItem[] = useMemo<OpsQuotaItem[]>(() => quotasQuery.data ?? [], [quotasQuery.data])

  /** 日志数据：只使用后端返回值，端点缺失时为空（不再生成示例日志） */
  const logs: TenantOperationLog[] = useMemo<TenantOperationLog[]>(
    () => logsQuery.data?.list ?? [],
    [logsQuery.data],
  )

  /** 农场表格列 */
  const farmColumns: ColumnsType<TenantFarmItem> = [
    { title: '农场编号', dataIndex: 'farmCode', width: 120 },
    { title: '农场名称', dataIndex: 'farmName', width: 200 },
    {
      title: '面积(亩)',
      dataIndex: 'areaMu',
      width: 110,
      sorter: (a, b) => a.areaMu - b.areaMu,
      render: (value: number) => <MetricNumber value={value} />,
    },
    {
      title: '作物',
      dataIndex: 'crops',
      render: (_dom, entity) => (entity.crops ?? []).map((item) => <Tag key={item}>{item}</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => (
        <Tag color={value === '正常' ? 'green' : value === '预警' ? 'orange' : 'red'}>{value}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_dom, entity) => (
        <Button type="link" size="small" onClick={() => navigate(`/admin/production/farms/${entity.farmId}`)}>
          查看
        </Button>
      ),
    },
  ]

  /** 日志表格列 */
  const logColumns: ColumnsType<TenantOperationLog> = [
    { title: '操作时间', dataIndex: 'operateTime', width: 180 },
    { title: '操作人', dataIndex: 'operator', width: 120 },
    {
      title: '操作类型',
      dataIndex: 'operateType',
      width: 120,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    { title: '操作详情', dataIndex: 'detail' },
    { title: 'IP地址', dataIndex: 'ipAddress', width: 140 },
  ]

  /** 状态文案（后端只有 1 正常 / 0 停用；未知值不猜，显示「—」） */
  const statusText: string | null = tenant?.status === undefined || tenant?.status === null
    ? null
    : (STATUS_TEXT[tenant.status] ?? null)

  return (
    <div>
      {/* 契约错位必须让用户看见：后端返回的是配额记录，不是租户档案 */}
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="后端暂无「租户档案」实体，本页按配额记录（TenantQuotaEntity）真实字段展示"
        description={
          '实测 GET /admin/tenants/{id} 只返回配额记录字段（tenantCode / tenantName / 七项配额上限 / ' +
          'usedFarmCount / status / 时间列）。原型档案里的联系人、联系电话、所属区域、统一社会信用代码、' +
          '法定代表人、注册地址、经营范围、到期时间、租户等级、成员数量、在田面积、活跃度后端均无此列，' +
          '统一显示「—」（此前用原型示例值补位，属编造）。农场数量 / 设备数量 / 配额使用率取自真实端点 ' +
          'GET /admin/tenants/overview/{tenantId}。'
        }
      />

      {/* 顶部操作栏 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/production/tenants')}>
              返回租户列表
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              租户详情
            </Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
              编辑
            </Button>
            {tenant?.status === 1 ? (
              <Popconfirm
                title="确认停用该租户？"
                okText="停用"
                cancelText="取消"
                onConfirm={() => statusMutation.mutate(0)}
              >
                <Button danger icon={<StopOutlined />} loading={statusMutation.isPending}>
                  停用
                </Button>
              </Popconfirm>
            ) : (
              <Popconfirm
                title="确认启用该租户？"
                okText="启用"
                cancelText="取消"
                onConfirm={() => statusMutation.mutate(1)}
              >
                <Button icon={<StopOutlined />} loading={statusMutation.isPending}>
                  启用
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Col>
      </Row>

      {/* 租户头卡 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        {tenantQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (
          <Row gutter={[16, 12]}>
            <Col xs={24} md={8}>
              <Space size={8}>
                <span style={{ fontSize: 26 }}>🏢</span>
                <div>
                  <div>
                    <Text strong style={{ fontSize: 18 }}>
                      {resolveTenantName(tenant, tenantId)}
                    </Text>
                  </div>
                  <Text type="secondary">租户编号：{tenant?.tenantCode ?? '—'}</Text>
                </div>
              </Space>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">等级</Text>
              <div>
                <MissingText tip="后端 TenantQuotaEntity 无租户等级列（tenantLevel），显示为「—」" />
              </div>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">状态</Text>
              <div>
                {statusText ? (
                  <Tag color={STATUS_COLOR[statusText] ?? 'default'}>{statusText}</Tag>
                ) : (
                  <MissingText tip={NO_COLUMN_TIP} />
                )}
              </div>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">联系人</Text>
              <div>
                <MissingText tip={NO_COLUMN_TIP} />
              </div>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">联系电话</Text>
              <div>
                <MissingText tip={NO_COLUMN_TIP} />
              </div>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">注册时间</Text>
              <div>
                <Text>{String(tenant?.createdAt ?? '').slice(0, 10) || '—'}</Text>
              </div>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">到期时间</Text>
              <div>
                <MissingText tip={NO_COLUMN_TIP} />
              </div>
            </Col>
          </Row>
        )}
      </Card>

      {/* 四个 Tab（原型 P3） */}
      <Card size="small">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: (
                <Descriptions
                  bordered
                  size="small"
                  column={{ xs: 1, sm: 2, md: 3 }}
                  items={[
                    { key: 'name', label: '企业名称', children: resolveTenantName(tenant, tenantId) },
                    { key: 'code', label: '租户编号', children: tenant?.tenantCode ?? '—' },
                    {
                      key: 'quotaId',
                      label: '配额记录号',
                      children: tenant?.quotaId ?? '—',
                    },
                    { key: 'credit', label: '统一社会信用代码', children: <MissingText tip={NO_COLUMN_TIP} /> },
                    { key: 'legal', label: '法定代表人', children: <MissingText tip={NO_COLUMN_TIP} /> },
                    { key: 'address', label: '注册地址', children: <MissingText tip={NO_COLUMN_TIP} /> },
                    { key: 'scope', label: '经营范围', children: <MissingText tip={NO_COLUMN_TIP} />, span: { xs: 1, sm: 2, md: 3 } },
                    { key: 'region', label: '所属区域', children: <MissingText tip={NO_COLUMN_TIP} /> },
                    {
                      key: 'farm',
                      label: '农场数量',
                      children: (
                        <MetricNumber value={overview?.farmCount} suffix=" 个" missingTip={NO_STAT_TIP} />
                      ),
                    },
                    { key: 'member', label: '成员数量', children: <MissingText tip={NO_STAT_TIP} /> },
                    {
                      key: 'device',
                      label: '设备数量',
                      children: (
                        <MetricNumber value={overview?.deviceCount} suffix=" 台" missingTip={NO_STAT_TIP} />
                      ),
                    },
                    { key: 'area', label: '在田面积', children: <MissingText tip={NO_STAT_TIP} /> },
                    { key: 'activity', label: '活跃度', children: <MissingText tip={NO_STAT_TIP} /> },
                    {
                      key: 'usage',
                      label: '农场配额使用率',
                      children: (
                        <MetricNumber value={overview?.farmUsageRate} precision={0} suffix="%" missingTip={NO_STAT_TIP} />
                      ),
                    },
                    /* ---- 以下为后端 TenantQuotaEntity 真实字段 ---- */
                    {
                      key: 'farmLimit',
                      label: '农场数上限',
                      children: <MetricNumber value={tenant?.farmLimit} suffix=" 个" missingTip={NO_COLUMN_TIP} />,
                    },
                    {
                      key: 'plotLimit',
                      label: '地块数上限',
                      children: <MetricNumber value={tenant?.plotLimit} suffix=" 个" missingTip={NO_COLUMN_TIP} />,
                    },
                    {
                      key: 'deviceLimit',
                      label: '设备数上限',
                      children: <MetricNumber value={tenant?.deviceLimit} suffix=" 台" missingTip={NO_COLUMN_TIP} />,
                    },
                    {
                      key: 'userLimit',
                      label: '用户数上限',
                      children: <MetricNumber value={tenant?.userLimit} suffix=" 人" missingTip={NO_COLUMN_TIP} />,
                    },
                    {
                      key: 'storageLimit',
                      label: '存储空间上限',
                      children: <MetricNumber value={tenant?.storageLimitGb} suffix=" GB" missingTip={NO_COLUMN_TIP} />,
                    },
                    {
                      key: 'traceLimit',
                      label: '溯源码上限',
                      children: <MetricNumber value={tenant?.traceCodeLimit} suffix=" 枚" missingTip={NO_COLUMN_TIP} />,
                    },
                    {
                      key: 'apiLimit',
                      label: '日 API 调用上限',
                      children: <MetricNumber value={tenant?.apiCallLimit} suffix=" 次" missingTip={NO_COLUMN_TIP} />,
                    },
                    {
                      key: 'usedFarm',
                      label: '已用农场数',
                      children: <MetricNumber value={tenant?.usedFarmCount} suffix=" 个" missingTip={NO_COLUMN_TIP} />,
                    },
                    {
                      key: 'updated',
                      label: '更新时间',
                      children: String(tenant?.updatedAt ?? '').slice(0, 19) || '—',
                    },
                  ]}
                />
              ),
            },
            {
              key: 'farms',
              label: '农场列表',
              children: (
                <div>
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="后端暂无该租户的农场列表端点"
                    description={FARMS_ENDPOINT_TIP}
                  />
                  <Table<TenantFarmItem>
                    rowKey="farmId"
                    size="small"
                    loading={farmsQuery.isLoading}
                    columns={farmColumns}
                    dataSource={farms}
                    locale={{ emptyText: <Empty description="后端未返回农场数据（不使用原型示例兜底）" /> }}
                    pagination={{
                      current: farmPage.pageNum,
                      pageSize: farmPage.pageSize,
                      total: farmsQuery.data?.total ?? 0,
                      showSizeChanger: true,
                      pageSizeOptions: [10, 20, 50],
                      onChange: (page, size) => setFarmPage({ pageNum: page, pageSize: size }),
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'quotas',
              label: '配额详情',
              children: (
                <div>
                  <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                    <Text type="secondary">
                      {quotas.length > 0
                        ? '数据来源：租户配额实时用量（仅「农场数」有真实用量数据源，其余三项显示「—」）'
                        : quotasQuery.isError
                          ? `配额数据加载失败：${(quotasQuery.error as Error | null)?.message ?? '未知错误'}`
                          : '该租户暂无配额数据（后端未返回配额记录）'}
                    </Text>
                    <Space>
                      <Popconfirm
                        title="按实际业务数据重算已用配额？"
                        okText="重算"
                        cancelText="取消"
                        onConfirm={() => resetMutation.mutate()}
                      >
                        <Button size="small" loading={resetMutation.isPending}>
                          重算用量
                        </Button>
                      </Popconfirm>
                      <Button size="small" type="primary" onClick={() => setQuotaOpen(true)}>
                        调整配额
                      </Button>
                    </Space>
                  </Row>
                  {quotas.length === 0 ? (
                    <Empty
                      description={
                        quotasQuery.isError
                          ? '配额数据加载失败，未展示任何配额（不使用示例数据兜底）'
                          : '该租户暂无配额数据'
                      }
                    />
                  ) : (
                    <Row gutter={[12, 12]}>
                      {quotas.map((item) => {
                        const danger = item.usageRate >= WARNING_THRESHOLD
                        // 后端 source 非 COLUMN 时（无用量数据源），used=0 只是结构占位，
                        // 展示 0 / 进度条会让用户误以为真实用量为 0，故统一显示「—」。
                        const hasUsage = item.source === QUOTA_SOURCE_COLUMN
                        // 溯源码与存储 / API 的「没有数据」原因不同，提示文案要区分口径
                        const noSourceTip =
                          item.key === 'traceCode' ? NO_SOURCE_TIP_TRACE : NO_SOURCE_TIP
                        return (
                          <Col key={item.key} xs={24} sm={12} lg={12}>
                            <Card
                              size="small"
                              style={{ borderColor: danger ? '#ffccc7' : undefined }}
                              title={item.name}
                              extra={
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  更新于 {String(item.updatedAt ?? '').slice(0, 10)}
                                </Text>
                              }
                            >
                              {hasUsage ? (
                                <>
                                  <Progress
                                    percent={Math.min(item.usageRate, 100)}
                                    status={danger ? 'exception' : 'normal'}
                                    strokeColor={danger ? '#ff4d4f' : '#1677ff'}
                                  />
                                  <Row justify="space-between">
                                    <Text>
                                      {formatNumber(item.used, item.precision)} /{' '}
                                      {formatNumber(item.limit, item.precision)} {item.unit}
                                    </Text>
                                    <Text strong style={{ color: danger ? '#ff4d4f' : '#1677ff' }}>
                                      {item.usageRate}%
                                    </Text>
                                  </Row>
                                  {danger && (
                                    <Tooltip title="建议尽快调整配额上限">
                                      <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: 12 }}>
                                        ⚠ 即将用尽，建议尽快调整配额
                                      </div>
                                    </Tooltip>
                                  )}
                                </>
                              ) : (
                                <Tooltip title={noSourceTip}>
                                  <div>
                                    <Progress
                                      percent={0}
                                      showInfo={false}
                                      strokeColor="rgba(0,0,0,0.15)"
                                    />
                                    <Row justify="space-between">
                                      <Text type="secondary">
                                        用量：— / 上限 {formatNumber(item.limit, item.precision)}{' '}
                                        {item.unit}
                                      </Text>
                                      <Text type="secondary" style={{ fontSize: 12 }}>
                                        无用量数据源
                                      </Text>
                                    </Row>
                                  </div>
                                </Tooltip>
                              )}
                            </Card>
                          </Col>
                        )
                      })}
                    </Row>
                  )}
                </div>
              ),
            },
            {
              key: 'logs',
              label: '操作日志',
              children: (
                <div>
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="后端暂无该租户的操作日志端点"
                    description={LOGS_ENDPOINT_TIP}
                  />
                  <Table<TenantOperationLog>
                    rowKey="logId"
                    size="small"
                    loading={logsQuery.isLoading}
                    columns={logColumns}
                    dataSource={logs}
                    locale={{ emptyText: <Empty description="后端未返回操作日志（不使用示例日志兜底）" /> }}
                    pagination={{
                      current: logPage.pageNum,
                      pageSize: logPage.pageSize,
                      /** 后端未返回就用真实条数 0，不再写死原型口径的 2456 */
                      total: logsQuery.data?.total ?? logs.length,
                      showSizeChanger: true,
                      pageSizeOptions: [10, 20, 50],
                      onChange: (page, size) => setLogPage({ pageNum: page, pageSize: size }),
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 编辑租户弹窗：只保留后端 TenantQuotaEntity 真实存在的字段 */}
      <Modal
        open={editOpen}
        title="编辑租户"
        onCancel={() => setEditOpen(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={editMutation.isPending}
        destroyOnClose
        onOk={() => {
          void editForm.validateFields().then((values) => {
            if (!values.tenantName?.trim()) {
              message.warning('企业名称不能为空')
              return
            }
            editMutation.mutate(values)
          })
        }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="后端 TenantQuotaEntity 仅「租户名称」可编辑"
          description="联系人 / 联系电话 / 所属区域 / 经营范围等字段后端无对应列，提交也不会落库，因此不在本表单中提供（避免「填了没用」的假动作）。"
        />
        <Form<TenantFormValues> form={editForm} layout="vertical" preserve={false}>
          <Form.Item
            name="tenantName"
            label="企业名称"
            rules={[{ required: true, message: '请输入企业名称' }, { max: 60, message: '不超过 60 个字符' }]}
          >
            <Input placeholder="请输入企业名称" maxLength={60} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 配额调整弹窗 */}
      <Modal
        open={quotaOpen}
        title="调整配额"
        onCancel={() => setQuotaOpen(false)}
        okText="提交调整"
        cancelText="取消"
        confirmLoading={quotaMutation.isPending}
        destroyOnClose
        onOk={() => {
          void quotaForm.validateFields().then((values) => {
            quotaMutation.mutate(values)
          })
        }}
      >
        <Form<QuotaFormValues> form={quotaForm} layout="vertical" preserve={false}>
          <Form.Item
            name="farmLimit"
            label="农场数配额（个）"
            rules={[
              { required: true, message: '请输入农场数配额' },
              { type: 'number', min: 1, max: 1000, message: '取值范围 1 ~ 1000' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={1} max={1000} precision={0} placeholder="如 60" />
          </Form.Item>
          <Form.Item
            name="traceCodeLimit"
            label="溯源码配额（枚 / 月）"
            rules={[
              { required: true, message: '请输入溯源码配额' },
              { type: 'number', min: 1000, message: '不得小于 1000' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={1000} step={1000} placeholder="如 100000" />
          </Form.Item>
          <Form.Item
            name="storageLimit"
            label="存储空间配额（GB）"
            rules={[
              { required: true, message: '请输入存储空间配额' },
              { type: 'number', min: 1, message: '不得小于 1GB' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={1} max={1000} precision={0} placeholder="如 10" />
          </Form.Item>
          <Form.Item
            name="apiLimit"
            label="API 调用配额（次 / 月）"
            rules={[
              { required: true, message: '请输入 API 调用配额' },
              { type: 'number', min: 1000, message: '不得小于 1000' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={1000} step={1000} placeholder="如 50000" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
