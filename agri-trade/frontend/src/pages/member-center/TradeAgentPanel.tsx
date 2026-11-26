import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { useNavigate } from "@/vue/router";
import { Alert, Button, Card, DatePicker, Descriptions, Drawer, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Table, Tag, Timeline, Typography, message } from "@/vue/ui";
import dayjs from 'dayjs';
import { ListRowActions } from "@/vue/shared";
import { agentWorkspace, createAgentMandate, revokeAgentMandate, runAgent, agentDetail, confirmAgent, rejectAgent, type AgentRole, type AgentWorkspace, type AgentDetail, type AgentSession, type AgentComparison } from '@/api/trade-agent';
import { TradeList } from '@/components/TradeList';
const names: Record<string, string> = {
  ACTIVE: '委托生效',
  REVOKED: '已撤销',
  COMPLETED: '已完成',
  AWAITING_CONFIRMATION: '等待双方确认',
  NO_AGREEMENT: '未达成一致',
  ORDERED: '已生成订单',
  REJECTED: '已拒绝',
  EXPIRED: '已失效'
};
const eventNames: Record<string, string> = {
  NEGOTIATION_ROUND: '双方Agent议价',
  PROPOSAL_READY: '形成待确认方案',
  NO_AGREEMENT: '本轮未达成一致',
  BUYER_CONFIRMED: '采购方最终确认',
  SELLER_CONFIRMED: '供货方最终确认',
  ORDER_LINKED: '已关联原交易订单',
  REJECTED: '方案已拒绝'
};
const total = (p: number | null, q: number, f: number) => (Math.round(Number(p) * Number(q) * 100) + Math.round(Number(f) * 100)) / 100;
const amount = (n: unknown) => Number(n || 0).toLocaleString('zh-CN', {
  maximumFractionDigits: 4
});
function snapshot(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function status(row: {
  status: string;
  expires_at: string;
}) {
  return row.status === 'AWAITING_CONFIRMATION' && dayjs(row.expires_at).isBefore(dayjs()) ? 'EXPIRED' : row.status;
}
const TradeAgentPanel = defineComponent({
  name: "TradeAgentPanel",
  props: {
    role: null as unknown as PropType<{
      role: AgentRole;
    }["role"]>
  },
  setup(__props: {
    role: AgentRole;
  }, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const buyer = computed(() => __props.role === 'BUYER');
    const workspace = shallowRef<AgentWorkspace | undefined>(undefined);
    const setWorkspace = (next: typeof workspace.value | ((previous: typeof workspace.value) => typeof workspace.value)) => {
      workspace.value = typeof next === 'function' ? (next as (previous: typeof workspace.value) => typeof workspace.value)(workspace.value) : next;
    };
    const busy = shallowRef(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const error = shallowRef('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const editing = shallowRef(false);
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const detail = shallowRef<AgentDetail | undefined>(undefined);
    const setDetail = (next: typeof detail.value | ((previous: typeof detail.value) => typeof detail.value)) => {
      detail.value = typeof next === 'function' ? (next as (previous: typeof detail.value) => typeof detail.value)(detail.value) : next;
    };
    const comparison = shallowRef<AgentComparison[] | undefined>(undefined);
    const setComparison = (next: typeof comparison.value | ((previous: typeof comparison.value) => typeof comparison.value)) => {
      comparison.value = typeof next === 'function' ? (next as (previous: typeof comparison.value) => typeof comparison.value)(comparison.value) : next;
    };
    const rejectId = shallowRef('');
    const setRejectId = (next: typeof rejectId.value | ((previous: typeof rejectId.value) => typeof rejectId.value)) => {
      rejectId.value = typeof next === 'function' ? (next as (previous: typeof rejectId.value) => typeof rejectId.value)(rejectId.value) : next;
    };
    const reason = shallowRef('');
    const setReason = (next: typeof reason.value | ((previous: typeof reason.value) => typeof reason.value)) => {
      reason.value = typeof next === 'function' ? (next as (previous: typeof reason.value) => typeof reason.value)(reason.value) : next;
    };
    const form = Form.useForm();
    const load = async () => {
      setBusy(true);
      try {
        setWorkspace(await agentWorkspace(__props.role));
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : '工作台加载失败');
      } finally {
        setBusy(false);
      }
    };
    onMounted(() => {
      watch(() => [__props.role], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          void load();
          const timer = window.setInterval(() => {
            void load();
          }, 30000);
          return () => window.clearInterval(timer);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const action = async (work: () => Promise<unknown>, ok = '已完成') => {
      setBusy(true);
      try {
        await work();
        message.success(ok);
        await load();
      } catch (e) {
        message.error(e instanceof Error ? e.message : '操作失败');
      } finally {
        setBusy(false);
      }
    };
    const openDetail = async (id: string) => {
      await action(async () => setDetail(await agentDetail(id)), '已读取最新协商与履约状态');
    };
    const confirm = (row: AgentDetail) => Modal.confirm({
      title: `${buyer.value ? '采购方' : '供货方'}最终确认`,
      content: <Space direction="vertical"><span>方案版本 {row.revision}；{amount(row.quantity)} {row.unit}</span><span>单价 ¥{amount(row.agreed_price)} / {row.unit}，运费 ¥{amount(row.freight)}</span><strong>合计 ¥{amount(total(row.agreed_price, row.quantity, row.freight))}</strong><span>交付日 {String(row.delivery_date).slice(0, 10)}</span><span>双方均确认后将复用原交易流程生成待确认订单及合同，不自动付款、签约或发货。</span></Space>,
      okText: '确认以上交易条款',
      onOk: () => action(async () => {
        setDetail(await confirmAgent(row.id, __props.role, row.revision));
      }, '本方最终确认已记录')
    });
    const sessionColumns = computed(() => [{
      title: '货源 / 对手方',
      key: 'product',
      width: 200,
      render: (_: unknown, r: AgentSession) => {
        const s = snapshot(r.public_snapshot);
        return <Space direction="vertical" size={0}><strong>{String(s.productName || `货源 #${r.product_id}`)}</strong><span>{String((buyer.value ? s.sellerName : s.buyerName) || '未维护主体名称')}</span></Space>;
      }
    }, {
      title: '数量',
      key: 'qty',
      width: 110,
      render: (_: unknown, r: AgentSession) => `${amount(r.quantity)} ${r.unit}`
    }, {
      title: '协商单价',
      key: 'price',
      width: 120,
      render: (_: unknown, r: AgentSession) => r.agreed_price == null ? '无交集' : `¥${amount(r.agreed_price)}`
    }, {
      title: '含运费总额',
      key: 'total',
      width: 130,
      render: (_: unknown, r: AgentSession) => r.agreed_price == null ? '—' : `¥${amount(total(r.agreed_price, r.quantity, r.freight))}`
    }, {
      title: '交付日',
      dataIndex: 'delivery_date',
      width: 120,
      render: (v: string) => String(v).slice(0, 10)
    }, {
      title: '状态',
      key: 'status',
      width: 170,
      render: (_: unknown, r: AgentSession) => <Space direction="vertical" size={0}><Tag color={status(r) === 'ORDERED' ? 'green' : 'blue'}>{names[status(r)] || r.status}</Tag><small>买方 {r.buyer_confirmed ? '已确认' : '未确认'} / 卖方 {r.seller_confirmed ? '已确认' : '未确认'}</small></Space>
    }, {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, r: AgentSession) => <ListRowActions><Button type="link" size="small" onClick={() => void openDetail(r.id)}>查看协商与履约</Button></ListRowActions>
    }]);
    return () => {
      const view_detail = detail.value;
      return <Spin spinning={busy.value}><Space direction="vertical" size={16} style={{
          width: '100%'
        }}>
    <Card style={{
            background: 'linear-gradient(110deg,#f0faf6,#eef5ff)'
          }}><Space direction="vertical" style={{
              width: '100%'
            }}>
      <Typography.Title level={3} style={{
                margin: 0
              }}>{buyer.value ? '采购 Agent' : '供货 Agent'}</Typography.Title>
      <Typography.Text>{buyer.value ? '依据采购委托比较总成本，与已获授权的供货 Agent 协商。' : '依据货源委托自主响应匹配需求，在授权范围内议价。'}人只对最终交易方案确认，过程与履约均可追踪。</Typography.Text>
      <Space wrap><Button type="primary" onClick={() => {
                  form.resetFields();
                  setEditing(true);
                }}>设置{buyer.value ? '采购' : '供货'}委托</Button><Button onClick={() => void load()}>刷新工作台</Button><Tag>规则策略 {workspace.value?.policyVersion || '有界逐轮让步'}</Tag></Space>
    </Space></Card>
    {error.value && <Alert type="error" showIcon message="Agent工作台请求失败" description={error.value} action={<Button onClick={() => void load()}>重试</Button>} />}
    <Alert type="info" showIcon message="独立委托、双方确认、原单履约" description="双方私有价格边界互不可见。只协商同品类、同单位、品种规格及质量可核验的有效货源；专项认证、样品和附加条款先走人工询报价。每张方案承接需求全部数量，暂不自动拆单。委托有效期3天；重设或撤销委托会使旧方案失效。" />
    <TradeList listId={`agent-${__props.role.toLowerCase()}-mandates`} rowKey="id" dataSource={workspace.value?.mandates || []} onRefresh={() => void load()} toolbarLeft={<span style={{
            fontWeight: 600
          }}>我的私有委托</span>} columns={[{
            title: buyer.value ? '需求' : '货源',
            dataIndex: 'ref_id',
            width: 180,
            ellipsis: true,
            render: (id: number) => {
              const r = workspace.value?.references.find(x => x.id === id);
              return r?.demandName || r?.productName || `#${id}`;
            }
          }, {
            title: '期望单价',
            dataIndex: 'target_price',
            width: 120,
            render: (v: number) => `¥${amount(v)}`
          }, {
            title: buyer.value ? '最高单价（仅我方）' : '最低单价（仅我方）',
            dataIndex: 'limit_price',
            align: 'right',
            width: 160,
            render: (v: number) => `¥${amount(v)}`
          }, {
            title: '数量',
            dataIndex: 'quantity',
            width: 110,
            render: amount
          }, {
            title: '有效至',
            dataIndex: 'expires_at',
            width: 170
          }, {
            title: '状态',
            key: 'status',
            width: 110,
            render: (_, r) => {
              const s = r.status === 'ACTIVE' && dayjs(r.expires_at).isBefore(dayjs()) ? 'EXPIRED' : r.status;
              return <Tag color={s === 'ACTIVE' ? 'green' : 'default'}>{names[s] || r.status}</Tag>;
            }
          }, {
            title: '操作',
            key: 'action',
            width: 160,
            render: (_, r) => <ListRowActions items={[buyer.value && <Button key="run" type="link" size="small" onClick={() => void action(async () => {
              setComparison(await runAgent(r.id));
            }, '已完成比价和协商')}>
                    比价 / 推进
                  </Button>, <Button key="revoke" type="link" size="small" danger disabled={r.status !== 'ACTIVE'} onClick={() => Modal.confirm({
              title: '撤销该委托？未成交方案将不可确认。',
              onOk: () => action(() => revokeAgentMandate(r.id), '已撤销委托')
            })}>
                  撤销
                </Button>]} />
          }]} />
    <TradeList listId={`agent-${__props.role.toLowerCase()}-sessions`} rowKey="id" columns={sessionColumns.value} dataSource={workspace.value?.sessions || []} onRefresh={() => void load()} toolbarLeft={<span style={{
            fontWeight: 600
          }}>协商方案与履约跟踪</span>} locale={{
            emptyText: <Empty description="暂无协商方案。双方创建匹配委托后自动进行议价。" />
          }} />
    <Modal open={editing.value} title={`设置${buyer.value ? '采购' : '供货'} Agent 委托`} onCancel={() => setEditing(false)} onOk={() => form.submit()} confirmLoading={busy.value} width={620}>
      <Form form={form} layout="vertical" initialValues={{
              maxRounds: 5,
              freight: 0
            }} onFinish={v => void action(async () => {
              await createAgentMandate({
                ...v,
                role: __props.role,
                deliveryDate: v.deliveryDate.format('YYYY-MM-DD')
              });
              setEditing(false);
            }, '委托已生效，系统已自动匹配和协商')}>
        <Form.Item name="refId" label={buyer.value ? '我的采购需求' : '我的上架货源'} rules={[{
                required: true
              }]}><Select showSearch optionFilterProp="label" options={workspace.value?.references.map(r => ({
                  value: r.id,
                  label: `${r.demandName || r.productName || `#${r.id}`} · ${r.buyerName || r.sellerName || ''} · ${r.unit || '单位未维护'}`
                }))} /></Form.Item>
        <Form.Item name="targetPrice" label={buyer.value ? '期望采购单价（元/原单位）' : '期望供货单价（元/原单位）'} rules={[{
                required: true
              }]}><InputNumber min={0.0001} precision={4} style={{
                  width: '100%'
                }} /></Form.Item>
        <Form.Item name="limitPrice" label={buyer.value ? '最高可接受单价（对供货方保密）' : '最低可接受单价（对采购方保密）'} rules={[{
                required: true
              }]}><InputNumber min={0.0001} precision={4} style={{
                  width: '100%'
                }} /></Form.Item>
        {!buyer.value && <><Form.Item name="quantity" label="授权供货数量（原货源单位）" rules={[{
                  required: true
                }]}><InputNumber min={0.0001} precision={4} style={{
                    width: '100%'
                  }} /></Form.Item><Form.Item name="freight" label="整单运费（元，向采购方单列）" rules={[{
                  required: true
                }]}><InputNumber min={0} precision={2} style={{
                    width: '100%'
                  }} /></Form.Item></>}
        <Form.Item name="deliveryDate" label={buyer.value ? '最晚交付日期' : '最早可交付日期'} rules={[{
                required: true
              }]}><DatePicker disabledDate={d => d.isBefore(dayjs(), 'day') || d.isAfter(dayjs().add(90, 'day'), 'day')} style={{
                  width: '100%'
                }} /></Form.Item>
        <Form.Item name="maxRounds" label="授权协商轮数（1～10）" rules={[{
                required: true
              }]}><InputNumber min={1} max={10} precision={0} /></Form.Item>
        <Alert type="warning" showIcon message="本操作授权Agent在上述范围内协商，形成方案后仍须双方最终确认。新委托将撤销同需求或货源的旧委托。" />
      </Form>
    </Modal>
    <Modal open={comparison.value !== undefined} title="采购Agent比价 · 按含运费总额排序" width={1000} footer={null} onCancel={() => setComparison(undefined)}><Alert type="info" message="仅展示当前委托已形成的双边协商，不使用虚构报价。数量和单位一致；质量资质不以价格替代。" style={{
              marginBottom: 12
            }} /><Table rowKey="id" dataSource={comparison.value} pagination={false} columns={[{
              title: '货源',
              dataIndex: 'product_name'
            }, {
              title: '供货方',
              dataIndex: 'seller_name'
            }, {
              title: '单价',
              dataIndex: 'agreed_price',
              align: 'right',
              render: v => v == null ? '未达成一致' : `¥${amount(v)}`
            }, {
              title: '运费',
              dataIndex: 'freight',
              align: 'right',
              render: amount
            }, {
              title: '含运费总额',
              dataIndex: 'total_amount',
              align: 'right',
              render: v => v == null ? '—' : `¥${amount(v)}`
            }, {
              title: '详情',
              align: 'right',
              render: (_, r) => <Button type="link" size="small" onClick={() => void openDetail(r.id)}>查看方案</Button>
            }]} /></Modal>
    <Drawer open={!!view_detail} width={760} title="双边协商方案与履约" onClose={() => setDetail(undefined)} extra={view_detail && <Button onClick={() => void openDetail(view_detail.id)}>刷新履约</Button>}>
      {view_detail && <Space direction="vertical" style={{
              width: '100%'
            }} size={16}>
        {!view_detail.effective && view_detail.status !== 'ORDERED' && <Alert type="warning" message="委托撤销或已过期，方案不可确认。需要重新委托。" />}
        <Descriptions bordered column={2} items={[{
                key: 'status',
                label: '方案状态',
                children: names[status(view_detail)] || view_detail.status
              }, {
                key: 'version',
                label: '方案版本',
                children: view_detail.revision
              }, {
                key: 'product',
                label: '货源',
                children: String(snapshot(view_detail.public_snapshot).productName || view_detail.product_id)
              }, {
                key: 'qty',
                label: '数量',
                children: `${amount(view_detail.quantity)} ${view_detail.unit}`
              }, {
                key: 'price',
                label: '单价',
                children: view_detail.agreed_price == null ? '未达成' : `¥${amount(view_detail.agreed_price)}`
              }, {
                key: 'freight',
                label: '运费',
                children: `¥${amount(view_detail.freight)}`
              }, {
                key: 'date',
                label: '交付日期',
                children: String(view_detail.delivery_date).slice(0, 10)
              }, {
                key: 'expire',
                label: '有效至',
                children: view_detail.expires_at
              }, {
                key: 'address',
                label: '交付地址',
                span: 2,
                children: String(snapshot(view_detail.public_snapshot).deliveryAddress || '未维护')
              }]} />
        {view_detail.effective && status(view_detail) === 'AWAITING_CONFIRMATION' && <Space><Button type="primary" disabled={!!(buyer.value ? view_detail.buyer_confirmed : view_detail.seller_confirmed)} onClick={() => confirm(view_detail)}>本方最终确认</Button><Button danger onClick={() => {
                  setReason('');
                  setRejectId(view_detail.id);
                }}>拒绝方案</Button></Space>}
        {view_detail.order && <Card size="small" title="原交易订单与履约"><Space direction="vertical"><span>订单 {view_detail.order.orderNo} · {view_detail.order.orderStatus} · {view_detail.order.paymentStatus}</span>{view_detail.contracts?.map(c => <span key={c.id}>合同 {c.contractNo} · {c.contractStatus}</span>)}{view_detail.logistics?.map(l => <span key={l.id}>物流 {l.logisticsNo} · {l.logisticsStatus}</span>)}{view_detail.fulfillmentWarnings?.map(w => <Alert key={w} type="warning" message={w} />)}<Button onClick={() => navigate(`/order/detail/${view_detail.order!.id}`)}>进入原订单办理履约</Button></Space></Card>}
        <Typography.Title level={5}>协商与确认留痕</Typography.Title><Timeline items={view_detail.events.map((e, i) => {
                const x = snapshot(e.detail_json);
                return {
                  key: i,
                  children: <Space direction="vertical" size={2}><strong>{eventNames[e.event_type] || e.event_type}</strong><small>{e.created_at} · 操作方 {e.actor}</small>{e.event_type === 'NEGOTIATION_ROUND' ? <span>第 {String(x.round)} 轮：采购出价 ¥{amount(x.buyerOffer)} / 供货出价 ¥{amount(x.sellerOffer)}</span> : x.reason ? <span>{String(x.reason)}</span> : null}</Space>
                };
              })} />
      </Space>}
    </Drawer>
    <Modal open={!!rejectId.value} title="拒绝方案并记录原因" onCancel={() => setRejectId('')} onOk={() => action(async () => {
            await rejectAgent(rejectId.value, reason.value);
            setRejectId('');
            setDetail(undefined);
          }, '已拒绝方案')}><Input.TextArea maxLength={500} value={reason.value} onChange={e => setReason(e.target.value ?? '')} placeholder="请说明不接受本次方案的原因" /></Modal>
  </Space></Spin>;
    };
  }
});
export default TradeAgentPanel;
