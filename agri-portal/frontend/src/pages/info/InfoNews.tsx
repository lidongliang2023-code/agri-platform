import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { formatCount, infoPublicApi, type Article } from './infoApi';
import { applyStructuredData, usePageMeta } from '../../utils';
import './info.css';

/**
 * 资讯详情。
 *
 * <p>列表已合并进资讯首页（`#/info` 的「产业资讯」区块），这里只负责单篇正文；
 * 返回链接指向首页的列表位置，而不是原来那个独立的列表页。</p>
 */

/** 正文按空行/换行切段：后端存的是纯文本，直接塞进 HTML 会挤成一坨。 */
function paragraphs(content?: string): string[] {
  if (!content) return [];
  return content.split(/\n+/).map(line => line.trim()).filter(Boolean);
}
export const InfoNewsDetail = defineComponent({
  name: "InfoNewsDetail",
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
    const article = ref<Article | null>(null);
    const setArticle = (next: typeof article.value | ((previous: typeof article.value) => typeof article.value)) => {
      article.value = typeof next === 'function' ? (next as (previous: typeof article.value) => typeof article.value)(article.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    watchEffect(() => usePageMeta(article.value?.title ?? '资讯详情', article.value?.summary));

    // 结构化数据：让搜索结果能展示标题/时间/发布方，是 hash 路由下少有的有效 SEO 手段
    onMounted(() => {
      watch(() => [article.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!article.value) return;
          applyStructuredData('ld-article', {
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: article.value.title,
            description: article.value.summary ?? '',
            datePublished: article.value.publishedAt ?? article.value.createdAt ?? '',
            articleSection: article.value.channel,
            author: {
              '@type': 'Organization',
              name: article.value.author ?? '丰链云'
            },
            publisher: {
              '@type': 'Organization',
              name: '丰链云'
            },
            mainEntityOfPage: window.location.href
          });
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [__props.id], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          let cancelled = false;
          setLoading(true);
          setError('');
          infoPublicApi.article(__props.id).then(data => {
            if (!cancelled) setArticle(data);
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
      const view_article = article.value;
      if (view_loading) return <div class="info-page"><div class="info-loading">正在加载…</div></div>;
      if (view_error || !view_article) {
        return <div class="info-page">
        <a class="info-back" href="#/info">‹ 返回产业资讯</a>
        <div class="info-error">{view_error || '资讯不存在或已下架'}</div>
      </div>;
      }
      return <div class="info-page">
      <a class="info-back" href="#/info">‹ 返回产业资讯</a>
      <article class="info-article">
        <h1>{view_article.title}</h1>
        <div class="info-meta">
          <span class="info-chip gray">{view_article.channel}</span>
          {view_article.author && <span>{view_article.author}</span>}
          <span>{view_article.publishedAt ?? view_article.createdAt}</span>
          <span>阅读 {formatCount(view_article.readCount)}</span>
          {view_article.attestNo && <span>已存证 {view_article.attestNo}</span>}
        </div>

        {view_article.summary && <div class="info-card" style={{
            marginTop: "18px",
            background: 'var(--green-050)',
            borderColor: 'var(--green-100)'
          }}>
            <p style={{
              margin: "0px",
              color: 'var(--green-800)',
              fontSize: "13.5px",
              lineHeight: 1.8
            }}>{view_article.summary}</p>
          </div>}

        <div class="info-article-body">
          {paragraphs(view_article.content).map((line, index) => <p key={index}>{line}</p>)}
          {paragraphs(view_article.content).length === 0 && <p class="gray">暂无正文内容</p>}
        </div>

        {view_article.tags && view_article.tags.length > 0 && <div class="info-chips" style={{
            marginTop: "24px"
          }}>
            {view_article.tags.map(tag => <span class="info-chip gray" key={tag}>{tag}</span>)}
          </div>}
      </article>
    </div>;
    };
  }
});
