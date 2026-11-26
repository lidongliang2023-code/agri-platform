import { defineComponent, ref, computed, watch, onMounted, type PropType } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Switch, Tag, message } from "../components/vue-ui";
import { opsApi } from '../api';
import type { CollectTask, CollectionAlert, CollectionAlertPolicy, CollectionFreshness } from '../types';
import { InfoFilters, InfoList, InfoRowActions } from '../components/InfoList';

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
    tasks: null as unknown as PropType<CollectTask[]>
  },
  setup(__props: { tasks: CollectTask[] }) {
    const tasks = computed(() => __props.tasks);
    const status = ref('active');
    const taskId = ref<number | undefined>(undefined);
    const data = ref<Awaited<ReturnType<typeof opsApi.collectionAlerts>> | undefined>(undefined);
    const error = ref('');
    const revision = ref(0);
    const policyTask = ref<number | undefined>(undefined);
    const form = useFormModel();
    const ack = ref<CollectionAlert | undefined>(undefined);
    const note = ref('');
    const saving = ref(false);

    onMounted(() => {
      watch(() => [status.value, taskId.value, revision.value], (_next, _prev, cleanup) => {
        let alive = true;
        const load = (): void => {
          opsApi.collectionAlerts(status.value, taskId.value)
            .then(value => {
              if (alive) {
                data.value = value;
                error.value = '';
              }
            })
            .catch((reason: Error) => {
              if (alive) error.value = reason.message;
            });
        };
        data.value = undefined;
        load();
        const timer = window.setInterval(() => {
          if (document.visibilityState === 'visible') load();
        }, 15000);
        cleanup(() => {
          alive = false;
          window.clearInterval(timer);
        });
      }, { immediate: true, flush: 'post' });
    });

    const openPolicy = (): void => {
      if (!taskId.value) {
        message.info('请先选择采集任务');
        return;
      }
      opsApi.collectionAlertPolicy(taskId.value).then(value => {
        form.resetFields();
        form.setFieldsValue(value);
        policyTask.value = taskId.value;
      }).catch((reason: Error) => message.error(reason.message));
    };

    const reload = () => { revision.value += 1; };

    return () => {
      const view_data = data.value;
      const view_ack = ack.value;
      const view_policyTask = policyTask.value;
      return (
        <div class="stack">
          <Alert
            type="info"
            showIcon
            message="采集故障仅对平台运营可见，服务每15秒检查；同任务同类异常合并，恢复后保留历史。"
            description="默认连续失败1次、拒收率20%、180分钟无有效采集触发。连续失败达到3次或整批拒收升级为严重；升级后重新待处理。超时仅监测接入与自动调度均启用的任务，阈值应大于采集周期。这里记录站内运营告警，未发送短信、邮件或外部通知。"
          />

          <InfoFilters
            loading={!view_data && !error.value}
            fields={[
              {
                label: '告警状态',
                control: (
                  <Select
                    aria-label="告警状态"
                    value={status.value}
                    onChange={value => { status.value = String(value ?? ''); }}
                    options={[
                      { value: 'active', label: '未恢复告警' },
                      { value: 'recovered', label: '恢复历史' },
                      { value: 'all', label: '全部告警' }
                    ]}
                  />
                ),
              },
              {
                label: '采集任务',
                control: (
                  <Select
                    aria-label="采集任务"
                    allowClear
                    placeholder="全部采集任务"
                    value={taskId.value}
                    onChange={value => { taskId.value = value === undefined ? undefined : Number(value); }}
                    options={tasks.value.map(t => ({ value: t.id, label: t.name }))}
                  />
                ),
              },
            ]}
            onQuery={reload}
            onReset={() => {
              status.value = 'active';
              taskId.value = undefined;
            }}
          />

          <Alert
            type="info"
            showIcon
            message="源报价时效按每条在线报价的最新观测时间计算，重复采集、历史补采和价格不变均不重置报价年龄。"
            description="时效监测默认关闭；开启后仅在告警监测、接入与自动调度均启用时执行。年龄达到上限即过期，占比达到阈值告警，全部过期升级严重。没有样本经过一个最大年龄宽限期后告警；下线报价不计入，节假日不会自动豁免。"
          />

          <InfoList
            listId="collection-freshness"
            rowKey="taskId"
            size="small"
            dataSource={view_data?.freshness ?? []}
            loading={!view_data && !error.value}
            onRefresh={reload}
            toolbarLeft={
              <>
                <Button onClick={openPolicy} disabled={!taskId.value}>配置所选任务告警</Button>
                <span class="small muted">全部任务：未恢复 {view_data?.activeCount ?? '—'} 条 · 待处理 {view_data?.pendingCount ?? '—'} 条</span>
              </>
            }
            columns={[
              {
                title: '源报价时效 / 任务',
                key: 'taskName',
                width: 220,
                render: (_, r: CollectionFreshness) => <div><b>{r.taskName}</b><div class="muted">{r.sourceName}</div></div>
              },
              {
                title: '状态',
                dataIndex: 'state',
                width: 120,
                render: v => (
                  <Tag color={v === 'expired' ? 'red' : v === 'healthy' ? 'green' : 'default'}>
                    {({ paused: '未启用/暂停', no_samples: '暂无样本', expired: '过期超限', healthy: '阈值内' } as Record<string, string>)[v] || v}
                  </Tag>
                )
              },
              {
                title: '过期 / 在线样本',
                key: 'samples',
                width: 130,
                render: (_, r: CollectionFreshness) => `${r.expired} / ${r.total}`
              },
              {
                title: '过期占比',
                key: 'expiredPercent',
                width: 100,
                render: (_, r: CollectionFreshness) => r.expiredPercent == null ? '—' : `${r.expiredPercent}%`
              },
              {
                title: '年龄上限 / 占比阈值',
                key: 'threshold',
                width: 160,
                render: (_, r: CollectionFreshness) => `${r.maxAgeMinutes}分钟 / ${r.thresholdPercent}%`
              },
              {
                title: '最旧 / 最新观测（北京时间）',
                key: 'observed',
                width: 220,
                render: (_, r: CollectionFreshness) => <div>{r.oldestObservedAt || '—'}<div>{r.latestObservedAt || '—'}</div></div>
              },
              {
                title: '操作',
                key: 'action',
                width: 110,
                fixed: 'right',
                render: (_, r: CollectionFreshness) => (
                  <InfoRowActions
                    actions={[{
                      key: 'policy',
                      label: '配置规则',
                      onClick: () => {
                        taskId.value = r.taskId;
                        opsApi.collectionAlertPolicy(r.taskId).then(v => {
                          form.resetFields();
                          form.setFieldsValue(v);
                          policyTask.value = r.taskId;
                        }).catch((e: Error) => message.error(e.message));
                      },
                    }]}
                  />
                )
              }
            ]}
          />

          {error.value && <Alert type="error" showIcon message={error.value} />}

          <InfoList
            listId="collection-alerts"
            rowKey="id"
            loading={!view_data && !error.value}
            dataSource={view_data?.items ?? []}
            onRefresh={reload}
            toolbarLeft={<span class="small muted">匹配 {view_data?.total ?? 0} 条，最多展示最近200条</span>}
            expandable={{
              expandedRowRender: (row: CollectionAlert) => (
                <div class="stack">
                  <p>异常原因：{row.detail}</p>
                  <p>确认：{row.ackBy || '尚未确认'} {row.ackAt} {row.ackNote}</p>
                  <p>恢复/停止监测：{row.recoveredAt || '尚未恢复'} {row.recoveryNote}</p>
                </div>
              )
            }}
            columns={[
              {
                title: '任务 / 数据源',
                key: 'taskName',
                width: 220,
                render: (_, row: CollectionAlert) => <div><b>{row.taskName}</b><div class="muted">{row.sourceName}</div></div>
              },
              {
                title: '异常类型',
                dataIndex: 'alertType',
                width: 140,
                render: v => kinds[v] || v
              },
              {
                title: '级别',
                dataIndex: 'severity',
                width: 90,
                render: v => <Tag color={v === 'critical' ? 'red' : 'orange'}>{v === 'critical' ? '严重' : '警告'}</Tag>
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 150,
                render: v => <Tag class="soft-tag">{statuses[v] || v}</Tag>
              },
              { title: '累计触发', dataIndex: 'hitCount', width: 90 },
              {
                title: '首次 / 最近触发（北京时间）',
                key: 'triggerTime',
                width: 210,
                render: (_, row: CollectionAlert) => <div>{row.firstAt}<div>{row.lastAt}</div></div>
              },
              { title: '异常摘要', dataIndex: 'detail', width: 280, ellipsis: true },
              {
                title: '操作',
                key: 'action',
                width: 110,
                fixed: 'right',
                render: (_, row: CollectionAlert) => (
                  <InfoRowActions
                    actions={[{
                      key: 'ack',
                      label: '确认处理',
                      disabled: row.status !== 'open',
                      onClick: () => {
                        note.value = '';
                        ack.value = row;
                      },
                    }]}
                  />
                )
              }
            ]}
          />

          <span class="muted">重复报价计为接口有效完成，不代表源报价观测时间已更新。暂停监测的恢复原因会单独注明。</span>

          <Modal
            open={view_policyTask !== undefined}
            title={`采集告警规则 · ${tasks.value.find(t => t.id === view_policyTask)?.name ?? ''}`}
            confirmLoading={saving.value}
            onCancel={() => { policyTask.value = undefined; }}
            onOk={() => form.submit()}
          >
            <p>启用或保存规则后从当前时点重新监测，不回放历史批次；已有告警在后续采集或关闭监测时恢复。</p>
            <Form
              form={form}
              layout="vertical"
              onFinish={(values: Record<string, any>) => {
                if (view_policyTask === undefined) return;
                saving.value = true;
                opsApi.saveCollectionAlertPolicy(view_policyTask, values as CollectionAlertPolicy)
                  .then(result => {
                    message.success(result.message);
                    policyTask.value = undefined;
                    reload();
                  })
                  .catch((reason: Error) => message.error(reason.message))
                  .finally(() => { saving.value = false; });
              }}
            >
              <Form.Item name="enabled" label="开启运营告警监测" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item name="failureThreshold" label="连续失败次数（1～10）" rules={[{ required: true }]}><InputNumber min={1} max={10} precision={0} /></Form.Item>
              <Form.Item name="rejectPercent" label="拒收率阈值（1～100%，含阈值）" rules={[{ required: true }]}><InputNumber min={1} max={100} precision={0} /></Form.Item>
              <Form.Item name="freshnessEnabled" label="开启源报价时效监测" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item name="maxAgeMinutes" label="报价最大年龄（5～43200分钟）" rules={[{ required: true }]}><InputNumber min={5} max={43200} precision={0} /></Form.Item>
              <Form.Item name="expiredPercent" label="过期报价占比阈值（1～100%，含阈值）" rules={[{ required: true }]}><InputNumber min={1} max={100} precision={0} /></Form.Item>
              <Form.Item name="staleMinutes" label="无有效采集超时（5～10080分钟）" rules={[{ required: true }]}><InputNumber min={5} max={10080} precision={0} /></Form.Item>
            </Form>
          </Modal>

          <Modal
            open={Boolean(view_ack)}
            title={`确认处理 · ${view_ack?.taskName ?? ''}`}
            confirmLoading={saving.value}
            onCancel={() => { ack.value = undefined; }}
            onOk={() => {
              if (!view_ack) return;
              if (!note.value.trim()) {
                message.warning('请填写处理说明');
                return;
              }
              saving.value = true;
              opsApi.acknowledgeCollectionAlert(view_ack.id, note.value)
                .then(result => {
                  message.success(result.message);
                  ack.value = undefined;
                  reload();
                })
                .catch((reason: Error) => message.error(reason.message))
                .finally(() => { saving.value = false; });
            }}
          >
            <p>确认代表运营已接手排查。告警仍保留在未恢复列表，异常解除后自动恢复。</p>
            <Input.TextArea
              aria-label="处理说明"
              rows={4}
              maxlength={500}
              showCount
              value={note.value}
              onChange={(e: any) => { note.value = e.target?.value ?? ''; }}
              placeholder="填写排查措施、处理人或跟进计划"
            />
          </Modal>
        </div>
      );
    };
  }
});
