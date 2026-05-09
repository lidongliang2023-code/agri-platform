import { Table, Button, Card, Input, Select, Space } from 'antd'
import { EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getProductList } from '@/api/product'

function ProductList() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => getProductList({ pageNum: 1, pageSize: 10 }),
  })

  const columns = [
    { title: '商品编码', dataIndex: 'productCode', key: 'productCode' },
    { title: '商品名称', dataIndex: 'productName', key: 'productName' },
    { title: '卖家', dataIndex: 'sellerName', key: 'sellerName' },
    { title: '分类', dataIndex: 'categoryName', key: 'categoryName' },
    { title: '品种', dataIndex: 'variety', key: 'variety' },
    { title: '价格', dataIndex: 'price', key: 'price', render: (val: number) => `¥${val}` },
    { title: '库存', dataIndex: 'stockQuantity', key: 'stockQuantity' },
    { title: '发布状态', dataIndex: 'publishStatus', key: 'publishStatus' },
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
    <Card title="商品管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/product/create')}>发布货源</Button>}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input placeholder="商品名称" prefix={<SearchOutlined />} style={{ width: 200 }} />
        <Select placeholder="发布状态" style={{ width: 150 }} options={[
          { value: 'all', label: '全部' },
          { value: 'draft', label: '草稿' },
          { value: 'pending', label: '待审核' },
          { value: 'published', label: '已发布' },
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

export default ProductList