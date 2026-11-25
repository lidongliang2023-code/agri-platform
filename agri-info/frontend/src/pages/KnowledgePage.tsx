import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Input, Tag, message } from "../components/vue-ui";
import { EyeOutlined } from "@ant-design/icons-vue";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { Knowledge } from '../types';
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, formatCount } from '../components/ui';

/**
 * 知识库：按作物 + 关键词检索。详情走抽屉而非独立页，便于对比多条知识。
 * 内容正文使用后端约定的【小标题】+ 换行结构，这里按行渲染成段落。
 */
export const KnowledgePage = defineComponent({
  name: "KnowledgePage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const id = computed(() => __useApp.id);
    const items = ref<Knowledge[] | null>(null);
    const setItems = (next: Knowledge[] | null | ((previous: Knowledge[] | null) => Knowledge[] | null)) => {
      items.value = typeof next === 'function' ? (next as (previous: Knowledge[] | null) => Knowledge[] | null)(items.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const crop = ref('全部作物');
    const setCrop = (next: typeof crop.value | ((previous: typeof crop.value) => typeof crop.value)) => {
      crop.value = typeof next === 'function' ? (next as (previous: typeof crop.value) => typeof crop.value)(crop.value) : next;
    };
    const detail = ref<Knowledge | null>(null);
    const setDetail = (next: Knowledge | null | ((previous: Knowledge | null) => Knowledge | null)) => {
      detail.value = typeof next === 'function' ? (next as (previous: Knowledge | null) => Knowledge | null)(detail.value) : next;
    };
    const load = (nextKeyword: string, nextCrop: string): void => {
      setKeyword(nextKeyword);
      setCrop(nextCrop);
      setError('');
      infoApi.knowledge({
        keyword: nextKeyword || undefined,
        crop: nextCrop === '全部作物' ? undefined : nextCrop
      }).then(setItems).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          load('', '全部作物');
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    onMounted(() => {
      watch(() => [id.value], (_next, _prev, cleanup) => {
        const dispose = (() => {
          if (!id.value) return;
          infoApi.knowledgeDetail(id.value).then(setDetail).catch((reason: Error) => message.error(reason.message));
        })();
        if (typeof dispose === 'function') cleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const crops = computed(() => {
      const unique = new Set((items.value ?? []).map(item => item.crop).filter(Boolean));
      return ['全部作物', ...Array.from(unique)];
    });
    return () => {
      const view_items = items.value;
      const view_error = error.value;
      const view_keyword = keyword.value;
      const view_crop = crop.value;
      const view_crops = crops.value;
      const view_detail = detail.value;
      if (!view_items && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_items) return <ErrorBlock message={view_error} onRetry={() => load(view_keyword, view_crop)} />;
      return <div class="page-stack">
      <PageTitle eyebrow="KNOWLEDGE BASE" title="农技知识库" description="病虫害防治、营养管理、采后处理、政策解读等标准化知识条目 · 内容由农科院与植保站审核供稿" actions={<Input.Search style={{
          width: "260px"
        }} allowClear placeholder="搜索标题 / 标签 / 作物" defaultValue={view_keyword} onSearch={(value = "") => load(value.trim(), view_crop)} />} />

      <section class="surface-card">
        <div class="chip-row" style={{
            marginBottom: "14px"
          }}>
          {view_crops.map(item => <button type="button" key={item} class={`chip${view_crop === item ? ' on' : ''}`} onClick={() => load(view_keyword, item)}>
              {item}
            </button>)}
        </div>

        {view_items.length === 0 && <EmptyState icon="📚" title="没有匹配的知识条目" description="换个关键词试试，例如「叶枯病」「缺钾」「储存」。" />}

        <div class="grid-2">
          {view_items.map(item => <article class="knowledge-card" key={item.id} onClick={() => setDetail(item)}>
              <div class="row between">
                <b style={{
                  fontSize: "14px"
                }}>{item.title}</b>
                <Tag class="soft-tag tone-green">{item.category}</Tag>
              </div>
              <p class="small" style={{
                margin: '8px 0'
              }}>{item.summary}</p>
              <div class="row" style={{
                gap: "6px",
                flexWrap: 'wrap'
              }}>
                <Tag class="soft-tag">{item.crop}</Tag>
                {item.tags.slice(0, 3).map(tag => <Tag class="soft-tag" key={tag}>{tag}</Tag>)}
              </div>
              <div class="row between" style={{
                marginTop: "10px"
              }}>
                <span class="small muted">{item.sourceName} · {item.updatedAt}</span>
                <span class="small muted"><EyeOutlined /> {formatCount(item.viewCount)}</span>
              </div>
            </article>)}
        </div>
      </section>

      <Drawer open={Boolean(view_detail)} onClose={() => setDetail(null)} width={620} title={view_detail?.title ?? ''}>
        {view_detail && <div class="stack">
            <div class="row" style={{
              gap: "6px",
              flexWrap: 'wrap'
            }}>
              <Tag class="soft-tag tone-green">{view_detail.category}</Tag>
              <Tag class="soft-tag">{view_detail.crop}</Tag>
              {view_detail.tags.map(tag => <Tag class="soft-tag" key={tag}>{tag}</Tag>)}
            </div>
            <p class="small muted">来源 {view_detail.sourceName} · 更新 {view_detail.updatedAt} · 阅读 {formatCount(view_detail.viewCount)}</p>
            <div class="prose">
              {view_detail.content.split('\n').filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
            </div>
            {(view_detail.related ?? []).length > 0 && <>
                <SectionHeading kicker="RELATED" title="相关知识" />
                <div class="stack" style={{
                gap: "8px"
              }}>
                  {(view_detail.related ?? []).map(item => <button type="button" class="related-row" key={item.id} onClick={() => infoApi.knowledgeDetail(item.id).then(setDetail).catch((reason: Error) => message.error(reason.message))}>
                      <b>{item.title}</b>
                      <span class="small muted">{item.category} · {item.crop}</span>
                      <span class="small muted">{item.summary}</span>
                    </button>)}
                </div>
              </>}
            <Button onClick={() => message.success('已收藏到我的收藏')}>收藏这条知识</Button>
          </div>}
      </Drawer>
    </div>;
    };
  }
});
