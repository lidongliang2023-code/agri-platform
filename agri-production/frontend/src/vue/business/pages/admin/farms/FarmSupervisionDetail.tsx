import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import '@/pages/admin/farms/FarmSupervisionCompact.css';
import { useParams, useNavigate } from '@/vue/router';
import { useQuery, useQueryClient } from '@/vue/query';
import { Alert, Button, Empty, Skeleton, Space, Tag, Typography } from '@/vue/ui';
import { EnvironmentOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { TiandituMap, computePolygonMetrics, isValidLngLat, parseBoundaryVertices, polygonCentroid } from '@/vue/business/shared';
import { PageContainer } from '@/vue/pro';
import Card from '@/vue/business/components/SectionCard';
import { DetailInfoGrid, DetailMetricGrid } from '@/vue/business/components/index';
import FarmRectificationPanel from '@/vue/business/components/FarmRectificationPanel';
import FarmPlotBoundaryChecks from '@/vue/business/components/FarmPlotBoundaryChecks';
import { supervisionDetail } from '@/api/admin/farm-supervision';
const farmTypes: Record<number, string> = {
  1: '种植类',
  2: '养殖类',
  3: '综合种养'
};
const FarmSupervisionDetail = defineComponent({
  name: "FarmSupervisionDetail",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _params = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const query = useQuery(() => ({
      queryKey: ['supervision-detail', _params.farmId],
      queryFn: () => supervisionDetail(_params.farmId!),
      enabled: !!_params.farmId,
      retry: false,
      refetchOnWindowFocus: true
    }));
    const detail = computed(() => query.data);
    const farm = computed(() => detail.value?.farm);
    const vertices = computed(() => parseBoundaryVertices(farm.value?.boundary));
    const hasBoundary = computed(() => vertices.value.length >= 3);
    const hasPoint = computed(() => farm.value?.longitude != null && farm.value?.latitude != null && isValidLngLat(Number(farm.value.longitude), Number(farm.value.latitude)));
    const center = computed(() => hasPoint.value ? {
      longitude: Number(farm.value!.longitude),
      latitude: Number(farm.value!.latitude)
    } : polygonCentroid(vertices.value));
    const metrics = computed(() => hasBoundary.value ? computePolygonMetrics(vertices.value) : null);
    const region = computed(() => [farm.value?.province, farm.value?.city, farm.value?.district].filter(Boolean).join(''));
    const address = computed(() => farm.value?.address ? farm.value.province && farm.value.address.startsWith(farm.value.province) ? farm.value.address : `${region.value}${farm.value.address}` : region.value || '未登记');
    const mapPath = `/admin/production/farms?view=map&farmId=${encodeURIComponent(_params.farmId ?? '')}`;
    const refresh = () => Promise.all([query.refetch(), queryClient.invalidateQueries({
      queryKey: ['farm-checks', false, _params.farmId]
    }), queryClient.invalidateQueries({
      queryKey: ['farm-plot-boundary-checks', true, _params.farmId]
    })]);
    return () => {
      return <PageContainer class="farm-supervision-compact" title={farm.value?.farmName || '农场监管详情'} subTitle="农场档案、空间范围与检查整改" onBack={() => navigate('/admin/production/farms')} extra={<Space wrap>
      <Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void refresh()}>刷新档案</Button>
      <Button icon={<EnvironmentOutlined />} disabled={!farm.value} onClick={() => navigate(mapPath)}>维护坐标</Button>
      <Button disabled={!farm.value} onClick={() => navigate(`${mapPath}&edit=boundary`)}>维护边界</Button>
      <Button type="primary" disabled={!farm.value} onClick={() => navigate(`/admin/production/farms/compliance?farmId=${encodeURIComponent(_params.farmId ?? '')}`)}>检查整改</Button>
    </Space>}>
    {query.isLoading ? <Skeleton active paragraph={{
          rows: 10
        }} /> : !farm.value || !detail.value ? <Empty description={<Space direction="vertical"><Typography.Text type="danger">{query.isError ? '农场档案读取失败' : '暂无农场档案'}</Typography.Text>{query.isError && <Typography.Text type="secondary">{(query.error as Error).message}</Typography.Text>}<Button onClick={() => void query.refetch()}>重新加载</Button></Space>} /> : <Space direction="vertical" size={12} style={{
          width: '100%'
        }}>
        {query.isError && <Alert showIcon type="warning" message="刷新失败，当前展示上次读取的农场档案" description={(query.error as Error).message} />}
        <Card title="基本信息" extra={<Tag color={Number(farm.value.status) === 1 ? 'green' : 'default'}>{Number(farm.value.status) === 1 ? '运营中' : '已停用'}</Tag>}>
          <DetailInfoGrid columns={3} items={[{
              key: 'code',
              label: '农场编号',
              value: farm.value.farmCode
            }, {
              key: 'type',
              label: '农场类型',
              value: farmTypes[farm.value.farmType] || '未分类'
            }, {
              key: 'tenant',
              label: '所属经营主体',
              value: farm.value.tenantName || '主体名称暂不可用'
            }, {
              key: 'area',
              label: '登记面积',
              value: farm.value.areaTotal == null ? '未登记' : `${Number(farm.value.areaTotal).toLocaleString('zh-CN')} 亩`
            }, {
              key: 'address',
              label: '农场地址',
              value: address.value,
              fullWidth: true
            }, {
              key: 'manager',
              label: '负责人',
              value: farm.value.managerName
            }, {
              key: 'phone',
              label: '联系电话',
              value: farm.value.managerPhone
            }, {
              key: 'created',
              label: '创建时间',
              value: farm.value.createdAt
            }, {
              key: 'updated',
              label: '更新时间',
              value: farm.value.updatedAt
            }]} />
        </Card>
        <DetailMetricGrid items={[{
            key: 'plots',
            title: '关联地块',
            value: detail.value.plotCount ?? null,
            suffix: '个',
            extra: '农场下登记的地块数量'
          }, {
            key: 'checks',
            title: '检查记录',
            value: detail.value.checkCount ?? null,
            suffix: '条',
            extra: '已登记的实际检查记录'
          }, {
            key: 'open',
            title: '未闭环问题',
            value: detail.value.openCount ?? null,
            suffix: '条',
            valueStyle: {
              color: detail.value.openCount > 0 ? '#d46b08' : undefined
            },
            extra: '含待整改、逾期及待复核记录'
          }, {
            key: 'review',
            title: '待运营复核',
            value: detail.value.reviewCount ?? null,
            suffix: '条',
            valueStyle: {
              color: detail.value.reviewCount > 0 ? '#1677ff' : undefined
            },
            extra: '经营主体已提交整改结果'
          }]} />
        <Card title="农场位置与边界" extra={<Space wrap><Button type="link" onClick={() => navigate(mapPath)}>维护坐标</Button><Button type="link" onClick={() => navigate(`${mapPath}&edit=boundary`)}>维护边界</Button></Space>}>
          <Space direction="vertical" size={12} style={{
              width: '100%'
            }}>
            <DetailInfoGrid columns={2} items={[{
                key: 'point',
                label: '中心坐标（经度 / 纬度）',
                value: hasPoint.value ? `${farm.value.longitude} / ${farm.value.latitude}` : '未登记'
              }, {
                key: 'boundary',
                label: '边界登记',
                value: hasBoundary.value ? `已绘制 · ${vertices.value.length} 个顶点` : '未绘制'
              }, {
                key: 'measured',
                label: '边界测算面积',
                value: metrics.value ? `约 ${metrics.value.areaMu.toFixed(2)} 亩` : '—'
              }, {
                key: 'perimeter',
                label: '边界测算周长',
                value: metrics.value ? `约 ${Math.round(metrics.value.perimeterMeters).toLocaleString('zh-CN')} 米` : '—'
              }]} />
            {center.value ? <TiandituMap key={String(farm.value.farmId)} height={280} showLegend={false} points={[{
                id: String(farm.value.farmId),
                title: farm.value.farmName,
                ...center.value,
                boundary: hasBoundary.value ? farm.value.boundary : undefined
              }]} selectedPoint={hasPoint.value ? {
                longitude: Number(farm.value.longitude),
                latitude: Number(farm.value.latitude)
              } : null} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未登记中心坐标和农场边界"><Button onClick={() => navigate(mapPath)}>补录农场位置</Button></Empty>}
            <Typography.Text type="secondary">坐标采用天地图口径；仅登记边界时使用边界中心辅助定位。测算面积不替代登记面积。</Typography.Text>
          </Space>
        </Card>
        <Card title="地块范围检查"><FarmPlotBoundaryChecks farmId={_params.farmId} boundary={farm.value.boundary} admin /></Card>
        <FarmRectificationPanel farmId={_params.farmId} />
      </Space>}
  </PageContainer>;
    };
  }
});
export default FarmSupervisionDetail;
