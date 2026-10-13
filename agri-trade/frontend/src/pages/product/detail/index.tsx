import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Descriptions, Empty, Image, Space, Spin, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, ShopOutlined } from '@ant-design/icons'
import { getProductById, getProductImages, type ProductImage } from '@/api/product'

/** 商品（TradeProduct 实体，字段名与后端一致） */
interface TradeProduct {
  id: number
  productCode: string
  productName: string
  categoryId: number
  categoryName: string
  sellerId: number
  sellerName: string
  variety: string
  originProvince: string
  originCity: string
  originAddress: string
  specLevel: string
  specSize: string
  unit: string
  stockQuantity: number
  price: number
  priceMin: number
  priceMax: number
  priceType: string
  minOrderQuantity: number
  harvestBatchNo: string
  description: string
  viewCount: number
  favoriteCount: number
  inquiryCount: number
  publishStatus: string
}

const STATUS_TEXT: Record<string, { text: string; color: string }> = {
  published: { text: '已发布', color: 'success' },
  pending: { text: '待审核', color: 'warning' },
  draft: { text: '草稿', color: 'default' },
  rejected: { text: '已驳回', color: 'error' }
}

/**
 * 商品详情页。
 *
 * <p>数据全部来自真实接口：商品主体取 `/api/trade/product/{id}`，图片取
 * `/api/trade/product/{id}/images`（这个读接口是本次一并补的 —— 在此之前
 * agri_trade_product_image 表有数据却没有任何读入口，详情页只能挂占位图）。</p>
 */
export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState<TradeProduct | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([getProductById(Number(id)), getProductImages(id)])
      .then(([productRes, imageRes]) => {
        if (productRes?.code === 200) {
          setProduct(productRes.data)
        } else {
          message.error(productRes?.message ?? '商品不存在')
        }
        if (imageRes?.code === 200) {
          setImages(imageRes.data ?? [])
        }
      })
      .catch(() => message.error('加载商品失败（检查后端是否在运行）'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!product) {
    return <Empty description="没有找到这个商品" style={{ padding: 80 }} />
  }

  const status = STATUS_TEXT[product.publishStatus] ?? { text: product.publishStatus, color: 'default' }
  const mainImage = images.find((item) => item.imageType === 'main') ?? images[0]

  /**
   * 图片加载失败的兜底图。
   *
   * <p>为什么需要：演示数据里的 imageUrl 指向 /images/trade/xxx.jpg，而仓库里并没有这些文件 ——
   * 浏览器会显示一个"坏图"图标，看起来像页面坏了。这里给一个说明性的占位图，
   * 让人一眼看出"是图片没上传/没就位"，而不是"这个页面是坏的"。</p>
   */
  const fallbackImage =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">' +
        '<rect width="320" height="240" fill="#f5f7fa"/>' +
        '<text x="160" y="120" font-size="14" fill="#a0aec0" text-anchor="middle">图片未就绪</text>' +
        '<text x="160" y="142" font-size="11" fill="#cbd5e0" text-anchor="middle">该货源尚未上传图片文件</text>' +
        '</svg>'
    )

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/product')}>
          返回商品列表
        </Button>
      </Space>

      <Card>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ width: 320 }}>
            {mainImage ? (
              <Image
                src={mainImage.imageUrl}
                fallback={fallbackImage}
                width={320}
                height={240}
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 320,
                  height: 240,
                  background: '#f5f7fa',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#a0aec0'
                }}
              >
                该商品暂未上传图片
              </div>
            )}
            {images.length > 1 && (
              <Space style={{ marginTop: 12 }} wrap>
                {images.map((item) => (
                  <Image
                    key={item.id}
                    src={item.imageUrl}
                    fallback={fallbackImage}
                    width={72}
                    height={72}
                    style={{ objectFit: 'cover' }}
                  />
                ))}
              </Space>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 320 }}>
            <Space align="center" wrap>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {product.productName}
              </Typography.Title>
              <Tag color={status.color}>{status.text}</Tag>
            </Space>
            <div style={{ marginTop: 6, color: '#a0aec0', fontSize: 13 }}>{product.productCode}</div>

            <div style={{ marginTop: 16, color: '#1565C0', fontSize: 30, fontWeight: 600 }}>
              ¥{product.price}
              <span style={{ fontSize: 14, color: '#718096', fontWeight: 400 }}> /{product.unit}</span>
            </div>
            <div style={{ color: '#718096', fontSize: 13, marginTop: 4 }}>
              参考区间 ¥{product.priceMin} ~ ¥{product.priceMax}
              {product.minOrderQuantity ? `　起订 ${product.minOrderQuantity}${product.unit}` : ''}
            </div>

            <Descriptions column={{ xs: 1, sm: 2 }} size="small" style={{ marginTop: 20 }} bordered>
              <Descriptions.Item label="品类">{product.categoryName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="品种">{product.variety ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="规格">{product.specSize ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="等级">{product.specLevel ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="产地">
                {[product.originProvince, product.originCity, product.originAddress].filter(Boolean).join(' ') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="库存">
                {product.stockQuantity} {product.unit}
              </Descriptions.Item>
              <Descriptions.Item label="采收批次">{product.harvestBatchNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="浏览 / 收藏 / 询价">
                {product.viewCount} / {product.favoriteCount} / {product.inquiryCount}
              </Descriptions.Item>
              <Descriptions.Item label="供应商" span={2}>
                {product.sellerName}
                <Button
                  type="link"
                  icon={<ShopOutlined />}
                  onClick={() => navigate(`/shop/${product.sellerId}`)}
                >
                  查看店铺
                </Button>
              </Descriptions.Item>
            </Descriptions>

            <Typography.Paragraph style={{ marginTop: 16, color: '#4a5568' }}>
              {product.description ?? '供应商未填写商品说明'}
            </Typography.Paragraph>

            <Space style={{ marginTop: 8 }}>
              <Button
                type="primary"
                onClick={() => navigate(`/order/create?productId=${product.id}`)}
              >
                立即下单
              </Button>
              <Button
                type="primary"
                onClick={() => navigate(`/demand/create?productId=${product.id}`)}
              >
                以此商品发布采购需求
              </Button>
              <Button onClick={() => navigate(`/shop/${product.sellerId}`)}>进入店铺询价</Button>
            </Space>
          </div>
        </div>
      </Card>
    </div>
  )
}
