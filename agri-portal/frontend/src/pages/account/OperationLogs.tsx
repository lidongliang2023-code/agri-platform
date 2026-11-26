import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 用户中心 · 操作日志
 *
 * <p>数据来自 `GET /api/v1/sso/account/operation-logs`：只返回**本人**的记录。
 * 这不是运维审计台 —— 用户在这里看到的应该是"我最近做了什么"，不是"谁改了什么"。</p>
 *
 * <p>当前已埋点的动作：登录、改密码、换手机、改资料、绑定/解绑第三方、通知设置、下线设备。
 * 没埋点的动作不会出现在这里 —— 与其补一条假记录，不如让列表短一点。</p>
 */

import { Icon } from '@/components/Icon';
interface LogRow {
  id: string;
  action: string;
  actionLabel: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  result: string;
  createdAt: string | null;
}
interface PagePayload {
  records?: LogRow[];
  total?: number | string;
  page?: number;
  size?: number;
}
interface ApiBody<T> {
  code: number;
  message?: string;
  data?: T;
}
async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include'
  });
  const body = (await response.json()) as ApiBody<T>;
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败');
  }
  return body.data as T;
}

/** 安全类动作：改密 / 换手机 / 下线设备 / 登录 */
const SECURITY_ACTIONS = ['login', 'password_change', 'phone_change', 'session_revoke'];

/**
 * 操作日志页面
 *
 * @returns 页面内容
 */
export const OperationLogs = defineComponent({
  name: "OperationLogs",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = ref<LogRow[]>([]);
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const total = ref(0);
    const setTotal = (next: typeof total.value | ((previous: typeof total.value) => typeof total.value)) => {
      total.value = typeof next === 'function' ? (next as (previous: typeof total.value) => typeof total.value)(total.value) : next;
    };
    const page = ref(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const onlySecurity = ref(false);
    const setOnlySecurity = (next: typeof onlySecurity.value | ((previous: typeof onlySecurity.value) => typeof onlySecurity.value)) => {
      onlySecurity.value = typeof next === 'function' ? (next as (previous: typeof onlySecurity.value) => typeof onlySecurity.value)(onlySecurity.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const size = 20;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      try {
        const data = await api<PagePayload>(`/api/v1/sso/account/operation-logs?pageNum=${page.value}&pageSize=${size}`);
        setRows(data?.records ?? []);
        setTotal(Number(data?.total ?? 0));
      } catch (e) {
        setError((e as Error).message || '操作日志加载失败');
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [page.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          void load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const visible = computed(() => onlySecurity.value ? rows.value.filter(row => SECURITY_ACTIONS.includes(row.action)) : rows.value);
    const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size)));
    return () => {
      const view_onlySecurity = onlySecurity.value;
      const view_loading = loading.value;
      const view_error = error.value;
      const view_visible = visible.value;
      const view_total = total.value;
      const view_page = page.value;
      const view_totalPages = totalPages.value;
      return <div class="uc-logs">
      <div class="uc-logs-head">
        <div class="uc-logs-tabs">
          <button type="button" class={view_onlySecurity ? '' : 'on'} onClick={() => setOnlySecurity(false)}>
            全部操作
          </button>
          <button type="button" class={view_onlySecurity ? 'on' : ''} onClick={() => setOnlySecurity(true)}>
            仅安全类
          </button>
        </div>
        <button class="btn btn-outline btn-sm" onClick={() => void load()} disabled={view_loading}>
          刷新
        </button>
      </div>

      {view_error && <div class="account-error">{view_error}</div>}
      {view_loading && <div class="card empty">正在加载操作日志…</div>}

      {!view_loading && !view_error && view_visible.length === 0 && <div class="card empty">
          {view_onlySecurity ? '没有安全类操作记录' : '暂无操作记录。登录、改密、换手机、绑定第三方等动作会记录在这里。'}
        </div>}

      {!view_loading && !view_error && view_visible.length > 0 && <div class="uc-logs-wrap">
          <table class="uc-logs-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作</th>
                <th>对象</th>
                <th>说明</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {view_visible.map(row => <tr key={row.id}>
                  <td class="uc-logs-time">{String(row.createdAt ?? '').replace('T', ' ').slice(0, 19)}</td>
                  <td>
                    <span class={`uc-logs-tag ${SECURITY_ACTIONS.includes(row.action) ? 'sec' : ''}`}>
                      {row.actionLabel}
                    </span>
                  </td>
                  <td>{row.target || '—'}</td>
                  <td class="uc-logs-detail">{row.detail || '—'}</td>
                  <td class="uc-logs-ip">{row.ip || '—'}</td>
                </tr>)}
            </tbody>
          </table>
        </div>}

      {!view_loading && !view_error && view_total > size && <div class="uc-msg-pager">
          <button class="btn btn-outline btn-sm" disabled={view_page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            上一页
          </button>
          <span>
            第 {view_page} / {view_totalPages} 页 · 共 {view_total} 条
          </span>
          <button class="btn btn-outline btn-sm" disabled={view_page >= view_totalPages} onClick={() => setPage(p => Math.min(view_totalPages, p + 1))}>
            下一页
          </button>
        </div>}

      <p class="uc-msg-foot">
        <Icon name="alert" size={13} />
        <span>
          这里只显示你自己的操作，且只包含已埋点的动作（登录 / 改密 / 换手机 / 改资料 / 绑定第三方 /
          通知设置 / 下线设备）。敏感字段（手机号）以掩码形式记录。
        </span>
      </p>
    </div>;
    };
  }
});
