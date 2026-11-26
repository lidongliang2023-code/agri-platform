import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Col, Form, Select } from "@/vue/ui";
import type { ColProps, FormInstance } from "@/vue/ui";
import { getChinaCities, PROVINCE_OPTIONS } from '@/data/chinaRegions';
interface ProvinceCityFieldsProps {
  form: FormInstance;
  provinceName?: string;
  cityName?: string;
  provinceLabel?: string;
  cityLabel?: string;
  required?: boolean;
  provinceColProps?: ColProps;
  cityColProps?: ColProps;
}

/** 省市联动字段。省份变化时清空已选城市，避免留下不匹配的组合。 */
const ProvinceCityFields = defineComponent({
  name: "ProvinceCityFields",
  props: {
    form: null as unknown as PropType<{
      form: FormInstance;
      provinceName?: string;
      cityName?: string;
      provinceLabel?: string;
      cityLabel?: string;
      required?: boolean;
      provinceColProps?: ColProps;
      cityColProps?: ColProps;
    }["form"]>,
    provinceName: null as unknown as PropType<{
      form: FormInstance;
      provinceName?: string;
      cityName?: string;
      provinceLabel?: string;
      cityLabel?: string;
      required?: boolean;
      provinceColProps?: ColProps;
      cityColProps?: ColProps;
    }["provinceName"]>,
    cityName: null as unknown as PropType<{
      form: FormInstance;
      provinceName?: string;
      cityName?: string;
      provinceLabel?: string;
      cityLabel?: string;
      required?: boolean;
      provinceColProps?: ColProps;
      cityColProps?: ColProps;
    }["cityName"]>,
    provinceLabel: null as unknown as PropType<{
      form: FormInstance;
      provinceName?: string;
      cityName?: string;
      provinceLabel?: string;
      cityLabel?: string;
      required?: boolean;
      provinceColProps?: ColProps;
      cityColProps?: ColProps;
    }["provinceLabel"]>,
    cityLabel: null as unknown as PropType<{
      form: FormInstance;
      provinceName?: string;
      cityName?: string;
      provinceLabel?: string;
      cityLabel?: string;
      required?: boolean;
      provinceColProps?: ColProps;
      cityColProps?: ColProps;
    }["cityLabel"]>,
    required: null as unknown as PropType<{
      form: FormInstance;
      provinceName?: string;
      cityName?: string;
      provinceLabel?: string;
      cityLabel?: string;
      required?: boolean;
      provinceColProps?: ColProps;
      cityColProps?: ColProps;
    }["required"]>,
    provinceColProps: null as unknown as PropType<{
      form: FormInstance;
      provinceName?: string;
      cityName?: string;
      provinceLabel?: string;
      cityLabel?: string;
      required?: boolean;
      provinceColProps?: ColProps;
      cityColProps?: ColProps;
    }["provinceColProps"]>,
    cityColProps: null as unknown as PropType<{
      form: FormInstance;
      provinceName?: string;
      cityName?: string;
      provinceLabel?: string;
      cityLabel?: string;
      required?: boolean;
      provinceColProps?: ColProps;
      cityColProps?: ColProps;
    }["cityColProps"]>
  },
  setup(__props: {
    form: FormInstance;
    provinceName?: string;
    cityName?: string;
    provinceLabel?: string;
    cityLabel?: string;
    required?: boolean;
    provinceColProps?: ColProps;
    cityColProps?: ColProps;
  }, {
    slots: __slots
  }) {
    const province = Form.useWatch(__props.provinceName ?? 'deliveryProvince', __props.form);
    const currentCity = Form.useWatch(__props.cityName ?? 'deliveryCity', __props.form);
    const knownCities = computed(() => getChinaCities(province.value));
    const cityOptions = computed(() => [...knownCities.value.map(city => ({
      value: city,
      label: city
    }))]);
    return () => {
      if (currentCity.value && !knownCities.value.includes(currentCity.value)) {
        cityOptions.value.unshift({
          value: currentCity.value,
          label: `${currentCity.value}（历史值）`
        });
      }
      return <>
      <Col {...__props.provinceColProps ?? {
          xs: 24,
          md: 8
        }}>
        <Form.Item label={__props.provinceLabel ?? '省份'} name={__props.provinceName ?? 'deliveryProvince'} rules={__props.required ?? false ? [{
            required: true,
            message: `请选择${__props.provinceLabel ?? '省份'}`
          }] : undefined}>
          <Select showSearch allowClear={!(__props.required ?? false)} optionFilterProp="label" placeholder={`请选择${__props.provinceLabel ?? '省份'}`} options={PROVINCE_OPTIONS} onChange={() => __props.form.setFieldValue(__props.cityName ?? 'deliveryCity', undefined)} />
        </Form.Item>
      </Col>
      <Col {...__props.cityColProps ?? {
          xs: 24,
          md: 8
        }}>
        <Form.Item label={__props.cityLabel ?? '城市'} name={__props.cityName ?? 'deliveryCity'} rules={__props.required ?? false ? [{
            required: true,
            message: `请选择${__props.cityLabel ?? '城市'}`
          }] : undefined}>
          <Select showSearch allowClear={!(__props.required ?? false)} optionFilterProp="label" disabled={!province.value} placeholder={province.value ? `请选择${__props.cityLabel ?? '城市'}` : `请先选择${__props.provinceLabel ?? '省份'}`} options={cityOptions.value} />
        </Form.Item>
      </Col>
    </>;
    };
  }
});
export default ProvinceCityFields;
