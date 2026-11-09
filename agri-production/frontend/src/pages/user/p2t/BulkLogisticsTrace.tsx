import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, List, Space, Tag, Timeline, Typography } from 'antd'
import SectionCard from '@/components/SectionCard'
import { http } from '@/utils/request'

type Trace = { traceTime?: string; traceStatus?: string; traceLocation?: string; traceDescription?: string; temperature?: number }
type Shipment = { logisticsNo?: string; carrierName?: string; logisticsStatus?: string; pickupTime?: string; actualArrivalTime?: string; traces?: Trace[] }
type Order = { orderNo: string; orderStatus?: string; productName?: string; shipments?: Shipment[] }
const STATUS: Record<string, string> = { pending: '待揽收', picked: '已揽收', in_transit: '运输中', delivering: '派送中', delivered: '已签收' }
const status = (value?: string) => STATUS[value || ''] || value || '未记录'
export default function BulkLogisticsTrace({ batchNo, subject, offerNo }: {
  batchNo: string; subject: string; offerNo: string
}): JSX.Element {
  const query = useQuery<Order[]>({ queryKey: ['bulk-logistics', subject, batchNo, offerNo],
    enabled: !!subject && !!offerNo, retry: false,
    queryFn: () => http.get('/p2t/trace/logistics', { batchNo, offerNo }) })
  return <SectionCard title="大宗物流与履约" extra={<Button disabled={!offerNo} loading={query.isFetching} onClick={() => void query.refetch()}>刷新物流</Button>}>
    <Alert type="info" showIcon message={`来源供给单：${offerNo || '未选择'} · 大宗订单及全部分批物流`} description="仅查看当前主体参与的订单。批次关联物流不代表某个单品已运输或签收；未登记、查询失败与已签收分别展示。" style={{ marginBottom: 16 }} />
    {query.isError ? <Alert type="error" showIcon message="大宗物流查询失败" description={query.error instanceof Error ? query.error.message : '无法读取交易物流，请重试'} action={<Button onClick={() => void query.refetch()}>重试</Button>} /> :
      <List loading={query.isFetching} dataSource={offerNo ? query.data || [] : []} pagination={{ pageSize: 5, hideOnSinglePage: true }} locale={{ emptyText: <Empty description={offerNo ? '当前主体在该供给单下暂无关联大宗订单' : '暂无供给单，尚未关联大宗履约'} /> }} renderItem={order => <List.Item key={order.orderNo} style={{ display: 'block' }}>
        <Space wrap><Typography.Text strong>{order.orderNo}</Typography.Text><Tag>{order.orderStatus || '订单状态未记录'}</Tag><span>{order.productName}</span></Space>
        {!order.shipments?.length && <p>未登记物流，不能据此认定已发货或已签收。</p>}
        {order.shipments?.map((shipment, i) => <div key={`${shipment.logisticsNo}-${i}`} style={{ padding: '16px 0' }}>
          <Space wrap><Tag>{status(shipment.logisticsStatus)}</Tag><span>{shipment.carrierName || '承运方未记录'}</span><Typography.Text copyable>{shipment.logisticsNo}</Typography.Text></Space>
          <p>揽收：{shipment.pickupTime || '未记录'} · 实际到达：{shipment.actualArrivalTime || '未记录'}</p>
          {shipment.traces?.length ? <Timeline items={shipment.traces.map((event, index) => ({ key: index,
            children: <><Typography.Text strong>{status(event.traceStatus)}</Typography.Text><p>{event.traceTime || '时间未记录'} · {event.traceLocation || '位置未记录'}</p><p>{event.traceDescription || '详情未记录'}{event.temperature != null ? ` · 温度 ${event.temperature}℃` : ''}</p></> }))} /> : <Typography.Text type="secondary">暂无运输轨迹记录</Typography.Text>}
        </div>)}
      </List.Item>} />}
  </SectionCard>
}
