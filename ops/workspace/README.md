# workspace 接入

把已存在的子系统前端接进 pnpm workspace 与共享包 `@agri/shared`。

## 用法

```powershell
node ops/workspace/onboard-app.mjs --app agri-master-data/web --dry-run   # 先看会改什么
node ops/workspace/onboard-app.mjs --app agri-master-data/web             # 实际写入
node ops/workspace/onboard-app.mjs --app agri-master-data/web --check     # 复核接线是否齐全
```

脚本保证四件事：`package.json` 增加 `"@agri/shared": "workspace:*"`；`tsconfig.json` 增加
`@agri/shared/*` 路径映射；`vite.config.ts` 增加 alias 并**排在 `'@'` 之前**；新增
`src/shared-wiring.ts` 并在入口 import 它（`import type` 走 paths、运行时 import 走 alias，
断任何一条都会当场失败）。

**它只做加法，锚点对不上就报错退出**（不猜、不重排、不格式化用户文件）。因此对本仓库里
形态不同的工程，它会明确拒绝而不是改错。

## 当前接入状态

| 工程 | 栈 | 状态 |
| :-- | :-- | :-- |
| `agri-production/frontend` | React 18 + TS + antd | ✅ 已接入（先前的基线工程） |
| `agri-master-data/web` | React 18 + TS + antd | ✅ 已接入：接线四处齐备，`tsc --noEmit` 0、`vite build` 0、产物内含共享品牌色与 `--agri-brand-color` 注入；已并入 workspace 并走过网关发布（版本 `20261011-m2`） |
| `agri-finance/frontend` | Vue 3 + element-plus（JS，无 TS） | ✅ 已接入：依赖 + Vite alias + 入口 import `@agri/shared/tokens/tokens.css`；`vite build` 0，产物 CSS 含全部令牌变量 |
| `agri-s2b2c/frontend-channel` | Vue 3 + element-plus | ✅ 已接入并构建通过（产物含令牌） |
| `agri-s2b2c/frontend-consumer` | Vue 3 + vant | ✅ 已接入并构建通过（产物含令牌） |
| `agri-s2b2c/frontend-supplier` | Vue 3 + element-plus | ✅ 已接入并构建通过（产物含令牌） |
| `agri-s2b2c/frontend-platform` | Vue 3 + element-plus | ⚠️ 接线完成但**构建不通**，卡在既有源码缺陷（见下） |
| `agri-iot/web`、`agri-iot/admin` | — | ⏸ 未动：这两个目录已纳入版本控制且当前有他人在途改动 |
| `agri-trade/frontend` | — | ⏸ 未动：同上（且它自带 `pnpm-lock.yaml`，说明已在别处按 pnpm 管理） |

## 接入过程中发现的两个既有缺陷（不是接入造成的，但必须记下来）

1. **`frontend-platform` 导入了不存在的图标**：`src/views/Layout.vue` 从
   `@element-plus/icons-vue` 导入 `Users`，但该包只导出 `User` 与 `UserFilled`（已核对该包
   的实际导出）。该工程 `dist/` 从来不存在 —— 说明它**从来没有构建成功过**。
   修法很短（换成 `UserFilled` 或删掉未用导入），但那是它的界面语义，我不越权改；
   留给你或该子系统负责人定。
2. **`frontend-platform` 缺一条依赖声明**：它导入 `@element-plus/icons-vue` 却没在
   `package.json` 里声明（npm 的扁平安装会把它顺带提升上来，所以以前"能跑"；pnpm 隔离幽灵依赖后
   直接报 Could not resolve）。这一条我已经补上声明（`^2.3.1`）——属于工程正确性，不是界面决策。
   其余工程未发现同类问题（构建通过即为证）。

## 仍需拍板

- **npm 锁文件**：这批工程的 `package-lock.json` 仍在（prod 当初的迁移是删掉并留 `.bak`）。
  删除属破坏性操作，脚本不做；建议在它们正式入库时一并对齐「pnpm 为唯一包管理器」。

## 注意事项

- 被接入的 `agri-master-data/` 等目录**目前尚未纳入版本控制**，脚本对它们的改动只落在工作区，
  不会（也不该）被 `git add`。等工程入库时这些改动会随之进入提交。
- `pnpm-workspace.yaml` 里目前用的是显式路径：通配（如 `agri-*/web`）会把 `agri-iot/web` 这类
  他人在途工程一并纳入、让 pnpm 接管其依赖树。待目录入库、在途改动收敛后再改通配收口。
