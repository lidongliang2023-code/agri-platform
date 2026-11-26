import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { PortalPageHero } from './PortalPageHero';
import { certificationGuides } from '../pages/certifyModel';
import '../pages/certify.css';
export const CertificationGuide = defineComponent({
  name: "CertificationGuide",
  props: {
    kind: null as unknown as PropType<{
      kind: keyof typeof certificationGuides;
    }["kind"]>
  },
  setup(__props: {
    kind: keyof typeof certificationGuides;
  }, {
    slots: __slots
  }) {
    const guide = computed(() => certificationGuides[__props.kind]);
    const checked = ref<number[]>([]);
    const setChecked = (next: typeof checked.value | ((previous: typeof checked.value) => typeof checked.value)) => {
      checked.value = typeof next === 'function' ? (next as (previous: typeof checked.value) => typeof checked.value)(checked.value) : next;
    };
    return () => {
      const view_guide = guide.value;
      const view_checked = checked.value;
      const view_prop_kind = __props.kind;
      return <main class="portal-channel-page certify-page">
    <PortalPageHero badge={view_guide.badge} title={view_guide.title} description={view_guide.description}>
      <div class="certify-actions"><a class="btn portal-page-btn-light" href={view_guide.target}>{view_guide.action}</a><a class="btn portal-page-btn-ghost" href="#/certify">返回认证中心</a></div>
    </PortalPageHero>
    <div class="container certify-body">
      <nav aria-label="面包屑" class="certify-breadcrumb"><a href="#/">首页</a><span> / </span><a href="#/certify">认证中心</a><span> / {view_guide.title}</span></nav>
      <section class="certify-panel"><span class="certify-eyebrow">WHO CAN APPLY</span><h2>适用主体</h2><p>{view_guide.audience}</p></section>
      <div class="certify-guide-grid"><section class="certify-panel"><div class="certify-heading"><div><span class="certify-eyebrow">PREPARATION CHECKLIST</span><h2>办理前准备</h2></div><span class="certify-tag neutral">{view_checked.length} / {view_guide.materials.length} 已准备</span></div><p>此清单仅帮助自行准备，不保存材料、不提交申请，离开页面后重置。</p><div class="certify-checklist">{view_guide.materials.map((item, index) => <label key={item}><input type="checkbox" checked={view_checked.includes(index)} onInput={e => setChecked(values => (e.target as HTMLInputElement).checked ? [...values, index] : values.filter(value => value !== index))} /><span>{item}</span></label>)}</div><p class="certify-muted">实际必填项和核验方式以账号中心当前页面为准。</p></section>
      <section class="certify-panel"><span class="certify-eyebrow">APPLICATION PROCESS</span><h2>办理流程</h2><ol class="certify-steps">{view_guide.steps.map((step, index) => <li key={step}><span>{index + 1}</span><div>{step}</div></li>)}</ol></section></div>
      <section class="certify-panel"><h2>办理须知</h2><ul class="certify-notes">{view_guide.notes.map(note => <li key={note}>{note}</li>)}</ul><div class="certify-actions"><a class="btn btn-primary" href={view_guide.target}>{view_guide.action}</a><a class="btn btn-outline" href="#/certify">查看我的认证状态</a><a href={view_prop_kind === 'personal' ? '#/certify/enterprise' : '#/certify/personal'}>了解{view_prop_kind === 'personal' ? '企业认证' : '个人实名'} →</a></div></section>
    </div>
  </main>;
    };
  }
});
