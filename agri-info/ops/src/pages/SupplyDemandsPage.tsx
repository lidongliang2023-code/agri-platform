import { defineComponent, ref, computed, onMounted } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Drawer, Form, Input, Modal, Radio, Select, Tag, message } from "../components/vue-ui";
import type { JsxListColumn } from '@agri/shared/vue/antdv';
import { opsApi } from '../api';
import type { SupplyDemand, SupplyDemandsAdmin } from '../types';
import { InfoFilters, InfoList, InfoRowActions } from '../components/InfoList';
import { ErrorBlock, LoadingBlock, PageTitle, StatTile, StatusTag } from '../components/ui';

/**
 * 供需审核：审核通过后信息才在用户端大厅展示并参与 AI 撮合，
 * 因此这里是信息质量的关键闸门；联系方式脱敏展示，防止运营侧泄露。
 */
export const SupplyDemandsPage = defineComponent({
  name: "SupplyDemandsPage",
  props: {},
  setup() {
    const data = ref<SupplyDemandsAdmin | null>(null);
    const loading = ref(false);
    const error = ref('');
    const status = ref('pending');
    const draft = ref('');
    const keyword = ref('');
    const detail = ref<SupplyDemand | null>(null);
    const auditTarget = ref<SupplyDemand | null>(null);
    const form = useFormModel();
    const submitting = ref(false);

    const load = (overrides: Partial<{ status: string; keyword: string }> = {}): void => {
      const nextStatus = overrides.status ?? status.value;
      const nextKeyword = overrides.keyword ?? keyword.value;
      status.value = nextStatus;
      keyword.value = nextKeyword;
      loading.value = true;
      error.value = '';
      opsApi.supplyDemands({
        status: nextStatus === 'all' ? undefined : nextStatus,
        keyword: nextKeyword || undefined
      })
        .then(res => { data.value = res; })
        .catch((reason: Error) => { error.value = reason.message; })
        .finally(() => { loading.value = false; });
    };

    onMounted(() => load());

    const submit = (values: { action: string; note?: string }): void => {
      if (!auditTarget.value) return;
      submitting.value = true;
      opsApi.auditSupplyDemand(auditTarget.value.id, values, auditTarget.value.sdType)
        .then(result => {
          message.success(result.message);
          auditTarget.value = null;
          form.resetFields();
          load();
        })
        .catch((reason: Error) => message.error(reason.message))
        .finally(() => { submitting.value = false; });
    };

    const columns = computed<JsxListColumn[]>(() => [{
      title: '信息',
      dataIndex: 'title',
      width: 260,
      render: (_, record: SupplyDemand) => (
        <div class="table-title-cell">
          <b>{record.title}</b>
          <span class="small muted">{record.sdNo} · {record.orgName} · {record.createdAt}</span>
        </div>
      )
    }, {
      title: '类型',
      dataIndex: 'sdType',
      width: 90,
      render: value => <Tag class={`soft-tag ${value === 'supply' ? 'tone-green' : 'tone-blue'}`}>{value === 'supply' ? '供应' : '需求'}</Tag>
    }, {
      title: '品类',
      dataIndex: 'category',
      width: 90
    }, {
      title: '价格',
      dataIndex: 'price',
      width: 130,
      render: (value, record: SupplyDemand) => `${Number(value).toFixed(2)} ${record.priceUnit}`
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
      width: 100,
      render: value => <StatusTag status={value} />
    }, {
      title: '操作',
      key: 'action',
      width: 130,
      fixed: 'right',
      render: (_, record: SupplyDemand) => (
        <InfoRowActions
          actions={[
            { key: 'detail', label: '详情', onClick: () => { detail.value = record; } },
            {
              key: 'audit',
              label: '审核',
              onClick: () => {
                auditTarget.value = record;
                form.resetFields();
              },
            },
          ]}
        />
      )
    }]);

    return () => {
      const view_data = data.value;
      const view_detail = detail.value;
      const view_auditTarget = auditTarget.value;
      if (!view_data && !error.value) return <LoadingBlock rows={4} />;
      if (error.value || !view_data) return <ErrorBlock message={error.value} onRetry={() => load()} />;
      return (
        <div class="page-stack">
          <PageTitle
            eyebrow="SUPPLY & DEMAND REVIEW"
            title="供需审核"
            description="审核对象直接来自交易撮合：供应=卖家中心商品，需求=买家中心采购需求 · 审核通过后才会在大厅展示 · 承诺 2 小时内完成"
          />

          <div class="grid-4">
            <StatTile label="信息总量" value={view_data.counts.all} unit="条" note="含历史归档" />
            <StatTile label="待审核" value={view_data.counts.pending} unit="条" note="承诺 2 小时内处理" tone="warn" />
            <StatTile label="在线" value={view_data.counts.online} unit="条" note="大厅可见" tone="up" />
            <StatTile label="已下架" value={view_data.counts.offline} unit="条" note="过期或违规" />
          </div>

          <InfoList
            listId="supply-demands"
            rowKey="id"
            loading={loading.value}
            columns={columns.value}
            dataSource={view_data.items}
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
                        placeholder="搜索标题 / 主体 / 编号"
                        onChange={(e: any) => { draft.value = e.target?.value ?? ''; }}
                        onPressEnter={() => load({ keyword: draft.value.trim() })}
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
                          { value: 'online', label: '在线' },
                          { value: 'offline', label: '已下架' },
                          { value: 'all', label: '全部' },
                        ]}
                        onChange={v => load({ status: String(v ?? 'pending') })}
                      />
                    ),
                  },
                ]}
                onQuery={() => load({ keyword: draft.value.trim() })}
                onReset={() => {
                  draft.value = '';
                  load({ status: 'pending', keyword: '' });
                }}
              />
            }
          />

          <Drawer open={Boolean(view_detail)} onClose={() => { detail.value = null; }} width={560} title={view_detail?.title ?? ''}>
            {view_detail && (
              <div class="stack">
                <div class="row" style={{ gap: "8px", flexWrap: 'wrap' }}>
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
                <Button
                  type="primary"
                  onClick={() => {
                    detail.value = null;
                    auditTarget.value = view_detail;
                    form.resetFields();
                  }}
                >
                  审核该信息
                </Button>
              </div>
            )}
          </Drawer>

          <Modal
            open={Boolean(view_auditTarget)}
            title={`审核：${view_auditTarget?.title ?? ''}`}
            onCancel={() => { auditTarget.value = null; }}
            onOk={() => form.submit()}
            okText="提交结论"
            confirmLoading={submitting.value}
          >
            <Form form={form} layout="vertical" onFinish={submit} initialValues={{ action: 'approve' }}>
              <Form.Item name="action" label="审核结论" rules={[{ required: true }]}>
                {view_auditTarget?.sdType === 'demand' ? (
                  <Radio.Group>
                    <Radio.Button value="approve">恢复展示</Radio.Button>
                    <Radio.Button value="offline">下架</Radio.Button>
                  </Radio.Group>
                ) : (
                  <Radio.Group>
                    <Radio.Button value="approve">通过并上线</Radio.Button>
                    <Radio.Button value="reject">驳回</Radio.Button>
                    <Radio.Button value="offline">下架</Radio.Button>
                  </Radio.Group>
                )}
              </Form.Item>
              <Form.Item name="note" label="处理意见" extra="驳回或下架时必须填写原因，发布者可在「我的发布」中看到">
                <Input.TextArea rows={4} maxlength={200} showCount placeholder="例：报价明显高于平台监测价 60%，请补充规格说明后重新提交" />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      );
    };
  }
});
