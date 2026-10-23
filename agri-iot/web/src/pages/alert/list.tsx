import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Input, Select, Space, message } from 'antd'
import { SearchOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { alertAPI } from '@/api'

function AlertList() {
  const [searchText, setSearchText] = useState('')

  const { data: alertData, refetch } = useQuery<{ data: { list: { id: number; title: string; level: string; status: string; farmName: string; deviceName: string; message: string; createTime: string }[]; total: number } }>({
    queryKey: ['alerts'],
    queryFn: () => alertAPI.list({ title: searchText }),
    initialData: {
      data: {
        list: [
          { id: 1, title: '温度异常', level: 'high', status: 'unhandled', farmName: '阳光农场', deviceName: '温湿度传感器-A1', message: '温度超过35℃预警阈值', createTime: '2024-01-15 14:30' },
          { id: 2, title: '湿度异常', level: 'medium', status: 'handled', farmName: '绿色生态农场', deviceName: '土壤湿度传感器-B1', message: '土壤湿度低于40%', createTime: '2024-01-15 10:15' },
        ],
        total: 2,
      },
    },
  })

  const handleHandle = async (id: number) => {
    try {
      await alertAPI.handle(id, { handled: true })
      message.success('告警已处理')
      refetch()
    } catch {
      message.error('处理失败')
    }
  }

  const columns = [
    { title: '告警标题', dataIndex: 'title', key: 'title' },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (text: string) => (
        <span style={{ color: text === 'high' ? '#ef4444' : text === 'medium' ? '#f59e0b' : '#10b981' }}>
          {text === 'high' ? '高' : text === 'medium' ? '中' : '低'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => {
        const icon = text === 'handled' ? <CheckCircleOutlined /> : <ClockCircleOutlined />
        const color = text === 'handled' ? '#10b981' : '#f59e0b'
        return <span style={{ color, display: 'flex', alignItems: 'center', gap: 4 }}>{icon} {text === 'handled' ? '已处理' : '待处理'}</span>
      },
    },
    { title: '所属农场', dataIndex: 'farmName', key: 'farmName' },
    { title: '设备', dataIndex: 'deviceName', key: 'deviceName' },
    { title: '告警信息', dataIndex: 'message', key: 'message' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'unhandled' && <Button type="primary" onClick={() => handleHandle(record.id)} style={styles.handleBtn}>处理</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>告警管理</h2>
        <p style={styles.pageDesc}>管理系统告警信息</p>
      </div>
      <Card style={styles.tableCard}>
        <div style={styles.filterSection}>
          <Input
            placeholder="搜索告警标题"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={styles.searchInput}
          />
          <Select
            placeholder="级别筛选"
            style={styles.selectInput}
            options={[{ value: '', label: '全部' }, { value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }]}
          />
          <Select
            placeholder="状态筛选"
            style={styles.selectInput}
            options={[{ value: '', label: '全部' }, { value: 'unhandled', label: '待处理' }, { value: 'handled', label: '已处理' }]}
          />
        </div>
        <Table columns={columns} dataSource={alertData?.data?.list} rowKey="id" style={styles.table} />
      </Card>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: {
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
    width: 220,
    borderRadius: 8,
  },
  selectInput: {
    width: 150,
    borderRadius: 8,
  },
  table: {
    borderRadius: 8,
  },
  handleBtn: {
    background: '#10b981',
    borderColor: '#10b981',
    borderRadius: 6,
  },
}

export default AlertList
