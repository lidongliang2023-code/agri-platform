import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Navigate, useLocation } from '@/vue/router';

/** 历史复盘复用已处置告警，不再维护第二套列表。 */
const DisasterReview = defineComponent({
  name: "DisasterReview",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _state = useLocation();
    const params = computed(() => new URLSearchParams(_state.value.search));
    params.value.set('status', '3');
    return () => {
      return <Navigate to={`/admin/production/alerts?${params.value.toString()}${_state.value.hash}`} replace />;
    };
  }
});
export default DisasterReview;
