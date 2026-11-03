# 交易撮合独立移动端

独立于 `agri-trade/frontend`（交易 PC、买家中心、卖家中心、运营端）构建和发布，共享交易 API、类型与 SSO 认证能力。

## 本地开发

```powershell
npm install
npm run dev
```

开发地址：`http://localhost:8181/`

## 构建与发布

```powershell
node ops/gateway/scripts/publish.mjs --app trade-mobile --version <版本号> --build
```

回滚：

```powershell
node ops/gateway/scripts/publish.mjs --app trade-mobile --repoint <旧版本号>
```

静态产物位于 `ops/gateway/bucket/trade-mobile`，由 nginx `36-trade-mobile.conf` 在独立端口 `8181` 提供。

交易 PC 的旧移动路由 `/mobile/trade` 会跳转到本独立入口；买家中心、卖家中心、店铺详情和完整订单详情仍由交易 PC 提供。

SSO 客户端：`trade-mobile`。本地回调地址：`http://localhost:8181/sso/callback`。
