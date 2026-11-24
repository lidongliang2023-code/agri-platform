import { memberListPagination } from '@agri/shared/components/memberListPagination';
import MemberListToolbar, { columnSettingsTrigger } from '@agri/shared/components/MemberListToolbar';
import DeviceSampling from "../../shared-ui/DeviceSampling";
import CommandReceipts from '../../shared-ui/CommandReceipts'
import DeviceRemoteControl from "./components/DeviceRemoteControl";
import { Children, useEffect, useMemo, useState, type Key, type ReactNode } from "react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
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
  Checkbox,
  Popover,
  Space,
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
import zhCN from "antd/locale/zh_CN";
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
  type PlotMonitoring,
  type IotProductionFarm,
  type IotRule,
  type IotScene,
} from "./api/iotExperience";
import { downloadCsv, stampFilename } from "../../shared-ui/exportCsv";
import { useClock } from "../../shared-ui/clock";
import "./iot-app.css";
import UnifiedSsoGate from "../../shared-ui/sso";
import { TiandituMap, type TiandituMapPoint } from "@agri/shared";
import { WorkspaceNavigation, MobileNavigationButton, AccountMenu, SidebarUserCard } from "../../shared-ui/WorkspaceNavigation";
import { useBusinessSubject } from "../../shared-ui/BusinessSubject";

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
    group: "监测总览",
    items: [
      { page: "dashboard", label: "监测工作台", icon: <DashboardOutlined /> },
      { page: "monitor", label: "实时监测大屏", icon: <BarChartOutlined /> },
      { page: "plots", label: "地块监测", icon: <EnvironmentOutlined /> },
    ],
  },
  {
    group: "设备资产",
    items: [
      { page: "devices", label: "设备管理", icon: <CloudServerOutlined /> },
      { page: "gateways", label: "边缘网关", icon: <ApiOutlined /> },
    ],
  },
  {
    group: "告警与自动化",
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
    group: "消息通知",
    items: [{ page: "messages", label: "消息中心", icon: <MessageOutlined /> }],
  },
];
function Status({ value }: { value: string }) {
  const s = STATUS[value] ?? { label: value, tone: "gray" };
  return <Tag className={`iot-status tone-${s.tone}`}>{s.label}</Tag>;
}

/** 行操作收拢：最多平铺 2 个文字链接，超出部分收入「更多」弹层。 */
function IotRowActions({ children }: { children: ReactNode }) {
  const actions = Children.toArray(children).filter(Boolean);
  return (
    <Space size={8}>
      {actions.length <= 2 ? (
        actions
      ) : (
        <>
          {actions[0]}
          <Popover
            trigger="click"
            placement="bottomRight"
            content={
              <Space direction="vertical" align="start" size={4}>
                {actions.slice(1)}
              </Space>
            }
          >
            <Button type="link" size="small">
              更多
            </Button>
          </Popover>
        </>
      )}
    </Space>
  );
}

/** 物联网端表格通用的列显隐偏好存储与「列设置」弹层构建器。 */
function useIotColumnSettings<T>(
  storageKey: string,
  columns: ColumnsType<T>,
  lockedKeys: string[] = ["actions"],
) {
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const canHide = (key: string) => !lockedKeys.includes(key);
  const updateHidden = (next: string[]) => {
    const clean = next.filter(canHide);
    setHidden(clean);
    try {
      localStorage.setItem(storageKey, JSON.stringify(clean));
    } catch {
      // 存储受限时仅保留当次页面状态
    }
  };
  const colKeyOf = (col: ColumnsType<T>[number], idx: number) =>
    String(col.key ?? ("dataIndex" in col ? col.dataIndex : undefined) ?? idx);
  const visibleColumns = columns.filter((col, idx) => {
    const key = colKeyOf(col, idx);
    return !canHide(key) || !hidden.includes(key);
  });
  const columnSettings = (
    <Popover
      placement="bottomRight"
      trigger="click"
      title="显示列"
      content={
        <Space direction="vertical" size={6}>
          {columns.map((column, idx) => {
            const key = colKeyOf(column, idx);
            return (
              <Checkbox
                key={key}
                disabled={!canHide(key)}
                checked={!canHide(key) || !hidden.includes(key)}
                onChange={(event) =>
                  updateHidden(
                    event.target.checked ? hidden.filter((item) => item !== key) : [...hidden, key],
                  )
                }
              >
                {String(column.title)}
              </Checkbox>
            );
          })}
          <Button type="link" size="small" onClick={() => updateHidden([])}>
            恢复默认
          </Button>
        </Space>
      }
    >
      {columnSettingsTrigger()}
    </Popover>
  );
  return { visibleColumns, columnSettings };
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
    let alive = true;
    const refresh = () => void iotApi.messages()
      .then((items) => { if (alive) setUnread(items.filter((item) => !item.read).length); })
      .catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("iot-messages-updated", refresh);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener("iot-messages-updated", refresh); };
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

const DEVICE_HIDDEN_COLUMNS = "agri:iot:devices:hidden-columns:v1";

function Devices() {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(DEVICE_HIDDEN_COLUMNS) ?? "[]");
      return Array.isArray(saved) ? saved.filter((key) => typeof key === "string") : [];
    } catch { return []; }
  });
  const changeHiddenColumns = (next: string[]) => {
    setHiddenColumns(next);
    try { localStorage.setItem(DEVICE_HIDDEN_COLUMNS, JSON.stringify(next)); }
    catch { /* 存储不可用时，当前页面仍可切换列。 */ }
  };

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
    [bindingOpen, setBindingOpen] = useState(false),
    [bindingSaving, setBindingSaving] = useState(false),
    [bindingLoading, setBindingLoading] = useState(false),
    [bindingPlotId, setBindingPlotId] = useState<number | null>(null),
    [plotLoadError, setPlotLoadError] = useState(""),
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
  useEffect(() => {
    const ids = new Set(items.map((item) => item.id));
    setSelectedKeys((keys) => keys.filter((key) => ids.has(Number(key))));
  }, [items]);
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
      setPlotLoadError("");
    } catch (error) {
      setPlotLoadError(error instanceof Error ? error.message : "生产地块加载失败");
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
  const openBinding = async () => {
    if (!detail) return;
    setBindingPlotId(detail.plotId);
    setBindingLoading(true);
    try {
      const rows = await iotApi.plots();
      setPlots(rows);
      setPlotLoadError("");
      setBindingOpen(true);
    } catch (error) {
      setPlotLoadError(error instanceof Error ? error.message : "生产地块加载失败");
      message.error("生产地块加载失败，未打开绑定表单，请刷新后重试");
    } finally {
      setBindingLoading(false);
    }
  };
  const saveBinding = async () => {
    if (!detail) return;
    if (bindingPlotId !== null && !plots.some((plot) => plot.id === bindingPlotId && plot.farmId === detail.farmId && plot.productionStatus !== 0)) {
      message.error("请选择设备所在农场的启用地块，或清空以解除绑定");
      return;
    }
    setBindingSaving(true);
    try {
      const updated = await iotApi.updateDevice(detail.id, { plotId: bindingPlotId });
      setDetail((current) => current?.id === updated.id ? { ...current, ...updated } : current);
      setBindingOpen(false);
      message.success(bindingPlotId === null ? "已解除地块绑定" : "地块绑定已保存");
      await loadDevices();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存地块绑定失败");
    } finally {
      setBindingSaving(false);
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
        config: "{}",
        reportInterval: 30,
        samplingToleranceSeconds: 5,
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
        config: JSON.stringify({ ...JSON.parse(String(values.config || "{}")), reportInterval: values.reportInterval, samplingToleranceSeconds: values.samplingToleranceSeconds }),
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
      key: "device",
      width: 185,
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
      key: "protocol",
      width: 155,
      title: "类型 / 协议",
      render: (_, r) => (
        <div className="entity-copy">
          <b>{r.typeName}</b>
          <small>{r.protocol} · {r.controlCapable ? "支持远程控制" : "仅数据采集"}</small>
        </div>
      ),
    },
    {
      key: "location",
      width: 180,
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
      key: "group",
      width: 110,
      title: "设备分组",
      render: (_, r) => groups.find((item) => item.id === r.groupId)?.name || "未分组",
    },
    {
      key: "status",
      width: 125,
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
      key: "quality",
      width: 130,
      align: "right",
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
      key: "actions",
      width: 118,
      align: "right",
      fixed: "right",
      title: "操作",
      render: (_, r) => (
        <Button type="link" onClick={() => open(r.id)}>
          {r.controlCapable ? "详情与控制" : "查看详情"}
        </Button>
      ),
    },
  ];
  const canHide = (key: string) => key !== "device" && key !== "actions";
  const visibleColumns = columns.filter(({ key }) => !canHide(String(key)) || !hiddenColumns.includes(String(key)));
  return (
    <div className="iot-page device-member-list" aria-label="设备管理">
      <section className="iot-card device-filter-card" aria-label="设备筛选">
        <Form className="device-filter-grid" layout="vertical" onFinish={() => void loadDevices()}>
          <Form.Item label="设备名称或编码" htmlFor="device-filter-0">
            <Input
              id="device-filter-0"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
              placeholder="输入设备名称或编码"
            />
          </Form.Item>
          <Form.Item label="设备状态" htmlFor="device-filter-1">
            <Select
              id="device-filter-1"
              value={status}
              onChange={setStatus}
              options={["all", "online", "offline", "alert"].map((v) => ({
                value: v,
                label: STATUS[v]?.label || "全部状态",
              }))}
            />
          </Form.Item>
          <Form.Item label="设备分组" htmlFor="device-filter-2">
            <Select
              id="device-filter-2"
              allowClear
              value={group}
              onChange={setGroup}
              placeholder="全部设备分组"
              options={groups.map((g) => ({
                value: g.id,
                label: `${g.icon} ${g.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="安装地块" htmlFor="device-filter-3">
            <Select
              id="device-filter-3"
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
          </Form.Item>
          <Space className="device-filter-actions">
            <Button onClick={() => void resetFilters()}>重置</Button>
            <Button type="primary" htmlType="submit">查询</Button>
          </Space>
        </Form>
        {plotLoadError && <div role="alert">生产地块暂不可用：{plotLoadError}。请刷新后重试，当前绑定不会改变。</div>}
      </section>
      <section className="iot-card iot-table device-table-card" aria-label="设备清单">
        <div className="device-list-toolbar">
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => void openCreate()}>
              注册设备
            </Button>
            <Popover trigger="click" title="当前筛选结果" content={<Space direction="vertical">
              <span>当前设备 {items.length} 台</span>
              <span>在线 {items.filter((item) => item.onlineStatus === 'online').length} 台</span>
              <span>异常 / 离线 {items.filter((item) => item.onlineStatus !== 'online').length} 台</span>
              <span>远程可控 {items.filter((item) => item.controlCapable).length} 台</span>
            </Space>}><Button>设备统计</Button></Popover>
          </Space>
          <MemberListToolbar refreshing={loading} onRefresh={loadDevices} columnSettings={
              <Popover placement="bottomRight" trigger="click" title="显示列" content={
              <Space direction="vertical" size={6}>
                {columns.map((column) => {
                  const key = String(column.key);
                  return <Checkbox key={key} disabled={!canHide(key)}
                    checked={!canHide(key) || !hiddenColumns.includes(key)}
                    onChange={(event) => changeHiddenColumns(event.target.checked
                      ? hiddenColumns.filter((item) => item !== key) : [...hiddenColumns, key])}>
                    {String(column.title)}
                  </Checkbox>;
                })}
                <Button type="link" size="small" onClick={() => changeHiddenColumns([])}>恢复默认</Button>
              </Space>
            }>
                {columnSettingsTrigger()}
              </Popover>
            } />
        </div>
        <Table
          rowKey="id"
          tableLayout="fixed"
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys, columnWidth: 44 }}
          columns={visibleColumns}
          dataSource={items}
          loading={loading}
          scroll={{ x: visibleColumns.reduce((width, column) => width + Number(column.width), 44) }}
          locale={{ emptyText: <EmptyHint icon="📡" title="暂无设备" desc="当前经营主体还没有登记设备，或筛选条件没有匹配结果。" /> }}
          pagination={memberListPagination({}, selectedKeys.length)}
        />
      </section>
      <Modal title="维护地块绑定" open={bindingOpen} confirmLoading={bindingSaving}
        onOk={() => void saveBinding()} onCancel={() => { if (!bindingSaving) setBindingOpen(false); }}
        okText="保存绑定" cancelText="取消" maskClosable={!bindingSaving} closable={!bindingSaving} cancelButtonProps={{ disabled: bindingSaving }} destroyOnClose>
        <p>设备：{detail?.deviceName}（{detail?.deviceCode}）</p>
        <p>所属农场：{farms.find((farm) => farm.id === detail?.farmId)?.farmName || `农场 #${detail?.farmId}`}</p>
        <Form layout="vertical">
          <Form.Item label="安装地块" extra="只允许选择设备所在农场的启用地块。清空后保存即解除绑定。">
            <Select style={{ width: "100%" }} allowClear showSearch optionFilterProp="label"
              value={bindingPlotId} onChange={(value: number | undefined) => setBindingPlotId(value ?? null)}
              placeholder="未绑定地块" disabled={bindingSaving}
              options={plots.filter((plot) => plot.farmId === detail?.farmId && plot.productionStatus !== 0).map((plot) => ({
                value: plot.id, label: `${plot.plotName} · ${plot.plotCode}`,
              }))} />
          </Form.Item>
        </Form>
        <small>保存后设备列表及地块监测按新关联实时查询；不迁移设备历史数据，不向硬件下发指令。</small>
      </Modal>
      <Modal
        title="设备详情"
        open={Boolean(detail)}
        width={780}
        onCancel={() => { setBindingOpen(false); setDetail(null); }}
        footer={<Button onClick={() => { setBindingOpen(false); setDetail(null); }}>关闭</Button>}
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
            <section className="iot-card" style={{ padding: 12, marginBottom: 12 }}>
              <div className="iot-actions" style={{ justifyContent: "space-between" }}>
                <b>生产地块关联</b>
                <Button loading={bindingLoading} onClick={() => void openBinding()}>维护地块绑定</Button>
              </div>
              <p>所属农场：{farms.find((farm) => farm.id === detail.farmId)?.farmName || `农场 #${detail.farmId}`}</p>
              <p>安装地块：{detail.plotId === null ? "未绑定地块" : plots.find((plot) => plot.id === detail.plotId)?.plotName || `地块 #${detail.plotId}（暂未取得档案）`}</p>
              <small>地块档案由生产管理维护；这里只维护设备关联，不修改网关、设备坐标或历史采样。</small>
            </section>
            <DeviceSampling key={detail.id} deviceId={detail.id} load={iotApi.sampling} save={iotApi.saveSampling} />
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
                  <small>设备已注册，收到有效采样后将在此展示遥测数据；接入状态以实际设备上报为准。</small>
                </div>
              </div>
            )}
            <DeviceRemoteControl key={detail.id} device={detail} />
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
            <Form.Item label="安装地块" name="plotId" help={plotLoadError ? "生产地块加载失败，请刷新后重试" : undefined} validateStatus={plotLoadError ? "error" : undefined}>
              <Select
                disabled={Boolean(plotLoadError)}
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={plots.some((plot) => plot.farmId === selectedFarmId) ? "选择该农场下的生产地块" : "该农场暂无地块，可不绑定"}
                options={plots.filter((plot) => plot.farmId === selectedFarmId && plot.productionStatus !== 0).map((plot) => ({
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
          <div className="form-grid">
            <Form.Item label="采样周期（秒）" name="reportInterval" rules={[{required:true, message:"请输入采样周期"}]}><InputNumber min={1} max={86400} precision={0} style={{width:"100%"}} /></Form.Item>
            <Form.Item label="允许延迟（秒）" name="samplingToleranceSeconds" rules={[{required:true, message:"请输入允许延迟"}]}><InputNumber min={0} max={86400} precision={0} style={{width:"100%"}} /></Form.Item>
          </div>
          <p>按每个告警指标的实际采样频率配置；平台保存不代表已下发硬件。</p>
          <Form.Item
            label="设备配置 JSON"
            name="config"
            extra='示例：{"channel":1}；采样相关参数以上方字段为准'
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
    [draftKeyword, setDraftKeyword] = useState(""),
    [draftStatus, setDraftStatus] = useState("all"),
    [draftFarmFilter, setDraftFarmFilter] = useState<number | undefined>(),
    [keyword, setKeyword] = useState(""),
    [status, setStatus] = useState("all"),
    [farmFilter, setFarmFilter] = useState<number | undefined>(),
    [selectedKeys, setSelectedKeys] = useState<Key[]>([]),
    [detail, setDetail] = useState<IotPlot | null>(null),
    [detailMonitoring, setDetailMonitoring] = useState<PlotMonitoring | null>(null),
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
    setDetailMonitoring(null);
    setDetailLoading(true);
    try {
      setDetailMonitoring(await iotApi.plotMonitoring(plot.id));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "地块监测数据加载失败");
    } finally {
      setDetailLoading(false);
    }
  };
  const openDevices = (plotId: number) => navigate(`/devices?plotId=${plotId}`);
  const applyFilter = () => {
    setKeyword(draftKeyword);
    setStatus(draftStatus);
    setFarmFilter(draftFarmFilter);
  };
  const resetFilter = () => {
    setDraftKeyword("");
    setDraftStatus("all");
    setDraftFarmFilter(undefined);
    setKeyword("");
    setStatus("all");
    setFarmFilter(undefined);
  };
  const columns: ColumnsType<IotPlot> = [
    {
      key: "plot",
      width: 190,
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
      key: "farm",
      width: 190,
      title: "生产农场",
      render: (_, plot) => (
        <div className="entity-copy">
          <b>{plot.farmName || `农场 #${plot.farmId}`}</b>
          <small>{plot.farmCode} · 租户 {plot.tenantId || "—"}</small>
        </div>
      ),
    },
    {
      key: "crop",
      width: 140,
      title: "当前作物",
      render: (_, plot) => (
        <div className="entity-copy">
          <b>{plot.cropName || "未种植"}</b>
          <small>{plot.cropStage}</small>
        </div>
      ),
    },
    { key: "area", width: 100, align: "right", title: "面积", render: (_, plot) => `${plot.area} 亩` },
    {
      key: "coverage",
      width: 150,
      align: "right",
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
      key: "status",
      width: 140,
      title: "生产状态",
      render: (_, plot) => (
        <div className="plot-state-cell">
          <Status value={plot.status === "warning" ? "alert" : "online"} />
          <small>{plot.status === "warning" ? "生产状态需关注" : "生产运行正常"}</small>
        </div>
      ),
    },
    {
      key: "actions",
      width: 150,
      align: "right",
      fixed: "right",
      title: "操作",
      render: (_, plot) => (
        <IotRowActions>
          <Button key="monitor" type="link" size="small" onClick={() => void openDetail(plot)}>查看监测</Button>
          <Button key="devices" type="link" size="small" onClick={() => openDevices(plot.id)}>设备</Button>
        </IotRowActions>
      ),
    },
  ];
  const plotCols = useIotColumnSettings("iot_plot_hidden_columns_v1", columns, ["plot", "actions"]);
  return (
    <div className="iot-page device-member-list">
      <PageTitle
        title="地块监测"
        desc="生产地块、作物状态与物联网设备覆盖的一体化监测。"
        actions={
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
        }
      />
      <div className="plot-summary">
        <div><span className="tone-green"><EnvironmentOutlined /></span><small>地块总数</small><b>{items.length}</b><em>生产管理同步</em></div>
        <div><span className="tone-blue"><AppstoreOutlined /></span><small>种植面积</small><b>{totalArea.toFixed(1)}</b><em>亩</em></div>
        <div><span className="tone-orange"><CloudServerOutlined /></span><small>监测设备</small><b>{totalDevices}</b><em>已覆盖地块</em></div>
        <div><span className="tone-green"><ApiOutlined /></span><small>设备在线率</small><b>{totalDevices ? Math.round((onlineDevices / totalDevices) * 100) : 0}%</b><em>{onlineDevices} 台在线</em></div>
      </div>
      <section className="iot-card device-filter-card" aria-label="地块筛选">
        <Form className="device-filter-grid" layout="vertical" onFinish={applyFilter}>
          <Form.Item label="关键字">
            <Input
              prefix={<SearchOutlined />}
              allowClear
              value={draftKeyword}
              onChange={(event) => setDraftKeyword(event.target.value)}
              placeholder="地块名称、编码、作物或农场"
            />
          </Form.Item>
          <Form.Item label="生产状态">
            <Select
              value={draftStatus}
              onChange={setDraftStatus}
              options={[
                { value: "all", label: "全部状态" },
                { value: "normal", label: "运行正常" },
                { value: "warning", label: "需要关注" },
              ]}
            />
          </Form.Item>
          <Form.Item label="生产农场">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={draftFarmFilter}
              onChange={setDraftFarmFilter}
              placeholder="全部生产农场"
              options={farms.map((farm) => ({ value: farm.id, label: farm.farmName }))}
            />
          </Form.Item>
          <Space className="device-filter-actions">
            <Button onClick={resetFilter}>重置</Button>
            <Button type="primary" htmlType="submit">查询</Button>
          </Space>
        </Form>
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
          <div className="device-list-toolbar">
            <Space wrap>
              <Button icon={<EnvironmentOutlined />} onClick={() => window.location.assign(`${window.location.protocol}//${window.location.hostname}/production/plots`)}>
                查看生产地块
              </Button>
            </Space>
            <MemberListToolbar refreshing={loading} onRefresh={() => void load()} columnSettings={plotCols.columnSettings} />
          </div>
          <Table
            rowKey="id"
            tableLayout="fixed"
            loading={loading}
            dataSource={filteredItems}
            columns={plotCols.visibleColumns}
            rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys, columnWidth: 44 }}
            scroll={{ x: plotCols.visibleColumns.reduce((w, col) => w + Number(col.width || 140), 44) }}
            locale={{ emptyText: <EmptyHint icon="🌾" title="暂无地块" desc="当前经营主体还没有同步生产地块，或筛选条件没有匹配结果。" /> }}
            pagination={memberListPagination({}, selectedKeys.length)}
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
            <div className="plot-live-section">
              <div className="gateway-device-title">
                <b>最近监测数据</b>
                <span>{detailMonitoring?.summary.latestAt ? `更新于 ${detailMonitoring.summary.latestAt}` : "暂无遥测记录"}</span>
              </div>
              {detailLoading ? <div className="plot-detail-loading">正在加载监测数据…</div> : detailMonitoring?.telemetry.length ? (
                <div className="plot-telemetry-grid">
                  {detailMonitoring.telemetry.map((item) => (
                    <div key={item.key}><small>{item.name}</small><b>{item.value}<em>{item.unit}</em></b><span>{item.recordedAt}</span></div>
                  ))}
                </div>
              ) : <div className="gateway-detail-empty"><span>📈</span><div><b>该地块暂无遥测记录</b><small>设备完成首次上报后，这里会显示最新环境数据。</small></div></div>}
            </div>
            <div className="plot-live-section">
              <div className="gateway-device-title">
                <b>地块监测设备</b>
                <span>{detailMonitoring?.summary.deviceCount ?? 0} 台 · 在线 {detailMonitoring?.summary.onlineCount ?? 0} 台</span>
              </div>
              <div className="modal-list">
                {detailLoading ? <div className="plot-detail-loading">正在加载设备监测数据…</div> : detailMonitoring?.devices.length ? detailMonitoring.devices.map((device) => (
                  <div key={device.id}>
                    <span>{typeIcon(device.typeName)}</span>
                    <div><b>{device.deviceName}</b><small>{device.deviceCode} · {device.protocol} · {device.lastReport}</small></div>
                    <Status value={device.onlineStatus} />
                  </div>
                )) : (
                  <div className="gateway-detail-empty"><span>📡</span><div><b>该地块暂未挂载设备</b><small>请在物联网设备管理中选择生产农场和地块进行关联。</small></div></div>
                )}
              </div>
            </div>
            <div className="plot-live-section">
              <div className="gateway-device-title"><b>地块关联告警</b><span>当前地块设备产生的告警</span></div>
              {detailMonitoring?.alerts.length ? <div className="plot-alert-list">{detailMonitoring.alerts.slice(0, 5).map((alert) => (
                <div key={alert.id}><Status value={alert.level} /><div><b>{alert.title}</b><small>{alert.content} · {alert.createdAt}</small></div><Status value={alert.status} /></div>
              ))}</div> : <div className="gateway-detail-empty"><span>✓</span><div><b>当前地块暂无关联告警</b><small>告警处置统一在物联网预警中心完成。</small></div></div>}
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
    [loading, setLoading] = useState(false),
    [draftKeyword, setDraftKeyword] = useState(""),
    [draftLevel, setDraftLevel] = useState<string | undefined>(),
    [keyword, setKeyword] = useState(""),
    [levelFilter, setLevelFilter] = useState<string | undefined>(),
    [tenantSelectedKeys, setTenantSelectedKeys] = useState<Key[]>([]),
    [platformSelectedKeys, setPlatformSelectedKeys] = useState<Key[]>([]),
    [trialMetric, setTrialMetric] = useState("temperature"),
    [trialValue, setTrialValue] = useState("35"),
    [trial, setTrial] = useState<AlertJudgement | null>(null),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<AlertRule | null>(null),
    [submitting, setSubmitting] = useState(false),
    [form] = Form.useForm();
  const load = () => {
    setLoading(true);
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
      .catch((e: Error) => message.error(e.message))
      .finally(() => setLoading(false));
  };
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

  const tenantColumns: ColumnsType<AlertRule> = [
    { key: "ruleName", width: 170, title: "规则", dataIndex: "ruleName", ellipsis: true },
    {
      key: "condition",
      width: 190,
      title: "条件",
      render: (_, r: AlertRule) => (
        <span>
          {r.metricName} {r.operator} {Number(r.threshold)}
          {r.deviceType ? ` · ${r.deviceType}` : ""}
        </span>
      ),
    },
    {
      key: "durationSeconds",
      width: 100,
      align: "right",
      title: "持续",
      dataIndex: "durationSeconds",
      render: (v: number) => (v > 0 ? `${v} 秒` : "瞬时"),
    },
    { key: "level", width: 100, title: "等级", dataIndex: "level", render: (v: string) => <Status value={v} /> },
    {
      key: "enabled",
      width: 100,
      title: "状态",
      dataIndex: "enabled",
      render: (v: boolean) => <Status value={v ? "running" : "disabled"} />,
    },
    {
      key: "actions",
      width: 140,
      align: "right",
      fixed: "right",
      title: "操作",
      render: (_, r: AlertRule) => (
        <IotRowActions>
          <Button key="edit" type="link" size="small" onClick={() => openForm(r)}>
            编辑
          </Button>
          <Button key="toggle" type="link" size="small" onClick={() => void toggle(r)}>
            {r.enabled ? "停用" : "启用"}
          </Button>
          <Button key="delete" type="link" size="small" danger onClick={() => remove(r)}>
            删除
          </Button>
        </IotRowActions>
      ),
    },
  ];
  const platformColumns: ColumnsType<AlertRule> = [
    { key: "ruleName", width: 170, title: "规则", dataIndex: "ruleName", ellipsis: true },
    {
      key: "condition",
      width: 170,
      title: "条件",
      render: (_, r: AlertRule) => `${r.metricName} ${r.operator} ${Number(r.threshold)}`,
    },
    {
      key: "durationSeconds",
      width: 100,
      align: "right",
      title: "持续",
      dataIndex: "durationSeconds",
      render: (v: number) => `${v} 秒`,
    },
    { key: "level", width: 100, title: "等级", dataIndex: "level", render: (v: string) => <Status value={v} /> },
    {
      key: "status",
      width: 160,
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
  ];
  const tenantCols = useIotColumnSettings("iot_alert_tenant_rules_hidden_v1", tenantColumns, ["ruleName", "actions"]);
  const platformCols = useIotColumnSettings("iot_alert_platform_rules_hidden_v1", platformColumns, ["ruleName"]);
  if (!view || !options) return <Loading />;
  const matchRule = (rule: AlertRule) => {
    if (levelFilter && rule.level !== levelFilter) return false;
    const kw = keyword.trim().toLowerCase();
    if (!kw) return true;
    return `${rule.ruleName} ${rule.metricName} ${rule.deviceType || ""}`.toLowerCase().includes(kw);
  };
  const filteredTenant = view.tenant.filter(matchRule);
  const filteredPlatform = view.platform.filter(matchRule);
  const metricName = (key: string) =>
    options.metrics.find((item) => item.key === key)?.name || key;
  return (
    <div className="device-member-list">
      <section className="iot-card device-filter-card" aria-label="阈值规则筛选" style={{ marginBottom: 12 }}>
        <Form
          className="device-filter-grid"
          layout="vertical"
          onFinish={() => {
            setKeyword(draftKeyword);
            setLevelFilter(draftLevel);
          }}
        >
          <Form.Item label="关键字">
            <Input
              prefix={<SearchOutlined />}
              allowClear
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
              placeholder="规则名称 / 指标 / 设备类型"
            />
          </Form.Item>
          <Form.Item label="告警等级">
            <Select
              allowClear
              placeholder="全部等级"
              value={draftLevel}
              onChange={setDraftLevel}
              options={options.levels.map((level) => ({
                value: level,
                label: STATUS[level]?.label || level,
              }))}
            />
          </Form.Item>
          <Space className="device-filter-actions">
            <Button
              onClick={() => {
                setDraftKeyword("");
                setDraftLevel(undefined);
                setKeyword("");
                setLevelFilter(undefined);
              }}
            >
              重置
            </Button>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
          </Space>
        </Form>
      </section>
      <div className="iot-two-grid">
        <section className="iot-card iot-table">
          <div className="device-list-toolbar">
            <Space wrap>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>
                新增阈值
              </Button>
              <span style={{ color: "var(--ink4)", fontSize: 12 }}>
                我的阈值规则 · {view.tenantName ? `${view.tenantName}（同指标覆盖平台预置）` : "本经营主体生效"}
              </span>
            </Space>
            <MemberListToolbar refreshing={loading} onRefresh={load} columnSettings={tenantCols.columnSettings} />
          </div>
          {filteredTenant.length === 0 ? (
            <EmptyHint
              icon="🎚️"
              title="还没有匹配的自定义阈值"
              desc="不配置也可以：所有指标按平台预置阈值判定。需要更贴合本主体作物/设施的值时再新增。"
            />
          ) : (
            <Table
              rowKey="id"
              tableLayout="fixed"
              loading={loading}
              dataSource={filteredTenant}
              columns={tenantCols.visibleColumns}
              rowSelection={{ selectedRowKeys: tenantSelectedKeys, onChange: setTenantSelectedKeys, columnWidth: 44 }}
              scroll={{ x: tenantCols.visibleColumns.reduce((w, col) => w + Number(col.width || 140), 44) }}
              pagination={memberListPagination({}, tenantSelectedKeys.length)}
            />
          )}
        </section>
        <section className="iot-card iot-table">
          <div className="device-list-toolbar">
            <span style={{ fontWeight: 600 }}>
              平台预置阈值 <small style={{ color: "var(--ink4)", fontWeight: 400 }}>全平台兜底默认值，本页面只读</small>
            </span>
            <MemberListToolbar refreshing={loading} onRefresh={load} columnSettings={platformCols.columnSettings} />
          </div>
          <Table
            rowKey="id"
            tableLayout="fixed"
            loading={loading}
            dataSource={filteredPlatform}
            columns={platformCols.visibleColumns}
            rowSelection={{ selectedRowKeys: platformSelectedKeys, onChange: setPlatformSelectedKeys, columnWidth: 44 }}
            scroll={{ x: platformCols.visibleColumns.reduce((w, col) => w + Number(col.width || 140), 44) }}
            pagination={memberListPagination({}, platformSelectedKeys.length)}
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
          <Form.Item shouldUpdate={(prev, next) => prev.metricKey !== next.metricKey}>
            {() => {
              const item = options.metrics.find((metric) => metric.key === form.getFieldValue("metricKey"));
              return <div className="dialog-summary" style={{ marginTop: -4 }}>
                <b>{item ? `${item.name}${item.unit ? `（${item.unit}）` : ""}` : "请选择指标"}</b>
                <span>{item?.deviceTypes?.length ? `可用设备类型：${item.deviceTypes.join("、")}` : "按设备上报的该指标判定"}；持续时间必须由对应采样周期覆盖，采样断档不会触发持续告警。</span>
              </div>;
            }}
          </Form.Item>
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
              <InputNumber min={0} max={86400} step={1} style={{ width: "100%" }} />
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
    </div>
  );
}

function Alerts() {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const tab = new URLSearchParams(location.search).get("tab") === "rules" || location.pathname === "/alert-rules" ? "rules" : "alerts";
  const setTab = (next: "alerts" | "rules") => {
    const params = new URLSearchParams(location.search);
    params.set("tab", next);
    navigate({ pathname: "/alerts", search: `?${params.toString()}`, hash: location.hash });
  };
  const [items, setItems] = useState<IotAlert[]>([]),
    [target, setTarget] = useState<IotAlert | null>(null),
    [note, setNote] = useState("");
  const load = () =>
    void iotApi
      .alerts()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);
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
    [loading, setLoading] = useState(false),
    [draftKeyword, setDraftKeyword] = useState(""),
    [draftExecMode, setDraftExecMode] = useState<string | undefined>(),
    [draftEnabled, setDraftEnabled] = useState<string | undefined>(),
    [keyword, setKeyword] = useState(""),
    [execModeFilter, setExecModeFilter] = useState<string | undefined>(),
    [enabledFilter, setEnabledFilter] = useState<string | undefined>(),
    [selectedRuleKeys, setSelectedRuleKeys] = useState<Key[]>([]),
    [sceneOpen, setSceneOpen] = useState(false),
    [ruleOpen, setRuleOpen] = useState(false),
    [editingScene, setEditingScene] = useState<IotScene | null>(null),
    [editingRule, setEditingRule] = useState<IotRule | null>(null),
    [submitting, setSubmitting] = useState(false);
  const [sceneForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const selectedRuleType = Form.useWatch("ruleType", ruleForm);
  const selectedTriggerMetric = Form.useWatch("triggerMetric", ruleForm);
  const load = () => {
    setLoading(true);
    void Promise.all([iotApi.scenes(), iotApi.rules(), iotApi.devices()])
      .then(([s, r, d]) => {
        setScenes(s);
        setRules(r);
        setDevices(d);
      })
      .catch((e: Error) => message.error(e.message))
      .finally(() => setLoading(false));
  };
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
  const filteredRules = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return rules.filter((r) => {
      if (execModeFilter) {
        const mode = parseRuleConfig(r.config).executionMode === "cloud" ? "cloud" : "edge";
        if (mode !== execModeFilter) return false;
      }
      if (enabledFilter === "enabled" && !r.enabled) return false;
      if (enabledFilter === "disabled" && r.enabled) return false;
      if (kw) {
        const hay = `${r.ruleName} ${r.ruleCode || ""} ${r.trigger || ""} ${r.action || ""}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [rules, keyword, execModeFilter, enabledFilter]);
  const ruleColumns: ColumnsType<IotRule> = [
    {
      key: "rule",
      width: 190,
      title: "规则",
      dataIndex: "ruleName",
      render: (_, r) => (
        <div className="entity-copy">
          <b>{r.ruleName}</b>
          <small>{r.ruleCode}</small>
        </div>
      ),
    },
    { key: "trigger", width: 200, title: "触发条件", dataIndex: "trigger", ellipsis: true },
    { key: "action", width: 200, title: "执行动作", dataIndex: "action", ellipsis: true },
    {
      key: "mode",
      width: 110,
      title: "执行位置",
      render: (_, r) => (parseRuleConfig(r.config).executionMode === "cloud" ? "云端" : "边缘网关"),
    },
    {
      key: "cooldown",
      width: 100,
      align: "right",
      title: "冷却",
      render: (_, r) => `${Math.round((r.cooldownSeconds || 0) / 60)} 分钟`,
    },
    { key: "triggerCount", width: 100, align: "right", title: "触发次数", dataIndex: "triggerCount" },
    { key: "lastTrigger", width: 160, title: "最近触发", dataIndex: "lastTrigger" },
    {
      key: "enabled",
      width: 110,
      title: "状态",
      dataIndex: "enabled",
      render: (v) => <Status value={v ? "running" : "disabled"} />,
    },
    {
      key: "actions",
      width: 150,
      align: "right",
      fixed: "right",
      title: "操作",
      render: (_, r) => (
        <IotRowActions>
          <Button key="exec" size="small" type="link" icon={<PlayCircleOutlined />} onClick={() => void executeRule(r.id)}>执行</Button>
          <Button key="toggle" size="small" type="link" onClick={() => void toggle(r.id)}>{r.enabled ? "停用" : "启用"}</Button>
          <Button key="edit" size="small" type="link" icon={<EditOutlined />} onClick={() => openRule(r)}>编辑</Button>
          <Button key="del" size="small" type="link" danger icon={<DeleteOutlined />} onClick={() => removeRule(r)}>删除</Button>
        </IotRowActions>
      ),
    },
  ];
  const ruleCols = useIotColumnSettings("iot_automation_rules_hidden_v1", ruleColumns, ["rule", "actions"]);
  return (
    <div className="iot-page device-member-list">
      <PageTitle
        title="场景与自动化"
        desc="环境联动场景、自动化规则和手动执行。"
        actions={<Button icon={<PlusOutlined />} onClick={() => openScene()}>新建场景</Button>}
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
      <section className="iot-card device-filter-card" aria-label="自动化规则筛选">
        <Form
          className="device-filter-grid"
          layout="vertical"
          onFinish={() => {
            setKeyword(draftKeyword);
            setExecModeFilter(draftExecMode);
            setEnabledFilter(draftEnabled);
          }}
        >
          <Form.Item label="关键字">
            <Input
              prefix={<SearchOutlined />}
              allowClear
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
              placeholder="规则名称 / 编码 / 触发条件 / 动作"
            />
          </Form.Item>
          <Form.Item label="执行位置">
            <Select
              allowClear
              placeholder="全部位置"
              value={draftExecMode}
              onChange={setDraftExecMode}
              options={[
                { value: "edge", label: "边缘网关" },
                { value: "cloud", label: "云端" },
              ]}
            />
          </Form.Item>
          <Form.Item label="状态">
            <Select
              allowClear
              placeholder="全部状态"
              value={draftEnabled}
              onChange={setDraftEnabled}
              options={[
                { value: "enabled", label: "运行中" },
                { value: "disabled", label: "已停用" },
              ]}
            />
          </Form.Item>
          <Space className="device-filter-actions">
            <Button
              onClick={() => {
                setDraftKeyword("");
                setDraftExecMode(undefined);
                setDraftEnabled(undefined);
                setKeyword("");
                setExecModeFilter(undefined);
                setEnabledFilter(undefined);
              }}
            >
              重置
            </Button>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
          </Space>
        </Form>
      </section>
      <section className="iot-card iot-table">
        <div className="device-list-toolbar">
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openRule()}>
              新建规则
            </Button>
          </Space>
          <MemberListToolbar refreshing={loading} onRefresh={load} columnSettings={ruleCols.columnSettings} />
        </div>
        <Table
          rowKey="id"
          tableLayout="fixed"
          loading={loading}
          dataSource={filteredRules}
          columns={ruleCols.visibleColumns}
          rowSelection={{ selectedRowKeys: selectedRuleKeys, onChange: setSelectedRuleKeys, columnWidth: 44 }}
          scroll={{ x: ruleCols.visibleColumns.reduce((w, col) => w + Number(col.width || 140), 44) }}
          locale={{ emptyText: <EmptyHint icon="⚡" title="暂无自动化规则" desc="请调整筛选条件或点击「新建规则」配置联动策略。" /> }}
          pagination={memberListPagination({}, selectedRuleKeys.length)}
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
      .then((rows) => { setItems(rows); window.dispatchEvent(new Event("iot-messages-updated")); })
      .catch((e: Error) => message.error(e.message));
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);
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
  if (path.replace(/\/+$/, "") === "/alert-rules") return "alerts";
  const key = path.replace(/^\//, "").split("/")[0] as Page;
  return PAGES.includes(key) ? key : "dashboard";
}

const IOT_PERMISSIONS = ["iot:read", "iot:write"];

function IotShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth >= 1024 && window.innerWidth < 1280);
  const clock = useClock();
  const subject = useBusinessSubject();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const syncLayout = () => {
      const w = window.innerWidth;
      if (w >= 1024 && w < 1280) setCollapsed(true);
      else if (w >= 1280) setCollapsed(false);
      if (w >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);
  const page = useMemo(
    () => normalizePath(location.pathname),
    [location.pathname],
  );
  useEffect(() => {
    if (location.pathname === "/") navigate("/dashboard", { replace: true });
    if (location.pathname.replace(/\/+$/, "") === "/alert-rules") {
      const params = new URLSearchParams(location.search);
      params.set("tab", "rules");
      navigate({ pathname: "/alerts", search: `?${params.toString()}`, hash: location.hash }, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#2d8f4e",
          colorLink: "#2d8f4e",
          colorText: "#1a1a1a",
          colorTextSecondary: "#595959",
          colorBorder: "#e8e8e8",
          colorBgLayout: "#f5f6fa",
          borderRadius: 6,
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
            <WorkspaceNavigation clientId="iot" groups={MENU} selected={page} collapsed={collapsed}
              onNavigate={key => navigate("/" + key)} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
            <div className="pc-side-user">
              <SidebarUserCard clientId="iot" roleLabel="物联网用户" collapsed={collapsed}
                switchUrl={`${window.location.protocol}//${window.location.hostname}:8102/`} switchLabel="切换身份（运营端）" />
            </div>
            <div className="iot-side-foot">
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
              <MobileNavigationButton onClick={() => setMobileOpen(true)} />
              <div>
                <span>物联网管理</span>
                <b>/</b>
                <strong>{TITLES[page]}</strong>
              </div>
              {subject.selector}
              <div className="iot-header-right">
                <span>{clock.date}</span>
                {subject.ready && !subject.busy && <MessageBadge onOpen={() => navigate("/messages")} />}
                <AccountMenu clientId="iot" />
              </div>
            </header>
            <main>
              {subject.ready ? <div style={{ position: "relative", minHeight: 200 }} aria-busy={subject.busy}>
                <div ref={node => { node?.toggleAttribute("inert", subject.busy) }} style={subject.busy ? { opacity: 0.35, pointerEvents: "none" } : undefined}>
                  <AppContent page={page} />
                </div>
                {subject.busy && <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(244,247,245,.7)" }}>{subject.fallback}</div>}
              </div> : subject.fallback}
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
      {/* 登录回调先恢复目标地址，再让路由读取首屏路径。 */}
      <BrowserRouter basename={import.meta.env.VITE_ROUTER_BASE || "/"}>
        <IotShell />
      </BrowserRouter>
    </UnifiedSsoGate>
  );
}
