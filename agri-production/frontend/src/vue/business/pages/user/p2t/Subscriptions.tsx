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
import ListRowActions from '@/vue/business/components/ListRowActions';
import '@/components/ProductionDetailCompact.css';
import '@/components/ProductionListDense.css';
import { Alert, Button, Drawer, Tabs, Tag } from '@/vue/ui';
import type { ActionType, ProColumns } from '@/vue/pro';
import useAuthStore from '@/vue/authStore';
import ProTable from '@/vue/ProductionRequestTable';
import SectionCard from '@/vue/business/components/SectionCard';
import { PageContainer as PageContainer } from '@/vue/pro';
import { SCROLL_BY_CONTENT } from '@/components/tableScroll';
import { listP2tSubscriptionFlows, listP2tSubscriptions } from '@/api/p2t';
import type { P2tSubscription, P2tSubscriptionSummary } from '@/api/p2t';
import OfferSubscriptionFlows from './OfferSubscriptionFlows';
import SubscriptionDetail, { SUBSCRIPTION_EVENTS, SUBSCRIPTION_STATUSES, subscriptionEffect } from './SubscriptionDetail';
const P2tSubscriptions = defineComponent({
  name: "P2tSubscriptions",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const tab = shallowRef('summary');
    const setTab = (next: typeof tab.value | ((previous: typeof tab.value) => typeof tab.value)) => {
      tab.value = typeof next === 'function' ? (next as (previous: typeof tab.value) => typeof tab.value)(tab.value) : next;
    };
    const subjectId = useAuthStore(state => state.userInfo?.tenantId);
    const scope = computed(() => String(subjectId.value ?? ''));
    const selected = shallowRef<{
      row: P2tSubscription;
      subject: string;
    } | null>(null);
    const setSelected = (next: typeof selected.value | ((previous: typeof selected.value) => typeof selected.value)) => {
      selected.value = typeof next === 'function' ? (next as (previous: typeof selected.value) => typeof selected.value)(selected.value) : next;
    };
    const offer = shallowRef<P2tSubscriptionSummary | null>(null);
    const setOffer = (next: typeof offer.value | ((previous: typeof offer.value) => typeof offer.value)) => {
      offer.value = typeof next === 'function' ? (next as (previous: typeof offer.value) => typeof offer.value)(offer.value) : next;
    };
    const failed = shallowRef({
      summary: false,
      flow: false
    });
    const setFailed = (next: typeof failed.value | ((previous: typeof failed.value) => typeof failed.value)) => {
      failed.value = typeof next === 'function' ? (next as (previous: typeof failed.value) => typeof failed.value)(failed.value) : next;
    };
    const summaryRef = shallowRef<ActionType | null>(null);
    const flowRef = shallowRef<ActionType | null>(null);
    onMounted(() => {
      watch(() => [subjectId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setSelected(null);
          setOffer(null);
          setFailed({
            summary: false,
            flow: false
          });
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const isCurrent = () => !!scope.value && String(useAuthStore.getState().userInfo?.tenantId ?? '') === scope.value;
    const summaryColumns = computed<ProColumns<P2tSubscriptionSummary>[]>(() => [{
      title: '供给单号／作物',
      dataIndex: 'keyword',
      hideInTable: true
    }, {
      title: '供给单号',
      dataIndex: 'offerNo',
      width: 190,
      search: false,
      copyable: true
    }, {
      title: '作物',
      dataIndex: 'cropName',
      search: false
    }, {
      title: '品种',
      dataIndex: 'varietyName',
      search: false
    }, {
      title: '品类',
      dataIndex: 'categoryName',
      search: false
    }, {
      title: '供给总量',
      dataIndex: 'availableQty',
      search: false,
      align: 'right',
      render: (_, row) => `${row.availableQty ?? '—'} ${row.unit || ''}`
    }, {
      title: '净认购量',
      dataIndex: 'reservedQty',
      search: false,
      align: 'right',
      render: (_, row) => `${row.reservedQty ?? '—'} ${row.unit || ''}`
    }, {
      title: '未认购意向量',
      dataIndex: 'remainingQty',
      search: false,
      align: 'right',
      render: (_, row) => `${row.remainingQty ?? '—'} ${row.unit || ''}`
    }, {
      title: '认购率',
      dataIndex: 'subscriptionRate',
      search: false,
      render: (_, row) => row.subscriptionRate == null ? '—' : `${row.subscriptionRate}%`
    }, {
      title: '交易状态',
      dataIndex: 'tradeStatus',
      search: false,
      render: (_, row) => {
        const meta: Record<string, {
          text: string;
          color: string;
        }> = {
          PENDING: {
            text: '待建品',
            color: 'default'
          },
          LISTED: {
            text: '已上架',
            color: 'green'
          },
          SOLD: {
            text: '已售罄',
            color: 'blue'
          },
          CLOSED: {
            text: '已关闭',
            color: 'default'
          }
        };
        const item = meta[row.tradeStatus];
        return <Tag color={item?.color}>{item?.text || row.tradeStatus || '—'}</Tag>;
      }
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 120,
      render: (_, row) => <ListRowActions>
          <Button key="flow" type="link" size="small" onClick={() => setOffer(row)}>查看流水</Button>
        </ListRowActions>
    }]);
    const flowColumns = computed<ProColumns<P2tSubscription>[]>(() => [{
      title: '订单号／买家',
      dataIndex: 'keyword',
      hideInTable: true
    }, {
      title: '订单号',
      dataIndex: 'orderNo',
      width: 190,
      search: false,
      render: (_, row) => <Button type="link" onClick={() => setSelected({
        row,
        subject: scope.value
      })}>{row.orderNo || '查看详情'}</Button>
    }, {
      title: '供给单号',
      dataIndex: 'offerNo',
      width: 190,
      search: false
    }, {
      title: '采收批次号',
      dataIndex: 'batchNo',
      width: 180,
      search: false
    }, {
      title: '买家',
      dataIndex: 'buyerName',
      search: false
    }, {
      title: '事件类型',
      dataIndex: 'eventType',
      valueType: 'select',
      valueEnum: SUBSCRIPTION_EVENTS
    }, {
      title: '本次数量',
      dataIndex: 'qty',
      search: false,
      align: 'right'
    }, {
      title: '认购影响',
      key: 'effect',
      search: false,
      render: (_, row) => subscriptionEffect(row)
    }, {
      title: '等级',
      dataIndex: 'grade',
      search: false
    }, {
      title: '回写状态',
      dataIndex: 'writebackStatus',
      valueType: 'select',
      valueEnum: Object.fromEntries(Object.entries(SUBSCRIPTION_STATUSES).map(([key, value]) => [key, value.text])),
      render: (_, row) => <Tag color={SUBSCRIPTION_STATUSES[row.writebackStatus]?.color}>{SUBSCRIPTION_STATUSES[row.writebackStatus]?.text || row.writebackStatus}</Tag>
    }, {
      title: '回写时间',
      dataIndex: 'createTime',
      width: 170,
      search: false
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 100,
      render: (_, row) => <ListRowActions>
          <Button key="detail" type="link" size="small" onClick={() => setSelected({
          row,
          subject: scope.value
        })}>详情</Button>
        </ListRowActions>
    }]);
    return () => {
      return <PageContainer class="production-list-dense production-member-list" header={{
        title: '认购台账'
      }}>
    <Tabs activeKey={tab.value} onChange={setTab} items={[{
          key: 'summary',
          label: '按供给汇总'
        }, {
          key: 'flow',
          label: '全部事件流水'
        }]} />
    {tab.value === 'summary' && <SectionCard title="供给单认购汇总" style={{
          marginBottom: 16
        }}>
      {failed.value.summary && <Alert type="error" showIcon message="认购汇总加载失败" action={<Button onClick={() => summaryRef.value?.reload()}>重试</Button>} />}
      <ProTable memberListToolbar key={`summary-${scope.value}`} actionRef={summaryRef} rowKey="offerNo" columns={summaryColumns.value} columnWidthStorageKey="p2t-subscription-summary" scroll={SCROLL_BY_CONTENT} params={{
            subjectId: subjectId.value
          }} search={{
            labelWidth: 'auto',
            layout: 'vertical'
          }} rowSelection={{}} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true
          }} options={{
            reload: true,
            density: true,
            setting: true
          }} tableAlertRender={false} request={async params => {
            if (!isCurrent()) return {
              data: [],
              total: 0,
              success: false
            };
            setFailed(previous => ({
              ...previous,
              summary: false
            }));
            const result = await listP2tSubscriptions({
              pageNum: params.current ?? 1,
              pageSize: params.pageSize ?? 20,
              keyword: params.keyword
            });
            return isCurrent() ? {
              data: result.list,
              total: result.total,
              success: true
            } : {
              data: [],
              total: 0,
              success: false
            };
          }} onRequestError={() => setFailed(previous => ({
            ...previous,
            summary: true
          }))} />
    </SectionCard>}
    <Drawer rootClassName="production-detail-compact production-detail-dialog" title={`供给单流水 ${offer.value?.offerNo || ''}`} width="min(1100px, 100vw)" open={!!offer.value} onClose={() => setOffer(null)} destroyOnClose>
      {offer.value && <OfferSubscriptionFlows key={`${scope.value}-${offer.value.offerNo}`} offerNo={offer.value.offerNo} unit={offer.value.unit} subjectId={scope.value} />}
    </Drawer>
    {tab.value === 'flow' && <SectionCard title="认购回写流水" style={{
          marginTop: 16
        }}>
      {failed.value.flow && <Alert type="error" showIcon message="认购流水加载失败" action={<Button onClick={() => flowRef.value?.reload()}>重试</Button>} />}
      <ProTable memberListToolbar key={`flow-${scope.value}`} actionRef={flowRef} rowKey="id" columns={flowColumns.value} columnWidthStorageKey="p2t-subscription-records" scroll={SCROLL_BY_CONTENT} params={{
            subjectId: subjectId.value
          }} search={{
            labelWidth: 'auto',
            layout: 'vertical'
          }} rowSelection={{}} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true
          }} options={{
            reload: true,
            density: true,
            setting: true
          }} tableAlertRender={false} request={async params => {
            if (!isCurrent()) return {
              data: [],
              total: 0,
              success: false
            };
            setFailed(previous => ({
              ...previous,
              flow: false
            }));
            const result = await listP2tSubscriptionFlows({
              pageNum: params.current ?? 1,
              pageSize: params.pageSize ?? 20,
              keyword: params.keyword,
              eventType: params.eventType,
              writebackStatus: params.writebackStatus
            });
            return isCurrent() ? {
              data: result.list,
              total: result.total,
              success: true
            } : {
              data: [],
              total: 0,
              success: false
            };
          }} onRequestError={() => setFailed(previous => ({
            ...previous,
            flow: true
          }))} />
    </SectionCard>}
    {selected.value && selected.value.subject === scope.value && <SubscriptionDetail record={selected.value.row} subjectId={selected.value.subject} onClose={() => setSelected(null)} />}
  </PageContainer>;
    };
  }
});
export default P2tSubscriptions;
