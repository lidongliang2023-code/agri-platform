import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { ArrowLeftOutlined, MessageOutlined, PhoneOutlined } from "@ant-design/icons-vue";
import { Button, Input, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { SupplyDemandDetail } from '../types';
import { ChangePct, ErrorBlock, LoadingBlock, PageTitle, SectionHeading } from '../components/ui';

/**
 * 供需详情：左侧信息主体 + 右侧价格参照与撮合建议，底部为站内沟通。
 * 沟通消息按供需单维度存储，direction=in/out 区分对方与我方。
 */
export const SupplyDemandDetailPage = defineComponent({
  name: "SupplyDemandDetailPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const id = computed(() => __useApp.id);
    const query = computed(() => __useApp.query);
    const navigate = computed(() => __useApp.navigate);
    const sdType = computed(() => query.value.get('type') || undefined);
    const data = ref<SupplyDemandDetail | null>(null);
    const setData = (next: SupplyDemandDetail | null | ((previous: SupplyDemandDetail | null) => SupplyDemandDetail | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: SupplyDemandDetail | null) => SupplyDemandDetail | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const draft = ref('');
    const setDraft = (next: typeof draft.value | ((previous: typeof draft.value) => typeof draft.value)) => {
      draft.value = typeof next === 'function' ? (next as (previous: typeof draft.value) => typeof draft.value)(draft.value) : next;
    };
    const sending = ref(false);
    const setSending = (next: typeof sending.value | ((previous: typeof sending.value) => typeof sending.value)) => {
      sending.value = typeof next === 'function' ? (next as (previous: typeof sending.value) => typeof sending.value)(sending.value) : next;
    };
    const load = (): void => {
      if (!id.value) {
        setError('缺少供需编号');
        return;
      }
      setError('');
      infoApi.supplyDemand(id.value, sdType.value).then(setData).catch((reason: Error) => setError(reason.message));
    };
    onMounted(() => {
      watch(() => [id.value, sdType.value], (_next, _prev, cleanup) => {
        const dispose = load();
        if (typeof dispose === 'function') cleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const send = (): void => {
      if (!id.value || !draft.value.trim()) return;
      setSending(true);
      infoApi.sendSdMessage(id.value, {
        content: draft.value.trim()
      }, data.value?.sdType).then(result => {
        setDraft('');
        setData(previous => previous ? {
          ...previous,
          messages: result.messages
        } : previous);
        message.success(result.message);
      }).catch((reason: Error) => message.error(reason.message)).finally(() => setSending(false));
    };
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_navigate = navigate.value;
      const view_draft = draft.value;
      const view_sending = sending.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={load} />;
      return <div class="page-stack">
      <PageTitle eyebrow="SUPPLY & DEMAND · DETAIL" title={view_data.title} description={`${view_data.sdNo} · ${view_data.orgName} · 发布 ${view_data.createdAt} · 浏览 ${view_data.viewCount} · 沟通 ${view_data.chatCount}`} actions={<Button icon={<ArrowLeftOutlined />} onClick={() => view_navigate('sd')}>返回大厅</Button>} />

      <div class="grid-main-aside">
        <div class="stack">
          <section class="surface-card">
            <div class="row" style={{
                gap: "8px",
                marginBottom: "12px"
              }}>
              <span class={`soft-tag ${view_data.sdType === 'supply' ? 'tone-green' : 'tone-blue'}`}>
                {view_data.sdType === 'supply' ? '供应' : '需求'}
              </span>
              {view_data.verified && <span class="soft-tag tone-green">✓ 已认证</span>}
              {view_data.badge && view_data.badge !== '—' && <span class="soft-tag tone-amber">{view_data.badge}</span>}
              <span class="soft-tag">{statusLabel(view_data.status)}</span>
            </div>

            <div class="price-block">
              <span class="sd-price">
                {Number(view_data.price).toFixed(2)}<small>{view_data.priceUnit}</small>
              </span>
              <span class="small muted">{view_data.marketRef}</span>
            </div>

            <div class="kv-list" style={{
                marginTop: "14px"
              }}>
              <div class="kv"><span>品类 / 品种</span><b>{view_data.category} · {view_data.variety}</b></div>
              <div class="kv"><span>规格</span><b>{view_data.spec || '—'}</b></div>
              <div class="kv"><span>{view_data.sdType === 'supply' ? '可供数量' : '求购数量'}</span><b>{view_data.quantity}</b></div>
              <div class="kv"><span>产地 / 交货地</span><b>{view_data.origin}</b></div>
              <div class="kv"><span>上市时间</span><b>{view_data.availableDate}</b></div>
              <div class="kv"><span>有效期</span><b>{view_data.validityLabel || '未提供有效期'}{view_data.expireDate && `（${view_data.expireDate}）`}</b></div>
              <div class="kv">
                <span>联系人</span>
                <b>
                  {view_data.contactName}
                  {view_data.contactPhone ? ` · ${view_data.contactPhone}` : '（未公开电话，请通过站内沟通联系）'}
                </b>
              </div>
              <div class="kv"><span>主体类型</span><b>{view_data.orgType}</b></div>
            </div>

            {view_data.auditNote && <p class="source-note" style={{
                marginTop: "12px"
              }}>审核意见：{view_data.auditNote}</p>}

            <div class="row" style={{
                gap: "10px",
                marginTop: "16px"
              }}>
              <Button type="primary" icon={<MessageOutlined />} onClick={() => {
                  const input = document.querySelector<HTMLTextAreaElement>('.chat-window textarea');
                  input?.focus();
                }}>
                立即沟通
              </Button>
              <Button icon={<PhoneOutlined />} disabled={!view_data.contactPhone} title={view_data.contactPhone ? undefined : '发布者未公开电话，请使用站内沟通'} onClick={() => message.info(`联系方式：${view_data.contactName} ${view_data.contactPhone}`)}>
                {view_data.contactPhone ? '查看联系方式' : '未公开电话'}
              </Button>
              <Button onClick={() => view_navigate('sd-match')}>查看全部撮合建议</Button>
            </div>
          </section>

          <section class="surface-card">
            <SectionHeading kicker="COMMUNICATION" title="站内沟通记录" />
            <div class="chat-window">
              {view_data.messages.length === 0 && <p class="muted small">还没有沟通记录，发送第一条消息开始洽谈。</p>}
              {view_data.messages.map(item => <div class={`chat-item ${item.direction === 'out' ? 'out' : 'in'}`} key={item.id}>
                  <span class="chat-avatar">{item.fromName.slice(0, 1)}</span>
                  <div class="chat-content">
                    <div class="chat-meta"><b>{item.fromName}</b><span>{item.createdAt}</span></div>
                    <div class="chat-msg">{item.content}</div>
                  </div>
                </div>)}
            </div>
            <div class="chat-input-row">
              <Input.TextArea rows={2} maxlength={200} showCount value={view_draft} placeholder="输入沟通内容，平台会同步通知对方（勿在消息中留银行卡等敏感信息）" onChange={event => setDraft((event.target as HTMLInputElement).value)} onPressEnter={event => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }} />
              <Button type="primary" loading={view_sending} onClick={send}>发送</Button>
            </div>
          </section>
        </div>

        <div class="stack">
          <section class="surface-card">
            <SectionHeading kicker="PRICE REFERENCE" title="平台价格参照" />
            {view_data.priceRef.available ? <>
                <div class="price-block">
                  <span class="price-value">
                    {Number(view_data.priceRef.price).toFixed(2)}<small>{view_data.priceRef.priceUnit}</small>
                  </span>
                  <ChangePct value={view_data.priceRef.changePct ?? 0} />
                </div>
                <div class="kv-list" style={{
                  marginTop: "10px"
                }}>
                  <div class="kv"><span>参照品种</span><b>{view_data.priceRef.variety}</b></div>
                  <div class="kv"><span>参照产地</span><b>{view_data.priceRef.origin}</b></div>
                </div>
              </> : <p class="muted small">该品种暂无平台监测价，建议参考周边产地报价议价。</p>}
            <p class="source-note" style={{
                marginTop: "10px"
              }}>{view_data.priceRef.note}</p>
          </section>

          <section class="surface-card">
            <SectionHeading kicker="AI MATCHING" title={`撮合建议（${view_data.matches.length}）`} />
            {view_data.matches.length === 0 && <p class="muted small">暂未匹配到合适对手方，可放宽规格或延长有效期。</p>}
            <div class="stack" style={{
                gap: "10px"
              }}>
              {view_data.matches.map(match => <div class="match-card" key={match.id}>
                  <div class="row between">
                    <b style={{
                      fontSize: "13px"
                    }}>{match.targetTitle}</b>
                    <span class="soft-tag tone-purple">✦ {match.score}%</span>
                  </div>
                  <p class="small muted" style={{
                    margin: '6px 0 4px'
                  }}>
                    {match.targetOrg} · {match.targetRegion} · 运距 {match.distanceKm} 公里 · 价差 {match.priceGap}
                  </p>
                  <p class="small">{match.reason}</p>
                </div>)}
            </div>
            {view_data.matches.length > 0 && <Button block style={{
                marginTop: "12px"
              }} onClick={() => view_navigate('sd-match')}>进入智能撮合工作台</Button>}
          </section>

          <section class="surface-card">
            <SectionHeading kicker="SAFETY" title="交易安全提示" />
            <ul class="safety-list">
              <li>平台仅提供信息撮合，不介入资金结算，请勿提前支付定金至个人账户。</li>
              <li>建议先小批量试单，验货合格后再签正式合同。</li>
              <li>保留沟通记录与物流单据，出现纠纷可提交平台协助调解。</li>
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
