import { defineComponent, ref, computed, onMounted } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Form, Input, Modal, Radio, Select, message } from "../components/vue-ui";
import type { JsxListColumn } from '@agri/shared/vue/antdv';
import { opsApi } from '../api';
import type { Report, ReportsAdmin } from '../types';
import { InfoFilters, InfoList, InfoRowActions } from '../components/InfoList';
import { ErrorBlock, LoadingBlock, PageTitle, StatTile, StatusTag, formatCount } from '../components/ui';

/** 报告审核：报告发布后即进入用户端「研究报告」，并自动触发内容存证。 */
export const ReportsPage = defineComponent({
  name: "ReportsPage",
  props: {},
  setup() {
    const data = ref<ReportsAdmin | null>(null);
    const loading = ref(false);
    const error = ref('');
    const status = ref('pending');
    const draft = ref('');
    const keyword = ref('');
    const target = ref<Report | null>(null);
    const form = useFormModel();
    const submitting = ref(false);

    const load = (overrides: Partial<{ status: string }> = {}): void => {
      const nextStatus = overrides.status ?? status.value;
      status.value = nextStatus;
      loading.value = true;
      error.value = '';
      opsApi.reports(nextStatus === 'all' ? undefined : nextStatus)
        .then(res => { data.value = res; })
        .catch((reason: Error) => { error.value = reason.message; })
        .finally(() => { loading.value = false; });
    };

    onMounted(() => load());

    const submit = (values: { action: string; note?: string }): void => {
      if (!target.value) return;
      submitting.value = true;
      opsApi.auditReport(target.value.id, values)
        .then(result => {
          message.success(result.message);
          target.value = null;
          form.resetFields();
          load();
        })
        .catch((reason: Error) => message.error(reason.message))
        .finally(() => { submitting.value = false; });
    };

    const visibleItems = computed(() => {
      const list = data.value?.items ?? [];
      const q = keyword.value.trim().toLowerCase();
      if (!q) return list;
      return list.filter(item => `${item.title} ${item.reportNo} ${item.category}`.toLowerCase().includes(q));
    });

    const columns = computed<JsxListColumn[]>(() => [{
      title: '报告',
      dataIndex: 'title',
      width: 280,
      render: (_, record: Report) => (
        <div class="table-title-cell">
          <b>{record.title}</b>
          <span class="small muted">{record.reportNo} · {record.category} · {record.period}</span>
        </div>
      )
    }, {
      title: '页数',
      dataIndex: 'pageCount',
      width: 80
    }, {
      title: '价格',
      dataIndex: 'price',
      width: 100,
      render: (value, record: Report) => record.isFree ? '免费' : `¥${Number(value).toFixed(2)}`
    }, {
      title: '下载',
      dataIndex: 'downloads',
      width: 90,
      render: value => formatCount(value)
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => <StatusTag status={value} />
    }, {
      title: '发布时间',
      dataIndex: 'publishedAt',
      width: 160,
      render: value => value || '—'
    }, {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_, record: Report) => (
        <InfoRowActions
          actions={[{
            key: 'audit',
            label: '审核',
            onClick: () => {
              target.value = record;
              form.resetFields();
            },
          }]}
        />
      )
    }]);

    return () => {
      const view_data = data.value;
      const view_target = target.value;
      if (!view_data && !error.value) return <LoadingBlock rows={4} />;
      if (error.value || !view_data) return <ErrorBlock message={error.value} onRetry={() => load()} />;
      return (
        <div class="page-stack">
          <PageTitle
            eyebrow="REPORT REVIEW"
            title="报告审核"
            description="报告需经审核后才对用户开放下载 · 关键结论自动上链存证 · 付费报告由平台统一结算"
          />

          <div class="grid-4">
            <StatTile label="报告总量" value={view_data.counts.all} unit="份" />
            <StatTile label="待审核" value={view_data.counts.pending} unit="份" note="承诺 1 个工作日" tone="warn" />
            <StatTile label="已发布" value={view_data.counts.published} unit="份" note="用户端可下载" tone="up" />
            <StatTile label="累计下载" value={formatCount(view_data.items.reduce((sum, item) => sum + item.downloads, 0))} unit="次" note="全平台统计" />
          </div>

          <InfoList
            listId="reports"
            rowKey="id"
            loading={loading.value}
            columns={columns.value}
            dataSource={visibleItems.value}
            onRefresh={() => load()}
            filterSlot={
              <InfoFilters
                loading={loading.value}
                fields={[
                  {
                    label: '关键字',
                    control: (
                      <Input
                        allowClear
                        value={draft.value}
                        placeholder="搜索报告标题 / 编号 / 品类"
                        onChange={(e: any) => { draft.value = e.target?.value ?? ''; }}
                        onPressEnter={() => { keyword.value = draft.value.trim(); }}
                      />
                    ),
                  },
                  {
                    label: '审核状态',
                    control: (
                      <Select
                        value={status.value}
                        options={[
                          { value: 'pending', label: '待审核' },
                          { value: 'published', label: '已发布' },
                          { value: 'all', label: '全部' },
                        ]}
                        onChange={v => load({ status: String(v ?? 'pending') })}
                      />
                    ),
                  },
                ]}
                onQuery={() => {
                  keyword.value = draft.value.trim();
                  load();
                }}
                onReset={() => {
                  draft.value = '';
                  keyword.value = '';
                  load({ status: 'pending' });
                }}
              />
            }
          />

          <Modal
            open={Boolean(view_target)}
            title={`审核：${view_target?.title ?? ''}`}
            onCancel={() => { target.value = null; }}
            onOk={() => form.submit()}
            okText="提交结论"
            confirmLoading={submitting.value}
          >
            {view_target && (
              <div class="stack" style={{ marginBottom: "12px" }}>
                <p class="small muted">{view_target.summary}</p>
                <p class="small muted">目录：{view_target.sections}</p>
              </div>
            )}
            <Form form={form} layout="vertical" onFinish={submit} initialValues={{ action: 'approve' }}>
              <Form.Item name="action" label="审核结论" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio.Button value="approve">通过并发布</Radio.Button>
                  <Radio.Button value="reject">驳回</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item name="note" label="处理意见" extra="驳回时必须填写原因">
                <Input.TextArea rows={3} maxlength={200} showCount />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      );
    };
  }
});
