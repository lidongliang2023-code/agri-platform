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
import { Select } from '@/vue/ui';
import BusinessImportModal from '@/vue/business/components/BusinessImportModal';
import { createPlot, listPlots, type PlotPayload } from '@/api/plots';
import { loadCompletePages } from '@/utils/load-complete-pages';
import useAuthStore from '@/vue/authStore';
const headers = ['地块名称', '面积（亩）', '种植类型', '土壤类型', '灌溉方式', '中心经度', '中心纬度'];
const plantingTypes: Record<string, 1 | 2 | 3 | 4> = {
  '露天': 1,
  '大棚': 2,
  '水田': 3,
  '山地': 4
};
interface Props {
  farms: {
    farmId: string;
    farmName: string;
  }[];
  initialFarmId?: string;
  onClose: () => void;
  onComplete: () => unknown;
}
const PlotImportModal = defineComponent({
  name: "PlotImportModal",
  props: {
    farms: null as unknown as PropType<{
      farms: {
        farmId: string;
        farmName: string;
      }[];
      initialFarmId?: string;
      onClose: () => void;
      onComplete: () => unknown;
    }["farms"]>,
    initialFarmId: null as unknown as PropType<{
      farms: {
        farmId: string;
        farmName: string;
      }[];
      initialFarmId?: string;
      onClose: () => void;
      onComplete: () => unknown;
    }["initialFarmId"]>,
    onClose: null as unknown as PropType<{
      farms: {
        farmId: string;
        farmName: string;
      }[];
      initialFarmId?: string;
      onClose: () => void;
      onComplete: () => unknown;
    }["onClose"]>,
    onComplete: null as unknown as PropType<{
      farms: {
        farmId: string;
        farmName: string;
      }[];
      initialFarmId?: string;
      onClose: () => void;
      onComplete: () => unknown;
    }["onComplete"]>
  },
  setup(__props: {
    farms: {
      farmId: string;
      farmName: string;
    }[];
    initialFarmId?: string;
    onClose: () => void;
    onComplete: () => unknown;
  }, {
    slots: __slots
  }) {
    const farmId = shallowRef(__props.initialFarmId);
    const setFarmId = (next: typeof farmId.value | ((previous: typeof farmId.value) => typeof farmId.value)) => {
      farmId.value = typeof next === 'function' ? (next as (previous: typeof farmId.value) => typeof farmId.value)(farmId.value) : next;
    };
    const currentFarm = shallowRef(farmId.value);
    watchEffect(() => {
      currentFarm.value = farmId.value;
    });
    const subject = useAuthStore(state => state.userInfo?.tenantId);
    const token = useAuthStore(state => state.token);
    const existingNames = shallowRef(new Set<string>());
    const sessionAtOpen = shallowRef(token.value);
    const context = () => `${useAuthStore.getState().userInfo?.tenantId ?? ''}:${currentFarm.value ?? ''}:${useAuthStore.getState().token === sessionAtOpen.value ? 'same' : 'changed'}`;
    const available = computed(() => !!farmId.value && __props.farms.some(farm => String(farm.farmId) === String(farmId.value)) && !!subject.value && token.value === sessionAtOpen.value);
    return () => {
      return <BusinessImportModal open title="导入地块" headers={headers} requiredHeaders={['地块名称', '面积（亩）']} contextKey={`${subject.value ?? ''}:${farmId.value ?? ''}:${token.value === sessionAtOpen.value ? 'same' : 'changed'}`} getContextKey={context} contextReady={available.value} contextControl={<label>所属农场 <Select style={{
          width: 320
        }} placeholder="请选择所属农场" showSearch optionFilterProp="label" value={farmId.value} onChange={value => {
          currentFarm.value = value;
          setFarmId(value);
        }} options={__props.farms.map(farm => ({
          value: String(farm.farmId),
          label: farm.farmName
        }))} /></label>} beforeSubmit={async () => {
        if (!available.value) throw new Error('请选择当前主体的有效农场');
        const result = await loadCompletePages(listPlots, plot => plot.plotId);
        existingNames.value = new Set(result.list.filter(plot => String(plot.farmId) === String(currentFarm.value)).map(plot => plot.plotName.trim()));
      }} prepare={(raw, index, all) => {
        const errors: string[] = [];
        const name = raw['地块名称']?.trim() ?? '';
        const area = Number(raw['面积（亩）']);
        if (!name || name.length > 100) errors.push('地块名称必填且不能超过100字');
        if (!raw['面积（亩）'] || !Number.isFinite(area) || area <= 0) errors.push('面积必须为大于0的数值');
        if (all.some((row, i) => i !== index && row['地块名称']?.trim() === name)) errors.push('文件内地块名称重复');
        if (existingNames.value.has(name)) errors.push('所选农场已有同名地块');
        const kind = raw['种植类型']?.trim();
        if (kind && !plantingTypes[kind]) errors.push('种植类型仅支持：露天、大棚、水田、山地');
        const lng = raw['中心经度'],
          lat = raw['中心纬度'];
        if (!!lng !== !!lat) errors.push('中心经度和纬度必须同时填写');
        if (lng && (!Number.isFinite(Number(lng)) || Number(lng) < -180 || Number(lng) > 180)) errors.push('中心经度须在-180至180之间');
        if (lat && (!Number.isFinite(Number(lat)) || Number(lat) < -90 || Number(lat) > 90)) errors.push('中心纬度须在-90至90之间');
        return {
          errors,
          payload: {
            farmId: farmId.value,
            plotName: name,
            area,
            plantingType: kind ? plantingTypes[kind] : undefined,
            soilType: raw['土壤类型'] || undefined,
            irrigationType: raw['灌溉方式'] || undefined,
            centerLongitude: lng ? Number(lng) : undefined,
            centerLatitude: lat ? Number(lat) : undefined
          }
        };
      }} submit={payload => createPlot(payload)} onClose={__props.onClose} onComplete={__props.onComplete} />;
    };
  }
});
export default PlotImportModal;
