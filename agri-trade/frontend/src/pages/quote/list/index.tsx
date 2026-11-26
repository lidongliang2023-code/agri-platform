import './quote.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { TradeList } from '@/components/TradeList';
import { DatePicker, Form, Input, InputNumber, Select, Spin, message } from "@/vue/ui";
import { AppstoreOutlined, ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, FileSearchOutlined, PlusOutlined, SafetyCertificateOutlined, SearchOutlined, SendOutlined, ShopOutlined, TagOutlined, UnorderedListOutlined } from "@ant-design/icons-vue";
import { useNavigate } from "@/vue/router";
import dayjs from 'dayjs';
import { acceptQuote, convertQuoteToOrder, createQuote, deleteQuote, getQuoteList, updateQuote, type QuoteQuery, type QuoteVO } from '@/api/quote';
import { getMyMerchants } from '@/api/identity';
import { getReceivedInquiries, quoteInquiry, type InquiryVO } from '@/api/inquiry';
import { EmptyState, Panel, money, shortDate } from '../../member-center/shared';
type QuoteMode = 'list' | 'inquiryQuote' | 'standaloneQuote';
const STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  pending: {
    text: '待受理',
    tone: 'amber'
  },
  approved: {
    text: '已通过',
    tone: 'green'
  },
  rejected: {
    text: '已拒绝',
    tone: 'red'
  },
  accepted: {
    text: '已受理',
    tone: 'green'
  },
  expired: {
    text: '已过期',
    tone: 'ghost'
  }
};
const INQUIRY_STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  pending_reply: {
    text: '待报价',
    tone: 'amber'
  },
  quoted: {
    text: '已报价',
    tone: 'tech'
  },
  converted: {
    text: '已成交',
    tone: 'green'
  },
  closed: {
    text: '已关闭',
    tone: 'ghost'
  }
};
function qualityCode(label?: string): string | undefined {
  const map: Record<string, string> = {
    特级: 'premium',
    一级: 'level1',
    二级: 'level2',
    三级: 'level3'
  };
  return label ? map[label] ?? label : undefined;
}
const StatusTag = defineComponent({
  name: "StatusTag",
  props: {
    status: null as unknown as PropType<{
      status: string;
    }["status"]>
  },
  setup(__props: {
    status: string;
  }, {
    slots: __slots
  }) {
    const meta = computed(() => STATUS[__props.status] ?? {
      text: __props.status || '未知',
      tone: 'ghost'
    });
    return () => {
      return <span class={`mc-tag ${meta.value.tone}`}>{meta.value.text}</span>;
    };
  }
});
/** 卖家报价与询价响应工作区。 */
const QuoteList = defineComponent({
  name: "QuoteList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const mode = shallowRef<QuoteMode>('list');
    const setMode = (next: typeof mode.value | ((previous: typeof mode.value) => typeof mode.value)) => {
      mode.value = typeof next === 'function' ? (next as (previous: typeof mode.value) => typeof mode.value)(mode.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const data = shallowRef<QuoteVO[]>([]);
    const setData = (next: typeof data.value | ((previous: typeof data.value) => typeof data.value)) => {
      data.value = typeof next === 'function' ? (next as (previous: typeof data.value) => typeof data.value)(data.value) : next;
    };
    const total = shallowRef(0);
    const setTotal = (next: typeof total.value | ((previous: typeof total.value) => typeof total.value)) => {
      total.value = typeof next === 'function' ? (next as (previous: typeof total.value) => typeof total.value)(total.value) : next;
    };
    const queryParams = shallowRef<QuoteQuery>({
      pageNum: 1,
      pageSize: 20
    });
    const setQueryParams = (next: typeof queryParams.value | ((previous: typeof queryParams.value) => typeof queryParams.value)) => {
      queryParams.value = typeof next === 'function' ? (next as (previous: typeof queryParams.value) => typeof queryParams.value)(queryParams.value) : next;
    };
    const currentItem = shallowRef<QuoteVO | null>(null);
    const setCurrentItem = (next: typeof currentItem.value | ((previous: typeof currentItem.value) => typeof currentItem.value)) => {
      currentItem.value = typeof next === 'function' ? (next as (previous: typeof currentItem.value) => typeof currentItem.value)(currentItem.value) : next;
    };
    const quoteTarget = shallowRef<InquiryVO | null>(null);
    const setQuoteTarget = (next: typeof quoteTarget.value | ((previous: typeof quoteTarget.value) => typeof quoteTarget.value)) => {
      quoteTarget.value = typeof next === 'function' ? (next as (previous: typeof quoteTarget.value) => typeof quoteTarget.value)(quoteTarget.value) : next;
    };
    const myMerchantIds = shallowRef<string[]>([]);
    const setMyMerchantIds = (next: typeof myMerchantIds.value | ((previous: typeof myMerchantIds.value) => typeof myMerchantIds.value)) => {
      myMerchantIds.value = typeof next === 'function' ? (next as (previous: typeof myMerchantIds.value) => typeof myMerchantIds.value)(myMerchantIds.value) : next;
    };
    const received = shallowRef<InquiryVO[]>([]);
    const setReceived = (next: typeof received.value | ((previous: typeof received.value) => typeof received.value)) => {
      received.value = typeof next === 'function' ? (next as (previous: typeof received.value) => typeof received.value)(received.value) : next;
    };
    const receivedView = shallowRef<'card' | 'list'>('card');
    const setReceivedView = (next: typeof receivedView.value | ((previous: typeof receivedView.value) => typeof receivedView.value)) => {
      receivedView.value = typeof next === 'function' ? (next as (previous: typeof receivedView.value) => typeof receivedView.value)(receivedView.value) : next;
    };
    const submitting = shallowRef(false);
    const setSubmitting = (next: typeof submitting.value | ((previous: typeof submitting.value) => typeof submitting.value)) => {
      submitting.value = typeof next === 'function' ? (next as (previous: typeof submitting.value) => typeof submitting.value)(submitting.value) : next;
    };
    const standaloneForm = Form.useForm();
    const inquiryForm = Form.useForm();
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          getMyMerchants().then(response => {
            if (response?.code === 200) {
              setMyMerchantIds((response.data ?? []).map(item => String(item.merchantId)));
            }
          }).catch(() => setMyMerchantIds([]));
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    const isMyQuoteAsBuyer = (record: QuoteVO): boolean => record.buyerId != null && myMerchantIds.value.includes(String(record.buyerId));
    const loadReceived = (): void => {
      getReceivedInquiries().then((response: {
        code: number;
        data?: InquiryVO[];
      }) => {
        if (response?.code === 200) setReceived(response.data ?? []);
      }).catch(() => setReceived([]));
    };
    const loadData = async (): Promise<void> => {
      setLoading(true);
      try {
        const response = await getQuoteList(queryParams.value);
        if (response.code === 200) {
          setData(response.data?.records ?? []);
          setTotal(Number(response.data?.total ?? 0));
        } else {
          message.error(response.message ?? '加载报价失败');
        }
      } catch {
        message.error('加载报价失败（请检查后端是否在运行）');
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [loadReceived], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          loadReceived();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [queryParams.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          void loadData();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const showList = (): void => {
      setMode('list');
      setCurrentItem(null);
      setQuoteTarget(null);
    };
    const openInquiryQuote = (inquiry: InquiryVO): void => {
      setQuoteTarget(inquiry);
      inquiryForm.resetFields();
      inquiryForm.setFieldsValue({
        quantity: inquiry.quantity,
        freightAmount: 0
      });
      setMode('inquiryQuote');
    };
    const openStandalone = (record?: QuoteVO): void => {
      setCurrentItem(record ?? null);
      standaloneForm.resetFields();
      if (record) {
        standaloneForm.setFieldsValue({
          ...record,
          deliveryTime: record.deliveryTime ? dayjs(record.deliveryTime) : null,
          validDays: record.validUntil ? Math.max(1, Math.ceil(dayjs(record.validUntil).diff(dayjs(), 'day', true))) : 7,
          qualityLevel: qualityCode(record.qualityDescription)
        });
      } else {
        standaloneForm.setFieldsValue({
          validDays: 7,
          freightAmount: 0
        });
      }
      setMode('standaloneQuote');
    };
    const submitInquiryQuote = async (): Promise<void> => {
      if (!quoteTarget.value) return;
      const values = await inquiryForm.validateFields();
      setSubmitting(true);
      try {
        const response = await quoteInquiry({
          inquiryId: quoteTarget.value.id,
          unitPrice: values.unitPrice,
          quantity: values.quantity ?? quoteTarget.value.quantity,
          freightAmount: values.freightAmount,
          remark: values.remark
        });
        if (response?.code === 200) {
          message.success('报价已提交，采购方可在报价管理中受理');
          loadReceived();
          await loadData();
          showList();
        } else {
          message.error(response?.message ?? '报价失败');
        }
      } catch {
        message.error('报价失败（请检查后端是否在运行）');
      } finally {
        setSubmitting(false);
      }
    };
    const submitStandalone = async (): Promise<void> => {
      const values = await standaloneForm.validateFields();
      setSubmitting(true);
      try {
        const payload = {
          ...values,
          deliveryTime: values.deliveryTime?.format('YYYY-MM-DD')
        };
        const response = currentItem.value ? await updateQuote(currentItem.value.id, payload) : await createQuote(payload);
        if (response?.code === 200) {
          message.success(currentItem.value ? '报价已更新' : '报价已创建');
          await loadData();
          showList();
        } else {
          message.error(response?.message ?? '报价保存失败');
        }
      } catch {
        message.error('报价保存失败（请检查后端是否在运行）');
      } finally {
        setSubmitting(false);
      }
    };
    const handleDelete = async (record: QuoteVO): Promise<void> => {
      if (!window.confirm(`确定删除报价 ${record.quoteNo}？已生成订单的报价不能删除。`)) return;
      try {
        const response = await deleteQuote(record.id);
        if (response.code === 200) {
          message.success('报价已删除');
          await loadData();
        } else {
          message.error(response.message ?? '删除失败');
        }
      } catch {
        message.error('删除失败（请检查后端是否在运行）');
      }
    };
    const handleAccept = async (record: QuoteVO): Promise<void> => {
      try {
        const response = await acceptQuote(record.id);
        if (response.code === 200) {
          message.success('报价已受理');
          await loadData();
        } else {
          message.error(response.message ?? '接受报价失败');
        }
      } catch {
        message.error('接受报价失败');
      }
    };
    const handleConvert = async (record: QuoteVO): Promise<void> => {
      try {
        const response = await convertQuoteToOrder(record.id);
        if (response.code === 200 && response.data) {
          message.success('已生成采购订单');
          navigate(`/order/confirm?orderId=${response.data.id}`);
        } else {
          message.error(response.message ?? '生成订单失败');
        }
      } catch {
        message.error('生成订单失败');
      }
    };
    return () => {
      const view_quoteTarget = quoteTarget.value;
      const view_currentItem = currentItem.value;
      if (mode.value === 'inquiryQuote' && view_quoteTarget) {
        return <div class="quote-workbench quote-action-page">
        <button type="button" class="quote-back" onClick={showList}><ArrowLeftOutlined /> 返回报价与撮合</button>
        <section class="quote-action-hero">
          <span class="quote-action-icon"><SendOutlined /></span>
          <div><small>RESPOND TO INQUIRY</small><h2>询价报价</h2><p>{view_quoteTarget.inquiryNo} · {view_quoteTarget.productName || `商品 #${view_quoteTarget.productId}`}</p></div>
          <span class="mc-tag amber">{view_quoteTarget.inquiryStatus === 'quoted' ? '已报价' : '待报价'}</span>
        </section>
        <div class="quote-action-layout">
          <Panel title="报价信息">
            <Form form={inquiryForm} layout="vertical" onFinish={() => void submitInquiryQuote()} class="quote-form">
              <div class="quote-inquiry-brief">
                <div><span>采购方</span><strong>{view_quoteTarget.buyerName || '—'}</strong></div>
                <div><span>需求数量</span><strong>{view_quoteTarget.quantity} {view_quoteTarget.unit}</strong></div>
                <div><span>期望价格</span><strong>{money(view_quoteTarget.priceMin)} - {money(view_quoteTarget.priceMax)}</strong></div>
                <div><span>报价截止</span><strong>{shortDate(view_quoteTarget.replyDeadline)}</strong></div>
              </div>
              <div class="quote-form-grid">
                <Form.Item name="unitPrice" label={`单价（元/${view_quoteTarget.unit}）`} rules={[{
                    required: true,
                    message: '请输入报价单价'
                  }]}>
                  <InputNumber min={0.01} precision={2} style={{
                      width: '100%'
                    }} placeholder="请输入正式报价" />
                </Form.Item>
                <Form.Item name="quantity" label="报价数量">
                  <InputNumber min={0.001} precision={4} style={{
                      width: '100%'
                    }} />
                </Form.Item>
                <Form.Item name="freightAmount" label="运费（元）">
                  <InputNumber min={0} precision={2} style={{
                      width: '100%'
                    }} />
                </Form.Item>
              </div>
              <Form.Item name="remark" label="报价说明">
                <Input.TextArea rows={5} placeholder="例如：含包装、7 天内发货、可提供质检报告" showCount maxLength={500} />
              </Form.Item>
              <div class="quote-form-actions">
                <button type="submit" class="mc-btn" disabled={submitting.value}>{submitting.value ? '正在提交…' : '提交正式报价'}</button>
                <button type="button" class="mc-btn ghost" onClick={showList}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside class="quote-action-aside">
            <Panel title="报价提示">
              <ul class="quote-guidance">
                <li><CheckCircleOutlined /> 总价由平台按“单价 × 数量 + 运费”计算。</li>
                <li><ClockCircleOutlined /> 请在报价截止前提交，报价会被平台留痕。</li>
                <li><SafetyCertificateOutlined /> 采购方受理后，平台可依据报价生成订单。</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>;
      }
      if (mode.value === 'standaloneQuote') {
        return <div class="quote-workbench quote-action-page">
        <button type="button" class="quote-back" onClick={showList}><ArrowLeftOutlined /> 返回报价管理</button>
        <section class="quote-action-hero">
          <span class="quote-action-icon"><EditOutlined /></span>
          <div><small>{view_currentItem ? 'EDIT QUOTATION' : 'NEW QUOTATION'}</small><h2>{view_currentItem ? '编辑报价' : '新增报价'}</h2><p>{view_currentItem ? view_currentItem.quoteNo : '创建不关联询价单的独立报价'}</p></div>
          {view_currentItem && <StatusTag status={view_currentItem.quoteStatus} />}
        </section>
        <div class="quote-action-layout">
          <Panel title="报价内容">
            <Form form={standaloneForm} layout="vertical" onFinish={() => void submitStandalone()} class="quote-form">
              <div class="quote-form-grid">
                <Form.Item name="productName" label="产品名称" rules={[{
                    required: true,
                    message: '请输入产品名称'
                  }]}>
                  <Input placeholder="请输入产品名称" />
                </Form.Item>
                <Form.Item name="unitPrice" label="销售单价（元）" rules={[{
                    required: true,
                    message: '请输入单价'
                  }]}>
                  <InputNumber min={0.01} precision={2} style={{
                      width: '100%'
                    }} />
                </Form.Item>
                <Form.Item name="quantity" label="可供数量" rules={[{
                    required: true,
                    message: '请输入数量'
                  }]}>
                  <InputNumber min={0.001} precision={4} style={{
                      width: '100%'
                    }} />
                </Form.Item>
                <Form.Item name="unit" label="计量单位" rules={[{
                    required: true,
                    message: '请选择单位'
                  }]}>
                  <Select options={['吨', '千克', '斤', '件', '箱', '袋'].map(value => ({
                      value,
                      label: value
                    }))} />
                </Form.Item>
                <Form.Item name="freightAmount" label="运费（元）">
                  <InputNumber min={0} precision={2} style={{
                      width: '100%'
                    }} />
                </Form.Item>
                <Form.Item name="validDays" label="有效期（天）" rules={[{
                    required: true,
                    message: '请输入有效期'
                  }]}>
                  <InputNumber min={1} max={365} precision={0} style={{
                      width: '100%'
                    }} />
                </Form.Item>
                <Form.Item name="qualityLevel" label="质量等级">
                  <Select options={[{
                      value: 'premium',
                      label: '特级'
                    }, {
                      value: 'level1',
                      label: '一级'
                    }, {
                      value: 'level2',
                      label: '二级'
                    }, {
                      value: 'level3',
                      label: '三级'
                    }]} />
                </Form.Item>
                <Form.Item name="deliveryTime" label="交货时间">
                  <DatePicker style={{
                      width: '100%'
                    }} />
                </Form.Item>
              </div>
              <Form.Item name="deliveryAddress" label="交货地址">
                <Input.TextArea rows={3} placeholder="请输入交货地址" />
              </Form.Item>
              <Form.Item name="remark" label="报价备注">
                <Input.TextArea rows={4} placeholder="补充包装、质量标准、发货安排等" showCount maxLength={500} />
              </Form.Item>
              <div class="quote-form-actions">
                <button type="submit" class="mc-btn" disabled={submitting.value}>{submitting.value ? '正在保存…' : view_currentItem ? '保存报价' : '创建报价'}</button>
                <button type="button" class="mc-btn ghost" onClick={showList}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside class="quote-action-aside">
            <Panel title="报价说明">
              <ul class="quote-guidance">
                <li><TagOutlined /> 卖方主体由当前登录卖家自动确定。</li>
                <li><CheckCircleOutlined /> 总价由平台按单价与数量计算。</li>
                <li><SafetyCertificateOutlined /> 已受理或已生成订单的报价不能修改。</li>
              </ul>
            </Panel>
            <div class="quote-aside-tip">
              <ShopOutlined />
              <div><strong>提示</strong><span>独立报价用于主动展示供应价格；采购方若要直接成交，请优先响应其询价单。</span></div>
            </div>
          </aside>
        </div>
      </div>;
      }
      const pageCount = Math.max(1, Math.ceil(total.value / Number(queryParams.value.pageSize ?? 10)));
      const pendingCount = data.value.filter(item => item.quoteStatus === 'pending').length;
      return <div class="quote-workbench">
      <Panel title={`收到的询价（${received.value.length}）`} extra={<div class="quote-received-tools">
          <span class="quote-section-note">采购方询价等待响应</span>
          <div class="quote-view-toggle" role="group" aria-label="收到的询价展示方式">
            <button type="button" class={receivedView.value === 'card' ? 'on' : ''} aria-pressed={receivedView.value === 'card'} onClick={() => setReceivedView('card')}>
              <AppstoreOutlined />卡片
            </button>
            <button type="button" class={receivedView.value === 'list' ? 'on' : ''} aria-pressed={receivedView.value === 'list'} onClick={() => setReceivedView('list')}>
              <UnorderedListOutlined />列表
            </button>
          </div>
        </div>}>
        {received.value.length === 0 ? <EmptyState title="暂无采购询价" desc="采购方针对你的货源发起询价后，会显示在这里。" /> : receivedView.value === 'card' ? <div class="quote-inquiry-grid">
            {received.value.map(inquiry => {
              const meta = INQUIRY_STATUS[inquiry.inquiryStatus] ?? {
                text: inquiry.inquiryStatus,
                tone: 'ghost'
              };
              return <div class="quote-inquiry-card" key={inquiry.id}>
                  <div class="quote-inquiry-head">
                    <span class="quote-inquiry-icon"><FileSearchOutlined /></span>
                    <div><small>{inquiry.inquiryNo}</small><strong>{inquiry.productName || `商品 #${inquiry.productId}`}</strong><p>{inquiry.buyerName || '采购方'} · {inquiry.quantity} {inquiry.unit}</p></div>
                    <span class={`mc-tag ${meta.tone}`}>{meta.text}</span>
                  </div>
                  <div class="quote-inquiry-data">
                    <div><span>期望价格</span><strong>{money(inquiry.priceMin)} - {money(inquiry.priceMax)}</strong></div>
                    <div><span>报价数量</span><strong>{inquiry.quantity} {inquiry.unit}</strong></div>
                    <div><span>报价截止</span><strong>{shortDate(inquiry.replyDeadline)}</strong></div>
                  </div>
                  <div class="quote-inquiry-foot">
                    <span>{inquiry.replyCount ?? 0} 份已提交报价</span>
                    <button type="button" class="mc-btn" onClick={() => openInquiryQuote(inquiry)}><SendOutlined /> 去报价</button>
                  </div>
                </div>;
            })}
          </div> : <TradeList listId="seller-received-inquiry" rowKey="id" dataSource={received.value} onRefresh={loadReceived} columns={[{
            title: "询价单号",
            key: 'col-1',
            width: 160,
            render: (_, inquiry) => <span class="mc-mono">{inquiry.inquiryNo}</span>
          }, {
            title: "商品",
            key: 'col-2',
            width: 160,
            render: (_, inquiry) => <><strong class="quote-received-product">{inquiry.productName || `商品 #${inquiry.productId}`}</strong></>
          }, {
            title: "采购方",
            key: 'col-3',
            width: 160,
            render: (_, inquiry) => <>{inquiry.buyerName || '采购方'}</>
          }, {
            title: "采购数量",
            key: 'col-4',
            width: 108,
            render: (_, inquiry) => <span class="mc-mono">{inquiry.quantity} {inquiry.unit}</span>
          }, {
            title: "期望价格",
            key: 'col-5',
            width: 160,
            render: (_, inquiry) => <span class="mc-price">{money(inquiry.priceMin)} - {money(inquiry.priceMax)}</span>
          }, {
            title: "报价截止",
            key: 'col-6',
            width: 160,
            render: (_, inquiry) => <span class="mc-mono mc-xs">{shortDate(inquiry.replyDeadline)}</span>
          }, {
            title: "已报价",
            key: 'col-7',
            width: 160,
            render: (_, inquiry) => <span class="mc-mono">{inquiry.replyCount ?? 0} 份</span>
          }, {
            title: "状态",
            key: 'col-8',
            width: 108,
            render: (_, inquiry) => {
              const meta = INQUIRY_STATUS[inquiry.inquiryStatus] ?? {
                text: inquiry.inquiryStatus || '未知',
                tone: 'ghost'
              };
              return <><span class={`mc-tag ${meta.tone}`}>{meta.text}</span></>;
            }
          }, {
            title: "操作",
            key: 'action',
            width: 170,
            render: (_, inquiry) => <><button type="button" class="mc-link" onClick={() => openInquiryQuote(inquiry)}>
                          去报价
                        </button></>
          }]} />}
      </Panel>

      <Panel title="报价管理" extra={<button type="button" class="mc-btn" onClick={() => openStandalone()}><PlusOutlined /> 新增报价</button>}>
        <div class="quote-toolbar">
          <Input allowClear prefix={<SearchOutlined />} placeholder="报价编号" value={queryParams.value.quoteNo} onChange={event => setQueryParams(previous => ({
              ...previous,
              quoteNo: event.target.value ?? ''
            }))} />
          <Input allowClear placeholder="产品名称" value={queryParams.value.productName} onChange={event => setQueryParams(previous => ({
              ...previous,
              productName: event.target.value ?? ''
            }))} />
          <Select allowClear placeholder="报价状态" value={queryParams.value.quoteStatus} onChange={value => setQueryParams(previous => ({
              ...previous,
              quoteStatus: value
            }))} options={Object.entries(STATUS).map(([value, item]) => ({
              value,
              label: item.text
            }))} />
          <button type="button" class="mc-btn" onClick={() => setQueryParams(previous => ({
              ...previous,
              pageNum: 1
            }))}>搜索</button>
          <button type="button" class="mc-btn ghost" onClick={() => setQueryParams({
              pageNum: 1,
              pageSize: 20
            })}>重置</button>
        </div>
        <div class="quote-list-summary">
          <span>本页 {data.value.length} 份报价</span>
          <span>待受理 {pendingCount} 份</span>
          <span>报价总数 {total.value} 份</span>
        </div>
        {loading.value ? <div class="quote-loading"><Spin /><span>正在读取报价记录…</span></div> : data.value.length === 0 ? <EmptyState title="暂无报价记录" desc="响应采购询价或新增独立报价后，记录会显示在这里。" /> : <div class="quote-card-list">
            {data.value.map(record => {
              const expired = record.validUntil && dayjs(record.validUntil).isBefore(dayjs());
              return <div class="quote-card" key={record.id}>
                  <div class="quote-card-main">
                    <span class="quote-card-icon"><TagOutlined /></span>
                    <div>
                      <div class="quote-card-title"><strong>{record.productName || '未命名报价'}</strong><StatusTag status={record.quoteStatus} /></div>
                      <small>{record.quoteNo} · {record.sellerName || '当前卖家'} · {shortDate(record.createTime)}</small>
                      <p>{record.remark || '暂无报价说明'}</p>
                    </div>
                  </div>
                  <div class="quote-card-numbers">
                    <div><span>单价</span><strong>{money(record.unitPrice)}/{record.unit}</strong></div>
                    <div><span>数量</span><strong>{record.quantity} {record.unit}</strong></div>
                    <div><span>总价</span><strong class="quote-price">{money(record.totalAmount)}</strong></div>
                  </div>
                  <div class="quote-card-validity">
                    <span>有效期至</span><strong class={expired ? 'expired' : ''}>{shortDate(record.validUntil)}</strong>
                  </div>
                  <div class="quote-card-actions">
                    {record.quoteStatus === 'pending' && <button type="button" class="mc-link quote-action" onClick={() => openStandalone(record)}><EditOutlined /> 编辑</button>}
                    {record.orderId ? <a class="mc-link quote-action" href={`/order/detail/${record.orderId}`}>查看订单</a> : <button type="button" class="mc-link quote-action" onClick={() => void handleDelete(record)}><DeleteOutlined /> 删除</button>}
                    {record.quoteStatus === 'pending' && isMyQuoteAsBuyer(record) && <button type="button" class="mc-link quote-action" onClick={() => void handleAccept(record)}><CheckCircleOutlined /> 接受</button>}
                    {record.quoteStatus === 'accepted' && isMyQuoteAsBuyer(record) && <button type="button" class="mc-link quote-action" onClick={() => void handleConvert(record)}>生成订单</button>}
                  </div>
                </div>;
            })}
          </div>}
        {data.value.length > 0 && <div class="mc-pager quote-pager">
            <button type="button" disabled={Number(queryParams.value.pageNum) <= 1} onClick={() => setQueryParams(previous => ({
              ...previous,
              pageNum: Number(previous.pageNum) - 1
            }))}>上一页</button>
            <span>第 {queryParams.value.pageNum} / {pageCount} 页 · 共 {total.value} 份</span>
            <button type="button" disabled={Number(queryParams.value.pageNum) >= pageCount} onClick={() => setQueryParams(previous => ({
              ...previous,
              pageNum: Number(previous.pageNum) + 1
            }))}>下一页</button>
          </div>}
      </Panel>
    </div>;
    };
  }
});
export default QuoteList;
