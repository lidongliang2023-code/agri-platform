import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { LikeOutlined, StarOutlined } from "@ant-design/icons-vue";
import { Button, Input, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { ArticleDetail } from '../types';
import { ArticleCard, ErrorBlock, LoadingBlock, PageTitle } from '../components/ui';
export const NewsDetailPage = defineComponent({
  name: "NewsDetailPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const id = computed(() => __useApp.id);
    const navigate = computed(() => __useApp.navigate);
    const article = ref<ArticleDetail | null>(null);
    const setArticle = (next: ArticleDetail | null | ((previous: ArticleDetail | null) => ArticleDetail | null)) => {
      article.value = typeof next === 'function' ? (next as (previous: ArticleDetail | null) => ArticleDetail | null)(article.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const comment = ref('');
    const setComment = (next: typeof comment.value | ((previous: typeof comment.value) => typeof comment.value)) => {
      comment.value = typeof next === 'function' ? (next as (previous: typeof comment.value) => typeof comment.value)(comment.value) : next;
    };
    const submitting = ref(false);
    const setSubmitting = (next: typeof submitting.value | ((previous: typeof submitting.value) => typeof submitting.value)) => {
      submitting.value = typeof next === 'function' ? (next as (previous: typeof submitting.value) => typeof submitting.value)(submitting.value) : next;
    };
    const load = (): void => {
      if (!id.value) return;
      setError('');
      infoApi.article(id.value).then(setArticle).catch((reason: Error) => setError(reason.message));
    };
    onMounted(() => {
      watch(() => [id.value], (_next, _prev, cleanup) => {
        const dispose = (() => {
          load();
        })();
        if (typeof dispose === 'function') cleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      const view_id = id.value;
      const view_article = article.value;
      const view_error = error.value;
      const view_comment = comment.value;
      const view_navigate = navigate.value;
      const view_submitting = submitting.value;
      if (!view_id) return <ErrorBlock message="缺少资讯编号，请从资讯频道进入" />;
      if (!view_article && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_article) return <ErrorBlock message={view_error} />;
      const submitComment = async (): Promise<void> => {
        if (!view_comment.trim()) {
          message.warning('请填写评论内容');
          return;
        }
        setSubmitting(true);
        try {
          await infoApi.commentArticle(view_article.id, {
            content: view_comment.trim(),
            region: '平台用户'
          });
          message.success('评论已发布');
          setComment('');
          load();
        } catch (reason) {
          message.error((reason as Error).message);
        } finally {
          setSubmitting(false);
        }
      };
      return <div class="page-stack">
      <PageTitle eyebrow={`${view_article.channel} · ${view_article.contentType}`} title={view_article.title} description={`${view_article.author} · ${view_article.publishedAt} · 阅读 ${view_article.readCount} · 来源：${view_article.source}`} actions={<>
            <Button icon={<LikeOutlined />} onClick={() => infoApi.likeArticle(view_article.id).then(() => {
            message.success('已点赞');
            load();
          })}>
              点赞 {view_article.likeCount}
            </Button>
            <Button icon={<StarOutlined />} onClick={() => infoApi.addFavorite({
            targetType: 'article',
            targetId: view_article.id,
            title: view_article.title,
            summary: `${view_article.author} · ${view_article.publishedAt}`
          }).then(() => message.success('已收藏')).catch((reason: Error) => message.error(reason.message))}>
              {view_article.favorited ? '已收藏' : '收藏'}
            </Button>
            <Button type="primary" onClick={() => view_navigate('news')}>返回资讯频道</Button>
          </>} />

      <div class="grid-main-aside">
        <div class="stack">
          <section class="surface-card">
            <div class="tag-row" style={{
                marginBottom: "14px"
              }}>
              <span class="soft-tag tone-green">{view_article.channel}</span>
              {view_article.aiGenerated && <span class="soft-tag tone-purple">✦ AI 辅助生成</span>}
              {view_article.tags.map(tag => <span class="soft-tag" key={tag}>#{tag}</span>)}
            </div>
            <div class="prose">{view_article.content}</div>
            <div class="source-note">
              内容来源：{view_article.source}；本文经平台审核后发布{view_article.attestation ? `，并已在${view_article.attestation.chainName}完成存证（${view_article.attestation.attestNo}）` : ''}。
              {view_article.aiGenerated && ' AI 生成内容已通过人工抽检，关键数据以官方发布为准。'}
            </div>
          </section>

          <section class="surface-card">
            <b style={{
                fontSize: "14px"
              }}>评论（{view_article.comments.length}）</b>
            <div class="row" style={{
                marginTop: "12px",
                gap: "8px"
              }}>
              <Input.TextArea value={view_comment} onChange={event => setComment((event.target as HTMLInputElement).value)} placeholder="说说你的看法或补充本地情况…" autoSize={{
                  minRows: 2,
                  maxRows: 4
                }} maxlength={300} />
              <Button type="primary" loading={view_submitting} onClick={() => void submitComment()}>发布</Button>
            </div>
            <div style={{
                marginTop: "8px"
              }}>
              {view_article.comments.map(item => <div class="comment-item" key={item.id}>
                  <span class="comment-avatar">{item.userName.slice(0, 1)}</span>
                  <div class="comment-body">
                    <b>{item.userName} <span class="soft-tag" style={{
                        marginLeft: "6px"
                      }}>{item.userRegion}</span></b>
                    <p>{item.content}</p>
                    <small>{item.createdAt} · 赞 {item.likeCount}</small>
                  </div>
                </div>)}
              {view_article.comments.length === 0 && <p class="muted small">还没有评论，来说两句。</p>}
            </div>
          </section>
        </div>

        <aside class="stack">
          {view_article.attestation && <section class="surface-card">
              <b style={{
                fontSize: "13.5px"
              }}>⛓ 内容存证</b>
              <div class="kv-list" style={{
                marginTop: "10px"
              }}>
                <div class="kv"><span>存证编号</span><b>{view_article.attestation.attestNo}</b></div>
                <div class="kv"><span>链名称</span><b>{view_article.attestation.chainName}</b></div>
                <div class="kv"><span>区块高度</span><b>{view_article.attestation.blockHeight}</b></div>
                <div class="kv"><span>存证时间</span><b>{view_article.attestation.attestedAt}</b></div>
              </div>
              <div class="hash-box" style={{
                marginTop: "10px"
              }}>{view_article.attestation.contentHash}</div>
              <Button size="small" style={{
                width: '100%',
                marginTop: "10px"
              }} onClick={() => view_navigate('attest')}>去验证</Button>
            </section>}

          <section class="surface-card">
            <b style={{
                fontSize: "13.5px",
                display: 'block',
                marginBottom: "10px"
              }}>相关阅读</b>
            <div class="stack">
              {view_article.related.map(item => <ArticleCard key={item.id} article={item} compact />)}
              {view_article.related.length === 0 && <p class="muted small">暂无相关资讯</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>;
    };
  }
});
