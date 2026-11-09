import { Alert, Button, Drawer, Space, Spin, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import SectionCard from '@/components/SectionCard'
import { getP2tOffer } from '@/api/p2t'
import type { P2tSubscription } from '@/api/p2t'
import useAuthStore from '@/store/auth'

export const SUBSCRIPTION_EVENTS: Record<string, string> = {
  ORDER_PAID: '支付认购', ORDER_CANCELLED: '订单取消', RELEASED: '认购释放',
}
export const SUBSCRIPTION_STATUSES: Record<string, { text: string; color: string }> = {
  SUCCESS: { text: '成功', color: 'green' }, FAILED: { text: '失败', color: 'red' }, PENDING: { text: '待处理', color: 'orange' },
}
export function subscriptionEffect(row: P2tSubscription): string {
  if (row.writebackStatus !== 'SUCCESS') return '未计入'
  return row.eventType === 'ORDER_PAID' ? '增加' : ['ORDER_CANCELLED', 'RELEASED'].includes(row.eventType) ? '减少' : '未知事件，待核查'
}

export default function SubscriptionDetail({ record, subjectId, onClose }: {
  record: P2tSubscription; subjectId: string; onClose: () => void
}): JSX.Element {
  const currentSubject = useAuthStore(state => state.userInfo?.tenantId)
  const allowed = String(currentSubject) === subjectId
  const navigate = useNavigate()
  const offerQuery = useQuery({
    queryKey: ['p2t-subscription-source', subjectId, record.offerNo],
    queryFn: () => getP2tOffer(record.offerNo), enabled: allowed && !!record.offerNo,
    staleTime: 0, refetchOnMount: 'always',
  })
  const offer = allowed ? offerQuery.data : undefined
  const status = SUBSCRIPTION_STATUSES[record.writebackStatus]
  return <Drawer title="认购流水详情" open={allowed} onClose={onClose} destroyOnClose width={860}>
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert type={record.writebackStatus === 'FAILED' ? 'error' : 'info'} showIcon
        message={`本条认购影响：${subscriptionEffect(record)}`}
        description="本详情为认购回写记录，认购预留不等于库存出库，也不代表订单已履约。" />
      <SectionCard title="流水与订单">
        <DetailInfoGrid items={[
          { label: '流水 ID', value: String(record.id) }, { label: '订单号', value: record.orderNo },
          { label: '供给单号', value: record.offerNo }, { label: '采收批次号', value: record.batchNo || offer?.batchNo },
          { label: '买家', value: record.buyerName }, { label: '买家类型', value: record.buyerType },
          { label: '事件类型', value: SUBSCRIPTION_EVENTS[record.eventType] || record.eventType },
          { label: '本次数量', value: `${record.qty ?? '—'}${offer?.unit ? ` ${offer.unit}` : '（单位未确认）'}` },
          { label: '等级', value: record.grade },
          { label: '回写状态', value: <Tag color={status?.color}>{status?.text || record.writebackStatus || '—'}</Tag> },
        ]} />
      </SectionCard>
      <SectionCard title="处理结果与时间">
        <DetailInfoGrid items={[
          { label: '锁定开始', value: record.lockFrom }, { label: '锁定结束', value: record.lockTo },
          { label: '支付时间', value: record.paidAt }, { label: '回写时间', value: record.createTime },
          { label: '回写说明', value: record.writebackMessage, fullWidth: true },
        ]} />
      </SectionCard>
      <SectionCard title="来源供给当前信息" extra={<Button loading={offerQuery.isFetching} onClick={() => { void offerQuery.refetch() }}>刷新来源</Button>}>
        {offerQuery.isError ? <Alert type="error" showIcon message="来源供给加载失败或无权访问" action={<Button onClick={() => { void offerQuery.refetch() }}>重试</Button>} />
          : offerQuery.isPending ? <Spin /> : offer && <>
            <DetailInfoGrid items={[
              { label: '作物／品种', value: [offer.cropName, offer.varietyName].filter(Boolean).join(' · ') },
              { label: '交易品类', value: offer.categoryName || offer.categoryCode },
              { label: '农场', value: offer.farmName }, { label: '产地', value: offer.origin },
              { label: '供给总量', value: `${offer.availableQty ?? '—'} ${offer.unit || ''}` },
              { label: '当前净认购量', value: `${offer.reservedQty ?? '—'} ${offer.unit || ''}` },
            ]} />
            <Space wrap style={{ marginTop: 16 }}>
              <Button onClick={() => { onClose(); navigate(`/production/p2t/offers?batchId=${encodeURIComponent(String(offer.batchId))}&subjectId=${encodeURIComponent(subjectId)}`) }}>查看同批次供给</Button>
              {offer.batchId && <Button onClick={() => { onClose(); navigate(`/production/harvests/${offer.batchId}`) }}>查看来源采收</Button>}
            </Space>
          </>}
      </SectionCard>
    </Space>
  </Drawer>
}
