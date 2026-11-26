import { Popover as ListSummary } from '@/vue/ui';
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
import ListRowActions from '@/vue/business/components/ListRowActions';
import '@/components/ProductionDetailCompact.css';
import '@/components/ProductionListDense.css';
import Card from '@/vue/business/components/SectionCard';
import '@/pages/user/harvests/harvests.css';
import ExpiredDisposal from './ExpiredDisposal';
import ProTable from '@/vue/ProductionRequestTable';
/**
 * 页面名称：库存管理
 * 路由路径：/production/harvests/inventory
 * 所属模块：采收与库存管理
 * 原型 pageId：P16 inventory
 *
 * 还原要点：
 * - 标题「🏪 库存管理」+ 新增库存按钮
 * - 筛选器：全部仓库 / 全部品类 / 全部状态
 * - 告警条：库存不足与临期预警汇总
 * - 表格列：库存编号 | 品名 | 仓库 | 当前库存 | 安全库存 | 批次 | 入库日期 | 保质期至 | 状态 | 操作
 * - 状态标签：正常 / 预警 / 不足 / 临期
 * - 出入库操作：入库、出库、损耗登记、冻结 / 解冻（HARV-05 / HARV-06 / HARV-09）
 */

import { useNavigate } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { PageContainer } from '@/vue/pro';
import type { ProColumns } from '@/vue/pro';
import { Button, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tag, Tooltip, Typography, message } from '@/vue/ui';
import { LockOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import useAuthStore from '@/vue/authStore';
import { loadInventoryPages, quantitySummary, requireInventorySource } from '@/pages/user/harvests/inventoryHelpers';
import { MetricText } from '@/vue/business/components/index';
import { inboundInventory, outboundInventory, queryInventory, registerLoss, toggleInventoryFreeze } from '@/api/harvests';
import type { InventoryRecord } from '@/types';
import { INVENTORY_HEALTH_META, INVENTORY_HEALTH_OPTIONS, LOSS_REASON_OPTIONS, WAREHOUSE_OPTIONS, resolveInventoryHealth, inventoryExpiryState } from '@/types';

/** 列表筛选条件 */
interface InventoryFilters {
  /** 仓库名称 */
  warehouseName?: string;
  keyword?: string;
  batchNo?: string;
  /** 品类 */
  category?: string;
  /** 库存健康状态 */
  healthStatus?: string;
}

/** 出入库操作类型 */
type StockAction = 'in' | 'out' | 'loss';

/** 出入库弹窗表单值 */
interface StockFormValues {
  /** 变动数量 */
  quantity?: number;
  /** 关联单据号（出库） */
  orderNo?: string;
  /** 损耗原因（损耗登记） */
  reason?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 库存管理页面
 *
 * 业务职责：成品库存台账，支持预警提示、条件筛选、出入库与损耗登记、冻结解冻。
 *
 * @returns 页面内容
 */
const InventoryManage = defineComponent({
  name: "InventoryManage",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const subjectId = useAuthStore(state => state.userInfo?.tenantId);
    const operatorName = useAuthStore(state => state.userInfo?.realName || state.userInfo?.username);
    const pageNum = shallowRef<number>(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef<number>(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const filters = shallowRef<InventoryFilters>({});
    const setFilters = (next: typeof filters.value | ((previous: typeof filters.value) => typeof filters.value)) => {
      filters.value = typeof next === 'function' ? (next as (previous: typeof filters.value) => typeof filters.value)(filters.value) : next;
    };
    const selectedKeys = shallowRef<string[]>([]);
    const setSelectedKeys = (next: typeof selectedKeys.value | ((previous: typeof selectedKeys.value) => typeof selectedKeys.value)) => {
      selectedKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedKeys.value) => typeof selectedKeys.value)(selectedKeys.value) : next;
    };
    const [filterForm] = Form.useForm<InventoryFilters>();
    const action = shallowRef<StockAction | null>(null);
    const setAction = (next: typeof action.value | ((previous: typeof action.value) => typeof action.value)) => {
      action.value = typeof next === 'function' ? (next as (previous: typeof action.value) => typeof action.value)(action.value) : next;
    };
    const actionTarget = shallowRef<InventoryRecord | null>(null);
    const setActionTarget = (next: typeof actionTarget.value | ((previous: typeof actionTarget.value) => typeof actionTarget.value)) => {
      actionTarget.value = typeof next === 'function' ? (next as (previous: typeof actionTarget.value) => typeof actionTarget.value)(actionTarget.value) : next;
    };
    const [stockForm] = Form.useForm<StockFormValues>();
    onMounted(() => {
      watch(() => [subjectId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setPageNum(1);
          setSelectedKeys([]);
          closeAction();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });

    /** 库存列表：接口范围为当前经营主体，不依赖顶部农场。 */
    const listQuery = useQuery(() => ({
      queryKey: ['production-inventory', 'list', subjectId.value, filters.value],
      enabled: Boolean(subjectId.value),
      queryFn: () => loadInventoryPages(pageNum => queryInventory({
        ...filters.value,
        pageNum,
        pageSize: 200
      }))
    }));

    /** 统一失效刷新 */
    const invalidateInventory = (): Promise<void> => Promise.all([queryClient.invalidateQueries({
      queryKey: ['production-inventory']
    }), queryClient.invalidateQueries({
      queryKey: ['production-harvests']
    })]).then(() => undefined);

    /** 入库 */
    const inboundMutation = useMutation(() => ({
      mutationFn: (payload: {
        inventoryId: string;
        batchId: string;
        quantity: number;
        remark?: string;
        warehouseName?: string;
      }) => inboundInventory(payload.batchId, {
        quantity: payload.quantity,
        remark: payload.remark,
        operatorName: operatorName.value,
        warehouseName: payload.warehouseName
      }),
      onSuccess: () => {
        message.success('入库成功，库存流水已生成');
        closeAction();
        void invalidateInventory();
      },
      onError: error => message.error(error.message || '入库失败，请稍后重试', 6)
    }));

    /** 出库 */
    const outboundMutation = useMutation(() => ({
      mutationFn: (payload: {
        inventoryId: string;
        batchId: string;
        quantity: number;
        orderNo?: string;
        remark?: string;
      }) => outboundInventory(payload.batchId, payload),
      onSuccess: () => {
        message.success('出库成功，库存流水已生成');
        closeAction();
        void invalidateInventory();
      },
      onError: error => message.error(error.message || '出库失败，请稍后重试', 6)
    }));

    /** 损耗登记 */
    const lossMutation = useMutation(() => ({
      mutationFn: (payload: {
        inventoryId: string;
        batchId: string;
        quantity: number;
        reason: string;
        remark?: string;
      }) => registerLoss({
        ...payload,
        operatorName: operatorName.value
      }),
      onSuccess: () => {
        message.success('损耗登记成功');
        closeAction();
        void invalidateInventory();
      },
      onError: error => message.error(error.message || '损耗登记失败，请稍后重试', 6)
    }));

    /** 冻结 / 解冻 */
    const freezeMutation = useMutation(() => ({
      mutationFn: async (payload: {
        inventoryId: string;
        batchId: string;
        frozen: boolean;
      }) => {
        const record = rows.value.find(row => String(row.inventoryId) === String(payload.inventoryId));
        if (!record) throw new Error('库存记录已变化，请刷新');
        await requireInventorySource(record);
        return toggleInventoryFreeze(payload.batchId, payload.frozen, payload.inventoryId);
      },
      onSuccess: (_result, payload) => {
        message.success(payload.frozen ? '库存已冻结' : '库存已解冻');
        void invalidateInventory();
      },
      onError: error => message.error(error.message || '操作失败，请稍后重试', 6)
    }));

    /** 关闭出入库弹窗 */
    const closeAction = (): void => {
      setAction(null);
      setActionTarget(null);
      stockForm.resetFields();
    };

    /** 打开出入库弹窗 */
    const openAction = (type: StockAction, record: InventoryRecord): void => {
      if (type === 'out' && (inventoryExpiryState(record.expireDate) === 'expired' || record.healthStatus === 'expired')) {
        message.warning('库存已过期，禁止出库，请先核查并按损耗流程处置');
        return;
      }
      if (inboundMutation.isPending || outboundMutation.isPending || lossMutation.isPending) return;
      setAction(type);
      setActionTarget(record);
      stockForm.resetFields();
    };

    /** 提交出入库 */
    const handleStockSubmit = (): void => {
      const _actionTargetAtStart = actionTarget.value;
      if (!_actionTargetAtStart || !action.value) return;
      if (action.value === 'out' && (inventoryExpiryState(_actionTargetAtStart.expireDate) === 'expired' || _actionTargetAtStart.healthStatus === 'expired')) {
        message.warning('库存已过期，禁止出库，请先核查并按损耗流程处置');
        return;
      }
      stockForm.validateFields().then(async values => {
        if (subjectId.value !== useAuthStore.getState().userInfo?.tenantId) throw new Error('经营主体已切换，请重新操作');
        if (action.value !== 'in') await requireInventorySource(_actionTargetAtStart);
        const quantity = values.quantity ?? 0;
        if (quantity <= 0) {
          message.warning('变动数量必须大于 0');
          return;
        }
        if (action.value === 'out' && quantity > Math.max(0, _actionTargetAtStart.currentQty - (_actionTargetAtStart.frozenQty ?? 0))) {
          message.warning(`出库数量不能超过当前库存 ${_actionTargetAtStart.currentQty}${_actionTargetAtStart.unit}`);
          return;
        }
        if (action.value === 'loss' && quantity > Math.max(0, _actionTargetAtStart.currentQty - (_actionTargetAtStart.frozenQty ?? 0))) {
          message.warning(`损耗数量不能超过当前库存 ${_actionTargetAtStart.currentQty}${_actionTargetAtStart.unit}`);
          return;
        }
        if (action.value === 'in') {
          inboundMutation.mutate({
            inventoryId: String(_actionTargetAtStart.inventoryId),
            batchId: _actionTargetAtStart.batchId,
            quantity,
            remark: values.remark,
            warehouseName: _actionTargetAtStart.warehouseName
          });
        } else if (action.value === 'out') {
          outboundMutation.mutate({
            inventoryId: String(_actionTargetAtStart.inventoryId),
            batchId: _actionTargetAtStart.batchId,
            quantity,
            orderNo: values.orderNo,
            remark: values.remark
          });
        } else {
          lossMutation.mutate({
            inventoryId: String(_actionTargetAtStart.inventoryId),
            batchId: _actionTargetAtStart.batchId,
            quantity,
            reason: values.reason ?? '其他',
            remark: values.remark
          });
        }
      }).catch(error => {
        if (!error?.errorFields) message.error(error.message || '请检查表单');
      });
    };
    const rows = computed<InventoryRecord[]>(() => listQuery.data ?? []);

    /**
     * 健康状态兜底计算：后端未返回 healthStatus 时按安全库存 / 保质期推导。
     *
     * 后端没有给出 currentQty 时不做任何推导（禁止拿 0 或随机数顶替），
     * 直接归入 normal —— 该行的数量列会显示「— / 未接入」。
     */
    const healthOf = (record: InventoryRecord): string => {
      if (inventoryExpiryState(record.expireDate) === 'expired') return 'expired';
      if (record.healthStatus) return record.healthStatus;
      if (typeof record.currentQty !== 'number') return 'normal';
      return resolveInventoryHealth(record.currentQty, record.safeQty ?? 0, record.expireDate);
    };

    /** 告警列表：不足与临期库存 */
    const warnings = computed(() => rows.value.filter(item => {
      const health = healthOf(item);
      return health === 'shortage' || health === 'expiring' || health === 'expired';
    }));

    /**
     * 统计概览。
     *
     * 后端未返回数量字段时不补 0、不估算：整列都拿不到数量时统计值显示为「—」，
     * 只有部分行缺失时才对已有值求和（并在页面提示存在未接入字段）。
     */
    const overview = computed(() => {
      const known = rows.value.filter(item => typeof item.currentQty === 'number');
      return {
        totalQty: quantitySummary(rows.value, 'currentQty'),
        frozenQty: quantitySummary(rows.value, 'frozenQty'),
        lossQty: quantitySummary(rows.value, 'lossQty'),
        skuCount: rows.value.filter(row => row.currentQty > 0).length,
        missingQtyCount: rows.value.length - known.length
      };
    });

    /** 品类下拉选项（由当前数据去重生成） */
    const categoryOptions = computed(() => {
      const set = new Set<string>();
      rows.value.forEach(item => {
        if (item.category) set.add(item.category);
      });
      return Array.from(set).map(value => ({
        value,
        label: value
      }));
    });

    /** 查询 / 重置 */
    const handleSearch = (): void => {
      setPageNum(1);
      setFilters(filterForm.getFieldsValue());
      setSelectedKeys([]);
    };
    const handleReset = (): void => {
      filterForm.resetFields();
      setPageNum(1);
      setFilters({});
      setSelectedKeys([]);
    };

    /** 表格列定义（对照原型 P16） */
    const columns = computed<ProColumns<InventoryRecord>[]>(() => [{
      title: '库存编号',
      dataIndex: 'inventoryId',
      width: 110
    }, {
      title: '品名',
      key: 'product',
      width: 160,
      render: (_, record) => <Space size={4}>
          <span>{record.productName ?? '-'}</span>
          {record.frozen ? <Tag color="volcano">冻结</Tag> : null}
        </Space>
    }, {
      title: '仓库',
      dataIndex: 'warehouseName',
      width: 110
    }, {
      title: '当前库存',
      dataIndex: 'currentQty',
      width: 120,
      render: (_, record) => <MetricText value={typeof record.currentQty === 'number' ? record.currentQty : null} suffix={record.unit ? ` ${record.unit}` : ''} missingTip="后端 /harvests/inventory 未返回 currentQty（当前返回的是流水结构），显示为「—」" />
    }, {
      title: '安全库存',
      dataIndex: 'safeQty',
      width: 110,
      render: (_, record) => <MetricText value={typeof record.safeQty === 'number' ? record.safeQty : null} suffix={record.unit ? ` ${record.unit}` : ''} missingTip="后端 /harvests/inventory 未返回 safeQty（当前返回的是流水结构），显示为「—」" />
    }, {
      title: '批次',
      dataIndex: 'batchNo',
      width: 130
    }, {
      title: '入库日期',
      dataIndex: 'lastInAt',
      width: 170,
      render: (_, record) => record.lastInAt ? dayjs(record.lastInAt).format('YYYY-MM-DD') : '-'
    }, {
      title: '保质期至',
      dataIndex: 'expireDate',
      width: 120
    }, {
      title: '状态',
      key: 'health',
      width: 100,
      render: (_, record) => {
        const health = healthOf(record) as keyof typeof INVENTORY_HEALTH_META;
        const meta = INVENTORY_HEALTH_META[health] ?? INVENTORY_HEALTH_META.normal;
        return <Tag color={meta.color}>{meta.label}</Tag>;
      }
    }, {
      title: '操作',
      key: 'option',
      fixed: 'right',
      width: 150,
      valueType: 'option',
      render: (_, record) => {
        const isExpired = inventoryExpiryState(record.expireDate) === 'expired' || record.healthStatus === 'expired';
        const canDispose = isExpired && record.currentQty > 0;
        return <ListRowActions>
            <Typography.Link key="detail" onClick={() => navigate(`/production/harvests/inventory/${record.inventoryId}`)}>
              详情
            </Typography.Link>
            {canDispose ? <ExpiredDisposal key="dispose" record={record} onDone={invalidateInventory} /> : null}
            <Typography.Link key="in" onClick={() => openAction('in', record)}>
              入库
            </Typography.Link>
            <Typography.Link title={isExpired ? '库存已过期，禁止出库' : undefined} disabled={isExpired || Boolean(record.frozen) || !(record.currentQty > (record.frozenQty ?? 0))} key="out" onClick={() => openAction('out', record)}>
              出库
            </Typography.Link>
            <Typography.Link disabled={Boolean(record.frozen) || !(record.currentQty > (record.frozenQty ?? 0))} key="loss" onClick={() => openAction('loss', record)}>
              损耗
            </Typography.Link>
            {record.frozen ? <Popconfirm key="unfreeze" title={`确认解冻 ${record.warehouseName} 的库存？`} onConfirm={() => freezeMutation.mutate({
            inventoryId: String(record.inventoryId),
            batchId: record.batchId,
            frozen: false
          })}>
                <Typography.Link>解冻</Typography.Link>
              </Popconfirm> : <Popconfirm key="freeze" title={`确认冻结 ${record.warehouseName} 的库存？`} description="冻结后不可出库，请先解冻。" okText="确认冻结" cancelText="取消" onConfirm={() => freezeMutation.mutate({
            inventoryId: String(record.inventoryId),
            batchId: record.batchId,
            frozen: true
          })}>
                <Typography.Link>
                  <LockOutlined /> 冻结
                </Typography.Link>
              </Popconfirm>}
          </ListRowActions>;
      }
    }]);

    /** 弹窗标题映射 */
    const actionTitleMap = computed<Record<StockAction, string>>(() => ({
      in: '库存入库',
      out: '库存出库',
      loss: '损耗登记'
    }));
    return () => {
      return <PageContainer class="harvest-business-page production-list-dense production-member-list" title="库存管理" subTitle="当前经营主体全部仓库">
      {/* 统计统一放入列表工具栏。 */}

      <Card class="production-dense-filter-card">
        <ProductionListFilters form={filterForm} onFinish={handleSearch} onReset={handleReset} loading={listQuery.isFetching}>
          <Form.Item name="keyword" label="品名"><Input allowClear placeholder="搜索品名" /></Form.Item>
          <Form.Item name="batchNo" label="批次号"><Input allowClear placeholder="搜索采收批次" /></Form.Item>
          <Form.Item name="warehouseName" label="仓库">
            <Select allowClear placeholder="全部仓库" options={WAREHOUSE_OPTIONS} />
          </Form.Item>
          <Form.Item name="category" label="品类">
            <Select allowClear placeholder="全部品类" options={categoryOptions.value} />
          </Form.Item>
          <Form.Item name="healthStatus" label="状态">
            <Select allowClear placeholder="全部状态" options={INVENTORY_HEALTH_OPTIONS} />
          </Form.Item>
        </ProductionListFilters>
      </Card>

      <Card>
        {!subjectId.value ? <Empty description="请先选择经营主体" /> : listQuery.isError ? <Empty description={<Space direction="vertical">
                <Typography.Text type="danger">库存数据加载失败，请稍后重试</Typography.Text>
                <Button onClick={() => void invalidateInventory()}>重新加载</Button>
              </Space>} /> : <ProTable memberListToolbar cardProps={false} headerTitle={false} tableAlertRender={false} columnWidthStorageKey="inventory-records" scroll={{
            x: 'max-content'
          }} rowKey="inventoryId" columns={columns.value} dataSource={rows.value.slice((pageNum.value - 1) * pageSize.value, pageNum.value * pageSize.value)} loading={listQuery.isFetching} search={false} rowSelection={{
            selectedRowKeys: selectedKeys.value,
            onChange: keys => setSelectedKeys(keys.map(String))
          }} options={{
            reload: () => void invalidateInventory(),
            density: true,
            setting: true
          }} toolbar={{
            title: <Space size={8} wrap>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/production/harvests/inventory/create')}>
                    新增库存
                  </Button>
                  <Button onClick={() => navigate('/production/harvests')}>
                    采收记录
                  </Button>
                <ListSummary trigger="click" content={<div class="production-dense-summary">
        <div class="production-dense-summary-items">
          <span class="production-dense-metric">
            <span class="production-dense-metric-label">在库记录</span>
            <span class="production-dense-metric-value">{overview.value.skuCount} 个</span>
          </span>
          <span class="production-dense-metric">
            <span class="production-dense-metric-label">库存总量</span>
            <span class="production-dense-metric-value is-success">{overview.value.totalQty}</span>
          </span>
          <span class="production-dense-metric">
            <span class="production-dense-metric-label">冻结数量</span>
            <span class={`production-dense-metric-value ${overview.value.frozenQty !== '0' && overview.value.frozenQty !== '—' ? 'is-danger' : ''}`}>
              {overview.value.frozenQty}
            </span>
          </span>
          <span class="production-dense-metric">
            <span class="production-dense-metric-label">累计损耗</span>
            <span class={`production-dense-metric-value ${overview.value.lossQty !== '0' && overview.value.lossQty !== '—' ? 'is-warning' : ''}`}>
              {overview.value.lossQty}
            </span>
          </span>
        </div>
        <Space size={8} wrap>
          {overview.value.missingQtyCount > 0 && <Tooltip title={`有 ${overview.value.missingQtyCount} 条记录后端未返回库存台账字段，汇总仅包含已有数量，请刷新后核实。`}>
              <span class="production-dense-metric-chip">
                <WarningOutlined /> {overview.value.missingQtyCount} 条字段缺失
              </span>
            </Tooltip>}
          {warnings.value.length > 0 && <Tooltip overlayStyle={{
              maxWidth: 440
            }} title={<Space direction="vertical" size={2}>
                  {warnings.value.slice(0, 5).map((item, index) => <span key={item.inventoryId ?? `inventory-warn-${index}`}>
                      {item.warehouseName ?? '—'} - {item.productName ?? '—'}：
                      {healthOf(item) === 'expiring' ? `临期（保质期至 ${item.expireDate ?? '—'}）` : `库存不足（当前 ${item.currentQty ?? '—'}${item.unit ?? ''} / 安全 ${item.safeQty ?? '—'}${item.unit ?? ''}）`}
                    </span>)}
                  {warnings.value.length > 5 ? <span>其余 {warnings.value.length - 5} 条请按状态筛选查看</span> : null}
                </Space>}>
              <span class="production-dense-metric-chip" onClick={() => {
                const firstWarnHealth = healthOf(warnings.value[0]);
                filterForm.setFieldValue('healthStatus', firstWarnHealth);
                setPageNum(1);
                setFilters(prev => ({
                  ...prev,
                  healthStatus: firstWarnHealth
                }));
              }}>
                <WarningOutlined /> 库存预警 {warnings.value.length} 条（悬停查看 / 点击筛选）
              </span>
            </Tooltip>}
        </Space>
      </div>}><Button>统计</Button></ListSummary></Space>
          }} pagination={{
            current: pageNum.value,
            pageSize: pageSize.value,
            total: rows.value.length,
            showSizeChanger: true,
            onChange: (nextPage, nextSize) => {
              setPageNum(nextPage);
              setPageSize(nextSize);
            }
          }} />}
      </Card>

      <Modal class="production-form-dialog" title={`${action.value ? actionTitleMap.value[action.value] : ''}：${actionTarget.value?.productName ?? ''}`} open={Boolean(action.value)} okText="确认提交" cancelText="取消" confirmLoading={inboundMutation.isPending || outboundMutation.isPending || lossMutation.isPending} onOk={handleStockSubmit} onCancel={closeAction} destroyOnClose>
        <Form form={stockForm} layout="vertical" style={{
            marginTop: 16
          }}>
          {action.value === 'loss' ? <Form.Item name="reason" label="损耗原因" rules={[{
              required: true,
              message: '请选择损耗原因'
            }]}>
              <Select options={LOSS_REASON_OPTIONS} placeholder="请选择损耗原因" />
            </Form.Item> : null}
          <Form.Item name="quantity" label={action.value === 'loss' ? '损耗数量' : action.value === 'out' ? '出库数量' : '入库数量'} rules={[{
              required: true,
              message: '请输入数量'
            }]}>
            <InputNumber style={{
                width: '100%'
              }} min={0.01} precision={2} placeholder={`当前库存 ${actionTarget.value?.currentQty ?? 0}${actionTarget.value?.unit ?? 'kg'}`} />
          </Form.Item>
          {action.value === 'out' ? <Form.Item name="orderNo" label="关联单据号">
              <Input placeholder="如销售订单号 SO20260602（可选）" />
            </Form.Item> : null}
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可填写操作说明" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>;
    };
  }
});
export default InventoryManage;
