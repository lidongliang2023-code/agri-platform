import './demand-detail.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { useNavigate, useParams } from "@/vue/router";
import { Empty, message, Spin } from "@/vue/ui";
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, EnvironmentOutlined, FileSearchOutlined, FileTextOutlined, SafetyCertificateOutlined, SearchOutlined, ShopOutlined, ThunderboltOutlined } from "@ant-design/icons-vue";
import { BrandMark } from '@/components/BrandMark';
import { getMyMerchants } from '@/api/identity';
import { deleteDemand, getDemandById, getDemandMatches, matchDemand } from '@/api/demand';
import { createInquiry, getInquiryQuotes, getMyInquiries, type InquiryVO } from '@/api/inquiry';
import { acceptQuote, convertQuoteToOrder, type QuoteVO } from '@/api/quote';
import { ShopChat } from '../../shop/detail/ShopChat';
import { EmptyState, Panel, money, shortDate } from '../../member-center/shared';
interface Demand {
  id: number;
  demandNo: string;
  demandName: string;
  buyerId: number | string;
  buyerName: string;
  buyerType: string;
  categoryId: number;
  categoryName: string;
  variety: string;
  productName: string;
  quantity: number;
  unit: string;
  priceMin: number;
  priceMax: number;
  deliveryProvince: string;
  deliveryCity: string;
  deliveryAddress: string;
  deliveryDeadline: string;
  qualityRequirement: string;
  certificationRequire: string;
  packagingRequire: string;
  sampleRequire: number;
  demandType: string;
  demandStatus: string;
  responseCount: number;
  createTime: string;
}
interface MatchRow {
  id: number;
  matchNo: string;
  productId: number;
  sellerId: number | string;
  matchScore: number;
  matchType: string;
  matchReason: string;
  orderId: number;
  orderStatus: string;
  createTime: string;
}
const DEMAND_STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  pending: {
    text: '待匹配',
    tone: 'amber'
  },
  matching: {
    text: '匹配中',
    tone: 'tech'
  },
  quoted: {
    text: '报价中',
    tone: 'tech'
  },
  completed: {
    text: '已成交',
    tone: 'green'
  },
  closed: {
    text: '已关闭',
    tone: 'ghost'
  }
};
const INQUIRY_STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  pending_reply: {
    text: '待报价',
    tone: 'amber'
  },
  quoted: {
    text: '已报价',
    tone: 'tech'
  },
  converted: {
    text: '已成交',
    tone: 'green'
  },
  closed: {
    text: '已关闭',
    tone: 'ghost'
  }
};
const QUOTE_STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  pending: {
    text: '待受理',
    tone: 'amber'
  },
  accepted: {
    text: '已受理',
    tone: 'green'
  },
  rejected: {
    text: '已拒绝',
    tone: 'red'
  },
  expired: {
    text: '已过期',
    tone: 'ghost'
  }
};

/** 采购需求与询价详情工作台。 */
const DemandDetail = defineComponent({
  name: "DemandDetail",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _routeParams = useParams();
    const navigate = useNavigate();
    const demand = shallowRef<Demand | null>(null);
    const setDemand = (next: typeof demand.value | ((previous: typeof demand.value) => typeof demand.value)) => {
      demand.value = typeof next === 'function' ? (next as (previous: typeof demand.value) => typeof demand.value)(demand.value) : next;
    };
    const matches = shallowRef<MatchRow[]>([]);
    const setMatches = (next: typeof matches.value | ((previous: typeof matches.value) => typeof matches.value)) => {
      matches.value = typeof next === 'function' ? (next as (previous: typeof matches.value) => typeof matches.value)(matches.value) : next;
    };
    const inquiries = shallowRef<InquiryVO[]>([]);
    const setInquiries = (next: typeof inquiries.value | ((previous: typeof inquiries.value) => typeof inquiries.value)) => {
      inquiries.value = typeof next === 'function' ? (next as (previous: typeof inquiries.value) => typeof inquiries.value)(inquiries.value) : next;
    };
    const quotesByInquiry = shallowRef<Record<string, QuoteVO[]>>({});
    const setQuotesByInquiry = (next: typeof quotesByInquiry.value | ((previous: typeof quotesByInquiry.value) => typeof quotesByInquiry.value)) => {
      quotesByInquiry.value = typeof next === 'function' ? (next as (previous: typeof quotesByInquiry.value) => typeof quotesByInquiry.value)(quotesByInquiry.value) : next;
    };
    const loading = shallowRef(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const matching = shallowRef(false);
    const setMatching = (next: typeof matching.value | ((previous: typeof matching.value) => typeof matching.value)) => {
      matching.value = typeof next === 'function' ? (next as (previous: typeof matching.value) => typeof matching.value)(matching.value) : next;
    };
    const inquiryBusy = shallowRef<number | null>(null);
    const setInquiryBusy = (next: typeof inquiryBusy.value | ((previous: typeof inquiryBusy.value) => typeof inquiryBusy.value)) => {
      inquiryBusy.value = typeof next === 'function' ? (next as (previous: typeof inquiryBusy.value) => typeof inquiryBusy.value)(inquiryBusy.value) : next;
    };
    const quoteBusy = shallowRef<number | null>(null);
    // 这张需求是不是"我名下主体"发的：改内容、下架、触发撮合都是主人的动作。
    // 后端会拒（denyUnlessOwner），但把按钮留着点一下才报错，等于给访客设陷阱。
    const setQuoteBusy = (next: typeof quoteBusy.value | ((previous: typeof quoteBusy.value) => typeof quoteBusy.value)) => {
      quoteBusy.value = typeof next === 'function' ? (next as (previous: typeof quoteBusy.value) => typeof quoteBusy.value)(quoteBusy.value) : next;
    };
    const myMerchantIds = shallowRef<string[]>([]);
    const setMyMerchantIds = (next: typeof myMerchantIds.value | ((previous: typeof myMerchantIds.value) => typeof myMerchantIds.value)) => {
      myMerchantIds.value = typeof next === 'function' ? (next as (previous: typeof myMerchantIds.value) => typeof myMerchantIds.value)(myMerchantIds.value) : next;
    };
    const chatTarget = shallowRef<{
      sellerId: string;
      sellerName: string;
      productId: number | null;
    } | null>(null);
    const setChatTarget = (next: typeof chatTarget.value | ((previous: typeof chatTarget.value) => typeof chatTarget.value)) => {
      chatTarget.value = typeof next === 'function' ? (next as (previous: typeof chatTarget.value) => typeof chatTarget.value)(chatTarget.value) : next;
    };
    const loadMatches = () => {
      if (!_routeParams.id) return;
      getDemandMatches(_routeParams.id).then((response: {
        code: number;
        data?: MatchRow[];
      }) => {
        if (response?.code === 200) setMatches(response.data ?? []);
      }).catch(() => setMatches([]));
    };
    const loadInquiries = async (): Promise<void> => {
      if (!_routeParams.id) return;
      try {
        const response = (await getMyInquiries()) as {
          code: number;
          data?: InquiryVO[];
        };
        if (response?.code !== 200) return;
        const mine = (response.data ?? []).filter(item => String(item.demandId) === String(_routeParams.id));
        setInquiries(mine);
        const entries = await Promise.all(mine.map(async inquiry => {
          const quoteResponse = await getInquiryQuotes(inquiry.id);
          return [String(inquiry.id), quoteResponse?.code === 200 ? quoteResponse.data ?? [] : []] as const;
        }));
        setQuotesByInquiry(Object.fromEntries(entries));
      } catch {
        setInquiries([]);
        setQuotesByInquiry({});
      }
    };
    onMounted(() => {
      watch(() => [_routeParams.id, loadMatches, loadInquiries], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!_routeParams.id) return;
          let cancelled = false;
          setLoading(true);
          getDemandById(Number(_routeParams.id)).then((response: {
            code: number;
            data?: Demand;
            message?: string;
          }) => {
            if (cancelled) return;
            if (response?.code === 200) setDemand(response.data ?? null);else message.error(response?.message ?? '需求不存在');
          }).catch(() => message.error('加载需求失败（请检查后端是否在运行）')).finally(() => {
            if (!cancelled) setLoading(false);
          });
          loadMatches();
          void loadInquiries();
          return () => {
            cancelled = true;
          };
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          getMyMerchants().then(response => {
            setMyMerchantIds((response.data ?? []).map(item => String(item.merchantId)));
          }).catch(() => setMyMerchantIds([]));
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    const isOwner = computed(() => Boolean(demand.value && myMerchantIds.value.includes(String(demand.value.buyerId))));
    const handleMatch = async (): Promise<void> => {
      if (!_routeParams.id) return;
      setMatching(true);
      try {
        const response = await matchDemand(Number(_routeParams.id));
        if (response?.code === 200) {
          message.success('智能撮合完成');
          loadMatches();
        } else {
          message.error(response?.message ?? '触发撮合失败');
        }
      } finally {
        setMatching(false);
      }
    };
    const handleInquiry = async (productId: number): Promise<void> => {
      if (!_routeParams.id) return;
      setInquiryBusy(productId);
      try {
        const response = await createInquiry(Number(_routeParams.id), productId);
        if (response?.code === 200) {
          message.success('已发起询价，等待供应商报价');
          await loadInquiries();
        } else {
          message.error(response?.message ?? '发起询价失败');
        }
      } catch {
        message.error('发起询价失败（请检查后端是否在运行）');
      } finally {
        setInquiryBusy(null);
      }
    };
    const handleAcceptQuote = async (quote: QuoteVO): Promise<void> => {
      setQuoteBusy(quote.id);
      try {
        const accepted = await acceptQuote(quote.id);
        if (accepted?.code !== 200) {
          message.error(accepted?.message ?? '接受报价失败');
          return;
        }
        const converted = await convertQuoteToOrder(quote.id);
        if (converted?.code === 200 && converted.data?.id) {
          message.success('已接受报价并生成采购订单');
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
    const handleDelete = async (): Promise<void> => {
      if (!_routeParams.id || !window.confirm('确认下架这条采购需求？')) return;
      const response = await deleteDemand(Number(_routeParams.id));
      if (response?.code === 200) {
        message.success('采购需求已下架');
        navigate('/member/buyer?tab=demand-list');
      } else {
        message.error(response?.message ?? '下架失败');
      }
    };
    const allQuotes = computed(() => Object.values(quotesByInquiry.value).flat());
    const pendingQuotes = computed(() => allQuotes.value.filter(quote => quote.quoteStatus === 'pending'));
    const demandMeta = computed(() => statusMeta(demand.value?.demandStatus ?? 'pending'));
    return () => {
      const view_chatTarget = chatTarget.value;
      const view_quoteBusy = quoteBusy.value;
      const view_inquiryBusy = inquiryBusy.value;
      const view_demand = demand.value;
      if (loading.value) {
        return <div class="demand-detail-page demand-detail-center"><Spin size="large" /><span>正在读取询价详情…</span></div>;
      }
      if (!view_demand) {
        return <div class="demand-detail-page demand-detail-center">
        <Empty description="没有找到这条采购需求" />
        <button type="button" class="mc-btn" onClick={() => navigate('/member/buyer?tab=demand-list')}>
          返回采购需求
        </button>
      </div>;
      }
      return <div class="demand-detail-page">
      <header class="demand-detail-topbar">
        <a class="demand-detail-brand" href="/">
          <span><BrandMark size={32} /></span>
          <strong>丰链云<small>FENGCHAIN · AGRI</small></strong>
        </a>
        <nav>
          <a href="/member/buyer">买家中心</a><span>/</span>
          <a href="/member/buyer?tab=demand-list">采购需求</a><span>/</span>
          <strong>需求详情</strong>
        </nav>
        <a class="demand-detail-back" href="/member/buyer?tab=demand-list"><ArrowLeftOutlined /> 返回采购需求</a>
      </header>

      <main class="demand-detail-main">
        <section class="demand-detail-hero">
          <span class="demand-detail-hero-icon"><FileSearchOutlined /></span>
          <div>
            <small>PURCHASE REQUEST · {view_demand.demandNo}</small>
            <h1>{view_demand.demandName || view_demand.productName || '采购需求'}</h1>
            <p>{view_demand.categoryName || '农产品'} · {view_demand.variety || '品种待定'} · 发布于 {shortDate(view_demand.createTime)}</p>
          </div>
          <span class={`mc-tag ${demandMeta.value.tone}`}>{demandMeta.value.text}</span>
          <div class="demand-detail-actions">
            {isOwner.value ? <>
                <button type="button" class="mc-btn" disabled={matching.value} onClick={() => void handleMatch()}>
                  <ThunderboltOutlined /> {matching.value ? '撮合中…' : '触发智能撮合'}
                </button>
                <button type="button" class="mc-btn ghost" onClick={() => navigate(`/member/buyer?tab=publish&id=${view_demand.id}`)}>
                  编辑需求
                </button>
                <button type="button" class="mc-btn ghost demand-detail-danger" onClick={() => void handleDelete()}>
                  下架需求
                </button>
              </> : <span class="demand-detail-muted">这条需求由别家经营主体发布，可查看撮合与报价，不能改</span>}
          </div>
        </section>

        <div class="demand-detail-layout">
          <div class="demand-detail-content">
            <Panel title="采购要求" extra={<span class="demand-detail-muted">需求核心信息</span>}>
              <div class="demand-detail-facts">
                <div><span>采购品类</span><strong>{view_demand.categoryName || '—'}</strong></div>
                <div><span>品种</span><strong>{view_demand.variety || '—'}</strong></div>
                <div><span>采购数量</span><strong>{view_demand.quantity} {view_demand.unit}</strong></div>
                <div><span>期望单价</span><strong class="demand-detail-price">{money(view_demand.priceMin)} - {money(view_demand.priceMax)}</strong></div>
                <div><span>交易类型</span><strong>{view_demand.demandType === 'long_term' ? '长期合作' : view_demand.demandType === 'presale' ? '订单农业 / 预售' : '现货采购'}</strong></div>
                <div><span>需要样品</span><strong>{view_demand.sampleRequire === 1 ? '需要' : '不需要'}</strong></div>
              </div>
              <div class="demand-detail-requirement">
                <div><span>收货地址</span><p><EnvironmentOutlined /> {[view_demand.deliveryProvince, view_demand.deliveryCity, view_demand.deliveryAddress].filter(Boolean).join(' ') || '待补充'}</p></div>
                <div><span>质量要求</span><p>{view_demand.qualityRequirement || '未填写'}</p></div>
                <div><span>资质与包装</span><p>{[view_demand.certificationRequire, view_demand.packagingRequire].filter(Boolean).join(' · ') || '未填写'}</p></div>
              </div>
            </Panel>

            <Panel title={`智能撮合（${matches.value.length}）`} extra={<span class="demand-detail-muted">按品类、价格、产地与信誉综合匹配</span>}>
              {matches.value.length === 0 ? <EmptyState title="尚无撮合结果" desc="点击“触发智能撮合”，系统会从当前在售货源中寻找供应商。" /> : <div class="demand-match-list">
                  {matches.value.map(row => <div class="demand-match-card" key={row.id}>
                      <span class="demand-match-score"><strong>{Number(row.matchScore ?? 0).toFixed(1)}</strong><small>匹配分</small></span>
                      <div>
                        <strong>商品 #{row.productId}</strong>
                        <p>{row.matchReason || '平台综合匹配推荐'}</p>
                        <small>{row.matchType === 'auto' ? '系统自动匹配' : '撮合推荐'} · {shortDate(row.createTime)}</small>
                      </div>
                      <a class="mc-btn ghost" href={`/product/detail/${row.productId}`}>查看商品</a>
                      <button type="button" class="mc-btn" disabled={view_inquiryBusy === row.productId} onClick={() => void handleInquiry(row.productId)}>
                        {view_inquiryBusy === row.productId ? '发起中…' : '发起询价'}
                      </button>
                    </div>)}
                </div>}
            </Panel>

            <Panel title={`询价与供应商报价（${inquiries.value.length} 张询价 / ${allQuotes.value.length} 份报价）`} extra={pendingQuotes.value.length > 0 ? <span class="mc-tag amber">待受理 {pendingQuotes.value.length}</span> : null}>
              {inquiries.value.length === 0 ? <EmptyState title="尚未发起询价" desc="在撮合结果中点击“发起询价”，供应商报价会显示在这里。" /> : <div class="demand-inquiries">
                  {inquiries.value.map(inquiry => {
                    const inquiryMeta = INQUIRY_STATUS[inquiry.inquiryStatus] ?? {
                      text: inquiry.inquiryStatus,
                      tone: 'ghost'
                    };
                    const quotes = quotesByInquiry.value[String(inquiry.id)] ?? [];
                    return <div class="demand-inquiry" key={inquiry.id}>
                        <div class="demand-inquiry-head">
                          <span class="demand-inquiry-icon"><ShopOutlined /></span>
                          <div>
                            <small>{inquiry.inquiryNo}</small>
                            <strong>{inquiry.productName || `商品 #${inquiry.productId}`}</strong>
                            <span>{inquiry.sellerName || '供应商'} · {inquiry.quantity} {inquiry.unit} · 截止 {shortDate(inquiry.replyDeadline)}</span>
                          </div>
                          <span class={`mc-tag ${inquiryMeta.tone}`}>{inquiryMeta.text}</span>
                          <span class="demand-inquiry-count">{quotes.length} 份报价</span>
                        </div>
                        {quotes.length === 0 ? <div class="demand-no-quote">等待供应商响应报价</div> : <div class="demand-quote-list">
                            {quotes.map(quote => {
                          const quoteMeta = QUOTE_STATUS[quote.quoteStatus] ?? {
                            text: quote.quoteStatus,
                            tone: 'ghost'
                          };
                          return <div class="demand-quote" key={quote.id}>
                                  <div><small>{quote.quoteNo}</small><strong>{quote.sellerName}</strong></div>
                                  <div><span>单价</span><strong>{money(quote.unitPrice)}/{quote.unit}</strong></div>
                                  <div><span>数量</span><strong>{quote.quantity} {quote.unit}</strong></div>
                                  <div><span>含运费总价</span><strong class="demand-detail-price">{money(Number(quote.totalAmount ?? 0) + Number(quote.freightAmount ?? 0))}</strong></div>
                                  <span class={`mc-tag ${quoteMeta.tone}`}>{quoteMeta.text}</span>
                                  <div class="demand-quote-actions">
                                    <button type="button" class="mc-btn ghost" onClick={() => setChatTarget({
                                sellerId: String(quote.sellerId),
                                sellerName: quote.sellerName || '供应商',
                                productId: quote.productId ?? null
                              })}>
                                      进入洽谈
                                    </button>
                                    {quote.quoteStatus === 'pending' ? <button type="button" class="mc-btn" disabled={view_quoteBusy === quote.id} onClick={() => void handleAcceptQuote(quote)}>
                                        {view_quoteBusy === quote.id ? '处理中…' : '接受报价并成单'}
                                      </button> : quote.orderId ? <a class="mc-link" href={`/order/detail/${quote.orderId}`}>查看订单</a> : null}
                                  </div>
                                </div>;
                        })}
                          </div>}
                      </div>;
                  })}
                </div>}
            </Panel>
          </div>

          <aside class="demand-detail-aside">
            <Panel title="需求概览">
              <div class="demand-summary">
                <div><span>采购方</span><strong>{view_demand.buyerName || '—'}</strong></div>
                <div><span>品类 / 品种</span><strong>{view_demand.categoryName || '—'} / {view_demand.variety || '—'}</strong></div>
                <div><span>采购数量</span><strong>{view_demand.quantity} {view_demand.unit}</strong></div>
                <div><span>报价数量</span><strong>{view_demand.responseCount ?? allQuotes.value.length} 份</strong></div>
                <div class="total"><span>期望总价</span><strong>{money(Number(view_demand.priceMin ?? 0) * Number(view_demand.quantity ?? 0))} - {money(Number(view_demand.priceMax ?? 0) * Number(view_demand.quantity ?? 0))}</strong></div>
              </div>
            </Panel>
            <Panel title="需求进度">
              <div class="demand-progress">
                <div class="on"><span><CheckCircleOutlined /></span><div><strong>需求已发布</strong><small>{shortDate(view_demand.createTime)}</small></div></div>
                <div class={matches.value.length ? 'on' : ''}><span><ThunderboltOutlined /></span><div><strong>智能撮合</strong><small>{matches.value.length ? `匹配 ${matches.value.length} 个货源` : '等待触发'}</small></div></div>
                <div class={inquiries.value.length ? 'on' : ''}><span><FileSearchOutlined /></span><div><strong>供应商报价</strong><small>{allQuotes.value.length ? `收到 ${allQuotes.value.length} 份报价` : '等待报价'}</small></div></div>
                <div class={view_demand.demandStatus === 'completed' ? 'on' : ''}><span><FileTextOutlined /></span><div><strong>报价成单</strong><small>{view_demand.demandStatus === 'completed' ? '已生成采购订单' : '尚未成交'}</small></div></div>
              </div>
            </Panel>
            <Panel title="操作提示">
              <div class="demand-tips">
                <p><SearchOutlined /> 先触发智能撮合，再从推荐货源发起询价。</p>
                <p><SafetyCertificateOutlined /> 报价成单后会自动生成待签合同。</p>
                <p><ClockCircleOutlined /> 供应商报价后请及时受理，报价存在有效期。</p>
              </div>
            </Panel>
          </aside>
        </div>
      </main>
      <ShopChat open={Boolean(view_chatTarget)} sellerId={view_chatTarget?.sellerId ?? ''} sellerName={view_chatTarget?.sellerName ?? ''} productId={view_chatTarget?.productId} onClose={() => setChatTarget(null)} />
    </div>;
    };
  }
});
export default DemandDetail;
function statusMeta(value: string): {
  text: string;
  tone: string;
} {
  return DEMAND_STATUS[value] ?? {
    text: value || '未知',
    tone: 'ghost'
  };
}
