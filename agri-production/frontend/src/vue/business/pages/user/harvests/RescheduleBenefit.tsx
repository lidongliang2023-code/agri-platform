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
import { Alert, Collapse, Descriptions, Empty, Input, InputNumber, Select, Space, Table, Tag, Typography } from '@/vue/ui';
import type { BenefitAmounts, RescheduleBenefitInput, RescheduleBenefitSummary, RiskBatchPreviewRow } from '@/api/harvest-window';
type BenefitRow = Pick<RiskBatchPreviewRow, 'dispatchId' | 'plotName' | 'oldDate' | 'newDate' | 'remainingArea' | 'benefitComparison'>;
type NumericField = Exclude<keyof RescheduleBenefitInput, 'sourceNote'>;
const FIELDS: Array<{
  key: NumericField;
  label: string;
  max?: number;
}> = [{
  key: 'yieldKgPerMu',
  label: '未扣损耗亩产（kg/亩）'
}, {
  key: 'baselinePrice',
  label: '原日期基准价（元/kg）',
  max: 1000000
}, {
  key: 'candidatePrice',
  label: '候选日期估价（元/kg）',
  max: 1000000
}, {
  key: 'worstPrice',
  label: '保守情景价（元/kg）',
  max: 1000000
}, {
  key: 'baselineLossPct',
  label: '原日期综合损耗（%）',
  max: 100
}, {
  key: 'candidateLossPct',
  label: '候选综合损耗（%）',
  max: 100
}, {
  key: 'worstLossPct',
  label: '保守综合损耗（%）',
  max: 100
}, {
  key: 'baselineLaborCost',
  label: '原人工总费（元，含机手）'
}, {
  key: 'candidateLaborCost',
  label: '候选人工总费（元，含机手）'
}, {
  key: 'baselineMachineCost',
  label: '原农机运输总费（元，不含人员）'
}, {
  key: 'candidateMachineCost',
  label: '候选农机运输总费（元，不含人员）'
}, {
  key: 'baselineOtherCost',
  label: '原其他总费（元）'
}, {
  key: 'candidateOtherCost',
  label: '候选其他总费（元）'
}, {
  key: 'adjustmentCost',
  label: '调度追加费（元，仅候选）'
}];
const money = (v: unknown): string => v == null || !Number.isFinite(Number(v)) ? '未测算' : Number(v).toLocaleString('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const delta = (v: unknown): string => v == null ? '未测算' : `${Number(v) > 0 ? '+' : ''}${money(v)}`;
export const RescheduleBenefitEditor = defineComponent({
  name: "RescheduleBenefitEditor",
  props: {
    ids: null as unknown as PropType<{
      ids: string[];
      labels?: Record<string, string>;
      value: Record<string, RescheduleBenefitInput>;
      onChange: (value: Record<string, RescheduleBenefitInput>) => void;
      disabled: boolean;
    }["ids"]>,
    labels: null as unknown as PropType<{
      ids: string[];
      labels?: Record<string, string>;
      value: Record<string, RescheduleBenefitInput>;
      onChange: (value: Record<string, RescheduleBenefitInput>) => void;
      disabled: boolean;
    }["labels"]>,
    value: null as unknown as PropType<{
      ids: string[];
      labels?: Record<string, string>;
      value: Record<string, RescheduleBenefitInput>;
      onChange: (value: Record<string, RescheduleBenefitInput>) => void;
      disabled: boolean;
    }["value"]>,
    onChange: null as unknown as PropType<{
      ids: string[];
      labels?: Record<string, string>;
      value: Record<string, RescheduleBenefitInput>;
      onChange: (value: Record<string, RescheduleBenefitInput>) => void;
      disabled: boolean;
    }["onChange"]>,
    disabled: null as unknown as PropType<{
      ids: string[];
      labels?: Record<string, string>;
      value: Record<string, RescheduleBenefitInput>;
      onChange: (value: Record<string, RescheduleBenefitInput>) => void;
      disabled: boolean;
    }["disabled"]>
  },
  setup(__props: {
    ids: string[];
    labels?: Record<string, string>;
    value: Record<string, RescheduleBenefitInput>;
    onChange: (value: Record<string, RescheduleBenefitInput>) => void;
    disabled: boolean;
  }, {
    slots: __slots
  }) {
    const selection = shallowRef('');
    const setSelection = (next: typeof selection.value | ((previous: typeof selection.value) => typeof selection.value)) => {
      selection.value = typeof next === 'function' ? (next as (previous: typeof selection.value) => typeof selection.value)(selection.value) : next;
    };
    const id = computed(() => __props.ids.includes(selection.value) ? selection.value : __props.ids[0]);
    const current = computed(() => __props.value[id.value] ?? {});
    const update = (field: keyof RescheduleBenefitInput, next: number | string | null) => {
      if (!id.value) return;
      __props.onChange({
        ...__props.value,
        [id.value]: {
          ...current.value,
          [field]: next
        }
      });
    };
    return () => {
      const _currentSnapshot = current.value;
      return <Collapse items={[{
        key: 'benefit-inputs',
        label: '收益测算参数（可选，按派单单独填写）',
        children: <Space direction="vertical" style={{
          width: '100%'
        }}>
    <Alert type="info" showIcon message="填写剩余作业口径，零费用也须明确填0" description="不自动套用样例价格、糖度或损失比例。亩产为不扣损耗的基准产量，损耗合并减产和无法销售部分；等级影响体现在价格，不重复计损。人工含机手驾驶员，农机运输不再含人员。保守情景沿用候选费用，不含额外极端成本；不是绝对最坏结果。" />
    <Select aria-label="收益测算派单" style={{
            width: '100%'
          }} value={id.value} disabled={__props.disabled || !__props.ids.length} options={__props.ids.map(key => ({
            value: key,
            label: __props.labels?.[key] ?? key
          }))} onChange={setSelection} />
    <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 12
          }}>
      {FIELDS.map(field => <label key={field.key} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}><span>{field.label}</span><InputNumber aria-label={field.label} style={{
                width: '100%'
              }} min={field.key === 'yieldKgPerMu' ? 0.0001 : 0} max={field.max ?? 1000000000} precision={4} value={_currentSnapshot[field.key]} disabled={__props.disabled || !id.value} placeholder="未填写，不默认0" onChange={n => update(field.key, n)} /></label>)}
    </div>
    <Input.TextArea aria-label="收益测算依据" rows={2} maxLength={300} showCount disabled={__props.disabled || !id.value} value={_currentSnapshot.sourceNote ?? ''} placeholder="必填依据：作物、亩产估计、价格日期与来源、损耗依据、人工农机报价及保守情景假设；最多300字" onChange={e => update('sourceNote', e.target.value)} />
    <Typography.Text type="secondary">批次日期范围修改后请复核候选价格。参数随本次候选计算和确认保存，不写入行情台账或工资账；关闭后重新打开仍应复核，切换计划、派单或天气上下文会清空输入。</Typography.Text>
  </Space>
      }]} />;
    };
  }
});
const AmountTable = defineComponent({
  name: "AmountTable",
  props: {
    amounts: null as unknown as PropType<{
      amounts: BenefitAmounts | Partial<BenefitAmounts>;
    }["amounts"]>
  },
  setup(__props: {
    amounts: BenefitAmounts | Partial<BenefitAmounts>;
  }, {
    slots: __slots
  }) {
    const items = computed(() => [{
      name: '预计销售额',
      before: __props.amounts.baselineRevenue,
      after: __props.amounts.candidateRevenue,
      change: __props.amounts.revenueDelta
    }, {
      name: '剩余作业成本',
      before: __props.amounts.baselineCost,
      after: __props.amounts.candidateCost,
      change: __props.amounts.costDelta
    }, {
      name: '作业净收益',
      before: __props.amounts.baselineNet,
      after: __props.amounts.candidateNet,
      change: __props.amounts.netDelta
    }, {
      name: '候选保守情景净收益',
      before: __props.amounts.baselineNet,
      after: __props.amounts.worstNet,
      change: __props.amounts.worstDelta
    }]);
    return () => {
      return <Table rowKey="name" size="small" pagination={false} scroll={{
        x: 660
      }} dataSource={items.value} columns={[{
        title: '测算项目（元）',
        dataIndex: 'name'
      }, {
        title: '原日期基准',
        dataIndex: 'before',
        render: money
      }, {
        title: '重排候选',
        dataIndex: 'after',
        render: money
      }, {
        title: '候选－基准',
        dataIndex: 'change',
        render: delta
      }]} />;
    };
  }
});
export const RescheduleBenefitView = defineComponent({
  name: "RescheduleBenefitView",
  props: {
    summary: null as unknown as PropType<{
      summary?: RescheduleBenefitSummary;
      rows?: BenefitRow[];
    }["summary"]>,
    rows: null as unknown as PropType<{
      summary?: RescheduleBenefitSummary;
      rows?: BenefitRow[];
    }["rows"]>
  },
  setup(__props: {
    summary?: RescheduleBenefitSummary;
    rows?: BenefitRow[];
  }, {
    slots: __slots
  }) {
    return () => {
      return <Space direction="vertical" style={{
        width: '100%'
      }}>
    {__props.summary && <>
      <Typography.Title level={5} style={{
            margin: 0
          }}>重排收益对比 <Tag color={__props.summary.status === 'COMPLETE' ? 'blue' : 'warning'}>{__props.summary.status === 'COMPLETE' ? '候选全部已测算' : __props.summary.status === 'PARTIAL' ? '部分测算' : '未测算'}</Tag></Typography.Title>
      <Typography.Text>可测算候选 {__props.summary.eligibleCount} 单 · 已测算 {__props.summary.calculatedCount} 单 · 缺少参数 {__props.summary.missingCount} 单</Typography.Text>
      {__props.summary.totals ? <AmountTable amounts={__props.summary.totals} /> : <Alert type="warning" showIcon message="尚无完整收益测算，不能将空参数视作零收益" />}
      {__props.summary.totals && __props.summary.totals.netDelta < 0 && <Alert type="warning" showIcon message="当前参数下重排净收益下降，请复核成本及品质损失并安排兜底" />}
      {__props.summary.totals && __props.summary.totals.worstDelta < 0 && <Typography.Text type="warning">保守情景相对基准减少 {money(-__props.summary.totals.worstDelta)} 元。该情景仍可能低估极端损失。</Typography.Text>}
      <Typography.Paragraph type="secondary">{__props.summary.scope}<br />{__props.summary.rules} 模型版本：{__props.summary.modelVersion}。</Typography.Paragraph>
    </>}
    {(__props.rows ?? []).length > 0 && <Collapse items={(__props.rows ?? []).map(row => ({
          key: row.dispatchId,
          label: `${row.plotName} · ${row.oldDate} → ${row.newDate ?? '无候选'} · ${Number(row.remainingArea).toFixed(2)}亩 · ${row.benefitComparison?.status === 'CALCULATED' ? `净收益差 ${delta(row.benefitComparison.netDelta)}元` : '未测算'}`,
          children: <Space direction="vertical" style={{
            width: '100%'
          }}>
      {row.benefitComparison?.status === 'CALCULATED' ? <AmountTable amounts={row.benefitComparison} /> : <Alert type="info" message={row.benefitComparison?.message ?? '该记录没有收益测算数据'} />}
      {row.benefitComparison && <Descriptions size="small" bordered column={{
              xs: 1,
              sm: 2
            }} items={[...FIELDS.map(field => ({
              key: field.key,
              label: field.label,
              children: row.benefitComparison?.assumptions[field.key] == null ? '未填' : String(row.benefitComparison.assumptions[field.key])
            })), {
              key: 'source',
              label: '依据说明',
              children: row.benefitComparison.assumptions.sourceNote || '未填'
            }]} />}
    </Space>
        }))} />}
  </Space>;
    };
  }
});
export const RescheduleBenefitHistory = defineComponent({
  name: "RescheduleBenefitHistory",
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
    let saved: {
      benefitSummary?: RescheduleBenefitSummary;
      rows?: BenefitRow[];
      changes?: BenefitRow[];
    };
    return () => {
      try {
        const parsed: unknown = typeof __props.snapshot === 'string' ? JSON.parse(__props.snapshot) : __props.snapshot;
        if (!parsed || typeof parsed !== 'object') throw new Error();
        saved = parsed as typeof saved;
        if (!saved.benefitSummary || !Array.isArray(saved.rows ?? saved.changes)) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该历史记录没有收益测算快照，不使用当前价格补算" />;
      } catch {
        return <Alert type="warning" message="历史快照无法读取，未使用当前参数替代" />;
      }
      return <><Alert style={{
          marginBottom: 12
        }} type="info" message="以下为负责人确认时的收益快照，不随当前价格、参数或天气变化" /><RescheduleBenefitView summary={saved.benefitSummary} rows={saved.rows ?? saved.changes} /></>;
    };
  }
});
