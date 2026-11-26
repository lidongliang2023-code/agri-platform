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
import Card from '@/vue/business/components/SectionCard';
import '@/pages/user/harvests/harvests.css';
import ExpiredDisposal from './ExpiredDisposal';
import Table from '@/vue/business/components/BusinessRecordList';
/**
 * 页面名称：库存详情
 * 路由路径：/production/harvests/inventory/:inventoryId
 * 所属模块：采收与库存管理
 * 原型 pageId：P18 inventory-detail
 *
 * 还原要点：
 * - 头部：`< 返回 番茄(A级) · 库存详情`；按钮「出库」「调拨」
 * - 「📋 库存信息」：库存编号、品名、仓库、当前库存、安全库存、批次号、入库日期、
 *   保质期至、关联采收（→harvest-detail）、状态
 * - 「📋 出入库记录」表：时间 | 类型 | 数量 | 操作人 | 备注
 */

import { useNavigate, useParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { PageContainer } from '@/vue/pro';
import { Alert as AntAlert, Button, Empty, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Progress, Select, Skeleton, Space, Tag, Typography, message } from '@/vue/ui';
import { ArrowLeftOutlined, ExportOutlined, LockOutlined, SwapOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import useFarmStore from '@/vue/farmStore';
import useAuthStore from '@/vue/authStore';
import { requireInventorySource } from '@/pages/user/harvests/inventoryHelpers';
import { DetailInfoGrid, DetailMetricGrid } from '@/vue/business/components/index';
import { outboundInventory, queryInventoryFlows, queryInventoryRecord, toggleInventoryFreeze, updateInventory, transferInventoryRecord } from '@/api/harvests';
import type { InventoryFlowParams } from '@/api/harvests';
import type { InventoryFlow, InventoryRecord } from '@/types';
import { asApiRequestError, httpStatusOf } from '@/utils/request';
import { GRADE_COLOR_MAP, GRADE_LABEL_MAP, INVENTORY_HEALTH_META, WAREHOUSE_OPTIONS, resolveInventoryHealth, inventoryExpiryState } from '@/types';

/** 出入库流水类型 → 展示元数据 */
const FLOW_TYPE_META: Record<number, {
  label: string;
  color: string;
}> = {
  1: {
    label: '入库',
    color: 'green'
  },
  2: {
    label: '出库',
    color: 'blue'
  },
  3: {
    label: '调拨',
    color: 'geekblue'
  },
  4: {
    label: '报损',
    color: 'red'
  }
};

/** 出库弹窗表单值 */
interface OutboundFormValues {
  /** 出库数量 */
  quantity?: number;
  /** 关联单据号 */
  orderNo?: string;
  /** 备注 */
  remark?: string;
}

/** 调拨弹窗表单值 */
interface TransferFormValues {
  /** 目标仓库 */
  targetWarehouse?: string;
  /** 调拨数量 */
  quantity?: number;
  /** 目标库位 */
  locationCode?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 库存详情页面
 *
 * 业务职责：展示单条库存明细与出入库流水，支持出库、调拨与冻结 / 解冻。
 *
 * @returns 页面内容
 */
const InventoryDetail = defineComponent({
  name: "InventoryDetail",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _params = useParams<{
      inventoryId: string;
    }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const currentFarm = useFarmStore(state => state.currentFarm);
    const subjectId = useAuthStore(state => state.userInfo?.tenantId);
    const flowFilters = shallowRef<Omit<InventoryFlowParams, 'pageNum' | 'pageSize'>>({});
    const setFlowFilters = (next: typeof flowFilters.value | ((previous: typeof flowFilters.value) => typeof flowFilters.value)) => {
      flowFilters.value = typeof next === 'function' ? (next as (previous: typeof flowFilters.value) => typeof flowFilters.value)(flowFilters.value) : next;
    };
    const flowScope = shallowRef('current');
    const setFlowScope = (next: typeof flowScope.value | ((previous: typeof flowScope.value) => typeof flowScope.value)) => {
      flowScope.value = typeof next === 'function' ? (next as (previous: typeof flowScope.value) => typeof flowScope.value)(flowScope.value) : next;
    };
    const [flowForm] = Form.useForm();
    const flowPage = shallowRef(1);
    const setFlowPage = (next: typeof flowPage.value | ((previous: typeof flowPage.value) => typeof flowPage.value)) => {
      flowPage.value = typeof next === 'function' ? (next as (previous: typeof flowPage.value) => typeof flowPage.value)(flowPage.value) : next;
    };
    const flowSize = shallowRef(10);
    const setFlowSize = (next: typeof flowSize.value | ((previous: typeof flowSize.value) => typeof flowSize.value)) => {
      flowSize.value = typeof next === 'function' ? (next as (previous: typeof flowSize.value) => typeof flowSize.value)(flowSize.value) : next;
    };
    const editOpen = shallowRef(false);
    const setEditOpen = (next: typeof editOpen.value | ((previous: typeof editOpen.value) => typeof editOpen.value)) => {
      editOpen.value = typeof next === 'function' ? (next as (previous: typeof editOpen.value) => typeof editOpen.value)(editOpen.value) : next;
    };
    const [editForm] = Form.useForm<{
      safeQty: number;
      locationCode?: string;
      remark?: string;
    }>();
    onMounted(() => {
      watch(() => [_params.inventoryId, subjectId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setFlowFilters({});
          setFlowScope('current');
          flowForm.resetFields();
          setFlowPage(1);
          setOutboundOpen(false);
          setTransferOpen(false);
          setEditOpen(false);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const outboundOpen = shallowRef<boolean>(false);
    const setOutboundOpen = (next: typeof outboundOpen.value | ((previous: typeof outboundOpen.value) => typeof outboundOpen.value)) => {
      outboundOpen.value = typeof next === 'function' ? (next as (previous: typeof outboundOpen.value) => typeof outboundOpen.value)(outboundOpen.value) : next;
    };
    const transferOpen = shallowRef<boolean>(false);
    const setTransferOpen = (next: typeof transferOpen.value | ((previous: typeof transferOpen.value) => typeof transferOpen.value)) => {
      transferOpen.value = typeof next === 'function' ? (next as (previous: typeof transferOpen.value) => typeof transferOpen.value)(transferOpen.value) : next;
    };
    const [outboundForm] = Form.useForm<OutboundFormValues>();
    const [transferForm] = Form.useForm<TransferFormValues>();

    /** 库存详情 */
    const detailQuery = useQuery(() => ({
      queryKey: ['production-inventory', 'detail', subjectId.value, _params.inventoryId],
      enabled: Boolean(_params.inventoryId),
      queryFn: () => queryInventoryRecord(_params.inventoryId as string)
    }));
    const record = computed<InventoryRecord | undefined>(() => detailQuery.data);

    /** 出入库流水 */
    const flowQuery = useQuery(() => ({
      queryKey: ['production-inventory', 'flows', subjectId.value, record.value?.batchId, _params.inventoryId, flowScope.value, flowFilters.value, flowPage.value, flowSize.value],
      enabled: Boolean(record.value?.batchId),
      queryFn: () => queryInventoryFlows(record.value?.batchId as string, {
        ...flowFilters.value,
        inventoryId: flowScope.value === 'current' ? _params.inventoryId : undefined,
        pageNum: flowPage.value,
        pageSize: flowSize.value
      })
    }));

    /** 统一失效刷新 */
    const invalidateAll = (): Promise<void> => Promise.all([queryClient.invalidateQueries({
      queryKey: ['production-inventory']
    }), queryClient.invalidateQueries({
      queryKey: ['production-harvests']
    })]).then(() => undefined);

    /** 出库 */
    const outboundMutation = useMutation(() => ({
      mutationFn: async (payload: {
        batchId: string;
        quantity: number;
        orderNo?: string;
        remark?: string;
      }) => {
        if (!record.value) throw new Error('库存记录不存在');
        await requireInventorySource(record.value);
        return outboundInventory(payload.batchId, {
          ...payload,
          inventoryId: record.value.inventoryId
        });
      },
      onSuccess: () => {
        message.success('出库成功');
        setOutboundOpen(false);
        outboundForm.resetFields();
        void invalidateAll();
      },
      onError: error => message.error(error.message || '出库失败，请稍后重试', 6)
    }));

    /** 调拨 */
    const transferMutation = useMutation(() => ({
      mutationFn: (payload: {
        batchId: string;
        targetWarehouse: string;
        quantity: number;
        locationCode?: string;
        remark?: string;
      }) => {
        const sourceRecord = record.value;
        if (!sourceRecord) throw new Error('库存记录不存在');
        return requireInventorySource(sourceRecord).then(() => transferInventoryRecord({
          ...payload,
          inventoryId: sourceRecord.inventoryId
        }));
      },
      onSuccess: () => {
        message.success('调拨成功');
        setTransferOpen(false);
        transferForm.resetFields();
        void invalidateAll();
      },
      onError: error => message.error(error.message || '调拨失败，请稍后重试', 6)
    }));

    /** 冻结 / 解冻 */
    const freezeMutation = useMutation(() => ({
      mutationFn: async (payload: {
        batchId: string;
        frozen: boolean;
      }) => {
        if (!record.value) throw new Error('库存记录不存在');
        await requireInventorySource(record.value);
        return toggleInventoryFreeze(payload.batchId, payload.frozen, record.value.inventoryId);
      },
      onSuccess: (_result, payload) => {
        message.success(payload.frozen ? '库存已冻结' : '库存已解冻');
        void invalidateAll();
      },
      onError: error => message.error(error.message || '操作失败，请稍后重试', 6)
    }));
    const editMutation = useMutation(() => ({
      mutationFn: (values: {
        safeQty: number;
        locationCode?: string;
        remark?: string;
      }) => updateInventory(_params.inventoryId!, values),
      onSuccess: () => {
        message.success('库存资料已更新');
        setEditOpen(false);
        void invalidateAll();
      },
      onError: error => message.error(error.message || '保存失败')
    }));

    /** 提交出库 */
    const handleOutbound = (): void => {
      const _recordAtStart = record.value;
      if (!_recordAtStart) return;
      if (inventoryExpiryState(_recordAtStart.expireDate) === 'expired' || _recordAtStart.healthStatus === 'expired') {
        message.warning('库存已过期，禁止出库，请先核查并按损耗流程处置');
        return;
      }
      outboundForm.validateFields().then(values => {
        const quantity = values.quantity ?? 0;
        if (quantity <= 0) {
          message.warning('出库数量必须大于 0');
          return;
        }
        if (quantity > Math.max(0, _recordAtStart.currentQty - (_recordAtStart.frozenQty ?? 0))) {
          message.warning(`出库数量不能超过当前库存 ${_recordAtStart.currentQty}${_recordAtStart.unit}`);
          return;
        }
        outboundMutation.mutate({
          batchId: _recordAtStart.batchId,
          quantity,
          orderNo: values.orderNo,
          remark: values.remark
        });
      }).catch(() => undefined);
    };

    /** 提交调拨 */
    const handleTransfer = (): void => {
      const _recordAtStart2 = record.value;
      if (!_recordAtStart2) return;
      transferForm.validateFields().then(values => {
        if (!values.quantity || values.quantity <= 0 || values.quantity > _recordAtStart2.currentQty - (_recordAtStart2.frozenQty ?? 0)) {
          message.warning('调拨数量必须大于 0 且不能超过可用库存');
          return;
        }
        if (values.targetWarehouse === _recordAtStart2.warehouseName) {
          message.warning('目标仓库不能与来源仓库相同');
          return;
        }
        transferMutation.mutate({
          batchId: _recordAtStart2.batchId,
          targetWarehouse: values.targetWarehouse ?? '主仓库',
          quantity: values.quantity ?? _recordAtStart2.currentQty,
          locationCode: values.locationCode,
          remark: values.remark
        });
      }).catch(() => undefined);
    };

    /** 加载态 */
    return () => {
      const _recordSnapshot = record.value;
      if (detailQuery.isLoading) {
        return <PageContainer class="harvest-business-page production-detail-compact" title="库存详情">
        <Card>
          <Skeleton active paragraph={{
              rows: 8
            }} />
        </Card>
      </PageContainer>;
      }

      /** 错误态 / 空态 */
      if (detailQuery.isError || !_recordSnapshot) {
        return <PageContainer class="harvest-business-page production-detail-compact" title="库存详情">
        <Empty description={<Space direction="vertical">
              <Typography.Text type="danger">未查询到该库存记录，请返回列表重试</Typography.Text>
              <Button onClick={() => navigate('/production/harvests/inventory')}>
                返回库存管理
              </Button>
            </Space>} />
      </PageContainer>;
      }
      const health = (inventoryExpiryState(_recordSnapshot.expireDate) === 'expired' ? 'expired' : _recordSnapshot.healthStatus ?? resolveInventoryHealth(_recordSnapshot.currentQty, _recordSnapshot.safeQty ?? 0, _recordSnapshot.expireDate)) as keyof typeof INVENTORY_HEALTH_META;
      const healthMeta = INVENTORY_HEALTH_META[health] ?? INVENTORY_HEALTH_META.normal;
      const flows = flowQuery.data?.list ?? [];

      /**
       * 出入库流水查询失败的**真实原因**（后端业务码 / HTTP 状态 / 连不上）。
       * 只陈述实测现象，不写成「接口建设中」这类猜测。
       */
      const flowErrorMessage: string = (() => {
        const error = flowQuery.error as unknown;
        if (!error) {
          return '未知原因';
        }
        const apiError = asApiRequestError(error);
        if (apiError) {
          return `后端返回业务码 ${apiError.bizCode}（${apiError.message || '无提示'}）`;
        }
        const status = httpStatusOf(error);
        if (status === 0) {
          return `无法连接到服务端（${(error as Error)?.message ?? '网络异常'}）`;
        }
        return `HTTP ${status}（${(error as Error)?.message ?? '未知原因'}）`;
      })();
      const safePercent = _recordSnapshot.safeQty && _recordSnapshot.safeQty > 0 ? Math.min(100, Math.round(_recordSnapshot.currentQty / (_recordSnapshot.safeQty * 2) * 100)) : 100;
      return <PageContainer class="harvest-business-page production-detail-compact" title={`${_recordSnapshot.productName ?? '库存'} · 库存详情`} subTitle={currentFarm.value?.farmName} onBack={() => navigate('/production/harvests/inventory')} backIcon={<ArrowLeftOutlined />} extra={[<ExpiredDisposal key="dispose" record={_recordSnapshot} onDone={invalidateAll} />, <Button key="edit" onClick={() => {
        editForm.setFieldsValue({
          safeQty: _recordSnapshot.safeQty ?? 0,
          locationCode: _recordSnapshot.locationCode,
          remark: _recordSnapshot.remark
        });
        setEditOpen(true);
      }}>编辑资料</Button>, <Button key="out" type="primary" icon={<ExportOutlined />} title={health === 'expired' ? '库存已过期，禁止出库' : undefined} disabled={health === 'expired' || Boolean(_recordSnapshot.frozen) || !(_recordSnapshot.currentQty > (_recordSnapshot.frozenQty ?? 0))} loading={outboundMutation.isPending} onClick={() => setOutboundOpen(true)}>
          出库
        </Button>, <Button key="transfer" disabled={Boolean(_recordSnapshot.frozen) || !(_recordSnapshot.currentQty > (_recordSnapshot.frozenQty ?? 0))} icon={<SwapOutlined />} loading={transferMutation.isPending} onClick={() => setTransferOpen(true)}>
          调拨
        </Button>, _recordSnapshot.frozen ? <Popconfirm key="unfreeze" title="确认解冻当前仓库库存？" onConfirm={() => freezeMutation.mutate({
        batchId: _recordSnapshot.batchId,
        frozen: false
      })}><Button>解冻</Button></Popconfirm> : <Popconfirm key="freeze" title="确认冻结该库存？" description="冻结后不可出库，请先解冻。" okText="确认冻结" cancelText="取消" onConfirm={() => freezeMutation.mutate({
        batchId: _recordSnapshot.batchId,
        frozen: true
      })}>
            <Button icon={<LockOutlined />}>冻结</Button>
          </Popconfirm>]}>

      <div style={{
          marginBottom: 16
        }}>
        <DetailMetricGrid items={[{
            key: 'current',
            title: '当前库存',
            value: _recordSnapshot.currentQty,
            precision: 2,
            suffix: _recordSnapshot.unit,
            valueStyle: {
              color: '#52c41a'
            }
          }, {
            key: 'safe',
            title: '安全库存',
            value: _recordSnapshot.safeQty ?? 0,
            suffix: _recordSnapshot.unit
          }, {
            key: 'available',
            title: '可用库存',
            value: _recordSnapshot.frozen ? 0 : Math.max(0, _recordSnapshot.currentQty - (_recordSnapshot.frozenQty ?? 0)),
            precision: 2,
            suffix: _recordSnapshot.unit,
            valueStyle: {
              color: '#1677ff'
            }
          }, {
            key: 'loss',
            title: '累计损耗',
            value: _recordSnapshot.lossQty ?? 0,
            suffix: _recordSnapshot.unit
          }]} />
      </div>

      <Card title="基本信息" style={{
          marginBottom: 16
        }} extra={<Space size={4} wrap>
            <Tag color={healthMeta.color}>● {healthMeta.label}</Tag>
            {_recordSnapshot.frozen ? <Tag color="volcano">已冻结</Tag> : null}
          </Space>}>
        <DetailInfoGrid columns={2} items={[{
            key: 'inventoryId',
            label: '库存编号',
            value: _recordSnapshot.inventoryId
          }, {
            key: 'product',
            label: '品名',
            value: <Space size={4}>
                  <span>{_recordSnapshot.productName ?? '-'}</span>
                  {_recordSnapshot.grade ? <Tag color={GRADE_COLOR_MAP[_recordSnapshot.grade] ?? 'default'}>
                      {GRADE_LABEL_MAP[_recordSnapshot.grade] ?? _recordSnapshot.grade}
                    </Tag> : null}
                </Space>
          }, {
            key: 'warehouse',
            label: '仓库',
            value: _recordSnapshot.warehouseName
          }, {
            key: 'currentQty',
            label: '当前库存',
            value: `${_recordSnapshot.currentQty?.toLocaleString() ?? '—'} ${_recordSnapshot.unit}`
          }, {
            key: 'safeQty',
            label: '安全库存',
            value: `${(_recordSnapshot.safeQty ?? 0).toLocaleString()} ${_recordSnapshot.unit}`
          }, {
            key: 'frozenQty',
            label: '冻结数量',
            value: `${(_recordSnapshot.frozenQty ?? 0).toLocaleString()} ${_recordSnapshot.unit}`
          }, {
            key: 'batchNo',
            label: '批次号',
            value: _recordSnapshot.batchNo ?? '-'
          }, {
            key: 'lastInAt',
            label: '入库日期',
            value: _recordSnapshot.lastInAt ? dayjs(_recordSnapshot.lastInAt).format('YYYY-MM-DD') : '-'
          }, {
            key: 'lastOutAt',
            label: '最近出库',
            value: _recordSnapshot.lastOutAt ? dayjs(_recordSnapshot.lastOutAt).format('YYYY-MM-DD') : '-'
          }, {
            key: 'expireDate',
            label: '保质期至',
            value: _recordSnapshot.expireDate ?? '-'
          }, {
            key: 'locationCode',
            label: '库位编号',
            value: _recordSnapshot.locationCode ?? '-'
          }, {
            key: 'relatedHarvest',
            label: '关联采收',
            value: _recordSnapshot.batchId ? <Typography.Link onClick={() => navigate(`/production/harvests/${_recordSnapshot.batchId}`)}>
                  {_recordSnapshot.relatedBatchNo ?? _recordSnapshot.batchNo ?? _recordSnapshot.batchId}
                </Typography.Link> : _recordSnapshot.relatedBatchNo ?? '-'
          }, {
            key: 'remark',
            label: '备注',
            fullWidth: true,
            value: _recordSnapshot.remark ?? '-'
          }]} />

        <Progress style={{
            marginTop: 16,
            maxWidth: 520
          }} percent={safePercent} status={health === 'shortage' ? 'exception' : health === 'warning' ? 'active' : 'success'} format={() => `库存水位 ${_recordSnapshot.currentQty}/${(_recordSnapshot.safeQty ?? 0) * 2}`} />
      </Card>

      <Card title={`批次出入库流水（${flowQuery.data?.total ?? '—'} 条）`}>
        {/*
          失败必须说出来，不能只留一张空表。
          教训：`queryInventoryFlows` 曾把路径写成 `/harvests/inventory/{batchId}/flows`，
          后端返回「业务码 500」，这里是「空表 + 无任何提示」，看上去像"这段时间没有流水"，
          真正的原因（前端路径写错）被完全藏住。现在把后端给的原因原样显示。
         */}
        {flowQuery.isError ? <AntAlert banner showIcon type="error" style={{
            marginBottom: 16
          }} message={`出入库流水未取到：${flowErrorMessage}`} action={<Button onClick={() => void flowQuery.refetch()}>重新加载</Button>} /> : null}
        <ProductionListFilters form={flowForm} style={{
            gap: 12,
            marginBottom: 16
          }} onFinish={values => {
            setFlowScope(values.scope ?? 'current');
            setFlowFilters({
              flowType: values.flowType,
              direction: values.direction,
              startDate: values.dates?.[0]?.format('YYYY-MM-DD'),
              endDate: values.dates?.[1]?.format('YYYY-MM-DD'),
              operatorName: values.operatorName?.trim() || undefined,
              keyword: values.keyword?.trim() || undefined
            });
            setFlowPage(1);
          }} initialValues={{
            scope: 'current'
          }} onReset={() => {
                  flowForm.resetFields();
                  setFlowFilters({});
                  setFlowScope('current');
                  setFlowPage(1);
                }} loading={flowQuery.isFetching}>
          <Form.Item name="scope" label="仓库范围"><Select style={{
                width: 160
              }} options={[{
                value: 'current',
                label: '当前仓库'
              }, {
                value: 'all',
                label: '批次全部仓库'
              }]} /></Form.Item>
          <Form.Item name="flowType" label="流水类型"><Select allowClear placeholder="全部类型" style={{
                width: 130
              }} options={Object.entries(FLOW_TYPE_META).map(([value, meta]) => ({
                value: Number(value),
                label: meta.label
              }))} /></Form.Item>
          <Form.Item name="direction" label="数量方向"><Select allowClear placeholder="全部方向" style={{
                width: 130
              }} options={[{
                value: 'in',
                label: '增加（入）'
              }, {
                value: 'out',
                label: '减少（出）'
              }]} /></Form.Item>
          <Form.Item name="dates" label="流水日期"><DatePicker.RangePicker /></Form.Item>
          <Form.Item name="operatorName" label="操作人"><Input allowClear maxLength={100} placeholder="输入操作人" style={{
                width: 140
              }} /></Form.Item>
          <Form.Item name="keyword" label="关键词"><Input allowClear maxLength={100} placeholder="关联单据 / 备注" style={{
                width: 190
              }} /></Form.Item>
        </ProductionListFilters>
        <Table rowKey="flowId" dataSource={flows} loading={flowQuery.isFetching} columnWidthStorageKey="inventory-flows" onReload={() => flowQuery.refetch()} pagination={{
            current: flowPage.value,
            pageSize: flowSize.value,
            total: flowQuery.data?.total ?? 0,
            showSizeChanger: true,
            onChange: (page, size) => {
              setFlowPage(size !== flowSize.value ? 1 : page);
              setFlowSize(size);
            }
          }} locale={{
            emptyText: '暂无符合筛选条件的流水'
          }} toolbarTitle={flowScope.value === 'current' ? `当前仓库：${_recordSnapshot?.warehouseName ?? '-'}` : '批次全部仓库'} columns={[{
            title: '时间',
            dataIndex: 'operatedAt',
            width: 180
          }, {
            title: '类型',
            dataIndex: 'flowType',
            width: 100,
            render: (_, row) => {
              const meta = FLOW_TYPE_META[row.flowType] ?? {
                label: '其他',
                color: 'default'
              };
              return <Tag color={meta.color}>{meta.label}</Tag>;
            }
          }, {
            title: '数量',
            dataIndex: 'quantity',
            width: 130,
            render: (_, row) => <Typography.Text type={row.quantity >= 0 ? 'success' : 'danger'}>
                  {row.quantity >= 0 ? '+' : ''}
                  {row.quantity.toLocaleString()} {row.unit}
                </Typography.Text>
          }, {
            title: '仓库',
            dataIndex: 'warehouseName',
            width: 140
          }, {
            title: '操作人',
            dataIndex: 'operatorName',
            width: 120
          }, {
            title: '关联单据',
            dataIndex: 'orderNo',
            width: 140,
            render: value => value ?? '-'
          }, {
            title: '备注',
            dataIndex: 'remark',
            render: value => value ?? '-'
          }]} />

      </Card>

      {/* 出库 */}
      <Modal class="production-form-dialog" title={`出库：${_recordSnapshot.productName ?? ''}`} open={outboundOpen.value} okText="确认出库" cancelText="取消" confirmLoading={outboundMutation.isPending} onOk={handleOutbound} onCancel={() => {
          setOutboundOpen(false);
          outboundForm.resetFields();
        }} destroyOnClose>
        <Form form={outboundForm} layout="vertical" style={{
            marginTop: 16
          }}>
          <Form.Item name="quantity" label="出库数量" rules={[{
              required: true,
              message: '请输入出库数量'
            }, {
              type: 'number',
              min: 0.01,
              message: '数量必须大于 0'
            }]}>
            <InputNumber style={{
                width: '100%'
              }} min={0.01} precision={2} placeholder={`当前库存 ${_recordSnapshot.currentQty}${_recordSnapshot.unit}`} />
          </Form.Item>
          <Form.Item name="orderNo" label="关联单据号">
            <Input placeholder="如销售订单号 SO20260602（可选）" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可填写承运车辆、收货方等" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 调拨 */}
      <Modal class="production-form-dialog" title={`调拨：${_recordSnapshot.productName ?? ''}`} open={transferOpen.value} okText="确认调拨" cancelText="取消" confirmLoading={transferMutation.isPending} onOk={handleTransfer} onCancel={() => {
          setTransferOpen(false);
          transferForm.resetFields();
        }} destroyOnClose>
        <Form form={transferForm} layout="vertical" style={{
            marginTop: 16
          }} initialValues={{
            quantity: _recordSnapshot.currentQty
          }}>
          <Form.Item name="targetWarehouse" label="目标仓库" rules={[{
              required: true,
              message: '请选择目标仓库'
            }]}>
            <Select options={WAREHOUSE_OPTIONS.filter(option => option.value !== _recordSnapshot.warehouseName)} placeholder="请选择目标仓库" />
          </Form.Item>
          <Form.Item name="quantity" label="调拨数量" rules={[{
              required: true,
              message: '请输入调拨数量'
            }]}>
            <InputNumber style={{
                width: '100%'
              }} min={0.01} precision={2} />
          </Form.Item>
          <Form.Item name="locationCode" label="目标库位">
            <Input placeholder="如 B-02-01（可选）" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="可填写调拨原因" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal class="production-form-dialog" title="编辑库存资料" open={editOpen.value} onCancel={() => setEditOpen(false)} confirmLoading={editMutation.isPending} onOk={() => {
          editForm.validateFields().then(values => editMutation.mutate(values)).catch(() => undefined);
        }} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="safeQty" label="安全库存" rules={[{
              required: true
            }, {
              type: 'number',
              min: 0
            }]}><InputNumber min={0} precision={2} style={{
                width: '100%'
              }} /></Form.Item>
          <Form.Item name="locationCode" label="库位编号"><Input maxLength={64} /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>;
    };
  }
});
export default InventoryDetail;
