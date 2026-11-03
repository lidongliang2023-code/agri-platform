# 子系统独立部署目录

`catalog.json` 是平台各业务模块的部署边界清单。部署单位可以独立启动、发布和回滚；一个业务模块可以由多个部署单位组成。

```powershell
# 查看全部模块
node ops/modules/status.mjs

# 查看单个模块
node ops/modules/status.mjs production

# 给自动化脚本读取
node ops/modules/status.mjs --json
```

## 发布

前端发布统一使用版本桶：

```powershell
node ops/gateway/scripts/publish.mjs --app <publishApp> --version <版本号> --build
```

回滚：

```powershell
node ops/gateway/scripts/publish.mjs --app <publishApp> --repoint <旧版本号>
```

生产移动端使用 uni-app 构建，不经过 Vite 发布器：

```powershell
cd agri-production/miniprogram
$env:UNI_H5_BASE='/mobile/versions/<版本号>/'
npm run build:h5
```

## 边界说明

- 主数据、生产、物联网、交易、S2B2C、供应链金融拥有独立前端与后端进程。
- 信息资讯、综合服务分别从门户源码按 `VITE_PORTAL_SCOPE` 构建，并使用独立版本桶和端口。
- 政府监管由主数据审核入口、生产运营端和独立的政务交换前置服务组成。
- 所有端口、版本桶和后端进程都在 `catalog.json` 中登记，其他脚本不应复制静态端口表。
