# {{APP_NAME}}前端（{{APP_SLUG}}）

由 `@agri/create-frontend` 基于标准骨架生成，依赖共享包 `@agri/shared`。
构建版本：`{{BUILD_VERSION}}`｜开发端口：`{{DEV_PORT}}`｜产物路径：`/{{APP_SLUG}}/versions/{{BUILD_VERSION}}/`

## 开工前必读的三条约定

1. **共享包只能用两种方式引用**：裸包 `@agri/shared`（走 node_modules，靠包内 `main`/`types` 解析）
   与子路径 `@agri/shared/类型或样式路径`（走 tsconfig `paths` + Vite alias）。
   不要改成依赖 `agri-shared` 的 `exports` 子路径 —— 该方式在 `tsc` 侧不可靠，主应用迁移时实测过。
2. **Vite alias 里 `@agri/shared` 必须排在 `'@'` 之前**，否则 `'@'` 会把 `@agri/shared/...`
   前缀吞成 `./src/agri/shared/...`。
3. **主题与品牌色一律从共享包取**（`@agri/shared` 的 `antdTheme` / `BRAND_COLOR`），
   本目录不再定义第二份，避免九个子系统各长一个样。

## 常用命令

```bash
pnpm install                 # 在仓库根执行
pnpm --filter {{APP_SLUG}}-frontend dev
pnpm --filter {{APP_SLUG}}-frontend build      # tsc + vite build，产物含版本路径
pnpm --filter {{APP_SLUG}}-frontend typecheck
```

后端接口经 `/api` 代理，默认 `{{PROXY_TARGET}}`；临时改向后端时：

```bash
VITE_PROXY_TARGET=http://localhost:8111 pnpm --filter {{APP_SLUG}}-frontend dev
```

## 接线自检

首页「共享包接线自检」卡片里的值取自共享包。**全部有值 = 接线正确**；
若卡片空白或构建失败，先查 `src/shared-wiring.ts`、`tsconfig.json` 的 `paths`、`vite.config.ts` 的 alias 三处。
