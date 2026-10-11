# @agri/create-frontend

农业产业互联网平台 · **子系统前端脚手架**（V2.0 第 4.8 节「CLI 模板」）。

## 它解决什么

九个子系统各起一个前端时，最容易出错、出错了又不会立刻报错的三个地方，由脚手架固化下来：

1. **共享包的解析方式**：裸包走 node_modules，子路径走 tsconfig `paths` + Vite alias，
   且 alias 里 `@agri/shared` 必须排在 `'@'` 之前（前缀匹配顺序问题）；
2. **产物按 `/{app}/versions/{version}/` 发布**：与网关的版本指针配套，回滚只切指针；
3. **共享包源码的相对路径按目标目录实际深度计算**：层级写死的话，
   新子系统换个目录深度就会静默解析到别的地方。

## 用法

```bash
# 在仓库根执行（会向上查找 pnpm-workspace.yaml）
node packages/create-agri-frontend/bin/create.mjs agri-iot/frontend \
  --app iot --name 农业物联网管理 --port 5174
```

参数与示例见 `--help`。生成后按提示三步走：确认 workspace 覆盖 → `pnpm install` → `pnpm --filter <包名> dev`。

## 它不做什么

- **不改目标目录以外的任何文件**：是否把新目录登记进 `pnpm-workspace.yaml` 由人决定，脚本只提示该加哪条。
  自动改共享配置文件会让「谁改的、为什么改」失去痕迹。
- **不覆盖非空目录**，除非显式 `--force`。
- **不生成业务代码**：只给标准骨架 + 接线自检页。业务结构由各子系统按自身 PRD 决定。

## 验证状态

模板不是"看起来能跑"：已在 workspace 内实际生成一个 smoke 工程，跑通 `tsc --noEmit` 与 `vite build`，
并核对产物 `index.html` 的资源引用带 `/{app}/versions/{version}/` 前缀。验证记录见本包提交说明。
