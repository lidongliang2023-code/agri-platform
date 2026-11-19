# 统一接入层（本地形态）

依据：《网关与域名规划》第二节「网关路由矩阵」、第三节「静态产物与灰度版本指针」；
上游依据 V2.0 第 5 章（统一认证）与第 9 章（部署架构）。

## 它现在能做到什么

- **按子域路由**：`prod.agri.local` 走生产管理系统；未注册子域（如 `iot.agri.local`）由默认 server 直接 404，
  防止"配置没写对但页面照样打得开"。
- **前端与 API 同域**：该子域下的 `/api/*` 转发到 core-platform，其余按 SPA 规则回退到入口文件。
  同域是上一轮 HttpOnly 刷新令牌能在开发期零 CORS 配置直接生效的前提。
- **版本目录 + 指针发布**：`bucket/{app}/versions/{version}/` 不可变，`bucket/{app}/index.html` 是指针；
  回滚是把指针切回去，秒级、不用重新构建。
- **多子系统并存**：当前已在网关上挂生产、交易、S2B2C、供应链金融、物联网、信息资讯、综合服务、政府监管、AI 中台等独立前端，彼此互不串台。

## 已接入子系统与本地端口

按 `conf/conf.d/*.conf` 的 `listen` / `server_name` 整理（2026-11-19 核对，共 29 个对外端口）。
入口地址（带路径）与账号见仓库根目录 README 和 `docs/本地全栈_访问地址与账号_2026-11-02.md`。
每个子域的 `/api/v1/sso`、`/api/v1/platform` 等统一认证接口都转发到 core-platform（:8093），下表只列该端自己的业务后端。

| 业务域 | 子系统 | 子域 | 本地端口 | 配置文件 | 业务后端 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 统一入口 | 统一认证中心（登录页） | `sso.agri.local` | `:8090` | `50-sso.conf` | core-platform :8093 |
| 统一入口 | 官网门户 | `portal.agri.local` | `:8098` | `72-portal.conf` | 聚合交易 :8089、资讯 :8096、金融 :8087、S2B2C :8088、生产 :8092、主数据 :8083 |
| 统一入口 | 用户中心运营端 | `user-center-ops.agri.local` | `:8115` | `73-user-center-ops.conf` | core-platform :8093 |
| 生产管理 | 用户端 | `prod.agri.local` | `:80` | `20-prod.conf` | agri-production :8092 |
| 生产管理 | 运营端入口 | `admin.agri.local` | `:8190` | `70-admin-entry.conf` | 转发到 :80 |
| 生产管理 | 移动端（`/prod-mobile/`）/ 用户入口 | `user.agri.local` | `:8180` | `71-user-entry.conf` | 转发到 :80 |
| 主数据 | 管理平台 | `mdm.agri.local` | `:8080` | `30-mdm.conf` | mdm :8083 |
| 交易 | 交易与会员中心 | `trade.agri.local` | `:8086` | `35-trade.conf` | agri-trade :8089 |
| 交易 | 交易撮合移动端 | `trade-mobile.agri.local` | `:8181` | `36-trade-mobile.conf` | agri-trade :8089 |
| 供应链金融 | PC 端 | `finance.agri.local` | `:8081` | `40-vue-apps.conf` | agri-finance :8087 |
| S2B2C | 消费者商城 | `mall.agri.local` / `mall-consumer.agri.local` | `:8082` | `40-vue-apps.conf` | s2b2c :8088 |
| S2B2C | 供应商端（旧入口） | `mall-supplier.agri.local` | `:8084` | `40-vue-apps.conf` | 跳转到 :8103 供货运营 |
| S2B2C | 商家（渠道商）工作台 | `mall-channel.agri.local` | `:8085` | `40-vue-apps.conf` | s2b2c :8088 |
| S2B2C | 平台运营端（含供货运营） | `s2b2c-platform.agri.local` | `:8103` | `39-s2b2c-platform.conf` | s2b2c :8088 |
| S2B2C | 商城移动端 | `mall-mobile.agri.local` | `:8182` | `43-s2b2c-mobile.conf` | s2b2c :8088 |
| S2B2C | 商家（渠道商）移动端 | `channel-mobile.agri.local` | `:8184` | `44-s2b2c-role-mobile.conf` | s2b2c :8088 |
| S2B2C | 供应商移动端 | — | `:8183` | 已从网关配置移除 | **已停用** |
| 物联网 | 用户端 | `iot.agri.local` | `:8101` | `38-iot.conf` | agri-iot :8091 |
| 物联网 | 运营端 | `iot-admin.agri.local` | `:8102` | `38-iot.conf` | agri-iot :8091 |
| 物联网 | 移动端 | `iot-mobile.agri.local` | `:8111` | `38-iot.conf` | agri-iot :8091 |
| 信息资讯 | PC 端 | `info.agri.local` | `:8104` | `41-info-service.conf` | agri-info :8096（供需走交易 :8089） |
| 信息资讯 | 运营端（`/info-ops/`） | `info-ops.agri.local` | `:8113` | `41-info-service.conf` | agri-info :8096 |
| 信息资讯 | 移动端（`/info-mobile/`） | `info-mobile.agri.local` | `:8114` | `41-info-service.conf` | agri-info :8096 |
| 综合服务 | 用户端 | `service.agri.local` | `:8105` | `41-info-service.conf` | agri-service :8094 |
| 综合服务 | 移动端 | `service-mobile.agri.local` | `:8106` | `41-info-service.conf` | agri-service :8094 |
| 综合服务 | 运营端 | `service-ops.agri.local` | `:8107` | `41-info-service.conf` | agri-service :8094 |
| 政府监管 | 用户端 | `gov.agri.local` | `:8108` | `42-government.conf` | agri-government :8095 |
| 政府监管 | 移动执法端 | `gov-mobile.agri.local` | `:8109` | `42-government.conf` | agri-government :8095 |
| 政府监管 | 运营端 | `gov-ops.agri.local` | `:8110` | `42-government.conf` | agri-government :8095 |
| AI 中台 | 管理端（`/ai-ops/`） | `ai-ops.agri.local` | `:8116` | `45-ai.conf` | agri-ai :8201 |

移动端（8111、8114、8106、8109、8180–8184）都是 uni-app，一套源码出 H5 / 微信小程序 / App，网关只托管 H5 产物。

后端没起来的子域，其 `/api` 会返回 **502** —— 这正是"请求被路由到了该子系统自己的上游"的证据
（不是被吞掉、也不是 404）。后端起来后无需改配置。

`sso` 这个 vhost 比其它子系统多一条映射：`/authorize` 短路径 → 后端的 `/api/v1/sso/authorize`。
授权端点在 OIDC 惯例里是干净路径（子系统要把浏览器整页送过来），而我们的后端统一挂在 `/api/v1` 下，
所以在网关做一次路径映射，而不是把 `/api/v1/sso/authorize` 这个地址写进每个子系统的跳转代码。

## 启动

本机 nginx 在 `C:\nginx`（1.27.4）。必须以本目录为 prefix 运行，配置里的相对路径才成立：

```powershell
C:\nginx\nginx.exe -p D:\02研发项目（李栋梁）\2026农业产业互联网\agri-platform\ops\gateway -c conf/nginx.conf
# 重载配置（改完 conf.d 后用）：
C:\nginx\nginx.exe -p <同上路径> -s reload
# 停止：
C:\nginx\nginx.exe -p <同上路径> -s stop
```

## 环境注意事项（都是实际踩到的，不是预判）

1. **Windows 版 nginx 打不开含中文的路径**：以本仓库路径为 prefix 会直接报
   `CreateFile() failed (1113: No mapping for the Unicode character exists in the target multi-byte code page)`，
   `nginx -t` 都过不去。本机做法是建一个 ASCII 路径的 junction 指向本目录再启动：
   `New-Item -ItemType Junction -Path C:\Users\<你>\agri-gw -Target <本目录>`，然后 `-p C:\Users\<你>\agri-gw`。
   Linux / 容器里用 `/srv/gateway` 之类的 ASCII 路径即可，不存在这个问题。
2. **prefix 下必须先有 `temp/*` 五个子目录**（`client_body_temp`、`proxy_temp`、`fastcgi_temp`、`uwsgi_temp`、`scgi_temp`）。
   nginx 只会创建一级目录，缺了会报 `CreateDirectory() ... failed (3: The system cannot find the path specified)`。
3. **`conf.d/*.conf` 按文件名字典序加载**，所以上游定义带 `10-` 前缀、子系统 server 块带 `20-` 前缀。
   顺序错了会报 `upstream not found`（server 块先被解析到，而它引用的上游还没定义）。
4. 启动命令会让 PowerShell 会话挂住（nginx 是常驻进程）。要后台起就用
   `Start-Process -WindowStyle Hidden`，别直接在前台跑。
5. **子域一多要调 `server_names_hash_bucket_size`**：新增若干 server_name 后会报
   `could not build server_names_hash, you should increase server_names_hash_bucket_size: 32`，
   此时**整份配置加载失败** —— 已监听的端口继续按旧配置服务，新端口一个都不会起来
   （表现为新子域全都不通、老子域一切正常，很容易误判成"新配置没生效"）。已在 `conf/nginx.conf` 设为 64。
6. **本地"一端一口"的代价**：每个监听端口都需要自己的 `default_server` 兜底，否则该端口上唯一的
   server 块会接走任何未知 Host。生产只有一个监听端口（443），一条默认 server 就够 ——
   这条冗余是本地免 hosts 约定的产物，不是生产形态。

## 发布与回滚

```powershell
# 发布（重新构建并带上版本前缀）
node ops/gateway/scripts/publish.mjs --app prod --version 20261011-v1 --build

# 回滚（把指针切回上一个版本目录）
node ops/gateway/scripts/publish.mjs --app prod --repoint 20261010-v0
```

发布器会在产物里的资源前缀与版本目录不一致时**直接失败**：那是最典型的一类线上白屏
（指针切过去了，`/assets/*` 却 404），必须在发布阶段拦住，而不是等用户报障。

## 已验证 / 未验证

- 已验证：按 Host 路由（含未注册子域 404）、`/api` 同域转发、版本目录与指针的文件布局与缓存头、SPA 回退。
- 未验证：TLS、CDN 回源、按权重/租户的灰度分流 —— 这些需要真实域名与 CDN，属拆分后事项。

## 与 `agri-deploy/` 的关系（待收敛）

仓库里另有一个 `agri-deploy/`（当前未纳入版本控制、含 docker-compose），不是本目录产出的。
两处部署配置并存会让人不知道该改哪一份，**应当在它定型后收敛为一处**（本目录属"网关 + 发布脚本"，
容器编排属 `agri-deploy`；先把边界记在这里，避免后人对不上账）。
