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
import { Empty, Space, Typography } from '@/vue/ui';
import { TiandituMap, computePolygonMetrics, parseBoundaryVertices, polygonCentroid } from '@/vue/business/shared';
const FarmBoundaryPreview = defineComponent({
  name: "FarmBoundaryPreview",
  props: {
    boundary: null as unknown as PropType<{
      boundary?: string | null;
      name?: string;
    }["boundary"]>,
    name: null as unknown as PropType<{
      boundary?: string | null;
      name?: string;
    }["name"]>
  },
  setup(__props: {
    boundary?: string | null;
    name?: string;
  }, {
    slots: __slots
  }) {
    const vertices = computed(() => parseBoundaryVertices(__props.boundary));
    const center = computed(() => polygonCentroid(vertices.value));
    const metrics = computed(() => computePolygonMetrics(vertices.value));
    return () => {
      if (vertices.value.length < 3 || !center.value) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未绘制农场边界" />;
      return <Space direction="vertical" style={{
        width: '100%'
      }}>
    <Typography.Text type="secondary">{vertices.value.length} 个顶点 · 测算面积约 {metrics.value.areaMu.toFixed(2)} 亩 · 周长约 {Math.round(metrics.value.perimeterMeters)} 米（测算值仅供参考）</Typography.Text>
    <TiandituMap height={340} showLegend={false} points={[{
          id: 'farm-boundary',
          title: __props.name ?? '农场',
          ...center.value,
          boundary: __props.boundary
        }]} />
  </Space>;
    };
  }
});
export default FarmBoundaryPreview;
