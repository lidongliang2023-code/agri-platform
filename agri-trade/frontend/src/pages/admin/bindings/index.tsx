import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Button, Card, Col, Form, Input, Modal, Row, Select, Space, Table, Tag, message
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  changeBindingStatus, createBinding, getBindings, type BindingQuery, type UserMerchantBinding
} from '@/api/admin-bindings'

/** 主体内角色：决定这个人在这家主体里是买方还是卖方（撮合场景里两种身份都常见）。 */
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
 *
 * <p>为什么需要这个页面：交易各表里的买方/卖方号是**经营主体号**，而登录得到的是
 * **平台用户号**，两者之间此前没有任何映射 —— 子系统因此回答不了"这个登录用户是哪个买家/卖家"，
 * 只能退化成由前端自报身份（谁都能看别人的单据）。绑定关系建起来之后，
 * 服务端才能自己推出"与我有关的数据范围"。</p>
 *
 * <p>判成功看 body.code === 0（平台口径），不是 HTTP 状态行 —— 平台的业务失败
 * 是 HTTP 200 + code 非 0。</p>
 */
export default function AdminBindings() {
  const [rows, setRows] = useState<UserMerchantBinding[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState<BindingQuery>({ pageNum: 1, pageSize: 10 })
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
          // 平台把 Long 一律序列化成字符串（避免 JS 精度丢失），total 也不例外 ——
          // 直接给 antd 用会拿到 "2" 这种值，这里显式转成数字。
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
        // 平台的 409（重复绑定）/ 404（主体不存在）/ 400（缺参数）都走这里
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
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="220px">
            <Input
              allowClear
              placeholder="按用户 ID 筛选"
              onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value || undefined }))}
            />
          </Col>
          <Col flex="220px">
            <Input
              allowClear
              placeholder="按经营主体 ID 筛选"
              onChange={(e) => setFilters((prev) => ({ ...prev, merchantId: e.target.value || undefined }))}
            />
          </Col>
          <Col flex="auto">
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => load(query)}>
                刷新
              </Button>
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
              <Button onClick={() => setQuery((prev) => ({ ...prev, pageNum: 1, ...filters }))}>查询</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title={`绑定关系 ${total} 条`}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="这张表决定子系统能看到哪些数据"
          description="用户端订单/纠纷的可见范围 = 当前登录用户绑定的经营主体。停用某条绑定后，该用户立刻不再以这家主体的身份查看数据（记录保留，便于追溯任职历史）。"
        />
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1000 }}
          pagination={{
            current: query.pageNum,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            onChange: (page, size) => setQuery((prev) => ({ ...prev, pageNum: page, pageSize: size }))
          }}
          columns={[
            { title: '用户 ID', dataIndex: 'userId', width: 200 },
            { title: '经营主体 ID', dataIndex: 'merchantId', width: 120 },
            { title: '经营主体', dataIndex: 'merchantName', width: 180, render: (v: string | null) => v ?? '—' },
            {
              title: '主体类型',
              dataIndex: 'merchantType',
              width: 110,
              render: (v: string | null) => (v ? MERCHANT_TYPES[v] ?? v : '—')
            },
            {
              title: '主体内角色',
              dataIndex: 'roleInMerchant',
              width: 120,
              render: (v: string) => <Tag color="blue">{ROLES[v] ?? v}</Tag>
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (v: number) =>
                v === 1 ? <Tag color="success">启用中</Tag> : <Tag color="default">已停用</Tag>
            },
            { title: '创建时间', dataIndex: 'createdAt', width: 170 },
            {
              title: '操作',
              width: 110,
              fixed: 'right',
              render: (_: unknown, row: UserMerchantBinding) => (
                <Button type="link" size="small" onClick={() => toggleStatus(row)}>
                  {row.status === 1 ? '停用' : '启用'}
                </Button>
              )
            }
          ]}
        />
      </Card>

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
