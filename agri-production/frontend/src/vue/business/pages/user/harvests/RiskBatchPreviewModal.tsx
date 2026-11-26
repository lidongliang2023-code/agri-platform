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
import { Alert, Button, Checkbox, DatePicker, Descriptions, Empty, Input, Modal, Space, Table, Tag, Typography } from '@/vue/ui';
import dayjs from 'dayjs';
import { applyRiskBatchReschedule, previewRiskBatchReschedule } from '@/api/harvest-window';
import type { RescheduleBenefitInput, RiskBatchApplyResult, RiskBatchPreview, RiskBatchPreviewRow } from '@/api/harvest-window';
import { RescheduleBenefitEditor, RescheduleBenefitView } from './RescheduleBenefit';
import { RescheduleComparisonView } from './RescheduleComparison';
interface Props {
  open: boolean;
  planId: string;
  dispatchIds: string[];
  dispatchLabels?: Record<string, string>;
  context: string;
  onClose: () => void;
  onApplied: (result: RiskBatchApplyResult) => void;
}
const RiskBatchPreviewModal = defineComponent({
  name: "RiskBatchPreviewModal",
  props: {
    open: null as unknown as PropType<{
      open: boolean;
      planId: string;
      dispatchIds: string[];
      dispatchLabels?: Record<string, string>;
      context: string;
      onClose: () => void;
      onApplied: (result: RiskBatchApplyResult) => void;
    }["open"]>,
    planId: null as unknown as PropType<{
      open: boolean;
      planId: string;
      dispatchIds: string[];
      dispatchLabels?: Record<string, string>;
      context: string;
      onClose: () => void;
      onApplied: (result: RiskBatchApplyResult) => void;
    }["planId"]>,
    dispatchIds: null as unknown as PropType<{
      open: boolean;
      planId: string;
      dispatchIds: string[];
      dispatchLabels?: Record<string, string>;
      context: string;
      onClose: () => void;
      onApplied: (result: RiskBatchApplyResult) => void;
    }["dispatchIds"]>,
    dispatchLabels: null as unknown as PropType<{
      open: boolean;
      planId: string;
      dispatchIds: string[];
      dispatchLabels?: Record<string, string>;
      context: string;
      onClose: () => void;
      onApplied: (result: RiskBatchApplyResult) => void;
    }["dispatchLabels"]>,
    context: null as unknown as PropType<{
      open: boolean;
      planId: string;
      dispatchIds: string[];
      dispatchLabels?: Record<string, string>;
      context: string;
      onClose: () => void;
      onApplied: (result: RiskBatchApplyResult) => void;
    }["context"]>,
    onClose: null as unknown as PropType<{
      open: boolean;
      planId: string;
      dispatchIds: string[];
      dispatchLabels?: Record<string, string>;
      context: string;
      onClose: () => void;
      onApplied: (result: RiskBatchApplyResult) => void;
    }["onClose"]>,
    onApplied: null as unknown as PropType<{
      open: boolean;
      planId: string;
      dispatchIds: string[];
      dispatchLabels?: Record<string, string>;
      context: string;
      onClose: () => void;
      onApplied: (result: RiskBatchApplyResult) => void;
    }["onApplied"]>
  },
  setup(__props: {
    open: boolean;
    planId: string;
    dispatchIds: string[];
    dispatchLabels?: Record<string, string>;
    context: string;
    onClose: () => void;
    onApplied: (result: RiskBatchApplyResult) => void;
  }, {
    slots: __slots
  }) {
    const benefitInputs = shallowRef<Record<string, RescheduleBenefitInput>>({});
    const setBenefitInputs = (next: typeof benefitInputs.value | ((previous: typeof benefitInputs.value) => typeof benefitInputs.value)) => {
      benefitInputs.value = typeof next === 'function' ? (next as (previous: typeof benefitInputs.value) => typeof benefitInputs.value)(benefitInputs.value) : next;
    };
    onMounted(() => {
      watch(() => [__props.planId, __props.context, __props.dispatchIds.join(',')], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setBenefitInputs({});
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const readyDate = shallowRef(dayjs().format('YYYY-MM-DD'));
    const setReadyDate = (next: typeof readyDate.value | ((previous: typeof readyDate.value) => typeof readyDate.value)) => {
      readyDate.value = typeof next === 'function' ? (next as (previous: typeof readyDate.value) => typeof readyDate.value)(readyDate.value) : next;
    };
    const searchEnd = shallowRef(dayjs().add(6, 'day').format('YYYY-MM-DD'));
    const setSearchEnd = (next: typeof searchEnd.value | ((previous: typeof searchEnd.value) => typeof searchEnd.value)) => {
      searchEnd.value = typeof next === 'function' ? (next as (previous: typeof searchEnd.value) => typeof searchEnd.value)(searchEnd.value) : next;
    };
    const result = shallowRef<RiskBatchPreview>();
    const setResult = (next: typeof result.value | ((previous: typeof result.value) => typeof result.value)) => {
      result.value = typeof next === 'function' ? (next as (previous: typeof result.value) => typeof result.value)(result.value) : next;
    };
    const busy = shallowRef(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const error = shallowRef<string>();
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const reason = shallowRef('');
    const setReason = (next: typeof reason.value | ((previous: typeof reason.value) => typeof reason.value)) => {
      reason.value = typeof next === 'function' ? (next as (previous: typeof reason.value) => typeof reason.value)(reason.value) : next;
    };
    const confirmed = shallowRef(false);
    const setConfirmed = (next: typeof confirmed.value | ((previous: typeof confirmed.value) => typeof confirmed.value)) => {
      confirmed.value = typeof next === 'function' ? (next as (previous: typeof confirmed.value) => typeof confirmed.value)(confirmed.value) : next;
    };
    const outsideConfirmed = shallowRef(false);
    const setOutsideConfirmed = (next: typeof outsideConfirmed.value | ((previous: typeof outsideConfirmed.value) => typeof outsideConfirmed.value)) => {
      outsideConfirmed.value = typeof next === 'function' ? (next as (previous: typeof outsideConfirmed.value) => typeof outsideConfirmed.value)(outsideConfirmed.value) : next;
    };
    const applying = shallowRef(false);
    const setApplying = (next: typeof applying.value | ((previous: typeof applying.value) => typeof applying.value)) => {
      applying.value = typeof next === 'function' ? (next as (previous: typeof applying.value) => typeof applying.value)(applying.value) : next;
    };
    const clock = shallowRef(Date.now());
    const setClock = (next: typeof clock.value | ((previous: typeof clock.value) => typeof clock.value)) => {
      clock.value = typeof next === 'function' ? (next as (previous: typeof clock.value) => typeof clock.value)(clock.value) : next;
    };
    const applyingRef = shallowRef(false);
    onMounted(() => {
      watch(() => [__props.open], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!__props.open) return;
          setClock(Date.now());
          const timer = window.setInterval(() => setClock(Date.now()), 1000);
          return () => window.clearInterval(timer);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const sequence = shallowRef(0);
    const inputSignature = computed(() => `${__props.context}|${__props.planId}|${__props.dispatchIds.join(',')}|${readyDate.value}|${searchEnd.value}|${__props.open}|${JSON.stringify(benefitInputs.value)}`);
    const latestInput = shallowRef(inputSignature.value);
    watchEffect(() => {
      latestInput.value = inputSignature.value;
    });
    const resultSignature = shallowRef('');
    const setResultSignature = (next: typeof resultSignature.value | ((previous: typeof resultSignature.value) => typeof resultSignature.value)) => {
      resultSignature.value = typeof next === 'function' ? (next as (previous: typeof resultSignature.value) => typeof resultSignature.value)(resultSignature.value) : next;
    };
    onMounted(() => {
      watch(() => [inputSignature.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          sequence.value += 1;
          setResult(undefined);
          setBusy(false);
          setError(undefined);
          setConfirmed(false);
          setOutsideConfirmed(false);
          setReason('');
          return () => {
            sequence.value += 1;
          };
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const visibleResult = computed(() => resultSignature.value === inputSignature.value ? result.value : undefined);
    const validDates = computed(() => readyDate.value >= dayjs().format('YYYY-MM-DD') && searchEnd.value >= readyDate.value && dayjs(searchEnd.value).diff(dayjs(readyDate.value), 'day') <= 30 && searchEnd.value <= dayjs().add(60, 'day').format('YYYY-MM-DD'));
    const expired = computed(() => Boolean(visibleResult.value && dayjs(visibleResult.value.previewExpiresAt).valueOf() <= clock.value));
    const outside = computed(() => Boolean(visibleResult.value?.rows.some(row => row.status === 'PROPOSED' && row.outsideWindow)));
    const canApply = computed(() => Boolean(visibleResult.value?.canApply && visibleResult.value.canConfirm && !expired.value && reason.value.trim() && reason.value.trim().length <= 500 && confirmed.value && (!outside.value || outsideConfirmed.value)));
    const apply = async () => {
      if (!visibleResult.value || !canApply.value || applyingRef.value) return;
      applyingRef.value = true;
      setApplying(true);
      setError(undefined);
      const signature = inputSignature.value;
      try {
        const applied = await applyRiskBatchReschedule(__props.planId, {
          dispatchIds: __props.dispatchIds,
          readyDate: readyDate.value,
          searchEnd: searchEnd.value,
          benefitInputs: benefitInputs.value,
          previewToken: visibleResult.value.previewToken,
          reason: reason.value.trim(),
          confirmed: confirmed.value,
          outsideWindowConfirmed: outsideConfirmed.value
        });
        if (signature === latestInput.value) {
          setResult(undefined);
          __props.onApplied(applied);
        }
      } catch (failure) {
        if (signature === latestInput.value) {
          setResult(undefined);
          setConfirmed(false);
          setOutsideConfirmed(false);
          setError(failure instanceof Error ? failure.message : '应用未确认成功，请刷新计划查看记录后重新预览');
        }
      } finally {
        applyingRef.value = false;
        setApplying(false);
      }
    };
    const calculate = async () => {
      if (applyingRef.value) return;
      const token = ++sequence.value;
      const signature = inputSignature.value;
      setBusy(true);
      setError(undefined);
      setResult(undefined);
      setConfirmed(false);
      setOutsideConfirmed(false);
      try {
        const data = await previewRiskBatchReschedule(__props.planId, {
          dispatchIds: __props.dispatchIds,
          readyDate: readyDate.value,
          searchEnd: searchEnd.value,
          benefitInputs: benefitInputs.value
        });
        if (token === sequence.value && signature === latestInput.value) {
          setResult(data);
          setResultSignature(signature);
        }
      } catch (failure) {
        if (token === sequence.value && signature === latestInput.value) setError(failure instanceof Error ? failure.message : '批量预览失败，请重试');
      } finally {
        if (token === sequence.value && signature === latestInput.value) setBusy(false);
      }
    };
    return () => {
      return <Modal title="按风险批量重排 · 预览与负责人确认" open={__props.open} width={1180} closable={!applying.value} maskClosable={!applying.value} keyboard={!applying.value} onCancel={() => {
        if (!applyingRef.value) __props.onClose();
      }} footer={<Space><Button disabled={applying.value} onClick={__props.onClose}>关闭</Button><Button type="primary" loading={applying.value} disabled={!canApply.value || busy.value} onClick={() => void apply()}>负责人确认并应用{visibleResult.value ? `（${visibleResult.value.proposedCount} 单）` : ''}</Button></Space>}>
    <Space direction="vertical" size={14} style={{
          width: '100%'
        }}>
      <Alert type="info" showIcon message={`已选择 ${__props.dispatchIds.length} 张派单 · 预览后由负责人整批确认`} description="候选按原日期、派单编号排序，共同校验本批及现有安排的资源占用。已开工或故障阻塞单不会自动移动；没有真实预报的日期不会生成可执行候选。" />
      <Space wrap>
        <Typography.Text>最早重排日期</Typography.Text><DatePicker aria-label="批量重排最早日期" allowClear={false} disabled={applying.value} value={dayjs(readyDate.value)} onChange={value => {
              if (value) setReadyDate(value.format('YYYY-MM-DD'));
            }} />
        <Typography.Text>搜索截止日</Typography.Text><DatePicker aria-label="批量重排搜索截止日" allowClear={false} disabled={applying.value} value={dayjs(searchEnd.value)} onChange={value => {
              if (value) setSearchEnd(value.format('YYYY-MM-DD'));
            }} />
        <Button type="primary" loading={busy.value} disabled={applying.value || !validDates.value || __props.dispatchIds.length < 1 || __props.dispatchIds.length > 50} onClick={() => void calculate()}>计算批量候选</Button>
      </Space>
      <RescheduleBenefitEditor ids={__props.dispatchIds} labels={__props.dispatchLabels} value={benefitInputs.value} disabled={applying.value || busy.value} onChange={setBenefitInputs} />
      {!validDates.value && <Alert type="warning" showIcon message="起始日期不得早于今天，截止日不得早于起始日；连续搜索不超过31天，截止日不超过今天后60天。" />}
      {error.value && <Alert type="error" showIcon message="批量重排未完成" description={error.value} />}
      {visibleResult.value ? <>
        <Descriptions size="small" column={{
              xs: 1,
              sm: 2,
              md: 3
            }} bordered items={[{
              key: 'version',
              label: '计划版本',
              children: visibleResult.value.baseVersion
            }, {
              key: 'snapshot',
              label: '天气快照',
              children: visibleResult.value.snapshotId ?? '未获取'
            }, {
              key: 'generated',
              label: '计算时间（北京时间）',
              children: visibleResult.value.generatedAt.replace('T', ' ')
            }, {
              key: 'proposed',
              label: '找到候选',
              children: `${visibleResult.value.proposedCount} 单`
            }, {
              key: 'blocked',
              label: '无法安排',
              children: `${visibleResult.value.blockedCount} 单`
            }, {
              key: 'unchanged',
              label: '无需重排',
              children: `${visibleResult.value.unchangedCount} 单`
            }, {
              key: 'area',
              label: '所选剩余面积',
              children: `${Number(visibleResult.value.affectedArea).toFixed(2)} 亩`
            }]} />
        <RescheduleComparisonView rows={visibleResult.value.rows} />
        <RescheduleBenefitView summary={visibleResult.value.benefitSummary} rows={visibleResult.value.rows} />
        <Table rowKey="dispatchId" size="small" scroll={{
              x: 1050
            }} pagination={{
              pageSize: 8,
              hideOnSinglePage: true
            }} dataSource={visibleResult.value.rows} expandable={{
              expandedRowRender: (row: import('@/api/harvest-window').RiskBatchPreviewRow) => <Space direction="vertical" style={{
                width: '100%'
              }}>
          <RescheduleBenefitView rows={[row]} />
          <Typography.Text strong>逐日未采用原因</Typography.Text>
          {row.rejectedDates.length ? row.rejectedDates.map(item => <Typography.Text key={item.date}>{item.date}：{item.reason}</Typography.Text>) : <Typography.Text type="secondary">无逐日拒绝记录</Typography.Text>}
        </Space>
            }} columns={[{
              title: '地块 / 原日期',
              key: 'plot',
              width: 175,
              render: (_, row) => <Space direction="vertical" size={0}><Typography.Text strong>{row.plotName}</Typography.Text><span>{row.oldDate}</span></Space>
            }, {
              title: '实际班次',
              key: 'shift',
              width: 155,
              render: (_, row) => `${row.shiftStart || '缺失'}–${row.shiftEnd || '缺失'}`
            }, {
              title: '剩余面积 / 用工',
              key: 'work',
              width: 140,
              render: (_, row) => `${Number(row.remainingArea).toFixed(2)} 亩 / ${row.people} 人`
            }, {
              title: '候选安排',
              key: 'candidate',
              width: 170,
              render: (_, row) => <Space direction="vertical" size={0}><Tag color={row.status === 'PROPOSED' ? 'blue' : row.status === 'BLOCKED' ? 'error' : 'default'}>{row.status === 'PROPOSED' ? '找到候选' : row.status === 'BLOCKED' ? '无法安排' : '无需重排'}</Tag>{row.newDate && <span>{row.newDate} · 延后 {row.delayDays ?? 0} 天</span>}{row.outsideWindow && <Tag color="warning">窗口外 · 待负责人复核</Tag>}</Space>
            }, {
              title: '风险与处理说明',
              key: 'reason',
              render: (_, row) => <Space direction="vertical" size={2}>{row.riskReason && <span>原单：{row.riskReason}</span>}{row.message && <span>{row.message}</span>}{row.blockers.map((blocker: string) => <Typography.Text type="danger" key={blocker}>{blocker}</Typography.Text>)}</Space>
            }]} />
        <Alert type={visibleResult.value.canApply ? 'info' : 'warning'} showIcon message={visibleResult.value.canApply ? '全部候选可整批应用；无需重排单保持不变' : '存在阻塞项或没有候选，不能应用；请调整勾选并重新计算'} description="应用后保留原单留痕并生成接续单，计划统一升一个版本并回到已确认。负责人须重新发布计划；发布前禁止执行回写，开工仍须通过最新天气核验。" />
        <Alert type="info" showIcon message="收益为人工参数情景测算，不保证获利" description="修改收益参数将作废旧预览。负责人确认时服务端重新计算并保存参数及结果；未填写收益不会阻断必要的安全重排，不以推测收益决定是否放行。展开派单可查看测算依据。" />
        <Typography.Text type={expired.value ? 'danger' : 'secondary'}>预览有效至（北京时间）：{visibleResult.value.previewExpiresAt.replace('T', ' ')}{expired.value ? ' · 已过期，请重新计算' : ' · 服务更新或基础数据变化后需重新预览'}</Typography.Text>
        {!visibleResult.value.canConfirm && <Alert type="warning" showIcon message="当前账号可查看预览，只有当前经营主体负责人可确认应用" />}
        <Input.TextArea aria-label="批量重排负责人确认说明" placeholder="填写成熟度复核、人员农机安排及延期影响的确认说明" value={reason.value} maxLength={500} showCount rows={3} disabled={applying.value || !visibleResult.value.canConfirm} onChange={event => setReason(event.target.value ?? '')} />
        <Checkbox disabled={applying.value || !visibleResult.value.canConfirm} checked={confirmed.value} onChange={event => setConfirmed(event.target.checked)}>我已复核本批派单、人员农机安排和延期风险，同意整批生成接续单并重新发布</Checkbox>
        {outside.value && <Checkbox disabled={applying.value || !visibleResult.value.canConfirm} checked={outsideConfirmed.value} onChange={event => setOutsideConfirmed(event.target.checked)}>本批包含窗口外候选，我已复核成熟度、品质与减产风险，并确认延期兜底安排</Checkbox>}
        {visibleResult.value.warnings.map(warning => <Typography.Paragraph key={warning} type="secondary" style={{
              marginBottom: 0
            }}>{warning}</Typography.Paragraph>)}
      </> : !busy.value && !error.value && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择搜索日期后计算；更改日期、所选派单、计划版本或天气数据将清除旧预览" />}
    </Space>
  </Modal>;
    };
  }
});
export default RiskBatchPreviewModal;
