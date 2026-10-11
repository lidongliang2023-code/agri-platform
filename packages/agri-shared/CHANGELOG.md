# 变更日志（@agri/shared）

格式依据 V2.0 第 4.8 节「共享资产生命周期与前端团队协作规范」：
语义化版本（major / minor / patch）、废弃须标注且**保留至少一个大版本过渡期**。
本文件只记公开变更，内部重构不记。

## [Unreleased]

### 变更

- **T3 完成（2026-10-11）**：`agri-production/frontend/src/types/{farm,harvest,task}.ts` 三个再导出桩
  已标注 deprecated，写明替代物（`@agri/shared/types/*`）与过渡期（至少一个 major）。
  技术限制已记入桩文件：TypeScript 无法对 `export *` 做符号级 `@deprecated` 标注，
  故声明写在注释里、编辑器不会显示删除线 —— 这不是漏标。

### 计划中（对应合规矩阵 T1~T4）

- T1 版本与发布：语义化版本纪律落地（本文件）；发布渠道在子系统拆为独立仓库后接入私有 npm
- T2 质量门禁：接入 vitest，组件单测覆盖率不低于 80%
- T3 废弃标注：`src/types/{farm,harvest,task}.ts` 三个再导出桩标注 deprecated 并保留一个 major 过渡期
- T4 CLI 模板：脚手架产出标准工程骨架并依赖本包

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
