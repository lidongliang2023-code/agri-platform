import ProductionListFilters from '@/vue/business/components/ProductionListFilters';
import { defineComponent, shallowRef, computed, watch, onMounted } from 'vue';
import '@/components/ProductionDetailCompact.css';
import '@/pages/user/harvests/harvests.css';
import ExpiredDisposal from './ExpiredDisposal';
import Table from '@/vue/business/components/BusinessRecordList';
import { useNavigate, useParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { Alert as AntAlert, Button, Empty, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Progress, Select, Skeleton, Space, Tag, Typography, message } from '@/vue/ui';
import { ExportOutlined, LockOutlined, SwapOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import useFarmStore from '@/vue/farmStore';
import useAuthStore from '@/vue/authStore';
import { requireInventorySource } from '@/pages/user/harvests/inventoryHelpers';
import {
  DetailInfoGrid,
  DetailMetricGrid,
  DetailRelatedDocs,
  DetailSection,
  DetailTimeline,
  ProductionDetailLayout,
  type DetailRelatedDocItem,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@/vue/business/components/index';
import { outboundInventory, queryInventoryFlows, queryInventoryRecord, toggleInventoryFreeze, updateInventory, transferInventoryRecord } from '@/api/harvests';
import type { InventoryFlowParams } from '@/api/harvests';
import type { InventoryRecord } from '@/types';
import { asApiRequestError, httpStatusOf } from '@/utils/request';
import { GRADE_COLOR_MAP, GRADE_LABEL_MAP, INVENTORY_HEALTH_META, WAREHOUSE_OPTIONS, resolveInventoryHealth, inventoryExpiryState } from '@/types';

const FLOW_TYPE_META: Record<number, { label: string; color: string }> = {
  1: { label: '入库', color: 'green' },
  2: { label: '出库', color: 'blue' },
  3: { label: '调拨', color: 'geekblue' },
  4: { label: '报损', color: 'red' },
};

interface OutboundFormValues {
  quantity?: number;
  orderNo?: string;
  remark?: string;
}

interface TransferFormValues {
  targetWarehouse?: string;
  quantity?: number;
  locationCode?: string;
  remark?: string;
}

const InventoryDetail = defineComponent({
  name: 'InventoryDetail',
  props: {},
  setup() {
    const _params = useParams<{ inventoryId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const currentFarm = useFarmStore(state => state.currentFarm);
    const subjectId = useAuthStore(state => state.userInfo?.tenantId);
    const activeTab = shallowRef<string>('overview');
    const flowFilters = shallowRef<Omit<InventoryFlowParams, 'pageNum' | 'pageSize'>>({});
    const flowScope = shallowRef('current');
    const [flowForm] = Form.useForm();
    const flowPage = shallowRef(1);
    const flowSize = shallowRef(10);
    const editOpen = shallowRef(false);
    const [editForm] = Form.useForm<{ safeQty: number; locationCode?: string; remark?: string }>();
    const outboundOpen = shallowRef<boolean>(false);
    const transferOpen = shallowRef<boolean>(false);
    const [outboundForm] = Form.useForm<OutboundFormValues>();
    const [transferForm] = Form.useForm<TransferFormValues>();

    onMounted(() => {
      watch(
        () => [_params.inventoryId, subjectId.value],
        () => {
          activeTab.value = 'overview';
          flowFilters.value = {};
          flowScope.value = 'current';
          flowForm.resetFields();
          flowPage.value = 1;
          outboundOpen.value = false;
          transferOpen.value = false;
          editOpen.value = false;
        },
        { immediate: true, flush: 'post' },
      );
    });

    const detailQuery = useQuery(() => ({
      queryKey: ['production-inventory', 'detail', subjectId.value, _params.inventoryId],
      enabled: Boolean(_params.inventoryId),
      queryFn: () => queryInventoryRecord(_params.inventoryId as string),
    }));
    const record = computed<InventoryRecord | undefined>(() => detailQuery.data);

    const flowQuery = useQuery(() => ({
      queryKey: ['production-inventory', 'flows', subjectId.value, record.value?.batchId, _params.inventoryId, flowScope.value, flowFilters.value, flowPage.value, flowSize.value],
      enabled: Boolean(record.value?.batchId),
      queryFn: () =>
        queryInventoryFlows(record.value?.batchId as string, {
          ...flowFilters.value,
          inventoryId: flowScope.value === 'current' ? _params.inventoryId : undefined,
          pageNum: flowPage.value,
          pageSize: flowSize.value,
        }),
    }));

    const invalidateAll = (): Promise<void> =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production-inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['production-harvests'] }),
      ]).then(() => undefined);

    const outboundMutation = useMutation(() => ({
      mutationFn: async (payload: { batchId: string; quantity: number; orderNo?: string; remark?: string }) => {
        if (!record.value) throw new Error('库存记录不存在');
        await requireInventorySource(record.value);
        return outboundInventory(payload.batchId, { ...payload, inventoryId: record.value.inventoryId });
      },
      onSuccess: () => {
        message.success('出库成功');
        outboundOpen.value = false;
        outboundForm.resetFields();
        void invalidateAll();
      },
      onError: error => message.error(error.message || '出库失败，请稍后重试', 6),
    }));

    const transferMutation = useMutation(() => ({
      mutationFn: (payload: { batchId: string; targetWarehouse: string; quantity: number; locationCode?: string; remark?: string }) => {
        const sourceRecord = record.value;
        if (!sourceRecord) throw new Error('库存记录不存在');
        return requireInventorySource(sourceRecord).then(() =>
          transferInventoryRecord({ ...payload, inventoryId: sourceRecord.inventoryId }),
        );
      },
      onSuccess: () => {
        message.success('调拨成功');
        transferOpen.value = false;
        transferForm.resetFields();
        void invalidateAll();
      },
      onError: error => message.error(error.message || '调拨失败，请稍后重试', 6),
    }));

    const freezeMutation = useMutation(() => ({
      mutationFn: async (payload: { batchId: string; frozen: boolean }) => {
        if (!record.value) throw new Error('库存记录不存在');
        await requireInventorySource(record.value);
        return toggleInventoryFreeze(payload.batchId, payload.frozen, record.value.inventoryId);
      },
      onSuccess: (_result, payload) => {
        message.success(payload.frozen ? '库存已冻结' : '库存已解冻');
        void invalidateAll();
      },
      onError: error => message.error(error.message || '操作失败，请稍后重试', 6),
    }));

    const editMutation = useMutation(() => ({
      mutationFn: (values: { safeQty: number; locationCode?: string; remark?: string }) => updateInventory(_params.inventoryId!, values),
      onSuccess: () => {
        message.success('库存资料已更新');
        editOpen.value = false;
        void invalidateAll();
      },
      onError: error => message.error(error.message || '保存失败'),
    }));

    const handleOutbound = (): void => {
      const _recordAtStart = record.value;
      if (!_recordAtStart) return;
      if (inventoryExpiryState(_recordAtStart.expireDate) === 'expired' || _recordAtStart.healthStatus === 'expired') {
        message.warning('库存已过期，禁止出库，请先核查并按损耗流程处置');
        return;
      }
      outboundForm
        .validateFields()
        .then(values => {
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
            remark: values.remark,
          });
        })
        .catch(() => undefined);
    };

    const handleTransfer = (): void => {
      const _recordAtStart2 = record.value;
      if (!_recordAtStart2) return;
      transferForm
        .validateFields()
        .then(values => {
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
            remark: values.remark,
          });
        })
        .catch(() => undefined);
    };

    return () => {
      const _recordSnapshot = record.value;
      if (detailQuery.isLoading) {
        return (
          <ProductionDetailLayout class="harvest-business-page production-detail-compact" title="库存详情" hasAside={false} onBack={() => navigate('/production/harvests/inventory')}>
            <DetailSection>
              <Skeleton active paragraph={{ rows: 8 }} />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      if (detailQuery.isError || !_recordSnapshot) {
        return (
          <ProductionDetailLayout class="harvest-business-page production-detail-compact" title="库存详情" hasAside={false} onBack={() => navigate('/production/harvests/inventory')}>
            <DetailSection>
              <Empty
                description={
                  <Space direction="vertical">
                    <Typography.Text type="danger">未查询到该库存记录，请返回列表重试</Typography.Text>
                    <Button onClick={() => navigate('/production/harvests/inventory')}>返回库存管理</Button>
                  </Space>
                }
              />
            </DetailSection>
          </ProductionDetailLayout>
        );
      }

      const health = (
        inventoryExpiryState(_recordSnapshot.expireDate) === 'expired'
          ? 'expired'
          : _recordSnapshot.healthStatus ??
            resolveInventoryHealth(_recordSnapshot.currentQty, _recordSnapshot.safeQty ?? 0, _recordSnapshot.expireDate)
      ) as keyof typeof INVENTORY_HEALTH_META;
      const healthMeta = INVENTORY_HEALTH_META[health] ?? INVENTORY_HEALTH_META.normal;
      const flows = flowQuery.data?.list ?? [];
      const flowTotal = flowQuery.data?.total;
      const availableQty = _recordSnapshot.frozen ? 0 : Math.max(0, _recordSnapshot.currentQty - (_recordSnapshot.frozenQty ?? 0));

      const flowErrorMessage: string = (() => {
        const error = flowQuery.error as unknown;
        if (!error) return '未知原因';
        const apiError = asApiRequestError(error);
        if (apiError) return `后端返回业务码 ${apiError.bizCode}（${apiError.message || '无提示'}）`;
        const status = httpStatusOf(error);
        if (status === 0) return `无法连接到服务端（${(error as Error)?.message ?? '网络异常'}）`;
        return `HTTP ${status}（${(error as Error)?.message ?? '未知原因'}）`;
      })();

      const safePercent =
        _recordSnapshot.safeQty && _recordSnapshot.safeQty > 0
          ? Math.min(100, Math.round((_recordSnapshot.currentQty / (_recordSnapshot.safeQty * 2)) * 100))
          : 100;

      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '库存详情' },
        { key: 'flows', label: '出入库流水', count: flowTotal ?? null },
      ];

      const progressSteps: DetailTimelineStep[] = [
        {
          key: 'in',
          title: '采收入库登记',
          time: _recordSnapshot.lastInAt ? dayjs(_recordSnapshot.lastInAt).format('YYYY-MM-DD') : undefined,
          description: `存放仓库：${_recordSnapshot.warehouseName || '—'}`,
          state: 'done',
        },
        {
          key: 'stock',
          title: _recordSnapshot.frozen ? '库存已冻结' : `当前健康状态 · ${healthMeta.label}`,
          description: `可用 ${availableQty.toLocaleString()} ${_recordSnapshot.unit} / 安全线 ${(_recordSnapshot.safeQty ?? 0).toLocaleString()} ${_recordSnapshot.unit}`,
          state: _recordSnapshot.frozen || health === 'expired' || health === 'shortage' ? 'error' : health === 'warning' ? 'current' : 'done',
        },
        {
          key: 'out',
          title: _recordSnapshot.lastOutAt ? '最近出库流转' : '待出库流转',
          time: _recordSnapshot.lastOutAt ? dayjs(_recordSnapshot.lastOutAt).format('YYYY-MM-DD') : undefined,
          description: _recordSnapshot.lastOutAt ? `累计流水 ${flowTotal ?? flows.length} 条` : '可通过右上角发起出库或调拨',
          state: _recordSnapshot.lastOutAt ? 'done' : 'pending',
        },
        {
          key: 'expiry',
          title: '保质期节点',
          time: _recordSnapshot.expireDate || '未登记',
          description: health === 'expired' ? '已过期，禁止继续出库' : '效期内正常流转',
          state: health === 'expired' ? 'error' : 'pending',
        },
      ];

      const relatedDocs: DetailRelatedDocItem[] = [
        {
          key: 'harvest',
          label: '关联采收批次',
          code: _recordSnapshot.relatedBatchNo ?? _recordSnapshot.batchNo ?? _recordSnapshot.batchId ?? undefined,
          emptyText: '未关联采收',
          onClick: _recordSnapshot.batchId ? () => navigate(`/production/harvests/${_recordSnapshot.batchId}`) : undefined,
        },
        {
          key: 'warehouse',
          label: '当前仓库',
          text: _recordSnapshot.warehouseName || undefined,
          emptyText: '未指定',
          mono: false,
        },
        {
          key: 'location',
          label: '库位编号',
          code: _recordSnapshot.locationCode || undefined,
          emptyText: '未分配库位',
        },
        {
          key: 'inventoryList',
          label: '库存台账',
          text: '返回库存列表',
          mono: false,
          onClick: () => navigate('/production/harvests/inventory'),
        },
      ];

      const flowColumns = [
        { title: '时间', dataIndex: 'operatedAt', width: 170 },
        {
          title: '类型',
          dataIndex: 'flowType',
          width: 90,
          render: (_: unknown, row: { flowType: number }) => {
            const meta = FLOW_TYPE_META[row.flowType] ?? { label: '其他', color: 'default' };
            return <Tag color={meta.color}>{meta.label}</Tag>;
          },
        },
        {
          title: '数量',
          dataIndex: 'quantity',
          width: 130,
          render: (_: unknown, row: { quantity: number; unit: string }) => (
            <Typography.Text class="detail-info-mono" type={row.quantity >= 0 ? 'success' : 'danger'}>
              {row.quantity >= 0 ? '+' : ''}
              {row.quantity.toLocaleString()} {row.unit}
            </Typography.Text>
          ),
        },
        { title: '仓库', dataIndex: 'warehouseName', width: 130 },
        { title: '操作人', dataIndex: 'operatorName', width: 110 },
        { title: '关联单据', dataIndex: 'orderNo', width: 140, render: (value: string) => <span class="detail-info-mono">{value ?? '—'}</span> },
        { title: '备注', dataIndex: 'remark', render: (value: string) => value ?? '—' },
      ];

      return (
        <ProductionDetailLayout
          class="harvest-business-page production-detail-compact"
          code={_recordSnapshot.inventoryId}
          title={`${_recordSnapshot.productName ?? '库存'}${_recordSnapshot.grade ? `（${GRADE_LABEL_MAP[_recordSnapshot.grade] ?? _recordSnapshot.grade}）` : ''}`}
          status={{ label: healthMeta.label, tone: healthMeta.color }}
          extraStatuses={_recordSnapshot.frozen ? [{ label: '已冻结', tone: 'red' }] : []}
          meta={[
            { label: '仓库', value: _recordSnapshot.warehouseName || '—' },
            { label: '农场', value: currentFarm.value?.farmName || '—' },
            { label: '入库日期', value: _recordSnapshot.lastInAt ? dayjs(_recordSnapshot.lastInAt).format('YYYY-MM-DD') : '—' },
          ]}
          tabs={tabs}
          activeTab={activeTab.value}
          backLabel="返回库存管理"
          onBack={() => navigate('/production/harvests/inventory')}
          onTabChange={key => {
            activeTab.value = key;
          }}
          actions={
            /* 次要 → 危险 → 主要 */
            <>
              <Button
                onClick={() => {
                  editForm.setFieldsValue({
                    safeQty: _recordSnapshot.safeQty ?? 0,
                    locationCode: _recordSnapshot.locationCode,
                    remark: _recordSnapshot.remark,
                  });
                  editOpen.value = true;
                }}
              >
                编辑资料
              </Button>
              <Button
                disabled={Boolean(_recordSnapshot.frozen) || !(_recordSnapshot.currentQty > (_recordSnapshot.frozenQty ?? 0))}
                icon={<SwapOutlined />}
                loading={transferMutation.isPending}
                onClick={() => {
                  transferOpen.value = true;
                }}
              >
                调拨
              </Button>
              <ExpiredDisposal record={_recordSnapshot} onDone={invalidateAll} />
              {_recordSnapshot.frozen ? (
                <Popconfirm
                  title="确认解冻当前仓库库存？"
                  onConfirm={() => freezeMutation.mutate({ batchId: _recordSnapshot.batchId, frozen: false })}
                >
                  <Button>解冻</Button>
                </Popconfirm>
              ) : (
                <Popconfirm
                  title="确认冻结该库存？"
                  description="冻结后不可出库，请先解冻。"
                  okText="确认冻结"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => freezeMutation.mutate({ batchId: _recordSnapshot.batchId, frozen: true })}
                >
                  <Button danger icon={<LockOutlined />}>
                    冻结
                  </Button>
                </Popconfirm>
              )}
              <Button
                type="primary"
                icon={<ExportOutlined />}
                title={health === 'expired' ? '库存已过期，禁止出库' : undefined}
                disabled={health === 'expired' || Boolean(_recordSnapshot.frozen) || !(_recordSnapshot.currentQty > (_recordSnapshot.frozenQty ?? 0))}
                loading={outboundMutation.isPending}
                onClick={() => {
                  outboundOpen.value = true;
                }}
              >
                出库
              </Button>
            </>
          }
          aside={
            <>
              <DetailSection title="库存流转进度">
                <DetailTimeline items={progressSteps} />
              </DetailSection>
              <DetailSection title="关联单据与仓储">
                <DetailRelatedDocs items={relatedDocs} />
              </DetailSection>
            </>
          }
        >
          {activeTab.value === 'overview' && (
            <>
              <DetailSection title="库存概览指标">
                <DetailMetricGrid
                  items={[
                    {
                      key: 'current',
                      title: '当前库存',
                      value: _recordSnapshot.currentQty,
                      precision: 2,
                      suffix: _recordSnapshot.unit,
                      valueStyle: { color: '#2d8f4e' },
                    },
                    {
                      key: 'safe',
                      title: '安全库存',
                      value: _recordSnapshot.safeQty ?? 0,
                      suffix: _recordSnapshot.unit,
                    },
                    {
                      key: 'available',
                      title: '可用库存',
                      value: availableQty,
                      precision: 2,
                      suffix: _recordSnapshot.unit,
                      valueStyle: { color: '#1677ff' },
                    },
                    {
                      key: 'loss',
                      title: '累计损耗',
                      value: _recordSnapshot.lossQty ?? 0,
                      suffix: _recordSnapshot.unit,
                    },
                  ]}
                />
                <Progress
                  style={{ marginTop: 14, maxWidth: 520 }}
                  percent={safePercent}
                  strokeColor={health === 'shortage' || health === 'expired' ? '#ff4d4f' : health === 'warning' ? '#fa8c16' : '#2d8f4e'}
                  status={health === 'shortage' ? 'exception' : health === 'warning' ? 'active' : 'success'}
                  format={() => `库存水位 ${_recordSnapshot.currentQty}/${(_recordSnapshot.safeQty ?? 0) * 2}`}
                />
              </DetailSection>

              <DetailSection title="基本信息">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    { key: 'inventoryId', label: '库存编号', value: _recordSnapshot.inventoryId, mono: true },
                    {
                      key: 'product',
                      label: '品名等级',
                      value: (
                        <Space size={6}>
                          <span>{_recordSnapshot.productName ?? '—'}</span>
                          {_recordSnapshot.grade ? (
                            <Tag color={GRADE_COLOR_MAP[_recordSnapshot.grade] ?? 'default'}>
                              {GRADE_LABEL_MAP[_recordSnapshot.grade] ?? _recordSnapshot.grade}
                            </Tag>
                          ) : null}
                        </Space>
                      ),
                    },
                    { key: 'warehouse', label: '存放仓库', value: _recordSnapshot.warehouseName },
                    { key: 'locationCode', label: '库位编号', value: _recordSnapshot.locationCode ?? '—', mono: true },
                    { key: 'batchNo', label: '批次号', value: _recordSnapshot.batchNo ?? '—', mono: true },
                    {
                      key: 'relatedHarvest',
                      label: '关联采收',
                      value: _recordSnapshot.batchId ? (
                        <Typography.Link class="detail-info-mono" onClick={() => navigate(`/production/harvests/${_recordSnapshot.batchId}`)}>
                          {_recordSnapshot.relatedBatchNo ?? _recordSnapshot.batchNo ?? _recordSnapshot.batchId}
                        </Typography.Link>
                      ) : (
                        _recordSnapshot.relatedBatchNo ?? '—'
                      ),
                    },
                  ]}
                />
              </DetailSection>

              <DetailSection title="数量与效期">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    { key: 'currentQty', label: '当前库存', value: `${_recordSnapshot.currentQty?.toLocaleString() ?? '—'} ${_recordSnapshot.unit}`, mono: true },
                    { key: 'safeQty', label: '安全库存', value: `${(_recordSnapshot.safeQty ?? 0).toLocaleString()} ${_recordSnapshot.unit}`, mono: true },
                    { key: 'frozenQty', label: '冻结数量', value: `${(_recordSnapshot.frozenQty ?? 0).toLocaleString()} ${_recordSnapshot.unit}`, mono: true },
                    { key: 'lastInAt', label: '入库日期', value: _recordSnapshot.lastInAt ? dayjs(_recordSnapshot.lastInAt).format('YYYY-MM-DD') : '—', mono: true },
                    { key: 'lastOutAt', label: '最近出库', value: _recordSnapshot.lastOutAt ? dayjs(_recordSnapshot.lastOutAt).format('YYYY-MM-DD') : '—', mono: true },
                    { key: 'expireDate', label: '保质期至', value: _recordSnapshot.expireDate ?? '—', mono: true },
                    { key: 'remark', label: '备注', fullWidth: true, value: _recordSnapshot.remark ?? '—' },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="近期出入库流水"
                flush={!flowQuery.isError && flows.length > 0}
                extra={
                  <Typography.Link onClick={() => { activeTab.value = 'flows'; }}>
                    查看全部{flowTotal != null ? ` ${flowTotal} 项` : '与筛选'}
                  </Typography.Link>
                }
              >
                {flowQuery.isError ? (
                  <AntAlert
                    banner
                    showIcon
                    type="error"
                    message={`出入库流水未取到：${flowErrorMessage}`}
                    action={<Button size="small" onClick={() => void flowQuery.refetch()}>重新加载</Button>}
                  />
                ) : flows.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无出入库流水" />
                ) : (
                  <Table
                    rowKey="flowId"
                    dataSource={flows.slice(0, 5)}
                    loading={flowQuery.isFetching}
                    pagination={false}
                    columns={flowColumns}
                  />
                )}
              </DetailSection>
            </>
          )}

          {activeTab.value === 'flows' && (
            <DetailSection title={`批次出入库流水（${flowTotal ?? '—'} 条）`}>
              {flowQuery.isError && (
                <AntAlert
                  banner
                  showIcon
                  type="error"
                  style={{ marginBottom: 16 }}
                  message={`出入库流水未取到：${flowErrorMessage}`}
                  action={<Button onClick={() => void flowQuery.refetch()}>重新加载</Button>}
                />
              )}
              <ProductionListFilters
                form={flowForm}
                style={{ gap: 12, marginBottom: 16 }}
                onFinish={values => {
                  flowScope.value = values.scope ?? 'current';
                  flowFilters.value = {
                    flowType: values.flowType,
                    direction: values.direction,
                    startDate: values.dates?.[0]?.format('YYYY-MM-DD'),
                    endDate: values.dates?.[1]?.format('YYYY-MM-DD'),
                    operatorName: values.operatorName?.trim() || undefined,
                    keyword: values.keyword?.trim() || undefined,
                  };
                  flowPage.value = 1;
                }}
                initialValues={{ scope: 'current' }}
                onReset={() => {
                  flowForm.resetFields();
                  flowFilters.value = {};
                  flowScope.value = 'current';
                  flowPage.value = 1;
                }}
                loading={flowQuery.isFetching}
              >
                <Form.Item name="scope" label="仓库范围">
                  <Select
                    style={{ width: 160 }}
                    options={[
                      { value: 'current', label: '当前仓库' },
                      { value: 'all', label: '批次全部仓库' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="flowType" label="流水类型">
                  <Select
                    allowClear
                    placeholder="全部类型"
                    style={{ width: 130 }}
                    options={Object.entries(FLOW_TYPE_META).map(([value, meta]) => ({
                      value: Number(value),
                      label: meta.label,
                    }))}
                  />
                </Form.Item>
                <Form.Item name="direction" label="数量方向">
                  <Select
                    allowClear
                    placeholder="全部方向"
                    style={{ width: 130 }}
                    options={[
                      { value: 'in', label: '增加（入）' },
                      { value: 'out', label: '减少（出）' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="dates" label="流水日期">
                  <DatePicker.RangePicker />
                </Form.Item>
                <Form.Item name="operatorName" label="操作人">
                  <Input allowClear maxLength={100} placeholder="输入操作人" style={{ width: 140 }} />
                </Form.Item>
                <Form.Item name="keyword" label="关键词">
                  <Input allowClear maxLength={100} placeholder="关联单据 / 备注" style={{ width: 190 }} />
                </Form.Item>
              </ProductionListFilters>
              <Table
                rowKey="flowId"
                dataSource={flows}
                loading={flowQuery.isFetching}
                columnWidthStorageKey="inventory-flows"
                onReload={() => flowQuery.refetch()}
                pagination={{
                  current: flowPage.value,
                  pageSize: flowSize.value,
                  total: flowTotal ?? 0,
                  showSizeChanger: true,
                  onChange: (page, size) => {
                    flowPage.value = size !== flowSize.value ? 1 : page;
                    flowSize.value = size;
                  },
                }}
                locale={{ emptyText: '暂无符合筛选条件的流水' }}
                toolbarTitle={flowScope.value === 'current' ? `当前仓库：${_recordSnapshot.warehouseName ?? '—'}` : '批次全部仓库'}
                columns={flowColumns}
              />
            </DetailSection>
          )}

          <Modal
            class="production-form-dialog"
            title={`出库：${_recordSnapshot.productName ?? ''}`}
            open={outboundOpen.value}
            okText="确认出库"
            cancelText="取消"
            confirmLoading={outboundMutation.isPending}
            onOk={handleOutbound}
            onCancel={() => {
              outboundOpen.value = false;
              outboundForm.resetFields();
            }}
            destroyOnClose
          >
            <Form form={outboundForm} layout="vertical" style={{ marginTop: 16 }}>
              <Form.Item
                name="quantity"
                label="出库数量"
                rules={[
                  { required: true, message: '请输入出库数量' },
                  { type: 'number', min: 0.01, message: '数量必须大于 0' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.01}
                  precision={2}
                  placeholder={`当前库存 ${_recordSnapshot.currentQty}${_recordSnapshot.unit}`}
                />
              </Form.Item>
              <Form.Item name="orderNo" label="关联单据号">
                <Input placeholder="如销售订单号 SO20260602（可选）" />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={3} placeholder="可填写承运车辆、收货方等" />
              </Form.Item>
            </Form>
          </Modal>

          <Modal
            class="production-form-dialog"
            title={`调拨：${_recordSnapshot.productName ?? ''}`}
            open={transferOpen.value}
            okText="确认调拨"
            cancelText="取消"
            confirmLoading={transferMutation.isPending}
            onOk={handleTransfer}
            onCancel={() => {
              transferOpen.value = false;
              transferForm.resetFields();
            }}
            destroyOnClose
          >
            <Form form={transferForm} layout="vertical" style={{ marginTop: 16 }} initialValues={{ quantity: _recordSnapshot.currentQty }}>
              <Form.Item name="targetWarehouse" label="目标仓库" rules={[{ required: true, message: '请选择目标仓库' }]}>
                <Select
                  options={WAREHOUSE_OPTIONS.filter(option => option.value !== _recordSnapshot.warehouseName)}
                  placeholder="请选择目标仓库"
                />
              </Form.Item>
              <Form.Item name="quantity" label="调拨数量" rules={[{ required: true, message: '请输入调拨数量' }]}>
                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
              </Form.Item>
              <Form.Item name="locationCode" label="目标库位">
                <Input placeholder="如 B-02-01（可选）" />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} placeholder="可填写调拨原因" />
              </Form.Item>
            </Form>
          </Modal>

          <Modal
            class="production-form-dialog"
            title="编辑库存资料"
            open={editOpen.value}
            onCancel={() => { editOpen.value = false; }}
            confirmLoading={editMutation.isPending}
            onOk={() => {
              editForm.validateFields().then(values => editMutation.mutate(values)).catch(() => undefined);
            }}
            destroyOnClose
          >
            <Form form={editForm} layout="vertical">
              <Form.Item name="safeQty" label="安全库存" rules={[{ required: true }, { type: 'number', min: 0 }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="locationCode" label="库位编号">
                <Input maxLength={64} />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={3} maxLength={500} showCount />
              </Form.Item>
            </Form>
          </Modal>
        </ProductionDetailLayout>
      );
    };
  },
});

export default InventoryDetail;
