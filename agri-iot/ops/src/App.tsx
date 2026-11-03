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
  ];
  return (
    <div className="o-page">
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
  const { message } = AntApp.useApp();
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
      message.success("远程重启指令已下发");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "操作失败");
    }
  };
  return (
    <div className="o-page">
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
              <Button size="small" onClick={() => void restart(g.id)}>
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
      await opsApi.handleAlert(target.id, note.trim());
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
        desc="全平台告警分派、响应时限、误报标记与运维闭环。"
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
                  onClick={() => setTarget(a)}
                >
                  立即处置
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

function Ota() {
  const { message } = AntApp.useApp();
  const [items, setItems] = useState<OtaTask[]>([]);
  const load = () =>
    void opsApi
      .ota()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  useEffect(load, []);
  const execute = async (id: number) => {
    try {
      await opsApi.executeOta(id);
      message.success("OTA 任务已排入执行窗口，进度待网关回执后回写");
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "执行失败");
    }
  };
  return (
    <div className="o-page">
      <Title
        title="OTA 升级运营"
        desc="固件版本、灰度范围、执行窗口与升级结果。"
      />
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
              percent={Math.round((t.successCount / t.targetCount) * 100)}
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
                  onClick={() => void execute(t.id)}
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
  const [items, setItems] = useState<WorkOrder[]>([]);
  useEffect(() => {
    void opsApi
      .workOrders()
      .then(setItems)
      .catch((e: Error) => message.error(e.message));
  }, [message]);
  return (
    <div className="o-page">
      <Title title="运维工单" desc="故障工单、预防性维保、派单与 SLA 跟踪。" />
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
          ]}
        />
      </section>
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
          <span>丰</span>
          {!collapsed && (
            <div>
              <b>丰链云</b>
              <small>物联网运营平台</small>
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
