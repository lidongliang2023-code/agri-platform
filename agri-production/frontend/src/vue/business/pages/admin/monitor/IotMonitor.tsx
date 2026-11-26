import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import '@/components/ProductionListDense.css';
import { useQuery } from '@/vue/query';
import { Button, Descriptions, Drawer, Input, Select, Tag } from '@/vue/ui';
import type { ProColumns } from '@/vue/pro';
import type { IotDevice as SharedIotDevice } from '@/types';
import { monitorDevices } from '@/api/admin/monitor-workbench';
import Table from '@/vue/ProductionRequestTable';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { Card, FarmFilter, iotOpsUrl, MonitorPage, QueryError } from './MonitorShared';
type IotDevice = SharedIotDevice & {
  plotName?: string;
};
const types: Record<number, string> = {
  1: '传感器',
  2: '摄像头',
  3: '控制器',
  4: '气象站',
  5: '无人机'
};
const IotMonitor = defineComponent({
  name: "IotMonitor",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const farm = shallowRef<string>(),
      keyword = shallowRef(''),
      status = shallowRef<string>(),
      type = shallowRef<string>(),
      page = shallowRef(1),
      size = shallowRef(20),
      active = shallowRef<IotDevice>();
    const setActive = (next: typeof active.value | ((previous: typeof active.value) => typeof active.value)) => {
      active.value = typeof next === 'function' ? (next as (previous: typeof active.value) => typeof active.value)(active.value) : next;
    };
    const setSize = (next: typeof size.value | ((previous: typeof size.value) => typeof size.value)) => {
      size.value = typeof next === 'function' ? (next as (previous: typeof size.value) => typeof size.value)(size.value) : next;
    };
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const setType = (next: typeof type.value | ((previous: typeof type.value) => typeof type.value)) => {
      type.value = typeof next === 'function' ? (next as (previous: typeof type.value) => typeof type.value)(type.value) : next;
    };
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const setFarm = (next: typeof farm.value | ((previous: typeof farm.value) => typeof farm.value)) => {
      farm.value = typeof next === 'function' ? (next as (previous: typeof farm.value) => typeof farm.value)(farm.value) : next;
    };
    const q = useQuery(() => ({
      queryKey: ['admin-monitor-devices', page.value, size.value, farm.value, keyword.value, status.value, type.value],
      queryFn: () => monitorDevices({
        pageNum: page.value,
        pageSize: size.value,
        farmId: farm.value,
        keyword: keyword.value,
        status: status.value,
        deviceType: type.value
      }),
      retry: false
    }));
    const columns = computed<ProColumns<IotDevice>[]>(() => [{
      title: '设备名称',
      dataIndex: 'deviceName',
      width: 200,
      ellipsis: true,
      render: (_, r) => <Button type="link" class="production-dense-cell-link" title={r.deviceName} onClick={() => setActive(r)}>{r.deviceName}</Button>
    }, {
      title: '设备编号',
      dataIndex: 'deviceCode',
      width: 170,
      ellipsis: true
    }, {
      title: '类型',
      dataIndex: 'deviceType',
      width: 96,
      ellipsis: true,
      render: (_, r) => types[r.deviceType] || '其他'
    }, {
      title: '所属农场',
      width: 170,
      ellipsis: true,
      render: (_, r) => {
        const v = String(r.farmName || r.farmId || '未绑定');
        return <span class="production-dense-link-ellipsis" title={v}>{v}</span>;
      }
    }, {
      title: '关联地块',
      width: 170,
      ellipsis: true,
      render: (_, r) => {
        const v = String(r.plotName || r.plotId || '未绑定');
        return <span class="production-dense-link-ellipsis" title={v}>{v}</span>;
      }
    }, {
      title: '在线状态',
      width: 100,
      render: (_, r) => <Tag color={r.onlineStatus === 1 ? 'green' : r.onlineStatus === 3 ? 'red' : 'default'}>{r.onlineStatus === 1 ? '在线' : r.onlineStatus === 3 ? '故障' : '离线'}</Tag>
    }, {
      title: '电量',
      width: 92,
      ellipsis: true,
      render: (_, r) => r.battery == null ? '未上报' : `${r.battery}%`
    }, {
      title: '信号',
      width: 104,
      ellipsis: true,
      render: (_, r) => r.signal == null ? '未上报' : `${r.signal} dBm`
    }, {
      title: '最后心跳',
      dataIndex: 'lastHeartbeatAt',
      width: 168,
      ellipsis: true
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 150,
      render: (_, r) => <ListRowActions items={[<Button key="detail" type="link" size="small" onClick={() => setActive(r)}>详情</Button>, <Button key="iot" type="link" size="small" href={iotOpsUrl("devices")}>设备管理</Button>]} />
    }]);
    return () => {
      return <MonitorPage class="production-list-dense" title="IoT 设备监控" subTitle="设备台账、在线状态统一来自物联网系统（注册、指令、维修与固件由物联网模块管理）" extra={<Button href={iotOpsUrl("workorders")}>物联网运维</Button>}>
  <QueryError error={q.error} />
  <Card class="production-dense-filter-card">
   <div class="production-filter-grid">
    <div class="production-filter-field"><label>设备名称 / 编号</label><Input value={keyword.value} allowClear placeholder="请输入设备名称或编号" onChange={e => {
                setKeyword(e.target.value);
                setPage(1);
              }} /></div>
    <div class="production-filter-field"><label>所属农场</label><FarmFilter value={farm.value} onChange={v => {
                setFarm(v);
                setPage(1);
              }} /></div>
    <div class="production-filter-field"><label>设备类型</label><Select allowClear value={type.value} placeholder="全部" options={Object.entries(types).map(([value, label]) => ({
                value,
                label
              }))} onChange={v => {
                setType(v);
                setPage(1);
              }} /></div>
    <div class="production-filter-field"><label>在线状态</label><Select allowClear value={status.value} placeholder="全部" options={[{
                value: '1',
                label: '在线'
              }, {
                value: '2',
                label: '离线'
              }, {
                value: '3',
                label: '故障'
              }, {
                value: 'low',
                label: '低电量（≤20%）'
              }]} onChange={v => {
                setStatus(v);
                setPage(1);
              }} /></div>
    <div class="production-filter-actions">
     <Button onClick={() => {
                setFarm(undefined);
                setKeyword('');
                setType(undefined);
                setStatus(undefined);
                setPage(1);
              }}>重置</Button>
     <Button type="primary" loading={q.isFetching} onClick={() => {
                setPage(1);
                void q.refetch();
              }}>查询</Button>
    </div>
   </div>
  </Card>
  <Card>
   <Table rowKey="deviceId" memberListToolbar rowSelection={{}} cardProps={false} headerTitle={<div class="production-dense-card-title"><span class="production-dense-summary-inline"><span class="production-dense-metric"><span class="production-dense-metric-label">筛选范围设备</span><span class="production-dense-metric-value">{q.data?.total ?? '—'}</span></span><span class="production-dense-metric"><span class="production-dense-metric-label">在线</span><span class="production-dense-metric-value is-success">{q.data?.online ?? '—'}</span></span><span class="production-dense-metric"><span class="production-dense-metric-label">离线</span><span class="production-dense-metric-value">{q.data?.offline ?? '—'}</span></span><span class="production-dense-metric"><span class="production-dense-metric-label">故障</span><span class="production-dense-metric-value is-danger">{q.data?.fault ?? '—'}</span></span></span></div>} columns={columns.value} dataSource={q.data?.list ?? []} loading={q.isFetching} search={false} options={{
            reload: () => void q.refetch()
          }} pagination={{
            current: page.value,
            pageSize: size.value,
            total: q.data?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, s) => {
              setPage(s === size.value ? p : 1);
              setSize(s);
            }
          }} />
  </Card>
  <Drawer title="设备监控详情" width={640} open={!!active.value} onClose={() => setActive(undefined)}>{active.value && <Descriptions bordered size="small" column={2} items={[{
            key: 'name',
            label: '设备名称',
            children: active.value.deviceName,
            span: 2
          }, {
            key: 'code',
            label: '设备编号',
            children: active.value.deviceCode
          }, {
            key: 'type',
            label: '类型',
            children: types[active.value.deviceType]
          }, {
            key: 'farm',
            label: '所属农场',
            children: active.value.farmName || active.value.farmId || '未绑定'
          }, {
            key: 'plot',
            label: '关联地块',
            children: active.value.plotName || active.value.plotId || '未绑定'
          }, {
            key: 'heart',
            label: '最后心跳',
            children: active.value.lastHeartbeatAt || '未上报',
            span: 2
          }]} />}<Button style={{
            marginTop: 16
          }} href={iotOpsUrl("devices")}>前往物联网设备管理</Button></Drawer>
 </MonitorPage>;
    };
  }
});
export default IotMonitor;
