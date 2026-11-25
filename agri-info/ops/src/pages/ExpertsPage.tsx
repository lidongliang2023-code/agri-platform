import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Form, Input, Modal, Radio, Table, Tag, message } from "../components/vue-ui";
import type { ColumnsType } from "ant-design-vue/es/table";
import { opsApi } from '../api';
import type { Expert, ExpertsAdmin } from '../types';
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, StatusTag, formatCount } from '../components/ui';

/**
 * 专家审核：核验证书编号与执业单位，通过后专家在用户端展示认证标识并可接单答疑。
 * 驳回必须写原因，用户端「专家认证」页会展示该意见。
 */
export const ExpertsPage = defineComponent({
  name: "ExpertsPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const data = ref<ExpertsAdmin | null>(null);
    const setData = (next: ExpertsAdmin | null | ((previous: ExpertsAdmin | null) => ExpertsAdmin | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: ExpertsAdmin | null) => ExpertsAdmin | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const status = ref('pending');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const detail = ref<Expert | null>(null);
    const setDetail = (next: Expert | null | ((previous: Expert | null) => Expert | null)) => {
      detail.value = typeof next === 'function' ? (next as (previous: Expert | null) => Expert | null)(detail.value) : next;
    };
    const target = ref<Expert | null>(null);
    const setTarget = (next: Expert | null | ((previous: Expert | null) => Expert | null)) => {
      target.value = typeof next === 'function' ? (next as (previous: Expert | null) => Expert | null)(target.value) : next;
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
      opsApi.experts(next.status === 'all' ? undefined : next.status).then(setData).catch((reason: Error) => setError(reason.message));
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
      opsApi.auditExpert(target.value.id, values).then(result => {
        message.success(result.message);
        setTarget(null);
        form.resetFields();
        load();
      }).catch((reason: Error) => message.error(reason.message)).finally(() => setSubmitting(false));
    };
    const columns = computed<ColumnsType<Expert>>(() => [{
      title: '专家',
      dataIndex: 'name',
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="row" style={{
        gap: "8px"
      }}>
          <span class="expert-avatar">{record.name.slice(0, 1)}</span>
          <div class="table-title-cell">
            <b>{record.name}</b>
            <span class="small muted">{record.title} · {record.orgName}</span>
          </div>
        </div>
    }, {
      title: '领域',
      dataIndex: 'field',
      width: 110
    }, {
      title: '区域',
      dataIndex: 'region',
      width: 110
    }, {
      title: '证书编号',
      dataIndex: 'certNo',
      width: 140
    }, {
      title: '等级',
      dataIndex: 'level',
      width: 100,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <Tag class="soft-tag">{value}</Tag>
    }, {
      title: '答疑',
      dataIndex: 'answerCount',
      width: 80
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
      title: '提交时间',
      dataIndex: 'applyAt',
      width: 120
    }, {
      title: '操作',
      width: 150,
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="row" style={{
        gap: "6px"
      }}>
          <Button size="small" onClick={() => setDetail(record)}>详情</Button>
          <Button size="small" type="primary" onClick={() => {
          setTarget(record);
          form.resetFields();
        }}>审核</Button>
        </div>
    }]);
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_status = status.value;
      const view_columns = columns.value;
      const view_detail = detail.value;
      const view_target = target.value;
      const view_submitting = submitting.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={() => load()} />;
      return <div class="page-stack">
      <PageTitle eyebrow="EXPERT REVIEW" title="专家审核" description="核验职称证书、执业单位与领域匹配度 · 通过后展示认证标识并开放接单 · 承诺 3 个工作日内完成" />

      <div class="grid-4">
        <StatTile label="申请总量" value={view_data.counts.all} unit="位" />
        <StatTile label="待审核" value={view_data.counts.pending} unit="位" note="3 个工作日内处理" tone="warn" />
        <StatTile label="已通过" value={view_data.counts.approved} unit="位" note="用户端可咨询" tone="up" />
        <StatTile label="未通过" value={view_data.counts.rejected} unit="位" note="可补充材料后重申" />
      </div>

      <section class="surface-card">
        <div class="chip-row" style={{
            marginBottom: "12px"
          }}>
          {[{
              key: 'pending',
              label: '待审核'
            }, {
              key: 'approved',
              label: '已通过'
            }, {
              key: 'rejected',
              label: '未通过'
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
          }} scroll={{
            x: 1120
          }} />
      </section>

      <Drawer open={Boolean(view_detail)} onClose={() => setDetail(null)} width={540} title={view_detail ? `${view_detail.name} · ${view_detail.title}` : ''}>
        {view_detail && <div class="stack">
            <div class="row" style={{
              gap: "8px",
              flexWrap: 'wrap'
            }}>
              <Tag class="soft-tag tone-green">{view_detail.level}</Tag>
              <Tag class="soft-tag">{view_detail.field}</Tag>
              <Tag class="soft-tag">{view_detail.region}</Tag>
              <StatusTag status={view_detail.status} />
            </div>
            <p class="small">{view_detail.intro}</p>
            <div class="kv-list">
              <div class="kv"><span>所在单位</span><b>{view_detail.orgName}</b></div>
              <div class="kv"><span>证书编号</span><b>{view_detail.certNo}</b></div>
              <div class="kv"><span>累计答疑</span><b>{view_detail.answerCount} 条</b></div>
              <div class="kv"><span>用户评分</span><b>{Number(view_detail.rating).toFixed(1)} 分</b></div>
              <div class="kv"><span>关注人数</span><b>{formatCount(view_detail.followers)} 人</b></div>
              <div class="kv"><span>申请账号</span><b>{view_detail.owner}</b></div>
              <div class="kv"><span>提交时间</span><b>{view_detail.applyAt}</b></div>
              {view_detail.auditAt && <div class="kv"><span>审核时间</span><b>{view_detail.auditAt}</b></div>}
            </div>
            {view_detail.auditNote && <p class="source-note">审核意见：{view_detail.auditNote}</p>}
            <SectionHeading kicker="VERIFY" title="资质核验要点" />
            <ul class="safety-list">
              <li>证书编号格式应为「省份缩写-年份-序号」，与发证单位匹配。</li>
              <li>执业单位需为农业技术推广、科研院所或具备培训资质的机构。</li>
              <li>领域与历史答疑内容应一致，避免跨领域误导农户。</li>
            </ul>
            <Button type="primary" onClick={() => {
              setDetail(null);
              setTarget(view_detail);
              form.resetFields();
            }}>审核该专家</Button>
          </div>}
      </Drawer>

      <Modal open={Boolean(view_target)} title={`专家审核：${view_target?.name ?? ''}`} onCancel={() => setTarget(null)} onOk={() => form.submit()} okText="提交结论" confirmLoading={view_submitting}>
        <Form form={form} layout="vertical" onFinish={submit} initialValues={{
            action: 'approve'
          }}>
          <Form.Item name="action" label="审核结论" rules={[{
              required: true
            }]}>
            <Radio.Group>
              <Radio.Button value="approve">通过认证</Radio.Button>
              <Radio.Button value="reject">驳回</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="note" label="审核意见" extra="驳回时必须填写原因，申请人可在「专家认证」页看到">
            <Input.TextArea rows={4} maxlength={200} showCount placeholder="例：证书编号与发证单位不匹配，请补充职称证书扫描件" />
          </Form.Item>
        </Form>
      </Modal>
    </div>;
    };
  }
});
