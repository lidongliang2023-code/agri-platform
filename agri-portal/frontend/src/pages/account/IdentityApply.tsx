import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 用户中心 · 身份申请
 *
 * <p>数据来自 `GET /api/v1/sso/account/identity-applications`：接口返回**全部 7 类身份**
 * 及其当前状态（available / pending / approved / rejected / cancelled），
 * 页面据此渲染"去申请 / 审核中 / 已开通 / 已驳回"。</p>
 *
 * <p><b>审核通过只是单据状态变化</b>：不改主体绑定、不改权限。页面上把这点写明，
 * 避免用户以为"通过就能立刻用全部功能"。</p>
 */

import { Icon } from '@/components/Icon';
interface IdentityRow {
  code: string;
  label: string;
  status: string;
  applicationId: string | null;
  applyNote: string | null;
  reviewRemark: string | null;
  applyTime: string | null;
  reviewTime: string | null;
}

/** 业务能力：身份审核通过后 granted=true */
interface CapabilityRow {
  code: string;
  label: string;
  identityLabel: string;
  description: string;
  granted: boolean;
  identityStatus: string;
}
interface ApiBody<T> {
  code: number;
  message?: string;
  data?: T;
}

/** 当前登录主体（身份申请的主体名称/信用代码以它为准） */
interface MerchantInfo {
  merchantId: string | number;
  merchantName: string;
  creditCode?: string;
}

/** 账号概览里与主体相关的部分（Cookie 会话即可读取，无需额外令牌） */
interface AccountSummaryLite {
  activeMerchantId?: string | null;
  merchants?: Array<{
    merchantId: string;
    merchantName: string | null;
    creditCode: string | null;
  }>;
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  const body = (await response.json()) as ApiBody<T>;
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败');
  }
  return body.data as T;
}

/** 身份状态展示元数据 */
const STATUS_META: Record<string, {
  label: string;
  color: string;
}> = {
  available: {
    label: '可申请',
    color: 'default'
  },
  pending: {
    label: '审核中',
    color: 'orange'
  },
  approved: {
    label: '已开通',
    color: 'green'
  },
  rejected: {
    label: '已驳回',
    color: 'red'
  },
  cancelled: {
    label: '已撤回',
    color: 'default'
  }
};

/** 身份图标 */
const IDENTITY_ICON: Record<string, string> = {
  wholesaler: 'cart',
  retailer: 'box',
  farmer: 'seed',
  coop_admin: 'users',
  mall_supplier: 'box',
  service_provider: 'tool',
  government: 'shield'
};
interface ApplyForm {
  identityType: string;
  subjectName: string;
  creditCode: string;
  businessPlace: string;
  businessCategory: string;
  annualVolume: string;
  contactName: string;
  contactPhone: string;
  applyNote: string;
}
const EMPTY_FORM: ApplyForm = {
  identityType: '',
  subjectName: '',
  creditCode: '',
  businessPlace: '',
  businessCategory: '',
  annualVolume: '',
  contactName: '',
  contactPhone: '',
  applyNote: ''
};

/**
 * 身份申请页面
 *
 * @returns 页面内容
 */
export const IdentityApply = defineComponent({
  name: "IdentityApply",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = ref<IdentityRow[]>([]);
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const notice = ref('');
    const setNotice = (next: typeof notice.value | ((previous: typeof notice.value) => typeof notice.value)) => {
      notice.value = typeof next === 'function' ? (next as (previous: typeof notice.value) => typeof notice.value)(notice.value) : next;
    };
    const form = ref<ApplyForm | null>(null);
    const setForm = (next: typeof form.value | ((previous: typeof form.value) => typeof form.value)) => {
      form.value = typeof next === 'function' ? (next as (previous: typeof form.value) => typeof form.value)(form.value) : next;
    };
    const saving = ref(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const capabilities = ref<CapabilityRow[]>([]);
    const setCapabilities = (next: typeof capabilities.value | ((previous: typeof capabilities.value) => typeof capabilities.value)) => {
      capabilities.value = typeof next === 'function' ? (next as (previous: typeof capabilities.value) => typeof capabilities.value)(capabilities.value) : next;
    };
    const merchant = ref<MerchantInfo | null>(null);
    const setMerchant = (next: typeof merchant.value | ((previous: typeof merchant.value) => typeof merchant.value)) => {
      merchant.value = typeof next === 'function' ? (next as (previous: typeof merchant.value) => typeof merchant.value)(merchant.value) : next;
    };
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      try {
        const [data, capabilityData, summary] = await Promise.all([api<{
          identities?: IdentityRow[];
        }>('/api/v1/sso/account/identity-applications'), api<{
          capabilities?: CapabilityRow[];
        }>('/api/v1/sso/account/capabilities'), api<AccountSummaryLite>('/api/v1/sso/account/summary')]);
        setRows(data?.identities ?? []);
        setCapabilities(capabilityData?.capabilities ?? []);
        const merchantRows = summary?.merchants ?? [];
        const active = merchantRows.find(item => summary?.activeMerchantId && String(item.merchantId) === String(summary.activeMerchantId)) ?? merchantRows[0];
        setMerchant(active ? {
          merchantId: active.merchantId,
          merchantName: active.merchantName ?? '',
          creditCode: active.creditCode ?? ''
        } : null);
      } catch (e) {
        setError((e as Error).message || '身份申请加载失败');
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          void load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const openApply = (row: IdentityRow): void => {
      setForm({
        ...EMPTY_FORM,
        identityType: row.code,
        // 主体名称与信用代码默认带出当前登录主体，且不可修改（服务端同样强制覆盖）
        subjectName: merchant.value?.merchantName ?? '',
        creditCode: merchant.value?.creditCode ?? ''
      });
      setNotice('');
    };
    const submit = async (): Promise<void> => {
      if (!form.value) return;
      if (!merchant.value) {
        setError('当前账号还没有绑定经营主体，请先在「经营主体」页创建或加入主体');
        return;
      }
      if (!form.value.subjectName.trim()) {
        setError('当前经营主体缺少名称，请先在经营主体页面补全');
        return;
      }
      setSaving(true);
      setError('');
      try {
        await api('/api/v1/sso/account/identity-applications', {
          method: 'POST',
          body: JSON.stringify({
            identityType: form.value.identityType,
            subjectName: form.value.subjectName.trim(),
            creditCode: form.value.creditCode.trim() || null,
            businessPlace: form.value.businessPlace.trim() || null,
            businessCategory: form.value.businessCategory.trim() || null,
            annualVolume: form.value.annualVolume.trim() || null,
            contactName: form.value.contactName.trim() || null,
            contactPhone: form.value.contactPhone.trim() || null,
            applyNote: form.value.applyNote.trim() || null
          })
        });
        setNotice('身份申请已提交，等待平台审核');
        setForm(null);
        await load();
      } catch (e) {
        setError((e as Error).message || '提交失败');
      } finally {
        setSaving(false);
      }
    };
    const cancel = async (row: IdentityRow): Promise<void> => {
      if (!row.applicationId) return;
      setSaving(true);
      setError('');
      try {
        await api(`/api/v1/sso/account/identity-applications/${row.applicationId}`, {
          method: 'DELETE'
        });
        setNotice(`已撤回「${row.label}」申请`);
        await load();
      } catch (e) {
        setError((e as Error).message || '撤回失败');
      } finally {
        setSaving(false);
      }
    };
    const approvedCount = computed(() => rows.value.filter(row => row.status === 'approved').length);
    return () => {
      const view_rows = rows.value;
      const view_approvedCount = approvedCount.value;
      const view_loading = loading.value;
      const view_capabilities = capabilities.value;
      const view_merchant = merchant.value;
      const view_notice = notice.value;
      const view_error = error.value;
      const view_saving = saving.value;
      const view_form = form.value;
      return <div class="uc-id">
      <div class="uc-id-head">
        <div>
          <strong>可申请身份 {view_rows.length} 类 · 已开通 {view_approvedCount} 类</strong>
          <small>一个账号可以同时持有多个身份，切换身份即切换可用的业务能力</small>
        </div>
        <button class="btn btn-outline btn-sm" onClick={() => void load()} disabled={view_loading}>
          刷新
        </button>
      </div>

      {!view_loading && <div class="uc-cap-strip">
          <span class="uc-cap-strip-label">已开通能力</span>
          {view_capabilities.some(item => item.granted) ? view_capabilities.filter(item => item.granted).map(item => <b key={item.code} class="uc-cap-chip" title={item.description}>{item.label}</b>) : <small class="uc-muted">暂无 —— 对应业务身份审核通过后自动生效</small>}
        </div>}

      {!view_loading && !view_merchant && <div class="account-notice">
          当前账号还没有绑定经营主体，申请业务身份前请先在「账户中心 → 经营主体」创建或加入主体。
        </div>}

      {view_notice && <div class="account-notice">{view_notice}</div>}
      {view_error && <div class="account-error">{view_error}</div>}
      {view_loading && <div class="card empty">正在加载身份…</div>}

      {!view_loading && !view_error && <ul class="uc-id-list">
          {view_rows.map(row => {
            const meta = STATUS_META[row.status] ?? STATUS_META.available;
            const canApply = row.status === 'available' || row.status === 'rejected' || row.status === 'cancelled';
            return <li key={row.code} class={row.status === 'approved' ? 'on' : ''}>
                <span class="uc-id-icon">
                  <Icon name={IDENTITY_ICON[row.code] ?? 'user'} size={18} />
                </span>
                <div class="uc-id-body">
                  <div class="uc-id-title">
                    <strong>{row.label}</strong>
                    <span class={`uc-status ${meta.color}`}>{meta.label}</span>
                  </div>
                  <small>
                    {row.status === 'pending' ? `提交于 ${String(row.applyTime ?? '').replace('T', ' ').slice(0, 16)}，等待平台审核` : row.status === 'approved' ? `开通于 ${String(row.reviewTime ?? '').replace('T', ' ').slice(0, 16)}` : row.status === 'rejected' ? `驳回原因：${row.reviewRemark || '未填写'}` : row.status === 'cancelled' ? `已于 ${String(row.applyTime ?? '').replace('T', ' ').slice(0, 16)} 撤回，可重新申请` : '尚未申请'}
                  </small>
                </div>
                <div class="uc-id-actions">
                  {canApply && <button class="btn btn-outline btn-sm" disabled={view_saving} onClick={() => openApply(row)}>
                      {row.status === 'available' ? '去申请' : '重新申请'}
                    </button>}
                  {row.status === 'pending' && <button class="btn btn-outline btn-sm" disabled={view_saving} onClick={() => void cancel(row)}>
                      撤回
                    </button>}
                </div>
              </li>;
          })}
        </ul>}

      {view_form && <div class="uc-id-mask" onClick={() => setForm(null)}>
          <div class="uc-id-modal" onClick={event => event.stopPropagation()}>
            <h3>申请身份：{view_rows.find(row => row.code === view_form.identityType)?.label ?? view_form.identityType}</h3>
            <label>
              主体名称 <span class="uc-id-req">*</span>
              <input value={view_form.subjectName} readonly placeholder="当前登录主体" />
              <small class="uc-muted">来自当前登录主体，不可修改</small>
            </label>
            <div class="uc-id-row">
              <label>
                统一社会信用代码
                <input value={view_form.creditCode} readonly placeholder="当前主体未填写信用代码" />
                <small class="uc-muted">来自当前登录主体，不可修改</small>
              </label>
              <label>
                经营场所
                <input value={view_form.businessPlace} placeholder="选填" onInput={event => setForm({
                  ...view_form,
                  businessPlace: (event.target as HTMLInputElement).value
                })} />
              </label>
            </div>
            <div class="uc-id-row">
              <label>
                经营品类
                <input value={view_form.businessCategory} placeholder="选填" onInput={event => setForm({
                  ...view_form,
                  businessCategory: (event.target as HTMLInputElement).value
                })} />
              </label>
              <label>
                年交易量
                <input value={view_form.annualVolume} placeholder="选填，如 800 吨" onInput={event => setForm({
                  ...view_form,
                  annualVolume: (event.target as HTMLInputElement).value
                })} />
              </label>
            </div>
            <div class="uc-id-row">
              <label>
                联系人
                <input value={view_form.contactName} placeholder="选填" onInput={event => setForm({
                  ...view_form,
                  contactName: (event.target as HTMLInputElement).value
                })} />
              </label>
              <label>
                联系电话
                <input value={view_form.contactPhone} placeholder="选填" onInput={event => setForm({
                  ...view_form,
                  contactPhone: (event.target as HTMLInputElement).value
                })} />
              </label>
            </div>
            <label>
              申请说明
              <textarea rows={3} value={view_form.applyNote} placeholder="简要说明经营情况与申请用途" onInput={event => setForm({
                ...view_form,
                applyNote: (event.target as HTMLInputElement).value
              })} />
            </label>
            <div class="uc-id-modal-actions">
              <button class="btn btn-outline btn-sm" onClick={() => setForm(null)} disabled={view_saving}>
                取消
              </button>
              <button class="btn btn-primary btn-sm" onClick={() => void submit()} disabled={view_saving}>
                提交申请
              </button>
            </div>
          </div>
        </div>}

      <p class="uc-msg-foot">
        <Icon name="alert" size={13} />
        <span>
          审核通过只代表身份申请单已批准；对应的业务权限由平台按角色另行开通，可能需要一点时间。
        </span>
      </p>
    </div>;
    };
  }
});
