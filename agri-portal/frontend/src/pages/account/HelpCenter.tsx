import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 用户中心 · 帮助中心
 *
 * <p>两块内容：</p>
 * <ol>
 *   <li><b>常见问题</b> —— 由后端下发，答案描述的都是系统当前的真实行为
 *       （短信未接入、身份审核不改权限、注销不立即生效…），不是营销话术</li>
 *   <li><b>资料入口 + 最新资料</b> —— 正文在资讯域，这里只聚合标题与入口，
 *       不搬运正文（用户中心不该成为资讯的第二个副本）</li>
 * </ol>
 *
 * <p>资讯接口成功码是 **200**（不是平台侧的 0），两个都认。</p>
 */

import { Icon } from '@/components/Icon';
interface HelpQa {
  question: string;
  answer: string;
  relatedView: string | null;
}
interface HelpGroup {
  category: string;
  items: HelpQa[];
}
interface HelpResource {
  code: string;
  name: string;
  description: string;
  entryUrl: string;
}
interface ApiBody<T> {
  code: number;
  message?: string;
  data?: T;
}
async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include'
  });
  const body = (await response.json()) as ApiBody<T>;
  const ok = body.code === 0 || body.code === 200;
  if (!response.ok || !ok) {
    throw new Error(body.message || '请求失败');
  }
  return body.data as T;
}
interface InfoItem {
  id: number;
  title: string;
  summary?: string | null;
  category?: string | null;
}

/** 资讯域两种返回形态：知识库直接是数组，课程是 { items } */
function toItems(payload: unknown): InfoItem[] {
  if (Array.isArray(payload)) return payload as InfoItem[];
  const items = (payload as {
    items?: InfoItem[];
  })?.items;
  return Array.isArray(items) ? items : [];
}

/**
 * 帮助中心页面
 *
 * @returns 页面内容
 */
export const HelpCenter = defineComponent({
  name: "HelpCenter",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const groups = ref<HelpGroup[]>([]);
    const setGroups = (next: typeof groups.value | ((previous: typeof groups.value) => typeof groups.value)) => {
      groups.value = typeof next === 'function' ? (next as (previous: typeof groups.value) => typeof groups.value)(groups.value) : next;
    };
    const resources = ref<HelpResource[]>([]);
    const setResources = (next: typeof resources.value | ((previous: typeof resources.value) => typeof resources.value)) => {
      resources.value = typeof next === 'function' ? (next as (previous: typeof resources.value) => typeof resources.value)(resources.value) : next;
    };
    const contact = ref<{
      title: string;
      description: string;
      entryView: string;
    } | null>(null);
    const setContact = (next: typeof contact.value | ((previous: typeof contact.value) => typeof contact.value)) => {
      contact.value = typeof next === 'function' ? (next as (previous: typeof contact.value) => typeof contact.value)(contact.value) : next;
    };
    const faqCount = ref(0);
    const setFaqCount = (next: typeof faqCount.value | ((previous: typeof faqCount.value) => typeof faqCount.value)) => {
      faqCount.value = typeof next === 'function' ? (next as (previous: typeof faqCount.value) => typeof faqCount.value)(faqCount.value) : next;
    };
    const knowledge = ref<InfoItem[]>([]);
    const setKnowledge = (next: typeof knowledge.value | ((previous: typeof knowledge.value) => typeof knowledge.value)) => {
      knowledge.value = typeof next === 'function' ? (next as (previous: typeof knowledge.value) => typeof knowledge.value)(knowledge.value) : next;
    };
    const courses = ref<InfoItem[]>([]);
    const setCourses = (next: typeof courses.value | ((previous: typeof courses.value) => typeof courses.value)) => {
      courses.value = typeof next === 'function' ? (next as (previous: typeof courses.value) => typeof courses.value)(courses.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const openIndex = ref('');
    const setOpenIndex = (next: typeof openIndex.value | ((previous: typeof openIndex.value) => typeof openIndex.value)) => {
      openIndex.value = typeof next === 'function' ? (next as (previous: typeof openIndex.value) => typeof openIndex.value)(openIndex.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const infoNote = ref('');
    const setInfoNote = (next: typeof infoNote.value | ((previous: typeof infoNote.value) => typeof infoNote.value)) => {
      infoNote.value = typeof next === 'function' ? (next as (previous: typeof infoNote.value) => typeof infoNote.value)(infoNote.value) : next;
    };
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      setInfoNote('');
      try {
        const data = await fetchJson<{
          faqs?: HelpGroup[];
          resources?: HelpResource[];
          faqCount?: number | string;
          contact?: {
            title: string;
            description: string;
            entryView: string;
          };
        }>('/api/v1/sso/account/help');
        setGroups(data?.faqs ?? []);
        setResources(data?.resources ?? []);
        setContact(data?.contact ?? null);
        setFaqCount(Number(data?.faqCount ?? 0));

        /* 资讯域是公开内容，取不到不影响帮助中心主体，只是不显示"最新资料" */
        try {
          const [k, c] = await Promise.all([fetchJson<unknown>('/api/v1/info/public/knowledge?pageNum=1&pageSize=5'), fetchJson<unknown>('/api/v1/info/public/courses?pageNum=1&pageSize=5')]);
          setKnowledge(toItems(k).slice(0, 5));
          setCourses(toItems(c).slice(0, 5));
        } catch {
          setInfoNote('资讯服务暂时不可用，资料入口仍可点开查看');
        }
      } catch (e) {
        setError((e as Error).message || '帮助内容加载失败');
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          void load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });

    /** 搜索：命中问题或答案任一即可，保持原有分组 */
    const filtered = computed(() => {
      const kw = keyword.value.trim().toLowerCase();
      if (!kw) return groups.value;
      return groups.value.map(group => ({
        category: group.category,
        items: group.items.filter(item => item.question.toLowerCase().includes(kw) || item.answer.toLowerCase().includes(kw))
      })).filter(group => group.items.length > 0);
    });
    const hitCount = computed(() => filtered.value.reduce((sum, group) => sum + group.items.length, 0));
    return () => {
      const view_faqCount = faqCount.value;
      const view_resources = resources.value;
      const view_loading = loading.value;
      const view_error = error.value;
      const view_keyword = keyword.value;
      const view_hitCount = hitCount.value;
      const view_filtered = filtered.value;
      const view_openIndex = openIndex.value;
      const view_infoNote = infoNote.value;
      const view_knowledge = knowledge.value;
      const view_courses = courses.value;
      const view_contact = contact.value;
      return <div class="uc-hp">
      <div class="uc-hp-head">
        <div>
          <strong>
            常见问题 {view_faqCount} 条 · 资料入口 {view_resources.length} 个
          </strong>
          <small>答案描述的都是系统当前的真实行为；没做到的事会直说，不含糊</small>
        </div>
        <button class="btn btn-outline btn-sm" onClick={() => void load()} disabled={view_loading}>
          刷新
        </button>
      </div>

      {view_error && <div class="account-error">{view_error}</div>}
      {view_loading && <div class="card empty">正在加载帮助内容…</div>}

      {!view_loading && !view_error && <>
          <div class="uc-hp-search">
            <Icon name="search" size={14} />
            <input value={view_keyword} placeholder="搜索问题关键词，例如「注销」「订单为空」「短信」" onInput={event => setKeyword((event.target as HTMLInputElement).value)} />
            {view_keyword && <button class="uc-hp-clear" onClick={() => setKeyword('')}>
                清除
              </button>}
          </div>
          {view_keyword && <p class="uc-hp-hit">
              命中 {view_hitCount} 条{view_hitCount === 0 ? '，换个关键词试试，或直接提交反馈' : ''}
            </p>}

          {view_filtered.length === 0 && view_keyword ? <div class="card empty">没有匹配的问题。把问题描述清楚提交反馈，运营会回复。</div> : view_filtered.map(group => <div class="uc-hp-group" key={group.category}>
                <h4>{group.category}</h4>
                <ul>
                  {group.items.map(item => {
                const key = `${group.category}-${item.question}`;
                const open = view_openIndex === key;
                return <li key={key} class={open ? 'on' : ''}>
                        <button class="uc-hp-q" onClick={() => setOpenIndex(open ? '' : key)} aria-expanded={open}>
                          <span>{item.question}</span>
                          <Icon name={open ? 'close' : 'plus'} size={13} />
                        </button>
                        {open && <div class="uc-hp-a">
                            <p>{item.answer}</p>
                            {item.relatedView && <a href={`#/account/${item.relatedView}`} class="uc-hp-link">
                                去相关页面
                              </a>}
                          </div>}
                      </li>;
              })}
                </ul>
              </div>)}

          {view_infoNote && <div class="account-notice">{view_infoNote}</div>}

          <div class="uc-hp-res">
            <h4>可查阅的资料</h4>
            <ul>
              {view_resources.map(row => <li key={row.code}>
                  <a href={row.entryUrl}>
                    <Icon name="file" size={15} />
                    <span class="uc-hp-res-name">{row.name}</span>
                    <span class="uc-hp-res-desc">{row.description}</span>
                  </a>
                </li>)}
            </ul>
          </div>

          {(view_knowledge.length > 0 || view_courses.length > 0) && <div class="uc-hp-latest">
              <h4>最新资料</h4>
              <div class="uc-hp-latest-cols">
                {view_knowledge.length > 0 && <div>
                    <span class="uc-hp-latest-tag">知识库</span>
                    <ul>
                      {view_knowledge.map(row => <li key={`k-${row.id}`}>
                          <a href="#/info/knowledge">{row.title}</a>
                          {row.summary && <small>{row.summary}</small>}
                        </li>)}
                    </ul>
                  </div>}
                {view_courses.length > 0 && <div>
                    <span class="uc-hp-latest-tag">培训课程</span>
                    <ul>
                      {view_courses.map(row => <li key={`c-${row.id}`}>
                          <a href="#/info/training">{row.title}</a>
                          {row.summary && <small>{row.summary}</small>}
                        </li>)}
                    </ul>
                  </div>}
              </div>
            </div>}

          {view_contact && <div class="uc-hp-contact">
              <strong>{view_contact.title}</strong>
              <p>{view_contact.description}</p>
              <a class="btn btn-primary btn-sm" href={`#/account/${view_contact.entryView}`}>
                去提交反馈
              </a>
            </div>}

          <p class="uc-hp-foot">
            说明：常见问题随系统行为维护，改了功能会同步改这里；
            资料正文在资讯服务，本页只聚合入口与标题。
          </p>
        </>}
    </div>;
    };
  }
});
