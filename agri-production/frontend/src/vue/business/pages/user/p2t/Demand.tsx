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
import useAuthStore from '@/vue/authStore';
import BusinessRecordList from '@/vue/business/components/BusinessRecordList';
import ProductionListFilters from '@/vue/business/components/ProductionListFilters';
import Card from '@/vue/business/components/SectionCard';
/**
 * 页面名称：需求分析建议
 * 路由路径：/production/p2t/demand
 * 所属模块：产销对接
 *
 * 成交量 + 认购率 + 在架可售量 → 供需判断 → 排产建议。
 * 建议不是指令，种什么、种多少仍由农场决定；算法不使用成交价格。
 */
import { Alert, Tag, DatePicker, Button, Space } from '@/vue/ui';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useQuery } from '@/vue/query';
import { PageContainer as PageContainer } from '@/vue/pro';
import { fetchP2tDemandSignals } from '@/api/p2t';
import type { P2tDemandSignal } from '@/api/p2t';
import { SCROLL_BY_CONTENT, wideTextCell } from '@/components/tableScroll';
const JUDGE_TAG: Record<string, string> = {
  认购较高: 'green',
  认购适中: 'blue',
  认购偏低: 'orange',
  数据待核查: 'red'
};
const P2tDemand = defineComponent({
  name: "P2tDemand",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const subjectId = useAuthStore(state => state.userInfo?.tenantId);
    const range = shallowRef<[Dayjs, Dayjs] | null>(null);
    const draftRange = shallowRef<[Dayjs, Dayjs] | null>(null);
    const setRange = (next: typeof range.value | ((previous: typeof range.value) => typeof range.value)) => {
      range.value = typeof next === 'function' ? (next as (previous: typeof range.value) => typeof range.value)(range.value) : next;
    };
    const startDate = computed(() => range.value?.[0].format('YYYY-MM-DD'));
    const endDate = computed(() => range.value?.[1].format('YYYY-MM-DD'));
    const scoped = computed(() => Boolean(range.value));
    const query = useQuery(() => ({
      queryKey: ['p2t-demand', subjectId.value, startDate.value, endDate.value],
      queryFn: () => fetchP2tDemandSignals({
        startDate: startDate.value,
        endDate: endDate.value
      }),
      enabled: Boolean(subjectId.value)
    }));
    const rows = computed(() => query.data ?? []);
    return () => {
      return <PageContainer class="production-list-dense production-member-list" header={{
        title: '需求分析建议'
      }}>

      <Card class="production-dense-filter-card">
      <ProductionListFilters onSearch={() => setRange(draftRange.value)} onReset={() => { draftRange.value = null; setRange(null); }} loading={query.isFetching}>
        <div class="production-filter-field"><label>统计日期</label>
        <DatePicker.RangePicker value={draftRange.value} onChange={dates => { draftRange.value = dates?.[0] && dates?.[1] ? [dates[0], dates[1]] : null; }} disabledDate={date => date.isAfter(dayjs(), 'day')} presets={[{
            label: '本月',
            value: [dayjs().startOf('month'), dayjs()]
          }, {
            label: '本季度',
            value: [dayjs().month(Math.floor(dayjs().month() / 3) * 3).startOf('month'), dayjs()]
          }, {
            label: '本年',
            value: [dayjs().startOf('year'), dayjs()]
          }, {
            label: '近30天',
            value: [dayjs().subtract(29, 'day'), dayjs()]
          }]} />
        </div>
      </ProductionListFilters>
      </Card>
      {query.isError && <Alert type="error" showIcon message="需求统计加载失败，请刷新重试" />}
      <BusinessRecordList memberListToolbar rowKey={row => JSON.stringify([row.categoryCode, row.unit])} columnWidthStorageKey="p2t-demand" onReload={() => query.refetch()} toolbarTitle={range.value ? `${startDate.value} 至 ${endDate.value}` : '累计需求统计'} pagination={{ defaultPageSize: 20, showSizeChanger: true }} loading={query.isLoading} dataSource={rows.value} class="p2t-scroll-table" scroll={SCROLL_BY_CONTENT} columns={[{
          title: '品类',
          render: (_, r) => <b>{r.categoryName ?? r.categoryCode}（{r.cropName}）</b>
        }, {
          title: '单位',
          dataIndex: 'unit',
          width: 90
        }, {
          title: scoped.value ? '期初净认购' : '期初净认购（全部）',
          dataIndex: 'openingNetQty',
          align: 'right',
          hidden: !scoped.value
        }, {
          title: scoped.value ? '期间认购' : '累计认购',
          dataIndex: 'periodPaidQty',
          align: 'right'
        }, {
          title: scoped.value ? '期间取消／释放' : '取消／释放',
          dataIndex: 'periodReleasedQty',
          align: 'right'
        }, {
          title: '期间净变化',
          dataIndex: 'periodNetQty',
          align: 'right',
          hidden: !scoped.value
        }, {
          title: scoped.value ? '期末净认购量' : '净认购量',
          dataIndex: 'tradedQty',
          align: 'right',
          render: v => `${v}`
        }, {
          title: '历史承接供给量',
          dataIndex: 'supplyQty',
          align: 'right'
        }, {
          title: '当前在架未认购意向量',
          dataIndex: 'onSaleQty',
          align: 'right'
        }, {
          title: '净认购率',
          dataIndex: 'subscriptionRate',
          align: 'right',
          render: v => scoped.value ? '—' : `${v}%`
        }, {
          title: '供给单数',
          dataIndex: 'offerCount',
          align: 'right'
        }, {
          title: '认购状态',
          dataIndex: 'judgement',
          render: (v: string) => <Tag color={JUDGE_TAG[v] ?? 'default'}>{scoped.value && v !== '数据待核查' ? '期间统计' : v}</Tag>
        }, {
          title: '排产建议',
          dataIndex: 'suggestion',
          ...wideTextCell('suggestion', 280),
          render: (value, row) => scoped.value ? row.dataAnomaly ? '数据待核查，暂停形成排产建议' : '缺少历史供给快照，不按期间数据推算认购率及排产建议' : value
        }]} footer={() => scoped.value ? '按成功回写记录时间筛选，含结束日全天；期初净认购＋期间净变化＝期末净认购（异常冲销除外）。供给及在架量为当前值，不代表历史快照；缺失回写时间的记录不计入期间统计并标记待核查。' : '累计口径：成功支付认购减取消／释放；按品类和单位分组，包含关闭供给历史。在架未认购意向量不等于仓库可发布库存。'} locale={{
          emptyText: '还没有可分析的数据：先发布供给并等待交易端回写认购'
        }} />
    </PageContainer>;
    };
  }
});
export default P2tDemand;
