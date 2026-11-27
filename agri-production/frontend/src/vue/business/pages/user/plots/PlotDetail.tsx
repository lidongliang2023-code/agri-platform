import { defineComponent, shallowRef, computed, watch } from 'vue';
import '@/components/ProductionDetailCompact.css';
import BusinessRecordList from '@/vue/business/components/BusinessRecordList';
import Card from '@/vue/business/components/SectionCard';
import { useNavigate, useParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import ReactECharts from '@/vue/VueECharts';
import { DeleteOutlined, EditOutlined, ExperimentOutlined, PlusOutlined, QrcodeOutlined } from '@ant-design/icons-vue';
import { Alert, Button, Col, DatePicker, Divider, Empty, Form, Input, InputNumber, Modal, Popconfirm, Radio, Row, Select, Skeleton, Space, Tabs, Tag, Typography, message } from '@/vue/ui';
import type { ColumnsType } from '@/vue/ui';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  DetailInfoGrid,
  DetailRelatedDocs,
  DetailSection,
  DetailTimeline,
  ProductionDetailLayout,
  type DetailRelatedDocItem,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@/vue/business/components/index';
import { createPlotCrop, deletePlotCrop, getLatestSoil, getPlot, listPlotCrops, updatePlotCrop, type PlotCropPayload } from '@/api/plots';
import { getFarm } from '@/api/farms';
import { listCropOptions } from '@/api/crops';
import { listHarvests } from '@/api/harvests';
import { getEnvironmentHistory, listEnvironmentData, listGrowthRecordsByPlot } from '@/api/growth';
import { listTasks } from '@/api/tasks';
import { listInputUsages } from '@/api/inputs';
import type { GrowthRecord, HarvestBatch, InputUsageRecord, PlotCrop, Task } from '@/types';
import { TiandituMap, parseBoundaryVertices, polygonCentroid, type TiandituMapPoint } from '@/vue/business/shared';
import { BATCH_STATUS_META, GRADE_LABEL_MAP, PLOT_STATUS_META } from '@/types';

const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待执行', color: 'blue' },
  assigned: { label: '待执行', color: 'blue' },
  doing: { label: '执行中', color: 'orange' },
  executing: { label: '执行中', color: 'orange' },
  done: { label: '已完成', color: 'green' },
  accepted: { label: '已完成', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
};

const GROWTH_LEVEL_SCORE_MAP: Record<number, number> = { 1: 45, 2: 65, 3: 80, 4: 92 };
const GROWTH_LEVEL_LABEL: Record<number, string> = { 1: '弱', 2: '偏弱', 3: '正常', 4: '旺盛' };
const GROWTH_LEVEL_COLOR: Record<number, string> = { 1: 'red', 2: 'orange', 3: 'green', 4: 'lime' };

const PLANTING_STANDARD_OPTIONS: Array<{
  value: 'ORGANIC' | 'GREEN' | 'NORMAL';
  label: string;
  icon: string;
  color: string;
}> = [
  { value: 'ORGANIC', label: '有机', icon: '🌿', color: 'green' },
  { value: 'GREEN', label: '绿色', icon: '🍃', color: 'cyan' },
  { value: 'NORMAL', label: '普通', icon: '🌱', color: 'default' },
];

function plantingStandardMeta(value?: string) {
  return PLANTING_STANDARD_OPTIONS.find(option => option.value === value) ?? { label: '未设置', icon: '🌱', color: 'default' };
}

const PLANTING_METHOD_LABEL: Record<string, string> = { TRANSPLANT: '移栽', DIRECT: '直播' };
const OPERATION_METHOD_LABEL: Record<string, string> = { MANUAL: '人工', MECHANICAL: '机械' };

interface CropFormValues {
  cropId: string;
  cropVariety?: string;
  plantingStandard: 'ORGANIC' | 'GREEN' | 'NORMAL';
  plantingMethod: 'TRANSPLANT' | 'DIRECT';
  operationMethod: 'MANUAL' | 'MECHANICAL';
  transplantDate: Dayjs;
  expectedHarvestDate?: Dayjs;
  expectedYieldPerMu?: number;
  plantCount?: number;
  plantSpacing?: number;
}

function scoreLevelText(score: number): string {
  if (score >= 90) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '一般';
  return '偏弱';
}

interface EnvMetric {
  key: string;
  label: string;
  value: string;
  unit: string;
  warning?: boolean;
}

function buildGaugeOption(score: number): Record<string, unknown> {
  return {
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 100,
        radius: '92%',
        startAngle: 210,
        endAngle: -30,
        progress: { show: true, width: 12, itemStyle: { color: '#2d8f4e' } },
        axisLine: { lineStyle: { width: 12, color: [[1, '#f0f0f0']] } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { width: 1, color: '#d9d9d9' } },
        axisLabel: { distance: -18, color: '#8c8c8c', fontSize: 12 },
        pointer: { width: 4, itemStyle: { color: '#2d8f4e' } },
        detail: { valueAnimation: true, offsetCenter: [0, '40%'], fontSize: 22, color: '#262626', formatter: '{value} 分' },
        title: { offsetCenter: [0, '72%'], fontSize: 12, color: '#8c8c8c' },
        data: [{ value: score, name: scoreLevelText(score) }],
      },
    ],
  };
}

function buildEnvTrendOption(dates: string[], temperatures: (number | null)[]): Record<string, unknown> {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['空气温度'], bottom: 0 },
    grid: { left: 48, right: 24, top: 24, bottom: 48 },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: [{ type: 'value', name: '℃', min: 'dataMin', max: 'dataMax' }],
    series: [
      {
        name: '空气温度',
        type: 'line',
        smooth: true,
        data: temperatures,
        connectNulls: false,
        itemStyle: { color: '#2d8f4e' },
        areaStyle: { color: 'rgba(45,143,78,0.12)' },
      },
    ],
  };
}

const PlotDetail = defineComponent({
  name: 'PlotDetail',
  props: {},
  setup() {
    const _params = useParams<{ plotId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const activeTab = shallowRef<string>('overview');
    const cropModalOpen = shallowRef(false);
    const cropWriteLock = shallowRef(false);
    const editingCrop = shallowRef<PlotCrop | null>(null);
    const [cropForm] = Form.useForm<CropFormValues>();

    watch(() => _params.plotId, () => {
      activeTab.value = 'overview';
    });

    const plotQuery = useQuery(() => ({
      queryKey: ['plot-detail', _params.plotId],
      enabled: Boolean(_params.plotId),
      queryFn: () => getPlot(_params.plotId as string),
    }));
    const plot = computed(() => plotQuery.data);

    const farmQuery = useQuery(() => ({
      queryKey: ['plot-farm', plot.value?.farmId],
      enabled: Boolean(plot.value?.farmId),
      queryFn: () => getFarm(plot.value?.farmId as string),
      retry: false,
    }));

    const growthQuery = useQuery(() => ({
      queryKey: ['plot-growth-latest', _params.plotId],
      enabled: Boolean(_params.plotId),
      queryFn: () => listGrowthRecordsByPlot(_params.plotId as string),
      retry: false,
    }));

    const envQuery = useQuery(() => ({
      queryKey: ['plot-env-latest', _params.plotId],
      enabled: Boolean(_params.plotId),
      queryFn: () =>
        listEnvironmentData({
          plotId: _params.plotId,
          startDate: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
          endDate: dayjs().format('YYYY-MM-DD'),
          pageNum: 1,
          pageSize: 20,
        }),
      retry: false,
    }));

    const soilQuery = useQuery(() => ({
      queryKey: ['plot-soil-latest', _params.plotId],
      enabled: Boolean(_params.plotId),
      queryFn: () => getLatestSoil(_params.plotId as string),
      retry: false,
    }));

    const taskQuery = useQuery(() => ({
      queryKey: ['plot-tasks', _params.plotId],
      enabled: Boolean(_params.plotId),
      queryFn: () => listTasks({ plotId: _params.plotId, pageNum: 1, pageSize: 100 }),
      retry: false,
    }));

    const harvestQuery = useQuery(() => ({
      queryKey: ['plot-harvests', _params.plotId],
      enabled: Boolean(_params.plotId),
      queryFn: () => listHarvests({ plotId: _params.plotId, pageNum: 1, pageSize: 100 }),
      retry: false,
    }));

    const cropOptionsQuery = useQuery(() => ({
      queryKey: ['crop-options'],
      queryFn: () => listCropOptions(),
      staleTime: 60_000,
    }));

    const plotCropsQuery = useQuery(() => ({
      queryKey: ['plot-crops', _params.plotId],
      enabled: Boolean(_params.plotId),
      queryFn: () => listPlotCrops(_params.plotId as string),
      retry: false,
    }));
    const plotCrops = computed(() => plotCropsQuery.data ?? []);

    const usageQuery = useQuery(() => ({
      queryKey: ['plot-input-usages', _params.plotId],
      enabled: Boolean(_params.plotId),
      queryFn: () => listInputUsages({ plotId: _params.plotId, pageNum: 1, pageSize: 200 }),
      retry: false,
    }));

    const startDate = computed(() => dayjs().subtract(6, 'day').format('YYYY-MM-DD'));
    const endDate = computed(() => dayjs().format('YYYY-MM-DD'));
    const trendQuery = useQuery(() => ({
      queryKey: ['plot-env-history', _params.plotId, startDate.value, endDate.value],
      enabled: Boolean(_params.plotId),
      queryFn: () =>
        getEnvironmentHistory(_params.plotId as string, {
          metrics: 'air_temperature',
          startDate: startDate.value,
          endDate: endDate.value,
        }),
      retry: false,
    }));

    const latestEnv = computed(() => {
      const list = envQuery.data?.list ?? [];
      if (list.length === 0) return undefined;
      return [...list].sort((a, b) => (a.collectedAt ?? '').localeCompare(b.collectedAt ?? ''))[list.length - 1];
    });

    const latestGrowth = computed(() => {
      const list = growthQuery.data ?? [];
      if (list.length === 0) return undefined;
      return [...list].sort((a, b) => (a.recordDate ?? '').localeCompare(b.recordDate ?? ''))[list.length - 1];
    });

    const plotMapPoint = computed<TiandituMapPoint | null>(() => {
      if (!plot.value) return null;
      const rawBoundary = plot.value.boundary ?? plot.value.geoBoundary;
      const vertices = parseBoundaryVertices(rawBoundary);
      const hasCenter =
        plot.value.centerLongitude !== undefined &&
        plot.value.centerLongitude !== null &&
        plot.value.centerLatitude !== undefined &&
        plot.value.centerLatitude !== null;
      const center = hasCenter
        ? { longitude: Number(plot.value.centerLongitude), latitude: Number(plot.value.centerLatitude) }
        : vertices.length >= 3
          ? polygonCentroid(vertices)
          : null;
      if (!center) return null;
      return {
        id: plot.value.plotId,
        longitude: center.longitude,
        latitude: center.latitude,
        title: plot.value.plotName,
        meta: `${Number(plot.value.area || 0).toLocaleString('zh-CN')}亩`,
        boundary: rawBoundary ?? null,
      };
    });

    const hasBoundary = computed(() => parseBoundaryVertices(plot.value?.boundary ?? plot.value?.geoBoundary).length >= 3);

    const vigorScore = computed<number | null>(() => {
      if (latestGrowth.value?.growthLevel) {
        return GROWTH_LEVEL_SCORE_MAP[latestGrowth.value.growthLevel] ?? null;
      }
      return null;
    });

    const hasGrowthData = computed(() => Boolean(latestGrowth.value));

    const envMetrics = computed<EnvMetric[]>(() => {
      const env = latestEnv.value;
      return [
        { key: 'airTemp', label: '空气温度', value: env?.airTemperature?.toFixed(1) ?? '—', unit: '°C' },
        { key: 'airHumidity', label: '空气湿度', value: env?.airHumidity?.toFixed(0) ?? '—', unit: '%', warning: (env?.airHumidity ?? 0) > 85 },
        { key: 'soilTemp', label: '土壤温度', value: env?.soilTemperature?.toFixed(1) ?? '—', unit: '°C' },
        { key: 'ph', label: '土壤 pH', value: soilQuery.data?.ph !== undefined ? String(soilQuery.data.ph) : '—', unit: '' },
        { key: 'soilMoisture', label: '土壤水分', value: env?.soilMoisture?.toFixed(0) ?? '—', unit: '%', warning: (env?.soilMoisture ?? 100) < 30 },
        { key: 'illuminance', label: '光照强度', value: env?.illuminance?.toFixed(0) ?? '—', unit: 'lux' },
        { key: 'windSpeed', label: '风速', value: '—', unit: 'm/s' },
        { key: 'rainfall', label: '降雨量', value: env?.rainfall?.toFixed(0) ?? '—', unit: 'mm' },
        { key: 'co2', label: 'CO₂ 浓度', value: env?.co2?.toFixed(0) ?? '—', unit: 'ppm' },
      ];
    });

    const trendData = computed(() => {
      const vo = trendQuery.data;
      return {
        dates: vo?.dates ?? [],
        temperatures: vo?.temperatures?.map(value => (value === null ? null : Number(value))) ?? [],
      };
    });

    const cropOptions = computed(() => {
      const _editingCropAtStart = editingCrop.value;
      const options = (cropOptionsQuery.data ?? []).map(item => ({
        value: String(item.cropId),
        label: item.cropName,
      }));
      if (_editingCropAtStart?.cropId != null && !options.some(item => item.value === String(_editingCropAtStart.cropId))) {
        options.push({
          value: String(_editingCropAtStart.cropId),
          label: `${_editingCropAtStart.cropName}（历史引用）`,
        });
      }
      return options;
    });

    const selectedCropId = Form.useWatch('cropId', cropForm);
    const selectedCropName = computed(() => cropOptions.value.find(item => item.value === selectedCropId.value)?.label);

    const tasks = computed(() => taskQuery.data?.list ?? []);
    const harvests = computed(() => harvestQuery.data?.list ?? []);
    const usages = computed(() => usageQuery.data?.list ?? []);
    const growthRecords = computed(() =>
      [...(growthQuery.data ?? [])].sort((a, b) => (b.recordDate ?? '').localeCompare(a.recordDate ?? '')),
    );

    const openAddCropModal = (): void => {
      editingCrop.value = null;
      cropForm.resetFields();
      cropForm.setFieldsValue({
        plantingStandard: 'NORMAL',
        plantingMethod: 'TRANSPLANT',
        operationMethod: 'MANUAL',
      });
      cropModalOpen.value = true;
    };

    const openEditCropModal = (record: PlotCrop): void => {
      editingCrop.value = record;
      cropForm.resetFields();
      cropForm.setFieldsValue({
        cropId: record.cropId === undefined || record.cropId === null ? '' : String(record.cropId),
        cropVariety: record.cropVariety,
        plantingStandard: record.plantingStandard ?? 'NORMAL',
        plantingMethod: record.plantingMethod ?? 'TRANSPLANT',
        operationMethod: record.operationMethod ?? 'MANUAL',
        transplantDate: record.transplantDate ? dayjs(record.transplantDate) : undefined,
        expectedHarvestDate: record.expectedHarvestDate ? dayjs(record.expectedHarvestDate) : undefined,
        expectedYieldPerMu: record.expectedYieldPerMu,
        plantCount: record.plantCount,
        plantSpacing: record.plantSpacing,
      });
      cropModalOpen.value = true;
    };

    const refreshCropReferences = async (): Promise<void> => {
      await Promise.all(
        ['plot-crops', 'plot-detail', 'plots-all', 'plots', 'farm-detail', 'farm-plots', 'farm-summary'].map(key =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    };

    const saveCropMutation = useMutation(() => ({
      mutationFn: async (values: CropFormValues) => {
        if (!_params.plotId) throw new Error('地块信息尚未加载，请稍后重试');
        const payload: PlotCropPayload = {
          cropId: values.cropId,
          cropVariety: values.cropVariety?.trim() || undefined,
          plantingStandard: values.plantingStandard,
          plantingMethod: values.plantingMethod,
          operationMethod: values.operationMethod,
          transplantDate: values.transplantDate.format('YYYY-MM-DD'),
          expectedHarvestDate: values.expectedHarvestDate?.format('YYYY-MM-DD'),
          expectedYieldPerMu: values.expectedYieldPerMu,
          plantCount: values.plantCount,
          plantSpacing: values.plantSpacing,
        };
        return editingCrop.value
          ? updatePlotCrop(_params.plotId, editingCrop.value.cropRecordId, payload)
          : createPlotCrop(_params.plotId, payload);
      },
      onSuccess: async () => {
        message.success(editingCrop.value ? '种养品种已更新' : '种养品种已添加');
        cropModalOpen.value = false;
        editingCrop.value = null;
        await refreshCropReferences();
      },
      onSettled: () => {
        cropWriteLock.value = false;
      },
      onError: (error: Error) => message.error(error.message || '保存失败，请稍后重试'),
    }));

    const deleteCropMutation = useMutation(() => ({
      mutationFn: async (record: PlotCrop) => {
        if (cropWriteLock.value) throw new Error('正在保存，请稍后操作');
        cropWriteLock.value = true;
        try {
          await deletePlotCrop(_params.plotId as string, record.cropRecordId);
        } finally {
          cropWriteLock.value = false;
        }
      },
      onSuccess: async (_data, record) => {
        message.success(`已删除种养品种：${record.cropName}`);
        await refreshCropReferences();
      },
      onError: (error: Error) => message.error(error.message || '删除失败，请稍后重试'),
    }));

    const taskColumns = computed<ColumnsType<Task>>(() => [
      { title: '日期', dataIndex: 'planStartDate', width: 96, render: (value: string) => <span class="detail-info-mono">{value ? dayjs(value).format('MM-DD') : '—'}</span> },
      { title: '类型', dataIndex: 'taskType', width: 100, render: (value: string) => value || '—' },
      { title: '详情', dataIndex: 'description', ellipsis: true, render: (value: string, record) => value || record.taskName },
      { title: '执行人', dataIndex: 'assigneeName', width: 100, render: (value: string) => value || <Typography.Text type="secondary">未派发</Typography.Text> },
      {
        title: '状态',
        dataIndex: 'status',
        width: 96,
        render: (_, record) => {
          const meta = TASK_STATUS_META[record.status] ?? { label: record.status, color: 'default' };
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 72,
        render: (_, record) => <Typography.Link onClick={() => navigate(`/production/tasks/${record.taskId}`)}>查看</Typography.Link>,
      },
    ]);

    const harvestColumns = computed<ColumnsType<HarvestBatch>>(() => [
      { title: '采收日期', dataIndex: 'harvestDate', width: 110, render: (val: string) => <span class="detail-info-mono">{val || '—'}</span> },
      { title: '数量', key: 'quantity', width: 120, render: (_, record) => <span class="detail-info-mono">{`${Number(record.quantity || 0).toLocaleString('zh-CN')} ${record.unit ?? ''}`}</span> },
      { title: '质量等级', dataIndex: 'grade', width: 96, render: (value: string) => <Tag>{GRADE_LABEL_MAP[value] ?? value ?? '—'}</Tag> },
      {
        title: '状态',
        dataIndex: 'status',
        width: 96,
        render: (value: HarvestBatch['status']) => {
          const meta = BATCH_STATUS_META[value] ?? { label: value, color: 'default' };
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 72,
        render: (_, record) => <Typography.Link onClick={() => navigate(`/production/harvests/${record.batchId}`)}>查看</Typography.Link>,
      },
    ]);

    const usageColumns = computed<ColumnsType<InputUsageRecord>>(() => [
      { title: '使用日期', dataIndex: 'usedAt', width: 110, render: (value: string) => <span class="detail-info-mono">{value ? dayjs(value).format('YYYY-MM-DD') : '—'}</span> },
      { title: '投入品', dataIndex: 'inputName', ellipsis: true, render: (value: string) => value || '—' },
      { title: '用量', key: 'dosage', width: 120, render: (_, record) => <span class="detail-info-mono">{`${record.dosage ?? '—'} ${record.unit ?? ''}`}</span> },
      { title: '方式', dataIndex: 'method', width: 90, render: (value: string) => value || '—' },
      {
        title: '操作',
        key: 'action',
        width: 72,
        render: (_, record) =>
          record.inputId ? <Typography.Link onClick={() => navigate(`/production/inputs/${record.inputId}`)}>查看</Typography.Link> : '—',
      },
    ]);

    const growthColumns = computed<ColumnsType<GrowthRecord>>(() => [
      { title: '记录日期', dataIndex: 'recordDate', width: 110, render: (val: string) => <span class="detail-info-mono">{val || '—'}</span> },
      { title: '生育期', dataIndex: 'growthStage', width: 110 },
      { title: '株高(cm)', dataIndex: 'plantHeight', width: 100, render: (value: number | undefined) => <span class="detail-info-mono">{value ?? '—'}</span> },
      { title: '叶面积指数', dataIndex: 'leafAreaIndex', width: 110, render: (value: number | undefined) => <span class="detail-info-mono">{value ?? '—'}</span> },
      {
        title: '长势',
        dataIndex: 'growthLevel',
        width: 90,
        render: (value: number) => <Tag color={GROWTH_LEVEL_COLOR[value] ?? 'default'}>{GROWTH_LEVEL_LABEL[value] ?? value}</Tag>,
      },
      { title: '记录人', dataIndex: 'recorderName', width: 100, render: (value: string) => value || '—' },
      {
        title: '操作',
        key: 'action',
        width: 72,
        render: () => <Typography.Link onClick={() => navigate(`/production/growth/records?plotId=${_params.plotId}`)}>维护</Typography.Link>,
      },
    ]);

    return () => {
      const _plotAtStart = plot.value;
      if (plotQuery.isLoading) {
        return (
          <ProductionDetailLayout class="production-detail-compact" title="地块详情" hasAside={false} onBack={() => navigate('/production/plots')}>
            <DetailSection>
              <Skeleton active paragraph={{ rows: 10 }} />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }
      if (plotQuery.isError || !_plotAtStart) {
        return (
          <ProductionDetailLayout class="production-detail-compact" title="地块详情" hasAside={false} onBack={() => navigate('/production/plots')}>
            <DetailSection>
              <Empty
                description={
                  <Space direction="vertical">
                    <Typography.Text type="danger">地块数据加载失败，请稍后重试</Typography.Text>
                    <Space>
                      <Button onClick={() => void plotQuery.refetch()}>重新加载</Button>
                      <Button type="primary" onClick={() => navigate('/production/plots')}>返回地块列表</Button>
                    </Space>
                  </Space>
                }
              />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      const statusMeta = PLOT_STATUS_META[_plotAtStart.status] ?? { label: '未知', color: 'default' };
      const farmName = _plotAtStart.farmName ?? farmQuery.data?.farmName ?? '—';
      const totalRecords = tasks.value.length + harvests.value.length + usages.value.length + growthRecords.value.length;

      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '地块详情' },
        { key: 'crops', label: '种养品种', count: plotCrops.value.length },
        { key: 'monitor', label: '环境与遥感' },
        { key: 'records', label: '关联记录', count: totalRecords },
      ];

      const progressSteps: DetailTimelineStep[] = [
        {
          key: 'profile',
          title: '地块建档完成',
          description: `${Number(_plotAtStart.area || 0).toLocaleString('zh-CN')} 亩 · ${_plotAtStart.soilType || '土壤待补'}`,
          state: 'done',
        },
        {
          key: 'boundary',
          title: '边界坐标测绘',
          description: hasBoundary.value ? '已完成地块多边形边界绘制' : '尚未绘制边界，可在编辑页绘制',
          state: hasBoundary.value ? 'done' : 'current',
        },
        {
          key: 'crops',
          title: '种养品种登记',
          description: plotCrops.value.length > 0 ? `已登记 ${plotCrops.value.length} 个品种` : _plotAtStart.currentCrop || '待添加种养品种',
          state: plotCrops.value.length > 0 ? 'done' : 'current',
        },
        {
          key: 'monitor',
          title: '环境与长势监测',
          time: latestEnv.value?.collectedAt ?? latestGrowth.value?.recordDate,
          description: vigorScore.value !== null ? `最新长势 ${vigorScore.value} 分（${scoreLevelText(vigorScore.value)}）` : latestEnv.value ? '已接入实时环境数据' : '待绑定 IoT 设备或录入记录',
          state: vigorScore.value !== null || latestEnv.value ? 'done' : 'pending',
        },
      ];

      const relatedDocs: DetailRelatedDocItem[] = [
        {
          key: 'farm',
          label: '所属农场',
          text: farmName !== '—' ? farmName : undefined,
          emptyText: '未关联农场',
          mono: false,
          onClick: _plotAtStart.farmId ? () => navigate(`/production/farms/${_plotAtStart.farmId}`) : undefined,
        },
        {
          key: 'soil',
          label: '土壤检测档案',
          text: soilQuery.data?.ph !== undefined ? `最新 pH ${soilQuery.data.ph}` : '查看档案',
          mono: false,
          onClick: () => navigate(`/production/plots/${_params.plotId}/soil`),
        },
        {
          key: 'iot',
          label: '监测设备绑定',
          text: '管理绑定设备',
          mono: false,
          onClick: () => navigate(`/production/iot/bindings?plotId=${_params.plotId}`),
        },
        {
          key: 'env',
          label: '历史环境曲线',
          text: '查看环境监测',
          mono: false,
          onClick: () => navigate(`/production/growth/environment?plotId=${_params.plotId}`),
        },
        {
          key: 'trace',
          label: '单品溯源码',
          text: '前往溯源管理',
          mono: false,
          onClick: () => navigate('/production/trace'),
        },
      ];

      const cropCardsSection = (
        <DetailSection
          title={`种养品种（${plotCrops.value.length}）`}
          extra={
            <Typography.Link onClick={openAddCropModal}>
              <PlusOutlined /> 添加种养品种
            </Typography.Link>
          }
        >
          {plotCropsQuery.isError ? (
            <Alert type="error" showIcon message="种养品种加载失败" action={<Button onClick={() => void plotCropsQuery.refetch()}>重新加载</Button>} />
          ) : plotCropsQuery.isLoading ? (
            <Skeleton active />
          ) : plotCrops.value.length === 0 ? (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {(_plotAtStart.currentCrop || _plotAtStart.cropVariety) && (
                <Alert
                  type="info"
                  showIcon
                  message={`该地块此前登记的单一种养品种：${_plotAtStart.currentCrop ?? _plotAtStart.cropVariety}${_plotAtStart.cropVariety ? `（${_plotAtStart.cropVariety}）` : ''}`}
                  description="添加种养品种后，详情页按多品种台账展示与维护；地块原有的「当前作物」仍用于列表显示。"
                />
              )}
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未添加种养品种">
                <Button type="primary" icon={<PlusOutlined />} onClick={openAddCropModal}>
                  添加种养品种
                </Button>
              </Empty>
            </Space>
          ) : (
            <Row gutter={[12, 12]}>
              {plotCrops.value.map(record => {
                const standard = plantingStandardMeta(record.plantingStandard);
                return (
                  <Col key={record.cropRecordId} xs={24} xl={12}>
                    <Card
                      size="small"
                      style={{ height: '100%', borderColor: '#d4e8d9' }}
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong style={{ fontSize: 14 }}>
                            {standard.icon} {record.cropName}
                          </Typography.Text>
                          <Tag color={standard.color}>{standard.label}</Tag>
                        </Space>
                      }
                      extra={
                        <Space size={8}>
                          <Typography.Link onClick={() => openEditCropModal(record)}>
                            <EditOutlined /> 编辑
                          </Typography.Link>
                          <Popconfirm
                            title="删除该种养品种？"
                            description="删除后该品种明细不再展示，地块其他记录不受影响。"
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => deleteCropMutation.mutate(record)}
                          >
                            <Typography.Link type="danger">
                              <DeleteOutlined /> 删除
                            </Typography.Link>
                          </Popconfirm>
                        </Space>
                      }
                    >
                      <DetailInfoGrid
                        columns={2}
                        items={[
                          { key: 'variety', label: '品种', value: record.cropVariety || '—' },
                          { key: 'method', label: '种植方式', value: PLANTING_METHOD_LABEL[record.plantingMethod ?? ''] ?? '—' },
                          { key: 'operation', label: '作业方式', value: OPERATION_METHOD_LABEL[record.operationMethod ?? ''] ?? '—' },
                          { key: 'transplant', label: '移栽时间', value: record.transplantDate || '—', mono: true },
                          { key: 'harvest', label: '预计采收', value: record.expectedHarvestDate || '—', mono: true },
                          { key: 'yield', label: '预计亩产', value: record.expectedYieldPerMu != null ? `${record.expectedYieldPerMu} 公斤/亩` : '—', mono: true },
                          { key: 'count', label: '株数', value: record.plantCount != null ? `${record.plantCount} 株` : '—', mono: true },
                          { key: 'spacing', label: '株间距', value: record.plantSpacing != null ? `${record.plantSpacing} cm` : '—', mono: true },
                        ]}
                      />
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </DetailSection>
      );

      return (
        <ProductionDetailLayout
          class="production-detail-compact"
          code={_plotAtStart.plotCode || undefined}
          title={_plotAtStart.plotName}
          status={{ label: statusMeta.label, tone: statusMeta.color }}
          meta={[
            { label: '所属农场', value: farmName },
            { label: '面积', value: `${Number(_plotAtStart.area || 0).toLocaleString('zh-CN')} 亩` },
            { label: '当前作物', value: _plotAtStart.currentCrop || _plotAtStart.cropVariety || '未种植' },
          ]}
          tabs={tabs}
          activeTab={activeTab.value}
          backLabel="返回地块列表"
          onBack={() => navigate('/production/plots')}
          onTabChange={key => {
            activeTab.value = key;
          }}
          actions={
            /* 次要 → 主要 */
            <>
              <Button icon={<ExperimentOutlined />} onClick={() => navigate(`/production/plots/${_params.plotId}/soil`)}>
                土壤档案
              </Button>
              <Button icon={<QrcodeOutlined />} onClick={() => navigate('/production/trace')}>
                溯源码
              </Button>
              <Button icon={<EditOutlined />} onClick={() => navigate(`/production/plots/create?plotId=${_params.plotId}`)}>
                编辑地块
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddCropModal}>
                添加种养品种
              </Button>
            </>
          }
          aside={
            <>
              <DetailSection title="建档与监测进度">
                <DetailTimeline items={progressSteps} />
              </DetailSection>
              <DetailSection title="关联档案与入口">
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
                    { key: 'code', label: '地块编号', value: _plotAtStart.plotCode || '—', mono: true },
                    { key: 'area', label: '地块面积', value: `${Number(_plotAtStart.area || 0).toLocaleString('zh-CN')} 亩`, mono: true },
                    { key: 'farm', label: '所属农场', value: farmName },
                    { key: 'crop', label: '当前作物', value: _plotAtStart.currentCrop || _plotAtStart.cropVariety || '未种植' },
                    { key: 'irrigation', label: '灌溉方式', value: _plotAtStart.irrigationType || '—' },
                    { key: 'soil', label: '土壤类型', value: _plotAtStart.soilType || '—' },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="地块位置与边界"
                extra={<Tag color="green">天地图</Tag>}
              >
                {plotMapPoint.value ? (
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <TiandituMap points={[plotMapPoint.value]} height={320} zoom={15} showLegend={false} />
                    {!hasBoundary.value && (
                      <Typography.Text type="secondary">
                        该地块尚未绘制边界，可在编辑页用天地图绘制，保存后在此展示。
                      </Typography.Text>
                    )}
                  </Space>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该地块尚未维护中心点与边界">
                    <Button onClick={() => navigate(`/production/plots/create?plotId=${_params.plotId}`)}>去编辑</Button>
                  </Empty>
                )}
              </DetailSection>

              <DetailSection
                title="最近农事记录"
                flush={tasks.value.length > 0}
                extra={
                  <Space size={12}>
                    {totalRecords > 0 && (
                      <Typography.Link onClick={() => { activeTab.value = 'records'; }}>
                        查看全部 {totalRecords} 项关联记录
                      </Typography.Link>
                    )}
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => navigate(`/production/tasks/create?plotId=${_params.plotId}&farmId=${_plotAtStart.farmId}`)}
                    >
                      新增农事记录
                    </Button>
                  </Space>
                }
              >
                {tasks.value.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无农事记录" />
                ) : (
                  <BusinessRecordList
                    rowKey="taskId"
                    size="small"
                    dataSource={tasks.value.slice(0, 5)}
                    columns={taskColumns.value}
                    pagination={false}
                    scroll={{ x: 680 }}
                  />
                )}
              </DetailSection>
            </>
          )}

          {activeTab.value === 'crops' && cropCardsSection}

          {activeTab.value === 'monitor' && (
            <>
              <DetailSection
                title="实时环境数据"
                extra={
                  <Space size={12}>
                    <Typography.Link onClick={() => navigate(`/production/iot/bindings?plotId=${_params.plotId}`)}>绑定监测设备</Typography.Link>
                    <Typography.Link onClick={() => navigate(`/production/growth/environment?plotId=${_params.plotId}`)}>历史曲线</Typography.Link>
                  </Space>
                }
              >
                {!latestEnv.value && (
                  <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="暂无环境数据，请先为该地块绑定 IoT 设备或人工录入环境数据" />
                )}
                <Row gutter={[10, 10]}>
                  {envMetrics.value.map(metric => (
                    <Col key={metric.key} xs={12} sm={8} md={8}>
                      <Card size="small" style={{ textAlign: 'center' }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{metric.label}</Typography.Text>
                        <div>
                          <Typography.Text strong class="detail-info-mono" style={{ fontSize: 18, color: metric.warning ? '#ff4d4f' : undefined }}>
                            {metric.value}
                          </Typography.Text>
                          <Typography.Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
                            {metric.unit}
                          </Typography.Text>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
                <Divider orientation="left" plain>近 7 日空气温度趋势</Divider>
                {trendData.value.dates.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史环境曲线数据" />
                ) : (
                  <ReactECharts option={buildEnvTrendOption(trendData.value.dates, trendData.value.temperatures)} style={{ height: 240 }} notMerge />
                )}
              </DetailSection>

              <DetailSection
                title="AI 遥感与长势分析"
                extra={<Typography.Link onClick={() => navigate(`/production/growth?plotId=${_params.plotId}`)}>查看遥感详情</Typography.Link>}
              >
                {!hasGrowthData.value && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="遥感影像源未接入：NDVI、异常区域与影像更新时间均无真实数据"
                    description="后端暂无遥感/NDVI 数据源，相关指标显式标注为未接入。"
                  />
                )}
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={10}>
                    {vigorScore.value === null ? (
                      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafcfb', borderRadius: 8 }}>
                        <Typography.Text type="secondary">长势评分 未接入</Typography.Text>
                      </div>
                    ) : (
                      <ReactECharts option={buildGaugeOption(vigorScore.value)} style={{ height: 200 }} notMerge />
                    )}
                  </Col>
                  <Col xs={24} md={14}>
                    <DetailInfoGrid
                      columns={1}
                      items={[
                        {
                          key: 'score',
                          label: '长势评估',
                          value:
                            vigorScore.value === null ? (
                              <Tag color="orange">未接入（无长势记录）</Tag>
                            ) : (
                              <Space size={8}>
                                <Typography.Text strong class="detail-info-mono">{vigorScore.value} 分</Typography.Text>
                                <Tag color={vigorScore.value >= 75 ? 'green' : 'orange'}>{scoreLevelText(vigorScore.value)}</Tag>
                              </Space>
                            ),
                        },
                        { key: 'ndvi', label: 'NDVI 指数', value: <Tag color="orange">遥感源未接入</Tag> },
                        { key: 'abnormal', label: '异常区域', value: <Tag color="orange">遥感源未接入</Tag> },
                        { key: 'updated', label: '最新生长记录', value: latestGrowth.value?.recordDate ?? '未接入', mono: true },
                      ]}
                    />
                  </Col>
                </Row>
              </DetailSection>
            </>
          )}

          {activeTab.value === 'records' && (
            <DetailSection title="关联业务记录">
              <Tabs
                items={[
                  {
                    key: 'tasks',
                    label: `农事记录（${tasks.value.length}）`,
                    children: (
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Row justify="end">
                          <Button size="small" type="primary" onClick={() => navigate(`/production/tasks/create?plotId=${_params.plotId}&farmId=${_plotAtStart.farmId}`)}>
                            新增农事记录
                          </Button>
                        </Row>
                        <BusinessRecordList
                          rowKey="taskId"
                          size="small"
                          dataSource={tasks.value}
                          columns={taskColumns.value}
                          pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
                          scroll={{ x: 680 }}
                          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无农事记录" /> }}
                        />
                      </Space>
                    ),
                  },
                  {
                    key: 'harvests',
                    label: `采收记录（${harvests.value.length}）`,
                    children: (
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Row justify="space-between" align="middle">
                          <Typography.Text type="secondary">进入采收详情可确认入库</Typography.Text>
                          <Button size="small" type="primary" onClick={() => navigate(`/production/harvests/create?plotId=${_params.plotId}&farmId=${_plotAtStart.farmId}`)}>
                            新增采收记录
                          </Button>
                        </Row>
                        <BusinessRecordList
                          rowKey="batchId"
                          size="small"
                          dataSource={harvests.value}
                          columns={harvestColumns.value}
                          pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
                          scroll={{ x: 620 }}
                          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无采收记录" /> }}
                        />
                      </Space>
                    ),
                  },
                  {
                    key: 'usages',
                    label: `农资使用（${usages.value.length}）`,
                    children: (
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Row justify="end">
                          <Button size="small" type="primary" onClick={() => navigate(`/production/inputs?tab=ledger&plotId=${_params.plotId}&create=1`)}>
                            新增农资使用
                          </Button>
                        </Row>
                        <BusinessRecordList
                          rowKey="usageId"
                          size="small"
                          dataSource={usages.value}
                          columns={usageColumns.value}
                          pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
                          scroll={{ x: 620 }}
                          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无农资使用记录" /> }}
                        />
                      </Space>
                    ),
                  },
                  {
                    key: 'growth',
                    label: `种植模型（${growthRecords.value.length}）`,
                    children: (
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Row justify="end">
                          <Button size="small" type="primary" onClick={() => navigate(`/production/growth/records?plotId=${_params.plotId}&create=1`)}>
                            新增模型记录
                          </Button>
                        </Row>
                        <BusinessRecordList
                          rowKey="recordId"
                          size="small"
                          dataSource={growthRecords.value}
                          columns={growthColumns.value}
                          pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
                          scroll={{ x: 780 }}
                          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无种植模型记录" /> }}
                        />
                      </Space>
                    ),
                  },
                ]}
              />
            </DetailSection>
          )}

          <Modal
            class="production-form-dialog"
            title={editingCrop.value ? '编辑种养品种' : '添加种养品种'}
            open={cropModalOpen.value}
            okText="确定"
            cancelText="取消"
            width={640}
            destroyOnHidden
            forceRender
            confirmLoading={saveCropMutation.isPending}
            closable={!saveCropMutation.isPending}
            maskClosable={!saveCropMutation.isPending}
            cancelButtonProps={{ disabled: saveCropMutation.isPending }}
            onCancel={() => {
              if (cropWriteLock.value) return;
              cropModalOpen.value = false;
              editingCrop.value = null;
            }}
            onOk={() => {
              if (cropWriteLock.value) return;
              cropWriteLock.value = true;
              void cropForm
                .validateFields()
                .then(values => saveCropMutation.mutate(values))
                .catch(() => {
                  cropWriteLock.value = false;
                });
            }}
          >
            <Form form={cropForm} layout="vertical" preserve={false}>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="cropId"
                    label="种类"
                    rules={[{ required: true, message: '请选择种类' }]}
                    extra="取自作物主数据；没有需要的作物请联系平台运营新增"
                  >
                    <Select showSearch optionFilterProp="label" options={cropOptions.value} placeholder="请选择种类" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="cropVariety" label="品种">
                    <Input placeholder={selectedCropName.value ? `${selectedCropName.value}的哪个品种` : '该作物下的哪个品种'} maxLength={100} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="plantingStandard" label="种植标准" rules={[{ required: true, message: '请选择种植标准' }]}>
                <Radio.Group style={{ width: '100%' }}>
                  <Row gutter={8}>
                    {PLANTING_STANDARD_OPTIONS.map(option => (
                      <Col span={8} key={option.value}>
                        <Radio.Button
                          value={option.value}
                          style={{ width: '100%', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                          <span style={{ fontSize: 18 }}>{option.icon}</span>
                          {option.label}
                        </Radio.Button>
                      </Col>
                    ))}
                  </Row>
                </Radio.Group>
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="plantingMethod" label="种植方式" rules={[{ required: true, message: '请选择种植方式' }]}>
                    <Radio.Group>
                      <Radio value="TRANSPLANT">移栽</Radio>
                      <Radio value="DIRECT">直播</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="operationMethod" label="作业方式" rules={[{ required: true, message: '请选择作业方式' }]}>
                    <Radio.Group>
                      <Radio value="MANUAL">人工</Radio>
                      <Radio value="MECHANICAL">机械</Radio>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="transplantDate" label="移栽时间" rules={[{ required: true, message: '请选择移栽时间' }]}>
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="请选择移栽时间" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="expectedHarvestDate" label="预计采收时间">
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="请选择预计采收时间" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="expectedYieldPerMu" label="预计亩产">
                    <InputNumber style={{ width: '100%' }} min={0} precision={2} max={9999999999.99} addonAfter="公斤/亩" placeholder="如 5000" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="plantCount" label="株数">
                    <InputNumber style={{ width: '100%' }} min={0} precision={0} max={2147483647} addonAfter="株" placeholder="如 1200" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="plantSpacing" label="株间距">
                    <InputNumber style={{ width: '100%' }} min={0} precision={2} max={99999999.99} addonAfter="cm" placeholder="如 35" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Modal>
        </ProductionDetailLayout>
      );
    };
  },
});

export default PlotDetail;
