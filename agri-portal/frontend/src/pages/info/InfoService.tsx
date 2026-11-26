import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { dayLabel, formatCount, infoPublicApi, money, type Course, type Expert, type Knowledge, type Report } from './infoApi';
import { usePageMeta } from '../../utils';
import './info.css';
type Tab = 'training' | 'experts' | 'reports' | 'knowledge';

/** 供路由层使用：`/info/{tab}` 的 tab 取值。 */
export type InfoTab = Tab;
const TABS: Array<{
  key: Tab;
  label: string;
}> = [{
  key: 'training',
  label: '培训课堂'
}, {
  key: 'experts',
  label: '认证专家'
}, {
  key: 'reports',
  label: '数据报告'
}, {
  key: 'knowledge',
  label: '农技知识'
}];

/**
 * 学习与服务：培训 / 专家 / 报告 / 知识库 四个频道合一。
 * 它们在门户上是并列的浏览入口，交互高度一致，拆成四个页面只会重复三遍骨架。
 */
const TAB_META: Record<Tab, {
  title: string;
  desc: string;
}> = {
  training: {
    title: '培训课堂',
    desc: '农技专家录播课程与直播回放，手机端可继续学习。'
  },
  experts: {
    title: '认证专家',
    desc: '平台审核通过的农业专家，可在线提问。'
  },
  reports: {
    title: '数据报告',
    desc: '行情研判与产业分析报告。'
  },
  knowledge: {
    title: '农技知识库',
    desc: '病虫害防治、营养管理与采后处理知识。'
  }
};
export const InfoService = defineComponent({
  name: "InfoService",
  props: {
    tab: null as unknown as PropType<{
      tab: Tab;
    }["tab"]>
  },
  setup(__props: {
    tab: Tab;
  }, {
    slots: __slots
  }) {
    watchEffect(() => usePageMeta(TAB_META[__props.tab].title, TAB_META[__props.tab].desc));
    return () => {
      const view_prop_tab = __props.tab;
      return <div class="info-page">
      <div class="info-chips" style={{
          marginBottom: "18px"
        }}>
        {TABS.map(item => <a key={item.key} class={`info-chip${view_prop_tab === item.key ? ' on' : ''}`} href={`#/info/${item.key}`}>
            {item.label}
          </a>)}
      </div>
      {view_prop_tab === 'training' && <Training />}
      {view_prop_tab === 'experts' && <Experts />}
      {view_prop_tab === 'reports' && <Reports />}
      {view_prop_tab === 'knowledge' && <KnowledgeBase />}
    </div>;
    };
  }
});
function useAsync<T>(loader: () => Promise<T>, deps: () => unknown[] = () => []) {
  const data = shallowRef<T | null>(null);
  const loading = ref(true);
  const error = ref('');
  watch(deps, async (_n, _p, cleanup) => {
    let cancelled = false;
    cleanup(() => {
      cancelled = true;
    });
    loading.value = true;
    error.value = '';
    try {
      const result = await loader();
      if (!cancelled) data.value = result;
    } catch (reason) {
      if (!cancelled) error.value = reason instanceof Error ? reason.message : '加载失败';
    } finally {
      if (!cancelled) loading.value = false;
    }
  }, {
    immediate: true
  });
  return {
    data,
    loading,
    error
  };
}
const Training = defineComponent({
  name: "Training",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
      data,
      loading,
      error
    } = useAsync(() => infoPublicApi.courses());
    const courses = computed<Course[]>(() => data.value?.items ?? []);
    return () => {
      const view_courses = courses.value;
      return <>
      <div class="info-section-head">
        <h2>培训课堂 <small>专家录播课程 · 手机端可继续学习</small></h2>
        <span class="small gray">{view_courses.length} 门课程 · {formatCount(data.value?.learners)} 人次在学</span>
      </div>
      {error.value && <div class="info-error">{error.value}</div>}
      {loading.value && <div class="info-loading">正在加载课程…</div>}
      {!loading.value && view_courses.length === 0 && !error.value && <div class="info-empty">暂无课程</div>}
      <div class="info-grid-3">
        {view_courses.map(course => <div class="info-tile" key={course.id}>
            <div class="info-tile-ico">{course.coverIcon ?? '🎓'}</div>
            <h3>{course.title}</h3>
            <p>{course.summary}</p>
            <div class="small gray">{course.teacher} · {course.mode} · {course.duration}</div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between'
            }} class="small gray">
              <span>{formatCount(course.learners)} 人在学</span>
              <span>{course.rating} 分</span>
            </div>
            {course.isLive && <span class="info-chip">{course.liveAt ?? '直播课'}</span>}
          </div>)}
      </div>
      <p class="portal-data-note" style={{
          marginTop: "18px"
        }}>
        观看课程需登录平台账号，移动端可在「我的 → 培训课堂」继续学习。
      </p>
    </>;
    };
  }
});
const Experts = defineComponent({
  name: "Experts",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const field = ref('');
    const setField = (next: typeof field.value | ((previous: typeof field.value) => typeof field.value)) => {
      field.value = typeof next === 'function' ? (next as (previous: typeof field.value) => typeof field.value)(field.value) : next;
    };
    const {
      data,
      loading,
      error
    } = useAsync(() => infoPublicApi.experts(field.value || undefined), () => [field.value]);
    const experts = computed<Expert[]>(() => data.value?.items ?? []);
    return () => {
      const view_experts = experts.value;
      const view_field = field.value;
      return <>
      <div class="info-section-head">
        <h2>认证专家 <small>平台审核通过 · 可在线提问</small></h2>
        <span class="small gray">{view_experts.length} 位</span>
      </div>

      {data.value?.fields && data.value.fields.length > 0 && <div class="info-chips" style={{
          marginBottom: "16px"
        }}>
          <button type="button" class={`info-chip${view_field === '' ? ' on' : ''}`} onClick={() => setField('')}>全部</button>
          {data.value.fields.map(item => <button type="button" key={item} class={`info-chip${view_field === item ? ' on' : ''}`} onClick={() => setField(item)}>
              {item}
            </button>)}
        </div>}

      {error.value && <div class="info-error">{error.value}</div>}
      {loading.value && <div class="info-loading">正在加载专家…</div>}
      {!loading.value && view_experts.length === 0 && !error.value && <div class="info-empty">暂无专家</div>}

      <div class="info-grid-3">
        {view_experts.map(expert => <div class="info-tile" key={expert.id}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: "12px"
            }}>
              <div class="info-tile-ico">{expert.avatarText ?? '👨‍🌾'}</div>
              <div>
                <h3 style={{
                  margin: "0px"
                }}>{expert.name}</h3>
                <div class="small gray">{expert.title ?? expert.field}</div>
              </div>
            </div>
            <p>{expert.intro ?? expert.orgName}</p>
            <div class="small gray">
              {expert.orgName}
              {expert.years ? ` · 从业 ${expert.years} 年` : ''}
              {expert.answerCount ? ` · 已回答 ${formatCount(expert.answerCount)} 次` : ''}
            </div>
            {expert.tags && expert.tags.length > 0 && <div class="info-chips">
                {expert.tags.slice(0, 3).map(tag => <span class="info-chip gray" key={tag}>{tag}</span>)}
              </div>}
          </div>)}
      </div>
    </>;
    };
  }
});
const Reports = defineComponent({
  name: "Reports",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const category = ref('');
    const setCategory = (next: typeof category.value | ((previous: typeof category.value) => typeof category.value)) => {
      category.value = typeof next === 'function' ? (next as (previous: typeof category.value) => typeof category.value)(category.value) : next;
    };
    const {
      data,
      loading,
      error
    } = useAsync(() => infoPublicApi.reports(category.value || undefined), () => [category.value]);
    const reports = computed<Report[]>(() => data.value?.items ?? []);
    return () => {
      const view_reports = reports.value;
      const view_category = category.value;
      return <>
      <div class="info-section-head">
        <h2>数据报告 <small>行情研判 · 产业分析</small></h2>
        <span class="small gray">{view_reports.length} 份</span>
      </div>

      {data.value?.categories && data.value.categories.length > 0 && <div class="info-chips" style={{
          marginBottom: "16px"
        }}>
          <button type="button" class={`info-chip${view_category === '' ? ' on' : ''}`} onClick={() => setCategory('')}>全部</button>
          {data.value.categories.map(item => <button type="button" key={item} class={`info-chip${view_category === item ? ' on' : ''}`} onClick={() => setCategory(item)}>
              {item}
            </button>)}
        </div>}

      {error.value && <div class="info-error">{error.value}</div>}
      {loading.value && <div class="info-loading">正在加载报告…</div>}
      {!loading.value && view_reports.length === 0 && !error.value && <div class="info-empty">暂无报告</div>}

      <div class="info-grid-3">
        {view_reports.map(report => <div class="info-tile" key={report.id}>
            <div class="info-tile-ico">{report.coverIcon ?? '📊'}</div>
            <h3>{report.title}</h3>
            <p>{report.summary}</p>
            <div class="small gray">
              {report.category} · {report.pages ?? '—'} 页 · {report.publishDate}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline'
            }}>
              <b style={{
                color: 'var(--danger)'
              }}>{report.price ? `¥${money(report.price, 0)}` : '免费'}</b>
              <span class="small gray">下载 {formatCount(report.downloadCount)}</span>
            </div>
          </div>)}
      </div>
    </>;
    };
  }
});
const KnowledgeBase = defineComponent({
  name: "KnowledgeBase",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const crop = ref('');
    const setCrop = (next: typeof crop.value | ((previous: typeof crop.value) => typeof crop.value)) => {
      crop.value = typeof next === 'function' ? (next as (previous: typeof crop.value) => typeof crop.value)(crop.value) : next;
    };
    const openId = ref(0);
    const setOpenId = (next: typeof openId.value | ((previous: typeof openId.value) => typeof openId.value)) => {
      openId.value = typeof next === 'function' ? (next as (previous: typeof openId.value) => typeof openId.value)(openId.value) : next;
    };
    const detail = ref<Knowledge | null>(null);
    const setDetail = (next: typeof detail.value | ((previous: typeof detail.value) => typeof detail.value)) => {
      detail.value = typeof next === 'function' ? (next as (previous: typeof detail.value) => typeof detail.value)(detail.value) : next;
    };
    const {
      data,
      loading,
      error
    } = useAsync(() => infoPublicApi.knowledge({
      keyword: keyword.value || undefined,
      crop: crop.value || undefined
    }), () => [keyword.value, crop.value]);
    const items = computed<Knowledge[]>(() => data.value ?? []);
    onMounted(() => {
      watch(() => [openId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!openId.value) {
            setDetail(null);
            return;
          }
          infoPublicApi.knowledgeDetail(openId.value).then(setDetail).catch(() => setDetail(null));
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      const view_items = items.value;
      const view_keyword = keyword.value;
      const view_crop = crop.value;
      const view_openId = openId.value;
      const view_detail = detail.value;
      return <>
      <div class="info-section-head">
        <h2>农技知识库 <small>病虫害 · 营养管理 · 采后处理</small></h2>
        <span class="small gray">{view_items.length} 篇</span>
      </div>

      <div class="info-filter">
        <input value={view_keyword} placeholder="搜症状、病害、作物" onInput={event => setKeyword((event.target as HTMLInputElement).value)} style={{
            width: "240px"
          }} />
        <input value={view_crop} placeholder="作物（如 大蒜）" onInput={event => setCrop((event.target as HTMLInputElement).value)} style={{
            width: "160px"
          }} />
      </div>

      {error.value && <div class="info-error">{error.value}</div>}
      {loading.value && <div class="info-loading">正在加载知识库…</div>}
      {!loading.value && view_items.length === 0 && !error.value && <div class="info-empty">没有匹配的知识条目</div>}

      <div class="info-card">
        {view_items.map(item => <div key={item.id} style={{
            borderBottom: '1px dashed var(--line-2)',
            padding: '12px 0'
          }}>
            <button type="button" onClick={() => setOpenId(view_openId === item.id ? 0 : item.id)} style={{
              display: 'flex',
              width: '100%',
              alignItems: 'flex-start',
              gap: "12px",
              textAlign: 'left'
            }}>
              <span class="info-chip gray">{item.category ?? '农技'}</span>
              <span style={{
                flex: 1,
                minWidth: "0px"
              }}>
                <span class="info-news-title">{item.title}</span>
                <span class="info-news-sub" style={{
                  display: 'block'
                }}>
                  {item.crop} · {item.sourceName} · {dayLabel(item.updatedAt)} · 阅读 {formatCount(item.viewCount)}
                </span>
              </span>
              <span class="small gray">{view_openId === item.id ? '收起' : '展开'}</span>
            </button>

            {view_openId === item.id && <div class="info-article-body" style={{
              marginTop: "12px",
              fontSize: "13.5px"
            }}>
                {view_detail && view_detail.id === item.id ? (view_detail.content ?? item.summary ?? '暂无内容').split(/\n+/).filter(Boolean).map((line, index) => <p key={index}>{line}</p>) : <p class="gray">正在加载…</p>}
              </div>}
          </div>)}
      </div>
    </>;
    };
  }
});
