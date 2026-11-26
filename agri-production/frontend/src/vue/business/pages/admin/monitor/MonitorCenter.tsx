import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Navigate, useLocation } from '@/vue/router';

/** 生产告警列表归并到唯一处置入口，保留旧书签的筛选条件。 */
const MonitorCenter = defineComponent({
  name: "MonitorCenter",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _state = useLocation();
    return () => {
      return <Navigate to={`/admin/production/alerts${_state.value.search}${_state.value.hash}`} replace />;
    };
  }
});
export default MonitorCenter;
