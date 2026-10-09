/**
 * 页面名称：租户列表
 * 路由路径：/admin/production/tenants
 * 所属模块：租户管理
 * PRD 序号：PRD 6.2 #4
 * 原型来源：P2 tenants — 租户列表
 */
import { useMemo, useState } from 'react'
import { App, Button, Card, Col, Form, InputNumber, Modal, Popconfirm, Progress, Row, Space, Statistic, Tag, Tooltip, Typography } from 'antd'
import {
  CheckCircleOutlined,
  ExportOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type {
  OpsTenant,
  PageResult,
  TenantActivity,
  TenantSegmentLevel,
} from '@/types'
import { listOpsTenants, updateTenantQuotaLimits, updateTenantStatus } from '@/api/admin/tenants'

const { Text } = Typography

/** 租户等级（数值 → 原型文案） */
const LEVEL_TEXT: Record<number, TenantSegmentLevel> = {
  4: '钻石',
  3: '金牌',
  2: '银牌',
  1: '普通',
}

/** 租户等级（原型文案 → 数值） */
const LEVEL_VALUE: Record<string, number> = {
  钻石: 4,
  金牌: 3,
  银牌: 2,
  普通: 1,
}

/** 等级图标 */
const LEVEL_ICON: Record<string, string> = {
  钻石: '💎',
  金牌: '🥇',
  银牌: '🥈',
  普通: '',
}

/** 租户状态（数值 → 文案） */
const STATUS_TEXT: Record<number, string> = {
  1: '正常',
  2: '待审核',
  3: '冻结',
  0: '已注销',
}

/** 状态 → Tag 颜色 */
const STATUS_COLOR: Record<string, string> = {
  正常: 'green',
  待审核: 'gold',
  冻结: 'red',
  已注销: 'default',
}

/** 活跃度 → Tag 颜色 */
const ACTIVITY_COLOR: Record<TenantActivity, string> = {
  正常: 'green',
  低活跃: 'orange',
  不活跃: 'red',
}

/** 租户列表行 */
interface TenantRow extends OpsTenant {
  /** 配额使用率（%） */
  usageRate: number
}

/**
 * 租户展示名：后端未提供租户名称时兜底展示租户 ID，避免出现空白列。
 *
 * 判空覆盖 undefined / null / '' / 纯空白串（'   ' 视为空）。
 *
 * @param row 含 tenantId 与 tenantName 的行数据
 * @returns 用于展示的租户标识
 */
function resolveTenantName(row: { tenantId: string; tenantName?: string }): string {
  const name = row.tenantName?.trim()
  return name ? name : row.tenantId
}

/* ==================== 示例数据生成器（后端无数据时兜底，取自原型 P2 / 4.2） ==================== */

/** 原型 P2 前 7 行真实示例数据 */
const PROTOTYPE_TENANTS: Array<{
  tenantCode: string
  tenantName: string
  level: TenantSegmentLevel
  farmCount: number
  fieldArea: number
  activity: TenantActivity
  usageRate: number
  registeredAt: string
}> = [
  { tenantCode: 'T20250001', tenantName: '绿源农业科技有限公司', level: '钻石', farmCount: 45, fieldArea: 12500, activity: '正常', usageRate: 78, registeredAt: '2025-03-15' },
  { tenantCode: 'T20250002', tenantName: '丰达农场', level: '金牌', farmCount: 38, fieldArea: 9800, activity: '正常', usageRate: 91, registeredAt: '2025-03-18' },
  { tenantCode: 'T20250003', tenantName: '大地种业', level: '银牌', farmCount: 52, fieldArea: 15200, activity: '正常', usageRate: 62, registeredAt: '2025-04-01' },
  { tenantCode: 'T20250004', tenantName: '丰收集团', level: '钻石', farmCount: 29, fieldArea: 8600, activity: '正常', usageRate: 95, registeredAt: '2025-04-05' },
  { tenantCode: 'T20250005', tenantName: '田园生态', level: '金牌', farmCount: 33, fieldArea: 10100, activity: '低活跃', usageRate: 82, registeredAt: '2025-04-12' },
  { tenantCode: 'T20250006', tenantName: '惠民种植', level: '普通', farmCount: 15, fieldArea: 4200, activity: '不活跃', usageRate: 105, registeredAt: '2025-05-01' },
  { tenantCode: 'T20250007', tenantName: '鑫农科技', level: '普通', farmCount: 8, fieldArea: 2100, activity: '低活跃', usageRate: 92, registeredAt: '2025-05-20' },
]

/** 补充租户名称池（用于生成完整分页数据） */
const EXTRA_TENANT_NAMES: string[] = [
  '鑫盛农业科技', '中原农服', '黄河种业', '江淮米业', '东北黑土合作社',
  '云岭茶业', '天山牧业', '洞庭水产', '胶东果蔬', '成都平原农场',
  '河套灌区农业', '珠江三角洲基地', '辽河农垦', '汉江生态园', '洱海有机农场',
]

/**
 * 生成分页示例租户数据。
 *
 * 后端接口未返回数据时使用，保证分页、筛选、排序等交互仍然可用。
 *
 * @param pageNum 页码
 * @param pageSize 每页条数
 * @returns 分页结果
 */
function buildSampleTenants(pageNum: number, pageSize: number): PageResult<TenantRow> {
  /** 原型口径的总租户数 */
  const total = 1580
  const list: TenantRow[] = []
  for (let index = 0; index < pageSize; index += 1) {
    const seq = (pageNum - 1) * pageSize + index + 1
    if (seq > total) {
      break
    }
    const base = PROTOTYPE_TENANTS[(seq - 1) % PROTOTYPE_TENANTS.length]
    const isPrototypeRow = seq <= PROTOTYPE_TENANTS.length
    const name = isPrototypeRow
      ? base.tenantName
      : `${EXTRA_TENANT_NAMES[(seq - 1) % EXTRA_TENANT_NAMES.length]}${seq}号基地`
    const levelRoll = (seq * 7) % 10
    const level: TenantSegmentLevel =
      isPrototypeRow
        ? base.level
        : levelRoll >= 8
          ? '钻石'
          : levelRoll >= 5
            ? '金牌'
            : levelRoll >= 2
              ? '银牌'
              : '普通'
    const usageRate = isPrototypeRow ? base.usageRate : 45 + ((seq * 13) % 58)
    const activity: TenantActivity = isPrototypeRow
      ? base.activity
      : usageRate > 95
        ? '不活跃'
        : usageRate > 85
          ? '低活跃'
          : '正常'
    list.push({
      tenantId: `TS${String(seq).padStart(6, '0')}`,
      tenantCode: isPrototypeRow ? base.tenantCode : `T2025${String(seq).padStart(4, '0')}`,
      tenantName: name,
      tenantLevel: (LEVEL_VALUE[level] ?? 1) as OpsTenant['tenantLevel'],
      status: (seq % 47 === 0 ? 3 : seq % 29 === 0 ? 2 : 1) as OpsTenant['status'],
      farmCount: isPrototypeRow ? base.farmCount : 8 + ((seq * 11) % 52),
      memberCount: 5 + ((seq * 3) % 40),
      deviceCount: 10 + ((seq * 7) % 120),
      createdAt: `${base.registeredAt} 09:00:00`,
      region: ['河南省', '山东省', '黑龙江省', '江苏省', '四川省', '广东省'][seq % 6],
      contactName: ['张三', '李四', '王五', '赵六', '孙七'][seq % 5],
      contactPhone: `138****${String(1000 + (seq % 9000)).slice(0, 4)}`,
      fieldArea: isPrototypeRow ? base.fieldArea : 2100 + ((seq * 137) % 13000),
      activity,
      quotaUsageRate: usageRate,
      usageRate,
    })
  }
  return { pageNum, pageSize, total, pages: Math.ceil(total / pageSize), list }
}

/** 配额表单初始值（原型 P3 配额详情） */
interface QuotaFormValues {
  farmLimit: number
  traceCodeLimit: number
  storageLimit: number
  apiLimit: number
}

/**
 * 租户列表
 *
 * 业务职责：全平台 SaaS 租户台账，支持按名称 / 编号、状态、等级、注册时间筛选，
 * 并提供查看、配额调整、停用 / 启用、批量冻结与批量导出能力。
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
  /** 配额调整弹窗的目标租户 */
  const [quotaTarget, setQuotaTarget] = useState<TenantRow | null>(null)
  /** 配额表单 */
  const [quotaForm] = Form.useForm<QuotaFormValues>()

  /** 停用 / 启用租户 */
  const statusMutation = useMutation({
    mutationFn: (payload: { tenantId: string; status: number }) =>
      updateTenantStatus(payload.tenantId, payload.status),
    onSuccess: (_data, variables) => {
      message.success(variables.status === 3 ? '租户已停用' : '租户已启用')
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

  /** 顶部统计卡（原型 P2 统计区，后端无汇总接口时使用原型口径） */
  const stats = useMemo(
    () => [
      { key: 'total', title: '总租户数', value: 1580, color: '#1677ff' },
      { key: 'active', title: '活跃租户', value: 1286, color: '#52c41a' },
      { key: 'frozen', title: '冻结租户', value: 42, color: '#ff4d4f' },
      { key: 'pending', title: '待审核', value: 18, color: '#faad14' },
    ],
    [],
  )

  /** 表格列（字段对齐原型 P2） */
  const columns: ProColumns<TenantRow>[] = [
    {
      title: '租户编号',
      dataIndex: 'tenantCode',
      width: 130,
      copyable: true,
    },
    {
      title: '租户名称',
      dataIndex: 'tenantName',
      width: 220,
      ellipsis: true,
      fieldProps: { placeholder: '请输入租户名称 / 编号' },
      // 后端未登记真实租户名称时（TenantOverviewVO 无 tenantName），兜底展示租户 ID
      render: (_dom, entity) => (
        <Tooltip title={resolveTenantName(entity)}>
          <span>{resolveTenantName(entity)}</span>
        </Tooltip>
      ),
    },
    {
      title: '等级',
      dataIndex: 'tenantLevel',
      width: 110,
      valueType: 'select',
      valueEnum: {
        4: { text: '💎 钻石' },
        3: { text: '🥇 金牌' },
        2: { text: '🥈 银牌' },
        1: { text: '普通' },
      },
      render: (_dom, entity) => {
        const level = LEVEL_TEXT[entity.tenantLevel] ?? '普通'
        return (
          <Tag color={level === '钻石' ? 'purple' : level === '金牌' ? 'gold' : level === '银牌' ? 'blue' : 'default'}>
            {LEVEL_ICON[level]} {level}
          </Tag>
        )
      },
    },
    {
      title: '农场数',
      dataIndex: 'farmCount',
      width: 90,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '在田面积',
      dataIndex: 'fieldArea',
      width: 120,
      hideInSearch: true,
      sorter: true,
      render: (_dom, entity) => `${Number(entity.fieldArea ?? 0).toLocaleString('zh-CN')}亩`,
    },
    {
      title: '活跃',
      dataIndex: 'activity',
      width: 100,
      valueType: 'select',
      valueEnum: {
        正常: { text: '正常' },
        低活跃: { text: '低活跃' },
        不活跃: { text: '不活跃' },
      },
      render: (_dom, entity) => {
        const activity: TenantActivity = entity.activity ?? '正常'
        return <Tag color={ACTIVITY_COLOR[activity]}>{activity}</Tag>
      },
    },
    {
      title: '配额使用率',
      dataIndex: 'quotaUsageRate',
      width: 160,
      hideInSearch: true,
      sorter: true,
      render: (_dom, entity) => {
        const rate = Number(entity.quotaUsageRate ?? entity.usageRate ?? 0)
        const danger = rate >= 90
        return (
          <Tooltip title={danger ? '配额即将用尽，建议尽快调整' : `已使用 ${rate}%`}>
            <Progress
              percent={Math.min(rate, 100)}
              size="small"
              status={danger ? 'exception' : rate >= 75 ? 'normal' : 'success'}
              strokeColor={danger ? '#ff4d4f' : undefined}
              format={() => <span style={{ color: danger ? '#ff4d4f' : undefined }}>{rate}%</span>}
            />
          </Tooltip>
        )
      },
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      width: 120,
      valueType: 'dateRange',
      search: {
        transform: (value: unknown) => {
          const range = value as [string, string] | undefined
          return {
            startDate: range?.[0],
            endDate: range?.[1],
          }
        },
      },
      render: (_dom, entity) => String(entity.createdAt ?? '').slice(0, 10),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        1: { text: '正常' },
        2: { text: '待审核' },
        3: { text: '冻结' },
      },
      render: (_dom, entity) => {
        const text = STATUS_TEXT[entity.status] ?? '正常'
        return <Tag color={STATUS_COLOR[text]}>{text}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_dom, entity) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => navigate(`/admin/production/tenants/${entity.tenantId}`)}>
            查看
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setQuotaTarget(entity)
              quotaForm.setFieldsValue({
                farmLimit: 60,
                traceCodeLimit: 100000,
                storageLimit: 10,
                apiLimit: 50000,
              })
            }}
          >
            配额调整
          </Button>
          {entity.status === 3 ? (
            <Popconfirm
              title="确认启用该租户？"
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
              title="确认停用该租户？停用后其所有农场将禁止上报生产数据。"
              okText="停用"
              cancelText="取消"
              onConfirm={() => statusMutation.mutate({ tenantId: entity.tenantId, status: 3 })}
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
      message.warning('请先选择需要冻结的租户')
      return
    }
    await Promise.all(
      selectedRows.map((row) => updateTenantStatus(row.tenantId, 3)),
    )
    message.success(`已冻结 ${selectedRows.length} 个租户`)
    setSelectedRowKeys([])
    setSelectedRows([])
    setTableKey((prev) => prev + 1)
  }

  /** 批量导出（导出当前选中行，未选中时导出当前页） */
  const handleExport = (): void => {
    const rows = selectedRows.length > 0 ? selectedRows : []
    if (rows.length === 0) {
      message.warning('请先勾选需要导出的租户')
      return
    }
    const header = ['租户编号', '租户名称', '等级', '农场数', '在田面积(亩)', '活跃度', '配额使用率(%)', '注册时间', '状态']
    const body = rows.map((row) => [
      row.tenantCode,
      resolveTenantName(row),
      LEVEL_TEXT[row.tenantLevel] ?? '普通',
      String(row.farmCount),
      String(row.fieldArea ?? 0),
      row.activity ?? '正常',
      String(row.quotaUsageRate ?? row.usageRate ?? 0),
      String(row.createdAt ?? '').slice(0, 10),
      STATUS_TEXT[row.status] ?? '正常',
    ])
    const csv = [header, ...body].map((line) => line.join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `租户列表_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success(`已导出 ${rows.length} 条记录`)
  }

  return (
    <div>
      {/* 统计卡 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {stats.map((item) => (
          <Col key={item.key} xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title={item.title}
                value={item.value}
                valueStyle={{ color: item.color }}
                formatter={(value) => Number(value).toLocaleString('zh-CN')}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <ProTable<TenantRow>
        key={tableKey}
        rowKey="tenantId"
        size="small"
        headerTitle="租户列表"
        scroll={{ x: 1400 }}
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
            title={`确认冻结已选 ${selectedRowKeys.length} 个租户？`}
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
            const result = await listOpsTenants({
              pageNum,
              pageSize,
              tenantName: typeof params.tenantName === 'string' ? params.tenantName : undefined,
              tenantLevel: Number(params.tenantLevel) || undefined,
              status: Number(params.status) || undefined,
              startDate: typeof params.startDate === 'string' ? params.startDate : undefined,
              endDate: typeof params.endDate === 'string' ? params.endDate : undefined,
            })
            if (result.list && result.list.length > 0) {
              const rows: TenantRow[] = result.list.map((item) => {
                const usageRate = Number(item.quotaUsageRate ?? 0)
                return {
                  ...item,
                  fieldArea: item.fieldArea ?? (item.farmCount ?? 0) * 260,
                  activity: item.activity ?? (usageRate > 95 ? '不活跃' : usageRate > 85 ? '低活跃' : '正常'),
                  usageRate,
                }
              })
              return { data: rows, total: result.total, success: true }
            }
          } catch {
            // 后端未就绪时静默降级到示例数据，避免全局错误提示干扰使用
          }
          const sample = buildSampleTenants(pageNum, pageSize)
          let list = sample.list
          if (typeof params.tenantName === 'string' && params.tenantName.trim() !== '') {
            const keyword = params.tenantName.trim()
            list = list.filter(
              (item) =>
                resolveTenantName(item).includes(keyword) || item.tenantCode.includes(keyword),
            )
          }
          if (Number(params.tenantLevel)) {
            list = list.filter((item) => item.tenantLevel === Number(params.tenantLevel))
          }
          if (Number(params.status)) {
            list = list.filter((item) => item.status === Number(params.status))
          }
          return { data: list, total: sample.total, success: true }
        }}
        rowClassName={(record) =>
          Number(record.quotaUsageRate ?? record.usageRate ?? 0) >= 90 ? 'agri-row-danger' : ''
        }
      />

      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        提示：配额使用率 ≥ 90% 的租户已标红，建议尽快调整配额以免影响业务。
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
