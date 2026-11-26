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
import '@/components/ProductionDetailCompact.css';
import '@/components/ProductionListDense.css';
import '@/components/ProductionTable.css';
import Table from '@/vue/business/components/BusinessRecordList';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { PageContainer as PageContainer } from '@/vue/pro';
/**
 * 页面名称：生长记录
 * 路由路径：/production/growth/records
 * 所属模块：生长监测与IoT
 * PRD 序号：PRD 6.1 #24（生长记录列表、照片墙、长势对比）
 *
 * 设计决策（PRD 仅给出一句话口径，此处补齐交互）：
 * - 列表：地块 / 作物 / 生育期 / 株高 / 长势 / 记录时间 / 记录人 / 照片 / 操作
 * - 照片墙：汇总全部记录照片，缩略图网格 + 点击放大（Image.Preview.Group）
 * - 长势对比：同一地块选择两条不同时期记录，照片并排对比 + 指标差值表
 * - 照片录入：后端 photos 为字符串字段，表单用「每行一个地址」的文本域录入
 */

import { useSearchParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { Alert, Button, Card, Col, DatePicker, Descriptions, Empty, Form, Image, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Tag, Typography, message } from '@/vue/ui';
import type { ColumnsType } from '@/vue/ui';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons-vue';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import useFarmStore from '@/vue/farmStore';
import { createGrowthRecord, deleteGrowthRecord, listGrowthRecords, listGrowthRecordsByPlot, resolveGrowthPhotos, updateGrowthRecord } from '@/api/growth';
import { listPlots } from '@/api/plots';
import type { GrowthLevel, GrowthRecord, Plot } from '@/types';

/** 生育期选项 */
const STAGE_OPTIONS: string[] = ['苗期', '开花期', '结果期', '采收期'];

/** 长势评级选项（1 弱 2 偏弱 3 正常 4 旺盛） */
const LEVEL_OPTIONS: {
  value: GrowthLevel;
  label: string;
  color: string;
}[] = [{
  value: 1,
  label: '弱',
  color: 'red'
}, {
  value: 2,
  label: '偏弱',
  color: 'orange'
}, {
  value: 3,
  label: '正常',
  color: 'green'
}, {
  value: 4,
  label: '旺盛',
  color: 'cyan'
}];

/** 长势评级 → 评分（长势对比的量化口径） */
const LEVEL_SCORE: Record<number, number> = {
  1: 55,
  2: 70,
  3: 85,
  4: 92
};

/** 视图模式 */
type ViewMode = 'table' | 'wall' | 'compare';

/** 记录表单值 */
interface RecordFormValues {
  /** 地块 ID */
  plotId: string;
  /** 作物名称 */
  cropName?: string;
  /** 生育期 */
  growthStage: string;
  /** 株高（cm） */
  plantHeight?: number;
  /** 叶面积指数 */
  leafAreaIndex?: number;
  /** 长势评级 */
  growthLevel: GrowthLevel;
  /** 病虫害情况 */
  pestInfo?: string;
  /** 记录日期 */
  recordDate: Dayjs;
  /** 记录人 */
  recorderName?: string;
  /** 照片地址（每行一个） */
  photos?: string;
}

/**
 * 读取记录时间（兼容 recordDate / createdAt）。
 *
 * @param record 生长记录
 * @returns 时间字符串
 */
function recordTime(record: GrowthRecord): string {
  return record.recordDate ?? record.createdAt ?? '';
}

/**
 * 将「每行一个地址」的文本解析为地址数组。
 *
 * @param text 文本域内容
 * @returns 地址数组
 */
function parsePhotoText(text?: string): string[] {
  if (!text) return [];
  return text.split('\n').map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * 生长记录页面
 *
 * 业务职责：维护作物生育期打卡记录（株高 / 叶面积 / 长势 / 病虫害 / 照片），
 * 提供列表、照片墙与长势对比三种视图。
 *
 * @returns 页面内容
 */
const GrowthRecords = defineComponent({
  name: "GrowthRecords",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const queryClient = useQueryClient();
    const _store = useFarmStore();
    const farmId = computed(() => _store.currentFarm?.farmId);

    /** 视图模式 */
    const view = shallowRef<ViewMode>('table');
    /** 从地块详情进入时按地块过滤，并可自动打开新增弹窗 */
    const setView = (next: typeof view.value | ((previous: typeof view.value) => typeof view.value)) => {
      view.value = typeof next === 'function' ? (next as (previous: typeof view.value) => typeof view.value)(view.value) : next;
    };
    const [searchParams] = useSearchParams();
    const presetPlotId = computed(() => searchParams.value.get('plotId') ?? undefined);
    /** 分页 */
    const pageNum = shallowRef<number>(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef<number>(20);
    /** 筛选条件（草稿与已生效） */
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const draftPlotFilter = shallowRef<string | undefined>(presetPlotId.value);
    const setDraftPlotFilter = (next: typeof draftPlotFilter.value | ((previous: typeof draftPlotFilter.value) => typeof draftPlotFilter.value)) => {
      draftPlotFilter.value = typeof next === 'function' ? (next as (previous: typeof draftPlotFilter.value) => typeof draftPlotFilter.value)(draftPlotFilter.value) : next;
    };
    const draftStageFilter = shallowRef<string | undefined>(undefined);
    const setDraftStageFilter = (next: typeof draftStageFilter.value | ((previous: typeof draftStageFilter.value) => typeof draftStageFilter.value)) => {
      draftStageFilter.value = typeof next === 'function' ? (next as (previous: typeof draftStageFilter.value) => typeof draftStageFilter.value)(draftStageFilter.value) : next;
    };
    const draftDateRange = shallowRef<[Dayjs, Dayjs] | null>(null);
    const setDraftDateRange = (next: typeof draftDateRange.value | ((previous: typeof draftDateRange.value) => typeof draftDateRange.value)) => {
      draftDateRange.value = typeof next === 'function' ? (next as (previous: typeof draftDateRange.value) => typeof draftDateRange.value)(draftDateRange.value) : next;
    };
    const plotFilter = shallowRef<string | undefined>(presetPlotId.value);
    const setPlotFilter = (next: typeof plotFilter.value | ((previous: typeof plotFilter.value) => typeof plotFilter.value)) => {
      plotFilter.value = typeof next === 'function' ? (next as (previous: typeof plotFilter.value) => typeof plotFilter.value)(plotFilter.value) : next;
    };
    const stageFilter = shallowRef<string | undefined>(undefined);
    const setStageFilter = (next: typeof stageFilter.value | ((previous: typeof stageFilter.value) => typeof stageFilter.value)) => {
      stageFilter.value = typeof next === 'function' ? (next as (previous: typeof stageFilter.value) => typeof stageFilter.value)(stageFilter.value) : next;
    };
    const dateRange = shallowRef<[Dayjs, Dayjs] | null>(null);
    /** 行勾选 */
    const setDateRange = (next: typeof dateRange.value | ((previous: typeof dateRange.value) => typeof dateRange.value)) => {
      dateRange.value = typeof next === 'function' ? (next as (previous: typeof dateRange.value) => typeof dateRange.value)(dateRange.value) : next;
    };
    const selectedRowKeys = shallowRef<(string | number)[]>([]);
    /** 新增 / 编辑弹窗 */
    const setSelectedRowKeys = (next: typeof selectedRowKeys.value | ((previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)) => {
      selectedRowKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)(selectedRowKeys.value) : next;
    };
    const editing = shallowRef<GrowthRecord | null>(null);
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const modalOpen = shallowRef<boolean>(false);
    /** 长势对比：地块与两条记录 */
    const setModalOpen = (next: typeof modalOpen.value | ((previous: typeof modalOpen.value) => typeof modalOpen.value)) => {
      modalOpen.value = typeof next === 'function' ? (next as (previous: typeof modalOpen.value) => typeof modalOpen.value)(modalOpen.value) : next;
    };
    const comparePlot = shallowRef<string | undefined>(undefined);
    const setComparePlot = (next: typeof comparePlot.value | ((previous: typeof comparePlot.value) => typeof comparePlot.value)) => {
      comparePlot.value = typeof next === 'function' ? (next as (previous: typeof comparePlot.value) => typeof comparePlot.value)(comparePlot.value) : next;
    };
    const compareA = shallowRef<string | undefined>(undefined);
    const setCompareA = (next: typeof compareA.value | ((previous: typeof compareA.value) => typeof compareA.value)) => {
      compareA.value = typeof next === 'function' ? (next as (previous: typeof compareA.value) => typeof compareA.value)(compareA.value) : next;
    };
    const compareB = shallowRef<string | undefined>(undefined);
    const setCompareB = (next: typeof compareB.value | ((previous: typeof compareB.value) => typeof compareB.value)) => {
      compareB.value = typeof next === 'function' ? (next as (previous: typeof compareB.value) => typeof compareB.value)(compareB.value) : next;
    };
    const [form] = Form.useForm<RecordFormValues>();

    /** 地块列表（筛选与表单） */
    const plotsQuery = useQuery(() => ({
      queryKey: ['growth-record-plots', farmId.value],
      queryFn: () => listPlots({
        pageNum: 1,
        pageSize: 100,
        farmId: farmId.value
      }),
      retry: false
    }));
    const plots = computed<Plot[]>(() => plotsQuery.data?.list ?? []);
    const plotNameMap = computed(() => {
      const map = new Map<string, string>();
      plots.value.forEach(item => map.set(item.plotId, item.plotName));
      return map;
    });

    /** 生长记录分页列表 */
    const recordsQuery = useQuery(() => ({
      queryKey: ['growth-records', farmId.value, pageNum.value, pageSize.value, plotFilter.value, stageFilter.value, dateRange.value?.[0]?.format('YYYY-MM-DD'), dateRange.value?.[1]?.format('YYYY-MM-DD')],
      queryFn: () => listGrowthRecords({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        farmId: farmId.value,
        plotId: plotFilter.value,
        growthStage: stageFilter.value,
        startDate: dateRange.value?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange.value?.[1]?.format('YYYY-MM-DD')
      }),
      retry: false
    }));
    const records = computed<GrowthRecord[]>(() => recordsQuery.data?.list ?? []);
    const total = computed(() => recordsQuery.data?.total ?? 0);

    /** 照片墙数据源（放大拉取条数，保证照片墙完整性） */
    const wallQuery = useQuery(() => ({
      queryKey: ['growth-records-wall', farmId.value, plotFilter.value],
      queryFn: () => listGrowthRecords({
        pageNum: 1,
        pageSize: 100,
        farmId: farmId.value,
        plotId: plotFilter.value
      }),
      retry: false,
      enabled: view.value === 'wall'
    }));
    const wallPhotos = computed(() => {
      const rows = wallQuery.data?.list ?? [];
      return rows.flatMap(row => resolveGrowthPhotos(row).map(url => ({
        url,
        recordId: row.recordId,
        title: `${row.plotName ?? plotNameMap.value.get(row.plotId) ?? row.plotId} ${row.growthStage} ${recordTime(row) ? dayjs(recordTime(row)).format('YYYY-MM-DD') : ''}`
      })));
    });

    /** 长势对比：地块下的全部记录 */
    const compareQuery = useQuery(() => ({
      queryKey: ['growth-records-compare', comparePlot.value],
      queryFn: () => listGrowthRecordsByPlot(comparePlot.value as string),
      retry: false,
      enabled: view.value === 'compare' && Boolean(comparePlot.value)
    }));
    const compareRecords = computed<GrowthRecord[]>(() => (compareQuery.data ?? []).slice().sort((a, b) => dayjs(recordTime(a)).valueOf() - dayjs(recordTime(b)).valueOf()));
    const recordA = computed(() => compareRecords.value.find(item => item.recordId === compareA.value) ?? null);
    const recordB = computed(() => compareRecords.value.find(item => item.recordId === compareB.value) ?? null);

    /** 新增 / 编辑提交 */
    const saveMutation = useMutation(() => ({
      mutationFn: async (values: RecordFormValues) => {
        const urls = parsePhotoText(values.photos);
        const payload: Record<string, unknown> = {
          plotId: values.plotId,
          plotName: plotNameMap.value.get(values.plotId),
          farmId: farmId.value,
          cropName: values.cropName,
          growthStage: values.growthStage,
          plantHeight: values.plantHeight,
          leafAreaIndex: values.leafAreaIndex,
          growthLevel: values.growthLevel,
          pestInfo: values.pestInfo,
          recordDate: values.recordDate.format('YYYY-MM-DD'),
          recorderName: values.recorderName,
          photoUrls: urls,
          photos: JSON.stringify(urls)
        };
        if (editing.value) {
          return updateGrowthRecord(editing.value.recordId, payload as unknown as Partial<GrowthRecord>);
        }
        return createGrowthRecord(payload as unknown as Partial<GrowthRecord>);
      },
      onSuccess: () => {
        message.success(editing.value ? '生长记录已更新' : '生长记录已新增');
        setModalOpen(false);
        setEditing(null);
        form.resetFields();
        void queryClient.invalidateQueries({
          queryKey: ['growth-records']
        });
        void queryClient.invalidateQueries({
          queryKey: ['growth-records-wall']
        });
      },
      onError: (error: Error) => {
        message.error(error.message || '保存失败，请稍后重试');
      }
    }));

    /** 删除记录 */
    const deleteMutation = useMutation(() => ({
      mutationFn: (recordId: string) => deleteGrowthRecord(recordId),
      onSuccess: () => {
        message.success('生长记录已删除');
        void queryClient.invalidateQueries({
          queryKey: ['growth-records']
        });
        void queryClient.invalidateQueries({
          queryKey: ['growth-records-wall']
        });
      },
      onError: (error: Error) => {
        message.error(error.message || '删除失败，请稍后重试');
      }
    }));

    /** 打开新增弹窗 */
    const openCreate = (): void => {
      setEditing(null);
      form.setFieldsValue({
        plotId: plotFilter.value,
        recordDate: dayjs(),
        growthLevel: 3,
        growthStage: '苗期'
      } as RecordFormValues);
      setModalOpen(true);
    };

    /** 从地块详情带 `?plotId=&create=1` 进入时，直接打开新增弹窗并预选地块 */
    onMounted(() => {
      watch(() => [presetPlotId.value, searchParams.value, form], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!presetPlotId.value || searchParams.value.get('create') !== '1') return;
          setEditing(null);
          form.setFieldsValue({
            plotId: presetPlotId.value,
            recordDate: dayjs(),
            growthLevel: 3,
            growthStage: '苗期'
          } as RecordFormValues);
          setModalOpen(true);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });

    /** 打开编辑弹窗 */
    const handleSearch = (): void => {
      setPlotFilter(draftPlotFilter.value);
      setStageFilter(draftStageFilter.value);
      setDateRange(draftDateRange.value);
      setPageNum(1);
    };
    const handleReset = (): void => {
      setDraftPlotFilter(undefined);
      setDraftStageFilter(undefined);
      setDraftDateRange(null);
      setPlotFilter(undefined);
      setStageFilter(undefined);
      setDateRange(null);
      setPageNum(1);
    };
    const handleReload = (): Promise<void> => Promise.all([queryClient.invalidateQueries({
      queryKey: ['growth-records']
    }), queryClient.invalidateQueries({
      queryKey: ['growth-records-wall']
    })]).then(() => undefined);
    const openEdit = (record: GrowthRecord): void => {
      setEditing(record);
      form.setFieldsValue({
        plotId: record.plotId,
        cropName: record.cropName,
        growthStage: record.growthStage,
        plantHeight: record.plantHeight,
        leafAreaIndex: record.leafAreaIndex,
        growthLevel: record.growthLevel,
        pestInfo: record.pestInfo,
        recordDate: recordTime(record) ? dayjs(recordTime(record)) : dayjs(),
        recorderName: record.recorderName,
        photos: resolveGrowthPhotos(record).join('\n')
      } as RecordFormValues);
      setModalOpen(true);
    };

    /** 表格列定义 */
    const columns = computed<ColumnsType<GrowthRecord>>(() => [{
      title: '地块',
      dataIndex: 'plotId',
      key: 'plotId',
      render: (plotId: string, row: GrowthRecord) => row.plotName ?? plotNameMap.value.get(plotId) ?? plotId ?? '-'
    }, {
      title: '作物',
      dataIndex: 'cropName',
      key: 'cropName',
      render: (value?: string) => value ?? '-'
    }, {
      title: '生育期',
      dataIndex: 'growthStage',
      key: 'growthStage',
      render: (stage: string) => <Tag color="blue">{stage || '-'}</Tag>
    }, {
      title: '株高(cm)',
      dataIndex: 'plantHeight',
      key: 'plantHeight',
      render: (value?: number) => typeof value === 'number' ? value : '-'
    }, {
      title: '长势',
      dataIndex: 'growthLevel',
      key: 'growthLevel',
      render: (level: GrowthLevel) => {
        const meta = LEVEL_OPTIONS.find(item => item.value === Number(level));
        return <Tag color={meta?.color ?? 'green'}>
            {meta?.label ?? '正常'}（{LEVEL_SCORE[Number(level)] ?? 80}分）
          </Tag>;
      }
    }, {
      title: '记录时间',
      key: 'recordDate',
      render: (_value: unknown, row: GrowthRecord) => recordTime(row) ? dayjs(recordTime(row)).format('YYYY-MM-DD') : '-'
    }, {
      title: '记录人',
      dataIndex: 'recorderName',
      key: 'recorderName',
      render: (value?: string) => value ?? '-'
    }, {
      title: '照片',
      key: 'photos',
      render: (_value: unknown, row: GrowthRecord) => {
        const photos = resolveGrowthPhotos(row);
        if (photos.length === 0) return <Typography.Text type="secondary">无</Typography.Text>;
        return <Image.PreviewGroup>
            <Space size={4}>
              {photos.slice(0, 3).map(url => <Image key={url} src={url} width={40} height={40} style={{
              objectFit: 'cover'
            }} />)}
              {photos.length > 3 && <Typography.Text type="secondary">+{photos.length - 3}</Typography.Text>}
            </Space>
          </Image.PreviewGroup>;
      }
    }, {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 140,
      render: (_value: unknown, row: GrowthRecord) => <ListRowActions>
          <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Popconfirm key="delete" title="确认删除该生长记录？" okText="删除" cancelText="取消" onConfirm={() => deleteMutation.mutate(row.recordId)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </ListRowActions>
    }]);

    /** 长势对比：指标差值行 */
    const compareRows = computed(() => {
      if (!recordA.value || !recordB.value) return [];
      const scoreA = LEVEL_SCORE[Number(recordA.value.growthLevel)] ?? 80;
      const scoreB = LEVEL_SCORE[Number(recordB.value.growthLevel)] ?? 80;
      return [{
        key: 'stage',
        label: '生育期',
        a: recordA.value.growthStage,
        b: recordB.value.growthStage
      }, {
        key: 'date',
        label: '记录时间',
        a: recordTime(recordA.value) ? dayjs(recordTime(recordA.value)).format('YYYY-MM-DD') : '-',
        b: recordTime(recordB.value) ? dayjs(recordTime(recordB.value)).format('YYYY-MM-DD') : '-'
      }, {
        key: 'height',
        label: '株高(cm)',
        a: recordA.value.plantHeight ?? '-',
        b: recordB.value.plantHeight ?? '-'
      }, {
        key: 'lai',
        label: '叶面积指数',
        a: recordA.value.leafAreaIndex ?? '-',
        b: recordB.value.leafAreaIndex ?? '-'
      }, {
        key: 'score',
        label: '长势评分',
        a: scoreA,
        b: scoreB
      }, {
        key: 'pest',
        label: '病虫害情况',
        a: recordA.value.pestInfo || '无',
        b: recordB.value.pestInfo || '无'
      }];
    });
    return () => {
      return <PageContainer class="production-list-dense production-member-list" title="生长记录" subTitle="作物生育期打卡、现场照片墙与跨时期长势对比" extra={<Segmented value={view.value} onChange={value => setView(value as ViewMode)} options={[{
        label: '列表',
        value: 'table'
      }, {
        label: '照片墙',
        value: 'wall'
      }, {
        label: '长势对比',
        value: 'compare'
      }]} />}>
      <Card class="production-dense-filter-card">
        <ProductionListFilters onSearch={handleSearch} onReset={handleReset} loading={recordsQuery.isLoading}>
          <div class="production-filter-field">
            <label>地块</label>
            <Select allowClear placeholder="全部地块" value={draftPlotFilter.value} options={plots.value.map(item => ({
                value: item.plotId,
                label: item.plotName
              }))} onChange={setDraftPlotFilter} />
          </div>
          <div class="production-filter-field">
            <label>生育期</label>
            <Select allowClear placeholder="全部阶段" value={draftStageFilter.value} options={STAGE_OPTIONS.map(stage => ({
                value: stage,
                label: stage
              }))} onChange={setDraftStageFilter} />
          </div>
          <div class="production-filter-field">
            <label>记录日期</label>
            <DatePicker.RangePicker style={{
                width: '100%'
              }} value={draftDateRange.value} onChange={value => setDraftDateRange(value as [Dayjs, Dayjs] | null)} />
          </div>
        </ProductionListFilters>
      </Card>

      {recordsQuery.isError && <Alert type="error" showIcon style={{
          marginBottom: 12
        }} message="生长记录加载失败" description={(recordsQuery.error as Error)?.message ?? '请稍后重试'} />}

      {view.value === 'table' && <Card>
          <Table memberListToolbar columnWidthStorageKey="growth-records" rowKey="recordId" loading={recordsQuery.isLoading} dataSource={records.value} columns={columns.value} onReload={handleReload} rowSelection={{
            selectedRowKeys: selectedRowKeys.value,
            onChange: setSelectedRowKeys
          }} toolbarTitle={<Space size={8} wrap>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  新增记录
                </Button>
              </Space>} locale={{
            emptyText: <Empty description="暂无生长记录，点击「新增记录」开始打卡" />
          }} pagination={{
            current: pageNum.value,
            pageSize: pageSize.value,
            total: total.value,
            onChange: (page, size) => {
              setPageNum(page);
              setPageSize(size);
            }
          }} />
        </Card>}

      {view.value === 'wall' && <Card title={`照片墙（${wallPhotos.value.length} 张）`}>
          {wallQuery.isLoading ? <Empty description="照片加载中..." /> : wallPhotos.value.length === 0 ? <Empty description="暂无照片，请在生长记录中上传现场照片" /> : <Image.PreviewGroup>
              <Row gutter={[12, 12]}>
                {wallPhotos.value.map(item => <Col xs={12} sm={8} md={6} lg={4} key={`${item.recordId}-${item.url}`}>
                    <Card size="small" hoverable cover={<Image src={item.url} alt={item.title} style={{
                  height: 120,
                  width: '100%',
                  objectFit: 'cover'
                }} />}>
                      <Typography.Text type="secondary" style={{
                    fontSize: 12
                  }}>
                        {item.title}
                      </Typography.Text>
                    </Card>
                  </Col>)}
              </Row>
            </Image.PreviewGroup>}
        </Card>}

      {view.value === 'compare' && <Card title="长势对比">
          <Space wrap size={12} style={{
            marginBottom: 16
          }}>
            <Select style={{
              width: 200
            }} placeholder="选择地块" value={comparePlot.value} options={plots.value.map(item => ({
              value: item.plotId,
              label: item.plotName
            }))} onChange={value => {
              setComparePlot(value);
              setCompareA(undefined);
              setCompareB(undefined);
            }} />
            <Select style={{
              width: 220
            }} placeholder="时期 A（较早）" value={compareA.value} options={compareRecords.value.map(item => ({
              value: item.recordId,
              label: `${recordTime(item) ? dayjs(recordTime(item)).format('YYYY-MM-DD') : '-'} ${item.growthStage}`
            }))} onChange={setCompareA} />
            <Select style={{
              width: 220
            }} placeholder="时期 B（较晚）" value={compareB.value} options={compareRecords.value.map(item => ({
              value: item.recordId,
              label: `${recordTime(item) ? dayjs(recordTime(item)).format('YYYY-MM-DD') : '-'} ${item.growthStage}`
            }))} onChange={setCompareB} />
          </Space>

          {!comparePlot.value && <Empty description="请先选择地块" />}
          {comparePlot.value && compareQuery.isLoading && <Empty description="记录加载中..." />}
          {comparePlot.value && !compareQuery.isLoading && compareRecords.value.length === 0 && <Empty description="该地块暂无生长记录" />}
          {comparePlot.value && compareRecords.value.length > 0 && <Space direction="vertical" style={{
            width: '100%'
          }} size={16}>
              {compareRecords.value.length >= 2 && !compareA.value && !compareB.value && <Alert type="info" showIcon message={`已加载 ${compareRecords.value.length} 条记录，请选择需要对比的两个时期`} />}
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Card size="small" title={`时期 A：${recordA.value?.growthStage ?? '未选择'}`}>
                    {recordA.value ? <Space direction="vertical" style={{
                    width: '100%'
                  }}>
                        <Image.PreviewGroup>
                          <Space wrap>
                            {resolveGrowthPhotos(recordA.value).map(url => <Image key={url} src={url} width={100} height={100} style={{
                          objectFit: 'cover'
                        }} />)}
                          </Space>
                        </Image.PreviewGroup>
                        {resolveGrowthPhotos(recordA.value).length === 0 && <Typography.Text type="secondary">该记录无照片</Typography.Text>}
                        <Descriptions size="small" column={1} bordered>
                          <Descriptions.Item label="记录时间">
                            {recordTime(recordA.value) ? dayjs(recordTime(recordA.value)).format('YYYY-MM-DD') : '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="株高(cm)">{recordA.value.plantHeight ?? '-'}</Descriptions.Item>
                          <Descriptions.Item label="长势评分">
                            {LEVEL_SCORE[Number(recordA.value.growthLevel)] ?? 80}
                          </Descriptions.Item>
                        </Descriptions>
                      </Space> : <Empty description="请选择时期 A" />}
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card size="small" title={`时期 B：${recordB.value?.growthStage ?? '未选择'}`}>
                    {recordB.value ? <Space direction="vertical" style={{
                    width: '100%'
                  }}>
                        <Image.PreviewGroup>
                          <Space wrap>
                            {resolveGrowthPhotos(recordB.value).map(url => <Image key={url} src={url} width={100} height={100} style={{
                          objectFit: 'cover'
                        }} />)}
                          </Space>
                        </Image.PreviewGroup>
                        {resolveGrowthPhotos(recordB.value).length === 0 && <Typography.Text type="secondary">该记录无照片</Typography.Text>}
                        <Descriptions size="small" column={1} bordered>
                          <Descriptions.Item label="记录时间">
                            {recordTime(recordB.value) ? dayjs(recordTime(recordB.value)).format('YYYY-MM-DD') : '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="株高(cm)">{recordB.value.plantHeight ?? '-'}</Descriptions.Item>
                          <Descriptions.Item label="长势评分">
                            {LEVEL_SCORE[Number(recordB.value.growthLevel)] ?? 80}
                          </Descriptions.Item>
                        </Descriptions>
                      </Space> : <Empty description="请选择时期 B" />}
                  </Card>
                </Col>
              </Row>

              {compareRows.value.length > 0 && <Table size="small" rowKey="key" pagination={false} dataSource={compareRows.value} columns={[{
              title: '指标',
              dataIndex: 'label',
              key: 'label'
            }, {
              title: '时期 A',
              dataIndex: 'a',
              key: 'a'
            }, {
              title: '时期 B',
              dataIndex: 'b',
              key: 'b'
            }]} />}
            </Space>}
        </Card>}

      <Modal class="production-form-dialog" title={editing.value ? '编辑生长记录' : '新增生长记录'} open={modalOpen.value} onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }} onOk={() => form.submit()} confirmLoading={saveMutation.isPending} okText="保存" cancelText="取消" width={640} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false} onFinish={values => saveMutation.mutate(values)}>
          <Form.Item name="plotId" label="地块" rules={[{
              required: true,
              message: '请选择地块'
            }]}>
            <Select placeholder="请选择地块" options={plots.value.map(item => ({
                value: item.plotId,
                label: item.plotName
              }))} />
          </Form.Item>
          <Form.Item name="cropName" label="作物">
            <Input placeholder="如：番茄(中杂9号)" />
          </Form.Item>
          <Form.Item name="growthStage" label="生育期" rules={[{
              required: true,
              message: '请选择生育期'
            }]}>
            <Select options={STAGE_OPTIONS.map(stage => ({
                value: stage,
                label: stage
              }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="plantHeight" label="株高(cm)">
                <InputNumber min={0} precision={1} style={{
                    width: '100%'
                  }} placeholder="如：68" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="leafAreaIndex" label="叶面积指数">
                <InputNumber min={0} precision={2} style={{
                    width: '100%'
                  }} placeholder="如：3.2" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="growthLevel" label="长势评级" rules={[{
              required: true,
              message: '请选择长势评级'
            }]}>
            <Select options={LEVEL_OPTIONS.map(item => ({
                value: item.value,
                label: item.label
              }))} />
          </Form.Item>
          <Form.Item name="recordDate" label="记录日期" rules={[{
              required: true,
              message: '请选择记录日期'
            }]}>
            <DatePicker style={{
                width: '100%'
              }} />
          </Form.Item>
          <Form.Item name="recorderName" label="记录人">
            <Input placeholder="如：张三" />
          </Form.Item>
          <Form.Item name="pestInfo" label="病虫害情况">
            <Input.TextArea rows={2} placeholder="如：晚疫病风险（中）" />
          </Form.Item>
          <Form.Item name="photos" label="现场照片（图片地址，多个地址用逗号分隔）" extra="当前为图片地址录入：请填写完整 URL，多个地址用逗号分隔（中英文逗号均可，换行亦可）；后续接入对象存储后将改为文件上传。">
            <Input.TextArea rows={3} placeholder={'https://cdn.example.com/plot1-a.jpg, https://cdn.example.com/plot1-b.jpg'} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>;
    };
  }
});
export default GrowthRecords;
