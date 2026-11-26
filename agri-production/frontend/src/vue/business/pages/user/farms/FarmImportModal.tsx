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
import BusinessImportModal from '@/vue/business/components/BusinessImportModal';
import { createFarm, listFarms, type FarmPayload } from '@/api/farms';
import { FARM_IMPORT_COLUMNS, prepareFarmImportRecord } from '@/utils/farm-import';
import { loadCompletePages } from '@/utils/load-complete-pages';
import useAuthStore from '@/vue/authStore';
interface Props {
  onClose: () => void;
  onComplete: () => unknown;
}

/** 农场导入仅提供业务校验和保存，解析、预览及结果由统一组件处理。 */
const FarmImportModal = defineComponent({
  name: "FarmImportModal",
  props: {
    onClose: null as unknown as PropType<{
      onClose: () => void;
      onComplete: () => unknown;
    }["onClose"]>,
    onComplete: null as unknown as PropType<{
      onClose: () => void;
      onComplete: () => unknown;
    }["onComplete"]>
  },
  setup(__props: {
    onClose: () => void;
    onComplete: () => unknown;
  }, {
    slots: __slots
  }) {
    const subject = useAuthStore(state => state.userInfo?.tenantId);
    const token = useAuthStore(state => state.token);
    const initialSession = shallowRef({
      subject: subject.value,
      token: token.value
    });
    const existingNames = shallowRef(new Set<string>());
    const context = () => {
      const current = useAuthStore.getState();
      return `${current.userInfo?.tenantId ?? ''}:${current.token === initialSession.value.token ? 'same' : 'changed'}`;
    };
    const available = computed(() => !!subject.value && !!token.value && subject.value === initialSession.value.subject && token.value === initialSession.value.token);
    return () => {
      return <BusinessImportModal open title="导入农场" headers={FARM_IMPORT_COLUMNS} requiredHeaders={['农场名称', '农场类型', '省份', '城市', '区县', '详细地址', '面积（亩）', '负责人', '联系电话']} contextKey={`${subject.value ?? ''}:${token.value === initialSession.value.token ? 'same' : 'changed'}`} getContextKey={context} contextReady={available.value} beforeSubmit={async () => {
        if (!available.value) throw new Error('登录或所属主体已变化，请重新打开导入');
        const result = await loadCompletePages(listFarms, farm => farm.farmId);
        existingNames.value = new Set(result.list.map(farm => farm.farmName.trim()));
      }} prepare={(raw, index, all) => {
        const result = prepareFarmImportRecord(raw);
        const name = raw['农场名称']?.trim() ?? '';
        if (all.some((row, i) => i !== index && row['农场名称']?.trim() === name)) result.errors.push('文件内农场名称重复');
        if (existingNames.value.has(name)) result.errors.push('当前主体已有同名农场');
        return result;
      }} submit={payload => createFarm(payload)} onClose={__props.onClose} onComplete={__props.onComplete} />;
    };
  }
});
export default FarmImportModal;
