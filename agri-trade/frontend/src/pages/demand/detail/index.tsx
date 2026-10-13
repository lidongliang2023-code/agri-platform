import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Descriptions, Empty, Popconfirm, Space, Spin, Table, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { deleteDemand, getDemandById, getDemandMatches, matchDemand } from '@/api/demand'

interface Demand {
  id: number
  demandNo: string
  demandName: string
  buyerId: number
  buyerName: string
  buyerType: string
  categoryId: number
  categoryName: string
  variety: string
  productName: string
  quantity: number
  unit: string
  priceMin: number
  priceMax: number
  deliveryProvince: string
  deliveryCity: string
  deliveryAddress: string
  deliveryDeadline: string
  qualityRequirement: string
  certificationRequire: string
  packagingRequire: string
  sampleRequire: number
  demandType: string
  demandStatus: string
  responseCount: number
  createTime: string
}

interface MatchRow {
  id: number
  matchNo: string
  productId: number
  sellerId: number
  matchScore: number
  matchType: string
  matchReason: string
  orderId: number
  orderStatus: string
  createTime: string
}

const STATUS_TAG: Record<string, { text: string; color: string }> = {
  pending: { text: '待匹配', color: 'warning' },
  matching: { text: '匹配中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  closed: { text: '已关闭', color: 'default' }
}

/**
 * 采购需求详情（原型"采购需求 → 需求详情"）。
 *
 * <p>除需求本身，还展示**撮合结果**（GET /demand/{id}/matches）并提供"触发撮合"
 * （POST /demand/{id}/match）—— 这条链路后端一直都有，只是前端没有页面用它。</p>
 */
export default function DemandDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [demand, setDemand] = useState<Demand | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)

  const loadMatches = useCallback(() => {
    if (!id) return
    getDemandMatches(id)
      .then((res: { code: number; data?: MatchRow[] }) => {
        if (res?.code === 200) setMatches(res.data ?? [])
      })
      .catch(() => undefined)
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getDemandById(Number(id))
      .then((res: { code: number; data?: Demand; message?: string }) => {
        if (res?.code === 200) {
          setDemand(res.data ?? null)
        } else {
          message.error(res?.message ?? '需求不存在')
        }
      })
      .catch(() => message.error('加载需求失败（检查后端是否在运行）'))
      .finally(() => setLoading(false))
    loadMatches()
  }, [id, loadMatches])

  const handleMatch = async () => {
    if (!id) return
    setMatching(true)
    try {
      const res = await matchDemand(Number(id))
      if (res?.code === 200) {
        message.success('撮合完成')
        loadMatches()
      } else {
        message.error(res?.message ?? '触发撮合失败')
      }
    } finally {
      setMatching(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    const res = await deleteDemand(Number(id))
    if (res?.code === 200) {
      message.success('已下架')
      navigate('/demand')
    } else {
      message.error(res?.message ?? '下架失败')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!demand) {
    return <Empty description="没有找到这条需求" style={{ padding: 80 }} />
  }

  const status = STATUS_TAG[demand.demandStatus] ?? { text: demand.demandStatus, color: 'default' }

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/demand')}>
          返回需求列表
        </Button>
        <Button type="primary" icon={<ThunderboltOutlined />} loading={matching} onClick={handleMatch}>
          触发智能撮合
        </Button>
        <Button onClick={() => navigate(`/demand/create?id=${demand.id}`)}>编辑需求</Button>
        <Popconfirm title="确认下架这条需求？" onConfirm={handleDelete}>
          <Button danger>下架需求</Button>
        </Popconfirm>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space align="center" wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {demand.demandName || `需求 ${demand.demandNo}`}
          </Typography.Title>
          <Tag color={status.color}>{status.text}</Tag>
        </Space>
        <div style={{ color: '#a0aec0', fontSize: 13, marginTop: 6 }}>{demand.demandNo}</div>

        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" style={{ marginTop: 16 }} bordered>
          <Descriptions.Item label="采购方">{demand.buyerName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="采购方类型">{demand.buyerType ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="交易类型">{demand.demandType ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="品类">{demand.categoryName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="品种">{demand.variety ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="商品名称">{demand.productName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="采购数量">
            {demand.quantity} {demand.unit ?? ''}
          </Descriptions.Item>
          <Descriptions.Item label="期望单价">
            ¥{demand.priceMin} ~ ¥{demand.priceMax}
          </Descriptions.Item>
          <Descriptions.Item label="报价数">{demand.responseCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="收货地址" span={2}>
            {[demand.deliveryProvince, demand.deliveryCity, demand.deliveryAddress].filter(Boolean).join(' ') || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="期望交货">{demand.deliveryDeadline ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="质量要求" span={2}>
            {demand.qualityRequirement ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="是否要样品">{demand.sampleRequire === 1 ? '需要' : '不需要'}</Descriptions.Item>
          <Descriptions.Item label="资质要求" span={2}>
            {demand.certificationRequire ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="包装要求">{demand.packagingRequire ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="发布时间">{demand.createTime ?? '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={`撮合结果（${matches.length}）`}>
        {matches.length === 0 ? (
          <Empty description="还没有撮合结果，点上面的「触发智能撮合」跑一次" />
        ) : (
          <Table
            rowKey="id"
            dataSource={matches}
            pagination={false}
            columns={[
              { title: '匹配单号', dataIndex: 'matchNo' },
              {
                title: '货源',
                dataIndex: 'productId',
                render: (val: number) => <a onClick={() => navigate(`/product/detail/${val}`)}>商品 #{val}</a>
              },
              {
                title: '匹配度',
                dataIndex: 'matchScore',
                render: (val: number) => (val == null ? '—' : `${val} 分`)
              },
              {
                title: '推荐理由',
                dataIndex: 'matchReason',
                render: (val: string) => val || '—'
              },
              // 撮合记录实体里没有 matchStatus（表里有这一列但没映射到实体，
              // 直接读会永远空白）；能读的是 matchType 与 orderId / orderStatus。
              { title: '类型', dataIndex: 'matchType', render: (val: string) => (val === 'auto' ? '系统自动' : val || '—') },
              {
                title: '是否下单',
                dataIndex: 'orderId',
                render: (val: number) => (val ? <a>订单 #{val}</a> : '未下单')
              },
              { title: '订单状态', dataIndex: 'orderStatus', render: (val: string) => val || '—' },
              { title: '生成时间', dataIndex: 'createTime' }
            ]}
          />
        )}
      </Card>
    </div>
  )
}
