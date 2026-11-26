import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { getMineDashboard, type MineDashboard } from '@/api/mine-dashboard';
import { getMyMerchants, getMyRealName, type MyMerchant, type RealNameRecord } from '@/api/identity';
import { getOrderList, type OrderQuery } from '@/api/order';
import { getDemandList, type DemandVO } from '@/api/demand';
import { getEvaluationList, type EvaluationVO } from '@/api/evaluation';
import { getDisputeList, type DisputeVO } from '@/api/dispute';
import { getSellerProductList, type SellerProductDetail } from '@/api/product';
import { getLogisticsList, type LogisticsVO } from '@/api/logistics';
import { getMyGuarantees, type GuaranteeRow } from '@/api/guarantee';
import { getMyInquiries, getReceivedInquiries, type InquiryVO } from '@/api/inquiry';
export interface OrderRow {
  id: number;
  orderNo: string;
  buyerId: number;
  buyerName: string;
  sellerId: number;
  sellerName: string;
  productName: string;
  categoryName?: string;
  totalQuantity: number | null;
  totalAmount: number;
  paidAmount?: number;
  orderStatus: string;
  paymentStatus: string;
  createTime: string;
}
export const ORDER_STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  pending_confirm: {
    text: '待确认',
    tone: 'amber'
  },
  pending: {
    text: '待付款',
    tone: 'amber'
  },
  paid: {
    text: '待发货',
    tone: 'tech'
  },
  shipped: {
    text: '运输中',
    tone: 'tech'
  },
  received: {
    text: '已收货',
    tone: 'green'
  },
  completed: {
    text: '已完成',
    tone: 'green'
  },
  cancelled: {
    text: '已取消',
    tone: 'ghost'
  },
  refunding: {
    text: '退款中',
    tone: 'red'
  },
  refunded: {
    text: '已退款',
    tone: 'ghost'
  }
};
export const money = (value: number | null | undefined): string => value == null ? '—' : `¥${Number(value).toLocaleString('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;
export const shortDate = (value: string | null | undefined): string => value ? value.replace('T', ' ').slice(0, 16) : '—';
export const StatusTag = defineComponent({
  name: "StatusTag",
  props: {
    status: null as unknown as PropType<{
      status: string;
      side?: 'buyer' | 'seller';
    }["status"]>,
    side: null as unknown as PropType<{
      status: string;
      side?: 'buyer' | 'seller';
    }["side"]>
  },
  setup(__props: {
    status: string;
    side?: 'buyer' | 'seller';
  }, {
    slots: __slots
  }) {
    const known = computed(() => ORDER_STATUS[__props.status]);
    const text = computed(() => known.value?.text ?? __props.status ?? '未知');
    const tone = computed(() => known.value?.tone ?? 'ghost');
    return () => {
      return <span class={`mc-tag ${tone.value}`}>{__props.side === 'seller' && __props.status === 'paid' ? '待发货' : text.value}</span>;
    };
  }
});
export const EmptyState = defineComponent({
  name: "EmptyState",
  props: {
    title: null as unknown as PropType<{
      title: string;
      desc?: string;
      action?: VNodeChild;
    }["title"]>,
    desc: null as unknown as PropType<{
      title: string;
      desc?: string;
      action?: VNodeChild;
    }["desc"]>,
    action: null as unknown as PropType<{
      title: string;
      desc?: string;
      action?: VNodeChild;
    }["action"]>
  },
  setup(__props: {
    title: string;
    desc?: string;
    action?: VNodeChild;
  }, {
    slots: __slots
  }) {
    return () => {
      return <div class="mc-empty">
      <div class="mc-empty-title">{__props.title}</div>
      {__props.desc && <div class="mc-empty-desc">{__props.desc}</div>}
      {__props.action && <div class="mc-empty-action">{__props.action}</div>}
    </div>;
    };
  }
});
export const Panel = defineComponent({
  name: "Panel",
  props: {
    title: null as unknown as PropType<{
      title?: VNodeChild;
      extra?: VNodeChild;
      children: VNodeChild;
      className?: string;
    }["title"]>,
    extra: null as unknown as PropType<{
      title?: VNodeChild;
      extra?: VNodeChild;
      children: VNodeChild;
      className?: string;
    }["extra"]>,
    className: null as unknown as PropType<{
      title?: VNodeChild;
      extra?: VNodeChild;
      children: VNodeChild;
      className?: string;
    }["className"]>
  },
  setup(__props: {
    title?: VNodeChild;
    extra?: VNodeChild;
    children?: VNodeChild;
    className?: string;
  }, {
    slots: __slots
  }) {
    return () => {
      return <section class={`mc-panel ${__props.className ?? ''}`}>
      {(__props.title || __props.extra) && <div class="mc-panel-head">
          <h3>{__props.title}</h3>
          <div class="mc-panel-extra">{__props.extra}</div>
        </div>}
      {__slots.default?.()}
    </section>;
    };
  }
});
interface PageResult<T> {
  records?: T[];
  total?: number;
}
interface ApiResult<T> {
  code?: number;
  message?: string;
  data?: T;
}
function pageOf<T>(body: ApiResult<PageResult<T>> | undefined): {
  rows: T[];
  total: number;
  error?: string;
} {
  if (!body) return {
    rows: [],
    total: 0,
    error: '接口无响应'
  };
  if (body.code !== 200) return {
    rows: [],
    total: 0,
    error: body.message ?? '加载失败'
  };
  return {
    rows: body.data?.records ?? [],
    total: body.data?.total ?? 0
  };
}

/** 当前登录账号绑定的经营主体 + 买卖两侧看板 + 实名状态。 */
export { useMemberBase, useOrders, useDemands, useMyInquiryRows, useReceivedInquiries, useEvaluations, useDisputes, useProducts, useLogistics, useGuarantees } from '@/vue/useMemberQueries';
