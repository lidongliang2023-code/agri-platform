import { Table, Button, Card, Input, Select, Space, Tag } from 'antd'
import { EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, TruckOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getLogisticsList } from '@/api/logistics'

/**
 * 取值来自库里的真实词表：物流类型目前只有 cold_chain，状态是
 * pending / in_transit / delivered（另外订单状态机里会写 picked）。
 * 原先两列直接把枚举原样打印（页面上是 "cold_chain"、"pending"）。
 */
const LOGISTICS_TYPE: Record<string, string> = {
  cold_chain: '冷链',
  normal: '普通货运',
  express: '快递',
  self_pickup: '自提'
}

const LOGISTICS_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待发运', color: 'warning' },
  picked: { text: '已揽收', color: 'processing' },
  in_transit: { text: '运输中', color: 'processing' },
  delivered: { text: '已送达', color: 'success' },
  signed: { text: '已签收', color: 'success' },
  exception: { text: '异常', color: 'error' }
}

function LogisticsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['logistics'],
    queryFn: () => getLogisticsList({ pageNum: 1, pageSize: 10 }),
  })

  const columns = [
    { title: '物流单号', dataIndex: 'logisticsNo', key: 'logisticsNo' },
    { title: '订单编号', dataIndex: 'orderId', key: 'orderId' },
    { title: '承运商', dataIndex: 'carrierName', key: 'carrierName' },
    {
      title: '物流类型',
      dataIndex: 'logisticsType',
      key: 'logisticsType',
      render: (value: string) => LOGISTICS_TYPE[value] ?? value
    },
    { title: '运费', dataIndex: 'freightAmount', key: 'freightAmount', render: (val: number) => `¥${val}` },
  // 物流表用 sender_* / receiver_* 命名，没有 deliveryAddress（那是订单表的字段）
  { title: '收货地址', dataIndex: 'receiverAddress', key: 'receiverAddress', ellipsis: true },
    {
      title: '物流状态',
      dataIndex: 'logisticsStatus',
      key: 'logisticsStatus',
      render: (value: string) => {
        const hit = LOGISTICS_STATUS[value]
        return <Tag color={hit?.color ?? 'default'}>{hit?.text ?? value}</Tag>
      }
    },
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
