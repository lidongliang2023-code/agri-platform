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
import Table from '@/vue/business/components/BusinessRecordList';
/**
 * 页面名称：设备详情
 * 路由路径：/production/iot/:deviceId
 * 所属模块：IoT设备管理
 * PRD 序号：PRD 6.1 #29（设备信息、实时数据、指令下发、维修记录）
 *
 * 设计决策：
 * - 实时数据：走 `GET /iot/readings/series` 与 `GET /iot/readings/latest`，真实接口
 * - 指令下发 / 维修记录：后端 `prod_iot_command`、`prod_iot_maintenance` 及
 *   `/iot/devices/{id}/commands`、`/iot/devices/{id}/maintenances` 已上线（SE-1，F-IOT-04/05）。
 *   页面直连 `@/api/iot` 原生契约函数（sendCommand / listCommands /
 *   createIotMaintenance / listIotMaintenances），字段严格对齐后端实体：
 *   IotCommand   = commandId / deviceId / commandType / params / status / receipt / sendAt / receiptAt
 *   IotMaintenance = maintainId / deviceId / maintainType / content / operator / maintainAt / result
 * - 指令状态由服务端按设备 `online_flag` + 10 分钟心跳窗口判定并落库（在线 → SUCCESS，
 *   离线 → FAILED「送达失败」），下发接口返回的即为终态；
 *   **页面只渲染服务端返回值，不做任何本地暂存、不做 setTimeout 模拟回执**。
 */

import { useNavigate, useParams, useSearchParams } from '@/vue/router';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { PageContainer as PageContainer } from '@/vue/pro';
import { Alert, Button, Card, Col, DatePicker, Empty, Form, Input, Modal, Row, Select, Skeleton, Space, Statistic, Tabs, Tag, Timeline, Typography, message } from '@/vue/ui';
import { ArrowLeftOutlined, ReloadOutlined, SendOutlined, ToolOutlined } from '@ant-design/icons-vue';
import { DetailInfoGrid } from '@/vue/business/components/index';
import ReactECharts from '@/vue/VueECharts';
import type { EChartsOption } from 'echarts';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { commandStatusMeta, createIotMaintenance, getDevice, getLatestReading, listBoundDevices, listCommands, listIotMaintenances, listReadingSeries, maintainTypeLabel, metricLabel, normalizeMetric, onlineStatusMeta, sendCommand, unwrapList } from '@/api/iot';
import { listPlots } from '@/api/plots';
import type { IotCommand, IotDevice, IotMaintainType, IotMaintenance, Plot } from '@/types';

/** 指令类型选项 */
const COMMAND_TYPES: string[] = ['重启设备', '校准传感器', '开启灌溉', '关闭灌溉', '调整采样频率', '固件升级'];

/** 维修类型选项（对齐后端 maintainType 枚举） */
const MAINTAIN_TYPE_OPTIONS: {
  value: IotMaintainType;
  label: string;
}[] = [{
  value: 'INSPECT',
  label: '巡检'
}, {
  value: 'REPAIR',
  label: '维修'
}, {
  value: 'REPLACE',
  label: '更换'
}, {
  value: 'CALIBRATE',
  label: '校准'
}, {
  value: 'UPGRADE',
  label: '升级'
}];

/** 指令表单值 */
interface CommandFormValues {
  /** 指令类型 */
  type: string;
  /** 指令参数 */
  params?: string;
  /** 操作人 */
  operator: string;
}

/** 维修表单值 */
interface MaintenanceFormValues {
  /** 维修时间 */
  time: Dayjs;
  /** 维修类型 */
  maintainType: IotMaintainType;
  /** 维修内容 */
  content: string;
  /** 操作人 */
  operator: string;
  /** 维修结果 */
  result: string;
}

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
 * 格式化时间串（空值回退占位符）。
 *
 * @param value 时间串
 * @returns 展示文案
 */
function formatTime(value?: string): string {
  if (!value) return '-';
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : value;
}

/**
 * 设备详情页面
 *
 * 业务职责：展示设备档案、实时遥测数据，支持控制指令下发与维修记录登记。
 *
 * @returns 页面内容
 */
const DeviceDetail = defineComponent({
  name: "DeviceDetail",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const _params = useParams<{
      deviceId: string;
    }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const activeTab = computed(() => searchParams.value.get('tab') ?? 'data');

    /** 指标筛选（空表示全部指标） */
    const metric = shallowRef<string | undefined>(undefined);
    /** 指令下发弹窗 */
    const setMetric = (next: typeof metric.value | ((previous: typeof metric.value) => typeof metric.value)) => {
      metric.value = typeof next === 'function' ? (next as (previous: typeof metric.value) => typeof metric.value)(metric.value) : next;
    };
    const commandOpen = shallowRef<boolean>(false);
    /** 维修登记弹窗 */
    const setCommandOpen = (next: typeof commandOpen.value | ((previous: typeof commandOpen.value) => typeof commandOpen.value)) => {
      commandOpen.value = typeof next === 'function' ? (next as (previous: typeof commandOpen.value) => typeof commandOpen.value)(commandOpen.value) : next;
    };
    const maintainOpen = shallowRef<boolean>(false);
    const setMaintainOpen = (next: typeof maintainOpen.value | ((previous: typeof maintainOpen.value) => typeof maintainOpen.value)) => {
      maintainOpen.value = typeof next === 'function' ? (next as (previous: typeof maintainOpen.value) => typeof maintainOpen.value)(maintainOpen.value) : next;
    };
    const [commandForm] = Form.useForm<CommandFormValues>();
    const [maintainForm] = Form.useForm<MaintenanceFormValues>();

    /** 设备详情 */
    const deviceQuery = useQuery(() => ({
      queryKey: ['iot-device', _params.deviceId ?? ''],
      queryFn: () => getDevice(_params.deviceId ?? ''),
      retry: false,
      enabled: Boolean(_params.deviceId ?? '')
    }));
    const device = computed(() => deviceQuery.data);

    /** 遥测时序 */
    const seriesQuery = useQuery(() => ({
      queryKey: ['iot-device-series', _params.deviceId ?? '', metric.value],
      queryFn: () => listReadingSeries(_params.deviceId ?? '', metric.value),
      retry: false,
      enabled: Boolean(_params.deviceId ?? '')
    }));

    /** 最新读数 */
    const latestQuery = useQuery(() => ({
      queryKey: ['iot-device-latest', _params.deviceId ?? ''],
      queryFn: () => getLatestReading(_params.deviceId ?? ''),
      retry: false,
      enabled: Boolean(_params.deviceId ?? '')
    }));

    /**
     * 指令记录（GET /iot/devices/{deviceId}/commands）。
     *
     * 状态由服务端落库，页面直接渲染，不再本地暂存、不再定时轮询模拟。
     */
    const commandsQuery = useQuery(() => ({
      queryKey: ['iot-device-commands', _params.deviceId ?? ''],
      queryFn: () => listCommands(_params.deviceId ?? '', {
        limit: 100
      }),
      retry: false,
      enabled: Boolean(_params.deviceId ?? '')
    }));
    const commands = computed<IotCommand[]>(() => commandsQuery.data ?? []);

    /**
     * 维修记录（GET /iot/devices/{deviceId}/maintenances）。
     */
    const maintenancesQuery = useQuery(() => ({
      queryKey: ['iot-device-maintenances', _params.deviceId ?? ''],
      queryFn: () => listIotMaintenances(_params.deviceId ?? '', 100),
      retry: false,
      enabled: Boolean(_params.deviceId ?? '')
    }));
    const maintenances = computed<IotMaintenance[]>(() => maintenancesQuery.data ?? []);

    /** 绑定地块名称 */
    const plotsQuery = useQuery(() => ({
      queryKey: ['iot-device-plots'],
      queryFn: () => listPlots({
        pageNum: 1,
        pageSize: 100
      }),
      retry: false
    }));
    const plots = computed<Plot[]>(() => unwrapList<Plot>(plotsQuery.data));
    const bindingsQuery = useQuery(() => ({
      queryKey: ['iot-device-bindings'],
      queryFn: () => listBoundDevices(),
      retry: false
    }));
    const boundPlotName = computed(() => {
      const rows = unwrapList<IotDevice>(bindingsQuery.data);
      const row = rows.find(item => item.deviceId === (_params.deviceId ?? ''));
      if (!row) return undefined;
      const plotId = (row as unknown as {
        plotId?: string;
      }).plotId;
      if (!plotId) return undefined;
      return plots.value.find(item => item.plotId === plotId)?.plotName ?? plotId;
    });

    /** 可选指标（来自遥测数据去重） */
    const metricOptions = computed(() => {
      const set = new Set<string>();
      (seriesQuery.data ?? []).forEach(row => {
        const key = normalizeMetric(row.metric);
        if (key) set.add(key);
      });
      return Array.from(set);
    });

    /** 曲线配置 */
    const chartOption = computed<EChartsOption>(() => {
      const rows = (seriesQuery.data ?? []).slice().sort((a, b) => dayjs(a.readTime).valueOf() - dayjs(b.readTime).valueOf());
      const times = Array.from(new Set(rows.map(row => dayjs(row.readTime).format('MM-DD HH:mm'))));
      const groups = new Map<string, Map<string, number>>();
      rows.forEach(row => {
        const key = normalizeMetric(row.metric);
        const time = dayjs(row.readTime).format('MM-DD HH:mm');
        const map = groups.get(key) ?? new Map<string, number>();
        map.set(time, Number(row.metricValue));
        groups.set(key, map);
      });
      return {
        tooltip: {
          trigger: 'axis'
        },
        legend: {
          bottom: 0
        },
        grid: {
          left: 56,
          right: 24,
          top: 24,
          bottom: 48
        },
        xAxis: {
          type: 'category',
          data: times,
          boundaryGap: false
        },
        yAxis: {
          type: 'value',
          name: '指标值'
        },
        series: Array.from(groups.entries()).map(([key, map]) => ({
          name: metricLabel(key),
          type: 'line' as const,
          smooth: true,
          connectNulls: true,
          data: times.map(time => map.get(time) ?? null)
        }))
      };
    });

    /** 遥测明细行 */
    const telemetryRows = computed(() => (seriesQuery.data ?? []).slice().sort((a, b) => dayjs(b.readTime).valueOf() - dayjs(a.readTime).valueOf()).map(row => ({
      key: row.readingId || `${row.metric}-${row.readTime}`,
      time: dayjs(row.readTime).format('YYYY-MM-DD HH:mm'),
      metric: metricLabel(row.metric),
      value: Number(row.metricValue),
      unit: row.unit ?? '-',
      quality: Number(row.qualityFlag ?? 1) === 1
    })));

    /**
     * 下发控制指令（POST /iot/devices/{deviceId}/commands）。
     *
     * 服务端按设备在线状态落库终态并同步返回：在线 → SUCCESS，离线 → FAILED「送达失败」。
     * 页面不做任何模拟，直接按服务端返回的状态提示。
     */
    const commandMutation = useMutation(() => ({
      mutationFn: (values: CommandFormValues) => sendCommand(_params.deviceId ?? '', {
        commandType: values.type,
        params: values.params,
        operator: values.operator
      }),
      onSuccess: (record: IotCommand) => {
        setCommandOpen(false);
        commandForm.resetFields();
        void queryClient.invalidateQueries({
          queryKey: ['iot-device-commands', _params.deviceId ?? '']
        });
        const meta = commandStatusMeta(record.status);
        const receipt = record.receipt ? `：${record.receipt}` : '';
        if (record.status === 'SUCCESS') {
          message.success(`指令「${record.commandType}」${meta.label}${receipt}`);
        } else if (record.status === 'FAILED') {
          message.error(`指令「${record.commandType}」${meta.label}${receipt}`);
        } else {
          message.info(`指令「${record.commandType}」${meta.label}，等待设备回执`);
        }
      },
      onError: (error: Error) => {
        message.error(error.message || '指令下发失败，请稍后重试');
      }
    }));

    /** 登记维修记录（POST /iot/devices/{deviceId}/maintenances） */
    const maintenanceMutation = useMutation(() => ({
      mutationFn: (values: MaintenanceFormValues) => createIotMaintenance(_params.deviceId ?? '', {
        maintainType: values.maintainType,
        content: values.content,
        operator: values.operator,
        result: values.result,
        maintainAt: values.time.format('YYYY-MM-DD HH:mm:ss')
      }),
      onSuccess: () => {
        setMaintainOpen(false);
        maintainForm.resetFields();
        void queryClient.invalidateQueries({
          queryKey: ['iot-device-maintenances', _params.deviceId ?? '']
        });
        message.success('维修记录已登记');
      },
      onError: (error: Error) => {
        message.error(error.message || '维修记录登记失败，请稍后重试');
      }
    }));
    return () => {
      if (deviceQuery.isLoading) {
        return <PageContainer class="production-detail-compact" title="📡 设备详情">
        <Card>
          <Skeleton active paragraph={{
              rows: 8
            }} />
        </Card>
      </PageContainer>;
      }
      if (deviceQuery.isError || !device.value) {
        return <PageContainer class="production-detail-compact" title="📡 设备详情">
        <Alert type="error" showIcon message="设备详情加载失败" description={(deviceQuery.error as Error)?.message ?? '设备不存在或已解绑'} action={<Button size="small" onClick={() => navigate('/production/iot')}>
              返回设备列表
            </Button>} />
      </PageContainer>;
      }
      const statusMeta = onlineStatusMeta(statusOf(device.value));
      const latest = latestQuery.data ?? null;
      return <PageContainer class="production-detail-compact" title={<Space wrap>
          <span>📡 {device.value.deviceName || device.value.deviceCode || '设备详情'}</span>
          <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
        </Space>} subTitle={device.value.deviceCode} onBack={() => navigate('/production/iot')} backIcon={<ArrowLeftOutlined />} extra={<Space>
          <Button icon={<ReloadOutlined />} onClick={() => {
          void queryClient.invalidateQueries({
            queryKey: ['iot-device', _params.deviceId ?? '']
          });
          void queryClient.invalidateQueries({
            queryKey: ['iot-device-series', _params.deviceId ?? '', metric.value]
          });
          void queryClient.invalidateQueries({
            queryKey: ['iot-device-latest', _params.deviceId ?? '']
          });
        }}>
            刷新
          </Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => setCommandOpen(true)}>
            下发指令
          </Button>
        </Space>}>
      {statusOf(device.value) !== 1 && <Alert type="warning" showIcon style={{
          marginBottom: 16
        }} message={`设备当前${statusMeta.label}，控制指令可能无法送达（服务端将判定为「送达失败」），建议先排查设备供电与网络`} />}

      <Card title="📋 基本信息" extra={<Typography.Text type="secondary">
            设备档案由物联网系统统一维护，本页只读
          </Typography.Text>} style={{
          marginBottom: 16
        }}>
        <DetailInfoGrid columns={2} items={[{
            key: 'deviceCode',
            label: '设备编码',
            value: device.value.deviceCode || '-'
          }, {
            key: 'deviceName',
            label: '设备名称',
            value: device.value.deviceName || '-'
          }, {
            key: 'deviceId',
            label: '设备ID',
            value: device.value.deviceId
          }, {
            key: 'model',
            label: '型号',
            value: device.value.model || '-'
          }, {
            key: 'manufacturer',
            label: '厂商',
            value: device.value.manufacturer || '-'
          }, {
            key: 'firmware',
            label: '固件版本',
            value: device.value.firmwareVersion || '-'
          }, {
            key: 'farm',
            label: '所属农场',
            value: device.value.farmName || device.value.farmId || '-'
          }, {
            key: 'plot',
            label: '关联地块',
            value: boundPlotName.value ?? '未绑定'
          }, {
            key: 'location',
            label: '安装位置',
            value: device.value.location || '-'
          }, {
            key: 'lnglat',
            label: '经纬度',
            value: typeof device.value.longitude === 'number' && typeof device.value.latitude === 'number' ? `${device.value.longitude}, ${device.value.latitude}` : '-'
          }, {
            key: 'battery',
            label: '电量',
            value: typeof device.value.battery === 'number' ? `${device.value.battery}%` : '-'
          }, {
            key: 'signal',
            label: '信号强度',
            value: typeof device.value.signal === 'number' ? `${device.value.signal} dBm` : '-'
          }, {
            key: 'heartbeat',
            label: '最近心跳',
            value: device.value.lastHeartbeatAt ? dayjs(device.value.lastHeartbeatAt).format('YYYY-MM-DD HH:mm:ss') : '-'
          }, {
            key: 'createdAt',
            label: '创建时间',
            value: device.value.createdAt ? dayjs(device.value.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'
          }, {
            key: 'updatedAt',
            label: '更新时间',
            value: device.value.updatedAt ? dayjs(device.value.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '-'
          }]} />
      </Card>

      <Card>
        <Tabs activeKey={activeTab.value} onChange={key => setSearchParams({
            tab: key
          })} items={[{
            key: 'data',
            label: '实时数据',
            children: <Space direction="vertical" style={{
              width: '100%'
            }} size={16}>
                  <Row gutter={[12, 12]}>
                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small">
                        <Statistic title={latest ? metricLabel(latest.metric) : '最新指标'} value={latest ? Number(Number(latest.metricValue).toFixed(2)) : '-'} suffix={latest?.unit ?? ''} />
                        <Typography.Text type="secondary" style={{
                      fontSize: 12
                    }}>
                          {latest ? dayjs(latest.readTime).format('YYYY-MM-DD HH:mm') : '暂无读数'}
                        </Typography.Text>
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small">
                        <Statistic title="数据质量" value={latest ? Number(latest.qualityFlag ?? 1) === 1 ? '正常' : '异常' : '-'} valueStyle={{
                      color: latest && Number(latest.qualityFlag ?? 1) !== 1 ? '#cf1322' : '#3f8600'
                    }} />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small">
                        <Statistic title="遥测点数" value={telemetryRows.value.length} suffix="条" />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small">
                        <Statistic title="运行状态" value={statusMeta.label} valueStyle={{
                      color: statusMeta.color === 'green' ? '#3f8600' : '#cf1322'
                    }} />
                      </Card>
                    </Col>
                  </Row>

                  <Card size="small" title="遥测曲线" extra={<Space>
                        <Select allowClear style={{
                  width: 180
                }} placeholder="全部指标" value={metric.value} options={metricOptions.value.map(item => ({
                  value: item,
                  label: metricLabel(item)
                }))} onChange={setMetric} />
                        <Button icon={<ReloadOutlined />} onClick={() => void queryClient.invalidateQueries({
                  queryKey: ['iot-device-series', _params.deviceId ?? '', metric.value]
                })}>
                          刷新曲线
                        </Button>
                      </Space>}>
                    {seriesQuery.isLoading ? <Skeleton active paragraph={{
                  rows: 5
                }} /> : telemetryRows.value.length === 0 ? <Empty description="该设备暂无遥测数据" /> : <ReactECharts option={chartOption.value} style={{
                  height: 300
                }} notMerge />}
                  </Card>

                  <Table size="small" rowKey="key" loading={seriesQuery.isLoading} dataSource={telemetryRows.value} pagination={{
                pageSize: 8,
                showTotal: value => `共 ${value} 条`
              }} locale={{
                emptyText: <Empty description="暂无遥测明细" />
              }} columns={[{
                title: '采集时间',
                dataIndex: 'time',
                key: 'time'
              }, {
                title: '指标',
                dataIndex: 'metric',
                key: 'metric'
              }, {
                title: '数值',
                dataIndex: 'value',
                key: 'value'
              }, {
                title: '单位',
                dataIndex: 'unit',
                key: 'unit'
              }, {
                title: '数据质量',
                dataIndex: 'quality',
                key: 'quality',
                render: (value: boolean) => <Tag color={value ? 'green' : 'red'}>{value ? '正常' : '异常'}</Tag>
              }]} />
                </Space>
          }, {
            key: 'commands',
            label: `指令记录（${commands.value.length}）`,
            children: <Space direction="vertical" style={{
              width: '100%'
            }} size={12}>
                  <Space wrap>
                    <Button type="primary" icon={<SendOutlined />} onClick={() => setCommandOpen(true)}>
                      + 下发指令
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={() => void queryClient.invalidateQueries({
                  queryKey: ['iot-device-commands', _params.deviceId ?? '']
                })}>
                      刷新
                    </Button>

                  </Space>
                  <Table size="small" rowKey="commandId" loading={commandsQuery.isLoading} dataSource={commands.value} locale={{
                emptyText: <Empty description="暂无指令记录" />
              }} pagination={false} columns={[{
                title: '指令单号',
                dataIndex: 'commandId',
                key: 'commandId'
              }, {
                title: '下发时间',
                dataIndex: 'sendAt',
                key: 'sendAt',
                render: (value?: string) => formatTime(value)
              }, {
                title: '指令类型',
                dataIndex: 'commandType',
                key: 'commandType'
              }, {
                title: '参数',
                dataIndex: 'params',
                key: 'params',
                render: (value?: string) => value || '-'
              }, {
                title: '操作人',
                dataIndex: 'operator',
                key: 'operator',
                render: (value?: string) => value || '-'
              }, {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (status: IotCommand['status']) => {
                  const meta = commandStatusMeta(status);
                  return <Tag color={meta.color}>{meta.label}</Tag>;
                }
              }, {
                title: '回执',
                dataIndex: 'receipt',
                key: 'receipt',
                render: (value?: string) => value || '-'
              }, {
                title: '回执时间',
                dataIndex: 'receiptAt',
                key: 'receiptAt',
                render: (value?: string) => formatTime(value)
              }]} />
                </Space>
          }, {
            key: 'maintain',
            label: `维修记录（${maintenances.value.length}）`,
            children: <Space direction="vertical" style={{
              width: '100%'
            }} size={12}>
                  <Button icon={<ToolOutlined />} onClick={() => {
                maintainForm.setFieldsValue({
                  time: dayjs(),
                  maintainType: 'REPAIR'
                });
                setMaintainOpen(true);
              }}>
                    + 登记维修
                  </Button>
                  {maintenances.value.length === 0 ? <Empty description="暂无维修记录" /> : <Timeline items={maintenances.value.map(item => ({
                color: 'blue',
                children: <Space direction="vertical" size={2}>
                            <Space wrap size={8}>
                              <Tag color="geekblue">{maintainTypeLabel(item.maintainType)}</Tag>
                              <Typography.Text strong>{item.content}</Typography.Text>
                              <Typography.Text type="secondary">{formatTime(item.maintainAt)}</Typography.Text>
                            </Space>
                            <Typography.Text>维修结果：{item.result || '-'}</Typography.Text>
                            <Typography.Text type="secondary">
                              操作人：{item.operator || '-'}
                            </Typography.Text>
                          </Space>
              }))} />}
                </Space>
          }]} />
      </Card>

      <Modal class="production-form-dialog" title="下发控制指令" open={commandOpen.value} onCancel={() => setCommandOpen(false)} onOk={() => commandForm.submit()} confirmLoading={commandMutation.isPending} okText="下发" cancelText="取消" destroyOnClose>
        <Form form={commandForm} layout="vertical" onFinish={values => commandMutation.mutate(values)} preserve={false}>
          <Form.Item name="type" label="指令类型" rules={[{
              required: true,
              message: '请选择指令类型'
            }]}>
            <Select options={COMMAND_TYPES.map(item => ({
                value: item,
                label: item
              }))} />
          </Form.Item>
          <Form.Item name="params" label="指令参数">
            <Input placeholder="如：频率=5分钟 / 阀门=A区" />
          </Form.Item>
          <Form.Item name="operator" label="操作人" rules={[{
              required: true,
              message: '请填写操作人'
            }]}>
            <Input placeholder="如：张三" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal class="production-form-dialog" title="登记维修记录" open={maintainOpen.value} onCancel={() => setMaintainOpen(false)} onOk={() => maintainForm.submit()} confirmLoading={maintenanceMutation.isPending} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={maintainForm} layout="vertical" onFinish={values => maintenanceMutation.mutate(values)} preserve={false}>
          <Form.Item name="time" label="维修时间" rules={[{
              required: true,
              message: '请选择维修时间'
            }]}>
            <DatePicker showTime style={{
                width: '100%'
              }} />
          </Form.Item>
          <Form.Item name="maintainType" label="维修类型" rules={[{
              required: true,
              message: '请选择维修类型'
            }]}>
            <Select options={MAINTAIN_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="content" label="维修内容" rules={[{
              required: true,
              message: '请填写维修内容'
            }]}>
            <Input.TextArea rows={2} placeholder="如：土壤传感器数据跳变，更换探头并重新校准" />
          </Form.Item>
          <Form.Item name="operator" label="操作人" rules={[{
              required: true,
              message: '请填写操作人'
            }]}>
            <Input placeholder="如：李四" />
          </Form.Item>
          <Form.Item name="result" label="维修结果">
            <Input.TextArea rows={2} placeholder="如：更换探头并重新校准，数据恢复正常" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>;
    };
  }
});
export default DeviceDetail;
