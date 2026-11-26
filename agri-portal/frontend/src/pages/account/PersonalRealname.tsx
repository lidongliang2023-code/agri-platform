import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 用户中心 · 个人实名认证（独立菜单）
 *
 * <p>2026-10-30 从「身份与认证」页拆出：个人实名是账号级动作，和主体创建 / 企业认证不是一回事，
 * 混在同一页里既看不清进度，也容易误点。本页只做个人实名这一条链路：</p>
 *
 * <ol>
 *   <li>登记身份证 OCR 资料（姓名 / 证件号 / 有效期 / 联系方式）</li>
 *   <li>人脸活体检测</li>
 *   <li>公安二要素核验（姓名 + 身份证号与草稿比对）</li>
 *   <li>提交平台运营审核</li>
 * </ol>
 *
 * <p><b>数据口径</b>：全部来自父级已经拉取的 {@code GET /api/v1/sso/account/summary} 的
 * {@code realName} 字段，不在前端另造状态；每次写操作后调用 {@code onRefresh} 重新读一遍，
 * 页面显示的是服务端真实状态。</p>
 */

import { Icon } from '@/components/Icon';

/** summary.realName 的字段子集（与 SsoAccountController#identityView 对齐） */
export interface RealnameRecord {
  identityNo?: string;
  realName: string;
  idNoMasked: string;
  validStart: string | null;
  validEnd: string | null;
  contactPhone: string | null;
  address: string | null;
  businessType: string | null;
  email: string | null;
  policeVerified: boolean;
  livenessVerified: boolean;
  verificationChannel: string | null;
  policeVerifiedAt: string | null;
  livenessVerifiedAt: string | null;
  status: string;
  submitTime: string;
  reviewRemark: string | null;
}
interface Props {
  /** 父级 summary 里的 realName；null 表示尚未办理 */
  record: RealnameRecord | null;
  /** 写操作成功后重新拉取 summary */
  onRefresh: () => Promise<void> | void;
  /** 外部（如从主体卡片点「去认证」）要求展开资料表单时递增，0 表示不触发 */
  openFormSignal?: number;
}
interface ApiBody<T> {
  code: number;
  message?: string;
  data?: T;
}
async function api<T>(path: string, init?: RequestInit): Promise<ApiBody<T>> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  return (await response.json()) as ApiBody<T>;
}
const BUSINESS_TYPES = ['家庭农场', '农民专业合作社成员', '个体采购户', '农产品经纪人', '其他'];
const STATUS_META: Record<string, {
  label: string;
  tone: string;
  desc: string;
}> = {
  draft: {
    label: '草稿待核验',
    tone: 'ghost',
    desc: '资料已保存，还需完成人脸活体与公安二要素核验后才能提交审核。'
  },
  rejected: {
    label: '审核驳回',
    tone: 'red',
    desc: '平台审核未通过，请按驳回意见修改资料后重新完成核验。'
  },
  pending: {
    label: '审核中',
    tone: 'amber',
    desc: '资料已提交平台运营审核，审核通过后实名状态自动生效。'
  },
  verified: {
    label: '已认证',
    tone: 'green',
    desc: '个人实名认证已通过，可作为交易、签约与金融申请的主体身份依据。'
  }
};
const EMPTY_FORM = {
  realName: '',
  idCard: '',
  contactPhone: '',
  address: '',
  businessType: BUSINESS_TYPES[0],
  validStart: '',
  validEnd: '',
  email: ''
};

/** 18 位身份证校验位，与后端 IdNumberUtil 同口径 */
function validIdNo(value: string): boolean {
  const id = value.trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(id)) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(id[i]) * weights[i];
  return codes[sum % 11] === id[17];
}
const fmtTime = (value: string | null | undefined): string => value ? String(value).replace('T', ' ').slice(0, 16) : '—';

/**
 * 个人实名认证页面
 *
 * @param props 父级 summary 中的实名记录与刷新回调
 * @returns 页面内容
 */
export const PersonalRealname = defineComponent({
  name: "PersonalRealname",
  props: {
    record: null as unknown as PropType<Props["record"]>,
    onRefresh: null as unknown as PropType<Props["onRefresh"]>,
    openFormSignal: null as unknown as PropType<Props["openFormSignal"]>
  },
  setup(__props: Props, {
    slots: __slots
  }) {
    const formOpen = ref(false);
    const setFormOpen = (next: typeof formOpen.value | ((previous: typeof formOpen.value) => typeof formOpen.value)) => {
      formOpen.value = typeof next === 'function' ? (next as (previous: typeof formOpen.value) => typeof formOpen.value)(formOpen.value) : next;
    };
    const policeOpen = ref(false);
    const setPoliceOpen = (next: typeof policeOpen.value | ((previous: typeof policeOpen.value) => typeof policeOpen.value)) => {
      policeOpen.value = typeof next === 'function' ? (next as (previous: typeof policeOpen.value) => typeof policeOpen.value)(policeOpen.value) : next;
    };
    const form = ref({
      ...EMPTY_FORM
    });
    const setForm = (next: typeof form.value | ((previous: typeof form.value) => typeof form.value)) => {
      form.value = typeof next === 'function' ? (next as (previous: typeof form.value) => typeof form.value)(form.value) : next;
    };
    const fieldErrors = ref<Record<string, string>>({});
    const setFieldErrors = (next: typeof fieldErrors.value | ((previous: typeof fieldErrors.value) => typeof fieldErrors.value)) => {
      fieldErrors.value = typeof next === 'function' ? (next as (previous: typeof fieldErrors.value) => typeof fieldErrors.value)(fieldErrors.value) : next;
    };
    const policeForm = ref({
      realName: '',
      idCard: ''
    });
    const setPoliceForm = (next: typeof policeForm.value | ((previous: typeof policeForm.value) => typeof policeForm.value)) => {
      policeForm.value = typeof next === 'function' ? (next as (previous: typeof policeForm.value) => typeof policeForm.value)(policeForm.value) : next;
    };
    const busy = ref(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const notice = ref('');
    const setNotice = (next: typeof notice.value | ((previous: typeof notice.value) => typeof notice.value)) => {
      notice.value = typeof next === 'function' ? (next as (previous: typeof notice.value) => typeof notice.value)(notice.value) : next;
    };
    const status = computed(() => __props.record?.status ?? '');
    const meta = computed(() => STATUS_META[status.value] ?? {
      label: '未办理',
      tone: 'ghost',
      desc: '尚未办理个人实名认证。登记身份证资料并完成活体与公安核验后提交审核即可。'
    });
    const editable = computed(() => !__props.record || status.value === 'draft' || status.value === 'rejected');
    onMounted(() => {
      watch(() => [__props.openFormSignal ?? 0], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if ((__props.openFormSignal ?? 0) > 0) setFormOpen(true);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });

    // 换账号或刷新后把已有资料带进表单，避免"看着有资料、点编辑却是空表单"
    onMounted(() => {
      watch(() => [__props.record], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          const currentRecord = __props.record;
          if (!currentRecord) return;
          setForm(current => ({
            realName: currentRecord.realName || current.realName,
            idCard: current.idCard,
            contactPhone: currentRecord.contactPhone ?? current.contactPhone,
            address: currentRecord.address ?? current.address,
            businessType: currentRecord.businessType || current.businessType,
            validStart: currentRecord.validStart ?? current.validStart,
            validEnd: currentRecord.validEnd ?? current.validEnd,
            email: currentRecord.email ?? current.email
          }));
          setPoliceForm(current => ({
            ...current,
            realName: currentRecord.realName || current.realName
          }));
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const patch = (next: Partial<typeof EMPTY_FORM>): void => {
      setForm(previous => ({
        ...previous,
        ...next
      }));
      setError('');
      setFieldErrors({});
    };
    const validate = (): boolean => {
      const errors: Record<string, string> = {};
      const name = form.value.realName.trim();
      if (!name) errors.realName = '请填写真实姓名';else if (name.length < 2 || name.length > 20) errors.realName = '姓名应为 2-20 个字符';
      if (!validIdNo(form.value.idCard)) errors.idCard = '身份证号应为 18 位且校验位正确';
      if (!/^1[3-9]\d{9}$/.test(form.value.contactPhone.trim())) errors.contactPhone = '请填写正确的 11 位手机号';
      if (!form.value.address.trim()) errors.address = '请填写常住地址';
      if (form.value.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email.trim())) errors.email = '邮箱格式不正确';
      if (form.value.validStart && form.value.validEnd && form.value.validStart > form.value.validEnd) {
        errors.validEnd = '有效期止不能早于有效期起';
      }
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        setError('请先修正表单中标红的字段');
        return false;
      }
      return true;
    };
    const run = async (action: () => Promise<void>): Promise<void> => {
      setBusy(true);
      setError('');
      setNotice('');
      try {
        await action();
      } catch (e) {
        setError((e as Error).message || '操作失败，请稍后重试');
      } finally {
        setBusy(false);
      }
    };
    const saveDraft = (event: Event): void => {
      event.preventDefault();
      if (!validate()) return;
      void run(async () => {
        const result = await api('/api/v1/sso/account/real-name', {
          method: 'POST',
          body: JSON.stringify({
            realName: form.value.realName.trim(),
            idCard: form.value.idCard.trim().toUpperCase(),
            contactPhone: form.value.contactPhone.trim(),
            address: form.value.address.trim(),
            businessType: form.value.businessType,
            validStart: form.value.validStart,
            validEnd: form.value.validEnd,
            email: form.value.email.trim()
          })
        });
        if (result.code !== 0) throw new Error(result.message ?? '实名资料保存失败');
        await __props.onRefresh();
        setFormOpen(false);
        setNotice('身份证资料已保存，请继续完成人脸活体与公安二要素核验');
      });
    };
    const doLiveness = (): void => {
      void run(async () => {
        const result = await api('/api/v1/sso/account/real-name/liveness', {
          method: 'POST'
        });
        if (result.code !== 0) throw new Error(result.message ?? '人脸活体检测失败');
        await __props.onRefresh();
        setNotice('人脸活体检测已通过');
      });
    };
    const doPolice = (event: Event): void => {
      event.preventDefault();
      if (!policeForm.value.realName.trim() || !validIdNo(policeForm.value.idCard)) {
        setError('请输入与证件一致的姓名和 18 位身份证号');
        return;
      }
      void run(async () => {
        const result = await api('/api/v1/sso/account/real-name/police', {
          method: 'POST',
          body: JSON.stringify({
            realName: policeForm.value.realName.trim(),
            idCard: policeForm.value.idCard.trim().toUpperCase()
          })
        });
        if (result.code !== 0) throw new Error(result.message ?? '公安二要素核验失败');
        await __props.onRefresh();
        setPoliceOpen(false);
        setPoliceForm(current => ({
          ...current,
          idCard: ''
        }));
        setNotice('公安二要素核验已通过，可提交实名审核');
      });
    };
    const submitReview = (): void => {
      void run(async () => {
        const result = await api('/api/v1/sso/account/real-name/submit', {
          method: 'POST'
        });
        if (result.code !== 0) throw new Error(result.message ?? '提交审核失败');
        await __props.onRefresh();
        setNotice('实名认证已提交平台审核');
      });
    };
    const steps = computed(() => [{
      label: '资料登记',
      done: Boolean(__props.record)
    }, {
      label: '人脸活体',
      done: Boolean(__props.record?.livenessVerified)
    }, {
      label: '公安比对',
      done: Boolean(__props.record?.policeVerified)
    }, {
      label: '提交审核',
      done: ['pending', 'verified'].includes(status.value)
    }]);
    const canLiveness = computed(() => editable.value && Boolean(__props.record) && !__props.record?.livenessVerified);
    const canPolice = computed(() => editable.value && Boolean(__props.record?.livenessVerified) && !__props.record?.policeVerified);
    const canSubmit = computed(() => editable.value && Boolean(__props.record?.livenessVerified) && Boolean(__props.record?.policeVerified));
    const rejectedRemark = computed(() => __props.record?.reviewRemark ?? '');
    return () => {
      const view_meta = meta.value;
      const view_error = error.value;
      const view_notice = notice.value;
      const view_status = status.value;
      const view_prop_record = __props.record;
      const view_editable = editable.value;
      const view_rejectedRemark = rejectedRemark.value;
      const view_busy = busy.value;
      const view_canLiveness = canLiveness.value;
      const view_canPolice = canPolice.value;
      const view_form = form.value;
      const view_policeOpen = policeOpen.value;
      const view_policeForm = policeForm.value;
      const view_formOpen = formOpen.value;
      const view_canSubmit = canSubmit.value;
      const view_fieldErrors = fieldErrors.value;
      return <div class="uc-realname">
      <section class={`card account-card uc-realname-hero tone-${view_meta.tone}`}>
        <div class="uc-realname-hero-main">
          <span class="uc-realname-hero-icon"><Icon name="shield" size={22} /></span>
          <div>
            <h2>个人实名认证 <span class={`account-status ${view_meta.tone}`}>{view_meta.label}</span></h2>
            <p>{view_meta.desc}</p>
          </div>
        </div>
        <div class="realname-progress">
          {steps.value.map((step, index) => <div class={`realname-progress-step ${step.done ? 'done' : ''}`} key={step.label}>
              <span>{step.done ? '✓' : index + 1}</span>
              <small>{step.label}</small>
            </div>)}
        </div>
      </section>

      {view_error !== '' && <div class="account-error">{view_error}</div>}
      {view_notice !== '' && <div class="account-notice">{view_notice}</div>}

      {view_status === 'verified' && view_prop_record && <section class="card account-card">
          <div class="account-card-head">
            <h2>认证信息</h2>
            <span>如需变更请联系平台运营发起信息变更</span>
          </div>
          <div class="account-info-list">
            <div><span>姓名</span><strong>{view_prop_record.realName}</strong></div>
            <div><span>证件类型</span><strong>居民身份证</strong></div>
            <div><span>证件号码</span><strong>{view_prop_record.idNoMasked}</strong></div>
            <div><span>有效期</span><strong>{view_prop_record.validStart || '—'} 至 {view_prop_record.validEnd || '—'}</strong></div>
            <div><span>联系电话</span><strong>{view_prop_record.contactPhone || '—'}</strong></div>
            <div><span>常住地址</span><strong>{view_prop_record.address || '—'}</strong></div>
            <div><span>认证渠道</span><strong>{view_prop_record.verificationChannel || '公安二要素 + 活体'}</strong></div>
            <div><span>审核通过时间</span><strong>{fmtTime(view_prop_record.submitTime)}</strong></div>
          </div>
        </section>}

      {view_status === 'pending' && view_prop_record && <section class="card account-card">
          <div class="account-card-head"><h2>已提交审核</h2><span>{fmtTime(view_prop_record.submitTime)}</span></div>
          <p class="uc-muted">
            平台运营正在核验资料，通常 1-2 个工作日内出结果；审核结果会以站内信通知。
            审核期间资料不可修改，如填错请联系平台运营驳回后重新提交。
          </p>
          <div class="uc-realname-summary">
            <div><span>姓名</span><strong>{view_prop_record.realName}</strong></div>
            <div><span>证件号码</span><strong>{view_prop_record.idNoMasked}</strong></div>
            <div><span>人脸活体</span><strong>{view_prop_record.livenessVerified ? '已通过' : '待检测'}</strong></div>
            <div><span>公安二要素</span><strong>{view_prop_record.policeVerified ? '已通过' : '待核验'}</strong></div>
          </div>
        </section>}

      {view_editable && <section class="card account-card">
          <div class="account-card-head">
            <h2>{view_prop_record ? '继续完成核验' : '办理实名认证'}</h2>
            <span>{view_prop_record ? `资料提交于 ${fmtTime(view_prop_record.submitTime)}` : '约需 3 分钟'}</span>
          </div>

          {view_status === 'rejected' && view_rejectedRemark !== '' && <div class="account-error">审核驳回：{view_rejectedRemark}</div>}

          {view_prop_record && <div class="uc-realname-record">
              <div><span>姓名</span><strong>{view_prop_record.realName}</strong></div>
              <div><span>证件号码</span><strong>{view_prop_record.idNoMasked}</strong></div>
              <div><span>有效期</span><strong>{view_prop_record.validStart || '—'} 至 {view_prop_record.validEnd || '—'}</strong></div>
              <div><span>联系电话</span><strong>{view_prop_record.contactPhone || '—'}</strong></div>
            </div>}

          <div class="realname-action-grid">
            <button type="button" class={`realname-action ${view_prop_record?.livenessVerified ? 'done' : ''}`} disabled={view_busy || !view_canLiveness} onClick={doLiveness}>
              <span>{view_prop_record?.livenessVerified ? '✓' : '1'}</span>
              <div>
                <strong>{view_prop_record?.livenessVerified ? '人脸活体已通过' : '人脸活体检测'}</strong>
                <small>{view_prop_record?.livenessVerified ? '通过时间 ' + fmtTime(view_prop_record.livenessVerifiedAt) : '按提示完成眨眼、转头等动作'}</small>
              </div>
            </button>
            <button type="button" class={`realname-action ${view_prop_record?.policeVerified ? 'done' : ''}`} disabled={view_busy || !view_canPolice} onClick={() => {
              setPoliceOpen(true);
              setError('');
              setPoliceForm({
                realName: view_prop_record?.realName ?? view_form.realName,
                idCard: ''
              });
            }}>
              <span>{view_prop_record?.policeVerified ? '✓' : '2'}</span>
              <div>
                <strong>{view_prop_record?.policeVerified ? '公安二要素已通过' : '公安二要素核验'}</strong>
                <small>{view_prop_record?.policeVerified ? '通过时间 ' + fmtTime(view_prop_record.policeVerifiedAt) : view_prop_record?.livenessVerified ? '输入姓名与身份证号与草稿比对' : '需先通过人脸活体检测'}</small>
              </div>
            </button>
          </div>

          {view_policeOpen && <form class="uc-realname-police" onSubmit={doPolice}>
              <div class="realname-form-head">
                <strong>公安二要素核验</strong>
                <span>与已保存的证件资料比对，号码只用于本次核验，不会回显</span>
              </div>
              <div class="account-form-grid">
                <label>姓名
                  <input class="input" value={view_policeForm.realName} onInput={event => setPoliceForm({
                  ...view_policeForm,
                  realName: (event.target as HTMLInputElement).value
                })} />
                </label>
                <label>身份证号
                  <input class="input" value={view_policeForm.idCard} maxlength={18} placeholder="18 位身份证号" onInput={event => setPoliceForm({
                  ...view_policeForm,
                  idCard: (event.target as HTMLInputElement).value.replace(/\s/g, '').toUpperCase()
                })} />
                </label>
              </div>
              <div class="account-form-actions">
                <button type="submit" class="btn btn-primary" disabled={view_busy}>{view_busy ? '核验中…' : '提交核验'}</button>
                <button type="button" class="btn btn-ghost" onClick={() => setPoliceOpen(false)}>取消</button>
              </div>
            </form>}

          <div class="realname-action-footer">
            <button type="button" class={view_prop_record ? 'btn btn-ghost' : 'btn btn-primary'} disabled={view_busy} onClick={() => {
              setFormOpen(!view_formOpen);
              setError('');
            }}>
              {view_formOpen ? '收起资料' : view_prop_record ? '修改证件资料' : '填写身份证资料'}
            </button>
            {view_prop_record && <button type="button" class="btn btn-primary" disabled={view_busy || !view_canSubmit} onClick={submitReview}>
                {view_busy ? '提交中…' : '提交实名审核'}
              </button>}
          </div>
          {view_prop_record && !view_canSubmit && <p class="uc-field-hint">
              提交前需依次完成：人脸活体 → 公安二要素核验。
            </p>}

          {view_formOpen && <form class="account-realname-form" onSubmit={saveDraft}>
              <div class="realname-form-head">
                <strong>身份证资料</strong>
                <span>姓名、证件号与有效期将用于公安二要素比对</span>
              </div>
              <div class="account-form-grid">
                <label>真实姓名
                  <input class="input" value={view_form.realName} placeholder="与身份证一致" onInput={event => patch({
                  realName: (event.target as HTMLInputElement).value
                })} />
                  {view_fieldErrors.realName && <small class="uc-field-error">{view_fieldErrors.realName}</small>}
                </label>
                <label>身份证号
                  <input class="input" value={view_form.idCard} maxlength={18} placeholder="18 位身份证号" onInput={event => patch({
                  idCard: (event.target as HTMLInputElement).value.replace(/\s/g, '').toUpperCase()
                })} />
                  {view_fieldErrors.idCard && <small class="uc-field-error">{view_fieldErrors.idCard}</small>}
                </label>
                <label>证件有效期起
                  <input class="input" type="date" value={view_form.validStart} onInput={event => patch({
                  validStart: (event.target as HTMLInputElement).value
                })} />
                </label>
                <label>证件有效期止
                  <input class="input" type="date" value={view_form.validEnd} onInput={event => patch({
                  validEnd: (event.target as HTMLInputElement).value
                })} />
                  {view_fieldErrors.validEnd && <small class="uc-field-error">{view_fieldErrors.validEnd}</small>}
                </label>
                <label>联系电话
                  <input class="input" type="tel" value={view_form.contactPhone} maxlength={11} onInput={event => patch({
                  contactPhone: (event.target as HTMLInputElement).value.replace(/\D/g, '')
                })} />
                  {view_fieldErrors.contactPhone && <small class="uc-field-error">{view_fieldErrors.contactPhone}</small>}
                </label>
                <label>经营类型
                  <select class="select" value={view_form.businessType} onChange={event => patch({
                  businessType: (event.target as HTMLInputElement).value
                })}>
                    {BUSINESS_TYPES.map(item => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <label>常住地址
                <input class="input" value={view_form.address} placeholder="省 / 市 / 区 / 详细地址" onInput={event => patch({
                address: (event.target as HTMLInputElement).value
              })} />
                {view_fieldErrors.address && <small class="uc-field-error">{view_fieldErrors.address}</small>}
              </label>
              <label>联系邮箱 <small class="uc-muted">选填</small>
                <input class="input" type="email" value={view_form.email} onInput={event => patch({
                email: (event.target as HTMLInputElement).value
              })} />
                {view_fieldErrors.email && <small class="uc-field-error">{view_fieldErrors.email}</small>}
              </label>
              <div class="account-form-actions">
                <button type="submit" class="btn btn-primary" disabled={view_busy}>
                  {view_busy ? '保存中…' : '保存资料并进入核验'}
                </button>
                <button type="button" class="btn btn-ghost" onClick={() => setFormOpen(false)}>取消</button>
              </div>
              <p class="uc-field-hint">
                身份证号明文只在提交时短暂使用，入库前转为掩码与加盐摘要，运营端也看不到明文。
              </p>
            </form>}
        </section>}

      {(view_status === 'pending' || view_status === 'verified') && view_prop_record && <section class="card account-card">
          <div class="account-card-head"><h2>办理记录</h2></div>
          <ul class="uc-realname-timeline">
            <li class="done">
              <span>资料登记</span>
              <small>{fmtTime(view_prop_record.submitTime)}</small>
            </li>
            <li class={view_prop_record.livenessVerified ? 'done' : ''}>
              <span>人脸活体</span>
              <small>{view_prop_record.livenessVerified ? fmtTime(view_prop_record.livenessVerifiedAt) : '待检测'}</small>
            </li>
            <li class={view_prop_record.policeVerified ? 'done' : ''}>
              <span>公安二要素</span>
              <small>{view_prop_record.policeVerified ? fmtTime(view_prop_record.policeVerifiedAt) : '待核验'}</small>
            </li>
            <li class={view_status === 'verified' ? 'done' : ''}>
              <span>平台审核</span>
              <small>{view_status === 'verified' ? '已通过' : '审核中'}</small>
            </li>
          </ul>
        </section>}

      <section class="uc-realname-tips">
        <div class="card">
          <div class="account-card-head"><h2>为什么需要实名认证</h2></div>
          <p class="uc-muted">实名认证用于确认交易主体身份，是参与大宗交易、在线签约与申请供应链金融的前提。</p>
        </div>
        <div class="card">
          <div class="account-card-head"><h2>信息如何保护</h2></div>
          <p class="uc-muted">身份证号仅用于核验与合规留痕，平台只保存掩码与加盐摘要，前台与运营端都不展示明文。</p>
        </div>
        <div class="card">
          <div class="account-card-head"><h2>办理须知</h2></div>
          <ul class="uc-realname-rules">
            <li>姓名、身份证号须与证件完全一致</li>
            <li>一个身份证号只能绑定一个平台账号</li>
            <li>审核中或已认证的资料不能自行修改</li>
          </ul>
        </div>
      </section>
    </div>;
    };
  }
});
