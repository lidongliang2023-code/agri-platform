import { defineComponent, shallowRef, computed, watch } from 'vue';
import '@/components/ProductionDetailCompact.css';
import '@/pages/admin/farms/FarmSupervisionCompact.css';
import { useParams, useNavigate } from '@/vue/router';
import { useQuery, useQueryClient } from '@/vue/query';
import { Alert, Button, Empty, Skeleton, Space, Typography } from '@/vue/ui';
import { EnvironmentOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import {
  TiandituMap,
  computePolygonMetrics,
  isValidLngLat,
  parseBoundaryVertices,
  polygonCentroid,
} from '@/vue/business/shared';
import {
  DetailInfoGrid,
  DetailMetricGrid,
  DetailRelatedDocs,
  DetailSection,
  DetailTimeline,
  ProductionDetailLayout,
  type DetailRelatedDocItem,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@/vue/business/components/index';
import FarmRectificationPanel from '@/vue/business/components/FarmRectificationPanel';
import FarmPlotBoundaryChecks from '@/vue/business/components/FarmPlotBoundaryChecks';
import { supervisionDetail } from '@/api/admin/farm-supervision';

const farmTypes: Record<number, string> = {
  1: '种植类',
  2: '养殖类',
  3: '综合种养',
};

const FarmSupervisionDetail = defineComponent({
  name: 'FarmSupervisionDetail',
  props: {},
  setup() {
    const _params = useParams<{ farmId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const activeTab = shallowRef<string>('overview');

    watch(() => _params.farmId, () => {
      activeTab.value = 'overview';
    });

    const query = useQuery(() => ({
      queryKey: ['supervision-detail', _params.farmId],
      queryFn: () => supervisionDetail(_params.farmId!),
      enabled: !!_params.farmId,
      retry: false,
      refetchOnWindowFocus: true,
    }));

    const detail = computed(() => query.data);
    const farm = computed(() => detail.value?.farm);
    const vertices = computed(() => parseBoundaryVertices(farm.value?.boundary));
    const hasBoundary = computed(() => vertices.value.length >= 3);
    const hasPoint = computed(
      () =>
        farm.value?.longitude != null &&
        farm.value?.latitude != null &&
        isValidLngLat(Number(farm.value.longitude), Number(farm.value.latitude)),
    );
    const center = computed(() =>
      hasPoint.value
        ? { longitude: Number(farm.value!.longitude), latitude: Number(farm.value!.latitude) }
        : polygonCentroid(vertices.value),
    );
    const metrics = computed(() => (hasBoundary.value ? computePolygonMetrics(vertices.value) : null));
    const region = computed(() => [farm.value?.province, farm.value?.city, farm.value?.district].filter(Boolean).join(''));
    const address = computed(() =>
      farm.value?.address
        ? farm.value.province && farm.value.address.startsWith(farm.value.province)
          ? farm.value.address
          : `${region.value}${farm.value.address}`
        : region.value || '未登记',
    );
    const mapPath = computed(() => `/admin/production/farms?view=map&farmId=${encodeURIComponent(_params.farmId ?? '')}`);

    const refresh = () =>
      Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ['farm-checks', false, _params.farmId] }),
        queryClient.invalidateQueries({ queryKey: ['farm-plot-boundary-checks', true, _params.farmId] }),
      ]);

    return () => {
      if (query.isLoading) {
        return (
          <ProductionDetailLayout
            class="production-detail-compact farm-supervision-compact"
            title="农场监管详情"
            hasAside={false}
            backLabel="返回农场监管"
            onBack={() => navigate('/admin/production/farms')}
          >
            <DetailSection>
              <Skeleton active paragraph={{ rows: 8 }} />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (!farm.value || !detail.value) {
        return (
          <ProductionDetailLayout
            class="production-detail-compact farm-supervision-compact"
            title="农场监管详情"
            hasAside={false}
            backLabel="返回农场监管"
            onBack={() => navigate('/admin/production/farms')}
          >
            <DetailSection>
              <Empty
                description={
                  <Space direction="vertical">
                    <Typography.Text type="danger">{query.isError ? '农场档案读取失败' : '暂无农场档案'}</Typography.Text>
                    {query.isError && <Typography.Text type="secondary">{(query.error as Error).message}</Typography.Text>}
                    <Button onClick={() => void query.refetch()}>重新加载</Button>
                  </Space>
                }
              />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      const currentFarm = farm.value;
      const currentDetail = detail.value;
      const isOperating = Number(currentFarm.status) === 1;
      const openCount = Number(currentDetail.openCount ?? 0);
      const reviewCount = Number(currentDetail.reviewCount ?? 0);
      const checkCount = Number(currentDetail.checkCount ?? 0);
      const plotCount = Number(currentDetail.plotCount ?? 0);

      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '农场详情' },
        { key: 'boundary', label: '位置与地块校验', count: plotCount },
        { key: 'rectification', label: '检查与整改', count: checkCount },
      ];

      const progressSteps: DetailTimelineStep[] = [
        {
          key: 'archive',
          title: '农场建档登记',
          time: currentFarm.createdAt ?? undefined,
          description: `${farmTypes[currentFarm.farmType] || '未分类'} · 负责人 ${currentFarm.managerName || '未登记'}`,
          state: 'done',
        },
        {
          key: 'spatial',
          title: hasBoundary.value ? '空间范围已绘制' : hasPoint.value ? '已登记中心坐标' : '空间范围待补录',
          description: hasBoundary.value
            ? `${vertices.value.length} 个顶点 · 测算约 ${metrics.value?.areaMu.toFixed(2) ?? '—'} 亩`
            : hasPoint.value
              ? '尚未绘制边界多边形'
              : '未登记中心坐标和边界',
          state: hasBoundary.value ? 'done' : hasPoint.value ? 'current' : 'pending',
        },
        {
          key: 'check',
          title: checkCount > 0 ? `已登记 ${checkCount} 条合规检查` : '暂无合规检查记录',
          time: currentFarm.updatedAt ?? undefined,
          description: checkCount > 0 ? '可在“检查与整改”页签登记新检查' : '待开展首次合规巡检',
          state: checkCount > 0 ? 'done' : 'pending',
        },
        {
          key: 'rectify',
          title: reviewCount > 0 ? `${reviewCount} 条整改待运营复核` : openCount > 0 ? `${openCount} 条问题整改中` : '合规整改已闭环',
          description:
            reviewCount > 0
              ? '经营主体已提交整改结果，等待复核'
              : openCount > 0
                ? '存在待整改或逾期未闭环项'
                : checkCount > 0
                  ? '全部检查问题已闭环'
                  : '当前无待整改问题',
          state: reviewCount > 0 ? 'current' : openCount > 0 ? 'error' : checkCount > 0 ? 'done' : 'pending',
        },
      ];

      const relatedDocs: DetailRelatedDocItem[] = [
        {
          key: 'tenant',
          label: '所属经营主体',
          text: currentFarm.tenantName || undefined,
          emptyText: '主体名称暂不可用',
          mono: false,
        },
        {
          key: 'map',
          label: '空间位置档案',
          text: hasBoundary.value ? `边界已绘制（${vertices.value.length} 点）` : hasPoint.value ? '已登记中心坐标' : '补录坐标 / 边界',
          mono: false,
          badge: hasBoundary.value ? '完整' : hasPoint.value ? '缺边界' : '待补录',
          badgeTone: hasBoundary.value ? 'green' : 'orange',
          onClick: () => navigate(mapPath.value),
        },
        {
          key: 'plots',
          label: '地块边界校验',
          text: `${plotCount} 个关联地块`,
          mono: false,
          onClick: () => {
            activeTab.value = 'boundary';
          },
        },
        {
          key: 'compliance',
          label: '合规检查台账',
          text: `${checkCount} 条检查记录`,
          mono: false,
          badge: reviewCount > 0 ? `${reviewCount} 待复核` : openCount > 0 ? `${openCount} 未闭环` : undefined,
          badgeTone: reviewCount > 0 ? 'blue' : openCount > 0 ? 'orange' : undefined,
          onClick: () => navigate(`/admin/production/farms/compliance?farmId=${encodeURIComponent(_params.farmId ?? '')}`),
        },
      ];

      return (
        <ProductionDetailLayout
          class="production-detail-compact farm-supervision-compact"
          code={currentFarm.farmCode || String(currentFarm.farmId)}
          title={currentFarm.farmName || '农场监管详情'}
          status={{ label: isOperating ? '运营中' : '已停用', tone: isOperating ? 'green' : 'gray' }}
          extraStatuses={
            reviewCount > 0
              ? [{ label: `${reviewCount} 条待复核`, tone: 'blue' }]
              : openCount > 0
                ? [{ label: `${openCount} 条未闭环`, tone: 'orange' }]
                : []
          }
          meta={[
            { label: '经营主体', value: currentFarm.tenantName || '主体名称暂不可用' },
            { label: '负责人', value: currentFarm.managerName || '—' },
            { label: '登记面积', value: currentFarm.areaTotal == null ? '未登记' : `${Number(currentFarm.areaTotal).toLocaleString('zh-CN')} 亩` },
            { label: '创建时间', value: currentFarm.createdAt || '—' },
          ]}
          tabs={tabs}
          activeTab={activeTab.value}
          backLabel="返回农场监管"
          onBack={() => navigate('/admin/production/farms')}
          onTabChange={key => {
            activeTab.value = key;
          }}
          banner={
            query.isError ? (
              <Alert
                showIcon
                type="warning"
                message="刷新失败，当前展示上次读取的农场档案"
                description={(query.error as Error).message}
              />
            ) : undefined
          }
          actions={
            <>
              <Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void refresh()}>
                刷新档案
              </Button>
              <Button icon={<EnvironmentOutlined />} onClick={() => navigate(mapPath.value)}>
                维护坐标
              </Button>
              <Button onClick={() => navigate(`${mapPath.value}&edit=boundary`)}>维护边界</Button>
              <Button
                type="primary"
                onClick={() => navigate(`/admin/production/farms/compliance?farmId=${encodeURIComponent(_params.farmId ?? '')}`)}
              >
                检查整改
              </Button>
            </>
          }
          aside={
            <>
              <DetailSection title="监管进度">
                <DetailTimeline items={progressSteps} />
              </DetailSection>
              <DetailSection title="关联单据">
                <DetailRelatedDocs items={relatedDocs} />
              </DetailSection>
            </>
          }
        >
          {activeTab.value === 'overview' && (
            <>
              <DetailSection title="基本信息">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    { key: 'code', label: '农场编号', value: currentFarm.farmCode, mono: true },
                    { key: 'type', label: '农场类型', value: farmTypes[currentFarm.farmType] || '未分类' },
                    { key: 'tenant', label: '所属经营主体', value: currentFarm.tenantName || '主体名称暂不可用' },
                    {
                      key: 'area',
                      label: '登记面积',
                      value: currentFarm.areaTotal == null ? '未登记' : `${Number(currentFarm.areaTotal).toLocaleString('zh-CN')} 亩`,
                      mono: currentFarm.areaTotal != null,
                    },
                    { key: 'manager', label: '负责人', value: currentFarm.managerName },
                    { key: 'phone', label: '联系电话', value: currentFarm.managerPhone, mono: true },
                    { key: 'address', label: '农场地址', value: address.value, fullWidth: true },
                    { key: 'created', label: '创建时间', value: currentFarm.createdAt, mono: true },
                    { key: 'updated', label: '更新时间', value: currentFarm.updatedAt, mono: true },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="监管指标概览"
                extra={
                  <button
                    type="button"
                    class="agri-detail-section-link"
                    onClick={() => {
                      activeTab.value = 'rectification';
                    }}
                  >
                    查看全部 {checkCount} 条检查
                  </button>
                }
              >
                <DetailMetricGrid
                  items={[
                    {
                      key: 'plots',
                      title: '关联地块',
                      value: currentDetail.plotCount ?? null,
                      suffix: '个',
                      extra: '农场下登记的地块数量',
                    },
                    {
                      key: 'checks',
                      title: '检查记录',
                      value: currentDetail.checkCount ?? null,
                      suffix: '条',
                      extra: '已登记的实际检查记录',
                    },
                    {
                      key: 'open',
                      title: '未闭环问题',
                      value: currentDetail.openCount ?? null,
                      suffix: '条',
                      valueStyle: { color: openCount > 0 ? '#d46b08' : undefined },
                      extra: '含待整改、逾期及待复核记录',
                    },
                    {
                      key: 'review',
                      title: '待运营复核',
                      value: currentDetail.reviewCount ?? null,
                      suffix: '条',
                      valueStyle: { color: reviewCount > 0 ? '#1677ff' : undefined },
                      extra: '经营主体已提交整改结果',
                    },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="农场位置与边界"
                extra={
                  <button
                    type="button"
                    class="agri-detail-section-link"
                    onClick={() => {
                      activeTab.value = 'boundary';
                    }}
                  >
                    查看地块校验（{plotCount}）
                  </button>
                }
              >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <DetailInfoGrid
                    columns={2}
                    items={[
                      {
                        key: 'point',
                        label: '中心坐标',
                        value: hasPoint.value ? `${currentFarm.longitude}, ${currentFarm.latitude}` : '未登记',
                        mono: hasPoint.value,
                      },
                      {
                        key: 'boundary',
                        label: '边界登记',
                        value: hasBoundary.value ? `已绘制 · ${vertices.value.length} 个顶点` : '未绘制',
                      },
                      {
                        key: 'measured',
                        label: '边界测算面积',
                        value: metrics.value ? `约 ${metrics.value.areaMu.toFixed(2)} 亩` : '—',
                        mono: Boolean(metrics.value),
                      },
                      {
                        key: 'perimeter',
                        label: '边界测算周长',
                        value: metrics.value ? `约 ${Math.round(metrics.value.perimeterMeters).toLocaleString('zh-CN')} 米` : '—',
                        mono: Boolean(metrics.value),
                      },
                    ]}
                  />
                  {center.value ? (
                    <TiandituMap
                      key={String(currentFarm.farmId)}
                      height={260}
                      showLegend={false}
                      points={[
                        {
                          id: String(currentFarm.farmId),
                          title: currentFarm.farmName,
                          ...center.value,
                          boundary: hasBoundary.value ? currentFarm.boundary : undefined,
                        },
                      ]}
                      selectedPoint={
                        hasPoint.value
                          ? { longitude: Number(currentFarm.longitude), latitude: Number(currentFarm.latitude) }
                          : null
                      }
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未登记中心坐标和农场边界">
                      <Button onClick={() => navigate(mapPath.value)}>补录农场位置</Button>
                    </Empty>
                  )}
                  <Typography.Text type="secondary">
                    坐标采用天地图口径；仅登记边界时使用边界中心辅助定位。测算面积不替代登记面积。
                  </Typography.Text>
                </Space>
              </DetailSection>
            </>
          )}

          {activeTab.value === 'boundary' && (
            <>
              <DetailSection title="农场位置与边界">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <DetailInfoGrid
                    columns={2}
                    items={[
                      {
                        key: 'point',
                        label: '中心坐标',
                        value: hasPoint.value ? `${currentFarm.longitude}, ${currentFarm.latitude}` : '未登记',
                        mono: hasPoint.value,
                      },
                      {
                        key: 'boundary',
                        label: '边界登记',
                        value: hasBoundary.value ? `已绘制 · ${vertices.value.length} 个顶点` : '未绘制',
                      },
                      {
                        key: 'measured',
                        label: '边界测算面积',
                        value: metrics.value ? `约 ${metrics.value.areaMu.toFixed(2)} 亩` : '—',
                        mono: Boolean(metrics.value),
                      },
                      {
                        key: 'perimeter',
                        label: '边界测算周长',
                        value: metrics.value ? `约 ${Math.round(metrics.value.perimeterMeters).toLocaleString('zh-CN')} 米` : '—',
                        mono: Boolean(metrics.value),
                      },
                    ]}
                  />
                  {center.value ? (
                    <TiandituMap
                      key={`${String(currentFarm.farmId)}-boundary`}
                      height={280}
                      showLegend={false}
                      points={[
                        {
                          id: String(currentFarm.farmId),
                          title: currentFarm.farmName,
                          ...center.value,
                          boundary: hasBoundary.value ? currentFarm.boundary : undefined,
                        },
                      ]}
                      selectedPoint={
                        hasPoint.value
                          ? { longitude: Number(currentFarm.longitude), latitude: Number(currentFarm.latitude) }
                          : null
                      }
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未登记中心坐标和农场边界" />
                  )}
                </Space>
              </DetailSection>
              <DetailSection title="地块范围检查">
                <FarmPlotBoundaryChecks farmId={_params.farmId} boundary={currentFarm.boundary} admin />
              </DetailSection>
            </>
          )}

          {activeTab.value === 'rectification' && (
            <FarmRectificationPanel farmId={_params.farmId} />
          )}
        </ProductionDetailLayout>
      );
    };
  },
});

export default FarmSupervisionDetail;
