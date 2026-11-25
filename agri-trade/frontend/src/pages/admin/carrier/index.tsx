import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { ListRowActions } from '@agri/shared'
import { changeCarrierStatus, createCarrier, getCarrierPage, type CarrierRow } from '@/api/carrier'
import { TradeFilters, TradeList } from '@/components/TradeList'

const CARRIER_TYPE: Record<string, string> = {
  express: '快递',
  cold_chain: '冷链',
  normal: '普通货运',
  railway: '铁路特货',
  rail: '铁路',
  air: '航空',
  sea: '海运',
  truck: '公路运输'
}

/**
 * 承运商管理（运营端）。
 */
export default function AdminCarrier() {
  const [rows, setRows] = useState<CarrierRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<{ carrierName?: string; status?: number }>({})
  const [draft, setDraft] = useState<{ carrierName?: string; status?: number }>({})
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCarrierPage({ pageNum: page, pageSize, ...filters })
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
  }, [page, pageSize, filters])

  useEffect(() => {
    load()
  }, [load])

  const handleQuery = () => {
    setPage(1)
    setFilters({ ...draft, carrierName: draft.carrierName?.trim() || undefined })
  }

  const handleReset = () => {
    setDraft({})
    setFilters({})
    setPage(1)
  }

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
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="承运商是全平台共用的运力主数据"
        description="商家在编辑物流单时从这里选承运商。停用后不再出现在可选列表里，但已经用过的物流单仍能查到它 —— 所以这里用停用而不是删除。"
      />

      <TradeList<CarrierRow>
        listId="admin-carrier"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        onRefresh={load}
        toolbarLeft={(
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields()
              form.setFieldsValue({ status: 1 })
              setOpen(true)
            }}
          >
            新增承运商
          </Button>
        )}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={handleQuery}
            onReset={handleReset}
            fields={[
              {
                label: '承运商名称',
                control: (
                  <Input
                    allowClear
                    value={draft.carrierName}
                    placeholder="按名称搜索"
                    onChange={(e) => setDraft((p) => ({ ...p, carrierName: e.target.value || undefined }))}
                    onPressEnter={handleQuery}
                  />
                ),
              },
              {
                label: '状态',
                control: (
                  <Select
                    allowClear
                    value={draft.status}
                    placeholder="全部状态"
                    onChange={(v) => setDraft((p) => ({ ...p, status: v }))}
                    options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]}
                  />
                ),
              },
            ]}
          />
        )}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage)
            setPageSize(nextSize)
          },
        }}
        columns={[
          { title: '承运商编码', dataIndex: 'carrierCode', width: 160, ellipsis: true },
          { title: '名称', dataIndex: 'carrierName', width: 160, ellipsis: true },
          { title: '类型', dataIndex: 'carrierType', width: 110, render: (v: string) => CARRIER_TYPE[v] ?? v ?? '—' },
          { title: '联系人', dataIndex: 'contactPerson', width: 100, render: (v: string) => v ?? '—' },
          { title: '联系电话', dataIndex: 'contactPhone', width: 140, render: (v: string) => v ?? '—' },
          { title: '覆盖范围', dataIndex: 'serviceScope', width: 200, ellipsis: true, render: (v: string) => v ?? '—' },
          { title: '准时率', dataIndex: 'onTimeRate', width: 100, render: (v: number) => (v == null ? '—' : `${v}%`) },
          { title: '评分', dataIndex: 'rating', width: 90, render: (v: number) => (v == null ? '—' : v) },
          { title: '承运单数', dataIndex: 'orderCount', width: 100, render: (v: number) => v ?? 0 },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (v: number) => <Tag color={v === 1 ? 'success' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag>
          },
          {
            title: '操作',
            key: 'action',
            width: 104,
            render: (_: unknown, row: CarrierRow) => (
              <ListRowActions>
                <Popconfirm
                  title={row.status === 1 ? '停用这家承运商？' : '重新启用这家承运商？'}
                  description={row.status === 1 ? '停用后不再出现在商家的可选列表里，已用的物流单不受影响。' : undefined}
                  okText="确 定"
                  cancelText="取 消"
                  onConfirm={() => toggle(row)}
                >
                  <Button type="link" size="small">{row.status === 1 ? '停用' : '启用'}</Button>
                </Popconfirm>
              </ListRowActions>
            )
          }
        ]}
      />

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
