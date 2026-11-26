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
import { Alert, Card, Col, Collapse, Descriptions, Empty, Row, Space, Tag, Typography } from '@/vue/ui';
import type { RescheduleComparison, RescheduleComparisonSide } from '@/api/harvest-window';
type ComparisonRow = {
  dispatchId: string;
  plotName: string;
  scheduleComparison?: RescheduleComparison;
  continuationDispatchId?: string | null;
};
const OUTCOMES = {
  PROPOSED: '接续候选',
  BLOCKED: '无法安排',
  UNCHANGED: '保持原安排',
  DEFERRED: '下一周期待复核'
};
const STATUSES: Record<string, string> = {
  PLANNED: '待执行',
  RUNNING: '执行中',
  DONE: '已完成',
  BLOCKED: '故障阻塞',
  RESCHEDULED: '已转接续单',
  DEFERRED: '下一周期待复核'
};
const count = (value: unknown, unit: string): string => value == null || !Number.isFinite(Number(value)) ? '未记录' : `${Number(value).toLocaleString('zh-CN', {
  maximumFractionDigits: 2
})} ${unit}`;
const person = (p: RescheduleComparisonSide['workers'][number]): string => p.workerName || (p.workerId == null ? '姓名未记录' : `人员 ${p.workerId}`);
const equipment = (m: RescheduleComparisonSide['machines'][number]): string => `${m.machineName || '设备名称未记录'}（${m.machineNo || '编号未记录'}）`;
export function validComparison(value: unknown): value is RescheduleComparison {
  if (!value || typeof value !== 'object') return false;
  const c = value as RescheduleComparison;
  return c.schemaVersion === 'RESCHEDULE_COMPARISON_V1' && Object.prototype.hasOwnProperty.call(OUTCOMES, c.outcome) && typeof c.scope === 'string' && [c.before, c.after].every(side => side && typeof side.riskReason === 'string' && Array.isArray(side.workers) && Array.isArray(side.machines) && side.workers.every(p => p && typeof p === 'object') && side.machines.every(m => m && typeof m === 'object'));
}

/** 身份按编号比较，编号缺失时明确提示，不能按姓名猜测是否换人。 */
export function comparisonChanges(c: RescheduleComparison): string[] {
  if (c.outcome === 'UNCHANGED') return ['无需重排，原日期和资源保持不变'];
  if (c.outcome === 'BLOCKED') return ['未形成可执行候选，原单尚未调整'];
  if (c.outcome === 'DEFERRED') return ['剩余作业转下一周期待复核；未指定执行日期、人员和设备'];
  const changes: string[] = [];
  const {
    before,
    after
  } = c;
  changes.push(before.date === after.date ? '日期不变，重新匹配资源' : `日期：${before.date || '未记录'} → ${after.date || '未排期'}`);
  const time = (value?: string | null) => value?.length === 5 ? `${value}:00` : value;
  if (time(before.shiftStart) !== time(after.shiftStart) || time(before.shiftEnd) !== time(after.shiftEnd)) changes.push('班次发生变化，请复核工时与天气覆盖');
  if (before.people != null && after.people != null && Number(before.people) !== Number(after.people)) changes.push(`采收需求：${before.people} → ${after.people} 人`);
  const oldIds = new Set(before.workers.filter(p => p.workerId != null).map(p => String(p.workerId)));
  const newIds = new Set(after.workers.filter(p => p.workerId != null).map(p => String(p.workerId)));
  const added = after.workers.filter(p => p.workerId != null && !oldIds.has(String(p.workerId)));
  const removed = before.workers.filter(p => p.workerId != null && !newIds.has(String(p.workerId)));
  if (added.length) changes.push(`新增采收人员：${added.map(person).join('、')}`);
  if (removed.length) changes.push(`不再接续的采收人员：${removed.map(person).join('、')}`);
  if ([...before.workers, ...after.workers].some(p => p.workerId == null)) changes.push('部分人员编号缺失，无法完整比较人员变化');
  const key = (m: RescheduleComparisonSide['machines'][number]) => m.machineNo?.trim().toUpperCase();
  const oldMachines = new Map(before.machines.filter(m => key(m)).map(m => [key(m), m]));
  const newMachines = new Map(after.machines.filter(m => key(m)).map(m => [key(m), m]));
  for (const [no, machine] of newMachines) {
    const old = oldMachines.get(no);
    if (!old) changes.push(`新增接续设备：${equipment(machine)}`);else if (String(old.operatorWorkerId ?? '') !== String(machine.operatorWorkerId ?? '')) changes.push(`机手变化（${no}）：${old.operatorWorkerName || '未分配'} → ${machine.operatorWorkerName || '未分配'}`);
  }
  for (const [no, machine] of oldMachines) if (!newMachines.has(no)) changes.push(`不再接续的设备：${equipment(machine)}`);
  if ([...before.machines, ...after.machines].some(m => !key(m))) changes.push('部分设备编号缺失，无法完整比较设备变化');
  if (changes.length === 1 && before.workers.length && before.machines.length) changes.push('已记录的人员和设备身份未变化');
  return changes;
}
const Side = defineComponent({
  name: "Side",
  props: {
    side: null as unknown as PropType<{
      side: RescheduleComparisonSide;
      after?: boolean;
      outcome: RescheduleComparison['outcome'];
    }["side"]>,
    after: null as unknown as PropType<{
      side: RescheduleComparisonSide;
      after?: boolean;
      outcome: RescheduleComparison['outcome'];
    }["after"]>,
    outcome: null as unknown as PropType<{
      side: RescheduleComparisonSide;
      after?: boolean;
      outcome: RescheduleComparison['outcome'];
    }["outcome"]>
  },
  setup(__props: {
    side: RescheduleComparisonSide;
    after?: boolean;
    outcome: RescheduleComparison['outcome'];
  }, {
    slots: __slots
  }) {
    const scheduled = computed(() => !__props.after || __props.outcome === 'PROPOSED' || __props.outcome === 'UNCHANGED');
    const awaiting = computed(() => __props.after && __props.outcome === 'DEFERRED');
    return () => {
      return <Card size="small" class={`hw-compare-side ${__props.after ? 'hw-compare-after' : 'hw-compare-before'}`} title={__props.after ? '重排后安排' : '重排前原单'}>
    <Descriptions column={1} size="small" items={[{
          key: 'date',
          label: '日期 / 班次',
          children: scheduled.value ? `${__props.side.date || '未记录'} · ${__props.side.shiftStart || '缺失'}–${__props.side.shiftEnd || '缺失'}` : awaiting.value ? '未排期 · 下一周期待复核' : '未生成候选'
        }, {
          key: 'status',
          label: '安排状态',
          children: __props.after ? OUTCOMES[__props.outcome] : STATUSES[__props.side.status || ''] || '状态未记录'
        }, {
          key: 'area',
          label: __props.after ? '接续剩余量' : '原单计划量',
          children: count(__props.after ? __props.side.remainingArea : __props.side.area, '亩')
        }, ...(!__props.after ? [{
          key: 'actual',
          label: '已完成保留',
          children: count(__props.side.completedArea, '亩')
        }, {
          key: 'remain',
          label: '待处理剩余',
          children: count(__props.side.remainingArea, '亩')
        }] : []), {
          key: 'hours',
          label: '计划工时',
          children: scheduled.value ? count(__props.side.plannedHours, '小时/人') : '待重新核定'
        }, {
          key: 'people',
          label: '采收人员',
          children: scheduled.value ? <Space direction="vertical" size={0}><span>需求 {count(__props.side.people, '人')} · 已分配 {count(__props.side.assignedPeople, '人')}</span><span>{__props.side.workers.length ? __props.side.workers.map(person).join('、') : '没有人员明细'}</span></Space> : '未分配（不表示人员需求为0）'
        }, {
          key: 'machines',
          label: '设备 / 机手',
          children: scheduled.value ? <Space direction="vertical" size={2}>{__props.side.machines.length ? __props.side.machines.map((m, i) => <span key={`${m.machineNo}-${i}`}>{equipment(m)} · {m.machineType === 'HARVESTER' ? '采收机' : m.machineType === 'TRUCK' ? '运输车' : '类型未记录'} · 机手：{m.operatorWorkerName || '未分配'}{!__props.after && m.status === 'REPLACED' ? ' · 已替换' : !__props.after && m.status === 'DONE' ? ' · 已完成' : ''}</span>) : '无设备明细'}</Space> : '未分配'
        }, {
          key: 'risk',
          label: '时点风险',
          children: <Space direction="vertical" size={2}><Tag color={__props.side.riskStatus === 'PASSED' ? 'success' : 'warning'}>{__props.side.riskStatus === 'PASSED' ? '预览时点核验通过' : __props.side.riskStatus === 'ATTENTION' ? '原安排需关注' : '待核验 / 待处理'}</Tag><span>{__props.side.riskReason || '未记录风险说明'}</span></Space>
        }]} />
  </Card>;
    };
  }
});
export const RescheduleComparisonView = defineComponent({
  name: "RescheduleComparisonView",
  props: {
    rows: null as unknown as PropType<{
      rows: ComparisonRow[];
      history?: boolean;
    }["rows"]>,
    history: null as unknown as PropType<{
      rows: ComparisonRow[];
      history?: boolean;
    }["history"]>
  },
  setup(__props: {
    rows: ComparisonRow[];
    history?: boolean;
  }, {
    slots: __slots
  }) {
    const valid = computed(() => __props.rows.filter(row => validComparison(row.scheduleComparison)));
    const proposed = computed(() => valid.value.filter(row => row.scheduleComparison?.outcome === 'PROPOSED'));
    const delayed = computed(() => proposed.value.filter(row => (row.scheduleComparison?.after.date || '') > (row.scheduleComparison?.before.date || '')));
    const remaining = computed(() => proposed.value.reduce((sum, row) => sum + Number(row.scheduleComparison?.after.remainingArea || 0), 0));
    return () => {
      return <Space direction="vertical" class="hw-compare-wrap">
    <Typography.Title level={5} style={{
          margin: 0
        }}>重排前后对比{(__props.history ?? false) && ' · 确认快照'}</Typography.Title>
    <Typography.Text>接续{__props.history ?? false ? '方案' : '候选'} {proposed.value.length} 单 · 日期延后 {delayed.value.length} 单 · 接续剩余面积 {count(remaining.value, '亩')} · 待复核 {valid.value.filter(row => row.scheduleComparison?.outcome === 'DEFERRED').length} 单 · 未安排 {valid.value.filter(row => row.scheduleComparison?.outcome === 'BLOCKED').length} 单</Typography.Text>
    {__props.rows.length > valid.value.length && <Alert type="warning" showIcon message={`${__props.rows.length - valid.value.length} 单缺少完整对比快照，不计入以上汇总`} />}
    {(__props.history ?? false) && <Alert type="info" showIcon message="以下为负责人确认时的安排，不使用当前派单、人员库或天气补算，也不代表当前执行状态。" />}
    <Collapse items={__props.rows.map(row => {
          const c = row.scheduleComparison;
          return {
            key: row.dispatchId,
            label: `${row.plotName} · ${validComparison(c) ? `${c.before.date || '未记录'} → ${c.after.date || '未排期'} · ${OUTCOMES[c.outcome]}` : '缺少前后对比快照'}`,
            children: validComparison(c) ? <Space direction="vertical" style={{
              width: '100%'
            }}>
        <Row gutter={[12, 12]} style={{
                width: '100%',
                marginInline: 0
              }}><Col xs={24} md={12}><Side side={c.before} outcome={c.outcome} /></Col><Col xs={24} md={12}><Side side={c.after} after outcome={c.outcome} /></Col></Row>
        <Typography.Text strong>变化说明</Typography.Text>{comparisonChanges(c).map((text, i) => <Typography.Text key={i}>{text}</Typography.Text>)}
        <Typography.Text type="secondary">{c.scope} 天气快照：{c.snapshotId ?? '未记录'}。</Typography.Text>
        <Typography.Text type="secondary">原派单：{row.dispatchId}{row.continuationDispatchId ? `；接续派单：${row.continuationDispatchId}` : ''}。{__props.history ?? false ? '确认后的发布和执行情况请查看当前计划。' : '当前仅预览，确认后才应用；执行仍受原有发布和天气核验限制。'}</Typography.Text>
      </Space> : <Alert type="warning" showIcon message="该记录没有完整前后对比快照，不从当前派单反推原安排；原有日期及收益信息仍可在其他明细查看。" />
          };
        })} />
    {!__props.rows.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无重排明细" />}
  </Space>;
    };
  }
});
export const RescheduleComparisonHistory = defineComponent({
  name: "RescheduleComparisonHistory",
  props: {
    snapshot: null as unknown as PropType<{
      snapshot: unknown;
    }["snapshot"]>
  },
  setup(__props: {
    snapshot: unknown;
  }, {
    slots: __slots
  }) {
    return () => {
      try {
        const parsed = typeof __props.snapshot === 'string' ? JSON.parse(__props.snapshot) : __props.snapshot;
        if (!parsed || typeof parsed !== 'object') throw new Error();
        const rows: unknown = parsed.rows ?? parsed.changes;
        if (!Array.isArray(rows)) return <Alert type="info" message="该历史记录没有安排对比明细，不以当前数据补算" />;
        const safeRows = rows.filter((row): row is ComparisonRow => row && typeof row === 'object' && typeof row.dispatchId === 'string' && typeof row.plotName === 'string');
        if (safeRows.length !== rows.length) throw new Error();
        return <RescheduleComparisonView rows={safeRows} history />;
      } catch {
        return <Alert type="warning" showIcon message="历史安排快照无法读取，未使用当前数据替代" />;
      }
    };
  }
});
