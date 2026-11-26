import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Alert, Button, DatePicker, Input, Select, Tag } from '@/vue/ui';
import { useQuery } from '@/vue/query';
import { useNavigate, useSearchParams } from '@/vue/router';
import type { ProColumns } from '@/vue/pro';
import { qualityRecords, type QualityRecord } from '@/api/admin/quality-workbench';
import { FarmFilter } from '../monitor/MonitorShared';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { CollapsibleFilterDiv } from '@/vue/business/components/CollapsibleFilterGrid';
import { Card, Table, QualityPage, LoadError, InspectionDetail, resultName, stateName } from './QualityShared';
const Inspections = defineComponent({
  name: "Inspections",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const nav = useNavigate(),
      [params] = useSearchParams();
    const keyword = shallowRef(params.value.get('batchNo') || ''),
      result = shallowRef<string>(),
      status = shallowRef<string>(),
      lab = shallowRef(''),
      farm = shallowRef<string>(),
      dates = shallowRef<string[]>(),
      page = shallowRef(1),
      size = shallowRef(20),
      active = shallowRef<string>(params.value.get('inspectionId') || '');
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
    const setFarm = (next: typeof farm.value | ((previous: typeof farm.value) => typeof farm.value)) => {
      farm.value = typeof next === 'function' ? (next as (previous: typeof farm.value) => typeof farm.value)(farm.value) : next;
    };
    const setLab = (next: typeof lab.value | ((previous: typeof lab.value) => typeof lab.value)) => {
      lab.value = typeof next === 'function' ? (next as (previous: typeof lab.value) => typeof lab.value)(lab.value) : next;
    };
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const setResult = (next: typeof result.value | ((previous: typeof result.value) => typeof result.value)) => {
      result.value = typeof next === 'function' ? (next as (previous: typeof result.value) => typeof result.value)(result.value) : next;
    };
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const query = useQuery(() => ({
      queryKey: ['quality-reports', page.value, size.value, keyword.value, result.value, status.value, lab.value, farm.value, dates.value],
      queryFn: () => qualityRecords({
        pageNum: page.value,
        pageSize: size.value,
        keyword: keyword.value,
        result: result.value,
        status: status.value,
        labName: lab.value,
        farmId: farm.value,
        startDate: dates.value?.[0],
        endDate: dates.value?.[1]
      }),
      retry: false
    }));
    const columns = computed<ProColumns<QualityRecord>[]>(() => [{
      title: '检测单号',
      width: 210,
      render: (_, r) => <Button type="link" onClick={() => setActive(r.inspection.inspectionId)}>{r.inspection.inspectionNo || r.inspection.inspectionId}</Button>
    }, {
      title: '批次号',
      width: 185,
      render: (_, r) => r.inspection.batchNo || '未关联'
    }, {
      title: '产品',
      width: 140,
      render: (_, r) => r.inspection.cropName || '—'
    }, {
      title: '农场',
      width: 180,
      dataIndex: 'farmName'
    }, {
      title: '检测机构',
      width: 200,
      render: (_, r) => r.inspection.labName || '—'
    }, {
      title: '抽样时间',
      width: 175,
      render: (_, r) => r.inspection.sampleAt || '—'
    }, {
      title: '状态',
      width: 100,
      render: (_, r) => <Tag color={r.inspection.status === 'DONE' ? 'green' : r.inspection.status === 'TESTING' ? 'blue' : 'default'}>{stateName(r.inspection.status)}</Tag>
    }, {
      title: '结论',
      width: 100,
      render: (_, r) => <Tag color={r.inspection.result === 'FAIL' ? 'red' : r.inspection.result === 'PASS' ? 'green' : 'default'}>{resultName(r.inspection.result)}</Tag>
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 155,
      render: (_, r) => <ListRowActions items={[<Button key="detail" type="link" size="small" onClick={() => setActive(r.inspection.inspectionId)}>详情</Button>, r.inspection.result === 'FAIL' && <Button key="control" type="link" size="small" danger onClick={() => nav(`/admin/production/quality/recalls?inspectionId=${r.inspection.inspectionId}`)}>处置</Button>]} />
    }]);
    return () => {
      return <QualityPage title="检测报告管理" subTitle="汇总用户端自检、送检与抽检事实，运营查阅核验并跟踪不合格批次"><Alert showIcon type="info" message="检测登记与结果出具由生产用户端维护；运营端复用同一检测台账，不另建报告或替代机构出具结论。" /><LoadError error={query.error} /><Card class="production-dense-filter-card"><CollapsibleFilterDiv fieldCount={6} class="production-filter-grid">{({
              toggleButton
            }: {
              toggleButton: VNodeChild;
            }) => <>
  <div class="production-filter-field"><label>检测单号 / 批次 / 产品</label><Input allowClear value={keyword.value} placeholder="请输入单号、批次或产品" onChange={e => {
                  setKeyword(e.target.value);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>所属农场</label><FarmFilter value={farm.value} onChange={v => {
                  setFarm(v);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>检测机构</label><Input allowClear value={lab.value} placeholder="请输入检测机构" onChange={e => {
                  setLab(e.target.value);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>检测结论</label><Select allowClear value={result.value} placeholder="全部" options={[{
                  value: 'PASS',
                  label: '合格'
                }, {
                  value: 'FAIL',
                  label: '不合格'
                }, {
                  value: 'PENDING',
                  label: '未出结论'
                }]} onChange={v => {
                  setResult(v);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>检测状态</label><Select allowClear value={status.value} placeholder="全部" options={['PENDING', 'TESTING', 'DONE'].map(value => ({
                  value,
                  label: stateName(value)
                }))} onChange={v => {
                  setStatus(v);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>抽样日期</label><DatePicker.RangePicker key={dates.value?.join() || 'none'} onChange={(_, v) => {
                  setDates(v[0] ? v : undefined);
                  setPage(1);
                }} /></div>
  <div class="production-filter-actions"><Button onClick={() => {
                  setKeyword('');
                  setResult(undefined);
                  setStatus(undefined);
                  setLab('');
                  setFarm(undefined);
                  setDates(undefined);
                  setPage(1);
                }}>重置</Button><Button type="primary" loading={query.isFetching} onClick={() => {
                  setPage(1);
                  void query.refetch();
                }}>查询</Button>{toggleButton}</div>
 </>}</CollapsibleFilterDiv></Card><Card><Table rowKey={r => r.inspection.inspectionId} memberListToolbar rowSelection={{}} cardProps={false} headerTitle="检测报告台账" columns={columns.value} dataSource={query.data?.list ?? []} loading={query.isFetching} search={false} columnWidthStorageKey="quality-reports" columnsState={{
            persistenceKey: 'quality-reports-columns',
            persistenceType: 'localStorage'
          }} options={{
            reload: () => void query.refetch()
          }} pagination={{
            current: page.value,
            pageSize: size.value,
            total: query.data?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, s) => {
              setPage(s === size.value ? p : 1);
              setSize(s);
            }
          }} /></Card><InspectionDetail id={active.value || undefined} onClose={() => setActive('')} /></QualityPage>;
    };
  }
});
export default Inspections;
