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
/** 两端共用统一认证入口，不提供本地账号登录回退。 */

import { Navigate, useLocation, useSearchParams } from '@/vue/router';
import useAuthStore from '@/vue/authStore';
import { resolveHomePath } from '@/api/auth';
import { normalizeReturnTarget, redirectToSso } from '@/api/sso';
const SsoHandoff = defineComponent({
  name: "SsoHandoff",
  props: {
    clientId: null as unknown as PropType<{
      clientId: string;
      returnTo?: string;
    }["clientId"]>,
    returnTo: null as unknown as PropType<{
      clientId: string;
      returnTo?: string;
    }["returnTo"]>
  },
  setup(__props: {
    clientId: string;
    returnTo?: string;
  }, {
    slots: __slots
  }) {
    const token = useAuthStore(state => state.token);
    const roles = useAuthStore(state => state.roles);
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const started = shallowRef(false);
    const error = shallowRef('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const rawFrom = computed(() => __props.returnTo ?? (location.value.state as {
      from?: unknown;
    } | null)?.from ?? searchParams.value.get('redirect'));
    const returnTo = computed(() => normalizeReturnTarget(typeof rawFrom.value === 'string' ? rawFrom.value : undefined));
    const begin = () => {
      setError('');
      void redirectToSso(__props.clientId, returnTo.value).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : '无法跳转到统一认证中心');
      });
    };
    onMounted(() => {
      watch(() => [__props.clientId, token.value, returnTo.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (token.value || started.value) return;
          started.value = true;
          void redirectToSso(__props.clientId, returnTo.value).catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : '无法跳转到统一认证中心');
          });
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      if (token.value) return <Navigate to={returnTo.value ?? resolveHomePath(roles.value)} replace />;
      return <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 12
      }}>
    {error.value ? <><span style={{
            color: 'var(--agri-color-error, #ff4d4f)'
          }}>{error.value}</span><button type="button" onClick={begin}>重新前往统一认证中心</button></> : <span>正在跳转到统一认证中心…</span>}
  </div>;
    };
  }
});
export default SsoHandoff;
