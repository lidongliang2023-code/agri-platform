/**
 * 页面名称：主体列表
 * 路由路径：/admin/production/tenants
 * 所属模块：主体管理
 * PRD 序号：PRD 6.2 #4
 * 原型来源：P2 tenants — 主体列表
 *
 * 数据来源约定（硬规矩：不造数据源；可以降级，不能骗人）：
 * - 列表数据全部来自后端 `GET /admin/tenants`（MyBatis-Plus 分页，支持 page / size / status 三个参数）；
 *   后端不返回数据时列表就是空的，由 ProTable 渲染空态，**不使用任何本地示例数据兜底**；
 * - 顶部统计卡全部来自后端 `GET /admin/tenants/overview`（真实聚合结果）；
 * - 后端 `TenantQuotaEntity` 未提供等级 / 在田面积 / 活跃度 / 区域 / 联系人等字段，
 *   这些**没有数据源，因此不展示**（既不删除前端预算，也不填 0 或原型数字）；
 * - 列表请求失败时返回 `success: false` 并在顶部渲染 Alert 暴露后端错误，绝不静默降级。
 */
import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  ExportOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { TenantOverview } from '@/api/admin/tenants'
import { getTenantOverview, listOpsTenantRows, updateTenantQuotaLimits, updateTenantStatus } from '@/api/admin/tenants'
import type { TenantStatus } from '@/types'

const { Text } = Typography

/** 主体状态（经营主体 status：1 正常 / 0 停用） */
const STATUS_TEXT: Record<number, string> = {
  1: '正常',
  0: '停用',
}

/** 状态 → Tag 颜色 */
const STATUS_COLOR: Record<string, string> = {
  正常: 'green',
  停用: 'red',
}

/**
 * 主体列表行（经营主体主档 + 配额配置）。
 */
interface TenantRow {
  /** 经营主体 ID，也是主体 ID */
  tenantId: string
  /** 主体编码 */
  tenantCode: string
  /** 主体名称 */
  tenantName: string
  memberType: 'enterprise' | 'personal'
  industry?: string | null
  contactName?: string | null
  contactPhone?: string | null
  /** 农场数上限（未配置时为 null） */
  farmLimit: number | null
  /** 已用农场数（真实用量列 used_farm_count） */
  usedFarmCount: number
  /** 主体状态：1 正常 / 0 停用 */
  status: number
  /** 创建时间（后端可能为 null） */
  createdAt?: string | null
}

/**
 * 主体展示名：后端未提供主体名称时兜底展示主体 ID，避免出现空白列。
 *
 * 判空覆盖 undefined / null / '' / 纯空白串（'   ' 视为空）。
 *
 * @param row 含 tenantId 与 tenantName 的行数据
 * @returns 用于展示的主体标识
 */
function resolveTenantName(row: { tenantId: string; tenantName?: string }): string {
  const name = row.tenantName?.trim()
  return name ? name : row.tenantId
}

/**
 * 计算农场配额使用率（%）。
 *
 * 分子分母均为后端真实字段；分母缺失（未配置配额）时无法计算，返回 null 由调用方展示「—」，
 * 不返回 0——0 会让用户误以为「真实用量就是 0」。
 *
 * @param row 主体行
 * @returns 使用率百分比；无分母时为 null
 */
function resolveFarmUsageRate(row: TenantRow): number | null {
  const limit = row.farmLimit
  if (typeof limit !== 'number' || limit <= 0) {
    return null
  }
  const used = typeof row.usedFarmCount === 'number' ? row.usedFarmCount : 0
  return Math.round((used / limit) * 100)
}

/**
 * 安全地读取后端返回的整数型字段。
 *
 * 后端部分数值字段可能为 null，此处统一收敛为 0 / null，避免把 null 直接渲染出来。
 *
 * @param value 后端字段值
 * @returns number 或 null
 */
function toIntOrNull(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

/** 配额表单初始值（原型 P3 配额详情，仅作为调整弹窗的输入占位） */
interface QuotaFormValues {
  farmLimit: number
  traceCodeLimit: number
  storageLimit: number
  apiLimit: number
}

/**
 * 主体列表
 *
 * 业务职责：全平台 SaaS 主体台账，支持按状态筛选，
 * 并提供查看、配额调整、停用 / 启用与批量冻结能力。
 *
 * 后端 `GET /admin/tenants` 目前仅支持 page / size / status 三个参数。
 * 名称、等级、注册时间区间的筛选后端未提供，故此处不再暴露这些筛选项——
 * 暴露一个会被后端静默忽略的筛选条件，等同于向用户谎称「筛过了」。
 *
 * @returns 页面内容
 */
export default function TenantList(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 已选行 */
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  /** 已选行对象 */
  const [selectedRows, setSelectedRows] = useState<TenantRow[]>([])
  /** 表格刷新标识（配合 mutations 触发重新拉取） */
  const [tableKey, setTableKey] = useState<number>(0)
  /** 配额调整弹窗的目标主体 */
  const [quotaTarget, setQuotaTarget] = useState<TenantRow | null>(null)
  /** 配额表单 */
  const [quotaForm] = Form.useForm<QuotaFormValues>()
  /** 列表加载失败原因；非空时顶部显式告警，绝不静默降级为本地数据 */
  const [loadError, setLoadError] = useState<string>('')
  /** 后端主体概览（统计卡数据；null 表示尚未取到，展示「—」而不是 0） */
  const [overview, setOverview] = useState<TenantOverview | null>(null)

  /** 停用 / 启用主体（后端无 PATCH /{id}/status，走 PUT /admin/tenants/{id} 局部更新） */
  const statusMutation = useMutation({
    mutationFn: (payload: { tenantId: string; status: TenantStatus }) =>
      updateTenantStatus(payload.tenantId, payload.status),
    onSuccess: (_data, variables) => {
      message.success(variables.status === 1 ? '主体已启用' : '主体已停用')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      setTableKey((prev) => prev + 1)
    },
  })

  /** 调整配额 */
  const quotaMutation = useMutation({
    mutationFn: (payload: { tenantId: string; values: QuotaFormValues }) =>
      updateTenantQuotaLimits(payload.tenantId, {
        farmLimit: payload.values.farmLimit,
        traceCodeLimit: payload.values.traceCodeLimit,
        storageLimit: payload.values.storageLimit,
        apiLimit: payload.values.apiLimit,
      }),
    onSuccess: () => {
      message.success('配额调整已提交')
      setQuotaTarget(null)
      setTableKey((prev) => prev + 1)
    },
  })

  /** 顶部统计卡：全部取自后端 /admin/tenants/overview 真实聚合值，无虚构数字 */
  const stats = useMemo<
    Array<{ key: string; title: string; value: number | null; color: string }>
  >(
    () => [
      { key: 'total', title: '主体总数', value: overview?.tenantTotal ?? null, color: '#1677ff' },
      { key: 'active', title: '活跃主体', value: overview?.activeTenantCount ?? null, color: '#52c41a' },
      { key: 'disabled', title: '停用主体', value: overview?.disabledTenantCount ?? null, color: '#ff4d4f' },
      {
        key: 'unregistered',
        title: '未登记配额',
        value: overview?.unregisteredTenantCount ?? null,
        color: '#faad14',
      },
    ],
    [overview],
  )

  /** 表格列（仅展示后端真实返回的字段） */
  const columns: ProColumns<TenantRow>[] = [
    {
      title: '主体编号',
      dataIndex: 'tenantCode',
      width: 140,
      hideInSearch: true,
      copyable: true,
      render: (_dom, entity) => entity.tenantCode ?? '—',
    },
    {
      title: '主体名称',
      dataIndex: 'tenantName',
      width: 220,
      ellipsis: true,
      hideInSearch: true,
      render: (_dom, entity) => <span>{resolveTenantName(entity)}</span>,
    },
    {
      title: '主体类型',
      dataIndex: 'memberType',
      width: 110,
      valueType: 'select',
      valueEnum: {
        enterprise: { text: '企业主体' },
        personal: { text: '个人主体' },
      },
      render: (_dom, entity) => (
        <Tag color={entity.memberType === 'personal' ? 'blue' : 'green'}>
          {entity.memberType === 'personal' ? '个人主体' : '企业主体'}
        </Tag>
      ),
    },
    {
      title: '联系人',
      dataIndex: 'contactName',
      width: 130,
      hideInSearch: true,
      render: (_dom, entity) => entity.contactName || '—',
    },
    {
      title: '联系电话',
      dataIndex: 'contactPhone',
      width: 140,
      hideInSearch: true,
      render: (_dom, entity) => entity.contactPhone || '—',
    },
    {
      title: '已用农场数',
      dataIndex: 'usedFarmCount',
      width: 110,
      hideInSearch: true,
      render: (_dom, entity) => String(entity.usedFarmCount ?? 0),
    },
    {
      title: '农场配额使用率',
      dataIndex: 'farmUsageRate',
      width: 170,
      hideInSearch: true,
      render: (_dom, entity) => {
        const rate = resolveFarmUsageRate(entity)
        if (rate === null) {
          return (
            <Text type="secondary">—（后端未配置农场数上限，无法计算）</Text>
          )
        }
        const danger = rate >= 80
        return (
          <Progress
            percent={Math.min(rate, 100)}
            size="small"
            status={danger ? 'exception' : 'normal'}
            strokeColor={danger ? '#ff4d4f' : undefined}
            format={() => <span style={{ color: danger ? '#ff4d4f' : undefined }}>{rate}%</span>}
          />
        )
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 170,
      hideInSearch: true,
      render: (_dom, entity) => String(entity.createdAt ?? '').replace('T', ' ').slice(0, 19) || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        1: { text: '正常' },
        0: { text: '停用' },
      },
      render: (_dom, entity) => {
        const text = STATUS_TEXT[entity.status] ?? '未知'
        return <Tag color={STATUS_COLOR[text] ?? 'default'}>{text}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 210,
      fixed: 'right',
      hideInSearch: true,
      render: (_dom, entity) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => navigate(`/admin/production/subjects/${entity.tenantId}`)}>
            查看
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setQuotaTarget(entity)
              quotaForm.setFieldsValue({
                farmLimit: toIntOrNull(entity.farmLimit) ?? undefined,
              })
            }}
          >
            配额调整
          </Button>
          {entity.status === 0 ? (
            <Popconfirm
              title="确认启用该主体？"
              okText="启用"
              cancelText="取消"
              onConfirm={() => statusMutation.mutate({ tenantId: entity.tenantId, status: 1 })}
            >
              <Button type="link" size="small" icon={<CheckCircleOutlined />}>
                启用
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="确认停用该主体？停用后其所有农场将禁止上报生产数据。"
              okText="停用"
              cancelText="取消"
              onConfirm={() => statusMutation.mutate({ tenantId: entity.tenantId, status: 0 })}
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                停用
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  /** 批量冻结 */
  const handleBatchFreeze = async (): Promise<void> => {
    if (selectedRows.length === 0) {
      message.warning('请先选择需要冻结的主体')
      return
    }
    await Promise.all(
      selectedRows.map((row) => updateTenantStatus(row.tenantId, 0)),
    )
    message.success(`已冻结 ${selectedRows.length} 个主体`)
    setSelectedRowKeys([])
    setSelectedRows([])
    setTableKey((prev) => prev + 1)
  }

  /** 批量导出（导出当前选中行，未选中时导出当前页） */
  const handleExport = (): void => {
    const rows = selectedRows.length > 0 ? selectedRows : []
    if (rows.length === 0) {
      message.warning('请先勾选需要导出的主体')
      return
    }
    const header = ['主体编号', '主体名称', '已用农场数', '农场配额使用率(%)', '创建时间', '状态']
    const body = rows.map((row) => [
      row.tenantCode ?? '',
      resolveTenantName(row),
      String(row.usedFarmCount ?? 0),
      String(resolveFarmUsageRate(row) ?? '—'),
      String(row.createdAt ?? '').replace('T', ' ').slice(0, 19),
      STATUS_TEXT[row.status] ?? '未知',
    ])
    const csv = [header, ...body].map((line) => line.join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `主体列表_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success(`已导出 ${rows.length} 条记录`)
  }

  return (
    <div>
      {/* 顶部统计：全部为后端真实聚合值，取不到时展示「—」 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {stats.map((item) => (
          <Col key={item.key} xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title={item.title}
                value={item.value === null ? '—' : item.value}
                valueStyle={{ color: item.color }}
                formatter={(value) =>
                  typeof value === 'number' ? Number(value).toLocaleString('zh-CN') : String(value)
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 加载失败必须让用户看见：不允许静默降级为本地示例数据 */}
      {loadError !== '' && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={`主体数据加载失败：${loadError}`}
          description="页面不会用任何本地示例数据兜底。请确认后端服务与 /admin/tenants 接口可用后重试。"
        />
      )}

      <ProTable<TenantRow>
        key={tableKey}
        rowKey="tenantId"
        size="small"
        headerTitle="主体列表"
        scroll={{ x: 1100 }}
        search={{ labelWidth: 100, defaultCollapsed: false }}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys, rows) => {
            setSelectedRowKeys(keys as string[])
            setSelectedRows(rows as TenantRow[])
          },
        }}
        toolBarRender={() => [
          <span key="selected" style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>
            已选 {selectedRowKeys.length} 项
          </span>,
          <Popconfirm
            key="freeze"
            title={`确认冻结已选 ${selectedRowKeys.length} 个主体？`}
            okText="确认冻结"
            cancelText="取消"
            onConfirm={() => void handleBatchFreeze()}
          >
            <Button danger icon={<StopOutlined />}>
              批量冻结
            </Button>
          </Popconfirm>,
          <Button key="export" icon={<ExportOutlined />} onClick={handleExport}>
            批量导出
          </Button>,
        ]}
        pagination={{
          defaultPageSize: 20,
          pageSizeOptions: [20, 50, 100],
          showSizeChanger: true,
        }}
        request={async (params) => {
          const pageNum = params.current ?? 1
          const pageSize = params.pageSize ?? 20
          try {
            const status = params.status === undefined || params.status === null || params.status === ''
              ? undefined : Number(params.status)
            const memberType = params.memberType === 'enterprise' || params.memberType === 'personal'
              ? params.memberType : undefined
            const result = await listOpsTenantRows({
              pageNum,
              pageSize,
              status: Number.isFinite(status) ? status : undefined,
              memberType,
              keyword: typeof params.tenantName === 'string' && params.tenantName.trim()
                ? params.tenantName.trim() : undefined,
            })
            setLoadError('')
            void getTenantOverview()
              .then((data) => setOverview(data))
              .catch(() => setOverview(null))

            const rows: TenantRow[] = result.list.map((item) => ({
              tenantId: String(item.tenantId),
              tenantCode: String(item.tenantCode ?? ''),
              tenantName: String(item.tenantName ?? ''),
              memberType: item.memberType === 'personal' ? 'personal' : 'enterprise',
              industry: item.industry,
              contactName: item.contactName,
              contactPhone: item.contactPhone,
              farmLimit: toIntOrNull(item.farmLimit),
              usedFarmCount: toIntOrNull(item.usedFarmCount) ?? 0,
              status: toIntOrNull(item.status) ?? 1,
              createdAt: item.createdAt,
            }))
            // 后端正常返回（哪怕 list 为空）就原样使用：空就是空，由 ProTable 渲染空态
            return { data: rows, total: result.total, success: true }
          } catch (error) {
            // 失败必须显式暴露，禁止再用本地兜底数据填充列表
            setLoadError(error instanceof Error ? error.message : String(error))
            setOverview(null)
            return { data: [], total: 0, success: false }
          }
        }}
        rowClassName={(record) =>
          (resolveFarmUsageRate(record) ?? 0) >= 80 ? 'agri-row-danger' : ''
        }
      />

      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        提示：农场配额使用率 ≥ 80% 的主体已标红，建议尽快调整配额以免影响业务。
        <br />
        数据说明：列表与统计卡均为后端真实返回值。主体主档来自企业/个人经营主体，
        主体 ID 与主体 ID 相同；配额仅作为主体附属资源配置，不再把配额记录当成主体。
      </Text>

      <Modal
        open={quotaTarget !== null}
        title={quotaTarget ? `配额调整 - ${resolveTenantName(quotaTarget)}` : '配额调整'}
        onCancel={() => setQuotaTarget(null)}
        okText="提交调整"
        cancelText="取消"
        confirmLoading={quotaMutation.isPending}
        destroyOnClose
        onOk={() => {
          void quotaForm.validateFields().then((values) => {
            if (!quotaTarget) {
              return
            }
            quotaMutation.mutate({ tenantId: quotaTarget.tenantId, values })
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
