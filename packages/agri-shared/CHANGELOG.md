# 变更日志（@agri/shared）

格式依据 V2.0 第 4.8 节「共享资产生命周期与前端团队协作规范」：
语义化版本（major / minor / patch）、废弃须标注且**保留至少一个大版本过渡期**。
本文件只记公开变更，内部重构不记。

## [Unreleased]

### 新增

- **令牌层（跨栈共享面，2026-10-11）**：新增框架无关的设计令牌 `tokens/` ——
  纯 TS 常量（品牌色 / 语义色 / 布局尺寸 / 圆角 / 字号）+ `tokens.css` 的 CSS 变量投影。
  动机：平台前端不是同一套栈（React+TS+antd 与 Vue3+JS 并存），而此前品牌色只以 antd
  `ThemeConfig` 的形式存在，Vue 侧**无处可取**，只能各写一个色值。
  现在两侧各自投影：React 用 `styles/theme.ts`（已改为由令牌派生），Vue / 任意栈
  `import '@agri/shared/tokens/tokens.css'` 即可拿到同一套令牌（无需 TypeScript）。
  `styles/global.less` 改为 inline 引用 `tokens.css`，不再重复定义变量。
- **令牌一致性门禁**：`tests/tokens.test.ts` 把 `tokens.css` 与 TS 定义**逐项**比对
  （多一个变量、少一个变量、值不一致，任一条都红），并断言 antd 主题确实由令牌派生、
  `global.less` 不再自行定义令牌。共享包门禁现为 5 个测试文件 43 条用例、覆盖率 100%。

- **T2 首批落地（2026-10-11）**：接入 `vitest` 5.0.3 + `@vitest/coverage-v8`，
  单测与覆盖率门禁成为包内可执行脚本（`pnpm test` / `pnpm test:coverage`）。
  - 用例 37 条 / 4 个文件，覆盖本包**全部 5 个含运行时代码的模块**：
    `styles/theme.ts`（主色唯一来源、布局常量与 antd 令牌一致）、
    `types/task.ts`（`executing/doing`、`completed/done` 迁移窗口双词表判定、逾期派生口径、下拉与映射一致性）、
    `types/harvest.ts`（成熟度阈值 60/80/95、库存健康四档优先级与临期判定）、
    `types/farm.ts`（地块状态五项取值、作物图标与兜底）、`index.ts`（出口）。
  - **门禁口径**：`thresholds.perFile: true`，四项指标各 ≥80%，未达标 vitest 直接以退出码 1 结束，
    因此该脚本本身即卡点，不依赖是否已有 CI。
  - **为什么要 perFile**：本包 19 个源文件里 15 个是纯类型声明，编译后不产生可执行语句，
    v8 会直接按 100% 呈现（vitest 输出 `15 empty files skipped`）。只看全局均值会让新增的
    零覆盖率逻辑文件被这 15 个"自动满分"文件稀释；perFile 让每个真正含逻辑的文件各自达标。
  - **门禁已双向验证**：全绿时退出码 0；临时放入一个未覆盖的逻辑文件后退出码 1 并逐项报
    `Coverage for lines (0%) does not meet global threshold (80%) for src/types/__gate-probe.ts`，探针已删除。

### 变更

- **T3 完成（2026-10-11）**：`agri-production/frontend/src/types/{farm,harvest,task}.ts` 三个再导出桩
  已标注 deprecated，写明替代物（`@agri/shared/types/*`）与过渡期（至少一个 major）。
  技术限制已记入桩文件：TypeScript 无法对 `export *` 做符号级 `@deprecated` 标注，
  故声明写在注释里、编辑器不会显示删除线 —— 这不是漏标。

### 计划中（对应合规矩阵 T1~T5）

- T1 版本与发布：语义化版本纪律落地（本文件）；发布渠道在子系统拆为独立仓库后接入私有 npm
- T2 后续：**组件单测**待本包迁入第一批组件资产后开展（当前包内只有类型与样式，无组件可测）；
  另需给本包补一份自己的 `tsconfig.json` —— 现在 `pnpm typecheck` 脚本无配置文件可依，属空转
- T3 废弃标注：`src/types/{farm,harvest,task}.ts` 三个再导出桩标注 deprecated 并保留一个 major 过渡期
- T4 CLI 模板：脚手架产出标准工程骨架并依赖本包
- T5 统一 SSO：验收判据为 sso 子域登录页、Access Token 不驻留 localStorage、Refresh 走 HttpOnly Cookie、全端登出联动

## [0.1.0] - 2026-10-11

### 新增

- **样式资产**：`styles/theme.ts`（品牌色 / 布局尺寸 / antd 主题令牌）与 `styles/global.less`
  （全局样式与 `.agri-*` 布局类）。用户端与运营端共用同一套主题，运营端不再另设深蓝主色。
- **类型资产（17 个真源）**：`types/` 下 11 个叶子类型 + `common` + `input` + `member` +
  `farm` + `harvest` + `task`。
- **包出口**：`.`（样式与类型统一出口）、`./styles/*`、`./types/*`。

### 消费方式（重要）

应用侧经 **pnpm workspace 协议**引用：`"@agri/shared": "workspace:*"`。
解析路径由应用侧 `tsconfig.json` 的 `paths`（`@agri/shared/*`）与 `vite.config.ts` 的 alias 共同保证；
**不要**依赖 `package.json` 的 `exports` 子路径来解析类型 —— 该路径在 `tsc` 侧不可靠（已在 B2 迁移中实测踩到）。

### 已知缺口

- 无单元测试（4.8 要求覆盖率不低于 80%，见 Unreleased T2）；
- 三个再导出桩尚未按 4.8 标注 deprecated（T3）；
- 未接入私有 npm 发布（T1 后续步骤）。
