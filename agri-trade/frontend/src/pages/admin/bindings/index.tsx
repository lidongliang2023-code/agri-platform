import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Modal, Select, Tag, Tooltip, message } from 'antd'
import { InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { ListRowActions } from '@agri/shared'
import {
  changeBindingStatus, createBinding, getBindings, type BindingQuery, type UserMerchantBinding
} from '@/api/admin-bindings'
import { TradeFilters, TradeList } from '@/components/TradeList'
import './bindings-dense.css'

const ROLES: Record<string, string> = {
  owner: '负责人',
  buyer: '采购',
  seller: '销售',
  finance: '财务'
}

const MERCHANT_TYPES: Record<string, string> = {
  BUYER: '采购方',
  SELLER: '供应方',
  BOTH: '购销一体'
}

/**
 * 用户-经营主体绑定（运营端）。
 */
export default function AdminBindings() {
  const [rows, setRows] = useState<UserMerchantBinding[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState<BindingQuery>({ pageNum: 1, pageSize: 20 })
  const [filters, setFilters] = useState<{ userId?: string; merchantId?: string }>({})
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback((next: BindingQuery) => {
    setLoading(true)
    getBindings(next)
      .then((res: { code: number; message?: string; data?: { records?: UserMerchantBinding[]; total?: number } }) => {
        if (res?.code === 0) {
          setRows(res.data?.records ?? [])
          setTotal(Number(res.data?.total ?? 0))
        } else {
          message.error(res?.message ?? '加载绑定关系失败')
        }
      })
      .catch(() => message.error('加载绑定关系失败（请检查 core-platform 是否在运行）'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(query)
  }, [query, load])

  const handleQuery = () => {
    setQuery((prev) => ({
      ...prev,
      pageNum: 1,
      userId: filters.userId?.trim() || undefined,
      merchantId: filters.merchantId?.trim() || undefined,
    }))
  }

  const handleReset = () => {
    setFilters({})
    setQuery((prev) => ({ pageNum: 1, pageSize: prev.pageSize }))
  }

  const submit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = await createBinding(values)
      if (res?.code === 0) {
        message.success('绑定已创建')
        setAddOpen(false)
        form.resetFields()
        load(query)
      } else {
        message.error(res?.message ?? '绑定失败')
      }
    } catch {
      message.error('绑定失败（请检查 core-platform 是否在运行）')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (row: UserMerchantBinding) => {
    const next = row.status === 1 ? 0 : 1
    try {
      const res = await changeBindingStatus(row.id, next)
      if (res?.code === 0) {
        message.success(next === 1 ? '已启用' : '已停用')
        load(query)
      } else {
        message.error(res?.message ?? '操作失败')
      }
    } catch {
      message.error('操作失败（请检查 core-platform 是否在运行）')
    }
  }

  return (
    <div className="trade-bindings-dense" style={{ padding: 20 }}>
      <TradeList<UserMerchantBinding>
        listId="admin-bindings"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        onRefresh={() => load(query)}
        toolbarLeft={(
          <>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.setFieldsValue({ roleInMerchant: 'buyer' })
                setAddOpen(true)
              }}
            >
              新增绑定
            </Button>
            <Tooltip title="用户端订单/纠纷的可见范围 = 当前登录用户绑定的经营主体。停用某条绑定后，该用户立刻不再以这家主体的身份查看数据（记录保留，便于追溯任职历史）。">
              <span className="trade-bindings-head-note">
                <InfoCircleOutlined />
                <span>决定登录用户的经营主体数据范围，停用后立即生效且保留历史记录</span>
              </span>
            </Tooltip>
          </>
        )}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={handleQuery}
            onReset={handleReset}
            fields={[
              {
                label: '用户 ID',
                control: (
                  <Input
                    allowClear
                    value={filters.userId}
                    placeholder="按用户 ID 筛选"
                    onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value || undefined }))}
                    onPressEnter={handleQuery}
                  />
                ),
              },
              {
                label: '经营主体 ID',
                control: (
                  <Input
                    allowClear
                    value={filters.merchantId}
                    placeholder="按经营主体 ID 筛选"
                    onChange={(e) => setFilters((prev) => ({ ...prev, merchantId: e.target.value || undefined }))}
                    onPressEnter={handleQuery}
                  />
                ),
              },
            ]}
          />
        )}
        pagination={{
          current: query.pageNum,
          pageSize: query.pageSize,
          total,
          onChange: (page, size) => setQuery((prev) => ({ ...prev, pageNum: page, pageSize: size })),
        }}
        columns={[
          { title: '用户 ID', dataIndex: 'userId', width: 196, ellipsis: true },
          { title: '经营主体 ID', dataIndex: 'merchantId', width: 140, ellipsis: true },
          {
            title: '经营主体',
            dataIndex: 'merchantName',
            width: 190,
            ellipsis: true,
            render: (v: string | null) => {
              const text = v ?? '—'
              return <span className="trade-bindings-ellipsis" title={text}>{text}</span>
            }
          },
          {
            title: '主体类型',
            dataIndex: 'merchantType',
            width: 110,
            ellipsis: true,
            render: (v: string | null) => (v ? MERCHANT_TYPES[v] ?? v : '—')
          },
          {
            title: '主体内角色',
            dataIndex: 'roleInMerchant',
            width: 112,
            render: (v: string) => <Tag color="blue">{ROLES[v] ?? v}</Tag>
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 104,
            render: (v: number) =>
              v === 1 ? <Tag color="success">启用中</Tag> : <Tag color="default">已停用</Tag>
          },
          { title: '创建时间', dataIndex: 'createdAt', width: 168, ellipsis: true },
          {
            title: '操作',
            key: 'action',
            width: 104,
            render: (_: unknown, row: UserMerchantBinding) => (
              <ListRowActions>
                <Button type="link" size="small" onClick={() => toggleStatus(row)}>
                  {row.status === 1 ? '停用' : '启用'}
                </Button>
              </ListRowActions>
            )
          }
        ]}
      />

      <Modal
        title="新增用户-经营主体绑定"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="两个 ID 都要填对"
          description="用户 ID 是平台账号号（platform_user.id），经营主体 ID 是注册主体号（platform_merchant.id，例如 2001）。填错不会报错，只会让这个人看不到或看到不该看的数据，所以提交前请核对。"
        />
        <Form form={form} layout="vertical">
          <Form.Item name="userId" label="用户 ID" rules={[{ required: true, message: '请填写用户 ID' }]}>
            <Input placeholder="例如 2108130996492058625" />
          </Form.Item>
          <Form.Item name="merchantId" label="经营主体 ID" rules={[{ required: true, message: '请填写经营主体 ID' }]}>
            <Input placeholder="例如 2001" />
          </Form.Item>
          <Form.Item name="roleInMerchant" label="主体内角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              options={Object.entries(ROLES).map(([value, label]) => ({ value, label }))}
              placeholder="选择该用户在这家主体里的角色"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
