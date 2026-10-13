import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Empty, Space, Spin, Table, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getProductList } from '@/api/product'

interface ProductRow {
  id: number
  productCode: string
  productName: string
  categoryName: string
  variety: string
  specSize: string
  unit: string
  price: number
  stockQuantity: number
  publishStatus: string
  sellerId: number
  sellerName: string
  originProvince: string
  originCity: string
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sellerId) return
    setLoading(true)
    getProductList({ pageNum: 1, pageSize: 100, sellerId })
      .then((res: { code: number; data?: { records?: ProductRow[] }; message?: string }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? [])
        } else {
          message.error(res?.message ?? '加载店铺货源失败')
        }
      })
      .catch(() => message.error('加载店铺货源失败（检查后端是否在运行）'))
      .finally(() => setLoading(false))
  }, [sellerId])

  const sellerName = rows[0]?.sellerName
  const location = rows[0] ? [rows[0].originProvince, rows[0].originCity].filter(Boolean).join(' ') : ''

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/product')}>
          返回商品列表
        </Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          🏬 {sellerName ?? '供应商店铺'}
        </Typography.Title>
        <div style={{ color: '#718096', marginTop: 8 }}>
          {location && <span>所在地：{location}　</span>}
          在架货源：{rows.length} 个
        </div>
      </Card>

      <Card title="店铺货源">
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
              { title: '商品编码', dataIndex: 'productCode' },
              {
                title: '商品名称',
                dataIndex: 'productName',
                render: (text: string, row: ProductRow) => (
                  <a onClick={() => navigate(`/product/detail/${row.id}`)}>{text}</a>
                )
              },
              { title: '品类', dataIndex: 'categoryName' },
              { title: '品种', dataIndex: 'variety' },
              { title: '规格', dataIndex: 'specSize' },
              {
                title: '单价',
                dataIndex: 'price',
                render: (val: number, row: ProductRow) => `¥${val}/${row.unit}`
              },
              { title: '库存', dataIndex: 'stockQuantity' },
              {
                title: '状态',
                dataIndex: 'publishStatus',
                render: (val: string) =>
                  val === 'published' ? <Tag color="success">已发布</Tag> : <Tag>{val}</Tag>
              }
            ]}
          />
        )}
      </Card>
    </div>
  )
}
