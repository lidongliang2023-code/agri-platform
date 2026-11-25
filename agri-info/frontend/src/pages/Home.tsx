import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { ArrowRightOutlined, FireOutlined, RobotOutlined, SearchOutlined } from "@ant-design/icons-vue";
import { Button } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import { useUnifiedUser } from '../sso';
import type { Overview } from '../types';
import { ArticleCard, ChangePct, ErrorBlock, LoadingBlock, Sparkline } from '../components/ui';
export const HomePage = defineComponent({
  name: "HomePage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const openSearch = computed(() => __useApp.openSearch);
    const __useUnifiedUser = useUnifiedUser();
    const user = computed(() => __useUnifiedUser.user);
    const overview = ref<Overview | null>(null);
    const setOverview = (next: Overview | null | ((previous: Overview | null) => Overview | null)) => {
      overview.value = typeof next === 'function' ? (next as (previous: Overview | null) => Overview | null)(overview.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const tab = ref('为你推荐');
    const setTab = (next: typeof tab.value | ((previous: typeof tab.value) => typeof tab.value)) => {
      tab.value = typeof next === 'function' ? (next as (previous: typeof tab.value) => typeof tab.value)(tab.value) : next;
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          infoApi.overview().then(setOverview).catch((reason: Error) => setError(reason.message));
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    return () => {
      const view_overview = overview.value;
      const view_error = error.value;
      const view_tab = tab.value;
      const view_user = user.value;
      const view_openSearch = openSearch.value;
      const view_keyword = keyword.value;
      const view_navigate = navigate.value;
      if (!view_overview && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_overview) return <ErrorBlock message={view_error} />;
      const tabs = ['为你推荐', '视频与直播', '政策法规', '市场动态'];
      const feed = view_overview.feed.filter(item => {
        if (view_tab === '视频与直播') return item.contentType === '短视频' || item.contentType === '直播';
        if (view_tab === '政策法规') return item.channel === '政策法规';
        if (view_tab === '市场动态') return item.channel === '市场动态';
        return true;
      });
      const greetingName = view_user?.nickname?.trim() || view_user?.username?.trim() || (view_overview.greeting.owner && !/^uid:\d+$/.test(view_overview.greeting.owner) ? view_overview.greeting.owner : '平台用户');
      return <div class="page-stack">
      <section class="info-hero">
        <div>
          <span class="hero-kicker"><i /> 行情 · 资讯 · 供需 · 农技</span>
          <h1>您好，{greetingName}，今天的信息都在这里</h1>
          <p>{view_overview.greeting.headline}</p>
          <form class="hero-search" onSubmit={event => {
              event.preventDefault();
              view_openSearch(view_keyword.trim());
            }}>
            <div style={{
                position: 'relative',
                flex: 1
              }}>
              <SearchOutlined style={{
                  position: 'absolute',
                  left: "13px",
                  top: "12px",
                  color: '#93a198'
                }} />
              <input value={view_keyword} onInput={event => setKeyword((event.target as HTMLInputElement).value)} placeholder="搜索品种行情、资讯、农技知识或供需信息…" style={{
                  paddingLeft: "34px",
                  width: '100%'
                }} />
            </div>
            <button type="submit">搜索</button>
          </form>
          <div class="row" style={{
              marginTop: "14px"
            }}>
            <Button type="primary" icon={<RobotOutlined />} onClick={() => view_navigate('ai-qa')}>问 AI 农技助手</Button>
            <Button icon={<FireOutlined />} onClick={() => view_navigate('sd')}>进入供需大厅</Button>
          </div>
        </div>
        <div class="hero-stats">
          <div class="hero-stat"><b>{view_overview.stats.monitoredQuotes}</b><span>监测品种</span></div>
          <div class="hero-stat"><b>{view_overview.stats.unreadAlerts}</b><span>未读预警</span></div>
          <div class="hero-stat"><b>{view_overview.stats.todayArticles}</b><span>在库资讯</span></div>
          <div class="hero-stat"><b>{view_overview.stats.onlineSupplyDemand}</b><span>在线供需</span></div>
        </div>
      </section>

      <div class="ticker">
        <span class="ticker-label">今日快讯</span>
        <span class="ticker-body">
          {[...view_overview.ticker, ...view_overview.ticker].map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
        </span>
      </div>

      <div class="grid-main-aside">
        <div class="stack">
          <section class="surface-card">
            <div class="row between" style={{
                marginBottom: "12px"
              }}>
              <div class="chip-row">
                {tabs.map(item => <button type="button" key={item} class={`chip${view_tab === item ? ' on' : ''}`} onClick={() => setTab(item)}>
                    {item}
                  </button>)}
              </div>
              <button type="button" class="link-button" onClick={() => view_navigate('news')}>全部资讯 <ArrowRightOutlined /></button>
            </div>
            <div class="stack">
              {feed.map(article => <ArticleCard key={article.id} article={article} />)}
              {feed.length === 0 && <p class="muted small">该分类暂无内容，试试其他标签。</p>}
            </div>
          </section>
        </div>

        <aside class="stack">
          <section class="surface-card">
            <div class="row between" style={{
                marginBottom: "8px"
              }}>
              <b style={{
                  fontSize: "13.5px"
                }}>🔥 热门品种涨跌榜</b>
              <button type="button" class="link-button" onClick={() => view_navigate('market')}>全部行情</button>
            </div>
            <div class="hot-rank">
              {view_overview.hotRank.map((item, index) => <button type="button" key={item.quoteId} onClick={() => view_navigate('market-detail', item.quoteId)}>
                  <span class="rank-no">{index + 1}</span>
                  <span class="rank-name">{item.icon} {item.name}（{item.origin}）</span>
                  <ChangePct value={Number(item.changePct)} digits={1} />
                </button>)}
            </div>
          </section>

          <section class="ai-card">
            <div class="ai-card-head"><span>✦</span>{view_overview.aiBrief.title}</div>
            <div class="ai-card-body">
              {view_overview.aiBrief.lines.map(line => <div key={line}>· {line}</div>)}
            </div>
            <div class="ai-confidence">
              <span>结论置信度</span>
              <span class="confidence-bar"><i style={{
                    width: `${view_overview.aiBrief.confidence}%`
                  }} /></span>
              <b>{view_overview.aiBrief.confidence}%</b>
            </div>
            <div class="ai-card-actions">
              <Button size="small" type="primary" ghost onClick={() => view_navigate('forecast')}>查看完整预测</Button>
              <Button size="small" onClick={() => view_navigate('news-detail', view_overview.aiBrief.articleId)}>阅读简报全文</Button>
            </div>
          </section>

          {view_overview.live && <section class="surface-card live-card">
              <div class="row between" style={{
                marginBottom: "8px"
              }}>
                <b style={{
                  fontSize: "13.5px"
                }}>🔴 直播课堂</b>
                <span class="live-flag">● 直播中 · {view_overview.live.learners.toLocaleString('zh-CN')} 人在看</span>
              </div>
              <b style={{
                fontSize: "13px"
              }}>{view_overview.live.title}</b>
              <p class="small muted" style={{
                marginTop: "6px"
              }}>{view_overview.live.liveAt} · {view_overview.live.teacher}</p>
              <Button size="small" style={{
                marginTop: "10px"
              }} onClick={() => view_navigate('training')}>进入直播间</Button>
            </section>}

          <section class="surface-card">
            <div class="row between" style={{
                marginBottom: "4px"
              }}>
              <b style={{
                  fontSize: "13.5px"
                }}>我的待办</b>
            </div>
            {view_overview.todos.map((todo, index) => <button type="button" class="todo-item" key={todo.title} onClick={() => view_navigate(todo.page)}>
                <span class={`todo-dot tone-${index}`} />
                <span><b>{todo.title}</b><small>{todo.content}</small></span>
                <em>{todo.tag}</em>
              </button>)}
          </section>

          <section class="surface-card">
            <div class="row between" style={{
                marginBottom: "8px"
              }}>
              <b style={{
                  fontSize: "13.5px"
                }}>资讯频道</b>
              <button type="button" class="link-button" onClick={() => view_navigate('news')}>更多</button>
            </div>
            <div class="tag-row">
              {view_overview.channels.map(channel => <button type="button" key={channel.id} class="chip" onClick={() => view_navigate('news', undefined, {
                  channel: channel.name
                })}>
                  {channel.icon} {channel.name}
                </button>)}
            </div>
            <div style={{
                marginTop: "10px"
              }}>
              <Sparkline points={view_overview.hotRank.map(item => Number(item.price))} width={260} height={36} />
            </div>
          </section>
        </aside>
      </div>
    </div>;
    };
  }
});
