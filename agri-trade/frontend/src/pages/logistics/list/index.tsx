import { useState, useEffect } from 'react'
import { Table, Button, Card, Input, InputNumber, Select, Space, Tag, Modal, Form, Descriptions, message, Popconfirm } from 'antd'
import { EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, TruckOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getLogisticsList, getLogisticsTraces, updateLogisticsStatus, deleteLogistics,
  getCarriers, updateLogistics,
  type CarrierVO, type LogisticsQuery, type LogisticsVO, type LogisticsTraceVO
} from '@/api/logistics'

/**
 * 取值来自库里的真实词表（也是后端 LogisticsController 自己的映射表用的那套）：
 * 类型目前只有 cold_chain；状态 pending / picked / in_transit / delivering / delivered。
 * 原先两列直接把枚举原样打印（页面上是 "cold_chain"、"pending"）。
 */
const LOGISTICS_TYPE: Record<string, string> = {
  cold_chain: '冷链',
  normal: '普通货运',
  express: '快递',
  self_pickup: '自提'
}

const LOGISTICS_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待揽收', color: 'warning' },
  picked: { text: '已揽收', color: 'processing' },
  in_transit: { text: '运输中', color: 'processing' },
  delivering: { text: '派送中', color: 'processing' },
  delivered: { text: '已签收', color: 'success' },
  exception: { text: '异常', color: 'error' }
}

const statusText = (value: string) => LOGISTICS_STATUS[value]?.text ?? value

/**
 * 物流管理。
 *
 * <p>这一页原先四个操作按钮（跟踪/查看/编辑/删除）都没有 onClick —— 点了什么都不发生；
 * 搜索框与状态下拉也是摆设（后端连 logisticsNo 参数都没收）。
 * 现在：编辑 → 改承运商/类型/运费/收货信息（PUT /{id}）并单独改状态（POST /{id}/status，会写轨迹）、
 * 跟踪 → 看轨迹、查看 → 看单据详情、删除 → 软删（已签收的不允许删），
 * 搜索与状态筛选也真正参与查询。</p>
 *
 * <p>后端本轮同时按身份收口：列表只返回"我是买方或卖方"的订单的物流单，
 * 详情/轨迹/改状态/编辑/删除/新建都要求调用方是该订单的当事人。</p>
 */
function LogisticsList() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState<LogisticsQuery>({ pageNum: 1, pageSize: 10 })
  const [draft, setDraft] = useState<{ logisticsNo?: string; logisticsStatus?: string }>({})

  const { data, isLoading } = useQuery({
    queryKey: ['logistics', query],
    queryFn: () => getLogisticsList(query)
  })

  const [editing, setEditing] = useState<LogisticsVO | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [carriers, setCarriers] = useState<CarrierVO[]>([])

  // 承运商列表：物流单创建时若没选承运商，编辑时就选不出来了 —— 这才是"编辑"存在的意义
  useEffect(() => {
    getCarriers()
      .then((res: { code: number; data?: CarrierVO[] }) => {
        if (res?.code === 200) setCarriers(res.data ?? [])
      })
      .catch(() => setCarriers([]))
  }, [])

  const [traceRow, setTraceRow] = useState<LogisticsVO | null>(null)
  const [traces, setTraces] = useState<LogisticsTraceVO[]>([])
  const [traceLoading, setTraceLoading] = useState(false)

  const [viewing, setViewing] = useState<LogisticsVO | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['logistics'] })

  const openEdit = (row: LogisticsVO) => {
    setEditing(row)
    form.setFieldsValue({
      status: row.logisticsStatus,
      location: row.currentLocation,
      signReceiver: row.signReceiver,
      carrierId: row.carrierId ?? undefined,
      logisticsType: row.logisticsType ?? undefined,
      freightAmount: row.freightAmount ?? undefined,
      receiverContact: row.receiverContact ?? undefined,
      receiverPhone: row.receiverPhone ?? undefined,
      receiverAddress: row.receiverAddress ?? undefined
    })
  }

  const submitEdit = async () => {
    if (!editing) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      // 先改"安排运输"的字段（承运商/类型/运费/收货信息）
      const basic = await updateLogistics(editing.id, {
        carrierId: values.carrierId,
        logisticsType: values.logisticsType,
        freightAmount: values.freightAmount,
        receiverContact: values.receiverContact,
        receiverPhone: values.receiverPhone,
        receiverAddress: values.receiverAddress
      })
      if (basic?.code !== 200) {
        message.error(basic?.message ?? '保存失败')
        return
      }
      // 状态单独走状态接口（它会顺带写一条轨迹）
      const res = await updateLogisticsStatus(editing.id, values.status, {
        location: values.location,
        signReceiver: values.signReceiver
      })
      if (res?.code === 200) {
        message.success('物流状态已更新')
        setEditing(null)
        refresh()
      } else {
        message.error(res?.message ?? '更新失败')
      }
    } catch {
      message.error('更新失败（请检查后端是否在运行）')
    } finally {
      setSaving(false)
    }
  }

  const openTrace = async (row: LogisticsVO) => {
    setTraceRow(row)
    setTraces([])
    setTraceLoading(true)
    try {
      const res = await getLogisticsTraces(row.id)
      if (res?.code === 200) {
        setTraces(res.data ?? [])
      } else {
        message.error(res?.message ?? '加载轨迹失败')
      }
    } catch {
      message.error('加载轨迹失败')
    } finally {
      setTraceLoading(false)
    }
  }

  const handleDelete = async (row: LogisticsVO) => {
    try {
      const res = await deleteLogistics(row.id)
      if (res?.code === 200) {
        message.success('已删除')
        refresh()
      } else {
        message.error(res?.message ?? '删除失败')
      }
    } catch {
      message.error('删除失败')
    }
  }

  const columns = [
    { title: '物流单号', dataIndex: 'logisticsNo', key: 'logisticsNo' },
    { title: '订单编号', dataIndex: 'orderId', key: 'orderId' },
    { title: '承运商', dataIndex: 'carrierName', key: 'carrierName' },
    {
      title: '物流类型',
      dataIndex: 'logisticsType',
      key: 'logisticsType',
      render: (value: string) => LOGISTICS_TYPE[value] ?? value
    },
    { title: '运费', dataIndex: 'freightAmount', key: 'freightAmount', render: (val: number) => `¥${val}` },
    // 物流表用 sender_* / receiver_* 命名，没有 deliveryAddress（那是订单表的字段）
    { title: '收货地址', dataIndex: 'receiverAddress', key: 'receiverAddress', ellipsis: true },
    {
      title: '物流状态',
      dataIndex: 'logisticsStatus',
      key: 'logisticsStatus',
      render: (value: string) => <Tag color={LOGISTICS_STATUS[value]?.color ?? 'default'}>{statusText(value)}</Tag>
    },
    { title: '当前位置', dataIndex: 'currentLocation', key: 'currentLocation', ellipsis: true,
      render: (v: string) => v ?? '—' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    {
      title: '操作',
      key: 'action',
      width: 230,
      render: (_: unknown, row: LogisticsVO) => (
        <Space size={0}>
          <Button type="link" icon={<TruckOutlined />} onClick={() => openTrace(row)}>跟踪</Button>
          <Button type="link" icon={<EyeOutlined />} onClick={() => setViewing(row)}>查看</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title="确定删除这条物流单吗？" okText="确 定" cancelText="取 消" onConfirm={() => handleDelete(row)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <Card title="物流管理">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input
          placeholder="物流单号"
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          allowClear
          onChange={(e) => setDraft((prev) => ({ ...prev, logisticsNo: e.target.value || undefined }))}
        />
        <Select
          placeholder="物流状态"
          style={{ width: 150 }}
          allowClear
          onChange={(v) => setDraft((prev) => ({ ...prev, logisticsStatus: v }))}
          options={Object.entries(LOGISTICS_STATUS).map(([value, item]) => ({ value, label: item.text }))}
        />
        <Button type="primary" onClick={() => setQuery((prev) => ({ ...prev, pageNum: 1, ...draft }))}>搜索</Button>
        <Button onClick={() => { setDraft({}); setQuery({ pageNum: 1, pageSize: 10 }) }}>重置</Button>
      </div>
      <Table
        columns={columns}
        dataSource={data?.data?.records || []}
        loading={isLoading}
        rowKey="id"
        scroll={{ x: 1300 }}
        pagination={{
          current: data?.data?.current,
          total: data?.data?.total,
          pageSize: query.pageSize,
          onChange: (page, size) => setQuery((prev) => ({ ...prev, pageNum: page, pageSize: size }))
        }}
      />

      <Modal
        title={`编辑物流单${editing ? ' · ' + editing.logisticsNo : ''}`}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={submitEdit}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="carrierId" label="承运商" extra="原先创建后承运商改不了，现在可以在这里改">
            <Select
              allowClear
              placeholder="选择承运商"
              options={carriers.map((c) => ({ value: c.id, label: c.carrierName }))}
            />
          </Form.Item>
          <Form.Item name="logisticsType" label="物流类型">
            <Select
              allowClear
              placeholder="选择物流类型"
              options={Object.entries(LOGISTICS_TYPE).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="freightAmount" label="运费">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="可留空" />
          </Form.Item>
          <Form.Item name="status" label="物流状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={Object.entries(LOGISTICS_STATUS).map(([value, item]) => ({ value, label: item.text }))} />
          </Form.Item>
          <Form.Item name="location" label="当前位置">
            <Input placeholder="例如 山东省潍坊市寒亭区" />
          </Form.Item>
          <Form.Item name="signReceiver" label="签收人">
            <Input placeholder="状态选到「已签收」时填写" />
          </Form.Item>
          <Form.Item name="receiverContact" label="收货人">
            <Input placeholder="可留空" />
          </Form.Item>
          <Form.Item name="receiverPhone" label="收货电话">
            <Input placeholder="可留空" />
          </Form.Item>
          <Form.Item name="receiverAddress" label="收货地址">
            <Input.TextArea rows={2} placeholder="可留空" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`物流轨迹${traceRow ? ' · ' + traceRow.logisticsNo : ''}`}
        open={!!traceRow}
        onCancel={() => setTraceRow(null)}
        footer={null}
        width={700}
      >
        <Table
          rowKey="id"
          size="small"
          loading={traceLoading}
          dataSource={traces}
          pagination={false}
          locale={{ emptyText: '暂无轨迹记录' }}
          columns={[
            { title: '时间', dataIndex: 'traceTime', key: 'traceTime', width: 170 },
            { title: '节点', dataIndex: 'traceDescription', key: 'traceDescription',
              render: (v: string, row: LogisticsTraceVO) => v ?? statusText(row.traceStatus) },
            { title: '位置', dataIndex: 'traceLocation', key: 'traceLocation',
              render: (v: string) => v ?? '—' }
          ]}
        />
      </Modal>

      <Modal
        title="物流单详情"
        open={!!viewing}
        onCancel={() => setViewing(null)}
        footer={null}
        width={700}
      >
        {viewing && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="物流单号">{viewing.logisticsNo}</Descriptions.Item>
            <Descriptions.Item label="订单编号">{viewing.orderId}</Descriptions.Item>
            <Descriptions.Item label="承运商">{viewing.carrierName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="物流类型">{LOGISTICS_TYPE[viewing.logisticsType] ?? viewing.logisticsType ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="运费">{viewing.freightAmount != null ? `¥${viewing.freightAmount}` : '—'}</Descriptions.Item>
            <Descriptions.Item label="物流状态">
              <Tag color={LOGISTICS_STATUS[viewing.logisticsStatus]?.color ?? 'default'}>
                {statusText(viewing.logisticsStatus)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="发货地址" span={2}>{viewing.senderAddress ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="收货地址" span={2}>{viewing.receiverAddress ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="收货人">{viewing.receiverContact ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{viewing.receiverPhone ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="揽收时间">{viewing.pickupTime ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="送达时间">{viewing.deliveryTime ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="签收时间">{viewing.signTime ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="签收人">{viewing.signReceiver ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="当前位置" span={2}>{viewing.currentLocation ?? '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Card>
  )
}

export default LogisticsList
