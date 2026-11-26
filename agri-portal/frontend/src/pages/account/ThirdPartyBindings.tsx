import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 用户中心 · 第三方绑定
 *
 * <p>数据来自 `GET /api/v1/sso/account/bindings`：接口返回**全部渠道**（含未绑定的），
 * 页面据此渲染"已绑定 / 去绑定"两种状态 —— 只返回已绑定的记录，前端就不知道还能绑什么。</p>
 *
 * <p><b>必须说清楚的一件事</b>：本部署**没有接入第三方 OAuth**。这里的"绑定"是登记
 * 外部账号标识（openid / unionid / 手机号），供后续对接登录与消息推送时对账使用，
 * **不是**"点一下就完成了微信授权"。页面上把这句话写在显眼处，避免用户误以为已联通。</p>
 */

import { Icon } from '@/components/Icon';
interface BindingRow {
  provider: string;
  providerLabel: string;
  bound: boolean;
  externalAccount: string | null;
  displayName: string | null;
  bindAt: string | null;
}
interface ApiBody<T> {
  code: number;
  message?: string;
  data?: T;
}

/** 账号中心系列接口认 SSO 会话 Cookie */
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

/**
 * 第三方绑定页面
 *
 * @returns 页面内容
 */
export const ThirdPartyBindings = defineComponent({
  name: "ThirdPartyBindings",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = ref<BindingRow[]>([]);
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
    const busy = ref(false);

    /** 正在编辑的渠道（null 表示弹窗关闭） */
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const editing = ref<BindingRow | null>(null);
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const account = ref('');
    const setAccount = (next: typeof account.value | ((previous: typeof account.value) => typeof account.value)) => {
      account.value = typeof next === 'function' ? (next as (previous: typeof account.value) => typeof account.value)(account.value) : next;
    };
    const displayName = ref('');
    const setDisplayName = (next: typeof displayName.value | ((previous: typeof displayName.value) => typeof displayName.value)) => {
      displayName.value = typeof next === 'function' ? (next as (previous: typeof displayName.value) => typeof displayName.value)(displayName.value) : next;
    };
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      try {
        const data = await api<BindingRow[]>('/api/v1/sso/account/bindings');
        setRows(data ?? []);
      } catch (e) {
        setError((e as Error).message || '绑定信息加载失败');
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
    const openEdit = (row: BindingRow): void => {
      setEditing(row);
      setAccount(row.externalAccount ?? '');
      setDisplayName(row.displayName ?? '');
      setNotice('');
    };
    const closeEdit = (): void => {
      setEditing(null);
      setAccount('');
      setDisplayName('');
    };

    /** 保存绑定 */
    const save = async (): Promise<void> => {
      if (!editing.value) return;
      const value = account.value.trim();
      if (!value) {
        setError('请填写外部账号标识');
        return;
      }
      setBusy(true);
      setError('');
      try {
        await api('/api/v1/sso/account/bindings', {
          method: 'POST',
          body: JSON.stringify({
            provider: editing.value.provider,
            externalAccount: value,
            displayName: displayName.value.trim() || null
          })
        });
        setNotice(`已登记${editing.value.providerLabel}账号：${value}`);
        closeEdit();
        await load();
      } catch (e) {
        setError((e as Error).message || '保存失败');
      } finally {
        setBusy(false);
      }
    };

    /** 解除绑定 */
    const unbind = async (row: BindingRow): Promise<void> => {
      setBusy(true);
      setError('');
      try {
        await api(`/api/v1/sso/account/bindings/${row.provider}`, {
          method: 'DELETE'
        });
        setNotice(`已解除${row.providerLabel}绑定`);
        await load();
      } catch (e) {
        setError((e as Error).message || '解绑失败');
      } finally {
        setBusy(false);
      }
    };
    return () => {
      const view_notice = notice.value;
      const view_error = error.value;
      const view_loading = loading.value;
      const view_rows = rows.value;
      const view_busy = busy.value;
      const view_editing = editing.value;
      const view_account = account.value;
      const view_displayName = displayName.value;
      return <div class="uc-bind">
      <div class="card uc-bind-tip">
        <Icon name="alert" size={16} />
        <div>
          <strong>本部署尚未接入第三方 OAuth</strong>
          <p>
            这里的绑定是<strong>登记外部账号标识</strong>（openid / unionid / 手机号），
            用于后续对接登录与消息推送时把两边账号对上；不会跳转微信/支付宝授权页，也不代表已完成授权。
          </p>
        </div>
      </div>

      {view_notice && <div class="account-notice">{view_notice}</div>}
      {view_error && <div class="account-error">{view_error}</div>}
      {view_loading && <div class="card empty">正在加载绑定信息…</div>}

      {!view_loading && <ul class="uc-bind-list">
          {view_rows.map(row => <li key={row.provider} class={row.bound ? 'on' : ''}>
              <span class="uc-bind-icon">
                <Icon name={row.provider === 'dingtalk' ? 'users' : 'globe'} size={18} />
              </span>
              <div class="uc-bind-body">
                <div class="uc-bind-title">
                  <strong>{row.providerLabel}</strong>
                  {row.bound ? <span class="tag tag-tech">已绑定</span> : <span class="uc-bind-off">未绑定</span>}
                </div>
                <small>
                  {row.bound ? `${row.externalAccount ?? ''}${row.displayName ? ` · ${row.displayName}` : ''}　绑定于 ${String(row.bindAt ?? '').slice(0, 16)}` : '尚未登记该渠道的账号标识'}
                </small>
              </div>
              <div class="uc-bind-actions">
                <button class="btn btn-outline btn-sm" disabled={view_busy} onClick={() => openEdit(row)}>
                  {row.bound ? '改绑' : '去绑定'}
                </button>
                {row.bound && <button class="btn btn-outline btn-sm" disabled={view_busy} onClick={() => void unbind(row)}>
                    解绑
                  </button>}
              </div>
            </li>)}
        </ul>}

      {view_editing && <div class="uc-bind-modal-mask" onClick={closeEdit}>
          <div class="uc-bind-modal" onClick={event => event.stopPropagation()}>
            <h3>{view_editing.bound ? '改绑' : '绑定'}{view_editing.providerLabel}账号</h3>
            <label>
              外部账号标识
              <input value={view_account} placeholder="openid / unionid / 手机号" onInput={event => setAccount((event.target as HTMLInputElement).value)} />
            </label>
            <label>
              昵称（可选）
              <input value={view_displayName} placeholder="该渠道上的昵称，仅用于展示" onInput={event => setDisplayName((event.target as HTMLInputElement).value)} />
            </label>
            <div class="uc-bind-modal-actions">
              <button class="btn btn-outline btn-sm" onClick={closeEdit} disabled={view_busy}>
                取消
              </button>
              <button class="btn btn-primary btn-sm" onClick={() => void save()} disabled={view_busy}>
                保存
              </button>
            </div>
          </div>
        </div>}
    </div>;
    };
  }
});
