import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button } from 'antd'
import { FileTextOutlined, DownloadOutlined } from '@ant-design/icons'

function ReportList() {
  const { data: reportData } = useQuery<{ data: { list: { id: number; name: string; type: string; generateTime: string; status: string }[]; total: number } }>({
    queryKey: ['reports'],
    queryFn: () => Promise.resolve({ data: { list: [], total: 0 } }),
    initialData: {
      data: {
        list: [
          { id: 1, name: '日报-2024-01-15', type: '日报', generateTime: '2024-01-15 00:00', status: 'completed' },
          { id: 2, name: '周报-2024-01-08至01-14', type: '周报', generateTime: '2024-01-14 00:00', status: 'completed' },
        ],
        total: 2,
      },
    },
  })

  const columns = [
    { title: '报表名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => (
        <span style={{ color: '#3b82f6' }}>{text}</span>
      ),
    },
    { title: '生成时间', dataIndex: 'generateTime', key: 'generateTime' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => (
        <span style={{ color: text === 'completed' ? '#10b981' : '#f59e0b' }}>
          {text === 'completed' ? '已完成' : '生成中'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Button icon={<DownloadOutlined />}>下载</Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1f2937' }}>报表管理</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>管理系统报表</p>
        </div>
        <Button type="primary" icon={<FileTextOutlined />}>
          生成报表
        </Button>
      </div>
      <Card>
        <Table columns={columns} dataSource={reportData?.data?.list} rowKey="id" />
      </Card>
    </div>
  )
}

export default ReportList
