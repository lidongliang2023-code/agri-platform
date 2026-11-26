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
import ProductionOverview from './ProductionOverview';

/** 生产看板：生产概况、待办任务与告警处置入口。 */
const DashboardHome = defineComponent({
  name: "DashboardHome",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    return () => {
      return <ProductionOverview />;
    };
  }
});
export default DashboardHome;
