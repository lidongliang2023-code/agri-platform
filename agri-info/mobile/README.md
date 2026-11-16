# 信息资讯移动端（uni-app）

信息资讯子系统（`agri-info`）的移动端，一套 Vue 3 + TypeScript 源码同时构建 **H5 / 微信小程序 / App** 三种产物，
后端与 PC 用户端、运营端共用 `agri-info`（默认 `:8096`），登录走平台统一账号（SSO）。

## 三种部署形态

| 形态 | 命令 | 产物 | 访问方式 |
| --- | --- | --- | --- |
| H5 | `npm run build:h5` | `dist/build/h5` | 网关 `http://localhost:8114/`（`info-mobile` 发布单元） |
| 微信小程序 | `npm run build:mp-weixin` | `dist/build/mp-weixin` | 微信开发者工具导入 → 上传审核 → 独立小程序 |
| iOS / Android App | `npm run build:app` | `dist/build/app` | HBuilderX 导入 → 云打包 / 离线打包 → 独立 App |

小程序与 App 是**独立部署产物**：不依赖网关的同源反代，通过 `VITE_INFO_API_BASE` / `VITE_INFO_AUTH_BASE`
指向各自可访问的 HTTPS 域名，因此可以单独上架、单独发版，不影响 H5 与 PC 端。

## 本地开发

```powershell
npm install
npm run dev:h5          # http://localhost:5199，/api 代理到 8096，/api/v1/sso|auth|platform 代理到 8093
npm run dev:mp-weixin   # 产物在 dist/dev/mp-weixin，微信开发者工具导入
npm run typecheck       # vue-tsc 类型校验
```

## 构建与发布

```powershell
# H5（网关发布，版本目录 + 指针，见 ops/gateway/scripts/publish.mjs）
node ../../ops/gateway/scripts/publish.mjs --app info-mobile --version 1.0.0 --build

# 微信小程序（正式发布前在微信公众平台把接口域名加入 request 合法域名）
$env:VITE_INFO_API_BASE='https://info-api.example.com'
$env:VITE_INFO_AUTH_BASE='https://core-api.example.com'
npm run build:mp-weixin

# App
npm run build:app
```

## 统一登录说明

- 账号体系、令牌体系、权限词表与 PC 端完全一致：`info:consumer`（用户端）/ `info:admin`（运营端）。
- PC 端用「授权码 + PKCE 整页跳转」，移动端无法整页跳转，因此改走平台同源的
  `/api/v1/sso/login-standalone` 直连换取令牌，随后用 `/api/v1/platform/permissions/mine` 校验角色。
- 私域数据（我的发布 / 预警 / 订阅 / 收藏 / AI 提问记录）按统一账号昵称隔离，
- 私域归属由服务端验证 Bearer 令牌后获得的 `uid:<账号ID>` 决定，不接受昵称作为归属依据。

## 目录结构

```
src/
  App.vue              全局样式（平台移动端设计令牌 + 模块通用类）
  pages.json           35 个页面 + 4 个 tab（资讯 / 行情 / AI问答 / 我的）
  manifest.json        H5 / 小程序 / App 三端配置
  auth.ts              统一登录封装
  api.ts               领域类型 + 请求封装 + 展示辅助（涨红跌绿、相对时间等）
  components/
    TrendChart.vue     轻量趋势图（flex 柱形，三端一致，无图表库依赖）
  pages/
    news/              资讯首页、频道、详情
    market/            行情列表、品种行情、价格指数
    alert/             价格预警设置、预警消息
    ai/                AI 问答、历史提问
    search/ message/ favorite/ history/ subscription/
    profile/ settings/ help/ login/
    sd/                供需大厅、发布、详情、智能匹配、在线沟通、我的发布
    report/            报告详情、我的报告
    attest/            存证记录、存证详情、内容验证
    expert/            认证申请、认证查询、专家主页、我的认证
```

## 后端

```powershell
java -jar agri-info/target/agri-info-1.0.0.jar --server.port=8096
```

默认 MySQL（库 `agri_info`）；本地无库时用 `--spring.profiles.active=h2` 走内存库演示数据。

## 移动端收敛与资料边界

- 移动端唯一源码为 `agri-info/mobile`（uni-app），分别构建 H5、微信小程序和 App；React frontend 仅保留桌面功能，原手机抽屉与底栏已删除。
- 资讯地区、主营品种、规模及简介经 GET/PUT `/api/v1/info/profile` 写入 `info_user_profile`；统一昵称、头像及认证仍属于用户中心。
- 订阅支持 PUT（必须携带布尔 enabled）及既有 PATCH；收藏取消使用收藏记录 ID，供需收藏区分 supply/demand。
- 浏览、搜索和验证历史为按账号 ID 隔离的本机记录；清理缓存会删除这些本机记录，不删除服务端资料及业务数据。
- 订单和报价归交易撮合所有。H5 跨应用入口可配置 `VITE_TRADE_MOBILE_URL`；微信小程序需配置 `VITE_TRADE_MINIPROGRAM_APPID`；App 需配置 `VITE_TRADE_APP_SCHEME` 并由目标应用注册 scheme。未配置时显示明确说明，不伪报交易成功。
- 桌面手机重定向可配置 `VITE_INFO_MOBILE_URL`；生产同域默认 `/info-mobile/`，需由网关映射到 uni-app H5 产物。
