import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 用户中心 · 通知设置
 *
 * <p>数据来自 `GET/PUT /api/v1/sso/account/notification-settings`。
 * 类型目录与渠道清单由**后端下发**，前端不再自己维护一套 —— 否则新增一个通知类型时
 * 两边必然有一处漏改。</p>
 *
 * <p><b>诚实性</b>：三个渠道里只有「站内信」真的接通了（平台 MessageFacade 写 platform_message）；
 * 短信/推送只存偏好、不会真的发出去。类型里的 order / alert / system 同理 ——
 * 对应业务域还没接消息门面，配了也收不到。这些都在界面上明确标出来，不用"看起来能用"糊弄。</p>
 */

import { Icon } from '@/components/Icon';
interface NotifyType {
  code: string;
  label: string;
  /** 该类型现在是否真的会产生消息 */
  produces: boolean;
  inapp: boolean;
  sms: boolean;
  push: boolean;
}
interface NotifyChannel {
  code: 'inapp' | 'sms' | 'push';
  label: string;
  /** 该渠道是否已接入 */
  wired: boolean;
}
interface SettingsPayload {
  persisted: boolean;
  types: NotifyType[];
  channels: NotifyChannel[];
  quietStart: string | null;
  quietEnd: string | null;
  digest: string;
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
const DIGEST_OPTIONS = [{
  value: 'realtime',
  label: '实时推送'
}, {
  value: 'daily',
  label: '每日汇总'
}, {
  value: 'weekly',
  label: '每周汇总'
}];

/**
 * 通知设置页面
 *
 * @returns 页面内容
 */
export const NotificationSettings = defineComponent({
  name: "NotificationSettings",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const payload = ref<SettingsPayload | null>(null);
    const setPayload = (next: typeof payload.value | ((previous: typeof payload.value) => typeof payload.value)) => {
      payload.value = typeof next === 'function' ? (next as (previous: typeof payload.value) => typeof payload.value)(payload.value) : next;
    };
    const types = ref<NotifyType[]>([]);
    const setTypes = (next: typeof types.value | ((previous: typeof types.value) => typeof types.value)) => {
      types.value = typeof next === 'function' ? (next as (previous: typeof types.value) => typeof types.value)(types.value) : next;
    };
    const quietStart = ref('');
    const setQuietStart = (next: typeof quietStart.value | ((previous: typeof quietStart.value) => typeof quietStart.value)) => {
      quietStart.value = typeof next === 'function' ? (next as (previous: typeof quietStart.value) => typeof quietStart.value)(quietStart.value) : next;
    };
    const quietEnd = ref('');
    const setQuietEnd = (next: typeof quietEnd.value | ((previous: typeof quietEnd.value) => typeof quietEnd.value)) => {
      quietEnd.value = typeof next === 'function' ? (next as (previous: typeof quietEnd.value) => typeof quietEnd.value)(quietEnd.value) : next;
    };
    const digest = ref('realtime');
    const setDigest = (next: typeof digest.value | ((previous: typeof digest.value) => typeof digest.value)) => {
      digest.value = typeof next === 'function' ? (next as (previous: typeof digest.value) => typeof digest.value)(digest.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const saving = ref(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const notice = ref('');
    const setNotice = (next: typeof notice.value | ((previous: typeof notice.value) => typeof notice.value)) => {
      notice.value = typeof next === 'function' ? (next as (previous: typeof notice.value) => typeof notice.value)(notice.value) : next;
    };
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      try {
        const data = await api<SettingsPayload>('/api/v1/sso/account/notification-settings');
        setPayload(data);
        setTypes(data?.types ?? []);
        setQuietStart(data?.quietStart ?? '');
        setQuietEnd(data?.quietEnd ?? '');
        setDigest(data?.digest ?? 'realtime');
      } catch (e) {
        setError((e as Error).message || '通知设置加载失败');
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
    const channels = computed(() => payload.value?.channels ?? []);

    /** 切换某个类型在某个渠道上的开关 */
    const toggle = (code: string, channel: 'inapp' | 'sms' | 'push'): void => {
      setTypes(prev => prev.map(item => item.code === code ? {
        ...item,
        [channel]: !item[channel]
      } : item));
    };

    /** 已开启数量（用于顶部摘要） */
    const summary = computed(() => {
      const inapp = types.value.filter(item => item.inapp).length;
      return {
        inapp,
        total: types.value.length
      };
    });
    const save = async (): Promise<void> => {
      setSaving(true);
      setError('');
      setNotice('');
      try {
        await api('/api/v1/sso/account/notification-settings', {
          method: 'PUT',
          body: JSON.stringify({
            inappTypes: types.value.filter(item => item.inapp).map(item => item.code),
            smsTypes: types.value.filter(item => item.sms).map(item => item.code),
            pushTypes: types.value.filter(item => item.push).map(item => item.code),
            quietStart: quietStart.value || null,
            quietEnd: quietEnd.value || null,
            digest: digest.value
          })
        });
        setNotice('通知设置已保存');
        await load();
      } catch (e) {
        setError((e as Error).message || '保存失败');
      } finally {
        setSaving(false);
      }
    };
    return () => {
      const view_loading = loading.value;
      const view_summary = summary.value;
      const view_saving = saving.value;
      const view_notice = notice.value;
      const view_error = error.value;
      const view_channels = channels.value;
      const view_types = types.value;
      const view_quietStart = quietStart.value;
      const view_quietEnd = quietEnd.value;
      const view_digest = digest.value;
      if (view_loading) return <div class="card empty">正在加载通知设置…</div>;
      return <div class="uc-notify">
      <div class="uc-notify-head">
        <div>
          <strong>站内信已开启 {view_summary.inapp} / {view_summary.total} 类</strong>
          <small>只有勾选的类型才会给你发通知</small>
        </div>
        <button class="btn btn-primary btn-sm" onClick={() => void save()} disabled={view_saving}>
          {view_saving ? '保存中…' : '保存设置'}
        </button>
      </div>

      {view_notice && <div class="account-notice">{view_notice}</div>}
      {view_error && <div class="account-error">{view_error}</div>}

      {/* 通知矩阵 */}
      <div class="uc-notify-matrix">
        <table>
          <thead>
            <tr>
              <th>通知类型</th>
              {view_channels.map(channel => <th key={channel.code}>
                  {channel.label}
                  {!channel.wired && <span class="uc-notify-nowire">未接入</span>}
                </th>)}
            </tr>
          </thead>
          <tbody>
            {view_types.map(type => <tr key={type.code}>
                <td>
                  {type.label}
                  {!type.produces && <span class="uc-notify-nomsg">暂不产生消息</span>}
                </td>
                {view_channels.map(channel => {
                  const key = channel.code as 'inapp' | 'sms' | 'push';
                  return <td key={channel.code}>
                      <label class={`uc-notify-check ${!channel.wired ? 'disabled' : ''}`}>
                        <input type="checkbox" checked={Boolean(type[key])} disabled={!channel.wired} onInput={() => toggle(type.code, key)} />
                        <span />
                      </label>
                    </td>;
                })}
              </tr>)}
          </tbody>
        </table>
      </div>

      <div class="uc-notify-extra">
        <div class="uc-notify-block">
          <h4>免打扰时段</h4>
          <p>该时段内不发送通知（站内信仍会入库，只是不打扰你）。留空表示不启用。</p>
          <div class="uc-notify-times">
            <input type="time" value={view_quietStart} onInput={event => setQuietStart((event.target as HTMLInputElement).value)} />
            <span>至</span>
            <input type="time" value={view_quietEnd} onInput={event => setQuietEnd((event.target as HTMLInputElement).value)} />
          </div>
        </div>

        <div class="uc-notify-block">
          <h4>推送频率</h4>
          <p>实时推送会即时通知；汇总模式把一段时间内的通知合并成一条。</p>
          <div class="uc-notify-digest">
            {DIGEST_OPTIONS.map(option => <button key={option.value} type="button" class={view_digest === option.value ? 'on' : ''} onClick={() => setDigest(option.value)}>
                {option.label}
              </button>)}
          </div>
        </div>
      </div>

      <p class="uc-msg-foot">
        <Icon name="alert" size={13} />
        <span>
          当前只有<strong>站内信</strong>接通（消息中心可查看）；短信与推送渠道尚未接入，勾选只会保存偏好。
          标注「暂不产生消息」的类型，对应业务域还没接消息门面。
        </span>
      </p>
    </div>;
    };
  }
});
