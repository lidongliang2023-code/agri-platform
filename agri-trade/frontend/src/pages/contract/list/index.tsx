import { Table, Button, Card, Input, Select, Space, Tag } from 'antd'
import { DeleteOutlined, SearchOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getContractList } from '@/api/contract'

/**
 * 取值来自库里的真实词表（contract_status / buyer_sign_status / seller_sign_status）：
 * effective / pending / cancelled，签署是 signed / pending。
 * 原先这三列直接把枚举原样打印，页面上显示的是 "cancelled"、"pending" 这种英文原值。
 * 未登记的新值不猜，原样显示 —— 免得把一个没见过的状态硬翻译成错的含义。
 */
const CONTRACT_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待生效', color: 'warning' },
  effective: { text: '生效中', color: 'success' },
  cancelled: { text: '已取消', color: 'default' },
  expired: { text: '已到期', color: 'default' },
  completed: { text: '已完成', color: 'success' }
}

const SIGN_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待签署', color: 'warning' },
  signed: { text: '已签署', color: 'success' },
  rejected: { text: '已拒签', color: 'error' }
}

const renderTag = (map: Record<string, { text: string; color: string }>) => (value: string) => {
  const hit = map[value]
  return <Tag color={hit?.color ?? 'default'}>{hit?.text ?? value}</Tag>
}

function ContractList() {
  const { data, isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => getContractList({ pageNum: 1, pageSize: 10 }),
  })

  const columns = [
    { title: '合同编号', dataIndex: 'contractNo', key: 'contractNo' },
    { title: '买方', dataIndex: 'buyerName', key: 'buyerName' },
    { title: '卖方', dataIndex: 'sellerName', key: 'sellerName' },
  // 字段名对着接口实际返回的 VO 核过：合同表没有 goodsName / totalAmount / signStatus 这三个字段，
  // 对应的真实字段是 contractName / contractAmount / buyerSignStatus+sellerSignStatus。
  // 原先这三列恒为空白（接口 200、页面看着像"没数据"）。
  { title: '合同名称', dataIndex: 'contractName', key: 'contractName' },
  { title: '合同金额', dataIndex: 'contractAmount', key: 'contractAmount', render: (val: number) => `¥${val}` },
  { title: '买方签署', dataIndex: 'buyerSignStatus', key: 'buyerSignStatus', render: renderTag(SIGN_STATUS) },
  { title: '卖方签署', dataIndex: 'sellerSignStatus', key: 'sellerSignStatus', render: renderTag(SIGN_STATUS) },
    { title: '合同状态', dataIndex: 'contractStatus', key: 'contractStatus', render: renderTag(CONTRACT_STATUS) },
    { title: '生效日期', dataIndex: 'effectiveDate', key: 'effectiveDate' },
    { title: '到期日期', dataIndex: 'expireDate', key: 'expireDate' },
    { title: '操作', key: 'action', render: () => (
      <Space>
        <Button type="link" icon={<EyeOutlined />}>查看</Button>
        <Button type="link" icon={<FileTextOutlined />}>下载PDF</Button>
        <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
      </Space>
    )},
  ]

  return (
    <Card title="合同管理">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input placeholder="合同编号" prefix={<SearchOutlined />} style={{ width: 200 }} />
        <Select placeholder="合同状态" style={{ width: 150 }} options={[
          { value: 'all', label: '全部' },
          { value: 'draft', label: '草稿' },
          { value: 'pending', label: '待签署' },
          { value: 'signed', label: '已签署' },
          { value: 'effective', label: '已生效' },
          { value: 'expired', label: '已到期' },
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

export default ContractList
