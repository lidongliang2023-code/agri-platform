import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import '@/pages/admin/farms/FarmSupervisionCompact.css';
import '@/components/ProductionListDense.css';
import { useQuery } from '@/vue/query';
import { useNavigate, useSearchParams } from '@/vue/router';
import { Alert, Button, Input, Segmented, Select, Tag } from '@/vue/ui';
import type { ProColumns } from '@/vue/pro';
import type { Farm } from '@/types';
import { PageContainer } from '@/vue/pro';
import ProTable from '@/vue/ProductionRequestTable';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { supervisionFarms } from '@/api/admin/farm-supervision';
import FarmGisMap from './FarmGisMap';
import Card from '@/vue/business/components/SectionCard';
const FarmSupervisionList = defineComponent({
  name: "FarmSupervisionList",
  props: {
    initialView: null as unknown as PropType<{
      initialView?: 'list' | 'map';
    }["initialView"]>
  },
  setup(__props: {
    initialView?: 'list' | 'map';
  }, {
    slots: __slots
  }) {
    const [params, setParams] = useSearchParams();
    const view = shallowRef<'list' | 'map'>((() => params.value.has('farmId') || params.value.get('view') === 'map' ? 'map' : __props.initialView ?? 'list')());
    const setView = (next: typeof view.value | ((previous: typeof view.value) => typeof view.value)) => {
      view.value = typeof next === 'function' ? (next as (previous: typeof view.value) => typeof view.value)(view.value) : next;
    };
    onMounted(() => {
      watch(() => [params.value, __props.initialView ?? 'list'], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setView(params.value.has('farmId') || params.value.get('view') === 'map' ? 'map' : __props.initialView ?? 'list');
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const navigate = useNavigate();
    const page = shallowRef(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const size = shallowRef(20);
    const setSize = (next: typeof size.value | ((previous: typeof size.value) => typeof size.value)) => {
      size.value = typeof next === 'function' ? (next as (previous: typeof size.value) => typeof size.value)(size.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const tenant = shallowRef('');
    const setTenant = (next: typeof tenant.value | ((previous: typeof tenant.value) => typeof tenant.value)) => {
      tenant.value = typeof next === 'function' ? (next as (previous: typeof tenant.value) => typeof tenant.value)(tenant.value) : next;
    };
    const status = shallowRef<string>();
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const q = useQuery(() => ({
      queryKey: ['farm-supervision', page.value, size.value, keyword.value, tenant.value, status.value],
      queryFn: () => supervisionFarms({
        pageNum: page.value,
        pageSize: size.value,
        keyword: keyword.value,
        tenantId: tenant.value || undefined,
        status: status.value
      }),
      retry: false,
      refetchOnWindowFocus: true,
      enabled: view.value === 'list'
    }));
    const columns = computed<ProColumns<Farm>[]>(() => [{
      title: '农场名称',
      dataIndex: 'farmName',
      width: 220,
      ellipsis: true,
      render: (_, r) => <Button type="link" class="production-dense-cell-link" title={r.farmName} onClick={() => navigate(`/admin/production/farms/${r.farmId}`)}>{r.farmName}</Button>
    }, {
      title: '农场编号',
      dataIndex: 'farmCode',
      width: 160,
      ellipsis: true
    }, {
      title: '所属经营主体',
      dataIndex: 'tenantName',
      width: 220,
      ellipsis: true,
      render: (_, r) => {
        const label = r.tenantName || '主体名称暂不可用';
        return <span class="production-dense-link-ellipsis" title={label}>{label}</span>;
      }
    }, {
      title: '区域',
      width: 200,
      ellipsis: true,
      render: (_, r) => {
        const area = [r.province, r.city, r.district].filter(Boolean).join(' / ') || '未登记';
        return <span class="production-dense-link-ellipsis" title={area}>{area}</span>;
      }
    }, {
      title: '面积（亩）',
      dataIndex: 'areaTotal',
      width: 120,
      ellipsis: true
    }, {
      title: '经营状态',
      width: 110,
      render: (_, r) => <Tag color={Number(r.status) === 1 ? 'green' : 'default'}>{Number(r.status) === 1 ? '启用' : '停用'}</Tag>
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 170,
      render: (_, r) => <ListRowActions items={[<Button key="detail" type="link" size="small" onClick={() => navigate(`/admin/production/farms/${r.farmId}`)}>监管详情</Button>, <Button key="check" type="link" size="small" onClick={() => navigate(`/admin/production/farms/compliance?farmId=${r.farmId}`)}>检查整改</Button>]} />
    }]);
    return () => {
      return <PageContainer class="farm-supervision-compact production-list-dense production-member-list" title="农场监管" subTitle="统一查看农场监管台账、地理分布，维护坐标与边界" extra={<Segmented value={view.value} onChange={key => {
        setView(key as 'list' | 'map');
        setParams(current => {
          const next = new URLSearchParams(current);
          next.set('view', String(key));
          next.delete('farmId');
          next.delete('edit');
          return next;
        }, {
          replace: true
        });
      }} options={[{
        value: 'list',
        label: '监管列表'
      }, {
        value: 'map',
        label: '地图监管'
      }]} />}>
  {view.value === 'map' ? <FarmGisMap embedded /> : <>
   {q.isError && <Alert type="error" style={{
            marginBottom: 8
          }} message="农场读取失败" description={(q.error as Error).message} />}
   <Card class="production-dense-filter-card">
    <div class="production-filter-grid">
     <div class="production-filter-field"><label>农场名称 / 编号</label><Input value={keyword.value} allowClear placeholder="请输入农场名称或编号" onChange={e => {
                  setKeyword(e.target.value);
                  setPage(1);
                }} /></div>
     <div class="production-filter-field"><label>经营主体 ID</label><Input value={tenant.value} allowClear placeholder="请输入经营主体 ID" onChange={e => {
                  setTenant(e.target.value);
                  setPage(1);
                }} /></div>
     <div class="production-filter-field"><label>经营状态</label><Select value={status.value} allowClear placeholder="全部" options={[{
                  label: '运营中',
                  value: 'active'
                }, {
                  label: '已停用',
                  value: 'inactive'
                }]} onChange={v => {
                  setStatus(v);
                  setPage(1);
                }} /></div>
     <div class="production-filter-actions">
      <Button onClick={() => {
                  setKeyword('');
                  setTenant('');
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
    <ProTable rowKey="farmId" memberListToolbar rowSelection={{}} cardProps={false} headerTitle={<span class="production-dense-summary-note">共 {q.data?.total ?? 0} 家 · 农场状态与用户端共用生产台账，监管风险以实际检查问题为依据</span>} columns={columns.value} dataSource={q.isError ? [] : q.data?.list ?? []} loading={q.isFetching} search={false} scroll={{
              x: 1200
            }} columnWidthStorageKey="supervision-farms" columnsState={{
              persistenceKey: 'supervision-farms-columns',
              persistenceType: 'localStorage'
            }} options={{
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
  </>}
 </PageContainer>;
    };
  }
});
export default FarmSupervisionList;
