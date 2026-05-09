import { Table, Button, Card, Input, Select, Space } from 'antd'
import { DeleteOutlined, SearchOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getDisputeList } from '@/api/dispute'

function DisputeList() {
  const { data, isLoading } = useQuery({
    queryKey: ['disputes'],
    queryFn: () => getDisputeList({ pageNum: 1, pageSize: 10 }),
  })

  const columns = [
    { title: '纠纷编号', dataIndex: 'disputeNo', key: 'disputeNo' },
    { title: '订单编号', dataIndex: 'orderId', key: 'orderId' },
    { title: '申请人', dataIndex: 'applicantName', key: 'applicantName' },
    { title: '被申请人', dataIndex: 'respondentName', key: 'respondentName' },
    { title: '纠纷类型', dataIndex: 'disputeType', key: 'disputeType' },
    { title: '纠纷金额', dataIndex: 'disputeAmount', key: 'disputeAmount', render: (val: number) => `¥${val}` },
    { title: '索赔金额', dataIndex: 'claimAmount', key: 'claimAmount', render: (val: number) => `¥${val}` },
    { title: '纠纷内容', dataIndex: 'disputeContent', key: 'disputeContent', ellipsis: true },
    { title: '纠纷状态', dataIndex: 'disputeStatus', key: 'disputeStatus',
      render: (status: string) => {
        if (status === 'pending') return <span style={{ color: '#faad14' }}>待处理</span>
        if (status === 'mediating') return <span style={{ color: '#1890ff' }}>调解中</span>
        if (status === 'arbitrating') return <span style={{ color: '#722ed1' }}>仲裁中</span>
        if (status === 'resolved') return <span style={{ color: '#52c41a' }}>已解决</span>
        return <span style={{ color: '#999' }}>{status}</span>
      }
    },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    { title: '操作', key: 'action', render: () => (
      <Space>
        <Button type="link" icon={<EyeOutlined />}>查看详情</Button>
        <Button type="link" icon={<SettingOutlined />}>处理</Button>
        <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
      </Space>
    )},
  ]

  return (
    <Card title="纠纷管理">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input placeholder="纠纷编号/订单号" prefix={<SearchOutlined />} style={{ width: 200 }} />
        <Select placeholder="纠纷状态" style={{ width: 150 }} options={[
          { value: 'all', label: '全部' },
          { value: 'pending', label: '待处理' },
          { value: 'mediating', label: '调解中' },
          { value: 'arbitrating', label: '仲裁中' },
          { value: 'resolved', label: '已解决' },
        ]} />
        <Button type="primary">搜索</Button>
      </div>
      <Table 
        columns={columns} 
        dataSource={data?.data?.records || []} 
        loading={isLoading}
        rowKey="id" 
        pagination={{
          current: data?.data?.current,
          total: data?.data?.total,
          pageSize: 10,
        }}
      />
    </Card>
  )
}

export default DisputeList