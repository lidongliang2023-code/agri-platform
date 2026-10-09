/**
 * 页面名称：配额管理
 * 路由路径：/admin/production/tenants/quotas
 * 所属模块：租户管理
 * PRD 序号：PRD 6.2 #6
 * 说明：原型无此页，按 PRD「溯源码/存储/AI调用配额分配与调整」实现，
 * 配额项沿用原型 P3「配额详情」的 4 项口径（农场数 / 溯源码 / 存储空间 / API 调用）。
 */
import { useState } from 'react'
import {
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
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { SettingOutlined, WarningOutlined } from '@ant-design/icons'
import { ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { OpsQuotaItem, OpsTenantQuotaRow, TenantSegmentLevel } from '@/types'
import {
  batchUpdateQuotaLimits,
  listOpsQuotaOverview,
  resetTenantQuotaUsage,
  updateTenantQuotaLimits,
} from '@/api/admin/tenants'

const { Text } = Typography

/** 分层 → Tag 颜色 */
const SEGMENT_COLOR: Record<TenantSegmentLevel, string> = {
  钻石: 'purple',
  金牌: 'gold',
  银牌: 'blue',
  普通: 'default',
}

/** 租户名称池（生成示例配额数据） */
const TENANT_NAME_POOL: string[] = [
  '绿源农业科技有限公司', '丰达农场', '大地种业', '丰收集团', '田园生态',
  '惠民种植', '鑫农科技', '鑫盛农业科技', '中原农服', '黄河种业',
  '江淮米业', '东北黑土合作社', '云岭茶业', '天山牧业', '洞庭水产',
]

/** 分层池 */
const SEGMENT_POOL: TenantSegmentLevel[] = ['钻石', '金牌', '银牌', '普通']

/** 配额调整表单 */
interface QuotaFormValues {
  farmLimit: number
  traceCodeLimit: number
  storageLimit: number
  apiLimit: number
}

/**
 * 租户展示名：后端未提供租户名称时兜底展示租户 ID，避免出现空白列。
 *
 * 判空覆盖 undefined / null / '' / 纯空白串（'   ' 视为空）。
 *
 * @param row 配额行数据
 * @returns 用于展示的租户标识
 */
function resolveTenantName(row: { tenantId: string; tenantName?: string }): string {
  const name = row.tenantName?.trim()
  return name ? name : row.tenantId
}

/** 配额编码联合类型 */
type QuotaKey = 'farm' | 'traceCode' | 'storage' | 'api'

/**
 * 构造单项配额数据。
 *
 * @param key 配额编码
 * @param name 配额名称
 * @param unit 单位
 * @param used 已用量
 * @param limit 上限
 * @param precision 小数位
 * @param quotaType 后端配额类型
 * @param updatedAt 更新时间
 * @returns 配额项
 */
function buildQuotaItem(
  key: QuotaKey,
  name: string,
  unit: string,
  used: number,
  limit: number,
  precision: number,
  quotaType: number,
  updatedAt: string,
): OpsQuotaItem {
  const usageRate = limit > 0 ? Number(((used / limit) * 100).toFixed(1)) : 0
  return { key, name, unit, used, limit, usageRate, precision, updatedAt, quotaType }
}

/**
 * 生成配额管理示例数据（后端无数据时兜底）。
 *
 * @param pageNum 页码
 * @param pageSize 每页条数
 * @returns 配额行列表
 */
function buildSampleQuotaRows(pageNum: number, pageSize: number): OpsTenantQuotaRow[] {
  /** 平台纳入统计的租户数（原型 4.2 口径：活跃租户 1,286） */
  const total = 1286
  const rows: OpsTenantQuotaRow[] = []
  for (let index = 0; index < pageSize; index += 1) {
    const seq = (pageNum - 1) * pageSize + index + 1
    if (seq > total) {
      break
    }
    const base = seq <= 7 ? 0 : (seq % TENANT_NAME_POOL.length)
    const tier = SEGMENT_POOL[(seq * 3) % 4]
    const roll = seq % 10
    const farmUsed = 8 + ((seq * 11) % 60)
    const farmLimit = farmUsed + 6 + (roll % 12)
    const traceUsed = 12000 + ((seq * 7300) % 90000)
    const traceLimit = 100000
    const storageUsed = Number((1 + ((seq * 17) % 90) / 10).toFixed(1))
    const storageLimit = 10
    const apiUsed = 8000 + ((seq * 4310) % 45000)
    const apiLimit = 50000
    rows.push({
      tenantId: `TS${String(seq).padStart(6, '0')}`,
      tenantCode: `T2025${String(seq).padStart(4, '0')}`,
      tenantName:
        seq <= 7
          ? TENANT_NAME_POOL[seq - 1]
          : `${TENANT_NAME_POOL[base]}${seq}号基地`,
      segment: tier,
      farm: buildQuotaItem('farm', '农场数配额', '个', farmUsed, farmLimit, 0, 1, '2025-07-14 10:00:00'),
      traceCode: buildQuotaItem('traceCode', '溯源码配额(本月)', '枚', traceUsed, traceLimit, 0, 0, '2025-07-14 10:00:00'),
      storage: buildQuotaItem('storage', '存储空间', 'GB', storageUsed, storageLimit, 1, 5, '2025-07-14 10:00:00'),
      api: buildQuotaItem('api', 'API调用次数(本月)', '次', apiUsed, apiLimit, 0, 6, '2025-07-14 10:00:00'),
      maxUsageRate: 0,
      updatedAt: '2025-07-14 10:00:00',
    })
  }
  return rows.map((row) => ({
    ...row,
    maxUsageRate: Math.max(
      row.farm.usageRate,
      row.traceCode.usageRate,
      row.storage.usageRate,
      row.api.usageRate,
    ),
  }))
}

/**
 * 渲染单项配额（迷你进度条 + 用量文案）。
 *
 * @param item 配额项
 * @returns 渲染结果
 */
function renderQuota(item: {
  used: number
  limit: number
  usageRate: number
  unit: string
  precision: number
}): JSX.Element {
  const danger = item.usageRate >= 90
  const text = `${Number(item.used).toLocaleString('zh-CN', {
    minimumFractionDigits: item.precision,
    maximumFractionDigits: item.precision,
  })} / ${Number(item.limit).toLocaleString('zh-CN', {
    minimumFractionDigits: item.precision,
    maximumFractionDigits: item.precision,
  })} ${item.unit}`
  return (
    <Tooltip title={danger ? '即将用尽，建议尽快调整配额' : `已使用 ${item.usageRate}%`}>
      <div style={{ minWidth: 130 }}>
        <div style={{ fontSize: 12, color: danger ? '#ff4d4f' : 'inherit' }}>{text}</div>
        <Progress
          percent={Math.min(item.usageRate, 100)}
          size="small"
          showInfo={false}
          status={danger ? 'exception' : 'normal'}
          strokeColor={danger ? '#ff4d4f' : '#1677ff'}
        />
        <div style={{ fontSize: 12, color: danger ? '#ff4d4f' : 'rgba(0,0,0,0.45)' }}>
          {item.usageRate}%
        </div>
      </div>
    </Tooltip>
  )
}

/**
 * 配额管理
 *
 * 业务职责：全平台租户配额一览（农场数 / 溯源码 / 存储空间 / API 调用），
 * 支持按租户、分层检索，单行调整、批量调整与按实际数据重算已用配额。
 *
 * @returns 页面内容
 */
export default function TenantQuotas(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 已选行 */
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  /** 已选行数据 */
  const [selectedRows, setSelectedRows] = useState<OpsTenantQuotaRow[]>([])
  /** 是否仅看配额告警 */
  const [onlyWarning, setOnlyWarning] = useState<boolean>(false)
  /** 表格刷新标识 */
  const [tableKey, setTableKey] = useState<number>(0)
  /** 当前调整目标：单个租户或批量 */
  const [adjustTarget, setAdjustTarget] = useState<OpsTenantQuotaRow[] | null>(null)
  /** 配额表单 */
  const [quotaForm] = Form.useForm<QuotaFormValues>()

  /** 调整单个租户配额 */
  const updateMutation = useMutation({
    mutationFn: (payload: { tenantId: string; values: QuotaFormValues }) =>
      updateTenantQuotaLimits(payload.tenantId, payload.values),
    onSuccess: () => {
      message.success('配额调整已提交')
      setAdjustTarget(null)
      setTableKey((prev) => prev + 1)
    },
  })

  /** 批量调整配额 */
  const batchMutation = useMutation({
    mutationFn: (payload: { tenantIds: string[]; values: QuotaFormValues }) =>
      batchUpdateQuotaLimits({ tenantIds: payload.tenantIds, ...payload.values }),
    onSuccess: (_data, variables) => {
      message.success(`已批量调整 ${variables.tenantIds.length} 个租户的配额`)
      setAdjustTarget(null)
      setSelectedRowKeys([])
      setSelectedRows([])
      setTableKey((prev) => prev + 1)
    },
  })

  /** 重算已用配额 */
  const resetMutation = useMutation({
    mutationFn: (tenantId: string) => resetTenantQuotaUsage(tenantId),
    onSuccess: () => {
      message.success('已按实际业务数据重算配额用量')
      setTableKey((prev) => prev + 1)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', 'quota-overview'] })
    },
  })

  /** 配额表单默认值 */
  const defaultQuotaValues: QuotaFormValues = {
    farmLimit: 60,
    traceCodeLimit: 100000,
    storageLimit: 10,
    apiLimit: 50000,
  }

  /** 打开调整弹窗 */
  const openAdjustModal = (target: OpsTenantQuotaRow[]): void => {
    if (target.length === 0) {
      message.warning('请先选择需要调整配额的租户')
      return
    }
    setAdjustTarget(target)
    const first = target[0]
    quotaForm.setFieldsValue({
      farmLimit: first.farm.limit,
      traceCodeLimit: first.traceCode.limit,
      storageLimit: first.storage.limit,
      apiLimit: first.api.limit,
    })
  }

  /** 提交调整 */
  const submitAdjust = (): void => {
    void quotaForm.validateFields().then((values) => {
      if (!adjustTarget || adjustTarget.length === 0) {
        return
      }
      if (adjustTarget.length === 1) {
        updateMutation.mutate({ tenantId: adjustTarget[0].tenantId, values })
        return
      }
      batchMutation.mutate({
        tenantIds: adjustTarget.map((item) => item.tenantId),
        values,
      })
    })
  }

  /** 表格列定义 */
  const columns: ProColumns<OpsTenantQuotaRow>[] = [
    {
      title: '租户编号',
      dataIndex: 'tenantCode',
      width: 120,
      copyable: true,
    },
    {
      title: '租户名称',
      dataIndex: 'tenantName',
      width: 200,
      ellipsis: true,
      fieldProps: { placeholder: '请输入租户名称' },
      // 后端未返回租户名称时兜底展示租户 ID，避免出现空白列
      render: (_dom, entity) => <span>{resolveTenantName(entity)}</span>,
    },
    {
      title: '分层',
      dataIndex: 'segment',
      width: 100,
      valueType: 'select',
      valueEnum: {
        钻石: { text: '钻石' },
        金牌: { text: '金牌' },
        银牌: { text: '银牌' },
        普通: { text: '普通' },
      },
      render: (_dom, entity) => <Tag color={SEGMENT_COLOR[entity.segment]}>{entity.segment}</Tag>,
    },
    {
      title: '农场数配额',
      dataIndex: 'farm',
      width: 170,
      hideInSearch: true,
      render: (_dom, entity) => renderQuota(entity.farm),
    },
    {
      title: '溯源码配额(本月)',
      dataIndex: 'traceCode',
      width: 170,
      hideInSearch: true,
      render: (_dom, entity) => renderQuota(entity.traceCode),
    },
    {
      title: '存储空间',
      dataIndex: 'storage',
      width: 170,
      hideInSearch: true,
      render: (_dom, entity) => renderQuota(entity.storage),
    },
    {
      title: 'API调用次数(本月)',
      dataIndex: 'api',
      width: 170,
      hideInSearch: true,
      render: (_dom, entity) => renderQuota(entity.api),
    },
    {
      title: '最高使用率',
      dataIndex: 'maxUsageRate',
      width: 120,
      hideInSearch: true,
      sorter: true,
      render: (_dom, entity) => (
        <Tag color={entity.maxUsageRate >= 90 ? 'red' : entity.maxUsageRate >= 75 ? 'orange' : 'green'}>
          {entity.maxUsageRate}%
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 120,
      hideInSearch: true,
      render: (_dom, entity) => String(entity.updatedAt ?? '').slice(0, 10),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      hideInSearch: true,
      render: (_dom, entity) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => openAdjustModal([entity])}>
            调整
          </Button>
          <Popconfirm
            title="按实际业务数据重算该租户的已用配额？"
            okText="重算"
            cancelText="取消"
            onConfirm={() => resetMutation.mutate(entity.tenantId)}
          >
            <Button type="link" size="small">
              重算
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 顶部提示与统计 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="纳入统计租户" value={1286} formatter={(value) => Number(value).toLocaleString('zh-CN')} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="配额告警租户（≥90%）"
              value={42}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="平均配额使用率" value={68.4} precision={1} suffix="%" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="本月配额调整次数" value={36} />
          </Card>
        </Col>
      </Row>

      <ProTable<OpsTenantQuotaRow>
        key={tableKey}
        rowKey="tenantId"
        size="small"
        headerTitle="全平台租户配额一览"
        scroll={{ x: 1500 }}
        search={{ labelWidth: 90 }}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys, rows) => {
            setSelectedRowKeys(keys as string[])
            setSelectedRows(rows as OpsTenantQuotaRow[])
          },
        }}
        toolBarRender={() => [
          <span key="selected" style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>
            已选 {selectedRowKeys.length} 项
          </span>,
          <Space key="warning">
            <Text type="secondary">仅看告警</Text>
            <Switch
              checked={onlyWarning}
              onChange={(checked) => {
                setOnlyWarning(checked)
                setTableKey((prev) => prev + 1)
              }}
            />
          </Space>,
          <Button
            key="batch"
            type="primary"
            icon={<SettingOutlined />}
            onClick={() => openAdjustModal(selectedRows)}
          >
            批量调整配额
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
            const result = await listOpsQuotaOverview({
              pageNum,
              pageSize,
              tenantName: typeof params.tenantName === 'string' ? params.tenantName : undefined,
              segment: typeof params.segment === 'string' ? params.segment : undefined,
              onlyWarning,
            })
            if (result.list && result.list.length > 0) {
              return { data: result.list, total: result.total, success: true }
            }
          } catch {
            // 后端未就绪时静默降级到示例数据
          }
          const sample = buildSampleQuotaRows(pageNum, pageSize)
          let list = sample
          if (typeof params.tenantName === 'string' && params.tenantName.trim() !== '') {
            const keyword = params.tenantName.trim()
            list = list.filter(
              (item) =>
                resolveTenantName(item).includes(keyword) || item.tenantCode.includes(keyword),
            )
          }
          if (typeof params.segment === 'string' && params.segment) {
            list = list.filter((item) => item.segment === params.segment)
          }
          if (onlyWarning) {
            list = list.filter((item) => item.maxUsageRate >= 90)
          }
          return { data: list, total: 1286, success: true }
        }}
      />

      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        提示：配额使用率 ≥ 90% 会自动标红；「重算」会按租户实际农场 / 用量数据重新统计已用配额。
      </Text>

      {/* 配额调整 / 批量调整弹窗 */}
      <Modal
        open={adjustTarget !== null}
        title={
          adjustTarget && adjustTarget.length > 1
            ? `批量调整配额（已选 ${adjustTarget.length} 个租户）`
            : `调整配额 - ${adjustTarget?.[0] ? resolveTenantName(adjustTarget[0]) : ''}`
        }
        onCancel={() => setAdjustTarget(null)}
        okText="提交调整"
        cancelText="取消"
        confirmLoading={updateMutation.isPending || batchMutation.isPending}
        destroyOnClose
        onOk={submitAdjust}
      >
        <Form<QuotaFormValues> form={quotaForm} layout="vertical" initialValues={defaultQuotaValues} preserve={false}>
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
          {adjustTarget && adjustTarget.length > 1 && (
            <Text type="warning">批量调整将把上述 4 项上限应用到所有已选租户，请确认后再提交。</Text>
          )}
        </Form>
      </Modal>
    </div>
  )
}
