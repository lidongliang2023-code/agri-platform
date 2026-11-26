
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
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { Alert, App as AntdApp, Button, Card, DatePicker, Descriptions, Divider, Empty, Input, Modal, Progress, Select, Space, Statistic, Table, Tag, Typography } from '@/vue/ui';
import { CheckCircleOutlined, ExperimentOutlined, FileTextOutlined, RobotOutlined, SendOutlined, TeamOutlined, ThunderboltOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import { PageContainer } from '@/vue/pro';
import useFarmStore from '@/vue/farmStore';
import { applyFaultReschedule, approveHarvestWindow, getHarvestWindowOverview, previewFaultReschedule, publishHarvestWindow, refreshHarvestWeather, verifyHarvestWeather, solveHarvestWindow, updateHarvestWindowProgress } from '@/api/harvest-window';
import type { RescheduleBenefitInput, DispatchStatus, FaultFallbackMode, FaultReschedulePreview, HarvestWindowDispatch, HarvestWindowPlot, HarvestWeatherHour } from '@/api/harvest-window';
import HourlyWeatherTrend from './HourlyWeatherTrend';
import ShiftWeatherRiskSummary from './ShiftWeatherRiskSummary';
import { RescheduleBenefitEditor, RescheduleBenefitHistory, RescheduleBenefitView } from './RescheduleBenefit';
import { overlappingWeatherShifts, weatherDispatchKey, weatherShifts } from '@/pages/user/harvests/hourly-weather-shifts';
import { RescheduleComparisonHistory, RescheduleComparisonView } from './RescheduleComparison';
import '@/pages/user/harvests/HarvestWindowDecision.css';
function dispatchMeta(status: DispatchStatus): {
  label: string;
  color: string;
} {
  if (status === 'RESCHEDULED') return {
    label: '已转接续单',
    color: 'default'
  };
  if (status === 'DEFERRED') return {
    label: '下一周期待复核',
    color: 'warning'
  };
  if (status === 'BLOCKED') return {
    label: '故障阻塞',
    color: 'error'
  };
  if (status === 'DONE') return {
    label: '已完成',
    color: 'success'
  };
  if (status === 'RUNNING') return {
    label: '进行中',
    color: 'processing'
  };
  return {
    label: '待执行',
    color: 'default'
  };
}
const HarvestWindowDecision = defineComponent({
  name: "HarvestWindowDecision",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
      message
    } = AntdApp.useApp();
    const farmId = useFarmStore(state => state.currentFarm?.farmId);
    function requireFarmId(): string { if(!farmId.value) throw new Error('请先选择农场'); return farmId.value }
    const queryClient = useQueryClient();
    const hourDate = shallowRef(dayjs().format('YYYY-MM-DD'));
    const setHourDate = (next: typeof hourDate.value | ((previous: typeof hourDate.value) => typeof hourDate.value)) => {
      hourDate.value = typeof next === 'function' ? (next as (previous: typeof hourDate.value) => typeof hourDate.value)(hourDate.value) : next;
    };
    const shiftSelection = shallowRef<{
      farmId: string;
      planId: string;
      date: string;
      key: string;
    }>();
    const setShiftSelection = (next: typeof shiftSelection.value | ((previous: typeof shiftSelection.value) => typeof shiftSelection.value)) => {
      shiftSelection.value = typeof next === 'function' ? (next as (previous: typeof shiftSelection.value) => typeof shiftSelection.value)(shiftSelection.value) : next;
    };
    const weatherAnchor = shallowRef<HTMLDivElement | null>(null);
    const dispatchAnchor = shallowRef<HTMLDivElement | null>(null);
    const navigationSequence = shallowRef(0);
    const weatherLocation = shallowRef<{
      farmId: string;
      planId: string;
      key: string;
    }>();
    const setWeatherLocation = (next: typeof weatherLocation.value | ((previous: typeof weatherLocation.value) => typeof weatherLocation.value)) => {
      weatherLocation.value = typeof next === 'function' ? (next as (previous: typeof weatherLocation.value) => typeof weatherLocation.value)(weatherLocation.value) : next;
    };
    const weatherNavigation = shallowRef<{
      farmId: string;
      planId: string;
      target: 'weather' | 'dispatch';
      sequence: number;
    }>();
    const setWeatherNavigation = (next: typeof weatherNavigation.value | ((previous: typeof weatherNavigation.value) => typeof weatherNavigation.value)) => {
      weatherNavigation.value = typeof next === 'function' ? (next as (previous: typeof weatherNavigation.value) => typeof weatherNavigation.value)(weatherNavigation.value) : next;
    };
    const tab = shallowRef<'decision' | 'dispatch' | 'audit'>('decision');
    const setTab = (next: typeof tab.value | ((previous: typeof tab.value) => typeof tab.value)) => {
      tab.value = typeof next === 'function' ? (next as (previous: typeof tab.value) => typeof tab.value)(tab.value) : next;
    };
    const approveOpen = shallowRef(false);
    const setApproveOpen = (next: typeof approveOpen.value | ((previous: typeof approveOpen.value) => typeof approveOpen.value)) => {
      approveOpen.value = typeof next === 'function' ? (next as (previous: typeof approveOpen.value) => typeof approveOpen.value)(approveOpen.value) : next;
    };
    const approveReason = shallowRef('已核验成熟度、天气窗口和单日工时上限，同意按建议执行');
    const setApproveReason = (next: typeof approveReason.value | ((previous: typeof approveReason.value) => typeof approveReason.value)) => {
      approveReason.value = typeof next === 'function' ? (next as (previous: typeof approveReason.value) => typeof approveReason.value)(approveReason.value) : next;
    };
    const rescheduleOpen = shallowRef(false);
    const setRescheduleOpen = (next: typeof rescheduleOpen.value | ((previous: typeof rescheduleOpen.value) => typeof rescheduleOpen.value)) => {
      rescheduleOpen.value = typeof next === 'function' ? (next as (previous: typeof rescheduleOpen.value) => typeof rescheduleOpen.value)(rescheduleOpen.value) : next;
    };
    const faultId = shallowRef<string>();
    const setFaultId = (next: typeof faultId.value | ((previous: typeof faultId.value) => typeof faultId.value)) => {
      faultId.value = typeof next === 'function' ? (next as (previous: typeof faultId.value) => typeof faultId.value)(faultId.value) : next;
    };
    const readyDate = shallowRef(dayjs().format('YYYY-MM-DD'));
    const setReadyDate = (next: typeof readyDate.value | ((previous: typeof readyDate.value) => typeof readyDate.value)) => {
      readyDate.value = typeof next === 'function' ? (next as (previous: typeof readyDate.value) => typeof readyDate.value)(readyDate.value) : next;
    };
    const fallbackMode = shallowRef<FaultFallbackMode>('EXTEND_WINDOW');
    const setFallbackMode = (next: typeof fallbackMode.value | ((previous: typeof fallbackMode.value) => typeof fallbackMode.value)) => {
      fallbackMode.value = typeof next === 'function' ? (next as (previous: typeof fallbackMode.value) => typeof fallbackMode.value)(fallbackMode.value) : next;
    };
    const fallbackDate = shallowRef<string>();
    const setFallbackDate = (next: typeof fallbackDate.value | ((previous: typeof fallbackDate.value) => typeof fallbackDate.value)) => {
      fallbackDate.value = typeof next === 'function' ? (next as (previous: typeof fallbackDate.value) => typeof fallbackDate.value)(fallbackDate.value) : next;
    };
    const reason = shallowRef('');
    const setReason = (next: typeof reason.value | ((previous: typeof reason.value) => typeof reason.value)) => {
      reason.value = typeof next === 'function' ? (next as (previous: typeof reason.value) => typeof reason.value)(reason.value) : next;
    };
    const preview = shallowRef<FaultReschedulePreview>();
    const setPreview = (next: typeof preview.value | ((previous: typeof preview.value) => typeof preview.value)) => {
      preview.value = typeof next === 'function' ? (next as (previous: typeof preview.value) => typeof preview.value)(preview.value) : next;
    };
    const faultBenefitInputs = shallowRef<Record<string, RescheduleBenefitInput>>({});
    const setFaultBenefitInputs = (next: typeof faultBenefitInputs.value | ((previous: typeof faultBenefitInputs.value) => typeof faultBenefitInputs.value)) => {
      faultBenefitInputs.value = typeof next === 'function' ? (next as (previous: typeof faultBenefitInputs.value) => typeof faultBenefitInputs.value)(faultBenefitInputs.value) : next;
    };
    const faultBenefitSignature = shallowRef('');
    const setFaultBenefitSignature = (next: typeof faultBenefitSignature.value | ((previous: typeof faultBenefitSignature.value) => typeof faultBenefitSignature.value)) => {
      faultBenefitSignature.value = typeof next === 'function' ? (next as (previous: typeof faultBenefitSignature.value) => typeof faultBenefitSignature.value)(faultBenefitSignature.value) : next;
    };
    const overviewQuery = useQuery(() => ({
      queryKey: ['harvest-window-overview', farmId.value],
      enabled: Boolean(farmId.value),
      queryFn: () => getHarvestWindowOverview(farmId.value as string)
    }));
    const overview = computed(() => overviewQuery.data);
    const plan = computed(() => overview.value?.latestPlan);
    onMounted(() => {
      watch(() => [farmId.value, plan.value?.id, plan.value?.version, faultId.value, readyDate.value, fallbackMode.value, fallbackDate.value, rescheduleOpen.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setFaultBenefitInputs({});
          setPreview(undefined);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      const _weatherNavigationAtStart = weatherNavigation.value;
      watch(() => [_weatherNavigationAtStart, farmId.value, plan.value?.id], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!_weatherNavigationAtStart || _weatherNavigationAtStart.farmId !== farmId.value || _weatherNavigationAtStart.planId !== plan.value?.id) return;
          const frame = requestAnimationFrame(() => {
            const anchor = _weatherNavigationAtStart.target === 'weather' ? weatherAnchor.value : dispatchAnchor.value;
            anchor?.focus({
              preventScroll: true
            });
            anchor?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
              block: 'start'
            });
          });
          return () => cancelAnimationFrame(frame);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const refresh = () => void queryClient.invalidateQueries({
      queryKey: ['harvest-window-overview', farmId.value]
    });
    const weatherMutation = useMutation(() => ({
      mutationFn: () => refreshHarvestWeather(farmId.value as string),
      onSuccess: result => {
        setPreview(undefined);
        refresh();
        if (result.usable) message.success('真实天气已刷新并保存快照');else message.warning(result.error || '未能取得有效预报');
      },
      onError: (error: Error) => message.error(error.message || '天气刷新失败')
    }));
    const verifyWeatherMutation = useMutation(() => ({
      mutationFn: () => verifyHarvestWeather(plan.value?.id ?? ''),
      onSuccess: () => {
        setPreview(undefined);
        refresh();
        message.success('待执行派单天气已核验并留痕');
      },
      onError: (error: Error) => message.error(error.message || '天气核验未通过')
    }));
    const solveMutation = useMutation(() => ({
      mutationFn: () => {
        if (!overview.value || !farmId.value) throw new Error('当前农场数据尚未准备好');
        return solveHarvestWindow({
          farmId: requireFarmId(),
          windowStart: dayjs().format('YYYY-MM-DD'),
          windowEnd: dayjs().add(6, 'day').format('YYYY-MM-DD'),
          weather: overview.value.weather,
          resources: overview.value.resources,
          plots: overview.value.plots,
          note: '按成熟度、天气、价格和资源约束重新计算'
        });
      },
      onSuccess: () => {
        message.success('采收窗口已重新推理');
        refresh();
      },
      onError: (error: Error) => message.error(error.message || '重新推理失败')
    }));
    const approveMutation = useMutation(() => ({
      mutationFn: () => approveHarvestWindow(plan.value?.id ?? '', approveReason.value),
      onSuccess: () => {
        setApproveOpen(false);
        message.success('已记录基地负责人确认');
        refresh();
      },
      onError: (error: Error) => message.error(error.message || '确认失败')
    }));
    const publishMutation = useMutation(() => ({
      mutationFn: () => publishHarvestWindow(plan.value?.id ?? ''),
      onSuccess: () => {
        message.success('采收计划、用工派单和农机调度已发布');
        refresh();
      },
      onError: (error: Error) => message.error(error.message || '发布失败')
    }));
    const progressMutation = useMutation(() => ({
      mutationFn: ({
        id,
        status
      }: {
        id: string;
        status: DispatchStatus;
      }) => updateHarvestWindowProgress(plan.value?.id ?? '', id, {
        status
      }),
      onSuccess: () => {
        message.success('派单进度已回写');
        refresh();
      },
      onError: (error: Error) => message.error(error.message || '进度回写失败')
    }));
    const previewMutation = useMutation(() => ({
      mutationFn: () => {
        if (!plan.value || !faultId.value) throw new Error('请选择故障单');
        return previewFaultReschedule(plan.value.id, {
          faultId: faultId.value,
          readyDate: readyDate.value,
          fallbackMode: fallbackMode.value,
          benefitInputs: faultBenefitInputs.value,
          ...(fallbackMode.value === 'EXTEND_WINDOW' && fallbackDate.value ? {
            fallbackDate: fallbackDate.value
          } : {})
        });
      },
      onSuccess: result => {
        setPreview(result);
        setFaultBenefitSignature(JSON.stringify(faultBenefitInputs.value));
      },
      onError: (error: Error) => {
        setPreview(undefined);
        message.error(error.message || '重排预览失败');
      }
    }));
    const applyMutation = useMutation(() => ({
      mutationFn: () => {
        if (!plan.value || !preview.value || !reason.value.trim() || faultBenefitSignature.value !== JSON.stringify(faultBenefitInputs.value)) throw new Error('请先预览并填写负责人确认说明');
        return applyFaultReschedule(plan.value.id, {
          benefitInputs: faultBenefitInputs.value,
          faultId: preview.value.faultId,
          readyDate: preview.value.readyDate,
          fallbackMode: preview.value.fallbackMode,
          ...(preview.value.fallbackDate ? {
            fallbackDate: preview.value.fallbackDate
          } : {}),
          fingerprint: preview.value.fingerprint,
          reason: reason.value
        });
      },
      onSuccess: () => {
        setRescheduleOpen(false);
        setPreview(undefined);
        message.success('窗口外兜底方案已确认并留痕');
        refresh();
      },
      onError: (error: Error) => {
        setPreview(undefined);
        message.error(error.message || '应用失败，请重新预览');
      }
    }));
    return () => {
      const _shiftSelectionAtStart = shiftSelection.value;
      const _weatherLocationAtStart = weatherLocation.value;
      if (!farmId.value) return <PageContainer title="采收窗口决策与用工协同排程"><Empty description="请先在顶部选择当前农场" /></PageContainer>;
      const plots = plan.value?.plots ?? overview.value?.plots ?? [];
      const dispatches = plan.value?.dispatches ?? [];
      const faults = dispatches.flatMap(dispatch => (dispatch.machineFaults ?? []).map(fault => ({
        value: fault.id,
        label: `${dispatch.plotName} · ${fault.machineName} · ${fault.status === 'OPEN' ? '待处置' : '已处置'}`
      })));
      const canExecute = plan.value?.status === 'APPROVED' || plan.value?.status === 'PUBLISHED';
      const busy = previewMutation.isPending || applyMutation.isPending;
      const weatherInfo = overview.value?.weatherInfo;
      const weatherReady = Boolean(weatherInfo?.usable);
      const hourDates = Array.from(new Set([...(weatherInfo?.days ?? []).map(day => day.date), ...dispatches.map(dispatch => dispatch.dispatchDate), ...(weatherInfo?.hours ?? []).map(hour => hour.periodStart.slice(0, 10))])).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
      const selectedHourDate = hourDates.includes(hourDate.value) ? hourDate.value : hourDates.find(date => !dayjs(date).isBefore(dayjs(), 'day')) ?? hourDates[hourDates.length - 1] ?? dayjs().format('YYYY-MM-DD');
      const selectedHours = (weatherInfo?.hours ?? []).filter(hour => hour.periodStart.startsWith(selectedHourDate)).sort((a, b) => a.periodStart.localeCompare(b.periodStart));
      const dayShifts = weatherShifts(selectedHourDate, dispatches);
      const locatedDispatch = _weatherLocationAtStart?.farmId === farmId.value && _weatherLocationAtStart.planId === plan.value?.id ? dispatches.find((dispatch, index) => weatherDispatchKey(dispatch, index) === _weatherLocationAtStart.key) : undefined;
      const locationShift = locatedDispatch ? weatherShifts(locatedDispatch.dispatchDate, dispatches).shifts.find(shift => shift.key === _weatherLocationAtStart?.key) : undefined;
      const locationNotice = locatedDispatch && !locationShift ? ['RESCHEDULED', 'DEFERRED'].includes(locatedDispatch.status) ? '该派单已转接续或下一周期待复核，仅查看原日期天气，不高亮执行班次。' : '该派单班次缺失、无效或跨夜，仅定位日期，不生成默认班次。' : undefined;
      const selectedShiftKey = locatedDispatch && locatedDispatch.dispatchDate === selectedHourDate && !locationShift ? '__NONE__' : _shiftSelectionAtStart?.farmId === farmId.value && _shiftSelectionAtStart.planId === plan.value?.id && _shiftSelectionAtStart.date === selectedHourDate && dayShifts.shifts.some(shift => shift.key === _shiftSelectionAtStart.key) ? _shiftSelectionAtStart.key : '__ALL__';
      const highlightedShifts = selectedShiftKey === '__ALL__' ? dayShifts.shifts : dayShifts.shifts.filter(shift => shift.key === selectedShiftKey);
      const navigateWeather = (target: 'weather' | 'dispatch') => {
        if (!plan.value || !farmId.value) return;
        setWeatherNavigation({
          farmId: requireFarmId(),
          planId: plan.value.id,
          target,
          sequence: ++navigationSequence.value
        });
      };
      const locateDispatchWeather = (row: HarvestWindowDispatch) => {
        if (!plan.value || !farmId.value) return;
        const index = dispatches.indexOf(row);
        const key = weatherDispatchKey(row, index);
        setHourDate(row.dispatchDate);
        setShiftSelection({
          farmId: requireFarmId(),
          planId: plan.value.id,
          date: row.dispatchDate,
          key
        });
        setWeatherLocation({
          farmId: requireFarmId(),
          planId: plan.value.id,
          key
        });
        navigateWeather('weather');
      };
      const dispatchWeatherReason = (row: HarvestWindowDispatch): string | undefined => {
        if (row.status !== 'PLANNED') return undefined;
        if (row.weatherBlockReason) return row.weatherBlockReason;
        if (dayjs(row.dispatchDate).isBefore(dayjs(), 'day')) return '原日期已过，需重排';
        if (!weatherReady) return '真实天气待刷新或已过期';
        const weather = weatherInfo?.days.find(day => day.date === row.dispatchDate);
        if (!weather) return '超出真实预报范围，待核验';
        return weather.usable ? undefined : weather.note;
      };
      return <PageContainer class="harvest-window-page" title="采收窗口决策与用工协同排程" subTitle="生产管理 · 场景 204 · AI 场景域">
    <div class="hw-header-actions"><Tag color="red">优先级 P0</Tag><Button icon={<FileTextOutlined />} onClick={() => setTab('audit')}>查看留痕</Button><Button type="primary" icon={<RobotOutlined />} loading={solveMutation.isPending} disabled={!weatherReady || weatherMutation.isPending} onClick={() => solveMutation.mutate()}>重新推理</Button></div>
    <Card class="hw-hero" bordered={false}><div class="hw-hero-icon"><ExperimentOutlined /></div><div class="hw-hero-copy"><Tag color="cyan">AI 能力</Tag><Typography.Title level={4}>把成熟度、天气、价格和用工放在一起算</Typography.Title><Typography.Paragraph>输出最佳采收日、每日采收面积、用工需求与农机调配。建议结果只作为决策输入，最终采收日由基地负责人确认。</Typography.Paragraph></div><div class="hw-hero-tags"><Tag>决策辅助</Tag><Tag>{weatherReady ? '真实天气已接入' : '天气待核验'}</Tag></div></Card>
    {overviewQuery.isError && <Alert showIcon type="error" message="农场采收数据加载失败" description={(overviewQuery.error as Error).message} />}
    <Card class="hw-weather-card" title="真实天气与采收窗口" extra={<Space wrap><Button loading={weatherMutation.isPending} onClick={() => weatherMutation.mutate()}>刷新真实天气</Button><Button disabled={!plan.value || !weatherReady || plan.value.status === 'CLOSED'} loading={verifyWeatherMutation.isPending} onClick={() => verifyWeatherMutation.mutate()}>核验待执行派单</Button></Space>}>
      <Space wrap><Tag color={weatherReady ? 'success' : 'warning'}>{weatherReady ? '有效真实预报' : '天气待核验'}</Tag><Typography.Text>供应商：{weatherInfo?.provider ?? 'Open-Meteo'}</Typography.Text><Typography.Text>快照：{weatherInfo?.snapshotId ?? '—'}</Typography.Text><Typography.Text>取数时间：{weatherInfo?.fetchedAt ?? '—'}</Typography.Text><Typography.Text>有效至：{weatherInfo?.expiresAt ?? '—'}</Typography.Text></Space>
      {!weatherReady && <Alert style={{
            marginTop: 12
          }} type="warning" showIcon message={weatherInfo?.error || '尚无真实预报，请点击刷新真实天气'} description="缺少农场经纬度时请在农场档案维护坐标；请求失败或快照失效不会自动填充样例天气。" />}
      <Typography.Paragraph type="secondary" style={{
            marginTop: 12
          }}>{weatherInfo?.rules}。时间为取数时间，并非供应商预报发布时间；本页同时提供逐日窗口与逐小时预报（北京时间）。</Typography.Paragraph>
      <div class="hw-weather-days">{(weatherInfo?.days ?? []).filter(day => !dayjs(day.date).isBefore(dayjs(), 'day')).map(day => <div class={`hw-weather-day ${day.usable ? 'is-usable' : ''}`} key={day.date}><b>{day.date}</b><span>{day.label}</span><span>降水 {day.rainMm ?? '—'} mm · 概率 {day.precipitationProbability ?? '—'}%</span><span>风速 {day.maxWindSpeedMs ?? '—'} m/s</span><Tag color={day.usable ? 'success' : 'warning'}>{day.note}</Tag></div>)}</div>
      <div ref={weatherAnchor} tabindex={-1} class="hw-weather-anchor" aria-label="派单对应小时天气">
      <Divider orientation="left">逐小时天气与班次核验</Divider>
      {locatedDispatch && <Alert class="hw-weather-location" type={locationNotice || !selectedHours.length || !weatherReady ? 'warning' : 'info'} showIcon message={`已定位派单：${locatedDispatch.plotName} · ${locatedDispatch.dispatchDate} · ${locatedDispatch.shiftStart ?? '班次待核验'}–${locatedDispatch.shiftEnd ?? '班次待核验'}`} description={<Space direction="vertical"><span>{locationNotice ?? '蓝色范围仅高亮当前派单；小时明细同步标记，开工仍以派单天气核验为准。'}</span>{!selectedHours.length && <span>该日期没有小时预报，不能按零降雨处理；历史作业请结合计划引用快照和执行留痕核查。</span>}{dispatchWeatherReason(locatedDispatch) && <span>派单天气提示：{dispatchWeatherReason(locatedDispatch)}</span>}<Button size="small" onClick={() => {
                setTab('dispatch');
                navigateWeather('dispatch');
              }}>返回派单</Button></Space>} />}
      <Space wrap style={{
              marginBottom: 12
            }}>
        <Select aria-label="逐小时天气日期" value={hourDates.length ? selectedHourDate : undefined} disabled={!hourDates.length} placeholder="暂无预报日期" style={{
                width: 170
              }} options={hourDates.map(date => ({
                value: date,
                label: date
              }))} onChange={date => {
                setHourDate(date);
                setShiftSelection(undefined);
                setWeatherLocation(undefined);
              }} />
        <Tag>北京时间 · 每小时</Tag><Typography.Text type="secondary">覆盖 {weatherInfo?.hourlyStart?.replace('T', ' ') ?? '—'} 至 {weatherInfo?.hourlyEnd?.replace('T', ' ') ?? '—'}</Typography.Text>
      </Space>
      {!weatherInfo?.hourlyAvailable && <Alert type="warning" showIcon message="当前快照没有逐小时数据，请刷新真实天气" />}
      <Space wrap class="hw-shift-controls">
        <Typography.Text strong>班次范围高亮</Typography.Text>
        <Select aria-label="天气图高亮班次" class="hw-shift-select" value={selectedShiftKey} disabled={!dayShifts.shifts.length} options={[...(selectedShiftKey === '__NONE__' ? [{
                value: '__NONE__',
                label: '当前派单无可高亮班次'
              }] : []), {
                value: '__ALL__',
                label: `当日全部班次（${dayShifts.shifts.length} 单）`
              }, ...dayShifts.shifts.map(shift => ({
                value: shift.key,
                label: shift.label
              }))]} onChange={key => {
                setShiftSelection({
                  farmId: requireFarmId(),
                  planId: plan.value?.id ?? '',
                  date: selectedHourDate,
                  key
                });
                setWeatherLocation(undefined);
              }} />
        <Typography.Text type="secondary">{dayShifts.shifts.length ? '蓝色范围为实际班次；橙色风险与灰色缺测仍独立显示' : '当日暂无有效派单班次，不生成默认范围'}</Typography.Text>
      </Space>
      {dayShifts.invalidCount > 0 && <Alert type="warning" showIcon message={`${dayShifts.invalidCount} 张派单班次时间缺失或无效，未参与高亮；跨夜班次需拆单`} />}
      <HourlyWeatherTrend date={selectedHourDate} hours={selectedHours} stale={!weatherReady} shifts={highlightedShifts} />
      <Table size="small" rowClassName={hour => overlappingWeatherShifts(hour.periodStart, selectedHourDate, highlightedShifts).length ? 'hw-hour-in-shift' : ''} rowKey="periodStart" scroll={{
              x: 1000
            }} pagination={false} dataSource={selectedHours} locale={{
              emptyText: '该日期无逐小时预报；不能按零降雨处理'
            }} columns={[{
              title: '小时区间',
              dataIndex: 'periodStart',
              render: (_: unknown, hour) => `${hour.periodStart.slice(11, 16)}–${hour.periodEnd.slice(11, 16)}`
            }, {
              title: '班次范围',
              key: 'shiftRange',
              render: (_: unknown, hour) => {
                const matches = overlappingWeatherShifts(hour.periodStart, selectedHourDate, highlightedShifts);
                return matches.length ? <Tag color="blue" title={matches.map(shift => shift.label).join('；')}>班次内 · {matches.length} 单</Tag> : <Typography.Text type="secondary">—</Typography.Text>;
              }
            }, {
              title: '温度 ℃',
              dataIndex: 'temperature',
              render: (value: number | null) => value ?? '—'
            }, {
              title: '湿度 %',
              dataIndex: 'humidity',
              render: (value: number | null) => value ?? '—'
            }, {
              title: '时段降水 mm',
              dataIndex: 'rainMm',
              render: (value: number | null) => value ?? '—'
            }, {
              title: '降水概率 %',
              dataIndex: 'precipitationProbability',
              render: (value: number | null) => value ?? '—'
            }, {
              title: '风速 / 阵风 m/s',
              key: 'wind',
              render: (_: unknown, hour) => `${hour.windSpeedMs ?? '—'} / ${hour.windGustMs ?? '—'}`
            }, {
              title: '小时风险',
              key: 'risk',
              render: (_: unknown, hour) => <Tag color={hour.usable ? 'success' : 'warning'}>{hour.usable ? '小时气象条件通过' : hour.note}</Tag>
            }]} />
      <Typography.Paragraph type="secondary" style={{
              marginTop: 10
            }}>时段降水为该区间累计；温度、湿度及风速为区间结束时刻预报，阵风为区间最大值。默认采收班次 07:00–16:00，实际派单按自身班次校验；非整点班次覆盖所有重叠小时。小时条件通过仍须满足整日避雨与雨后恢复期。</Typography.Paragraph>
      </div>
      <Typography.Text type="secondary">Weather data by Open-Meteo（CC BY 4.0）。用于商业部署时应配置合规的商业天气服务访问方式。</Typography.Text>
      {plan.value?.weatherInfo && <Typography.Paragraph type="secondary">当前计划引用快照 {plan.value.weatherInfo.snapshotId ?? '—'}，取数时间 {plan.value.weatherInfo.fetchedAt ?? '—'}。刷新天气后需重新核验派单；不满足新预报时先重排。</Typography.Paragraph>}
    </Card>
    <Space wrap class="hw-summary-row"><Card bordered={false}><Statistic title="待采面积" value={plan.value?.metrics.totalArea ?? plots.reduce((sum, plot) => sum + plot.area, 0)} suffix="亩" /></Card><Card bordered={false}><Statistic title="立即采面积" value={plan.value?.metrics.immediateArea ?? 0} suffix="亩" /></Card><Card bordered={false}><Statistic title="峰值用工" value={plan.value?.metrics.peoplePeak ?? 0} suffix="人/日" /></Card><Card bordered={false}><Statistic title="用工缺口" value={plan.value?.metrics.laborGap ?? 0} suffix="人" /></Card></Space>
    <div class="hw-tabs" ref={dispatchAnchor} tabindex={-1} aria-label="采收派单入口"><Button type={tab.value === 'decision' ? 'primary' : 'text'} onClick={() => setTab('decision')}>① 窗口决策</Button><Button type={tab.value === 'dispatch' ? 'primary' : 'text'} onClick={() => setTab('dispatch')}>② 用工协同排程</Button><Button type={tab.value === 'audit' ? 'primary' : 'text'} onClick={() => setTab('audit')}>③ 回写与留痕</Button></div>
    {tab.value === 'decision' && <><Card class="hw-table-card" title="分析结果" extra={<Tag color={plan.value ? 'success' : 'default'}>{plan.value ? `版本 ${plan.value.planNo}` : '待推理'}</Tag>}><Table rowKey="plotName" loading={overviewQuery.isLoading} dataSource={plots} pagination={false} columns={[{
              title: '地块',
              dataIndex: 'plotName'
            }, {
              title: '面积',
              dataIndex: 'area',
              render: (value: number) => `${value} 亩`
            }, {
              title: '成熟度',
              dataIndex: 'maturity',
              render: (value: number) => <Progress percent={value} size="small" />
            }, {
              title: '建议采收日',
              dataIndex: 'suggestedDate',
              render: (_: unknown, row: HarvestWindowPlot) => row.suggestedEndDate ? `${row.suggestedDate} 至 ${row.suggestedEndDate}` : row.suggestedDate
            }, {
              title: '关键理由',
              dataIndex: 'reason'
            }]} /></Card><Alert class="hw-rule-alert" showIcon icon={<ThunderboltOutlined />} message="规则与边界" description="成熟度只是决策输入，最终采收日须由基地负责人确认；降雨后须留恢复期；延后收益为概率值；用工派单不得超出合同单日工时上限。" /></>}
    {tab.value === 'dispatch' && plan.value && <ShiftWeatherRiskSummary key={`${farmId.value}:${plan.value.id}`} planId={plan.value.id} planVersion={plan.value.version} planStatus={plan.value.status} dispatches={dispatches} weather={weatherInfo} onApplied={refresh} onLocate={locateDispatchWeather} />}
    {tab.value === 'dispatch' && <Card title={<Space><TeamOutlined />用工与农机协同排程</Space>} extra={<Button disabled={!canExecute || !faults.length} onClick={() => {
          setFaultId(undefined);
          setReadyDate(dayjs().format('YYYY-MM-DD'));
          setFallbackMode('EXTEND_WINDOW');
          setFallbackDate(plan.value?.windowEnd ? dayjs(plan.value.windowEnd).add(3, 'day').format('YYYY-MM-DD') : undefined);
          setPreview(undefined);
          setReason('');
          setRescheduleOpen(true);
        }}>故障影响重排</Button>}>{!plan.value ? <Empty description="请先点击重新推理生成排程草案" /> : <Table rowKey={row => row.id ?? `${row.plotName}-${row.dispatchDate}`} dataSource={dispatches} rowClassName={(row, index) => locatedDispatch && weatherDispatchKey(row, index) === _weatherLocationAtStart?.key ? 'hw-dispatch-weather-selected' : ''} scroll={{
            x: 1200
          }} pagination={false} expandable={{
            expandedRowRender: (row: HarvestWindowDispatch) => <Descriptions size="small" bordered column={2}><Descriptions.Item label="人员明细">{row.workers?.map(worker => `${worker.workerName}（${worker.attendanceStatus}）`).join('、') || '—'}</Descriptions.Item><Descriptions.Item label="农机明细">{row.machineDetails?.map(machine => `${machine.machineName} · ${machine.machineNo}（${machine.status}）`).join('、') || '—'}</Descriptions.Item><Descriptions.Item label="故障记录">{row.machineFaults?.map(fault => `${fault.machineName}：${fault.description}`).join('；') || '无'}</Descriptions.Item></Descriptions>
          }} columns={[{
            title: '日期',
            dataIndex: 'dispatchDate'
          }, {
            title: '地块',
            dataIndex: 'plotName'
          }, {
            title: '班次',
            key: 'shift',
            render: (_: unknown, row: HarvestWindowDispatch) => `${row.shiftStart?.slice(0, 5) ?? '待核验'}–${row.shiftEnd?.slice(0, 5) ?? '待核验'}`
          }, {
            title: '面积',
            dataIndex: 'area',
            render: (value: number) => `${value} 亩`
          }, {
            title: '用工',
            dataIndex: 'people',
            render: (value: number, row: HarvestWindowDispatch) => `${row.assignedPeople ?? 0}/${value} 人`
          }, {
            title: '农机 / 运输',
            key: 'machine',
            render: (_: unknown, row: HarvestWindowDispatch) => `${row.machines} 台 / ${row.trucks} 辆`
          }, {
            title: '状态',
            dataIndex: 'status',
            render: (value: DispatchStatus, row: HarvestWindowDispatch) => {
              const meta = dispatchMeta(value);
              const weatherReason = dispatchWeatherReason(row);
              return <Space direction="vertical"><Tag color={meta.color}>{meta.label}</Tag>{weatherReason && <Typography.Text type="warning">{weatherReason}</Typography.Text>}</Space>;
            }
          }, {
            title: '天气',
            key: 'weather',
            render: (_: unknown, row: HarvestWindowDispatch) => <Button size="small" type="link" aria-label={`查看${row.plotName} ${row.dispatchDate}派单天气`} onClick={event => {
              event.stopPropagation();
              locateDispatchWeather(row);
            }}>查看天气</Button>
          }, {
            title: '操作',
            key: 'action',
            render: (_: unknown, row: HarvestWindowDispatch) => row.id && !['DONE', 'RESCHEDULED', 'DEFERRED'].includes(row.status) ? <Button size="small" disabled={!canExecute || row.status === 'BLOCKED' || Boolean(dispatchWeatherReason(row))} onClick={() => progressMutation.mutate({
              id: row.id as string,
              status: row.status === 'PLANNED' ? 'RUNNING' : 'DONE'
            })}>{row.status === 'PLANNED' ? '开始执行' : '完成并回写'}</Button> : <Typography.Text type="secondary">{row.status === 'DEFERRED' ? '下一周期待复核' : row.status === 'RESCHEDULED' ? '查看接续单' : '已回写'}</Typography.Text>
          }]} />}{plan.value && <Divider><Button type="primary" icon={<SendOutlined />} disabled={plan.value.status !== 'APPROVED'} loading={publishMutation.isPending} onClick={() => publishMutation.mutate()}>发布四联单</Button></Divider>}</Card>}
    {tab.value === 'audit' && <Card title="回写与留痕"><Descriptions bordered column={2}><Descriptions.Item label="计划版本">{plan.value?.planNo ?? '尚未生成'}</Descriptions.Item><Descriptions.Item label="当前状态">{plan.value?.status ?? '待推理'}</Descriptions.Item><Descriptions.Item label="回写对象">采收计划、用工派单、农机调度单</Descriptions.Item><Descriptions.Item label="留痕规则">推理、确认、发布、进度回填和故障重排均记录事件</Descriptions.Item></Descriptions><Divider orientation="left">重排确认记录</Divider><Table rowKey="id" pagination={false} dataSource={plan.value?.reschedules ?? []} expandable={{
            expandedRowRender: row => <Space direction="vertical" style={{
              width: '100%'
            }}><RescheduleComparisonHistory snapshot={row.snapshot} /><RescheduleBenefitHistory snapshot={row.snapshot} /></Space>
          }} columns={[{
            title: '版本',
            key: 'version',
            render: (_: unknown, row) => `V${row.baseVersion} → V${row.newVersion}`
          }, {
            title: '重排类型 / 兜底方式',
            key: 'mode',
            render: (_: unknown, row) => row.fallbackMode === 'WEATHER_RISK_BATCH' ? '天气风险批量重排' : row.fallbackMode
          }, {
            title: '状态',
            key: 'fallbackStatus',
            render: (_: unknown, row) => row.fallbackStatus === 'PENDING_REPUBLISH' ? '待重新发布' : row.fallbackStatus === 'PUBLISHED' ? '已重新发布' : row.fallbackStatus
          }, {
            title: '目标日期',
            dataIndex: 'fallbackDate'
          }, {
            title: '确认人',
            dataIndex: 'confirmedBy'
          }, {
            title: '确认时间',
            dataIndex: 'createdAt'
          }, {
            title: '确认说明',
            dataIndex: 'reason'
          }]} /></Card>}
    <div class="hw-confirm-bar"><Space><Tag color={canExecute ? 'success' : 'warning'}>{canExecute ? '已确认' : '待负责人确认'}</Tag><Typography.Text type="secondary">建议结果需人工确认后才可发布派单</Typography.Text></Space><Button type="primary" icon={<CheckCircleOutlined />} disabled={!plan.value || plan.value.status !== 'DRAFT'} onClick={() => setApproveOpen(true)}>负责人确认</Button></div>
    <Modal title="故障影响评估与窗口外兜底" width={1100} open={rescheduleOpen.value} onCancel={() => !busy && setRescheduleOpen(false)} footer={<Space><Button disabled={busy} onClick={() => setRescheduleOpen(false)}>取消</Button><Button loading={previewMutation.isPending} disabled={busy || !faultId.value || !readyDate.value || fallbackMode.value === 'EXTEND_WINDOW' && !fallbackDate.value} onClick={() => {
            setPreview(undefined);
            previewMutation.mutate();
          }}>评估影响并预览</Button><Button type="primary" loading={applyMutation.isPending} disabled={busy || !preview.value?.canApply || !reason.value.trim() || faultBenefitSignature.value !== JSON.stringify(faultBenefitInputs.value)} onClick={() => applyMutation.mutate()}>负责人确认并应用</Button></Space>}><Space direction="vertical" size={14} style={{
            width: '100%'
          }}><Alert showIcon type="info" message="窗口内优先安排；窗口内排不下时，可顺延到窗口外并标记待天气核验，或转入下一周期待复核。故障须先恢复或换机，再确认应用。" /><Space wrap><Select aria-label="重排故障单" style={{
                width: 360
              }} placeholder="选择故障单" value={faultId.value} options={faults} disabled={busy} onChange={value => {
                setFaultId(value);
                setPreview(undefined);
              }} /><DatePicker aria-label="恢复可用日期" value={dayjs(readyDate.value)} disabled={busy} disabledDate={date => Boolean(plan.value && date.isAfter(dayjs(plan.value.windowEnd).add(60, 'day'), 'day'))} onChange={date => {
                setReadyDate(date?.format('YYYY-MM-DD') ?? '');
                setPreview(undefined);
              }} /><Select aria-label="窗口外兜底方式" style={{
                width: 220
              }} value={fallbackMode.value} disabled={busy} options={[{
                value: 'EXTEND_WINDOW',
                label: '窗口外顺延接续'
              }, {
                value: 'NEXT_CYCLE',
                label: '转入下一周期待复核'
              }]} onChange={(value: FaultFallbackMode) => {
                setFallbackMode(value);
                setPreview(undefined);
              }} />{fallbackMode.value === 'EXTEND_WINDOW' && <DatePicker aria-label="窗口外兜底日期" value={fallbackDate.value ? dayjs(fallbackDate.value) : null} disabled={busy} disabledDate={date => Boolean(plan.value && !date.isAfter(dayjs(plan.value.windowEnd), 'day'))} onChange={date => {
                setFallbackDate(date?.format('YYYY-MM-DD'));
                setPreview(undefined);
              }} />}</Space><Typography.Text type="secondary">{fallbackMode.value === 'EXTEND_WINDOW' ? '在计划窗口结束后继续校验天气、人员和农机；无预报日期仅生成待核验占位单，核验通过前不可发布或开工。' : '冻结当前剩余作业并转入下一周期待复核，不生成无日期的执行派单。'}</Typography.Text>{preview.value && <><RescheduleBenefitEditor ids={preview.value.changes.map(c => c.dispatchId)} labels={Object.fromEntries(preview.value.changes.map(c => [c.dispatchId, `${c.plotName} · ${c.oldDate}`]))} value={faultBenefitInputs.value} onChange={setFaultBenefitInputs} disabled={busy} />{faultBenefitSignature.value === JSON.stringify(faultBenefitInputs.value) ? <><RescheduleComparisonView rows={preview.value.changes} /><RescheduleBenefitView summary={preview.value.benefitSummary} rows={preview.value.changes} /></> : <Alert type="warning" showIcon message="收益参数已变化，请重新评估；原结果不可确认应用" />}{preview.value.weatherInfo && <Typography.Text type="secondary">评估使用天气快照 {preview.value.weatherInfo.snapshotId ?? '—'}（{preview.value.weatherInfo.fetchedAt ?? '未获取'}）</Typography.Text>}<Alert showIcon type={preview.value.fallbackMode === 'NEXT_CYCLE' ? 'warning' : preview.value.outsideWindowUsed ? 'warning' : 'success'} message={preview.value.fallbackMode === 'NEXT_CYCLE' ? '确认后将转入下一周期待复核。' : preview.value.outsideWindowUsed ? `已找到窗口外日期 ${preview.value.fallbackDate ?? '待核验'}，发布前必须重新核对天气。` : '已在当前窗口内找到接续日期。'} />{preview.value.blockers.map(item => <Alert key={item} showIcon type="error" message={item} />)}{preview.value.warnings.map(item => <Alert key={item} showIcon type="warning" message={item} />)}<Table rowKey="dispatchId" size="small" pagination={false} dataSource={preview.value.changes} columns={[{
                title: '地块',
                dataIndex: 'plotName'
              }, {
                title: '原日期',
                dataIndex: 'oldDate'
              }, {
                title: '重排日期',
                dataIndex: 'newDate',
                render: (value: string | undefined, row) => value || (row.fallbackStatus === 'NEXT_CYCLE_PENDING' ? '下一周期待复核' : '窗口内不可排')
              }, {
                title: '已完成',
                dataIndex: 'completedArea',
                render: (value: number) => `${Number(value).toFixed(2)} 亩`
              }, {
                title: '接续面积',
                dataIndex: 'remainingArea',
                render: (value: number) => `${Number(value).toFixed(2)} 亩`
              }, {
                title: '延后',
                dataIndex: 'delayDays',
                render: (value: number | undefined) => value == null ? '—' : `${value} 天`
              }]} /><Input.TextArea aria-label="重排确认说明" rows={3} maxLength={500} showCount value={reason.value} disabled={busy} placeholder="负责人确认说明：请核验延后风险及兜底措施" onChange={event => setReason(event.target.value ?? '')} /></>}</Space></Modal>
    <Modal title="确认采收窗口与排程" open={approveOpen.value} onCancel={() => setApproveOpen(false)} onOk={() => approveMutation.mutate()} okText="确认并留痕" confirmLoading={approveMutation.isPending}><Typography.Paragraph>确认后才可发布采收计划、用工派单和农机调度单，请核验成熟度、降雨恢复期和单日工时上限。</Typography.Paragraph><Input.TextArea rows={3} value={approveReason.value} onChange={event => setApproveReason(event.target.value ?? '')} /></Modal>
  </PageContainer>;
    };
  }
});
export default HarvestWindowDecision;
