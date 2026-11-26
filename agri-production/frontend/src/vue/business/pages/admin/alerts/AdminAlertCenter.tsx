import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Alert as Notice, App, Button, Drawer, Form, Input, Modal, Select, Space, Tag } from '@/vue/ui';
import { useQuery, useQueryClient } from '@/vue/query';
import { useNavigate, useSearchParams } from '@/vue/router';
import type { ProColumns } from '@/vue/pro';
import { closeAlert, getAdminAlert, listAdminAlerts } from '@/api/admin/alerts';
import type { Alert } from '@/types';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import '@/components/ProductionDetailCompact.css';
import Table from '@/vue/ProductionRequestTable';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { Card, FarmFilter, MonitorPage, QueryError, displayTime, iotOpsUrl } from '../monitor/MonitorShared';
const states: Record<number, string> = {
  1: '待处理',
  2: '处理中',
  3: '已处理',
  4: '已忽略'
};
const levels: Record<number, string> = {
  1: '提示',
  2: '一般',
  3: '重要',
  4: '紧急'
};
const sources: Record<number, string> = {
  1: '环境',
  2: '设备',
  3: '病虫害',
  4: '任务',
  5: '投入品'
};
const measures = ['联系负责人排查', '跟进检查整改', '记录物联网运维进展', '记录现场处置结果'];
function stateCode(value: string | null): number | undefined {
  if (!value) return undefined;
  const aliases: Record<string, number> = {
    pending: 1,
    unhandled: 1,
    handling: 2,
    processing: 2,
    in_progress: 2,
    handled: 3,
    closed: 3,
    ignored: 4
  };
  const n = aliases[value.toLowerCase()] ?? Number(value);
  return n >= 1 && n <= 4 ? n : undefined;
}
const actionable = (row: Alert) => row.status === 1 || row.status === 2;

/** 运营生产告警唯一办理列表，与用户端共用告警记录，不在此下发设备指令。 */
const AdminAlertCenter = defineComponent({
  name: "AdminAlertCenter",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
      message
    } = App.useApp();
    const qc = useQueryClient(),
      navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const farmId = computed(() => params.value.get('farmId') || undefined);
    const status = computed(() => stateCode(params.value.get('status')));
    const levelValue = computed(() => Number(params.value.get('alertLevel')));
    const alertLevel = computed(() => levelValue.value >= 1 && levelValue.value <= 4 ? levelValue.value : undefined);
    const page = shallowRef(1),
      size = shallowRef(20);
    const setSize = (next: typeof size.value | ((previous: typeof size.value) => typeof size.value)) => {
      size.value = typeof next === 'function' ? (next as (previous: typeof size.value) => typeof size.value)(size.value) : next;
    };
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const selected = shallowRef<(string | number)[]>([]);
    const setSelected = (next: typeof selected.value | ((previous: typeof selected.value) => typeof selected.value)) => {
      selected.value = typeof next === 'function' ? (next as (previous: typeof selected.value) => typeof selected.value)(selected.value) : next;
    };
    const detail = shallowRef<Alert>();
    const setDetail = (next: typeof detail.value | ((previous: typeof detail.value) => typeof detail.value)) => {
      detail.value = typeof next === 'function' ? (next as (previous: typeof detail.value) => typeof detail.value)(detail.value) : next;
    };
    const targets = shallowRef<Alert[]>([]);
    const setTargets = (next: typeof targets.value | ((previous: typeof targets.value) => typeof targets.value)) => {
      targets.value = typeof next === 'function' ? (next as (previous: typeof targets.value) => typeof targets.value)(targets.value) : next;
    };
    const busy = shallowRef(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const detailBusy = shallowRef(false);
    const setDetailBusy = (next: typeof detailBusy.value | ((previous: typeof detailBusy.value) => typeof detailBusy.value)) => {
      detailBusy.value = typeof next === 'function' ? (next as (previous: typeof detailBusy.value) => typeof detailBusy.value)(detailBusy.value) : next;
    };
    const form = Form.useForm<{
      measure: string;
      remark: string;
    }>();
    const query = useQuery(() => ({
      queryKey: ['admin-alerts-center', farmId.value, status.value, alertLevel.value, page.value, size.value],
      queryFn: () => listAdminAlerts({
        pageNum: page.value,
        pageSize: size.value,
        farmId: farmId.value,
        status: status.value,
        alertLevel: alertLevel.value
      }),
      retry: false
    }));
    const rows = computed(() => query.data?.list ?? []);
    onMounted(() => {
      watch(() => [farmId.value, status.value, alertLevel.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setPage(1);
          setSelected([]);
          setDetail(undefined);
          setTargets([]);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [query.data], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setSelected([]);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const filter = (key: string, value?: string | number) => {
      const next = new URLSearchParams(params.value);
      if (value == null || value === '') next.delete(key);else next.set(key, String(value));
      setParams(next, {
        replace: true
      });
      setPage(1);
    };
    const refresh = async () => {
      await Promise.all([qc.invalidateQueries({
        queryKey: ['admin-alerts-center']
      }), qc.invalidateQueries({
        queryKey: ['admin-monitor-alerts']
      }), qc.invalidateQueries({
        queryKey: ['production-alerts']
      }), qc.invalidateQueries({
        queryKey: ['production-alerts-stats']
      }), qc.invalidateQueries({
        queryKey: ['production-alert-detail']
      })]);
    };
    const openDetail = async (row: Alert) => {
      setDetailBusy(true);
      try {
        setDetail(await getAdminAlert(row.alertId));
      } catch (e) {
        message.error(e instanceof Error ? e.message : '详情读取失败');
      } finally {
        setDetailBusy(false);
      }
    };
    const openHandle = (items: Alert[]) => {
      form.resetFields();
      setTargets(items.filter(actionable));
    };
    const submit = async () => {
      if (busy.value || !targets.value.length) return;
      let values: {
        measure: string;
        remark: string;
      };
      try {
        values = await form.validateFields();
      } catch {
        return;
      }
      setBusy(true);
      try {
        const result = await Promise.allSettled(targets.value.map(row => closeAlert(row.alertId, `${values.measure}：${values.remark.trim()}`)));
        await refresh();
        const failed = targets.value.filter((_, index) => result[index].status === 'rejected');
        setDetail(undefined);
        if (failed.length) {
          setTargets(failed);
          message.error(`已保存 ${targets.value.length - failed.length} 条，失败 ${failed.length} 条；仅保留失败项，请核对后重试`);
        } else {
          setTargets([]);
          message.success('处置进展已保存：待处理进入处理中，处理中进入已处理');
        }
      } catch (e) {
        message.error(e instanceof Error ? e.message : '保存失败，请刷新核验');
      } finally {
        setBusy(false);
      }
    };
    const columns = computed<ProColumns<Alert>[]>(() => [{
      title: '告警事项',
      dataIndex: 'alertTitle',
      width: 240,
      render: (_, row) => <Button type="link" loading={detailBusy.value} onClick={() => void openDetail(row)}>{row.alertTitle || row.alertId}</Button>
    }, {
      title: '告警编号',
      dataIndex: 'alertNo',
      width: 180
    }, {
      title: '农场编号',
      dataIndex: 'farmId',
      width: 150
    }, {
      title: '地块',
      dataIndex: 'plotName',
      width: 160,
      render: (_, row) => row.plotName || row.plotId || '—'
    }, {
      title: '来源',
      width: 95,
      render: (_, row) => sources[row.alertSource] || '未分类'
    }, {
      title: '级别',
      width: 90,
      render: (_, row) => <Tag color={row.alertLevel === 4 ? 'red' : row.alertLevel === 3 ? 'orange' : 'default'}>{levels[row.alertLevel] || '未分级'}</Tag>
    }, {
      title: '状态',
      width: 95,
      render: (_, row) => <Tag color={actionable(row) ? 'orange' : 'default'}>{states[row.status] || '未知状态'}</Tag>
    }, {
      title: '触发时间',
      width: 175,
      render: (_, row) => displayTime(row.triggeredAt)
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, row) => <ListRowActions items={[<Button key="detail" type="link" size="small" onClick={() => void openDetail(row)}>详情</Button>, <Button key="handle" type="link" size="small" disabled={!actionable(row) || busy.value} onClick={() => openHandle([row])}>{row.status === 2 ? '完成处置' : '介入'}</Button>, <Button key="check" type="link" size="small" disabled={!row.farmId} onClick={() => navigate(`/admin/production/farms/compliance?farmId=${encodeURIComponent(row.farmId!)}`)}>检查整改</Button>]} />
    }]);
    return () => {
      return <MonitorPage title="生产告警处置与复盘" subTitle="统一生产告警台账、处置进展与历史复盘" extra={<Space wrap>
    <Button onClick={() => navigate('/admin/production/monitor/tasks')}>任务监控</Button>
    <Button onClick={() => navigate('/admin/production/monitor/environment')}>环境数据</Button>
    <Button onClick={() => window.location.assign(iotOpsUrl('workorders'))}>物联网运维</Button>
    <Button onClick={() => navigate('/admin/production/alerts/emergency')}>应急预案</Button>
  </Space>}>
    <Notice showIcon type="info" message="与用户端共用生产告警；此处记录处置进展。设备指令和维修在物联网办理，农场问题进入检查整改；已处理和已忽略记录只读。" />
    <QueryError error={query.error} />
    <Card class="production-dense-filter-card">
      <div class="production-filter-grid">
        <div class="production-filter-field"><label>所属农场</label><FarmFilter value={farmId.value} onChange={value => filter('farmId', value)} /></div>
        <div class="production-filter-field"><label>告警状态</label><Select allowClear aria-label="告警状态" value={status.value} placeholder="全部" options={Object.entries(states).map(([value, label]) => ({
                value: Number(value),
                label
              }))} onChange={value => filter('status', value)} /></div>
        <div class="production-filter-field"><label>告警级别</label><Select allowClear aria-label="告警级别" value={alertLevel.value} placeholder="全部" options={Object.entries(levels).map(([value, label]) => ({
                value: Number(value),
                label
              }))} onChange={value => filter('alertLevel', value)} /></div>
        <div class="production-filter-actions">
          <Button onClick={() => {
                setParams({}, {
                  replace: true
                });
                setPage(1);
              }}>重置</Button>
          <Button type="primary" loading={query.isFetching} onClick={() => {
                setPage(1);
                void query.refetch();
              }}>查询</Button>
        </div>
      </div>
    </Card>
    <Card>
      <Table rowKey="alertId" memberListToolbar cardProps={false} columns={columns.value} dataSource={rows.value} loading={query.isFetching} search={false} columnWidthStorageKey="admin-production-alerts" options={{
            reload: () => void refresh()
          }} rowSelection={{
            selectedRowKeys: selected.value,
            onChange: setSelected,
            getCheckboxProps: row => ({
              disabled: !actionable(row) || busy.value
            })
          }} headerTitle={<Space size={8}><Button type="primary" disabled={!selected.value.length || busy.value} onClick={() => openHandle(rows.value.filter(row => selected.value.includes(row.alertId)))}>批量登记进展（{selected.value.length}）</Button><Button onClick={() => filter('status', 3)}>已处理复盘</Button></Space>} toolBarRender={() => []} pagination={{
            current: page.value,
            pageSize: size.value,
            total: query.data?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, s) => {
              setPage(s === size.value ? p : 1);
              setSize(s);
              setSelected([]);
            }
          }} />
    </Card>
    <Modal class="production-form-dialog" title="登记告警处置进展" open={!!targets.value.length} confirmLoading={busy.value} onOk={() => void submit()} onCancel={() => {
          if (!busy.value) setTargets([]);
        }} okText="保存进展">
      <Notice type="info" showIcon message={`本次处理 ${targets.value.length} 条；待处理进入处理中，处理中进入已处理。此操作不执行设备指令。`} />
      <Form form={form} layout="vertical" style={{
            marginTop: 12
          }}>
        <Form.Item name="measure" label="处理措施" rules={[{
              required: true
            }]}><Select options={measures.map(value => ({
                value,
                label: value
              }))} /></Form.Item>
        <Form.Item name="remark" label="处理说明" rules={[{
              required: true,
              whitespace: true
            }]}><Input.TextArea rows={4} maxLength={250} showCount /></Form.Item>
      </Form>
    </Modal>
    <Drawer class="production-detail-compact production-detail-dialog" title="生产告警详情" width={720} open={!!detail.value} onClose={() => setDetail(undefined)} extra={detail.value && actionable(detail.value) ? <Button type="primary" onClick={() => {
          if (detail.value) openHandle([detail.value]);
          setDetail(undefined);
        }}>登记进展</Button> : undefined}>
      {detail.value && <DetailInfoGrid items={[{
            label: '告警编号',
            value: detail.value.alertNo
          }, {
            label: '告警事项',
            value: detail.value.alertTitle
          }, {
            label: '农场编号',
            value: detail.value.farmId
          }, {
            label: '地块',
            value: detail.value.plotName || detail.value.plotId
          }, {
            label: '告警来源',
            value: sources[detail.value.alertSource] || '未分类'
          }, {
            label: '级别',
            value: levels[detail.value.alertLevel] || '未分级'
          }, {
            label: '状态',
            value: states[detail.value.status] || '未知状态'
          }, {
            label: '触发时间',
            value: displayTime(detail.value.triggeredAt)
          }, {
            label: '关联设备',
            value: detail.value.deviceId
          }, {
            label: '触发值',
            value: detail.value.triggerValue
          }, {
            label: '告警内容',
            value: detail.value.alertContent,
            fullWidth: true
          }, {
            label: '处理人',
            value: detail.value.handlerName
          }, {
            label: '处理时间',
            value: displayTime(detail.value.handledAt)
          }, {
            label: '处置记录',
            value: <span style={{
              whiteSpace: 'pre-wrap'
            }}>{detail.value.handleRemark || '尚无记录'}</span>,
            fullWidth: true
          }]} />}
    </Drawer>
  </MonitorPage>;
    };
  }
});
export default AdminAlertCenter;
