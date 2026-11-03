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
HTTPS 域名。微信正式发布前需填写 `src/manifest.json` 中的小程序 AppID；APP 需在
HBuilderX 中配置应用图标、包名、签名和隐私权限。

## 独立发布

```powershell
node ops/gateway/scripts/publish.mjs --app trade-mobile --version <版本号> --build
node ops/gateway/scripts/publish.mjs --app trade-mobile --repoint <旧版本号>
```
