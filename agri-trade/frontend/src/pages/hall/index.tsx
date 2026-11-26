import './hall.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { SearchOutlined, ShopOutlined, SwapOutlined, UserOutlined } from "@ant-design/icons-vue";
import { isLoggedIn } from '@/utils/session';
import { redirectToSso } from '@/utils/sso';
import { BrandMark } from '@/components/BrandMark';
import { PortalNav } from '@/components/PortalNav';
import { HALL_PROVINCES, HALL_TAXONOMY, L1_KEYWORDS, L2_KEYWORDS, PROVINCE_GROUPS } from './taxonomy';
interface HallProduct {
  id: number;
  productName: string;
  sellerId: number | string;
  sellerName: string | null;
  categoryName: string | null;
  variety: string | null;
  origin: string;
  specification: string | null;
  unit: string;
  price: number;
  priceMin: number | null;
  priceMax: number | null;
  minOrderQuantity: number | null;
  stockQuantity: number | null;
  salesVolume: number | null;
  province: string | null;
  categoryId: number | null;
}
interface PublicPage {
  records: HallProduct[];
  total: number;
  pageNum: number;
  pageSize: number;
}
interface PublicDemand {
  id: number;
  demandNo: string;
  demandName: string;
  buyerName: string;
  productName: string;
  variety: string;
  quantity: number;
  unit: string;
  priceMin: number | null;
  priceMax: number | null;
  deliveryProvince: string | null;
  deliveryCity: string | null;
  demandStatus: string;
  responseCount: number;
  createTime: string;
}
const PORTAL = `${window.location.protocol}//${window.location.hostname}:8098/portal/`;
const SSO_REGISTER = `${window.location.protocol}//${window.location.hostname}:8090/register`;
const PAGE_SIZE = 9;
const EMBEDDED = new URLSearchParams(window.location.search).get('embed') === '1';
const PORTAL_HERO = EMBEDDED && new URLSearchParams(window.location.search).get('portalHero') === '1';

// 门户「交易大厅」把产业链筛选参数透传到 iframe（原「产业链」页已并入交易大厅），
// 这里只接受字典内合法的取值，避免旧链接或手工拼参数把页面筛成空列表。
const HALL_QUERY = new URLSearchParams(window.location.search);
const queryValue = (name: string): string => (HALL_QUERY.get(name) ?? '').trim();
const QUERY_L1 = queryValue('l1');
const INITIAL_L1 = Object.prototype.hasOwnProperty.call(HALL_TAXONOMY, QUERY_L1) ? QUERY_L1 : '';
const QUERY_L2 = queryValue('l2');
const INITIAL_L2 = INITIAL_L1 && Object.prototype.hasOwnProperty.call(HALL_TAXONOMY[INITIAL_L1] ?? {}, QUERY_L2) ? QUERY_L2 : '';
const QUERY_L3 = queryValue('l3');
const INITIAL_L3 = INITIAL_L2 && (HALL_TAXONOMY[INITIAL_L1]?.[INITIAL_L2] ?? []).includes(QUERY_L3) ? QUERY_L3 : '';
const QUERY_PROVINCE = queryValue('province') || queryValue('loc');
const INITIAL_PROVINCE = HALL_PROVINCES.some(item => item.name === QUERY_PROVINCE) ? QUERY_PROVINCE : '';
const INITIAL_KEYWORD = queryValue('keyword') || queryValue('q');
const INITIAL_TAB: 'supply' | 'purchase' = queryValue('tab') === 'purchase' ? 'purchase' : 'supply';

/** 产地筛选默认只露常用户省份，其余收进「更多产地」浮层 —— 33 个省份平铺会把筛选区撑到 400px 以上。 */
const TOP_PROVINCES = ['山东', '河南', '河北', '江苏', '安徽', '湖北', '湖南', '四川', '云南', '广西', '广东', '陕西'];
const money = (value: number | null | undefined): string => value == null ? '询价' : `¥${Number(value).toLocaleString('zh-CN', {
  maximumFractionDigits: 2
})}`;
const shortDate = (value: string): string => value?.slice(0, 10) ?? '—';
const TradeHall = defineComponent({
  name: "TradeHall",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const tab = shallowRef<'supply' | 'purchase'>(INITIAL_TAB);
    const setTab = (next: typeof tab.value | ((previous: typeof tab.value) => typeof tab.value)) => {
      tab.value = typeof next === 'function' ? (next as (previous: typeof tab.value) => typeof tab.value)(tab.value) : next;
    };
    const products = shallowRef<HallProduct[]>([]);
    const setProducts = (next: typeof products.value | ((previous: typeof products.value) => typeof products.value)) => {
      products.value = typeof next === 'function' ? (next as (previous: typeof products.value) => typeof products.value)(products.value) : next;
    };
    const total = shallowRef(0);
    const setTotal = (next: typeof total.value | ((previous: typeof total.value) => typeof total.value)) => {
      total.value = typeof next === 'function' ? (next as (previous: typeof total.value) => typeof total.value)(total.value) : next;
    };
    const page = shallowRef(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = shallowRef('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const keyword = shallowRef(INITIAL_KEYWORD);
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const searchInput = shallowRef(INITIAL_KEYWORD);
    const setSearchInput = (next: typeof searchInput.value | ((previous: typeof searchInput.value) => typeof searchInput.value)) => {
      searchInput.value = typeof next === 'function' ? (next as (previous: typeof searchInput.value) => typeof searchInput.value)(searchInput.value) : next;
    };
    const l1 = shallowRef(INITIAL_L1);
    const setL1 = (next: typeof l1.value | ((previous: typeof l1.value) => typeof l1.value)) => {
      l1.value = typeof next === 'function' ? (next as (previous: typeof l1.value) => typeof l1.value)(l1.value) : next;
    };
    const l2 = shallowRef(INITIAL_L2);
    const setL2 = (next: typeof l2.value | ((previous: typeof l2.value) => typeof l2.value)) => {
      l2.value = typeof next === 'function' ? (next as (previous: typeof l2.value) => typeof l2.value)(l2.value) : next;
    };
    const l3 = shallowRef(INITIAL_L3);
    const setL3 = (next: typeof l3.value | ((previous: typeof l3.value) => typeof l3.value)) => {
      l3.value = typeof next === 'function' ? (next as (previous: typeof l3.value) => typeof l3.value)(l3.value) : next;
    };
    const province = shallowRef(INITIAL_PROVINCE);
    const setProvince = (next: typeof province.value | ((previous: typeof province.value) => typeof province.value)) => {
      province.value = typeof next === 'function' ? (next as (previous: typeof province.value) => typeof province.value)(province.value) : next;
    };
    const sort = shallowRef('default');
    const setSort = (next: typeof sort.value | ((previous: typeof sort.value) => typeof sort.value)) => {
      sort.value = typeof next === 'function' ? (next as (previous: typeof sort.value) => typeof sort.value)(sort.value) : next;
    };
    const demands = shallowRef<PublicDemand[]>([]);
    const setDemands = (next: typeof demands.value | ((previous: typeof demands.value) => typeof demands.value)) => {
      demands.value = typeof next === 'function' ? (next as (previous: typeof demands.value) => typeof demands.value)(demands.value) : next;
    };
    const recommendations = shallowRef<HallProduct[]>([]);
    const setRecommendations = (next: typeof recommendations.value | ((previous: typeof recommendations.value) => typeof recommendations.value)) => {
      recommendations.value = typeof next === 'function' ? (next as (previous: typeof recommendations.value) => typeof recommendations.value)(recommendations.value) : next;
    };
    const demandLoading = shallowRef(false);
    const setDemandLoading = (next: typeof demandLoading.value | ((previous: typeof demandLoading.value) => typeof demandLoading.value)) => {
      demandLoading.value = typeof next === 'function' ? (next as (previous: typeof demandLoading.value) => typeof demandLoading.value)(demandLoading.value) : next;
    };
    const provinceOpen = shallowRef(false);
    const setProvinceOpen = (next: typeof provinceOpen.value | ((previous: typeof provinceOpen.value) => typeof provinceOpen.value)) => {
      provinceOpen.value = typeof next === 'function' ? (next as (previous: typeof provinceOpen.value) => typeof provinceOpen.value)(provinceOpen.value) : next;
    };
    const provinceRef = shallowRef<HTMLDivElement | null | null>(null);
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          if (!EMBEDDED) {
            window.location.replace(`${PORTAL}#/hall`);
          }
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    onMounted(() => {
      watch(() => [provinceOpen.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!provinceOpen.value) return undefined;
          const onPointerDown = (event: PortalEvent): void => {
            if (provinceRef.value && !provinceRef.value.contains(event.target as Node)) {
              setProvinceOpen(false);
            }
          };
          const onKeyDown = (event: PortalEvent): void => {
            if ((event as KeyboardEvent).key === 'Escape') setProvinceOpen(false);
          };
          document.addEventListener('mousedown', onPointerDown);
          document.addEventListener('keydown', onKeyDown);
          return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
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
          if (!EMBEDDED) return undefined;
          let base = document.querySelector('base');
          if (!base) {
            base = document.createElement('base');
            document.head.appendChild(base);
          }
          base.setAttribute('target', '_top');
          const reportHeight = (): void => {
            const main = document.querySelector('.hall-main') as HTMLElement | null;
            const contentHeight = main ? main.offsetTop + main.offsetHeight + 24 : document.documentElement.scrollHeight;
            window.parent.postMessage({
              type: 'agri-hall-height',
              height: Math.ceil(contentHeight)
            }, '*');
          };
          const onParentReady = (event: MessageEvent): void => {
            if (event.source !== window.parent || event.origin !== new URL(PORTAL).origin) return;
            if (event.data?.type === 'agri-hall-ready') reportHeight();
          };
          window.addEventListener('message', onParentReady);
          reportHeight();
          const observer = new ResizeObserver(reportHeight);
          observer.observe(document.body);
          window.addEventListener('resize', reportHeight);
          return () => {
            observer.disconnect();
            window.removeEventListener('resize', reportHeight);
            window.removeEventListener('message', onParentReady);
          };
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    onMounted(() => {
      watch(() => [tab.value, products.value.length, demands.value.length, loading.value, demandLoading.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!EMBEDDED) return undefined;
          const timer = window.setTimeout(() => {
            const main = document.querySelector('.hall-main') as HTMLElement | null;
            const contentHeight = main ? main.offsetTop + main.offsetHeight + 24 : document.documentElement.scrollHeight;
            window.parent.postMessage({
              type: 'agri-hall-height',
              height: Math.ceil(contentHeight)
            }, '*');
          }, 80);
          return () => window.clearTimeout(timer);
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
          fetch('/api/trade/public/products?limit=24').then(response => response.json()).then((body: {
            code?: number;
            data?: HallProduct[];
          }) => {
            if (body.code === 200) setRecommendations(Array.isArray(body.data) ? body.data : []);
          }).catch(() => {/* 推荐区降级为空 */});
          setDemandLoading(true);
          fetch('/api/trade/public/demands').then(response => response.json()).then((body: {
            code?: number;
            data?: PublicDemand[];
          }) => {
            if (body.code === 200) setDemands(Array.isArray(body.data) ? body.data : []);
          }).catch(() => {/* 页面显示暂无需求 */}).finally(() => setDemandLoading(false));
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    const level1 = computed(() => Object.keys(HALL_TAXONOMY));
    const level2 = computed(() => l1.value ? Object.keys(HALL_TAXONOMY[l1.value] ?? {}) : []);
    const level3 = computed(() => l1.value && l2.value ? HALL_TAXONOMY[l1.value]?.[l2.value] ?? [] : []);
    onMounted(() => {
      watch(() => [page.value, keyword.value, l1.value, l2.value, l3.value, province.value, sort.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          let cancelled = false;
          setLoading(true);
          setError('');
          const params = new URLSearchParams({
            pageNum: String(page.value),
            pageSize: String(PAGE_SIZE),
            sort: sort.value === 'default' ? 'latest' : sort.value
          });
          if (keyword.value.trim()) params.set('keyword', keyword.value.trim());
          if (l3.value) {
            params.set('varietyKeyword', l3.value);
          } else if (l2.value) {
            for (const value of L2_KEYWORDS[l2.value] ?? []) params.append('categoryKeywords', value);
          } else if (l1.value) {
            for (const value of L1_KEYWORDS[l1.value] ?? []) params.append('categoryKeywords', value);
          }
          if (province.value) params.set('province', province.value);
          fetch(`/api/trade/public/hall/products?${params.toString()}`).then(response => response.json()).then((body: {
            code?: number;
            data?: PublicPage;
            message?: string;
          }) => {
            if (cancelled) return;
            if (body.code === 200 && body.data) {
              setProducts(body.data.records ?? []);
              setTotal(body.data.total ?? 0);
            } else {
              setProducts([]);
              setTotal(0);
              setError(body.message ?? '交易大厅加载失败');
            }
          }).catch(() => {
            if (!cancelled) {
              setProducts([]);
              setTotal(0);
              setError('无法连接交易服务');
            }
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
    const suppliers = computed(() => {
      const map = new Map<string, {
        sellerId: string;
        name: string;
        count: number;
      }>();
      recommendations.value.forEach(item => {
        if (!item.sellerName || item.sellerId == null) return;
        const sellerId = String(item.sellerId);
        const current = map.get(sellerId) ?? {
          sellerId,
          name: item.sellerName,
          count: 0
        };
        current.count += 1;
        map.set(sellerId, current);
      });
      return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
    });
    const submitSearch = (event: PortalEvent): void => {
      event.preventDefault();
      setKeyword(searchInput.value);
      setPage(1);
    };
    const resetFilters = (): void => {
      setL1('');
      setL2('');
      setL3('');
      setProvince('');
      setSort('default');
      setKeyword('');
      setSearchInput('');
      setPage(1);
    };
    const quote = (demand: PublicDemand): void => {
      const target = `/member/seller?tab=trade`;
      if (EMBEDDED) {
        window.top?.location.assign(target);
        return;
      }
      if (isLoggedIn()) {
        window.location.href = target;
      } else {
        void redirectToSso(target);
      }
      void demand;
    };
    const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
    const hasFilter = computed(() => Boolean(l1.value || l2.value || l3.value || province.value || keyword.value));
    // 常用户省份优先；若当前选中的在外省列表里，也把它提到前面，避免"选中了却看不见"
    const topProvinceOptions = computed(() => {
      const names = TOP_PROVINCES.filter(name => HALL_PROVINCES.some(item => item.name === name));
      if (province.value && !names.includes(province.value)) names.unshift(province.value);
      return names;
    });
    const activeFilters = computed(() => {
      const list: Array<{
        key: string;
        label: string;
        clear: () => void;
      }> = [];
      if (l1.value) list.push({
        key: 'l1',
        label: l1.value,
        clear: () => {
          setL1('');
          setL2('');
          setL3('');
          setPage(1);
        }
      });
      if (l2.value) list.push({
        key: 'l2',
        label: l2.value,
        clear: () => {
          setL2('');
          setL3('');
          setPage(1);
        }
      });
      if (l3.value) list.push({
        key: 'l3',
        label: l3.value,
        clear: () => {
          setL3('');
          setPage(1);
        }
      });
      if (province.value) list.push({
        key: 'province',
        label: `产地 ${province.value}`,
        clear: () => {
          setProvince('');
          setPage(1);
        }
      });
      if (keyword.value) list.push({
        key: 'keyword',
        label: `“${keyword.value}”`,
        clear: () => {
          setKeyword('');
          setSearchInput('');
          setPage(1);
        }
      });
      return list;
    });
    return () => {
      return <div class={EMBEDDED ? `hall-root hall-embed${PORTAL_HERO ? ' hall-portal-shell' : ''}` : 'hall-root'}>
      <div class="topbar" style={EMBEDDED ? {
          display: 'none'
        } : undefined}>
        <div class="hall-container">
          <span>您好，欢迎来到丰链云交易大厅！智能大宗交易 · 平台撮合 · 支持在线议价</span>
          <span class="topbar-actions">
            <a href="/member/buyer">我是买家</a><span class="sep">·</span>
            <a href="/member/seller">我是卖家</a><span class="sep">·</span>
            <a href="/member/buyer">会员中心</a><span class="sep">·</span>
            <a href="#platform-login" onClick={event => {
                event.preventDefault();
                void redirectToSso(`${window.location.pathname}${window.location.search}`);
              }}><UserOutlined />登录</a><span class="sep">·</span>
            <a href={SSO_REGISTER}>免费注册</a>
          </span>
        </div>
      </div>

      <header class="site-header" style={EMBEDDED ? {
          display: 'none'
        } : undefined}>
        <div class="hall-container">
          <a class="hall-brand" href={PORTAL}>
            <span class="hall-logo"><BrandMark size={36} /></span>
            <span>丰链云<small>FENGCHAIN · AGRI</small></span>
          </a>
          <PortalNav />
          <form class="header-search" onSubmit={submitSearch}>
            <input value={searchInput.value} onInput={event => setSearchInput((event.target as HTMLInputElement).value ?? '')} placeholder="搜索商品 / 供应商 / 需求" />
            <button type="submit"><SearchOutlined />搜索</button>
          </form>
        </div>
      </header>

      <main class="hall-container hall-main">
        {/* 嵌入门户时页头已有导航与面包屑，这里不再重复一遍 */}
        {!EMBEDDED && <div class="hall-crumb"><a href={PORTAL}>首页</a><span>/</span><strong>交易大厅</strong></div>}
        {/* 页头与「价格指数」的 section-head 同一口径：17px 标题 + 小字说明 + 右侧计数 */}
        {EMBEDDED ? <section class="hall-portal-hero">
            <h1>交易大厅</h1>
            <p>汇聚农业产业链优质货源与采购需求，支持在线议价与平台撮合，让产销对接更高效。</p>
            <div class="hall-portal-hero-meta"><span>{total.value} 个在售商品</span><span>产业链选品 · 产地直连 · 在线议价</span></div>
          </section> : <div class="hall-title-row">
            <h2>交易大厅 <small>智能大宗交易 · 平台撮合 · 支持在线议价</small></h2>
            <span class="hall-title-count">{total.value} 个在售商品</span>
          </div>}

        <div class="hall-tabs">
          <button type="button" class={tab.value === 'supply' ? 'on' : ''} onClick={() => setTab('supply')}>供应大厅</button>
          <button type="button" class={tab.value === 'purchase' ? 'on' : ''} onClick={() => setTab('purchase')}>采购需求</button>
        </div>

        {tab.value === 'supply' ? <>
            <div class="hall-supply">
              <section class="hall-filter-card">
                <div class="hall-filter-head">
                  <span class="hall-filter-title"><ShopOutlined />筛选</span>
                  <div class="hall-filter-head-right">
                    <span class="hall-filter-count">匹配 <b>{total.value}</b> 个货源</span>
                    {hasFilter.value && <button type="button" class="hall-filter-clear" onClick={resetFilters}>清空</button>}
                  </div>
                </div>

                <div class="hall-filter-line">
                  <span class="hall-filter-label">产业链</span>
                  <div class="hall-chip-scroll">
                    <button type="button" class={l1.value === '' ? 'on' : ''} onClick={() => {
                      setL1('');
                      setL2('');
                      setL3('');
                      setPage(1);
                    }}>全部</button>
                    {level1.value.map(item => <button type="button" key={item} class={l1.value === item ? 'on' : ''} onClick={() => {
                      setL1(item);
                      setL2('');
                      setL3('');
                      setPage(1);
                    }}>{item}</button>)}
                  </div>
                </div>

                {l1.value && <div class="hall-filter-line">
                    <span class="hall-filter-label">品类</span>
                    <div class="hall-chip-scroll">
                      {level2.value.map(item => <button type="button" key={item} class={l2.value === item ? 'on' : ''} onClick={() => {
                      setL2(item);
                      setL3('');
                      setPage(1);
                    }}>{item}</button>)}
                    </div>
                  </div>}

                {l2.value && level3.value.length > 0 && <div class="hall-filter-line">
                    <span class="hall-filter-label">品种</span>
                    <div class="hall-chip-scroll">
                      {level3.value.map(item => <button type="button" key={item} class={l3.value === item ? 'on' : ''} onClick={() => {
                      setL3(item);
                      setPage(1);
                    }}>{item}</button>)}
                    </div>
                  </div>}

                <div class="hall-filter-line hall-filter-province" ref={provinceRef}>
                  <span class="hall-filter-label">产地</span>
                  <div class="hall-chip-scroll">
                    <button type="button" class={province.value === '' ? 'on' : ''} onClick={() => {
                      setProvince('');
                      setPage(1);
                    }}>全部</button>
                    {topProvinceOptions.value.map(name => <button type="button" key={name} class={province.value === name ? 'on' : ''} onClick={() => {
                      setProvince(name);
                      setPage(1);
                      setProvinceOpen(false);
                    }}>{name}</button>)}
                  </div>
                  <button type="button" class={provinceOpen.value ? 'hall-more open' : 'hall-more'} aria-expanded={provinceOpen.value} onClick={() => setProvinceOpen(open => !open)}>
                    更多产地<span aria-hidden>{provinceOpen.value ? '▴' : '▾'}</span>
                  </button>
                  {provinceOpen.value && <div class="hall-province-pop" role="dialog" aria-label="更多产地">
                      {PROVINCE_GROUPS.map(group => {
                      const items = HALL_PROVINCES.filter(item => item.group === group);
                      if (!items.length) return null;
                      return <div class="hall-province-pop-group" key={group}>
                            <span>{group}</span>
                            <div class="hall-province-pop-chips">
                              {items.map(item => <button type="button" key={item.name} class={province.value === item.name ? 'on' : ''} onClick={() => {
                            setProvince(item.name);
                            setPage(1);
                            setProvinceOpen(false);
                          }}>{item.name}</button>)}
                            </div>
                          </div>;
                    })}
                    </div>}
                </div>

                {hasFilter.value && <div class="hall-active-row">
                    <span class="hall-active-label">已选</span>
                    {activeFilters.value.map(filter => <button type="button" key={filter.key} class="hall-active-chip" onClick={filter.clear}>
                        {filter.label}<i aria-hidden>×</i>
                      </button>)}
                    <button type="button" class="hall-active-reset" onClick={resetFilters}>清空全部</button>
                  </div>}
              </section>

              <section class="hall-list">
                <div class="hall-toolbar">
                  <span>{pages.value > 1 ? <>第 <b>{page.value}</b> / {pages.value} 页</> : <>共 <b>{total.value}</b> 个在售商品</>}</span>
                  <div class="hall-chips">
                    {[{
                      key: 'default',
                      label: '综合'
                    }, {
                      key: 'latest',
                      label: '最新发布'
                    }, {
                      key: 'priceAsc',
                      label: '价格从低到高'
                    }, {
                      key: 'priceDesc',
                      label: '价格从高到低'
                    }].map(item => <button type="button" key={item.key} class={sort.value === item.key ? 'on' : ''} onClick={() => {
                      setSort(item.key);
                      setPage(1);
                    }}>{item.label}</button>)}
                  </div>
                </div>
                {loading.value && <div class="hall-state">正在加载货源…</div>}
                {!loading.value && error.value && <div class="hall-state error">{error.value}</div>}
                {!loading.value && !error.value && products.value.length === 0 && <div class="hall-state">没有匹配的货源，试试更换筛选条件。</div>}
                {!loading.value && !error.value && products.value.length > 0 && <div class="hall-grid">
                    {products.value.map((product, index) => <a class="hall-product" key={product.id} href={`/product/detail/${product.id}`}>
                        <div class={`hall-thumb theme-${index % 5}`}><ShopOutlined /></div>
                        <div class="hall-product-title">
                          <strong>{product.productName}</strong>
                          <span class="hall-tag">{product.categoryName || '农产品'}</span>
                        </div>
                        <div class="hall-product-meta">{product.origin || '产地待补充'} · {product.specification || product.variety || '规格待补充'}</div>
                        <div class="hall-price">{money(product.price)}<small> / {product.unit}</small></div>
                        <div class="hall-product-foot">
                          <span>起订 {product.minOrderQuantity ?? '—'} {product.unit}</span>
                          <span>{product.sellerName || '平台商家'}</span>
                        </div>
                      </a>)}
                  </div>}
                {pages.value > 1 && <div class="hall-pager">
                    <button type="button" disabled={page.value <= 1} onClick={() => setPage(page.value - 1)}>上一页</button>
                    <span>{page.value} / {pages.value}</span>
                    <button type="button" disabled={page.value >= pages.value} onClick={() => setPage(page.value + 1)}>下一页</button>
                  </div>}
              </section>
            </div>

            <section class="hall-suppliers">
              <div class="hall-card-head"><h3>优质供应商推荐</h3><span>按在售货源数</span></div>
              <div class="hall-supplier-grid">
                {suppliers.value.map((item, index) => <a class="hall-supplier" key={item.sellerId} href={`/shop/${item.sellerId}`}>
                    <span class={`hall-supplier-icon tone-${index % 4}`}><SwapOutlined /></span>
                    <strong>{item.name}</strong>
                    <small>在售 {item.count} 个货源</small>
                    <em>进入主页 ›</em>
                  </a>)}
                {!suppliers.value.length && <div class="hall-state">暂无供应商数据</div>}
              </div>
            </section>
          </> : <section class="hall-demand-card">
            <div class="hall-card-head">
              <h3>采购需求大厅</h3>
              <span>共 {demands.value.length} 条需求 · 登录后可报价与在线议价</span>
            </div>
            {demandLoading.value && <div class="hall-state">正在加载采购需求…</div>}
            {!demandLoading.value && demands.value.length === 0 && <div class="hall-state">暂无公开采购需求</div>}
            {!demandLoading.value && demands.value.length > 0 && <div class="hall-table-wrap">
                <table class="hall-table">
                  <thead><tr><th>需求方</th><th>品类 / 品种</th><th>数量</th><th>期望价</th><th>交货地</th><th>发布时间</th><th>状态</th><th>操作</th></tr></thead>
                  <tbody>
                    {demands.value.map(item => <tr key={item.id}>
                        <td><strong>{item.buyerName}</strong></td>
                        <td>{item.productName || item.demandName}<span class="hall-muted"> / {item.variety}</span></td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>{money(item.priceMin)} ~ {money(item.priceMax)}</td>
                        <td>{[item.deliveryProvince, item.deliveryCity].filter(Boolean).join(' ')}</td>
                        <td>{shortDate(item.createTime)}</td>
                        <td><span class="hall-tag tech">{demandStatus(item.demandStatus)}</span></td>
                        <td><button type="button" class="hall-quote" onClick={() => quote(item)}>报价</button></td>
                      </tr>)}
                  </tbody>
                </table>
              </div>}
            <div class="hall-demand-features">
              <div><strong>精准匹配</strong><span>按品类、产地与采购量匹配货源</span></div>
              <div><strong>在线议价</strong><span>报价、受理与合同在线完成</span></div>
              <div><strong>资金担保</strong><span>平台托管，确认收货后结算</span></div>
            </div>
          </section>}
      </main>

      <footer class="hall-footer" style={EMBEDDED ? {
          display: 'none'
        } : undefined}>
        <div class="hall-container">
          <span>© 2026 农业产业互联网平台 · 丰链云交易大厅</span>
          <span>商品详情与下单需登录；大厅商品来自交易域实时在售数据。</span>
        </div>
      </footer>
    </div>;
    };
  }
});
export default TradeHall;
function demandStatus(status: string): string {
  const map: Record<string, string> = {
    pending: '待匹配',
    matching: '匹配中',
    quoted: '报价中',
    completed: '已成交',
    closed: '已关闭'
  };
  return map[status] ?? status;
}
