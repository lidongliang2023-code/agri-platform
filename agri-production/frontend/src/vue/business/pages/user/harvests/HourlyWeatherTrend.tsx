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
import { Empty, Space, Tag, Typography } from '@/vue/ui';
import ReactEChartsCore from '@/vue/VueECharts';
import * as echarts from 'echarts/core';
import type { LineSeriesOption } from 'echarts';
import { BarChart, LineChart } from 'echarts/charts';
import { AriaComponent, DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import type { HarvestWeatherHour } from '@/api/harvest-window';
import { mergeWeatherShifts, overlappingWeatherShifts } from '@/pages/user/harvests/hourly-weather-shifts';
import type { WeatherShift } from '@/pages/user/harvests/hourly-weather-shifts';
echarts.use([AriaComponent, BarChart, LineChart, DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent, CanvasRenderer]);
interface Props {
  date: string;
  hours: HarvestWeatherHour[];
  stale: boolean;
  shifts?: WeatherShift[];
}

/** 与小时表格共用天气快照；仅展示风险，不在前端重新判断能否开工。 */
const NO_SHIFTS: WeatherShift[] = [];
const HourlyWeatherTrend = defineComponent({
  name: "HourlyWeatherTrend",
  props: {
    date: null as unknown as PropType<{
      date: string;
      hours: HarvestWeatherHour[];
      stale: boolean;
      shifts?: WeatherShift[];
    }["date"]>,
    hours: null as unknown as PropType<{
      date: string;
      hours: HarvestWeatherHour[];
      stale: boolean;
      shifts?: WeatherShift[];
    }["hours"]>,
    stale: null as unknown as PropType<{
      date: string;
      hours: HarvestWeatherHour[];
      stale: boolean;
      shifts?: WeatherShift[];
    }["stale"]>,
    shifts: null as unknown as PropType<{
      date: string;
      hours: HarvestWeatherHour[];
      stale: boolean;
      shifts?: WeatherShift[];
    }["shifts"]>
  },
  setup(__props: {
    date: string;
    hours: HarvestWeatherHour[];
    stale: boolean;
    shifts?: WeatherShift[];
  }, {
    slots: __slots
  }) {
    const model = computed(() => {
      const groups = new Map<string, HarvestWeatherHour[]>();
      __props.hours.forEach(hour => {
        const rows = groups.get(hour.periodStart) ?? [];
        rows.push(hour);
        groups.set(hour.periodStart, rows);
      });
      // 固定24个小时，缺测和重复时段均保留为空，禁止跨缺口连线。
      const rows = Array.from({
        length: 24
      }, (_, index) => {
        const key = `${__props.date}T${String(index).padStart(2, '0')}:00`;
        const matches = groups.get(key);
        return matches?.length === 1 ? matches[0] : undefined;
      });
      const fields = ['temperature', 'rainMm', 'precipitationProbability', 'windSpeedMs', 'windGustMs'] as const;
      const complete = (row: HarvestWeatherHour | undefined) => Boolean(row && fields.every(key => typeof row[key] === 'number' && Number.isFinite(row[key])));
      const missing = rows.filter(row => !complete(row)).length;
      const risk = rows.filter(row => complete(row) && !row?.usable).length;
      const values = (key: typeof fields[number]) => rows.map((row, index) => {
        const value = row?.[key];
        return [index + 0.5, typeof value === 'number' && Number.isFinite(value) ? value : null];
      });
      const areas: NonNullable<NonNullable<LineSeriesOption['markArea']>['data']> = [];
      rows.forEach((row, index) => {
        const absent = !complete(row);
        if (!absent && row?.usable) return;
        areas.push([{
          xAxis: index,
          itemStyle: {
            color: absent ? 'rgba(140,140,140,0.12)' : 'rgba(250,173,20,0.15)'
          }
        }, {
          xAxis: index + 1
        }]);
      });
      const markArea = {
        silent: true,
        data: areas,
        label: {
          show: false
        }
      };
      const formatHour = (value: number) => {
        const minutes = Math.round(value * 60);
        return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      };
      const axis = (gridIndex: number) => ({
        type: 'value' as const,
        gridIndex,
        min: 0,
        max: 24,
        interval: 3,
        axisLabel: {
          formatter: formatHour
        },
        axisPointer: {
          label: {
            formatter: ({
              value
            }: {
              value: unknown;
            }) => formatHour(Number(value))
          }
        }
      });
      const unit = (suffix: string) => ({
        valueFormatter: (value: unknown) => {
          const number = Array.isArray(value) ? value[1] : value;
          return typeof number === 'number' && Number.isFinite(number) ? `${number} ${suffix}` : '缺测';
        }
      });
      const shiftAreas: NonNullable<NonNullable<LineSeriesOption['markArea']>['data']> = mergeWeatherShifts(__props.shifts ?? NO_SHIFTS).map(({
        start,
        end
      }) => [{
        xAxis: start,
        itemStyle: {
          color: 'rgba(22,119,255,0.08)',
          borderColor: '#1677ff',
          borderWidth: 1,
          borderType: 'dashed'
        }
      }, {
        xAxis: end
      }]);
      // 独立覆盖层不随指标图例隐藏；风险底纹保留在班次范围之上。
      const overlays: LineSeriesOption[] = [0, 1, 2].flatMap(index => [{
        type: 'line',
        xAxisIndex: index,
        yAxisIndex: index === 2 ? 3 : index,
        data: [],
        silent: true,
        tooltip: {
          show: false
        },
        markArea
      }, {
        type: 'line',
        xAxisIndex: index,
        yAxisIndex: index === 2 ? 3 : index,
        data: [],
        silent: true,
        tooltip: {
          show: false
        },
        markArea: {
          silent: true,
          z: -2,
          data: shiftAreas,
          label: {
            show: false
          }
        }
      }]);
      const shiftRows = rows.filter((_, index) => overlappingWeatherShifts(`${__props.date}T${String(index).padStart(2, '0')}:00`, __props.date, __props.shifts ?? NO_SHIFTS).length > 0);
      const shiftMissing = shiftRows.filter(row => !complete(row)).length;
      const shiftRisk = shiftRows.filter(row => complete(row) && !row?.usable).length;
      const option: EChartsOption = {
        animation: false,
        aria: {
          enabled: true,
          description: `${__props.date}逐小时天气趋势，包含温度、降水量、降水概率、风速和阵风。蓝色范围表示所选派单班次，详细值及风险原因可在下方表格查看。`
        },
        color: ['#d46b08', '#1677ff', '#722ed1', '#0b7a67', '#c41d7f'],
        legend: {
          top: 0,
          data: ['温度', '降水量', '降水概率', '风速', '阵风'],
          selectedMode: true
        },
        tooltip: {
          trigger: 'axis',
          confine: true,
          renderMode: 'richText'
        },
        axisPointer: {
          link: [{
            xAxisIndex: 'all'
          }]
        },
        grid: [{
          top: 64,
          height: 92,
          left: 62,
          right: 66
        }, {
          top: 204,
          height: 92,
          left: 62,
          right: 66
        }, {
          top: 344,
          height: 92,
          left: 62,
          right: 66
        }],
        xAxis: [axis(0), axis(1), axis(2)],
        yAxis: [{
          type: 'value',
          gridIndex: 0,
          name: '温度 ℃',
          scale: true
        }, {
          type: 'value',
          gridIndex: 1,
          name: '降水 mm',
          min: 0,
          minInterval: 0.1
        }, {
          type: 'value',
          gridIndex: 1,
          name: '概率 %',
          position: 'right',
          min: 0,
          max: 100,
          splitLine: {
            show: false
          }
        }, {
          type: 'value',
          gridIndex: 2,
          name: '风速 m/s',
          min: 0
        }],
        dataZoom: [{
          type: 'inside',
          xAxisIndex: [0, 1, 2],
          filterMode: 'none',
          zoomOnMouseWheel: false,
          moveOnMouseWheel: false
        }, {
          type: 'slider',
          xAxisIndex: [0, 1, 2],
          filterMode: 'none',
          bottom: 6,
          height: 22,
          showDetail: false
        }],
        series: [...overlays, {
          name: '温度',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: values('temperature'),
          connectNulls: false,
          symbolSize: 5,
          tooltip: unit('℃')
        }, {
          name: '降水量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: values('rainMm'),
          barMaxWidth: 18,
          tooltip: unit('mm')
        }, {
          name: '降水概率',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 2,
          data: values('precipitationProbability'),
          connectNulls: false,
          symbolSize: 5,
          tooltip: unit('%'),
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              show: false
            },
            lineStyle: {
              color: '#722ed1',
              type: 'dashed'
            },
            data: [{
              yAxis: 40
            }]
          }
        }, {
          name: '风速',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 3,
          data: values('windSpeedMs'),
          connectNulls: false,
          symbolSize: 5,
          tooltip: unit('m/s'),
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              show: false
            },
            lineStyle: {
              color: '#c41d7f',
              type: 'dashed'
            },
            data: [{
              yAxis: 10.8
            }]
          }
        }, {
          name: '阵风',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 3,
          data: values('windGustMs'),
          connectNulls: false,
          symbolSize: 5,
          lineStyle: {
            type: 'dashed'
          },
          tooltip: unit('m/s')
        }]
      };
      return {
        option,
        missing,
        risk,
        shiftMissing,
        shiftRisk,
        shiftHours: shiftRows.length,
        available: rows.some(Boolean)
      };
    });
    return () => {
      return <section class="hw-hourly-trend" aria-label={`${__props.date}小时天气趋势图`}>
    <Space wrap class="hw-hourly-trend-heading">
      <Typography.Text strong>小时天气趋势 · {__props.date}</Typography.Text>
      {__props.stale && <Tag color="warning">快照未通过核验，仅供参考</Tag>}
      <Tag color="orange">风险 {model.value.risk} 小时</Tag>
      <Tag>缺测或字段不全 {model.value.missing} 小时</Tag>
      {(__props.shifts ?? NO_SHIFTS).length > 0 && <Tag color="blue">班次覆盖 {model.value.shiftHours} 个小时区间 · 风险 {model.value.shiftRisk} · 缺测 {model.value.shiftMissing}</Tag>}
    </Space>
    {model.value.available ? <div class="hw-hourly-trend-scroll"><ReactEChartsCore echarts={echarts} option={model.value.option} notMerge style={{
            height: 496,
            minWidth: 540
          }} opts={{
            renderer: 'canvas'
          }} /></div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该日期无逐小时预报，不能按零降雨处理" />}
    <Typography.Paragraph type="secondary" class="hw-hourly-trend-note">横轴为北京时间小时区间（24:00 为次日 00:00）。蓝色虚线框表示所选实际班次范围（重叠班次合并显示），按分钟及秒精度定位边界；曲线和柱形位于小时区间中心，班次统计包含所有重叠小时。橙色底纹表示后端判定的小时风险，灰色表示缺测或字段不全；虚线参考值为降水概率 40%、风速 10.8 m/s。点击图例切换指标，拖动底部滑块缩放；开工仍以派单天气核验为准，小时通过不代表整日可采。</Typography.Paragraph>
  </section>;
    };
  }
});
export default HourlyWeatherTrend;
