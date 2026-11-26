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
/**
 * SSO 回跳页（`/sso/callback`）—— 授权码换令牌的落点。
 *
 * <p>它只做一件事：把 URL 上的 code 换成平台令牌并写入登录态，然后按角色回到首页。
 * 之所以单独成页而不是塞进登录页：登录页的职责是"收集意图并跳转"，回跳是另一件事，
 * 混在一起会让"本地账号登录"和"SSO 登录"两条路径互相干扰。</p>
 */

import { useNavigate } from '@/vue/router';
import { persistSession, resolveHomePath } from '@/api/auth';
import { exchangeCode, normalizeReturnTarget, redirectToSso } from '@/api/sso';

/** 回跳页：换票 → 写登录态 → 回到角色首页 */
const SsoCallback = defineComponent({
  name: "SsoCallback",
  props: {
    clientId: null as unknown as PropType<{
      clientId: string;
    }["clientId"]>
  },
  setup(__props: {
    clientId: string;
  }, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const error = shallowRef<string>('');
    // StrictMode 会重复执行 effect，一次性授权码只允许发送一次兑换请求。
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const exchange = shallowRef<ReturnType<typeof exchangeCode>>();
    onMounted(() => {
      watch(() => [__props.clientId, navigate], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          if (!code) {
            setError('回跳地址里没有授权码');
            return;
          }
          let cancelled = false;
          exchange.value ??= exchangeCode(__props.clientId, code, params.get('state'));
          exchange.value.then(result => {
            if (cancelled) return;
            persistSession(result);
            const returnTo = sessionStorage.getItem('agri_sso_return');
            sessionStorage.removeItem('agri_sso_return');
            const safeReturn = normalizeReturnTarget(returnTo);
            navigate(safeReturn ?? resolveHomePath(result.user?.roles ?? []), {
              replace: true
            });
          }).catch((cause: unknown) => {
            if (!cancelled) {
              setError(cause instanceof Error ? cause.message : '换取令牌失败');
            }
          });
          return () => {
            cancelled = true;
          };
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      return <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 12
      }}>
      {error.value === '' ? <span>正在完成登录…</span> : <>
          <span style={{
            color: 'var(--agri-color-error, #ff4d4f)'
          }}>{error.value}</span>
          <button type="button" onClick={() => {
            void redirectToSso(__props.clientId);
          }}>重新前往统一认证中心</button>
        </>}
    </div>;
    };
  }
});
export default SsoCallback;
