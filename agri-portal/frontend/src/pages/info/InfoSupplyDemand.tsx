import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { infoPublicApi, money, type SupplyDemand } from './infoApi';
import { usePageMeta } from '../../utils';
import './info.css';
export const InfoSupplyDemand = defineComponent({
  name: "InfoSupplyDemand",
  props: {
    id: null as unknown as PropType<{
      id?: number;
      type?: string;
    }["id"]>,
    type: null as unknown as PropType<{
      id?: number;
      type?: string;
    }["type"]>
  },
  setup(__props: {
    id?: number;
    type?: string;
  }, {
    slots: __slots
  }) {
    return () => {
      const view_prop_id = __props.id;
      const view_prop_type = __props.type;
      return view_prop_id ? <SupplyDemandDetail id={view_prop_id} type={view_prop_type ?? 'supply'} /> : <SupplyDemandList />;
    };
  }
});
const SupplyDemandList = defineComponent({
  name: "SupplyDemandList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const items = ref<SupplyDemand[]>([]);
    const setItems = (next: typeof items.value | ((previous: typeof items.value) => typeof items.value)) => {
      items.value = typeof next === 'function' ? (next as (previous: typeof items.value) => typeof items.value)(items.value) : next;
    };
    const stats = ref({
      supplyCount: 0,
      demandCount: 0,
      todayCount: 0,
      matchRate: 0,
      avgResponse: 0
    });
    const setStats = (next: typeof stats.value | ((previous: typeof stats.value) => typeof stats.value)) => {
      stats.value = typeof next === 'function' ? (next as (previous: typeof stats.value) => typeof stats.value)(stats.value) : next;
    };
    const categories = ref<string[]>([]);
    const setCategories = (next: typeof categories.value | ((previous: typeof categories.value) => typeof categories.value)) => {
      categories.value = typeof next === 'function' ? (next as (previous: typeof categories.value) => typeof categories.value)(categories.value) : next;
    };
    const type = ref<'supply' | 'demand'>('supply');
    const setType = (next: typeof type.value | ((previous: typeof type.value) => typeof type.value)) => {
      type.value = typeof next === 'function' ? (next as (previous: typeof type.value) => typeof type.value)(type.value) : next;
    };
    const category = ref('');
    const setCategory = (next: typeof category.value | ((previous: typeof category.value) => typeof category.value)) => {
      category.value = typeof next === 'function' ? (next as (previous: typeof category.value) => typeof category.value)(category.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const page = ref(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    watchEffect(() => usePageMeta('供需大厅', '公开浏览供应与求购信息，联系方式与在线洽谈需登录后查看。'));
    const size = 12;
    onMounted(() => {
      watch(() => [type.value, category.value, keyword.value, page.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          let cancelled = false;
          setLoading(true);
          setError('');
          infoPublicApi.supplyDemands({
            type: type.value,
            category: category.value || undefined,
            keyword: keyword.value || undefined,
            page: page.value,
            size
          }).then(data => {
            if (cancelled) return;
            setItems(data.items ?? []);
            setStats(data.stats);
            setCategories(data.categories ?? []);
          }).catch((reason: Error) => {
            if (!cancelled) setError(reason.message);
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
    const total = computed(() => type.value === 'supply' ? stats.value.supplyCount : stats.value.demandCount);
    const pages = computed(() => Math.max(1, Math.ceil(total.value / size)));
    return () => {
      const view_stats = stats.value;
      const view_type = type.value;
      const view_category = category.value;
      const view_categories = categories.value;
      const view_keyword = keyword.value;
      const view_error = error.value;
      const view_loading = loading.value;
      const view_items = items.value;
      const view_pages = pages.value;
      const view_page = page.value;
      return <div class="info-page">
      <div class="info-section-head">
        <h2>供需大厅 <small>公开浏览 · 联系方式需登录后查看</small></h2>
        <a class="info-more" href="#/hall">去交易大厅下单 ›</a>
      </div>

      <div class="info-grid-4" style={{
          marginBottom: "20px"
        }}>
        <div class="info-card">
          <div class="small gray">供应信息</div>
          <div style={{
              fontSize: "22px",
              fontWeight: 700
            }}>{view_stats.supplyCount}</div>
        </div>
        <div class="info-card">
          <div class="small gray">求购信息</div>
          <div style={{
              fontSize: "22px",
              fontWeight: 700
            }}>{view_stats.demandCount}</div>
        </div>
        <div class="info-card">
          <div class="small gray">撮合活跃度</div>
          <div style={{
              fontSize: "22px",
              fontWeight: 700
            }}>{view_stats.matchRate}%</div>
        </div>
        <div class="info-card">
          <div class="small gray">平均响应</div>
          <div style={{
              fontSize: "22px",
              fontWeight: 700
            }}>{view_stats.avgResponse} 天</div>
        </div>
      </div>

      <div class="info-filter">
        <div class="info-chips">
          <button type="button" class={`info-chip${view_type === 'supply' ? ' on' : ''}`} onClick={() => {
              setType('supply');
              setPage(1);
            }}>
            供应
          </button>
          <button type="button" class={`info-chip${view_type === 'demand' ? ' on' : ''}`} onClick={() => {
              setType('demand');
              setPage(1);
            }}>
            求购
          </button>
        </div>
        <label style={{
            marginLeft: "12px"
          }}>品类</label>
        <div class="info-chips">
          <button type="button" class={`info-chip${view_category === '' ? ' on' : ''}`} onClick={() => {
              setCategory('');
              setPage(1);
            }}>全部</button>
          {view_categories.slice(0, 8).map(item => <button type="button" key={item} class={`info-chip${view_category === item ? ' on' : ''}`} onClick={() => {
              setCategory(item);
              setPage(1);
            }}>
              {item}
            </button>)}
        </div>
        <input value={view_keyword} placeholder="搜品种 / 产地" onInput={event => setKeyword((event.target as HTMLInputElement).value)} style={{
            marginLeft: 'auto',
            width: "180px"
          }} />
      </div>

      {view_error && <div class="info-error">{view_error}</div>}
      {view_loading && <div class="info-loading">正在加载供需信息…</div>}
      {!view_loading && view_items.length === 0 && !view_error && <div class="info-empty">暂无{view_type === 'supply' ? '供应' : '求购'}信息</div>}

      <div class="info-grid-3">
        {view_items.map(item => <a class="info-tile" href={`#/info/supply-demand/${item.id}?type=${item.sdType}`} key={item.id}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span class={`info-chip ${item.sdType === 'supply' ? '' : 'gray'}`}>
                {item.sdType === 'supply' ? '供应' : '求购'}
              </span>
              <span class="small gray">{item.origin}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.spec || item.marketRef || item.variety}</p>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: "4px"
            }}>
              <b style={{
                fontSize: "17px",
                color: 'var(--danger)'
              }}>{item.price > 0 ? <>{money(item.price)} <span class="small gray">{item.priceUnit}</span></> : '面议'}</b>
              <span class="small gray">{item.quantity}</span>
            </div>
            <div class="small gray" style={{
              marginTop: "2px"
            }}>{item.orgName}</div>
          </a>)}
      </div>

      {view_pages > 1 && <div class="info-chips" style={{
          justifyContent: 'center',
          marginTop: "20px"
        }}>
          <button type="button" class="info-chip" disabled={view_page <= 1} onClick={() => setPage(view_page - 1)}>上一页</button>
          <span class="small gray" style={{
            alignSelf: 'center'
          }}>{view_page} / {view_pages}</span>
          <button type="button" class="info-chip" disabled={view_page >= view_pages} onClick={() => setPage(view_page + 1)}>下一页</button>
        </div>}
    </div>;
    };
  }
});
const SupplyDemandDetail = defineComponent({
  name: "SupplyDemandDetail",
  props: {
    id: null as unknown as PropType<{
      id: number;
      type: string;
    }["id"]>,
    type: null as unknown as PropType<{
      id: number;
      type: string;
    }["type"]>
  },
  setup(__props: {
    id: number;
    type: string;
  }, {
    slots: __slots
  }) {
    const detail = ref<(SupplyDemand & {
      matches?: unknown[];
    }) | null>(null);
    const setDetail = (next: typeof detail.value | ((previous: typeof detail.value) => typeof detail.value)) => {
      detail.value = typeof next === 'function' ? (next as (previous: typeof detail.value) => typeof detail.value)(detail.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    watchEffect(() => usePageMeta(detail.value?.title ?? '供需详情', detail.value ? [detail.value.category, detail.value.quantity, detail.value.origin].filter(Boolean).join(' · ') : undefined));
    onMounted(() => {
      watch(() => [__props.id, __props.type], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          let cancelled = false;
          setLoading(true);
          setError('');
          infoPublicApi.supplyDemand(__props.id, __props.type).then(data => {
            if (!cancelled) setDetail(data);
          }).catch((reason: Error) => {
            if (!cancelled) setError(reason.message);
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
    return () => {
      const view_loading = loading.value;
      const view_error = error.value;
      const view_detail = detail.value;
      if (view_loading) return <div class="info-page"><div class="info-loading">正在加载…</div></div>;
      if (view_error || !view_detail) {
        return <div class="info-page">
        <a class="info-back" href="#/info/supply-demand">‹ 返回供需大厅</a>
        <div class="info-error">{view_error || '信息不存在或已下架'}</div>
      </div>;
      }
      return <div class="info-page">
      <a class="info-back" href="#/info/supply-demand">‹ 返回供需大厅</a>

      <div class="info-card">
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: "10px",
            marginBottom: "10px"
          }}>
          <span class={`info-chip ${view_detail.sdType === 'supply' ? '' : 'gray'}`}>
            {view_detail.sdType === 'supply' ? '供应' : '求购'}
          </span>
          <span class="small gray">编号 {view_detail.sdNo}</span>
          {view_detail.verified && <span class="info-chip gray">已认证</span>}
        </div>

        <h2 style={{
            margin: '0 0 14px',
            fontSize: "22px",
            fontWeight: 700
          }}>{view_detail.title}</h2>

        <table class="info-table" style={{
            marginBottom: "18px"
          }}>
          <tbody>
            <tr><td style={{
                  width: "110px"
                }} class="gray">品类 / 品种</td><td>{[view_detail.category, view_detail.variety].filter(Boolean).join(' · ') || '—'}</td></tr>
            <tr><td class="gray">数量</td><td>{view_detail.quantity}</td></tr>
            <tr><td class="gray">价格</td><td style={{
                  color: 'var(--danger)',
                  fontWeight: 600
                }}>{view_detail.price > 0 ? `${money(view_detail.price)} ${view_detail.priceUnit}` : '面议'}</td></tr>
            <tr><td class="gray">产地 / 地区</td><td>{view_detail.origin || '—'}</td></tr>
            <tr><td class="gray">规格说明</td><td>{view_detail.spec || '—'}</td></tr>
            <tr><td class="gray">发布单位</td><td>{view_detail.orgName}</td></tr>
            <tr><td class="gray">行情参考</td><td>{view_detail.marketRef || '—'}</td></tr>
          </tbody>
        </table>

        <div class="info-card" style={{
            background: 'var(--green-050)',
            borderColor: 'var(--green-100)'
          }}>
          <div style={{
              fontWeight: 600,
              marginBottom: "6px"
            }}>
            联系方式：{view_detail.contactMasked ? '登录后可见' : view_detail.contactName ?? '—'}
          </div>
          <div class="small gray" style={{
              marginBottom: "14px",
              lineHeight: 1.75
            }}>
            {view_detail.contactMasked ? view_detail.sdType === 'supply' ? '门户开放浏览，联系方式与在线洽谈需登录平台账号。登录后还能看到智能匹配结果，直接发起询价。' : '这是采购方发布的求购信息。登录后可联系采购方、提交报价，或查看与之匹配的货源。' : `联系电话：${view_detail.contactPhone ?? '—'}`}
          </div>
          <div class="info-chips">
            <a class="info-chip on" href="#/hall">
              {view_detail.sdType === 'supply' ? '登录后联系供应商' : '登录后联系采购方'}
            </a>
            <a class="info-chip" href="#/info/supply-demand">看更多同类信息</a>
          </div>
        </div>
      </div>

      <p class="portal-data-note" style={{
          marginTop: "18px"
        }}>
        该信息与交易撮合模块同源，卖家/买家中心可查看同一份数据；正式询价、洽谈与下单请在交易大厅完成。
      </p>
    </div>;
    };
  }
});
