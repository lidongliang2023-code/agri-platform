import { Table, Button, Card, Input, Select, Space } from 'antd'
import { EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getOrderList } from '@/api/order'

function OrderList() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => getOrderList({ pageNum: 1, pageSize: 10 }),
  })

  const columns = [
    { title: '订单编号', dataIndex: 'orderNo', key: 'orderNo' },
    { title: '买家', dataIndex: 'buyerName', key: 'buyerName' },
    { title: '卖家', dataIndex: 'sellerName', key: 'sellerName' },
    { title: '商品分类', dataIndex: 'categoryName', key: 'categoryName' },
    { title: '订单金额', dataIndex: 'totalAmount', key: 'totalAmount', render: (val: number) => `¥${val}` },
    { title: '订单状态', dataIndex: 'orderStatus', key: 'orderStatus' },
    { title: '支付状态', dataIndex: 'paymentStatus', key: 'paymentStatus' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    { title: '操作', key: 'action', render: () => (
      <Space>
        <Button type="link" icon={<EyeOutlined />}>查看</Button>
        <Button type="link" icon={<EditOutlined />}>编辑</Button>
        <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
      </Space>
    )},
  ]

  return (
    <Card title="订单管理">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input placeholder="订单编号" prefix={<SearchOutlined />} style={{ width: 200 }} />
        <Select placeholder="订单状态" style={{ width: 150 }} options={[
          { value: 'all', label: '全部' },
          { value: 'pending', label: '待付款' },
          { value: 'paid', label: '已付款' },
          { value: 'shipped', label: '已发货' },
          { value: 'completed', label: '已完成' },
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

export default OrderList