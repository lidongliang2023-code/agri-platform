# 综合服务移动端（uni-app）

同一套 Vue 3 + TypeScript 源码支持：

- H5：`pnpm run build:h5`，产物 `dist/build/h5`
- 微信小程序：`pnpm run build:mp-weixin`，产物 `dist/build/mp-weixin`
- iOS / Android App：`pnpm run build:app`，产物 `dist/build/app`

## 本地开发

```powershell
pnpm run dev:h5
pnpm run dev:mp-weixin
```

H5 由 Vite 将 `/api` 代理到 `http://localhost:8094`。微信开发者工具导入 `dist/build/mp-weixin`，本地调试可勾选“不校验合法域名”。App 构建结果在 `dist/build/app`，使用 HBuilderX 导入后可制作原生安装包。

## API 地址

H5 使用同源 `/api/v1/service`。小程序和 App 通过 `VITE_SERVICE_API_BASE` 注入可访问的 HTTPS 服务域名：

```powershell
$env:VITE_SERVICE_API_BASE='https://service-api.example.com'
pnpm run build:mp-weixin
pnpm run build:app
```

微信正式发布前需在微信公众平台配置该域名为 request 合法域名。App 需按平台安全要求配置 HTTPS、隐私政策、权限说明和签名证书。

## 后端

默认 MySQL 配置在 `agri-service/src/main/resources/application-mysql.yml`。启动前可用环境变量覆盖：

```powershell
$env:AGRI_SERVICE_DB_URL='jdbc:mysql://localhost:3306/agri_service?...'
$env:AGRI_SERVICE_DB_USERNAME='root'
$env:AGRI_SERVICE_DB_PASSWORD='root'
java -jar agri-service/target/agri-service-1.0.0.jar
```
