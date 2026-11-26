import './after-sales.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { ListRowActions } from "@/vue/shared";
import { TradeList, TradeFilters } from '@/components/TradeList';
import { Form, Input, InputNumber, Select, message } from "@/vue/ui";
import { AlertOutlined, ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, EyeOutlined, FileSearchOutlined, PlusOutlined, SafetyCertificateOutlined, SearchOutlined, SettingOutlined } from "@ant-design/icons-vue";
import { useQuery, useQueryClient } from "@/vue/query";
import { createDispute, getDisputeById, getDisputeList, resolveDispute, type DisputeQuery, type DisputeVO } from '@/api/dispute';
import { getMyMerchants } from '@/api/identity';
import { getOrderList } from '@/api/order';
import { Panel, money, shortDate } from '../../member-center/shared';
type DisputePageMode = 'list' | 'detail' | 'create' | 'resolve';
const DISPUTE_STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  pending: {
    text: '待处理',
    tone: 'amber'
  },
  processing: {
    text: '处理中',
    tone: 'tech'
  },
  mediating: {
    text: '调解中',
    tone: 'tech'
  },
  arbitrating: {
    text: '仲裁中',
    tone: 'red'
  },
  resolved: {
    text: '已解决',
    tone: 'green'
  },
  closed: {
    text: '已关闭',
    tone: 'ghost'
  }
};
const DISPUTE_STAGE: Record<string, string> = {
  complain: '申请中',
  mediation: '调解中',
  arbitration: '仲裁中',
  resolved: '已了结',
  closed: '已关闭'
};
const DISPUTE_TYPE: Record<string, string> = {
  quality: '质量不符',
  delivery: '交付延误',
  delay: '交付延误',
  quantity: '数量短缺',
  price: '价格争议',
  payment: '货款结算',
  other: '其他'
};
function statusMeta(value: string): {
  text: string;
  tone: string;
} {
  return DISPUTE_STATUS[value] ?? {
    text: value || '未知',
    tone: 'ghost'
  };
}
const StatusTag = defineComponent({
  name: "StatusTag",
  props: {
    value: null as unknown as PropType<{
      value: string;
    }["value"]>
  },
  setup(__props: {
    value: string;
  }, {
    slots: __slots
  }) {
    const meta = computed(() => statusMeta(__props.value));
    return () => {
      return <span class={`mc-tag ${meta.value.tone}`}>{meta.value.text}</span>;
    };
  }
});
const PartyBadge = defineComponent({
  name: "PartyBadge",
  props: {
    side: null as unknown as PropType<{
      side: 'buyer' | 'seller';
    }["side"]>
  },
  setup(__props: {
    side: 'buyer' | 'seller';
  }, {
    slots: __slots
  }) {
    return () => {
      return <span class={`after-party-badge ${__props.side}`}>{__props.side === 'buyer' ? '采' : '供'}</span>;
    };
  }
});
/** 采购方和供货方共用的售后纠纷工作区。 */
const DisputeList = defineComponent({
  name: "DisputeList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const queryClient = useQueryClient();
    const pageMode = shallowRef<DisputePageMode>('list');
    const setPageMode = (next: typeof pageMode.value | ((previous: typeof pageMode.value) => typeof pageMode.value)) => {
      pageMode.value = typeof next === 'function' ? (next as (previous: typeof pageMode.value) => typeof pageMode.value)(pageMode.value) : next;
    };
    const activeDispute = shallowRef<DisputeVO | null>(null);
    const setActiveDispute = (next: typeof activeDispute.value | ((previous: typeof activeDispute.value) => typeof activeDispute.value)) => {
      activeDispute.value = typeof next === 'function' ? (next as (previous: typeof activeDispute.value) => typeof activeDispute.value)(activeDispute.value) : next;
    };
    const query = shallowRef<DisputeQuery>({
      pageNum: 1,
      pageSize: 20
    });
    const setQuery = (next: typeof query.value | ((previous: typeof query.value) => typeof query.value)) => {
      query.value = typeof next === 'function' ? (next as (previous: typeof query.value) => typeof query.value)(query.value) : next;
    };
    const draft = shallowRef<{
      disputeNo?: string;
      disputeStatus?: string;
    }>({});
    const setDraft = (next: typeof draft.value | ((previous: typeof draft.value) => typeof draft.value)) => {
      draft.value = typeof next === 'function' ? (next as (previous: typeof draft.value) => typeof draft.value)(draft.value) : next;
    };
    const saving = shallowRef(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const resolveForm = Form.useForm();
    const createForm = Form.useForm();
    const _query = useQuery(() => ({
      queryKey: ['disputes', query.value],
      queryFn: () => getDisputeList(query.value)
    }));
    const _query2 = useQuery(() => ({
      queryKey: ['my-merchants'],
      queryFn: getMyMerchants
    }));
    const _query3 = useQuery(() => ({
      queryKey: ['orders-for-dispute'],
      queryFn: () => getOrderList({
        pageNum: 1,
        pageSize: 100
      })
    }));
    const merchants = computed(() => _query2.data.value?.code === 200 ? _query2.data.value.data ?? [] : []);
    const identityError = computed(() => _query2.data.value && _query2.data.value.code !== 200 ? _query2.data.value.message ?? '无法解析你的经营主体' : '');
    const myOrders = computed(() => _query3.data.value?.code === 200 ? _query3.data.value.data?.records ?? [] : []);
    const rows = computed<DisputeVO[]>(() => _query.data.value?.data?.records ?? []);
    const total = computed(() => Number(_query.data.value?.data?.total ?? 0));
    const pageSummary = computed(() => ({
      open: rows.value.filter(row => row.disputeStatus !== 'resolved' && row.disputeStatus !== 'closed').length,
      resolved: rows.value.filter(row => row.disputeStatus === 'resolved' || row.disputeStatus === 'closed').length,
      claim: rows.value.reduce((sum, row) => sum + Number(row.claimAmount ?? 0), 0)
    }));
    const showList = (): void => {
      setPageMode('list');
      setActiveDispute(null);
    };
    const showDetail = (row: DisputeVO): void => {
      setActiveDispute(row);
      setPageMode('detail');
    };
    const showCreate = (): void => {
      createForm.resetFields();
      if (merchants.value.length === 1) {
        createForm.setFieldValue('complainantId', merchants.value[0].merchantId);
      }
      setPageMode('create');
    };
    const showResolve = (row: DisputeVO): void => {
      setActiveDispute(row);
      resolveForm.resetFields();
      setPageMode('resolve');
    };
    const submitCreate = async (): Promise<void> => {
      const values = await createForm.validateFields();
      setSaving(true);
      try {
        const response = await createDispute({
          orderId: values.orderId,
          complainantId: values.complainantId,
          disputeType: values.disputeType,
          disputeReason: values.disputeReason,
          disputeDescription: values.disputeDescription,
          claimAmount: values.claimAmount
        });
        if (response?.code === 200) {
          message.success('售后工单已发起');
          await queryClient.invalidateQueries({
            queryKey: ['disputes']
          });
          showList();
        } else {
          message.error(response?.message ?? '发起失败');
        }
      } catch {
        message.error('发起失败（请检查后端是否在运行）');
      } finally {
        setSaving(false);
      }
    };
    const submitResolve = async (): Promise<void> => {
      if (!activeDispute.value) return;
      const values = await resolveForm.validateFields();
      setSaving(true);
      try {
        const response = await resolveDispute(activeDispute.value.id, values);
        if (response?.code === 200) {
          message.success('售后工单已了结');
          await queryClient.invalidateQueries({
            queryKey: ['disputes']
          });
          const refreshed = await getDisputeById(activeDispute.value.id);
          if (refreshed?.code === 200 && refreshed.data) setActiveDispute(refreshed.data);
          setPageMode('detail');
        } else {
          message.error(response?.message ?? '处理失败');
        }
      } catch {
        message.error('处理失败（请检查后端是否在运行）');
      } finally {
        setSaving(false);
      }
    };
    return () => {
      const view_activeDispute = activeDispute.value;
      if (pageMode.value === 'create') {
        return <div class="after-workbench dispute-workbench">
        <button type="button" class="after-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回售后工单
        </button>
        <section class="after-hero">
          <span class="after-hero-icon"><PlusOutlined /></span>
          <div><small>AFTER-SALES REQUEST</small><h2>发起售后纠纷</h2><p>仅可对当前主体参与的订单发起，被申请人由订单另一方自动确定。</p></div>
        </section>
        <div class="after-form-layout">
          <Panel title="工单信息">
            <Form form={createForm} layout="vertical" onFinish={() => void submitCreate()} class="after-form">
              {merchants.value.length > 1 && <Form.Item name="complainantId" label="发起主体" rules={[{
                  required: true,
                  message: '请选择主体'
                }]}>
                  <Select options={merchants.value.map(item => ({
                    value: item.merchantId,
                    label: item.merchantName
                  }))} />
                </Form.Item>}
              <Form.Item name="orderId" label="关联订单" rules={[{
                  required: true,
                  message: '请选择订单'
                }]}>
                <Select showSearch optionFilterProp="label" placeholder="选择当前主体参与的订单" options={myOrders.value.map((order: {
                    id: number;
                    orderNo?: string;
                    productName?: string;
                    totalAmount?: number;
                  }) => ({
                    value: order.id,
                    label: `${order.orderNo ?? order.id} · ${order.productName ?? '订单商品'} · ¥${order.totalAmount ?? '—'}`
                  }))} />
              </Form.Item>
              <div class="after-form-grid">
                <Form.Item name="disputeType" label="纠纷类型" rules={[{
                    required: true,
                    message: '请选择类型'
                  }]}>
                  <Select options={Object.entries(DISPUTE_TYPE).map(([value, label]) => ({
                      value,
                      label
                    }))} />
                </Form.Item>
                <Form.Item name="claimAmount" label="索赔金额（元）">
                  <InputNumber min={0} precision={2} style={{
                      width: '100%'
                    }} placeholder="可选" />
                </Form.Item>
              </div>
              <Form.Item name="disputeReason" label="纠纷事由" rules={[{
                  required: true,
                  message: '请填写事由'
                }]}>
                <Input placeholder="例如：到货品质与约定不符" />
              </Form.Item>
              <Form.Item name="disputeDescription" label="详细说明">
                <Input.TextArea rows={5} placeholder="请描述发生经过、已有沟通和期望处理方式" />
              </Form.Item>
              <div class="after-form-actions">
                <button type="submit" class="mc-btn" disabled={saving.value}>{saving.value ? '正在提交…' : '提交售后工单'}</button>
                <button type="button" class="mc-btn ghost" onClick={showList}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside class="after-side-stack">
            <Panel title="发起条件">
              <ul class="after-guidance">
                <li><CheckCircleOutlined /> 只能选择当前经营主体参与的订单。</li>
                <li><CheckCircleOutlined /> 同一订单只能存在一条未结纠纷。</li>
                <li><CheckCircleOutlined /> 平台运营负责调解、仲裁和赔付执行。</li>
              </ul>
            </Panel>
            <Panel title="处理时效">
              <div class="after-duration"><strong>48h</strong><span>建议响应时间</span><small>及时响应有助于维护店铺信用和采购方体验。</small></div>
            </Panel>
          </aside>
        </div>
      </div>;
      }
      if (pageMode.value === 'resolve' && view_activeDispute) {
        return <div class="after-workbench dispute-workbench">
        <button type="button" class="after-back" onClick={() => setPageMode('detail')}>
          <ArrowLeftOutlined /> 返回工单详情
        </button>
        <section class="after-hero">
          <span class="after-hero-icon"><SettingOutlined /></span>
          <div><small>DISPUTE RESOLUTION</small><h2>处理售后工单</h2><p>{view_activeDispute.disputeNo} · {DISPUTE_TYPE[view_activeDispute.disputeType] ?? view_activeDispute.disputeType}</p></div>
          <StatusTag value={view_activeDispute.disputeStatus} />
        </section>
        <div class="after-form-layout">
          <Panel title="双方处理结果">
            <Form form={resolveForm} layout="vertical" onFinish={() => void submitResolve()} class="after-form">
              <Form.Item name="result" label="处理结果" rules={[{
                  required: true,
                  message: '请选择处理结果'
                }]}>
                <Select options={[{
                    value: 'agreed',
                    label: '双方达成和解'
                  }, {
                    value: 'withdrawn',
                    label: '申请人撤回'
                  }]} />
              </Form.Item>
              <Form.Item name="remark" label="处理说明">
                <Input.TextArea rows={5} placeholder="填写和解方案、补偿方式或撤回原因" />
              </Form.Item>
              <div class="after-form-actions">
                <button type="submit" class="mc-btn" disabled={saving.value}>{saving.value ? '正在处理…' : '确认了结'}</button>
                <button type="button" class="mc-btn ghost" onClick={() => setPageMode('detail')}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside class="after-side-stack">
            <Panel title="处理说明">
              <ul class="after-guidance">
                <li><CheckCircleOutlined /> 这里用于双方自行和解或申请人撤回。</li>
                <li><SafetyCertificateOutlined /> 需要平台介入时，请等待运营调解或仲裁。</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>;
      }
      if (pageMode.value === 'detail' && view_activeDispute) {
        return <div class="after-workbench dispute-workbench">
        <button type="button" class="after-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回售后工单
        </button>
        <section class="after-hero">
          <span class="after-hero-icon"><AlertOutlined /></span>
          <div>
            <small>AFTER-SALES CASE · {view_activeDispute.disputeNo}</small>
            <h2>{DISPUTE_TYPE[view_activeDispute.disputeType] ?? view_activeDispute.disputeType}</h2>
            <p>关联订单 {view_activeDispute.orderId} · 创建于 {shortDate(view_activeDispute.createTime)}</p>
          </div>
          <StatusTag value={view_activeDispute.disputeStatus} />
          {view_activeDispute.disputeStatus !== 'resolved' && view_activeDispute.disputeStatus !== 'closed' && <button type="button" class="mc-btn" onClick={() => showResolve(view_activeDispute)}>
              <SettingOutlined /> 处理工单
            </button>}
        </section>
        <div class="after-detail-layout">
          <div class="after-detail-main">
            <Panel title="争议双方">
              <div class="after-party-grid">
                <div><PartyBadge side="buyer" /><span>申请人</span><strong>{view_activeDispute.complainantName || '—'}</strong><small>主体 ID {String(view_activeDispute.complainantId ?? '—')}</small></div>
                <div><PartyBadge side="seller" /><span>被申请人</span><strong>{view_activeDispute.respondentName || '—'}</strong><small>主体 ID {String(view_activeDispute.respondentId ?? '—')}</small></div>
              </div>
            </Panel>
            <Panel title="售后诉求">
              <div class="after-case-grid">
                <div><span>纠纷类型</span><strong>{DISPUTE_TYPE[view_activeDispute.disputeType] ?? view_activeDispute.disputeType}</strong></div>
                <div><span>索赔金额</span><strong class="after-amount">{view_activeDispute.claimAmount == null ? '—' : money(view_activeDispute.claimAmount)}</strong></div>
                <div><span>当前阶段</span><strong>{DISPUTE_STAGE[view_activeDispute.processStage] ?? view_activeDispute.processStage}</strong></div>
                <div><span>关联订单</span><strong>{view_activeDispute.orderId}</strong></div>
              </div>
              <div class="after-description">
                <span>售后事由</span><strong>{view_activeDispute.disputeReason || '—'}</strong>
                <p>{view_activeDispute.disputeDescription || '暂无详细说明'}</p>
              </div>
            </Panel>
            <Panel title="处理记录">
              <div class="after-result-list">
                <div><span>调解结果</span><p>{view_activeDispute.mediationResult || '尚未形成调解结果'}</p></div>
                <div><span>仲裁结果</span><p>{view_activeDispute.arbitrationResult || '尚未进入仲裁'}</p></div>
                <div><span>了结说明</span><p>{view_activeDispute.closeReason || '工单处理中'}</p></div>
              </div>
            </Panel>
          </div>
          <aside class="after-detail-aside">
            <Panel title="处理进度">
              <div class="after-timeline">
                <div class="on"><span><CheckCircleOutlined /></span><div><strong>工单已提交</strong><small>{shortDate(view_activeDispute.createTime)}</small></div></div>
                <div class={view_activeDispute.processStage !== 'complain' ? 'on' : ''}><span><ClockCircleOutlined /></span><div><strong>平台处理中</strong><small>{DISPUTE_STAGE[view_activeDispute.processStage] ?? '等待响应'}</small></div></div>
                <div class={view_activeDispute.disputeStatus === 'resolved' || view_activeDispute.disputeStatus === 'closed' ? 'on' : ''}><span><SafetyCertificateOutlined /></span><div><strong>工单了结</strong><small>{shortDate(view_activeDispute.closeTime)}</small></div></div>
              </div>
            </Panel>
            <Panel title="处理建议">
              <div class="after-advice">
                <p><FileSearchOutlined /> 核对订单、商品交付记录和双方沟通证据。</p>
                <p><CheckCircleOutlined /> 优先与对方协商和解，处理结果会写入交易留痕。</p>
              </div>
            </Panel>
          </aside>
        </div>
      </div>;
      }
      return <div class="after-workbench dispute-workbench">
      {identityError.value && <div class="after-alert"><AlertOutlined />{identityError.value}</div>}
      {!identityError.value && _query2.data.value && merchants.value.length === 0 && <div class="after-alert"><AlertOutlined />当前账号尚未绑定经营主体，无法查询售后工单。</div>}
      <section class="after-overview">
        <div class="after-overview-title">
          <span class="after-overview-icon"><AlertOutlined /></span>
          <div><small>AFTER-SALES CASES</small><h2>纠纷管理</h2><p>集中处理质量问题、交付延误、数量短缺与货款争议。</p></div>
        </div>
        <div class="after-overview-actions">
          <button type="button" class="mc-btn" onClick={showCreate}><PlusOutlined /> 发起售后</button>
        </div>
        <div class="after-overview-stats">
          <div><span>本页待处理</span><strong>{pageSummary.value.open}</strong></div>
          <div><span>本页已了结</span><strong>{pageSummary.value.resolved}</strong></div>
          <div><span>本页索赔金额</span><strong>{money(pageSummary.value.claim)}</strong></div>
        </div>
      </section>

      <TradeList listId="member-dispute" rowKey="id" dataSource={rows.value} onRefresh={() => void _query.refetch()} loading={_query.isFetching.value} filterSlot={<TradeFilters fields={[{
          label: '纠纷编号',
          control: <Input prefix={<SearchOutlined />} allowClear placeholder="输入纠纷编号" value={draft.value.disputeNo} onChange={event => setDraft(previous => ({
            ...previous,
            disputeNo: (event.target.value ?? '') || undefined
          }))} />
        }, {
          label: '纠纷状态',
          control: <Select allowClear placeholder="全部状态" value={draft.value.disputeStatus} onChange={value => setDraft(previous => ({
            ...previous,
            disputeStatus: value
          }))} options={Object.entries(DISPUTE_STATUS).map(([value, item]) => ({
            value,
            label: item.text
          }))} />
        }]} onQuery={() => setQuery(prev => ({
          ...prev,
          pageNum: 1,
          disputeNo: draft.value.disputeNo,
          disputeStatus: draft.value.disputeStatus
        }))} onReset={() => {
          setDraft({});
          setQuery(prev => ({
            pageNum: 1,
            pageSize: prev.pageSize
          }));
        }} />} pagination={{
          current: query.value.pageNum ?? 1,
          pageSize: query.value.pageSize ?? 20,
          total: total.value,
          onChange: (pageNum, pageSize) => setQuery(prev => ({
            ...prev,
            pageNum,
            pageSize
          }))
        }} locale={{
          emptyText: '暂无售后工单'
        }} columns={[{
          title: "工单 / 类型",
          key: 'col-1',
          width: 160,
          render: (_, row) => <><button type="button" class="after-name-link" onClick={() => showDetail(row)}>
                          <strong>{DISPUTE_TYPE[row.disputeType] ?? row.disputeType}</strong>
                          <span class="mc-mono">{row.disputeNo}</span>
                        </button></>
        }, {
          title: "关联订单",
          key: 'col-2',
          width: 160,
          render: (_, row) => <span class="mc-mono">{row.orderId}</span>
        }, {
          title: "争议双方",
          key: 'col-3',
          width: 160,
          render: (_, row) => <><div class="after-parties-cell">
                          <div><PartyBadge side="buyer" />{row.complainantName || '—'}</div>
                          <div><PartyBadge side="seller" />{row.respondentName || '—'}</div>
                        </div></>
        }, {
          title: "诉求",
          key: 'col-4',
          width: 220,
          render: (_, row) => <><div class="after-claim-cell">
                          <span>{row.claimAmount == null ? '未填写索赔金额' : money(row.claimAmount)}</span>
                          <small>{row.disputeReason || row.disputeDescription || '—'}</small>
                        </div></>
        }, {
          title: "状态",
          key: 'col-5',
          width: 108,
          render: (_, row) => <><StatusTag value={row.disputeStatus} /><small class="after-stage">{DISPUTE_STAGE[row.processStage] ?? row.processStage}</small></>
        }, {
          title: "提交时间",
          key: 'col-6',
          width: 160,
          render: (_, row) => <span class="mc-mono mc-xs">{shortDate(row.createTime)}</span>
        }, {
          title: "操作",
          key: 'action',
          width: 170,
          render: (_, row) => <><ListRowActions>
                          <button type="button" class="mc-link after-action" onClick={() => showDetail(row)}><EyeOutlined /> 查看</button>
                          {row.disputeStatus !== 'resolved' && row.disputeStatus !== 'closed' && <button type="button" class="mc-link after-action" onClick={() => showResolve(row)}><SettingOutlined /> 处理</button>}
                        </ListRowActions></>
        }]} />
    </div>;
    };
  }
});
export default DisputeList;
