import { defineComponent, ref, computed, onMounted } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Form, Input, InputNumber, Modal, Select, Tag, message } from "../components/vue-ui";
import type { JsxListColumn } from '@agri/shared/vue/antdv';
import { opsApi } from '../api';
import type { Attestation, AttestationsAdmin } from '../types';
import { InfoFilters, InfoList, InfoRowActions } from '../components/InfoList';
import { ErrorBlock, LoadingBlock, PageTitle, StatTile, StatusTag } from '../components/ui';

/** 存证管理：内容审核通过后可发起上链，存证编号供用户端公开验真。 */
export const AttestationsPage = defineComponent({
  name: "AttestationsPage",
  props: {},
  setup() {
    const data = ref<AttestationsAdmin | null>(null);
    const loading = ref(false);
    const error = ref('');
    const detail = ref<Attestation | null>(null);
    const createOpen = ref(false);
    const draft = ref('');
    const keyword = ref('');
    const contentType = ref('');
    const form = useFormModel();

    const load = (): void => {
      loading.value = true;
      error.value = '';
      opsApi.attestations()
        .then(res => { data.value = res; })
        .catch((reason: Error) => { error.value = reason.message; })
        .finally(() => { loading.value = false; });
    };

    onMounted(load);

    const visibleItems = computed(() => {
      const list = data.value?.items ?? [];
      const q = keyword.value.trim().toLowerCase();
      return list.filter(item => {
        if (contentType.value && item.contentType !== contentType.value) return false;
        if (!q) return true;
        return `${item.title} ${item.attestNo} ${item.owner ?? ''}`.toLowerCase().includes(q);
      });
    });

    const columns = computed<JsxListColumn[]>(() => [{
      title: '存证内容',
      dataIndex: 'title',
      width: 260,
      render: (_, record: Attestation) => (
        <div class="table-title-cell">
          <b>{record.title}</b>
          <span class="small muted">
            {record.attestNo} · {record.contentType === 'report' ? '研究报告' : record.contentType === 'quote' ? '行情数据' : '资讯内容'}
          </span>
        </div>
      )
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
      width: 160
    }, {
      title: '验真',
      dataIndex: 'verifyCount',
      width: 90
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => <StatusTag status={value} />
    }, {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_, record: Attestation) => (
        <InfoRowActions actions={[{ key: 'view', label: '查看', onClick: () => { detail.value = record; } }]} />
      )
    }]);

    return () => {
      const view_data = data.value;
      const view_detail = detail.value;
      if (!view_data && !error.value) return <LoadingBlock rows={4} />;
      if (error.value || !view_data) return <ErrorBlock message={error.value} onRetry={load} />;
      return (
        <div class="page-stack">
          <PageTitle
            eyebrow="ATTESTATION"
            title="存证管理"
            description="关键内容上链存证，任何第三方可凭存证编号在线验真 · 哈希在平台内计算，原文不出平台"
          />

          <div class="grid-4">
            <StatTile label="存证总量" value={view_data.stats.total} unit="条" />
            <StatTile label="已确认" value={view_data.stats.confirmed} unit="条" note="链上多节点共识" tone="up" />
            <StatTile label="累计验真" value={view_data.stats.verified} unit="次" note="含第三方验证" />
            <StatTile label="存证链" value={view_data.stats.chain} note="联盟链" />
          </div>

          <InfoList
            listId="attestations"
            rowKey="id"
            loading={loading.value}
            columns={columns.value}
            dataSource={visibleItems.value}
            onRefresh={load}
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
                        placeholder="搜索存证标题 / 编号"
                        onChange={(e: any) => { draft.value = e.target?.value ?? ''; }}
                        onPressEnter={() => { keyword.value = draft.value.trim(); }}
                      />
                    ),
                  },
                  {
                    label: '内容类型',
                    control: (
                      <Select
                        value={contentType.value}
                        options={[
                          { value: '', label: '全部类型' },
                          { value: 'article', label: '资讯内容' },
                          { value: 'report', label: '研究报告' },
                          { value: 'quote', label: '行情数据' },
                        ]}
                        onChange={v => { contentType.value = String(v ?? ''); }}
                      />
                    ),
                  },
                ]}
                onQuery={() => { keyword.value = draft.value.trim(); }}
                onReset={() => { draft.value = ''; keyword.value = ''; contentType.value = ''; }}
              />
            }
            toolbarLeft={
              <Button
                type="primary"
                onClick={() => {
                  form.resetFields();
                  createOpen.value = true;
                }}
              >
                ＋ 发起存证
              </Button>
            }
          />

          <Drawer open={Boolean(view_detail)} onClose={() => { detail.value = null; }} width={560} title={view_detail?.attestNo ?? ''}>
            {view_detail && (
              <div class="stack">
                <b>{view_detail.title}</b>
                <div class="row" style={{ gap: "8px" }}>
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
              </div>
            )}
          </Drawer>

          <Modal open={createOpen.value} title="发起内容存证" onCancel={() => { createOpen.value = false; }} onOk={() => form.submit()} okText="提交上链">
            <Form
              form={form}
              layout="vertical"
              initialValues={{ contentType: 'article', contentId: 1 }}
              onFinish={(values: Record<string, any>) => {
                opsApi.createAttestation(values).then(result => {
                  message.success(`${result.message}：${result.attestNo}`);
                  createOpen.value = false;
                  form.resetFields();
                  load();
                }).catch((reason: Error) => message.error(reason.message));
              }}
            >
              <Form.Item name="title" label="存证标题" rules={[{ required: true, message: '请填写标题' }]}>
                <Input placeholder="例：大蒜价格周度分析：库存收紧支撑价格上行" />
              </Form.Item>
              <div class="form-grid">
                <Form.Item name="contentType" label="内容类型" rules={[{ required: true }]}>
                  <Select
                    options={[
                      { value: 'article', label: '资讯内容' },
                      { value: 'report', label: '研究报告' },
                      { value: 'quote', label: '行情数据' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="contentId" label="关联内容 ID" rules={[{ required: true, message: '请填写内容 ID' }]}>
                  <InputNumber style={{ width: '100%' }} min={1} />
                </Form.Item>
              </div>
            </Form>
          </Modal>
        </div>
      );
    };
  }
});
