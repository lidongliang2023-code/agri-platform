import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};
import '@/components/ProductionDetailCompact.css';
import { Alert, Button, Drawer, Space, Spin, Tag } from '@/vue/ui';
import { useQuery } from '@/vue/query';
import { useNavigate } from '@/vue/router';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import SectionCard from '@/vue/business/components/SectionCard';
import { getP2tOffer } from '@/api/p2t';
import type { P2tSubscription } from '@/api/p2t';
import useAuthStore from '@/vue/authStore';
export const SUBSCRIPTION_EVENTS: Record<string, string> = {
  ORDER_PAID: '支付认购',
  ORDER_CANCELLED: '订单取消',
  RELEASED: '认购释放'
};
export const SUBSCRIPTION_STATUSES: Record<string, {
  text: string;
  color: string;
}> = {
  SUCCESS: {
    text: '成功',
    color: 'green'
  },
  FAILED: {
    text: '失败',
    color: 'red'
  },
  PENDING: {
    text: '待处理',
    color: 'orange'
  }
};
export function subscriptionEffect(row: P2tSubscription): string {
  if (row.writebackStatus !== 'SUCCESS') return '未计入';
  return row.eventType === 'ORDER_PAID' ? '增加' : ['ORDER_CANCELLED', 'RELEASED'].includes(row.eventType) ? '减少' : '未知事件，待核查';
}
const SubscriptionDetail = defineComponent({
  name: "SubscriptionDetail",
  props: {
    record: null as unknown as PropType<{
      record: P2tSubscription;
      subjectId: string;
      onClose: () => void;
    }["record"]>,
    subjectId: null as unknown as PropType<{
      record: P2tSubscription;
      subjectId: string;
      onClose: () => void;
    }["subjectId"]>,
    onClose: null as unknown as PropType<{
      record: P2tSubscription;
      subjectId: string;
      onClose: () => void;
    }["onClose"]>
  },
  setup(__props: {
    record: P2tSubscription;
    subjectId: string;
    onClose: () => void;
  }, {
    slots: __slots
  }) {
    const currentSubject = useAuthStore(state => state.userInfo?.tenantId);
    const allowed = computed(() => String(currentSubject.value) === __props.subjectId);
    const navigate = useNavigate();
    const offerQuery = useQuery(() => ({
      queryKey: ['p2t-subscription-source', __props.subjectId, __props.record.offerNo],
      queryFn: () => getP2tOffer(__props.record.offerNo),
      enabled: allowed.value && !!__props.record.offerNo,
      staleTime: 0,
      refetchOnMount: 'always'
    }));
    const offer = computed(() => allowed.value ? offerQuery.data : undefined);
    const status = computed(() => SUBSCRIPTION_STATUSES[__props.record.writebackStatus]);
    return () => {
      const _offerAtStart = offer.value;
      return <Drawer rootClassName="production-detail-compact production-detail-dialog" title="认购流水详情" open={allowed.value} onClose={__props.onClose} destroyOnClose width={860}>
    <Space direction="vertical" size={12} style={{
          width: '100%'
        }}>
      <Alert type={__props.record.writebackStatus === 'FAILED' ? 'error' : 'info'} showIcon message={`本条认购影响：${subscriptionEffect(__props.record)}`} description="本详情为认购回写记录，认购预留不等于库存出库，也不代表订单已履约。" />
      <SectionCard title="流水与订单">
        <DetailInfoGrid items={[{
              label: '流水 ID',
              value: String(__props.record.id)
            }, {
              label: '订单号',
              value: __props.record.orderNo
            }, {
              label: '供给单号',
              value: __props.record.offerNo
            }, {
              label: '采收批次号',
              value: __props.record.batchNo || _offerAtStart?.batchNo
            }, {
              label: '买家',
              value: __props.record.buyerName
            }, {
              label: '买家类型',
              value: __props.record.buyerType
            }, {
              label: '事件类型',
              value: SUBSCRIPTION_EVENTS[__props.record.eventType] || __props.record.eventType
            }, {
              label: '本次数量',
              value: `${__props.record.qty ?? '—'}${_offerAtStart?.unit ? ` ${_offerAtStart.unit}` : '（单位未确认）'}`
            }, {
              label: '等级',
              value: __props.record.grade
            }, {
              label: '回写状态',
              value: <Tag color={status.value?.color}>{status.value?.text || __props.record.writebackStatus || '—'}</Tag>
            }]} />
      </SectionCard>
      <SectionCard title="处理结果与时间">
        <DetailInfoGrid items={[{
              label: '锁定开始',
              value: __props.record.lockFrom
            }, {
              label: '锁定结束',
              value: __props.record.lockTo
            }, {
              label: '支付时间',
              value: __props.record.paidAt
            }, {
              label: '回写时间',
              value: __props.record.createTime
            }, {
              label: '回写说明',
              value: __props.record.writebackMessage,
              fullWidth: true
            }]} />
      </SectionCard>
      <SectionCard title="来源供给当前信息" extra={<Button loading={offerQuery.isFetching} onClick={() => {
            void offerQuery.refetch();
          }}>刷新来源</Button>}>
        {offerQuery.isError ? <Alert type="error" showIcon message="来源供给加载失败或无权访问" action={<Button onClick={() => {
              void offerQuery.refetch();
            }}>重试</Button>} /> : offerQuery.isPending ? <Spin /> : _offerAtStart && <>
            <DetailInfoGrid items={[{
                label: '作物／品种',
                value: [_offerAtStart.cropName, _offerAtStart.varietyName].filter(Boolean).join(' · ')
              }, {
                label: '交易品类',
                value: _offerAtStart.categoryName || _offerAtStart.categoryCode
              }, {
                label: '农场',
                value: _offerAtStart.farmName
              }, {
                label: '产地',
                value: _offerAtStart.origin
              }, {
                label: '供给总量',
                value: `${_offerAtStart.availableQty ?? '—'} ${_offerAtStart.unit || ''}`
              }, {
                label: '当前净认购量',
                value: `${_offerAtStart.reservedQty ?? '—'} ${_offerAtStart.unit || ''}`
              }]} />
            <Space wrap style={{
                marginTop: 16
              }}>
              <Button onClick={() => {
                  __props.onClose();
                  navigate(`/production/p2t/offers?batchId=${encodeURIComponent(String(_offerAtStart.batchId))}&subjectId=${encodeURIComponent(__props.subjectId)}`);
                }}>查看同批次供给</Button>
              {_offerAtStart.batchId && <Button onClick={() => {
                  __props.onClose();
                  navigate(`/production/harvests/${_offerAtStart.batchId}`);
                }}>查看来源采收</Button>}
            </Space>
          </>}
      </SectionCard>
    </Space>
  </Drawer>;
    };
  }
});
export default SubscriptionDetail;
