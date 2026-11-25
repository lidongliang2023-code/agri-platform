import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { CheckCircleFilled, SafetyCertificateOutlined } from "@ant-design/icons-vue";
import { Button, Drawer, Input, Tag, message } from "../components/vue-ui";
import { infoApi } from '../api';
import type { Attestation } from '../types';
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile } from '../components/ui';
interface VerifyResult {
  valid: boolean;
  message: string;
  record?: Attestation;
}

/**
 * 内容存证：展示已上链的内容清单，并提供公开验真入口。
 * 验真只校验编号与哈希，不返回原文，避免内容被爬取。
 */
export const AttestPage = defineComponent({
  name: "AttestPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const items = ref<Attestation[] | null>(null);
    const setItems = (next: Attestation[] | null | ((previous: Attestation[] | null) => Attestation[] | null)) => {
      items.value = typeof next === 'function' ? (next as (previous: Attestation[] | null) => Attestation[] | null)(items.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const attestNo = ref('');
    const setAttestNo = (next: typeof attestNo.value | ((previous: typeof attestNo.value) => typeof attestNo.value)) => {
      attestNo.value = typeof next === 'function' ? (next as (previous: typeof attestNo.value) => typeof attestNo.value)(attestNo.value) : next;
    };
    const verifying = ref(false);
    const setVerifying = (next: typeof verifying.value | ((previous: typeof verifying.value) => typeof verifying.value)) => {
      verifying.value = typeof next === 'function' ? (next as (previous: typeof verifying.value) => typeof verifying.value)(verifying.value) : next;
    };
    const result = ref<VerifyResult | null>(null);
    const setResult = (next: VerifyResult | null | ((previous: VerifyResult | null) => VerifyResult | null)) => {
      result.value = typeof next === 'function' ? (next as (previous: VerifyResult | null) => VerifyResult | null)(result.value) : next;
    };
    const detail = ref<Attestation | null>(null);
    const setDetail = (next: Attestation | null | ((previous: Attestation | null) => Attestation | null)) => {
      detail.value = typeof next === 'function' ? (next as (previous: Attestation | null) => Attestation | null)(detail.value) : next;
    };
    const load = (): void => {
      setError('');
      infoApi.attestations().then(setItems).catch((reason: Error) => setError(reason.message));
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
    const verify = (target?: string): void => {
      const no = (target ?? attestNo.value).trim();
      if (!no) {
        message.warning('请输入存证编号');
        return;
      }
      setAttestNo(no);
      setVerifying(true);
      infoApi.verifyAttestation(no).then(setResult).catch((reason: Error) => message.error(reason.message)).finally(() => setVerifying(false));
    };
    return () => {
      const view_items = items.value;
      const view_error = error.value;
      const view_attestNo = attestNo.value;
      const view_verifying = verifying.value;
      const view_result = result.value;
      const view_detail = detail.value;
      if (!view_items && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_items) return <ErrorBlock message={view_error} onRetry={load} />;
      return <div class="page-stack">
      <PageTitle eyebrow="BLOCKCHAIN ATTESTATION" title="内容存证与验真" description="行情分析、政策解读、研究报告等关键内容上链存证 · 任何人可凭存证编号在线验证内容未被篡改" />

      <div class="grid-4">
        <StatTile label="已存证内容" value={view_items.length} unit="条" note="覆盖资讯、报告、行情分析" />
        <StatTile label="累计验真" value={view_items.reduce((sum, item) => sum + item.verifyCount, 0)} unit="次" note="含第三方验证" tone="up" />
        <StatTile label="存证链" value="农业联盟链" note="多节点共识" />
        <StatTile label="确认状态" value={view_items.filter(item => item.status === 'confirmed').length} unit="条" note="全部已确认" tone="warn" />
      </div>

      <section class="surface-card">
        <SectionHeading kicker="VERIFY" title="在线验真" />
        <div class="row" style={{
            gap: "10px",
            flexWrap: 'wrap'
          }}>
          <Input style={{
              maxWidth: "380px"
            }} value={view_attestNo} placeholder="输入存证编号，例：AT-20260627-0001" onChange={event => setAttestNo((event.target as HTMLInputElement).value)} onPressEnter={() => verify()} />
          <Button type="primary" loading={view_verifying} onClick={() => verify()}>立即验真</Button>
          <span class="small muted">存证编号可在资讯详情页右侧「内容存证」中查看</span>
        </div>

        {view_result && <div class={`verify-result ${view_result.valid ? 'ok' : 'bad'}`}>
            <CheckCircleFilled />
            <div>
              <b>{view_result.message}</b>
              {view_result.record && <p class="small muted" style={{
                marginTop: "6px"
              }}>
                  {view_result.record.attestNo} · {view_result.record.title} · 上链时间 {view_result.record.attestedAt} · 区块高度 {view_result.record.blockHeight}
                </p>}
            </div>
          </div>}
      </section>

      <section class="surface-card">
        <SectionHeading kicker="LEDGER" title="存证清单" />
        {view_items.length === 0 && <EmptyState icon="🔗" title="暂无存证记录" description="内容审核通过后会自动触发存证。" />}
        <div class="stack" style={{
            gap: "12px"
          }}>
          {view_items.map(item => <article class="attest-row" key={item.id} onClick={() => infoApi.attestation(item.id).then(setDetail).catch((reason: Error) => message.error(reason.message))}>
              <span class="attest-icon"><SafetyCertificateOutlined /></span>
              <div style={{
                flex: 1,
                minWidth: "0px"
              }}>
                <div class="row" style={{
                  gap: "8px",
                  flexWrap: 'wrap'
                }}>
                  <b style={{
                    fontSize: "13px"
                  }}>{item.title}</b>
                  <Tag class="soft-tag tone-green">{item.contentType === 'report' ? '研究报告' : item.contentType === 'quote' ? '行情数据' : '资讯内容'}</Tag>
                  <Tag class="soft-tag tone-purple">已确认</Tag>
                </div>
                <p class="small muted" style={{
                  margin: '6px 0'
                }}>
                  {item.attestNo} · {item.chainName} · 区块 {item.blockHeight} · {item.attestedAt}
                </p>
                <p class="hash-box">{item.contentHash}</p>
              </div>
              <div class="row" style={{
                gap: "8px"
              }}>
                <span class="small muted">验真 {item.verifyCount} 次</span>
                <Button size="small" onClick={event => {
                  event.stopPropagation();
                  setResult(null);
                  verify(item.attestNo);
                }}>
                  验真
                </Button>
              </div>
            </article>)}
        </div>
      </section>

      <Drawer open={Boolean(view_detail)} onClose={() => setDetail(null)} width={560} title={view_detail?.attestNo ?? ''}>
        {view_detail && <div class="stack">
            <b>{view_detail.title}</b>
            <div class="kv-list">
              <div class="kv"><span>内容类型</span><b>{view_detail.contentType === 'report' ? '研究报告' : '资讯内容'}</b></div>
              <div class="kv"><span>存证链</span><b>{view_detail.chainName}</b></div>
              <div class="kv"><span>区块高度</span><b>{view_detail.blockHeight}</b></div>
              <div class="kv"><span>上链时间</span><b>{view_detail.attestedAt}</b></div>
              <div class="kv"><span>存证主体</span><b>{view_detail.owner}</b></div>
              <div class="kv"><span>验真次数</span><b>{view_detail.verifyCount}</b></div>
            </div>
            <div>
              <p class="small muted">内容哈希（SHA-256）</p>
              <p class="hash-box">{view_detail.contentHash}</p>
            </div>
            <div>
              <p class="small muted">交易 ID</p>
              <p class="hash-box">{view_detail.txId}</p>
            </div>

            {(view_detail.steps ?? []).length > 0 && <>
                <SectionHeading kicker="PROCESS" title="存证流程" />
                <div class="timeline">
                  {(view_detail.steps ?? []).map(step => <div class={`timeline-item${step.done ? ' done' : ''}`} key={step.title}>
                      <span class="todo-dot" />
                      <div>
                        <b>{step.title}</b>
                        <p class="small muted">{step.note}</p>
                      </div>
                    </div>)}
                </div>
              </>}
          </div>}
      </Drawer>
    </div>;
    };
  }
});
