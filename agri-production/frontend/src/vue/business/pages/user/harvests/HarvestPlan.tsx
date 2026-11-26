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
import { Navigate, useLocation } from '@/vue/router';

/** 历史地块采收入口兼容：保留筛选参数，统一进入采收记录。 */
const HarvestPlan = defineComponent({
  name: "HarvestPlan",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _store = useLocation();
    return () => {
      return <Navigate to={`/production/harvests${_store.value.search}${_store.value.hash}`} replace />;
    };
  }
});
export default HarvestPlan;
