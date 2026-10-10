# 页面运行时巡检台（page-patrol）

用真实 Chromium 浏览器逐条打开生产管理模块的页面并记录运行时表现。
路由清单从 `agri-production/frontend/src/router/routes.tsx` **自动解析**，不手写路径清单。

## 前置条件

1. **浏览器驱动**（不进 package.json，务必 `--no-save`）：

   ```bash
   cd agri-production/frontend
   npm i puppeteer --no-save
   # 默认源失败时：
   npm i puppeteer --no-save --registry=https://registry.npmmirror.com
   ```

   首次安装会下载 Chrome 到 `~/.cache/puppeteer`（约 190MB，本仓库网络实测约 30 分钟）。

2. **后端**（前端 dev 代理 `/api` → `http://localhost:8099`，见 `vite.config.ts`）：

   ```bash
   # 先把 target 里的 jar 复制一份快照再跑，避免并发构建覆盖
   SPRING_DATASOURCE_USERNAME=root SPRING_DATASOURCE_PASSWORD=root \
     java -jar core-app-1.0.0.jar --server.port=8099
   ```

   就绪判据：日志出现 `Started CorePlatformApplication`。

3. **前端**：

   ```bash
   cd agri-production/frontend
   npx vite --port 5199
   ```

## 登录态

巡检台自己调 `POST /api/v1/auth/login` 换取 `accessToken`，再在页面脚本执行前
按 `src/store/auth.ts` 的键（`agri_token` / `agri_user_info` / `agri_permissions` …）
注入 localStorage，注入形状与 `src/api/auth.ts` 的 `persistSession` 完全同构。

口令优先级：`--pass` > 环境变量 `AGRI_ADMIN_PASSWORD` > 源码默认值。
不要把口令写进 shell 历史，用环境变量。

## 用法

```bash
# 全量 96 条轻量巡检（goto + console error + pageerror）
node scripts/page-patrol.mjs --mode light

# 深度巡检前 N 条（额外截图 + 白屏判定 + 演示数据横幅判定）
node scripts/page-patrol.mjs --mode deep --limit 10

# 精确指定若干页做深检（`=` 前缀=全路径精确匹配，路径可省略开头的 /）
node scripts/page-patrol.mjs --mode deep \
  --filter "=production/dashboard,=admin/production/knowledge"

# 其它常用项
#   --base http://localhost:5199   前端基址
#   --api   http://localhost:8099  后端基址
#   --only-user / --only-admin     只跑用户端 / 运营端
#   --no-login                     以未登录态巡检
#   --filter farms                 子串过滤
#   --out /tmp/report.json         JSON 报告路径
#   --shots /tmp/shots             截图目录（默认 /tmp，绝不写进仓库）
```

> **Git Bash / MSYS 用户注意**：以 `/` 开头的过滤参数会被 MSYS 强制转换成本地盘路径
> （实测 `=/production/dashboard` 被改成 `=D:/Program Files/.../dashboard`），
> 所以精确匹配时**请省略开头的 `/`**：`"=production/dashboard"`。

## 输出

- 控制台：逐页进度 + 汇总 + Markdown 明细表
- `--out` 指定的 JSON 报告（含全部记录与 summary）
- `--shots` 目录下的截图（仅 `--mode deep`）

每条记录字段：`路径 / 是否白屏 / console错误数（含真实错误数，剥离 antd 弃用告警等
框架噪声，原始值同样保留）/ 首条错误文本 / 是否出现演示数据横幅 / 截图路径`。

## 关于崩溃栈里的行号（重要）

`firstPageErrorStack` 里的 `xxx.tsx:406:83` 是 **Vite 下发模块**的行号，
不是仓库里原始文件的行号——esbuild 的 JSX 转译会整体偏移行号（实测
DisasterReview.tsx 偏移约 96 行）。引用堆栈时必须回原始文件核对，或一并说明这是转译后行号。

核对办法：

```bash
curl -s --noproxy '*' "http://localhost:5199/src/pages/admin/alerts/DisasterReview.tsx" -o /tmp/served.js
sed -n '406p' /tmp/served.js   # 看这一行是什么，再回原文件 grep 定位真实行号
```

## 渲染断言 harness 的三个坑（jsdom + react-dom/client + act + Vite SSR）

浏览器巡检之外，若要在 **Node 里真实挂载页面并断言渲染产物**（`renderToString` 不跑
`useEffect`，凡是请求写在 `useEffect` 里的页面都验不到东西，必须上 jsdom + `act`），
下面三个坑会直接导致**假红 / 假绿**，踩过一遍，记在这里免得重复排查。

### 1. `echarts-for-react` 在 SSR 里会被解析成对象，不是组件

现象：`Element type is invalid: expected a string ... but got: object`，崩溃栈指向用
`<ReactECharts />` 的那一行。

原因：该包是 CJS，`require()` 得到 `{ default: fn }`；Vite SSR 把 node_modules 依赖
externalize，interop 没兜住。**浏览器端由 Vite 打包处理，完全正常** —— 所以这是
harness 侧问题，**不是页面 bug**，不要去改页面。

处理：把 `echarts-for-react` alias 成一个桩组件，把 `option.series[0].data` 以文本渲染
出来，这样饼图/柱图的**真实数据**仍然可以断言。

⚠️ alias 必须写进 `resolve.alias`，**写在自定义插件的 `resolveId` 里不生效** ——
`vite:alias` 先跑，会把裸包名解析成 node_modules 路径并 externalize。

### 2. Modal / message / Tooltip 走 portal，只读 `container.innerHTML` 会漏掉内容

现象：交互明明执行了（弹窗都开了），断言却说结果不存在，误判成"功能没生效"。

原因：antd 的弹窗类组件挂在 `document.body` 上，不在挂载容器里。批量验真结果弹窗、
`message` toast 全都会漏掉。

处理：挂载前记录 `document.body.children` 快照作为基线，断言时取"基线之外的 body 子节点"。
**记得把容器自身也排除掉**，否则 HTML 会整份重复一倍。

### 3. 用例隔离不能靠 `document.body.innerHTML = ''`

现象：跑批随机崩在某个用例，报
`NotFoundError: The node to be removed is not a child of this node`。

原因：清空 body 后，上一个用例残留的 in-flight 请求 resolve，React 去更新一棵**已 detach**
的树，rc-motion 退场动画移除节点时抛错。打真实后端时必现（比替身慢），打替身时偶现。

处理：**不要清空 body，也不要在下一个用例开始时 `root.unmount()`**（unmount 同样会触发）。
改为「不清空 + 按基线过滤」，并在每个用例开始前留约 300ms 让上一个用例的请求 settle。

### 附：两条同源的小经验

- `process.env` 必须在**调用时**读取，不能在替身模块的顶层读 —— Vite SSR 模块只求值一次，
  顶层读会让后续用例一直沿用第一个用例的值，制造**假通过**（live 用例实际打的是替身）。
- 断言文案若包含被 `<strong>` 等标签包裹的文字，HTML 去标签时**不要插空格**替换
  （`replace(/<[^>]*>/g, '')`），否则「是推导值」会变成「是 推导值」，断言不上。

## 纪律

本脚本**只观测、不修复**：不修改任何被测页面源码，不 mock 接口，不跳过失败页面。
跑不通就如实记录跑不通。
