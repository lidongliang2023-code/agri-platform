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
import BusinessRecordList from '@/vue/business/components/BusinessRecordList';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { PageContainer } from '@/vue/pro';
/**
 * 页面名称：设备绑定管理
 * 路由路径：/production/iot/bindings
 * 所属模块：IoT设备管理
 * PRD 序号：PRD 6.1 #30（设备与地块/网关绑定、传感器映射）
 *
 * 设计决策：
 * - 绑定关系主体取 `GET /iot/bindings/page`（真实绑定关系对象），`@/api/iot` 内部已完成
 *   `targetType 1/2/3 ⇄ bindType PLOT/GREENHOUSE/FARM`、`status 1/0 ⇄ BOUND/UNBOUND`、
 *   `metrics 数组 ⇄ 逗号串`、`collectInterval ⇄ frequency` 的双向映射，页面无需感知
 * - 后端未返回绑定记录时，用设备实体上的地块字段推导「隐式绑定」行并标注来源，保证页面不空白
 * - **本地暂存兜底已整体删除**：新增 / 编辑 / 解绑 / 指标回写全部直连服务端，
 *   用户填写的采集指标与频率真实落库，不再写入 localStorage
 * - 编辑已有绑定走 `bindDevice`（后端「同设备+类型+对象重复绑定」= upsert 语义），
 *   保证采集指标 / 采集频率能被真实保存，而不是只改状态
 * - 传感器映射（通道 → 监测指标）前端按设备维度持久化，并把映射出的指标回写绑定关系的 metrics
 *
 * 数据边界（2026-10-28 收敛）：
 * - 设备下拉来自物联网系统的设备台账（`GET /iot/devices` → agri-iot 的 `iot_device`），
 *   生产端不再有第二份设备表，所以这里选到的设备与物联网端看到的是同一批。
 * - 绑定关系本身留在生产端（`agri_prod_iot_binding`）：它比物联网端多出「大棚/农场」
 *   两类对象、解绑历史和采集频率。绑定到「地块」时会把结果回写物联网端的 `plot_id`，
 *   保证物联网端设备详情里的地块归属同步可见。
 */

import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { Alert, Button, Card, Checkbox, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from '@/vue/ui';
import type { ColumnsType } from '@/vue/ui';
import { DeleteOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import useFarmStore from '@/vue/farmStore';
import { ENV_METRIC_DEFS, bindDevice, createDeviceBinding, deleteDeviceBinding, deviceTypeLabel, listDeviceBindings, listDevices, metricLabel, toDeviceBinding, toMetricList, unbindBinding, unwrapList } from '@/api/iot';
import { listPlots } from '@/api/plots';
import type { BindTargetType, DeviceBinding, IotBindType, IotDevice, Plot } from '@/types';

/** 旧结构 targetType（1 地块 2 大棚 3 农场）→ 后端 bindType 枚举 */
const BIND_TYPE_BY_TARGET: Record<BindTargetType, IotBindType> = {
  1: 'PLOT',
  2: 'GREENHOUSE',
  3: 'FARM'
};

/** 绑定对象类型选项 */
const TARGET_TYPE_OPTIONS: {
  value: BindTargetType;
  label: string;
}[] = [{
  value: 1,
  label: '地块'
}, {
  value: 2,
  label: '大棚'
}, {
  value: 3,
  label: '农场'
}];

/** 绑定状态选项 */
const STATUS_OPTIONS: {
  value: number;
  label: string;
}[] = [{
  value: 1,
  label: '已绑定'
}, {
  value: 0,
  label: '已解绑'
}];

/** 默认采集频率（分钟） */
const DEFAULT_INTERVAL = 10;

/** 传感器通道映射行 */
interface SensorChannel {
  /** 行标识 */
  key: string;
  /** 通道编码 */
  channel: string;
  /** 传感器类型 */
  sensorType: string;
  /** 映射指标编码 */
  metric: string;
  /** 单位 */
  unit: string;
  /** 倍率（原始值 × 倍率 = 上报值） */
  factor: number;
}

/** 绑定行（扩展隐式绑定标记） */
interface BindingRow extends DeviceBinding {
  /** 是否由设备地块字段推导的隐式绑定（未落库，需「转为正式绑定」） */
  implicit?: boolean;
}

/** 新增 / 编辑绑定表单值 */
interface BindingFormValues {
  /** 设备 ID */
  deviceId: string;
  /** 绑定对象类型 */
  targetType: BindTargetType;
  /** 绑定对象 ID */
  targetId: string;
  /** 绑定对象名称（大棚 / 农场手填场景） */
  targetName?: string;
  /** 采集指标 */
  metrics: string[];
  /** 采集频率（分钟） */
  collectInterval: number;
}

/**
 * 从 localStorage 读取传感器通道映射。
 *
 * @param key 存储键
 * @returns 通道列表
 */
function loadChannels(key: string): SensorChannel[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as SensorChannel[] : [];
  } catch {
    return [];
  }
}

/**
 * 生成默认通道映射（按指标顺序生成 CH1..CHn）。
 *
 * @param metrics 指标编码列表
 * @returns 通道列表
 */
function defaultChannels(metrics: string[]): SensorChannel[] {
  return metrics.map((metric, index) => {
    const def = ENV_METRIC_DEFS.find(item => item.key === metric);
    return {
      key: `${metric}-${index}`,
      channel: `CH${index + 1}`,
      sensorType: def?.label ?? metric,
      metric,
      unit: def?.unit ?? '',
      factor: 1
    };
  });
}

/**
 * 设备绑定管理页面
 *
 * 业务职责：维护设备与地块 / 大棚 / 农场的绑定关系、采集指标与采集频率，
 * 并提供传感器通道 → 监测指标的映射配置。
 *
 * @returns 页面内容
 */
const DeviceBindings = defineComponent({
  name: "DeviceBindings",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const queryClient = useQueryClient();
    const _store = useFarmStore();
    const farmId = computed(() => _store.currentFarm?.farmId);

    /** 设备筛选 */
    const draftDeviceFilter = shallowRef<string | undefined>(undefined);
    const setDraftDeviceFilter = (next: typeof draftDeviceFilter.value | ((previous: typeof draftDeviceFilter.value) => typeof draftDeviceFilter.value)) => {
      draftDeviceFilter.value = typeof next === 'function' ? (next as (previous: typeof draftDeviceFilter.value) => typeof draftDeviceFilter.value)(draftDeviceFilter.value) : next;
    };
    const deviceFilter = shallowRef<string | undefined>(undefined);
    /** 绑定对象类型筛选 */
    const setDeviceFilter = (next: typeof deviceFilter.value | ((previous: typeof deviceFilter.value) => typeof deviceFilter.value)) => {
      deviceFilter.value = typeof next === 'function' ? (next as (previous: typeof deviceFilter.value) => typeof deviceFilter.value)(deviceFilter.value) : next;
    };
    const draftTargetTypeFilter = shallowRef<BindTargetType | undefined>(undefined);
    const setDraftTargetTypeFilter = (next: typeof draftTargetTypeFilter.value | ((previous: typeof draftTargetTypeFilter.value) => typeof draftTargetTypeFilter.value)) => {
      draftTargetTypeFilter.value = typeof next === 'function' ? (next as (previous: typeof draftTargetTypeFilter.value) => typeof draftTargetTypeFilter.value)(draftTargetTypeFilter.value) : next;
    };
    const targetTypeFilter = shallowRef<BindTargetType | undefined>(undefined);
    /** 状态筛选 */
    const setTargetTypeFilter = (next: typeof targetTypeFilter.value | ((previous: typeof targetTypeFilter.value) => typeof targetTypeFilter.value)) => {
      targetTypeFilter.value = typeof next === 'function' ? (next as (previous: typeof targetTypeFilter.value) => typeof targetTypeFilter.value)(targetTypeFilter.value) : next;
    };
    const draftStatusFilter = shallowRef<number | undefined>(undefined);
    const setDraftStatusFilter = (next: typeof draftStatusFilter.value | ((previous: typeof draftStatusFilter.value) => typeof draftStatusFilter.value)) => {
      draftStatusFilter.value = typeof next === 'function' ? (next as (previous: typeof draftStatusFilter.value) => typeof draftStatusFilter.value)(draftStatusFilter.value) : next;
    };
    const statusFilter = shallowRef<number | undefined>(undefined);
    /** 行勾选 */
    const setStatusFilter = (next: typeof statusFilter.value | ((previous: typeof statusFilter.value) => typeof statusFilter.value)) => {
      statusFilter.value = typeof next === 'function' ? (next as (previous: typeof statusFilter.value) => typeof statusFilter.value)(statusFilter.value) : next;
    };
    const selectedRowKeys = shallowRef<(string | number)[]>([]);
    /** 绑定弹窗 */
    const setSelectedRowKeys = (next: typeof selectedRowKeys.value | ((previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)) => {
      selectedRowKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)(selectedRowKeys.value) : next;
    };
    const modalOpen = shallowRef<boolean>(false);
    /** 编辑中的绑定 */
    const setModalOpen = (next: typeof modalOpen.value | ((previous: typeof modalOpen.value) => typeof modalOpen.value)) => {
      modalOpen.value = typeof next === 'function' ? (next as (previous: typeof modalOpen.value) => typeof modalOpen.value)(modalOpen.value) : next;
    };
    const editing = shallowRef<BindingRow | null>(null);
    /** 传感器映射弹窗：目标设备与绑定 */
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const mappingDevice = shallowRef<string | undefined>(undefined);
    const setMappingDevice = (next: typeof mappingDevice.value | ((previous: typeof mappingDevice.value) => typeof mappingDevice.value)) => {
      mappingDevice.value = typeof next === 'function' ? (next as (previous: typeof mappingDevice.value) => typeof mappingDevice.value)(mappingDevice.value) : next;
    };
    const mappingBinding = shallowRef<BindingRow | null>(null);
    const setMappingBinding = (next: typeof mappingBinding.value | ((previous: typeof mappingBinding.value) => typeof mappingBinding.value)) => {
      mappingBinding.value = typeof next === 'function' ? (next as (previous: typeof mappingBinding.value) => typeof mappingBinding.value)(mappingBinding.value) : next;
    };
    const mappingOpen = shallowRef<boolean>(false);
    /** 通道映射编辑态 */
    const setMappingOpen = (next: typeof mappingOpen.value | ((previous: typeof mappingOpen.value) => typeof mappingOpen.value)) => {
      mappingOpen.value = typeof next === 'function' ? (next as (previous: typeof mappingOpen.value) => typeof mappingOpen.value)(mappingOpen.value) : next;
    };
    const channels = shallowRef<SensorChannel[]>([]);
    const setChannels = (next: typeof channels.value | ((previous: typeof channels.value) => typeof channels.value)) => {
      channels.value = typeof next === 'function' ? (next as (previous: typeof channels.value) => typeof channels.value)(channels.value) : next;
    };
    const [form] = Form.useForm<BindingFormValues>();

    /** 设备列表 */
    const devicesQuery = useQuery(() => ({
      queryKey: ['binding-devices', farmId.value],
      queryFn: () => listDevices({
        pageNum: 1,
        pageSize: 100,
        farmId: farmId.value
      }),
      retry: false
    }));
    const devices = computed<IotDevice[]>(() => unwrapList<IotDevice>(devicesQuery.data));
    const deviceNameMap = computed(() => {
      const map = new Map<string, string>();
      devices.value.forEach(item => map.set(item.deviceId, item.deviceName || item.deviceCode || item.deviceId));
      return map;
    });

    /** 地块列表 */
    const plotsQuery = useQuery(() => ({
      queryKey: ['binding-plots', farmId.value],
      queryFn: () => listPlots({
        pageNum: 1,
        pageSize: 100,
        farmId: farmId.value
      }),
      retry: false
    }));
    const plots = computed<Plot[]>(() => unwrapList<Plot>(plotsQuery.data));

    /** 绑定关系 */
    const bindingsQuery = useQuery(() => ({
      queryKey: ['binding-list'],
      queryFn: () => listDeviceBindings({
        pageNum: 1,
        pageSize: 100
      }),
      retry: false
    }));

    /**
     * 绑定行数据来源（按优先级）：
     * 1. 服务端返回的真实绑定关系（`GET /iot/bindings/page`）
     * 2. 接口为空时用设备地块字段推导的「隐式绑定」，提示用户转为正式绑定
     */
    const rows = computed<BindingRow[]>(() => {
      const apiRows = unwrapList<DeviceBinding>(bindingsQuery.data);
      const implicitRows = apiRows.length > 0 ? [] : devices.value.filter(device => Boolean((device as unknown as {
        plotId?: string;
      }).plotId)).map<BindingRow>(device => {
        const plotId = (device as unknown as {
          plotId?: string;
        }).plotId as string;
        return {
          bindingId: `IMPL-${device.deviceId}`,
          deviceId: device.deviceId,
          deviceName: device.deviceName || device.deviceCode,
          targetType: 1,
          targetId: plotId,
          targetName: plots.value.find(item => item.plotId === plotId)?.plotName ?? plotId,
          metrics: [],
          collectInterval: DEFAULT_INTERVAL,
          status: 1,
          boundAt: device.createdAt,
          implicit: true
        };
      });
      return [...apiRows, ...implicitRows];
    });

    /** 过滤后的绑定行 */
    const filteredRows = computed(() => rows.value.filter(row => {
      if (deviceFilter.value && row.deviceId !== deviceFilter.value) return false;
      if (targetTypeFilter.value && row.targetType !== targetTypeFilter.value) return false;
      if (statusFilter.value !== undefined && row.status !== statusFilter.value) return false;
      return true;
    }));

    /** 打开映射弹窗时载入通道配置 */
    onMounted(() => {
      watch(() => [mappingOpen.value, mappingDevice.value, mappingBinding.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!mappingOpen.value || !mappingDevice.value) return;
          const key = `agri_iot_sensor_mapping_${mappingDevice.value}`;
          const saved = loadChannels(key);
          if (saved.length > 0) {
            setChannels(saved);
            return;
          }
          const metrics = toMetricList(mappingBinding.value?.metrics);
          setChannels(defaultChannels(metrics.length > 0 ? metrics : ['airTemperature', 'airHumidity']));
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });

    /**
     * 保存绑定（全量直连服务端，无本地兜底）。
     *
     * 编辑已有绑定走 `bindDevice`：后端「同设备+类型+对象重复绑定」为 upsert 语义，
     * 能把采集指标 / 采集频率一起落库；若编辑时改了绑定对象，则顺带把旧的绑定关系解绑，
     * 避免残留一条仍然 BOUND 的旧记录。
     */
    const saveMutation = useMutation(() => ({
      mutationFn: async (values: BindingFormValues): Promise<DeviceBinding> => {
        const targetName = values.targetType === 1 ? plots.value.find(item => item.plotId === values.targetId)?.plotName : values.targetType === 3 ? _store.farmOptions.find(item => item.farmId === values.targetId)?.farmName : values.targetName;
        const payload: Partial<DeviceBinding> = {
          deviceId: values.deviceId,
          deviceName: deviceNameMap.value.get(values.deviceId),
          targetType: values.targetType,
          targetId: values.targetId,
          targetName,
          metrics: values.metrics,
          collectInterval: values.collectInterval,
          status: 1
        };
        if (editing.value && !editing.value.implicit) {
          const targetChanged = editing.value.deviceId !== values.deviceId || editing.value.targetType !== values.targetType || editing.value.targetId !== values.targetId;
          const saved = await bindDevice({
            deviceId: values.deviceId,
            bindType: BIND_TYPE_BY_TARGET[values.targetType],
            bindTargetId: values.targetId,
            targetName,
            metrics: values.metrics,
            frequency: values.collectInterval
          });
          if (targetChanged) {
            // 绑定对象已变更：旧绑定关系解绑，避免残留重复的有效绑定
            await unbindBinding(editing.value.bindingId).catch(() => undefined);
          }
          return toDeviceBinding(saved);
        }
        return createDeviceBinding(payload);
      },
      onSuccess: () => {
        message.success(editing.value && !editing.value.implicit ? '绑定关系已更新' : '设备已绑定');
        setModalOpen(false);
        setEditing(null);
        form.resetFields();
        void queryClient.invalidateQueries({
          queryKey: ['binding-list']
        });
        void queryClient.invalidateQueries({
          queryKey: ['binding-devices']
        });
      },
      onError: (error: Error) => {
        message.error(error.message || '绑定保存失败，请稍后重试');
      }
    }));

    /** 解绑（POST /iot/bindings/{bindingId}/unbind，记录保留、状态置 UNBOUND） */
    const unbindMutation = useMutation(() => ({
      mutationFn: (row: BindingRow): Promise<boolean> => deleteDeviceBinding(row.bindingId),
      onSuccess: () => {
        message.success('设备已解绑');
        void queryClient.invalidateQueries({
          queryKey: ['binding-list']
        });
        void queryClient.invalidateQueries({
          queryKey: ['binding-devices']
        });
      },
      onError: (error: Error) => {
        message.error(error.message || '解绑失败，请稍后重试');
      }
    }));

    /** 打开新增绑定 */
    const openCreate = (): void => {
      setEditing(null);
      form.setFieldsValue({
        targetType: 1,
        metrics: ['airTemperature', 'airHumidity'],
        collectInterval: DEFAULT_INTERVAL
      } as BindingFormValues);
      setModalOpen(true);
    };

    /** 打开编辑绑定 */
    const openEdit = (row: BindingRow): void => {
      setEditing(row);
      form.setFieldsValue({
        deviceId: row.deviceId,
        targetType: row.targetType,
        targetId: row.targetId,
        targetName: row.targetName,
        metrics: toMetricList(row.metrics),
        collectInterval: row.collectInterval ?? DEFAULT_INTERVAL
      } as BindingFormValues);
      setModalOpen(true);
    };

    /** 打开传感器映射 */
    const openMapping = (row: BindingRow): void => {
      setMappingDevice(row.deviceId);
      setMappingBinding(row);
      setMappingOpen(true);
    };

    /**
     * 保存传感器映射。
     *
     * 通道 → 指标的映射关系按设备维度持久化在前端（后端暂无通道表）；
     * 映射出的指标列表回写服务端绑定关系（走 bindDevice upsert，保证 metrics 真实落库）。
     */
    const saveMapping = async (): Promise<void> => {
      if (!mappingDevice.value) return;
      const key = `agri_iot_sensor_mapping_${mappingDevice.value}`;
      localStorage.setItem(key, JSON.stringify(channels.value));
      const metrics = Array.from(new Set(channels.value.map(item => item.metric).filter(Boolean)));
      if (mappingBinding.value && !mappingBinding.value.implicit) {
        try {
          await bindDevice({
            deviceId: mappingBinding.value.deviceId,
            bindType: BIND_TYPE_BY_TARGET[mappingBinding.value.targetType],
            bindTargetId: mappingBinding.value.targetId,
            targetName: mappingBinding.value.targetName,
            metrics,
            frequency: mappingBinding.value.collectInterval
          });
          message.success('传感器映射已保存并回写到绑定关系');
        } catch (error) {
          message.error((error as Error).message || '映射已本地保存，但回写绑定关系失败');
        }
      } else {
        message.success('传感器映射已保存到本地（该绑定为隐式绑定，未回写）');
      }
      setMappingOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ['binding-list']
      });
    };

    /** 表格列定义 */
    const columns = computed<ColumnsType<BindingRow>>(() => [{
      title: '设备名称',
      key: 'deviceName',
      width: 200,
      ellipsis: true,
      render: (_value: unknown, row: BindingRow) => <Space size={4}>
          <span>{row.deviceName ?? deviceNameMap.value.get(row.deviceId) ?? row.deviceId}</span>
          {row.implicit && <Tag color="orange">隐式</Tag>}
        </Space>
    }, {
      title: '类型',
      key: 'deviceType',
      width: 120,
      render: (_value: unknown, row: BindingRow) => {
        const device = devices.value.find(item => item.deviceId === row.deviceId);
        return <Tag>{device ? deviceTypeLabel(device.deviceType) : '-'}</Tag>;
      }
    }, {
      title: '绑定对象类型',
      dataIndex: 'targetType',
      key: 'targetType',
      width: 120,
      render: (value: BindTargetType) => TARGET_TYPE_OPTIONS.find(item => item.value === value)?.label ?? '-'
    }, {
      title: '绑定对象',
      key: 'targetName',
      width: 160,
      ellipsis: true,
      render: (_value: unknown, row: BindingRow) => row.targetName ?? row.targetId ?? '-'
    }, {
      title: '采集指标',
      key: 'metrics',
      width: 220,
      ellipsis: true,
      render: (_value: unknown, row: BindingRow) => {
        // 后端可能给数组 / 逗号串 / null，统一成数组后再渲染，避免对非数组调 .map()
        const metrics = toMetricList(row.metrics);
        if (metrics.length === 0) return <Typography.Text type="secondary">未配置</Typography.Text>;
        return <Space wrap size={4}>
            {metrics.map(metric => <Tag key={metric} color="blue">
                {metricLabel(metric)}
              </Tag>)}
          </Space>;
      }
    }, {
      title: '采集频率',
      dataIndex: 'collectInterval',
      key: 'collectInterval',
      width: 110,
      align: 'right',
      render: (value?: number) => typeof value === 'number' ? `${value} 分钟` : '-'
    }, {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: number) => <Tag color={Number(status) === 1 ? 'green' : 'default'}>
          {Number(status) === 1 ? '已绑定' : '已解绑'}
        </Tag>
    }, {
      title: '绑定时间',
      dataIndex: 'boundAt',
      key: 'boundAt',
      width: 160,
      render: (value?: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'
    }, {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (_value: unknown, row: BindingRow) => <ListRowActions>
          <Button key="mapping" type="link" size="small" icon={<SettingOutlined />} onClick={() => openMapping(row)}>
            传感器映射
          </Button>
          <Button key="edit" type="link" size="small" onClick={() => openEdit(row)}>
            {row.implicit ? '转为正式绑定' : '编辑'}
          </Button>
          <Popconfirm key="unbind" title="确认解除该绑定关系？" okText="解绑" cancelText="取消" onConfirm={() => unbindMutation.mutate(row)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              解绑
            </Button>
          </Popconfirm>
        </ListRowActions>
    }]);
    const handleSearch = (): void => {
      setDeviceFilter(draftDeviceFilter.value);
      setTargetTypeFilter(draftTargetTypeFilter.value);
      setStatusFilter(draftStatusFilter.value);
    };
    const handleReset = (): void => {
      setDraftDeviceFilter(undefined);
      setDraftTargetTypeFilter(undefined);
      setDraftStatusFilter(undefined);
      setDeviceFilter(undefined);
      setTargetTypeFilter(undefined);
      setStatusFilter(undefined);
    };
    const handleReload = (): Promise<void[]> => Promise.all([queryClient.invalidateQueries({
      queryKey: ['binding-list']
    }), queryClient.invalidateQueries({
      queryKey: ['binding-devices']
    })]);
    return () => {
      return <PageContainer class="production-list-dense production-member-list" title="设备绑定管理">
      <Card class="production-dense-filter-card">
        <ProductionListFilters onSearch={handleSearch} onReset={handleReset} loading={bindingsQuery.isLoading || devicesQuery.isLoading}>
          <div class="production-filter-field">
            <label>设备</label>
            <Select allowClear placeholder="全部设备" value={draftDeviceFilter.value} options={devices.value.map(item => ({
                value: item.deviceId,
                label: item.deviceName || item.deviceCode || item.deviceId
              }))} onChange={setDraftDeviceFilter} />
          </div>
          <div class="production-filter-field">
            <label>绑定对象</label>
            <Select allowClear placeholder="全部绑定对象" value={draftTargetTypeFilter.value} options={TARGET_TYPE_OPTIONS} onChange={setDraftTargetTypeFilter} />
          </div>
          <div class="production-filter-field">
            <label>状态</label>
            <Select allowClear placeholder="全部状态" value={draftStatusFilter.value} options={STATUS_OPTIONS} onChange={setDraftStatusFilter} />
          </div>
        </ProductionListFilters>
      </Card>

      {bindingsQuery.isError && <Alert type="warning" showIcon style={{
          marginBottom: 10
        }} message="绑定关系接口暂不可用，已使用设备地块字段推导展示" description={(bindingsQuery.error as Error)?.message ?? '请稍后重试'} />}

      {bindingsQuery.data && unwrapList<DeviceBinding>(bindingsQuery.data).length === 0 && <Alert type="info" showIcon style={{
          marginBottom: 10
        }} message="后端未返回绑定记录" description="当前列表由设备实体上的地块字段推导（标记「隐式」），点击「转为正式绑定」可写入正式绑定关系。" />}

      <Card>
        <BusinessRecordList memberListToolbar columnWidthStorageKey="iot-device-bindings" rowKey="bindingId" loading={bindingsQuery.isLoading || devicesQuery.isLoading} dataSource={filteredRows.value} columns={columns.value} onReload={handleReload} rowSelection={{
            selectedRowKeys: selectedRowKeys.value,
            onChange: setSelectedRowKeys
          }} toolbarTitle={<Space size={8} wrap>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                新增绑定
              </Button>
            </Space>} scroll={{
            x: 'max-content'
          }} locale={{
            emptyText: <Empty description="暂无绑定关系，点击「新增绑定」开始配置" />
          }} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true
          }} />
      </Card>

      <Modal class="production-form-dialog" title={editing.value ? '编辑绑定关系' : '新增设备绑定'} open={modalOpen.value} onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }} onOk={() => form.submit()} confirmLoading={saveMutation.isPending} okText="保存" cancelText="取消" width={560} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={values => saveMutation.mutate(values)} preserve={false}>
          <Form.Item name="deviceId" label="设备" rules={[{
              required: true,
              message: '请选择设备'
            }]}>
            <Select placeholder="请选择设备" options={devices.value.map(item => ({
                value: item.deviceId,
                label: `${item.deviceName || item.deviceCode}（${deviceTypeLabel(item.deviceType)}）`
              }))} />
          </Form.Item>
          <Form.Item name="targetType" label="绑定对象类型" rules={[{
              required: true,
              message: '请选择绑定对象类型'
            }]}>
            <Select options={TARGET_TYPE_OPTIONS} onChange={() => form.setFieldValue('targetId', undefined)} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.targetType !== next.targetType}>
            {({
                getFieldValue
              }: ReturnType<typeof Form.useForm>) => {
                const targetType = getFieldValue('targetType') as BindTargetType;
                if (targetType === 1) {
                  return <Form.Item name="targetId" label="绑定地块" rules={[{
                    required: true,
                    message: '请选择地块'
                  }]}>
                    <Select placeholder="请选择地块" options={plots.value.map(item => ({
                      value: item.plotId,
                      label: item.plotName
                    }))} />
                  </Form.Item>;
                }
                if (targetType === 3) {
                  return <Form.Item name="targetId" label="绑定农场" rules={[{
                    required: true,
                    message: '请选择农场'
                  }]}>
                    <Select placeholder="请选择农场" options={_store.farmOptions.map(item => ({
                      value: item.farmId,
                      label: item.farmName
                    }))} />
                  </Form.Item>;
                }
                return <>
                  <Form.Item name="targetId" label="大棚编号" rules={[{
                    required: true,
                    message: '请填写大棚编号'
                  }]}>
                    <Input placeholder="如：GH-01" />
                  </Form.Item>
                  <Form.Item name="targetName" label="大棚名称">
                    <Input placeholder="如：1号连栋大棚" />
                  </Form.Item>
                </>;
              }}
          </Form.Item>
          <Form.Item name="metrics" label="采集指标" rules={[{
              required: true,
              message: '请至少选择一个采集指标'
            }]}>
            <Checkbox.Group options={ENV_METRIC_DEFS.map(item => ({
                label: item.label,
                value: item.key
              }))} />
          </Form.Item>
          <Form.Item name="collectInterval" label="采集频率（分钟）" rules={[{
              required: true,
              message: '请填写采集频率'
            }]}>
            <InputNumber min={1} max={1440} style={{
                width: '100%'
              }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal class="production-form-dialog" title={`传感器映射配置${mappingBinding.value?.deviceName ? ` · ${mappingBinding.value.deviceName}` : ''}`} open={mappingOpen.value} onCancel={() => setMappingOpen(false)} onOk={() => void saveMapping()} okText="保存映射" cancelText="取消" width={760} destroyOnClose>
        <Space direction="vertical" style={{
            width: '100%'
          }} size={12}>

          <Table size="small" rowKey="key" dataSource={channels.value} pagination={false} locale={{
              emptyText: <Empty description="暂无通道，请点击下方新增" />
            }} columns={[{
              title: '通道',
              dataIndex: 'channel',
              key: 'channel',
              render: (value: string, row: SensorChannel) => <Input value={value} onChange={event => setChannels(prev => prev.map(item => item.key === row.key ? {
                ...item,
                channel: event.target.value
              } : item))} />
            }, {
              title: '传感器类型',
              dataIndex: 'sensorType',
              key: 'sensorType',
              render: (value: string, row: SensorChannel) => <Input value={value} onChange={event => setChannels(prev => prev.map(item => item.key === row.key ? {
                ...item,
                sensorType: event.target.value
              } : item))} />
            }, {
              title: '映射指标',
              dataIndex: 'metric',
              key: 'metric',
              render: (value: string, row: SensorChannel) => <Select style={{
                width: 140
              }} value={value} options={ENV_METRIC_DEFS.map(item => ({
                value: item.key,
                label: item.label
              }))} onChange={next => setChannels(prev => prev.map(item => item.key === row.key ? {
                ...item,
                metric: next,
                unit: ENV_METRIC_DEFS.find(def => def.key === next)?.unit ?? item.unit
              } : item))} />
            }, {
              title: '单位',
              dataIndex: 'unit',
              key: 'unit',
              render: (value: string) => value || '-'
            }, {
              title: '倍率',
              dataIndex: 'factor',
              key: 'factor',
              render: (value: number, row: SensorChannel) => <InputNumber min={0} step={0.1} value={value} onChange={next => setChannels(prev => prev.map(item => item.key === row.key ? {
                ...item,
                factor: Number(next ?? 1)
              } : item))} />
            }, {
              title: '操作',
              key: 'action',
              render: (_value: unknown, row: SensorChannel) => <Button type="link" size="small" danger onClick={() => setChannels(prev => prev.filter(item => item.key !== row.key))}>
                    删除
                  </Button>
            }]} />
          <Button icon={<PlusOutlined />} onClick={() => setChannels(prev => [...prev, {
              key: `ch-${Date.now()}`,
              channel: `CH${prev.length + 1}`,
              sensorType: '通用传感器',
              metric: ENV_METRIC_DEFS[0]?.key ?? 'airTemperature',
              unit: ENV_METRIC_DEFS[0]?.unit ?? '',
              factor: 1
            }])}>
            新增通道
          </Button>
        </Space>
      </Modal>
    </PageContainer>;
    };
  }
});
export default DeviceBindings;
