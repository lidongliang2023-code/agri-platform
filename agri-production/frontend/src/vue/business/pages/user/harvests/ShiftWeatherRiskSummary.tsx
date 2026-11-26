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
import RiskBatchPreviewModal from './RiskBatchPreviewModal';
import { Alert, Button, Card, Empty, Select, Space, Statistic, Table, Tag, Typography } from '@/vue/ui';
import type { RiskBatchApplyResult, HarvestWeatherInfo, HarvestWindowDispatch } from '@/api/harvest-window';
import { formatRiskTime, summarizeShiftWeather } from '@/pages/user/harvests/shift-weather-risk';
import type { ShiftRiskStatus, ShiftWeatherRisk } from '@/pages/user/harvests/shift-weather-risk';
const META: Record<ShiftRiskStatus, {
  label: string;
  color: string;
}> = {
  RISK: {
    label: '天气风险',
    color: 'orange'
  },
  MISSING: {
    label: '数据缺测',
    color: 'error'
  },
  PENDING: {
    label: '待核验 / 待重排',
    color: 'warning'
  },
  INVALID: {
    label: '班次无效',
    color: 'error'
  },
  CLEAR: {
    label: '天气条件满足',
    color: 'success'
  },
  INACTIVE: {
    label: '不计入待执行',
    color: 'default'
  }
};
interface Props {
  planId: string;
  planVersion: number;
  planStatus: string;
  dispatches: HarvestWindowDispatch[];
  weather?: HarvestWeatherInfo;
  onLocate: (dispatch: HarvestWindowDispatch) => void;
  onApplied: () => void;
}
const ShiftWeatherRiskSummary = defineComponent({
  name: "ShiftWeatherRiskSummary",
  props: {
    planId: null as unknown as PropType<{
      planId: string;
      planVersion: number;
      planStatus: string;
      dispatches: HarvestWindowDispatch[];
      weather?: HarvestWeatherInfo;
      onLocate: (dispatch: HarvestWindowDispatch) => void;
      onApplied: () => void;
    }["planId"]>,
    planVersion: null as unknown as PropType<{
      planId: string;
      planVersion: number;
      planStatus: string;
      dispatches: HarvestWindowDispatch[];
      weather?: HarvestWeatherInfo;
      onLocate: (dispatch: HarvestWindowDispatch) => void;
      onApplied: () => void;
    }["planVersion"]>,
    planStatus: null as unknown as PropType<{
      planId: string;
      planVersion: number;
      planStatus: string;
      dispatches: HarvestWindowDispatch[];
      weather?: HarvestWeatherInfo;
      onLocate: (dispatch: HarvestWindowDispatch) => void;
      onApplied: () => void;
    }["planStatus"]>,
    dispatches: null as unknown as PropType<{
      planId: string;
      planVersion: number;
      planStatus: string;
      dispatches: HarvestWindowDispatch[];
      weather?: HarvestWeatherInfo;
      onLocate: (dispatch: HarvestWindowDispatch) => void;
      onApplied: () => void;
    }["dispatches"]>,
    weather: null as unknown as PropType<{
      planId: string;
      planVersion: number;
      planStatus: string;
      dispatches: HarvestWindowDispatch[];
      weather?: HarvestWeatherInfo;
      onLocate: (dispatch: HarvestWindowDispatch) => void;
      onApplied: () => void;
    }["weather"]>,
    onLocate: null as unknown as PropType<{
      planId: string;
      planVersion: number;
      planStatus: string;
      dispatches: HarvestWindowDispatch[];
      weather?: HarvestWeatherInfo;
      onLocate: (dispatch: HarvestWindowDispatch) => void;
      onApplied: () => void;
    }["onLocate"]>,
    onApplied: null as unknown as PropType<{
      planId: string;
      planVersion: number;
      planStatus: string;
      dispatches: HarvestWindowDispatch[];
      weather?: HarvestWeatherInfo;
      onLocate: (dispatch: HarvestWindowDispatch) => void;
      onApplied: () => void;
    }["onApplied"]>
  },
  setup(__props: {
    planId: string;
    planVersion: number;
    planStatus: string;
    dispatches: HarvestWindowDispatch[];
    weather?: HarvestWeatherInfo;
    onLocate: (dispatch: HarvestWindowDispatch) => void;
    onApplied: () => void;
  }, {
    slots: __slots
  }) {
    const selectedKeys = shallowRef<string[]>([]);
    const setSelectedKeys = (next: typeof selectedKeys.value | ((previous: typeof selectedKeys.value) => typeof selectedKeys.value)) => {
      selectedKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedKeys.value) => typeof selectedKeys.value)(selectedKeys.value) : next;
    };
    const batchOpen = shallowRef(false);
    const setBatchOpen = (next: typeof batchOpen.value | ((previous: typeof batchOpen.value) => typeof batchOpen.value)) => {
      batchOpen.value = typeof next === 'function' ? (next as (previous: typeof batchOpen.value) => typeof batchOpen.value)(batchOpen.value) : next;
    };
    const appliedResult = shallowRef<RiskBatchApplyResult>();
    const setAppliedResult = (next: typeof appliedResult.value | ((previous: typeof appliedResult.value) => typeof appliedResult.value)) => {
      appliedResult.value = typeof next === 'function' ? (next as (previous: typeof appliedResult.value) => typeof appliedResult.value)(appliedResult.value) : next;
    };
    const dateFilter = shallowRef('ALL');
    const setDateFilter = (next: typeof dateFilter.value | ((previous: typeof dateFilter.value) => typeof dateFilter.value)) => {
      dateFilter.value = typeof next === 'function' ? (next as (previous: typeof dateFilter.value) => typeof dateFilter.value)(dateFilter.value) : next;
    };
    const riskFilter = shallowRef('ATTENTION');
    const setRiskFilter = (next: typeof riskFilter.value | ((previous: typeof riskFilter.value) => typeof riskFilter.value)) => {
      riskFilter.value = typeof next === 'function' ? (next as (previous: typeof riskFilter.value) => typeof riskFilter.value)(riskFilter.value) : next;
    };
    const rows = computed(() => summarizeShiftWeather(__props.dispatches, __props.weather));
    const dates = computed(() => [...new Set(__props.dispatches.map(dispatch => dispatch.dispatchDate))].sort());
    const selectedDate = computed(() => dates.value.includes(dateFilter.value) ? dateFilter.value : 'ALL');
    const scope = computed(() => rows.value.filter(row => selectedDate.value === 'ALL' || row.dispatch.dispatchDate === selectedDate.value));
    const active = computed(() => scope.value.filter(row => row.active));
    const affected = computed(() => active.value.filter(row => row.status !== 'CLEAR'));
    const visible = computed(() => scope.value.filter(row => riskFilter.value === 'ALL' || (riskFilter.value === 'ATTENTION' ? row.active && row.status !== 'CLEAR' : row.status === riskFilter.value)));
    const selectable = computed(() => visible.value.filter(row => row.active && row.status !== 'CLEAR' && Boolean(row.dispatch.id)));
    const selectableIds = computed(() => selectable.value.map(row => row.dispatch.id as string));
    const selectedIds = computed(() => selectedKeys.value.filter(key => selectableIds.value.includes(key)).slice(0, 50));
    const selectionContext = computed(() => JSON.stringify([__props.planVersion, __props.dispatches, __props.weather]));
    onMounted(() => {
      watch(() => [selectionContext.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setSelectedKeys([]);
          setBatchOpen(false);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const previewEnabled = computed(() => ['APPROVED', 'PUBLISHED'].includes(__props.planStatus));
    return () => {
      return <Card class="hw-shift-risk-summary" size="small" title="班次风险汇总" extra={<Typography.Text type="secondary">快照 {__props.weather?.snapshotId ?? '未获取'} · 北京时间</Typography.Text>}>
    {appliedResult.value && <Alert style={{
          marginBottom: 14
        }} type="success" showIcon closable onClose={() => setAppliedResult(undefined)} message={`负责人已确认应用 ${appliedResult.value.appliedCount} 单 · V${appliedResult.value.newVersion} · 待重新发布`} description={<Space direction="vertical" style={{
          width: '100%'
        }}><span>批次 {appliedResult.value.batchId} · 确认人 {appliedResult.value.confirmedBy} · {appliedResult.value.confirmedAt.replace('T', ' ')}；无需重排 {appliedResult.value.unchangedCount} 单保持原安排。</span><span>请在计划操作区重新发布，发布前不能执行回写。确认记录可在“回写与留痕”查询。</span>{appliedResult.value.changes.map(change => <Typography.Text key={change.sourceDispatchId}>{change.plotName} · {change.newDate} · {Number(change.area).toFixed(2)} 亩；原单 {change.sourceDispatchId} → 接续单 {change.continuationDispatchId}</Typography.Text>)}</Space>} />}
    <Space wrap class="hw-risk-filters">
      <Select aria-label="班次风险日期筛选" value={selectedDate.value} style={{
            width: 180
          }} options={[{
            value: 'ALL',
            label: '全部派单日期'
          }, ...dates.value.map(date => ({
            value: date,
            label: date
          }))]} onChange={value => {
            setDateFilter(value);
            setSelectedKeys([]);
            setBatchOpen(false);
          }} />
      <Select aria-label="班次风险状态筛选" value={riskFilter.value} style={{
            width: 200
          }} options={[{
            value: 'ATTENTION',
            label: '需关注的待执行班次'
          }, {
            value: 'ALL',
            label: '全部班次（含历史）'
          }, ...Object.entries(META).map(([value, meta]) => ({
            value,
            label: meta.label
          }))]} onChange={value => {
            setRiskFilter(value);
            setSelectedKeys([]);
            setBatchOpen(false);
          }} />
      <Button disabled={!previewEnabled.value || !selectable.value.length} onClick={() => setSelectedKeys(selectableIds.value.slice(0, 50))}>勾选当前风险结果</Button>
      <Button type="primary" disabled={!previewEnabled.value || !selectedIds.value.length} onClick={() => setBatchOpen(true)}>批量预览重排（{selectedIds.value.length}）</Button>
      <Button disabled={!selectedIds.value.length} onClick={() => setSelectedKeys([])}>清空勾选</Button>
      <Typography.Text type="secondary">仅选择当前筛选内需关注的班次，最多50单；{previewEnabled.value ? '进行中或故障单在预览内说明阻塞原因' : '计划确认后可预览'}</Typography.Text>
    </Space>
    <div class="hw-risk-metrics">
      <Statistic title="待执行 / 进行中 / 故障阻塞" value={active.value.length} suffix="单" />
      <Statistic title="需关注班次" value={affected.value.length} suffix="单" />
      <Statistic title="受影响剩余面积" value={affected.value.reduce((sum, row) => sum + row.remainingArea, 0)} precision={2} suffix="亩" />
      <Statistic title="受影响计划用工" value={affected.value.reduce((sum, row) => sum + Number(row.dispatch.people || 0), 0)} suffix="人次" />
    </div>
    <Space wrap class="hw-risk-counts">{(['RISK', 'MISSING', 'PENDING', 'INVALID', 'CLEAR'] as const).map(status => <Tag color={META[status].color} key={status}>{META[status].label} {active.value.filter(row => row.status === status).length} 单</Tag>)}</Space>
    <Alert type="info" showIcon message="汇总仅作天气风险展示，不能作为开工授权" description="已完成、已转接续和下一周期待复核单不计入待执行统计；工时段数按派单分别累计，用工为人次，不代表去重人数。小时条件满足仍须核验整日避雨、恢复期、人员农机资源与派单状态。" />
    <Table size="small" rowKey={row => row.dispatch.id ?? row.key} rowSelection={{
          selectedRowKeys: selectedIds.value,
          onChange: keys => setSelectedKeys(keys.map(String).slice(0, 50)),
          getCheckboxProps: row => ({
            disabled: !previewEnabled.value || !selectableIds.value.includes(row.dispatch.id ?? '') || selectedIds.value.length >= 50 && !selectedIds.value.includes(row.dispatch.id ?? '')
          })
        }} class="hw-risk-table" scroll={{
          x: 1150
        }} pagination={{
          pageSize: 8,
          hideOnSinglePage: true,
          showSizeChanger: false
        }} dataSource={visible.value} locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={rows.value.length ? '当前筛选下没有班次；可切换全部查看历史记录' : '暂无采收派单'} />
        }} columns={[{
          title: '日期 / 地块',
          key: 'dispatch',
          width: 175,
          render: (_, row) => <Space direction="vertical" size={0}><span>{row.dispatch.dispatchDate}</span><Typography.Text strong>{row.dispatch.plotName}</Typography.Text></Space>
        }, {
          title: '实际班次',
          key: 'shift',
          width: 145,
          render: (_, row) => `${row.dispatch.shiftStart ?? '缺失'}–${row.dispatch.shiftEnd ?? '缺失'}`
        }, {
          title: '天气汇总',
          key: 'status',
          width: 160,
          render: (_, row: ShiftWeatherRisk) => <Tag color={META[row.status].color}>{META[row.status].label}</Tag>
        }, {
          title: '班次小时区间',
          key: 'hours',
          width: 175,
          render: (_, row) => <Space direction="vertical" size={0}><span>覆盖 {row.hours} · 风险 {row.riskHours}</span><span>缺测 {row.missingHours} · 待核验 {row.pendingHours}</span>{row.riskHours > 0 && <Typography.Text type="secondary">风险重叠 {(row.riskMinutes / 60).toFixed(2)} 小时</Typography.Text>}</Space>
        }, {
          title: '原因 / 实际重叠时段',
          key: 'reasons',
          render: (_, row) => <Space direction="vertical" size={2}>{row.reasons.map((reason: string) => <span key={reason}>{reason}</span>)}{row.periods.map((period: ShiftWeatherRisk['periods'][number], index: number) => <Typography.Text type={period.kind === 'risk' ? 'warning' : 'secondary'} key={index}>{formatRiskTime(period.start)}–{formatRiskTime(period.end)} · {period.reason}</Typography.Text>)}{!row.reasons.length && <Typography.Text type="secondary">当前天气条件满足，开工以服务端核验为准</Typography.Text>}{!row.active && <Typography.Text type="secondary">历史或已转出派单，仅供查询，不计入受影响统计</Typography.Text>}</Space>
        }, {
          title: '操作',
          key: 'locate',
          width: 100,
          fixed: 'right',
          render: (_, row) => <Button type="link" size="small" aria-label={`定位${row.dispatch.plotName} ${row.dispatch.dispatchDate}班次风险天气`} onClick={() => __props.onLocate(row.dispatch)}>查看天气</Button>
        }]} />
    <RiskBatchPreviewModal open={batchOpen.value} planId={__props.planId} dispatchIds={selectedIds.value} dispatchLabels={Object.fromEntries(__props.dispatches.filter(d => d.id).map(d => [d.id as string, `${d.plotName} · ${d.dispatchDate}`]))} context={selectionContext.value} onApplied={result => {
          setAppliedResult(result);
          setBatchOpen(false);
          setSelectedKeys([]);
          __props.onApplied();
        }} onClose={() => setBatchOpen(false)} />
  </Card>;
    };
  }
});
export default ShiftWeatherRiskSummary;
