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
import ProductionPagination from '@/vue/business/components/ProductionPagination';
import { Popover as ListSummary } from '@/vue/ui';
import ListRowActions from '@/vue/business/components/ListRowActions';
import PlotImportModal from './PlotImportModal';
import BusinessRecordList from '@/vue/business/components/BusinessRecordList';
import BusinessCards from '@/vue/business/components/BusinessCards';
import Card from '@/vue/business/components/SectionCard';
import '@/components/ProductionListDense.css';
/**
 * 页面名称：地块列表
 * 路由路径：/production/plots
 * 所属模块：农场数字化管理
 * PRD 序号：PRD 6.1 #6
 * 原型来源：用户端原型 P4 plots
 *
 * 还原要点（对照原型 P4）：
 * - 标题 🗺️ 地块管理；按钮 `+ 新增地块`、`📥 批量导入`
 * - 四维筛选：全部农场 / 全部作物 / 全部生长阶段 / 全部状态
 * - 视图切换 Tab：列表 / 地图 / 看板（卡片）
 * - 统计条：`共 N 个地块 | 在田 X | 休耕 Y`
 * - 表格列：复选框 | 地块编号 | 地块名 | 农场 | 面积 | 作物 | 生长阶段 | 状态 | 操作
 *
 * 数据说明：逐页加载当前主体全部地块和生长记录，完整加载后统一筛选、统计与展示。
 */

import { useNavigate, useSearchParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { PageContainer as PageContainer } from '@/vue/pro';
import { AppstoreOutlined, ImportOutlined, PlusOutlined, TableOutlined, EnvironmentOutlined } from '@ant-design/icons-vue';
import { Alert, Button, Empty, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Tag, Typography, message } from '@/vue/ui';
import type { ColumnsType } from '@/vue/ui';
import { deletePlot, listPlots, updatePlotStatus } from '@/api/plots';
import { listAllFarms } from '@/api/farms';
import { listGrowthRecords } from '@/api/growth';
import { loadCompletePages } from '@/utils/load-complete-pages';
import type { Plot } from '@/types';
import { TiandituMap, type TiandituMapPoint } from '@/vue/business/shared';
// 地块状态与作物 emoji 已统一收敛到 @/types（原各页面各存一份）
import { CROP_EMOJI_MAP, PLOT_STATUS_META } from '@/types';

/** 视图模式：列表 / 地图 / 看板（卡片） */
type ViewMode = 'table' | 'map' | 'board';

/** 与后端 PlotVO 状态口径一致：空闲、在种、已停用。采收期/休耕尚无状态数据源。 */
const FILTER_STATUS_VALUES = [1, 2, 0];

/**
 * 地块的「作物」显示值。

 *
 * <p>优先 {@code currentCrop}（作物主数据来的名称，2026-10-16 起地块表单可选）；
 * 历史行没有它时退回 {@code cropVariety} —— 平台侧的演示数据只有"品种"这一层
 * （如"普罗旺斯"），当年就是拿它当作物显示的，列表里这些行不该突然变成"未种植"。</p>
 *
 * @param plot 地块（或任何带这两个字段的行）
 * @returns 作物显示值；两者都没有时为空串
 */
function cropLabelOf(plot: Pick<Plot, 'currentCrop' | 'cropVariety'>): string {
  return (plot.currentCrop || plot.cropVariety || '').trim();
}

/** 筛选条件 */
interface PlotFilters {
  /** 所属农场 */
  farmId?: string;
  /** 作物名称 */
  crop?: string;
  /** 生长阶段 */
  stage?: string;
  /** 地块状态 */
  status?: number;
  /** 关键字 */
  keyword?: string;
}

/**
 * 地块列表页
 *
 * 业务职责：地块台账，支持四维筛选、三种视图切换、导出、批量删除与单地块删除。
 *
 * @returns 页面内容
 */
const PlotList = defineComponent({
  name: "PlotList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const farmIdFromUrl = computed(() => searchParams.value.get('farmId')?.trim() || undefined);
    const queryClient = useQueryClient();
    const importOpen = shallowRef(false);
    const setImportOpen = (next: typeof importOpen.value | ((previous: typeof importOpen.value) => typeof importOpen.value)) => {
      importOpen.value = typeof next === 'function' ? (next as (previous: typeof importOpen.value) => typeof importOpen.value)(importOpen.value) : next;
    };
    const view = shallowRef<ViewMode>('table');
    const setView = (next: typeof view.value | ((previous: typeof view.value) => typeof view.value)) => {
      view.value = typeof next === 'function' ? (next as (previous: typeof view.value) => typeof view.value)(view.value) : next;
    };
    const pageNum = shallowRef<number>(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef<number>(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const selectedRowKeys = shallowRef<string[]>([]);
    const setSelectedRowKeys = (next: typeof selectedRowKeys.value | ((previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)) => {
      selectedRowKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)(selectedRowKeys.value) : next;
    };
    const filters = shallowRef<PlotFilters>({
      farmId: farmIdFromUrl.value
    });
    const setFilters = (next: typeof filters.value | ((previous: typeof filters.value) => typeof filters.value)) => {
      filters.value = typeof next === 'function' ? (next as (previous: typeof filters.value) => typeof filters.value)(filters.value) : next;
    };
    const [filterForm] = Form.useForm<PlotFilters>();

    // 农场详情跳转和浏览器前进/后退时，同步地址、表单与实际筛选条件。
    onMounted(() => {
      watch(() => [farmIdFromUrl.value, filterForm], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          filterForm.setFieldsValue({
            farmId: farmIdFromUrl.value
          });
          setFilters(current => ({
            ...current,
            farmId: farmIdFromUrl.value
          }));
          setPageNum(1);
          setSelectedRowKeys([]);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });

    /** 完整加载地块：不得用单页结果冒充主体全量。 */
    const plotsQuery = useQuery(() => ({
      queryKey: ['plots-all'],
      queryFn: () => loadCompletePages(listPlots, plot => plot.plotId),
      retry: false
    }));

    /** 农场下拉 */
    const farmQuery = useQuery(() => ({
      queryKey: ['farm-options'],
      queryFn: () => listAllFarms()
    }));

    /** 生长记录：构建 地块 → 最新生育期映射 */
    const growthQuery = useQuery(() => ({
      queryKey: ['growth-stage-options'],
      queryFn: () => loadCompletePages(listGrowthRecords, record => record.recordId),
      retry: false
    }));
    const complete = computed(() => plotsQuery.isSuccess && growthQuery.isSuccess && !plotsQuery.isFetching && !growthQuery.isFetching);

    /** 刷新地块数据 */
    const invalidatePlots = (): Promise<void> => queryClient.invalidateQueries({
      queryKey: ['plots-all']
    });

    /** 删除地块 */
    const deleteMutation = useMutation(() => ({
      mutationFn: (plotId: string) => deletePlot(plotId),
      onSuccess: () => {
        message.success('地块已删除');
        setSelectedRowKeys([]);
        void invalidatePlots();
      }
    }));

    /**
     * 启用 / 停用地块。
      * <p>停用时后端会拦"地块上还有在种计划"的情况（400，消息里带计划名与 ID）——
     * 这里把后端给的原因原样弹出来，不写一句笼统的"操作失败"（用户得知道该先去终止哪条计划）。</p>
     */
    const statusMutation = useMutation(() => ({
      mutationFn: (params: {
        plotId: string;
        status: number;
      }) => updatePlotStatus(params.plotId, params.status),
      onSuccess: (_data, variables) => {
        message.success(variables.status === 1 ? '地块已启用' : '地块已停用');
        void invalidatePlots();
      },
      onError: (error: Error) => message.error(error.message || '操作失败')
    }));

    /** 批量删除 */
    const batchDeleteMutation = useMutation(() => ({
      mutationFn: (plotIds: string[]) => Promise.allSettled(plotIds.map(plotId => deletePlot(plotId))),
      onSuccess: (results, plotIds) => {
        const failed = results.flatMap((result, index) => result.status === 'rejected' ? [plotIds[index]] : []);
        const succeeded = results.length - failed.length;
        if (failed.length) message.warning(`已删除 ${succeeded} 个地块，${failed.length} 个删除失败，请核对后重试`);else message.success(`已删除 ${succeeded} 个地块`);
        setSelectedRowKeys(failed);
        void invalidatePlots();
      }
    }));

    /** 地块 → 农场名称 */
    const farmNameMap = computed<Record<string, string>>(() => {
      const map: Record<string, string> = {};
      (farmQuery.data ?? []).forEach(farm => {
        map[farm.farmId] = farm.farmName;
      });
      return map;
    });

    /** 地块 → 最新生育期 */
    const plotStageMap = computed<Record<string, string>>(() => {
      const map: Record<string, string> = {};
      // 与后端分页顺序一致：记录日期降序，同日按记录编号降序；只取有效记录。
      const sorted = [...(growthQuery.data?.list ?? [])].filter(record => Number(record.status) === 1).sort((a, b) => (b.recordDate ?? '').localeCompare(a.recordDate ?? '') || String(b.recordId).localeCompare(String(a.recordId)));
      sorted.forEach(record => {
        const plotId = String(record.plotId ?? '');
        const stage = record.growthStage?.trim();
        if (plotId && stage && !map[plotId]) {
          map[plotId] = stage;
        }
      });
      return map;
    });

    /**
     * 拉页面当前作物名单。
     *
     * <p>优先用 {@code currentCrop}（作物主数据来的名称），历史行退回 {@code cropVariety}
     * —— 演示数据里品种（如"普罗旺斯"）曾被当成作物显示过，列表里这类行不该突然变"未种植"。</p>
     */
    const cropOptions = computed<string[]>(() => {
      const set = new Set<string>();
      (plotsQuery.data?.list ?? []).forEach(plot => {
        const crop = cropLabelOf(plot);
        if (crop) set.add(crop);
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    });

    /** 仅列出当前地块的最新有效生长阶段，避免出现没有数据来源的选项。 */
    const stageOptions = computed<string[]>(() => {
      const set = new Set<string>();
      (plotsQuery.data?.list ?? []).forEach(plot => {
        const stage = plotStageMap.value[plot.plotId];
        if (stage) set.add(stage);
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    });

    /** 四维过滤后的数据 */
    const filteredPlots = computed<Plot[]>(() => {
      const list = plotsQuery.data?.list ?? [];
      return list.filter(plot => {
        if (filters.value.farmId && plot.farmId !== filters.value.farmId) return false;
        if (filters.value.crop && cropLabelOf(plot) !== filters.value.crop) return false;
        if (filters.value.status !== undefined && plot.status !== filters.value.status) return false;
        if (filters.value.stage && plotStageMap.value[plot.plotId] !== filters.value.stage) return false;
        if (filters.value.keyword && ![plot.plotCode, plot.plotName].some(value => (value ?? '').toLowerCase().includes(filters.value.keyword!.toLowerCase()))) {
          return false;
        }
        return true;
      });
    });

    /** 统计条：总数 / 在田 / 休耕 */
    const stats = computed(() => {
      const list = filteredPlots.value;
      return {
        total: list.length,
        planting: list.filter(plot => plot.status === 2 || plot.status === 3).length,
        idle: list.filter(plot => plot.status === 1).length,
        area: list.reduce((sum, plot) => sum + (Number(plot.area) || 0), 0)
      };
    });
    const currentPage = computed(() => Math.min(pageNum.value, Math.max(1, Math.ceil(filteredPlots.value.length / pageSize.value))));
    onMounted(() => {
      watch(() => [currentPage.value, filteredPlots.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setPageNum(currentPage.value);
          const visibleIds = new Set(filteredPlots.value.map(plot => plot.plotId));
          setSelectedRowKeys(keys => keys.filter(key => visibleIds.has(key)));
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });

    /** 当前页数据 */
    const pagePlots = computed<Plot[]>(() => filteredPlots.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value));

    /** 查询 */
    const handleSearch = (): void => {
      const values = filterForm.getFieldsValue();
      const farmId = values.farmId == null ? undefined : String(values.farmId).trim() || undefined;
      setFilters({
        ...values,
        farmId,
        keyword: values.keyword?.trim() || undefined
      });
      const nextParams = new URLSearchParams(searchParams.value);
      if (farmId) nextParams.set('farmId', farmId);else nextParams.delete('farmId');
      setSearchParams(nextParams, {
        replace: true
      });
      setPageNum(1);
      setSelectedRowKeys([]);
    };

    /** 重置 */
    const handleReset = (): void => {
      filterForm.resetFields();
      setFilters({});
      const nextParams = new URLSearchParams(searchParams.value);
      nextParams.delete('farmId');
      setSearchParams(nextParams, {
        replace: true
      });
      setPageNum(1);
      setSelectedRowKeys([]);
    };

    /** 批量删除确认 */
    const confirmBatchDelete = (): void => {
      if (selectedRowKeys.value.length === 0) {
        message.warning('请先选择要删除的地块');
        return;
      }
      Modal.confirm({
        title: `确认删除选中的 ${selectedRowKeys.value.length} 个地块？`,
        content: '删除后地块下的种植记录与土壤档案将不再可用。',
        okText: '确认删除',
        okButtonProps: {
          danger: true
        },
        cancelText: '取消',
        onOk: () => batchDeleteMutation.mutate(selectedRowKeys.value)
      });
    };

    /** 列表视图列定义（原型 P4） */
    const columns = computed<ColumnsType<Plot>>(() => [{
      title: '地块编号',
      dataIndex: 'plotCode',
      width: 140,
      fixed: 'left',
      ellipsis: true,
      render: value => value || '-'
    }, {
      title: '地块名',
      dataIndex: 'plotName',
      width: 180,
      ellipsis: true,
      render: (value: string, record) => <Typography.Link class="production-dense-link-ellipsis" title={value} onClick={() => navigate(`/production/plots/${record.plotId}`)}>
          {value}
        </Typography.Link>
    }, {
      title: '农场',
      dataIndex: 'farmId',
      width: 170,
      ellipsis: true,
      render: (_, record) => {
        const name = record.farmName ?? farmNameMap.value[record.farmId] ?? '-';
        return <span class="production-dense-link-ellipsis" title={name}>{name}</span>;
      }
    }, {
      title: '面积',
      dataIndex: 'area',
      width: 100,
      ellipsis: true,
      render: (_, record) => `${Number(record.area || 0).toLocaleString('zh-CN')}亩`
    }, {
      title: '作物',
      key: 'crop',
      width: 130,
      ellipsis: true,
      render: (_, record) => {
        // 作物取 currentCrop（主数据），历史行退回 cropVariety（见 cropLabelOf 的说明）
        const crop = cropLabelOf(record);
        return crop ? <span class="production-dense-name-wrap" title={crop}>
            <span>{CROP_EMOJI_MAP[crop] ?? '🌱'}</span>
            <span class="production-dense-link-ellipsis">{crop}</span>
          </span> : <Typography.Text type="secondary">未种植</Typography.Text>;
      }
    }, {
      title: '生长阶段',
      key: 'stage',
      width: 110,
      ellipsis: true,
      render: (_, record) => plotStageMap.value[record.plotId] ? <Tag color="geekblue">{plotStageMap.value[record.plotId]}</Tag> : <Typography.Text type="secondary">-</Typography.Text>
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => {
        const meta = PLOT_STATUS_META[record.status] ?? {
          label: '未知',
          color: 'default'
        };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      }
    }, {
      title: '操作',
      key: 'option',
      width: 128,
      fixed: 'right',
      render: (_, record) => <ListRowActions>
          <Typography.Link onClick={() => navigate(`/production/plots/${record.plotId}`)}>
            详情
          </Typography.Link>
          <Typography.Link onClick={() => navigate(`/production/plots/${record.plotId}/soil`)}>
            土壤档案
          </Typography.Link>
          {record.status === 0 ? <Typography.Link onClick={() => statusMutation.mutate({
          plotId: record.plotId,
          status: 1
        })}>
              启用
            </Typography.Link> : <Popconfirm title="确认停用该地块？" description="停用后该地块不再出现在新建计划的选地列表里；地块上还有在种计划时不允许停用。" okText="确认停用" cancelText="取消" onConfirm={() => statusMutation.mutate({
          plotId: record.plotId,
          status: 0
        })}>
              <Typography.Link type="warning">停用</Typography.Link>
            </Popconfirm>}
          <Popconfirm title="确认删除该地块？" okText="确认删除" cancelText="取消" onConfirm={() => deleteMutation.mutate(record.plotId)}>
            <Typography.Link type="danger">删除</Typography.Link>
          </Popconfirm>
        </ListRowActions>
    }]);

    /** 渲染地图视图：统一使用天地图，中心点与 GeoJSON 边界均来自地块台账 */
    const renderMap = (): VNodeChild => {
      const mapPoints: TiandituMapPoint[] = filteredPlots.value.filter(plot => typeof plot.centerLongitude === 'number' && Number.isFinite(plot.centerLongitude) && typeof plot.centerLatitude === 'number' && Number.isFinite(plot.centerLatitude)).map(plot => ({
        id: plot.plotId,
        longitude: Number(plot.centerLongitude),
        latitude: Number(plot.centerLatitude),
        title: plot.plotName,
        meta: `${cropLabelOf(plot) || '未种植'} · ${Number(plot.area || 0).toLocaleString('zh-CN')}亩`,
        tone: plot.status === 2 ? 'green' : plot.status === 0 ? 'gray' : 'orange',
        boundary: plot.boundary
      }));
      return <Card size="small" title="生产地块分布" extra={<Space>
            <Tag color="green">天地图</Tag>
            <Typography.Text type="secondary">
              {mapPoints.length}/{filteredPlots.value.length} 个地块有坐标
            </Typography.Text>
          </Space>}>
        <TiandituMap points={mapPoints} height={560} onPoint-click={(point: import('@agri/shared/vue/map').TiandituMapPoint) => navigate(`/production/plots/${point.id}`)} />
        {mapPoints.length === 0 && <Typography.Text type="secondary">
            当前筛选地块尚未维护中心经纬度，可在地块编辑页通过天地图选点后保存。
          </Typography.Text>}
      </Card>;
    };

    /** 与列表共用字段和操作，避免两种视图能力不一致。 */
    const renderBoard = (): VNodeChild => <BusinessCards rowKey="plotId" dataSource={pagePlots.value} columns={columns.value} pagination={false} />;

    /** 渲染内容区 */
    const listToolbar = computed(() => <Space wrap size={8}>
      {[<Segmented key="view" value={view.value} onChange={value => setView(value as ViewMode)} options={[{
        label: '列表',
        value: 'table',
        icon: <TableOutlined />
      }, {
        label: '地图',
        value: 'map',
        icon: <EnvironmentOutlined />
      }, {
        label: '卡片',
        value: 'board',
        icon: <AppstoreOutlined />
      }]} />, <Button key="import" icon={<ImportOutlined />} disabled={!farmQuery.isSuccess || !farmQuery.data?.length} onClick={() => setImportOpen(true)}>导入地块</Button>, <Button key="batch" danger disabled={!complete.value || selectedRowKeys.value.length === 0} onClick={confirmBatchDelete}>
          批量删除（{selectedRowKeys.value.length}）
        </Button>, <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/production/plots/create')}>
          新增地块
        </Button>]}
      
      <ListSummary trigger="click" content={<div class="production-dense-card-title">
            <span class="production-dense-card-title-text">地块档案</span>
            <span class="production-dense-summary-inline">
              <span class="production-dense-metric">
                <span class="production-dense-metric-label">筛选地块</span>
                <span class="production-dense-metric-value">{complete.value ? `${stats.value.total} 个` : '—'}</span>
              </span>
              <span class="production-dense-metric">
                <span class="production-dense-metric-label">筛选在田</span>
                <span class="production-dense-metric-value is-success">{complete.value ? `${stats.value.planting} 个` : '—'}</span>
              </span>
              <span class="production-dense-metric">
                <span class="production-dense-metric-label">筛选空闲</span>
                <span class="production-dense-metric-value">{complete.value ? `${stats.value.idle} 个` : '—'}</span>
              </span>
              <span class="production-dense-metric">
                <span class="production-dense-metric-label">筛选面积</span>
                <span class="production-dense-metric-value">{complete.value ? `${stats.value.area.toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} 亩` : '—'}</span>
              </span>
            </span>
          </div>}><Button>统计</Button></ListSummary>
    </Space>);
    const renderContent = (): VNodeChild => {
      if (plotsQuery.isLoading || growthQuery.isLoading || plotsQuery.isFetching || growthQuery.isFetching) {
        return <Card loading />;
      }
      if (plotsQuery.isError || growthQuery.isError) {
        return <Empty description={<Space direction="vertical">
              <Typography.Text type="danger">全量数据加载失败，筛选与统计暂不可用：{(plotsQuery.error ?? growthQuery.error)?.message ?? '请重试'}</Typography.Text>
              <Button onClick={() => {
            void plotsQuery.refetch();
            void growthQuery.refetch();
          }}>重新加载</Button>
            </Space>} />;
      }
      if (pagePlots.value.length === 0 && view.value !== 'table') {
        return <Empty description={<Space direction="vertical">
              <Typography.Text type="secondary">暂无匹配的地块</Typography.Text>
              <Button type="primary" onClick={() => navigate('/production/plots/create')}>
                立即新增地块
              </Button>
            </Space>} />;
      }
      if (view.value === 'map') return renderMap();
      if (view.value === 'board') return renderBoard();
      return <BusinessRecordList memberListToolbar toolbarTitle={listToolbar.value} onReload={() => Promise.all([plotsQuery.refetch(), growthQuery.refetch(), farmQuery.refetch()])} rowKey="plotId" dataSource={pagePlots.value} columns={columns.value} pagination={false} rowSelection={{
        selectedRowKeys: selectedRowKeys.value,
        onChange: keys => setSelectedRowKeys(keys as string[])
      }} scroll={{
        x: 1400
      }} />;
    };
    return () => {
      return <PageContainer class="production-list-dense production-member-list" title="地块管理" subTitle="管理地块档案、空间边界与生产关联记录">
      {(plotsQuery.isError || growthQuery.isError) && <Alert type="error" showIcon message="全量数据未加载完成，暂不显示统计" style={{
          marginBottom: 8
        }} />}

      <Card class="production-dense-filter-card">
        <ProductionListFilters form={filterForm} onFinish={handleSearch} onReset={handleReset} loading={plotsQuery.isFetching || growthQuery.isFetching}>
          <Form.Item name="farmId" label="农场">
            <Select aria-label="筛选农场" allowClear showSearch optionFilterProp="label" placeholder="全部农场" options={(farmQuery.data ?? []).map(farm => ({
                  value: String(farm.farmId),
                  label: farm.farmName
                }))} />
          </Form.Item>
          <Form.Item name="crop" label="作物">
            <Select aria-label="筛选作物" allowClear showSearch optionFilterProp="label" placeholder="全部作物" options={cropOptions.value.map(crop => ({
                  value: crop,
                  label: crop
                }))} />
          </Form.Item>
          <Form.Item name="stage" label="阶段">
            <Select aria-label="筛选生长阶段" allowClear placeholder="全部生长阶段" options={stageOptions.value.map(stage => ({
                  value: stage,
                  label: stage
                }))} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select aria-label="筛选状态" allowClear placeholder="全部状态" options={FILTER_STATUS_VALUES.map(value => ({
                  value,
                  label: PLOT_STATUS_META[value].label
                }))} />
          </Form.Item>
          <Form.Item name="keyword" label="关键字">
            <Input aria-label="关键字" allowClear placeholder="地块编号 / 名称" />
          </Form.Item>
        </ProductionListFilters>
      </Card>
      <Card>

        {(view.value !== 'table' || !complete.value) && listToolbar.value}
        {renderContent()}
        {complete.value && view.value !== 'map' && filteredPlots.value.length > 0 && <div style={{
            marginTop: 10
          }}>
            <ProductionPagination selectedCount={view.value === 'table' ? selectedRowKeys.value.length : 0} current={currentPage.value} pageSize={pageSize.value} total={filteredPlots.value.length} onChange={(nextPage, nextSize) => {
              setPageNum(nextPage);
              setPageSize(nextSize);
            }} />
          </div>}
      </Card>
      {importOpen.value && <PlotImportModal farms={farmQuery.data ?? []} initialFarmId={filters.value.farmId} onClose={() => setImportOpen(false)} onComplete={() => queryClient.invalidateQueries({
          queryKey: ['plots-all']
        })} />}
    </PageContainer>;
    };
  }
});
export default PlotList;
