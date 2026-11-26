import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { PortalPageHero } from '../components/PortalPageHero';
import { redirectToPlatformLogin, ssoRegister } from '../utils';
import { CertificationLoginRequired, certificationStatus, loadCertificationSummary, type CertificationSummary } from './certifyModel';
import './certify.css';
const FAQ = [['个人实名和企业认证是否必须一起办理？', '按业务身份选择。个人实名用于自然人身份核验，企业认证用于经营主体资质核验。两者不是同一审核，也不是固定的先后关卡，具体办理条件以账号中心为准。'], ['审核需要多久，认证是否收费？', '审核进度与处理意见以实际申请记录为准，不预设通过率或固定完成时间。若具体服务涉及收费，应以正式服务说明和订单为准。'], ['认证被驳回后怎么办？', '在本人或对应主体记录中查看审核意见，进入账号中心修改、补齐材料后按页面指引重新提交。不要重复创建经营主体。'], ['认证通过后是否自动取得金融、绿色认证权益？', '不会。主体认证不等于授信、行业许可、产品质量合格或绿色证书。供应链金融、绿色供应链与质量溯源分别由相应业务模块管理。'], ['证件到期或企业资料发生变化怎么办？', '进入账号中心核对当前资料，按页面支持的信息维护与审核流程办理。涉及重新核验时，以最新审核记录为准。'], ['企业员工能否替其他企业办理认证？', '请先确认已加入正确的经营主体以及主体权限。门户只提供入口，是否允许编辑和提交由账号中心及服务端权限校验决定。']];
export const Certify = defineComponent({
  name: "Certify",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const summary = ref<CertificationSummary | null>(null);
    const setSummary = (next: typeof summary.value | ((previous: typeof summary.value) => typeof summary.value)) => {
      summary.value = typeof next === 'function' ? (next as (previous: typeof summary.value) => typeof summary.value)(summary.value) : next;
    };
    const state = ref<'loading' | 'ready' | 'login' | 'error'>('loading');
    const setState = (next: typeof state.value | ((previous: typeof state.value) => typeof state.value)) => {
      state.value = typeof next === 'function' ? (next as (previous: typeof state.value) => typeof state.value)(state.value) : next;
    };
    const error = ref(''),
      reload = ref(0),
      updatedAt = ref('');
    const setUpdatedAt = (next: typeof updatedAt.value | ((previous: typeof updatedAt.value) => typeof updatedAt.value)) => {
      updatedAt.value = typeof next === 'function' ? (next as (previous: typeof updatedAt.value) => typeof updatedAt.value)(updatedAt.value) : next;
    };
    const setReload = (next: typeof reload.value | ((previous: typeof reload.value) => typeof reload.value)) => {
      reload.value = typeof next === 'function' ? (next as (previous: typeof reload.value) => typeof reload.value)(reload.value) : next;
    };
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const keyword = ref(''),
      filter = ref('all');
    const setFilter = (next: typeof filter.value | ((previous: typeof filter.value) => typeof filter.value)) => {
      filter.value = typeof next === 'function' ? (next as (previous: typeof filter.value) => typeof filter.value)(filter.value) : next;
    };
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    onMounted(() => {
      watch(() => [reload.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          const controller = new AbortController();
          setState('loading');
          setSummary(null);
          setError('');
          void loadCertificationSummary(controller.signal).then(data => {
            if (controller.signal.aborted) return;
            setSummary(data);
            setState('ready');
            setUpdatedAt(new Date().toLocaleString('zh-CN', {
              hour12: false
            }));
          }).catch((cause: unknown) => {
            if (controller.signal.aborted) return;
            setState(cause instanceof CertificationLoginRequired ? 'login' : 'error');
            setError(cause instanceof Error ? cause.message : '认证服务暂不可用');
          });
          return () => controller.abort();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const login = (): void => {
      void redirectToPlatformLogin().catch(() => setError('登录跳转失败，请稍后重试'));
    };
    const personal = computed(() => certificationStatus(summary.value?.realName?.status));
    const merchants = computed(() => (summary.value?.merchants ?? []).filter(m => m.memberType !== 'personal'));
    const rows = computed(() => merchants.value.filter(m => (m.merchantName ?? '').toLowerCase().includes(keyword.value.trim().toLowerCase()) && (filter.value === 'all' || certificationStatus(m.certification?.status || m.verifyStatus).tone === filter.value)));
    return () => {
      const view_state = state.value;
      const view_error = error.value;
      const view_summary = summary.value;
      const view_personal = personal.value;
      const view_merchants = merchants.value;
      const view_keyword = keyword.value;
      const view_filter = filter.value;
      const view_rows = rows.value;
      const view_updatedAt = updatedAt.value;
      return <main class="portal-channel-page certify-page">
    <PortalPageHero badge="IDENTITY & BUSINESS VERIFICATION" title="认证中心" description="个人身份有依据，经营主体可核验。统一账号办理、认证进度查询与资质服务导航。">
      <div class="certify-actions"><a class="btn portal-page-btn-light" href="#certify-services" onClick={event => {
              event.preventDefault();
              document.getElementById('certify-services')?.scrollIntoView({
                behavior: 'smooth'
              });
            }}>选择认证服务</a><a class="btn portal-page-btn-ghost" href="#/account">进入账号中心</a></div>
    </PortalPageHero>
    <div class="container certify-body">
      <section class="certify-panel" aria-labelledby="certify-status-title">
        <div class="certify-heading"><div><span class="certify-eyebrow">MY VERIFICATION</span><h2 id="certify-status-title">我的认证状态</h2><p>认证信息仅供当前登录账号查看，办理与审核记录统一来自身份认证域。</p></div><button class="btn btn-outline" disabled={view_state === 'loading'} onClick={() => setReload(v => v + 1)}>{view_state === 'loading' ? '正在读取…' : '刷新状态'}</button></div>
        <div aria-live="polite">{view_state === 'loading' && <p class="certify-notice" role="status">正在读取当前账号的认证信息…</p>}
        {(view_state === 'login' || view_state === 'error') && <div class="certify-notice"><h3>{view_state === 'login' ? '登录后查看本人认证与经营主体' : '认证状态暂时无法读取'}</h3><p role={view_state === 'error' ? 'alert' : undefined}>{view_error}</p><div class="certify-actions">{view_state === 'login' ? <><button class="btn btn-primary" onClick={login}>登录统一账号</button><a class="btn btn-outline" href={ssoRegister()}>注册账号</a></> : <button class="btn btn-outline" onClick={() => setReload(v => v + 1)}>重新读取</button>}<a href="#/account">前往账号中心</a></div></div>}
        {view_state === 'ready' && view_summary && <><div class="certify-personal"><div><h3>个人实名认证 <span class={`certify-tag ${view_personal.tone}`}>{view_personal.label}</span></h3><p>{view_summary.realName ? '查看本人身份核验与审核记录。' : '尚未提交个人实名记录，可按业务需求前往办理。'}</p>{view_summary.realName?.submitTime && <p>提交时间：{view_summary.realName.submitTime}</p>}{view_summary.realName?.reviewRemark && <p class="certify-review">审核意见：{view_summary.realName.reviewRemark}</p>}</div><a class="btn btn-outline" href="#/account/realname">{view_personal.tone === 'success' || view_personal.tone === 'pending' ? '查看实名记录' : '办理 / 完善实名'}</a></div>
        <div class="certify-heading"><div><h3>我的经营主体 <span class="certify-count">{view_merchants.length}</span></h3><p>企业、合作社等分别认证；加入企业不等于企业已通过认证。</p></div><a href="#/account/enterprise">创建 / 加入 / 管理主体 →</a></div>
        {view_merchants.length > 0 && <div class="certify-filters"><label>主体名称<input value={view_keyword} onInput={e => setKeyword((e.target as HTMLInputElement).value)} placeholder="输入主体名称" type="search" /></label><label>认证状态<select value={view_filter} onChange={e => setFilter((e.target as HTMLInputElement).value)}><option value="all">全部状态</option><option value="success">已认证</option><option value="pending">审核中</option><option value="danger">已驳回</option><option value="neutral">未认证 / 待完善</option></select></label><span>显示 {view_rows.length} / {view_merchants.length} 个主体</span></div>}
        {!view_merchants.length ? <p class="certify-notice">暂无已关联的经营主体。可前往账号中心创建主体或申请加入已有主体。</p> : !view_rows.length ? <p class="certify-notice">没有符合条件的主体，请调整筛选。</p> : <div class="certify-records">{view_rows.map(m => {
                    const status = certificationStatus(m.certification?.status || m.verifyStatus);
                    return <article class="certify-record" key={m.merchantId}><div><h3>{m.merchantName || '未命名主体'} <span class={`certify-tag ${status.tone}`}>{status.label}</span>{view_summary.activeMerchantId === m.merchantId && <span class="certify-tag neutral">当前主体</span>}</h3><p>主体角色：{m.roleInMerchant || '以账号中心权限为准'}{m.certification?.submitTime ? ` · 提交时间：${m.certification.submitTime}` : ''}</p>{(m.certification?.reviewRemark || m.verifyRemark) && <p class="certify-review">审核意见：{m.certification?.reviewRemark || m.verifyRemark}</p>}</div><a class="btn btn-outline" href="#/account/enterprise">进入主体管理</a></article>;
                  })}</div>}<p class="certify-muted">最近读取：{view_updatedAt}。进入主体管理后选择对应企业操作。</p></>}
        </div>
      </section>
      <section id="certify-services" aria-labelledby="certify-services-title"><div class="certify-heading"><div><span class="certify-eyebrow">VERIFICATION SERVICES</span><h2 id="certify-services-title">按身份选择办理服务</h2><p>先明确办理主体，再准备材料与核验凭证。</p></div></div><div class="certify-service-grid">{[{
                title: '个人实名认证',
                tag: '自然人身份',
                desc: '核验本人身份信息，支持实名资料、人脸活体与审核进度管理。',
                href: '#/certify/personal',
                target: '#/account/realname',
                action: '办理个人实名',
                number: '01'
              }, {
                title: '企业与经营主体认证',
                tag: '企业 / 合作社等',
                desc: '关联经营主体，提交企业资质并跟踪审核。主体成员与操作权限统一管理。',
                href: '#/certify/enterprise',
                target: '#/account/enterprise',
                action: '管理经营主体',
                number: '02'
              }].map(item => <article class="certify-panel certify-service" key={item.number}><span class="certify-number">{item.number}</span><span class="certify-eyebrow">{item.tag}</span><h3>{item.title}</h3><p>{item.desc}</p><div class="certify-actions"><a class="btn btn-primary" href={item.target}>{item.action}</a><a href={item.href}>资料清单与流程 →</a></div></article>)}</div></section>
      <section class="certify-panel"><h2>认证与业务服务各有边界</h2><div class="certify-domain-list">{[{
                title: '绿色认证与碳服务',
                text: '外部机构证书登记、公示与核验，以及碳核算、报告和咨询。平台主体认证不替代绿色证书。',
                href: '#/green-supply'
              }, {
                title: '质量溯源',
                text: '依据单品码查看生产与流通证据；企业认证不代表所有产品质量合格。',
                href: '#/quality-trace'
              }, {
                title: '供应链金融',
                text: '申请资金服务仍需独立业务审核，不因认证完成自动授信。',
                href: '#/finance'
              }].map(item => <a class="certify-domain" href={item.href} key={item.href}><strong>{item.title} ↗</strong><p>{item.text}</p></a>)}</div></section>
      <section class="certify-panel"><h2>办理常见问题</h2>{FAQ.map(([q, a]) => <details class="certify-faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
      <p class="certify-notice">资料安全提示：请在登录后的账号中心提交证件与对公信息；不要在公开素材、企业介绍或公开证据链接中包含身份证件、账户或核验凭证。</p>
    </div>
  </main>;
    };
  }
});
