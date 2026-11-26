import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 用户中心 · 订单聚合
 *
 * <p><b>聚合的是"能可靠归属到当前账号"的订单，不是"平台所有订单"。</b>
 * 目前只接入交易域：`agri_trade_order` 有 buyer_id / seller_id（主体维度），
 * 且 `/api/trade/order/page` 会从令牌推导当前账号名下主体范围 —— 服务端不会相信前端传的范围。</p>
 *
 * <p>服务域与商城域**没有接入**，页面上会明确写出原因（表里没有账号归属字段 /
 * consumer_id 与平台账号未打通）。宁可少聚合一个域，也不能给出一份归属不明的订单列表。</p>
 *
 * <p>订单明细由前端直接调交易域接口，不经过用户中心转发 —— 中间层一旦做聚合查询，
 * 就很容易变成"谁的都能查"。</p>
 */

import { Icon } from '@/components/Icon';
import { getPlatformAccessToken } from '../../utils/platformToken';
interface OrderSource {
  code: string;
  name: string;
  enabled: boolean;
  endpoint: string | null;
  description: string;
  reason: string | null;
}
interface StatusMeta {
  code: string;
  label: string;
}
interface TradeOrder {
  id: number;
  orderNo: string;
  buyerId: number | null;
  buyerName: string | null;
  sellerId: number | null;
  sellerName: string | null;
  productName: string | null;
  categoryName: string | null;
  totalAmount: number | null;
  paidAmount: number | null;
  paymentStatus: string | null;
  orderStatus: string | null;
  createTime: string | null;
}
interface UnifiedOrder {
  source: string;
  sourceLabel: string;
  id: string;
  orderNo: string;
  counterparty: string;
  side: 'buy' | 'sell' | 'unknown';
  productName: string;
  amount: number;
  status: string;
  paymentStatus: string;
  createTime: string;
}
interface ApiBody<T> {
  code: number;
  message?: string;
  data?: T;
}

/**
 * 交易域的成功码是 **200**（不是平台侧的 0），这里两个都认。
 * 早先按 code===0 判会把正常响应当失败，页面一直空表。
 */
async function fetchJson<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, {
    credentials: 'include',
    headers
  });
  const body = (await response.json()) as ApiBody<T>;
  const ok = body.code === 0 || body.code === 200;
  if (!response.ok || !ok) {
    throw new Error(body.message || '请求失败');
  }
  return body.data as T;
}

/** 交易订单 → 统一结构；对手方按"我是买方还是卖方"取另一侧 */
function toUnified(order: TradeOrder, myMerchantIds: number[]): UnifiedOrder {
  const isBuyer = order.buyerId != null && myMerchantIds.includes(order.buyerId);
  const isSeller = order.sellerId != null && myMerchantIds.includes(order.sellerId);
  const side: UnifiedOrder['side'] = isBuyer ? 'buy' : isSeller ? 'sell' : 'unknown';
  return {
    source: 'trade',
    sourceLabel: '交易撮合',
    id: String(order.id),
    orderNo: order.orderNo ?? '',
    counterparty: (side === 'sell' ? order.buyerName : order.sellerName) ?? '—',
    side,
    productName: order.productName || order.categoryName || '—',
    amount: Number(order.totalAmount ?? 0),
    status: order.orderStatus ?? '',
    paymentStatus: order.paymentStatus ?? '',
    createTime: order.createTime ?? ''
  };
}
const SIDE_LABEL: Record<UnifiedOrder['side'], string> = {
  buy: '采购',
  sell: '销售',
  unknown: '—'
};

/**
 * 订单聚合页面
 *
 * @returns 页面内容
 */
export const Orders = defineComponent({
  name: "Orders",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const sources = ref<OrderSource[]>([]);
    const setSources = (next: typeof sources.value | ((previous: typeof sources.value) => typeof sources.value)) => {
      sources.value = typeof next === 'function' ? (next as (previous: typeof sources.value) => typeof sources.value)(sources.value) : next;
    };
    const statuses = ref<StatusMeta[]>([]);
    const setStatuses = (next: typeof statuses.value | ((previous: typeof statuses.value) => typeof statuses.value)) => {
      statuses.value = typeof next === 'function' ? (next as (previous: typeof statuses.value) => typeof statuses.value)(statuses.value) : next;
    };
    const orders = ref<UnifiedOrder[]>([]);
    const setOrders = (next: typeof orders.value | ((previous: typeof orders.value) => typeof orders.value)) => {
      orders.value = typeof next === 'function' ? (next as (previous: typeof orders.value) => typeof orders.value)(orders.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const notice = ref('');
    const setNotice = (next: typeof notice.value | ((previous: typeof notice.value) => typeof notice.value)) => {
      notice.value = typeof next === 'function' ? (next as (previous: typeof notice.value) => typeof notice.value)(notice.value) : next;
    };
    const statusFilter = ref('all');
    const setStatusFilter = (next: typeof statusFilter.value | ((previous: typeof statusFilter.value) => typeof statusFilter.value)) => {
      statusFilter.value = typeof next === 'function' ? (next as (previous: typeof statusFilter.value) => typeof statusFilter.value)(statusFilter.value) : next;
    };
    const total = ref(0);
    const setTotal = (next: typeof total.value | ((previous: typeof total.value) => typeof total.value)) => {
      total.value = typeof next === 'function' ? (next as (previous: typeof total.value) => typeof total.value)(total.value) : next;
    };
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      setNotice('');
      try {
        const meta = await fetchJson<{
          sources?: OrderSource[];
          statuses?: StatusMeta[];
        }>('/api/v1/sso/account/orders/sources');
        setSources(meta?.sources ?? []);
        setStatuses(meta?.statuses ?? []);

        /* 交易域接口要 Bearer：用 HttpOnly 刷新凭证换一枚，与消息中心同一套做法 */
        const token = await getPlatformAccessToken();
        const page = await fetchJson<{
          records?: TradeOrder[];
          total?: number | string;
        }>('/api/trade/order/page?pageNum=1&pageSize=50', token);
        const records = page?.records ?? [];
        setTotal(Number(page?.total ?? records.length));

        /* 判断"我是买方还是卖方"需要自己的主体 id，直接问交易域，不在前端猜 */
        let myMerchantIds: number[] = [];
        try {
          const mine = await fetchJson<unknown>('/api/trade/identity/my-merchants', token);
          const list = Array.isArray(mine) ? mine : (mine as {
            list?: unknown[];
          })?.list ?? [];
          myMerchantIds = (list as {
            merchantId?: number;
            id?: number;
          }[]).map(row => Number(row?.merchantId ?? row?.id ?? 0)).filter(id => id > 0);
        } catch {
          /* 拿不到主体列表不影响列表展示，只是"采购/销售"标签会退化成「—」 */
        }
        if (myMerchantIds.length === 0 && records.length > 0) {
          setNotice('未能取到当前账号的经营主体，列表里的「采购/销售」方向可能显示为「—」');
        }
        setOrders(records.map(order => toUnified(order, myMerchantIds)));
      } catch (e) {
        setError((e as Error).message || '订单加载失败');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          void load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const statusLabel = (code: string): string => statuses.value.find(row => row.code === code)?.label ?? code;
    const visible = computed(() => statusFilter.value === 'all' ? orders.value : orders.value.filter(row => row.status === statusFilter.value));

    /** 各状态计数（基于已取回的一页数据，页面会注明口径） */
    const counts = computed(() => {
      const result: Record<string, number> = {};
      for (const row of orders.value) result[row.status] = (result[row.status] ?? 0) + 1;
      return result;
    });
    const enabledSources = computed(() => sources.value.filter(row => row.enabled));
    const pendingSources = computed(() => sources.value.filter(row => !row.enabled));
    return () => {
      const view_total = total.value;
      const view_enabledSources = enabledSources.value;
      const view_loading = loading.value;
      const view_notice = notice.value;
      const view_error = error.value;
      const view_statuses = statuses.value;
      const view_statusFilter = statusFilter.value;
      const view_visible = visible.value;
      const view_orders = orders.value;
      const view_pendingSources = pendingSources.value;
      return <div class="uc-ord">
      <div class="uc-ord-head">
        <div>
          <strong>
            共 {view_total} 笔订单 · 已接入 {view_enabledSources.length} 个来源
          </strong>
          <small>只聚合能可靠归属到当前账号的订单，归属范围由各域服务端自己判定</small>
        </div>
        <button class="btn btn-outline btn-sm" onClick={() => void load()} disabled={view_loading}>
          刷新
        </button>
      </div>

      {view_notice && <div class="account-notice">{view_notice}</div>}
      {view_error && <div class="account-error">{view_error}</div>}
      {view_loading && <div class="card empty">正在加载订单…</div>}

      {!view_loading && !view_error && <>
          <ul class="uc-ord-stats">
            {view_statuses.map(meta => <li key={meta.code} class={view_statusFilter === meta.code ? 'on' : ''} onClick={() => setStatusFilter(view_statusFilter === meta.code ? 'all' : meta.code)}>
                <span>{meta.label}</span>
                <strong>{counts.value[meta.code] ?? 0}</strong>
              </li>)}
          </ul>

          {view_statusFilter !== 'all' && <p class="uc-ord-filter">
              正在按「{statusLabel(view_statusFilter)}」筛选
              <button class="uc-ord-clear" onClick={() => setStatusFilter('all')}>
                清除
              </button>
            </p>}

          {view_visible.length === 0 ? <div class="card empty">
              {view_orders.length === 0 ? '当前账号名下还没有订单。订单归属按经营主体判定，未绑定主体时不会显示任何单据。' : `没有「${statusLabel(view_statusFilter)}」状态的订单`}
            </div> : <ul class="uc-ord-list">
              {view_visible.map(row => <li key={`${row.source}-${row.id}`}>
                  <div class="uc-ord-top">
                    <span class="uc-ord-source">{row.sourceLabel}</span>
                    <span class={`uc-ord-side ${row.side}`}>{SIDE_LABEL[row.side]}</span>
                    <strong class="uc-ord-no">{row.orderNo}</strong>
                    <span class={`uc-ord-status ${row.status}`}>{statusLabel(row.status)}</span>
                  </div>
                  <div class="uc-ord-body">
                    <span class="uc-ord-product">{row.productName}</span>
                    <span class="uc-ord-party">
                      {row.side === 'sell' ? '买方' : '卖方'}：{row.counterparty}
                    </span>
                    <span class="uc-ord-amount">¥{row.amount.toFixed(2)}</span>
                  </div>
                  <div class="uc-ord-meta">
                    <span>{row.createTime.replace('T', ' ').slice(0, 16)}</span>
                    <span>支付：{row.paymentStatus || '—'}</span>
                  </div>
                </li>)}
            </ul>}

          {view_pendingSources.length > 0 && <div class="uc-ord-pending">
              <strong>未纳入聚合的来源</strong>
              <ul>
                {view_pendingSources.map(row => <li key={row.code}>
                    <Icon name="alert" size={12} />
                    <span class="uc-ord-pending-name">{row.name}</span>
                    <span class="uc-ord-pending-reason">{row.reason}</span>
                  </li>)}
              </ul>
            </div>}

          <p class="uc-ord-foot">
            说明：统计口径为已取回的一页数据（最多 50 笔），不是全量；订单明细以各域自己的页面为准。
          </p>
        </>}
    </div>;
    };
  }
});
