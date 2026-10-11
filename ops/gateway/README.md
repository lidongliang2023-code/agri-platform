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
- **多子系统并存**：当前已在网关上挂 6 个子系统前端（React 与 Vue 两套栈各 3 个），彼此互不串台。

## 已接入子系统与本地端口

| 子系统 | 子域 | 本地端口 | 栈 | 其自身后端 |
| :-- | :-- | :-- | :-- | :-- |
| 生产管理系统 | `prod.agri.local` | `:80` | React + TS + antd | core-platform（:8093，在跑） |
| 主数据管理平台 | `mdm.agri.local` | `:8080` | React + TS + antd | :8083（未跑） |
| 供应链金融 | `finance.agri.local` | `:8081` | Vue 3 + element-plus | :8087（未跑） |
| S2B2C 商城（消费者端） | `mall.agri.local` / `mall-consumer.agri.local` | `:8082` | Vue 3 + vant | :8088（未跑） |
| S2B2C 商城（供应商端） | `mall-supplier.agri.local` | `:8084` | Vue 3 + element-plus | :8088（未跑） |
| S2B2C 商城（渠道端） | `mall-channel.agri.local` | `:8085` | Vue 3 + element-plus | :8088（未跑） |

后端未跑的子域，其 `/api` 会返回 **502** —— 这正是"请求被路由到了该子系统自己的上游"的证据
（不是被吞掉、也不是 404）。后端起来后无需改配置。

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
