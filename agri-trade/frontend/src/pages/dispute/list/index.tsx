import { Table, Button, Card, Input, Select, Space } from 'antd'
import { DeleteOutlined, SearchOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getDisputeList } from '@/api/dispute'
import { getCurrentUser } from '@/utils/session'

function DisputeList() {
  // 只查"与我有关"的纠纷：后端已取消"不传范围就返回全平台"的兜底。
  // 平台上还没有"用户 ↔ 经营主体"的映射，所以这里传的是平台用户 id，
  // 查不到数据是正确结果（查不到 ≠ 看得到别人的）。
  const participantId = getCurrentUser()?.id
  const { data, isLoading } = useQuery({
    queryKey: ['disputes', participantId],
    queryFn: () => getDisputeList({ pageNum: 1, pageSize: 10, participantId }),
  })

  const columns = [
    { title: '纠纷编号', dataIndex: 'disputeNo', key: 'disputeNo' },
    { title: '订单编号', dataIndex: 'orderId', key: 'orderId' },
  // 纠纷表的申请人是 complainant*（不是 applicant*）；金额只有 claimAmount（索赔金额）
  { title: '申请人', dataIndex: 'complainantName', key: 'complainantName' },
    { title: '被申请人', dataIndex: 'respondentName', key: 'respondentName' },
    { title: '纠纷类型', dataIndex: 'disputeType', key: 'disputeType' },
    { title: '索赔金额', dataIndex: 'claimAmount', key: 'claimAmount', render: (val: number) => `¥${val}` },
  { title: '纠纷内容', dataIndex: 'disputeDescription', key: 'disputeDescription', ellipsis: true },
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
