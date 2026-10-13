import { Alert, Table, Button, Card, Input, Select, Space } from 'antd'
import { DeleteOutlined, SearchOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getDisputeList } from '@/api/dispute'
import { getMyMerchants } from '@/api/identity'

function DisputeList() {
  // 只查"与我有关"的纠纷。范围由后端按登录令牌推导，前端不再自报参与方
  // （原先传的是平台用户 id，与纠纷表里的主体号不是一个域，所以永远查不到）。
  const { data, isLoading } = useQuery({
    queryKey: ['disputes'],
    queryFn: () => getDisputeList({ pageNum: 1, pageSize: 10 }),
  })
  // 把"没有纠纷"和"没绑主体"分开显示，避免一张说不清的空表
  const { data: merchantData } = useQuery({ queryKey: ['my-merchants'], queryFn: getMyMerchants })
  const merchants = merchantData?.code === 200 ? merchantData.data ?? [] : null
  const identityError = merchantData && merchantData.code !== 200 ? merchantData.message ?? '无法解析你的经营主体' : null

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
      {identityError && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message="身份解析失败" description={identityError} />
      )}
      {!identityError && merchants?.length === 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="当前账号还没有绑定经营主体"
          description="因此查询不到任何纠纷。请运营在「用户-主体绑定」里为你绑定经营主体后重试。"
        />
      )}
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
