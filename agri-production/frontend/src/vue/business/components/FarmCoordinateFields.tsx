import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Alert, Button, Form, InputNumber, Space, Switch, Typography, message } from '@/vue/ui';
import type { FormInstance } from '@/vue/ui';
import { TiandituMap, geocodeAddress, isValidLngLat } from '@/vue/business/shared';
interface Props {
  form: FormInstance;
  disabled?: boolean;
  address?: () => string;
}

/** 经纬度统一以天地图地理坐标录入，地图交互仅修改草稿。 */
const FarmCoordinateFields = defineComponent({
  name: "FarmCoordinateFields",
  props: {
    form: null as unknown as PropType<{
      form: FormInstance;
      disabled?: boolean;
      address?: () => string;
    }["form"]>,
    disabled: null as unknown as PropType<{
      form: FormInstance;
      disabled?: boolean;
      address?: () => string;
    }["disabled"]>,
    address: null as unknown as PropType<{
      form: FormInstance;
      disabled?: boolean;
      address?: () => string;
    }["address"]>
  },
  setup(__props: {
    form: FormInstance;
    disabled?: boolean;
    address?: () => string;
  }, {
    slots: __slots
  }) {
    const longitude = Form.useWatch('longitude', __props.form);
    const latitude = Form.useWatch('latitude', __props.form);
    const clearing = Form.useWatch('clearCoordinates', __props.form);
    const locating = shallowRef(false);
    const setLocating = (next: typeof locating.value | ((previous: typeof locating.value) => typeof locating.value)) => {
      locating.value = typeof next === 'function' ? (next as (previous: typeof locating.value) => typeof locating.value)(locating.value) : next;
    };
    const locationHint = shallowRef('');
    const setLocationHint = (next: typeof locationHint.value | ((previous: typeof locationHint.value) => typeof locationHint.value)) => {
      locationHint.value = typeof next === 'function' ? (next as (previous: typeof locationHint.value) => typeof locationHint.value)(locationHint.value) : next;
    };
    const revision = shallowRef(0);
    const disabledRef = shallowRef(__props.disabled ?? false);
    watchEffect(() => {
      disabledRef.value = __props.disabled ?? false;
    });
    const valid = computed(() => longitude.value != null && latitude.value != null && isValidLngLat(Number(longitude.value), Number(latitude.value)));
    const setPoint = (point: {
      longitude: number;
      latitude: number;
    }) => {
      if (disabledRef.value) return;
      revision.value += 1;
      __props.form.setFieldsValue({
        longitude: Number(point.longitude.toFixed(8)),
        latitude: Number(point.latitude.toFixed(8)),
        clearCoordinates: false
      });
      void __props.form.validateFields(['longitude', 'latitude']).catch(() => undefined);
    };
    const locate = async () => {
      const keyword = __props.address?.().trim();
      if (!keyword) {
        message.warning('请先填写农场地址');
        return;
      }
      const requestRevision = ++revision.value;
      setLocating(true);
      try {
        const result = await geocodeAddress(keyword);
        if (revision.value !== requestRevision || disabledRef.value) return;
        setPoint(result);
        setLocationHint(`地址匹配：${result.matchedAddress || keyword}${result.level ? `（${result.level}）` : ''}。请在地图确认准确位置后保存。`);
      } catch (error) {
        message.error(error instanceof Error ? error.message : '地址定位失败，请手工录入或地图选点');
      } finally {
        setLocating(false);
      }
    };
    return () => {
      return <div style={{
        marginBottom: 20
      }}>
    <Typography.Text strong>农场地理坐标</Typography.Text>
    <Typography.Paragraph type="secondary" style={{
          marginTop: 8,
          marginBottom: 12
        }}>
      经纬度单位为度，顺序为经度、纬度。请使用天地图同一坐标口径；高德、百度等来源坐标应先转换后录入。
    </Typography.Paragraph>
    <Form.Item name="clearCoordinates" hidden valuePropName="checked"><Switch /></Form.Item>
    <Space size={16} wrap align="start">
      <Form.Item name="longitude" label="经度" rules={[{
            type: 'number',
            min: -180,
            max: 180,
            message: '经度范围为 -180～180'
          }, {
            validator: (_, value) => value == null && __props.form.getFieldValue('latitude') != null ? Promise.reject(new Error('请同时填写经度')) : Promise.resolve()
          }]}>
        <InputNumber disabled={__props.disabled ?? false} min={-180} max={180} precision={8} placeholder="-180～180" style={{
              width: 210
            }} onChange={() => {
              revision.value += 1;
              __props.form.setFieldValue('clearCoordinates', false);
            }} />
      </Form.Item>
      <Form.Item name="latitude" label="纬度" rules={[{
            type: 'number',
            min: -90,
            max: 90,
            message: '纬度范围为 -90～90'
          }, {
            validator: (_, value) => value == null && __props.form.getFieldValue('longitude') != null ? Promise.reject(new Error('请同时填写纬度')) : Promise.resolve()
          }]}>
        <InputNumber disabled={__props.disabled ?? false} min={-90} max={90} precision={8} placeholder="-90～90" style={{
              width: 210
            }} onChange={() => {
              revision.value += 1;
              __props.form.setFieldValue('clearCoordinates', false);
            }} />
      </Form.Item>
      <Space wrap style={{
            marginTop: 30
          }}>
        {__props.address && <Button disabled={__props.disabled ?? false} loading={locating.value} onClick={() => void locate()}>按地址定位</Button>}
        <Button disabled={__props.disabled ?? false} onClick={() => {
              revision.value += 1;
              __props.form.setFieldsValue({
                longitude: undefined,
                latitude: undefined,
                clearCoordinates: true
              });
              setLocationHint('');
              void __props.form.validateFields(['longitude', 'latitude']).catch(() => undefined);
            }}>清空坐标</Button>
      </Space>
    </Space>
    {clearing.value && <Alert type="warning" showIcon message="保存后将清空农场原有坐标；取消或离开页面不会生效。" style={{
          marginBottom: 12
        }} />}
    {locationHint.value && <Alert type="info" showIcon message={locationHint.value} style={{
          marginBottom: 12
        }} />}
    <TiandituMap height={340} showLegend={false} selectable={!(__props.disabled ?? false)} selectedPoint={valid.value ? {
          longitude: Number(longitude.value),
          latitude: Number(latitude.value)
        } : null} onMap-click={setPoint} />
    <Typography.Paragraph type="secondary" style={{
          marginTop: 8,
          marginBottom: 0
        }}>点击地图回填坐标，保存后同步到农场资料和运营监管地图。底图不可用时仍可手工输入。</Typography.Paragraph>
  </div>;
    };
  }
});
export default FarmCoordinateFields;
