import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { changeCarrierStatus, createCarrier, getCarrierPage, type CarrierRow } from '@/api/carrier'

const CARRIER_TYPE: Record<string, string> = {
  express: '快递',
  cold_chain: '冷链',
  normal: '普通货运',
  // 库里存的是 railway（中铁特货那一条），原先这里写的是 rail ——
  // 对不上就原样打印，页面上会出现英文的 "railway"。
  railway: '铁路特货',
  rail: '铁路',
  air: '航空',
  sea: '海运',
  truck: '公路运输'
}

/**
 * 承运商管理（运营端）。
 *
 * 承运商是全平台共用的运力主数据。原先只有用户侧的列表/新增，而"新增"挂在用户侧路径上
 * 且没有任何校验 —— 任何登录用户都能往运力库里加一条。这里把新增与启停收归运营端。
 *
 * 停用而不是删除：已经用这家承运商发过货的物流单还要能查到它。
 */
export default function AdminCarrier() {
  const [rows, setRows] = useState<CarrierRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<{ carrierName?: string; status?: number }>({})
  const [draft, setDraft] = useState<{ carrierName?: string; status?: number }>({})
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCarrierPage({ pageNum: page, pageSize: 10, ...filters })
      if (res?.code === 200) {
        setRows(res.data?.records ?? [])
        setTotal(Number(res.data?.total ?? 0))
      } else {
        message.error(res?.message ?? '加载承运商失败')
      }
    } catch {
      message.error('加载承运商失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = await createCarrier(values)
      if (res?.code === 200) {
        message.success('已新增')
        setOpen(false)
        form.resetFields()
        load()
      } else {
        message.error(res?.message ?? '新增失败')
      }
    } catch {
      message.error('新增失败')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (row: CarrierRow) => {
    const next = row.status === 1 ? 0 : 1
    try {
      const res = await changeCarrierStatus(row.id, next)
      if (res?.code === 200) {
        message.success(next === 1 ? '已启用' : '已停用')
        load()
      } else {
        message.error(res?.message ?? '操作失败')
      }
    } catch {
      message.error('操作失败')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <Card
        title={`承运商 ${total} 家`}
        extra={
          <Space>
            <Input placeholder="按名称搜索" style={{ width: 160 }} allowClear
              onChange={(e) => setDraft((p) => ({ ...p, carrierName: e.target.value || undefined }))} />
            <Select placeholder="状态" style={{ width: 110 }} allowClear
              onChange={(v) => setDraft((p) => ({ ...p, status: v }))}
              options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]} />
            <Button onClick={() => { setPage(1); setFilters(draft) }}>查询</Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ status: 1 }); setOpen(true) }}>新增承运商</Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="承运商是全平台共用的运力主数据"
          description="商家在编辑物流单时从这里选承运商。停用后不再出现在可选列表里，但已经用过的物流单仍能查到它 —— 所以这里用停用而不是删除。"
        />
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1300 }}
          pagination={{ current: page, pageSize: 10, total, onChange: setPage }}
          columns={[
            { title: '承运商编码', dataIndex: 'carrierCode', width: 160 },
            { title: '名称', dataIndex: 'carrierName', width: 160 },
            { title: '类型', dataIndex: 'carrierType', width: 110,
              render: (v: string) => CARRIER_TYPE[v] ?? v ?? '—' },
            { title: '联系人', dataIndex: 'contactPerson', width: 100, render: (v: string) => v ?? '—' },
            { title: '联系电话', dataIndex: 'contactPhone', width: 140, render: (v: string) => v ?? '—' },
            { title: '覆盖范围', dataIndex: 'serviceScope', ellipsis: true, render: (v: string) => v ?? '—' },
            { title: '准时率', dataIndex: 'onTimeRate', width: 100, align: 'right' as const,
              render: (v: number) => (v == null ? '—' : `${v}%`) },
            { title: '评分', dataIndex: 'rating', width: 90, align: 'right' as const,
              render: (v: number) => (v == null ? '—' : v) },
            { title: '承运单数', dataIndex: 'orderCount', width: 100, align: 'right' as const,
              render: (v: number) => v ?? 0 },
            { title: '状态', dataIndex: 'status', width: 90,
              render: (v: number) => <Tag color={v === 1 ? 'success' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag> },
            {
              title: '操作',
              width: 100,
              fixed: 'right' as const,
              render: (_: unknown, row: CarrierRow) => (
                <Popconfirm
                  title={row.status === 1 ? '停用这家承运商？' : '重新启用这家承运商？'}
                  description={row.status === 1 ? '停用后不再出现在商家的可选列表里，已用的物流单不受影响。' : undefined}
                  okText="确 定"
                  cancelText="取 消"
                  onConfirm={() => toggle(row)}
                >
                  <Button type="link">{row.status === 1 ? '停用' : '启用'}</Button>
                </Popconfirm>
              )
            }
          ]}
        />
      </Card>

      <Modal title="新增承运商" open={open} onCancel={() => setOpen(false)} onOk={submit}
        confirmLoading={saving} destroyOnClose width={640}>
        <Form form={form} layout="vertical">
          <Form.Item name="carrierName" label="承运商名称" rules={[{ required: true, message: '请填写名称' }]}>
            <Input placeholder="例如 顺丰冷运" />
          </Form.Item>
          <Form.Item name="carrierType" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={Object.entries(CARRIER_TYPE).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="contactPerson" label="联系人">
            <Input placeholder="可留空" />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话">
            <Input placeholder="可留空" />
          </Form.Item>
          <Form.Item name="serviceScope" label="服务范围说明">
            <Input placeholder="例如 全国冷链次日达" />
          </Form.Item>
          <Form.Item name="onTimeRate" label="准时率(%)">
            <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} placeholder="可留空" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
