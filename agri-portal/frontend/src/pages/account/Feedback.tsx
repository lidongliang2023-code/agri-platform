import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 用户中心 · 意见反馈
 *
 * <p>数据来自 `GET /api/v1/sso/account/feedback`：返回**类型目录**（由后端下发，前端不留第二份）
 * 和**我提交过的反馈**。运营回复后，回复内容直接显示在列表里，不靠用户自己去翻站内信。</p>
 *
 * <p>为什么回复内容要在本页可见：站内信可以被用户删掉，反馈单不会 ——
 * 用户回头想确认"平台到底怎么答复的"，这里必须查得到。</p>
 */

import { Icon } from '@/components/Icon';
interface FeedbackType {
  code: string;
  label: string;
}
interface FeedbackRow {
  id: string;
  feedbackType: string;
  title: string;
  content: string;
  contact: string | null;
  pagePath: string | null;
  status: string;
  replyContent: string | null;
  replierName: string | null;
  submitTime: string | null;
  replyTime: string | null;
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
  const body = (await response.json()) as ApiBody<T>;
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败');
  }
  return body.data as T;
}

/** 单据状态展示元数据 */
const STATUS_META: Record<string, {
  label: string;
  className: string;
}> = {
  pending: {
    label: '待处理',
    className: 'pending'
  },
  replied: {
    label: '已回复',
    className: 'replied'
  },
  closed: {
    label: '已关闭',
    className: 'closed'
  }
};
interface FeedbackForm {
  feedbackType: string;
  title: string;
  content: string;
  contact: string;
}
const EMPTY_FORM: FeedbackForm = {
  feedbackType: 'suggestion',
  title: '',
  content: '',
  contact: ''
};

/** 当前所在页面，随反馈一起提交，便于运营定位问题 */
function currentPagePath(): string {
  return `${window.location.pathname}${window.location.hash}`;
}

/**
 * 意见反馈页面
 *
 * @returns 页面内容
 */
export const Feedback = defineComponent({
  name: "Feedback",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const types = ref<FeedbackType[]>([]);
    const setTypes = (next: typeof types.value | ((previous: typeof types.value) => typeof types.value)) => {
      types.value = typeof next === 'function' ? (next as (previous: typeof types.value) => typeof types.value)(types.value) : next;
    };
    const rows = ref<FeedbackRow[]>([]);
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
    const form = ref<FeedbackForm | null>(null);
    const setForm = (next: typeof form.value | ((previous: typeof form.value) => typeof form.value)) => {
      form.value = typeof next === 'function' ? (next as (previous: typeof form.value) => typeof form.value)(form.value) : next;
    };
    const saving = ref(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      try {
        const data = await api<{
          types?: FeedbackType[];
          records?: FeedbackRow[];
        }>('/api/v1/sso/account/feedback');
        setTypes(data?.types ?? []);
        setRows(data?.records ?? []);
      } catch (e) {
        setError((e as Error).message || '反馈加载失败');
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
    const openForm = (): void => {
      setForm({
        ...EMPTY_FORM,
        feedbackType: types.value[0]?.code ?? 'suggestion'
      });
      setNotice('');
      setError('');
    };
    const submit = async (): Promise<void> => {
      if (!form.value) return;
      if (!form.value.title.trim()) {
        setError('请填写反馈标题');
        return;
      }
      if (!form.value.content.trim()) {
        setError('请填写反馈内容');
        return;
      }
      setSaving(true);
      setError('');
      try {
        await api('/api/v1/sso/account/feedback', {
          method: 'POST',
          body: JSON.stringify({
            feedbackType: form.value.feedbackType,
            title: form.value.title.trim(),
            content: form.value.content.trim(),
            contact: form.value.contact.trim() || null,
            pagePath: currentPagePath()
          })
        });
        setNotice('反馈已提交，运营回复后会在这里显示');
        setForm(null);
        await load();
      } catch (e) {
        setError((e as Error).message || '提交失败');
      } finally {
        setSaving(false);
      }
    };
    const typeLabel = (code: string): string => types.value.find(type => type.code === code)?.label ?? code;
    const pendingCount = computed(() => rows.value.filter(row => row.status === 'pending').length);
    const repliedCount = computed(() => rows.value.filter(row => row.status === 'replied').length);
    return () => {
      const view_rows = rows.value;
      const view_pendingCount = pendingCount.value;
      const view_repliedCount = repliedCount.value;
      const view_loading = loading.value;
      const view_saving = saving.value;
      const view_notice = notice.value;
      const view_error = error.value;
      const view_form = form.value;
      const view_types = types.value;
      return <div class="uc-fb">
      <div class="uc-fb-head">
        <div>
          <strong>
            我的反馈 {view_rows.length} 条 · 待处理 {view_pendingCount} · 已回复 {view_repliedCount}
          </strong>
          <small>功能建议、问题报错、投诉举报都可以在这里提交，运营回复后本页可见</small>
        </div>
        <div class="uc-fb-actions">
          <button class="btn btn-outline btn-sm" onClick={() => void load()} disabled={view_loading}>
            刷新
          </button>
          <button class="btn btn-primary btn-sm" onClick={openForm} disabled={view_saving}>
            提交反馈
          </button>
        </div>
      </div>

      {view_notice && <div class="account-notice">{view_notice}</div>}
      {view_error && <div class="account-error">{view_error}</div>}
      {view_loading && <div class="card empty">正在加载反馈…</div>}

      {!view_loading && !view_error && view_rows.length === 0 && <div class="card empty">
          还没有提交过反馈。遇到问题或想提建议，点右上角「提交反馈」。
        </div>}

      {!view_loading && view_rows.length > 0 && <ul class="uc-fb-list">
          {view_rows.map(row => {
            const meta = STATUS_META[row.status] ?? STATUS_META.pending;
            return <li key={row.id}>
                <div class="uc-fb-top">
                  <span class="uc-fb-type">{typeLabel(row.feedbackType)}</span>
                  <strong class="uc-fb-title">{row.title}</strong>
                  <span class={`uc-fb-status ${meta.className}`}>{meta.label}</span>
                </div>
                <p class="uc-fb-content">{row.content}</p>
                <div class="uc-fb-meta">
                  <span>提交于 {(row.submitTime ?? '').replace('T', ' ').slice(0, 16)}</span>
                  {row.pagePath && <span>来源 {row.pagePath}</span>}
                </div>
                {row.replyContent && <div class="uc-fb-reply">
                    <span class="uc-fb-reply-who">
                      <Icon name="bell" size={13} /> {row.replierName || '平台运营'} 回复
                      {row.replyTime ? `　${row.replyTime.replace('T', ' ').slice(0, 16)}` : ''}
                    </span>
                    <p>{row.replyContent}</p>
                  </div>}
              </li>;
          })}
        </ul>}

      {view_form && <div class="uc-fb-mask" onClick={() => !view_saving && setForm(null)}>
          <div class="uc-fb-modal" onClick={event => event.stopPropagation()}>
            <h3>提交反馈</h3>
            <label>
              反馈类型
              <select value={view_form.feedbackType} onChange={event => setForm({
                ...view_form,
                feedbackType: (event.target as HTMLInputElement).value
              })}>
                {view_types.map(type => <option key={type.code} value={type.code}>
                    {type.label}
                  </option>)}
              </select>
            </label>
            <label>
              标题
              <input value={view_form.title} maxlength={120} placeholder="一句话说明问题，例如「地块列表翻页后回到第一页」" onInput={event => setForm({
                ...view_form,
                title: (event.target as HTMLInputElement).value
              })} />
            </label>
            <label>
              详细描述
              <textarea value={view_form.content} maxlength={2000} rows={5} placeholder="复现步骤、期望结果、实际结果；有报错信息请一并贴上来" onInput={event => setForm({
                ...view_form,
                content: (event.target as HTMLInputElement).value
              })} />
            </label>
            <label>
              联系方式（选填）
              <input value={view_form.contact} maxlength={64} placeholder="手机号或邮箱，便于进一步沟通" onInput={event => setForm({
                ...view_form,
                contact: (event.target as HTMLInputElement).value
              })} />
            </label>
            <p class="uc-fb-tip">
              提交时会自动带上当前页面地址，方便运营复现；不需要的话可以忽略。
            </p>
            <div class="uc-fb-modal-actions">
              <button class="btn btn-outline btn-sm" onClick={() => setForm(null)} disabled={view_saving}>
                取消
              </button>
              <button class="btn btn-primary btn-sm" onClick={() => void submit()} disabled={view_saving}>
                {view_saving ? '提交中…' : '提交'}
              </button>
            </div>
          </div>
        </div>}
    </div>;
    };
  }
});
