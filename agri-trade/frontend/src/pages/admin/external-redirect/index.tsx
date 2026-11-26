import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/** 已迁到主数据管理的页面：旧地址整页跳转过去，避免两套实现并存。 */
const ExternalRedirect = defineComponent({
  name: "ExternalRedirect",
  props: {
    path: null as unknown as PropType<{
      path: string;
    }["path"]>
  },
  setup(__props: {
    path: string;
  }, {
    slots: __slots
  }) {
    onMounted(() => {
      watch(() => [__props.path], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          const target = `${window.location.protocol}//${window.location.hostname}:8080${__props.path}`;
          window.location.replace(target);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      return <div style={{
        padding: 40,
        color: '#6b7c72'
      }}>正在跳转到主数据管理…</div>;
    };
  }
});
export default ExternalRedirect;
