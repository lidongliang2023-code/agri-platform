/**
 * 页面名称：库存详情
 * 路由路径：/production/harvests/inventory/:inventoryId
 * 所属模块：采收与库存管理
 * 原型 pageId：P18 inventory-detail
 *
 * 还原要点：
 * - 头部：`< 返回 番茄(A级) · 库存详情`；按钮「出库」「调拨」
 * - 「📋 库存信息」：库存编号、品名、仓库、当前库存、安全库存、批次号、入库日期、
 *   保质期至、关联采收（→harvest-detail）、状态
 * - 「📋 出入库记录」表：时间 | 类型 | 数量 | 操作人 | 备注
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import {
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
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  ExportOutlined,
  LockOutlined,
  SwapOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import { DemoDataAlert } from '@/components'
import {
  outboundInventory,
  queryHarvests,
  queryInventoryFlows,
  queryInventoryRecord,
  toggleInventoryFreeze,
  transferInventoryRecord,
} from '@/api/harvests'
import type { InventoryFlow, InventoryRecord } from '@/types'
import {
  GRADE_COLOR_MAP,
  GRADE_LABEL_MAP,
  INVENTORY_HEALTH_META,
  WAREHOUSE_OPTIONS,
  resolveInventoryHealth,
} from '@/types'

/** 出入库流水类型 → 展示元数据 */
const FLOW_TYPE_META: Record<number, { label: string; color: string }> = {
  1: { label: '入库', color: 'green' },
  2: { label: '出库', color: 'blue' },
  3: { label: '盘点', color: 'geekblue' },
  4: { label: '报损', color: 'red' },
}

/** 出库弹窗表单值 */
interface OutboundFormValues {
  /** 出库数量 */
  quantity?: number
  /** 关联单据号 */
  orderNo?: string
  /** 备注 */
  remark?: string
}

/** 调拨弹窗表单值 */
interface TransferFormValues {
  /** 目标仓库 */
  targetWarehouse?: string
  /** 调拨数量 */
  quantity?: number
  /** 目标库位 */
  locationCode?: string
  /** 备注 */
  remark?: string
}

/**
 * 库存详情页面
 *
 * 业务职责：展示单条库存明细与出入库流水，支持出库、调拨与冻结 / 解冻。
 *
 * @returns 页面内容
 */
export default function InventoryDetail(): JSX.Element {
  const { inventoryId } = useParams<{ inventoryId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [outboundOpen, setOutboundOpen] = useState<boolean>(false)
  const [transferOpen, setTransferOpen] = useState<boolean>(false)
  const [outboundForm] = Form.useForm<OutboundFormValues>()
  const [transferForm] = Form.useForm<TransferFormValues>()

  /** 库存详情 */
  const detailQuery = useQuery({
    queryKey: ['production-inventory', 'detail', inventoryId],
    enabled: Boolean(inventoryId),
    queryFn: () => queryInventoryRecord(inventoryId as string),
  })

  const record: InventoryRecord | undefined = detailQuery.data?.data

  /** 出入库流水 */
  const flowQuery = useQuery({
    queryKey: ['production-inventory', 'flows', record?.batchId],
    enabled: Boolean(record?.batchId),
    queryFn: () => queryInventoryFlows(record?.batchId as string, { pageNum: 1, pageSize: 50 }),
  })

  /** 采收批次（用于关联采收跳转） */
  const harvestQuery = useQuery({
    queryKey: ['production-harvests', 'options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => queryHarvests({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 统一失效刷新 */
  const invalidateAll = (): Promise<void> =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['production-inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['production-harvests'] }),
    ]).then(() => undefined)

  /** 出库 */
  const outboundMutation = useMutation({
    mutationFn: (payload: { batchId: string; quantity: number; orderNo?: string; remark?: string }) =>
      outboundInventory(payload.batchId, payload),
    onSuccess: () => {
      message.success('出库成功')
      setOutboundOpen(false)
      outboundForm.resetFields()
      void invalidateAll()
    },
    onError: (error) => message.error(error.message || '出库失败，请稍后重试', 6),
  })

  /** 调拨 */
  const transferMutation = useMutation({
    mutationFn: (payload: {
      batchId: string
      targetWarehouse: string
      quantity: number
      locationCode?: string
      remark?: string
    }) => transferInventoryRecord(payload),
    onSuccess: () => {
      message.success('调拨成功')
      setTransferOpen(false)
      transferForm.resetFields()
      void invalidateAll()
    },
    onError: (error) => message.error(error.message || '调拨失败，请稍后重试', 6),
  })

  /** 冻结 / 解冻 */
  const freezeMutation = useMutation({
    mutationFn: (payload: { batchId: string; frozen: boolean }) =>
      toggleInventoryFreeze(payload.batchId, payload.frozen),
    onSuccess: (_result, payload) => {
      message.success(payload.frozen ? '库存已冻结' : '库存已解冻')
      void invalidateAll()
    },
    onError: (error) => message.error(error.message || '操作失败，请稍后重试', 6),
  })

  /** 关联采收批次（按采收编号匹配） */
  const relatedHarvest = useMemo(
    () =>
      (harvestQuery.data?.list ?? []).find(
        (item) => item.batchNo === record?.relatedBatchNo,
      ),
    [harvestQuery.data, record],
  )

  /** 提交出库 */
  const handleOutbound = (): void => {
    if (!record) return
    outboundForm.validateFields().then((values) => {
      const quantity = values.quantity ?? 0
      if (quantity <= 0) {
        message.warning('出库数量必须大于 0')
        return
      }
      if (quantity > record.currentQty) {
        message.warning(`出库数量不能超过当前库存 ${record.currentQty}${record.unit}`)
        return
      }
      outboundMutation.mutate({
        batchId: record.batchId,
        quantity,
        orderNo: values.orderNo,
        remark: values.remark,
      })
    })
  }

  /** 提交调拨 */
  const handleTransfer = (): void => {
    if (!record) return
    transferForm.validateFields().then((values) => {
      transferMutation.mutate({
        batchId: record.batchId,
        targetWarehouse: values.targetWarehouse ?? '主仓库',
        quantity: values.quantity ?? record.currentQty,
        locationCode: values.locationCode,
        remark: values.remark,
      })
    })
  }

  /** 加载态 */
  if (detailQuery.isLoading) {
    return (
      <PageContainer title="库存详情">
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </PageContainer>
    )
  }

  /** 错误态 / 空态 */
  if (detailQuery.isError || !record) {
    return (
      <PageContainer title="库存详情">
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="danger">未查询到该库存记录，请返回列表重试</Typography.Text>
              <Button onClick={() => navigate('/production/harvests/inventory')}>
                返回库存管理
              </Button>
            </Space>
          }
        />
      </PageContainer>
    )
  }

  const health = (record.healthStatus ??
    resolveInventoryHealth(record.currentQty, record.safeQty ?? 0, record.expireDate)) as
    keyof typeof INVENTORY_HEALTH_META
  const healthMeta = INVENTORY_HEALTH_META[health] ?? INVENTORY_HEALTH_META.normal
  const flows = flowQuery.data?.list ?? []
  const safePercent =
    record.safeQty && record.safeQty > 0
      ? Math.min(100, Math.round((record.currentQty / (record.safeQty * 2)) * 100))
      : 100

  return (
    <PageContainer
      title={
        <Space size={8}>
          <Typography.Link onClick={() => navigate('/production/harvests/inventory')}>
            <ArrowLeftOutlined /> 返回
          </Typography.Link>
          <span>{record.productName ?? '库存'} · 库存详情</span>
        </Space>
      }
      subTitle={currentFarm?.farmName}
      extra={[
        <Button
          key="out"
          type="primary"
          icon={<ExportOutlined />}
          disabled={record.frozen}
          loading={outboundMutation.isPending}
          onClick={() => setOutboundOpen(true)}
        >
          出库
        </Button>,
        <Button
          key="transfer"
          icon={<SwapOutlined />}
          loading={transferMutation.isPending}
          onClick={() => setTransferOpen(true)}
        >
          调拨
        </Button>,
        record.frozen ? (
          <Popconfirm
            key="unfreeze"
            title="确认解冻该库存？"
            okText="确认解冻"
            cancelText="取消"
            onConfirm={() => freezeMutation.mutate({ batchId: record.batchId, frozen: false })}
          >
            <Button icon={<UnlockOutlined />}>解冻</Button>
          </Popconfirm>
        ) : (
          <Popconfirm
            key="freeze"
            title="确认冻结该库存？"
            description="冻结后不可出库，请先解冻。"
            okText="确认冻结"
            cancelText="取消"
            onConfirm={() => freezeMutation.mutate({ batchId: record.batchId, frozen: true })}
          >
            <Button icon={<LockOutlined />}>冻结</Button>
          </Popconfirm>
        ),
      ]}
    >
      {detailQuery.data?.demo ? (
        <DemoDataAlert
          scope="库存详情卡片（含库存水位）"
          writeNote="出库、调拨、冻结 / 解冻都不会写入服务端，也不会改动本地数据：后端不可用时这些操作会直接失败并提示原因（含「未写入服务端」字样）。"
        />
      ) : null}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="当前库存"
              value={record.currentQty}
              precision={2}
              suffix={record.unit}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="安全库存" value={record.safeQty ?? 0} suffix={record.unit} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="可用库存"
              value={Math.max(0, record.currentQty - (record.frozenQty ?? 0))}
              precision={2}
              suffix={record.unit}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="累计损耗" value={record.lossQty ?? 0} suffix={record.unit} />
          </Card>
        </Col>
      </Row>

      <Card title="📋 库存信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={3} size="middle">
          <Descriptions.Item label="库存编号">{record.inventoryId}</Descriptions.Item>
          <Descriptions.Item label="品名">
            <Space size={4}>
              <span>{record.productName ?? '-'}</span>
              {record.grade ? (
                <Tag color={GRADE_COLOR_MAP[record.grade] ?? 'default'}>
                  {GRADE_LABEL_MAP[record.grade] ?? record.grade}
                </Tag>
              ) : null}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="仓库">{record.warehouseName}</Descriptions.Item>
          <Descriptions.Item label="当前库存">
            {record.currentQty.toLocaleString()} {record.unit}
          </Descriptions.Item>
          <Descriptions.Item label="安全库存">
            {(record.safeQty ?? 0).toLocaleString()} {record.unit}
          </Descriptions.Item>
          <Descriptions.Item label="冻结数量">
            {(record.frozenQty ?? 0).toLocaleString()} {record.unit}
          </Descriptions.Item>
          <Descriptions.Item label="批次号">{record.batchNo ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="入库日期">
            {record.lastInAt ? dayjs(record.lastInAt).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="最近出库">
            {record.lastOutAt ? dayjs(record.lastOutAt).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="保质期至">{record.expireDate ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="库位编号">{record.locationCode ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="关联采收">
            {relatedHarvest ? (
              <Typography.Link
                onClick={() => navigate(`/production/harvests/${relatedHarvest.batchId}`)}
              >
                {relatedHarvest.batchNo}
              </Typography.Link>
            ) : (
              record.relatedBatchNo ?? '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Space size={4}>
              <Tag color={healthMeta.color}>● {healthMeta.label}</Tag>
              {record.frozen ? <Tag color="volcano">已冻结</Tag> : null}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>
            {record.remark ?? '-'}
          </Descriptions.Item>
        </Descriptions>

        <Progress
          style={{ marginTop: 16, maxWidth: 520 }}
          percent={safePercent}
          status={health === 'shortage' ? 'exception' : health === 'warning' ? 'active' : 'success'}
          format={() => `库存水位 ${record.currentQty}/${(record.safeQty ?? 0) * 2}`}
        />
      </Card>

      <Card title="📋 出入库记录">
        {flowQuery.data?.demo ? (
          <DemoDataAlert
            scope="下方出入库流水表"
            writeNote="本表为只读展示，不涉及写操作；流水接口不可用时不会向服务端写入任何数据。"
          />
        ) : null}
        <Table<InventoryFlow>
          rowKey="flowId"
          dataSource={flows}
          loading={flowQuery.isFetching}
          pagination={false}
          locale={{ emptyText: '暂无出入库流水' }}
          columns={[
            {
              title: '时间',
              dataIndex: 'operatedAt',
              width: 180,
            },
            {
              title: '类型',
              dataIndex: 'flowType',
              width: 100,
              render: (_, row) => {
                const meta = FLOW_TYPE_META[row.flowType] ?? { label: '其他', color: 'default' }
                return <Tag color={meta.color}>{meta.label}</Tag>
              },
            },
            {
              title: '数量',
              dataIndex: 'quantity',
              width: 130,
              render: (_, row) => (
                <Typography.Text type={row.quantity >= 0 ? 'success' : 'danger'}>
                  {row.quantity >= 0 ? '+' : ''}
                  {row.quantity.toLocaleString()} {row.unit}
                </Typography.Text>
              ),
            },
            { title: '操作人', dataIndex: 'operatorName', width: 120 },
            { title: '关联单据', dataIndex: 'orderNo', width: 140, render: (value) => value ?? '-' },
            { title: '备注', dataIndex: 'remark', render: (value) => value ?? '-' },
          ]}
        />

        <DividerLabel text="流转时间线" />
        <Timeline
          items={flows.map((flow) => {
            const meta = FLOW_TYPE_META[flow.flowType] ?? { label: '其他', color: 'default' }
            return {
              color: meta.color,
              children: (
                <Space size={8} wrap>
                  <Typography.Text strong>{flow.operatedAt}</Typography.Text>
                  <Tag color={meta.color}>{meta.label}</Tag>
                  <Typography.Text type={flow.quantity >= 0 ? 'success' : 'danger'}>
                    {flow.quantity >= 0 ? '+' : ''}
                    {flow.quantity.toLocaleString()} {flow.unit}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {flow.operatorName ?? '-'} · {flow.remark ?? '-'}
                  </Typography.Text>
                </Space>
              ),
            }
          })}
        />
        {flows.length === 0 ? (
          <Empty description="暂无出入库流水" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : null}
      </Card>

      {/* 出库 */}
      <Modal
        title={`出库：${record.productName ?? ''}`}
        open={outboundOpen}
        okText="确认出库"
        cancelText="取消"
        confirmLoading={outboundMutation.isPending}
        onOk={handleOutbound}
        onCancel={() => {
          setOutboundOpen(false)
          outboundForm.resetFields()
        }}
        destroyOnClose
      >
        <Form form={outboundForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="quantity"
            label="出库数量"
            rules={[{ required: true, message: '请输入出库数量' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder={`当前库存 ${record.currentQty}${record.unit}`}
            />
          </Form.Item>
          <Form.Item name="orderNo" label="关联单据号">
            <Input placeholder="如销售订单号 SO20260602（可选）" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可填写承运车辆、收货方等" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 调拨 */}
      <Modal
        title={`调拨：${record.productName ?? ''}`}
        open={transferOpen}
        okText="确认调拨"
        cancelText="取消"
        confirmLoading={transferMutation.isPending}
        onOk={handleTransfer}
        onCancel={() => {
          setTransferOpen(false)
          transferForm.resetFields()
        }}
        destroyOnClose
      >
        <Form
          form={transferForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{ quantity: record.currentQty }}
        >
          <Form.Item
            name="targetWarehouse"
            label="目标仓库"
            rules={[{ required: true, message: '请选择目标仓库' }]}
          >
            <Select options={WAREHOUSE_OPTIONS} placeholder="请选择目标仓库" />
          </Form.Item>
          <Form.Item name="quantity" label="调拨数量">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="locationCode" label="目标库位">
            <Input placeholder="如 B-02-01（可选）" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="可填写调拨原因" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}

/**
 * 时间线小标题。
 *
 * @param props 组件属性
 * @param props.text 标题文案
 * @returns 标题节点
 */
function DividerLabel({ text }: { text: string }): JSX.Element {
  return (
    <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>
      {text}
    </Typography.Title>
  )
}
