import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 用户中心 · 资质证照
 *
 * <p>数据来自 `GET /api/v1/sso/account/certificates`：返回**我名下全部主体**的证照，
 * 每条带服务端现算的到期状态（`valid` / `expiring` / `expired` / `permanent`）。</p>
 *
 * <p><b>为什么到期状态不在前端算</b>：前端算一次、后端算一次，两边迟早对不上；
 * 也不落库 —— 存下来的状态今天对、明天就错了。</p>
 *
 * <p><b>影像件走受控上传</b>：图片统一传到
 * `POST /api/v1/sso/account/businesses/{merchantId}/certification-files?kind=certificate`，
 * 后端返回受控地址并校验归属；页面不再让用户手填 URL。
 * 服务端保存证照时也会校验地址必须是本服务生成的，任意外链会被拒绝。</p>
 */

import { Icon } from '@/components/Icon';
interface CertType {
  code: string;
  label: string;
}
interface CertRow {
  id: string;
  merchantId: string;
  merchantName: string | null;
  certType: string;
  certName: string;
  certNo: string | null;
  issueOrg: string | null;
  issueDate: string | null;
  expireDate: string | null;
  expireState: string;
  daysToExpire: number | null;
  fileUrl: string | null;
  remark: string | null;
}
interface CertPayload {
  records?: CertRow[];
  types?: CertType[];
  expiringCount?: number;
  expiredCount?: number;
}
interface MerchantOption {
  merchantId: string;
  merchantName: string;
  memberType?: string | null;
}
interface ApiBody<T> {
  code: number;
  message?: string;
  data?: T;
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
  let body: ApiBody<T>;
  try {
    body = (await response.json()) as ApiBody<T>;
  } catch {
    throw new Error('服务返回异常，请稍后重试');
  }
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败');
  }
  return body.data as T;
}

/** 图片上传（multipart，不能带 Content-Type，交给浏览器生成 boundary） */
async function uploadCertImage(merchantId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`/api/v1/sso/account/businesses/${merchantId}/certification-files?kind=certificate`, {
    method: 'POST',
    credentials: 'include',
    body: form
  });
  const body = (await response.json()) as ApiBody<{
    url?: string;
  }>;
  if (!response.ok || body.code !== 0 || !body.data?.url) {
    throw new Error(body.message || '图片上传失败');
  }
  return body.data.url;
}

/** 到期状态展示元数据 */
const STATE_META: Record<string, {
  label: string;
  color: string;
}> = {
  valid: {
    label: '有效',
    color: 'green'
  },
  expiring: {
    label: '即将到期',
    color: 'orange'
  },
  expired: {
    label: '已过期',
    color: 'red'
  },
  permanent: {
    label: '长期有效',
    color: 'blue'
  }
};
interface CertForm {
  id?: string;
  merchantId: string;
  certType: string;
  certName: string;
  certNo: string;
  issueOrg: string;
  issueDate: string;
  expireDate: string;
  permanent: boolean;
  fileUrl: string;
  remark: string;
}
const EMPTY_FORM: CertForm = {
  merchantId: '',
  certType: 'business_license',
  certName: '',
  certNo: '',
  issueOrg: '',
  issueDate: '',
  expireDate: '',
  permanent: false,
  fileUrl: '',
  remark: ''
};
const fmtDate = (value: string | null): string => value ? value.slice(0, 10) : '—';

/**
 * 资质证照页面
 *
 * @returns 页面内容
 */
export const Certificates = defineComponent({
  name: "Certificates",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = ref<CertRow[]>([]);
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const types = ref<CertType[]>([]);
    const setTypes = (next: typeof types.value | ((previous: typeof types.value) => typeof types.value)) => {
      types.value = typeof next === 'function' ? (next as (previous: typeof types.value) => typeof types.value)(types.value) : next;
    };
    const merchants = ref<MerchantOption[]>([]);
    const setMerchants = (next: typeof merchants.value | ((previous: typeof merchants.value) => typeof merchants.value)) => {
      merchants.value = typeof next === 'function' ? (next as (previous: typeof merchants.value) => typeof merchants.value)(merchants.value) : next;
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
    const form = ref<CertForm | null>(null);
    const setForm = (next: typeof form.value | ((previous: typeof form.value) => typeof form.value)) => {
      form.value = typeof next === 'function' ? (next as (previous: typeof form.value) => typeof form.value)(form.value) : next;
    };
    const fieldErrors = ref<Record<string, string>>({});
    const setFieldErrors = (next: typeof fieldErrors.value | ((previous: typeof fieldErrors.value) => typeof fieldErrors.value)) => {
      fieldErrors.value = typeof next === 'function' ? (next as (previous: typeof fieldErrors.value) => typeof fieldErrors.value)(fieldErrors.value) : next;
    };
    const saving = ref(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const uploading = ref(false);
    const setUploading = (next: typeof uploading.value | ((previous: typeof uploading.value) => typeof uploading.value)) => {
      uploading.value = typeof next === 'function' ? (next as (previous: typeof uploading.value) => typeof uploading.value)(uploading.value) : next;
    };
    const preview = ref<CertRow | null>(null);
    const setPreview = (next: typeof preview.value | ((previous: typeof preview.value) => typeof preview.value)) => {
      preview.value = typeof next === 'function' ? (next as (previous: typeof preview.value) => typeof preview.value)(preview.value) : next;
    };
    const pendingDelete = ref<CertRow | null>(null);
    const setPendingDelete = (next: typeof pendingDelete.value | ((previous: typeof pendingDelete.value) => typeof pendingDelete.value)) => {
      pendingDelete.value = typeof next === 'function' ? (next as (previous: typeof pendingDelete.value) => typeof pendingDelete.value)(pendingDelete.value) : next;
    };
    const subjectFilter = ref('');
    const setSubjectFilter = (next: typeof subjectFilter.value | ((previous: typeof subjectFilter.value) => typeof subjectFilter.value)) => {
      subjectFilter.value = typeof next === 'function' ? (next as (previous: typeof subjectFilter.value) => typeof subjectFilter.value)(subjectFilter.value) : next;
    };
    const stateFilter = ref('');
    const setStateFilter = (next: typeof stateFilter.value | ((previous: typeof stateFilter.value) => typeof stateFilter.value)) => {
      stateFilter.value = typeof next === 'function' ? (next as (previous: typeof stateFilter.value) => typeof stateFilter.value)(stateFilter.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const fileInputRef = shallowRef<HTMLInputElement | null | null>(null);
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      try {
        const [certs, summary] = await Promise.all([api<CertPayload>('/api/v1/sso/account/certificates'), api<{
          merchants?: MerchantOption[];
        }>('/api/v1/sso/account/summary')]);
        setRows(certs?.records ?? []);
        setTypes(certs?.types ?? []);
        setMerchants((summary?.merchants ?? []).map(item => ({
          merchantId: String(item.merchantId ?? ''),
          merchantName: String(item.merchantName ?? '未命名主体'),
          memberType: item.memberType ?? null
        })));
      } catch (e) {
        setError((e as Error).message || '证照加载失败');
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
    const typeLabel = computed(() => {
      const map = new Map<string, string>();
      types.value.forEach(item => map.set(item.code, item.label));
      return map;
    });
    const stats = computed(() => {
      const counter = {
        valid: 0,
        expiring: 0,
        expired: 0,
        permanent: 0
      };
      rows.value.forEach(row => {
        const key = row.expireState as keyof typeof counter;
        if (key in counter) counter[key] += 1;
      });
      return counter;
    });
    const visibleRows = computed(() => {
      const kw = keyword.value.trim().toLowerCase();
      return rows.value.filter(row => {
        if (subjectFilter.value && row.merchantId !== subjectFilter.value) return false;
        if (stateFilter.value && row.expireState !== stateFilter.value) return false;
        if (!kw) return true;
        return [row.certName, row.certNo, row.issueOrg, row.merchantName].filter(Boolean).some(text => String(text).toLowerCase().includes(kw));
      });
    });
    const openCreate = (): void => {
      // 名称默认跟随第一个证照类型，减少一次手输；用户可随时改
      setForm({
        ...EMPTY_FORM,
        merchantId: merchants.value[0]?.merchantId ?? '',
        certName: types.value[0]?.label ?? '营业执照'
      });
      setFieldErrors({});
      setError('');
      setNotice('');
    };
    const openEdit = (row: CertRow): void => {
      setForm({
        id: row.id,
        merchantId: row.merchantId,
        certType: row.certType,
        certName: row.certName,
        certNo: row.certNo ?? '',
        issueOrg: row.issueOrg ?? '',
        issueDate: row.issueDate ?? '',
        expireDate: row.expireDate ?? '',
        permanent: !row.expireDate,
        fileUrl: row.fileUrl ?? '',
        remark: row.remark ?? ''
      });
      setFieldErrors({});
      setError('');
      setNotice('');
    };
    const patch = (next: Partial<CertForm>): void => {
      setForm(current => current ? {
        ...current,
        ...next
      } : current);
      setError('');
      setFieldErrors({});
    };
    const validate = (target: CertForm): boolean => {
      const errors: Record<string, string> = {};
      if (!target.merchantId) errors.merchantId = '请选择所属主体';
      if (!target.certName.trim()) errors.certName = '请填写证照名称';
      if (!target.permanent && !target.expireDate) errors.expireDate = '请填写有效期至，或勾选长期有效';
      if (target.issueDate && target.expireDate && target.expireDate < target.issueDate) {
        errors.expireDate = '有效期不能早于发证日期';
      }
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        setError('请先修正表单中标红的字段');
        return false;
      }
      return true;
    };
    const save = async (): Promise<void> => {
      if (!form.value) return;
      if (!validate(form.value)) return;
      setSaving(true);
      setError('');
      try {
        const payload = {
          merchantId: form.value.merchantId,
          certType: form.value.certType,
          certName: form.value.certName.trim(),
          certNo: form.value.certNo.trim() || null,
          issueOrg: form.value.issueOrg.trim() || null,
          issueDate: form.value.issueDate || null,
          expireDate: form.value.permanent ? null : form.value.expireDate,
          fileUrl: form.value.fileUrl || null,
          remark: form.value.remark.trim() || null
        };
        if (form.value.id) {
          await api(`/api/v1/sso/account/certificates/${form.value.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
          setNotice('证照已更新');
        } else {
          await api('/api/v1/sso/account/certificates', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          setNotice('证照已新增');
        }
        setForm(null);
        await load();
      } catch (e) {
        setError((e as Error).message || '保存失败');
      } finally {
        setSaving(false);
      }
    };
    const uploadImage = async (file: File): Promise<void> => {
      if (!form.value) return;
      if (!form.value.merchantId) {
        setError('请先选择所属主体，再上传影像件');
        return;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        setError('仅支持 JPG / PNG / WEBP 图片');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('单张图片不能超过 5MB');
        return;
      }
      setUploading(true);
      setError('');
      try {
        const url = await uploadCertImage(form.value.merchantId, file);
        patch({
          fileUrl: url
        });
      } catch (e) {
        setError((e as Error).message || '图片上传失败');
      } finally {
        setUploading(false);
        if (fileInputRef.value) fileInputRef.value.value = '';
      }
    };
    const remove = async (): Promise<void> => {
      if (!pendingDelete.value) return;
      const target = pendingDelete.value;
      setSaving(true);
      setError('');
      try {
        await api(`/api/v1/sso/account/certificates/${target.id}`, {
          method: 'DELETE'
        });
        setPendingDelete(null);
        setNotice(`已删除：${target.certName}`);
        await load();
      } catch (e) {
        setError((e as Error).message || '删除失败');
      } finally {
        setSaving(false);
      }
    };
    const typeOptions = computed(() => types.value.length > 0 ? types.value : [{
      code: 'business_license',
      label: '营业执照'
    }, {
      code: 'food_production',
      label: '食品生产许可证'
    }, {
      code: 'food_business',
      label: '食品经营许可证'
    }, {
      code: 'organic',
      label: '有机认证'
    }, {
      code: 'gmo_free',
      label: '非转基因证明'
    }, {
      code: 'other',
      label: '其他资质'
    }]);
    return () => {
      const view_rows = rows.value;
      const view_stats = stats.value;
      const view_notice = notice.value;
      const view_error = error.value;
      const view_subjectFilter = subjectFilter.value;
      const view_merchants = merchants.value;
      const view_stateFilter = stateFilter.value;
      const view_keyword = keyword.value;
      const view_loading = loading.value;
      const view_visibleRows = visibleRows.value;
      const view_typeLabel = typeLabel.value;
      const view_saving = saving.value;
      const view_form = form.value;
      const view_fieldErrors = fieldErrors.value;
      const view_typeOptions = typeOptions.value;
      const view_uploading = uploading.value;
      const view_fileInputRef = fileInputRef.value;
      const view_pendingDelete = pendingDelete.value;
      const view_preview = preview.value;
      return <div class="uc-cert">
      <div class="uc-cert-stats">
        <div><span>证照总数</span><strong>{view_rows.length}</strong></div>
        <div class="warn"><span>即将到期</span><strong>{view_stats.expiring}</strong></div>
        <div class="danger"><span>已过期</span><strong>{view_stats.expired}</strong></div>
        <div><span>长期有效</span><strong>{view_stats.permanent}</strong></div>
      </div>

      {(view_stats.expired > 0 || view_stats.expiring > 0) && <div class="uc-cert-alert">
          <Icon name="alert" size={16} />
          <span>
            {view_stats.expired > 0 ? `${view_stats.expired} 张证照已过期，` : ''}
            {view_stats.expiring > 0 ? `${view_stats.expiring} 张将在 30 天内到期，` : ''}
            请及时换证并在下方更新有效期。
          </span>
        </div>}

      {view_notice && <div class="account-notice">{view_notice}</div>}
      {view_error && <div class="account-error">{view_error}</div>}

      <div class="uc-cert-toolbar">
        <div class="uc-cert-filters">
          <select value={view_subjectFilter} onChange={event => setSubjectFilter((event.target as HTMLInputElement).value)} aria-label="按主体筛选">
            <option value="">全部主体</option>
            {view_merchants.map(item => <option key={item.merchantId} value={item.merchantId}>{item.merchantName}</option>)}
          </select>
          <select value={view_stateFilter} onChange={event => setStateFilter((event.target as HTMLInputElement).value)} aria-label="按状态筛选">
            <option value="">全部状态</option>
            <option value="valid">有效</option>
            <option value="expiring">即将到期</option>
            <option value="expired">已过期</option>
            <option value="permanent">长期有效</option>
          </select>
          <input value={view_keyword} placeholder="搜索证照名称 / 编号 / 发证机关" aria-label="搜索证照" onInput={event => setKeyword((event.target as HTMLInputElement).value)} />
        </div>
        <div class="uc-cert-actions">
          <button class="btn btn-outline btn-sm" onClick={() => void load()} disabled={view_loading}>刷新</button>
          <button class="btn btn-primary btn-sm" onClick={openCreate} disabled={view_merchants.length === 0}>
            新增证照
          </button>
        </div>
      </div>

      {view_loading && <div class="card empty">正在加载证照…</div>}

      {!view_loading && !view_error && view_merchants.length === 0 && <div class="card empty">
          还没有经营主体，先到「我的组织」创建主体后再维护资质证照。
        </div>}

      {!view_loading && view_merchants.length > 0 && view_visibleRows.length === 0 && <div class="card empty">
          {view_rows.length === 0 ? '暂无证照。营业执照、食品生产/经营许可等都可以在这里登记。' : '没有符合筛选条件的证照，换个条件试试。'}
        </div>}

      {!view_loading && view_visibleRows.length > 0 && <div class="uc-cert-wrap">
          <table class="uc-cert-table">
            <thead>
              <tr>
                <th>证照</th>
                <th>所属主体</th>
                <th>有效期</th>
                <th>状态</th>
                <th>影像件</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {view_visibleRows.map(row => {
                const meta = STATE_META[row.expireState] ?? STATE_META.valid;
                return <tr key={row.id}>
                    <td>
                      <div class="uc-cert-name">{row.certName}</div>
                      <div class="uc-cert-sub">
                        {view_typeLabel.get(row.certType) ?? row.certType}
                        {row.certNo ? ` · ${row.certNo}` : ''}
                      </div>
                      {row.issueOrg && <div class="uc-cert-sub">发证：{row.issueOrg}</div>}
                    </td>
                    <td>{row.merchantName || '—'}</td>
                    <td class="uc-cert-mono">
                      {row.expireState === 'permanent' ? '长期有效' : fmtDate(row.expireDate)}
                      <div class="uc-cert-sub">
                        {row.issueDate ? `发证 ${fmtDate(row.issueDate)}` : '发证日期未填'}
                      </div>
                    </td>
                    <td>
                      <span class={`uc-status ${meta.color}`}>{meta.label}</span>
                      {row.expireState === 'expiring' && row.daysToExpire !== null && <div class="uc-cert-days">剩 {row.daysToExpire} 天</div>}
                    </td>
                    <td>
                      {row.fileUrl ? <button type="button" class="uc-cert-thumb" onClick={() => setPreview(row)} title="查看影像件">
                          <img src={row.fileUrl} alt={`${row.certName} 影像件`} loading="lazy" />
                        </button> : <span class="uc-cert-sub">未上传</span>}
                    </td>
                    <td>
                      <div class="uc-cert-row-actions">
                        <button class="btn btn-outline btn-sm" disabled={view_saving} onClick={() => openEdit(row)}>
                          编辑
                        </button>
                        <button class="btn btn-outline btn-sm uc-danger" disabled={view_saving} onClick={() => setPendingDelete(row)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>;
              })}
            </tbody>
          </table>
        </div>}

      {view_form && <div class="uc-cert-mask" onClick={() => !view_saving && setForm(null)}>
          <form class="uc-cert-modal" onClick={event => event.stopPropagation()} onSubmit={event => {
            event.preventDefault();
            void save();
          }}>
            <h3>{view_form.id ? '编辑证照' : '新增证照'}</h3>
            <div class="uc-cert-row">
              <label>
                所属主体
                <select value={view_form.merchantId} disabled={Boolean(view_form.id)} onChange={event => patch({
                  merchantId: (event.target as HTMLInputElement).value,
                  fileUrl: ''
                })}>
                  {view_merchants.map(item => <option key={item.merchantId} value={item.merchantId}>{item.merchantName}</option>)}
                </select>
                {view_form.id && <small class="uc-field-hint">证照挂在主体上，创建后不能换主体。</small>}
                {view_fieldErrors.merchantId && <small class="uc-field-error">{view_fieldErrors.merchantId}</small>}
              </label>
              <label>
                证照类型
                <select value={view_form.certType} onChange={event => {
                  const code = (event.target as HTMLInputElement).value;
                  const label = view_typeOptions.find(item => item.code === code)?.label ?? '';
                  // 名称还是默认值/空值时随类型自动带出，避免每张都手输
                  const autoName = !view_form.certName.trim() || view_typeOptions.some(item => item.label === view_form.certName.trim());
                  patch({
                    certType: code,
                    certName: autoName ? label : view_form.certName
                  });
                }}>
                  {view_typeOptions.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
                </select>
              </label>
            </div>
            <div class="uc-cert-row">
              <label>
                证照名称
                <input value={view_form.certName} placeholder="如 营业执照" onInput={event => patch({
                  certName: (event.target as HTMLInputElement).value
                })} />
                {view_fieldErrors.certName && <small class="uc-field-error">{view_fieldErrors.certName}</small>}
              </label>
              <label>
                证照编号
                <input value={view_form.certNo} placeholder="选填" onInput={event => patch({
                  certNo: (event.target as HTMLInputElement).value
                })} />
              </label>
            </div>
            <div class="uc-cert-row">
              <label>
                发证机关
                <input value={view_form.issueOrg} placeholder="选填" onInput={event => patch({
                  issueOrg: (event.target as HTMLInputElement).value
                })} />
              </label>
              <label>
                发证日期
                <input type="date" value={view_form.issueDate} onInput={event => patch({
                  issueDate: (event.target as HTMLInputElement).value
                })} />
              </label>
            </div>
            <label>
              有效期至
              <input type="date" value={view_form.permanent ? '' : view_form.expireDate} disabled={view_form.permanent} onInput={event => patch({
                expireDate: (event.target as HTMLInputElement).value
              })} />
              <span class="uc-cert-check">
                <input type="checkbox" checked={view_form.permanent} onInput={event => patch({
                  permanent: (event.target as HTMLInputElement).checked,
                  expireDate: ''
                })} />
                长期有效（无到期日）
              </span>
              {view_fieldErrors.expireDate && <small class="uc-field-error">{view_fieldErrors.expireDate}</small>}
            </label>

            <div class="uc-cert-field">
              <span>影像件 <small class="uc-field-hint">选填 · JPG/PNG/WEBP · ≤5MB</small></span>
              <div class="uc-cert-upload">
                {view_form.fileUrl ? <div class="uc-cert-upload-preview">
                    <img src={view_form.fileUrl} alt="证照影像件预览" />
                    <div>
                      <button type="button" class="btn btn-outline btn-sm" disabled={view_uploading || view_saving} onClick={() => view_fileInputRef?.click()}>
                        {view_uploading ? '上传中…' : '重新上传'}
                      </button>
                      <button type="button" class="btn btn-ghost btn-sm" disabled={view_uploading || view_saving} onClick={() => patch({
                      fileUrl: ''
                    })}>移除</button>
                    </div>
                  </div> : <button type="button" class="uc-cert-upload-btn" disabled={view_uploading || view_saving} onClick={() => view_fileInputRef?.click()}>
                    <Icon name="file" size={16} />
                    {view_uploading ? '上传中…' : '选择图片上传'}
                  </button>}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onInput={event => {
                  const file = (event.target as HTMLInputElement).files?.[0];
                  if (file) void uploadImage(file);
                }} />
              </div>
            </div>

            <label>
              备注
              <input value={view_form.remark} placeholder="选填" onInput={event => patch({
                remark: (event.target as HTMLInputElement).value
              })} />
            </label>

            <p class="uc-cert-hint">有效期留空表示长期有效；30 天内到期会在列表里标「即将到期」。</p>
            <div class="uc-cert-modal-actions">
              <button type="button" class="btn btn-outline btn-sm" onClick={() => setForm(null)} disabled={view_saving || view_uploading}>
                取消
              </button>
              <button type="submit" class="btn btn-primary btn-sm" disabled={view_saving || view_uploading}>
                {view_saving ? '保存中…' : view_uploading ? '图片上传中…' : '保存'}
              </button>
            </div>
          </form>
        </div>}

      {view_pendingDelete && <div class="uc-cert-mask" onClick={() => !view_saving && setPendingDelete(null)}>
          <div class="uc-cert-modal uc-cert-confirm" onClick={event => event.stopPropagation()}>
            <h3>删除证照</h3>
            <p>
              确定删除「{view_pendingDelete.certName}」吗？删除后该证照不再出现在列表和到期提醒里，
              已上传的影像件也不会再展示。
            </p>
            <div class="uc-cert-modal-actions">
              <button type="button" class="btn btn-outline btn-sm" onClick={() => setPendingDelete(null)} disabled={view_saving}>
                取消
              </button>
              <button type="button" class="btn btn-primary btn-sm uc-btn-danger" onClick={() => void remove()} disabled={view_saving}>
                {view_saving ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>}

      {view_preview && <div class="uc-cert-mask" onClick={() => setPreview(null)}>
          <div class="uc-cert-viewer" onClick={event => event.stopPropagation()}>
            <div class="uc-cert-viewer-head">
              <div>
                <strong>{view_preview.certName}</strong>
                <small>{view_typeLabel.get(view_preview.certType) ?? view_preview.certType}{view_preview.certNo ? ` · ${view_preview.certNo}` : ''}</small>
              </div>
              <button type="button" class="account-modal-close" onClick={() => setPreview(null)}>×</button>
            </div>
            {view_preview.fileUrl && <img src={view_preview.fileUrl} alt={`${view_preview.certName} 影像件`} />}
          </div>
        </div>}

      <p class="uc-msg-foot">
        <Icon name="alert" size={13} />
        <span>
          证照挂在经营主体上（不属于个人），同一主体的成员都能看到；到期状态由服务端按当天日期现算，
          影像件存放于平台受控目录，不对外公开直链。
        </span>
      </p>
    </div>;
    };
  }
});
