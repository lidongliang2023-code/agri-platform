import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Input, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { SupplyDemand, SupplyDemandList } from '../types';
import { AiCard, ErrorBlock, LoadingBlock, PageTitle, StatTile } from '../components/ui';
export const SupplyDemandPage = defineComponent({
  name: "SupplyDemandPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const data = ref<SupplyDemandList | null>(null);
    const setData = (next: SupplyDemandList | null | ((previous: SupplyDemandList | null) => SupplyDemandList | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: SupplyDemandList | null) => SupplyDemandList | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const type = ref('all');
    const setType = (next: typeof type.value | ((previous: typeof type.value) => typeof type.value)) => {
      type.value = typeof next === 'function' ? (next as (previous: typeof type.value) => typeof type.value)(type.value) : next;
    };
    const category = ref('全部品类');
    const setCategory = (next: typeof category.value | ((previous: typeof category.value) => typeof category.value)) => {
      category.value = typeof next === 'function' ? (next as (previous: typeof category.value) => typeof category.value)(category.value) : next;
    };
    const origin = ref('全部产地');
    const setOrigin = (next: typeof origin.value | ((previous: typeof origin.value) => typeof origin.value)) => {
      origin.value = typeof next === 'function' ? (next as (previous: typeof origin.value) => typeof origin.value)(origin.value) : next;
    };
    const sort = ref('default');
    const setSort = (next: typeof sort.value | ((previous: typeof sort.value) => typeof sort.value)) => {
      sort.value = typeof next === 'function' ? (next as (previous: typeof sort.value) => typeof sort.value)(sort.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const mine = ref<{
      items: SupplyDemand[];
    } | null>(null);
    const setMine = (next: {
      items: SupplyDemand[];
    } | null | ((previous: {
      items: SupplyDemand[];
    } | null) => {
      items: SupplyDemand[];
    } | null)) => {
      mine.value = typeof next === 'function' ? (next as (previous: {
        items: SupplyDemand[];
      } | null) => {
        items: SupplyDemand[];
      } | null)(mine.value) : next;
    };
    const mineOpen = ref(false);
    const setMineOpen = (next: typeof mineOpen.value | ((previous: typeof mineOpen.value) => typeof mineOpen.value)) => {
      mineOpen.value = typeof next === 'function' ? (next as (previous: typeof mineOpen.value) => typeof mineOpen.value)(mineOpen.value) : next;
    };
    const mineLoading = ref(false);
    const setMineLoading = (next: typeof mineLoading.value | ((previous: typeof mineLoading.value) => typeof mineLoading.value)) => {
      mineLoading.value = typeof next === 'function' ? (next as (previous: typeof mineLoading.value) => typeof mineLoading.value)(mineLoading.value) : next;
    };
    const mineError = ref('');
    const setMineError = (next: typeof mineError.value | ((previous: typeof mineError.value) => typeof mineError.value)) => {
      mineError.value = typeof next === 'function' ? (next as (previous: typeof mineError.value) => typeof mineError.value)(mineError.value) : next;
    };
    const showClosed = ref(false);
    const setShowClosed = (next: typeof showClosed.value | ((previous: typeof showClosed.value) => typeof showClosed.value)) => {
      showClosed.value = typeof next === 'function' ? (next as (previous: typeof showClosed.value) => typeof showClosed.value)(showClosed.value) : next;
    };
    const openMine = (): void => {
      setMineOpen(true);
      setMineLoading(true);
      setMineError('');
      Promise.all([infoApi.mySupplyDemands('supply'), infoApi.mySupplyDemands('demand')]).then(([supply, demand]) => {
        setMine({
          items: [...(supply.items ?? []), ...(demand.items ?? [])]
        });
      }).catch((reason: Error) => setMineError(reason.message)).finally(() => setMineLoading(false));
    };
    const load = (overrides: Partial<{
      type: string;
      category: string;
      origin: string;
      sort: string;
      keyword: string;
    }> = {}): void => {
      const next = {
        type: type.value,
        category: category.value,
        origin: origin.value,
        sort: sort.value,
        keyword: keyword.value,
        ...overrides
      };
      setType(next.type);
      setCategory(next.category);
      setOrigin(next.origin);
      setSort(next.sort);
      setKeyword(next.keyword);
      setError('');
      infoApi.supplyDemands({
        type: next.type === 'all' ? undefined : next.type,
        category: next.category === '全部品类' ? undefined : next.category,
        origin: next.origin === '全部产地' ? undefined : next.origin,
        sort: next.sort === 'default' ? undefined : next.sort,
        keyword: next.keyword || undefined
      }).then(setData).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          load();
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_mine = mine.value;
      const view_showClosed = showClosed.value;
      const view_navigate = navigate.value;
      const view_type = type.value;
      const view_category = category.value;
      const view_origin = origin.value;
      const view_sort = sort.value;
      const view_keyword = keyword.value;
      const view_mineOpen = mineOpen.value;
      const view_mineLoading = mineLoading.value;
      const view_mineError = mineError.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} />;

      // 「我的发布」排序：待审核 → 在线 → 已下架/未通过。
      // 已下架通常是历史成交或主动下架的老记录，默认折叠，否则一次几十条把有效信息挤没了。
      const mineItems = view_mine?.items ?? [];
      const statusRank: Record<string, number> = {
        pending: 0,
        online: 1
      };
      const mineSorted = [...mineItems].sort((a, b) => (statusRank[a.status] ?? 2) - (statusRank[b.status] ?? 2));
      const mineClosed = mineSorted.filter(item => item.status === 'offline' || item.status === 'rejected');
      const mineVisible = view_showClosed ? mineSorted : mineSorted.filter(item => item.status !== 'offline' && item.status !== 'rejected');
      return <div class="page-stack">
      <PageTitle eyebrow="SUPPLY & DEMAND" title="供需信息大厅" description="供应与需求信息一站式撮合 · 信息经平台审核后展示（≤2 小时）· 匹配度 ≥80% 才推送撮合建议" actions={<>
            <Button onClick={openMine}>
              我的发布
            </Button>
            <Button onClick={() => view_navigate('sd-match')}>✦ 智能匹配</Button>
            <Button type="primary" onClick={() => view_navigate('sd-publish', undefined, {
            type: 'supply'
          })}>＋ 发布供应</Button>
            <Button onClick={() => view_navigate('sd-publish', undefined, {
            type: 'demand'
          })}>＋ 发布需求</Button>
          </>} />

      <div class="grid-4">
        <StatTile label="在线供应信息" value={view_data.stats.supplyCount} unit="条" note={`今日新增 ${view_data.stats.todayCount} 条`} tone="up" />
        <StatTile label="在线需求信息" value={view_data.stats.demandCount} unit="条" note="采购商实时发布" />
        <StatTile label="撮合成功率" value={view_data.stats.matchRate} unit="%" note="平台近 7 日均值" tone="up" />
        <StatTile label="平均响应时长" value={view_data.stats.avgResponse} unit="分钟" note="目标 ≤5 分钟 · 达标" />
      </div>

      <AiCard title={view_data.ai.headline} confidence={view_data.ai.confidence} actions={<>
            <Button size="small" type="primary" ghost onClick={() => view_navigate('sd-match')}>查看 {view_data.ai.suggestions} 条撮合建议</Button>
            <Button size="small" onClick={() => message.success('已开启实时撮合推送')}>开启实时撮合推送</Button>
          </>}>
        {view_data.ai.content}
      </AiCard>

      <section class="surface-card">
        <div class="row" style={{
            gap: "12px"
          }}>
          <div class="chip-row">
            {[{
                key: 'all',
                label: '全部'
              }, {
                key: 'supply',
                label: `供应（${view_data.stats.supplyCount}）`
              }, {
                key: 'demand',
                label: `需求（${view_data.stats.demandCount}）`
              }].map(item => <button type="button" key={item.key} class={`chip${view_type === item.key ? ' on' : ''}`} onClick={() => {
                setType(item.key);
                setTimeout(load, 0);
              }}>
                {item.label}
              </button>)}
          </div>
          <div style={{
              flex: 1
            }} />
          <select class="chip" value={view_category} onInput={event => {
              setCategory((event.target as HTMLInputElement).value);
              setTimeout(load, 0);
            }}>
            {['全部品类', ...view_data.categories].map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select class="chip" value={view_origin} onInput={event => {
              setOrigin((event.target as HTMLInputElement).value);
              setTimeout(load, 0);
            }}>
            {['全部产地', ...view_data.origins].map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select class="chip" value={view_sort} onInput={event => {
              setSort((event.target as HTMLInputElement).value);
              setTimeout(load, 0);
            }}>
            <option value="default">综合排序</option>
            <option value="latest">最新发布</option>
            <option value="price_asc">价格从低到高</option>
            <option value="price_desc">价格从高到低</option>
            <option value="match">匹配度优先</option>
          </select>
          <Input allowClear style={{
              width: "200px"
            }} placeholder="搜索品种 / 产地 / 发布者" value={view_keyword} onChange={event => setKeyword((event.target as HTMLInputElement).value)} onPressEnter={load} />
        </div>
      </section>

      <div class="grid-2">
        {view_data.items.map(item => <article class="sd-card" key={item.id} onClick={() => view_navigate('sd-detail', item.id)}>
            <div class="sd-card-head">
              <h3>{item.title}</h3>
              <span class={`soft-tag ${item.sdType === 'supply' ? 'tone-green' : 'tone-blue'}`}>
                {item.sdType === 'supply' ? '供应' : '需求'}
              </span>
              {item.isTop && <span class="soft-tag tone-up">置顶</span>}
              {item.verified && <span class="soft-tag tone-green">✓ 已认证</span>}
              {item.badge && item.badge !== '—' && <span class="soft-tag tone-amber">{item.badge}</span>}
              {item.matchScore > 0 && <span class="soft-tag tone-purple">✦ 匹配度 {item.matchScore}%</span>}
            </div>
            <p class="sd-spec">
              规格 {item.spec || '—'} ｜ 可供/求购 {item.quantity} ｜ {item.origin} ｜ 上市 {item.availableDate}
            </p>
            <div class="row between">
              <div class="sd-price-row">
                <span class="sd-price">{Number(item.price).toFixed(2)}<small>{item.priceUnit}</small></span>
                <span class="small muted">{item.marketRef}</span>
              </div>
              <div class="sd-aside">
                <span class="small muted">{item.expireDate ? `有效期至 ${item.expireDate}` : '未提供有效期'}</span>
                <span class="small muted">浏览 {item.viewCount} · 沟通 {item.chatCount}</span>
              </div>
            </div>
            <div class="sd-foot">
              <span class="sd-avatar">{item.orgName.slice(0, 1)}</span>
              <span>{item.orgName}</span>
              <span class="soft-tag">{item.orgType}</span>
              <span style={{
                marginLeft: 'auto'
              }}>发布 {item.createdAt}</span>
            </div>
          </article>)}
      </div>
      {view_data.items.length === 0 && <p class="muted small" style={{
          textAlign: 'center',
          padding: "30px"
        }}>没有符合条件的供需信息</p>}

      <Drawer open={view_mineOpen} onClose={() => {
          setMineOpen(false);
          setMine(null);
        }} width={560} title="我的发布">
        {view_mineLoading && <p class="muted small">正在读取…</p>}
        {!view_mineLoading && view_mineError && <p class="small" style={{
            color: '#c94b4b'
          }}>{view_mineError}</p>}
        {!view_mineLoading && !view_mineError && view_mine && <div class="stack">
            <div class="row" style={{
              gap: "10px"
            }}>
              <span class="soft-tag tone-green">在线 {mineItems.filter(item => item.status === 'online').length}</span>
              <span class="soft-tag tone-amber">待审核 {mineItems.filter(item => item.status === 'pending').length}</span>
              <button type="button" class={`chip${view_showClosed ? ' on' : ''}`} onClick={() => setShowClosed(previous => !previous)}>
                已下架 {mineClosed.length}
              </button>
            </div>
            {mineItems.some(item => item.status === 'pending') && <p class="small" style={{
              color: '#ae6b00',
              margin: "0px"
            }}>
                商品与采购需求发布后需运营审核（≤2 小时），审核通过才会出现在供需大厅。
              </p>}
            {mineVisible.map(item => <div class="surface-card" key={`${item.sdType}-${item.id}`} style={{
              padding: "14px"
            }} onClick={() => view_navigate('sd-detail', item.id, {
              type: item.sdType
            })}>
                <div class="row between">
                  <b style={{
                  fontSize: "13px"
                }}>
                    <span class="soft-tag" style={{
                    marginRight: "8px"
                  }}>{item.sdType === 'demand' ? '求购' : '供应'}</span>
                    {item.title}
                  </b>
                  <span class="soft-tag">{statusLabel(item.status)}</span>
                </div>
                <p class="small muted" style={{
                marginTop: "6px"
              }}>
                  {item.sdNo} · {item.quantity} · {Number(item.price).toFixed(2)} {item.priceUnit} · {item.createdAt}
                </p>
                {item.auditNote && <p class="small" style={{
                marginTop: "4px",
                color: '#ae6b00'
              }}>审核意见：{item.auditNote}</p>}
              </div>)}
            {mineVisible.length === 0 && <p class="muted small">
                {mineItems.length === 0 ? '还没有发布记录，去发布一条供应或需求试试。' : `当前没有在架或在审的记录，已下架 ${mineClosed.length} 条可点上方「已下架」查看。`}
              </p>}
            {mineVisible.length > 0 && <p class="small muted" style={{
              margin: "0px"
            }}>
                这里只展示最近的记录，改价、上下架等完整管理请到交易端。
              </p>}
          </div>}
      </Drawer>
    </div>;
    };
  }
});
function statusLabel(status: string): string {
  return ({
    online: '在线',
    pending: '待审核',
    offline: '已下架',
    rejected: '未通过'
  } as Record<string, string>)[status] ?? status;
}
