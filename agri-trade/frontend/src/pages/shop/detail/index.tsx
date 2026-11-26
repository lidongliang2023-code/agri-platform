import '../../hall/hall.css';
import '../../product/detail/product-detail.css';
import './shop-detail.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { useParams } from "@/vue/router";
import { Empty, Input, Select, Spin } from "@/vue/ui";
import { ArrowRightOutlined, CheckCircleOutlined, CustomerServiceOutlined, EnvironmentOutlined, FileTextOutlined, HeartFilled, HeartOutlined, SafetyCertificateOutlined, SearchOutlined, ShopOutlined, ShoppingCartOutlined, CarOutlined, UserOutlined } from "@ant-design/icons-vue";
import { BrandMark } from '@/components/BrandMark';
import { PortalNav } from '@/components/PortalNav';
import { followSeller, getFollowState, unfollowSeller } from '@/api/shop-interaction';
import { getAccessToken } from '@/utils/session';
import { redirectToSso } from '@/utils/sso';
import { ShopChat } from './ShopChat';
interface ProductRow {
  id: number;
  productName: string;
  categoryName: string;
  variety: string;
  origin: string;
  specification: string;
  unit: string;
  price: number;
  priceMin?: number;
  minOrderQuantity?: number;
  stockQuantity: number;
  salesVolume?: number;
  sellerId: number | string;
  sellerName: string;
}
interface SellerHome {
  sellerId: string;
  sellerName: string;
  province: string | null;
  city: string | null;
  productCount: number;
  products: ProductRow[];
}
const PORTAL = `${window.location.protocol}//${window.location.hostname}:8098/portal/`;
const SSO_REGISTER = `${window.location.protocol}//${window.location.hostname}:8090/register`;
const money = (value: number | null | undefined): string => value == null ? '询价' : `¥${Number(value).toLocaleString('zh-CN', {
  maximumFractionDigits: 2
})}`;
const compactNumber = (value: number): string => Number(value).toLocaleString('zh-CN', {
  maximumFractionDigits: 2
});

/**
 * 公开供应商店铺主页。
 *
 * 店铺资料仍然来自该供应商已发布货源，不虚构评分、认证或成交量。
 * 页面视觉与商品详情统一使用交易大厅导航、绿色体系、面包屑和圆角卡片。
 */
const ShopDetail = defineComponent({
  name: "ShopDetail",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _routeParams = useParams();
    const rows = shallowRef<ProductRow[]>([]);
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const seller = shallowRef<SellerHome | null>(null);
    const setSeller = (next: typeof seller.value | ((previous: typeof seller.value) => typeof seller.value)) => {
      seller.value = typeof next === 'function' ? (next as (previous: typeof seller.value) => typeof seller.value)(seller.value) : next;
    };
    const error = shallowRef('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const loading = shallowRef(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const category = shallowRef('');
    const setCategory = (next: typeof category.value | ((previous: typeof category.value) => typeof category.value)) => {
      category.value = typeof next === 'function' ? (next as (previous: typeof category.value) => typeof category.value)(category.value) : next;
    };
    const sort = shallowRef('newest');
    const setSort = (next: typeof sort.value | ((previous: typeof sort.value) => typeof sort.value)) => {
      sort.value = typeof next === 'function' ? (next as (previous: typeof sort.value) => typeof sort.value)(sort.value) : next;
    };
    const search = shallowRef('');
    const setSearch = (next: typeof search.value | ((previous: typeof search.value) => typeof search.value)) => {
      search.value = typeof next === 'function' ? (next as (previous: typeof search.value) => typeof search.value)(search.value) : next;
    };
    const followed = shallowRef(false);
    const setFollowed = (next: typeof followed.value | ((previous: typeof followed.value) => typeof followed.value)) => {
      followed.value = typeof next === 'function' ? (next as (previous: typeof followed.value) => typeof followed.value)(followed.value) : next;
    };
    const followers = shallowRef(0);
    const setFollowers = (next: typeof followers.value | ((previous: typeof followers.value) => typeof followers.value)) => {
      followers.value = typeof next === 'function' ? (next as (previous: typeof followers.value) => typeof followers.value)(followers.value) : next;
    };
    const followBusy = shallowRef(false);
    const setFollowBusy = (next: typeof followBusy.value | ((previous: typeof followBusy.value) => typeof followBusy.value)) => {
      followBusy.value = typeof next === 'function' ? (next as (previous: typeof followBusy.value) => typeof followBusy.value)(followBusy.value) : next;
    };
    const chatOpen = shallowRef(false);
    const setChatOpen = (next: typeof chatOpen.value | ((previous: typeof chatOpen.value) => typeof chatOpen.value)) => {
      chatOpen.value = typeof next === 'function' ? (next as (previous: typeof chatOpen.value) => typeof chatOpen.value)(chatOpen.value) : next;
    };
    const interactionNotice = shallowRef('');
    const setInteractionNotice = (next: typeof interactionNotice.value | ((previous: typeof interactionNotice.value) => typeof interactionNotice.value)) => {
      interactionNotice.value = typeof next === 'function' ? (next as (previous: typeof interactionNotice.value) => typeof interactionNotice.value)(interactionNotice.value) : next;
    };
    onMounted(() => {
      watch(() => [_routeParams.sellerId], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!_routeParams.sellerId) return;
          let cancelled = false;
          setLoading(true);
          setError('');
          fetch(`/api/trade/public/sellers/${encodeURIComponent(_routeParams.sellerId)}`).then(response => response.json()).then((body: {
            code: number;
            data?: SellerHome;
            message?: string;
          }) => {
            if (cancelled) return;
            if (body.code === 200 && body.data) {
              setSeller(body.data);
              setRows(body.data.products ?? []);
            } else {
              setSeller(null);
              setRows([]);
              setError(body.message || '供应商不存在或暂无在售货源');
            }
          }).catch(() => {
            if (!cancelled) setError('加载供应商主页失败，请稍后重试');
          }).finally(() => {
            if (!cancelled) setLoading(false);
          });
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
    onMounted(() => {
      watch(() => [_routeParams.sellerId], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!_routeParams.sellerId || !getAccessToken()) {
            setFollowed(false);
            setFollowers(0);
            return;
          }
          let cancelled = false;
          void getFollowState(_routeParams.sellerId).then(result => {
            if (cancelled || result.code !== 200) return;
            setFollowed(Boolean(result.data?.followed));
            setFollowers(Number(result.data?.followers ?? 0));
          }).catch(() => {/* 公开店铺页不因未登录打断浏览 */});
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
    onMounted(() => {
      watch(() => [seller.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!seller.value || !getAccessToken()) return;
          const url = new URL(window.location.href);
          if (url.searchParams.get('chat') !== '1') return;
          setChatOpen(true);
          url.searchParams.delete('chat');
          window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const sellerName = computed(() => seller.value?.sellerName ?? rows.value[0]?.sellerName ?? '供应商主页');
    const location = computed(() => seller.value ? [seller.value.province, seller.value.city].filter(Boolean).join(' ') : '');
    const categories = computed(() => [...new Set(rows.value.map(item => item.categoryName).filter(Boolean))]);
    const totalStock = computed(() => rows.value.reduce((sum, item) => sum + Number(item.stockQuantity ?? 0), 0));
    const minPrice = computed(() => {
      const prices = rows.value.map(item => Number(item.price ?? item.priceMin)).filter(value => Number.isFinite(value));
      return prices.length ? Math.min(...prices) : null;
    });
    const visibleProducts = computed(() => {
      const normalized = keyword.value.trim().toLowerCase();
      const filtered = rows.value.filter(item => (!category.value || item.categoryName === category.value) && (!normalized || [item.productName, item.variety, item.origin, item.categoryName].some(value => String(value ?? '').toLowerCase().includes(normalized))));
      return [...filtered].sort((left, right) => {
        if (sort.value === 'priceAsc') return Number(left.price ?? left.priceMin ?? 0) - Number(right.price ?? right.priceMin ?? 0);
        if (sort.value === 'priceDesc') return Number(right.price ?? right.priceMin ?? 0) - Number(left.price ?? left.priceMin ?? 0);
        if (sort.value === 'stock') return Number(right.stockQuantity ?? 0) - Number(left.stockQuantity ?? 0);
        return right.id - left.id;
      });
    });
    const submitSearch = (event: PortalEvent): void => {
      event.preventDefault();
      const value = search.value.trim();
      window.location.href = `${PORTAL}#/hall${value ? `?q=${encodeURIComponent(value)}` : ''}`;
    };
    const toggleFollow = async (): Promise<void> => {
      if (!_routeParams.sellerId) return;
      if (!getAccessToken()) {
        await redirectToSso(`${window.location.pathname}${window.location.search}`);
        return;
      }
      setFollowBusy(true);
      setInteractionNotice('');
      try {
        const result = followed.value ? await unfollowSeller(_routeParams.sellerId) : await followSeller(_routeParams.sellerId);
        if (result.code !== 200 || !result.data) {
          setInteractionNotice(result.message || '关注操作失败');
          return;
        }
        setFollowed(result.data.followed);
        setFollowers(result.data.followers);
        setInteractionNotice(result.data.followed ? '已关注该供应商' : '已取消关注');
      } catch {
        setInteractionNotice('关注操作失败，请稍后重试');
      } finally {
        setFollowBusy(false);
      }
    };
    const openCustomerService = async (): Promise<void> => {
      if (!getAccessToken()) {
        const target = new URL(window.location.href);
        target.searchParams.set('chat', '1');
        await redirectToSso(`${target.pathname}${target.search}`);
        return;
      }
      setInteractionNotice('');
      setChatOpen(true);
    };
    return () => {
      const view_seller = seller.value;
      return <div class="hall-root shop-page">
      <div class="topbar">
        <div class="hall-container">
          <span>您好，欢迎来到丰链云交易大厅！智能大宗交易 · 平台撮合 · 支持在线议价</span>
          <span class="topbar-actions">
            <a href="/member/buyer">我是买家</a><span class="sep">·</span>
            <a href="/member/seller">我是卖家</a><span class="sep">·</span>
            <a href="/member/buyer">会员中心</a><span class="sep">·</span>
            <a href="#login" onClick={event => {
                event.preventDefault();
                void redirectToSso(`${window.location.pathname}${window.location.search}`);
              }}><UserOutlined />登录</a><span class="sep">·</span>
            <a href={SSO_REGISTER}>免费注册</a>
          </span>
        </div>
      </div>

      <header class="site-header">
        <div class="hall-container">
          <a class="hall-brand" href={PORTAL}>
            <span class="hall-logo"><BrandMark size={36} /></span>
            <span>丰链云<small>FENGCHAIN · AGRI</small></span>
          </a>
          <PortalNav />
          <form class="header-search" onSubmit={submitSearch}>
            <input value={search.value} onInput={event => setSearch((event.target as HTMLInputElement).value ?? '')} placeholder="搜索商品 / 供应商 / 需求" />
            <button type="submit"><SearchOutlined />搜索</button>
          </form>
        </div>
      </header>

      <main class="hall-container shop-main">
        <nav class="pd-crumb" aria-label="面包屑">
          <a href={PORTAL}>首页</a><span>/</span>
          <a href="/hall">交易大厅</a><span>/</span>
          <strong>{sellerName.value}</strong>
        </nav>

        <section class="shop-hero">
          <div class="shop-hero-main">
            <div class="shop-avatar"><ShopOutlined /></div>
            <div class="shop-intro">
              <div class="shop-kicker"><SafetyCertificateOutlined /> 平台在营供应商</div>
              <h1>{sellerName.value}</h1>
              <p>
                <EnvironmentOutlined /> {location.value || '所在地待补充'}
                <span>·</span>
                已上架 {view_seller?.productCount ?? rows.value.length} 款源头货源
              </p>
              <div class="shop-tags">
                {categories.value.slice(0, 5).map(item => <span key={item}>{item}</span>)}
                <span>交易留痕</span>
                <span>平台撮合</span>
              </div>
            </div>
            <div class="shop-hero-actions">
              <button type="button" class={`shop-follow-action ${followed.value ? 'followed' : ''}`} disabled={followBusy.value} onClick={() => void toggleFollow()}>
                {followed.value ? <HeartFilled /> : <HeartOutlined />}
                {followBusy.value ? '处理中…' : followed.value ? `已关注 ${followers.value}` : followers.value > 0 ? `关注 ${followers.value}` : '关注'}
              </button>
              <button type="button" class="shop-service-action" onClick={() => void openCustomerService()}>
                <CustomerServiceOutlined />客服
              </button>
              <a class="shop-hero-action" href="#products">
                浏览全部货源 <ArrowRightOutlined />
              </a>
            </div>
          </div>

          <div class="shop-metrics">
            <div><span>在售货源</span><strong>{view_seller?.productCount ?? rows.value.length}<small>款</small></strong></div>
            <div><span>覆盖品类</span><strong>{categories.value.length}<small>类</small></strong></div>
            <div><span>可供库存</span><strong>{compactNumber(totalStock.value)}<small>单位</small></strong></div>
            <div><span>起批价格</span><strong>{minPrice.value == null ? '询价' : money(minPrice.value)}</strong></div>
          </div>
        </section>

        {interactionNotice.value && <div class="shop-interaction-notice">{interactionNotice.value}</div>}

        {error.value && <div class="shop-alert">
            <SafetyCertificateOutlined />
            <div><strong>店铺货源暂不可用</strong><span>{error.value}</span></div>
            <a href="/hall">返回交易大厅</a>
          </div>}

        <div class="shop-layout">
          <section class="shop-products" id="products">
            <div class="shop-section-head">
              <div>
                <span>SUPPLIER PRODUCTS</span>
                <h2>在售货源</h2>
                <p>价格与库存来自交易域实时记录，点击商品查看完整规格与议价入口</p>
              </div>
              <em>{visibleProducts.value.length} / {rows.value.length} 款</em>
            </div>

            <div class="shop-toolbar">
              <Input allowClear prefix={<SearchOutlined />} value={keyword.value} onChange={event => setKeyword(event.target.value ?? '')} placeholder="搜索本店商品、品种或产地" />
              <Select value={sort.value} onChange={setSort} options={[{
                  value: 'newest',
                  label: '最新上架'
                }, {
                  value: 'priceAsc',
                  label: '价格从低到高'
                }, {
                  value: 'priceDesc',
                  label: '价格从高到低'
                }, {
                  value: 'stock',
                  label: '库存优先'
                }]} />
            </div>
            <div class="shop-category-row">
              <button type="button" class={!category.value ? 'on' : ''} onClick={() => setCategory('')}>全部品类</button>
              {categories.value.map(item => <button type="button" key={item} class={category.value === item ? 'on' : ''} onClick={() => setCategory(item)}>{item}</button>)}
            </div>

            {loading.value ? <div class="shop-loading"><Spin /><span>正在读取供应商货源…</span></div> : visibleProducts.value.length === 0 ? <div class="shop-empty">
                <Empty description={rows.value.length ? '没有符合筛选条件的货源' : '该店铺暂无在架货源'} />
                {rows.value.length > 0 && <button type="button" onClick={() => {
                  setKeyword('');
                  setCategory('');
                }}>清除筛选</button>}
              </div> : <div class="shop-product-grid">
                {visibleProducts.value.map(item => <a class="shop-product-card" key={item.id} href={`/product/detail/${item.id}`}>
                    <div class="shop-product-visual">
                      <span><ShopOutlined /></span>
                      <em>在售</em>
                      <small>{item.categoryName || '农产品'}</small>
                    </div>
                    <div class="shop-product-body">
                      <span class="shop-product-cat">{item.categoryName || '平台货源'}</span>
                      <strong>{item.productName}</strong>
                      <p>{[item.variety, item.specification, item.origin].filter(Boolean).join(' · ') || '商品规格以详情页为准'}</p>
                      <div class="shop-product-data">
                        <span>起订 {compactNumber(Number(item.minOrderQuantity ?? 1))} {item.unit}</span>
                        <span>库存 {compactNumber(Number(item.stockQuantity ?? 0))} {item.unit}</span>
                        {(item.salesVolume ?? 0) > 0 && <span>成交 {item.salesVolume}</span>}
                      </div>
                      <div class="shop-product-foot">
                        <div><b>{money(item.price ?? item.priceMin)}</b><small>/{item.unit}</small></div>
                        <span>查看详情 <ArrowRightOutlined /></span>
                      </div>
                    </div>
                  </a>)}
              </div>}
          </section>

          <aside class="shop-aside">
            <div class="shop-aside-card">
              <div class="shop-aside-title"><ShopOutlined /><strong>供应商资料</strong></div>
              <dl>
                <div><dt>供应商名称</dt><dd>{sellerName.value}</dd></div>
                <div><dt>所在地</dt><dd>{location.value || '待补充'}</dd></div>
                <div><dt>主营品类</dt><dd>{categories.value.slice(0, 3).join('、') || '待补充'}</dd></div>
                <div><dt>货源数量</dt><dd>{view_seller?.productCount ?? rows.value.length} 款</dd></div>
              </dl>
              <a href="#products">查看该供应商全部商品 <ArrowRightOutlined /></a>
            </div>

            <div class="shop-aside-card shop-trust">
              <div class="shop-aside-title"><SafetyCertificateOutlined /><strong>交易保障</strong></div>
              <ul>
                <li><CheckCircleOutlined /><span><strong>货源信息真实</strong><small>商品资料与价格来自供应商发布记录</small></span></li>
                <li><CarOutlined /><span><strong>履约全程留痕</strong><small>订单、物流、签收和售后均可追溯</small></span></li>
                <li><FileTextOutlined /><span><strong>合同与凭证留存</strong><small>支持在线签章、线下签署与平台存证</small></span></li>
              </ul>
            </div>

            <div class="shop-aside-card shop-guide">
              <div class="shop-aside-title"><ShoppingCartOutlined /><strong>采购流程</strong></div>
              <ol>
                <li><span>01</span>选择商品并查看规格</li>
                <li><span>02</span>立即下单或在线询价</li>
                <li><span>03</span>确认合同、支付与收货</li>
              </ol>
              <a href="/hall">继续浏览其他供应商</a>
            </div>
          </aside>
        </div>
      </main>

      <footer class="hall-footer">
        <div class="hall-container">
          <span>© 2026 农业产业互联网平台 · 丰链云供应商店铺</span>
          <span>店铺信息与货源均来自交易域公开数据。</span>
        </div>
      </footer>
      <ShopChat open={chatOpen.value} sellerId={_routeParams.sellerId || ''} sellerName={sellerName.value} onClose={() => setChatOpen(false)} />
    </div>;
    };
  }
});
export default ShopDetail;
