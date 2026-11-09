/**
 * 页面名称：全链路追踪（交易视角）
 * 路由路径：/admin/trade/p2t/trace
 * 所属模块：产销对接
 *
 * 从商品反查来源批次与供给：批次 → 供给 → 商品 → 订单 → 回写。
 * 只做汇聚展示与索引，不产生也不修改任何业务数据。
 */
import { useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Empty, Input, Space, Steps, Table, Tag, Typography } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { getP2tTrace } from '@/api/p2t'

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

  // 从产销对账/供给池带 ?batchNo= 进来时直接查链路，不用再手输一次
  useEffect(() => {
    if (initialBatchNo) void query(initialBatchNo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBatchNo])

  const offers = data?.offers ?? []
  const subscriptions = data?.subscriptions ?? []

  return (
    <div style={{ padding: 20 }}>
      <Alert type="info" showIcon message="产销对接追踪 · 交易侧" description="本页核对批次、供给、合同订单及成交回写；种植事实、质量结论和单品赋码由生产管理维护，零售履约由商城维护。" style={{ marginBottom: 16 }} />
      {error && <Alert type="error" message={error} action={<Button onClick={() => void query()}>重试</Button>} />}
      <Space style={{ marginBottom: 16 }}>
        <Input style={{ width: 320 }} placeholder="输入采收批次号" value={batchNo}
          onChange={(e) => setBatchNo(e.target.value)} onPressEnter={() => void query()} />
        <Button type="primary" loading={loading} onClick={() => void query()}>查询链路</Button>
      </Space>

      {!queryBatchNo && <Empty description="输入批次号后查看「批次 → 供给 → 商品 → 订单 → 回写」链路" />}

      {queryBatchNo && data?.batch && (
        <>
          <Card title="链路主键" style={{ marginBottom: 16 }}>
            <Descriptions column={3} size="small">
              <Descriptions.Item label="批次">{data.batch.batchNo}</Descriptions.Item>
              <Descriptions.Item label="品种">{data.batch.cropName}</Descriptions.Item>
              <Descriptions.Item label="农场">{data.batch.farmName}</Descriptions.Item>
              <Descriptions.Item label="产量">{data.batch.quantity} {data.batch.unit}</Descriptions.Item>
              <Descriptions.Item label="采收日期">{data.batch.harvestDate}</Descriptions.Item>
              <Descriptions.Item label="质检">{data.batch.inspectionNo ?? '未判定'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="链路阶段" style={{ marginBottom: 16 }}>
            <Steps size="small" items={[
              { title: '采收', description: data.batch.harvestDate, status: 'finish' as const },
              { title: '供给发布', description: offers[0]?.offerNo ?? '未发布', status: offers.length ? 'finish' as const : 'wait' as const },
              { title: '交易建品', description: offers.find((o) => o.productCode)?.productCode ?? '未建品', status: offers.some((o) => o.productCode) ? 'finish' as const : 'wait' as const },
              { title: '成交回写', description: subscriptions.length ? `${subscriptions.length} 笔` : '暂无', status: subscriptions.length ? 'finish' as const : 'wait' as const },
            ]} />
          </Card>

          <Card title="供给单" style={{ marginBottom: 16 }}>
            <Table<TraceOffer>
              rowKey="offerNo"
              size="small"
              pagination={false}
              dataSource={offers}
              columns={[
                { title: '供给单号', dataIndex: 'offerNo' },
                { title: '可供量', dataIndex: 'availableQty', align: 'right' },
                { title: '已认购', dataIndex: 'reservedQty', align: 'right' },
                { title: '商品', dataIndex: 'productCode', render: (v) => v ?? '—' },
                { title: '状态', dataIndex: 'tradeStatus', render: (v: string) => <Tag color={v === 'LISTED' ? 'green' : 'default'}>{v}</Tag> },
              ]}
            />
          </Card>

          <Card title="回写流水">
            <Table<TraceSubscription>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={subscriptions}
              locale={{ emptyText: '还没有成交回写' }}
              columns={[
                { title: '订单号', dataIndex: 'orderNo' },
                { title: '买家', dataIndex: 'buyerName' },
                { title: '数量', dataIndex: 'qty', align: 'right' },
                { title: '等级', dataIndex: 'grade' },
                { title: '回写时间', dataIndex: 'createTime' },
              ]}
            />
          </Card>
        </>
      )}

      {queryBatchNo && !loading && !data?.batch && (
        <Typography.Text type="secondary">未找到批次 {queryBatchNo} 的链路数据</Typography.Text>
      )}
    </div>
  )
}
