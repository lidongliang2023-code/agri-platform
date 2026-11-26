import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { useQuery } from '@/vue/query';
import { Alert, Button, Empty, Select, Space, Spin } from '@/vue/ui';
import ReactECharts from '@/vue/VueECharts';
import { monitorEnvironment } from '@/api/admin/monitor-workbench';
import { Card, FarmFilter, Metrics, MonitorPage, QueryError } from './MonitorShared';
const metrics = [{
  key: 'airTemperature',
  label: '气温',
  unit: '℃'
}, {
  key: 'airHumidity',
  label: '空气湿度',
  unit: '%'
}, {
  key: 'soilTemperature',
  label: '土壤温度',
  unit: '℃'
}, {
  key: 'soilMoisture',
  label: '土壤湿度',
  unit: '%'
}, {
  key: 'illuminance',
  label: '光照',
  unit: 'lx'
}, {
  key: 'co2',
  label: '二氧化碳',
  unit: 'ppm'
}] as const;
const Environment = defineComponent({
  name: "Environment",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const farm = shallowRef<string>(),
      hours = shallowRef(24),
      metric = shallowRef<typeof metrics[number]['key']>('airTemperature');
    const setMetric = (next: typeof metric.value | ((previous: typeof metric.value) => typeof metric.value)) => {
      metric.value = typeof next === 'function' ? (next as (previous: typeof metric.value) => typeof metric.value)(metric.value) : next;
    };
    const setHours = (next: typeof hours.value | ((previous: typeof hours.value) => typeof hours.value)) => {
      hours.value = typeof next === 'function' ? (next as (previous: typeof hours.value) => typeof hours.value)(hours.value) : next;
    };
    const setFarm = (next: typeof farm.value | ((previous: typeof farm.value) => typeof farm.value)) => {
      farm.value = typeof next === 'function' ? (next as (previous: typeof farm.value) => typeof farm.value)(farm.value) : next;
    };
    const q = useQuery(() => ({
      queryKey: ['admin-monitor-environment', farm.value, hours.value],
      enabled: !!farm.value,
      queryFn: () => monitorEnvironment(farm.value!, hours.value),
      retry: false
    }));
    const data = computed(() => q.data);
    const meta = computed(() => metrics.find(m => m.key === metric.value)!);
    return () => {
      const current = data.value;
      return <MonitorPage title="环境数据监控" subTitle="复用生产端环境采样与聚合口径，按农场查看真实读数"><Card title="监测范围"><Space wrap><FarmFilter value={farm.value} onChange={setFarm} /><Select value={hours.value} style={{
              width: 190
            }} options={[{
              value: 24,
              label: '最新采样前 24 小时'
            }, {
              value: 72,
              label: '最新采样前 3 天'
            }, {
              value: 168,
              label: '最新采样前 7 天'
            }]} onChange={setHours} /><Button disabled={!farm.value} loading={q.isFetching} onClick={() => void q.refetch()}>刷新</Button><Button onClick={() => {
              setFarm(undefined);
              setHours(24);
            }}>重置</Button></Space></Card><QueryError error={q.error} />{!farm.value ? <Card><Empty description="请选择监测农场" /></Card> : q.isLoading ? <Spin /> : current && <><Alert showIcon type={(current.staleHours ?? 0) > 2 ? 'warning' : 'info'} message={current.sampleCount ? `最后采样：${current.windowTo}，距当前 ${current.staleHours ?? 0} 小时；窗口内 ${current.sampleCount} 条读数，覆盖 ${current.plotCount} 个地块。` : '当前农场尚无环境采样数据'} description="时间窗口锚定最新采样；缺失指标保留空值。设备采集与运维请进入物联网模块。" /><Metrics items={metrics.map(m => ({
            title: `${m.label}（${m.unit}）`,
            value: current.summary[m.key] == null ? '—' : Number(current.summary[m.key].toFixed(2))
          }))} /><Card title="环境趋势" extra={<Select style={{
            width: 160
          }} value={metric.value} options={metrics.map(m => ({
            value: m.key,
            label: `${m.label}（${m.unit}）`
          }))} onChange={setMetric} />}>{current.series.some(p => p[metric.value] != null) ? <ReactECharts style={{
              height: 280
            }} option={{
              tooltip: {
                trigger: 'axis'
              },
              grid: {
                left: 55,
                right: 20,
                top: 30,
                bottom: 40
              },
              xAxis: {
                type: 'category',
                data: current.series.map(p => p.time)
              },
              yAxis: {
                type: 'value',
                name: meta.value.unit,
                scale: true
              },
              series: [{
                name: meta.value.label,
                type: 'line',
                connectNulls: false,
                data: current.series.map(p => p[metric.value])
              }]
            }} /> : <Empty description="该指标暂无采样数据" />}</Card></>}</MonitorPage>;
    };
  }
});
export default Environment;
