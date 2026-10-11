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
| `agri-master-data/web` | React 18 + TS + antd | ✅ 本轮接入：接线四处齐备，`tsc --noEmit` 0、`vite build` 0、产物内含共享品牌色与 `--agri-brand-color` 注入；已并入 `pnpm-workspace.yaml` 并走过网关发布 |
| `agri-finance/frontend` | **Vue 3 + element-plus（JS，无 TS）** | ⏸ 未接线：结构不同（无 `tsconfig.json`/`vite.config.ts`），且共享包当前的 antd 主题与 TS 类型对它**不可直接消费** |
| `agri-s2b2c/frontend-{channel,consumer,platform,supplier}` | **Vue 3 + element-plus / vant（JS）** | ⏸ 同上 |
| `agri-iot/web`、`agri-iot/admin` | — | ⏸ 未动：这两个目录已纳入版本控制且当前有他人在途改动 |
| `agri-trade/frontend` | — | ⏸ 未动：同上（且它自带 `pnpm-lock.yaml`，说明已在别处按 pnpm 管理） |

## 两个需要拍板的问题（本轮没自作主张）

1. **九大前端栈不一致**：目前是「React+TS」与「Vue3+JS」两套并存。共享包 `@agri/shared`
   现有资产（antd 主题、TS 类型）只对 React+TS 那套生效。要覆盖 Vue 侧，得先把共享面
   做成框架无关（例如设计令牌以 CSS 变量 / 纯 JS 常量发布），或按栈分包 —— 这是架构决策，
   不是接线脚本能替的。
2. **npm 锁文件**：这批工程的 `package-lock.json` 仍在（prod 当初的迁移是删掉并留 `.bak`）。
   删除属破坏性操作，脚本不做；建议在它们正式入库时一并对齐「pnpm 为唯一包管理器」。

## 注意事项

- 被接入的 `agri-master-data/` 等目录**目前尚未纳入版本控制**，脚本对它们的改动只落在工作区，
  不会（也不该）被 `git add`。等工程入库时这些改动会随之进入提交。
- `pnpm-workspace.yaml` 里目前用的是显式路径：通配（如 `agri-*/web`）会把 `agri-iot/web` 这类
  他人在途工程一并纳入、让 pnpm 接管其依赖树。待目录入库、在途改动收敛后再改通配收口。
