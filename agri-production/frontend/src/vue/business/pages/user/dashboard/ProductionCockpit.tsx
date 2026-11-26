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

/** 兼容原驾驶舱入口，统一进入生产数据看板。 */
const ProductionCockpit = defineComponent({
  name: "ProductionCockpit",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _store = useLocation();
    return () => {
      return <Navigate to={`/production/dashboard${_store.value.search}${_store.value.hash}`} replace />;
    };
  }
});
export default ProductionCockpit;
