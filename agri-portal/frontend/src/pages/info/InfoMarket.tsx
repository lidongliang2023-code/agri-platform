import { defineComponent, ref, shallowRef, computed, watch as vueWatch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { PortalPageHero } from '../../components/PortalPageHero';
import { infoPublicApi, money, signed, trendClass, type PriceIndex, type Quote } from './infoApi';
import { usePageMeta } from '../../utils';
import './info.css';
import './market.css';
type MarketData = Awaited<ReturnType<typeof infoPublicApi.markets>>;
type Detail = Awaited<ReturnType<typeof infoPublicApi.market>>;
type Sort = 'updated' | 'up' | 'down' | 'week' | 'month';
const WATCH_KEY = 'portal-market-watch-v1';
const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const pct = (n?: number) => valid(n) ? signed(n) : '—';
const amount = (n?: number) => valid(n) ? money(n) : '—';
function timestamp(value?: string): number {
  if (!value) return NaN;
  const parsed = value.replace(' ', 'T');
  return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(parsed) ? parsed : `${parsed}+08:00`);
}
function freshness(value?: string): string {
  const time = timestamp(value);
  if (!Number.isFinite(time)) return '时间未提供';
  const age = Date.now() - time;
  if (age < 0) return '时间待核验';
  return age > 72 * 3600000 ? '超过72小时' : age > 24 * 3600000 ? '超过24小时' : '24小时内';
}
const comparable = (a: Quote, b: Quote) => Boolean(a.name && a.spec && a.priceUnit) && a.name === b.name && a.category === b.category && a.spec === b.spec && a.priceUnit === b.priceUnit;
const tradeLink = (name: string, purchase = false) => `#/hall?q=${encodeURIComponent(name)}${purchase ? '&tab=purchase' : ''}`;
const unique = (items: Quote[], field: 'category' | 'market' | 'origin' | 'source') => [...new Set(items.map(q => q[field]).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
function readWatch(): number[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(WATCH_KEY) || '[]');
    return Array.isArray(data) ? data.filter(valid) : [];
  } catch {
    return [];
  }
}
function downloadQuotes(items: Quote[]) {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = [['品种', '品类', '规格', '产地', '市场', '报价', '单位', '涨跌幅(%)', '周涨跌(%)', '月涨跌(%)', '来源', '采集时间', '数据时效'], ...items.map(q => [q.name, q.category, q.spec, q.origin, q.market, q.price, q.priceUnit, q.changePct, q.weekPct, q.monthPct, q.source, q.updatedAt, freshness(q.updatedAt)])];
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], {
    type: 'text/csv;charset=utf-8'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = '价格行情_筛选结果.csv';
  a.click();
  URL.revokeObjectURL(url);
}
const Sparkline = defineComponent({
  name: "Sparkline",
  props: {
    values: null as unknown as PropType<{
      values: number[];
      label: string;
    }["values"]>,
    label: null as unknown as PropType<{
      values: number[];
      label: string;
    }["label"]>
  },
  setup(__props: {
    values: number[];
    label: string;
  }, {
    slots: __slots
  }) {
    const points = computed(() => __props.values.filter(valid));
    return () => {
      const view_points = points.value;
      const view_prop_label = __props.label;
      if (view_points.length < 2) return <div class="market-chart-empty">暂无可展示的走势序列</div>;
      const low = Math.min(...view_points),
        high = Math.max(...view_points),
        span = high - low || 1;
      const path = view_points.map((v, i) => `${24 + i / (view_points.length - 1) * 552},${140 - (v - low) / span * 112}`).join(' ');
      return <svg class="market-chart" viewBox="0 0 600 165" role="img" aria-label={`${view_prop_label}，${view_points.length}期，最低${amount(low)}，最高${amount(high)}`}>
    {[28, 84, 140].map(y => <line key={y} x1="24" y1={y} x2="576" y2={y} stroke="var(--line)" stroke-dasharray="4 5" />)}
    <polyline points={path} fill="none" stroke="var(--green-600)" stroke-width="3" stroke-linejoin="round" />
    {view_points.map((v, i) => <circle key={i} cx={24 + i / (view_points.length - 1) * 552} cy={140 - (v - low) / span * 112} r="3" fill="var(--green-600)"><title>第{i + 1}期：{amount(v)}</title></circle>)}
    <text x="24" y="161" fill="currentColor" font-size="11">首期 {amount(view_points[0])}</text><text x="576" y="161" text-anchor="end" fill="currentColor" font-size="11">末期 {amount(view_points[view_points.length - 1])}</text>
  </svg>;
    };
  }
});
export const InfoMarket = defineComponent({
  name: "InfoMarket",
  props: {
    id: null as unknown as PropType<{
      id?: number;
    }["id"]>
  },
  setup(__props: {
    id?: number;
  }, {
    slots: __slots
  }) {
    return () => {
      const view_prop_id = __props.id;
      return view_prop_id ? <MarketDetail key={view_prop_id} id={view_prop_id} /> : <MarketList />;
    };
  }
});
const MarketList = defineComponent({
  name: "MarketList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const data = ref<MarketData>({});
    const setData = (next: typeof data.value | ((previous: typeof data.value) => typeof data.value)) => {
      data.value = typeof next === 'function' ? (next as (previous: typeof data.value) => typeof data.value)(data.value) : next;
    };
    const indices = ref<PriceIndex[]>([]);
    const setIndices = (next: typeof indices.value | ((previous: typeof indices.value) => typeof indices.value)) => {
      indices.value = typeof next === 'function' ? (next as (previous: typeof indices.value) => typeof indices.value)(indices.value) : next;
    };
    const selectedIndex = ref<number | undefined>(undefined);
    const setSelectedIndex = (next: typeof selectedIndex.value | ((previous: typeof selectedIndex.value) => typeof selectedIndex.value)) => {
      selectedIndex.value = typeof next === 'function' ? (next as (previous: typeof selectedIndex.value) => typeof selectedIndex.value)(selectedIndex.value) : next;
    };
    const loading = ref(true),
      error = ref(''),
      indexError = ref('');
    const setIndexError = (next: typeof indexError.value | ((previous: typeof indexError.value) => typeof indexError.value)) => {
      indexError.value = typeof next === 'function' ? (next as (previous: typeof indexError.value) => typeof indexError.value)(indexError.value) : next;
    };
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const refresh = ref(0);
    const setRefresh = (next: typeof refresh.value | ((previous: typeof refresh.value) => typeof refresh.value)) => {
      refresh.value = typeof next === 'function' ? (next as (previous: typeof refresh.value) => typeof refresh.value)(refresh.value) : next;
    };
    const category = ref(''),
      keyword = ref(''),
      market = ref(''),
      origin = ref(''),
      source = ref('');
    const setSource = (next: typeof source.value | ((previous: typeof source.value) => typeof source.value)) => {
      source.value = typeof next === 'function' ? (next as (previous: typeof source.value) => typeof source.value)(source.value) : next;
    };
    const setOrigin = (next: typeof origin.value | ((previous: typeof origin.value) => typeof origin.value)) => {
      origin.value = typeof next === 'function' ? (next as (previous: typeof origin.value) => typeof origin.value)(origin.value) : next;
    };
    const setMarket = (next: typeof market.value | ((previous: typeof market.value) => typeof market.value)) => {
      market.value = typeof next === 'function' ? (next as (previous: typeof market.value) => typeof market.value)(market.value) : next;
    };
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const setCategory = (next: typeof category.value | ((previous: typeof category.value) => typeof category.value)) => {
      category.value = typeof next === 'function' ? (next as (previous: typeof category.value) => typeof category.value)(category.value) : next;
    };
    const direction = ref(''),
      fresh = ref(false),
      watchOnly = ref(false);
    const setWatchOnly = (next: typeof watchOnly.value | ((previous: typeof watchOnly.value) => typeof watchOnly.value)) => {
      watchOnly.value = typeof next === 'function' ? (next as (previous: typeof watchOnly.value) => typeof watchOnly.value)(watchOnly.value) : next;
    };
    const setFresh = (next: typeof fresh.value | ((previous: typeof fresh.value) => typeof fresh.value)) => {
      fresh.value = typeof next === 'function' ? (next as (previous: typeof fresh.value) => typeof fresh.value)(fresh.value) : next;
    };
    const setDirection = (next: typeof direction.value | ((previous: typeof direction.value) => typeof direction.value)) => {
      direction.value = typeof next === 'function' ? (next as (previous: typeof direction.value) => typeof direction.value)(direction.value) : next;
    };
    const watch = ref<number[]>(readWatch()),
      selected = ref<number[]>([]);
    const setSelected = (next: typeof selected.value | ((previous: typeof selected.value) => typeof selected.value)) => {
      selected.value = typeof next === 'function' ? (next as (previous: typeof selected.value) => typeof selected.value)(selected.value) : next;
    };
    const setWatch = (next: typeof watch.value | ((previous: typeof watch.value) => typeof watch.value)) => {
      watch.value = typeof next === 'function' ? (next as (previous: typeof watch.value) => typeof watch.value)(watch.value) : next;
    };
    const sort = ref<Sort>('updated'),
      page = ref(1),
      notice = ref('');
    const setNotice = (next: typeof notice.value | ((previous: typeof notice.value) => typeof notice.value)) => {
      notice.value = typeof next === 'function' ? (next as (previous: typeof notice.value) => typeof notice.value)(notice.value) : next;
    };
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const setSort = (next: typeof sort.value | ((previous: typeof sort.value) => typeof sort.value)) => {
      sort.value = typeof next === 'function' ? (next as (previous: typeof sort.value) => typeof sort.value)(sort.value) : next;
    };
    watchEffect(() => usePageMeta('价格指数 · 行业交易大数据', '农产品价格指数、现货行情、同口径比价与交易决策服务。'));
    onMounted(() => {
      vueWatch(() => [refresh.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          let cancelled = false;
          setLoading(true);
          setError('');
          setIndexError('');
          Promise.allSettled([infoPublicApi.markets(), infoPublicApi.indices()]).then(([quotes, published]) => {
            if (cancelled) return;
            if (quotes.status === 'fulfilled') setData(quotes.value);else {
              setData({});
              setError(quotes.reason instanceof Error ? quotes.reason.message : '行情加载失败');
            }
            if (published.status === 'fulfilled') setIndices(published.value);else {
              setIndices([]);
              setIndexError('指数服务暂不可用，可刷新重试。');
            }
            setLoading(false);
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
    const all = computed(() => data.value.quotes ?? []);
    const filtered = computed(() => {
      const word = keyword.value.trim().toLowerCase();
      return all.value.filter(q => (!category.value || q.category === category.value) && (!market.value || q.market === market.value) && (!origin.value || q.origin === origin.value) && (!source.value || q.source === source.value) && (!word || [q.name, q.code, q.origin, q.market, q.spec].some(v => v?.toLowerCase().includes(word))) && (!fresh.value || freshness(q.updatedAt) === '24小时内') && (!watchOnly.value || watch.value.includes(q.id)) && (!direction.value || (direction.value === 'up' ? valid(q.changePct) && q.changePct > 0 : direction.value === 'down' ? valid(q.changePct) && q.changePct < 0 : direction.value === 'abnormal' ? q.monitorLevel === 'abnormal' : q.changePct === 0))).sort((a, b) => {
        if (sort.value === 'updated') return (timestamp(b.updatedAt) || 0) - (timestamp(a.updatedAt) || 0) || a.id - b.id;
        const field = sort.value === 'week' ? 'weekPct' : sort.value === 'month' ? 'monthPct' : 'changePct';
        const av = a[field],
          bv = b[field];
        if (!valid(av)) return valid(bv) ? 1 : a.id - b.id;
        if (!valid(bv)) return -1;
        return (sort.value === 'down' ? av - bv : bv - av) || a.id - b.id;
      });
    });
    onMounted(() => {
      vueWatch(() => [category.value, keyword.value, market.value, origin.value, source.value, fresh.value, watchOnly.value, direction.value, sort.value, refresh.value], (_next, _previous, onCleanup) => {
        const dispose = (() => setPage(1))();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / 15))),
      current = computed(() => Math.min(page.value, pageCount.value));
    const visible = computed(() => filtered.value.slice((current.value - 1) * 15, current.value * 15));
    const compared = computed(() => all.value.filter(q => selected.value.includes(q.id)));
    const index = computed(() => indices.value.find(i => i.id === selectedIndex.value) ?? indices.value[0]);
    const latest = computed(() => all.value.filter(q => Number.isFinite(timestamp(q.updatedAt))).sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))[0]?.updatedAt);
    const counts = computed(() => ({
      up: filtered.value.filter(q => valid(q.changePct) && q.changePct > 0).length,
      down: filtered.value.filter(q => valid(q.changePct) && q.changePct < 0).length,
      abnormal: filtered.value.filter(q => q.monitorLevel === 'abnormal').length
    }));
    function toggleWatch(id: number) {
      const next = watch.value.includes(id) ? watch.value.filter(v => v !== id) : [...watch.value, id];
      setWatch(next);
      try {
        localStorage.setItem(WATCH_KEY, JSON.stringify(next));
        setNotice('关注清单已保存在当前浏览器，不会跨设备同步。');
      } catch {
        setNotice('浏览器存储不可用，本次关注仅在当前页面有效。');
      }
    }
    function toggleCompare(q: Quote) {
      if (selected.value.includes(q.id)) {
        setSelected(selected.value.filter(id => id !== q.id));
        return;
      }
      if (compared.value.length >= 4) {
        setNotice('最多同时对比4条报价。');
        return;
      }
      if (!q.spec || !q.priceUnit) {
        setNotice('该报价缺少规格或单位，暂不参与专业比价。');
        return;
      }
      if (compared.value.length && !comparable(compared.value[0], q)) {
        setNotice('请仅选择同品种、同品类、同规格、同单位的报价。清空后可重新选择。');
        return;
      }
      setSelected([...selected.value, q.id]);
      setNotice('');
    }
    function reset() {
      setCategory('');
      setKeyword('');
      setMarket('');
      setOrigin('');
      setSource('');
      setDirection('');
      setFresh(false);
      setWatchOnly(false);
      setSort('updated');
      setPage(1);
    }
    return () => {
      const view_loading = loading.value;
      const view_filtered = filtered.value;
      const view_latest = latest.value;
      const view_indexError = indexError.value;
      const view_indices = indices.value;
      const view_index = index.value;
      const view_category = category.value;
      const view_all = all.value;
      const view_keyword = keyword.value;
      const view_market = market.value;
      const view_origin = origin.value;
      const view_source = source.value;
      const view_direction = direction.value;
      const view_sort = sort.value;
      const view_fresh = fresh.value;
      const view_watchOnly = watchOnly.value;
      const view_watch = watch.value;
      const view_notice = notice.value;
      const view_error = error.value;
      const view_visible = visible.value;
      const view_selected = selected.value;
      const view_current = current.value;
      const view_pageCount = pageCount.value;
      const view_compared = compared.value;
      return <div class="info-page info-market-page portal-channel-page market-workbench">
    <PortalPageHero badge="行业交易大数据 · 价格服务" title="价格指数" description="从行业指数到品种报价，按品类、产地与市场精准发现价格变化，让采购、销售与履约决策有据可依。">
      <div class="portal-page-hero-actions"><button type="button" class="btn portal-page-btn-light" onClick={() => document.getElementById('market-quotes')?.scrollIntoView({
              behavior: 'smooth'
            })}>查询现货行情 ↓</button><a class="btn portal-page-btn-ghost" href="#/hall">进入交易大厅 →</a></div>
    </PortalPageHero>
    <div class="market-toolbar"><span>价格监测 / 指数分析 / 同口径比价</span><button type="button" class="info-chip" disabled={view_loading} onClick={() => setRefresh(v => v + 1)}>{view_loading ? '更新中…' : '刷新数据'}</button></div>
    <div class="market-summary" aria-label="当前筛选范围统计">
      <div><span>匹配报价</span><strong>{view_filtered.length}<small>条</small></strong></div><div><span>上涨 / 下跌</span><strong><b class="up">{counts.value.up}</b> / <b class="down">{counts.value.down}</b></strong></div><div><span>监测异常</span><strong>{counts.value.abnormal}<small>条</small></strong></div><div><span>最新采集时间（北京时间）</span><strong class="market-time">{view_latest ?? '尚无有效时间'}</strong></div>
    </div>
    <section class="info-section" aria-label="已发布价格指数">
      <div class="info-section-head"><h2>行业价格指数 <small>运营发布口径</small></h2><span class="small gray">指数点位与现货价格分别展示</span></div>
      {view_indexError && <div class="info-error">{view_indexError}</div>}
      {!view_loading && !view_indexError && !view_indices.length && <div class="info-empty">暂无已发布指数</div>}
      {!!view_indices.length && <><div class="market-index-grid">{view_indices.map(i => <button type="button" key={i.id} class={`market-index-select${view_index?.id === i.id ? ' active' : ''}`} onClick={() => setSelectedIndex(i.id)} aria-pressed={view_index?.id === i.id}><span>{i.name}</span><strong>{amount(i.value)}<small>点</small></strong><span class={trendClass(i.changePct)}>{pct(i.changePct)}</span><small>基期：{i.basePeriod || '未披露'}</small></button>)}</div>
      {view_index && <div class="info-card market-index-detail"><div><h3>{view_index.name} · 走势序列</h3><p class="small gray">发布于 {view_index.publishedAt || '未披露'} · {freshness(view_index.publishedAt)}</p><Sparkline values={view_index.trend ?? []} label={view_index.name} /><p class="small gray">按接口原始期序展示；未提供逐期日期，不标注为日线。</p></div><dl class="market-method"><dt>基期</dt><dd>{view_index.basePeriod || '未披露'}</dd><dt>样本量</dt><dd>{view_index.sampleCount ?? '未披露'}</dd><dt>编制方法</dt><dd>{view_index.method || '未披露'}</dd><dt>使用边界</dt><dd>展示已发布指数；当前接口未提供成分权重与逐期明细，暂不据此计算贡献度或成交额加权指数。</dd></dl></div>}</>}
    </section>
    <section class="info-section" id="market-quotes">
      <div class="info-section-head"><h2>现货行情 <small>精准筛选 · 快速比价</small></h2><button class="info-chip" disabled={!view_filtered.length || view_loading} onClick={() => downloadQuotes(view_filtered)}>导出筛选结果</button></div>
      <div class="market-filter-panel">
        <div class="info-chips"><span>品类</span><button class={`info-chip${!view_category ? ' on' : ''}`} onClick={() => setCategory('')}>全部</button>{unique(view_all, 'category').map(c => <button key={c} class={`info-chip${view_category === c ? ' on' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div class="market-filter-fields"><label>关键词<input value={view_keyword} onInput={e => setKeyword((e.target as HTMLInputElement).value)} placeholder="品种 / 规格 / 产地 / 编码" /></label>
          {([{
                title: '交易市场',
                field: 'market',
                value: view_market,
                change: setMarket
              }, {
                title: '产地',
                field: 'origin',
                value: view_origin,
                change: setOrigin
              }, {
                title: '数据来源',
                field: 'source',
                value: view_source,
                change: setSource
              }] as const).map(f => <label key={f.field}>{f.title}<select value={f.value} onChange={e => f.change((e.target as HTMLInputElement).value)}><option value="">全部</option>{unique(view_all, f.field).map(v => <option key={v}>{v}</option>)}</select></label>)}
          <label>价格变化<select value={view_direction} onChange={e => setDirection((e.target as HTMLInputElement).value)}><option value="">全部变化</option><option value="up">上涨</option><option value="down">下跌</option><option value="flat">持平</option><option value="abnormal">监测异常</option></select></label>
          <label>排序<select value={view_sort} onChange={e => setSort((e.target as HTMLInputElement).value as Sort)}><option value="updated">最新采集</option><option value="up">涨幅优先</option><option value="down">跌幅优先</option><option value="week">周涨幅优先</option><option value="month">月涨幅优先</option></select></label>
        </div><div class="market-filter-bottom"><label><input type="checkbox" checked={view_fresh} onInput={e => setFresh((e.target as HTMLInputElement).checked)} />仅24小时内报价</label><label><input type="checkbox" checked={view_watchOnly} onInput={e => setWatchOnly((e.target as HTMLInputElement).checked)} />本机关注（{view_all.filter(q => view_watch.includes(q.id)).length}）</label><button class="info-chip" onClick={reset}>重置筛选</button><span class="small gray">统计、排序和导出均跟随当前筛选</span></div>
      </div>
      {view_notice && <div class="market-notice" role="status">{view_notice}<button onClick={() => setNotice('')} aria-label="关闭提示">×</button></div>}
      {view_error && <div class="info-error" role="alert">{view_error} <button class="info-chip" onClick={() => setRefresh(v => v + 1)}>重试</button></div>}
      {view_loading ? <div class="info-loading">正在加载报价与指数…</div> : !view_error && <><div class="market-table-scroll"><table class="info-table market-data-table"><caption class="market-sr-only">农产品现货报价，支持关注、比价及交易查询</caption><thead><tr><th>比价</th><th>品种 / 规格</th><th>产地 / 市场</th><th class="num">报价</th><th class="num">涨跌幅</th><th class="num">周 / 月涨跌</th><th>来源 / 采集时间</th><th>操作</th></tr></thead><tbody>{view_visible.map(q => <tr key={q.id}><td><input type="checkbox" checked={view_selected.includes(q.id)} onInput={() => toggleCompare(q)} aria-label={`对比${q.name} ${q.market ?? q.origin ?? ''}`} /></td><td><a href={`#/info/market/${q.id}`}><strong>{q.name}</strong></a><small>{q.category || '品类未披露'} · {q.spec || '规格未披露'}</small></td><td>{q.origin || '产地未披露'}<small>{q.market || '市场未披露'}</small></td><td class="num"><strong>{amount(q.price)}</strong><small>{q.priceUnit || '单位未披露'}</small></td><td class={`num ${trendClass(q.changePct)}`}>{pct(q.changePct)}{q.monitorLevel === 'abnormal' && <small class="market-warning">监测异常</small>}</td><td class="num"><span class={trendClass(q.weekPct)}>{pct(q.weekPct)}</span><small class={trendClass(q.monthPct)}>{pct(q.monthPct)}</small></td><td>{q.source || '来源未披露'}<small>{q.updatedAt || '时间未披露'} · {freshness(q.updatedAt)}</small></td><td><div class="market-row-actions"><button aria-pressed={view_watch.includes(q.id)} onClick={() => toggleWatch(q.id)}>{view_watch.includes(q.id) ? '已关注' : '关注'}</button><a href={tradeLink(q.name)}>找货源</a><a href={tradeLink(q.name, true)}>找采购</a></div></td></tr>)}</tbody></table>{!view_filtered.length && <div class="info-empty">没有匹配报价，请调整筛选或刷新数据。</div>}</div><div class="market-pagination"><span>共 {view_filtered.length} 条 · 第 {view_current} / {view_pageCount} 页</span><button class="info-chip" disabled={view_current <= 1} onClick={() => setPage(view_current - 1)}>上一页</button><button class="info-chip" disabled={view_current >= view_pageCount} onClick={() => setPage(view_current + 1)}>下一页</button></div></>}
    </section>
    <section class="info-section" aria-label="同口径报价对比"><div class="info-section-head"><h2>同口径比价 <small>已选 {view_compared.length} / 4 条</small></h2><button class="info-chip" disabled={!view_selected.length} onClick={() => setSelected([])}>清空对比</button></div><div class="info-card">
      {view_compared.length < 2 ? <p class="small gray">在行情列表中勾选至少两条同品种、同规格、同单位报价进行比较。缺少规格或单位的数据暂不参与。</p> : <><div class="market-compare-list">{view_compared.map(q => <div key={q.id}><a href={`#/info/market/${q.id}`}>{q.name} · {q.market || q.origin}</a><span>{q.spec}</span><strong>{amount(q.price)} {q.priceUnit}</strong><span>{q.updatedAt} · {freshness(q.updatedAt)}</span><button class="info-chip" onClick={() => toggleCompare(q)}>移除</button></div>)}</div><p class="market-notice">所选报价价差：{amount(Math.max(...view_compared.map(q => q.price)) - Math.min(...view_compared.map(q => q.price)))} {view_compared[0].priceUnit}。采集时点可能不同，价差不包含物流、税费或等级差异，不代表可成交套利收益。</p></>}
    </div></section>
    <section class="info-section market-service-links"><a href="#/hall"><strong>交易撮合 →</strong><span>按品种查找货源与采购需求</span></a><a href="#/logistics"><strong>物流服务 →</strong><span>查询运输服务，评估履约成本</span></a><a href="#/finance"><strong>供应链金融 →</strong><span>了解采购与经营融资服务</span></a><a href="#/quality-trace"><strong>质量溯源 →</strong><span>核验单品码与质量履历</span></a></section>
    <div class="market-disclosure"><strong>数据口径与服务边界</strong><p>现货报价来源于资讯域的在线监测记录，并非交易域的已成交价格。涨跌、周/月变化沿用上游字段；未提供比较基准的字段不另行推算。指数采用已发布值，不用异类报价平均替代。超过24/72小时的数据保留采集时间提示；关注保存在当前浏览器。数据用于行业研究与交易询价参考，实际价格以双方确认结果为准。</p></div>
  </div>;
    };
  }
});
const MarketDetail = defineComponent({
  name: "MarketDetail",
  props: {
    id: null as unknown as PropType<{
      id: number;
    }["id"]>
  },
  setup(__props: {
    id: number;
  }, {
    slots: __slots
  }) {
    const quote = ref<Detail | null>(null),
      loading = ref(true),
      error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const setQuote = (next: typeof quote.value | ((previous: typeof quote.value) => typeof quote.value)) => {
      quote.value = typeof next === 'function' ? (next as (previous: typeof quote.value) => typeof quote.value)(quote.value) : next;
    };
    const period = ref(30),
      refresh = ref(0);
    const setRefresh = (next: typeof refresh.value | ((previous: typeof refresh.value) => typeof refresh.value)) => {
      refresh.value = typeof next === 'function' ? (next as (previous: typeof refresh.value) => typeof refresh.value)(refresh.value) : next;
    };
    const setPeriod = (next: typeof period.value | ((previous: typeof period.value) => typeof period.value)) => {
      period.value = typeof next === 'function' ? (next as (previous: typeof period.value) => typeof period.value)(period.value) : next;
    };
    watchEffect(() => usePageMeta(quote.value ? `${quote.value.name}价格分析` : '品种价格分析', '品种报价、历史观测、区域比价与交易服务。'));
    onMounted(() => {
      vueWatch(() => [__props.id, refresh.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          let cancelled = false;
          setLoading(true);
          setError('');
          setQuote(null);
          infoPublicApi.market(__props.id).then(v => {
            if (!cancelled) setQuote(v);
          }).catch((e: Error) => {
            if (!cancelled) setError(e.message);
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
    const history = computed(() => {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - period.value + 1);
      const first = cutoff.toISOString().slice(0, 10);
      const byDate = new Map<string, NonNullable<Detail['series']>[number]>();
      for (const point of quote.value?.series ?? []) if (!point.forecast && valid(point.price) && /^\d{4}-\d{2}-\d{2}$/.test(point.date) && point.date >= first && point.date <= new Date().toLocaleDateString('sv-SE', {
        timeZone: 'Asia/Shanghai'
      })) byDate.set(point.date, point);
      return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    });
    return () => {
      const view_quote = quote.value;
      const view_loading = loading.value;
      const view_error = error.value;
      const view_period = period.value;
      const view_history = history.value;
      return <div class="info-page info-market-page portal-channel-page market-workbench"><PortalPageHero badge="价格指数 · 品种分析" title={view_quote ? `${view_quote.name}价格分析` : '品种价格分析'} description="查清价格来源与时间，在同品种、同规格和同单位下比较报价，联动采购与履约服务。"><div class="portal-page-hero-actions"><a class="btn portal-page-btn-ghost" href="#/info/market">← 返回价格指数</a>{view_quote && <a class="btn portal-page-btn-light" href={tradeLink(view_quote.name)}>查询同品种货源 →</a>}</div></PortalPageHero>
    {view_loading && <div class="info-loading">正在加载品种行情…</div>}{view_error && <div class="info-error" role="alert">{view_error} <button class="info-chip" onClick={() => setRefresh(v => v + 1)}>重试</button></div>}
    {view_quote && !view_loading && <><section class="info-card market-detail-overview"><div><h2>{view_quote.name} <small>{view_quote.spec || '规格未披露'}</small></h2><strong class="market-price-large">{amount(view_quote.price)} <small>{view_quote.priceUnit || '单位未披露'}</small></strong><span class={trendClass(view_quote.changePct)}>涨跌幅 {pct(view_quote.changePct)}</span></div><dl class="market-method"><dt>品类 / 产地</dt><dd>{view_quote.category || '—'} / {view_quote.origin || '—'}</dd><dt>市场 / 来源</dt><dd>{view_quote.market || '—'} / {view_quote.source || '未披露'}</dd><dt>采集时间</dt><dd>{view_quote.updatedAt || '未披露'} · {freshness(view_quote.updatedAt)}</dd><dt>周 / 月涨跌</dt><dd><span class={trendClass(view_quote.weekPct)}>{pct(view_quote.weekPct)}</span> / <span class={trendClass(view_quote.monthPct)}>{pct(view_quote.monthPct)}</span></dd></dl></section>
      <section class="info-section"><div class="info-section-head"><h2>历史观测 <small>不含预测</small></h2><div class="info-chips">{[7, 30, 90].map(days => <button key={days} aria-pressed={view_period === days} class={`info-chip${view_period === days ? ' on' : ''}`} onClick={() => setPeriod(days)}>近{days}天</button>)}</div></div><div class="info-card"><Sparkline values={view_history.map(p => p.price)} label={`${view_quote.name}历史价格`} /><p class="small gray">{view_history.length ? `${view_history[0].date} 至 ${view_history[view_history.length - 1].date}，共 ${view_history.length} 个观测日。按观测期序绘制，不填补缺失日期。` : '当前区间暂无已存储的历史观测，不按最新报价生成模拟曲线。'}</p>{view_history.length > 0 && <details class="market-history"><summary>查看历史明细与区间范围</summary><p>区间最低 {amount(Math.min(...view_history.map(p => p.price)))} / 最高 {amount(Math.max(...view_history.map(p => p.price)))} {view_quote.priceUnit}</p><div class="market-table-scroll"><table class="info-table"><thead><tr><th>观测日期</th><th class="num">价格（{view_quote.priceUnit || '单位未披露'}）</th></tr></thead><tbody>{view_history.map(p => <tr key={p.date}><td>{p.date}</td><td class="num">{amount(p.price)}</td></tr>)}</tbody></table></div></details>}</div></section>
      <section class="info-section"><div class="info-section-head"><h2>同口径区域报价</h2><span class="small gray">同品种 · 同规格 · 同单位</span></div><div class="info-card">{!view_quote.spec || !view_quote.priceUnit ? <p class="small gray">当前报价规格或单位缺失，暂不展示区域比价。</p> : (view_quote.regionPrices?.length ?? 0) < 2 ? <p class="small gray">同口径报价样本不足，暂不能进行区域比较。</p> : <div class="market-table-scroll"><table class="info-table"><thead><tr><th>区域 / 市场</th><th class="num">报价</th><th class="num">涨跌幅</th><th>采集时间</th></tr></thead><tbody>{view_quote.regionPrices?.map(q => <tr key={q.id}><td>{q.region || '—'} / {q.market || '—'}</td><td class="num">{amount(q.price)} {q.priceUnit}</td><td class={`num ${trendClass(q.changePct)}`}>{pct(q.changePct)}</td><td>{q.updatedAt || '未披露'} · {freshness(q.updatedAt)}</td></tr>)}</tbody></table><p class="small gray">各地报价采集时点可能不同，未包含运费与税费。</p></div>}</div></section>
      {!!view_quote.relatedArticles?.length && <section class="info-section"><div class="info-section-head"><h2>相关行业资讯</h2></div><div class="info-card">{view_quote.relatedArticles.map(a => <a class="info-news-row" href={`#/info/news/${a.id}`} key={a.id}><strong>{a.title}</strong><span class="small gray">{a.channel} · {a.publishedAt || '发布时间未披露'}</span></a>)}</div></section>}
      <div class="market-service-links"><a href={tradeLink(view_quote.name)}><strong>找同品种货源 →</strong><span>进入交易域查询供应</span></a><a href={tradeLink(view_quote.name, true)}><strong>找采购需求 →</strong><span>查看同品种需求</span></a><a href="#/logistics"><strong>评估物流成本 →</strong><span>了解运输与履约服务</span></a><a href="#/quality-trace"><strong>核验质量履历 →</strong><span>进入单品溯源查询</span></a></div></>}
  </div>;
    };
  }
});
