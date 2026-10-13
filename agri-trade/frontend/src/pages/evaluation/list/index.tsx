import { Table, Button, Card, Input, Select, Space, Rate } from 'antd'
import { EditOutlined, DeleteOutlined, SearchOutlined, MessageOutlined, WarningOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getEvaluationList } from '@/api/evaluation'

function EvaluationList() {
  const { data, isLoading } = useQuery({
    queryKey: ['evaluations'],
    queryFn: () => getEvaluationList({ pageNum: 1, pageSize: 10 }),
  })

  const columns = [
    { title: '评价编号', dataIndex: 'evaluationNo', key: 'evaluationNo' },
    { title: '订单编号', dataIndex: 'orderId', key: 'orderId' },
    { title: '评价人', dataIndex: 'evaluatorName', key: 'evaluatorName' },
    { title: '被评价人', dataIndex: 'evaluateeName', key: 'evaluateeName' },
    { title: '综合评分', dataIndex: 'ratingOverall', key: 'ratingOverall', 
      render: (rating: number) => <Rate disabled defaultValue={rating} />
    },
    { title: '评价内容', dataIndex: 'evaluationContent', key: 'evaluationContent', ellipsis: true },
    { title: '状态', dataIndex: 'evaluationStatus', key: 'evaluationStatus',
      render: (status: string) => status === 'hidden' ? 
        <span style={{ color: '#999' }}>已隐藏</span> : 
        <span style={{ color: '#52c41a' }}>展示中</span>
    },
  // 评价本身没有申诉字段：申诉是独立的 agri_trade_evaluation_appeal 表（有单独的接口）。
  // 这里原先读 appealStatus，而接口里根本没有这个键 —— 一列永远空白。
  { title: '是否匿名', dataIndex: 'isAnonymous', key: 'isAnonymous',
      // isAnonymous 是 0/1，不是原来的申诉状态串 —— 渲染逻辑跟着字段一起改，
      // 否则三种分支都对不上、整列只会显示"已处理"
      render: (val: number) => (val === 1
        ? <span style={{ color: '#999' }}>匿名</span>
        : <span style={{ color: '#52c41a' }}>实名</span>)
    },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    { title: '操作', key: 'action', render: () => (
      <Space>
        <Button type="link" icon={<MessageOutlined />}>回复</Button>
        <Button type="link" icon={<WarningOutlined />}>申诉</Button>
        <Button type="link" icon={<EditOutlined />}>详情</Button>
        <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
      </Space>
    )},
  ]

  return (
    <Card title="信用评价">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input placeholder="评价编号/订单号" prefix={<SearchOutlined />} style={{ width: 200 }} />
        <Select placeholder="评分" style={{ width: 150 }} options={[
          { value: 'all', label: '全部' },
          { value: '5', label: '5星' },
          { value: '4', label: '4星' },
          { value: '3', label: '3星' },
          { value: '1-2', label: '1-2星' },
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

export default EvaluationList
