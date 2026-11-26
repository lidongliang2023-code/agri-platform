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
import ListRowActions from '@/vue/business/components/ListRowActions';
import '@/components/ProductionDetailCompact.css';
import '@/components/ProductionListDense.css';
import useAuthStore from '@/vue/authStore';
import ProTable from '@/vue/ProductionRequestTable';
/**
 * 页面名称：品种对接表
 * 路由路径：/production/p2t/variety
 * 所属模块：产销对接
 *
 * 把生产端作物/品种映射到交易端品类。没有映射的品种不允许发布供给 —— 这是第一道硬闸。
 */

import { App as AntdApp, Button, Popconfirm, Space, Tag, Typography } from '@/vue/ui';
import { ModalForm, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@/vue/pro';
import type { ActionType, ProColumns } from '@/vue/pro';
import { useMutation, useQuery } from '@/vue/query';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { PageContainer as PageContainer } from '@/vue/pro';
import { listCrops } from '@/api/crops';
import { listTradeCategories, listVarietyMaps, removeVarietyMap, saveVarietyMap } from '@/api/p2t';
import type { P2tVarietyMap } from '@/api/p2t';
import { SCROLL_BY_CONTENT, wideTextCell } from '@/components/tableScroll';
interface MapFormValue {
  cropId?: string;
  cropName?: string;
  varietyName?: string;
  categoryCode: string;
  categoryName?: string;
  specStandard?: string;
  gradeRule?: string;
  mainOrigin?: string;
  windowStart?: string;
  windowEnd?: string;
  conversionRate?: number;
  status: number;
  remark?: string;
}
const P2tVarietyMapPage = defineComponent({
  name: "P2tVarietyMapPage",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const subjectId = useAuthStore(state => state.userInfo?.tenantId);
    const {
      message
    } = AntdApp.useApp();
    const actionRef = shallowRef<ActionType | null>(null);
    const editing = shallowRef<P2tVarietyMap | null>(null);
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const formOpen = shallowRef<boolean>(false);
    const setFormOpen = (next: typeof formOpen.value | ((previous: typeof formOpen.value) => typeof formOpen.value)) => {
      formOpen.value = typeof next === 'function' ? (next as (previous: typeof formOpen.value) => typeof formOpen.value)(formOpen.value) : next;
    };
    const scope = computed(() => String(subjectId.value ?? ''));
    const isCurrent = () => !!scope.value && String(useAuthStore.getState().userInfo?.tenantId ?? '') === scope.value;
    onMounted(() => {
      watch(() => [subjectId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setFormOpen(false);
          setEditing(null);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const cropQuery = useQuery(() => ({
      queryKey: ['p2t-crops', subjectId.value],
      enabled: !!subjectId.value,
      queryFn: async () => {
        const rows: Awaited<ReturnType<typeof listCrops>>['list'] = [];
        for (let pageNum = 1;; pageNum++) {
          if (!isCurrent()) throw new Error('经营主体已切换');
          const page = await listCrops({
            pageNum,
            pageSize: 200,
            status: 1
          });
          rows.push(...page.list);
          if (rows.length >= page.total) break;
          if (!page.list.length) throw new Error('作物分页异常，请重试');
        }
        return {
          list: rows
        };
      }
    }));
    const categoryQuery = useQuery(() => ({
      queryKey: ['p2t-trade-categories', subjectId.value],
      enabled: !!subjectId.value,
      queryFn: listTradeCategories,
      staleTime: 60_000
    }));
    const categoryByCode = computed(() => {
      const map = new Map<string, {
        code: string;
        name: string;
        parent?: string;
      }>();
      const rows = categoryQuery.data ?? [];
      const names = new Map(rows.map(c => [c.id, c.categoryName]));
      rows.forEach(c => {
        if (c.categoryCode) map.set(c.categoryCode, {
          code: c.categoryCode,
          name: c.categoryName,
          parent: c.parentId ? names.get(c.parentId) : undefined
        });
      });
      return map;
    });
    const missingCodeCount = computed(() => (categoryQuery.data ?? []).filter(c => !c.categoryCode).length);
    const categoryOptions = computed(() => {
      const options = Array.from(categoryByCode.value.values()).map(c => ({
        value: c.code,
        label: `${c.parent ? `${c.parent} / ` : ''}${c.name}（${c.code}）`
      }));
      // 编辑历史映射时，字典里没有的旧编码仍要能显示，但标明字典外，保存时必须改选
      if (editing.value?.categoryCode && !categoryByCode.value.has(editing.value.categoryCode)) {
        options.unshift({
          value: editing.value.categoryCode,
          label: `${editing.value.categoryName || editing.value.categoryCode}（${editing.value.categoryCode}，字典外）`
        });
      }
      return options;
    });
    const cropOptions = computed(() => (cropQuery.data?.list ?? []).map(c => ({
      value: String(c.cropId),
      label: `${c.cropName}（${c.cropCode}）`
    })));
    const saveMutation = useMutation(() => ({
      mutationFn: (values: MapFormValue) => {
        if (!isCurrent()) throw new Error('经营主体已切换');
        const category = categoryByCode.value.get(values.categoryCode);
        if (!category) throw new Error('请从交易品类字典中选择品类');
        values = {
          ...values,
          categoryCode: category.code,
          categoryName: category.name
        };
        const crop = cropQuery.data?.list?.find(c => String(c.cropId) === String(values.cropId));
        return saveVarietyMap({
          ...values,
          id: editing.value?.id,
          cropId: values.cropId ? Number(values.cropId) : undefined,
          cropCode: crop?.cropCode,
          cropName: crop?.cropName ?? values.cropName
        });
      },
      onSuccess: () => {
        message.success(editing.value ? '映射已保存' : '映射已新增');
        setFormOpen(false);
        setEditing(null);
        actionRef.value?.reload();
      },
      onError: (e: Error) => message.error(e.message || '保存失败')
    }));
    const removeMutation = useMutation(() => ({
      mutationFn: (id: number) => {
        if (!isCurrent()) throw new Error('经营主体已切换');
        return removeVarietyMap(id);
      },
      onSuccess: () => {
        message.success('映射已删除');
        actionRef.value?.reload();
      },
      onError: (e: Error) => message.error(e.message || '删除失败')
    }));
    const columns = computed<ProColumns<P2tVarietyMap>[]>(() => [{
      title: '作物／品种／品类',
      dataIndex: 'keyword',
      hideInTable: true
    }, {
      title: '生产品种',
      render: (_, row) => <div>
          <b>{row.cropName}{row.varietyName ? `·${row.varietyName}` : ''}</b>
          <div><Typography.Text type="secondary" style={{
            fontSize: 12
          }}>{row.cropCode ?? '—'}</Typography.Text></div>
        </div>
    }, {
      title: '交易品类',
      width: 160,
      render: (_, row) => <>{row.categoryName || row.categoryCode}{categoryQuery.isSuccess && row.categoryCode && !categoryByCode.value.has(row.categoryCode) && <Tag color="orange" style={{
          marginLeft: 6
        }}>字典外</Tag>}</>
    }, {
      title: '品类码',
      dataIndex: 'categoryCode',
      width: 130
    }, {
      title: '标准规格',
      dataIndex: 'specStandard',
      ...wideTextCell('specStandard', 180)
    }, {
      title: '等级规则',
      dataIndex: 'gradeRule',
      ...wideTextCell('gradeRule', 240)
    }, {
      title: '主产区',
      dataIndex: 'mainOrigin',
      width: 120
    }, {
      title: '上市窗口',
      render: (_, row) => row.windowStart ? `${row.windowStart} ~ ${row.windowEnd}` : '—',
      width: 130
    }, {
      title: '折算系数',
      dataIndex: 'conversionRate',
      width: 100,
      align: 'right'
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      valueType: 'select',
      valueEnum: {
        1: '已生效',
        0: '已停用'
      },
      render: v => v === 1 ? <Tag color="green">已生效</Tag> : <Tag>已停用</Tag>
    }, {
      title: '操作',
      fixed: 'right',
      valueType: 'option',
      width: 150,
      render: (_, row) => <ListRowActions>
          <Button key="edit" size="small" type="link" icon={<EditOutlined />} onClick={() => {
          setEditing(row);
          setFormOpen(true);
        }}>编辑</Button>
          <Popconfirm key="delete" title="删除该映射？" onConfirm={() => removeMutation.mutate(row.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </ListRowActions>
    }]);
    return () => {
      return <PageContainer class="production-list-dense production-member-list" header={{
        title: '品种对接表'
      }}>

      <ProTable memberListToolbar headerTitle={false} tableAlertRender={false} key={scope.value} params={{
          subjectId: subjectId.value
        }} columnWidthStorageKey="p2t-variety-map" options={{
          reload: true,
          density: true,
          setting: true
        }} actionRef={actionRef} rowKey="id" columns={columns.value.map(column => column.dataIndex === 'keyword' || column.dataIndex === 'status' ? column : {
          ...column,
          search: false
        })} class="p2t-scroll-table" scroll={SCROLL_BY_CONTENT} search={{
          labelWidth: 'auto',
          layout: 'vertical'
        }} rowSelection={{}} toolbar={{
          title: <Space size={8} wrap>
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}>新增映射</Button>
            </Space>
        }} toolBarRender={false} pagination={{
          defaultPageSize: 20,
          showSizeChanger: true
        }} request={async params => {
          if (!isCurrent()) return {
            data: [],
            total: 0,
            success: false
          };
          const res = await listVarietyMaps({
            status: params.status === undefined || params.status === '' ? undefined : Number(params.status),
            pageNum: params.current ?? 1,
            pageSize: params.pageSize ?? 20,
            keyword: params.keyword as string || undefined
          });
          return isCurrent() ? {
            data: res.list,
            total: res.total,
            success: true
          } : {
            data: [],
            total: 0,
            success: false
          };
        }} />

      <ModalForm title={editing.value ? '编辑品种映射' : '新增品种映射'} open={formOpen.value} onOpenChange={open => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }} initialValues={editing.value ? {
          cropId: editing.value.cropId ? String(editing.value.cropId) : undefined,
          cropName: editing.value.cropName,
          varietyName: editing.value.varietyName,
          categoryCode: editing.value.categoryCode,
          categoryName: editing.value.categoryName,
          specStandard: editing.value.specStandard,
          gradeRule: editing.value.gradeRule,
          mainOrigin: editing.value.mainOrigin,
          windowStart: editing.value.windowStart,
          windowEnd: editing.value.windowEnd,
          conversionRate: editing.value.conversionRate,
          status: editing.value.status,
          remark: editing.value.remark
        } : {
          status: 1,
          conversionRate: 1
        }} modalProps={{
          className: "production-form-dialog",
          destroyOnClose: true,
          width: 720
        }} onFinish={async values => {
          try {
            await saveMutation.mutateAsync(values);
            return true;
          } catch {
            return false;
          }
        }}>
        <ProFormSelect name="cropId" label="生产品种" options={cropOptions.value} fieldProps={{
            loading: cropQuery.isFetching
          }} extra={cropQuery.isError ? <Button onClick={() => void cropQuery.refetch()}>作物加载失败，点击重试</Button> : undefined} rules={[{
            required: true,
            message: '请选择作物'
          }]} showSearch />
        <ProFormText name="varietyName" label="具体品种" placeholder="如：早熟紫皮 / 红富士" />
        <ProFormSelect name="categoryCode" label="交易品类" options={categoryOptions.value} showSearch fieldProps={{
            loading: categoryQuery.isFetching,
            optionFilterProp: 'label'
          }} placeholder="从交易端品类字典中选择" extra={categoryQuery.isError ? <Button onClick={() => void categoryQuery.refetch()}>交易品类字典加载失败，点击重试</Button> : categoryQuery.isSuccess && !categoryByCode.value.size ? '交易端暂无带编码的启用品类，请先在交易端品类管理中维护编码' : missingCodeCount.value ? `另有 ${missingCodeCount.value} 个品类未设置编码，暂不可选` : undefined} rules={[{
            required: true,
            message: '请选择交易品类'
          }]} />
        <ProFormText name="specStandard" label="标准规格" placeholder="如 5kg 网袋 · 10 袋/件" />
        <ProFormTextArea name="gradeRule" label="等级规则" placeholder="如 一级 / 二级 / 等外（横径 ≥5.5cm 为一级）" />
        <ProFormText name="mainOrigin" label="主产区" placeholder="如 河南中牟" />
        <Space>
          <ProFormText name="windowStart" label="上市窗口起 (MM-DD)" width="sm" placeholder="05-01" />
          <ProFormText name="windowEnd" label="上市窗口止 (MM-DD)" width="sm" placeholder="11-30" />
          <ProFormDigit name="conversionRate" label="折算系数" min={0} width="xs" />
        </Space>
        <ProFormSelect name="status" label="状态" options={[{
            value: 1,
            label: '生效'
          }, {
            value: 0,
            label: '停用'
          }]} />
        <ProFormTextArea name="remark" label="备注" />
      </ModalForm>
    </PageContainer>;
    };
  }
});
export default P2tVarietyMapPage;
