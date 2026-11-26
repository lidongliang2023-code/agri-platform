import '../../dispute/list/after-sales.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { ListRowActions } from "@/vue/shared";
import { TradeList, TradeFilters } from '@/components/TradeList';
import { Form, Input, InputNumber, Select, Spin, Modal, Alert, message } from "@/vue/ui";
import { ArrowLeftOutlined, CheckCircleOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, EyeOutlined, SearchOutlined, ShopOutlined, CarOutlined } from "@ant-design/icons-vue";
import { useQuery, useQueryClient } from "@/vue/query";
import { createReship, deleteLogistics, getCarriers, getLogisticsById, getLogisticsList, getLogisticsTraces, updateLogistics, updateLogisticsStatus, type CarrierVO, type LogisticsQuery, type LogisticsVO, type LogisticsTraceVO } from '@/api/logistics';
import { EmptyState, Panel, money, shortDate } from '../../member-center/shared';
type LogisticsPageMode = 'list' | 'detail' | 'trace' | 'edit';
const LOGISTICS_TYPE: Record<string, string> = {
  cold_chain: '冷链运输',
  normal: '普通货运',
  express: '快递配送',
  self_pickup: '买家自提',
  road: '公路运输'
};
const LOGISTICS_STATUS: Record<string, {
  text: string;
  tone: string;
}> = {
  pending: {
    text: '待揽收',
    tone: 'amber'
  },
  picked: {
    text: '已揽收',
    tone: 'tech'
  },
  in_transit: {
    text: '运输中',
    tone: 'tech'
  },
  delivering: {
    text: '派送中',
    tone: 'tech'
  },
  delivered: {
    text: '已签收',
    tone: 'green'
  },
  exception: {
    text: '运输异常',
    tone: 'red'
  }
};
function logisticsStatus(value: string): {
  text: string;
  tone: string;
} {
  return LOGISTICS_STATUS[value] ?? {
    text: value || '未知',
    tone: 'ghost'
  };
}
const LogisticsTag = defineComponent({
  name: "LogisticsTag",
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
    const meta = computed(() => logisticsStatus(__props.value));
    return () => {
      return <span class={`mc-tag ${meta.value.tone}`}>{meta.value.text}</span>;
    };
  }
});
/** 买卖双方共用的物流管理工作区。 */
const LogisticsList = defineComponent({
  name: "LogisticsList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const queryClient = useQueryClient();
    const pageMode = shallowRef<LogisticsPageMode>('list');
    const setPageMode = (next: typeof pageMode.value | ((previous: typeof pageMode.value) => typeof pageMode.value)) => {
      pageMode.value = typeof next === 'function' ? (next as (previous: typeof pageMode.value) => typeof pageMode.value)(pageMode.value) : next;
    };
    const active = shallowRef<LogisticsVO | null>(null);
    const setActive = (next: typeof active.value | ((previous: typeof active.value) => typeof active.value)) => {
      active.value = typeof next === 'function' ? (next as (previous: typeof active.value) => typeof active.value)(active.value) : next;
    };
    const query = shallowRef<LogisticsQuery>({
      pageNum: 1,
      pageSize: 20
    });
    const setQuery = (next: typeof query.value | ((previous: typeof query.value) => typeof query.value)) => {
      query.value = typeof next === 'function' ? (next as (previous: typeof query.value) => typeof query.value)(query.value) : next;
    };
    const draft = shallowRef<{
      logisticsNo?: string;
      logisticsStatus?: string;
    }>({});
    const setDraft = (next: typeof draft.value | ((previous: typeof draft.value) => typeof draft.value)) => {
      draft.value = typeof next === 'function' ? (next as (previous: typeof draft.value) => typeof draft.value)(draft.value) : next;
    };
    const form = Form.useForm();
    const saving = shallowRef(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const carriers = shallowRef<CarrierVO[]>([]);
    const setCarriers = (next: typeof carriers.value | ((previous: typeof carriers.value) => typeof carriers.value)) => {
      carriers.value = typeof next === 'function' ? (next as (previous: typeof carriers.value) => typeof carriers.value)(carriers.value) : next;
    };
    const traces = shallowRef<LogisticsTraceVO[]>([]);
    const setTraces = (next: typeof traces.value | ((previous: typeof traces.value) => typeof traces.value)) => {
      traces.value = typeof next === 'function' ? (next as (previous: typeof traces.value) => typeof traces.value)(traces.value) : next;
    };
    const traceLoading = shallowRef(false);
    const setTraceLoading = (next: typeof traceLoading.value | ((previous: typeof traceLoading.value) => typeof traceLoading.value)) => {
      traceLoading.value = typeof next === 'function' ? (next as (previous: typeof traceLoading.value) => typeof traceLoading.value)(traceLoading.value) : next;
    };
    const reshipSource = shallowRef<LogisticsVO | null>(null);
    const setReshipSource = (next: typeof reshipSource.value | ((previous: typeof reshipSource.value) => typeof reshipSource.value)) => {
      reshipSource.value = typeof next === 'function' ? (next as (previous: typeof reshipSource.value) => typeof reshipSource.value)(reshipSource.value) : next;
    };
    const ticketNo = shallowRef('');
    const setTicketNo = (next: typeof ticketNo.value | ((previous: typeof ticketNo.value) => typeof ticketNo.value)) => {
      ticketNo.value = typeof next === 'function' ? (next as (previous: typeof ticketNo.value) => typeof ticketNo.value)(ticketNo.value) : next;
    };
    const reshipSaving = shallowRef(false);
    const setReshipSaving = (next: typeof reshipSaving.value | ((previous: typeof reshipSaving.value) => typeof reshipSaving.value)) => {
      reshipSaving.value = typeof next === 'function' ? (next as (previous: typeof reshipSaving.value) => typeof reshipSaving.value)(reshipSaving.value) : next;
    };
    const submitReship = async (): Promise<void> => {
      if (!reshipSource.value || reshipSaving.value) return;
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(ticketNo.value.trim())) {
        message.warning('请填写有效工单号');
        return;
      }
      setReshipSaving(true);
      try {
        const result = await createReship(reshipSource.value.id, ticketNo.value.trim());
        if (result?.code !== 200) {
          message.error(result?.message || '补发登记失败');
          return;
        }
        message.success(`已生成补发物流 ${result.data?.logisticsNo}，数量以生产工单为准，买方签收后可核验关闭`);
        setReshipSource(null);
        await queryClient.invalidateQueries({
          queryKey: ['logistics']
        });
      } catch {
        message.error('补发登记失败，请刷新查询，勿重复登记');
      } finally {
        setReshipSaving(false);
      }
    };
    const _query = useQuery(() => ({
      queryKey: ['logistics', query.value],
      queryFn: () => getLogisticsList(query.value)
    }));
    const rows = computed<LogisticsVO[]>(() => _query.data.value?.data?.records ?? []);
    const total = computed(() => Number(_query.data.value?.data?.total ?? 0));
    const summary = computed(() => ({
      transit: rows.value.filter(row => ['picked', 'in_transit', 'delivering'].includes(row.logisticsStatus)).length,
      delivered: rows.value.filter(row => row.logisticsStatus === 'delivered').length,
      exception: rows.value.filter(row => row.logisticsStatus === 'exception').length,
      freight: rows.value.reduce((sum, row) => sum + Number(row.freightAmount ?? 0), 0)
    }));
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          getCarriers().then((response: {
            code: number;
            data?: CarrierVO[];
          }) => {
            if (response?.code === 200) setCarriers(response.data ?? []);
          }).catch(() => setCarriers([]));
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    const showList = (): void => {
      setPageMode('list');
      setActive(null);
    };
    const showDetail = (row: LogisticsVO): void => {
      setActive(row);
      setPageMode('detail');
    };
    const openTrace = async (row: LogisticsVO): Promise<void> => {
      setActive(row);
      setPageMode('trace');
      setTraces([]);
      setTraceLoading(true);
      try {
        const response = await getLogisticsTraces(row.id);
        if (response?.code === 200) setTraces(response.data ?? []);else message.error(response?.message ?? '加载物流轨迹失败');
      } catch {
        message.error('加载物流轨迹失败（请检查后端是否在运行）');
      } finally {
        setTraceLoading(false);
      }
    };
    const openEdit = (row: LogisticsVO): void => {
      setActive(row);
      setPageMode('edit');
      form.setFieldsValue({
        carrierId: row.carrierId ?? undefined,
        logisticsType: row.logisticsType ?? undefined,
        freightAmount: row.freightAmount ?? undefined,
        status: row.logisticsStatus,
        location: row.currentLocation ?? undefined,
        signReceiver: row.signReceiver ?? undefined,
        receiverContact: row.receiverContact ?? undefined,
        receiverPhone: row.receiverPhone ?? undefined,
        receiverAddress: row.receiverAddress ?? undefined
      });
    };
    const submitEdit = async (): Promise<void> => {
      if (!active.value) return;
      const values = await form.validateFields();
      setSaving(true);
      try {
        const basic = active.value.diffTicketNo ? {
          code: 200,
          message: ''
        } : await updateLogistics(active.value.id, {
          carrierId: values.carrierId,
          logisticsType: values.logisticsType,
          freightAmount: values.freightAmount,
          receiverContact: values.receiverContact,
          receiverPhone: values.receiverPhone,
          receiverAddress: values.receiverAddress
        });
        if (basic?.code !== 200) {
          message.error(basic?.message ?? '物流信息保存失败');
          return;
        }
        const status = await updateLogisticsStatus(active.value.id, values.status, {
          location: values.location,
          signReceiver: values.signReceiver
        });
        if (status?.code !== 200) {
          message.error(status?.message ?? '物流状态更新失败');
          return;
        }
        message.success('物流信息与状态已更新');
        await queryClient.invalidateQueries({
          queryKey: ['logistics']
        });
        const refreshed = await getLogisticsById(active.value.id);
        if (refreshed?.code === 200 && refreshed.data) setActive(refreshed.data);
        setPageMode('detail');
      } catch {
        message.error('物流信息更新失败（请检查后端是否在运行）');
      } finally {
        setSaving(false);
      }
    };
    const handleDelete = async (row: LogisticsVO): Promise<void> => {
      if (!window.confirm(`确定删除物流单 ${row.logisticsNo}？已签收物流单不能删除。`)) return;
      try {
        const response = await deleteLogistics(row.id);
        if (response?.code === 200) {
          message.success('物流单已删除');
          await queryClient.invalidateQueries({
            queryKey: ['logistics']
          });
          if (active.value?.id === row.id) showList();
        } else {
          message.error(response?.message ?? '删除失败');
        }
      } catch {
        message.error('删除失败（请检查后端是否在运行）');
      }
    };
    return () => {
      const view_reshipSource = reshipSource.value;
      const view_active = active.value;
      if (pageMode.value === 'trace' && view_active) {
        return <div class="after-workbench logistics-workbench">
        <button type="button" class="after-back" onClick={() => setPageMode('detail')}>
          <ArrowLeftOutlined /> 返回物流详情
        </button>
        <section class="after-hero logistics-hero">
          <span class="after-hero-icon"><CarOutlined /></span>
          <div><small>LOGISTICS TRACKING</small><h2>物流轨迹</h2><p>{view_active.logisticsNo} · {view_active.carrierName || '承运商待补充'}</p></div>
          <LogisticsTag value={view_active.logisticsStatus} />
        </section>
        <Panel title="运输节点">
          {traceLoading.value ? <div class="after-loading"><Spin /><span>正在加载物流轨迹…</span></div> : traces.value.length === 0 ? <EmptyState title="暂无物流轨迹" desc="物流状态更新后，运输节点会显示在这里。" /> : <div class="logistics-trace-list">
              {[...traces.value].sort((left, right) => String(right.traceTime).localeCompare(String(left.traceTime))).map((trace, index) => <div class={`logistics-trace-item ${index === 0 ? 'latest' : ''}`} key={trace.id}>
                  <span class="logistics-trace-dot"><CheckCircleOutlined /></span>
                  <div>
                    <strong>{trace.traceDescription || logisticsStatus(trace.traceStatus).text}</strong>
                    <p><EnvironmentOutlined /> {trace.traceLocation || '位置待更新'}</p>
                    <small>{shortDate(trace.traceTime)}</small>
                  </div>
                </div>)}
            </div>}
        </Panel>
      </div>;
      }
      if (pageMode.value === 'edit' && view_active) {
        return <div class="after-workbench logistics-workbench">
        <button type="button" class="after-back" onClick={() => setPageMode('detail')}>
          <ArrowLeftOutlined /> 返回物流详情
        </button>
        <section class="after-hero logistics-hero">
          <span class="after-hero-icon"><EditOutlined /></span>
          <div><small>DELIVERY UPDATE</small><h2>编辑物流信息</h2><p>{view_active.logisticsNo} · 更新承运商、收货信息与物流节点</p></div>
          <LogisticsTag value={view_active.logisticsStatus} />
        </section>
        <div class="after-form-layout">
          <Panel title="物流与收发货信息">
            <Form form={form} layout="vertical" onFinish={() => void submitEdit()} class="after-form">
              <div class="after-form-grid">
                <Form.Item name="carrierId" label="承运商">
                  <Select allowClear options={carriers.value.map(item => ({
                      value: item.id,
                      label: item.carrierName
                    }))} />
                </Form.Item>
                <Form.Item name="logisticsType" label="物流类型">
                  <Select allowClear options={Object.entries(LOGISTICS_TYPE).map(([value, label]) => ({
                      value,
                      label
                    }))} />
                </Form.Item>
                <Form.Item name="freightAmount" label="运费（元）">
                  <InputNumber min={0} precision={2} style={{
                      width: '100%'
                    }} />
                </Form.Item>
                <Form.Item name="status" label="物流状态" rules={[{
                    required: true,
                    message: '请选择物流状态'
                  }]}>
                  <Select options={Object.entries(LOGISTICS_STATUS).map(([value, item]) => ({
                      value,
                      label: item.text
                    }))} />
                </Form.Item>
              </div>
              <div class="after-form-grid">
                <Form.Item name="location" label="当前位置">
                  <Input placeholder="例如：山东省潍坊市寒亭区" />
                </Form.Item>
                <Form.Item name="signReceiver" label="签收人">
                  <Input placeholder="状态为已签收时填写" />
                </Form.Item>
                <Form.Item name="receiverContact" label="收货人">
                  <Input />
                </Form.Item>
                <Form.Item name="receiverPhone" label="收货电话">
                  <Input />
                </Form.Item>
              </div>
              <Form.Item name="receiverAddress" label="收货地址">
                <Input.TextArea rows={3} />
              </Form.Item>
              <div class="after-form-actions">
                <button type="submit" class="mc-btn" disabled={saving.value}>{saving.value ? '正在保存…' : '保存物流信息'}</button>
                <button type="button" class="mc-btn ghost" onClick={() => setPageMode('detail')}>取消</button>
              </div>
            </Form>
          </Panel>
          <aside class="after-side-stack">
            <Panel title="操作说明">
              <ul class="after-guidance">
                <li><CarOutlined /> 修改物流状态会自动追加一条运输轨迹。</li>
                <li><CheckCircleOutlined /> 状态选择“已签收”时需要填写签收人。</li>
                <li><ShopOutlined /> 收发货信息会同步展示在订单物流详情中。</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>;
      }
      if (pageMode.value === 'detail' && view_active) {
        return <div class="after-workbench logistics-workbench">
        <button type="button" class="after-back" onClick={showList}>
          <ArrowLeftOutlined /> 返回物流管理
        </button>
        <section class="after-hero logistics-hero">
          <span class="after-hero-icon"><CarOutlined /></span>
          <div><small>LOGISTICS ORDER · {view_active.logisticsNo}</small><h2>{view_active.carrierName || '物流单详情'}</h2><p>关联订单 {view_active.orderId} · {LOGISTICS_TYPE[view_active.logisticsType] ?? view_active.logisticsType}</p></div>
          <LogisticsTag value={view_active.logisticsStatus} />
          <div class="logistics-hero-actions">
            <button type="button" class="mc-btn" onClick={() => void openTrace(view_active)}><CarOutlined /> 查看轨迹</button>
            <button type="button" class="mc-btn ghost" onClick={() => openEdit(view_active)}><EditOutlined /> 编辑</button>
          </div>
        </section>
        <Panel title="运输路线">
          <div class="logistics-route">
            <div><span><ShopOutlined /></span><small>发货地</small><strong>{view_active.senderAddress || '发货地址待补充'}</strong></div>
            <div class="logistics-route-line"><i /><CarOutlined /><i /></div>
            <div><span><EnvironmentOutlined /></span><small>收货地</small><strong>{view_active.receiverAddress || '收货地址待补充'}</strong></div>
          </div>
        </Panel>
        <div class="after-detail-layout">
          <div class="after-detail-main">
            <Panel title="物流信息">
              <div class="after-case-grid logistics-facts">
                <div><span>承运商</span><strong>{view_active.carrierName || '—'}</strong></div>
                <div><span>物流类型</span><strong>{LOGISTICS_TYPE[view_active.logisticsType] ?? view_active.logisticsType}</strong></div>
                <div><span>运费</span><strong class="after-amount">{money(view_active.freightAmount)}</strong></div>
                <div><span>当前位置</span><strong>{view_active.currentLocation || '—'}</strong></div>
                <div><span>收货人</span><strong>{view_active.receiverContact || '—'}</strong></div>
                <div><span>联系电话</span><strong>{view_active.receiverPhone || '—'}</strong></div>
              </div>
            </Panel>
            <Panel title="签收记录">
              <div class="after-result-list">
                <div><span>揽收时间</span><p>{shortDate(view_active.pickupTime)}</p></div>
                <div><span>送达时间</span><p>{shortDate(view_active.deliveryTime)}</p></div>
                <div><span>签收时间</span><p>{shortDate(view_active.signTime)}</p></div>
                <div><span>签收人</span><p>{view_active.signReceiver || '尚未签收'}</p></div>
              </div>
            </Panel>
          </div>
          <aside class="after-detail-aside">
            <Panel title="履约进度">
              <div class="after-timeline">
                <div class="on"><span><CheckCircleOutlined /></span><div><strong>物流单已创建</strong><small>{shortDate(view_active.createTime)}</small></div></div>
                <div class={['picked', 'in_transit', 'delivering', 'delivered'].includes(view_active.logisticsStatus) ? 'on' : ''}><span><CarOutlined /></span><div><strong>运输与派送</strong><small>{logisticsStatus(view_active.logisticsStatus).text}</small></div></div>
                <div class={view_active.logisticsStatus === 'delivered' ? 'on' : ''}><span><CheckCircleOutlined /></span><div><strong>完成签收</strong><small>{shortDate(view_active.signTime)}</small></div></div>
              </div>
            </Panel>
            <Panel title="快捷操作">
              <div class="logistics-quick-actions">
                <button type="button" class="mc-btn ghost" onClick={() => void openTrace(view_active)}>查看完整轨迹</button>
                <button type="button" class="mc-btn ghost" onClick={() => openEdit(view_active)}>更新运输状态</button>
                <button type="button" class="mc-link after-delete" onClick={() => void handleDelete(view_active)}><DeleteOutlined /> 删除物流单</button>
              </div>
            </Panel>
          </aside>
        </div>
      </div>;
      }
      return <div class="after-workbench logistics-workbench">
      <section class="after-overview">
        <div class="after-overview-title">
          <span class="after-overview-icon"><CarOutlined /></span>
          <div><small>LOGISTICS MANAGEMENT</small><h2>物流管理</h2><p>跟踪发货、运输、派送和签收节点，维护承运与收货信息。</p></div>
        </div>
        <div class="after-overview-stats">
          <div><span>本页运输中</span><strong>{summary.value.transit}</strong></div>
          <div><span>本页已签收</span><strong>{summary.value.delivered}</strong></div>
          <div><span>本页异常</span><strong>{summary.value.exception}</strong></div>
          <div><span>本页运费</span><strong>{money(summary.value.freight)}</strong></div>
        </div>
      </section>
      <Modal title="按短装工单登记补发" open={!!view_reshipSource} confirmLoading={reshipSaving.value} onOk={() => void submitReship()} onCancel={() => {
          if (!reshipSaving.value) setReshipSource(null);
        }}>
        <Alert type="info" showIcon message="卖方登记补发，买方确认签收" description="先将生产短装工单登记为处理中、方式为补发。系统核对原供给和订单，按差异量生成一张足额补发单。补发单不可删除、不可重复登记；此操作仅安排物流，不自动扣减库存。" />
        <Input style={{
            marginTop: 16
          }} value={ticketNo.value} maxLength={64} onChange={e => setTicketNo(e.target.value ?? '')} placeholder="生产短装工单号" />
      </Modal>
      <TradeList listId="member-logistics" rowKey="id" dataSource={rows.value} onRefresh={() => void _query.refetch()} loading={_query.isFetching.value} filterSlot={<TradeFilters fields={[{
          label: '物流单号',
          control: <Input prefix={<SearchOutlined />} allowClear placeholder="输入物流单号" value={draft.value.logisticsNo} onChange={event => setDraft(previous => ({
            ...previous,
            logisticsNo: (event.target.value ?? '') || undefined
          }))} />
        }, {
          label: '物流状态',
          control: <Select allowClear placeholder="全部物流状态" value={draft.value.logisticsStatus} onChange={value => setDraft(previous => ({
            ...previous,
            logisticsStatus: value
          }))} options={Object.entries(LOGISTICS_STATUS).map(([value, item]) => ({
            value,
            label: item.text
          }))} />
        }]} onQuery={() => setQuery(prev => ({
          ...prev,
          pageNum: 1,
          logisticsNo: draft.value.logisticsNo,
          logisticsStatus: draft.value.logisticsStatus
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
          emptyText: '暂无物流单'
        }} columns={[{
          title: "物流单号",
          key: 'col-1',
          width: 160,
          render: (_, row) => <><button type="button" class="after-name-link" onClick={() => showDetail(row)}>
                          <strong class="mc-mono">{row.logisticsNo}</strong>
                          <span>{shortDate(row.createTime)}</span>
                        </button></>
        }, {
          title: "关联订单",
          key: 'col-2',
          width: 160,
          render: (_, row) => <span class="mc-mono">{row.orderId}{row.diffTicketNo && <><br />工单：{row.diffTicketNo}<br />补发：{row.reshipQty} {row.reshipUnit}</>}</span>
        }, {
          title: "承运信息",
          key: 'col-3',
          width: 160,
          render: (_, row) => <><div class="logistics-carrier-cell"><CarOutlined /><span>{row.carrierName || '承运商待补充'}</span><small>{LOGISTICS_TYPE[row.logisticsType] ?? row.logisticsType}</small></div></>
        }, {
          title: "收货信息",
          key: 'col-4',
          width: 220,
          render: (_, row) => <><div class="logistics-receiver-cell"><strong>{row.receiverContact || '—'}</strong><small>{row.receiverAddress || '地址待补充'}</small></div></>
        }, {
          title: "状态",
          key: 'col-5',
          width: 108,
          render: (_, row) => <><LogisticsTag value={row.logisticsStatus} /></>
        }, {
          title: "当前位置",
          key: 'col-6',
          width: 160,
          render: (_, row) => <span class="logistics-location-cell">{row.currentLocation || '—'}</span>
        }, {
          title: "操作",
          key: 'action',
          width: 170,
          render: (_, row) => <><ListRowActions>
                          <button type="button" class="mc-link after-action" onClick={() => void openTrace(row)}><CarOutlined /> 跟踪</button>
                          <button type="button" class="mc-link after-action" onClick={() => showDetail(row)}><EyeOutlined /> 查看</button>
                          {!row.diffTicketNo && <button type="button" class="mc-link after-action" onClick={() => {
                setTicketNo('');
                setReshipSource(row);
              }}>登记补发</button>}
                          <button type="button" class="mc-link after-action" onClick={() => openEdit(row)}><EditOutlined /> 编辑</button>
                        </ListRowActions></>
        }]} />
    </div>;
    };
  }
});
export default LogisticsList;
