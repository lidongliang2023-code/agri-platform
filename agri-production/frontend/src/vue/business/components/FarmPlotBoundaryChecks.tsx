import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { useQuery } from '@/vue/query';
import { Alert, Button, Space, Table, Tag, Typography } from '@/vue/ui';
import { useNavigate } from '@/vue/router';
import { TiandituMap, parseBoundaryVertices, polygonCentroid } from '@/vue/business/shared';
import { http } from '@/utils/request';
interface CheckRow {
  plotId: string;
  plotName: string;
  plotCode?: string;
  status: string;
  message: string;
  boundary?: string;
  overlapStatus?: string;
  overlapMessage?: string;
}
const labels: Record<string, string> = {
  inside: '范围内',
  outside: '超出农场',
  overlap: '存在重叠',
  clear: '无重叠',
  incomplete: '部分待校验',
  farm_missing: '农场未绘制',
  plot_missing: '地块未绘制',
  invalid: '边界异常'
};
const FarmPlotBoundaryChecks = defineComponent({
  name: "FarmPlotBoundaryChecks",
  props: {
    farmId: null as unknown as PropType<{
      farmId?: string;
      boundary?: string | null;
      admin?: boolean;
    }["farmId"]>,
    boundary: null as unknown as PropType<{
      farmId?: string;
      boundary?: string | null;
      admin?: boolean;
    }["boundary"]>,
    admin: null as unknown as PropType<{
      farmId?: string;
      boundary?: string | null;
      admin?: boolean;
    }["admin"]>
  },
  setup(__props: {
    farmId?: string;
    boundary?: string | null;
    admin?: boolean;
  }, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const query = useQuery(() => ({
      queryKey: ['farm-plot-boundary-checks', __props.admin ?? false, __props.farmId, __props.boundary],
      queryFn: () => http.get<CheckRow[]>(`${__props.admin ?? false ? '/admin/farm-supervision/farms' : '/farms'}/${__props.farmId}/plot-boundary-checks`),
      enabled: !!__props.farmId,
      refetchOnWindowFocus: true
    }));
    const rows = computed(() => query.data ?? []);
    const outside = computed(() => rows.value.filter(row => row.status === 'outside').length);
    const invalid = computed(() => rows.value.filter(row => row.status === 'invalid').length);
    const overlap = computed(() => rows.value.filter(row => row.overlapStatus === 'overlap').length);
    const overlapPending = computed(() => rows.value.filter(row => row.overlapStatus !== 'clear' && row.overlapStatus !== 'overlap').length);
    const pending = computed(() => rows.value.filter(row => row.status === 'farm_missing' || row.status === 'plot_missing').length);
    const geometries = computed(() => [{
      id: 'farm',
      title: '农场范围',
      boundary: __props.boundary
    }, ...rows.value.filter(row => row.status !== 'invalid').map(row => ({
      id: row.plotId,
      title: `${row.plotName} · ${labels[row.status]}`,
      boundary: row.boundary
    }))].flatMap(row => {
      const center = polygonCentroid(parseBoundaryVertices(row.boundary));
      return center ? [{
        ...row,
        ...center,
        tone: (row.id === 'farm' ? 'blue' : rows.value.find(item => item.plotId === row.id)?.overlapStatus === 'overlap' ? 'red' : 'green') as 'blue' | 'red' | 'green'
      }] : [];
    }));
    return () => {
      return <Space direction="vertical" size={12} style={{
        width: '100%'
      }}>
    <Space wrap><Typography.Title level={5} style={{
            margin: 0
          }}>地块范围校验</Typography.Title><Button loading={query.isFetching} onClick={() => void query.refetch()}>重新校验</Button></Space>
    {query.isError ? <Alert type="error" showIcon message="地块范围校验失败" description={(query.error as Error).message} /> : <Alert showIcon type={outside.value || invalid.value || overlap.value ? 'error' : pending.value || overlapPending.value ? 'warning' : 'info'} message={`共 ${rows.value.length} 个地块 · 范围内 ${rows.value.filter(row => row.status === 'inside').length} · 越界 ${outside.value} · 重叠地块 ${overlap.value} · 边界异常 ${invalid.value} · 待校验 ${pending.value}`} description="越界与重叠分别校验，重叠数量按地块数统计。蓝色为农场、红色为重叠地块，允许共边或共点；缺少农场边界不影响地块重叠检查，缺失或异常的地块边界无法参与比较。" />}
    {geometries.value.length > 0 && <TiandituMap height={320} points={geometries.value} showLegend={false} />}
    <Table size="small" rowKey="plotId" loading={query.isFetching} dataSource={rows.value} pagination={{
          pageSize: 20,
          hideOnSinglePage: true,
          showTotal: total => `共 ${total} 条`,
          showQuickJumper: true,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100]
        }} scroll={{
          x: 850
        }} columns={[{
          title: '地块',
          dataIndex: 'plotName',
          width: 180
        }, {
          title: '校验状态',
          dataIndex: 'status',
          width: 130,
          render: (status: string) => <Tag color={status === 'inside' ? 'green' : status === 'outside' || status === 'invalid' || status === 'overlap' ? 'red' : 'orange'}>{labels[status] ?? status}</Tag>
        }, {
          title: '重叠状态',
          dataIndex: 'overlapStatus',
          width: 130,
          render: (status?: string) => <Tag color={status === 'clear' ? 'green' : status === 'overlap' || status === 'invalid' ? 'red' : 'orange'}>{status ? labels[status] ?? status : '待校验'}</Tag>
        }, {
          title: '说明',
          render: (_: unknown, row: CheckRow) => <Space direction="vertical" size={0}><span>{row.message}</span><Typography.Text type={row.overlapStatus === 'overlap' ? 'danger' : 'secondary'}>{row.overlapMessage}</Typography.Text></Space>
        }, ...(!(__props.admin ?? false) ? [{
          title: '操作',
          width: 100,
          render: (_: unknown, row: CheckRow) => <Button type="link" onClick={() => navigate(`/production/plots/create?plotId=${row.plotId}`)}>编辑地块</Button>
        }] : [])]} />
  </Space>;
    };
  }
});
export default FarmPlotBoundaryChecks;
