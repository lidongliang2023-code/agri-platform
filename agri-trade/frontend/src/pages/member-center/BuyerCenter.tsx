import './buyer-center.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import type { TablePaginationConfig } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { TradeList, TradeFilters } from '@/components/TradeList';
import TradeAgentPanel from './TradeAgentPanel';
import { useNavigate, useSearchParams } from "@/vue/router";
import { Form, Input, Modal, Select, message } from "@/vue/ui";
import { AlertOutlined, ArrowRightOutlined, CheckCircleFilled, ClockCircleOutlined, CustomerServiceOutlined, DollarOutlined, FileSearchOutlined, FileTextOutlined, HeartOutlined, HomeOutlined, SafetyCertificateOutlined, SendOutlined, ShoppingCartOutlined, StarOutlined, CarOutlined, WalletOutlined } from "@ant-design/icons-vue";
import { confirmReceipt, getMyRefunds, type RefundRow } from '@/api/order';
import { acceptQuote, convertQuoteToOrder, getQuoteList, type QuoteVO } from '@/api/quote';
import { applyInvoice, getMyInvoices, type InvoiceRow } from '@/api/invoice';
import ContractList from '@/pages/contract/list';
import DisputeList from '@/pages/dispute/list';
import LogisticsList from '@/pages/logistics/list';
import MyCompensation from '@/pages/mine-compensation';
import MyGuarantee from '@/pages/mine-guarantee';
import DemandCreate from '@/pages/demand/create';
import { ShopChat } from '@/pages/shop/detail/ShopChat';
import { getFavoriteProducts, getFollowingSellers, unfavoriteProduct, unfollowSeller, type FavoriteProduct, type FollowingSeller } from '@/api/shop-interaction';
import { MemberCenterShell, type MemberNavItem } from './MemberCenterShell';
import { EmptyState, Panel, StatusTag, money, shortDate, useDemands, useDisputes, useEvaluations, useGuarantees, useMemberBase, useMyInquiryRows, useOrders, type OrderRow } from './shared';
const NAV: MemberNavItem[] = [{
  key: 'agent',
  label: '采购 Agent',
  icon: <FileTextOutlined />,
  group: '交易寻源'
}, {
  key: 'overview',
  label: '首页概览',
  icon: <HomeOutlined />,
  group: '交易寻源'
}, {
  key: 'demand-list',
  label: '采购需求',
  icon: <FileSearchOutlined />,
  group: '交易寻源'
}, {
  key: 'inquiry',
  label: '询价与报价',
  icon: <FileSearchOutlined />,
  group: '交易寻源'
}, {
  key: 'chat',
  label: '洽谈消息',
  icon: <CustomerServiceOutlined />,
  group: '交易寻源'
}, {
  key: 'purchase',
  label: '采购订单',
  icon: <ShoppingCartOutlined />,
  group: '订单履约'
}, {
  key: 'after',
  label: '收货与售后',
  icon: <CarOutlined />,
  group: '订单履约'
}, {
  key: 'rate',
  label: '采购评价',
  icon: <StarOutlined />,
  group: '订单履约'
}, {
  key: 'contract',
  label: '合同管理',
  icon: <FileTextOutlined />,
  group: '资产与账务'
}, {
  key: 'fund',
  label: '资金与发票',
  icon: <DollarOutlined />,
  group: '资产与账务'
}, {
  key: 'favorite',
  label: '收藏与关注',
  icon: <HeartOutlined />,
  group: '资产与账务'
}];
const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`;
const BUYER_STATUS = [{
  value: '',
  label: '全部'
}, {
  value: 'pending_confirm',
  label: '待付款'
}, {
  value: 'paid',
  label: '待发货'
}, {
  value: 'shipped',
  label: '待收货'
}, {
  value: 'received',
  label: '已收货'
}, {
  value: 'refunding',
  label: '退款中'
}, {
  value: 'refunded',
  label: '已退款'
}, {
  value: 'completed',
  label: '已完成'
}];
const REFUND_STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  pending: {
    text: '待审核',
    tone: 'amber'
  },
  approved: {
    text: '已退款',
    tone: 'green'
  },
  rejected: {
    text: '已驳回',
    tone: 'red'
  },
  cancelled: {
    text: '已撤销',
    tone: 'ghost'
  }
};
const INQUIRY_STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  pending: {
    text: '待报价',
    tone: 'amber'
  },
  pending_reply: {
    text: '待报价',
    tone: 'amber'
  },
  quoted: {
    text: '已报价',
    tone: 'tech'
  },
  converted: {
    text: '已转订单',
    tone: 'green'
  },
  closed: {
    text: '已关闭',
    tone: 'ghost'
  },
  expired: {
    text: '已过期',
    tone: 'ghost'
  }
};
const BuyerCenter = defineComponent({
  name: "BuyerCenter",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const active = computed(() => params.value.get('tab') || 'overview');
    const setActive = (key: string): void => {
      const next = new URLSearchParams(params.value);
      next.set('tab', key);
      setParams(next, {
        replace: true
      });
    };
    const base = useMemberBase();
    onMounted(() => {
      watch(() => [active.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (active.value === 'profile') window.location.replace(PERSONAL_CENTER);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    // 同一账号可能同时绑定多个主体：买家中心优先用 buyer 角色的主体展示与筛选需求。
    const buyerMerchant = computed(() => base.merchants.find(item => item.roleInMerchant === 'buyer') ?? base.primary);
    const buyerId = computed(() => buyerMerchant.value ? String(buyerMerchant.value.merchantId) : null);
    const allOrders = useOrders(() => 'buyer', () => '', () => 1, () => 100);
    const status = shallowRef('');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const draftOrderStatus = shallowRef('');
    const setDraftOrderStatus = (next: typeof draftOrderStatus.value | ((previous: typeof draftOrderStatus.value) => typeof draftOrderStatus.value)) => {
      draftOrderStatus.value = typeof next === 'function' ? (next as (previous: typeof draftOrderStatus.value) => typeof draftOrderStatus.value)(draftOrderStatus.value) : next;
    };
    const demandKeyword = shallowRef('');
    const setDemandKeyword = (next: typeof demandKeyword.value | ((previous: typeof demandKeyword.value) => typeof demandKeyword.value)) => {
      demandKeyword.value = typeof next === 'function' ? (next as (previous: typeof demandKeyword.value) => typeof demandKeyword.value)(demandKeyword.value) : next;
    };
    const demandStatus = shallowRef('');
    const setDemandStatus = (next: typeof demandStatus.value | ((previous: typeof demandStatus.value) => typeof demandStatus.value)) => {
      demandStatus.value = typeof next === 'function' ? (next as (previous: typeof demandStatus.value) => typeof demandStatus.value)(demandStatus.value) : next;
    };
    const draftDemandKeyword = shallowRef('');
    const setDraftDemandKeyword = (next: typeof draftDemandKeyword.value | ((previous: typeof draftDemandKeyword.value) => typeof draftDemandKeyword.value)) => {
      draftDemandKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftDemandKeyword.value) => typeof draftDemandKeyword.value)(draftDemandKeyword.value) : next;
    };
    const draftDemandStatus = shallowRef('');
    const setDraftDemandStatus = (next: typeof draftDemandStatus.value | ((previous: typeof draftDemandStatus.value) => typeof draftDemandStatus.value)) => {
      draftDemandStatus.value = typeof next === 'function' ? (next as (previous: typeof draftDemandStatus.value) => typeof draftDemandStatus.value)(draftDemandStatus.value) : next;
    };
    const demandPage = shallowRef(1);
    const setDemandPage = (next: typeof demandPage.value | ((previous: typeof demandPage.value) => typeof demandPage.value)) => {
      demandPage.value = typeof next === 'function' ? (next as (previous: typeof demandPage.value) => typeof demandPage.value)(demandPage.value) : next;
    };
    const page = shallowRef(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const pageSize = shallowRef(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const pagedOrders = useOrders(() => 'buyer', () => status.value, () => page.value, () => pageSize.value);
    const demands = useDemands(() => buyerId.value);
    const inquiries = useMyInquiryRows();
    const disputes = useDisputes();
    const evaluations = useEvaluations(() => ({
      evaluatorId: buyerId.value ?? undefined
    }));
    const guarantees = useGuarantees();
    const invoices = shallowRef<InvoiceRow[]>([]);
    const setInvoices = (next: typeof invoices.value | ((previous: typeof invoices.value) => typeof invoices.value)) => {
      invoices.value = typeof next === 'function' ? (next as (previous: typeof invoices.value) => typeof invoices.value)(invoices.value) : next;
    };
    const quotes = shallowRef<QuoteVO[]>([]);
    const setQuotes = (next: typeof quotes.value | ((previous: typeof quotes.value) => typeof quotes.value)) => {
      quotes.value = typeof next === 'function' ? (next as (previous: typeof quotes.value) => typeof quotes.value)(quotes.value) : next;
    };
    const selectedInquiryId = shallowRef<number | null>(null);
    const setSelectedInquiryId = (next: typeof selectedInquiryId.value | ((previous: typeof selectedInquiryId.value) => typeof selectedInquiryId.value)) => {
      selectedInquiryId.value = typeof next === 'function' ? (next as (previous: typeof selectedInquiryId.value) => typeof selectedInquiryId.value)(selectedInquiryId.value) : next;
    };
    const refunds = shallowRef<RefundRow[]>([]);
    const setRefunds = (next: typeof refunds.value | ((previous: typeof refunds.value) => typeof refunds.value)) => {
      refunds.value = typeof next === 'function' ? (next as (previous: typeof refunds.value) => typeof refunds.value)(refunds.value) : next;
    };
    const quoteBusy = shallowRef<number | null>(null);
    const setQuoteBusy = (next: typeof quoteBusy.value | ((previous: typeof quoteBusy.value) => typeof quoteBusy.value)) => {
      quoteBusy.value = typeof next === 'function' ? (next as (previous: typeof quoteBusy.value) => typeof quoteBusy.value)(quoteBusy.value) : next;
    };
    const following = shallowRef<FollowingSeller[]>([]);
    const setFollowing = (next: typeof following.value | ((previous: typeof following.value) => typeof following.value)) => {
      following.value = typeof next === 'function' ? (next as (previous: typeof following.value) => typeof following.value)(following.value) : next;
    };
    const favoriteProducts = shallowRef<FavoriteProduct[]>([]);
    const setFavoriteProducts = (next: typeof favoriteProducts.value | ((previous: typeof favoriteProducts.value) => typeof favoriteProducts.value)) => {
      favoriteProducts.value = typeof next === 'function' ? (next as (previous: typeof favoriteProducts.value) => typeof favoriteProducts.value)(favoriteProducts.value) : next;
    };
    const followingLoading = shallowRef(false);
    const setFollowingLoading = (next: typeof followingLoading.value | ((previous: typeof followingLoading.value) => typeof followingLoading.value)) => {
      followingLoading.value = typeof next === 'function' ? (next as (previous: typeof followingLoading.value) => typeof followingLoading.value)(followingLoading.value) : next;
    };
    const followingBusy = shallowRef<string | null>(null);
    const setFollowingBusy = (next: typeof followingBusy.value | ((previous: typeof followingBusy.value) => typeof followingBusy.value)) => {
      followingBusy.value = typeof next === 'function' ? (next as (previous: typeof followingBusy.value) => typeof followingBusy.value)(followingBusy.value) : next;
    };
    const chatTarget = shallowRef<{
      sellerId: string;
      sellerName: string;
      productId: number | null;
    } | null>(null);
    const setChatTarget = (next: typeof chatTarget.value | ((previous: typeof chatTarget.value) => typeof chatTarget.value)) => {
      chatTarget.value = typeof next === 'function' ? (next as (previous: typeof chatTarget.value) => typeof chatTarget.value)(chatTarget.value) : next;
    };
    const invoiceOpen = shallowRef(false);
    const setInvoiceOpen = (next: typeof invoiceOpen.value | ((previous: typeof invoiceOpen.value) => typeof invoiceOpen.value)) => {
      invoiceOpen.value = typeof next === 'function' ? (next as (previous: typeof invoiceOpen.value) => typeof invoiceOpen.value)(invoiceOpen.value) : next;
    };
    const invoiceSubmitting = shallowRef(false);
    const setInvoiceSubmitting = (next: typeof invoiceSubmitting.value | ((previous: typeof invoiceSubmitting.value) => typeof invoiceSubmitting.value)) => {
      invoiceSubmitting.value = typeof next === 'function' ? (next as (previous: typeof invoiceSubmitting.value) => typeof invoiceSubmitting.value)(invoiceSubmitting.value) : next;
    };
    const invoiceForm = Form.useForm<{
      orderId: number;
      invoiceType: string;
      title: string;
      taxNo?: string;
      remark?: string;
    }>();
    const loadInvoices = () => {
      getMyInvoices().then(body => {
        if (body?.code === 200) setInvoices(Array.isArray(body.data) ? body.data : []);
      }).catch(() => {/* 页面显示未接入/重试提示 */});
    };
    onMounted(() => {
      watch(() => [loadInvoices], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          loadInvoices();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const loadQuotes = () => {
      if (!buyerId.value) {
        setQuotes([]);
        return;
      }
      getQuoteList({
        pageNum: 1,
        pageSize: 100,
        buyerId: buyerId.value
      }).then((body: {
        code: number;
        data?: {
          records?: QuoteVO[];
        };
      }) => {
        if (body?.code === 200) setQuotes(body.data?.records ?? []);
      }).catch(() => setQuotes([]));
    };
    const loadRefunds = () => {
      getMyRefunds().then((body: {
        code: number;
        data?: RefundRow[];
      }) => {
        if (body?.code === 200) setRefunds(Array.isArray(body.data) ? body.data : []);
      }).catch(() => setRefunds([]));
    };
    onMounted(() => {
      watch(() => [buyerId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          loadQuotes();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [loadRefunds], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          loadRefunds();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const loadFollowing = (): void => {
      setFollowingLoading(true);
      Promise.all([getFollowingSellers(), getFavoriteProducts()]).then(([followResult, productResult]) => {
        if (followResult.code === 200) setFollowing(followResult.data ?? []);
        if (productResult.code === 200) setFavoriteProducts(productResult.data ?? []);
      }).catch(() => {
        setFollowing([]);
        setFavoriteProducts([]);
      }).finally(() => setFollowingLoading(false));
    };
    onMounted(() => {
      watch(() => [active.value, loadFollowing], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (active.value === 'favorite') loadFollowing();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [active.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (active.value === 'demand-list') demands.reload();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const orderStats = computed(() => {
      const rows = allOrders.rows;
      const evaluated = new Set(evaluations.rows.map(item => item.orderId));
      return {
        pendingPay: rows.filter(item => item.orderStatus === 'pending' || item.orderStatus === 'pending_confirm').length,
        pendingShip: rows.filter(item => item.orderStatus === 'paid').length,
        pendingReceive: rows.filter(item => item.orderStatus === 'shipped').length,
        pendingRate: rows.filter(item => ['received', 'completed'].includes(item.orderStatus) && !evaluated.has(item.id)).length
      };
    });
    const guaranteeTotal = computed(() => guarantees.value.reduce((sum, item) => sum + Number(item.totalAmount ?? 0), 0));
    const guaranteeAvailable = computed(() => guarantees.value.reduce((sum, item) => sum + Number(item.availableAmount ?? 0), 0));
    const guaranteeFrozen = computed(() => guarantees.value.reduce((sum, item) => sum + Number(item.frozenAmount ?? 0), 0));
    const filteredDemands = computed(() => {
      const keyword = demandKeyword.value.trim().toLowerCase();
      return demands.rows.filter(row => (!demandStatus.value || row.demandStatus === demandStatus.value) && (!keyword || [row.demandNo, row.demandName, row.productName, row.categoryName, row.variety].some(value => String(value ?? '').toLowerCase().includes(keyword))));
    });
    const myDisputes = computed(() => disputes.rows.filter(item => base.merchantIds.includes(String(item.complainantId))));
    const evaluatedOrderIds = computed(() => new Set(evaluations.rows.map(item => item.orderId)));
    const pendingEvaluations = computed(() => allOrders.rows.filter(item => ['received', 'completed'].includes(item.orderStatus) && !evaluatedOrderIds.value.has(item.id)));
    const invoicedOrderIds = computed(() => new Set(invoices.value.map(item => item.orderId)));
    const eligibleInvoiceOrders = computed(() => allOrders.rows.filter(item => ['paid', 'shipped', 'received', 'completed'].includes(item.orderStatus) && !invoicedOrderIds.value.has(item.id)));
    const openInvoice = (): void => {
      setInvoiceOpen(true);
    };
    const submitInvoice = async (): Promise<void> => {
      try {
        const values = await invoiceForm.validateFields();
        setInvoiceSubmitting(true);
        const body = await applyInvoice(values);
        if (body?.code === 200) {
          message.success('开票申请已提交');
          setInvoiceOpen(false);
          loadInvoices();
        } else {
          message.error(body?.message ?? '提交开票申请失败');
        }
      } catch (error) {
        if (error && typeof error === 'object' && 'errorFields' in error) return;
        message.error('提交开票申请失败（请检查后端是否在运行）');
      } finally {
        setInvoiceSubmitting(false);
      }
    };
    const confirmReceive = (order: OrderRow): void => {
      Modal.confirm({
        title: '确认已收到货物？',
        content: `订单 ${order.orderNo} · ${order.productName}。确认后订单将进入已完成状态。`,
        okText: '确认收货',
        cancelText: '取消',
        onOk: async () => {
          try {
            const body = await confirmReceipt(order.id, {
              signReceiver: order.buyerName
            });
            if (body?.code === 200) {
              message.success('已确认收货，订单进入售后与评价阶段');
              allOrders.reload();
              pagedOrders.reload();
            } else {
              message.error(body?.message ?? '确认收货失败');
            }
          } catch {
            message.error('确认收货失败（请检查后端是否在运行）');
          }
        }
      });
    };
    const orderActions = (order: OrderRow): VNodeChild => <ListRowActions>
      <a class="mc-link" href={`/order/detail/${order.id}`}>查看详情</a>
      {order.orderStatus === 'shipped' && <button type="button" class="mc-link" onClick={() => confirmReceive(order)}>确认收货</button>}
      {['received', 'completed'].includes(order.orderStatus) && !evaluatedOrderIds.value.has(order.id) && <a class="mc-link" href="/evaluation">去评价</a>}
    </ListRowActions>;
    const acceptBuyerQuote = async (quote: QuoteVO): Promise<void> => {
      setQuoteBusy(quote.id);
      try {
        const accepted = await acceptQuote(quote.id);
        if (accepted?.code !== 200) {
          message.error(accepted?.message ?? '接受报价失败');
          return;
        }
        // accept 接口已完成受理与成单；convert 接口在这里作为幂等取订单入口。
        const converted = await convertQuoteToOrder(quote.id);
        if (converted?.code === 200 && converted.data?.id) {
          message.success('已接受报价并生成采购订单');
          loadQuotes();
          demands.reload();
          inquiries.reload();
          allOrders.reload();
          pagedOrders.reload();
          navigate(`/order/confirm?orderId=${converted.data.id}`);
        } else {
          message.error(converted?.message ?? '报价已受理，但生成订单失败');
        }
      } catch {
        message.error('接受报价失败（请检查后端是否在运行）');
      } finally {
        setQuoteBusy(null);
      }
    };
    const renderOverview = (): VNodeChild => <div class="buyer-overview">
      <section class="buyer-overview-hero">
        <span class="buyer-overview-icon"><ShoppingCartOutlined /></span>
        <div class="buyer-overview-title">
          <small>BUYER PROCUREMENT CENTER</small>
          <h2>采购工作台</h2>
          <p>{buyerMerchant.value?.merchantName || '当前采购主体'} · 从需求发布到收货开票，进度统一跟踪</p>
        </div>
        <div class="buyer-overview-figures">
          <div><span>累计采购额</span><strong>{money(base.dashboard?.buyer?.totalSpent ?? 0)}</strong></div>
          <div><span>今日采购额</span><strong>{money(base.dashboard?.buyer?.todaySpent ?? 0)}</strong></div>
          <div><span>可用保证金</span><strong>{money(guaranteeAvailable.value)}</strong></div>
        </div>
        <div class="buyer-overview-actions">
          <button type="button" class="mc-btn" onClick={() => setActive('publish')}>
            <SendOutlined /> 发起采购
          </button>
          <a class="mc-btn ghost" href="/hall">交易大厅 <ArrowRightOutlined /></a>
        </div>
      </section>

      <section class="buyer-task-grid">
        {[{
          label: '待付款',
          value: orderStats.value.pendingPay,
          tone: 'amber',
          icon: <WalletOutlined />,
          desc: '完成支付后进入履约',
          status: 'pending_confirm'
        }, {
          label: '待发货',
          value: orderStats.value.pendingShip,
          tone: 'tech',
          icon: <ClockCircleOutlined />,
          desc: '供应方正在备货',
          status: 'paid'
        }, {
          label: '待收货',
          value: orderStats.value.pendingReceive,
          tone: 'tech',
          icon: <CarOutlined />,
          desc: '物流运输与签收',
          status: 'shipped'
        }, {
          label: '待评价',
          value: orderStats.value.pendingRate,
          tone: 'green',
          icon: <StarOutlined />,
          desc: '收货后评价供应商',
          status: 'received'
        }].map(item => <button type="button" class={`buyer-task ${item.tone}`} key={item.label} onClick={() => {
          setStatus(item.status);
          setDraftOrderStatus(item.status);
          setPage(1);
          setActive('purchase');
        }}>
            <span class="buyer-task-icon">{item.icon}</span>
            <span><small>{item.label}</small><strong>{item.value}<em>笔</em></strong><i>{item.desc}</i></span>
            <ArrowRightOutlined />
          </button>)}
      </section>

      <div class="buyer-overview-layout">
        <div class="buyer-overview-main">
          <Panel title="最近采购订单" extra={<button type="button" class="mc-link" onClick={() => setActive('purchase')}>
              查看全部订单 <ArrowRightOutlined />
            </button>}>
            {renderOrdersTable(allOrders.rows.slice(0, 5), allOrders.loading, allOrders.error, orderActions)}
          </Panel>

          <Panel title="询价与报价进展" extra={<button type="button" class="mc-link" onClick={() => setActive('inquiry')}>
              进入我的询价 <ArrowRightOutlined />
            </button>}>
            {quotes.value.length === 0 && demands.rows.length === 0 ? <EmptyState title="还没有采购需求或报价" desc="先发布采购需求，平台会辅助匹配供应商并接收正式报价。" action={<button type="button" class="mc-btn" onClick={() => setActive('publish')}>发布采购需求</button>} /> : <div class="buyer-overview-pipeline">
                <div class="buyer-pipeline-stat">
                  <span class="buyer-pipeline-icon"><FileTextOutlined /></span>
                  <div><small>采购需求</small><strong>{demands.rows.length}</strong><em>需求持续撮合中</em></div>
                </div>
                <div class="buyer-pipeline-stat">
                  <span class="buyer-pipeline-icon tech"><FileSearchOutlined /></span>
                  <div><small>询价单</small><strong>{inquiries.rows.length}</strong><em>等待供应商响应</em></div>
                </div>
                <div class="buyer-pipeline-stat">
                  <span class="buyer-pipeline-icon amber"><CheckCircleFilled /></span>
                  <div><small>待受理报价</small><strong>{quotes.value.filter(quote => quote.quoteStatus === 'pending').length}</strong><em>比较后可直接成单</em></div>
                </div>
                <div class="buyer-pipeline-stat">
                  <span class="buyer-pipeline-icon green"><StarOutlined /></span>
                  <div><small>待评价交易</small><strong>{pendingEvaluations.value.length}</strong><em>评价供应方服务</em></div>
                </div>
              </div>}
          </Panel>
        </div>

        <aside class="buyer-overview-aside">
          <Panel title="资金账户" extra={<a class="mc-link" href="/my-guarantee">账户明细</a>}>
            <div class="buyer-funds">
              <div><span>可用保证金</span><strong>{money(guaranteeAvailable.value)}</strong></div>
              <div><span>冻结金额</span><strong>{money(guaranteeFrozen.value)}</strong></div>
              <div><span>保证金总额</span><strong>{money(guaranteeTotal.value)}</strong></div>
            </div>
            <div class="buyer-funds-foot">
              <DollarOutlined />
              <span>订单按规则占用保证金，完成后自动释放。</span>
            </div>
          </Panel>

          <Panel title="快捷入口">
            <div class="buyer-quick-list">
              {[{
                icon: <FileSearchOutlined />,
                title: '采购需求',
                desc: '查看需求、详情与撮合进度',
                tab: 'demand-list'
              }, {
                icon: <SendOutlined />,
                title: '发布采购需求',
                desc: '创建新的采购任务',
                tab: 'publish'
              }, {
                icon: <FileSearchOutlined />,
                title: '我的询价',
                desc: '查看报价与议价进展',
                tab: 'inquiry'
              }, {
                icon: <CarOutlined />,
                title: '收货与售后',
                desc: '物流、退款与纠纷处理',
                tab: 'after'
              }, {
                icon: <DollarOutlined />,
                title: '资金与发票',
                desc: '保证金、发票与赔付',
                tab: 'fund'
              }].map(item => <button type="button" key={item.title} onClick={() => setActive(item.tab)}>
                  <span>{item.icon}</span>
                  <div><strong>{item.title}</strong><small>{item.desc}</small></div>
                  <ArrowRightOutlined />
                </button>)}
            </div>
          </Panel>

          <div class="buyer-trust-card">
            <SafetyCertificateOutlined />
            <div><strong>平台交易保障</strong><span>合同签署、支付、物流和售后全程留痕。</span></div>
          </div>
        </aside>
      </div>
    </div>;
    const renderDemandList = (): VNodeChild => <div class="buyer-workspace buyer-demand-workspace">
      <section class="buyer-workspace-hero">
        <span class="buyer-workspace-icon"><FileSearchOutlined /></span>
        <div>
          <small>PURCHASE REQUESTS</small>
          <h2>采购需求</h2>
          <p>集中查看已发布的采购需求、撮合进度与供应商响应情况。</p>
        </div>
        <div class="buyer-workspace-stats">
          <div><span>需求总数</span><strong>{demands.rows.length}</strong></div>
          <div><span>报价中</span><strong>{demands.rows.filter(row => row.demandStatus === 'quoted').length}</strong></div>
          <div><span>已成交</span><strong>{demands.rows.filter(row => row.demandStatus === 'completed').length}</strong></div>
        </div>
      </section>

      <TradeList listId="buyer-demands" rowKey="id" dataSource={filteredDemands.value} onRefresh={demands.reload} loading={demands.loading} pagination={{
        current: demandPage.value,
        onChange: setDemandPage
      }} filterSlot={<TradeFilters fields={[{
        label: '关键字',
        control: <Input allowClear value={draftDemandKeyword.value} onChange={event => setDraftDemandKeyword(event.target.value ?? '')} placeholder="需求编号、标题、品类或品种" />
      }, {
        label: '需求状态',
        control: <Select value={draftDemandStatus.value} onChange={setDraftDemandStatus} options={[{
          value: '',
          label: '全部状态'
        }, {
          value: 'pending',
          label: '待匹配'
        }, {
          value: 'matching',
          label: '匹配中'
        }, {
          value: 'quoted',
          label: '报价中'
        }, {
          value: 'completed',
          label: '已成交'
        }, {
          value: 'closed',
          label: '已关闭'
        }]} />
      }]} onQuery={() => {
        setDemandKeyword(draftDemandKeyword.value);
        setDemandStatus(draftDemandStatus.value);
        setDemandPage(1);
      }} onReset={() => {
        setDraftDemandKeyword('');
        setDraftDemandStatus('');
        setDemandKeyword('');
        setDemandStatus('');
        setDemandPage(1);
      }} />} toolbarLeft={<button type="button" class="mc-btn" onClick={() => setActive('publish')}><SendOutlined />发布采购需求</button>} locale={{
        emptyText: <EmptyState title={demands.error || '没有符合条件的需求'} />
      }} columns={[{
        title: "需求编号",
        key: 'col-1',
        width: 160,
        render: (_, row) => <span class="mc-mono">{row.demandNo}</span>
      }, {
        title: "需求标题",
        key: 'col-2',
        width: 160,
        render: (_, row) => <><strong class="buyer-demand-name">{row.demandName || row.productName || '—'}</strong></>
      }, {
        title: "品类 / 品种",
        key: 'col-3',
        width: 160,
        render: (_, row) => <>{row.categoryName ?? '—'} / {row.variety ?? '—'}</>
      }, {
        title: "采购量",
        key: 'col-4',
        width: 160,
        render: (_, row) => <span class="mc-mono">{row.quantity ?? '—'}</span>
      }, {
        title: "期望价",
        key: 'col-5',
        width: 160,
        render: (_, row) => <span class="mc-mono">{row.priceMin != null || row.priceMax != null ? `${row.priceMin ?? '—'} ~ ${row.priceMax ?? '—'}` : '—'}</span>
      }, {
        title: "报价数",
        key: 'col-6',
        width: 108,
        render: (_, row) => <span class="mc-mono">{row.responseCount ?? 0}</span>
      }, {
        title: "状态",
        key: 'col-7',
        width: 108,
        render: (_, row) => <><span class="mc-tag tech">{demandStatusText(row.demandStatus)}</span></>
      }, {
        title: "创建时间",
        key: 'col-8',
        width: 160,
        render: (_, row) => <span class="mc-mono mc-xs">{shortDate(row.createTime)}</span>
      }, {
        title: "操作",
        key: 'action',
        width: 170,
        render: (_, row) => <span class="buyer-demand-row-actions"><a class="mc-link" href={`/demand/detail/${row.id}`}>查看详情</a>
                      <button type="button" class="mc-link" onClick={() => navigate(`/member/buyer?tab=publish&id=${row.id}`)}>编辑</button></span>
      }]} />
    </div>;
    const renderPurchase = (): VNodeChild => renderOrdersTable(pagedOrders.rows, pagedOrders.loading, pagedOrders.error, orderActions, {
      onRefresh: pagedOrders.reload,
      filterSlot: <TradeFilters fields={[{
        label: '订单状态',
        control: <Select value={draftOrderStatus.value} onChange={setDraftOrderStatus} options={BUYER_STATUS} />
      }]} onQuery={() => {
        setStatus(draftOrderStatus.value);
        setPage(1);
      }} onReset={() => {
        setDraftOrderStatus('');
        setStatus('');
        setPage(1);
      }} />,
      toolbarLeft: <><button type="button" class="mc-btn" onClick={() => navigate('/order/create')}>创建采购订单</button><button type="button" class="mc-btn ghost" onClick={() => setActive('publish')}>发布采购需求</button></>,
      pagination: {
        current: page.value,
        pageSize: pageSize.value,
        total: pagedOrders.total,
        onChange: (nextPage, nextSize) => {
          setPage(nextPage);
          setPageSize(nextSize);
        }
      }
    });
    const renderInquiry = (): VNodeChild => <>
      <div class="mc-toolbar">
        <span class="mc-toolbar-muted">货源询价、供应方报价与议价进展</span>
        <span class="mc-spacer" />
        <button type="button" class="mc-btn ghost" onClick={() => setActive('demand-list')}>查看采购需求</button>
        <a class="mc-btn" href="/hall">去交易大厅询价</a>
      </div>
      <Panel title="货源询价进展">
        {inquiries.rows.length === 0 ? <EmptyState title="还没有询价单" desc="在交易大厅对货源发起询价后，会在这里跟踪报价与议价进展。" /> : <TradeList listId="buyer-inquiries" rowKey="id" dataSource={inquiries.rows} loading={inquiries.loading} onRefresh={inquiries.reload} rowClassName={row => `buyer-inquiry-row${selectedInquiryId.value === row.id ? ' selected' : ''}`} onRow={row => ({
          onClick: (event: MouseEvent) => {
            if (event.target instanceof Element && event.target.closest('.ant-table-selection-column, button, a')) return;
            setSelectedInquiryId(selectedInquiryId.value === row.id ? null : row.id);
          }
        })} columns={[{
          title: "询价单号",
          key: 'col-1',
          width: 160,
          render: (_, row) => <span class="mc-mono">{row.inquiryNo}</span>
        }, {
          title: "商品",
          key: 'col-2',
          width: 160,
          render: (_, row) => <>{row.productName}</>
        }, {
          title: "供应方",
          key: 'col-3',
          width: 160,
          render: (_, row) => <>{row.sellerName}</>
        }, {
          title: "数量",
          key: 'col-4',
          width: 108,
          render: (_, row) => <span class="mc-mono">{row.quantity} {row.unit}</span>
        }, {
          title: "报价数",
          key: 'col-5',
          width: 108,
          render: (_, row) => <span class="mc-mono">{row.replyCount ?? 0}</span>
        }, {
          title: "截止时间",
          key: 'col-6',
          width: 160,
          render: (_, row) => <span class="mc-mono mc-xs">{shortDate(row.replyDeadline)}</span>
        }, {
          title: "状态",
          key: 'col-7',
          width: 108,
          render: (_, row) => <><span class={`mc-tag ${(INQUIRY_STATUS[row.inquiryStatus] ?? {
              tone: 'ghost'
            }).tone}`}>
                        {(INQUIRY_STATUS[row.inquiryStatus] ?? {
                text: row.inquiryStatus || '未知'
              }).text}
                      </span></>
        }, {
          title: "操作",
          key: 'action',
          width: 170,
          render: (_, row) => <><button type="button" class="mc-link" onClick={event => {
              event.stopPropagation();
              setSelectedInquiryId(selectedInquiryId.value === row.id ? null : row.id);
            }}>
                        {selectedInquiryId.value === row.id ? '收起报价' : '查看报价'}
                      </button></>
        }]} />}
      </Panel>
      <Panel title={selectedInquiryId.value ? `供应商报价 · ${inquiries.rows.find(row => row.id === selectedInquiryId.value)?.inquiryNo ?? ''}` : '供应商报价'} extra={selectedInquiryId.value ? <button type="button" class="mc-link" onClick={() => setSelectedInquiryId(null)}>
            查看全部报价
          </button> : <span class="mc-toolbar-muted">点击上方询价单可联动筛选</span>}>
        {quotes.value.filter(quote => !selectedInquiryId.value || quote.inquiryId === selectedInquiryId.value).length === 0 ? <EmptyState title={selectedInquiryId.value ? '该询价单暂无供应商报价' : '还没有供应商报价'} desc={selectedInquiryId.value ? '供应商提交报价后会自动显示在这张询价单下。' : '询价发起后，供应方提交的报价会在这里显示，可直接受理并生成采购订单。'} /> : <TradeList key={selectedInquiryId.value ?? 'all'} listId="buyer-quotes" rowKey="id" dataSource={quotes.value.filter(quote => !selectedInquiryId.value || quote.inquiryId === selectedInquiryId.value)} onRefresh={loadQuotes} columns={[{
          title: "报价单号",
          key: 'col-1',
          width: 160,
          render: (_, quote) => <span class="mc-mono">{quote.quoteNo}</span>
        }, {
          title: "供应商",
          key: 'col-2',
          width: 160,
          render: (_, quote) => <>{quote.sellerName ?? '—'}</>
        }, {
          title: "商品",
          key: 'col-3',
          width: 160,
          render: (_, quote) => <>{quote.productName ?? '—'}</>
        }, {
          title: "单价",
          key: 'col-4',
          width: 160,
          render: (_, quote) => <span class="mc-price">{money(quote.unitPrice)}</span>
        }, {
          title: "数量",
          key: 'col-5',
          width: 108,
          render: (_, quote) => <span class="mc-mono">{quote.quantity} {quote.unit ?? ''}</span>
        }, {
          title: "运费",
          key: 'col-6',
          width: 160,
          render: (_, quote) => <span class="mc-price">{money(quote.freightAmount ?? 0)}</span>
        }, {
          title: "总价",
          key: 'col-7',
          width: 160,
          render: (_, quote) => <span class="mc-price">{money(quote.totalAmount)}</span>
        }, {
          title: "状态",
          key: 'col-8',
          width: 108,
          render: (_, quote) => <><span class={`mc-tag ${quote.quoteStatus === 'pending' ? 'amber' : quote.quoteStatus === 'rejected' ? 'red' : 'green'}`}>
                        {quote.quoteStatus === 'pending' ? '待受理' : quote.quoteStatus === 'accepted' ? '已受理' : quote.quoteStatus === 'rejected' ? '已拒绝' : quote.quoteStatus}
                      </span></>
        }, {
          title: "操作",
          key: 'action',
          width: 170,
          render: (_, quote) => <><ListRowActions>
                        <button type="button" class="mc-link" onClick={() => setChatTarget({
                sellerId: String(quote.sellerId),
                sellerName: quote.sellerName || '供应商',
                productId: quote.productId ?? null
              })}>进入洽谈</button>
                        {quote.quoteStatus === 'pending' ? <button type="button" class="mc-link" disabled={quoteBusy.value === quote.id} onClick={() => void acceptBuyerQuote(quote)}>
                            {quoteBusy.value === quote.id ? '处理中…' : '接受并生成订单'}
                          </button> : quote.orderId ? <a class="mc-link" href={`/order/detail/${quote.orderId}`}>查看订单</a> : null}
                      </ListRowActions></>
        }]} />}
      </Panel>
    </>;
    const renderAfter = (): VNodeChild => <>
      <div class="mc-toolbar">
        <span class="mc-toolbar-muted">售后申请 · 退换货 · 质量申诉 · 平台仲裁</span>
        <span class="mc-spacer" />
        <a class="mc-btn ghost" href="/dispute">发起 / 查看售后工单</a>
      </div>
      <Panel title="售后与争议工单">
        {myDisputes.value.length === 0 ? <EmptyState title="没有进行中的售后工单" desc="从订单详情或纠纷管理发起售后，工单会在这里汇总。" /> : <TradeList listId="buyer-disputes" rowKey="id" dataSource={myDisputes.value} loading={disputes.loading} onRefresh={disputes.reload} columns={[{
          title: "工单号",
          key: 'col-1',
          width: 160,
          render: (_, row) => <span class="mc-mono">{row.disputeNo}</span>
        }, {
          title: "关联订单",
          key: 'col-2',
          width: 160,
          render: (_, row) => <span class="mc-mono">{row.orderId}</span>
        }, {
          title: "类型",
          key: 'col-3',
          width: 160,
          render: (_, row) => <>{row.disputeType ?? '—'}</>
        }, {
          title: "问题描述",
          key: 'col-4',
          width: 220,
          render: (_, row) => <span class="mc-wrap-text">{row.disputeDescription ?? row.disputeReason ?? '—'}</span>
        }, {
          title: "状态",
          key: 'col-5',
          width: 108,
          render: (_, row) => <><span class="mc-tag amber">{row.disputeStatus ?? '处理中'}</span></>
        }, {
          title: "提交时间",
          key: 'col-6',
          width: 160,
          render: (_, row) => <span class="mc-mono mc-xs">{shortDate(row.createTime)}</span>
        }]} />}
      </Panel>
      <Panel title="退款与售后进度">
        {refunds.value.length === 0 ? <EmptyState title="暂无退款记录" desc="收货后如遇质量问题，可从订单详情发起退货退款；审核进度会显示在这里。" /> : <TradeList listId="buyer-refunds" rowKey="id" dataSource={refunds.value} onRefresh={loadRefunds} columns={[{
          title: "退款单号",
          key: 'col-1',
          width: 160,
          render: (_, row) => <span class="mc-mono">{row.refundNo}</span>
        }, {
          title: "订单号",
          key: 'col-2',
          width: 160,
          render: (_, row) => <span class="mc-mono">{row.orderNo}</span>
        }, {
          title: "类型",
          key: 'col-3',
          width: 160,
          render: (_, row) => <>{row.refundType === 'return_refund' ? '退货退款' : row.refundType === 'refund_only' ? '仅退款' : row.refundType}</>
        }, {
          title: "退款金额",
          key: 'col-4',
          width: 160,
          render: (_, row) => <span class="mc-price">{money(row.refundAmount)}</span>
        }, {
          title: "原因",
          key: 'col-5',
          width: 160,
          render: (_, row) => <span class="mc-wrap-text">{row.refundReason ?? '—'}</span>
        }, {
          title: "状态",
          key: 'col-6',
          width: 108,
          render: (_, row) => {
            const status = REFUND_STATUS[row.refundStatus] ?? {
              text: row.refundStatus,
              tone: 'ghost'
            };
            return <><span class={`mc-tag ${status.tone}`}>{status.text}</span></>;
          }
        }, {
          title: "审核意见",
          key: 'col-7',
          width: 220,
          render: (_, row) => <span class="mc-wrap-text">{row.reviewRemark ?? '—'}</span>
        }, {
          title: "申请时间",
          key: 'col-8',
          width: 160,
          render: (_, row) => <span class="mc-mono mc-xs">{shortDate(row.createTime)}</span>
        }]} />}
      </Panel>
      <div class="mc-embedded"><DisputeList /></div>
      <div class="mc-embedded"><LogisticsList /></div>
    </>;
    const renderRate = (): VNodeChild => <div class="buyer-workspace buyer-rating-workspace">
      <section class="buyer-workspace-hero">
        <span class="buyer-workspace-icon"><StarOutlined /></span>
        <div><small>PURCHASE REVIEWS</small><h2>采购评价</h2><p>记录真实采购体验，帮助平台沉淀供应商服务与履约质量。</p></div>
        <div class="buyer-workspace-stats">
          <div><span>待评价</span><strong>{pendingEvaluations.value.length}</strong></div>
          <div><span>已评价</span><strong>{evaluations.rows.length}</strong></div>
          <div><span>平均评分</span><strong>{evaluations.rows.length ? (evaluations.rows.reduce((sum, item) => sum + Number(item.ratingOverall ?? 0), 0) / evaluations.rows.length).toFixed(1) : '—'}</strong></div>
        </div>
      </section>
      <div class="buyer-rating-layout">
        <div class="buyer-workspace-main">
          <Panel title={`待评价订单（${pendingEvaluations.value.length}）`} extra={<span class="buyer-section-note">收货后可评价供应方</span>}>
            {pendingEvaluations.value.length === 0 ? <EmptyState title="没有待评价订单" desc="订单收货后可以评价供应方，评价会公开展示。" /> : <div class="buyer-review-pending-list">
                {pendingEvaluations.value.map(order => <div class="buyer-review-pending" key={order.id}>
                    <span class="buyer-review-order-icon"><ShoppingCartOutlined /></span>
                    <div><small>{order.orderNo}</small><strong>{order.productName || order.categoryName || '采购商品'}</strong><p>{order.sellerName || '供应商'} · {money(order.totalAmount)}</p></div>
                    <span class="mc-tag green">已收货</span>
                    <a class="mc-btn" href={`/order/detail/${order.id}`}>去评价 <ArrowRightOutlined /></a>
                  </div>)}
              </div>}
          </Panel>
          <Panel title={`我发出的评价（${evaluations.rows.length}）`} extra={<span class="buyer-section-note">按时间倒序</span>}>
            {evaluations.rows.length === 0 ? <EmptyState title="还没有评价记录" desc="完成订单后可对供应方进行评价。" /> : <div class="buyer-review-grid">
                {evaluations.rows.map(row => <div class="buyer-review-card" key={row.id}>
                    <div class="buyer-review-head">
                      <span>{row.evaluateeName?.slice(0, 1) || '供'}</span>
                      <div><strong>{row.evaluateeName || '供应方'}</strong><small>订单 {row.orderId} · {shortDate(row.createTime)}</small></div>
                      <em>{'★'.repeat(Math.round(row.ratingOverall))}</em>
                    </div>
                    <p>{row.evaluationContent || '未填写文字评价'}</p>
                    {row.replyContent && <div class="buyer-review-reply">供应商回复：{row.replyContent}</div>}
                    <div><span class="mc-tag green">{row.ratingOverall} 分</span><span class="mc-tag ghost">真实采购评价</span></div>
                  </div>)}
              </div>}
          </Panel>
        </div>
        <aside class="buyer-workspace-aside">
          <Panel title="评价说明">
            <ul class="buyer-workspace-guide">
              <li><CheckCircleFilled /> 只有当前采购主体参与的已收货订单可以评价。</li>
              <li><StarOutlined /> 每个采购主体对同一订单只能评价一次。</li>
              <li><SafetyCertificateOutlined /> 评价会公开用于供应商信用展示。</li>
            </ul>
          </Panel>
          <div class="buyer-workspace-trust">
            <SafetyCertificateOutlined />
            <div><strong>真实交易评价</strong><span>评分和内容均绑定真实订单，不展示模拟评价。</span></div>
          </div>
        </aside>
      </div>
    </div>;
    const renderContract = (): VNodeChild => <div class="mc-embedded mc-embedded-first"><ContractList /></div>;
    const renderFund = (): VNodeChild => <div class="buyer-workspace buyer-fund-workspace">
      <section class="buyer-workspace-hero">
        <span class="buyer-workspace-icon"><WalletOutlined /></span>
        <div><small>FUNDS & INVOICES</small><h2>资金与发票</h2><p>查看采购支出、保证金、赔付到账与发票申请状态。</p></div>
        <div class="buyer-workspace-stats">
          <div><span>累计采购</span><strong>{money(base.dashboard?.buyer?.totalSpent ?? 0)}</strong></div>
          <div><span>可用保证金</span><strong>{money(guaranteeAvailable.value)}</strong></div>
          <div><span>发票申请</span><strong>{invoices.value.length}</strong></div>
        </div>
      </section>
      <div class="buyer-finance-metrics">
        <div><span>累计采购支出</span><strong>{money(base.dashboard?.buyer?.totalSpent ?? 0)}</strong><small>不含已取消订单</small></div>
        <div><span>平均客单价</span><strong>{money(base.dashboard?.buyer?.avgOrderValue ?? 0)}</strong><small>按真实采购订单</small></div>
        <div><span>冻结保证金</span><strong>{money(guaranteeFrozen.value)}</strong><small>在途订单占用</small></div>
        <div><span>待开票申请</span><strong>{invoices.value.filter(item => item.invoiceStatus === 'pending').length}<em>笔</em></strong><small>已付款订单可申请</small></div>
      </div>

      <Panel title={`发票申请与记录（${invoices.value.length}）`} extra={<button type="button" class="mc-btn" onClick={openInvoice} disabled={eligibleInvoiceOrders.value.length === 0}>
          申请开票
        </button>}>
        {invoices.value.length === 0 ? <EmptyState title="还没有开票申请" desc={eligibleInvoiceOrders.value.length ? '选择一笔已付款订单申请开票。' : '暂无可开票订单。'} action={eligibleInvoiceOrders.value.length ? <button type="button" class="mc-btn" onClick={openInvoice}>申请开票</button> : undefined} /> : <div class="buyer-invoice-list">
            {invoices.value.map(row => <div class="buyer-invoice-card" key={row.id}>
                <span class="buyer-invoice-icon"><FileTextOutlined /></span>
                <div><small>{row.invoiceNo}</small><strong>{row.title}</strong><p>{row.orderNo} · {row.invoiceType}</p></div>
                <div><span>开票金额</span><strong>{money(row.amount)}</strong></div>
                <span class={`mc-tag ${row.invoiceStatus === 'issued' ? 'green' : row.invoiceStatus === 'rejected' ? 'red' : 'amber'}`}>{invoiceStatusText(row.invoiceStatus)}</span>
                <time>{shortDate(row.applyTime)}</time>
              </div>)}
          </div>}
      </Panel>

      <div class="buyer-finance-subpage">
        <div class="buyer-finance-subhead"><strong>保证金账户</strong><span>交易保证金与资金流水</span></div>
        <MyGuarantee />
      </div>
      <div class="buyer-finance-subpage">
        <div class="buyer-finance-subhead"><strong>获赔记录</strong><span>平台赔付与到账状态</span></div>
        <MyCompensation />
      </div>

      <Modal title="申请开票" open={invoiceOpen.value} onCancel={() => setInvoiceOpen(false)} onOk={() => void submitInvoice()} confirmLoading={invoiceSubmitting.value} okText="提交申请" cancelText="取消" destroyOnClose afterOpenChange={open => {
        if (open) {
          invoiceForm.setFieldsValue({
            orderId: eligibleInvoiceOrders.value[0]?.id,
            invoiceType: '增值税专用发票',
            title: buyerMerchant.value?.merchantName ?? '',
            taxNo: '',
            remark: ''
          });
        }
      }}>
        <Form form={invoiceForm} layout="vertical" preserve={false}>
          <Form.Item name="orderId" label="采购订单" rules={[{
            required: true,
            message: '请选择订单'
          }]}>
            <Select placeholder="选择已付款订单" options={eligibleInvoiceOrders.value.map(order => ({
              value: order.id,
              label: `${order.orderNo} · ${order.productName || order.categoryName || '订单商品'} · ${money(order.totalAmount)}`
            }))} />
          </Form.Item>
          <Form.Item name="invoiceType" label="发票类型" rules={[{
            required: true,
            message: '请选择发票类型'
          }]}>
            <Select options={['增值税专用发票', '增值税普通发票', '电子普通发票'].map(value => ({
              value,
              label: value
            }))} />
          </Form.Item>
          <Form.Item name="title" label="发票抬头" rules={[{
            required: true,
            message: '请填写发票抬头'
          }]}>
            <Input placeholder="与企业营业执照一致" />
          </Form.Item>
          <Form.Item name="taxNo" label="纳税人识别号">
            <Input placeholder="统一社会信用代码" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
        </Form>
      </Modal>
    </div>;
    const renderFavorite = (): VNodeChild => {
      const removeFollow = async (seller: FollowingSeller): Promise<void> => {
        const sellerId = String(seller.sellerId);
        setFollowingBusy(sellerId);
        try {
          const result = await unfollowSeller(sellerId);
          if (result.code !== 200) {
            message.error(result.message || '取消关注失败');
            return;
          }
          setFollowing(current => current.filter(item => String(item.sellerId) !== sellerId));
          message.success(`已取消关注 ${seller.sellerName}`);
        } catch {
          message.error('取消关注失败，请稍后重试');
        } finally {
          setFollowingBusy(null);
        }
      };
      const removeFavoriteProduct = async (product: FavoriteProduct): Promise<void> => {
        const key = `product-${product.productId}`;
        setFollowingBusy(key);
        try {
          const result = await unfavoriteProduct(product.productId);
          if (result.code !== 200) {
            message.error(result.message || '取消收藏失败');
            return;
          }
          setFavoriteProducts(current => current.filter(item => item.productId !== product.productId));
          message.success(`已取消收藏 ${product.productName}`);
        } catch {
          message.error('取消收藏失败，请稍后重试');
        } finally {
          setFollowingBusy(null);
        }
      };
      return <div class="buyer-workspace buyer-favorite-workspace">
        <section class="buyer-workspace-hero">
          <span class="buyer-workspace-icon"><HeartOutlined /></span>
          <div>
            <small>FOLLOWED SUPPLIERS</small>
            <h2>收藏与关注</h2>
            <p>查看已关注的供应商，快速进入店铺或继续在线洽谈。</p>
          </div>
          <div class="buyer-workspace-stats">
            <div><span>关注供应商</span><strong>{following.value.length}</strong></div>
            <div><span>收藏商品</span><strong>{favoriteProducts.value.length}</strong></div>
            <div><span>在售货源</span><strong>{following.value.reduce((sum, item) => sum + Number(item.productCount ?? 0), 0)}</strong></div>
            <div><span>覆盖品类</span><strong>{new Set(following.value.flatMap(item => (item.categories ?? '').split('、').filter(Boolean))).size}</strong></div>
          </div>
        </section>

        <div class="mc-toolbar">
          <span class="mc-toolbar-muted">关注关系按当前登录账号保存，取消后可重新关注。</span>
          <span class="mc-spacer" />
          <button type="button" class="mc-btn ghost" onClick={loadFollowing} disabled={followingLoading.value}>刷新</button>
          <a class="mc-btn" href="/hall">浏览供应商</a>
        </div>

        {followingLoading.value ? <div class="mc-loading">正在读取关注列表…</div> : following.value.length === 0 ? <Panel title="关注的供应商">
            <EmptyState title="还没有关注供应商" desc="在供应商店铺点击关注后，会在这里快速找到它。" action={<a class="mc-btn" href="/hall">去交易大厅</a>} />
          </Panel> : <div class="buyer-following-grid">
            {following.value.map(seller => {
            const sellerId = String(seller.sellerId);
            return <article class="buyer-following-card" key={sellerId}>
                  <div class="buyer-following-head">
                    <span>{seller.sellerName.slice(0, 1)}</span>
                    <div><strong>{seller.sellerName}</strong><small>{[seller.province, seller.city].filter(Boolean).join(' ') || '所在地待补充'}</small></div>
                    <em>已关注</em>
                  </div>
                  <div class="buyer-following-facts">
                    <div><span>在售货源</span><strong>{seller.productCount}<small>款</small></strong></div>
                    <div><span>起批价格</span><strong>{seller.minPrice == null ? '询价' : money(seller.minPrice)}</strong></div>
                    <div><span>主营品类</span><strong>{seller.categories || '待补充'}</strong></div>
                    <div><span>关注时间</span><strong>{shortDate(seller.followedAt)}</strong></div>
                  </div>
                  <div class="buyer-following-actions">
                    <a class="mc-btn ghost" href={`/shop/${sellerId}`}>进入店铺</a>
                    <button type="button" class="mc-btn" onClick={() => setChatTarget({
                  sellerId,
                  sellerName: seller.sellerName,
                  productId: null
                })}>
                      <CustomerServiceOutlined />洽谈
                    </button>
                    <button type="button" class="mc-link danger" disabled={followingBusy.value === sellerId} onClick={() => void removeFollow(seller)}>
                      {followingBusy.value === sellerId ? '处理中…' : '取消关注'}
                    </button>
                  </div>
                </article>;
          })}
          </div>}

        {!followingLoading.value && <Panel title={`收藏的商品（${favoriteProducts.value.length}）`} extra={<a class="mc-link" href="/hall">继续浏览货源</a>}>
            {favoriteProducts.value.length === 0 ? <EmptyState title="还没有收藏商品" desc="在商品详情点击“收藏商品”后会显示在这里。" action={<a class="mc-btn" href="/hall">去交易大厅</a>} /> : <TradeList listId="buyer-favorites" rowKey="productId" dataSource={favoriteProducts.value} onRefresh={loadFollowing} columns={[{
            title: "商品",
            key: 'col-1',
            width: 160,
            render: (_, product) => <><strong>{product.productName}</strong></>
          }, {
            title: "供应商",
            key: 'col-2',
            width: 160,
            render: (_, product) => <>{product.sellerName || '—'}</>
          }, {
            title: "品类",
            key: 'col-3',
            width: 160,
            render: (_, product) => <>{product.categoryName || '—'}</>
          }, {
            title: "当前价格",
            key: 'col-4',
            width: 160,
            render: (_, product) => <span class="mc-price">{product.price == null ? '询价' : `${money(product.price)}/${product.unit || '单位'}`}</span>
          }, {
            title: "状态",
            key: 'col-5',
            width: 108,
            render: (_, product) => <><span class={`mc-tag ${product.publishStatus === 'published' ? 'green' : 'ghost'}`}>
                          {product.publishStatus === 'published' ? '在售' : '已下架'}
                        </span></>
          }, {
            title: "收藏时间",
            key: 'col-6',
            width: 160,
            render: (_, product) => <span class="mc-mono mc-xs">{shortDate(product.favoritedAt)}</span>
          }, {
            title: "操作",
            key: 'action',
            width: 170,
            render: (_, product) => <><ListRowActions>
                            <a class="mc-link" href={`/product/detail/${product.productId}`}>查看</a>
                            {product.publishStatus === 'published' && <a class="mc-link" href={`/order/create?productId=${product.productId}`}>去下单</a>}
                            <button type="button" class="mc-link danger" disabled={followingBusy.value === `product-${product.productId}`} onClick={() => void removeFavoriteProduct(product)}>
                              {followingBusy.value === `product-${product.productId}` ? '处理中…' : '取消收藏'}
                            </button>
                          </ListRowActions></>
          }]} />}
          </Panel>}
      </div>;
    };
    const renderTabContent = (tab: string): VNodeChild => tab === 'agent' ? <TradeAgentPanel role="BUYER" /> : tab === 'publish' ? <DemandCreate embedded returnPath="/member/buyer?tab=demand-list" /> : tab === 'demand-list' ? renderDemandList() : tab === 'purchase' ? renderPurchase() : tab === 'inquiry' ? renderInquiry() : tab === 'chat' ? <div class="mc-embedded buyer-negotiation-inbox">
                  <ShopChat open embedded inbox inboxRole="buyer" sellerId="" sellerName={buyerMerchant.value?.merchantName ?? ''} onClose={() => setActive('overview')} />
                </div> : tab === 'after' ? renderAfter() : tab === 'rate' ? renderRate() : tab === 'contract' ? renderContract() : tab === 'fund' ? renderFund() : tab === 'favorite' ? renderFavorite() : renderOverview();
    return () => {
      const view_chatTarget = chatTarget.value;
      return <>
      <MemberCenterShell role="buyer" active={active.value === 'publish' ? 'demand-list' : active.value} tabKey={active.value} extraTabLabels={{
          publish: '发布采购需求'
        }} navItems={NAV} merchantName={buyerMerchant.value?.merchantName ?? ''} onNavigate={setActive} notice={<>
            {base.loading && <div class="mc-loading">正在加载会员数据…</div>}
            {base.error && <div class="mc-alert"><AlertOutlined />{base.error}</div>}
          </>} renderTab={renderTabContent} />
      <ShopChat open={Boolean(view_chatTarget)} sellerId={view_chatTarget?.sellerId ?? ''} sellerName={view_chatTarget?.sellerName ?? ''} productId={view_chatTarget?.productId} onClose={() => setChatTarget(null)} />
    </>;
    };
  }
});
export default BuyerCenter;
function renderOrdersTable(rows: OrderRow[], loading: boolean, error: string, actions: (order: OrderRow) => VNodeChild, options?: {
  onRefresh: () => void;
  filterSlot: VNodeChild;
  toolbarLeft: VNodeChild;
  pagination: TablePaginationConfig;
}): VNodeChild {
  return <TradeList listId={options ? 'buyer-orders' : 'buyer-recent-orders'} loading={loading} locale={{
    emptyText: <EmptyState title={error || '还没有采购订单'} />
  }} rowKey="id" dataSource={rows} onRefresh={options?.onRefresh} filterSlot={options?.filterSlot} toolbarLeft={options?.toolbarLeft} pagination={options?.pagination ?? false} showToolbar={Boolean(options)} selectable={Boolean(options)} columns={[{
    title: "订单号",
    key: 'col-1',
    width: 160,
    render: (_, order) => <span class="mc-mono">{order.orderNo}</span>
  }, {
    title: "商品",
    key: 'col-2',
    width: 160,
    render: (_, order) => <>{order.productName || order.categoryName || '—'}</>
  }, {
    title: "数量",
    key: 'col-3',
    width: 108,
    render: (_, order) => <span class="mc-mono">{order.totalQuantity ?? '—'}</span>
  }, {
    title: "金额",
    key: 'col-4',
    width: 160,
    render: (_, order) => <span class="mc-price">{money(order.totalAmount)}</span>
  }, {
    title: "供应方",
    key: 'col-5',
    width: 160,
    render: (_, order) => <>{order.sellerName ?? '—'}</>
  }, {
    title: "状态",
    key: 'col-6',
    width: 108,
    render: (_, order) => <><StatusTag status={order.orderStatus} side="buyer" /></>
  }, {
    title: "下单时间",
    key: 'col-7',
    width: 160,
    render: (_, order) => <span class="mc-mono mc-xs">{shortDate(order.createTime)}</span>
  }, {
    title: "操作",
    key: 'action',
    width: 170,
    render: (_, order) => <>{actions(order)}</>
  }]} />;
}
function demandStatusText(status: string | undefined): string {
  const map: Record<string, string> = {
    pending: '待匹配',
    matching: '匹配中',
    quoted: '报价中',
    completed: '已成交',
    closed: '已关闭'
  };
  return status ? map[status] ?? status : '—';
}
function invoiceStatusText(status: string): string {
  if (status === 'issued') return '已开票';
  if (status === 'rejected') return '已驳回';
  if (status === 'pending') return '待开票';
  return status;
}
