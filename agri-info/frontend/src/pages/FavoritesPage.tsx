import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { DeleteOutlined } from "@ant-design/icons-vue";
import { Button, Popconfirm, Tag, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { Favorite, PageKey } from '../types';
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, StatTile } from '../components/ui';

/** 收藏类型到页面路由的映射，点击收藏直接回到原内容。 */
const ROUTE: Record<string, {
  page: PageKey;
  withId: boolean;
  label: string;
}> = {
  article: {
    page: 'news-detail',
    withId: true,
    label: '资讯'
  },
  quote: {
    page: 'market-detail',
    withId: true,
    label: '行情'
  },
  report: {
    page: 'reports',
    withId: false,
    label: '报告'
  },
  knowledge: {
    page: 'knowledge',
    withId: true,
    label: '知识'
  },
  course: {
    page: 'training',
    withId: false,
    label: '课程'
  },
  supplyDemand: {
    page: 'sd',
    withId: false,
    label: '供需（旧记录）'
  },
  sd: {
    page: 'sd',
    withId: false,
    label: '供需（旧记录）'
  },
  supply: {
    page: 'sd-detail',
    withId: true,
    label: '供应'
  },
  demand: {
    page: 'sd-detail',
    withId: true,
    label: '需求'
  }
};
export const FavoritesPage = defineComponent({
  name: "FavoritesPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const items = ref<Favorite[] | null>(null);
    const setItems = (next: Favorite[] | null | ((previous: Favorite[] | null) => Favorite[] | null)) => {
      items.value = typeof next === 'function' ? (next as (previous: Favorite[] | null) => Favorite[] | null)(items.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const filter = ref('全部');
    const setFilter = (next: typeof filter.value | ((previous: typeof filter.value) => typeof filter.value)) => {
      filter.value = typeof next === 'function' ? (next as (previous: typeof filter.value) => typeof filter.value)(filter.value) : next;
    };
    const load = (): void => {
      setError('');
      infoApi.favorites().then(setItems).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = load();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    const types = computed(() => {
      const unique = new Set((items.value ?? []).map(item => item.targetType));
      return ['全部', ...Array.from(unique)];
    });
    const visible = computed(() => (items.value ?? []).filter(item => filter.value === '全部' || item.targetType === filter.value));
    const remove = (id: number): void => {
      infoApi.removeFavorite(id).then(result => {
        setItems(result.favorites);
        message.success(result.message);
      }).catch((reason: Error) => message.error(reason.message));
    };
    return () => {
      const view_items = items.value;
      const view_error = error.value;
      const view_types = types.value;
      const view_filter = filter.value;
      const view_visible = visible.value;
      const view_navigate = navigate.value;
      if (!view_items && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_items) return <ErrorBlock message={view_error} onRetry={load} />;
      return <div class="page-stack">
      <PageTitle eyebrow="MY FAVORITES" title="我的收藏" description="收藏的资讯、行情、报告、知识与供需信息集中在此 · 支持按类型筛选与一键取消" />

      <div class="grid-4">
        <StatTile label="收藏总数" value={view_items.length} unit="条" note="跨内容类型" />
        <StatTile label="资讯" value={view_items.filter(item => item.targetType === 'article').length} unit="条" />
        <StatTile label="行情" value={view_items.filter(item => item.targetType === 'quote').length} unit="条" />
        <StatTile label="报告与知识" value={view_items.filter(item => item.targetType === 'report' || item.targetType === 'knowledge').length} unit="条" />
      </div>

      <section class="surface-card">
        <div class="chip-row" style={{
            marginBottom: "14px"
          }}>
          {view_types.map(type => <button type="button" key={type} class={`chip${view_filter === type ? ' on' : ''}`} onClick={() => setFilter(type)}>
              {type === '全部' ? '全部' : ROUTE[type]?.label ?? type}
            </button>)}
        </div>

        {view_visible.length === 0 && <EmptyState icon="⭐" title="还没有收藏内容" description="在资讯、行情、报告页点击收藏，内容会汇总到这里。" action={<Button type="primary" onClick={() => view_navigate('news')}>去逛逛资讯</Button>} />}

        <div class="stack" style={{
            gap: "10px"
          }}>
          {view_visible.map(item => <article class="favorite-row" key={item.id}>
              <div style={{
                flex: 1,
                minWidth: "0px",
                cursor: 'pointer'
              }} onClick={() => {
                const route = ROUTE[item.targetType];
                if (!route) {
                  message.info('该类型暂不支持跳转');
                  return;
                }
                view_navigate(route.page, route.withId ? item.targetId : undefined, ['supply', 'demand'].includes(item.targetType) ? {
                  type: item.targetType
                } : undefined);
              }}>
                <div class="row" style={{
                  gap: "8px",
                  flexWrap: 'wrap'
                }}>
                  <b style={{
                    fontSize: "13px"
                  }}>{item.title}</b>
                  <Tag class="soft-tag">{ROUTE[item.targetType]?.label ?? item.targetType}</Tag>
                </div>
                <p class="small muted" style={{
                  margin: '6px 0 0'
                }}>{item.summary}</p>
                <p class="small muted" style={{
                  margin: '4px 0 0'
                }}>收藏于 {item.createdAt}</p>
              </div>
              <Popconfirm title="取消收藏？" okText="取消收藏" cancelText="再想想" onConfirm={() => remove(item.id)}>
                <Button size="small" icon={<DeleteOutlined />}>取消收藏</Button>
              </Popconfirm>
            </article>)}
        </div>
      </section>
    </div>;
    };
  }
});
