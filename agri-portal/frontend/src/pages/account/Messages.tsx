import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 用户中心 · 消息中心
 *
 * <p>数据来自平台侧已有的 {@code GET /api/v1/messages}（读 {@code agri_core.platform_message}），
 * 不新建消息表 —— 平台早就有站内信门面 {@code MessageFacade}，再建一张就是重复造轮子。</p>
 *
 * <p>消息的真实来源（本轮接通的）：
 * 有人申请加入你负责的经营主体 → 通知负责人；申请被审核 → 通知申请人。
 * 两条都在 `SsoAccountController` 的加入申请流程里写入。</p>
 */

import { Icon } from '@/components/Icon';
import { getPlatformAccessToken } from '../../utils/platformToken';
interface MessageRow {
  id: number | string;
  title: string | null;
  content: string | null;
  readFlag: number;
  createdAt: string;
}
interface PageBody<T> {
  code: number;
  message?: string;
  data?: {
    records?: T[];
    list?: T[];
    total?: number | string;
  };
}

/**
 * 统一取数。
 *
 * <p>⚠️ `/api/v1/messages` 认的是**平台访问令牌（Bearer）**，不是 SSO 会话 Cookie ——
 * 只用 Cookie 调会 401。门户里已经有换取短时令牌的工具（`platformToken`，
 * 走 HttpOnly 刷新凭证换 accessToken），这里复用它，不另造一套鉴权。</p>
 */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getPlatformAccessToken();
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });
  const body = (await response.json()) as PageBody<T> | {
    code: number;
    data?: T;
    message?: string;
  };
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败');
  }
  return body.data as T;
}

/**
 * 消息中心页面
 *
 * @returns 页面内容
 */
export const Messages = defineComponent({
  name: "Messages",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = ref<MessageRow[]>([]);
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const total = ref(0);
    const setTotal = (next: typeof total.value | ((previous: typeof total.value) => typeof total.value)) => {
      total.value = typeof next === 'function' ? (next as (previous: typeof total.value) => typeof total.value)(total.value) : next;
    };
    const unread = ref(0);
    const setUnread = (next: typeof unread.value | ((previous: typeof unread.value) => typeof unread.value)) => {
      unread.value = typeof next === 'function' ? (next as (previous: typeof unread.value) => typeof unread.value)(unread.value) : next;
    };
    const onlyUnread = ref(false);
    const setOnlyUnread = (next: typeof onlyUnread.value | ((previous: typeof onlyUnread.value) => typeof onlyUnread.value)) => {
      onlyUnread.value = typeof next === 'function' ? (next as (previous: typeof onlyUnread.value) => typeof onlyUnread.value)(onlyUnread.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const page = ref(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const size = 20;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      try {
        const [list, count] = await Promise.all([api<{
          records?: MessageRow[];
          list?: MessageRow[];
          total?: number | string;
        }>(`/api/v1/messages?page=${page.value}&size=${size}`), api<number>('/api/v1/messages/unread-count').catch(() => 0)]);
        setRows(list?.records ?? list?.list ?? []);
        setTotal(Number(list?.total ?? 0));
        setUnread(Number(count ?? 0));
      } catch (e) {
        setError((e as Error).message || '消息加载失败');
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

    /** 标记已读：先本地更新让点击立刻有反馈，再回写服务端 */
    const markRead = async (row: MessageRow): Promise<void> => {
      if (row.readFlag === 1) return;
      setRows(prev => prev.map(item => item.id === row.id ? {
        ...item,
        readFlag: 1
      } : item));
      setUnread(prev => Math.max(0, prev - 1));
      try {
        await api(`/api/v1/messages/${row.id}/read`, {
          method: 'POST'
        });
      } catch {
        // 回写失败就回滚，避免"看起来读了、下次刷新又变未读"
        setRows(prev => prev.map(item => item.id === row.id ? {
          ...item,
          readFlag: 0
        } : item));
        setUnread(prev => prev + 1);
      }
    };
    const visible = computed(() => onlyUnread.value ? rows.value.filter(item => item.readFlag !== 1) : rows.value);
    const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size)));
    return () => {
      const view_onlyUnread = onlyUnread.value;
      const view_unread = unread.value;
      const view_error = error.value;
      const view_loading = loading.value;
      const view_visible = visible.value;
      const view_total = total.value;
      const view_page = page.value;
      const view_totalPages = totalPages.value;
      return <div class="uc-msg">
      <div class="uc-msg-head">
        <div class="uc-msg-tabs">
          <button type="button" class={view_onlyUnread ? '' : 'on'} onClick={() => setOnlyUnread(false)}>
            全部消息
          </button>
          <button type="button" class={view_onlyUnread ? 'on' : ''} onClick={() => setOnlyUnread(true)}>
            仅看未读{view_unread > 0 ? `（${view_unread}）` : ''}
          </button>
        </div>
        <button class="btn btn-outline btn-sm" onClick={() => void load()}>
          刷新
        </button>
      </div>

      {view_error && <div class="account-error">{view_error}</div>}
      {view_loading && <div class="card empty">正在加载消息…</div>}

      {!view_loading && !view_error && view_visible.length === 0 && <div class="card empty">
          {view_onlyUnread ? '没有未读消息' : '暂无消息。当有人申请加入你负责的主体、或你的申请被审核时，这里会收到通知。'}
        </div>}

      {!view_loading && !view_error && view_visible.length > 0 && <ul class="uc-msg-list">
          {view_visible.map(row => <li key={row.id} class={row.readFlag === 1 ? '' : 'unread'} onClick={() => void markRead(row)}>
              <span class="uc-msg-dot" />
              <div class="uc-msg-body">
                <div class="uc-msg-title">
                  <strong>{row.title || '通知'}</strong>
                  <small>{String(row.createdAt ?? '').slice(0, 16)}</small>
                </div>
                <p>{row.content || ''}</p>
              </div>
              {row.readFlag !== 1 && <span class="uc-msg-badge">未读</span>}
            </li>)}
        </ul>}

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
          站内信由平台统一投递（{'{'}MessageFacade{'}'}）。短信/推送渠道尚未接入，当前只在这里可见。
        </span>
      </p>
    </div>;
    };
  }
});
