import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { useQuery, useMutation, useQueryClient } from '@/vue/query';
import { App, Button, DatePicker, Descriptions, Drawer, Input, Popconfirm, Select, Tag } from '@/vue/ui';
import type { ProColumns } from '@/vue/pro';
import { useNavigate, useSearchParams } from '@/vue/router';
import Table from '@/vue/ProductionRequestTable';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { CollapsibleFilterDiv } from '@/vue/business/components/CollapsibleFilterGrid';
import { monitorTasks } from '@/api/admin/monitor-workbench';
import type { TaskRow } from '@/api/admin/monitor-workbench';
import { urgeTask } from '@/api/admin/monitor';
import { TASK_TYPE_LABEL_MAP } from '@/types';
import { Card, displayTime, FarmFilter, MonitorPage, QueryError, isFinal, statusNames } from './MonitorShared';
const TaskMonitor = defineComponent({
  name: "TaskMonitor",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const qc = useQueryClient();
    const {
      message
    } = App.useApp();
    const farm = shallowRef<string | undefined>(params.value.get('farmId') || undefined),
      keyword = shallowRef(''),
      status = shallowRef<string>(),
      type = shallowRef<string>(),
      dates = shallowRef<[string, string] | undefined>(),
      page = shallowRef(1),
      size = shallowRef(20),
      active = shallowRef<string>();
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
      queryKey: ['admin-monitor-tasks', page.value, size.value, farm.value, keyword.value, status.value, type.value, dates.value],
      queryFn: () => monitorTasks({
        pageNum: page.value,
        pageSize: size.value,
        farmId: farm.value,
        keyword: keyword.value,
        status: status.value,
        taskType: type.value,
        startDate: dates.value?.[0],
        endDate: dates.value?.[1]
      }),
      retry: false
    }));
    const row = computed(() => q.data?.list.find(r => String(r.task.id) === active.value));
    const urge = useMutation(() => ({
      mutationFn: urgeTask,
      onSuccess: () => {
        message.success('催办记录已保存');
        void qc.invalidateQueries({
          queryKey: ['admin-monitor-tasks']
        });
      },
      onError: (e: Error) => message.error(e.message)
    }));
    const columns = computed<ProColumns<TaskRow>[]>(() => [{
      title: '任务名称',
      width: 240,
      render: (_, r) => <Button type="link" onClick={() => setActive(String(r.task.id))}>{r.task.taskName}</Button>
    }, {
      title: '任务编号',
      width: 170,
      render: (_, r) => r.task.taskCode
    }, {
      title: '农场 / 地块',
      width: 220,
      render: (_, r) => [r.farmName, r.plotName].filter(Boolean).join(' / ') || '未登记'
    }, {
      title: '任务类型',
      width: 110,
      render: (_, r) => TASK_TYPE_LABEL_MAP[r.task.taskType] || r.task.taskType
    }, {
      title: '执行人',
      width: 120,
      render: (_, r) => r.task.executorName || '未指派'
    }, {
      title: '状态',
      width: 115,
      render: (_, r) => <Tag color={isFinal(r.task.status) ? 'default' : 'blue'}>{statusNames[r.task.status] || r.task.status}</Tag>
    }, {
      title: '计划完成',
      width: 165,
      render: (_, r) => displayTime(r.task.planEndTime)
    }, {
      title: '催办次数',
      width: 100,
      render: (_, r) => r.task.urgeCount ?? 0
    }, {
      title: '最近催办',
      width: 165,
      render: (_, r) => displayTime(r.task.lastUrgeTime)
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, r) => <ListRowActions items={[<Button key="detail" type="link" size="small" onClick={() => setActive(String(r.task.id))}>详情</Button>, !isFinal(r.task.status) && <Popconfirm key="urge" title="记录本次任务催办？" description="仅登记督办记录，不变更执行或验收结果。" onConfirm={() => urge.mutateAsync(String(r.task.id))}><Button type="link" size="small" loading={urge.isPending}>催办</Button></Popconfirm>, r.task.farmId && <Button key="farm" type="link" size="small" onClick={() => navigate(`/admin/production/farms/${r.task.farmId}`)}>农场</Button>]} />
    }]);
    return () => {
      return <MonitorPage title="任务执行监控" subTitle="与用户端共用任务台账；运营负责督办，执行与验收由经营主体完成"><QueryError error={q.error} /><Card class="production-dense-filter-card"><CollapsibleFilterDiv fieldCount={5} class="production-filter-grid">{({
              toggleButton
            }: {
              toggleButton: VNodeChild;
            }) => <>
  <div class="production-filter-field"><label>任务名称 / 编号</label><Input placeholder="请输入任务名称或编号" allowClear value={keyword.value} onChange={e => {
                  setKeyword(e.target.value);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>所属农场</label><FarmFilter value={farm.value} onChange={v => {
                  setFarm(v);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>任务状态</label><Select allowClear placeholder="全部" value={status.value} options={['pending', 'assigned', 'executing', 'completed', 'suspended', 'cancelled', 'expired', 'rejected', 'overdue'].map(v => ({
                  value: v,
                  label: statusNames[v]
                }))} onChange={v => {
                  setStatus(v);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>任务类型</label><Select allowClear placeholder="全部" value={type.value} options={Object.entries(TASK_TYPE_LABEL_MAP).map(([value, label]) => ({
                  value,
                  label
                }))} onChange={v => {
                  setType(v);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>计划周期</label><DatePicker.RangePicker key={dates.value?.join() || 'empty'} onChange={(_, v) => {
                  setDates(v[0] && v[1] ? [v[0], v[1]] : undefined);
                  setPage(1);
                }} /></div>
  <div class="production-filter-actions"><Button onClick={() => {
                  setKeyword('');
                  setFarm(undefined);
                  setStatus(undefined);
                  setType(undefined);
                  setDates(undefined);
                  setPage(1);
                }}>重置</Button><Button type="primary" loading={q.isFetching} onClick={() => {
                  setPage(1);
                  void q.refetch();
                }}>查询</Button>{toggleButton}</div>
 </>}</CollapsibleFilterDiv></Card><Card><Table rowKey={r => String(r.task.id)} memberListToolbar rowSelection={{}} cardProps={false} headerTitle={<span class="production-dense-summary-note">日期按计划区间重叠筛选；催办仅登记督办记录，不代替用户执行或验收</span>} columns={columns.value} dataSource={q.data?.list ?? []} loading={q.isFetching} search={false} options={{
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
          }} /></Card><Drawer title="任务监管详情" width={720} open={!!active.value} onClose={() => setActive(undefined)}>{row.value && <Descriptions size="small" bordered column={2} items={[{
            key: 'name',
            label: '任务名称',
            children: row.value.task.taskName,
            span: 2
          }, {
            key: 'code',
            label: '任务编号',
            children: row.value.task.taskCode
          }, {
            key: 'state',
            label: '状态',
            children: statusNames[row.value.task.status] || row.value.task.status
          }, {
            key: 'farm',
            label: '农场',
            children: row.value.farmName || '—'
          }, {
            key: 'plot',
            label: '地块',
            children: row.value.plotName || '—'
          }, {
            key: 'owner',
            label: '执行人',
            children: row.value.task.executorName || '—'
          }, {
            key: 'start',
            label: '计划开始',
            children: displayTime(row.value.task.planStartTime)
          }, {
            key: 'end',
            label: '计划完成',
            children: displayTime(row.value.task.planEndTime)
          }, {
            key: 'count',
            label: '催办次数',
            children: row.value.task.urgeCount ?? 0
          }, {
            key: 'last',
            label: '最近催办',
            children: displayTime(row.value.task.lastUrgeTime)
          }, {
            key: 'by',
            label: '催办人',
            children: row.value.task.lastUrgeBy || '—'
          }, {
            key: 'desc',
            label: '作业内容',
            children: row.value.task.taskDesc || '—',
            span: 2
          }, {
            key: 'result',
            label: '执行成果',
            children: row.value.task.resultDesc || '—',
            span: 2
          }]} />}</Drawer></MonitorPage>;
    };
  }
});
export default TaskMonitor;
