/**
 * 卖家中心 · 产销对接（承接侧）
 *
 * 这里做的是**两个主体之间**的事：农业生产域的农场发布供给意向，我作为供应商决定接不接。
 * 平台运营不再代做这件事（原来在 `/admin/trade/p2t` 的供给池审核与建品已下线）。
 *
 * 三条不妥协的口径：
 * 1. 建出来的商品 `seller_id` 是**我点选的那个主体**，不再是农场主体号；
 * 2. 承接状态由交易域商品表实查（`source_offer_no` 就是认领凭证），不信生产端回写的 tradeStatus——
 *    回写失败时若只信它，会出现"商品已经建好但池子还显示可承接"，再点一次就是重复商品；
 * 3. 主体没绑定 / 身份解析失败时明确说原因，不出一片看起来"没有货"的空列表。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, message } from 'antd'
import {
  claimOffer, getClaimablePool, getMyClaimedProducts, updateClaimedPrice,
} from '@/api/seller-p2t'
import type { ClaimableOffer, MyClaimedProduct, SellerBinding } from '@/api/seller-p2t'

interface Props {
  merchants: SellerBinding[]
  preferredMerchantId?: string | null
}

const remainingOf = (row: ClaimableOffer): number => {
  const available = Number(row.availableQty ?? 0)
  const reserved = Number(row.reservedQty ?? 0)
  return Math.max(available - reserved, 0)
}

export default function SellerP2tPanel({ merchants, preferredMerchantId }: Props): JSX.Element {
  const [rows, setRows] = useState<ClaimableOffer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')

  const [mine, setMine] = useState<MyClaimedProduct[]>([])
  const [mineTotal, setMineTotal] = useState(0)
  const [mineLoading, setMineLoading] = useState(false)

  const [claiming, setClaiming] = useState<ClaimableOffer | null>(null)
  const [sellerId, setSellerId] = useState<string | undefined>()
  const [listedQty, setListedQty] = useState<number>(0)
  const [price, setPrice] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [editingPrice, setEditingPrice] = useState<Record<number, number>>({})

  const load = useCallback(() => {
    setLoading(true)
    getClaimablePool({ pageNum, pageSize, keyword: keyword || undefined })
      .then((res) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? [])
          setTotal(res.data?.total ?? 0)
          setNotice('')
        } else {
          setRows([])
          setTotal(0)
          // 身份解析失败与"今天没人挂货"是两件事，必须说清是哪一件
          setNotice(res?.message ?? '供给意向取不到，请稍后重试')
        }
      })
      .catch(() => { setRows([]); setNotice('产销对接通道不可达（生产域或交易域未响应），不是"没有可承接的货"') })
      .finally(() => setLoading(false))
  }, [pageNum, pageSize, keyword])

  const loadMine = useCallback(() => {
    setMineLoading(true)
    getMyClaimedProducts({ pageNum: 1, pageSize: 50 })
      .then((res) => {
        if (res?.code === 200) {
          setMine(res.data?.records ?? [])
          setMineTotal(res.data?.total ?? 0)
          if (res.data?.reason) setNotice(res.data.reason)
        }
      })
      .catch(() => setMine([]))
      .finally(() => setMineLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadMine() }, [loadMine])

  const merchantOptions = useMemo(() => merchants.map((item) => ({
    value: String(item.merchantId),
    label: `${item.merchantName ?? '未命名主体'}${item.roleInMerchant ? `（${item.roleInMerchant}）` : ''}`,
  })), [merchants])

  const openClaim = (row: ClaimableOffer): void => {
    setClaiming(row)
    setSellerId(preferredMerchantId ? String(preferredMerchantId) : (merchantOptions[0]?.value ?? undefined))
    setListedQty(remainingOf(row))
    setPrice(0)
  }

  const submitClaim = async (): Promise<void> => {
    if (!claiming) return
    if (!sellerId) { message.warning('请选择以哪个主体承接'); return }
    if (!price || price <= 0) { message.warning('请填写挂牌价（大于 0）'); return }
    setSubmitting(true)
    try {
      const res = await claimOffer(claiming.offerNo, { sellerId, listedQty: listedQty || undefined, price })
      if (res?.code === 200) {
        message.success(`已承接并由本主体建品：${res.data?.productCode ?? ''}`)
        setClaiming(null)
        load()
        loadMine()
      } else {
        message.error(res?.message ?? '承接失败')
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '承接失败')
    } finally {
      setSubmitting(false)
    }
  }

  const savePrice = async (product: MyClaimedProduct): Promise<void> => {
    const next = editingPrice[product.id]
    if (next == null || next <= 0) { message.warning('请填写新的挂牌价'); return }
    const res = await updateClaimedPrice(product.id, next)
    if (res?.code === 200) {
      message.success('挂牌价已更新')
      setEditingPrice((prev) => { const copy = { ...prev }; delete copy[product.id]; return copy })
      loadMine()
    } else {
      message.error(res?.message ?? '改价失败')
    }
  }

  return (
    <>
      {notice && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={notice} />}
      <Card title="可承接的供给意向" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 12 }} wrap>
          <Input.Search allowClear placeholder="供给单号 / 批次 / 作物" style={{ width: 260 }}
            onSearch={(v) => { setKeyword(v.trim()); setPageNum(1) }} />
          <Button onClick={() => { load(); loadMine() }}>刷新</Button>
        </Space>
        <Table<ClaimableOffer>
          rowKey="offerNo"
          loading={loading}
          dataSource={rows}
          pagination={{
            current: pageNum, pageSize, total, showSizeChanger: true,
            onChange: (page, size) => { setPageNum(page); setPageSize(size ?? 10) },
          }}
          columns={[
            { title: '供给单号', dataIndex: 'offerNo', width: 165 },
            {
              title: '作物 / 品种',
              render: (_, row) => `${row.cropName ?? '未填作物'}${row.varietyName ? ` · ${row.varietyName}` : ''}`,
            },
            { title: '采收批次', dataIndex: 'batchNo', width: 130 },
            { title: '货源主体 / 产区', render: (_, row) => `${row.farmName ?? '农场名未填'}${row.origin ? ` · ${row.origin}` : ''}` },
            {
              title: '可供 / 已认购 / 剩余',
              align: 'right',
              width: 170,
              render: (_, row) => `${row.availableQty ?? 0} / ${row.reservedQty ?? 0} / ${remainingOf(row)} ${row.unit ?? ''}`,
            },
            {
              title: '上市窗口',
              width: 175,
              render: (_, row) => (row.windowStart ? `${row.windowStart} ~ ${row.windowEnd ?? ''}` : '未限定'),
            },
            {
              title: '承接状态',
              width: 150,
              render: (_, row) => (row.claimedByMe
                ? <Tag color="green">已由我承接 {row.claimedProductCode ?? ''}</Tag>
                : (row.claimed ? <Tag>他方已承接</Tag> : <Tag color="blue">可承接</Tag>)),
            },
            {
              title: '操作',
              width: 110,
              render: (_, row) => (
                <Button type="link" size="small" disabled={Boolean(row.claimedByMe || row.claimed)}
                  onClick={() => openClaim(row)}>
                  {row.claimedByMe ? '已承接' : '承接'}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card title={`我承接出来的商品（${mineTotal}）`}>
        <Row gutter={12} align="middle" style={{ marginBottom: 8 }}>
          <Col flex="auto">商品由承接方主体持有，改价只影响之后的新订单。</Col>
        </Row>
        <Table<MyClaimedProduct>
          rowKey="id"
          size="small"
          loading={mineLoading}
          dataSource={mine}
          pagination={false}
          columns={[
            { title: '商品编号', dataIndex: 'productCode', width: 150 },
            { title: '商品名', dataIndex: 'productName' },
            { title: '来源供给', dataIndex: 'sourceOfferNo', width: 150 },
            { title: '持有主体', dataIndex: 'sellerName', width: 160 },
            { title: '库存', dataIndex: 'stockQuantity', align: 'right', width: 90 },
            { title: '挂牌价', dataIndex: 'price', align: 'right', width: 100, render: (v) => `¥${v ?? 0}` },
            {
              title: '改价',
              width: 210,
              render: (_, row) => (
                <Space.Compact>
                  <InputNumber min={0.01} step={0.1} placeholder="新挂牌价" style={{ width: 120 }}
                    value={editingPrice[row.id]}
                    onChange={(v) => setEditingPrice((prev) => ({ ...prev, [row.id]: Number(v ?? 0) }))} />
                  <Button onClick={() => savePrice(row)}>保存</Button>
                </Space.Compact>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={Boolean(claiming)}
        title={claiming ? `承接供给单 ${claiming.offerNo}` : ''}
        confirmLoading={submitting}
        onOk={submitClaim}
        onCancel={() => setClaiming(null)}
        okText="确认承接并建品"
      >
        {claiming && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              货源：{claiming.farmName ?? '农场名未填'} · {claiming.cropName ?? '未填作物'}
              {claiming.varietyName ? ` · ${claiming.varietyName}` : ''} · 批次 {claiming.batchNo ?? '未填'}
            </div>
            <div>剩余可上架 {remainingOf(claiming)} {claiming.unit ?? ''}，起订量 {claiming.minOrderQty ?? 0} {claiming.unit ?? ''}</div>
            <div>
              <span style={{ marginRight: 8 }}>承接主体</span>
              <Select style={{ width: 280 }} placeholder="选择以哪个主体承接" value={sellerId}
                options={merchantOptions} onChange={setSellerId} />
            </div>
            <div>
              <span style={{ marginRight: 8 }}>上架量</span>
              <InputNumber min={0} step={1} value={listedQty} onChange={(v) => setListedQty(Number(v ?? 0))} />
            </div>
            <div>
              <span style={{ marginRight: 8 }}>挂牌价</span>
              <InputNumber min={0.01} step={0.1} value={price} onChange={(v) => setPrice(Number(v ?? 0))}
                placeholder="必须填写" />
            </div>
            <Alert type="info" showIcon
              message="承接后商品归你选的这家主体所有（不再挂在农场名下），供给侧会看到「已被承接」与承接方名称。" />
          </Space>
        )}
      </Modal>
    </>
  )
}
