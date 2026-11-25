import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { GreenSupplyWorkspace, type GreenRequest } from "../components/GreenSupplyWorkspace";
import { cloudFactoryRequest } from '../api';
const opsRequest: GreenRequest = async <T,>(path: string, body?: unknown): Promise<T> => {
  if (path === 'public/green/factor') {
    const rows = await cloudFactoryRequest<{
      status: string;
    }[]>('/green/factor');
    return rows.filter(r => r.status === 'published') as T;
  }
  return cloudFactoryRequest<T>('/' + path.replace(/^ops\//, ''), body);
};
export const GreenSupplyOpsPage = defineComponent({
  name: "GreenSupplyOpsPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    return () => {
      return <GreenSupplyWorkspace request={opsRequest} ops />;
    };
  }
});
