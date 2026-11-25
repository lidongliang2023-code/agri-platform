import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Form, Input, Modal, Radio, Table, message } from "../components/vue-ui";
import type { ColumnsType } from "ant-design-vue/es/table";
import { opsApi } from '../api';
import type { Report, ReportsAdmin } from '../types';
import { ErrorBlock, LoadingBlock, PageTitle, StatTile, StatusTag, formatCount } from '../components/ui';

/** 报告审核：报告发布后即进入用户端「研究报告」，并自动触发内容存证。 */
export const ReportsPage = defineComponent({
  name: "ReportsPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const data = ref<ReportsAdmin | null>(null);
    const setData = (next: ReportsAdmin | null | ((previous: ReportsAdmin | null) => ReportsAdmin | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: ReportsAdmin | null) => ReportsAdmin | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const status = ref('pending');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const target = ref<Report | null>(null);
    const setTarget = (next: Report | null | ((previous: Report | null) => Report | null)) => {
      target.value = typeof next === 'function' ? (next as (previous: Report | null) => Report | null)(target.value) : next;
    };
    const form = useFormModel();
    const submitting = ref(false);
    const setSubmitting = (next: typeof submitting.value | ((previous: typeof submitting.value) => typeof submitting.value)) => {
      submitting.value = typeof next === 'function' ? (next as (previous: typeof submitting.value) => typeof submitting.value)(submitting.value) : next;
    };
    const load = (overrides: Partial<{
      status: string;
    }> = {}): void => {
      const next = {
        status: status.value,
        ...overrides
      };
      setStatus(next.status);
      setError('');
      opsApi.reports(next.status === 'all' ? undefined : next.status).then(setData).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          load();
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    const submit = (values: {
      action: string;
      note?: string;
    }): void => {
      if (!target.value) return;
      setSubmitting(true);
      opsApi.auditReport(target.value.id, values).then(result => {
        message.success(result.message);
        setTarget(null);
        form.resetFields();
        load();
      }).catch((reason: Error) => message.error(reason.message)).finally(() => setSubmitting(false));
    };
    const columns = computed<ColumnsType<Report>>(() => [{
      title: '报告',
      dataIndex: 'title',
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="table-title-cell">
          <b>{record.title}</b>
          <span class="small muted">{record.reportNo} · {record.category} · {record.period}</span>
        </div>
    }, {
      title: '页数',
      dataIndex: 'pageCount',
      width: 80
    }, {
      title: '价格',
      dataIndex: 'price',
      width: 100,
      customRender: ({
        text: value,
        record: record
      }: {
        text: any;
        record: any;
      }) => record.isFree ? '免费' : `¥${Number(value).toFixed(2)}`
    }, {
      title: '下载',
      dataIndex: 'downloads',
      width: 90,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => formatCount(value)
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <StatusTag status={value} />
    }, {
      title: '发布时间',
      dataIndex: 'publishedAt',
      width: 150,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => value || '—'
    }, {
      title: '操作',
      width: 90,
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <Button size="small" type="primary" onClick={() => {
        setTarget(record);
        form.resetFields();
      }}>审核</Button>
    }]);
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_status = status.value;
      const view_columns = columns.value;
      const view_target = target.value;
      const view_submitting = submitting.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={() => load()} />;
      return <div class="page-stack">
      <PageTitle eyebrow="REPORT REVIEW" title="报告审核" description="报告需经审核后才对用户开放下载 · 关键结论自动上链存证 · 付费报告由平台统一结算" />

      <div class="grid-4">
        <StatTile label="报告总量" value={view_data.counts.all} unit="份" />
        <StatTile label="待审核" value={view_data.counts.pending} unit="份" note="承诺 1 个工作日" tone="warn" />
        <StatTile label="已发布" value={view_data.counts.published} unit="份" note="用户端可下载" tone="up" />
        <StatTile label="累计下载" value={formatCount(view_data.items.reduce((sum, item) => sum + item.downloads, 0))} unit="次" note="全平台统计" />
      </div>

      <section class="surface-card">
        <div class="chip-row" style={{
            marginBottom: "12px"
          }}>
          {[{
              key: 'pending',
              label: '待审核'
            }, {
              key: 'published',
              label: '已发布'
            }, {
              key: 'all',
              label: '全部'
            }].map(tab => <button type="button" key={tab.key} class={`chip${view_status === tab.key ? ' on' : ''}`} onClick={() => load({
              status: tab.key
            })}>
              {tab.label}
            </button>)}
        </div>
        <Table rowKey="id" size="middle" columns={view_columns} dataSource={view_data.items} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: total => `共 ${total} 条`
          }} />
      </section>

      <Modal open={Boolean(view_target)} title={`审核：${view_target?.title ?? ''}`} onCancel={() => setTarget(null)} onOk={() => form.submit()} okText="提交结论" confirmLoading={view_submitting}>
        {view_target && <div class="stack" style={{
            marginBottom: "12px"
          }}>
            <p class="small muted">{view_target.summary}</p>
            <p class="small muted">目录：{view_target.sections}</p>
          </div>}
        <Form form={form} layout="vertical" onFinish={submit} initialValues={{
            action: 'approve'
          }}>
          <Form.Item name="action" label="审核结论" rules={[{
              required: true
            }]}>
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
    </div>;
    };
  }
});
