import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};
import { Button, Result, Spin } from '@/vue/ui';
import axios from 'axios';
import { useNavigate } from '@/vue/router';
import { persistSession } from '@/api/auth';
import { notifyNativeShell, safeProductionTarget } from '@/utils/mobile-workspace';
import useAuthStore from '@/vue/authStore';
const ENDED_TEXT: Record<string, {
  title: string;
  description: string;
}> = {
  expired: {
    title: '登录已失效',
    description: '请返回生产管理客户端，重新进入该业务。'
  },
  logout: {
    title: '已退出当前业务',
    description: '账号由生产管理客户端统一管理，请返回客户端继续操作。'
  }
};

/**
 * uni-app 客户端打开完整业务的唯一入口：用客户端签发的一次性票据换取会话，然后进入目标业务页。
 * 没有票据或会话结束时只提示返回客户端，不提供网页内登录（独立移动 H5 已下线）。
 */
const MobileSession = defineComponent({
  name: "MobileSession",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    sessionStorage.setItem('agri_mobile_workspace', '1');
    sessionStorage.setItem('agri_native_workspace', '1');
    const started = shallowRef(false);
    const error = shallowRef('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const ended = shallowRef<string>('');
    const setEnded = (next: typeof ended.value | ((previous: typeof ended.value) => typeof ended.value)) => {
      ended.value = typeof next === 'function' ? (next as (previous: typeof ended.value) => typeof ended.value)(ended.value) : next;
    };
    const navigate = useNavigate();
    onMounted(() => {
      watch(() => [navigate], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (started.value) return;
          started.value = true;
          const reason = new URLSearchParams(window.location.search).get('reason') || '';
          const ticket = new URLSearchParams(window.location.hash.slice(1)).get('ticket');
          window.history.replaceState(null, '', '/mobile/session');
          if (!ticket) {
            const key = ENDED_TEXT[reason] ? reason : 'expired';
            setEnded(key);
            notifyNativeShell(key as 'expired' | 'logout');
            return;
          }
          void axios.post('/api/v1/production/mobile-session/exchange', {
            ticket
          }, {
            timeout: 15000
          }).then(response => {
            if (response.data?.code !== 0 || !response.data?.data?.accessToken) throw new Error(response.data?.message || '登录交接失败');
            sessionStorage.setItem('agri_native_workspace', '1');
            persistSession(response.data.data, 1);
            useAuthStore.getState().setAuthReady(true);
            navigate(safeProductionTarget(response.data.data.target), {
              replace: true
            });
          }).catch(e => setError(axios.isAxiosError(e) ? e.response?.data?.message || '业务服务暂不可连接，请返回重试' : e.message));
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const back = (): void => {
      notifyNativeShell('expired');
      window.history.back();
    };
    return () => {
      if (ended.value || error.value) {
        const text = error.value ? {
          title: '无法进入生产业务',
          description: error.value
        } : ENDED_TEXT[ended.value];
        return <div style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f5f6fa',
          boxSizing: 'border-box'
        }}>
      <Result status={error.value ? 'error' : 'info'} title={text.title} subTitle={<>{text.description}<br />小程序和 APP 请点左上角返回。</>} extra={<Button type="primary" size="large" onClick={back}>返回客户端</Button>} />
    </div>;
      }
      return <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f6fa'
      }}><Spin size="large" tip="正在核实账号与权限"><div style={{
            width: 160,
            height: 80
          }} /></Spin></div>;
    };
  }
});
export default MobileSession;
