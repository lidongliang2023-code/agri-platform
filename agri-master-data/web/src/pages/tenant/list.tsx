import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Input, Select, Space, Modal, Form, message, Tag, Typography } from 'antd'
import { EditOutlined, SearchOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { tenantAPI } from '@/api'

interface TenantRow {
  id: string
  tenantName: string
  tenantCode: string
  tenantType?: string
  status: number
  contactPerson?: string
  contactPhone?: string
  createTime?: string
}

interface TenantPage {
  data: {
    list?: TenantRow[]
    records?: TenantRow[]
    total: number
  }
}

const { Text } = Typography

function TenantList() {
  const [searchText, setSearchText] = useState('')
  const [status, setStatus] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: tenantData, refetch, isLoading } = useQuery<TenantPage>({
    queryKey: ['tenants', searchText, status],
    queryFn: () => tenantAPI.list({
      pageNum: 1,
      pageSize: 100,
      keyword: searchText || undefined,
      tenantStatus: status || undefined,
    }),
  })
  const rows = tenantData?.data?.list ?? tenantData?.data?.records ?? []

  const handleEdit = (record: TenantRow) => {
    setEditingId(record.id)
    form.setFieldsValue({
      tenantName: record.tenantName,
      contactName: record.contactPerson,
      contactPhone: record.contactPhone,
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editingId === null) return
    try {
      await tenantAPI.update(editingId, {
        tenantName: values.tenantName,
        contactName: values.contactName,
        contactPerson: values.contactName,
        contactPhone: values.contactPhone,
      })
      message.success('经营主体主体资料已更新')
      setModalVisible(false)
      await refetch()
    } catch {
      message.error('更新失败')
    }
  }

  const handleStatusChange = async (record: TenantRow) => {
    try {
      await tenantAPI.updateStatus(record.id, record.status === 1 ? 0 : 1)
      message.success(record.status === 1 ? '主体已停用' : '主体已启用')
      await refetch()
    } catch {
      message.error('状态更新失败')
    }
  }

  const columns = [
    { title: '主体 / 主体名称', dataIndex: 'tenantName', key: 'tenantName' },
    { title: '主体编码', dataIndex: 'tenantCode', key: 'tenantCode' },
    {
      title: '主体类型',
      dataIndex: 'tenantType',
      key: 'tenantType',
      render: (value: string) => (
        <Tag color={value === 'INDIVIDUAL' ? 'blue' : 'green'}>
          {value === 'INDIVIDUAL' ? '个人主体' : '企业主体'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: number, record: TenantRow) => (
        <Space>
          <span style={{
            color: value === 1 ? '#10b981' : '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            {value === 1 ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
            {value === 1 ? '启用' : '停用'}
          </span>
          <Button size="small" onClick={() => void handleStatusChange(record)}>
            {value === 1 ? '停用' : '启用'}
          </Button>
        </Space>
      ),
    },
    { title: '联系人', dataIndex: 'contactPerson', key: 'contactPerson' },
    { title: '联系电话', dataIndex: 'contactPhone', key: 'contactPhone' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: TenantRow) => (
        <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
      ),
    },
  ]

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>经营主体主体</h2>
          <p style={styles.pageDesc}>
            一个企业或个人经营主体就是一个主体。主体由统一认证注册产生，本页不再单独新建主体。
          </p>
        </div>
      </div>
      <Card style={styles.tableCard}>
        <div style={styles.filterSection}>
          <Input
            placeholder="搜索主体名称 / 编码 / 联系人"
            prefix={<SearchOutlined />}
            value={searchText}
            allowClear
            onChange={(event) => setSearchText(event.target.value)}
            style={styles.searchInput}
          />
          <Select
            placeholder="状态筛选"
            value={status}
            onChange={setStatus}
            style={styles.selectInput}
            options={[
              { value: '', label: '全部' },
              { value: 'ACTIVE', label: '启用' },
              { value: 'INACTIVE', label: '停用' },
            ]}
          />
        </div>
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
        <Text type="secondary">
          主体 ID 与服务端的经营主体 ID 相同；配额、生产数据和交易数据均以该 ID 归属。
        </Text>
      </Card>
      <Modal
        title="编辑经营主体主体"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => void handleSubmit()}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="tenantName" label="主体 / 主体名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contactName" label="联系人">
            <Input />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话">
            <Input />
          </Form.Item>
          <Text type="secondary">主体编码与主体类型来自注册身份，不允许在主体资料中改写。</Text>
        </Form>
      </Modal>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 600,
    color: '#1f2937',
    margin: 0,
    marginBottom: 4,
  },
  pageDesc: {
    fontSize: 14,
    color: '#6b7280',
    margin: 0,
  },
  tableCard: {
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  filterSection: {
    display: 'flex',
    gap: 16,
    marginBottom: 16,
  },
  searchInput: {
    width: 280,
    borderRadius: 8,
  },
  selectInput: {
    width: 150,
    borderRadius: 8,
  },
}

export default TenantList
