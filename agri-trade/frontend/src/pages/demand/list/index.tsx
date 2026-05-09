import { Table, Button, Card, Input, Select, Space } from 'antd'
import { EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getDemandList } from '@/api/demand'

function DemandList() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['demands'],
    queryFn: () => getDemandList({ pageNum: 1, pageSize: 10 }),
  })

  const columns = [
    { title: '需求编号', dataIndex: 'demandNo', key: 'demandNo' },
    { title: '采购商', dataIndex: 'buyerName', key: 'buyerName' },
    { title: '商品分类', dataIndex: 'categoryName', key: 'categoryName' },
    { title: '品种', dataIndex: 'variety', key: 'variety' },
    { title: '需求数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '价格范围', key: 'priceRange', render: (_: unknown, record: { priceMin: number; priceMax: number }) => 
      `¥${record.priceMin}-${record.priceMax}` 
    },
    { title: '需求状态', dataIndex: 'demandStatus', key: 'demandStatus' },
    { title: '响应次数', dataIndex: 'responseCount', key: 'responseCount' },
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
    <Card title="需求管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/demand/create')}>发布需求</Button>}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input placeholder="需求编号" prefix={<SearchOutlined />} style={{ width: 200 }} />
        <Select placeholder="需求状态" style={{ width: 150 }} options={[
          { value: 'all', label: '全部' },
          { value: 'pending', label: '待匹配' },
          { value: 'matched', label: '已匹配' },
          { value: 'completed', label: '已完成' },
          { value: 'cancelled', label: '已取消' },
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

export default DemandList