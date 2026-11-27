import { defineComponent, shallowRef, computed, watch, type VNodeChild } from 'vue';
import '@/components/ProductionDetailCompact.css';
import FarmRectificationPanel from '@/vue/business/components/FarmRectificationPanel';
import FarmBoundaryPreview from '@/vue/business/components/FarmBoundaryPreview';
import FarmPlotBoundaryChecks from '@/vue/business/components/FarmPlotBoundaryChecks';
import { previewFarmCertificate } from '@/api/farms';
import useFarmStore from '@/vue/farmStore';
import { useNavigate, useParams } from '@/vue/router';
import { useQuery } from '@/vue/query';
import { ArrowDownOutlined, ArrowUpOutlined, EditOutlined, LineChartOutlined } from '@ant-design/icons-vue';
import { Alert, Button, Empty, Skeleton, Space, Table, Tag, Typography, message } from '@/vue/ui';
import type { ColumnsType } from '@/vue/ui';
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
import { getFarm, getFarmSummary, listFarmCerts } from '@/api/farms';
import { listPlots } from '@/api/plots';
import { listHarvests } from '@/api/harvests';
import { listInputUsages } from '@/api/inputs';
import type { Plot } from '@/types';
import { CROP_EMOJI_MAP, PLOT_STATUS_META } from '@/types';

const FARM_TYPE_FALLBACK_MAP: Record<number, string> = {
  1: '种植类',
  2: '养殖类',
  3: '综合种养',
};

function parseRemarkField(remark: string | undefined, key: string): string | undefined {
  if (!remark) return undefined;
  const match = remark.match(new RegExp(`${key}[:：]\\s*([^；;]+)`));
  const value = match?.[1]?.trim();
  return value ? value : undefined;
}

function calcTrend(current: number, previous: number): number | undefined {
  if (!previous) return undefined;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

const FarmDetail = defineComponent({
  name: 'FarmDetail',
  props: {},
  setup() {
    const _params = useParams<{ farmId: string }>();
    const navigate = useNavigate();
    const setCurrentFarm = useFarmStore(state => state.setCurrentFarm);
    const activeTab = shallowRef<string>('overview');

    watch(() => _params.farmId, () => {
      activeTab.value = 'overview';
    });

    const farmQuery = useQuery(() => ({
      queryKey: ['farm-detail', _params.farmId],
      enabled: Boolean(_params.farmId),
      queryFn: () => getFarm(_params.farmId as string),
    }));

    const summaryQuery = useQuery(() => ({
      queryKey: ['farm-summary', _params.farmId],
      enabled: Boolean(_params.farmId),
      queryFn: () => getFarmSummary(_params.farmId as string),
      retry: false,
    }));

    const plotsQuery = useQuery(() => ({
      queryKey: ['farm-plots', _params.farmId],
      enabled: Boolean(_params.farmId),
      queryFn: () => listPlots({ pageNum: 1, pageSize: 200 }),
    }));

    const certQuery = useQuery(() => ({
      queryKey: ['farm-certs', _params.farmId],
      enabled: Boolean(_params.farmId),
      queryFn: () => listFarmCerts(_params.farmId as string, { pageNum: 1, pageSize: 50 }),
      retry: false,
    }));

    const harvestQuery = useQuery(() => ({
      queryKey: ['farm-harvests', _params.farmId],
      enabled: Boolean(_params.farmId),
      queryFn: () => listHarvests({ pageNum: 1, pageSize: 200 }),
      retry: false,
    }));

    const usageQuery = useQuery(() => ({
      queryKey: ['farm-input-usages', _params.farmId],
      enabled: Boolean(_params.farmId),
      queryFn: () => listInputUsages({ pageNum: 1, pageSize: 200 }),
      retry: false,
    }));

    const farmPlots = computed<Plot[]>(() =>
      (plotsQuery.data?.list ?? []).filter(plot => String(plot.farmId) === String(_params.farmId)),
    );

    const harvestStats = computed(() => {
      if (harvestQuery.isError || !harvestQuery.data) {
        return { current: null, previous: null, trend: undefined };
      }
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const batches = (harvestQuery.data.list ?? []).filter(
        batch =>
          String(batch.farmId) === String(_params.farmId) ||
          farmPlots.value.some(plot => String(plot.plotId) === String(batch.plotId)),
      );
      const sumOf = (month: string): number =>
        batches
          .filter(batch => (batch.harvestDate ?? '').startsWith(month))
          .reduce((total, batch) => total + (Number(batch.quantity) || 0), 0);
      const current = Number((sumOf(thisMonth) / 1000).toFixed(2));
      const previous = Number((sumOf(lastMonth) / 1000).toFixed(2));
      return { current, previous, trend: calcTrend(current, previous) };
    });

    const usageCount = computed<number | null>(() => {
      if (usageQuery.isError || !usageQuery.data) return null;
      const plotIds = new Set(farmPlots.value.map(plot => String(plot.plotId)));
      return (usageQuery.data.list ?? []).filter(usage => usage.plotId && plotIds.has(String(usage.plotId))).length;
    });

    const summary = computed(() => {
      const raw = summaryQuery.data as unknown as Record<string, unknown> | undefined;
      const available = !summaryQuery.isError && Boolean(raw);
      const pick = (key: string): number | null => {
        if (!available) return null;
        const parsed = Number(raw?.[key]);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const plotAreaTotal = pick('plotAreaTotal');
      const declaredArea = pick('areaTotal');
      const areaTotal =
        declaredArea !== null && declaredArea > 0
          ? declaredArea
          : farmQuery.data?.areaTotal !== undefined && Number(farmQuery.data.areaTotal) > 0
            ? Number(farmQuery.data.areaTotal)
            : null;
      const usageRate =
        plotAreaTotal !== null && areaTotal !== null && areaTotal > 0
          ? Math.round((plotAreaTotal / areaTotal) * 100)
          : null;
      return { plotCount: pick('plotCount'), plotAreaTotal, areaTotal, usageRate };
    });

    const openEdit = (): void => {
      if (!farmQuery.data) return;
      navigate(`/production/farms/create?farmId=${_params.farmId}`);
    };

    const syncCurrentFarmAndGo = (path: string): void => {
      if (farmQuery.data && _params.farmId) {
        setCurrentFarm.value({
          farmId: String(_params.farmId),
          farmCode: farmQuery.data.farmCode ?? '',
          farmName: farmQuery.data.farmName,
        });
      }
      navigate(path);
    };

    const renderTrend = (trend: number | undefined): VNodeChild => {
      if (trend === undefined) {
        return <Typography.Text type="secondary">环比 —</Typography.Text>;
      }
      const up = trend >= 0;
      return (
        <Typography.Text style={{ color: up ? '#2d8f4e' : '#ff4d4f' }}>
          {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(trend)}%
        </Typography.Text>
      );
    };

    const plotColumns = computed<ColumnsType<Plot>>(() => [
      {
        title: '地块名称',
        dataIndex: 'plotName',
        render: (name: string, row: Plot) => (
          <Space size={6}>
            <span>{CROP_EMOJI_MAP[row.cropVariety ?? ''] ?? '🌱'}</span>
            <Typography.Link onClick={() => navigate(`/production/plots/${row.plotId}`)}>
              {name}
            </Typography.Link>
          </Space>
        ),
      },
      {
        title: '地块编号',
        dataIndex: 'plotCode',
        width: 140,
        render: (val: string) => <span class="detail-info-mono">{val || '—'}</span>,
      },
      {
        title: '当前作物',
        dataIndex: 'cropVariety',
        width: 140,
        render: (val: string) => val || '未种植',
      },
      {
        title: '面积（亩）',
        dataIndex: 'area',
        width: 110,
        align: 'right',
        render: (val: number) => <span class="detail-info-mono">{Number(val || 0).toLocaleString('zh-CN')}</span>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (val: number) => {
          const meta = PLOT_STATUS_META[val] ?? { label: '未知', color: 'default' };
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 80,
        align: 'right',
        render: (_: unknown, row: Plot) => (
          <Typography.Link onClick={() => navigate(`/production/plots/${row.plotId}`)}>详情</Typography.Link>
        ),
      },
    ]);

    return () => {
      if (!_params.farmId) {
        return (
          <ProductionDetailLayout
            title="农场详情"
            hasAside={false}
            onBack={() => navigate('/production/farms')}
          >
            <DetailSection>
              <Alert type="warning" showIcon message="缺少农场 ID，请返回列表重新进入" />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (farmQuery.isLoading) {
        return (
          <ProductionDetailLayout
            title="农场详情"
            hasAside={false}
            onBack={() => navigate('/production/farms')}
          >
            <DetailSection>
              <Skeleton active paragraph={{ rows: 10 }} />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (farmQuery.isError || !farmQuery.data) {
        return (
          <ProductionDetailLayout
            title="农场详情"
            hasAside={false}
            onBack={() => navigate('/production/farms')}
          >
            <DetailSection>
              <Empty
                description={
                  <Space direction="vertical">
                    <Typography.Text type="danger">农场数据加载失败，请稍后重试</Typography.Text>
                    <Space>
                      <Button onClick={() => void farmQuery.refetch()}>重新加载</Button>
                      <Button type="primary" onClick={() => navigate('/production/farms')}>
                        返回农场管理
                      </Button>
                    </Space>
                  </Space>
                }
              />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      const farm = farmQuery.data;
      const typeLabel = parseRemarkField(farm.remark, '产业类型') ?? FARM_TYPE_FALLBACK_MAP[farm.farmType] ?? '未分类';
      const altitude = parseRemarkField(farm.remark, '海拔') ?? '暂未录入';
      const certs = certQuery.data?.list ?? [];
      const plotTotal = summary.value.plotCount === null ? farmPlots.value.length : summary.value.plotCount;
      const regionText = `${farm.province ?? ''}${farm.city ?? ''}${farm.district ?? ''}`;
      const addressText = farm.address
        ? farm.province && farm.address.startsWith(farm.province)
          ? farm.address
          : `${regionText}${farm.address}`
        : regionText || '—';

      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '农场详情' },
        { key: 'plots', label: '地块明细', count: plotTotal },
        { key: 'boundary', label: '边界与检查' },
        { key: 'rectification', label: '监管整改' },
      ];

      const progressSteps: DetailTimelineStep[] = [
        {
          key: 'created',
          title: '农场建档',
          time: farm.createdAt || '已登记',
          state: 'done',
        },
        {
          key: 'boundary',
          title: '边界矢量绘制',
          description: farm.boundary ? '已完成农场范围坐标登记' : '待维护边界范围',
          state: farm.boundary ? 'done' : 'current',
        },
        {
          key: 'plots',
          title: '地块与种养建档',
          description: plotTotal > 0 ? `已建档 ${plotTotal} 个地块` : '尚未新增地块',
          state: plotTotal > 0 ? 'done' : farm.boundary ? 'current' : 'pending',
        },
        {
          key: 'certs',
          title: '资质证照核验',
          description: certs.length > 0 ? `已登记 ${certs.length} 项资质证书` : '暂无资质记录',
          state: certs.length > 0 ? 'done' : 'pending',
        },
        {
          key: 'status',
          title: farm.status === 1 ? '正常运营中' : '农场已停用',
          description: farm.status === 1 ? '当前状态' : '可编辑恢复启用',
          state: farm.status === 1 ? 'current' : 'error',
        },
      ];

      const relatedDocs: DetailRelatedDocItem[] = [
        {
          key: 'plots',
          label: '农场地块',
          text: plotTotal > 0 ? `${plotTotal} 个地块` : undefined,
          emptyText: '暂无地块',
          mono: false,
          onClick: () => navigate(`/production/plots?farmId=${_params.farmId}`),
        },
        {
          key: 'plan',
          label: '农事计划',
          text: '新建 / 查看计划',
          mono: false,
          onClick: () => syncCurrentFarmAndGo(`/production/plans?create=1&farmId=${encodeURIComponent(_params.farmId ?? '')}`),
        },
        {
          key: 'tasks',
          label: '农事任务',
          text: '前往任务列表',
          mono: false,
          onClick: () => syncCurrentFarmAndGo('/production/tasks'),
        },
        {
          key: 'monitor',
          label: '生产监控',
          text: '查看实时监控',
          mono: false,
          onClick: () => syncCurrentFarmAndGo(`/production/monitor?farmId=${encodeURIComponent(_params.farmId ?? '')}`),
        },
        {
          key: 'inputs',
          label: '投入品台账',
          text: usageCount.value !== null ? `${usageCount.value} 笔使用记录` : '前往台账',
          mono: false,
          onClick: () => syncCurrentFarmAndGo('/production/inputs'),
        },
        {
          key: 'trace',
          label: '溯源管理',
          text: '查看溯源码',
          mono: false,
          onClick: () => syncCurrentFarmAndGo('/production/trace'),
        },
      ];

      const previewPlots = farmPlots.value.slice(0, 5);
      const totalPlotArea = farmPlots.value.reduce((acc, item) => acc + (Number(item.area) || 0), 0);

      return (
        <ProductionDetailLayout
          class="production-detail-compact"
          code={farm.farmCode || undefined}
          title={farm.farmName}
          status={farm.status === 1 ? { label: '运营中', tone: 'green' } : { label: '已停用', tone: 'gray' }}
          meta={[
            { label: '产业类型', value: typeLabel },
            { label: '负责人', value: farm.managerName || '—' },
            { label: '创建时间', value: farm.createdAt || '—' },
          ]}
          tabs={tabs}
          activeTab={activeTab.value}
          backLabel="返回农场管理"
          onBack={() => navigate('/production/farms')}
          onTabChange={key => {
            activeTab.value = key;
          }}
          actions={
            <>
              <Button icon={<LineChartOutlined />} onClick={() => navigate('/production/analytics')}>
                数据分析
              </Button>
              <Button type="primary" icon={<EditOutlined />} onClick={openEdit}>
                编辑农场
              </Button>
            </>
          }
          aside={
            <>
              <DetailSection title="建档与运营进度">
                <DetailTimeline items={progressSteps} />
              </DetailSection>
              <DetailSection title="关联业务">
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
                    { key: 'code', label: '农场编号', value: farm.farmCode || '—', mono: true },
                    { key: 'type', label: '产业类型', value: typeLabel },
                    { key: 'area', label: '总面积', value: `${Number(farm.areaTotal || 0).toLocaleString('zh-CN')} 亩`, mono: true },
                    { key: 'altitude', label: '海拔高度', value: altitude },
                    {
                      key: 'coordinates',
                      label: '中心经纬度',
                      value: farm.longitude != null && farm.latitude != null ? `${farm.longitude}, ${farm.latitude}` : '未登记',
                      mono: true,
                    },
                    { key: 'createdAt', label: '创建时间', value: farm.createdAt || '—', mono: true },
                    { key: 'address', label: '农场地址', fullWidth: true, value: addressText },
                  ]}
                />
              </DetailSection>

              <DetailSection title="负责与资质信息">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    { key: 'manager', label: '负责人', value: farm.managerName || '—' },
                    { key: 'phone', label: '联系电话', value: farm.managerPhone || '—', mono: true },
                    {
                      key: 'certs',
                      label: '资质证书',
                      fullWidth: true,
                      value:
                        certs.length === 0 ? (
                          <Space size={8}>
                            <Typography.Text type="secondary">暂无资质记录</Typography.Text>
                            <Button type="link" size="small" onClick={openEdit}>
                              维护证书
                            </Button>
                          </Space>
                        ) : (
                          <Space size={8} wrap>
                            {certs.map(cert => (
                              <Tag key={cert.certId ?? cert.certName} color="green">
                                {cert.certName}
                                {cert.expireDate ? `（${cert.expireDate} 到期）` : ''}
                                {cert.attachUrl && (
                                  <Button
                                    type="link"
                                    size="small"
                                    onClick={() =>
                                      void previewFarmCertificate(cert.attachUrl!).catch(error => message.error(error.message))
                                    }
                                  >
                                    预览
                                  </Button>
                                )}
                              </Tag>
                            ))}
                            <Button type="link" size="small" onClick={openEdit}>
                              管理证书
                            </Button>
                          </Space>
                        ),
                    },
                  ]}
                />
              </DetailSection>

              <DetailSection title="经营指标">
                <DetailMetricGrid
                  items={[
                    {
                      key: 'plantedArea',
                      title: '在田面积',
                      value: summary.value.plotAreaTotal,
                      suffix: '亩',
                      missingTip: '后端 /farms/{farmId}/summary 未提供在田面积，显示为「—」',
                      extra: (
                        <Typography.Text type="secondary">
                          利用率 {summary.value.usageRate === null ? '—' : `${summary.value.usageRate}%`}
                        </Typography.Text>
                      ),
                    },
                    {
                      key: 'harvest',
                      title: '本月产量',
                      value: harvestStats.value.current,
                      precision: 2,
                      suffix: '吨',
                      missingTip: '采收批次接口未返回数据，显示为「—」',
                      extra: (
                        <Space size={6}>
                          {renderTrend(harvestStats.value.trend)}
                          <Typography.Text type="secondary">较上月</Typography.Text>
                        </Space>
                      ),
                    },
                    {
                      key: 'usage',
                      title: '本月投入',
                      value: usageCount.value,
                      suffix: '笔',
                      missingTip: '投入品使用记录接口未返回数据，显示为「—」',
                      extra: <Typography.Text type="secondary">投入品使用记录</Typography.Text>,
                    },
                    {
                      key: 'revenue',
                      title: '预计收入',
                      value: null,
                      missingTip: '收入测算依赖交易模块成交价，接入后自动填充',
                      extra: <Typography.Text type="secondary">待交易数据接入</Typography.Text>,
                    },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="地块明细"
                flush={previewPlots.length > 0}
                extra={
                  <Space size={12}>
                    {farmPlots.value.length > 5 && (
                      <Typography.Link onClick={() => { activeTab.value = 'plots'; }}>
                        查看全部 {farmPlots.value.length} 项
                      </Typography.Link>
                    )}
                    <Typography.Link onClick={() => navigate(`/production/plots?farmId=${_params.farmId}`)}>
                      前往地块管理
                    </Typography.Link>
                  </Space>
                }
                footer={
                  farmPlots.value.length > 0 ? (
                    <Space size={16}>
                      <Typography.Text type="secondary">共 {farmPlots.value.length} 个地块</Typography.Text>
                      <Typography.Text strong class="detail-info-mono">
                        地块合计面积 {totalPlotArea.toLocaleString('zh-CN')} 亩
                      </Typography.Text>
                    </Space>
                  ) : undefined
                }
              >
                {farmPlots.value.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <Space direction="vertical">
                        <Typography.Text type="secondary">该农场暂无地块</Typography.Text>
                        <Button type="primary" onClick={() => navigate(`/production/plots/create?farmId=${_params.farmId}`)}>
                          新增地块
                        </Button>
                      </Space>
                    }
                  />
                ) : (
                  <Table
                    rowKey="plotId"
                    size="small"
                    columns={plotColumns.value}
                    dataSource={previewPlots}
                    pagination={false}
                    scroll={{ x: 640 }}
                  />
                )}
              </DetailSection>
            </>
          )}

          {activeTab.value === 'plots' && (
            <DetailSection
              title={`地块明细（${farmPlots.value.length}）`}
              flush={farmPlots.value.length > 0}
              extra={
                <Space size={8}>
                  <Button size="small" onClick={() => navigate(`/production/plots?farmId=${_params.farmId}`)}>
                    在列表页查看
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => navigate(`/production/plots/create?farmId=${_params.farmId}`)}
                  >
                    新增地块
                  </Button>
                </Space>
              }
              footer={
                farmPlots.value.length > 0 ? (
                  <Typography.Text strong class="detail-info-mono">
                    地块合计面积 {totalPlotArea.toLocaleString('zh-CN')} 亩
                  </Typography.Text>
                ) : undefined
              }
            >
              {farmPlots.value.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该农场暂无地块" />
              ) : (
                <Table
                  rowKey="plotId"
                  size="small"
                  columns={plotColumns.value}
                  dataSource={farmPlots.value}
                  pagination={farmPlots.value.length > 10 ? { pageSize: 10, size: 'small' } : false}
                  scroll={{ x: 640 }}
                />
              )}
            </DetailSection>
          )}

          {activeTab.value === 'boundary' && (
            <>
              <DetailSection
                title="农场边界"
                extra={
                  <Button type="link" size="small" onClick={openEdit}>
                    维护边界
                  </Button>
                }
              >
                <FarmBoundaryPreview boundary={farm.boundary} name={farm.farmName} />
              </DetailSection>
              <DetailSection title="地块范围检查">
                <FarmPlotBoundaryChecks farmId={_params.farmId} boundary={farm.boundary} />
              </DetailSection>
            </>
          )}

          {activeTab.value === 'rectification' && (
            <DetailSection title="监管检查与整改">
              <FarmRectificationPanel farmId={_params.farmId} user />
            </DetailSection>
          )}
        </ProductionDetailLayout>
      );
    };
  },
});

export default FarmDetail;
