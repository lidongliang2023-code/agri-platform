import { Popover as ListSummary } from '@/vue/ui';
import ProductionListFilters from '@/vue/business/components/ProductionListFilters';
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
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
import Card from '@/vue/business/components/SectionCard';
import ListRowActions from '@/vue/business/components/ListRowActions';
import '@/components/ProductionListDense.css';
import '@/pages/user/harvests/harvests.css'
import ProTable from '@/vue/ProductionRequestTable';
/**
 * 页面名称：采收管理列表
 * 路由路径：/production/harvests
 * 所属模块：采收与库存管理
 * 原型 pageId：P13 harvests
 *
 * 还原要点：
 * - 标题「🌾 采收管理」+ 新建采收 / 采收计划 / 库存管理 入口
 * - 概览卡 4 项：本季采收总量、本月采收次数、平均质量等级(A 占比)、待入库数量
 * - 状态 Tab：全部 / 待入库 / 已入库 / 已出库（带数量）
 * - 筛选：采收日期区间、地块、作物、等级、采收编号
 * - 批量操作：批量入库 / 批量导出；视图切换：列表视图 / 日历视图
 * - 表格列：复选框 | 采收编号 | 作物品种 | 采收地块 | 采收日期 | 数量(kg) | 质量等级 | 状态 | 操作
 */

import { useNavigate, useSearchParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { PageContainer as PageContainer } from '@/vue/pro';
import type { ProColumns } from '@/vue/pro';
import { Badge, Button, Calendar, DatePicker, Empty, Form, Input, Segmented, Select, Space, Tabs, Tag, Typography, message } from '@/vue/ui';
import { ExportOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import useFarmStore from '@/vue/farmStore';
import { inboundHarvest, queryHarvests } from '@/api/harvests';
import { listPlots } from '@/api/plots';
import { listMembers } from '@/api/members';
import type { HarvestBatch, HarvestGrade, InboundStatus, Plot } from '@/types';
import { BATCH_STATUS_META, GRADE_COLOR_MAP, GRADE_LABEL_MAP, GRADE_OPTIONS, INBOUND_STATUS_META } from '@/types';

/** 视图模式：列表 / 日历 */
type ViewMode = 'table' | 'calendar';

/** 状态 Tab 键值 */
type TabKey = 'all' | 'pending' | 'inbound' | 'outbound';

/** Tab → 入库状态（全部不传该条件） */
const TAB_INBOUND_STATUS: Record<TabKey, number | undefined> = {
  all: undefined,
  pending: 0,
  inbound: 1,
  outbound: 2
};

/** 列表筛选条件 */
interface HarvestFilters {
  /** 采收日期区间 */
  dateRange?: [Dayjs, Dayjs];
  /** 地块 ID */
  plotId?: string;
  /** 作物 ID */
  cropId?: string;
  /** 质量等级 */
  grade?: HarvestGrade;
  /** 采收编号关键字 */
  batchNo?: string;
}

/** CSV 单元格转义 */
function escapeCsv(value: string): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/**
 * 采收管理列表页
 *
 * 业务职责：采收批次台账，支持概览统计、状态 Tab、条件筛选、批量入库与导出、日历视图。
 *
 * @returns 页面内容
 */
dayjs.extend(quarterOfYear)
const HarvestRecords = defineComponent({
  name: "HarvestRecords",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const presetPlotId = computed(() => searchParams.value.get('plotId') || undefined);
    const queryClient = useQueryClient();
    const currentFarm = useFarmStore(state => state.currentFarm);
    const farmId = computed(() => currentFarm.value?.farmId);
    const view = shallowRef<ViewMode>('table');
    const setView = (next: typeof view.value | ((previous: typeof view.value) => typeof view.value)) => {
      view.value = typeof next === 'function' ? (next as (previous: typeof view.value) => typeof view.value)(view.value) : next;
    };
    const tab = shallowRef<TabKey>('all');
    const setTab = (next: typeof tab.value | ((previous: typeof tab.value) => typeof tab.value)) => {
      tab.value = typeof next === 'function' ? (next as (previous: typeof tab.value) => typeof tab.value)(tab.value) : next;
    };
    const pageNum = shallowRef<number>(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef<number>(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const filters = shallowRef<HarvestFilters>({
      plotId: presetPlotId.value
    });
    const setFilters = (next: typeof filters.value | ((previous: typeof filters.value) => typeof filters.value)) => {
      filters.value = typeof next === 'function' ? (next as (previous: typeof filters.value) => typeof filters.value)(filters.value) : next;
    };
    const selectedKeys = shallowRef<string[]>([]);
    const setSelectedKeys = (next: typeof selectedKeys.value | ((previous: typeof selectedKeys.value) => typeof selectedKeys.value)) => {
      selectedKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedKeys.value) => typeof selectedKeys.value)(selectedKeys.value) : next;
    };
    const [filterForm] = Form.useForm<HarvestFilters>();
    onMounted(() => {
      watch(() => [presetPlotId.value, filterForm], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          filterForm.setFieldsValue({
            plotId: presetPlotId.value
          });
          setFilters(previous => ({
            ...previous,
            plotId: presetPlotId.value
          }));
          setPageNum(1);
          setSelectedKeys([]);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [farmId.value, filterForm, presetPlotId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          filterForm.resetFields();
          filterForm.setFieldsValue({
            plotId: presetPlotId.value
          });
          setFilters({
            plotId: presetPlotId.value
          });
          setPageNum(1);
          setSelectedKeys([]);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });

    /** 基础筛选（不含 Tab 入库状态），用于统计 / 日历 / 计数 */
    const baseFilters = computed(() => ({
      farmId: farmId.value,
      plotId: filters.value.plotId,
      cropId: filters.value.cropId,
      grade: filters.value.grade,
      batchNo: filters.value.batchNo,
      startDate: filters.value.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: filters.value.dateRange?.[1]?.format('YYYY-MM-DD')
    }));

    /** 逐页加载完整筛选结果，统计、日历和导出共用，不截断前 200 条。 */
    const boardQuery = useQuery(() => ({
      queryKey: ['production-harvests', 'board', farmId.value, filters.value],
      enabled: Boolean(farmId.value),
      queryFn: async () => {
        const rows: HarvestBatch[] = [];
        let page = 1;
        while (true) {
          const result = await queryHarvests({
            ...baseFilters.value,
            pageNum: page,
            pageSize: 200
          });
          rows.push(...result.list);
          if (rows.length >= result.total) break;
          if (result.list.length === 0) throw new Error('采收数据分页不完整，请刷新重试');
          page += 1;
        }
        return rows;
      }
    }));

    /** 列表视图数据源：服务端分页 */
    const tableQuery = useQuery(() => ({
      queryKey: ['production-harvests', 'table', farmId.value, filters.value, tab.value, pageNum.value, pageSize.value],
      enabled: Boolean(farmId.value) && view.value === 'table',
      queryFn: () => queryHarvests({
        ...baseFilters.value,
        inboundStatus: TAB_INBOUND_STATUS[tab.value],
        pageNum: pageNum.value,
        pageSize: pageSize.value
      })
    }));

    /** 地块下拉（按当前农场） */
    const plotQuery = useQuery(() => ({
      queryKey: ['plot-options', farmId.value],
      enabled: Boolean(farmId.value),
      queryFn: () => listPlots({
        farmId: farmId.value,
        pageNum: 1,
        pageSize: 100
      })
    }));
    const memberQuery = useQuery(() => ({
      queryKey: ['member-options', farmId.value],
      enabled: Boolean(farmId.value),
      queryFn: () => listMembers({
        farmId: farmId.value,
        pageNum: 1,
        pageSize: 100
      })
    }));
    const memberNameOf = computed(() => new Map((memberQuery.data?.list ?? []).map(member => [String(member.id), member.realName])));
    const operatorName = (record: HarvestBatch): string => record.operatorName || memberNameOf.value.get(String(record.operatorId)) || record.operatorId || '—';

    /** 统一失效刷新 */
    const invalidateHarvests = (): Promise<void> => queryClient.invalidateQueries({
      queryKey: ['production-harvests']
    });

    /**
     * 入库（单条 / 批量复用同一动作）。
     *
     * 用 allSettled 逐个收集结果：只要有任何一个批次入库失败就整体判失败，
     * 并把失败条数与首个失败原因如实报出，绝不把「部分失败」说成「已提交入库」。
     */
    const inboundMutation = useMutation(() => ({
      mutationFn: async (batchIds: string[]) => {
        const settled = await Promise.allSettled(batchIds.map(batchId => inboundHarvest(batchId)));
        const failed = settled.filter(item => item.status === 'rejected');
        if (failed.length > 0) {
          const first = failed[0] as PromiseRejectedResult;
          const reason = first.reason instanceof Error ? first.reason.message : String(first.reason);
          throw new Error(`${batchIds.length} 个批次中 ${failed.length} 个入库失败：${reason}`);
        }
        return batchIds.length;
      },
      onSuccess: (_result, batchIds) => {
        message.success(`${batchIds.length} 个批次已入库，库存流水已生成`);
        setSelectedKeys([]);
        void invalidateHarvests();
      },
      onError: error => {
        message.error(error.message || '入库失败，请稍后重试', 6);
      }
    }));

    /** 全部批次（用于统计与日历） */
    const allBatches = computed<HarvestBatch[]>(() => boardQuery.data ?? []);

    /**
     * 统计数据。
     * 本月、本季均按当前自然月与季度计算。
     */
    const overview = computed(() => {
      const baseDate = dayjs();
      const baseMonth = baseDate.format('YYYY-MM');
      const baseQuarter = `${baseDate.year()}-Q${baseDate.quarter()}`;
      let monthCount = 0;
      let gradeACount = 0;
      let pendingInbound = 0;
      allBatches.value.forEach(item => {
        if (dayjs(item.harvestDate).format('YYYY-MM') === baseMonth) monthCount += 1;
        if (item.grade === 'A') gradeACount += 1;
        if ((item.inboundStatus ?? 0) === 0) pendingInbound += 1;
      });
      const seasonQuantity = allBatches.value.filter(item => `${dayjs(item.harvestDate).year()}-Q${dayjs(item.harvestDate).quarter()}` === baseQuarter).reduce((sum, item) => sum + item.quantity, 0);
      return {
        seasonQuantity,
        monthCount,
        gradeARatio: allBatches.value.length > 0 ? Math.round(gradeACount / allBatches.value.length * 100) : 0,
        pendingInbound
      };
    });

    /** Tab 计数 */
    const tabCounts = computed<Record<TabKey, number>>(() => {
      const counts: Record<TabKey, number> = {
        all: allBatches.value.length,
        pending: 0,
        inbound: 0,
        outbound: 0
      };
      allBatches.value.forEach(item => {
        const status = item.inboundStatus ?? 0;
        if (status === 0) counts.pending += 1;
        if (status === 1) counts.inbound += 1;
        if (status === 2) counts.outbound += 1;
      });
      return counts;
    });

    /** 地块下拉选项 */
    const plotOptions = computed(() => (plotQuery.data?.list ?? []).map((plot: Plot) => ({
      value: plot.plotId,
      label: plot.plotName
    })));

    /** 作物下拉选项（由当前数据集去重生成） */
    const cropOptions = computed(() => {
      const map = new Map<string, string>();
      allBatches.value.forEach(item => {
        if (item.cropId && item.cropName) map.set(item.cropId, item.cropName);
      });
      return Array.from(map.entries()).map(([value, label]) => ({
        value,
        label
      }));
    });

    /** 查询按钮 */
    const handleSearch = (): void => {
      setPageNum(1);
      setFilters(filterForm.getFieldsValue());
      setSelectedKeys([]);
    };

    /** 重置按钮 */
    const handleReset = (): void => {
      filterForm.resetFields();
      setPageNum(1);
      setFilters({});
      setSelectedKeys([]);
      if (presetPlotId.value) {
        const next = new URLSearchParams(searchParams.value);
        next.delete('plotId');
        setSearchParams(next, {
          replace: true
        });
      }
    };

    /** 批量入库 */
    const handleBatchInbound = (): void => {
      if (selectedKeys.value.length === 0) {
        message.warning('请先勾选需要入库的采收批次');
        return;
      }
      inboundMutation.mutate(selectedKeys.value);
    };

    /** 导出当前筛选结果为 CSV */
    const handleExport = (): void => {
      const rows = selectedKeys.value.length > 0 ? allBatches.value.filter(item => selectedKeys.value.includes(item.batchId)) : allBatches.value.filter(item => tab.value === 'all' || item.inboundStatus === TAB_INBOUND_STATUS[tab.value]);
      if (rows.length === 0) {
        message.warning('暂无可导出的数据');
        return;
      }
      const header = ['采收编号', '作物品种', '采收地块', '采收日期', '数量(kg)', '质量等级', '入库状态', '批次状态', '采收人', '备注'];
      const body = rows.map(item => [item.batchNo, `${item.cropName ?? '-'}${item.cropVariety ? `(${item.cropVariety})` : ''}`, item.plotName ?? item.plotId ?? '-', item.harvestDate, String(item.quantity), GRADE_LABEL_MAP[item.grade] ?? item.grade, INBOUND_STATUS_META[(item.inboundStatus ?? 0) as InboundStatus].label, BATCH_STATUS_META[item.status]?.label ?? String(item.status), operatorName(item), item.remark ?? ''].map(escapeCsv).join(','));
      const csv = `\uFEFF${[header.join(','), ...body].join('\n')}`;
      const blob = new Blob([csv], {
        type: 'text/csv;charset=utf-8;'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `采收记录_${dayjs().format('YYYYMMDDHHmm')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success(`已导出 ${rows.length} 条采收记录`);
    };

    /** 列表视图列定义（对照原型 P13） */
    const columns = computed<ProColumns<HarvestBatch>[]>(() => [{
      title: '采收编号',
      dataIndex: 'batchNo',
      width: 130
    }, {
      title: '作物品种',
      key: 'crop',
      width: 160,
      render: (_, record) => <span>
          {record.cropName ?? '-'}
          {record.cropVariety ? <Typography.Text type="secondary"> ({record.cropVariety})</Typography.Text> : null}
        </span>
    }, {
      title: '采收地块',
      dataIndex: 'plotName',
      width: 110,
      render: (_, record) => record.plotName ?? record.plotId ?? '-'
    }, {
      title: '采收日期',
      dataIndex: 'harvestDate',
      width: 120
    }, {
      title: '采收数量',
      dataIndex: 'quantity',
      width: 110,
      render: (_, record) => `${record.quantity.toLocaleString()} ${record.unit}`
    }, {
      title: '质量等级',
      dataIndex: 'grade',
      width: 100,
      render: (_, record) => <Tag color={GRADE_COLOR_MAP[record.grade] ?? 'default'}>
          {GRADE_LABEL_MAP[record.grade] ?? record.grade}
        </Tag>
    }, {
      title: '状态',
      key: 'status',
      width: 170,
      render: (_, record) => {
        const inbound = INBOUND_STATUS_META[(record.inboundStatus ?? 0) as InboundStatus];
        return <Space size={4}>
            <Tag color={inbound.color}>{inbound.label}</Tag>
            <Tag color={BATCH_STATUS_META[record.status]?.color ?? 'default'}>
              {BATCH_STATUS_META[record.status]?.label ?? record.status}
            </Tag>
          </Space>;
      }
    }, {
      title: '采收人',
      dataIndex: 'operatorName',
      width: 120,
      ellipsis: true,
      render: (_, record) => operatorName(record)
    }, {
      title: '备注',
      dataIndex: 'remark',
      width: 200,
      ellipsis: true,
      render: (_, record) => record.remark || '—'
    }, {
      title: '操作',
      key: 'option',
      fixed: 'right',
      width: 150,
      valueType: 'option',
      render: (_, record) => <ListRowActions>
          <Typography.Link key="detail" onClick={() => navigate(`/production/harvests/${record.batchId}`)}>
            查看
          </Typography.Link>
          {(record.inboundStatus ?? 0) === 0 ? <Typography.Link key="inbound" onClick={() => inboundMutation.mutate([record.batchId])}>
              入库
            </Typography.Link> : null}
          <Typography.Link key="register" onClick={() => navigate(`/production/harvests/create?plotId=${encodeURIComponent(record.plotId ?? '')}`)}>
            登记采收
          </Typography.Link>
        </ListRowActions>
    }]);

    /** 日历视图单元格：按采收日期聚合展示 */
    const renderCalendarCell = (current: Dayjs): VNodeChild => {
      const dayStr = current.format('YYYY-MM-DD');
      const items = allBatches.value.filter(item => item.harvestDate === dayStr);
      if (items.length === 0) return <span />;
      return <ul style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        fontSize: 12
      }}>
        {items.slice(0, 3).map(item => {
          const inbound = INBOUND_STATUS_META[(item.inboundStatus ?? 0) as InboundStatus];
          return <li key={item.batchId}>
              <Badge color={inbound.color} text={`${item.cropName ?? ''} ${item.quantity}${item.unit}`} />
            </li>;
        })}
        {items.length > 3 ? <li>
            <Typography.Text type="secondary">共 {items.length} 条…</Typography.Text>
          </li> : null}
      </ul>;
    };

    /** 渲染列表视图 */
    const renderTable = (): VNodeChild => <ProTable memberListToolbar headerTitle={false} cardProps={false} tableAlertRender={false} rowKey="batchId" columnWidthStorageKey={JSON.stringify([['batchNo', '采收编号', null], ['crop', '作物品种', null], ['plotName', '采收地块', null], ['harvestDate', '采收日期', null], ['quantity', '数量(kg)', null], ['grade', '质量等级', null], ['status', '状态', null], ['option', '操作', null]])} scroll={{
      x: 1500
    }} columns={columns.value} dataSource={tableQuery.data?.list ?? []} loading={tableQuery.isFetching} search={false} options={{
      reload: () => void invalidateHarvests(),
      density: true,
      setting: true
    }} toolbar={{
      title: <Space size={8} wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/production/harvests/create')}>
              新建采收
            </Button>
            <Button icon={<InboxOutlined />} loading={inboundMutation.isPending} disabled={selectedKeys.value.length === 0} onClick={handleBatchInbound}>
              批量入库
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              批量导出
            </Button>
            <Button onClick={() => navigate('/production/harvests/inventory')}>
              库存管理
            </Button>
          <ListSummary trigger="click" content={<div class="production-dense-summary">
        <div class="production-dense-summary-items">
          <span class="production-dense-metric">
            <span class="production-dense-metric-label">本季采收总量</span>
            <span class="production-dense-metric-value is-success">
              {overview.value.seasonQuantity.toFixed(2)} kg
            </span>
          </span>
          <span class="production-dense-metric">
            <span class="production-dense-metric-label">本月采收次数</span>
            <span class="production-dense-metric-value">{overview.value.monthCount} 次</span>
          </span>
          <span class="production-dense-metric">
            <span class="production-dense-metric-label">A级记录占比</span>
            <span class="production-dense-metric-value">{overview.value.gradeARatio}%</span>
          </span>
          <span class="production-dense-metric">
            <span class="production-dense-metric-label">待入库</span>
            <span class={`production-dense-metric-value ${overview.value.pendingInbound > 0 ? 'is-warning' : ''}`}>
              {overview.value.pendingInbound} 条
            </span>
          </span>
        </div>
      </div>}><Button>统计</Button></ListSummary></Space>
    }} rowSelection={{
      selectedRowKeys: selectedKeys.value,
      onChange: keys => setSelectedKeys(keys.map(String))
    }} pagination={{
      current: pageNum.value,
      pageSize: pageSize.value,
      total: tableQuery.data?.total ?? 0,
      showSizeChanger: true,
      onChange: (nextPage, nextSize) => {
        setPageNum(nextPage);
        setPageSize(nextSize);
      }
    }} />;

    /** 渲染空态 / 错误态，返回 null 表示正常渲染主内容 */
    const renderStatus = (): VNodeChild | null => {
      if (!farmId.value) {
        return <Empty description="请先在顶部切换农场" />;
      }
      if (boardQuery.isError || view.value === 'table' && tableQuery.isError) {
        return <Empty description={<Space direction="vertical">
              <Typography.Text type="danger">采收数据加载失败，请稍后重试</Typography.Text>
              <Button onClick={() => void invalidateHarvests()}>重新加载</Button>
            </Space>} />;
      }
      if (boardQuery.isLoading) {
        return <Empty description="正在加载采收数据…" />;
      }
      if (allBatches.value.length === 0) {
        return <Empty description={<Space direction="vertical">
              <Typography.Text type="secondary">暂无采收记录，先登记一次采收吧</Typography.Text>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/production/harvests/create')}>
                新建采收
              </Button>
            </Space>} />;
      }
      return null;
    };
    return () => {
      return <PageContainer class="harvest-business-page production-list-dense production-member-list" title="采收记录" subTitle={currentFarm.value?.farmName} extra={[<Segmented key="view" value={view.value} onChange={value => setView(value as ViewMode)} options={[{
        label: '列表视图',
        value: 'table'
      }, {
        label: '日历视图',
        value: 'calendar'
      }]} />]}>
      {/* 统计统一放入列表工具栏。 */}

      <Card class="production-dense-filter-card">
        <ProductionListFilters form={filterForm} initialValues={{
            plotId: presetPlotId.value
          }} onFinish={handleSearch} onReset={handleReset} loading={tableQuery.isFetching}>
          <Form.Item name="dateRange" label="采收日期">
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item name="plotId" label="地块">
            <Select allowClear showSearch optionFilterProp="label" placeholder="全部地块" options={plotOptions.value} />
          </Form.Item>
          <Form.Item name="cropId" label="作物">
            <Select allowClear showSearch optionFilterProp="label" placeholder="全部作物" options={cropOptions.value} />
          </Form.Item>
          <Form.Item name="grade" label="等级">
            <Select allowClear placeholder="全部等级" options={GRADE_OPTIONS} />
          </Form.Item>
          <Form.Item name="batchNo" label="采收编号">
            <Input allowClear placeholder="按采收编号搜索" />
          </Form.Item>
        </ProductionListFilters>
      </Card>

      <Card>
        <Tabs activeKey={tab.value} onChange={key => {
            setTab(key as TabKey);
            setPageNum(1);
            setSelectedKeys([]);
          }} items={[{
            key: 'all',
            label: `全部(${tabCounts.value.all})`
          }, {
            key: 'pending',
            label: `待入库(${tabCounts.value.pending})`
          }, {
            key: 'inbound',
            label: `已入库(${tabCounts.value.inbound})`
          }, {
            key: 'outbound',
            label: `已出库(${tabCounts.value.outbound})`
          }]} />
        {renderStatus() ?? (view.value === 'calendar' ? <Calendar cellRender={(current, info) => info.type === 'date' ? renderCalendarCell(current) : info.originNode} /> : renderTable())}
      </Card>
    </PageContainer>;
    };
  }
});
export default HarvestRecords;
