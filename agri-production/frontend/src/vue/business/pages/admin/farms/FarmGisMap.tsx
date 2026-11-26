import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import '@/pages/admin/farms/FarmSupervisionCompact.css';
import '@/components/ProductionListDense.css';
import { useQuery, useQueryClient } from '@/vue/query';
import { useNavigate, useSearchParams } from '@/vue/router';
import { Alert, Button, Form, Input, Modal, Select, Space, Tag, Typography, message } from '@/vue/ui';
import { TiandituMap, isValidLngLat, parseBoundaryVertices, polygonCentroid } from '@/vue/business/shared';
import type { ProColumns } from '@/vue/pro';
import { PageContainer } from '@/vue/pro';
import Card from '@/vue/business/components/SectionCard';
import { DetailMetricGrid } from '@/vue/business/components/index';
import ProTable from '@/vue/ProductionRequestTable';
import ListRowActions from '@/vue/business/components/ListRowActions';
import FarmCoordinateFields from '@/vue/business/components/FarmCoordinateFields';
import FarmBoundaryFields from '@/vue/business/components/FarmBoundaryFields';
import { listSupervisedFarmMapPoints, saveSupervisedFarmCoordinates, saveSupervisedFarmBoundary, type FarmMapPoint } from '@/api/admin/farms';
function hasCoordinates(farm: FarmMapPoint): boolean {
  return farm.longitude != null && farm.latitude != null && isValidLngLat(Number(farm.longitude), Number(farm.latitude));
}
function displayPoint(farm: FarmMapPoint) {
  const center = hasCoordinates(farm) ? {
    longitude: Number(farm.longitude),
    latitude: Number(farm.latitude)
  } : polygonCentroid(parseBoundaryVertices(farm.boundary));
  return center ? {
    id: String(farm.farmId),
    title: farm.farmName,
    ...center,
    boundary: farm.boundary
  } : null;
}
interface CoordinateValues {
  longitude?: number;
  latitude?: number;
  clearCoordinates?: boolean;
}
interface BoundaryValues {
  longitude?: number;
  latitude?: number;
  boundary?: string;
  clearBoundary?: boolean;
}
const FarmGisMap = defineComponent({
  name: "FarmGisMap",
  props: {
    embedded: null as unknown as PropType<{
      embedded?: boolean;
    }["embedded"]>
  },
  setup(__props: {
    embedded?: boolean;
  }, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const queryClient = useQueryClient();
    const query = useQuery(() => ({
      queryKey: ['supervision-map'],
      queryFn: listSupervisedFarmMapPoints,
      refetchOnWindowFocus: true
    }));
    const rows = computed(() => query.data ?? []);
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const coordinateState = shallowRef('all');
    const setCoordinateState = (next: typeof coordinateState.value | ((previous: typeof coordinateState.value) => typeof coordinateState.value)) => {
      coordinateState.value = typeof next === 'function' ? (next as (previous: typeof coordinateState.value) => typeof coordinateState.value)(coordinateState.value) : next;
    };
    const selectedId = shallowRef<string>();
    const setSelectedId = (next: typeof selectedId.value | ((previous: typeof selectedId.value) => typeof selectedId.value)) => {
      selectedId.value = typeof next === 'function' ? (next as (previous: typeof selectedId.value) => typeof selectedId.value)(selectedId.value) : next;
    };
    const editing = shallowRef<FarmMapPoint>();
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const saving = shallowRef(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const boundaryEditing = shallowRef<FarmMapPoint>();
    const setBoundaryEditing = (next: typeof boundaryEditing.value | ((previous: typeof boundaryEditing.value) => typeof boundaryEditing.value)) => {
      boundaryEditing.value = typeof next === 'function' ? (next as (previous: typeof boundaryEditing.value) => typeof boundaryEditing.value)(boundaryEditing.value) : next;
    };
    const boundarySaving = shallowRef(false);
    const setBoundarySaving = (next: typeof boundarySaving.value | ((previous: typeof boundarySaving.value) => typeof boundarySaving.value)) => {
      boundarySaving.value = typeof next === 'function' ? (next as (previous: typeof boundarySaving.value) => typeof boundarySaving.value)(boundarySaving.value) : next;
    };
    const boundaryForm = Form.useForm<BoundaryValues>();
    const form = Form.useForm<CoordinateValues>();
    const filtered = computed(() => rows.value.filter(farm => (!keyword.value.trim() || [farm.farmName, farm.farmCode, farm.tenantName, farm.tenantId, farm.province, farm.city, farm.district].join(' ').toLowerCase().includes(keyword.value.trim().toLowerCase())) && (coordinateState.value === 'all' || hasCoordinates(farm) === (coordinateState.value === 'valid'))));
    const points = computed(() => filtered.value.map(displayPoint).filter((point): point is NonNullable<typeof point> => point !== null));
    const selected = computed(() => filtered.value.find(farm => String(farm.farmId) === selectedId.value));
    const openEditor = (farm: FarmMapPoint) => {
      form.resetFields();
      form.setFieldsValue({
        longitude: farm.longitude == null ? undefined : Number(farm.longitude),
        latitude: farm.latitude == null ? undefined : Number(farm.latitude),
        clearCoordinates: false
      });
      setEditing(farm);
    };
    const openBoundaryEditor = (farm: FarmMapPoint) => {
      boundaryForm.resetFields();
      boundaryForm.setFieldsValue({
        boundary: farm.boundary ?? undefined,
        clearBoundary: false,
        longitude: farm.longitude == null ? undefined : Number(farm.longitude),
        latitude: farm.latitude == null ? undefined : Number(farm.latitude)
      });
      setBoundaryEditing(farm);
    };
    const saveBoundary = async () => {
      if (!boundaryEditing.value || boundarySaving.value) return;
      let values: BoundaryValues;
      try {
        values = await boundaryForm.validateFields();
      } catch {
        message.warning('请至少绘制 3 个顶点，或清空边界');
        return;
      }
      if (!values.boundary && !values.clearBoundary) {
        message.warning('请绘制农场边界，或明确选择清空边界');
        return;
      }
      setBoundarySaving(true);
      try {
        await saveSupervisedFarmBoundary(boundaryEditing.value.farmId, values.clearBoundary ? {
          clearBoundary: true
        } : {
          boundary: values.boundary
        });
        await Promise.all(['supervision-map', 'farm-supervision', 'supervision-detail', 'farm-detail', 'farms', 'farm-plot-boundary-checks'].map(key => queryClient.invalidateQueries({
          queryKey: [key]
        })));
        setSelectedId(String(boundaryEditing.value.farmId));
        setBoundaryEditing(undefined);
        message.success('农场边界已保存，农场档案与监管地图已同步');
      } catch (error) {
        message.error(error instanceof Error ? error.message : '边界保存失败');
      } finally {
        setBoundarySaving(false);
      }
    };
    const requestedFarmId = computed(() => params.value.get('farmId'));
    onMounted(() => {
      watch(() => [requestedFarmId.value, query.data], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!requestedFarmId.value || !query.data) return;
          const farm = query.data.find(row => String(row.farmId) === requestedFarmId.value);
          if (farm) {
            setSelectedId(String(farm.farmId));
            if (params.value.get('edit') === 'boundary') openBoundaryEditor(farm);else openEditor(farm);
          } else message.warning('该农场不在当前监管范围内');
          setParams(current => {
            const next = new URLSearchParams(current);
            next.delete('farmId');
            next.delete('edit');
            return next;
          }, {
            replace: true
          });
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const save = async () => {
      if (!editing.value || saving.value) return;
      let values: CoordinateValues;
      try {
        values = await form.validateFields();
      } catch {
        return;
      }
      if (!values.clearCoordinates && (values.longitude == null || values.latitude == null)) {
        message.warning('请填写完整经纬度，或选择清空坐标');
        return;
      }
      setSaving(true);
      try {
        await saveSupervisedFarmCoordinates(editing.value.farmId, values.clearCoordinates ? {
          clearCoordinates: true
        } : {
          longitude: values.longitude,
          latitude: values.latitude
        });
        await Promise.all([queryClient.invalidateQueries({
          queryKey: ['supervision-map']
        }), queryClient.invalidateQueries({
          queryKey: ['farm-supervision']
        }), queryClient.invalidateQueries({
          queryKey: ['supervision-detail']
        }), queryClient.invalidateQueries({
          queryKey: ['farm-detail']
        }), queryClient.invalidateQueries({
          queryKey: ['farms']
        })]);
        message.success('坐标已保存，农场档案与监管地图已同步');
        setSelectedId(values.clearCoordinates ? undefined : String(editing.value.farmId));
        setEditing(undefined);
      } catch (error) {
        message.error(error instanceof Error ? error.message : '坐标保存失败');
      } finally {
        setSaving(false);
      }
    };
    const columns = computed<ProColumns<FarmMapPoint>[]>(() => [{
      title: '农场',
      dataIndex: 'farmName',
      width: 240
    }, {
      title: '所属区域',
      width: 190,
      render: (_, farm) => [farm.province, farm.city, farm.district].filter(Boolean).join(' / ') || '—'
    }, {
      title: '所属经营主体',
      dataIndex: 'tenantName',
      width: 240,
      render: (_, farm) => farm.tenantName || '主体名称暂不可用'
    }, {
      title: '经度',
      width: 140,
      render: (_, farm) => farm.longitude == null ? '—' : Number(farm.longitude).toFixed(8)
    }, {
      title: '纬度',
      width: 140,
      render: (_, farm) => farm.latitude == null ? '—' : Number(farm.latitude).toFixed(8)
    }, {
      title: '坐标状态',
      width: 120,
      render: (_, farm) => <Tag color={hasCoordinates(farm) ? 'green' : 'orange'}>{hasCoordinates(farm) ? '已登记' : '待补录'}</Tag>
    }, {
      title: '边界状态',
      width: 110,
      render: (_, farm) => <Tag color={parseBoundaryVertices(farm.boundary).length >= 3 ? 'green' : 'default'}>{parseBoundaryVertices(farm.boundary).length >= 3 ? '已绘制' : '未绘制'}</Tag>
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 170,
      render: (_, farm) => <ListRowActions items={[<Button key="locate" type="link" size="small" disabled={!displayPoint(farm)} onClick={() => setSelectedId(String(farm.farmId))}>定位</Button>, <Button key="coord" type="link" size="small" onClick={() => openEditor(farm)}>{hasCoordinates(farm) ? '编辑坐标' : '补录坐标'}</Button>, <Button key="boundary" type="link" size="small" onClick={() => openBoundaryEditor(farm)}>{farm.boundary ? '编辑边界' : '绘制边界'}</Button>, <Button key="detail" type="link" size="small" onClick={() => navigate(`/admin/production/farms/${farm.farmId}`)}>监管详情</Button>]} />
    }]);
    const validCount = computed(() => rows.value.filter(hasCoordinates).length);
    const content = computed(() => <>
    <Space direction="vertical" size={12} style={{
        width: '100%'
      }}>
      <DetailMetricGrid items={[{
          key: 'total',
          title: '监管农场',
          value: query.data ? rows.value.length : null,
          suffix: '个'
        }, {
          key: 'point',
          title: '已登记坐标',
          value: query.data ? validCount.value : null,
          suffix: '个'
        }, {
          key: 'missing',
          title: '待补录坐标',
          value: query.data ? rows.value.length - validCount.value : null,
          suffix: '个'
        }, {
          key: 'boundary',
          title: '已绘制边界',
          value: query.data ? rows.value.filter(farm => parseBoundaryVertices(farm.boundary).length >= 3).length : null,
          suffix: '个'
        }]} />
      {query.isError && <Alert type="error" showIcon message="坐标查询失败" description={(query.error as Error).message} action={<Button onClick={() => void query.refetch()}>重试</Button>} />}
      <Card title="农场监管地图" extra={<Button onClick={() => {
          setSelectedId(undefined);
          void query.refetch();
        }}>刷新地图</Button>}>
        <Space wrap style={{
            marginBottom: 12
          }}>
          <Input.Search allowClear value={keyword.value} onChange={event => setKeyword(event.target.value ?? '')} placeholder="农场名称 / 编号 / 主体 / 区域" style={{
              width: 320,
              maxWidth: '100%'
            }} />
          <Select value={coordinateState.value} onChange={value => {
              setCoordinateState(value);
              setSelectedId(undefined);
            }} style={{
              width: 160
            }} options={[{
              value: 'all',
              label: '全部坐标状态'
            }, {
              value: 'valid',
              label: '已登记坐标'
            }, {
              value: 'missing',
              label: '待补录坐标'
            }]} />
          <Typography.Text type="secondary">筛选 {filtered.value.length} 个农场，地图显示 {points.value.length} 个点位</Typography.Text>
          {selectedId.value && <Button onClick={() => setSelectedId(undefined)}>查看全部点位</Button>}
        </Space>
        <TiandituMap key={selectedId.value ?? 'all'} height={360} points={selected.value && displayPoint(selected.value) ? [displayPoint(selected.value)!] : points.value} showLegend={false} selectedPoint={selected.value && hasCoordinates(selected.value) && !selected.value.boundary ? {
            longitude: Number(selected.value.longitude),
            latitude: Number(selected.value.latitude)
          } : null} onPoint-click={point => setSelectedId(String(point.id))} />
        {selected.value && <Space wrap style={{
            marginTop: 12
          }}><Typography.Text strong>{selected.value.farmName}</Typography.Text><Typography.Text type="secondary">{hasCoordinates(selected.value) ? `${selected.value.longitude}, ${selected.value.latitude}` : '中心坐标未登记 · 使用边界中心定位'}</Typography.Text><Button type="link" onClick={() => selected.value && openEditor(selected.value)}>编辑坐标</Button><Button type="link" onClick={() => selected.value && openBoundaryEditor(selected.value)}>维护边界</Button><Button type="link" onClick={() => navigate(`/admin/production/farms/${selected.value?.farmId}`)}>监管详情</Button></Space>}
      </Card>
      <Card title="农场位置与边界台账" class="production-member-list"><ProTable rowKey="farmId" memberListToolbar rowSelection={{}} cardProps={false} columns={columns.value} dataSource={filtered.value} loading={query.isFetching} search={false} scroll={{
            x: 1320
          }} columnWidthStorageKey="supervision-map" options={{
            reload: () => void query.refetch()
          }} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true
          }} /></Card>
    </Space>
    <Modal title={`维护坐标 · ${editing.value?.farmName ?? ''}`} open={!!editing.value} width={860} destroyOnClose maskClosable={false} closable={!saving.value} confirmLoading={saving.value} cancelButtonProps={{
        disabled: saving.value
      }} okText="保存坐标" onOk={() => void save()} onCancel={() => {
        if (!saving.value) setEditing(undefined);
      }}>
      <Typography.Paragraph type="secondary">{[editing.value?.province, editing.value?.city, editing.value?.district].filter(Boolean).join(' / ')} · 所属经营主体：{editing.value?.tenantName || '主体名称暂不可用'}</Typography.Paragraph>
      <Form form={form} layout="vertical" disabled={saving.value}><FarmCoordinateFields form={form} disabled={saving.value} address={() => [editing.value?.province, editing.value?.city, editing.value?.district, editing.value?.address].filter(Boolean).join('')} /></Form>
    </Modal>
    <Modal title={`绘制农场边界 · ${boundaryEditing.value?.farmName ?? ''}`} open={!!boundaryEditing.value} width={960} destroyOnClose maskClosable={false} closable={!boundarySaving.value} confirmLoading={boundarySaving.value} cancelButtonProps={{
        disabled: boundarySaving.value
      }} okText="保存边界" onOk={() => void saveBoundary()} onCancel={() => {
        if (!boundarySaving.value) setBoundaryEditing(undefined);
      }}>
      <Form form={boundaryForm} layout="vertical" disabled={boundarySaving.value}>
        <Form.Item name="longitude" hidden><Input /></Form.Item><Form.Item name="latitude" hidden><Input /></Form.Item>
        <FarmBoundaryFields key={String(boundaryEditing.value?.farmId)} form={boundaryForm} disabled={boundarySaving.value} address={() => [boundaryEditing.value?.province, boundaryEditing.value?.city, boundaryEditing.value?.district, boundaryEditing.value?.address].filter(Boolean).join('')} />
      </Form>
    </Modal>
  </>);
    return () => {
      return __props.embedded ?? false ? content.value : <PageContainer class="farm-supervision-compact production-list-dense production-member-list" title="农场监管" subTitle="农场地理分布、坐标维护与主体档案联动">{content.value}</PageContainer>;
    };
  }
});
export default FarmGisMap;
