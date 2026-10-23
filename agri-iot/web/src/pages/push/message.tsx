import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Select } from 'antd'
import { SendOutlined } from '@ant-design/icons'

function PushMessage() {
  const { data: messageData } = useQuery<{ data: { list: { id: number; title: string; type: string; target: string; status: string; sendTime: string }[]; total: number } }>({
    queryKey: ['push-messages'],
    queryFn: () => Promise.resolve({ data: { list: [], total: 0 } }),
    initialData: {
      data: {
        list: [
          { id: 1, title: '温度异常告警', type: '短信', target: '138****1234', status: 'success', sendTime: '2024-01-15 14:30' },
          { id: 2, title: '湿度异常告警', type: '邮件', target: 'admin@example.com', status: 'success', sendTime: '2024-01-15 10:15' },
        ],
        total: 2,
      },
    },
  })

  const columns = [
    { title: '消息标题', dataIndex: 'title', key: 'title' },
    {
      title: '推送类型',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => (
        <span style={{ color: text === '短信' ? '#f59e0b' : '#3b82f6' }}>{text}</span>
      ),
    },
    { title: '接收目标', dataIndex: 'target', key: 'target' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => (
        <span style={{ color: text === 'success' ? '#10b981' : text === 'failed' ? '#ef4444' : '#f59e0b' }}>
          {text === 'success' ? '成功' : text === 'failed' ? '失败' : '发送中'}
        </span>
      ),
    },
    { title: '发送时间', dataIndex: 'sendTime', key: 'sendTime' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1f2937' }}>推送消息</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>查看推送消息记录</p>
        </div>
        <Button type="primary" icon={<SendOutlined />}>
          发送消息
        </Button>
      </div>
      <Card>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <Select
            placeholder="推送类型"
            style={{ width: 150 }}
            options={[{ value: '', label: '全部' }, { value: '短信', label: '短信' }, { value: '邮件', label: '邮件' }]}
          />
          <Select
            placeholder="发送状态"
            style={{ width: 150 }}
            options={[{ value: '', label: '全部' }, { value: 'success', label: '成功' }, { value: 'failed', label: '失败' }]}
          />
        </div>
        <Table columns={columns} dataSource={messageData?.data?.list} rowKey="id" />
      </Card>
    </div>
  )
}

export default PushMessage
