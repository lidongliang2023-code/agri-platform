import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Form, Input, InputNumber, Modal, Select, Table, Tag, message } from "../components/vue-ui";
import type { ColumnsType } from "ant-design-vue/es/table";
import { opsApi } from '../api';
import type { Attestation, AttestationsAdmin } from '../types';
import { ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, StatusTag } from '../components/ui';

/** 存证管理：内容审核通过后可发起上链，存证编号供用户端公开验真。 */
export const AttestationsPage = defineComponent({
  name: "AttestationsPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const data = ref<AttestationsAdmin | null>(null);
    const setData = (next: AttestationsAdmin | null | ((previous: AttestationsAdmin | null) => AttestationsAdmin | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: AttestationsAdmin | null) => AttestationsAdmin | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const detail = ref<Attestation | null>(null);
    const setDetail = (next: Attestation | null | ((previous: Attestation | null) => Attestation | null)) => {
      detail.value = typeof next === 'function' ? (next as (previous: Attestation | null) => Attestation | null)(detail.value) : next;
    };
    const createOpen = ref(false);
    const setCreateOpen = (next: typeof createOpen.value | ((previous: typeof createOpen.value) => typeof createOpen.value)) => {
      createOpen.value = typeof next === 'function' ? (next as (previous: typeof createOpen.value) => typeof createOpen.value)(createOpen.value) : next;
    };
    const form = useFormModel();
    const load = (): void => {
      setError('');
      opsApi.attestations().then(setData).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = load();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    const columns = computed<ColumnsType<Attestation>>(() => [{
      title: '存证内容',
      dataIndex: 'title',
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <div class="table-title-cell">
          <b>{record.title}</b>
          <span class="small muted">{record.attestNo} · {record.contentType === 'report' ? '研究报告' : record.contentType === 'quote' ? '行情数据' : '资讯内容'}</span>
        </div>
    }, {
      title: '链',
      dataIndex: 'chainName',
      width: 110
    }, {
      title: '区块高度',
      dataIndex: 'blockHeight',
      width: 120
    }, {
      title: '上链时间',
      dataIndex: 'attestedAt',
      width: 150
    }, {
      title: '验真',
      dataIndex: 'verifyCount',
      width: 90
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      customRender: ({
        text: value
      }: {
        text: any;
      }) => <StatusTag status={value} />
    }, {
      title: '操作',
      width: 90,
      customRender: ({
        text: _,
        record: record
      }: {
        text: any;
        record: any;
      }) => <Button size="small" onClick={() => setDetail(record)}>查看</Button>
    }]);
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_columns = columns.value;
      const view_detail = detail.value;
      const view_createOpen = createOpen.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={load} />;
      return <div class="page-stack">
      <PageTitle eyebrow="ATTESTATION" title="存证管理" description="关键内容上链存证，任何第三方可凭存证编号在线验真 · 哈希在平台内计算，原文不出平台" actions={<Button type="primary" onClick={() => {
          form.resetFields();
          setCreateOpen(true);
        }}>＋ 发起存证</Button>} />

      <div class="grid-4">
        <StatTile label="存证总量" value={view_data.stats.total} unit="条" />
        <StatTile label="已确认" value={view_data.stats.confirmed} unit="条" note="链上多节点共识" tone="up" />
        <StatTile label="累计验真" value={view_data.stats.verified} unit="次" note="含第三方验证" />
        <StatTile label="存证链" value={view_data.stats.chain} note="联盟链" />
      </div>

      <section class="surface-card">
        <SectionHeading kicker="LEDGER" title="存证清单" />
        <Table rowKey="id" size="middle" columns={view_columns} dataSource={view_data.items} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: total => `共 ${total} 条`
          }} />
      </section>

      <Drawer open={Boolean(view_detail)} onClose={() => setDetail(null)} width={560} title={view_detail?.attestNo ?? ''}>
        {view_detail && <div class="stack">
            <b>{view_detail.title}</b>
            <div class="row" style={{
              gap: "8px"
            }}>
              <Tag class="soft-tag">{view_detail.contentType}</Tag>
              <StatusTag status={view_detail.status} />
            </div>
            <div class="kv-list">
              <div class="kv"><span>关联内容 ID</span><b>{view_detail.contentId}</b></div>
              <div class="kv"><span>存证链</span><b>{view_detail.chainName}</b></div>
              <div class="kv"><span>区块高度</span><b>{view_detail.blockHeight}</b></div>
              <div class="kv"><span>上链时间</span><b>{view_detail.attestedAt}</b></div>
              <div class="kv"><span>存证主体</span><b>{view_detail.owner}</b></div>
              <div class="kv"><span>验真次数</span><b>{view_detail.verifyCount}</b></div>
            </div>
            <div>
              <p class="small muted">内容哈希（SHA-256）</p>
              <p class="hash-box">{view_detail.contentHash}</p>
            </div>
            <div>
              <p class="small muted">交易 ID</p>
              <p class="hash-box">{view_detail.txId}</p>
            </div>
            <Button onClick={() => message.success('存证编号已复制，可发送给第三方验真')}>复制存证编号</Button>
          </div>}
      </Drawer>

      <Modal open={view_createOpen} title="发起内容存证" onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="提交上链">
        <Form form={form} layout="vertical" initialValues={{
            contentType: 'article',
            contentId: 1
          }} onFinish={(values: Record<string, any>) => {
            opsApi.createAttestation(values).then(result => {
              message.success(`${result.message}：${result.attestNo}`);
              setCreateOpen(false);
              form.resetFields();
              load();
            }).catch((reason: Error) => message.error(reason.message));
          }}>
          <Form.Item name="title" label="存证标题" rules={[{
              required: true,
              message: '请填写标题'
            }]}>
            <Input placeholder="例：大蒜价格周度分析：库存收紧支撑价格上行" />
          </Form.Item>
          <div class="form-grid">
            <Form.Item name="contentType" label="内容类型" rules={[{
                required: true
              }]}>
              <Select options={[{
                  value: 'article',
                  label: '资讯内容'
                }, {
                  value: 'report',
                  label: '研究报告'
                }, {
                  value: 'quote',
                  label: '行情数据'
                }]} />
            </Form.Item>
            <Form.Item name="contentId" label="关联内容 ID" rules={[{
                required: true,
                message: '请填写内容 ID'
              }]}>
              <InputNumber style={{
                  width: '100%'
                }} min={1} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>;
    };
  }
});
