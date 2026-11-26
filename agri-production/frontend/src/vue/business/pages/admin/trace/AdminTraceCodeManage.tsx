import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Alert, Button, DatePicker, Input, Select, Tag, Typography } from '@/vue/ui';
import { useQuery } from '@/vue/query';
import { useNavigate, useSearchParams } from '@/vue/router';
import type { ProColumns } from '@/vue/pro';
import type { RawTraceCode } from '@/types';
import { fetchAdminTraceCodes } from '@/api/admin/trace';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { CollapsibleFilterDiv } from '@/vue/business/components/CollapsibleFilterGrid';
import { Card, Table, QualityPage, LoadError, codeName } from '../quality/QualityShared';
const AdminTraceCodeManage = defineComponent({
  name: "AdminTraceCodeManage",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const nav = useNavigate(),
      [params] = useSearchParams();
    const code = shallowRef(''),
      batchNo = shallowRef(params.value.get('batchNo') || ''),
      status = shallowRef<string>(),
      chain = shallowRef<'onChain' | 'unconfirmed' | 'none'>(),
      dates = shallowRef<string[]>(),
      page = shallowRef(1),
      size = shallowRef(20);
    const setSize = (next: typeof size.value | ((previous: typeof size.value) => typeof size.value)) => {
      size.value = typeof next === 'function' ? (next as (previous: typeof size.value) => typeof size.value)(size.value) : next;
    };
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const setDates = (next: typeof dates.value | ((previous: typeof dates.value) => typeof dates.value)) => {
      dates.value = typeof next === 'function' ? (next as (previous: typeof dates.value) => typeof dates.value)(dates.value) : next;
    };
    const setChain = (next: typeof chain.value | ((previous: typeof chain.value) => typeof chain.value)) => {
      chain.value = typeof next === 'function' ? (next as (previous: typeof chain.value) => typeof chain.value)(chain.value) : next;
    };
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const setBatchNo = (next: typeof batchNo.value | ((previous: typeof batchNo.value) => typeof batchNo.value)) => {
      batchNo.value = typeof next === 'function' ? (next as (previous: typeof batchNo.value) => typeof batchNo.value)(batchNo.value) : next;
    };
    const setCode = (next: typeof code.value | ((previous: typeof code.value) => typeof code.value)) => {
      code.value = typeof next === 'function' ? (next as (previous: typeof code.value) => typeof code.value)(code.value) : next;
    };
    const query = useQuery(() => ({
      queryKey: ['admin', 'trace', 'codes', page.value, size.value, code.value, batchNo.value, status.value, chain.value, dates.value],
      queryFn: () => fetchAdminTraceCodes({
        pageNum: page.value,
        pageSize: size.value,
        code: code.value,
        batchNo: batchNo.value,
        status: status.value,
        chain: chain.value,
        from: dates.value?.[0],
        to: dates.value?.[1]
      }),
      retry: false
    }));
    const cols = computed<ProColumns<RawTraceCode>[]>(() => [{
      title: '溯源码',
      dataIndex: 'code',
      width: 220,
      render: (_, r) => <Button type="link" onClick={() => nav(`/admin/production/trace/${encodeURIComponent(r.code || '')}`)}>{r.code}</Button>
    }, {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 190
    }, {
      title: '状态',
      width: 110,
      render: (_, r) => <Tag color={r.status === 'revoked' ? 'red' : r.status === 'active' ? 'green' : 'default'}>{codeName(r.status)}</Tag>
    }, {
      title: '扫码次数',
      dataIndex: 'scanCount',
      width: 100,
      render: (_, r) => r.scanCount ?? '—'
    }, {
      title: '生成时间',
      dataIndex: 'createdAt',
      width: 175
    }, {
      title: '有效期至',
      dataIndex: 'expireDate',
      width: 135
    }, {
      title: '链上凭证',
      width: 150,
      render: (_, r) => <Tag color={r.onChain ? 'green' : r.attested ? 'orange' : 'default'}>{r.onChain ? '已上链' : r.attested ? '有存证待确认' : '无存证记录'}</Tag>
    }, {
      title: '操作',
      valueType: 'option',
      width: 120,
      fixed: 'right',
      render: (_, r) => <ListRowActions items={[<Button key="detail" type="link" size="small" onClick={() => nav(`/admin/production/trace/${encodeURIComponent(r.code || '')}`)}>溯源详情</Button>]} />
    }]);
    return () => {
      return <QualityPage title="单品溯源码管理" subTitle="跨主体溯源码监管与生产链路核验"><Alert type="info" showIcon message="生成、激活由生产用户端按所属批次维护；运营通过不合格品处置统一冻结批次和作废关联码。" /><LoadError error={query.error} /><Card class="production-dense-filter-card"><CollapsibleFilterDiv fieldCount={5} class="production-filter-grid">{({
              toggleButton
            }: {
              toggleButton: VNodeChild;
            }) => <>
  <div class="production-filter-field"><label>溯源码</label><Input allowClear value={code.value} placeholder="请输入溯源码" onChange={e => {
                  setCode(e.target.value);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>批次号</label><Input allowClear value={batchNo.value} placeholder="请输入批次号" onChange={e => {
                  setBatchNo(e.target.value);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>码状态</label><Select allowClear value={status.value} placeholder="全部" options={['generated', 'active', 'scanned', 'revoked', 'expired'].map(value => ({
                  value,
                  label: codeName(value)
                }))} onChange={v => {
                  setStatus(v);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>链上凭证</label><Select allowClear value={chain.value} placeholder="全部" options={[{
                  value: 'onChain',
                  label: '已上链'
                }, {
                  value: 'unconfirmed',
                  label: '有存证待确认'
                }, {
                  value: 'none',
                  label: '无存证记录'
                }]} onChange={v => {
                  setChain(v);
                  setPage(1);
                }} /></div>
  <div class="production-filter-field"><label>生成日期</label><DatePicker.RangePicker key={dates.value?.join() || 'none'} onChange={(_, v) => {
                  setDates(v[0] ? v : undefined);
                  setPage(1);
                }} /></div>
  <div class="production-filter-actions"><Button onClick={() => {
                  setCode('');
                  setBatchNo('');
                  setStatus(undefined);
                  setChain(undefined);
                  setDates(undefined);
                  setPage(1);
                }}>重置</Button><Button type="primary" loading={query.isFetching} onClick={() => {
                  setPage(1);
                  void query.refetch();
                }}>查询</Button>{toggleButton}</div>
 </>}</CollapsibleFilterDiv></Card><Card><Table rowKey="code" memberListToolbar rowSelection={{}} cardProps={false} headerTitle={<Typography.Text type="secondary">扫码、存证状态不替代质量合格判定；批次被冻结后不得继续供给。</Typography.Text>} columns={cols.value} dataSource={query.data?.list ?? []} loading={query.isFetching} search={false} columnWidthStorageKey="quality-trace-codes" columnsState={{
            persistenceKey: 'quality-trace-codes-columns',
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
          }} /></Card></QualityPage>;
    };
  }
});
export default AdminTraceCodeManage;
