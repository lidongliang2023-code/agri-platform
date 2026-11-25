import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, message } from "../components/vue-ui";
import { opsApi } from '../api';
import type { CollectTask, CollectionAlert, CollectionAlertPolicy, CollectionFreshness } from '../types';
const kinds: Record<string, string> = {
  failure: '采集失败',
  rejection: '拒收率超限',
  stale: '有效采集超时',
  source_stale: '源报价过期'
};
const statuses: Record<string, string> = {
  open: '待处理',
  acknowledged: '已确认·待恢复',
  recovered: '已恢复/停止监测'
};
export const CollectionAlertsPanel = defineComponent({
  name: "CollectionAlertsPanel",
  props: {
    tasks: null as unknown as PropType<{
      tasks: CollectTask[];
    }["tasks"]>
  },
  setup(__props: {
    tasks: CollectTask[];
  }, {
    slots: __slots
  }) {
    const tasks = computed(() => __props.tasks);
    const status = ref('active');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const taskId = ref<number | undefined>(undefined);
    const setTaskId = (next: typeof taskId.value | ((previous: typeof taskId.value) => typeof taskId.value)) => {
      taskId.value = typeof next === 'function' ? (next as (previous: typeof taskId.value) => typeof taskId.value)(taskId.value) : next;
    };
    const data = ref<Awaited<ReturnType<typeof opsApi.collectionAlerts>> | undefined>(undefined);
    const setData = (next: typeof data.value | ((previous: typeof data.value) => typeof data.value)) => {
      data.value = typeof next === 'function' ? (next as (previous: typeof data.value) => typeof data.value)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const revision = ref(0);
    const setRevision = (next: typeof revision.value | ((previous: typeof revision.value) => typeof revision.value)) => {
      revision.value = typeof next === 'function' ? (next as (previous: typeof revision.value) => typeof revision.value)(revision.value) : next;
    };
    const policyTask = ref<number | undefined>(undefined);
    const setPolicyTask = (next: typeof policyTask.value | ((previous: typeof policyTask.value) => typeof policyTask.value)) => {
      policyTask.value = typeof next === 'function' ? (next as (previous: typeof policyTask.value) => typeof policyTask.value)(policyTask.value) : next;
    };
    const form = useFormModel();
    const ack = ref<CollectionAlert | undefined>(undefined);
    const setAck = (next: typeof ack.value | ((previous: typeof ack.value) => typeof ack.value)) => {
      ack.value = typeof next === 'function' ? (next as (previous: typeof ack.value) => typeof ack.value)(ack.value) : next;
    };
    const note = ref('');
    const setNote = (next: typeof note.value | ((previous: typeof note.value) => typeof note.value)) => {
      note.value = typeof next === 'function' ? (next as (previous: typeof note.value) => typeof note.value)(note.value) : next;
    };
    const saving = ref(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    onMounted(() => {
      watch(() => [status.value, taskId.value, revision.value], (_next, _prev, cleanup) => {
        const dispose = (() => {
          let alive = true;
          const load = (): void => {
            opsApi.collectionAlerts(status.value, taskId.value).then(value => {
              if (alive) {
                setData(value);
                setError('');
              }
            }).catch((reason: Error) => {
              if (alive) setError(reason.message);
            });
          };
          setData(undefined);
          load();
          const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') load();
          }, 15000);
          return () => {
            alive = false;
            window.clearInterval(timer);
          };
        })();
        if (typeof dispose === 'function') cleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const openPolicy = (): void => {
      if (!taskId.value) {
        message.info('请先选择采集任务');
        return;
      }
      opsApi.collectionAlertPolicy(taskId.value).then(value => {
        form.resetFields();
        form.setFieldsValue(value);
        setPolicyTask(taskId.value);
      }).catch((reason: Error) => message.error(reason.message));
    };
    return () => {
      const view_status = status.value;
      const view_taskId = taskId.value;
      const view_tasks = tasks.value;
      const view_data = data.value;
      const view_error = error.value;
      const view_policyTask = policyTask.value;
      const view_saving = saving.value;
      const view_ack = ack.value;
      const view_note = note.value;
      return <div class="stack">
    <Alert type="info" showIcon message="采集故障仅对平台运营可见，服务每15秒检查；同任务同类异常合并，恢复后保留历史。" description="默认连续失败1次、拒收率20%、180分钟无有效采集触发。连续失败达到3次或整批拒收升级为严重；升级后重新待处理。超时仅监测接入与自动调度均启用的任务，阈值应大于采集周期。这里记录站内运营告警，未发送短信、邮件或外部通知。" />
    <Space wrap>
      <Select aria-label="告警状态" value={view_status} onChange={value => setStatus(String(value ?? ''))} style={{
            width: "160px"
          }} options={[{
            value: 'active',
            label: '未恢复告警'
          }, {
            value: 'recovered',
            label: '恢复历史'
          }, {
            value: 'all',
            label: '全部告警'
          }]} />
      <Select aria-label="采集任务" allowClear placeholder="全部采集任务" value={view_taskId} onChange={value => setTaskId(value === undefined ? undefined : Number(value))} style={{
            width: "240px"
          }} options={view_tasks.map(t => ({
            value: t.id,
            label: t.name
          }))} />
      <Button onClick={openPolicy} disabled={!view_taskId}>配置所选任务告警</Button>
      <Button onClick={() => setRevision(v => v + 1)}>刷新</Button>
      <span>全部任务：未恢复 {view_data?.activeCount ?? '—'} 条 · 待处理 {view_data?.pendingCount ?? '—'} 条</span>
    </Space>
    <Alert type="info" showIcon message="源报价时效按每条在线报价的最新观测时间计算，重复采集、历史补采和价格不变均不重置报价年龄。" description="时效监测默认关闭；开启后仅在告警监测、接入与自动调度均启用时执行。年龄达到上限即过期，占比达到阈值告警，全部过期升级严重。没有样本经过一个最大年龄宽限期后告警；下线报价不计入，节假日不会自动豁免。" />
    <Table rowKey="taskId" dataSource={view_data?.freshness ?? []} size="small" scroll={{
          x: 1250
        }} pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: total => `共 ${total} 条`
        }} columns={[{
          title: '源报价时效 / 任务',
          customRender: ({
            text: _,
            record: r
          }: {
            text: any;
            record: any;
          }) => <div><b>{r.taskName}</b><div class="muted">{r.sourceName}</div></div>
        }, {
          title: '状态',
          dataIndex: 'state',
          customRender: ({
            text: v
          }: {
            text: any;
          }) => <Tag color={v === 'expired' ? 'red' : v === 'healthy' ? 'green' : 'default'}>{({
              paused: '未启用/暂停',
              no_samples: '暂无样本',
              expired: '过期超限',
              healthy: '阈值内'
            } as Record<string, string>)[v]}</Tag>
        }, {
          title: '过期 / 在线样本',
          customRender: ({
            text: _,
            record: r
          }: {
            text: any;
            record: any;
          }) => `${r.expired} / ${r.total}`
        }, {
          title: '过期占比',
          customRender: ({
            text: _,
            record: r
          }: {
            text: any;
            record: any;
          }) => r.expiredPercent == null ? '—' : `${r.expiredPercent}%`
        }, {
          title: '年龄上限 / 占比阈值',
          customRender: ({
            text: _,
            record: r
          }: {
            text: any;
            record: any;
          }) => `${r.maxAgeMinutes}分钟 / ${r.thresholdPercent}%`
        }, {
          title: '最旧 / 最新观测（北京时间）',
          customRender: ({
            text: _,
            record: r
          }: {
            text: any;
            record: any;
          }) => <div>{r.oldestObservedAt || '—'}<div>{r.latestObservedAt || '—'}</div></div>
        }, {
          title: '操作',
          customRender: ({
            text: _,
            record: r
          }: {
            text: any;
            record: any;
          }) => <Button size="small" onClick={() => {
            setTaskId(r.taskId);
            opsApi.collectionAlertPolicy(r.taskId).then(v => {
              form.resetFields();
              form.setFieldsValue(v);
              setPolicyTask(r.taskId);
            }).catch((e: Error) => message.error(e.message));
          }}>配置规则</Button>
        }]} />
    {view_error && <Alert type="error" showIcon message={view_error} />}
    <Table rowKey="id" loading={!view_data && !view_error} dataSource={view_data?.items ?? []} scroll={{
          x: 1500
        }} pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: total => `共 ${total} 条`
        }} expandedRowRender={({
          record: row
        }: {
          record: CollectionAlert;
        }) => <div class="stack"><p>异常原因：{row.detail}</p><p>确认：{row.ackBy || '尚未确认'} {row.ackAt} {row.ackNote}</p><p>恢复/停止监测：{row.recoveredAt || '尚未恢复'} {row.recoveryNote}</p></div>} columns={[{
          title: '任务 / 数据源',
          width: 230,
          customRender: ({
            text: _,
            record: row
          }: {
            text: any;
            record: any;
          }) => <div><b>{row.taskName}</b><div class="muted">{row.sourceName}</div></div>
        }, {
          title: '异常类型',
          dataIndex: 'alertType',
          width: 150,
          customRender: ({
            text: v
          }: {
            text: any;
          }) => kinds[v] || v
        }, {
          title: '级别',
          dataIndex: 'severity',
          width: 90,
          customRender: ({
            text: v
          }: {
            text: any;
          }) => <Tag color={v === 'critical' ? 'red' : 'orange'}>{v === 'critical' ? '严重' : '警告'}</Tag>
        }, {
          title: '状态',
          dataIndex: 'status',
          width: 170,
          customRender: ({
            text: v
          }: {
            text: any;
          }) => statuses[v] || v
        }, {
          title: '累计触发',
          dataIndex: 'hitCount',
          width: 90
        }, {
          title: '首次 / 最近触发（北京时间）',
          width: 225,
          customRender: ({
            text: _,
            record: row
          }: {
            text: any;
            record: any;
          }) => <div>{row.firstAt}<div>{row.lastAt}</div></div>
        }, {
          title: '异常摘要',
          dataIndex: 'detail',
          width: 330,
          ellipsis: true
        }, {
          title: '处理',
          width: 100,
          customRender: ({
            text: _,
            record: row
          }: {
            text: any;
            record: any;
          }) => <Button size="small" disabled={row.status !== 'open'} onClick={() => {
            setNote('');
            setAck(row);
          }}>确认处理</Button>
        }]} />
    <span class="muted">匹配 {view_data?.total ?? 0} 条，最多展示最近200条。重复报价计为接口有效完成，不代表源报价观测时间已更新。暂停监测的恢复原因会单独注明。</span>
    <Modal open={view_policyTask !== undefined} title={`采集告警规则 · ${view_tasks.find(t => t.id === view_policyTask)?.name ?? ''}`} confirmLoading={view_saving} onCancel={() => setPolicyTask(undefined)} onOk={() => form.submit()}>
      <p>启用或保存规则后从当前时点重新监测，不回放历史批次；已有告警在后续采集或关闭监测时恢复。</p>
      <Form form={form} layout="vertical" onFinish={(values: Record<string, any>) => {
            if (view_policyTask === undefined) return;
            setSaving(true);
            opsApi.saveCollectionAlertPolicy(view_policyTask, values as import('../types').CollectionAlertPolicy).then(result => {
              message.success(result.message);
              setPolicyTask(undefined);
              setRevision(v => v + 1);
            }).catch((reason: Error) => message.error(reason.message)).finally(() => setSaving(false));
          }}>
        <Form.Item name="enabled" label="开启运营告警监测" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="failureThreshold" label="连续失败次数（1～10）" rules={[{
              required: true
            }]}><InputNumber min={1} max={10} precision={0} /></Form.Item>
        <Form.Item name="rejectPercent" label="拒收率阈值（1～100%，含阈值）" rules={[{
              required: true
            }]}><InputNumber min={1} max={100} precision={0} /></Form.Item>
        <Form.Item name="freshnessEnabled" label="开启源报价时效监测" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="maxAgeMinutes" label="报价最大年龄（5～43200分钟）" rules={[{
              required: true
            }]}><InputNumber min={5} max={43200} precision={0} /></Form.Item>
        <Form.Item name="expiredPercent" label="过期报价占比阈值（1～100%，含阈值）" rules={[{
              required: true
            }]}><InputNumber min={1} max={100} precision={0} /></Form.Item>
        <Form.Item name="staleMinutes" label="无有效采集超时（5～10080分钟）" rules={[{
              required: true
            }]}><InputNumber min={5} max={10080} precision={0} /></Form.Item>
      </Form>
    </Modal>
    <Modal open={Boolean(view_ack)} title={`确认处理 · ${view_ack?.taskName ?? ''}`} confirmLoading={view_saving} onCancel={() => setAck(undefined)} onOk={() => {
          if (!view_ack) return;
          if (!view_note.trim()) {
            message.warning('请填写处理说明');
            return;
          }
          setSaving(true);
          opsApi.acknowledgeCollectionAlert(view_ack.id, view_note).then(result => {
            message.success(result.message);
            setAck(undefined);
            setRevision(v => v + 1);
          }).catch((reason: Error) => message.error(reason.message)).finally(() => setSaving(false));
        }}>
      <p>确认代表运营已接手排查。告警仍保留在未恢复列表，异常解除后自动恢复。</p>
      <Input.TextArea aria-label="处理说明" rows={4} maxlength={500} showCount value={view_note} onChange={e => setNote((e.target as HTMLInputElement).value)} placeholder="填写排查措施、处理人或跟进计划" />
    </Modal>
  </div>;
    };
  }
});
