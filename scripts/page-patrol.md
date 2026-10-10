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

## 端点实测：404 / 500 的三种成因（看代码判定会全判错）

后端 **HTTP 恒为 200**，一切成败都在 body 的 `code` 里（`request.ts` 的 SUCCESS_CODE=0）。
因此"这个接口是不是不存在"只能靠**实测 body**，不能靠看 URL 像不像、也不能靠看有没有 404 页。
下面三种成因的表现完全不同，混为一谈会得出完全错误的结论（实测自 core-app :8098）。

### 1. 「404 资源不存在」很可能不是"没数据"，而是 URL 被通配 `/{id}` 吞了

现象：`GET /settings/tenant`、`GET /analytics/dimension` 都返回 `code=404 资源不存在`，
看起来像"这个租户/这个维度没有数据"。

真相：控制器里有 `@GetMapping("/{id}")` 的**详情端点**，这些子路径被它当成 id 匹配走了，
`detail("tenant")` 查不到就抛 NOT_FOUND。判定方法（很硬，建议照抄）：

```
GET /analytics/dimension        → 404 资源不存在
GET /analytics/zzz-not-exist    → 404 资源不存在   ← 与上面**完全一致**
GET /analytics/DEMO-SNAP-001    → 200 有数据
```

**与一个确定不存在的 id 返回完全一致 = 端点缺失**，不是数据缺失。

⚠️ 危害：诊断时会把"资源不存在"误读成数据问题，于是去补数据、加兜底、造示例数据，
而实际上那个端点从来没有过。同一个 `/{id}` 也会吞掉**写**请求——
`PUT /settings/tenant`、`PUT /settings/batch` 都走 `@PutMapping("/{id}")`。

### 2. 端点完全不存在时是 **500**，不是 404 —— 看 `NoResourceFoundException`

没有任何 handler 匹配 → Spring 把它当静态资源找 → 找不到 → 抛
`org.springframework.web.servlet.resource.NoResourceFoundException: No static resource api/v1/production/analytics/reports/subscriptions.`
→ 全局异常处理 → `code=500 系统繁忙，请稍后重试`。

所以 **500 未必是路径漏了一个段，也未必是后端 bug**。日志原文里出现
`NoResourceFoundException: No static resource ...` 就是**端点根本不存在**。

### 3. 端点存在但参数名不匹配，同样是 500

`GET /settings/by-key` 要的参数名是 `settingKey`：

```
?settingKey=xxx → 200
?configKey=xxx  → 500，日志：MissingServletRequestParameterException:
                  Required request parameter 'settingKey' for method parameter type String is not present
```

### → 排障顺序：先排路径、再排参数名

看到 500 时按这个顺序走，不要直接判"端点不存在"或"后端 bug"：

1. 日志里有没有 `NoResourceFoundException` → 有 = 端点不存在
2. 日志里有没有 `MissingServletRequestParameterException` → 有 = 端点存在，参数名不对
3. 都没有 → 才是真的后端异常

同理，看到 404 时先怀疑"是不是被 `/{id}` 吞了"，用"与不存在的 id 对比"验证。

### 附：写操作的「假成功」比读操作危险，且只在后端失败时才暴露

判据：**成功才 `message.success`；失败必须 `message.error` 并带上真实失败原因**，
不许 catch 里留一句注释（如「后端骨架阶段保存失败，保留本地生效」）然后无条件 success。

- 验收必须**成对**：后端可用时验一次、**后端停掉时验一次**（第二种才是重点）。
- 若产品确实需要"后端不可用时本地暂存"，必须明确告诉用户**「仅保存在本地，未同步服务端」**，
  并常驻一条横幅——只弹 toast 的话，3 秒后表格里仍是一套服务端并不存在的配置值。
- 正确模板：`api/settings.ts` 的 `listOperationLogs`，它把 `unavailableReason` 透传给页面。
- 注意别让 `absent` 断言撞上自己的文案（横幅里引用了成功提示原文，会让"没有成功提示"的断言误判）。

### 附 2：两种"HTTP 200 + code 0 但其实没干活"的静默失败

前面那节的"假成功"是**前端自己骗自己**（catch 里无条件 success）。下面两种更隐蔽：
后端真的回了 `{"code":0,"message":"success"}`，前端也真的没撒谎，但**事情并没办成**。
只验"返回 200 / 没有报错"会全部漏掉。

#### 类型一：静默写空（写进去了，但字段是 null）

现象：`POST /settings`（旧实现）返回 200 + `settingId`，**回读却发现
`setting_key=null`、`setting_value=null`** —— 一行空记录被写进了库。

成因：前端字段名与后端 DTO 不一致（前端 `configKey/configValue`，
后端要 `settingKey/settingValue`），后端没有校验、直接落库。

判定：`INSERT` 类操作**必须回读**刚写进去的那条记录，逐字段比对非空。

#### 类型二：静默无操作（返回成功，但没有任何一行被改/删）

现象：`DELETE /settings/{不存在的 id}` 返回 `{"code":0,"message":"success"}`，
**但该 id 的记录压根不存在，一行也没删掉**；再按 key 回读，记录仍在。

判定：`UPDATE` / `DELETE` 类操作必须**回读校验"目标状态确实达成了"**，
而不是只看返回值。

#### 共同判据：写操作必须「回读」才算验过

统一标准（团队约定）：

> **写操作的验收 = 调用 → 回读 → 比对。只看到 200 / code 0 不算数。**

标准动作模板就是 `api/settings.ts` 的 `deleteSetting`：

1. 先 `GET` 拿到目标记录的**真实 id**（不要自己拼 id）；
2. 执行写操作；
3. **再 `GET` 一次**：
   - 删除类 → 记录必须查不到；查得到就抛「删除未生效：后端返回成功但记录仍在」；
   - 新增/修改类 → 关键字段必须非空且等于写入值；是 null 就抛「写入未生效」。

实测样例（本轮 core-app :8098）：

| 操作 | 返回 | 回读结果 | 结论 |
| --- | --- | --- | --- |
| `POST /settings/save`（字段名映射正确） | 200 / code 0 | 10 个配置键全部非空、值正确 | 真生效 |
| `POST /settings`（旧实现，字段名不对） | 200 / code 0 + settingId | `setting_key=null` | **静默写空** |
| `DELETE /settings/{不存在 id}` | 200 / code 0 | 记录仍在 | **静默无操作** |
| `POST /harvests/inventory/{batchId}/out` | 200 / code 0 + flowId | `prod_inventory_flow` 多一行、按 batchId 回读查得到 | 真生效 |
| `POST /harvests/inventory/in` 等 4 个 | 200 / **code 500**（`NoResourceFoundException` / `HttpRequestMethodNotSupportedException`） | — | 端点不存在 |

#### 排障提示：别把"端点不存在"报成"接口建设中"

后端 `NoResourceFoundException` 与**方法不被允许**（`HttpRequestMethodNotSupportedException`，
例如只有 `GET /harvests/inventory` 却发了 POST）都表现为 **HTTP 200 + code 500**，
与"服务端真异常"无法从响应体区分 —— 必须翻日志看异常类名。

同理，演示兜底横幅不能写「接口建设中」：`queryInventoryFlows` 曾把路径写错
（`/harvests/inventory/{batchId}/flows`），实测返回 code 500，兜底既不触发、页面也不报错，
只剩一张**空表**，看上去像"这段时间没有流水"，排障方向被彻底带偏。
现在兜底结果带 `demoReason`，失败态也会原样显示后端原因。

## 纪律

本脚本**只观测、不修复**：不修改任何被测页面源码，不 mock 接口，不跳过失败页面。
跑不通就如实记录跑不通。

### 协同纪律：同文件撞车时用 `git apply --cached` 按 hunk 暂存

多智能体并行时，同一份文件常有别人的**在途未提交改动**。
这时 `git add -- <路径>` / `git commit -- <路径>` 会**把别人的改动一起提交进去**。

解法：只把自己的改动做成补丁，**只作用于索引**：

```bash
# 1) 取当前 HEAD 版本作为基线（索引里也是这份）
git show HEAD:<文件> > /tmp/base.ts

# 2) 在 base 上只应用"我自己的那一处改动" → /tmp/mine.ts
#    （脚本化替换最稳：命中不到原文就报错退出，不要半途而废）

# 3) 生成补丁并把路径头改回仓库路径（只留自己的 hunk）
git diff --no-index --no-color -U3 /tmp/base.ts /tmp/mine.ts \
  | sed -e 's|a/base.ts|a/<仓库路径>|' -e 's|b/mine.ts|b/<仓库路径>|' \
  | tr -d '\r' > /tmp/mine.patch      # 去掉 CRLF，否则 apply 失败

# 4) 只动索引，工作区原样不动
git apply --cached /tmp/mine.patch
git commit -m "..."                    # 提交后 git status 里只剩别人的改动
```

要点：
- `--cached` 是关键：补丁只进索引，**不碰工作区**，别人的在途改动原封不动；
- 第 2 步一定要先 `git apply --cached --check` 试一遍；
- 补丁必须 `tr -d '\r'`，CRLF 会让 `git apply` 报 "patch does not apply"；
- 提交后 `git status` 若该文件仍是 ` M`（工作区改、索引干净），说明成功。

另外：自己的改动也要**同时写进工作区**，否则下次 `git status` 会把自己没保存的改动
和别人的混在一起看不清。
