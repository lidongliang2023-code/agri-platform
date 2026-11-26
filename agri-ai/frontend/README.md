# AI 运营台

Vue 3 + Vite 工程，使用 `src/App.vue` 管理启动、账号、导航、通知、错误与提示状态，并在组件生命周期中注册和清理事件及轮询。

`src/console.js` 保留场景、提示词、调试、调用日志、模型配置、熔断和故障切换的现有接口与业务行为。业务 HTML 由本地渲染函数生成，经 Vue 的 `v-html` 挂载后绑定表单事件；接口文本仍经过原有转义，不将接口内容编译成 Vue 模板。页面外壳和响应式状态使用 Vue 3，业务表单尚保留原有 DOM 事件绑定方式。

在仓库根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm --dir agri-ai/frontend dev
pnpm --dir agri-ai/frontend build
pnpm --dir agri-ai/frontend test:smoke
```

开发服务器将 `/api` 代理到 `http://localhost:8201`。构建输出到 `agri-ai/src/main/resources/static/ai-ops/`，继续由 AI 后端在 `/ai-ops/` 同源托管，登录回调仍使用 `/sso/callback`。

`mvn -f agri-ai/pom.xml package` 会在 `generate-resources` 阶段自动构建前端；首次打包前须完成根目录的 pnpm 安装。禁止直接编辑生成的静态资源。

浏览器回归使用隔离的本地 API 数据和临时浏览器配置目录，不访问实际模型或修改业务数据。Windows 默认使用 Edge；其他环境通过 `AGRI_BROWSER_PATH` 指定 Chromium 可执行文件。
