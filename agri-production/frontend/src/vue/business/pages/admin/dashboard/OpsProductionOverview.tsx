import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
/**
 * 页面名称：生产总览
 * 路由路径：/admin/production/dashboard/overview
 * 所属模块：运营仪表盘
 * PRD 序号：PRD 6.2 #2
 * 说明：原型无此页（原型仅有运营管理大盘），按 PRD「多维度生产数据统计、区域分析、主体分析」实现。
 */
import '@/components/ProductionListDense.css';
import { Alert as AntAlert, App, Button, Card, Col, DatePicker, Empty, Row, Segmented, Select, Skeleton, Space, Statistic, Tag, Tooltip, Typography } from '@/vue/ui';
import type { ProductionColumn } from '@/vue/ProductionRequestTable';
type ColumnsType<T = any> = ProductionColumn<T>[];
import { AgriAntdvJsxList as Table } from '@agri/shared/vue/antdv/AgriAntdvJsxList';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useQuery, useQueryClient } from '@/vue/query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import ReactECharts from '@/vue/VueECharts';
import type { EChartsOption } from 'echarts';
import { fetchOverviewRows, getOpsProductionOverview } from '@/api/admin/dashboard';
const {
  Text,
  Title
} = Typography;

/** 统计维度 */
type Dimension = 'region' | 'crop' | 'tenant';

/** 展示方式 */
type ViewMode = 'table' | 'chart';

/** 过滤条件 */
interface OverviewFilter {
  /** 起始日期 yyyy-MM-dd */
  startDate: string;
  /** 截止日期 yyyy-MM-dd */
  endDate: string;
  /** 区域 */
  region: string;
  /** 统计维度 */
  dimension: Dimension;
  /** 展示方式 */
  view: ViewMode;
}

/** 维度统计行 */
interface OverviewRow {
  /** 维度名称 */
  name: string;
  /** 农场数 */
  farmCount: number;
  /** 在田面积（亩） */
  fieldArea: number;
  /** 本期产量（吨） */
  outputTon: number;
  /** 任务完成率（%） */
  taskRate: number;
  /** 告警数 */
  alertCount: number;
}

/** 区域下拉选项（原型 P5 / 4.2 口径） */
const REGION_OPTIONS: Array<{
  value: string;
  label: string;
}> = [{
  value: 'all',
  label: '全部'
}, {
  value: '河南省',
  label: '河南省'
}, {
  value: '山东省',
  label: '山东省'
}, {
  value: '黑龙江省',
  label: '黑龙江省'
}, {
  value: '江苏省',
  label: '江苏省'
}, {
  value: '四川省',
  label: '四川省'
}, {
  value: '广东省',
  label: '广东省'
}];

/**
 * 生产总览
 *
 * 业务职责：按区域 / 作物 / 主体三个维度聚合展示全平台生产数据，
 * 支持时间范围与区域筛选、表格与图表两种展示方式。
 *
 * <p><b>数据口径（硬规矩：不造数据、可以降级但不能骗人）：</b>
 * 汇总指标取后端 `/admin/dashboard/overview`，维度明细取 `/admin/dashboard/overview-rows`；
 * 接口返回空就是空，接口报错就显式提示，<b>不使用任何示例 / 兜底数据</b>。
 * 原实现里「明细为空时换 FALLBACK_ROWS」以及「汇总为 0 时填 3542 / 856000 / 2450 / 26 / 87.3」
 * 已全部移除——那些数字看起来完全合理，却完全看不出是编造的。</p>
 *
 * @returns 页面内容
 */
const OpsProductionOverview = defineComponent({
  name: "OpsProductionOverview",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const queryClient = useQueryClient();
    const {
      message
    } = App.useApp();

    /** 默认时间范围：近 30 天 */
    const filter = shallowRef<OverviewFilter>({
      startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
      region: 'all',
      dimension: 'region',
      view: 'table'
    });

    /** 日期区间选择器的受控值 */
    const setFilter = (next: typeof filter.value | ((previous: typeof filter.value) => typeof filter.value)) => {
      filter.value = typeof next === 'function' ? (next as (previous: typeof filter.value) => typeof filter.value)(filter.value) : next;
    };
    const rangeValue = computed<[Dayjs, Dayjs]>(() => [dayjs(filter.value.startDate), dayjs(filter.value.endDate)]);

    /** 汇总指标（后端 /admin/dashboard/overview） */
    const summaryQuery = useQuery(() => ({
      queryKey: ['admin', 'dashboard', 'overview-summary', filter.value.startDate, filter.value.endDate],
      queryFn: () => getOpsProductionOverview({
        startDate: filter.value.startDate,
        endDate: filter.value.endDate
      }),
      retry: false
    }));

    /** 维度明细（后端扩展接口，未就绪时降级示例数据） */
    const rowsQuery = useQuery(() => ({
      queryKey: ['admin', 'dashboard', 'overview-rows', filter.value],
      queryFn: () => fetchOverviewRows({
        dimension: filter.value.dimension,
        startDate: filter.value.startDate,
        endDate: filter.value.endDate,
        region: filter.value.region === 'all' ? undefined : filter.value.region
      }),
      retry: false
    }));

    /** 维度明细数据：只用后端真实返回，接口为空就是空（不再用 FALLBACK_ROWS 兜底） */
    const rows = computed<OverviewRow[]>(() => (rowsQuery.data ?? []).map(item => ({
      name: item.name,
      farmCount: Number(item.farmCount) || 0,
      fieldArea: Number(item.fieldArea) || 0,
      outputTon: Number(item.outputTon) || 0,
      taskRate: Number(item.taskRate) || 0,
      alertCount: Number(item.alertCount) || 0
    })));

    /**
     * 汇总指标卡：只按后端返回值与真实明细聚合计算。
     *
     * 后端既无接口值、也无明细行时各项为 null（卡片展示「—」），不再用
     * 3542 / 856000 / 2450 / 26 / 87.3 这类示例数字顶替。
     */
    const summary = computed<{
      /** 纳入统计农场数 */
      farmCount: number | null;
      /** 在田面积（亩） */
      fieldArea: number | null;
      /** 本期产量（吨） */
      outputTon: number | null;
      /** 平均任务完成率（%） */
      taskRate: number | null;
      /** 告警数 */
      alertCount: number | null;
    }>(() => {
      const totals = rows.value.reduce((acc, item) => ({
        farmCount: acc.farmCount + item.farmCount,
        fieldArea: acc.fieldArea + item.fieldArea,
        outputTon: acc.outputTon + item.outputTon,
        alertCount: acc.alertCount + item.alertCount
      }), {
        farmCount: 0,
        fieldArea: 0,
        outputTon: 0,
        alertCount: 0
      });
      const raw = summaryQuery.data as unknown as Record<string, unknown> | undefined;
      /**
       * 取值优先级：后端接口值 → 真实明细聚合值 → null（显示「—」）。
       * 有明细行时聚合值可信，即使是 0 也照实显示（例如 0 条告警是真值）；
       * 既无接口值又无明细行，才判定为「没有数据」。
       */
      const pick = (key: string, aggregated: number): number | null => {
        const fromApi = Number(raw?.[key] ?? 0);
        if (Number.isFinite(fromApi) && fromApi > 0) {
          return fromApi;
        }
        if (rows.value.length > 0) {
          return aggregated;
        }
        return null;
      };
      const avgTaskRate = rows.value.length > 0 ? Number((rows.value.reduce((acc, item) => acc + item.taskRate, 0) / rows.value.length).toFixed(1)) : null;
      return {
        farmCount: pick('farmCount', totals.farmCount),
        fieldArea: pick('fieldArea', totals.fieldArea),
        outputTon: pick('outputTon', totals.outputTon),
        taskRate: (() => {
          const fromApi = Number(raw?.taskRate ?? 0);
          if (Number.isFinite(fromApi) && fromApi > 0) {
            return fromApi;
          }
          return avgTaskRate;
        })(),
        alertCount: pick('alertCount', totals.alertCount)
      };
    });

    /** 表格列定义 */
    const columns = computed<ColumnsType<OverviewRow>>(() => [{
      title: filter.value.dimension === 'tenant' ? '主体名称' : filter.value.dimension === 'crop' ? '作物' : '区域',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (value: string) => <Text strong>{value}</Text>
    }, {
      title: '农场数',
      dataIndex: 'farmCount',
      key: 'farmCount',
      sorter: (a, b) => a.farmCount - b.farmCount
    }, {
      title: '在田面积(亩)',
      dataIndex: 'fieldArea',
      key: 'fieldArea',
      sorter: (a, b) => a.fieldArea - b.fieldArea,
      render: (value: number) => Number(value).toLocaleString('zh-CN')
    }, {
      title: '本期产量(吨)',
      dataIndex: 'outputTon',
      key: 'outputTon',
      sorter: (a, b) => a.outputTon - b.outputTon,
      render: (value: number) => Number(value).toLocaleString('zh-CN')
    }, {
      title: '任务完成率',
      dataIndex: 'taskRate',
      key: 'taskRate',
      sorter: (a, b) => a.taskRate - b.taskRate,
      render: (value: number) => <Tag color={value >= 90 ? 'green' : value >= 85 ? 'blue' : 'orange'}>{value.toFixed(1)}%</Tag>
    }, {
      title: '告警数',
      dataIndex: 'alertCount',
      key: 'alertCount',
      sorter: (a, b) => a.alertCount - b.alertCount,
      render: (value: number) => <Tag color={value > 10 ? 'red' : value > 5 ? 'orange' : 'green'}>{value}</Tag>
    }]);

    /** 图表配置：区域 / 主体用柱状图，作物用饼图 */
    const chartOption = computed<EChartsOption>(() => {
      if (filter.value.dimension === 'crop') {
        return {
          tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} 亩 ({d}%)'
          },
          legend: {
            orient: 'vertical',
            left: 0,
            top: 12
          },
          series: [{
            type: 'pie',
            name: '在田面积',
            radius: ['42%', '68%'],
            center: ['55%', '52%'],
            data: rows.value.map(item => ({
              name: item.name,
              value: item.fieldArea
            })),
            label: {
              formatter: '{b}\n{d}%',
              color: 'inherit'
            }
          }]
        };
      }
      const sorted = [...rows.value].sort((a, b) => b.fieldArea - a.fieldArea);
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow'
          }
        },
        legend: {
          data: ['在田面积(亩)', '本期产量(吨)'],
          top: 0
        },
        grid: {
          left: 8,
          right: 16,
          top: 40,
          bottom: 8,
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: sorted.map(item => item.name),
          axisLabel: {
            interval: 0,
            rotate: 20
          }
        },
        yAxis: [{
          type: 'value',
          name: '面积(亩)'
        }, {
          type: 'value',
          name: '产量(吨)'
        }],
        series: [{
          type: 'bar',
          name: '在田面积(亩)',
          data: sorted.map(item => item.fieldArea),
          itemStyle: {
            color: '#13a05a',
            borderRadius: [4, 4, 0, 0]
          }
        }, {
          type: 'line',
          name: '本期产量(吨)',
          yAxisIndex: 1,
          smooth: true,
          data: sorted.map(item => item.outputTon),
          itemStyle: {
            color: '#1677ff'
          }
        }]
      };
    });

    /** 重置筛选条件 */
    const handleReset = (): void => {
      setFilter({
        startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
        endDate: dayjs().format('YYYY-MM-DD'),
        region: 'all',
        dimension: 'region',
        view: 'table'
      });
      message.success('筛选条件已重置');
    };
    return () => {
      return <div>
      <Row justify="space-between" align="middle" style={{
          marginBottom: 12
        }}>
        <Col>
          <Title level={4} style={{
              margin: 0
            }}>
            生产总览
          </Title>
          <Text type="secondary">
            {rowsQuery.data && rowsQuery.data.length > 0 ? '数据来源：平台生产数据聚合（/admin/dashboard/overview-rows）' : '后端未返回维度明细数据'}
          </Text>
        </Col>
      </Row>

      {/* 接口失败：显式列出失败端点，不用「示例口径」粉饰 */}
      {rowsQuery.isError || summaryQuery.isError ? <AntAlert style={{
          marginBottom: 12
        }} type="error" showIcon message="生产总览数据加载失败" description={[summaryQuery.isError ? `/admin/dashboard/overview：${(summaryQuery.error as Error | null)?.message ?? '未知错误'}` : null, rowsQuery.isError ? `/admin/dashboard/overview-rows：${(rowsQuery.error as Error | null)?.message ?? '未知错误'}` : null].filter((item): item is string => item !== null).join('；') || undefined} /> : null}

      {/* 后端返回空：空态要看得见，不是一行灰色小字 */}
      {!rowsQuery.isError && !summaryQuery.isError && !rowsQuery.isLoading && rows.value.length === 0 ? <AntAlert style={{
          marginBottom: 12
        }} type="info" showIcon message="后端未返回维度明细数据" description="汇总指标与明细列表均取后端真实接口；当前无数据，指标卡显示「—」、列表为空态，不使用示例数据兜底。" /> : null}

      {/* 筛选区 */}
      <Card size="small" style={{
          marginBottom: 12
        }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={8}>
            <Space>
              <Text>时间范围</Text>
              <DatePicker.RangePicker allowClear={false} value={rangeValue.value} onChange={dates => {
                  const start = dates?.[0];
                  const end = dates?.[1];
                  if (!start || !end) {
                    message.warning('请选择完整的时间范围');
                    return;
                  }
                  setFilter(prev => ({
                    ...prev,
                    startDate: dayjs(start).format('YYYY-MM-DD'),
                    endDate: dayjs(end).format('YYYY-MM-DD')
                  }));
                }} />
            </Space>
          </Col>
          <Col xs={24} md={6}>
            <Space>
              <Text>区域</Text>
              <Select style={{
                  width: 160
                }} value={filter.value.region} options={REGION_OPTIONS} onChange={value => setFilter(prev => ({
                  ...prev,
                  region: value
                }))} />
            </Space>
          </Col>
          <Col xs={24} md={6}>
            <Space>
              <Text>展示</Text>
              <Segmented value={filter.value.view} onChange={value => setFilter(prev => ({
                  ...prev,
                  view: value as ViewMode
                }))} options={[{
                  label: '表格',
                  value: 'table'
                }, {
                  label: '图表',
                  value: 'chart'
                }]} />
            </Space>
          </Col>
          <Col xs={24} md={4}>
            <Space>
              <Button onClick={handleReset}>重置</Button>
              <Tooltip title="刷新">
                <Button icon={<ReloadOutlined />} onClick={() => {
                    void queryClient.invalidateQueries();
                  }} />
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 汇总指标卡 */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            {summaryQuery.isLoading ? <Skeleton active title={false} paragraph={{
                rows: 2
              }} /> : <Statistic title="纳入统计农场" value={summary.value.farmCount ?? '—'} suffix={summary.value.farmCount === null ? undefined : '个'} formatter={(arg: any) => { const raw = arg && typeof arg === 'object' && 'value' in arg ? arg.value : arg; return typeof raw === 'number' ? Number(raw).toLocaleString('zh-CN') : String(raw ?? '—'); }} />}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="在田面积" value={summary.value.fieldArea === null ? '—' : Number((summary.value.fieldArea / 10000).toFixed(1))} suffix={summary.value.fieldArea === null ? undefined : '万亩'} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="本期产量" value={summary.value.outputTon ?? '—'} suffix={summary.value.outputTon === null ? undefined : '吨'} formatter={(arg: any) => { const raw = arg && typeof arg === 'object' && 'value' in arg ? arg.value : arg; return typeof raw === 'number' ? Number(raw).toLocaleString('zh-CN') : String(raw ?? '—'); }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="平均任务完成率" value={summary.value.taskRate ?? '—'} precision={1} suffix={summary.value.taskRate === null ? undefined : '%'} valueStyle={{
                color: summary.value.taskRate === null ? undefined : summary.value.taskRate >= 88 ? '#13a05a' : '#faad14'
              }} />
          </Card>
        </Col>
      </Row>

      {/* 维度切换 + 明细区 */}
      <Card size="small" style={{
          marginTop: 12
        }} title={<Segmented value={filter.value.dimension} onChange={value => setFilter(prev => ({
          ...prev,
          dimension: value as Dimension
        }))} options={[{
          label: '按区域',
          value: 'region'
        }, {
          label: '按作物',
          value: 'crop'
        }, {
          label: '按主体',
          value: 'tenant'
        }]} />} extra={<Text type="secondary">
            统计区间 {filter.value.startDate} ~ {filter.value.endDate} · 共 {rows.value.length} 个
            {filter.value.dimension === 'tenant' ? '主体' : filter.value.dimension === 'crop' ? '作物' : '区域'}
          </Text>}>
        {rowsQuery.isLoading ? <Skeleton active paragraph={{
            rows: 8
          }} /> : rows.value.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={rowsQuery.isError ? '维度明细接口加载失败，暂无数据（不使用示例数据兜底）' : '后端未返回该维度明细数据（不使用示例数据兜底）'} /> : filter.value.view === 'table' ? <div class="production-list-dense production-member-list">
            <Table rowKey="name" size="small" columns={columns.value} dataSource={rows.value} rowSelection={{}} columnSettingsStorageKey={`agri:production:visible-columns:v1:admin-ops-overview:${filter.value.dimension}`} columnWidthStorageKey={`agri:production:column-widths:v1:admin-ops-overview:${filter.value.dimension}`} onRefresh={() => void rowsQuery.refetch()} pagination={{
              defaultPageSize: 20,
              showSizeChanger: true
            }} scroll={{
              x: 800
            }} />
          </div> : <ReactECharts option={chartOption.value} style={{
            height: 380
          }} notMerge />}
      </Card>
    </div>;
    };
  }
});
export default OpsProductionOverview;
