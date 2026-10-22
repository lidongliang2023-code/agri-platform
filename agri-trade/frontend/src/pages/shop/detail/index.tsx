import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, Empty, Space, Spin, Table, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, ShopOutlined } from '@ant-design/icons'

interface ProductRow {
  id: number
  productName: string
  categoryName: string
  variety: string
  origin: string
  specification: string
  unit: string
  price: number
  stockQuantity: number
  sellerId: number | string
  sellerName: string
}

interface SellerHome {
  sellerId: string
  sellerName: string
  province: string | null
  city: string | null
  productCount: number
  products: ProductRow[]
}

/**
 * 供应商店铺页。
 *
 * <p>店铺本身还没有独立的主数据（没有 merchant/shop 表），所以这里能显示的"店铺信息"
 * 就是它上架货源里带的供应商名称与所在地 —— 不编一个"店铺等级/好评率"出来。
 * 货源列表走 /api/trade/product/page 的 sellerId 过滤（该参数本次一并补上，
 * 之前只能把全部商品拉回来在前端筛）。</p>
 */
export default function ShopDetail() {
  const { sellerId } = useParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState<ProductRow[]>([])
  const [seller, setSeller] = useState<SellerHome | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sellerId) return
    setLoading(true)
    setError('')
    fetch(`/api/trade/public/sellers/${encodeURIComponent(sellerId)}`)
      .then((response) => response.json())
      .then((body: { code: number; data?: SellerHome; message?: string }) => {
        if (body.code === 200 && body.data) {
          setSeller(body.data)
          setRows(body.data.products ?? [])
        } else {
          setSeller(null)
          setRows([])
          setError(body.message || '供应商不存在或暂无在售货源')
        }
      })
      .catch(() => setError('加载供应商主页失败，请稍后重试'))
      .finally(() => setLoading(false))
  }, [sellerId])

  const sellerName = seller?.sellerName ?? rows[0]?.sellerName
  const location = seller
    ? [seller.province, seller.city].filter(Boolean).join(' ')
    : ''

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hall')}>
          返回交易大厅
        </Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space align="start" size={14}>
          <span style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', background: '#e4f6ec', color: '#12764a' }}>
            <ShopOutlined style={{ fontSize: 22 }} />
          </span>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {sellerName ?? '供应商主页'}
            </Typography.Title>
            <div style={{ color: '#718096', marginTop: 6 }}>
              {location && <span>所在地：{location}　</span>}
              在售货源：{seller?.productCount ?? rows.length} 个
            </div>
          </div>
        </Space>
        <div style={{ marginTop: 14, color: '#718096', fontSize: 12 }}>
          以下展示该供应商公开发布的货源，具体交付与价格以商品详情和订单确认为准。
        </div>
      </Card>

      {error && <Alert showIcon type="warning" message={error} style={{ marginBottom: 16 }} />}

      <Card title="在售货源">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : rows.length === 0 ? (
          <Empty description="该店铺暂无在架货源" />
        ) : (
          <Table
            rowKey="id"
            dataSource={rows}
            pagination={false}
            columns={[
              {
                title: '商品名称',
                dataIndex: 'productName',
                render: (text: string, row: ProductRow) => (
                  <a href={`/product/detail/${row.id}`}>{text}</a>
                )
              },
              { title: '品类', dataIndex: 'categoryName' },
              { title: '品种', dataIndex: 'variety' },
              { title: '规格', dataIndex: 'specification' },
              { title: '产地', dataIndex: 'origin' },
              {
                title: '单价',
                dataIndex: 'price',
                render: (val: number, row: ProductRow) => `¥${val}/${row.unit}`
              },
              { title: '库存', dataIndex: 'stockQuantity' },
              { title: '状态', render: () => <Tag color="success">在售</Tag> },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
