import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Drawer, Button, Tag, message } from "../components/vue-ui";
import { StarFilled, TeamOutlined } from "@ant-design/icons-vue";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { Expert } from '../types';
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui';

/**
 * 专家服务：按领域筛选专家，抽屉内查看简介与历史问答。
 * 「申请成为专家」跳转 expert-cert 页，走运营端审核链路。
 */
export const ExpertPage = defineComponent({
  name: "ExpertPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const data = ref<{
      items: Expert[];
      fields: string[];
      questions: Expert['answers'];
    } | null>(null);
    const setData = (next: {
      items: Expert[];
      fields: string[];
      questions: Expert['answers'];
    } | null | ((previous: {
      items: Expert[];
      fields: string[];
      questions: Expert['answers'];
    } | null) => {
      items: Expert[];
      fields: string[];
      questions: Expert['answers'];
    } | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: {
        items: Expert[];
        fields: string[];
        questions: Expert['answers'];
      } | null) => {
        items: Expert[];
        fields: string[];
        questions: Expert['answers'];
      } | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const field = ref('全部领域');
    const setField = (next: typeof field.value | ((previous: typeof field.value) => typeof field.value)) => {
      field.value = typeof next === 'function' ? (next as (previous: typeof field.value) => typeof field.value)(field.value) : next;
    };
    const detail = ref<Expert | null>(null);
    const setDetail = (next: Expert | null | ((previous: Expert | null) => Expert | null)) => {
      detail.value = typeof next === 'function' ? (next as (previous: Expert | null) => Expert | null)(detail.value) : next;
    };
    const loadingDetail = ref(false);
    const setLoadingDetail = (next: typeof loadingDetail.value | ((previous: typeof loadingDetail.value) => typeof loadingDetail.value)) => {
      loadingDetail.value = typeof next === 'function' ? (next as (previous: typeof loadingDetail.value) => typeof loadingDetail.value)(loadingDetail.value) : next;
    };
    const load = (nextField: string): void => {
      setField(nextField);
      setError('');
      infoApi.experts(nextField === '全部领域' ? undefined : nextField).then(result => setData({
        items: result.items,
        fields: result.fields,
        questions: result.questions
      })).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          load('全部领域');
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    const openDetail = (id: number): void => {
      setLoadingDetail(true);
      infoApi.expert(id).then(setDetail).catch((reason: Error) => message.error(reason.message)).finally(() => setLoadingDetail(false));
    };
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_field = field.value;
      const view_navigate = navigate.value;
      const view_detail = detail.value;
      const view_loadingDetail = loadingDetail.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={() => load(view_field)} />;
      return <div class="page-stack">
      <PageTitle eyebrow="EXPERT SERVICE" title="专家在线服务" description="平台认证农技专家一对一答疑 · 专家资质经运营端审核并公示证书编号 · 平均响应 2 小时内" actions={<>
            <Button onClick={() => view_navigate('ai-qa')}>先问 AI</Button>
            <Button type="primary" onClick={() => view_navigate('expert-cert')}>申请成为专家</Button>
          </>} />

      <div class="grid-4">
        <StatTile label="在册专家" value={view_data.items.length} unit="位" note="覆盖种植、植保、土肥、电商等方向" />
        <StatTile label="累计答疑" value={formatCount(view_data.items.reduce((sum, item) => sum + item.answerCount, 0))} unit="条" note="近 30 日新增 268 条" tone="up" />
        <StatTile label="平均评分" value={(view_data.items.reduce((sum, item) => sum + item.rating, 0) / Math.max(view_data.items.length, 1)).toFixed(1)} unit="分" note="满分 5 分" />
        <StatTile label="关注用户" value={formatCount(view_data.items.reduce((sum, item) => sum + item.followers, 0))} unit="人" note="可订阅专家动态" />
      </div>

      <section class="surface-card">
        <div class="chip-row" style={{
            marginBottom: "14px"
          }}>
          {['全部领域', ...view_data.fields].map(item => <button type="button" key={item} class={`chip${view_field === item ? ' on' : ''}`} onClick={() => load(item)}>
              {item}
            </button>)}
        </div>

        {view_data.items.length === 0 && <EmptyState icon="👩‍🌾" title="该领域暂无专家" description="换个领域看看，或申请成为平台专家。" />}

        <div class="grid-2">
          {view_data.items.map(expert => <article class="expert-card" key={expert.id} onClick={() => openDetail(expert.id)}>
              <div class="expert-head">
                <span class="expert-avatar">{expert.name.slice(0, 1)}</span>
                <div>
                  <b>{expert.name}</b>
                  <p class="small muted">{expert.title} · {expert.orgName}</p>
                </div>
                <span class="soft-tag tone-green" style={{
                  marginLeft: 'auto'
                }}>{expert.level}</span>
              </div>
              <p class="small" style={{
                marginTop: "10px"
              }}>{expert.intro}</p>
              <div class="row" style={{
                gap: "12px",
                marginTop: "10px",
                flexWrap: 'wrap'
              }}>
                <Tag class="soft-tag">{expert.field}</Tag>
                <Tag class="soft-tag">{expert.region}</Tag>
                <span class="small muted">证书 {expert.certNo}</span>
              </div>
              <div class="expert-foot">
                <span><StarFilled /> {expert.rating.toFixed(1)}</span>
                <span>答疑 {expert.answerCount}</span>
                <span><TeamOutlined /> {formatCount(expert.followers)}</span>
                <Button size="small" type="primary" ghost style={{
                  marginLeft: 'auto'
                }} onClick={event => {
                  event.stopPropagation();
                  openDetail(expert.id);
                }}>
                  咨询
                </Button>
              </div>
            </article>)}
        </div>
      </section>

      <section class="surface-card">
        <SectionHeading kicker="LATEST Q&A" title="最新专家问答" />
        {(view_data.questions ?? []).length === 0 && <p class="muted small">暂无公开问答。</p>}
        <div class="stack" style={{
            gap: "12px"
          }}>
          {(view_data.questions ?? []).map(record => <div class="qa-item" key={record.id}>
              <div class="row between">
                <b style={{
                  fontSize: "13px"
                }}>Q：{record.question}</b>
                <span class="small muted">{record.expertName || '平台专家'} · {record.createdAt}</span>
              </div>
              <p class="small" style={{
                marginTop: "6px"
              }}>A：{record.answer}</p>
            </div>)}
        </div>
      </section>

      <Drawer open={Boolean(view_detail) || view_loadingDetail} onClose={() => setDetail(null)} width={520} title={view_detail ? `${view_detail.name} · ${view_detail.title}` : '加载中'}>
        {view_detail && <div class="stack">
            <div class="row" style={{
              gap: "8px",
              flexWrap: 'wrap'
            }}>
              <Tag class="soft-tag tone-green">{view_detail.level}</Tag>
              <Tag class="soft-tag">{view_detail.field}</Tag>
              <Tag class="soft-tag">{view_detail.region}</Tag>
              <Tag class="soft-tag">证书 {view_detail.certNo}</Tag>
            </div>
            <p class="small">{view_detail.intro}</p>
            <div class="kv-list">
              <div class="kv"><span>所在单位</span><b>{view_detail.orgName}</b></div>
              <div class="kv"><span>累计答疑</span><b>{view_detail.answerCount} 条</b></div>
              <div class="kv"><span>用户评分</span><b>{view_detail.rating.toFixed(1)} 分</b></div>
              <div class="kv"><span>关注人数</span><b>{formatCount(view_detail.followers)} 人</b></div>
              <div class="kv"><span>入驻时间</span><b>{view_detail.applyAt}</b></div>
            </div>
            <Button type="primary" block onClick={() => message.success('已提交咨询请求，专家将在 2 小时内回复')}>
              发起一对一咨询
            </Button>

            <SectionHeading kicker="ANSWERS" title="TA 的公开答疑" />
            {(view_detail.answers ?? []).length === 0 && <p class="muted small">暂无公开答疑记录。</p>}
            {(view_detail.answers ?? []).map(record => <div class="qa-item" key={record.id}>
                <b style={{
                fontSize: "13px"
              }}>Q：{record.question}</b>
                <p class="small" style={{
                marginTop: "6px"
              }}>A：{record.answer}</p>
                <p class="small muted">{record.crop} · {record.createdAt}</p>
              </div>)}
          </div>}
      </Drawer>
    </div>;
    };
  }
});
