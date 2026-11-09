import CommandReceipts from '../../shared-ui/CommandReceipts'
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertOutlined,
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  SlidersOutlined,
  TeamOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Avatar,
  Button,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  opsApi,
  STATUS,
  type AccessAudit,
  type AlertRule,
  type Alert,
  type Device,
  type Gateway,
  type OpsOverview,
  type OtaTask,
  type Product,
  type Protocol,
  type Tenant,
  type WorkOrder,
  type FirmwarePackage,
} from "./api";
import { downloadCsv, stampFilename } from "../../shared-ui/exportCsv";
import { useClock } from "../../shared-ui/clock";
import UnifiedSsoGate, {
  logoutUnified,
  useUnifiedUser,
} from "../../shared-ui/sso";

type Page =
  | "dashboard"
  | "tenants"
  | "firmwares"
  | "devices"
  | "gateways"
  | "alerts"
  | "rules"
  | "products"
  | "access"
  | "ota"
  | "workorders"
  | "reports"
  | "logs";
const PAGES: Page[] = [
  "dashboard",
  "tenants",
  "firmwares",
  "devices",
  "gateways",
  "alerts",
  "rules",
  "products",
  "access",
  "ota",
  "workorders",
  "reports",
  "logs",
];
const TITLES: Record<Page, string> = {
  dashboard: "运营概览大屏",
  tenants: "租户与配额",
  firmwares: "固件包管理",
  devices: "平台设备监控",
  gateways: "网关运维",
  alerts: "告警运营中心",
  rules: "阈值规则治理",
  products: "产品与协议管理",
  access: "设备接入审核",
  ota: "OTA 升级运营",
  workorders: "运维工单",
  reports: "统计分析",
  logs: "操作审计日志",
};
const MENU: Array<{
  group: string;
  items: Array<{ page: Page; label: string; icon: ReactNode }>;
}> = [
  {
    group: "运营监控",
    items: [
      { page: "dashboard", label: "运营概览大屏", icon: <DashboardOutlined /> },
      { page: "devices", label: "平台设备监控", icon: <CloudServerOutlined /> },
      { page: "gateways", label: "网关运维", icon: <ApiOutlined /> },
    ],
  },
  {
    group: "平台管理",
    items: [
      { page: "tenants", label: "租户与配额", icon: <TeamOutlined /> },
      { page: "products", label: "产品与协议", icon: <AppstoreOutlined /> },
      { page: "access", label: "设备接入审核", icon: <ShopOutlined /> },
    ],
  },
  {
    group: "运营处置",
    items: [
      { page: "alerts", label: "告警运营中心", icon: <AlertOutlined /> },
      { page: "rules", label: "阈值规则治理", icon: <SlidersOutlined /> },
      { page: "workorders", label: "运维工单", icon: <ToolOutlined /> },
      { page: "firmwares", label: "固件包管理", icon: <DatabaseOutlined /> },
      { page: "ota", label: "OTA 升级运营", icon: <ReloadOutlined /> },
    ],
  },
  {
    group: "数据与审计",
    items: [
      { page: "reports", label: "统计分析", icon: <BarChartOutlined /> },
      { page: "logs", label: "操作审计日志", icon: <DatabaseOutlined /> },
    ],
  },
];
const ROUTER_BASE = (import.meta.env.VITE_ROUTER_BASE || "/").replace(
  /\/$/,
  "",
);
function parse(): Page {
  const relative =
    ROUTER_BASE && location.pathname.startsWith(ROUTER_BASE)
      ? location.pathname.slice(ROUTER_BASE.length)
      : location.pathname;
  const p = relative.replace(/^\//, "").split("/")[0] as Page;
  return PAGES.includes(p) ? p : "dashboard";
}
function go(page: Page) {
  window.history.pushState({}, "", `${ROUTER_BASE}/${page}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function Status({ value }: { value: string }) {
  const s = STATUS[value] ?? { label: value, tone: "gray" };
  return <Tag className={`o-status tone-${s.tone}`}>{s.label}</Tag>;
}
function Title({
  title,
  desc,
  actions,
}: {
  title: string;
  desc: string;
  actions?: ReactNode;
}) {
  return (
    <div className="o-title">
      <div>
        <span>IOT PLATFORM · OPERATIONS</span>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {actions && <div className="o-actions">{actions}</div>}
    </div>
  );
}
function Loading() {
  return (
    <div className="o-loading">
      <i />
      <i />
      <i />
    </div>
  );
}
function useOverview() {
  const { message } = AntApp.useApp();
  const [data, setData] = useState<OpsOverview | null>(null);
  const load = () =>
    void opsApi
      .overview()
      .then(setData)
      .catch((e: Error) => message.error(e.message));
  useEffect(load, [message]);
  return { data, load };
}
function Dashboard() {
  const { data, load } = useOverview();
  if (!data) return <Loading />;
  const max = Math.max(...data.typeDistribution.map((t) => t.value), 1);
  return (
    <div className="o-page">
      <Title
        title="运营概览大屏"
        desc="全平台设备接入、在线状态、告警与数据吞吐的实时运营视角。"
        actions={
          <>
            <Button onClick={load}>刷新数据</Button>
            <Button type="primary" onClick={() => go("alerts")}>
              进入告警运营
            </Button>
          </>
        }
      />
      <div className="o-metrics">
        {[
          [
            "接入设备",
            data.metrics.devices,
            "cloud",
            `覆盖 ${data.metrics.tenants} 个租户`,
          ],
          [
            "实时在线",
            data.metrics.online,
            "online",
            `在线率 ${((data.metrics.online / data.metrics.devices) * 100).toFixed(1)}%`,
          ],
          [
            "待处理告警",
            data.metrics.openAlerts,
            "alert",
            `网关 ${data.metrics.gateways} 台`,
          ],
          ["数据吞吐", "52万条/分", "data", "今日控制 8,562 次"],
        ].map(([label, value, kind, hint]) => (
          <div className={`o-metric ${kind}`} key={String(label)}>
            <span>
              {kind === "cloud" ? (
                <CloudServerOutlined />
              ) : kind === "online" ? (
                <ApiOutlined />
              ) : kind === "alert" ? (
                <AlertOutlined />
              ) : (
                <DatabaseOutlined />
              )}
            </span>
            <div>
              <small>{label}</small>
              <b>{value}</b>
              <em>{hint}</em>
            </div>
          </div>
        ))}
      </div>
      <div className="o-dashboard-grid">
        <section className="o-card">
          <Head title="设备在线率趋势" sub="近 24 小时 · 秒级采样" />
          <div className="o-line-chart">
            {data.onlineTrend.map((v, i) => (
              <div key={i}>
                <i style={{ height: `${(v - 92) * 25 + 15}%` }} />
                <span>{9 + i * 2}:00</span>
                <b>{v}%</b>
              </div>
            ))}
          </div>
        </section>
        <section className="o-card">
          <Head title="设备类型分布" sub="全平台" />
          <div className="o-horizontal">
            {data.typeDistribution.map((t) => (
              <div key={t.name}>
                <span>{t.name}</span>
                <div>
                  <i style={{ width: `${(t.value / max) * 100}%` }} />
                </div>
                <b>{t.value}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="o-dashboard-grid">
        <section className="o-card">
          <Head title="实时告警流" sub="自动派单与状态跟踪" />
          {data.alerts.map((a) => (
            <div className="o-alert-row" key={a.id}>
              <span className={`level-${a.level}`}>
                <AlertOutlined />
              </span>
              <div>
                <b>{a.title}</b>
                <p>
                  {a.tenantName} · {a.deviceName} · {a.createdAt}
                </p>
              </div>
              <Status value={a.status} />
            </div>
          ))}
        </section>
        <section className="o-card">
          <Head title="租户设备排名" sub="按接入规模" />
          {data.tenants.map((t, i) => (
            <div className="o-rank" key={t.id}>
              <span>{i + 1}</span>
              <div>
                <b>{t.tenantName}</b>
                <small>
                  {t.region} · {t.planName}
                </small>
              </div>
              <em>{t.deviceCount}</em>
            </div>
          ))}
        </section>
      </div>
      <section className="o-ai-brief">
        <span>✦</span>
        <div>
          <small>AI 运维建议</small>
          <p>
            平台在线率 94.3%，离线设备集中在金穗粮食合作社；建议优先检查 NB-IoT
            信号与网关供电。另有 4 台新设备等待接入审核。
          </p>
        </div>
      </section>
    </div>
  );
}
function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="o-card-head">
      <div>
        <b>{title}</b>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function Tenants() {
  const { message } = AntApp.useApp();
  const [items, setItems] = useState<Tenant[]>([]),
    [target, setTarget] = useState<Tenant | null>(null),
    [limit, setLimit] = useState(500);
  const load = () =>
    void opsApi
      .tenants()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  useEffect(load, []);
  const save = async () => {
    if (!target) return;
    try {
      await opsApi.updateQuota(target.id, limit);
      setTarget(null);
      message.success("租户配额已更新");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "更新失败");
    }
  };
  const columns: ColumnsType<Tenant> = [
    {
      title: "租户",
      dataIndex: "tenantName",
      render: (_, r) => (
        <div className="o-entity">
          <b>{r.tenantName}</b>
          <small>
            {r.tenantCode} · {r.region}
          </small>
        </div>
      ),
    },
    { title: "套餐", dataIndex: "planName" },
    {
      title: "设备数",
      render: (_, r) => (
        <div className="usage">
          <Progress
            percent={Math.min(
              100,
              Math.round((r.deviceCount / r.deviceLimit) * 100),
            )}
            size="small"
            strokeColor="#159a5e"
            format={() => `${r.deviceCount}/${r.deviceLimit}`}
          />
        </div>
      ),
    },
    { title: "到期", dataIndex: "expireDate" },
    { title: "状态", dataIndex: "status", render: (v) => <Status value={v} /> },
    {
      title: "操作",
      render: (_, r) => (
        <Button
          type="link"
          onClick={() => {
            setTarget(r);
            setLimit(r.deviceLimit);
          }}
        >
          调整配额
        </Button>
      ),
    },
  ];
  return (
    <div className="o-page">
      <Title
        title="租户与配额"
        desc="物联网租户、设备容量、套餐到期和服务状态。"
      />
      <section className="o-card o-table">
        <Table rowKey="id" columns={columns} dataSource={items} />
      </section>
      <Modal
        title="调整租户配额"
        open={Boolean(target)}
        onCancel={() => setTarget(null)}
        onOk={() => void save()}
        okText="保存"
      >
        <div className="o-summary">
          <b>{target?.tenantName}</b>
          <span>当前设备数 {target?.deviceCount}</span>
        </div>
        <Form layout="vertical">
          <Form.Item label="设备上限">
            <InputNumber
              value={limit}
              min={target?.deviceCount || 1}
              onChange={(v) => setLimit(Number(v || 1))}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function Devices() {
  const { message } = AntApp.useApp();
  const [items, setItems] = useState<Device[]>([]),
    [status, setStatus] = useState("all"),
    [keyword, setKeyword] = useState("");
  const [commandDevice,setCommandDevice]=useState<Device|null>(null);
  const load = () =>
    void opsApi
      .devices({ keyword, status: status === "all" ? undefined : status })
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  useEffect(load, [status]);
  const columns: ColumnsType<Device> = [
    {
      title: "设备",
      dataIndex: "deviceName",
      render: (_, r) => (
        <div className="o-entity">
          <b>{r.deviceName}</b>
          <small>
            {r.deviceCode} · {r.typeName}
          </small>
        </div>
      ),
    },
    {
      title: "租户 / 农场",
      render: (_, r) => (
        <div className="o-entity">
          <b>{r.tenantName}</b>
          <small>{r.farmName}</small>
        </div>
      ),
    },
    { title: "协议", dataIndex: "protocol" },
    {
      title: "在线状态",
      dataIndex: "onlineStatus",
      render: (v) => <Status value={v} />,
    },
    { title: "信号", dataIndex: "rssi", render: (v) => (v ? `${v} dBm` : "—") },
    { title: "电量", dataIndex: "battery", render: (v) => `${v}%` },
    { title: "最近上报", dataIndex: "lastReport" },
    { title: "固件", dataIndex: "firmwareVersion" },
    { title: "操作", key:"commands",fixed:"right",width:120,render:(_,r)=><Button onClick={()=>setCommandDevice(r)}>指令回执</Button> },
  ];
  return (
    <div className="o-page">
      <Modal title="设备指令与回执" open={!!commandDevice} footer={null} width={1200} onCancel={()=>setCommandDevice(null)}>{commandDevice&&<CommandReceipts key={commandDevice.id} deviceId={commandDevice.id} load={opsApi.commandReceipts}/>}</Modal>
      <Title
        title="平台设备监控"
        desc="全平台设备在线状态、关键指标、租户归属与固件版本。"
      />
      <section className="o-card o-filter">
        <div className="o-tabs">
          {["all", "online", "offline", "alert"].map((s) => (
            <button
              type="button"
              key={s}
              className={status === s ? "on" : ""}
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "全部" : STATUS[s]?.label}
            </button>
          ))}
        </div>
        <Input
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={load}
          placeholder="设备名称 / 编码"
        />
        <Button type="primary" onClick={load}>
          查询
        </Button>
      </section>
      <section className="o-card o-table">
        <Table
          rowKey="id"
          dataSource={items}
          columns={columns}
          scroll={{ x: 1050 }}
        />
      </section>
    </div>
  );
}

function Gateways() {
  const [receiptGateway,setReceiptGateway]=useState<Gateway | null>(null);
  const { message, modal } = AntApp.useApp();
  const [items, setItems] = useState<Gateway[]>([]);
  const load = () =>
    void opsApi
      .gateways()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  useEffect(load, []);
  const restart = async (id: number) => {
    try {
      await opsApi.restartGateway(id);
      message.info("重启申请已登记，请查看回执；未确认网关执行");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "操作失败");
    }
  };
  return (
    <div className="o-page">
      <Modal title="网关重启与OTA升级回执" open={!!receiptGateway} footer={null} width={1200} onCancel={()=>setReceiptGateway(null)}>{receiptGateway&&<><h3>重启回执</h3><CommandReceipts key={'restart'+receiptGateway.id} deviceId={receiptGateway.id} load={opsApi.gatewayCommandReceipts}/><h3>OTA升级回执（动作列为目标版本）</h3><CommandReceipts key={'ota'+receiptGateway.id} deviceId={receiptGateway.id} load={opsApi.otaReceipts}/></>}</Modal>
      <Title
        title="网关运维"
        desc="网关在线率、挂载设备、资源占用与远程维护。"
      />
      <div className="o-gateway-grid">
        {items.map((g) => (
          <section className="o-card" key={g.id}>
            <div className="o-card-head">
              <div>
                <b>{g.gatewayName}</b>
                <small>
                  {g.gatewayCode} · {g.farmName}
                </small>
              </div>
              <Status value={g.onlineStatus} />
            </div>
            <div className="o-summary">
              <span>
                挂载设备 {g.onlineCount}/{g.totalCount}
              </span>
              <span>
                {g.protocol} · {g.firmwareVersion}
              </span>
              <span>最近在线 {g.lastOnline}</span>
            </div>
            <span className="o-label">CPU {g.cpuRate}%</span>
            <Progress
              percent={Number(g.cpuRate)}
              showInfo={false}
              strokeColor="#159a5e"
            />
            <span className="o-label">内存 {g.memoryRate}%</span>
            <Progress
              percent={Number(g.memoryRate)}
              showInfo={false}
              strokeColor="#176c93"
            />
            <footer>
              <span>{g.model}</span>
              <Button size="small" onClick={()=>setReceiptGateway(g)}>重启/升级回执</Button>
              <Button size="small" onClick={() => modal.confirm({title:"申请重启网关",content:"重启可能中断挂载设备通信。申请不代表执行成功，请按指令回执核验。",onOk:()=>restart(g.id)})}>
                远程重启
              </Button>
            </footer>
          </section>
        ))}
      </div>
    </div>
  );
}

function Alerts() {
  const { message } = AntApp.useApp();
  const [items, setItems] = useState<Alert[]>([]),
    [target, setTarget] = useState<Alert | null>(null),
    [note, setNote] = useState("");
  const load = () =>
    void opsApi
      .alerts()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  useEffect(load, []);
  const handle = async () => {
    if (!target) return;
    // 处置说明会进审计，不能用一句代码里写死的话替运营"编造"处置结论
    if (note.trim().length < 4) {
      message.error("请填写不少于 4 个字的处置说明");
      return;
    }
    try {
      await opsApi.handleAlert(target.id, note.trim(), target.status === "pending" ? "handling" : "resolved");
      setTarget(null);
      setNote("");
      message.success("告警已处置");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "操作失败");
    }
  };
  return (
    <div className="o-page">
      <Title
        title="告警运营中心"
        desc="全平台设备告警统一台账；待处理→处理中→已处理，双端共用处置记录。"
      />
      <div className="o-alert-grid">
        {items.map((a) => (
          <section
            className={`o-card o-alert-card level-${a.level}`}
            key={a.id}
          >
            <div className="o-card-head">
              <div>
                <Status value={a.level} />
                <b>{a.title}</b>
                <small>
                  {a.alertNo} · {a.tenantName}
                </small>
              </div>
              <Status value={a.status} />
            </div>
            <p>{a.content}</p>
            <div className="o-summary">
              <span>设备：{a.deviceName}</span>
              <span>时间：{a.createdAt}</span>
              {a.handleNote && <span>处置：{a.handleNote}</span>}
            </div>
            <footer>
              <Button size="small" onClick={() => go("workorders")}>
                创建工单
              </Button>
              {a.status !== "resolved" && (
                <Button
                  size="small"
                  type="primary"
                  onClick={() => { setTarget(a); setNote(""); }}
                >
                  登记处置
                </Button>
              )}
            </footer>
          </section>
        ))}
      </div>
      <Modal
        title="告警处置"
        open={Boolean(target)}
        onCancel={() => setTarget(null)}
        onOk={() => void handle()}
        okText="确认处置"
      >
        <div className="o-summary">
          <b>{target?.title}</b>
          <span>{target?.content}</span>
        </div>
        <Input.TextArea
          rows={4}
          placeholder="填写处置动作与结论（会写入审计日志）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}

/**
 * 阈值规则治理。
 *
 * 平台预置是兜底默认值，`enabled` 影响全平台，所以只有运营能启停，而且每次都会以令牌账号写审计；
 * 经营主体自己的阈值规则列在下面，用于回答"为什么这家报警、那家不报"。
 */
function AlertRules() {
  const { message } = AntApp.useApp();
  const [platform, setPlatform] = useState<AlertRule[]>([]),
    [tenant, setTenant] = useState<AlertRule[]>([]);
  const load = () =>
    void Promise.all([opsApi.alertRules(), opsApi.tenantAlertRules()])
      .then(([preset, own]) => {
        setPlatform(preset);
        setTenant(own);
      })
      .catch((e: Error) => message.error(e.message));
  useEffect(load, []);
  const toggle = async (rule: AlertRule) => {
    try {
      await opsApi.toggleAlertRule(rule.id);
      message.success("平台阈值规则状态已更新");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "操作失败");
    }
  };
  return (
    <div className="o-page">
      <Title
        title="阈值规则治理"
        desc="平台预置阈值是全平台兜底；经营主体可在同一指标上自定义并覆盖它。"
      />
      <section className="o-card o-table">
        <Head title="平台预置阈值" sub="启停影响全平台，操作按登录账号写入审计" />
        <Table
          rowKey="id"
          dataSource={platform}
          columns={[
            { title: "规则", dataIndex: "ruleName" },
            {
              title: "条件",
              render: (_, r) => `${r.metricName} ${r.operator} ${Number(r.threshold)}`,
            },
            {
              title: "持续",
              dataIndex: "durationSeconds",
              render: (v) => `${v} 秒`,
            },
            {
              title: "等级",
              dataIndex: "level",
              render: (v) => <Status value={v} />,
            },
            {
              title: "状态",
              dataIndex: "enabled",
              render: (v) => <Status value={v ? "running" : "disabled"} />,
            },
            {
              title: "操作",
              render: (_, r) => (
                <Button size="small" onClick={() => void toggle(r)}>
                  {r.enabled ? "停用" : "启用"}
                </Button>
              ),
            },
          ]}
        />
      </section>
      <section className="o-card o-table" style={{ marginTop: 14 }}>
        <Head title="各经营主体自定义阈值" sub="只读：主体在自己的用户端维护，同指标覆盖平台预置" />
        <Table
          rowKey={(row) => `${row.tenantId}-${row.id}`}
          dataSource={tenant}
          columns={[
            {
              title: "经营主体",
              dataIndex: "tenantName",
              render: (v) => v || "未归属",
            },
            { title: "规则", dataIndex: "ruleName" },
            {
              title: "条件",
              render: (_, r) =>
                `${r.metricName} ${r.operator} ${Number(r.threshold)}${r.deviceType ? ` · ${r.deviceType}` : ""}`,
            },
            {
              title: "持续",
              dataIndex: "durationSeconds",
              render: (v) => (v > 0 ? `${v} 秒` : "瞬时"),
            },
            {
              title: "等级",
              dataIndex: "level",
              render: (v) => <Status value={v} />,
            },
            {
              title: "状态",
              dataIndex: "enabled",
              render: (v) => <Status value={v ? "running" : "disabled"} />,
            },
            { title: "创建人", dataIndex: "createdBy", render: (v) => v || "—" },
            { title: "更新", dataIndex: "updatedAt" },
          ]}
        />
      </section>
    </div>
  );
}

function Products() {
  const { message } = AntApp.useApp();
  const [products, setProducts] = useState<Product[]>([]),
    [protocols, setProtocols] = useState<Protocol[]>([]);
  useEffect(() => {
    void Promise.all([opsApi.products(), opsApi.protocols()])
      .then(([p, x]) => {
        setProducts(p);
        setProtocols(x);
      })
      .catch((e: Error) => message.error(e.message));
  }, [message]);
  return (
    <div className="o-page">
      <Title
        title="产品与协议管理"
        desc="物联网产品、物模型、接入协议和连接状态。"
      />
      <div className="o-dashboard-grid">
        <section className="o-card o-table">
          <Head title="产品与物模型" sub="认证产品清单" />
          <Table
            rowKey="id"
            pagination={false}
            dataSource={products}
            columns={[
              {
                title: "产品",
                dataIndex: "productName",
                render: (_, r) => (
                  <div className="o-entity">
                    <b>{r.productName}</b>
                    <small>
                      {r.productKey} · {r.model}
                    </small>
                  </div>
                ),
              },
              { title: "品类", dataIndex: "category" },
              { title: "协议", dataIndex: "protocol" },
              { title: "属性", dataIndex: "propertyCount" },
              { title: "设备", dataIndex: "deviceCount" },
              {
                title: "状态",
                dataIndex: "status",
                render: (v) => <Status value={v} />,
              },
            ]}
          />
        </section>
        <section className="o-card">
          <Head title="协议适配器" sub="连接与端点" />
          {protocols.map((p) => (
            <div className="o-protocol" key={p.id}>
              <span>
                <ApiOutlined />
              </span>
              <div>
                <b>{p.protocolName}</b>
                <small>
                  {p.endpoint}:{p.port}
                </small>
              </div>
              <em>{p.connections} 连接</em>
              <Status value={p.status} />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function Access() {
  const { message } = AntApp.useApp();
  const [items, setItems] = useState<AccessAudit[]>([]);
  const [target, setTarget] = useState<{ row: AccessAudit; status: string } | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const load = () =>
    void opsApi
      .accessAudits()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  useEffect(load, []);
  /**
   * 审核意见必须当场填写。
   *
   * 以前点"通过接入"就直接把代码里写死的一句话（"物模型与认证白名单校验通过"）当成审核意见
   * 存库——相当于平台替审核人编造了结论，出问题时审计里查不到 anyone 真的看过什么。
   */
  const submitReview = async () => {
    if (!target) return;
    if (note.trim().length < 4) {
      message.error('请填写不少于 4 个字的审核意见');
      return;
    }
    setSaving(true);
    try {
      await opsApi.reviewAccess(target.row.id, target.status, note.trim());
      message.success('接入审核已更新');
      setTarget(null);
      setNote('');
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="o-page">
      <Title
        title="设备接入审核"
        desc="自动注册与人工接入审核、物模型校验和风险拦截。"
      />
      <div className="o-access-grid">
        {items.map((a) => (
          <section className="o-card" key={a.id}>
            <div className="o-card-head">
              <div>
                <b>{a.deviceName}</b>
                <small>
                  {a.deviceCode} · {a.requestType}
                </small>
              </div>
              <Status value={a.status} />
            </div>
            <p>
              {a.tenantName} · {a.submittedAt}
            </p>
            <div className="o-summary">
              <span>审核人：{a.auditor || "待分配"}</span>
              <span>{a.note || "等待物模型与产品认证校验"}</span>
            </div>
            {a.status === "pending" && (
              <footer>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    setTarget({ row: a, status: "rejected" });
                    setNote("");
                  }}
                >
                  驳回
                </Button>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    setTarget({ row: a, status: "approved" });
                    setNote("");
                  }}
                >
                  通过接入
                </Button>
              </footer>
            )}
          </section>
        ))}
      </div>
      <Modal
        title={target?.status === "approved" ? "通过接入" : "驳回接入"}
        open={Boolean(target)}
        confirmLoading={saving}
        onCancel={() => setTarget(null)}
        onOk={() => void submitReview()}
        okText="提交审核"
      >
        <div className="o-summary">
          <b>{target?.row.deviceName}</b>
          <span>
            {target?.row.tenantName} · {target?.row.requestType}
          </span>
        </div>
        <Input.TextArea
          rows={3}
          value={note}
          placeholder="填写物模型/认证白名单的核验结论（会写入审计）"
          onChange={(e) => setNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}


function Firmwares() {
  const { message } = AntApp.useApp();
  const [items, setItems] = useState<FirmwarePackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading,setUploading]=useState(false);
  const [uploaded,setUploaded]=useState(false);
  const [expectedHash,setExpectedHash]=useState('');
  const uploadFile=async(file:File)=>{
    if(file.size===0 || file.size>268435456){message.error('请选择大于0且不超过256MB的固件文件');return}
    setUploading(true);
    try{const result=await opsApi.uploadFirmwarePackage(file,expectedHash.trim());form.setFieldsValue(result);setUploaded(true);message.success('上传完成，服务端已计算并核验SHA-256及大小')}
    catch(e){message.error(e instanceof Error?e.message:'上传失败')}
    finally{setUploading(false)}
  };
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    opsApi
      .listFirmwarePackages({
        type: type || undefined,
        status: status || undefined,
        model: model.trim() || undefined,
      })
      .then(setItems)
      .catch((e: Error) => message.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [type, status, model]);

  const handleRegister = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const result=await opsApi.registerFirmwarePackage(values);
      const saved=await opsApi.getFirmwarePackage(result.id);
      if(saved.versionName!==values.versionName.trim()||saved.packageUrl!==values.packageUrl.trim()||saved.sha256Text!==values.sha256Text.trim().toLowerCase())throw new Error('服务端保存回读不一致，请刷新核对，勿重复登记');
      message.success('固件草稿包登记成功');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: number) => {
    try {
      await opsApi.publishFirmwarePackage(id);
      if((await opsApi.getFirmwarePackage(id)).status!=='stable')throw new Error('发布状态回读未确认');
      message.success('固件包已发布为稳定版');
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发布失败');
    }
  };

  const [deprecating,setDeprecating]=useState<number|null>(null);
  const [reason,setReason]=useState('');
  const handleDeprecate = async (id: number) => {
    try {
      await opsApi.deprecateFirmwarePackage(id, reason);
      if((await opsApi.getFirmwarePackage(id)).status!=='deprecated')throw new Error('废弃状态回读未确认');
      setDeprecating(null);setReason('');
      message.success('固件包已废弃');
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const columns: ColumnsType<FirmwarePackage> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '固件名称与版本',
      key: 'name',
      render: (_, r) => (
        <div>
          <b>{r.firmwareName}</b>
          <div style={{ fontSize: 12, color: '#666' }}>
            {r.versionName} · {r.firmwareType} · 型号: {r.targetModel}
          </div>
        </div>
      ),
    },
    {
      title: '包大小',
      dataIndex: 'fileSizeBytes',
      width: 110,
      render: (v) => (v ? `${(v / 1024 / 1024).toFixed(2)} MB` : '-'),
    },
    {
      title: 'SHA-256 完整摘要',
      dataIndex: 'sha256Text',
      width: 220,
      render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s) => (
        <Tag color={s === 'stable' ? 'success' : s === 'draft' ? 'warning' : 'default'}>
          {s === 'stable' ? '已发布稳定版' : s === 'draft' ? '草稿' : '已废弃'}
        </Tag>
      ),
    },
    {
      title: '更新说明',
      dataIndex: 'releaseNotes',
      ellipsis: true,
    },
    {
      title: '登记时间',
      dataIndex: 'createdAt',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" onClick={()=>Modal.info({title:'固件包详情',width:700,content:<div style={{wordBreak:'break-all'}}><p>{r.firmwareName} · {r.versionName}</p><p>适用型号：{r.targetModel}</p><p>包地址：{r.packageUrl||'历史未登记'}</p><p>SHA-256：{r.sha256Text}</p><p>发布：{r.publishedAt||'—'}；废弃：{r.deprecatedAt||'—'}</p><p>发布说明：{r.releaseNotes||'—'}</p><p>变更说明：{r.changelogText||'—'}</p></div>})}>详情</Button>
          {r.status === 'draft' && (
            <Button size="small" type="primary" onClick={() => Modal.confirm({title:'发布稳定版后包资料不可更改',content:'请确认已核验固件来源、型号和摘要。托管文件将重新核验摘要与大小；外部地址仅校验登记资料。均不代替真机兼容验收。',onOk:()=>handlePublish(r.id)})}>
              发布稳定版
            </Button>
          )}
          {r.status === 'stable' && (
            <Button size="small" danger onClick={() => {setReason('');setDeprecating(r.id)}}>
              下线废弃
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="o-page">
      <Title
        title="固件包版本台账"
        desc="设备与边缘网关的固件包、适用型号、完整SHA-256防篡改摘要及发布状态。"
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Select
            placeholder="固件类型"
            style={{ width: 130 }}
            allowClear
            value={type || undefined}
            onChange={(v) => setType(v || '')}
            options={[
              { value: 'gateway', label: '边缘网关' },
              { value: 'sensor', label: '传感器' },
              { value: 'controller', label: '控制器' },
            ]}
          />
          <Select
            placeholder="状态"
            style={{ width: 130 }}
            allowClear
            value={status || undefined}
            onChange={(v) => setStatus(v || '')}
            options={[
              { value: 'draft', label: '草稿' },
              { value: 'stable', label: '已发布稳定版' },
              { value: 'deprecated', label: '已废弃' },
            ]}
          />
          <Input
            placeholder="适用型号搜索"
            style={{ width: 160 }}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </div>
        <Button type="primary" onClick={() => {setUploaded(false);setExpectedHash('');form.resetFields();setModalOpen(true)}}>登记新固件包</Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        scroll={{x:1300}}
        pagination={{ defaultPageSize: 10,showSizeChanger:true }}
      />

      <Modal title="废弃固件包" open={deprecating!==null} onCancel={()=>setDeprecating(null)} onOk={()=>{if(deprecating!==null)return handleDeprecate(deprecating)}} okButtonProps={{disabled:reason.trim().length<4}}>
        <Input.TextArea value={reason} maxLength={300} onChange={e=>setReason(e.target.value)} placeholder="填写实际下线原因，至少4个字"/>
      </Modal>
      <Modal
        title="登记新固件包"
        open={modalOpen}
        confirmLoading={saving || uploading}
        onCancel={() => { if (!saving && !uploading) setModalOpen(false); }}
        onOk={()=>{if(!uploading)return handleRegister()}}
        okButtonProps={{disabled:uploading}}
        okText="保存草稿包"
      >
        <Form form={form} layout="vertical" initialValues={{ firmwareType: 'gateway', targetModel: 'ALL' }}>
          <Form.Item name="firmwareName" label="固件包名称" rules={[{ required: true, message: '请输入固件包名称' }]}>
            <Input placeholder="如：EdgeGateway 稳定升级包" />
          </Form.Item>
          <Form.Item name="versionName" label="版本号（规范语义版本）" rules={[{ required: true, message: '请输入符合语义规则的版本号，如 v1.2.0' }]}>
            <Input placeholder="v1.2.0" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="firmwareType" label="类型" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select options={[{ value: 'gateway', label: '边缘网关' }, { value: 'sensor', label: '传感器' }, { value: 'controller', label: '控制器' }]} />
            </Form.Item>
            <Form.Item name="targetModel" label="适用型号" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Input placeholder="ALL 或 GW-PRO-2026" />
            </Form.Item>
          </div>
          <div style={{marginBottom:16}}>
            <p>上传固件文件后由服务端计算摘要与大小；不解压、不执行。仅支持bin/img/zip/fw/hex/tar/gz，最大256MB。上传校验不代替厂家签名和型号兼容认证。</p>
            <Input value={expectedHash} disabled={uploading || uploaded} maxLength={64} onChange={e=>setExpectedHash(e.target.value)} placeholder="可选：厂家提供的预期SHA-256，填写后必须匹配"/>
            <input type="file" accept=".bin,.img,.zip,.fw,.hex,.tar,.gz" disabled={uploading || saving} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadFile(file);e.target.value=''}}/>
            {uploading?<p>正在上传并校验，请勿关闭…</p>:null}
            {uploaded?<p>已按实际文件核验；地址、摘要、大小已锁定。重新上传可替换，外部地址请重新打开登记窗口。</p>:<p>也可登记外部HTTPS地址，但本服务未核验其实际文件。</p>}
          </div>
          <Form.Item name="packageUrl" label="HTTPS 固件包下载链接" rules={[{ required: true, message: '请输入无鉴权片段的HTTPS固件地址' }]}>
            <Input disabled={uploaded || uploading} placeholder="已部署的 HTTPS 固件文件地址" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="fileSizeBytes" label="包大小（字节）" style={{ flex: 1 }} rules={[{ required: true, message: '请输入文件大小' }]}>
              <InputNumber disabled={uploaded || uploading} style={{ width: '100%' }} min={1} max={2147483648} placeholder="如 15728640" />
            </Form.Item>
          </div>
          <Form.Item name="sha256Text" label="64位 SHA-256 防篡改摘要" rules={[{ required: true, message: '请输入64位HEX摘要' }]}>
            <Input disabled={uploaded || uploading} placeholder="完整的64位sha256十六进制字符串" />
          </Form.Item>
          <Form.Item name="releaseNotes" label="发布说明">
            <Input.TextArea rows={2} placeholder="固件版本核心特性或更新概要" />
          </Form.Item>
          <Form.Item name="changelogText" label="Changelog 详细变更">
            <Input.TextArea rows={2} placeholder="修复问题清单及硬件兼容清单" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function Ota() {
  const { message } = AntApp.useApp();
  const [items, setItems] = useState<OtaTask[]>([]);
  const [target,setTarget]=useState<OtaTask|null>(null);
  const [gateways,setGateways]=useState<Gateway[]>([]);
  const [ids,setIds]=useState<number[]>([]);
  const [url,setUrl]=useState('');
  const [firmware,setFirmware]=useState<FirmwarePackage|null>(null);
  const [saving,setSaving]=useState(false);
  const load = () =>
    void opsApi
      .ota()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  useEffect(()=>{load();const timer=setInterval(load,10000);return()=>clearInterval(timer)}, []);
  const execute = async (id: number) => {
    if(saving)return;setSaving(true);
    try {
      await opsApi.executeOta(id,ids,url);
      setTarget(null);
      message.success("升级申请已保存，等待网关领取与真实执行回执");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "执行失败");
    } finally {setSaving(false)}
  };
  return (
    <div className="o-page">
      <Title
        title="OTA 升级运营"
        desc="固件版本、灰度范围、执行窗口与升级结果。"
      />
      <Modal title="确认OTA目标与固件" open={!!target} confirmLoading={saving} onCancel={()=>{if(!saving)setTarget(null)}} onOk={()=>{if(target)void execute(target.id)}} okButtonProps={{disabled:!ids.length||!url.trim()}}>
        <p>仅选择与任务主体一致的网关；固件必须为稳定版且具有完整SHA-256。执行窗口仅作参考，本次确认后即可领取，有效期30分钟。接入端须验证固件签名、型号兼容及摘要，按指令编号幂等执行。</p>
        <Select mode="multiple" style={{width:'100%'}} placeholder="选择目标网关" value={ids} onChange={setIds} options={gateways.map(g=>({value:g.id,label:`${g.gatewayName} · ${g.id}`}))}/>
        <p style={{wordBreak:'break-all'}}>固件：{firmware?.firmwareName} · {firmware?.versionName}<br/>型号：{firmware?.targetModel}<br/>SHA-256：{firmware?.sha256Text}<br/>下载地址：{url || '尚未读取到完整固件包资料，禁止启动'}</p>
      </Modal>
      <p>成功数仅来自版本及摘要一致的网关回执；超时为结果未知。逐网关明细请在网关运维的回执入口查询。</p>
      <div className="o-ota-list">
        {items.map((t) => (
          <section className="o-card" key={t.id}>
            <div className="o-card-head">
              <div>
                <b>{t.taskNo}</b>
                <small>
                  {t.firmwareVersion} · {t.targetScope}
                </small>
              </div>
              <Status value={t.status} />
            </div>
            <div className="o-summary">
              <span>目标 {t.targetCount} 台</span>
              <span>窗口 {t.executeWindow}</span>
              <span>创建 {t.createdAt}</span>
            </div>
            <Progress
              percent={t.targetCount?Math.round((t.successCount / t.targetCount) * 100):0}
              strokeColor="#159a5e"
            />
            <footer>
              <span>
                成功 {t.successCount} · 失败 {t.failedCount}
              </span>
              {t.status === "scheduled" && (
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {setTarget(t);setIds([]);setUrl('');setFirmware(null);setGateways([]);void Promise.all([opsApi.gateways(),opsApi.getFirmwarePackage(t.firmwareId)]).then(([gs,fw])=>{if(fw.status!=='stable'||!fw.packageUrl||!fw.fileSizeBytes)throw new Error('该任务关联固件缺少完整包资料或未发布');setFirmware(fw);setUrl(fw.packageUrl);setGateways(gs.filter(g=>fw.firmwareType==='gateway'&&(fw.targetModel==='ALL'||fw.targetModel===g.model)))}).catch((e:Error)=>message.error(e.message))}}
                >
                  开始升级
                </Button>
              )}
            </footer>
          </section>
        ))}
      </div>
    </div>
  );
}

function WorkOrders() {
  const { message } = AntApp.useApp();
  const [target,setTarget] = useState<WorkOrder | null>(null);
  const [note,setNote] = useState("");
  const [saving,setSaving] = useState(false);
  const [items, setItems] = useState<WorkOrder[]>([]);
  useEffect(() => {
    void opsApi
      .workOrders()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  }, [message]);
  return (
    <div className="o-page">
      <Title title="运维工单" desc="用户报修与运营处理共用台账：待受理→处理中→已完成，保留实际处理结果。" />
      <section className="o-card o-table">
        <Table
          rowKey="id"
          dataSource={items}
          columns={[
            { title: "工单", dataIndex: "orderNo" },
            {
              title: "所属主体",
              dataIndex: "tenantName",
              render: (v) => v || "未归属",
            },
            { title: "设备", dataIndex: "deviceName" },
            { title: "来源", dataIndex: "source" },
            { title: "类型", dataIndex: "type" },
            {
              title: "报修描述",
              dataIndex: "description",
              ellipsis: true,
              render: (v) => v || "—",
            },
            {
              title: "优先级",
              dataIndex: "priority",
              render: (v) => <Status value={v} />,
            },
            { title: "处理人", dataIndex: "technician" },
            {
              title: "状态",
              dataIndex: "status",
              render: (v) => <Status value={v} />,
            },
            { title: "创建", dataIndex: "createdAt" },
            { title: "操作", key: "action", fixed: "right", width: 140, render: (_, row) =>
              <Button disabled={!["pending", "processing"].includes(row.status)} onClick={() => {setTarget(row);setNote("");}}>
                {row.status === "pending" ? "受理工单" : "登记完成"}</Button> },
          ]}
        />
      </section>
      <Modal title={target?.status === "pending" ? "受理运维工单" : "登记实际维修完成结果"} open={Boolean(target)} confirmLoading={saving}
        onCancel={() => {if(!saving)setTarget(null);}} onOk={async () => {
          if(!target)return;
          if(note.trim().length<4){message.error("请填写不少于4字的实际说明");return;}
          setSaving(true);
          try {await opsApi.handleWorkOrder(target.id,target.status==="pending"?"processing":"completed",note.trim());
            const rows=await opsApi.workOrders();setItems(rows);setTarget(null);message.success("工单状态已保存并回读");
          }catch(e){message.error(e instanceof Error?e.message:"保存失败");}finally{setSaving(false);}
        }}><Input.TextArea rows={4} maxLength={200} showCount value={note} onChange={e=>setNote(e.target.value)} placeholder="实际处理进展或完成结果；不会自动改变设备心跳" /></Modal>
    </div>
  );
}

function Reports() {
  const { message } = AntApp.useApp();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof opsApi.reports>
  > | null>(null);
  useEffect(() => {
    void opsApi
      .reports()
      .then(setData)
      .catch((e: Error) => message.error(e.message));
  }, [message]);
  if (!data) return <Loading />;
  const exportReport = () => {
    // 导的是这一页真正查出来的数据：以前点一下只弹一句"已导出"，没有任何文件
    const count = downloadCsv(
      stampFilename("物联网运营统计"),
      [
        { key: "item", title: "统计项" },
        { key: "value", title: "数值" },
      ],
      [
        { item: "接入租户数", value: data.summary.tenants },
        { item: "在册设备数", value: data.summary.devices },
        { item: "在线设备数", value: data.summary.online },
        { item: "累计告警", value: data.summary.alerts },
        { item: "待处置告警", value: data.summary.openAlerts },
        { item: "运维工单", value: data.summary.workOrders },
        { item: "未完成工单", value: data.summary.openWorkOrders },
        { item: "控制指令", value: data.summary.controls },
        { item: "遥测读数", value: data.summary.dataPoints },
      ],
    );
    message.success(`已导出 ${count} 项统计`);
  };
  return (
    <div className="o-page">
      <Title
        title="统计分析"
        desc="租户接入、协议分布、网关运行与告警统计。"
        actions={<Button onClick={exportReport}>导出报表</Button>}
      />
      <div className="o-card" style={{ marginBottom: 14 }}>
        <div className="o-stat-row">
          <span>
            <small>在册设备</small>
            <b>{data.summary.devices}</b>
          </span>
          <span>
            <small>在线设备</small>
            <b>{data.summary.online}</b>
          </span>
          <span>
            <small>待处置告警</small>
            <b>{data.summary.openAlerts}</b>
          </span>
          <span>
            <small>未完成工单</small>
            <b>{data.summary.openWorkOrders}</b>
          </span>
          <span>
            <small>遥测读数</small>
            <b>{data.summary.dataPoints}</b>
          </span>
          <span>
            <small>控制指令</small>
            <b>{data.summary.controls}</b>
          </span>
        </div>
      </div>
      <div className="o-dashboard-grid">
        <section className="o-card">
          <Head title="租户接入排行" sub="设备规模" />
          {data.tenantRank.map((t, i) => (
            <div className="o-rank" key={t.id}>
              <span>{i + 1}</span>
              <div>
                <b>{t.tenantName}</b>
                <small>
                  {t.planName} · {t.region}
                </small>
              </div>
              <em>{t.deviceCount}</em>
            </div>
          ))}
        </section>
        <section className="o-card">
          <Head title="协议连接量" sub="实时连接" />
          {data.protocols.map((p) => (
            <div className="o-protocol" key={p.id}>
              <span>
                <ApiOutlined />
              </span>
              <div>
                <b>{p.protocolName}</b>
                <small>{p.protocolType}</small>
              </div>
              <em>{p.connections}</em>
              <Status value={p.status} />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function Logs() {
  const { message } = AntApp.useApp();
  const [items, setItems] = useState<
    Array<{
      id: number;
      operator: string;
      action: string;
      target: string;
      detail: string;
      ip?: string | null;
      createdAt: string;
    }>
  >([]);
  useEffect(() => {
    void opsApi
      .logs()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  }, [message]);
  return (
    <div className="o-page">
      <Title
        title="操作审计日志"
        desc="设备接入、告警处置、租户配额和 OTA 等敏感操作留痕；操作人取自登录令牌，来源 IP 由网关透传。"
      />
      <section className="o-card o-table">
        <Table
          rowKey="id"
          dataSource={items}
          columns={[
            { title: "时间", dataIndex: "createdAt" },
            { title: "操作人", dataIndex: "operator" },
            {
              title: "动作",
              dataIndex: "action",
              render: (v) => <Tag>{v}</Tag>,
            },
            { title: "对象", dataIndex: "target" },
            { title: "详情", dataIndex: "detail", ellipsis: true },
            {
              title: "来源 IP",
              dataIndex: "ip",
              render: (v) => v || "—",
            },
          ]}
        />
      </section>
    </div>
  );
}

function Content({ page }: { page: Page }) {
  switch (page) {
    case "tenants":
      return <Tenants />;
    case "firmwares":
      return <Firmwares />;
    case "devices":
      return <Devices />;
    case "gateways":
      return <Gateways />;
    case "alerts":
      return <Alerts />;
    case "rules":
      return <AlertRules />;
    case "products":
      return <Products />;
    case "access":
      return <Access />;
    case "ota":
      return <Ota />;
    case "workorders":
      return <WorkOrders />;
    case "reports":
      return <Reports />;
    case "logs":
      return <Logs />;
    default:
      return <Dashboard />;
  }
}
const OPS_PERMISSIONS = ["iot:admin"];

/**
 * 顶栏的待审接入数。
 *
 * 以前这里是一个写死的 <i>9</i>：不管有没有待审接入都亮 9，点也不响。
 * 现在取真实的待审条数，点进去就是设备接入审核页；没有待审时不显示角标。
 */
function PendingAuditBadge({ onOpen }: { onOpen: () => void }) {
  const [pending, setPending] = useState(0);
  useEffect(() => {
    void opsApi
      .accessAudits()
      .then((rows) => setPending(rows.filter((row) => row.status === "pending").length))
      .catch(() => setPending(0));
  }, []);
  return (
    <button type="button" onClick={onOpen} title="设备接入待审核">
      <BellOutlined />
      {pending > 0 ? <i>{pending}</i> : null}
    </button>
  );
}

function OpsShell() {
  const [page, setPage] = useState<Page>(parse),
    [collapsed, setCollapsed] = useState(false);
  const clock = useClock();
  const { user } = useUnifiedUser();
  useEffect(() => {
    const h = () => setPage(parse());
    addEventListener("popstate", h);
    return () => removeEventListener("popstate", h);
  }, []);
  return (
    <div className={`o-shell${collapsed ? " collapsed" : ""}`}>
      <aside className="o-sidebar">
        <button
          type="button"
          className="o-brand"
          onClick={() => go("dashboard")}
        >
          <img className="o-brand-logo" src={`${import.meta.env.BASE_URL}fengchain.svg`} alt="丰链云" />
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
                  onClick={() => go(i.page)}
                >
                  {i.icon}
                  {!collapsed && <span>{i.label}</span>}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className="o-side-foot">
          {!collapsed && (
            <div>
              <b>平台运行正常</b>
              <small>在线率 94.3%</small>
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
      <div className="o-main">
        <header className="o-header">
          <div>
            <span>物联网运营</span>
            <b>/</b>
            <strong>{TITLES[page]}</strong>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go("devices");
            }}
          >
            <SearchOutlined />
            <input placeholder="搜索设备 / 租户 / 告警" />
          </form>
          <div className="o-header-right">
            <span>{clock.date}</span>
            <PendingAuditBadge onOpen={() => go("access")} />
            <Dropdown
              menu={{
                items: [
                  { key: "logs", label: "操作审计", onClick: () => go("logs") },
                  {
                    key: "logout",
                    label: "退出统一登录",
                    onClick: () => void logoutUnified("iot-admin"),
                  },
                ],
              }}
            >
              <button type="button" className="o-user">
                <Avatar size={30} className="o-avatar">
                  {(user.nickname || user.username).slice(0, 1)}
                </Avatar>
                <span>
                  <b>{user.nickname || user.username}</b>
                  <small>
                    {user.roles?.join(" / ") || "统一平台账号"}
                  </small>
                </span>
              </button>
            </Dropdown>
          </div>
        </header>
        <main>
          <Content page={page} />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <UnifiedSsoGate
      clientId="iot-admin"
      landingPath="/dashboard"
      requiredPermissions={OPS_PERMISSIONS}
    >
      <OpsShell />
    </UnifiedSsoGate>
  );
}
