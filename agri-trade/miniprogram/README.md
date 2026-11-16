# 交易撮合移动端

独立 uni-app 工程，支持 H5、微信小程序和 APP，发布到独立版本桶
`ops/gateway/bucket/trade-mobile`。

## 开发与构建

```powershell
pnpm install
pnpm run dev:h5
pnpm run build:h5
pnpm run build:mp-weixin
pnpm run build:app
```

构建产物：

- H5：`dist/build/h5`
- 微信小程序：`dist/build/mp-weixin`
- APP 资源：`dist/build/app`

## 环境变量

复制 `.env.example` 并配置：

- `VITE_TRADE_API_BASE`：交易后端 HTTPS 地址
- `VITE_TRADE_AUTH_BASE`：统一认证 HTTPS 地址
- `VITE_PROXY_TARGET`：仅开发代理使用

H5 同域网关部署时 API 地址可以使用相对路径；微信小程序和 APP 必须使用已备案
HTTPS 域名。微信开发预览另支持临时局域网联调：构建时在当前命令进程显式设置
`VITE_TRADE_LAN_PREVIEW=true`、`VITE_TRADE_API_BASE` 和 `VITE_TRADE_AUTH_BASE`（均指向电脑的私有 IPv4 HTTP 网关）。
该例外仅在微信 `envVersion=develop` 中生效；体验版、正式版及未开启联调开关的构建均不放行 HTTP。
手机与电脑须同一局域网；若微信提示域名校验失败，在预览小程序菜单开启调试后重新进入。
仅限测试账号联调，正式发布须重新普通构建并配置 HTTPS 合法域名；电脑 IP 变化后需重新生成预览包。
`src/manifest.json` 已配置当前联调小程序 AppID，重新构建会保留；正式发布前需核对账号归属及合法域名。APP 需在
HBuilderX 中配置应用图标、包名、签名和隐私权限。

## 统一登录

登录页版式与生产管理移动端登录页一致，全部走统一认证中心（`/api/v1/sso`），不单独建交易账号：

- 账号密码登录：`login-standalone`（用户名或手机号）；手机验证码登录：`sms/code` + `login-standalone-by-sms`；
- 账号开启二次验证时，第一步返回 `challengeToken`，页面再提交验证器动态码到 `login-standalone-mfa`；
- 拿到令牌后调用 `/api/v1/platform/permissions/mine` 校验 `trade:read`，没有权限时撤销刚建立的会话，不落本地；
- 忘记密码：`sms/code`（`reset_password`）+ `password-reset`，成功后该账号所有旧会话失效；
- 「注册统一账号」在 H5 里打开统一认证中心 `/register`（`VITE_TRADE_SSO_WEB`；本地 :8181 访问时默认同主机 :8090），
  小程序和 APP 里给出注册说明。

## H5 首屏

`vite.config.ts` 里的 `trade-h5-first-screen` 插件只在 H5 构建生效：

- 首页路由下由 `index.html` 的启动脚本并行预加载首页代码、预取首页两份公开数据
  （路径须与 `src/pages/home/index.vue` 的 `PRODUCTS_PATH` / `DEMANDS_PATH` 一致）；
- 主脚本未就绪前显示启动骨架，下载失败或超过 10 秒给出重试；
- 标签栏图标路径补上版本目录前缀（否则发布后图标会请求到根路径）；
- 构建产物里的 js/css/svg/json 生成 `.gz`，网关 `:8181` 用 `gzip_static` 直接发送。

## 独立发布

```powershell
node ops/gateway/scripts/publish.mjs --app trade-mobile --version <版本号> --build
node ops/gateway/scripts/publish.mjs --app trade-mobile --repoint <旧版本号>
```

## 买卖家中心切换

在“我的”顶部选择买家中心或卖家中心。选择保存在本机，重新进入与登录返回后沿用；切换中心不退出统一账号，也不授予新的服务端权限。
工作台和业务页只展示当前中心菜单，共享订单按买入／卖出查询；合同、物流等尚不支持方向参数的接口由客户端读取完整可访问集合后筛选分页。大数据量时应优先给后端补充方向筛选以减少请求。
未登录可先选择中心，点击业务入口后进行统一登录。公共货源与需求仍可浏览，采购、报价、发货等操作按当前中心展示。旧链接不会自动切换身份，不属于当前中心的业务返回当前工作台。
合同双方均属于当前账号时，遵循现有服务端买方优先规则：先在买家中心签署，再切到卖家中心签署，避免签错方向。
