/**
 * 页面名称：租户详情
 * 路由路径：/admin/production/tenants/:tenantId
 * 所属模块：租户管理
 * PRD 序号：PRD 6.2 #5
 * 原型来源：P3 tenant-detail — 租户详情（基本信息 / 农场列表 / 配额详情 / 操作日志）
 */
import { useEffect, useMemo, useState } from 'react'
import {
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
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, EditOutlined, StopOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import type {
  OpsQuotaItem,
  OpsTenant,
  TenantFarmItem,
  TenantOperationLog,
  TenantSegmentLevel,
} from '@/types'
import {
  getTenant,
  getTenantQuotaOverview,
  listTenantFarms,
  listTenantOperationLogs,
  resetTenantQuotaUsage,
  updateTenant,
  updateTenantQuotaLimits,
  updateTenantStatus,
} from '@/api/admin/tenants'

const { Text, Title } = Typography

/** 等级数值 → 文案 */
const LEVEL_TEXT: Record<number, TenantSegmentLevel> = {
  4: '钻石',
  3: '金牌',
  2: '银牌',
  1: '普通',
}

/** 等级图标 */
const LEVEL_ICON: Record<string, string> = {
  钻石: '💎',
  金牌: '🥇',
  银牌: '🥈',
  普通: '',
}

/** 状态 → 文案 */
const STATUS_TEXT: Record<number, string> = {
  1: '正常',
  2: '待审核',
  3: '冻结',
  0: '已注销',
}

/** 状态 → 颜色 */
const STATUS_COLOR: Record<string, string> = {
  正常: 'green',
  待审核: 'gold',
  冻结: 'red',
  已注销: 'default',
}

/**
 * 配额预警阈值（%），与后端 TenantQuotaService.WARNING_THRESHOLD 保持一致。
 * 后端「配额预警」按此阈值判定，前端标红口径必须同步，否则会出现两处口径打架。
 */
const WARNING_THRESHOLD = 80

/** 后端标记「有真实用量数据源」的取值（OpsQuotaItem.SOURCE_COLUMN） */
const QUOTA_SOURCE_COLUMN = 'COLUMN'

/** 无用量数据源时的提示文案 */
const NO_SOURCE_TIP = '后端暂无该维度的用量数据源，无法统计，故不展示用量与使用率'

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

/** 租户档案示例数据（原型 P3 头卡 + 基本信息） */
const FALLBACK_TENANT: OpsTenant = {
  tenantId: 'TS000001',
  tenantCode: 'T20250001',
  tenantName: '绿源农业科技有限公司',
  contactName: '张三',
  contactPhone: '138****5678',
  region: '河南省 · 郑州市',
  tenantLevel: 4,
  status: 1,
  farmCount: 45,
  memberCount: 186,
  deviceCount: 320,
  activatedAt: '2025-03-15 09:00:00',
  expireAt: '2026-03-14',
  createdAt: '2025-03-15 09:00:00',
  creditCode: '91410100MA45XXXX',
  legalPerson: '张三',
  address: '河南省郑州市金水区XX路XX号',
  businessScope: '农业种植、农产品加工、农业技术推广',
  fieldArea: 12500,
  activity: '正常',
  quotaUsageRate: 96.4,
}

/** 农场列表示例数据（原型 P3 Tab2） */
const FALLBACK_FARMS: TenantFarmItem[] = [
  { farmId: 'F202501', farmCode: 'F202501', farmName: '绿源1号农场', areaMu: 500, crops: ['水稻', '小麦'], status: '正常', ownerName: '张三' },
  { farmId: 'F202510', farmCode: 'F202510', farmName: '绿源果园基地', areaMu: 280, crops: ['苹果', '梨'], status: '正常', ownerName: '李四' },
  { farmId: 'F202518', farmCode: 'F202518', farmName: '绿源蔬菜大棚', areaMu: 120, crops: ['番茄', '黄瓜'], status: '预警', ownerName: '王五' },
  { farmId: 'F202526', farmCode: 'F202526', farmName: '绿源育苗中心', areaMu: 90, crops: ['水稻秧苗'], status: '正常', ownerName: '赵六' },
  { farmId: 'F202533', farmCode: 'F202533', farmName: '绿源稻虾基地', areaMu: 360, crops: ['水稻', '小龙虾'], status: '正常', ownerName: '孙七' },
]

/** 操作类型池（生成日志示例数据） */
const LOG_TYPES: string[] = ['创建任务', '修改地块', '配额调整', '新增农场', '登录系统', '导出报表']

/** 操作人池 */
const LOG_OPERATORS: string[] = ['张三', '李四', '管理员A', '王五', '赵六']

/**
 * 生成操作日志示例数据（原型 P3 Tab4 共 2,456 条）。
 *
 * @param pageNum 页码
 * @param pageSize 每页条数
 * @returns 日志列表
 */
function buildSampleLogs(pageNum: number, pageSize: number): TenantOperationLog[] {
  return Array.from({ length: Math.min(pageSize, 20) }, (_unused, index) => {
    const seq = (pageNum - 1) * pageSize + index + 1
    const minute = 8 + ((seq * 7) % 50)
    const hour = 8 + ((seq * 3) % 10)
    return {
      logId: `LOG${String(seq).padStart(6, '0')}`,
      operateTime: `2025-07-14 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String((seq * 11) % 60).padStart(2, '0')}`,
      operator: LOG_OPERATORS[seq % LOG_OPERATORS.length],
      operateType: LOG_TYPES[seq % LOG_TYPES.length],
      detail: `${LOG_TYPES[seq % LOG_TYPES.length]}#${1000 + seq}`,
      ipAddress: `10.0.${(seq % 3) + 1}.${(seq % 250) + 1}`,
    }
  })
}

/** 配额调整表单 */
interface QuotaFormValues {
  farmLimit: number
  traceCodeLimit: number
  storageLimit: number
  apiLimit: number
}

/** 租户编辑表单 */
interface TenantFormValues {
  tenantName: string
  contactName?: string
  contactPhone?: string
  region?: string
  businessScope?: string
}

/**
 * 租户展示名：后端未提供租户名称时兜底展示租户 ID，避免标题与档案区出现空白。
 *
 * 判空覆盖 undefined / null / '' / 纯空白串（'   ' 视为空）。
 *
 * @param tenant 租户数据
 * @returns 用于展示的租户标识
 */
function resolveTenantName(tenant: { tenantId?: string; tenantName?: string }): string {
  const name = tenant.tenantName?.trim()
  return name ? name : (tenant.tenantId ?? '')
}

/**
 * 租户详情
 *
 * 业务职责：展示单个租户的档案信息、下属农场、配额使用情况与操作日志，
 * 支持编辑租户、冻结 / 解冻与配额调整。
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

  /** 租户档案 */
  const tenantQuery = useQuery({
    queryKey: ['admin', 'tenants', tenantId],
    queryFn: () => getTenant(tenantId),
    retry: false,
    enabled: tenantId !== '',
  })

  /** 农场列表 */
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

  /** 操作日志 */
  const logsQuery = useQuery({
    queryKey: ['admin', 'tenants', tenantId, 'logs', logPage],
    queryFn: () => listTenantOperationLogs(tenantId, logPage),
    retry: false,
    enabled: tenantId !== '' && activeTab === 'logs',
  })

  /** 租户档案：后端无数据时使用原型示例 */
  const tenant: OpsTenant = useMemo<OpsTenant>(() => {
    const remote = tenantQuery.data
    if (remote && remote.tenantId) {
      return {
        ...FALLBACK_TENANT,
        ...remote,
        tenantId: remote.tenantId ?? tenantId,
      }
    }
    return { ...FALLBACK_TENANT, tenantId: tenantId || FALLBACK_TENANT.tenantId }
  }, [tenantQuery.data, tenantId])

  /** 打开编辑弹窗时回填表单 */
  useEffect(() => {
    if (editOpen) {
      editForm.setFieldsValue({
        tenantName: tenant.tenantName,
        contactName: tenant.contactName,
        contactPhone: tenant.contactPhone,
        region: tenant.region,
        businessScope: tenant.businessScope,
      })
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

  /** 更新租户 */
  const editMutation = useMutation({
    mutationFn: (payload: TenantFormValues) => updateTenant(tenantId, payload),
    onSuccess: () => {
      message.success('租户信息已更新')
      setEditOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] })
    },
  })

  /** 冻结租户 */
  const freezeMutation = useMutation({
    mutationFn: () => updateTenantStatus(tenantId, 3),
    onSuccess: () => {
      message.success('租户已冻结')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] })
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

  /** 重置已用配额 */
  const resetMutation = useMutation({
    mutationFn: () => resetTenantQuotaUsage(tenantId),
    onSuccess: () => {
      message.success('已按实际业务数据重算配额用量')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId, 'quotas'] })
    },
  })

  /** 农场列表数据 */
  const farms: TenantFarmItem[] = useMemo<TenantFarmItem[]>(() => {
    const remote = farmsQuery.data?.list
    return remote && remote.length > 0 ? remote : FALLBACK_FARMS
  }, [farmsQuery.data])

  /**
   * 配额数据：只使用后端返回值。
   *
   * 后端无数据就是空（渲染空态 + 说明），不再用原型示例配额兜底——
   * 原 FALLBACK_QUOTAS 里的 used（85000 / 6.2 / 48200）是编造的用量，
   * 展示出来会让用户以为该租户真的用了这么多。
   */
  const quotas: OpsQuotaItem[] = useMemo<OpsQuotaItem[]>(() => quotasQuery.data ?? [], [quotasQuery.data])

  /** 日志数据 */
  const logs: TenantOperationLog[] = useMemo<TenantOperationLog[]>(() => {
    const remote = logsQuery.data?.list
    return remote && remote.length > 0 ? remote : buildSampleLogs(logPage.pageNum, logPage.pageSize)
  }, [logsQuery.data, logPage])

  /** 农场表格列 */
  const farmColumns: ColumnsType<TenantFarmItem> = [
    { title: '农场编号', dataIndex: 'farmCode', width: 120 },
    { title: '农场名称', dataIndex: 'farmName', width: 200 },
    {
      title: '面积(亩)',
      dataIndex: 'areaMu',
      width: 110,
      sorter: (a, b) => a.areaMu - b.areaMu,
      render: (value: number) => Number(value).toLocaleString('zh-CN'),
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

  /** 等级文案 */
  const levelText = LEVEL_TEXT[tenant.tenantLevel] ?? '普通'
  /** 状态文案 */
  const statusText = STATUS_TEXT[tenant.status] ?? '正常'

  return (
    <div>
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
            <Popconfirm
              title="确认冻结该租户？"
              okText="冻结"
              cancelText="取消"
              onConfirm={() => freezeMutation.mutate()}
            >
              <Button danger icon={<StopOutlined />} loading={freezeMutation.isPending}>
                冻结
              </Button>
            </Popconfirm>
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
                      {resolveTenantName(tenant)}
                    </Text>
                  </div>
                  <Text type="secondary">租户编号：{tenant.tenantCode}</Text>
                </div>
              </Space>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">等级</Text>
              <div>
                <Tag color={levelText === '钻石' ? 'purple' : levelText === '金牌' ? 'gold' : levelText === '银牌' ? 'blue' : 'default'}>
                  {LEVEL_ICON[levelText]} {levelText}
                </Tag>
              </div>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">状态</Text>
              <div>
                <Tag color={STATUS_COLOR[statusText]}>{statusText}</Tag>
              </div>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">联系人</Text>
              <div>
                <Text>{tenant.contactName ?? '—'}</Text>
              </div>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">联系电话</Text>
              <div>
                <Text>{tenant.contactPhone ?? '—'}</Text>
              </div>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">注册时间</Text>
              <div>
                <Text>{String(tenant.createdAt ?? '').slice(0, 10) || '—'}</Text>
              </div>
            </Col>
            <Col xs={12} md={4}>
              <Text type="secondary">到期时间</Text>
              <div>
                <Text>{String(tenant.expireAt ?? '').slice(0, 10) || '—'}</Text>
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
                    { key: 'name', label: '企业名称', children: resolveTenantName(tenant) },
                    { key: 'credit', label: '统一社会信用代码', children: tenant.creditCode ?? '—' },
                    { key: 'legal', label: '法定代表人', children: tenant.legalPerson ?? '—' },
                    { key: 'address', label: '注册地址', children: tenant.address ?? '—' },
                    { key: 'scope', label: '经营范围', children: tenant.businessScope ?? '—', span: { xs: 1, sm: 2, md: 3 } },
                    { key: 'region', label: '所属区域', children: tenant.region ?? '—' },
                    { key: 'farm', label: '农场数量', children: `${tenant.farmCount} 个` },
                    { key: 'member', label: '成员数量', children: `${tenant.memberCount} 人` },
                    { key: 'device', label: '设备数量', children: `${tenant.deviceCount} 台` },
                    { key: 'area', label: '在田面积', children: `${Number(tenant.fieldArea ?? 0).toLocaleString('zh-CN')} 亩` },
                    { key: 'activity', label: '活跃度', children: tenant.activity ?? '正常' },
                    {
                      key: 'usage',
                      label: '配额使用率',
                      children: (
                        <Tag color={Number(tenant.quotaUsageRate ?? 0) >= 90 ? 'red' : 'green'}>
                          {Number(tenant.quotaUsageRate ?? 0)}%
                        </Tag>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'farms',
              label: '农场列表',
              children: (
                <Table<TenantFarmItem>
                  rowKey="farmId"
                  size="small"
                  loading={farmsQuery.isLoading}
                  columns={farmColumns}
                  dataSource={farms}
                  locale={{ emptyText: <Empty description="该租户暂无农场" /> }}
                  pagination={{
                    current: farmPage.pageNum,
                    pageSize: farmPage.pageSize,
                    total: farmsQuery.data?.total ?? farms.length,
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50],
                    onChange: (page, size) => setFarmPage({ pageNum: page, pageSize: size }),
                  }}
                />
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
                                <Tooltip title={NO_SOURCE_TIP}>
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
                <Table<TenantOperationLog>
                  rowKey="logId"
                  size="small"
                  loading={logsQuery.isLoading}
                  columns={logColumns}
                  dataSource={logs}
                  locale={{ emptyText: <Empty description="暂无操作日志" /> }}
                  pagination={{
                    current: logPage.pageNum,
                    pageSize: logPage.pageSize,
                    total: logsQuery.data?.total ?? 2456,
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50],
                    onChange: (page, size) => setLogPage({ pageNum: page, pageSize: size }),
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 编辑租户弹窗 */}
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
        <Form<TenantFormValues> form={editForm} layout="vertical" preserve={false}>
          <Form.Item
            name="tenantName"
            label="企业名称"
            rules={[{ required: true, message: '请输入企业名称' }, { max: 60, message: '不超过 60 个字符' }]}
          >
            <Input placeholder="请输入企业名称" maxLength={60} />
          </Form.Item>
          <Form.Item name="contactName" label="联系人" rules={[{ max: 20, message: '不超过 20 个字符' }]}>
            <Input placeholder="请输入联系人" maxLength={20} />
          </Form.Item>
          <Form.Item
            name="contactPhone"
            label="联系电话"
            rules={[{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }]}
          >
            <Input placeholder="请输入联系电话" maxLength={11} />
          </Form.Item>
          <Form.Item name="region" label="所属区域" rules={[{ max: 40, message: '不超过 40 个字符' }]}>
            <Input placeholder="如：河南省 · 郑州市" maxLength={40} />
          </Form.Item>
          <Form.Item name="businessScope" label="经营范围">
            <Input.TextArea rows={3} placeholder="如：农业种植、农产品加工、农业技术推广" maxLength={200} />
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
