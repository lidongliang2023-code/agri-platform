# 物联网管理模块

物联网管理模块包含用户端、运营端和一套同时面向 H5、微信小程序、App 的 uni-app 移动端。

## 目录

| 端 | 目录 | 本地地址 |
| --- | --- | --- |
| 用户端（PC） | `web` | http://127.0.0.1:8101/ |
| 运营端（PC） | `ops` | http://127.0.0.1:8102/ |
| 移动端（H5） | `miniprogram` | http://127.0.0.1:8111/ |
| 后端 | `backend` | http://127.0.0.1:8091 |

开发模式端口分别为 `5175`、`5177`、`5178`。

> 原来还有一个 `agri-iot/admin`（Vue2 风格的"物联网后台"）。它没有登记进统一发布器、
> 代理指向的是本模块从未用过的 8082、页面把 `localStorage.admin_token` 写死成 `admin-token`
> 且没有任何一次 HTTP 调用 —— 是一个跑不起来的孤儿应用，已删除，只保留上表三端。

## 数据库

后端默认使用 MySQL 8，数据库名为 `agri_iot`，默认连接为
`root/root@127.0.0.1:3306`。可通过以下环境变量覆盖：

```text
AGRI_IOT_DB_URL
AGRI_IOT_DB_USERNAME
AGRI_IOT_DB_PASSWORD
```

建表和演示数据分别位于：

- `backend/src/main/resources/schema-iot-app.sql`
- `backend/src/main/resources/data-iot-app.sql`

接口统一使用 `/api/v1/iot/app/**`（用户端/移动端）和
`/api/v1/iot/ops/**`（运营端）。

## 场景与自动化

用户端和移动端均支持场景、自动化规则的完整维护流程：

- 新建、编辑、删除和启用场景；运行中的场景必须先切换后才能删除。
- 新建、编辑、删除、启停和手动测试自动化规则。
- 传感器阈值触发、定时触发、设备离线触发三类规则按类型显示不同配置项。
- 执行设备仅允许选择支持远程控制的设备，测试执行会写入真实设备控制日志并累加触发次数。
- 场景执行配置和规则扩展配置保存前校验为合法 JSON 对象。

主要接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET / POST | `/api/v1/iot/app/scenes` | 查询、新建场景 |
| PUT / DELETE | `/api/v1/iot/app/scenes/{id}` | 编辑、删除场景 |
| POST | `/api/v1/iot/app/scenes/{id}/activate` | 切换运行场景 |
| GET / POST | `/api/v1/iot/app/rules` | 查询、新建自动化规则 |
| PUT / DELETE | `/api/v1/iot/app/rules/{id}` | 编辑、删除规则 |
| POST | `/api/v1/iot/app/rules/{id}/toggle` | 启停规则 |
| POST | `/api/v1/iot/app/rules/{id}/execute` | 测试或手动执行规则 |

规则结构化配置保存在 `iot_rule_config`。`rule_type` 支持 `automation`、`schedule`、
`offline`；`config_json` 保存扩展配置，其中 `executionMode` 为 `edge`（边缘网关）
或 `cloud`（云端规则引擎）。新建或执行规则时，读接口需要 `iot:read`，写接口需要
`iot:write`。

## 地块主数据联动

物联网“地块监测”不再维护独立地块档案。地块编号、名称、面积、作物、种植日期、地图边界和
生产状态全部从生产管理的当前租户地块接口读取：

- 生产接口：`GET http://localhost:8092/api/v1/production/plots`
- 物联网聚合接口：`GET http://localhost:8091/api/v1/iot/app/plots`
- 地块设备接口：`GET http://localhost:8091/api/v1/iot/app/devices?plotId={plotId}`
- 关联键：生产地块主键 `id`，与 IoT 设备的 `plot_id` 一致

IoT 后端会透传当前平台访问令牌，生产管理据此执行租户和权限过滤；IoT 只补充设备总数、
在线设备数和在线率。生产地块服务不可用时，地块监测接口返回网关错误，不会回退到
`iot_plot` 旧演示数据。

地块监测页面支持卡片和列表两种视图，视图选择保存在浏览器本地。两种视图均支持按地块
名称、编码、作物、农场搜索，以及按生产状态和农场筛选。地块详情会展示生产农场、租户、
面积、作物、生长阶段、种植/采收日期、中心坐标、设备覆盖率和该地块下的全部监测设备。
从地块详情进入设备管理时会携带 `plotId` 查询参数，设备列表自动按该地块过滤。

地块地图和详情地图统一使用天地图 Web API。构建前需配置 `VITE_TIANDITU_TOKEN`，
详见仓库 `docs/天地图接入说明.md`；未配置时页面会展示明确的缺密钥状态，不回退到
高德或百度地图。

## 农场、租户与设备注册

设备注册的农场、租户和地块统一来自生产管理当前登录租户，不再接受前端任意填写：

- 生产农场：`GET http://localhost:8092/api/v1/production/farms/all`
- 生产地块：`GET http://localhost:8092/api/v1/production/plots`
- IoT 聚合农场：`GET http://localhost:8091/api/v1/iot/app/farms`
- 可用设备类型：`GET http://localhost:8091/api/v1/iot/app/device-types`

注册设备时，后端会校验农场属于当前生产租户、地块属于所选农场、网关属于所选农场，
并将生产农场的 `farmId` 与 `tenantId` 写入 `iot_device`。设备清单也按当前生产租户的
农场范围查询，历史设备会在读取时幂等同步为生产租户标识。

`POST /api/v1/iot/app/devices` 要求 `deviceCode`、`deviceName`、`typeId`、`farmId`、
`gatewayId`、`groupId` 必填；`plotId` 可选，但填写后必须与农场一致。设备编码唯一，
初始状态为离线，等待网关首次上报后切换为在线。

## 边缘网关管理

边缘网关页面支持新增、编辑、删除、重启、状态筛选和生产农场筛选。网关必须归属生产管理
当前租户的农场，新增网关的编码唯一且初始状态为离线。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET / POST | `/api/v1/iot/app/gateways` | 查询、新增边缘网关 |
| GET / PUT / DELETE | `/api/v1/iot/app/gateways/{id}` | 查看、编辑、删除网关 |
| POST | `/api/v1/iot/app/gateways/{id}/restart` | 下发重启指令并留痕（状态以上线心跳为准，不代写 online） |

设备列表中的挂载数量和在线数量以 `iot_device.gateway_id` 为准。已挂载设备的网关不能删除；
已有设备的网关也不能直接迁移到其他农场。网关详情会展示所属生产农场、生产租户、协议、
固件、IP、资源占用和全部挂载设备。

## 身份与数据范围（经营主体）

物联网域的数据范围与交易/主数据/生产/金融/服务/监管各域同一口径：**租户由服务端从访问令牌推导**，
不接收前端自报的 `tenantId`/`farmId`/`deviceId`，也不接受请求体里的操作人姓名。

- 租户主键统一为**平台经营主体号**（`agri_core.platform_merchant.id`，演示数据 2001/2003）。
  以前 `iot_tenant` 用自己的自增 1..4，而设备表写的是 2001，运营端
  `LEFT JOIN iot_tenant` 对 29 台设备里 0 台能解析出租户名；现在两侧同源。
- 推导链路：Bearer 令牌 → 生产域 `GET /api/v1/production/farms/all` → 当前可见农场 → 农场上的 `tenantId`。
  实现集中在 `agri-iot/backend/src/main/java/com/agri/iot/integration/IotIdentityService.java`，
  解析结果只缓存在同一个请求内（换主体绑定立刻生效，不做跨请求缓存）。
- 可见农场分属多个经营主体时直接拒绝（403），不会挑一个主体继续查。
- **读接口**在"没有可见农场"时返回空列表/空统计（-1 租户口径），与"设备列表本来就空"一致，
  不会一半页面空白、一半页面报错。
- **写接口**严格判定：没有主体 → 403 并说明该找谁配置；按 id 操作不归属当前主体的实体 → **404**
  （不区分"不存在"和"不是你的"，否则 id 空间就成了可枚举的）。覆盖设备改删与控制指令下发、
  告警处置、场景/自动化规则/分组/工单/消息/升级任务、网关按农场归属校验。
- 私域列：`iot_device.tenant_id`、`iot_alert.tenant_id`、`iot_device_group`、`iot_scene`、`iot_rule`、
  `iot_work_order`、`iot_message`、`iot_ota_task` 的 `tenant_id`。这些列一律 `NOT NULL` 且**不给默认值**，
  漏传就报错，不会静默落到某个默认主体上变成"列表看得见、按主体查不到"。
  补列与旧号迁移写在 `schema-iot-mysql.sql`（幂等，可重复执行）。
- 时间列统一存 `yyyy-MM-dd HH:mm`：报表用 `SUBSTRING(col,1,10)` 聚合日期、`SUBSTRING(col,12,2)` 聚合小时。
  旧的"今天 10:18 / 昨天 16:42 / 10-22 09:00"文本已由迁移脚本就地转换（否则今日统计永远为 0）。
- 审计留痕：`iot_ops_log.operator_name` 取令牌账号（`nickname` → `username` → `sub`），
  `ip_address` 取 `X-Forwarded-For`/`X-Real-IP`/直连地址；取不到操作人就直接失败，
  不再顶替成写死的"陈建国""张运营""李运维"。
- **告警阈值是两层规则**：平台预置（`iot_alert_rule`）+ 经营主体自定义（`iot_alert_rule_tenant`）。
  平台预置那张表没有租户列、`enabled` 是全平台开关，所以原先用户端的「停用/启用」按钮已下线
  （任一合作社点一下就会关掉全平台同类告警），改成只读；主体自己的阈值走 `/alert-rules/custom`，
  在同一个指标（设备类型匹配时）上**覆盖**平台预置，其余指标继续由平台兜底。

## 阈值规则（平台预置 + 主体差异化）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/iot/app/alert-rules` | 平台预置阈值（只读，`source=platform`） |
| GET | `/api/v1/iot/app/alert-rules/view` | 平台预置（含"被哪条主体规则覆盖"）+ 我的规则 + 生效集合 |
| GET | `/api/v1/iot/app/alert-rules/options` | 指标目录（设备类型属性 ∪ 本主体实际读数指标）、比较符、等级 |
| POST / PUT / DELETE | `/api/v1/iot/app/alert-rules/custom[/{id}]` | 新增 / 修改 / 删除本主体阈值规则 |
| POST | `/api/v1/iot/app/alert-rules/custom/{id}/toggle` | 启停本主体规则（停用后该指标回落平台预置） |
| GET | `/api/v1/iot/app/alert-rules/evaluate` | 按本主体生效规则判定一条读数（GET：只判定、不写数据） |
| GET | `/api/v1/iot/app/alert-rules/risk-readings` | 最近一次读数已越线的设备指标（含持续时间判定） |
| GET / POST | `/api/v1/iot/ops/alert-rules`、`/alert-rules/{id}/toggle` | 运营端读取 / 启停平台预置（全平台开关，写审计） |
| GET | `/api/v1/iot/ops/alert-rules/tenant` | 各经营主体自定义阈值一览（带主体名） |

规则里能自己填的只有名称、指标、比较方式、阈值、持续时间、等级、备注；`metric_name` 由服务端按指标目录补，
`created_by`/`updated_by` 取令牌账号，`tenant_id` 由令牌推导，越权改删别人的规则一律 404。
校验：比较方式限 `> >= < <=`，等级限 `critical/major/normal`，持续时间 0~86400 秒，
设备类型必须在设备类型目录内，每主体最多 50 条。

`duration_seconds` 不是摆设：判定回到 `iot_telemetry` 的实际读数序列，要求窗口内每条读数都越线；
窗口里没有读数就不算"持续越线"（缺数据不等于条件成立）。因此同一读数在不同主体可以给出不同结论：
演示数据里 34℃ 在 2001（蔬菜棚阈值 32℃）判紧急、在 2003（果园阈值 33℃）判重要，
而 1℃ 只有 2003 会报（它另有一条"夜间低于 2℃ 防霜"的下限规则）。

## 大盘与报表的取数口径

工作台（`GET /api/v1/iot/app/overview`）、数据分析（`GET /api/v1/iot/app/reports`）和运营概览
（`GET /api/v1/iot/ops/overview`）的每个数字都来自当前主体（或全平台，运营端）的实查聚合：

| 页面指标 | 取数 |
| --- | --- |
| 设备总数 / 在线 / 离线 | `iot_device` 按令牌农场范围计数 |
| 待处理告警 | `iot_alert` 按 `tenant_id` 且 `status<>'resolved'` |
| 今日控制 / 遥测读数 | `iot_control_log`、`iot_telemetry` 按当天日期前缀 |
| 实时环境卡片 | 每个指标最近一次读数（`ROW_NUMBER() … ORDER BY recorded_at DESC, id DESC`），涨跌对比上一条，等级按**本主体生效阈值**判定 |
| 环境趋势 | 最近一个**有读数的日期**按小时聚合，无数据时返回空列表（页面显示空图） |
| 报表 4 项 | 遥测读数总量、在线率、累计告警、控制指令数（原「灌溉用水 326.8m³」没有计量来源，已移除） |
| 报表近 7 日 | 最近 7 个**有读数的日期**的采集量与控制指令数 |
| 运营在线率趋势 | 近 7 个有上报日期的"当天有读数的设备数 / 在册设备数" |

## 验证

```bash
# 1) 第二经营主体（2003 陕西洛川果业）在生产域获得一个可见农场，跨主体才有点得动的数据
node scripts/provision-iot-access.mjs            # 幂等创建；--release 回收

# 2) 接口级回归：身份推导、跨主体读写一律 404、大盘/报表逐指标与 SQL 对账、留痕与审计、零残留
node scripts/e2e-iot-flow.mjs                    # 当前 156 条断言

# 3) 三端浏览器点检：8101 用户端 / 8102 运营端 / 8111 移动端 H5
node scripts/check-iot-ui.mjs                    # 当前 92 项，全部通过
```

`e2e-iot-flow.mjs` 只回收**本次自己创建**的农场与临时数据（按建前最大 id 清理，种子状态逐条还原）；
`--keep` 保留现场便于排查。跑之前需要 core :8093、production :8092、agri-iot :8091 与网关在跑。

## 已知边界

- **没有到真机的链路**：控制指令、网关重启、OTA 升级只写"已下发/已排期"留痕，
  不修改设备或网关状态，也不谎报"设备已确认"。设备回执、遥测上报、告警生成都需要接入侧落地后回写。
- **没有采集入口**：`iot_telemetry` 与 `iot_alert` 目前只有演示种子写入，Java 侧没有 insert 通道；
  第二主体（2003）的告警/消息/工单也是种子给出来的，用于验证跨主体隔离。
- **运营端按设计跨主体**：`/api/v1/iot/ops/**` 是平台管理面，看全平台数据，靠 RBAC
  （`iot:read`/`iot:write` + `@OperatorOnly("iot:admin")`）限制访问，不做租户过滤。
- 阈值差异化只做到「判定」这一层：规则越线不会自动生成 `iot_alert`（平台没有采集链路），风险读数清单是查询时算出来的实时视图；接入侧落地后应当在写读数处调用同一套生效规则生成告警（含去重与冷却）。
- 移动端登录沿用 `/api/v1/sso/login-standalone` 且 `marketId` 固定为 1（平台侧的市场维度参数，
  物联网不据此划分数据），权限判定仍走平台 `permissions/mine`。
- 演示账号 `farmer` 在生产域可见 26+ 个农场（含往轮联调遗留的"测试农场NN"），
  因此横幅显示"…等 N 个农场"。这些农场属于共享演示数据，回收与否请由生产模块负责人决定。
- 站内消息没有写入方（告警/工单流转不会自动产生消息），列表内容全部来自种子。

## 构建与运行

```powershell
# 后端（仓库根目录）
mvn -s C:\Users\71502\.m2\settings.xml '-Dmaven.repo.local=C:\maven\repository' -pl agri-iot/backend -am package -DskipTests
java -jar agri-iot\backend\target\agri-iot-platform-1.0.0.jar

# 用户端
cd agri-iot\web
npm install
npm run dev

# 运营端
cd agri-iot\ops
npm install
npm run dev

# 移动端 H5 / 微信小程序 / App
cd agri-iot\miniprogram
npm install
npm run dev:h5
npm run build:h5
npm run build:mp-weixin
npm run build:app
```

移动端产物：

- H5：`dist/build/h5`
- 微信小程序：`dist/build/mp-weixin`
- App 资源：`dist/build/app`

## 移动端部署

H5 默认与后端同源，通过 `/api/v1/iot/` 访问。小程序和 App 在没有同源代理时，
构建前设置 `VITE_IOT_API_BASE` 为后端 HTTPS 地址，例如：

```powershell
$env:VITE_IOT_API_BASE = 'https://iot-api.example.com'
npm run build:mp-weixin
npm run build:app
```

小程序正式发布前需要在 `src/manifest.json` 填写微信小程序 AppID，并在微信公众平台配置
HTTPS 业务域名和 request 合法域名。App 发布前需要在 HBuilderX 配置应用标识、证书、
隐私权限和签名后执行云打包。

## 版本发布

用户端、运营端和移动端 H5 已登记到统一发布器。本轮（主体差异化阈值；上一轮的经营主体统一与范围守卫见 identity-r2）发布：

```powershell
node ops/gateway/scripts/publish.mjs --app iot-web --version 20261101-iot-threshold-r3 --build
node ops/gateway/scripts/publish.mjs --app iot-admin --version 20261101-iot-threshold-r3 --build
node ops/gateway/scripts/publish.mjs --app iot-mobile --version 20261101-iot-threshold-r3 --build
```

后端 jar 需要在仓库根目录重新打包后重启 :8091（`schema-iot-app.sql` + `schema-iot-mysql.sql` +
`data-iot-app.sql` 会在启动时幂等地补列、迁移旧租户号、归一时间格式并补种子）。

回滚时使用同一命令并把 `--build` 替换为 `--repoint <旧版本>`。
