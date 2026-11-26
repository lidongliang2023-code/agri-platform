import ProductionListFilters from '@/vue/business/components/ProductionListFilters';
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
import '@/components/ProductionListDense.css';
import '@/components/ProductionTable.css';
import { Alert, Button, Card, Input, Tag, Typography } from '@/vue/ui';
import { PageContainer as PageContainer } from '@/vue/pro';
import BusinessRecordList from '@/vue/business/components/BusinessRecordList';
import ListRowActions from '@/vue/business/components/ListRowActions';
import type { ColumnsType } from '@/vue/ui';
import { useQuery } from '@/vue/query';
import { Link } from '@/vue/router';
import { listP2tBatches } from '@/api/p2t';
import type { P2tBatchRow } from '@/api/p2t';
import useAuthStore from '@/vue/authStore';
const P2tBatches = defineComponent({
  name: "P2tBatches",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const subjectId = useAuthStore(state => state.userInfo?.tenantId);
    const draftKeyword = shallowRef('');
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const pageNum = shallowRef(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const selectedRowKeys = shallowRef<(string | number)[]>([]);
    const setSelectedRowKeys = (next: typeof selectedRowKeys.value | ((previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)) => {
      selectedRowKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)(selectedRowKeys.value) : next;
    };
    onMounted(() => {
      watch(() => [subjectId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setPageNum(1);
          setDraftKeyword('');
          setKeyword('');
          setSelectedRowKeys([]);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const query = useQuery(() => ({
      queryKey: ['p2t-batches', subjectId.value, keyword.value, pageNum.value, pageSize.value],
      queryFn: () => listP2tBatches({
        keyword: keyword.value || undefined,
        pageNum: pageNum.value,
        pageSize: pageSize.value
      })
    }));
    const handleSearch = () => {
      setKeyword(draftKeyword.value.trim());
      setPageNum(1);
    };
    const handleReset = () => {
      setDraftKeyword('');
      setKeyword('');
      setPageNum(1);
    };
    const columns = computed<ColumnsType<P2tBatchRow>>(() => [{
      title: '批次号',
      dataIndex: 'batchNo',
      width: 190,
      render: value => <Typography.Text copyable>{value}</Typography.Text>
    }, {
      title: '作物',
      dataIndex: 'cropName',
      width: 140
    }, {
      title: '品种',
      dataIndex: 'cropVariety',
      width: 130
    }, {
      title: '农场',
      dataIndex: 'farmName',
      width: 180
    }, {
      title: '采收日期',
      dataIndex: 'harvestDate',
      width: 120
    }, {
      title: '产量',
      key: 'quantity',
      width: 130,
      render: (_, row) => `${row.quantity} ${row.unit}`
    }, {
      title: '当前库存',
      key: 'stockQty',
      width: 130,
      render: (_, row) => `${row.stockQty} ${row.unit}`
    }, {
      title: '冻结量',
      key: 'frozenQty',
      width: 130,
      render: (_, row) => `${row.frozenQty} ${row.unit}`
    }, {
      title: '过期未冻结量',
      key: 'unusableQty',
      width: 140,
      render: (_, row) => `${row.unusableQty} ${row.unit}`
    }, {
      title: '库存可用量',
      key: 'availableStockQty',
      width: 140,
      render: (_, row) => `${row.availableStockQty} ${row.unit}`
    }, {
      title: '库存校验',
      key: 'stockCheck',
      width: 180,
      render: (_, row) => row.stockUnitMismatch ? <Tag color="red">库存单位不一致</Tag> : row.stockShortfallQty > 0 ? <Tag color="red">供给缺口 {row.stockShortfallQty} {row.unit}</Tag> : <Tag color="green">正常</Tag>
    }, {
      title: '供给占用',
      key: 'publishedQty',
      width: 130,
      render: (_, row) => `${row.publishedQty} ${row.unit}`
    }, {
      title: '可发布',
      key: 'publishableQty',
      width: 130,
      render: (_, row) => `${row.publishableQty} ${row.unit}`
    }, {
      title: '已认购',
      key: 'reservedQty',
      width: 130,
      render: (_, row) => `${row.reservedQty} ${row.unit}`
    }, {
      title: '质检',
      key: 'qualityJudged',
      width: 110,
      render: (_, row) => <Tag color={row.qualityJudged ? 'green' : 'orange'}>{row.qualityJudged ? '已判定' : '未判定'}</Tag>
    }, {
      title: '品种映射',
      key: 'mapped',
      width: 110,
      render: (_, row) => <Tag color={row.mapped ? 'green' : 'red'}>{row.mapped ? '已映射' : '未映射'}</Tag>
    }, {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, row) => <ListRowActions>
      <Link key="detail" to={`/production/harvests/${row.batchId}`}>采收详情</Link>
      <Link key="trace" to={`/production/p2t/trace?batchNo=${encodeURIComponent(row.batchNo)}`}>产销链路</Link>
      {row.publishable ? <Link key="offer" to={`/production/p2t/offers?batchId=${row.batchId}&create=1`}>发布供给</Link> : <Typography.Text key="disabled" type="secondary">{row.mapped ? '无可发布量' : '待映射'}</Typography.Text>}
    </ListRowActions>
    }]);
    return () => {
      return <PageContainer class="production-list-dense production-member-list" title="采收批次与可售量">
    <Card class="production-dense-filter-card">
      <ProductionListFilters onSearch={handleSearch} onReset={handleReset} loading={query.isFetching}>
        <div class="production-filter-field">
          <label>关键字</label>
          <Input allowClear placeholder="搜索批次号或品种" value={draftKeyword.value} onChange={e => setDraftKeyword(e.target.value)}  />
        </div>
      </ProductionListFilters>
    </Card>
    {query.isError && <Alert type="error" showIcon style={{
          marginBottom: 10
        }} message="批次加载失败" description={query.error instanceof Error ? query.error.message : '请重试'} action={<Button onClick={() => void query.refetch()}>重试</Button>} />}
    <Card>
      <BusinessRecordList memberListToolbar rowKey="batchId" columns={columns.value} dataSource={query.data?.list ?? []} loading={query.isFetching} columnWidthStorageKey="p2t-batches" onReload={() => query.refetch()} rowSelection={{
            selectedRowKeys: selectedRowKeys.value,
            onChange: setSelectedRowKeys
          }} pagination={{
            current: pageNum.value,
            pageSize: pageSize.value,
            total: query.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 个批次`,
            onChange: (page, size) => {
              setPageNum(size === pageSize.value ? page : 1);
              setPageSize(size);
            }
          }} />
    </Card>
  </PageContainer>;
    };
  }
});
export default P2tBatches;
