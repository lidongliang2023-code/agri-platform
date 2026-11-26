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
import '@/components/ProductionListDense.css';
import Table from '@/vue/business/components/BusinessRecordList';
/**
 * 页面名称：设备列表（IoT设备管理）
 * 路由路径：/production/iot
 * 所属模块：IoT设备管理
 * 原型来源：用户端原型 P21 iot
 *
 * 数据边界（2026-10-28 收敛）：
 * - 设备本体（编码/名称/类型/协议/在线状态/所属地块）的唯一来源是物联网系统
 *   `agri-iot` 的 `iot_device`，本页通过 `GET /iot/devices` 读取，**只读**。
 *   设备的新增 / 编辑 / 删除一律在物联网系统完成，本页不再提供这些入口 ——
 *   否则生产端和物联网端各写一份，两边看到的永远不是同一批设备。
 * - 生产端只保留「绑定关系」（设备 ↔ 地块/大棚/农场 + 采集指标 + 采集频率），
 *   入口是本页右上角的「绑定设备」，绑定到地块时会回写物联网端的 plot_id。
 *
 * 还原要点：
 * - 标题「📡 IoT设备管理」+ `+ 绑定设备`、`批量操作 ▾` 按钮
 * - 状态卡 4 项：在线 / 离线 / 故障 / 总计
 * - 筛选：状态（全部/在线/离线/故障）、类型、地块、关键字
 * - 表格列：复选框 | 设备名称 | 设备编码 | 类型 | 关联地块 | 状态 | 电量 | 最后上报 | 操作
 * - 在线设备操作 `配置 | 数据`，离线 / 故障设备操作 `配置 | 排查`
 */

import { useNavigate } from '@/vue/router';
import { useQuery, useQueryClient } from '@/vue/query';
import { Alert, Button, Card, Form, Popover, Dropdown, Empty, Input, Select, Space, Tag, Typography, message } from '@/vue/ui';
import type { ColumnsType } from '@/vue/ui';
import { ApiOutlined, PlusOutlined, ToolOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import useFarmStore from '@/vue/farmStore';
import { deviceTypeLabel, heartbeatDevice, listBoundDevices, listDevices, onlineStatusMeta, unwrapList } from '@/api/iot';
import { listPlots } from '@/api/plots';
import type { IotDevice, Plot } from '@/types';

/** 设备状态筛选项 */
const STATUS_OPTIONS: {
  value: number;
  label: string;
}[] = [{
  value: 1,
  label: '在线'
}, {
  value: 2,
  label: '离线'
}, {
  value: 3,
  label: '故障'
}];

/**
 * 读取设备在线状态（兼容实体字段 onlineFlag）。
 *
 * @param device 设备
 * @returns 1 在线 / 2 离线 / 3 故障
 */
function statusOf(device: IotDevice): number {
  const raw = device as unknown as {
    onlineFlag?: number;
  };
  const value = Number(device.onlineStatus ?? raw.onlineFlag);
  return value === 1 || value === 3 ? value : 2;
}

/**
 * 读取设备绑定地块 ID（来自绑定关系或设备实体字段）。
 *
 * @param device 设备
 * @returns 地块 ID，无绑定返回 undefined
 */
function plotIdOf(device: IotDevice): string | undefined {
  const raw = device as unknown as {
    plotId?: string;
  };
  return raw.plotId;
}

/**
 * 格式化最后上报时间为相对时间。
 *
 * @param time 时间字符串
 * @returns 相对时间文案
 */
function formatRelative(time?: string): string {
  if (!time) return '从未上报';
  const target = dayjs(time);
  if (!target.isValid()) return '从未上报';
  const minutes = dayjs().diff(target, 'minute');
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

/**
 * 导出设备台账为 CSV。
 *
 * @param rows 设备行
 */
function exportCsv(rows: IotDevice[]): void {
  const header = '设备名称,设备编码,类型,关联地块,状态,电量,最后上报\n';
  const body = rows.map(row => [row.deviceName ?? '', row.deviceCode ?? '', deviceTypeLabel(row.deviceType), row.location ?? '', onlineStatusMeta(statusOf(row)).label, row.battery ?? '', row.lastHeartbeatAt ?? ''].join(',')).join('\n');
  const blob = new Blob([`${header}${body}`], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `设备台账_${dayjs().format('YYYYMMDDHHmmss')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * IoT 设备列表页面
 *
 * 业务职责：只读展示物联网系统的设备台账与在线状态，支持筛选、批量心跳/导出与下钻到设备详情。
 * 设备本体的增删改不在这里（已收归物联网系统）。
 *
 * @returns 页面内容
 */
const DeviceList = defineComponent({
  name: "DeviceList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const _store = useFarmStore();
    const farmId = computed(() => _store.currentFarm?.farmId);
    const [form] = Form.useForm();
    const page = shallowRef(1);
    /** 状态筛选 */
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const statusFilter = shallowRef<number | undefined>(undefined);
    /** 类型筛选 */
    const setStatusFilter = (next: typeof statusFilter.value | ((previous: typeof statusFilter.value) => typeof statusFilter.value)) => {
      statusFilter.value = typeof next === 'function' ? (next as (previous: typeof statusFilter.value) => typeof statusFilter.value)(statusFilter.value) : next;
    };
    const typeFilter = shallowRef<string | undefined>(undefined);
    /** 地块筛选 */
    const setTypeFilter = (next: typeof typeFilter.value | ((previous: typeof typeFilter.value) => typeof typeFilter.value)) => {
      typeFilter.value = typeof next === 'function' ? (next as (previous: typeof typeFilter.value) => typeof typeFilter.value)(typeFilter.value) : next;
    };
    const plotFilter = shallowRef<string | undefined>(undefined);
    /** 关键字 */
    const setPlotFilter = (next: typeof plotFilter.value | ((previous: typeof plotFilter.value) => typeof plotFilter.value)) => {
      plotFilter.value = typeof next === 'function' ? (next as (previous: typeof plotFilter.value) => typeof plotFilter.value)(plotFilter.value) : next;
    };
    const keyword = shallowRef<string>('');
    /** 勾选的设备 */
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const selectedIds = shallowRef<string[]>([]);
    /** 批量操作是否执行中 */
    const setSelectedIds = (next: typeof selectedIds.value | ((previous: typeof selectedIds.value) => typeof selectedIds.value)) => {
      selectedIds.value = typeof next === 'function' ? (next as (previous: typeof selectedIds.value) => typeof selectedIds.value)(selectedIds.value) : next;
    };
    const batchLoading = shallowRef<boolean>(false);

    /** 设备列表 */
    const setBatchLoading = (next: typeof batchLoading.value | ((previous: typeof batchLoading.value) => typeof batchLoading.value)) => {
      batchLoading.value = typeof next === 'function' ? (next as (previous: typeof batchLoading.value) => typeof batchLoading.value)(batchLoading.value) : next;
    };
    const devicesQuery = useQuery(() => ({
      queryKey: ['iot-devices', farmId.value],
      queryFn: () => listDevices({
        pageNum: 1,
        pageSize: 100,
        farmId: farmId.value
      }),
      retry: false
    }));

    /** 地块列表（关联地块名称映射） */
    const plotsQuery = useQuery(() => ({
      queryKey: ['iot-plots', farmId.value],
      queryFn: () => listPlots({
        pageNum: 1,
        pageSize: 100,
        farmId: farmId.value
      }),
      retry: false
    }));
    const plots = computed<Plot[]>(() => unwrapList<Plot>(plotsQuery.data));
    const plotNameMap = computed(() => {
      const map = new Map<string, string>();
      plots.value.forEach(item => map.set(item.plotId, item.plotName));
      return map;
    });

    /** 设备 × 地块绑定关系 */
    const bindingsQuery = useQuery(() => ({
      queryKey: ['iot-bindings-all'],
      queryFn: () => listBoundDevices(),
      retry: false
    }));
    const bindingPlotMap = computed(() => {
      const map = new Map<string, string>();
      unwrapList<IotDevice>(bindingsQuery.data).forEach(row => {
        const plotId = plotIdOf(row);
        if (plotId) map.set(row.deviceId, plotId);
      });
      return map;
    });
    const devices = computed<IotDevice[]>(() => unwrapList<IotDevice>(devicesQuery.data));

    /** 设备类型下拉（按实际台账去重，避免与后端字典不一致） */
    const typeOptions = computed(() => {
      const set = new Set<string>();
      devices.value.forEach(item => {
        const label = deviceTypeLabel(item.deviceType);
        if (label && label !== '-') set.add(label);
      });
      return Array.from(set).map(label => ({
        value: label,
        label
      }));
    });

    /** 过滤后的设备 */
    const filteredDevices = computed(() => devices.value.filter(device => {
      if (statusFilter.value && statusOf(device) !== statusFilter.value) return false;
      if (typeFilter.value && deviceTypeLabel(device.deviceType) !== typeFilter.value) return false;
      const plotId = bindingPlotMap.value.get(device.deviceId) ?? plotIdOf(device);
      if (plotFilter.value && plotId !== plotFilter.value) return false;
      if (keyword.value) {
        const text = `${device.deviceName ?? ''}${device.deviceCode ?? ''}`;
        if (!text.toLowerCase().includes(keyword.value.toLowerCase())) return false;
      }
      return true;
    }));

    /** 状态统计 */
    const stats = computed(() => {
      const online = devices.value.filter(item => statusOf(item) === 1).length;
      const offline = devices.value.filter(item => statusOf(item) === 2).length;
      const fault = devices.value.filter(item => statusOf(item) === 3).length;
      return {
        online,
        offline,
        fault,
        total: devices.value.length
      };
    });

    /** 批量心跳检测 */
    const runBatchHeartbeat = async (): Promise<void> => {
      if (selectedIds.value.length === 0) {
        message.warning('请先勾选需要检测的设备');
        return;
      }
      setBatchLoading(true);
      try {
        const results = await Promise.allSettled(selectedIds.value.map(id => heartbeatDevice(id)));
        const success = results.filter(item => item.status === 'fulfilled').length;
        message.success(`批量心跳完成：成功 ${success} 台 / 共 ${selectedIds.value.length} 台`);
        void queryClient.invalidateQueries({
          queryKey: ['iot-devices']
        });
      } finally {
        setBatchLoading(false);
      }
    };

    /** 表格列定义 */
    const columns = computed<ColumnsType<IotDevice>>(() => [{
      title: '设备名称',
      dataIndex: 'deviceName',
      key: 'deviceName',
      render: (value?: string) => value || '-'
    }, {
      title: '设备编码',
      dataIndex: 'deviceCode',
      key: 'deviceCode',
      render: (value?: string) => value || '-'
    }, {
      title: '类型',
      dataIndex: 'deviceType',
      key: 'deviceType',
      render: (value: IotDevice['deviceType']) => <Tag>{deviceTypeLabel(value)}</Tag>
    }, {
      title: '关联地块',
      key: 'plot',
      render: (_value: unknown, row: IotDevice) => {
        const plotId = bindingPlotMap.value.get(row.deviceId) ?? plotIdOf(row);
        return plotId ? plotNameMap.value.get(plotId) ?? plotId : <Typography.Text type="secondary">未绑定</Typography.Text>;
      }
    }, {
      title: '状态',
      key: 'status',
      render: (_value: unknown, row: IotDevice) => {
        const meta = onlineStatusMeta(statusOf(row));
        return <Tag color={meta.color}>{meta.label}</Tag>;
      }
    }, {
      title: '电量',
      dataIndex: 'battery',
      key: 'battery',
      align: 'right',
      render: (value?: number) => typeof value === 'number' ? `${value}%` : '-'
    }, {
      title: '最后上报',
      dataIndex: 'lastHeartbeatAt',
      key: 'lastHeartbeatAt',
      render: (value?: string) => formatRelative(value)
    }, {
      title: '操作',
      key: 'action',
      render: (_value: unknown, row: IotDevice) => {
        const status = statusOf(row);
        return <Space size={4}>
            <Button type="link" size="small" onClick={() => navigate(`/production/iot/${row.deviceId}`)}>
              详情
            </Button>
            {status === 1 ? <Button type="link" size="small" icon={<ApiOutlined />} onClick={() => navigate(`/production/iot/${row.deviceId}?tab=data`)}>
                数据
              </Button> : <Button type="link" size="small" icon={<ToolOutlined />} onClick={() => navigate(`/production/iot/${row.deviceId}?tab=maintain`)}>
                排查
              </Button>}
          </Space>;
      }
    }]);
    return () => {
      return <div class="production-list-dense production-member-list">
      <Card class="production-dense-filter-card">
        <ProductionListFilters form={form} onFinish={values => {
            setKeyword(values.keyword?.trim() ?? '');
            setStatusFilter(values.status);
            setTypeFilter(values.type);
            setPlotFilter(values.plot);
            setSelectedIds([]);
            setPage(1);
          }} onReset={() => {
                  form.resetFields();
                  form.submit();
                }} loading={devicesQuery.isLoading}>
          <Form.Item name="keyword" label="设备名称 / 编码"><Input allowClear placeholder="请输入名称或编码" /></Form.Item>
          <Form.Item name="status" label="设备状态"><Select allowClear placeholder="全部状态" options={STATUS_OPTIONS} /></Form.Item>
          <Form.Item name="type" label="设备类型"><Select allowClear placeholder="全部类型" options={typeOptions.value} /></Form.Item>
          <Form.Item name="plot" label="关联地块"><Select allowClear placeholder="全部地块" options={plots.value.map(item => ({
                value: item.plotId,
                label: item.plotName
              }))} /></Form.Item>
        </ProductionListFilters>
      </Card>
      {devicesQuery.isError && <Alert type="error" showIcon style={{
          marginBottom: 16
        }} message="设备列表加载失败" description={(devicesQuery.error as Error)?.message ?? '请稍后重试'} />}

      <Card>
        <Table toolbarTitle={<Space wrap>
          <Dropdown menu={{
              items: [{
                key: 'heartbeat',
                label: `批量心跳检测（${selectedIds.value.length}）`
              }, {
                key: 'export',
                label: '导出设备台账'
              }],
              onClick: ({key}: {key:string|number}) => {
                if (key === 'heartbeat') void runBatchHeartbeat();
                if (key === 'export') {
                  if (filteredDevices.value.length === 0) {
                    message.warning('当前没有可导出的设备');
                    return;
                  }
                  exportCsv(filteredDevices.value);
                  message.success(`已导出 ${filteredDevices.value.length} 台设备`);
                }
              }
            }}>
            <Button loading={batchLoading.value}>批量操作 ▾</Button>
          </Dropdown>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/production/iot/bindings')}>
            绑定设备
          </Button>
            <Popover trigger="click" content={`在线 ${stats.value.online} · 离线 ${stats.value.offline} · 故障 ${stats.value.fault} · 共 ${stats.value.total} 台`}><Button>设备统计</Button></Popover>
          </Space>} onReload={() => Promise.all([devicesQuery.refetch(), plotsQuery.refetch(), bindingsQuery.refetch()])} rowKey="deviceId" loading={devicesQuery.isLoading} dataSource={filteredDevices.value} columns={columns.value} locale={{
            emptyText: <Empty description="暂无设备。设备台账在物联网系统中注册，注册后这里即可看到并可绑定" />
          }} rowSelection={{
            selectedRowKeys: selectedIds.value,
            onChange: keys => setSelectedIds(keys as string[])
          }} pagination={{
            current: page.value,
            defaultPageSize: 20,
            onChange: setPage
          }} />
      </Card>
    </div>;
    };
  }
});
export default DeviceList;
