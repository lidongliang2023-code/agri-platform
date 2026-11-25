import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Alert, Button } from "../components/vue-ui";
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, ExportOutlined } from "@ant-design/icons-vue";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { SupplyDemand } from '../types';
import { EmptyState, PageTitle, SectionHeading } from '../components/ui';
import { infoReturnUrl, openExternal, tradeManageUrl, tradePublishUrl, type TradeKind } from '../trade-link';
interface EntryCard {
  kind: TradeKind;
  icon: string;
  title: string;
  role: string;
  desc: string;
  bullets: string[];
  publishLabel: string;
  manageLabel: string;
  center: string;
}
const CARDS: EntryCard[] = [{
  kind: 'supply',
  icon: '🚜',
  title: '发布供应信息',
  role: '我是卖家 · 我有货要卖',
  desc: '在交易撮合「卖家中心」发布商品，发布后自动同步到信息资讯供需大厅，并进入交易撮合的撮合池。',
  bullets: ['支持多规格 SKU，每个规格独立定价与库存', '产地省市区、规格等级、认证与商品图片一次填全', '发布后可在卖家中心随时改价、上下架'],
  publishLabel: '去卖家中心发布商品',
  manageLabel: '管理我的商品',
  center: '卖家中心'
}, {
  kind: 'demand',
  icon: '🛒',
  title: '发布采购需求',
  role: '我是买家 · 我要采购',
  desc: '在交易撮合「买家中心」发布采购需求，平台按品类、价格、距离、质量四维撮合供应商并接收正式报价。',
  bullets: ['支持一句话描述，系统自动预填品类、数量与价格区间', '可约定交货时间、收货省市、质量与包装要求', '发布后可在买家中心跟踪报价、比价并成单'],
  publishLabel: '去买家中心发布需求',
  manageLabel: '管理我的采购需求',
  center: '买家中心'
}];

/**
 * 发布供需信息的入口页。
 *
 * <p>这里**刻意不再提供表单**：供应=卖家中心的商品、需求=买家中心的采购需求，
 * 两套数据都归交易撮合所有。信息资讯如果自己再维护一份表单，就只能收集到
 * 品类、数量、价格这几个扁平字段（没有 SKU、没有图片、没有收货省市），
 * 再靠后端硬塞进描述里 —— 用户在卖家中心看到的是一条残缺商品。</p>
 *
 * <p>所以本页只做三件事：说清楚去哪儿发、把用户送过去（带 returnUrl）、把发过的接回来。</p>
 */
export const SupplyDemandPublishPage = defineComponent({
  name: "SupplyDemandPublishPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const query = computed(() => __useApp.query);
    const navigate = computed(() => __useApp.navigate);
    const initialKind = computed<TradeKind>(() => query.value.get('type') === 'demand' ? 'demand' : 'supply');
    const kind = ref<TradeKind>(initialKind.value);
    const setKind = (next: TradeKind | ((previous: TradeKind) => TradeKind)) => {
      kind.value = typeof next === 'function' ? (next as (previous: TradeKind) => TradeKind)(kind.value) : next;
    };
    const items = ref<SupplyDemand[] | null>(null);
    const setItems = (next: SupplyDemand[] | null | ((previous: SupplyDemand[] | null) => SupplyDemand[] | null)) => {
      items.value = typeof next === 'function' ? (next as (previous: SupplyDemand[] | null) => SupplyDemand[] | null)(items.value) : next;
    };
    const loading = ref(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    onMounted(() => {
      watch(() => [kind.value], (_next, _prev, cleanup) => {
        const dispose = (() => {
          let cancelled = false;
          setLoading(true);
          setError('');
          infoApi.mySupplyDemands(kind.value).then(data => {
            if (!cancelled) setItems(data.items ?? []);
          }).catch((reason: Error) => {
            if (!cancelled) setError(reason.message);
          }).finally(() => {
            if (!cancelled) setLoading(false);
          });
          return () => {
            cancelled = true;
          };
        })();
        if (typeof dispose === 'function') cleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      const view_navigate = navigate.value;
      const view_kind = kind.value;
      const view_loading = loading.value;
      const view_error = error.value;
      const view_items = items.value;
      return <div class="page-stack">
      <PageTitle eyebrow="SUPPLY & DEMAND · PUBLISH" title="发布供需信息" description="供需信息统一由交易撮合承载：供应写入卖家中心商品，需求写入买家中心采购需求，信息资讯负责展示与撮合。" actions={<Button icon={<ArrowLeftOutlined />} onClick={() => view_navigate('sd')}>返回供需大厅</Button>} />

      <Alert type="info" showIcon message="发布入口已与交易撮合合并，不再单独填写表单" description="在信息资讯里填的供需信息，本质上就是交易撮合的一条商品或一条采购需求。为了避免同一份数据填两遍、且两处字段对不上，发布表单统一收在卖家中心与买家中心；发布完成后会自动回到供需大厅。" />

      <div class="grid-main-aside">
        <div class="stack">
          {CARDS.map(card => <section class={`surface-card publish-entry${view_kind === card.kind ? ' on' : ''}`} key={card.kind} onMouseenter={() => setKind(card.kind)}>
              <div class="publish-entry-head">
                <span class="publish-entry-icon">{card.icon}</span>
                <div>
                  <span class="publish-entry-role">{card.role}</span>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              </div>

              <ul class="safety-list publish-entry-list">
                {card.bullets.map(item => <li key={item}><CheckCircleOutlined /> {item}</li>)}
              </ul>

              <div class="row publish-entry-actions">
                <Button type="primary" onClick={() => openExternal(tradePublishUrl(card.kind, infoReturnUrl('sd-publish')))}>
                  {card.publishLabel} <ArrowRightOutlined />
                </Button>
                <Button icon={<ExportOutlined />} onClick={() => openExternal(tradeManageUrl(card.kind))}>
                  {card.manageLabel}
                </Button>
                <span class="small muted">在「{card.center}」打开，发布完成可一键回到本页</span>
              </div>
            </section>)}
        </div>

        <div class="stack">
          <section class="surface-card">
            <SectionHeading kicker="MY POSTS" title="我发布过的" />
            <div class="chip-row" style={{
                marginBottom: "12px"
              }}>
              {(['supply', 'demand'] as TradeKind[]).map(item => <button type="button" key={item} class={`chip${view_kind === item ? ' on' : ''}`} onClick={() => setKind(item)}>
                  {item === 'supply' ? '我的供应' : '我的采购需求'}
                </button>)}
            </div>

            {view_loading && <p class="muted small">正在读取…</p>}
            {!view_loading && view_error && <p class="small" style={{
                color: '#c94b4b'
              }}>{view_error}</p>}
            {!view_loading && !view_error && (view_items?.length ?? 0) === 0 && <EmptyState icon={view_kind === 'supply' ? '🚜' : '🛒'} title={view_kind === 'supply' ? '还没有发布过供应' : '还没有发布过采购需求'} description="发布后会在这里看到，也可以直接去交易端管理。" />}
            {!view_loading && !view_error && (view_items?.length ?? 0) > 0 && <div class="stack" style={{
                gap: "10px"
              }}>
                {view_items!.slice(0, 6).map(item => <div class="surface-card flat publish-mine-row" key={`${item.sdType}-${item.id}`} onClick={() => view_navigate('sd-detail', item.id, {
                  type: item.sdType
                })}>
                    <div class="row between">
                      <b style={{
                      fontSize: "13px"
                    }}>{item.title}</b>
                      <span class="soft-tag">{statusLabel(item.status)}</span>
                    </div>
                    <p class="small muted" style={{
                    marginTop: "6px"
                  }}>
                      {item.sdNo} · {item.quantity} · {Number(item.price).toFixed(2)}{item.priceUnit} · {item.createdAt}
                    </p>
                  </div>)}
                <Button size="small" icon={<ExportOutlined />} onClick={() => openExternal(tradeManageUrl(view_kind))}>
                  去{view_kind === 'supply' ? '卖家中心' : '买家中心'}管理全部
                </Button>
              </div>}
          </section>

          <section class="surface-card">
            <SectionHeading kicker="NOTICE" title="发布须知" />
            <ul class="safety-list">
              <li>发布前请先完成统一登录，并绑定对应的经营主体（卖家需绑定供应商主体）。</li>
              <li>商品发布后由运营审核，审核通过才会在大厅展示；采购需求发布即可见。</li>
              <li>标题需包含品种与规格，不得使用「最便宜」「绝对」等极限词。</li>
              <li>价格单位须与库存单位一致，避免产生歧义。</li>
            </ul>
          </section>
        </div>
      </div>
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
