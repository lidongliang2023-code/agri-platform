import { useEffect, useState } from 'react'
import { Table, Button, Card, Input, Select, Tag, Modal, Descriptions, Space, Popconfirm, message } from 'antd'
import { SearchOutlined, EyeOutlined, EditOutlined, InboxOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getContractList, signContract, archiveContract, type ContractQuery, type ContractVO } from '@/api/contract'
import { getMyMerchants } from '@/api/identity'

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

/**
 * 合同管理。
 *
 * <p>改动说明：这一页原先搜索框、状态下拉、以及"查看/下载PDF/删除"三个按钮**全都没有接**——
 * 点了什么都不发生，搜索输了字点搜索也没有任何变化（后端连 contractNo 参数都没收）。
 * 现在搜索与筛选真正参与查询，"查看"打开详情弹窗。
 * "下载PDF"与"删除"两个按钮直接去掉：后端没有对应的接口，而且合同属于交易存证，
 * 本来也不该由用户端删掉 —— 留着一个点不动的按钮比没有更糟。</p>
 *
 * <p>另一处口径修正：这个接口原先不给范围就返回**全平台合同**（服务端已按当前账号绑定的
 * 经营主体收口），与订单/纠纷是同一类问题。</p>
 */
function ContractList() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState<ContractQuery>({ pageNum: 1, pageSize: 10 })
  const [draft, setDraft] = useState<{ contractNo?: string; contractStatus?: string }>({})
  const [viewing, setViewing] = useState<ContractVO | null>(null)
  // 我的经营主体：签署方由服务端判定（不接受前端声明我是买方还是卖方），
  // 前端据此决定"签署/归档"按钮显不显示，避免按钮点得动、点了被拒。
  const [myMerchantIds, setMyMerchantIds] = useState<string[]>([])
  const [signing, setSigning] = useState<string | null>(null)

  useEffect(() => {
    getMyMerchants()
      .then((res) => {
        if (res?.code === 200) setMyMerchantIds((res.data ?? []).map((m) => String(m.merchantId)))
      })
      .catch(() => setMyMerchantIds([]))
  }, [])

  const isBuyer = (row: ContractVO) => row.buyerId != null && myMerchantIds.includes(String(row.buyerId))
  const isSeller = (row: ContractVO) => row.sellerId != null && myMerchantIds.includes(String(row.sellerId))

  /** 我这一方还没签、且合同没被取消 —— 才给"签署"入口。 */
  const canSign = (row: ContractVO) =>
    row.contractStatus !== 'cancelled' &&
    ((isBuyer(row) && row.buyerSignStatus !== 'signed') || (isSeller(row) && row.sellerSignStatus !== 'signed'))

  const handleSign = async (row: ContractVO) => {
    setSigning(String(row.id))
    try {
      const res = await signContract(row.id)
      if (res?.code === 200) {
        message.success('签署成功')
        queryClient.invalidateQueries({ queryKey: ['contracts'] })
      } else {
        message.error(res?.message ?? '签署失败')
      }
    } catch {
      message.error('签署失败（请检查后端是否在运行）')
    } finally {
      setSigning(null)
    }
  }

  const handleArchive = async (row: ContractVO) => {
    try {
      const res = await archiveContract(row.id)
      if (res?.code === 200) {
        message.success('已归档')
        queryClient.invalidateQueries({ queryKey: ['contracts'] })
      } else {
        message.error(res?.message ?? '归档失败')
      }
    } catch {
      message.error('归档失败')
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', query],
    queryFn: () => getContractList(query)
  })

  const columns = [
    { title: '合同编号', dataIndex: 'contractNo', key: 'contractNo' },
    { title: '买方', dataIndex: 'buyerName', key: 'buyerName' },
    { title: '卖方', dataIndex: 'sellerName', key: 'sellerName' },
    // 字段名对着接口实际返回的 VO 核过：合同表没有 goodsName / totalAmount / signStatus 这三个字段，
    // 对应的真实字段是 contractName / contractAmount / buyerSignStatus+sellerSignStatus。
    { title: '合同名称', dataIndex: 'contractName', key: 'contractName', render: (v: string) => v ?? '—' },
    {
      title: '合同金额',
      dataIndex: 'contractAmount',
      key: 'contractAmount',
      render: (val: number) => (val == null ? '—' : `¥${val}`)
    },
    { title: '买方签署', dataIndex: 'buyerSignStatus', key: 'buyerSignStatus', render: renderTag(SIGN_STATUS) },
    { title: '卖方签署', dataIndex: 'sellerSignStatus', key: 'sellerSignStatus', render: renderTag(SIGN_STATUS) },
    { title: '合同状态', dataIndex: 'contractStatus', key: 'contractStatus', render: renderTag(CONTRACT_STATUS) },
    { title: '生效日期', dataIndex: 'effectiveDate', key: 'effectiveDate', render: (v: string) => v ?? '—' },
    { title: '到期日期', dataIndex: 'expireDate', key: 'expireDate', render: (v: string) => v ?? '—' },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, row: ContractVO) => (
        <Space size={0}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => setViewing(row)}>查看</Button>
          {canSign(row) && (
            <Popconfirm
              title="确认签署这份合同？"
              description="签署方由服务端按你的登录身份判定，签署后不可撤销。"
              okText="确 定"
              cancelText="取 消"
              onConfirm={() => handleSign(row)}
            >
              <Button type="link" icon={<EditOutlined />} loading={signing === String(row.id)}>签署</Button>
            </Popconfirm>
          )}
          {row.archiveStatus !== 'archived' && (isBuyer(row) || isSeller(row)) && (
            <Popconfirm
              title="确认归档这份合同？"
              okText="确 定"
              cancelText="取 消"
              onConfirm={() => handleArchive(row)}
            >
              <Button type="link" icon={<InboxOutlined />}>归档</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <Card title="合同管理">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input
          placeholder="合同编号"
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          allowClear
          onChange={(e) => setDraft((prev) => ({ ...prev, contractNo: e.target.value || undefined }))}
        />
        <Select
          placeholder="合同状态"
          style={{ width: 150 }}
          allowClear
          onChange={(v) => setDraft((prev) => ({ ...prev, contractStatus: v }))}
          options={Object.entries(CONTRACT_STATUS).map(([value, item]) => ({ value, label: item.text }))}
        />
        <Button type="primary" onClick={() => setQuery((prev) => ({ ...prev, pageNum: 1, ...draft }))}>搜索</Button>
        <Button onClick={() => { setDraft({}); setQuery({ pageNum: 1, pageSize: 10 }) }}>重置</Button>
      </div>
      <Table
        columns={columns}
        dataSource={data?.data?.records || []}
        loading={isLoading}
        rowKey="id"
        scroll={{ x: 1400 }}
        pagination={{
          current: data?.data?.current,
          total: data?.data?.total,
          pageSize: query.pageSize,
          onChange: (page, size) => setQuery((prev) => ({ ...prev, pageNum: page, pageSize: size }))
        }}
      />

      <Modal title="合同详情" open={!!viewing} onCancel={() => setViewing(null)} footer={null} width={720}>
        {viewing && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="合同编号">{viewing.contractNo}</Descriptions.Item>
            <Descriptions.Item label="关联订单">{viewing.orderId ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="买方">{viewing.buyerName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="卖方">{viewing.sellerName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="合同名称" span={2}>{viewing.contractName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="合同金额">
              {viewing.contractAmount != null ? `¥${viewing.contractAmount}` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="单价">
              {viewing.unitPrice != null ? `¥${viewing.unitPrice}` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="数量">
              {viewing.quantity != null ? `${viewing.quantity}${viewing.unit ?? ''}` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="合同状态">
              {renderTag(CONTRACT_STATUS)(viewing.contractStatus)}
            </Descriptions.Item>
            <Descriptions.Item label="买方签署">{renderTag(SIGN_STATUS)(viewing.buyerSignStatus)}</Descriptions.Item>
            <Descriptions.Item label="卖方签署">{renderTag(SIGN_STATUS)(viewing.sellerSignStatus)}</Descriptions.Item>
            <Descriptions.Item label="生效日期">{viewing.effectiveDate ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="到期日期">{viewing.expireDate ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="归档状态">{viewing.archiveStatus ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{viewing.createTime}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{viewing.remark ?? '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Card>
  )
}

export default ContractList
