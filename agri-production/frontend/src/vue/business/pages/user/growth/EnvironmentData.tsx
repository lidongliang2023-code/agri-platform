import { Popover as ListSummary } from '@/vue/ui';
import ProductionListFilters from '@/vue/business/components/ProductionListFilters';
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
import Table from '@/vue/business/components/BusinessRecordList';
import { PageContainer as PageContainer } from '@/vue/pro';
import '@/components/ProductionListDense.css';
import '@/components/ProductionTable.css';
/**
 * 页面名称：环境数据
 * 路由路径：/production/growth/environment
 * 所属模块：生长监测与IoT
 * PRD 序号：PRD 6.1 #25（温湿度/土壤/气象曲线、历史回溯）
 *
 * 数据来源：
 * - 选中设备时走 `GET /iot/readings/series?deviceId=&metric=`
 * - 未选设备（按地块）时走 `GET /growth/environment?plotId=`
 * 两条链路在前端统一归一为「指标点」后绘曲线，兼容后端命名差异（见 METRIC_ALIAS）。
 */

import { useQuery } from '@/vue/query';
import { Alert, Button, Card, Checkbox, DatePicker, Empty, Segmented, Select, Skeleton, Space, Tooltip, message } from '@/vue/ui';
import { DownloadOutlined } from '@ant-design/icons-vue';
import ReactECharts from '@/vue/VueECharts';
import type { EChartsOption } from 'echarts';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import useFarmStore from '@/vue/farmStore';
import { listEnvironmentData } from '@/api/growth';
import { DEFAULT_ENV_METRICS, ENV_METRIC_DEFS, listDevices, listReadingSeries, normalizeMetric, unwrapList } from '@/api/iot';
import { listPlots } from '@/api/plots';
import type { EnvironmentData, IotDevice, Plot } from '@/types';

/** 时间范围快捷选项 */
const RANGE_PRESETS: {
  label: string;
  value: string;
  days: number;
}[] = [{
  label: '今日',
  value: 'today',
  days: 1
}, {
  label: '近7天',
  value: '7d',
  days: 7
}, {
  label: '近30天',
  value: '30d',
  days: 30
}];

/** 统一指标点（屏蔽两种数据源字段差异） */
interface MetricPoint {
  /** 采集时间 */
  time: string;
  /** 指标编码（已标准化） */
  metric: string;
  /** 指标值 */
  value: number;
  /** 单位 */
  unit: string;
  /** 来源描述 */
  source: string;
}

/** 土壤湿度偏低阈值（%） */
const SOIL_LOW = 40;

/**
 * 读取环境数据行的采集时间（兼容 collectedAt / readTime）。
 *
 * @param row 环境数据行
 * @returns 时间字符串
 */
function envTime(row: EnvironmentData): string {
  const raw = row as unknown as {
    readTime?: string;
  };
  return row.collectedAt ?? raw.readTime ?? '';
}

/**
 * 将环境数据行展开为指标点数组。
 *
 * @param rows 环境数据行
 * @returns 指标点数组
 */
function expandEnvRows(rows: EnvironmentData[]): MetricPoint[] {
  const points: MetricPoint[] = [];
  rows.forEach(row => {
    const time = envTime(row);
    if (!time) return;
    ENV_METRIC_DEFS.forEach(def => {
      const value = row[def.key as keyof EnvironmentData];
      if (typeof value === 'number') {
        points.push({
          time,
          metric: def.key,
          value,
          unit: def.unit,
          source: '地块环境'
        });
      }
    });
  });
  return points;
}

/**
 * 导出数据为 CSV 文件。
 *
 * @param rows 数据行
 * @param fileName 文件名
 */
function exportCsv(rows: MetricPoint[], fileName: string): void {
  const header = '采集时间,指标,数值,单位,来源\n';
  const body = rows.map(row => `${row.time},${row.metric},${row.value},${row.unit},${row.source}`).join('\n');
  const blob = new Blob([`${header}${body}`], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * 环境数据页面
 *
 * 业务职责：展示空气温湿度、土壤温湿度、光照、CO₂ 等环境指标曲线，
 * 支持地块 / 设备 / 时间范围筛选、历史回溯与原始数据导出。
 *
 * @returns 页面内容
 */
const EnvironmentDataPage = defineComponent({
  name: "EnvironmentData",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _store = useFarmStore();
    const farmId = computed(() => _store.currentFarm?.farmId);

    /** 地块筛选（草稿与已生效） */
    const draftPlotId = shallowRef<string | undefined>(undefined);
    const setDraftPlotId = (next: typeof draftPlotId.value | ((previous: typeof draftPlotId.value) => typeof draftPlotId.value)) => {
      draftPlotId.value = typeof next === 'function' ? (next as (previous: typeof draftPlotId.value) => typeof draftPlotId.value)(draftPlotId.value) : next;
    };
    const plotId = shallowRef<string | undefined>(undefined);
    /** 设备筛选 */
    const setPlotId = (next: typeof plotId.value | ((previous: typeof plotId.value) => typeof plotId.value)) => {
      plotId.value = typeof next === 'function' ? (next as (previous: typeof plotId.value) => typeof plotId.value)(plotId.value) : next;
    };
    const draftDeviceId = shallowRef<string | undefined>(undefined);
    const setDraftDeviceId = (next: typeof draftDeviceId.value | ((previous: typeof draftDeviceId.value) => typeof draftDeviceId.value)) => {
      draftDeviceId.value = typeof next === 'function' ? (next as (previous: typeof draftDeviceId.value) => typeof draftDeviceId.value)(draftDeviceId.value) : next;
    };
    const deviceId = shallowRef<string | undefined>(undefined);
    /** 时间范围快捷选项 */
    const setDeviceId = (next: typeof deviceId.value | ((previous: typeof deviceId.value) => typeof deviceId.value)) => {
      deviceId.value = typeof next === 'function' ? (next as (previous: typeof deviceId.value) => typeof deviceId.value)(deviceId.value) : next;
    };
    const draftRangePreset = shallowRef<string>('7d');
    const setDraftRangePreset = (next: typeof draftRangePreset.value | ((previous: typeof draftRangePreset.value) => typeof draftRangePreset.value)) => {
      draftRangePreset.value = typeof next === 'function' ? (next as (previous: typeof draftRangePreset.value) => typeof draftRangePreset.value)(draftRangePreset.value) : next;
    };
    const rangePreset = shallowRef<string>('7d');
    /** 自定义时间范围 */
    const setRangePreset = (next: typeof rangePreset.value | ((previous: typeof rangePreset.value) => typeof rangePreset.value)) => {
      rangePreset.value = typeof next === 'function' ? (next as (previous: typeof rangePreset.value) => typeof rangePreset.value)(rangePreset.value) : next;
    };
    const draftCustomRange = shallowRef<[Dayjs, Dayjs] | null>(null);
    const setDraftCustomRange = (next: typeof draftCustomRange.value | ((previous: typeof draftCustomRange.value) => typeof draftCustomRange.value)) => {
      draftCustomRange.value = typeof next === 'function' ? (next as (previous: typeof draftCustomRange.value) => typeof draftCustomRange.value)(draftCustomRange.value) : next;
    };
    const customRange = shallowRef<[Dayjs, Dayjs] | null>(null);
    /** 历史回溯日期（优先于快捷范围） */
    const setCustomRange = (next: typeof customRange.value | ((previous: typeof customRange.value) => typeof customRange.value)) => {
      customRange.value = typeof next === 'function' ? (next as (previous: typeof customRange.value) => typeof customRange.value)(customRange.value) : next;
    };
    const draftBacktrackDate = shallowRef<Dayjs | null>(null);
    const setDraftBacktrackDate = (next: typeof draftBacktrackDate.value | ((previous: typeof draftBacktrackDate.value) => typeof draftBacktrackDate.value)) => {
      draftBacktrackDate.value = typeof next === 'function' ? (next as (previous: typeof draftBacktrackDate.value) => typeof draftBacktrackDate.value)(draftBacktrackDate.value) : next;
    };
    const backtrackDate = shallowRef<Dayjs | null>(null);
    /** 展示指标 */
    const setBacktrackDate = (next: typeof backtrackDate.value | ((previous: typeof backtrackDate.value) => typeof backtrackDate.value)) => {
      backtrackDate.value = typeof next === 'function' ? (next as (previous: typeof backtrackDate.value) => typeof backtrackDate.value)(backtrackDate.value) : next;
    };
    const metrics = shallowRef<string[]>(DEFAULT_ENV_METRICS);
    /** 手动刷新计数 */
    const setMetrics = (next: typeof metrics.value | ((previous: typeof metrics.value) => typeof metrics.value)) => {
      metrics.value = typeof next === 'function' ? (next as (previous: typeof metrics.value) => typeof metrics.value)(metrics.value) : next;
    };
    const refreshKey = shallowRef<number>(0);
    /** 行勾选 */
    const setRefreshKey = (next: typeof refreshKey.value | ((previous: typeof refreshKey.value) => typeof refreshKey.value)) => {
      refreshKey.value = typeof next === 'function' ? (next as (previous: typeof refreshKey.value) => typeof refreshKey.value)(refreshKey.value) : next;
    };
    const selectedRowKeys = shallowRef<(string | number)[]>([]);
    const setSelectedRowKeys = (next: typeof selectedRowKeys.value | ((previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)) => {
      selectedRowKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)(selectedRowKeys.value) : next;
    };
    const handleSearch = (): void => {
      setPlotId(draftPlotId.value);
      setDeviceId(draftDeviceId.value);
      setRangePreset(draftRangePreset.value);
      setCustomRange(draftCustomRange.value);
      setBacktrackDate(draftBacktrackDate.value);
    };
    const handleReset = (): void => {
      setDraftPlotId(undefined);
      setDraftDeviceId(undefined);
      setDraftRangePreset('7d');
      setDraftCustomRange(null);
      setDraftBacktrackDate(null);
      setPlotId(undefined);
      setDeviceId(undefined);
      setRangePreset('7d');
      setCustomRange(null);
      setBacktrackDate(null);
      setMetrics(DEFAULT_ENV_METRICS);
    };

    /** 地块列表 */
    const plotsQuery = useQuery(() => ({
      queryKey: ['env-plots', farmId.value],
      queryFn: () => listPlots({
        pageNum: 1,
        pageSize: 100,
        farmId: farmId.value
      }),
      retry: false
    }));
    const plots = computed<Plot[]>(() => unwrapList<Plot>(plotsQuery.data));

    /** 设备列表 */
    const devicesQuery = useQuery(() => ({
      queryKey: ['env-devices', farmId.value],
      queryFn: () => listDevices({
        pageNum: 1,
        pageSize: 100,
        farmId: farmId.value
      }),
      retry: false
    }));
    const devices = computed<IotDevice[]>(() => unwrapList<IotDevice>(devicesQuery.data));

    /** 设备读数时序（选中设备时） */
    const seriesQuery = useQuery(() => ({
      queryKey: ['env-series', deviceId.value, refreshKey.value],
      queryFn: () => listReadingSeries(deviceId.value as string),
      retry: false,
      enabled: Boolean(deviceId.value)
    }));

    /** 地块环境数据（未选设备时） */
    const envQuery = useQuery(() => ({
      queryKey: ['env-rows', plotId.value, refreshKey.value],
      queryFn: () => listEnvironmentData({
        pageNum: 1,
        pageSize: 200,
        plotId: plotId.value
      }),
      retry: false,
      enabled: !deviceId.value
    }));

    /** 统一指标点 */
    const points = computed<MetricPoint[]>(() => {
      if (deviceId.value) {
        const rows = seriesQuery.data ?? [];
        return rows.filter(row => typeof row.metricValue === 'number').map(row => ({
          time: row.readTime,
          metric: normalizeMetric(row.metric),
          value: Number(row.metricValue),
          unit: row.unit ?? '',
          source: '设备读数'
        }));
      }
      return expandEnvRows(unwrapList<EnvironmentData>(envQuery.data));
    });

    /** 生效时间区间 */
    const effectiveRange = computed<[Dayjs, Dayjs] | null>(() => {
      if (backtrackDate.value) return [backtrackDate.value.startOf('day'), backtrackDate.value.endOf('day')];
      if (customRange.value) return customRange.value;
      const days = RANGE_PRESETS.find(item => item.value === rangePreset.value)?.days ?? 7;
      return [dayjs().startOf('day').subtract(days - 1, 'day'), dayjs().endOf('day')];
    });

    /** 时间过滤后的指标点 */
    const filteredPoints = computed(() => {
      if (!effectiveRange.value) return points.value;
      const [start, end] = effectiveRange.value;
      return points.value.filter(point => {
        const time = dayjs(point.time);
        return time.isValid() && !time.isBefore(start) && !time.isAfter(end);
      });
    });

    /** 最新读数（每个指标最后一条） */
    const latestMap = computed(() => {
      const map = new Map<string, MetricPoint>();
      filteredPoints.value.slice().sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf()).forEach(point => map.set(point.metric, point));
      return map;
    });

    /** 曲线配置 */
    const chartOption = computed<EChartsOption>(() => {
      const times = Array.from(new Set(filteredPoints.value.filter(point => metrics.value.includes(point.metric)).map(point => dayjs(point.time).format('YYYY-MM-DD HH:mm')).sort((a, b) => dayjs(a).valueOf() - dayjs(b).valueOf())));
      const series = metrics.value.map(metric => {
        const def = ENV_METRIC_DEFS.find(item => item.key === metric);
        const rows = filteredPoints.value.filter(point => point.metric === metric);
        const valueMap = new Map<string, number[]>();
        rows.forEach(row => {
          const key = dayjs(row.time).format('YYYY-MM-DD HH:mm');
          const list = valueMap.get(key) ?? [];
          list.push(row.value);
          valueMap.set(key, list);
        });
        return {
          name: def?.label ?? metric,
          type: 'line' as const,
          smooth: true,
          yAxisIndex: def?.axis ?? 0,
          connectNulls: true,
          itemStyle: {
            color: def?.color
          },
          data: times.map(time => {
            const list = valueMap.get(time);
            if (!list || list.length === 0) return null;
            return Number((list.reduce((acc, item) => acc + item, 0) / list.length).toFixed(2));
          })
        };
      });
      return {
        tooltip: {
          trigger: 'axis'
        },
        legend: {
          bottom: 0
        },
        grid: {
          left: 56,
          right: 56,
          top: 24,
          bottom: 48
        },
        xAxis: {
          type: 'category',
          data: times,
          boundaryGap: false
        },
        yAxis: [{
          type: 'value',
          name: '温度(℃)/湿度(%)/mm',
          position: 'left'
        }, {
          type: 'value',
          name: 'lux/ppm',
          position: 'right',
          splitLine: {
            show: false
          }
        }],
        dataZoom: [{
          type: 'inside'
        }, {
          type: 'slider',
          height: 18,
          bottom: 24
        }],
        series
      };
    });

    /** 原始数据表行 */
    const tableRows = computed(() => {
      const labelOf = (metric: string): string => ENV_METRIC_DEFS.find(item => item.key === metric)?.label ?? metric;
      return filteredPoints.value.filter(point => metrics.value.includes(point.metric)).slice().sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf()).map(point => ({
        key: `${point.time}-${point.metric}`,
        time: dayjs(point.time).format('YYYY-MM-DD HH:mm'),
        metric: labelOf(point.metric),
        value: point.value,
        unit: point.unit,
        source: point.source
      }));
    });
    const soilPoint = computed(() => latestMap.value.get('soilMoisture'));
    const soilLow = computed(() => typeof soilPoint.value?.value === 'number' && soilPoint.value.value < SOIL_LOW);
    const isLoading = computed(() => deviceId.value ? seriesQuery.isLoading : envQuery.isLoading);
    const isError = computed(() => deviceId.value ? seriesQuery.isError : envQuery.isError);
    const errorMessage = computed(() => ((deviceId.value ? seriesQuery.error : envQuery.error) as Error | undefined)?.message);
    return () => {
      return <PageContainer class="production-list-dense production-member-list" title="环境数据" subTitle={deviceId.value ? `设备读数时序（设备 ${deviceId.value}）` : plotId.value ? '地块环境数据 /growth/environment' : '全部地块环境数据 /growth/environment'} extra={<Segmented size="small" value={draftRangePreset.value} onChange={value => {
        const next = String(value);
        setDraftRangePreset(next);
        setRangePreset(next);
        setDraftCustomRange(null);
        setCustomRange(null);
        setDraftBacktrackDate(null);
        setBacktrackDate(null);
      }} options={RANGE_PRESETS.map(item => ({
        label: item.label,
        value: item.value
      }))} />}>
      {/* 统计统一放入列表工具栏。 */}

      <Card class="production-dense-filter-card">
        <ProductionListFilters onSearch={handleSearch} onReset={handleReset} loading={isLoading.value}>
          <div class="production-filter-field">
            <label>地块</label>
            <Select allowClear placeholder="全部地块" value={draftPlotId.value} options={plots.value.map(item => ({
                  value: item.plotId,
                  label: item.plotName
                }))} onChange={setDraftPlotId} />
          </div>
          <div class="production-filter-field">
            <label>设备</label>
            <Select allowClear placeholder="按设备查看时序" value={draftDeviceId.value} options={devices.value.map(item => ({
                  value: item.deviceId,
                  label: item.deviceName || item.deviceCode
                }))} onChange={setDraftDeviceId} />
          </div>
          <div class="production-filter-field">
            <label>时间范围</label>
            <DatePicker.RangePicker style={{
                  width: '100%'
                }} value={draftCustomRange.value} onChange={value => {
                  setDraftCustomRange(value as [Dayjs, Dayjs] | null);
                  if (value) setDraftBacktrackDate(null);
                }} />
          </div>
          <div class="production-filter-field">
            <label>历史回溯日期</label>
            <DatePicker style={{
                  width: '100%'
                }} placeholder="选择单日回溯" value={draftBacktrackDate.value} onChange={value => setDraftBacktrackDate(value)} />
          </div>
          <div class="production-filter-field" style={{
                gridColumn: '1 / span 3'
              }}>
            <label>展示指标</label>
            <Checkbox.Group value={metrics.value} onChange={value => setMetrics(value as string[])} options={ENV_METRIC_DEFS.map(item => ({
                  label: item.label,
                  value: item.key
                }))} />
          </div>
        </ProductionListFilters>
      </Card>

      {isError.value && <Alert type="error" showIcon style={{
          marginBottom: 10
        }} message="环境数据加载失败" description={errorMessage.value ?? '请稍后重试'} />}

      <Card title="环境指标曲线" style={{
          marginBottom: 10
        }}>
        {isLoading.value ? <Skeleton active paragraph={{
            rows: 5
          }} /> : filteredPoints.value.length === 0 ? <Empty description="当前筛选条件下暂无环境数据，请调整地块 / 设备 / 时间范围" /> : <ReactECharts option={chartOption.value} style={{
            height: 300
          }} notMerge />}
      </Card>

      <Card>
        <Table memberListToolbar columnWidthStorageKey="environment-data" rowKey="key" loading={isLoading.value} dataSource={tableRows.value} onReload={() => setRefreshKey(key => key + 1)} rowSelection={{
            selectedRowKeys: selectedRowKeys.value,
            onChange: setSelectedRowKeys
          }} toolbarTitle={<Space size={8} wrap>
              <Button icon={<DownloadOutlined />} disabled={tableRows.value.length === 0} onClick={() => {
              const rows = filteredPoints.value.filter(point => metrics.value.includes(point.metric));
              if (rows.length === 0) {
                message.warning('当前筛选条件下暂无可导出数据');
                return;
              }
              exportCsv(rows, `环境数据_${dayjs().format('YYYYMMDDHHmmss')}.csv`);
              message.success(`已导出 ${rows.length} 条环境数据`);
            }}>
                导出 CSV
              </Button>
            <ListSummary trigger="click" content={<div class="production-dense-summary">
        <div class="production-dense-summary-items">
          {ENV_METRIC_DEFS.map(def => {
              const point = latestMap.value.get(def.key);
              return <Tooltip key={def.key} title={point ? `最近采集：${dayjs(point.time).format('YYYY-MM-DD HH:mm')}` : '暂无采集数据'}>
                <span class="production-dense-metric">
                  <span class="production-dense-metric-label">{def.label}</span>
                  <span class="production-dense-metric-value">
                    {point ? `${Number(point.value.toFixed(1))}${def.unit}` : '—'}
                  </span>
                </span>
              </Tooltip>;
            })}
        </div>
        {soilLow.value && <span class="production-dense-metric-chip">
            土壤湿度 {soilPoint.value?.value}% 低于 {SOIL_LOW}%，建议灌溉
          </span>}
      </div>}><Button>统计</Button></ListSummary></Space>} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true
          }} locale={{
            emptyText: <Empty description="当前筛选条件下暂无环境明细数据，请调整地块、设备或时间范围" />
          }} columns={[{
            title: '采集时间',
            dataIndex: 'time',
            key: 'time',
            width: 180
          }, {
            title: '指标',
            dataIndex: 'metric',
            key: 'metric',
            width: 150
          }, {
            title: '数值',
            dataIndex: 'value',
            key: 'value',
            width: 120,
            align: 'right'
          }, {
            title: '单位',
            dataIndex: 'unit',
            key: 'unit',
            width: 100
          }, {
            title: '来源',
            dataIndex: 'source',
            key: 'source',
            width: 140
          }]} />
      </Card>
    </PageContainer>;
    };
  }
});
export default EnvironmentDataPage;
