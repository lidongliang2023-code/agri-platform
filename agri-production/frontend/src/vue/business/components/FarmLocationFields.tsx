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
import { Alert, Button, Form, Grid, Input, InputNumber, Segmented, Space, Switch, Typography, message } from '@/vue/ui';
import type { FormInstance } from '@/vue/ui';
import { TiandituBoundaryEditor, geocodeAddress, isValidLngLat, parseBoundaryVertices } from '@/vue/business/shared';
interface Props {
  form: FormInstance;
  disabled?: boolean;
  address?: () => string;
}

/** 农场中心坐标与边界共用地图，所有修改由农场表单统一保存。 */
const FarmLocationFields = defineComponent({
  name: "FarmLocationFields",
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
    const screens = computed(() => Grid.useBreakpoint());
    const longitude = Form.useWatch('longitude', __props.form);
    const latitude = Form.useWatch('latitude', __props.form);
    const boundary = Form.useWatch('boundary', __props.form);
    const clearCoordinates = Form.useWatch('clearCoordinates', __props.form);
    const clearBoundary = Form.useWatch('clearBoundary', __props.form);
    const vertices = computed(() => parseBoundaryVertices(boundary.value));
    const mode = shallowRef<'point' | 'boundary'>('point');
    const setMode = (next: typeof mode.value | ((previous: typeof mode.value) => typeof mode.value)) => {
      mode.value = typeof next === 'function' ? (next as (previous: typeof mode.value) => typeof mode.value)(mode.value) : next;
    };
    const locating = shallowRef(false);
    const setLocating = (next: typeof locating.value | ((previous: typeof locating.value) => typeof locating.value)) => {
      locating.value = typeof next === 'function' ? (next as (previous: typeof locating.value) => typeof locating.value)(locating.value) : next;
    };
    const hint = shallowRef('');
    const setHint = (next: typeof hint.value | ((previous: typeof hint.value) => typeof hint.value)) => {
      hint.value = typeof next === 'function' ? (next as (previous: typeof hint.value) => typeof hint.value)(hint.value) : next;
    };
    const focus = shallowRef<{
      longitude: number;
      latitude: number;
    } | null>(null);
    const setFocus = (next: typeof focus.value | ((previous: typeof focus.value) => typeof focus.value)) => {
      focus.value = typeof next === 'function' ? (next as (previous: typeof focus.value) => typeof focus.value)(focus.value) : next;
    };
    const locateSignal = shallowRef(0);
    const setLocateSignal = (next: typeof locateSignal.value | ((previous: typeof locateSignal.value) => typeof locateSignal.value)) => {
      locateSignal.value = typeof next === 'function' ? (next as (previous: typeof locateSignal.value) => typeof locateSignal.value)(locateSignal.value) : next;
    };
    const revision = shallowRef(0);
    const disabledRef = shallowRef(__props.disabled ?? false);
    watchEffect(() => {
      disabledRef.value = __props.disabled ?? false;
    });
    const validPoint = computed(() => longitude.value != null && latitude.value != null && isValidLngLat(Number(longitude.value), Number(latitude.value)));
    const point = computed(() => validPoint.value ? {
      longitude: Number(longitude.value),
      latitude: Number(latitude.value)
    } : null);
    const setPoint = (value: {
      longitude: number;
      latitude: number;
    }) => {
      if (disabledRef.value) return;
      revision.value += 1;
      __props.form.setFieldsValue({
        longitude: Number(value.longitude.toFixed(8)),
        latitude: Number(value.latitude.toFixed(8)),
        clearCoordinates: false
      });
      setFocus(null);
      setLocateSignal(signal => signal + 1);
      void __props.form.validateFields(['longitude', 'latitude']).catch(() => undefined);
    };
    const setVertices = (value: number[][]) => {
      if (disabledRef.value) return;
      if (value.length > 500) {
        message.warning('边界最多支持 500 个顶点');
        return;
      }
      __props.form.setFieldsValue({
        boundary: value.length ? JSON.stringify({
          type: 'Polygon',
          coordinates: [[...value, value[0]]]
        }) : undefined,
        clearBoundary: value.length === 0
      });
      void __props.form.validateFields(['boundary']).catch(() => undefined);
    };
    const locate = async () => {
      const keyword = __props.address?.().trim();
      if (!keyword) {
        message.warning('请先填写农场地址');
        return;
      }
      const requestRevision = ++revision.value;
      const requestedMode = mode.value;
      setLocating(true);
      try {
        const result = await geocodeAddress(keyword);
        if (revision.value !== requestRevision || disabledRef.value) return;
        if (requestedMode === 'point') setPoint(result);else {
          setFocus(result);
          setLocateSignal(signal => signal + 1);
        }
        setHint(`地址匹配：${result.matchedAddress || keyword}。${requestedMode === 'point' ? '请确认农场中心点后保存。' : '请沿农场外围绘制边界，中心坐标保持不变。'}`);
      } catch (error) {
        if (revision.value === requestRevision) message.error(error instanceof Error ? error.message : '地址定位失败，请手工录入或地图选点');
      } finally {
        setLocating(false);
      }
    };
    return () => {
      return <div class="farm-location-fields" style={{
        marginBottom: 24
      }}>
    <Typography.Title level={5}>农场位置与边界</Typography.Title>
    <Typography.Paragraph type="secondary">中心坐标与农场边界在同一地图维护，采用天地图经纬度口径（经度在前、纬度在后）。边界测算面积仅供参考，不替代登记面积。</Typography.Paragraph>
    <Form.Item name="clearCoordinates" hidden valuePropName="checked"><Switch /></Form.Item>
    <Form.Item name="clearBoundary" hidden valuePropName="checked"><Switch /></Form.Item>
    <Form.Item name="boundary" hidden rules={[{
          validator: (_, value) => !value || parseBoundaryVertices(value).length >= 3 ? Promise.resolve() : Promise.reject(new Error('农场边界至少需要 3 个不同顶点'))
        }]}><Input /></Form.Item>
    <Space class="farm-coordinate-fields" wrap size={16} align="start">
      <Form.Item name="longitude" label="中心点经度" dependencies={['latitude', 'clearCoordinates']} rules={[{
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
              setFocus(null);
            }} />
      </Form.Item>
      <Form.Item name="latitude" label="中心点纬度" dependencies={['longitude', 'clearCoordinates']} rules={[{
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
              setFocus(null);
            }} />
      </Form.Item>
      <Button disabled={__props.disabled ?? false} style={{
            marginTop: 30
          }} onClick={() => {
            revision.value += 1;
            __props.form.setFieldsValue({
              longitude: undefined,
              latitude: undefined,
              clearCoordinates: true
            });
            setFocus(null);
            setHint('');
            void __props.form.validateFields(['longitude', 'latitude']).catch(() => undefined);
          }}>清空中心坐标</Button>
    </Space>
    <Space class="farm-location-toolbar" wrap style={{
          marginBottom: 12
        }}>
      <Segmented disabled={__props.disabled ?? false} value={mode.value} options={[{
            label: '选取中心点',
            value: 'point'
          }, {
            label: '绘制边界',
            value: 'boundary'
          }]} onChange={value => {
            revision.value += 1;
            setMode(value as 'point' | 'boundary');
            setHint('');
            setFocus(null);
          }} />
      {__props.address && <Button disabled={__props.disabled ?? false} loading={locating.value} onClick={() => void locate()}>按地址定位</Button>}
      <Typography.Text type="secondary">中心坐标{validPoint.value ? '已登记' : '未登记'} · 边界 {vertices.value.length} 个顶点（最多 500 个）</Typography.Text>
    </Space>
    {clearCoordinates.value && <Alert type="warning" showIcon message="保存后将清空原有中心坐标，边界不受影响。" style={{
          marginBottom: 12
        }} />}
    {clearBoundary.value && <Alert type="warning" showIcon message="保存后将清空原有边界，中心坐标不受影响。" style={{
          marginBottom: 12
        }} />}
    {vertices.value.length > 0 && vertices.value.length < 3 && <Alert type="warning" showIcon message="边界至少需要 3 个不同顶点才能保存。" style={{
          marginBottom: 12
        }} />}
    {hint.value && <Alert type="info" showIcon message={hint.value} style={{
          marginBottom: 12
        }} />}
    <TiandituBoundaryEditor value={vertices.value} onChange={setVertices} disabled={__props.disabled ?? false} height={screens.value.md === false ? 280 : 400} focusPoint={focus.value ?? point.value} locateSignal={locateSignal.value} selectionMode={mode.value} onPointSelect={setPoint} showFocusMarkerWithBoundary />
    <Typography.Paragraph type="secondary" style={{
          marginTop: 8,
          marginBottom: 0
        }}>
      {mode.value === 'point' ? '点击地图设置农场中心点，已绘制边界保持不变。' : '沿农场外围依次点击绘制，点击顶点可删除该点；中心坐标保持不变。'} 保存后统一同步到农场档案与运营监管地图；取消不会生效。高德、百度等来源坐标请先转换后录入。
    </Typography.Paragraph>
  </div>;
    };
  }
});
export default FarmLocationFields;
