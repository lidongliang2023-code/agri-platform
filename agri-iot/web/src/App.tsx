import CommandReceipts from '../../shared-ui/CommandReceipts'
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertOutlined,
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  SearchOutlined,
  SlidersOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Segmented,
  Select,
  Switch,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  iotApi,
  STATUS,
  type AlertJudgement,
  type AlertRule,
  type AlertRuleOptions,
  type AlertRuleView,
  type RiskReading,
  type IotAlert,
  type IotDevice,
  type IotDeviceType,
  type IotGateway,
  type IotGroup,
  type IotOverview,
  type IotPlot,
  type IotProductionFarm,
  type IotRule,
  type IotScene,
} from "./api/iotExperience";
import { downloadCsv, stampFilename } from "../../shared-ui/exportCsv";
import { useClock } from "../../shared-ui/clock";
import "./iot-app.css";
import UnifiedSsoGate, {
  logoutUnified,
  useUnifiedUser,
} from "../../shared-ui/sso";
import { TiandituMap, type TiandituMapPoint } from "@agri/shared";

type Page =
  | "dashboard"
  | "monitor"
  | "devices"
  | "gateways"
  | "plots"
  | "alerts"
  | "automation"
  | "analytics"
  | "maintenance"
  | "messages";
const PAGES: Page[] = [
  "dashboard",
  "monitor",
  "devices",
  "gateways",
  "plots",
  "alerts",
  "automation",
  "analytics",
  "maintenance",
  "messages",
];
const TITLES: Record<Page, string> = {
  dashboard: "监测工作台",
  monitor: "实时监测大屏",
  devices: "设备管理",
  gateways: "边缘网关",
  plots: "地块监测",
  alerts: "预警中心",
  automation: "场景与自动化",
  analytics: "数据分析",
  maintenance: "运维与 OTA",
  messages: "消息中心",
};
const MENU: Array<{
  group: string;
  items: Array<{ page: Page; label: string; icon: ReactNode }>;
}> = [
  {
    group: "运营监控",
    items: [
      { page: "dashboard", label: "监测工作台", icon: <DashboardOutlined /> },
    ],
  },
  {
    group: "设备资产",
    items: [
      { page: "devices", label: "设备管理", icon: <CloudServerOutlined /> },
      { page: "gateways", label: "边缘网关", icon: <ApiOutlined /> },
      { page: "plots", label: "地块监测", icon: <EnvironmentOutlined /> },
    ],
  },
  {
    group: "告警与控制",
    items: [
      { page: "alerts", label: "预警中心", icon: <AlertOutlined /> },
      { page: "automation", label: "场景与自动化", icon: <SlidersOutlined /> },
    ],
  },
  {
    group: "分析与运维",
    items: [
      { page: "analytics", label: "数据分析", icon: <BarChartOutlined /> },
      { page: "maintenance", label: "运维与 OTA", icon: <ToolOutlined /> },
    ],
  },
  {
    group: "我的",
    items: [{ page: "messages", label: "消息中心", icon: <MessageOutlined /> }],
  },
];
function Status({ value }: { value: string }) {
  const s = STATUS[value] ?? { label: value, tone: "gray" };
  return <Tag className={`iot-status tone-${s.tone}`}>{s.label}</Tag>;
}
function PageTitle({
  title,
  desc,
  actions,
}: {
  title: string;
  desc: string;
  actions?: ReactNode;
}) {
  return (
    <div className="iot-title">
      <div>
        <span>IOT ASSET OPERATIONS</span>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {actions && <div className="iot-actions">{actions}</div>}
    </div>
  );
}
function Loading() {
  return (
    <div className="iot-loading">
      <i />
      <i />
      <i />
    </div>
  );
}

/**
 * 空态提示。
 *
 * 后端按经营主体过滤后，"这里还没有数据"是一个正常状态（刚入驻、还没接设备）。
 * 没有空态时页面会呈现一片空白，用户分不清是接口失败还是确实没数据。
 */
function EmptyHint({
  icon = "📡",
  title,
  desc,
}: {
  icon?: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="device-empty-state">
      <span>{icon}</span>
      <div>
        <b>{title}</b>
        <small>{desc}</small>
      </div>
    </div>
  );
}

/** 顶栏未读消息数：以前固定显示 2 条，与消息中心的真实未读数无关。 */
function MessageBadge({ onOpen }: { onOpen: () => void }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    void iotApi
      .messages()
      .then((items) => setUnread(items.filter((item) => !item.read).length))
      .catch(() => setUnread(0));
  }, []);
  return (
    <button type="button" onClick={onOpen}>
      <BellOutlined />
      {unread > 0 ? <i>{unread}</i> : null}
    </button>
  );
}

function Dashboard() {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<IotOverview | null>(null);
  useEffect(() => {
    void iotApi
      .overview()
      .then(setData)
      .catch((e: Error) => message.error(e.message));
  }, [message]);
  if (!data) return <Loading />;
  const max = Math.max(...data.series.map((s) => s.temperature), 1);
  return (
    <div className="iot-page">
      <PageTitle
        title="物联网工作台"
        desc="设备、环境、告警与自动化运行状态的一体化工作台。"
        actions={
          <>
            <Button onClick={() => void iotApi.overview().then(setData)}>
              刷新数据
            </Button>
            <Button type="primary" onClick={() => navigate("/monitor")}>
              进入监测大屏
            </Button>
          </>
        }
      />
      <section className="farm-banner">
        <span className="farm-icon">🌾</span>
        <div>
          <Status value={data.farm.status} />
          <h2>{data.farm.farmName}</h2>
          <p>
            {data.farm.address} · {data.farm.area} 亩 · 负责人{" "}
            {data.farm.manager}
          </p>
        </div>
        <div className="farm-stats">
          <span>
            <small>设备在线</small>
            <b>
              {data.stats.online}
              <em>/{data.stats.devices}</em>
            </b>
          </span>
          <span>
            <small>地块</small>
            <b>{data.stats.plots}</b>
          </span>
          <span>
            <small>今日告警</small>
            <b className="red">{data.stats.alerts}</b>
          </span>
          <span>
            <small>数据点</small>
            <b>{data.stats.dataToday.toLocaleString()}</b>
          </span>
        </div>
      </section>
      <div className="iot-metrics">
        <Metric
          icon={<CloudServerOutlined />}
          label="设备总数"
          value={String(data.stats.devices)}
          hint={`在线 ${data.stats.online} · 离线 ${data.stats.offline}`}
          tone="green"
        />
        <Metric
          icon={<EnvironmentOutlined />}
          label="地块监测"
          value={String(data.stats.plots)}
          hint="环境与土壤数据持续采集"
          tone="blue"
        />
        <Metric
          icon={<AlertOutlined />}
          label="待处理告警"
          value={String(data.stats.alerts)}
          hint="红警优先处置"
          tone="red"
        />
        <Metric
          icon={<PoweroffOutlined />}
          label="今日控制"
          value={String(data.stats.todayControl)}
          hint="远程控制指令"
          tone="amber"
        />
      </div>
      <div className="iot-two-grid">
        <section className="iot-card">
          <CardHead title="实时环境" sub="当前作物环境" />
          <div className="env-grid">
            {data.environment.map((item) => (
              <div key={item.key}>
                <span className="env-icon">{envIcon(item.key)}</span>
                <small>{item.name}</small>
                <b>
                  {item.value}
                  <em>{item.unit}</em>
                </b>
                <span className={item.change >= 0 ? "up" : "down"}>
                  {item.change > 0 ? "+" : ""}
                  {item.change}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="iot-card">
          <CardHead title="当前场景" sub="自动控制运行中" />
          <div className="active-scene">
            <span>{data.activeScene?.icon}</span>
            <div>
              <b>{data.activeScene?.sceneName || "未启用场景"}</b>
              <p>{data.activeScene?.description}</p>
              <Status
                value={data.activeScene?.active ? "running" : "pending"}
              />
            </div>
          </div>
          <div className="scene-quick">
            {data.recentControls.slice(0, 3).map((log) => (
              <div key={log.id}>
                <b>{log.deviceName}</b>
                <span>
                  {log.action} · {log.createdAt}
                </span>
                <small>{log.result}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="iot-two-grid">
        <section className="iot-card">
          <CardHead title="环境趋势" sub="温度 / 湿度 / 土壤" />
          <div className="line-chart">
            {data.series.map((s) => (
              <div key={s.time}>
                <div className="line-bars">
                  <span style={{ height: `${(s.temperature / max) * 100}%` }} />
                  <i style={{ height: `${s.humidity}%` }} />
                  <em style={{ height: `${s.soilMoisture}%` }} />
                </div>
                <small>{s.time}</small>
              </div>
            ))}
          </div>
          <div className="legend">
            <span>
              <i className="green" />
              温度
            </span>
            <span>
              <i className="blue" />
              湿度
            </span>
            <span>
              <i className="amber" />
              土壤
            </span>
          </div>
        </section>
        <section className="iot-card">
          <CardHead title="设备类型" sub="当前农场" />
          <div className="type-list">
            {data.deviceTypes.map((t) => (
              <div key={t.name}>
                <span>{t.icon}</span>
                <b>{t.name}</b>
                <em>{t.value}</em>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="iot-card">
        <CardHead
          title="最新告警"
          sub="优先处理高等级告警"
          extra={
            <Button size="small" onClick={() => navigate("/alerts")}>
              查看全部
            </Button>
          }
        />
        <div className="alert-list">
          {data.alerts.map((a) => (
            <button
              type="button"
              key={a.id}
              onClick={() => navigate("/alerts")}
            >
              <span className={`level-${a.level}`}>
                <AlertOutlined />
              </span>
              <div>
                <b>{a.title}</b>
                <p>
                  {a.deviceName} · {a.content}
                </p>
                <small>
                  {a.createdAt} · {a.alertNo}
                </small>
              </div>
              <Status value={a.status} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className={`iot-metric tone-${tone}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
        <em>{hint}</em>
      </div>
    </div>
  );
}
function CardHead({
  title,
  sub,
  extra,
}: {
  title: string;
  sub: string;
  extra?: ReactNode;
}) {
  return (
    <div className="iot-card-head">
      <div>
        <b>{title}</b>
        <small>{sub}</small>
      </div>
      {extra}
    </div>
  );
}
function envIcon(key: string) {
  return key === "temperature"
    ? "🌡️"
    : key === "humidity"
      ? "💧"
      : key === "soil_moisture"
        ? "🌱"
        : key === "light"
          ? "☀️"
          : "🌫️";
}

function Monitor() {
  const { message } = AntApp.useApp();
  const clock = useClock();
  const [data, setData] = useState<IotOverview | null>(null);
  useEffect(() => {
    void iotApi
      .overview()
      .then(setData)
      .catch((e: Error) => message.error(e.message));
  }, [message]);
  if (!data) return <Loading />;
  return (
    <div className="monitor-screen">
      <header>
        <div>
          <span>GREENHOUSE LIVE MONITOR</span>
          <h1>{data.farm.farmName} · 物联网实时监测大屏</h1>
          <p>{clock.date} {clock.time} · 读数来自设备最近一次上报</p>
        </div>
        <div>
          <i />
          数据在线
          <Button onClick={() => void iotApi.overview().then(setData)}>
            刷新
          </Button>
        </div>
      </header>
      <div className="monitor-kpis">
        <div>
          <small>在线设备</small>
          <b>
            {data.stats.online}
            <em>台</em>
          </b>
          <span>
            在线率 {((data.stats.online / data.stats.devices) * 100).toFixed(1)}
            %
          </span>
        </div>
        <div>
          <small>环境告警</small>
          <b className="red">
            {data.stats.alerts}
            <em>条</em>
          </b>
          <span>优先处置红警</span>
        </div>
        <div>
          <small>今日数据</small>
          <b>{data.stats.dataToday.toLocaleString()}</b>
          <span>遥测数据点</span>
        </div>
        <div>
          <small>控制指令</small>
          <b>{data.stats.todayControl}</b>
          <span>成功率 99.1%</span>
        </div>
      </div>
      <div className="monitor-center">
        <section className="monitor-panel">
          <h3>环境趋势</h3>
          <div className="monitor-chart">
            {data.series.map((s) => (
              <div key={s.time}>
                <span style={{ height: `${(s.temperature / 35) * 100}%` }} />
                <i style={{ height: `${s.humidity}%` }} />
                <em style={{ height: `${s.soilMoisture}%` }} />
              </div>
            ))}
          </div>
        </section>
        <section className="monitor-radar">
          <div className="radar-circle">
            <span className="point p1" />
            <span className="point p2" />
            <span className="point p3" />
            <b>1号温室</b>
            <em>环境正常</em>
          </div>
          <div className="monitor-gateway">
            GW001 · 48 台设备在线
            <br />
            <small>LoRa + 4G · v3.1.0</small>
          </div>
        </section>
        <section className="monitor-panel">
          <h3>实时告警</h3>
          {data.alerts.slice(0, 4).map((a) => (
            <div className="monitor-alert" key={a.id}>
              <Status value={a.level} />
              <div>
                <b>{a.title}</b>
                <small>
                  {a.deviceName} · {a.createdAt}
                </small>
              </div>
            </div>
          ))}
        </section>
      </div>
      <div className="monitor-bottom">
        {data.plots.slice(0, 4).map((p) => (
          <div key={p.id}>
            <span>🌱</span>
            <div>
              <b>{p.plotName}</b>
              <small>
                {p.cropName} · {p.cropStage}
              </small>
            </div>
            <em>
              {p.onlineCount}/{p.deviceCount}
            </em>
          </div>
        ))}
      </div>
    </div>
  );
}

function Devices() {
  const { message } = AntApp.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const initialPlotId = Number(new URLSearchParams(location.search).get("plotId")) || undefined;
  const [items, setItems] = useState<IotDevice[]>([]),
    [groups, setGroups] = useState<IotGroup[]>([]),
    [gateways, setGateways] = useState<IotGateway[]>([]),
    [deviceTypes, setDeviceTypes] = useState<IotDeviceType[]>([]),
    [plots, setPlots] = useState<IotPlot[]>([]),
    [farms, setFarms] = useState<IotProductionFarm[]>([]),
    [keyword, setKeyword] = useState(new URLSearchParams(location.search).get("keyword") || ""),
    [status, setStatus] = useState("all"),
    [group, setGroup] = useState<number | undefined>(),
    [plotFilter, setPlotFilter] = useState<number | undefined>(initialPlotId),
    [detail, setDetail] = useState<IotDevice | null>(null),
    [addOpen, setAddOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [registering, setRegistering] = useState(false),
    [form] = Form.useForm();
  const selectedTypeId = Form.useWatch("typeId", form);
  const selectedFarmId = Form.useWatch("farmId", form);
  const selectedType = deviceTypes.find((item) => item.id === selectedTypeId);
  const selectedFarm = farms.find((item) => item.id === selectedFarmId);
  const selectedFarmGateways = gateways.filter((item) => item.farmId === selectedFarmId);
  const loadDevices = async () => {
    setLoading(true);
    try {
      setItems(
        await iotApi.devices({
          keyword: keyword.trim() || undefined,
          status: status === "all" ? undefined : status,
          groupId: group,
          plotId: plotFilter,
        }),
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "设备列表加载失败");
    } finally {
      setLoading(false);
    }
  };
  const loadOptions = async () => {
    const [groupRows, gatewayRows, typeRows, farmRows] = await Promise.all([
      iotApi.groups(),
      iotApi.gateways(),
      iotApi.deviceTypes(),
      iotApi.farms(),
    ]);
    setGroups(groupRows);
    setGateways(gatewayRows);
    setDeviceTypes(typeRows);
    setFarms(farmRows);
    try {
      setPlots(await iotApi.plots());
    } catch {
      setPlots([]);
    }
    return { groupRows, gatewayRows, typeRows, farmRows };
  };
  useEffect(() => {
    void loadDevices();
  }, [status, group, plotFilter]);
  useEffect(() => {
    void loadOptions().catch((error: Error) => message.error(error.message));
  }, []);
  const open = (id: number) =>
    void iotApi
      .device(id)
      .then(setDetail)
      .catch((e: Error) => message.error(e.message));
  const control = async (action: string) => {
    if (!detail) return;
    try {
      const result = await iotApi.control(detail.id, action);
      // 申请与设备执行结果分别展示，以设备回执为准
      message.success(String(result.message ?? "控制申请已登记"));
      open(detail.id);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "控制失败");
    }
  };
  const openCreate = async () => {
    try {
      const options = await loadOptions();
      const defaultFarm =
        options.farmRows.find((farm) => options.gatewayRows.some((gateway) => gateway.farmId === farm.id)) ??
        options.farmRows[0];
      const defaultGateway =
        options.gatewayRows.find((gateway) => gateway.farmId === defaultFarm?.id && gateway.onlineStatus === "online") ??
        options.gatewayRows.find((gateway) => gateway.farmId === defaultFarm?.id);
      form.resetFields();
      form.setFieldsValue({
        typeId: options.typeRows[0]?.id,
        farmId: defaultFarm?.id,
        groupId: options.groupRows.find((item) => item.isDefault)?.id ?? options.groupRows[0]?.id,
        gatewayId: defaultGateway?.id,
        controlCapable: options.typeRows[0]?.category?.includes("控制") ?? false,
        firmwareVersion: "v1.0.0",
        config: '{"reportInterval":30}',
      });
      setAddOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "注册选项加载失败");
    }
  };
  const selectType = (typeId: number) => {
    const type = deviceTypes.find((item) => item.id === typeId);
    form.setFieldValue("controlCapable", type?.category?.includes("控制") ?? false);
  };
  const selectFarm = (farmId: number) => {
    const gateway =
      gateways.find((item) => item.farmId === farmId && item.onlineStatus === "online") ??
      gateways.find((item) => item.farmId === farmId);
    form.setFieldsValue({
      gatewayId: gateway?.id,
      plotId: undefined,
    });
  };
  const create = async () => {
    try {
      const values = await form.validateFields();
      ensureJsonObject(String(values.config || "{}"), "设备扩展配置");
      const plot = plots.find((item) => item.id === values.plotId);
      setRegistering(true);
      const created = await iotApi.createDevice({
        ...values,
        deviceCode: String(values.deviceCode).trim().toUpperCase(),
        deviceName: String(values.deviceName).trim(),
        latitude: plot?.latitude,
        longitude: plot?.longitude,
      });
      setAddOpen(false);
      form.resetFields();
      setDetail(created);
      message.success(`设备 ${created.deviceCode} 注册成功，等待首次上报`);
      await loadDevices();
      await loadOptions();
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setRegistering(false);
    }
  };
  const resetFilters = async () => {
    setKeyword("");
    setStatus("all");
    setGroup(undefined);
    setPlotFilter(undefined);
    navigate("/devices", { replace: true });
    setLoading(true);
    try {
      setItems(await iotApi.devices());
    } catch (error) {
      message.error(error instanceof Error ? error.message : "设备列表加载失败");
    } finally {
      setLoading(false);
    }
  };
  const columns: ColumnsType<IotDevice> = [
    {
      title: "设备",
      dataIndex: "deviceName",
      render: (_, r) => (
        <button
          type="button"
          className="entity-link"
          onClick={() => open(r.id)}
        >
          <span>{typeIcon(r.typeName)}</span>
          <div>
            <b>{r.deviceName}</b>
            <small>{r.deviceCode}</small>
          </div>
        </button>
      ),
    },
    {
      title: "类型 / 协议",
      render: (_, r) => (
        <div className="entity-copy">
          <b>{r.typeName}</b>
          <small>{r.protocol} · {r.controlCapable ? "支持远程控制" : "仅数据采集"}</small>
        </div>
      ),
    },
    {
      title: "安装位置",
      render: (_, r) => {
        const farm = farms.find((item) => item.id === r.farmId);
        const plot = plots.find((item) => item.id === r.plotId);
        const gateway = gateways.find((item) => item.id === r.gatewayId);
        return (
          <div className="entity-copy">
            <b>{farm?.farmName || `农场 #${r.farmId}`}</b>
            <small>{plot ? `${plot.plotName} · ${gateway?.gatewayName || "未绑定网关"}` : `未绑定地块 · ${gateway?.gatewayName || "未绑定网关"}`}</small>
          </div>
        );
      },
    },
    {
      title: "设备分组",
      render: (_, r) => groups.find((item) => item.id === r.groupId)?.name || "未分组",
    },
    {
      title: "状态",
      dataIndex: "onlineStatus",
      render: (v, r) => (
        <div className="device-state">
          <Status value={v} />
          <small>{r.onlineStatus === "offline" ? r.lastReport : "实时在线"}</small>
        </div>
      ),
    },
    {
      title: "连接质量",
      render: (_, r) => (
        <div className="device-health">
          <span>信号 {r.rssi == null ? "—" : `${r.rssi} dBm`}</span>
          <div>
            <Progress
              percent={r.battery}
              size="small"
              showInfo={false}
              strokeColor={r.battery < 30 ? "#c54b4b" : "#159a5e"}
            />
            <small>电量 {r.battery}%</small>
          </div>
        </div>
      ),
    },
    {
      title: "操作",
      render: (_, r) => (
        <Button type="link" onClick={() => open(r.id)}>
          {r.controlCapable ? "详情与控制" : "查看详情"}
        </Button>
      ),
    },
  ];
  return (
    <div className="iot-page">
      <PageTitle
        title="设备管理"
        desc="统一管理设备身份、接入拓扑、运行状态与远程控制。"
        actions={
          <>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadDevices()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => void openCreate()}>
              注册设备
            </Button>
          </>
        }
      />
      <div className="device-summary">
        <div>
          <span className="tone-green"><CloudServerOutlined /></span>
          <small>当前设备</small>
          <b>{items.length}</b>
          <em>筛选结果</em>
        </div>
        <div>
          <span className="tone-blue"><ApiOutlined /></span>
          <small>在线设备</small>
          <b>{items.filter((item) => item.onlineStatus === "online").length}</b>
          <em>稳定接入</em>
        </div>
        <div>
          <span className="tone-red"><AlertOutlined /></span>
          <small>异常 / 离线</small>
          <b>{items.filter((item) => item.onlineStatus !== "online").length}</b>
          <em>需要关注</em>
        </div>
        <div>
          <span className="tone-orange"><ThunderboltOutlined /></span>
          <small>远程可控</small>
          <b>{items.filter((item) => item.controlCapable).length}</b>
          <em>支持下发指令</em>
        </div>
      </div>
      <section className="iot-card iot-filter">
        <div className="iot-filter-main">
          <Input
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={() => void loadDevices()}
            allowClear
            placeholder="输入设备名称或编码"
          />
          <Select
            value={status}
            onChange={setStatus}
            options={["all", "online", "offline", "alert"].map((v) => ({
              value: v,
              label: STATUS[v]?.label || "全部状态",
            }))}
          />
          <Select
            allowClear
            value={group}
            onChange={setGroup}
            placeholder="全部设备分组"
            options={groups.map((g) => ({
              value: g.id,
              label: `${g.icon} ${g.name}`,
            }))}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            value={plotFilter}
            onChange={setPlotFilter}
            placeholder="全部地块"
            options={plots.map((plot) => ({
              value: plot.id,
              label: `${plot.plotName} · ${plot.plotCode}`,
            }))}
          />
          <Button type="primary" onClick={() => void loadDevices()}>查询</Button>
          <Button onClick={() => void resetFilters()}>
            重置
          </Button>
        </div>
        <span className="filter-result">共 {items.length} 台设备</span>
      </section>
      <section className="iot-card iot-table device-table-card">
        <CardHead title="设备清单" sub="按实时连接状态排序，点击设备查看遥测与控制记录" />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          scroll={{ x: 1050 }}
          pagination={{
            pageSize: 8,
            showSizeChanger: true,
            pageSizeOptions: [8, 16, 32],
            showTotal: (total) => `共 ${total} 台设备`,
          }}
        />
      </section>
      <Modal
        title="设备详情"
        open={Boolean(detail)}
        width={780}
        onCancel={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>关闭</Button>}
      >
        {detail && (
          <div className="device-detail">
            <div className="device-hero">
              <span>{typeIcon(detail.typeName)}</span>
              <div>
                <Status value={detail.onlineStatus} />
                <h2>{detail.deviceName}</h2>
                <p>
                  {detail.deviceCode} · {detail.typeName} · {detail.protocol}
                </p>
              </div>
              <div>
                <small>固件</small>
                <b>{detail.firmwareVersion}</b>
                <small>最近上报</small>
                <b>{detail.lastReport}</b>
              </div>
            </div>
            {detail.telemetry?.length ? (
              <div className="telemetry-grid">
                {detail.telemetry.map((t) => (
                  <div key={t.key}>
                    <small>{t.name}</small>
                    <b>
                      {t.value}
                      <em>{t.unit}</em>
                    </b>
                    <span>{t.recordedAt}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="device-empty-state">
                <span>📡</span>
                <div>
                  <b>等待首次数据上报</b>
                  <small>设备已注册并绑定网关，上线后将在此展示实时遥测。</small>
                </div>
              </div>
            )}
            {detail.controlCapable && (
              <div className="control-panel">
                <b>远程控制</b>
                <div>
                  <Button
                    icon={<PlayCircleOutlined />}
                    onClick={() => void control("开启设备")}
                  >
                    开启
                  </Button>
                  <Button
                    icon={<PoweroffOutlined />}
                    onClick={() => void control("关闭设备")}
                  >
                    关闭
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => void control("重启设备")}
                  >
                    重启
                  </Button>
                </div>
              </div>
            )}
            <div className="device-history">
              <b>设备指令与回执</b>
              <CommandReceipts key={detail.id} deviceId={detail.id} load={iotApi.commandReceipts} />
            </div>
          </div>
        )}
      </Modal>
      <Modal
        title="注册新设备"
        open={addOpen}
        width={820}
        maskClosable={false}
        onCancel={() => {
          setAddOpen(false);
          form.resetFields();
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setAddOpen(false);
              form.resetFields();
            }}
          >
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<PlusOutlined />}
            loading={registering}
            onClick={() => void create()}
          >
            确认注册
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <div className="register-intro">
            <span>📡</span>
            <div>
              <b>建立设备数字身份</b>
              <small>设备注册后初始为离线状态，首次数据上报时自动转为在线。</small>
            </div>
          </div>

          <div className="register-section-title">
            <b>01 设备身份</b>
            <span>编码用于平台唯一识别，请与设备铭牌保持一致</span>
          </div>
          <div className="form-grid">
            <Form.Item
              label="设备编码"
              name="deviceCode"
              rules={[
                { required: true, whitespace: true, message: "请输入设备编码" },
                {
                  pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{2,59}$/,
                  message: "编码需为 3-60 位字母、数字、横线或下划线",
                },
              ]}
            >
              <Input
                maxLength={60}
                placeholder="例如 DEV-TEM-101"
                onBlur={(event) =>
                  form.setFieldValue("deviceCode", event.target.value.trim().toUpperCase())
                }
              />
            </Form.Item>
            <Form.Item
              label="设备名称"
              name="deviceName"
              rules={[{ required: true, whitespace: true, message: "请输入设备名称" }]}
            >
              <Input maxLength={160} placeholder="例如 3号棚东侧温湿度传感器" />
            </Form.Item>
          </div>
          <div className="form-grid">
            <Form.Item
              label="设备类型"
              name="typeId"
              rules={[{ required: true, message: "请选择设备类型" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择设备类型"
                onChange={selectType}
                options={deviceTypes.map((item) => ({
                  value: item.id,
                  label: `${item.icon} ${item.name} · ${item.protocol}`,
                }))}
              />
            </Form.Item>
            <Form.Item label="初始固件版本" name="firmwareVersion">
              <Input maxLength={40} placeholder="例如 v1.0.0" />
            </Form.Item>
          </div>
          {selectedType && (
            <div className="device-type-summary">
              <span>{selectedType.icon}</span>
              <div>
                <b>{selectedType.name}</b>
                <small>{selectedType.category} · {selectedType.protocol} · {selectedType.manufacturer || "未配置厂商"} · {selectedType.model || "通用型号"}</small>
              </div>
              <div className="property-tags">
                {selectedType.properties.slice(0, 4).map((property) => (
                  <Tag key={property}>{property}</Tag>
                ))}
              </div>
            </div>
          )}

          <div className="register-section-title">
            <b>02 接入拓扑</b>
            <span>农场、租户和地块均来自生产管理当前登录租户</span>
          </div>
          <div className="form-grid">
            <Form.Item
              label="生产农场"
              name="farmId"
              rules={[{ required: true, message: "请选择生产农场" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择生产管理农场"
                onChange={selectFarm}
                options={farms.map((farm) => ({
                  value: farm.id,
                  label: `${farm.farmName} · ${farm.farmCode}`,
                }))}
              />
            </Form.Item>
            <Form.Item label="归属租户">
              <div className="source-readonly">
                {selectedFarm
                  ? `租户 ${selectedFarm.tenantId} · 生产管理统一租户`
                  : "选择农场后自动带出"}
              </div>
            </Form.Item>
            <Form.Item label="安装地块" name="plotId">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={plots.some((plot) => plot.farmId === selectedFarmId) ? "选择该农场下的生产地块" : "该农场暂无地块，可不绑定"}
                options={plots.filter((plot) => plot.farmId === selectedFarmId).map((plot) => ({
                  value: plot.id,
                  label: `${plot.plotName} · ${plot.plotCode} · ${plot.cropName}`,
                }))}
              />
            </Form.Item>
            <Form.Item
              label="接入网关"
              name="gatewayId"
              rules={[{ required: true, message: "请选择接入网关" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={selectedFarmGateways.length ? "选择该农场下的边缘网关" : "该农场暂无可用网关，请先在网关管理中接入"}
                options={selectedFarmGateways.map((gateway) => ({
                  value: gateway.id,
                  label: `${gateway.gatewayName} · ${gateway.gatewayCode} · ${gateway.protocol}`,
                }))}
              />
            </Form.Item>
            <Form.Item
              label="设备分组"
              name="groupId"
              rules={[{ required: true, message: "请选择设备分组" }]}
            >
              <Select
                placeholder="选择运营分组"
                options={groups.map((item) => ({
                  value: item.id,
                  label: `${item.icon} ${item.name}`,
                }))}
              />
            </Form.Item>
            <Form.Item label="支持远程控制" name="controlCapable" valuePropName="checked">
              <Switch checkedChildren="支持" unCheckedChildren="不支持" />
            </Form.Item>
          </div>

          <div className="register-section-title">
            <b>03 扩展配置</b>
            <span>使用 JSON 保存上报频率、通道或采集策略</span>
          </div>
          <Form.Item
            label="设备配置 JSON"
            name="config"
            extra='示例：{"reportInterval":30,"channel":1}'
          >
            <Input.TextArea rows={4} className="mono-input" />
          </Form.Item>
          <div className="register-note">
            注册会校验设备编码唯一性、设备类型、网关和分组有效性，并同步更新网关及分组设备数量。
          </div>
        </Form>
      </Modal>
    </div>
  );
}
function typeIcon(name: string) {
  return name.includes("温湿度")
    ? "🌡️"
    : name.includes("土壤")
      ? "🌱"
      : name.includes("阀")
        ? "💧"
        : name.includes("摄像头")
          ? "📹"
          : name.includes("风机")
            ? "🌀"
            : "📱";
}

function Gateways() {
  const [receiptGateway,setReceiptGateway]=useState<IotGateway | null>(null);
  const { message, modal } = AntApp.useApp();
  const [items, setItems] = useState<IotGateway[]>([]),
    [farms, setFarms] = useState<IotProductionFarm[]>([]),
    [detail, setDetail] = useState<
      (IotGateway & { devices: IotDevice[] }) | null
    >(null),
    [editing, setEditing] = useState<IotGateway | null>(null),
    [formOpen, setFormOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [keyword, setKeyword] = useState(""),
    [status, setStatus] = useState("all"),
    [farmFilter, setFarmFilter] = useState<number | undefined>(),
    [form] = Form.useForm();
  const load = async () => {
    setLoading(true);
    try {
      const [gatewayRows, farmRows] = await Promise.all([
        iotApi.gateways(),
        iotApi.farms(),
      ]);
      setItems(gatewayRows);
      setFarms(farmRows);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "边缘网关加载失败");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const filteredItems = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return items.filter((item) => {
      const matchesKeyword =
        !query ||
        [item.gatewayName, item.gatewayCode, item.ipAddress, item.farmName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = status === "all" || item.onlineStatus === status;
      const matchesFarm = !farmFilter || item.farmId === farmFilter;
      return matchesKeyword && matchesStatus && matchesFarm;
    });
  }, [items, keyword, status, farmFilter]);
  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      farmId: farms.find((farm) => items.every((gateway) => gateway.farmId !== farm.id))?.id ?? farms[0]?.id,
      model: "EG-200",
      protocol: "MQTT",
      firmwareVersion: "v1.0.0",
      ipAddress: "",
    });
    setFormOpen(true);
  };
  const openEdit = (gateway: IotGateway) => {
    setEditing(gateway);
    form.resetFields();
    form.setFieldsValue({
      gatewayCode: gateway.gatewayCode,
      gatewayName: gateway.gatewayName,
      farmId: gateway.farmId,
      model: gateway.model,
      protocol: gateway.protocol,
      firmwareVersion: gateway.firmwareVersion,
      ipAddress: gateway.ipAddress,
    });
    setFormOpen(true);
  };
  const submit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const body = {
        ...values,
        gatewayCode: String(values.gatewayCode).trim().toUpperCase(),
        gatewayName: String(values.gatewayName).trim(),
      };
      if (editing) await iotApi.updateGateway(editing.id, body);
      else await iotApi.createGateway(body);
      message.success(editing ? "边缘网关已更新" : "边缘网关已创建");
      setFormOpen(false);
      form.resetFields();
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };
  const openDetail = async (id: number) => {
    try {
      setDetail(await iotApi.gateway(id));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "网关详情加载失败");
    }
  };
  const restart = (gateway: IotGateway) => {
    modal.confirm({
      title: "重启边缘网关",
      content: `登记「${gateway.gatewayName}」重启申请？当前未接入下发通道，不会执行设备重启。`,
      okText: "确认重启",
      onOk: async () => {
        try {
          await iotApi.restartGateway(gateway.id);
          message.info("重启申请已登记，请查看回执；未确认网关执行");
          await load();
          if (detail?.id === gateway.id) await openDetail(gateway.id);
        } catch (error) {
          message.error(error instanceof Error ? error.message : "网关重启失败");
          throw error;
        }
      },
    });
  };
  const remove = (gateway: IotGateway) => {
    modal.confirm({
      title: "删除边缘网关",
      content: `确定删除「${gateway.gatewayName}」吗？已挂载设备的网关不能删除。`,
      okText: "删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await iotApi.deleteGateway(gateway.id);
          message.success("边缘网关已删除");
          if (detail?.id === gateway.id) setDetail(null);
          await load();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "网关删除失败");
          throw error;
        }
      },
    });
  };
  return (
    <div className="iot-page">
      <Modal title="网关重启与OTA升级回执" open={!!receiptGateway} footer={null} width={1200} onCancel={()=>setReceiptGateway(null)}>{receiptGateway&&<><h3>重启回执</h3><CommandReceipts key={'restart'+receiptGateway.id} deviceId={receiptGateway.id} load={iotApi.gatewayCommandReceipts}/><h3>OTA升级回执（动作列为目标版本）</h3><CommandReceipts key={'ota'+receiptGateway.id} deviceId={receiptGateway.id} load={iotApi.otaReceipts}/></>}</Modal>
      <PageTitle
        title="边缘网关"
        desc="生产农场网关接入、状态监控、设备挂载与远程运维。"
        actions={
          <>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增网关
            </Button>
          </>
        }
      />
      <div className="gateway-summary">
        <div>
          <span className="tone-green"><CloudServerOutlined /></span>
          <small>网关总数</small>
          <b>{items.length}</b>
          <em>生产租户范围</em>
        </div>
        <div>
          <span className="tone-blue"><ApiOutlined /></span>
          <small>在线网关</small>
          <b>{items.filter((item) => item.onlineStatus === "online").length}</b>
          <em>正在提供服务</em>
        </div>
        <div>
          <span className="tone-red"><AlertOutlined /></span>
          <small>离线 / 异常</small>
          <b>{items.filter((item) => item.onlineStatus !== "online").length}</b>
          <em>需要巡检</em>
        </div>
        <div>
          <span className="tone-orange"><CloudServerOutlined /></span>
          <small>挂载设备</small>
          <b>{items.reduce((sum, item) => sum + item.totalCount, 0)}</b>
          <em>在线 {items.reduce((sum, item) => sum + item.onlineCount, 0)} 台</em>
        </div>
      </div>
      <section className="iot-card iot-filter">
        <div className="iot-filter-main">
          <Input
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            allowClear
            placeholder="网关名称、编码、IP 或农场"
          />
          <Select
            value={status}
            onChange={setStatus}
            options={["all", "online", "offline", "alert"].map((value) => ({
              value,
              label: value === "all" ? "全部状态" : STATUS[value]?.label || value,
            }))}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            value={farmFilter}
            onChange={setFarmFilter}
            placeholder="全部生产农场"
            options={farms.map((farm) => ({
              value: farm.id,
              label: `${farm.farmName} · ${farm.farmCode}`,
            }))}
          />
          <Button
            onClick={() => {
              setKeyword("");
              setStatus("all");
              setFarmFilter(undefined);
            }}
          >
            重置
          </Button>
        </div>
        <span className="filter-result">共 {filteredItems.length} 个网关</span>
      </section>
      <div className="gateway-grid">
        {filteredItems.map((g) => (
          <section className="iot-card gateway-card" key={g.id}>
            <div className="iot-card-head">
              <div>
                <b>{g.gatewayName}</b>
                <small>
                  {g.gatewayCode} · {g.model || "通用型号"}
                </small>
              </div>
              <Status value={g.onlineStatus} />
            </div>
            <div className="gateway-farm">
              <span>🌾</span>
              <div>
                <b>{g.farmName || `农场 #${g.farmId}`}</b>
                <small>{g.farmCode || "生产管理农场"} · 租户 {g.tenantId || "—"}</small>
              </div>
            </div>
            <div className="gateway-stats">
              <span>
                <small>挂载设备</small>
                <b>
                  {g.onlineCount}/{g.totalCount}
                </b>
              </span>
              <span>
                <small>协议</small>
                <b>{g.protocol || "—"}</b>
              </span>
              <span>
                <small>固件</small>
                <b>{g.firmwareVersion || "—"}</b>
              </span>
            </div>
            <div className="gateway-resource">
              <small>CPU {g.cpuRate}%</small>
              <Progress
                percent={Number(g.cpuRate)}
                showInfo={false}
                strokeColor="#159a5e"
              />
              <small>内存 {g.memoryRate}%</small>
              <Progress
                percent={Number(g.memoryRate)}
                showInfo={false}
                strokeColor="#176c93"
              />
            </div>
            <footer>
              <span>
                {g.ipAddress || "未配置 IP"} · {g.lastOnline || "等待首次上报"}
              </span>
              <div>
                <Button size="small" onClick={() => void openDetail(g.id)}>详情</Button>
                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(g)} />
              <Button size="small" onClick={()=>setReceiptGateway(g)}>重启/升级回执</Button>
                <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => restart(g)} />
                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(g)} />
              </div>
            </footer>
          </section>
        ))}
        {!filteredItems.length && (
          <div className="gateway-empty">
            <span>🛰️</span>
            <b>没有符合条件的边缘网关</b>
            <small>可调整筛选条件，或先在当前生产农场新增网关。</small>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增网关</Button>
          </div>
        )}
      </div>
      <Modal
        title="网关详情"
        open={Boolean(detail)}
        width={700}
        onCancel={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>关闭</Button>}
      >
        {detail && (
          <>
            <div className="gateway-detail-hero">
              <span><CloudServerOutlined /></span>
              <div>
                <Status value={detail.onlineStatus} />
                <h2>{detail.gatewayName}</h2>
                <p>{detail.gatewayCode} · {detail.model} · {detail.protocol}</p>
              </div>
              <div>
                <small>生产农场</small>
                <b>{detail.farmName}</b>
                <small>生产租户</small>
                <b>{detail.tenantId || "—"}</b>
              </div>
            </div>
            <div className="kv-grid gateway-kv-grid">
              <span><small>IP 地址</small><b>{detail.ipAddress || "未配置"}</b></span>
              <span><small>在线设备</small><b>{detail.onlineCount}/{detail.totalCount}</b></span>
              <span><small>固件版本</small><b>{detail.firmwareVersion}</b></span>
              <span><small>最近在线</small><b>{detail.lastOnline}</b></span>
            </div>
            <div className="gateway-detail-resource">
              <div><small>CPU 使用率</small><Progress percent={Number(detail.cpuRate)} strokeColor="#159a5e" /></div>
              <div><small>内存使用率</small><Progress percent={Number(detail.memoryRate)} strokeColor="#176c93" /></div>
            </div>
            <div className="gateway-device-title">
              <b>挂载设备</b>
              <span>{detail.devices.length} 台</span>
            </div>
            <div className="modal-list">
              {detail.devices.length ? detail.devices.map((d) => (
                <div key={d.id}>
                  <span>{typeIcon(d.typeName)}</span>
                  <div>
                    <b>{d.deviceName}</b>
                    <small>{d.deviceCode}</small>
                  </div>
                  <Status value={d.onlineStatus} />
                </div>
              )) : (
                <div className="gateway-detail-empty">
                  <span>📡</span>
                  <div><b>暂无挂载设备</b><small>可在设备注册页选择该网关接入设备。</small></div>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
      <Modal
        title={editing ? "编辑边缘网关" : "新增边缘网关"}
        open={formOpen}
        width={780}
        maskClosable={false}
        onCancel={() => {
          setFormOpen(false);
          form.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => setFormOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" loading={submitting} icon={<PlusOutlined />} onClick={() => void submit()}>
            {editing ? "保存修改" : "确认新增"}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <div className="register-intro gateway-form-intro">
            <span>🛰️</span>
            <div>
              <b>{editing ? "维护网关接入信息" : "接入新的边缘网关"}</b>
              <small>网关必须归属生产管理当前租户的农场，新增后初始状态为离线。</small>
            </div>
          </div>
          <div className="register-section-title">
            <b>01 网关身份</b>
            <span>编码、名称与设备型号</span>
          </div>
          <div className="form-grid">
            <Form.Item
              label="网关编码"
              name="gatewayCode"
              rules={[
                { required: true, whitespace: true, message: "请输入网关编码" },
                { pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{2,49}$/, message: "编码需为 3-50 位字母、数字、横线或下划线" },
              ]}
            >
              <Input
                maxLength={50}
                placeholder="例如 GW004"
                onBlur={(event) => form.setFieldValue("gatewayCode", event.target.value.trim().toUpperCase())}
              />
            </Form.Item>
            <Form.Item label="网关名称" name="gatewayName" rules={[{ required: true, whitespace: true, message: "请输入网关名称" }]}>
              <Input maxLength={120} placeholder="例如 4号棚边缘网关" />
            </Form.Item>
            <Form.Item label="设备型号" name="model">
              <Input maxLength={80} placeholder="例如 EG-200" />
            </Form.Item>
            <Form.Item label="固件版本" name="firmwareVersion">
              <Input maxLength={40} placeholder="例如 v3.1.0" />
            </Form.Item>
          </div>
          <div className="register-section-title">
            <b>02 归属与接入</b>
            <span>农场来自生产管理，租户随农场自动关联</span>
          </div>
          <div className="form-grid">
            <Form.Item label="生产农场" name="farmId" rules={[{ required: true, message: "请选择生产农场" }]}>
              <Select
                showSearch
                optionFilterProp="label"
                disabled={Boolean(editing && editing.totalCount > 0)}
                placeholder="选择生产农场"
                options={farms.map((farm) => ({
                  value: farm.id,
                  label: `${farm.farmName} · ${farm.farmCode} · 租户 ${farm.tenantId}`,
                }))}
              />
            </Form.Item>
            <Form.Item label="接入协议" name="protocol" rules={[{ required: true, message: "请选择接入协议" }]}>
              <Select options={["MQTT", "LoRa+4G", "LoRaWAN", "NB-IoT", "4G", "5G", "Modbus"].map((value) => ({
                value,
                label: value,
              }))} />
            </Form.Item>
            <Form.Item
              label="IP 地址"
              name="ipAddress"
              rules={[{
                pattern: /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/,
                message: "请输入有效的 IPv4 地址",
              }]}
            >
              <Input placeholder="例如 192.168.1.10" />
            </Form.Item>
          </div>
          {editing && editing.totalCount > 0 && (
            <div className="register-note">该网关已挂载 {editing.totalCount} 台设备，暂不允许迁移农场；如需迁移，请先调整设备所属网关。</div>
          )}
        </Form>
      </Modal>
    </div>
  );
}

function Plots() {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<IotPlot[]>([]),
    [farms, setFarms] = useState<IotProductionFarm[]>([]),
    [loading, setLoading] = useState(false),
    [keyword, setKeyword] = useState(""),
    [status, setStatus] = useState("all"),
    [farmFilter, setFarmFilter] = useState<number | undefined>(),
    [detail, setDetail] = useState<IotPlot | null>(null),
    [detailDevices, setDetailDevices] = useState<IotDevice[]>([]),
    [detailLoading, setDetailLoading] = useState(false),
    [view, setView] = useState<"cards" | "list" | "map">(
      () => {
        const saved = localStorage.getItem("iot_plot_view");
        return saved === "list" || saved === "map" ? saved : "cards";
      },
    );
  const load = async () => {
    setLoading(true);
    try {
      const [plotRows, farmRows] = await Promise.all([iotApi.plots(), iotApi.farms()]);
      setItems(plotRows);
      setFarms(farmRows);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "地块数据加载失败");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const filteredItems = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return items.filter((item) => {
      const matchesKeyword =
        !query ||
        [item.plotName, item.plotCode, item.cropName, item.farmName, item.farmCode]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = status === "all" || item.status === status;
      const matchesFarm = !farmFilter || item.farmId === farmFilter;
      return matchesKeyword && matchesStatus && matchesFarm;
    });
  }, [items, keyword, status, farmFilter]);
  const totalArea = items.reduce((sum, item) => sum + Number(item.area || 0), 0);
  const totalDevices = items.reduce((sum, item) => sum + Number(item.deviceCount || 0), 0);
  const onlineDevices = items.reduce((sum, item) => sum + Number(item.onlineCount || 0), 0);
  const changeView = (value: string | number) => {
    const next = value === "list" ? "list" : value === "map" ? "map" : "cards";
    setView(next);
    localStorage.setItem("iot_plot_view", next);
  };
  const mapPoints = useMemo<TiandituMapPoint[]>(
    () =>
      filteredItems
        .filter((plot) => plot.longitude != null && plot.latitude != null)
        .map((plot) => ({
          id: plot.id,
          longitude: Number(plot.longitude),
          latitude: Number(plot.latitude),
          title: plot.plotName,
          meta: `${plot.cropName || "未种植"} · ${plot.deviceCount} 台设备`,
          tone: plot.status === "warning" ? "orange" : "green",
          boundary: plot.boundary,
        })),
    [filteredItems],
  );
  const openDetail = async (plot: IotPlot) => {
    setDetail(plot);
    setDetailDevices([]);
    setDetailLoading(true);
    try {
      setDetailDevices(await iotApi.devices({ plotId: plot.id }));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "地块设备加载失败");
    } finally {
      setDetailLoading(false);
    }
  };
  const openDevices = (plotId: number) => navigate(`/devices?plotId=${plotId}`);
  const columns: ColumnsType<IotPlot> = [
    {
      title: "地块",
      render: (_, plot) => (
        <button type="button" className="entity-link" onClick={() => void openDetail(plot)}>
          <span>🌾</span>
          <div>
            <b>{plot.plotName}</b>
            <small>{plot.plotCode}</small>
          </div>
        </button>
      ),
    },
    {
      title: "生产农场",
      render: (_, plot) => (
        <div className="entity-copy">
          <b>{plot.farmName || `农场 #${plot.farmId}`}</b>
          <small>{plot.farmCode} · 租户 {plot.tenantId || "—"}</small>
        </div>
      ),
    },
    {
      title: "当前作物",
      render: (_, plot) => (
        <div className="entity-copy">
          <b>{plot.cropName || "未种植"}</b>
          <small>{plot.cropStage}</small>
        </div>
      ),
    },
    { title: "面积", render: (_, plot) => `${plot.area} 亩` },
    {
      title: "设备覆盖",
      render: (_, plot) => {
        const rate = plot.deviceCount
          ? Math.round((plot.onlineCount / plot.deviceCount) * 100)
          : 0;
        return (
          <div className="plot-list-coverage">
            <span>{plot.onlineCount}/{plot.deviceCount} 在线</span>
            <Progress percent={rate} size="small" showInfo={false} strokeColor={rate < 60 ? "#c54b4b" : "#159a5e"} />
            <small>{rate}%</small>
          </div>
        );
      },
    },
    {
      title: "生产状态",
      render: (_, plot) => (
        <div className="plot-state-cell">
          <Status value={plot.status === "warning" ? "alert" : "online"} />
          <small>{plot.status === "warning" ? "生产状态需关注" : "生产运行正常"}</small>
        </div>
      ),
    },
    {
      title: "操作",
      render: (_, plot) => (
        <Button type="link" onClick={() => void openDetail(plot)}>查看监测</Button>
      ),
    },
  ];
  return (
    <div className="iot-page">
      <PageTitle
        title="地块监测"
        desc="生产地块、作物状态与物联网设备覆盖的一体化监测。"
        actions={
          <>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>刷新</Button>
            <Button icon={<EnvironmentOutlined />} onClick={() => message.info("地块边界与中心坐标来自生产管理 GIS")}>
              生产地块 GIS
            </Button>
          </>
        }
      />
      <div className="plot-summary">
        <div><span className="tone-green"><EnvironmentOutlined /></span><small>地块总数</small><b>{items.length}</b><em>生产管理同步</em></div>
        <div><span className="tone-blue"><AppstoreOutlined /></span><small>种植面积</small><b>{totalArea.toFixed(1)}</b><em>亩</em></div>
        <div><span className="tone-orange"><CloudServerOutlined /></span><small>监测设备</small><b>{totalDevices}</b><em>已覆盖地块</em></div>
        <div><span className="tone-green"><ApiOutlined /></span><small>设备在线率</small><b>{totalDevices ? Math.round((onlineDevices / totalDevices) * 100) : 0}%</b><em>{onlineDevices} 台在线</em></div>
      </div>
      <section className="iot-card iot-filter plot-filter-bar">
        <div className="iot-filter-main">
          <Input
            prefix={<SearchOutlined />}
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="地块名称、编码、作物或农场"
          />
          <Select
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "全部状态" },
              { value: "normal", label: "运行正常" },
              { value: "warning", label: "需要关注" },
            ]}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            value={farmFilter}
            onChange={setFarmFilter}
            placeholder="全部生产农场"
            options={farms.map((farm) => ({ value: farm.id, label: farm.farmName }))}
          />
          <Button onClick={() => { setKeyword(""); setStatus("all"); setFarmFilter(undefined); }}>重置</Button>
        </div>
        <div className="plot-view-switch">
          <span>共 {filteredItems.length} 个地块</span>
          <Segmented
            size="small"
            value={view}
            onChange={changeView}
            options={[
              { value: "cards", label: "卡片", icon: <AppstoreOutlined /> },
              { value: "list", label: "列表", icon: <UnorderedListOutlined /> },
              { value: "map", label: "地图", icon: <EnvironmentOutlined /> },
            ]}
          />
        </div>
      </section>
      {view === "map" ? (
        <section className="iot-card plot-map-view">
          <div className="plot-map-view-head">
            <div>
              <b>生产地块分布</b>
              <span>天地图 · 当前显示 {mapPoints.length} 个有坐标地块</span>
            </div>
            <Tag color="green">天地图</Tag>
          </div>
          <TiandituMap
            points={mapPoints}
            height={560}
            onPointClick={(point) => {
              const plot = items.find((item) => item.id === Number(point.id));
              if (plot) void openDetail(plot);
            }}
          />
          {!mapPoints.length && (
            <div className="plot-map-missing">
              当前筛选结果没有带中心经纬度的地块，请先在生产管理中维护地块坐标。
            </div>
          )}
        </section>
      ) : view === "cards" ? (
        <div className="plot-monitor-grid">
          {filteredItems.map((plot, index) => {
            const onlineRate = plot.deviceCount
              ? Math.round((plot.onlineCount / plot.deviceCount) * 100)
              : 0;
            return (
              <article className={`iot-card plot-monitor-card tone-${index % 4}${plot.status === "warning" ? " warning" : ""}`} key={plot.id}>
                <div className="plot-monitor-map">
                  <span>🌾</span>
                  <i />
                  <i />
                  <b>{plot.cropStage}</b>
                  <Status value={plot.status === "warning" ? "alert" : "online"} />
                </div>
                <div className="plot-monitor-main">
                  <div className="plot-monitor-head">
                    <div>
                      <b>{plot.plotName}</b>
                      <small>{plot.plotCode} · {plot.area} 亩</small>
                    </div>
                    <Button size="small" type="text" onClick={() => void openDetail(plot)}>详情</Button>
                  </div>
                  <div className="plot-farm-line">
                    <EnvironmentOutlined />
                    <span>{plot.farmName || `农场 #${plot.farmId}`}</span>
                    <em>{plot.farmCode}</em>
                  </div>
                  <div className="plot-crop-line">
                    <span>当前作物</span>
                    <b>{plot.cropName || "未种植"}</b>
                    <em>{plot.cropStage}</em>
                  </div>
                  <div className="plot-device-line">
                    <span>设备在线 {plot.onlineCount}/{plot.deviceCount}</span>
                    <Progress percent={onlineRate} showInfo={false} strokeColor={plot.status === "warning" ? "#c54b4b" : "#159a5e"} />
                    <b>{onlineRate}%</b>
                  </div>
                  <footer>
                    <span>生产地块 · {plot.sourceUpdatedAt || "已同步"}</span>
                    <Button size="small" onClick={() => openDevices(plot.id)}>查看设备</Button>
                  </footer>
                </div>
              </article>
            );
          })}
          {!filteredItems.length && (
            <div className="plot-empty"><span>🌾</span><b>没有符合条件的地块</b><small>请调整搜索、状态或生产农场筛选。</small></div>
          )}
        </div>
      ) : (
        <section className="iot-card iot-table plot-table-card">
          <CardHead title="地块列表" sub="来自生产管理当前租户，设备统计由物联网实时补充" />
          <Table
            rowKey="id"
            loading={loading}
            dataSource={filteredItems}
            columns={columns}
            scroll={{ x: 1050 }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 个地块` }}
          />
        </section>
      )}
      <Modal
        title="地块监测详情"
        open={Boolean(detail)}
        width={860}
        onCancel={() => setDetail(null)}
        footer={detail ? [
          <Button key="close" onClick={() => setDetail(null)}>关闭</Button>,
          <Button key="devices" type="primary" onClick={() => openDevices(detail.id)}>进入设备管理</Button>,
        ] : null}
      >
        {detail && (
          <div className="plot-detail">
            <div className="plot-detail-hero">
              <div className="plot-detail-map">
                <TiandituMap
                  compact
                  showLegend={false}
                  height={150}
                  zoom={13}
                  points={detail.longitude != null && detail.latitude != null ? [{
                    id: detail.id,
                    longitude: Number(detail.longitude),
                    latitude: Number(detail.latitude),
                    title: detail.plotName,
                    tone: detail.status === "warning" ? "orange" : "green",
                    boundary: detail.boundary,
                  }] : []}
                />
              </div>
              <div>
                <Status value={detail.status === "warning" ? "alert" : "online"} />
                <h2>{detail.plotName}</h2>
                <p>{detail.farmName} · {detail.farmCode} · 租户 {detail.tenantId || "—"}</p>
              </div>
              <div className="plot-detail-coordinates">
                <small>中心坐标</small>
                <b>{detail.latitude ?? "—"}, {detail.longitude ?? "—"}</b>
                <small>数据来源</small>
                <b>{detail.sourceService || "agri-production"}</b>
              </div>
            </div>
            <div className="plot-detail-facts">
              <span><small>种植面积</small><b>{detail.area} 亩</b></span>
              <span><small>当前作物</small><b>{detail.cropName || "未种植"}</b></span>
              <span><small>生长阶段</small><b>{detail.cropStage}</b></span>
              <span><small>设备在线</small><b>{detail.onlineCount}/{detail.deviceCount}</b></span>
              <span><small>种植日期</small><b>{detail.plantingDate || "—"}</b></span>
              <span><small>预计采收</small><b>{detail.expectedHarvestDate || "—"}</b></span>
            </div>
            <div className="gateway-device-title">
              <b>地块监测设备</b>
              <span>{detailDevices.length} 台 · 在线 {detailDevices.filter((device) => device.onlineStatus === "online").length} 台</span>
            </div>
            <div className="modal-list">
              {detailLoading ? <div className="plot-detail-loading">正在加载设备监测数据…</div> : detailDevices.length ? detailDevices.map((device) => (
                <div key={device.id}>
                  <span>{typeIcon(device.typeName)}</span>
                  <div><b>{device.deviceName}</b><small>{device.deviceCode} · {device.protocol} · {device.lastReport}</small></div>
                  <Status value={device.onlineStatus} />
                </div>
              )) : (
                <div className="gateway-detail-empty"><span>📡</span><div><b>该地块暂未挂载设备</b><small>可在设备注册时选择该生产地块。</small></div></div>
              )}
            </div>
          </div>
        )}
      </Modal>
      <div className="plot-source-note">
        <EnvironmentOutlined />
        <span>地块档案、农场、租户、作物和边界均由生产管理模块提供，物联网模块不维护第二套地块数据。</span>
      </div>
    </div>
  );
}

/**
 * 阈值工作台：平台预置（只读）+ 本经营主体自己的阈值规则 + 试算 + 超阈值读数。
 *
 * 为什么要主体自己的阈值：上一轮只是把"租户能停用全平台规则"这个越权入口下线了，
 * 但蔬菜棚和苹果园对同一个 35℃ 的判断本来就不一样。现在主体规则在同一个指标上
 * **覆盖**平台预置，其余指标继续用平台兜底；判定与展示都只认"本主体生效集合"，
 * 所以同一条读数在两个主体下会给出不同等级——这才是差异化的意义。
 */
function AlertRuleWorkbench() {
  const { message, modal } = AntApp.useApp();
  const [view, setView] = useState<AlertRuleView | null>(null),
    [options, setOptions] = useState<AlertRuleOptions | null>(null),
    [risks, setRisks] = useState<RiskReading[]>([]),
    [trialMetric, setTrialMetric] = useState("temperature"),
    [trialValue, setTrialValue] = useState("35"),
    [trial, setTrial] = useState<AlertJudgement | null>(null),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<AlertRule | null>(null),
    [submitting, setSubmitting] = useState(false),
    [form] = Form.useForm();
  const load = () =>
    void Promise.all([
      iotApi.alertRuleView(),
      iotApi.alertRuleOptions(),
      iotApi.riskReadings(),
    ])
      .then(([v, o, r]) => {
        setView(v);
        setOptions(o);
        setRisks(r);
      })
      .catch((e: Error) => message.error(e.message));
  useEffect(load, [message]);

  const openForm = (rule: AlertRule | null) => {
    setEditing(rule);
    form.resetFields();
    if (rule) {
      form.setFieldsValue({
        ruleName: rule.ruleName,
        metricKey: rule.metricKey,
        operator: rule.operator,
        threshold: Number(rule.threshold),
        durationSeconds: rule.durationSeconds,
        level: rule.level,
        deviceType: rule.deviceType || undefined,
        remark: rule.remark || "",
      });
    } else {
      form.setFieldsValue({
        operator: ">",
        durationSeconds: 300,
        level: "major",
        metricKey: options?.metrics?.[0]?.key,
      });
    }
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editing) {
        await iotApi.updateAlertRule(editing.id, values);
      } else {
        await iotApi.createAlertRule(values);
      }
      setOpen(false);
      message.success("阈值规则已保存");
      load();
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (rule: AlertRule) => {
    try {
      await iotApi.toggleAlertRule(rule.id);
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  const remove = (rule: AlertRule) => {
    modal.confirm({
      title: `删除阈值规则「${rule.ruleName}」？`,
      content: "删除后该指标回落到平台预置阈值。",
      okText: "确认删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await iotApi.deleteAlertRule(rule.id);
          message.success("阈值规则已删除");
          load();
        } catch (e) {
          message.error(e instanceof Error ? e.message : "删除失败");
        }
      },
    });
  };

  const runTrial = async () => {
    try {
      setTrial(await iotApi.evaluateAlertRule({ metricKey: trialMetric, value: trialValue }));
    } catch (e) {
      message.error(e instanceof Error ? e.message : "试算失败");
    }
  };

  if (!view || !options) return <Loading />;
  const metricName = (key: string) =>
    options.metrics.find((item) => item.key === key)?.name || key;
  return (
    <>
      <div className="iot-two-grid">
        <section className="iot-card iot-table">
          <CardHead
            title="我的阈值规则"
            sub={view.tenantName ? `${view.tenantName} · 同指标覆盖平台预置` : "本经营主体生效"}
            extra={
              <Button size="small" type="primary" onClick={() => openForm(null)}>
                新增阈值
              </Button>
            }
          />
          {view.tenant.length === 0 ? (
            <EmptyHint
              icon="🎚️"
              title="还没有自定义阈值"
              desc="不配置也可以：所有指标按平台预置阈值判定。需要更贴合本主体作物/设施的值时再新增。"
            />
          ) : (
            <Table
              rowKey="id"
              pagination={false}
              dataSource={view.tenant}
              columns={[
                { title: "规则", dataIndex: "ruleName" },
                {
                  title: "条件",
                  render: (_, r: AlertRule) => (
                    <span>
                      {r.metricName} {r.operator} {Number(r.threshold)}
                      {r.deviceType ? ` · ${r.deviceType}` : ""}
                    </span>
                  ),
                },
                {
                  title: "持续",
                  dataIndex: "durationSeconds",
                  render: (v: number) => (v > 0 ? `${v} 秒` : "瞬时"),
                },
                { title: "等级", dataIndex: "level", render: (v: string) => <Status value={v} /> },
                {
                  title: "状态",
                  dataIndex: "enabled",
                  render: (v: boolean) => <Status value={v ? "running" : "disabled"} />,
                },
                {
                  title: "操作",
                  render: (_, r: AlertRule) => (
                    <>
                      <Button type="link" size="small" onClick={() => openForm(r)}>
                        编辑
                      </Button>
                      <Button type="link" size="small" onClick={() => void toggle(r)}>
                        {r.enabled ? "停用" : "启用"}
                      </Button>
                      <Button type="link" size="small" danger onClick={() => remove(r)}>
                        删除
                      </Button>
                    </>
                  ),
                },
              ]}
            />
          )}
        </section>
        <section className="iot-card iot-table">
          <CardHead title="平台预置阈值" sub="全平台兜底默认值，本页面只读" />
          <Table
            rowKey="id"
            pagination={false}
            dataSource={view.platform}
            columns={[
              { title: "规则", dataIndex: "ruleName" },
              {
                title: "条件",
                render: (_, r: AlertRule) =>
                  `${r.metricName} ${r.operator} ${Number(r.threshold)}`,
              },
              {
                title: "持续",
                dataIndex: "durationSeconds",
                render: (v: number) => `${v} 秒`,
              },
              { title: "等级", dataIndex: "level", render: (v: string) => <Status value={v} /> },
              {
                title: "状态",
                render: (_, r: AlertRule) =>
                  r.overridden ? (
                    <Tag color="blue">已由「{r.overriddenByRuleName}」覆盖</Tag>
                  ) : r.enabled ? (
                    <Status value="running" />
                  ) : (
                    <Status value="disabled" />
                  ),
              },
            ]}
          />
        </section>
      </div>
      <div className="iot-two-grid">
        <section className="iot-card">
          <CardHead title="阈值试算" sub="按当前主体生效规则判定" />
          <div className="iot-filter">
            <Select
              value={trialMetric}
              onChange={setTrialMetric}
              style={{ width: 180 }}
              options={options.metrics.map((item) => ({
                value: item.key,
                label: `${item.name}${item.unit ? ` (${item.unit})` : ""}`,
              }))}
            />
            <Input
              value={trialValue}
              onChange={(e) => setTrialValue(e.target.value)}
              style={{ width: 120 }}
              placeholder="读数"
            />
            <Button type="primary" onClick={() => void runTrial()}>
              判定
            </Button>
          </div>
          {trial ? (
            <div className="dialog-summary">
              <b>
                {metricName(trial.metricKey)} {trial.value} →{" "}
                <Status value={trial.level} />
              </b>
              <span>{trial.note}</span>
              {trial.matchedRules.length > 0 ? (
                <small>
                  {trial.matchedRules
                    .map(
                      (rule) =>
                        `${rule.ruleName}（${rule.source === "tenant" ? "本主体" : "平台"}）`,
                    )
                    .join("、")}
                </small>
              ) : null}
            </div>
          ) : null}
        </section>
        <section className="iot-card">
          <CardHead
            title="超过阈值的读数"
            sub="最近一次读数已越线（含持续时间判定），不是自动生成的告警"
          />
          {risks.length === 0 ? (
            <EmptyHint
              icon="✅"
              title="当前没有超过本主体阈值的读数"
              desc="判定按本主体生效阈值 + 实际读数序列；接入设备上报后这里会实时出现。"
            />
          ) : (
            <div>
              {risks.slice(0, 6).map((risk) => (
                <div
                  className="work-order"
                  key={`${risk.deviceId}-${risk.metricKey}-${risk.ruleId}`}
                >
                  <div className="iot-card-head">
                    <div>
                      <b>{risk.deviceName}</b>
                      <small>
                        {risk.deviceCode} · {risk.typeName}
                      </small>
                    </div>
                    <Status value={risk.level} />
                  </div>
                  <p>
                    {risk.metricName} {risk.value}
                    {risk.unit || ""} · 阈值 {risk.operator} {Number(risk.threshold)}
                    {risk.durationSeconds > 0 ? ` · 需持续 ${risk.durationSeconds} 秒` : ""} ·{" "}
                    {risk.recordedAt}
                  </p>
                  <footer>
                    <span>
                      {risk.ruleName}（{risk.ruleSource === "tenant" ? "本主体阈值" : "平台预置"}）
                    </span>
                  </footer>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <Modal
        title={editing ? "编辑阈值规则" : "新增阈值规则"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        okText={editing ? "保存" : "创建"}
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="规则名称"
            name="ruleName"
            rules={[{ required: true, message: "请输入规则名称" }]}
          >
            <Input placeholder="例如：蔬菜棚高温" maxLength={160} />
          </Form.Item>
          <div className="form-grid">
            <Form.Item
              label="监控指标"
              name="metricKey"
              rules={[{ required: true, message: "请选择监控指标" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                virtual={false}
                options={options.metrics.map((item) => ({
                  value: item.key,
                  label: `${item.name}${item.unit ? ` (${item.unit})` : ""}`,
                }))}
              />
            </Form.Item>
            <Form.Item label="限定设备类型" name="deviceType">
              <Select
                allowClear
                virtual={false}
                placeholder="不限设备类型"
                options={options.deviceTypes.map((type) => ({ value: type, label: type }))}
              />
            </Form.Item>
          </div>
          <div className="form-grid">
            <Form.Item label="比较方式" name="operator" rules={[{ required: true }]}>
              <Select options={options.operators.map((op) => ({ value: op, label: op }))} />
            </Form.Item>
            <Form.Item label="阈值" name="threshold" rules={[{ required: true, message: "请输入阈值" }]}>
              <InputNumber style={{ width: "100%" }} step={0.1} />
            </Form.Item>
          </div>
          <div className="form-grid">
            <Form.Item label="持续时间（秒）" name="durationSeconds">
              <InputNumber min={0} max={86400} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label="告警等级" name="level" rules={[{ required: true }]}>
              <Select
                options={options.levels.map((level) => ({
                  value: level,
                  label: <Status value={level} />,
                }))}
              />
            </Form.Item>
          </div>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} maxLength={400} placeholder="为什么要设成这个值" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function Alerts() {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<IotAlert[]>([]),
    [tab, setTab] = useState<"alerts" | "rules">("alerts"),
    [target, setTarget] = useState<IotAlert | null>(null),
    [note, setNote] = useState("");
  const load = () =>
    void iotApi
      .alerts()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  useEffect(load, []);
  const handle = async () => {
    if (!target) return;
    try {
      await iotApi.handleAlert(target.id, note, target.status === "pending" ? "handling" : "resolved");
      setTarget(null);
      message.success("处置状态已保存并回读");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "处置失败");
    }
  };
  return (
    <div className="iot-page">
      <PageTitle
        title="预警中心"
        desc="环境阈值、设备离线、数据异常与信号质量的统一处置。"
        actions={
          <Button onClick={() => void iotApi.alerts().then(setItems)}>
            刷新告警
          </Button>
        }
      />
      <div className="iot-tabs">
        <button
          type="button"
          className={tab === "alerts" ? "on" : ""}
          onClick={() => setTab("alerts")}
        >
          告警列表
        </button>
        <button
          type="button"
          className={tab === "rules" ? "on" : ""}
          onClick={() => setTab("rules")}
        >
          告警规则
        </button>
      </div>
      {tab === "alerts" ? (
        <div className="alert-cards">
          {items.map((a) => (
            <section
              className={`iot-card alert-card level-${a.level}`}
              key={a.id}
            >
              <div className="iot-card-head">
                <div>
                  <Status value={a.level} />
                  <b>{a.title}</b>
                  <small>
                    {a.deviceName} · {a.alertNo}
                  </small>
                </div>
                <Status value={a.status} />
              </div>
              <p>{a.content}</p>
              <div className="alert-values">
                <span>
                  <small>触发值</small>
                  <b>{a.triggerValue}</b>
                </span>
                <span>
                  <small>阈值</small>
                  <b>{a.thresholdValue}</b>
                </span>
                <span>
                  <small>时间</small>
                  <b>{a.createdAt}</b>
                </span>
              </div>
              <footer>
                {a.status === "resolved" ? (
                  <small>
                    {a.handledBy} · {a.handleNote}
                  </small>
                ) : (
                  <>
                    <Button
                      size="small"
                      onClick={() => {
                        setTarget(a);
                        setNote("");
                      }}
                    >
                      {a.status === "pending" ? "受理告警" : "登记处理结果"}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => navigate("/maintenance")}
                    >
                      创建工单
                    </Button>
                  </>
                )}
              </footer>
            </section>
          ))}
        </div>
      ) : (
        <AlertRuleWorkbench />
      )}
      <Modal
        title="处置告警"
        open={Boolean(target)}
        onCancel={() => setTarget(null)}
        onOk={() => void handle()}
        okText="确认处置"
      >
        <div className="dialog-summary">
          <b>{target?.title}</b>
          <span>{target?.content}</span>
        </div>
        <Input.TextArea
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}

function parseRuleConfig(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function ensureJsonObject(raw: string, label: string) {
  try {
    const value = JSON.parse(raw || "{}") as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error();
    }
  } catch {
    throw new Error(`${label}必须是有效的 JSON 对象`);
  }
}

function Automation() {
  const { message, modal } = AntApp.useApp();
  const [scenes, setScenes] = useState<IotScene[]>([]),
    [rules, setRules] = useState<IotRule[]>([]),
    [devices, setDevices] = useState<IotDevice[]>([]),
    [sceneOpen, setSceneOpen] = useState(false),
    [ruleOpen, setRuleOpen] = useState(false),
    [editingScene, setEditingScene] = useState<IotScene | null>(null),
    [editingRule, setEditingRule] = useState<IotRule | null>(null),
    [submitting, setSubmitting] = useState(false);
  const [sceneForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const selectedRuleType = Form.useWatch("ruleType", ruleForm);
  const selectedTriggerMetric = Form.useWatch("triggerMetric", ruleForm);
  const load = () =>
    void Promise.all([iotApi.scenes(), iotApi.rules(), iotApi.devices()])
      .then(([s, r, d]) => {
        setScenes(s);
        setRules(r);
        setDevices(d);
      })
      .catch((e: Error) => message.error(e.message));
  useEffect(load, []);
  const activate = (scene: IotScene) => {
    modal.confirm({
      title: "切换运行场景",
      content: `启用「${scene.sceneName}」后，其他场景将停止运行。是否继续？`,
      okText: "启用场景",
      onOk: async () => {
        try {
          await iotApi.activateScene(scene.id);
          message.success("场景已启用");
          load();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "场景启用失败");
        }
      },
    });
  };
  const toggle = async (id: number) => {
    try {
      await iotApi.toggleRule(id);
      message.success("规则状态已更新");
      load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "规则状态更新失败");
    }
  };
  const executeRule = async (id: number) => {
    try {
      await iotApi.executeRule(id);
      message.success("规则已执行并写入控制日志");
      load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "执行失败");
    }
  };
  const openScene = (scene?: IotScene) => {
    setEditingScene(scene ?? null);
    sceneForm.resetFields();
    sceneForm.setFieldsValue(
      scene
        ? {
            sceneName: scene.sceneName,
            icon: scene.icon,
            category: scene.category,
            description: scene.description,
            config: scene.config,
            plotCount: scene.plotCount,
          }
        : { icon: "⚙️", category: "自定义场景", config: "{}", plotCount: 0 },
    );
    setSceneOpen(true);
  };
  const submitScene = async () => {
    try {
      const values = await sceneForm.validateFields();
      ensureJsonObject(String(values.config || "{}"), "执行配置");
      setSubmitting(true);
      if (editingScene) await iotApi.updateScene(editingScene.id, values);
      else await iotApi.createScene(values);
      message.success(editingScene ? "场景已更新" : "场景已创建");
      setSceneOpen(false);
      load();
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };
  const removeScene = (scene: IotScene) => {
    modal.confirm({
      title: "删除场景",
      content: `确定删除「${scene.sceneName}」吗？`,
      okText: "删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await iotApi.deleteScene(scene.id);
          message.success("场景已删除");
          load();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "场景删除失败");
        }
      },
    });
  };
  const openRule = (rule?: IotRule) => {
    setEditingRule(rule ?? null);
    ruleForm.resetFields();
    const extra = parseRuleConfig(rule?.config);
    ruleForm.setFieldsValue(
      rule
        ? {
            ruleName: rule.ruleName,
            ruleType: rule.ruleType || "automation",
            triggerMetric: rule.triggerMetric || "temperature",
            operator: rule.operator || ">",
            threshold: rule.threshold || 32,
            durationSeconds: rule.durationSeconds ?? 300,
            schedule: rule.schedule,
            actionDeviceId: rule.actionDeviceId,
            actionCommand: rule.actionCommand || "on",
            actionValue: rule.actionValue,
            cooldownSeconds: rule.cooldownSeconds ?? 300,
            executionMode: String(extra.executionMode || "edge"),
            enabled: rule.enabled,
          }
        : {
            ruleType: "automation",
            triggerMetric: "temperature",
            operator: ">",
            threshold: 32,
            durationSeconds: 300,
            actionCommand: "on",
            cooldownSeconds: 300,
            executionMode: "edge",
            enabled: true,
          },
    );
    setRuleOpen(true);
  };
  const submitRule = async (test = false) => {
    try {
      const values = await ruleForm.validateFields();
      const metricNames: Record<string, string> = {
        temperature: "空气温度",
        humidity: "空气湿度",
        soil_moisture: "土壤含水率",
        co2: "CO₂浓度",
        light: "光照强度",
        rain: "降雨量",
        device_offline: "设备离线",
      };
      const duration = Number(values.durationSeconds || 0);
      const trigger =
        values.ruleType === "schedule"
          ? `定时触发 ${values.schedule || "未设置"}`
          : values.ruleType === "offline" || values.triggerMetric === "device_offline"
            ? "设备离线"
            : `${metricNames[values.triggerMetric] || values.triggerMetric} ${values.operator} ${values.threshold}` +
              (duration > 0 ? ` 持续${Math.ceil(duration / 60)}分钟` : "");
      const device = devices.find((item) => item.id === values.actionDeviceId);
      const action = `${device?.deviceName || "目标设备"}：${values.actionCommand || "执行动作"}` +
        (values.actionValue ? ` = ${values.actionValue}` : "");
      setSubmitting(true);
      const body = {
        ...values,
        trigger,
        action,
        actionDeviceName: device?.deviceName || "",
        config: JSON.stringify({ ...values, actionDeviceName: device?.deviceName || "" }),
      };
      const saved = editingRule
        ? await iotApi.updateRule(editingRule.id, body)
        : await iotApi.createRule(body);
      setRuleOpen(false);
      load();
      if (test) {
        try {
          await iotApi.executeRule(saved.id);
        } catch (error) {
          message.warning(
            `规则已保存，但测试执行失败：${error instanceof Error ? error.message : "未知错误"}`,
          );
          return;
        }
      }
      message.success(
        test
          ? "规则已保存，测试指令已下发"
          : editingRule
            ? "自动化规则已更新"
            : "自动化规则已创建",
      );
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };
  const removeRule = (rule: IotRule) => {
    modal.confirm({
      title: "删除自动化规则",
      content: `确定删除「${rule.ruleName}」吗？`,
      okText: "删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await iotApi.deleteRule(rule.id);
          message.success("规则已删除");
          load();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "规则删除失败");
        }
      },
    });
  };
  return (
    <div className="iot-page">
      <PageTitle
        title="场景与自动化"
        desc="环境联动场景、自动化规则和手动执行。"
        actions={<><Button icon={<PlusOutlined />} onClick={() => openScene()}>新建场景</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => openRule()}>新建规则</Button></>}
      />
      <section className="iot-card">
        <CardHead title="场景模式" sub="一键应用环境控制策略，可新建和编辑" />
        <div className="scene-grid">
          {scenes.map((s) => (
            <article className={s.active ? "active" : ""} key={s.id}>
              <span>{s.icon}</span>
              <small>{s.category}</small>
              <h3>{s.sceneName}</h3>
              <p>{s.description}</p>
              <footer>
                <span>{s.plotCount} 个地块</span>
                <div>
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openScene(s)} />
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeScene(s)} />
                  <Button
                    size="small"
                    type={s.active ? "primary" : "default"}
                    onClick={() => activate(s)}
                  >
                    {s.active ? "运行中" : "启用"}
                  </Button>
                </div>
              </footer>
            </article>
          ))}
        </div>
      </section>
      <section className="iot-card iot-table">
        <CardHead title="自动化规则" sub="触发条件、执行设备和动作配置" />
        <Table
          rowKey="id"
          pagination={false}
          dataSource={rules}
          columns={[
            {
              title: "规则",
              dataIndex: "ruleName",
              render: (_, r) => (
                <div className="entity-copy">
                  <b>{r.ruleName}</b>
                  <small>{r.ruleCode}</small>
                </div>
              ),
            },
            { title: "触发条件", dataIndex: "trigger" },
            { title: "执行动作", dataIndex: "action" },
            {
              title: "执行位置",
              render: (_, r) =>
                parseRuleConfig(r.config).executionMode === "cloud" ? "云端" : "边缘网关",
            },
            { title: "冷却", render: (_, r) => `${Math.round((r.cooldownSeconds || 0) / 60)} 分钟` },
            { title: "触发次数", dataIndex: "triggerCount" },
            { title: "最近触发", dataIndex: "lastTrigger" },
            {
              title: "状态",
              dataIndex: "enabled",
              render: (v, r) => (
                <Button size="small" onClick={() => void toggle(r.id)}>
                  {v ? "运行中" : "已停用"}
                </Button>
              ),
            },
            {
              title: "操作",
              render: (_, r) => (
                <>
                  <Button size="small" type="text" icon={<PlayCircleOutlined />} onClick={() => void executeRule(r.id)}>执行</Button>
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openRule(r)}>编辑</Button>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeRule(r)}>删除</Button>
                </>
              ),
            },
          ]}
        />
      </section>
      <Modal
        title={editingScene ? "编辑场景" : "新建场景"}
        open={sceneOpen}
        onCancel={() => setSceneOpen(false)}
        onOk={() => void submitScene()}
        okText={editingScene ? "保存场景" : "创建场景"}
        confirmLoading={submitting}
      >
        <Form form={sceneForm} layout="vertical">
          <div className="form-grid">
            <Form.Item label="场景名称" name="sceneName" rules={[{ required: true, message: "请输入场景名称" }]}>
              <Input placeholder="例如：低温保温" />
            </Form.Item>
            <Form.Item label="场景图标" name="icon"><Input maxLength={8} /></Form.Item>
          </div>
          <div className="form-grid">
            <Form.Item label="场景分类" name="category">
              <Select options={["环境控制", "水肥管理", "植保管理", "自定义场景"].map((v) => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item label="适用地块数量" name="plotCount">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item label="场景说明" name="description">
            <Input.TextArea rows={3} placeholder="说明场景用途和执行目标" />
          </Form.Item>
          <Form.Item label="执行配置" name="config" extra='可使用 JSON，例如 {"valve":"on","durationMinutes":15}'>
            <Input.TextArea rows={5} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={editingRule ? "编辑自动化规则" : "新建自动化规则"}
        open={ruleOpen}
        width={720}
        onCancel={() => setRuleOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setRuleOpen(false)}>取消</Button>,
          <Button key="save" onClick={() => void submitRule(false)} loading={submitting}>
            仅保存
          </Button>,
          <Button key="test" type="primary" onClick={() => void submitRule(true)} loading={submitting}>
            保存并测试
          </Button>,
        ]}
      >
        <Form form={ruleForm} layout="vertical">
          <div className="form-grid">
            <Form.Item label="规则名称" name="ruleName" rules={[{ required: true, message: "请输入规则名称" }]}>
              <Input placeholder="例如：高温自动通风" />
            </Form.Item>
            <Form.Item label="规则类型" name="ruleType" rules={[{ required: true, message: "请选择规则类型" }]}>
              <Select options={[
                { value: "automation", label: "传感器自动触发" },
                { value: "schedule", label: "定时触发" },
                { value: "offline", label: "设备离线触发" },
              ]} />
            </Form.Item>
          </div>
          <div className="dialog-summary">
            <b>IF · 触发条件</b>
            <span>
              {selectedRuleType === "schedule"
                ? "到达设定时间后触发"
                : selectedRuleType === "offline"
                  ? "受控设备离线后触发"
                  : selectedTriggerMetric === "device_offline"
                    ? "监测指标进入离线状态后触发"
                    : "监测指标满足阈值并持续达到设定时间后触发"}
            </span>
          </div>
          {selectedRuleType === "schedule" && (
            <Form.Item
              label="定时表达式"
              name="schedule"
              rules={[{ required: true, whitespace: true, message: "请填写定时表达式" }]}
              extra="支持每天 18:00、22:00-06:00 等调度描述"
            >
              <Input placeholder="例如：每天 18:00" />
            </Form.Item>
          )}
          {selectedRuleType === "offline" && (
            <div className="dialog-summary">
              <span>规则将在任一受控设备离线后执行下方动作；冷却时间用于避免重复下发。</span>
            </div>
          )}
          {selectedRuleType === "automation" && (
            <>
              <div className="form-grid">
                <Form.Item label="触发指标" name="triggerMetric" rules={[{ required: true, message: "请选择触发指标" }]}>
                  <Select options={[
                    { value: "temperature", label: "空气温度" },
                    { value: "humidity", label: "空气湿度" },
                    { value: "soil_moisture", label: "土壤含水率" },
                    { value: "co2", label: "CO₂浓度" },
                    { value: "light", label: "光照强度" },
                    { value: "rain", label: "降雨量" },
                    { value: "device_offline", label: "设备离线" },
                  ]} />
                </Form.Item>
                {selectedTriggerMetric !== "device_offline" && (
                  <Form.Item label="比较方式" name="operator" rules={[{ required: true, message: "请选择比较方式" }]}>
                    <Select options={[">", ">=", "<", "<=", "=="].map((v) => ({ value: v, label: v }))} />
                  </Form.Item>
                )}
                {selectedTriggerMetric !== "device_offline" && (
                  <Form.Item label="阈值" name="threshold" rules={[{ required: true, whitespace: true, message: "请输入阈值" }]}>
                    <Input placeholder="如 32" />
                  </Form.Item>
                )}
                {selectedTriggerMetric !== "device_offline" && (
                  <Form.Item label="持续时间（秒）" name="durationSeconds">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                )}
              </div>
            </>
          )}
          <div className="dialog-summary" style={{ marginTop: 12 }}>
            <b>THEN · 执行动作</b>
            <span>选择支持远程控制的设备，并配置指令与执行位置。</span>
          </div>
          <div className="form-grid">
            <Form.Item label="执行设备" name="actionDeviceId" rules={[{ required: true, message: "请选择执行设备" }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="请选择支持远程控制的设备"
                options={devices
                  .filter((d) => d.controlCapable)
                  .map((d) => ({ value: d.id, label: `${d.deviceName} · ${d.deviceCode}` }))}
              />
            </Form.Item>
            <Form.Item label="执行指令" name="actionCommand" rules={[{ required: true, message: "请选择执行指令" }]}>
              <Select options={["on", "off", "open", "close", "start", "stop", "irrigate"].map((v) => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item label="指令参数" name="actionValue"><Input placeholder="如 15分钟、30%" /></Form.Item>
            <Form.Item label="执行位置" name="executionMode">
              <Select options={[
                { value: "edge", label: "边缘网关（本地自治）" },
                { value: "cloud", label: "云端规则引擎" },
              ]} />
            </Form.Item>
            <Form.Item label="冷却时间（秒）" name="cooldownSeconds">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label="规则状态" name="enabled">
              <Select options={[
                { value: true, label: "创建后立即启用" },
                { value: false, label: "暂不启用" },
              ]} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

function Analytics() {
  const { message } = AntApp.useApp();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof iotApi.reports>
  > | null>(null);
  useEffect(() => {
    void iotApi
      .reports()
      .then(setData)
      .catch((e: Error) => message.error(e.message));
  }, [message]);
  if (!data) return <Loading />;
  const max = Math.max(...data.daily.map((d) => d.data), 1);
  const maxControl = Math.max(...data.daily.map((d) => d.control), 1);
  const exportReport = () => {
    const count = downloadCsv(
      stampFilename("物联网数据报表"),
      [
        { key: "date", title: "日期" },
        { key: "data", title: "遥测读数" },
        { key: "control", title: "控制指令" },
      ],
      data.daily.map((item) => ({
        date: item.date,
        data: item.data,
        control: item.control,
      })),
    );
    message.success(`已导出 ${count} 行报表数据`);
  };
  return (
    <div className="iot-page">
      <PageTitle
        title="数据分析"
        desc="按当前经营主体统计遥测采集量、设备在线率、告警与控制指令。"
        actions={
          <Button onClick={exportReport}>导出报表</Button>
        }
      />
      <div className="iot-metrics">
        <Metric
          icon={<BarChartOutlined />}
          label="遥测读数"
          value={data.summary.dataPoints.toLocaleString()}
          hint="设备累计上报条数"
          tone="blue"
        />
        <Metric
          icon={<CloudServerOutlined />}
          label="设备在线率"
          value={`${data.summary.onlineRate}%`}
          hint="当前设备运行状态"
          tone="green"
        />
        <Metric
          icon={<AlertOutlined />}
          label="累计告警"
          value={String(data.summary.alerts)}
          hint="本主体设备告警事件"
          tone="red"
        />
        <Metric
          icon={<ThunderboltOutlined />}
          label="控制指令"
          value={String(data.summary.controls)}
          hint="远程控制下发次数"
          tone="amber"
        />
      </div>
      <div className="iot-two-grid">
        <section className="iot-card">
          <CardHead title="数据采集趋势" sub="最近 7 个有读数的日期" />
          {data.daily.length === 0 ? (
            <EmptyHint
              title="还没有遥测读数"
              desc="设备接入并上报后，这里会按日期展示当前主体的采集量与控制指令趋势。"
            />
          ) : (
            <div className="analytics-bars">
              {data.daily.map((d) => (
                <div key={d.date}>
                  <i style={{ height: `${(d.data / max) * 100}%` }} />
                  <span>{d.date}</span>
                  <b>{d.data}</b>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="iot-card">
          <CardHead title="设备数据量排行" sub="Top 6" />
          <div className="rank-list">
            {data.rank.map((r, i) => (
              <div key={r.name}>
                <span>{i + 1}</span>
                <div>
                  <b>{r.name}</b>
                  <small>{r.type}</small>
                </div>
                <em>{r.readings} 条</em>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="iot-card">
        <CardHead title="控制指令趋势" sub="最近 7 个有读数的日期" />
        <div className="water-list">
          {data.daily.map((d) => (
            <div key={d.date}>
              <span>{d.date}</span>
              <div>
                <i style={{ width: `${(d.control / maxControl) * 100}%` }} />
              </div>
              <b>{d.control} 条</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Maintenance() {
  const { message } = AntApp.useApp();
  const [orders, setOrders] = useState<
      Array<{
        id: number;
        orderNo: string;
        source: string;
        deviceName: string;
        type: string;
        priority: string;
        status: string;
        technician: string;
        description?: string | null;
        createdAt: string;
      }>
    >([]),
    [devices, setDevices] = useState<IotDevice[]>([]),
    [firmware, setFirmware] = useState<
      Array<{
        id: number;
        productName: string;
        version: string;
        status: string;
        releaseAt: string;
      }>
    >([]),
    [ota, setOta] = useState<
      Array<{
        id: number;
        taskNo: string;
        firmwareVersion: string;
        targetCount: number;
        successCount: number;
        failedCount: number;
        status: string;
      }>
    >([]),
    [open, setOpen] = useState(false),
    [form] = Form.useForm();
  const load = () =>
    void Promise.all([iotApi.workOrders(), iotApi.firmware(), iotApi.ota(), iotApi.devices()])
      .then(([o, f, t, d]) => {
        setOrders(o);
        setFirmware(f);
        setOta(t);
        setDevices(d);
      })
      .catch((e: Error) => message.error(e.message));
  useEffect(load, []);
  const create = async () => {
    try {
      await iotApi.createWorkOrder(await form.validateFields());
      setOpen(false);
      message.success("运维工单已创建");
      load();
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    }
  };
  return (
    <div className="iot-page">
      <PageTitle
        title="运维与 OTA"
        desc="设备工单、固件版本和批量升级任务。"
        actions={
          <Button type="primary" onClick={() => setOpen(true)}>
            + 创建工单
          </Button>
        }
      />
      <div className="iot-two-grid">
        <section className="iot-card">
          <CardHead title="运维工单" sub="设备故障与预防性维保" />
          {orders.map((o) => (
            <div className="work-order" key={o.id}>
              <div className="iot-card-head">
                <div>
                  <b>{o.deviceName}</b>
                  <small>
                    {o.orderNo} · {o.type}
                  </small>
                </div>
                <Status value={o.status} />
              </div>
              <p>
                {o.source} · {o.createdAt}
              </p>
              {o.description ? <p>{o.description}</p> : null}
              <footer>
                <span>{o.technician}</span>
                <Status value={o.priority} />
              </footer>
            </div>
          ))}
        </section>
        <section className="iot-card">
          <CardHead title="固件版本" sub="认证固件清单" />
          {firmware.map((f) => (
            <div className="firmware-row" key={f.id}>
              <span>📦</span>
              <div>
                <b>{f.productName}</b>
                <small>
                  {f.version} · {f.releaseAt}
                </small>
              </div>
              <Status value={f.status} />
            </div>
          ))}
        </section>
      </div>
      <section className="iot-card">
        <CardHead title="OTA 升级任务" sub="灰度、执行与结果" />
        {ota.map((t) => (
          <div className="ota-row" key={t.id}>
            <div>
              <b>{t.taskNo}</b>
              <small>
                {t.firmwareVersion} · 目标 {t.targetCount} 台
              </small>
            </div>
            <Progress
              percent={Math.round((t.successCount / t.targetCount) * 100)}
              strokeColor="#159a5e"
            />
            <span>
              成功 {t.successCount} / 失败 {t.failedCount}
            </span>
            <Status value={t.status} />
          </div>
        ))}
      </section>
      <Modal
        title="创建运维工单"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void create()}
        okText="提交工单"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="报修设备"
            name="deviceId"
            rules={[{ required: true, message: "请选择要报修的设备" }]}
          >
            <Select
              showSearch
              virtual={false}
              optionFilterProp="label"
              placeholder="从当前经营主体的设备台账中选择"
              notFoundContent="当前主体还没有已注册设备"
              options={devices.map((device) => ({
                value: device.id,
                label: `${device.deviceName} · ${device.deviceCode}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="问题类型" name="orderType">
            <Select
              options={[
                "设备故障",
                "供电/通信故障",
                "预防性维保",
                "安装调试",
              ].map((v) => ({ value: v, label: v }))}
            />
          </Form.Item>
          <Form.Item label="优先级" name="priority" initialValue="normal">
            <Select
              options={[
                { value: "high", label: "高" },
                { value: "normal", label: "普通" },
                { value: "low", label: "低" },
              ]}
            />
          </Form.Item>
          <Form.Item label="问题描述" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function Messages() {
  const { message } = AntApp.useApp();
  const [items, setItems] = useState<
    Array<{
      id: number;
      type: string;
      title: string;
      content: string;
      read: boolean;
      createdAt: string;
    }>
  >([]);
  const load = () =>
    void iotApi
      .messages()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  useEffect(load, []);
  const readAll = async () => {
    try {
      await iotApi.readAll();
      load();
      message.success("已全部标为已读");
    } catch (e) { message.error(e instanceof Error ? e.message : "已读保存失败"); }
  };
  return (
    <div className="iot-page">
      <PageTitle
        title="消息中心"
        desc="告警、设备、场景和 OTA 通知统一收件箱。"
        actions={<Button onClick={() => void readAll()}>全部已读</Button>}
      />
      <section className="iot-card message-list">
        {items.map((i) => (
          <button
            type="button"
            key={i.id}
            className={i.read ? "read" : ""}
            onClick={() =>
              void iotApi.readMessage(i.id).then(() => load()).catch((e: Error) => message.error(e.message))
            }
          >
            <span>
              {i.type === "alert"
                ? "🔔"
                : i.type === "device"
                  ? "📱"
                  : i.type === "scene"
                    ? "🌬️"
                    : "📦"}
            </span>
            <div>
              <b>
                {i.title}
                {!i.read && <i />}
              </b>
              <p>{i.content}</p>
              <small>{i.createdAt}</small>
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}

function MonitoringWorkspace({initial}: {initial: "dashboard" | "monitor"}) {
  const [view,setView] = useState(initial);
  useEffect(() => setView(initial),[initial]);
  return <div><div style={{padding:"16px 24px 0"}}><div style={{display:"flex",gap:8}}>
    <Button type={view === "dashboard" ? "primary" : "default"} onClick={()=>setView("dashboard")}>生产物联概况</Button>
    <Button type={view === "monitor" ? "primary" : "default"} onClick={()=>setView("monitor")}>实时遥测监测</Button>
  </div></div>{view === "monitor" ? <Monitor /> : <Dashboard />}</div>;
}

function AppContent({ page }: { page: Page }) {
  switch (page) {
    case "monitor":
    case "dashboard":
      return <MonitoringWorkspace initial={page === "monitor" ? "monitor" : "dashboard"} />;
    case "devices":
      return <Devices />;
    case "gateways":
      return <Gateways />;
    case "plots":
      return <Plots />;
    case "alerts":
      return <Alerts />;
    case "automation":
      return <Automation />;
    case "analytics":
      return <Analytics />;
    case "maintenance":
      return <Maintenance />;
    case "messages":
      return <Messages />;
    default:
      return <Dashboard />;
  }
}
function normalizePath(path: string): Page {
  const key = path.replace(/^\//, "").split("/")[0] as Page;
  return PAGES.includes(key) ? key : "dashboard";
}

const IOT_PERMISSIONS = ["iot:read", "iot:write"];

function IotShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const clock = useClock();
  const { user } = useUnifiedUser();
  const page = useMemo(
    () => normalizePath(location.pathname),
    [location.pathname],
  );
  useEffect(() => {
    if (location.pathname === "/") navigate("/dashboard", { replace: true });
  }, [location.pathname, navigate]);
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#12764a",
          colorLink: "#12764a",
          colorText: "#0b1a12",
          colorTextSecondary: "#6b7c72",
          colorBorder: "#e1e9e3",
          colorBgLayout: "#f4f7f5",
          borderRadius: 10,
          controlHeight: 36,
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif',
        },
      }}
    >
      <AntApp>
        <div className={`iot-shell${collapsed ? " collapsed" : ""}`}>
          <aside className="iot-sidebar">
            <button
              type="button"
              className="iot-brand"
              onClick={() => navigate("/dashboard")}
            >
              <img className="iot-brand-logo" src={`${import.meta.env.BASE_URL}fengchain.svg`} alt="丰链云" />
              {!collapsed && (
                <div>
                  <b>丰链云</b>
                  <small>FENGCHAIN · AGRI</small>
                </div>
              )}
            </button>
            <nav>
              {MENU.map((g) => (
                <section key={g.group}>
                  {!collapsed && <h3>{g.group}</h3>}
                  {g.items.map((i) => (
                    <button
                      type="button"
                      key={i.page}
                      className={page === i.page ? "on" : ""}
                      onClick={() => navigate("/" + i.page)}
                      title={i.label}
                    >
                      {i.icon}
                      {!collapsed && <span>{i.label}</span>}
                    </button>
                  ))}
                </section>
              ))}
            </nav>
            <div className="iot-side-foot">
              {!collapsed && (
                <div>
                  <b>设备与生产地块共用归属</b>
                  <small>状态以服务端心跳与遥测为准</small>
                </div>
              )}
              <button type="button" onClick={() => setCollapsed(!collapsed)}>
                {collapsed ? (
                  <MenuUnfoldOutlined />
                ) : (
                  <>
                    <MenuFoldOutlined />
                    收起导航
                  </>
                )}
              </button>
            </div>
          </aside>
          <div className="iot-main">
            <header className="iot-header">
              <div>
                <span>物联网管理</span>
                <b>/</b>
                <strong>{TITLES[page]}</strong>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const keyword = String(new FormData(e.currentTarget).get("keyword") || "").trim();
                  navigate(`/devices?keyword=${encodeURIComponent(keyword)}`);
                }}
              >
                <SearchOutlined />
                <input name="keyword" placeholder="搜索设备名称或编号" />
              </form>
              <div className="iot-header-right">
                <span>{clock.date}</span>
                <MessageBadge onOpen={() => navigate("/messages")} />
                <button
                  type="button"
                  className="iot-user"
                  title="点击退出统一登录"
                  onClick={() => void logoutUnified("iot")}
                >
                  <span>{(user.nickname || user.username).slice(0, 1)}</span>
                  <div>
                    <b>{user.nickname || user.username}</b>
                    <small>统一账号 · 点击退出</small>
                  </div>
                </button>
              </div>
            </header>
            <main>
              <AppContent page={page} />
            </main>
            <footer>© 2026 农业产业互联网平台 · 物联网管理系统</footer>
          </div>
        </div>
      </AntApp>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <UnifiedSsoGate
      clientId="iot"
      landingPath="/dashboard"
      requiredPermissions={IOT_PERMISSIONS}
    >
      <IotShell />
    </UnifiedSsoGate>
  );
}
