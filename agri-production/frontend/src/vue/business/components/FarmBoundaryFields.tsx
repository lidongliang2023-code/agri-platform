import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Alert, Button, Form, Input, Space, Switch, Typography, message } from '@/vue/ui';
import type { FormInstance } from '@/vue/ui';
import { TiandituBoundaryEditor, geocodeAddress, isValidLngLat, parseBoundaryVertices } from '@/vue/business/shared';
interface Props {
  form: FormInstance;
  disabled?: boolean;
  address?: () => string;
}

/** 农场边界草稿；保存由父级统一提交，不自动更改登记面积或中心点。 */
const FarmBoundaryFields = defineComponent({
  name: "FarmBoundaryFields",
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
    const boundary = computed(() => Form.useWatch('boundary', __props.form).value as string | undefined);
    const clearing = Form.useWatch('clearBoundary', __props.form);
    const longitude = Form.useWatch('longitude', __props.form);
    const latitude = Form.useWatch('latitude', __props.form);
    const vertices = computed(() => parseBoundaryVertices(boundary.value));
    const locating = shallowRef(false);
    const setLocating = (next: typeof locating.value | ((previous: typeof locating.value) => typeof locating.value)) => {
      locating.value = typeof next === 'function' ? (next as (previous: typeof locating.value) => typeof locating.value)(locating.value) : next;
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
    const request = shallowRef(0);
    const disabledRef = shallowRef(__props.disabled ?? false);
    watchEffect(() => {
      disabledRef.value = __props.disabled ?? false;
    });
    const locate = async () => {
      const keyword = __props.address?.().trim();
      if (!keyword) {
        message.warning('请先填写农场地址');
        return;
      }
      const revision = ++request.value;
      setLocating(true);
      try {
        const result = await geocodeAddress(keyword);
        if (request.value !== revision || disabledRef.value) return;
        setFocus(result);
        setLocateSignal(signal => signal + 1);
        message.info(`已定位到${result.matchedAddress || keyword}，请确认后沿农场边缘绘制`);
      } catch (error) {
        if (request.value === revision) message.error(error instanceof Error ? error.message : '地址定位失败');
      } finally {
        setLocating(false);
      }
    };
    const setVertices = (value: number[][]) => {
      if (disabledRef.value) return;
      __props.form.setFieldsValue({
        boundary: value.length ? JSON.stringify({
          type: 'Polygon',
          coordinates: [[...value, value[0]]]
        }) : undefined,
        clearBoundary: value.length === 0
      });
      void __props.form.validateFields(['boundary']).catch(() => undefined);
    };
    return () => {
      return <div style={{
        marginBottom: 20
      }}>
    <Typography.Title level={5}>农场边界</Typography.Title>
    <Typography.Paragraph type="secondary">沿农场外围依次点击，至少 3 个顶点形成闭合面。边界测算面积仅供参考，不替代登记面积；坐标采用天地图口径。</Typography.Paragraph>
    <Form.Item name="boundary" hidden rules={[{
          validator: (_, value) => !value || parseBoundaryVertices(value).length >= 3 ? Promise.resolve() : Promise.reject(new Error('农场边界至少需要 3 个不同顶点'))
        }]}><Input /></Form.Item>
    <Form.Item name="clearBoundary" hidden valuePropName="checked"><Switch /></Form.Item>
    <Space wrap style={{
          marginBottom: 12
        }}>
      {__props.address && <Button disabled={__props.disabled ?? false} loading={locating.value} onClick={() => void locate()}>按地址定位绘制区域</Button>}
      <Button disabled={(__props.disabled ?? false) || !vertices.value.length} onClick={() => setVertices(vertices.value.slice(0, -1))}>撤销上一点</Button>
      <Button disabled={(__props.disabled ?? false) || !vertices.value.length} onClick={() => setVertices([])}>清空边界</Button>
      <Typography.Text type="secondary">已绘制 {vertices.value.length} 个顶点（最多 500 个）</Typography.Text>
    </Space>
    {clearing.value && <Alert type="warning" showIcon message="保存后将清空原有农场边界，取消不会生效。" style={{
          marginBottom: 12
        }} />}
    {vertices.value.length > 0 && vertices.value.length < 3 && <Alert type="warning" showIcon message="请继续绘制，至少需要 3 个不同顶点才能保存。" style={{
          marginBottom: 12
        }} />}
    <TiandituBoundaryEditor value={vertices.value} onChange={value => {
          if (value.length > 500) {
            message.warning('边界最多支持 500 个顶点');
            return;
          }
          ;
          setVertices(value);
        }} disabled={__props.disabled ?? false} height={400} focusPoint={focus.value ?? (longitude.value != null && latitude.value != null && isValidLngLat(Number(longitude.value), Number(latitude.value)) ? {
          longitude: Number(longitude.value),
          latitude: Number(latitude.value)
        } : null)} locateSignal={locateSignal.value} />
    <Typography.Paragraph type="secondary" style={{
          marginTop: 8,
          marginBottom: 0
        }}>点击顶点标记可删除该点。交叉或重叠的边界会在保存时被拒绝，请沿外围按顺序绘制。</Typography.Paragraph>
  </div>;
    };
  }
});
export default FarmBoundaryFields;
