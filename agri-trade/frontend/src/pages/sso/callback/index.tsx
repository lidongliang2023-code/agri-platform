import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { useNavigate } from "@/vue/router";
import { Button, Spin, Result } from "@/vue/ui";
import { exchangeCode, redirectToSso, takeReturnTo } from '../../../utils/sso';

/**
 * SSO 回跳页：只做一件事 —— 把 URL 上的 code 换成平台令牌写入登录态，再回到来之前的页面。
 *
 * <p>失败时明确报出原因（state 校验、code_verifier 丢失、换票失败），
 * 而不是"转一圈回到登录页" —— 那样排查只能靠猜。</p>
 */
const SsoCallback = defineComponent({
  name: "SsoCallback",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const error = shallowRef<string | null>(null);
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    onMounted(() => {
      watch(() => [navigate], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          if (!code) {
            setError(params.get('error_description') ?? '认证中心没有返回授权码');
            return;
          }
          exchangeCode(code, params.get('state')).then(() => {
            navigate(takeReturnTo() ?? '/', {
              replace: true
            });
          }).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      const view_error = error.value;
      if (view_error) {
        return <Result status="warning" title="登录未完成" subTitle={view_error} extra={<Button type="primary" onClick={() => {
          void redirectToSso();
        }}>重新登录</Button>} />;
      }
      return <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
      <Spin size="large" tip="正在完成登录…" />
    </div>;
    };
  }
});
export default SsoCallback;
