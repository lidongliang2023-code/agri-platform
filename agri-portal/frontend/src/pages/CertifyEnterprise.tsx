import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { CertificationGuide } from '../components/CertificationGuide';
export const CertifyEnterprise = defineComponent({
  name: "CertifyEnterprise",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    return () => {
      return <CertificationGuide kind="enterprise" />;
    };
  }
});
