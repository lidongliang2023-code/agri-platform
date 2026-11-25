/**
 * 页面名称：全链路追踪（交易视角）
 * 路由路径：/admin/trade/p2t/trace
 * 所属模块：产销对接
 */
import { useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Empty, Input, Steps, Tag, Typography } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { getP2tTrace } from '@/api/p2t'
import { TradeFilters, TradeList } from '@/components/TradeList'

interface TraceOffer {
  offerNo: string
  cropName?: string
  availableQty?: number
  reservedQty?: number
  unit?: string
  tradeStatus?: string
  productCode?: string
}

interface TraceSubscription {
  id: number
  orderNo: string
  buyerName?: string
  qty?: number
  grade?: string
  createTime?: string
}

interface TraceData {
  batch?: {
    batchNo?: string
    cropName?: string
    farmName?: string
    quantity?: number
    unit?: string
    harvestDate?: string
    inspectionNo?: string
  }
  offers?: TraceOffer[]
  subscriptions?: TraceSubscription[]
}

export default function P2tTrace(): JSX.Element {
  const [searchParams] = useSearchParams()
  const initialBatchNo = searchParams.get('batchNo') ?? ''
  const [batchNo, setBatchNo] = useState(initialBatchNo)
  const [queryBatchNo, setQueryBatchNo] = useState('')
  const [data, setData] = useState<TraceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const query = async (value?: string): Promise<void> => {
    const target = (value ?? batchNo).trim()
    if (!target) return
    setLoading(true)
    setError('')
    setData(null)
    try {
      const res = await getP2tTrace(target)
      setData(res?.code === 200 ? (res.data as TraceData) : null)
      setQueryBatchNo(target)
    } catch {
      setError('交易链路查询失败，请重试，不能将请求失败视为无记录')
      setData(null)
      setQueryBatchNo(target)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialBatchNo) void query(initialBatchNo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBatchNo])

  const offers = data?.offers ?? []
  const subscriptions = data?.subscriptions ?? []

  return (
    <div style={{ padding: 20, display: 'grid', gap: 16 }}>
      <Alert type="info" showIcon message="产销对接追踪 · 交易侧" description="本页核对批次、供给、合同订单及成交回写；种植事实、质量结论和单品赋码由生产管理维护，零售履约由商城维护。" />
      {error && <Alert type="error" message={error} action={<Button onClick={() => void query()}>重试</Button>} />}
      <div className="agri-list-filter-card">
        <TradeFilters
          loading={loading}
          queryText="查询链路"
          onQuery={() => void query()}
          onReset={() => {
            setBatchNo('')
            setQueryBatchNo('')
            setData(null)
            setError('')
          }}
          fields={[
            {
              label: '采收批次号',
              wide: true,
              control: (
                <Input
                  allowClear
                  placeholder="输入采收批次号"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  onPressEnter={() => void query()}
                />
              ),
            },
          ]}
        />
      </div>

      {!queryBatchNo && <Empty description="输入批次号后查看「批次 → 供给 → 商品 → 订单 → 回写」链路" />}

      {queryBatchNo && data?.batch && (
        <>
          <Card title="链路主键">
            <Descriptions column={3} size="small">
              <Descriptions.Item label="批次">{data.batch.batchNo}</Descriptions.Item>
              <Descriptions.Item label="品种">{data.batch.cropName}</Descriptions.Item>
              <Descriptions.Item label="农场">{data.batch.farmName}</Descriptions.Item>
              <Descriptions.Item label="产量">{data.batch.quantity} {data.batch.unit}</Descriptions.Item>
              <Descriptions.Item label="采收日期">{data.batch.harvestDate}</Descriptions.Item>
              <Descriptions.Item label="质检">{data.batch.inspectionNo ?? '未判定'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="链路阶段">
            <Steps size="small" items={[
              { title: '采收', description: data.batch.harvestDate, status: 'finish' as const },
              { title: '供给发布', description: offers[0]?.offerNo ?? '未发布', status: offers.length ? 'finish' as const : 'wait' as const },
              { title: '交易建品', description: offers.find((o) => o.productCode)?.productCode ?? '未建品', status: offers.some((o) => o.productCode) ? 'finish' as const : 'wait' as const },
              { title: '成交回写', description: subscriptions.length ? `${subscriptions.length} 笔` : '暂无', status: subscriptions.length ? 'finish' as const : 'wait' as const },
            ]} />
          </Card>

          <TradeList<TraceOffer>
            listId="admin-p2t-trace-offers"
            rowKey="offerNo"
            size="small"
            loading={loading}
            dataSource={offers}
            onRefresh={() => void query(queryBatchNo)}
            toolbarLeft={<span style={{ fontWeight: 600 }}>供给单（{offers.length}）</span>}
            columns={[
              { title: '供给单号', dataIndex: 'offerNo', width: 170, ellipsis: true },
              { title: '可供量', dataIndex: 'availableQty', width: 110 },
              { title: '已认购', dataIndex: 'reservedQty', width: 110 },
              { title: '商品', dataIndex: 'productCode', width: 160, ellipsis: true, render: (v) => v ?? '—' },
              { title: '状态', dataIndex: 'tradeStatus', width: 110, render: (v: string) => <Tag color={v === 'LISTED' ? 'green' : 'default'}>{v}</Tag> },
            ]}
          />

          <TradeList<TraceSubscription>
            listId="admin-p2t-trace-subscriptions"
            rowKey="id"
            size="small"
            loading={loading}
            dataSource={subscriptions}
            onRefresh={() => void query(queryBatchNo)}
            toolbarLeft={<span style={{ fontWeight: 600 }}>回写流水（{subscriptions.length}）</span>}
            locale={{ emptyText: '还没有成交回写' }}
            columns={[
              { title: '订单号', dataIndex: 'orderNo', width: 180, ellipsis: true },
              { title: '买家', dataIndex: 'buyerName', width: 160, ellipsis: true },
              { title: '数量', dataIndex: 'qty', width: 110 },
              { title: '等级', dataIndex: 'grade', width: 110 },
              { title: '回写时间', dataIndex: 'createTime', width: 170 },
            ]}
          />
        </>
      )}

      {queryBatchNo && !loading && !data?.batch && (
        <Typography.Text type="secondary">未找到批次 {queryBatchNo} 的链路数据</Typography.Text>
      )}
    </div>
  )
}
