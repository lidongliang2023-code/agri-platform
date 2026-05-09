import { Table, Button, Card, Input, Select, Space } from 'antd'
import { EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, TruckOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getLogisticsList } from '@/api/logistics'

function LogisticsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['logistics'],
    queryFn: () => getLogisticsList({ pageNum: 1, pageSize: 10 }),
  })

  const columns = [
    { title: '物流单号', dataIndex: 'logisticsNo', key: 'logisticsNo' },
    { title: '订单编号', dataIndex: 'orderId', key: 'orderId' },
    { title: '承运商', dataIndex: 'carrierName', key: 'carrierName' },
    { title: '物流类型', dataIndex: 'logisticsType', key: 'logisticsType' },
    { title: '运费', dataIndex: 'freightAmount', key: 'freightAmount', render: (val: number) => `¥${val}` },
    { title: '收货地址', dataIndex: 'deliveryAddress', key: 'deliveryAddress', ellipsis: true },
    { title: '物流状态', dataIndex: 'logisticsStatus', key: 'logisticsStatus' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    { title: '操作', key: 'action', render: () => (
      <Space>
        <Button type="link" icon={<TruckOutlined />}>跟踪</Button>
        <Button type="link" icon={<EyeOutlined />}>查看</Button>
        <Button type="link" icon={<EditOutlined />}>编辑</Button>
        <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
      </Space>
    )},
  ]

  return (
    <Card title="物流管理">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input placeholder="物流单号" prefix={<SearchOutlined />} style={{ width: 200 }} />
        <Select placeholder="物流状态" style={{ width: 150 }} options={[
          { value: 'all', label: '全部' },
          { value: 'pending', label: '待取货' },
          { value: 'picked', label: '已取货' },
          { value: 'shipping', label: '运输中' },
          { value: 'arrived', label: '已到达' },
          { value: 'signed', label: '已签收' },
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

export default LogisticsList