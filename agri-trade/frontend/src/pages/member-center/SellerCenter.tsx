import './seller-center.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import type { TablePaginationConfig } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { TradeList, TradeFilters } from '@/components/TradeList';
import TradeAgentPanel from './TradeAgentPanel';
import { useSearchParams } from "@/vue/router";
import { Modal, Select, message } from "@/vue/ui";
import { AlertOutlined, ApiOutlined, AppstoreOutlined, ArrowRightOutlined, BarChartOutlined, CheckCircleFilled, CloudServerOutlined, CustomerServiceOutlined, DollarOutlined, FileTextOutlined, HomeOutlined, AppstoreAddOutlined, RiseOutlined, SafetyCertificateOutlined, SendOutlined, ShopOutlined, StarOutlined, SwapOutlined, TeamOutlined, CarOutlined, WalletOutlined } from "@ant-design/icons-vue";
import SellerP2tPanel from './SellerP2tPanel';
import { shipOrder as shipOrderRequest } from '@/api/order';
import { updateSellerProductStatus } from '@/api/product';
import { getMySettlement, type SellerSettlementView } from '@/api/settlement';
import ContractList from '@/pages/contract/list';
import DisputeList from '@/pages/dispute/list';
import EvaluationList from '@/pages/evaluation/list';
import LogisticsList from '@/pages/logistics/list';
import MatchList from '@/pages/match/list';
import MyCompensation from '@/pages/mine-compensation';
import MyGuarantee from '@/pages/mine-guarantee';
import PriceList from '@/pages/price/list';
import QuoteList from '@/pages/quote/list';
import ProductCreate from '@/pages/product/create';
import { ShopChat } from '@/pages/shop/detail/ShopChat';
import { MemberCenterShell, type MemberNavItem } from './MemberCenterShell';
import { EmptyState, Panel, StatusTag, money, shortDate, useDisputes, useEvaluations, useGuarantees, useLogistics, useMemberBase, useOrders, useProducts, useReceivedInquiries, type OrderRow } from './shared';
const NAV: MemberNavItem[] = [{
  key: 'agent',
  label: '供货 Agent',
  icon: <FileTextOutlined />,
  group: '商品与撮合'
}, {
  key: 'overview',
  label: '首页概览',
  icon: <HomeOutlined />,
  group: '商品与撮合'
}, {
  key: 'goods',
  label: '商品管理',
  icon: <AppstoreOutlined />,
  group: '商品与撮合'
}, {
  key: 'p2t',
  label: '产销对接（承接）',
  icon: <SwapOutlined />,
  group: '商品与撮合'
}, {
  key: 'trade',
  label: '报价与撮合',
  icon: <StarOutlined />,
  group: '商品与撮合'
}, {
  key: 'chat',
  label: '洽谈消息',
  icon: <CustomerServiceOutlined />,
  group: '商品与撮合'
}, {
  key: 'sales',
  label: '销售订单',
  icon: <ShopOutlined />,
  group: '履约与售后'
}, {
  key: 'ship',
  label: '发货与物流',
  icon: <CarOutlined />,
  group: '履约与售后'
}, {
  key: 'after',
  label: '售后处理',
  icon: <AlertOutlined />,
  group: '履约与售后'
}, {
  key: 'rate',
  label: '店铺评价与信用',
  icon: <StarOutlined />,
  group: '履约与售后'
}, {
  key: 'contract',
  label: '合同管理',
  icon: <FileTextOutlined />,
  group: '账务与客户'
}, {
  key: 'fund',
  label: '资金结算',
  icon: <DollarOutlined />,
  group: '账务与客户'
}, {
  key: 'customer',
  label: '客户管理',
  icon: <TeamOutlined />,
  group: '账务与客户'
}, {
  key: 'iot',
  label: '生产接入',
  icon: <ApiOutlined />,
  group: '账务与客户'
}];
const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`;
const SELLER_STATUS = [{
  value: '',
  label: '全部'
}, {
  value: 'paid',
  label: '待发货'
}, {
  value: 'shipped',
  label: '运输中'
}, {
  value: 'received',
  label: '已收货'
}, {
  value: 'completed',
  label: '已完成'
}];
const SellerCenter = defineComponent({
  name: "SellerCenter",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const [params, setParams] = useSearchParams();
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
    // 卖家中心优先用 owner / seller 角色的主体展示商品与评价。
    const sellerMerchant = computed(() => base.merchants.find(item => item.roleInMerchant === 'owner' || item.roleInMerchant === 'seller') ?? base.primary);
    const sellerId = computed(() => sellerMerchant.value ? String(sellerMerchant.value.merchantId) : null);
    const allOrders = useOrders(() => 'seller', () => '', () => 1, () => 100);
    const status = shallowRef('');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const draftOrderStatus = shallowRef('');
    const setDraftOrderStatus = (next: typeof draftOrderStatus.value | ((previous: typeof draftOrderStatus.value) => typeof draftOrderStatus.value)) => {
      draftOrderStatus.value = typeof next === 'function' ? (next as (previous: typeof draftOrderStatus.value) => typeof draftOrderStatus.value)(draftOrderStatus.value) : next;
    };
    const page = shallowRef(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const pageSize = shallowRef(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const pagedOrders = useOrders(() => 'seller', () => status.value, () => page.value, () => pageSize.value);
    const products = useProducts(() => sellerId.value);
    const logistics = useLogistics();
    const disputes = useDisputes();
    const evaluations = useEvaluations(() => ({
      evaluateeId: sellerId.value ?? undefined
    }));
    const guarantees = useGuarantees();
    const inquiries = useReceivedInquiries();
    const goodsStatus = shallowRef('all');
    const setGoodsStatus = (next: typeof goodsStatus.value | ((previous: typeof goodsStatus.value) => typeof goodsStatus.value)) => {
      goodsStatus.value = typeof next === 'function' ? (next as (previous: typeof goodsStatus.value) => typeof goodsStatus.value)(goodsStatus.value) : next;
    };
    const draftGoodsStatus = shallowRef('all');
    const setDraftGoodsStatus = (next: typeof draftGoodsStatus.value | ((previous: typeof draftGoodsStatus.value) => typeof draftGoodsStatus.value)) => {
      draftGoodsStatus.value = typeof next === 'function' ? (next as (previous: typeof draftGoodsStatus.value) => typeof draftGoodsStatus.value)(draftGoodsStatus.value) : next;
    };
    const goodsPage = shallowRef(1);
    const setGoodsPage = (next: typeof goodsPage.value | ((previous: typeof goodsPage.value) => typeof goodsPage.value)) => {
      goodsPage.value = typeof next === 'function' ? (next as (previous: typeof goodsPage.value) => typeof goodsPage.value)(goodsPage.value) : next;
    };
    const tradeTab = shallowRef<'quote' | 'match' | 'price'>('quote');
    const setTradeTab = (next: typeof tradeTab.value | ((previous: typeof tradeTab.value) => typeof tradeTab.value)) => {
      tradeTab.value = typeof next === 'function' ? (next as (previous: typeof tradeTab.value) => typeof tradeTab.value)(tradeTab.value) : next;
    };
    const settlement = shallowRef<SellerSettlementView | null>(null);
    const setSettlement = (next: typeof settlement.value | ((previous: typeof settlement.value) => typeof settlement.value)) => {
      settlement.value = typeof next === 'function' ? (next as (previous: typeof settlement.value) => typeof settlement.value)(settlement.value) : next;
    };
    const loadSettlement = async () => {
      try {
        const body = await getMySettlement();
        if (body?.code === 200) setSettlement(body.data ?? null);else message.error(body?.message ?? '加载结算记录失败');
      } catch {
        message.error('加载结算记录失败');
      }
    };
    onMounted(() => {
      watch(() => [loadSettlement], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          void loadSettlement();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const sellerOrders = computed(() => allOrders.rows);
    const sellerOrderIds = computed(() => new Set(sellerOrders.value.map(item => item.id)));
    const myLogistics = computed(() => logistics.rows.filter(item => sellerOrderIds.value.has(Number(item.orderId))));
    const myDisputes = computed(() => disputes.rows.filter(item => base.merchantIds.includes(String(item.respondentId))));
    const openDisputes = computed(() => myDisputes.value.filter(item => !/closed|resolved|已解决/i.test(item.disputeStatus ?? '')));
    const avgRating = computed(() => evaluations.rows.length ? evaluations.rows.reduce((sum, item) => sum + Number(item.ratingOverall ?? 0), 0) / evaluations.rows.length : null);
    const productViews = computed(() => products.rows.reduce((sum, item) => sum + Number(item.viewCount ?? 0), 0));
    const guaranteeAvailable = computed(() => guarantees.value.reduce((sum, item) => sum + Number(item.availableAmount ?? 0), 0));
    const guaranteeFrozen = computed(() => guarantees.value.reduce((sum, item) => sum + Number(item.frozenAmount ?? 0), 0));
    const customers = computed(() => {
      const groups = new Map<number, {
        id: number;
        name: string;
        total: number;
        count: number;
        last: string;
      }>();
      sellerOrders.value.forEach(order => {
        const id = Number(order.buyerId);
        const current = groups.get(id) ?? {
          id,
          name: order.buyerName || `采购方 ${id}`,
          total: 0,
          count: 0,
          last: ''
        };
        current.total += Number(order.totalAmount ?? 0);
        current.count += 1;
        if (!current.last || order.createTime > current.last) current.last = order.createTime;
        groups.set(id, current);
      });
      return Array.from(groups.values()).sort((a, b) => b.total - a.total);
    });
    const filteredProducts = computed(() => products.rows.filter(item => {
      if (goodsStatus.value === 'all') return true;
      if (goodsStatus.value === 'soldout') return Number(item.stockQuantity ?? 0) <= 0;
      return item.publishStatus === goodsStatus.value;
    }));
    const toggleProductStatus = async (productId: number, currentStatus: number): Promise<void> => {
      try {
        const body = await updateSellerProductStatus(productId, currentStatus === 1 ? 0 : 1);
        if (body?.code === 200) {
          message.success(currentStatus === 1 ? '商品已下架' : '商品已上架');
          products.reload();
        } else {
          message.error(body?.message ?? '商品状态更新失败');
        }
      } catch {
        message.error('商品状态更新失败');
      }
    };
    const shipOrder = (order: OrderRow): void => {
      Modal.confirm({
        title: '确认发货？',
        content: `订单 ${order.orderNo} · ${order.productName || order.categoryName || '订单商品'}。发货后物流单会进入运输中状态。`,
        okText: '确认发货',
        cancelText: '取消',
        onOk: async () => {
          try {
            const body = await shipOrderRequest(order.id, {
              carrierName: '平台物流',
              carrierNo: order.orderNo,
              logisticsType: 'road'
            });
            if (body?.code === 200) {
              message.success('已发货');
              allOrders.reload();
              pagedOrders.reload();
            } else {
              message.error(body?.message ?? '发货失败');
            }
          } catch {
            message.error('发货失败（请检查后端是否在运行）');
          }
        }
      });
    };
    const orderActions = (order: OrderRow): VNodeChild => <ListRowActions>
      <a class="mc-link" href={`/order/detail/${order.id}`}>查看详情</a>
      {order.orderStatus === 'paid' && <button type="button" class="mc-link" onClick={() => shipOrder(order)}>发货</button>}
      <a class="mc-link" href="/logistics">物流</a>
    </ListRowActions>;
    const renderOverview = (): VNodeChild => <div class="seller-overview">
      <section class="seller-overview-hero">
        <span class="seller-overview-icon"><ShopOutlined /></span>
        <div class="seller-overview-title">
          <small>SELLER BUSINESS CENTER</small>
          <h2>店铺经营工作台</h2>
          <p>{sellerMerchant.value?.merchantName || '当前经营主体'} · 商品、报价、履约和结算进度集中管理</p>
        </div>
        <div class="seller-overview-figures">
          <div><span>累计成交额</span><strong>{money(base.dashboard?.seller?.totalRevenue ?? 0)}</strong></div>
          <div><span>今日成交额</span><strong>{money(base.dashboard?.seller?.todayRevenue ?? 0)}</strong></div>
          <div><span>在架货源</span><strong>{base.dashboard?.seller?.activeProducts ?? 0}<em>个</em></strong></div>
        </div>
        <div class="seller-overview-actions">
          <button type="button" class="mc-btn" onClick={() => setActive('publish')}>
            <AppstoreAddOutlined /> 发布商品
          </button>
          <button type="button" class="mc-btn ghost" onClick={() => setActive('trade')}>
            报价与撮合 <ArrowRightOutlined />
          </button>
        </div>
      </section>

      <section class="seller-task-grid">
        {[{
          label: '待发货',
          value: sellerOrders.value.filter(item => item.orderStatus === 'paid').length,
          tone: 'amber',
          icon: <CarOutlined />,
          desc: '付款订单等待履约',
          tab: 'ship'
        }, {
          label: '运输中',
          value: myLogistics.value.filter(item => !/delivered|cancelled|已签收/i.test(item.logisticsStatus ?? '')).length,
          tone: 'tech',
          icon: <SendOutlined />,
          desc: '在途物流持续跟踪',
          tab: 'ship'
        }, {
          label: '待处理售后',
          value: openDisputes.value.length,
          tone: 'red',
          icon: <CustomerServiceOutlined />,
          desc: '及时处理维护信用',
          tab: 'after'
        }, {
          label: '收到询价',
          value: inquiries.value.length,
          tone: 'green',
          icon: <FileTextOutlined />,
          desc: '采购需求等待报价',
          tab: 'trade'
        }].map(item => <button type="button" class={`seller-task ${item.tone}`} key={item.label} onClick={() => setActive(item.tab)}>
            <span class="seller-task-icon">{item.icon}</span>
            <span><small>{item.label}</small><strong>{item.value}<em>项</em></strong><i>{item.desc}</i></span>
            <ArrowRightOutlined />
          </button>)}
      </section>

      <div class="seller-overview-layout">
        <div class="seller-overview-main">
          <Panel title="最近销售订单" extra={<button type="button" class="mc-link" onClick={() => setActive('sales')}>查看全部订单 <ArrowRightOutlined /></button>}>
            {renderSellerOrders(sellerOrders.value.slice(0, 5), allOrders.loading, allOrders.error, orderActions)}
          </Panel>
          <Panel title="经营线索">
            <div class="seller-lead-grid">
              <div><span class="seller-lead-icon"><AppstoreOutlined /></span><div><small>商品货源</small><strong>{products.rows.length}</strong><em>总浏览 {productViews.value} 次</em></div></div>
              <div><span class="seller-lead-icon tech"><FileTextOutlined /></span><div><small>收到询价</small><strong>{inquiries.value.length}</strong><em>等待供应商响应</em></div></div>
              <div><span class="seller-lead-icon amber"><StarOutlined /></span><div><small>店铺评分</small><strong>{avgRating.value == null ? '—' : avgRating.value.toFixed(1)}</strong><em>{evaluations.rows.length} 条真实评价</em></div></div>
              <div><span class="seller-lead-icon green"><TeamOutlined /></span><div><small>成交客户</small><strong>{customers.value.length}</strong><em>来自真实销售订单</em></div></div>
            </div>
          </Panel>
        </div>
        <aside class="seller-overview-aside">
          <Panel title="店铺信用">
            <div class="seller-rating-card">
              <strong>{avgRating.value == null ? '—' : avgRating.value.toFixed(1)}</strong>
              <div><span>{avgRating.value == null ? '暂无评分' : '综合评分'}</span><em>{'★'.repeat(Math.round(avgRating.value ?? 0))}</em><small>{evaluations.rows.length} 条评价</small></div>
            </div>
            <div class="seller-rating-lines">
              <div><span>描述相符</span><strong>{avgMetric(evaluations.rows, 'ratingQuality')}</strong></div>
              <div><span>服务态度</span><strong>{avgMetric(evaluations.rows, 'ratingService')}</strong></div>
              <div><span>发货速度</span><strong>{avgMetric(evaluations.rows, 'ratingDelivery')}</strong></div>
            </div>
          </Panel>
          <Panel title="资金概况" extra={<button type="button" class="mc-link" onClick={() => setActive('fund')}>结算明细</button>}>
            <div class="seller-fund-lines">
              <div><span>待结算金额</span><strong>{money(settlement.value?.summary.pendingAmount ?? 0)}</strong></div>
              <div><span>已结算应收</span><strong>{money(settlement.value?.summary.settledReceivable ?? 0)}</strong></div>
              <div><span>可用保证金</span><strong>{money(guaranteeAvailable.value)}</strong></div>
            </div>
          </Panel>
          <Panel title="快捷入口">
            <div class="seller-quick-list">
              {[{
                icon: <AppstoreAddOutlined />,
                title: '发布新商品',
                tab: 'publish'
              }, {
                icon: <StarOutlined />,
                title: '报价与撮合',
                tab: 'trade'
              }, {
                icon: <StarOutlined />,
                title: '评价与信用',
                tab: 'rate'
              }, {
                icon: <TeamOutlined />,
                title: '客户管理',
                tab: 'customer'
              }, {
                icon: <ApiOutlined />,
                title: '生产接入',
                tab: 'iot'
              }].map(item => <button type="button" key={item.title} onClick={() => setActive(item.tab)}>
                  <span>{item.icon}</span><strong>{item.title}</strong><ArrowRightOutlined />
                </button>)}
            </div>
          </Panel>
        </aside>
      </div>
    </div>;
    const renderSales = (): VNodeChild => renderSellerOrders(pagedOrders.rows, pagedOrders.loading, pagedOrders.error, orderActions, {
      onRefresh: pagedOrders.reload,
      filterSlot: <TradeFilters fields={[{
        label: '订单状态',
        control: <Select value={draftOrderStatus.value} onChange={setDraftOrderStatus} options={SELLER_STATUS} />
      }]} onQuery={() => {
        setStatus(draftOrderStatus.value);
        setPage(1);
      }} onReset={() => {
        setDraftOrderStatus('');
        setStatus('');
        setPage(1);
      }} />,
      toolbarLeft: <button type="button" class="mc-btn" onClick={() => setActive('publish')}>发布新商品</button>,
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
    const renderTrade = (): VNodeChild => <div class="seller-workspace seller-trade-workspace">
      <section class="seller-workspace-hero">
        <span class="seller-workspace-icon"><StarOutlined /></span>
        <div><small>QUOTATION & MATCHING</small><h2>报价与撮合</h2><p>响应采购询价、查看智能匹配并按市场数据优化报价。</p></div>
        <div class="seller-workspace-stats">
          <div><span>收到询价</span><strong>{inquiries.value.length}</strong></div>
          <div><span>商品货源</span><strong>{products.rows.length}</strong></div>
          <div><span>店铺评分</span><strong>{avgRating.value == null ? '—' : avgRating.value.toFixed(1)}</strong></div>
        </div>
      </section>
      <div class="seller-switch-tabs">
        <button type="button" class={tradeTab.value === 'quote' ? 'on' : ''} onClick={() => setTradeTab('quote')}>
          <FileTextOutlined /><span><strong>报价管理</strong><small>询价响应与正式报价</small></span>
        </button>
        <button type="button" class={tradeTab.value === 'match' ? 'on' : ''} onClick={() => setTradeTab('match')}>
          <RiseOutlined /><span><strong>智能匹配</strong><small>需求与货源撮合评分</small></span>
        </button>
        <button type="button" class={tradeTab.value === 'price' ? 'on' : ''} onClick={() => setTradeTab('price')}>
          <BarChartOutlined /><span><strong>价格推荐</strong><small>市场价格与定价建议</small></span>
        </button>
      </div>
      <div class="seller-embedded-workbench">
        {tradeTab.value === 'quote' ? <QuoteList /> : tradeTab.value === 'match' ? <MatchList /> : <PriceList />}
      </div>
    </div>;
    const renderContract = (): VNodeChild => <div class="mc-embedded mc-embedded-first"><ContractList /></div>;
    const renderGoods = (): VNodeChild => <>
      <TradeList listId="seller-goods" rowKey="id" dataSource={filteredProducts.value} onRefresh={products.reload} loading={products.loading} pagination={{
        current: goodsPage.value,
        onChange: setGoodsPage
      }} filterSlot={<TradeFilters fields={[{
        label: '商品状态',
        control: <Select value={draftGoodsStatus.value} onChange={setDraftGoodsStatus} options={[{
          value: 'all',
          label: '全部'
        }, {
          value: 'published',
          label: '在售'
        }, {
          value: 'pending',
          label: '待审核'
        }, {
          value: 'draft',
          label: '草稿'
        }, {
          value: 'rejected',
          label: '已驳回'
        }, {
          value: 'soldout',
          label: '已售罄'
        }]} />
      }]} onQuery={() => {
        setGoodsStatus(draftGoodsStatus.value);
        setGoodsPage(1);
      }} onReset={() => {
        setDraftGoodsStatus('all');
        setGoodsStatus('all');
        setGoodsPage(1);
      }} />} toolbarLeft={<button type="button" class="mc-btn" onClick={() => setActive('publish')}>上架新商品</button>} locale={{
        emptyText: <EmptyState title={products.error || '没有符合条件的商品'} />
      }} columns={[{
        title: "图片",
        key: 'col-1',
        width: 108,
        render: (_, item) => <>{item.images?.[0] ? <img src={item.images[0]} alt={item.productName} style={{
            width: 42,
            height: 42,
            borderRadius: 7,
            objectFit: 'cover'
          }} /> : <span class="mc-tag ghost">无图</span>}</>
      }, {
        title: "商品",
        key: 'col-2',
        width: 160,
        render: (_, item) => <><strong>{item.productName}</strong><div class="mc-toolbar-muted">{item.productCode}</div></>
      }, {
        title: "品类",
        key: 'col-3',
        width: 160,
        render: (_, item) => <>{item.categoryName ?? '—'}</>
      }, {
        title: "SKU / 规格",
        key: 'col-4',
        width: 220,
        render: (_, item) => <><span class="mc-tag ghost">{item.skus?.length ?? 0} 个 SKU</span>
                      <div class="mc-toolbar-muted">
                        {(item.skus ?? []).slice(0, 2).map((sku: {skuName?:string;stockQuantity?:number}) => sku.skuName).join(' / ') || item.specSize || item.specLevel || '默认规格'}
                      </div></>
      }, {
        title: "价格",
        key: 'col-5',
        width: 160,
        render: (_, item) => <span class="mc-price">{skuPriceText(item)}<span class="mc-unit">/{item.unit}</span></span>
      }, {
        title: "库存",
        key: 'col-6',
        width: 160,
        render: (_, item) => <span class="mc-mono">{item.stockQuantity ?? '—'} {item.unit}</span>
      }, {
        title: "发布状态",
        key: 'col-7',
        width: 108,
        render: (_, item) => <><span class={`mc-tag ${item.publishStatus === 'published' ? 'green' : item.publishStatus === 'pending' ? 'amber' : 'ghost'}`}>{publishText(item.publishStatus)}</span></>
      }, {
        title: "启停",
        key: 'col-8',
        width: 108,
        render: (_, item) => <><span class={`mc-tag ${item.status === 1 ? 'green' : 'ghost'}`}>{item.status === 1 ? '启用' : '停用'}</span></>
      }, {
        title: "操作",
        key: 'action',
        width: 170,
        render: (_, item) => <><ListRowActions>
                        {item.publishStatus === 'published' && <a class="mc-link" href={`/product/detail/${item.id}`}>官网详情</a>}
                        <a class="mc-link" href={`/product/edit/${item.id}${sellerId.value ? `?sellerId=${encodeURIComponent(sellerId.value)}` : ''}`}>
                          编辑
                        </a>
                        <button type="button" class="mc-link" onClick={() => void toggleProductStatus(item.id, item.status)}>
                          {item.status === 1 ? '下架' : '上架'}
                        </button>
                      </ListRowActions></>
      }]} />
    </>;
    const renderSupply = (): VNodeChild => <>
      <div class="mc-toolbar">
        <span class="mc-toolbar-muted">我发布的供应信息 · 浏览与询单情况</span>
        <span class="mc-spacer" />
        <button type="button" class="mc-btn" onClick={() => setActive('publish')}>发布新商品</button>
      </div>
      <Panel title="供应信息">
        {products.rows.length === 0 ? <EmptyState title="还没有发布供应" desc="发布货源后会在这里看到浏览与询单数据。" action={<button type="button" class="mc-btn" onClick={() => setActive('publish')}>发布新商品</button>} /> : <TradeList listId="seller-supply" rowKey="id" dataSource={products.rows} onRefresh={products.reload} columns={[{
          title: "商品",
          key: 'col-1',
          width: 160,
          render: (_, item) => <>{item.productName}</>
        }, {
          title: "品类",
          key: 'col-2',
          width: 160,
          render: (_, item) => <>{item.categoryName ?? '—'}</>
        }, {
          title: "可供量",
          key: 'col-3',
          width: 160,
          render: (_, item) => <span class="mc-mono">{item.stockQuantity ?? '—'} {item.unit}</span>
        }, {
          title: "报价",
          key: 'col-4',
          width: 160,
          render: (_, item) => <span class="mc-mono">{money(item.price)}/{item.unit}</span>
        }, {
          title: "浏览 / 询单",
          key: 'col-5',
          width: 160,
          render: (_, item) => <span class="mc-mono">{item.viewCount ?? 0} / {item.inquiryCount ?? 0}</span>
        }, {
          title: "状态",
          key: 'col-6',
          width: 108,
          render: (_, item) => <><span class={`mc-tag ${item.publishStatus === 'published' ? 'tech' : 'ghost'}`}>{publishText(item.publishStatus)}</span></>
        }, {
          title: "操作",
          key: 'action',
          width: 170,
          render: (_, item) => <><ListRowActions>
                        <button type="button" class="mc-link" onClick={() => {
                const next = new URLSearchParams(params.value);
                next.set('tab', 'publish');
                next.set('id', String(item.id));
                if (sellerId.value) next.set('sellerId', sellerId.value);
                setParams(next, {
                  replace: true
                });
              }}>编辑</button>
                        {item.publishStatus === 'published' && <a class="mc-link" href={`/product/detail/${item.id}`}>官网详情</a>}
                      </ListRowActions></>
        }]} />}
      </Panel>
    </>;
    const renderShip = (): VNodeChild => <>
      <Panel title="待发货订单" extra={<span class="mc-toolbar-muted">付款后请及时安排发货</span>}>
        {sellerOrders.value.filter(item => item.orderStatus === 'paid').length === 0 ? <EmptyState title="没有待发货订单" desc="订单付款后会进入待发货，完成发货后可在下方物流管理中跟踪。" /> : <TradeList listId="seller-ship" rowKey="id" dataSource={sellerOrders.value.filter(item => item.orderStatus === 'paid')} onRefresh={allOrders.reload} columns={[{
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
          title: "采购方",
          key: 'col-3',
          width: 160,
          render: (_, order) => <>{order.buyerName}</>
        }, {
          title: "订单金额",
          key: 'col-4',
          width: 160,
          render: (_, order) => <span class="mc-price">{money(order.totalAmount)}</span>
        }, {
          title: "状态",
          key: 'col-5',
          width: 108,
          render: () => <span class="mc-tag amber">待发货</span>
        }, {
          title: "操作",
          key: 'action',
          width: 170,
          render: (_, order) => <><button type="button" class="mc-link" onClick={() => shipOrder(order)}>去发货</button></>
        }]} />}
      </Panel>
      <LogisticsList />
    </>;
    const renderAfter = (): VNodeChild => <DisputeList />;
    const renderRate = (): VNodeChild => <div class="seller-workspace seller-rating-workspace">
      <section class="seller-workspace-hero seller-rating-hero">
        <span class="seller-workspace-icon"><StarOutlined /></span>
        <div><small>STORE REPUTATION</small><h2>店铺评价与信用</h2><p>基于真实成交评价展示店铺服务水平，可回复评价或发起申诉。</p></div>
        <div class="seller-rating-score">
          <strong>{avgRating.value == null ? '—' : avgRating.value.toFixed(1)}</strong>
          <div><span>{avgRating.value == null ? '暂无评分' : '综合评分'}</span><em>{'★'.repeat(Math.round(avgRating.value ?? 0))}</em><small>{evaluations.rows.length} 条评价</small></div>
        </div>
      </section>
      <div class="seller-rating-metrics">
        <div><span>描述相符</span><strong>{avgMetric(evaluations.rows, 'ratingQuality')}</strong><em>商品与描述一致性</em></div>
        <div><span>服务态度</span><strong>{avgMetric(evaluations.rows, 'ratingService')}</strong><em>沟通与售后响应</em></div>
        <div><span>发货速度</span><strong>{avgMetric(evaluations.rows, 'ratingDelivery')}</strong><em>订单履约及时性</em></div>
        <div><span>评价总数</span><strong>{evaluations.rows.length}</strong><em>全部来自真实订单</em></div>
      </div>
      <Panel title="最新买家评价" extra={<span class="seller-section-note">展示最近公开评价</span>}>
        {evaluations.rows.length === 0 ? <EmptyState title="还没有店铺评价" desc="订单完成后采购方可以评价，评价会展示在这里。" /> : <div class="seller-review-grid">
            {evaluations.rows.slice(0, 6).map(row => <div class="seller-review-card" key={row.id}>
                <div class="seller-review-head">
                  <span class="seller-review-avatar">{row.evaluatorName?.slice(0, 1) || '客'}</span>
                  <div><strong>{row.evaluatorName || '采购方'}</strong><small>订单 {row.orderId} · {shortDate(row.createTime)}</small></div>
                  <em>{'★'.repeat(Math.round(row.ratingOverall))}</em>
                </div>
                <p>{row.evaluationContent || '未填写文字评价'}</p>
                {row.replyContent && <div class="seller-review-reply">商家回复：{row.replyContent}</div>}
                <div class="seller-review-tags"><span>{row.ratingOverall} 分</span><span>{row.isAnonymous === 1 ? '匿名评价' : '实名评价'}</span></div>
              </div>)}
          </div>}
      </Panel>
      <Panel className="seller-credit-panel" title="评价管理与申诉" extra={<span class="mc-tag amber">信用分接口待接入</span>}>
        <div class="seller-credit-note">
          当前交易域只提供真实评价均分，没有独立信用分字段；不展示虚构的信用分或等级。
        </div>
        <div class="seller-embedded-workbench">
          <EvaluationList />
        </div>
      </Panel>
    </div>;
    const renderFund = (): VNodeChild => <div class="seller-workspace seller-fund-workspace">
      <section class="seller-workspace-hero">
        <span class="seller-workspace-icon"><WalletOutlined /></span>
        <div><small>SETTLEMENT & FINANCE</small><h2>资金结算</h2><p>查看订单应收、平台服务费、保证金、赔付与结算进度。</p></div>
        <div class="seller-workspace-stats">
          <div><span>待结算</span><strong>{money(settlement.value?.summary.pendingAmount ?? 0)}</strong></div>
          <div><span>已结算应收</span><strong>{money(settlement.value?.summary.settledReceivable ?? 0)}</strong></div>
          <div><span>可用保证金</span><strong>{money(guaranteeAvailable.value)}</strong></div>
        </div>
      </section>
      <div class="seller-finance-metrics">
        <div><span>待结算订单</span><strong>{settlement.value?.summary.pendingCount ?? 0}<em>笔</em></strong><small>预估应收 {money(settlement.value?.summary.pendingReceivable ?? 0)}</small></div>
        <div><span>已结算订单</span><strong>{settlement.value?.summary.settledCount ?? 0}<em>笔</em></strong><small>累计应收 {money(settlement.value?.summary.settledReceivable ?? 0)}</small></div>
        <div><span>平台服务费</span><strong>{money(settlement.value?.summary.settledFee ?? 0)}</strong><small>已结算订单累计</small></div>
        <div><span>冻结保证金</span><strong>{money(guaranteeFrozen.value)}</strong><small>在途订单与纠纷占用</small></div>
      </div>
      <div class="seller-finance-history">
      <Panel title="待结算订单" extra={<span class="mc-toolbar-muted">确认收货且已付款，尚未生成结算单</span>}>
        {!settlement.value || settlement.value.pending.length === 0 ? <EmptyState title="没有待结算订单" desc="订单确认收货并完成付款后，会进入待结算。" /> : <TradeList listId="seller-pending-settlement" rowKey="orderId" dataSource={settlement.value.pending} onRefresh={loadSettlement} columns={[{
            title: "订单号",
            key: 'col-1',
            width: 160,
            render: (_, row) => <span class="mc-mono">{row.orderNo}</span>
          }, {
            title: "采购方",
            key: 'col-2',
            width: 160,
            render: (_, row) => <>{row.buyerName ?? '—'}</>
          }, {
            title: "订单金额",
            key: 'col-3',
            width: 160,
            render: (_, row) => <span class="mc-price">{money(row.totalAmount)}</span>
          }, {
            title: "平台服务费",
            key: 'col-4',
            width: 160,
            render: (_, row) => <>{money(row.platformFee)} <span class="mc-xs">({(Number(row.platformFeeRate) * 100).toFixed(2)}%)</span></>
          }, {
            title: "卖家应收",
            key: 'col-5',
            width: 160,
            render: (_, row) => <span class="mc-price">{money(row.sellerReceivable)}</span>
          }, {
            title: "状态",
            key: 'col-6',
            width: 108,
            render: () => <span class="mc-tag amber">待结算</span>
          }]} />}
      </Panel>
      <Panel title="已结算记录" extra={<span class="mc-toolbar-muted">按平台结算单展示</span>}>
        {!settlement.value || settlement.value.settled.length === 0 ? <EmptyState title="还没有已结算记录" desc="运营端完成结算后，分账金额与平台服务费会在这里展示。" /> : <TradeList listId="seller-settled" rowKey="id" dataSource={settlement.value.settled} onRefresh={loadSettlement} columns={[{
            title: "结算单号",
            key: 'col-1',
            width: 160,
            render: (_, row) => <span class="mc-mono">{row.settlementNo}</span>
          }, {
            title: "订单号",
            key: 'col-2',
            width: 160,
            render: (_, row) => <span class="mc-mono">{row.orderNo}</span>
          }, {
            title: "采购方",
            key: 'col-3',
            width: 160,
            render: (_, row) => <>{row.buyerName ?? '—'}</>
          }, {
            title: "订单金额",
            key: 'col-4',
            width: 160,
            render: (_, row) => <span class="mc-price">{money(row.totalAmount)}</span>
          }, {
            title: "平台服务费",
            key: 'col-5',
            width: 160,
            render: (_, row) => <>{money(row.platformFee)}</>
          }, {
            title: "卖家应收",
            key: 'col-6',
            width: 160,
            render: (_, row) => <span class="mc-price">{money(row.sellerReceivable)}</span>
          }, {
            title: "结算时间",
            key: 'col-7',
            width: 160,
            render: (_, row) => <span class="mc-mono mc-xs">{shortDate(row.settleTime)}</span>
          }]} />}
      </Panel>
      </div>
      <div class="seller-finance-support">
        <div><MyGuarantee /></div>
        <div><MyCompensation /></div>
      </div>
      <Panel title="提现申请">
        <EmptyState title="提现申请尚未开放" desc="当前只提供结算单与应收金额查询；提现涉及打款，需接入资金通道与审批流后再开放。" />
      </Panel>
    </div>;
    const renderCustomer = (): VNodeChild => <div class="seller-workspace seller-customer-workspace">
      <section class="seller-workspace-hero">
        <span class="seller-workspace-icon"><TeamOutlined /></span>
        <div><small>CUSTOMER RELATIONSHIP</small><h2>客户管理</h2><p>采购商档案由真实销售订单聚合，展示成交规模与最近采购。</p></div>
        <div class="seller-workspace-stats">
          <div><span>成交客户</span><strong>{customers.value.length}</strong></div>
          <div><span>客户订单</span><strong>{customers.value.reduce((sum, item) => sum + item.count, 0)}</strong></div>
          <div><span>累计成交</span><strong>{money(customers.value.reduce((sum, item) => sum + item.total, 0))}</strong></div>
        </div>
      </section>
      <div class="seller-customer-toolbar">
        <div><strong>客户档案</strong><span>按累计采购额排序</span></div>
        <a class="mc-btn ghost" href="/member/seller?tab=ship">查看待发货订单 <ArrowRightOutlined /></a>
      </div>
      {customers.value.length === 0 ? <Panel><EmptyState title="还没有成交客户" desc="产生销售订单后，采购商会自动汇总到这里。" /></Panel> : <div class="seller-customer-grid">
          {customers.value.map((row, index) => <div class={`seller-customer-card${row.total >= 2000000 ? ' vip' : ''}`} key={row.id}>
              <div class="seller-customer-head">
                <span class="seller-customer-avatar">{row.name?.slice(0, 1) || '客'}</span>
                <div><small>采购主体 #{index + 1}</small><strong>{row.name}</strong></div>
                <span class={`mc-tag ${row.total >= 2000000 ? 'tech' : 'ghost'}`}>
                  {row.total >= 2000000 ? '重点客户' : '普通客户'}
                </span>
              </div>
              <div class="seller-customer-figures">
                <div><span>累计采购额</span><strong>{money(row.total)}</strong></div>
                <div><span>订单数量</span><strong>{row.count}<em>笔</em></strong></div>
              </div>
              <div class="seller-customer-foot">
                <span>最近下单</span><strong>{shortDate(row.last)}</strong>
              </div>
            </div>)}
        </div>}
    </div>;
    const renderIot = (): VNodeChild => <div class="seller-workspace seller-iot-workspace">
      <section class="seller-iot-hero">
        <span class="seller-workspace-icon"><CloudServerOutlined /></span>
        <div><small>PRODUCTION INTEGRATION</small><h2>生产接入</h2><p>将生产管理中的地块、设备和环境数据与交易货源关联，形成可追溯供应能力。</p></div>
        <a class="mc-btn" href="/production/dashboard">前往生产管理 <ArrowRightOutlined /></a>
      </section>
      <div class="seller-iot-steps">
        {[{
          num: '01',
          title: '设备登记',
          desc: '在生产管理登记设备型号、通信协议和接入参数。',
          icon: <ApiOutlined />
        }, {
          num: '02',
          title: '地块绑定',
          desc: '把设备与生产基地、地块绑定，建立采集点位。',
          icon: <AppstoreOutlined />
        }, {
          num: '03',
          title: '数据上云',
          desc: '环境与生产数据持续沉淀，为溯源和商品资料背书。',
          icon: <CloudServerOutlined />
        }].map(item => <div class="seller-iot-step" key={item.num}>
            <span>{item.num}</span>
            <i>{item.icon}</i>
            <strong>{item.title}</strong>
            <p>{item.desc}</p>
          </div>)}
      </div>
      <div class="seller-iot-layout">
        <Panel title="接入说明">
          <div class="seller-iot-note">
            <p><SafetyCertificateOutlined /> 生产域独立部署在生产管理子系统，交易域只展示有真实来源的数据。</p>
            <p><CheckCircleFilled /> 完成地块与设备绑定后，可在商品资料中关联采收批次与溯源信息。</p>
            <p><RiseOutlined /> 实时监测数据可以提升商品详情可信度，并支撑供应能力展示。</p>
          </div>
        </Panel>
        <aside class="seller-iot-action">
          <CloudServerOutlined />
          <strong>进入生产管理工作台</strong>
          <span>管理生产基地、地块、设备和环境监测</span>
          <a class="mc-btn" href="/production/dashboard">立即前往</a>
        </aside>
      </div>
    </div>;
    const renderTabContent = (tab: string): VNodeChild => tab === 'agent' ? <TradeAgentPanel role="SELLER" /> : tab === 'publish' ? <ProductCreate embedded /> : tab === 'sales' ? renderSales() : tab === 'goods' ? renderGoods() : tab === 'supply' ? renderSupply() : tab === 'trade' ? renderTrade() : tab === 'chat' ? <div class="mc-embedded seller-negotiation-inbox">
                    <ShopChat open embedded inbox inboxRole="seller" sellerId={sellerId.value ?? ''} sellerName={sellerMerchant.value?.merchantName ?? ''} onClose={() => setActive('overview')} />
                  </div> : tab === 'ship' ? renderShip() : tab === 'after' ? renderAfter() : tab === 'rate' ? renderRate() : tab === 'contract' ? renderContract() : tab === 'fund' ? renderFund() : tab === 'customer' ? renderCustomer() : tab === 'iot' ? renderIot() : tab === 'p2t' ? <SellerP2tPanel merchants={base.merchants} preferredMerchantId={sellerId.value} /> : renderOverview();
    return () => {
      return <MemberCenterShell role="seller" active={active.value === 'publish' || active.value === 'supply' ? 'goods' : active.value} tabKey={active.value} extraTabLabels={{
        publish: '发布商品',
        supply: '供应信息'
      }} navItems={NAV} merchantName={sellerMerchant.value?.merchantName ?? ''} onNavigate={setActive} notice={<>
          {base.loading && <div class="mc-loading">正在加载会员数据…</div>}
          {base.error && <div class="mc-alert"><AlertOutlined />{base.error}</div>}
        </>} renderTab={renderTabContent} />;
    };
  }
});
export default SellerCenter;
function renderSellerOrders(rows: OrderRow[], loading: boolean, error: string, actions: (order: OrderRow) => VNodeChild, options?: {
  onRefresh: () => void;
  filterSlot: VNodeChild;
  toolbarLeft: VNodeChild;
  pagination: TablePaginationConfig;
}): VNodeChild {
  return <TradeList listId={options ? 'seller-orders' : 'seller-recent-orders'} loading={loading} locale={{
    emptyText: <EmptyState title={error || '还没有销售订单'} />
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
    title: "采购方",
    key: 'col-5',
    width: 160,
    render: (_, order) => <>{order.buyerName ?? '—'}</>
  }, {
    title: "状态",
    key: 'col-6',
    width: 108,
    render: (_, order) => <><StatusTag status={order.orderStatus} side="seller" /></>
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
function publishText(status: string | undefined): string {
  const map: Record<string, string> = {
    published: '在售',
    pending: '待审核',
    soldout: '已售罄',
    offline: '已下架',
    rejected: '已驳回'
  };
  return status ? map[status] ?? status : '—';
}
function skuPriceText(product: {
  price: number | null;
  skus?: Array<{
    price: number;
    status: number;
  }>;
}): string {
  const prices = (product.skus ?? []).filter(item => item.status === 1 && Number(item.price) > 0).map(item => Number(item.price));
  if (prices.length === 0) return money(product.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? money(min) : `${money(min)} 起`;
}
function avgMetric(rows: {
  ratingQuality: number;
  ratingService: number;
  ratingDelivery: number;
}[], key: 'ratingQuality' | 'ratingService' | 'ratingDelivery'): string {
  if (!rows.length) return '—';
  return (rows.reduce((sum, item) => sum + Number(item[key] ?? 0), 0) / rows.length).toFixed(1);
}
