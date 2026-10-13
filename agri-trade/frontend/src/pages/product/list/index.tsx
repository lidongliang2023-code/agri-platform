import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Col, Input, Row, Select, Space, Table, Tag, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { getCategoryList, getProductList, type ProductQuery } from '@/api/product'

interface ProductRow {
  id: number
  productCode: string
  productName: string
  categoryId: number
  categoryName: string
  sellerId: number
  sellerName: string
  variety: string
  specSize: string
  unit: string
  price: number
  stockQuantity: number
  publishStatus: string
  createTime: string
}

interface CategoryRow {
  id: number
  categoryName: string
  level: number
}

const STATUS_TAG: Record<string, { text: string; color: string }> = {
  published: { text: '已发布', color: 'success' },
  offline: { text: '已下架', color: 'default' },
  pending: { text: '待审核', color: 'warning' },
  draft: { text: '草稿', color: 'default' },
  rejected: { text: '已驳回', color: 'error' }
}

/**
 * 商品列表（找货大厅）。
 *
 * <p>对齐原型"商品市场 → 商品列表/商品搜索"：支持关键词搜索、按品类筛选、按价格/上架时间排序，
 * 点商品名进详情、点供应商进店铺。列表端点用的是后端真实的 `/product/page`
 * （之前这里调的是 `/product/list`，那个路径后端从未注册过）。</p>
 */
export default function ProductList() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [rows, setRows] = useState<ProductRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [query, setQuery] = useState<ProductQuery>({
    pageNum: 1,
    pageSize: 10,
    // 支持从别的页面带关键词/品类跳进来（例如首页"查看市场"、搜索框）
    productName: params.get('keyword') ?? undefined,
    categoryId: params.get('categoryId') ?? undefined,
    sortField: 'createTime',
    sortOrder: 'desc'
  })

  const load = useCallback(
    (next: ProductQuery) => {
      setLoading(true)
      getProductList(next)
        .then((res: { code: number; data?: { records?: ProductRow[]; total?: number }; message?: string }) => {
          if (res?.code === 200) {
            setRows(res.data?.records ?? [])
            setTotal(res.data?.total ?? 0)
          } else {
            message.error(res?.message ?? '加载商品失败')
          }
        })
        .catch(() => message.error('加载商品失败（检查后端是否在运行）'))
        .finally(() => setLoading(false))
    },
    []
  )

  useEffect(() => {
    getCategoryList()
      .then((res: { code: number; data?: CategoryRow[] }) => {
        if (res?.code === 200) setCategories(res.data ?? [])
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    load(query)
  }, [query, load])

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="240px">
            <Input.Search
              allowClear
              placeholder="搜索商品名称，如 五常大米"
              defaultValue={query.productName}
              onSearch={(value) => {
                setPageNum(1)
                setQuery((prev) => ({ ...prev, pageNum: 1, productName: value || undefined }))
              }}
            />
          </Col>
          <Col flex="180px">
            <Select
              allowClear
              placeholder="全部品类"
              style={{ width: '100%' }}
              value={query.categoryId}
              onChange={(value) => {
                setPageNum(1)
                setQuery((prev) => ({ ...prev, pageNum: 1, categoryId: value }))
              }}
              options={categories.map((item) => ({ value: item.id, label: item.categoryName }))}
            />
          </Col>
          <Col flex="200px">
            <Select
              style={{ width: '100%' }}
              value={`${query.sortField}-${query.sortOrder}`}
              onChange={(value) => {
                const [sortField, sortOrder] = String(value).split('-')
                setQuery((prev) => ({ ...prev, sortField, sortOrder: sortOrder as 'asc' | 'desc' }))
              }}
              options={[
                { value: 'createTime-desc', label: '最新上架' },
                { value: 'price-asc', label: '单价从低到高' },
                { value: 'price-desc', label: '单价从高到低' },
                { value: 'priceMin-asc', label: '起报价从低到高' }
              ]}
            />
          </Col>
          <Col flex="auto">
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => load(query)}>
                刷新
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/product/create')}>
                发布货源
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title={`货源 ${total} 条`}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1100 }}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (page, size) => {
              setPageNum(page)
              setPageSize(size)
              setQuery((prev) => ({ ...prev, pageNum: page, pageSize: size }))
            }
          }}
          columns={[
            { title: '商品编码', dataIndex: 'productCode', width: 150 },
            {
              title: '商品名称',
              dataIndex: 'productName',
              width: 240,
              render: (text: string, row: ProductRow) => (
                <a onClick={() => navigate(`/product/detail/${row.id}`)}>{text}</a>
              )
            },
            { title: '品类', dataIndex: 'categoryName', width: 100 },
            { title: '品种', dataIndex: 'variety', width: 110 },
            { title: '规格', dataIndex: 'specSize', width: 110 },
            {
              title: '单价',
              dataIndex: 'price',
              width: 130,
              render: (val: number, row: ProductRow) => `¥${val}/${row.unit}`
            },
            { title: '库存', dataIndex: 'stockQuantity', width: 90 },
            {
              title: '供应商',
              dataIndex: 'sellerName',
              width: 160,
              render: (text: string, row: ProductRow) => (
                <a onClick={() => navigate(`/shop/${row.sellerId}`)}>{text}</a>
              )
            },
            {
              title: '状态',
              dataIndex: 'publishStatus',
              width: 100,
              render: (val: string) => {
                const tag = STATUS_TAG[val] ?? { text: val, color: 'default' }
                return <Tag color={tag.color}>{tag.text}</Tag>
              }
            },
            { title: '上架时间', dataIndex: 'createTime', width: 170 }
          ]}
        />
      </Card>
    </div>
  )
}
