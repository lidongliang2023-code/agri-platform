import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { useQuery } from '@/vue/query';
import { Alert, Button, DatePicker, Descriptions, Drawer, Input } from '@/vue/ui';
import { useNavigate } from '@/vue/router';
import type { ProColumns } from '@/vue/pro';
import Table from '@/vue/ProductionRequestTable';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { monitorInputs } from '@/api/admin/monitor-workbench';
import type { UsageRow } from '@/api/admin/monitor-workbench';
import { Card, FarmFilter, MonitorPage, QueryError } from './MonitorShared';
const InputMonitor = defineComponent({
  name: "InputMonitor",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const farm = shallowRef<string>(),
      keyword = shallowRef(''),
      dates = shallowRef<[string, string]>(),
      page = shallowRef(1),
      size = shallowRef(20),
      active = shallowRef<UsageRow>();
    const setActive = (next: typeof active.value | ((previous: typeof active.value) => typeof active.value)) => {
      active.value = typeof next === 'function' ? (next as (previous: typeof active.value) => typeof active.value)(active.value) : next;
    };
    const setSize = (next: typeof size.value | ((previous: typeof size.value) => typeof size.value)) => {
      size.value = typeof next === 'function' ? (next as (previous: typeof size.value) => typeof size.value)(size.value) : next;
    };
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const setDates = (next: typeof dates.value | ((previous: typeof dates.value) => typeof dates.value)) => {
      dates.value = typeof next === 'function' ? (next as (previous: typeof dates.value) => typeof dates.value)(dates.value) : next;
    };
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const setFarm = (next: typeof farm.value | ((previous: typeof farm.value) => typeof farm.value)) => {
      farm.value = typeof next === 'function' ? (next as (previous: typeof farm.value) => typeof farm.value)(farm.value) : next;
    };
    const q = useQuery(() => ({
      queryKey: ['admin-monitor-inputs', page.value, size.value, farm.value, keyword.value, dates.value],
      queryFn: () => monitorInputs({
        pageNum: page.value,
        pageSize: size.value,
        farmId: farm.value,
        keyword: keyword.value,
        startDate: dates.value?.[0],
        endDate: dates.value?.[1]
      }),
      retry: false
    }));
    const columns = computed<ProColumns<UsageRow>[]>(() => [{
      title: '使用记录',
      width: 130,
      render: (_, r) => String(r.usage.usageId)
    }, {
      title: '投入品名称',
      width: 200,
      render: (_, r) => <Button type="link" onClick={() => setActive(r)}>{r.usage.inputName}</Button>
    }, {
      title: '所属农场',
      dataIndex: 'farmName',
      width: 180
    }, {
      title: '地块',
      dataIndex: 'plotName',
      width: 170
    }, {
      title: '使用量',
      width: 130,
      render: (_, r) => `${r.usage.dosage ?? '—'} ${r.usage.unit || ''}`
    }, {
      title: '施用方式',
      width: 120,
      render: (_, r) => r.usage.method || '—'
    }, {
      title: '使用时间',
      width: 175,
      render: (_, r) => r.usage.usedAt || '—'
    }, {
      title: '安全间隔',
      width: 110,
      render: (_, r) => r.usage.safetyIntervalDays == null ? '未登记' : `${r.usage.safetyIntervalDays} 天`
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 170,
      render: (_, r) => <ListRowActions items={[<Button key="detail" type="link" size="small" onClick={() => setActive(r)}>详情</Button>, <Button key="check" type="link" size="small" disabled={!r.usage.farmId} onClick={() => navigate(`/admin/production/farms/compliance?farmId=${r.usage.farmId}`)}>检查整改</Button>]} />
    }]);
    return () => {
      return <MonitorPage title="投入品使用监控" subTitle="与用户端投入品使用记录同源，检查整改共用农场监管闭环"><Alert type="info" showIcon message="按实际登记用量与单位展示。发现异常后进入检查整改，由经营主体提交整改、运营复核。" /><QueryError error={q.error} /><Card class="production-dense-filter-card"><div class="production-filter-grid">
  <div class="production-filter-field"><label>投入品名称</label><Input value={keyword.value} allowClear placeholder="请输入投入品名称" onChange={e => {
                setKeyword(e.target.value);
                setPage(1);
              }} /></div>
  <div class="production-filter-field"><label>所属农场</label><FarmFilter value={farm.value} onChange={v => {
                setFarm(v);
                setPage(1);
              }} /></div>
  <div class="production-filter-field"><label>使用日期</label><DatePicker.RangePicker key={dates.value?.join() || 'empty'} onChange={(_, v) => {
                setDates(v[0] && v[1] ? [v[0], v[1]] : undefined);
                setPage(1);
              }} /></div>
  <div class="production-filter-actions"><Button onClick={() => {
                setKeyword('');
                setFarm(undefined);
                setDates(undefined);
                setPage(1);
              }}>重置</Button><Button type="primary" loading={q.isFetching} onClick={() => {
                setPage(1);
                void q.refetch();
              }}>查询</Button></div>
 </div></Card><Card><Table rowKey={r => String(r.usage.usageId)} memberListToolbar rowSelection={{}} cardProps={false} headerTitle="投入品使用台账" columns={columns.value} dataSource={q.data?.list ?? []} loading={q.isFetching} search={false} options={{
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
          }} /></Card><Drawer title="投入品使用详情" width={640} open={!!active.value} onClose={() => setActive(undefined)}>{active.value && <Descriptions bordered size="small" column={2} items={[{
            key: 'input',
            label: '投入品',
            children: active.value.usage.inputName,
            span: 2
          }, {
            key: 'farm',
            label: '农场',
            children: active.value.farmName || '—'
          }, {
            key: 'plot',
            label: '地块',
            children: active.value.plotName || '—'
          }, {
            key: 'dose',
            label: '使用量',
            children: `${active.value.usage.dosage} ${active.value.usage.unit || ''}`
          }, {
            key: 'time',
            label: '使用时间',
            children: active.value.usage.usedAt || '—'
          }, {
            key: 'task',
            label: '关联任务',
            children: active.value.usage.taskId ? String(active.value.usage.taskId) : '未关联'
          }, {
            key: 'method',
            label: '施用方式',
            children: active.value.usage.method || '—'
          }, {
            key: 'remark',
            label: '备注',
            children: active.value.usage.remark || '—',
            span: 2
          }]} />}</Drawer></MonitorPage>;
    };
  }
});
export default InputMonitor;
