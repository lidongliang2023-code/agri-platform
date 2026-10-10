/**
 * 页面名称：配额管理
 * 路由路径：/admin/production/tenants/quotas
 * 所属模块：租户管理
 * PRD 序号：PRD 6.2 #6
 * 说明：原型无此页，按 PRD「溯源码/存储/AI调用配额分配与调整」实现，
 * 配额项沿用原型 P3「配额详情」的 4 项口径（农场数 / 溯源码 / 存储空间 / API 调用）。
 *
 * 数据来源约定（硬规矩：不造数据、可以降级但不能骗人）：
 * - 列表数据全部来自后端 GET /admin/tenants/quota-overview，不使用任何本地示例/兜底数据；
 * - 后端无数据时列表就是空的（由 ProTable 渲染空态），请求失败时顶部显式告警，不清空为成功；
 * - 后端 OpsQuotaItem.source 标记用量数据来源：仅「农场数」为 COLUMN，
 *   溯源码 / 存储空间 / API 调用为 NONE，前端必须展示「—」而不是 0；
 * - 三者「没有」的原因不同，文案必须区分：溯源码后端有平台口径统计（/trace/codes/stats）
 *   但生产域表 tenant_id 全为 0、无租户维度；存储空间 / API 调用后端暂无任何用量数据源。
 */
import { useState } from 'react'
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
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { OpsTenantQuotaRow } from '@/types'
import {
  batchUpdateQuotaLimits,
  listOpsQuotaOverview,
  resetTenantQuotaUsage,
  updateTenantQuotaLimits,
} from '@/api/admin/tenants'

const { Text } = Typography

/**
 * 配额预警阈值（%），与后端 TenantQuotaService.WARNING_THRESHOLD 保持一致。
 * 后端「仅看告警」按此阈值过滤，故前端标红口径必须同步，否则会出现「勾选了却筛不出来」。
 */
const WARNING_THRESHOLD = 80

/** 后端标记「有真实用量数据源」的取值（OpsQuotaItem.SOURCE_COLUMN） */
const QUOTA_SOURCE_COLUMN = 'COLUMN'

/** 无用量数据源时的提示文案（存储 / API 调用：后端完全没有用量数据源） */
const NO_SOURCE_TIP = '后端暂无该维度的用量数据源，无法统计，故不展示用量与使用率'

/**
 * 溯源码维度的提示文案。
 *
 * 与存储 / API 调用不同：后端确实有溯源码统计端点（/trace/codes/stats），
 * 但生产域 prod_trace_code 等表 tenant_id 全为 0，只有平台口径、没有租户维度，
 * 因此不能按租户展示用量——把平台合计填到每行租户头上仍是假数据。
 */
const NO_SOURCE_TIP_TRACE =
  '后端仅有平台口径的溯源码统计（/trace/codes/stats），无租户维度；不能按租户展示用量，故显示「—」'

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
 * 渲染单项配额（迷你进度条 + 用量文案）。
 *
 * 后端 source 非 COLUMN 时（无用量数据源），用量为「—」且不渲染进度条，
 * 因为此时 used=0 只是结构占位，展示 0 会让用户误以为真实用量为 0。
 *
 * @param item 配额项
 * @param noSourceTip 无数据源时的说明文案（溯源码与存储 / API 的口径不同，需分别传入）
 * @returns 渲染结果
 */
function renderQuota(
  item: {
    used: number
    limit: number
    usageRate: number
    unit: string
    precision: number
    source?: 'COLUMN' | 'NONE' | 'UNAVAILABLE'
  },
  noSourceTip: string = NO_SOURCE_TIP,
): JSX.Element {
  if (item.source !== QUOTA_SOURCE_COLUMN) {
    return (
      <Tooltip title={noSourceTip}>
        <div style={{ minWidth: 130 }}>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>用量：—</div>
          <Progress percent={0} size="small" showInfo={false} strokeColor="rgba(0,0,0,0.15)" />
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
            上限 {formatNumber(item.limit, item.precision)} {item.unit}
          </div>
        </div>
      </Tooltip>
    )
  }
  const danger = item.usageRate >= WARNING_THRESHOLD
  const text = `${formatNumber(item.used, item.precision)} / ${formatNumber(item.limit, item.precision)} ${item.unit}`
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
 * 支持按租户名称检索、仅看告警，单行调整、批量调整与按实际数据重算已用配额。
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
  /** 后端配额记录总数（后端真实返回值；null 表示尚未取到，展示「—」而不是 0） */
  const [totalCount, setTotalCount] = useState<number | null>(null)
  /** 列表加载失败原因；非空时顶部显式告警，绝不静默降级为本地数据 */
  const [loadError, setLoadError] = useState<string>('')

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

  /**
   * 重算已用配额。
   *
   * ⚠️ 真端点 `POST /admin/tenants/{quotaId}/reset-usage` 要的是 **quotaId**，
   * 不是 tenantId（此前传 tenantId 打到了一条根本不存在的路径上，必失败）。
   *
   * 实测：`GET /admin/tenants/quota-overview` 的行里，`tenantId` 字段**填的其实就是
   * quotaId**（三条分别为 `DEMO-QUOTA-001` / `DEMO-QUOTA-002` / `QUOT2026...`），
   * 且 `farm.quotaId` 同样是这个值。这里优先取 `farm.quotaId`，取不到再回落到该字段。
   */
  const resetMutation = useMutation({
    mutationFn: (row: OpsTenantQuotaRow) =>
      resetTenantQuotaUsage(row.farm?.quotaId ?? row.tenantId),
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
      render: (_dom, entity) => renderQuota(entity.traceCode, NO_SOURCE_TIP_TRACE),
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
        <Tag
          color={
            entity.maxUsageRate >= WARNING_THRESHOLD
              ? 'red'
              : entity.maxUsageRate >= WARNING_THRESHOLD * 0.75
                ? 'orange'
                : 'green'
          }
        >
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
            onConfirm={() => resetMutation.mutate(entity)}
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
      {/*
        口径说明（接后端工单 BT-09）：本页「租户」的标识取自**配额记录**，不是后端的 tenant_id。
        实测 prod_tenant_quota.tenant_id 与 prod_farm_info.tenant_id 当前全库为 0（6 个农场、
        COUNT(DISTINCT tenant_id)=1、min=max=0），因此「租户编号」列实际显示的是配额记录 ID
        （quotaId），「重算」也是按 quotaId 提交的。不说明的话，使用者会把这一列当成真的租户 ID。
      */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="租户标识口径：当前取自配额记录（quotaId）"
        description="后端 tenant_id 字段全库为 0、暂不可用，所以本页「租户编号」列显示的是配额记录 ID（quotaId），「重算」也按 quotaId 提交。等后端工单 BT-09 明确口径（回填 tenant_id，或统一以 quotaId 作为租户标识，二选一）后，本页口径会同步调整。"
      />

      {/* 顶部统计：只展示后端真实返回的配额记录总数，无任何虚构数字 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="配额记录总数（后端实际）"
              value={totalCount === null ? '—' : totalCount}
              formatter={(value) =>
                typeof value === 'number' ? Number(value).toLocaleString('zh-CN') : String(value)
              }
            />
          </Card>
        </Col>
      </Row>

      {/* 加载失败必须让用户看见：不允许静默降级为本地数据 */}
      {loadError !== '' && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={`配额数据加载失败：${loadError}`}
          description="页面不会用任何本地示例数据兜底。请确认后端服务与 /admin/tenants/quota-overview 接口可用后重试。"
        />
      )}

      <ProTable<OpsTenantQuotaRow>
        key={tableKey}
        rowKey="tenantId"
        size="small"
        headerTitle="全平台租户配额一览"
        scroll={{ x: 1400 }}
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
            <Text type="secondary">{`仅看告警（≥${WARNING_THRESHOLD}%）`}</Text>
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
              onlyWarning,
            })
            setLoadError('')
            setTotalCount(result.total)
            // 后端正常返回（哪怕 list 为空）就原样使用：空就是空，由 ProTable 渲染空态
            return { data: result.list, total: result.total, success: true }
          } catch (error) {
            // 失败必须显式暴露，禁止再用本地兜底数据填充列表
            setLoadError(error instanceof Error ? error.message : String(error))
            setTotalCount(null)
            return { data: [], total: 0, success: false }
          }
        }}
      />

      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        {`提示：配额使用率 ≥ ${WARNING_THRESHOLD}% 会自动标红（与后端预警阈值一致）；「重算」会按租户实际农场 / 用量数据重新统计已用配额。`}
        <br />
        数据说明：仅「农场数」有真实用量数据源（取自配额表用量列 used_farm_count）；
        溯源码后端仅有平台口径统计、无租户维度（不按租户展示，避免把平台合计当成租户用量）；
        存储空间 / API 调用后端暂无用量数据源。后三项用量显示为「—」，并非用量为 0。
        分层（钻石 / 金牌 / 银牌 / 普通）后端无数据源，已移除该列与对应筛选。
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
