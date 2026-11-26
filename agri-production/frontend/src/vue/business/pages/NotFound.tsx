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
 * 404 页面
 */
import { Button, Result } from '@/vue/ui';
import { useNavigate } from '@/vue/router';

/**
 * 未匹配路由时展示的 404 页面
 * @returns 结果页组件
 */
const NotFound = defineComponent({
  name: "NotFound",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    return () => {
      return <Result status="404" title="404" subTitle="抱歉，您访问的页面不存在或已被移除。" extra={<Button type="primary" onClick={() => navigate('/production/dashboard')}>
          返回首页
        </Button>} />;
    };
  }
});
export default NotFound;
