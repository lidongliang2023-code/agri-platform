import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};
import { Alert, Button, Card, Drawer, Form, Input, Select, Space, Tag, Typography, App } from '@/vue/ui';
import { http, errorMessageOf } from '@/utils/request';
import useFarmStore from '@/vue/farmStore';
const fields = [['rootCause', '原因分析'], ['effectiveness', '处置效果'], ['prevention', '预防措施'], ['evidence', '核验依据']];
const labels: Record<string, string> = {
  PENDING: '待复盘',
  FOLLOW_UP: '仍需跟进',
  VERIFIED: '已验证'
};
const states = [{
  value: 'ALL',
  label: '全部'
}, {
  value: 'PENDING',
  label: '待复盘'
}, {
  value: 'FOLLOW_UP',
  label: '待跟进'
}, {
  value: 'OVERDUE',
  label: '逾期跟进'
}, {
  value: 'VERIFIED',
  label: '已验证'
}];
const api = '/alerts/reviews';
const AlertReviewPanel = defineComponent({
  name: "AlertReviewPanel",
  props: {
    open: null as unknown as PropType<{
      open: boolean;
      alertId?: string;
      onClose: () => void;
    }["open"]>,
    alertId: null as unknown as PropType<{
      open: boolean;
      alertId?: string;
      onClose: () => void;
    }["alertId"]>,
    onClose: null as unknown as PropType<{
      open: boolean;
      alertId?: string;
      onClose: () => void;
    }["onClose"]>
  },
  setup(__props: {
    open: boolean;
    alertId?: string;
    onClose: () => void;
  }, {
    slots: __slots
  }) {
    const farmId = useFarmStore(s => s.currentFarm?.farmId),
      {
        message
      } = App.useApp(),
      [form] = Form.useForm();
    const code = shallowRef(__props.alertId || ''),
      filter = shallowRef('ALL'),
      list = shallowRef<any[]>([]),
      summary = shallowRef<any>({}),
      total = shallowRef(0),
      page = shallowRef(1),
      detail = shallowRef<any>(),
      loading = shallowRef(false),
      saving = shallowRef(false),
      error = shallowRef('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const setDetail = (next: typeof detail.value | ((previous: typeof detail.value) => typeof detail.value)) => {
      detail.value = typeof next === 'function' ? (next as (previous: typeof detail.value) => typeof detail.value)(detail.value) : next;
    };
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const setTotal = (next: typeof total.value | ((previous: typeof total.value) => typeof total.value)) => {
      total.value = typeof next === 'function' ? (next as (previous: typeof total.value) => typeof total.value)(total.value) : next;
    };
    const setSummary = (next: typeof summary.value | ((previous: typeof summary.value) => typeof summary.value)) => {
      summary.value = typeof next === 'function' ? (next as (previous: typeof summary.value) => typeof summary.value)(summary.value) : next;
    };
    const setList = (next: typeof list.value | ((previous: typeof list.value) => typeof list.value)) => {
      list.value = typeof next === 'function' ? (next as (previous: typeof list.value) => typeof list.value)(list.value) : next;
    };
    const setFilter = (next: typeof filter.value | ((previous: typeof filter.value) => typeof filter.value)) => {
      filter.value = typeof next === 'function' ? (next as (previous: typeof filter.value) => typeof filter.value)(filter.value) : next;
    };
    const setCode = (next: typeof code.value | ((previous: typeof code.value) => typeof code.value)) => {
      code.value = typeof next === 'function' ? (next as (previous: typeof code.value) => typeof code.value)(code.value) : next;
    };
    const version = shallowRef(0),
      lock = shallowRef(false),
      requestId = shallowRef(''),
      expected = shallowRef(0);
    const state = Form.useWatch('reviewStatus', form);
    function fill(result: any) {
      const h = result.history?.[0] || {};
      expected.value = Number(h.revision || 0);
      requestId.value = 'review-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      form.resetFields();
      form.setFieldsValue({
        reviewStatus: 'FOLLOW_UP',
        ...h
      });
    }
    async function load(id = code.value, p = 1) {
      const v = ++version.value;
      setLoading(true);
      setError('');
      setDetail(undefined);
      try {
        if (id) {
          const data = await http.get<any>(api + '/' + encodeURIComponent(id));
          if (v !== version.value) return;
          setDetail(data);
          fill(data);
        } else {
          const data = await http.get<any>(api, {
            farmId: farmId.value,
            status: filter.value,
            pageNum: p,
            pageSize: 20
          });
          if (v !== version.value) return;
          setList(data.list);
          setSummary(data.summary);
          setTotal(data.total);
          setPage(p);
        }
      } catch (e) {
        if (v === version.value) setError(errorMessageOf(e));
      } finally {
        if (v === version.value) setLoading(false);
      }
    }
    onMounted(() => {
      watch(() => [__props.open, __props.alertId, farmId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (__props.open) {
            setCode(__props.alertId || '');
            setList([]);
            setSummary({});
            void load(__props.alertId || '');
          }
          return () => {
            version.value++;
          };
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [filter.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (__props.open && !code.value) void load('', 1);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    async function save() {
      if (lock.value) return;
      let values: any;
      try {
        values = await form.validateFields();
      } catch {
        return;
      }
      lock.value = true;
      setSaving(true);
      setError('');
      const v = version.value,
        id = code.value,
        token = requestId.value;
      try {
        await http.post(api + '/' + encodeURIComponent(id), {
          ...values,
          expectedRevision: expected.value,
          requestId: token
        });
        if (v !== version.value) return;
        const data = await http.get<any>(api + '/' + encodeURIComponent(id));
        if (v !== version.value) return;
        if (!data.history?.some((h: any) => h.requestId === token)) throw new Error('已提交但回读未核实，请重新加载，勿重复提交');
        setDetail(data);
        fill(data);
        message.success('复盘已保存');
      } catch (e) {
        if (v === version.value) setError(errorMessageOf(e));
      } finally {
        lock.value = false;
        setSaving(false);
      }
    }
    return () => {
      const _detailSnapshot = detail.value;
      return <Drawer title="告警复盘" width={700} open={__props.open} onClose={() => {
        if (!lock.value) __props.onClose();
      }} closable={!saving.value} maskClosable={!saving.value} keyboard={!saving.value} destroyOnClose>
 <Alert type="info" showIcon message="复盘记录原因、效果和预防措施，不修改原告警状态；跟进约定不会自动派发任务。" />
 {error.value && <Alert type="error" message={error.value} action={<Button disabled={saving.value} onClick={() => void load()}>重新加载</Button>} />}
 {!code.value ? <Space direction="vertical" style={{
          width: '100%',
          marginTop: 16
        }}><Space wrap>{[['pending', '待复盘'], ['followUp', '待跟进'], ['overdue', '逾期'], ['verified', '已验证']].map(([k, l]) => <Tag key={k}>{l}：{summary.value[k] ?? '—'}</Tag>)}</Space><Select value={filter.value} options={states} disabled={loading.value} onChange={setFilter} style={{
            width: 180
          }} />{list.value.map(row => <Card key={row.alertId} size="small" title={row.alertTitle} extra={<Button onClick={() => {
            setCode(row.alertId);
            void load(row.alertId);
          }}>复盘</Button>}><Tag>{labels[row.reviewStatus]}</Tag><Typography.Text>{row.alertId}</Typography.Text>{row.followUpDate && <p>跟进：{row.followUpOwner} · {row.followUpDate}</p>}</Card>)}{!loading.value && !error.value && !list.value.length && <p>暂无符合条件的已结束告警</p>}<Space><Button disabled={loading.value || page.value <= 1} onClick={() => void load('', page.value - 1)}>上一页</Button><span>第 {page.value} 页 / 共 {total.value} 条</span><Button disabled={loading.value || page.value * 20 >= total.value} onClick={() => void load('', page.value + 1)}>下一页</Button></Space></Space> : <><Button disabled={saving.value} style={{
            margin: '16px 0'
          }} onClick={() => {
            setCode('');
            void load('');
          }}>返回复盘清单</Button>{_detailSnapshot && <><Card size="small" title={_detailSnapshot.alert.alertTitle}><p>{code.value}</p><p>{_detailSnapshot.alert.alertContent}</p><Typography.Paragraph style={{
                whiteSpace: 'pre-wrap'
              }}>处置记录：{_detailSnapshot.alert.handleRemark || '暂无处置说明'}</Typography.Paragraph></Card>{_detailSnapshot.eligible ? <Card title={`追加复盘 · 当前 V${expected.value}`} style={{
              marginTop: 16
            }}><Form form={form} layout="vertical" disabled={saving.value} onFinish={() => void save()}>{fields.map(([key, label]) => <Form.Item key={key} name={key} label={label} rules={[{
                  required: true,
                  whitespace: true,
                  message: '请填写' + label
                }, {
                  max: 1000
                }]}><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item>)}<Form.Item name="reviewStatus" label="复盘结论" rules={[{
                  required: true
                }]}><Select options={[{
                    value: 'FOLLOW_UP',
                    label: '仍需跟进'
                  }, {
                    value: 'VERIFIED',
                    label: '已验证'
                  }]} /></Form.Item>{state.value === 'FOLLOW_UP' && <><Form.Item name="followUpOwner" label="跟进责任人" rules={[{
                    required: true,
                    whitespace: true
                  }, {
                    max: 100
                  }]}><Input maxLength={100} /></Form.Item><Form.Item name="followUpDate" label="跟进日期" rules={[{
                    required: true
                  }]}><Input type="date" /></Form.Item></>}<Button htmlType="submit" type="primary" loading={saving.value} disabled={loading.value}>保存复盘并回读</Button></Form></Card> : <p>请先完成告警处置或忽略。</p>}<Typography.Title level={5}>历史版本</Typography.Title>{_detailSnapshot.history.map((h: any) => <Card key={h.revision} size="small" style={{
              marginBottom: 12
            }} title={`V${h.revision} · ${labels[h.reviewStatus]}`}><p>复盘人 ID：{h.reviewerId} · {h.reviewedAt}</p>{fields.map(([k, l]) => <Typography.Paragraph key={k} style={{
                whiteSpace: 'pre-wrap'
              }}><b>{l}：</b>{h[k]}</Typography.Paragraph>)}{h.followUpDate && <p>跟进：{h.followUpOwner} · {h.followUpDate}</p>}</Card>)}</>}</>}{loading.value && <p>正在加载…</p>}
 </Drawer>;
    };
  }
});
export default AlertReviewPanel;
