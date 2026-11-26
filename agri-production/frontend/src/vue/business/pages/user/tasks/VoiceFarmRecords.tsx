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
import { randomId } from '@/utils/random-id';
import { useQuery, useQueryClient } from '@/vue/query';
import { Alert, App, Button, Card, Checkbox, Col, Descriptions, Drawer, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Tabs, Tag, Timeline, Tooltip, Typography, Upload } from '@/vue/ui';
import { AudioOutlined, CheckCircleOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons-vue';
import BusinessRecordList from '@/vue/business/components/BusinessRecordList';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { PageContainer } from '@/vue/pro';
import '@/components/ProductionListDense.css';
import dayjs from 'dayjs';
import useFarmStore from '@/vue/farmStore';
import useAuthStore from '@/vue/authStore';
import { createVoice, exportVoice, saveVoice, voiceAction, voiceAudio, voiceContext, voiceDetail, voiceList } from '@/api/voice-records';
import type { VoiceDetail, VoiceDraft, VoiceSummary } from '@/api/voice-records';
const TYPES = [{
  value: 'pest_control',
  label: '施药防治'
}, {
  value: 'fertilizing',
  label: '施肥'
}, {
  value: 'irrigating',
  label: '灌溉'
}, {
  value: 'ventilation',
  label: '通风控湿'
}, {
  value: 'pruning',
  label: '整枝疏果'
}, {
  value: 'harvesting',
  label: '采收'
}, {
  value: 'other',
  label: '其他农事'
}];
const STATES: Record<string, string> = {
  DRAFT: '待核对',
  REVIEW_REQUIRED: '异常待复核',
  ARCHIVED: '已确认归档',
  VOID: '已作废'
};
const EVENTS: Record<string, string> = {
  CREATED: '采集凭证',
  TRANSCRIBED: '真实转写尝试',
  EXTRACTED: '结构化提取尝试',
  REVISED: '修订与校验',
  REVIEWED: '技术员复核',
  ARCHIVED: '农户确认归档',
  VOID: '作废草稿'
};
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json;charset=utf-8'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const VoiceFarmRecords = defineComponent({
  name: "VoiceFarmRecords",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const farm = useFarmStore(s => s.currentFarm);
    const tenant = useAuthStore(s => s.userInfo?.tenantId);
    return () => {
      return <Workspace key={`${tenant.value}:${farm.value?.farmId}`} farmId={farm.value?.farmId} />;
    };
  }
});
export default VoiceFarmRecords;
const Workspace = defineComponent({
  name: "Workspace",
  props: {
    farmId: null as unknown as PropType<{
      farmId?: string;
    }["farmId"]>
  },
  setup(__props: {
    farmId?: string;
  }, {
    slots: __slots
  }) {
    const {
      message
    } = App.useApp();
    const cache = useQueryClient();
    const tab = shallowRef('all'),
      active = shallowRef<VoiceDetail>(),
      capture = shallowRef(false);
    const setCapture = (next: typeof capture.value | ((previous: typeof capture.value) => typeof capture.value)) => {
      capture.value = typeof next === 'function' ? (next as (previous: typeof capture.value) => typeof capture.value)(capture.value) : next;
    };
    const setActive = (next: typeof active.value | ((previous: typeof active.value) => typeof active.value)) => {
      active.value = typeof next === 'function' ? (next as (previous: typeof active.value) => typeof active.value)(active.value) : next;
    };
    const setTab = (next: typeof tab.value | ((previous: typeof tab.value) => typeof tab.value)) => {
      tab.value = typeof next === 'function' ? (next as (previous: typeof tab.value) => typeof tab.value)(tab.value) : next;
    };
    const draftKeyword = shallowRef(''),
      draftType = shallowRef<string>(),
      draftState = shallowRef<string>();
    const setDraftState = (next: typeof draftState.value | ((previous: typeof draftState.value) => typeof draftState.value)) => {
      draftState.value = typeof next === 'function' ? (next as (previous: typeof draftState.value) => typeof draftState.value)(draftState.value) : next;
    };
    const setDraftType = (next: typeof draftType.value | ((previous: typeof draftType.value) => typeof draftType.value)) => {
      draftType.value = typeof next === 'function' ? (next as (previous: typeof draftType.value) => typeof draftType.value)(draftType.value) : next;
    };
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const keyword = shallowRef(''),
      operationType = shallowRef<string>(),
      stateFilter = shallowRef<string>();
    const setStateFilter = (next: typeof stateFilter.value | ((previous: typeof stateFilter.value) => typeof stateFilter.value)) => {
      stateFilter.value = typeof next === 'function' ? (next as (previous: typeof stateFilter.value) => typeof stateFilter.value)(stateFilter.value) : next;
    };
    const setOperationType = (next: typeof operationType.value | ((previous: typeof operationType.value) => typeof operationType.value)) => {
      operationType.value = typeof next === 'function' ? (next as (previous: typeof operationType.value) => typeof operationType.value)(operationType.value) : next;
    };
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const selectedRowKeys = shallowRef<(string | number)[]>([]);
    const setSelectedRowKeys = (next: typeof selectedRowKeys.value | ((previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)) => {
      selectedRowKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)(selectedRowKeys.value) : next;
    };
    const transcript = shallowRef(''),
      file = shallowRef<File>(),
      busy = shallowRef(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const setFile = (next: typeof file.value | ((previous: typeof file.value) => typeof file.value)) => {
      file.value = typeof next === 'function' ? (next as (previous: typeof file.value) => typeof file.value)(file.value) : next;
    };
    const setTranscript = (next: typeof transcript.value | ((previous: typeof transcript.value) => typeof transcript.value)) => {
      transcript.value = typeof next === 'function' ? (next as (previous: typeof transcript.value) => typeof transcript.value)(transcript.value) : next;
    };
    const recording = shallowRef(false),
      seconds = shallowRef(0),
      audioUrl = shallowRef('');
    const setAudioUrl = (next: typeof audioUrl.value | ((previous: typeof audioUrl.value) => typeof audioUrl.value)) => {
      audioUrl.value = typeof next === 'function' ? (next as (previous: typeof audioUrl.value) => typeof audioUrl.value)(audioUrl.value) : next;
    };
    const setSeconds = (next: typeof seconds.value | ((previous: typeof seconds.value) => typeof seconds.value)) => {
      seconds.value = typeof next === 'function' ? (next as (previous: typeof seconds.value) => typeof seconds.value)(seconds.value) : next;
    };
    const setRecording = (next: typeof recording.value | ((previous: typeof recording.value) => typeof recording.value)) => {
      recording.value = typeof next === 'function' ? (next as (previous: typeof recording.value) => typeof recording.value)(recording.value) : next;
    };
    const autoProcess = shallowRef(true);
    const setAutoProcess = (next: typeof autoProcess.value | ((previous: typeof autoProcess.value) => typeof autoProcess.value)) => {
      autoProcess.value = typeof next === 'function' ? (next as (previous: typeof autoProcess.value) => typeof autoProcess.value)(autoProcess.value) : next;
    };
    const recorder = shallowRef<MediaRecorder>();
    const stream = shallowRef<MediaStream>();
    const timer = shallowRef<ReturnType<typeof setInterval>>();
    const draft = shallowRef<VoiceDraft>({}),
      editText = shallowRef(''),
      reason = shallowRef(''),
      dirty = shallowRef(false);
    const setDirty = (next: typeof dirty.value | ((previous: typeof dirty.value) => typeof dirty.value)) => {
      dirty.value = typeof next === 'function' ? (next as (previous: typeof dirty.value) => typeof dirty.value)(dirty.value) : next;
    };
    const setReason = (next: typeof reason.value | ((previous: typeof reason.value) => typeof reason.value)) => {
      reason.value = typeof next === 'function' ? (next as (previous: typeof reason.value) => typeof reason.value)(reason.value) : next;
    };
    const setEditText = (next: typeof editText.value | ((previous: typeof editText.value) => typeof editText.value)) => {
      editText.value = typeof next === 'function' ? (next as (previous: typeof editText.value) => typeof editText.value)(editText.value) : next;
    };
    const setDraft = (next: typeof draft.value | ((previous: typeof draft.value) => typeof draft.value)) => {
      draft.value = typeof next === 'function' ? (next as (previous: typeof draft.value) => typeof draft.value)(draft.value) : next;
    };
    const confirmOpen = shallowRef(false),
      confirmed = shallowRef(false),
      abnormal = shallowRef(false),
      existingUsageId = shallowRef<number>();
    const setExistingUsageId = (next: typeof existingUsageId.value | ((previous: typeof existingUsageId.value) => typeof existingUsageId.value)) => {
      existingUsageId.value = typeof next === 'function' ? (next as (previous: typeof existingUsageId.value) => typeof existingUsageId.value)(existingUsageId.value) : next;
    };
    const setAbnormal = (next: typeof abnormal.value | ((previous: typeof abnormal.value) => typeof abnormal.value)) => {
      abnormal.value = typeof next === 'function' ? (next as (previous: typeof abnormal.value) => typeof abnormal.value)(abnormal.value) : next;
    };
    const setConfirmed = (next: typeof confirmed.value | ((previous: typeof confirmed.value) => typeof confirmed.value)) => {
      confirmed.value = typeof next === 'function' ? (next as (previous: typeof confirmed.value) => typeof confirmed.value)(confirmed.value) : next;
    };
    const setConfirmOpen = (next: typeof confirmOpen.value | ((previous: typeof confirmOpen.value) => typeof confirmOpen.value)) => {
      confirmOpen.value = typeof next === 'function' ? (next as (previous: typeof confirmOpen.value) => typeof confirmOpen.value)(confirmOpen.value) : next;
    };
    const ctx = useQuery(() => ({
      queryKey: ['voice-context', __props.farmId],
      queryFn: () => voiceContext(__props.farmId!),
      enabled: !!__props.farmId
    }));
    const list = useQuery(() => ({
      queryKey: ['voice-records', __props.farmId],
      queryFn: () => voiceList(__props.farmId!),
      enabled: !!__props.farmId
    }));
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => () => {
          recorder.value?.state === 'recording' && recorder.value.stop();
          stream.value?.getTracks().forEach(t => t.stop());
          if (timer.value) clearInterval(timer.value);
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    onMounted(() => {
      watch(() => [audioUrl.value], (_next, _previous, onCleanup) => {
        const dispose = (() => () => {
          if (audioUrl.value) URL.revokeObjectURL(audioUrl.value);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const rows = computed(() => list.data ?? []);
    const editable = computed(() => !!active.value && ['DRAFT', 'REVIEW_REQUIRED'].includes(active.value.state));
    const filteredRows = computed(() => {
      const kw = keyword.value.trim().toLowerCase();
      const targetState = stateFilter.value ?? (tab.value === 'all' ? undefined : tab.value);
      return rows.value.filter(r => {
        if (targetState && r.state !== targetState) return false;
        if (operationType.value && r.operationType !== operationType.value) return false;
        if (kw) {
          const hay = `${r.id} ${r.plotName ?? ''} ${r.transcript ?? ''} ${r.confirmedBy ?? ''} ${r.operationDate ?? ''}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      });
    });
    const handleSearch = () => {
      setKeyword(draftKeyword.value.trim());
      setOperationType(draftType.value);
      setStateFilter(draftState.value);
      setTab(draftState.value && ['DRAFT', 'REVIEW_REQUIRED', 'ARCHIVED'].includes(draftState.value) ? draftState.value : 'all');
    };
    const handleReset = () => {
      setDraftKeyword('');
      setDraftType(undefined);
      setDraftState(undefined);
      setKeyword('');
      setOperationType(undefined);
      setStateFilter(undefined);
      setTab('all');
    };
    const handleTabChange = (nextTab: string) => {
      setTab(nextTab);
      const nextState = nextTab === 'all' ? undefined : nextTab;
      setDraftState(nextState);
      setStateFilter(nextState);
    };
    const inputType = computed(() => ['pest_control', 'fertilizing'].includes(draft.value.operationType ?? ''));
    const warnings = computed(() => active.value?.risks?.warnings ?? []),
      missing = computed(() => active.value?.risks?.missing ?? []);
    function show(value: VoiceDetail) {
      setActive(value);
      setDraft(value.draft ?? {});
      setEditText(value.transcript ?? '');
      setDirty(false);
      setAudioUrl('');
      setConfirmed(false);
      setAbnormal(false);
      setExistingUsageId(undefined);
      void cache.invalidateQueries({
        queryKey: ['voice-records', __props.farmId]
      });
    }
    function patch(value: Partial<VoiceDraft>) {
      setDraft(d => ({
        ...d,
        ...value
      }));
      setDirty(true);
    }
    async function run(action: () => Promise<void>) {
      setBusy(true);
      try {
        await action();
      } catch (e) {
        message.error(e instanceof Error ? e.message : '操作失败，请刷新后重试');
      } finally {
        setBusy(false);
      }
    }
    async function startRecording() {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        message.warning('当前环境不支持直接录音，请使用上传音频或文字补录。录音需安全页面环境。');
        return;
      }
      try {
        stream.value = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
        const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t));
        const rec = new MediaRecorder(stream.value, type ? {
          mimeType: type
        } : undefined);
        recorder.value = rec;
        const chunks: BlobPart[] = [];
        rec.ondataavailable = e => {
          if (e.data.size) chunks.push(e.data);
        };
        rec.onstop = () => {
          const mime = rec.mimeType || 'audio/webm';
          const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
          setFile(new File(chunks, `现场录音.${ext}`, {
            type: mime
          }));
          setRecording(false);
          stream.value?.getTracks().forEach(t => t.stop());
          if (timer.value) clearInterval(timer.value);
        };
        rec.start();
        setSeconds(0);
        setRecording(true);
        let elapsed = 0;
        timer.value = setInterval(() => {
          elapsed++;
          setSeconds(elapsed);
          if (elapsed >= 180 && rec.state === 'recording') rec.stop();
        }, 1000);
      } catch {
        stream.value?.getTracks().forEach(t => t.stop());
        message.error('无法访问麦克风，请上传录音或手工补录。');
      }
    }
    async function create() {
      const data = new FormData();
      data.append('farmId', __props.farmId!);
      data.append('requestId', randomId());
      data.append('transcript', transcript.value);
      if (file.value) data.append('audio', file.value);
      let result = await createVoice(data);
      setCapture(false);
      setFile(undefined);
      setTranscript('');
      show(result);
      if (autoProcess.value) {
        try {
          if (file.value && ctx.data?.asrConfigured && !transcript.value.trim()) {
            result = await voiceAction(result.id, 'transcribe', {
              revision: result.revision
            });
            show(result);
          }
          if (result.transcript?.trim()) {
            result = await voiceAction(result.id, 'extract', {
              revision: result.revision
            });
            show(result);
          }
        } catch {
          message.warning('原始凭证已保存，自动处理未完成，可在详情重试。');
        }
      }
      message.success('采集凭证已保存，请核对字段并确认归档');
    }
    async function act(action: string) {
      if (!active.value) return;
      if (dirty.value) {
        message.warning('请先保存核对字段再继续');
        return;
      }
      show(await voiceAction(active.value.id, action, {
        revision: active.value.revision,
        reason: reason.value,
        confirmed: confirmed.value,
        abnormalConfirmed: abnormal.value,
        existingUsageId: existingUsageId.value
      }));
      if (action === 'archive') {
        setConfirmOpen(false);
        message.success('已确认归档');
      }
    }
    return () => {
      const _activeAtStart = active.value;
      if (!__props.farmId) return <Empty description="请先在顶部选择农场" />;
      return <PageContainer class="production-list-dense production-member-list" title="语音农事归档" subTitle="采集凭证 → 七要素核对 → 异常复核 → 农户确认 → 原台账与溯源">
    {/* 统计统一放入列表工具栏。 */}
    {ctx.isError && <Alert type="error" message="当前农场数据加载失败" description="请刷新重试，未加载完成时不能创建或归档。" style={{
          marginBottom: 10
        }} />}
    <Card class="production-dense-filter-card">
      <ProductionListFilters onSearch={handleSearch} onReset={handleReset} loading={list.isLoading}>
        <div class="production-filter-field">
          <label>关键字</label>
          <Input allowClear placeholder="记录编号 / 地块 / 口述摘要 / 确认人" value={draftKeyword.value} onChange={e => setDraftKeyword(e.target.value)}  />
        </div>
        <div class="production-filter-field">
          <label>农事类型</label>
          <Select allowClear placeholder="全部类型" value={draftType.value} onChange={setDraftType} options={TYPES} />
        </div>
        <div class="production-filter-field">
          <label>状态</label>
          <Select allowClear placeholder="全部状态" value={draftState.value} onChange={setDraftState} options={Object.entries(STATES).map(([value, label]) => ({
                value,
                label
              }))} />
        </div>
      </ProductionListFilters>
    </Card>
    <Card>
      <Tabs activeKey={tab.value} onChange={handleTabChange} items={[{
            key: 'all',
            label: '全部采集凭证'
          }, {
            key: 'DRAFT',
            label: '待核对'
          }, {
            key: 'REVIEW_REQUIRED',
            label: '异常复核队列'
          }, {
            key: 'ARCHIVED',
            label: '归档台账'
          }]} />
      <BusinessRecordList memberListToolbar columnWidthStorageKey="voice-farm-records" rowKey="id" loading={list.isLoading} dataSource={filteredRows.value} onReload={() => list.refetch()} rowSelection={{
            selectedRowKeys: selectedRowKeys.value,
            onChange: setSelectedRowKeys
          }} toolbarTitle={<Space size={8} wrap>
            <Button type="primary" icon={<AudioOutlined />} onClick={() => setCapture(true)}>录音 / 补录</Button>
            <Button onClick={() => void run(async () => download(await exportVoice(__props.farmId ?? ''), '已确认农事归档.json'))}>导出已归档</Button>
          <ListSummary trigger="click" content={<div class="production-dense-summary">
      <div class="production-dense-summary-items">
        {[['待核对', rows.value.filter(r => r.state === 'DRAFT').length, ''], ['异常待复核', rows.value.filter(r => r.state === 'REVIEW_REQUIRED').length, 'is-warning'], ['已确认归档', rows.value.filter(r => r.state === 'ARCHIVED').length, 'is-success'], ['作业归档组', new Set(rows.value.filter(r => r.archiveGroup).map(r => r.archiveGroup)).size, '']].map(([title, value, cls]) => <span class="production-dense-metric" key={String(title)}>
            <span class="production-dense-metric-label">{title}</span>
            <span class={`production-dense-metric-value ${cls}`}>{value}</span>
          </span>)}
      </div>
      <Tooltip title={ctx.data?.notice ?? '语音必须经农户确认才能进入台账与溯源，异常记录先复核，原始音频保留六个月。'}>
        <span class="production-dense-summary-note">记录事实，不代替任务验收（统计最近 200 条）</span>
      </Tooltip>
    </div>}><Button>统计</Button></ListSummary></Space>} scroll={{
            x: 1080
          }} columns={[{
            title: '记录编号',
            dataIndex: 'id',
            width: 130,
            ellipsis: true,
            render: (_, r) => <Button type="link" size="small" onClick={() => void run(async () => show(await voiceDetail(r.id)))}>{String(r.id ?? '').slice(0, 8).toUpperCase()}</Button>
          }, {
            title: '地块 / 日期',
            key: 'plotDate',
            width: 180,
            ellipsis: true,
            render: (_, r) => {
              const txt = `${r.plotName ?? '待确认地块'} · ${r.operationDate ?? '待确认日期'}`;
              return <span class="production-dense-link-ellipsis" title={txt}>{txt}</span>;
            }
          }, {
            title: '口述摘要',
            dataIndex: 'transcript',
            width: 220,
            ellipsis: true
          }, {
            title: '农事类型',
            dataIndex: 'operationType',
            width: 110,
            render: v => TYPES.find(t => t.value === v)?.label ?? '待确认'
          }, {
            title: '结构化摘要',
            key: 'summary',
            width: 220,
            ellipsis: true,
            render: (_, r) => {
              try {
                const d = JSON.parse(r.draftJson ?? '{}') as VoiceDraft;
                const txt = `${d.operatedAt ?? '待确认时间'} · ${d.areaMu == null ? '待确认面积' : `${d.areaMu}亩`} · ${d.quantity == null ? d.durationHours == null ? '待核对' : `${d.durationHours}小时` : `${d.quantity}${d.unit ?? ''}`}`;
                return <span class="production-dense-link-ellipsis" title={txt}>{txt}</span>;
              } catch {
                return '待核对';
              }
            }
          }, {
            title: '抽取置信度',
            key: 'confidence',
            width: 110,
            align: 'right',
            render: (_, r) => {
              try {
                const e = JSON.parse(r.extractionJson ?? '{}') as {
                  suggestion?: {
                    confidence?: number;
                  };
                };
                return e.suggestion?.confidence ?? '未提取';
              } catch {
                return '未提取';
              }
            }
          }, {
            title: '状态',
            dataIndex: 'state',
            width: 120,
            render: (s: string) => <Tag color={s === 'ARCHIVED' ? 'green' : s === 'REVIEW_REQUIRED' ? 'orange' : 'default'}>{STATES[s] ?? s}</Tag>
          }, {
            title: '确认人',
            dataIndex: 'confirmedBy',
            width: 150,
            ellipsis: true,
            render: v => v ?? '未确认，不进入溯源'
          }, {
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 120,
            render: (_, r) => <ListRowActions><Button key="view" type="link" size="small" onClick={() => void run(async () => show(await voiceDetail(r.id)))}>查看 / 核对</Button></ListRowActions>
          }]} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true
          }} />
    </Card>
    <Modal open={capture.value} title="记录一段已发生的农事" onCancel={() => {
          if (recording.value) {
            message.warning('请先停止录音');
            return;
          }
          setCapture(false);
        }} onOk={() => void run(create)} okText="保存采集凭证" confirmLoading={busy.value} okButtonProps={{
          disabled: recording.value || !file.value && !transcript.value.trim() || !ctx.data
        }}>
      <Alert type={ctx.data?.asrConfigured ? 'info' : 'warning'} showIcon message={ctx.data?.asrConfigured ? ctx.data.asrCapability?.description ?? '真实转写可用，结果必须核对' : '语音转写暂不可用：支持保存录音和人工补录'} style={{
            marginBottom: 16
          }} />
      <Space wrap><Button danger={recording.value} icon={<AudioOutlined />} onClick={() => recording.value ? recorder.value?.stop() : void startRecording()}>{recording.value ? `停止录音 ${seconds.value}s / 180s` : '开始现场录音'}</Button><Upload maxCount={1} showUploadList={false} accept="audio/*,.webm,.m4a" beforeUpload={f => {
              if (f.size > 12 * 1024 * 1024) {
                message.error('音频不得超过12MB');
                return false;
              }
              setFile(f);
              return false;
            }}><Button icon={<UploadOutlined />} disabled={recording.value}>上传已有录音</Button></Upload></Space>
      {file.value && <Typography.Paragraph style={{
            marginTop: 12
          }}>{file.value.name} · {(file.value.size / 1024).toFixed(0)} KB <Button size="small" type="link" onClick={() => setFile(undefined)}>移除</Button></Typography.Paragraph>}
      <Typography.Paragraph type="secondary" style={{
            marginTop: 14
          }}>录音私有保存六个月，仅本农场授权人员可访问；可随时改为人工补录。上传应为真实音频，单次现场录音最长三分钟。</Typography.Paragraph>
      <Checkbox checked={autoProcess.value} onChange={e => setAutoProcess(e.target.checked)}>保存后自动转写并提取七要素（仍需核对确认）</Checkbox>
      <Input.TextArea rows={5} value={transcript.value} maxLength={8000} onChange={e => setTranscript(e.target.value)} placeholder="口述文本或人工补录：时间、地块、做了什么、投入品、数量、面积、作业人；不清楚的请保持为空，不猜测。" />
    </Modal>
    <Drawer open={!!_activeAtStart} onClose={() => {
          setActive(undefined);
          setAudioUrl('');
        }} width={Math.min(1100, window.innerWidth)} title={<Space><FileTextOutlined />记录核对与归档<Tag>{_activeAtStart ? STATES[_activeAtStart.state] : ''}</Tag></Space>}>
      {_activeAtStart && <Space direction="vertical" size="large" style={{
            width: '100%'
          }}>
        <Descriptions bordered size="small" column={2} items={[{
              key: 'id',
              label: '记录编号',
              children: _activeAtStart.id
            }, {
              key: 'version',
              label: '版本',
              children: _activeAtStart.revision
            }, {
              key: 'expire',
              label: '音频保留至',
              children: _activeAtStart.audioExpiresAt ? dayjs(_activeAtStart.audioExpiresAt).format('YYYY-MM-DD HH:mm') : '纯文本补录'
            }, {
              key: 'confirmed',
              label: '确认归档人',
              children: _activeAtStart.confirmedBy ?? '未确认'
            }, {
              key: 'group',
              label: '归档组',
              children: _activeAtStart.archiveGroup ?? '未归档'
            }, {
              key: 'usage',
              label: '原用量台账编号',
              children: _activeAtStart.usageId ?? '无'
            }]} />
        <Card size="small" title="1 · 原始凭证与真实转写" extra={<Space><Button disabled={!editable.value || !_activeAtStart.audioAvailable || dirty.value} loading={busy.value} onClick={() => void run(() => act('transcribe'))}>转写 / 重试</Button><Button disabled={!editable.value || dirty.value || !_activeAtStart.transcript} loading={busy.value} onClick={() => void run(() => act('extract'))}>提取七要素</Button></Space>}>
          <Space direction="vertical" style={{
                width: '100%'
              }}>
            {_activeAtStart.audioAvailable ? <><Button onClick={() => void run(async () => {
                    const blob = await voiceAudio(_activeAtStart.id);
                    setAudioUrl(URL.createObjectURL(blob));
                  })}>加载原始录音</Button>{audioUrl.value && <audio controls src={audioUrl.value} style={{
                    width: '100%'
                  }} />}</> : <Typography.Text type="secondary">无可播放录音，可能为文本补录或已超过保留期；文本和审计仍保留。</Typography.Text>}
            {_activeAtStart.asr && <Alert showIcon type={_activeAtStart.asr.status === 'SUCCESS' && (_activeAtStart.asr.confidence == null || _activeAtStart.asr.confidence >= 0.6) ? 'success' : 'warning'} message={_activeAtStart.asr.status === 'SUCCESS' ? `${_activeAtStart.asr.confidence != null && _activeAtStart.asr.confidence < 0.6 ? '低置信，请重点核对名称和数字 · ' : ''}${_activeAtStart.asr.provider === 'WINDOWS_LOCAL' ? '本机普通话真实转写' : '真实转写'}已返回${_activeAtStart.asr.confidence == null ? '' : ` · 识别置信度 ${_activeAtStart.asr.confidence.toFixed(2)}`}，请对照录音核对` : _activeAtStart.asr.message} />}
            <Input.TextArea rows={4} disabled={!editable.value} value={editText.value} maxLength={8000} onChange={e => {
                  setEditText(e.target.value);
                  setDirty(true);
                }} />
            {_activeAtStart.extraction && <Alert showIcon type={_activeAtStart.extraction.status === 'REAL_MODEL' ? 'info' : 'warning'} message={_activeAtStart.extraction.status === 'REAL_MODEL' ? `真实模型候选 · 抽取置信度 ${_activeAtStart.extraction.suggestion?.confidence ?? '未返回'}（不是事实正确率）` : _activeAtStart.extraction.message} description={_activeAtStart.extraction.status === 'REAL_MODEL' ? <><Typography.Paragraph>待确认字段：{_activeAtStart.extraction.suggestion?.uncertainFields?.join('、') || '请仍逐项核对'}</Typography.Paragraph><pre style={{
                    whiteSpace: 'pre-wrap'
                  }}>{JSON.stringify(_activeAtStart.extraction.suggestion, null, 2)}</pre><Button disabled={!editable.value} onClick={() => {
                    const suggestion = _activeAtStart.extraction?.suggestion?.draft;
                    if (suggestion && typeof suggestion === 'object') {
                      patch(suggestion);
                      message.info('已填入候选，必须逐项核对并保存');
                    }
                  }}>填入候选待核对</Button></> : undefined} />}
          </Space>
        </Card>
        <Card size="small" title="2 · 七要素与业务关联（不清楚的保持为空）">
          <Form layout="vertical" disabled={!editable.value}><Row gutter={16}>
            <Col span={12}><Form.Item label="地块"><Select allowClear value={draft.value.plotId} options={ctx.data?.plots.map(p => ({
                        value: p.id,
                        label: `${p.plotName} · ${p.area ?? '未知'}亩`
                      }))} onChange={v => patch({
                        plotId: v,
                        batchId: undefined
                      })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="农事类型"><Select value={draft.value.operationType} options={TYPES} onChange={v => patch({
                        operationType: v,
                        inputId: undefined,
                        quantity: undefined,
                        unit: undefined
                      })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="实际作业时间（请核对，不自动填今天）"><Input type="datetime-local" value={draft.value.operatedAt ?? ''} onChange={e => patch({
                        operatedAt: e.target.value || undefined
                      })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="实际作业人"><Select allowClear value={draft.value.operatorId} options={ctx.data?.members.map(m => ({
                        value: m.id,
                        label: m.memberName
                      }))} onChange={v => patch({
                        operatorId: v
                      })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="实际作业面积（亩）"><InputNumber min={0.001} precision={3} style={{
                        width: '100%'
                      }} value={draft.value.areaMu} onChange={v => patch({
                        areaMu: v ?? undefined
                      })} /></Form.Item></Col>
            <Col span={12}><Form.Item label="关联原采收批次（采收必填，其他按实际关联）"><Select allowClear value={draft.value.batchId} options={ctx.data?.batches.filter(b => b.plotId === draft.value.plotId).map(b => ({
                        value: b.batchId,
                        label: `${b.batchNo} · ${b.harvestDate} · ${b.quantity}${b.unit}`
                      }))} onChange={v => patch({
                        batchId: v
                      })} /></Form.Item></Col>
            {inputType.value && <Col span={12}><Form.Item label="投入品档案（原台账，不按模糊名称自动匹配）"><Select showSearch optionFilterProp="label" allowClear value={draft.value.inputId} options={ctx.data?.inputs.map(i => ({
                        value: i.inputId,
                        label: i.inputName
                      }))} onChange={v => patch({
                        inputId: v,
                        unit: ctx.data?.inputs.find(i => i.inputId === v)?.unit
                      })} /></Form.Item></Col>}
            {(inputType.value || draft.value.operationType === 'harvesting') && <><Col span={6}><Form.Item label={inputType.value ? '实际投入总量' : '实际采收量'}><InputNumber min={0.001} style={{
                          width: '100%'
                        }} value={draft.value.quantity} onChange={v => patch({
                          quantity: v ?? undefined
                        })} /></Form.Item></Col><Col span={6}><Form.Item label="单位（斤须换算，台账单位须一致）"><Input value={draft.value.unit} onChange={e => patch({
                          unit: e.target.value
                        })} /></Form.Item></Col></>}
            {draft.value.operationType === 'ventilation' && <Col span={12}><Form.Item label="通风时长（小时）"><InputNumber min={0.01} value={draft.value.durationHours} onChange={v => patch({
                        durationHours: v ?? undefined
                      })} /></Form.Item></Col>}
            {draft.value.operationType === 'pest_control' && <><Col span={12}><Form.Item label="核验的登记上限（台账单位 / 亩）"><InputNumber min={0.001} value={draft.value.registeredMaxPerMu} onChange={v => patch({
                          registeredMaxPerMu: v ?? undefined
                        })} /></Form.Item></Col><Col span={12}><Form.Item label="核验的安全间隔（天）"><InputNumber min={0} precision={0} value={draft.value.safetyIntervalDays} onChange={v => patch({
                          safetyIntervalDays: v ?? undefined
                        })} /></Form.Item></Col><Col span={24}><Form.Item label="登记核验依据（登记证号、作物、适用范围及原文出处）"><Input value={draft.value.evidenceRef} onChange={e => patch({
                          evidenceRef: e.target.value
                        })} /></Form.Item></Col></>}
            <Col span={24}><Form.Item label="实际作业描述"><Input.TextArea rows={3} maxLength={4000} value={draft.value.description} onChange={e => patch({
                        description: e.target.value
                      })} /></Form.Item></Col>
          </Row></Form>
          {editable.value && <Space direction="vertical" style={{
                width: '100%'
              }}><Input.TextArea rows={2} value={reason.value} maxLength={1000} onChange={e => setReason(e.target.value)} placeholder="填写修订、复核或确认说明（至少2字）" /><Button type="primary" loading={busy.value} onClick={() => void run(async () => show(await saveVoice(_activeAtStart.id, _activeAtStart.revision, editText.value, draft.value, reason.value)))}>保存核对字段并校验</Button>{dirty.value && <Typography.Text type="warning">存在尚未保存的修改，保存后才可转写、复核或归档。</Typography.Text>}</Space>}
        </Card>
        <Card size="small" title="3 · 校验、复核与确认">
          <Space direction="vertical" style={{
                width: '100%'
              }}>{missing.value.length > 0 && <Alert type="error" showIcon message="缺失项阻止归档" description={missing.value.join('；')} />}{warnings.value.length > 0 && <Alert type="warning" showIcon message="异常必须技术员复核并由农户二次确认" description={warnings.value.join('；')} />}
            {_activeAtStart.reviewedBy && <Alert type="info" message={`复核人：${_activeAtStart.reviewedBy}`} description={_activeAtStart.reviewNote} />}
            {editable.value && <Space wrap><Button disabled={dirty.value || !!missing.value.length} loading={busy.value} onClick={() => void run(() => act('review'))}>技术员复核当前版本</Button><Button type="primary" icon={<CheckCircleOutlined />} disabled={dirty.value || !!missing.value.length || !draft.value.plotId} onClick={() => setConfirmOpen(true)}>农户确认归档</Button><Button danger disabled={dirty.value} onClick={() => void run(() => act('void'))}>作废草稿</Button></Space>}
            {_activeAtStart.groupRecords && <Alert type="success" message={`本作业归档组共 ${_activeAtStart.groupRecords.length} 段凭证`} description="同地块、同批次、同日、同类型合组展示，保留独立音频与时间；不自动累加用量。投入品及采收事实仍以原业务台账为准。" />}
          </Space>
        </Card>
        <Card size="small" title="操作留痕"><Timeline items={_activeAtStart.events.map((e, i) => ({
                key: i,
                children: <><strong>{EVENTS[e.type] ?? e.type}</strong> · {e.operator} · {dayjs(e.createdAt).format('MM-DD HH:mm')}<details><summary>查看当次证据快照</summary><pre style={{
                      whiteSpace: 'pre-wrap',
                      maxHeight: 250,
                      overflow: 'auto'
                    }}>{JSON.stringify(JSON.parse(e.payload), null, 2)}</pre></details></>
              }))} /></Card>
      </Space>}
    </Drawer>
    <Modal open={confirmOpen.value} title="确认实际发生的农事并归档" confirmLoading={busy.value} okText="确认归档" okButtonProps={{
          disabled: !confirmed.value || !!warnings.value.length && !abnormal.value
        }} onCancel={() => setConfirmOpen(false)} onOk={() => void run(() => act('archive'))}>
      <Space direction="vertical" style={{
            width: '100%'
          }}><Alert type="warning" showIcon message="归档后固定凭证，不能直接改写" description="药肥记录将调用原用量台账并扣减库存；采收仅关联已有批次，不重复入库。异常确认不是合规证明，也不自动完成或验收农事任务。" />
        {!!warnings.value.length && <Alert type="error" message={warnings.value.join('；')} />}
        {inputType.value && <><Typography.Text>如这是已登记用量的补充录音，请填写原用量编号；不填写表示新增实际用量，同日疑似重复会被拦截。</Typography.Text><InputNumber min={1} precision={0} value={existingUsageId.value} onChange={v => setExistingUsageId(v ?? undefined)} placeholder="已有用量编号（可选）" style={{
                width: '100%'
              }} /></>}
        <Checkbox checked={confirmed.value} onChange={e => setConfirmed(e.target.checked)}>我是实际作业人或主体负责人，已逐项核对时间、地块、农事、投入品、用量、面积、作业人。</Checkbox>
        {!!warnings.value.length && <Checkbox checked={abnormal.value} onChange={e => setAbnormal(e.target.checked)}>我已阅读异常和技术员复核意见，确认按实际事实留痕。</Checkbox>}
        <Input.TextArea rows={2} value={reason.value} onChange={e => setReason(e.target.value)} placeholder="确认说明（至少2字）" />
      </Space>
    </Modal>
  </PageContainer>;
    };
  }
});
