import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Form, Input, Modal, Radio, Table, Tag, message } from "../components/vue-ui";
import type { ColumnsType } from "ant-design-vue/es/table";
import { opsApi } from '../api';
import type { SupplyDemand, SupplyDemandsAdmin } from '../types';
import { ErrorBlock, LoadingBlock, PageTitle, StatTile, StatusTag } from '../components/ui';

/**
 * 供需审核：审核通过后信息才在用户端大厅展示并参与 AI 撮合，
 * 因此这里是信息质量的关键闸门；联系方式脱敏展示，防止运营侧泄露。
 */
export const SupplyDemandsPage = defineComponent({
  name: "SupplyDemandsPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const data = ref<SupplyDemandsAdmin | null>(null);
    const setData = (next: SupplyDemandsAdmin | null | ((previous: SupplyDemandsAdmin | null) => SupplyDemandsAdmin | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: SupplyDemandsAdmin | null) => SupplyDemandsAdmin | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const status = ref('pending');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const detail = ref<SupplyDemand | null>(null);
    const setDetail = (next: SupplyDemand | null | ((previous: SupplyDemand | null) => SupplyDemand | null)) => {
      detail.value = typeof next === 'function' ? (next as (previous: SupplyDemand | null) => SupplyDemand | null)(detail.value) : next;
    };
    const auditTarget = ref<SupplyDemand | null>(null);
    const setAuditTarget = (next: SupplyDemand | null | ((previous: SupplyDemand | null) => SupplyDemand | null)) => {
      auditTarget.value = typeof next === 'function' ? (next as (previous: SupplyDemand | null) => SupplyDemand | null)(auditTarget.value) : next;
    };
    const form = useFormModel();
    const submitting = ref(false);
    const setSubmitting = (next: typeof submitting.value | ((previous: typeof submitting.value) => typeof submitting.value)) => {
      submitting.value = typeof next === 'function' ? (next as (previous: typeof submitting.value) => typeof submitting.value)(submitting.value) : next;
    };
    const load = (overrides: Partial<{
      status: string;
      keyword: string;
    }> = {}): void => {
      const next = {
        status: status.value,
        keyword: keyword.value,
        ...overrides
      };
      setStatus(next.status);
      setKeyword(next.keyword);
      setError('');
      opsApi.supplyDemands({
        status: next.status === 'all' ? undefined : next.status,
        keyword: next.keyword || undefined
      }).then(setData).catch((reason: Error) => setError(reason.message));
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
      if (!auditTarget.value) return;
      setSubmitting(true);
      opsApi.auditSupplyDemand(auditTarget.value.id, values, auditTarget.value.sdType).then(result => {
        message.success(result.message);
        setAuditTarget(null);
        form.resetFields();
        load();
      }).catch((reason: Error) => message.error(reason.message)).finally(() => setSubmitting(false));
    };
    const columns = computed<ColumnsType<SupplyDemand>>(() => [{
      title: '信息',
      dataIndex: 'title',
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="table-title-cell">
          <b>{record.title}</b>
          <span class="small muted">{record.sdNo} · {record.orgName} · {record.createdAt}</span>
        </div>
    }, {
      title: '类型',
      dataIndex: 'sdType',
      width: 80,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <Tag class={`soft-tag ${value === 'supply' ? 'tone-green' : 'tone-blue'}`}>{value === 'supply' ? '供应' : '需求'}</Tag>
    }, {
      title: '品类',
      dataIndex: 'category',
      width: 80
    }, {
      title: '价格',
      dataIndex: 'price',
      width: 130,
      customRender: ({
        text: value,
        record: record
      }: {
        text: any;
        record: any;
      }) => `${Number(value).toFixed(2)} ${record.priceUnit}`
    }, {
      title: '数量',
      dataIndex: 'quantity',
      width: 130
    }, {
      title: '产地',
      dataIndex: 'origin',
      width: 140
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
      title: '操作',
      width: 160,
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
          setAuditTarget(record);
          form.resetFields();
        }}>审核</Button>
        </div>
    }]);
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_status = status.value;
      const view_keyword = keyword.value;
      const view_columns = columns.value;
      const view_detail = detail.value;
      const view_auditTarget = auditTarget.value;
      const view_submitting = submitting.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={() => load()} />;
      return <div class="page-stack">
      <PageTitle eyebrow="SUPPLY & DEMAND REVIEW" title="供需审核" description="审核对象直接来自交易撮合：供应=卖家中心商品，需求=买家中心采购需求 · 审核通过后才会在大厅展示 · 承诺 2 小时内完成" />

      <div class="grid-4">
        <StatTile label="信息总量" value={view_data.counts.all} unit="条" note="含历史归档" />
        <StatTile label="待审核" value={view_data.counts.pending} unit="条" note="承诺 2 小时内处理" tone="warn" />
        <StatTile label="在线" value={view_data.counts.online} unit="条" note="大厅可见" tone="up" />
        <StatTile label="已下架" value={view_data.counts.offline} unit="条" note="过期或违规" />
      </div>

      <section class="surface-card">
        <div class="row between" style={{
            marginBottom: "12px",
            flexWrap: 'wrap',
            gap: "10px"
          }}>
          <div class="chip-row">
            {[{
                key: 'pending',
                label: '待审核'
              }, {
                key: 'online',
                label: '在线'
              }, {
                key: 'offline',
                label: '已下架'
              }, {
                key: 'all',
                label: '全部'
              }].map(tab => <button type="button" key={tab.key} class={`chip${view_status === tab.key ? ' on' : ''}`} onClick={() => load({
                status: tab.key
              })}>
                {tab.label}
              </button>)}
          </div>
          <Input.Search allowClear style={{
              width: "240px"
            }} placeholder="搜索标题 / 主体 / 编号" defaultValue={view_keyword} onSearch={(value = "") => load({
              keyword: value.trim()
            })} />
        </div>

        <Table rowKey="id" size="middle" columns={view_columns} dataSource={view_data.items} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: total => `共 ${total} 条`
          }} scroll={{
            x: 1180
          }} />
      </section>

      <Drawer open={Boolean(view_detail)} onClose={() => setDetail(null)} width={560} title={view_detail?.title ?? ''}>
        {view_detail && <div class="stack">
            <div class="row" style={{
              gap: "8px",
              flexWrap: 'wrap'
            }}>
              <Tag class={`soft-tag ${view_detail.sdType === 'supply' ? 'tone-green' : 'tone-blue'}`}>{view_detail.sdType === 'supply' ? '供应' : '需求'}</Tag>
              <StatusTag status={view_detail.status} />
              {view_detail.verified && <Tag class="soft-tag tone-green">已认证</Tag>}
              {view_detail.badge && view_detail.badge !== '—' && <Tag class="soft-tag tone-amber">{view_detail.badge}</Tag>}
            </div>
            <div class="kv-list">
              <div class="kv"><span>信息编号</span><b>{view_detail.sdNo}</b></div>
              <div class="kv"><span>发布主体</span><b>{view_detail.orgName}（{view_detail.orgType}）</b></div>
              <div class="kv"><span>发布账号</span><b>{view_detail.owner}</b></div>
              <div class="kv"><span>联系人</span><b>{view_detail.contactName} · {view_detail.contactPhone}</b></div>
              <div class="kv"><span>规格</span><b>{view_detail.spec || '—'}</b></div>
              <div class="kv"><span>数量</span><b>{view_detail.quantity}</b></div>
              <div class="kv"><span>报价</span><b>{Number(view_detail.price).toFixed(2)} {view_detail.priceUnit}</b></div>
              <div class="kv"><span>产地</span><b>{view_detail.origin}</b></div>
              <div class="kv"><span>行情参照</span><b>{view_detail.marketRef}</b></div>
              <div class="kv"><span>有效期</span><b>{view_detail.validityLabel || '未提供有效期'}{view_detail.expireDate && `（${view_detail.expireDate}）`}</b></div>
              <div class="kv"><span>浏览 / 沟通</span><b>{view_detail.viewCount} / {view_detail.chatCount}</b></div>
            </div>
            {view_detail.auditNote && <p class="source-note">审核意见：{view_detail.auditNote}</p>}
            <Button type="primary" onClick={() => {
              setDetail(null);
              setAuditTarget(view_detail);
              form.resetFields();
            }}>审核该信息</Button>
          </div>}
      </Drawer>

      <Modal open={Boolean(view_auditTarget)} title={`审核：${view_auditTarget?.title ?? ''}`} onCancel={() => setAuditTarget(null)} onOk={() => form.submit()} okText="提交结论" confirmLoading={view_submitting}>
        <Form form={form} layout="vertical" onFinish={submit} initialValues={{
            action: 'approve'
          }}>
          <Form.Item name="action" label="审核结论" rules={[{
              required: true
            }]}>
            {/* 供应=商品货源，有真正的审核环节；采购需求发布即可见，运营只能下架或恢复。 */}
            {view_auditTarget?.sdType === 'demand' ? <Radio.Group>
                <Radio.Button value="approve">恢复展示</Radio.Button>
                <Radio.Button value="offline">下架</Radio.Button>
              </Radio.Group> : <Radio.Group>
                <Radio.Button value="approve">通过并上线</Radio.Button>
                <Radio.Button value="reject">驳回</Radio.Button>
                <Radio.Button value="offline">下架</Radio.Button>
              </Radio.Group>}
          </Form.Item>
          <Form.Item name="note" label="处理意见" extra="驳回或下架时必须填写原因，发布者可在「我的发布」中看到">
            <Input.TextArea rows={4} maxlength={200} showCount placeholder="例：报价明显高于平台监测价 60%，请补充规格说明后重新提交" />
          </Form.Item>
        </Form>
      </Modal>
    </div>;
    };
  }
});
